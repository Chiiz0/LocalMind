import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import ava, { type TestFn } from 'ava';
import Sinon from 'sinon';
import * as Y from 'yjs';

import { DocReader, DocWriter } from '../../core/doc';
import { ProjectResourceService } from '../../core/project';
import {
  ProjectDestinationFolderService,
  ProjectPublicationService,
  ProjectTransferModule,
  ProjectWorkspaceImportService,
} from '../../core/project-transfer';
import { Models } from '../../models';
import { projectWorkspaceImportCommand } from '../../models/project-workspace-import';
import { createDocWithMarkdown } from '../../native';
import { CopilotAgentRuntimeWorkflowRegistry } from '../../plugins/copilot/agent-runtime-workflow-registry';
import { CopilotProjectAgentRuntimeWorker } from '../../plugins/copilot/project-agent-runtime-worker';
import { createTestingModule, type TestingModule } from '../utils';

const test = ava.serial as TestFn<{
  module: TestingModule;
  db: PrismaClient;
  models: Models;
  service: ProjectWorkspaceImportService;
  worker: CopilotProjectAgentRuntimeWorker;
  projectId: string;
  workspaceId: string;
  actorId: string;
  ownerId: string;
  sourceResourceId: string;
}>;
test.before(async t => {
  const module = await createTestingModule({
    imports: [ProjectTransferModule],
  });
  const models = module.get(Models);
  const service = module.get(ProjectWorkspaceImportService);
  Object.assign(t.context, {
    module,
    models,
    service,
    db: module.get(PrismaClient),
    worker: new CopilotProjectAgentRuntimeWorker(
      models,
      module.get(ProjectResourceService),
      module.get(ProjectPublicationService),
      module.get(ProjectDestinationFolderService),
      service,
      module.get(DocWriter),
      new CopilotAgentRuntimeWorkflowRegistry(models)
    ),
  });
});
test.beforeEach(async t => {
  const { module, db, models } = t.context;
  await module.initTestingDB();
  const owner = await models.user.create({ email: 'import-owner@example.com' });
  const actor = await models.user.create({
    email: 'import-reader@example.com',
  });
  const workspace = await models.workspace.create(owner.id);
  await db.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: actor.id,
      role: 'member',
      state: 'active',
    },
  });
  await db.workspaceAccessPolicy.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, memberDefaultDocRole: 'none' },
    update: { memberDefaultDocRole: 'none' },
  });
  await db.effectiveWorkspaceQuotaState.upsert({
    where: { workspaceId: workspace.id },
    create: {
      workspaceId: workspace.id,
      plan: 'free',
      ownerUserId: owner.id,
      seatLimit: 100,
      blobLimit: 0,
      storageQuota: 0,
      historyPeriodSeconds: 0,
      known: true,
      stale: false,
    },
    update: { known: true, stale: false, staleAfter: null },
  });
  const project = await db.aiContextProject.create({
    data: {
      name: 'Import destination',
      members: {
        create: [
          { userId: owner.id, role: 'owner' },
          { userId: actor.id, role: 'member' },
        ],
      },
    },
  });
  const sourceResourceId = randomUUID();
  await module
    .get(DocWriter)
    .pushDocUpdate(
      workspace.id,
      sourceResourceId,
      createDocWithMarkdown('Visible report', 'Source body', sourceResourceId),
      owner.id
    );
  await db.docGrant.create({
    data: {
      workspaceId: workspace.id,
      docId: sourceResourceId,
      principalType: 'user',
      principalId: actor.id,
      role: 'reader',
    },
  });
  Object.assign(t.context, {
    projectId: project.id,
    workspaceId: workspace.id,
    actorId: actor.id,
    ownerId: owner.id,
    sourceResourceId,
  });
});
test.after.always(async t => {
  await t.context.module.close();
});
function selection(context: typeof test extends TestFn<infer C> ? C : never) {
  return {
    projectId: context.projectId,
    workspaceId: context.workspaceId,
    actorId: context.actorId,
    sourceResourceId: context.sourceResourceId,
    parentId: null,
    requestKey: 'import-file',
    requestApproval: true,
  };
}

test('selector filters both workspaces and documents and refuses forged unreadable selections', async t => {
  const {
    service,
    module,
    models,
    db,
    workspaceId,
    projectId,
    actorId,
    ownerId,
    sourceResourceId,
  } = t.context;
  const hidden = randomUUID();
  await module
    .get(DocWriter)
    .pushDocUpdate(
      workspaceId,
      hidden,
      createDocWithMarkdown('Private report', 'Hidden body', hidden),
      ownerId
    );
  const other = await models.workspace.create(ownerId);
  const workspaces = await service.workspaces({ projectId, actorId });
  t.deepEqual(
    workspaces.items.map(item => item.id),
    [workspaceId]
  );
  const sources = await service.sources({ projectId, actorId, workspaceId });
  t.deepEqual(
    sources.items.map(item => item.id),
    [sourceResourceId]
  );
  t.is(sources.items[0].title, 'Visible report');
  t.is(sources.items[0].permission, 'approval');
  await t.throwsAsync(
    service.sources({ projectId, actorId, workspaceId: other.id })
  );
  await t.throwsAsync(
    service.submit({ ...selection(t.context), sourceResourceId: hidden })
  );
  await t.throwsAsync(
    service.submit({ ...selection(t.context), requestApproval: false }),
    { message: /reload and request approval/ }
  );
  t.is(await db.aiAgentRun.count(), 0);
  t.is(await db.accessRequest.count(), 0);
  await db.docGrant.deleteMany({ where: { principalId: actorId } });
  t.deepEqual(
    (await service.sources({ projectId, actorId, workspaceId })).items,
    []
  );
});

test('selector skips non-document snapshots and refuses importing them', async t => {
  const {
    service,
    module,
    db,
    projectId,
    workspaceId,
    ownerId,
    sourceResourceId,
  } = t.context;
  const metadataId = randomUUID();
  const metadata = new Y.Doc();
  metadata.getMap('metadata').set('version', 1);
  try {
    await module
      .get(DocWriter)
      .pushDocUpdate(
        workspaceId,
        metadataId,
        Y.encodeStateAsUpdate(metadata),
        ownerId
      );
  } finally {
    metadata.destroy();
  }
  const sources = await service.sources({
    projectId,
    workspaceId,
    actorId: ownerId,
  });
  t.deepEqual(
    sources.items.map(item => item.id),
    [sourceResourceId]
  );
  await t.throwsAsync(
    service.submit({
      ...selection(t.context),
      actorId: ownerId,
      sourceResourceId: metadataId,
      requestApproval: false,
    }),
    { message: /unavailable or cannot be copied/ }
  );
  t.is(await db.aiAgentRun.count(), 0);
  t.is(await db.accessRequest.count(), 0);
});

test('selector rechecks personal access after reading document content', async t => {
  const {
    service,
    module,
    db,
    projectId,
    workspaceId,
    actorId,
    sourceResourceId,
  } = t.context;
  const reader = module.get(DocReader);
  const getDoc = reader.getDoc.bind(reader);
  const read = Sinon.stub(reader, 'getDoc').callsFake(async (...args) => {
    await db.docGrant.deleteMany({
      where: { workspaceId, docId: sourceResourceId, principalId: actorId },
    });
    return getDoc(...args);
  });
  try {
    const result = await service.sources({ projectId, workspaceId, actorId });
    t.deepEqual(result.items, []);
  } finally {
    read.restore();
  }
});

test('selector previews approved copies without authorization write locks', async t => {
  const { service, models, db, projectId, workspaceId, actorId, ownerId } =
    t.context;
  const run = await service.submit(selection(t.context));
  const requestId = projectWorkspaceImportCommand.parse(
    run.steps.find(step => step.stepKey === 'execute')?.input
  ).accessRequestId!;
  await models.intelligenceWorkbenchAuthorization.approveAccessRequest({
    requestId,
    actorUserId: ownerId,
  });
  const locks = Sinon.spy(
    models.intelligenceWorkbenchAuthorization,
    'lockProjectDocumentAuthorization'
  );
  try {
    t.is(
      (await service.sources({ projectId, workspaceId, actorId })).items[0]
        .permission,
      'direct'
    );
    await db.workspaceAccessPolicy.update({
      where: { workspaceId },
      data: { sharingEnabled: false },
    });
    t.is(
      (await service.sources({ projectId, workspaceId, actorId })).items[0]
        .permission,
      'blocked'
    );
    t.false(locks.called);
    t.is(await db.projectResource.count(), 0);
  } finally {
    locks.restore();
  }
});

test('direct imports use the worker, persist in the selected folder and replay without another copy', async t => {
  const { service, worker, models, db, projectId, ownerId } = t.context;
  const parent = await models.projectResource.create({
    projectId,
    actorId: ownerId,
    title: 'Destination',
    kind: 'folder',
    requestKey: 'folder',
  });
  const input = {
    ...selection(t.context),
    actorId: ownerId,
    parentId: parent.id,
    requestApproval: false,
  };
  const run = await service.submit(input);
  t.is(run.status, 'queued');
  await worker.run({});
  await worker.run({});
  t.is((await service.submit(input)).id, run.id);
  const resource = await db.projectResource.findFirstOrThrow({
    where: { kind: 'page' },
  });
  t.is(resource.parentId, parent.id);
  t.is(await db.projectResource.count(), 2);
  t.is(await db.accessRequest.count(), 0);
  await t.throwsAsync(service.submit({ ...input, parentId: null }), {
    message: /different input/,
  });
  const list = await models.projectWorkspaceImport.list({
    projectId,
    actorId: ownerId,
    parentId: parent.id,
  });
  t.is(list.items[0].status, 'completed');
});

test('approval notification leads to automatic import with one waiting Todo and no self-approval', async t => {
  const { service, worker, models, db, actorId, ownerId, projectId } =
    t.context;
  const run = await service.submit(selection(t.context));
  const command = projectWorkspaceImportCommand.parse(
    run.steps.find(step => step.stepKey === 'execute')?.input
  );
  t.is(run.status, 'waiting_approval');
  await t.throwsAsync(
    models.copilotProjectAgentRuntime.approve({
      projectId,
      actorId,
      runId: run.id,
      targetFingerprint: run.targetFingerprint,
    }),
    { message: /source notification/ }
  );
  await t.throwsAsync(
    models.intelligenceWorkbenchAuthorization.approveAccessRequest({
      requestId: command.accessRequestId!,
      actorUserId: actorId,
    })
  );
  await worker.run({});
  t.is(await db.projectResource.count(), 0);
  const panel = await models.intelligenceWorkbenchTaskProjection.listPanel({
    userId: actorId,
    projectId,
  });
  t.is(
    panel.todo.items.filter(item => item.kind === 'access_request').length,
    1
  );
  t.is(panel.todo.items.filter(item => item.kind === 'project_run').length, 0);
  t.is(
    panel.todo.items.find(item => item.kind === 'access_request')?.attention,
    'waiting_on_others'
  );
  await models.intelligenceWorkbenchAuthorization.approveAccessRequest({
    requestId: command.accessRequestId!,
    actorUserId: ownerId,
  });
  // Recovery consumes persisted state, without a client or immediate queue delivery.
  await Promise.all([worker.run({}), worker.run({})]);
  t.is(await db.projectResource.count(), 1);
  t.is(
    (
      await models.copilotProjectAgentRuntime.get({
        projectId,
        actorId,
        runId: run.id,
      })
    ).status,
    'completed'
  );
});

for (const decision of ['rejected', 'withdrawn', 'expired'] as const) {
  test(`${decision} requests never copy their source`, async t => {
    const { service, worker, models, db, actorId, ownerId } = t.context;
    const run = await service.submit(selection(t.context));
    const requestId = projectWorkspaceImportCommand.parse(
      run.steps.find(step => step.stepKey === 'execute')?.input
    ).accessRequestId!;
    if (decision === 'rejected')
      await models.intelligenceWorkbenchAuthorization.rejectAccessRequest({
        requestId,
        actorUserId: ownerId,
      });
    else if (decision === 'withdrawn')
      await models.intelligenceWorkbenchAuthorization.withdrawAccessRequest({
        requestId,
        actorUserId: actorId,
      });
    else
      await models.intelligenceWorkbenchAuthorization.expireDueAccessRequests({
        now: new Date(Date.now() + 8 * 86400000),
      });
    const clock =
      decision === 'withdrawn'
        ? Sinon.useFakeTimers({
            now: run.updatedAt.getTime() - 1000,
            toFake: ['Date'],
          })
        : null;
    try {
      await worker.run({});
    } finally {
      clock?.restore();
    }
    t.is(await db.projectResource.count(), 0);
    t.is(
      (await db.aiAgentRun.findUniqueOrThrow({ where: { id: run.id } })).status,
      'cancelled'
    );
  });
}

test('a failed import retains its receipt and retries once permissions recover', async t => {
  const {
    service,
    worker,
    models,
    db,
    actorId,
    ownerId,
    workspaceId,
    sourceResourceId,
    projectId,
  } = t.context;
  const run = await service.submit(selection(t.context));
  const requestId = projectWorkspaceImportCommand.parse(
    run.steps.find(step => step.stepKey === 'execute')?.input
  ).accessRequestId!;
  await models.intelligenceWorkbenchAuthorization.approveAccessRequest({
    requestId,
    actorUserId: ownerId,
  });
  await db.docGrant.deleteMany({
    where: { workspaceId, docId: sourceResourceId, principalId: actorId },
  });
  await worker.run({});
  t.is(await db.projectResource.count(), 0);
  t.is(
    (await db.aiAgentRun.findUniqueOrThrow({ where: { id: run.id } })).status,
    'failed'
  );
  await t.throwsAsync(service.retry({ projectId, actorId, runId: run.id }));
  await db.docGrant.create({
    data: {
      workspaceId,
      docId: sourceResourceId,
      principalType: 'user',
      principalId: actorId,
      role: 'reader',
    },
  });
  await Promise.all([
    service.retry({ projectId, actorId, runId: run.id }),
    service.retry({ projectId, actorId, runId: run.id }),
  ]);
  await worker.run({});
  await worker.run({});
  t.is(await db.projectResource.count(), 1);
  t.is(
    await db.aiAgentRuntimeExecutionResult.count({ where: { runId: run.id } }),
    2
  );
});

test('removed Project members and disabled source sharing cannot execute queued copies', async t => {
  const { service, worker, db, ownerId, projectId, workspaceId } = t.context;
  const run = await service.submit({
    ...selection(t.context),
    actorId: ownerId,
    requestApproval: false,
  });
  await db.workspaceAccessPolicy.update({
    where: { workspaceId },
    data: { sharingEnabled: false },
  });
  await worker.run({});
  t.is(await db.projectResource.count(), 0);
  t.is(
    (await db.aiAgentRun.findUniqueOrThrow({ where: { id: run.id } })).status,
    'failed'
  );
  await db.workspaceAccessPolicy.update({
    where: { workspaceId },
    data: { sharingEnabled: true },
  });
  await service.retry({ projectId, actorId: ownerId, runId: run.id });
  await db.aiContextProjectMember.updateMany({
    where: { projectId, userId: t.context.actorId },
    data: { role: 'owner' },
  });
  await db.aiContextProjectMember.deleteMany({
    where: { projectId, userId: ownerId },
  });
  await worker.run({});
  t.is(await db.projectResource.count(), 0);
});
