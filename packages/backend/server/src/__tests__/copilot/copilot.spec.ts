import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

import { ProjectRoot } from '@affine-tools/utils/path';
import { McpAccessMode, PrismaClient } from '@prisma/client';
import type { TestFn } from 'ava';
import ava from 'ava';
import { nanoid } from 'nanoid';
import Sinon from 'sinon';
import { z } from 'zod';

import {
  EventBus,
  JOB_SIGNAL,
  JobQueue,
  RequestMutex,
  SpaceAccessDenied,
} from '../../base';
import { ConfigModule } from '../../base/config';
import { AuthService } from '../../core/auth';
import { QuotaModule } from '../../core/quota';
import { QuotaStateService } from '../../core/quota/state';
import { StorageModule, WorkspaceBlobStorage } from '../../core/storage';
import {
  ContextCategories,
  CopilotSessionModel,
  EMBEDDING_DIMENSIONS,
  Models,
  WorkspaceMemberStatus,
  WorkspaceModel,
  WorkspaceRole,
} from '../../models';
import { addDocToRootDoc, type LlmToolCallbackRequest } from '../../native';
import { CopilotModule } from '../../plugins/copilot';
import { CopilotContextService } from '../../plugins/copilot/context';
import { CopilotContextResolver } from '../../plugins/copilot/context/resolver';
import { ContextMemoryService } from '../../plugins/copilot/context-memory-service';
import {
  chatMessageFromTurn,
  turnFromChatMessage,
} from '../../plugins/copilot/core';
import { CopilotCronJobs } from '../../plugins/copilot/cron';
import {
  CopilotEmbeddingClientService,
  CopilotEmbeddingJob,
  MockEmbeddingClient,
} from '../../plugins/copilot/embedding';
import { MCP_CAPABILITIES } from '../../plugins/copilot/mcp/capabilities';
import { McpCredentialService } from '../../plugins/copilot/mcp/credential';
import { WorkspaceMcpProvider } from '../../plugins/copilot/mcp/provider';
import {
  PromptService,
  type ResolvedPrompt,
} from '../../plugins/copilot/prompt';
import {
  CopilotProviderFactory,
  CopilotProviderType,
  ModelInputType,
  ModelOutputType,
  OpenAIProvider,
} from '../../plugins/copilot/providers';
import { TextStreamParser } from '../../plugins/copilot/providers/utils';
import { CopilotResolver } from '../../plugins/copilot/resolver';
import { ActionRuntimeBridge } from '../../plugins/copilot/runtime/action-runtime-bridge';
import { CapabilityRuntime } from '../../plugins/copilot/runtime/capability-runtime';
import {
  parsePromptRenderContract,
  parsePromptSessionContract,
} from '../../plugins/copilot/runtime/contracts';
import { projectActionEventToChatEvent } from '../../plugins/copilot/runtime/hosts/action-stream-host';
import { CapabilityPolicyHost } from '../../plugins/copilot/runtime/hosts/capability-policy-host';
import { ConversationHost } from '../../plugins/copilot/runtime/hosts/conversation-host';
import { ImageResultHost } from '../../plugins/copilot/runtime/hosts/image-result-host';
import { ModelSelectionPolicy } from '../../plugins/copilot/runtime/model-selection-policy';
import { PromptRuntime } from '../../plugins/copilot/runtime/prompt-runtime';
import { getProviderRuntimeHost } from '../../plugins/copilot/runtime/provider-runtime-context';
import { TaskPolicy } from '../../plugins/copilot/runtime/task-policy';
import { executeToolCall } from '../../plugins/copilot/runtime/tool/bridge';
import { TurnOrchestrator } from '../../plugins/copilot/runtime/turn-orchestrator';
import { ChatSession, ChatSessionService } from '../../plugins/copilot/session';
import { CopilotStorage } from '../../plugins/copilot/storage';
import type {
  CopilotToolExecuteOptions,
  CopilotToolSet,
} from '../../plugins/copilot/tools';
import { CopilotTranscriptionService } from '../../plugins/copilot/transcript';
import { CopilotWorkspaceService } from '../../plugins/copilot/workspace';
import { PaymentModule } from '../../plugins/payment';
import { SubscriptionService } from '../../plugins/payment/service';
import { SubscriptionStatus } from '../../plugins/payment/types';
import { installMockCopilotRuntime, MockCopilotProvider } from '../mocks';
import { TestingPromptService } from '../mocks/prompt-service.mock';
import { createTestingApp, TestingApp } from '../utils';
import { seedProjectSourceGrant } from '../utils/project-source-grant';
import { singleUserPromptMessages, systemPrompt } from './prompt-test-helper';

type Context = {
  auth: AuthService;
  module: TestingApp;
  db: PrismaClient;
  event: EventBus;
  models: Models;
  workspace: WorkspaceModel;
  workspaceStorage: WorkspaceBlobStorage;
  copilotSession: CopilotSessionModel;
  context: CopilotContextService;
  prompt: TestingPromptService;
  transcript: CopilotTranscriptionService;
  workspaceEmbedding: CopilotWorkspaceService;
  factory: CopilotProviderFactory;
  session: ChatSessionService;
  taskPolicy: TaskPolicy;
  promptRuntime: PromptRuntime;
  chatRuntime: CapabilityRuntime;
  conversationHost: ConversationHost;
  embeddingClients: CopilotEmbeddingClientService;
  jobs: CopilotEmbeddingJob;
  imageResults: ImageResultHost;
  orchestrator: TurnOrchestrator;
  storage: CopilotStorage;
  actionBridge: ActionRuntimeBridge;
  cronJobs: CopilotCronJobs;
  subscription: SubscriptionService;
  quotaState: QuotaStateService;
  mcpCredentials: McpCredentialService;
  mcpProvider: WorkspaceMcpProvider;
};

const buildTurn = (
  sessionId: string,
  message: Parameters<typeof turnFromChatMessage>[0]
) => turnFromChatMessage(message, sessionId);

const cleanSnapshotObject = (obj: unknown, omittedKeys: string[] = []) =>
  JSON.parse(
    JSON.stringify(obj, (k, v) =>
      ['id', 'createdAt', ...omittedKeys].includes(k) ||
      v === null ||
      (typeof v === 'object' && !Object.keys(v).length)
        ? undefined
        : v
    )
  );

const cleanFinalMessages = (messages: unknown) =>
  cleanSnapshotObject(messages, ['attachments']);

const normalizeModelListForAssertion = (models: unknown[]) =>
  models.map(model => {
    const {
      effectiveSourceFingerprint: _effectiveSourceFingerprint,
      effectiveSourceFingerprintInputs: _effectiveSourceFingerprintInputs,
      effectiveSourceFingerprintVersion: _effectiveSourceFingerprintVersion,
      ...stableModel
    } = model as Record<string, unknown>;
    return stableModel;
  });

function taskRouteTargetFingerprintFixture(input: {
  featureKind: string;
  requestedModelConfigKey?: string;
  requestedModelConfigPath?: string;
  requestedModelId?: string;
  requestedModelSource?: string;
  targets: string[];
}) {
  return createHash('sha256')
    .update(
      stableActionRunDiagnosticsStringifyFixture({
        featureKind: input.featureKind,
        requestedModelConfigKey: input.requestedModelConfigKey ?? null,
        requestedModelConfigPath: input.requestedModelConfigPath ?? null,
        requestedModelId: input.requestedModelId ?? null,
        requestedModelSource: input.requestedModelSource ?? null,
        targets: input.targets,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function stableActionRunDiagnosticsStringifyFixture(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableActionRunDiagnosticsStringifyFixture).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => {
        const item = (value as Record<string, unknown>)[key];
        return item === undefined
          ? null
          : `${JSON.stringify(key)}:${stableActionRunDiagnosticsStringifyFixture(item)}`;
      })
      .filter(Boolean)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function actionRunTimelineRouteEvidenceFingerprintFixture(input: {
  actualRouteCount: number;
  eventType: string;
  fallbackProviderIds: string[];
  kind: string | null;
  routeBehaviorFlags: string[];
  routeCanonicalModelKeys: string[];
  routeCount: number;
  routeCountMismatch: boolean;
  routeDimensionEvidence: string[];
  routeModelBackendKinds: string[];
  routeTargets: string[];
  stepId: string | null;
}) {
  return createHash('sha256')
    .update(
      stableActionRunDiagnosticsStringifyFixture({
        version: 'agent-runtime-timeline-route-evidence/v1',
        ...input,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function actionRunTimelineRouteEvidenceSetFingerprintFixture(
  routeEvidenceFingerprints: string[]
) {
  return createHash('sha256')
    .update(
      stableActionRunDiagnosticsStringifyFixture({
        version: 'agent-runtime-timeline-route-evidence-set/v1',
        routeEvidenceFingerprints,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function actionRunAgentRuntimeProjectionContractFingerprintFixture(input: {
  agentRuntimeProjectedRunStatuses: string[];
  agentRuntimeProjectedSchemaComponents: string[];
  agentRuntimeProjectedStepStatuses: string[];
  agentRuntimeProjectedStepTypes: string[];
  agentRuntimeProjectedTimelineEventTypes: string[];
  agentRuntimeProjectionGaps: string[];
  agentRuntimeProjectionSource: string;
  agentRuntimeRunStatusGaps: string[];
  agentRuntimeSchemaReadiness: string;
  agentRuntimeSchemaReadinessGaps: string[];
  agentRuntimeStepStatusGaps: string[];
  agentRuntimeTargetRunStatuses: string[];
  agentRuntimeTargetSchemaComponents: string[];
  agentRuntimeTargetStepStatuses: string[];
  agentRuntimeTargetStepTypes: string[];
  agentRuntimeTargetTimelineEventTypes: string[];
  agentRuntimeTimelineGaps: string[];
  agentRuntimeUnsupportedRunStatuses: string[];
  agentRuntimeUnsupportedStepStatuses: string[];
  agentRuntimeUnsupportedStepTypes: string[];
  agentRuntimeUnsupportedTimelineEventTypes: string[];
}) {
  return createHash('sha256')
    .update(
      stableActionRunDiagnosticsStringifyFixture({
        version: 'agent-runtime-projection-contract/v1',
        ...input,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function actionRunAgentRuntimeProjectionContractFingerprintFromDiagnosticsFixture(item: {
  agentRuntimeProjectedRunStatuses: string[];
  agentRuntimeProjectedSchemaComponents: string[];
  agentRuntimeProjectedStepStatuses: string[];
  agentRuntimeProjectedStepTypes: string[];
  agentRuntimeProjectedTimelineEventTypes: string[];
  agentRuntimeProjectionGaps: string[];
  agentRuntimeProjectionSource: string;
  agentRuntimeRunStatusGaps: string[];
  agentRuntimeSchemaReadiness: string;
  agentRuntimeSchemaReadinessGaps: string[];
  agentRuntimeStepStatusGaps: string[];
  agentRuntimeTargetRunStatuses: string[];
  agentRuntimeTargetSchemaComponents: string[];
  agentRuntimeTargetStepStatuses: string[];
  agentRuntimeTargetStepTypes: string[];
  agentRuntimeTargetTimelineEventTypes: string[];
  agentRuntimeTimelineGaps: string[];
  agentRuntimeUnsupportedRunStatuses: string[];
  agentRuntimeUnsupportedStepStatuses: string[];
  agentRuntimeUnsupportedStepTypes: string[];
  agentRuntimeUnsupportedTimelineEventTypes: string[];
}) {
  return actionRunAgentRuntimeProjectionContractFingerprintFixture({
    agentRuntimeProjectedRunStatuses: item.agentRuntimeProjectedRunStatuses,
    agentRuntimeProjectedSchemaComponents:
      item.agentRuntimeProjectedSchemaComponents,
    agentRuntimeProjectedStepStatuses: item.agentRuntimeProjectedStepStatuses,
    agentRuntimeProjectedStepTypes: item.agentRuntimeProjectedStepTypes,
    agentRuntimeProjectedTimelineEventTypes:
      item.agentRuntimeProjectedTimelineEventTypes,
    agentRuntimeProjectionGaps: item.agentRuntimeProjectionGaps,
    agentRuntimeProjectionSource: item.agentRuntimeProjectionSource,
    agentRuntimeRunStatusGaps: item.agentRuntimeRunStatusGaps,
    agentRuntimeSchemaReadiness: item.agentRuntimeSchemaReadiness,
    agentRuntimeSchemaReadinessGaps: item.agentRuntimeSchemaReadinessGaps,
    agentRuntimeStepStatusGaps: item.agentRuntimeStepStatusGaps,
    agentRuntimeTargetRunStatuses: item.agentRuntimeTargetRunStatuses,
    agentRuntimeTargetSchemaComponents: item.agentRuntimeTargetSchemaComponents,
    agentRuntimeTargetStepStatuses: item.agentRuntimeTargetStepStatuses,
    agentRuntimeTargetStepTypes: item.agentRuntimeTargetStepTypes,
    agentRuntimeTargetTimelineEventTypes:
      item.agentRuntimeTargetTimelineEventTypes,
    agentRuntimeTimelineGaps: item.agentRuntimeTimelineGaps,
    agentRuntimeUnsupportedRunStatuses: item.agentRuntimeUnsupportedRunStatuses,
    agentRuntimeUnsupportedStepStatuses:
      item.agentRuntimeUnsupportedStepStatuses,
    agentRuntimeUnsupportedStepTypes: item.agentRuntimeUnsupportedStepTypes,
    agentRuntimeUnsupportedTimelineEventTypes:
      item.agentRuntimeUnsupportedTimelineEventTypes,
  });
}

function actionRunAgentRuntimeDiagnosticsFingerprintFixture(input: {
  agentRuntimeNativeTraceEventTypes: string[];
  agentRuntimeProjectionContractFingerprint: string;
  agentRuntimeTimelineRouteEvidenceSetFingerprint: string;
  hasPreparedRouteTrace: boolean;
  preparedRouteActualCount: number;
  preparedRouteCount: number;
  preparedRouteStepCount: number;
  preparedRouteStepRouteCountMismatches: string[];
  preparedRouteStepRouteCounts: string[];
}) {
  return createHash('sha256')
    .update(
      stableActionRunDiagnosticsStringifyFixture({
        version: 'agent-runtime-diagnostics/v1',
        ...input,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function actionRunAgentRuntimeDiagnosticsFingerprintFromDiagnosticsFixture(item: {
  agentRuntimeNativeTraceEventTypes: string[];
  agentRuntimeProjectionContractFingerprint: string;
  agentRuntimeTimelineRouteEvidenceSetFingerprint: string;
  hasPreparedRouteTrace: boolean;
  preparedRouteActualCount: number;
  preparedRouteCount: number;
  preparedRouteStepCount: number;
  preparedRouteStepRouteCountMismatches: string[];
  preparedRouteStepRouteCounts: string[];
}) {
  return actionRunAgentRuntimeDiagnosticsFingerprintFixture({
    agentRuntimeNativeTraceEventTypes: item.agentRuntimeNativeTraceEventTypes,
    agentRuntimeProjectionContractFingerprint:
      item.agentRuntimeProjectionContractFingerprint,
    agentRuntimeTimelineRouteEvidenceSetFingerprint:
      item.agentRuntimeTimelineRouteEvidenceSetFingerprint,
    hasPreparedRouteTrace: item.hasPreparedRouteTrace,
    preparedRouteActualCount: item.preparedRouteActualCount,
    preparedRouteCount: item.preparedRouteCount,
    preparedRouteStepCount: item.preparedRouteStepCount,
    preparedRouteStepRouteCountMismatches:
      item.preparedRouteStepRouteCountMismatches,
    preparedRouteStepRouteCounts: item.preparedRouteStepRouteCounts,
  });
}

const test = ava as TestFn<Context>;
let userId: string;
let restoreMockCopilotNativeRuntime: (() => void) | undefined;

test.before(async t => {
  restoreMockCopilotNativeRuntime = installMockCopilotRuntime();
  const module = await createTestingApp({
    imports: [
      ConfigModule.override({
        copilot: {
          providers: {
            profiles: [],
            defaults: {},
            routePolicy: {},
            openai: {
              apiKey: process.env.COPILOT_OPENAI_API_KEY ?? '1',
              baseURL: 'https://api.openai.com/v1',
            },
            fal: {
              apiKey: process.env.COPILOT_FAL_API_KEY ?? '1',
            },
            anthropic: {
              apiKey: process.env.COPILOT_ANTHROPIC_API_KEY ?? '1',
            },
          },
          prompts: {
            defaults: {},
            overrides: [],
          },
          tasks: {
            models: {},
          },
          exa: {
            key: process.env.COPILOT_EXA_API_KEY ?? '1',
          },
        },
      }),
      PaymentModule,
      QuotaModule,
      StorageModule,
      CopilotModule,
    ],
    tapModule: builder => {
      builder.overrideProvider(RequestMutex).useValue({
        acquire: async () => ({
          async [Symbol.asyncDispose]() {},
        }),
      });
      builder.overrideProvider(PromptService).useClass(TestingPromptService);
      builder.overrideProvider(OpenAIProvider).useClass(MockCopilotProvider);
      builder.overrideProvider(SubscriptionService).useClass(
        class {
          select() {
            return { getSubscription: async () => undefined };
          }
        }
      );
    },
  });

  const auth = module.get(AuthService);
  const db = module.get(PrismaClient);
  const event = module.get(EventBus);
  const models = module.get(Models);
  const workspace = module.get(WorkspaceModel);
  const workspaceStorage = module.get(WorkspaceBlobStorage);
  const copilotSession = module.get(CopilotSessionModel);
  const prompt = module.get(PromptService) as TestingPromptService;
  const factory = module.get(CopilotProviderFactory);

  const session = module.get(ChatSessionService);
  const taskPolicy = module.get(TaskPolicy);
  const promptRuntime = module.get(PromptRuntime);
  const chatRuntime = module.get(CapabilityRuntime);
  const conversationHost = module.get(ConversationHost);
  const imageResults = module.get(ImageResultHost);
  const orchestrator = module.get(TurnOrchestrator);
  const actionBridge = module.get(ActionRuntimeBridge);
  const storage = module.get(CopilotStorage);

  const context = module.get(CopilotContextService);
  const embeddingClients = module.get(CopilotEmbeddingClientService);
  const jobs = module.get(CopilotEmbeddingJob);
  const transcript = module.get(CopilotTranscriptionService);
  const workspaceEmbedding = module.get(CopilotWorkspaceService);
  const cronJobs = module.get(CopilotCronJobs);
  const subscription = module.get(SubscriptionService);
  const quotaState = module.get(QuotaStateService);

  t.context.module = module;
  t.context.auth = auth;
  t.context.db = db;
  t.context.event = event;
  t.context.models = models;
  t.context.workspace = workspace;
  t.context.workspaceStorage = workspaceStorage;
  t.context.copilotSession = copilotSession;
  t.context.prompt = prompt;
  t.context.factory = factory;
  t.context.session = session;
  t.context.taskPolicy = taskPolicy;
  t.context.promptRuntime = promptRuntime;
  t.context.chatRuntime = chatRuntime;
  t.context.conversationHost = conversationHost;
  t.context.imageResults = imageResults;
  t.context.orchestrator = orchestrator;
  t.context.actionBridge = actionBridge;
  t.context.storage = storage;
  t.context.context = context;
  t.context.embeddingClients = embeddingClients;
  t.context.jobs = jobs;
  t.context.transcript = transcript;
  t.context.workspaceEmbedding = workspaceEmbedding;
  t.context.cronJobs = cronJobs;
  t.context.subscription = subscription;
  t.context.quotaState = quotaState;
  t.context.mcpCredentials = module.get(McpCredentialService);
  t.context.mcpProvider = module.get(WorkspaceMcpProvider);

  await module.initTestingDB();
});

let promptName = 'prompt';

test.beforeEach(async t => {
  Sinon.restore();
  const { auth, prompt } = t.context;
  prompt.reset();
  const user = await auth.signUp(`test-${randomUUID()}@affine.pro`, '123456');
  userId = user.id;
  promptName = randomUUID().replaceAll('-', '');
});

test.after.always(async t => {
  restoreMockCopilotNativeRuntime?.();
  await t.context.module?.close();
});

test('document cleanup reconciles missing and restored copilot state before ack', async t => {
  const { db, jobs, models, module, workspace } = t.context;
  const queue = module.get(JobQueue);
  const deleteEmbedding = Sinon.spy(
    models.copilotContext,
    'purgeWorkspaceEmbedding'
  );
  const scheduleEmbedding = Sinon.stub(
    jobs,
    'addDocEmbeddingQueueFromEvent'
  ).resolves();

  for (const [docId, restored, cleanupVersion] of [
    ['missing-doc', false, 'missing-version'],
    ['restored-doc', true, 'restored-version'],
  ] as const) {
    const ws = await workspace.create(userId);
    const root = addDocToRootDoc(Buffer.from([0, 0]), docId, docId);
    const missingRoot = addDocToRootDoc(
      Buffer.from([0, 0]),
      'live-doc',
      'Live'
    );
    await db.snapshot.create({
      data: {
        workspaceId: ws.id,
        id: ws.id,
        blob: restored ? root : missingRoot,
        state: Buffer.from([0, 0]),
        updatedAt: new Date(),
        createdAt: new Date(),
      },
    });
    if (restored) {
      await db.snapshot.create({
        data: {
          workspaceId: ws.id,
          id: docId,
          blob: addDocToRootDoc(Buffer.from([0, 0]), 'content', 'Content'),
          state: Buffer.from([0, 0]),
          updatedAt: new Date(),
          createdAt: new Date(),
        },
      });
    }

    await jobs.reconcileDocumentCleanup({
      workspaceId: ws.id,
      docId,
      cleanupVersion,
    });

    if (restored) {
      t.true(scheduleEmbedding.calledOnceWith({ workspaceId: ws.id, docId }));
      t.false(deleteEmbedding.called);
    } else {
      t.true(deleteEmbedding.calledOnceWith(ws.id, docId));
      t.false(scheduleEmbedding.called);
    }
    const { payload } = await module.queue.waitFor(
      'backendRuntime.ackDocumentCleanupEffect'
    );
    t.deepEqual(payload, {
      workspaceId: ws.id,
      docId,
      cleanupVersion,
      effect: 'copilot',
    });
    deleteEmbedding.resetHistory();
    scheduleEmbedding.resetHistory();
    (queue.add as Sinon.SinonStub).resetHistory();
  }
});

test.serial(
  'MCP credentials stay bound to their endpoint, workspace, and profile',
  async t => {
    const { db, mcpCredentials, mcpProvider, models, workspace } = t.context;
    const ws = await workspace.create(userId);
    const other = await workspace.create(userId);
    const issued = await mcpCredentials.create({
      userId,
      workspaceId: ws.id,
      name: 'Claude Desktop',
      accessMode: McpAccessMode.READ_WRITE,
      expirationDays: 90,
    });

    const authenticated = await mcpCredentials.authenticate(
      issued.token,
      ws.id
    );
    t.is(authenticated.userId, userId);
    await t.throwsAsync(mcpCredentials.authenticate(issued.token, other.id));

    const response = await t.context.module
      .POST(`/api/workspaces/${ws.id}/mcp`)
      .set('Authorization', `Bearer ${issued.token}`)
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'localmind-test', version: '1.0.0' },
        },
      })
      .expect(200);
    t.like(response.body, {
      jsonrpc: '2.0',
      id: 1,
      result: {
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: { name: 'localmind-ai', version: '3.4.0' },
      },
    });
    const instructions = response.body.result.instructions as string;
    t.regex(instructions, /LOCALMIND-SCOPED TOOL ROUTING/);
    t.regex(
      instructions,
      /For every other request directed to LocalMind that asks for an answer or action/
    );
    t.regex(instructions, /follow-ups that request additional work/);
    t.regex(instructions, /Do not use this server as a global request router/);
    t.regex(instructions, /Codex, Claude, or other MCP clients/);
    t.regex(instructions, /use get_localmind_task directly/);
    t.regex(instructions, /use control_localmind_task directly/);
    t.true(
      instructions.indexOf('use get_localmind_task directly') <
        instructions.indexOf('For every other request directed to LocalMind')
    );
    t.true(
      instructions.indexOf('use control_localmind_task directly') <
        instructions.indexOf('For every other request directed to LocalMind')
    );
    t.notRegex(instructions, /every new user request/i);
    t.regex(
      instructions,
      /include them directly in delegate_to_localmind\.attachments/
    );
    t.notRegex(instructions, /upload_localmind_attachment/);
    t.regex(instructions, /internal AI tools such as doc_create or doc_read/);
    t.regex(instructions, /taskId is known from delegate_to_localmind/);

    const toolsResponse = await t.context.module
      .POST(`/api/workspaces/${ws.id}/mcp`)
      .set('Authorization', `Bearer ${issued.token}`)
      .set('MCP-Protocol-Version', '2025-06-18')
      .send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
      .expect(200);
    const advertisedTools = toolsResponse.body.result.tools as Array<{
      name: string;
      title: string;
      description: string;
      inputSchema: {
        properties?: Record<string, { description?: string }>;
      };
      outputSchema?: Record<string, unknown>;
      annotations: Record<string, boolean>;
    }>;
    t.deepEqual(
      advertisedTools.map(tool => tool.name),
      ['delegate_to_localmind', 'get_localmind_task', 'control_localmind_task']
    );
    const delegateTool = advertisedTools.find(
      tool => tool.name === 'delegate_to_localmind'
    )!;
    t.is(delegateTool.title, 'Start a LocalMind Task');
    t.regex(
      delegateTool.description,
      /after excluding existing-task status and cancellation intents/
    );
    t.regex(delegateTool.description, /use get_localmind_task instead/);
    t.regex(delegateTool.description, /use control_localmind_task instead/);
    t.regex(
      delegateTool.description,
      /follow-ups that request additional work/
    );
    t.regex(delegateTool.description, /not a global router/);
    t.regex(delegateTool.description, /Codex, Claude, or other host agents/);
    t.regex(delegateTool.description, /Merely mentioning/);
    t.notRegex(delegateTool.description, /every new user request/i);
    t.regex(
      delegateTool.description,
      /For every other request directed to LocalMind/
    );
    t.regex(delegateTool.description, /never look for public doc_create/);
    t.regex(
      delegateTool.inputSchema.properties?.request?.description ?? '',
      /complete self-contained request/
    );
    t.regex(
      delegateTool.inputSchema.properties?.request?.description ?? '',
      /follow-up, revision, continuation, or retry/
    );
    t.regex(
      delegateTool.inputSchema.properties?.documentIds?.description ?? '',
      /Existing document IDs/
    );
    t.regex(
      delegateTool.inputSchema.properties?.attachments?.description ?? '',
      /same tool call/
    );
    t.regex(
      delegateTool.inputSchema.properties?.attachmentIds?.description ?? '',
      /Previously delegated attachments/
    );
    t.regex(
      delegateTool.inputSchema.properties?.idempotencyKey?.description ?? '',
      /Reuse it only to retry identical/
    );
    t.false(delegateTool.annotations.readOnlyHint);

    const getTaskTool = advertisedTools.find(
      tool => tool.name === 'get_localmind_task'
    )!;
    t.is(getTaskTool.title, 'Check a LocalMind Task');
    t.regex(getTaskTool.description, /status, progress, or final result/);
    t.regex(getTaskTool.description, /Never create or guess a taskId/);
    t.regex(getTaskTool.description, /additional work, revisions/);
    t.regex(
      getTaskTool.inputSchema.properties?.taskId?.description ?? '',
      /not a document ID/
    );
    t.true(getTaskTool.annotations.readOnlyHint);

    const controlTool = advertisedTools.find(
      tool => tool.name === 'control_localmind_task'
    )!;
    t.is(controlTool.title, 'Cancel a LocalMind Task');
    t.regex(controlTool.description, /user explicitly asks to stop or cancel/);
    t.regex(controlTool.description, /only valid action is cancel/);
    t.regex(
      controlTool.inputSchema.properties?.action?.description ?? '',
      /approval, rejection, retry, and resume are not supported/
    );
    t.false(controlTool.annotations.readOnlyHint);
    t.true(controlTool.annotations.destructiveHint);
    t.true(controlTool.annotations.idempotentHint);
    t.true(advertisedTools.every(tool => !!tool.outputSchema));

    const invalidVersionResponse = await t.context.module
      .POST(`/api/workspaces/${ws.id}/mcp`)
      .set('Authorization', `Bearer ${issued.token}`)
      .set('MCP-Protocol-Version', '2099-01-01')
      .send({ jsonrpc: '2.0', id: 3, method: 'ping', params: {} })
      .expect(400);
    t.like(invalidVersionResponse.body, {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600 },
    });

    const modernBatchResponse = await t.context.module
      .POST(`/api/workspaces/${ws.id}/mcp`)
      .set('Authorization', `Bearer ${issued.token}`)
      .set('MCP-Protocol-Version', '2025-06-18')
      .send([{ jsonrpc: '2.0', id: 4, method: 'ping', params: {} }])
      .expect(400);
    t.like(modernBatchResponse.body, {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600 },
    });

    const invalidNotificationResponse = await t.context.module
      .POST(`/api/workspaces/${ws.id}/mcp`)
      .set('Authorization', `Bearer ${issued.token}`)
      .set('MCP-Protocol-Version', '2025-06-18')
      .send({ jsonrpc: '2.0', method: 'tools/call', params: {} })
      .expect(202);
    t.is(invalidNotificationResponse.text, '');

    const server = await mcpProvider.for(
      userId,
      ws.id,
      McpAccessMode.READ_WRITE
    );
    t.is(server.name, 'localmind-ai');
    t.deepEqual(
      server.tools.map(tool => tool.name),
      ['delegate_to_localmind', 'get_localmind_task', 'control_localmind_task']
    );
    const delegate = server.tools.find(
      tool => tool.name === 'delegate_to_localmind'
    );
    const invalidArguments = await delegate!.execute(
      { request: 'answer this', unexpected: true },
      { signal: new AbortController().signal }
    );
    t.true(invalidArguments.isError);
    t.regex(invalidArguments.content[0].text, /^Invalid arguments:/);
    const getTask = server.tools.find(
      tool => tool.name === 'get_localmind_task'
    );
    const invalidTaskQuery = await getTask!.execute(
      { taskId: 'task-id', waitMs: 30_001 },
      { signal: new AbortController().signal }
    );
    t.true(invalidTaskQuery.isError);
    t.regex(invalidTaskQuery.content[0].text, /^Invalid arguments:/);
    const controlTask = server.tools.find(
      tool => tool.name === 'control_localmind_task'
    );
    const invalidTaskControl = await controlTask!.execute(
      {
        taskId: 'task-id',
        action: 'approve',
        idempotencyKey: 'invalid-control',
      },
      { signal: new AbortController().signal }
    );
    t.true(invalidTaskControl.isError);
    t.regex(invalidTaskControl.content[0].text, /^Invalid arguments:/);

    const rotated = await mcpCredentials.rotate(
      issued.credential.id,
      userId,
      ws.id,
      30
    );
    const listed = await mcpCredentials.list(userId, ws.id);
    t.is(listed.length, 1);
    t.is(listed[0].status, 'ROTATING');
    t.deepEqual(listed[0].capabilities, [...MCP_CAPABILITIES]);
    await mcpCredentials.authenticate(issued.token, ws.id);
    await mcpCredentials.revoke(rotated.credential.id, userId, ws.id);
    await t.throwsAsync(mcpCredentials.authenticate(issued.token, ws.id));
    await t.throwsAsync(mcpCredentials.authenticate(rotated.token, ws.id));

    const disabled = await mcpCredentials.create({
      userId,
      workspaceId: ws.id,
      name: 'Disabled user',
      accessMode: McpAccessMode.READ_ONLY,
      expirationDays: 30,
    });
    await models.user.update(userId, { disabled: true });
    await t.throwsAsync(mcpCredentials.authenticate(disabled.token, ws.id));

    await models.user.update(userId, { disabled: false });
    await db.mcpCredential.update({
      where: { id: disabled.credential.id },
      data: { expiresAt: new Date(0) },
    });
    await t.throwsAsync(mcpCredentials.authenticate(disabled.token, ws.id));
  }
);

test.serial(
  'MCP tool capabilities persist, rotate, and filter the advertised tools',
  async t => {
    const { mcpCredentials, mcpProvider, prompt, workspace } = t.context;
    const ws = await workspace.create(userId);
    await prompt.set(promptName, 'test', [
      { role: 'system', content: 'Answer {{query}}' },
    ]);
    t.throws(
      () =>
        mcpCredentials.capabilities(
          ['documents:read'],
          McpAccessMode.READ_ONLY
        ),
      { message: 'Unsupported MCP capabilities: documents:read' }
    );
    t.throws(
      () =>
        mcpCredentials.capabilities(
          ['upload_localmind_attachment'],
          McpAccessMode.READ_WRITE
        ),
      { message: 'Unsupported MCP capabilities: upload_localmind_attachment' }
    );
    const issued = await mcpCredentials.create({
      userId,
      workspaceId: ws.id,
      name: 'Scoped AI client',
      accessMode: McpAccessMode.READ_ONLY,
      capabilities: ['delegate_to_localmind', 'get_localmind_task'],
      expirationDays: 90,
    });

    t.is(issued.credential.accessMode, McpAccessMode.READ_WRITE);
    t.deepEqual(
      [...issued.credential.capabilities].sort((a, b) => a.localeCompare(b)),
      ['delegate_to_localmind', 'get_localmind_task']
    );

    const server = await mcpProvider.for(
      userId,
      ws.id,
      issued.credential.capabilities
    );
    const toolNames = new Set(server.tools.map(tool => tool.name));
    t.deepEqual(
      [...toolNames],
      ['delegate_to_localmind', 'get_localmind_task']
    );

    const workspaceServer = await mcpProvider.for(userId, ws.id, [
      'control_localmind_task',
    ]);
    t.deepEqual(
      workspaceServer.tools.map(tool => tool.name),
      ['control_localmind_task']
    );

    const completeServer = await mcpProvider.for(
      userId,
      ws.id,
      MCP_CAPABILITIES
    );
    const completeToolNames = completeServer.tools.map(tool => tool.name);
    t.deepEqual(completeToolNames, [
      'delegate_to_localmind',
      'get_localmind_task',
      'control_localmind_task',
    ]);
    t.true(completeServer.tools.every(tool => !!tool.outputSchema));

    const rotated = await mcpCredentials.rotate(
      issued.credential.id,
      userId,
      ws.id,
      30
    );
    t.deepEqual(
      [...rotated.credential.capabilities].sort((a, b) => a.localeCompare(b)),
      [...issued.credential.capabilities].sort((a, b) => a.localeCompare(b))
    );
  }
);

test.serial('MCP redacts unexpected tool failures from clients', async t => {
  const { mcpCredentials, mcpProvider, workspace } = t.context;
  const ws = await workspace.create(userId);
  const issued = await mcpCredentials.create({
    userId,
    workspaceId: ws.id,
    name: 'Failure redaction',
    accessMode: McpAccessMode.READ_ONLY,
    expirationDays: 30,
  });
  const internalFailure = 'postgresql://private-host/internal-table';

  Sinon.stub(mcpProvider, 'for').resolves({
    name: 'localmind-workspace',
    version: '2.0.0',
    instructions: 'Test server',
    tools: [
      {
        name: 'failing_tool',
        title: 'Failing Tool',
        description: 'Throws an unexpected internal error',
        inputSchema: { type: 'object' },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        execute: async () => {
          throw new Error(internalFailure);
        },
      },
    ],
  });

  const response = await t.context.module
    .POST(`/api/workspaces/${ws.id}/mcp`)
    .set('Authorization', `Bearer ${issued.token}`)
    .set('MCP-Protocol-Version', '2025-06-18')
    .send({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'failing_tool', arguments: {} },
    })
    .expect(200);

  t.deepEqual(response.body, {
    jsonrpc: '2.0',
    id: 1,
    error: { code: -32001, message: 'Error executing tool: failing_tool' },
  });
  t.false(JSON.stringify(response.body).includes(internalFailure));
});

test('should reject context file uploads after workspace write access is revoked', async t => {
  const { auth, context, models, prompt, session, storage, workspace } =
    t.context;
  const contextResolver = await t.context.module.resolve(
    CopilotContextResolver
  );

  const owner = await auth.signUp(`test-${randomUUID()}@affine.pro`, '123456');
  const member = await auth.signUp(`test-${randomUUID()}@affine.pro`, '123456');
  const ws = await workspace.create(owner.id);

  await models.workspaceUser.set(ws.id, member.id, WorkspaceRole.Collaborator, {
    status: WorkspaceMemberStatus.Accepted,
  });
  await prompt.set(promptName, 'test', [
    { role: 'system', content: 'hello {{word}}' },
  ]);

  const sessionId = await session.create({
    userId: member.id,
    workspaceId: ws.id,
    docId: randomUUID(),
    promptName,
    pinned: false,
  });
  const contextSession = await context.create(sessionId);
  await models.workspaceUser.set(ws.id, member.id, WorkspaceRole.External);

  Sinon.stub(context, 'canEmbedding').get(() => true);
  Sinon.stub(context, 'embeddingClient').get(() => new MockEmbeddingClient());
  const put = Sinon.stub(storage, 'put').resolves();
  const buffer = Buffer.from('test pdf');

  await t.throwsAsync(
    contextResolver.addContextFile(
      { id: member.id } as any,
      {
        req: {
          headers: {
            'content-length': String(buffer.length),
          },
        },
      } as any,
      { contextId: contextSession.id },
      {
        filename: 'sample.pdf',
        mimetype: 'application/pdf',
        createReadStream: () => Readable.from(buffer),
      } as any
    ),
    {
      instanceOf: SpaceAccessDenied,
    }
  );

  t.false(put.called);
});

test('should prioritize user-added context file embedding jobs', async t => {
  const { context, jobs, prompt, session, storage, workspace } = t.context;
  const contextResolver = await t.context.module.resolve(
    CopilotContextResolver
  );

  const ws = await workspace.create(userId);
  await prompt.set(promptName, 'test', [
    { role: 'system', content: 'hello {{word}}' },
  ]);

  const sessionId = await session.create({
    userId,
    workspaceId: ws.id,
    docId: randomUUID(),
    promptName,
    pinned: false,
  });
  const contextSession = await context.create(sessionId);

  Sinon.stub(context, 'canEmbedding').get(() => true);
  Sinon.stub(context, 'embeddingClient').get(() => new MockEmbeddingClient());
  const put = Sinon.stub(storage, 'put').resolves();
  const queue = Sinon.stub(jobs, 'addFileEmbeddingQueue').resolves();
  const buffer = Buffer.from('test pdf');

  await contextResolver.addContextFile(
    { id: userId } as any,
    {
      req: {
        headers: {
          'content-length': String(buffer.length),
        },
      },
    } as any,
    { contextId: contextSession.id },
    {
      filename: 'sample.pdf',
      mimetype: 'application/pdf',
      createReadStream: () => Readable.from(buffer),
    } as any
  );

  t.true(put.calledOnce);
  t.true(queue.calledOnce);
  t.deepEqual(queue.firstCall.args[0], {
    userId,
    workspaceId: ws.id,
    contextId: contextSession.id,
    blobId: createHash('sha256').update(buffer).digest('base64url'),
    fileId: queue.firstCall.args[0].fileId,
    fileName: 'sample.pdf',
  });
  t.deepEqual(queue.firstCall.args[1], { priority: 0 });
});

test('should resolve context sessions with the shared embedding client', async t => {
  const { context, embeddingClients, prompt, session, workspace } = t.context;

  const ws = await workspace.create(userId);
  await prompt.set(promptName, 'test', [
    { role: 'system', content: 'hello {{word}}' },
  ]);

  const sessionId = await session.create({
    userId,
    workspaceId: ws.id,
    docId: randomUUID(),
    promptName,
    pinned: false,
  });
  const client = new MockEmbeddingClient();

  Sinon.stub(embeddingClients, 'refresh').resolves(undefined);
  Sinon.stub(embeddingClients, 'getClient').returns(client);
  await context.onConfigChanged();

  const contextSession = await context.create(sessionId);
  t.is(context.embeddingClient, client);
  await t.notThrowsAsync(context.get(contextSession.id));
});

test('should be able to render prompt', async t => {
  const { prompt } = t.context;

  const msg = {
    role: 'system' as const,
    content: 'translate {{src_language}} to {{dest_language}}: {{content}}',
    params: { src_language: ['eng'], dest_language: ['chs', 'jpn', 'kor'] },
  };
  const params = {
    src_language: 'eng',
    dest_language: 'chs',
    content: 'hello world',
  };

  await prompt.set(promptName, 'test', [msg]);
  const testPrompt = await prompt.get(promptName);
  t.assert(testPrompt, 'should have prompt');
  t.is(
    prompt.finish(testPrompt!, params).pop()?.content,
    'translate eng to chs: hello world',
    'should render the prompt'
  );
  t.deepEqual(
    testPrompt?.paramKeys,
    Object.keys(params),
    'should have param keys'
  );
  t.deepEqual(testPrompt?.params, msg.params, 'should have params');
  // will use first option if a params not provided
  t.deepEqual(prompt.finish(testPrompt!, { src_language: 'abc' }), [
    {
      content: 'translate eng to chs: ',
      params: { dest_language: 'chs', src_language: 'eng' },
      role: 'system',
    },
  ]);
});

test('should be able to render listed prompt', async t => {
  const { prompt } = t.context;

  const msg = {
    role: 'system' as const,
    content: 'links:\n{{#links}}- {{.}}\n{{/links}}',
  };
  const params = {
    links: ['https://affine.pro', 'https://github.com/toeverything/affine'],
  };

  await prompt.set(promptName, 'test', [msg]);
  const testPrompt = await prompt.get(promptName);

  t.is(
    prompt.finish(testPrompt!, params).pop()?.content,
    'links:\n- https://affine.pro\n- https://github.com/toeverything/affine\n',
    'should render the prompt'
  );
});

test('context memories should stay private to their owner and scope', async t => {
  const { auth, db, models, prompt, session, workspace } = t.context;
  const otherUser = await auth.signUp(
    `memory-${randomUUID()}@affine.pro`,
    '123456'
  );
  const primaryWorkspace = await workspace.create(userId);
  const secondaryWorkspace = await workspace.create(userId);
  const otherWorkspace = await workspace.create(otherUser.id);
  const memory = models.copilotContextMemory;
  const projectA = await memory.createProject({
    createdByUserId: userId,
    name: 'Project A',
  });
  const projectB = await memory.createProject({
    createdByUserId: userId,
    name: 'Project B',
  });
  const cleanupProject = await memory.createProject({
    createdByUserId: userId,
    name: 'Document cleanup',
  });

  t.deepEqual(
    projectA.members.map(member => [member.userId, member.role]),
    [[userId, 'owner']]
  );
  t.deepEqual(
    (await memory.listProjects({ userId }))
      .map(project => project.id)
      .toSorted((left, right) => left.localeCompare(right)),
    [projectA.id, projectB.id, cleanupProject.id].toSorted((left, right) =>
      left.localeCompare(right)
    )
  );
  t.deepEqual(await memory.listProjects({ userId: otherUser.id }), []);
  const globalProjectRule = await models.copilotContextRule.createRule({
    ownerUserId: userId,
    workspaceId: primaryWorkspace.id,
    projectId: projectA.id,
    scope: 'project',
    name: 'Global project rule',
    applicationMode: 'always',
    priority: 1,
    conditions: {},
    content: 'Keep this project scoped across workspaces.',
  });
  t.is(globalProjectRule.workspaceId, null);
  t.true(
    (
      await models.copilotContextRule.listRules({
        ownerUserId: userId,
        workspaceId: secondaryWorkspace.id,
        projectIds: [projectA.id],
      })
    ).some(rule => rule.id === globalProjectRule.id),
    'a global Project rule is independent of the execution host workspace'
  );
  await t.throwsAsync(
    memory.put({
      ownerUserId: otherUser.id,
      workspaceId: primaryWorkspace.id,
      projectId: projectA.id,
      scope: 'project',
      kind: 'project_summary',
      visibility: 'private',
      content: 'NON_MEMBER_PROJECT_MEMORY',
    }),
    { message: /requires active project membership/ }
  );
  t.false(
    (
      await memory.listVisible({
        userId: otherUser.id,
        workspaceId: otherWorkspace.id,
        projectIds: [projectA.id],
      })
    ).some(item => item.projectId === projectA.id),
    'a non-member cannot widen visibility by supplying a Project id'
  );
  t.false(
    (
      await memory.listManageable({
        userId: otherUser.id,
        projectIds: [projectA.id],
        includeDisabled: true,
      })
    ).some(item => item.projectId === projectA.id),
    'a non-member cannot widen management scope by supplying a Project id'
  );
  t.false(
    (
      await models.copilotContextRule.listRules({
        ownerUserId: otherUser.id,
        workspaceId: otherWorkspace.id,
        projectIds: [projectA.id],
      })
    ).some(rule => rule.id === globalProjectRule.id),
    'a non-member cannot widen rule visibility by supplying a Project id'
  );

  await db.aiContextProjectMember.create({
    data: {
      projectId: projectA.id,
      userId: otherUser.id,
      role: 'member',
    },
  });
  await t.throwsAsync(
    models.copilotContextRule.createRule({
      ownerUserId: otherUser.id,
      projectId: projectA.id,
      scope: 'project',
      name: 'Member cannot create',
      applicationMode: 'always',
      priority: 1,
      conditions: {},
      content: 'A member must not set Project AI policy.',
    }),
    { message: /project not found/i }
  );
  t.true(
    (
      await models.copilotContextRule.listRules({
        ownerUserId: otherUser.id,
        workspaceId: otherWorkspace.id,
        projectIds: [projectA.id],
      })
    ).some(rule => rule.id === globalProjectRule.id),
    'a Project member sees rules created by another member'
  );
  await db.aiContextProjectMember.update({
    where: {
      projectId_userId: { projectId: projectA.id, userId: otherUser.id },
    },
    data: { role: 'owner' },
  });
  const otherAuthoredRule = await models.copilotContextRule.createRule({
    ownerUserId: otherUser.id,
    projectId: projectA.id,
    scope: 'project',
    name: 'Cross-owner project rule',
    applicationMode: 'always',
    priority: 2,
    conditions: {},
    content: 'Initial owner-authored content.',
  });
  const crossOwnerUpdate = await models.copilotContextRule.updateRule(
    otherAuthoredRule.id,
    userId,
    { content: 'Updated by another current Project owner.' }
  );
  t.is(crossOwnerUpdate?.ownerUserId, otherUser.id);
  t.is(crossOwnerUpdate?.revisions[0].createdByUserId, userId);
  await db.aiContextProjectMember.update({
    where: {
      projectId_userId: { projectId: projectA.id, userId: otherUser.id },
    },
    data: { role: 'member' },
  });
  t.is(
    await models.copilotContextRule.updateRule(
      otherAuthoredRule.id,
      otherUser.id,
      { content: 'Historical authorship must not grant management.' }
    ),
    null
  );
  t.false(
    await models.copilotContextRule.deleteRule(
      otherAuthoredRule.id,
      otherUser.id
    )
  );
  t.true(
    await models.copilotContextRule.deleteRule(otherAuthoredRule.id, userId)
  );

  await prompt.set(promptName, 'test', [
    { role: 'system', content: 'Global project scope test.' },
  ]);
  const memberSessionId = await session.create({
    userId,
    workspaceId: secondaryWorkspace.id,
    docId: 'doc-a',
    promptName,
    pinned: false,
    reuseLatestChat: false,
  });
  await db.aiSession.update({
    where: { id: memberSessionId },
    data: { selectedContextProjectId: projectA.id },
  });
  t.is(
    (await db.aiSession.findUnique({ where: { id: memberSessionId } }))
      ?.selectedContextProjectId,
    projectA.id
  );
  const crossAuthorSessionId = await session.create({
    userId: otherUser.id,
    workspaceId: otherWorkspace.id,
    docId: null,
    promptName,
    pinned: false,
    reuseLatestChat: false,
  });
  await db.aiSession.update({
    where: { id: crossAuthorSessionId },
    data: { selectedContextProjectId: projectA.id },
  });
  t.deepEqual(
    await models.copilotContextRule.recordHits({
      sessionId: memberSessionId,
      sourceTurnId: 'global-project-rule-hit',
      rules: [
        {
          ruleId: globalProjectRule.id,
          revisionId: globalProjectRule.revisions[0].id,
          matchReason: 'always',
          score: 1,
        },
      ],
      policies: [],
    }),
    { ruleCount: 1, policyCount: 0 }
  );

  const primaryProjectSessionId = await session.create({
    userId,
    workspaceId: primaryWorkspace.id,
    docId: 'doc-a',
    promptName,
    pinned: false,
    reuseLatestChat: false,
  });
  await db.aiSession.update({
    where: { id: primaryProjectSessionId },
    data: { selectedContextProjectId: projectA.id },
  });
  const projectFactKey = `project:cross-host:${randomUUID()}`;
  const projectDecision = (content: string) => ({
    operation: 'UPDATE' as const,
    factKey: projectFactKey,
    content,
    confidence: 1,
    importance: 0.8,
    sensitivity: 'private' as const,
    validFrom: new Date(),
    validUntil: null,
    expiresAt: null,
    reasonCode: 'cross_host_project_test',
  });
  const projectWriter = (
    ownerUserId: string,
    workspaceId: string,
    sourceSessionId: string,
    content: string
  ) =>
    memory.applyWriterDecision({
      ownerUserId,
      workspaceId,
      projectId: projectA.id,
      sourceSessionId,
      sourceTurnId: `turn-${workspaceId}`,
      scope: 'project',
      explicit: true,
      writerVersion: 'structured-memory-writer/test',
      decisionFingerprint: `project-writer-${randomUUID()}`,
      decision: projectDecision(content),
    });
  const projectEvents = await Promise.all([
    projectWriter(
      userId,
      primaryWorkspace.id,
      primaryProjectSessionId,
      'The project deployment region is us-west-1.'
    ),
    projectWriter(
      otherUser.id,
      otherWorkspace.id,
      crossAuthorSessionId,
      'The project deployment region is us-west-2.'
    ),
  ]);
  t.deepEqual(
    projectEvents
      .map(event => event.operation)
      .toSorted((left, right) => left.localeCompare(right)),
    ['ADD', 'UPDATE']
  );
  t.deepEqual(
    projectEvents
      .map(event => event.workspaceId)
      .toSorted((left, right) => (left ?? '').localeCompare(right ?? '')),
    [primaryWorkspace.id, otherWorkspace.id].toSorted((left, right) =>
      left.localeCompare(right)
    ),
    'writer events retain their execution host workspace'
  );
  const projectMemoryChain = await db.aiContextMemory.findMany({
    where: {
      projectId: projectA.id,
      factKey: projectFactKey,
      kind: 'auto_memory',
    },
  });
  t.is(projectMemoryChain.length, 2);
  t.true(projectMemoryChain.every(item => item.workspaceId === null));
  t.deepEqual(
    projectMemoryChain
      .map(item => item.ownerUserId)
      .toSorted((left, right) => left.localeCompare(right)),
    [userId, otherUser.id].toSorted((left, right) => left.localeCompare(right)),
    'each memory version retains its writing actor as audit provenance'
  );
  t.is(
    projectMemoryChain.filter(item => item.status === 'active').length,
    1,
    'cross-host writes share one active Project fact identity'
  );
  t.is(
    projectMemoryChain.filter(item => item.status === 'superseded').length,
    1
  );
  t.true(
    (
      await memory.listVisible({
        userId: otherUser.id,
        workspaceId: otherWorkspace.id,
        projectIds: [projectA.id],
      })
    ).some(item => item.factKey === projectFactKey),
    'a Project member sees the active version written by another member'
  );
  t.false(
    (
      await memory.listManageable({
        userId: otherUser.id,
        projectIds: [projectA.id],
        includeDisabled: true,
      })
    ).some(item => item.factKey === projectFactKey),
    'a Project member cannot manage the shared Project memory chain'
  );

  const nonMemberUser = await auth.signUp(
    `memory-non-member-${randomUUID()}@affine.pro`,
    '123456'
  );
  const nonMemberWorkspace = await workspace.create(nonMemberUser.id);
  const nonMemberSessionId = await session.create({
    userId: nonMemberUser.id,
    workspaceId: nonMemberWorkspace.id,
    docId: null,
    promptName,
    pinned: false,
    reuseLatestChat: false,
  });
  await t.throwsAsync(
    db.aiSession.update({
      where: { id: nonMemberSessionId },
      data: { selectedContextProjectId: projectA.id },
    }),
    { message: /requires active project membership/ }
  );

  await Promise.all([
    memory.put({
      ownerUserId: userId,
      scope: 'user',
      kind: 'rule',
      visibility: 'private',
      content: 'GLOBAL_VISIBLE_RULE',
    }),
    memory.put({
      ownerUserId: userId,
      workspaceId: primaryWorkspace.id,
      scope: 'workspace',
      kind: 'auto_memory',
      visibility: 'private',
      content: 'PRIVATE_WORKSPACE_VISIBLE',
    }),
    memory.put({
      ownerUserId: otherUser.id,
      workspaceId: primaryWorkspace.id,
      scope: 'workspace',
      kind: 'rule',
      visibility: 'private',
      content: 'OTHER_USER_RULE_HIDDEN',
    }),
    memory.put({
      ownerUserId: userId,
      workspaceId: primaryWorkspace.id,
      projectId: projectA.id,
      scope: 'project',
      kind: 'project_summary',
      visibility: 'private',
      content: 'PROJECT_A_VISIBLE',
    }),
    memory.put({
      ownerUserId: userId,
      workspaceId: primaryWorkspace.id,
      projectId: projectB.id,
      scope: 'project',
      kind: 'auto_memory',
      visibility: 'private',
      content: 'PROJECT_B_HIDDEN',
    }),
    memory.put({
      ownerUserId: otherUser.id,
      workspaceId: primaryWorkspace.id,
      scope: 'workspace',
      kind: 'auto_memory',
      visibility: 'private',
      content: 'OTHER_USER_PRIVATE_HIDDEN',
    }),
    memory.put({
      ownerUserId: userId,
      workspaceId: otherWorkspace.id,
      scope: 'workspace',
      kind: 'auto_memory',
      visibility: 'private',
      content: 'OTHER_WORKSPACE_HIDDEN',
    }),
    memory.put({
      ownerUserId: userId,
      workspaceId: primaryWorkspace.id,
      scope: 'workspace',
      kind: 'auto_memory',
      visibility: 'private',
      status: 'disabled',
      content: 'DISABLED_HIDDEN',
    }),
    memory.put({
      ownerUserId: userId,
      workspaceId: primaryWorkspace.id,
      docId: 'doc-cleanup',
      scope: 'document',
      kind: 'auto_memory',
      visibility: 'private',
      content: 'DELETED_DOCUMENT_MEMORY',
    }),
  ]);

  const visible = await memory.listVisible({
    userId,
    workspaceId: primaryWorkspace.id,
    docId: 'doc-a',
    projectIds: [projectA.id],
  });
  const projectFactVisible = visible.filter(
    item => item.factKey === projectFactKey
  );
  t.is(projectFactVisible.length, 1);
  const contents = visible
    .filter(item => item.factKey !== projectFactKey)
    .map(item => item.content);

  t.deepEqual(
    contents.toSorted((left, right) => left.localeCompare(right)),
    ['GLOBAL_VISIBLE_RULE', 'PRIVATE_WORKSPACE_VISIBLE', 'PROJECT_A_VISIBLE']
  );
  const multiDocumentVisible = await memory.listVisible({
    userId,
    workspaceId: primaryWorkspace.id,
    docIds: ['doc-a', 'doc-cleanup'],
    projectIds: [projectA.id],
  });
  t.true(
    multiDocumentVisible.some(
      item => item.content === 'DELETED_DOCUMENT_MEMORY'
    )
  );
  const allOwned = await memory.listManageable({
    userId,
    includeDisabled: true,
  });
  t.true(
    allOwned.some(item => item.content === 'OTHER_WORKSPACE_HIDDEN'),
    'an account-level management query should include every owner record'
  );
  t.false(allOwned.some(item => item.content === 'OTHER_USER_PRIVATE_HIDDEN'));

  t.deepEqual(
    await memory.removeDocumentReferences({
      workspaceId: primaryWorkspace.id,
      docId: 'doc-cleanup',
    }),
    { memoryCount: 1 }
  );
  t.false(
    (
      await memory.listManageable({
        userId,
        includeDisabled: true,
      })
    ).some(item => item.content === 'DELETED_DOCUMENT_MEMORY')
  );

  await memory.updateProject(projectA.id, userId, { status: 'archived' });
  t.is(
    (await db.aiSession.findUnique({ where: { id: memberSessionId } }))
      ?.selectedContextProjectId,
    null
  );
  await t.throwsAsync(
    db.aiContextProject.delete({
      where: { id: projectA.id },
    })
  );
  t.false(await memory.deleteProject(projectA.id, userId));
  t.false(
    (
      await memory.listManageable({
        userId,
        workspaceId: primaryWorkspace.id,
        projectIds: [projectA.id],
      })
    ).some(item => item.content === 'PROJECT_A_VISIBLE'),
    'archived Project memory is retained but no longer manageable'
  );
  t.truthy(await memory.getProject(projectA.id));
  t.truthy(
    await db.aiContextMemory.findFirst({
      where: {
        projectId: projectA.id,
        content: 'PROJECT_A_VISIBLE',
      },
    })
  );

  const auditUser = await auth.signUp(
    `memory-audit-${randomUUID()}@affine.pro`,
    '123456'
  );
  const auditWorkspace = await workspace.create(auditUser.id);
  const auditProject = await memory.createProject({
    createdByUserId: auditUser.id,
    name: 'Audit creator lifecycle',
  });
  await db.aiContextProjectMember.create({
    data: {
      projectId: auditProject.id,
      userId,
      role: 'owner',
    },
  });
  const auditSessionId = await session.create({
    userId: auditUser.id,
    workspaceId: auditWorkspace.id,
    docId: 'doc-audit',
    promptName,
    pinned: false,
    reuseLatestChat: false,
  });
  const retainedEvent = await memory.applyWriterDecision({
    ownerUserId: auditUser.id,
    workspaceId: auditWorkspace.id,
    projectId: auditProject.id,
    sourceSessionId: auditSessionId,
    sourceTurnId: 'audit-project-turn',
    scope: 'project',
    explicit: true,
    writerVersion: 'structured-memory-writer/test',
    decisionFingerprint: `audit-project-${randomUUID()}`,
    decision: {
      operation: 'ADD',
      factKey: `audit:project:${randomUUID()}`,
      content: 'Retain this Project memory after its author is deleted.',
      confidence: 1,
      importance: 0.8,
      sensitivity: 'private',
      validFrom: new Date(),
      validUntil: null,
      expiresAt: null,
      reasonCode: 'project_audit_retention',
    },
  });
  const retainedRule = await models.copilotContextRule.createRule({
    ownerUserId: auditUser.id,
    projectId: auditProject.id,
    scope: 'project',
    name: 'Retained Project rule',
    applicationMode: 'always',
    priority: 1,
    conditions: {},
    content: 'Retain this Project rule after its author is deleted.',
  });
  const personalEvent = await memory.applyWriterDecision({
    ownerUserId: auditUser.id,
    workspaceId: auditWorkspace.id,
    sourceSessionId: auditSessionId,
    sourceTurnId: 'audit-personal-turn',
    scope: 'workspace',
    explicit: true,
    writerVersion: 'structured-memory-writer/test',
    decisionFingerprint: `audit-personal-${randomUUID()}`,
    decision: {
      operation: 'ADD',
      factKey: `audit:personal:${randomUUID()}`,
      content: 'Delete this personal memory with its account.',
      confidence: 1,
      importance: 0.8,
      sensitivity: 'private',
      validFrom: new Date(),
      validUntil: null,
      expiresAt: null,
      reasonCode: 'personal_audit_cleanup',
    },
  });
  const personalRule = await models.copilotContextRule.createRule({
    ownerUserId: auditUser.id,
    scope: 'user',
    name: 'Personal cleanup rule',
    applicationMode: 'always',
    priority: 1,
    conditions: {},
    content: 'Delete this personal rule with its account.',
  });
  await db.user.delete({ where: { id: auditUser.id } });
  const retainedProject = await memory.getProject(auditProject.id);
  t.is(retainedProject?.createdByUserId, null);
  t.deepEqual(
    retainedProject?.members.map(member => [member.userId, member.role]),
    [[userId, 'owner']]
  );
  t.is(
    (
      await db.aiContextMemory.findUnique({
        where: { id: retainedEvent.memoryId! },
      })
    )?.ownerUserId,
    userId
  );
  t.like(
    await db.aiContextMemoryEvent.findUnique({
      where: { id: retainedEvent.id },
    }),
    { ownerUserId: null, sourceSessionId: null }
  );
  t.is(
    (await db.aiContextRule.findUnique({ where: { id: retainedRule.id } }))
      ?.ownerUserId,
    userId
  );
  t.is(
    (
      await db.aiContextRuleRevision.findUnique({
        where: { id: retainedRule.revisions[0].id },
      })
    )?.createdByUserId,
    null
  );
  t.is(
    await db.aiContextMemoryEvent.count({ where: { id: personalEvent.id } }),
    0
  );
  t.is(await db.aiContextRule.count({ where: { id: personalRule.id } }), 0);

  const soleOwner = await auth.signUp(
    `memory-sole-owner-${randomUUID()}@affine.pro`,
    '123456'
  );
  const soleOwnerProject = await memory.createProject({
    createdByUserId: soleOwner.id,
    name: 'Sole owner deletion guard',
  });
  await t.throwsAsync(
    db.$transaction(async transaction => {
      await transaction.user.delete({ where: { id: soleOwner.id } });
    }),
    { message: /must retain at least one owner/ }
  );
  t.truthy(await db.user.findUnique({ where: { id: soleOwner.id } }));
  t.deepEqual(
    (await memory.getProject(soleOwnerProject.id))?.members.map(member => [
      member.userId,
      member.role,
    ]),
    [[soleOwner.id, 'owner']]
  );
});

test('structured context memory lifecycle should version, expire, and undo facts', async t => {
  const { db, models, module, prompt, session, workspace } = t.context;
  const targetWorkspace = await workspace.create(userId);
  const memory = models.copilotContextMemory;
  const memoryService = module.get(ContextMemoryService);
  await prompt.set(promptName, 'test', [
    { role: 'system', content: 'Memory lifecycle test.' },
  ]);
  const sessionId = await session.create({
    userId,
    workspaceId: targetWorkspace.id,
    docId: null,
    promptName,
    pinned: false,
    reuseLatestChat: false,
  });
  const writerInput = (
    decisionFingerprint: string,
    decision: Parameters<typeof memory.applyWriterDecision>[0]['decision'],
    sourceTurnId: string
  ) => ({
    ownerUserId: userId,
    workspaceId: targetWorkspace.id,
    sourceSessionId: sessionId,
    sourceTurnId,
    scope: 'workspace' as const,
    explicit: true,
    writerVersion: 'structured-memory-writer/test',
    decisionFingerprint,
    decision,
  });
  const baseDecision = {
    factKey: 'preference:response_language',
    confidence: 1,
    importance: 0.9,
    sensitivity: 'private' as const,
    validFrom: new Date(),
    validUntil: null,
    expiresAt: null,
    reasonCode: 'explicit_user_directive',
  };
  const addInput = writerInput(
    `memory-add-${randomUUID()}`,
    {
      ...baseDecision,
      operation: 'ADD',
      content: 'Respond in Chinese.',
    },
    'turn-add'
  );
  const addEvent = await memory.applyWriterDecision(addInput);
  const replay = await memory.applyWriterDecision(addInput);
  t.is(addEvent.operation, 'ADD');
  t.is(replay.id, addEvent.id, 'decision fingerprints should be idempotent');

  const updateEvent = await memory.applyWriterDecision(
    writerInput(
      `memory-update-${randomUUID()}`,
      {
        ...baseDecision,
        operation: 'UPDATE',
        content: 'Respond in English.',
        validFrom: new Date(Date.now() + 1),
        reasonCode: 'user_correction',
      },
      'turn-update'
    )
  );
  t.is(updateEvent.operation, 'UPDATE');
  t.is(updateEvent.previousMemoryId, addEvent.memoryId);
  const superseded = await memory.get(addEvent.memoryId!);
  t.is(superseded?.status, 'superseded');
  t.truthy(superseded?.validUntil);

  const noopEvent = await memory.applyWriterDecision(
    writerInput(
      `memory-noop-${randomUUID()}`,
      {
        ...baseDecision,
        operation: 'UPDATE',
        content: 'Respond in English.',
        reasonCode: 'same_value_test',
      },
      'turn-noop'
    )
  );
  t.is(noopEvent.operation, 'NOOP');
  t.is(noopEvent.reasonCode, 'same_fact_value');

  const deleteEvent = await memory.applyWriterDecision(
    writerInput(
      `memory-delete-${randomUUID()}`,
      {
        ...baseDecision,
        operation: 'DELETE',
        content: null,
        reasonCode: 'explicit_user_directive',
      },
      'turn-delete'
    )
  );
  t.is(deleteEvent.operation, 'DELETE');
  t.is((await memory.get(updateEvent.memoryId!))?.status, 'deleted');

  const undoDelete = await memory.undoWriterEvent({
    eventId: deleteEvent.id,
    ownerUserId: userId,
    workspaceId: targetWorkspace.id,
  });
  t.is(undoDelete?.operation, 'UNDO');
  t.is((await memory.get(updateEvent.memoryId!))?.status, 'active');

  const undoUpdate = await memory.undoWriterEvent({
    eventId: updateEvent.id,
    ownerUserId: userId,
    workspaceId: targetWorkspace.id,
  });
  t.is(undoUpdate?.operation, 'UNDO');
  t.is((await memory.get(updateEvent.memoryId!))?.status, 'superseded');
  t.is((await memory.get(addEvent.memoryId!))?.status, 'active');

  const undoAdd = await memory.undoWriterEvent({
    eventId: addEvent.id,
    ownerUserId: userId,
    workspaceId: targetWorkspace.id,
  });
  t.is(undoAdd?.operation, 'UNDO');
  t.is((await memory.get(addEvent.memoryId!))?.status, 'deleted');
  t.is(
    await memory.undoWriterEvent({
      eventId: addEvent.id,
      ownerUserId: userId,
      workspaceId: targetWorkspace.id,
    }),
    null,
    'an event can only be undone once'
  );

  const expiresAt = new Date(Date.now() + 10_000);
  const expiringEvent = await memory.applyWriterDecision(
    writerInput(
      `memory-expiry-${randomUUID()}`,
      {
        ...baseDecision,
        operation: 'ADD',
        factKey: 'project:temporary_region',
        content: 'Temporary deployment region is us-east-1.',
        expiresAt,
      },
      'turn-expiry'
    )
  );
  await memory.expireDueMemories(new Date(expiresAt.getTime() + 1));
  t.is((await memory.get(expiringEvent.memoryId!))?.status, 'expired');

  const disabledEvent = await memory.applyWriterDecision(
    writerInput(
      `memory-disabled-${randomUUID()}`,
      {
        ...baseDecision,
        operation: 'ADD',
        factKey: 'preference:reenable_conflict',
        content: 'Use the concise response format.',
      },
      'turn-disabled'
    )
  );
  await memoryService.update(disabledEvent.memoryId!, { status: 'disabled' });
  const replacementEvent = await memory.applyWriterDecision(
    writerInput(
      `memory-replacement-${randomUUID()}`,
      {
        ...baseDecision,
        operation: 'UPDATE',
        factKey: 'preference:reenable_conflict',
        content: 'Use the detailed response format.',
      },
      'turn-replacement'
    )
  );
  const reenabled = await memoryService.update(disabledEvent.memoryId!, {
    status: 'active',
  });
  t.is(reenabled?.content, 'Use the concise response format.');
  t.not(reenabled?.id, disabledEvent.memoryId);
  t.is((await memory.get(disabledEvent.memoryId!))?.status, 'superseded');
  t.is((await memory.get(replacementEvent.memoryId!))?.status, 'superseded');
  t.is(
    await db.aiContextMemory.count({
      where: {
        ownerUserId: userId,
        workspaceId: targetWorkspace.id,
        factKey: 'preference:reenable_conflict',
        status: 'active',
      },
    }),
    1
  );

  const removableEvent = await memory.applyWriterDecision(
    writerInput(
      `memory-removal-${randomUUID()}`,
      {
        ...baseDecision,
        operation: 'ADD',
        factKey: 'project:removable_fact',
        content: 'This fact can be removed.',
      },
      'turn-removal'
    )
  );
  t.true(await memory.delete(removableEvent.memoryId!));
  t.is(
    await db.aiContextMemoryEvent.findUnique({
      where: { id: removableEvent.id },
    }),
    null,
    'privacy deletion should remove writer history linked to the deleted content'
  );
});

test('context memory quota keeps the most recently used automatic memories', async t => {
  const { db, models, workspace } = t.context;
  const targetWorkspace = await workspace.create(userId);
  const memory = models.copilotContextMemory;
  const created = [];
  for (const [index, content] of [
    'The deployment region is us-east-1.',
    'The deployment codename is Juniper.',
    'Use UTC for release timestamps.',
  ].entries()) {
    const row = await memory.put({
      ownerUserId: userId,
      workspaceId: targetWorkspace.id,
      scope: 'workspace',
      kind: 'auto_memory',
      visibility: 'private',
      content,
      factKey: `quota:test:${index}`,
      captureMode: 'explicit',
      writerVersion: 'structured-memory-writer/test',
    });
    await db.aiContextMemory.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date(Date.UTC(2026, 0, index + 1)) },
    });
    created.push(row);
  }

  const cleanup = await memory.enforceAutoMemoryQuota(
    {
      ownerUserId: userId,
      workspaceId: targetWorkspace.id,
      scope: 'workspace',
    },
    2
  );

  t.is(cleanup.count, 1);
  t.is(await memory.get(created[0].id), null);
  t.truthy(await memory.get(created[1].id));
  t.truthy(await memory.get(created[2].id));

  const secondaryWorkspace = await workspace.create(userId);
  const project = await memory.createProject({
    createdByUserId: userId,
    name: 'Cross-host quota project',
  });
  const source = { workspaceId: targetWorkspace.id, docId: 'quota-source' };
  await models.doc.upsertMeta(source.workspaceId, source.docId);
  await db.effectiveWorkspaceQuotaState.upsert({
    where: { workspaceId: source.workspaceId },
    create: {
      workspaceId: source.workspaceId,
      ownerUserId: userId,
      plan: 'free',
      seatLimit: 100,
      blobLimit: 0,
      storageQuota: 0,
      historyPeriodSeconds: 0,
      known: true,
      stale: false,
    },
    update: { known: true, stale: false, staleAfter: null },
  });
  const granted = await seedProjectSourceGrant(db, {
    ...source,
    projectId: project.id,
    requesterUserId: userId,
    requestedLevel: 'read',
  });
  t.is(granted.status, 'active');
  const projectMemories = [];
  for (const index of [0, 1, 2]) {
    const row = await memory.put({
      ownerUserId: userId,
      workspaceId: index % 2 === 0 ? targetWorkspace.id : secondaryWorkspace.id,
      projectId: project.id,
      sourceDocuments: [source],
      scope: 'project',
      kind: 'auto_memory',
      visibility: 'private',
      content: `Cross-host quota fact ${index}.`,
      factKey: `quota:project:${index}`,
      captureMode: 'explicit',
      writerVersion: 'structured-memory-writer/test',
    });
    await db.aiContextMemory.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date(Date.UTC(2026, 1, index + 1)) },
    });
    projectMemories.push(row);
  }
  t.true(projectMemories.every(item => item.workspaceId === null));
  const projectCleanup = await memory.enforceAutoMemoryQuota(
    {
      ownerUserId: userId,
      workspaceId: secondaryWorkspace.id,
      scope: 'project',
      projectId: project.id,
    },
    2
  );
  t.is(projectCleanup.count, 1);
  t.is(await memory.get(projectMemories[0].id), null);
  t.truthy(await memory.get(projectMemories[1].id));
  t.truthy(await memory.get(projectMemories[2].id));
});

test('context memory update maps identity conflicts and concurrent deletion', async t => {
  const { db, models, workspace } = t.context;
  const targetWorkspace = await workspace.create(userId);
  const memory = models.copilotContextMemory;
  const putSummary = (content: string) =>
    memory.put({
      ownerUserId: userId,
      workspaceId: targetWorkspace.id,
      scope: 'workspace',
      kind: 'project_summary',
      visibility: 'private',
      content,
    });
  const first = await putSummary('First project summary.');
  await putSummary('Existing project summary.');

  await t.throwsAsync(
    memory.update(first.id, { content: 'Existing project summary.' }),
    {
      message:
        'An identical active AI context memory already exists in this scope',
    }
  );

  const stale = await putSummary('Summary deleted during update.');
  const getStub = Sinon.stub(memory, 'get');
  getStub.withArgs(stale.id).resolves(stale);
  await db.aiContextMemory.delete({ where: { id: stale.id } });
  await t.throwsAsync(memory.update(stale.id, { status: 'disabled' }), {
    message: 'AI context memory not found',
  });
  getStub.restore();
});

test('context rules and workspace policies should retain revisions and hit history', async t => {
  const { models, prompt, session, workspace } = t.context;
  const targetWorkspace = await workspace.create(userId);
  const directives = models.copilotContextRule;
  await prompt.set(promptName, 'test', [
    { role: 'system', content: 'Directive history test.' },
  ]);
  const sessionId = await session.create({
    userId,
    workspaceId: targetWorkspace.id,
    docId: null,
    promptName,
    pinned: false,
    reuseLatestChat: false,
  });

  const createdRule = await directives.createRule({
    ownerUserId: userId,
    scope: 'user',
    name: 'Response style',
    description: 'Keep answers concise.',
    applicationMode: 'always',
    priority: 50,
    conditions: {},
    content: 'Use concise answers.',
  });
  const metadataOnlyRule = await directives.updateRule(createdRule.id, userId, {
    priority: 75,
    content: 'Use concise answers.',
  });
  t.is(metadataOnlyRule?.activeRevision, 1);
  t.is(metadataOnlyRule?.revisions.length, 1);
  const revisedRule = await directives.updateRule(createdRule.id, userId, {
    content: 'Use concise answers with a short rationale.',
  });
  t.is(revisedRule?.activeRevision, 2);
  const rolledBackRule = await directives.rollbackRule({
    id: createdRule.id,
    actorUserId: userId,
    revision: 1,
  });
  t.is(rolledBackRule?.activeRevision, 3);
  t.is(rolledBackRule?.revisions[0].source, 'rollback');
  t.is(rolledBackRule?.revisions[0].content, 'Use concise answers.');

  const createdPolicy = await directives.createPolicy({
    workspaceId: targetWorkspace.id,
    createdByUserId: userId,
    name: 'Security boundary',
    applicationMode: 'always',
    priority: 100,
    conditions: {},
    content: 'Do not reveal workspace secrets.',
  });
  const metadataOnlyPolicy = await directives.updatePolicy(
    createdPolicy.id,
    targetWorkspace.id,
    userId,
    { priority: 125, content: 'Do not reveal workspace secrets.' }
  );
  t.is(metadataOnlyPolicy?.activeRevision, 1);
  const revisedPolicy = await directives.updatePolicy(
    createdPolicy.id,
    targetWorkspace.id,
    userId,
    { content: 'Do not reveal secrets or private credentials.' }
  );
  t.is(revisedPolicy?.activeRevision, 2);
  const rolledBackPolicy = await directives.rollbackPolicy({
    id: createdPolicy.id,
    workspaceId: targetWorkspace.id,
    actorUserId: userId,
    revision: 1,
  });
  t.is(rolledBackPolicy?.activeRevision, 3);
  t.is(rolledBackPolicy?.revisions[0].source, 'rollback');

  const hitResult = await directives.recordHits({
    sessionId,
    sourceTurnId: 'turn-directives',
    rules: [
      {
        ruleId: rolledBackRule!.id,
        revisionId: rolledBackRule!.revisions[0].id,
        matchReason: 'always',
        score: 10,
      },
    ],
    policies: [
      {
        policyId: rolledBackPolicy!.id,
        revisionId: rolledBackPolicy!.revisions[0].id,
        matchReason: 'always',
        score: 20,
      },
    ],
  });
  t.deepEqual(hitResult, { ruleCount: 1, policyCount: 1 });
  t.is((await directives.getRule(createdRule.id))?.hits.length, 1);
  t.is((await directives.getPolicy(createdPolicy.id))?.hits.length, 1);

  t.true(await directives.deleteRule(createdRule.id, userId));
  t.true(await directives.deletePolicy(createdPolicy.id, targetWorkspace.id));
  t.is(await directives.getRule(createdRule.id), null);
  t.is(await directives.getPolicy(createdPolicy.id), null);
});

test('context preferences and strategy revisions should persist safely', async t => {
  const { models, prompt, session, workspace } = t.context;
  const targetWorkspace = await workspace.create(userId);
  const memory = models.copilotContextMemory;

  t.is(await memory.getPreference(userId, targetWorkspace.id), null);
  await memory.putPreference({
    userId,
    workspaceId: targetWorkspace.id,
    autoMemoryEnabled: false,
  });
  t.false(
    (await memory.getPreference(userId, targetWorkspace.id))?.autoMemoryEnabled
  );

  const version = `context-planner/test-${randomUUID()}`;
  await memory.ensureStrategyRevision({
    version,
    fingerprint: 'fingerprint-a',
    status: 'archived',
    config: { mode: 'test' },
  });
  await memory.ensureStrategyRevision({
    version,
    fingerprint: 'fingerprint-a',
    status: 'active',
    config: { mode: 'test' },
  });
  await t.throwsAsync(
    memory.ensureStrategyRevision({
      version,
      fingerprint: 'fingerprint-b',
      status: 'active',
      config: { mode: 'changed-without-version-bump' },
    }),
    {
      message: `Context strategy ${version} changed without a version bump`,
    }
  );

  await prompt.set(promptName, 'test', [
    { role: 'system', content: 'Trace test.' },
  ]);
  const traceSessionId = await session.create({
    userId,
    workspaceId: targetWorkspace.id,
    docId: null,
    promptName,
    pinned: false,
    reuseLatestChat: false,
  });
  await memory.createPlanTrace({
    sessionId: traceSessionId,
    sourceTurnId: 'turn-a',
    strategyVersion: version,
    strategyFingerprint: 'fingerprint-a',
    inputMessageCount: 1,
    retainedMessageCount: 1,
    omittedMessageCount: 0,
    candidateMemoryCount: 1,
    selectedMemoryCount: 1,
    summaryInjected: false,
    planningPasses: 2,
    contextCharBudget: 4800,
    contextCharCount: 120,
    sourceFingerprint: 'source-fingerprint',
    outputFingerprint: 'output-fingerprint',
    candidateMemoryIds: ['memory-a'],
    selectedMemories: [
      {
        id: 'memory-a',
        scope: 'workspace',
        kind: 'rule',
        score: 32,
        rank: 1,
      },
    ],
    scope: {
      readableDocIds: ['doc-a'],
      projectIds: ['project-a'],
      projectResolution: 'single',
    },
  });
  const traces = await memory.listPlanTraces(traceSessionId);
  t.is(traces.length, 1);
  t.deepEqual(traces[0].candidateMemoryIds, ['memory-a']);
  t.false(JSON.stringify(traces[0]).includes('Trace test.'));

  const strategy = (
    await memory.listStrategyRevisions({
      userId,
      workspaceId: targetWorkspace.id,
    })
  ).find(item => item.version === version);
  t.is(strategy?.traceCount, 1);
  t.truthy(strategy?.lastTraceAt);
});

test('PromptContract should preserve render/session payloads and reject legacy aliases', t => {
  const render = parsePromptRenderContract({
    messages: [
      {
        role: 'system',
        content: 'Return JSON only.',
        responseFormat: {
          type: 'json_schema',
          responseSchemaJson: {
            type: 'object',
            properties: { summary: { type: 'string' } },
            required: ['summary'],
          },
          schemaHash: 'schema-hash',
        },
      },
    ],
    templateParams: {},
    renderParams: { tone: 'brief' },
  });

  t.deepEqual(
    { messages: render.messages, warnings: [] },
    {
      messages: render.messages,
      warnings: [],
    }
  );

  const session = parsePromptSessionContract({
    prompt: {
      model: 'gpt-5-mini',
      promptTokens: 12,
      templateParams: {},
      messages: [systemPrompt('Return JSON only.')],
    },
    turns: singleUserPromptMessages('hello'),
    renderParams: { tone: 'brief' },
    maxTokenSize: 1024,
  });

  t.is(session.prompt.model, 'gpt-5-mini');

  const error = t.throws(() =>
    parsePromptRenderContract({
      messages: [
        {
          role: 'system',
          content: 'Return JSON only.',
          responseFormat: {
            type: 'json_schema',
            schemaJson: { type: 'object' },
            schemaHash: 'schema-hash',
          },
        },
      ],
      templateParams: {},
      renderParams: {},
    })
  );

  t.truthy(error);
});

test('capability runtime should require explicit structured schema contract', async t => {
  const runtime = new CapabilityRuntime({} as never, {} as never);

  const error = await t.throwsAsync(() =>
    runtime.generateStructuredValue(
      { modelId: 'gpt-5-mini' },
      singleUserPromptMessages('Summarize AFFiNE.'),
      {
        responseSchemaJson: {
          type: 'object',
          properties: { summary: { type: 'string' } },
          required: ['summary'],
          additionalProperties: false,
        },
      }
    )
  );

  t.true(error instanceof Error);
  t.regex(error.message, /Structured schema contract is required/);
});

// ==================== session ====================

test('should be able to manage chat session', async t => {
  const { prompt, session } = t.context;

  await prompt.set(promptName, 'model', [
    { role: 'system', content: 'hello {{word}}' },
  ]);

  const params = { word: 'world' };
  const commonParams = { docId: 'test', workspaceId: 'test', pinned: false };

  const sessionId = await session.create({
    userId,
    promptName,
    ...commonParams,
  });
  t.truthy(sessionId, 'should create session');

  const s = (await session.get(sessionId))!;
  t.is(s.config.sessionId, sessionId, 'should get session');
  t.is(s.config.promptName, promptName, 'should have prompt name');
  t.is(s.model, 'model', 'should have model');

  s.pushTurn(
    buildTurn(sessionId, {
      role: 'user',
      content: 'hello',
      createdAt: new Date(),
    })
  );

  const finalMessages = cleanFinalMessages(s.finish(params));
  t.snapshot(finalMessages, 'should generate the final message');
  await s.save();

  const s1 = (await session.get(sessionId))!;
  t.deepEqual(
    cleanFinalMessages(s1.finish(params)),
    finalMessages,
    'should same as before message'
  );
  t.snapshot(
    cleanFinalMessages(s1.finish(params)),
    'should generate different message with another params'
  );

  // should get main session after fork if re-create a chat session for same docId and workspaceId
  {
    const newSessionId = await session.create({
      userId,
      promptName,
      ...commonParams,
    });
    t.is(newSessionId, sessionId, 'should get same session id');
  }

  // should create a fresh session when reuseLatestChat is explicitly disabled
  {
    const newSessionId = await session.create({
      userId,
      promptName,
      ...commonParams,
      reuseLatestChat: false,
    });
    t.not(
      newSessionId,
      sessionId,
      'should create new session id when reuseLatestChat is false'
    );
  }
});

test('chat session should cap prompt render budget by model context window', t => {
  const prompt: ResolvedPrompt = {
    name: `context-window-${randomUUID()}`,
    model: 'local-chat',
    modelSource: 'compat',
    optionalModels: [],
    optionalModelsSource: 'compat',
    paramKeys: [],
    params: {},
    source: 'compat',
    category: 'text',
    proModelsSource: 'compat',
    overrideApplied: false,
    messages: [{ role: 'system' as const, content: 'hello' }],
    config: { maxTokens: 8192 },
  };
  const capturedBudgets: number[] = [];
  const session = new ChatSession(
    {
      userId,
      sessionId: randomUUID(),
      workspaceId: 'workspace-1',
      docId: 'doc-1',
      turns: [],
      prompt,
    },
    (_prompt, _turns, _params, maxTokenSize) => {
      capturedBudgets.push(maxTokenSize);
      return [];
    }
  );

  session.finish({}, { contextWindow: 4096 });
  session.finish({}, { contextWindow: 16384 });
  session.finish({});

  t.deepEqual(capturedBudgets, [4096, 8192, 8192]);
});

test('should be able to update chat session prompt', async t => {
  const { prompt, session } = t.context;

  // Set up a prompt to be used in the session
  await prompt.set(promptName, 'model', [
    { role: 'system', content: 'hello {{word}}' },
  ]);

  // Create a session
  const sessionId = await session.create({
    promptName,
    docId: 'test',
    workspaceId: 'test',
    userId,
    pinned: false,
  });
  t.truthy(sessionId, 'should create session');

  // Update the session
  const updatedSessionId = await session.update({
    sessionId,
    promptName: 'Chat With LocalMind AI',
    userId,
  });
  t.is(updatedSessionId, sessionId, 'should update session with same id');

  // Verify the session was updated
  const updatedSession = await session.get(sessionId);
  t.truthy(updatedSession, 'should retrieve updated session');
  t.is(
    updatedSession?.config.promptName,
    'Chat With LocalMind AI',
    'should have updated prompt name'
  );
});

test('should be able to fork chat session', async t => {
  const { auth, prompt, session } = t.context;

  await prompt.set(promptName, 'model', [
    { role: 'system', content: 'hello {{word}}' },
  ]);

  const params = { word: 'world' };
  const commonParams = { docId: 'test', workspaceId: 'test', pinned: false };
  // create session
  const sessionId = await session.create({
    userId,
    promptName,
    ...commonParams,
  });
  const s = (await session.get(sessionId))!;
  s.pushTurn(
    buildTurn(sessionId, {
      role: 'user',
      content: 'hello',
      createdAt: new Date(),
    })
  );
  s.pushTurn(
    buildTurn(sessionId, {
      role: 'assistant',
      content: 'world',
      createdAt: new Date(),
    })
  );
  s.pushTurn(
    buildTurn(sessionId, {
      role: 'user',
      content: 'aaa',
      createdAt: new Date(),
    })
  );
  s.pushTurn(
    buildTurn(sessionId, {
      role: 'assistant',
      content: 'bbb',
      createdAt: new Date(),
    })
  );
  await s.save();

  // fork session
  const latestMessageId = (await session.getState(sessionId))?.turns.find(
    turn => turn.role === 'assistant'
  )?.id;
  t.truthy(latestMessageId);
  const forkedSessionId1 = await session.fork({
    userId,
    sessionId,
    latestMessageId: latestMessageId!,
    ...commonParams,
  });
  t.not(sessionId, forkedSessionId1, 'should fork a new session');

  const newUser = await auth.signUp('darksky.1@affine.pro', '123456');
  await t.throwsAsync(
    session.fork({
      userId: newUser.id,
      sessionId,
      latestMessageId: latestMessageId!,
      ...commonParams,
    })
  );
  const forkedSessionId2 = await session.fork({
    userId: newUser.id,
    sessionId: forkedSessionId1,
    ...commonParams,
  });
  t.not(
    forkedSessionId1,
    forkedSessionId2,
    'should fork new session with same params'
  );

  // fork session without latestMessageId
  const forkedSessionId3 = await session.fork({
    userId,
    sessionId,
    ...commonParams,
  });

  // fork session with wrong latestMessageId
  await t.throwsAsync(
    session.fork({
      userId,
      sessionId,
      latestMessageId: 'wrong-message-id',
      ...commonParams,
    }),
    {
      instanceOf: Error,
    },
    'should not able to fork new session with wrong latestMessageId'
  );

  // check forked session messages
  {
    const s2 = (await session.get(forkedSessionId1))!;

    const finalMessages = s2.finish(params);
    t.snapshot(
      cleanSnapshotObject(finalMessages),
      'should generate the final message'
    );
  }

  // check second times forked session
  {
    const s2 = (await session.get(forkedSessionId2))!;

    // should overwrite user id
    t.is(s2.config.userId, newUser.id, 'should have same user id');

    const finalMessages = s2.finish(params);
    t.snapshot(
      cleanSnapshotObject(finalMessages),
      'should generate the final message'
    );
  }

  // check third times forked session
  {
    const s3 = (await session.get(forkedSessionId3))!;
    const finalMessages = s3.finish(params);
    t.snapshot(
      cleanSnapshotObject(finalMessages),
      'should generate the final message'
    );
  }

  // check original session messages
  {
    const s4 = (await session.get(sessionId))!;
    const finalMessages = s4.finish(params);
    t.snapshot(
      cleanSnapshotObject(finalMessages),
      'should generate the final message'
    );
  }

  // should get main session after fork if re-create a chat session for same docId and workspaceId
  {
    const newSessionId = await session.create({
      userId,
      promptName,
      ...commonParams,
    });
    t.is(newSessionId, sessionId, 'should get same session id');
  }
});

test('should schedule title generation as a background job', async t => {
  const { prompt, session, module, workspace } = t.context;
  const jobs = module.get(JobQueue);

  const ws = await workspace.create(userId);
  await prompt.set(promptName, 'model', [
    { role: 'system', content: 'hello {{word}}' },
  ]);

  const sessionId = await session.create({
    userId,
    promptName,
    docId: 'test',
    workspaceId: ws.id,
    pinned: false,
  });
  const chatSession = await session.get(sessionId);
  t.truthy(chatSession);

  const addJob = jobs.add as Sinon.SinonStub;
  addJob.resetHistory();
  addJob.resolves();

  chatSession!.pushTurn(
    buildTurn(sessionId, {
      role: 'user',
      content: 'hello',
      createdAt: new Date(),
    })
  );
  await chatSession!.save();

  t.true(addJob.calledOnce);
  t.deepEqual(addJob.firstCall.args, [
    'copilot.session.generateTitle',
    { sessionId },
    { priority: 100 },
  ]);
});

test('should merge latest user turn content and attachments into prompt', async t => {
  const { prompt, session } = t.context;

  await prompt.set(promptName, 'model', [
    { role: 'system', content: 'hello {{word}}' },
  ]);

  for (const testCase of [
    {
      title: 'text message',
      message: { content: 'hello' },
      project: (messages: { content: string }[]) =>
        messages.map(({ content }) => content),
      expected: ['hello world', 'hello'],
    },
    {
      title: 'attachment message',
      message: { attachments: ['https://affine.pro/example.jpg'] as string[] },
      project: (messages: { attachments?: unknown }[]) =>
        messages.map(({ attachments }) => attachments),
      expected: [undefined, ['https://affine.pro/example.jpg']],
    },
    {
      title: 'empty message',
      message: {},
      project: (messages: { content: string }[]) =>
        messages.map(({ content }) => content),
      expected: ['hello world'],
    },
  ]) {
    const sessionId = await session.create({
      docId: 'test',
      workspaceId: 'test',
      userId,
      promptName,
      pinned: false,
    });
    const s = (await session.get(sessionId))!;
    s.pushTurn(
      buildTurn(sessionId, {
        role: 'user',
        content: testCase.message.content ?? '',
        attachments: testCase.message.attachments,
        createdAt: new Date(),
      })
    );
    t.deepEqual(
      testCase.project(s.finish({ word: 'world' })),
      testCase.expected,
      testCase.title
    );
  }
});

test('should preserve file handle attachments when merging user content into prompt', async t => {
  const { prompt, session } = t.context;

  await prompt.set(promptName, 'model', [
    { role: 'user', content: '{{content}}' },
  ]);

  const sessionId = await session.create({
    docId: 'test',
    workspaceId: 'test',
    userId,
    promptName,
    pinned: false,
  });
  const s = (await session.get(sessionId))!;

  s.pushTurn(
    buildTurn(sessionId, {
      role: 'user',
      content: 'Summarize this file',
      attachments: [
        {
          kind: 'file_handle',
          fileHandle: 'file_123',
          mimeType: 'application/pdf',
        },
      ],
      createdAt: new Date(),
    })
  );
  const finalMessages = s.finish({});

  t.deepEqual(finalMessages, [
    {
      role: 'user',
      content: 'Summarize this file',
      attachments: [
        {
          kind: 'file_handle',
          fileHandle: 'file_123',
          mimeType: 'application/pdf',
        },
      ],
      params: {
        content: 'Summarize this file',
      },
    },
  ]);
});

test('should preserve assistant render trace when converting between chat message and turn', t => {
  const sessionId = randomUUID();
  const createdAt = new Date('2025-01-01T00:00:00.000Z');
  const message = {
    id: 'message-1',
    role: 'assistant' as const,
    content: 'Final answer',
    attachments: [
      {
        kind: 'file_handle' as const,
        fileHandle: 'file_123',
        mimeType: 'application/pdf',
      },
    ],
    params: {
      schemaVersion: 'v1',
    },
    streamObjects: [
      { type: 'reasoning' as const, textDelta: 'Plan' },
      {
        type: 'tool-call' as const,
        toolCallId: 'call_1',
        toolName: 'doc_read',
        args: { docId: 'doc-1' },
        rawArgumentsText: '{"docId":"doc-1"}',
        thought: 'Need the current doc',
      },
      { type: 'text-delta' as const, textDelta: 'Final answer' },
      {
        type: 'tool-result' as const,
        toolCallId: 'call_2',
        toolName: 'doc_keyword_search',
        args: { query: 'affine' },
        result: { hits: ['doc-2'] },
      },
    ],
    createdAt,
  };

  const turn = turnFromChatMessage(message, sessionId);

  t.deepEqual(turn.renderTrace, message.streamObjects);
  t.deepEqual(
    turn.toolEvents.map(event => event.type),
    ['tool_call', 'tool_result']
  );
  t.deepEqual(chatMessageFromTurn(turn), message);
});

test('should save message correctly', async t => {
  const { prompt, session } = t.context;

  await prompt.set(promptName, 'model', [
    { role: 'system', content: 'hello {{word}}' },
  ]);

  const sessionId = await session.create({
    docId: 'test',
    workspaceId: 'test',
    userId,
    promptName,
    pinned: false,
  });
  const s = (await session.get(sessionId))!;

  s.pushTurn(
    buildTurn(sessionId, {
      role: 'user',
      content: 'hello',
      createdAt: new Date(),
    })
  );
  t.is(s.stashTurns.length, 1, 'should get stash turns');
  await s.save();
  t.is(s.stashTurns.length, 0, 'should empty stash turns after save');
});

test('should revert message correctly', async t => {
  const { prompt, session } = t.context;

  // init session
  let sessionId: string;
  {
    await prompt.set(promptName, 'model', [
      { role: 'system', content: 'hello {{word}}' },
    ]);

    sessionId = await session.create({
      docId: 'test',
      workspaceId: 'test',
      userId,
      promptName,
      pinned: false,
    });
    const s = (await session.get(sessionId))!;

    s.pushTurn(
      buildTurn(sessionId, {
        role: 'user',
        content: '1',
        createdAt: new Date(),
      })
    );
    await s.save();
  }

  // check ChatSession behavior
  {
    const s = (await session.get(sessionId))!;
    s.pushTurn(
      buildTurn(sessionId, {
        role: 'assistant',
        content: '2',
        createdAt: new Date(),
      })
    );
    s.pushTurn(
      buildTurn(sessionId, {
        role: 'user',
        content: '3',
        createdAt: new Date(),
      })
    );
    s.pushTurn(
      buildTurn(sessionId, {
        role: 'assistant',
        content: '4',
        createdAt: new Date(),
      })
    );
    await s.save();
    const beforeRevert = s.finish({ word: 'world' });
    t.snapshot(
      cleanSnapshotObject(beforeRevert),
      'should have three messages before revert'
    );

    {
      s.revertLatestMessage(false);
      const afterRevert = s.finish({ word: 'world' });
      t.snapshot(
        cleanSnapshotObject(afterRevert),
        'should remove assistant message after revert'
      );
    }

    {
      s.revertLatestMessage(true);
      const afterRevert = s.finish({ word: 'world' });
      t.snapshot(
        cleanSnapshotObject(afterRevert),
        'should remove assistant message after revert'
      );
    }
  }

  // check database behavior
  {
    let s = (await session.get(sessionId))!;

    const beforeRevert = s.finish({ word: 'world' });
    t.snapshot(
      cleanSnapshotObject(beforeRevert),
      'should have three messages before revert'
    );

    {
      await session.revertLatestMessage(sessionId, false);
      s = (await session.get(sessionId))!;
      const afterRevert = s.finish({ word: 'world' });
      t.snapshot(
        cleanSnapshotObject(afterRevert),
        'should remove assistant message after revert'
      );
    }

    {
      await session.revertLatestMessage(sessionId, true);
      s = (await session.get(sessionId))!;
      const afterRevert = s.finish({ word: 'world' });
      t.snapshot(
        cleanSnapshotObject(afterRevert),
        'should remove assistant message after revert'
      );
    }
  }
});

test('should handle params correctly in chat session', async t => {
  const { prompt, session } = t.context;

  await prompt.set(promptName, 'model', [
    { role: 'system', content: 'hello {{word}}' },
  ]);

  const sessionId = await session.create({
    docId: 'test',
    workspaceId: 'test',
    userId,
    promptName,
    pinned: false,
  });

  const s = (await session.get(sessionId))!;

  // Case 1: When params is provided directly
  {
    const directParams = { word: 'direct' };
    const messages = s.finish(directParams);
    t.is(messages[0].content, 'hello direct', 'should use provided params');
  }

  // Case 2: When no params provided but last message has params
  {
    s.pushTurn(
      buildTurn(sessionId, {
        role: 'user',
        content: 'test message',
        params: { word: 'fromMessage' },
        createdAt: new Date(),
      })
    );
    const messages = s.finish({});
    t.is(
      messages[0].content,
      'hello fromMessage',
      'should use params from last message'
    );
  }

  // Case 3: When neither params provided nor last message has params
  {
    s.pushTurn(
      buildTurn(sessionId, {
        role: 'user',
        content: 'test message without params',
        createdAt: new Date(),
      })
    );
    const messages = s.finish({});
    t.is(messages[0].content, 'hello ', 'should use empty params');
  }
});

// ==================== provider ====================

test('should be able to get provider', async t => {
  const { factory } = t.context;

  {
    const p = await factory.getProvider({ outputType: ModelOutputType.Text });
    t.is(
      p?.type.toString(),
      'openai',
      'should get provider support text-to-text'
    );
  }

  {
    const p = await factory.getProvider({
      outputType: ModelOutputType.Image,
      inputTypes: [ModelInputType.Image],
      modelId: 'lora/image-to-image',
    });
    t.is(
      p?.type.toString(),
      'fal',
      'should get provider supporting image output'
    );
  }

  {
    const p = await factory.getProvider(
      {
        outputType: ModelOutputType.Image,
        inputTypes: [ModelInputType.Image],
      },
      { prefer: CopilotProviderType.FAL }
    );
    t.is(
      p?.type.toString(),
      'fal',
      'should get provider supporting text output with image input'
    );
  }

  // if a model is not defined and not available in online api
  // it should return null
  {
    const p = await factory.getProvider({
      outputType: ModelOutputType.Text,
      inputTypes: [ModelInputType.Text],
      modelId: 'gpt-4-not-exist',
    });
    t.falsy(p, 'should not get provider');
  }
});

test('should resolve provider by prefixed model id', async t => {
  const { factory } = t.context;

  const resolved = await factory.resolveProvider({
    modelId: 'openai-default/test',
    outputType: ModelOutputType.Text,
  });
  t.truthy(resolved, 'should resolve prefixed model id');
  if (!resolved) {
    throw new Error('should resolve prefixed model id');
  }

  t.is(resolved.provider.type, CopilotProviderType.OpenAI);

  const result = await getProviderRuntimeHost(resolved.provider).run.text(
    { modelId: resolved.modelId },
    [{ role: 'user', content: 'hello' }],
    undefined,
    resolved.execution
  );
  t.is(result, 'generate text to text');
});

test('should fallback to null when prefixed provider id does not exist', async t => {
  const { factory } = t.context;

  const provider = await factory.getProviderByModel('unknown/test');
  t.is(provider, null);
});

// ==================== action runtime ====================

const wrapAsyncIter = async <T>(iter: AsyncIterable<T>) => {
  const result: T[] = [];
  for await (const r of iter) {
    result.push(r);
  }
  return result;
};

test('tool bridge should validate zod tool args before execution', async t => {
  const execute = Sinon.stub().resolves({ message: 'executed' });
  const tools: CopilotToolSet = {
    safeTool: {
      inputSchema: z.object({
        name: z.string(),
      }),
      execute,
    },
  };
  const options: CopilotToolExecuteOptions = {};
  const request: LlmToolCallbackRequest = {
    callId: 'call-1',
    name: 'safeTool',
    args: { name: 123 },
    rawArgumentsText: '{"name":123}',
  };

  const response = await executeToolCall(tools, request, options);

  t.true(response.isError);
  t.true(response.output instanceof Object);
  t.regex((response.output as { message: string }).message, /Expected string/);
  t.false(execute.called);
});

test('tool bridge should execute with parsed zod args and preserve callback response metadata', async t => {
  const execute = Sinon.stub().resolves({ message: 'executed' });
  const tools: CopilotToolSet = {
    safeTool: {
      inputSchema: z.object({
        name: z.string().trim(),
      }),
      execute,
    },
  };
  const options: CopilotToolExecuteOptions = {};
  const request: LlmToolCallbackRequest = {
    callId: 'call-2',
    name: 'safeTool',
    args: { name: ' AFFiNE ' },
    rawArgumentsText: '{"name":" AFFiNE "}',
  };

  const response = await executeToolCall(tools, request, options);

  t.false(response.isError ?? false);
  t.deepEqual(response, {
    callId: 'call-2',
    name: 'safeTool',
    args: { name: ' AFFiNE ' },
    rawArgumentsText: '{"name":" AFFiNE "}',
    argumentParseError: undefined,
    output: { message: 'executed' },
  });
  t.deepEqual(execute.firstCall.args, [{ name: 'AFFiNE' }, options]);
});

test('tool bridge should reject malformed or unknown tool calls without executing tools', async t => {
  const execute = Sinon.stub().resolves({ message: 'executed' });
  const tools: CopilotToolSet = {
    safeTool: {
      inputSchema: z.record(z.unknown()),
      execute,
    },
  };

  const invalidJsonResponse = await executeToolCall(
    tools,
    {
      callId: 'call-3',
      name: 'safeTool',
      args: {},
      rawArgumentsText: '{"unterminated"',
      argumentParseError: 'Unexpected end of JSON input',
    },
    {}
  );
  const missingToolResponse = await executeToolCall(
    tools,
    {
      callId: 'call-4',
      name: 'missingTool',
      args: {},
      rawArgumentsText: '{}',
    },
    {}
  );

  t.deepEqual(invalidJsonResponse, {
    callId: 'call-3',
    name: 'safeTool',
    args: {},
    rawArgumentsText: '{"unterminated"',
    argumentParseError: 'Unexpected end of JSON input',
    isError: true,
    output: {
      message: 'Invalid tool arguments JSON',
      rawArguments: '{"unterminated"',
      error: 'Unexpected end of JSON input',
    },
  });
  t.deepEqual(missingToolResponse, {
    callId: 'call-4',
    name: 'missingTool',
    args: {},
    rawArgumentsText: '{}',
    argumentParseError: undefined,
    isError: true,
    output: { message: 'Tool not found: missingTool' },
  });
  t.false(execute.called);
});

test('tool bridge should not mutate global object prototype for adversarial args', async t => {
  const execute = Sinon.stub().resolves({ message: 'executed' });
  const tools: CopilotToolSet = {
    safeTool: {
      inputSchema: z.record(z.unknown()),
      execute,
    },
  };
  const request: LlmToolCallbackRequest = {
    callId: 'call-5',
    name: 'safeTool',
    args: JSON.parse('{"__proto__":{"polluted":"yes"}}'),
    rawArgumentsText: '{"__proto__":{"polluted":"yes"}}',
  };

  const response = await executeToolCall(tools, request, {});

  t.true(Object.prototype.hasOwnProperty.call(request.args, '__proto__'));
  t.false(response.isError ?? false);
  t.is((Object.prototype as Record<string, unknown>).polluted, undefined);
  t.deepEqual(execute.firstCall.args[0], {});
});

test('action stream should expose successful text action result as message', t => {
  t.deepEqual(
    projectActionEventToChatEvent('message-1', {
      type: 'action_done',
      actionId: 'slides.outline',
      actionVersion: 'v1',
      status: 'succeeded',
      runId: 'run-1',
      result: '- Launch deck',
    }),
    {
      type: 'message',
      id: 'message-1',
      data: '- Launch deck',
    }
  );
});

test('turn orchestrator should persist generated image links through image result host', async t => {
  const { conversationHost, imageResults, orchestrator, chatRuntime, module } =
    t.context;
  const capabilityPolicy = module.get(CapabilityPolicyHost);
  const session = {
    latestUserTurn: { attachments: ['https://example.com/source.png'] },
    config: { sessionId: 'session-1' },
    finish: Sinon.stub().returns([
      {
        role: 'system',
        content: 'generate image',
        params: { quality: 'hd', seed: '7' },
      },
    ]),
  } as any;

  Sinon.stub(conversationHost, 'prepareTurn').resolves({
    messageId: 'message-1',
    params: {},
    session,
    latestTurn: undefined,
  } as any);
  Sinon.stub(capabilityPolicy, 'selectChat').resolves({
    model: 'test-image-model',
    providerOptions: { format: 'png' },
  } as any);
  Sinon.stub(chatRuntime, 'streamImageArtifacts').callsFake(async function* () {
    yield { url: 'https://remote.example/1.png', media_type: 'image/png' };
    yield { url: 'https://remote.example/2.png', media_type: 'image/png' };
  });
  const persistNativeArtifact = Sinon.stub(
    imageResults,
    'persistNativeArtifact'
  ).callsFake(
    async (_userId, _workspaceId, artifact) => `stored:${artifact.url}`
  );
  const persistAssistantTurn = Sinon.stub(
    conversationHost,
    'persistAssistantTurn'
  ).resolves();

  const prepared = await orchestrator.streamImages('user-1', 'session-1', {
    modelId: 'chat-model',
  });
  const result = await wrapAsyncIter(prepared.stream);

  t.deepEqual(result, [
    'stored:https://remote.example/1.png',
    'stored:https://remote.example/2.png',
  ]);
  t.deepEqual(
    (chatRuntime.streamImageArtifacts as Sinon.SinonStub).firstCall.args[0],
    {
      modelId: 'test-image-model',
      inputTypes: [ModelInputType.Image],
    }
  );
  t.deepEqual(
    (chatRuntime.streamImageArtifacts as Sinon.SinonStub).firstCall.args[2],
    {
      format: 'png',
      quality: 'hd',
      seed: 7,
      signal: undefined,
    }
  );
  t.deepEqual(
    persistNativeArtifact.getCalls().map(call => call.args),
    [
      [
        'user-1',
        'session-1',
        { url: 'https://remote.example/1.png', media_type: 'image/png' },
      ],
      [
        'user-1',
        'session-1',
        { url: 'https://remote.example/2.png', media_type: 'image/png' },
      ],
    ]
  );
  t.true(persistAssistantTurn.calledOnce);
  t.deepEqual(persistAssistantTurn.firstCall.args[1].attachments, result);
});

test('TextStreamParser should format different types of chunks correctly', t => {
  // Define interfaces for fixtures
  interface BaseFixture {
    chunk: any;
    description: string;
  }

  interface ContentFixture extends BaseFixture {
    expected: string;
  }

  interface ErrorFixture extends BaseFixture {
    errorMessage: string;
  }

  type ChunkFixture = ContentFixture | ErrorFixture;

  // Define test fixtures for different chunk types
  const fixtures: Record<string, ChunkFixture> = {
    textDelta: {
      chunk: {
        type: 'text-delta' as const,
        text: 'Hello world',
      },
      expected: 'Hello world',
      description: 'should format text-delta correctly',
    },
    reasoning: {
      chunk: {
        type: 'reasoning-delta' as const,
        text: 'I need to think about this',
      },
      expected: '\n> [!]\n> I need to think about this',
      description: 'should format reasoning as callout',
    },
    webSearch: {
      chunk: {
        type: 'tool-call' as const,
        toolName: 'web_search_exa' as const,
        toolCallId: 'test-id-1',
        input: { query: 'test query', mode: 'AUTO' as const },
      },
      expected: '\n> [!]\n> \n> Searching the web "test query"\n> ',
      description: 'should format web search tool call correctly',
    },
    webCrawl: {
      chunk: {
        type: 'tool-call' as const,
        toolName: 'web_crawl_exa' as const,
        toolCallId: 'test-id-2',
        input: { url: 'https://example.com' },
      },
      expected: '\n> [!]\n> \n> Crawling the web "https://example.com"\n> ',
      description: 'should format web crawl tool call correctly',
    },
    toolResult: {
      chunk: {
        type: 'tool-result' as const,
        toolName: 'web_search_exa' as const,
        toolCallId: 'test-id-1',
        input: { query: 'test query', mode: 'AUTO' as const },
        output: [
          {
            title: 'Test Title',
            url: 'https://test.com',
            content: 'Test content',
            favicon: undefined,
            publishedDate: undefined,
            author: undefined,
          },
          {
            title: null,
            url: 'https://example.com',
            content: 'Example content',
            favicon: undefined,
            publishedDate: undefined,
            author: undefined,
          },
        ],
      } as any,
      expected:
        '\n> [!]\n> \n> \n> \n> [Test Title](https://test.com)\n> \n> \n> \n> [https://example.com](https://example.com)\n> \n> \n> ',
      description: 'should format tool result correctly',
    },
    error: {
      chunk: {
        type: 'error' as const,
        error: { type: 'testError', message: 'Test error message' },
      },
      errorMessage: 'Test error message',
      description: 'should throw error for error chunks',
    },
  };

  // Test each chunk type individually
  Object.entries(fixtures).forEach(([_name, fixture]) => {
    const parser = new TextStreamParser();
    if ('errorMessage' in fixture) {
      t.throws(
        () => parser.parse(fixture.chunk),
        { message: fixture.errorMessage },
        fixture.description
      );
    } else {
      const result = parser.parse(fixture.chunk);
      t.is(result, fixture.expected, fixture.description);
    }
  });
});

test('TextStreamParser should process a sequence of message chunks', t => {
  const parser = new TextStreamParser();

  // Define test fixtures for mixed chunks sequence
  const mixedChunksFixture = {
    chunks: [
      // Reasoning chunks
      {
        id: nanoid(),
        type: 'reasoning-delta' as const,
        text: 'The user is asking about',
      },
      {
        id: nanoid(),
        type: 'reasoning-delta' as const,
        text: ' recent advances in quantum computing',
      },
      {
        id: nanoid(),
        type: 'reasoning-delta' as const,
        text: ' and how it might impact',
      },
      {
        id: nanoid(),
        type: 'reasoning-delta' as const,
        text: ' cryptography and data security.',
      },
      {
        id: nanoid(),
        type: 'reasoning-delta' as const,
        text: ' I should provide information on quantum supremacy achievements',
      },

      // Text delta
      {
        id: nanoid(),
        type: 'text-delta' as const,
        text: 'Let me search for the latest breakthroughs in quantum computing and their ',
      },

      // Tool call
      {
        type: 'tool-call' as const,
        toolCallId: 'toolu_01ABCxyz123456789',
        toolName: 'web_search_exa' as const,
        input: {
          query: 'latest quantum computing breakthroughs cryptography impact',
        },
      },

      // Tool result
      {
        type: 'tool-result' as const,
        toolCallId: 'toolu_01ABCxyz123456789',
        toolName: 'web_search_exa' as const,
        input: {
          query: 'latest quantum computing breakthroughs cryptography impact',
        },
        output: [
          {
            title: 'IBM Unveils 1000-Qubit Quantum Processor',
            url: 'https://example.com/tech/quantum-computing-milestone',
          },
        ],
      },

      // More text deltas
      {
        id: nanoid(),
        type: 'text-delta' as const,
        text: 'implications for security.',
      },
      {
        id: nanoid(),
        type: 'text-delta' as const,
        text: '\n\nQuantum computing has made ',
      },
      {
        id: nanoid(),
        type: 'text-delta' as const,
        text: 'remarkable progress in the past year. ',
      },
      {
        id: nanoid(),
        type: 'text-delta' as const,
        text: 'The development of more stable qubits has accelerated research significantly.',
      },
    ],
    expected:
      '\n> [!]\n> The user is asking about recent advances in quantum computing and how it might impact cryptography and data security. I should provide information on quantum supremacy achievements\n\nLet me search for the latest breakthroughs in quantum computing and their \n> [!]\n> \n> Searching the web "latest quantum computing breakthroughs cryptography impact"\n> \n> \n> \n> [IBM Unveils 1000-Qubit Quantum Processor](https://example.com/tech/quantum-computing-milestone)\n> \n> \n> \n\nimplications for security.\n\nQuantum computing has made remarkable progress in the past year. The development of more stable qubits has accelerated research significantly.',
    description:
      'should format the entire stream correctly with proper sequence',
  };

  // Process all chunks sequentially
  let result = '';
  for (const chunk of mixedChunksFixture.chunks) {
    result += parser.parse(chunk);
  }

  // Check final processed output
  t.is(result, mixedChunksFixture.expected, mixedChunksFixture.description);
});

// ==================== context ====================
test('should be able to manage context', async t => {
  const {
    context,
    event,
    jobs,
    prompt,
    session,
    storage,
    workspace,
    workspaceStorage,
  } = t.context;

  const ws = await workspace.create(userId);

  await prompt.set(promptName, 'model', [
    { role: 'system', content: 'hello {{word}}' },
  ]);
  const chatSession = await session.create({
    docId: 'test',
    workspaceId: ws.id,
    userId,
    promptName,
    pinned: false,
  });

  // use mocked embedding client
  Sinon.stub(context, 'embeddingClient').get(() => new MockEmbeddingClient());
  Sinon.stub(jobs, 'embeddingClient').get(() => new MockEmbeddingClient());

  {
    await t.throwsAsync(
      context.create(randomUUID()),
      { instanceOf: Error },
      'should throw error if create context with invalid session id'
    );

    const session = context.create(chatSession);
    await t.notThrowsAsync(session, 'should create context with chat session');

    await t.notThrowsAsync(
      context.get((await session).id),
      'should get context after create'
    );

    await t.throwsAsync(
      context.get(randomUUID()),
      { instanceOf: Error },
      'should throw error if get context with invalid id'
    );
  }

  const fs = await import('node:fs');
  const buffer = fs.readFileSync(
    ProjectRoot.join('packages/common/native/fixtures/sample.pdf').toFileUrl()
  );

  {
    const session = await context.create(chatSession);

    // file record
    {
      await storage.put(userId, session.workspaceId, 'blob', buffer);
      const file = await session.addFile(
        'blob',
        'sample.pdf',
        'application/pdf'
      );

      const handler = Sinon.spy(event, 'emit');

      await jobs.embedPendingFile({
        userId,
        workspaceId: session.workspaceId,
        contextId: session.id,
        blobId: file.blobId,
        fileId: file.id,
        fileName: file.name,
      });

      t.deepEqual(handler.lastCall.args, [
        'workspace.file.embed.finished',
        {
          contextId: session.id,
          workspaceId: session.workspaceId,
          fileId: file.id,
          chunkSize: 1,
        },
      ]);

      const list = session.files;
      t.deepEqual(
        list.map(f => f.id),
        [file.id],
        'should list file id'
      );

      const result = await session.matchFiles('test', 1, undefined, 1);
      t.is(result.length, 1, 'should match context');
      t.is(result[0].fileId, file.id, 'should match file id');
    }

    // blob record
    {
      const blobId = 'test-blob';
      await workspaceStorage.put(session.workspaceId, blobId, buffer);

      await jobs.embedPendingBlob({ workspaceId: session.workspaceId, blobId });

      const result = await t.context.context.matchWorkspaceBlobs(
        session.workspaceId,
        'test',
        1,
        undefined,
        1
      );
      t.is(result.length, 1, 'should match blob embedding');
      t.is(result[0].blobId, blobId, 'should match blob id');
    }

    // doc record

    const addDoc = async () => {
      const docId = randomUUID();
      await t.context.db.snapshot.create({
        data: {
          workspaceId: session.workspaceId,
          id: docId,
          blob: Buffer.from([1, 1]),
          state: Buffer.from([1, 1]),
          updatedAt: new Date(),
          createdAt: new Date(),
        },
      });
      return docId;
    };

    {
      const docId = await addDoc();
      const record = await session.addDocRecord(docId);
      const timestamp = (
        await t.context.models.doc.findTimestampsByDocIds(session.workspaceId, [
          docId,
        ])
      )[docId];
      t.is(
        record.snapshotUpdatedAt,
        timestamp,
        'should capture the saved doc timestamp as the context baseline'
      );
      const docs = session.docs.map(d => d.id);
      t.deepEqual(docs, [docId], 'should list doc id');

      await session.removeDocRecord(docId);
      t.deepEqual(session.docs, [], 'should remove doc id');
    }

    // tag record
    {
      const tagId = randomUUID();

      const docId1 = await addDoc();
      const docId2 = await addDoc();

      {
        await session.addCategoryRecord(ContextCategories.Tag, tagId, [docId1]);
        const tags = session.tags.map(t => t.id);
        t.deepEqual(tags, [tagId], 'should list tag id');

        const docs = session.tags.flatMap(l => l.docs);
        t.truthy(
          docs[0].snapshotUpdatedAt,
          'should capture baselines for category docs'
        );
        const docIds = docs.map(d => d.id);
        t.deepEqual(docIds, [docId1], 'should list doc ids');
      }

      {
        await session.addCategoryRecord(ContextCategories.Tag, tagId, [docId2]);

        const docs = session.tags.flatMap(l => l.docs.map(d => d.id));
        t.deepEqual(docs, [docId1, docId2], 'should list doc ids');
      }

      await session.removeCategoryRecord(ContextCategories.Tag, tagId);
      t.deepEqual(session.tags, [], 'should remove tag id');
    }

    // collection record
    {
      const collectionId = randomUUID();

      const docId1 = await addDoc();
      const docId2 = await addDoc();
      {
        await session.addCategoryRecord(
          ContextCategories.Collection,
          collectionId,
          [docId1]
        );
        const collection = session.collections.map(l => l.id);
        t.deepEqual(collection, [collectionId], 'should list collection id');

        const docs = session.collections.flatMap(l => l.docs.map(d => d.id));
        t.deepEqual(docs, [docId1], 'should list doc ids');
      }

      {
        await session.addCategoryRecord(
          ContextCategories.Collection,
          collectionId,
          [docId2]
        );

        const docs = session.collections.flatMap(l => l.docs.map(d => d.id));
        t.deepEqual(docs, [docId1, docId2], 'should list doc ids');
      }

      await session.removeCategoryRecord(
        ContextCategories.Collection,
        collectionId
      );
      t.deepEqual(session.collections, [], 'should remove collection id');
    }
  }
});

// ==================== workspace embedding ====================
test('should backfill pending chunks with 4096-dimensional vectors', async t => {
  const { db, jobs, models, workspace } = t.context;
  const ws = await workspace.create(userId);
  const docId = randomUUID();
  const memoryId = randomUUID();

  await models.doc.upsert({
    spaceId: ws.id,
    docId,
    blob: Uint8Array.from([1, 2, 3]),
    timestamp: Date.now(),
    editorId: userId,
  });
  await db.$executeRaw`
    INSERT INTO "ai_workspace_embeddings"
      ("workspace_id", "doc_id", "chunk", "content", "embedding", "updated_at")
    VALUES (${ws.id}, ${docId}, 0, 'document content', NULL, NOW())
  `;
  await db.aiContextMemory.create({
    data: {
      id: memoryId,
      ownerUserId: userId,
      workspaceId: ws.id,
      scope: 'workspace',
      kind: 'auto_memory',
      content: 'memory content',
      fingerprint: randomUUID(),
    },
  });

  Sinon.stub(jobs, 'embeddingClient').get(() => new MockEmbeddingClient());
  const signal = await jobs.backfillEmbeddingDimensions({ limit: 64 });

  t.is(signal, JOB_SIGNAL.Done);
  t.deepEqual(await models.copilotContext.listPendingEmbeddingBackfill(10), []);
  const dimensions = await db.$queryRaw<Array<{ dimensions: number }>>`
    SELECT vector_dims("embedding")::int AS "dimensions"
    FROM "ai_workspace_embeddings"
    WHERE "workspace_id" = ${ws.id} AND "doc_id" = ${docId}
  `;
  t.is(dimensions[0]?.dimensions, EMBEDDING_DIMENSIONS);
});

test('should be able to manage workspace embedding', async t => {
  const { db, jobs, workspace, workspaceEmbedding, context, prompt, session } =
    t.context;

  // use mocked embedding client
  Sinon.stub(context, 'embeddingClient').get(() => new MockEmbeddingClient());
  Sinon.stub(jobs, 'embeddingClient').get(() => new MockEmbeddingClient());

  const ws = await workspace.create(userId);

  // should create workspace embedding
  {
    const { blobId, file } = await workspaceEmbedding.addFile(userId, ws.id, {
      filename: 'test.txt',
      mimetype: 'text/plain',
      encoding: 'utf-8',
      createReadStream: () => {
        return new Readable({
          read() {
            this.push(Buffer.from('content'));
            this.push(null);
          },
        });
      },
    });
    await workspaceEmbedding.queueFileEmbedding({
      userId,
      workspaceId: ws.id,
      blobId,
      fileId: file.fileId,
      fileName: file.fileName,
    });
    await jobs.embedPendingFile({
      userId,
      workspaceId: ws.id,
      contextId: undefined,
      blobId,
      fileId: file.fileId,
      fileName: file.fileName,
    });

    let ret = 0;
    while (!ret) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      ret = await db.aiWorkspaceFileEmbedding.count({
        where: { workspaceId: ws.id, fileId: file.fileId },
      });
    }
  }

  // should create workspace embedding with file
  {
    await prompt.set(promptName, 'model', [
      { role: 'system', content: 'hello {{word}}' },
    ]);
    const sessionId = await session.create({
      docId: 'test',
      workspaceId: ws.id,
      userId,
      promptName,
      pinned: false,
    });
    const contextSession = await context.create(sessionId);

    const ret = await contextSession.matchFiles('test', 1, undefined, 1);
    t.is(ret.length, 1, 'should match workspace context');
    t.is(ret[0].content, 'content', 'should match content');

    await workspace.update(ws.id, { enableDocEmbedding: false });

    const ret2 = await contextSession.matchFiles('test', 1, undefined, 1);
    t.is(ret2.length, 0, 'should not match workspace context');
  }
});

test('should handle generateSessionTitle correctly under various conditions', async t => {
  const { prompt, session, promptRuntime, workspace, copilotSession } =
    t.context;

  await prompt.set(promptName, 'model', [
    { role: 'user', content: '{{content}}' },
  ]);
  const createSession = async (
    options: {
      userMessage?: string;
      assistantMessage?: string;
      existingTitle?: string;
    } = {}
  ) => {
    const ws = await workspace.create(userId);
    const sessionId = await session.create({
      docId: 'test-doc',
      workspaceId: ws.id,
      userId,
      promptName,
      pinned: false,
    });

    if (options.existingTitle) {
      await copilotSession.update({
        userId,
        sessionId,
        title: options.existingTitle,
      });
    }

    const chatSession = await session.get(sessionId);
    if (chatSession) {
      if (options.userMessage) {
        chatSession.pushTurn(
          buildTurn(sessionId, {
            role: 'user',
            content: options.userMessage,
            createdAt: new Date(),
          })
        );
      }
      if (options.assistantMessage) {
        chatSession.pushTurn(
          buildTurn(sessionId, {
            role: 'assistant',
            content: options.assistantMessage,
            createdAt: new Date(),
          })
        );
      }
      await chatSession.save();
    }

    return sessionId;
  };

  const testCases = [
    {
      name: 'should generate title when conditions are met',
      setup: () =>
        createSession({
          userMessage: 'What is machine learning?',
          assistantMessage:
            'Machine learning is a subset of artificial intelligence.',
        }),
      mockFn: () => 'What is Machine Learning?',
      expectSnapshot: true,
    },
    {
      name: 'should not generate title when session already has title',
      setup: () =>
        createSession({
          userMessage: 'Test message',
          assistantMessage: 'Test response',
          existingTitle: 'Existing Title',
        }),
      mockFn: () => 'New Title',
      expectSnapshot: true,
      expectNotCalled: true,
    },
    {
      name: 'should not generate title when no user messages exist',
      setup: () =>
        createSession({ assistantMessage: 'Hello! How can I help you?' }),
      mockFn: () => 'New Title',
      expectSnapshot: true,
      expectNotCalled: true,
    },
    {
      name: 'should not generate title when no assistant messages exist',
      setup: () => createSession({ userMessage: 'What is AI?' }),
      mockFn: () => 'New Title',
      expectSnapshot: true,
      expectNotCalled: true,
    },
    {
      name: 'should handle errors gracefully',
      setup: () =>
        createSession({
          userMessage: 'Test question',
          assistantMessage: 'Test answer',
        }),
      mockFn: () => {
        throw new Error('Mock error for testing');
      },
      expectError: 'Mock error for testing',
    },
  ];

  for (const testCase of testCases) {
    const sessionId = await testCase.setup();
    let chatWithPromptCalled = false;

    const mockStub = Sinon.stub(promptRuntime, 'runText').callsFake(
      async () => {
        chatWithPromptCalled = true;
        return testCase.mockFn();
      }
    );

    if (testCase.expectError) {
      await t.throwsAsync(
        () => session.generateSessionTitle({ sessionId }),
        { message: testCase.expectError },
        testCase.name
      );
    } else {
      await session.generateSessionTitle({ sessionId });

      if (testCase.expectSnapshot) {
        const sessionState = await session.getState(sessionId);
        t.snapshot(
          {
            chatWithPromptCalled: testCase.expectNotCalled
              ? chatWithPromptCalled
              : undefined,
            title: sessionState?.conversation.title,
            exists: !!sessionState,
          },
          testCase.name
        );
      }
    }

    mockStub.restore();
  }

  {
    const sessionId = await createSession({
      userMessage: 'Explain quantum computing briefly',
      assistantMessage: 'Quantum computing uses quantum mechanics principles.',
    });

    let capturedArgs: any[] = [];
    Sinon.stub(promptRuntime, 'runText').callsFake(async (...args) => {
      capturedArgs = args;
      return 'Quantum Computing Explained';
    });

    await session.generateSessionTitle({ sessionId });

    t.snapshot(
      {
        promptName: capturedArgs[0],
        content: capturedArgs[1]?.content,
      },
      'should use correct prompt for title generation'
    );
  }
});

test('should schedule embedding dimension backfill', async t => {
  const { cronJobs } = t.context;
  const jobAddStub = cronJobs['jobs'].add as Sinon.SinonStub;
  jobAddStub.resetHistory();
  jobAddStub.resolves();

  await cronJobs.scheduleEmbeddingDimensionBackfill();

  t.deepEqual(
    jobAddStub.getCalls().map(call => call.args),
    [
      [
        'copilot.embedding.backfillDimensions',
        { limit: 64 },
        { jobId: 'minute-copilot-embedding-dimension-backfill' },
      ],
    ]
  );
  jobAddStub.reset();
});

test('should handle copilot cron jobs correctly', async t => {
  const { cronJobs, copilotSession } = t.context;

  // mock calls
  const mockCleanupResult = { removed: 2, cleaned: 3 };
  const mockSessions = [
    { id: 'session1', _count: { messages: 1 } },
    { id: 'session2', _count: { messages: 2 } },
  ];
  const cleanupStub = Sinon.stub(
    copilotSession,
    'cleanupEmptySessions'
  ).resolves(mockCleanupResult);
  const toBeGenerateStub = Sinon.stub(
    copilotSession,
    'toBeGenerateTitle'
  ).resolves(mockSessions);
  const jobAddStub = cronJobs['jobs'].add as Sinon.SinonStub;
  jobAddStub.resetHistory();
  jobAddStub.resolves();

  // daily cleanup job scheduling
  {
    await cronJobs.dailyCleanupJob();
    t.deepEqual(
      jobAddStub.getCalls().map(call => call.args),
      [
        [
          'copilot.session.cleanupEmptySessions',
          {},
          {
            jobId: 'daily-copilot-cleanup-empty-sessions',
          },
        ],
        [
          'copilot.session.generateMissingTitles',
          {},
          {
            jobId: 'daily-copilot-generate-missing-titles',
          },
        ],
        [
          'copilot.workspace.cleanupTrashedDocEmbeddings',
          {},
          {
            jobId: 'daily-copilot-cleanup-trashed-doc-embeddings',
          },
        ],
        [
          'copilot.supportBundle.cleanupRetention',
          {
            limit: 50,
          },
          {
            jobId: 'daily-copilot-support-bundle-retention-cleanup',
          },
        ],
        [
          'copilot.supportBundle.cleanupDownloadAuthorizations',
          {
            limit: 50,
          },
          {
            jobId:
              'daily-copilot-support-bundle-download-authorization-cleanup',
          },
        ],
        [
          'copilot.supportBundle.processTransferForwardingEvents',
          {
            limit: 50,
          },
          {
            jobId: 'daily-copilot-support-bundle-transfer-forwarding-events',
          },
        ],
        [
          'copilot.providerHealth.persistConfiguredSnapshots',
          {},
          {
            jobId: 'daily-copilot-provider-health-snapshot-persistence',
          },
        ],
        [
          'copilot.providerHealth.enqueueWorkspaceProbeAttempts',
          {
            limit: 100,
          },
          {
            jobId: 'daily-copilot-provider-health-probe-enqueue',
          },
        ],
        [
          'copilot.providerHealth.processProbeAttempts',
          {
            limit: 50,
          },
          {
            jobId: 'daily-copilot-provider-health-probe-process',
          },
        ],
      ]
    );

    jobAddStub.reset();
    cleanupStub.reset();
    toBeGenerateStub.reset();
  }

  // minute agent runtime and stale lease recovery scheduling
  {
    await cronJobs.scheduleAgentRuntimeRuns();
    t.deepEqual(
      jobAddStub.getCalls().map(call => call.args),
      [
        [
          'copilot.supportBundle.processTransferForwardingEvents',
          {
            limit: 50,
          },
          {
            jobId: 'minute-copilot-support-bundle-transfer-forwarding-events',
          },
        ],
        [
          'copilot.agentRuntime.recoverExpiredLeases',
          {
            limit: 50,
          },
          {
            jobId: 'minute-copilot-agent-runtime-recover-expired-leases',
          },
        ],
        [
          'copilot.agentRuntime.enqueueQueued',
          {
            limit: 50,
          },
          {
            jobId: 'minute-copilot-agent-runtime-enqueue-queued',
          },
        ],
        ['copilot.agentRuntime.run', {}],
        [
          'copilot.repairExecution.recoverExpiredLeases',
          {
            limit: 50,
          },
          {
            jobId: 'minute-copilot-repair-execution-recover-expired-leases',
          },
        ],
        [
          'copilot.repairExecution.enqueueQueued',
          {
            limit: 50,
          },
          {
            jobId: 'minute-copilot-repair-execution-enqueue-queued',
          },
        ],
        [
          'copilot.providerHealth.processProbeAttempts',
          {
            limit: 50,
          },
          {
            jobId: 'minute-copilot-provider-health-probe-process',
          },
        ],
      ]
    );
    jobAddStub.reset();
  }

  // cleanup empty sessions
  {
    // mock
    cleanupStub.resolves(mockCleanupResult);
    toBeGenerateStub.resolves(mockSessions);

    await cronJobs.cleanupEmptySessions();
    t.deepEqual(
      cleanupStub
        .getCalls()
        .map(call =>
          call.args.map(arg => (arg instanceof Date ? 'Date' : arg))
        ),
      [['Date']]
    );
  }

  // generate missing titles
  await cronJobs.generateMissingTitles();
  t.deepEqual(
    {
      modelCalls: toBeGenerateStub.getCalls().map(call => call.args),
      jobCalls: jobAddStub.getCalls().map(call => call.args),
    },
    {
      modelCalls: [[]],
      jobCalls: [
        [
          'copilot.session.generateTitle',
          {
            sessionId: 'session1',
          },
        ],
        [
          'copilot.session.generateTitle',
          {
            sessionId: 'session2',
          },
        ],
      ],
    }
  );

  cleanupStub.restore();
  toBeGenerateStub.restore();
  jobAddStub.resetHistory();
});

test('model selection policy should resolve requested optional models consistently', async t => {
  const { module } = t.context;
  const modelSelection = module.get(ModelSelectionPolicy);

  t.deepEqual(
    modelSelection.resolveRequestedModel({
      defaultModel: 'gpt-5.6-luna',
      optionalModels: ['gpt-5.6-luna', 'gpt-5.6-terra', 'claude-sonnet-4-6'],
      requestedModelId: 'gpt-5.6-terra',
    }),
    {
      selectedModel: 'gpt-5.6-terra',
      matchedOptionalModel: true,
    }
  );

  t.deepEqual(
    modelSelection.resolveRequestedModel({
      defaultModel: 'gpt-5.6-luna',
      optionalModels: ['gpt-5.6-luna', 'gpt-5.6-terra', 'claude-sonnet-4-6'],
      requestedModelId: 'openai-default/gpt-5.6-terra',
    }),
    {
      selectedModel: 'openai-default/gpt-5.6-terra',
      matchedOptionalModel: true,
    }
  );

  t.deepEqual(
    modelSelection.resolveRequestedModel({
      defaultModel: 'gpt-5.6-luna',
      optionalModels: ['gpt-5.6-luna', 'gpt-5.6-terra', 'claude-sonnet-4-6'],
      requestedModelId: 'not-in-optional',
    }),
    {
      selectedModel: 'gpt-5.6-luna',
      matchedOptionalModel: false,
    }
  );

  t.is(
    modelSelection.resolveRequestedModel({
      defaultModel: 'gpt-5.6-luna',
      optionalModels: ['gpt-5.6-luna', 'gpt-5.6-terra', 'claude-sonnet-4-6'],
      requestedModelId: 'not-in-optional',
    }).selectedModel,
    'gpt-5.6-luna'
  );
});

test('capability policy host should fallback when prompt default model is not routable', async t => {
  const { module } = t.context;
  const capabilityPolicy = module.get(CapabilityPolicyHost);
  const factory = module.get(CopilotProviderFactory);

  Sinon.stub(factory, 'getEffectiveModelSelectionScope').resolves({
    providerIds: ['openai-default'],
    configuredModelIds: ['openai-default/gpt-5-mini'],
  });
  Sinon.stub(factory, 'resolveModelId').callsFake(async cond => {
    if (cond.modelId === 'gemini-2.5-flash') {
      return undefined;
    }
    if (cond.modelId === 'openai-default/gpt-5-mini') {
      return 'openai-default/gpt-5-mini';
    }
    if (!cond.modelId && cond.outputType === ModelOutputType.Text) {
      return 'openai-default/gpt-5-mini';
    }
    return undefined;
  });

  const model = await capabilityPolicy.resolveChatModel({
    userId,
    defaultModel: 'gemini-2.5-flash',
    optionalModels: ['gemini-2.5-flash'],
    paymentEnabled: false,
  });
  t.is(model, 'openai-default/gpt-5-mini');

  const requested = await capabilityPolicy.resolveChatModel({
    userId,
    defaultModel: 'gemini-2.5-flash',
    optionalModels: ['gemini-2.5-flash'],
    requestedModelId: 'openai-default/gpt-5-mini',
    paymentEnabled: false,
  });
  t.is(requested, 'openai-default/gpt-5-mini');
});

test('capability policy host should select image routes with image output type', async t => {
  const { module } = t.context;
  const capabilityPolicy = module.get(CapabilityPolicyHost);
  const factory = module.get(CopilotProviderFactory);
  const routeContext = {
    userId,
    workspaceId: 'workspace-1',
    byokLeaseId: 'lease-1',
    featureKind: 'image' as const,
    quotaBackedRoutesAllowed: false,
  };

  const getEffectiveModelSelectionScope = Sinon.stub(
    factory,
    'getEffectiveModelSelectionScope'
  ).resolves({
    providerIds: [],
    configuredModelIds: ['local-image-model'],
  });
  const resolveModelId = Sinon.stub(factory, 'resolveModelId').callsFake(
    async cond =>
      cond.outputType === ModelOutputType.Image &&
      cond.modelId === 'local-image-model'
        ? 'local-image-model'
        : undefined
  );
  const resolveModelContextWindow = Sinon.stub(
    factory,
    'resolveModelContextWindow'
  ).resolves(undefined);

  const selected = await capabilityPolicy.selectChat(
    {
      config: {
        userId,
        workspaceId: 'workspace-1',
        sessionId: 'session-1',
        promptConfig: {},
      },
      model: 'prompt-image-model',
      optionalModels: ['prompt-image-model', 'local-image-model'],
    } as any,
    {
      responseMode: 'image',
      modelId: 'local-image-model',
      byokLeaseId: 'lease-1',
      quotaBackedRoutesAllowed: false,
    }
  );

  t.is(selected.model, 'local-image-model');
  t.like(selected.providerOptions, {
    user: userId,
    session: 'session-1',
    workspace: 'workspace-1',
    byokLeaseId: 'lease-1',
    featureKind: 'image',
    quotaBackedRoutesAllowed: false,
  });
  Sinon.assert.calledOnceWithExactly(
    getEffectiveModelSelectionScope,
    routeContext
  );
  t.true(
    resolveModelId.getCalls().some(call => {
      const [cond, filter, context] = call.args;
      return (
        cond.modelId === 'local-image-model' &&
        cond.outputType === ModelOutputType.Image &&
        Object.keys(filter ?? {}).length === 0 &&
        context?.workspaceId === routeContext.workspaceId &&
        context?.byokLeaseId === routeContext.byokLeaseId &&
        context?.featureKind === routeContext.featureKind &&
        context?.quotaBackedRoutesAllowed ===
          routeContext.quotaBackedRoutesAllowed
      );
    })
  );
  Sinon.assert.calledOnceWithExactly(
    resolveModelContextWindow,
    {
      modelId: 'local-image-model',
      outputType: ModelOutputType.Image,
    },
    {},
    routeContext
  );
});

test('capability policy host should gate pro model requests by subscription status', async t => {
  const { quotaState, subscription, module } = t.context;
  const capabilityPolicy = module.get(CapabilityPolicyHost);
  const defaultModel = 'gpt-5.6-luna';
  const proModel = 'gpt-5.6-terra';
  const prefixedProModel = `openai-default/${proModel}`;
  const optionalModels = [defaultModel, proModel, 'claude-sonnet-4-6'];
  const proModels = [proModel, 'claude-sonnet-4-6'];

  const mockStatus = (status?: SubscriptionStatus) => {
    Sinon.restore();
    Sinon.stub(subscription, 'select').callsFake(() => ({
      // @ts-expect-error mock
      getSubscription: async () => (status ? { status } : null),
    }));
    Sinon.stub(quotaState, 'reconcileUserQuotaState').resolves({
      plan: status === SubscriptionStatus.Active ? 'pro' : 'free',
      flags: {},
    } as Awaited<ReturnType<QuotaStateService['reconcileUserQuotaState']>>);
  };

  // payment disabled -> allow requested if in optional; pro not blocked
  {
    const model1 = await capabilityPolicy.resolveChatModel({
      userId,
      defaultModel,
      optionalModels,
      proModels,
      requestedModelId: proModel,
      paymentEnabled: false,
    });
    t.is(model1, proModel, 'should honor requested pro model');

    const model1WithPrefix = await capabilityPolicy.resolveChatModel({
      userId,
      defaultModel,
      optionalModels,
      proModels,
      requestedModelId: prefixedProModel,
      paymentEnabled: false,
    });
    t.is(
      model1WithPrefix,
      prefixedProModel,
      'should honor requested prefixed pro model'
    );

    const model2 = await capabilityPolicy.resolveChatModel({
      userId,
      defaultModel,
      optionalModels,
      proModels,
      requestedModelId: 'not-in-optional',
      paymentEnabled: false,
    });
    t.is(model2, defaultModel, 'should fallback to default model');
  }

  // payment enabled + trialing: requesting pro should fallback to default
  {
    mockStatus(SubscriptionStatus.Trialing);
    const model3 = await capabilityPolicy.resolveChatModel({
      userId,
      defaultModel,
      optionalModels,
      proModels,
      requestedModelId: proModel,
      paymentEnabled: true,
    });
    t.is(
      model3,
      defaultModel,
      'should fallback to default model when requesting pro model during trialing'
    );

    const model3WithPrefix = await capabilityPolicy.resolveChatModel({
      userId,
      defaultModel,
      optionalModels,
      proModels,
      requestedModelId: prefixedProModel,
      paymentEnabled: true,
    });
    t.is(
      model3WithPrefix,
      defaultModel,
      'should fallback to default model when requesting prefixed pro model during trialing'
    );

    const model4 = await capabilityPolicy.resolveChatModel({
      userId,
      defaultModel,
      optionalModels,
      proModels,
      requestedModelId: defaultModel,
      paymentEnabled: true,
    });
    t.is(
      model4,
      defaultModel,
      'should honor requested non-pro model during trialing'
    );

    const model5 = await capabilityPolicy.resolveChatModel({
      userId,
      defaultModel,
      optionalModels,
      proModels,
      paymentEnabled: true,
    });
    t.is(
      model5,
      defaultModel,
      'should pick default model when no requested model during trialing'
    );
  }

  // payment enabled + active: without requested -> default model; requested pro should be honored
  {
    mockStatus(SubscriptionStatus.Active);
    const model6 = await capabilityPolicy.resolveChatModel({
      userId,
      defaultModel,
      optionalModels,
      proModels,
      paymentEnabled: true,
    });
    t.is(
      model6,
      defaultModel,
      'should pick default model when no requested model during active'
    );

    const model7 = await capabilityPolicy.resolveChatModel({
      userId,
      defaultModel,
      optionalModels,
      proModels,
      requestedModelId: proModel,
      paymentEnabled: true,
    });
    t.is(model7, proModel, 'should honor requested pro model during active');

    const model7WithPrefix = await capabilityPolicy.resolveChatModel({
      userId,
      defaultModel,
      optionalModels,
      proModels,
      requestedModelId: prefixedProModel,
      paymentEnabled: true,
    });
    t.is(
      model7WithPrefix,
      prefixedProModel,
      'should honor requested prefixed pro model during active'
    );

    const model8 = await capabilityPolicy.resolveChatModel({
      userId,
      defaultModel,
      optionalModels,
      proModels,
      requestedModelId: 'not-in-optional',
      paymentEnabled: true,
    });
    t.is(
      model8,
      defaultModel,
      'should fallback to default model when requesting non-optional model during active'
    );
  }
});

test('prompt runtime should resolve prefixed optional models consistently', async t => {
  const { prompt, promptRuntime, chatRuntime } = t.context;

  const promptName = randomUUID().replaceAll('-', '');
  await prompt.set(
    promptName,
    'gpt-5.6-luna',
    [{ role: 'user', content: '{{content}}' }],
    { proModels: ['gpt-5.6-terra'] },
    { optionalModels: ['gpt-5.6-terra'] }
  );

  const textStub = Sinon.stub(chatRuntime, 'text').resolves('ok');

  await promptRuntime.runText(
    promptName,
    { content: 'hello' },
    { modelId: 'openai-default/gpt-5.6-terra' }
  );
  t.is(
    textStub.firstCall.args[0].modelId,
    'openai-default/gpt-5.6-terra',
    'should preserve accepted provider-prefixed optional model'
  );

  await promptRuntime.runText(
    promptName,
    { content: 'hello' },
    { modelId: 'openai-default/not-in-optional' }
  );
  t.is(
    textStub.secondCall.args[0].modelId,
    'gpt-5.6-luna',
    'should fallback to default model for non-optional prefixed model'
  );
});

test('prompt runtime should resolve models with action route context', async t => {
  const { prompt, promptRuntime, chatRuntime, factory } = t.context;

  const promptName = randomUUID().replaceAll('-', '');
  await prompt.set(
    promptName,
    'gemini-default',
    [{ role: 'user', content: '{{content}}' }],
    {},
    { optionalModels: ['gemini-default', 'local/office-fast'] }
  );

  const resolveModelId = Sinon.stub(factory, 'resolveModelId').callsFake(
    async (cond, _filter, context) => {
      if (
        cond.modelId === 'gemini-default' &&
        context?.workspaceId === 'workspace-1' &&
        context.featureKind === 'action'
      ) {
        return undefined;
      }

      if (
        !cond.modelId &&
        cond.outputType === ModelOutputType.Text &&
        context?.workspaceId === 'workspace-1' &&
        context.featureKind === 'action'
      ) {
        return 'local/office-fast';
      }

      return cond.modelId;
    }
  );
  const textStub = Sinon.stub(chatRuntime, 'text').resolves('ok');

  await promptRuntime.runText(
    promptName,
    { content: 'hello' },
    {
      providerOptions: {
        user: userId,
        workspace: 'workspace-1',
        session: 'session-1',
        byokLeaseId: 'lease-1',
        quotaBackedRoutesAllowed: false,
      },
    }
  );

  t.is(textStub.firstCall.args[0].modelId, 'local/office-fast');
  t.like(textStub.firstCall.args[2], {
    user: userId,
    workspace: 'workspace-1',
    session: 'session-1',
    byokLeaseId: 'lease-1',
    quotaBackedRoutesAllowed: false,
    featureKind: 'action',
  });
  t.true(
    resolveModelId.getCalls().some(call => {
      const [cond, , context] = call.args;
      return (
        cond.modelId === 'gemini-default' &&
        context?.workspaceId === 'workspace-1' &&
        context.featureKind === 'action' &&
        context.byokLeaseId === 'lease-1' &&
        context.quotaBackedRoutesAllowed === false
      );
    })
  );
});

test('prompt runtime should infer image route context from prompt metadata', async t => {
  const { promptRuntime, chatRuntime, factory } = t.context;

  const resolveModelId = Sinon.stub(factory, 'resolveModelId').callsFake(
    async (cond, _filter, context) => {
      if (cond.modelId === 'gpt-image-1' && context?.featureKind === 'image') {
        return undefined;
      }

      if (
        !cond.modelId &&
        cond.outputType === ModelOutputType.Text &&
        context?.featureKind === 'image'
      ) {
        return 'local/image-text';
      }

      return cond.modelId;
    }
  );
  Sinon.stub(factory, 'resolveModelContextWindow').resolves(undefined);
  const textStub = Sinon.stub(chatRuntime, 'text').resolves('ok');

  await promptRuntime.runText(
    'Generate image',
    { content: 'draw a quiet workspace' },
    {
      providerOptions: {
        user: userId,
        workspace: 'workspace-1',
      },
    }
  );

  t.is(textStub.firstCall.args[0].modelId, 'local/image-text');
  t.like(textStub.firstCall.args[2], {
    user: userId,
    workspace: 'workspace-1',
    featureKind: 'image',
  });
  t.true(
    resolveModelId.getCalls().some(call => {
      const [cond, , context] = call.args;
      return (
        cond.modelId === 'gpt-image-1' &&
        cond.outputType === ModelOutputType.Text &&
        context?.workspaceId === 'workspace-1' &&
        context.featureKind === 'image'
      );
    })
  );
});

test('prompt runtime should resolve structured prompts with structured route policy', async t => {
  const { prompt, promptRuntime, chatRuntime, factory } = t.context;

  const promptName = randomUUID().replaceAll('-', '');
  await prompt.set(
    promptName,
    'office-chat-fast',
    [{ role: 'user', content: '{{content}}' }],
    {},
    { optionalModels: ['office-chat-fast', 'office-structured'] }
  );

  const resolveModelId = Sinon.stub(factory, 'resolveModelId').callsFake(
    async (cond, _filter, context) => {
      if (
        cond.modelId === 'office-chat-fast' &&
        cond.outputType === ModelOutputType.Structured &&
        context?.featureKind === 'action'
      ) {
        return undefined;
      }

      if (
        !cond.modelId &&
        cond.outputType === ModelOutputType.Structured &&
        context?.featureKind === 'action'
      ) {
        return 'local/office-structured';
      }

      return cond.modelId;
    }
  );
  Sinon.stub(factory, 'resolveModelContextWindow').resolves(undefined);
  const structuredStub = Sinon.stub(
    chatRuntime,
    'generateStructuredValue'
  ).resolves({
    value: { result: 'ok' },
    schemaHash: 'schema-hash',
    schemaValidationVersion: 'json-schema-v1',
    provider: 'auto',
    model: 'local/office-structured',
  });

  await promptRuntime.runStructured(
    promptName,
    { content: 'hello' },
    {
      responseContract: {
        responseSchemaJson: {
          type: 'object',
          properties: { result: { type: 'string' } },
          required: ['result'],
          additionalProperties: false,
        },
        schemaHash: 'schema-hash',
      },
      providerOptions: {
        user: userId,
        workspace: 'workspace-1',
      },
    }
  );

  t.is(structuredStub.firstCall.args[0].modelId, 'local/office-structured');
  t.true(
    resolveModelId.getCalls().some(call => {
      const [cond, , context] = call.args;
      return (
        cond.modelId === 'office-chat-fast' &&
        cond.outputType === ModelOutputType.Structured &&
        context?.workspaceId === 'workspace-1' &&
        context.featureKind === 'action'
      );
    })
  );
});

test('prompt runtime should infer transcript route context for structured prompts', async t => {
  const { promptRuntime, chatRuntime, factory } = t.context;

  const resolveModelId = Sinon.stub(factory, 'resolveModelId').callsFake(
    async (cond, _filter, context) => {
      if (
        cond.modelId === 'gemini-3.5-flash-lite' &&
        cond.outputType === ModelOutputType.Structured &&
        context?.featureKind === 'transcript'
      ) {
        return undefined;
      }

      if (
        !cond.modelId &&
        cond.outputType === ModelOutputType.Structured &&
        context?.featureKind === 'transcript'
      ) {
        return 'local/transcript-structured';
      }

      return cond.modelId;
    }
  );
  Sinon.stub(factory, 'resolveModelContextWindow').resolves(undefined);
  const structuredStub = Sinon.stub(
    chatRuntime,
    'generateStructuredValue'
  ).resolves({
    value: { result: 'ok' },
    schemaHash: 'schema-hash',
    schemaValidationVersion: 'json-schema-v1',
    provider: 'auto',
    model: 'local/transcript-structured',
  });

  await promptRuntime.runStructured(
    'Transcript audio structured',
    { content: '{}' },
    {
      responseContract: {
        responseSchemaJson: {
          type: 'object',
          properties: { result: { type: 'string' } },
          required: ['result'],
          additionalProperties: false,
        },
        schemaHash: 'schema-hash',
      },
      providerOptions: {
        user: userId,
        workspace: 'workspace-1',
      },
    }
  );

  t.is(structuredStub.firstCall.args[0].modelId, 'local/transcript-structured');
  t.like(structuredStub.firstCall.args[2], {
    user: userId,
    workspace: 'workspace-1',
    featureKind: 'transcript',
  });
  t.true(
    resolveModelId.getCalls().some(call => {
      const [cond, , context] = call.args;
      return (
        cond.modelId === 'gemini-3.5-flash-lite' &&
        cond.outputType === ModelOutputType.Structured &&
        context?.workspaceId === 'workspace-1' &&
        context.featureKind === 'transcript'
      );
    })
  );
});

test('prompt runtime should keep explicit route feature context', async t => {
  const { promptRuntime, chatRuntime, factory } = t.context;

  const resolveModelId = Sinon.stub(factory, 'resolveModelId').callsFake(
    async (cond, _filter, context) => {
      if (
        cond.modelId === 'gemini-3.5-flash-lite' &&
        cond.outputType === ModelOutputType.Structured &&
        context?.featureKind === 'action'
      ) {
        return undefined;
      }

      if (
        !cond.modelId &&
        cond.outputType === ModelOutputType.Structured &&
        context?.featureKind === 'action'
      ) {
        return 'local/action-structured';
      }

      return cond.modelId;
    }
  );
  Sinon.stub(factory, 'resolveModelContextWindow').resolves(undefined);
  const structuredStub = Sinon.stub(
    chatRuntime,
    'generateStructuredValue'
  ).resolves({
    value: { result: 'ok' },
    schemaHash: 'schema-hash',
    schemaValidationVersion: 'json-schema-v1',
    provider: 'auto',
    model: 'local/action-structured',
  });

  await promptRuntime.runStructured(
    'Transcript audio structured',
    { content: '{}' },
    {
      responseContract: {
        responseSchemaJson: {
          type: 'object',
          properties: { result: { type: 'string' } },
          required: ['result'],
          additionalProperties: false,
        },
        schemaHash: 'schema-hash',
      },
      providerOptions: {
        user: userId,
        workspace: 'workspace-1',
        featureKind: 'action',
      },
    }
  );

  t.is(structuredStub.firstCall.args[0].modelId, 'local/action-structured');
  t.like(structuredStub.firstCall.args[2], {
    user: userId,
    workspace: 'workspace-1',
    featureKind: 'action',
  });
  t.true(
    resolveModelId.getCalls().some(call => {
      const [cond, , context] = call.args;
      return (
        cond.modelId === 'gemini-3.5-flash-lite' &&
        cond.outputType === ModelOutputType.Structured &&
        context?.workspaceId === 'workspace-1' &&
        context.featureKind === 'action'
      );
    })
  );
});

test('prompt runtime should cap appended prompt session by selected model context window', async t => {
  const { prompt, promptRuntime, chatRuntime, factory } = t.context;

  const promptName = randomUUID().replaceAll('-', '');
  await prompt.set(
    promptName,
    'local/office-fast',
    [{ role: 'system', content: 'summary' }],
    { maxTokens: 8192 },
    { optionalModels: ['local/office-fast'] }
  );

  Sinon.stub(factory, 'resolveModelId').callsFake(async cond => cond.modelId);
  Sinon.stub(factory, 'resolveModelContextWindow').resolves(4096);
  const renderSession = Sinon.stub(prompt, 'renderSession').returns([
    { role: 'system', content: 'summary' },
    { role: 'user', content: 'recent turn' },
  ]);
  const textStub = Sinon.stub(chatRuntime, 'text').resolves('ok');

  await promptRuntime.runText(
    promptName,
    {},
    {
      appendMessages: [{ role: 'user', content: 'recent turn' }],
      providerOptions: {
        session: 'session-1',
        workspace: 'workspace-1',
      },
    }
  );

  Sinon.assert.calledOnceWithExactly(
    renderSession,
    Sinon.match.has('name', promptName),
    [{ role: 'user', content: 'recent turn' }],
    {},
    4096,
    'session-1'
  );
  t.deepEqual(textStub.firstCall.args[1], [
    { role: 'system', content: 'summary' },
    { role: 'user', content: 'recent turn' },
  ]);
});

test('resolver models should use resolved provider metadata for display names', async t => {
  const { prompt, factory, module } = t.context;
  const resolver = module.get(CopilotResolver);

  const promptName = randomUUID().replaceAll('-', '');
  await prompt.set(
    promptName,
    'gpt-5.6-luna',
    [{ role: 'system', content: 'test' }],
    { proModels: ['gpt-5.6-terra'] },
    { optionalModels: ['gpt-5.6-luna', 'gpt-5.6-terra'] }
  );

  const resolveProvider = Sinon.stub(factory, 'resolveProvider').callsFake(
    async cond =>
      ({
        providerId: 'openai-default',
        rawModelId: cond.modelId,
        modelId: cond.modelId,
        fallbackProviderIds: ['openai-default', 'private-cloud-backup'],
        profile: {
          id: 'openai-default',
          type: CopilotProviderType.OpenAI,
          enabled: true,
          priority: 10,
          privacy: 'private_cloud',
          health: { status: 'degraded' },
          config: {},
          middleware: {},
        },
        provider: {
          resolveModel: (modelId: string) => ({
            id: modelId,
            name: `Resolved ${modelId}`,
          }),
        },
      }) as any
  );
  Sinon.stub(factory, 'describeRoutePolicy').returns({
    enabled: true,
    featureKind: 'chat',
    allowedProviderIds: ['openai-default'],
    allowedPrivacy: ['private_cloud'],
    preferredPrivacy: ['private_cloud', 'cloud'],
  });

  const models = await resolver.models(promptName);

  for (const model of [...models.optionalModels, ...models.proModels]) {
    t.regex(model.effectiveSourceFingerprint ?? '', /^[a-f0-9]{16}$/);
    t.is(
      model.effectiveSourceFingerprintVersion,
      'copilot-model-list-effective-source/v1'
    );
    t.true(
      model.effectiveSourceFingerprintInputs?.includes('providerProfileSource')
    );
    t.true(
      model.effectiveSourceFingerprintInputs?.includes('routePolicyFeatureKind')
    );
  }

  t.deepEqual(normalizeModelListForAssertion(models.optionalModels), [
    {
      id: 'gpt-5.6-luna',
      name: 'Resolved gpt-5.6-luna',
      sources: ['default', 'prompt'],
      promptName,
      promptSource: 'compat',
      promptCategory: 'text',
      promptModelSource: 'compat',
      promptModelSources: [
        {
          candidateSource: 'default',
          modelSource: 'compat',
        },
        {
          candidateSource: 'prompt',
          modelSource: 'compat',
        },
      ],
      promptOverrideApplied: false,
      providerId: 'openai-default',
      providerProfileId: 'openai-default',
      routeModelId: 'gpt-5.6-luna',
      routeFallbackProviderIds: ['openai-default', 'private-cloud-backup'],
      providerType: CopilotProviderType.OpenAI,
      providerPrivacy: 'private_cloud',
      providerHealth: 'degraded',
      providerPriority: 10,
      routePolicyEnabled: true,
      routePolicyFeatureKind: 'chat',
      routePolicyAllowedProviderIds: ['openai-default'],
      routePolicyAllowedPrivacy: ['private_cloud'],
      routePolicyPreferredPrivacy: ['private_cloud', 'cloud'],
    },
    {
      id: 'gpt-5.6-terra',
      name: 'Resolved gpt-5.6-terra',
      sources: ['prompt'],
      promptName,
      promptSource: 'compat',
      promptCategory: 'text',
      promptModelSource: 'compat',
      promptModelSources: [
        {
          candidateSource: 'prompt',
          modelSource: 'compat',
        },
      ],
      promptOverrideApplied: false,
      providerId: 'openai-default',
      providerProfileId: 'openai-default',
      routeModelId: 'gpt-5.6-terra',
      routeFallbackProviderIds: ['openai-default', 'private-cloud-backup'],
      providerType: CopilotProviderType.OpenAI,
      providerPrivacy: 'private_cloud',
      providerHealth: 'degraded',
      providerPriority: 10,
      routePolicyEnabled: true,
      routePolicyFeatureKind: 'chat',
      routePolicyAllowedProviderIds: ['openai-default'],
      routePolicyAllowedPrivacy: ['private_cloud'],
      routePolicyPreferredPrivacy: ['private_cloud', 'cloud'],
    },
  ]);
  t.deepEqual(normalizeModelListForAssertion(models.proModels), [
    {
      id: 'gpt-5.6-terra',
      name: 'Resolved gpt-5.6-terra',
      sources: ['pro'],
      promptName,
      promptSource: 'compat',
      promptCategory: 'text',
      promptModelSource: 'compat',
      promptModelSources: [
        {
          candidateSource: 'pro',
          modelSource: 'compat',
        },
      ],
      promptOverrideApplied: false,
      providerId: 'openai-default',
      providerProfileId: 'openai-default',
      routeModelId: 'gpt-5.6-terra',
      routeFallbackProviderIds: ['openai-default', 'private-cloud-backup'],
      providerType: CopilotProviderType.OpenAI,
      providerPrivacy: 'private_cloud',
      providerHealth: 'degraded',
      providerPriority: 10,
      routePolicyEnabled: true,
      routePolicyFeatureKind: 'chat',
      routePolicyAllowedProviderIds: ['openai-default'],
      routePolicyAllowedPrivacy: ['private_cloud'],
      routePolicyPreferredPrivacy: ['private_cloud', 'cloud'],
    },
  ]);
  t.true(
    resolveProvider.alwaysCalledWithMatch({
      outputType: ModelOutputType.Text,
    })
  );
  t.true(resolveProvider.called);
  t.true(
    resolveProvider
      .getCalls()
      .every(call => call.args[2]?.featureKind === 'chat')
  );
});

test('resolver prompts should expose safe prompt catalog metadata', async t => {
  const { module } = t.context;
  const resolver = module.get(CopilotResolver);

  const prompts = await resolver.prompts({ workspaceId: null });
  const chat = prompts.find(prompt => prompt.name === 'Chat With LocalMind AI');

  t.true(prompts.length > 0);
  t.truthy(chat);
  t.is(chat?.source, 'built_in');
  t.is(chat?.category, 'text');
  t.is(chat?.modelSource, 'built_in');
  t.is(chat?.modelConfigPath, undefined);
  t.true(Array.isArray(chat?.optionalModels));
  t.is(chat?.optionalModelsSource, 'built_in');
  t.is(chat?.optionalModelsConfigPath, undefined);
  t.is(chat?.optionalModelCount, chat?.optionalModels.length);
  t.is(chat?.proModelsSource, 'built_in');
  t.is(chat?.proModelsConfigPath, undefined);
  t.is(chat?.paramCount, chat?.paramKeys.length);
  t.false('messages' in (chat as object));
  t.false('config' in (chat as object));
});

test('resolver action run prepared route trace should expose sanitized workspace scoped diagnostics', async t => {
  const { models, module, workspace } = t.context;
  const resolver = module.get(CopilotResolver);
  const ws = await workspace.create(userId);
  const run = await models.copilotActionRun.create({
    userId,
    workspaceId: ws.id,
    actionId: 'mindmap.generate',
    actionVersion: 'v1',
  });

  await models.copilotActionRun.complete(run.id, {
    status: 'succeeded',
    trace: {
      native: { messages: [{ role: 'user', content: 'secret prompt' }] },
      preparedRoutes: {
        type: 'prepared_routes',
        status: 'succeeded',
        steps: [
          {
            stepId: 'generate',
            kind: 'structured',
            routeCount: 1,
            requestedModelId: 'local/office-structured',
            requestedModelSource: 'prompt_preference',
            fallbackProviderIds: ['ollama-main', 'openai-default'],
            routes: [
              {
                behaviorFlags: ['tool_calls'],
                canonicalModelKey: 'local/office-structured',
                dimensionMismatch: true,
                providerId: 'ollama-main',
                modelId: 'local/office-structured',
                modelBackendKind: 'openai_chat',
                modelEmbeddingDimensions: 1536,
                routeIndex: 0,
                fallbackOrderIndex: 0,
                protocol: 'openai_chat',
                requestLayer: 'chat_completions',
                requestedDimensions: 1024,
                providerConfiguredModelCount: 2,
                providerConfiguredModelIds: [
                  'local/office-structured',
                  'office-structured',
                ],
                providerHealth: 'healthy',
                providerHealthCheckedAt: '2026-06-16T09:30:00.000Z',
                providerName: 'Local Ollama',
                providerPrivacy: 'local',
                providerPriority: 10,
                providerProfileConfigPath:
                  'copilot.providers.profiles[id=ollama-main]',
                providerProfileId: 'ollama-main',
                providerProfileSource: 'configured',
                providerSource: 'configured',
                providerType: 'openaiCompatible',
                routeModelAliasMatched: true,
                routeModelDefinitionAliases: ['office-structured'],
                routeModelDefinitionId: 'local/office-structured',
                routeModelDefinitionSource: 'provider_profile',
                routeRawModelId: 'qwen3:32b',
                backendConfig: {
                  base_url: 'http://host.docker.internal:11434/v1',
                  auth_token: 'should-not-be-returned',
                },
              },
            ],
          },
        ],
      },
    },
  });

  const trace = await resolver.actionRunPreparedRouteTrace(
    { id: userId } as any,
    { workspaceId: ws.id },
    run.id
  );

  t.deepEqual(trace, {
    type: 'prepared_routes',
    status: 'succeeded',
    steps: [
      {
        stepId: 'generate',
        kind: 'structured',
        routeCount: 1,
        actualRouteCount: 1,
        routeCountMismatch: false,
        requestedModelId: 'local/office-structured',
        requestedModelSource: 'prompt_preference',
        fallbackProviderIds: ['ollama-main', 'openai-default'],
        routes: [
          {
            behaviorFlags: ['tool_calls'],
            canonicalModelKey: 'local/office-structured',
            dimensionMismatch: true,
            providerId: 'ollama-main',
            modelId: 'local/office-structured',
            modelBackendKind: 'openai_chat',
            modelEmbeddingDimensions: 1536,
            routeIndex: 0,
            fallbackOrderIndex: 0,
            protocol: 'openai_chat',
            requestLayer: 'chat_completions',
            requestedDimensions: 1024,
            providerConfiguredModelCount: 2,
            providerConfiguredModelIds: [
              'local/office-structured',
              'office-structured',
            ],
            providerHealth: 'healthy',
            providerHealthCheckedAt: '2026-06-16T09:30:00.000Z',
            providerName: 'Local Ollama',
            providerPrivacy: 'local',
            providerPriority: 10,
            providerProfileConfigPath:
              'copilot.providers.profiles[id=ollama-main]',
            providerProfileId: 'ollama-main',
            providerProfileSource: 'configured',
            providerSource: 'configured',
            providerType: 'openaiCompatible',
            routeModelAliasMatched: true,
            routeModelDefinitionAliases: ['office-structured'],
            routeModelDefinitionId: 'local/office-structured',
            routeModelDefinitionSource: 'provider_profile',
            routeRawModelId: 'qwen3:32b',
          },
        ],
      },
    ],
  });
});

test('resolver action run prepared route trace should return null outside current workspace scope', async t => {
  const { models, module, workspace } = t.context;
  const resolver = module.get(CopilotResolver);
  const ws = await workspace.create(userId);
  const otherWs = await workspace.create(userId);
  const run = await models.copilotActionRun.create({
    userId,
    workspaceId: otherWs.id,
    actionId: 'image.filter.sketch',
    actionVersion: 'v1',
  });

  await models.copilotActionRun.complete(run.id, {
    status: 'succeeded',
    trace: {
      type: 'prepared_routes',
      status: 'succeeded',
      steps: [
        {
          stepId: 'generate-image',
          kind: 'image',
          fallbackProviderIds: ['openai-default'],
          routes: [{ providerId: 'openai-default', modelId: 'gpt-image-1' }],
        },
      ],
    },
  });

  t.is(
    await resolver.actionRunPreparedRouteTrace(
      { id: userId } as any,
      { workspaceId: ws.id },
      run.id
    ),
    null
  );
});

test('resolver action runs should expose recent sanitized workspace scoped diagnostics', async t => {
  const { models, module, workspace } = t.context;
  const resolver = module.get(CopilotResolver);
  const ws = await workspace.create(userId);
  const otherWs = await workspace.create(userId);
  const run = await models.copilotActionRun.create({
    userId,
    workspaceId: ws.id,
    docId: 'doc-1',
    actionId: 'mindmap.generate',
    actionVersion: 'v1',
  });
  await models.copilotActionRun.complete(run.id, {
    status: 'succeeded',
    result: { secret: 'should-not-be-returned' },
    artifacts: [{ id: 'artifact-1' }],
    trace: {
      native: {
        lightweight: [
          { type: 'action_trace', prompt: 'should-not-be-returned' },
          { type: 'tool:dispatch', payload: { token: 'secret-token' } },
          { type: 'unsafe event name with spaces' },
        ],
        messages: [{ role: 'user', content: 'secret prompt' }],
      },
      preparedRoutes: {
        type: 'prepared_routes',
        status: 'succeeded',
        steps: [
          {
            stepId: 'generate',
            kind: 'structured',
            routeCount: 1,
            requestedModelId: 'local/office-structured',
            requestedModelSource: 'prompt_preference',
            fallbackProviderIds: ['ollama-main'],
            routes: [
              {
                behaviorFlags: ['tool_calls'],
                canonicalModelKey: 'local/office-structured',
                dimensionMismatch: false,
                providerId: 'ollama-main',
                modelId: 'local/office-structured',
                modelBackendKind: 'openai_chat',
                modelEmbeddingDimensions: 1024,
                routeIndex: 0,
                fallbackOrderIndex: 0,
                protocol: 'openai_chat',
                requestedDimensions: 1024,
                requestLayer: 'chat_completions',
                backendConfig: {
                  authToken: 'should-not-be-returned',
                },
              },
            ],
          },
        ],
      },
    },
  });
  const failedRun = await models.copilotActionRun.create({
    userId,
    workspaceId: ws.id,
    actionId: 'image.filter.sketch',
    actionVersion: 'v1',
    retryOf: run.id,
  });
  await models.copilotActionRun.complete(failedRun.id, {
    status: 'failed',
    errorCode: 'action_bridge_stream_error',
    trace: { type: 'error', status: 'failed' },
  });
  await models.copilotActionRun.create({
    userId,
    workspaceId: otherWs.id,
    actionId: 'other.workspace',
    actionVersion: 'v1',
  });

  const diagnostics = await resolver.actionRuns(
    { id: userId } as any,
    { workspaceId: ws.id },
    8
  );

  t.is(diagnostics.length, 2);
  t.deepEqual(
    diagnostics
      .map(item => item.id)
      .sort((left, right) => left.localeCompare(right)),
    [run.id, failedRun.id].sort((left, right) => left.localeCompare(right))
  );
  const successfulDiagnostics = diagnostics.find(item => item.id === run.id);
  const failedDiagnostics = diagnostics.find(item => item.id === failedRun.id);
  const runTimelineRouteEvidenceFingerprint =
    actionRunTimelineRouteEvidenceFingerprintFixture({
      actualRouteCount: 1,
      eventType: 'run_status',
      fallbackProviderIds: ['ollama-main'],
      kind: null,
      routeBehaviorFlags: ['tool_calls'],
      routeCanonicalModelKeys: ['local/office-structured'],
      routeCount: 1,
      routeCountMismatch: false,
      routeDimensionEvidence: [
        'requested 1024d / model 1024d / dimension mismatch no',
      ],
      routeModelBackendKinds: ['openai_chat'],
      routeTargets: ['ollama-main/local/office-structured'],
      stepId: null,
    });
  const generateTimelineRouteEvidenceFingerprint =
    actionRunTimelineRouteEvidenceFingerprintFixture({
      actualRouteCount: 1,
      eventType: 'model_step',
      fallbackProviderIds: ['ollama-main'],
      kind: 'structured',
      routeBehaviorFlags: ['tool_calls'],
      routeCanonicalModelKeys: ['local/office-structured'],
      routeCount: 1,
      routeCountMismatch: false,
      routeDimensionEvidence: [
        'requested 1024d / model 1024d / dimension mismatch no',
      ],
      routeModelBackendKinds: ['openai_chat'],
      routeTargets: ['ollama-main/local/office-structured'],
      stepId: 'generate',
    });
  const failedTimelineRouteEvidenceFingerprint =
    actionRunTimelineRouteEvidenceFingerprintFixture({
      actualRouteCount: 0,
      eventType: 'run_status',
      fallbackProviderIds: [],
      kind: null,
      routeBehaviorFlags: [],
      routeCanonicalModelKeys: [],
      routeCount: 0,
      routeCountMismatch: false,
      routeDimensionEvidence: [],
      routeModelBackendKinds: [],
      routeTargets: [],
      stepId: null,
    });
  t.like(successfulDiagnostics, {
    actionId: 'mindmap.generate',
    actionVersion: 'v1',
    agentRuntimeNativeTraceEventTypes: ['action_trace', 'tool:dispatch'],
    agentRuntimeProjectedSchemaComponents: [
      'typescript_projection_contract',
      'graphql_string_diagnostics_fields',
      'graphql_structured_timeline_items',
    ],
    agentRuntimeProjectedRunStatuses: [
      'queued',
      'running',
      'completed',
      'failed',
      'cancelled',
    ],
    agentRuntimeProjectedStepStatuses: [
      'pending',
      'running',
      'completed',
      'failed',
      'skipped',
    ],
    agentRuntimeProjectedStepTypes: ['model'],
    agentRuntimeProjectedTimelineEventTypes: ['run_status', 'model_step'],
    agentRuntimeProjectionSource: 'ai_action_run_agent_runtime_projection/v1',
    agentRuntimeProjectionGaps: [
      'tool -> not_projected',
      'approval -> not_projected',
      'handoff -> not_projected',
      'codex -> not_projected',
      'mcp -> not_projected',
    ],
    agentRuntimeRunStatusGaps: [
      'waiting_approval -> not_projected',
      'retrying -> not_projected',
      'rollback_running -> not_projected',
      'archived -> not_projected',
    ],
    agentRuntimeRunId: run.id,
    agentRuntimeRunStatus: 'completed',
    agentRuntimeSchemaReadiness: 'projection_contract_only',
    agentRuntimeSchemaReadinessGaps: [
      'db_agent_run_table -> not_persisted',
      'db_agent_step_table -> not_persisted',
      'graphql_run_status_enum -> string_field',
      'graphql_step_status_enum -> string_field',
      'graphql_step_type_enum -> string_field',
      'schema_migration -> not_created',
      'registry_source_of_truth -> not_created',
    ],
    agentRuntimeStepCount: 1,
    agentRuntimeStepStatusGaps: [
      'waiting_approval -> not_projected',
      'retrying -> not_projected',
      'rollback_running -> not_projected',
      'blocked -> not_projected',
    ],
    agentRuntimeStepIds: ['generate'],
    agentRuntimeStepKinds: ['generate -> structured'],
    agentRuntimeStepStatuses: ['generate -> completed'],
    agentRuntimeStepTypes: ['generate -> model'],
    agentRuntimeTimelineEntries: [
      'run -> completed',
      'generate -> model_step -> completed -> structured -> 1/1',
    ],
    agentRuntimeTimelineEventTypes: ['run_status', 'model_step'],
    agentRuntimeTimelineGaps: [
      'tool_step -> not_projected',
      'approval_step -> not_projected',
      'handoff_step -> not_projected',
      'codex_step -> not_projected',
      'mcp_step -> not_projected',
      'step_output -> not_projected',
      'step_error -> not_projected',
      'retry_attempt -> not_projected',
      'rollback_state -> not_projected',
      'run_cancellation -> not_projected',
    ],
    agentRuntimeTimelineItems: [
      {
        id: `${run.id}:run_status`,
        eventKey: 'run_status',
        sequence: 0,
        eventType: 'run_status',
        label: 'run -> completed',
        runId: run.id,
        stepId: null,
        stepType: null,
        status: 'completed',
        kind: null,
        routeCount: 1,
        actualRouteCount: 1,
        routeCountMismatch: false,
        routeTargets: ['ollama-main/local/office-structured'],
        fallbackProviderIds: ['ollama-main'],
        routeModelBackendKinds: ['openai_chat'],
        routeCanonicalModelKeys: ['local/office-structured'],
        routeBehaviorFlags: ['tool_calls'],
        routeDimensionEvidence: [
          'requested 1024d / model 1024d / dimension mismatch no',
        ],
        routeEvidenceFingerprint: runTimelineRouteEvidenceFingerprint,
      },
      {
        id: `${run.id}:0:generate:model_step`,
        eventKey: 'model_step:generate',
        sequence: 1,
        eventType: 'model_step',
        label: 'generate -> model_step -> completed -> structured -> 1/1',
        runId: run.id,
        stepId: 'generate',
        stepType: 'model',
        status: 'completed',
        kind: 'structured',
        routeCount: 1,
        actualRouteCount: 1,
        routeCountMismatch: false,
        routeTargets: ['ollama-main/local/office-structured'],
        fallbackProviderIds: ['ollama-main'],
        routeModelBackendKinds: ['openai_chat'],
        routeCanonicalModelKeys: ['local/office-structured'],
        routeBehaviorFlags: ['tool_calls'],
        routeDimensionEvidence: [
          'requested 1024d / model 1024d / dimension mismatch no',
        ],
        routeEvidenceFingerprint: generateTimelineRouteEvidenceFingerprint,
      },
    ],
    agentRuntimeTimelineRouteEvidenceSetFingerprint:
      actionRunTimelineRouteEvidenceSetFingerprintFixture([
        runTimelineRouteEvidenceFingerprint,
        generateTimelineRouteEvidenceFingerprint,
      ]),
    agentRuntimeTargetRunStatuses: [
      'queued',
      'running',
      'waiting_approval',
      'completed',
      'failed',
      'cancelled',
      'retrying',
      'rollback_running',
      'archived',
    ],
    agentRuntimeTargetSchemaComponents: [
      'db_agent_run_table',
      'db_agent_step_table',
      'graphql_run_status_enum',
      'graphql_step_status_enum',
      'graphql_step_type_enum',
      'schema_migration',
      'registry_source_of_truth',
    ],
    agentRuntimeTargetStepStatuses: [
      'pending',
      'running',
      'waiting_approval',
      'completed',
      'failed',
      'skipped',
      'retrying',
      'rollback_running',
      'blocked',
    ],
    agentRuntimeTargetStepTypes: [
      'model',
      'tool',
      'approval',
      'handoff',
      'codex',
      'mcp',
    ],
    agentRuntimeTargetTimelineEventTypes: [
      'run_status',
      'model_step',
      'tool_step',
      'approval_step',
      'handoff_step',
      'codex_step',
      'mcp_step',
      'step_output',
      'step_error',
      'retry_attempt',
      'rollback_state',
      'run_cancellation',
    ],
    agentRuntimeUnsupportedRunStatuses: [
      'waiting_approval',
      'retrying',
      'rollback_running',
      'archived',
    ],
    agentRuntimeUnsupportedStepStatuses: [
      'waiting_approval',
      'retrying',
      'rollback_running',
      'blocked',
    ],
    agentRuntimeUnsupportedStepTypes: [
      'tool',
      'approval',
      'handoff',
      'codex',
      'mcp',
    ],
    agentRuntimeUnsupportedTimelineEventTypes: [
      'tool_step',
      'approval_step',
      'handoff_step',
      'codex_step',
      'mcp_step',
      'step_output',
      'step_error',
      'retry_attempt',
      'rollback_state',
      'run_cancellation',
    ],
    status: 'succeeded',
    attempt: 1,
    retryOf: null,
    docId: 'doc-1',
    sessionId: null,
    errorCode: null,
    hasPreparedRouteTrace: true,
    preparedRouteStepCount: 1,
    preparedRouteCount: 1,
    preparedRouteActualCount: 1,
    preparedRouteStepRouteCounts: ['generate -> 1/1'],
    preparedRouteStepRouteCountMismatches: [],
    preparedRouteStepIds: ['generate'],
    preparedRouteKinds: ['structured'],
    preparedRouteModelIds: ['local/office-structured'],
    preparedRouteProtocols: ['openai_chat'],
    preparedRouteModelBackendKinds: ['openai_chat'],
    preparedRouteCanonicalModelKeys: ['local/office-structured'],
    preparedRouteBehaviorFlags: ['tool_calls'],
    preparedRouteDimensionEvidence: [
      'requested 1024d / model 1024d / dimension mismatch no',
    ],
    preparedRouteOrder: ['0 -> ollama-main/local/office-structured'],
    preparedRouteFallbackOrder: ['0 -> ollama-main/local/office-structured'],
    preparedRouteStepFallbackProviderIds: ['generate -> ollama-main'],
    preparedRouteProviderIds: ['ollama-main'],
    preparedRouteRequestedModelIds: ['local/office-structured'],
    preparedRouteRequestedModelSources: ['prompt_preference'],
    preparedRouteStepRequestedModelSources: ['generate -> prompt_preference'],
    preparedRouteRequestLayers: ['chat_completions'],
    preparedRouteStepProtocols: ['generate -> openai_chat'],
    preparedRouteStepModelBackendKinds: ['generate -> openai_chat'],
    preparedRouteStepCanonicalModelKeys: [
      'generate -> local/office-structured',
    ],
    preparedRouteStepBehaviorFlags: ['generate -> tool_calls'],
    preparedRouteStepDimensionEvidence: [
      'generate -> requested 1024d / model 1024d / dimension mismatch no',
    ],
    preparedRouteStepRequestLayers: ['generate -> chat_completions'],
    preparedRouteStepOrder: [
      'generate / 0 -> ollama-main/local/office-structured',
    ],
    preparedRouteStepFallbackOrder: [
      'generate / 0 -> ollama-main/local/office-structured',
    ],
    preparedRouteFallbackProviderIds: ['ollama-main'],
    preparedRouteTargets: ['ollama-main/local/office-structured'],
    preparedRouteStepTargets: [
      'generate -> ollama-main/local/office-structured',
    ],
    preparedRouteRequestedTargets: [
      'local/office-structured -> ollama-main/local/office-structured',
    ],
    preparedRouteStepRequestedTargets: [
      'generate / local/office-structured -> ollama-main/local/office-structured',
    ],
  });
  t.like(failedDiagnostics, {
    actionId: 'image.filter.sketch',
    agentRuntimeNativeTraceEventTypes: [],
    agentRuntimeProjectedSchemaComponents: [
      'typescript_projection_contract',
      'graphql_string_diagnostics_fields',
      'graphql_structured_timeline_items',
    ],
    agentRuntimeProjectedRunStatuses: [
      'queued',
      'running',
      'completed',
      'failed',
      'cancelled',
    ],
    agentRuntimeProjectedStepStatuses: [
      'pending',
      'running',
      'completed',
      'failed',
      'skipped',
    ],
    agentRuntimeProjectedStepTypes: ['model'],
    agentRuntimeProjectedTimelineEventTypes: ['run_status', 'model_step'],
    agentRuntimeProjectionSource: 'ai_action_run_agent_runtime_projection/v1',
    agentRuntimeProjectionGaps: [
      'model -> no_prepared_route_trace',
      'tool -> not_projected',
      'approval -> not_projected',
      'handoff -> not_projected',
      'codex -> not_projected',
      'mcp -> not_projected',
    ],
    agentRuntimeRunStatusGaps: [
      'waiting_approval -> not_projected',
      'retrying -> not_projected',
      'rollback_running -> not_projected',
      'archived -> not_projected',
    ],
    agentRuntimeRunId: failedRun.id,
    agentRuntimeRunStatus: 'failed',
    agentRuntimeSchemaReadiness: 'projection_contract_only',
    agentRuntimeSchemaReadinessGaps: [
      'db_agent_run_table -> not_persisted',
      'db_agent_step_table -> not_persisted',
      'graphql_run_status_enum -> string_field',
      'graphql_step_status_enum -> string_field',
      'graphql_step_type_enum -> string_field',
      'schema_migration -> not_created',
      'registry_source_of_truth -> not_created',
    ],
    agentRuntimeStepCount: 0,
    agentRuntimeStepStatusGaps: [
      'waiting_approval -> not_projected',
      'retrying -> not_projected',
      'rollback_running -> not_projected',
      'blocked -> not_projected',
    ],
    agentRuntimeStepIds: [],
    agentRuntimeStepKinds: [],
    agentRuntimeStepStatuses: [],
    agentRuntimeStepTypes: [],
    agentRuntimeTimelineEntries: ['run -> failed'],
    agentRuntimeTimelineEventTypes: ['run_status'],
    agentRuntimeTimelineGaps: [
      'model_step -> no_prepared_route_trace',
      'tool_step -> not_projected',
      'approval_step -> not_projected',
      'handoff_step -> not_projected',
      'codex_step -> not_projected',
      'mcp_step -> not_projected',
      'step_output -> not_projected',
      'step_error -> not_projected',
      'retry_attempt -> not_projected',
      'rollback_state -> not_projected',
      'run_cancellation -> not_projected',
    ],
    agentRuntimeTimelineItems: [
      {
        id: `${failedRun.id}:run_status`,
        eventKey: 'run_status',
        sequence: 0,
        eventType: 'run_status',
        label: 'run -> failed',
        runId: failedRun.id,
        stepId: null,
        stepType: null,
        status: 'failed',
        kind: null,
        routeCount: 0,
        actualRouteCount: 0,
        routeCountMismatch: false,
        routeTargets: [],
        fallbackProviderIds: [],
        routeModelBackendKinds: [],
        routeCanonicalModelKeys: [],
        routeBehaviorFlags: [],
        routeDimensionEvidence: [],
        routeEvidenceFingerprint: failedTimelineRouteEvidenceFingerprint,
      },
    ],
    agentRuntimeTimelineRouteEvidenceSetFingerprint:
      actionRunTimelineRouteEvidenceSetFingerprintFixture([
        failedTimelineRouteEvidenceFingerprint,
      ]),
    agentRuntimeTargetRunStatuses: [
      'queued',
      'running',
      'waiting_approval',
      'completed',
      'failed',
      'cancelled',
      'retrying',
      'rollback_running',
      'archived',
    ],
    agentRuntimeTargetSchemaComponents: [
      'db_agent_run_table',
      'db_agent_step_table',
      'graphql_run_status_enum',
      'graphql_step_status_enum',
      'graphql_step_type_enum',
      'schema_migration',
      'registry_source_of_truth',
    ],
    agentRuntimeTargetStepStatuses: [
      'pending',
      'running',
      'waiting_approval',
      'completed',
      'failed',
      'skipped',
      'retrying',
      'rollback_running',
      'blocked',
    ],
    agentRuntimeTargetStepTypes: [
      'model',
      'tool',
      'approval',
      'handoff',
      'codex',
      'mcp',
    ],
    agentRuntimeTargetTimelineEventTypes: [
      'run_status',
      'model_step',
      'tool_step',
      'approval_step',
      'handoff_step',
      'codex_step',
      'mcp_step',
      'step_output',
      'step_error',
      'retry_attempt',
      'rollback_state',
      'run_cancellation',
    ],
    agentRuntimeUnsupportedRunStatuses: [
      'waiting_approval',
      'retrying',
      'rollback_running',
      'archived',
    ],
    agentRuntimeUnsupportedStepStatuses: [
      'waiting_approval',
      'retrying',
      'rollback_running',
      'blocked',
    ],
    agentRuntimeUnsupportedStepTypes: [
      'tool',
      'approval',
      'handoff',
      'codex',
      'mcp',
    ],
    agentRuntimeUnsupportedTimelineEventTypes: [
      'tool_step',
      'approval_step',
      'handoff_step',
      'codex_step',
      'mcp_step',
      'step_output',
      'step_error',
      'retry_attempt',
      'rollback_state',
      'run_cancellation',
    ],
    status: 'failed',
    retryOf: run.id,
    errorCode: 'action_bridge_stream_error',
    hasPreparedRouteTrace: false,
    preparedRouteStepCount: 0,
    preparedRouteCount: 0,
    preparedRouteActualCount: 0,
    preparedRouteStepRouteCounts: [],
    preparedRouteStepRouteCountMismatches: [],
    preparedRouteStepIds: [],
    preparedRouteKinds: [],
    preparedRouteModelIds: [],
    preparedRouteOrder: [],
    preparedRouteFallbackOrder: [],
    preparedRouteStepFallbackProviderIds: [],
    preparedRouteProtocols: [],
    preparedRouteProviderIds: [],
    preparedRouteRequestedModelIds: [],
    preparedRouteRequestedModelSources: [],
    preparedRouteStepRequestedModelSources: [],
    preparedRouteRequestLayers: [],
    preparedRouteStepProtocols: [],
    preparedRouteStepOrder: [],
    preparedRouteStepFallbackOrder: [],
    preparedRouteStepRequestLayers: [],
    preparedRouteFallbackProviderIds: [],
    preparedRouteTargets: [],
    preparedRouteStepTargets: [],
    preparedRouteRequestedTargets: [],
    preparedRouteStepRequestedTargets: [],
  });
  t.false('trace' in diagnostics[0]);
  t.is(
    successfulDiagnostics?.agentRuntimeProjectionContractFingerprint,
    successfulDiagnostics
      ? actionRunAgentRuntimeProjectionContractFingerprintFromDiagnosticsFixture(
          successfulDiagnostics
        )
      : undefined
  );
  t.is(
    failedDiagnostics?.agentRuntimeProjectionContractFingerprint,
    failedDiagnostics
      ? actionRunAgentRuntimeProjectionContractFingerprintFromDiagnosticsFixture(
          failedDiagnostics
        )
      : undefined
  );
  t.is(
    successfulDiagnostics?.agentRuntimeDiagnosticsFingerprint,
    successfulDiagnostics
      ? actionRunAgentRuntimeDiagnosticsFingerprintFromDiagnosticsFixture(
          successfulDiagnostics
        )
      : undefined
  );
  t.is(
    failedDiagnostics?.agentRuntimeDiagnosticsFingerprint,
    failedDiagnostics
      ? actionRunAgentRuntimeDiagnosticsFingerprintFromDiagnosticsFixture(
          failedDiagnostics
        )
      : undefined
  );
  t.truthy(successfulDiagnostics);
  t.truthy(failedDiagnostics);
  t.like(successfulDiagnostics!.agentRuntimeDiagnosticsManifest, {
    version: 'agent-runtime-diagnostics-manifest/v1',
    fingerprint: successfulDiagnostics!.agentRuntimeDiagnosticsFingerprint,
    actionId: successfulDiagnostics!.actionId,
    actionVersion: successfulDiagnostics!.actionVersion,
    runStatus: successfulDiagnostics!.agentRuntimeRunStatus,
    projectionContractFingerprint:
      successfulDiagnostics!.agentRuntimeProjectionContractFingerprint,
    timelineRouteEvidenceSetFingerprint:
      successfulDiagnostics!.agentRuntimeTimelineRouteEvidenceSetFingerprint,
    projectionSource: successfulDiagnostics!.agentRuntimeProjectionSource,
    schemaReadiness: successfulDiagnostics!.agentRuntimeSchemaReadiness,
    nativeTraceEventTypes:
      successfulDiagnostics!.agentRuntimeNativeTraceEventTypes,
    timelineEventTypes: successfulDiagnostics!.agentRuntimeTimelineEventTypes,
    hasPreparedRouteTrace: true,
    preparedRouteStepCount: 1,
    preparedRouteCount: 1,
    preparedRouteActualCount: 1,
    timelineItemCount: successfulDiagnostics!.agentRuntimeTimelineItems.length,
    projectionGapCount:
      successfulDiagnostics!.agentRuntimeProjectionGaps.length,
    timelineGapCount: successfulDiagnostics!.agentRuntimeTimelineGaps.length,
    schemaReadinessGapCount:
      successfulDiagnostics!.agentRuntimeSchemaReadinessGaps.length,
  });
  t.like(successfulDiagnostics!.agentRuntimeDiagnosticsManifestExportMetadata, {
    version: 'action-run-diagnostics-manifest-export-metadata/v1',
    artifact: 'action_run_diagnostics_manifest_json',
    filename: `action-run-diagnostics-manifest-${successfulDiagnostics!.id}.json`,
    mime: 'application/json;charset=utf-8',
    metadataFilename: `action-run-diagnostics-manifest-metadata-${successfulDiagnostics!.id}.json`,
    manifestVersion:
      successfulDiagnostics!.agentRuntimeDiagnosticsManifest.version,
    manifestFingerprint:
      successfulDiagnostics!.agentRuntimeDiagnosticsManifest.fingerprint,
    actionId: successfulDiagnostics!.actionId,
    actionVersion: successfulDiagnostics!.actionVersion,
    runId: successfulDiagnostics!.id,
    runStatus: successfulDiagnostics!.agentRuntimeRunStatus,
    projectionSource: successfulDiagnostics!.agentRuntimeProjectionSource,
    schemaReadiness: successfulDiagnostics!.agentRuntimeSchemaReadiness,
    boundary: 'manifest_only_no_raw_trace_or_provider_payload',
    exportPolicyVersion: 'action-run-diagnostics-manifest-export-policy/v1',
    exportPolicyStatus: 'read_only_projection',
    auditEventVersion: 'action-run-diagnostics-manifest-export-audit-event/v1',
    auditEventStatus: 'not_created_read_only',
    auditEventCreated: false,
    retentionPolicyVersion:
      'action-run-diagnostics-manifest-retention-policy/v1',
    retentionPolicyStatus: 'not_persisted_read_only',
  });
  t.regex(
    successfulDiagnostics!.agentRuntimeDiagnosticsManifestExportMetadata
      .exportPolicyFingerprint,
    /^[a-f0-9]{16}$/
  );
  t.regex(
    successfulDiagnostics!.agentRuntimeDiagnosticsManifestExportMetadata
      .auditEventFingerprint,
    /^[a-f0-9]{16}$/
  );
  t.regex(
    successfulDiagnostics!.agentRuntimeDiagnosticsManifestExportMetadata
      .retentionPolicyFingerprint,
    /^[a-f0-9]{16}$/
  );
  t.like(failedDiagnostics!.agentRuntimeDiagnosticsManifest, {
    version: 'agent-runtime-diagnostics-manifest/v1',
    fingerprint: failedDiagnostics!.agentRuntimeDiagnosticsFingerprint,
    actionId: failedDiagnostics!.actionId,
    actionVersion: failedDiagnostics!.actionVersion,
    runStatus: failedDiagnostics!.agentRuntimeRunStatus,
    projectionContractFingerprint:
      failedDiagnostics!.agentRuntimeProjectionContractFingerprint,
    timelineRouteEvidenceSetFingerprint:
      failedDiagnostics!.agentRuntimeTimelineRouteEvidenceSetFingerprint,
    projectionSource: failedDiagnostics!.agentRuntimeProjectionSource,
    schemaReadiness: failedDiagnostics!.agentRuntimeSchemaReadiness,
    nativeTraceEventTypes: failedDiagnostics!.agentRuntimeNativeTraceEventTypes,
    timelineEventTypes: failedDiagnostics!.agentRuntimeTimelineEventTypes,
    hasPreparedRouteTrace: false,
    preparedRouteStepCount: 0,
    preparedRouteCount: 0,
    preparedRouteActualCount: 0,
    timelineItemCount: failedDiagnostics!.agentRuntimeTimelineItems.length,
    projectionGapCount: failedDiagnostics!.agentRuntimeProjectionGaps.length,
    timelineGapCount: failedDiagnostics!.agentRuntimeTimelineGaps.length,
    schemaReadinessGapCount:
      failedDiagnostics!.agentRuntimeSchemaReadinessGaps.length,
  });
  t.like(failedDiagnostics!.agentRuntimeDiagnosticsManifestExportMetadata, {
    version: 'action-run-diagnostics-manifest-export-metadata/v1',
    artifact: 'action_run_diagnostics_manifest_json',
    filename: `action-run-diagnostics-manifest-${failedDiagnostics!.id}.json`,
    mime: 'application/json;charset=utf-8',
    metadataFilename: `action-run-diagnostics-manifest-metadata-${failedDiagnostics!.id}.json`,
    manifestVersion: failedDiagnostics!.agentRuntimeDiagnosticsManifest.version,
    manifestFingerprint:
      failedDiagnostics!.agentRuntimeDiagnosticsManifest.fingerprint,
    actionId: failedDiagnostics!.actionId,
    actionVersion: failedDiagnostics!.actionVersion,
    runId: failedDiagnostics!.id,
    runStatus: failedDiagnostics!.agentRuntimeRunStatus,
    projectionSource: failedDiagnostics!.agentRuntimeProjectionSource,
    schemaReadiness: failedDiagnostics!.agentRuntimeSchemaReadiness,
    boundary: 'manifest_only_no_raw_trace_or_provider_payload',
    exportPolicyVersion: 'action-run-diagnostics-manifest-export-policy/v1',
    exportPolicyStatus: 'read_only_projection',
    auditEventVersion: 'action-run-diagnostics-manifest-export-audit-event/v1',
    auditEventStatus: 'not_created_read_only',
    auditEventCreated: false,
    retentionPolicyVersion:
      'action-run-diagnostics-manifest-retention-policy/v1',
    retentionPolicyStatus: 'not_persisted_read_only',
  });
  t.regex(
    failedDiagnostics!.agentRuntimeDiagnosticsManifestExportMetadata
      .exportPolicyFingerprint,
    /^[a-f0-9]{16}$/
  );
  t.regex(
    failedDiagnostics!.agentRuntimeDiagnosticsManifestExportMetadata
      .auditEventFingerprint,
    /^[a-f0-9]{16}$/
  );
  t.regex(
    failedDiagnostics!.agentRuntimeDiagnosticsManifestExportMetadata
      .retentionPolicyFingerprint,
    /^[a-f0-9]{16}$/
  );
  t.false('inputSnapshot' in diagnostics[0]);
  t.false('result' in diagnostics[0]);
  t.false('artifacts' in diagnostics[0]);
  const diagnosticsJson = JSON.stringify(diagnostics);
  t.false(diagnosticsJson.includes('secret prompt'));
  t.false(diagnosticsJson.includes('secret-token'));
  t.false(diagnosticsJson.includes('unsafe event name with spaces'));
});

test('resolver models should expose configured model limits metadata', async t => {
  const { prompt, factory, module } = t.context;
  const resolver = module.get(CopilotResolver);

  const promptName = randomUUID().replaceAll('-', '');
  await prompt.set(
    promptName,
    'ollama-main/office-chat-fast',
    [{ role: 'system', content: 'test' }],
    undefined,
    { optionalModels: ['ollama-main/office-chat-fast'] }
  );

  Sinon.stub(factory, 'getEffectiveModelSelectionScope').resolves({
    providerIds: [],
    configuredModelIds: [],
  });
  Sinon.stub(factory, 'resolveModelId').callsFake(async cond => cond.modelId);
  Sinon.stub(factory, 'describeRoutePolicy').returns({
    enabled: true,
    featureKind: 'chat',
    preferredPrivacy: ['local', 'private_cloud', 'cloud'],
  });
  Sinon.stub(factory, 'resolveProvider').callsFake(async cond => {
    if (cond.modelId !== 'ollama-main/office-chat-fast') {
      return null;
    }
    return {
      providerId: 'ollama-main',
      rawModelId: cond.modelId,
      modelId: 'office-chat-fast',
      fallbackProviderIds: ['ollama-main', 'openai-default'],
      profile: {
        id: 'ollama-main',
        displayName: 'Local Ollama',
        type: CopilotProviderType.OpenAICompatible,
        enabled: true,
        priority: 10,
        privacy: 'local',
        health: { status: 'healthy' },
        config: {},
        middleware: {},
      },
      provider: {
        resolveModel: (modelId: string) => ({
          id: 'qwen3:32b',
          name: `Resolved ${modelId}`,
          backendKind: 'openai_chat',
          canonicalKey: 'office-chat-fast',
          protocol: 'openai_chat',
          requestLayer: 'chat_completions',
          behaviorFlags: ['disable_parallel_tool_calls'],
          capabilities: [
            {
              input: [ModelInputType.Text],
              output: [ModelOutputType.Text],
            },
            {
              input: [ModelInputType.Text, ModelInputType.Image],
              output: [ModelOutputType.Structured],
            },
          ],
          limits: {
            contextWindow: 32768,
            maxOutputTokens: 4096,
            embeddingDimensions: 1024,
          },
          cost: {
            inputPer1M: 0.2,
            outputPer1M: 0.8,
          },
        }),
      },
    } as any;
  });

  const models = await resolver.models(promptName);

  t.is(models.defaultModel, 'ollama-main/office-chat-fast');
  t.is(models.promptDefaultModel, 'ollama-main/office-chat-fast');
  t.is(models.defaultModelSource, 'prompt');
  t.is(models.defaultModelFallbackReason, undefined);
  for (const model of models.optionalModels) {
    t.regex(model.effectiveSourceFingerprint ?? '', /^[a-f0-9]{16}$/);
    t.is(
      model.effectiveSourceFingerprintVersion,
      'copilot-model-list-effective-source/v1'
    );
    t.true(
      model.effectiveSourceFingerprintInputs?.includes(
        'routeModelDefinitionSource'
      )
    );
    t.true(model.effectiveSourceFingerprintInputs?.includes('routeRawModelId'));
  }
  t.deepEqual(normalizeModelListForAssertion(models.optionalModels), [
    {
      id: 'ollama-main/office-chat-fast',
      name: 'Resolved office-chat-fast',
      sources: ['default', 'prompt'],
      promptName,
      promptSource: 'compat',
      promptCategory: 'text',
      promptModelSource: 'compat',
      promptModelSources: [
        {
          candidateSource: 'default',
          modelSource: 'compat',
        },
        {
          candidateSource: 'prompt',
          modelSource: 'compat',
        },
      ],
      promptOverrideApplied: false,
      providerId: 'ollama-main',
      providerName: 'Local Ollama',
      providerProfileId: 'ollama-main',
      routeModelId: 'qwen3:32b',
      routeFallbackProviderIds: ['ollama-main', 'openai-default'],
      routeBackendKind: 'openai_chat',
      routeCanonicalModelKey: 'office-chat-fast',
      routeModelDefinitionId: 'office-chat-fast',
      routeModelDefinitionSource: 'native_registry',
      routeProtocol: 'openai_chat',
      routeRawModelId: 'qwen3:32b',
      routeRequestLayer: 'chat_completions',
      routeBehaviorFlags: ['disable_parallel_tool_calls'],
      routeInputTypes: [ModelInputType.Text, ModelInputType.Image],
      routeOutputTypes: [ModelOutputType.Text, ModelOutputType.Structured],
      providerType: CopilotProviderType.OpenAICompatible,
      providerPrivacy: 'local',
      providerHealth: 'healthy',
      providerPriority: 10,
      routePolicyEnabled: true,
      routePolicyFeatureKind: 'chat',
      routePolicyPreferredPrivacy: ['local', 'private_cloud', 'cloud'],
      contextWindow: 32768,
      maxOutputTokens: 4096,
      embeddingDimensions: 1024,
      costInputPer1M: 0.2,
      costOutputPer1M: 0.8,
    },
  ]);
});

test('resolver models should include configured provider models and fallback default', async t => {
  const { prompt, factory, module } = t.context;
  const resolver = module.get(CopilotResolver);

  const promptName = randomUUID().replaceAll('-', '');
  await prompt.set(
    promptName,
    'gemini-2.5-flash',
    [{ role: 'system', content: 'test' }],
    undefined,
    { optionalModels: ['gemini-2.5-flash'] }
  );

  Sinon.stub(factory, 'getEffectiveModelSelectionScope').resolves({
    providerIds: ['openai-default'],
    configuredModelIds: ['openai-default/gpt-5-mini'],
  });
  Sinon.stub(factory, 'describeRoutePolicy').returns({
    enabled: true,
    featureKind: 'chat',
  });
  Sinon.stub(factory, 'resolveModelId').callsFake(async cond => {
    if (cond.modelId === 'gemini-2.5-flash') {
      return undefined;
    }
    if (!cond.modelId && cond.outputType === ModelOutputType.Text) {
      return 'openai-default/gpt-5-mini';
    }
    if (cond.modelId === 'openai-default/gpt-5-mini') {
      return 'openai-default/gpt-5-mini';
    }
    return cond.modelId;
  });
  Sinon.stub(factory, 'resolveProvider').callsFake(async cond => {
    if (cond.modelId !== 'openai-default/gpt-5-mini') {
      return null;
    }
    return {
      providerId: 'openai-default',
      rawModelId: cond.modelId,
      modelId: String(cond.modelId).replace('openai-default/', ''),
      fallbackProviderIds: ['openai-default'],
      profile: {
        id: 'openai-default',
        type: CopilotProviderType.OpenAI,
        enabled: true,
        priority: 10,
        privacy: 'cloud',
        health: { status: 'healthy' },
        config: {},
        middleware: {},
      },
      provider: {
        resolveModel: (modelId: string) => ({
          id: modelId,
          name: `Resolved ${modelId}`,
        }),
      },
    } as any;
  });

  const models = await resolver.models(promptName);

  t.is(models.defaultModel, 'openai-default/gpt-5-mini');
  t.is(models.promptDefaultModel, 'gemini-2.5-flash');
  t.is(models.defaultModelSource, 'fallback_route');
  t.is(models.defaultModelFallbackReason, 'prompt_default_unavailable');
  t.deepEqual(
    models.optionalModels.map(model => ({
      id: model.id,
      promptModelSources: model.promptModelSources,
      routeModelId: model.routeModelId,
      sources: model.sources,
    })),
    [
      {
        id: 'openai-default/gpt-5-mini',
        promptModelSources: [
          {
            candidateSource: 'fallback_route',
          },
          {
            candidateSource: 'registry',
          },
        ],
        routeModelId: 'gpt-5-mini',
        sources: ['fallback_route', 'registry'],
      },
    ]
  );
});

test('resolver models should inherit workspace route policy context from copilot parent', async t => {
  const { prompt, factory, module } = t.context;
  const resolver = module.get(CopilotResolver);

  const promptName = randomUUID().replaceAll('-', '');
  await prompt.set(
    promptName,
    'ollama-main/office-chat-fast',
    [{ role: 'system', content: 'test' }],
    undefined,
    { optionalModels: ['ollama-main/office-chat-fast'] }
  );

  const getEffectiveModelSelectionScope = Sinon.stub(
    factory,
    'getEffectiveModelSelectionScope'
  ).resolves({
    providerIds: [],
    configuredModelIds: [],
  });
  const describeRoutePolicy = Sinon.stub(
    factory,
    'describeRoutePolicy'
  ).callsFake(context => {
    if (context?.featureKind === 'chat') {
      return {
        enabled: true,
        featureKind: 'chat',
        workspaceId: 'workspace-local-only',
        allowedPrivacy: ['local'],
        preferredPrivacy: ['local'],
      };
    }
    return {
      enabled: true,
      featureKind: context?.featureKind,
      workspaceId: 'workspace-local-only',
      preferredPrivacy: ['local'],
    };
  });
  Sinon.stub(factory, 'resolveModelId').callsFake(async cond => cond.modelId);
  const resolveProvider = Sinon.stub(factory, 'resolveProvider').callsFake(
    async cond =>
      ({
        providerId: 'ollama-main',
        rawModelId: cond.modelId,
        modelId: 'office-chat-fast',
        fallbackProviderIds: ['ollama-main'],
        profile: {
          id: 'ollama-main',
          displayName: 'Local Ollama',
          type: CopilotProviderType.OpenAICompatible,
          enabled: true,
          priority: 10,
          privacy: 'local',
          health: {
            status: 'healthy',
            lastCheckedAt: '2026-06-15T10:00:00.000Z',
            lastError: 'previous timeout',
          },
          config: {},
          middleware: {},
        },
        provider: {
          resolveModel: (modelId: string) => ({
            id: modelId,
            name: `Resolved ${modelId}`,
          }),
        },
      }) as any
  );

  const models = await resolver.models(promptName, {
    workspaceId: 'workspace-local-only',
  });

  t.deepEqual(models.proModels, []);
  t.true(
    describeRoutePolicy.calledWithMatch({
      featureKind: 'chat',
      workspaceId: 'workspace-local-only',
    })
  );
  Sinon.assert.calledOnceWithExactly(getEffectiveModelSelectionScope, {
    featureKind: 'chat',
    workspaceId: 'workspace-local-only',
  });
  t.true(resolveProvider.called);
  t.true(
    resolveProvider.getCalls().every(call => {
      const context = call.args[2];
      return (
        context?.featureKind === 'chat' &&
        context.workspaceId === 'workspace-local-only'
      );
    })
  );
  for (const model of models.optionalModels) {
    t.regex(model.effectiveSourceFingerprint ?? '', /^[a-f0-9]{16}$/);
    t.is(
      model.effectiveSourceFingerprintVersion,
      'copilot-model-list-effective-source/v1'
    );
    t.true(
      model.effectiveSourceFingerprintInputs?.includes('routePolicyWorkspaceId')
    );
  }
  t.deepEqual(normalizeModelListForAssertion(models.optionalModels), [
    {
      id: 'ollama-main/office-chat-fast',
      name: 'Resolved office-chat-fast',
      sources: ['default', 'prompt'],
      promptName,
      promptSource: 'compat',
      promptCategory: 'text',
      promptModelSource: 'compat',
      promptModelSources: [
        {
          candidateSource: 'default',
          modelSource: 'compat',
        },
        {
          candidateSource: 'prompt',
          modelSource: 'compat',
        },
      ],
      promptOverrideApplied: false,
      providerId: 'ollama-main',
      providerName: 'Local Ollama',
      providerProfileId: 'ollama-main',
      routeModelId: 'office-chat-fast',
      routeFallbackProviderIds: ['ollama-main'],
      providerType: CopilotProviderType.OpenAICompatible,
      providerPrivacy: 'local',
      providerHealth: 'healthy',
      providerHealthCheckedAt: '2026-06-15T10:00:00.000Z',
      providerHealthLastError: 'previous timeout',
      providerPriority: 10,
      routePolicyEnabled: true,
      routePolicyFeatureKind: 'chat',
      routePolicyWorkspaceId: 'workspace-local-only',
      routePolicyAllowedPrivacy: ['local'],
      routePolicyPreferredPrivacy: ['local'],
    },
  ]);
});

test('resolver models should expose workspace task route diagnostics', async t => {
  const { prompt, factory, module, chatRuntime, taskPolicy } = t.context;
  const resolver = module.get(CopilotResolver);

  const promptName = randomUUID().replaceAll('-', '');
  await prompt.set(
    promptName,
    'ollama-main/office-chat-fast',
    [{ role: 'system', content: 'test' }],
    undefined,
    { optionalModels: ['ollama-main/office-chat-fast'] }
  );

  Sinon.stub(factory, 'getEffectiveModelSelectionScope').resolves({
    providerIds: [],
    configuredModelIds: [],
  });
  Sinon.stub(factory, 'describeRoutePolicy').callsFake(context => {
    if (context?.featureKind === 'workspace_indexing') {
      return {
        enabled: true,
        featureKind: 'workspace_indexing',
        workspaceId: 'workspace-local-only',
        allowedProviderIds: ['ollama-main', 'openai-default'],
        blockedProviderIds: ['blocked-cloud'],
        allowedPrivacy: ['local', 'private_cloud'],
        preferredPrivacy: ['local', 'private_cloud'],
      };
    }
    if (context?.featureKind === 'rerank') {
      return {
        enabled: true,
        featureKind: 'rerank',
        workspaceId: 'workspace-local-only',
        allowedProviderIds: ['ollama-main'],
        blockedProviderIds: ['blocked-cloud'],
        allowedPrivacy: ['local'],
        preferredPrivacy: ['local'],
      };
    }
    return {
      enabled: true,
      featureKind: 'chat',
    };
  });
  Sinon.stub(factory, 'describeEffectiveRoutePolicyCandidates').callsFake(
    async context => {
      if (context?.featureKind === 'workspace_indexing') {
        return [
          {
            providerId: 'ollama-main',
            providerSource: 'configured',
            providerType: CopilotProviderType.OpenAICompatible,
            providerPriority: 10,
            privacy: 'local',
            health: 'healthy',
            available: true,
            allowed: true,
            registryKind: 'byok',
            registryAvailable: true,
            registrySelected: true,
            reasons: [
              'candidate_allowed',
              'privacy_preferred',
              'registry_selected',
            ],
          },
          {
            providerId: 'openai-default',
            providerSource: 'configured',
            providerType: CopilotProviderType.OpenAI,
            providerPriority: 20,
            privacy: 'private_cloud',
            health: 'degraded',
            available: true,
            allowed: true,
            registryKind: 'quota_backed',
            registryAvailable: true,
            registrySelected: false,
            reasons: [
              'candidate_allowed',
              'privacy_preferred',
              'registry_shadowed_by_byok',
            ],
          },
          {
            providerId: 'blocked-cloud',
            providerSource: 'configured',
            providerType: CopilotProviderType.OpenAI,
            providerPriority: 30,
            privacy: 'cloud',
            health: 'healthy',
            available: true,
            allowed: false,
            registryKind: 'quota_backed',
            registryAvailable: true,
            registrySelected: false,
            reasons: [
              'provider_blocked',
              'privacy_not_allowed',
              'registry_shadowed_by_byok',
            ],
          },
        ];
      }
      if (context?.featureKind === 'rerank') {
        return [
          {
            providerId: 'ollama-main',
            providerSource: 'configured',
            providerType: CopilotProviderType.OpenAICompatible,
            providerPriority: 10,
            privacy: 'local',
            health: 'healthy',
            available: true,
            allowed: true,
            registryKind: 'byok',
            registryAvailable: true,
            registrySelected: true,
            reasons: [
              'candidate_allowed',
              'privacy_preferred',
              'registry_selected',
            ],
          },
          {
            providerId: 'blocked-cloud',
            providerSource: 'configured',
            providerType: CopilotProviderType.OpenAI,
            providerPriority: 30,
            privacy: 'cloud',
            health: 'down',
            available: false,
            allowed: false,
            registryKind: 'quota_backed',
            registryAvailable: false,
            registrySelected: false,
            reasons: [
              'provider_unavailable',
              'provider_blocked',
              'privacy_not_allowed',
              'registry_unavailable',
              'registry_shadowed_by_byok',
            ],
          },
        ];
      }
      return [];
    }
  );
  Sinon.stub(factory, 'describeRouteCandidates').callsFake(async cond => {
    if (cond.outputType === ModelOutputType.Embedding) {
      return [
        {
          registryKind: 'byok',
          registryAvailable: true,
          registrySelected: true,
          providerId: 'ollama-main',
          requestedModelId: 'workspace-embedding',
          modelId: 'workspace-embedding',
          candidateModelIds: ['workspace-embedding', 'local-embedding'],
          matched: true,
          reasons: ['capability_matched'],
        },
        {
          registryKind: 'byok',
          registryAvailable: true,
          registrySelected: true,
          providerId: 'ollama-main',
          requestedModelId: 'workspace-embedding-large',
          modelId: 'workspace-embedding-large',
          candidateModelIds: ['workspace-embedding-large'],
          matched: true,
          reasons: ['capability_matched'],
        },
        {
          registryKind: 'quota_backed',
          registryAvailable: true,
          registrySelected: false,
          providerId: 'openai-default',
          candidateModelIds: ['text-embedding-3-small'],
          matched: true,
          modelId: 'text-embedding-3-small',
          reasons: ['profile_model_matched', 'capability_matched'],
        },
        {
          registryKind: 'quota_backed',
          registryAvailable: true,
          registrySelected: false,
          providerId: 'openai-prepare-filtered',
          candidateModelIds: ['text-embedding-3-large'],
          matched: true,
          modelId: 'text-embedding-3-large',
          reasons: ['profile_model_matched', 'capability_matched'],
        },
      ];
    }
    if (cond.outputType === ModelOutputType.Rerank) {
      return [
        {
          registryKind: 'byok',
          registryAvailable: true,
          registrySelected: true,
          providerId: 'ollama-main',
          requestedModelId: 'office-rerank',
          modelId: 'office-rerank',
          candidateModelIds: ['office-rerank'],
          matched: true,
          reasons: ['capability_matched'],
        },
        {
          registryKind: 'quota_backed',
          registryAvailable: false,
          registrySelected: false,
          providerId: 'blocked-cloud',
          requestedModelId: 'office-rerank',
          candidateModelIds: ['cloud-rerank'],
          matched: false,
          reasons: ['profile_model_not_allowed'],
        },
      ];
    }
    return [];
  });
  Sinon.stub(factory, 'describeEmbeddingPrepareCandidates').resolves([
    {
      providerId: 'ollama-main',
      modelId: 'workspace-embedding',
      prepared: true,
      preparedModelId: 'nomic-embed-text',
      reasons: ['provider_prepare_succeeded'],
    },
    {
      providerId: 'openai-default',
      modelId: 'text-embedding-3-small',
      prepared: true,
      preparedModelId: 'text-embedding-3-small',
      reasons: ['provider_prepare_succeeded'],
    },
    {
      providerId: 'openai-prepare-filtered',
      modelId: 'text-embedding-3-large',
      prepared: false,
      reasons: ['provider_prepare_returned_empty'],
    },
  ]);
  Sinon.stub(factory, 'describeRerankPrepareCandidates').resolves([
    {
      providerId: 'ollama-main',
      modelId: 'office-rerank',
      prepared: true,
      preparedModelId: 'bge-reranker-v2',
      reasons: ['provider_prepare_succeeded'],
    },
  ]);
  Sinon.stub(factory, 'resolveModelId').callsFake(async cond => cond.modelId);
  Sinon.stub(factory, 'resolveProvider').callsFake(
    async cond =>
      ({
        providerId: 'ollama-main',
        rawModelId: cond.modelId,
        modelId: 'office-chat-fast',
        fallbackProviderIds: ['ollama-main'],
        profile: {
          id: 'ollama-main',
          displayName: 'Local Ollama',
          type: CopilotProviderType.OpenAICompatible,
          enabled: true,
          priority: 10,
          privacy: 'local',
          health: { status: 'healthy' },
          config: {},
          middleware: {},
        },
        provider: {
          resolveModel: (modelId: string) => ({
            id: modelId,
            name: `Resolved ${modelId}`,
          }),
        },
      }) as any
  );
  Sinon.stub(taskPolicy, 'resolveWorkspaceIndexingModel').returns({
    configKey: 'workspaceIndexing',
    configPath: 'copilot.tasks.models.workspaceIndexing',
    modelId: 'ollama-main/workspace-embedding',
    source: 'workspace_indexing',
  });
  Sinon.stub(taskPolicy, 'resolveRerankModel').returns({
    configKey: 'rerank',
    configPath: 'copilot.tasks.models.rerank',
    modelId: 'ollama-main/office-rerank',
    source: 'rerank',
  });
  const describeEmbeddingRoute = Sinon.stub(
    chatRuntime,
    'describeEmbeddingRoute'
  ).resolves({
    configured: true,
    errorCode: undefined,
    errorMessage: undefined,
    fallbackOrder: ['ollama-main', 'openai-default'],
    preparedProviderCount: 2,
    preparedRoutes: [
      {
        providerId: 'ollama-main',
        modelId: 'nomic-embed-text',
        routeIndex: 0,
        protocol: 'openai_chat',
        requestLayer: 'chat_completions',
        modelBackendKind: 'openai_chat',
        canonicalModelKey: 'workspace-embedding',
        behaviorFlags: ['disable_batch_embeddings'],
      },
      {
        providerId: 'openai-default',
        modelId: 'text-embedding-3-small',
        routeIndex: 1,
        protocol: 'openai_responses',
        requestLayer: 'responses',
        modelBackendKind: 'openai_responses',
        canonicalModelKey: 'workspace-embedding-fallback',
        behaviorFlags: ['embedding_fallback'],
      },
    ],
    requestedModelId: 'ollama-main/workspace-embedding',
    providerId: 'ollama-main',
    modelId: 'nomic-embed-text',
    protocol: 'openai_chat',
    requestLayer: 'chat_completions',
    modelBackendKind: 'openai_chat',
    canonicalModelKey: 'workspace-embedding',
    behaviorFlags: ['disable_batch_embeddings'],
    requestedDimensions: EMBEDDING_DIMENSIONS,
    modelEmbeddingDimensions: 768,
    dimensionMismatch: true,
  });
  const describeRerankRoute = Sinon.stub(
    chatRuntime,
    'describeRerankRoute'
  ).resolves({
    configured: true,
    errorCode: undefined,
    errorMessage: undefined,
    fallbackOrder: ['ollama-main'],
    preparedProviderCount: 1,
    preparedRoutes: [
      {
        providerId: 'ollama-main',
        modelId: 'bge-reranker-v2',
        routeIndex: 0,
        protocol: 'openai_chat',
        requestLayer: 'chat_completions',
        modelBackendKind: 'openai_chat',
        canonicalModelKey: 'office-rerank',
        behaviorFlags: ['rerank_cross_encoder'],
      },
    ],
    requestedModelId: 'ollama-main/office-rerank',
    providerId: 'ollama-main',
    modelId: 'bge-reranker-v2',
    protocol: 'openai_chat',
    requestLayer: 'chat_completions',
    modelBackendKind: 'openai_chat',
    canonicalModelKey: 'office-rerank',
    behaviorFlags: ['rerank_cross_encoder'],
    candidateCount: 1,
  });

  const models = await resolver.models(promptName, {
    workspaceId: 'workspace-local-only',
  });
  const embeddingMainCandidateKey = JSON.stringify([
    'byok',
    'ollama-main',
    'workspace-embedding',
    'workspace-embedding',
    ['local-embedding', 'workspace-embedding'],
  ]);
  const embeddingLargeCandidateKey = JSON.stringify([
    'byok',
    'ollama-main',
    'workspace-embedding-large',
    'workspace-embedding-large',
    ['workspace-embedding-large'],
  ]);
  const embeddingOpenAICandidateKey = JSON.stringify([
    'quota_backed',
    'openai-default',
    '',
    'text-embedding-3-small',
    ['text-embedding-3-small'],
  ]);
  const embeddingFilteredCandidateKey = JSON.stringify([
    'quota_backed',
    'openai-prepare-filtered',
    '',
    'text-embedding-3-large',
    ['text-embedding-3-large'],
  ]);
  const rerankMainCandidateKey = JSON.stringify([
    'byok',
    'ollama-main',
    'office-rerank',
    'office-rerank',
    ['office-rerank'],
  ]);
  const rerankBlockedCandidateKey = JSON.stringify([
    'quota_backed',
    'blocked-cloud',
    'office-rerank',
    '',
    ['cloud-rerank', 'office-rerank'],
  ]);
  const normalizeTaskRouteDiagnosticsForAssertion = (value: unknown) =>
    JSON.parse(
      JSON.stringify(value, (key, item) =>
        key === 'candidateFingerprint' ||
        key === 'effectiveSourceFingerprint' ||
        key === 'effectiveSourceFingerprintInputs' ||
        key === 'effectiveSourceFingerprintVersion' ||
        key === 'embeddingIndexContractFingerprint' ||
        key === 'rerankRuntimeContractFingerprint' ||
        (key === 'candidateKey' &&
          typeof item === 'string' &&
          item.startsWith('["policy"'))
          ? undefined
          : item
      )
    );

  t.true(
    models.embeddingRoute?.policyCandidates.every(
      candidate => candidate.candidateKey && candidate.candidateFingerprint
    )
  );
  t.true(
    models.rerankRoute?.policyCandidates.every(
      candidate => candidate.candidateKey && candidate.candidateFingerprint
    )
  );
  t.regex(
    models.embeddingRoute?.effectiveSourceFingerprint ?? '',
    /^[a-f0-9]{16}$/
  );
  t.is(
    models.embeddingRoute?.effectiveSourceFingerprintVersion,
    'copilot-task-route-effective-source/v1'
  );
  t.true(
    models.embeddingRoute?.effectiveSourceFingerprintInputs?.includes(
      'preparedRoutes'
    )
  );
  t.true(
    models.embeddingRoute?.effectiveSourceFingerprintInputs?.includes(
      'embeddingIndexContractFingerprint'
    )
  );
  t.is(
    models.embeddingRoute?.embeddingIndexContractVersion,
    'workspace-embedding-index/v2'
  );
  t.is(
    models.embeddingRoute?.embeddingIndexContractStatus,
    'dimension_mismatch'
  );
  t.is(
    models.embeddingRoute?.embeddingIndexContractDimensions,
    EMBEDDING_DIMENSIONS
  );
  t.regex(
    models.embeddingRoute?.embeddingIndexContractFingerprint ?? '',
    /^[a-f0-9]{16}$/
  );
  t.regex(
    models.rerankRoute?.effectiveSourceFingerprint ?? '',
    /^[a-f0-9]{16}$/
  );
  t.is(
    models.rerankRoute?.effectiveSourceFingerprintVersion,
    'copilot-task-route-effective-source/v1'
  );
  t.true(
    models.rerankRoute?.effectiveSourceFingerprintInputs?.includes(
      'rerankRuntimeContractFingerprint'
    )
  );
  t.is(
    models.rerankRoute?.rerankRuntimeContractVersion,
    'workspace-rerank-runtime/v1'
  );
  t.is(
    models.rerankRoute?.rerankRuntimeContractStatus,
    'prepared_route_available'
  );
  t.is(models.rerankRoute?.rerankRuntimeContractTopK, undefined);
  t.regex(
    models.rerankRoute?.rerankRuntimeContractFingerprint ?? '',
    /^[a-f0-9]{16}$/
  );
  t.not(
    models.embeddingRoute?.effectiveSourceFingerprint,
    models.rerankRoute?.effectiveSourceFingerprint
  );
  const embeddingRoute = normalizeTaskRouteDiagnosticsForAssertion(
    models.embeddingRoute
  );
  const rerankRoute = normalizeTaskRouteDiagnosticsForAssertion(
    models.rerankRoute
  );

  t.deepEqual(embeddingRoute, {
    configured: true,
    diagnosticsErrors: [],
    featureKind: 'workspace_indexing',
    policyEnabled: true,
    policyFeatureKind: 'workspace_indexing',
    policyWorkspaceId: 'workspace-local-only',
    policyAllowedProviderIds: ['ollama-main', 'openai-default'],
    policyBlockedProviderIds: ['blocked-cloud'],
    policyAllowedPrivacy: ['local', 'private_cloud'],
    policyPreferredPrivacy: ['local', 'private_cloud'],
    policyCandidates: [
      {
        providerId: 'ollama-main',
        providerSource: 'configured',
        providerType: CopilotProviderType.OpenAICompatible,
        providerPriority: 10,
        privacy: 'local',
        health: 'healthy',
        available: true,
        allowed: true,
        registryKind: 'byok',
        registryAvailable: true,
        registrySelected: true,
        reasons: [
          'candidate_allowed',
          'privacy_preferred',
          'registry_selected',
        ],
      },
      {
        providerId: 'openai-default',
        providerSource: 'configured',
        providerType: CopilotProviderType.OpenAI,
        providerPriority: 20,
        privacy: 'private_cloud',
        health: 'degraded',
        available: true,
        allowed: true,
        registryKind: 'quota_backed',
        registryAvailable: true,
        registrySelected: false,
        reasons: [
          'candidate_allowed',
          'privacy_preferred',
          'registry_shadowed_by_byok',
        ],
      },
      {
        providerId: 'blocked-cloud',
        providerSource: 'configured',
        providerType: CopilotProviderType.OpenAI,
        providerPriority: 30,
        privacy: 'cloud',
        health: 'healthy',
        available: true,
        allowed: false,
        registryKind: 'quota_backed',
        registryAvailable: true,
        registrySelected: false,
        reasons: [
          'provider_blocked',
          'privacy_not_allowed',
          'registry_shadowed_by_byok',
        ],
      },
    ],
    routeCandidates: [
      {
        candidateKey: embeddingMainCandidateKey,
        registryKind: 'byok',
        registryAvailable: true,
        registrySelected: true,
        providerId: 'ollama-main',
        requestedModelId: 'workspace-embedding',
        modelId: 'workspace-embedding',
        candidateModelIds: ['workspace-embedding', 'local-embedding'],
        matched: true,
        reasons: ['capability_matched'],
      },
      {
        candidateKey: embeddingLargeCandidateKey,
        registryKind: 'byok',
        registryAvailable: true,
        registrySelected: true,
        providerId: 'ollama-main',
        requestedModelId: 'workspace-embedding-large',
        modelId: 'workspace-embedding-large',
        candidateModelIds: ['workspace-embedding-large'],
        matched: true,
        reasons: ['capability_matched'],
      },
      {
        candidateKey: embeddingOpenAICandidateKey,
        registryKind: 'quota_backed',
        registryAvailable: true,
        registrySelected: false,
        providerId: 'openai-default',
        candidateModelIds: ['text-embedding-3-small'],
        matched: true,
        modelId: 'text-embedding-3-small',
        reasons: ['profile_model_matched', 'capability_matched'],
      },
      {
        candidateKey: embeddingFilteredCandidateKey,
        registryKind: 'quota_backed',
        registryAvailable: true,
        registrySelected: false,
        providerId: 'openai-prepare-filtered',
        candidateModelIds: ['text-embedding-3-large'],
        matched: true,
        modelId: 'text-embedding-3-large',
        reasons: ['profile_model_matched', 'capability_matched'],
      },
    ],
    routeTrace: [
      {
        phase: 'policy',
        candidateCount: 3,
        availableCount: 3,
        selectedCount: 2,
        blockedCount: 1,
        reasons: [
          'candidate_allowed',
          'privacy_preferred',
          'registry_selected',
          'registry_shadowed_by_byok',
          'provider_blocked',
          'privacy_not_allowed',
        ],
      },
      {
        phase: 'resolution',
        candidateCount: 4,
        availableCount: 4,
        selectedCount: 2,
        matchedCount: 4,
        reasons: ['capability_matched', 'profile_model_matched'],
      },
      {
        phase: 'prepared',
        candidateCount: 4,
        selectedCount: 1,
        preparedCount: 2,
        reasons: [
          'prepared_route_filtered',
          'provider_prepare_succeeded',
          'provider_prepare_returned_empty',
        ],
      },
    ],
    prepareCandidates: [
      {
        candidateKey: embeddingMainCandidateKey,
        registryKind: 'byok',
        registryAvailable: true,
        registrySelected: true,
        providerId: 'ollama-main',
        requestedModelId: 'workspace-embedding',
        modelId: 'workspace-embedding',
        candidateModelIds: ['workspace-embedding', 'local-embedding'],
        prepared: true,
        preparedModelId: 'nomic-embed-text',
        reasons: [
          'prepared_route_available',
          'provider_prepare_succeeded',
          'prepared_model_resolved',
        ],
      },
      {
        candidateKey: embeddingLargeCandidateKey,
        registryKind: 'byok',
        registryAvailable: true,
        registrySelected: true,
        providerId: 'ollama-main',
        requestedModelId: 'workspace-embedding-large',
        modelId: 'workspace-embedding-large',
        candidateModelIds: ['workspace-embedding-large'],
        prepared: false,
        reasons: ['prepared_route_filtered'],
      },
      {
        candidateKey: embeddingOpenAICandidateKey,
        registryKind: 'quota_backed',
        registryAvailable: true,
        registrySelected: false,
        providerId: 'openai-default',
        modelId: 'text-embedding-3-small',
        candidateModelIds: ['text-embedding-3-small'],
        prepared: true,
        preparedModelId: 'text-embedding-3-small',
        reasons: ['prepared_route_available', 'provider_prepare_succeeded'],
      },
      {
        candidateKey: embeddingFilteredCandidateKey,
        registryKind: 'quota_backed',
        registryAvailable: true,
        registrySelected: false,
        providerId: 'openai-prepare-filtered',
        modelId: 'text-embedding-3-large',
        candidateModelIds: ['text-embedding-3-large'],
        prepared: false,
        reasons: [
          'prepared_route_not_selected',
          'provider_prepare_returned_empty',
        ],
      },
    ],
    fallbackProviderIds: ['ollama-main', 'openai-default'],
    preparedProviderCount: 2,
    preparedRouteTargets: [
      'ollama-main/nomic-embed-text',
      'openai-default/text-embedding-3-small',
    ],
    preparedRouteTargetFingerprint: taskRouteTargetFingerprintFixture({
      featureKind: 'workspace_indexing',
      requestedModelConfigKey: 'workspaceIndexing',
      requestedModelConfigPath: 'copilot.tasks.models.workspaceIndexing',
      requestedModelId: 'ollama-main/workspace-embedding',
      requestedModelSource: 'workspace_indexing',
      targets: [
        'ollama-main/nomic-embed-text',
        'openai-default/text-embedding-3-small',
      ],
    }),
    preparedRoutes: [
      {
        providerId: 'ollama-main',
        modelId: 'nomic-embed-text',
        routeIndex: 0,
        protocol: 'openai_chat',
        requestLayer: 'chat_completions',
        modelBackendKind: 'openai_chat',
        canonicalModelKey: 'workspace-embedding',
        behaviorFlags: ['disable_batch_embeddings'],
      },
      {
        providerId: 'openai-default',
        modelId: 'text-embedding-3-small',
        routeIndex: 1,
        protocol: 'openai_responses',
        requestLayer: 'responses',
        modelBackendKind: 'openai_responses',
        canonicalModelKey: 'workspace-embedding-fallback',
        behaviorFlags: ['embedding_fallback'],
      },
    ],
    requestedModelId: 'ollama-main/workspace-embedding',
    requestedModelConfigKey: 'workspaceIndexing',
    requestedModelConfigPath: 'copilot.tasks.models.workspaceIndexing',
    requestedModelSource: 'workspace_indexing',
    providerId: 'ollama-main',
    modelId: 'nomic-embed-text',
    protocol: 'openai_chat',
    requestLayer: 'chat_completions',
    modelBackendKind: 'openai_chat',
    canonicalModelKey: 'workspace-embedding',
    behaviorFlags: ['disable_batch_embeddings'],
    requestedDimensions: EMBEDDING_DIMENSIONS,
    modelEmbeddingDimensions: 768,
    dimensionMismatch: true,
    embeddingIndexContractVersion: 'workspace-embedding-index/v2',
    embeddingIndexContractStatus: 'dimension_mismatch',
    embeddingIndexContractDimensions: EMBEDDING_DIMENSIONS,
    taskRoutePolicyRevisionSourceChain: [
      {
        configKey: 'workspaceIndexing',
        configPath: 'copilot.tasks.models.workspaceIndexing',
        featureKind: 'workspace_indexing',
        modelId: 'ollama-main/workspace-embedding',
        scope: 'global',
        source: 'config_fallback',
        status: 'available',
      },
    ],
    taskRoutePolicyRevisionSourceChainFingerprint: 'e9ff9a1fa24cb17c',
  });
  t.deepEqual(rerankRoute, {
    configured: true,
    diagnosticsErrors: [],
    featureKind: 'rerank',
    policyEnabled: true,
    policyFeatureKind: 'rerank',
    policyWorkspaceId: 'workspace-local-only',
    policyAllowedProviderIds: ['ollama-main'],
    policyBlockedProviderIds: ['blocked-cloud'],
    policyAllowedPrivacy: ['local'],
    policyPreferredPrivacy: ['local'],
    policyCandidates: [
      {
        providerId: 'ollama-main',
        providerSource: 'configured',
        providerType: CopilotProviderType.OpenAICompatible,
        providerPriority: 10,
        privacy: 'local',
        health: 'healthy',
        available: true,
        allowed: true,
        registryKind: 'byok',
        registryAvailable: true,
        registrySelected: true,
        reasons: [
          'candidate_allowed',
          'privacy_preferred',
          'registry_selected',
        ],
      },
      {
        providerId: 'blocked-cloud',
        providerSource: 'configured',
        providerType: CopilotProviderType.OpenAI,
        providerPriority: 30,
        privacy: 'cloud',
        health: 'down',
        available: false,
        allowed: false,
        registryKind: 'quota_backed',
        registryAvailable: false,
        registrySelected: false,
        reasons: [
          'provider_unavailable',
          'provider_blocked',
          'privacy_not_allowed',
          'registry_unavailable',
          'registry_shadowed_by_byok',
        ],
      },
    ],
    routeCandidates: [
      {
        candidateKey: rerankMainCandidateKey,
        registryKind: 'byok',
        registryAvailable: true,
        registrySelected: true,
        providerId: 'ollama-main',
        requestedModelId: 'office-rerank',
        modelId: 'office-rerank',
        candidateModelIds: ['office-rerank'],
        matched: true,
        reasons: ['capability_matched'],
      },
      {
        candidateKey: rerankBlockedCandidateKey,
        registryKind: 'quota_backed',
        registryAvailable: false,
        registrySelected: false,
        providerId: 'blocked-cloud',
        requestedModelId: 'office-rerank',
        candidateModelIds: ['cloud-rerank'],
        matched: false,
        reasons: ['profile_model_not_allowed'],
      },
    ],
    routeTrace: [
      {
        phase: 'policy',
        candidateCount: 2,
        availableCount: 1,
        selectedCount: 1,
        blockedCount: 1,
        reasons: [
          'candidate_allowed',
          'privacy_preferred',
          'registry_selected',
          'provider_unavailable',
          'provider_blocked',
          'privacy_not_allowed',
          'registry_unavailable',
          'registry_shadowed_by_byok',
        ],
      },
      {
        phase: 'resolution',
        candidateCount: 2,
        availableCount: 1,
        selectedCount: 1,
        matchedCount: 1,
        reasons: ['capability_matched', 'profile_model_not_allowed'],
      },
      {
        phase: 'prepared',
        candidateCount: 1,
        selectedCount: 1,
        preparedCount: 1,
        reasons: ['provider_prepare_succeeded'],
      },
    ],
    prepareCandidates: [
      {
        candidateKey: rerankMainCandidateKey,
        registryKind: 'byok',
        registryAvailable: true,
        registrySelected: true,
        providerId: 'ollama-main',
        requestedModelId: 'office-rerank',
        modelId: 'office-rerank',
        candidateModelIds: ['office-rerank'],
        prepared: true,
        preparedModelId: 'bge-reranker-v2',
        reasons: [
          'prepared_route_available',
          'provider_prepare_succeeded',
          'prepared_model_resolved',
        ],
      },
    ],
    fallbackProviderIds: ['ollama-main'],
    preparedProviderCount: 1,
    preparedRouteTargets: ['ollama-main/bge-reranker-v2'],
    preparedRouteTargetFingerprint: taskRouteTargetFingerprintFixture({
      featureKind: 'rerank',
      requestedModelConfigKey: 'rerank',
      requestedModelConfigPath: 'copilot.tasks.models.rerank',
      requestedModelId: 'ollama-main/office-rerank',
      requestedModelSource: 'rerank',
      targets: ['ollama-main/bge-reranker-v2'],
    }),
    preparedRoutes: [
      {
        providerId: 'ollama-main',
        modelId: 'bge-reranker-v2',
        routeIndex: 0,
        protocol: 'openai_chat',
        requestLayer: 'chat_completions',
        modelBackendKind: 'openai_chat',
        canonicalModelKey: 'office-rerank',
        behaviorFlags: ['rerank_cross_encoder'],
      },
    ],
    requestedModelId: 'ollama-main/office-rerank',
    requestedModelConfigKey: 'rerank',
    requestedModelConfigPath: 'copilot.tasks.models.rerank',
    requestedModelSource: 'rerank',
    providerId: 'ollama-main',
    modelId: 'bge-reranker-v2',
    protocol: 'openai_chat',
    requestLayer: 'chat_completions',
    modelBackendKind: 'openai_chat',
    canonicalModelKey: 'office-rerank',
    behaviorFlags: ['rerank_cross_encoder'],
    candidateCount: 1,
    rerankRuntimeContractVersion: 'workspace-rerank-runtime/v1',
    rerankRuntimeContractStatus: 'prepared_route_available',
    taskRoutePolicyRevisionSourceChain: [
      {
        configKey: 'rerank',
        configPath: 'copilot.tasks.models.rerank',
        featureKind: 'rerank',
        modelId: 'ollama-main/office-rerank',
        scope: 'global',
        source: 'config_fallback',
        status: 'available',
      },
    ],
    taskRoutePolicyRevisionSourceChainFingerprint: '39b08806c44eb114',
  });
  Sinon.assert.calledOnceWithExactly(
    describeEmbeddingRoute,
    'ollama-main/workspace-embedding',
    {
      workspace: 'workspace-local-only',
      dimensions: EMBEDDING_DIMENSIONS,
      featureKind: 'workspace_indexing',
    }
  );
  Sinon.assert.calledOnceWithExactly(
    describeRerankRoute,
    'ollama-main/office-rerank',
    {
      workspace: 'workspace-local-only',
      featureKind: 'rerank',
    }
  );
});
