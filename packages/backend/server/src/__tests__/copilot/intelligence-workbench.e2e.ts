import { randomUUID } from 'node:crypto';

import type { GraphQLQuery } from '@affine/graphql';
import { PrismaClient, WorkspaceMemberStatus } from '@prisma/client';
import type { TestFn } from 'ava';
import ava from 'ava';

import { AppModule } from '../../app.module';
import { ConfigModule } from '../../base/config';
import { DocReader, DocWriter } from '../../core/doc';
import { Models, WorkspaceRole } from '../../models';
import { ToolRuntime } from '../../plugins/copilot/runtime/tool-runtime';
import {
  createTestingApp,
  createWorkspace,
  type TestingApp,
  type TestUser,
} from '../utils';
import { seedProjectSourceGrant } from '../utils/project-source-grant';

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
    const added = await seedProjectSourceGrant(input.db, {
      projectId,
      workspaceId: sourceWorkspace.id,
      docId,
      requesterUserId: input.owner.id,
      requestedLevel: 'write',
    });
    if (added.status !== 'active') {
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

test('retired Project source writes are denied before creating a task or updating Workspace content', async t => {
  const { app, db, owner } = t.context;
  const fixture = await createProjectWriteFixture({ app, db, owner });
  await t.throwsAsync(
    requestProjectDocWrite({
      app,
      sourceWorkspaceId: fixture.sourceWorkspace.id,
      sessionId: fixture.sessionId,
      docId: fixture.sharedDoc.docId,
      content: 'Must remain inside a native Project resource',
      idempotencyKey: randomUUID(),
    }),
    { message: /native Project resource task/ }
  );
  t.is(await db.aiAgentRun.count(), 0);
  const source = await app
    .get(DocReader)
    .getDocMarkdown(fixture.sourceWorkspace.id, fixture.sharedDoc.docId, true);
  t.false(source!.markdown.includes('Must remain inside'));
});

test('Blocker suggestions require explicit member confirmation and expose only manual reminder transitions', async t => {
  const { app, db, owner } = t.context;
  const hostWorkspace = await createWorkspace(app);
  const { projectId, sessionId } = await createProjectSession({
    db,
    owner,
    workspaceId: hostWorkspace.id,
  });
  await db.aiSession.update({
    where: { id: sessionId },
    data: { workspaceId: null },
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
      featureKind: 'chat',
    },
    'test'
  );
  t.false('blocker_suggest' in ordinaryChatTools);
  await t.throwsAsync(
    runtime.getTools(
      {
        tools: ['blocker'],
        user: owner.id,
        session: sessionId,
        workspace: 'different-workspace',
        featureKind: 'chat',
        chatSurface: 'intelligence_workbench',
      },
      'test'
    ),
    { message: /owned Project conversation/ }
  );
  const documentSessionId = randomUUID();
  await db.aiSession.create({
    data: {
      id: documentSessionId,
      userId: owner.id,
      promptName: 'workbench-test',
      promptAction: '',
      workspaceId: hostWorkspace.id,
      docId: 'ordinary-document-chat',
    },
  });
  const forgedWorkbenchSurfaceTools = await runtime.getTools(
    {
      tools: ['blocker'],
      user: owner.id,
      session: documentSessionId,
      featureKind: 'chat',
      chatSurface: 'intelligence_workbench',
    },
    'test'
  );
  t.false('blocker_suggest' in forgedWorkbenchSurfaceTools);
  const tools = await runtime.getTools(
    {
      tools: ['blocker'],
      user: owner.id,
      session: sessionId,
      featureKind: 'chat',
      chatSurface: 'intelligence_workbench',
    },
    'test'
  );
  t.true('blocker_suggest' in tools);
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
      featureKind: 'chat',
      chatSurface: 'intelligence_workbench',
    },
    'test'
  );
  t.false('blocker_suggest' in noMemberTools);
  await db.aiContextProjectMember.create({
    data: { projectId, userId: outsider.id, role: 'member' },
  });
  const outsiderSessionId = randomUUID();
  await db.aiSession.create({
    data: {
      id: outsiderSessionId,
      userId: outsider.id,
      workspaceId: null,
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
      featureKind: 'chat',
      chatSurface: 'intelligence_workbench',
    },
    'test'
  );
  t.false('blocker_suggest' in mismatchedSessionUserTools);
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
      featureKind: 'chat',
      chatSurface: 'intelligence_workbench',
    },
    'test'
  );
  t.true('blocker_suggest' in membershipCheckedTools);
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
