import { randomUUID } from 'node:crypto';

import type { GraphQLQuery } from '@affine/graphql';
import { PrismaClient, WorkspaceMemberStatus } from '@prisma/client';
import type { TestFn } from 'ava';
import ava from 'ava';
import Sinon from 'sinon';

import { AppModule } from '../../app.module';
import { EventBus, JOB_SIGNAL } from '../../base';
import { ConfigModule } from '../../base/config';
import { DocReader, DocWriter } from '../../core/doc';
import { PermissionAccess } from '../../core/permission';
import { Models, WorkspaceRole } from '../../models';
import { CopilotAgentRuntimeWorker } from '../../plugins/copilot/agent-runtime-worker';
import { CopilotContextService } from '../../plugins/copilot/context/service';
import { ContextScopeResolver } from '../../plugins/copilot/context-scope-resolver';
import { ToolRuntime } from '../../plugins/copilot/runtime/tool-runtime';
import {
  createTestingApp,
  createWorkspace,
  type TestingApp,
  type TestUser,
} from '../utils';

const test = ava.serial as TestFn<{
  app: TestingApp;
  db: PrismaClient;
  owner: TestUser;
}>;

const taskPanelQuery = {
  id: 'intelligenceWorkbenchTaskPanelTestQuery',
  op: 'intelligenceWorkbenchTaskPanel',
  query: `
    query intelligenceWorkbenchTaskPanel($projectId: ID) {
      currentUser {
        copilot {
          workbenchTaskPanel(projectId: $projectId) {
            todo {
              capped
              items {
                cardId: id
                id: entityId
                kind
                segment
                attention
                workspaceId
                projectId
                status
                redacted
                availableActions
                blocker {
                  type
                  waitingOn
                  dueAt
                  overdue
                  origin
                  creatorUserId
                  resolutionActorUserId
                }
                run {
                  id
                  availableActions
                  abandoned
                }
              }
            }
            inProgress {
              capped
              items {
                cardId: id
                id: entityId
                kind
                segment
                attention
                workspaceId
                projectId
                status
                redacted
                availableActions
                blocker {
                  type
                  waitingOn
                  dueAt
                  overdue
                  origin
                  creatorUserId
                  resolutionActorUserId
                }
                run {
                  id
                  availableActions
                  abandoned
                }
              }
            }
            done {
              capped
              items {
                cardId: id
                id: entityId
                kind
                segment
                attention
                workspaceId
                projectId
                status
                redacted
                availableActions
                blocker {
                  type
                  waitingOn
                  dueAt
                  overdue
                  origin
                  creatorUserId
                  resolutionActorUserId
                }
                run {
                  id
                  availableActions
                  abandoned
                }
              }
            }
          }
        }
      }
    }
  `,
} satisfies GraphQLQuery;

const taskHistoryQuery = {
  id: 'workbenchHistoryTest',
  op: 'workbenchHistoryTest',
  query: `query workbenchHistoryTest($cursor: String, $filter: String, $limit: Int) {
    currentUser { copilot { workbenchTasks(cursor: $cursor, filter: $filter, limit: $limit) {
      nextCursor capped items { id entityId kind status workspaceId }
    } } }
  }`,
} satisfies GraphQLQuery;

const taskDetailQuery = {
  id: 'workbenchDetailTest',
  op: 'workbenchDetailTest',
  query: `query workbenchDetailTest($taskId: String!) {
    currentUser { copilot { workbenchTask(taskId: $taskId) {
      id entityId run {
        approvalFingerprint approvalSummary
        artifacts { id kind workspaceId }
        documentUpdate { workspaceId docId content expectedVersion previousVersion needsReconfirmation }
      }
    } } }
  }`,
} satisfies GraphQLQuery;

const blockerCreateMutation = {
  id: 'intelligenceWorkbenchBlockerCreateTestMutation',
  op: 'createCopilotBlocker',
  query: `
    mutation createCopilotBlocker($input: CreateCopilotBlockerInput!) {
      createCopilotBlocker(input: $input) {
        id
        projectId
        creatorUserId
        title
        type
        waitingOn
        dueAt
        overdue
        status
        origin
        resolutionActorUserId
        resolvedAt
      }
    }
  `,
} satisfies GraphQLQuery;

const blockerSuggestionConfirmMutation = {
  id: 'intelligenceWorkbenchBlockerSuggestionConfirmTestMutation',
  op: 'confirmCopilotBlockerSuggestion',
  query: `
    mutation confirmCopilotBlockerSuggestion(
      $input: ConfirmCopilotBlockerSuggestionInput!
    ) {
      confirmCopilotBlockerSuggestion(input: $input) {
        id
        projectId
        creatorUserId
        title
        type
        waitingOn
        dueAt
        overdue
        status
        origin
        resolutionActorUserId
        resolvedAt
      }
    }
  `,
} satisfies GraphQLQuery;

const blockerResolveMutation = {
  id: 'intelligenceWorkbenchBlockerResolveTestMutation',
  op: 'resolveCopilotBlocker',
  query: `
    mutation resolveCopilotBlocker($blockerId: ID!) {
      resolveCopilotBlocker(blockerId: $blockerId) {
        id
        status
        resolutionActorUserId
        resolvedAt
      }
    }
  `,
} satisfies GraphQLQuery;

const blockerAbandonMutation = {
  id: 'intelligenceWorkbenchBlockerAbandonTestMutation',
  op: 'abandonCopilotBlocker',
  query: `
    mutation abandonCopilotBlocker($blockerId: ID!) {
      abandonCopilotBlocker(blockerId: $blockerId) {
        id
        status
        resolutionActorUserId
        resolvedAt
      }
    }
  `,
} satisfies GraphQLQuery;

const blockersQuery = {
  id: 'intelligenceWorkbenchBlockersTestQuery',
  op: 'intelligenceWorkbenchBlockers',
  query: `
    query intelligenceWorkbenchBlockers($projectId: ID) {
      currentUser {
        copilot {
          workbenchBlockers(projectId: $projectId) {
            id
            projectId
            creatorUserId
            title
            type
            waitingOn
            dueAt
            overdue
            status
            origin
            resolutionActorUserId
            resolvedAt
          }
        }
      }
    }
  `,
} satisfies GraphQLQuery;

const taskControlMutation = {
  id: 'intelligenceWorkbenchTaskControlTestMutation',
  op: 'controlCopilotTask',
  query: `
    mutation controlCopilotTask($input: CopilotTaskControlInput!) {
      controlCopilotTask(input: $input) {
        id
        workspaceId
        projectId
        status
        availableActions
        abandoned
      }
    }
  `,
} satisfies GraphQLQuery;

const agentRuntimeDocUpdateRequestMutation = {
  id: 'intelligenceWorkbenchAgentRuntimeDocUpdateRequestMutation',
  op: 'requestCopilotAgentRuntimeDocUpdate',
  query: `
    mutation requestCopilotAgentRuntimeDocUpdate(
      $input: CopilotAgentRuntimeDocUpdateRequestInput!
    ) {
      requestCopilotAgentRuntimeDocUpdate(input: $input) {
        id
        workspaceId
        status
        targetFingerprint
        evidenceFingerprint
        steps {
          id
          stepType
          status
          outputSummary
        }
      }
    }
  `,
} satisfies GraphQLQuery;

const agentRuntimeControlMutation = {
  id: 'intelligenceWorkbenchAgentRuntimeControlMutation',
  op: 'controlCopilotAgentRuntimeRun',
  query: `
    mutation controlCopilotAgentRuntimeRun(
      $input: CopilotAgentRuntimeControlInput!
    ) {
      controlCopilotAgentRuntimeRun(input: $input) {
        id
        workspaceId
        status
        executionResultCount
        steps {
          id
          stepType
          status
          outputSummary
        }
      }
    }
  `,
} satisfies GraphQLQuery;

const legacyAgentRuntimeVisibilityQuery = {
  id: 'intelligenceWorkbenchLegacyAgentRuntimeVisibilityQuery',
  op: 'intelligenceWorkbenchLegacyAgentRuntimeVisibility',
  query: `
      query intelligenceWorkbenchLegacyAgentRuntimeVisibility(
        $workspaceId: String!
        $runId: String!
      ) {
      currentUser {
        copilot(workspaceId: $workspaceId) {
          agentRuns(limit: 20) {
            id
            actorId
            steps {
              outputSummary
            }
          }
          agentRun(id: $runId) {
            id
            actorId
            steps {
              outputSummary
            }
          }
        }
      }
    }
  `,
} satisfies GraphQLQuery;

const tasksQuery = {
  id: 'intelligenceWorkbenchTasksTestQuery',
  op: 'intelligenceWorkbenchTasks',
  query: `
    query intelligenceWorkbenchTasks(
      $workspaceId: String
      $limit: SafeInt
      $filter: CopilotTaskListFilterInput
    ) {
      currentUser {
        copilot(workspaceId: $workspaceId) {
          copilotTasks(limit: $limit, filter: $filter) {
            id
            workspaceId
            status
          }
        }
      }
    }
  `,
} satisfies GraphQLQuery;

test.before(async t => {
  const app = await createTestingApp({
    imports: [
      ConfigModule.override({
        copilot: {
          providers: {
            openai: { apiKey: '1' },
          },
        },
      }),
      AppModule,
    ],
  });
  t.context.app = app;
  t.context.db = app.get(PrismaClient);
});

test.beforeEach(async t => {
  await t.context.app.initTestingDB();
  t.context.owner = await t.context.app.signupV1();
});

test.after.always(async t => {
  await t.context.app?.close();
});

async function queryTaskPanel(app: TestingApp, projectId?: string) {
  const result = await app.gql({
    query: taskPanelQuery,
    variables: { projectId },
  });
  return result.currentUser.copilot.workbenchTaskPanel;
}

async function queryTasks(
  app: TestingApp,
  variables: {
    workspaceId?: string;
    limit?: number;
    filter?: { query?: string; status?: string };
  } = {}
) {
  const result = await app.gql({ query: tasksQuery, variables });
  return result.currentUser.copilot.copilotTasks;
}

async function createProjectSession(input: {
  db: PrismaClient;
  owner: TestUser;
  workspaceId: string;
}) {
  const promptName = 'workbench-test';
  await input.db.aiPrompt.upsert({
    where: { name: promptName },
    create: {
      action: 'chat',
      config: {},
      model: 'test',
      name: promptName,
      optionalModels: ['test'],
    },
    update: {},
  });
  const projectId = randomUUID();
  const sessionId = randomUUID();
  const now = new Date();
  await input.db.$transaction(async tx => {
    await tx.$executeRaw`
      INSERT INTO ai_context_projects (
        id,
        created_by_user_id,
        name,
        description,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${projectId},
        ${input.owner.id},
        ${'Workbench project'},
        ${''},
        ${'active'},
        ${now},
        ${now}
      )
    `;
    await tx.$executeRaw`
      INSERT INTO ai_context_project_members (
        project_id,
        user_id,
        role,
        created_at,
        updated_at
      )
      VALUES (
        ${projectId},
        ${input.owner.id},
        ${'owner'},
        ${now},
        ${now}
      )
    `;
  });
  await input.db.$executeRaw`
    INSERT INTO ai_sessions_metadata (
      id,
      user_id,
      workspace_id,
      doc_id,
      selected_context_project_id,
      prompt_name,
      prompt_action,
      pinned,
      created_at,
      updated_at
    )
    VALUES (
      ${sessionId},
      ${input.owner.id},
      ${input.workspaceId},
      ${null},
      ${projectId},
      ${promptName},
      ${''},
      ${false},
      ${now},
      ${now}
    )
  `;
  return { projectId, sessionId };
}

type RequestedProjectDocWrite = {
  id: string;
  status: string;
  workspaceId: string;
  steps: Array<{
    id: string;
    outputSummary: Record<string, unknown>;
    status: string;
    stepType: string;
  }>;
};

async function requestProjectDocWrite(input: {
  app: TestingApp;
  content: string;
  docId: string;
  idempotencyKey: string;
  sessionId: string;
  sourceWorkspaceId: string;
}) {
  const result = await input.app.gql({
    query: agentRuntimeDocUpdateRequestMutation,
    variables: {
      input: {
        workspaceId: input.sourceWorkspaceId,
        sessionId: input.sessionId,
        docId: input.docId,
        content: input.content,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });
  return result.requestCopilotAgentRuntimeDocUpdate as RequestedProjectDocWrite;
}

async function approveProjectDocWrite(input: {
  app: TestingApp;
  hostWorkspaceId: string;
  runId: string;
  expectedApprovalFingerprint?: string;
}) {
  const result = await input.app.gql({
    query: agentRuntimeControlMutation,
    variables: {
      input: {
        workspaceId: input.hostWorkspaceId,
        runId: input.runId,
        action: 'approve',
        expectedApprovalFingerprint: input.expectedApprovalFingerprint,
      },
    },
  });
  return result.controlCopilotAgentRuntimeRun as RequestedProjectDocWrite & {
    executionResultCount: number;
  };
}

async function createProjectWriteFixture(input: {
  app: TestingApp;
  db: PrismaClient;
  owner: TestUser;
}) {
  const models = input.app.get(Models);
  const docWriter = input.app.get(DocWriter);
  const hostWorkspace = await createWorkspace(input.app);
  const sourceWorkspace = await createWorkspace(input.app);
  await input.db.effectiveWorkspaceQuotaState.upsert({
    where: { workspaceId: sourceWorkspace.id },
    create: {
      workspaceId: sourceWorkspace.id,
      plan: 'free',
      ownerUserId: input.owner.id,
      seatLimit: 100,
      blobLimit: 0,
      storageQuota: 0,
      historyPeriodSeconds: 0,
      known: true,
      stale: false,
    },
    update: {
      ownerUserId: input.owner.id,
      known: true,
      stale: false,
      staleAfter: null,
    },
  });
  const { projectId, sessionId } = await createProjectSession({
    db: input.db,
    owner: input.owner,
    workspaceId: hostWorkspace.id,
  });
  const sharedDoc = await docWriter.createDoc(
    sourceWorkspace.id,
    'Shared project document',
    'Initial shared content.',
    input.owner.id
  );
  const otherDoc = await docWriter.createDoc(
    sourceWorkspace.id,
    'Independent project document',
    'Initial independent content.',
    input.owner.id
  );
  const docReader = input.app.get(DocReader);
  await Promise.all(
    [sharedDoc.docId, otherDoc.docId].map(docId =>
      docReader.getDocMarkdown(sourceWorkspace.id, docId, true)
    )
  );
  for (const docId of [sharedDoc.docId, otherDoc.docId]) {
    const added =
      await models.intelligenceWorkbenchAuthorization.addProjectDocument({
        projectId,
        workspaceId: sourceWorkspace.id,
        docId,
        requesterUserId: input.owner.id,
        requestedLevel: 'write',
      });
    if (added.kind !== 'granted') {
      throw new Error('Expected source owner to create a direct project grant');
    }
  }
  await models.intelligenceWorkbenchAuthorization.setProjectAiPolicy({
    projectId,
    actorUserId: input.owner.id,
    policy: 'read_write',
  });
  return {
    docWriter,
    hostWorkspace,
    models,
    otherDoc,
    projectId,
    sessionId,
    sharedDoc,
    sourceWorkspace,
  };
}

async function createSession(input: {
  db: PrismaClient;
  owner: TestUser;
  workspaceId: string;
}) {
  const promptName = 'workbench-test';
  await input.db.aiPrompt.upsert({
    where: { name: promptName },
    create: {
      action: 'chat',
      config: {},
      model: 'test',
      name: promptName,
      optionalModels: ['test'],
    },
    update: {},
  });
  const sessionId = randomUUID();
  await input.db.$executeRaw`
    INSERT INTO ai_sessions_metadata (
      id,
      user_id,
      workspace_id,
      doc_id,
      prompt_name,
      prompt_action,
      pinned,
      created_at,
      updated_at
    )
    VALUES (
      ${sessionId},
      ${input.owner.id},
      ${input.workspaceId},
      ${null},
      ${promptName},
      ${''},
      ${false},
      ${new Date()},
      ${new Date()}
    )
  `;
  return sessionId;
}

async function seedRuns(input: {
  actorId: string;
  completedAt?: Date;
  count: number;
  db: PrismaClient;
  prefix: string;
  status: 'completed' | 'queued' | 'waiting_approval';
  workspaceId: string;
}) {
  const createdAt = input.completedAt ?? new Date();
  const completedAt = input.status === 'completed' ? createdAt : null;
  const queuedAt = input.status === 'queued' ? createdAt : null;
  await input.db.$executeRaw`
    WITH inserted AS (
      INSERT INTO ai_agent_runs (
        id,
        workspace_id,
        actor_id,
        workflow,
        source_type,
        source_id,
        status,
        title,
        target_fingerprint,
        evidence_fingerprint,
        timeline_fingerprint,
        started_at,
        completed_at,
        failure_code,
        failure_message,
        queued_at,
        created_at,
        updated_at
      )
      SELECT
        ${input.prefix} || '-' || series::text,
        ${input.workspaceId},
        ${input.actorId},
        ${'workbench_cap_test'},
        ${'workbench_cap_test'},
        ${input.prefix} || '-' || series::text,
        ${input.status},
        ${null},
        ${input.prefix},
        ${input.prefix},
        ${input.prefix},
        ${createdAt},
        ${completedAt},
        ${null},
        ${null},
        ${queuedAt},
        ${createdAt},
        ${createdAt}
      FROM generate_series(1, ${input.count}) series
      RETURNING
        id,
        workspace_id,
        actor_id,
        workflow,
        source_type,
        source_id,
        status,
        updated_at
    )
    INSERT INTO ai_agent_timeline_events (
      id,
      run_id,
      step_id,
      workspace_id,
      actor_id,
      event_type,
      status,
      ordinal,
      summary,
      payload,
      event_fingerprint,
      created_at
    )
    SELECT
      id || '-event',
      id,
      ${null},
      workspace_id,
      actor_id,
      ${'run_status'},
      status,
      ${0},
      ${'Seeded workbench boundary run'},
      jsonb_build_object(
        'workflow', workflow,
        'sourceType', source_type,
        'sourceId', source_id
      ),
      id || '-event-fingerprint',
      updated_at
    FROM inserted
  `;
}

test('aggregates accessible workspaces and filters projects through the session chain', async t => {
  const { app, db, owner } = t.context;
  const models = app.get(Models);
  const workspaceX = await createWorkspace(app);

  const workspaceYOwner = await app.createUser();
  await app.login(workspaceYOwner);
  await app.switchUser(workspaceYOwner);
  const workspaceY = await createWorkspace(app);
  await models.workspaceUser.set(
    workspaceY.id,
    owner.id,
    WorkspaceRole.Collaborator,
    { status: WorkspaceMemberStatus.Accepted }
  );
  await app.login(owner);
  await app.switchUser(owner);

  const failedRun = await models.copilotAgentRuntime.createRun({
    workspaceId: workspaceX.id,
    actorId: owner.id,
    workflow: 'workbench_failed_test',
    sourceType: 'workbench_test',
    sourceId: 'failed-x',
    status: 'failed',
    steps: [{ stepKey: 'failed', stepType: 'model' }],
  });
  const approvalRun = await models.copilotAgentRuntime.createRun({
    workspaceId: workspaceY.id,
    actorId: owner.id,
    workflow: 'workbench_approval_test',
    sourceType: 'workbench_test',
    sourceId: 'approval-y',
    status: 'waiting_approval',
    steps: [
      {
        stepKey: 'approval',
        stepType: 'approval',
        status: 'waiting_approval',
      },
    ],
  });
  const transitioningRun = await models.copilotAgentRuntime.createRun({
    workspaceId: workspaceX.id,
    actorId: owner.id,
    workflow: 'agent_runtime_record_only',
    sourceType: 'workbench_test',
    sourceId: 'transition-x',
    status: 'queued',
    steps: [{ stepKey: 'record', stepType: 'model' }],
  });
  const { projectId, sessionId } = await createProjectSession({
    db,
    owner,
    workspaceId: workspaceX.id,
  });
  const projectRun = await models.copilotAgentRuntime.createRun({
    workspaceId: workspaceX.id,
    actorId: owner.id,
    sessionId,
    workflow: 'workbench_project_test',
    sourceType: 'workbench_test',
    sourceId: 'project-x',
    status: 'queued',
    steps: [{ stepKey: 'project', stepType: 'model' }],
  });

  const aggregate = await queryTaskPanel(app);
  const todoIds = aggregate.todo.items.map((item: { id: string }) => item.id);
  t.is(todoIds.length, 2);
  t.true(todoIds.includes(failedRun.id));
  t.true(todoIds.includes(approvalRun.id));
  t.true(
    aggregate.todo.items.some(
      (item: { id: string; workspaceId: string }) =>
        item.id === approvalRun.id && item.workspaceId === workspaceY.id
    )
  );
  t.true(
    aggregate.inProgress.items.some(
      (item: { id: string; workspaceId: string }) =>
        item.id === transitioningRun.id && item.workspaceId === workspaceX.id
    )
  );
  const failedCard = aggregate.todo.items.find(
    (item: { id: string }) => item.id === failedRun.id
  );
  t.deepEqual(failedCard.availableActions, ['resume', 'abandon']);
  t.deepEqual(failedCard.availableActions, failedCard.run.availableActions);
  t.false(
    aggregate.done.items.some(
      (item: { id: string }) => item.id === failedRun.id
    )
  );

  const globalTasks = await queryTasks(app, { limit: 20 });
  t.true(
    globalTasks.some(
      (task: { id: string; workspaceId: string }) =>
        task.id === failedRun.id && task.workspaceId === workspaceX.id
    )
  );
  t.true(
    globalTasks.some(
      (task: { id: string; workspaceId: string }) =>
        task.id === approvalRun.id && task.workspaceId === workspaceY.id
    )
  );
  const filteredGlobalTasks = await queryTasks(app, {
    filter: { status: 'waiting_approval' },
    limit: 1,
  });
  t.deepEqual(
    filteredGlobalTasks.map((task: { id: string }) => task.id),
    [approvalRun.id]
  );
  const workspaceTasks = await queryTasks(app, {
    workspaceId: workspaceX.id,
    limit: 20,
  });
  t.false(
    workspaceTasks.some((task: { id: string }) => task.id === approvalRun.id)
  );

  const projectPanel = await queryTaskPanel(app, projectId);
  t.deepEqual(
    projectPanel.inProgress.items.map((item: { id: string }) => item.id),
    [projectRun.id]
  );
  t.is(projectPanel.inProgress.items[0].projectId, projectId);

  const workerLeaseId = `workbench-${randomUUID()}`;
  const leased = await models.copilotAgentRuntime.acquireStandaloneWorkerLease({
    workspaceId: workspaceX.id,
    id: transitioningRun.id,
    workerId: workerLeaseId,
  });
  t.truthy(leased);
  await models.copilotAgentRuntime.completeStandaloneRecordOnlyExecution({
    workspaceId: workspaceX.id,
    id: transitioningRun.id,
    workerLeaseId,
    workerAttempt: leased!.workerAttempt,
  });
  const afterCompletion = await queryTaskPanel(app);
  t.false(
    afterCompletion.inProgress.items.some(
      (item: { id: string }) => item.id === transitioningRun.id
    )
  );
  t.true(
    afterCompletion.done.items.some(
      (item: { id: string }) => item.id === transitioningRun.id
    )
  );

  const externalMembership = await models.workspaceUser.set(
    workspaceY.id,
    owner.id,
    WorkspaceRole.External
  );
  t.is(externalMembership.type, WorkspaceRole.External);
  t.is(
    await db.workspaceMember.count({
      where: {
        workspaceId: workspaceY.id,
        userId: owner.id,
        state: 'active',
      },
    }),
    0
  );
  const afterWorkspaceRevocation = await queryTaskPanel(app);
  t.false(
    [
      ...afterWorkspaceRevocation.todo.items,
      ...afterWorkspaceRevocation.inProgress.items,
      ...afterWorkspaceRevocation.done.items,
    ].some((item: { id: string }) => item.id === approvalRun.id)
  );
  t.false(
    (await queryTasks(app, { limit: 20 })).some(
      (task: { id: string }) => task.id === approvalRun.id
    )
  );

  await db.aiContextProjectMember.create({
    data: {
      projectId,
      userId: workspaceYOwner.id,
      role: 'owner',
    },
  });
  await db.$executeRaw`
    DELETE FROM ai_context_project_members
    WHERE project_id = ${projectId} AND user_id = ${owner.id}
  `;
  const deniedProjectPanel = await queryTaskPanel(app, projectId);
  t.deepEqual(deniedProjectPanel.todo.items, []);
  t.deepEqual(deniedProjectPanel.inProgress.items, []);
  t.deepEqual(deniedProjectPanel.done.items, []);
  const afterProjectRevocation = await queryTaskPanel(app);
  const unscopedProjectRun = afterProjectRevocation.inProgress.items.find(
    (item: { id: string }) => item.id === projectRun.id
  );
  t.is(unscopedProjectRun.projectId, null);
});

test('enforces task segment caps and the seven-day Done window on the server', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const indexRows = await db.$queryRaw<Array<{ indexName: string }>>`
    SELECT indexname AS "indexName"
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname IN (
        'ai_agent_runs_actor_id_status_updated_at_idx',
        'ai_agent_runs_actor_id_status_completed_at_idx',
        'ai_agent_runs_session_id_idx'
      )
    ORDER BY indexname
  `;
  t.deepEqual(
    indexRows.map(row => row.indexName),
    [
      'ai_agent_runs_actor_id_status_completed_at_idx',
      'ai_agent_runs_actor_id_status_updated_at_idx',
      'ai_agent_runs_session_id_idx',
    ]
  );
  const todoPrefix = `todo-${randomUUID()}`;
  const inProgressPrefix = `progress-${randomUUID()}`;
  const donePrefix = `done-${randomUUID()}`;
  const oldDonePrefix = `old-done-${randomUUID()}`;
  await seedRuns({
    actorId: owner.id,
    count: 51,
    db,
    prefix: todoPrefix,
    status: 'waiting_approval',
    workspaceId: workspace.id,
  });
  await seedRuns({
    actorId: owner.id,
    count: 51,
    db,
    prefix: inProgressPrefix,
    status: 'queued',
    workspaceId: workspace.id,
  });
  await seedRuns({
    actorId: owner.id,
    count: 21,
    db,
    prefix: donePrefix,
    status: 'completed',
    workspaceId: workspace.id,
  });
  await seedRuns({
    actorId: owner.id,
    completedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    count: 1,
    db,
    prefix: oldDonePrefix,
    status: 'completed',
    workspaceId: workspace.id,
  });

  const panel = await queryTaskPanel(app);
  t.is(panel.todo.items.length, 50);
  t.true(panel.todo.capped);
  t.is(panel.inProgress.items.length, 50);
  t.true(panel.inProgress.capped);
  t.is(panel.done.items.length, 20);
  t.true(panel.done.capped);
  t.false(
    panel.done.items.some((item: { id: string }) =>
      item.id.startsWith(oldDonePrefix)
    )
  );
});

test('returns up to 100 full-list tasks while filtering revoked workspaces', async t => {
  const { app, db, owner } = t.context;
  const models = app.get(Models);
  const visibleWorkspace = await createWorkspace(app);
  const revokedWorkspaceOwner = await app.createUser();
  await app.login(revokedWorkspaceOwner);
  await app.switchUser(revokedWorkspaceOwner);
  const revokedWorkspace = await createWorkspace(app);
  await models.workspaceUser.set(
    revokedWorkspace.id,
    owner.id,
    WorkspaceRole.Collaborator,
    { status: WorkspaceMemberStatus.Accepted }
  );
  await app.login(owner);
  await app.switchUser(owner);

  const visiblePrefix = `visible-full-list-${randomUUID()}`;
  const revokedPrefix = `revoked-full-list-${randomUUID()}`;
  await seedRuns({
    actorId: owner.id,
    count: 101,
    db,
    prefix: visiblePrefix,
    status: 'queued',
    workspaceId: visibleWorkspace.id,
  });
  await seedRuns({
    actorId: owner.id,
    count: 1,
    db,
    prefix: revokedPrefix,
    status: 'queued',
    workspaceId: revokedWorkspace.id,
  });
  await models.workspaceUser.set(
    revokedWorkspace.id,
    owner.id,
    WorkspaceRole.External
  );

  const requestedFullList = await queryTasks(app, {
    filter: { status: 'queued' },
    limit: 100,
  });
  t.is(requestedFullList.length, 100);
  t.true(
    requestedFullList.every(
      (task: { workspaceId: string }) =>
        task.workspaceId === visibleWorkspace.id
    )
  );
  t.false(
    requestedFullList.some(
      (task: { id: string }) => task.id === `${revokedPrefix}-1`
    )
  );

  const workspaceFullList = await queryTasks(app, {
    workspaceId: visibleWorkspace.id,
    filter: { status: 'queued' },
    limit: 100,
  });
  t.is(workspaceFullList.length, 100);
  t.true(
    workspaceFullList.every(
      (task: { workspaceId: string }) =>
        task.workspaceId === visibleWorkspace.id
    )
  );

  const clampedFullList = await queryTasks(app, {
    filter: { status: 'queued' },
    limit: 1_000,
  });
  t.is(clampedFullList.length, 100);
  t.true(
    clampedFullList.every(
      (task: { workspaceId: string }) =>
        task.workspaceId === visibleWorkspace.id
    )
  );
});

test('workbench history paginates past 100 with server filters, stable ties, independent detail and live ACL', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const models = app.get(Models);
  const { projectId } = await createProjectSession({
    db,
    owner,
    workspaceId: workspace.id,
  });
  const now = new Date();
  await seedRuns({
    actorId: owner.id,
    count: 101,
    db,
    prefix: 'history-active',
    status: 'queued',
    workspaceId: workspace.id,
    completedAt: now,
  });
  await seedRuns({
    actorId: owner.id,
    count: 1,
    db,
    prefix: 'history-old-approval',
    status: 'waiting_approval',
    workspaceId: workspace.id,
    completedAt: new Date(now.getTime() - 30 * 86400000),
  });
  await db.$executeRaw`
    INSERT INTO ai_context_project_blockers (id, project_id, creator_user_id, creator_user_id_snapshot, title, type, waiting_on, status, origin, created_at, updated_at)
    VALUES ('history-blocker', ${projectId}, ${owner.id}, ${owner.id}, 'History reminder', 'custom', 'Reviewer', 'waiting', 'user_created', ${now}, ${now})
  `;
  const found: string[] = [];
  let cursor: string | null = null;
  do {
    const result = await app.gql({
      query: taskHistoryQuery,
      variables: { filter: 'all', limit: 10, cursor },
    });
    const page: { items: Array<{ id: string }>; nextCursor: string | null } =
      result.currentUser.copilot.workbenchTasks;
    t.true(page.items.length <= 10);
    found.push(...page.items.map((item: { id: string }) => item.id));
    cursor = page.nextCursor;
    t.true(
      found.length <= 103,
      'seek cursor must advance without repeating rows'
    );
  } while (cursor && found.length <= 103);
  t.is(found.length, 103);
  t.is(new Set(found).size, 103);
  t.is(
    found[101],
    'blocker:history-blocker',
    'same-time kinds follow the stable cursor order'
  );
  const approval = await app.gql({
    query: taskHistoryQuery,
    variables: { filter: 'approval', limit: 10 },
  });
  t.deepEqual(
    approval.currentUser.copilot.workbenchTasks.items.map(
      (item: { entityId: string }) => item.entityId
    ),
    ['history-old-approval-1']
  );
  const taskId = `run:${workspace.id}:history-old-approval-1`;
  const detail = await app.gql({
    query: taskDetailQuery,
    variables: { taskId },
  });
  t.is(detail.currentUser.copilot.workbenchTask.id, taskId);
  const first = await app.gql({
    query: taskHistoryQuery,
    variables: { filter: 'all', limit: 1 },
  });
  await t.throwsAsync(
    app.gql({
      query: taskHistoryQuery,
      variables: {
        filter: 'active',
        cursor: first.currentUser.copilot.workbenchTasks.nextCursor,
      },
    })
  );
  await models.workspaceUser.set(
    workspace.id,
    owner.id,
    WorkspaceRole.External
  );
  const denied = await app.gql({
    query: taskDetailQuery,
    variables: { taskId },
  });
  t.is(denied.currentUser.copilot.workbenchTask, null);
  const revoked = await app.gql({
    query: taskHistoryQuery,
    variables: { filter: 'active' },
  });
  t.deepEqual(revoked.currentUser.copilot.workbenchTasks.items, []);
});

test('abandons only failed tasks, marks Done, and keeps retries idempotent', async t => {
  const { app, db, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const firstSessionId = await createSession({
    db,
    owner,
    workspaceId: workspace.id,
  });
  const secondSessionId = await createSession({
    db,
    owner,
    workspaceId: workspace.id,
  });
  const queuedForFailure = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    sessionId: firstSessionId,
    workflow: 'workbench_abandon_test',
    sourceType: 'workbench_test',
    sourceId: 'abandon-failed',
    status: 'queued',
    steps: [{ stepKey: 'failed', stepType: 'model' }],
  });
  const failureWorkerLeaseId = `workbench-failure-${randomUUID()}`;
  const leasedForFailure =
    await models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workspaceId: workspace.id,
      id: queuedForFailure.id,
      workerId: failureWorkerLeaseId,
    });
  const failedRun =
    await models.copilotAgentRuntime.failStandaloneWorkerExecution({
      workspaceId: workspace.id,
      id: queuedForFailure.id,
      workerLeaseId: failureWorkerLeaseId,
      workerAttempt: leasedForFailure!.workerAttempt,
      code: 'workbench_test_failure',
      message: 'Workbench test failure evidence',
    });
  t.is(failedRun.sessionId, firstSessionId);
  const invalidAbandonAt = new Date(Date.now() + 1_000);
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET
        status = ${'cancelled'},
        completed_at = ${invalidAbandonAt},
        queued_at = ${null},
        worker_lease_id = ${null},
        worker_lease_expires_at = ${null},
        updated_at = ${invalidAbandonAt}
      WHERE workspace_id = ${workspace.id}
        AND id = ${failedRun.id}
    `,
    { message: /ai_agent_runs_abandon_timeline_required_check/ }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET failure_message = ${'Drifted failure evidence'}
      WHERE workspace_id = ${workspace.id}
        AND id = ${failedRun.id}
    `,
    {
      message:
        /ai_agent_runs_execution_result_terminal_snapshot_check|ai_agent_runs_terminal_result_update_restrict_check/,
    }
  );
  const guardedFailure = await models.copilotAgentRuntime.get(
    workspace.id,
    failedRun.id
  );
  t.is(guardedFailure!.status, 'failed');
  t.is(guardedFailure!.failureMessage, 'Workbench test failure evidence');
  await t.throwsAsync(
    models.copilotAgentRuntime.createRun({
      workspaceId: workspace.id,
      actorId: owner.id,
      sessionId: secondSessionId,
      workflow: 'workbench_abandon_test',
      sourceType: 'workbench_test',
      sourceId: 'abandon-failed',
      status: 'failed',
      steps: [{ stepKey: 'failed', stepType: 'model' }],
    }),
    {
      message: 'Agent runtime run conflict reused mismatched create session',
    }
  );

  const before = await models.copilotAgentRuntime.get(
    workspace.id,
    failedRun.id
  );
  const abandonedResult = await app.gql({
    query: taskControlMutation,
    variables: {
      input: {
        action: 'abandon',
        taskId: failedRun.id,
        workspaceId: workspace.id,
      },
    },
  });
  const abandoned = abandonedResult.controlCopilotTask;
  t.is(abandoned.status, 'cancelled');
  t.true(abandoned.abandoned);
  t.deepEqual(abandoned.availableActions, []);

  const persisted = await models.copilotAgentRuntime.get(
    workspace.id,
    failedRun.id
  );
  t.is(persisted!.failureCode, 'workbench_test_failure');
  t.is(persisted!.failureMessage, 'Workbench test failure evidence');
  t.is(persisted!.timelineEvents.length, before!.timelineEvents.length + 1);
  t.is(
    persisted!.timelineEvents[persisted!.timelineEvents.length - 1].payload
      .action,
    'abandon'
  );

  const repeatedResult = await app.gql({
    query: taskControlMutation,
    variables: {
      input: {
        action: 'abandon',
        taskId: failedRun.id,
        workspaceId: workspace.id,
      },
    },
  });
  t.true(repeatedResult.controlCopilotTask.abandoned);
  const repeated = await models.copilotAgentRuntime.get(
    workspace.id,
    failedRun.id
  );
  t.is(repeated!.timelineEvents.length, persisted!.timelineEvents.length);
  await t.throwsAsync(
    app.gql({
      query: taskControlMutation,
      variables: {
        input: {
          action: 'resume',
          taskId: failedRun.id,
          workspaceId: workspace.id,
        },
      },
    }),
    { message: 'Agent runtime abandoned run cannot be resumed' }
  );

  const panel = await queryTaskPanel(app);
  t.false(
    panel.todo.items.some((item: { id: string }) => item.id === failedRun.id)
  );
  const doneCard = panel.done.items.find(
    (item: { id: string }) => item.id === failedRun.id
  );
  t.truthy(doneCard);
  t.true(doneCard.run.abandoned);

  const queuedRun = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'workbench_abandon_reject_test',
    sourceType: 'workbench_test',
    sourceId: 'abandon-queued',
    status: 'queued',
    steps: [{ stepKey: 'queued', stepType: 'model' }],
  });
  await t.throwsAsync(
    app.gql({
      query: taskControlMutation,
      variables: {
        input: {
          action: 'abandon',
          taskId: queuedRun.id,
          workspaceId: workspace.id,
        },
      },
    }),
    { message: /cannot be abandoned from status: queued/ }
  );

  const foreignWorkspace = await createWorkspace(app);
  await t.throwsAsync(
    models.copilotAgentRuntime.createRun({
      workspaceId: foreignWorkspace.id,
      actorId: owner.id,
      sessionId: firstSessionId,
      workflow: 'workbench_session_scope_test',
      sourceType: 'workbench_test',
      sourceId: 'wrong-session-workspace',
      steps: [{ stepKey: 'wrong-session', stepType: 'model' }],
    }),
    {
      message:
        'Agent runtime session must be active and match its actor and workspace',
    }
  );
});

test('formal project write creation fails closed before persisting for policy, grant, and missing-version denials', async t => {
  const { app, db, owner } = t.context;
  const fixture = await createProjectWriteFixture({ app, db, owner });
  await fixture.models.intelligenceWorkbenchAuthorization.setProjectAiPolicy({
    projectId: fixture.projectId,
    actorUserId: owner.id,
    policy: 'read_only',
  });
  await t.throwsAsync(
    requestProjectDocWrite({
      app,
      sourceWorkspaceId: fixture.sourceWorkspace.id,
      sessionId: fixture.sessionId,
      docId: fixture.sharedDoc.docId,
      content: 'This must not be persisted.',
      idempotencyKey: `policy-denied-${randomUUID()}`,
    }),
    { message: /project_policy_denied/ }
  );
  t.is(await db.aiAgentRun.count(), 0);

  await fixture.models.intelligenceWorkbenchAuthorization.setProjectAiPolicy({
    projectId: fixture.projectId,
    actorUserId: owner.id,
    policy: 'read_write',
  });
  const alternate = await createProjectSession({
    db,
    owner,
    workspaceId: fixture.hostWorkspace.id,
  });
  await t.throwsAsync(
    db.aiSession.update({
      where: { id: fixture.sessionId },
      data: { selectedContextProjectId: alternate.projectId },
    })
  );
  await t.throwsAsync(
    requestProjectDocWrite({
      app,
      sourceWorkspaceId: fixture.sourceWorkspace.id,
      sessionId: alternate.sessionId,
      docId: fixture.sharedDoc.docId,
      content: 'This project has no grant.',
      idempotencyKey: `grant-denied-${randomUUID()}`,
    }),
    { message: /grant_denied/ }
  );
  t.is(await db.aiAgentRun.count(), 0);

  await t.throwsAsync(
    app.gql({
      query: agentRuntimeDocUpdateRequestMutation,
      variables: {
        input: {
          workspaceId: fixture.sourceWorkspace.id,
          docId: `missing-${randomUUID()}`,
          content: 'A missing document has no version to approve.',
        },
      },
    }),
    { message: /document does not exist/ }
  );
  t.is(await db.aiAgentRun.count(), 0);
});

test('Workbench chat exposes explicit cross-workspace reads and approval-gated project writes', async t => {
  const { app, db, owner } = t.context;
  const fixture = await createProjectWriteFixture({ app, db, owner });
  const runtime = app.get(ToolRuntime);
  const reader = app.get(DocReader);
  let tools = await runtime.getTools(
    {
      tools: ['docRead', 'docUpdate'],
      user: owner.id,
      session: fixture.sessionId,
      workspace: fixture.hostWorkspace.id,
      featureKind: 'chat',
    },
    'test'
  );
  t.deepEqual(Object.keys(tools).sort(), [
    'project_doc_read',
    'project_doc_update_request',
  ]);
  t.false('doc_read' in tools);
  t.false('doc_update' in tools);

  const initialRead = (await tools.project_doc_read.execute?.(
    {
      source_workspace_id: fixture.sourceWorkspace.id,
      doc_id: fixture.sharedDoc.docId,
    },
    {}
  )) as Record<string, unknown>;
  t.like(initialRead, {
    projectId: fixture.projectId,
    sourceWorkspaceId: fixture.sourceWorkspace.id,
    docId: fixture.sharedDoc.docId,
  });
  t.regex(initialRead.markdown as string, /Initial shared content/);

  await fixture.models.intelligenceWorkbenchAuthorization.setProjectAiPolicy({
    projectId: fixture.projectId,
    actorUserId: owner.id,
    policy: 'read_only',
  });
  const policyDenied = (await tools.project_doc_update_request.execute?.(
    {
      source_workspace_id: fixture.sourceWorkspace.id,
      doc_id: fixture.sharedDoc.docId,
      content: 'Policy denied content.',
    },
    {}
  )) as Record<string, unknown>;
  t.like(policyDenied, { type: 'error' });
  t.regex(policyDenied.message as string, /project_policy_denied/);
  t.is(await db.aiAgentRun.count(), 0);

  const freshTools = async () => {
    const session = await db.aiSession.findUniqueOrThrow({
      where: { id: fixture.sessionId },
    });
    fixture.sessionId = await fixture.models.copilotSession.create({
      sessionId: randomUUID(),
      userId: owner.id,
      workspaceId: fixture.hostWorkspace.id,
      selectedContextProjectId: fixture.projectId,
      title: null,
      promptName: session.promptName,
      promptAction: session.promptAction,
    });
    return await runtime.getTools(
      {
        tools: ['docRead', 'docUpdate'],
        user: owner.id,
        session: fixture.sessionId,
        workspace: fixture.hostWorkspace.id,
        featureKind: 'chat',
      },
      'test'
    );
  };
  tools = await freshTools();
  await fixture.models.intelligenceWorkbenchAuthorization.setProjectAiPolicy({
    projectId: fixture.projectId,
    actorUserId: owner.id,
    policy: 'read_write',
  });
  const readOnlyDoc = await fixture.docWriter.createDoc(
    fixture.sourceWorkspace.id,
    'Read-only project document',
    'This grant cannot authorize a write.',
    owner.id
  );
  const readGrant =
    await fixture.models.intelligenceWorkbenchAuthorization.addProjectDocument({
      projectId: fixture.projectId,
      workspaceId: fixture.sourceWorkspace.id,
      docId: readOnlyDoc.docId,
      requesterUserId: owner.id,
      requestedLevel: 'read',
    });
  t.is(readGrant.kind, 'granted');
  const grantDenied = (await tools.project_doc_update_request.execute?.(
    {
      source_workspace_id: fixture.sourceWorkspace.id,
      doc_id: readOnlyDoc.docId,
      content: 'A read grant must not become a write.',
    },
    {}
  )) as Record<string, unknown>;
  t.like(grantDenied, { type: 'error' });
  t.regex(grantDenied.message as string, /grant_denied/);
  t.is(await db.aiAgentRun.count(), 0);

  tools = await freshTools();
  const requested = (await tools.project_doc_update_request.execute?.(
    {
      source_workspace_id: fixture.sourceWorkspace.id,
      doc_id: fixture.sharedDoc.docId,
      content: 'Created from the Workbench conversation tool.',
      idempotency_key: `workbench-tool-${randomUUID()}`,
    },
    {}
  )) as Record<string, unknown>;
  t.like(requested, {
    success: true,
    approvalRequired: true,
    status: 'waiting_approval',
    hostWorkspaceId: fixture.hostWorkspace.id,
    sourceWorkspaceId: fixture.sourceWorkspace.id,
    docId: fixture.sharedDoc.docId,
  });
  const unchanged = await reader.getDocMarkdown(
    fixture.sourceWorkspace.id,
    fixture.sharedDoc.docId,
    true
  );
  t.regex(unchanged!.markdown, /Initial shared content/);
  t.false(unchanged!.markdown.includes('Created from the Workbench'));

  const runId = requested.runId as string;
  const persisted = await fixture.models.copilotAgentRuntime.get(
    fixture.hostWorkspace.id,
    runId
  );
  const frozenRequest = persisted!.steps.find(step => step.stepType === 'tool')!
    .outputSummary.docUpdateRequest as Record<string, unknown>;
  t.like(frozenRequest, {
    projectId: fixture.projectId,
    sourceWorkspaceId: fixture.sourceWorkspace.id,
    docId: fixture.sharedDoc.docId,
  });

  const alternate = await createProjectSession({
    db,
    owner,
    workspaceId: fixture.hostWorkspace.id,
  });
  await t.throwsAsync(
    db.aiSession.update({
      where: { id: fixture.sessionId },
      data: { selectedContextProjectId: alternate.projectId },
    })
  );
  await approveProjectDocWrite({
    app,
    hostWorkspaceId: fixture.hostWorkspace.id,
    runId,
  });
  t.is(
    await app.get(CopilotAgentRuntimeWorker).runStandaloneAgentRuntime({
      workspaceId: fixture.hostWorkspace.id,
      runId,
    }),
    JOB_SIGNAL.Done
  );
  const completed = await fixture.models.copilotAgentRuntime.get(
    fixture.hostWorkspace.id,
    runId
  );
  t.is(completed!.status, 'completed');
  const updated = await reader.getDocMarkdown(
    fixture.sourceWorkspace.id,
    fixture.sharedDoc.docId,
    true
  );
  t.regex(updated!.markdown, /Created from the Workbench conversation tool/);
});

test('project search respects personal ACL and active grants while preserving document pairs', async t => {
  const { app, db, owner } = t.context;
  const fixture = await createProjectWriteFixture({ app, db, owner });
  const hostOnlyDoc = await fixture.docWriter.createDoc(
    fixture.hostWorkspace.id,
    'Host only document',
    'host-only-search-secret',
    owner.id
  );
  const otherProject = await createProjectSession({
    db,
    owner,
    workspaceId: fixture.hostWorkspace.id,
  });
  const otherProjectDoc = await fixture.docWriter.createDoc(
    fixture.sourceWorkspace.id,
    'Other project document',
    'other-project-search-secret',
    owner.id
  );
  const otherGrant =
    await fixture.models.intelligenceWorkbenchAuthorization.addProjectDocument({
      projectId: otherProject.projectId,
      workspaceId: fixture.sourceWorkspace.id,
      docId: otherProjectDoc.docId,
      requesterUserId: owner.id,
      requestedLevel: 'read',
    });
  t.is(otherGrant.kind, 'granted');

  const pairDocId = `paired-${randomUUID()}`;
  await app.login(owner);
  await app.switchUser(owner);
  const pairWorkspaces = await Promise.all([
    createWorkspace(app),
    createWorkspace(app),
  ]);
  await Promise.all(
    pairWorkspaces.map(workspace =>
      db.effectiveWorkspaceQuotaState.upsert({
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
        update: {
          ownerUserId: owner.id,
          known: true,
          stale: false,
          staleAfter: null,
        },
      })
    )
  );
  await Promise.all(
    pairWorkspaces.map((workspace, index) =>
      fixture.docWriter.createDoc(
        workspace.id,
        `Paired document ${index + 1}`,
        `paired-duplicate-needle ${index + 1}`,
        owner.id,
        pairDocId
      )
    )
  );
  for (const workspace of pairWorkspaces) {
    const grant =
      await fixture.models.intelligenceWorkbenchAuthorization.addProjectDocument(
        {
          projectId: fixture.projectId,
          workspaceId: workspace.id,
          docId: pairDocId,
          requesterUserId: owner.id,
          requestedLevel: 'read',
        }
      );
    t.is(grant.kind, 'granted');
  }

  const semanticSearch = Sinon.stub(
    app.get(CopilotContextService),
    'matchWorkspaceProjectDocs'
  ).callsFake(async (workspaceId, docIds, ...args) => {
    t.is(args[5], fixture.projectId);
    return docIds.map((docId, index) => ({
      docId,
      chunk: index,
      content: `semantic ${workspaceId} ${docId}`,
      distance: index / 100,
    }));
  });
  const tools = await app.get(ToolRuntime).getTools(
    {
      tools: ['docKeywordSearch', 'docSemanticSearch', 'office'],
      user: owner.id,
      session: fixture.sessionId,
      workspace: fixture.hostWorkspace.id,
      featureKind: 'chat',
    },
    'test'
  );
  t.deepEqual(Object.keys(tools).sort(), [
    'doc_keyword_search',
    'doc_semantic_search',
  ]);

  const keywordSearch = async (query: string, limit = 20) =>
    (await tools.doc_keyword_search.execute?.({ query, limit }, {})) as Array<{
      sourceWorkspaceId: string;
      docId: string;
    }>;
  const crossWorkspace = await keywordSearch('Initial shared content');
  t.true(
    crossWorkspace.some(
      result =>
        result.sourceWorkspaceId === fixture.sourceWorkspace.id &&
        result.docId === fixture.sharedDoc.docId
    )
  );
  t.deepEqual(await keywordSearch('host-only-search-secret'), []);
  t.deepEqual(await keywordSearch('other-project-search-secret'), []);

  const paired = await keywordSearch('paired-duplicate-needle');
  t.is(paired.length, 2);
  t.deepEqual(
    new Set(paired.map(result => result.docId)),
    new Set([pairDocId])
  );
  const pairedWorkspaceIds = new Set(
    paired.map(result => result.sourceWorkspaceId)
  );
  t.is(pairedWorkspaceIds.size, 2);
  t.true(
    pairWorkspaces.every(workspace => pairedWorkspaceIds.has(workspace.id))
  );
  t.is((await keywordSearch('paired-duplicate-needle', 1)).length, 1);

  const semantic = (await tools.doc_semantic_search.execute?.(
    { query: 'project scope' },
    {}
  )) as Array<{ sourceWorkspaceId: string; docId: string }>;
  t.true(semantic.length > 0);
  t.false(
    semantic.some(
      result =>
        result.sourceWorkspaceId === fixture.hostWorkspace.id &&
        result.docId === hostOnlyDoc.docId
    )
  );
  t.false(
    semantic.some(
      result =>
        result.sourceWorkspaceId === fixture.sourceWorkspace.id &&
        result.docId === otherProjectDoc.docId
    )
  );
  for (const call of semanticSearch.getCalls()) {
    const readable = await app
      .get(PermissionAccess)
      .user(owner.id)
      .workspace(call.args[0])
      .projectScope(fixture.projectId)
      .docs(
        call.args[1].map(docId => ({ docId })),
        'Doc.Read'
      );
    t.deepEqual(
      readable.map(doc => doc.docId),
      call.args[1]
    );
  }
  t.true(
    semanticSearch
      .getCalls()
      .every(
        call =>
          call.args[0] !== fixture.sourceWorkspace.id ||
          !call.args[1].includes(otherProjectDoc.docId)
      )
  );

  await fixture.models.intelligenceWorkbenchAuthorization.revokeProjectGrant({
    projectId: fixture.projectId,
    workspaceId: pairWorkspaces[0].id,
    docId: pairDocId,
    actorUserId: owner.id,
  });
  const afterRevoke = await keywordSearch('paired-duplicate-needle');
  t.is(afterRevoke.length, 2);
  t.deepEqual(
    afterRevoke.map(result => result.sourceWorkspaceId).sort(),
    pairWorkspaces.map(workspace => workspace.id).sort()
  );
  t.true(
    await app
      .get(PermissionAccess)
      .user(owner.id)
      .workspace(pairWorkspaces[0].id)
      .projectScope(null)
      .doc(pairDocId)
      .can('Doc.Read')
  );
});

test('project search denies a host-workspace user who is not a project member', async t => {
  const { app, db, owner } = t.context;
  const fixture = await createProjectWriteFixture({ app, db, owner });
  const outsider = await app.createUser();
  await fixture.models.workspaceUser.set(
    fixture.hostWorkspace.id,
    outsider.id,
    WorkspaceRole.Collaborator,
    { status: WorkspaceMemberStatus.Accepted }
  );
  const outsiderSessionId = await createSession({
    db,
    owner: outsider,
    workspaceId: fixture.hostWorkspace.id,
  });
  await db.aiContextProjectMember.create({
    data: {
      projectId: fixture.projectId,
      userId: outsider.id,
      role: 'member',
    },
  });
  await db.aiSession.update({
    where: { id: outsiderSessionId },
    data: { selectedContextProjectId: fixture.projectId },
  });
  await db.aiContextProjectMember.delete({
    where: {
      projectId_userId: {
        projectId: fixture.projectId,
        userId: outsider.id,
      },
    },
  });
  const tools = await app.get(ToolRuntime).getTools(
    {
      tools: ['docKeywordSearch'],
      user: outsider.id,
      session: outsiderSessionId,
      workspace: fixture.hostWorkspace.id,
      featureKind: 'chat',
    },
    'test'
  );
  await t.throwsAsync(
    async () =>
      tools.doc_keyword_search.execute?.(
        { query: 'Initial shared content', limit: 20 },
        {}
      ),
    { message: 'Project membership is no longer active.' }
  );
});

test('legacy Agent Runtime APIs hide and deny another users project write proposal', async t => {
  const { app, db, owner } = t.context;
  const fixture = await createProjectWriteFixture({ app, db, owner });
  const requested = await requestProjectDocWrite({
    app,
    sourceWorkspaceId: fixture.sourceWorkspace.id,
    sessionId: fixture.sessionId,
    docId: fixture.sharedDoc.docId,
    content: 'Only the requesting user may inspect or approve this proposal.',
    idempotencyKey: `legacy-boundary-${randomUUID()}`,
  });
  const otherWorkspaceMember = await app.createUser();
  await fixture.models.workspaceUser.set(
    fixture.hostWorkspace.id,
    otherWorkspaceMember.id,
    WorkspaceRole.Collaborator,
    { status: WorkspaceMemberStatus.Accepted }
  );
  await app.login(otherWorkspaceMember);
  await app.switchUser(otherWorkspaceMember);

  const denied = await app.gql({
    query: legacyAgentRuntimeVisibilityQuery,
    variables: {
      workspaceId: fixture.hostWorkspace.id,
      runId: requested.id,
    },
  });
  const deniedCopilot = denied.currentUser.copilot;
  t.false(
    deniedCopilot.agentRuns.some(
      (run: { id: string }) => run.id === requested.id
    )
  );
  t.is(deniedCopilot.agentRun, null);
  await t.throwsAsync(
    app.gql({
      query: agentRuntimeControlMutation,
      variables: {
        input: {
          workspaceId: fixture.hostWorkspace.id,
          runId: requested.id,
          action: 'approve',
        },
      },
    }),
    { message: `Agent runtime run not found: ${requested.id}` }
  );
  t.is(
    (
      await fixture.models.copilotAgentRuntime.get(
        fixture.hostWorkspace.id,
        requested.id
      )
    )?.status,
    'waiting_approval'
  );

  await app.login(owner);
  await app.switchUser(owner);
  const allowed = await app.gql({
    query: legacyAgentRuntimeVisibilityQuery,
    variables: {
      workspaceId: fixture.hostWorkspace.id,
      runId: requested.id,
    },
  });
  t.true(
    allowed.currentUser.copilot.agentRuns.some(
      (run: { id: string }) => run.id === requested.id
    )
  );
  t.is(allowed.currentUser.copilot.agentRun?.id, requested.id);
  t.is(
    (
      await approveProjectDocWrite({
        app,
        hostWorkspaceId: fixture.hostWorkspace.id,
        runId: requested.id,
      })
    ).status,
    'queued'
  );
});

test('project grants authorize member reads without source ACL and revoke fails closed', async t => {
  const { app, db, owner } = t.context;
  const fixture = await createProjectWriteFixture({ app, db, owner });
  const member = await app.createUser();
  const successorOwner = await app.createUser();
  await fixture.models.workspaceUser.set(
    fixture.hostWorkspace.id,
    member.id,
    WorkspaceRole.Collaborator,
    { status: WorkspaceMemberStatus.Accepted }
  );
  await db.aiContextProjectMember.createMany({
    data: [
      { projectId: fixture.projectId, userId: member.id, role: 'member' },
      {
        projectId: fixture.projectId,
        userId: successorOwner.id,
        role: 'owner',
      },
    ],
  });
  const memberSessionId = await createSession({
    db,
    owner: member,
    workspaceId: fixture.hostWorkspace.id,
  });
  await db.aiSession.update({
    where: { id: memberSessionId },
    data: { selectedContextProjectId: fixture.projectId },
  });
  t.is(
    await db.workspaceMember.count({
      where: {
        workspaceId: fixture.sourceWorkspace.id,
        userId: member.id,
        state: 'active',
      },
    }),
    0
  );

  const queuedWrite = await requestProjectDocWrite({
    app,
    sourceWorkspaceId: fixture.sourceWorkspace.id,
    sessionId: fixture.sessionId,
    docId: fixture.sharedDoc.docId,
    content: 'A queued write must not block a project read.',
    idempotencyKey: `queued-during-read-${randomUUID()}`,
  });
  await approveProjectDocWrite({
    app,
    hostWorkspaceId: fixture.hostWorkspace.id,
    runId: queuedWrite.id,
  });
  await fixture.models.intelligenceWorkbenchAuthorization.leaveProject({
    projectId: fixture.projectId,
    userId: owner.id,
  });

  const tools = await app.get(ToolRuntime).getTools(
    {
      tools: ['docRead', 'docKeywordSearch'],
      user: member.id,
      session: memberSessionId,
      workspace: fixture.hostWorkspace.id,
      featureKind: 'chat',
    },
    'test'
  );
  t.deepEqual(Object.keys(tools).sort(), [
    'doc_keyword_search',
    'project_doc_read',
  ]);
  const read = (await tools.project_doc_read.execute?.(
    {
      source_workspace_id: fixture.sourceWorkspace.id,
      doc_id: fixture.sharedDoc.docId,
    },
    {}
  )) as Record<string, unknown>;
  t.like(read, {
    projectId: fixture.projectId,
    sourceWorkspaceId: fixture.sourceWorkspace.id,
    docId: fixture.sharedDoc.docId,
  });
  t.regex(read.markdown as string, /Initial shared content/);
  const search = (await tools.doc_keyword_search.execute?.(
    { query: 'Initial shared content', limit: 20 },
    {}
  )) as Array<{ sourceWorkspaceId: string; docId: string }>;
  t.true(
    search.some(
      result =>
        result.sourceWorkspaceId === fixture.sourceWorkspace.id &&
        result.docId === fixture.sharedDoc.docId
    )
  );

  const scope = await app.get(ContextScopeResolver).resolve({
    userId: member.id,
    workspaceId: fixture.hostWorkspace.id,
    sessionId: memberSessionId,
    selectedProjectId: fixture.projectId,
  });
  t.true(
    scope.readableDocumentRefs.some(
      ref =>
        ref.workspaceId === fixture.sourceWorkspace.id &&
        ref.docId === fixture.sharedDoc.docId
    )
  );

  await fixture.models.intelligenceWorkbenchAuthorization.revokeProjectGrant({
    projectId: fixture.projectId,
    workspaceId: fixture.sourceWorkspace.id,
    docId: fixture.sharedDoc.docId,
    actorUserId: owner.id,
  });
  const denied = (await tools.project_doc_read.execute?.(
    {
      source_workspace_id: fixture.sourceWorkspace.id,
      doc_id: fixture.sharedDoc.docId,
    },
    {}
  )) as Record<string, unknown>;
  t.like(denied, { type: 'error' });
  t.false('docId' in denied);
  t.false('title' in denied);
  const revokedSearch = (await tools.doc_keyword_search.execute?.(
    { query: 'Initial shared content', limit: 20 },
    {}
  )) as Array<{ sourceWorkspaceId: string; docId: string }>;
  t.false(
    revokedSearch.some(
      result =>
        result.sourceWorkspaceId === fixture.sourceWorkspace.id &&
        result.docId === fixture.sharedDoc.docId
    )
  );
  const revokedScope = await app.get(ContextScopeResolver).resolve({
    userId: member.id,
    workspaceId: fixture.hostWorkspace.id,
    sessionId: memberSessionId,
    selectedProjectId: fixture.projectId,
  });
  t.false(
    revokedScope.readableDocumentRefs.some(
      ref =>
        ref.workspaceId === fixture.sourceWorkspace.id &&
        ref.docId === fixture.sharedDoc.docId
    )
  );
});

test('project writes reject private tool sources and recheck source grants after approval', async t => {
  const { app, db, owner } = t.context;
  const fixture = await createProjectWriteFixture({ app, db, owner });
  const source = await fixture.docWriter.createDoc(
    fixture.sourceWorkspace.id,
    'Private source',
    'Private source content.',
    owner.id
  );
  await app
    .get(DocReader)
    .getDocMarkdown(fixture.sourceWorkspace.id, source.docId, true);
  const tools = await app.get(ToolRuntime).getTools(
    {
      tools: ['docRead'],
      user: owner.id,
      workspace: fixture.hostWorkspace.id,
      session: fixture.sessionId,
    },
    'test'
  );
  const result = await tools.project_doc_read.execute?.(
    { source_workspace_id: fixture.sourceWorkspace.id, doc_id: source.docId },
    {}
  );
  t.like(result, {
    sourceWorkspaceId: fixture.sourceWorkspace.id,
    docId: source.docId,
  });
  t.is(
    await db.aiSessionContextSource.count({
      where: {
        sessionId: fixture.sessionId,
        workspaceId: fixture.sourceWorkspace.id,
        kind: 'document',
        sourceId: source.docId,
      },
    }),
    1
  );
  const request = () =>
    requestProjectDocWrite({
      app,
      sourceWorkspaceId: fixture.sourceWorkspace.id,
      sessionId: fixture.sessionId,
      docId: fixture.sharedDoc.docId,
      content: 'Derived authorized content.',
      idempotencyKey: randomUUID(),
    });
  await t.throwsAsync(request(), { message: /private or unverified sources/ });
  t.is(await db.aiAgentRun.count(), 0);
  await fixture.models.intelligenceWorkbenchAuthorization.addProjectDocument({
    projectId: fixture.projectId,
    workspaceId: fixture.sourceWorkspace.id,
    docId: source.docId,
    requesterUserId: owner.id,
    requestedLevel: 'read',
  });
  await t.throwsAsync(request(), { message: /private or unverified sources/ });
  const previous = await db.aiSession.findUniqueOrThrow({
    where: { id: fixture.sessionId },
  });
  fixture.sessionId = await fixture.models.copilotSession.create({
    sessionId: randomUUID(),
    userId: owner.id,
    workspaceId: fixture.hostWorkspace.id,
    selectedContextProjectId: fixture.projectId,
    title: null,
    promptName: previous.promptName,
    promptAction: previous.promptAction,
  });
  await fixture.models.copilotContext.recordDocumentSources({
    sessionId: fixture.sessionId,
    actorId: owner.id,
    projectId: fixture.projectId,
    documents: [
      { workspaceId: fixture.sourceWorkspace.id, docId: source.docId },
    ],
  });
  const authorizedScope = await app.get(ContextScopeResolver).resolve({
    userId: owner.id,
    workspaceId: fixture.hostWorkspace.id,
    sessionId: fixture.sessionId,
    selectedProjectId: fixture.projectId,
  });
  t.deepEqual(authorizedScope.projectIds, [fixture.projectId]);
  const proposed = await request();
  await approveProjectDocWrite({
    app,
    hostWorkspaceId: fixture.hostWorkspace.id,
    runId: proposed.id,
  });
  await fixture.models.intelligenceWorkbenchAuthorization.revokeProjectGrant({
    projectId: fixture.projectId,
    workspaceId: fixture.sourceWorkspace.id,
    docId: source.docId,
    actorUserId: owner.id,
  });
  await app.get(CopilotAgentRuntimeWorker).runStandaloneAgentRuntime({
    workspaceId: fixture.hostWorkspace.id,
    runId: proposed.id,
  });
  const denied = await fixture.models.copilotAgentRuntime.get(
    fixture.hostWorkspace.id,
    proposed.id
  );
  t.is(denied?.status, 'failed');
  t.like(denied?.executionResults[0], { sideEffectsApplied: false });
  const unchanged = await app
    .get(DocReader)
    .getDocMarkdown(fixture.sourceWorkspace.id, fixture.sharedDoc.docId, true);
  t.false(unchanged!.markdown.includes('Derived authorized content.'));
  await fixture.models.intelligenceWorkbenchAuthorization.addProjectDocument({
    projectId: fixture.projectId,
    workspaceId: fixture.sourceWorkspace.id,
    docId: source.docId,
    requesterUserId: owner.id,
    requestedLevel: 'read',
  });
  await t.throwsAsync(request(), { message: /private or unverified sources/ });
});

test('project memory rechecks cumulative sources in its persistence transaction', async t => {
  const { app, db, owner } = t.context;
  const fixture = await createProjectWriteFixture({ app, db, owner });
  const source = await fixture.docWriter.createDoc(
    fixture.sourceWorkspace.id,
    'Private memory source',
    'Private information.',
    owner.id
  );
  const scope = await app.get(ContextScopeResolver).resolve({
    userId: owner.id,
    workspaceId: fixture.hostWorkspace.id,
    sessionId: fixture.sessionId,
    selectedProjectId: fixture.projectId,
  });
  t.deepEqual(scope.projectIds, [fixture.projectId]);
  await fixture.models.copilotContext.recordDocumentSources({
    sessionId: fixture.sessionId,
    actorId: owner.id,
    projectId: fixture.projectId,
    documents: [
      { workspaceId: fixture.sourceWorkspace.id, docId: source.docId },
    ],
  });
  const write = () =>
    fixture.models.copilotContextMemory.applyWriterDecision({
      ownerUserId: owner.id,
      workspaceId: fixture.hostWorkspace.id,
      projectId: fixture.projectId,
      sourceSessionId: fixture.sessionId,
      sourceDocuments: [
        {
          workspaceId: fixture.sourceWorkspace.id,
          docId: fixture.sharedDoc.docId,
        },
      ],
      scope: 'project',
      explicit: true,
      writerVersion: 'structured-memory-writer/test',
      decisionFingerprint: randomUUID(),
      decision: {
        operation: 'ADD',
        factKey: `test:${randomUUID()}`,
        content: 'Remember the authorized project fact.',
        confidence: 1,
        importance: 0.8,
        sensitivity: 'private',
        validFrom: new Date(),
        validUntil: null,
        expiresAt: null,
        reasonCode: 'explicit_request',
      },
    });
  await t.throwsAsync(write(), { message: /private or unverified sources/ });
  t.is(
    await db.aiContextMemory.count({ where: { projectId: fixture.projectId } }),
    0
  );
  await fixture.models.intelligenceWorkbenchAuthorization.addProjectDocument({
    projectId: fixture.projectId,
    workspaceId: fixture.sourceWorkspace.id,
    docId: source.docId,
    requesterUserId: owner.id,
    requestedLevel: 'read',
  });
  await t.throwsAsync(write(), { message: /private or unverified sources/ });
  const previous = await db.aiSession.findUniqueOrThrow({
    where: { id: fixture.sessionId },
  });
  fixture.sessionId = await fixture.models.copilotSession.create({
    sessionId: randomUUID(),
    userId: owner.id,
    workspaceId: fixture.hostWorkspace.id,
    selectedContextProjectId: fixture.projectId,
    title: null,
    promptName: previous.promptName,
    promptAction: previous.promptAction,
  });
  await fixture.models.copilotContext.recordDocumentSources({
    sessionId: fixture.sessionId,
    actorId: owner.id,
    projectId: fixture.projectId,
    documents: [
      { workspaceId: fixture.sourceWorkspace.id, docId: source.docId },
    ],
  });
  const event = await write();
  t.truthy(event.memoryId);
  const recalled = await db.aiContextMemory.findUniqueOrThrow({
    where: { id: event.memoryId! },
  });
  const provenance = {
    sessionId: fixture.sessionId,
    actorId: owner.id,
    projectId: fixture.projectId,
    sink: {
      type: 'document_update' as const,
      id: fixture.sharedDoc.docId,
      workspaceId: fixture.sourceWorkspace.id,
      phase: 'execute' as const,
    },
  };
  await fixture.models.copilotContext.recordRecalledMemorySources({
    ...provenance,
    workspaceId: fixture.hostWorkspace.id,
    memories: [{ id: recalled.id, content: recalled.content }],
  });
  await fixture.models.copilotContext.assertProjectSourcesShared(provenance);
  await db.aiContextMemory.update({
    where: { id: recalled.id },
    data: { expiresAt: new Date(Date.now() - 1) },
  });
  await t.throwsAsync(
    fixture.models.copilotContext.assertProjectSourcesShared(provenance)
  );
  await db.aiContextMemory.update({
    where: { id: recalled.id },
    data: { expiresAt: null },
  });
  t.is(
    await db.aiContextMemorySource.count({
      where: { memoryId: event.memoryId! },
    }),
    2
  );
  await fixture.models.intelligenceWorkbenchAuthorization.revokeProjectGrant({
    projectId: fixture.projectId,
    workspaceId: fixture.sourceWorkspace.id,
    docId: source.docId,
    actorUserId: owner.id,
  });
  await t.throwsAsync(write(), { message: /private or unverified sources/ });
  t.like(await fixture.models.copilotContextMemory.get(event.memoryId!), {
    status: 'disabled',
    quarantineReason: 'project_grant_revoked',
  });
  t.is(
    await db.aiContextMemory.count({ where: { projectId: fixture.projectId } }),
    1
  );
});

test('formal project writes freeze their principal and use FIFO without serializing reads or other documents', async t => {
  const { app, db, owner } = t.context;
  const fixture = await createProjectWriteFixture({ app, db, owner });
  const first = await requestProjectDocWrite({
    app,
    sourceWorkspaceId: fixture.sourceWorkspace.id,
    sessionId: fixture.sessionId,
    docId: fixture.sharedDoc.docId,
    content: 'First queued project update.',
    idempotencyKey: `first-${randomUUID()}`,
  });
  const second = await requestProjectDocWrite({
    app,
    sourceWorkspaceId: fixture.sourceWorkspace.id,
    sessionId: fixture.sessionId,
    docId: fixture.sharedDoc.docId,
    content: 'Second queued project update.',
    idempotencyKey: `second-${randomUUID()}`,
  });
  const independent = await requestProjectDocWrite({
    app,
    sourceWorkspaceId: fixture.sourceWorkspace.id,
    sessionId: fixture.sessionId,
    docId: fixture.otherDoc.docId,
    content: 'Independent queued project update.',
    idempotencyKey: `independent-${randomUUID()}`,
  });
  const frozenRequest = first.steps.find(step => step.stepType === 'tool')!
    .outputSummary.docUpdateRequest as Record<string, unknown>;
  t.is(first.workspaceId, fixture.hostWorkspace.id);
  t.like(frozenRequest, {
    projectId: fixture.projectId,
    sourceWorkspaceId: fixture.sourceWorkspace.id,
    docId: fixture.sharedDoc.docId,
  });
  t.is(typeof frozenRequest.expectedDocumentVersion, 'string');

  const alternate = await createProjectSession({
    db,
    owner,
    workspaceId: fixture.hostWorkspace.id,
  });
  await t.throwsAsync(
    db.aiSession.update({
      where: { id: fixture.sessionId },
      data: { selectedContextProjectId: alternate.projectId },
    })
  );

  for (const run of [first, second, independent]) {
    const approved = await approveProjectDocWrite({
      app,
      hostWorkspaceId: fixture.hostWorkspace.id,
      runId: run.id,
    });
    t.is(approved.status, 'queued');
  }
  const read = await fixture.models.copilotAgentRuntime.createRun({
    workspaceId: fixture.hostWorkspace.id,
    actorId: owner.id,
    sessionId: fixture.sessionId,
    workflow: 'intelligence_workbench_project_read',
    sourceType: 'intelligence_workbench_d5_test',
    sourceId: `read-${randomUUID()}`,
    status: 'queued',
    target: {
      operation: 'read',
      projectId: fixture.projectId,
      sourceWorkspaceId: fixture.sourceWorkspace.id,
      docId: fixture.sharedDoc.docId,
    },
    steps: [
      {
        stepKey: 'read',
        stepType: 'tool',
        status: 'pending',
        outputSummary: {
          projectOperation: {
            operation: 'read',
            projectId: fixture.projectId,
            sourceWorkspaceId: fixture.sourceWorkspace.id,
            docId: fixture.sharedDoc.docId,
          },
        },
      },
    ],
  });

  const firstLease =
    await fixture.models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workspaceId: fixture.hostWorkspace.id,
      id: first.id,
      workerId: 'first-project-writer',
    });
  t.truthy(firstLease);
  const outOfOrderLease =
    await fixture.models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workspaceId: fixture.hostWorkspace.id,
      id: second.id,
      workerId: 'second-project-writer-early',
    });
  t.is(outOfOrderLease, null);

  const independentLease =
    await fixture.models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workspaceId: fixture.hostWorkspace.id,
      id: independent.id,
      workerId: 'independent-project-writer',
    });
  t.truthy(
    independentLease,
    'writes to another document remain concurrently leaseable'
  );
  const readLease =
    await fixture.models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workspaceId: fixture.hostWorkspace.id,
      id: read.id,
      workerId: 'concurrent-project-reader',
    });
  t.truthy(readLease, 'reads of the same document are not serialized');

  for (const leased of [
    { run: first, lease: firstLease!, workerId: 'first-project-writer' },
    {
      run: independent,
      lease: independentLease!,
      workerId: 'independent-project-writer',
    },
    { run: read, lease: readLease!, workerId: 'concurrent-project-reader' },
  ]) {
    await fixture.models.copilotAgentRuntime.failStandaloneWorkerExecution({
      workspaceId: fixture.hostWorkspace.id,
      id: leased.run.id,
      workerLeaseId: leased.workerId,
      workerAttempt: leased.lease.workerAttempt,
      code: 'd5_test_complete',
      message: 'D5 concurrency behavior proved without applying side effects',
    });
  }
  const secondLease =
    await fixture.models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workspaceId: fixture.hostWorkspace.id,
      id: second.id,
      workerId: 'second-project-writer',
    });
  t.truthy(secondLease);
  await fixture.models.copilotAgentRuntime.failStandaloneWorkerExecution({
    workspaceId: fixture.hostWorkspace.id,
    id: second.id,
    workerLeaseId: 'second-project-writer',
    workerAttempt: secondLease!.workerAttempt,
    code: 'd5_test_complete',
    message: 'D5 FIFO behavior proved without applying side effects',
  });
});

test('formal project write drift returns to approval and executes against the frozen project after re-confirmation', async t => {
  const { app, db, owner } = t.context;
  const fixture = await createProjectWriteFixture({ app, db, owner });
  const requested = await requestProjectDocWrite({
    app,
    sourceWorkspaceId: fixture.sourceWorkspace.id,
    sessionId: fixture.sessionId,
    docId: fixture.sharedDoc.docId,
    content: 'Apply only after the changed preview is confirmed.',
    idempotencyKey: `drift-${randomUUID()}`,
  });
  const originalRequest = requested.steps.find(
    step => step.stepType === 'tool'
  )!.outputSummary.docUpdateRequest as Record<string, unknown>;
  const originalVersion = originalRequest.expectedDocumentVersion as string;
  await approveProjectDocWrite({
    app,
    hostWorkspaceId: fixture.hostWorkspace.id,
    runId: requested.id,
  });

  const alternate = await createProjectSession({
    db,
    owner,
    workspaceId: fixture.hostWorkspace.id,
  });
  await t.throwsAsync(
    db.aiSession.update({
      where: { id: fixture.sessionId },
      data: { selectedContextProjectId: alternate.projectId },
    })
  );
  await fixture.docWriter.updateDoc(
    fixture.sourceWorkspace.id,
    fixture.sharedDoc.docId,
    'A user changed this document while the approved task was queued.',
    owner.id
  );

  const worker = app.get(CopilotAgentRuntimeWorker);
  t.is(
    await worker.runStandaloneAgentRuntime({
      workspaceId: fixture.hostWorkspace.id,
      runId: requested.id,
    }),
    JOB_SIGNAL.Done
  );
  const waiting = await fixture.models.copilotAgentRuntime.get(
    fixture.hostWorkspace.id,
    requested.id
  );
  const waitingTool = waiting!.steps.find(step => step.stepType === 'tool')!;
  t.is(waiting!.status, 'waiting_approval');
  t.is(waiting!.executionResultCount, 0);
  t.is(
    (waitingTool.outputSummary.docUpdateRequest as Record<string, unknown>)
      .expectedDocumentVersion,
    originalVersion,
    'the invalidated preview keeps its originally approved version'
  );
  t.like(waitingTool.outputSummary.reconfirmationRequest, {
    reason: 'document_version_drift',
    previewStatus: 'invalidated',
  });

  const detail = await app.gql({
    query: taskDetailQuery,
    variables: { taskId: `run:${fixture.hostWorkspace.id}:${requested.id}` },
  });
  const projected = detail.currentUser.copilot.workbenchTask.run;
  t.is(projected.approvalFingerprint, waiting!.timelineFingerprint);
  t.like(projected.documentUpdate, {
    workspaceId: fixture.sourceWorkspace.id,
    docId: fixture.sharedDoc.docId,
    content: 'Apply only after the changed preview is confirmed.',
    previousVersion: originalVersion,
    needsReconfirmation: true,
  });
  t.not(projected.documentUpdate.expectedVersion, originalVersion);
  t.like(projected.artifacts[0], {
    workspaceId: fixture.sourceWorkspace.id,
    id: fixture.sharedDoc.docId,
  });
  for (const expectedApprovalFingerprint of [
    undefined,
    'stale-preview-fingerprint',
  ]) {
    await t.throwsAsync(
      approveProjectDocWrite({
        app,
        hostWorkspaceId: fixture.hostWorkspace.id,
        runId: requested.id,
        expectedApprovalFingerprint,
      }),
      { message: /approval changed/ }
    );
  }
  const unchanged = await fixture.models.copilotAgentRuntime.get(
    fixture.hostWorkspace.id,
    requested.id
  );
  t.is(unchanged!.status, 'waiting_approval');
  t.is(unchanged!.executionResultCount, 0);

  const reconfirmed = await approveProjectDocWrite({
    app,
    hostWorkspaceId: fixture.hostWorkspace.id,
    runId: requested.id,
    expectedApprovalFingerprint: projected.approvalFingerprint,
  });
  const reconfirmedTool = reconfirmed.steps.find(
    step => step.stepType === 'tool'
  )!;
  const confirmedVersion = (
    reconfirmedTool.outputSummary.docUpdateRequest as Record<string, unknown>
  ).expectedDocumentVersion;
  t.not(confirmedVersion, originalVersion);
  t.like(reconfirmedTool.outputSummary.reconfirmationControl, {
    status: 'confirmed',
    actorId: owner.id,
    confirmedVersion,
  });

  t.is(
    await worker.runStandaloneAgentRuntime({
      workspaceId: fixture.hostWorkspace.id,
      runId: requested.id,
    }),
    JOB_SIGNAL.Done
  );
  const completed = await fixture.models.copilotAgentRuntime.get(
    fixture.hostWorkspace.id,
    requested.id
  );
  t.is(completed!.status, 'completed');
  t.is(completed!.executionResultCount, 1);
});

test('approved project write holds the common document lock across version check and update', async t => {
  const { app, db, owner } = t.context;
  const fixture = await createProjectWriteFixture({ app, db, owner });
  const requested = await requestProjectDocWrite({
    app,
    sourceWorkspaceId: fixture.sourceWorkspace.id,
    sessionId: fixture.sessionId,
    docId: fixture.sharedDoc.docId,
    content: 'Approved content wins only against the reviewed version.',
    idempotencyKey: `atomic-${randomUUID()}`,
  });
  await approveProjectDocWrite({
    app,
    hostWorkspaceId: fixture.hostWorkspace.id,
    runId: requested.id,
  });

  let reachedUpdate!: () => void;
  const updateReached = new Promise<void>(resolve => {
    reachedUpdate = resolve;
  });
  let releaseUpdate!: () => void;
  const updateGate = new Promise<void>(resolve => {
    releaseUpdate = resolve;
  });
  const originalUpdateDoc = fixture.docWriter.updateDocDeferred.bind(
    fixture.docWriter
  );
  const updateStub = Sinon.stub(
    fixture.docWriter,
    'updateDocDeferred'
  ).callsFake(async (workspaceId, docId, markdown, editorId) => {
    reachedUpdate();
    await updateGate;
    return await originalUpdateDoc(workspaceId, docId, markdown, editorId);
  });
  const worker = app.get(CopilotAgentRuntimeWorker);
  try {
    const workerRun = worker.runStandaloneAgentRuntime({
      workspaceId: fixture.hostWorkspace.id,
      runId: requested.id,
    });
    await updateReached;

    let competingWriteSettled = false;
    const competingWrite = fixture.models.doc
      .createUpdates([
        {
          spaceId: fixture.sourceWorkspace.id,
          docId: fixture.sharedDoc.docId,
          blob: Buffer.from([0, 0]),
          timestamp: Date.now() + 1_000,
          editorId: owner.id,
        },
      ])
      .then(() => {
        competingWriteSettled = true;
      });
    await new Promise(resolve => setTimeout(resolve, 25));
    t.false(
      competingWriteSettled,
      'ordinary document writes wait after the approved version check'
    );

    releaseUpdate();
    t.is(await workerRun, JOB_SIGNAL.Done);
    await competingWrite;
    t.true(competingWriteSettled);
  } finally {
    releaseUpdate();
    updateStub.restore();
  }
  const completed = await fixture.models.copilotAgentRuntime.get(
    fixture.hostWorkspace.id,
    requested.id
  );
  t.is(completed!.status, 'completed');
});

test('project document update publishes only after its transaction commits', async t => {
  const { app, db, owner } = t.context;
  const fixture = await createProjectWriteFixture({ app, db, owner });
  const content = 'This committed content is visible to the update event.';
  const requested = await requestProjectDocWrite({
    app,
    sourceWorkspaceId: fixture.sourceWorkspace.id,
    sessionId: fixture.sessionId,
    docId: fixture.sharedDoc.docId,
    content,
    idempotencyKey: `post-commit-event-${randomUUID()}`,
  });
  await approveProjectDocWrite({
    app,
    hostWorkspaceId: fixture.hostWorkspace.id,
    runId: requested.id,
  });

  const observed = Promise.withResolvers<{
    markdown: string;
    runStatus: string | undefined;
  }>();
  const timeout = setTimeout(
    () => observed.reject(new Error('Timed out waiting for document update')),
    5_000
  );
  const eventBus = app.get(EventBus);
  const unsubscribe = eventBus.on(
    'doc.updates.pushed',
    async payload => {
      if (
        payload.spaceId !== fixture.sourceWorkspace.id ||
        payload.docId !== fixture.sharedDoc.docId
      ) {
        return;
      }
      const [run, document] = await Promise.all([
        fixture.models.copilotAgentRuntime.get(
          fixture.hostWorkspace.id,
          requested.id
        ),
        app
          .get(DocReader)
          .getDocMarkdown(
            fixture.sourceWorkspace.id,
            fixture.sharedDoc.docId,
            true
          ),
      ]);
      observed.resolve({
        markdown: document?.markdown ?? '',
        runStatus: run?.status,
      });
    },
    { name: `intelligence-workbench-post-commit-${requested.id}` }
  );
  try {
    t.is(
      await app.get(CopilotAgentRuntimeWorker).runStandaloneAgentRuntime({
        workspaceId: fixture.hostWorkspace.id,
        runId: requested.id,
      }),
      JOB_SIGNAL.Done
    );
    const eventState = await observed.promise;
    t.is(eventState.runStatus, 'completed');
    t.true(eventState.markdown.includes(content));
  } finally {
    clearTimeout(timeout);
    unsubscribe();
  }
});

test('rolled-back project document update emits no client update event', async t => {
  const { app, db, owner } = t.context;
  const fixture = await createProjectWriteFixture({ app, db, owner });
  const original = await app
    .get(DocReader)
    .getDocMarkdown(fixture.sourceWorkspace.id, fixture.sharedDoc.docId, true);
  const content = 'This content must roll back before clients are notified.';
  const requested = await requestProjectDocWrite({
    app,
    sourceWorkspaceId: fixture.sourceWorkspace.id,
    sessionId: fixture.sessionId,
    docId: fixture.sharedDoc.docId,
    content,
    idempotencyKey: `rollback-event-${randomUUID()}`,
  });
  await approveProjectDocWrite({
    app,
    hostWorkspaceId: fixture.hostWorkspace.id,
    runId: requested.id,
  });

  const eventSpy = Sinon.spy(app.get(EventBus), 'emitDetached');
  const completionStub = Sinon.stub(
    fixture.models.copilotAgentRuntime,
    'completeStandaloneWorkerExecution'
  ).rejects(new Error('Force transaction rollback after document persistence'));
  try {
    t.is(
      await app.get(CopilotAgentRuntimeWorker).runStandaloneAgentRuntime({
        workspaceId: fixture.hostWorkspace.id,
        runId: requested.id,
      }),
      JOB_SIGNAL.Done
    );
    t.is(
      eventSpy.getCalls().filter(call => call.args[0] === 'doc.updates.pushed')
        .length,
      0
    );
  } finally {
    completionStub.restore();
    eventSpy.restore();
  }

  const after = await app
    .get(DocReader)
    .getDocMarkdown(fixture.sourceWorkspace.id, fixture.sharedDoc.docId, true);
  t.is(after?.markdown, original?.markdown);
  t.false(after?.markdown.includes(content) ?? false);
  const failed = await fixture.models.copilotAgentRuntime.get(
    fixture.hostWorkspace.id,
    requested.id
  );
  t.is(failed?.status, 'failed');
});

test('project write authorization changes linearize with the document side effect', async t => {
  const { app, db, owner } = t.context;
  const fixture = await createProjectWriteFixture({ app, db, owner });
  const requested = await requestProjectDocWrite({
    app,
    sourceWorkspaceId: fixture.sourceWorkspace.id,
    sessionId: fixture.sessionId,
    docId: fixture.sharedDoc.docId,
    content: 'The write linearized before authorization was revoked.',
    idempotencyKey: `authorization-race-${randomUUID()}`,
  });
  await approveProjectDocWrite({
    app,
    hostWorkspaceId: fixture.hostWorkspace.id,
    runId: requested.id,
  });

  let permissionCheckReached!: () => void;
  const reachedPermissionCheck = new Promise<void>(resolve => {
    permissionCheckReached = resolve;
  });
  let releasePermissionCheck!: () => void;
  const permissionCheckGate = new Promise<void>(resolve => {
    releasePermissionCheck = resolve;
  });
  const authorization = fixture.models.intelligenceWorkbenchAuthorization;
  const originalLockAccess =
    authorization.lockProjectDocumentAccessForExecution.bind(authorization);
  const accessStub = Sinon.stub(
    authorization,
    'lockProjectDocumentAccessForExecution'
  ).callsFake(async input => {
    const access = await originalLockAccess(input);
    permissionCheckReached();
    await permissionCheckGate;
    return access;
  });
  const linearizationOrder: string[] = [];
  const originalUpdateDoc = fixture.docWriter.updateDocDeferred.bind(
    fixture.docWriter
  );
  const updateStub = Sinon.stub(
    fixture.docWriter,
    'updateDocDeferred'
  ).callsFake(async (workspaceId, docId, markdown, editorId) => {
    const result = await originalUpdateDoc(
      workspaceId,
      docId,
      markdown,
      editorId
    );
    linearizationOrder.push('document_write');
    return result;
  });
  const worker = app.get(CopilotAgentRuntimeWorker);
  try {
    const workerRun = worker.runStandaloneAgentRuntime({
      workspaceId: fixture.hostWorkspace.id,
      runId: requested.id,
    });
    await reachedPermissionCheck;

    let revokeSettled = false;
    let policySettled = false;
    const revoke = authorization
      .revokeProjectGrant({
        projectId: fixture.projectId,
        workspaceId: fixture.sourceWorkspace.id,
        docId: fixture.sharedDoc.docId,
        actorUserId: owner.id,
      })
      .then(result => {
        revokeSettled = true;
        linearizationOrder.push('revoke');
        return result;
      });
    const policyChange = authorization
      .setProjectAiPolicy({
        projectId: fixture.projectId,
        actorUserId: owner.id,
        policy: 'read_only',
      })
      .then(result => {
        policySettled = true;
        linearizationOrder.push('policy');
        return result;
      });
    await new Promise(resolve => setTimeout(resolve, 25));
    t.false(
      revokeSettled,
      'grant revoke waits for the in-flight project write'
    );
    t.false(
      policySettled,
      'project policy changes wait for the in-flight project write'
    );

    releasePermissionCheck();
    t.is(await workerRun, JOB_SIGNAL.Done);
    await Promise.all([revoke, policyChange]);
    t.is(linearizationOrder[0], 'document_write');
  } finally {
    releasePermissionCheck();
    updateStub.restore();
    accessStub.restore();
  }
  const completed = await fixture.models.copilotAgentRuntime.get(
    fixture.hostWorkspace.id,
    requested.id
  );
  t.is(completed!.status, 'completed');
  const content = await app
    .get(DocReader)
    .getDocMarkdown(fixture.sourceWorkspace.id, fixture.sharedDoc.docId, true);
  t.regex(content!.markdown, /linearized before authorization was revoked/);
  const accessAfter = await authorization.getProjectDocumentAccess({
    projectId: fixture.projectId,
    workspaceId: fixture.sourceWorkspace.id,
    docId: fixture.sharedDoc.docId,
    userId: owner.id,
  });
  t.like(accessAfter!, {
    grantStatus: 'revoked',
    aiPolicy: 'read_only',
  });
  const grant = await db.aiContextProjectGrant.findFirst({
    where: {
      projectId: fixture.projectId,
      workspaceId: fixture.sourceWorkspace.id,
      docId: fixture.sharedDoc.docId,
    },
    orderBy: { grantedAt: 'desc' },
  });
  t.is(grant!.status, 'revoked');
});

test('project write approval remains coherent when the persisted clock is ahead', async t => {
  const { app, db, owner } = t.context;
  const fixture = await createProjectWriteFixture({ app, db, owner });
  const future = Date.now() + 60_000;
  const clock = Sinon.useFakeTimers({ now: future, toFake: ['Date'] });
  let requested!: RequestedProjectDocWrite;
  let second!: RequestedProjectDocWrite;
  try {
    requested = await requestProjectDocWrite({
      app,
      sourceWorkspaceId: fixture.sourceWorkspace.id,
      sessionId: fixture.sessionId,
      docId: fixture.sharedDoc.docId,
      content: 'Approve after a persisted clock skew.',
      idempotencyKey: `approval-clock-skew-${randomUUID()}`,
    });
    clock.tick(1_000);
    second = await requestProjectDocWrite({
      app,
      sourceWorkspaceId: fixture.sourceWorkspace.id,
      sessionId: fixture.sessionId,
      docId: fixture.sharedDoc.docId,
      content: 'Wait behind the earlier clock-skewed write.',
      idempotencyKey: `approval-clock-skew-second-${randomUUID()}`,
    });
  } finally {
    clock.restore();
  }

  for (const run of [requested, second]) {
    const approved = await approveProjectDocWrite({
      app,
      hostWorkspaceId: fixture.hostWorkspace.id,
      runId: run.id,
    });
    t.is(approved.status, 'queued');
  }
  const persisted = await fixture.models.copilotAgentRuntime.get(
    fixture.hostWorkspace.id,
    requested.id
  );
  t.true(persisted!.updatedAt.getTime() > future);
  t.true(persisted!.steps.every(step => step.updatedAt.getTime() > future));

  const workerId = `approval-clock-skew-${randomUUID()}`;
  const leaseMs = 5_000;
  const [databaseBefore] = await db.$queryRaw<Array<{ now: Date }>>`
    SELECT clock_timestamp() AS now
  `;
  const leased =
    await fixture.models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workspaceId: fixture.hostWorkspace.id,
      id: requested.id,
      workerId,
      leaseMs,
    });
  const [databaseAfter] = await db.$queryRaw<Array<{ now: Date }>>`
    SELECT clock_timestamp() AS now
  `;
  t.truthy(leased);
  t.true(leased!.updatedAt.getTime() > persisted!.updatedAt.getTime());
  t.true(
    leased!.workerLeaseExpiresAt!.getTime() >=
      databaseBefore.now.getTime() + leaseMs
  );
  t.true(
    leased!.workerLeaseExpiresAt!.getTime() <=
      databaseAfter.now.getTime() + leaseMs + 100
  );
  t.true(
    leased!.workerLeaseExpiresAt!.getTime() < leased!.updatedAt.getTime(),
    'lease expiry follows wall clock rather than the future logical timestamp'
  );

  const blocked =
    await fixture.models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workspaceId: fixture.hostWorkspace.id,
      id: second.id,
      workerId: `approval-clock-skew-blocked-${randomUUID()}`,
    });
  t.is(blocked, null);

  await db.$executeRaw`
    UPDATE ai_agent_runs
    SET worker_lease_expires_at = clock_timestamp() - INTERVAL '1 millisecond'
    WHERE workspace_id = ${fixture.hostWorkspace.id}
      AND id = ${requested.id}
  `;
  const recovered =
    await fixture.models.copilotAgentRuntime.recoverExpiredStandaloneWorkerLease(
      {
        workspaceId: fixture.hostWorkspace.id,
        id: requested.id,
        reason: 'Clock-skew lease expiry regression test',
      }
    );
  t.is(recovered.status, 'failed');
  t.true(recovered.updatedAt.getTime() > leased!.updatedAt.getTime());

  const secondWorkerId = `approval-clock-skew-second-${randomUUID()}`;
  const secondLease =
    await fixture.models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workspaceId: fixture.hostWorkspace.id,
      id: second.id,
      workerId: secondWorkerId,
    });
  t.truthy(secondLease);
  await fixture.models.copilotAgentRuntime.failStandaloneWorkerExecution({
    workspaceId: fixture.hostWorkspace.id,
    id: second.id,
    workerLeaseId: secondWorkerId,
    workerAttempt: secondLease!.workerAttempt,
    code: 'clock_skew_test_complete',
    message: 'Clock skew queue behavior proved without side effects',
  });
});

test('authorization committed before worker execution prevents the approved write', async t => {
  const { app, owner } = t.context;
  const fixture = await createProjectWriteFixture({
    app,
    db: t.context.db,
    owner,
  });
  const requested = await requestProjectDocWrite({
    app,
    sourceWorkspaceId: fixture.sourceWorkspace.id,
    sessionId: fixture.sessionId,
    docId: fixture.sharedDoc.docId,
    content: 'This content must never be written.',
    idempotencyKey: `authorization-first-${randomUUID()}`,
  });
  await approveProjectDocWrite({
    app,
    hostWorkspaceId: fixture.hostWorkspace.id,
    runId: requested.id,
  });
  await fixture.models.intelligenceWorkbenchAuthorization.setProjectAiPolicy({
    projectId: fixture.projectId,
    actorUserId: owner.id,
    policy: 'read_only',
  });
  t.is(
    await app.get(CopilotAgentRuntimeWorker).runStandaloneAgentRuntime({
      workspaceId: fixture.hostWorkspace.id,
      runId: requested.id,
    }),
    JOB_SIGNAL.Done
  );
  const failed = await fixture.models.copilotAgentRuntime.get(
    fixture.hostWorkspace.id,
    requested.id
  );
  t.is(failed!.status, 'failed');
  t.is(failed!.executionResultCount, 1);
  t.like(failed!.executionResults[0], {
    resultStatus: 'failed',
    sideEffectsApplied: false,
  });
  const content = await app
    .get(DocReader)
    .getDocMarkdown(fixture.sourceWorkspace.id, fixture.sharedDoc.docId, true);
  t.false(content!.markdown.includes('This content must never be written'));

  const revokedFixture = await createProjectWriteFixture({
    app,
    db: t.context.db,
    owner,
  });
  const revokedRequest = await requestProjectDocWrite({
    app,
    sourceWorkspaceId: revokedFixture.sourceWorkspace.id,
    sessionId: revokedFixture.sessionId,
    docId: revokedFixture.sharedDoc.docId,
    content: 'A committed revocation must prevent this write.',
    idempotencyKey: `revocation-first-${randomUUID()}`,
  });
  await approveProjectDocWrite({
    app,
    hostWorkspaceId: revokedFixture.hostWorkspace.id,
    runId: revokedRequest.id,
  });
  await revokedFixture.models.intelligenceWorkbenchAuthorization.revokeProjectGrant(
    {
      projectId: revokedFixture.projectId,
      workspaceId: revokedFixture.sourceWorkspace.id,
      docId: revokedFixture.sharedDoc.docId,
      actorUserId: owner.id,
    }
  );
  t.is(
    await app.get(CopilotAgentRuntimeWorker).runStandaloneAgentRuntime({
      workspaceId: revokedFixture.hostWorkspace.id,
      runId: revokedRequest.id,
    }),
    JOB_SIGNAL.Done
  );
  const revokedRun = await revokedFixture.models.copilotAgentRuntime.get(
    revokedFixture.hostWorkspace.id,
    revokedRequest.id
  );
  t.is(revokedRun!.status, 'failed');
  t.is(revokedRun!.executionResultCount, 1);
  t.like(revokedRun!.executionResults[0], {
    resultStatus: 'failed',
    sideEffectsApplied: false,
  });
  const revokedContent = await app
    .get(DocReader)
    .getDocMarkdown(
      revokedFixture.sourceWorkspace.id,
      revokedFixture.sharedDoc.docId,
      true
    );
  t.false(
    revokedContent!.markdown.includes(
      'A committed revocation must prevent this write'
    )
  );
});

test('Blocker suggestions require explicit member confirmation and expose only manual reminder transitions', async t => {
  const { app, db, owner } = t.context;
  const hostWorkspace = await createWorkspace(app);
  const { projectId, sessionId } = await createProjectSession({
    db,
    owner,
    workspaceId: hostWorkspace.id,
  });
  const runtime = app.get(ToolRuntime);
  const unscopedTools = await runtime.getTools(
    {
      tools: ['blocker'],
      user: owner.id,
      workspace: hostWorkspace.id,
      featureKind: 'chat',
    },
    'test'
  );
  t.deepEqual(Object.keys(unscopedTools), []);
  const ordinaryChatTools = await runtime.getTools(
    {
      tools: ['blocker'],
      user: owner.id,
      session: sessionId,
      workspace: hostWorkspace.id,
      featureKind: 'chat',
    },
    'test'
  );
  t.deepEqual(Object.keys(ordinaryChatTools), []);
  const mismatchedWorkspaceTools = await runtime.getTools(
    {
      tools: ['blocker'],
      user: owner.id,
      session: sessionId,
      workspace: 'different-workspace',
      featureKind: 'chat',
      chatSurface: 'intelligence_workbench',
    },
    'test'
  );
  t.deepEqual(Object.keys(mismatchedWorkspaceTools), []);
  await db.aiSession.update({
    where: { id: sessionId },
    data: { docId: 'ordinary-document-chat' },
  });
  const forgedWorkbenchSurfaceTools = await runtime.getTools(
    {
      tools: ['blocker'],
      user: owner.id,
      session: sessionId,
      workspace: hostWorkspace.id,
      featureKind: 'chat',
      chatSurface: 'intelligence_workbench',
    },
    'test'
  );
  t.deepEqual(Object.keys(forgedWorkbenchSurfaceTools), []);
  await db.aiSession.update({
    where: { id: sessionId },
    data: { docId: null },
  });
  const tools = await runtime.getTools(
    {
      tools: ['blocker'],
      user: owner.id,
      session: sessionId,
      workspace: hostWorkspace.id,
      featureKind: 'chat',
      chatSurface: 'intelligence_workbench',
    },
    'test'
  );
  t.deepEqual(Object.keys(tools), ['blocker_suggest']);
  const suggestion = (await tools.blocker_suggest.execute?.(
    {
      title: 'Wait for the signed contract',
      type: 'wait_file',
      waiting_on: 'Procurement',
      due_at: new Date(Date.now() + 86_400_000).toISOString(),
    },
    {}
  )) as Record<string, unknown>;
  t.like(suggestion, {
    projectId,
    title: 'Wait for the signed contract',
    type: 'wait_file',
    waitingOn: 'Procurement',
    origin: 'ai_suggested',
    confirmationRequired: true,
  });
  t.regex(suggestion.aiSuggestionId as string, /^[0-9a-f-]{36}$/i);
  t.regex(
    suggestion.confirmationProof as string,
    /^[A-Za-z0-9_-]+,[A-Za-z0-9+/=]+$/
  );
  t.is(await db.aiContextProjectBlocker.count(), 0);
  t.is(await db.accessRequest.count(), 0);
  t.is(await db.aiContextProjectInvitation.count(), 0);
  t.is(await db.aiContextProjectGrant.count(), 0);
  t.is(await db.aiAgentRun.count(), 0);

  const outsider = await app.signupV1();
  const noMemberTools = await runtime.getTools(
    {
      tools: ['blocker'],
      user: outsider.id,
      session: sessionId,
      workspace: hostWorkspace.id,
      featureKind: 'chat',
      chatSurface: 'intelligence_workbench',
    },
    'test'
  );
  t.deepEqual(Object.keys(noMemberTools), []);
  await db.aiContextProjectMember.create({
    data: { projectId, userId: outsider.id, role: 'member' },
  });
  const outsiderSessionId = randomUUID();
  await db.aiSession.create({
    data: {
      id: outsiderSessionId,
      userId: outsider.id,
      workspaceId: hostWorkspace.id,
      docId: null,
      selectedContextProjectId: projectId,
      promptName: 'workbench-test',
      promptAction: '',
    },
  });
  const mismatchedSessionUserTools = await runtime.getTools(
    {
      tools: ['blocker'],
      user: outsider.id,
      session: sessionId,
      workspace: hostWorkspace.id,
      featureKind: 'chat',
      chatSurface: 'intelligence_workbench',
    },
    'test'
  );
  t.deepEqual(Object.keys(mismatchedSessionUserTools), []);
  const confirmInput = {
    projectId,
    suggestion: {
      aiSuggestionId: suggestion.aiSuggestionId,
      confirmationProof: suggestion.confirmationProof,
      title: suggestion.title,
      type: suggestion.type,
      waitingOn: suggestion.waitingOn,
      dueAt: suggestion.dueAt,
      origin: suggestion.origin,
      confirmationRequired: suggestion.confirmationRequired,
    },
  };
  await t.throwsAsync(
    app.gql({
      query: blockerSuggestionConfirmMutation,
      variables: { input: confirmInput },
    }),
    { message: /confirmation proof is invalid/ }
  );
  t.is(await db.aiContextProjectBlocker.count(), 0);
  const membershipCheckedTools = await runtime.getTools(
    {
      tools: ['blocker'],
      user: outsider.id,
      session: outsiderSessionId,
      workspace: hostWorkspace.id,
      featureKind: 'chat',
      chatSurface: 'intelligence_workbench',
    },
    'test'
  );
  t.deepEqual(Object.keys(membershipCheckedTools), ['blocker_suggest']);
  await db.aiContextProjectMember.delete({
    where: { projectId_userId: { projectId, userId: outsider.id } },
  });
  await t.throwsAsync(
    async () =>
      await membershipCheckedTools.blocker_suggest.execute?.(
        {
          title: 'Must not survive membership removal',
          type: 'custom',
          waiting_on: 'Nobody',
        },
        {}
      ),
    { message: /Project membership is no longer active/ }
  );
  t.is(await db.aiContextProjectBlocker.count(), 0);

  await t.throwsAsync(
    app.gql({
      query: blockerSuggestionConfirmMutation,
      variables: { input: confirmInput },
    }),
    { message: /confirmation proof is invalid/ }
  );
  await t.throwsAsync(
    app.gql({ query: blockersQuery, variables: { projectId } }),
    { message: /Project not found/ }
  );
  const outsiderAggregate = await app.gql({
    query: blockersQuery,
    variables: {},
  });
  t.deepEqual(outsiderAggregate.currentUser.copilot.workbenchBlockers, []);
  t.is(await db.aiContextProjectBlocker.count(), 0);

  await app.login(owner);
  await t.throwsAsync(
    app.gql({
      query: blockerSuggestionConfirmMutation,
      variables: {
        input: {
          ...confirmInput,
          suggestion: {
            ...confirmInput.suggestion,
            confirmationRequired: false,
          },
        },
      },
    }),
    { message: /Invalid Blocker suggestion confirmation/ }
  );
  t.is(await db.aiContextProjectBlocker.count(), 0);

  const otherProject = await createProjectSession({
    db,
    owner,
    workspaceId: hostWorkspace.id,
  });
  for (const invalidConfirmation of [
    {
      ...confirmInput,
      suggestion: {
        ...confirmInput.suggestion,
        title: 'Tampered before first confirmation',
      },
    },
    {
      ...confirmInput,
      suggestion: { ...confirmInput.suggestion, type: 'custom' },
    },
    {
      ...confirmInput,
      suggestion: {
        ...confirmInput.suggestion,
        waitingOn: 'Changed counterparty',
      },
    },
    {
      ...confirmInput,
      suggestion: {
        ...confirmInput.suggestion,
        dueAt: new Date(Date.now() + 172_800_000).toISOString(),
      },
    },
    { ...confirmInput, projectId: otherProject.projectId },
    {
      ...confirmInput,
      suggestion: {
        ...confirmInput.suggestion,
        aiSuggestionId: randomUUID(),
      },
    },
    {
      ...confirmInput,
      suggestion: {
        ...confirmInput.suggestion,
        confirmationProof: 'e30,AAAA',
      },
    },
    {
      ...confirmInput,
      suggestion: {
        ...confirmInput.suggestion,
        confirmationProof: '***,AAAA',
      },
    },
    {
      ...confirmInput,
      suggestion: {
        ...confirmInput.suggestion,
        confirmationProof: 'a'.repeat(4097),
      },
    },
  ]) {
    await t.throwsAsync(
      app.gql({
        query: blockerSuggestionConfirmMutation,
        variables: { input: invalidConfirmation },
      }),
      { message: /confirmation proof is invalid/ }
    );
    t.is(await db.aiContextProjectBlocker.count(), 0);
  }
  const confirmed = await app.gql({
    query: blockerSuggestionConfirmMutation,
    variables: { input: confirmInput },
  });
  t.like(confirmed.confirmCopilotBlockerSuggestion, {
    projectId,
    creatorUserId: owner.id,
    title: suggestion.title,
    type: suggestion.type,
    waitingOn: suggestion.waitingOn,
    status: 'waiting',
    origin: 'ai_suggested',
    resolutionActorUserId: null,
    resolvedAt: null,
  });
  t.is(await db.aiContextProjectBlocker.count(), 1);
  const repeated = await app.gql({
    query: blockerSuggestionConfirmMutation,
    variables: { input: confirmInput },
  });
  t.is(
    repeated.confirmCopilotBlockerSuggestion.id,
    confirmed.confirmCopilotBlockerSuggestion.id
  );
  t.is(await db.aiContextProjectBlocker.count(), 1);
  await t.throwsAsync(
    app.gql({
      query: blockerSuggestionConfirmMutation,
      variables: {
        input: {
          ...confirmInput,
          suggestion: {
            ...confirmInput.suggestion,
            title: 'Tampered confirmation payload',
          },
        },
      },
    }),
    { message: /confirmation proof is invalid/ }
  );
  t.is(await db.aiContextProjectBlocker.count(), 1);

  const resolved = await app.gql({
    query: blockerResolveMutation,
    variables: { blockerId: confirmed.confirmCopilotBlockerSuggestion.id },
  });
  t.like(resolved.resolveCopilotBlocker, {
    status: 'resolved',
    resolutionActorUserId: owner.id,
  });
  t.truthy(resolved.resolveCopilotBlocker.resolvedAt);
  const repeatedResolve = await app.gql({
    query: blockerResolveMutation,
    variables: { blockerId: confirmed.confirmCopilotBlockerSuggestion.id },
  });
  t.is(
    repeatedResolve.resolveCopilotBlocker.id,
    resolved.resolveCopilotBlocker.id
  );
  await t.throwsAsync(
    app.gql({
      query: blockerAbandonMutation,
      variables: { blockerId: confirmed.confirmCopilotBlockerSuggestion.id },
    }),
    { message: /completed Blocker cannot change status/ }
  );

  const created = await app.gql({
    query: blockerCreateMutation,
    variables: {
      input: {
        projectId,
        title: 'Wait for the budget decision',
        type: 'wait_decision',
        waitingOn: 'Finance',
        dueAt: new Date(Date.now() - 60_000).toISOString(),
      },
    },
  });
  t.like(created.createCopilotBlocker, {
    projectId,
    creatorUserId: owner.id,
    status: 'waiting',
    origin: 'user_created',
    overdue: true,
  });
  const waitingPanel = await queryTaskPanel(app, projectId);
  const waitingCard = waitingPanel.todo.items.find(
    (item: { id: string }) => item.id === created.createCopilotBlocker.id
  );
  t.like(waitingCard, {
    kind: 'blocker',
    status: 'waiting',
    blocker: {
      type: 'wait_decision',
      waitingOn: 'Finance',
      overdue: true,
      origin: 'user_created',
      creatorUserId: owner.id,
    },
  });

  const abandoned = await app.gql({
    query: blockerAbandonMutation,
    variables: { blockerId: created.createCopilotBlocker.id },
  });
  t.like(abandoned.abandonCopilotBlocker, {
    status: 'abandoned',
    resolutionActorUserId: owner.id,
  });
  const donePanel = await queryTaskPanel(app, projectId);
  const resolvedCard = donePanel.done.items.find(
    (item: { id: string }) =>
      item.id === confirmed.confirmCopilotBlockerSuggestion.id
  );
  const abandonedCard = donePanel.done.items.find(
    (item: { id: string }) => item.id === created.createCopilotBlocker.id
  );
  t.like(resolvedCard, { kind: 'blocker', status: 'resolved' });
  t.like(abandonedCard, { kind: 'blocker', status: 'abandoned' });
  t.is(await db.aiContextProjectBlocker.count(), 2);
  t.is(await db.accessRequest.count(), 0);
  t.is(await db.aiContextProjectInvitation.count(), 0);
  t.is(await db.aiContextProjectGrant.count(), 0);
  t.is(await db.aiAgentRun.count(), 0);
});
