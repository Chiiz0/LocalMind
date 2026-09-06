import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import ava, { type TestFn } from 'ava';

import { Models } from '../../models';
import { createTestingModule, type TestingModule } from '../utils';

const test = ava.serial as TestFn<{
  module: TestingModule;
  db: PrismaClient;
  models: Models;
  ownerId: string;
  memberId: string;
  outsiderId: string;
  workspaceId: string;
}>;

const rights = {
  canRead: true,
  canWrite: false,
  canOrganize: false,
  canCreateFolder: false,
};

test.before(async t => {
  const module = await createTestingModule();
  Object.assign(t.context, {
    module,
    db: module.get(PrismaClient),
    models: module.get(Models),
  });
});

test.beforeEach(async t => {
  const { module, models } = t.context;
  await module.initTestingDB();
  const owner = await models.user.create({
    email: `directory-owner-${randomUUID()}@example.invalid`,
  });
  const member = await models.user.create({
    email: `directory-member-${randomUUID()}@example.invalid`,
  });
  const outsider = await models.user.create({
    email: `directory-outsider-${randomUUID()}@example.invalid`,
  });
  const workspace = await models.workspace.create(owner.id);
  await t.context.db.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: member.id,
      role: 'member',
      state: 'active',
      source: 'legacy',
    },
  });
  Object.assign(t.context, {
    ownerId: owner.id,
    memberId: member.id,
    outsiderId: outsider.id,
    workspaceId: workspace.id,
  });
});

test.after.always(async t => {
  await t.context.module?.close();
});

test('only active administrators can inspect or change directory policies', async t => {
  const { models, workspaceId, memberId } = t.context;
  await t.throwsAsync(
    models.workspaceDirectoryGrant.policies(workspaceId, memberId)
  );
  await t.throwsAsync(
    models.workspaceDirectoryGrant.change({
      workspaceId,
      actorId: memberId,
      directoryId: '$root',
      principalId: '*',
      rights,
    })
  );
});

test('request snapshots preserve per-principal precedence and ancestor denial', async t => {
  const { models, ownerId, memberId, workspaceId } = t.context;
  await models.workspaceDirectoryGrant.set({
    workspaceId,
    actorId: ownerId,
    directoryId: 'parent',
    principalId: '*',
    rights,
  });
  await models.workspaceDirectoryGrant.set({
    workspaceId,
    actorId: ownerId,
    directoryId: 'child',
    principalId: '*',
    rights: { ...rights, canRead: false },
  });
  await models.workspaceDirectoryGrant.set({
    workspaceId,
    actorId: ownerId,
    directoryId: 'child',
    principalId: memberId,
    rights: { ...rights, canWrite: true },
  });
  const snapshot = await models.workspaceDirectoryGrant.snapshot(
    workspaceId,
    memberId
  );
  t.true(snapshot.fullSyncAllowed);
  t.deepEqual(snapshot.rights(['parent', 'child']), rights);
  t.true(snapshot.rights(['child']).canWrite);
  await models.workspaceDirectoryGrant.set({
    workspaceId,
    actorId: ownerId,
    directoryId: '$root',
    principalId: '*',
    rights: { ...rights, canRead: false },
  });
  const next = await models.workspaceDirectoryGrant.snapshot(
    workspaceId,
    memberId
  );
  t.false(next.fullSyncAllowed);
  t.false(next.rights(['parent', 'child']).canRead);
  t.deepEqual(
    next.rights(['parent', 'child']),
    await models.workspaceDirectoryGrant.rights({
      workspaceId,
      actorId: memberId,
      directoryIds: ['parent', 'child'],
    })
  );
  t.throws(() =>
    next.rights(Array.from({ length: 65 }, (_, index) => String(index)))
  );
});

test('conditional changes reject stale revisions and invalid principals', async t => {
  const { db, models, ownerId, outsiderId, workspaceId } = t.context;
  const directoryRevision = 'a'.repeat(64);
  const expectedRevision =
    await models.workspaceDirectoryGrant.administrationRevision(
      workspaceId,
      ownerId,
      directoryRevision
    );
  let targetChecks = 0;
  const first = await models.workspaceDirectoryGrant.changeConditional(
    {
      workspaceId,
      actorId: ownerId,
      directoryId: '$root',
      principalId: '*',
      rights,
      expectedRevision,
    },
    {
      directoryRevision: async () => directoryRevision,
      assertDirectoryTarget: async () => {
        targetChecks++;
      },
    }
  );
  t.is(targetChecks, 1);
  t.truthy(first.policy);
  t.not(first.revision, expectedRevision);
  await t.throwsAsync(
    models.workspaceDirectoryGrant.changeConditional(
      {
        workspaceId,
        actorId: ownerId,
        directoryId: 'folder-stale',
        principalId: '*',
        rights,
        expectedRevision,
      },
      {
        directoryRevision: async () => directoryRevision,
        assertDirectoryTarget: async () => {
          targetChecks++;
        },
      }
    ),
    { message: /refresh before editing/ }
  );
  t.is(targetChecks, 1);
  await t.throwsAsync(
    models.workspaceDirectoryGrant.changeConditional(
      {
        workspaceId,
        actorId: ownerId,
        directoryId: 'folder-one',
        principalId: outsiderId,
        rights,
        expectedRevision: first.revision,
      },
      {
        directoryRevision: async () => directoryRevision,
        assertDirectoryTarget: async () => {},
      }
    ),
    { message: /active Workspace member/ }
  );
  t.is(
    await db.workspaceDirectoryPolicyEvent.count({ where: { workspaceId } }),
    1
  );
});

test('idempotent set and empty clear do not create false audit events', async t => {
  const { db, models, ownerId, workspaceId } = t.context;
  await models.workspaceDirectoryGrant.set({
    workspaceId,
    actorId: ownerId,
    directoryId: '$root',
    principalId: '*',
    rights,
  });
  await models.workspaceDirectoryGrant.set({
    workspaceId,
    actorId: ownerId,
    directoryId: '$root',
    principalId: '*',
    rights,
  });
  await models.workspaceDirectoryGrant.change({
    workspaceId,
    actorId: ownerId,
    directoryId: 'missing-folder',
    principalId: '*',
    rights: null,
  });
  t.is(
    await db.workspaceDirectoryPolicyEvent.count({ where: { workspaceId } }),
    1
  );
});

test('same-revision concurrent administration permits one writer', async t => {
  const { db, models, ownerId, memberId, workspaceId } = t.context;
  const directoryRevision = 'b'.repeat(64);
  const expectedRevision =
    await models.workspaceDirectoryGrant.administrationRevision(
      workspaceId,
      ownerId,
      directoryRevision
    );
  const options = {
    directoryRevision: async () => directoryRevision,
    assertDirectoryTarget: async () => {},
  };
  const results = await Promise.allSettled([
    models.workspaceDirectoryGrant.changeConditional(
      {
        workspaceId,
        actorId: ownerId,
        directoryId: '$root',
        principalId: '*',
        rights,
        expectedRevision,
      },
      options
    ),
    models.workspaceDirectoryGrant.changeConditional(
      {
        workspaceId,
        actorId: ownerId,
        directoryId: '$root',
        principalId: memberId,
        rights: { ...rights, canWrite: true },
        expectedRevision,
      },
      options
    ),
  ]);
  t.is(results.filter(result => result.status === 'fulfilled').length, 1);
  t.is(results.filter(result => result.status === 'rejected').length, 1);
  t.is(
    await db.workspaceDirectoryPolicyEvent.count({ where: { workspaceId } }),
    1
  );
});

test('clearing a departed member override is allowed and audit is immutable', async t => {
  const { db, models, ownerId, memberId, workspaceId } = t.context;
  await models.workspaceDirectoryGrant.set({
    workspaceId,
    actorId: ownerId,
    directoryId: '$root',
    principalId: memberId,
    rights,
  });
  await db.workspaceMember.deleteMany({
    where: { workspaceId, userId: memberId, state: 'active' },
  });
  await models.workspaceDirectoryGrant.change({
    workspaceId,
    actorId: ownerId,
    directoryId: '$root',
    principalId: memberId,
    rights: null,
  });
  const events = await models.workspaceDirectoryGrant.history(
    workspaceId,
    ownerId
  );
  t.deepEqual(
    events.map(event => event.action),
    ['clear', 'set']
  );
  await t.throwsAsync(
    db.workspaceDirectoryPolicyEvent.update({
      where: { id: events[0].id },
      data: { action: 'set' },
    }),
    { message: /immutable/ }
  );
  await t.throwsAsync(
    db.workspaceDirectoryPolicyEvent.delete({ where: { id: events[0].id } }),
    { message: /immutable/ }
  );
});
