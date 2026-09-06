import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import ava, { type TestFn } from 'ava';

import { Models } from '../../models';
import { createTestingModule, type TestingModule } from '../utils';

const test = ava.serial as TestFn<{
  module: TestingModule;
  models: Models;
  db: PrismaClient;
  actorId: string;
  sessionId: string;
  projectId: string;
}>;

test.before(async t => {
  const module = await createTestingModule();
  Object.assign(t.context, {
    module,
    models: module.get(Models),
    db: module.get(PrismaClient),
  });
});
test.beforeEach(async t => {
  const { module, models, db } = t.context;
  await module.initTestingDB();
  const actor = await models.user.create({
    email: 'document-operation@example.com',
  });
  const workspace = await models.workspace.create(actor.id);
  const project = await db.aiContextProject.create({
    data: {
      name: 'Creation test',
      createdByUserId: actor.id,
      members: { create: { userId: actor.id, role: 'owner' } },
    },
  });
  const sessionId = await models.copilotSession.createWithPrompt({
    sessionId: randomUUID(),
    userId: actor.id,
    workspaceId: workspace.id,
    selectedContextProjectId: project.id,
    title: null,
    prompt: { name: 'operation-test', model: 'gpt-5-mini', action: null },
  });
  Object.assign(t.context, {
    actorId: actor.id,
    sessionId,
    projectId: project.id,
  });
});
test.after.always(async t => {
  await t.context.module.close();
});

const input = (context: { actorId: string; sessionId: string }) => ({
  actorId: context.actorId,
  sessionId: context.sessionId,
  requestKey: 'turn-one',
  title: 'A document',
  markdown: 'Private draft',
  addToProject: true,
});

test('copy preparation freezes independent source and attachments with bounded audit evidence', async t => {
  const { models, db, actorId } = t.context;
  const model = models.copilotDocumentOperation;
  const request = {
    ...input(t.context),
    markdown: '',
    copySource: {
      workspaceId: 'source-workspace',
      documentId: 'source-document',
      snapshot: Buffer.from('private structured source'),
      assets: [
        {
          key: 'image',
          data: Buffer.from('private attachment bytes'),
          contentType: 'image/png',
        },
      ],
    },
  };
  const first = await model.prepare(request);
  const second = await model.prepare(request);
  t.is(first.id, second.id);
  t.is(first.kind, 'copy');
  t.not(first.documentId, request.copySource.documentId);
  t.is(first.createdDocumentAt, null);
  const source = await model.copySource({ actorId, operationId: first.id });
  t.deepEqual(Buffer.from(source!.snapshot), request.copySource.snapshot);
  t.deepEqual(
    Buffer.from(source!.assets[0].data),
    request.copySource.assets[0].data
  );
  await t.throwsAsync(
    model.prepare({
      ...request,
      copySource: { ...request.copySource, snapshot: Buffer.from('different') },
    })
  );
  await t.throwsAsync(
    model.copySource({ actorId: 'outsider', operationId: first.id })
  );
  await t.throwsAsync(
    db.copilotDocumentCopySource.update({
      where: { operationId: first.id },
      data: { snapshot: Buffer.from('changed') },
    })
  );
  await t.throwsAsync(
    db.copilotDocumentCopyAsset.deleteMany({ where: { operationId: first.id } })
  );
  await t.throwsAsync(
    db.copilotDocumentCopySource.delete({ where: { operationId: first.id } })
  );
  await t.throwsAsync(
    db.copilotDocumentOperation.update({
      where: { id: first.id },
      data: { kind: 'create' },
    })
  );
  const events = await db.copilotDocumentOperationEvent.findMany({
    where: { operationId: first.id, eventType: 'copy_source_frozen' },
  });
  t.is(events.length, 1);
  t.like(events[0].detail, {
    workspaceId: 'source-workspace',
    documentId: 'source-document',
    assetCount: 1,
  });
  t.false(JSON.stringify(events).includes('private'));
  await db.copilotDocumentOperation.delete({ where: { id: first.id } });
  t.is(
    await db.copilotDocumentCopyAsset.count({
      where: { operationId: first.id },
    }),
    0
  );
});

test('copy source is required at commit and attachment keys cannot be ambiguous', async t => {
  const { models, db } = t.context;
  const operation = await models.copilotDocumentOperation.prepare(
    input(t.context)
  );
  await t.throwsAsync(
    db.copilotDocumentOperation.create({
      data: {
        sessionId: operation.sessionId,
        actorId: operation.actorId,
        projectId: operation.projectId,
        requestKey: 'missing-source',
        title: 'Missing source',
        markdown: '',
        kind: 'copy',
        contentFingerprint: 'a'.repeat(64),
      },
    })
  );
  await t.throwsAsync(
    models.copilotDocumentOperation.prepare({
      ...input(t.context),
      requestKey: 'ambiguous-assets',
      markdown: '',
      copySource: {
        workspaceId: 'source',
        documentId: 'source-doc',
        snapshot: Buffer.from('snapshot'),
        assets: [
          { key: 'same', data: Buffer.from('one'), contentType: 'text/plain' },
          { key: 'same', data: Buffer.from('two'), contentType: 'text/plain' },
        ],
      },
    })
  );
});

test('operation pagination retains older pending requests and rejects foreign cursors', async t => {
  const { models, actorId, sessionId } = t.context;
  const model = models.copilotDocumentOperation;
  const oldest = await model.prepare(input(t.context));
  for (let index = 0; index < 20; index++) {
    await model.prepare({ ...input(t.context), requestKey: `later-${index}` });
  }
  const first = await model.list(sessionId, actorId);
  t.is(first.length, 20);
  t.false(first.some(operation => operation.id === oldest.id));
  const next = await model.list(sessionId, actorId, first[19].id);
  t.deepEqual(
    next.map(operation => operation.id),
    [oldest.id]
  );
  t.is(next[0].status, 'waiting_location');
  await t.throwsAsync(model.list(sessionId, actorId, randomUUID()));
  await t.throwsAsync(model.list(sessionId, 'outsider', first[19].id));
});

test('preparation is idempotent, creates no document, and cannot execute without an explicit destination', async t => {
  const { models, db, actorId } = t.context;
  const model = models.copilotDocumentOperation;
  const rows = await Promise.all([
    model.prepare(input(t.context)),
    model.prepare(input(t.context)),
  ]);
  t.is(rows[0].id, rows[1].id);
  t.is(rows[0].documentId, rows[1].documentId);
  t.is(rows[0].status, 'waiting_location');
  t.is(rows[0].destinationWorkspaceId, null);
  const docsBefore = await db.workspaceDoc.count();
  await t.throwsAsync(
    model.acquire({ actorId, operationId: rows[0].id, expectedRevision: 0 })
  );
  t.is(await db.workspaceDoc.count(), docsBefore);
  await t.throwsAsync(
    model.prepare({ ...input(t.context), markdown: 'Different contents' })
  );
  await t.throwsAsync(
    model.get({ actorId: 'outsider', operationId: rows[0].id })
  );
  await t.throwsAsync(
    db.copilotDocumentOperation.update({
      where: { id: rows[0].id },
      data: { markdown: 'tampered' },
    })
  );
});

test('destination revisions and leases serialize execution and preserve the created outcome through project failure', async t => {
  const { models, db, actorId } = t.context;
  const model = models.copilotDocumentOperation;
  const prepared = await model.prepare(input(t.context));
  const actor = { actorId, operationId: prepared.id };
  const ready = await model.confirmDestination({
    ...actor,
    permissionEvidence: {
      actorId,
      workspaceId: 'destination',
      canCreateDoc: true,
      canReadOrganization: true,
      canSync: true,
      canRead: true,
      canWrite: true,
      canOrganize: true,
    },
    workspaceId: 'destination',
    folderId: null,
    fingerprint: 'a'.repeat(64),
    expectedRevision: 0,
  });
  t.is(ready.destinationRevision, 1);
  await t.throwsAsync(
    model.confirmDestination({
      ...actor,
      permissionEvidence: {
        actorId,
        workspaceId: 'other',
        canCreateDoc: true,
        canReadOrganization: true,
        canSync: true,
        canRead: true,
        canWrite: true,
        canOrganize: true,
      },
      workspaceId: 'other',
      folderId: null,
      fingerprint: 'a'.repeat(64),
      expectedRevision: 0,
    })
  );
  const attempts = await Promise.allSettled([
    model.acquire({ ...actor, expectedRevision: 1 }),
    model.acquire({ ...actor, expectedRevision: 1 }),
  ]);
  t.is(attempts.filter(result => result.status === 'fulfilled').length, 1);
  const executing = await model.get(actor);
  const lease = { ...actor, leaseToken: executing.leaseToken! };
  await model.fail({ ...lease, failureCode: 'storage_unavailable' });
  await t.throwsAsync(
    model.confirmDestination({
      ...actor,
      permissionEvidence: {
        actorId,
        workspaceId: 'other',
        canCreateDoc: true,
        canReadOrganization: true,
        canSync: true,
        canRead: true,
        canWrite: true,
        canOrganize: true,
      },
      workspaceId: 'other',
      folderId: null,
      fingerprint: 'a'.repeat(64),
      expectedRevision: 1,
    })
  );
  const retried = await model.acquire({ ...actor, expectedRevision: 1 });
  t.is(retried.documentId, prepared.documentId);
  await t.throwsAsync(model.recordCreated(lease));
  const newLease = { ...actor, leaseToken: retried.leaseToken! };
  await t.throwsAsync(model.recordCreated(newLease), {
    message: /before the document body/,
  });
  await models.doc.createUpdates([
    {
      spaceId: 'destination',
      docId: prepared.documentId,
      blob: Buffer.from('persisted body'),
      timestamp: Date.now(),
      editorId: actorId,
    },
  ]);
  const created = await model.recordCreated(newLease);
  await model.recordPlaced(newLease);
  const failedAddition = await model.finish({
    ...newLease,
    projectStatus: 'failed',
  });
  t.is(failedAddition.status, 'created');
  t.deepEqual(failedAddition.createdDocumentAt, created.createdDocumentAt);
  const joinRetry = await model.acquire({ ...actor, expectedRevision: 1 });
  const complete = await model.finish({
    ...actor,
    leaseToken: joinRetry.leaseToken!,
    projectStatus: 'requested',
    accessRequestId: 'pending-request',
  });
  t.is(complete.projectStatus, 'requested');
  t.is(complete.documentId, prepared.documentId);
  await t.throwsAsync(
    db.copilotDocumentOperation.update({
      where: { id: prepared.id },
      data: { destinationWorkspaceId: 'other' },
    })
  );
  await t.throwsAsync(model.acquire({ ...actor, expectedRevision: 1 }));
});

test('expired lease recovery and archived project checks reject stale workers', async t => {
  const { models, db, actorId, projectId } = t.context;
  const model = models.copilotDocumentOperation;
  const prepared = await model.prepare(input(t.context));
  const actor = { actorId, operationId: prepared.id };
  await model.confirmDestination({
    ...actor,
    permissionEvidence: {
      actorId,
      workspaceId: 'destination',
      canCreateDoc: true,
      canReadOrganization: true,
      canSync: true,
      canRead: true,
      canWrite: true,
      canOrganize: true,
    },
    workspaceId: 'destination',
    folderId: 'folder',
    fingerprint: 'a'.repeat(64),
    expectedRevision: 0,
  });
  const old = await model.acquire({ ...actor, expectedRevision: 1 });
  await db.copilotDocumentOperation.update({
    where: { id: old.id },
    data: { leaseExpiresAt: new Date(0) },
  });
  const next = await model.acquire({ ...actor, expectedRevision: 1 });
  t.not(next.leaseToken, old.leaseToken);
  await t.throwsAsync(model.renew({ ...actor, leaseToken: old.leaseToken! }));
  await model.renew({ ...actor, leaseToken: next.leaseToken! });
  await t.throwsAsync(
    model.recordCreated({ ...actor, leaseToken: old.leaseToken! })
  );
  await db.aiContextProject.update({
    where: { id: projectId },
    data: { status: 'archived' },
  });
  await t.throwsAsync(
    model.recordCreated({ ...actor, leaseToken: next.leaseToken! })
  );
  await t.throwsAsync(model.prepare(input(t.context)));
});
