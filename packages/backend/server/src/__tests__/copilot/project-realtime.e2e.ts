import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import ava, { type TestFn } from 'ava';
import Sinon from 'sinon';

import { sessionUser } from '../../core/auth/service';
import { ProjectRealtimeProvider } from '../../core/project/realtime';
import {
  RealtimePublisher,
  RealtimeRegistry,
  type RealtimeRequestHandler,
} from '../../core/realtime';
import { Models } from '../../models';
import { createTestingModule, type TestingModule } from '../utils';

const test = ava.serial as TestFn<{ module: TestingModule; db: PrismaClient }>;
test.before(async t => {
  const module = await createTestingModule();
  t.context = { module, db: module.get(PrismaClient) };
});
test.beforeEach(async t => t.context.module.initTestingDB());
test.afterEach.always(() => Sinon.restore());
test.after.always(async t => t.context.module.close());

async function fixture(module: TestingModule, db: PrismaClient) {
  const models = module.get(Models);
  const owner = await models.user.create({
    email: `${randomUUID()}@example.invalid`,
  });
  const member = await models.user.create({
    email: `${randomUUID()}@example.invalid`,
  });
  const outsider = await models.user.create({
    email: `${randomUUID()}@example.invalid`,
  });
  const project = await db.aiContextProject.create({
    data: {
      name: 'Realtime project',
      createdByUserId: owner.id,
      members: {
        create: [
          { userId: owner.id, role: 'owner' },
          { userId: member.id, role: 'member' },
        ],
      },
    },
  });
  return { owner, member, outsider, project };
}

test('Project invalidations commit atomically and never target an unrelated user', async t => {
  const { module, db } = t.context;
  const { project, owner, member, outsider } = await fixture(module, db);
  await db.projectRealtimeOutbox.deleteMany();
  await t.throwsAsync(
    db.$transaction(async tx => {
      await tx.aiContextProject.update({
        where: { id: project.id },
        data: { name: 'Rolled back' },
      });
      t.true((await tx.projectRealtimeOutbox.count()) > 0);
      throw new Error('rollback');
    }),
    { message: 'rollback' }
  );
  t.is(await db.projectRealtimeOutbox.count(), 0);
  await db.aiContextProject.update({
    where: { id: project.id },
    data: { name: 'Committed' },
  });
  const pending = await db.projectRealtimeOutbox.findMany();
  t.deepEqual(
    [...new Set(pending.map(row => row.scopeId))].sort((a, b) =>
      a.localeCompare(b)
    ),
    [owner.id, member.id].sort((a, b) => a.localeCompare(b))
  );
  t.false(pending.some(row => row.scopeId === outsider.id));
  t.true(pending.every(row => row.resourceId === null));
  t.deepEqual(
    [...new Set(pending.map(row => row.topic))].sort((a, b) =>
      a.localeCompare(b)
    ),
    ['project.list.changed', 'project.task.changed']
  );
});

test('removed members receive invalidation but lose Project snapshot and lease subscriptions', async t => {
  const { module, db } = t.context;
  const { project, member, outsider } = await fixture(module, db);
  const registry = module.get(RealtimeRegistry);
  const list = registry.getRequest(
    'project.list.get'
  ) as RealtimeRequestHandler<'project.list.get'>;
  const lease = registry.getTopic('project.lease.changed');
  t.is((await list.handle(sessionUser(member), {})).projects.length, 1);
  t.deepEqual((await list.handle(sessionUser(outsider), {})).projects, []);
  await lease.authorize(sessionUser(member), { projectId: project.id });
  await t.throwsAsync(
    lease.authorize(sessionUser(outsider), { projectId: project.id })
  );
  await db.projectRealtimeOutbox.deleteMany();
  await db.aiContextProjectMember.delete({
    where: { projectId_userId: { projectId: project.id, userId: member.id } },
  });
  t.true(
    (await db.projectRealtimeOutbox.count({
      where: { scopeId: member.id, topic: 'project.list.changed' },
    })) > 0
  );
  t.deepEqual((await list.handle(sessionUser(member), {})).projects, []);
  await t.throwsAsync(
    lease.authorize(sessionUser(member), { projectId: project.id })
  );
});

test('failed delivery is retained, duplicate consumers are harmless and new commits remain queued', async t => {
  const { module, db } = t.context;
  const { project } = await fixture(module, db);
  const provider = module.get(ProjectRealtimeProvider);
  const publish = Sinon.stub(module.get(RealtimePublisher), 'publish').returns(
    false
  );
  const before = await db.projectRealtimeOutbox.count();
  await provider.deliver();
  t.is(await db.projectRealtimeOutbox.count(), before);
  publish.returns(true);
  await Promise.all([provider.deliver(), provider.deliver()]);
  t.is(await db.projectRealtimeOutbox.count(), 0);
  await db.aiContextProject.update({
    where: { id: project.id },
    data: { name: 'Later commit' },
  });
  t.true((await db.projectRealtimeOutbox.count()) > 0);
  await provider.deliver();
  t.is(await db.projectRealtimeOutbox.count(), 0);
  t.true(
    publish.args.every(
      ([, input, event]) =>
        JSON.stringify(input) === '{}' &&
        JSON.stringify(event) === '{"changed":true,"reason":"committed"}'
    )
  );
});

test('file request state invalidates both participants and the ACL-filtered task snapshot', async t => {
  const { module, db } = t.context;
  const { project, owner, member, outsider } = await fixture(module, db);
  await db.projectRealtimeOutbox.deleteMany();
  const request = await db.projectFileRequest.create({
    data: {
      projectId: project.id,
      requesterId: owner.id,
      recipientId: member.id,
      title: 'Requested workbook',
      requestKey: randomUUID(),
      fingerprint: 'a'.repeat(64),
    },
  });
  const snapshot = module
    .get(RealtimeRegistry)
    .getRequest(
      'project.task.get'
    ) as RealtimeRequestHandler<'project.task.get'>;
  t.true(
    (await snapshot.handle(sessionUser(member), {})).tasks.some(task =>
      task.id.includes(request.id)
    )
  );
  t.deepEqual((await snapshot.handle(sessionUser(outsider), {})).tasks, []);
  const pending = await db.projectRealtimeOutbox.findMany();
  t.true(
    pending.some(
      row => row.scopeId === owner.id && row.topic === 'project.task.changed'
    )
  );
  t.true(
    pending.some(
      row => row.scopeId === member.id && row.topic === 'project.task.changed'
    )
  );
  t.false(pending.some(row => row.scopeId === outsider.id));
});
