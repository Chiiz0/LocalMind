import type { GraphQLQuery } from '@affine/graphql';
import { PrismaClient, WorkspaceMemberStatus } from '@prisma/client';
import type { TestFn } from 'ava';
import ava from 'ava';
import Sinon from 'sinon';

import { AppModule } from '../../app.module';
import { JOB_SIGNAL } from '../../base';
import { ConfigModule } from '../../base/config';
import { AuthService } from '../../core/auth';
import { DocReader, DocWriter } from '../../core/doc';
import { Models, WorkspaceRole } from '../../models';
import { agentRuntimeFingerprint } from '../../models/copilot-agent-runtime';
import { repairExecutionFingerprint } from '../../models/copilot-repair-execution';
import { CopilotAgentRuntimeWorker } from '../../plugins/copilot/agent-runtime-worker';
import { CopilotAgentRuntimeWorkflowRegistry } from '../../plugins/copilot/agent-runtime-workflow-registry';
import { CopilotCronJobs } from '../../plugins/copilot/cron';
import { CopilotRepairExecutionWorker } from '../../plugins/copilot/repair-execution-worker';
import { PromptRuntime } from '../../plugins/copilot/runtime/prompt-runtime';
import {
  createTestingApp,
  createWorkspace,
  TestingApp,
  TestUser,
} from '../utils';

const test = ava.serial as TestFn<{
  app: TestingApp;
  auth: AuthService;
  db: PrismaClient;
  owner: TestUser;
  agentRuntimeWorker: CopilotAgentRuntimeWorker;
  agentRuntimeWorkflowRegistry: CopilotAgentRuntimeWorkflowRegistry;
  cronJobs: CopilotCronJobs;
  worker: CopilotRepairExecutionWorker;
}>;

const forwardOnlyRollbackContract = {
  version: 'repair-execution-side-effect-rollback-contract/v1',
  supported: false,
  mode: 'forward_only_followup_revision',
  reason: 'constrained_db_registry_revision_publish',
  recoveryPath: 'publish_follow_up_registry_revision',
};

const publishGateQuery = {
  id: 'repairExecutionPublishGateTestQuery',
  op: 'repairExecutionPublishGate',
  query: `
    query repairExecutionPublishGate($workspaceId: String!, $name: String!) {
      currentUser {
        copilot(workspaceId: $workspaceId) {
          promptRegistryPublishGate(name: $name) {
            registryFingerprint
            registryId
            registryUpdatedAt
            repairActionPreview {
              submissionContract {
                approvalPolicyFingerprint
                authorizationFingerprint
                candidateEvidenceSetFingerprint
                taskRouteEffectiveSourceEvidenceSetFingerprint
                embeddingIndexContractEvidenceSetFingerprint
                rerankRuntimeContractEvidenceSetFingerprint
                preparedRouteOrderEvidenceSetFingerprint
                catalogFingerprint
                contractVersion
                expectedRegistryFingerprint
                expectedRegistryId
                expectedRegistryUpdatedAt
                guardFingerprint
                idempotencyKey
                operationSetFingerprint
                previewFingerprint
                requiredInputs
                submissionFingerprint
                targetLocatorFingerprint
              }
            }
            repairGateManifest {
              fingerprint
            }
            repairGateManifestExportMetadata {
              exportPolicyFingerprint
              retentionPolicyFingerprint
            }
          }
        }
      }
    }
  `,
} satisfies GraphQLQuery;

const preflightQuery = {
  id: 'repairExecutionPreflightTestQuery',
  op: 'repairExecutionPreflight',
  query: `
    query repairExecutionPreflight(
      $workspaceId: String!
      $name: String!
      $submission: CopilotPromptRegistryRepairSubmissionInput!
      $expectedVersion: CopilotPromptRegistryPublishGateExpectedVersionInput
    ) {
      currentUser {
        copilot(workspaceId: $workspaceId) {
          promptRegistryRepairPreflight(
            name: $name
            submission: $submission
            expectedVersion: $expectedVersion
          ) {
            approvalRecordFingerprint
            approvalRequestFingerprint
            auditEventFingerprint
            candidateEvidenceSetFingerprint
            taskRouteEffectiveSourceEvidenceSetFingerprint
            embeddingIndexContractEvidenceSetFingerprint
            rerankRuntimeContractEvidenceSetFingerprint
            preparedRouteOrderEvidenceSetFingerprint
            targetLocatorFingerprint
            executionGateFingerprint
            executionGateStatus
            executionStateFingerprint
            idempotencyFingerprint
            policyBindingFingerprint
            repairJobFingerprint
            reviewBindingFingerprint
            rollbackPlanFingerprint
            status
          }
        }
      }
    }
  `,
} satisfies GraphQLQuery;

const repairExecutionMutation = {
  id: 'repairExecutionTestMutation',
  op: 'requestCopilotPromptRegistryRepairExecution',
  query: `
    mutation requestCopilotPromptRegistryRepairExecution(
      $input: CopilotPromptRegistryRepairExecutionRequestInput!
    ) {
      requestCopilotPromptRegistryRepairExecution(input: $input) {
        accepted
        executionRequested
        requestStatus
        idempotencyLockAcquired
        idempotencyLockStatus
        repairJobRequestCreated
        repairJobRequestStatus
        executionRecord {
          id
          actorId
          workspaceId
          promptName
          status
          approvalState
          permissionStatus
          idempotencyKey
          idempotencyFingerprint
          requestFingerprint
          candidateEvidenceSetFingerprint
          taskRouteEvidenceSetFingerprint
          targetLocatorFingerprint
          repairJobFingerprint
          approvalRecordFingerprint
          auditEventFingerprint
          auditEventCount
          auditEvents {
            id
            executionRequestId
            workspaceId
            actorId
            eventType
            eventFingerprint
            metadata
            createdAt
          }
          queuedAt
          workerAttempt
          workerMaxAttempts
          workerLeaseId
          workerLeaseExpiresAt
          lastAttemptAt
          completedAt
          runtimeResult {
            executor
            sideEffectsApplied
            sideEffectFingerprint
            sideEffectKind
            sideEffectRecordId
            sideEffectSummary
            version
          }
          sideEffectCount
          sideEffects {
            id
            executionRequestId
            workspaceId
            actorId
            sideEffectKind
            sideEffectRecordId
            sideEffectFingerprint
            sideEffectSummary
            executorPayloadFingerprint
            workerAttempt
            workerLeaseId
            appliedAt
            createdAt
          }
          agentRun {
            id
            actorId
            workspaceId
            workflow
            sourceType
            sourceId
            status
            targetFingerprint
            evidenceFingerprint
            timelineFingerprint
            steps {
              id
              runId
              stepKey
              stepType
              status
              evidenceFingerprint
              outputSummary
            }
            timelineEvents {
              id
              runId
              stepId
              eventType
              status
              ordinal
              summary
              eventFingerprint
              payload
            }
          }
        }
      }
    }
  `,
} satisfies GraphQLQuery;

const approvalDecisionMutation = {
  id: 'repairExecutionApprovalDecisionTestMutation',
  op: 'decideCopilotRepairExecutionApproval',
  query: `
    mutation decideCopilotRepairExecutionApproval(
      $input: CopilotRepairExecutionApprovalDecisionInput!
    ) {
      decideCopilotRepairExecutionApproval(input: $input) {
        id
        actorId
        workspaceId
        status
        approvalState
        auditEventCount
        auditEvents {
          id
          executionRequestId
          workspaceId
          actorId
          eventType
          eventFingerprint
          metadata
          createdAt
        }
        queuedAt
        workerAttempt
        workerMaxAttempts
        workerLeaseId
        workerLeaseExpiresAt
        lastAttemptAt
        completedAt
        runtimeResult {
          executor
          message
          sideEffectsApplied
          sideEffectFingerprint
          sideEffectKind
          sideEffectRecordId
          sideEffectSummary
          version
        }
        sideEffectCount
        sideEffects {
          id
          executionRequestId
          workspaceId
          actorId
          sideEffectKind
          sideEffectRecordId
          sideEffectFingerprint
          sideEffectSummary
          executorPayloadFingerprint
          workerAttempt
          workerLeaseId
          appliedAt
          createdAt
        }
        agentRun {
          id
          status
          completedAt
          steps {
            id
            stepKey
            stepType
            status
            completedAt
            outputSummary
          }
          timelineEvents {
            eventType
            status
            ordinal
            summary
            payload
          }
        }
      }
    }
  `,
} satisfies GraphQLQuery;

const controlMutation = {
  id: 'repairExecutionControlTestMutation',
  op: 'controlCopilotRepairExecution',
  query: `
    mutation controlCopilotRepairExecution(
      $input: CopilotRepairExecutionControlInput!
    ) {
      controlCopilotRepairExecution(input: $input) {
        id
        actorId
        workspaceId
        status
        approvalState
        auditEventCount
        auditEvents {
          id
          executionRequestId
          workspaceId
          actorId
          eventType
          eventFingerprint
          metadata
          createdAt
        }
        queuedAt
        failureCode
        failureMessage
        workerAttempt
        workerMaxAttempts
        workerLeaseId
        workerLeaseExpiresAt
        lastAttemptAt
        completedAt
        runtimeResult {
          executor
          message
          sideEffectsApplied
          sideEffectFingerprint
          sideEffectKind
          sideEffectRecordId
          sideEffectSummary
          version
        }
        sideEffectCount
        sideEffects {
          id
          executionRequestId
          workspaceId
          actorId
          sideEffectKind
          sideEffectRecordId
          sideEffectFingerprint
          sideEffectSummary
          executorPayloadFingerprint
          workerAttempt
          workerLeaseId
          appliedAt
          createdAt
        }
        agentRun {
          id
          status
          completedAt
          failureCode
          failureMessage
          steps {
            id
            stepKey
            stepType
            status
            completedAt
            outputSummary
          }
          timelineEvents {
            eventType
            status
            ordinal
            summary
            payload
          }
        }
      }
    }
  `,
} satisfies GraphQLQuery;

const repairExecutionsQuery = {
  id: 'repairExecutionsTestQuery',
  op: 'repairExecutions',
  query: `
    query repairExecutions(
      $workspaceId: String!
      $limit: SafeInt
      $filter: CopilotRepairExecutionListFilterInput
    ) {
      currentUser {
        copilot(workspaceId: $workspaceId) {
          repairExecutions(filter: $filter, limit: $limit) {
            id
            actorId
            workspaceId
            promptName
            requestedAction
            status
            approvalState
            idempotencyKey
            idempotencyFingerprint
            requestFingerprint
            candidateEvidenceSetFingerprint
            taskRouteEvidenceSetFingerprint
            targetLocatorFingerprint
            repairJobFingerprint
            approvalRecordFingerprint
            auditEventFingerprint
            auditEventCount
            auditEvents {
              id
              eventType
              eventFingerprint
            }
            sideEffectCount
            sideEffects {
              id
              sideEffectKind
              sideEffectRecordId
              sideEffectFingerprint
              executorPayloadFingerprint
              workerLeaseId
            }
            failureCode
            workerLeaseId
            agentRun {
              id
              status
              sourceType
              sourceId
            }
          }
        }
      }
    }
  `,
} satisfies GraphQLQuery;

const agentRuntimeRunsQuery = {
  id: 'repairExecutionAgentRuntimeRunsTestQuery',
  op: 'repairExecutionAgentRuntimeRuns',
  query: `
    query repairExecutionAgentRuntimeRuns(
      $workspaceId: String!
      $limit: SafeInt
      $filter: CopilotAgentRunListFilterInput
    ) {
      currentUser {
        copilot(workspaceId: $workspaceId) {
          agentRuntimeWorkflowAdapters {
            workflow
            capabilities {
              version
              supportedStepTypes
              sideEffectMode
              summary
            }
          }
          agentRuns(filter: $filter, limit: $limit) {
            id
            actorId
            workspaceId
            workflow
            sourceType
            sourceId
            status
            title
            targetFingerprint
            evidenceFingerprint
            executionResultCount
            executionResults {
              id
              runId
              workspaceId
              actorId
              workflow
              sourceType
              sourceId
              adapterWorkflow
              executor
              resultStatus
              sideEffectMode
              sideEffectsApplied
              summary
              failureCode
              failureMessage
              resultPayload
              resultFingerprint
              workerAttempt
              workerLeaseId
              completedAt
              createdAt
            }
            timelineFingerprint
            queuedAt
            workerAttempt
            workerMaxAttempts
            workerLeaseId
            workerLeaseExpiresAt
            lastAttemptAt
            failureCode
            failureMessage
            steps {
              id
              runId
              stepKey
              stepType
              status
              outputSummary
            }
            timelineEvents {
              id
              runId
              stepId
              eventType
              status
              ordinal
              summary
              payload
            }
          }
        }
      }
    }
  `,
} satisfies GraphQLQuery;

const agentRuntimeRunQuery = {
  id: 'repairExecutionAgentRuntimeRunTestQuery',
  op: 'repairExecutionAgentRuntimeRun',
  query: `
    query repairExecutionAgentRuntimeRun($workspaceId: String!, $id: String!) {
      currentUser {
        copilot(workspaceId: $workspaceId) {
          agentRuntimeWorkflowAdapters {
            workflow
            capabilities {
              version
              supportedStepTypes
              sideEffectMode
              summary
            }
          }
          agentRun(id: $id) {
            id
            actorId
            workspaceId
            workflow
            sourceType
            sourceId
            status
            title
            targetFingerprint
            evidenceFingerprint
            executionResultCount
            executionResults {
              id
              runId
              workspaceId
              actorId
              workflow
              sourceType
              sourceId
              adapterWorkflow
              executor
              resultStatus
              sideEffectMode
              sideEffectsApplied
              summary
              failureCode
              failureMessage
              resultPayload
              resultFingerprint
              workerAttempt
              workerLeaseId
              completedAt
              createdAt
            }
            timelineFingerprint
            queuedAt
            workerAttempt
            workerMaxAttempts
            workerLeaseId
            workerLeaseExpiresAt
            lastAttemptAt
            failureCode
            failureMessage
            steps {
              id
              runId
              stepKey
              stepType
              status
              outputSummary
            }
            timelineEvents {
              id
              runId
              stepId
              eventType
              status
              ordinal
              summary
              payload
            }
          }
        }
      }
    }
  `,
} satisfies GraphQLQuery;

const agentRuntimeControlMutation = {
  id: 'repairExecutionAgentRuntimeControlTestMutation',
  op: 'controlCopilotAgentRuntimeRun',
  query: `
    mutation controlCopilotAgentRuntimeRun(
      $input: CopilotAgentRuntimeControlInput!
    ) {
      controlCopilotAgentRuntimeRun(input: $input) {
        id
        actorId
        workspaceId
        workflow
        sourceType
        sourceId
        status
        title
        targetFingerprint
        evidenceFingerprint
        executionResultCount
        executionResults {
          id
          runId
          workspaceId
          actorId
          workflow
          sourceType
          sourceId
          adapterWorkflow
          executor
          resultStatus
          sideEffectMode
          sideEffectsApplied
          summary
          failureCode
          failureMessage
          resultPayload
          resultFingerprint
          workerAttempt
          workerLeaseId
          completedAt
          createdAt
        }
        timelineFingerprint
        queuedAt
        workerAttempt
        workerMaxAttempts
        workerLeaseId
        workerLeaseExpiresAt
        lastAttemptAt
        failureCode
        failureMessage
        completedAt
        steps {
          id
          stepKey
          stepType
          status
          completedAt
          outputSummary
        }
        timelineEvents {
          stepId
          eventType
          status
          ordinal
          summary
          payload
        }
      }
    }
  `,
} satisfies GraphQLQuery;

const agentRuntimeDocUpdateRequestMutation = {
  id: 'agentRuntimeDocUpdateRequestTestMutation',
  op: 'requestCopilotAgentRuntimeDocUpdate',
  query: `
    mutation requestCopilotAgentRuntimeDocUpdate(
      $input: CopilotAgentRuntimeDocUpdateRequestInput!
    ) {
      requestCopilotAgentRuntimeDocUpdate(input: $input) {
        id
        actorId
        workspaceId
        workflow
        sourceType
        sourceId
        status
        executionResultCount
        steps {
          id
          stepKey
          stepType
          status
          completedAt
          outputSummary
        }
        timelineEvents {
          eventType
          status
          summary
          payload
        }
      }
    }
  `,
} satisfies GraphQLQuery;

const copilotTasksQuery = {
  id: 'copilotTasksTestQuery',
  op: 'copilotTasks',
  query: `
    query copilotTasks($workspaceId: String!, $taskId: String!) {
      currentUser {
        copilot(workspaceId: $workspaceId) {
          copilotTasks(limit: 20) {
            id
            title
            workflow
            status
            createdAt
            updatedAt
            startedAt
            completedAt
            failureCode
            failureMessage
            resultSummary
            availableActions
            approval {
              stepId
              status
              title
              decidedAt
            }
            artifacts {
              kind
              id
              title
            }
            steps {
              id
              key
              type
              status
              title
              order
              startedAt
              completedAt
            }
          }
          copilotTask(id: $taskId) {
            id
            status
            availableActions
          }
        }
      }
    }
  `,
} satisfies GraphQLQuery;

const copilotTaskControlMutation = {
  id: 'copilotTaskControlTestMutation',
  op: 'controlCopilotTask',
  query: `
    mutation controlCopilotTask($input: CopilotTaskControlInput!) {
      controlCopilotTask(input: $input) {
        id
        status
        availableActions
        approval {
          status
        }
        steps {
          key
          status
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
  t.context.auth = app.get(AuthService);
  t.context.db = app.get(PrismaClient);
  t.context.agentRuntimeWorker = app.get(CopilotAgentRuntimeWorker);
  t.context.agentRuntimeWorkflowRegistry = app.get(
    CopilotAgentRuntimeWorkflowRegistry
  );
  t.context.cronJobs = app.get(CopilotCronJobs);
  t.context.worker = app.get(CopilotRepairExecutionWorker);
});

test.beforeEach(async t => {
  await t.context.app.initTestingDB();
  t.context.owner = await t.context.app.signupV1();
});

test.after.always(async t => {
  await t.context.app.close();
});

async function seedRegistryPrompt(db: PrismaClient, name: string) {
  await db.aiPrompt.create({
    data: {
      action: 'chat',
      config: {},
      messages: {
        create: [
          {
            content: 'Answer with the repair execution registry prompt.',
            idx: 0,
            role: 'system',
          },
        ],
      },
      model: 'test',
      modified: true,
      name,
      optionalModels: ['test'],
      updatedAt: new Date('2026-06-20T09:00:00.000Z'),
    },
  });
}

async function buildRepairExecutionInput(input: {
  app: TestingApp;
  name: string;
  workspaceId: string;
}) {
  const gateResult = await input.app.gql({
    query: publishGateQuery,
    variables: {
      name: input.name,
      workspaceId: input.workspaceId,
    },
  });
  const gate = gateResult.currentUser.copilot.promptRegistryPublishGate;
  const submission = gate.repairActionPreview.submissionContract;
  const expectedVersion = {
    registryFingerprint: gate.registryFingerprint,
    registryId: gate.registryId,
    registryUpdatedAt: gate.registryUpdatedAt,
  };
  const preflightResult = await input.app.gql({
    query: preflightQuery,
    variables: {
      expectedVersion,
      name: input.name,
      submission,
      workspaceId: input.workspaceId,
    },
  });
  const preflight =
    preflightResult.currentUser.copilot.promptRegistryRepairPreflight;

  return {
    expectedApprovalRecordFingerprint: preflight.approvalRecordFingerprint,
    expectedApprovalRequestFingerprint: preflight.approvalRequestFingerprint,
    expectedAuditEventFingerprint: preflight.auditEventFingerprint,
    expectedCandidateEvidenceSetFingerprint:
      preflight.candidateEvidenceSetFingerprint,
    expectedTaskRouteEffectiveSourceEvidenceSetFingerprint:
      preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
    expectedEmbeddingIndexContractEvidenceSetFingerprint:
      preflight.embeddingIndexContractEvidenceSetFingerprint,
    expectedRerankRuntimeContractEvidenceSetFingerprint:
      preflight.rerankRuntimeContractEvidenceSetFingerprint,
    expectedPreparedRouteOrderEvidenceSetFingerprint:
      preflight.preparedRouteOrderEvidenceSetFingerprint,
    expectedTargetLocatorFingerprint: preflight.targetLocatorFingerprint,
    expectedRepairGateManifestFingerprint: gate.repairGateManifest.fingerprint,
    expectedRepairGateManifestExportPolicyFingerprint:
      gate.repairGateManifestExportMetadata.exportPolicyFingerprint,
    expectedRepairGateManifestRetentionPolicyFingerprint:
      gate.repairGateManifestExportMetadata.retentionPolicyFingerprint,
    expectedExecutionGateFingerprint: preflight.executionGateFingerprint,
    expectedExecutionGateStatus: preflight.executionGateStatus,
    expectedExecutionStateFingerprint: preflight.executionStateFingerprint,
    expectedIdempotencyFingerprint: preflight.idempotencyFingerprint,
    expectedPolicyBindingFingerprint: preflight.policyBindingFingerprint,
    expectedPreflightStatus: preflight.status,
    expectedRepairJobFingerprint: preflight.repairJobFingerprint,
    expectedReviewBindingFingerprint: preflight.reviewBindingFingerprint,
    expectedRollbackPlanFingerprint: preflight.rollbackPlanFingerprint,
    expectedVersion,
    name: input.name,
    submission,
    workspaceId: input.workspaceId,
  };
}

test('persists repair execution request, approval state, idempotency, and audit events', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair execution prompt';
  await seedRegistryPrompt(db, promptName);

  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const firstResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const first = firstResult.requestCopilotPromptRegistryRepairExecution;
  const record = first.executionRecord;

  t.true(first.accepted);
  t.true(first.executionRequested);
  t.true(first.idempotencyLockAcquired);
  t.is(first.idempotencyLockStatus, 'acquired_persisted');
  t.true(first.repairJobRequestCreated);
  t.is(first.requestStatus, 'waiting_approval');
  t.is(first.repairJobRequestStatus, 'waiting_approval');
  t.is(record.workspaceId, workspace.id);
  t.is(record.actorId, owner.id);
  t.is(record.promptName, promptName);
  t.is(record.status, 'waiting_approval');
  t.is(record.approvalState, 'waiting');
  t.is(record.permissionStatus, 'granted');
  t.is(record.idempotencyKey, requestInput.submission.idempotencyKey);
  t.is(
    record.candidateEvidenceSetFingerprint,
    requestInput.expectedCandidateEvidenceSetFingerprint
  );
  t.is(
    record.taskRouteEvidenceSetFingerprint,
    requestInput.expectedTaskRouteEffectiveSourceEvidenceSetFingerprint
  );
  t.is(
    record.targetLocatorFingerprint,
    requestInput.expectedTargetLocatorFingerprint
  );
  t.is(record.repairJobFingerprint, requestInput.expectedRepairJobFingerprint);
  t.is(record.auditEventCount, 2);
  t.is(record.runtimeResult.executor, 'approval_gate');
  t.false(record.runtimeResult.sideEffectsApplied);
  t.truthy(record.agentRun);
  t.is(record.agentRun.workspaceId, workspace.id);
  t.is(record.agentRun.actorId, owner.id);
  t.is(record.agentRun.workflow, 'prompt_registry_repair_execution');
  t.is(record.agentRun.sourceType, 'repair_execution_request');
  t.is(record.agentRun.sourceId, record.id);
  t.is(record.agentRun.status, 'waiting_approval');
  t.is(record.agentRun.steps.length, 1);
  t.is(record.agentRun.steps[0].stepKey, 'repair_execution');
  t.is(record.agentRun.steps[0].stepType, 'approval');
  t.is(record.agentRun.steps[0].status, 'waiting_approval');
  t.is(record.agentRun.timelineEvents.length, 2);
  t.deepEqual(
    record.agentRun.timelineEvents.map(
      (event: { eventType: string; status: string }) => [
        event.eventType,
        event.status,
      ]
    ),
    [
      ['run_status', 'waiting_approval'],
      ['approval_step', 'waiting_approval'],
    ]
  );

  const listedResult = await app.gql({
    query: repairExecutionsQuery,
    variables: {
      workspaceId: workspace.id,
      limit: 5,
    },
  });
  const listedExecutions = listedResult.currentUser.copilot
    .repairExecutions as Array<{
    agentRun: {
      id: string;
      sourceId: string;
      sourceType: string;
      status: string;
    } | null;
    auditEventCount: number;
    auditEvents: Array<{ eventFingerprint: string; eventType: string }>;
    id: string;
    requestFingerprint: string;
    status: string;
  }>;
  t.is(listedExecutions.length, 1);
  t.like(listedExecutions[0], {
    auditEventCount: 2,
    id: record.id,
    requestFingerprint: record.requestFingerprint,
    status: 'waiting_approval',
  });
  t.deepEqual(
    listedExecutions[0]?.auditEvents.map(event => event.eventType),
    ['waiting_approval', 'requested']
  );
  t.like(listedExecutions[0]?.agentRun, {
    id: record.agentRun.id,
    sourceId: record.id,
    sourceType: 'repair_execution_request',
    status: 'waiting_approval',
  });

  const filteredByStatusResult = await app.gql({
    query: repairExecutionsQuery,
    variables: {
      workspaceId: workspace.id,
      filter: {
        status: 'waiting_approval',
      },
      limit: 5,
    },
  });
  t.deepEqual(
    filteredByStatusResult.currentUser.copilot.repairExecutions.map(
      (execution: { id: string }) => execution.id
    ),
    [record.id]
  );

  const filteredByRequestFingerprintResult = await app.gql({
    query: repairExecutionsQuery,
    variables: {
      workspaceId: workspace.id,
      filter: {
        query: record.requestFingerprint,
      },
      limit: 5,
    },
  });
  t.deepEqual(
    filteredByRequestFingerprintResult.currentUser.copilot.repairExecutions.map(
      (execution: { id: string }) => execution.id
    ),
    [record.id]
  );

  const filteredByAuditFingerprintResult = await app.gql({
    query: repairExecutionsQuery,
    variables: {
      workspaceId: workspace.id,
      filter: {
        query: record.auditEvents[0].eventFingerprint,
      },
      limit: 5,
    },
  });
  t.deepEqual(
    filteredByAuditFingerprintResult.currentUser.copilot.repairExecutions.map(
      (execution: { id: string }) => execution.id
    ),
    [record.id]
  );

  const missingFilteredResult = await app.gql({
    query: repairExecutionsQuery,
    variables: {
      workspaceId: workspace.id,
      filter: {
        query: 'missing-repair-execution-locator',
      },
      limit: 5,
    },
  });
  t.deepEqual(missingFilteredResult.currentUser.copilot.repairExecutions, []);

  const rows = await db.$queryRaw<
    Array<{
      actorId: string;
      approvalState: string;
      idempotencyKey: string;
      runtimeResult: { sideEffectsApplied: boolean };
      status: string;
      workspaceId: string;
    }>
  >`
    SELECT
      actor_id AS "actorId",
      approval_state AS "approvalState",
      idempotency_key AS "idempotencyKey",
      runtime_result AS "runtimeResult",
      status,
      workspace_id AS "workspaceId"
    FROM ai_repair_execution_requests
    WHERE id = ${record.id}
  `;
  t.deepEqual(rows, [
    {
      actorId: owner.id,
      approvalState: 'waiting',
      idempotencyKey: requestInput.submission.idempotencyKey,
      runtimeResult: {
        executor: 'approval_gate',
        message: 'Execution request persisted and waiting for approval.',
        sideEffectsApplied: false,
        version: 'repair-execution-runtime-result/v1',
      },
      status: 'waiting_approval',
      workspaceId: workspace.id,
    },
  ]);

  const auditAfterCreate = await db.$queryRaw<Array<{ eventType: string }>>`
    SELECT event_type AS "eventType"
    FROM ai_repair_execution_audit_events
    WHERE execution_request_id = ${record.id}
    ORDER BY created_at ASC
  `;
  t.deepEqual(
    auditAfterCreate.map(event => event.eventType),
    ['requested', 'waiting_approval']
  );

  await db.$executeRaw`
    UPDATE ai_repair_execution_audit_events
    SET metadata = metadata
    WHERE execution_request_id = ${record.id}
      AND event_type = ${'requested'}
  `;

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_audit_events
      SET metadata = jsonb_set(
        metadata,
        ${'{repairJobFingerprint}'}::text[],
        ${JSON.stringify('rewritten-repair-job-fp')}::jsonb
      )
      WHERE execution_request_id = ${record.id}
        AND event_type = ${'requested'}
    `,
    {
      message: /ai_repair_execution_audit_events_content_update_restrict_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_audit_events
      SET event_fingerprint = ${'deadbeefdeadbeef'}
      WHERE execution_request_id = ${record.id}
        AND event_type = ${'requested'}
    `,
    {
      message: /ai_repair_execution_audit_events_content_update_restrict_check/,
    }
  );

  const driftActor = await app.createUser();
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_audit_events
      SET actor_id = ${driftActor.id}
      WHERE execution_request_id = ${record.id}
        AND event_type = ${'requested'}
    `,
    {
      message: /ai_repair_execution_audit_events_content_update_restrict_check/,
    }
  );

  const otherWorkspace = await createWorkspace(app);
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_audit_events
      SET workspace_id = ${otherWorkspace.id}
      WHERE execution_request_id = ${record.id}
        AND event_type = ${'requested'}
    `,
    {
      message: /ai_repair_execution_audit_events_request_workspace_fkey/,
    }
  );

  const agentRows = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count"
    FROM ai_agent_runs
    WHERE source_type = ${'repair_execution_request'}
      AND source_id = ${record.id}
      AND workspace_id = ${workspace.id}
  `;
  t.is(agentRows[0]?.count, 1);

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET
        status = ${'completed'},
        approval_state = ${'approved'}
      WHERE id = ${record.id}
    `,
    { message: /ai_repair_execution_requests_completed_at_status_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET approval_state = ${'approved'}
      WHERE id = ${record.id}
    `,
    { message: /ai_repair_execution_requests_approval_status_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET queued_at = ${new Date('2026-06-22T13:00:00.000Z')}
      WHERE id = ${record.id}
    `,
    { message: /ai_repair_execution_requests_queued_at_status_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET completed_at = ${new Date('2026-06-22T13:00:00.000Z')}
      WHERE id = ${record.id}
    `,
    { message: /ai_repair_execution_requests_completed_at_status_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET updated_at = ${new Date('2026-06-22T12:49:00.000Z')}
      WHERE id = ${record.id}
    `,
    { message: /ai_repair_execution_requests_timestamp_coherence_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET last_attempt_at = ${new Date('2026-06-22T12:49:00.000Z')}
      WHERE id = ${record.id}
    `,
    { message: /ai_repair_execution_requests_timestamp_coherence_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET prompt_name = ${'   '}
      WHERE id = ${record.id}
    `,
    { message: /ai_repair_execution_requests_identity_shape_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET request_fingerprint = ${'   '}
      WHERE id = ${record.id}
    `,
    { message: /ai_repair_execution_requests_identity_shape_check/ }
  );

  await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET updated_at = updated_at
    WHERE id = ${record.id}
  `;

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET request_fingerprint = ${'request-fingerprint-drift'}
      WHERE id = ${record.id}
    `,
    {
      message: /ai_repair_execution_requests_evidence_update_restrict_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET executor_payload = executor_payload || ${JSON.stringify({
        tampered: true,
      })}::jsonb
      WHERE id = ${record.id}
    `,
    {
      message: /ai_repair_execution_requests_evidence_update_restrict_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET created_at = ${new Date('2026-06-22T12:00:00.000Z')}
      WHERE id = ${record.id}
    `,
    {
      message: /ai_repair_execution_requests_evidence_update_restrict_check/,
    }
  );

  const stepRows = await db.$queryRaw<
    Array<{ status: string; stepKey: string; stepType: string }>
  >`
    SELECT step_key AS "stepKey", step_type AS "stepType", status
    FROM ai_agent_steps
    WHERE run_id = ${record.agentRun.id}
  `;
  t.deepEqual(stepRows, [
    {
      status: 'waiting_approval',
      stepKey: 'repair_execution',
      stepType: 'approval',
    },
  ]);

  const timelineRows = await db.$queryRaw<
    Array<{ eventType: string; status: string }>
  >`
    SELECT event_type AS "eventType", status
    FROM ai_agent_timeline_events
    WHERE run_id = ${record.agentRun.id}
    ORDER BY ordinal ASC
  `;
  t.deepEqual(timelineRows, [
    { eventType: 'run_status', status: 'waiting_approval' },
    { eventType: 'approval_step', status: 'waiting_approval' },
  ]);

  const secondResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const second = secondResult.requestCopilotPromptRegistryRepairExecution;
  t.is(second.executionRecord.id, record.id);
  t.is(second.executionRecord.auditEventCount, 3);
  t.is(second.executionRecord.agentRun.id, record.agentRun.id);

  const auditAfterReuse = await db.$queryRaw<Array<{ eventType: string }>>`
    SELECT event_type AS "eventType"
    FROM ai_repair_execution_audit_events
    WHERE execution_request_id = ${record.id}
    ORDER BY created_at ASC
  `;
  t.deepEqual(
    auditAfterReuse.map(event => event.eventType),
    ['requested', 'waiting_approval', 'reused']
  );
});

test('repair execution model normalizes and bounds durable request inputs', async t => {
  const { app, db, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);

  const normalizedInput = {
    workspaceId: `  ${workspace.id}  `,
    actorId: `  ${owner.id}  `,
    promptName: '  Repair model normalized prompt  ',
    requestedAction: '  publish_prompt_registry_revision  ',
    approvalRequired: true,
    permissionStatus: '  granted  ',
    idempotencyKey: '  repair-normalized-idempotency  ',
    idempotencyFingerprint: '  idempotency-fp  ',
    requestFingerprint: '  request-fp  ',
    candidateEvidenceSetFingerprint: '  candidate-fp  ',
    taskRouteEvidenceSetFingerprint: '  task-route-fp  ',
    targetLocatorFingerprint: '  target-fp  ',
    repairJobFingerprint: '  repair-job-fp  ',
    approvalRecordFingerprint: '  approval-fp  ',
    auditEventFingerprint: '  audit-fp  ',
    executorPayload: {
      version: 'repair-execution-test-payload/v1',
      kind: 'repair_execution_test_payload',
      nested: {
        kept: true,
        dropped: undefined,
      },
    },
  };
  const first =
    await models.copilotRepairExecution.createOrReuse(normalizedInput);
  t.true(first.created);
  t.is(first.record.workspaceId, workspace.id);
  t.is(first.record.actorId, owner.id);
  t.is(first.record.promptName, 'Repair model normalized prompt');
  t.is(first.record.requestedAction, 'publish_prompt_registry_revision');
  t.is(first.record.permissionStatus, 'granted');
  t.is(first.record.idempotencyKey, 'repair-normalized-idempotency');
  t.is(first.record.requestFingerprint, 'request-fp');
  t.is(first.record.approvalRecordFingerprint, 'approval-fp');
  t.deepEqual(first.record.executorPayload, {
    version: 'repair-execution-test-payload/v1',
    kind: 'repair_execution_test_payload',
    nested: {
      kept: true,
    },
  });

  const reused = await models.copilotRepairExecution.createOrReuse({
    ...normalizedInput,
    workspaceId: workspace.id,
    idempotencyKey: 'repair-normalized-idempotency',
  });
  t.false(reused.created);
  t.is(reused.record.id, first.record.id);

  await t.throwsAsync(
    models.copilotRepairExecution.createOrReuse({
      ...normalizedInput,
      promptName: 'x'.repeat(513),
      idempotencyKey: 'repair-overlong-prompt',
    }),
    { message: 'Repair execution prompt name is too long' }
  );
  await t.throwsAsync(
    models.copilotRepairExecution.createOrReuse({
      ...normalizedInput,
      promptName: 'Repair blank fingerprint prompt',
      idempotencyKey: 'repair-blank-fingerprint',
      requestFingerprint: '   ',
    }),
    { message: 'Repair execution request fingerprint is required' }
  );
  await t.throwsAsync(
    models.copilotRepairExecution.createOrReuse({
      ...normalizedInput,
      promptName: 'Repair unsupported permission status prompt',
      idempotencyKey: 'repair-unsupported-permission-status',
      permissionStatus: 'denied',
    }),
    {
      message: 'Repair execution permission status is unsupported: denied',
    }
  );
  await t.throwsAsync(
    models.copilotRepairExecution.createOrReuse({
      ...normalizedInput,
      promptName: 'Repair non-object payload prompt',
      idempotencyKey: 'repair-non-object-payload',
      executorPayload: 'not-an-object' as never,
    }),
    { message: 'Repair execution executor payload must be an object' }
  );
  await t.throwsAsync(
    models.copilotRepairExecution.createOrReuse({
      ...normalizedInput,
      promptName: 'Repair overlong payload kind prompt',
      idempotencyKey: 'repair-overlong-payload-kind',
      executorPayload: {
        version: 'repair-execution-test-payload/v1',
        kind: 'x'.repeat(513),
      },
    }),
    { message: 'Repair execution executor payload kind is too long' }
  );
  await t.throwsAsync(
    models.copilotRepairExecution.createOrReuse({
      ...normalizedInput,
      promptName: 'Repair oversized payload prompt',
      idempotencyKey: 'repair-oversized-payload',
      executorPayload: {
        version: 'repair-execution-test-payload/v1',
        kind: 'repair_execution_test_payload',
        body: 'x'.repeat(20 * 1024),
      },
    }),
    { message: 'Repair execution executor payload is too large' }
  );

  const countRows = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count"
    FROM ai_repair_execution_requests
    WHERE workspace_id = ${workspace.id}
      AND idempotency_key IN (
        ${'repair-overlong-prompt'},
        ${'repair-blank-fingerprint'},
        ${'repair-unsupported-permission-status'},
        ${'repair-non-object-payload'},
        ${'repair-overlong-payload-kind'},
        ${'repair-oversized-payload'}
      )
  `;
  t.is(countRows[0].count, 0);

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET worker_attempt = ${2}, worker_max_attempts = ${1}
      WHERE id = ${first.record.id}
    `,
    { message: /ai_repair_execution_requests_worker_attempts_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET worker_lease_id = ${'orphan-repair-worker-lease'}
      WHERE id = ${first.record.id}
    `,
    { message: /ai_repair_execution_requests_worker_lease_pair_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET
        worker_lease_id = ${'   '},
        worker_lease_expires_at = ${new Date('2026-06-22T13:10:00.000Z')}
      WHERE id = ${first.record.id}
    `,
    {
      message: /ai_repair_execution_requests_worker_lease_id_shape_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET
        worker_lease_id = ${'queued-repair-worker-lease'},
        worker_lease_expires_at = ${new Date('2026-06-22T13:11:00.000Z')}
      WHERE id = ${first.record.id}
    `,
    {
      message: /ai_repair_execution_requests_worker_lease_status_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET runtime_result = ${JSON.stringify(['not-a-runtime-result'])}::jsonb
      WHERE id = ${first.record.id}
    `,
    { message: /ai_repair_execution_requests_json_shape_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET runtime_result = ${JSON.stringify({
        version: 'repair-execution-runtime-result/v1',
        executor: 'prompt_registry_revision_publish_worker',
        sideEffectsApplied: true,
        message: 'Applied side effect without persisted identity.',
      })}::jsonb
      WHERE id = ${first.record.id}
    `,
    {
      message: /ai_repair_execution_requests_runtime_side_effect_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET runtime_result = ${JSON.stringify({
        version: 'repair-execution-runtime-result/v1',
        executor: 'prompt_registry_revision_publish_worker',
        sideEffectsApplied: true,
        message: 'Applied side effect without object summary.',
        sideEffectFingerprint: 'side-effect-fp',
        sideEffectKind: 'prompt_registry_revision',
        sideEffectRecordId: 'revision-row-id',
        sideEffectSummary: 'not-an-object',
      })}::jsonb
      WHERE id = ${first.record.id}
    `,
    {
      message: /ai_repair_execution_requests_runtime_side_effect_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET runtime_result = ${JSON.stringify({
        version: 'repair-execution-runtime-result/v1',
        executor: 'prompt_registry_revision_publish_worker',
        sideEffectsApplied: true,
        message: 'Applied side effect without rollback contract.',
        sideEffectFingerprint: 'side-effect-fp',
        sideEffectKind: 'prompt_registry_revision',
        sideEffectRecordId: 'revision-row-id',
        sideEffectSummary: {
          version: 'repair-execution-side-effect-summary/v1',
        },
      })}::jsonb
      WHERE id = ${first.record.id}
    `,
    {
      message: /ai_repair_execution_requests_side_effect_rollback_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET runtime_result = ${JSON.stringify({
        version: 'repair-execution-runtime-result/v1',
        executor: 'prompt_registry_revision_publish_worker',
        sideEffectsApplied: true,
        message: 'Applied side effect with rollback-support drift.',
        sideEffectFingerprint: 'side-effect-fp',
        sideEffectKind: 'prompt_registry_revision',
        sideEffectRecordId: 'revision-row-id',
        sideEffectSummary: {
          rollbackContract: {
            ...forwardOnlyRollbackContract,
            supported: true,
          },
          version: 'repair-execution-side-effect-summary/v1',
        },
      })}::jsonb
      WHERE id = ${first.record.id}
    `,
    {
      message: /ai_repair_execution_requests_side_effect_rollback_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET
        executor_payload = ${JSON.stringify({
          version: 'prompt-registry-revision-executor-payload/v1',
          kind: 'prompt_registry_revision_publish',
        })}::jsonb,
        runtime_result = ${JSON.stringify({
          version: 'repair-execution-runtime-result/v1',
          executor: 'model_registry_revision_publish_worker',
          sideEffectsApplied: true,
          message: 'Applied side effect with mismatched executor payload.',
          sideEffectFingerprint: 'side-effect-fp',
          sideEffectKind: 'model_registry_revision',
          sideEffectRecordId: 'revision-row-id',
          sideEffectSummary: {
            rollbackContract: forwardOnlyRollbackContract,
            version: 'repair-execution-side-effect-summary/v1',
          },
        })}::jsonb
      WHERE id = ${first.record.id}
    `,
    {
      message: /ai_repair_execution_side_effect_executor_payload_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET executor_payload = ${JSON.stringify(['not-a-payload'])}::jsonb
      WHERE id = ${first.record.id}
    `,
    { message: /ai_repair_execution_requests_json_shape_check/ }
  );

  const executable = await models.copilotRepairExecution.createOrReuse({
    ...normalizedInput,
    approvalRequired: false,
    promptName: 'Repair executable status coherence prompt',
    idempotencyKey: 'repair-executable-status-coherence',
  });
  t.true(executable.created);
  t.is(executable.record.status, 'queued');
  t.is(executable.record.approvalState, 'not_required');
  t.truthy(executable.record.queuedAt);

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET approval_state = ${'waiting'}
      WHERE id = ${executable.record.id}
    `,
    { message: /ai_repair_execution_requests_approval_status_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET queued_at = ${null}
      WHERE id = ${executable.record.id}
    `,
    { message: /ai_repair_execution_requests_queued_at_status_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_audit_events
      SET metadata = ${JSON.stringify(['not-metadata'])}::jsonb
      WHERE execution_request_id = ${first.record.id}
        AND event_type = ${'requested'}
    `,
    { message: /ai_repair_execution_audit_events_metadata_shape_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_audit_events
      SET event_fingerprint = ${'   '}
      WHERE execution_request_id = ${first.record.id}
        AND event_type = ${'requested'}
    `,
    { message: /ai_repair_execution_audit_events_fingerprint_shape_check/ }
  );
});

test('repair execution create reuses request when idempotency insert conflicts after pre-read miss', async t => {
  const { app, db, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const createInput = {
    workspaceId: workspace.id,
    actorId: owner.id,
    promptName: 'Repair idempotency conflict',
    requestedAction: 'publish_prompt_registry_revision',
    approvalRequired: true,
    permissionStatus: 'granted',
    idempotencyKey: 'repair-idempotency-insert-conflict',
    idempotencyFingerprint: 'idempotency-fp-conflict',
    requestFingerprint: 'request-fp-conflict',
    candidateEvidenceSetFingerprint: 'candidate-fp-conflict',
    taskRouteEvidenceSetFingerprint: 'task-route-fp-conflict',
    targetLocatorFingerprint: 'target-fp-conflict',
    repairJobFingerprint: 'repair-job-fp-conflict',
    approvalRecordFingerprint: 'approval-fp-conflict',
    auditEventFingerprint: 'audit-fp-conflict',
    executorPayload: {
      version: 'repair-execution-test-payload/v1',
      kind: 'repair_execution_test_payload',
    },
  };
  const existing =
    await models.copilotRepairExecution.createOrReuse(createInput);
  t.true(existing.created);

  const originalGetByIdempotencyKey =
    models.copilotRepairExecution.getByIdempotencyKey.bind(
      models.copilotRepairExecution
    );
  let forcedPreReadMiss = false;
  models.copilotRepairExecution.getByIdempotencyKey = (async (
    workspaceId: string,
    idempotencyKey: string
  ) => {
    if (!forcedPreReadMiss) {
      forcedPreReadMiss = true;
      t.is(workspaceId, workspace.id);
      t.is(idempotencyKey, createInput.idempotencyKey);
      return null;
    }
    return await originalGetByIdempotencyKey(workspaceId, idempotencyKey);
  }) as typeof models.copilotRepairExecution.getByIdempotencyKey;

  try {
    const reused =
      await models.copilotRepairExecution.createOrReuse(createInput);
    t.false(reused.created);
    t.is(reused.record.id, existing.record.id);
  } finally {
    models.copilotRepairExecution.getByIdempotencyKey =
      originalGetByIdempotencyKey as typeof models.copilotRepairExecution.getByIdempotencyKey;
  }
  t.true(forcedPreReadMiss);

  const rows = await db.$queryRaw<Array<{ eventType: string }>>`
    SELECT event_type AS "eventType"
    FROM ai_repair_execution_audit_events
    WHERE execution_request_id = ${existing.record.id}
    ORDER BY created_at ASC, id ASC
  `;
  t.deepEqual(
    rows.map(row => row.eventType),
    ['requested', 'waiting_approval', 'reused']
  );
});

test('repair execution idempotency conflict rejects mismatched create evidence', async t => {
  const { app, db, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const idempotencyKey = 'repair-idempotency-insert-conflict-drift';
  const existing = await models.copilotRepairExecution.createOrReuse({
    workspaceId: workspace.id,
    actorId: owner.id,
    promptName: 'Repair idempotency existing prompt',
    requestedAction: 'publish_prompt_registry_revision',
    approvalRequired: true,
    permissionStatus: 'granted',
    idempotencyKey,
    idempotencyFingerprint: 'idempotency-fp-existing-conflict',
    requestFingerprint: 'request-fp-existing-conflict',
    candidateEvidenceSetFingerprint: 'candidate-fp-existing-conflict',
    taskRouteEvidenceSetFingerprint: 'task-route-fp-existing-conflict',
    targetLocatorFingerprint: 'target-fp-existing-conflict',
    repairJobFingerprint: 'repair-job-fp-existing-conflict',
    approvalRecordFingerprint: 'approval-fp-existing-conflict',
    auditEventFingerprint: 'audit-fp-existing-conflict',
    executorPayload: {
      version: 'repair-execution-test-payload/v1',
      kind: 'repair_execution_test_payload',
      fixture: 'existing',
    },
  });
  t.true(existing.created);

  const originalGetByIdempotencyKey =
    models.copilotRepairExecution.getByIdempotencyKey.bind(
      models.copilotRepairExecution
    );
  let forcedPreReadMiss = false;
  models.copilotRepairExecution.getByIdempotencyKey = (async (
    workspaceId: string,
    currentIdempotencyKey: string
  ) => {
    if (!forcedPreReadMiss) {
      forcedPreReadMiss = true;
      t.is(workspaceId, workspace.id);
      t.is(currentIdempotencyKey, idempotencyKey);
      return null;
    }
    return await originalGetByIdempotencyKey(
      workspaceId,
      currentIdempotencyKey
    );
  }) as typeof models.copilotRepairExecution.getByIdempotencyKey;

  try {
    await t.throwsAsync(
      models.copilotRepairExecution.createOrReuse({
        workspaceId: workspace.id,
        actorId: owner.id,
        promptName: 'Repair idempotency conflicting prompt',
        requestedAction: 'publish_prompt_registry_revision',
        approvalRequired: true,
        permissionStatus: 'granted',
        idempotencyKey,
        idempotencyFingerprint: 'idempotency-fp-conflicting-conflict',
        requestFingerprint: 'request-fp-conflicting-conflict',
        candidateEvidenceSetFingerprint: 'candidate-fp-conflicting-conflict',
        taskRouteEvidenceSetFingerprint: 'task-route-fp-conflicting-conflict',
        targetLocatorFingerprint: 'target-fp-conflicting-conflict',
        repairJobFingerprint: 'repair-job-fp-conflicting-conflict',
        approvalRecordFingerprint: 'approval-fp-conflicting-conflict',
        auditEventFingerprint: 'audit-fp-conflicting-conflict',
        executorPayload: {
          version: 'repair-execution-test-payload/v1',
          kind: 'repair_execution_test_payload',
          fixture: 'conflicting',
        },
      }),
      {
        message:
          /Repair execution request conflict reused mismatched create evidence/,
      }
    );
  } finally {
    models.copilotRepairExecution.getByIdempotencyKey =
      originalGetByIdempotencyKey as typeof models.copilotRepairExecution.getByIdempotencyKey;
  }
  t.true(forcedPreReadMiss);

  const eventRows = await db.$queryRaw<Array<{ eventType: string }>>`
    SELECT event_type AS "eventType"
    FROM ai_repair_execution_audit_events
    WHERE execution_request_id = ${existing.record.id}
    ORDER BY created_at ASC, id ASC
  `;
  t.deepEqual(
    eventRows.map(row => row.eventType),
    ['requested', 'waiting_approval']
  );
});

test('repair execution audit metadata contract rejects direct drift at the DB boundary', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const created = await app.models.copilotRepairExecution.createOrReuse({
    workspaceId: workspace.id,
    actorId: owner.id,
    promptName: 'Repair audit metadata contract prompt',
    requestedAction: 'publish_prompt_registry_revision',
    approvalRequired: false,
    permissionStatus: 'granted',
    idempotencyKey: 'repair-audit-metadata-contract',
    idempotencyFingerprint: 'audit-metadata-idempotency-fp',
    requestFingerprint: 'audit-metadata-request-fp',
    candidateEvidenceSetFingerprint: 'audit-metadata-candidate-fp',
    taskRouteEvidenceSetFingerprint: 'audit-metadata-task-route-fp',
    targetLocatorFingerprint: 'audit-metadata-target-fp',
    repairJobFingerprint: 'audit-metadata-repair-job-fp',
    approvalRecordFingerprint: 'audit-metadata-approval-fp',
    auditEventFingerprint: 'audit-metadata-audit-fp',
    executorPayload: {
      version: 'repair-execution-test-payload/v1',
      kind: 'repair_execution_test_payload',
    },
  });
  t.true(created.created);

  const insertAuditEvent = async (
    id: string,
    eventType: string,
    metadata: Record<string, unknown>
  ) => {
    await db.$executeRaw`
      INSERT INTO ai_repair_execution_audit_events (
        id,
        execution_request_id,
        workspace_id,
        actor_id,
        event_type,
        event_fingerprint,
        metadata
      )
      VALUES (
        ${id},
        ${created.record.id},
        ${workspace.id},
        ${owner.id},
        ${eventType},
        ${`${id}-fp`},
        ${JSON.stringify(metadata)}::jsonb
      )
    `;
  };

  const runningEventId = `audit-contract-running-${created.record.id}`;
  await insertAuditEvent(runningEventId, 'running', {
    executor: 'repair_execution_worker',
    workerAttempt: 1,
    workerLeaseId: 'repair-audit-contract-worker',
    workerLeaseExpiresAt: '2026-06-22T13:30:00.000Z',
  });
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_audit_events
      SET metadata = metadata - ${'workerLeaseExpiresAt'}
      WHERE id = ${runningEventId}
    `,
    { message: /ai_repair_execution_audit_metadata_contract_check/ }
  );

  const failedEventId = `audit-contract-failed-${created.record.id}`;
  await insertAuditEvent(failedEventId, 'failed', {
    failureCode: 'repair_execution_worker_failed',
    failureMessage: 'transient registry write failure',
    failingExecutorPayloadFingerprint: 'executor-payload-fp',
    retryScheduled: true,
    workerAttempt: 1,
    workerMaxAttempts: 3,
    workerLeaseId: 'repair-audit-contract-worker',
  });
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_audit_events
      SET metadata = metadata - ${'failingExecutorPayloadFingerprint'}
      WHERE id = ${failedEventId}
    `,
    { message: /ai_repair_execution_audit_metadata_contract_check/ }
  );

  const staleFailedEventId = `audit-contract-stale-failed-${created.record.id}`;
  await insertAuditEvent(staleFailedEventId, 'failed', {
    controlAction: 'recover_stale',
    recoverySource: 'system',
    failureCode: 'stale_worker_lease',
    failureMessage:
      'Expired running worker lease recovered with no attempts remaining.',
    retryScheduled: false,
    workerAttempt: 1,
    workerMaxAttempts: 1,
  });
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_audit_events
      SET metadata = jsonb_set(
        metadata,
        ${'{retryScheduled}'}::text[],
        ${'true'}::jsonb
      )
      WHERE id = ${staleFailedEventId}
    `,
    { message: /ai_repair_execution_audit_metadata_contract_check/ }
  );

  const retryEventId = `audit-contract-retry-${created.record.id}`;
  await insertAuditEvent(retryEventId, 'retry_scheduled', {
    nextStatus: 'queued',
    workerAttempt: 1,
    workerMaxAttempts: 3,
  });
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_audit_events
      SET metadata = jsonb_set(
        metadata,
        ${'{nextStatus}'}::text[],
        ${JSON.stringify('failed')}::jsonb
      )
      WHERE id = ${retryEventId}
    `,
    { message: /ai_repair_execution_audit_metadata_contract_check/ }
  );

  const cancelRequestedEventId = `audit-contract-cancel-requested-${created.record.id}`;
  await insertAuditEvent(cancelRequestedEventId, 'cancel_requested', {
    controlAction: 'cancel',
    previousStatus: 'running',
    previousApprovalState: 'approved',
    reason: 'operator requested running cancellation',
    requestedAt: '2026-06-22T13:10:00.000Z',
    workerAttempt: 1,
    workerLeaseId: 'repair-audit-contract-worker',
    workerLeaseExpiresAt: '2026-06-22T13:30:00.000Z',
  });
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_audit_events
      SET metadata = jsonb_set(
        metadata,
        ${'{workerAttempt}'}::text[],
        ${'0'}::jsonb
      )
      WHERE id = ${cancelRequestedEventId}
    `,
    { message: /ai_repair_execution_audit_metadata_contract_check/ }
  );

  const cancelledEventId = `audit-contract-cancelled-${created.record.id}`;
  await insertAuditEvent(cancelledEventId, 'cancelled', {
    controlAction: 'cancel',
    previousStatus: 'queued',
    previousApprovalState: 'approved',
    reason: null,
    workerAttempt: 0,
    workerLeaseId: null,
  });
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_audit_events
      SET metadata = jsonb_set(
        metadata,
        ${'{previousStatus}'}::text[],
        ${JSON.stringify('running')}::jsonb
      )
      WHERE id = ${cancelledEventId}
    `,
    { message: /ai_repair_execution_audit_metadata_contract_check/ }
  );

  const cooperativeCancelledEventId = `audit-contract-cooperative-cancelled-${created.record.id}`;
  await insertAuditEvent(cooperativeCancelledEventId, 'cancelled', {
    controlAction: 'cancel',
    previousStatus: 'running',
    previousApprovalState: 'approved',
    reason: 'operator requested running cancellation',
    workerAttempt: 1,
    workerLeaseId: 'repair-audit-contract-worker',
    cooperative: true,
    cancellationRequestedAt: '2026-06-22T13:10:00.000Z',
    sideEffectsApplied: false,
  });
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_audit_events
      SET metadata = jsonb_set(
        metadata,
        ${'{sideEffectsApplied}'}::text[],
        ${'true'}::jsonb
      )
      WHERE id = ${cooperativeCancelledEventId}
    `,
    { message: /ai_repair_execution_audit_metadata_contract_check/ }
  );

  const manualRetryEventId = `audit-contract-manual-retry-${created.record.id}`;
  await insertAuditEvent(manualRetryEventId, 'manual_retry_requested', {
    controlAction: 'retry',
    previousStatus: 'failed',
    previousFailureCode: 'unsupported_executor_payload',
    previousFailureMessage: 'Unsupported executor payload',
    previousExecutorPayloadFingerprint: 'previous-executor-payload-fp',
    currentExecutorPayloadFingerprint: 'current-executor-payload-fp',
    reason: 'operator corrected executor payload',
    workerAttempt: 1,
    workerMaxAttempts: 1,
    nextWorkerMaxAttempts: 2,
  });
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_audit_events
      SET metadata = jsonb_set(
        metadata,
        ${'{nextWorkerMaxAttempts}'}::text[],
        ${'0'}::jsonb
      )
      WHERE id = ${manualRetryEventId}
    `,
    { message: /ai_repair_execution_audit_metadata_contract_check/ }
  );

  const staleRecoveredEventId = `audit-contract-stale-recovered-${created.record.id}`;
  await insertAuditEvent(staleRecoveredEventId, 'stale_recovered', {
    controlAction: 'recover_stale',
    recoverySource: 'manual',
    previousStatus: 'running',
    previousWorkerLeaseId: 'repair-audit-contract-stale-worker',
    previousWorkerLeaseExpiresAt: '2026-06-22T13:00:00.000Z',
    reason: 'worker heartbeat expired',
    retryScheduled: true,
    nextStatus: 'queued',
    workerAttempt: 1,
    workerMaxAttempts: 3,
  });
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_audit_events
      SET metadata = jsonb_set(
        metadata,
        ${'{nextStatus}'}::text[],
        ${JSON.stringify('failed')}::jsonb
      )
      WHERE id = ${staleRecoveredEventId}
    `,
    { message: /ai_repair_execution_audit_metadata_contract_check/ }
  );
});

test('repair execution model hydrates legacy malformed persisted JSON safely', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const created = await app.models.copilotRepairExecution.createOrReuse({
    workspaceId: workspace.id,
    actorId: owner.id,
    promptName: 'Repair hydration guard prompt',
    requestedAction: 'publish_prompt_registry_revision',
    approvalRequired: false,
    permissionStatus: 'granted',
    idempotencyKey: 'repair-hydration-guard',
    idempotencyFingerprint: 'idempotency-fp',
    requestFingerprint: 'request-fp',
    candidateEvidenceSetFingerprint: 'candidate-fp',
    taskRouteEvidenceSetFingerprint: 'task-route-fp',
    targetLocatorFingerprint: 'target-fp',
    repairJobFingerprint: 'repair-job-fp',
    approvalRecordFingerprint: 'approval-fp',
    auditEventFingerprint: 'audit-fp',
    executorPayload: {
      version: 'repair-execution-test-payload/v1',
      kind: 'repair_execution_test_payload',
      retained: true,
    },
  });

  await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET
      runtime_result = ${JSON.stringify({
        executor: '  legacy_executor  ',
        message: `  ${'x'.repeat(2500)}  `,
        sideEffectFingerprint: `  ${'f'.repeat(200)}  `,
        sideEffectSummary: 'not-an-object',
        sideEffectsApplied: 'yes',
        version: '  repair-execution-runtime-result/v0  ',
      })}::jsonb,
      executor_payload = ${JSON.stringify({
        version: 'repair-execution-test-payload/v1',
        kind: 'repair_execution_test_payload',
        retained: true,
        dropped: undefined,
      })}::jsonb
    WHERE id = ${created.record.id}
  `;

  const hydrated = await app.models.copilotRepairExecution.get(
    workspace.id,
    created.record.id
  );
  t.truthy(hydrated);
  t.is(hydrated?.runtimeResult.version, 'repair-execution-runtime-result/v0');
  t.is(hydrated?.runtimeResult.executor, 'legacy_executor');
  t.false(hydrated?.runtimeResult.sideEffectsApplied);
  t.is(hydrated?.runtimeResult.message.length, 2000);
  t.is(hydrated?.runtimeResult.sideEffectFingerprint?.length, 128);
  t.is(hydrated?.runtimeResult.sideEffectSummary, undefined);
  t.deepEqual(hydrated?.executorPayload, {
    version: 'repair-execution-test-payload/v1',
    kind: 'repair_execution_test_payload',
    retained: true,
  });

  const byIdempotency =
    await app.models.copilotRepairExecution.getByIdempotencyKey(
      workspace.id,
      'repair-hydration-guard'
    );
  t.deepEqual(byIdempotency?.executorPayload, hydrated?.executorPayload);

  const queued =
    await app.models.copilotRepairExecution.listQueuedExecutableRequests({
      limit: 10,
    });
  const queuedRecord = queued.find(record => record.id === created.record.id);
  t.truthy(queuedRecord);
  t.deepEqual(queuedRecord?.executorPayload, hydrated?.executorPayload);
});

test('lists and reads persisted Agent Runtime runs outside repair execution mutation responses', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const otherWorkspace = await createWorkspace(app);
  const promptName = 'Repair runtime list';
  await seedRegistryPrompt(db, promptName);

  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const record =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  const listResult = await app.gql({
    query: agentRuntimeRunsQuery,
    variables: {
      limit: 5,
      workspaceId: workspace.id,
    },
  });
  const agentRuns = listResult.currentUser.copilot.agentRuns;
  t.is(agentRuns.length, 1);
  t.is(agentRuns[0].id, record.agentRun.id);
  t.is(agentRuns[0].workspaceId, workspace.id);
  t.is(agentRuns[0].actorId, owner.id);
  t.is(agentRuns[0].workflow, 'prompt_registry_repair_execution');
  t.is(agentRuns[0].sourceType, 'repair_execution_request');
  t.is(agentRuns[0].sourceId, record.id);
  t.is(agentRuns[0].status, 'waiting_approval');
  t.is(agentRuns[0].steps.length, 1);
  t.is(agentRuns[0].steps[0].stepKey, 'repair_execution');
  t.is(agentRuns[0].steps[0].stepType, 'approval');
  t.is(agentRuns[0].steps[0].status, 'waiting_approval');
  t.deepEqual(
    agentRuns[0].timelineEvents.map(
      (event: { eventType: string; status: string }) => [
        event.eventType,
        event.status,
      ]
    ),
    [
      ['run_status', 'waiting_approval'],
      ['approval_step', 'waiting_approval'],
    ]
  );

  const detailResult = await app.gql({
    query: agentRuntimeRunQuery,
    variables: {
      id: record.agentRun.id,
      workspaceId: workspace.id,
    },
  });
  const detail = detailResult.currentUser.copilot.agentRun;
  t.is(detail.id, record.agentRun.id);
  t.is(detail.sourceId, record.id);
  t.is(detail.steps[0].outputSummary.repairExecutionRequestId, record.id);
  t.is(detail.timelineEvents[0].payload.sourceType, 'repair_execution_request');

  const otherWorkspaceListResult = await app.gql({
    query: agentRuntimeRunsQuery,
    variables: {
      limit: 5,
      workspaceId: otherWorkspace.id,
    },
  });
  t.deepEqual(otherWorkspaceListResult.currentUser.copilot.agentRuns, []);

  const missingDetailResult = await app.gql({
    query: agentRuntimeRunQuery,
    variables: {
      id: record.agentRun.id,
      workspaceId: otherWorkspace.id,
    },
  });
  t.is(missingDetailResult.currentUser.copilot.agentRun, null);

  const outsider = await app.createUser();
  await app.login(outsider);
  await app.switchUser(outsider);
  await t.throwsAsync(
    app.gql({
      query: agentRuntimeRunsQuery,
      variables: {
        limit: 5,
        workspaceId: workspace.id,
      },
    })
  );
  await app.login(owner);
  await app.switchUser(owner);

  const persistedRows = await db.$queryRaw<
    Array<{ runCount: number; stepCount: number; timelineCount: number }>
  >`
    SELECT
      (SELECT COUNT(*)::int FROM ai_agent_runs WHERE workspace_id = ${workspace.id}) AS "runCount",
      (SELECT COUNT(*)::int FROM ai_agent_steps WHERE workspace_id = ${workspace.id}) AS "stepCount",
      (SELECT COUNT(*)::int FROM ai_agent_timeline_events WHERE workspace_id = ${workspace.id}) AS "timelineCount"
  `;
  t.deepEqual(persistedRows, [
    {
      runCount: 1,
      stepCount: 1,
      timelineCount: 2,
    },
  ]);
});

test('projects Copilot tasks by actor and rejects cross-actor controls', async t => {
  const { app, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const member = await app.createUser();
  await models.workspaceUser.set(
    workspace.id,
    member.id,
    WorkspaceRole.Collaborator,
    { status: WorkspaceMemberStatus.Accepted }
  );

  const ownerRun = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'workspace_doc_update',
    sourceType: 'agent_runtime_office_task',
    sourceId: 'owner-copilot-task',
    status: 'waiting_approval',
    title: 'Update owner document',
    steps: [
      {
        stepKey: 'approve_doc_update',
        stepType: 'approval',
        status: 'waiting_approval',
        title: 'Approve document update',
        outputSummary: {
          approvalRequest: { docId: 'owner-doc' },
        },
      },
      {
        stepKey: 'update_doc',
        stepType: 'tool',
        status: 'waiting_approval',
        title: 'Update document',
        outputSummary: {
          docUpdateRequest: { docId: 'owner-doc' },
        },
      },
    ],
  });
  const memberRun = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: member.id,
    workflow: 'workspace_doc_update',
    sourceType: 'agent_runtime_office_task',
    sourceId: 'member-copilot-task',
    status: 'waiting_approval',
    title: 'Update member document',
    steps: [
      {
        stepKey: 'approve_doc_update',
        stepType: 'approval',
        status: 'waiting_approval',
      },
    ],
  });

  const ownerTasks = await app.gql({
    query: copilotTasksQuery,
    variables: {
      taskId: memberRun.id,
      workspaceId: workspace.id,
    },
  });
  t.deepEqual(
    ownerTasks.currentUser.copilot.copilotTasks.map(
      (task: { id: string }) => task.id
    ),
    [ownerRun.id]
  );
  t.is(ownerTasks.currentUser.copilot.copilotTask, null);
  const ownerTask = ownerTasks.currentUser.copilot.copilotTasks[0];
  t.deepEqual(ownerTask.availableActions, ['approve', 'reject']);
  t.is(ownerTask.approval.status, 'waiting');
  t.deepEqual(ownerTask.artifacts, [
    {
      kind: 'document',
      id: 'owner-doc',
      title: 'Update owner document',
    },
  ]);

  await t.throwsAsync(
    app.gql({
      query: copilotTaskControlMutation,
      variables: {
        input: {
          workspaceId: workspace.id,
          taskId: memberRun.id,
          action: 'approve',
        },
      },
    })
  );

  const approved = await app.gql({
    query: copilotTaskControlMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        taskId: ownerRun.id,
        action: 'approve',
      },
    },
  });
  t.is(approved.controlCopilotTask.status, 'queued');
  t.deepEqual(approved.controlCopilotTask.availableActions, ['cancel']);
  t.is(approved.controlCopilotTask.approval.status, 'approved');

  const cancelled = await app.gql({
    query: copilotTaskControlMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        taskId: ownerRun.id,
        action: 'cancel',
      },
    },
  });
  t.is(cancelled.controlCopilotTask.status, 'cancelled');
  t.deepEqual(cancelled.controlCopilotTask.availableActions, ['resume']);

  const resumed = await app.gql({
    query: copilotTaskControlMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        taskId: ownerRun.id,
        action: 'resume',
      },
    },
  });
  t.is(resumed.controlCopilotTask.status, 'queued');
  t.deepEqual(resumed.controlCopilotTask.availableActions, ['cancel']);

  await app.login(member);
  await app.switchUser(member);
  const memberTasks = await app.gql({
    query: copilotTasksQuery,
    variables: {
      taskId: memberRun.id,
      workspaceId: workspace.id,
    },
  });
  t.deepEqual(
    memberTasks.currentUser.copilot.copilotTasks.map(
      (task: { id: string }) => task.id
    ),
    [memberRun.id]
  );
  t.is(memberTasks.currentUser.copilot.copilotTask.id, memberRun.id);

  await app.login(owner);
  await app.switchUser(owner);
});

test('creates generic Agent Runtime runs with tool, Codex, and MCP steps', async t => {
  const { app, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const run = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_generic_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'generic-runtime-run',
    status: 'queued',
    title: 'Generic agent runtime run',
    target: {
      promptName: 'generic runtime',
    },
    evidence: {
      source: 'e2e',
    },
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
        outputSummary: {
          toolName: 'workspace-search',
        },
      },
      {
        stepKey: 'codex_patch',
        stepType: 'codex',
        outputSummary: {
          sandbox: 'read-write',
        },
      },
      {
        stepKey: 'mcp_fetch',
        stepType: 'mcp',
        outputSummary: {
          server: 'localmind-test',
        },
      },
    ],
  });

  t.is(run.workspaceId, workspace.id);
  t.is(run.actorId, owner.id);
  t.is(run.workflow, 'agent_runtime_generic_e2e');
  t.is(run.sourceType, 'agent_runtime_test');
  t.is(run.sourceId, 'generic-runtime-run');
  t.is(run.status, 'queued');
  t.is(run.steps.length, 3);
  t.deepEqual(
    run.steps.map(step => [step.stepKey, step.stepType, step.status]),
    [
      ['tool_lookup', 'tool', 'pending'],
      ['codex_patch', 'codex', 'pending'],
      ['mcp_fetch', 'mcp', 'pending'],
    ]
  );
  t.is(run.steps[0].outputSummary.toolName, 'workspace-search');
  t.deepEqual(
    run.timelineEvents.map(event => [event.eventType, event.status]),
    [
      ['run_status', 'queued'],
      ['tool_step', 'pending'],
      ['codex_step', 'pending'],
      ['mcp_step', 'pending'],
    ]
  );

  const listResult = await app.gql({
    query: agentRuntimeRunsQuery,
    variables: {
      limit: 5,
      workspaceId: workspace.id,
    },
  });
  t.true(
    listResult.currentUser.copilot.agentRuns.some(
      (item: { id: string }) => item.id === run.id
    )
  );

  const statusFilteredRuns = await app.gql({
    query: agentRuntimeRunsQuery,
    variables: {
      limit: 5,
      workspaceId: workspace.id,
      filter: {
        status: 'queued',
      },
    },
  });
  t.true(
    statusFilteredRuns.currentUser.copilot.agentRuns.some(
      (item: { id: string; status: string }) =>
        item.id === run.id && item.status === 'queued'
    )
  );

  const sourceFilteredRuns = await app.gql({
    query: agentRuntimeRunsQuery,
    variables: {
      limit: 5,
      workspaceId: workspace.id,
      filter: {
        sourceType: 'agent_runtime_test',
        sourceId: 'generic-runtime-run',
      },
    },
  });
  t.deepEqual(
    sourceFilteredRuns.currentUser.copilot.agentRuns.map(
      (item: { id: string }) => item.id
    ),
    [run.id]
  );

  const locatorFilteredRuns = await app.gql({
    query: agentRuntimeRunsQuery,
    variables: {
      limit: 5,
      workspaceId: workspace.id,
      filter: {
        query: run.evidenceFingerprint,
      },
    },
  });
  t.deepEqual(
    locatorFilteredRuns.currentUser.copilot.agentRuns.map(
      (item: { id: string }) => item.id
    ),
    [run.id]
  );

  const missingFilteredRuns = await app.gql({
    query: agentRuntimeRunsQuery,
    variables: {
      limit: 5,
      workspaceId: workspace.id,
      filter: {
        status: 'failed',
        query: 'missing-agent-runtime-run',
      },
    },
  });
  t.deepEqual(missingFilteredRuns.currentUser.copilot.agentRuns, []);

  const detailResult = await app.gql({
    query: agentRuntimeRunQuery,
    variables: {
      id: run.id,
      workspaceId: workspace.id,
    },
  });
  t.is(detailResult.currentUser.copilot.agentRun.id, run.id);
  t.is(
    detailResult.currentUser.copilot.agentRun.timelineEvents[3].eventType,
    'mcp_step'
  );

  const reused = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_generic_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'generic-runtime-run',
    steps: [
      {
        stepKey: 'different',
        stepType: 'model',
      },
    ],
  });
  t.is(reused.id, run.id);

  await t.throwsAsync(
    models.copilotAgentRuntime.createRun({
      workspaceId: workspace.id,
      actorId: owner.id,
      workflow: 'agent_runtime_empty_e2e',
      sourceType: 'agent_runtime_test',
      sourceId: 'empty-runtime-run',
      steps: [],
    })
  );
  await t.throwsAsync(
    models.copilotAgentRuntime.createRun({
      workspaceId: workspace.id,
      actorId: owner.id,
      workflow: 'agent_runtime_generic_e2e',
      sourceType: 'repair_execution_request',
      sourceId: 'generic-runtime-repair-source-drift',
      steps: [
        {
          stepKey: 'model_context',
          stepType: 'model',
        },
      ],
    }),
    {
      message: 'Agent runtime repair execution source/workflow pair is invalid',
    }
  );
});

test('generic Agent Runtime creation reuses run when source insert conflicts after pre-read miss', async t => {
  const { app, db, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const createInput = {
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_conflict_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'agent-runtime-source-insert-conflict',
    steps: [
      {
        stepKey: 'model_context',
        stepType: 'model' as const,
      },
    ],
  };
  const existing = await models.copilotAgentRuntime.createRun(createInput);

  const originalGetBySource = models.copilotAgentRuntime.getBySource.bind(
    models.copilotAgentRuntime
  );
  let forcedPreReadMiss = false;
  models.copilotAgentRuntime.getBySource = (async (
    workspaceId: string,
    sourceType: string,
    sourceId: string
  ) => {
    if (!forcedPreReadMiss) {
      forcedPreReadMiss = true;
      t.is(workspaceId, workspace.id);
      t.is(sourceType, createInput.sourceType);
      t.is(sourceId, createInput.sourceId);
      return null;
    }
    return await originalGetBySource(workspaceId, sourceType, sourceId);
  }) as typeof models.copilotAgentRuntime.getBySource;

  try {
    const reused = await models.copilotAgentRuntime.createRun(createInput);
    t.is(reused.id, existing.id);
  } finally {
    models.copilotAgentRuntime.getBySource =
      originalGetBySource as typeof models.copilotAgentRuntime.getBySource;
  }
  t.true(forcedPreReadMiss);

  const rows = await db.$queryRaw<
    Array<{ runCount: number; stepCount: number; timelineCount: number }>
  >`
    SELECT
      (
        SELECT COUNT(*)::int
        FROM ai_agent_runs
        WHERE workspace_id = ${workspace.id}
          AND source_type = ${createInput.sourceType}
          AND source_id = ${createInput.sourceId}
      ) AS "runCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps
        WHERE run_id = ${existing.id}
      ) AS "stepCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events
        WHERE run_id = ${existing.id}
      ) AS "timelineCount"
  `;
  t.deepEqual(rows, [
    {
      runCount: 1,
      stepCount: 1,
      timelineCount: 2,
    },
  ]);
});

test('generic Agent Runtime source conflict rejects mismatched create evidence', async t => {
  const { app, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const sourceType = 'agent_runtime_test';
  const sourceId = 'agent-runtime-source-insert-conflict-drift';

  const existing = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_existing_conflict_e2e',
    sourceType,
    sourceId,
    target: {
      fixture: 'existing target',
    },
    evidence: {
      fixture: 'existing evidence',
    },
    steps: [
      {
        stepKey: 'existing_model_context',
        stepType: 'model',
      },
    ],
  });

  const originalGetBySource = models.copilotAgentRuntime.getBySource.bind(
    models.copilotAgentRuntime
  );
  let forcedPreReadMiss = false;
  models.copilotAgentRuntime.getBySource = (async (
    workspaceId: string,
    currentSourceType: string,
    currentSourceId: string
  ) => {
    if (!forcedPreReadMiss) {
      forcedPreReadMiss = true;
      t.is(workspaceId, workspace.id);
      t.is(currentSourceType, sourceType);
      t.is(currentSourceId, sourceId);
      return null;
    }
    return await originalGetBySource(
      workspaceId,
      currentSourceType,
      currentSourceId
    );
  }) as typeof models.copilotAgentRuntime.getBySource;

  try {
    await t.throwsAsync(
      models.copilotAgentRuntime.createRun({
        workspaceId: workspace.id,
        actorId: owner.id,
        workflow: 'agent_runtime_conflicting_conflict_e2e',
        sourceType,
        sourceId,
        target: {
          fixture: 'conflicting target',
        },
        evidence: {
          fixture: 'conflicting evidence',
        },
        steps: [
          {
            stepKey: 'conflicting_tool_context',
            stepType: 'tool',
          },
        ],
      }),
      {
        message: /Agent runtime run conflict reused mismatched create evidence/,
      }
    );
  } finally {
    models.copilotAgentRuntime.getBySource =
      originalGetBySource as typeof models.copilotAgentRuntime.getBySource;
  }
  t.true(forcedPreReadMiss);

  const persisted = await models.copilotAgentRuntime.get(
    workspace.id,
    existing.id
  );
  t.truthy(persisted);
  t.is(persisted?.workflow, 'agent_runtime_existing_conflict_e2e');
  t.is(persisted?.steps[0]?.stepKey, 'existing_model_context');
});

test('generic Agent Runtime creation normalizes and bounds persisted inputs', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: '  agent_runtime_normalized_e2e  ',
    sourceType: '  agent_runtime_test  ',
    sourceId: '  normalized-runtime-run  ',
    status: 'queued',
    title: '  Normalized runtime run  ',
    target: {
      promptName: 'normalized runtime',
    },
    evidence: {
      source: 'e2e',
    },
    steps: [
      {
        stepKey: '  model_context  ',
        stepType: 'model',
        title: '  Model context  ',
        outputSummary: {
          version: 'caller-supplied-version',
          summary: '  model output  ',
        },
      },
    ],
  });

  t.is(run.workflow, 'agent_runtime_normalized_e2e');
  t.is(run.sourceType, 'agent_runtime_test');
  t.is(run.sourceId, 'normalized-runtime-run');
  t.is(run.title, 'Normalized runtime run');
  t.is(run.steps[0].stepKey, 'model_context');
  t.is(run.steps[0].title, 'Model context');
  t.is(
    run.steps[0].outputSummary.version,
    'agent-runtime-step-output-summary/v1'
  );
  t.is(run.steps[0].outputSummary.summary, '  model output  ');
  t.like(run.timelineEvents[0].payload, {
    workflow: 'agent_runtime_normalized_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'normalized-runtime-run',
  });

  const mixedStatusRun = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_mixed_step_status_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'mixed-step-status-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'completed_context',
        stepType: 'tool',
        status: 'completed',
      },
    ],
  });
  t.is(mixedStatusRun.status, 'queued');
  t.is(mixedStatusRun.completedAt, null);
  t.is(mixedStatusRun.steps[0].status, 'completed');
  t.truthy(mixedStatusRun.steps[0].completedAt);

  const reused = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_normalized_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'normalized-runtime-run',
    steps: [
      {
        stepKey: 'different',
        stepType: 'tool',
      },
    ],
  });
  t.is(reused.id, run.id);

  await t.throwsAsync(
    app.models.copilotAgentRuntime.createRun({
      workspaceId: workspace.id,
      actorId: owner.id,
      workflow: 'x'.repeat(513),
      sourceType: 'agent_runtime_test',
      sourceId: 'overlong-runtime-run',
      steps: [
        {
          stepKey: 'model_context',
          stepType: 'model',
        },
      ],
    }),
    { message: 'Agent runtime workflow is too long' }
  );
  await t.throwsAsync(
    app.models.copilotAgentRuntime.createRun({
      workspaceId: workspace.id,
      actorId: owner.id,
      workflow: 'agent_runtime_bad_step_e2e',
      sourceType: 'agent_runtime_test',
      sourceId: 'bad-step-runtime-run',
      steps: [
        {
          stepKey: 'model_context',
          stepType: 'browser' as never,
        },
      ],
    }),
    { message: 'Agent runtime step type is invalid' }
  );
  await t.throwsAsync(
    app.models.copilotAgentRuntime.createRun({
      workspaceId: workspace.id,
      actorId: owner.id,
      workflow: 'agent_runtime_large_payload_e2e',
      sourceType: 'agent_runtime_test',
      sourceId: 'large-payload-runtime-run',
      target: {
        body: 'x'.repeat(9000),
      },
      steps: [
        {
          stepKey: 'model_context',
          stepType: 'model',
        },
      ],
    }),
    { message: 'Agent runtime target is too large' }
  );

  const countRows = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count"
    FROM ai_agent_runs
    WHERE workspace_id = ${workspace.id}
      AND source_id IN (
        ${'overlong-runtime-run'},
        ${'bad-step-runtime-run'},
        ${'large-payload-runtime-run'}
      )
  `;
  t.is(countRows[0].count, 0);

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET worker_attempt = ${-1}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_worker_attempts_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET worker_lease_expires_at = ${new Date('2026-06-22T13:20:00.000Z')}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_worker_lease_pair_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET
        worker_lease_id = ${'   '},
        worker_lease_expires_at = ${new Date('2026-06-22T13:21:00.000Z')}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_worker_lease_id_shape_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET
        worker_lease_id = ${'queued-agent-worker-lease'},
        worker_lease_expires_at = ${new Date('2026-06-22T13:22:00.000Z')}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_worker_lease_status_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET output_summary = ${JSON.stringify(['not-an-output-summary'])}::jsonb
      WHERE run_id = ${run.id}
    `,
    { message: /ai_agent_steps_output_summary_shape_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET payload = ${JSON.stringify('not-a-payload')}::jsonb
      WHERE run_id = ${run.id}
        AND ordinal = ${0}
    `,
    { message: /ai_agent_timeline_events_payload_shape_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET output_summary = ${JSON.stringify({
        workerFailure: {
          version: 'agent-runtime-worker-failure/v1',
          adapterResolution: {
            version: 'agent-runtime-worker-adapter-resolution/v1',
            status: 'unknown_adapter_resolution',
            workflow: 'agent_runtime_worker_e2e',
            requestedStepTypes: ['model'],
          },
        },
      })}::jsonb
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_steps_worker_failure_adapter_resolution_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET payload = ${JSON.stringify({
        version: 'agent-runtime-worker-failure/v1',
        adapterResolution: {
          version: 'agent-runtime-worker-adapter-resolution/v1',
          status: 'unsupported_workflow',
          workflow: 'agent_runtime_worker_e2e',
          requestedStepTypes: [],
        },
      })}::jsonb
      WHERE run_id = ${run.id}
        AND ordinal = ${0}
    `,
    {
      message: /ai_agent_timeline_events_adapter_resolution_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET payload = ${JSON.stringify({
        version: 'agent-runtime-worker-failure/v1',
        failureCode: 'adapter_resolution_capability_drift',
        failureMessage: 'Adapter resolution capability drift.',
        workerAttempt: 1,
        workerMaxAttempts: 1,
        workerLeaseId: 'adapter-resolution-capability-e2e',
        workflow: 'agent_runtime_worker_e2e',
        sourceType: 'agent_runtime_test',
        sourceId: 'worker-runtime-run',
        adapterResolution: {
          version: 'agent-runtime-worker-adapter-resolution/v1',
          status: 'execution_failed',
          workflow: 'agent_runtime_worker_e2e',
          requestedStepTypes: ['model'],
          registeredAdapters: [
            {
              workflow: 'agent_runtime_record_only',
              supportedStepTypes: ['model'],
              sideEffectMode: 'none',
            },
          ],
          adapter: {
            workflow: 'agent_runtime_worker_e2e',
            supportedStepTypes: ['model'],
            sideEffectMode: 'none',
          },
        },
      })}::jsonb
      WHERE run_id = ${run.id}
        AND ordinal = ${0}
    `,
    {
      message: /ai_agent_timeline_events_adapter_resolution_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET output_summary = ${JSON.stringify({
        workerFailure: {
          version: 'agent-runtime-worker-failure/v1',
          failureCode: 'adapter_resolution_capability_drift',
          failureMessage: 'Adapter resolution capability drift.',
          workerAttempt: 1,
          workerLeaseId: 'adapter-resolution-capability-e2e',
          adapterResolution: {
            version: 'agent-runtime-worker-adapter-resolution/v1',
            status: 'unsupported_contract',
            workflow: 'agent_runtime_worker_e2e',
            requestedStepTypes: ['codex', 'model'],
            unsupportedStepTypes: ['model'],
            registeredAdapters: [
              {
                workflow: 'agent_runtime_worker_e2e',
                supportedStepTypes: ['model'],
                sideEffectMode: 'none',
              },
            ],
            adapter: {
              workflow: 'agent_runtime_worker_e2e',
              supportedStepTypes: ['model'],
              sideEffectMode: 'none',
            },
          },
        },
      })}::jsonb
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_steps_worker_failure_adapter_resolution_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET output_summary = ${JSON.stringify({
        workerFailure: {
          version: 'agent-runtime-worker-failure/v1',
          failureCode: 'adapter_resolution_capability_drift',
          failureMessage: 'Adapter resolution capability drift.',
          workerAttempt: 1,
          workerLeaseId: 'adapter-resolution-capability-e2e',
          adapterResolution: {
            version: 'agent-runtime-worker-adapter-resolution/v1',
            status: 'unsupported_workflow',
            workflow: 'agent_runtime_worker_e2e',
            requestedStepTypes: ['model'],
          },
        },
      })}::jsonb
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_steps_worker_failure_adapter_resolution_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET output_summary = ${JSON.stringify({
        workerFailure: {
          version: 'agent-runtime-worker-failure/v1',
          failureCode: 'adapter_resolution_capability_drift',
          failureMessage: 'Adapter resolution capability drift.',
          workerAttempt: 1,
          workerLeaseId: 'adapter-resolution-capability-e2e',
          adapterResolution: {
            version: 'agent-runtime-worker-adapter-resolution/v1',
            status: 'unsupported_contract',
            workflow: 'agent_runtime_worker_e2e',
            requestedStepTypes: ['codex', 'model'],
            registeredAdapters: [
              {
                workflow: 'agent_runtime_worker_e2e',
                supportedStepTypes: ['model'],
                sideEffectMode: 'none',
              },
            ],
            adapter: {
              workflow: 'agent_runtime_worker_e2e',
              supportedStepTypes: ['model'],
              sideEffectMode: 'none',
            },
          },
        },
      })}::jsonb
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_steps_worker_failure_adapter_resolution_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET payload = ${JSON.stringify({
        version: 'agent-runtime-worker-failure/v1',
        failureCode: 'adapter_resolution_capability_drift',
        failureMessage: 'Adapter resolution capability drift.',
        workerAttempt: 1,
        workerMaxAttempts: 1,
        workerLeaseId: 'adapter-resolution-capability-e2e',
        workflow: 'agent_runtime_worker_e2e',
        sourceType: 'agent_runtime_test',
        sourceId: 'worker-runtime-run',
        adapterResolution: {
          version: 'agent-runtime-worker-adapter-resolution/v1',
          status: 'execution_failed',
          workflow: 'agent_runtime_worker_e2e',
          requestedStepTypes: ['model'],
          registeredAdapters: [
            {
              workflow: 'agent_runtime_worker_e2e',
              supportedStepTypes: ['model'],
              sideEffectMode: 'unknown_side_effect_mode',
            },
          ],
          adapter: {
            workflow: 'agent_runtime_worker_e2e',
            supportedStepTypes: ['model'],
            sideEffectMode: 'none',
          },
        },
      })}::jsonb
      WHERE run_id = ${run.id}
        AND ordinal = ${0}
    `,
    {
      message: /ai_agent_timeline_events_adapter_resolution_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET output_summary = ${JSON.stringify({
        workerFailure: {
          version: 'agent-runtime-worker-failure/v1',
          failureCode: 'worker_failure_payload_drift',
          workerAttempt: 1,
          workerLeaseId: 'worker-failure-payload-e2e',
        },
      })}::jsonb
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_steps_worker_failure_payload_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET payload = ${JSON.stringify({
        version: 'agent-runtime-worker-failure/v1',
        failureCode: 'worker_failure_payload_drift',
        failureMessage: 'Worker failure payload drift.',
        workerAttempt: 1,
        workerMaxAttempts: 1,
        workerLeaseId: 'worker-failure-payload-e2e',
        sourceType: 'agent_runtime_test',
        sourceId: 'worker-runtime-run',
      })}::jsonb
      WHERE run_id = ${run.id}
        AND ordinal = ${0}
    `,
    {
      message: /ai_agent_timeline_worker_failure_payload_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET payload = ${JSON.stringify({
        version: 'agent-runtime-worker-failure/v1',
        failureCode: 'worker_failure_payload_drift',
        failureMessage: 'Worker failure payload drift.',
        stepKey: 'tool_lookup',
        stepType: 'unsupported_step',
        workerAttempt: 1,
        workerLeaseId: 'worker-failure-payload-e2e',
      })}::jsonb
      WHERE run_id = ${run.id}
        AND ordinal = ${1}
    `,
    {
      message: /ai_agent_timeline_worker_failure_payload_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET output_summary = ${JSON.stringify({
        workerLease: {
          version: 'agent-runtime-worker-step-lease/v1',
          executor: 'agent_runtime_worker',
          workerAttempt: 0,
          workerLeaseId: 'worker-lease-payload-e2e',
        },
      })}::jsonb
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_steps_worker_lease_payload_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET payload = ${JSON.stringify({
        version: 'agent-runtime-worker-lease/v1',
        executor: 'agent_runtime_worker',
        workerAttempt: 1,
        workerLeaseId: 'worker-lease-payload-e2e',
        workflow: 'agent_runtime_worker_e2e',
        sourceType: 'agent_runtime_test',
        sourceId: 'worker-runtime-run',
      })}::jsonb
      WHERE run_id = ${run.id}
        AND ordinal = ${0}
    `,
    {
      message: /ai_agent_timeline_events_worker_lease_payload_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET payload = ${JSON.stringify({
        version: 'agent-runtime-worker-step-lease/v1',
        executor: 'agent_runtime_worker',
        stepKey: 'tool_lookup',
        stepType: 'unsupported_step',
        workerAttempt: 1,
        workerLeaseId: 'worker-lease-payload-e2e',
        workflow: 'agent_runtime_worker_e2e',
        sourceType: 'agent_runtime_test',
        sourceId: 'worker-runtime-run',
      })}::jsonb
      WHERE run_id = ${run.id}
        AND ordinal = ${0}
    `,
    {
      message: /ai_agent_timeline_events_worker_lease_payload_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET output_summary = ${JSON.stringify({
        recordOnlyExecution: {
          version: 'agent-runtime-record-only-execution/v1',
          executor: 'agent_runtime_record_only_adapter',
          summary: '   ',
          sideEffectsApplied: false,
          workerAttempt: 1,
          workerLeaseId: 'record-only-payload-e2e',
        },
      })}::jsonb
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_steps_record_only_payload_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET payload = ${JSON.stringify({
        version: 'agent-runtime-record-only-execution/v1',
        executor: 'agent_runtime_record_only_adapter',
        summary: 'record-only run completed',
        sideEffectsApplied: true,
        workerAttempt: 1,
        workerMaxAttempts: 1,
        workerLeaseId: 'record-only-payload-e2e',
        workflow: 'agent_runtime_record_only',
        sourceType: 'agent_runtime_test',
        sourceId: 'record-only-runtime-run',
      })}::jsonb
      WHERE run_id = ${run.id}
        AND ordinal = ${0}
    `,
    {
      message: /ai_agent_timeline_record_only_payload_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET payload = ${JSON.stringify({
        version: 'agent-runtime-record-only-execution/v1',
        executor: 'agent_runtime_record_only_adapter',
        summary: 'record-only step completed',
        stepKey: 'tool_lookup',
        stepType: 'unsupported_step',
        workerAttempt: 1,
        workerLeaseId: 'record-only-payload-e2e',
      })}::jsonb
      WHERE run_id = ${run.id}
        AND ordinal = ${1}
    `,
    {
      message: /ai_agent_timeline_record_only_payload_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET output_summary = ${JSON.stringify({
        manualControl: {
          version: 'agent-runtime-manual-control/v1',
          action: 'pause',
          actorId: owner.id,
          reason: 'unsupported manual control',
        },
      })}::jsonb
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_steps_manual_control_payload_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET
        event_type = ${'run_cancellation'},
        status = ${'cancelled'},
        payload = ${JSON.stringify({
          version: 'agent-runtime-manual-control/v1',
          action: 'cancel',
          actorId: owner.id,
          workflow: 'agent_runtime_control_e2e',
          sourceType: 'agent_runtime_test',
          sourceId: 'control-runtime-run',
          controlledAt: '2026-06-22T13:22:00.000Z',
          reason: 'missing previous status',
        })}::jsonb
      WHERE run_id = ${run.id}
        AND ordinal = ${0}
    `,
    {
      message: /ai_agent_timeline_manual_control_payload_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET
        event_type = ${'run_status'},
        status = ${'queued'},
        payload = ${JSON.stringify({
          version: 'agent-runtime-manual-control/v1',
          action: 'cancel',
          actorId: owner.id,
          previousStatus: 'failed',
          workflow: 'agent_runtime_control_e2e',
          sourceType: 'agent_runtime_test',
          sourceId: 'control-runtime-run',
          controlledAt: '2026-06-22T13:23:00.000Z',
          reason: 'action status mismatch',
        })}::jsonb
      WHERE run_id = ${run.id}
        AND ordinal = ${1}
    `,
    {
      message: /ai_agent_timeline_manual_control_payload_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET output_summary = ${JSON.stringify({
        staleLeaseRecovery: {
          version: 'agent-runtime-stale-lease-recovery/v1',
          executor: 'agent_runtime_stale_recovery_worker',
          reason: 'retry flag drift',
          retryScheduled: true,
          nextStatus: 'failed',
          workerAttempt: 1,
          workerMaxAttempts: 2,
          previousWorkerLeaseId: 'stale-lease-payload-e2e',
          previousWorkerLeaseExpiresAt: '2026-06-22T13:24:00.000Z',
        },
      })}::jsonb
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_steps_stale_lease_payload_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET
        event_type = ${'run_status'},
        status = ${'queued'},
        payload = ${JSON.stringify({
          version: 'agent-runtime-stale-lease-recovery/v1',
          executor: 'agent_runtime_stale_recovery_worker',
          previousStatus: 'running',
          previousWorkerLeaseId: 'stale-lease-payload-e2e',
          previousWorkerLeaseExpiresAt: '2026-06-22T13:25:00.000Z',
          reason: 'missing workflow context',
          retryScheduled: true,
          nextStatus: 'queued',
          workerAttempt: 1,
          workerMaxAttempts: 2,
          sourceType: 'agent_runtime_test',
          sourceId: 'stale-agent-runtime-run',
        })}::jsonb
      WHERE run_id = ${run.id}
        AND ordinal = ${0}
    `,
    {
      message: /ai_agent_timeline_stale_lease_payload_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET
        event_type = ${'run_status'},
        status = ${'failed'},
        payload = ${JSON.stringify({
          version: 'agent-runtime-stale-lease-recovery/v1',
          executor: 'agent_runtime_stale_recovery_worker',
          previousStatus: 'running',
          previousWorkerLeaseId: 'stale-lease-payload-e2e',
          previousWorkerLeaseExpiresAt: '2026-06-22T13:26:00.000Z',
          reason: 'status mismatch',
          retryScheduled: true,
          nextStatus: 'queued',
          workerAttempt: 1,
          workerMaxAttempts: 2,
          workflow: 'agent_runtime_stale_recovery_e2e',
          sourceType: 'agent_runtime_test',
          sourceId: 'stale-agent-runtime-run',
        })}::jsonb
      WHERE run_id = ${run.id}
        AND ordinal = ${1}
    `,
    {
      message: /ai_agent_timeline_stale_lease_payload_check/,
    }
  );
});

test('Agent Runtime hydrates legacy malformed persisted JSON safely', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_hydration_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'hydration-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
        outputSummary: {
          retained: true,
        },
      },
    ],
  });

  await db.$executeRaw`
    INSERT INTO ai_agent_timeline_events (
      id,
      run_id,
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
    VALUES (
      ${'agent-runtime-legacy-malformed-timeline-event'},
      ${run.id},
      ${workspace.id},
      ${owner.id},
      ${'run_status'},
      ${'queued'},
      ${99},
      ${'Legacy malformed timeline payload'},
      ${JSON.stringify({
        sourceType: 42,
      })}::jsonb,
      ${'agent-runtime-legacy-malformed-timeline-fp'},
      ${new Date('2026-06-22T13:00:00.000Z')}
    )
  `;

  const hydrated = await app.models.copilotAgentRuntime.get(
    workspace.id,
    run.id
  );
  t.truthy(hydrated);
  t.deepEqual(hydrated?.steps[0].outputSummary, {
    retained: true,
    version: 'agent-runtime-step-output-summary/v1',
  });
  t.deepEqual(hydrated?.timelineEvents.at(-1)?.payload, {
    sourceType: 42,
  });

  const leased =
    await app.models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      id: run.id,
      leaseMs: 30000,
      workerId: 'agent-runtime-hydration-worker',
      workspaceId: workspace.id,
    });
  t.truthy(leased);
  t.deepEqual(leased?.steps[0].outputSummary, {
    retained: true,
    version: 'agent-runtime-step-output-summary/v1',
    workerLease: {
      executor: 'agent_runtime_worker',
      version: 'agent-runtime-worker-step-lease/v1',
      workerAttempt: 1,
      workerLeaseId: 'agent-runtime-hydration-worker',
    },
  });

  const stepRows = await db.$queryRaw<
    Array<{ outputSummary: Record<string, unknown> }>
  >`
    SELECT output_summary AS "outputSummary"
    FROM ai_agent_steps
    WHERE run_id = ${run.id}
  `;
  t.deepEqual(stepRows[0]?.outputSummary, leased?.steps[0].outputSummary);
});

test('Agent Runtime rejects invalid timeline status rows at the DB boundary', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_timeline_status_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'timeline-status-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
      },
    ],
  });

  await t.throwsAsync(
    db.$executeRaw`
      INSERT INTO ai_agent_timeline_events (
        id,
        run_id,
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
      VALUES (
        ${'timeline-status-invalid-e2e'},
        ${run.id},
        ${workspace.id},
        ${owner.id},
        ${'run_status'},
        ${'ghost_status'},
        ${99},
        ${'Invalid timeline status should be rejected'},
        ${JSON.stringify({})}::jsonb,
        ${'timeline-status-invalid-fp'},
        ${new Date()}
      )
    `,
    { message: /ai_agent_timeline_events_status_check/ }
  );
});

test('repair execution requests require matching audit history at the DB boundary', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const createdAt = new Date('2026-06-22T14:00:00.000Z');
  const runtimeResult = {
    version: 'repair-execution-runtime-result/v1',
    executor: 'queued_repair_execution_worker',
    sideEffectsApplied: false,
    message: 'Execution request persisted and queued for worker execution.',
  };
  const executorPayload = {
    version: 'prompt-registry-revision-executor-payload/v1',
    kind: 'prompt_registry_revision_publish',
    expectedRegistryFingerprint: 'audit-history-registry-fp',
    expectedRegistryId: 1,
    expectedRegistryUpdatedAt: '2026-06-22T14:00:00.000Z',
    operationFingerprints: ['audit-history-operation-fp'],
    operationKinds: ['publish_prompt_registry_revision'],
    operationSetFingerprint: 'audit-history-operation-set-fp',
    previewFingerprint: 'audit-history-preview-fp',
    catalogFingerprint: 'audit-history-catalog-fp',
    fallbackSourceChain: [
      {
        version: 'registry-source-chain/v1',
        source: 'repair_execution_worker',
      },
    ],
  };
  const insertRequest = (
    tx: Pick<PrismaClient, '$executeRaw'>,
    id: string,
    timestamp: Date,
    options: {
      approvalState?: string;
      queuedAt?: Date | null;
      runtimeResult?: Record<string, unknown>;
      status?: string;
    } = {}
  ) => tx.$executeRaw`
    INSERT INTO ai_repair_execution_requests (
      id,
      workspace_id,
      actor_id,
      prompt_name,
      requested_action,
      status,
      approval_state,
      permission_status,
      idempotency_key,
      idempotency_fingerprint,
      request_fingerprint,
      candidate_evidence_set_fingerprint,
      task_route_evidence_set_fingerprint,
      target_locator_fingerprint,
      repair_job_fingerprint,
      approval_record_fingerprint,
      audit_event_fingerprint,
      runtime_result,
      executor_payload,
      queued_at,
      worker_attempt,
      worker_max_attempts,
      created_at,
      updated_at
    )
    VALUES (
      ${id},
      ${workspace.id},
      ${owner.id},
      ${`Audit history ${id}`},
      ${'repair_prompt_registry_revision'},
      ${options.status ?? 'queued'},
      ${options.approvalState ?? 'not_required'},
      ${'granted'},
      ${`audit-history-idempotency-${id}`},
      ${`audit-history-idempotency-fp-${id}`},
      ${`audit-history-request-fp-${id}`},
      ${`audit-history-candidate-fp-${id}`},
      ${`audit-history-task-route-fp-${id}`},
      ${`audit-history-target-fp-${id}`},
      ${`audit-history-repair-job-fp-${id}`},
      ${`audit-history-approval-fp-${id}`},
      ${`audit-history-audit-fp-${id}`},
      ${JSON.stringify(options.runtimeResult ?? runtimeResult)}::jsonb,
      ${JSON.stringify(executorPayload)}::jsonb,
      ${options.queuedAt === undefined ? timestamp : options.queuedAt},
      ${0},
      ${3},
      ${timestamp},
      ${timestamp}
    )
  `;

  await t.throwsAsync(
    db.$transaction(async tx => {
      await insertRequest(tx, 'repair-audit-history-orphan', createdAt);
      await tx.$executeRaw`
        SET CONSTRAINTS "zz_ai_repair_execution_requests_audit_history_required_check" IMMEDIATE
      `;
    }),
    { message: /ai_repair_execution_requests_audit_history_required_check/ }
  );

  await db.$transaction(async tx => {
    await insertRequest(tx, 'repair-audit-history-valid', createdAt);
    await tx.$executeRaw`
      INSERT INTO ai_repair_execution_audit_events (
        id,
        execution_request_id,
        workspace_id,
        actor_id,
        event_type,
        event_fingerprint,
        metadata,
        created_at
      )
      VALUES (
        ${'repair-audit-history-valid-requested'},
        ${'repair-audit-history-valid'},
        ${workspace.id},
        ${owner.id},
        ${'requested'},
        ${'repair-audit-history-valid-requested-fp'},
        ${JSON.stringify({
          approvalRequired: false,
          requestFingerprint:
            'audit-history-request-fp-repair-audit-history-valid',
        })}::jsonb,
        ${createdAt}
      )
    `;
    await tx.$executeRaw`
      INSERT INTO ai_repair_execution_audit_events (
        id,
        execution_request_id,
        workspace_id,
        actor_id,
        event_type,
        event_fingerprint,
        metadata,
        created_at
      )
      VALUES (
        ${'repair-audit-history-valid-queued'},
        ${'repair-audit-history-valid'},
        ${workspace.id},
        ${owner.id},
        ${'queued'},
        ${'repair-audit-history-valid-queued-fp'},
        ${JSON.stringify({
          idempotencyKey:
            'audit-history-idempotency-repair-audit-history-valid',
          queuedAt: createdAt.toISOString(),
        })}::jsonb,
        ${createdAt}
      )
    `;
  });

  const approvalAt = new Date('2026-06-22T14:03:00.000Z');
  const approvalRuntimeResult = {
    version: 'repair-execution-runtime-result/v1',
    executor: 'queued_repair_execution_worker',
    sideEffectsApplied: false,
    message: 'Approval accepted; repair execution queued for worker runtime.',
  };
  await db.$transaction(async tx => {
    await insertRequest(tx, 'repair-approval-audit-required', createdAt, {
      approvalState: 'waiting',
      queuedAt: null,
      runtimeResult: {
        version: 'repair-execution-runtime-result/v1',
        executor: 'approval_gate',
        sideEffectsApplied: false,
        message: 'Execution request persisted and waiting for approval.',
      },
      status: 'waiting_approval',
    });
    await tx.$executeRaw`
      INSERT INTO ai_repair_execution_audit_events (
        id,
        execution_request_id,
        workspace_id,
        actor_id,
        event_type,
        event_fingerprint,
        metadata,
        created_at
      )
      VALUES (
        ${'repair-approval-audit-required-requested'},
        ${'repair-approval-audit-required'},
        ${workspace.id},
        ${owner.id},
        ${'requested'},
        ${'repair-approval-audit-required-requested-fp'},
        ${JSON.stringify({
          approvalRequired: true,
          requestFingerprint:
            'audit-history-request-fp-repair-approval-audit-required',
        })}::jsonb,
        ${createdAt}
      )
    `;
    await tx.$executeRaw`
      INSERT INTO ai_repair_execution_audit_events (
        id,
        execution_request_id,
        workspace_id,
        actor_id,
        event_type,
        event_fingerprint,
        metadata,
        created_at
      )
      VALUES (
        ${'repair-approval-audit-required-waiting'},
        ${'repair-approval-audit-required'},
        ${workspace.id},
        ${owner.id},
        ${'waiting_approval'},
        ${'repair-approval-audit-required-waiting-fp'},
        ${JSON.stringify({ approvalState: 'waiting' })}::jsonb,
        ${createdAt}
      )
    `;
  });

  await t.throwsAsync(
    db.$transaction(async tx => {
      await tx.$executeRaw`
        UPDATE ai_repair_execution_requests
        SET
          status = ${'queued'},
          approval_state = ${'approved'},
          runtime_result = ${JSON.stringify(approvalRuntimeResult)}::jsonb,
          queued_at = ${approvalAt},
          updated_at = ${approvalAt}
        WHERE id = ${'repair-approval-audit-required'}
      `;
      await tx.$executeRaw`
        INSERT INTO ai_repair_execution_audit_events (
          id,
          execution_request_id,
          workspace_id,
          actor_id,
          event_type,
          event_fingerprint,
          metadata,
          created_at
        )
        VALUES (
          ${'repair-approval-audit-required-queued-missing-approval'},
          ${'repair-approval-audit-required'},
          ${workspace.id},
          ${owner.id},
          ${'queued'},
          ${'repair-approval-audit-required-queued-missing-approval-fp'},
          ${JSON.stringify({
            approvalState: 'approved',
            sideEffectsApplied: false,
            queuedAt: approvalAt.toISOString(),
          })}::jsonb,
          ${approvalAt}
        )
      `;
      await tx.$executeRaw`
        SET CONSTRAINTS "zz_ai_repair_execution_approval_audit_required_check" IMMEDIATE
      `;
    }),
    {
      message: /ai_repair_execution_requests_approval_audit_required_check/,
    }
  );

  await db.$transaction(async tx => {
    await tx.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET
        status = ${'queued'},
        approval_state = ${'approved'},
        runtime_result = ${JSON.stringify(approvalRuntimeResult)}::jsonb,
        queued_at = ${approvalAt},
        updated_at = ${approvalAt}
      WHERE id = ${'repair-approval-audit-required'}
    `;
    await tx.$executeRaw`
      INSERT INTO ai_repair_execution_audit_events (
        id,
        execution_request_id,
        workspace_id,
        actor_id,
        event_type,
        event_fingerprint,
        metadata,
        created_at
      )
      VALUES (
        ${'repair-approval-audit-required-approved'},
        ${'repair-approval-audit-required'},
        ${workspace.id},
        ${owner.id},
        ${'approval_approved'},
        ${'repair-approval-audit-required-approved-fp'},
        ${JSON.stringify({
          decision: 'approve',
          reason: 'db-boundary approval audit',
        })}::jsonb,
        ${approvalAt}
      )
    `;
    await tx.$executeRaw`
      INSERT INTO ai_repair_execution_audit_events (
        id,
        execution_request_id,
        workspace_id,
        actor_id,
        event_type,
        event_fingerprint,
        metadata,
        created_at
      )
      VALUES (
        ${'repair-approval-audit-required-queued'},
        ${'repair-approval-audit-required'},
        ${workspace.id},
        ${owner.id},
        ${'queued'},
        ${'repair-approval-audit-required-queued-fp'},
        ${JSON.stringify({
          approvalState: 'approved',
          sideEffectsApplied: false,
          queuedAt: approvalAt.toISOString(),
        })}::jsonb,
        ${approvalAt}
      )
    `;
  });

  const runningAt = new Date('2026-06-22T14:05:00.000Z');
  await t.throwsAsync(
    db.$transaction(async tx => {
      await tx.$executeRaw`
        UPDATE ai_repair_execution_requests
        SET
          status = ${'running'},
          runtime_result = ${JSON.stringify({
            version: 'repair-execution-runtime-result/v1',
            executor: 'repair_execution_worker',
            sideEffectsApplied: false,
            message: 'Repair execution worker is running.',
          })}::jsonb,
          worker_lease_id = ${'repair-audit-history-missing-worker'},
          worker_lease_expires_at = ${new Date('2026-06-22T14:15:00.000Z')},
          worker_attempt = ${1},
          last_attempt_at = ${runningAt},
          updated_at = ${runningAt}
        WHERE id = ${'repair-audit-history-valid'}
      `;
      await tx.$executeRaw`
        SET CONSTRAINTS "zz_ai_repair_execution_requests_audit_history_required_check" IMMEDIATE
      `;
    }),
    { message: /ai_repair_execution_requests_audit_history_required_check/ }
  );

  await db.$transaction(async tx => {
    await tx.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET
        status = ${'running'},
        runtime_result = ${JSON.stringify({
          version: 'repair-execution-runtime-result/v1',
          executor: 'repair_execution_worker',
          sideEffectsApplied: false,
          message: 'Repair execution worker is running.',
        })}::jsonb,
        worker_lease_id = ${'repair-audit-history-worker'},
        worker_lease_expires_at = ${new Date('2026-06-22T14:15:00.000Z')},
        worker_attempt = ${1},
        last_attempt_at = ${runningAt},
        updated_at = ${runningAt}
      WHERE id = ${'repair-audit-history-valid'}
    `;
    await tx.$executeRaw`
      INSERT INTO ai_repair_execution_audit_events (
        id,
        execution_request_id,
        workspace_id,
        actor_id,
        event_type,
        event_fingerprint,
        metadata,
        created_at
      )
      VALUES (
        ${'repair-audit-history-valid-running'},
        ${'repair-audit-history-valid'},
        ${workspace.id},
        ${owner.id},
        ${'running'},
        ${'repair-audit-history-valid-running-fp'},
        ${JSON.stringify({
          executor: 'repair_execution_worker',
          workerAttempt: 1,
          workerLeaseId: 'repair-audit-history-worker',
          workerLeaseExpiresAt: '2026-06-22T14:15:00.000Z',
        })}::jsonb,
        ${runningAt}
      )
    `;
  });

  await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET updated_at = updated_at
    WHERE id = ${'repair-audit-history-valid'}
  `;

  const completedAt = new Date('2026-06-22T14:20:00.000Z');
  const sideEffectSummary = {
    version: 'repair-execution-side-effect-summary/v1',
    promptName: 'Audit history repair-audit-history-valid',
    revision: 'repair-repair-audit-history-valid',
    revisionId: 'prompt-revision-repair-audit-history-valid',
    revisionFingerprint: 'side-effect-ledger-revision-fp',
    scope: 'workspace',
    workspaceId: workspace.id,
    rollbackContract: {
      version: 'repair-execution-side-effect-rollback-contract/v1',
      supported: false,
      mode: 'forward_only_followup_revision',
      reason: 'Registry repairs are recovered with a follow-up revision.',
      recoveryPath: 'publish_follow_up_registry_revision',
    },
  };
  const sideEffectResult = {
    version: 'repair-execution-runtime-result/v1',
    executor: 'prompt_registry_revision_publish_worker',
    sideEffectsApplied: true,
    sideEffectKind: 'prompt_registry_revision',
    sideEffectRecordId: 'prompt-revision-repair-audit-history-valid',
    sideEffectFingerprint: 'side-effect-ledger-fp',
    sideEffectSummary,
    message: 'Repair execution completed with a persisted side effect.',
  };

  await t.throwsAsync(
    db.$transaction(async tx => {
      await tx.$executeRaw`
        UPDATE ai_repair_execution_requests
        SET
          status = ${'completed'},
          runtime_result = ${JSON.stringify(sideEffectResult)}::jsonb,
          worker_lease_id = ${null},
          worker_lease_expires_at = ${null},
          completed_at = ${completedAt},
          updated_at = ${completedAt}
        WHERE id = ${'repair-audit-history-valid'}
      `;
      await tx.$executeRaw`
        INSERT INTO ai_repair_execution_audit_events (
          id,
          execution_request_id,
          workspace_id,
          actor_id,
          event_type,
          event_fingerprint,
          metadata,
          created_at
        )
        VALUES (
          ${'repair-audit-history-valid-completed-missing-ledger'},
          ${'repair-audit-history-valid'},
          ${workspace.id},
          ${owner.id},
          ${'completed'},
          ${'repair-audit-history-valid-completed-missing-ledger-fp'},
          ${JSON.stringify({
            approvalState: 'not_required',
            sideEffectsApplied: true,
            sideEffectKind: 'prompt_registry_revision',
            sideEffectRecordId: 'prompt-revision-repair-audit-history-valid',
            sideEffectFingerprint: 'side-effect-ledger-fp',
            workerAttempt: 1,
            workerLeaseId: 'repair-audit-history-worker',
          })}::jsonb,
          ${completedAt}
        )
      `;
      await tx.$executeRaw`
        SET CONSTRAINTS "zz_ai_repair_exec_requests_side_effect_ledger_required_check" IMMEDIATE
      `;
    }),
    {
      message: /ai_repair_execution_requests_side_effect_ledger_required_check/,
    }
  );

  await db.$transaction(async tx => {
    await tx.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET
        status = ${'completed'},
        runtime_result = ${JSON.stringify(sideEffectResult)}::jsonb,
        worker_lease_id = ${null},
        worker_lease_expires_at = ${null},
        completed_at = ${completedAt},
        updated_at = ${completedAt}
      WHERE id = ${'repair-audit-history-valid'}
    `;
    await tx.$executeRaw`
      INSERT INTO ai_repair_execution_side_effects (
        id,
        execution_request_id,
        workspace_id,
        actor_id,
        side_effect_kind,
        side_effect_record_id,
        side_effect_fingerprint,
        side_effect_summary,
        executor_payload_fingerprint,
        worker_attempt,
        worker_lease_id,
        applied_at,
        created_at
      )
      VALUES (
        ${'repair-execution-side-effect-repair-audit-history-valid'},
        ${'repair-audit-history-valid'},
        ${workspace.id},
        ${owner.id},
        ${'prompt_registry_revision'},
        ${'prompt-revision-repair-audit-history-valid'},
        ${'side-effect-ledger-fp'},
        ${JSON.stringify(sideEffectSummary)}::jsonb,
        ${'side-effect-ledger-executor-fp'},
        ${1},
        ${'repair-audit-history-worker'},
        ${completedAt},
        ${completedAt}
      )
    `;
    await tx.$executeRaw`
      INSERT INTO ai_repair_execution_audit_events (
        id,
        execution_request_id,
        workspace_id,
        actor_id,
        event_type,
        event_fingerprint,
        metadata,
        created_at
      )
      VALUES (
        ${'repair-audit-history-valid-side-effect-applied'},
        ${'repair-audit-history-valid'},
        ${workspace.id},
        ${owner.id},
        ${'side_effect_applied'},
        ${'repair-audit-history-valid-side-effect-applied-fp'},
        ${JSON.stringify({
          sideEffectKind: 'prompt_registry_revision',
          sideEffectRecordId: 'prompt-revision-repair-audit-history-valid',
          sideEffectFingerprint: 'side-effect-ledger-fp',
          sideEffectSummary,
          workerAttempt: 1,
          workerLeaseId: 'repair-audit-history-worker',
        })}::jsonb,
        ${completedAt}
      )
    `;
    await tx.$executeRaw`
      INSERT INTO ai_repair_execution_audit_events (
        id,
        execution_request_id,
        workspace_id,
        actor_id,
        event_type,
        event_fingerprint,
        metadata,
        created_at
      )
      VALUES (
        ${'repair-audit-history-valid-completed'},
        ${'repair-audit-history-valid'},
        ${workspace.id},
        ${owner.id},
        ${'completed'},
        ${'repair-audit-history-valid-completed-fp'},
        ${JSON.stringify({
          approvalState: 'not_required',
          sideEffectsApplied: true,
          sideEffectKind: 'prompt_registry_revision',
          sideEffectRecordId: 'prompt-revision-repair-audit-history-valid',
          sideEffectFingerprint: 'side-effect-ledger-fp',
          workerAttempt: 1,
          workerLeaseId: 'repair-audit-history-worker',
        })}::jsonb,
        ${completedAt}
      )
    `;
  });

  await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET updated_at = updated_at
    WHERE id = ${'repair-audit-history-valid'}
  `;
});

test('Agent Runtime rejects status timestamp drift at the DB boundary', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_timestamp_shape_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'timestamp-shape-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
      },
    ],
  });
  const stepId = run.steps[0].id;
  t.truthy(run.queuedAt);

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET status = ${'completed'}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_completed_at_status_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET completed_at = ${new Date('2026-06-22T12:50:00.000Z')}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_completed_at_status_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET updated_at = ${new Date('2026-06-22T12:49:00.000Z')}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_timestamp_coherence_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET
        status = ${'completed'},
        completed_at = ${new Date('2026-06-22T12:59:00.000Z')},
        started_at = ${new Date('2026-06-22T13:00:00.000Z')}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_timestamp_coherence_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET queued_at = ${null}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_queued_at_status_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET status = ${'waiting_approval'}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_queued_at_status_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET workflow = ${'   '}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_identity_shape_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET source_id = ${'   '}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_identity_shape_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET source_type = ${'repair_execution_request'}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_source_workflow_coherence_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET workflow = ${'prompt_registry_repair_execution'}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_source_workflow_coherence_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET title = ${'   '}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_title_shape_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET failure_code = ${'agent_runtime_orphan_failure_code'}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_failure_pair_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET failure_message = ${'Agent Runtime orphan failure message'}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_failure_pair_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET
        failure_code = ${'   '},
        failure_message = ${'Agent Runtime blank failure code'}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_failure_string_shape_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET timeline_fingerprint = ${'   '}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_fingerprint_shape_check/ }
  );

  const orphanTimelineRequiredAt = new Date(run.updatedAt.getTime() + 10_000);
  await t.throwsAsync(
    db.$transaction(async tx => {
      await tx.$executeRaw`
        INSERT INTO ai_agent_runs (
          id,
          workspace_id,
          actor_id,
          workflow,
          source_type,
          source_id,
          status,
          target_fingerprint,
          evidence_fingerprint,
          timeline_fingerprint,
          started_at,
          queued_at,
          worker_attempt,
          worker_max_attempts,
          created_at,
          updated_at
        )
        VALUES (
          ${'agent-runtime-orphan-state-run'},
          ${workspace.id},
          ${owner.id},
          ${'agent_runtime_orphan_state_e2e'},
          ${'agent_runtime_test'},
          ${'agent-runtime-orphan-state-source'},
          ${'queued'},
          ${'agent-runtime-orphan-state-target'},
          ${'agent-runtime-orphan-state-evidence'},
          ${'agent-runtime-orphan-state-timeline'},
          ${orphanTimelineRequiredAt},
          ${orphanTimelineRequiredAt},
          ${0},
          ${1},
          ${orphanTimelineRequiredAt},
          ${orphanTimelineRequiredAt}
        )
      `;
      await tx.$executeRaw`
        SET CONSTRAINTS "zz_ai_agent_runs_state_timeline_required_check" IMMEDIATE
      `;
    }),
    { message: /ai_agent_runs_state_timeline_required_check/ }
  );

  await t.throwsAsync(
    db.$transaction(async tx => {
      await tx.$executeRaw`
        UPDATE ai_agent_runs
        SET
          status = ${'running'},
          worker_lease_id = ${'agent-runtime-missing-timeline-worker'},
          worker_lease_expires_at = ${new Date('2026-06-22T13:20:00.000Z')},
          worker_attempt = ${1},
          last_attempt_at = ${orphanTimelineRequiredAt},
          updated_at = ${orphanTimelineRequiredAt}
        WHERE id = ${run.id}
      `;
      await tx.$executeRaw`
        SET CONSTRAINTS "zz_ai_agent_runs_state_timeline_required_check" IMMEDIATE
      `;
    }),
    { message: /ai_agent_runs_state_timeline_required_check/ }
  );

  const directTimelineRunAt = new Date(run.updatedAt.getTime() + 20_000);
  const directTimelineLeaseExpiresAt = new Date(
    directTimelineRunAt.getTime() + 600_000
  );
  await db.$transaction(async tx => {
    await tx.$executeRaw`
      UPDATE ai_agent_runs
      SET
        status = ${'running'},
        timeline_fingerprint = ${'agent-runtime-direct-state-timeline-fp'},
        worker_lease_id = ${'agent-runtime-direct-state-worker'},
        worker_lease_expires_at = ${directTimelineLeaseExpiresAt},
        worker_attempt = ${1},
        last_attempt_at = ${directTimelineRunAt},
        updated_at = ${directTimelineRunAt}
      WHERE id = ${run.id}
    `;
    await tx.$executeRaw`
      INSERT INTO ai_agent_timeline_events (
        id,
        run_id,
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
      VALUES (
        ${'agent-runtime-direct-state-timeline-event'},
        ${run.id},
        ${workspace.id},
        ${owner.id},
        ${'run_status'},
        ${'running'},
        ${99},
        ${'Agent runtime direct state transition with timeline'},
        ${JSON.stringify({
          version: 'agent-runtime-worker-lease/v1',
          executor: 'agent_runtime_worker',
          workerAttempt: 1,
          workerLeaseId: 'agent-runtime-direct-state-worker',
          workerLeaseExpiresAt: directTimelineLeaseExpiresAt.toISOString(),
          workflow: 'agent_runtime_timestamp_shape_e2e',
          sourceType: 'agent_runtime_test',
          sourceId: 'timestamp-shape-runtime-run',
        })}::jsonb,
        ${'agent-runtime-direct-state-timeline-event-fp'},
        ${directTimelineRunAt}
      )
    `;
  });

  await db.$executeRaw`
    UPDATE ai_agent_runs
    SET updated_at = updated_at
    WHERE id = ${run.id}
  `;

  const previousRunTimelineRows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM ai_agent_timeline_events
    WHERE run_id = ${run.id}
      AND step_id IS NULL
      AND status = ${'queued'}
    ORDER BY ordinal ASC
    LIMIT 1
  `;
  t.truthy(previousRunTimelineRows[0]?.id);
  await t.throwsAsync(
    db.$transaction(async tx => {
      await tx.$executeRaw`
        DELETE FROM ai_agent_timeline_events
        WHERE id = ${previousRunTimelineRows[0].id}
      `;
      await tx.$executeRaw`
        SET CONSTRAINTS "zz_ai_agent_runtime_timeline_delete_restrict_check" IMMEDIATE
      `;
    }),
    { message: /ai_agent_timeline_events_delete_restrict_check/ }
  );

  await t.throwsAsync(
    db.$transaction(async tx => {
      await tx.$executeRaw`
        DELETE FROM ai_agent_timeline_events
        WHERE id = ${'agent-runtime-direct-state-timeline-event'}
      `;
      await tx.$executeRaw`
        SET CONSTRAINTS "zz_ai_agent_runtime_timeline_delete_restrict_check" IMMEDIATE
      `;
    }),
    { message: /ai_agent_timeline_events_delete_restrict_check/ }
  );

  const stepHistoryRun = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_step_history_required_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'step-history-required-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'history_tool_lookup',
        stepType: 'tool',
      },
    ],
  });
  const stepHistoryStepId = stepHistoryRun.steps[0].id;
  const orphanStepRequiredAt = new Date(
    stepHistoryRun.updatedAt.getTime() + 30_000
  );
  await t.throwsAsync(
    db.$transaction(async tx => {
      await tx.$executeRaw`
        INSERT INTO ai_agent_steps (
          id,
          run_id,
          workspace_id,
          actor_id,
          step_key,
          step_type,
          status,
          "order",
          evidence_fingerprint,
          output_summary,
          started_at,
          created_at,
          updated_at
        )
        VALUES (
          ${'agent-runtime-orphan-step-state'},
          ${stepHistoryRun.id},
          ${workspace.id},
          ${owner.id},
          ${'orphan_step_state'},
          ${'tool'},
          ${'pending'},
          ${2},
          ${'agent-runtime-orphan-step-state-fp'},
          ${JSON.stringify({
            version: 'agent-runtime-step-output-summary/v1',
          })}::jsonb,
          ${orphanStepRequiredAt},
          ${orphanStepRequiredAt},
          ${orphanStepRequiredAt}
        )
      `;
      await tx.$executeRaw`
        SET CONSTRAINTS "zz_ai_agent_steps_state_timeline_required_check" IMMEDIATE
      `;
    }),
    { message: /ai_agent_steps_state_timeline_required_check/ }
  );

  await t.throwsAsync(
    db.$transaction(async tx => {
      await tx.$executeRaw`
        UPDATE ai_agent_steps
        SET
          status = ${'completed'},
          completed_at = ${orphanStepRequiredAt},
          updated_at = ${orphanStepRequiredAt}
        WHERE id = ${stepHistoryStepId}
      `;
      await tx.$executeRaw`
        SET CONSTRAINTS "zz_ai_agent_steps_state_timeline_required_check" IMMEDIATE
      `;
    }),
    { message: /ai_agent_steps_state_timeline_required_check/ }
  );

  const directStepTimelineAt = new Date(
    stepHistoryRun.updatedAt.getTime() + 40_000
  );
  await db.$transaction(async tx => {
    await tx.$executeRaw`
      UPDATE ai_agent_steps
      SET
        status = ${'completed'},
        completed_at = ${directStepTimelineAt},
        output_summary = output_summary || ${JSON.stringify({
          dbBoundaryCompletion: true,
        })}::jsonb,
        updated_at = ${directStepTimelineAt}
      WHERE id = ${stepHistoryStepId}
    `;
    await tx.$executeRaw`
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
      VALUES (
        ${'agent-runtime-direct-step-state-timeline-event'},
        ${stepHistoryRun.id},
        ${stepHistoryStepId},
        ${workspace.id},
        ${owner.id},
        ${'tool_step'},
        ${'completed'},
        ${100},
        ${'Agent runtime direct step transition with timeline'},
        ${JSON.stringify({
          version: 'agent-runtime-db-boundary-step/v1',
          stepKey: 'history_tool_lookup',
          stepType: 'tool',
        })}::jsonb,
        ${'agent-runtime-direct-step-state-timeline-event-fp'},
        ${directStepTimelineAt}
      )
    `;
  });

  await db.$executeRaw`
    UPDATE ai_agent_steps
    SET updated_at = updated_at
    WHERE id = ${stepHistoryStepId}
  `;

  const previousStepTimelineRows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM ai_agent_timeline_events
    WHERE run_id = ${stepHistoryRun.id}
      AND step_id = ${stepHistoryStepId}
      AND status = ${'pending'}
    ORDER BY ordinal ASC
    LIMIT 1
  `;
  t.truthy(previousStepTimelineRows[0]?.id);
  await t.throwsAsync(
    db.$transaction(async tx => {
      await tx.$executeRaw`
        DELETE FROM ai_agent_timeline_events
        WHERE id = ${previousStepTimelineRows[0].id}
      `;
      await tx.$executeRaw`
        SET CONSTRAINTS "zz_ai_agent_runtime_timeline_delete_restrict_check" IMMEDIATE
      `;
    }),
    { message: /ai_agent_timeline_events_delete_restrict_check/ }
  );

  await t.throwsAsync(
    db.$transaction(async tx => {
      await tx.$executeRaw`
        DELETE FROM ai_agent_timeline_events
        WHERE id = ${'agent-runtime-direct-step-state-timeline-event'}
      `;
      await tx.$executeRaw`
        SET CONSTRAINTS "zz_ai_agent_runtime_timeline_delete_restrict_check" IMMEDIATE
      `;
    }),
    { message: /ai_agent_timeline_events_delete_restrict_check/ }
  );

  await t.throwsAsync(
    db.$transaction(async tx => {
      await tx.$executeRaw`
        DELETE FROM ai_agent_timeline_events
        WHERE id = ${'agent-runtime-direct-step-state-timeline-event'}
      `;
      await tx.$executeRaw`
        DELETE FROM ai_agent_steps
        WHERE id = ${stepHistoryStepId}
      `;
      await tx.$executeRaw`
        SET CONSTRAINTS "zz_ai_agent_steps_delete_restrict_check" IMMEDIATE
      `;
    }),
    {
      message:
        /ai_agent_steps_delete_restrict_check|ai_agent_timeline_events_content_update_restrict_check/,
    }
  );

  const stepCascadeRun = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_step_delete_cascade_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'step-delete-cascade-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'step_delete_cascade',
        stepType: 'tool',
      },
    ],
  });
  await t.throwsAsync(
    db.$executeRaw`
      DELETE FROM ai_agent_runs
      WHERE id = ${stepCascadeRun.id}
    `,
    { message: /ai_agent_runs_delete_restrict_check/ }
  );
  const runCascadeWorkspace = await createWorkspace(app);
  const runCascadeRun = await app.models.copilotAgentRuntime.createRun({
    workspaceId: runCascadeWorkspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_run_delete_cascade_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'run-delete-cascade-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'run_delete_cascade',
        stepType: 'tool',
      },
    ],
  });
  const runCascadeStepId = runCascadeRun.steps[0].id;
  await db.$executeRaw`
    DELETE FROM workspaces
    WHERE id = ${runCascadeWorkspace.id}
  `;
  const runCascadeRows = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM ai_agent_runs
    WHERE id = ${runCascadeRun.id}
  `;
  t.deepEqual(runCascadeRows, [{ count: 0 }]);
  const stepCascadeRows = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM ai_agent_steps
    WHERE id = ${runCascadeStepId}
  `;
  t.deepEqual(stepCascadeRows, [{ count: 0 }]);

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET target_fingerprint = ${'agent-runtime-target-drift'}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_evidence_update_restrict_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET evidence_fingerprint = ${'agent-runtime-evidence-drift'}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_evidence_update_restrict_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET created_at = ${new Date('2026-06-22T12:00:00.000Z')}
      WHERE id = ${run.id}
    `,
    { message: /ai_agent_runs_evidence_update_restrict_check/ }
  );

  const terminalRun = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_terminal_result_guard_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'terminal-result-guard-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'tool_lookup_terminal_guard',
        stepType: 'tool',
      },
    ],
  });
  const terminalLease =
    await app.models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workspaceId: workspace.id,
      id: terminalRun.id,
      workerId: 'terminal-result-guard-worker',
      leaseMs: 60_000,
    });
  t.truthy(terminalLease);
  await app.models.copilotAgentRuntime.failStandaloneWorkerExecution({
    workspaceId: workspace.id,
    id: terminalRun.id,
    workerLeaseId: 'terminal-result-guard-worker',
    workerAttempt: terminalLease!.workerAttempt,
    code: 'terminal_result_guard_failure',
    message: 'terminal result guard failure',
  });

  await db.$executeRaw`
    UPDATE ai_agent_runs
    SET status = status
    WHERE id = ${terminalRun.id}
  `;

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET failure_message = ${'drifted terminal runtime failure'}
      WHERE id = ${terminalRun.id}
    `,
    {
      message:
        /ai_agent_runs_execution_result_terminal_snapshot_check|ai_agent_runs_terminal_result_update_restrict_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET
        status = ${'completed'},
        failure_code = ${null},
        failure_message = ${null}
      WHERE id = ${terminalRun.id}
    `,
    {
      message:
        /ai_agent_runs_execution_result_terminal_snapshot_check|ai_agent_runs_terminal_result_update_restrict_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET status = ${'completed'}
      WHERE id = ${stepId}
    `,
    { message: /ai_agent_steps_completed_at_status_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET evidence_fingerprint = ${'   '}
      WHERE id = ${stepId}
    `,
    { message: /ai_agent_steps_fingerprint_shape_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET step_key = ${'   '}
      WHERE id = ${stepId}
    `,
    { message: /ai_agent_steps_step_key_shape_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET title = ${'   '}
      WHERE id = ${stepId}
    `,
    { message: /ai_agent_steps_title_shape_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET "order" = ${-1}
      WHERE id = ${stepId}
    `,
    { message: /ai_agent_steps_order_shape_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET completed_at = ${new Date('2026-06-22T12:51:00.000Z')}
      WHERE id = ${stepId}
    `,
    { message: /ai_agent_steps_completed_at_status_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET updated_at = ${new Date('2026-06-22T12:49:00.000Z')}
      WHERE id = ${stepId}
    `,
    { message: /ai_agent_steps_timestamp_coherence_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET
        status = ${'completed'},
        completed_at = ${new Date('2026-06-22T12:59:00.000Z')},
        started_at = ${new Date('2026-06-22T13:00:00.000Z')}
      WHERE id = ${stepId}
    `,
    { message: /ai_agent_steps_timestamp_coherence_check/ }
  );

  await db.$executeRaw`
    UPDATE ai_agent_steps
    SET updated_at = updated_at
    WHERE id = ${stepId}
  `;

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET evidence_fingerprint = ${'agent-runtime-step-evidence-drift'}
      WHERE id = ${stepId}
    `,
    { message: /ai_agent_steps_evidence_update_restrict_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET created_at = ${new Date('2026-06-22T12:00:00.000Z')}
      WHERE id = ${stepId}
    `,
    { message: /ai_agent_steps_evidence_update_restrict_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET title = ${'Agent Runtime step title drift'}
      WHERE id = ${stepId}
    `,
    { message: /ai_agent_steps_evidence_update_restrict_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET ordinal = ${-1}
      WHERE run_id = ${run.id}
        AND ordinal = ${0}
    `,
    { message: /ai_agent_timeline_events_ordinal_shape_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET event_fingerprint = ${'   '}
      WHERE run_id = ${run.id}
        AND ordinal = ${0}
    `,
    { message: /ai_agent_timeline_events_fingerprint_shape_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET summary = ${'   '}
      WHERE run_id = ${run.id}
        AND ordinal = ${0}
    `,
    { message: /ai_agent_timeline_events_summary_shape_check/ }
  );

  await db.$executeRaw`
    UPDATE ai_agent_timeline_events
    SET payload = payload
    WHERE run_id = ${run.id}
      AND ordinal = ${0}
  `;

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET
        summary = ${'Agent runtime run queued with rewritten evidence'},
        payload = jsonb_set(
          payload,
          ${'{sourceId}'}::text[],
          ${JSON.stringify('rewritten-timeline-source')}::jsonb
        )
      WHERE run_id = ${run.id}
        AND ordinal = ${0}
    `,
    {
      message: /ai_agent_timeline_events_content_update_restrict_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET event_fingerprint = ${'deadbeefdeadbeef'}
      WHERE run_id = ${run.id}
        AND ordinal = ${0}
    `,
    {
      message: /ai_agent_timeline_events_content_update_restrict_check/,
    }
  );
});

test('standalone Agent Runtime worker leases queued runs and records unsupported adapter failure', async t => {
  const { agentRuntimeWorker, app, db, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const run = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_worker_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'worker-runtime-run',
    status: 'queued',
    title: 'Worker runtime run',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
      },
      {
        stepKey: 'codex_patch',
        stepType: 'codex',
      },
    ],
  });

  t.truthy(run.queuedAt);
  t.is(run.workerAttempt, 0);
  t.is(run.workerMaxAttempts, 1);

  const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
    workspaceId: workspace.id,
    runId: run.id,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const failed = await models.copilotAgentRuntime.get(workspace.id, run.id);
  t.truthy(failed);
  t.is(failed?.status, 'failed');
  t.is(failed?.failureCode, 'unsupported_agent_runtime_adapter');
  t.is(failed?.workerAttempt, 1);
  t.is(failed?.workerLeaseId, null);
  t.truthy(failed?.lastAttemptAt);
  t.deepEqual(
    failed?.steps.map(step => step.status),
    ['failed', 'failed']
  );
  const workerFailure = failed?.steps[0].outputSummary.workerFailure as {
    adapterResolution?: {
      registeredAdapters: Array<{
        sideEffectMode: string;
        supportedStepTypes: string[];
        workflow: string;
      }>;
      requestedStepTypes: string[];
      status: string;
      version: string;
      workflow: string;
    };
    failureCode: string;
    failureMessage: string;
    version: string;
    workerAttempt: number;
    workerLeaseId: string;
  };
  t.like(workerFailure, {
    version: 'agent-runtime-worker-failure/v1',
    failureCode: 'unsupported_agent_runtime_adapter',
    workerAttempt: 1,
  });
  t.deepEqual(workerFailure.adapterResolution, {
    version: 'agent-runtime-worker-adapter-resolution/v1',
    status: 'unsupported_workflow',
    workflow: 'agent_runtime_worker_e2e',
    requestedStepTypes: ['codex', 'tool'],
    registeredAdapters: [
      {
        workflow: 'agent_runtime_doc_update',
        supportedStepTypes: ['approval', 'tool'],
        sideEffectMode: 'workspace_write',
      },
      {
        workflow: 'agent_runtime_local_completion',
        supportedStepTypes: [
          'approval',
          'codex',
          'handoff',
          'mcp',
          'model',
          'tool',
        ],
        sideEffectMode: 'none',
      },
      {
        workflow: 'agent_runtime_localmind_tool_agent',
        supportedStepTypes: ['tool'],
        sideEffectMode: 'workspace_write',
      },
      {
        workflow: 'agent_runtime_model_completion',
        supportedStepTypes: ['model'],
        sideEffectMode: 'none',
      },
      {
        workflow: 'agent_runtime_office_command',
        supportedStepTypes: ['approval', 'tool'],
        sideEffectMode: 'workspace_write',
      },
      {
        workflow: 'agent_runtime_project_office_command',
        supportedStepTypes: ['approval', 'tool'],
        sideEffectMode: 'project_write',
      },
      {
        workflow: 'agent_runtime_project_resource',
        supportedStepTypes: ['tool'],
        sideEffectMode: 'project_write',
      },
      {
        workflow: 'agent_runtime_record_only',
        supportedStepTypes: [
          'approval',
          'codex',
          'handoff',
          'mcp',
          'model',
          'tool',
        ],
        sideEffectMode: 'none',
      },
    ],
  });
  t.truthy(workerFailure.failureMessage);
  t.truthy(workerFailure.workerLeaseId);
  const workerLease = failed?.steps[0].outputSummary.workerLease as {
    executor: string;
    version: string;
    workerAttempt: number;
    workerLeaseId: string;
  };
  t.deepEqual(workerLease, {
    executor: 'agent_runtime_worker',
    version: 'agent-runtime-worker-step-lease/v1',
    workerAttempt: 1,
    workerLeaseId: workerLease.workerLeaseId,
  });
  t.truthy(workerLease.workerLeaseId);
  const runLeaseEvent = failed?.timelineEvents.find(
    event => event.eventType === 'run_status' && event.status === 'running'
  );
  const runLeasePayload = runLeaseEvent?.payload as {
    executor: string;
    sourceId: string;
    sourceType: string;
    version: string;
    workerAttempt: number;
    workerLeaseExpiresAt: string;
    workerLeaseId: string;
    workflow: string;
  };
  t.deepEqual(runLeasePayload, {
    version: 'agent-runtime-worker-lease/v1',
    executor: 'agent_runtime_worker',
    workerAttempt: 1,
    workerLeaseId: workerLease.workerLeaseId,
    workerLeaseExpiresAt: runLeasePayload.workerLeaseExpiresAt,
    workflow: 'agent_runtime_worker_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'worker-runtime-run',
  });
  t.truthy(runLeasePayload.workerLeaseExpiresAt);
  const stepLeaseEvent = failed?.timelineEvents.find(
    event => event.eventType === 'tool_step' && event.status === 'running'
  );
  t.deepEqual(stepLeaseEvent?.payload, {
    version: 'agent-runtime-worker-step-lease/v1',
    executor: 'agent_runtime_worker',
    stepKey: 'tool_lookup',
    stepType: 'tool',
    workerAttempt: 1,
    workerLeaseId: workerLease.workerLeaseId,
    workflow: 'agent_runtime_worker_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'worker-runtime-run',
  });
  const stepFailureEvent = failed?.timelineEvents.find(
    event =>
      event.eventType === 'step_error' && event.stepId === failed.steps[0].id
  );
  t.like(stepFailureEvent?.payload, {
    version: 'agent-runtime-worker-failure/v1',
    executor: 'agent_runtime_worker',
    failureCode: 'unsupported_agent_runtime_adapter',
    failureMessage: workerFailure.failureMessage,
    stepKey: 'tool_lookup',
    stepType: 'tool',
    workerAttempt: 1,
    workerLeaseId: workerFailure.workerLeaseId,
  });
  const runFailureEvent = failed?.timelineEvents.find(
    event => event.eventType === 'run_status' && event.status === 'failed'
  );
  t.like(runFailureEvent?.payload, {
    version: 'agent-runtime-worker-failure/v1',
    executor: 'agent_runtime_worker',
    failureCode: 'unsupported_agent_runtime_adapter',
    failureMessage: workerFailure.failureMessage,
    workerAttempt: 1,
    workerMaxAttempts: 1,
    workerLeaseId: workerFailure.workerLeaseId,
    workflow: 'agent_runtime_worker_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'worker-runtime-run',
  });
  t.deepEqual(
    failed?.timelineEvents.map(event => [event.eventType, event.status]),
    [
      ['run_status', 'queued'],
      ['tool_step', 'pending'],
      ['codex_step', 'pending'],
      ['run_status', 'running'],
      ['tool_step', 'running'],
      ['codex_step', 'running'],
      ['step_error', 'failed'],
      ['step_error', 'failed'],
      ['run_status', 'failed'],
    ]
  );
  t.is(failed?.executionResultCount, 1);
  t.is(failed?.executionResults.length, 1);
  t.like(failed?.executionResults[0], {
    adapterWorkflow: 'agent_runtime_worker_e2e',
    executor: 'agent_runtime_worker',
    failureCode: 'unsupported_agent_runtime_adapter',
    resultStatus: 'failed',
    runId: run.id,
    sideEffectMode: 'none',
    sideEffectsApplied: false,
    workerAttempt: 1,
    workerLeaseId: workerFailure.workerLeaseId,
  });
  t.is(
    failed?.executionResults[0]?.failureMessage,
    workerFailure.failureMessage
  );
  t.is(
    (
      failed?.executionResults[0]?.resultPayload.adapterResolution as
        | { status?: string }
        | undefined
    )?.status,
    'unsupported_workflow'
  );
  const resultRows = await db.$queryRaw<
    Array<{
      adapterWorkflow: string;
      executor: string;
      failureCode: string | null;
      failureMessage: string | null;
      resultPayload: {
        adapterResolution?: { status?: string };
        failureCode?: string;
        resultStatus?: string;
        sideEffectsApplied?: boolean;
        version?: string;
      };
      resultStatus: string;
      sideEffectMode: string;
      sideEffectsApplied: boolean;
      workerAttempt: number;
      workerLeaseId: string;
    }>
  >`
    SELECT
      adapter_workflow AS "adapterWorkflow",
      executor,
      failure_code AS "failureCode",
      failure_message AS "failureMessage",
      result_payload AS "resultPayload",
      result_status AS "resultStatus",
      side_effect_mode AS "sideEffectMode",
      side_effects_applied AS "sideEffectsApplied",
      worker_attempt AS "workerAttempt",
      worker_lease_id AS "workerLeaseId"
    FROM ai_agent_runtime_execution_results
    WHERE run_id = ${run.id}
  `;
  t.is(resultRows.length, 1);
  t.like(resultRows[0], {
    adapterWorkflow: 'agent_runtime_worker_e2e',
    executor: 'agent_runtime_worker',
    failureCode: 'unsupported_agent_runtime_adapter',
    resultStatus: 'failed',
    sideEffectMode: 'none',
    sideEffectsApplied: false,
    workerAttempt: 1,
    workerLeaseId: workerFailure.workerLeaseId,
  });
  t.is(resultRows[0]?.failureMessage, workerFailure.failureMessage);
  t.like(resultRows[0]?.resultPayload, {
    version: 'agent-runtime-worker-execution-result/v1',
    resultStatus: 'failed',
    sideEffectsApplied: false,
    failureCode: 'unsupported_agent_runtime_adapter',
  });
  t.is(
    resultRows[0]?.resultPayload.adapterResolution?.status,
    'unsupported_workflow'
  );
});

test('standalone Agent Runtime worker lease fails closed when hydrated run snapshot changes before evidence update', async t => {
  const { app, db, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const run = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_stale_lease_run_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'stale-lease-run-runtime-run',
    status: 'queued',
    title: 'Stale lease run snapshot runtime run',
    steps: [
      {
        stepKey: 'model_context',
        stepType: 'model',
      },
    ],
  });

  const runtime = models.copilotAgentRuntime;
  const originalGet = runtime.get.bind(runtime);
  let returnedStaleRecord = false;
  const getStub = Sinon.stub(runtime, 'get').callsFake(
    async (workspaceId: string, id: string) => {
      if (
        !returnedStaleRecord &&
        workspaceId === workspace.id &&
        id === run.id
      ) {
        returnedStaleRecord = true;
        return run;
      }
      return await originalGet(workspaceId, id);
    }
  );
  try {
    await t.throwsAsync(
      runtime.acquireStandaloneWorkerLease({
        workspaceId: workspace.id,
        id: run.id,
        workerId: 'agent-runtime-stale-lease-run-worker-e2e',
        leaseMs: 60_000,
      }),
      {
        message:
          /worker lease evidence could not be recorded because its run state changed/,
      }
    );
  } finally {
    getStub.restore();
  }

  const rows = await db.$queryRaw<
    Array<{
      leaseTimelineCount: number;
      runStatus: string;
      stepStatus: string;
      workerAttempt: number;
      workerLeaseId: string | null;
      workerLeaseSummaryCount: number;
    }>
  >`
    SELECT
      r.status AS "runStatus",
      r.worker_attempt AS "workerAttempt",
      r.worker_lease_id AS "workerLeaseId",
      s.status AS "stepStatus",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps step
        WHERE step.run_id = r.id
          AND step.output_summary -> ${'workerLease'} IS NOT NULL
      ) AS "workerLeaseSummaryCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.payload ->> ${'version'} IN (
            ${'agent-runtime-worker-lease/v1'},
            ${'agent-runtime-worker-step-lease/v1'}
          )
      ) AS "leaseTimelineCount"
    FROM ai_agent_runs r
    JOIN ai_agent_steps s ON s.run_id = r.id
    WHERE r.id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      leaseTimelineCount: 0,
      runStatus: 'queued',
      stepStatus: 'pending',
      workerAttempt: 0,
      workerLeaseId: null,
      workerLeaseSummaryCount: 0,
    },
  ]);
});

test('standalone Agent Runtime worker lease fails closed when hydrated step snapshot changes before evidence update', async t => {
  const { app, db, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const run = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_stale_lease_step_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'stale-lease-step-runtime-run',
    status: 'queued',
    title: 'Stale lease step snapshot runtime run',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
      },
      {
        stepKey: 'model_context',
        stepType: 'model',
      },
    ],
  });

  const runtime = models.copilotAgentRuntime;
  const originalGet = runtime.get.bind(runtime);
  let returnedStaleRecord = false;
  const getStub = Sinon.stub(runtime, 'get').callsFake(
    async (workspaceId: string, id: string) => {
      const current = await originalGet(workspaceId, id);
      if (
        !returnedStaleRecord &&
        current &&
        workspaceId === workspace.id &&
        id === run.id
      ) {
        returnedStaleRecord = true;
        return {
          ...current,
          steps: current.steps.map((step, index) =>
            index === 0
              ? {
                  ...step,
                  updatedAt: new Date(step.updatedAt.getTime() - 1000),
                }
              : step
          ),
        };
      }
      return current;
    }
  );
  try {
    await t.throwsAsync(
      runtime.acquireStandaloneWorkerLease({
        workspaceId: workspace.id,
        id: run.id,
        workerId: 'agent-runtime-stale-lease-step-worker-e2e',
        leaseMs: 60_000,
      }),
      {
        message:
          /worker lease evidence could not be recorded because its step state changed/,
      }
    );
  } finally {
    getStub.restore();
  }

  const rows = await db.$queryRaw<
    Array<{
      leaseTimelineCount: number;
      runStatus: string;
      stepStatuses: string[];
      workerAttempt: number;
      workerLeaseId: string | null;
      workerLeaseSummaryCount: number;
    }>
  >`
    SELECT
      r.status AS "runStatus",
      r.worker_attempt AS "workerAttempt",
      r.worker_lease_id AS "workerLeaseId",
      ARRAY_AGG(s.status ORDER BY s."order") AS "stepStatuses",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps step
        WHERE step.run_id = r.id
          AND step.output_summary -> ${'workerLease'} IS NOT NULL
      ) AS "workerLeaseSummaryCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.payload ->> ${'version'} IN (
            ${'agent-runtime-worker-lease/v1'},
            ${'agent-runtime-worker-step-lease/v1'}
          )
      ) AS "leaseTimelineCount"
    FROM ai_agent_runs r
    JOIN ai_agent_steps s ON s.run_id = r.id
    WHERE r.id = ${run.id}
    GROUP BY r.id
  `;
  t.deepEqual(rows, [
    {
      leaseTimelineCount: 0,
      runStatus: 'queued',
      stepStatuses: ['pending', 'pending'],
      workerAttempt: 0,
      workerLeaseId: null,
      workerLeaseSummaryCount: 0,
    },
  ]);
});

test('standalone Agent Runtime worker completes record-only runs', async t => {
  const { agentRuntimeWorker, agentRuntimeWorkflowRegistry, app, db, owner } =
    t.context;
  const driftActor = await app.createUser();
  const defaultWorkflows = [
    'agent_runtime_local_completion',
    'agent_runtime_model_completion',
    'agent_runtime_record_only',
  ];
  t.deepEqual(
    agentRuntimeWorkflowRegistry
      .supportedWorkflows()
      .filter(workflow => defaultWorkflows.includes(workflow)),
    defaultWorkflows
  );
  t.truthy(agentRuntimeWorkflowRegistry.get('agent_runtime_local_completion'));
  t.truthy(agentRuntimeWorkflowRegistry.get('agent_runtime_model_completion'));
  t.truthy(agentRuntimeWorkflowRegistry.get('agent_runtime_record_only'));
  t.deepEqual(
    agentRuntimeWorkflowRegistry
      .adapterCapabilities()
      .filter(adapter => defaultWorkflows.includes(adapter.workflow)),
    [
      {
        workflow: 'agent_runtime_local_completion',
        capabilities: {
          version: 'agent-runtime-workflow-adapter-capabilities/v1',
          supportedStepTypes: [
            'approval',
            'codex',
            'handoff',
            'mcp',
            'model',
            'tool',
          ],
          sideEffectMode: 'none',
          summary:
            'Completes local Agent Runtime workflows through the generic worker completion contract.',
        },
      },
      {
        workflow: 'agent_runtime_model_completion',
        capabilities: {
          version: 'agent-runtime-workflow-adapter-capabilities/v1',
          supportedStepTypes: ['model'],
          sideEffectMode: 'none',
          summary:
            'Executes one persisted model step through the DB-routed Copilot prompt/provider stack and records bounded output evidence.',
        },
      },
      {
        workflow: 'agent_runtime_record_only',
        capabilities: {
          version: 'agent-runtime-workflow-adapter-capabilities/v1',
          supportedStepTypes: [
            'approval',
            'codex',
            'handoff',
            'mcp',
            'model',
            'tool',
          ],
          sideEffectMode: 'none',
          summary:
            'Completes already-persisted Agent Runtime records without external side effects.',
        },
      },
    ]
  );
  t.throws(
    () =>
      agentRuntimeWorkflowRegistry.register({
        workflow: 'agent_runtime_record_only',
        capabilities: {
          version: 'agent-runtime-workflow-adapter-capabilities/v1',
          supportedStepTypes: ['model'],
          sideEffectMode: 'none',
          summary: 'duplicate record-only adapter',
        },
        execute: () => Promise.resolve(),
      }),
    {
      message:
        'Agent Runtime workflow adapter already registered: agent_runtime_record_only',
    }
  );
  t.throws(
    () =>
      agentRuntimeWorkflowRegistry.register({
        workflow: 'agent_runtime_bad_version_e2e',
        capabilities: {
          version: 'agent-runtime-workflow-adapter-capabilities/v0',
          supportedStepTypes: ['model'],
          sideEffectMode: 'none',
          summary: 'bad capability version',
        },
        execute: () => Promise.resolve(),
      }),
    {
      message:
        'Agent Runtime workflow adapter has unsupported capability version: agent_runtime_bad_version_e2e',
    }
  );
  t.throws(
    () =>
      agentRuntimeWorkflowRegistry.register({
        workflow: null as unknown as string,
        capabilities: {
          version: 'agent-runtime-workflow-adapter-capabilities/v1',
          supportedStepTypes: ['model'],
          sideEffectMode: 'none',
          summary: 'bad workflow',
        },
        execute: () => Promise.resolve(),
      }),
    {
      message: 'Agent Runtime workflow adapter requires workflow',
    }
  );
  t.throws(
    () =>
      agentRuntimeWorkflowRegistry.register({
        workflow: 'agent_runtime_missing_step_array_e2e',
        capabilities: {
          version: 'agent-runtime-workflow-adapter-capabilities/v1',
          supportedStepTypes: 'model' as unknown as ['model'],
          sideEffectMode: 'none',
          summary: 'bad supported step list',
        },
        execute: () => Promise.resolve(),
      }),
    {
      message:
        'Agent Runtime workflow adapter requires supported step types: agent_runtime_missing_step_array_e2e',
    }
  );
  t.throws(
    () =>
      agentRuntimeWorkflowRegistry.register({
        workflow: 'agent_runtime_bad_side_effect_e2e',
        capabilities: {
          version: 'agent-runtime-workflow-adapter-capabilities/v1',
          supportedStepTypes: ['model'],
          sideEffectMode: 'unbounded_external_write' as never,
          summary: 'bad side-effect mode',
        },
        execute: () => Promise.resolve(),
      }),
    {
      message:
        'Agent Runtime workflow adapter has unsupported side-effect mode: agent_runtime_bad_side_effect_e2e',
    }
  );
  t.throws(
    () =>
      agentRuntimeWorkflowRegistry.register({
        workflow: 'agent_runtime_bad_step_type_e2e',
        capabilities: {
          version: 'agent-runtime-workflow-adapter-capabilities/v1',
          supportedStepTypes: ['model', 'browser' as never],
          sideEffectMode: 'none',
          summary: 'bad step type',
        },
        execute: () => Promise.resolve(),
      }),
    {
      message:
        'Agent Runtime workflow adapter declares unsupported step types: agent_runtime_bad_step_type_e2e: browser',
    }
  );
  t.throws(
    () =>
      agentRuntimeWorkflowRegistry.register({
        workflow: 'agent_runtime_non_string_summary_e2e',
        capabilities: {
          version: 'agent-runtime-workflow-adapter-capabilities/v1',
          supportedStepTypes: ['model'],
          sideEffectMode: 'none',
          summary: null as unknown as string,
        },
        execute: () => Promise.resolve(),
      }),
    {
      message:
        'Agent Runtime workflow adapter requires capability summary: agent_runtime_non_string_summary_e2e',
    }
  );
  t.throws(
    () =>
      agentRuntimeWorkflowRegistry.register({
        workflow: 'agent_runtime_blank_summary_e2e',
        capabilities: {
          version: 'agent-runtime-workflow-adapter-capabilities/v1',
          supportedStepTypes: ['model'],
          sideEffectMode: 'none',
          summary: '   ',
        },
        execute: () => Promise.resolve(),
      }),
    {
      message:
        'Agent Runtime workflow adapter requires capability summary: agent_runtime_blank_summary_e2e',
    }
  );
  t.throws(
    () =>
      agentRuntimeWorkflowRegistry.register({
        workflow: 'x'.repeat(129),
        capabilities: {
          version: 'agent-runtime-workflow-adapter-capabilities/v1',
          supportedStepTypes: ['model'],
          sideEffectMode: 'none',
          summary: 'overlong workflow',
        },
        execute: () => Promise.resolve(),
      }),
    {
      message: 'Agent Runtime workflow adapter workflow is too long',
    }
  );
  t.throws(
    () =>
      agentRuntimeWorkflowRegistry.register({
        workflow: 'agent_runtime_overlong_summary_e2e',
        capabilities: {
          version: 'agent-runtime-workflow-adapter-capabilities/v1',
          supportedStepTypes: ['model'],
          sideEffectMode: 'none',
          summary: 's'.repeat(513),
        },
        execute: () => Promise.resolve(),
      }),
    {
      message: 'Agent Runtime workflow adapter capability summary is too long',
    }
  );
  t.throws(
    () =>
      agentRuntimeWorkflowRegistry.register({
        workflow: 'agent_runtime_missing_executor_e2e',
        capabilities: {
          version: 'agent-runtime-workflow-adapter-capabilities/v1',
          supportedStepTypes: ['model'],
          sideEffectMode: 'none',
          summary: 'missing executor',
        },
        execute: null as unknown as () => Promise<void>,
      }),
    {
      message:
        'Agent Runtime workflow adapter requires executor: agent_runtime_missing_executor_e2e',
    }
  );

  const mutableCapabilities = {
    version: 'agent-runtime-workflow-adapter-capabilities/v1',
    supportedStepTypes: ['model'] as Array<'model' | 'tool'>,
    sideEffectMode: 'none' as const,
    summary: '  immutable adapter capability summary  ',
  };
  agentRuntimeWorkflowRegistry.register({
    workflow: ' agent_runtime_immutable_adapter_e2e ',
    capabilities: mutableCapabilities,
    execute: () => Promise.resolve(),
  });
  mutableCapabilities.supportedStepTypes.push('tool');
  mutableCapabilities.summary = 'mutated summary after registration';
  const immutableAdapter = agentRuntimeWorkflowRegistry.get(
    'agent_runtime_immutable_adapter_e2e'
  );
  t.deepEqual(immutableAdapter?.capabilities.supportedStepTypes, ['model']);
  t.is(
    immutableAdapter?.capabilities.summary,
    'immutable adapter capability summary'
  );
  const exposedCapabilities = agentRuntimeWorkflowRegistry
    .adapterCapabilities()
    .find(
      adapter => adapter.workflow === 'agent_runtime_immutable_adapter_e2e'
    );
  exposedCapabilities?.capabilities.supportedStepTypes.push('tool');
  t.deepEqual(immutableAdapter?.capabilities.supportedStepTypes, ['model']);

  agentRuntimeWorkflowRegistry.register({
    workflow: 'agent_runtime_allowlisted_adapter_e2e',
    capabilities: {
      version: 'agent-runtime-workflow-adapter-capabilities/v1',
      supportedStepTypes: ['model'],
      sideEffectMode: 'none',
      summary: 'adapter with untrusted extra fields',
      secretCapability: 'must-not-surface',
    } as unknown as {
      version: 'agent-runtime-workflow-adapter-capabilities/v1';
      supportedStepTypes: ['model'];
      sideEffectMode: 'none';
      summary: string;
    },
    secretAdapterField: 'must-not-surface',
    execute: () => Promise.resolve(),
  } as unknown as Parameters<
    CopilotAgentRuntimeWorkflowRegistry['register']
  >[0]);
  const allowlistedAdapter = agentRuntimeWorkflowRegistry.get(
    'agent_runtime_allowlisted_adapter_e2e'
  ) as unknown as Record<string, unknown>;
  t.deepEqual(Object.keys(allowlistedAdapter).sort(), [
    'capabilities',
    'execute',
    'workflow',
  ]);
  t.false(
    JSON.stringify(
      agentRuntimeWorkflowRegistry
        .adapterCapabilities()
        .find(
          adapter =>
            adapter.workflow === 'agent_runtime_allowlisted_adapter_e2e'
        )
    ).includes('must-not-surface')
  );

  const freshRegistry = new CopilotAgentRuntimeWorkflowRegistry(
    app.get(Models)
  );
  for (let index = 0; index < 22; index++) {
    freshRegistry.register({
      workflow: `agent_runtime_capacity_${index}`,
      capabilities: {
        version: 'agent-runtime-workflow-adapter-capabilities/v1',
        supportedStepTypes: ['model'],
        sideEffectMode: 'none',
        summary: `capacity adapter ${index}`,
      },
      execute: () => Promise.resolve(),
    });
  }
  t.is(freshRegistry.supportedWorkflows().length, 24);
  t.throws(
    () =>
      freshRegistry.register({
        workflow: 'agent_runtime_capacity_overflow',
        capabilities: {
          version: 'agent-runtime-workflow-adapter-capabilities/v1',
          supportedStepTypes: ['model'],
          sideEffectMode: 'none',
          summary: 'capacity overflow',
        },
        execute: () => Promise.resolve(),
      }),
    {
      message: 'Agent Runtime workflow adapter registry is full',
    }
  );

  const workspace = await createWorkspace(app);
  const runtime = app.get(Models).copilotAgentRuntime;
  const run = await runtime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_record_only',
    sourceType: 'agent_runtime_test',
    sourceId: 'record-only-runtime-run',
    status: 'queued',
    title: 'Record-only runtime run',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
      },
      {
        stepKey: 'record_tool_context',
        stepType: 'tool',
      },
    ],
  });

  const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
    workspaceId: workspace.id,
    runId: run.id,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const completed = await runtime.get(workspace.id, run.id);
  t.truthy(completed);
  t.is(completed?.status, 'completed');
  t.is(completed?.failureCode, null);
  t.is(completed?.failureMessage, null);
  t.is(completed?.workerAttempt, 1);
  t.is(completed?.workerLeaseId, null);
  t.truthy(completed?.completedAt);
  t.deepEqual(
    completed?.steps.map(step => step.status),
    ['completed', 'completed']
  );
  const recordOnlyExecution = completed?.steps[0].outputSummary
    .recordOnlyExecution as {
    executor: string;
    sideEffectsApplied: boolean;
    summary: string;
    version: string;
    workerAttempt: number;
    workerLeaseId: string;
  };
  t.deepEqual(recordOnlyExecution, {
    version: 'agent-runtime-record-only-execution/v1',
    executor: 'agent_runtime_record_only_adapter',
    sideEffectsApplied: false,
    summary:
      'Record-only Agent Runtime adapter completed without external side effects.',
    workerAttempt: 1,
    workerLeaseId: recordOnlyExecution.workerLeaseId,
  });
  t.truthy(recordOnlyExecution.workerLeaseId);
  const completedWorkerLease = completed?.steps[0].outputSummary
    .workerLease as {
    executor: string;
    version: string;
    workerAttempt: number;
    workerLeaseId: string;
  };
  t.deepEqual(completedWorkerLease, {
    executor: 'agent_runtime_worker',
    version: 'agent-runtime-worker-step-lease/v1',
    workerAttempt: 1,
    workerLeaseId: recordOnlyExecution.workerLeaseId,
  });
  t.deepEqual(
    completed?.timelineEvents.map(event => [event.eventType, event.status]),
    [
      ['run_status', 'queued'],
      ['model_step', 'pending'],
      ['tool_step', 'pending'],
      ['run_status', 'running'],
      ['model_step', 'running'],
      ['tool_step', 'running'],
      ['model_step', 'completed'],
      ['tool_step', 'completed'],
      ['run_status', 'completed'],
    ]
  );
  const finalEvent =
    completed?.timelineEvents[completed.timelineEvents.length - 1];
  t.is(
    finalEvent?.summary,
    'Agent runtime record-only worker completed standalone run'
  );
  const stepCompletionEvent = completed?.timelineEvents.find(
    event => event.eventType === 'model_step' && event.status === 'completed'
  );
  t.deepEqual(stepCompletionEvent?.payload, {
    version: 'agent-runtime-record-only-execution/v1',
    executor: 'agent_runtime_record_only_adapter',
    summary:
      'Record-only Agent Runtime adapter completed without external side effects.',
    stepKey: 'record_model_context',
    stepType: 'model',
    workerAttempt: 1,
    workerLeaseId: recordOnlyExecution.workerLeaseId,
  });
  t.deepEqual(finalEvent?.payload, {
    version: 'agent-runtime-record-only-execution/v1',
    executor: 'agent_runtime_record_only_adapter',
    summary:
      'Record-only Agent Runtime adapter completed without external side effects.',
    sideEffectsApplied: false,
    workerAttempt: 1,
    workerMaxAttempts: 1,
    workerLeaseId: recordOnlyExecution.workerLeaseId,
    workflow: 'agent_runtime_record_only',
    sourceType: 'agent_runtime_test',
    sourceId: 'record-only-runtime-run',
  });
  t.is(completed?.executionResultCount, 1);
  t.is(completed?.executionResults.length, 1);
  t.like(completed?.executionResults[0], {
    adapterWorkflow: 'agent_runtime_record_only',
    executor: 'agent_runtime_record_only_adapter',
    resultStatus: 'completed',
    runId: run.id,
    sideEffectMode: 'none',
    sideEffectsApplied: false,
    summary:
      'Record-only Agent Runtime adapter completed without external side effects.',
    workerAttempt: 1,
    workerLeaseId: recordOnlyExecution.workerLeaseId,
  });
  t.like(completed?.executionResults[0]?.resultPayload, {
    version: 'agent-runtime-worker-execution-result/v1',
    resultStatus: 'completed',
    sideEffectsApplied: false,
  });
  const detailResult = await app.gql({
    query: agentRuntimeRunQuery,
    variables: {
      id: run.id,
      workspaceId: workspace.id,
    },
  });
  t.deepEqual(
    detailResult.currentUser?.copilot.agentRuntimeWorkflowAdapters.find(
      (adapter: { workflow: string }) =>
        adapter.workflow === 'agent_runtime_record_only'
    ),
    {
      workflow: 'agent_runtime_record_only',
      capabilities: {
        version: 'agent-runtime-workflow-adapter-capabilities/v1',
        supportedStepTypes: [
          'approval',
          'codex',
          'handoff',
          'mcp',
          'model',
          'tool',
        ],
        sideEffectMode: 'none',
        summary:
          'Completes already-persisted Agent Runtime records without external side effects.',
      },
    }
  );
  t.is(detailResult.currentUser?.copilot.agentRun?.executionResultCount, 1);
  t.like(detailResult.currentUser?.copilot.agentRun?.executionResults[0], {
    adapterWorkflow: 'agent_runtime_record_only',
    executor: 'agent_runtime_record_only_adapter',
    resultStatus: 'completed',
    runId: run.id,
    sideEffectMode: 'none',
    sideEffectsApplied: false,
    workerAttempt: 1,
    workerLeaseId: recordOnlyExecution.workerLeaseId,
  });
  const listResult = await app.gql({
    query: agentRuntimeRunsQuery,
    variables: {
      limit: 5,
      workspaceId: workspace.id,
    },
  });
  const listedRun = listResult.currentUser?.copilot.agentRuns.find(
    (item: { id: string }) => item.id === run.id
  );
  t.deepEqual(
    listResult.currentUser?.copilot.agentRuntimeWorkflowAdapters.find(
      (adapter: { workflow: string }) =>
        adapter.workflow === 'agent_runtime_record_only'
    )?.capabilities.supportedStepTypes,
    ['approval', 'codex', 'handoff', 'mcp', 'model', 'tool']
  );
  t.is(listedRun?.executionResultCount, 1);
  t.is(listedRun?.executionResults[0]?.resultStatus, 'completed');
  const resultRows = await db.$queryRaw<
    Array<{
      adapterWorkflow: string;
      executor: string;
      failureCode: string | null;
      resultPayload: {
        resultStatus?: string;
        sideEffectsApplied?: boolean;
        summary?: string;
        version?: string;
      };
      resultStatus: string;
      sideEffectMode: string;
      sideEffectsApplied: boolean;
      summary: string;
      workerAttempt: number;
      workerLeaseId: string;
    }>
  >`
    SELECT
      adapter_workflow AS "adapterWorkflow",
      executor,
      failure_code AS "failureCode",
      result_payload AS "resultPayload",
      result_status AS "resultStatus",
      side_effect_mode AS "sideEffectMode",
      side_effects_applied AS "sideEffectsApplied",
      summary,
      worker_attempt AS "workerAttempt",
      worker_lease_id AS "workerLeaseId"
    FROM ai_agent_runtime_execution_results
    WHERE run_id = ${run.id}
  `;
  t.is(resultRows.length, 1);
  t.like(resultRows[0], {
    adapterWorkflow: 'agent_runtime_record_only',
    executor: 'agent_runtime_record_only_adapter',
    failureCode: null,
    resultStatus: 'completed',
    sideEffectMode: 'none',
    sideEffectsApplied: false,
    summary:
      'Record-only Agent Runtime adapter completed without external side effects.',
    workerAttempt: 1,
    workerLeaseId: recordOnlyExecution.workerLeaseId,
  });
  t.like(resultRows[0]?.resultPayload, {
    version: 'agent-runtime-worker-execution-result/v1',
    resultStatus: 'completed',
    sideEffectsApplied: false,
    summary:
      'Record-only Agent Runtime adapter completed without external side effects.',
  });
  await db.$executeRaw`
    UPDATE ai_agent_runtime_execution_results
    SET result_payload = result_payload
    WHERE run_id = ${run.id}
  `;
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runtime_execution_results
      SET
        side_effects_applied = ${true},
        result_payload = jsonb_set(
          result_payload,
          ${'{sideEffectsApplied}'}::text[],
          ${'true'}::jsonb
        )
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_runtime_execution_results_status_payload_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runtime_execution_results
      SET actor_id = ${'wrong-agent-runtime-result-actor'}
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_runtime_execution_results_run_id_fkey/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET actor_id = ${driftActor.id}
      WHERE run_id = ${run.id}
    `,
    {
      message:
        /ai_agent_steps_run_snapshot_fkey|ai_agent_timeline_events_step_snapshot_fkey/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET actor_id = ${driftActor.id}
      WHERE run_id = ${run.id}
    `,
    {
      message:
        /ai_agent_timeline_events_run_snapshot_fkey|ai_agent_timeline_events_step_snapshot_fkey/,
    }
  );
  const otherRun = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_record_only',
    sourceType: 'agent_runtime_test',
    sourceId: 'record-only-step-snapshot-drift-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'other_record_model_context',
        stepType: 'model',
      },
    ],
  });
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET step_id = ${otherRun.steps[0].id}
      WHERE id = (
        SELECT id
        FROM ai_agent_timeline_events
        WHERE run_id = ${run.id}
          AND step_id IS NOT NULL
        ORDER BY ordinal ASC
        LIMIT 1
      )
    `,
    {
      message: /ai_agent_timeline_events_step_snapshot_fkey/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runtime_execution_results
      SET
        workflow = ${'wrong-agent-runtime-result-workflow'},
        result_payload = jsonb_set(
          result_payload,
          ${'{workflow}'}::text[],
          ${'"wrong-agent-runtime-result-workflow"'}::jsonb
        )
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_runtime_execution_results_run_source_snapshot_fkey/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runtime_execution_results
      SET
        completed_at = ${new Date('2026-06-23T03:15:00.000Z')},
        result_payload = jsonb_set(
          result_payload,
          ${'{completedAt}'}::text[],
          ${'"2026-06-23T03:15:00.000Z"'}::jsonb
        )
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_runtime_execution_results_terminal_snapshot_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runtime_execution_results
      SET result_payload = jsonb_set(
        result_payload,
        ${'{completedAt}'}::text[],
        ${'"2026-06-23T03:15:00.000Z"'}::jsonb
      )
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_runtime_execution_results_completed_at_payload_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runtime_execution_results
      SET
        summary = ${'Drifted record-only execution result summary.'},
        result_payload = jsonb_set(
          result_payload,
          ${'{summary}'}::text[],
          ${JSON.stringify('Drifted record-only execution result summary.')}::jsonb
        )
      WHERE run_id = ${run.id}
    `,
    {
      message:
        /ai_agent_runtime_execution_results_content_update_restrict_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runtime_execution_results
      SET result_fingerprint = ${'abcdef1234567890'}
      WHERE run_id = ${run.id}
    `,
    {
      message:
        /ai_agent_runtime_execution_results_content_update_restrict_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runtime_execution_results
      SET id = ${'rewritten-record-only-execution-result'}
      WHERE run_id = ${run.id}
    `,
    {
      message:
        /ai_agent_runtime_execution_results_content_update_restrict_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runtime_execution_results
      SET created_at = created_at - interval '2 seconds'
      WHERE run_id = ${run.id}
    `,
    {
      message:
        /ai_agent_runtime_execution_results_timestamp_check|ai_agent_runtime_execution_results_content_update_restrict_check/,
    }
  );
  await t.throwsAsync(
    db.$transaction(async tx => {
      await tx.$executeRaw`
        DELETE FROM ai_agent_runtime_execution_results
        WHERE run_id = ${run.id}
      `;
      await tx.$executeRaw`
        SET CONSTRAINTS "zz_ai_agent_runtime_exec_results_delete_restrict_check" IMMEDIATE
      `;
    }),
    {
      message: /ai_agent_runtime_execution_results_delete_restrict_check/,
    }
  );

  const isolatedResultRunId = 'record-only-result-parent-update-restrict-run';
  const isolatedNow = new Date('2026-06-23T03:30:00.000Z');
  await db.$transaction(async tx => {
    await tx.$executeRaw`
      INSERT INTO ai_agent_runs (
        id,
        workspace_id,
        actor_id,
        workflow,
        source_type,
        source_id,
        status,
        target_fingerprint,
        evidence_fingerprint,
        timeline_fingerprint,
        started_at,
        completed_at,
        worker_attempt,
        worker_max_attempts,
        created_at,
        updated_at
      )
      VALUES (
        ${isolatedResultRunId},
        ${workspace.id},
        ${owner.id},
        ${'agent_runtime_record_only'},
        ${'agent_runtime_test'},
        ${'record-only-result-parent-update-restrict-source'},
        ${'completed'},
        ${'isolated-result-target'},
        ${'isolated-result-evidence'},
        ${'isolated-result-timeline'},
        ${isolatedNow},
        ${isolatedNow},
        ${1},
        ${1},
        ${isolatedNow},
        ${isolatedNow}
      )
    `;
    await tx.$executeRaw`
      INSERT INTO ai_agent_timeline_events (
        id,
        run_id,
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
      VALUES (
        ${'record-only-result-parent-update-restrict-timeline'},
        ${isolatedResultRunId},
        ${workspace.id},
        ${owner.id},
        ${'run_status'},
        ${'completed'},
        ${0},
        ${'Isolated record-only result completed'},
        ${JSON.stringify({
          workflow: 'agent_runtime_record_only',
          sourceType: 'agent_runtime_test',
          sourceId: 'record-only-result-parent-update-restrict-source',
        })}::jsonb,
        ${'isolated-result-timeline-event'},
        ${isolatedNow}
      )
    `;
  });
  await db.$executeRaw`
    INSERT INTO ai_agent_runtime_execution_results (
      id,
      run_id,
      workspace_id,
      actor_id,
      workflow,
      source_type,
      source_id,
      adapter_workflow,
      executor,
      result_status,
      side_effect_mode,
      side_effects_applied,
      summary,
      result_payload,
      result_fingerprint,
      worker_attempt,
      worker_lease_id,
      completed_at,
      created_at
    )
    VALUES (
      ${'record-only-result-parent-update-restrict-result'},
      ${isolatedResultRunId},
      ${workspace.id},
      ${owner.id},
      ${'agent_runtime_record_only'},
      ${'agent_runtime_test'},
      ${'record-only-result-parent-update-restrict-source'},
      ${'agent_runtime_record_only'},
      ${'agent_runtime_record_only_adapter'},
      ${'completed'},
      ${'none'},
      ${false},
      ${'isolated record-only result completed'},
      ${JSON.stringify({
        version: 'agent-runtime-worker-execution-result/v1',
        resultStatus: 'completed',
        workflow: 'agent_runtime_record_only',
        sourceType: 'agent_runtime_test',
        sourceId: 'record-only-result-parent-update-restrict-source',
        adapterWorkflow: 'agent_runtime_record_only',
        executor: 'agent_runtime_record_only_adapter',
        sideEffectMode: 'none',
        sideEffectsApplied: false,
        summary: 'isolated record-only result completed',
        workerAttempt: 1,
        workerLeaseId: 'isolated-record-only-lease',
        completedAt: isolatedNow.toISOString(),
      })}::jsonb,
      ${'a1b2c3d4e5f6a7b8'},
      ${1},
      ${'isolated-record-only-lease'},
      ${isolatedNow},
      ${isolatedNow}
    )
  `;
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET actor_id = ${driftActor.id}
      WHERE id = ${isolatedResultRunId}
    `,
    {
      message:
        /ai_agent_runtime_execution_results_run_id_fkey|ai_agent_timeline_events_run_snapshot_fkey/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET source_id = ${'record-only-result-parent-source-drift'}
      WHERE id = ${isolatedResultRunId}
    `,
    {
      message:
        /ai_agent_runtime_execution_results_run_source_snapshot_fkey|ai_agent_timeline_events_run_snapshot_fkey/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET
        completed_at = ${new Date('2026-06-23T03:35:00.000Z')},
        updated_at = ${new Date('2026-06-23T03:35:00.000Z')}
      WHERE id = ${isolatedResultRunId}
    `,
    {
      message: /ai_agent_runs_execution_result_terminal_snapshot_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET
        status = ${'failed'},
        failure_code = ${'isolated_terminal_drift'},
        failure_message = ${'isolated result terminal status drift'},
        updated_at = ${new Date('2026-06-23T03:35:00.000Z')}
      WHERE id = ${isolatedResultRunId}
    `,
    {
      message: /ai_agent_runs_execution_result_terminal_snapshot_check/,
    }
  );

  const manualSummaryRun = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_record_only',
    sourceType: 'agent_runtime_test',
    sourceId: 'record-only-manual-summary-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
        status: 'pending',
      },
    ],
  });
  const leasedManualSummaryRun =
    await app.models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workspaceId: workspace.id,
      id: manualSummaryRun.id,
      workerId: 'record-only-summary-worker-e2e',
      leaseMs: 60_000,
    });
  t.truthy(leasedManualSummaryRun);

  const completedManualSummaryRun =
    await app.models.copilotAgentRuntime.completeStandaloneRecordOnlyExecution({
      workspaceId: workspace.id,
      id: manualSummaryRun.id,
      workerLeaseId: 'record-only-summary-worker-e2e',
      workerAttempt: leasedManualSummaryRun!.workerAttempt,
      summary: `  ${'s'.repeat(1200)}  `,
    });
  const recordOnlyExecutionSummary = completedManualSummaryRun.steps[0]
    .outputSummary.recordOnlyExecution as { summary?: string } | undefined;
  t.is(recordOnlyExecutionSummary?.summary, 's'.repeat(1024));
});

test('standalone Agent Runtime worker completes local workflows through generic completion contract', async t => {
  const { agentRuntimeWorker, app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_local_completion',
    sourceType: 'agent_runtime_test',
    sourceId: 'local-completion-runtime-run',
    status: 'queued',
    title: 'Local completion runtime run',
    steps: [
      {
        stepKey: 'local_model_context',
        stepType: 'model',
      },
      {
        stepKey: 'local_tool_context',
        stepType: 'tool',
      },
    ],
  });

  const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
    workspaceId: workspace.id,
    runId: run.id,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const completed = await app.models.copilotAgentRuntime.get(
    workspace.id,
    run.id
  );
  t.truthy(completed);
  t.is(completed?.status, 'completed');
  t.is(completed?.failureCode, null);
  t.is(completed?.failureMessage, null);
  t.is(completed?.workerAttempt, 1);
  t.is(completed?.workerLeaseId, null);
  t.deepEqual(
    completed?.steps.map(step => step.status),
    ['completed', 'completed']
  );
  const workerCompletion = completed?.steps[0].outputSummary
    .workerCompletion as {
    adapterResolution?: {
      adapter: {
        sideEffectMode: string;
        supportedStepTypes: string[];
        workflow: string;
      };
      registeredAdapters: Array<{ workflow: string }>;
      requestedStepTypes: string[];
      status: string;
      version: string;
      workflow: string;
    };
    adapterWorkflow: string;
    executor: string;
    sideEffectMode: string;
    sideEffectsApplied: boolean;
    summary: string;
    version: string;
    workerAttempt: number;
    workerLeaseId: string;
  };
  t.like(workerCompletion, {
    version: 'agent-runtime-worker-completion/v1',
    executor: 'agent_runtime_worker',
    adapterWorkflow: 'agent_runtime_local_completion',
    sideEffectMode: 'none',
    sideEffectsApplied: false,
    summary:
      'Local Agent Runtime workflow adapter completed without external side effects.',
    workerAttempt: 1,
  });
  t.truthy(workerCompletion.workerLeaseId);
  t.like(workerCompletion.adapterResolution, {
    version: 'agent-runtime-worker-adapter-resolution/v1',
    status: 'completed',
    workflow: 'agent_runtime_local_completion',
    requestedStepTypes: ['model', 'tool'],
    adapter: {
      workflow: 'agent_runtime_local_completion',
      supportedStepTypes: [
        'approval',
        'codex',
        'handoff',
        'mcp',
        'model',
        'tool',
      ],
      sideEffectMode: 'none',
    },
  });
  t.true(
    workerCompletion.adapterResolution?.registeredAdapters.some(
      adapter => adapter.workflow === 'agent_runtime_record_only'
    ) ?? false
  );
  const finalEvent =
    completed?.timelineEvents[completed.timelineEvents.length - 1];
  t.is(finalEvent?.summary, 'Agent runtime worker completed standalone run');
  t.deepEqual(finalEvent?.payload, {
    version: 'agent-runtime-worker-completion/v1',
    executor: 'agent_runtime_worker',
    adapterWorkflow: 'agent_runtime_local_completion',
    sideEffectMode: 'none',
    sideEffectsApplied: false,
    summary:
      'Local Agent Runtime workflow adapter completed without external side effects.',
    workerAttempt: 1,
    workerMaxAttempts: 1,
    workerLeaseId: workerCompletion.workerLeaseId,
    workflow: 'agent_runtime_local_completion',
    sourceType: 'agent_runtime_test',
    sourceId: 'local-completion-runtime-run',
    adapterResolution: finalEvent?.payload.adapterResolution,
  });
  t.like(finalEvent?.payload.adapterResolution, {
    status: 'completed',
    workflow: 'agent_runtime_local_completion',
  });
  const stepCompletionEvent = completed?.timelineEvents.find(
    event => event.eventType === 'model_step' && event.status === 'completed'
  );
  t.like(stepCompletionEvent?.payload, {
    version: 'agent-runtime-worker-completion/v1',
    executor: 'agent_runtime_worker',
    adapterWorkflow: 'agent_runtime_local_completion',
    sideEffectMode: 'none',
    sideEffectsApplied: false,
    stepKey: 'local_model_context',
    stepType: 'model',
    workerAttempt: 1,
    workerLeaseId: workerCompletion.workerLeaseId,
  });
  t.is(completed?.executionResultCount, 1);
  t.like(completed?.executionResults[0], {
    adapterWorkflow: 'agent_runtime_local_completion',
    executor: 'agent_runtime_worker',
    resultStatus: 'completed',
    runId: run.id,
    sideEffectMode: 'none',
    sideEffectsApplied: false,
    summary:
      'Local Agent Runtime workflow adapter completed without external side effects.',
    workerAttempt: 1,
    workerLeaseId: workerCompletion.workerLeaseId,
  });
  t.like(completed?.executionResults[0]?.resultPayload, {
    version: 'agent-runtime-worker-execution-result/v1',
    resultStatus: 'completed',
    workflow: 'agent_runtime_local_completion',
    adapterWorkflow: 'agent_runtime_local_completion',
    executor: 'agent_runtime_worker',
    sideEffectMode: 'none',
    sideEffectsApplied: false,
    summary:
      'Local Agent Runtime workflow adapter completed without external side effects.',
  });
  t.like(completed?.executionResults[0]?.resultPayload.adapterResolution, {
    status: 'completed',
    workflow: 'agent_runtime_local_completion',
  });

  const detailResult = await app.gql({
    query: agentRuntimeRunQuery,
    variables: {
      id: run.id,
      workspaceId: workspace.id,
    },
  });
  t.deepEqual(
    detailResult.currentUser?.copilot.agentRuntimeWorkflowAdapters.find(
      (adapter: { workflow: string }) =>
        adapter.workflow === 'agent_runtime_local_completion'
    ),
    {
      workflow: 'agent_runtime_local_completion',
      capabilities: {
        version: 'agent-runtime-workflow-adapter-capabilities/v1',
        supportedStepTypes: [
          'approval',
          'codex',
          'handoff',
          'mcp',
          'model',
          'tool',
        ],
        sideEffectMode: 'none',
        summary:
          'Completes local Agent Runtime workflows through the generic worker completion contract.',
      },
    }
  );

  const resultRows = await db.$queryRaw<
    Array<{
      adapterWorkflow: string;
      executor: string;
      failureCode: string | null;
      resultPayload: {
        adapterResolution?: { status?: string };
        resultStatus?: string;
        sideEffectsApplied?: boolean;
        version?: string;
      };
      resultStatus: string;
      sideEffectMode: string;
      sideEffectsApplied: boolean;
      summary: string;
      workerLeaseId: string;
    }>
  >`
    SELECT
      adapter_workflow AS "adapterWorkflow",
      executor,
      failure_code AS "failureCode",
      result_payload AS "resultPayload",
      result_status AS "resultStatus",
      side_effect_mode AS "sideEffectMode",
      side_effects_applied AS "sideEffectsApplied",
      summary,
      worker_lease_id AS "workerLeaseId"
    FROM ai_agent_runtime_execution_results
    WHERE run_id = ${run.id}
  `;
  t.is(resultRows.length, 1);
  t.like(resultRows[0], {
    adapterWorkflow: 'agent_runtime_local_completion',
    executor: 'agent_runtime_worker',
    failureCode: null,
    resultStatus: 'completed',
    sideEffectMode: 'none',
    sideEffectsApplied: false,
    summary:
      'Local Agent Runtime workflow adapter completed without external side effects.',
    workerLeaseId: workerCompletion.workerLeaseId,
  });
  t.is(resultRows[0]?.resultPayload.adapterResolution?.status, 'completed');

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runtime_execution_results
      SET result_payload = result_payload - ${'adapterResolution'}
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_runtime_execution_results_status_payload_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET output_summary = jsonb_set(
        output_summary,
        ${'{workerCompletion,adapterResolution,status}'}::text[],
        ${JSON.stringify('execution_failed')}::jsonb
      )
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_steps_worker_completion_payload_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET output_summary = jsonb_set(
        output_summary,
        ${'{workerFailure}'}::text[],
        ${JSON.stringify({
          version: 'agent-runtime-worker-failure/v1',
          failureCode: 'completed_resolution_in_failure',
          failureMessage:
            'Completed adapter resolution cannot be failure evidence.',
          workerAttempt: 1,
          workerLeaseId: workerCompletion.workerLeaseId,
          adapterResolution: workerCompletion.adapterResolution,
        })}::jsonb
      )
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_steps_worker_failure_payload_check/,
    }
  );
});

test('standalone Agent Runtime worker executes model steps through the model completion adapter', async t => {
  const { agentRuntimeWorker, app, owner } = t.context;
  const workspace = await createWorkspace(app);
  const promptRuntime = app.get(PromptRuntime);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_model_completion',
    sourceType: 'agent_runtime_test',
    sourceId: 'model-completion-runtime-run',
    status: 'queued',
    title: 'Model completion runtime run',
    steps: [
      {
        stepKey: 'model_generate',
        stepType: 'model',
        outputSummary: {
          modelRequest: {
            version: 'agent-runtime-model-request/v1',
            promptName: 'Summary',
            params: { content: 'model completion adapter source content' },
            modelId: 'model-completion-e2e-model',
          },
        },
      },
    ],
  });

  const runTextStub = Sinon.stub(promptRuntime, 'runText').resolves(
    '  Model completion adapter\n produced   output with apiKey=sk-test-secret-token and owner user@example.com. '
  );
  try {
    const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
      workspaceId: workspace.id,
      runId: run.id,
    });
    t.is(signal, JOB_SIGNAL.Done);
  } finally {
    runTextStub.restore();
  }

  t.is(runTextStub.callCount, 1);
  const [promptName, params, options] = runTextStub.firstCall.args;
  t.is(promptName, 'Summary');
  t.deepEqual(params, {
    content: 'model completion adapter source content',
  });
  t.is(options?.modelId, 'model-completion-e2e-model');
  t.is(options?.providerOptions?.workspace, workspace.id);
  t.is(options?.providerOptions?.user, owner.id);
  t.true(options?.providerOptions?.signal instanceof AbortSignal);

  const completed = await app.models.copilotAgentRuntime.get(
    workspace.id,
    run.id
  );
  t.truthy(completed);
  t.is(completed?.status, 'completed');
  t.is(completed?.failureCode, null);
  t.is(completed?.workerAttempt, 1);
  t.is(completed?.workerLeaseId, null);
  t.deepEqual(
    completed?.steps.map(step => step.status),
    ['completed']
  );
  t.like(completed?.steps[0].outputSummary.modelRequest, {
    version: 'agent-runtime-model-request/v1',
    promptName: 'Summary',
    modelId: 'model-completion-e2e-model',
  });
  const workerCompletion = completed?.steps[0].outputSummary
    .workerCompletion as {
    adapterResolution?: {
      adapter: {
        sideEffectMode: string;
        supportedStepTypes: string[];
        workflow: string;
      };
      status: string;
    };
    adapterWorkflow: string;
    executor: string;
    sideEffectMode: string;
    sideEffectsApplied: boolean;
    summary: string;
    version: string;
  };
  t.like(workerCompletion, {
    version: 'agent-runtime-worker-completion/v1',
    executor: 'agent_runtime_worker',
    adapterWorkflow: 'agent_runtime_model_completion',
    sideEffectMode: 'none',
    sideEffectsApplied: false,
    summary:
      'Model step "model_generate" completed through prompt "Summary" (requested model model-completion-e2e-model): Model completion adapter produced output with apiKey=[redacted-secret] and owner [redacted-email].',
  });
  t.like(workerCompletion.adapterResolution, {
    status: 'completed',
    adapter: {
      workflow: 'agent_runtime_model_completion',
      supportedStepTypes: ['model'],
      sideEffectMode: 'none',
    },
  });
  t.is(completed?.executionResultCount, 1);
  t.like(completed?.executionResults[0], {
    adapterWorkflow: 'agent_runtime_model_completion',
    executor: 'agent_runtime_worker',
    resultStatus: 'completed',
    sideEffectMode: 'none',
    sideEffectsApplied: false,
    workerAttempt: 1,
  });
});

test('standalone Agent Runtime office task updates a workspace document after approval', async t => {
  const { agentRuntimeWorker, app, owner } = t.context;
  const workspace = await app.models.workspace.create(owner.id);
  await app.models.doc.upsert({
    spaceId: workspace.id,
    docId: workspace.id,
    blob: Buffer.from([0, 0]),
    timestamp: Date.now(),
    editorId: owner.id,
  });
  const docWriter = app.get(DocWriter);
  const docReader = app.get(DocReader);
  const createdDoc = await docWriter.createDoc(
    workspace.id,
    'Agent Runtime Doc Update',
    'Original body from e2e.',
    owner.id
  );
  const nextContent = [
    'Updated by approval-gated Agent Runtime office task.',
    '',
    '- Side effect ledger should be applied.',
  ].join('\n');

  const requestResult = await app.gql({
    query: agentRuntimeDocUpdateRequestMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        docId: createdDoc.docId,
        content: nextContent,
        idempotencyKey: 'doc-update-office-task-e2e',
        title: 'Approved doc update',
        reason: 'verify office task side effect',
      },
    },
  });
  const requested = requestResult.requestCopilotAgentRuntimeDocUpdate as {
    id: string;
    status: string;
    steps: Array<{
      outputSummary: Record<string, unknown>;
      status: string;
      stepType: string;
    }>;
    workflow: string;
  };
  t.is(requested.workflow, 'agent_runtime_doc_update');
  t.is(requested.status, 'waiting_approval');
  t.deepEqual(
    requested.steps.map(step => [step.stepType, step.status]),
    [
      ['approval', 'waiting_approval'],
      ['tool', 'waiting_approval'],
    ]
  );
  t.like(requested.steps[1].outputSummary.docUpdateRequest, {
    version: 'agent-runtime-doc-update-request/v1',
    docId: createdDoc.docId,
    content: nextContent,
  });

  const approvedResult = await app.gql({
    query: agentRuntimeControlMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        runId: requested.id,
        action: 'approve',
        reason: 'approved by e2e',
      },
    },
  });
  const approved = approvedResult.controlCopilotAgentRuntimeRun as {
    status: string;
    steps: Array<{ status: string; stepType: string }>;
  };
  t.is(approved.status, 'queued');
  t.deepEqual(
    approved.steps.map(step => [step.stepType, step.status]),
    [
      ['approval', 'completed'],
      ['tool', 'pending'],
    ]
  );

  const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
    workspaceId: workspace.id,
    runId: requested.id,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const completed = await app.models.copilotAgentRuntime.get(
    workspace.id,
    requested.id
  );
  t.is(completed?.status, 'completed');
  t.is(completed?.executionResultCount, 1);
  t.deepEqual(
    completed?.steps.map(step => [step.stepType, step.status]),
    [
      ['approval', 'completed'],
      ['tool', 'completed'],
    ]
  );
  const toolCompletion = completed?.steps.find(step => step.stepType === 'tool')
    ?.outputSummary.workerCompletion as {
    sideEffectSummary?: Record<string, unknown>;
    sideEffectsApplied: boolean;
  };
  t.true(toolCompletion.sideEffectsApplied);
  t.like(toolCompletion.sideEffectSummary, {
    version: 'agent-runtime-doc-update-side-effect/v1',
    sideEffectKind: 'workspace_doc_update',
    sideEffectRecordId: createdDoc.docId,
    docId: createdDoc.docId,
    idempotencyMode: 'deterministic_doc_body_update',
  });
  t.like(completed?.executionResults[0], {
    adapterWorkflow: 'agent_runtime_doc_update',
    resultStatus: 'completed',
    sideEffectMode: 'workspace_write',
    sideEffectsApplied: true,
  });
  t.like(completed?.executionResults[0].resultPayload.sideEffectSummary, {
    sideEffectKind: 'workspace_doc_update',
    sideEffectRecordId: createdDoc.docId,
  });

  const markdown = await docReader.getDocMarkdown(
    workspace.id,
    createdDoc.docId,
    true
  );
  t.true(
    markdown?.markdown.includes('Updated by approval-gated Agent Runtime')
  );
  t.true(markdown?.markdown.includes('Side effect ledger should be applied.'));
});

test('standalone Agent Runtime model completion bounds oversized model output evidence', async t => {
  const { agentRuntimeWorker, app, owner } = t.context;
  const workspace = await createWorkspace(app);
  const promptRuntime = app.get(PromptRuntime);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_model_completion',
    sourceType: 'agent_runtime_test',
    sourceId: 'model-completion-bounded-output-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'model_generate',
        stepType: 'model',
        outputSummary: {
          modelRequest: {
            version: 'agent-runtime-model-request/v1',
            promptName: 'Summary',
          },
        },
      },
    ],
  });

  const runTextStub = Sinon.stub(promptRuntime, 'runText').resolves(
    'o'.repeat(5000)
  );
  try {
    const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
      workspaceId: workspace.id,
      runId: run.id,
    });
    t.is(signal, JOB_SIGNAL.Done);
  } finally {
    runTextStub.restore();
  }

  const completed = await app.models.copilotAgentRuntime.get(
    workspace.id,
    run.id
  );
  t.is(completed?.status, 'completed');
  const workerCompletion = completed?.steps[0].outputSummary
    .workerCompletion as { summary: string };
  t.true(workerCompletion.summary.includes(`: ${'o'.repeat(640)}…`));
  t.true(workerCompletion.summary.length <= 1024);
});

test('standalone Agent Runtime model completion fails closed on invalid model requests', async t => {
  const { agentRuntimeWorker, app, owner } = t.context;
  const workspace = await createWorkspace(app);
  const promptRuntime = app.get(PromptRuntime);
  const missingRequestRun = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_model_completion',
    sourceType: 'agent_runtime_test',
    sourceId: 'model-completion-missing-request-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'model_generate',
        stepType: 'model',
      },
    ],
  });

  const runTextStub = Sinon.stub(promptRuntime, 'runText').resolves(
    'unused output'
  );
  try {
    const missingRequestSignal =
      await agentRuntimeWorker.runStandaloneAgentRuntime({
        workspaceId: workspace.id,
        runId: missingRequestRun.id,
      });
    t.is(missingRequestSignal, JOB_SIGNAL.Done);

    const missingRequestFailed = await app.models.copilotAgentRuntime.get(
      workspace.id,
      missingRequestRun.id
    );
    t.is(missingRequestFailed?.status, 'failed');
    t.is(
      missingRequestFailed?.failureCode,
      'agent_runtime_adapter_execution_failed'
    );
    t.true(
      missingRequestFailed?.failureMessage?.includes('invalid model request') ??
        false
    );
    t.is(runTextStub.callCount, 0);
    t.is(missingRequestFailed?.executionResultCount, 1);
    t.like(missingRequestFailed?.executionResults[0], {
      resultStatus: 'failed',
      failureCode: 'agent_runtime_adapter_execution_failed',
    });

    const badVersionRun = await app.models.copilotAgentRuntime.createRun({
      workspaceId: workspace.id,
      actorId: owner.id,
      workflow: 'agent_runtime_model_completion',
      sourceType: 'agent_runtime_test',
      sourceId: 'model-completion-bad-version-run',
      status: 'queued',
      steps: [
        {
          stepKey: 'model_generate',
          stepType: 'model',
          outputSummary: {
            modelRequest: {
              version: 'agent-runtime-model-request/v0',
              promptName: 'Summary',
            },
          },
        },
      ],
    });
    const badVersionSignal = await agentRuntimeWorker.runStandaloneAgentRuntime(
      {
        workspaceId: workspace.id,
        runId: badVersionRun.id,
      }
    );
    t.is(badVersionSignal, JOB_SIGNAL.Done);
    const badVersionFailed = await app.models.copilotAgentRuntime.get(
      workspace.id,
      badVersionRun.id
    );
    t.is(badVersionFailed?.status, 'failed');
    t.is(
      badVersionFailed?.failureCode,
      'agent_runtime_adapter_execution_failed'
    );
    t.true(
      badVersionFailed?.failureMessage?.includes(
        'version must be agent-runtime-model-request/v1'
      ) ?? false
    );
    t.is(runTextStub.callCount, 0);
  } finally {
    runTextStub.restore();
  }
});

test('standalone Agent Runtime model completion consumes cooperative cancellation during generation', async t => {
  const { agentRuntimeWorker, app, owner } = t.context;
  const workspace = await createWorkspace(app);
  const promptRuntime = app.get(PromptRuntime);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_model_completion',
    sourceType: 'agent_runtime_test',
    sourceId: 'model-completion-cancel-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'model_generate',
        stepType: 'model',
        outputSummary: {
          modelRequest: {
            version: 'agent-runtime-model-request/v1',
            promptName: 'Summary',
          },
        },
      },
    ],
  });

  const runTextStub = Sinon.stub(promptRuntime, 'runText').callsFake(
    async (_promptName, _params, options) => {
      await app.models.copilotAgentRuntime.controlRun({
        workspaceId: workspace.id,
        actorId: owner.id,
        id: run.id,
        action: 'cancel',
        reason: 'cancel during model generation',
      });
      return await new Promise<string>((_resolve, reject) => {
        options?.providerOptions?.signal?.addEventListener('abort', () => {
          reject(new Error('model generation aborted'));
        });
      });
    }
  );
  try {
    const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
      workspaceId: workspace.id,
      runId: run.id,
    });
    t.is(signal, JOB_SIGNAL.Done);
  } finally {
    runTextStub.restore();
  }

  const cancelled = await app.models.copilotAgentRuntime.get(
    workspace.id,
    run.id
  );
  t.is(cancelled?.status, 'cancelled');
  t.is(cancelled?.failureCode, null);
  t.is(cancelled?.workerLeaseId, null);
  t.deepEqual(
    cancelled?.steps.map(step => step.status),
    ['skipped']
  );
  t.is(cancelled?.executionResultCount, 0);
  const cancelRequestedEvent = cancelled?.timelineEvents.find(
    event =>
      event.eventType === 'run_cancellation' &&
      event.payload.action === 'cancel_requested'
  );
  t.truthy(cancelRequestedEvent);
});

test('standalone Agent Runtime worker ignores stale completion after same-lease attempt drift', async t => {
  const { agentRuntimeWorker, agentRuntimeWorkflowRegistry, app, db, owner } =
    t.context;
  let staleCompletionRejected = false;
  agentRuntimeWorkflowRegistry.register({
    workflow: 'agent_runtime_attempt_drift_completion_e2e',
    capabilities: {
      version: 'agent-runtime-workflow-adapter-capabilities/v1',
      supportedStepTypes: ['model'],
      sideEffectMode: 'none',
      summary:
        'E2E adapter that simulates same-lease worker attempt drift before completion',
    },
    execute: async ({ run, workerLeaseId }) => {
      const driftedAttempt = run.workerAttempt + 1;
      const driftedAttemptAt = new Date(run.updatedAt.getTime() + 1000);
      const nextOrdinal =
        Math.max(-1, ...run.timelineEvents.map(item => item.ordinal)) + 1;
      const driftedAttemptSummary = 'Agent runtime test worker attempt drifted';
      const driftedAttemptPayload = {
        version: 'agent-runtime-test-attempt-drift/v1',
        workflow: run.workflow,
        sourceType: run.sourceType,
        sourceId: run.sourceId,
        previousWorkerAttempt: run.workerAttempt,
        workerAttempt: driftedAttempt,
        workerLeaseId,
      };
      const driftedAttemptEventFingerprint = agentRuntimeFingerprint({
        version: 'agent-runtime-timeline-event/v1',
        runId: run.id,
        stepId: null,
        eventType: 'run_status',
        status: 'running',
        ordinal: nextOrdinal,
        summary: driftedAttemptSummary,
        payload: driftedAttemptPayload,
      });
      const driftedTimelineFingerprint = agentRuntimeFingerprint({
        version: 'agent-runtime-timeline/v1',
        events: [
          ...run.timelineEvents.map(event => ({
            eventType: event.eventType,
            status: event.status,
            ordinal: event.ordinal,
            summary: event.summary,
          })),
          {
            eventType: 'run_status',
            status: 'running',
            ordinal: nextOrdinal,
            summary: driftedAttemptSummary,
          },
        ],
      });

      await db.$transaction(async tx => {
        await tx.$executeRaw`
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
          VALUES (
            ${`agent-runtime-attempt-drift-${driftedAttemptEventFingerprint}`},
            ${run.id},
            ${null},
            ${run.workspaceId},
            ${run.actorId},
            ${'run_status'},
            ${'running'},
            ${nextOrdinal},
            ${driftedAttemptSummary},
            ${JSON.stringify(driftedAttemptPayload)}::jsonb,
            ${driftedAttemptEventFingerprint},
            ${driftedAttemptAt}
          )
        `;
        await tx.$executeRaw`
          UPDATE ai_agent_runs
          SET
            worker_attempt = ${driftedAttempt},
            worker_max_attempts = ${driftedAttempt},
            timeline_fingerprint = ${driftedTimelineFingerprint},
            updated_at = ${driftedAttemptAt}
          WHERE workspace_id = ${run.workspaceId}
            AND id = ${run.id}
            AND worker_lease_id = ${workerLeaseId}
            AND worker_attempt = ${run.workerAttempt}
        `;
      });

      await t.throwsAsync(
        app.models.copilotAgentRuntime.completeStandaloneWorkerExecution({
          workspaceId: run.workspaceId,
          id: run.id,
          workerLeaseId,
          workerAttempt: run.workerAttempt,
          adapterWorkflow: 'agent_runtime_attempt_drift_completion_e2e',
          sideEffectMode: 'none',
          summary: 'stale attempt completion should not persist',
          adapterResolution: {
            version: 'agent-runtime-worker-adapter-resolution/v1',
            status: 'completed',
            workflow: run.workflow,
            requestedStepTypes: ['model'],
            adapter: {
              workflow: 'agent_runtime_attempt_drift_completion_e2e',
              supportedStepTypes: ['model'],
              sideEffectMode: 'none',
            },
            registeredAdapters: [
              {
                workflow: 'agent_runtime_attempt_drift_completion_e2e',
                supportedStepTypes: ['model'],
                sideEffectMode: 'none',
              },
            ],
          },
        }),
        {
          message: /not leased by this worker|state changed/,
        }
      );
      staleCompletionRejected = true;
    },
  });

  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_attempt_drift_completion_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'attempt-drift-completion-runtime-run',
    status: 'queued',
    title: 'Attempt drift completion runtime run',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
      },
    ],
  });

  const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
    workspaceId: workspace.id,
    runId: run.id,
  });
  t.is(signal, JOB_SIGNAL.Done);
  t.true(staleCompletionRejected);

  const rows = await db.$queryRaw<
    Array<{
      completedTimelineCount: number;
      executionResultCount: number;
      failedTimelineCount: number;
      failureCode: string | null;
      status: string;
      stepStatus: string;
      workerAttempt: number;
      workerCompletionStepCount: number;
      workerFailureStepCount: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.status,
      r.failure_code AS "failureCode",
      r.worker_attempt AS "workerAttempt",
      r.worker_lease_id AS "workerLeaseId",
      s.status AS "stepStatus",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_runtime_execution_results er
        WHERE er.run_id = r.id
      ) AS "executionResultCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps completed_step
        WHERE completed_step.run_id = r.id
          AND completed_step.output_summary -> ${'workerCompletion'} IS NOT NULL
      ) AS "workerCompletionStepCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps failed_step
        WHERE failed_step.run_id = r.id
          AND failed_step.output_summary -> ${'workerFailure'} IS NOT NULL
      ) AS "workerFailureStepCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events completed_event
        WHERE completed_event.run_id = r.id
          AND completed_event.summary = ${'Agent runtime worker completed standalone run'}
      ) AS "completedTimelineCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events failed_event
        WHERE failed_event.run_id = r.id
          AND failed_event.summary = ${'Agent runtime worker failed standalone run'}
      ) AS "failedTimelineCount"
    FROM ai_agent_runs r
    JOIN ai_agent_steps s ON s.run_id = r.id
    WHERE r.id = ${run.id}
  `;
  t.is(rows.length, 1);
  t.like(rows[0], {
    completedTimelineCount: 0,
    executionResultCount: 0,
    failedTimelineCount: 0,
    failureCode: null,
    status: 'running',
    stepStatus: 'running',
    workerAttempt: 2,
    workerCompletionStepCount: 0,
    workerFailureStepCount: 0,
  });
  t.truthy(rows[0]?.workerLeaseId);
});

test('standalone Agent Runtime record-only completion fails closed when run state changes before update', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const runtime = app.get(Models).copilotAgentRuntime;
  const run = await runtime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_record_only',
    sourceType: 'agent_runtime_test',
    sourceId: 'stale-record-only-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
      },
    ],
  });

  const lease = await runtime.acquireStandaloneWorkerLease({
    workspaceId: workspace.id,
    id: run.id,
    workerId: 'record-only-stale-complete-worker-e2e',
    leaseMs: 60_000,
  });
  t.truthy(lease);
  const staleExisting = await runtime.get(workspace.id, run.id);
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'running');
  const cancelledAt = new Date(staleExisting!.updatedAt.getTime() + 1000);
  const cancellationOrdinal =
    Math.max(-1, ...staleExisting!.timelineEvents.map(event => event.ordinal)) +
    1;
  const cancellationPayload = {
    version: 'agent-runtime-manual-control/v1',
    action: 'cancel',
    actorId: owner.id,
    previousStatus: staleExisting!.status,
    workflow: staleExisting!.workflow,
    sourceType: staleExisting!.sourceType,
    sourceId: staleExisting!.sourceId,
    controlledAt: cancelledAt.toISOString(),
    reason: 'stale record-only fixture cancellation',
  };
  await db.$transaction(async tx => {
    await tx.$executeRaw`
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
      VALUES (
        ${'record-only-stale-cancel-timeline-event'},
        ${run.id},
        ${null},
        ${workspace.id},
        ${owner.id},
        ${'run_cancellation'},
        ${'cancelled'},
        ${cancellationOrdinal},
        ${'Agent runtime run manually cancelled'},
        ${JSON.stringify(cancellationPayload)}::jsonb,
        ${agentRuntimeFingerprint({
          version: 'agent-runtime-timeline-event/v1',
          runId: run.id,
          stepId: null,
          eventType: 'run_cancellation',
          status: 'cancelled',
          ordinal: cancellationOrdinal,
          summary: 'Agent runtime run manually cancelled',
          payload: cancellationPayload,
        })},
        ${cancelledAt}
      )
    `;
    await tx.$executeRaw`
      UPDATE ai_agent_runs
      SET
        status = ${'cancelled'},
        timeline_fingerprint = ${agentRuntimeFingerprint({
          version: 'agent-runtime-timeline/v1',
          events: [
            ...staleExisting!.timelineEvents.map(event => ({
              eventType: event.eventType,
              status: event.status,
              ordinal: event.ordinal,
              summary: event.summary,
            })),
            {
              eventType: 'run_cancellation',
              status: 'cancelled',
              ordinal: cancellationOrdinal,
              summary: 'Agent runtime run manually cancelled',
            },
          ],
        })},
        completed_at = ${cancelledAt},
        failure_code = ${null},
        failure_message = ${null},
        queued_at = ${null},
        worker_lease_id = ${null},
        worker_lease_expires_at = ${null},
        updated_at = ${cancelledAt}
      WHERE id = ${run.id}
    `;
  });

  const originalGet = runtime.get.bind(runtime);
  let returnedStaleRecord = false;
  runtime.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof runtime.get;
  try {
    await t.throwsAsync(
      runtime.completeStandaloneRecordOnlyExecution({
        workspaceId: workspace.id,
        id: run.id,
        workerLeaseId: 'record-only-stale-complete-worker-e2e',
        workerAttempt: staleExisting!.workerAttempt,
      }),
      {
        message: /could not be completed because its state changed/,
      }
    );
  } finally {
    runtime.get = originalGet as typeof runtime.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      status: string;
      resultLedgerCount: number;
      recordOnlyStepCount: number;
      completedTimelineCount: number;
    }>
  >`
    SELECT
      r.status,
      (
        SELECT COUNT(*)::int
        FROM ai_agent_runtime_execution_results er
        WHERE er.run_id = r.id
      ) AS "resultLedgerCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps s
        WHERE s.run_id = r.id
          AND s.output_summary -> ${'recordOnlyExecution'} IS NOT NULL
      ) AS "recordOnlyStepCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.summary = ${'Agent runtime record-only worker completed standalone run'}
      ) AS "completedTimelineCount"
    FROM ai_agent_runs r
    WHERE r.id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      status: 'cancelled',
      resultLedgerCount: 0,
      recordOnlyStepCount: 0,
      completedTimelineCount: 0,
    },
  ]);
});

test('standalone Agent Runtime record-only completion fails closed when running snapshot evidence changes before update', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const runtime = app.get(Models).copilotAgentRuntime;
  const run = await runtime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_record_only',
    sourceType: 'agent_runtime_test',
    sourceId: 'record-only-running-snapshot-drift-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
      },
    ],
  });

  const lease = await runtime.acquireStandaloneWorkerLease({
    workspaceId: workspace.id,
    id: run.id,
    workerId: 'record-only-running-snapshot-drift-worker',
    leaseMs: 60_000,
  });
  t.truthy(lease);
  const staleExisting = await runtime.get(workspace.id, run.id);
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'running');

  const driftedAt = new Date(staleExisting!.updatedAt.getTime() + 60_000);
  const driftedRows = await db.$executeRaw`
    UPDATE ai_agent_runs
    SET updated_at = ${driftedAt}
    WHERE id = ${run.id}
      AND status = ${'running'}
  `;
  t.is(driftedRows, 1);

  const originalGet = runtime.get.bind(runtime);
  let returnedStaleRecord = false;
  runtime.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof runtime.get;
  try {
    await t.throwsAsync(
      runtime.completeStandaloneRecordOnlyExecution({
        workspaceId: workspace.id,
        id: run.id,
        workerLeaseId: 'record-only-running-snapshot-drift-worker',
        workerAttempt: staleExisting!.workerAttempt,
        summary: 'stale record-only completion should not persist',
      }),
      {
        message: /could not be completed because its state changed/,
      }
    );
  } finally {
    runtime.get = originalGet as typeof runtime.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      completedTimelineCount: number;
      recordOnlyStepCount: number;
      resultLedgerCount: number;
      status: string;
      updatedAt: Date;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.status,
      r.updated_at AS "updatedAt",
      r.worker_lease_id AS "workerLeaseId",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_runtime_execution_results er
        WHERE er.run_id = r.id
      ) AS "resultLedgerCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps s
        WHERE s.run_id = r.id
          AND s.output_summary -> ${'recordOnlyExecution'} IS NOT NULL
      ) AS "recordOnlyStepCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.summary = ${'Agent runtime record-only worker completed standalone run'}
      ) AS "completedTimelineCount"
    FROM ai_agent_runs r
    WHERE r.id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      completedTimelineCount: 0,
      recordOnlyStepCount: 0,
      resultLedgerCount: 0,
      status: 'running',
      updatedAt: driftedAt,
      workerLeaseId: 'record-only-running-snapshot-drift-worker',
    },
  ]);
});

test('standalone Agent Runtime record-only completion fails closed when active step snapshot evidence changes before update', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const runtime = app.get(Models).copilotAgentRuntime;
  const run = await runtime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_record_only',
    sourceType: 'agent_runtime_test',
    sourceId: 'record-only-step-terminal-snapshot-drift-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
      },
    ],
  });

  const lease = await runtime.acquireStandaloneWorkerLease({
    workspaceId: workspace.id,
    id: run.id,
    workerId: 'record-only-step-terminal-snapshot-drift-worker',
    leaseMs: 60_000,
  });
  t.truthy(lease);
  const staleExisting = await runtime.get(workspace.id, run.id);
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'running');
  const staleStep = staleExisting?.steps[0];
  t.truthy(staleStep);

  const driftedAt = new Date(staleStep!.updatedAt.getTime() + 60_000);
  const driftedRows = await db.$executeRaw`
    UPDATE ai_agent_steps
    SET updated_at = ${driftedAt}
    WHERE id = ${staleStep!.id}
      AND status = ${staleStep!.status}
  `;
  t.is(driftedRows, 1);

  const originalGet = runtime.get.bind(runtime);
  let returnedStaleRecord = false;
  runtime.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof runtime.get;
  try {
    await t.throwsAsync(
      runtime.completeStandaloneRecordOnlyExecution({
        workspaceId: workspace.id,
        id: run.id,
        workerLeaseId: 'record-only-step-terminal-snapshot-drift-worker',
        workerAttempt: staleExisting!.workerAttempt,
        summary: 'stale record-only step should not persist',
      }),
      {
        message: /step could not be completed because its state changed/,
      }
    );
  } finally {
    runtime.get = originalGet as typeof runtime.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      completedTimelineCount: number;
      recordOnlyStepCount: number;
      resultLedgerCount: number;
      status: string;
      stepUpdatedAt: Date;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.status,
      r.worker_lease_id AS "workerLeaseId",
      s.updated_at AS "stepUpdatedAt",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_runtime_execution_results er
        WHERE er.run_id = r.id
      ) AS "resultLedgerCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps step
        WHERE step.run_id = r.id
          AND step.output_summary -> ${'recordOnlyExecution'} IS NOT NULL
      ) AS "recordOnlyStepCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.summary = ${'Agent runtime record-only worker completed standalone run'}
      ) AS "completedTimelineCount"
    FROM ai_agent_runs r
    JOIN ai_agent_steps s ON s.run_id = r.id
    WHERE r.id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      completedTimelineCount: 0,
      recordOnlyStepCount: 0,
      resultLedgerCount: 0,
      status: 'running',
      stepUpdatedAt: driftedAt,
      workerLeaseId: 'record-only-step-terminal-snapshot-drift-worker',
    },
  ]);
});

test('standalone Agent Runtime worker failure fails closed when running snapshot evidence changes before update', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const runtime = app.get(Models).copilotAgentRuntime;
  const run = await runtime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_stale_failure_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'worker-failure-running-snapshot-drift-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
      },
    ],
  });

  const lease = await runtime.acquireStandaloneWorkerLease({
    workspaceId: workspace.id,
    id: run.id,
    workerId: 'worker-failure-running-snapshot-drift-worker',
    leaseMs: 60_000,
  });
  t.truthy(lease);
  const staleExisting = await runtime.get(workspace.id, run.id);
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'running');

  const driftedAt = new Date(staleExisting!.updatedAt.getTime() + 60_000);
  const driftedRows = await db.$executeRaw`
    UPDATE ai_agent_runs
    SET updated_at = ${driftedAt}
    WHERE id = ${run.id}
      AND status = ${'running'}
  `;
  t.is(driftedRows, 1);

  const originalGet = runtime.get.bind(runtime);
  let returnedStaleRecord = false;
  runtime.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof runtime.get;
  try {
    await t.throwsAsync(
      runtime.failStandaloneWorkerExecution({
        workspaceId: workspace.id,
        id: run.id,
        workerLeaseId: 'worker-failure-running-snapshot-drift-worker',
        workerAttempt: staleExisting!.workerAttempt,
        code: 'agent_runtime_adapter_execution_failed',
        message: 'stale worker failure should not persist',
      }),
      {
        message: /could not be failed because its state changed/,
      }
    );
  } finally {
    runtime.get = originalGet as typeof runtime.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      failedTimelineCount: number;
      resultLedgerCount: number;
      status: string;
      updatedAt: Date;
      workerFailureStepCount: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.status,
      r.updated_at AS "updatedAt",
      r.worker_lease_id AS "workerLeaseId",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_runtime_execution_results er
        WHERE er.run_id = r.id
      ) AS "resultLedgerCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps s
        WHERE s.run_id = r.id
          AND s.output_summary -> ${'workerFailure'} IS NOT NULL
      ) AS "workerFailureStepCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.summary = ${'Agent runtime worker failed standalone run'}
      ) AS "failedTimelineCount"
    FROM ai_agent_runs r
    WHERE r.id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      failedTimelineCount: 0,
      resultLedgerCount: 0,
      status: 'running',
      updatedAt: driftedAt,
      workerFailureStepCount: 0,
      workerLeaseId: 'worker-failure-running-snapshot-drift-worker',
    },
  ]);
});

test('standalone Agent Runtime generic completion fails closed when running snapshot evidence changes before update', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const runtime = app.get(Models).copilotAgentRuntime;
  const run = await runtime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_local_completion',
    sourceType: 'agent_runtime_test',
    sourceId: 'generic-completion-running-snapshot-drift-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'local_model_context',
        stepType: 'model',
      },
    ],
  });

  const lease = await runtime.acquireStandaloneWorkerLease({
    workspaceId: workspace.id,
    id: run.id,
    workerId: 'generic-completion-running-snapshot-drift-worker',
    leaseMs: 60_000,
  });
  t.truthy(lease);
  const staleExisting = await runtime.get(workspace.id, run.id);
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'running');

  const driftedAt = new Date(staleExisting!.updatedAt.getTime() + 60_000);
  const driftedRows = await db.$executeRaw`
    UPDATE ai_agent_runs
    SET updated_at = ${driftedAt}
    WHERE id = ${run.id}
      AND status = ${'running'}
  `;
  t.is(driftedRows, 1);

  const originalGet = runtime.get.bind(runtime);
  let returnedStaleRecord = false;
  runtime.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof runtime.get;
  try {
    await t.throwsAsync(
      runtime.completeStandaloneWorkerExecution({
        workspaceId: workspace.id,
        id: run.id,
        workerLeaseId: 'generic-completion-running-snapshot-drift-worker',
        workerAttempt: staleExisting!.workerAttempt,
        adapterWorkflow: 'agent_runtime_local_completion',
        sideEffectMode: 'none',
        summary: 'stale generic completion should not persist',
        adapterResolution: {
          version: 'agent-runtime-worker-adapter-resolution/v1',
          status: 'completed',
          workflow: 'agent_runtime_local_completion',
          requestedStepTypes: ['model'],
          adapter: {
            workflow: 'agent_runtime_local_completion',
            supportedStepTypes: ['model'],
            sideEffectMode: 'none',
          },
          registeredAdapters: [
            {
              workflow: 'agent_runtime_local_completion',
              supportedStepTypes: ['model'],
              sideEffectMode: 'none',
            },
          ],
        },
      }),
      {
        message: /could not be completed because its state changed/,
      }
    );
  } finally {
    runtime.get = originalGet as typeof runtime.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      completedTimelineCount: number;
      resultLedgerCount: number;
      status: string;
      updatedAt: Date;
      workerCompletionStepCount: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.status,
      r.updated_at AS "updatedAt",
      r.worker_lease_id AS "workerLeaseId",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_runtime_execution_results er
        WHERE er.run_id = r.id
      ) AS "resultLedgerCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps s
        WHERE s.run_id = r.id
          AND s.output_summary -> ${'workerCompletion'} IS NOT NULL
      ) AS "workerCompletionStepCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.summary = ${'Agent runtime worker completed standalone run'}
      ) AS "completedTimelineCount"
    FROM ai_agent_runs r
    WHERE r.id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      completedTimelineCount: 0,
      resultLedgerCount: 0,
      status: 'running',
      updatedAt: driftedAt,
      workerCompletionStepCount: 0,
      workerLeaseId: 'generic-completion-running-snapshot-drift-worker',
    },
  ]);
});

test('Agent Runtime execution result conflict rejects mismatched ledger evidence', async t => {
  const { app, owner } = t.context;
  const workspace = await createWorkspace(app);
  const runtime = app.get(Models).copilotAgentRuntime;
  const run = await runtime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_record_only',
    sourceType: 'agent_runtime_test',
    sourceId: 'execution-result-ledger-conflict-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
      },
    ],
  });

  const leased = await runtime.acquireStandaloneWorkerLease({
    workspaceId: workspace.id,
    id: run.id,
    workerId: 'execution-result-ledger-conflict-worker',
    leaseMs: 60_000,
  });
  t.truthy(leased);
  const completed = await runtime.completeStandaloneRecordOnlyExecution({
    workspaceId: workspace.id,
    id: run.id,
    workerLeaseId: 'execution-result-ledger-conflict-worker',
    workerAttempt: leased!.workerAttempt,
    summary: 'Original execution result ledger summary',
  });
  const existingResult = completed.executionResults[0];
  t.truthy(existingResult);

  await t.throwsAsync(
    (
      runtime as unknown as {
        createWorkerExecutionResultLedgerEntry(input: {
          adapterResolution?: Record<string, unknown>;
          adapterWorkflow: string;
          completedAt: Date;
          executor: string;
          failureCode?: string | null;
          failureMessage?: string | null;
          resultStatus: 'completed' | 'failed';
          run: typeof completed;
          sideEffectMode: string;
          sideEffectsApplied: boolean;
          summary: string;
          workerLeaseId: string;
        }): Promise<void>;
      }
    ).createWorkerExecutionResultLedgerEntry({
      adapterWorkflow: existingResult!.adapterWorkflow,
      completedAt: existingResult!.completedAt,
      executor: existingResult!.executor,
      resultStatus: existingResult!.resultStatus,
      run: completed,
      sideEffectMode: existingResult!.sideEffectMode,
      sideEffectsApplied: existingResult!.sideEffectsApplied,
      summary: 'Drifted execution result ledger summary',
      workerLeaseId: existingResult!.workerLeaseId,
    }),
    {
      message:
        /Agent runtime execution result conflict reused mismatched ledger evidence/,
    }
  );

  const refreshed = await runtime.get(workspace.id, run.id);
  t.is(refreshed?.executionResultCount, 1);
  t.is(
    refreshed?.executionResults[0]?.summary,
    'Original execution result ledger summary'
  );
});

test('Agent Runtime execution result ledger fails closed when parent run snapshot changes before insert', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const runtime = app.get(Models).copilotAgentRuntime;
  const run = await runtime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_record_only',
    sourceType: 'agent_runtime_test',
    sourceId: 'execution-result-parent-snapshot-drift-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
      },
    ],
  });

  const leased = await runtime.acquireStandaloneWorkerLease({
    workspaceId: workspace.id,
    id: run.id,
    workerId: 'execution-result-parent-snapshot-drift-worker',
    leaseMs: 60_000,
  });
  t.truthy(leased);
  const completed = await runtime.completeStandaloneRecordOnlyExecution({
    workspaceId: workspace.id,
    id: run.id,
    workerLeaseId: 'execution-result-parent-snapshot-drift-worker',
    workerAttempt: leased!.workerAttempt,
    summary: 'Execution result parent snapshot drift original summary',
  });
  t.is(completed.status, 'completed');
  t.is(completed.executionResultCount, 1);

  const driftedAt = new Date(completed.updatedAt.getTime() + 60_000);
  const driftedRows = await db.$executeRaw`
    UPDATE ai_agent_runs
    SET updated_at = ${driftedAt}
    WHERE id = ${run.id}
      AND status = ${'completed'}
  `;
  t.is(driftedRows, 1);

  const staleRun = {
    ...completed,
    workerAttempt: completed.workerAttempt + 1,
  };
  await t.throwsAsync(
    (
      runtime as unknown as {
        createWorkerExecutionResultLedgerEntry(input: {
          adapterWorkflow: string;
          completedAt: Date;
          executor: string;
          resultStatus: 'completed' | 'failed';
          run: typeof staleRun;
          sideEffectMode: string;
          sideEffectsApplied: boolean;
          summary: string;
          workerLeaseId: string;
        }): Promise<void>;
      }
    ).createWorkerExecutionResultLedgerEntry({
      adapterWorkflow: 'agent_runtime_record_only',
      completedAt: completed.completedAt!,
      executor: 'agent_runtime_record_only_adapter',
      resultStatus: 'completed',
      run: staleRun,
      sideEffectMode: 'none',
      sideEffectsApplied: false,
      summary: 'Execution result parent snapshot drift stale summary',
      workerLeaseId: 'execution-result-parent-snapshot-drift-worker',
    }),
    {
      message:
        /Agent runtime execution result could not be recorded because its run state changed/,
    }
  );

  const rows = await db.$queryRaw<
    Array<{
      resultLedgerCount: number;
      status: string;
      updatedAt: Date;
    }>
  >`
    SELECT
      r.status,
      r.updated_at AS "updatedAt",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_runtime_execution_results er
        WHERE er.run_id = r.id
      ) AS "resultLedgerCount"
    FROM ai_agent_runs r
    WHERE r.id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      resultLedgerCount: 1,
      status: 'completed',
      updatedAt: driftedAt,
    },
  ]);
});

test('standalone Agent Runtime worker rejects registered adapter step contract drift', async t => {
  const { agentRuntimeWorker, agentRuntimeWorkflowRegistry, app, owner } =
    t.context;
  agentRuntimeWorkflowRegistry.register({
    workflow: 'agent_runtime_contract_guard_e2e',
    capabilities: {
      version: 'agent-runtime-workflow-adapter-capabilities/v1',
      supportedStepTypes: ['model'],
      sideEffectMode: 'none',
      summary: 'E2E adapter that only supports model steps',
    },
    execute: async () => {
      throw new Error('Contract guard should fail before adapter execution');
    },
  });

  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_contract_guard_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'contract-guard-runtime-run',
    status: 'queued',
    title: 'Contract guard runtime run',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
      },
      {
        stepKey: 'codex_patch',
        stepType: 'codex',
      },
    ],
  });

  const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
    workspaceId: workspace.id,
    runId: run.id,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const failed = await app.models.copilotAgentRuntime.get(workspace.id, run.id);
  t.truthy(failed);
  t.is(failed?.status, 'failed');
  t.is(failed?.failureCode, 'unsupported_agent_runtime_adapter_contract');
  t.true(
    failed?.failureMessage?.includes(
      'Agent Runtime workflow adapter agent_runtime_contract_guard_e2e does not support step types: codex.'
    ) ?? false
  );
  t.deepEqual(
    failed?.steps.map(step => step.status),
    ['failed', 'failed']
  );
  const workerFailure = failed?.steps[1].outputSummary.workerFailure as {
    adapterResolution?: {
      adapter: {
        sideEffectMode: string;
        supportedStepTypes: string[];
        workflow: string;
      };
      registeredAdapters: Array<{ workflow: string }>;
      requestedStepTypes: string[];
      status: string;
      unsupportedStepTypes: string[];
      version: string;
      workflow: string;
    };
    failureCode: string;
    failureMessage: string;
  };
  t.like(workerFailure, {
    failureCode: 'unsupported_agent_runtime_adapter_contract',
  });
  t.true(workerFailure.failureMessage.includes('Supported step types: model.'));
  t.like(workerFailure.adapterResolution, {
    version: 'agent-runtime-worker-adapter-resolution/v1',
    status: 'unsupported_contract',
    workflow: 'agent_runtime_contract_guard_e2e',
    requestedStepTypes: ['codex', 'model'],
    unsupportedStepTypes: ['codex'],
    adapter: {
      workflow: 'agent_runtime_contract_guard_e2e',
      supportedStepTypes: ['model'],
      sideEffectMode: 'none',
    },
  });
  t.true(
    workerFailure.adapterResolution?.registeredAdapters.some(
      adapter => adapter.workflow === 'agent_runtime_record_only'
    ) ?? false
  );
});

test('standalone Agent Runtime worker fails runs when registered adapter throws', async t => {
  const { agentRuntimeWorker, agentRuntimeWorkflowRegistry, app, db, owner } =
    t.context;
  const overlongFailureMessage = `  ${'x'.repeat(1200)}  `;
  const normalizedFailureMessage = 'x'.repeat(1024);
  agentRuntimeWorkflowRegistry.register({
    workflow: 'agent_runtime_throwing_adapter_e2e',
    capabilities: {
      version: 'agent-runtime-workflow-adapter-capabilities/v1',
      supportedStepTypes: ['model'],
      sideEffectMode: 'none',
      summary: 'E2E adapter that fails during execution',
    },
    execute: async () => {
      throw new Error(overlongFailureMessage);
    },
  });

  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_throwing_adapter_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'throwing-adapter-runtime-run',
    status: 'queued',
    title: 'Throwing adapter runtime run',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
      },
    ],
  });

  const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
    workspaceId: workspace.id,
    runId: run.id,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const failed = await app.models.copilotAgentRuntime.get(workspace.id, run.id);
  t.truthy(failed);
  t.is(failed?.status, 'failed');
  t.is(failed?.failureCode, 'agent_runtime_adapter_execution_failed');
  t.is(failed?.failureMessage, normalizedFailureMessage);
  t.is(failed?.workerLeaseId, null);
  t.deepEqual(
    failed?.steps.map(step => step.status),
    ['failed']
  );
  const workerFailure = failed?.steps[0].outputSummary.workerFailure as {
    adapterResolution?: {
      adapter: {
        sideEffectMode: string;
        supportedStepTypes: string[];
        workflow: string;
      };
      registeredAdapters: Array<{ workflow: string }>;
      requestedStepTypes: string[];
      status: string;
      version: string;
      workflow: string;
    };
    failureCode: string;
    failureMessage: string;
  };
  t.like(workerFailure, {
    failureCode: 'agent_runtime_adapter_execution_failed',
    failureMessage: normalizedFailureMessage,
  });
  t.like(workerFailure.adapterResolution, {
    version: 'agent-runtime-worker-adapter-resolution/v1',
    status: 'execution_failed',
    workflow: 'agent_runtime_throwing_adapter_e2e',
    requestedStepTypes: ['model'],
    adapter: {
      workflow: 'agent_runtime_throwing_adapter_e2e',
      supportedStepTypes: ['model'],
      sideEffectMode: 'none',
    },
  });
  t.true(
    workerFailure.adapterResolution?.registeredAdapters.some(
      adapter => adapter.workflow === 'agent_runtime_record_only'
    ) ?? false
  );
  t.true(
    workerFailure.adapterResolution?.registeredAdapters.some(
      adapter => adapter.workflow === 'agent_runtime_throwing_adapter_e2e'
    ) ?? false
  );
  t.like(failed?.timelineEvents.at(-2), {
    eventType: 'step_error',
    status: 'failed',
    payload: {
      failureCode: 'agent_runtime_adapter_execution_failed',
      failureMessage: normalizedFailureMessage,
    },
  });
  t.like(failed?.timelineEvents.at(-1), {
    eventType: 'run_status',
    status: 'failed',
    payload: {
      failureCode: 'agent_runtime_adapter_execution_failed',
      failureMessage: normalizedFailureMessage,
    },
  });
  const resultRows = await db.$queryRaw<
    Array<{
      adapterWorkflow: string;
      failureCode: string | null;
      failureMessage: string | null;
      resultPayload: {
        adapterResolution?: { status?: string };
        failureCode?: string;
        failureMessage?: string;
        resultStatus?: string;
      };
      resultStatus: string;
      summary: string;
      workerAttempt: number;
    }>
  >`
    SELECT
      adapter_workflow AS "adapterWorkflow",
      failure_code AS "failureCode",
      failure_message AS "failureMessage",
      result_payload AS "resultPayload",
      result_status AS "resultStatus",
      summary,
      worker_attempt AS "workerAttempt"
    FROM ai_agent_runtime_execution_results
    WHERE run_id = ${run.id}
  `;
  t.is(resultRows.length, 1);
  t.like(resultRows[0], {
    adapterWorkflow: 'agent_runtime_throwing_adapter_e2e',
    failureCode: 'agent_runtime_adapter_execution_failed',
    failureMessage: normalizedFailureMessage,
    resultStatus: 'failed',
    summary: normalizedFailureMessage,
    workerAttempt: 1,
  });
  t.like(resultRows[0]?.resultPayload, {
    resultStatus: 'failed',
    failureCode: 'agent_runtime_adapter_execution_failed',
    failureMessage: normalizedFailureMessage,
  });
  t.is(
    resultRows[0]?.resultPayload.adapterResolution?.status,
    'execution_failed'
  );

  agentRuntimeWorkflowRegistry.register({
    workflow: 'agent_runtime_blank_throwing_adapter_e2e',
    capabilities: {
      version: 'agent-runtime-workflow-adapter-capabilities/v1',
      supportedStepTypes: ['model'],
      sideEffectMode: 'none',
      summary: 'E2E adapter that throws a blank error message',
    },
    execute: async () => {
      throw new Error('   ');
    },
  });

  const blankFailureRun = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_blank_throwing_adapter_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'blank-throwing-adapter-runtime-run',
    status: 'queued',
    title: 'Blank throwing adapter runtime run',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
      },
    ],
  });

  await agentRuntimeWorker.runStandaloneAgentRuntime({
    workspaceId: workspace.id,
    runId: blankFailureRun.id,
  });
  const blankFailure = await app.models.copilotAgentRuntime.get(
    workspace.id,
    blankFailureRun.id
  );
  t.is(blankFailure?.failureMessage, 'Agent Runtime worker execution failed');
});

test('standalone Agent Runtime worker failure fails closed when run state changes before update', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_record_only',
    sourceType: 'agent_runtime_test',
    sourceId: 'stale-worker-failure-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
      },
    ],
  });

  const lease =
    await app.models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workspaceId: workspace.id,
      id: run.id,
      workerId: 'agent-runtime-stale-fail-worker-e2e',
      leaseMs: 60_000,
    });
  t.truthy(lease);
  const staleExisting = await app.models.copilotAgentRuntime.get(
    workspace.id,
    run.id
  );
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'running');
  await app.models.copilotAgentRuntime.completeStandaloneRecordOnlyExecution({
    workspaceId: workspace.id,
    id: run.id,
    workerLeaseId: 'agent-runtime-stale-fail-worker-e2e',
    workerAttempt: staleExisting!.workerAttempt,
    summary: 'completed before stale worker failure persistence',
  });

  const model = app.models.copilotAgentRuntime;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.failStandaloneWorkerExecution({
        workspaceId: workspace.id,
        id: run.id,
        workerLeaseId: 'agent-runtime-stale-fail-worker-e2e',
        workerAttempt: staleExisting!.workerAttempt,
        code: 'agent_runtime_adapter_execution_failed',
        message: 'stale worker failure should not persist',
      }),
      {
        message: /could not be failed because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const malformedResolutionRun = await app.models.copilotAgentRuntime.createRun(
    {
      workspaceId: workspace.id,
      actorId: owner.id,
      workflow: 'agent_runtime_malformed_adapter_resolution_e2e',
      sourceType: 'agent_runtime_test',
      sourceId: 'malformed-adapter-resolution-runtime-run',
      status: 'queued',
      steps: [
        {
          stepKey: 'tool_lookup',
          stepType: 'tool',
        },
      ],
    }
  );
  const malformedResolutionLease =
    await app.models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workspaceId: workspace.id,
      id: malformedResolutionRun.id,
      workerId: 'agent-runtime-malformed-resolution-worker-e2e',
      leaseMs: 60_000,
    });
  t.truthy(malformedResolutionLease);
  await t.throwsAsync(
    app.models.copilotAgentRuntime.failStandaloneWorkerExecution({
      workspaceId: workspace.id,
      id: malformedResolutionRun.id,
      workerLeaseId: 'agent-runtime-malformed-resolution-worker-e2e',
      workerAttempt: malformedResolutionLease!.workerAttempt,
      code: 'agent_runtime_adapter_execution_failed',
      message: 'malformed adapter resolution should not persist',
      adapterResolution: {
        version: 'agent-runtime-worker-adapter-resolution/v1',
        status: 'execution_failed',
        workflow: 'agent_runtime_malformed_adapter_resolution_e2e',
        requestedStepTypes: ['unknown_step_type'],
      },
    }),
    {
      message: 'Agent runtime step type is invalid',
    }
  );
  const stillRunningMalformedResolution =
    await app.models.copilotAgentRuntime.get(
      workspace.id,
      malformedResolutionRun.id
    );
  t.is(stillRunningMalformedResolution?.status, 'running');
  t.is(stillRunningMalformedResolution?.failureCode, null);

  const completedResolutionRun = await app.models.copilotAgentRuntime.createRun(
    {
      workspaceId: workspace.id,
      actorId: owner.id,
      workflow: 'agent_runtime_completed_resolution_failure_e2e',
      sourceType: 'agent_runtime_test',
      sourceId: 'completed-resolution-failure-runtime-run',
      status: 'queued',
      steps: [
        {
          stepKey: 'model_context',
          stepType: 'model',
        },
      ],
    }
  );
  const completedResolutionLease =
    await app.models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workspaceId: workspace.id,
      id: completedResolutionRun.id,
      workerId: 'agent-runtime-completed-resolution-failure-worker-e2e',
      leaseMs: 60_000,
    });
  await t.throwsAsync(
    app.models.copilotAgentRuntime.failStandaloneWorkerExecution({
      workspaceId: workspace.id,
      id: completedResolutionRun.id,
      workerLeaseId: 'agent-runtime-completed-resolution-failure-worker-e2e',
      workerAttempt: completedResolutionLease!.workerAttempt,
      code: 'agent_runtime_adapter_execution_failed',
      message: 'completed adapter resolution should not persist as failure',
      adapterResolution: {
        version: 'agent-runtime-worker-adapter-resolution/v1',
        status: 'completed',
        workflow: 'agent_runtime_completed_resolution_failure_e2e',
        requestedStepTypes: ['model'],
        adapter: {
          workflow: 'agent_runtime_completed_resolution_failure_e2e',
          supportedStepTypes: ['model'],
          sideEffectMode: 'none',
        },
        registeredAdapters: [
          {
            workflow: 'agent_runtime_completed_resolution_failure_e2e',
            supportedStepTypes: ['model'],
            sideEffectMode: 'none',
          },
        ],
      },
    }),
    {
      message:
        'Agent runtime failure adapter resolution status cannot be completed',
    }
  );
  const stillRunningCompletedResolution =
    await app.models.copilotAgentRuntime.get(
      workspace.id,
      completedResolutionRun.id
    );
  t.is(stillRunningCompletedResolution?.status, 'running');
  t.is(stillRunningCompletedResolution?.failureCode, null);

  const rows = await db.$queryRaw<
    Array<{
      status: string;
      resultLedgerCount: number;
      workerFailureStepCount: number;
      failedTimelineCount: number;
    }>
  >`
    SELECT
      r.status,
      (
        SELECT COUNT(*)::int
        FROM ai_agent_runtime_execution_results er
        WHERE er.run_id = r.id
      ) AS "resultLedgerCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps s
        WHERE s.run_id = r.id
          AND s.output_summary -> ${'workerFailure'} IS NOT NULL
      ) AS "workerFailureStepCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.summary = ${'Agent runtime worker failed standalone run'}
      ) AS "failedTimelineCount"
    FROM ai_agent_runs r
    WHERE r.id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      status: 'completed',
      resultLedgerCount: 1,
      workerFailureStepCount: 0,
      failedTimelineCount: 0,
    },
  ]);
});

test('standalone Agent Runtime worker preserves terminal run when adapter throws after releasing lease', async t => {
  const { agentRuntimeWorker, agentRuntimeWorkflowRegistry, app, owner } =
    t.context;
  agentRuntimeWorkflowRegistry.register({
    workflow: 'agent_runtime_fail_then_throw_e2e',
    capabilities: {
      version: 'agent-runtime-workflow-adapter-capabilities/v1',
      supportedStepTypes: ['model'],
      sideEffectMode: 'none',
      summary: 'E2E adapter that fails the run before throwing',
    },
    execute: async ({ run, workerLeaseId }) => {
      await app.models.copilotAgentRuntime.failStandaloneWorkerExecution({
        workspaceId: run.workspaceId,
        id: run.id,
        workerLeaseId,
        workerAttempt: run.workerAttempt,
        code: 'synthetic_adapter_inner_failure',
        message: 'synthetic adapter already failed the run',
      });
      throw new Error('post-terminal adapter failure');
    },
  });

  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_fail_then_throw_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'fail-then-throw-runtime-run',
    status: 'queued',
    title: 'Fail then throw adapter runtime run',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
      },
    ],
  });

  const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
    workspaceId: workspace.id,
    runId: run.id,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const failed = await app.models.copilotAgentRuntime.get(workspace.id, run.id);
  t.truthy(failed);
  t.is(failed?.status, 'failed');
  t.is(failed?.failureCode, 'synthetic_adapter_inner_failure');
  t.is(failed?.failureMessage, 'synthetic adapter already failed the run');
  t.is(failed?.workerLeaseId, null);
  t.deepEqual(
    failed?.steps.map(step => step.status),
    ['failed']
  );
});

test('standalone Agent Runtime worker skips adapter execution after its lease is recovered', async t => {
  const { agentRuntimeWorker, agentRuntimeWorkflowRegistry, app, db, owner } =
    t.context;
  let adapterExecutionCount = 0;
  agentRuntimeWorkflowRegistry.register({
    workflow: 'agent_runtime_stale_adapter_fence_e2e',
    capabilities: {
      version: 'agent-runtime-workflow-adapter-capabilities/v1',
      supportedStepTypes: ['model'],
      sideEffectMode: 'workspace_write',
      summary: 'E2E adapter that must not run after stale lease recovery',
    },
    execute: async ({ run, workerLeaseId }) => {
      adapterExecutionCount += 1;
      await app.models.copilotAgentRuntime.completeStandaloneWorkerExecution({
        workspaceId: run.workspaceId,
        id: run.id,
        workerLeaseId,
        workerAttempt: run.workerAttempt,
        adapterWorkflow: 'agent_runtime_stale_adapter_fence_e2e',
        sideEffectMode: 'workspace_write',
        summary: 'stale adapter fence should not complete',
        adapterResolution: {
          version: 'agent-runtime-worker-adapter-resolution/v1',
          status: 'completed',
          workflow: run.workflow,
          requestedStepTypes: ['model'],
          adapter: {
            workflow: 'agent_runtime_stale_adapter_fence_e2e',
            supportedStepTypes: ['model'],
            sideEffectMode: 'workspace_write',
          },
          registeredAdapters: [
            {
              workflow: 'agent_runtime_stale_adapter_fence_e2e',
              supportedStepTypes: ['model'],
              sideEffectMode: 'workspace_write',
            },
          ],
        },
      });
    },
  });

  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_stale_adapter_fence_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'stale-adapter-fence-runtime-run',
    status: 'queued',
    title: 'Stale adapter fence runtime run',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
      },
    ],
  });

  const runtimeModel = app.models.copilotAgentRuntime;
  const originalCancel =
    runtimeModel.cancelLeasedStandaloneRunIfCancellationRequested.bind(
      runtimeModel
    );
  let recoveredBeforeAdapter = false;
  const cancelStub = Sinon.stub(
    runtimeModel,
    'cancelLeasedStandaloneRunIfCancellationRequested'
  ).callsFake(async input => {
    const cancelled = await originalCancel(input);
    if (!cancelled && !recoveredBeforeAdapter) {
      recoveredBeforeAdapter = true;
      await db.$executeRaw`
        UPDATE ai_agent_runs
        SET worker_lease_expires_at = ${new Date(Date.now() - 60_000)}
        WHERE workspace_id = ${input.workspaceId}
          AND id = ${input.id}
          AND worker_lease_id = ${input.workerLeaseId}
      `;
      await runtimeModel.recoverExpiredStandaloneWorkerLease({
        workspaceId: input.workspaceId,
        id: input.id,
        reason: 'lease recovered before adapter execution',
      });
    }
    return cancelled;
  });

  try {
    const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
      workspaceId: workspace.id,
      runId: run.id,
    });
    t.is(signal, JOB_SIGNAL.Done);
  } finally {
    cancelStub.restore();
  }

  t.true(recoveredBeforeAdapter);
  t.is(adapterExecutionCount, 0);

  const rows = await db.$queryRaw<
    Array<{
      completedTimelineCount: number;
      executionResultCount: number;
      status: string;
      stepStatus: string;
      timelineStatuses: string[];
      workerAttempt: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.status,
      r.worker_attempt AS "workerAttempt",
      r.worker_lease_id AS "workerLeaseId",
      s.status AS "stepStatus",
      ARRAY_AGG(e.status ORDER BY e.ordinal ASC, e.id ASC) AS "timelineStatuses",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_runtime_execution_results er
        WHERE er.run_id = r.id
      ) AS "executionResultCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events completed
        WHERE completed.run_id = r.id
          AND completed.summary = ${'Agent runtime worker completed standalone run'}
      ) AS "completedTimelineCount"
    FROM ai_agent_runs r
    JOIN ai_agent_steps s ON s.run_id = r.id
    JOIN ai_agent_timeline_events e ON e.run_id = r.id
    WHERE r.id = ${run.id}
    GROUP BY r.id, s.id
  `;
  t.deepEqual(rows, [
    {
      completedTimelineCount: 0,
      executionResultCount: 1,
      status: 'failed',
      stepStatus: 'failed',
      timelineStatuses: [
        'queued',
        'pending',
        'running',
        'running',
        'failed',
        'failed',
      ],
      workerAttempt: 1,
      workerLeaseId: null,
    },
  ]);
});

test('standalone Agent Runtime resume keeps prior execution result attempt history', async t => {
  const { agentRuntimeWorker, agentRuntimeWorkflowRegistry, app, db, owner } =
    t.context;
  agentRuntimeWorkflowRegistry.register({
    workflow: 'agent_runtime_fail_then_resume_e2e',
    capabilities: {
      version: 'agent-runtime-workflow-adapter-capabilities/v1',
      supportedStepTypes: ['model'],
      sideEffectMode: 'none',
      summary: 'E2E adapter that fails before manual resume',
    },
    execute: async ({ run, workerLeaseId }) => {
      await app.models.copilotAgentRuntime.failStandaloneWorkerExecution({
        workspaceId: run.workspaceId,
        id: run.id,
        workerLeaseId,
        workerAttempt: run.workerAttempt,
        code: 'synthetic_resume_failure',
        message: 'synthetic failure before resume',
      });
    },
  });

  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_fail_then_resume_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'fail-then-resume-runtime-run',
    status: 'queued',
    title: 'Fail then resume runtime run',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
      },
    ],
  });

  await agentRuntimeWorker.runStandaloneAgentRuntime({
    workspaceId: workspace.id,
    runId: run.id,
  });
  const failed = await app.models.copilotAgentRuntime.get(workspace.id, run.id);
  t.like(failed, {
    status: 'failed',
    workerAttempt: 1,
    workerMaxAttempts: 1,
    executionResultCount: 1,
  });
  t.is(failed?.executionResults[0]?.workerAttempt, 1);

  const resumedResult = await app.gql({
    query: agentRuntimeControlMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        runId: run.id,
        action: 'resume',
        reason: 'operator retry after terminal worker failure',
      },
    },
  });
  const resumed = resumedResult.controlCopilotAgentRuntimeRun;
  t.like(resumed, {
    status: 'queued',
    workerAttempt: 1,
    workerMaxAttempts: 2,
    executionResultCount: 1,
  });
  t.is(resumed.executionResults[0].workerAttempt, 1);
  t.deepEqual(app.queue.last('copilot.agentRuntime.run').payload, {
    workspaceId: workspace.id,
    runId: run.id,
  });
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runs
      SET
        status = ${'running'},
        worker_lease_id = ${'manual-bypass-resume-worker'},
        worker_lease_expires_at = ${new Date('2026-06-23T04:00:00.000Z')},
        updated_at = ${new Date('2026-06-23T03:55:00.000Z')}
      WHERE id = ${run.id}
    `,
    {
      message: /ai_agent_runs_execution_result_terminal_snapshot_check/,
    }
  );

  const leased =
    await app.models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workspaceId: workspace.id,
      id: run.id,
      workerId: 'agent-runtime-resumed-worker-e2e',
      leaseMs: 60_000,
    });
  t.truthy(leased);
  t.is(leased?.workerAttempt, 2);
  t.is(leased?.executionResultCount, 1);
  t.is(leased?.executionResults[0]?.workerAttempt, 1);
});

test('standalone Agent Runtime worker fails registered adapters that return non-promises', async t => {
  const { agentRuntimeWorker, agentRuntimeWorkflowRegistry, app, owner } =
    t.context;
  agentRuntimeWorkflowRegistry.register({
    workflow: 'agent_runtime_sync_adapter_e2e',
    capabilities: {
      version: 'agent-runtime-workflow-adapter-capabilities/v1',
      supportedStepTypes: ['model'],
      sideEffectMode: 'none',
      summary: 'E2E adapter that returns a non-promise result',
    },
    execute: (() => undefined) as never,
  });

  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_sync_adapter_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'sync-adapter-runtime-run',
    status: 'queued',
    title: 'Sync adapter runtime run',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
      },
    ],
  });

  const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
    workspaceId: workspace.id,
    runId: run.id,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const failed = await app.models.copilotAgentRuntime.get(workspace.id, run.id);
  t.truthy(failed);
  t.is(failed?.status, 'failed');
  t.is(failed?.failureCode, 'agent_runtime_adapter_invalid_executor_result');
  t.true(
    failed?.failureMessage?.includes('returned a non-promise executor') ?? false
  );
  t.is(failed?.workerLeaseId, null);
  t.deepEqual(
    failed?.steps.map(step => step.status),
    ['failed']
  );
  const workerFailure = failed?.steps[0].outputSummary.workerFailure as {
    adapterResolution?: {
      adapter: {
        sideEffectMode: string;
        supportedStepTypes: string[];
        workflow: string;
      };
      requestedStepTypes: string[];
      status: string;
      version: string;
      workflow: string;
    };
    failureCode: string;
  };
  t.like(workerFailure, {
    failureCode: 'agent_runtime_adapter_invalid_executor_result',
  });
  t.like(workerFailure.adapterResolution, {
    version: 'agent-runtime-worker-adapter-resolution/v1',
    status: 'invalid_executor_result',
    workflow: 'agent_runtime_sync_adapter_e2e',
    requestedStepTypes: ['model'],
    adapter: {
      workflow: 'agent_runtime_sync_adapter_e2e',
      supportedStepTypes: ['model'],
      sideEffectMode: 'none',
    },
  });
});

test('standalone Agent Runtime worker fails runs when registered adapter returns without terminal state', async t => {
  const { agentRuntimeWorker, agentRuntimeWorkflowRegistry, app, owner } =
    t.context;
  agentRuntimeWorkflowRegistry.register({
    workflow: 'agent_runtime_incomplete_adapter_e2e',
    capabilities: {
      version: 'agent-runtime-workflow-adapter-capabilities/v1',
      supportedStepTypes: ['model'],
      sideEffectMode: 'none',
      summary: 'E2E adapter that returns without completing the leased run',
    },
    execute: async () => {},
  });

  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_incomplete_adapter_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'incomplete-adapter-runtime-run',
    status: 'queued',
    title: 'Incomplete adapter runtime run',
    steps: [
      {
        stepKey: 'record_model_context',
        stepType: 'model',
      },
    ],
  });

  const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
    workspaceId: workspace.id,
    runId: run.id,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const failed = await app.models.copilotAgentRuntime.get(workspace.id, run.id);
  t.truthy(failed);
  t.is(failed?.status, 'failed');
  t.is(failed?.failureCode, 'agent_runtime_adapter_incomplete_execution');
  t.true(
    failed?.failureMessage?.includes(
      'returned without completing, failing, cancelling, or releasing'
    ) ?? false
  );
  t.is(failed?.workerLeaseId, null);
  t.deepEqual(
    failed?.steps.map(step => step.status),
    ['failed']
  );
  const workerFailure = failed?.steps[0].outputSummary.workerFailure as {
    adapterResolution?: {
      adapter: {
        sideEffectMode: string;
        supportedStepTypes: string[];
        workflow: string;
      };
      registeredAdapters: Array<{ workflow: string }>;
      requestedStepTypes: string[];
      status: string;
      version: string;
      workflow: string;
    };
    failureCode: string;
  };
  t.like(workerFailure, {
    failureCode: 'agent_runtime_adapter_incomplete_execution',
  });
  t.like(workerFailure.adapterResolution, {
    version: 'agent-runtime-worker-adapter-resolution/v1',
    status: 'incomplete_execution',
    workflow: 'agent_runtime_incomplete_adapter_e2e',
    requestedStepTypes: ['model'],
    adapter: {
      workflow: 'agent_runtime_incomplete_adapter_e2e',
      supportedStepTypes: ['model'],
      sideEffectMode: 'none',
    },
  });
  t.true(
    workerFailure.adapterResolution?.registeredAdapters.some(
      adapter => adapter.workflow === 'agent_runtime_incomplete_adapter_e2e'
    ) ?? false
  );
});

test('standalone Agent Runtime worker skips repair execution linked runs', async t => {
  const { agentRuntimeWorker, app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair runtime worker isolation';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const repairRun =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord
      .agentRun;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId:
          requestResult.requestCopilotPromptRegistryRepairExecution
            .executionRecord.id,
        decision: 'approve',
      },
    },
  });

  const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
    workspaceId: workspace.id,
    runId: repairRun.id,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const unchanged = await app.models.copilotAgentRuntime.get(
    workspace.id,
    repairRun.id
  );
  t.is(unchanged?.sourceType, 'repair_execution_request');
  t.is(unchanged?.status, 'queued');
  t.is(unchanged?.failureCode, null);
  t.is(unchanged?.workerAttempt, 0);
  t.is(unchanged?.timelineEvents.length, 4);
});

test('scheduled Agent Runtime queued enqueue recovers missing standalone worker jobs', async t => {
  const { app, cronJobs, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_queued_enqueue_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'queued-agent-runtime-run',
    status: 'queued',
    title: 'Queued runtime run',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
      },
    ],
  });

  const signal = await cronJobs.enqueueQueuedAgentRuntimeRuns({
    limit: 10,
  });
  t.is(signal, JOB_SIGNAL.Done);

  t.deepEqual(app.queue.last('copilot.agentRuntime.run').payload, {
    workspaceId: workspace.id,
    runId: run.id,
  });

  const rows = await db.$queryRaw<
    Array<{
      status: string;
      workerAttempt: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      status,
      worker_attempt AS "workerAttempt",
      worker_lease_id AS "workerLeaseId"
    FROM ai_agent_runs
    WHERE id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      status: 'queued',
      workerAttempt: 0,
      workerLeaseId: null,
    },
  ]);
});

test('scheduled Agent Runtime stale lease recovery requeues expired standalone runs', async t => {
  const { app, cronJobs, db, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const run = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_stale_recovery_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'stale-agent-runtime-run',
    status: 'queued',
    title: 'Stale runtime run',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
      },
    ],
  });
  const leased = await models.copilotAgentRuntime.acquireStandaloneWorkerLease({
    workspaceId: workspace.id,
    id: run.id,
    workerId: 'stale-agent-runtime-worker-for-e2e',
    leaseMs: 60_000,
  });
  t.truthy(leased);
  t.is(leased?.status, 'running');
  t.is(leased?.workerAttempt, 1);

  await db.$executeRaw`
    UPDATE ai_agent_runs
    SET worker_max_attempts = ${2},
      worker_lease_expires_at = ${new Date(Date.now() - 60_000)}
    WHERE id = ${run.id}
  `;

  const signal = await cronJobs.recoverExpiredAgentRuntimeLeases({
    limit: 10,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const recovered = await models.copilotAgentRuntime.get(workspace.id, run.id);
  t.truthy(recovered);
  t.is(recovered?.status, 'queued');
  t.is(recovered?.workerAttempt, 1);
  t.is(recovered?.workerMaxAttempts, 2);
  t.is(recovered?.workerLeaseId, null);
  t.is(recovered?.workerLeaseExpiresAt, null);
  t.truthy(recovered?.queuedAt);
  t.deepEqual(
    recovered?.steps.map(step => step.status),
    ['pending']
  );
  const recoveredStaleLease = recovered?.steps[0].outputSummary
    .staleLeaseRecovery as {
    executor: string;
    nextStatus: string;
    previousWorkerLeaseExpiresAt: string;
    previousWorkerLeaseId: string;
    reason: string;
    retryScheduled: boolean;
    version: string;
    workerAttempt: number;
    workerMaxAttempts: number;
  };
  t.deepEqual(recoveredStaleLease, {
    version: 'agent-runtime-stale-lease-recovery/v1',
    executor: 'agent_runtime_stale_recovery_worker',
    reason: 'system recovered expired Agent Runtime worker lease',
    retryScheduled: true,
    nextStatus: 'queued',
    workerAttempt: 1,
    workerMaxAttempts: 2,
    previousWorkerLeaseId: 'stale-agent-runtime-worker-for-e2e',
    previousWorkerLeaseExpiresAt:
      recoveredStaleLease.previousWorkerLeaseExpiresAt,
  });
  t.truthy(recoveredStaleLease.previousWorkerLeaseExpiresAt);
  const recoveredRunEvent = recovered?.timelineEvents.find(
    event =>
      event.eventType === 'run_status' &&
      event.status === 'queued' &&
      event.summary === 'Agent runtime stale worker lease recovered'
  );
  t.truthy(recoveredRunEvent);
  t.deepEqual(recoveredRunEvent?.payload, {
    version: 'agent-runtime-stale-lease-recovery/v1',
    executor: 'agent_runtime_stale_recovery_worker',
    previousStatus: 'running',
    previousWorkerLeaseId: 'stale-agent-runtime-worker-for-e2e',
    previousWorkerLeaseExpiresAt:
      recoveredStaleLease.previousWorkerLeaseExpiresAt,
    reason: 'system recovered expired Agent Runtime worker lease',
    retryScheduled: true,
    nextStatus: 'queued',
    workerAttempt: 1,
    workerMaxAttempts: 2,
    workflow: 'agent_runtime_stale_recovery_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'stale-agent-runtime-run',
  });
  const recoveredStepEvent = recovered?.timelineEvents.find(
    event =>
      event.eventType === 'tool_step' &&
      event.status === 'pending' &&
      event.stepId === recovered.steps[0].id &&
      event.summary === 'Agent runtime tool step reset after stale lease'
  );
  t.deepEqual(recoveredStepEvent?.payload, {
    version: 'agent-runtime-stale-lease-recovery/v1',
    executor: 'agent_runtime_stale_recovery_worker',
    previousStatus: 'running',
    previousWorkerLeaseId: 'stale-agent-runtime-worker-for-e2e',
    previousWorkerLeaseExpiresAt:
      recoveredStaleLease.previousWorkerLeaseExpiresAt,
    reason: 'system recovered expired Agent Runtime worker lease',
    retryScheduled: true,
    nextStatus: 'pending',
    workerAttempt: 1,
    workerMaxAttempts: 2,
    workflow: 'agent_runtime_stale_recovery_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'stale-agent-runtime-run',
  });
  t.deepEqual(app.queue.last('copilot.agentRuntime.run').payload, {
    workspaceId: workspace.id,
    runId: run.id,
  });
  t.is(recovered?.executionResultCount, 0);
  t.deepEqual(recovered?.executionResults, []);
});

test('standalone Agent Runtime stale lease recovery fails closed when hydrated run snapshot changes before update', async t => {
  const { app, db, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const run = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_stale_recovery_run_drift_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'stale-recovery-run-drift-runtime-run',
    status: 'queued',
    title: 'Stale recovery run drift runtime run',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
      },
    ],
  });
  const leased = await models.copilotAgentRuntime.acquireStandaloneWorkerLease({
    workspaceId: workspace.id,
    id: run.id,
    workerId: 'agent-runtime-stale-recovery-run-drift-worker-e2e',
    leaseMs: 60_000,
  });
  t.truthy(leased);
  await db.$executeRaw`
    UPDATE ai_agent_runs
    SET
      worker_max_attempts = ${2},
      worker_lease_expires_at = ${new Date(Date.now() - 60_000)}
    WHERE id = ${run.id}
  `;
  const current = await models.copilotAgentRuntime.get(workspace.id, run.id);
  t.truthy(current);
  t.is(current?.status, 'running');

  const runtime = models.copilotAgentRuntime;
  const originalGet = runtime.get.bind(runtime);
  let returnedStaleRecord = false;
  const getStub = Sinon.stub(runtime, 'get').callsFake(
    async (workspaceId: string, id: string) => {
      if (
        !returnedStaleRecord &&
        workspaceId === workspace.id &&
        id === run.id
      ) {
        returnedStaleRecord = true;
        return {
          ...current!,
          updatedAt: new Date(current!.updatedAt.getTime() - 1000),
        };
      }
      return await originalGet(workspaceId, id);
    }
  );
  try {
    await t.throwsAsync(
      runtime.recoverExpiredStandaloneWorkerLease({
        workspaceId: workspace.id,
        id: run.id,
      }),
      {
        message:
          /stale lease could not be recovered because its run state changed/,
      }
    );
  } finally {
    getStub.restore();
  }

  const rows = await db.$queryRaw<
    Array<{
      recoverySummaryCount: number;
      recoveryTimelineCount: number;
      runStatus: string;
      stepStatus: string;
      workerAttempt: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.status AS "runStatus",
      r.worker_attempt AS "workerAttempt",
      r.worker_lease_id AS "workerLeaseId",
      s.status AS "stepStatus",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps step
        WHERE step.run_id = r.id
          AND step.output_summary -> ${'staleLeaseRecovery'} IS NOT NULL
      ) AS "recoverySummaryCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.payload ->> ${'version'} =
            ${'agent-runtime-stale-lease-recovery/v1'}
      ) AS "recoveryTimelineCount"
    FROM ai_agent_runs r
    JOIN ai_agent_steps s ON s.run_id = r.id
    WHERE r.id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      recoverySummaryCount: 0,
      recoveryTimelineCount: 0,
      runStatus: 'running',
      stepStatus: 'running',
      workerAttempt: 1,
      workerLeaseId: 'agent-runtime-stale-recovery-run-drift-worker-e2e',
    },
  ]);
});

test('standalone Agent Runtime stale lease recovery fails closed when hydrated step snapshot changes before update', async t => {
  const { app, db, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const run = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_stale_recovery_step_drift_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'stale-recovery-step-drift-runtime-run',
    status: 'queued',
    title: 'Stale recovery step drift runtime run',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
      },
      {
        stepKey: 'model_context',
        stepType: 'model',
      },
    ],
  });
  const leased = await models.copilotAgentRuntime.acquireStandaloneWorkerLease({
    workspaceId: workspace.id,
    id: run.id,
    workerId: 'agent-runtime-stale-recovery-step-drift-worker-e2e',
    leaseMs: 60_000,
  });
  t.truthy(leased);
  await db.$executeRaw`
    UPDATE ai_agent_runs
    SET
      worker_max_attempts = ${2},
      worker_lease_expires_at = ${new Date(Date.now() - 60_000)}
    WHERE id = ${run.id}
  `;

  const runtime = models.copilotAgentRuntime;
  const originalGet = runtime.get.bind(runtime);
  let returnedStaleRecord = false;
  const getStub = Sinon.stub(runtime, 'get').callsFake(
    async (workspaceId: string, id: string) => {
      const current = await originalGet(workspaceId, id);
      if (
        !returnedStaleRecord &&
        current &&
        workspaceId === workspace.id &&
        id === run.id
      ) {
        returnedStaleRecord = true;
        return {
          ...current,
          steps: current.steps.map((step, index) =>
            index === 0
              ? {
                  ...step,
                  updatedAt: new Date(step.updatedAt.getTime() - 1000),
                }
              : step
          ),
        };
      }
      return current;
    }
  );
  try {
    await t.throwsAsync(
      runtime.recoverExpiredStandaloneWorkerLease({
        workspaceId: workspace.id,
        id: run.id,
      }),
      {
        message:
          /stale lease could not be recovered because its step state changed/,
      }
    );
  } finally {
    getStub.restore();
  }

  const rows = await db.$queryRaw<
    Array<{
      recoverySummaryCount: number;
      recoveryTimelineCount: number;
      runStatus: string;
      stepStatuses: string[];
      workerAttempt: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.status AS "runStatus",
      r.worker_attempt AS "workerAttempt",
      r.worker_lease_id AS "workerLeaseId",
      ARRAY_AGG(s.status ORDER BY s."order") AS "stepStatuses",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps step
        WHERE step.run_id = r.id
          AND step.output_summary -> ${'staleLeaseRecovery'} IS NOT NULL
      ) AS "recoverySummaryCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.payload ->> ${'version'} =
            ${'agent-runtime-stale-lease-recovery/v1'}
      ) AS "recoveryTimelineCount"
    FROM ai_agent_runs r
    JOIN ai_agent_steps s ON s.run_id = r.id
    WHERE r.id = ${run.id}
    GROUP BY r.id
  `;
  t.deepEqual(rows, [
    {
      recoverySummaryCount: 0,
      recoveryTimelineCount: 0,
      runStatus: 'running',
      stepStatuses: ['running', 'running'],
      workerAttempt: 1,
      workerLeaseId: 'agent-runtime-stale-recovery-step-drift-worker-e2e',
    },
  ]);
});

test('scheduled Agent Runtime stale lease recovery fails expired standalone runs with no attempts remaining', async t => {
  const { app, cronJobs, db, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const run = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_stale_failure_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'terminal-stale-agent-runtime-run',
    status: 'queued',
    title: 'Terminal stale runtime run',
    steps: [
      {
        stepKey: 'codex_patch',
        stepType: 'codex',
      },
    ],
  });
  const leased = await models.copilotAgentRuntime.acquireStandaloneWorkerLease({
    workspaceId: workspace.id,
    id: run.id,
    workerId: 'terminal-stale-agent-runtime-worker-for-e2e',
    leaseMs: 60_000,
  });
  t.truthy(leased);
  t.is(leased?.workerAttempt, 1);

  await db.$executeRaw`
    UPDATE ai_agent_runs
    SET worker_lease_expires_at = ${new Date(Date.now() - 60_000)}
    WHERE id = ${run.id}
  `;

  const signal = await cronJobs.recoverExpiredAgentRuntimeLeases({
    limit: 10,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const failed = await models.copilotAgentRuntime.get(workspace.id, run.id);
  t.truthy(failed);
  t.is(failed?.status, 'failed');
  t.is(failed?.failureCode, 'stale_worker_lease');
  t.regex(failed?.failureMessage ?? '', /Expired standalone Agent Runtime/);
  t.is(failed?.workerLeaseId, null);
  t.truthy(failed?.completedAt);
  t.deepEqual(
    failed?.steps.map(step => step.status),
    ['failed']
  );
  const failedStaleLease = failed?.steps[0].outputSummary
    .staleLeaseRecovery as {
    executor: string;
    nextStatus: string;
    previousWorkerLeaseExpiresAt: string;
    previousWorkerLeaseId: string;
    reason: string;
    retryScheduled: boolean;
    version: string;
    workerAttempt: number;
    workerMaxAttempts: number;
  };
  t.deepEqual(failedStaleLease, {
    version: 'agent-runtime-stale-lease-recovery/v1',
    executor: 'agent_runtime_stale_recovery_worker',
    reason: 'system recovered expired Agent Runtime worker lease',
    retryScheduled: false,
    nextStatus: 'failed',
    workerAttempt: 1,
    workerMaxAttempts: 1,
    previousWorkerLeaseId: 'terminal-stale-agent-runtime-worker-for-e2e',
    previousWorkerLeaseExpiresAt: failedStaleLease.previousWorkerLeaseExpiresAt,
  });
  t.truthy(failedStaleLease.previousWorkerLeaseExpiresAt);
  const failedRunEvent = failed?.timelineEvents.find(
    event =>
      event.eventType === 'run_status' &&
      event.status === 'failed' &&
      event.summary === 'Agent runtime stale worker lease failed run'
  );
  t.truthy(failedRunEvent);
  t.deepEqual(failedRunEvent?.payload, {
    version: 'agent-runtime-stale-lease-recovery/v1',
    executor: 'agent_runtime_stale_recovery_worker',
    previousStatus: 'running',
    previousWorkerLeaseId: 'terminal-stale-agent-runtime-worker-for-e2e',
    previousWorkerLeaseExpiresAt: failedStaleLease.previousWorkerLeaseExpiresAt,
    reason: 'system recovered expired Agent Runtime worker lease',
    retryScheduled: false,
    nextStatus: 'failed',
    workerAttempt: 1,
    workerMaxAttempts: 1,
    workflow: 'agent_runtime_stale_failure_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'terminal-stale-agent-runtime-run',
  });
  const failedStepEvent = failed?.timelineEvents.find(
    event =>
      event.eventType === 'codex_step' &&
      event.status === 'failed' &&
      event.stepId === failed.steps[0].id
  );
  t.deepEqual(failedStepEvent?.payload, {
    version: 'agent-runtime-stale-lease-recovery/v1',
    executor: 'agent_runtime_stale_recovery_worker',
    previousStatus: 'running',
    previousWorkerLeaseId: 'terminal-stale-agent-runtime-worker-for-e2e',
    previousWorkerLeaseExpiresAt: failedStaleLease.previousWorkerLeaseExpiresAt,
    reason: 'system recovered expired Agent Runtime worker lease',
    retryScheduled: false,
    nextStatus: 'failed',
    workerAttempt: 1,
    workerMaxAttempts: 1,
    workflow: 'agent_runtime_stale_failure_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'terminal-stale-agent-runtime-run',
  });
  t.is(failed?.executionResultCount, 1);
  t.is(failed?.executionResults.length, 1);
  t.like(failed?.executionResults[0], {
    adapterWorkflow: 'agent_runtime_stale_failure_e2e',
    executor: 'agent_runtime_stale_recovery_worker',
    failureCode: 'stale_worker_lease',
    resultStatus: 'failed',
    runId: run.id,
    sideEffectMode: 'none',
    sideEffectsApplied: false,
    workerAttempt: 1,
    workerLeaseId: 'terminal-stale-agent-runtime-worker-for-e2e',
  });
  t.regex(
    failed?.executionResults[0]?.failureMessage ?? '',
    /Expired standalone Agent Runtime/
  );
  t.like(failed?.executionResults[0]?.resultPayload, {
    version: 'agent-runtime-worker-execution-result/v1',
    resultStatus: 'failed',
    executor: 'agent_runtime_stale_recovery_worker',
    failureCode: 'stale_worker_lease',
    sideEffectsApplied: false,
  });
  const resultRows = await db.$queryRaw<
    Array<{
      adapterWorkflow: string;
      executor: string;
      failureCode: string | null;
      failureMessage: string | null;
      resultPayload: {
        executor?: string;
        failureCode?: string;
        resultStatus?: string;
        sideEffectsApplied?: boolean;
        version?: string;
      };
      resultStatus: string;
      sideEffectMode: string;
      sideEffectsApplied: boolean;
      workerAttempt: number;
      workerLeaseId: string;
    }>
  >`
    SELECT
      adapter_workflow AS "adapterWorkflow",
      executor,
      failure_code AS "failureCode",
      failure_message AS "failureMessage",
      result_payload AS "resultPayload",
      result_status AS "resultStatus",
      side_effect_mode AS "sideEffectMode",
      side_effects_applied AS "sideEffectsApplied",
      worker_attempt AS "workerAttempt",
      worker_lease_id AS "workerLeaseId"
    FROM ai_agent_runtime_execution_results
    WHERE run_id = ${run.id}
  `;
  t.is(resultRows.length, 1);
  t.like(resultRows[0], {
    adapterWorkflow: 'agent_runtime_stale_failure_e2e',
    executor: 'agent_runtime_stale_recovery_worker',
    failureCode: 'stale_worker_lease',
    resultStatus: 'failed',
    sideEffectMode: 'none',
    sideEffectsApplied: false,
    workerAttempt: 1,
    workerLeaseId: 'terminal-stale-agent-runtime-worker-for-e2e',
  });
  t.regex(
    resultRows[0]?.failureMessage ?? '',
    /Expired standalone Agent Runtime/
  );
  t.like(resultRows[0]?.resultPayload, {
    version: 'agent-runtime-worker-execution-result/v1',
    resultStatus: 'failed',
    executor: 'agent_runtime_stale_recovery_worker',
    failureCode: 'stale_worker_lease',
    sideEffectsApplied: false,
  });
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runtime_execution_results
      SET
        side_effect_mode = ${'external_tool'},
        result_payload = jsonb_set(
          result_payload,
          ${'{sideEffectMode}'}::text[],
          ${'"external_tool"'}::jsonb
        )
      WHERE run_id = ${run.id}
    `,
    {
      message: /ai_agent_runtime_execution_results_status_payload_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_runtime_execution_results
      SET
        worker_lease_id = ${'drifted-terminal-stale-worker-lease'},
        result_payload = jsonb_set(
          result_payload,
          ${'{workerLeaseId}'}::text[],
          ${JSON.stringify('drifted-terminal-stale-worker-lease')}::jsonb
        )
      WHERE run_id = ${run.id}
    `,
    {
      message:
        /ai_agent_runtime_execution_results_content_update_restrict_check/,
    }
  );
});

test('controls standalone Agent Runtime runs without mutating repair execution runs', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair runtime control guard';
  await seedRegistryPrompt(db, promptName);
  const standalone = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_control_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'control-runtime-run',
    status: 'running',
    title: 'Controllable runtime run',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
        status: 'running',
        outputSummary: {
          toolName: 'workspace-search',
        },
      },
      {
        stepKey: 'mcp_fetch',
        stepType: 'mcp',
        status: 'pending',
      },
    ],
  });

  const cancelledResult = await app.gql({
    query: agentRuntimeControlMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        runId: standalone.id,
        action: 'cancel',
        reason: '  operator cancelled standalone run  ',
      },
    },
  });
  const cancelled = cancelledResult.controlCopilotAgentRuntimeRun;
  t.is(cancelled.status, 'cancelled');
  t.truthy(cancelled.completedAt);
  t.deepEqual(
    cancelled.steps.map((step: { status: string }) => step.status),
    ['skipped', 'skipped']
  );
  t.deepEqual(cancelled.steps[0].outputSummary.manualControl, {
    version: 'agent-runtime-manual-control/v1',
    action: 'cancel',
    actorId: owner.id,
    reason: 'operator cancelled standalone run',
  });
  const cancelledRunEvent = cancelled.timelineEvents.find(
    (event: { eventType: string; status: string; summary: string }) =>
      event.eventType === 'run_cancellation' &&
      event.status === 'cancelled' &&
      event.summary === 'Agent runtime run manually cancelled'
  );
  t.deepEqual(cancelledRunEvent, {
    eventType: 'run_cancellation',
    ordinal: 3,
    payload: {
      version: 'agent-runtime-manual-control/v1',
      action: 'cancel',
      actorId: owner.id,
      controlledAt: cancelledRunEvent?.payload.controlledAt,
      previousStatus: 'running',
      reason: 'operator cancelled standalone run',
      sourceId: 'control-runtime-run',
      sourceType: 'agent_runtime_test',
      workflow: 'agent_runtime_control_e2e',
    },
    status: 'cancelled',
    stepId: null,
    summary: 'Agent runtime run manually cancelled',
  });
  const cancelledStepEvent = cancelled.timelineEvents.find(
    (event: { eventType: string; status: string; stepId: string }) =>
      event.eventType === 'tool_step' &&
      event.status === 'skipped' &&
      event.stepId === cancelled.steps[0].id
  );
  t.deepEqual(cancelledStepEvent?.payload, {
    version: 'agent-runtime-manual-control/v1',
    action: 'cancel',
    actorId: owner.id,
    controlledAt: cancelledStepEvent?.payload.controlledAt,
    previousStatus: 'running',
    reason: 'operator cancelled standalone run',
    sourceId: 'control-runtime-run',
    sourceType: 'agent_runtime_test',
    workflow: 'agent_runtime_control_e2e',
  });

  await t.throwsAsync(
    app.gql({
      query: agentRuntimeControlMutation,
      variables: {
        input: {
          workspaceId: workspace.id,
          runId: standalone.id,
          action: 'resume',
          reason: 'x'.repeat(1025),
        },
      },
    }),
    { message: /Agent runtime control reason is too long/ }
  );
  const stillCancelled = await app.models.copilotAgentRuntime.get(
    workspace.id,
    standalone.id
  );
  t.is(stillCancelled?.status, 'cancelled');

  const resumedResult = await app.gql({
    query: agentRuntimeControlMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        runId: standalone.id,
        action: 'resume',
        reason: 'operator resumed standalone run',
      },
    },
  });
  const resumed = resumedResult.controlCopilotAgentRuntimeRun;
  t.is(resumed.status, 'queued');
  t.is(resumed.completedAt, null);
  t.truthy(resumed.queuedAt);
  t.is(resumed.workerAttempt, 0);
  t.is(resumed.workerMaxAttempts, 1);
  t.deepEqual(app.queue.last('copilot.agentRuntime.run').payload, {
    workspaceId: workspace.id,
    runId: standalone.id,
  });
  t.deepEqual(
    resumed.steps.map((step: { status: string }) => step.status),
    ['pending', 'pending']
  );
  t.deepEqual(resumed.steps[0].outputSummary.manualControl, {
    version: 'agent-runtime-manual-control/v1',
    action: 'resume',
    actorId: owner.id,
    reason: 'operator resumed standalone run',
  });
  const resumedRunEvent = resumed.timelineEvents.find(
    (event: { eventType: string; status: string; summary: string }) =>
      event.eventType === 'run_status' &&
      event.status === 'queued' &&
      event.summary === 'Agent runtime run manually resumed'
  );
  t.deepEqual(resumedRunEvent, {
    eventType: 'run_status',
    ordinal: 6,
    payload: {
      version: 'agent-runtime-manual-control/v1',
      action: 'resume',
      actorId: owner.id,
      controlledAt: resumedRunEvent?.payload.controlledAt,
      previousStatus: 'cancelled',
      reason: 'operator resumed standalone run',
      sourceId: 'control-runtime-run',
      sourceType: 'agent_runtime_test',
      workflow: 'agent_runtime_control_e2e',
    },
    status: 'queued',
    stepId: null,
    summary: 'Agent runtime run manually resumed',
  });
  const resumedStepEvent = resumed.timelineEvents.find(
    (event: { eventType: string; status: string; stepId: string }) =>
      event.eventType === 'tool_step' &&
      event.status === 'pending' &&
      event.stepId === resumed.steps[0].id
  );
  t.deepEqual(resumedStepEvent?.payload, {
    version: 'agent-runtime-manual-control/v1',
    action: 'resume',
    actorId: owner.id,
    controlledAt: resumedStepEvent?.payload.controlledAt,
    previousStatus: 'skipped',
    reason: 'operator resumed standalone run',
    sourceId: 'control-runtime-run',
    sourceType: 'agent_runtime_test',
    workflow: 'agent_runtime_control_e2e',
  });

  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const repairRun =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord
      .agentRun;
  await t.throwsAsync(
    app.gql({
      query: agentRuntimeControlMutation,
      variables: {
        input: {
          workspaceId: workspace.id,
          runId: repairRun.id,
          action: 'cancel',
        },
      },
    })
  );

  const repairRunRows = await db.$queryRaw<
    Array<{ status: string; timelineCount: number }>
  >`
    SELECT
      r.status,
      COUNT(e.id)::int AS "timelineCount"
    FROM ai_agent_runs r
    JOIN ai_agent_timeline_events e ON e.run_id = r.id
    WHERE r.id = ${repairRun.id}
    GROUP BY r.status
  `;
  t.deepEqual(repairRunRows, [
    {
      status: 'waiting_approval',
      timelineCount: 2,
    },
  ]);

  const outsider = await app.createUser();
  await app.login(outsider);
  await app.switchUser(outsider);
  await t.throwsAsync(
    app.gql({
      query: agentRuntimeControlMutation,
      variables: {
        input: {
          workspaceId: workspace.id,
          runId: standalone.id,
          action: 'cancel',
        },
      },
    })
  );
  await app.login(owner);
  await app.switchUser(owner);
});

test('standalone Agent Runtime cancel fails closed when run state changes before update', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_stale_cancel_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'stale-cancel-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
      },
    ],
  });

  const lease =
    await app.models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workspaceId: workspace.id,
      id: run.id,
      workerId: 'agent-runtime-stale-cancel-worker-e2e',
      leaseMs: 60_000,
    });
  t.truthy(lease);
  const staleExisting = await app.models.copilotAgentRuntime.get(
    workspace.id,
    run.id
  );
  t.truthy(staleExisting);
  await app.models.copilotAgentRuntime.failStandaloneWorkerExecution({
    workspaceId: workspace.id,
    id: run.id,
    workerLeaseId: 'agent-runtime-stale-cancel-worker-e2e',
    workerAttempt: staleExisting!.workerAttempt,
    code: 'agent_runtime_stale_cancel_fixture_failure',
    message: 'failed before stale cancellation persistence',
  });

  const model = app.models.copilotAgentRuntime;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.controlRun({
        workspaceId: workspace.id,
        actorId: owner.id,
        id: run.id,
        action: 'cancel',
        reason: 'stale cancel should not persist',
      }),
      {
        message:
          /could not (?:request cancellation|be cancelled) because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      status: string;
      manualStepCount: number;
      cancellationTimelineCount: number;
    }>
  >`
    SELECT
      r.status,
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps s
        WHERE s.run_id = r.id
          AND s.output_summary -> ${'manualControl'} IS NOT NULL
      ) AS "manualStepCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.event_type = ${'run_cancellation'}
      ) AS "cancellationTimelineCount"
    FROM ai_agent_runs r
    WHERE r.id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      status: 'failed',
      manualStepCount: 0,
      cancellationTimelineCount: 0,
    },
  ]);
});

test('standalone Agent Runtime cancel fails closed when run snapshot evidence changes before update', async t => {
  const { app, db, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const run = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_stale_cancel_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'stale-cancel-run-snapshot-runtime-run',
    status: 'running',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
        status: 'running',
      },
    ],
  });

  const staleExisting = await models.copilotAgentRuntime.get(
    workspace.id,
    run.id
  );
  t.truthy(staleExisting);
  const driftedAt = new Date(staleExisting!.updatedAt.getTime() + 60_000);
  const driftedRows = await db.$executeRaw`
    UPDATE ai_agent_runs
    SET updated_at = ${driftedAt}
    WHERE id = ${run.id}
      AND status = ${'running'}
  `;
  t.is(driftedRows, 1);

  const model = models.copilotAgentRuntime;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.controlRun({
        workspaceId: workspace.id,
        actorId: owner.id,
        id: run.id,
        action: 'cancel',
        reason: 'stale cancel snapshot should not persist',
      }),
      {
        message: /could not be cancelled because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      cancellationTimelineCount: number;
      manualStepCount: number;
      status: string;
      updatedAt: Date;
    }>
  >`
    SELECT
      r.status,
      r.updated_at AS "updatedAt",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps s
        WHERE s.run_id = r.id
          AND s.output_summary -> ${'manualControl'} IS NOT NULL
      ) AS "manualStepCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.event_type = ${'run_cancellation'}
      ) AS "cancellationTimelineCount"
    FROM ai_agent_runs r
    WHERE r.id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      cancellationTimelineCount: 0,
      manualStepCount: 0,
      status: 'running',
      updatedAt: driftedAt,
    },
  ]);
});

test('standalone Agent Runtime cancel fails closed when step state changes before update', async t => {
  const { app, db, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const run = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_stale_cancel_step_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'stale-cancel-step-runtime-run',
    status: 'running',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
        status: 'running',
      },
    ],
  });

  const staleExisting = await models.copilotAgentRuntime.get(
    workspace.id,
    run.id
  );
  t.truthy(staleExisting);
  const driftedAt = new Date(run.updatedAt.getTime() + 30_000);
  await db.$transaction(async tx => {
    await tx.$executeRaw`
      UPDATE ai_agent_steps
      SET
        status = ${'completed'},
        completed_at = ${driftedAt},
        output_summary = output_summary || ${JSON.stringify({
          stepDriftBeforeManualCancel: true,
        })}::jsonb,
        updated_at = ${driftedAt}
      WHERE id = ${run.steps[0].id}
    `;
    await tx.$executeRaw`
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
      VALUES (
        ${'agent-runtime-stale-cancel-step-drift-event'},
        ${run.id},
        ${run.steps[0].id},
        ${workspace.id},
        ${owner.id},
        ${'tool_step'},
        ${'completed'},
        ${100},
        ${'Agent runtime step drift before manual cancel'},
        ${JSON.stringify({
          version: 'agent-runtime-test-step-drift/v1',
          stepKey: 'tool_lookup',
          stepType: 'tool',
        })}::jsonb,
        ${'agent-runtime-stale-cancel-step-drift-fp'},
        ${driftedAt}
      )
    `;
  });

  const model = models.copilotAgentRuntime;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.controlRun({
        workspaceId: workspace.id,
        actorId: owner.id,
        id: run.id,
        action: 'cancel',
        reason: 'stale cancel step should not persist',
      }),
      {
        message: /step could not be cancelled because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      cancellationTimelineCount: number;
      manualStepCount: number;
      runStatus: string;
      stepStatus: string;
    }>
  >`
    SELECT
      r.status AS "runStatus",
      s.status AS "stepStatus",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps step
        WHERE step.run_id = r.id
          AND step.output_summary -> ${'manualControl'} IS NOT NULL
      ) AS "manualStepCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.summary = ${'Agent runtime run manually cancelled'}
      ) AS "cancellationTimelineCount"
    FROM ai_agent_runs r
    JOIN ai_agent_steps s ON s.run_id = r.id
    WHERE r.id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      cancellationTimelineCount: 0,
      manualStepCount: 0,
      runStatus: 'running',
      stepStatus: 'completed',
    },
  ]);
});

test('standalone Agent Runtime running cancel is cooperative before adapter execution', async t => {
  const { app, db, owner, agentRuntimeWorker } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const run = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_local_completion',
    sourceType: 'agent_runtime_test',
    sourceId: 'cooperative-cancel-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
        status: 'pending',
      },
    ],
  });

  type RequestedRun = {
    completedAt: string | null;
    timelineEvents: Array<{
      eventType: string;
      payload: Record<string, unknown>;
      status: string;
      summary: string;
    }>;
    status: string;
    workerLeaseId: string | null;
  };
  let requested: RequestedRun | null = null;
  const getRequested = (): RequestedRun | null => requested;
  const runtimeModel = models.copilotAgentRuntime;
  const originalAcquire =
    runtimeModel.acquireStandaloneWorkerLease.bind(runtimeModel);
  const acquireStub = Sinon.stub(
    runtimeModel,
    'acquireStandaloneWorkerLease'
  ).callsFake(async input => {
    const leased = await originalAcquire(input);
    if (leased?.id === run.id && !requested) {
      const controlResult = await app.gql({
        query: agentRuntimeControlMutation,
        variables: {
          input: {
            workspaceId: workspace.id,
            runId: run.id,
            action: 'cancel',
            reason: '  stop runtime before adapter  ',
          },
        },
      });
      requested = controlResult.controlCopilotAgentRuntimeRun;
    }
    return leased;
  });
  try {
    const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
      workspaceId: workspace.id,
      runId: run.id,
    });
    t.is(signal, JOB_SIGNAL.Done);
  } finally {
    acquireStub.restore();
  }

  const requestedSnapshot = getRequested();
  t.truthy(requestedSnapshot);
  if (!requestedSnapshot) {
    throw new Error('Expected cooperative cancellation request snapshot');
  }
  t.is(requestedSnapshot.status, 'running');
  t.truthy(requestedSnapshot.workerLeaseId);
  t.is(requestedSnapshot.completedAt, null);
  t.deepEqual(
    requestedSnapshot.timelineEvents
      .slice(-1)
      .map(event => [
        event.eventType,
        event.status,
        event.summary,
        event.payload.action,
        event.payload.workerAttempt,
      ]),
    [
      [
        'run_cancellation',
        'running',
        'Agent runtime run cancellation requested',
        'cancel_requested',
        1,
      ],
    ]
  );

  const rows = await db.$queryRaw<
    Array<{
      completedAt: Date | null;
      executionResultCount: number;
      status: string;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.completed_at AS "completedAt",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_runtime_execution_results result
        WHERE result.run_id = r.id
      ) AS "executionResultCount",
      r.status,
      r.worker_lease_id AS "workerLeaseId"
    FROM ai_agent_runs r
    WHERE r.id = ${run.id}
  `;
  t.like(rows[0], {
    executionResultCount: 0,
    status: 'cancelled',
    workerLeaseId: null,
  });
  t.truthy(rows[0]?.completedAt);

  const completed = await models.copilotAgentRuntime.get(workspace.id, run.id);
  t.is(completed?.status, 'cancelled');
  t.is(completed?.steps[0]?.status, 'skipped');
  t.deepEqual(completed?.steps[0]?.outputSummary.manualControl, {
    version: 'agent-runtime-manual-control/v1',
    action: 'cancel',
    actorId: owner.id,
    reason: 'stop runtime before adapter',
  });
  t.deepEqual(
    completed?.timelineEvents
      .slice(-3)
      .map(event => [event.eventType, event.status, event.summary]),
    [
      [
        'run_cancellation',
        'running',
        'Agent runtime run cancellation requested',
      ],
      ['run_cancellation', 'cancelled', 'Agent runtime run manually cancelled'],
      ['tool_step', 'skipped', 'Agent runtime tool step manually cancelled'],
    ]
  );
});

test('standalone Agent Runtime running cancellation request fails closed when run snapshot changes before update', async t => {
  const { app, db, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const created = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_local_completion',
    sourceType: 'agent_runtime_test',
    sourceId: 'stale-cooperative-cancel-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
        status: 'pending',
      },
    ],
  });
  const leased = await models.copilotAgentRuntime.acquireStandaloneWorkerLease({
    workspaceId: workspace.id,
    id: created.id,
    workerId: 'agent-runtime-stale-cooperative-cancel-worker',
    leaseMs: 60_000,
  });
  t.truthy(leased);
  const staleExisting = await models.copilotAgentRuntime.get(
    workspace.id,
    created.id
  );
  t.truthy(staleExisting);
  const driftedAt = new Date(staleExisting!.updatedAt.getTime() + 60_000);
  const driftedRows = await db.$executeRaw`
    UPDATE ai_agent_runs
    SET updated_at = ${driftedAt}
    WHERE id = ${created.id}
      AND status = ${'running'}
      AND worker_lease_id = ${leased?.workerLeaseId}
      AND worker_attempt = ${leased?.workerAttempt}
  `;
  t.is(driftedRows, 1);

  const model = models.copilotAgentRuntime;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.controlRun({
        workspaceId: workspace.id,
        actorId: owner.id,
        id: created.id,
        action: 'cancel',
        reason: 'stale cooperative cancel should not persist',
      }),
      {
        message: /could not request cancellation because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      cancellationRequestCount: number;
      status: string;
      updatedAt: Date;
      workerAttempt: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.status,
      r.updated_at AS "updatedAt",
      r.worker_attempt AS "workerAttempt",
      r.worker_lease_id AS "workerLeaseId",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.event_type = ${'run_cancellation'}
          AND e.payload->>${'action'} = ${'cancel_requested'}
      ) AS "cancellationRequestCount"
    FROM ai_agent_runs r
    WHERE r.id = ${created.id}
  `;
  t.deepEqual(rows, [
    {
      cancellationRequestCount: 0,
      status: 'running',
      updatedAt: driftedAt,
      workerAttempt: leased!.workerAttempt,
      workerLeaseId: leased!.workerLeaseId,
    },
  ]);
});

test('standalone Agent Runtime worker consumes cancellation requested during adapter execution', async t => {
  const { agentRuntimeWorker, agentRuntimeWorkflowRegistry, app, db, owner } =
    t.context;
  const models = app.get(Models);
  let adapterWorkerLeaseId: string | null = null;
  type RequestedDuringAdapter = {
    completedAt: string | null;
    status: string;
    workerLeaseId: string | null;
  };
  let requestedDuringAdapter: RequestedDuringAdapter | null = null;
  const getRequestedDuringAdapter = (): RequestedDuringAdapter | null =>
    requestedDuringAdapter;
  agentRuntimeWorkflowRegistry.register({
    workflow: 'agent_runtime_post_adapter_cancel_e2e',
    capabilities: {
      version: 'agent-runtime-workflow-adapter-capabilities/v1',
      supportedStepTypes: ['model'],
      sideEffectMode: 'none',
      summary: 'E2E adapter that yields to cancellation after execution starts',
    },
    execute: async ({ run, workerLeaseId }) => {
      adapterWorkerLeaseId = workerLeaseId;
      const controlResult = await app.gql({
        query: agentRuntimeControlMutation,
        variables: {
          input: {
            workspaceId: run.workspaceId,
            runId: run.id,
            action: 'cancel',
            reason: '  stop runtime after adapter yield  ',
          },
        },
      });
      requestedDuringAdapter = controlResult.controlCopilotAgentRuntimeRun;
    },
  });

  const workspace = await createWorkspace(app);
  const run = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_post_adapter_cancel_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'post-adapter-cancel-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'model_context',
        stepType: 'model',
        status: 'pending',
      },
    ],
  });

  const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
    workspaceId: workspace.id,
    runId: run.id,
  });
  t.is(signal, JOB_SIGNAL.Done);

  t.truthy(adapterWorkerLeaseId);
  const requestedDuringAdapterSnapshot = getRequestedDuringAdapter();
  t.truthy(requestedDuringAdapterSnapshot);
  if (!requestedDuringAdapterSnapshot) {
    throw new Error('Expected cancellation request during adapter execution');
  }
  t.is(requestedDuringAdapterSnapshot.status, 'running');
  t.is(requestedDuringAdapterSnapshot.workerLeaseId, adapterWorkerLeaseId);
  t.is(requestedDuringAdapterSnapshot.completedAt, null);

  const cancelled = await models.copilotAgentRuntime.get(workspace.id, run.id);
  t.truthy(cancelled);
  t.is(cancelled?.status, 'cancelled');
  t.is(cancelled?.failureCode, null);
  t.is(cancelled?.failureMessage, null);
  t.is(cancelled?.workerLeaseId, null);
  t.is(cancelled?.executionResultCount, 0);
  t.is(cancelled?.steps[0]?.status, 'skipped');
  t.is(cancelled?.steps[0]?.outputSummary.workerFailure, undefined);
  t.deepEqual(cancelled?.steps[0]?.outputSummary.manualControl, {
    version: 'agent-runtime-manual-control/v1',
    action: 'cancel',
    actorId: owner.id,
    reason: 'stop runtime after adapter yield',
  });
  t.deepEqual(
    cancelled?.timelineEvents
      .slice(-3)
      .map(event => [event.eventType, event.status, event.summary]),
    [
      [
        'run_cancellation',
        'running',
        'Agent runtime run cancellation requested',
      ],
      ['run_cancellation', 'cancelled', 'Agent runtime run manually cancelled'],
      ['model_step', 'skipped', 'Agent runtime model step manually cancelled'],
    ]
  );

  const rows = await db.$queryRaw<
    Array<{
      executionResultCount: number;
      failedTimelineCount: number;
      status: string;
      workerFailureStepCount: number;
    }>
  >`
    SELECT
      r.status,
      (
        SELECT COUNT(*)::int
        FROM ai_agent_runtime_execution_results result
        WHERE result.run_id = r.id
      ) AS "executionResultCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps step
        WHERE step.run_id = r.id
          AND step.output_summary -> ${'workerFailure'} IS NOT NULL
      ) AS "workerFailureStepCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events event
        WHERE event.run_id = r.id
          AND event.summary = ${'Agent runtime worker failed standalone run'}
      ) AS "failedTimelineCount"
    FROM ai_agent_runs r
    WHERE r.id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      executionResultCount: 0,
      failedTimelineCount: 0,
      status: 'cancelled',
      workerFailureStepCount: 0,
    },
  ]);
});

test('standalone Agent Runtime adapters can cooperatively consume cancellation during execution', async t => {
  const { agentRuntimeWorker, agentRuntimeWorkflowRegistry, app, db, owner } =
    t.context;
  const models = app.get(Models);
  let adapterWorkerAttempt: number | null = null;
  const getAdapterWorkerAttempt = (): number | null => adapterWorkerAttempt;
  let adapterWorkerLeaseId: string | null = null;
  let cancellationConsumedInAdapter = false;
  agentRuntimeWorkflowRegistry.register({
    workflow: 'agent_runtime_adapter_cancel_check_e2e',
    capabilities: {
      version: 'agent-runtime-workflow-adapter-capabilities/v1',
      supportedStepTypes: ['tool'],
      sideEffectMode: 'external_tool',
      summary:
        'E2E adapter that uses the cooperative cancellation checker during execution',
    },
    execute: async ({
      run,
      workerAttempt,
      workerLeaseId,
      checkCancellationRequested,
    }) => {
      adapterWorkerAttempt = workerAttempt;
      adapterWorkerLeaseId = workerLeaseId;
      const controlResult = await app.gql({
        query: agentRuntimeControlMutation,
        variables: {
          input: {
            workspaceId: run.workspaceId,
            runId: run.id,
            action: 'cancel',
            reason: '  stop runtime inside adapter  ',
          },
        },
      });
      t.is(controlResult.controlCopilotAgentRuntimeRun.status, 'running');
      const cancelled = await checkCancellationRequested();
      cancellationConsumedInAdapter = cancelled?.status === 'cancelled';
    },
  });

  const workspace = await createWorkspace(app);
  const run = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_adapter_cancel_check_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'adapter-cancel-check-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'tool_execution',
        stepType: 'tool',
        status: 'pending',
      },
    ],
  });

  const signal = await agentRuntimeWorker.runStandaloneAgentRuntime({
    workspaceId: workspace.id,
    runId: run.id,
  });
  t.is(signal, JOB_SIGNAL.Done);
  t.is(getAdapterWorkerAttempt(), 1);
  t.truthy(adapterWorkerLeaseId);
  t.true(cancellationConsumedInAdapter);

  const cancelled = await models.copilotAgentRuntime.get(workspace.id, run.id);
  t.truthy(cancelled);
  t.is(cancelled?.status, 'cancelled');
  t.is(cancelled?.workerLeaseId, null);
  t.is(cancelled?.failureCode, null);
  t.is(cancelled?.executionResultCount, 0);
  t.is(cancelled?.steps[0]?.status, 'skipped');
  t.deepEqual(cancelled?.steps[0]?.outputSummary.manualControl, {
    version: 'agent-runtime-manual-control/v1',
    action: 'cancel',
    actorId: owner.id,
    reason: 'stop runtime inside adapter',
  });

  const rows = await db.$queryRaw<
    Array<{
      failedTimelineCount: number;
      incompleteTimelineCount: number;
      workerFailureStepCount: number;
    }>
  >`
    SELECT
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps step
        WHERE step.run_id = r.id
          AND step.output_summary -> ${'workerFailure'} IS NOT NULL
      ) AS "workerFailureStepCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events event
        WHERE event.run_id = r.id
          AND event.summary = ${'Agent runtime worker failed standalone run'}
      ) AS "failedTimelineCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events event
        WHERE event.run_id = r.id
          AND event.payload->>'failureCode' = ${'agent_runtime_adapter_incomplete_execution'}
      ) AS "incompleteTimelineCount"
    FROM ai_agent_runs r
    WHERE r.id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      failedTimelineCount: 0,
      incompleteTimelineCount: 0,
      workerFailureStepCount: 0,
    },
  ]);
});

test('Agent Runtime DB rejects malformed running cancellation request payloads', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_local_completion',
    sourceType: 'agent_runtime_test',
    sourceId: 'bad-cooperative-cancel-runtime-run',
    status: 'queued',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
        status: 'pending',
      },
    ],
  });

  const leased =
    await app.models.copilotAgentRuntime.acquireStandaloneWorkerLease({
      workspaceId: workspace.id,
      id: run.id,
      workerId: 'agent-runtime-bad-cancel-worker',
      leaseMs: 60_000,
    });
  t.truthy(leased);

  await t.throwsAsync(
    db.$executeRaw`
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
        event_fingerprint
      )
      VALUES (
        ${'bad-agent-runtime-cancel-request'},
        ${run.id},
        ${null},
        ${workspace.id},
        ${owner.id},
        ${'run_cancellation'},
        ${'running'},
        ${999},
        ${'Agent runtime run cancellation requested'},
        ${JSON.stringify({
          version: 'agent-runtime-manual-control/v1',
          action: 'cancel_requested',
          actorId: owner.id,
          previousStatus: 'queued',
          workflow: 'agent_runtime_local_completion',
          sourceType: 'agent_runtime_test',
          sourceId: 'bad-cooperative-cancel-runtime-run',
          controlledAt: '2026-06-22T13:10:00.000Z',
          reason: 'bad request',
          workerAttempt: 0,
          workerLeaseId: 'agent-runtime-bad-cancel-worker',
          workerLeaseExpiresAt: '2026-06-22T13:30:00.000Z',
        })}::jsonb,
        ${'badagentruntimecancelfp'}
      )
    `,
    { message: /ai_agent_timeline_manual_control_payload_check/ }
  );
});

test('standalone Agent Runtime resume fails closed when run state changes before update', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const run = await app.models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_stale_resume_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'stale-resume-runtime-run',
    status: 'failed',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
        status: 'failed',
      },
    ],
  });

  const staleExisting = await app.models.copilotAgentRuntime.get(
    workspace.id,
    run.id
  );
  t.truthy(staleExisting);
  const cancelled = await app.models.copilotAgentRuntime.controlRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    id: run.id,
    action: 'resume',
    reason: 'prepare stale resume race',
  });
  t.is(cancelled.status, 'queued');

  const previousRuntimeJobCount = app.queue.count('copilot.agentRuntime.run');
  const model = app.models.copilotAgentRuntime;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      app.gql({
        query: agentRuntimeControlMutation,
        variables: {
          input: {
            workspaceId: workspace.id,
            runId: run.id,
            action: 'resume',
            reason: 'stale resume should not persist',
          },
        },
      }),
      {
        message: /could not be resumed because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      status: string;
      manualStepCount: number;
      resumeTimelineCount: number;
    }>
  >`
    SELECT
      r.status,
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps s
        WHERE s.run_id = r.id
          AND s.output_summary -> ${'manualControl'} IS NOT NULL
      ) AS "manualStepCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.summary = ${'Agent runtime run manually resumed'}
      ) AS "resumeTimelineCount"
    FROM ai_agent_runs r
    WHERE r.id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      status: 'queued',
      manualStepCount: 1,
      resumeTimelineCount: 1,
    },
  ]);
  t.is(app.queue.count('copilot.agentRuntime.run'), previousRuntimeJobCount);
});

test('standalone Agent Runtime resume fails closed when run snapshot evidence changes before update', async t => {
  const { app, db, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const run = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_stale_resume_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'stale-resume-run-snapshot-runtime-run',
    status: 'cancelled',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
        status: 'skipped',
      },
    ],
  });

  const staleExisting = await models.copilotAgentRuntime.get(
    workspace.id,
    run.id
  );
  t.truthy(staleExisting);
  const driftedAt = new Date(staleExisting!.updatedAt.getTime() + 60_000);
  const driftedRows = await db.$executeRaw`
    UPDATE ai_agent_runs
    SET updated_at = ${driftedAt}
    WHERE id = ${run.id}
      AND status = ${'cancelled'}
  `;
  t.is(driftedRows, 1);

  const previousRuntimeJobCount = app.queue.count('copilot.agentRuntime.run');
  const model = models.copilotAgentRuntime;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.controlRun({
        workspaceId: workspace.id,
        actorId: owner.id,
        id: run.id,
        action: 'resume',
        reason: 'stale resume snapshot should not persist',
      }),
      {
        message: /could not be resumed because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      manualStepCount: number;
      resumeTimelineCount: number;
      status: string;
      updatedAt: Date;
    }>
  >`
    SELECT
      r.status,
      r.updated_at AS "updatedAt",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps s
        WHERE s.run_id = r.id
          AND s.output_summary -> ${'manualControl'} IS NOT NULL
      ) AS "manualStepCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.summary = ${'Agent runtime run manually resumed'}
      ) AS "resumeTimelineCount"
    FROM ai_agent_runs r
    WHERE r.id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      manualStepCount: 0,
      resumeTimelineCount: 0,
      status: 'cancelled',
      updatedAt: driftedAt,
    },
  ]);
  t.is(app.queue.count('copilot.agentRuntime.run'), previousRuntimeJobCount);
});

test('standalone Agent Runtime resume fails closed when step state changes before update', async t => {
  const { app, db, owner } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const run = await models.copilotAgentRuntime.createRun({
    workspaceId: workspace.id,
    actorId: owner.id,
    workflow: 'agent_runtime_stale_resume_step_e2e',
    sourceType: 'agent_runtime_test',
    sourceId: 'stale-resume-step-runtime-run',
    status: 'failed',
    steps: [
      {
        stepKey: 'tool_lookup',
        stepType: 'tool',
        status: 'failed',
      },
    ],
  });

  const staleExisting = await models.copilotAgentRuntime.get(
    workspace.id,
    run.id
  );
  t.truthy(staleExisting);
  const driftedAt = new Date(run.updatedAt.getTime() + 30_000);
  await db.$transaction(async tx => {
    await tx.$executeRaw`
      UPDATE ai_agent_steps
      SET
        status = ${'completed'},
        completed_at = ${driftedAt},
        output_summary = output_summary || ${JSON.stringify({
          stepDriftBeforeManualResume: true,
        })}::jsonb,
        updated_at = ${driftedAt}
      WHERE id = ${run.steps[0].id}
    `;
    await tx.$executeRaw`
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
      VALUES (
        ${'agent-runtime-stale-resume-step-drift-event'},
        ${run.id},
        ${run.steps[0].id},
        ${workspace.id},
        ${owner.id},
        ${'tool_step'},
        ${'completed'},
        ${100},
        ${'Agent runtime step drift before manual resume'},
        ${JSON.stringify({
          version: 'agent-runtime-test-step-drift/v1',
          stepKey: 'tool_lookup',
          stepType: 'tool',
        })}::jsonb,
        ${'agent-runtime-stale-resume-step-drift-fp'},
        ${driftedAt}
      )
    `;
  });

  const previousRuntimeJobCount = app.queue.count('copilot.agentRuntime.run');
  const model = models.copilotAgentRuntime;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.controlRun({
        workspaceId: workspace.id,
        actorId: owner.id,
        id: run.id,
        action: 'resume',
        reason: 'stale resume step should not persist',
      }),
      {
        message: /step could not be resumed because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      manualStepCount: number;
      resumeTimelineCount: number;
      runStatus: string;
      stepStatus: string;
    }>
  >`
    SELECT
      r.status AS "runStatus",
      s.status AS "stepStatus",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_steps step
        WHERE step.run_id = r.id
          AND step.output_summary -> ${'manualControl'} IS NOT NULL
      ) AS "manualStepCount",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.summary = ${'Agent runtime run manually resumed'}
      ) AS "resumeTimelineCount"
    FROM ai_agent_runs r
    JOIN ai_agent_steps s ON s.run_id = r.id
    WHERE r.id = ${run.id}
  `;
  t.deepEqual(rows, [
    {
      manualStepCount: 0,
      resumeTimelineCount: 0,
      runStatus: 'failed',
      stepStatus: 'completed',
    },
  ]);
  t.is(app.queue.count('copilot.agentRuntime.run'), previousRuntimeJobCount);
});

test('approval decision queues repair execution and worker publishes a DB-backed prompt registry revision', async t => {
  const { app, db, worker } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const driftActor = await app.createUser();
  const promptName = 'Repair approval decision prompt';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;
  t.is(waitingRecord.auditEventCount, 2);
  t.deepEqual(
    waitingRecord.auditEvents
      .map((event: { eventType: string }) => event.eventType)
      .sort(),
    ['requested', 'waiting_approval']
  );
  t.true(
    waitingRecord.auditEvents.every(
      (event: {
        actorId: string;
        eventFingerprint: string;
        executionRequestId: string;
        workspaceId: string;
      }) =>
        event.actorId === waitingRecord.actorId &&
        event.executionRequestId === waitingRecord.id &&
        event.workspaceId === workspace.id &&
        /^[a-f0-9]{16}$/.test(event.eventFingerprint)
    )
  );

  const decisionResult = await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
        reason: 'validated in e2e',
      },
    },
  });
  const decided = decisionResult.decideCopilotRepairExecutionApproval;

  t.is(decided.id, waitingRecord.id);
  t.is(decided.status, 'queued');
  t.is(decided.approvalState, 'approved');
  t.falsy(decided.completedAt);
  t.truthy(decided.queuedAt);
  t.is(decided.workerAttempt, 0);
  t.is(decided.workerMaxAttempts, 3);
  t.is(decided.workerLeaseId, null);
  t.is(decided.auditEventCount, 4);
  t.is(decided.auditEvents.length, 4);
  t.deepEqual(
    decided.auditEvents
      .map((event: { eventType: string }) => event.eventType)
      .sort(),
    ['approval_approved', 'queued', 'requested', 'waiting_approval']
  );
  t.true(
    decided.auditEvents.some(
      (event: { eventType: string; metadata: { reason?: string } }) =>
        event.eventType === 'approval_approved' &&
        event.metadata.reason === 'validated in e2e'
    )
  );
  t.is(decided.runtimeResult.executor, 'queued_repair_execution_worker');
  t.false(decided.runtimeResult.sideEffectsApplied);
  t.is(decided.agentRun.id, waitingRecord.agentRun.id);
  t.is(decided.agentRun.status, 'queued');
  t.falsy(decided.agentRun.completedAt);
  t.is(decided.agentRun.steps[0].status, 'pending');
  t.is(decided.agentRun.steps[0].stepType, 'model');
  t.is(
    decided.agentRun.steps[0].outputSummary.version,
    'agent-runtime-repair-execution-step/v1'
  );
  t.is(decided.agentRun.steps[0].outputSummary.approvalState, 'approved');
  t.is(decided.agentRun.steps[0].outputSummary.permissionStatus, 'granted');
  t.false(decided.agentRun.steps[0].outputSummary.sideEffectsApplied);
  t.deepEqual(
    decided.agentRun.timelineEvents.map(
      (event: { eventType: string; status: string }) => [
        event.eventType,
        event.status,
      ]
    ),
    [
      ['run_status', 'waiting_approval'],
      ['approval_step', 'waiting_approval'],
      ['run_status', 'queued'],
      ['model_step', 'pending'],
    ]
  );

  const queuedRevisionRows = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count"
    FROM ai_prompt_registry_revisions
    WHERE id = ${`prompt-revision-${waitingRecord.id}`}
  `;
  t.is(queuedRevisionRows[0]?.count, 0);

  const requestRows = await db.$queryRaw<
    Array<{
      approvalState: string;
      runtimeResult: {
        executor: string;
        sideEffectKind?: string;
        sideEffectRecordId?: string;
        sideEffectSummary?: {
          rollbackContract?: Record<string, unknown>;
        };
        sideEffectsApplied: boolean;
      };
      status: string;
      workerAttempt: number;
    }>
  >`
    SELECT
      approval_state AS "approvalState",
      runtime_result AS "runtimeResult",
      status,
      worker_attempt AS "workerAttempt"
    FROM ai_repair_execution_requests
    WHERE id = ${waitingRecord.id}
  `;
  t.is(requestRows[0]?.status, 'queued');
  t.is(requestRows[0]?.approvalState, 'approved');
  t.is(
    requestRows[0]?.runtimeResult.executor,
    'queued_repair_execution_worker'
  );
  t.false(requestRows[0]?.runtimeResult.sideEffectsApplied);
  t.is(requestRows[0]?.workerAttempt, 0);

  const signal = await worker.runRepairExecution({
    workspaceId: workspace.id,
    executionRequestId: waitingRecord.id,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const completedRows = await db.$queryRaw<
    Array<{
      approvalState: string;
      completedAt: Date | null;
      lastAttemptAt: Date | null;
      runtimeResult: {
        executor: string;
        sideEffectKind?: string;
        sideEffectRecordId?: string;
        sideEffectSummary?: {
          rollbackContract?: Record<string, unknown>;
        };
        sideEffectsApplied: boolean;
      };
      status: string;
      workerAttempt: number;
      workerLeaseExpiresAt: Date | null;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      approval_state AS "approvalState",
      completed_at AS "completedAt",
      last_attempt_at AS "lastAttemptAt",
      runtime_result AS "runtimeResult",
      status,
      worker_attempt AS "workerAttempt",
      worker_lease_expires_at AS "workerLeaseExpiresAt",
      worker_lease_id AS "workerLeaseId"
    FROM ai_repair_execution_requests
    WHERE id = ${waitingRecord.id}
  `;
  t.is(completedRows[0]?.status, 'completed');
  t.is(completedRows[0]?.approvalState, 'approved');
  t.truthy(completedRows[0]?.completedAt);
  t.truthy(completedRows[0]?.lastAttemptAt);
  t.is(completedRows[0]?.workerAttempt, 1);
  t.is(completedRows[0]?.workerLeaseId, null);
  t.is(completedRows[0]?.workerLeaseExpiresAt, null);
  t.is(
    completedRows[0]?.runtimeResult.executor,
    'prompt_registry_revision_publish_worker'
  );
  t.true(completedRows[0]?.runtimeResult.sideEffectsApplied);
  t.is(
    completedRows[0]?.runtimeResult.sideEffectKind,
    'prompt_registry_revision'
  );
  t.is(
    completedRows[0]?.runtimeResult.sideEffectRecordId,
    `prompt-revision-${waitingRecord.id}`
  );
  t.deepEqual(
    completedRows[0]?.runtimeResult.sideEffectSummary?.rollbackContract,
    forwardOnlyRollbackContract
  );

  const sideEffectRows = await db.$queryRaw<
    Array<{
      actorId: string;
      executorPayloadFingerprint: string;
      sideEffectFingerprint: string;
      sideEffectKind: string;
      sideEffectRecordId: string;
      sideEffectSummary: {
        rollbackContract?: Record<string, unknown>;
        version?: string;
      };
      workerAttempt: number;
      workerLeaseId: string;
      workspaceId: string;
    }>
  >`
    SELECT
      actor_id AS "actorId",
      executor_payload_fingerprint AS "executorPayloadFingerprint",
      side_effect_fingerprint AS "sideEffectFingerprint",
      side_effect_kind AS "sideEffectKind",
      side_effect_record_id AS "sideEffectRecordId",
      side_effect_summary AS "sideEffectSummary",
      worker_attempt AS "workerAttempt",
      worker_lease_id AS "workerLeaseId",
      workspace_id AS "workspaceId"
    FROM ai_repair_execution_side_effects
    WHERE execution_request_id = ${waitingRecord.id}
  `;
  t.is(sideEffectRows.length, 1);
  t.like(sideEffectRows[0], {
    actorId: waitingRecord.actorId,
    sideEffectKind: 'prompt_registry_revision',
    sideEffectRecordId: `prompt-revision-${waitingRecord.id}`,
    workerAttempt: 1,
    workspaceId: workspace.id,
  });
  t.regex(sideEffectRows[0]?.sideEffectFingerprint ?? '', /^[a-f0-9]{16}$/);
  t.regex(
    sideEffectRows[0]?.executorPayloadFingerprint ?? '',
    /^[a-f0-9]{16}$/
  );
  t.truthy(sideEffectRows[0]?.workerLeaseId);
  t.deepEqual(
    sideEffectRows[0]?.sideEffectSummary.rollbackContract,
    forwardOnlyRollbackContract
  );

  const filteredBySideEffectResult = await app.gql({
    query: repairExecutionsQuery,
    variables: {
      workspaceId: workspace.id,
      filter: {
        query: sideEffectRows[0]?.sideEffectFingerprint,
        status: 'completed',
      },
      limit: 5,
    },
  });
  const sideEffectFilteredExecutions = filteredBySideEffectResult.currentUser
    .copilot.repairExecutions as Array<{
    id: string;
    sideEffectCount: number;
    sideEffects: Array<{
      sideEffectFingerprint: string;
      sideEffectRecordId: string;
    }>;
    status: string;
  }>;
  t.deepEqual(
    sideEffectFilteredExecutions.map(execution => execution.id),
    [waitingRecord.id]
  );
  t.is(sideEffectFilteredExecutions[0]?.status, 'completed');
  t.is(sideEffectFilteredExecutions[0]?.sideEffectCount, 1);
  t.like(sideEffectFilteredExecutions[0]?.sideEffects[0], {
    sideEffectFingerprint: sideEffectRows[0]?.sideEffectFingerprint,
    sideEffectRecordId: `prompt-revision-${waitingRecord.id}`,
  });

  const hydratedCompleted = await models.copilotRepairExecution.get(
    workspace.id,
    waitingRecord.id
  );
  t.truthy(hydratedCompleted);
  t.is(hydratedCompleted?.auditEventCount, 7);
  t.deepEqual(
    hydratedCompleted?.auditEvents.map(event => event.eventType),
    [
      'completed',
      'side_effect_applied',
      'running',
      'queued',
      'approval_approved',
    ]
  );
  t.is(hydratedCompleted?.sideEffectCount, 1);
  t.is(hydratedCompleted?.sideEffects.length, 1);
  t.like(hydratedCompleted?.sideEffects[0], {
    executionRequestId: waitingRecord.id,
    sideEffectKind: 'prompt_registry_revision',
    sideEffectRecordId: `prompt-revision-${waitingRecord.id}`,
    workerAttempt: 1,
    workspaceId: workspace.id,
  });
  t.deepEqual(
    hydratedCompleted?.sideEffects[0]?.sideEffectSummary.rollbackContract,
    forwardOnlyRollbackContract
  );

  const readbackResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const readbackRecord =
    readbackResult.requestCopilotPromptRegistryRepairExecution.executionRecord;
  t.is(readbackRecord.id, waitingRecord.id);
  t.is(readbackRecord.auditEventCount, 8);
  t.deepEqual(
    readbackRecord.auditEvents.map(
      (event: { eventType: string }) => event.eventType
    ),
    ['reused', 'completed', 'side_effect_applied', 'running', 'queued']
  );
  t.like(readbackRecord.auditEvents[0], {
    actorId: waitingRecord.actorId,
    eventType: 'reused',
    executionRequestId: waitingRecord.id,
    workspaceId: workspace.id,
  });
  await t.throwsAsync(
    db.$transaction(async tx => {
      await tx.$executeRaw`
        DELETE FROM ai_repair_execution_audit_events
        WHERE execution_request_id = ${waitingRecord.id}
          AND event_type = ${'completed'}
      `;
      await tx.$executeRaw`
        SET CONSTRAINTS "zz_ai_repair_exec_audit_events_delete_restrict_check" IMMEDIATE
      `;
    }),
    { message: /ai_repair_execution_audit_events_delete_restrict_check/ }
  );
  t.is(readbackRecord.sideEffectCount, 1);
  t.is(readbackRecord.sideEffects.length, 1);
  t.like(readbackRecord.sideEffects[0], {
    executionRequestId: waitingRecord.id,
    sideEffectKind: 'prompt_registry_revision',
    sideEffectRecordId: `prompt-revision-${waitingRecord.id}`,
    workerAttempt: 1,
    workspaceId: workspace.id,
  });
  t.deepEqual(
    readbackRecord.sideEffects[0]?.sideEffectSummary.rollbackContract,
    forwardOnlyRollbackContract
  );

  await db.$executeRaw`
    UPDATE ai_repair_execution_side_effects
    SET side_effect_summary = side_effect_summary
    WHERE execution_request_id = ${waitingRecord.id}
  `;

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_side_effects
      SET worker_lease_id = ${'side-effect-worker-lease-drift'}
      WHERE execution_request_id = ${waitingRecord.id}
    `,
    {
      message: /ai_repair_execution_side_effects_content_update_restrict_check/,
    }
  );
  const sideEffectCreatedRows = await db.$queryRaw<Array<{ createdAt: Date }>>`
    SELECT created_at AS "createdAt"
    FROM ai_repair_execution_side_effects
    WHERE execution_request_id = ${waitingRecord.id}
  `;
  t.truthy(sideEffectCreatedRows[0]);
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_side_effects
      SET created_at = ${new Date(
        sideEffectCreatedRows[0]!.createdAt.getTime() + 60_000
      )}
      WHERE execution_request_id = ${waitingRecord.id}
    `,
    {
      message: /ai_repair_execution_side_effects_content_update_restrict_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      DELETE FROM ai_repair_execution_side_effects
      WHERE execution_request_id = ${waitingRecord.id}
    `,
    {
      message: /ai_repair_execution_side_effects_delete_restrict_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      DELETE FROM ai_repair_execution_requests
      WHERE id = ${waitingRecord.id}
    `,
    {
      message: /ai_repair_execution_requests_delete_restrict_check/,
    }
  );

  const cascadeWorkspace = await createWorkspace(app);
  const cascadeRequestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: cascadeWorkspace.id,
  });
  const cascadeRequestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: cascadeRequestInput,
    },
  });
  const cascadeRequest =
    cascadeRequestResult.requestCopilotPromptRegistryRepairExecution
      .executionRecord;
  await db.$executeRaw`
    DELETE FROM workspaces
    WHERE id = ${cascadeWorkspace.id}
  `;
  const cascadeRequestRows = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM ai_repair_execution_requests
    WHERE id = ${cascadeRequest.id}
  `;
  t.deepEqual(cascadeRequestRows, [{ count: 0 }]);
  const cascadeAuditRows = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM ai_repair_execution_audit_events
    WHERE execution_request_id = ${cascadeRequest.id}
  `;
  t.deepEqual(cascadeAuditRows, [{ count: 0 }]);

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_side_effects
      SET side_effect_summary = side_effect_summary - ${'rollbackContract'}
      WHERE execution_request_id = ${waitingRecord.id}
    `,
    {
      message: /ai_repair_execution_side_effects_result_snapshot_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_side_effects
      SET side_effect_fingerprint = ${'side-effect-result-drift'}
      WHERE execution_request_id = ${waitingRecord.id}
    `,
    {
      message: /ai_repair_execution_side_effects_result_snapshot_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_side_effects
      SET applied_at = ${new Date('2026-06-23T05:00:00.000Z')}
      WHERE execution_request_id = ${waitingRecord.id}
    `,
    {
      message: /ai_repair_execution_side_effects_result_snapshot_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_side_effects
      SET executor_payload_fingerprint = ${'executor-payload-drift'}
      WHERE execution_request_id = ${waitingRecord.id}
    `,
    {
      message:
        /ai_repair_execution_side_effects_executor_payload_fingerprint_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_side_effects
      SET actor_id = ${'wrong-side-effect-actor'}
      WHERE execution_request_id = ${waitingRecord.id}
    `,
    {
      message: /ai_repair_execution_side_effects_execution_request_id_fkey/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET runtime_result = jsonb_set(
        runtime_result,
        ${'{sideEffectRecordId}'}::text[],
        ${'"side-effect-result-drift"'}::jsonb
      )
      WHERE id = ${waitingRecord.id}
    `,
    {
      message: /ai_repair_execution_requests_side_effect_result_snapshot_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET completed_at = ${new Date('2026-06-23T05:00:00.000Z')}
      WHERE id = ${waitingRecord.id}
    `,
    {
      message: /ai_repair_execution_requests_side_effect_result_snapshot_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET executor_payload = executor_payload || ${JSON.stringify({
        directDrift: true,
      })}::jsonb
      WHERE id = ${waitingRecord.id}
    `,
    {
      message:
        /ai_repair_execution_requests_side_effect_executor_payload_snapshot_check/,
    }
  );
  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET actor_id = ${driftActor.id}
      WHERE id = ${waitingRecord.id}
    `,
    {
      message: /ai_repair_execution_side_effects_execution_request_id_fkey/,
    }
  );

  const runtimeRows = await db.$queryRaw<
    Array<{
      outputSummary: {
        version?: string;
        sideEffectKind?: string;
        sideEffectRecordId?: string;
        sideEffectRollbackContract?: Record<string, unknown>;
        sideEffectsApplied?: boolean;
      };
      status: string;
      stepStatus: string;
    }>
  >`
    SELECT
      r.status,
      s.status AS "stepStatus",
      s.output_summary AS "outputSummary"
    FROM ai_agent_runs r
    JOIN ai_agent_steps s ON s.run_id = r.id
    WHERE r.source_type = ${'repair_execution_request'}
      AND r.source_id = ${waitingRecord.id}
      AND r.workspace_id = ${workspace.id}
  `;
  t.is(runtimeRows.length, 1);
  t.is(runtimeRows[0]?.status, 'completed');
  t.is(runtimeRows[0]?.stepStatus, 'completed');
  t.is(
    runtimeRows[0]?.outputSummary.version,
    'agent-runtime-repair-execution-step/v1'
  );
  t.true(runtimeRows[0]?.outputSummary.sideEffectsApplied);
  t.is(
    runtimeRows[0]?.outputSummary.sideEffectKind,
    'prompt_registry_revision'
  );
  t.is(
    runtimeRows[0]?.outputSummary.sideEffectRecordId,
    `prompt-revision-${waitingRecord.id}`
  );
  t.deepEqual(
    runtimeRows[0]?.outputSummary.sideEffectRollbackContract,
    forwardOnlyRollbackContract
  );
  const runtimeTimelineRows = await db.$queryRaw<
    Array<{
      eventType: string;
      payload: {
        version?: string;
        repairJobFingerprint?: string;
        sideEffectKind?: string;
        sideEffectRecordId?: string;
        sideEffectRollbackContract?: Record<string, unknown>;
        sideEffectsApplied?: boolean;
      };
      status: string;
      summary: string;
    }>
  >`
    SELECT
      event_type AS "eventType",
      payload,
      status,
      summary
    FROM ai_agent_timeline_events
    WHERE run_id = ${waitingRecord.agentRun.id}
    ORDER BY ordinal ASC
  `;
  t.deepEqual(
    runtimeTimelineRows.map(row => [row.eventType, row.status, row.summary]),
    [
      [
        'run_status',
        'waiting_approval',
        'Repair execution run waiting_approval',
      ],
      [
        'approval_step',
        'waiting_approval',
        'Repair execution waiting for approval',
      ],
      ['run_status', 'queued', 'Repair execution run queued'],
      ['model_step', 'pending', 'Repair execution queued for worker'],
      ['run_status', 'running', 'Repair execution run running'],
      ['model_step', 'running', 'Repair execution worker running'],
      ['run_status', 'completed', 'Repair execution run completed'],
      [
        'model_step',
        'completed',
        'Repair execution applied approved side effect',
      ],
    ]
  );
  const completedRunTimelineEvent = runtimeTimelineRows.find(
    row => row.eventType === 'run_status' && row.status === 'completed'
  );
  t.is(
    completedRunTimelineEvent?.payload.version,
    'agent-runtime-repair-execution-run/v1'
  );
  t.is(
    completedRunTimelineEvent?.payload.repairJobFingerprint,
    waitingRecord.repairJobFingerprint
  );
  const completedRuntimeTimelineEvent = runtimeTimelineRows.find(
    row => row.eventType === 'model_step' && row.status === 'completed'
  );
  t.is(
    completedRuntimeTimelineEvent?.payload.version,
    'agent-runtime-repair-execution-step/v1'
  );
  t.true(completedRuntimeTimelineEvent?.payload.sideEffectsApplied);
  t.is(
    completedRuntimeTimelineEvent?.payload.sideEffectKind,
    'prompt_registry_revision'
  );
  t.is(
    completedRuntimeTimelineEvent?.payload.sideEffectRecordId,
    `prompt-revision-${waitingRecord.id}`
  );
  t.deepEqual(
    completedRuntimeTimelineEvent?.payload.sideEffectRollbackContract,
    forwardOnlyRollbackContract
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET output_summary = output_summary - ${'permissionStatus'}
      WHERE run_id = ${waitingRecord.agentRun.id}
        AND step_key = ${'repair_execution'}
    `,
    { message: /ai_agent_steps_repair_execution_payload_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET output_summary = jsonb_set(
        output_summary - ${'permissionStatus'},
        ${'{version}'}::text[],
        ${JSON.stringify('  agent-runtime-repair-execution-step/v1  ')}::jsonb
      )
      WHERE run_id = ${waitingRecord.agentRun.id}
        AND step_key = ${'repair_execution'}
    `,
    { message: /ai_agent_steps_repair_execution_payload_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET payload = payload - ${'repairJobFingerprint'}
      WHERE run_id = ${waitingRecord.agentRun.id}
        AND event_type = ${'run_status'}
        AND status = ${'completed'}
    `,
    { message: /ai_agent_timeline_repair_execution_payload_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET payload = payload - ${'sideEffectRollbackContract'}
      WHERE run_id = ${waitingRecord.agentRun.id}
        AND event_type = ${'model_step'}
        AND status = ${'completed'}
    `,
    { message: /ai_agent_timeline_repair_execution_payload_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_steps
      SET output_summary =
        output_summary #- ${'{sideEffectRollbackContract,reason}'}::text[]
      WHERE run_id = ${waitingRecord.agentRun.id}
        AND step_key = ${'repair_execution'}
    `,
    { message: /ai_agent_steps_repair_execution_payload_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_agent_timeline_events
      SET payload = payload #- ${'{sideEffectRollbackContract,reason}'}::text[]
      WHERE run_id = ${waitingRecord.agentRun.id}
        AND event_type = ${'model_step'}
        AND status = ${'completed'}
    `,
    { message: /ai_agent_timeline_repair_execution_payload_check/ }
  );

  const revisionRows = await db.$queryRaw<
    Array<{
      actorId: string;
      fallbackSourceChain: Array<{ source: string; status: string }>;
      fingerprint: string;
      metadata: {
        executionRequestId: string;
        operationFingerprints: string[];
        operationKinds: string[];
      };
      promptName: string;
      revision: string;
      scopeType: string;
      status: string;
      workspaceId: string;
    }>
  >`
    SELECT
      actor_id AS "actorId",
      fallback_source_chain AS "fallbackSourceChain",
      fingerprint,
      metadata,
      prompt_name AS "promptName",
      revision,
      scope_type AS "scopeType",
      status,
      workspace_id AS "workspaceId"
    FROM ai_prompt_registry_revisions
    WHERE id = ${`prompt-revision-${waitingRecord.id}`}
  `;
  t.is(revisionRows.length, 1);
  t.like(revisionRows[0], {
    promptName,
    revision: `repair-${waitingRecord.id}`,
    scopeType: 'workspace',
    status: 'active',
    workspaceId: workspace.id,
  });
  t.is(revisionRows[0]?.metadata.executionRequestId, waitingRecord.id);
  t.true(revisionRows[0]?.metadata.operationFingerprints.length > 0);
  t.true(revisionRows[0]?.metadata.operationKinds.length > 0);
  t.true(
    revisionRows[0]?.fallbackSourceChain.some(
      entry => entry.source === 'legacy_registry' && entry.status
    )
  );

  const catalogRows = await db.$queryRaw<
    Array<{ promptName: string; revision: string; workspaceId: string }>
  >`
    SELECT
      prompt_name AS "promptName",
      revision,
      workspace_id AS "workspaceId"
    FROM ai_prompt_registry_revisions
    WHERE prompt_name = ${promptName}
      AND workspace_id = ${workspace.id}
      AND status = 'active'
  `;
  t.deepEqual(catalogRows, [
    {
      promptName,
      revision: `repair-${waitingRecord.id}`,
      workspaceId: workspace.id,
    },
  ]);

  const auditRows = await db.$queryRaw<Array<{ eventType: string }>>`
    SELECT event_type AS "eventType"
    FROM ai_repair_execution_audit_events
    WHERE execution_request_id = ${waitingRecord.id}
    ORDER BY created_at ASC
  `;
  t.deepEqual(
    auditRows.map(row => row.eventType),
    [
      'requested',
      'waiting_approval',
      'approval_approved',
      'queued',
      'running',
      'side_effect_applied',
      'completed',
      'reused',
    ]
  );

  await t.throwsAsync(
    app.gql({
      query: approvalDecisionMutation,
      variables: {
        input: {
          workspaceId: workspace.id,
          executionRequestId: waitingRecord.id,
          decision: 'approve',
        },
      },
    })
  );
});

test('repair execution side-effect ledger fails closed when parent request snapshot changes before insert', async t => {
  const { app, db, worker } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const promptName = 'Repair side-effect parent drift';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
        reason: 'validated for side-effect snapshot drift test',
      },
    },
  });
  const workerSignal = await worker.runRepairExecution({
    workspaceId: workspace.id,
    executionRequestId: waitingRecord.id,
  });
  t.is(workerSignal, JOB_SIGNAL.Done);

  const completed = await models.copilotRepairExecution.get(
    workspace.id,
    waitingRecord.id
  );
  t.truthy(completed);
  t.is(completed?.status, 'completed');
  t.is(completed?.sideEffectCount, 1);
  const sideEffect = completed!.sideEffects[0];
  t.truthy(sideEffect);

  const driftedAt = new Date(completed!.updatedAt.getTime() + 60_000);
  const driftedRows = await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET updated_at = ${driftedAt}
    WHERE id = ${waitingRecord.id}
      AND status = ${'completed'}
  `;
  t.is(driftedRows, 1);

  const staleRecord = {
    ...completed!,
    workerAttempt: completed!.workerAttempt + 1,
  };
  await t.throwsAsync(
    (
      models.copilotRepairExecution as unknown as {
        createSideEffectLedgerEntry(input: {
          appliedAt: Date;
          executorPayloadFingerprint: string;
          record: typeof staleRecord;
          sideEffect: {
            fingerprint: string;
            kind: string;
            recordId: string;
            summary: Record<string, unknown>;
          };
          workerLeaseId: string;
        }): Promise<void>;
      }
    ).createSideEffectLedgerEntry({
      appliedAt: completed!.completedAt!,
      executorPayloadFingerprint: sideEffect!.executorPayloadFingerprint,
      record: staleRecord,
      sideEffect: {
        fingerprint: sideEffect!.sideEffectFingerprint,
        kind: sideEffect!.sideEffectKind,
        recordId: sideEffect!.sideEffectRecordId,
        summary: sideEffect!.sideEffectSummary,
      },
      workerLeaseId: sideEffect!.workerLeaseId,
    }),
    {
      message:
        /Repair execution side effect could not be recorded because its request state changed/,
    }
  );

  const rows = await db.$queryRaw<
    Array<{
      sideEffectCount: number;
      status: string;
      updatedAt: Date;
    }>
  >`
    SELECT
      r.status,
      r.updated_at AS "updatedAt",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_side_effects side_effect
        WHERE side_effect.execution_request_id = r.id
      ) AS "sideEffectCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      sideEffectCount: 1,
      status: 'completed',
      updatedAt: driftedAt,
    },
  ]);
});

test('repair execution Agent Runtime sync fails closed when linked run snapshot changes before update', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair sync run drift';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;
  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const models = app.get(Models);
  const staleExisting = await models.copilotAgentRuntime.getBySource(
    workspace.id,
    'repair_execution_request',
    waitingRecord.id
  );
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'queued');
  const driftedAt = new Date(staleExisting!.updatedAt.getTime() + 60_000);
  const driftedRows = await db.$executeRaw`
    UPDATE ai_agent_runs
    SET updated_at = ${driftedAt}
    WHERE workspace_id = ${workspace.id}
      AND id = ${staleExisting!.id}
  `;
  t.is(driftedRows, 1);

  const lease = await models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-sync-stale-run-worker',
  });
  t.truthy(lease);
  t.is(lease?.status, 'running');

  const runtime = models.copilotAgentRuntime;
  const originalGetBySource = runtime.getBySource.bind(runtime);
  let returnedStaleRecord = false;
  const getBySourceStub = Sinon.stub(runtime, 'getBySource').callsFake(
    async (workspaceId: string, sourceType: string, sourceId: string) => {
      if (
        !returnedStaleRecord &&
        workspaceId === workspace.id &&
        sourceType === 'repair_execution_request' &&
        sourceId === waitingRecord.id
      ) {
        returnedStaleRecord = true;
        return staleExisting;
      }
      return await originalGetBySource(workspaceId, sourceType, sourceId);
    }
  );
  try {
    await t.throwsAsync(
      runtime.syncRepairExecution({
        record: lease!,
      }),
      {
        message:
          /repair execution sync could not update run because its state changed/,
      }
    );
  } finally {
    getBySourceStub.restore();
  }

  const rows = await db.$queryRaw<
    Array<{
      runStatus: string;
      runUpdatedAt: Date;
      runtimeExecutor: string | null;
      runningTimelineCount: number;
    }>
  >`
    SELECT
      r.status AS "runStatus",
      r.updated_at AS "runUpdatedAt",
      s.output_summary ->> ${'runtimeExecutor'} AS "runtimeExecutor",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.status = ${'running'}
      ) AS "runningTimelineCount"
    FROM ai_agent_runs r
    JOIN ai_agent_steps s ON s.run_id = r.id
    WHERE r.id = ${staleExisting!.id}
      AND s.step_key = ${'repair_execution'}
  `;
  t.deepEqual(rows, [
    {
      runStatus: 'queued',
      runUpdatedAt: driftedAt,
      runtimeExecutor: 'queued_repair_execution_worker',
      runningTimelineCount: 0,
    },
  ]);
});

test('repair execution Agent Runtime sync fails closed when linked run snapshot identity changes before update', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const driftActor = await app.createUser();
  const promptName = 'Repair sync run identity drift';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;
  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const models = app.get(Models);
  const staleExisting = await models.copilotAgentRuntime.getBySource(
    workspace.id,
    'repair_execution_request',
    waitingRecord.id
  );
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'queued');

  const lease = await models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-sync-stale-run-identity-worker',
  });
  t.truthy(lease);
  t.is(lease?.status, 'running');

  const runtime = models.copilotAgentRuntime;
  const originalGetBySource = runtime.getBySource.bind(runtime);
  let returnedStaleRecord = false;
  const getBySourceStub = Sinon.stub(runtime, 'getBySource').callsFake(
    async (workspaceId: string, sourceType: string, sourceId: string) => {
      if (
        !returnedStaleRecord &&
        workspaceId === workspace.id &&
        sourceType === 'repair_execution_request' &&
        sourceId === waitingRecord.id
      ) {
        returnedStaleRecord = true;
        return {
          ...staleExisting!,
          actorId: driftActor.id,
        };
      }
      return await originalGetBySource(workspaceId, sourceType, sourceId);
    }
  );
  try {
    await t.throwsAsync(
      runtime.syncRepairExecution({
        record: lease!,
      }),
      {
        message:
          /repair execution sync could not update run because its state changed/,
      }
    );
  } finally {
    getBySourceStub.restore();
  }

  const rows = await db.$queryRaw<
    Array<{
      runActorId: string;
      runStatus: string;
      runtimeExecutor: string | null;
      runningTimelineCount: number;
    }>
  >`
    SELECT
      r.actor_id AS "runActorId",
      r.status AS "runStatus",
      s.output_summary ->> ${'runtimeExecutor'} AS "runtimeExecutor",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.status = ${'running'}
      ) AS "runningTimelineCount"
    FROM ai_agent_runs r
    JOIN ai_agent_steps s ON s.run_id = r.id
    WHERE r.id = ${staleExisting!.id}
      AND s.step_key = ${'repair_execution'}
  `;
  t.deepEqual(rows, [
    {
      runActorId: waitingRecord.actorId,
      runStatus: 'queued',
      runtimeExecutor: 'queued_repair_execution_worker',
      runningTimelineCount: 0,
    },
  ]);
});

test('repair execution Agent Runtime sync fails closed when linked step snapshot changes before update', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair sync step drift';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;
  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const models = app.get(Models);
  const staleExisting = await models.copilotAgentRuntime.getBySource(
    workspace.id,
    'repair_execution_request',
    waitingRecord.id
  );
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'queued');
  const staleStep = staleExisting?.steps.find(
    step => step.stepKey === 'repair_execution'
  );
  t.truthy(staleStep);
  const driftedAt = new Date(staleStep!.updatedAt.getTime() + 60_000);
  const driftedRows = await db.$executeRaw`
    UPDATE ai_agent_steps
    SET updated_at = ${driftedAt}
    WHERE workspace_id = ${workspace.id}
      AND id = ${staleStep!.id}
  `;
  t.is(driftedRows, 1);

  const lease = await models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-sync-stale-step-worker',
  });
  t.truthy(lease);
  t.is(lease?.status, 'running');

  const runtime = models.copilotAgentRuntime;
  const originalGetBySource = runtime.getBySource.bind(runtime);
  let returnedStaleRecord = false;
  const getBySourceStub = Sinon.stub(runtime, 'getBySource').callsFake(
    async (workspaceId: string, sourceType: string, sourceId: string) => {
      if (
        !returnedStaleRecord &&
        workspaceId === workspace.id &&
        sourceType === 'repair_execution_request' &&
        sourceId === waitingRecord.id
      ) {
        returnedStaleRecord = true;
        return staleExisting;
      }
      return await originalGetBySource(workspaceId, sourceType, sourceId);
    }
  );
  try {
    await t.throwsAsync(
      runtime.syncRepairExecution({
        record: lease!,
      }),
      {
        message:
          /repair execution sync could not update step because its state changed/,
      }
    );
  } finally {
    getBySourceStub.restore();
  }

  const rows = await db.$queryRaw<
    Array<{
      runStatus: string;
      stepStatus: string;
      stepUpdatedAt: Date;
      runtimeExecutor: string | null;
      runningTimelineCount: number;
    }>
  >`
    SELECT
      r.status AS "runStatus",
      s.status AS "stepStatus",
      s.updated_at AS "stepUpdatedAt",
      s.output_summary ->> ${'runtimeExecutor'} AS "runtimeExecutor",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.status = ${'running'}
      ) AS "runningTimelineCount"
    FROM ai_agent_runs r
    JOIN ai_agent_steps s ON s.run_id = r.id
    WHERE r.id = ${staleExisting!.id}
      AND s.id = ${staleStep!.id}
  `;
  t.deepEqual(rows, [
    {
      runStatus: 'queued',
      stepStatus: 'pending',
      stepUpdatedAt: driftedAt,
      runtimeExecutor: 'queued_repair_execution_worker',
      runningTimelineCount: 0,
    },
  ]);
});

test('repair execution Agent Runtime sync fails closed when linked step snapshot identity changes before update', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const driftActor = await app.createUser();
  const promptName = 'Repair sync step identity drift';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;
  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const models = app.get(Models);
  const staleExisting = await models.copilotAgentRuntime.getBySource(
    workspace.id,
    'repair_execution_request',
    waitingRecord.id
  );
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'queued');
  const staleStep = staleExisting?.steps.find(
    step => step.stepKey === 'repair_execution'
  );
  t.truthy(staleStep);

  const lease = await models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-sync-stale-step-identity-worker',
  });
  t.truthy(lease);
  t.is(lease?.status, 'running');

  const runtime = models.copilotAgentRuntime;
  const originalGetBySource = runtime.getBySource.bind(runtime);
  let returnedStaleRecord = false;
  const getBySourceStub = Sinon.stub(runtime, 'getBySource').callsFake(
    async (workspaceId: string, sourceType: string, sourceId: string) => {
      if (
        !returnedStaleRecord &&
        workspaceId === workspace.id &&
        sourceType === 'repair_execution_request' &&
        sourceId === waitingRecord.id
      ) {
        returnedStaleRecord = true;
        return {
          ...staleExisting!,
          steps: staleExisting!.steps.map(step =>
            step.id === staleStep!.id
              ? {
                  ...step,
                  actorId: driftActor.id,
                }
              : step
          ),
        };
      }
      return await originalGetBySource(workspaceId, sourceType, sourceId);
    }
  );
  try {
    await t.throwsAsync(
      runtime.syncRepairExecution({
        record: lease!,
      }),
      {
        message:
          /repair execution sync could not update step because its state changed/,
      }
    );
  } finally {
    getBySourceStub.restore();
  }

  const rows = await db.$queryRaw<
    Array<{
      runningTimelineCount: number;
      stepActorId: string;
      stepStatus: string;
      runtimeExecutor: string | null;
    }>
  >`
    SELECT
      s.actor_id AS "stepActorId",
      s.status AS "stepStatus",
      s.output_summary ->> ${'runtimeExecutor'} AS "runtimeExecutor",
      (
        SELECT COUNT(*)::int
        FROM ai_agent_timeline_events e
        WHERE e.run_id = r.id
          AND e.status = ${'running'}
      ) AS "runningTimelineCount"
    FROM ai_agent_runs r
    JOIN ai_agent_steps s ON s.run_id = r.id
    WHERE r.id = ${staleExisting!.id}
      AND s.id = ${staleStep!.id}
  `;
  t.deepEqual(rows, [
    {
      runningTimelineCount: 0,
      runtimeExecutor: 'queued_repair_execution_worker',
      stepActorId: waitingRecord.actorId,
      stepStatus: 'pending',
    },
  ]);
});

test('approval decision fails closed when the request state changes before update', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair stale approval prompt';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  const repairExecutionModel = app.get(Models).copilotRepairExecution;
  const staleExisting = await repairExecutionModel.get(
    workspace.id,
    waitingRecord.id
  );
  t.truthy(staleExisting);
  const externallyDecidedAt = new Date();
  await db.$transaction(async tx => {
    await tx.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET
        status = ${'queued'},
        approval_state = ${'approved'},
        runtime_result = ${JSON.stringify({
          version: 'repair-execution-runtime-result/v1',
          executor: 'queued_repair_execution_worker',
          sideEffectsApplied: false,
          message:
            'Approval accepted; repair execution queued for worker runtime.',
        })}::jsonb,
        queued_at = ${externallyDecidedAt},
        updated_at = ${externallyDecidedAt}
      WHERE id = ${waitingRecord.id}
    `;
    await tx.$executeRaw`
      INSERT INTO ai_repair_execution_audit_events (
        id,
        execution_request_id,
        workspace_id,
        actor_id,
        event_type,
        event_fingerprint,
        metadata,
        created_at
      )
      VALUES (
        ${'repair-stale-approval-existing-approved'},
        ${waitingRecord.id},
        ${workspace.id},
        ${waitingRecord.actorId},
        ${'approval_approved'},
        ${'repair-stale-approval-existing-approved-fp'},
        ${JSON.stringify({
          decision: 'approve',
          reason: 'external approval before stale model update',
        })}::jsonb,
        ${externallyDecidedAt}
      )
    `;
    await tx.$executeRaw`
      INSERT INTO ai_repair_execution_audit_events (
        id,
        execution_request_id,
        workspace_id,
        actor_id,
        event_type,
        event_fingerprint,
        metadata,
        created_at
      )
      VALUES (
        ${'repair-stale-approval-existing-queued'},
        ${waitingRecord.id},
        ${workspace.id},
        ${waitingRecord.actorId},
        ${'queued'},
        ${'repair-stale-approval-existing-queued-fp'},
        ${JSON.stringify({
          approvalState: 'approved',
          sideEffectsApplied: false,
          queuedAt: externallyDecidedAt.toISOString(),
        })}::jsonb,
        ${externallyDecidedAt}
      )
    `;
  });

  const model = repairExecutionModel;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.decideApproval({
        workspaceId: workspace.id,
        actorId: waitingRecord.actorId,
        id: waitingRecord.id,
        decision: 'approve',
        reason: 'stale approval should not audit',
      }),
      {
        message: /could not be decided because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      status: string;
      approvalAuditCount: number;
      queuedAuditCount: number;
    }>
  >`
    SELECT
      r.status,
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'approval_approved'}
      ) AS "approvalAuditCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'queued'}
      ) AS "queuedAuditCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      status: 'queued',
      approvalAuditCount: 1,
      queuedAuditCount: 1,
    },
  ]);
});

test('approval decision fails closed when waiting snapshot evidence changes before update', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair stale approval evidence';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  const repairExecutionModel = app.get(Models).copilotRepairExecution;
  const staleExisting = await repairExecutionModel.get(
    workspace.id,
    waitingRecord.id
  );
  t.truthy(staleExisting);

  await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET updated_at = updated_at + interval '1 second'
    WHERE id = ${waitingRecord.id}
  `;

  const model = repairExecutionModel;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.decideApproval({
        workspaceId: workspace.id,
        actorId: waitingRecord.actorId,
        id: waitingRecord.id,
        decision: 'approve',
        reason: 'stale approval evidence should not audit',
      }),
      {
        message: /could not be decided because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }
  t.true(returnedStaleRecord);

  const rows = await db.$queryRaw<
    Array<{
      status: string;
      approvalState: string;
      approvalAuditCount: number;
      queuedAuditCount: number;
    }>
  >`
    SELECT
      r.status,
      r.approval_state AS "approvalState",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'approval_approved'}
      ) AS "approvalAuditCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'queued'}
      ) AS "queuedAuditCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      status: 'waiting_approval',
      approvalState: 'waiting',
      approvalAuditCount: 0,
      queuedAuditCount: 0,
    },
  ]);
});

test('repair execution worker completes after a durable prompt registry side effect was already written', async t => {
  const { app, db, worker } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair side effect resume';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
        reason: 'simulate crash after side effect',
      },
    },
  });

  const payloadRows = await db.$queryRaw<
    Array<{ executorPayload: Record<string, unknown> }>
  >`
    SELECT executor_payload AS "executorPayload"
    FROM ai_repair_execution_requests
    WHERE id = ${waitingRecord.id}
  `;
  const prewritten = await app
    .get(Models)
    .copilotPromptRegistryRevision.publishWorkspaceRepairRevision({
      workspaceId: workspace.id,
      actorId: waitingRecord.actorId,
      promptName,
      executionRequestId: waitingRecord.id,
      requestFingerprint: waitingRecord.requestFingerprint,
      candidateEvidenceSetFingerprint:
        waitingRecord.candidateEvidenceSetFingerprint,
      taskRouteEvidenceSetFingerprint:
        waitingRecord.taskRouteEvidenceSetFingerprint,
      repairJobFingerprint: waitingRecord.repairJobFingerprint,
      approvalRecordFingerprint: waitingRecord.approvalRecordFingerprint,
      payload: payloadRows[0]?.executorPayload ?? {},
    });

  t.is(prewritten.id, `prompt-revision-${waitingRecord.id}`);

  const signal = await worker.runRepairExecution({
    workspaceId: workspace.id,
    executionRequestId: waitingRecord.id,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const completedRows = await db.$queryRaw<
    Array<{
      runtimeResult: {
        sideEffectRecordId?: string;
        sideEffectsApplied: boolean;
      };
      status: string;
    }>
  >`
    SELECT runtime_result AS "runtimeResult", status
    FROM ai_repair_execution_requests
    WHERE id = ${waitingRecord.id}
  `;
  t.is(completedRows[0]?.status, 'completed');
  t.true(completedRows[0]?.runtimeResult.sideEffectsApplied);
  t.is(
    completedRows[0]?.runtimeResult.sideEffectRecordId,
    `prompt-revision-${waitingRecord.id}`
  );

  const revisionRows = await db.$queryRaw<
    Array<{ count: number; fingerprint: string }>
  >`
    SELECT COUNT(*)::int AS "count", MAX(fingerprint) AS fingerprint
    FROM ai_prompt_registry_revisions
    WHERE prompt_name = ${promptName}
      AND workspace_id = ${workspace.id}
      AND revision = ${`repair-${waitingRecord.id}`}
  `;
  t.deepEqual(revisionRows, [
    {
      count: 1,
      fingerprint: prewritten.fingerprint,
    },
  ]);
});

test('repair execution worker fails instead of completing against a conflicting durable side effect revision', async t => {
  const { app, db, owner, worker } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair side effect conflict';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
        reason: 'validate side effect conflict handling',
      },
    },
  });

  await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET worker_max_attempts = 1
    WHERE id = ${waitingRecord.id}
  `;

  await db.$executeRaw`
    INSERT INTO ai_prompt_registry_revisions (
      id,
      prompt_name,
      scope_type,
      workspace_id,
      actor_id,
      revision,
      status,
      fingerprint,
      fallback_source_chain,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      ${`prompt-revision-conflict-${waitingRecord.id}`},
      ${promptName},
      ${'workspace'},
      ${workspace.id},
      ${owner.id},
      ${`repair-${waitingRecord.id}`},
      ${'active'},
      ${'conflictfeed0001'},
      ${JSON.stringify([])}::jsonb,
      ${JSON.stringify({
        version: 'prompt-registry-revision-conflict-test/v1',
        executionRequestId: waitingRecord.id,
      })}::jsonb,
      ${new Date('2026-06-22T10:00:00.000Z')},
      ${new Date('2026-06-22T10:00:00.000Z')}
    )
  `;

  const signal = await worker.runRepairExecution({
    workspaceId: workspace.id,
    executionRequestId: waitingRecord.id,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const failedRows = await db.$queryRaw<
    Array<{
      failureCode: string | null;
      failureMessage: string | null;
      runtimeResult: {
        sideEffectsApplied: boolean;
      };
      status: string;
      workerAttempt: number;
    }>
  >`
    SELECT
      failure_code AS "failureCode",
      failure_message AS "failureMessage",
      runtime_result AS "runtimeResult",
      status,
      worker_attempt AS "workerAttempt"
    FROM ai_repair_execution_requests
    WHERE id = ${waitingRecord.id}
  `;
  t.like(failedRows[0], {
    failureCode: 'side_effect_revision_conflict',
    status: 'failed',
    workerAttempt: 1,
  });
  t.regex(
    failedRows[0]?.failureMessage ?? '',
    /already exists with different fingerprint|revision conflict reused mismatched row evidence/
  );
  t.false(failedRows[0]?.runtimeResult.sideEffectsApplied);

  const auditRows = await db.$queryRaw<Array<{ eventType: string }>>`
    SELECT event_type AS "eventType"
    FROM ai_repair_execution_audit_events
    WHERE execution_request_id = ${waitingRecord.id}
    ORDER BY created_at ASC
  `;
  t.deepEqual(
    auditRows.map(row => row.eventType),
    [
      'requested',
      'waiting_approval',
      'approval_approved',
      'queued',
      'running',
      'failed',
    ]
  );
});

test('approval rejection cancels a waiting repair execution without side effects', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair rejection decision prompt';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  const decisionResult = await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'reject',
        reason: 'not approved in e2e',
      },
    },
  });
  const decided = decisionResult.decideCopilotRepairExecutionApproval;

  t.is(decided.status, 'cancelled');
  t.is(decided.approvalState, 'rejected');
  t.is(decided.runtimeResult.executor, 'approval_decision_gate');
  t.false(decided.runtimeResult.sideEffectsApplied);
  t.is(decided.agentRun.status, 'cancelled');
  t.is(decided.agentRun.steps[0].status, 'skipped');
  t.is(decided.agentRun.steps[0].stepType, 'approval');
  t.is(decided.agentRun.steps[0].outputSummary.approvalState, 'rejected');
  t.deepEqual(
    decided.agentRun.timelineEvents.map(
      (event: { eventType: string; status: string }) => [
        event.eventType,
        event.status,
      ]
    ),
    [
      ['run_status', 'waiting_approval'],
      ['approval_step', 'waiting_approval'],
      ['run_status', 'cancelled'],
      ['approval_step', 'skipped'],
    ]
  );

  const auditRows = await db.$queryRaw<Array<{ eventType: string }>>`
    SELECT event_type AS "eventType"
    FROM ai_repair_execution_audit_events
    WHERE execution_request_id = ${waitingRecord.id}
    ORDER BY created_at ASC
  `;
  t.deepEqual(
    auditRows.map(row => row.eventType),
    ['requested', 'waiting_approval', 'approval_rejected', 'cancelled']
  );
});

test('manual control cancels a queued repair execution with audit and Agent Runtime sync', async t => {
  const { app, db, worker } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair manual cancel prompt';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const controlResult = await app.gql({
    query: controlMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        action: 'cancel',
        reason: '  operator cancelled queued repair  ',
      },
    },
  });
  const cancelled = controlResult.controlCopilotRepairExecution;

  t.is(cancelled.status, 'cancelled');
  t.is(cancelled.approvalState, 'approved');
  t.truthy(cancelled.completedAt);
  t.is(cancelled.workerLeaseId, null);
  t.is(cancelled.workerLeaseExpiresAt, null);
  t.is(cancelled.runtimeResult.executor, 'manual_repair_execution_control');
  t.false(cancelled.runtimeResult.sideEffectsApplied);
  t.regex(cancelled.runtimeResult.message, /operator cancelled queued repair/);
  t.is(cancelled.agentRun.id, waitingRecord.agentRun.id);
  t.is(cancelled.agentRun.status, 'cancelled');
  t.is(cancelled.agentRun.steps[0].status, 'skipped');
  t.is(cancelled.agentRun.steps[0].stepType, 'approval');
  t.is(
    cancelled.agentRun.steps[0].outputSummary.runtimeExecutor,
    'manual_repair_execution_control'
  );
  t.deepEqual(
    cancelled.agentRun.timelineEvents
      .slice(-2)
      .map((event: { eventType: string; status: string; summary: string }) => [
        event.eventType,
        event.status,
        event.summary,
      ]),
    [
      ['run_status', 'cancelled', 'Repair execution run cancelled'],
      ['approval_step', 'skipped', 'Repair execution manually cancelled'],
    ]
  );

  const revisionRows = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count"
    FROM ai_prompt_registry_revisions
    WHERE id = ${`prompt-revision-${waitingRecord.id}`}
  `;
  t.is(revisionRows[0]?.count, 0);

  const signal = await worker.runRepairExecution({
    workspaceId: workspace.id,
    executionRequestId: waitingRecord.id,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const afterWorkerRows = await db.$queryRaw<
    Array<{ status: string; workerAttempt: number }>
  >`
    SELECT status, worker_attempt AS "workerAttempt"
    FROM ai_repair_execution_requests
    WHERE id = ${waitingRecord.id}
  `;
  t.deepEqual(afterWorkerRows, [
    {
      status: 'cancelled',
      workerAttempt: 0,
    },
  ]);

  const auditRows = await db.$queryRaw<
    Array<{
      eventType: string;
      metadata: { controlAction?: string; reason?: string | null };
    }>
  >`
    SELECT event_type AS "eventType", metadata
    FROM ai_repair_execution_audit_events
    WHERE execution_request_id = ${waitingRecord.id}
    ORDER BY created_at ASC
  `;
  t.deepEqual(
    auditRows.map(row => row.eventType),
    [
      'requested',
      'waiting_approval',
      'approval_approved',
      'queued',
      'cancelled',
    ]
  );
  t.is(auditRows.at(-1)?.metadata.controlAction, 'cancel');
  t.is(auditRows.at(-1)?.metadata.reason, 'operator cancelled queued repair');

  await t.throwsAsync(
    app.gql({
      query: controlMutation,
      variables: {
        input: {
          workspaceId: workspace.id,
          executionRequestId: waitingRecord.id,
          action: 'retry',
        },
      },
    })
  );
});

test('manual control requests running cancellation and worker cooperatively cancels before side effects', async t => {
  const { app, db, worker } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const promptName = 'Repair running cancel';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const runtime = models.copilotAgentRuntime;
  t.truthy(runtime);
  if (!runtime) {
    throw new Error('Agent Runtime model missing');
  }
  const originalSync = runtime.syncRepairExecution.bind(runtime);
  type RunningControlRecord = {
    runtimeResult: { executor?: string };
    status: string;
    workerLeaseId: string | null;
  };
  let runningControlRecord: RunningControlRecord | null = null;
  const getRunningControlRecord = (): RunningControlRecord | null =>
    runningControlRecord;
  const syncStub = Sinon.stub(runtime, 'syncRepairExecution').callsFake(
    async (input: Parameters<typeof runtime.syncRepairExecution>[0]) => {
      const synced = await originalSync(input);
      if (
        input.record.id === waitingRecord.id &&
        input.record.status === 'running' &&
        !runningControlRecord
      ) {
        const controlResult = await app.gql({
          query: controlMutation,
          variables: {
            input: {
              workspaceId: workspace.id,
              executionRequestId: waitingRecord.id,
              action: 'cancel',
              reason: '  stop before side effects  ',
            },
          },
        });
        runningControlRecord = controlResult.controlCopilotRepairExecution;
      }
      return synced;
    }
  );

  try {
    const signal = await worker.runRepairExecution({
      workspaceId: workspace.id,
      executionRequestId: waitingRecord.id,
    });
    t.is(signal, JOB_SIGNAL.Done);
  } finally {
    syncStub.restore();
  }

  const runningControlSnapshot = getRunningControlRecord();
  t.truthy(runningControlSnapshot);
  if (!runningControlSnapshot) {
    throw new Error('Expected running repair control snapshot');
  }
  t.is(runningControlSnapshot.status, 'running');
  t.is(
    runningControlSnapshot.runtimeResult.executor,
    'repair_execution_worker'
  );
  t.truthy(runningControlSnapshot.workerLeaseId);

  const rows = await db.$queryRaw<
    Array<{
      completedAt: Date | null;
      runtimeResult: {
        executor?: string;
        message?: string;
        sideEffectsApplied?: boolean;
      };
      sideEffectCount: number;
      status: string;
      workerAttempt: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.completed_at AS "completedAt",
      r.runtime_result AS "runtimeResult",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_side_effects side_effect
        WHERE side_effect.execution_request_id = r.id
      ) AS "sideEffectCount",
      r.status,
      r.worker_attempt AS "workerAttempt",
      r.worker_lease_id AS "workerLeaseId"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.like(rows[0], {
    runtimeResult: {
      executor: 'repair_execution_worker_cooperative_cancel',
      sideEffectsApplied: false,
    },
    sideEffectCount: 0,
    status: 'cancelled',
    workerAttempt: 1,
    workerLeaseId: null,
  });
  t.truthy(rows[0]?.completedAt);
  t.regex(rows[0]?.runtimeResult.message ?? '', /stop before side effects/);

  const revisionRows = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count"
    FROM ai_prompt_registry_revisions
    WHERE id = ${`prompt-revision-${waitingRecord.id}`}
  `;
  t.deepEqual(revisionRows, [{ count: 0 }]);

  const auditRows = await db.$queryRaw<
    Array<{ eventType: string; metadata: Record<string, unknown> }>
  >`
    SELECT event_type AS "eventType", metadata
    FROM ai_repair_execution_audit_events
    WHERE execution_request_id = ${waitingRecord.id}
    ORDER BY created_at ASC, id ASC
  `;
  t.deepEqual(
    auditRows.map(row => row.eventType),
    [
      'requested',
      'waiting_approval',
      'approval_approved',
      'queued',
      'running',
      'cancel_requested',
      'cancelled',
    ]
  );
  t.like(
    auditRows.find(row => row.eventType === 'cancel_requested')?.metadata,
    {
      controlAction: 'cancel',
      previousStatus: 'running',
      previousApprovalState: 'approved',
      reason: 'stop before side effects',
      workerAttempt: 1,
    }
  );
  t.like(auditRows.at(-1)?.metadata, {
    controlAction: 'cancel',
    cooperative: true,
    previousStatus: 'running',
    previousApprovalState: 'approved',
    reason: 'stop before side effects',
    sideEffectsApplied: false,
    workerAttempt: 1,
  });

  const agentRun = await runtime.getBySource(
    workspace.id,
    'repair_execution_request',
    waitingRecord.id
  );
  t.is(agentRun?.status, 'cancelled');
  t.is(agentRun?.steps[0]?.status, 'skipped');
  t.is(
    agentRun?.steps[0]?.outputSummary.runtimeExecutor,
    'repair_execution_worker_cooperative_cancel'
  );
  t.deepEqual(
    agentRun?.timelineEvents
      .slice(-2)
      .map(event => [event.eventType, event.status, event.summary]),
    [
      ['run_status', 'cancelled', 'Repair execution run cancelled'],
      [
        'approval_step',
        'skipped',
        'Repair execution cooperatively cancelled before side effects',
      ],
    ]
  );
});

test('stale running cancellation request is not consumed by a later worker lease', async t => {
  const { app, db, worker } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const promptName = 'Repair stale coop cancel';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const leased = await models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'stale-running-cancel-request-worker',
    leaseMs: 60_000,
  });
  t.truthy(leased);
  t.is(leased?.status, 'running');

  const controlResult = await app.gql({
    query: controlMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        action: 'cancel',
        reason: 'first lease cancellation request',
      },
    },
  });
  t.is(controlResult.controlCopilotRepairExecution.status, 'running');

  const failure = await models.copilotRepairExecution.failWorkerExecution({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerLeaseId: 'stale-running-cancel-request-worker',
    workerAttempt: leased!.workerAttempt,
    code: 'repair_execution_worker_failed',
    message: 'transient failure after stale cancel request',
    retryable: true,
  });
  t.true(failure.retryScheduled);
  t.is(failure.record.status, 'queued');

  const signal = await worker.runRepairExecution({
    workspaceId: workspace.id,
    executionRequestId: waitingRecord.id,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const rows = await db.$queryRaw<
    Array<{
      cancelRequestedCount: number;
      sideEffectCount: number;
      status: string;
      workerAttempt: number;
    }>
  >`
    SELECT
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events event
        WHERE event.execution_request_id = r.id
          AND event.event_type = ${'cancel_requested'}
      ) AS "cancelRequestedCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_side_effects side_effect
        WHERE side_effect.execution_request_id = r.id
      ) AS "sideEffectCount",
      r.status,
      r.worker_attempt AS "workerAttempt"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      cancelRequestedCount: 1,
      sideEffectCount: 1,
      status: 'completed',
      workerAttempt: 2,
    },
  ]);
});

test('running cancellation request fails closed when request snapshot changes before audit', async t => {
  const { app, db } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const promptName = 'Repair stale run cancel';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const lease = await models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-stale-running-cancel-snapshot-worker',
    leaseMs: 60_000,
  });
  t.truthy(lease);
  t.is(lease?.status, 'running');
  const staleExisting = await models.copilotRepairExecution.get(
    workspace.id,
    waitingRecord.id
  );
  t.truthy(staleExisting);
  const driftedAt = new Date(staleExisting!.updatedAt.getTime() + 60_000);
  const driftedRows = await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET updated_at = ${driftedAt}
    WHERE id = ${waitingRecord.id}
      AND status = ${'running'}
      AND worker_lease_id = ${lease?.workerLeaseId}
      AND worker_attempt = ${lease?.workerAttempt}
  `;
  t.is(driftedRows, 1);

  const model = models.copilotRepairExecution;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.controlExecution({
        workspaceId: workspace.id,
        actorId: waitingRecord.actorId,
        id: waitingRecord.id,
        action: 'cancel',
        reason: 'stale running cancel should not audit',
      }),
      {
        message: /could not request cancellation because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      cancelRequestedCount: number;
      status: string;
      updatedAt: Date;
      workerAttempt: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.status,
      r.updated_at AS "updatedAt",
      r.worker_attempt AS "workerAttempt",
      r.worker_lease_id AS "workerLeaseId",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events event
        WHERE event.execution_request_id = r.id
          AND event.event_type = ${'cancel_requested'}
      ) AS "cancelRequestedCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      cancelRequestedCount: 0,
      status: 'running',
      updatedAt: driftedAt,
      workerAttempt: lease!.workerAttempt,
      workerLeaseId: lease!.workerLeaseId,
    },
  ]);
});

test('leased cancellation consumption fails closed when request snapshot changes before terminal update', async t => {
  const { app, db } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const promptName = 'Repair consume drift';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const lease = await models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-stale-cancel-consume-worker',
    leaseMs: 60_000,
  });
  t.truthy(lease);
  t.is(lease?.status, 'running');
  await app.gql({
    query: controlMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        action: 'cancel',
        reason: 'consume stale cancellation',
      },
    },
  });

  const staleExisting = await models.copilotRepairExecution.get(
    workspace.id,
    waitingRecord.id
  );
  t.truthy(staleExisting);
  const driftedAt = new Date(staleExisting!.updatedAt.getTime() + 60_000);
  const driftedRows = await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET updated_at = ${driftedAt}
    WHERE id = ${waitingRecord.id}
      AND status = ${'running'}
      AND worker_lease_id = ${lease?.workerLeaseId}
      AND worker_attempt = ${lease?.workerAttempt}
  `;
  t.is(driftedRows, 1);

  const model = models.copilotRepairExecution;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.cancelLeasedExecutionIfCancellationRequested({
        workspaceId: workspace.id,
        id: waitingRecord.id,
        workerLeaseId: lease!.workerLeaseId!,
        workerAttempt: lease!.workerAttempt,
      }),
      {
        message: /could not be cancelled because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      cancelRequestedCount: number;
      cancelledCount: number;
      status: string;
      updatedAt: Date;
      workerAttempt: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.status,
      r.updated_at AS "updatedAt",
      r.worker_attempt AS "workerAttempt",
      r.worker_lease_id AS "workerLeaseId",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events event
        WHERE event.execution_request_id = r.id
          AND event.event_type = ${'cancel_requested'}
      ) AS "cancelRequestedCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events event
        WHERE event.execution_request_id = r.id
          AND event.event_type = ${'cancelled'}
      ) AS "cancelledCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      cancelRequestedCount: 1,
      cancelledCount: 0,
      status: 'running',
      updatedAt: driftedAt,
      workerAttempt: lease!.workerAttempt,
      workerLeaseId: lease!.workerLeaseId,
    },
  ]);
});

test('manual cancel fails closed when the request state changes before update', async t => {
  const { app, db } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const promptName = 'Repair stale cancel prompt';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const staleExisting = await models.copilotRepairExecution.get(
    workspace.id,
    waitingRecord.id
  );
  t.truthy(staleExisting);
  const lease = await models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-stale-cancel-state-worker',
  });
  t.truthy(lease);
  t.is(lease?.status, 'running');
  const model = models.copilotRepairExecution;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.controlExecution({
        workspaceId: workspace.id,
        actorId: waitingRecord.actorId,
        id: waitingRecord.id,
        action: 'cancel',
        reason: 'stale cancel should not audit',
      }),
      {
        message: /could not be cancelled because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{ status: string; cancelledAuditCount: number }>
  >`
    SELECT
      r.status,
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'cancelled'}
      ) AS "cancelledAuditCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      status: 'running',
      cancelledAuditCount: 0,
    },
  ]);
});

test('manual cancel fails closed when queued snapshot evidence changes before update', async t => {
  const { app, db } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const promptName = 'Repair cancel evidence';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const staleExisting = await models.copilotRepairExecution.get(
    workspace.id,
    waitingRecord.id
  );
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'queued');

  const driftedAt = new Date(staleExisting!.updatedAt.getTime() + 60_000);
  const driftedRows = await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET updated_at = ${driftedAt}
    WHERE id = ${waitingRecord.id}
      AND status = ${'queued'}
  `;
  t.is(driftedRows, 1);

  const model = models.copilotRepairExecution;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.controlExecution({
        workspaceId: workspace.id,
        actorId: waitingRecord.actorId,
        id: waitingRecord.id,
        action: 'cancel',
        reason: 'stale cancel evidence should not audit',
      }),
      {
        message: /could not be cancelled because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      cancelledAuditCount: number;
      status: string;
      updatedAt: Date;
    }>
  >`
    SELECT
      r.status,
      r.updated_at AS "updatedAt",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'cancelled'}
      ) AS "cancelledAuditCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      cancelledAuditCount: 0,
      status: 'queued',
      updatedAt: driftedAt,
    },
  ]);
});

test('manual control recovers an expired running repair execution lease', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair stale lease prompt';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const leased = await app
    .get(Models)
    .copilotRepairExecution.acquireWorkerLease({
      workspaceId: workspace.id,
      id: waitingRecord.id,
      workerId: 'stale-worker-for-e2e',
      leaseMs: 60_000,
    });
  t.truthy(leased);
  t.is(leased?.status, 'running');
  await app.get(Models).copilotAgentRuntime?.syncRepairExecution({
    record: leased!,
  });

  await t.throwsAsync(
    app.gql({
      query: controlMutation,
      variables: {
        input: {
          workspaceId: workspace.id,
          executionRequestId: waitingRecord.id,
          action: 'recover_stale',
        },
      },
    })
  );

  const expiredLeaseAt = new Date(Date.now() - 60_000);
  await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET worker_lease_expires_at = ${expiredLeaseAt}
    WHERE id = ${waitingRecord.id}
  `;

  const controlResult = await app.gql({
    query: controlMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        action: 'recover_stale',
        reason: 'worker heartbeat expired',
      },
    },
  });
  const recovered = controlResult.controlCopilotRepairExecution;

  t.is(recovered.status, 'queued');
  t.is(recovered.approvalState, 'approved');
  t.is(recovered.failureCode, null);
  t.is(recovered.failureMessage, null);
  t.is(recovered.completedAt, null);
  t.is(recovered.workerAttempt, 1);
  t.is(recovered.workerMaxAttempts, 3);
  t.is(recovered.workerLeaseId, null);
  t.is(recovered.workerLeaseExpiresAt, null);
  t.is(recovered.runtimeResult.executor, 'manual_repair_execution_control');
  t.regex(
    recovered.runtimeResult.message,
    /recovered; repair execution requeued/
  );
  t.is(recovered.agentRun.status, 'queued');
  t.is(recovered.agentRun.steps[0].status, 'pending');
  t.is(
    recovered.agentRun.steps[0].outputSummary.runtimeExecutor,
    'manual_repair_execution_control'
  );

  const auditRows = await db.$queryRaw<
    Array<{ eventType: string; metadata: Record<string, unknown> }>
  >`
    SELECT event_type AS "eventType", metadata
    FROM ai_repair_execution_audit_events
    WHERE execution_request_id = ${waitingRecord.id}
    ORDER BY created_at ASC
  `;
  t.deepEqual(
    auditRows.map(row => row.eventType),
    [
      'requested',
      'waiting_approval',
      'approval_approved',
      'queued',
      'running',
      'stale_recovered',
      'queued',
    ]
  );
  t.like(auditRows.find(row => row.eventType === 'stale_recovered')?.metadata, {
    controlAction: 'recover_stale',
    recoverySource: 'manual',
    previousWorkerLeaseId: 'stale-worker-for-e2e',
    reason: 'worker heartbeat expired',
    retryScheduled: true,
    nextStatus: 'queued',
  });
});

test('manual stale recovery fails closed when running snapshot evidence changes before update', async t => {
  const { app, db } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const promptName = 'Repair recovery evidence';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const leased = await models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-stale-recovery-evidence-worker',
    leaseMs: 60_000,
  });
  t.truthy(leased);
  t.is(leased?.status, 'running');

  const expiredLeaseAt = new Date(Date.now() - 60_000);
  await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET worker_lease_expires_at = ${expiredLeaseAt}
    WHERE id = ${waitingRecord.id}
  `;

  const staleExisting = await models.copilotRepairExecution.get(
    workspace.id,
    waitingRecord.id
  );
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'running');
  t.is(staleExisting?.workerLeaseId, 'repair-stale-recovery-evidence-worker');

  const driftedAt = new Date(staleExisting!.updatedAt.getTime() + 60_000);
  const driftedRows = await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET updated_at = ${driftedAt}
    WHERE id = ${waitingRecord.id}
      AND status = ${'running'}
  `;
  t.is(driftedRows, 1);

  const model = models.copilotRepairExecution;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.controlExecution({
        workspaceId: workspace.id,
        actorId: waitingRecord.actorId,
        id: waitingRecord.id,
        action: 'recover_stale',
        reason: 'stale recovery evidence should not audit',
      }),
      {
        message: /stale lease could not be recovered because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      recoveredQueuedAuditCount: number;
      staleRecoveredAuditCount: number;
      status: string;
      updatedAt: Date;
      workerLeaseExpiresAt: Date | null;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.status,
      r.updated_at AS "updatedAt",
      r.worker_lease_id AS "workerLeaseId",
      r.worker_lease_expires_at AS "workerLeaseExpiresAt",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'stale_recovered'}
      ) AS "staleRecoveredAuditCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'queued'}
          AND e.metadata ->> ${'controlAction'} = ${'recover_stale'}
      ) AS "recoveredQueuedAuditCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      recoveredQueuedAuditCount: 0,
      staleRecoveredAuditCount: 0,
      status: 'running',
      updatedAt: driftedAt,
      workerLeaseExpiresAt: expiredLeaseAt,
      workerLeaseId: 'repair-stale-recovery-evidence-worker',
    },
  ]);
});

test('repair execution worker does not reacquire expired running leases directly', async t => {
  const { app, db, worker } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair lease boundary';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const leased = await app
    .get(Models)
    .copilotRepairExecution.acquireWorkerLease({
      workspaceId: workspace.id,
      id: waitingRecord.id,
      workerId: 'expired-running-boundary-worker',
      leaseMs: 60_000,
    });
  t.truthy(leased);
  t.is(leased?.status, 'running');

  const expiredLeaseAt = new Date(Date.now() - 60_000);
  await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET worker_lease_expires_at = ${expiredLeaseAt}
    WHERE id = ${waitingRecord.id}
  `;

  const signal = await worker.runRepairExecution({
    workspaceId: workspace.id,
    executionRequestId: waitingRecord.id,
  });
  t.is(signal, JOB_SIGNAL.Done);

  const rows = await db.$queryRaw<
    Array<{
      auditTypes: string[];
      status: string;
      workerAttempt: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.status,
      r.worker_attempt AS "workerAttempt",
      r.worker_lease_id AS "workerLeaseId",
      ARRAY_AGG(e.event_type ORDER BY e.created_at ASC) AS "auditTypes"
    FROM ai_repair_execution_requests r
    LEFT JOIN ai_repair_execution_audit_events e
      ON e.execution_request_id = r.id
    WHERE r.id = ${waitingRecord.id}
    GROUP BY r.id
  `;
  t.deepEqual(rows, [
    {
      auditTypes: [
        'requested',
        'waiting_approval',
        'approval_approved',
        'queued',
        'running',
      ],
      status: 'running',
      workerAttempt: 1,
      workerLeaseId: 'expired-running-boundary-worker',
    },
  ]);
});

test('repair execution worker skips side effects after its lease is recovered', async t => {
  const { app, db, worker } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const promptName = 'Repair lease side fence';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const repairModel = models.copilotRepairExecution;
  const originalCancel =
    repairModel.cancelLeasedExecutionIfCancellationRequested.bind(repairModel);
  let recoveredBeforeSideEffect = false;
  const cancelStub = Sinon.stub(
    repairModel,
    'cancelLeasedExecutionIfCancellationRequested'
  ).callsFake(async input => {
    const cancelled = await originalCancel(input);
    if (!cancelled && !recoveredBeforeSideEffect) {
      recoveredBeforeSideEffect = true;
      await db.$executeRaw`
        UPDATE ai_repair_execution_requests
        SET worker_lease_expires_at = ${new Date(Date.now() - 60_000)}
        WHERE workspace_id = ${input.workspaceId}
          AND id = ${input.id}
          AND worker_lease_id = ${input.workerLeaseId}
      `;
      await repairModel.recoverExpiredWorkerLease({
        workspaceId: input.workspaceId,
        id: input.id,
        reason: 'lease recovered before side effect',
      });
    }
    return cancelled;
  });
  const publishStub = Sinon.stub(
    models.copilotPromptRegistryRevision,
    'publishWorkspaceRepairRevision'
  ).rejects(new Error('stale worker reached side effect publish'));

  try {
    const signal = await worker.runRepairExecution({
      workspaceId: workspace.id,
      executionRequestId: waitingRecord.id,
    });
    t.is(signal, JOB_SIGNAL.Done);
  } finally {
    cancelStub.restore();
    publishStub.restore();
  }

  t.true(recoveredBeforeSideEffect);
  t.false(publishStub.called);

  const rows = await db.$queryRaw<
    Array<{
      auditTypes: string[];
      completedAuditCount: number;
      failedAuditCount: number;
      revisionCount: number;
      runtimeResult: {
        executor: string;
        sideEffectsApplied: boolean;
      };
      sideEffectAuditCount: number;
      sideEffectLedgerCount: number;
      status: string;
      workerAttempt: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.status,
      r.runtime_result AS "runtimeResult",
      r.worker_attempt AS "workerAttempt",
      r.worker_lease_id AS "workerLeaseId",
      ARRAY_AGG(e.event_type ORDER BY e.created_at ASC, e.id ASC) AS "auditTypes",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events completed
        WHERE completed.execution_request_id = r.id
          AND completed.event_type = ${'completed'}
      ) AS "completedAuditCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events failed
        WHERE failed.execution_request_id = r.id
          AND failed.event_type = ${'failed'}
      ) AS "failedAuditCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events side_effect
        WHERE side_effect.execution_request_id = r.id
          AND side_effect.event_type = ${'side_effect_applied'}
      ) AS "sideEffectAuditCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_side_effects ledger
        WHERE ledger.execution_request_id = r.id
      ) AS "sideEffectLedgerCount",
      (
        SELECT COUNT(*)::int
        FROM ai_prompt_registry_revisions revisions
        WHERE revisions.id = ${`prompt-revision-${waitingRecord.id}`}
      ) AS "revisionCount"
    FROM ai_repair_execution_requests r
    JOIN ai_repair_execution_audit_events e
      ON e.execution_request_id = r.id
    WHERE r.id = ${waitingRecord.id}
    GROUP BY r.id
  `;
  t.deepEqual(rows, [
    {
      auditTypes: [
        'requested',
        'waiting_approval',
        'approval_approved',
        'queued',
        'running',
        'stale_recovered',
        'queued',
      ],
      completedAuditCount: 0,
      failedAuditCount: 0,
      revisionCount: 0,
      runtimeResult: {
        executor: 'repair_execution_stale_recovery_worker',
        message:
          'Expired running worker lease recovered; repair execution requeued.',
        sideEffectsApplied: false,
        version: 'repair-execution-runtime-result/v1',
      },
      sideEffectAuditCount: 0,
      sideEffectLedgerCount: 0,
      status: 'queued',
      workerAttempt: 1,
      workerLeaseId: null,
    },
  ]);
});

test('scheduled repair execution stale lease recovery requeues expired running requests', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair scheduled stale';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const leased = await app
    .get(Models)
    .copilotRepairExecution.acquireWorkerLease({
      workspaceId: workspace.id,
      id: waitingRecord.id,
      workerId: 'scheduled-stale-worker-for-e2e',
      leaseMs: 60_000,
    });
  t.truthy(leased);
  await app.get(Models).copilotAgentRuntime?.syncRepairExecution({
    record: leased!,
  });

  const expiredLeaseAt = new Date(Date.now() - 60_000);
  await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET worker_lease_expires_at = ${expiredLeaseAt}
    WHERE id = ${waitingRecord.id}
  `;

  const signal = await app
    .get(CopilotCronJobs)
    .recoverExpiredRepairExecutionLeases({ limit: 10 });
  t.is(signal, JOB_SIGNAL.Done);

  const recoveredRows = await db.$queryRaw<
    Array<{
      failureCode: string | null;
      runtimeResult: {
        executor: string;
        sideEffectsApplied: boolean;
      };
      status: string;
      workerAttempt: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      failure_code AS "failureCode",
      runtime_result AS "runtimeResult",
      status,
      worker_attempt AS "workerAttempt",
      worker_lease_id AS "workerLeaseId"
    FROM ai_repair_execution_requests
    WHERE id = ${waitingRecord.id}
  `;
  t.like(recoveredRows[0], {
    failureCode: null,
    status: 'queued',
    workerAttempt: 1,
    workerLeaseId: null,
  });
  t.is(
    recoveredRows[0]?.runtimeResult.executor,
    'repair_execution_stale_recovery_worker'
  );
  t.false(recoveredRows[0]?.runtimeResult.sideEffectsApplied);

  t.deepEqual(app.queue.last('copilot.repairExecution.run').payload, {
    workspaceId: workspace.id,
    executionRequestId: waitingRecord.id,
  });

  const agentRows = await db.$queryRaw<
    Array<{
      runtimeExecutor?: string;
      status: string;
      stepStatus: string;
    }>
  >`
    SELECT
      r.status,
      s.status AS "stepStatus",
      s.output_summary->>'runtimeExecutor' AS "runtimeExecutor"
    FROM ai_agent_runs r
    JOIN ai_agent_steps s ON s.run_id = r.id
    WHERE r.source_type = ${'repair_execution_request'}
      AND r.source_id = ${waitingRecord.id}
      AND r.workspace_id = ${workspace.id}
  `;
  t.deepEqual(agentRows, [
    {
      runtimeExecutor: 'repair_execution_stale_recovery_worker',
      status: 'queued',
      stepStatus: 'pending',
    },
  ]);

  const auditRows = await db.$queryRaw<
    Array<{ eventType: string; metadata: Record<string, unknown> }>
  >`
    SELECT event_type AS "eventType", metadata
    FROM ai_repair_execution_audit_events
    WHERE execution_request_id = ${waitingRecord.id}
    ORDER BY created_at ASC
  `;
  t.deepEqual(
    auditRows.map(row => row.eventType),
    [
      'requested',
      'waiting_approval',
      'approval_approved',
      'queued',
      'running',
      'stale_recovered',
      'queued',
    ]
  );
  t.like(auditRows.find(row => row.eventType === 'stale_recovered')?.metadata, {
    controlAction: 'recover_stale',
    recoverySource: 'system',
    previousWorkerLeaseId: 'scheduled-stale-worker-for-e2e',
    retryScheduled: true,
    nextStatus: 'queued',
  });
});

test('scheduled repair execution queued enqueue recovers missing worker jobs', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair queued enqueue';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const signal = await app
    .get(CopilotCronJobs)
    .enqueueQueuedRepairExecutions({ limit: 10 });
  t.is(signal, JOB_SIGNAL.Done);

  t.deepEqual(app.queue.last('copilot.repairExecution.run').payload, {
    workspaceId: workspace.id,
    executionRequestId: waitingRecord.id,
  });

  const rows = await db.$queryRaw<
    Array<{
      status: string;
      workerAttempt: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      status,
      worker_attempt AS "workerAttempt",
      worker_lease_id AS "workerLeaseId"
    FROM ai_repair_execution_requests
    WHERE id = ${waitingRecord.id}
  `;
  t.like(rows[0], {
    status: 'queued',
    workerAttempt: 0,
    workerLeaseId: null,
  });
});

test('repair execution worker fails unsupported executor payloads without automatic retry', async t => {
  const { app, db, owner, worker } = t.context;
  const workspace = await createWorkspace(app);
  const created = await app.models.copilotRepairExecution.createOrReuse({
    workspaceId: workspace.id,
    actorId: owner.id,
    promptName: 'Repair unsupported worker failure prompt',
    requestedAction: 'publish_prompt_registry_revision',
    approvalRequired: false,
    permissionStatus: 'granted',
    idempotencyKey: 'repair-unsupported-worker-failure',
    idempotencyFingerprint: 'idempotency-fp',
    requestFingerprint: 'request-fp',
    candidateEvidenceSetFingerprint: 'candidate-fp',
    taskRouteEvidenceSetFingerprint: 'task-route-fp',
    targetLocatorFingerprint: 'target-fp',
    repairJobFingerprint: 'repair-job-fp',
    approvalRecordFingerprint: 'approval-fp',
    auditEventFingerprint: 'audit-fp',
    executorPayload: {
      version: 'unsupported-repair-executor/v1',
      kind: 'unsupported_repair_executor',
    },
  });
  const waitingRecord = created.record;
  await app.models.copilotAgentRuntime.createOrReuseForRepairExecution({
    record: waitingRecord,
  });

  const firstSignal = await worker.runRepairExecution({
    workspaceId: workspace.id,
    executionRequestId: waitingRecord.id,
  });
  t.is(firstSignal, JOB_SIGNAL.Done);

  const failedRows = await db.$queryRaw<
    Array<{
      completedAt: Date | null;
      failureCode: string | null;
      failureMessage: string | null;
      status: string;
      workerAttempt: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      completed_at AS "completedAt",
      failure_code AS "failureCode",
      failure_message AS "failureMessage",
      status,
      worker_attempt AS "workerAttempt",
      worker_lease_id AS "workerLeaseId"
    FROM ai_repair_execution_requests
    WHERE id = ${waitingRecord.id}
  `;
  t.is(failedRows[0]?.status, 'failed');
  t.is(failedRows[0]?.failureCode, 'unsupported_executor_payload');
  t.regex(failedRows[0]?.failureMessage ?? '', /Unsupported repair execution/);
  t.is(failedRows[0]?.workerAttempt, 1);
  t.is(failedRows[0]?.workerLeaseId, null);
  t.truthy(failedRows[0]?.completedAt);

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET
        status = ${'queued'},
        runtime_result = ${JSON.stringify({
          version: 'repair-execution-runtime-result/v1',
          executor: 'manual_repair_execution_control',
          sideEffectsApplied: false,
          message: 'Manual retry requested: deterministic bypass',
        })}::jsonb,
        failure_code = ${null},
        failure_message = ${null},
        queued_at = ${new Date('2026-06-23T07:00:00.000Z')},
        worker_lease_id = ${null},
        worker_lease_expires_at = ${null},
        completed_at = ${null}
      WHERE id = ${waitingRecord.id}
    `,
    {
      message:
        /ai_repair_execution_requests_terminal_result_update_restrict_check/,
    }
  );

  await t.throwsAsync(
    app.gql({
      query: controlMutation,
      variables: {
        input: {
          workspaceId: workspace.id,
          executionRequestId: waitingRecord.id,
          action: 'retry',
          reason: 'operator retried deterministic payload failure',
        },
      },
    }),
    {
      message:
        /Repair execution request cannot be retried after deterministic executor payload failure: unsupported_executor_payload/,
    }
  );

  const auditRows = await db.$queryRaw<Array<{ eventType: string }>>`
    SELECT event_type AS "eventType"
    FROM ai_repair_execution_audit_events
    WHERE execution_request_id = ${waitingRecord.id}
    ORDER BY created_at ASC
  `;
  t.deepEqual(
    auditRows.map(row => row.eventType),
    ['requested', 'queued', 'running', 'failed']
  );

  const agentRows = await db.$queryRaw<
    Array<{ failureCode: string | null; status: string; stepStatus: string }>
  >`
    SELECT
      r.failure_code AS "failureCode",
      r.status,
      s.status AS "stepStatus"
    FROM ai_agent_runs r
    JOIN ai_agent_steps s ON s.run_id = r.id
    WHERE r.source_type = ${'repair_execution_request'}
      AND r.source_id = ${waitingRecord.id}
      AND r.workspace_id = ${workspace.id}
  `;
  t.deepEqual(agentRows, [
    {
      failureCode: 'unsupported_executor_payload',
      status: 'failed',
      stepStatus: 'failed',
    },
  ]);
});

test('operator can resume a failed repair execution with corrected executor payload', async t => {
  const { app, db, owner, worker } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair resume payload';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const sourceRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  const payloadRows = await db.$queryRaw<
    Array<{
      executorPayload: Record<string, unknown>;
    }>
  >`
    SELECT executor_payload AS "executorPayload"
    FROM ai_repair_execution_requests
    WHERE id = ${sourceRecord.id}
  `;
  const correctedPayload = payloadRows[0]?.executorPayload;
  t.truthy(correctedPayload);

  const models = app.get(Models);
  const created = await models.copilotRepairExecution.createOrReuse({
    actorId: owner.id,
    approvalRecordFingerprint: sourceRecord.approvalRecordFingerprint,
    approvalRequired: true,
    auditEventFingerprint: sourceRecord.auditEventFingerprint,
    candidateEvidenceSetFingerprint:
      sourceRecord.candidateEvidenceSetFingerprint,
    executorPayload: {
      version: 'unsupported-repair-executor/v1',
      kind: 'unsupported_repair_executor',
    },
    idempotencyFingerprint: 'resume-corrected-payload-idempotency',
    idempotencyKey: 'repair-resume-corrected-payload-bad-request',
    permissionStatus: 'granted',
    promptName,
    repairJobFingerprint: sourceRecord.repairJobFingerprint,
    requestedAction: 'publish_prompt_registry_revision',
    requestFingerprint: sourceRecord.requestFingerprint,
    targetLocatorFingerprint: sourceRecord.targetLocatorFingerprint,
    taskRouteEvidenceSetFingerprint:
      sourceRecord.taskRouteEvidenceSetFingerprint,
    workspaceId: workspace.id,
  });
  const badRecord = created.record;
  await models.copilotAgentRuntime?.createOrReuseForRepairExecution({
    record: badRecord,
  });
  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: badRecord.id,
        decision: 'approve',
      },
    },
  });

  const firstSignal = await worker.runRepairExecution({
    workspaceId: workspace.id,
    executionRequestId: badRecord.id,
  });
  t.is(firstSignal, JOB_SIGNAL.Done);

  const failedRows = await db.$queryRaw<
    Array<{
      completedAt: Date | null;
      failureCode: string | null;
      status: string;
      workerAttempt: number;
    }>
  >`
    SELECT
      completed_at AS "completedAt",
      failure_code AS "failureCode",
      status,
      worker_attempt AS "workerAttempt"
    FROM ai_repair_execution_requests
    WHERE id = ${badRecord.id}
  `;
  t.deepEqual(
    failedRows.map(row => ({
      failureCode: row.failureCode,
      status: row.status,
      workerAttempt: row.workerAttempt,
    })),
    [
      {
        failureCode: 'unsupported_executor_payload',
        status: 'failed',
        workerAttempt: 1,
      },
    ]
  );
  t.truthy(failedRows[0]?.completedAt);

  await t.throwsAsync(
    models.copilotRepairExecution.controlExecution({
      workspaceId: workspace.id,
      actorId: owner.id,
      id: badRecord.id,
      action: 'resume_with_payload',
      executorPayload: correctedPayload,
      reason: 'x'.repeat(1025),
    }),
    { message: /Repair execution control reason is too long/ }
  );

  const controlResult = await app.gql({
    query: controlMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: badRecord.id,
        action: 'resume_with_payload',
        executorPayload: correctedPayload,
        reason: 'operator corrected executor payload',
      },
    },
  });
  const resumed = controlResult.controlCopilotRepairExecution;
  t.is(resumed.status, 'queued');
  t.is(resumed.failureCode, null);
  t.is(resumed.failureMessage, null);
  t.is(resumed.completedAt, null);
  t.is(resumed.workerAttempt, 1);
  t.is(resumed.workerMaxAttempts, 3);
  t.is(
    resumed.runtimeResult.executor,
    'manual_repair_execution_payload_correction'
  );
  t.is(
    resumed.runtimeResult.sideEffectSummary.version,
    'repair-execution-payload-correction-summary/v1'
  );
  t.truthy(
    resumed.runtimeResult.sideEffectSummary.correctedExecutorPayloadFingerprint
  );
  t.is(resumed.agentRun.status, 'queued');
  t.is(resumed.agentRun.failureCode, null);
  t.is(resumed.agentRun.steps[0].status, 'pending');
  t.is(
    resumed.agentRun.steps[0].outputSummary.runtimeExecutor,
    'manual_repair_execution_payload_correction'
  );

  t.deepEqual(app.queue.last('copilot.repairExecution.run').payload, {
    workspaceId: workspace.id,
    executionRequestId: badRecord.id,
  });

  const blockedManualPayloadRows = await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET executor_payload = executor_payload || ${JSON.stringify({
        drift: true,
      })}::jsonb
      WHERE id = ${badRecord.id}
    `,
    {
      message: /ai_repair_execution_requests_evidence_update_restrict_check/,
    }
  );
  t.truthy(blockedManualPayloadRows);

  const secondSignal = await worker.runRepairExecution({
    workspaceId: workspace.id,
    executionRequestId: badRecord.id,
  });
  t.is(secondSignal, JOB_SIGNAL.Done);

  const completedRows = await db.$queryRaw<
    Array<{
      failureCode: string | null;
      runtimeResult: {
        sideEffectKind?: string;
        sideEffectSummary?: {
          rollbackContract?: Record<string, unknown>;
        };
        sideEffectsApplied: boolean;
      };
      sideEffectCount: number;
      status: string;
      workerAttempt: number;
    }>
  >`
    SELECT
      failure_code AS "failureCode",
      runtime_result AS "runtimeResult",
      status,
      worker_attempt AS "workerAttempt",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_side_effects side_effect
        WHERE side_effect.execution_request_id = r.id
      ) AS "sideEffectCount"
    FROM ai_repair_execution_requests r
    WHERE id = ${badRecord.id}
  `;
  t.deepEqual(
    completedRows.map(row => ({
      failureCode: row.failureCode,
      sideEffectCount: row.sideEffectCount,
      sideEffectKind: row.runtimeResult.sideEffectKind,
      sideEffectsApplied: row.runtimeResult.sideEffectsApplied,
      status: row.status,
      workerAttempt: row.workerAttempt,
    })),
    [
      {
        failureCode: null,
        sideEffectCount: 1,
        sideEffectKind: 'prompt_registry_revision',
        sideEffectsApplied: true,
        status: 'completed',
        workerAttempt: 2,
      },
    ]
  );
  t.deepEqual(
    completedRows[0]?.runtimeResult.sideEffectSummary?.rollbackContract,
    forwardOnlyRollbackContract
  );

  await t.throwsAsync(
    models.copilotRepairExecution.controlExecution({
      workspaceId: workspace.id,
      actorId: owner.id,
      id: badRecord.id,
      action: 'resume_with_payload',
      executorPayload: {
        ...correctedPayload,
        kind: 'unsupported_repair_executor',
      },
      reason: 'operator tried to resume completed request',
    }),
    {
      message:
        /Repair execution request cannot resume with payload from status: completed/,
    }
  );

  const auditRows = await db.$queryRaw<
    Array<{
      eventType: string;
      metadata: {
        controlAction?: string;
        correctedExecutorPayloadFingerprint?: string;
        previousExecutorPayloadFingerprint?: string;
      };
    }>
  >`
    SELECT event_type AS "eventType", metadata
    FROM ai_repair_execution_audit_events
    WHERE execution_request_id = ${badRecord.id}
    ORDER BY created_at ASC, id ASC
  `;
  const auditEventCounts = auditRows.reduce<Record<string, number>>(
    (counts, row) => ({
      ...counts,
      [row.eventType]: (counts[row.eventType] ?? 0) + 1,
    }),
    {}
  );
  t.like(auditEventCounts, {
    approval_approved: 1,
    completed: 1,
    failed: 1,
    manual_resume_requested: 1,
    queued: 2,
    requested: 1,
    running: 2,
    side_effect_applied: 1,
    waiting_approval: 1,
  });
  const resumeAudit = auditRows.find(
    row => row.eventType === 'manual_resume_requested'
  );
  t.is(resumeAudit?.metadata.controlAction, 'resume_with_payload');
  t.truthy(resumeAudit?.metadata.previousExecutorPayloadFingerprint);
  t.truthy(resumeAudit?.metadata.correctedExecutorPayloadFingerprint);
  t.not(
    resumeAudit?.metadata.previousExecutorPayloadFingerprint,
    resumeAudit?.metadata.correctedExecutorPayloadFingerprint
  );

  const revisionRows = await db.$queryRaw<
    Array<{ actorId: string; count: number }>
  >`
    SELECT COUNT(*)::int AS "count", max(actor_id) AS "actorId"
    FROM ai_prompt_registry_revisions
    WHERE id = ${`prompt-revision-${badRecord.id}`}
  `;
  t.deepEqual(revisionRows, [
    {
      actorId: owner.id,
      count: 1,
    },
  ]);
});

test('repair execution worker keeps automatic retry for transient worker failures', async t => {
  const { app, db, worker } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair transient retry';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET worker_max_attempts = 2
    WHERE id = ${waitingRecord.id}
  `;

  const model = app.get(Models).copilotPromptRegistryRevision;
  const stub = Sinon.stub(model, 'publishWorkspaceRepairRevision').rejects(
    new Error('transient registry write failure')
  );

  try {
    const firstSignal = await worker.runRepairExecution({
      workspaceId: workspace.id,
      executionRequestId: waitingRecord.id,
    });
    t.is(firstSignal, JOB_SIGNAL.Retry);
    t.true(stub.calledOnce);
  } finally {
    stub.restore();
  }

  const retryRows = await db.$queryRaw<
    Array<{
      failureCode: string | null;
      failureMessage: string | null;
      status: string;
      workerAttempt: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      failure_code AS "failureCode",
      failure_message AS "failureMessage",
      status,
      worker_attempt AS "workerAttempt",
      worker_lease_id AS "workerLeaseId"
    FROM ai_repair_execution_requests
    WHERE id = ${waitingRecord.id}
  `;
  t.like(retryRows[0], {
    failureCode: 'repair_execution_worker_failed',
    status: 'queued',
    workerAttempt: 1,
    workerLeaseId: null,
  });
  t.regex(
    retryRows[0]?.failureMessage ?? '',
    /transient registry write failure/
  );

  const secondSignal = await worker.runRepairExecution({
    workspaceId: workspace.id,
    executionRequestId: waitingRecord.id,
  });
  t.is(secondSignal, JOB_SIGNAL.Done);

  const completedRows = await db.$queryRaw<
    Array<{
      failureCode: string | null;
      status: string;
      workerAttempt: number;
    }>
  >`
    SELECT
      failure_code AS "failureCode",
      status,
      worker_attempt AS "workerAttempt"
    FROM ai_repair_execution_requests
    WHERE id = ${waitingRecord.id}
  `;
  t.deepEqual(completedRows, [
    {
      failureCode: null,
      status: 'completed',
      workerAttempt: 2,
    },
  ]);

  const auditRows = await db.$queryRaw<Array<{ eventType: string }>>`
    SELECT event_type AS "eventType"
    FROM ai_repair_execution_audit_events
    WHERE execution_request_id = ${waitingRecord.id}
    ORDER BY created_at ASC
  `;
  t.deepEqual(
    auditRows.map(row => row.eventType),
    [
      'requested',
      'waiting_approval',
      'approval_approved',
      'queued',
      'running',
      'failed',
      'retry_scheduled',
      'running',
      'side_effect_applied',
      'completed',
    ]
  );
});

test('worker completion fails closed when the leased request state changes before update', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair stale complete';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;
  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });
  const models = app.get(Models);
  const lease = await models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-stale-complete-worker',
  });
  t.truthy(lease);
  const staleExisting = await models.copilotRepairExecution.get(
    workspace.id,
    waitingRecord.id
  );
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'running');
  const driftedLeaseExpiresAt = new Date(
    staleExisting!.workerLeaseExpiresAt!.getTime() + 1000
  );
  await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET worker_lease_expires_at = ${driftedLeaseExpiresAt}
    WHERE id = ${waitingRecord.id}
  `;

  const model = models.copilotRepairExecution;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.completeWorkerExecution({
        workspaceId: workspace.id,
        id: waitingRecord.id,
        workerLeaseId: 'repair-stale-complete-worker',
        workerAttempt: staleExisting!.workerAttempt,
        sideEffect: {
          fingerprint: 'stale-complete-side-effect',
          kind: 'prompt_registry_revision',
          recordId: 'stale-complete-record',
          summary: {
            rollbackContract: forwardOnlyRollbackContract,
            version: 'stale-complete-summary/v1',
          },
        },
      }),
      {
        message: /could not be completed because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      status: string;
      completedAuditCount: number;
      workerLeaseExpiresAt: Date | null;
      sideEffectLedgerCount: number;
      sideEffectAuditCount: number;
    }>
  >`
    SELECT
      r.status,
      r.worker_lease_expires_at AS "workerLeaseExpiresAt",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'completed'}
      ) AS "completedAuditCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_side_effects s
        WHERE s.execution_request_id = r.id
      ) AS "sideEffectLedgerCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'side_effect_applied'}
      ) AS "sideEffectAuditCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      status: 'running',
      completedAuditCount: 0,
      workerLeaseExpiresAt: driftedLeaseExpiresAt,
      sideEffectLedgerCount: 0,
      sideEffectAuditCount: 0,
    },
  ]);
});

test('worker completion fails closed when leased request snapshot timestamp changes before update', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair stale complete ts';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;
  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });
  const models = app.get(Models);
  const lease = await models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-stale-complete-timestamp-worker',
  });
  t.truthy(lease);
  const staleExisting = await models.copilotRepairExecution.get(
    workspace.id,
    waitingRecord.id
  );
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'running');
  const driftedUpdatedAt = new Date(staleExisting!.updatedAt.getTime() + 1000);
  await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET updated_at = ${driftedUpdatedAt}
    WHERE id = ${waitingRecord.id}
  `;

  const model = models.copilotRepairExecution;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.completeWorkerExecution({
        workspaceId: workspace.id,
        id: waitingRecord.id,
        workerLeaseId: 'repair-stale-complete-timestamp-worker',
        workerAttempt: staleExisting!.workerAttempt,
      }),
      {
        message: /could not be completed because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      completedAuditCount: number;
      status: string;
      updatedAt: Date;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.status,
      r.updated_at AS "updatedAt",
      r.worker_lease_id AS "workerLeaseId",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'completed'}
      ) AS "completedAuditCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      completedAuditCount: 0,
      status: 'running',
      updatedAt: driftedUpdatedAt,
      workerLeaseId: 'repair-stale-complete-timestamp-worker',
    },
  ]);
});

test('worker completion rejects malformed approved side-effect results before persistence', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair bad side result';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;
  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });
  const models = app.get(Models);
  const lease = await models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-malformed-side-effect-worker',
  });
  t.truthy(lease);

  await t.throwsAsync(
    models.copilotRepairExecution.completeWorkerExecution({
      workspaceId: workspace.id,
      id: waitingRecord.id,
      workerLeaseId: 'repair-malformed-side-effect-worker',
      workerAttempt: lease!.workerAttempt,
      sideEffect: {
        fingerprint: 'malformed-side-effect',
        kind: 'unbounded_external_side_effect',
        recordId: 'malformed-side-effect-record',
        summary: {
          version: 'malformed-side-effect-summary/v1',
        },
      },
    }),
    {
      message:
        'Repair execution side effect kind is unsupported: unbounded_external_side_effect',
    }
  );

  await t.throwsAsync(
    models.copilotRepairExecution.completeWorkerExecution({
      workspaceId: workspace.id,
      id: waitingRecord.id,
      workerLeaseId: 'repair-malformed-side-effect-worker',
      workerAttempt: lease!.workerAttempt,
      sideEffect: {
        fingerprint: 'malformed-side-effect',
        kind: 'prompt_registry_revision',
        recordId: 'malformed-side-effect-record',
        summary: {
          value: 'x'.repeat(9000),
        },
      },
    }),
    {
      message: 'Repair execution audit metadata is too large',
    }
  );

  await t.throwsAsync(
    models.copilotRepairExecution.completeWorkerExecution({
      workspaceId: workspace.id,
      id: waitingRecord.id,
      workerLeaseId: 'repair-malformed-side-effect-worker',
      workerAttempt: lease!.workerAttempt,
      sideEffect: {
        fingerprint: 'malformed-side-effect',
        kind: 'prompt_registry_revision',
        recordId: 'malformed-side-effect-record',
        summary: {
          version: 'malformed-side-effect-summary/v1',
        },
      },
    }),
    {
      message:
        'Repair execution side effect rollback contract must be an object',
    }
  );

  await t.throwsAsync(
    models.copilotRepairExecution.completeWorkerExecution({
      workspaceId: workspace.id,
      id: waitingRecord.id,
      workerLeaseId: 'repair-malformed-side-effect-worker',
      workerAttempt: lease!.workerAttempt,
      sideEffect: {
        fingerprint: 'malformed-side-effect',
        kind: 'model_registry_revision',
        recordId: 'malformed-side-effect-record',
        summary: {
          rollbackContract: forwardOnlyRollbackContract,
          version: 'malformed-side-effect-summary/v1',
        },
      },
    }),
    {
      message:
        /Repair execution side effect kind does not match executor payload: expected prompt_registry_revision, received model_registry_revision/,
    }
  );

  const rows = await db.$queryRaw<
    Array<{
      completedAuditCount: number;
      sideEffectAuditCount: number;
      sideEffectLedgerCount: number;
      status: string;
    }>
  >`
    SELECT
      r.status,
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'completed'}
      ) AS "completedAuditCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_side_effects s
        WHERE s.execution_request_id = r.id
      ) AS "sideEffectLedgerCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'side_effect_applied'}
      ) AS "sideEffectAuditCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      completedAuditCount: 0,
      sideEffectAuditCount: 0,
      sideEffectLedgerCount: 0,
      status: 'running',
    },
  ]);
});

test('worker failure fails closed when the leased request state changes before update', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair stale failure';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;
  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });
  const models = app.get(Models);
  const lease = await models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-stale-fail-worker',
  });
  t.truthy(lease);
  const staleExisting = await models.copilotRepairExecution.get(
    workspace.id,
    waitingRecord.id
  );
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'running');
  const driftedLeaseExpiresAt = new Date(
    staleExisting!.workerLeaseExpiresAt!.getTime() + 1000
  );
  await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET worker_lease_expires_at = ${driftedLeaseExpiresAt}
    WHERE id = ${waitingRecord.id}
  `;

  const model = models.copilotRepairExecution;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.failWorkerExecution({
        workspaceId: workspace.id,
        id: waitingRecord.id,
        workerLeaseId: 'repair-stale-fail-worker',
        workerAttempt: staleExisting!.workerAttempt,
        code: 'repair_execution_worker_failed',
        message: 'stale failure should not audit',
        retryable: false,
      }),
      {
        message: /could not be failed because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      status: string;
      failedAuditCount: number;
      retryAuditCount: number;
      workerLeaseExpiresAt: Date | null;
    }>
  >`
    SELECT
      r.status,
      r.worker_lease_expires_at AS "workerLeaseExpiresAt",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'failed'}
      ) AS "failedAuditCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'retry_scheduled'}
      ) AS "retryAuditCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      status: 'running',
      failedAuditCount: 0,
      retryAuditCount: 0,
      workerLeaseExpiresAt: driftedLeaseExpiresAt,
    },
  ]);
});

test('worker failure fails closed when the leased request attempt changes before update', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair stale fail attempt';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;
  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });
  const models = app.get(Models);
  const lease = await models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-stale-fail-attempt-worker',
  });
  t.truthy(lease);
  const staleExisting = await models.copilotRepairExecution.get(
    workspace.id,
    waitingRecord.id
  );
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'running');
  t.is(staleExisting?.workerAttempt, 1);
  const driftedAttemptAt = new Date(staleExisting!.updatedAt.getTime() + 1000);
  const driftedAttemptAuditMetadata = {
    executor: 'repair_execution_worker',
    workerAttempt: 2,
    workerLeaseId: 'repair-stale-fail-attempt-worker',
    workerLeaseExpiresAt: staleExisting?.workerLeaseExpiresAt?.toISOString(),
  };
  const driftedAttemptAuditFingerprint = repairExecutionFingerprint({
    version: 'repair-execution-audit-event/v1',
    executionRequestId: waitingRecord.id,
    workspaceId: workspace.id,
    actorId: staleExisting?.actorId,
    eventType: 'running',
    metadata: driftedAttemptAuditMetadata,
  });
  await db.$transaction(async tx => {
    await tx.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET
        worker_attempt = ${2},
        updated_at = ${driftedAttemptAt}
      WHERE id = ${waitingRecord.id}
    `;
    await tx.$executeRaw`
      INSERT INTO ai_repair_execution_audit_events (
        id,
        execution_request_id,
        workspace_id,
        actor_id,
        event_type,
        event_fingerprint,
        metadata,
        created_at
      )
      VALUES (
        ${'repair-stale-fail-attempt-audit'},
        ${waitingRecord.id},
        ${workspace.id},
        ${staleExisting?.actorId},
        ${'running'},
        ${driftedAttemptAuditFingerprint},
        ${JSON.stringify(driftedAttemptAuditMetadata)}::jsonb,
        ${driftedAttemptAt}
      )
    `;
  });

  const model = models.copilotRepairExecution;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.failWorkerExecution({
        workspaceId: workspace.id,
        id: waitingRecord.id,
        workerLeaseId: 'repair-stale-fail-attempt-worker',
        workerAttempt: staleExisting!.workerAttempt,
        code: 'repair_execution_worker_failed',
        message: 'stale attempt failure should not audit',
        retryable: true,
      }),
      {
        message: /could not be failed because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      failedAuditCount: number;
      failureCode: string | null;
      retryAuditCount: number;
      status: string;
      workerAttempt: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.status,
      r.failure_code AS "failureCode",
      r.worker_attempt AS "workerAttempt",
      r.worker_lease_id AS "workerLeaseId",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'failed'}
      ) AS "failedAuditCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'retry_scheduled'}
      ) AS "retryAuditCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      failedAuditCount: 0,
      failureCode: null,
      retryAuditCount: 0,
      status: 'running',
      workerAttempt: 2,
      workerLeaseId: 'repair-stale-fail-attempt-worker',
    },
  ]);
});

test('worker side-effect and cancellation checks fail closed when the leased request attempt changes', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair stale side attempt';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;
  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });
  const lease = await app.models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-stale-side-effect-attempt-worker',
  });
  t.truthy(lease);
  t.is(lease?.status, 'running');
  t.is(lease?.workerAttempt, 1);

  const controlResult = await app.gql({
    query: controlMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        action: 'cancel',
        reason: 'stale attempt cancel request',
      },
    },
  });
  t.is(controlResult.controlCopilotRepairExecution.status, 'running');

  const driftedAttemptAt = new Date();
  const driftedAttemptAuditMetadata = {
    executor: 'repair_execution_worker',
    workerAttempt: 2,
    workerLeaseId: 'repair-stale-side-effect-attempt-worker',
    workerLeaseExpiresAt: lease?.workerLeaseExpiresAt?.toISOString(),
  };
  const driftedAttemptAuditFingerprint = repairExecutionFingerprint({
    version: 'repair-execution-audit-event/v1',
    executionRequestId: waitingRecord.id,
    workspaceId: workspace.id,
    actorId: lease?.actorId,
    eventType: 'running',
    metadata: driftedAttemptAuditMetadata,
  });
  await db.$transaction(async tx => {
    await tx.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET
        worker_attempt = ${2},
        updated_at = ${driftedAttemptAt}
      WHERE id = ${waitingRecord.id}
    `;
    await tx.$executeRaw`
      INSERT INTO ai_repair_execution_audit_events (
        id,
        execution_request_id,
        workspace_id,
        actor_id,
        event_type,
        event_fingerprint,
        metadata,
        created_at
      )
      VALUES (
        ${'repair-stale-side-effect-attempt-audit'},
        ${waitingRecord.id},
        ${workspace.id},
        ${lease?.actorId},
        ${'running'},
        ${driftedAttemptAuditFingerprint},
        ${JSON.stringify(driftedAttemptAuditMetadata)}::jsonb,
        ${driftedAttemptAt}
      )
    `;
  });

  const staleCancelled =
    await app.models.copilotRepairExecution.cancelLeasedExecutionIfCancellationRequested(
      {
        workspaceId: workspace.id,
        id: waitingRecord.id,
        workerLeaseId: 'repair-stale-side-effect-attempt-worker',
        workerAttempt: lease!.workerAttempt,
      }
    );
  t.is(staleCancelled, null);

  const staleCurrent =
    await app.models.copilotRepairExecution.currentLeasedExecutionBeforeSideEffect(
      {
        workspaceId: workspace.id,
        id: waitingRecord.id,
        workerLeaseId: 'repair-stale-side-effect-attempt-worker',
        workerAttempt: lease!.workerAttempt,
      }
    );
  t.is(staleCurrent, null);

  await t.throwsAsync(
    app.models.copilotRepairExecution.completeWorkerExecution({
      workspaceId: workspace.id,
      id: waitingRecord.id,
      workerLeaseId: 'repair-stale-side-effect-attempt-worker',
      workerAttempt: lease!.workerAttempt,
      sideEffect: {
        fingerprint: 'stale-side-effect-attempt',
        kind: 'prompt_registry_revision',
        recordId: 'stale-side-effect-attempt-record',
        summary: {
          rollbackContract: forwardOnlyRollbackContract,
          version: 'stale-side-effect-attempt-summary/v1',
        },
      },
    }),
    {
      message: /not leased by this worker|state changed/,
    }
  );

  const rows = await db.$queryRaw<
    Array<{
      cancelledAuditCount: number;
      completedAuditCount: number;
      sideEffectAuditCount: number;
      sideEffectLedgerCount: number;
      status: string;
      workerAttempt: number;
      workerLeaseId: string | null;
    }>
  >`
    SELECT
      r.status,
      r.worker_attempt AS "workerAttempt",
      r.worker_lease_id AS "workerLeaseId",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'cancelled'}
      ) AS "cancelledAuditCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'completed'}
      ) AS "completedAuditCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_side_effects s
        WHERE s.execution_request_id = r.id
      ) AS "sideEffectLedgerCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'side_effect_applied'}
      ) AS "sideEffectAuditCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      cancelledAuditCount: 0,
      completedAuditCount: 0,
      sideEffectAuditCount: 0,
      sideEffectLedgerCount: 0,
      status: 'running',
      workerAttempt: 2,
      workerLeaseId: 'repair-stale-side-effect-attempt-worker',
    },
  ]);
});

test('repair execution worker failure persistence normalizes blank and overlong messages', async t => {
  const { app, db } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const blankPromptName = 'Repair blank failure';
  const overlongPromptName = 'Repair long failure';
  await seedRegistryPrompt(db, blankPromptName);
  await seedRegistryPrompt(db, overlongPromptName);

  const createApprovedRequest = async (promptName: string) => {
    const requestInput = await buildRepairExecutionInput({
      app,
      name: promptName,
      workspaceId: workspace.id,
    });
    const requestResult = await app.gql({
      query: repairExecutionMutation,
      variables: {
        input: requestInput,
      },
    });
    const waitingRecord =
      requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;
    await app.gql({
      query: approvalDecisionMutation,
      variables: {
        input: {
          workspaceId: workspace.id,
          executionRequestId: waitingRecord.id,
          decision: 'approve',
        },
      },
    });
    return waitingRecord;
  };

  const blankRecord = await createApprovedRequest(blankPromptName);
  const blankWorkerLeaseId = 'repair-failure-message-blank-worker';
  const leasedBlank =
    await app.models.copilotRepairExecution.acquireWorkerLease({
      workspaceId: workspace.id,
      id: blankRecord.id,
      workerId: blankWorkerLeaseId,
    });
  t.truthy(leasedBlank);
  await models.copilotRepairExecution.failWorkerExecution({
    workspaceId: workspace.id,
    id: blankRecord.id,
    workerLeaseId: blankWorkerLeaseId,
    workerAttempt: leasedBlank!.workerAttempt,
    code: '  repair_execution_worker_failed  ',
    message: '   ',
    retryable: false,
  });

  const overlongRecord = await createApprovedRequest(overlongPromptName);
  const overlongWorkerLeaseId = 'repair-failure-message-overlong-worker';
  const leasedOverlong =
    await app.models.copilotRepairExecution.acquireWorkerLease({
      workspaceId: workspace.id,
      id: overlongRecord.id,
      workerId: overlongWorkerLeaseId,
    });
  t.truthy(leasedOverlong);
  const overlongFailureMessage = `  ${'x'.repeat(2200)}  `;
  await models.copilotRepairExecution.failWorkerExecution({
    workspaceId: workspace.id,
    id: overlongRecord.id,
    workerLeaseId: overlongWorkerLeaseId,
    workerAttempt: leasedOverlong!.workerAttempt,
    code: 'repair_execution_worker_failed',
    message: overlongFailureMessage,
    retryable: false,
  });

  const rows = await db.$queryRaw<
    Array<{
      failureCode: string | null;
      failureMessage: string | null;
      id: string;
      runtimeResult: { message: string };
      status: string;
    }>
  >`
    SELECT
      id,
      status,
      failure_code AS "failureCode",
      failure_message AS "failureMessage",
      runtime_result AS "runtimeResult"
    FROM ai_repair_execution_requests
    WHERE id IN (${blankRecord.id}, ${overlongRecord.id})
    ORDER BY id ASC
  `;
  const blankRow = rows.find(row => row.id === blankRecord.id);
  const overlongRow = rows.find(row => row.id === overlongRecord.id);
  t.like(blankRow, {
    failureCode: 'repair_execution_worker_failed',
    failureMessage: 'Repair execution worker failed',
    status: 'failed',
  });
  t.regex(
    blankRow?.runtimeResult.message ?? '',
    /Repair execution worker failed with repair_execution_worker_failed: Repair execution worker failed/
  );
  t.is(overlongRow?.failureMessage, 'x'.repeat(2000));
  t.true(
    overlongRow?.runtimeResult.message.endsWith('x'.repeat(2000)) ?? false
  );

  const auditRows = await db.$queryRaw<
    Array<{
      executionRequestId: string;
      metadata: { failureCode?: string; failureMessage?: string };
    }>
  >`
    SELECT
      execution_request_id AS "executionRequestId",
      metadata
    FROM ai_repair_execution_audit_events
    WHERE execution_request_id IN (${blankRecord.id}, ${overlongRecord.id})
      AND event_type = ${'failed'}
    ORDER BY execution_request_id ASC
  `;
  t.is(
    auditRows.find(row => row.executionRequestId === blankRecord.id)?.metadata
      .failureMessage,
    'Repair execution worker failed'
  );
  t.is(
    auditRows.find(row => row.executionRequestId === blankRecord.id)?.metadata
      .failureCode,
    'repair_execution_worker_failed'
  );
  t.is(
    auditRows.find(row => row.executionRequestId === overlongRecord.id)
      ?.metadata.failureMessage,
    'x'.repeat(2000)
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET failure_message = ${null}
      WHERE id = ${blankRecord.id}
    `,
    { message: /ai_repair_execution_requests_failure_pair_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET failure_code = ${null}
      WHERE id = ${overlongRecord.id}
    `,
    { message: /ai_repair_execution_requests_failure_pair_check/ }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET
        failure_code = ${'   '},
        failure_message = ${'Repair execution blank failure code'}
      WHERE id = ${blankRecord.id}
    `,
    { message: /ai_repair_execution_requests_failure_string_shape_check/ }
  );

  const invalidCodePromptName = 'Repair invalid code';
  await seedRegistryPrompt(db, invalidCodePromptName);
  const invalidCodeRecord = await createApprovedRequest(invalidCodePromptName);
  const invalidCodeLeaseId = 'repair-failure-code-invalid-worker';
  const leasedInvalidCode =
    await app.models.copilotRepairExecution.acquireWorkerLease({
      workspaceId: workspace.id,
      id: invalidCodeRecord.id,
      workerId: invalidCodeLeaseId,
    });
  t.truthy(leasedInvalidCode);
  await t.throwsAsync(
    app.models.copilotRepairExecution.failWorkerExecution({
      workspaceId: workspace.id,
      id: invalidCodeRecord.id,
      workerLeaseId: invalidCodeLeaseId,
      workerAttempt: leasedInvalidCode!.workerAttempt,
      code: 'x'.repeat(129),
      message: 'invalid overlong failure code',
      retryable: false,
    }),
    { message: 'Repair execution failure code is too long' }
  );
  const invalidCodeRows = await db.$queryRaw<
    Array<{ failureCode: string | null; status: string }>
  >`
    SELECT status, failure_code AS "failureCode"
    FROM ai_repair_execution_requests
    WHERE id = ${invalidCodeRecord.id}
  `;
  t.deepEqual(invalidCodeRows, [
    {
      failureCode: null,
      status: 'running',
    },
  ]);
});

test('manual control retries a failed repair execution and requeues worker runtime', async t => {
  const { app, db, worker } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair manual retry prompt';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const lease = await app.models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-manual-retry-worker',
  });
  t.truthy(lease);
  await app.models.copilotAgentRuntime.syncRepairExecution({
    record: lease!,
  });
  const failure = await app.models.copilotRepairExecution.failWorkerExecution({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerLeaseId: 'repair-manual-retry-worker',
    workerAttempt: lease!.workerAttempt,
    code: 'transient_worker_failure',
    message: 'prepare manual retry',
    retryable: false,
  });
  await app.models.copilotAgentRuntime.syncRepairExecution({
    record: failure.record,
  });

  const failedRows = await db.$queryRaw<
    Array<{
      completedAt: Date | null;
      failureCode: string | null;
      status: string;
      workerAttempt: number;
      workerMaxAttempts: number;
    }>
  >`
    SELECT
      completed_at AS "completedAt",
      failure_code AS "failureCode",
      status,
      worker_attempt AS "workerAttempt",
      worker_max_attempts AS "workerMaxAttempts"
    FROM ai_repair_execution_requests
    WHERE id = ${waitingRecord.id}
  `;
  t.is(failedRows[0]?.status, 'failed');
  t.is(failedRows[0]?.failureCode, 'transient_worker_failure');
  t.is(failedRows[0]?.workerAttempt, 1);
  t.is(failedRows[0]?.workerMaxAttempts, 3);
  t.truthy(failedRows[0]?.completedAt);

  await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET status = status
    WHERE id = ${waitingRecord.id}
  `;

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET failure_message = ${'drifted terminal repair failure'}
      WHERE id = ${waitingRecord.id}
    `,
    {
      message:
        /ai_repair_execution_requests_terminal_result_update_restrict_check/,
    }
  );

  await t.throwsAsync(
    db.$executeRaw`
      UPDATE ai_repair_execution_requests
      SET
        status = ${'completed'},
        runtime_result = runtime_result || ${JSON.stringify({
          message: 'drifted terminal repair completion',
        })}::jsonb,
        failure_code = ${null},
        failure_message = ${null}
      WHERE id = ${waitingRecord.id}
    `,
    {
      message:
        /ai_repair_execution_requests_terminal_result_update_restrict_check/,
    }
  );

  await t.throwsAsync(
    app.gql({
      query: controlMutation,
      variables: {
        input: {
          workspaceId: workspace.id,
          executionRequestId: waitingRecord.id,
          action: 'retry',
          reason: 'x'.repeat(1025),
        },
      },
    }),
    { message: /Repair execution control reason is too long/ }
  );
  const afterRejectedReasonRows = await db.$queryRaw<
    Array<{ status: string; workerMaxAttempts: number }>
  >`
    SELECT status, worker_max_attempts AS "workerMaxAttempts"
    FROM ai_repair_execution_requests
    WHERE id = ${waitingRecord.id}
  `;
  t.deepEqual(afterRejectedReasonRows, [
    {
      status: 'failed',
      workerMaxAttempts: 3,
    },
  ]);

  const controlResult = await app.gql({
    query: controlMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        action: 'retry',
        reason: 'operator retried transient failure',
      },
    },
  });
  const retried = controlResult.controlCopilotRepairExecution;

  t.is(retried.status, 'queued');
  t.is(retried.approvalState, 'approved');
  t.is(retried.failureCode, null);
  t.is(retried.failureMessage, null);
  t.is(retried.completedAt, null);
  t.truthy(retried.queuedAt);
  t.is(retried.workerAttempt, 1);
  t.is(retried.workerMaxAttempts, 3);
  t.is(retried.runtimeResult.executor, 'manual_repair_execution_control');
  t.regex(retried.runtimeResult.message, /operator retried transient failure/);
  t.is(retried.agentRun.status, 'queued');
  t.is(retried.agentRun.failureCode, null);
  t.is(retried.agentRun.steps[0].status, 'pending');
  t.is(
    retried.agentRun.steps[0].outputSummary.runtimeExecutor,
    'manual_repair_execution_control'
  );
  t.deepEqual(
    retried.agentRun.timelineEvents
      .slice(-2)
      .map((event: { eventType: string; status: string; summary: string }) => [
        event.eventType,
        event.status,
        event.summary,
      ]),
    [
      ['run_status', 'queued', 'Repair execution run queued'],
      ['model_step', 'pending', 'Repair execution queued for worker'],
    ]
  );

  const completedSignal = await worker.runRepairExecution({
    workspaceId: workspace.id,
    executionRequestId: waitingRecord.id,
  });
  t.is(completedSignal, JOB_SIGNAL.Done);

  const completedRows = await db.$queryRaw<
    Array<{
      completedAt: Date | null;
      failureCode: string | null;
      runtimeResult: {
        executor: string;
        sideEffectKind?: string;
        sideEffectRecordId?: string;
        sideEffectSummary?: {
          rollbackContract?: Record<string, unknown>;
        };
        sideEffectsApplied: boolean;
      };
      status: string;
      workerAttempt: number;
      workerMaxAttempts: number;
    }>
  >`
    SELECT
      completed_at AS "completedAt",
      failure_code AS "failureCode",
      runtime_result AS "runtimeResult",
      status,
      worker_attempt AS "workerAttempt",
      worker_max_attempts AS "workerMaxAttempts"
    FROM ai_repair_execution_requests
    WHERE id = ${waitingRecord.id}
  `;
  t.is(completedRows[0]?.status, 'completed');
  t.is(completedRows[0]?.failureCode, null);
  t.truthy(completedRows[0]?.completedAt);
  t.is(completedRows[0]?.workerAttempt, 2);
  t.is(completedRows[0]?.workerMaxAttempts, 3);
  t.is(
    completedRows[0]?.runtimeResult.executor,
    'prompt_registry_revision_publish_worker'
  );
  t.true(completedRows[0]?.runtimeResult.sideEffectsApplied);
  t.is(
    completedRows[0]?.runtimeResult.sideEffectKind,
    'prompt_registry_revision'
  );
  t.is(
    completedRows[0]?.runtimeResult.sideEffectRecordId,
    `prompt-revision-${waitingRecord.id}`
  );
  t.deepEqual(
    completedRows[0]?.runtimeResult.sideEffectSummary?.rollbackContract,
    forwardOnlyRollbackContract
  );

  const runtimeRows = await db.$queryRaw<
    Array<{
      outputSummary: {
        sideEffectKind?: string;
        sideEffectRecordId?: string;
        sideEffectRollbackContract?: Record<string, unknown>;
        sideEffectsApplied?: boolean;
      };
      status: string;
      stepStatus: string;
    }>
  >`
    SELECT
      r.status,
      s.status AS "stepStatus",
      s.output_summary AS "outputSummary"
    FROM ai_agent_runs r
    JOIN ai_agent_steps s ON s.run_id = r.id
    WHERE r.source_type = ${'repair_execution_request'}
      AND r.source_id = ${waitingRecord.id}
      AND r.workspace_id = ${workspace.id}
  `;
  t.is(runtimeRows.length, 1);
  t.is(runtimeRows[0]?.status, 'completed');
  t.is(runtimeRows[0]?.stepStatus, 'completed');
  t.true(runtimeRows[0]?.outputSummary.sideEffectsApplied);
  t.is(
    runtimeRows[0]?.outputSummary.sideEffectKind,
    'prompt_registry_revision'
  );
  t.is(
    runtimeRows[0]?.outputSummary.sideEffectRecordId,
    `prompt-revision-${waitingRecord.id}`
  );
  t.deepEqual(
    runtimeRows[0]?.outputSummary.sideEffectRollbackContract,
    forwardOnlyRollbackContract
  );

  const completedRuntimeTimelineRows = await db.$queryRaw<
    Array<{
      payload: {
        sideEffectKind?: string;
        sideEffectRecordId?: string;
        sideEffectRollbackContract?: Record<string, unknown>;
        sideEffectsApplied?: boolean;
      };
    }>
  >`
    SELECT payload
    FROM ai_agent_timeline_events e
    JOIN ai_agent_runs r ON r.id = e.run_id
    WHERE r.source_type = ${'repair_execution_request'}
      AND r.source_id = ${waitingRecord.id}
      AND r.workspace_id = ${workspace.id}
      AND e.event_type = ${'model_step'}
      AND e.status = ${'completed'}
    ORDER BY e.ordinal DESC
    LIMIT 1
  `;
  t.true(completedRuntimeTimelineRows[0]?.payload.sideEffectsApplied);
  t.is(
    completedRuntimeTimelineRows[0]?.payload.sideEffectKind,
    'prompt_registry_revision'
  );
  t.is(
    completedRuntimeTimelineRows[0]?.payload.sideEffectRecordId,
    `prompt-revision-${waitingRecord.id}`
  );
  t.deepEqual(
    completedRuntimeTimelineRows[0]?.payload.sideEffectRollbackContract,
    forwardOnlyRollbackContract
  );

  const revisionRows = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count"
    FROM ai_prompt_registry_revisions
    WHERE id = ${`prompt-revision-${waitingRecord.id}`}
  `;
  t.is(revisionRows[0]?.count, 1);

  const auditRows = await db.$queryRaw<
    Array<{ eventType: string; metadata: { controlAction?: string } }>
  >`
    SELECT event_type AS "eventType", metadata
    FROM ai_repair_execution_audit_events
    WHERE execution_request_id = ${waitingRecord.id}
    ORDER BY created_at ASC
  `;
  t.deepEqual(
    auditRows.map(row => row.eventType),
    [
      'requested',
      'waiting_approval',
      'approval_approved',
      'queued',
      'running',
      'failed',
      'manual_retry_requested',
      'queued',
      'running',
      'side_effect_applied',
      'completed',
    ]
  );
  t.is(
    auditRows.find(row => row.eventType === 'manual_retry_requested')?.metadata
      .controlAction,
    'retry'
  );
});

test('manual retry fails closed when the request state changes before update', async t => {
  const { app, db } = t.context;
  const models = app.get(Models);
  const workspace = await createWorkspace(app);
  const promptName = 'Repair stale manual retry prompt';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const lease = await models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-stale-retry-worker',
  });
  t.truthy(lease);
  await models.copilotRepairExecution.failWorkerExecution({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerLeaseId: 'repair-stale-retry-worker',
    workerAttempt: lease!.workerAttempt,
    code: 'transient_worker_failure',
    message: 'prepare stale retry',
    retryable: false,
  });
  const staleExisting = await models.copilotRepairExecution.get(
    workspace.id,
    waitingRecord.id
  );
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'failed');
  await models.copilotRepairExecution.controlExecution({
    workspaceId: workspace.id,
    actorId: waitingRecord.actorId,
    id: waitingRecord.id,
    action: 'cancel',
    reason: 'stale retry race',
  });

  const model = models.copilotRepairExecution;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.controlExecution({
        workspaceId: workspace.id,
        actorId: waitingRecord.actorId,
        id: waitingRecord.id,
        action: 'retry',
        reason: 'stale retry should not audit',
      }),
      {
        message: /could not be retried because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{ status: string; retryAuditCount: number }>
  >`
    SELECT
      r.status,
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'manual_retry_requested'}
      ) AS "retryAuditCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      status: 'cancelled',
      retryAuditCount: 0,
    },
  ]);
});

test('manual retry fails closed when failed snapshot evidence changes before update', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair stale retry evidence';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const models = app.get(Models);
  const lease = await models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-stale-retry-evidence-worker',
  });
  t.truthy(lease);
  await models.copilotRepairExecution.failWorkerExecution({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerLeaseId: 'repair-stale-retry-evidence-worker',
    workerAttempt: lease!.workerAttempt,
    code: 'transient_worker_failure',
    message: 'prepare stale retry evidence',
    retryable: false,
  });
  const staleExisting = await models.copilotRepairExecution.get(
    workspace.id,
    waitingRecord.id
  );
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'failed');

  const driftedAt = new Date(staleExisting!.updatedAt.getTime() + 60_000);
  const driftedRows = await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET updated_at = ${driftedAt}
    WHERE id = ${waitingRecord.id}
      AND status = ${'failed'}
  `;
  t.is(driftedRows, 1);

  const model = models.copilotRepairExecution;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.controlExecution({
        workspaceId: workspace.id,
        actorId: waitingRecord.actorId,
        id: waitingRecord.id,
        action: 'retry',
        reason: 'stale retry evidence should not audit',
      }),
      {
        message: /could not be retried because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      status: string;
      manualRetryAuditCount: number;
      queuedAuditCount: number;
      updatedAt: Date;
    }>
  >`
    SELECT
      r.status,
      r.updated_at AS "updatedAt",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'manual_retry_requested'}
      ) AS "manualRetryAuditCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'queued'}
          AND e.metadata ->> ${'controlAction'} = ${'retry'}
      ) AS "queuedAuditCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      status: 'failed',
      manualRetryAuditCount: 0,
      queuedAuditCount: 0,
      updatedAt: driftedAt,
    },
  ]);
});

test('manual retry fails closed when failed snapshot identity changes before update', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const driftActor = await app.createUser();
  const promptName = 'Repair stale retry identity';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const models = app.get(Models);
  const lease = await models.copilotRepairExecution.acquireWorkerLease({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerId: 'repair-stale-retry-identity-worker',
  });
  t.truthy(lease);
  await models.copilotRepairExecution.failWorkerExecution({
    workspaceId: workspace.id,
    id: waitingRecord.id,
    workerLeaseId: 'repair-stale-retry-identity-worker',
    workerAttempt: lease!.workerAttempt,
    code: 'transient_worker_failure',
    message: 'prepare stale retry identity',
    retryable: false,
  });
  const staleExisting = await models.copilotRepairExecution.get(
    workspace.id,
    waitingRecord.id
  );
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'failed');

  const model = models.copilotRepairExecution;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return {
        ...staleExisting!,
        actorId: driftActor.id,
      };
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.controlExecution({
        workspaceId: workspace.id,
        actorId: waitingRecord.actorId,
        id: waitingRecord.id,
        action: 'retry',
        reason: 'stale retry identity should not audit',
      }),
      {
        message: /could not be retried because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      actorId: string;
      manualRetryAuditCount: number;
      queuedAuditCount: number;
      status: string;
    }>
  >`
    SELECT
      r.actor_id AS "actorId",
      r.status,
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'manual_retry_requested'}
      ) AS "manualRetryAuditCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'queued'}
          AND e.metadata ->> ${'controlAction'} = ${'retry'}
      ) AS "queuedAuditCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      actorId: waitingRecord.actorId,
      manualRetryAuditCount: 0,
      queuedAuditCount: 0,
      status: 'failed',
    },
  ]);
});

test('manual resume with payload fails closed when failed snapshot evidence changes before update', async t => {
  const { app, db, owner, worker } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Repair stale resume evidence';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const sourceRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  const payloadRows = await db.$queryRaw<
    Array<{
      executorPayload: Record<string, unknown>;
    }>
  >`
    SELECT executor_payload AS "executorPayload"
    FROM ai_repair_execution_requests
    WHERE id = ${sourceRecord.id}
  `;
  const correctedPayload = payloadRows[0]?.executorPayload;
  t.truthy(correctedPayload);

  const models = app.get(Models);
  const created = await models.copilotRepairExecution.createOrReuse({
    actorId: owner.id,
    approvalRecordFingerprint: sourceRecord.approvalRecordFingerprint,
    approvalRequired: true,
    auditEventFingerprint: sourceRecord.auditEventFingerprint,
    candidateEvidenceSetFingerprint:
      sourceRecord.candidateEvidenceSetFingerprint,
    executorPayload: {
      version: 'unsupported-repair-executor/v1',
      kind: 'unsupported_repair_executor',
    },
    idempotencyFingerprint: 'stale-payload-resume-idempotency',
    idempotencyKey: 'repair-stale-payload-resume-bad-request',
    permissionStatus: 'granted',
    promptName,
    repairJobFingerprint: sourceRecord.repairJobFingerprint,
    requestedAction: 'publish_prompt_registry_revision',
    requestFingerprint: sourceRecord.requestFingerprint,
    targetLocatorFingerprint: sourceRecord.targetLocatorFingerprint,
    taskRouteEvidenceSetFingerprint:
      sourceRecord.taskRouteEvidenceSetFingerprint,
    workspaceId: workspace.id,
  });
  const badRecord = created.record;
  await models.copilotAgentRuntime?.createOrReuseForRepairExecution({
    record: badRecord,
  });
  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: badRecord.id,
        decision: 'approve',
      },
    },
  });

  const firstSignal = await worker.runRepairExecution({
    workspaceId: workspace.id,
    executionRequestId: badRecord.id,
  });
  t.is(firstSignal, JOB_SIGNAL.Done);
  const staleExisting = await models.copilotRepairExecution.get(
    workspace.id,
    badRecord.id
  );
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'failed');
  t.is(staleExisting?.failureCode, 'unsupported_executor_payload');

  const driftedAt = new Date(staleExisting!.updatedAt.getTime() + 60_000);
  const driftedRows = await db.$executeRaw`
    UPDATE ai_repair_execution_requests
    SET updated_at = ${driftedAt}
    WHERE id = ${badRecord.id}
      AND status = ${'failed'}
  `;
  t.is(driftedRows, 1);

  const model = models.copilotRepairExecution;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return staleExisting;
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.controlExecution({
        workspaceId: workspace.id,
        actorId: owner.id,
        id: badRecord.id,
        action: 'resume_with_payload',
        executorPayload: correctedPayload,
        reason: 'stale resume evidence should not audit',
      }),
      {
        message: /could not resume with payload because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      executorPayload: Record<string, unknown>;
      manualResumeAuditCount: number;
      queuedAuditCount: number;
      status: string;
      updatedAt: Date;
    }>
  >`
    SELECT
      r.executor_payload AS "executorPayload",
      r.status,
      r.updated_at AS "updatedAt",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'manual_resume_requested'}
      ) AS "manualResumeAuditCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'queued'}
          AND e.metadata ->> ${'controlAction'} = ${'resume_with_payload'}
      ) AS "queuedAuditCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${badRecord.id}
  `;
  t.deepEqual(rows, [
    {
      executorPayload: {
        version: 'unsupported-repair-executor/v1',
        kind: 'unsupported_repair_executor',
      },
      manualResumeAuditCount: 0,
      queuedAuditCount: 0,
      status: 'failed',
      updatedAt: driftedAt,
    },
  ]);
});

test('manual resume with payload fails closed when failed snapshot identity changes before update', async t => {
  const { app, db, owner, worker } = t.context;
  const workspace = await createWorkspace(app);
  const driftActor = await app.createUser();
  const promptName = 'Repair stale resume identity';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const sourceRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  const payloadRows = await db.$queryRaw<
    Array<{
      executorPayload: Record<string, unknown>;
    }>
  >`
    SELECT executor_payload AS "executorPayload"
    FROM ai_repair_execution_requests
    WHERE id = ${sourceRecord.id}
  `;
  const correctedPayload = payloadRows[0]?.executorPayload;
  t.truthy(correctedPayload);

  const models = app.get(Models);
  const created = await models.copilotRepairExecution.createOrReuse({
    actorId: owner.id,
    approvalRecordFingerprint: sourceRecord.approvalRecordFingerprint,
    approvalRequired: true,
    auditEventFingerprint: sourceRecord.auditEventFingerprint,
    candidateEvidenceSetFingerprint:
      sourceRecord.candidateEvidenceSetFingerprint,
    executorPayload: {
      version: 'unsupported-repair-executor/v1',
      kind: 'unsupported_repair_executor',
    },
    idempotencyFingerprint: 'stale-payload-resume-identity-idempotency',
    idempotencyKey: 'repair-stale-payload-resume-identity-bad-request',
    permissionStatus: 'granted',
    promptName,
    repairJobFingerprint: sourceRecord.repairJobFingerprint,
    requestedAction: 'publish_prompt_registry_revision',
    requestFingerprint: sourceRecord.requestFingerprint,
    targetLocatorFingerprint: sourceRecord.targetLocatorFingerprint,
    taskRouteEvidenceSetFingerprint:
      sourceRecord.taskRouteEvidenceSetFingerprint,
    workspaceId: workspace.id,
  });
  const badRecord = created.record;
  await models.copilotAgentRuntime?.createOrReuseForRepairExecution({
    record: badRecord,
  });
  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: badRecord.id,
        decision: 'approve',
      },
    },
  });

  const firstSignal = await worker.runRepairExecution({
    workspaceId: workspace.id,
    executionRequestId: badRecord.id,
  });
  t.is(firstSignal, JOB_SIGNAL.Done);
  const staleExisting = await models.copilotRepairExecution.get(
    workspace.id,
    badRecord.id
  );
  t.truthy(staleExisting);
  t.is(staleExisting?.status, 'failed');
  t.is(staleExisting?.failureCode, 'unsupported_executor_payload');

  const model = models.copilotRepairExecution;
  const originalGet = model.get.bind(model);
  let returnedStaleRecord = false;
  model.get = (async (workspaceId: string, id: string) => {
    if (!returnedStaleRecord) {
      returnedStaleRecord = true;
      return {
        ...staleExisting!,
        actorId: driftActor.id,
      };
    }
    return await originalGet(workspaceId, id);
  }) as typeof model.get;
  try {
    await t.throwsAsync(
      model.controlExecution({
        workspaceId: workspace.id,
        actorId: owner.id,
        id: badRecord.id,
        action: 'resume_with_payload',
        executorPayload: correctedPayload,
        reason: 'stale resume identity should not audit',
      }),
      {
        message: /could not resume with payload because its state changed/,
      }
    );
  } finally {
    model.get = originalGet as typeof model.get;
  }

  const rows = await db.$queryRaw<
    Array<{
      actorId: string;
      executorPayload: Record<string, unknown>;
      manualResumeAuditCount: number;
      queuedAuditCount: number;
      status: string;
    }>
  >`
    SELECT
      r.actor_id AS "actorId",
      r.executor_payload AS "executorPayload",
      r.status,
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'manual_resume_requested'}
      ) AS "manualResumeAuditCount",
      (
        SELECT COUNT(*)::int
        FROM ai_repair_execution_audit_events e
        WHERE e.execution_request_id = r.id
          AND e.event_type = ${'queued'}
          AND e.metadata ->> ${'controlAction'} = ${'resume_with_payload'}
      ) AS "queuedAuditCount"
    FROM ai_repair_execution_requests r
    WHERE r.id = ${badRecord.id}
  `;
  t.deepEqual(rows, [
    {
      actorId: owner.id,
      executorPayload: {
        version: 'unsupported-repair-executor/v1',
        kind: 'unsupported_repair_executor',
      },
      manualResumeAuditCount: 0,
      queuedAuditCount: 0,
      status: 'failed',
    },
  ]);
});

test('rejects repair execution request for a workspace without access', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Unauthorized repair';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const outsider = await app.createUser();
  await app.login(outsider);
  await app.switchUser(outsider);

  await t.throwsAsync(
    app.gql({
      query: repairExecutionMutation,
      variables: {
        input: requestInput,
      },
    })
  );

  const rows = await db.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count"
    FROM ai_repair_execution_requests
  `;
  t.is(rows[0]?.count, 0);
});

test('rejects approval decision for a workspace without access', async t => {
  const { app, db } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Unauthorized approval decision';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;
  const outsider = await app.createUser();
  await app.login(outsider);
  await app.switchUser(outsider);

  await t.throwsAsync(
    app.gql({
      query: approvalDecisionMutation,
      variables: {
        input: {
          workspaceId: workspace.id,
          executionRequestId: waitingRecord.id,
          decision: 'approve',
        },
      },
    })
  );

  const rows = await db.$queryRaw<
    Array<{ approvalState: string; status: string }>
  >`
    SELECT approval_state AS "approvalState", status
    FROM ai_repair_execution_requests
    WHERE id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      approvalState: 'waiting',
      status: 'waiting_approval',
    },
  ]);
});

test('rejects manual repair execution control for a workspace without access', async t => {
  const { app, db, owner } = t.context;
  const workspace = await createWorkspace(app);
  const promptName = 'Unauthorized repair control';
  await seedRegistryPrompt(db, promptName);
  const requestInput = await buildRepairExecutionInput({
    app,
    name: promptName,
    workspaceId: workspace.id,
  });
  const requestResult = await app.gql({
    query: repairExecutionMutation,
    variables: {
      input: requestInput,
    },
  });
  const waitingRecord =
    requestResult.requestCopilotPromptRegistryRepairExecution.executionRecord;

  await app.gql({
    query: approvalDecisionMutation,
    variables: {
      input: {
        workspaceId: workspace.id,
        executionRequestId: waitingRecord.id,
        decision: 'approve',
      },
    },
  });

  const outsider = await app.createUser();
  await app.login(outsider);
  await app.switchUser(outsider);

  await t.throwsAsync(
    app.gql({
      query: controlMutation,
      variables: {
        input: {
          workspaceId: workspace.id,
          executionRequestId: waitingRecord.id,
          action: 'cancel',
        },
      },
    })
  );

  await app.login(owner);
  await app.switchUser(owner);

  const rows = await db.$queryRaw<
    Array<{ approvalState: string; status: string }>
  >`
    SELECT approval_state AS "approvalState", status
    FROM ai_repair_execution_requests
    WHERE id = ${waitingRecord.id}
  `;
  t.deepEqual(rows, [
    {
      approvalState: 'approved',
      status: 'queued',
    },
  ]);
});
