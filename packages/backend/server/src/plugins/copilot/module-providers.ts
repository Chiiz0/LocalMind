import { CopilotAccessPolicy } from './access';
import { CopilotAgentRuntimeDocUpdateAdapter } from './agent-runtime-doc-update-adapter';
import { CopilotAgentRuntimeLocalMindToolAgentAdapter } from './agent-runtime-localmind-tool-agent-adapter';
import { CopilotAgentRuntimeModelCompletionAdapter } from './agent-runtime-model-adapter';
import { CopilotAgentRuntimeWorker } from './agent-runtime-worker';
import { CopilotAgentRuntimeWorkflowRegistry } from './agent-runtime-workflow-registry';
import {
  AiProfileResolver,
  AiProfileService,
  ByokEntitlementPolicy,
  ByokService,
  ProjectAiModelResolver,
  ProjectByokResolver,
  WorkspaceByokResolver,
} from './byok';
import { HistoryAttachmentUrlProjector } from './compat/history-attachment-url-projector';
import { CompatHistoryProjector } from './compat/history-projector';
import { HistoryPromptPreloadProjector } from './compat/history-prompt-preload-projector';
import { HistoryVisibilityPolicy } from './compat/history-visibility-policy';
import { CompatSubmissionStore } from './compat/submission-store';
import {
  CopilotContextResolver,
  CopilotContextRootResolver,
  CopilotContextService,
  CopilotEmbeddingRealtimeProvider,
} from './context';
import { CopilotContextMemoryResolver } from './context-memory-resolver';
import { ContextMemoryService } from './context-memory-service';
import { ContextRuleService } from './context-rule-service';
import { ContextScopeResolver } from './context-scope-resolver';
import { ConversationInboxService } from './conversation/inbox';
import { ConversationPolicy } from './conversation/policy';
import { ConversationStore } from './conversation/store';
import { CopilotCronJobs } from './cron';
import { CopilotDocumentCopyService } from './document-copy-service';
import { CopilotDocumentOperationResolver } from './document-operation-resolver';
import { CopilotDocumentOperationService } from './document-operation-service';
import {
  CopilotEmbeddingClientService,
  CopilotEmbeddingJob,
} from './embedding';
import {
  DingTalkCliDriver,
  EnterpriseAuthorizationService,
  EnterpriseAuthorizationWorker,
  EnterpriseCliDriverRegistry,
  EnterpriseCliRuntime,
  EnterpriseConnectionResolver,
  EnterpriseConnectionService,
  EnterpriseToolRegistry,
  LarkCliDriver,
  WeComCliDriver,
} from './enterprise';
import {
  ExternalMcpConnectionResolver,
  ExternalMcpConnectionService,
  ExternalMcpToolRegistry,
  ExternalMcpTransport,
} from './external-mcp';
import { IntelligenceWorkbenchResolver } from './intelligence-workbench-resolver';
import { McpAttachmentService } from './mcp/attachments';
import { McpAiDelegationService } from './mcp/delegation';
import { WorkspaceMcpProvider } from './mcp/provider';
import { McpAiTaskControlService } from './mcp/task-control';
import { McpAiTaskQueryService } from './mcp/task-query';
import {
  CopilotAgentRuntimeOfficeCommandAdapter,
  OfficeAgentCommandService,
} from './office-agent-command';
import { ProjectAgentRuntimeResolver } from './project-agent-runtime-resolver';
import { CopilotProjectAgentRuntimeWorker } from './project-agent-runtime-worker';
import { ProjectContextResolver } from './project-context-resolver';
import { ProjectContextService } from './project-context-service';
import {
  ProjectOfficeAgentCommandAdapter,
  ProjectOfficeAgentCommandService,
} from './project-office-agent-command';
import { PromptService } from './prompt';
import { CopilotProviderHealthWorker } from './provider-health-worker';
import {
  CopilotFeatureService,
  CopilotProviderFactory,
  CopilotProviderLifecycleService,
  CopilotProviderRegistryService,
  CopilotProviders,
} from './providers';
import { CopilotRepairExecutionWorker } from './repair-execution-worker';
import { CopilotResolver, UserCopilotResolver } from './resolver';
import { ActionRuntimeBridge } from './runtime/action-runtime-bridge';
import { CapabilityRuntime } from './runtime/capability-runtime';
import { ContextPlanner } from './runtime/context-planner';
import { CopilotExecutionMetrics } from './runtime/execution-metrics';
import { ExecutionPlanBuilder } from './runtime/execution-plan';
import { ActionStreamHost } from './runtime/hosts/action-stream-host';
import { AttachmentAdmissionHost } from './runtime/hosts/attachment-admission';
import { AttachmentMaterializer } from './runtime/hosts/attachment-materializer';
import { CapabilityPolicyHost } from './runtime/hosts/capability-policy-host';
import { ConversationHost } from './runtime/hosts/conversation-host';
import { ImageResultHost } from './runtime/hosts/image-result-host';
import { ResponsePostprocessor } from './runtime/hosts/response-postprocessor';
import { ToolExecutorHost } from './runtime/hosts/tool-executor-host';
import { TurnPersistence } from './runtime/hosts/turn-persistence';
import { ModelSelectionPolicy } from './runtime/model-selection-policy';
import { NativeExecutionEngine } from './runtime/native-execution-engine';
import { PromptRuntime } from './runtime/prompt-runtime';
import { TaskPolicy } from './runtime/task-policy';
import { ToolRuntime } from './runtime/tool-runtime';
import { TurnOrchestrator } from './runtime/turn-orchestrator';
import { ChatSessionService } from './session';
import { CopilotStorage } from './storage';
import {
  CopilotTranscriptionReader,
  CopilotTranscriptionResolver,
  CopilotTranscriptionService,
  CopilotTranscriptRealtimeProvider,
} from './transcript';
import {
  CopilotWorkspaceEmbeddingConfigResolver,
  CopilotWorkspaceEmbeddingResolver,
  CopilotWorkspaceService,
} from './workspace';

export const COPILOT_PROVIDER_PROVIDERS = [
  CopilotFeatureService,
  ...CopilotProviders,
  CopilotProviderRegistryService,
  CopilotProviderFactory,
  CopilotProviderLifecycleService,
];

export const COPILOT_RUNTIME_PROVIDERS = [
  ByokEntitlementPolicy,
  AiProfileService,
  ByokService,
  ChatSessionService,
  ConversationStore,
  ConversationInboxService,
  ConversationPolicy,
  ContextMemoryService,
  ContextRuleService,
  ContextScopeResolver,
  CopilotAccessPolicy,
  HistoryAttachmentUrlProjector,
  CompatHistoryProjector,
  HistoryPromptPreloadProjector,
  CompatSubmissionStore,
  HistoryVisibilityPolicy,
  CopilotContextService,
  CopilotEmbeddingClientService,
  PromptService,
  EnterpriseCliRuntime,
  WeComCliDriver,
  LarkCliDriver,
  DingTalkCliDriver,
  EnterpriseCliDriverRegistry,
  EnterpriseConnectionService,
  EnterpriseAuthorizationService,
  EnterpriseToolRegistry,
  ExternalMcpTransport,
  ExternalMcpConnectionService,
  ExternalMcpToolRegistry,
  OfficeAgentCommandService,
  ProjectOfficeAgentCommandService,
  ProjectContextService,
  ModelSelectionPolicy,
  ActionRuntimeBridge,
  CopilotExecutionMetrics,
  ExecutionPlanBuilder,
  PromptRuntime,
  CapabilityPolicyHost,
  ConversationHost,
  CapabilityRuntime,
  ContextPlanner,
  NativeExecutionEngine,
  TaskPolicy,
  ToolRuntime,
  CopilotDocumentCopyService,
  ToolExecutorHost,
  AttachmentMaterializer,
  AttachmentAdmissionHost,
  ActionStreamHost,
  ImageResultHost,
  ResponsePostprocessor,
  CopilotStorage,
  TurnPersistence,
];

export const COPILOT_CONTEXT_REALTIME_PROVIDERS = [
  CopilotEmbeddingRealtimeProvider,
];

export const COPILOT_CONTEXT_PROVIDERS = [
  CopilotContextResolver,
  ...COPILOT_CONTEXT_REALTIME_PROVIDERS,
];

export const COPILOT_TRANSCRIPT_REALTIME_PROVIDERS = [
  CopilotTranscriptionReader,
  CopilotTranscriptRealtimeProvider,
];

export const COPILOT_TRANSCRIPT_PROVIDERS = [
  CopilotTranscriptionService,
  CopilotTranscriptionResolver,
  ...COPILOT_TRANSCRIPT_REALTIME_PROVIDERS,
];

export const COPILOT_WORKSPACE_PROVIDERS = [
  CopilotWorkspaceService,
  CopilotWorkspaceEmbeddingResolver,
  CopilotWorkspaceEmbeddingConfigResolver,
];

export const COPILOT_RESOLVER_PROVIDERS = [
  CopilotResolver,
  CopilotContextMemoryResolver,
  IntelligenceWorkbenchResolver,
  EnterpriseConnectionResolver,
  ExternalMcpConnectionResolver,
  UserCopilotResolver,
  CopilotContextRootResolver,
  AiProfileResolver,
  WorkspaceByokResolver,
  ProjectByokResolver,
  ProjectAiModelResolver,
  ProjectContextResolver,
];

export const COPILOT_JOB_PROVIDERS = [
  CopilotDocumentOperationService,
  CopilotEmbeddingJob,
  CopilotCronJobs,
  CopilotAgentRuntimeWorkflowRegistry,
  CopilotAgentRuntimeModelCompletionAdapter,
  CopilotAgentRuntimeDocUpdateAdapter,
  CopilotAgentRuntimeOfficeCommandAdapter,
  CopilotAgentRuntimeLocalMindToolAgentAdapter,
  CopilotAgentRuntimeWorker,
  CopilotProjectAgentRuntimeWorker,
  ProjectAgentRuntimeResolver,
  ProjectOfficeAgentCommandAdapter,
  CopilotProviderHealthWorker,
  CopilotRepairExecutionWorker,
  McpAttachmentService,
  McpAiDelegationService,
  McpAiTaskControlService,
  EnterpriseAuthorizationWorker,
];

export const COPILOT_MCP_PROVIDERS = [
  McpAiTaskQueryService,
  WorkspaceMcpProvider,
];

export const COPILOT_KERNEL_PROVIDERS = [
  ...COPILOT_PROVIDER_PROVIDERS,
  ...COPILOT_RUNTIME_PROVIDERS,
];

export const COPILOT_FEATURE_PROVIDERS = [
  TurnOrchestrator,
  ...COPILOT_CONTEXT_PROVIDERS,
  ...COPILOT_TRANSCRIPT_PROVIDERS,
  ...COPILOT_WORKSPACE_PROVIDERS,
  ...COPILOT_JOB_PROVIDERS,
];

export const COPILOT_API_PROVIDERS = [
  CopilotDocumentOperationResolver,
  ...COPILOT_RESOLVER_PROVIDERS,
  ...COPILOT_MCP_PROVIDERS,
];
