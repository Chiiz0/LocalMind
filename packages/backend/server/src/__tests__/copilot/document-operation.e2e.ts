import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import { McpAccessMode, PrismaClient } from '@prisma/client';
import ava, { type TestFn } from 'ava';
import Sinon from 'sinon';
import * as Y from 'yjs';

import { EventBus } from '../../base';
import {
  DocReader,
  DocumentDestinationService,
  DocWriter,
  PgWorkspaceDocStorageAdapter,
  readRootDocPageIdsWithYjs,
  WorkspaceOrganizationService,
} from '../../core/doc';
import { WorkspaceDirectoryResolver } from '../../core/doc/directory-resolver';
import { PermissionAccess } from '../../core/permission';
import { WorkspaceBlobStorage } from '../../core/storage';
import { StorageRuntimeProvider } from '../../core/storage-runtime';
import { SpaceSyncGateway } from '../../core/sync/gateway';
import { WorkspacesController } from '../../core/workspaces/controller';
import { WorkspaceBlobResolver } from '../../core/workspaces/resolvers/blob';
import { Models } from '../../models';
import { DocRole } from '../../models/common';
import { permissionWorkspaceLockKey } from '../../models/permission-write';
import { createDocWithMarkdown, readAllDocIdsFromRootDoc } from '../../native';
import { CopilotCronJobs } from '../../plugins/copilot/cron';
import { CopilotDocumentCopyService } from '../../plugins/copilot/document-copy-service';
import { CopilotDocumentOperationResolver } from '../../plugins/copilot/document-operation-resolver';
import { CopilotDocumentOperationService } from '../../plugins/copilot/document-operation-service';
import { MCP_CAPABILITIES } from '../../plugins/copilot/mcp/capabilities';
import { McpCredentialService } from '../../plugins/copilot/mcp/credential';
import { McpAiTaskControlService } from '../../plugins/copilot/mcp/task-control';
import { McpAiTaskQueryService } from '../../plugins/copilot/mcp/task-query';
import {
  createDocCopyRequestTool,
  createDocCreateRequestTool,
  createDocCreationStatusTool,
} from '../../plugins/copilot/tools/doc-write';
import { createTestingModule, type TestingModule } from '../utils';
import { seedProjectSourceGrant } from '../utils/project-source-grant';

const test = ava.serial as TestFn<{
  module: TestingModule;
  models: Models;
  db: PrismaClient;
  service: CopilotDocumentOperationService;
  destination: DocumentDestinationService;
  writer: DocWriter;
  reader: DocReader;
  organization: WorkspaceOrganizationService;
  actorId: string;
  sessionId: string;
  workspaceId: string;
  hostId: string;
  projectId: string;
}>;
test.before(async t => {
  const module = await createTestingModule();
  Object.assign(t.context, {
    module,
    models: module.get(Models),
    db: module.get(PrismaClient),
    service: module.get(CopilotDocumentOperationService),
    destination: module.get(DocumentDestinationService),
    writer: module.get(DocWriter),
    reader: module.get(DocReader),
    organization: module.get(WorkspaceOrganizationService),
  });
});
test.beforeEach(async t => {
  const { module, models, db, writer } = t.context;
  await module.initTestingDB();
  const actor = await models.user.create({
    email: 'document-execution@example.com',
  });
  const host = await models.workspace.create(actor.id);
  const workspace = await models.workspace.create(actor.id);
  for (const current of [host, workspace]) {
    await db.effectiveWorkspaceQuotaState.upsert({
      where: { workspaceId: current.id },
      create: {
        workspaceId: current.id,
        plan: 'free',
        ownerUserId: actor.id,
        seatLimit: 100,
        blobLimit: 0,
        storageQuota: 0,
        historyPeriodSeconds: 0,
        known: true,
        stale: false,
      },
      update: { known: true, stale: false, staleAfter: null },
    });
    const root = new Y.Doc({ guid: current.id });
    if (current.id === workspace.id) {
      for (let i = 0; i < 6; i++) {
        const candidate = new Y.Doc({ guid: current.id });
        candidate.getMap('meta').set('name', 'Isolated document execution');
        candidate.getMap('meta').set('pages', new Y.Array());
        Y.applyUpdate(root, Y.encodeStateAsUpdate(candidate));
        candidate.destroy();
      }
    } else {
      root.getMap('meta').set('name', 'Isolated document execution');
      root.getMap('meta').set('pages', new Y.Array());
    }
    await writer.pushDocUpdate(
      current.id,
      current.id,
      Y.encodeStateAsUpdate(root),
      actor.id
    );
    root.destroy();
  }
  const project = await db.aiContextProject.create({
    data: {
      name: 'Operation project',
      aiPolicy: 'read_write',
      createdByUserId: actor.id,
      members: { create: { userId: actor.id, role: 'owner' } },
    },
  });
  const sessionId = await models.copilotSession.createWithPrompt({
    sessionId: randomUUID(),
    userId: actor.id,
    workspaceId: host.id,
    title: null,
    prompt: { name: 'document-execution', model: 'gpt-5-mini', action: null },
  });
  Object.assign(t.context, {
    actorId: actor.id,
    workspaceId: workspace.id,
    hostId: host.id,
    sessionId,
    projectId: project.id,
  });
});
test.afterEach.always(() => Sinon.restore());
test.after.always(async t => {
  await t.context.module.close();
});

async function pendingDelegatedLocation(context: {
  module: TestingModule;
  models: Models;
  actorId: string;
  hostId: string;
}) {
  const { module, models, actorId, hostId } = context;
  const issued = await module.get(McpCredentialService).create({
    userId: actorId,
    workspaceId: hostId,
    name: 'Isolated location lifecycle',
    accessMode: McpAccessMode.READ_WRITE,
    capabilities: [...MCP_CAPABILITIES],
    expirationDays: 30,
  });
  const { record } = await models.copilotMcpDelegation.createOrReuseRequest({
    workspaceId: hostId,
    actorId,
    credentialId: issued.credential.id,
    credentialFamilyId: issued.credential.familyId,
    credentialGeneration: issued.credential.generation,
    capabilitySnapshot: [...MCP_CAPABILITIES],
    capabilityFingerprint: 'a'.repeat(64),
    idempotencyKey: randomUUID(),
    requestText: 'Create an isolated document.',
    requestedDocumentIds: [],
    requestedAttachmentIds: [],
    requestFingerprint: 'b'.repeat(64),
  });
  const sessionId = await models.copilotMcpDelegation.ensureExecutionSession(
    record.id
  );
  const run = await models.copilotAgentRuntime.createRun({
    workspaceId: hostId,
    actorId,
    sessionId,
    sourceType: 'mcp_ai_delegation',
    sourceId: record.id,
    workflow: 'agent_runtime_localmind_tool_agent',
    status: 'queued',
    steps: [
      { stepKey: 'execute', stepType: 'tool', status: 'pending', order: 0 },
    ],
  });
  await models.copilotMcpDelegation.updateRequest(record.id, {
    agentRunId: run.id,
    status: 'processing',
    result: {},
  });
  const workerLeaseId = randomUUID();
  const leased = await models.copilotAgentRuntime.acquireStandaloneWorkerLease({
    workspaceId: hostId,
    id: run.id,
    workerId: workerLeaseId,
    leaseMs: 300000,
  });
  const operation = await models.copilotDocumentOperation.prepare({
    sessionId,
    actorId,
    requestKey: 'delegated:lifecycle',
    title: 'Location lifecycle',
    markdown: 'Isolated body',
    addToProject: false,
  });
  await models.copilotMcpDelegation.waitForLocation({
    id: record.id,
    runId: run.id,
    workerLeaseId,
    workerAttempt: leased!.workerAttempt,
    operationId: operation.id,
  });
  return {
    issued,
    operation,
    runId: run.id,
    requestId: record.id,
    sessionId,
    workerLeaseId,
  };
}

test('delegated location expiration and competing confirmations require a fresh revision with zero premature writes', async t => {
  const { models, db, actorId, workspaceId, service, module } = t.context;
  const task = await pendingDelegatedLocation(t.context);
  const before = await db.workspaceDoc.count();
  const clock = Sinon.useFakeTimers({
    now: task.operation.locationExpiresAt.getTime() + 1,
    toFake: ['Date'],
  });
  try {
    await models.copilotDocumentOperation.expireLocations();
    t.is(
      (
        await models.copilotDocumentOperation.get({
          actorId,
          operationId: task.operation.id,
        })
      ).status,
      'expired'
    );
    const view = await module
      .get(McpAiTaskQueryService)
      .getTask(
        task.issued.credential,
        { taskId: task.requestId, waitMs: 0 },
        new AbortController().signal
      );
    t.like(view, {
      status: 'waiting_for_location',
      location: { status: 'expired', revision: 0 },
    });
    await t.throwsAsync(
      service.execute({
        actorId,
        operationId: task.operation.id,
        expectedRevision: 0,
      })
    );
    t.is(await db.workspaceDoc.count(), before);
    const confirmations = await Promise.allSettled(
      [0, 1].map(() =>
        service.confirmDestination({
          actorId,
          operationId: task.operation.id,
          workspaceId,
          folderId: null,
          expectedRevision: 0,
        })
      )
    );
    t.is(
      confirmations.filter(result => result.status === 'fulfilled').length,
      1
    );
    const confirmed = await models.copilotDocumentOperation.get({
      actorId,
      operationId: task.operation.id,
    });
    t.is(confirmed.destinationRevision, 1);
    t.true(confirmed.locationExpiresAt.getTime() > Date.now());
    await t.throwsAsync(
      service.execute({
        actorId,
        operationId: task.operation.id,
        expectedRevision: 0,
      })
    );
    t.is(await db.workspaceDoc.count(), before);
  } finally {
    clock.restore();
  }
});

test('delegated location withdrawal is idempotent, cancels the task, and cannot be confirmed or recovered', async t => {
  const { models, db, actorId, workspaceId, service } = t.context;
  const task = await pendingDelegatedLocation(t.context);
  const before = await db.workspaceDoc.count();
  const input = {
    actorId,
    operationId: task.operation.id,
    expectedRevision: 0,
  };
  t.is((await service.withdraw(input)).status, 'cancelled');
  t.is((await service.withdraw(input)).status, 'cancelled');
  t.is(
    (await models.copilotMcpDelegation.getRequest(task.requestId))!.status,
    'cancelled'
  );
  await t.throwsAsync(
    service.confirmDestination({ ...input, workspaceId, folderId: null })
  );
  await models.copilotMcpDelegation.recoverConfirmedLocations(50);
  t.is(
    (await models.copilotAgentRuntime.get(t.context.hostId, task.runId))!
      .status,
    'cancelled'
  );
  t.is(await db.workspaceDoc.count(), before);
  await t.throwsAsync(
    models.copilotAgentRuntime.controlRunForActor({
      workspaceId: t.context.hostId,
      actorId,
      id: task.runId,
      action: 'resume',
    }),
    { message: /conversation cannot be resumed/ }
  );
  t.is(
    (await models.copilotMcpDelegation.getRequest(task.requestId))!.status,
    'cancelled'
  );
});

test('location recovery skips a cancelled run and manual resume synchronizes the delegated request atomically', async t => {
  const { models, actorId, workspaceId, hostId, service, module } = t.context;
  const tasks = [];
  for (let index = 0; index < 2; index++) {
    const task = await pendingDelegatedLocation(t.context);
    await service.confirmDestination({
      actorId,
      operationId: task.operation.id,
      workspaceId,
      folderId: null,
      expectedRevision: 0,
    });
    await service.execute({
      actorId,
      operationId: task.operation.id,
      expectedRevision: 1,
    });
    tasks.push(task);
  }
  const cancelled = await models.copilotAgentRuntime.controlRunForActor({
    workspaceId: hostId,
    actorId,
    id: tasks[0].runId,
    action: 'cancel',
  });
  await models.copilotMcpDelegation.recoverConfirmedLocations(50);
  t.is(
    (await models.copilotAgentRuntime.get(hostId, tasks[0].runId))!.status,
    'cancelled'
  );
  t.is(
    (await models.copilotAgentRuntime.get(hostId, tasks[1].runId))!.status,
    'queued'
  );
  await module
    .get(McpAiTaskControlService)
    .reconcileCancelledAgentRun(cancelled);
  const resumed = await models.copilotAgentRuntime.controlRunForActor({
    workspaceId: hostId,
    actorId,
    id: tasks[0].runId,
    action: 'resume',
  });
  t.is(resumed.status, 'queued');
  t.is(
    (await models.copilotMcpDelegation.getRequest(tasks[0].requestId))!.status,
    'processing'
  );
  const view = await module
    .get(McpAiTaskQueryService)
    .getTask(
      tasks[0].issued.credential,
      { taskId: tasks[0].requestId, waitMs: 0 },
      new AbortController().signal
    );
  t.like(view, { status: 'queued', terminal: false });
});

test('a revoked delegated credential prevents manual resume and preserves terminal state', async t => {
  const { models, actorId, hostId, module } = t.context;
  const task = await pendingDelegatedLocation(t.context);
  const cancelled = await models.copilotAgentRuntime.controlRunForActor({
    workspaceId: hostId,
    actorId,
    id: task.runId,
    action: 'cancel',
  });
  await module
    .get(McpAiTaskControlService)
    .reconcileCancelledAgentRun(cancelled);
  await models.mcpCredential.revokeFamily(
    task.issued.credential.familyId,
    actorId,
    hostId
  );
  await t.throwsAsync(
    models.copilotAgentRuntime.controlRunForActor({
      workspaceId: hostId,
      actorId,
      id: task.runId,
      action: 'resume',
    }),
    { message: /credential is unavailable/ }
  );
  t.is(
    (await models.copilotAgentRuntime.get(hostId, task.runId))!.status,
    'cancelled'
  );
  t.is(
    (await models.copilotMcpDelegation.getRequest(task.requestId))!.status,
    'cancelled'
  );
});

test('shared tool transaction publishes only committed document updates and retains rollback audit', async t => {
  const { db, actorId, workspaceId, organization, writer, reader, module } =
    t.context;
  const event = Sinon.spy(module.get(EventBus), 'emitDetached');
  const before = await reader.getDoc(workspaceId, workspaceId);
  const auditBefore = await db.aiSharedWriteSourceCheck.count();
  const update = new Y.Doc();
  Y.applyUpdate(update, before!.bin);
  const vector = Y.encodeStateVector(update);
  update.getMap('meta').set('name', 'Rolled back isolated title');
  const delta = Y.encodeStateAsUpdate(update, vector);
  await t.throwsAsync(
    organization.withAiSourceCheck({ workspaceId, actorId }, async () => {
      await writer.pushDocUpdate(workspaceId, workspaceId, delta, actorId);
      t.false(event.calledWith('doc.updates.pushed'));
      throw new Error('Isolated rollback');
    }),
    { message: 'Isolated rollback' }
  );
  t.false(event.calledWith('doc.updates.pushed'));
  t.deepEqual(
    (await reader.getDoc(workspaceId, workspaceId))!.bin,
    before!.bin
  );
  t.true((await db.aiSharedWriteSourceCheck.count()) > auditBefore);
  await organization.withAiSourceCheck({ workspaceId, actorId }, async () => {
    await writer.pushDocUpdate(workspaceId, workspaceId, delta, actorId);
    t.false(event.calledWith('doc.updates.pushed'));
  });
  t.true(event.calledWith('doc.updates.pushed'));
  update.destroy();
});

test('delegated location expires abandoned running operations in bounded batches without touching live leases', async t => {
  const { models, db, actorId, workspaceId, service } = t.context;
  const model = models.copilotDocumentOperation;
  const task = await pendingDelegatedLocation(t.context);
  await service.confirmDestination({
    actorId,
    operationId: task.operation.id,
    workspaceId,
    folderId: null,
    expectedRevision: 0,
  });
  const leased = await model.acquire({
    actorId,
    operationId: task.operation.id,
    expectedRevision: 1,
  });
  const later = await model.prepare({
    actorId,
    sessionId: task.sessionId,
    requestKey: 'later-expiration',
    title: 'Later location',
    markdown: 'Isolated body',
    addToProject: false,
  });
  const before = await db.workspaceDoc.count();
  t.is((await model.expireLocations(new Date(), 1)).count, 0);
  t.is(
    (await model.get({ actorId, operationId: leased.id })).status,
    'running'
  );
  const future = new Date(
    Math.max(
      leased.locationExpiresAt.getTime(),
      later.locationExpiresAt.getTime()
    ) + 1
  );
  t.is((await model.expireLocations(future, 1)).count, 1);
  t.is((await model.expireLocations(future, 1)).count, 1);
  t.is((await model.expireLocations(future, 1)).count, 0);
  t.is(
    (await model.get({ actorId, operationId: leased.id })).status,
    'expired'
  );
  await t.throwsAsync(
    model.recordCreated({
      actorId,
      operationId: leased.id,
      leaseToken: leased.leaseToken!,
    })
  );
  t.is(await db.workspaceDoc.count(), before);
});

test('delegated location queue outage recovers its committed result without creating twice', async t => {
  const { models, db, actorId, workspaceId, hostId, service, module, writer } =
    t.context;
  const task = await pendingDelegatedLocation(t.context);
  await service.confirmDestination({
    actorId,
    operationId: task.operation.id,
    workspaceId,
    folderId: null,
    expectedRevision: 0,
  });
  const writes = Sinon.spy(writer, 'createDoc');
  await service.execute({
    actorId,
    operationId: task.operation.id,
    expectedRevision: 1,
  });
  const before = await db.workspaceDoc.count();
  const enqueue = module.queue.add.rejects(new Error('isolated queue outage'));
  await t.throwsAsync(
    service.resumeDelegatedOperation(task.operation.id, actorId)
  );
  t.is(
    (await models.copilotAgentRuntime.get(hostId, task.runId))!.status,
    'queued'
  );
  t.is(
    (await models.copilotMcpDelegation.getRequest(task.requestId))!.status,
    'processing'
  );
  enqueue.resolves();
  await module
    .get(CopilotCronJobs)
    .enqueueQueuedAgentRuntimeRuns({ limit: 50 });
  t.true(
    enqueue.calledWith('copilot.agentRuntime.run', {
      workspaceId: hostId,
      runId: task.runId,
    })
  );
  await service.execute({
    actorId,
    operationId: task.operation.id,
    expectedRevision: 1,
  });
  t.is(writes.callCount, 1);
  t.is(await db.workspaceDoc.count(), before);
});

test('delegated location rejects audience expansion after confirmation and recovers only at a newly confirmed private target', async t => {
  const { models, db, actorId, workspaceId, hostId, service, writer } =
    t.context;
  const task = await pendingDelegatedLocation(t.context);
  await service.confirmDestination({
    actorId,
    operationId: task.operation.id,
    workspaceId,
    folderId: null,
    expectedRevision: 0,
  });
  const outsider = await models.user.create({
    email: 'delegated-new-reader@example.com',
  });
  await db.workspaceMember.create({
    data: { workspaceId, userId: outsider.id, role: 'member', state: 'active' },
  });
  const writes = Sinon.spy(writer, 'createDoc');
  const before = await db.workspaceDoc.count();
  await t.throwsAsync(
    service.execute({
      actorId,
      operationId: task.operation.id,
      expectedRevision: 1,
    })
  );
  t.is(writes.callCount, 0);
  t.is(await db.workspaceDoc.count(), before);
  const denial = await db.aiSharedWriteSourceCheck.findFirstOrThrow({
    where: { sinkId: task.operation.id, allowed: false },
  });
  t.like(denial.audienceEvidence, { workspaceId, known: true });
  t.true(JSON.stringify(denial.sources).includes('private'));
  const confirmed = await service.confirmDestination({
    actorId,
    operationId: task.operation.id,
    workspaceId: hostId,
    folderId: null,
    expectedRevision: 1,
  });
  t.is(confirmed.destinationRevision, 2);
  await t.throwsAsync(
    service.execute({
      actorId,
      operationId: task.operation.id,
      expectedRevision: 1,
    })
  );
  const completed = await service.execute({
    actorId,
    operationId: task.operation.id,
    expectedRevision: 2,
  });
  t.is(completed.status, 'complete');
  t.is(completed.destinationWorkspaceId, hostId);
  t.is(writes.callCount, 1);
});

test('delegated location MCP cancellation closes its pending operation without creating or confirming a document', async t => {
  const { models, db, module, actorId, workspaceId, service } = t.context;
  const task = await pendingDelegatedLocation(t.context);
  const before = await db.workspaceDoc.count();
  const result = await module
    .get(McpAiTaskControlService)
    .control(task.issued.credential, {
      taskId: task.requestId,
      action: 'cancel',
      idempotencyKey: 'cancel-location',
    });
  t.like(result, { taskStatus: 'cancelled', outcome: 'cancelled' });
  const operation = await models.copilotDocumentOperation.get({
    actorId,
    operationId: task.operation.id,
  });
  t.is(operation.status, 'cancelled');
  t.is(operation.destinationRevision, 0);
  t.is(operation.destinationConfirmedBy, null);
  await t.throwsAsync(
    service.confirmDestination({
      actorId,
      operationId: operation.id,
      workspaceId,
      folderId: null,
      expectedRevision: 0,
    })
  );
  t.is(await db.workspaceDoc.count(), before);
});

test('delegated location rechecks revoked credentials and rejects stale worker checkpoints', async t => {
  const { models, db, actorId, workspaceId, service, module, hostId } =
    t.context;
  const task = await pendingDelegatedLocation(t.context);
  const before = await db.workspaceDoc.count();
  await service.confirmDestination({
    actorId,
    operationId: task.operation.id,
    workspaceId,
    folderId: null,
    expectedRevision: 0,
  });
  await module
    .get(McpCredentialService)
    .revoke(task.issued.credential.id, actorId, hostId);
  await t.throwsAsync(
    service.execute({
      actorId,
      operationId: task.operation.id,
      expectedRevision: 1,
    })
  );
  await t.throwsAsync(
    models.copilotMcpDelegation.beginToolCall({
      requestId: task.requestId,
      sessionId: task.sessionId,
      runId: task.runId,
      workerLeaseId: task.workerLeaseId,
      workerAttempt: 1,
      callId: 'stale',
      toolName: 'doc_create',
      args: {},
    })
  );
  t.is(await db.workspaceDoc.count(), before);
  await service.withdraw({
    actorId,
    operationId: task.operation.id,
    expectedRevision: 1,
  });
  t.is(
    (await models.copilotMcpDelegation.getRequest(task.requestId))!.status,
    'cancelled'
  );
});

test('document creation registers pages in bootstrap roots and preserves registration on replay', async t => {
  const { writer, reader, db, actorId, workspaceId } = t.context;
  const staleRoot = await reader.getDoc(workspaceId, workspaceId);
  t.truthy(staleRoot);
  const interruptedDocumentId = randomUUID();
  await writer.pushDocUpdate(
    workspaceId,
    interruptedDocumentId,
    createDocWithMarkdown(
      'Interrupted registration',
      'The body was persisted before root registration.',
      interruptedDocumentId
    ),
    actorId
  );

  const recovered = await writer.createDoc(
    workspaceId,
    'Interrupted registration',
    'The body was persisted before root registration.',
    actorId,
    interruptedDocumentId
  );
  t.true(recovered.idempotentReplay);

  t.is(
    await db.update.count({
      where: { workspaceId, id: workspaceId },
    }),
    0
  );
  const recoveredRoot = await db.snapshot.findUniqueOrThrow({
    where: { workspaceId_id: { workspaceId, id: workspaceId } },
    select: { blob: true },
  });
  t.true(
    readAllDocIdsFromRootDoc(Buffer.from(recoveredRoot.blob), false).includes(
      interruptedDocumentId
    )
  );
  t.true(
    readRootDocPageIdsWithYjs(recoveredRoot.blob).includes(
      interruptedDocumentId
    )
  );
  const liveClient = new Y.Doc();
  try {
    Y.applyUpdate(liveClient, staleRoot!.bin);
    Y.applyUpdate(liveClient, recoveredRoot.blob);
    t.true(
      readRootDocPageIdsWithYjs(Y.encodeStateAsUpdate(liveClient)).includes(
        interruptedDocumentId
      )
    );
  } finally {
    liveClient.destroy();
  }

  const documentId = randomUUID();

  await writer.createDoc(
    workspaceId,
    'Bootstrap root registration',
    'Created by LocalMind AI',
    actorId,
    documentId
  );

  t.is(
    await db.update.count({
      where: { workspaceId, id: workspaceId },
    }),
    0
  );
  const createdRoot = await db.snapshot.findUniqueOrThrow({
    where: { workspaceId_id: { workspaceId, id: workspaceId } },
    select: { blob: true },
  });
  const registeredIds = readAllDocIdsFromRootDoc(
    Buffer.from(createdRoot.blob),
    false
  );
  t.true(registeredIds.includes(documentId));
  t.true(registeredIds.includes(interruptedDocumentId));
  const yjsRegisteredIds = readRootDocPageIdsWithYjs(createdRoot.blob);
  t.true(yjsRegisteredIds.includes(documentId));
  t.true(yjsRegisteredIds.includes(interruptedDocumentId));

  const replay = await writer.createDoc(
    workspaceId,
    'Bootstrap root registration',
    'Created by LocalMind AI',
    actorId,
    documentId
  );
  t.true(replay.idempotentReplay);

  t.is(
    await db.update.count({
      where: { workspaceId, id: workspaceId },
    }),
    0
  );
  const replayedRoot = await db.snapshot.findUniqueOrThrow({
    where: { workspaceId_id: { workspaceId, id: workspaceId } },
    select: { blob: true },
  });
  t.true(
    readAllDocIdsFromRootDoc(Buffer.from(replayedRoot.blob), false).includes(
      documentId
    )
  );
  t.true(readRootDocPageIdsWithYjs(replayedRoot.blob).includes(documentId));
});

test('snapshot copies preserve structured data and remain independent through edits and replay', async t => {
  const { writer, reader, actorId, hostId, workspaceId, db } = t.context;
  const source = await writer.createDoc(
    hostId,
    'Structured source',
    'Original body',
    actorId
  );
  const original = await reader.getDoc(hostId, source.docId);
  t.truthy(original);
  const sourceState = new Y.Doc();
  const copyState = new Y.Doc();
  try {
    Y.applyUpdate(sourceState, original!.bin);
    const database = new Y.Map();
    database.set('sys:id', 'structured-database');
    database.set('sys:flavour', 'affine:database');
    database.set('prop:columns', [
      {
        id: 'status',
        type: 'select',
        name: 'Status',
        data: { options: [{ id: 'done', value: 'Done' }] },
      },
    ]);
    const rows = new Y.Array();
    rows.push(['row-one', 'row-two']);
    database.set('sys:children', rows);
    sourceState.getMap('blocks').set('structured-database', database);
    await writer.pushDocUpdate(
      hostId,
      source.docId,
      Y.encodeStateAsUpdate(sourceState),
      actorId
    );
    const frozen = Y.encodeStateAsUpdate(sourceState);
    const newId = randomUUID();
    const copied = await writer.createDocFromSnapshot(
      workspaceId,
      'Structured source',
      frozen,
      actorId,
      newId
    );
    t.not(copied.docId, source.docId);
    const copy = await reader.getDoc(workspaceId, newId);
    Y.applyUpdate(copyState, copy!.bin);
    t.deepEqual(
      copyState.getMap('blocks').toJSON(),
      sourceState.getMap('blocks').toJSON()
    );
    t.is(
      await db.aiContextProjectGrant.count({
        where: { workspaceId, docId: newId },
      }),
      0
    );
    database.set('prop:title', 'Changed original');
    await writer.pushDocUpdate(
      hostId,
      source.docId,
      Y.encodeStateAsUpdate(sourceState),
      actorId
    );
    const copyDatabase = copyState
      .getMap<Y.Map<unknown>>('blocks')
      .get('structured-database')!;
    copyDatabase.set('prop:title', 'Changed copy');
    await writer.pushDocUpdate(
      workspaceId,
      newId,
      Y.encodeStateAsUpdate(copyState),
      actorId
    );
    const replay = await writer.createDocFromSnapshot(
      workspaceId,
      'Structured source',
      frozen,
      actorId,
      newId
    );
    t.true(replay.idempotentReplay);
    const savedSource = new Y.Doc();
    const savedCopy = new Y.Doc();
    try {
      Y.applyUpdate(
        savedSource,
        (await reader.getDoc(hostId, source.docId))!.bin
      );
      Y.applyUpdate(savedCopy, (await reader.getDoc(workspaceId, newId))!.bin);
      t.is(
        savedSource
          .getMap<Y.Map<unknown>>('blocks')
          .get('structured-database')!
          .get('prop:title'),
        'Changed original'
      );
      t.is(
        savedCopy
          .getMap<Y.Map<unknown>>('blocks')
          .get('structured-database')!
          .get('prop:title'),
        'Changed copy'
      );
    } finally {
      savedSource.destroy();
      savedCopy.destroy();
    }
  } finally {
    sourceState.destroy();
    copyState.destroy();
  }
});

test('invalid copy snapshots are rejected before destination registration', async t => {
  const { writer, reader, workspaceId, actorId } = t.context;
  const before = await reader.getDoc(workspaceId, workspaceId);
  await t.throwsAsync(
    writer.createDocFromSnapshot(
      workspaceId,
      'Invalid copy',
      new Uint8Array([1, 2, 3]),
      actorId,
      randomUUID()
    )
  );
  t.deepEqual(
    (await reader.getDoc(workspaceId, workspaceId))?.bin,
    before?.bin
  );
});

test('confirmed copies transfer frozen attachments into a separate workspace and do not inherit grants', async t => {
  const {
    writer,
    reader,
    models,
    db,
    module,
    service,
    actorId,
    sessionId,
    hostId,
    workspaceId,
  } = t.context;
  const blobs = module.get(WorkspaceBlobStorage);
  const copies = module.get(CopilotDocumentCopyService);
  const source = await writer.createDoc(
    hostId,
    'Attachment source',
    'Original body',
    actorId
  );
  await seedProjectSourceGrant(db, {
    projectId: t.context.projectId,
    workspaceId: hostId,
    docId: source.docId,
    requesterUserId: actorId,
    requestedLevel: 'read',
  });
  const state = new Y.Doc();
  try {
    Y.applyUpdate(state, (await reader.getDoc(hostId, source.docId))!.bin);
    const image = new Y.Map();
    image.set('sys:id', 'image');
    image.set('sys:flavour', 'affine:image');
    image.set('prop:sourceId', 'copy-test-image');
    state.getMap('blocks').set('image', image);
    await writer.pushDocUpdate(
      hostId,
      source.docId,
      Y.encodeStateAsUpdate(state),
      actorId
    );
  } finally {
    state.destroy();
  }
  await blobs.put(hostId, 'copy-test-image', Buffer.from('original image'), {
    contentType: 'image/png',
  });
  await blobs.put(
    workspaceId,
    'copy-test-image',
    Buffer.from('existing target image'),
    { contentType: 'image/png' }
  );
  await db.aiSessionMessage.create({
    data: {
      sessionId,
      role: 'user',
      content: 'Copy this document into another workspace.',
    },
  });
  const copyTool = createDocCopyRequestTool(copies, {
    user: actorId,
    session: sessionId,
    workspace: hostId,
  });
  const requested = await copyTool.execute?.(
    {
      source_workspace_id: hostId,
      source_document_id: source.docId,
      title: 'Attachment source',
      add_to_project: false,
    },
    {}
  );
  t.like(requested, { documentCreated: false, status: 'waiting_location' });
  const operation = await db.copilotDocumentOperation.findFirstOrThrow({
    where: { sessionId, kind: 'copy' },
  });
  t.like(
    await models.copilotDocumentOperation.receipt({
      actorId,
      operationId: operation.id,
    }),
    { kind: 'copy', sourceWorkspaceId: hostId, sourceDocumentId: source.docId }
  );
  t.is(operation.kind, 'copy');
  t.is(await reader.getDoc(workspaceId, operation.documentId), null);
  const input = { actorId, operationId: operation.id };
  await t.throwsAsync(service.execute({ ...input, expectedRevision: 0 }));
  const confirmed = await service.confirmDestination({
    ...input,
    workspaceId,
    folderId: null,
    expectedRevision: 0,
  });
  const result = await service.execute({
    ...input,
    expectedRevision: confirmed.destinationRevision,
  });
  t.is(result.status, 'complete');
  t.is(result.projectStatus, 'not_requested');
  t.not(result.documentId, source.docId);
  t.truthy(await reader.getDoc(hostId, source.docId));
  const targetKey = `ai-copy-${result.documentId}-${createHash('sha256').update('original image').digest('base64url')}`;
  const targetBlob = await blobs.get(workspaceId, targetKey);
  const data: Buffer[] = [];
  for await (const part of targetBlob.body!) data.push(Buffer.from(part));
  t.is(Buffer.concat(data).toString(), 'original image');
  await blobs.put(
    hostId,
    'copy-test-image',
    Buffer.from('changed source image'),
    { contentType: 'image/png' }
  );
  const unchangedBlob = await blobs.get(workspaceId, targetKey);
  const unchanged: Buffer[] = [];
  for await (const part of unchangedBlob.body!)
    unchanged.push(Buffer.from(part));
  t.is(Buffer.concat(unchanged).toString(), 'original image');
  t.is(
    await db.aiContextProjectGrant.count({
      where: { workspaceId, docId: result.documentId },
    }),
    0
  );
  t.truthy(await models.copilotDocumentOperation.copySource(input));
  const conflicting = await copies.prepare({
    actorId,
    sessionId,
    workspaceId: hostId,
    documentId: source.docId,
    title: 'Changed source copy',
    addToProject: false,
  });
  const conflictInput = { actorId, operationId: conflicting.id };
  const conflictConfirmed = await service.confirmDestination({
    ...conflictInput,
    workspaceId,
    folderId: null,
    expectedRevision: 0,
  });
  const secondCopy = await service.execute({
    ...conflictInput,
    expectedRevision: conflictConfirmed.destinationRevision,
  });
  t.is(secondCopy.status, 'complete');
  const secondKey = `ai-copy-${secondCopy.documentId}-${createHash('sha256').update('changed source image').digest('base64url')}`;
  const copiedState = new Y.Doc();
  try {
    Y.applyUpdate(
      copiedState,
      (await reader.getDoc(workspaceId, secondCopy.documentId))!.bin
    );
    const copiedBlocks = copiedState.getMap<Y.Map<unknown>>('blocks');
    t.is(copiedBlocks.get('image')!.get('prop:sourceId'), secondKey);
    const copiedPage = [...copiedBlocks.values()].find(
      block => block.get('sys:flavour') === 'affine:page'
    );
    const copiedTitle = copiedPage?.get('prop:title');
    t.is(
      copiedTitle instanceof Y.Text ? copiedTitle.toString() : copiedTitle,
      'Changed source copy'
    );
  } finally {
    copiedState.destroy();
  }
  const unrelated = await blobs.get(workspaceId, 'copy-test-image');
  const unrelatedParts: Buffer[] = [];
  for await (const part of unrelated.body!)
    unrelatedParts.push(Buffer.from(part));
  t.is(Buffer.concat(unrelatedParts).toString(), 'existing target image');
  const viewer = await models.user.create({
    email: 'copy-blob-workspace-only@example.com',
  });
  await db.workspaceMember.create({
    data: { workspaceId, userId: viewer.id, role: 'member' },
  });
  await models.docAccessPolicy.upsert(workspaceId, result.documentId, {
    defaultRole: DocRole.None,
  });
  const controller = module.get(WorkspacesController);
  await t.throwsAsync(
    controller.blob(
      { id: viewer.id } as never,
      workspaceId,
      targetKey,
      undefined,
      undefined,
      {} as never
    ),
    { message: /Permission denied|Doc.Read|Access denied/ }
  );
  await t.throwsAsync(
    controller.blob(
      { id: actorId } as never,
      workspaceId,
      targetKey,
      undefined,
      secondCopy.documentId,
      {} as never
    ),
    { message: /Blob/ }
  );
  const originalCopy = await reader.getDoc(workspaceId, result.documentId);
  if (!originalCopy) throw new Error('Missing copied document fixture');
  const wrapper = await writer.createDocFromSnapshot(
    workspaceId,
    'Owned wrapper',
    originalCopy.bin,
    viewer.id,
    randomUUID()
  );
  await models.docGrant.setOwner(workspaceId, wrapper.docId, viewer.id);
  const viewerSession = await models.copilotSession.createWithPrompt({
    sessionId: randomUUID(),
    userId: viewer.id,
    workspaceId,
    title: null,
    prompt: { name: 'attachment-boundary', model: 'gpt-5-mini', action: null },
  });
  await t.throwsAsync(
    copies.prepare({
      actorId: viewer.id,
      sessionId: viewerSession,
      workspaceId,
      documentId: wrapper.docId,
      title: 'Do not copy private referenced bytes',
      addToProject: false,
    }),
    { message: /Permission denied|Doc.Read|Access denied/ }
  );
  t.is(
    await db.copilotDocumentOperation.count({
      where: { sessionId: viewerSession },
    }),
    0
  );
});

test('copy attachment bytes remain unreadable until authorized publication and recover after denial', async t => {
  const { models, module, service, destination, workspaceId, actorId } =
    t.context;
  const input = await prepare(t.context);
  const confirmed = await service.confirmDestination({
    ...input,
    workspaceId,
    folderId: null,
    expectedRevision: 0,
  });
  const operation = await models.copilotDocumentOperation.acquire({
    ...input,
    expectedRevision: confirmed.destinationRevision,
  });
  if (!operation.leaseToken) throw new Error('Missing test lease');
  const lease = { ...input, leaseToken: operation.leaseToken };
  const blobs = module.get(WorkspaceBlobStorage);
  const runtime = module.get(StorageRuntimeProvider);
  const key = `ai-copy-${operation.documentId}-${createHash('sha256').update('isolated copy bytes').digest('base64url')}`;
  const uploaded = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const put = runtime.putObject.bind(runtime);
  const writing = Sinon.stub(runtime, 'putObject').callsFake(
    async (...args) => {
      const result = await put(...args);
      uploaded.resolve();
      await release.promise;
      return result;
    }
  );
  const authorize = async () => {
    await models.copilotDocumentOperation.lockWriteAuthorization(lease);
    await destination.authorize({ actorId, workspaceId, folderId: null });
    await models.copilotDocumentOperation.renew(lease);
  };
  const pending = blobs.putCopyAttachment(
    workspaceId,
    key,
    Buffer.from('isolated copy bytes'),
    { uploadId: operation.id, contentType: 'image/png' },
    authorize
  );
  const denied = t.throwsAsync(pending, {
    message: /directory does not allow/,
  });
  await uploaded.promise;
  try {
    t.is((await models.blob.get(workspaceId, key))?.status, 'pending');
    t.deepEqual(await blobs.get(workspaceId, key), {});
    t.deepEqual(await blobs.get(workspaceId, key, true), {});
    await models.workspaceDirectoryGrant.set({
      workspaceId,
      actorId,
      directoryId: '$root',
      principalId: '*',
      rights: {
        canRead: true,
        canWrite: false,
        canOrganize: true,
        canCreateFolder: true,
      },
    });
  } finally {
    release.resolve();
  }
  await denied;
  t.is((await models.blob.get(workspaceId, key))?.status, 'pending');
  t.deepEqual(await blobs.get(workspaceId, key), {});
  const calls = writing.callCount;
  await t.throwsAsync(blobs.put(workspaceId, key, Buffer.from('overwrite')));
  await t.throwsAsync(
    blobs.complete(workspaceId, key, { size: 19, mime: 'image/png' })
  );
  const uploads = module.get(WorkspaceBlobResolver);
  await t.throwsAsync(
    uploads.createBlobUpload(
      { id: actorId } as never,
      workspaceId,
      key,
      19,
      'image/png'
    ),
    { message: /only be published/ }
  );
  await t.throwsAsync(
    uploads.completeBlobUpload({ id: actorId } as never, workspaceId, key),
    { message: /only be published/ }
  );
  t.is(writing.callCount, calls);
  await models.workspaceDirectoryGrant.set({
    workspaceId,
    actorId,
    directoryId: '$root',
    principalId: '*',
    rights: {
      canRead: true,
      canWrite: true,
      canOrganize: true,
      canCreateFolder: true,
    },
  });
  await blobs.putCopyAttachment(
    workspaceId,
    key,
    Buffer.from('isolated copy bytes'),
    { uploadId: operation.id, contentType: 'image/png' },
    authorize
  );
  const result = await blobs.get(workspaceId, key);
  const chunks: Buffer[] = [];
  for await (const chunk of result.body!) chunks.push(Buffer.from(chunk));
  t.is(Buffer.concat(chunks).toString(), 'isolated copy bytes');
  t.is((await models.blob.get(workspaceId, key))?.status, 'completed');
});

test('a stale attachment uploader cannot publish after execution lease handoff', async t => {
  const { models, module, service, db, workspaceId } = t.context;
  const input = await prepare(t.context);
  const confirmed = await service.confirmDestination({
    ...input,
    workspaceId,
    folderId: null,
    expectedRevision: 0,
  });
  const first = await models.copilotDocumentOperation.acquire({
    ...input,
    expectedRevision: confirmed.destinationRevision,
  });
  if (!first.leaseToken) throw new Error('Missing test lease');
  const lease = { ...input, leaseToken: first.leaseToken };
  const blobs = module.get(WorkspaceBlobStorage);
  const runtime = module.get(StorageRuntimeProvider);
  const bytes = Buffer.from('lease-isolated copy bytes');
  const key = `ai-copy-${first.documentId}-${createHash('sha256').update(bytes).digest('base64url')}`;
  const put = runtime.putObject.bind(runtime);
  let nextToken: string | null = null;
  const upload = Sinon.stub(runtime, 'putObject').callsFake(async (...args) => {
    const result = await put(...args);
    await db.copilotDocumentOperation.update({
      where: { id: first.id },
      data: { leaseExpiresAt: new Date(0) },
    });
    const successor = await models.copilotDocumentOperation.acquire({
      ...input,
      expectedRevision: confirmed.destinationRevision,
    });
    nextToken = successor.leaseToken;
    return result;
  });
  await t.throwsAsync(
    blobs.putCopyAttachment(
      workspaceId,
      key,
      bytes,
      { uploadId: first.id, contentType: 'image/png' },
      async () => {
        await models.copilotDocumentOperation.lockWriteAuthorization(lease);
        await models.copilotDocumentOperation.renew(lease);
      }
    ),
    { message: /lease expired/ }
  );
  t.deepEqual(await blobs.get(workspaceId, key, true), {});
  t.is((await models.blob.get(workspaceId, key))?.status, 'pending');
  t.is(
    (await models.copilotDocumentOperation.get(input)).leaseToken,
    nextToken
  );
  upload.restore();
  if (!nextToken) throw new Error('Missing successor lease');
  const successorLease = { ...input, leaseToken: nextToken };
  await blobs.putCopyAttachment(
    workspaceId,
    key,
    bytes,
    { uploadId: first.id, contentType: 'image/png' },
    async () => {
      await models.copilotDocumentOperation.lockWriteAuthorization(
        successorLease
      );
      await models.copilotDocumentOperation.renew(successorLease);
    }
  );
  t.is((await models.blob.get(workspaceId, key))?.status, 'completed');
});

test('source sharing revocation after confirmation rejects copy execution and retry', async t => {
  const {
    writer,
    reader,
    db,
    module,
    service,
    actorId,
    sessionId,
    hostId,
    workspaceId,
  } = t.context;
  const source = await writer.createDoc(
    hostId,
    'Revocable source',
    'Original body',
    actorId
  );
  await seedProjectSourceGrant(db, {
    projectId: t.context.projectId,
    workspaceId: hostId,
    docId: source.docId,
    requesterUserId: actorId,
    requestedLevel: 'read',
  });
  await db.aiSessionMessage.create({
    data: { sessionId, role: 'user', content: 'Copy this document.' },
  });
  const copies = module.get(CopilotDocumentCopyService);
  const operation = await copies.prepare({
    actorId,
    sessionId,
    workspaceId: hostId,
    documentId: source.docId,
    title: 'Revocable source',
    addToProject: false,
  });
  const input = { actorId, operationId: operation.id };
  const confirmed = await service.confirmDestination({
    ...input,
    workspaceId,
    folderId: null,
    expectedRevision: 0,
  });
  await db.workspaceAccessPolicy.update({
    where: { workspaceId: hostId },
    data: { sharingEnabled: false },
  });
  for (let retry = 0; retry < 2; retry++) {
    await t.throwsAsync(
      service.execute({
        ...input,
        expectedRevision: confirmed.destinationRevision,
      })
    );
    t.is(await reader.getDoc(workspaceId, operation.documentId), null);
  }
  await t.throwsAsync(
    copies.prepare({
      actorId,
      sessionId,
      workspaceId: hostId,
      documentId: source.docId,
      title: 'Denied new copy',
      addToProject: false,
    })
  );
});

test('creation tool waits for authenticated location mutation and rejects ambiguous or foreign confirmations', async t => {
  const {
    actorId,
    sessionId,
    hostId,
    workspaceId,
    models,
    db,
    module,
    writer,
  } = t.context;
  await db.aiSessionMessage.create({
    data: { sessionId, role: 'user', content: 'Create a document for me.' },
  });
  const create = Sinon.spy(writer, 'createDoc');
  const tool = createDocCreateRequestTool(
    module.get(PermissionAccess),
    models,
    { user: actorId, workspace: hostId, session: sessionId }
  );
  const result = await tool.execute?.(
    { title: 'Pending creation', content: 'Body', add_to_project: false },
    {}
  );
  t.like(result, { status: 'waiting_location', documentCreated: false });
  t.is(create.callCount, 0);
  const operation = await db.copilotDocumentOperation.findFirstOrThrow({
    where: { sessionId },
  });
  const resolver = module.get(CopilotDocumentOperationResolver);
  const actor = { id: actorId } as Parameters<
    typeof resolver.confirmCopilotDocumentDestination
  >[0];
  const confirmation = {
    operationId: operation.id,
    workspaceId,
    folderId: null,
    root: true,
    expectedRevision: 0,
  };
  await t.throwsAsync(
    resolver.confirmCopilotDocumentDestination(actor, {
      ...confirmation,
      root: false,
    })
  );
  await t.throwsAsync(
    resolver.confirmCopilotDocumentDestination(actor, {
      ...confirmation,
      folderId: 'ambiguous',
    })
  );
  await t.throwsAsync(
    resolver.confirmCopilotDocumentDestination(
      { ...actor, id: 'outsider' },
      confirmation
    )
  );
  t.is(create.callCount, 0);
  const completed = await resolver.confirmCopilotDocumentDestination(
    actor,
    confirmation
  );
  t.is(completed.status, 'complete');
  t.is(create.callCount, 1);
  const status = createDocCreationStatusTool(models, {
    user: actorId,
    workspace: hostId,
    session: sessionId,
  });
  t.like(await status.execute?.({ operation_id: operation.id }, {}), {
    documentCreated: true,
    placementComplete: true,
    documentId: operation.documentId,
    workspaceId,
  });
});

test('creation status rejects another conversation and actor without exposing a receipt', async t => {
  const { models, actorId, sessionId, hostId } = t.context;
  const { operation } = await prepare(t.context);
  for (const options of [
    { user: actorId, session: randomUUID(), workspace: hostId },
    { user: 'outsider', session: sessionId, workspace: hostId },
  ]) {
    const tool = createDocCreationStatusTool(models, options);
    const result = await tool.execute?.({ operation_id: operation.id }, {});
    t.like(result, { type: 'error', name: 'Document Creation Status Failed' });
    t.false(JSON.stringify(result).includes(operation.documentId));
    t.false(JSON.stringify(result).includes(operation.title));
  }
  const tool = createDocCreationStatusTool(models, {
    user: actorId,
    session: sessionId,
    workspace: hostId,
  });
  t.like(await tool.execute?.({ operation_id: operation.id }, {}), {
    documentCreated: false,
    placementComplete: false,
    documentId: null,
  });
});

test('document-side creation waits for location and stays outside project authorization', async t => {
  const { models, db, writer, module, actorId, hostId, workspaceId } =
    t.context;
  const source = await writer.createDoc(
    hostId,
    'Source',
    'Source body',
    actorId
  );
  const sessionId = await models.copilotSession.createWithPrompt({
    sessionId: randomUUID(),
    userId: actorId,
    workspaceId: hostId,
    docId: source.docId,
    title: null,
    prompt: {
      name: 'document-side-creation',
      model: 'gpt-5-mini',
      action: null,
    },
  });
  await db.aiSessionMessage.create({
    data: { sessionId, role: 'user', content: 'Create a separate document.' },
  });
  const create = Sinon.spy(writer, 'createDoc');
  const tool = createDocCreateRequestTool(
    module.get(PermissionAccess),
    models,
    {
      user: actorId,
      workspace: hostId,
      session: sessionId,
    }
  );
  const result = await tool.execute?.(
    { title: 'New document', content: 'New body', add_to_project: false },
    {}
  );
  t.like(result, { status: 'waiting_location', documentCreated: false });
  t.is(create.callCount, 0);
  const operation = await db.copilotDocumentOperation.findFirstOrThrow({
    where: { sessionId },
  });
  t.is(operation.projectId, null);
  const resolver = module.get(CopilotDocumentOperationResolver);
  const receipt = await resolver.confirmCopilotDocumentDestination(
    { id: actorId } as Parameters<
      typeof resolver.confirmCopilotDocumentDestination
    >[0],
    {
      operationId: operation.id,
      workspaceId,
      folderId: null,
      root: true,
      expectedRevision: 0,
    }
  );
  t.is(receipt.status, 'complete');
  t.is(receipt.projectStatus, 'not_requested');
  t.is(create.callCount, 1);
  t.is(
    await db.aiContextProjectGrant.count({
      where: { workspaceId, docId: operation.documentId },
    }),
    0
  );
  t.like(
    await tool.execute?.(
      {
        title: 'Invalid project addition',
        content: 'Body',
        add_to_project: true,
      },
      {}
    ),
    { type: 'error' }
  );
  t.is(create.callCount, 1);
});

async function prepare(context: {
  models: Models;
  actorId: string;
  sessionId: string;
}) {
  const operation = await context.models.copilotDocumentOperation.prepare({
    actorId: context.actorId,
    sessionId: context.sessionId,
    requestKey: randomUUID(),
    title: 'Isolated creation',
    markdown: 'A verified document.',
    addToProject: false,
  });
  return { actorId: context.actorId, operationId: operation.id, operation };
}

test('lease handoff after root registration stops the old writer and preserves the successor lease', async t => {
  const { models, db, module, service, reader, workspaceId } = t.context;
  const input = await prepare(t.context);
  const confirmed = await service.confirmDestination({
    ...input,
    workspaceId,
    folderId: null,
    expectedRevision: 0,
  });
  const storage = module.get(PgWorkspaceDocStorageAdapter);
  const persistRoot = storage.persistRootDocUpdate.bind(storage);
  let handedOff = false;
  let successorToken: string | null = null;
  Sinon.stub(storage, 'persistRootDocUpdate').callsFake(async (...args) => {
    const result = await persistRoot(...args);
    if (!handedOff && args[0] === workspaceId) {
      handedOff = true;
      await db.copilotDocumentOperation.update({
        where: { id: input.operationId },
        data: { leaseExpiresAt: new Date(Date.now() - 1000) },
      });
      const successor = await models.copilotDocumentOperation.acquire({
        ...input,
        expectedRevision: confirmed.destinationRevision,
      });
      successorToken = successor.leaseToken;
    }
    return result;
  });
  await t.throwsAsync(
    service.execute({
      ...input,
      expectedRevision: confirmed.destinationRevision,
    }),
    { message: 'Document execution lease expired' }
  );
  t.true(handedOff);
  const state = await models.copilotDocumentOperation.get(input);
  t.is(state.leaseToken, successorToken);
  t.is(state.createdDocumentAt, null);
  t.is(await reader.getDoc(workspaceId, state.documentId), null);
  await db.copilotDocumentOperation.update({
    where: { id: input.operationId },
    data: { leaseExpiresAt: new Date(Date.now() - 1000) },
  });
  const recovered = await service.execute({
    ...input,
    expectedRevision: confirmed.destinationRevision,
  });
  t.is(recovered.status, 'complete');
  t.is(recovered.documentId, state.documentId);
  t.truthy(await reader.getDoc(workspaceId, state.documentId));
});

test('slow document writes renew their lease and stop heartbeat after completion', async t => {
  const { models, service, writer, workspaceId } = t.context;
  const input = await prepare(t.context);
  const confirmed = await service.confirmDestination({
    ...input,
    workspaceId,
    folderId: null,
    expectedRevision: 0,
  });
  const started = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const create = writer.createDoc.bind(writer);
  Sinon.stub(writer, 'createDoc').callsFake(async (...args) => {
    started.resolve();
    await resume.promise;
    return await create(...args);
  });
  const renew = Sinon.spy(models.copilotDocumentOperation, 'renew');
  const clock = Sinon.useFakeTimers({
    toFake: ['setInterval', 'clearInterval'],
  });
  const execution = service.execute({
    ...input,
    expectedRevision: confirmed.destinationRevision,
  });
  try {
    await started.promise;
    const count = renew.callCount;
    await clock.tickAsync(20_000);
    t.true(renew.callCount > count);
    await renew.lastCall.returnValue;
    resume.resolve();
    t.is((await execution).status, 'complete');
    const completedCount = renew.callCount;
    await clock.tickAsync(40_000);
    t.is(renew.callCount, completedCount);
  } finally {
    resume.resolve();
    await execution.catch(() => {});
    clock.restore();
  }
});

test('storage rechecks an expired execution lease after waiting for the content lock', async t => {
  const { models, service, module, workspaceId, actorId } = t.context;
  const input = await prepare(t.context);
  const confirmed = await service.confirmDestination({
    ...input,
    workspaceId,
    folderId: null,
    expectedRevision: 0,
  });
  const operation = await models.copilotDocumentOperation.acquire({
    ...input,
    expectedRevision: confirmed.destinationRevision,
  });
  if (!operation.leaseToken) throw new Error('Missing test lease');
  const lease = { ...input, leaseToken: operation.leaseToken };
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const checked = Promise.withResolvers<void>();
  const holder = models.workspaceDirectoryGrant.withMutationLock(
    'isolated-content-lock-fixture',
    async () => {
      await models.doc.lockContentWrite(workspaceId, operation.documentId);
      entered.resolve();
      await release.promise;
    }
  );
  await entered.promise;
  const doc = new Y.Doc({ guid: operation.documentId });
  doc.getMap('test').set('content', 'must not persist');
  const storage = module.get(PgWorkspaceDocStorageAdapter);
  const writing = storage.pushDocUpdates(
    workspaceId,
    operation.documentId,
    [Y.encodeStateAsUpdate(doc)],
    actorId,
    async () => {
      await models.copilotDocumentOperation.lockWriteAuthorization(lease);
      await models.copilotDocumentOperation.renew(lease);
      checked.resolve();
    }
  );
  const denied = t.throwsAsync(writing, { message: /lease expired/ });
  await checked.promise;
  const clock = Sinon.useFakeTimers({
    now: Date.now() + 61_000,
    toFake: ['Date'],
  });
  try {
    release.resolve();
    await holder;
    await denied;
    t.is(
      (await models.doc.findUpdates(workspaceId, operation.documentId)).length,
      0
    );
  } finally {
    release.resolve();
    await holder;
    await writing.catch(() => {});
    clock.restore();
    doc.destroy();
  }
});

test('storage holds directory authorization through the actual update insertion', async t => {
  const { models, service, module, destination, db, actorId, workspaceId } =
    t.context;
  const input = await prepare(t.context);
  const confirmed = await service.confirmDestination({
    ...input,
    workspaceId,
    folderId: null,
    expectedRevision: 0,
  });
  const operation = await models.copilotDocumentOperation.acquire({
    ...input,
    expectedRevision: confirmed.destinationRevision,
  });
  if (!operation.leaseToken) throw new Error('Missing test lease');
  const lease = { ...input, leaseToken: operation.leaseToken };
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const doc = new Y.Doc({ guid: operation.documentId });
  doc.getMap('test').set('content', 'authorized update');
  let checks = 0;
  const storage = module.get(PgWorkspaceDocStorageAdapter);
  const writing = storage.pushDocUpdates(
    workspaceId,
    operation.documentId,
    [Y.encodeStateAsUpdate(doc)],
    actorId,
    async () => {
      await models.copilotDocumentOperation.lockWriteAuthorization(lease);
      await destination.authorize({ actorId, workspaceId, folderId: null });
      await models.copilotDocumentOperation.renew(lease);
      if (++checks === 2) {
        entered.resolve();
        await release.promise;
      }
    }
  );
  await entered.promise;
  const policy = models.workspaceDirectoryGrant.set({
    workspaceId,
    actorId,
    directoryId: '$root',
    principalId: '*',
    rights: {
      canRead: true,
      canWrite: false,
      canOrganize: true,
      canCreateFolder: true,
    },
  });
  let waiting = false;
  const directoryKey = `directory-authorization:${workspaceId}`;
  const workspaceKey = permissionWorkspaceLockKey(workspaceId);
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      const rows = await db.$queryRaw<Array<{ waiting: boolean }>>`
        SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype = 'advisory'
          AND NOT granted AND objsubid = 1
          AND ((classid::bigint = ((hashtextextended(${directoryKey}, 0) >> 32) & 4294967295)
            AND objid::bigint = (hashtextextended(${directoryKey}, 0) & 4294967295))
          OR (classid::bigint = ((hashtextextended(${workspaceKey}, 0) >> 32) & 4294967295)
            AND objid::bigint = (hashtextextended(${workspaceKey}, 0) & 4294967295)))) AS waiting`;
      if (rows[0]?.waiting) {
        waiting = true;
        break;
      }
      await delay(10);
    }
    t.true(waiting, 'revocation must wait for the real storage transaction');
  } finally {
    release.resolve();
    await Promise.all([writing, policy]);
    doc.destroy();
  }
  t.is(
    (await models.doc.findUpdates(workspaceId, operation.documentId)).length,
    1
  );
  await t.throwsAsync(
    storage.pushDocUpdates(
      workspaceId,
      operation.documentId,
      [Y.encodeStateAsUpdate(doc)],
      actorId,
      async () => {
        await models.copilotDocumentOperation.lockWriteAuthorization(lease);
        await destination.authorize({ actorId, workspaceId, folderId: null });
      }
    ),
    { message: /directory does not allow/ }
  );
  t.is(
    (await models.doc.findUpdates(workspaceId, operation.documentId)).length,
    1
  );
});

test('generic folder mutations enforce source destination descendant and creation rights', async t => {
  const { models, organization, writer, actorId, workspaceId } = t.context;
  const apply = (
    operations: Parameters<
      WorkspaceOrganizationService['applyDataOperations']
    >[4]
  ) =>
    organization.applyDataOperations(
      workspaceId,
      actorId,
      actorId,
      'folders',
      operations
    );
  await apply([
    {
      op: 'upsert',
      key: 'parent',
      values: { type: 'folder', data: 'Parent', parentId: null, index: 'a0' },
    },
    {
      op: 'upsert',
      key: 'child',
      values: {
        type: 'folder',
        data: 'Child',
        parentId: 'parent',
        index: 'a0',
      },
    },
    {
      op: 'upsert',
      key: 'target',
      values: { type: 'folder', data: 'Target', parentId: null, index: 'a1' },
    },
  ]);
  const initial = await organization.readFolders(workspaceId, actorId);
  const policy = (
    directoryId: string,
    denied: 'canWrite' | 'canCreateFolder',
    value: boolean
  ) =>
    models.workspaceDirectoryGrant.set({
      workspaceId,
      actorId,
      directoryId,
      principalId: '*',
      rights: {
        canRead: true,
        canWrite: true,
        canOrganize: true,
        canCreateFolder: true,
        [denied]: value,
      },
    });
  await policy('child', 'canWrite', false);
  const writes = Sinon.spy(writer, 'pushDocUpdate');
  const lifecycle = {
    workspaceId,
    userId: actorId,
    editorId: actorId,
    folderId: 'parent',
    expectedName: 'Parent',
    authorizeDocument: async () => {
      t.fail('Denied directory must not process document effects');
    },
  };
  await t.throwsAsync(
    organization.trashFolderTree({ ...lifecycle, recursive: true }),
    {
      message: /directory does not allow/,
    }
  );
  t.is(writes.callCount, 0);
  await t.throwsAsync(
    apply([{ op: 'upsert', key: 'parent', values: { parentId: 'target' } }]),
    {
      message: /directory does not allow/,
    }
  );
  await t.throwsAsync(
    apply([{ op: 'upsert', key: 'child', values: { parentId: 'target' } }]),
    {
      message: /directory does not allow/,
    }
  );
  await policy('child', 'canWrite', true);
  await policy('target', 'canWrite', false);
  await t.throwsAsync(
    apply([{ op: 'upsert', key: 'child', values: { parentId: 'target' } }]),
    {
      message: /directory does not allow/,
    }
  );
  await policy('target', 'canWrite', true);
  await policy('parent', 'canCreateFolder', false);
  await t.throwsAsync(
    apply([
      {
        op: 'upsert',
        key: 'new',
        values: {
          type: 'folder',
          data: 'New',
          parentId: 'parent',
          index: 'a1',
        },
      },
    ]),
    {
      message: /directory does not allow/,
    }
  );
  t.deepEqual(await organization.readFolders(workspaceId, actorId), initial);
  await apply([{ op: 'upsert', key: 'child', values: { parentId: 'target' } }]);
  t.like(
    (await organization.readFolders(workspaceId, actorId)).find(
      row => row.id === 'child'
    ),
    { parentId: 'target' }
  );
  await organization.trashFolderTree({ ...lifecycle, recursive: true });
  await policy('parent', 'canWrite', false);
  writes.resetHistory();
  await t.throwsAsync(organization.restoreFolderTree(lifecycle), {
    message: /directory does not allow/,
  });
  await t.throwsAsync(organization.deleteFolderTreePermanently(lifecycle), {
    message: /directory does not allow/,
  });
  t.is(writes.callCount, 0);
});

test('directory listing excludes unreadable ancestors and restores visibility after permission changes', async t => {
  const { models, organization, actorId, workspaceId } = t.context;
  await organization.applyDataOperations(
    workspaceId,
    actorId,
    actorId,
    'folders',
    [
      {
        op: 'upsert',
        key: 'private',
        values: {
          type: 'folder',
          data: 'Private',
          parentId: null,
          index: 'a0',
        },
      },
      {
        op: 'upsert',
        key: 'child',
        values: {
          type: 'folder',
          data: 'Hidden child',
          parentId: 'private',
          index: 'a0',
        },
      },
      {
        op: 'upsert',
        key: 'public',
        values: { type: 'folder', data: 'Public', parentId: null, index: 'a1' },
      },
    ]
  );
  const setRead = (directoryId: string, canRead: boolean, principalId = '*') =>
    models.workspaceDirectoryGrant.set({
      workspaceId,
      actorId,
      directoryId,
      principalId,
      rights: {
        canRead,
        canWrite: true,
        canOrganize: true,
        canCreateFolder: true,
      },
    });
  await setRead('private', false);
  await setRead('child', true, actorId);
  t.deepEqual(
    (await organization.readFolders(workspaceId, actorId)).map(row => row.id),
    ['public']
  );
  t.deepEqual(
    (await organization.readOrganization(workspaceId, actorId)).folders.map(
      row => row.id
    ),
    ['public']
  );
  await setRead('private', true);
  t.is((await organization.readFolders(workspaceId, actorId)).length, 3);
  await setRead('$root', false);
  t.deepEqual(await organization.readFolders(workspaceId, actorId), []);
});

test('directory policy updates wait for the active mutation transaction', async t => {
  const { models, db, actorId, workspaceId } = t.context;
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const mutation = models.workspaceDirectoryGrant.withMutationLock(
    workspaceId,
    async () => {
      entered.resolve();
      await release.promise;
    }
  );
  await entered.promise;
  const policy = models.workspaceDirectoryGrant.set({
    workspaceId,
    actorId,
    directoryId: '$root',
    principalId: '*',
    rights: {
      canRead: true,
      canWrite: false,
      canOrganize: true,
      canCreateFolder: true,
    },
  });
  const key = `directory-authorization:${workspaceId}`;
  let waiting = false;
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      const rows = await db.$queryRaw<Array<{ waiting: boolean }>>`
        SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype = 'advisory'
          AND NOT granted AND objsubid = 1
          AND classid::bigint = ((hashtextextended(${key}, 0) >> 32) & 4294967295)
          AND objid::bigint = (hashtextextended(${key}, 0) & 4294967295)) AS waiting`;
      if (rows[0]?.waiting) {
        waiting = true;
        break;
      }
      await delay(10);
    }
    t.true(
      waiting,
      'PostgreSQL must show the policy setter waiting on the mutation lock'
    );
  } finally {
    release.resolve();
    await Promise.all([mutation, policy]);
  }
  t.false(
    (
      await models.workspaceDirectoryGrant.rights({
        workspaceId,
        actorId,
        directoryIds: [],
      })
    ).canWrite
  );
});

test('filtered directory API paginates readable entries with rights and rejects non-members', async t => {
  const { models, module, organization, actorId, workspaceId } = t.context;
  const nodes = Array.from({ length: 101 }, (_, index) => ({
    op: 'upsert' as const,
    key: `folder-${String(index).padStart(3, '0')}`,
    values: {
      type: 'folder',
      data: `Folder ${index}`,
      parentId: null,
      index: 'a0',
    },
  }));
  for (const batch of [nodes.slice(0, 100), nodes.slice(100)])
    await organization.applyDataOperations(
      workspaceId,
      actorId,
      actorId,
      'folders',
      batch
    );
  await models.workspaceDirectoryGrant.set({
    workspaceId,
    actorId,
    directoryId: 'folder-050',
    principalId: '*',
    rights: {
      canRead: false,
      canWrite: false,
      canOrganize: false,
      canCreateFolder: false,
    },
  });
  const resolver = module.get(WorkspaceDirectoryResolver);
  const page = await resolver.workspaceDirectory(
    { id: actorId } as never,
    workspaceId
  );
  t.is(page.items.length, 100);
  t.false(page.fullSyncAllowed);
  t.false(page.items.some(item => item.id === 'folder-050'));
  t.like(page.items[0].rights, {
    canRead: true,
    canWrite: true,
    canCreateFolder: true,
  });
  t.is(page.nextCursor, 'folder-100');
  t.deepEqual(
    (
      await resolver.workspaceDirectory(
        { id: actorId } as never,
        workspaceId,
        page.nextCursor!
      )
    ).items,
    []
  );
  const outsider = await models.user.create({
    email: 'directory-outsider@example.com',
  });
  await t.throwsAsync(
    resolver.workspaceDirectory({ id: outsider.id } as never, workspaceId)
  );
});

test('directory policy administration is human-only, conditional, audited, and refreshable', async t => {
  const { db, models, module, organization, actorId, workspaceId } = t.context;
  await organization.applyDataOperations(
    workspaceId,
    actorId,
    actorId,
    'folders',
    [
      {
        op: 'upsert',
        key: 'policy-folder',
        values: {
          type: 'folder',
          data: 'Policy folder',
          parentId: null,
          index: 'a0',
        },
      },
    ]
  );
  const member = await models.user.create({
    email: 'directory-policy-member@example.com',
  });
  await db.workspaceMember.create({
    data: {
      workspaceId,
      userId: member.id,
      role: 'member',
      state: 'active',
      source: 'legacy',
    },
  });
  const resolver = module.get(WorkspaceDirectoryResolver);
  const actor = { id: actorId } as never;
  const before = await resolver.workspaceDirectoryAdministration(
    actor,
    workspaceId
  );
  t.true(
    before.directories.some(directory => directory.id === 'policy-folder')
  );
  t.true(before.principals.some(principal => principal.id === member.id));
  const changed = await resolver.changeWorkspaceDirectoryPolicy(
    actor,
    workspaceId,
    before.revision,
    'policy-folder',
    member.id,
    {
      canRead: true,
      canWrite: false,
      canOrganize: false,
      canCreateFolder: false,
    }
  );
  t.not(changed.revision, before.revision);
  t.is(changed.policy?.principalId, member.id);
  await t.throwsAsync(
    resolver.changeWorkspaceDirectoryPolicy(
      actor,
      workspaceId,
      before.revision,
      'policy-folder',
      member.id,
      null
    ),
    { message: /refresh before editing/ }
  );
  const after = await resolver.workspaceDirectoryAdministration(
    actor,
    workspaceId
  );
  t.is(after.policies.length, 1);
  t.is(after.auditEvents[0]?.action, 'set');
  await t.throwsAsync(
    resolver.workspaceDirectoryAdministration(
      { id: member.id } as never,
      workspaceId
    )
  );
});

test('filtered directory mutations recheck rights and reject stale or hidden-node edits', async t => {
  const { models, module, organization, actorId, workspaceId } = t.context;
  await organization.applyDataOperations(
    workspaceId,
    actorId,
    actorId,
    'folders',
    [
      {
        op: 'upsert',
        key: 'public',
        values: { type: 'folder', data: 'Public', parentId: null, index: 'a0' },
      },
      {
        op: 'upsert',
        key: 'private',
        values: {
          type: 'folder',
          data: 'Private',
          parentId: null,
          index: 'a1',
        },
      },
    ]
  );
  const setRights = (
    directoryId: string,
    canRead: boolean,
    canWrite: boolean
  ) =>
    models.workspaceDirectoryGrant.set({
      workspaceId,
      actorId,
      directoryId,
      principalId: '*',
      rights: { canRead, canWrite, canOrganize: true, canCreateFolder: true },
    });
  await setRights('private', false, false);
  const resolver = module.get(WorkspaceDirectoryResolver);
  const actor = { id: actorId } as never;
  const page = await resolver.workspaceDirectory(actor, workspaceId);
  t.false(page.fullSyncAllowed);
  const rename = [
    {
      op: 'upsert',
      key: 'public',
      values: { type: 'folder', data: 'Renamed', parentId: null, index: 'a0' },
    },
  ];
  const result = await resolver.mutateWorkspaceDirectory(
    actor,
    workspaceId,
    page.revision,
    rename
  );
  t.not(result.revision, page.revision);
  await t.throwsAsync(
    resolver.mutateWorkspaceDirectory(
      actor,
      workspaceId,
      page.revision,
      rename
    ),
    {
      message: /Directory changed/,
    }
  );
  await setRights('public', true, false);
  const revoked = await resolver.workspaceDirectory(actor, workspaceId);
  t.is(revoked.revision, result.revision);
  const changedContent = await resolver.workspaceDirectory(actor, workspaceId);
  await setRights('public', false, false);
  const hidden = await resolver.workspaceDirectory(actor, workspaceId);
  t.is(hidden.revision, changedContent.revision);
  t.not(hidden.authorizationRevision, changedContent.authorizationRevision);
  t.false(hidden.items.some(item => item.id === 'public'));
  await setRights('public', true, false);
  await t.throwsAsync(
    resolver.mutateWorkspaceDirectory(actor, workspaceId, result.revision, [
      {
        op: 'delete',
        key: 'public',
      },
    ]),
    { message: /directory does not allow/ }
  );
  await t.throwsAsync(
    resolver.mutateWorkspaceDirectory(actor, workspaceId, result.revision, [
      {
        op: 'upsert',
        key: 'private',
        values: {
          type: 'folder',
          data: 'Guessed overwrite',
          parentId: null,
          index: 'a1',
        },
      },
    ]),
    { message: /directory does not allow/ }
  );
  t.like((await organization.readFolders(workspaceId, actorId))[0], {
    id: 'public',
    data: 'Renamed',
  });
  await setRights('public', true, true);
  const deleted = await resolver.mutateWorkspaceDirectory(
    actor,
    workspaceId,
    result.revision,
    [{ op: 'delete', key: 'public' }]
  );
  t.not(deleted.revision, result.revision);
  await t.throwsAsync(
    resolver.mutateWorkspaceDirectory(
      actor,
      workspaceId,
      result.revision,
      rename
    ),
    { message: /Directory changed/ }
  );
  const outsider = await models.user.create({
    email: 'directory-mutation-outsider@example.com',
  });
  await t.throwsAsync(
    resolver.mutateWorkspaceDirectory(
      { id: outsider.id } as never,
      workspaceId,
      deleted.revision,
      rename
    )
  );
});

test('raw directory loads and broadcasts exclude recipients without whole-table read authority', async t => {
  const { module, models, db, organization, reader, actorId, workspaceId } =
    t.context;
  const member = await models.user.create({
    email: 'restricted-directory-reader@example.com',
  });
  await db.workspaceMember.create({
    data: { workspaceId, userId: member.id, role: 'member' },
  });
  await organization.applyDataOperations(
    workspaceId,
    actorId,
    actorId,
    'folders',
    [
      {
        op: 'upsert',
        key: 'private',
        values: {
          type: 'folder',
          data: 'Restricted directory title',
          parentId: null,
          index: 'a0',
        },
      },
    ]
  );
  const restrict = (principalId: string) =>
    models.workspaceDirectoryGrant.set({
      workspaceId,
      actorId,
      directoryId: 'private',
      principalId,
      rights: {
        canRead: false,
        canWrite: false,
        canOrganize: false,
        canCreateFolder: false,
      },
    });
  await restrict(member.id);
  const gateway = module.get(SpaceSyncGateway);
  const docId = `db$${workspaceId}$folders`;
  const client = () => ({ rooms: new Set([`workspace:${workspaceId}:sync`]) });
  const load = (id: string) =>
    gateway.onLoadSpaceDoc(
      client() as never,
      { id } as never,
      { spaceType: 'workspace', spaceId: workspaceId, docId } as never
    );
  t.like(await load(member.id), { error: { code: 'SPACE_ACCESS_DENIED' } });
  t.truthy((await load(actorId)).data.missing);
  t.like(
    await gateway.onJoinSpace(
      { id: member.id } as never,
      client() as never,
      {
        spaceType: 'workspace',
        spaceId: workspaceId,
        clientVersion: '0.26.0',
        docScopeId: docId,
      } as never
    ),
    { error: { code: 'SPACE_ACCESS_DENIED' } }
  );
  const protocolRooms = new Set([
    `workspace:${workspaceId}:sync-025`,
    `workspace:${workspaceId}:sync-026`,
  ]);
  const allowed = {
    id: 'allowed',
    data: { affinePresenceUserId: actorId },
    rooms: protocolRooms,
    emit: Sinon.spy(),
  };
  const denied = {
    id: 'denied',
    data: { affinePresenceUserId: member.id },
    rooms: protocolRooms,
    emit: Sinon.spy(),
  };
  const unknown = {
    id: 'unknown',
    data: {},
    rooms: protocolRooms,
    emit: Sinon.spy(),
  };
  const descriptor = Object.getOwnPropertyDescriptor(gateway, 'server');
  Object.defineProperty(gateway, 'server', {
    configurable: true,
    value: {
      in: () => ({ fetchSockets: async () => [allowed, denied, unknown] }),
    },
  });
  try {
    const snapshot = await reader.getDoc(workspaceId, docId);
    const broadcast = () =>
      gateway.onDocUpdatesPushed({
        spaceType: 'workspace',
        spaceId: workspaceId,
        docId,
        updates: [Buffer.from(snapshot!.bin)],
        timestamp: Date.now(),
        editor: actorId,
      });
    await broadcast();
    t.is(allowed.emit.callCount, 2);
    t.is(denied.emit.callCount, 0);
    t.is(unknown.emit.callCount, 0);
    await restrict(actorId);
    await broadcast();
    t.is(
      allowed.emit.callCount,
      2,
      'revocation must suppress both protocol broadcasts'
    );
  } finally {
    if (descriptor) Object.defineProperty(gateway, 'server', descriptor);
    else Reflect.deleteProperty(gateway, 'server');
  }
});

test('raw folder sync denies restricted changes and incomplete Yjs dependencies before storage', async t => {
  const { models, module, organization, reader, actorId, workspaceId } =
    t.context;
  const docId = `db$${workspaceId}$folders`;
  await organization.applyDataOperations(
    workspaceId,
    actorId,
    actorId,
    'folders',
    [
      {
        op: 'upsert',
        key: 'folder',
        values: {
          type: 'folder',
          data: 'Original',
          parentId: null,
          index: 'a0',
        },
      },
    ]
  );
  const original = await reader.getDoc(workspaceId, docId);
  const local = new Y.Doc();
  try {
    Y.applyUpdate(local, original!.bin);
    const vector = Y.encodeStateVector(local);
    local.getMap('folder').set('data', 'Unauthorized rename');
    const update = Y.encodeStateAsUpdate(local, vector);
    const stored = Sinon.spy(
      module.get(PgWorkspaceDocStorageAdapter),
      'pushDocUpdates'
    );
    const adapter = module
      .get(SpaceSyncGateway)
      .selectAdapter({} as never, 'workspace' as never);
    const send = () =>
      adapter.pushScoped(workspaceId, docId, [Buffer.from(update)], actorId);
    const setWrite = (canWrite: boolean) =>
      models.workspaceDirectoryGrant.set({
        workspaceId,
        actorId,
        directoryId: 'folder',
        principalId: '*',
        rights: {
          canRead: true,
          canWrite,
          canOrganize: true,
          canCreateFolder: true,
        },
      });
    await setWrite(false);
    await t.throwsAsync(send(), { message: /directory does not allow/ });
    t.is(stored.callCount, 0);
    t.like((await organization.readFolders(workspaceId, actorId))[0], {
      data: 'Original',
    });
    await setWrite(true);
    await send();
    t.is(stored.callCount, 1);
    t.like((await organization.readFolders(workspaceId, actorId))[0], {
      data: 'Unauthorized rename',
    });
    const trashVector = Y.encodeStateVector(local);
    local.getMap('folder').set('$$DELETED', true);
    await adapter.pushScoped(
      workspaceId,
      docId,
      [Buffer.from(Y.encodeStateAsUpdate(local, trashVector))],
      actorId
    );
    await setWrite(false);
    const hiddenVector = Y.encodeStateVector(local);
    local.getMap('folder').set('data', 'Hidden unauthorized rename');
    await t.throwsAsync(
      adapter.pushScoped(
        workspaceId,
        docId,
        [Buffer.from(Y.encodeStateAsUpdate(local, hiddenVector))],
        actorId
      ),
      {
        message: /directory does not allow/,
      }
    );
    t.is(stored.callCount, 2);
    const missing = new Y.Doc();
    try {
      missing.getMap('pending').set('id', 'pending');
      const missingVector = Y.encodeStateVector(missing);
      missing.getMap('pending').set('data', 'Delayed unauthorized payload');
      const incomplete = Y.encodeStateAsUpdate(missing, missingVector);
      await t.throwsAsync(
        adapter.pushScoped(
          workspaceId,
          docId,
          [Buffer.from(incomplete)],
          actorId
        ),
        { message: /all update dependencies/ }
      );
      t.is(stored.callCount, 2);
    } finally {
      missing.destroy();
    }
  } finally {
    local.destroy();
  }
});

test('retired Project document operations reject execution even after source authorization', async t => {
  const {
    db,
    models,
    service,
    writer,
    reader,
    actorId,
    sessionId,
    workspaceId,
    hostId,
    projectId,
  } = t.context;
  await db.aiSession.update({
    where: { id: sessionId },
    data: { selectedContextProjectId: projectId },
  });
  const source = await writer.createDoc(
    hostId,
    'Private source',
    'Private content',
    actorId
  );
  const operation = await models.copilotDocumentOperation.prepare({
    actorId,
    sessionId,
    requestKey: randomUUID(),
    title: 'Shared derivative',
    markdown: 'Derived content',
    addToProject: true,
  });
  await models.copilotContext.recordDocumentSources({
    sessionId,
    actorId,
    projectId,
    documents: [{ workspaceId: hostId, docId: source.docId }],
  });
  const input = { actorId, operationId: operation.id };
  const confirm = () =>
    service.confirmDestination({
      ...input,
      workspaceId,
      folderId: null,
      expectedRevision: 0,
    });
  await t.throwsAsync(confirm(), { message: /Legacy Project writes/ });
  t.is(await reader.getDoc(workspaceId, operation.documentId), null);
  const authorize = () =>
    seedProjectSourceGrant(db, {
      projectId,
      workspaceId: hostId,
      docId: source.docId,
      requesterUserId: actorId,
      requestedLevel: 'read',
    });
  await authorize();
  await t.throwsAsync(confirm(), { message: /Legacy Project writes/ });
  await models.intelligenceWorkbenchAuthorization.removeSourceDocumentAuthorizations(
    {
      workspaceId: hostId,
      docId: source.docId,
    }
  );
  await t.throwsAsync(confirm(), { message: /Legacy Project writes/ });
  t.is(await reader.getDoc(workspaceId, operation.documentId), null);
  t.is(
    (await models.copilotDocumentOperation.get(input)).createdDocumentAt,
    null
  );
  await authorize();
  await t.throwsAsync(confirm(), { message: /Legacy Project writes/ });
  t.is(await reader.getDoc(workspaceId, operation.documentId), null);
});

test('database rejects a forged completion receipt for retired Project writes', async t => {
  const { models, db, actorId, sessionId, workspaceId, projectId } = t.context;
  await db.aiSession.update({
    where: { id: sessionId },
    data: { selectedContextProjectId: projectId },
  });
  const operation = await models.copilotDocumentOperation.prepare({
    actorId,
    sessionId,
    requestKey: randomUUID(),
    title: 'Project creation',
    markdown: 'Project content',
    addToProject: true,
  });
  const input = { actorId, operationId: operation.id };
  await t.throwsAsync(
    db.copilotDocumentOperation.update({
      where: { id: operation.id },
      data: {
        status: 'complete',
        projectStatus: 'granted',
        destinationWorkspaceId: workspaceId,
        createdDocumentAt: new Date(),
      },
    }),
    { message: /Retired Project operations cannot create Workspace documents/ }
  );
  const receipt = await models.copilotDocumentOperation.receipt(input);
  t.is(receipt.createdDocumentAt, null);
  t.is(receipt.status, operation.status);
  t.is(receipt.projectStatus, operation.projectStatus);
  t.is(await db.aiContextProjectGrant.count(), 0);
});

test('cross-workspace creation waits for an explicit root and retries the same real document', async t => {
  const { service, reader, workspaceId, hostId, writer } = t.context;
  const input = await prepare(t.context);
  const create = Sinon.spy(writer, 'createDoc');
  await t.throwsAsync(service.execute({ ...input, expectedRevision: 0 }));
  t.is(create.callCount, 0);
  t.is(await reader.getDoc(workspaceId, input.operation.documentId), null);
  await service.confirmDestination({
    ...input,
    workspaceId,
    folderId: null,
    expectedRevision: 0,
  });
  const complete = await service.execute({ ...input, expectedRevision: 1 });
  t.is(complete.status, 'complete');
  t.is(complete.projectStatus, 'not_requested');
  t.truthy(await reader.getDoc(workspaceId, complete.documentId));
  t.is(await reader.getDoc(hostId, complete.documentId), null);
  t.is(
    (await service.execute({ ...input, expectedRevision: 1 })).documentId,
    complete.documentId
  );
  t.is(create.callCount, 1);
});

test('body creation commits its receipt before later initialization failure and retries the same document', async t => {
  const { models, service, writer, module, reader, db, workspaceId } =
    t.context;
  const input = await prepare(t.context);
  const confirmed = await service.confirmDestination({
    ...input,
    workspaceId,
    folderId: null,
    expectedRevision: 0,
  });
  const storage = module.get(PgWorkspaceDocStorageAdapter);
  const push = storage.pushDocUpdates.bind(storage);
  let rejectedProperties = false;
  const observed = Sinon.stub(storage, 'pushDocUpdates').callsFake(
    async (...args) => {
      if (
        !rejectedProperties &&
        args[1] === `db$${workspaceId}$docProperties`
      ) {
        rejectedProperties = true;
        throw new Error('properties temporarily unavailable');
      }
      return await push(...args);
    }
  );
  const create = Sinon.spy(writer, 'createDoc');
  await t.throwsAsync(
    service.execute({
      ...input,
      expectedRevision: confirmed.destinationRevision,
    }),
    { message: /properties temporarily unavailable/ }
  );
  const partial = await models.copilotDocumentOperation.get(input);
  t.truthy(await reader.getDoc(workspaceId, partial.documentId));
  t.truthy(partial.createdDocumentAt);
  t.is(partial.status, 'created');
  t.is(partial.placedDocumentAt, null);
  t.false(await models.copilotDocumentOperation.initializationCompleted(input));
  t.truthy(
    (await models.copilotDocumentOperation.receipt(input)).createdDocumentAt
  );
  const recovered = await service.execute({
    ...input,
    expectedRevision: confirmed.destinationRevision,
  });
  t.is(recovered.status, 'complete');
  t.is(recovered.documentId, partial.documentId);
  t.is(
    recovered.createdDocumentAt?.getTime(),
    partial.createdDocumentAt?.getTime()
  );
  t.is(create.callCount, 2);
  t.is(
    observed.getCalls().filter(call => call.args[1] === partial.documentId)
      .length,
    1
  );
  t.true(await models.copilotDocumentOperation.initializationCompleted(input));
  t.is(
    await db.copilotDocumentOperationEvent.count({
      where: {
        operationId: input.operationId,
        eventType: 'initialization_completed',
      },
    }),
    1
  );
});

test('creation receipt failure rolls back the body in the same storage transaction', async t => {
  const { models, service, reader, workspaceId } = t.context;
  const input = await prepare(t.context);
  const confirmed = await service.confirmDestination({
    ...input,
    workspaceId,
    folderId: null,
    expectedRevision: 0,
  });
  const receipt = Sinon.stub(
    models.copilotDocumentOperation,
    'recordCreated'
  ).rejects(new Error('receipt storage unavailable'));
  await t.throwsAsync(
    service.execute({
      ...input,
      expectedRevision: confirmed.destinationRevision,
    })
  );
  const failed = await models.copilotDocumentOperation.get(input);
  t.is(failed.createdDocumentAt, null);
  t.is(await reader.getDoc(workspaceId, failed.documentId), null);
  receipt.restore();
  const recovered = await service.execute({
    ...input,
    expectedRevision: confirmed.destinationRevision,
  });
  t.is(recovered.documentId, failed.documentId);
  t.is(recovered.status, 'complete');
});

test('directory placement failure preserves creation and recovers without a second writer call', async t => {
  const { service, organization, writer, workspaceId, actorId, models } =
    t.context;
  await organization.applyDataOperations(
    workspaceId,
    actorId,
    actorId,
    'folders',
    [
      {
        op: 'upsert',
        key: 'target',
        values: { type: 'folder', parentId: null, data: 'Target', index: 'a0' },
      },
    ]
  );
  const input = await prepare(t.context);
  await service.confirmDestination({
    ...input,
    workspaceId,
    folderId: 'target',
    expectedRevision: 0,
  });
  const create = Sinon.spy(writer, 'createDoc');
  const placement = Sinon.stub(organization, 'applyDataOperations');
  placement.onFirstCall().rejects(new Error('temporary placement failure'));
  placement.callThrough();
  await t.throwsAsync(service.execute({ ...input, expectedRevision: 1 }));
  const created = await models.copilotDocumentOperation.get(input);
  t.truthy(created.createdDocumentAt);
  t.is(created.placedDocumentAt, null);
  await organization.applyDataOperations(
    workspaceId,
    actorId,
    actorId,
    'folders',
    [{ op: 'upsert', key: 'target', values: { data: 'Renamed target' } }]
  );
  await t.throwsAsync(service.execute({ ...input, expectedRevision: 1 }));
  await service.confirmDestination({
    ...input,
    workspaceId,
    folderId: 'target',
    expectedRevision: 1,
  });
  const complete = await service.execute({ ...input, expectedRevision: 2 });
  t.is(complete.status, 'complete');
  t.is(create.callCount, 1);
  const events = await t.context.db.copilotDocumentOperationEvent.findMany({
    where: {
      operationId: input.operationId,
      eventType: 'destination_confirmed',
    },
    orderBy: { createdAt: 'asc' },
  });
  t.is(events.length, 2);
  t.not(
    (events[0].detail as { destinationFingerprint: string })
      .destinationFingerprint,
    (events[1].detail as { destinationFingerprint: string })
      .destinationFingerprint
  );
  await t.throwsAsync(
    t.context.db.copilotDocumentOperationEvent.update({
      where: { id: events[0].id },
      data: { detail: {} },
    })
  );
  const rows = await organization.readFolders(workspaceId, actorId);
  t.is(
    rows.filter(
      row =>
        row.type === 'doc' &&
        row.data === complete.documentId &&
        row.parentId === 'target'
    ).length,
    1
  );
});

test('live directory denials and changed ancestors reject execution with zero creation', async t => {
  const {
    service,
    organization,
    writer,
    workspaceId,
    actorId,
    models,
    destination,
  } = t.context;
  await organization.applyDataOperations(
    workspaceId,
    actorId,
    actorId,
    'folders',
    [
      {
        op: 'upsert',
        key: 'parent',
        values: { type: 'folder', parentId: null, data: 'Parent', index: 'a0' },
      },
      {
        op: 'upsert',
        key: 'target',
        values: {
          type: 'folder',
          parentId: 'parent',
          data: 'Target',
          index: 'a0',
        },
      },
    ]
  );
  const input = await prepare(t.context);
  await service.confirmDestination({
    ...input,
    workspaceId,
    folderId: 'target',
    expectedRevision: 0,
  });
  const create = Sinon.spy(writer, 'createDoc');
  await models.workspaceDirectoryGrant.set({
    workspaceId,
    actorId,
    directoryId: 'parent',
    principalId: '*',
    rights: {
      canRead: true,
      canWrite: false,
      canOrganize: true,
      canCreateFolder: true,
    },
  });
  await t.throwsAsync(service.execute({ ...input, expectedRevision: 1 }));
  t.is(create.callCount, 0);
  const outsider = await models.user.create({
    email: 'directory-outsider@example.com',
  });
  await t.throwsAsync(
    models.workspaceDirectoryGrant.set({
      workspaceId,
      actorId: outsider.id,
      directoryId: 'parent',
      principalId: '*',
      rights: {
        canRead: true,
        canWrite: true,
        canOrganize: true,
        canCreateFolder: true,
      },
    })
  );
  await models.workspaceDirectoryGrant.set({
    workspaceId,
    actorId,
    directoryId: 'target',
    principalId: actorId,
    rights: {
      canRead: true,
      canWrite: true,
      canOrganize: true,
      canCreateFolder: true,
    },
  });
  await t.throwsAsync(service.execute({ ...input, expectedRevision: 1 }));
  t.is(create.callCount, 0);
  await models.workspaceDirectoryGrant.set({
    workspaceId,
    actorId,
    directoryId: 'parent',
    principalId: '*',
    rights: {
      canRead: true,
      canWrite: true,
      canOrganize: true,
      canCreateFolder: false,
    },
  });
  await t.throwsAsync(
    destination.authorize({
      actorId,
      workspaceId,
      folderId: 'target',
      createFolder: true,
    })
  );
  await organization.applyDataOperations(
    workspaceId,
    actorId,
    actorId,
    'folders',
    [{ op: 'upsert', key: 'target', values: { parentId: null } }]
  );
  await t.throwsAsync(service.execute({ ...input, expectedRevision: 1 }));
  t.is(create.callCount, 0);
});
