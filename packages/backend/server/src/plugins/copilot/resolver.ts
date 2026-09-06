import { createHash } from 'node:crypto';

import { NotFoundException, Optional } from '@nestjs/common';
import {
  Args,
  Field,
  ID,
  InputType,
  Mutation,
  ObjectType,
  Parent,
  registerEnumType,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { GraphQLJSON, SafeIntResolver } from 'graphql-scalars';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';

import {
  BadRequest,
  CallMetric,
  CopilotDocNotFound,
  CopilotFailedToCreateMessage,
  CopilotSessionNotFound,
  type FileUpload,
  JobQueue,
  paginate,
  Paginated,
  PaginationInput,
  RequestMutex,
  Throttle,
  TooManyRequest,
  URLHelper,
} from '../../base';
import { CurrentUser } from '../../core/auth';
import {
  DocAction,
  PermissionAccess,
  type WorkspaceAction,
} from '../../core/permission';
import { UserType } from '../../core/user';
import {
  EMBEDDING_DIMENSIONS,
  type ListSessionOptions,
  Models,
  type PromptRegistryBodyEditPreview,
  type PromptRegistryBodyEditPublishResult,
  type PromptRegistryPublishGateVerdict,
  type UpdateChatSession,
} from '../../models';
import type {
  CopilotActionRunAgentRuntimeDiagnosticsManifest,
  CopilotActionRunAgentRuntimeDiagnosticsManifestExportMetadata,
  CopilotActionRunAgentRuntimeTimelineItem,
  CopilotActionRunDiagnosticsItem,
  CopilotActionRunPreparedRouteTrace,
} from '../../models/copilot-action-run';
import type {
  CopilotAgentRunListFilter,
  CopilotAgentRunRecord,
  CopilotAgentRuntimeExecutionResultRecord,
  CopilotAgentStepRecord,
  CopilotAgentTimelineEventRecord,
} from '../../models/copilot-agent-runtime';
import type {
  ModelRegistryRevision,
  ModelRegistrySourceChainEntry,
} from '../../models/copilot-model-registry-revision';
import type {
  CopilotProviderHealthEventRecord,
  CopilotProviderHealthProbeAttemptListFilter,
  CopilotProviderHealthProbeAttemptRecord,
  CopilotProviderHealthState,
} from '../../models/copilot-provider-health-state';
import type {
  ProviderRegistryRevision,
  ProviderRegistrySourceChainEntry,
} from '../../models/copilot-provider-registry-revision';
import type {
  RegistryRevisionPublishEventHistory,
  RegistryRevisionPublishEventRecord,
} from '../../models/copilot-registry-revision-publish-event';
import type {
  CopilotRepairExecutionAuditEventRecord,
  CopilotRepairExecutionListFilter,
  CopilotRepairExecutionRecord,
  CopilotRepairExecutionRuntimeResult,
  CopilotRepairExecutionSideEffectRecord,
} from '../../models/copilot-repair-execution';
import type {
  CopilotSupportBundleAuditEventRecord,
  CopilotSupportBundleDownloadAuthorization,
  CopilotSupportBundleDownloadAuthorizationResult,
  CopilotSupportBundleListFilter,
  CopilotSupportBundleManifest,
  CopilotSupportBundleRecord,
  CopilotSupportBundleRetentionCleanupResult,
  CopilotSupportBundleSourceEvidenceSummary,
  CopilotSupportBundleTaskRouteSnapshot,
  CopilotSupportBundleTransferEventRecord,
  CopilotSupportBundleTransferForwardingEventRecord,
} from '../../models/copilot-support-bundle';
import type { CopilotAccessContext } from './access';
import { createAgentRuntimeDocUpdateRequest } from './agent-runtime-doc-update-request';
import {
  type CopilotAgentRuntimeWorkflowAdapterCapabilities,
  CopilotAgentRuntimeWorkflowRegistry,
} from './agent-runtime-workflow-registry';
import { CompatHistoryProjector } from './compat/history-projector';
import type {
  CopilotModelDefinition,
  CopilotProviderHealthStatus,
  CopilotProviderPrivacy,
  CopilotProviderRoutePolicyFeatureKind,
} from './config';
import { ContextScopeResolver } from './context-scope-resolver';
import { ConversationInboxService } from './conversation/inbox';
import {
  AGENT_RUNTIME_OFFICE_COMMAND_WORKFLOW,
  OfficeAgentCommandService,
} from './office-agent-command';
import {
  isImagePromptCategory,
  isTranscriptPromptCategory,
} from './prompt/category';
import { PromptService } from './prompt/service';
import type {
  PromptCatalogItem,
  PromptCatalogVersionEvidence,
  PromptRegistryRevision,
  PromptRegistrySourceChainEntry,
  ResolvedPrompt,
} from './prompt/spec';
import {
  type CopilotProviderEffectiveRoutePolicyCandidateDiagnostics,
  CopilotProviderFactory,
  type CopilotProviderPrepareCandidateDiagnostics,
  type ResolvedCopilotProvider,
} from './providers/factory';
import {
  type ResolvedProviderModel,
  resolveModelLimits,
} from './providers/provider-model-runtime';
import type {
  CopilotProviderRoutePolicyCandidateDiagnostics,
  CopilotProviderRoutePolicySummary,
  NormalizedCopilotProviderProfile,
} from './providers/provider-registry';
import { CopilotProviderRegistryService } from './providers/registry-service';
import {
  ModelInputType,
  ModelOutputType,
  type StreamObject,
} from './providers/types';
import { CapabilityRuntime } from './runtime/capability-runtime';
import {
  buildStructuredResponseFromSchemaJson,
  type ExecutionRouteDiagnostics,
  type RequiredStructuredOutputContract,
} from './runtime/contracts';
import { ExecutionPlanBuilder } from './runtime/execution-plan';
import {
  TaskPolicy,
  type TaskRoutePolicyFeatureKind,
  type TaskRoutePolicyRevision,
  type TaskRoutePolicySourceChainEntry,
} from './runtime/task-policy';
import { ChatSessionService } from './session';
import { type ChatHistory, type ChatMessage, SubmittedMessage } from './types';

export const COPILOT_LOCKER = 'copilot';

// ================== Input Types ==================

@InputType()
class CreateChatSessionInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String, { nullable: true })
  docId?: string;

  @Field(() => String, {
    description: 'The prompt name to use for the session',
  })
  promptName!: string;

  @Field(() => Boolean, { nullable: true })
  pinned?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    description: 'true by default, compliant for old version',
  })
  reuseLatestChat?: boolean;
}

@InputType()
class UpdateChatSessionInput implements Omit<
  UpdateChatSession,
  'userId' | 'title'
> {
  @Field(() => String)
  sessionId!: string;

  @Field(() => String, {
    description: 'The workspace id of the session',
    nullable: true,
  })
  docId!: string | null | undefined;

  @Field(() => String, {
    description: 'The explicitly selected AI context project',
    nullable: true,
  })
  selectedContextProjectId!: string | null | undefined;

  @Field(() => Boolean, {
    description: 'Whether to pin the session',
    nullable: true,
  })
  pinned!: boolean | undefined;

  @Field(() => String, {
    description: 'The prompt name to use for the session',
    nullable: true,
  })
  promptName!: string;
}

@InputType()
class ForkChatSessionInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  docId!: string;

  @Field(() => String)
  sessionId!: string;

  @Field(() => String, {
    description:
      'Identify a message in the array and keep it with all previous messages into a forked session.',
    nullable: true,
  })
  latestMessageId?: string;
}

@InputType()
class DeleteSessionInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String, { nullable: true })
  docId!: string | undefined;

  @Field(() => [String])
  sessionIds!: string[];
}

@InputType()
class CopilotPromptRegistryPublishGateExpectedVersionInput {
  @Field(() => String, { nullable: true })
  registryFingerprint?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  registryId?: number;

  @Field(() => String, { nullable: true })
  registryUpdatedAt?: string;
}

@InputType()
class CopilotPromptRegistryRepairSubmissionInput {
  @Field(() => String)
  approvalPolicyFingerprint!: string;

  @Field(() => String)
  authorizationFingerprint!: string;

  @Field(() => String)
  candidateEvidenceSetFingerprint!: string;

  @Field(() => String)
  taskRouteEffectiveSourceEvidenceSetFingerprint!: string;

  @Field(() => String)
  embeddingIndexContractEvidenceSetFingerprint!: string;

  @Field(() => String)
  rerankRuntimeContractEvidenceSetFingerprint!: string;

  @Field(() => String)
  preparedRouteOrderEvidenceSetFingerprint!: string;

  @Field(() => String)
  catalogFingerprint!: string;

  @Field(() => String)
  contractVersion!: string;

  @Field(() => String)
  expectedRegistryFingerprint!: string;

  @Field(() => SafeIntResolver)
  expectedRegistryId!: number;

  @Field(() => String)
  expectedRegistryUpdatedAt!: string;

  @Field(() => String)
  guardFingerprint!: string;

  @Field(() => String)
  idempotencyKey!: string;

  @Field(() => String)
  operationSetFingerprint!: string;

  @Field(() => String)
  previewFingerprint!: string;

  @Field(() => String)
  targetLocatorFingerprint!: string;

  @Field(() => [String])
  requiredInputs!: string[];

  @Field(() => String)
  submissionFingerprint!: string;
}

@InputType()
class CopilotPromptRegistryRepairExecutionRequestInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => CopilotPromptRegistryPublishGateExpectedVersionInput, {
    nullable: true,
  })
  expectedVersion?: CopilotPromptRegistryPublishGateExpectedVersionInput;

  @Field(() => CopilotPromptRegistryRepairSubmissionInput)
  submission!: CopilotPromptRegistryRepairSubmissionInput;

  @Field(() => String)
  expectedApprovalRecordFingerprint!: string;

  @Field(() => String)
  expectedApprovalRequestFingerprint!: string;

  @Field(() => String)
  expectedAuditEventFingerprint!: string;

  @Field(() => String)
  expectedCandidateEvidenceSetFingerprint!: string;

  @Field(() => String)
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprint!: string;

  @Field(() => String)
  expectedEmbeddingIndexContractEvidenceSetFingerprint!: string;

  @Field(() => String)
  expectedRerankRuntimeContractEvidenceSetFingerprint!: string;

  @Field(() => String)
  expectedPreparedRouteOrderEvidenceSetFingerprint!: string;

  @Field(() => String)
  expectedTargetLocatorFingerprint!: string;

  @Field(() => String)
  expectedRepairGateManifestFingerprint!: string;

  @Field(() => String)
  expectedRepairGateManifestExportPolicyFingerprint!: string;

  @Field(() => String)
  expectedRepairGateManifestRetentionPolicyFingerprint!: string;

  @Field(() => String)
  expectedExecutionGateFingerprint!: string;

  @Field(() => String)
  expectedExecutionGateStatus!: string;

  @Field(() => String)
  expectedExecutionStateFingerprint!: string;

  @Field(() => String)
  expectedIdempotencyFingerprint!: string;

  @Field(() => String)
  expectedPolicyBindingFingerprint!: string;

  @Field(() => String)
  expectedPreflightStatus!: string;

  @Field(() => String)
  expectedRepairJobFingerprint!: string;

  @Field(() => String)
  expectedReviewBindingFingerprint!: string;

  @Field(() => String)
  expectedRollbackPlanFingerprint!: string;
}

@InputType()
class CopilotPromptRegistryPublishInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => CopilotPromptRegistryPublishGateExpectedVersionInput, {
    nullable: true,
  })
  expectedVersion?: CopilotPromptRegistryPublishGateExpectedVersionInput;

  @Field(() => String, { nullable: true })
  revision?: string;

  @Field(() => String, { nullable: true })
  idempotencyKey?: string;

  @Field(() => String, { nullable: true })
  reviewNote?: string;
}

@InputType()
class CopilotPromptRegistryBodyEditPreviewInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => SafeIntResolver)
  messageIndex!: number;

  @Field(() => String)
  nextContent!: string;

  @Field(() => CopilotPromptRegistryPublishGateExpectedVersionInput, {
    nullable: true,
  })
  expectedVersion?: CopilotPromptRegistryPublishGateExpectedVersionInput;
}

@InputType()
class CopilotPromptRegistryBodyEditPublishInput extends CopilotPromptRegistryBodyEditPreviewInput {
  @Field(() => String)
  expectedPreviewFingerprint!: string;

  @Field(() => String, { nullable: true })
  idempotencyKey?: string;

  @Field(() => String, { nullable: true })
  reviewNote?: string;
}

@InputType()
class CopilotAgentRuntimeDocUpdateRequestInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => ID, { nullable: true })
  sessionId?: string;

  @Field(() => String)
  docId!: string;

  @Field(() => String)
  content!: string;

  @Field(() => String, { nullable: true })
  contentFingerprint?: string;

  @Field(() => String, { nullable: true })
  idempotencyKey?: string;

  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => String, { nullable: true })
  reason?: string;
}

@InputType()
class CopilotAgentRuntimeOfficeCommandRequestInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => GraphQLJSON)
  command!: unknown;

  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => String, { nullable: true })
  reason?: string;
}

@InputType()
class CopilotSupportBundleCreateInput {
  @Field(() => String)
  workspaceId!: string;
}

@InputType()
class CopilotSupportBundleDownloadAuthorizeInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  bundleId!: string;

  @Field(() => String, { nullable: true })
  artifactKind?: 'manifest_json' | 'archive_json';
}

@InputType()
class CopilotSupportBundleDirectDownloadAcknowledgeInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  authorizationId!: string;
}

@InputType()
class CopilotSupportBundleRetentionCleanupInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => SafeIntResolver, { nullable: true })
  limit?: number;
}

@InputType()
class CopilotSupportBundleTransferForwardingReplayInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  forwardingEventId!: string;

  @Field(() => SafeIntResolver, { nullable: true })
  maxAttempts?: number;
}

@InputType()
class CopilotSupportBundleListFilterInput implements CopilotSupportBundleListFilter {
  @Field(() => String, { nullable: true })
  query?: string;

  @Field(() => String, { nullable: true })
  retentionStatus?: CopilotSupportBundleListFilter['retentionStatus'];

  @Field(() => String, { nullable: true })
  status?: CopilotSupportBundleListFilter['status'];

  @Field(() => String, { nullable: true })
  transferForwardingStatus?: CopilotSupportBundleListFilter['transferForwardingStatus'];
}

@InputType()
class CopilotProviderRegistryPublishInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  providerId!: string;

  @Field(() => String, { nullable: true })
  revision?: string;

  @Field(() => String, { nullable: true })
  idempotencyKey?: string;

  @Field(() => String, { nullable: true })
  displayName?: string;

  @Field(() => Boolean, { nullable: true })
  enabled?: boolean;

  @Field(() => [String], { nullable: true })
  models?: string[];

  @Field(() => GraphQLJSON, { nullable: true })
  modelDefinitions?: CopilotModelDefinition[];

  @Field(() => String, { nullable: true })
  privacy?: CopilotProviderPrivacy;

  @Field(() => Number, { nullable: true })
  priority?: number;
}

@InputType()
class CopilotModelRegistryPublishInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  providerId!: string;

  @Field(() => String)
  modelId!: string;

  @Field(() => String, { nullable: true })
  revision?: string;

  @Field(() => String, { nullable: true })
  idempotencyKey?: string;

  @Field(() => GraphQLJSON)
  modelDefinition!: CopilotModelDefinition;
}

@InputType()
class CopilotTaskRoutePolicyPublishInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  featureKind!: TaskRoutePolicyFeatureKind;

  @Field(() => String)
  modelId!: string;

  @Field(() => String, { nullable: true })
  revision?: string;

  @Field(() => String, { nullable: true })
  idempotencyKey?: string;
}

@InputType()
class CopilotProviderHealthStateRecordInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  providerId!: string;

  @Field(() => String)
  status!: CopilotProviderHealthStatus;

  @Field(() => String, { nullable: true })
  lastError?: string;
}

@InputType()
class CopilotProviderHealthProbeAttemptRetryInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  attemptId!: string;
}

@InputType()
class CopilotProviderHealthProbeAttemptFilterInput implements CopilotProviderHealthProbeAttemptListFilter {
  @Field(() => String, { nullable: true })
  providerId?: string;

  @Field(() => String, { nullable: true })
  providerRegistryRevisionId?: string;

  @Field(() => String, { nullable: true })
  providerRegistryRevisionFingerprint?: string;

  @Field(() => String, { nullable: true })
  providerProfileFingerprint?: string;

  @Field(() => String, { nullable: true })
  query?: string;

  @Field(() => String, { nullable: true })
  requestFingerprint?: string;

  @Field(() => String, { nullable: true })
  resultFingerprint?: string;

  @Field(() => String, { nullable: true })
  status?: CopilotProviderHealthProbeAttemptListFilter['status'];
}

@InputType()
class CopilotRepairExecutionApprovalDecisionInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  executionRequestId!: string;

  @Field(() => String)
  decision!: 'approve' | 'reject';

  @Field(() => String, { nullable: true })
  reason?: string;
}

@InputType()
class CopilotRepairExecutionControlInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  executionRequestId!: string;

  @Field(() => String)
  action!: 'cancel' | 'retry' | 'recover_stale' | 'resume_with_payload';

  @Field(() => GraphQLJSON, { nullable: true })
  executorPayload?: Record<string, unknown>;

  @Field(() => String, { nullable: true })
  reason?: string;
}

@InputType()
class CopilotRepairExecutionListFilterInput implements CopilotRepairExecutionListFilter {
  @Field(() => String, { nullable: true })
  approvalState?: CopilotRepairExecutionListFilter['approvalState'];

  @Field(() => String, { nullable: true })
  promptName?: string;

  @Field(() => String, { nullable: true })
  query?: string;

  @Field(() => String, { nullable: true })
  requestedAction?: string;

  @Field(() => String, { nullable: true })
  status?: CopilotRepairExecutionListFilter['status'];
}

@InputType()
class CopilotAgentRuntimeControlInput {
  @Field(() => String, { nullable: true })
  expectedApprovalFingerprint?: string;
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  runId!: string;

  @Field(() => String)
  action!: 'approve' | 'cancel' | 'reject' | 'resume';

  @Field(() => String, { nullable: true })
  reason?: string;
}

@InputType()
class CopilotAgentRunListFilterInput implements CopilotAgentRunListFilter {
  @Field(() => String, { nullable: true })
  query?: string;

  @Field(() => String, { nullable: true })
  sourceId?: string;

  @Field(() => String, { nullable: true })
  sourceType?: string;

  @Field(() => String, { nullable: true })
  status?: CopilotAgentRunListFilter['status'];

  @Field(() => String, { nullable: true })
  workflow?: string;
}

@InputType()
class CopilotTaskListFilterInput {
  @Field(() => String, { nullable: true })
  query?: string;

  @Field(() => String, { nullable: true })
  status?: CopilotAgentRunListFilter['status'];
}

@InputType()
class CopilotTaskControlInput {
  @Field(() => String, { nullable: true })
  expectedApprovalFingerprint?: string;
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  taskId!: string;

  @Field(() => String)
  action!: 'abandon' | 'approve' | 'cancel' | 'reject' | 'resume';

  @Field(() => String, { nullable: true })
  reason?: string;
}

@InputType()
class CreateChatMessageInput implements Omit<SubmittedMessage, 'content'> {
  @Field(() => String)
  sessionId!: string;

  @Field(() => String, { nullable: true })
  content!: string | undefined;

  @Field(() => [String], { nullable: true, deprecationReason: 'use blobs' })
  attachments!: string[] | undefined;

  @Field(() => GraphQLUpload, { nullable: true })
  blob!: Promise<FileUpload> | undefined;

  @Field(() => [GraphQLUpload], { nullable: true })
  blobs!: Promise<FileUpload>[] | undefined;

  @Field(() => GraphQLJSON, { nullable: true })
  params!: Record<string, any> | undefined;
}

enum ChatHistoryOrder {
  asc = 'asc',
  desc = 'desc',
}

registerEnumType(ChatHistoryOrder, { name: 'ChatHistoryOrder' });

@InputType()
class QueryChatSessionsInput implements Partial<ListSessionOptions> {
  @Field(() => Boolean, { nullable: true })
  action: boolean | undefined;

  @Field(() => Boolean, { nullable: true })
  fork: boolean | undefined;

  @Field(() => Boolean, { nullable: true })
  pinned: boolean | undefined;

  @Field(() => Number, { nullable: true })
  limit: number | undefined;

  @Field(() => Number, { nullable: true })
  skip: number | undefined;
}

@InputType()
class QueryChatHistoriesInput
  extends QueryChatSessionsInput
  implements Partial<ListSessionOptions>
{
  @Field(() => ChatHistoryOrder, { nullable: true })
  messageOrder: 'asc' | 'desc' | undefined;

  @Field(() => ChatHistoryOrder, { nullable: true })
  sessionOrder: 'asc' | 'desc' | undefined;

  @Field(() => String, { nullable: true })
  sessionId: string | undefined;

  @Field(() => Boolean, { nullable: true })
  withMessages: boolean | undefined;

  @Field(() => Boolean, { nullable: true })
  withPrompt: boolean | undefined;
}

// ================== Return Types ==================

@ObjectType('StreamObject')
class StreamObjectType {
  @Field(() => String)
  type!: string;

  @Field(() => String, { nullable: true })
  textDelta?: string;

  @Field(() => String, { nullable: true })
  toolCallId?: string;

  @Field(() => String, { nullable: true })
  toolName?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  args?: any;

  @Field(() => GraphQLJSON, { nullable: true })
  result?: any;
}

@ObjectType('ChatMessage')
class ChatMessageType implements Partial<ChatMessage> {
  // id will be null if message is a prompt message
  @Field(() => ID, { nullable: true })
  id!: string | undefined;

  @Field(() => String)
  role!: 'system' | 'assistant' | 'user';

  @Field(() => String)
  content!: string;

  @Field(() => [StreamObjectType], { nullable: true })
  streamObjects!: StreamObject[];

  @Field(() => [String], { nullable: true })
  attachments!: string[];

  @Field(() => GraphQLJSON, { nullable: true })
  params!: Record<string, string> | undefined;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType('CopilotHistories')
class CopilotHistoriesType implements Omit<ChatHistory, 'userId'> {
  @Field(() => String)
  sessionId!: string;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => String, { nullable: true })
  docId!: string | null;

  @Field(() => String, { nullable: true })
  selectedContextProjectId!: string | null;

  @Field(() => String, { nullable: true })
  parentSessionId!: string | null;

  @Field(() => String)
  promptName!: string;

  @Field(() => String)
  model!: string;

  @Field(() => [String])
  optionalModels!: string[];

  @Field(() => String, {
    description: 'An mark identifying which view to use to display the session',
    nullable: true,
  })
  action!: string | null;

  @Field(() => Boolean)
  pinned!: boolean;

  @Field(() => String, { nullable: true })
  title!: string | null;

  @Field(() => Number, {
    description: 'The number of tokens used in the session',
  })
  tokens!: number;

  @Field(() => [ChatMessageType])
  messages!: ChatMessageType[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType()
export class PaginatedCopilotHistoriesType extends Paginated(
  CopilotHistoriesType
) {}

@ObjectType('CopilotQuota')
class CopilotQuotaType {
  @Field(() => SafeIntResolver, { nullable: true })
  limit?: number;

  @Field(() => SafeIntResolver)
  used!: number;
}

type CopilotModelSource =
  | 'default'
  | 'fallback_route'
  | 'prompt'
  | 'registry'
  | 'pro';

type CopilotModelPromptSource = {
  candidateSource: CopilotModelSource;
  modelConfigPath?: string;
  modelSource?: string;
};

type CopilotModelCandidate = {
  id: string;
  promptModelConfigPath?: string;
  promptModelSource?: string;
  promptModelSources: CopilotModelPromptSource[];
  sources: CopilotModelSource[];
};

type CopilotModelDefinitionSource =
  | 'db_revision'
  | 'native_registry'
  | 'provider_profile'
  | 'provider_runtime';

type CopilotModelRegistrySourceChainEntry = {
  source: string;
  scope: string;
  status: string;
  actorId?: string;
  fingerprint?: string;
  modelId?: string;
  providerId?: string;
  revision?: string;
  updatedAt?: string;
  workspaceId?: string;
};

type CopilotPromptRegistryValidationIssue = NonNullable<
  PromptCatalogItem['registryValidationIssues']
>[number];

type CopilotPromptRegistryValidationSourceLocator =
  CopilotPromptRegistryValidationIssue['sourceLocator'];

@ObjectType()
class CopilotPromptRegistryValidationSourceLocatorType implements CopilotPromptRegistryValidationSourceLocator {
  @Field(() => String)
  field!: CopilotPromptRegistryValidationSourceLocator['field'];

  @Field(() => SafeIntResolver, { nullable: true })
  messageIndex?: CopilotPromptRegistryValidationSourceLocator['messageIndex'];

  @Field(() => String)
  path!: CopilotPromptRegistryValidationSourceLocator['path'];

  @Field(() => String)
  registryFingerprint!: CopilotPromptRegistryValidationSourceLocator['registryFingerprint'];

  @Field(() => SafeIntResolver)
  registryId!: CopilotPromptRegistryValidationSourceLocator['registryId'];

  @Field(() => String)
  registryUpdatedAt!: CopilotPromptRegistryValidationSourceLocator['registryUpdatedAt'];

  @Field(() => String)
  table!: CopilotPromptRegistryValidationSourceLocator['table'];
}

@ObjectType()
class CopilotPromptRegistryValidationIssueType implements CopilotPromptRegistryValidationIssue {
  @Field(() => String)
  code!: CopilotPromptRegistryValidationIssue['code'];

  @Field(() => String)
  detail!: CopilotPromptRegistryValidationIssue['detail'];

  @Field(() => String)
  fieldLabel!: CopilotPromptRegistryValidationIssue['fieldLabel'];

  @Field(() => String, { nullable: true })
  message?: CopilotPromptRegistryValidationIssue['message'];

  @Field(() => SafeIntResolver, { nullable: true })
  messageIndex?: CopilotPromptRegistryValidationIssue['messageIndex'];

  @Field(() => String)
  path!: CopilotPromptRegistryValidationIssue['path'];

  @Field(() => Boolean)
  publishBlocking!: CopilotPromptRegistryValidationIssue['publishBlocking'];

  @Field(() => String)
  reason!: CopilotPromptRegistryValidationIssue['reason'];

  @Field(() => String)
  severity!: CopilotPromptRegistryValidationIssue['severity'];

  @Field(() => String)
  source!: CopilotPromptRegistryValidationIssue['source'];

  @Field(() => CopilotPromptRegistryValidationSourceLocatorType)
  sourceLocator!: CopilotPromptRegistryValidationIssue['sourceLocator'];
}

type CopilotPromptRegistryValidationRemediation = NonNullable<
  PromptCatalogItem['registryValidationRemediations']
>[number];

type CopilotPromptRegistryPublishGateModelRoute = {
  available: boolean;
  behaviorFlags?: string[];
  candidateCount: number;
  candidateConfigPath?: string;
  candidateIndex: number;
  candidateKind: string;
  canonicalModelKey?: string;
  checked: boolean;
  configured: boolean;
  diagnosticsErrorCode?: string;
  diagnosticsErrorMessage?: string;
  diagnosticsErrorStage?: string;
  effectiveSourceFingerprint?: string;
  effectiveSourceFingerprintInputs?: string[];
  effectiveSourceFingerprintVersion?: string;
  fallbackProviderIds: string[];
  featureKind: string;
  matchedCandidateCount: number;
  modelBackendKind?: string;
  modelId?: string;
  outputType: string;
  policyAllowedPrivacy?: string[];
  policyAllowedProviderIds?: string[];
  policyBlockedProviderIds?: string[];
  policyEnabled: boolean;
  policyFeatureKind?: string;
  policyPreferredPrivacy?: string[];
  policyWorkspaceId?: string;
  policyCandidates: CopilotPromptRegistryPublishGatePolicyCandidate[];
  protocol?: string;
  providerId?: string;
  providerConfiguredModelCount?: number;
  providerConfiguredModelIds?: string[];
  providerHealth?: CopilotProviderHealthStatus;
  providerHealthCheckedAt?: string;
  providerHealthLastError?: string;
  providerName?: string;
  providerPrivacy?: CopilotProviderPrivacy;
  providerPriority?: number;
  providerProfileConfigPath?: string;
  providerProfileId?: string;
  providerProfileSource?: string;
  providerSource?: string;
  providerType?: string;
  reasons: string[];
  requestedModelId?: string;
  requestedModelSource?: string;
  requestLayer?: string;
  routeModelAliasMatched?: boolean;
  routeModelDefinitionAliases?: string[];
  routeModelDefinitionId?: string;
  routeModelDefinitionSource?: CopilotModelDefinitionSource;
  modelRegistryRevision?: string;
  modelRegistryRevisionActorId?: string;
  modelRegistryRevisionFingerprint?: string;
  modelRegistryRevisionId?: string;
  modelRegistryRevisionScope?: string;
  modelRegistryRevisionSourceChain?: CopilotModelRegistrySourceChainEntry[];
  modelRegistryRevisionSourceChainFingerprint?: string;
  modelRegistryRevisionStatus?: string;
  modelRegistryRevisionWorkspaceId?: string;
  modelRegistryRevisionPublishEventCount?: number;
  modelRegistryRevisionPublishEvents?: RegistryRevisionPublishEventRecord[];
  routeRawModelId?: string;
  routeCandidates: CopilotPromptRegistryPublishGateRouteCandidate[];
  routeTrace: CopilotPromptRegistryPublishGateRouteTracePhase[];
};

type CopilotPromptRegistryPublishGatePolicyCandidate = {
  allowed: boolean;
  available: boolean;
  candidateFingerprint: string;
  candidateKey: string;
  health: string;
  healthCheckedAt?: string;
  privacy: string;
  providerId: string;
  providerConfiguredModelCount?: number;
  providerConfiguredModelIds?: string[];
  providerName?: string;
  providerPriority?: number;
  providerProfileConfigPath?: string;
  providerProfileId?: string;
  providerProfileSource?: string;
  providerSource?: string;
  providerType?: string;
  registryAvailable?: boolean;
  registryKind?: string;
  registrySelected?: boolean;
  reasons: string[];
};

type CopilotPromptRegistryPublishGateRouteCandidate = {
  candidateModelIds?: string[];
  costInputPer1M?: number;
  costOutputPer1M?: number;
  routeContextWindow?: number;
  routeMaxOutputTokens?: number;
  routeEmbeddingDimensions?: number;
  health?: string;
  healthCheckedAt?: string;
  matched: boolean;
  modelId?: string;
  privacy?: string;
  providerConfiguredModelCount?: number;
  providerConfiguredModelIds?: string[];
  providerId: string;
  providerName?: string;
  providerPriority?: number;
  providerProfileConfigPath?: string;
  providerProfileId?: string;
  providerProfileSource?: string;
  providerSource?: string;
  providerType?: string;
  reasons: string[];
  registryAvailable?: boolean;
  registryKind?: string;
  registrySelected?: boolean;
  requestedModelId?: string;
  routeModelAliasMatched?: boolean;
  routeModelDefinitionAliases?: string[];
  routeModelDefinitionId?: string;
  routeModelDefinitionSource?: CopilotModelDefinitionSource;
  modelRegistryRevision?: string;
  modelRegistryRevisionActorId?: string;
  modelRegistryRevisionFingerprint?: string;
  modelRegistryRevisionId?: string;
  modelRegistryRevisionScope?: string;
  modelRegistryRevisionSourceChain?: CopilotModelRegistrySourceChainEntry[];
  modelRegistryRevisionSourceChainFingerprint?: string;
  modelRegistryRevisionStatus?: string;
  modelRegistryRevisionWorkspaceId?: string;
  modelRegistryRevisionPublishEventCount?: number;
  modelRegistryRevisionPublishEvents?: RegistryRevisionPublishEventRecord[];
  routeRawModelId?: string;
  routeInputTypes?: string[];
  routeOutputTypes?: string[];
  routeAttachmentKinds?: string[];
  routeAttachmentSourceKinds?: string[];
  routeAttachmentAllowRemoteUrls?: boolean;
  routeStructuredAttachmentKinds?: string[];
  routeStructuredAttachmentSourceKinds?: string[];
  routeStructuredAttachmentAllowRemoteUrls?: boolean;
};

type CopilotPromptRegistryPublishGateRouteTracePhase = {
  availableCount?: number;
  blockedCount?: number;
  candidateCount: number;
  matchedCount?: number;
  phase: string;
  preparedCount?: number;
  reasons: string[];
  selectedCount?: number;
};

type CopilotPromptRegistryPublishGateTaskRoute =
  CopilotTaskRouteDiagnosticsType;

type CopilotTaskRoutePolicyCandidateWithKey =
  CopilotProviderEffectiveRoutePolicyCandidateDiagnostics & {
    candidateFingerprint: string;
    candidateKey: string;
  };

type CopilotTaskRouteDiagnosticsError = {
  code: string;
  message: string;
  stage: string;
};

type CopilotTaskRouteEffectiveSourceFingerprintInput = Pick<
  CopilotTaskRouteDiagnosticsType,
  | 'behaviorFlags'
  | 'candidateCount'
  | 'canonicalModelKey'
  | 'configured'
  | 'diagnosticsErrors'
  | 'dimensionMismatch'
  | 'embeddingIndexContractDimensions'
  | 'embeddingIndexContractFingerprint'
  | 'embeddingIndexContractStatus'
  | 'embeddingIndexContractVersion'
  | 'errorCode'
  | 'fallbackProviderIds'
  | 'featureKind'
  | 'modelBackendKind'
  | 'modelEmbeddingDimensions'
  | 'modelId'
  | 'policyAllowedPrivacy'
  | 'policyAllowedProviderIds'
  | 'policyBlockedProviderIds'
  | 'policyEnabled'
  | 'policyFeatureKind'
  | 'policyPreferredPrivacy'
  | 'policyWorkspaceId'
  | 'policyCandidates'
  | 'prepareCandidates'
  | 'preparedProviderCount'
  | 'preparedRouteTargetFingerprint'
  | 'preparedRouteTargets'
  | 'preparedRoutes'
  | 'protocol'
  | 'providerConfiguredModelCount'
  | 'providerConfiguredModelIds'
  | 'providerId'
  | 'providerPriority'
  | 'providerProfileConfigPath'
  | 'providerProfileId'
  | 'providerProfileSource'
  | 'providerSource'
  | 'providerType'
  | 'rerankRuntimeContractFingerprint'
  | 'rerankRuntimeContractStatus'
  | 'rerankRuntimeContractTopK'
  | 'rerankRuntimeContractVersion'
  | 'requestLayer'
  | 'requestedDimensions'
  | 'requestedModelConfigKey'
  | 'requestedModelConfigPath'
  | 'requestedModelId'
  | 'requestedModelSource'
  | 'routeCandidates'
  | 'routeTrace'
  | 'taskRoutePolicyRevision'
  | 'taskRoutePolicyRevisionActorId'
  | 'taskRoutePolicyRevisionFingerprint'
  | 'taskRoutePolicyRevisionId'
  | 'taskRoutePolicyRevisionScope'
  | 'taskRoutePolicyRevisionSourceChain'
  | 'taskRoutePolicyRevisionSourceChainFingerprint'
  | 'taskRoutePolicyRevisionStatus'
  | 'taskRoutePolicyRevisionWorkspaceId'
  | 'topK'
>;

const COPILOT_MODEL_LIST_EFFECTIVE_SOURCE_FINGERPRINT_VERSION =
  'copilot-model-list-effective-source/v1';
const COPILOT_MODEL_LIST_EFFECTIVE_SOURCE_FINGERPRINT_INPUTS = [
  'id',
  'promptAction',
  'promptCategory',
  'promptDefaultPolicy',
  'promptModelConfigPath',
  'promptModelSource',
  'promptModelSources',
  'promptName',
  'promptOverrideApplied',
  'promptSource',
  'providerConfiguredModelCount',
  'providerConfiguredModelIds',
  'providerId',
  'providerPrivacy',
  'providerPriority',
  'providerProfileConfigPath',
  'providerProfileId',
  'providerProfileSource',
  'providerSource',
  'providerType',
  'registryAvailable',
  'registryKind',
  'registrySelected',
  'routeBackendKind',
  'routeCanonicalModelKey',
  'routeFallbackProviderIds',
  'routeModelAliasMatched',
  'routeModelDefinitionAliases',
  'routeModelDefinitionId',
  'routeModelDefinitionSource',
  'modelRegistryRevision',
  'modelRegistryRevisionActorId',
  'modelRegistryRevisionFingerprint',
  'modelRegistryRevisionId',
  'modelRegistryRevisionScope',
  'modelRegistryRevisionSourceChain',
  'modelRegistryRevisionSourceChainFingerprint',
  'modelRegistryRevisionStatus',
  'modelRegistryRevisionWorkspaceId',
  'routeModelId',
  'routePolicyAllowedPrivacy',
  'routePolicyAllowedProviderIds',
  'routePolicyBlockedProviderIds',
  'routePolicyEnabled',
  'routePolicyFeatureKind',
  'routePolicyPreferredPrivacy',
  'routePolicyWorkspaceId',
  'routeRawModelId',
  'sources',
] as const;
const PROMPT_REGISTRY_PUBLISH_GATE_MODEL_ROUTE_EFFECTIVE_SOURCE_FINGERPRINT_VERSION =
  'prompt-registry-publish-gate-model-route-effective-source/v1';
const PROMPT_REGISTRY_PUBLISH_GATE_MODEL_ROUTE_EFFECTIVE_SOURCE_FINGERPRINT_INPUTS =
  [
    'candidateConfigPath',
    'candidateIndex',
    'candidateKind',
    'configured',
    'fallbackProviderIds',
    'featureKind',
    'modelId',
    'outputType',
    'policyAllowedPrivacy',
    'policyAllowedProviderIds',
    'policyBlockedProviderIds',
    'policyCandidates',
    'policyEnabled',
    'policyFeatureKind',
    'policyPreferredPrivacy',
    'policyWorkspaceId',
    'providerConfiguredModelCount',
    'providerConfiguredModelIds',
    'providerId',
    'providerPrivacy',
    'providerPriority',
    'providerProfileConfigPath',
    'providerProfileId',
    'providerProfileSource',
    'providerSource',
    'providerType',
    'requestedModelId',
    'requestedModelSource',
    'routeCandidates',
    'routeModelAliasMatched',
    'routeModelDefinitionAliases',
    'routeModelDefinitionId',
    'routeModelDefinitionSource',
    'modelRegistryRevision',
    'modelRegistryRevisionActorId',
    'modelRegistryRevisionFingerprint',
    'modelRegistryRevisionId',
    'modelRegistryRevisionScope',
    'modelRegistryRevisionSourceChain',
    'modelRegistryRevisionSourceChainFingerprint',
    'modelRegistryRevisionStatus',
    'modelRegistryRevisionWorkspaceId',
    'routeRawModelId',
  ] as const;
const COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_FINGERPRINT_VERSION =
  'copilot-task-route-effective-source/v1';
const COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_FINGERPRINT_INPUTS = [
  'behaviorFlags',
  'candidateCount',
  'canonicalModelKey',
  'configured',
  'diagnosticsErrors',
  'dimensionMismatch',
  'embeddingIndexContractDimensions',
  'embeddingIndexContractFingerprint',
  'embeddingIndexContractStatus',
  'embeddingIndexContractVersion',
  'errorCode',
  'fallbackProviderIds',
  'featureKind',
  'modelBackendKind',
  'modelEmbeddingDimensions',
  'modelId',
  'policyAllowedPrivacy',
  'policyAllowedProviderIds',
  'policyBlockedProviderIds',
  'policyCandidates',
  'policyEnabled',
  'policyFeatureKind',
  'policyPreferredPrivacy',
  'policyWorkspaceId',
  'prepareCandidates',
  'preparedProviderCount',
  'preparedRouteOrder',
  'preparedRouteTargetFingerprint',
  'preparedRouteTargets',
  'preparedRoutes',
  'protocol',
  'providerConfiguredModelCount',
  'providerConfiguredModelIds',
  'providerId',
  'providerPriority',
  'providerProfileConfigPath',
  'providerProfileId',
  'providerProfileSource',
  'providerSource',
  'providerType',
  'rerankRuntimeContractFingerprint',
  'rerankRuntimeContractStatus',
  'rerankRuntimeContractTopK',
  'rerankRuntimeContractVersion',
  'requestedDimensions',
  'requestedModelConfigKey',
  'requestedModelConfigPath',
  'requestedModelId',
  'requestedModelSource',
  'requestLayer',
  'routeCandidates',
  'routeTrace',
  'taskRoutePolicyRevision',
  'taskRoutePolicyRevisionActorId',
  'taskRoutePolicyRevisionFingerprint',
  'taskRoutePolicyRevisionId',
  'taskRoutePolicyRevisionScope',
  'taskRoutePolicyRevisionSourceChain',
  'taskRoutePolicyRevisionSourceChainFingerprint',
  'taskRoutePolicyRevisionStatus',
  'taskRoutePolicyRevisionWorkspaceId',
  'topK',
] as const;
const COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_EVIDENCE_SET_FINGERPRINT_VERSION =
  'copilot-task-route-effective-source-evidence-set/v1';
const COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_EVIDENCE_SET_FINGERPRINT_INPUTS = [
  'diagnosticsFingerprint',
  'operationFingerprint',
  'taskRouteEffectiveSourceFingerprints',
] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_VERSION =
  'prompt-registry-repair-candidate-evidence-reference/v1';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_FIELDS =
  [
    'candidateEvidenceCategory',
    'candidateEvidenceFingerprint',
    'candidateEvidenceKey',
    'candidateEvidenceProviderId',
    'candidateEvidenceScope',
    'candidateIndex',
    'preparedRouteOrderFingerprint',
    'preparedRouteEntries',
    'policyCandidateEntries',
    'prepareCandidateEntries',
    'routeCandidateEntries',
    'taskRouteEffectiveSourceFingerprint',
    'taskRouteModelSourceSnapshotEntries',
    'taskRouteModelSourceSnapshotFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_FINGERPRINT_INPUTS =
  [
    'candidateEvidenceReferenceSchemaFields',
    'candidateEvidenceReferenceSchemaVersion',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_REGISTRY_STATUS =
  'not_persisted_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_STATUS =
  'not_created_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_FINGERPRINT_INPUTS =
  [
    'artifactStatus',
    'registryStatus',
    'schemaFingerprint',
    'schemaVersion',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STATUS =
  'not_created_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_FINGERPRINT_INPUTS =
  [
    'artifactFingerprint',
    'artifactStatus',
    'recordStatus',
    'schemaFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_PERSISTENCE_STATUS =
  'not_persisted_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_PERSISTENCE_FINGERPRINT_INPUTS =
  [
    'persistenceStatus',
    'recordFingerprint',
    'recordStatus',
    'schemaFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_STATUS =
  'not_allocated_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_FINGERPRINT_INPUTS =
  [
    'recordFingerprint',
    'recordStatus',
    'schemaFingerprint',
    'storageStatus',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_BACKEND_STATUS =
  'not_selected_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_BACKEND_FINGERPRINT_INPUTS =
  [
    'backendStatus',
    'schemaFingerprint',
    'storageFingerprint',
    'storageStatus',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_STATUS =
  'not_materialized_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_FINGERPRINT_INPUTS =
  [
    'backendFingerprint',
    'objectStatus',
    'schemaFingerprint',
    'storageFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_STATUS =
  'not_included_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_FINGERPRINT_INPUTS =
  [
    'archiveInclusionStatus',
    'objectFingerprint',
    'objectStatus',
    'schemaFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_STATUS =
  'not_created_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_FINGERPRINT_INPUTS =
  [
    'archiveInclusionFingerprint',
    'manifestEntryStatus',
    'objectFingerprint',
    'schemaFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_STATUS =
  'not_persisted_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_FINGERPRINT_INPUTS =
  [
    'manifestEntryFingerprint',
    'manifestEntryPersistenceStatus',
    'manifestEntryStatus',
    'schemaFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STATUS =
  'not_created_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_FINGERPRINT_INPUTS =
  [
    'manifestEntryPersistenceFingerprint',
    'manifestEntryPersistenceRecordStatus',
    'manifestEntryPersistenceStatus',
    'schemaFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_STATUS =
  'not_allocated_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_FINGERPRINT_INPUTS =
  [
    'persistenceRecordFingerprint',
    'persistenceRecordStatus',
    'schemaFingerprint',
    'storageStatus',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_BACKEND_STATUS =
  'not_selected_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_BACKEND_FINGERPRINT_INPUTS =
  [
    'backendStatus',
    'schemaFingerprint',
    'storageFingerprint',
    'storageStatus',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_STATUS =
  'not_materialized_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_FINGERPRINT_INPUTS =
  [
    'backendFingerprint',
    'objectStatus',
    'schemaFingerprint',
    'storageFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_STATUS =
  'not_included_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_FINGERPRINT_INPUTS =
  [
    'archiveInclusionStatus',
    'objectFingerprint',
    'objectStatus',
    'schemaFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_STATUS =
  'not_created_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_FINGERPRINT_INPUTS =
  [
    'archiveInclusionFingerprint',
    'manifestEntryStatus',
    'objectFingerprint',
    'schemaFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_STATUS =
  'not_persisted_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_FINGERPRINT_INPUTS =
  [
    'manifestEntryFingerprint',
    'manifestEntryPersistenceStatus',
    'manifestEntryStatus',
    'schemaFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STATUS =
  'not_created_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_FINGERPRINT_INPUTS =
  [
    'manifestEntryPersistenceFingerprint',
    'manifestEntryPersistenceRecordStatus',
    'manifestEntryPersistenceStatus',
    'schemaFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_STATUS =
  'not_allocated_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_FINGERPRINT_INPUTS =
  [
    'persistenceRecordFingerprint',
    'persistenceRecordStatus',
    'schemaFingerprint',
    'storageStatus',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_BACKEND_STATUS =
  'not_selected_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_BACKEND_FINGERPRINT_INPUTS =
  [
    'backendStatus',
    'schemaFingerprint',
    'storageFingerprint',
    'storageStatus',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_STATUS =
  'not_materialized_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_FINGERPRINT_INPUTS =
  [
    'backendFingerprint',
    'objectStatus',
    'schemaFingerprint',
    'storageFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_STATUS =
  'not_included_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_FINGERPRINT_INPUTS =
  [
    'archiveInclusionStatus',
    'objectFingerprint',
    'objectStatus',
    'schemaFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_STATUS =
  'not_created_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_FINGERPRINT_INPUTS =
  [
    'archiveInclusionFingerprint',
    'manifestEntryStatus',
    'objectFingerprint',
    'schemaFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_STATUS =
  'not_persisted_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_FINGERPRINT_INPUTS =
  [
    'manifestEntryFingerprint',
    'manifestEntryPersistenceStatus',
    'manifestEntryStatus',
    'schemaFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STATUS =
  'not_created_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_FINGERPRINT_INPUTS =
  [
    'manifestEntryPersistenceFingerprint',
    'manifestEntryPersistenceRecordStatus',
    'manifestEntryPersistenceStatus',
    'schemaFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_STATUS =
  'not_allocated_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_FINGERPRINT_INPUTS =
  [
    'persistenceRecordFingerprint',
    'persistenceRecordStatus',
    'schemaFingerprint',
    'storageStatus',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_BACKEND_STATUS =
  'not_selected_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_BACKEND_FINGERPRINT_INPUTS =
  [
    'backendStatus',
    'schemaFingerprint',
    'storageFingerprint',
    'storageStatus',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_STATUS =
  'not_materialized_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_FINGERPRINT_INPUTS =
  [
    'backendFingerprint',
    'objectStatus',
    'schemaFingerprint',
    'storageFingerprint',
  ] as const;
const COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_STATUS =
  'not_included_read_only';
const COPILOT_PROMPT_REGISTRY_REPAIR_ACTION_CATALOG_VERSION =
  'repair-actions/v1';

type CopilotPromptRegistryPublishGateRepairCandidateEvidence = {
  allowed?: boolean;
  available?: boolean;
  candidateFingerprint: string;
  candidateIndex: number;
  candidateKey?: string;
  candidateModelIds?: string[];
  costInputPer1M?: number;
  costOutputPer1M?: number;
  diagnosticsErrors?: CopilotTaskRouteDiagnosticsError[];
  diagnosticsErrorSnapshotFingerprint?: string;
  dimensionMismatch?: boolean;
  embeddingIndexContractDimensions?: number;
  embeddingIndexContractFingerprint?: string;
  embeddingIndexContractStatus?: string;
  embeddingIndexContractVersion?: string;
  errorCategory?: string;
  errorCode?: string;
  fallbackProviderIds?: string[];
  health?: string;
  healthCheckedAt?: string;
  matched?: boolean;
  modelEmbeddingDimensions?: number;
  modelId?: string;
  modelRegistryRevision?: string;
  modelRegistryRevisionActorId?: string;
  modelRegistryRevisionFingerprint?: string;
  modelRegistryRevisionId?: string;
  modelRegistryRevisionPublishEventCount?: number;
  modelRegistryRevisionPublishEvents?: RegistryRevisionPublishEventRecord[];
  modelRegistryRevisionScope?: string;
  modelRegistryRevisionSourceChain?: CopilotModelRegistrySourceChainEntry[];
  modelRegistryRevisionSourceChainFingerprint?: string;
  modelRegistryRevisionStatus?: string;
  modelRegistryRevisionWorkspaceId?: string;
  prepared?: boolean;
  preparedModelId?: string;
  prepareCandidateSnapshotFingerprint?: string;
  prepareCandidates?: CopilotTaskRoutePrepareCandidateDiagnosticsType[];
  preparedRouteOrderFingerprint?: string;
  preparedRouteSnapshotFingerprint?: string;
  preparedRoutes?: CopilotPreparedTaskRouteDiagnosticsType[];
  providerCapabilitySnapshotFingerprint?: string;
  providerCostSnapshotFingerprint?: string;
  providerHealthSnapshotFingerprint?: string;
  providerLimitSnapshotFingerprint?: string;
  rerankRuntimeContractFingerprint?: string;
  rerankRuntimeContractStatus?: string;
  rerankRuntimeContractTopK?: number;
  rerankRuntimeContractVersion?: string;
  taskRouteEmbeddingIndexContractSnapshotFingerprint?: string;
  taskRouteRerankRuntimeContractSnapshotFingerprint?: string;
  taskRouteDimensionSnapshotFingerprint?: string;
  taskRouteEffectiveSourceFingerprint?: string;
  taskRouteEffectiveSourceFingerprintInputs?: string[];
  taskRouteEffectiveSourceFingerprintVersion?: string;
  taskRouteModelSourceSnapshotEntries?: CopilotPromptRegistryRepairTaskRouteModelSourceSnapshotEntry[];
  taskRouteModelSourceSnapshotFingerprint?: string;
  preparedRouteTargets?: string[];
  preparedRouteTargetFingerprint?: string;
  policyCandidates?: CopilotPromptRegistryPublishGatePolicyCandidate[];
  policyCandidateSnapshotFingerprint?: string;
  privacy?: string;
  providerConfiguredModelCount?: number;
  providerConfiguredModelIds?: string[];
  providerId: string;
  providerName?: string;
  providerPriority?: number;
  providerProfileConfigPath?: string;
  providerProfileId?: string;
  providerProfileSource?: string;
  providerSource?: string;
  providerType?: string;
  reasons: string[];
  registryAvailable?: boolean;
  registryKind?: string;
  registrySelected?: boolean;
  requestedModelConfigKey?: string;
  requestedModelConfigPath?: string;
  requestedDimensions?: number;
  requestedModelId?: string;
  requestedModelSource?: string;
  routeAttachmentAllowRemoteUrls?: boolean;
  routeAttachmentKinds?: string[];
  routeAttachmentSourceKinds?: string[];
  routeCandidates?: CopilotPromptRegistryPublishGateRouteCandidate[];
  routeCandidateSnapshotFingerprint?: string;
  routeContextWindow?: number;
  routeEmbeddingDimensions?: number;
  routeInputTypes?: string[];
  routeMaxOutputTokens?: number;
  routeModelAliasMatched?: boolean;
  routeModelDefinitionAliases?: string[];
  routeModelDefinitionId?: string;
  routeModelDefinitionSource?: CopilotModelDefinitionSource;
  routeOutputTypes?: string[];
  routeRawModelId?: string;
  routeStructuredAttachmentAllowRemoteUrls?: boolean;
  routeStructuredAttachmentKinds?: string[];
  routeStructuredAttachmentSourceKinds?: string[];
  routeTrace?: CopilotPromptRegistryPublishGateRouteTracePhase[];
  routeTracePhases?: string[];
  routeTraceSnapshotFingerprint?: string;
  scope: string;
};

type CopilotPromptRegistryRepairTaskRouteModelSourceSnapshotEntry = {
  featureKind: string;
  requestedModelConfigKey?: string;
  requestedModelConfigPath?: string;
  requestedModelId?: string;
  requestedModelSource?: string;
};

type CopilotPromptRegistryPublishGateRepairRecommendation = {
  candidateEvidence?: CopilotPromptRegistryPublishGateRepairCandidateEvidence[];
  category: string;
  code: string;
  detail: string;
  diagnosticsFingerprint: string;
  evidence: string[];
  instanceKey?: string;
  severity: string;
  suggestedAction: string;
  suggestedActionCatalogVersion: string;
  suggestedActionInputSchema: Record<string, unknown>;
  suggestedActionKind: string;
  suggestedActionRequiredCapabilities: string[];
  suggestedActionSafety: string;
  target: string;
  targetLocator?: CopilotPromptRegistryPublishGateRepairTargetLocator;
  title: string;
};

type CopilotPromptRegistryPublishGateRepairActionCatalogEntry = {
  actionKind: string;
  catalogVersion: string;
  inputSchema: Record<string, unknown>;
  recommendationCount: number;
  requiredCapabilities: string[];
  safety: string;
};

type CopilotPromptRegistryPublishGateRepairActionMutationGuard = {
  auditSummary: string;
  auditSummaryFingerprint: string;
  catalogFingerprint: string;
  catalogVersion: string;
  expectedRegistryFingerprint: string;
  expectedRegistryId: number;
  expectedRegistryUpdatedAt: string;
  guardFingerprint: string;
  intentFingerprint: string;
  inputSchemaFingerprint: string;
  recommendationCategories: string[];
  recommendationCount: number;
  recommendationCodes: string[];
  recommendationFingerprints: string[];
  requiredCapabilities: string[];
  requiredReviewModes: string[];
  required: boolean;
  safetyLevels: string[];
  suggestedActionKinds: string[];
  targetLocatorCount: number;
  targetLocatorFingerprint: string;
  targetLocatorKinds: string[];
};

type CopilotPromptRegistryRepairCandidateEvidenceReferenceEntry = {
  candidateEvidenceCategory?: string;
  candidateEvidenceFingerprint: string;
  candidateEvidenceKey?: string;
  candidateEvidenceProviderId: string;
  candidateEvidenceScope: string;
  candidateIndex: number;
  preparedRouteOrderFingerprint?: string;
  preparedRouteEntries?: CopilotPreparedTaskRouteDiagnosticsType[];
  policyCandidateEntries?: CopilotPromptRegistryPublishGatePolicyCandidate[];
  prepareCandidateEntries?: CopilotTaskRoutePrepareCandidateDiagnosticsType[];
  routeCandidateEntries?: CopilotPromptRegistryPublishGateRouteCandidate[];
  taskRouteEffectiveSourceFingerprint?: string;
  taskRouteModelSourceSnapshotEntries?: CopilotPromptRegistryRepairTaskRouteModelSourceSnapshotEntry[];
  taskRouteModelSourceSnapshotFingerprint?: string;
};

type CopilotPromptRegistryPublishGateRepairActionPreviewOperation = {
  actionKind: string;
  candidateEvidenceCount: number;
  candidateEvidenceEntries: CopilotPromptRegistryRepairCandidateEvidenceReferenceEntry[];
  candidateEvidenceFingerprint: string;
  candidateEvidenceFingerprints: string[];
  candidateEvidenceKeys: string[];
  category: string;
  code: string;
  diagnosticsFingerprint: string;
  embeddingIndexContractEvidenceFingerprints: string[];
  rerankRuntimeContractEvidenceFingerprints: string[];
  taskRouteEffectiveSourceFingerprints: string[];
  inputSchema: Record<string, unknown>;
  instanceKey?: string;
  operationFingerprint: string;
  preparedRouteOrderFingerprints: string[];
  previewStatus: string;
  requiredCapabilities: string[];
  reviewMode: string;
  safety: string;
  target: string;
  targetLocator?: CopilotPromptRegistryPublishGateRepairTargetLocator;
  targetLocatorFingerprint: string;
};

type CopilotPromptRegistryPublishGateRepairActionSubmissionContract = {
  approvalPolicyFingerprint: string;
  authorizationFingerprint: string;
  candidateEvidenceSetFingerprint: string;
  taskRouteEffectiveSourceEvidenceSetFingerprint: string;
  taskRouteEffectiveSourceEvidenceSetFingerprintInputs: string[];
  taskRouteEffectiveSourceEvidenceSetFingerprintVersion: string;
  embeddingIndexContractEvidenceSetFingerprint: string;
  rerankRuntimeContractEvidenceSetFingerprint: string;
  preparedRouteOrderEvidenceSetFingerprint: string;
  catalogFingerprint: string;
  contractVersion: string;
  expectedRegistryFingerprint: string;
  expectedRegistryId: number;
  expectedRegistryUpdatedAt: string;
  guardFingerprint: string;
  idempotencyKey: string;
  mutationAvailable: boolean;
  operationSetFingerprint: string;
  previewFingerprint: string;
  readOnly: boolean;
  requiredInputs: string[];
  status: string;
  submissionFingerprint: string;
  targetLocatorFingerprint: string;
};

type CopilotPromptRegistryPublishGateRepairGateManifest = {
  version: string;
  boundary: string;
  fingerprint: string;
  registryFingerprint: string;
  registryId: number;
  registryUpdatedAt: string;
  gateStatus: string;
  publishStatus: string;
  reason: string;
  issueCount: number;
  blockingCount: number;
  recommendationCount: number;
  operationCount: number;
  guardFingerprint: string;
  previewFingerprint: string;
  submissionFingerprint: string;
  candidateEvidenceSetFingerprint: string;
  taskRouteEffectiveSourceEvidenceSetFingerprint: string;
  taskRouteEffectiveSourceEvidenceSetFingerprintInputs: string[];
  taskRouteEffectiveSourceEvidenceSetFingerprintVersion: string;
  embeddingIndexContractEvidenceSetFingerprint: string;
  rerankRuntimeContractEvidenceSetFingerprint: string;
  preparedRouteOrderEvidenceSetFingerprint: string;
  operationSetFingerprint: string;
  targetLocatorFingerprint: string;
  approvalPolicyFingerprint: string;
  authorizationFingerprint: string;
  catalogFingerprint: string;
  catalogVersion: string;
  readOnly: boolean;
  mutationAvailable: boolean;
  requiredCapabilities: string[];
  requiredReviewModes: string[];
  safetyLevels: string[];
  operationFingerprints: string[];
  recommendationFingerprints: string[];
};

type CopilotPromptRegistryPublishGateRepairGateManifestExportMetadata = {
  version: string;
  artifact: string;
  filename: string;
  mime: string;
  metadataFilename: string;
  manifestVersion: string;
  manifestFingerprint: string;
  registryFingerprint: string;
  registryId: number;
  registryUpdatedAt: string;
  gateStatus: string;
  publishStatus: string;
  boundary: string;
  redactionPolicyVersion: string;
  redactionPolicyStatus: string;
  redactionPolicyFingerprint: string;
  exportPolicyVersion: string;
  exportPolicyStatus: string;
  exportPolicyFingerprint: string;
  auditEventVersion: string;
  auditEventStatus: string;
  auditEventCreated: boolean;
  auditEventFingerprint: string;
  retentionPolicyVersion: string;
  retentionPolicyStatus: string;
  retentionPolicyFingerprint: string;
};

type CopilotPromptRegistryRepairPreflight = {
  accepted: boolean;
  actorFingerprint: string;
  actorSnapshotInputs: string[];
  actorSnapshotStatus: string;
  actorSnapshotVersion: string;
  actorType: string;
  approvalCheckpoints: string[];
  approvalModes: string[];
  approvalRecordCreated: boolean;
  approvalRecordFingerprint: string;
  approvalRecordInputs: string[];
  approvalRecordStatus: string;
  approvalRecordVersion: string;
  approvalRequestFingerprint: string;
  approvalRequestInputs: string[];
  approvalRequestStatus: string;
  approvalRequestVersion: string;
  approvalRequired: boolean;
  auditBindingFingerprint: string;
  auditBindingInputs: string[];
  auditBindingStatus: string;
  auditBindingVersion: string;
  auditEventCreated: boolean;
  auditEventFingerprint: string;
  auditEventInputs: string[];
  auditEventStatus: string;
  auditEventVersion: string;
  authorizationStatus: string;
  candidateEvidenceSetFingerprint: string;
  taskRouteEffectiveSourceEvidenceSetFingerprint: string;
  taskRouteEffectiveSourceEvidenceSetFingerprintInputs: string[];
  taskRouteEffectiveSourceEvidenceSetFingerprintVersion: string;
  embeddingIndexContractEvidenceSetFingerprint: string;
  rerankRuntimeContractEvidenceSetFingerprint: string;
  preparedRouteOrderEvidenceSetFingerprint: string;
  capabilityCheckMode: string;
  capabilityFingerprint: string;
  capabilitySource: string;
  capabilityStatus: string;
  contractVersion: string;
  currentSubmissionFingerprint: string;
  expectedSubmissionFingerprint: string;
  executionGateFingerprint: string;
  executionGateInputs: string[];
  executionGateStatus: string;
  executionGateVersion: string;
  executionStateCreated: boolean;
  executionStateFingerprint: string;
  executionStateInputs: string[];
  executionStateStatus: string;
  executionStateVersion: string;
  expectedCandidateEvidenceSetFingerprint: string;
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprint: string;
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs: string[];
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion: string;
  expectedEmbeddingIndexContractEvidenceSetFingerprint: string;
  expectedRerankRuntimeContractEvidenceSetFingerprint: string;
  expectedPreparedRouteOrderEvidenceSetFingerprint: string;
  expectedTargetLocatorFingerprint: string;
  targetLocatorFingerprint: string;
  idempotencyFingerprint: string;
  idempotencyKey: string;
  idempotencyLockAcquired: boolean;
  idempotencyScope: string;
  idempotencyStatus: string;
  idempotencyVersion: string;
  matchedFields: string[];
  mismatchedFields: string[];
  mutationAvailable: boolean;
  permissionCheckMode: string;
  permissionChecked: boolean;
  permissionFingerprint: string;
  permissionScope: string;
  permissionStatus: string;
  policyBindingFingerprint: string;
  policyBindingInputs: string[];
  policyBindingStatus: string;
  policyBindingVersion: string;
  policySource: string;
  requiredCapabilities: string[];
  requiredCapabilityCount: number;
  requiredPermission: string;
  repairJobCreated: boolean;
  repairJobFingerprint: string;
  repairJobInputs: string[];
  repairJobStatus: string;
  repairJobVersion: string;
  reviewBindingFingerprint: string;
  reviewBindingInputs: string[];
  reviewBindingStatus: string;
  reviewBindingVersion: string;
  rollbackPlanCreated: boolean;
  rollbackPlanFingerprint: string;
  rollbackPlanInputs: string[];
  rollbackPlanStatus: string;
  rollbackPlanVersion: string;
  readOnly: boolean;
  status: string;
  workspaceId?: string;
};

type CopilotPromptRegistryRepairExecutionRequestSourceEvidenceEntry = {
  candidateEvidenceCategoryCount: number;
  candidateEvidenceCategories: string[];
  candidateEvidenceCount: number;
  candidateEvidenceEntries: CopilotPromptRegistryRepairCandidateEvidenceReferenceEntry[];
  candidateEvidenceReferenceSchemaArtifactFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordPersistenceStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageBackendStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprint: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStorageStatus: string;
  candidateEvidenceReferenceSchemaArtifactRecordStatus: string;
  candidateEvidenceReferenceSchemaArtifactStatus: string;
  candidateEvidenceReferenceSchemaFields: string[];
  candidateEvidenceReferenceSchemaFingerprint: string;
  candidateEvidenceReferenceSchemaFingerprintInputs: string[];
  candidateEvidenceReferenceSchemaRegistryStatus: string;
  candidateEvidenceReferenceSchemaVersion: string;
  candidateEvidenceFingerprint: string;
  candidateEvidenceFingerprints: string[];
  candidateEvidenceKeys: string[];
  candidateEvidenceProviderIds: string[];
  candidateEvidenceScopes: string[];
  diagnosticsFingerprint: string;
  operationFingerprint: string;
  taskRouteEffectiveSourceFingerprints: string[];
};

type CopilotPromptRegistryRepairExecutionRequest = {
  accepted: boolean;
  executionRequested: boolean;
  executionRecord?:
    | (CopilotRepairExecutionRecord & {
        agentRun?: CopilotAgentRunRecord | null;
      })
    | null;
  expectedCandidateEvidenceSetFingerprint: string;
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprint: string;
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs: string[];
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion: string;
  expectedEmbeddingIndexContractEvidenceSetFingerprint: string;
  expectedRerankRuntimeContractEvidenceSetFingerprint: string;
  expectedPreparedRouteOrderEvidenceSetFingerprint: string;
  expectedTargetLocatorFingerprint: string;
  expectedRepairGateManifestFingerprint: string;
  expectedRepairGateManifestExportPolicyFingerprint: string;
  expectedRepairGateManifestRetentionPolicyFingerprint: string;
  approvalRecordRequestCreated: boolean;
  approvalRecordRequestFingerprint: string;
  approvalRecordRequestInputs: string[];
  approvalRecordRequestStatus: string;
  approvalRecordRequestVersion: string;
  auditEventRequestCreated: boolean;
  auditEventRequestFingerprint: string;
  auditEventRequestInputs: string[];
  auditEventRequestStatus: string;
  auditEventRequestVersion: string;
  executionCompletionEventRequestCreated: boolean;
  executionCompletionEventRequestFingerprint: string;
  executionCompletionEventRequestInputs: string[];
  executionCompletionEventRequestStatus: string;
  executionCompletionEventRequestVersion: string;
  executionCompletionRequestCreated: boolean;
  executionCompletionRequestFingerprint: string;
  executionCompletionRequestInputs: string[];
  executionCompletionRequestStatus: string;
  executionCompletionRequestVersion: string;
  executionFinalizationEventRequestCreated: boolean;
  executionFinalizationEventRequestFingerprint: string;
  executionFinalizationEventRequestInputs: string[];
  executionFinalizationEventRequestStatus: string;
  executionFinalizationEventRequestVersion: string;
  executionFinalizationRequestCreated: boolean;
  executionFinalizationRequestFingerprint: string;
  executionFinalizationRequestInputs: string[];
  executionFinalizationRequestStatus: string;
  executionFinalizationRequestVersion: string;
  executionStatusPollRequestCreated: boolean;
  executionStatusPollRequestFingerprint: string;
  executionStatusPollRequestInputs: string[];
  executionStatusPollRequestStatus: string;
  executionStatusPollRequestVersion: string;
  executionOperationEntryRequestCreated: boolean;
  executionOperationEntryRequestFingerprint: string;
  executionOperationEntryRequestInputs: string[];
  executionOperationEntryRequestStatus: string;
  executionOperationEntryRequestVersion: string;
  executionApprovalUiRequestCreated: boolean;
  executionApprovalUiRequestFingerprint: string;
  executionApprovalUiRequestInputs: string[];
  executionApprovalUiRequestStatus: string;
  executionApprovalUiRequestVersion: string;
  executionDiffPreviewRequestCreated: boolean;
  executionDiffPreviewRequestFingerprint: string;
  executionDiffPreviewRequestInputs: string[];
  executionDiffPreviewRequestStatus: string;
  executionDiffPreviewRequestVersion: string;
  executionApprovalDecisionRequestCreated: boolean;
  executionApprovalDecisionRequestFingerprint: string;
  executionApprovalDecisionRequestInputs: string[];
  executionApprovalDecisionRequestStatus: string;
  executionApprovalDecisionRequestVersion: string;
  executionStartRequestCreated: boolean;
  executionStartRequestFingerprint: string;
  executionStartRequestInputs: string[];
  executionStartRequestStatus: string;
  executionStartRequestVersion: string;
  executionQueueRequestCreated: boolean;
  executionQueueRequestFingerprint: string;
  executionQueueRequestInputs: string[];
  executionQueueRequestStatus: string;
  executionQueueRequestVersion: string;
  executionWorkerLeaseRequestCreated: boolean;
  executionWorkerLeaseRequestFingerprint: string;
  executionWorkerLeaseRequestInputs: string[];
  executionWorkerLeaseRequestStatus: string;
  executionWorkerLeaseRequestVersion: string;
  executionJobRunRequestCreated: boolean;
  executionJobRunRequestFingerprint: string;
  executionJobRunRequestInputs: string[];
  executionJobRunRequestStatus: string;
  executionJobRunRequestVersion: string;
  executionRunStepRequestCreated: boolean;
  executionRunStepRequestFingerprint: string;
  executionRunStepRequestInputs: string[];
  executionRunStepRequestStatus: string;
  executionRunStepRequestVersion: string;
  executionRunStepTraceRequestCreated: boolean;
  executionRunStepTraceRequestFingerprint: string;
  executionRunStepTraceRequestInputs: string[];
  executionRunStepTraceRequestStatus: string;
  executionRunStepTraceRequestVersion: string;
  executionRunStepResultRequestCreated: boolean;
  executionRunStepResultRequestFingerprint: string;
  executionRunStepResultRequestInputs: string[];
  executionRunStepResultRequestStatus: string;
  executionRunStepResultRequestVersion: string;
  executionRunStepCompletionRequestCreated: boolean;
  executionRunStepCompletionRequestFingerprint: string;
  executionRunStepCompletionRequestInputs: string[];
  executionRunStepCompletionRequestStatus: string;
  executionRunStepCompletionRequestVersion: string;
  executionRunStepStatusEventRequestCreated: boolean;
  executionRunStepStatusEventRequestFingerprint: string;
  executionRunStepStatusEventRequestInputs: string[];
  executionRunStepStatusEventRequestStatus: string;
  executionRunStepStatusEventRequestVersion: string;
  executionRunStepRetryRequestCreated: boolean;
  executionRunStepRetryRequestFingerprint: string;
  executionRunStepRetryRequestInputs: string[];
  executionRunStepRetryRequestStatus: string;
  executionRunStepRetryRequestVersion: string;
  executionRunStepRetryAttemptRequestCreated: boolean;
  executionRunStepRetryAttemptRequestFingerprint: string;
  executionRunStepRetryAttemptRequestInputs: string[];
  executionRunStepRetryAttemptRequestStatus: string;
  executionRunStepRetryAttemptRequestVersion: string;
  executionRunStepRetryAttemptStatusEventRequestCreated: boolean;
  executionRunStepRetryAttemptStatusEventRequestFingerprint: string;
  executionRunStepRetryAttemptStatusEventRequestInputs: string[];
  executionRunStepRetryAttemptStatusEventRequestStatus: string;
  executionRunStepRetryAttemptStatusEventRequestVersion: string;
  executionRunStepRetryAttemptTraceRequestCreated: boolean;
  executionRunStepRetryAttemptTraceRequestFingerprint: string;
  executionRunStepRetryAttemptTraceRequestInputs: string[];
  executionRunStepRetryAttemptTraceRequestStatus: string;
  executionRunStepRetryAttemptTraceRequestVersion: string;
  executionRunStepRetryAttemptResultRequestCreated: boolean;
  executionRunStepRetryAttemptResultRequestFingerprint: string;
  executionRunStepRetryAttemptResultRequestInputs: string[];
  executionRunStepRetryAttemptResultRequestStatus: string;
  executionRunStepRetryAttemptResultRequestVersion: string;
  executionRunStepRetryAttemptCompletionRequestCreated: boolean;
  executionRunStepRetryAttemptCompletionRequestFingerprint: string;
  executionRunStepRetryAttemptCompletionRequestInputs: string[];
  executionRunStepRetryAttemptCompletionRequestStatus: string;
  executionRunStepRetryAttemptCompletionRequestVersion: string;
  executionRunStepRetryAttemptCompletionStatusEventRequestCreated: boolean;
  executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint: string;
  executionRunStepRetryAttemptCompletionStatusEventRequestInputs: string[];
  executionRunStepRetryAttemptCompletionStatusEventRequestStatus: string;
  executionRunStepRetryAttemptCompletionStatusEventRequestVersion: string;
  executionRunStepRetryAttemptFinalizationRequestCreated: boolean;
  executionRunStepRetryAttemptFinalizationRequestFingerprint: string;
  executionRunStepRetryAttemptFinalizationRequestInputs: string[];
  executionRunStepRetryAttemptFinalizationRequestStatus: string;
  executionRunStepRetryAttemptFinalizationRequestVersion: string;
  executionRunStepRetryAttemptFinalizationStatusEventRequestCreated: boolean;
  executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint: string;
  executionRunStepRetryAttemptFinalizationStatusEventRequestInputs: string[];
  executionRunStepRetryAttemptFinalizationStatusEventRequestStatus: string;
  executionRunStepRetryAttemptFinalizationStatusEventRequestVersion: string;
  executionRunStepRetryAttemptCloseRequestCreated: boolean;
  executionRunStepRetryAttemptCloseRequestFingerprint: string;
  executionRunStepRetryAttemptCloseRequestInputs: string[];
  executionRunStepRetryAttemptCloseRequestStatus: string;
  executionRunStepRetryAttemptCloseRequestVersion: string;
  executionRunStepRetryAttemptCloseStatusEventRequestCreated: boolean;
  executionRunStepRetryAttemptCloseStatusEventRequestFingerprint: string;
  executionRunStepRetryAttemptCloseStatusEventRequestInputs: string[];
  executionRunStepRetryAttemptCloseStatusEventRequestStatus: string;
  executionRunStepRetryAttemptCloseStatusEventRequestVersion: string;
  executionRunStepRetryAttemptRetentionPolicyRequestCreated: boolean;
  executionRunStepRetryAttemptRetentionPolicyRequestFingerprint: string;
  executionRunStepRetryAttemptRetentionPolicyRequestInputs: string[];
  executionRunStepRetryAttemptRetentionPolicyRequestStatus: string;
  executionRunStepRetryAttemptRetentionPolicyRequestVersion: string;
  executionRunStepRetryAttemptRetentionPolicyRuleRequestCreated: boolean;
  executionRunStepRetryAttemptRetentionPolicyRuleRequestFingerprint: string;
  executionRunStepRetryAttemptRetentionPolicyRuleRequestInputs: string[];
  executionRunStepRetryAttemptRetentionPolicyRuleRequestStatus: string;
  executionRunStepRetryAttemptRetentionPolicyRuleRequestVersion: string;
  executionRunStepRetryAttemptRetentionLeaseRequestCreated: boolean;
  executionRunStepRetryAttemptRetentionLeaseRequestFingerprint: string;
  executionRunStepRetryAttemptRetentionLeaseRequestInputs: string[];
  executionRunStepRetryAttemptRetentionLeaseRequestStatus: string;
  executionRunStepRetryAttemptRetentionLeaseRequestVersion: string;
  executionRunStepRetryAttemptArchiveRequestCreated: boolean;
  executionRunStepRetryAttemptArchiveRequestFingerprint: string;
  executionRunStepRetryAttemptArchiveRequestInputs: string[];
  executionRunStepRetryAttemptArchiveRequestStatus: string;
  executionRunStepRetryAttemptArchiveRequestVersion: string;
  executionFailureEventRequestCreated: boolean;
  executionFailureEventRequestFingerprint: string;
  executionFailureEventRequestInputs: string[];
  executionFailureEventRequestStatus: string;
  executionFailureEventRequestVersion: string;
  executionProviderResponseRequestCreated: boolean;
  executionProviderResponseRequestFingerprint: string;
  executionProviderResponseRequestInputs: string[];
  executionProviderResponseRequestStatus: string;
  executionProviderResponseRequestVersion: string;
  executionResultRequestCreated: boolean;
  executionResultRequestFingerprint: string;
  executionResultRequestInputs: string[];
  executionResultRequestStatus: string;
  executionResultRequestVersion: string;
  executionRetryPolicyRequestCreated: boolean;
  executionRetryPolicyRequestFingerprint: string;
  executionRetryPolicyRequestInputs: string[];
  executionRetryPolicyRequestStatus: string;
  executionRetryPolicyRequestVersion: string;
  executionRollbackExecutorRequestCreated: boolean;
  executionRollbackExecutorRequestFingerprint: string;
  executionRollbackExecutorRequestInputs: string[];
  executionRollbackExecutorRequestStatus: string;
  executionRollbackExecutorRequestVersion: string;
  executionRollbackOperationRequestCreated: boolean;
  executionRollbackOperationRequestFingerprint: string;
  executionRollbackOperationRequestInputs: string[];
  executionRollbackOperationRequestStatus: string;
  executionRollbackOperationRequestVersion: string;
  executionRollbackOutcomeRequestCreated: boolean;
  executionRollbackOutcomeRequestFingerprint: string;
  executionRollbackOutcomeRequestInputs: string[];
  executionRollbackOutcomeRequestStatus: string;
  executionRollbackOutcomeRequestVersion: string;
  executionRollbackTriggerRequestCreated: boolean;
  executionRollbackTriggerRequestFingerprint: string;
  executionRollbackTriggerRequestInputs: string[];
  executionRollbackTriggerRequestStatus: string;
  executionRollbackTriggerRequestVersion: string;
  executionTraceRequestCreated: boolean;
  executionTraceRequestFingerprint: string;
  executionTraceRequestInputs: string[];
  executionTraceRequestStatus: string;
  executionTraceRequestVersion: string;
  executionStateRequestCreated: boolean;
  executionStateRequestFingerprint: string;
  executionStateRequestInputs: string[];
  executionStateRequestStatus: string;
  executionStateRequestVersion: string;
  idempotencyLockAcquired: boolean;
  idempotencyLockFingerprint: string;
  idempotencyLockInputs: string[];
  idempotencyLockScope: string;
  idempotencyLockStatus: string;
  idempotencyLockVersion: string;
  matchedFields: string[];
  mismatchedFields: string[];
  mutationAvailable: boolean;
  preflight: CopilotPromptRegistryRepairPreflight;
  readOnly: boolean;
  repairJobRequestCreated: boolean;
  repairJobRequestFingerprint: string;
  repairJobRequestInputs: string[];
  repairJobRequestStatus: string;
  repairJobRequestVersion: string;
  rollbackPlanRequestCreated: boolean;
  rollbackPlanRequestFingerprint: string;
  rollbackPlanRequestInputs: string[];
  rollbackPlanRequestStatus: string;
  rollbackPlanRequestVersion: string;
  requestFingerprint: string;
  requestInputs: string[];
  requestStatus: string;
  requestVersion: string;
  supportBundleArtifactCreated: boolean;
  supportBundleArtifactFingerprint: string;
  supportBundleArtifactInputs: string[];
  supportBundleArtifactRecordRequestCreated: boolean;
  supportBundleArtifactRecordRequestFingerprint: string;
  supportBundleArtifactRecordRequestInputs: string[];
  supportBundleArtifactRecordRequestStatus: string;
  supportBundleArtifactRecordRequestVersion: string;
  supportBundleArtifactStatus: string;
  supportBundleArtifactVersion: string;
  supportBundleArchiveFormat: string;
  supportBundleArchiveRequestCreated: boolean;
  supportBundleArchiveRequestFingerprint: string;
  supportBundleArchiveRequestInputs: string[];
  supportBundleArchiveRequestStatus: string;
  supportBundleArchiveRequestVersion: string;
  supportBundleArchiveScope: string;
  supportBundleArchiveSignaturePolicy: string;
  supportBundleArchiveSignatureRequestCreated: boolean;
  supportBundleArchiveSignatureRequestFingerprint: string;
  supportBundleArchiveSignatureRequestInputs: string[];
  supportBundleArchiveSignatureRequestStatus: string;
  supportBundleArchiveSignatureRequestVersion: string;
  supportBundleAuditPersistenceRequestCreated: boolean;
  supportBundleAuditPersistenceRequestFingerprint: string;
  supportBundleAuditPersistenceRequestInputs: string[];
  supportBundleAuditPersistenceRequestStatus: string;
  supportBundleAuditPersistenceRequestVersion: string;
  supportBundleAuditPersistenceStatus: string;
  supportBundleDownloadAuthorizationRequestCreated: boolean;
  supportBundleDownloadAuthorizationRequestFingerprint: string;
  supportBundleDownloadAuthorizationRequestInputs: string[];
  supportBundleDownloadAuthorizationRequestStatus: string;
  supportBundleDownloadAuthorizationRequestVersion: string;
  supportBundleDownloadAuthorizationStatus: string;
  supportBundleDownloadResolverRequestCreated: boolean;
  supportBundleDownloadResolverRequestFingerprint: string;
  supportBundleDownloadResolverRequestInputs: string[];
  supportBundleDownloadResolverRequestStatus: string;
  supportBundleDownloadResolverRequestVersion: string;
  supportBundleDownloadResolverRoute: string;
  supportBundleManifestFilename: string;
  supportBundleManifestFingerprint: string;
  supportBundleManifestMetadataFilename: string;
  supportBundleManifestMetadataFingerprint: string;
  supportBundlePackageCreated: boolean;
  supportBundlePackageFingerprint: string;
  supportBundlePackageInputs: string[];
  supportBundlePackageStatus: string;
  supportBundlePackageVersion: string;
  supportBundleRetentionCleanupRequestCreated: boolean;
  supportBundleRetentionCleanupRequestFingerprint: string;
  supportBundleRetentionCleanupRequestInputs: string[];
  supportBundleRetentionCleanupRequestStatus: string;
  supportBundleRetentionCleanupRequestVersion: string;
  supportBundleRetentionCleanupStatus: string;
  supportBundleSignedUrlPolicy: string;
  supportBundleSignedUrlRequestCreated: boolean;
  supportBundleSignedUrlRequestFingerprint: string;
  supportBundleSignedUrlRequestInputs: string[];
  supportBundleSignedUrlRequestStatus: string;
  supportBundleSignedUrlRequestVersion: string;
  supportBundleSignedUrlScope: string;
  supportBundleStorageKeyRequestCreated: boolean;
  supportBundleStorageKeyRequestFingerprint: string;
  supportBundleStorageKeyRequestInputs: string[];
  supportBundleStorageKeyRequestStatus: string;
  supportBundleStorageKeyRequestVersion: string;
  supportBundleStorageKeyScope: string;
  supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprint: string;
  supportBundleTaskRouteEffectiveSourceEvidenceSetDiagnosticsFingerprints: string[];
  supportBundleTaskRouteEffectiveSourceEvidenceSetEntries: CopilotPromptRegistryRepairExecutionRequestSourceEvidenceEntry[];
  supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprintInputs: string[];
  supportBundleTaskRouteEffectiveSourceEvidenceSetOperationFingerprints: string[];
  supportBundleTaskRouteEffectiveSourceEvidenceSetSourceFingerprints: string[];
  supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprintVersion: string;
};

type CopilotPromptRegistryPublishGateRepairActionPreview = {
  approvalCheckpoints: string[];
  approvalModes: string[];
  approvalPolicyFingerprint: string;
  approvalPolicyVersion: string;
  approvalRequired: boolean;
  auditSummaryFingerprint: string;
  authorizationFingerprint: string;
  authorizationStatus: string;
  candidateCount: number;
  candidateEvidenceSetFingerprint: string;
  taskRouteEffectiveSourceEvidenceSetFingerprint: string;
  taskRouteEffectiveSourceEvidenceSetFingerprintInputs: string[];
  taskRouteEffectiveSourceEvidenceSetFingerprintVersion: string;
  embeddingIndexContractEvidenceSetFingerprint: string;
  rerankRuntimeContractEvidenceSetFingerprint: string;
  preparedRouteOrderEvidenceSetFingerprint: string;
  catalogFingerprint: string;
  catalogVersion: string;
  guardFingerprint: string;
  operationFingerprints: string[];
  operationSetFingerprint: string;
  operations: CopilotPromptRegistryPublishGateRepairActionPreviewOperation[];
  previewFingerprint: string;
  readOnly: boolean;
  requiredCapabilities: string[];
  status: string;
  submissionContract: CopilotPromptRegistryPublishGateRepairActionSubmissionContract;
};

type CopilotPromptRegistryPublishGateRepairTargetLocator = {
  actionId?: string;
  candidateIndex?: number;
  candidateKind?: string;
  fallbackOrderIndex?: number;
  featureKind?: string;
  kind: string;
  outputType?: string;
  path: string;
  providerId?: string;
  providerProfileConfigPath?: string;
  providerProfileId?: string;
  providerProfileSource?: string;
  registryFingerprint: string;
  registryId: number;
  registryUpdatedAt: string;
  requestedModelConfigKey?: string;
  requestedModelConfigPath?: string;
  requestedModelId?: string;
  requestedModelSource?: string;
  routeIndex?: number;
  status?: string;
  stepId?: string;
};

type CopilotPromptRegistryPublishGateActionRouteDryRunRoute = {
  fallbackOrderIndex?: number;
  modelId: string;
  protocol?: string;
  providerConfiguredModelCount?: number;
  providerConfiguredModelIds?: string[];
  providerHealth?: string;
  providerHealthCheckedAt?: string;
  providerHealthLastError?: string;
  providerId: string;
  providerName?: string;
  providerPrivacy?: string;
  providerPriority?: number;
  providerProfileConfigPath?: string;
  providerProfileId?: string;
  providerProfileSource?: string;
  providerSource?: string;
  providerType?: string;
  requestLayer?: string;
  routeIndex: number;
  routeModelAliasMatched?: boolean;
  routeModelDefinitionAliases?: string[];
  routeModelDefinitionId?: string;
  routeModelDefinitionSource?: string;
  routeRawModelId?: string;
};

type CopilotPromptRegistryPublishGateActionRouteDryRunStep = {
  actualRouteCount: number;
  fallbackProviderIds: string[];
  kind: CopilotActionRunPreparedRouteTrace['steps'][number]['kind'];
  requestedModelId?: string;
  requestedModelSource?: string;
  routeCount: number;
  routeCountMismatch: boolean;
  routes: CopilotPromptRegistryPublishGateActionRouteDryRunRoute[];
  stepId: string;
};

type CopilotPromptRegistryPublishGateActionRouteDryRun = {
  actionId?: string;
  actualRouteCount: number;
  diagnosticsErrorCode?: string;
  diagnosticsErrorMessage?: string;
  diagnosticsErrorStage?: string;
  errorCode?: string;
  errorMessage?: string;
  expectedRouteCount: number;
  featureKind: string;
  missingRouteCount: number;
  routeCountMismatch: boolean;
  routeCountMismatchStepIds: string[];
  status: 'failed' | 'skipped' | 'succeeded';
  steps: CopilotPromptRegistryPublishGateActionRouteDryRunStep[];
};

type CopilotPromptRegistryPublishGateActionRouteDryRunPrompt = Pick<
  ResolvedPrompt,
  'category' | 'defaultPolicy' | 'model' | 'modelSource' | 'name'
> &
  Partial<Pick<ResolvedPrompt, 'action' | 'config' | 'messages'>>;

@ObjectType()
class CopilotPromptRegistryPublishGateModelRouteType implements CopilotPromptRegistryPublishGateModelRoute {
  @Field(() => Boolean)
  available!: CopilotPromptRegistryPublishGateModelRoute['available'];

  @Field(() => [String], { nullable: true })
  behaviorFlags?: CopilotPromptRegistryPublishGateModelRoute['behaviorFlags'];

  @Field(() => SafeIntResolver)
  candidateCount!: CopilotPromptRegistryPublishGateModelRoute['candidateCount'];

  @Field(() => String, { nullable: true })
  candidateConfigPath?: CopilotPromptRegistryPublishGateModelRoute['candidateConfigPath'];

  @Field(() => SafeIntResolver)
  candidateIndex!: CopilotPromptRegistryPublishGateModelRoute['candidateIndex'];

  @Field(() => String)
  candidateKind!: CopilotPromptRegistryPublishGateModelRoute['candidateKind'];

  @Field(() => String, { nullable: true })
  canonicalModelKey?: CopilotPromptRegistryPublishGateModelRoute['canonicalModelKey'];

  @Field(() => Boolean)
  checked!: CopilotPromptRegistryPublishGateModelRoute['checked'];

  @Field(() => Boolean)
  configured!: CopilotPromptRegistryPublishGateModelRoute['configured'];

  @Field(() => String, { nullable: true })
  diagnosticsErrorCode?: CopilotPromptRegistryPublishGateModelRoute['diagnosticsErrorCode'];

  @Field(() => String, { nullable: true })
  diagnosticsErrorMessage?: CopilotPromptRegistryPublishGateModelRoute['diagnosticsErrorMessage'];

  @Field(() => String, { nullable: true })
  diagnosticsErrorStage?: CopilotPromptRegistryPublishGateModelRoute['diagnosticsErrorStage'];

  @Field(() => String, { nullable: true })
  effectiveSourceFingerprint?: CopilotPromptRegistryPublishGateModelRoute['effectiveSourceFingerprint'];

  @Field(() => [String], { nullable: true })
  effectiveSourceFingerprintInputs?: CopilotPromptRegistryPublishGateModelRoute['effectiveSourceFingerprintInputs'];

  @Field(() => String, { nullable: true })
  effectiveSourceFingerprintVersion?: CopilotPromptRegistryPublishGateModelRoute['effectiveSourceFingerprintVersion'];

  @Field(() => [String])
  fallbackProviderIds!: CopilotPromptRegistryPublishGateModelRoute['fallbackProviderIds'];

  @Field(() => String)
  featureKind!: CopilotPromptRegistryPublishGateModelRoute['featureKind'];

  @Field(() => SafeIntResolver)
  matchedCandidateCount!: CopilotPromptRegistryPublishGateModelRoute['matchedCandidateCount'];

  @Field(() => String, { nullable: true })
  modelBackendKind?: CopilotPromptRegistryPublishGateModelRoute['modelBackendKind'];

  @Field(() => String, { nullable: true })
  modelId?: CopilotPromptRegistryPublishGateModelRoute['modelId'];

  @Field(() => String)
  outputType!: CopilotPromptRegistryPublishGateModelRoute['outputType'];

  @Field(() => [String], { nullable: true })
  policyAllowedPrivacy?: CopilotPromptRegistryPublishGateModelRoute['policyAllowedPrivacy'];

  @Field(() => [String], { nullable: true })
  policyAllowedProviderIds?: CopilotPromptRegistryPublishGateModelRoute['policyAllowedProviderIds'];

  @Field(() => [String], { nullable: true })
  policyBlockedProviderIds?: CopilotPromptRegistryPublishGateModelRoute['policyBlockedProviderIds'];

  @Field(() => Boolean)
  policyEnabled!: CopilotPromptRegistryPublishGateModelRoute['policyEnabled'];

  @Field(() => String, { nullable: true })
  policyFeatureKind?: CopilotPromptRegistryPublishGateModelRoute['policyFeatureKind'];

  @Field(() => [String], { nullable: true })
  policyPreferredPrivacy?: CopilotPromptRegistryPublishGateModelRoute['policyPreferredPrivacy'];

  @Field(() => String, { nullable: true })
  policyWorkspaceId?: CopilotPromptRegistryPublishGateModelRoute['policyWorkspaceId'];

  @Field(() => [CopilotPromptRegistryPublishGatePolicyCandidateType])
  policyCandidates!: CopilotPromptRegistryPublishGateModelRoute['policyCandidates'];

  @Field(() => String, { nullable: true })
  protocol?: CopilotPromptRegistryPublishGateModelRoute['protocol'];

  @Field(() => String, { nullable: true })
  providerId?: CopilotPromptRegistryPublishGateModelRoute['providerId'];

  @Field(() => SafeIntResolver, { nullable: true })
  providerConfiguredModelCount?: CopilotPromptRegistryPublishGateModelRoute['providerConfiguredModelCount'];

  @Field(() => [String], { nullable: true })
  providerConfiguredModelIds?: CopilotPromptRegistryPublishGateModelRoute['providerConfiguredModelIds'];

  @Field(() => String, { nullable: true })
  providerHealth?: CopilotPromptRegistryPublishGateModelRoute['providerHealth'];

  @Field(() => String, { nullable: true })
  providerHealthCheckedAt?: CopilotPromptRegistryPublishGateModelRoute['providerHealthCheckedAt'];

  @Field(() => String, { nullable: true })
  providerHealthLastError?: CopilotPromptRegistryPublishGateModelRoute['providerHealthLastError'];

  @Field(() => String, { nullable: true })
  providerName?: CopilotPromptRegistryPublishGateModelRoute['providerName'];

  @Field(() => String, { nullable: true })
  providerPrivacy?: CopilotPromptRegistryPublishGateModelRoute['providerPrivacy'];

  @Field(() => SafeIntResolver, { nullable: true })
  providerPriority?: CopilotPromptRegistryPublishGateModelRoute['providerPriority'];

  @Field(() => String, { nullable: true })
  providerProfileConfigPath?: CopilotPromptRegistryPublishGateModelRoute['providerProfileConfigPath'];

  @Field(() => String, { nullable: true })
  providerProfileId?: CopilotPromptRegistryPublishGateModelRoute['providerProfileId'];

  @Field(() => String, { nullable: true })
  providerProfileSource?: CopilotPromptRegistryPublishGateModelRoute['providerProfileSource'];

  @Field(() => String, { nullable: true })
  providerSource?: CopilotPromptRegistryPublishGateModelRoute['providerSource'];

  @Field(() => String, { nullable: true })
  providerType?: CopilotPromptRegistryPublishGateModelRoute['providerType'];

  @Field(() => [String])
  reasons!: CopilotPromptRegistryPublishGateModelRoute['reasons'];

  @Field(() => String, { nullable: true })
  requestedModelId?: CopilotPromptRegistryPublishGateModelRoute['requestedModelId'];

  @Field(() => String, { nullable: true })
  requestedModelSource?: CopilotPromptRegistryPublishGateModelRoute['requestedModelSource'];

  @Field(() => String, { nullable: true })
  requestLayer?: CopilotPromptRegistryPublishGateModelRoute['requestLayer'];

  @Field(() => Boolean, { nullable: true })
  routeModelAliasMatched?: CopilotPromptRegistryPublishGateModelRoute['routeModelAliasMatched'];

  @Field(() => [String], { nullable: true })
  routeModelDefinitionAliases?: CopilotPromptRegistryPublishGateModelRoute['routeModelDefinitionAliases'];

  @Field(() => String, { nullable: true })
  routeModelDefinitionId?: CopilotPromptRegistryPublishGateModelRoute['routeModelDefinitionId'];

  @Field(() => String, { nullable: true })
  routeModelDefinitionSource?: CopilotPromptRegistryPublishGateModelRoute['routeModelDefinitionSource'];

  @Field(() => String, { nullable: true })
  modelRegistryRevision?: CopilotPromptRegistryPublishGateModelRoute['modelRegistryRevision'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionActorId?: CopilotPromptRegistryPublishGateModelRoute['modelRegistryRevisionActorId'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionFingerprint?: CopilotPromptRegistryPublishGateModelRoute['modelRegistryRevisionFingerprint'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionId?: CopilotPromptRegistryPublishGateModelRoute['modelRegistryRevisionId'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionScope?: CopilotPromptRegistryPublishGateModelRoute['modelRegistryRevisionScope'];

  @Field(() => [CopilotModelRegistrySourceChainEntryType], { nullable: true })
  modelRegistryRevisionSourceChain?: CopilotPromptRegistryPublishGateModelRoute['modelRegistryRevisionSourceChain'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionSourceChainFingerprint?: CopilotPromptRegistryPublishGateModelRoute['modelRegistryRevisionSourceChainFingerprint'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionStatus?: CopilotPromptRegistryPublishGateModelRoute['modelRegistryRevisionStatus'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionWorkspaceId?: CopilotPromptRegistryPublishGateModelRoute['modelRegistryRevisionWorkspaceId'];

  @Field(() => String, { nullable: true })
  routeRawModelId?: CopilotPromptRegistryPublishGateModelRoute['routeRawModelId'];

  @Field(() => [CopilotPromptRegistryPublishGateRouteCandidateType])
  routeCandidates!: CopilotPromptRegistryPublishGateModelRoute['routeCandidates'];

  @Field(() => [CopilotPromptRegistryPublishGateRouteTracePhaseType])
  routeTrace!: CopilotPromptRegistryPublishGateModelRoute['routeTrace'];
}

@ObjectType()
class CopilotPromptRegistryPublishGatePolicyCandidateType implements CopilotPromptRegistryPublishGatePolicyCandidate {
  @Field(() => Boolean)
  allowed!: CopilotPromptRegistryPublishGatePolicyCandidate['allowed'];

  @Field(() => Boolean)
  available!: CopilotPromptRegistryPublishGatePolicyCandidate['available'];

  @Field(() => String)
  candidateFingerprint!: CopilotPromptRegistryPublishGatePolicyCandidate['candidateFingerprint'];

  @Field(() => String)
  candidateKey!: CopilotPromptRegistryPublishGatePolicyCandidate['candidateKey'];

  @Field(() => String)
  health!: CopilotPromptRegistryPublishGatePolicyCandidate['health'];

  @Field(() => String, { nullable: true })
  healthCheckedAt?: CopilotPromptRegistryPublishGatePolicyCandidate['healthCheckedAt'];

  @Field(() => String)
  privacy!: CopilotPromptRegistryPublishGatePolicyCandidate['privacy'];

  @Field(() => String)
  providerId!: CopilotPromptRegistryPublishGatePolicyCandidate['providerId'];

  @Field(() => SafeIntResolver, { nullable: true })
  providerConfiguredModelCount?: CopilotPromptRegistryPublishGatePolicyCandidate['providerConfiguredModelCount'];

  @Field(() => [String], { nullable: true })
  providerConfiguredModelIds?: CopilotPromptRegistryPublishGatePolicyCandidate['providerConfiguredModelIds'];

  @Field(() => String, { nullable: true })
  providerName?: CopilotPromptRegistryPublishGatePolicyCandidate['providerName'];

  @Field(() => SafeIntResolver, { nullable: true })
  providerPriority?: CopilotPromptRegistryPublishGatePolicyCandidate['providerPriority'];

  @Field(() => String, { nullable: true })
  providerProfileConfigPath?: CopilotPromptRegistryPublishGatePolicyCandidate['providerProfileConfigPath'];

  @Field(() => String, { nullable: true })
  providerProfileId?: CopilotPromptRegistryPublishGatePolicyCandidate['providerProfileId'];

  @Field(() => String, { nullable: true })
  providerProfileSource?: CopilotPromptRegistryPublishGatePolicyCandidate['providerProfileSource'];

  @Field(() => String, { nullable: true })
  providerSource?: CopilotPromptRegistryPublishGatePolicyCandidate['providerSource'];

  @Field(() => String, { nullable: true })
  providerType?: CopilotPromptRegistryPublishGatePolicyCandidate['providerType'];

  @Field(() => Boolean, { nullable: true })
  registryAvailable?: CopilotPromptRegistryPublishGatePolicyCandidate['registryAvailable'];

  @Field(() => String, { nullable: true })
  registryKind?: CopilotPromptRegistryPublishGatePolicyCandidate['registryKind'];

  @Field(() => Boolean, { nullable: true })
  registrySelected?: CopilotPromptRegistryPublishGatePolicyCandidate['registrySelected'];

  @Field(() => [String])
  reasons!: CopilotPromptRegistryPublishGatePolicyCandidate['reasons'];
}

@ObjectType()
class CopilotPromptRegistryPublishGateRouteTracePhaseType implements CopilotPromptRegistryPublishGateRouteTracePhase {
  @Field(() => SafeIntResolver, { nullable: true })
  availableCount?: CopilotPromptRegistryPublishGateRouteTracePhase['availableCount'];

  @Field(() => SafeIntResolver, { nullable: true })
  blockedCount?: CopilotPromptRegistryPublishGateRouteTracePhase['blockedCount'];

  @Field(() => SafeIntResolver)
  candidateCount!: CopilotPromptRegistryPublishGateRouteTracePhase['candidateCount'];

  @Field(() => SafeIntResolver, { nullable: true })
  matchedCount?: CopilotPromptRegistryPublishGateRouteTracePhase['matchedCount'];

  @Field(() => String)
  phase!: CopilotPromptRegistryPublishGateRouteTracePhase['phase'];

  @Field(() => SafeIntResolver, { nullable: true })
  preparedCount?: CopilotPromptRegistryPublishGateRouteTracePhase['preparedCount'];

  @Field(() => [String])
  reasons!: CopilotPromptRegistryPublishGateRouteTracePhase['reasons'];

  @Field(() => SafeIntResolver, { nullable: true })
  selectedCount?: CopilotPromptRegistryPublishGateRouteTracePhase['selectedCount'];
}

@ObjectType()
class CopilotPromptRegistryPublishGateRouteCandidateType implements CopilotPromptRegistryPublishGateRouteCandidate {
  @Field(() => [String], { nullable: true })
  candidateModelIds?: CopilotPromptRegistryPublishGateRouteCandidate['candidateModelIds'];

  @Field(() => Number, { nullable: true })
  costInputPer1M?: CopilotPromptRegistryPublishGateRouteCandidate['costInputPer1M'];

  @Field(() => Number, { nullable: true })
  costOutputPer1M?: CopilotPromptRegistryPublishGateRouteCandidate['costOutputPer1M'];

  @Field(() => SafeIntResolver, { nullable: true })
  routeContextWindow?: CopilotPromptRegistryPublishGateRouteCandidate['routeContextWindow'];

  @Field(() => SafeIntResolver, { nullable: true })
  routeMaxOutputTokens?: CopilotPromptRegistryPublishGateRouteCandidate['routeMaxOutputTokens'];

  @Field(() => SafeIntResolver, { nullable: true })
  routeEmbeddingDimensions?: CopilotPromptRegistryPublishGateRouteCandidate['routeEmbeddingDimensions'];

  @Field(() => [String], { nullable: true })
  routeInputTypes?: CopilotPromptRegistryPublishGateRouteCandidate['routeInputTypes'];

  @Field(() => [String], { nullable: true })
  routeOutputTypes?: CopilotPromptRegistryPublishGateRouteCandidate['routeOutputTypes'];

  @Field(() => [String], { nullable: true })
  routeAttachmentKinds?: CopilotPromptRegistryPublishGateRouteCandidate['routeAttachmentKinds'];

  @Field(() => [String], { nullable: true })
  routeAttachmentSourceKinds?: CopilotPromptRegistryPublishGateRouteCandidate['routeAttachmentSourceKinds'];

  @Field(() => Boolean, { nullable: true })
  routeAttachmentAllowRemoteUrls?: CopilotPromptRegistryPublishGateRouteCandidate['routeAttachmentAllowRemoteUrls'];

  @Field(() => [String], { nullable: true })
  routeStructuredAttachmentKinds?: CopilotPromptRegistryPublishGateRouteCandidate['routeStructuredAttachmentKinds'];

  @Field(() => [String], { nullable: true })
  routeStructuredAttachmentSourceKinds?: CopilotPromptRegistryPublishGateRouteCandidate['routeStructuredAttachmentSourceKinds'];

  @Field(() => Boolean, { nullable: true })
  routeStructuredAttachmentAllowRemoteUrls?: CopilotPromptRegistryPublishGateRouteCandidate['routeStructuredAttachmentAllowRemoteUrls'];

  @Field(() => String, { nullable: true })
  health?: CopilotPromptRegistryPublishGateRouteCandidate['health'];

  @Field(() => String, { nullable: true })
  healthCheckedAt?: CopilotPromptRegistryPublishGateRouteCandidate['healthCheckedAt'];

  @Field(() => Boolean)
  matched!: CopilotPromptRegistryPublishGateRouteCandidate['matched'];

  @Field(() => String, { nullable: true })
  modelId?: CopilotPromptRegistryPublishGateRouteCandidate['modelId'];

  @Field(() => String, { nullable: true })
  privacy?: CopilotPromptRegistryPublishGateRouteCandidate['privacy'];

  @Field(() => SafeIntResolver, { nullable: true })
  providerConfiguredModelCount?: CopilotPromptRegistryPublishGateRouteCandidate['providerConfiguredModelCount'];

  @Field(() => [String], { nullable: true })
  providerConfiguredModelIds?: CopilotPromptRegistryPublishGateRouteCandidate['providerConfiguredModelIds'];

  @Field(() => String)
  providerId!: CopilotPromptRegistryPublishGateRouteCandidate['providerId'];

  @Field(() => String, { nullable: true })
  providerName?: CopilotPromptRegistryPublishGateRouteCandidate['providerName'];

  @Field(() => SafeIntResolver, { nullable: true })
  providerPriority?: CopilotPromptRegistryPublishGateRouteCandidate['providerPriority'];

  @Field(() => String, { nullable: true })
  providerProfileConfigPath?: CopilotPromptRegistryPublishGateRouteCandidate['providerProfileConfigPath'];

  @Field(() => String, { nullable: true })
  providerProfileId?: CopilotPromptRegistryPublishGateRouteCandidate['providerProfileId'];

  @Field(() => String, { nullable: true })
  providerProfileSource?: CopilotPromptRegistryPublishGateRouteCandidate['providerProfileSource'];

  @Field(() => String, { nullable: true })
  providerSource?: CopilotPromptRegistryPublishGateRouteCandidate['providerSource'];

  @Field(() => String, { nullable: true })
  providerType?: CopilotPromptRegistryPublishGateRouteCandidate['providerType'];

  @Field(() => [String])
  reasons!: CopilotPromptRegistryPublishGateRouteCandidate['reasons'];

  @Field(() => Boolean, { nullable: true })
  registryAvailable?: CopilotPromptRegistryPublishGateRouteCandidate['registryAvailable'];

  @Field(() => String, { nullable: true })
  registryKind?: CopilotPromptRegistryPublishGateRouteCandidate['registryKind'];

  @Field(() => Boolean, { nullable: true })
  registrySelected?: CopilotPromptRegistryPublishGateRouteCandidate['registrySelected'];

  @Field(() => String, { nullable: true })
  requestedModelId?: CopilotPromptRegistryPublishGateRouteCandidate['requestedModelId'];

  @Field(() => Boolean, { nullable: true })
  routeModelAliasMatched?: CopilotPromptRegistryPublishGateRouteCandidate['routeModelAliasMatched'];

  @Field(() => [String], { nullable: true })
  routeModelDefinitionAliases?: CopilotPromptRegistryPublishGateRouteCandidate['routeModelDefinitionAliases'];

  @Field(() => String, { nullable: true })
  routeModelDefinitionId?: CopilotPromptRegistryPublishGateRouteCandidate['routeModelDefinitionId'];

  @Field(() => String, { nullable: true })
  routeModelDefinitionSource?: CopilotPromptRegistryPublishGateRouteCandidate['routeModelDefinitionSource'];

  @Field(() => String, { nullable: true })
  modelRegistryRevision?: CopilotPromptRegistryPublishGateRouteCandidate['modelRegistryRevision'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionActorId?: CopilotPromptRegistryPublishGateRouteCandidate['modelRegistryRevisionActorId'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionFingerprint?: CopilotPromptRegistryPublishGateRouteCandidate['modelRegistryRevisionFingerprint'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionId?: CopilotPromptRegistryPublishGateRouteCandidate['modelRegistryRevisionId'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionScope?: CopilotPromptRegistryPublishGateRouteCandidate['modelRegistryRevisionScope'];

  @Field(() => [CopilotModelRegistrySourceChainEntryType], { nullable: true })
  modelRegistryRevisionSourceChain?: CopilotPromptRegistryPublishGateRouteCandidate['modelRegistryRevisionSourceChain'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionSourceChainFingerprint?: CopilotPromptRegistryPublishGateRouteCandidate['modelRegistryRevisionSourceChainFingerprint'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionStatus?: CopilotPromptRegistryPublishGateRouteCandidate['modelRegistryRevisionStatus'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionWorkspaceId?: CopilotPromptRegistryPublishGateRouteCandidate['modelRegistryRevisionWorkspaceId'];

  @Field(() => String, { nullable: true })
  routeRawModelId?: CopilotPromptRegistryPublishGateRouteCandidate['routeRawModelId'];
}

@ObjectType()
class CopilotPromptRegistryValidationRemediationType implements CopilotPromptRegistryValidationRemediation {
  @Field(() => String)
  detail!: CopilotPromptRegistryValidationRemediation['detail'];

  @Field(() => String)
  kind!: CopilotPromptRegistryValidationRemediation['kind'];

  @Field(() => String)
  label!: CopilotPromptRegistryValidationRemediation['label'];

  @Field(() => String)
  target!: CopilotPromptRegistryValidationRemediation['target'];

  @Field(() => CopilotPromptRegistryValidationSourceLocatorType)
  targetLocator!: CopilotPromptRegistryValidationRemediation['targetLocator'];
}

@ObjectType()
class CopilotPromptRegistryPublishGateRepairTargetLocatorType implements CopilotPromptRegistryPublishGateRepairTargetLocator {
  @Field(() => String, { nullable: true })
  actionId?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  candidateIndex?: number;

  @Field(() => String, { nullable: true })
  candidateKind?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  fallbackOrderIndex?: number;

  @Field(() => String, { nullable: true })
  featureKind?: TaskRoutePolicySourceChainEntry['featureKind'];

  @Field(() => String)
  kind!: string;

  @Field(() => String, { nullable: true })
  outputType?: string;

  @Field(() => String)
  path!: string;

  @Field(() => String, { nullable: true })
  providerId?: string;

  @Field(() => String, { nullable: true })
  providerProfileConfigPath?: string;

  @Field(() => String, { nullable: true })
  providerProfileId?: string;

  @Field(() => String, { nullable: true })
  providerProfileSource?: string;

  @Field(() => String)
  registryFingerprint!: string;

  @Field(() => SafeIntResolver)
  registryId!: number;

  @Field(() => String)
  registryUpdatedAt!: string;

  @Field(() => String, { nullable: true })
  requestedModelConfigKey?: string;

  @Field(() => String, { nullable: true })
  requestedModelConfigPath?: string;

  @Field(() => String, { nullable: true })
  requestedModelId?: string;

  @Field(() => String, { nullable: true })
  requestedModelSource?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  routeIndex?: number;

  @Field(() => String, { nullable: true })
  status?: string;

  @Field(() => String, { nullable: true })
  stepId?: string;
}

@ObjectType()
class CopilotPromptRegistryPublishGateRepairDiagnosticsErrorType implements CopilotTaskRouteDiagnosticsError {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  message!: string;

  @Field(() => String)
  stage!: string;
}

@ObjectType()
class CopilotPromptRegistryPublishGateRepairCandidateEvidenceType implements CopilotPromptRegistryPublishGateRepairCandidateEvidence {
  @Field(() => Boolean, { nullable: true })
  allowed?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['allowed'];

  @Field(() => Boolean, { nullable: true })
  available?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['available'];

  @Field(() => String)
  candidateFingerprint!: CopilotPromptRegistryPublishGateRepairCandidateEvidence['candidateFingerprint'];

  @Field(() => SafeIntResolver)
  candidateIndex!: CopilotPromptRegistryPublishGateRepairCandidateEvidence['candidateIndex'];

  @Field(() => String, { nullable: true })
  candidateKey?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['candidateKey'];

  @Field(() => [String], { nullable: true })
  candidateModelIds?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['candidateModelIds'];

  @Field(() => Number, { nullable: true })
  costInputPer1M?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['costInputPer1M'];

  @Field(() => Number, { nullable: true })
  costOutputPer1M?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['costOutputPer1M'];

  @Field(() => [CopilotPromptRegistryPublishGateRepairDiagnosticsErrorType], {
    nullable: true,
  })
  diagnosticsErrors?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['diagnosticsErrors'];

  @Field(() => String, { nullable: true })
  diagnosticsErrorSnapshotFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['diagnosticsErrorSnapshotFingerprint'];

  @Field(() => Boolean, { nullable: true })
  dimensionMismatch?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['dimensionMismatch'];

  @Field(() => SafeIntResolver, { nullable: true })
  embeddingIndexContractDimensions?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['embeddingIndexContractDimensions'];

  @Field(() => String, { nullable: true })
  embeddingIndexContractFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['embeddingIndexContractFingerprint'];

  @Field(() => String, { nullable: true })
  embeddingIndexContractStatus?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['embeddingIndexContractStatus'];

  @Field(() => String, { nullable: true })
  embeddingIndexContractVersion?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['embeddingIndexContractVersion'];

  @Field(() => String, { nullable: true })
  errorCategory?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['errorCategory'];

  @Field(() => String, { nullable: true })
  errorCode?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['errorCode'];

  @Field(() => [String], { nullable: true })
  fallbackProviderIds?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['fallbackProviderIds'];

  @Field(() => String, { nullable: true })
  health?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['health'];

  @Field(() => String, { nullable: true })
  healthCheckedAt?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['healthCheckedAt'];

  @Field(() => Boolean, { nullable: true })
  matched?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['matched'];

  @Field(() => SafeIntResolver, { nullable: true })
  modelEmbeddingDimensions?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['modelEmbeddingDimensions'];

  @Field(() => String, { nullable: true })
  modelId?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['modelId'];

  @Field(() => Boolean, { nullable: true })
  prepared?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['prepared'];

  @Field(() => String, { nullable: true })
  preparedModelId?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['preparedModelId'];

  @Field(() => String, { nullable: true })
  prepareCandidateSnapshotFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['prepareCandidateSnapshotFingerprint'];

  @Field(() => [CopilotTaskRoutePrepareCandidateDiagnosticsType], {
    nullable: true,
  })
  prepareCandidates?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['prepareCandidates'];

  @Field(() => String, { nullable: true })
  preparedRouteOrderFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['preparedRouteOrderFingerprint'];

  @Field(() => String, { nullable: true })
  preparedRouteSnapshotFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['preparedRouteSnapshotFingerprint'];

  @Field(() => [CopilotPreparedTaskRouteDiagnosticsType], { nullable: true })
  preparedRoutes?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['preparedRoutes'];

  @Field(() => String, { nullable: true })
  providerCapabilitySnapshotFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['providerCapabilitySnapshotFingerprint'];

  @Field(() => String, { nullable: true })
  providerCostSnapshotFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['providerCostSnapshotFingerprint'];

  @Field(() => String, { nullable: true })
  providerHealthSnapshotFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['providerHealthSnapshotFingerprint'];

  @Field(() => String, { nullable: true })
  providerLimitSnapshotFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['providerLimitSnapshotFingerprint'];

  @Field(() => String, { nullable: true })
  rerankRuntimeContractFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['rerankRuntimeContractFingerprint'];

  @Field(() => String, { nullable: true })
  rerankRuntimeContractStatus?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['rerankRuntimeContractStatus'];

  @Field(() => SafeIntResolver, { nullable: true })
  rerankRuntimeContractTopK?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['rerankRuntimeContractTopK'];

  @Field(() => String, { nullable: true })
  rerankRuntimeContractVersion?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['rerankRuntimeContractVersion'];

  @Field(() => String, { nullable: true })
  taskRouteEmbeddingIndexContractSnapshotFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['taskRouteEmbeddingIndexContractSnapshotFingerprint'];

  @Field(() => String, { nullable: true })
  taskRouteRerankRuntimeContractSnapshotFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['taskRouteRerankRuntimeContractSnapshotFingerprint'];

  @Field(() => String, { nullable: true })
  taskRouteDimensionSnapshotFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['taskRouteDimensionSnapshotFingerprint'];

  @Field(() => String, { nullable: true })
  taskRouteEffectiveSourceFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['taskRouteEffectiveSourceFingerprint'];

  @Field(() => [String], { nullable: true })
  taskRouteEffectiveSourceFingerprintInputs?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['taskRouteEffectiveSourceFingerprintInputs'];

  @Field(() => String, { nullable: true })
  taskRouteEffectiveSourceFingerprintVersion?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['taskRouteEffectiveSourceFingerprintVersion'];

  @Field(() => String, { nullable: true })
  taskRouteModelSourceSnapshotFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['taskRouteModelSourceSnapshotFingerprint'];

  @Field(() => [String], { nullable: true })
  preparedRouteTargets?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['preparedRouteTargets'];

  @Field(() => String, { nullable: true })
  preparedRouteTargetFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['preparedRouteTargetFingerprint'];

  @Field(() => [CopilotPromptRegistryPublishGatePolicyCandidateType], {
    nullable: true,
  })
  policyCandidates?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['policyCandidates'];

  @Field(() => String, { nullable: true })
  policyCandidateSnapshotFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['policyCandidateSnapshotFingerprint'];

  @Field(() => String, { nullable: true })
  privacy?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['privacy'];

  @Field(() => SafeIntResolver, { nullable: true })
  providerConfiguredModelCount?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['providerConfiguredModelCount'];

  @Field(() => [String], { nullable: true })
  providerConfiguredModelIds?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['providerConfiguredModelIds'];

  @Field(() => String)
  providerId!: CopilotPromptRegistryPublishGateRepairCandidateEvidence['providerId'];

  @Field(() => String, { nullable: true })
  providerName?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['providerName'];

  @Field(() => SafeIntResolver, { nullable: true })
  providerPriority?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['providerPriority'];

  @Field(() => String, { nullable: true })
  providerProfileConfigPath?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['providerProfileConfigPath'];

  @Field(() => String, { nullable: true })
  providerProfileId?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['providerProfileId'];

  @Field(() => String, { nullable: true })
  providerProfileSource?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['providerProfileSource'];

  @Field(() => String, { nullable: true })
  providerSource?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['providerSource'];

  @Field(() => String, { nullable: true })
  providerType?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['providerType'];

  @Field(() => [String])
  reasons!: CopilotPromptRegistryPublishGateRepairCandidateEvidence['reasons'];

  @Field(() => Boolean, { nullable: true })
  registryAvailable?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['registryAvailable'];

  @Field(() => String, { nullable: true })
  registryKind?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['registryKind'];

  @Field(() => Boolean, { nullable: true })
  registrySelected?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['registrySelected'];

  @Field(() => String, { nullable: true })
  requestedModelConfigKey?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['requestedModelConfigKey'];

  @Field(() => String, { nullable: true })
  requestedModelConfigPath?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['requestedModelConfigPath'];

  @Field(() => SafeIntResolver, { nullable: true })
  requestedDimensions?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['requestedDimensions'];

  @Field(() => String, { nullable: true })
  requestedModelId?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['requestedModelId'];

  @Field(() => String, { nullable: true })
  requestedModelSource?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['requestedModelSource'];

  @Field(() => Boolean, { nullable: true })
  routeAttachmentAllowRemoteUrls?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeAttachmentAllowRemoteUrls'];

  @Field(() => [String], { nullable: true })
  routeAttachmentKinds?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeAttachmentKinds'];

  @Field(() => [String], { nullable: true })
  routeAttachmentSourceKinds?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeAttachmentSourceKinds'];

  @Field(() => String, { nullable: true })
  routeCandidateSnapshotFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeCandidateSnapshotFingerprint'];

  @Field(() => SafeIntResolver, { nullable: true })
  routeContextWindow?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeContextWindow'];

  @Field(() => SafeIntResolver, { nullable: true })
  routeEmbeddingDimensions?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeEmbeddingDimensions'];

  @Field(() => [String], { nullable: true })
  routeInputTypes?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeInputTypes'];

  @Field(() => SafeIntResolver, { nullable: true })
  routeMaxOutputTokens?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeMaxOutputTokens'];

  @Field(() => Boolean, { nullable: true })
  routeModelAliasMatched?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeModelAliasMatched'];

  @Field(() => [String], { nullable: true })
  routeModelDefinitionAliases?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeModelDefinitionAliases'];

  @Field(() => String, { nullable: true })
  routeModelDefinitionId?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeModelDefinitionId'];

  @Field(() => String, { nullable: true })
  routeModelDefinitionSource?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeModelDefinitionSource'];

  @Field(() => String, { nullable: true })
  modelRegistryRevision?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['modelRegistryRevision'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionActorId?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['modelRegistryRevisionActorId'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['modelRegistryRevisionFingerprint'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionId?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['modelRegistryRevisionId'];

  @Field(() => SafeIntResolver, { nullable: true })
  modelRegistryRevisionPublishEventCount?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['modelRegistryRevisionPublishEventCount'];

  @Field(() => [CopilotRegistryRevisionPublishEventType], { nullable: true })
  modelRegistryRevisionPublishEvents?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['modelRegistryRevisionPublishEvents'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionScope?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['modelRegistryRevisionScope'];

  @Field(() => [CopilotModelRegistrySourceChainEntryType], { nullable: true })
  modelRegistryRevisionSourceChain?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['modelRegistryRevisionSourceChain'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionSourceChainFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['modelRegistryRevisionSourceChainFingerprint'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionStatus?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['modelRegistryRevisionStatus'];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionWorkspaceId?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['modelRegistryRevisionWorkspaceId'];

  @Field(() => [String], { nullable: true })
  routeOutputTypes?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeOutputTypes'];

  @Field(() => String, { nullable: true })
  routeRawModelId?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeRawModelId'];

  @Field(() => Boolean, { nullable: true })
  routeStructuredAttachmentAllowRemoteUrls?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeStructuredAttachmentAllowRemoteUrls'];

  @Field(() => [String], { nullable: true })
  routeStructuredAttachmentKinds?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeStructuredAttachmentKinds'];

  @Field(() => [String], { nullable: true })
  routeStructuredAttachmentSourceKinds?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeStructuredAttachmentSourceKinds'];

  @Field(() => [CopilotPromptRegistryPublishGateRouteTracePhaseType], {
    nullable: true,
  })
  routeTrace?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeTrace'];

  @Field(() => [String], { nullable: true })
  routeTracePhases?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeTracePhases'];

  @Field(() => String, { nullable: true })
  routeTraceSnapshotFingerprint?: CopilotPromptRegistryPublishGateRepairCandidateEvidence['routeTraceSnapshotFingerprint'];

  @Field(() => String)
  scope!: CopilotPromptRegistryPublishGateRepairCandidateEvidence['scope'];
}

@ObjectType()
class CopilotPromptRegistryPublishGateRepairRecommendationType implements CopilotPromptRegistryPublishGateRepairRecommendation {
  @Field(() => [CopilotPromptRegistryPublishGateRepairCandidateEvidenceType], {
    nullable: true,
  })
  candidateEvidence?: CopilotPromptRegistryPublishGateRepairRecommendation['candidateEvidence'];

  @Field(() => String)
  category!: string;

  @Field(() => String)
  code!: string;

  @Field(() => String)
  detail!: string;

  @Field(() => String)
  diagnosticsFingerprint!: string;

  @Field(() => [String])
  evidence!: string[];

  @Field(() => String, { nullable: true })
  instanceKey?: string;

  @Field(() => String)
  severity!: string;

  @Field(() => String)
  suggestedAction!: string;

  @Field(() => String)
  suggestedActionCatalogVersion!: string;

  @Field(() => GraphQLJSON)
  suggestedActionInputSchema!: Record<string, unknown>;

  @Field(() => String)
  suggestedActionKind!: string;

  @Field(() => [String])
  suggestedActionRequiredCapabilities!: string[];

  @Field(() => String)
  suggestedActionSafety!: string;

  @Field(() => String)
  target!: string;

  @Field(() => CopilotPromptRegistryPublishGateRepairTargetLocatorType, {
    nullable: true,
  })
  targetLocator?: CopilotPromptRegistryPublishGateRepairTargetLocator;

  @Field(() => String)
  title!: string;
}

@ObjectType()
class CopilotPromptRegistryPublishGateRepairActionCatalogEntryType implements CopilotPromptRegistryPublishGateRepairActionCatalogEntry {
  @Field(() => String)
  actionKind!: string;

  @Field(() => String)
  catalogVersion!: string;

  @Field(() => GraphQLJSON)
  inputSchema!: Record<string, unknown>;

  @Field(() => SafeIntResolver)
  recommendationCount!: number;

  @Field(() => [String])
  requiredCapabilities!: string[];

  @Field(() => String)
  safety!: string;
}

@ObjectType()
class CopilotPromptRegistryPublishGateRepairActionMutationGuardType implements CopilotPromptRegistryPublishGateRepairActionMutationGuard {
  @Field(() => String)
  auditSummary!: string;

  @Field(() => String)
  auditSummaryFingerprint!: string;

  @Field(() => String)
  catalogFingerprint!: string;

  @Field(() => String)
  catalogVersion!: string;

  @Field(() => String)
  expectedRegistryFingerprint!: string;

  @Field(() => SafeIntResolver)
  expectedRegistryId!: number;

  @Field(() => String)
  expectedRegistryUpdatedAt!: string;

  @Field(() => String)
  guardFingerprint!: string;

  @Field(() => String)
  intentFingerprint!: string;

  @Field(() => String)
  inputSchemaFingerprint!: string;

  @Field(() => [String])
  recommendationCategories!: string[];

  @Field(() => SafeIntResolver)
  recommendationCount!: number;

  @Field(() => [String])
  recommendationCodes!: string[];

  @Field(() => [String])
  recommendationFingerprints!: string[];

  @Field(() => [String])
  requiredCapabilities!: string[];

  @Field(() => [String])
  requiredReviewModes!: string[];

  @Field(() => Boolean)
  required!: boolean;

  @Field(() => [String])
  safetyLevels!: string[];

  @Field(() => [String])
  suggestedActionKinds!: string[];

  @Field(() => SafeIntResolver)
  targetLocatorCount!: number;

  @Field(() => String)
  targetLocatorFingerprint!: string;

  @Field(() => [String])
  targetLocatorKinds!: string[];
}

@ObjectType()
class CopilotPromptRegistryPublishGateRepairActionPreviewOperationType implements CopilotPromptRegistryPublishGateRepairActionPreviewOperation {
  @Field(() => String)
  actionKind!: string;

  @Field(() => SafeIntResolver)
  candidateEvidenceCount!: number;

  @Field(() => [CopilotPromptRegistryRepairCandidateEvidenceReferenceEntryType])
  candidateEvidenceEntries!: CopilotPromptRegistryRepairCandidateEvidenceReferenceEntry[];

  @Field(() => String)
  candidateEvidenceFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceFingerprints!: string[];

  @Field(() => [String])
  candidateEvidenceKeys!: string[];

  @Field(() => String)
  category!: string;

  @Field(() => String)
  code!: string;

  @Field(() => String)
  diagnosticsFingerprint!: string;

  @Field(() => [String])
  embeddingIndexContractEvidenceFingerprints!: string[];

  @Field(() => [String])
  rerankRuntimeContractEvidenceFingerprints!: string[];

  @Field(() => [String])
  taskRouteEffectiveSourceFingerprints!: string[];

  @Field(() => GraphQLJSON)
  inputSchema!: Record<string, unknown>;

  @Field(() => String, { nullable: true })
  instanceKey?: string;

  @Field(() => String)
  operationFingerprint!: string;

  @Field(() => [String])
  preparedRouteOrderFingerprints!: string[];

  @Field(() => String)
  previewStatus!: string;

  @Field(() => [String])
  requiredCapabilities!: string[];

  @Field(() => String)
  reviewMode!: string;

  @Field(() => String)
  safety!: string;

  @Field(() => String)
  target!: string;

  @Field(() => CopilotPromptRegistryPublishGateRepairTargetLocatorType, {
    nullable: true,
  })
  targetLocator?: CopilotPromptRegistryPublishGateRepairTargetLocator;

  @Field(() => String)
  targetLocatorFingerprint!: string;
}

@ObjectType()
class CopilotPromptRegistryPublishGateRepairActionSubmissionContractType implements CopilotPromptRegistryPublishGateRepairActionSubmissionContract {
  @Field(() => String)
  approvalPolicyFingerprint!: string;

  @Field(() => String)
  authorizationFingerprint!: string;

  @Field(() => String)
  candidateEvidenceSetFingerprint!: string;

  @Field(() => String)
  taskRouteEffectiveSourceEvidenceSetFingerprint!: string;

  @Field(() => [String])
  taskRouteEffectiveSourceEvidenceSetFingerprintInputs!: string[];

  @Field(() => String)
  taskRouteEffectiveSourceEvidenceSetFingerprintVersion!: string;

  @Field(() => String)
  embeddingIndexContractEvidenceSetFingerprint!: string;

  @Field(() => String)
  rerankRuntimeContractEvidenceSetFingerprint!: string;

  @Field(() => String)
  preparedRouteOrderEvidenceSetFingerprint!: string;

  @Field(() => String)
  catalogFingerprint!: string;

  @Field(() => String)
  contractVersion!: string;

  @Field(() => String)
  expectedRegistryFingerprint!: string;

  @Field(() => SafeIntResolver)
  expectedRegistryId!: number;

  @Field(() => String)
  expectedRegistryUpdatedAt!: string;

  @Field(() => String)
  guardFingerprint!: string;

  @Field(() => String)
  idempotencyKey!: string;

  @Field(() => Boolean)
  mutationAvailable!: boolean;

  @Field(() => String)
  operationSetFingerprint!: string;

  @Field(() => String)
  previewFingerprint!: string;

  @Field(() => String)
  targetLocatorFingerprint!: string;

  @Field(() => Boolean)
  readOnly!: boolean;

  @Field(() => [String])
  requiredInputs!: string[];

  @Field(() => String)
  status!: string;

  @Field(() => String)
  submissionFingerprint!: string;
}

@ObjectType()
class CopilotPromptRegistryPublishGateRepairActionPreviewType implements CopilotPromptRegistryPublishGateRepairActionPreview {
  @Field(() => [String])
  approvalCheckpoints!: string[];

  @Field(() => [String])
  approvalModes!: string[];

  @Field(() => String)
  approvalPolicyFingerprint!: string;

  @Field(() => String)
  approvalPolicyVersion!: string;

  @Field(() => Boolean)
  approvalRequired!: boolean;

  @Field(() => String)
  auditSummaryFingerprint!: string;

  @Field(() => String)
  authorizationFingerprint!: string;

  @Field(() => String)
  authorizationStatus!: string;

  @Field(() => SafeIntResolver)
  candidateCount!: number;

  @Field(() => String)
  candidateEvidenceSetFingerprint!: string;

  @Field(() => String)
  taskRouteEffectiveSourceEvidenceSetFingerprint!: string;

  @Field(() => [String])
  taskRouteEffectiveSourceEvidenceSetFingerprintInputs!: string[];

  @Field(() => String)
  taskRouteEffectiveSourceEvidenceSetFingerprintVersion!: string;

  @Field(() => String)
  embeddingIndexContractEvidenceSetFingerprint!: string;

  @Field(() => String)
  rerankRuntimeContractEvidenceSetFingerprint!: string;

  @Field(() => String)
  preparedRouteOrderEvidenceSetFingerprint!: string;

  @Field(() => String)
  catalogFingerprint!: string;

  @Field(() => String)
  catalogVersion!: string;

  @Field(() => String)
  guardFingerprint!: string;

  @Field(() => [String])
  operationFingerprints!: string[];

  @Field(() => String)
  operationSetFingerprint!: string;

  @Field(() => [
    CopilotPromptRegistryPublishGateRepairActionPreviewOperationType,
  ])
  operations!: CopilotPromptRegistryPublishGateRepairActionPreviewOperation[];

  @Field(() => String)
  previewFingerprint!: string;

  @Field(() => Boolean)
  readOnly!: boolean;

  @Field(() => [String])
  requiredCapabilities!: string[];

  @Field(() => String)
  status!: string;

  @Field(
    () => CopilotPromptRegistryPublishGateRepairActionSubmissionContractType
  )
  submissionContract!: CopilotPromptRegistryPublishGateRepairActionSubmissionContract;
}

@ObjectType()
class CopilotPromptRegistryPublishGateRepairGateManifestType implements CopilotPromptRegistryPublishGateRepairGateManifest {
  @Field(() => String)
  version!: string;

  @Field(() => String)
  boundary!: string;

  @Field(() => String)
  fingerprint!: string;

  @Field(() => String)
  registryFingerprint!: string;

  @Field(() => SafeIntResolver)
  registryId!: number;

  @Field(() => String)
  registryUpdatedAt!: string;

  @Field(() => String)
  gateStatus!: string;

  @Field(() => String)
  publishStatus!: string;

  @Field(() => String)
  reason!: string;

  @Field(() => SafeIntResolver)
  issueCount!: number;

  @Field(() => SafeIntResolver)
  blockingCount!: number;

  @Field(() => SafeIntResolver)
  recommendationCount!: number;

  @Field(() => SafeIntResolver)
  operationCount!: number;

  @Field(() => String)
  guardFingerprint!: string;

  @Field(() => String)
  previewFingerprint!: string;

  @Field(() => String)
  submissionFingerprint!: string;

  @Field(() => String)
  candidateEvidenceSetFingerprint!: string;

  @Field(() => String)
  taskRouteEffectiveSourceEvidenceSetFingerprint!: string;

  @Field(() => [String])
  taskRouteEffectiveSourceEvidenceSetFingerprintInputs!: string[];

  @Field(() => String)
  taskRouteEffectiveSourceEvidenceSetFingerprintVersion!: string;

  @Field(() => String)
  embeddingIndexContractEvidenceSetFingerprint!: string;

  @Field(() => String)
  rerankRuntimeContractEvidenceSetFingerprint!: string;

  @Field(() => String)
  preparedRouteOrderEvidenceSetFingerprint!: string;

  @Field(() => String)
  operationSetFingerprint!: string;

  @Field(() => String)
  targetLocatorFingerprint!: string;

  @Field(() => String)
  approvalPolicyFingerprint!: string;

  @Field(() => String)
  authorizationFingerprint!: string;

  @Field(() => String)
  catalogFingerprint!: string;

  @Field(() => String)
  catalogVersion!: string;

  @Field(() => Boolean)
  readOnly!: boolean;

  @Field(() => Boolean)
  mutationAvailable!: boolean;

  @Field(() => [String])
  requiredCapabilities!: string[];

  @Field(() => [String])
  requiredReviewModes!: string[];

  @Field(() => [String])
  safetyLevels!: string[];

  @Field(() => [String])
  operationFingerprints!: string[];

  @Field(() => [String])
  recommendationFingerprints!: string[];
}

@ObjectType()
class CopilotPromptRegistryPublishGateRepairGateManifestExportMetadataType implements CopilotPromptRegistryPublishGateRepairGateManifestExportMetadata {
  @Field(() => String)
  version!: string;

  @Field(() => String)
  artifact!: string;

  @Field(() => String)
  filename!: string;

  @Field(() => String)
  mime!: string;

  @Field(() => String)
  metadataFilename!: string;

  @Field(() => String)
  manifestVersion!: string;

  @Field(() => String)
  manifestFingerprint!: string;

  @Field(() => String)
  registryFingerprint!: string;

  @Field(() => SafeIntResolver)
  registryId!: number;

  @Field(() => String)
  registryUpdatedAt!: string;

  @Field(() => String)
  gateStatus!: string;

  @Field(() => String)
  publishStatus!: string;

  @Field(() => String)
  boundary!: string;

  @Field(() => String)
  redactionPolicyVersion!: string;

  @Field(() => String)
  redactionPolicyStatus!: string;

  @Field(() => String)
  redactionPolicyFingerprint!: string;

  @Field(() => String)
  exportPolicyVersion!: string;

  @Field(() => String)
  exportPolicyStatus!: string;

  @Field(() => String)
  exportPolicyFingerprint!: string;

  @Field(() => String)
  auditEventVersion!: string;

  @Field(() => String)
  auditEventStatus!: string;

  @Field(() => Boolean)
  auditEventCreated!: boolean;

  @Field(() => String)
  auditEventFingerprint!: string;

  @Field(() => String)
  retentionPolicyVersion!: string;

  @Field(() => String)
  retentionPolicyStatus!: string;

  @Field(() => String)
  retentionPolicyFingerprint!: string;
}

@ObjectType()
class CopilotPromptRegistryRepairPreflightType implements CopilotPromptRegistryRepairPreflight {
  @Field(() => Boolean)
  accepted!: boolean;

  @Field(() => String)
  actorFingerprint!: string;

  @Field(() => [String])
  actorSnapshotInputs!: string[];

  @Field(() => String)
  actorSnapshotStatus!: string;

  @Field(() => String)
  actorSnapshotVersion!: string;

  @Field(() => String)
  actorType!: string;

  @Field(() => [String])
  approvalCheckpoints!: string[];

  @Field(() => [String])
  approvalModes!: string[];

  @Field(() => Boolean)
  approvalRecordCreated!: boolean;

  @Field(() => String)
  approvalRecordFingerprint!: string;

  @Field(() => [String])
  approvalRecordInputs!: string[];

  @Field(() => String)
  approvalRecordStatus!: string;

  @Field(() => String)
  approvalRecordVersion!: string;

  @Field(() => String)
  approvalRequestFingerprint!: string;

  @Field(() => [String])
  approvalRequestInputs!: string[];

  @Field(() => String)
  approvalRequestStatus!: string;

  @Field(() => String)
  approvalRequestVersion!: string;

  @Field(() => Boolean)
  approvalRequired!: boolean;

  @Field(() => String)
  auditBindingFingerprint!: string;

  @Field(() => [String])
  auditBindingInputs!: string[];

  @Field(() => String)
  auditBindingStatus!: string;

  @Field(() => String)
  auditBindingVersion!: string;

  @Field(() => Boolean)
  auditEventCreated!: boolean;

  @Field(() => String)
  auditEventFingerprint!: string;

  @Field(() => [String])
  auditEventInputs!: string[];

  @Field(() => String)
  auditEventStatus!: string;

  @Field(() => String)
  auditEventVersion!: string;

  @Field(() => String)
  authorizationStatus!: string;

  @Field(() => String)
  candidateEvidenceSetFingerprint!: string;

  @Field(() => String)
  taskRouteEffectiveSourceEvidenceSetFingerprint!: string;

  @Field(() => [String])
  taskRouteEffectiveSourceEvidenceSetFingerprintInputs!: string[];

  @Field(() => String)
  taskRouteEffectiveSourceEvidenceSetFingerprintVersion!: string;

  @Field(() => String)
  embeddingIndexContractEvidenceSetFingerprint!: string;

  @Field(() => String)
  rerankRuntimeContractEvidenceSetFingerprint!: string;

  @Field(() => String)
  preparedRouteOrderEvidenceSetFingerprint!: string;

  @Field(() => String)
  capabilityCheckMode!: string;

  @Field(() => String)
  capabilityFingerprint!: string;

  @Field(() => String)
  capabilitySource!: string;

  @Field(() => String)
  capabilityStatus!: string;

  @Field(() => String)
  contractVersion!: string;

  @Field(() => String)
  currentSubmissionFingerprint!: string;

  @Field(() => String)
  expectedSubmissionFingerprint!: string;

  @Field(() => String)
  executionGateFingerprint!: string;

  @Field(() => [String])
  executionGateInputs!: string[];

  @Field(() => String)
  executionGateStatus!: string;

  @Field(() => String)
  executionGateVersion!: string;

  @Field(() => Boolean)
  executionStateCreated!: boolean;

  @Field(() => String)
  executionStateFingerprint!: string;

  @Field(() => [String])
  executionStateInputs!: string[];

  @Field(() => String)
  executionStateStatus!: string;

  @Field(() => String)
  executionStateVersion!: string;

  @Field(() => String)
  expectedCandidateEvidenceSetFingerprint!: string;

  @Field(() => String)
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprint!: string;

  @Field(() => [String])
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs!: string[];

  @Field(() => String)
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion!: string;

  @Field(() => String)
  expectedEmbeddingIndexContractEvidenceSetFingerprint!: string;

  @Field(() => String)
  expectedRerankRuntimeContractEvidenceSetFingerprint!: string;

  @Field(() => String)
  expectedPreparedRouteOrderEvidenceSetFingerprint!: string;

  @Field(() => String)
  expectedTargetLocatorFingerprint!: string;

  @Field(() => String)
  targetLocatorFingerprint!: string;

  @Field(() => String)
  idempotencyFingerprint!: string;

  @Field(() => String)
  idempotencyKey!: string;

  @Field(() => Boolean)
  idempotencyLockAcquired!: boolean;

  @Field(() => String)
  idempotencyScope!: string;

  @Field(() => String)
  idempotencyStatus!: string;

  @Field(() => String)
  idempotencyVersion!: string;

  @Field(() => [String])
  matchedFields!: string[];

  @Field(() => [String])
  mismatchedFields!: string[];

  @Field(() => Boolean)
  mutationAvailable!: boolean;

  @Field(() => String)
  permissionCheckMode!: string;

  @Field(() => Boolean)
  permissionChecked!: boolean;

  @Field(() => String)
  permissionFingerprint!: string;

  @Field(() => String)
  permissionScope!: string;

  @Field(() => String)
  permissionStatus!: string;

  @Field(() => String)
  policyBindingFingerprint!: string;

  @Field(() => [String])
  policyBindingInputs!: string[];

  @Field(() => String)
  policyBindingStatus!: string;

  @Field(() => String)
  policyBindingVersion!: string;

  @Field(() => String)
  policySource!: string;

  @Field(() => [String])
  requiredCapabilities!: string[];

  @Field(() => SafeIntResolver)
  requiredCapabilityCount!: number;

  @Field(() => String)
  requiredPermission!: string;

  @Field(() => Boolean)
  repairJobCreated!: boolean;

  @Field(() => String)
  repairJobFingerprint!: string;

  @Field(() => [String])
  repairJobInputs!: string[];

  @Field(() => String)
  repairJobStatus!: string;

  @Field(() => String)
  repairJobVersion!: string;

  @Field(() => String)
  reviewBindingFingerprint!: string;

  @Field(() => [String])
  reviewBindingInputs!: string[];

  @Field(() => String)
  reviewBindingStatus!: string;

  @Field(() => String)
  reviewBindingVersion!: string;

  @Field(() => Boolean)
  rollbackPlanCreated!: boolean;

  @Field(() => String)
  rollbackPlanFingerprint!: string;

  @Field(() => [String])
  rollbackPlanInputs!: string[];

  @Field(() => String)
  rollbackPlanStatus!: string;

  @Field(() => String)
  rollbackPlanVersion!: string;

  @Field(() => Boolean)
  readOnly!: boolean;

  @Field(() => String)
  status!: string;

  @Field(() => String, { nullable: true })
  workspaceId?: string;
}

@ObjectType()
class CopilotPromptRegistryRepairTaskRouteModelSourceSnapshotEntryType implements CopilotPromptRegistryRepairTaskRouteModelSourceSnapshotEntry {
  @Field(() => String)
  featureKind!: string;

  @Field(() => String, { nullable: true })
  requestedModelConfigKey?: string;

  @Field(() => String, { nullable: true })
  requestedModelConfigPath?: string;

  @Field(() => String, { nullable: true })
  requestedModelId?: string;

  @Field(() => String, { nullable: true })
  requestedModelSource?: string;
}

@ObjectType()
class CopilotPromptRegistryRepairCandidateEvidenceReferenceEntryType implements CopilotPromptRegistryRepairCandidateEvidenceReferenceEntry {
  @Field(() => String, { nullable: true })
  candidateEvidenceCategory?: string;

  @Field(() => String)
  candidateEvidenceFingerprint!: string;

  @Field(() => String, { nullable: true })
  candidateEvidenceKey?: string;

  @Field(() => String)
  candidateEvidenceProviderId!: string;

  @Field(() => String)
  candidateEvidenceScope!: string;

  @Field(() => SafeIntResolver)
  candidateIndex!: number;

  @Field(() => String, { nullable: true })
  preparedRouteOrderFingerprint?: string;

  @Field(() => [CopilotPreparedTaskRouteDiagnosticsType], {
    nullable: true,
  })
  preparedRouteEntries?: CopilotPreparedTaskRouteDiagnosticsType[];

  @Field(() => [CopilotPromptRegistryPublishGatePolicyCandidateType], {
    nullable: true,
  })
  policyCandidateEntries?: CopilotPromptRegistryPublishGatePolicyCandidate[];

  @Field(() => [CopilotTaskRoutePrepareCandidateDiagnosticsType], {
    nullable: true,
  })
  prepareCandidateEntries?: CopilotTaskRoutePrepareCandidateDiagnosticsType[];

  @Field(() => [CopilotPromptRegistryPublishGateRouteCandidateType], {
    nullable: true,
  })
  routeCandidateEntries?: CopilotPromptRegistryPublishGateRouteCandidate[];

  @Field(() => String, { nullable: true })
  taskRouteEffectiveSourceFingerprint?: string;

  @Field(
    () => [CopilotPromptRegistryRepairTaskRouteModelSourceSnapshotEntryType],
    {
      nullable: true,
    }
  )
  taskRouteModelSourceSnapshotEntries?: CopilotPromptRegistryRepairTaskRouteModelSourceSnapshotEntry[];

  @Field(() => String, { nullable: true })
  taskRouteModelSourceSnapshotFingerprint?: string;
}

@ObjectType()
class CopilotPromptRegistryRepairExecutionRequestSourceEvidenceEntryType implements CopilotPromptRegistryRepairExecutionRequestSourceEvidenceEntry {
  @Field(() => SafeIntResolver)
  candidateEvidenceCategoryCount!: number;

  @Field(() => [String])
  candidateEvidenceCategories!: string[];

  @Field(() => SafeIntResolver)
  candidateEvidenceCount!: number;

  @Field(() => [CopilotPromptRegistryRepairCandidateEvidenceReferenceEntryType])
  candidateEvidenceEntries!: CopilotPromptRegistryRepairCandidateEvidenceReferenceEntry[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordPersistenceStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageBackendStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStorageStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactRecordStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaArtifactStatus!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaFields!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceReferenceSchemaFingerprintInputs!: string[];

  @Field(() => String)
  candidateEvidenceReferenceSchemaRegistryStatus!: string;

  @Field(() => String)
  candidateEvidenceReferenceSchemaVersion!: string;

  @Field(() => String)
  candidateEvidenceFingerprint!: string;

  @Field(() => [String])
  candidateEvidenceFingerprints!: string[];

  @Field(() => [String])
  candidateEvidenceKeys!: string[];

  @Field(() => [String])
  candidateEvidenceProviderIds!: string[];

  @Field(() => [String])
  candidateEvidenceScopes!: string[];

  @Field(() => String)
  diagnosticsFingerprint!: string;

  @Field(() => String)
  operationFingerprint!: string;

  @Field(() => [String])
  taskRouteEffectiveSourceFingerprints!: string[];
}

@ObjectType()
class CopilotRepairExecutionRuntimeResultType implements CopilotRepairExecutionRuntimeResult {
  @Field(() => String)
  version!: string;

  @Field(() => String)
  executor!: string;

  @Field(() => Boolean)
  sideEffectsApplied!: boolean;

  @Field(() => String)
  message!: string;

  @Field(() => String, { nullable: true })
  sideEffectFingerprint?: string;

  @Field(() => String, { nullable: true })
  sideEffectKind?: string;

  @Field(() => String, { nullable: true })
  sideEffectRecordId?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  sideEffectSummary?: Record<string, unknown>;
}

@ObjectType()
class CopilotRepairExecutionSideEffectType implements CopilotRepairExecutionSideEffectRecord {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  executionRequestId!: string;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  actorId!: string;

  @Field(() => String)
  sideEffectKind!: string;

  @Field(() => String)
  sideEffectRecordId!: string;

  @Field(() => String)
  sideEffectFingerprint!: string;

  @Field(() => GraphQLJSON)
  sideEffectSummary!: Record<string, unknown>;

  @Field(() => String)
  executorPayloadFingerprint!: string;

  @Field(() => SafeIntResolver)
  workerAttempt!: number;

  @Field(() => String)
  workerLeaseId!: string;

  @Field(() => Date)
  appliedAt!: Date;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType()
class CopilotAgentTimelineEventType implements CopilotAgentTimelineEventRecord {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  runId!: string;

  @Field(() => String, { nullable: true })
  stepId!: string | null;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  actorId!: string;

  @Field(() => String)
  eventType!: CopilotAgentTimelineEventRecord['eventType'];

  @Field(() => String)
  status!: string;

  @Field(() => SafeIntResolver)
  ordinal!: number;

  @Field(() => String)
  summary!: string;

  @Field(() => GraphQLJSON)
  payload!: Record<string, unknown>;

  @Field(() => String)
  eventFingerprint!: string;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType()
class CopilotAgentStepType implements CopilotAgentStepRecord {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  runId!: string;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  actorId!: string;

  @Field(() => String)
  stepKey!: string;

  @Field(() => String)
  stepType!: CopilotAgentStepRecord['stepType'];

  @Field(() => String)
  status!: CopilotAgentStepRecord['status'];

  @Field(() => String, { nullable: true })
  title!: string | null;

  @Field(() => SafeIntResolver)
  order!: number;

  @Field(() => String)
  evidenceFingerprint!: string;

  @Field(() => GraphQLJSON)
  outputSummary!: Record<string, unknown>;

  @Field(() => Date, { nullable: true })
  startedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  completedAt!: Date | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType()
class CopilotAgentRuntimeExecutionResultType implements CopilotAgentRuntimeExecutionResultRecord {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  runId!: string;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  actorId!: string;

  @Field(() => String)
  workflow!: string;

  @Field(() => String)
  sourceType!: string;

  @Field(() => String)
  sourceId!: string;

  @Field(() => String)
  adapterWorkflow!: string;

  @Field(() => String)
  executor!: string;

  @Field(() => String)
  resultStatus!: CopilotAgentRuntimeExecutionResultRecord['resultStatus'];

  @Field(() => String)
  sideEffectMode!: string;

  @Field(() => Boolean)
  sideEffectsApplied!: boolean;

  @Field(() => String)
  summary!: string;

  @Field(() => String, { nullable: true })
  failureCode!: string | null;

  @Field(() => String, { nullable: true })
  failureMessage!: string | null;

  @Field(() => GraphQLJSON)
  resultPayload!: Record<string, unknown>;

  @Field(() => String)
  resultFingerprint!: string;

  @Field(() => SafeIntResolver)
  workerAttempt!: number;

  @Field(() => String)
  workerLeaseId!: string;

  @Field(() => Date)
  completedAt!: Date;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType()
class CopilotAgentRuntimeWorkflowAdapterCapabilitiesType implements CopilotAgentRuntimeWorkflowAdapterCapabilities {
  @Field(() => String)
  version!: string;

  @Field(() => [String])
  supportedStepTypes!: CopilotAgentRuntimeWorkflowAdapterCapabilities['supportedStepTypes'];

  @Field(() => String)
  sideEffectMode!: CopilotAgentRuntimeWorkflowAdapterCapabilities['sideEffectMode'];

  @Field(() => String)
  summary!: string;
}

@ObjectType()
class CopilotAgentRuntimeWorkflowAdapterType {
  @Field(() => String)
  workflow!: string;

  @Field(() => CopilotAgentRuntimeWorkflowAdapterCapabilitiesType)
  capabilities!: CopilotAgentRuntimeWorkflowAdapterCapabilities;
}

@ObjectType()
class CopilotAgentRunType implements CopilotAgentRunRecord {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  actorId!: string;

  sessionId!: string | null;

  @Field(() => String)
  workflow!: string;

  @Field(() => String)
  sourceType!: string;

  @Field(() => String)
  sourceId!: string;

  @Field(() => String)
  status!: CopilotAgentRunRecord['status'];

  @Field(() => String, { nullable: true })
  title!: string | null;

  @Field(() => String)
  targetFingerprint!: string;

  @Field(() => String)
  evidenceFingerprint!: string;

  @Field(() => String)
  timelineFingerprint!: string;

  @Field(() => Date, { nullable: true })
  startedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  completedAt!: Date | null;

  @Field(() => String, { nullable: true })
  failureCode!: string | null;

  @Field(() => String, { nullable: true })
  failureMessage!: string | null;

  @Field(() => Date, { nullable: true })
  queuedAt!: Date | null;

  @Field(() => String, { nullable: true })
  workerLeaseId!: string | null;

  @Field(() => Date, { nullable: true })
  workerLeaseExpiresAt!: Date | null;

  @Field(() => SafeIntResolver)
  workerAttempt!: number;

  @Field(() => SafeIntResolver)
  workerMaxAttempts!: number;

  @Field(() => Date, { nullable: true })
  lastAttemptAt!: Date | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => [CopilotAgentStepType])
  steps!: CopilotAgentStepRecord[];

  @Field(() => [CopilotAgentTimelineEventType])
  timelineEvents!: CopilotAgentTimelineEventRecord[];

  @Field(() => SafeIntResolver)
  executionResultCount!: number;

  @Field(() => [CopilotAgentRuntimeExecutionResultType])
  executionResults!: CopilotAgentRuntimeExecutionResultRecord[];
}

@ObjectType()
class CopilotTaskStepType {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  key!: string;

  @Field(() => String)
  type!: CopilotAgentStepRecord['stepType'];

  @Field(() => String)
  status!: CopilotAgentStepRecord['status'];

  @Field(() => String, { nullable: true })
  title!: string | null;

  @Field(() => SafeIntResolver)
  order!: number;

  @Field(() => Date, { nullable: true })
  startedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  completedAt!: Date | null;
}

@ObjectType()
class CopilotTaskApprovalType {
  @Field(() => String)
  stepId!: string;

  @Field(() => String)
  status!: 'approved' | 'cancelled' | 'rejected' | 'waiting';

  @Field(() => String, { nullable: true })
  title!: string | null;

  @Field(() => Date, { nullable: true })
  decidedAt!: Date | null;
}

@ObjectType()
class CopilotTaskArtifactType {
  @Field(() => String)
  workspaceId!: string;
  @Field(() => String)
  kind!: 'document' | 'office';

  @Field(() => String)
  id!: string;

  @Field(() => String, { nullable: true })
  title!: string | null;
}

@ObjectType()
class CopilotTaskDocumentUpdateType {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  docId!: string;

  @Field(() => String)
  content!: string;

  @Field(() => String)
  expectedVersion!: string;

  @Field(() => Boolean)
  needsReconfirmation!: boolean;

  @Field(() => String, { nullable: true })
  previousVersion!: string | null;
}

@ObjectType()
export class CopilotTaskType {
  @Field(() => String, { nullable: true })
  sessionId!: string | null;
  @Field(() => String, { nullable: true })
  approvalFingerprint!: string | null;

  @Field(() => CopilotTaskDocumentUpdateType, { nullable: true })
  documentUpdate!: CopilotTaskDocumentUpdateType | null;
  @Field(() => String)
  id!: string;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => String, { nullable: true })
  projectId!: string | null;

  @Field(() => String, { nullable: true })
  title!: string | null;

  @Field(() => String)
  workflow!: string;

  @Field(() => String)
  status!: CopilotAgentRunRecord['status'];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => Date, { nullable: true })
  startedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  completedAt!: Date | null;

  @Field(() => String, { nullable: true })
  failureCode!: string | null;

  @Field(() => String, { nullable: true })
  failureMessage!: string | null;

  @Field(() => String, { nullable: true })
  resultSummary!: string | null;

  @Field(() => [String])
  availableActions!: Array<
    'abandon' | 'approve' | 'cancel' | 'reject' | 'resume'
  >;

  @Field(() => Boolean)
  abandoned!: boolean;

  @Field(() => [CopilotTaskStepType])
  steps!: CopilotTaskStepType[];

  @Field(() => CopilotTaskApprovalType, { nullable: true })
  approval!: CopilotTaskApprovalType | null;

  @Field(() => [CopilotTaskArtifactType])
  artifacts!: CopilotTaskArtifactType[];

  @Field(() => GraphQLJSON, { nullable: true })
  approvalSummary!: Record<string, unknown> | null;

  @Field(() => GraphQLJSON, { nullable: true })
  resultEvidence!: Record<string, unknown> | null;
}

function copilotTaskPayloadRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function copilotTaskControlAction(
  run: CopilotAgentRunRecord
): 'abandon' | 'approve' | 'cancel' | 'reject' | 'resume' | null {
  for (let index = run.timelineEvents.length - 1; index >= 0; index--) {
    const payload = copilotTaskPayloadRecord(run.timelineEvents[index].payload);
    if (
      payload?.action === 'abandon' ||
      payload?.action === 'approve' ||
      payload?.action === 'cancel' ||
      payload?.action === 'reject' ||
      payload?.action === 'resume'
    ) {
      return payload.action;
    }
  }
  return null;
}

function copilotTaskDocumentId(run: CopilotAgentRunRecord) {
  for (const step of run.steps) {
    const output = copilotTaskPayloadRecord(step.outputSummary);
    const approvalRequest = copilotTaskPayloadRecord(output?.approvalRequest);
    const docUpdateRequest = copilotTaskPayloadRecord(output?.docUpdateRequest);
    const docId = approvalRequest?.docId ?? docUpdateRequest?.docId;
    if (typeof docId === 'string' && docId) return docId;
  }
  for (const result of run.executionResults) {
    const payload = copilotTaskPayloadRecord(result.resultPayload);
    const sideEffectSummary = copilotTaskPayloadRecord(
      payload?.sideEffectSummary
    );
    if (typeof sideEffectSummary?.docId === 'string') {
      return sideEffectSummary.docId;
    }
  }
  return null;
}

function copilotTaskDocumentUpdate(
  run: CopilotAgentRunRecord
): CopilotTaskDocumentUpdateType | null {
  for (const step of run.steps) {
    const request = copilotTaskPayloadRecord(
      step.outputSummary.docUpdateRequest
    );
    if (
      !request ||
      typeof request.docId !== 'string' ||
      typeof request.content !== 'string' ||
      typeof request.expectedDocumentVersion !== 'string'
    )
      continue;
    const reconfirmation = copilotTaskPayloadRecord(
      step.outputSummary.reconfirmationRequest
    );
    const needsReconfirmation =
      run.status === 'waiting_approval' &&
      reconfirmation?.previewStatus === 'invalidated' &&
      typeof reconfirmation.actualVersion === 'string';
    return {
      workspaceId:
        typeof request.sourceWorkspaceId === 'string'
          ? request.sourceWorkspaceId
          : run.workspaceId,
      docId: request.docId,
      content: request.content,
      expectedVersion: needsReconfirmation
        ? (reconfirmation.actualVersion as string)
        : request.expectedDocumentVersion,
      needsReconfirmation,
      previousVersion: needsReconfirmation
        ? request.expectedDocumentVersion
        : null,
    };
  }
  return null;
}

function copilotTaskOfficeArtifact(
  run: CopilotAgentRunRecord,
  approvalSummary: Record<string, unknown> | null,
  resultEvidence: Record<string, unknown> | null
) {
  if (run.workflow !== AGENT_RUNTIME_OFFICE_COMMAND_WORKFLOW) return null;
  const artifactId = approvalSummary?.artifactId ?? resultEvidence?.artifactId;
  if (typeof artifactId !== 'string' || !artifactId) return null;
  const artifactTitle = approvalSummary?.artifactTitle;
  const sourceFileName = approvalSummary?.sourceFileName;
  return {
    kind: 'office' as const,
    workspaceId: run.workspaceId,
    id: artifactId,
    title:
      typeof artifactTitle === 'string' && artifactTitle
        ? artifactTitle
        : typeof sourceFileName === 'string' && sourceFileName
          ? sourceFileName
          : run.title,
  };
}

function copilotTaskApprovalSummary(run: CopilotAgentRunRecord) {
  const approval = run.steps.find(step => step.stepType === 'approval');
  const output = copilotTaskPayloadRecord(approval?.outputSummary);
  return copilotTaskPayloadRecord(output?.approvalRequest);
}

function copilotTaskResultEvidence(run: CopilotAgentRunRecord) {
  const latestResult = run.executionResults[0];
  const payload = copilotTaskPayloadRecord(latestResult?.resultPayload);
  return copilotTaskPayloadRecord(payload?.sideEffectSummary);
}

function copilotTaskDelegatedArtifacts(
  run: CopilotAgentRunRecord,
  evidence: Record<string, unknown> | null
): CopilotTaskArtifactType[] {
  if (
    run.status !== 'completed' ||
    run.workflow !== 'agent_runtime_localmind_tool_agent' ||
    evidence?.version !== 'localmind-tool-agent-result/v1' ||
    !Array.isArray(evidence.artifacts)
  )
    return [];
  const artifacts = new Map<string, CopilotTaskArtifactType>();
  for (const value of evidence.artifacts.slice(0, 20)) {
    const artifact = copilotTaskPayloadRecord(value);
    if (
      artifact?.kind !== 'document' ||
      !['created', 'updated'].includes(String(artifact.relation)) ||
      typeof artifact.workspaceId !== 'string' ||
      !artifact.workspaceId ||
      artifact.workspaceId.length > 256 ||
      typeof artifact.documentId !== 'string' ||
      !artifact.documentId ||
      artifact.documentId.length > 256
    )
      continue;
    artifacts.set(`${artifact.workspaceId}:${artifact.documentId}`, {
      kind: 'document',
      workspaceId: artifact.workspaceId,
      id: artifact.documentId,
      title:
        typeof artifact.title === 'string'
          ? artifact.title.slice(0, 512)
          : null,
    });
  }
  return [...artifacts.values()];
}

export async function projectCopilotTaskForViewer(
  run: CopilotAgentRunRecord,
  userId: string,
  ac: PermissionAccess
) {
  const task = projectCopilotTask(run);
  if (run.workflow !== 'agent_runtime_localmind_tool_agent') return task;
  const artifacts: CopilotTaskArtifactType[] = [];
  for (const artifact of task.artifacts) {
    if (
      await ac
        .user(userId)
        .workspace(artifact.workspaceId)
        .doc(artifact.id)
        .can('Doc.Read')
    )
      artifacts.push(artifact);
  }
  if (artifacts.length !== task.artifacts.length) {
    task.resultEvidence = null;
    task.resultSummary = null;
  }
  return { ...task, artifacts };
}

export function projectCopilotTask(
  run: CopilotAgentRunRecord
): CopilotTaskType {
  const approvalStep = run.steps.find(step => step.stepType === 'approval');
  const controlAction = copilotTaskControlAction(run);
  const documentId = copilotTaskDocumentId(run);
  const documentUpdate = copilotTaskDocumentUpdate(run);
  const approvalSummary = copilotTaskApprovalSummary(run);
  const resultEvidence = copilotTaskResultEvidence(run);
  const officeArtifact = copilotTaskOfficeArtifact(
    run,
    approvalSummary,
    resultEvidence
  );
  const latestResult = run.executionResults[0];
  const availableActions: CopilotTaskType['availableActions'] =
    run.status === 'waiting_approval'
      ? ['approve', 'reject']
      : run.status === 'queued' ||
          run.status === 'running' ||
          run.status === 'waiting_for_location'
        ? ['cancel']
        : run.status === 'failed'
          ? ['resume', 'abandon']
          : run.status === 'cancelled' &&
              controlAction !== 'abandon' &&
              controlAction !== 'reject'
            ? ['resume']
            : [];

  return {
    id: run.id,
    sessionId: run.sessionId ?? null,
    approvalFingerprint:
      run.status === 'waiting_approval' ? run.timelineFingerprint : null,
    documentUpdate,
    workspaceId: run.workspaceId,
    projectId: run.projectId ?? null,
    title: run.title,
    workflow: run.workflow,
    status: run.status,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    failureCode: run.failureCode,
    failureMessage: run.failureMessage,
    resultSummary: latestResult?.summary ?? null,
    availableActions,
    abandoned: controlAction === 'abandon',
    steps: run.steps.map(step => ({
      id: step.id,
      key: step.stepKey,
      type: step.stepType,
      status: step.status,
      title: step.title,
      order: step.order,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
    })),
    approval: approvalStep
      ? {
          stepId: approvalStep.id,
          status:
            approvalStep.status === 'waiting_approval'
              ? 'waiting'
              : approvalStep.status === 'completed'
                ? 'approved'
                : controlAction === 'reject'
                  ? 'rejected'
                  : 'cancelled',
          title: approvalStep.title,
          decidedAt:
            approvalStep.status === 'waiting_approval'
              ? null
              : approvalStep.completedAt,
        }
      : null,
    artifacts: [
      ...copilotTaskDelegatedArtifacts(run, resultEvidence),
      ...(documentId
        ? [
            {
              kind: 'document' as const,
              workspaceId: documentUpdate?.workspaceId ?? run.workspaceId,
              id: documentId,
              title: run.title,
            },
          ]
        : []),
      ...(officeArtifact ? [officeArtifact] : []),
    ],
    approvalSummary,
    resultEvidence,
  };
}

@ObjectType()
class CopilotRepairExecutionAuditEventType implements CopilotRepairExecutionAuditEventRecord {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  executionRequestId!: string;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  actorId!: string;

  @Field(() => String)
  eventType!: CopilotRepairExecutionAuditEventRecord['eventType'];

  @Field(() => String)
  eventFingerprint!: string;

  @Field(() => GraphQLJSON)
  metadata!: CopilotRepairExecutionAuditEventRecord['metadata'];

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType()
class CopilotRepairExecutionRecordType implements CopilotRepairExecutionRecord {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  actorId!: string;

  @Field(() => String)
  promptName!: string;

  @Field(() => String)
  requestedAction!: string;

  @Field(() => String)
  status!: CopilotRepairExecutionRecord['status'];

  @Field(() => String)
  approvalState!: CopilotRepairExecutionRecord['approvalState'];

  @Field(() => String)
  permissionStatus!: string;

  @Field(() => String)
  idempotencyKey!: string;

  @Field(() => String)
  idempotencyFingerprint!: string;

  @Field(() => String)
  requestFingerprint!: string;

  @Field(() => String)
  candidateEvidenceSetFingerprint!: string;

  @Field(() => String)
  taskRouteEvidenceSetFingerprint!: string;

  @Field(() => String)
  targetLocatorFingerprint!: string;

  @Field(() => String)
  repairJobFingerprint!: string;

  @Field(() => String)
  approvalRecordFingerprint!: string;

  @Field(() => String)
  auditEventFingerprint!: string;

  @Field(() => CopilotRepairExecutionRuntimeResultType)
  runtimeResult!: CopilotRepairExecutionRuntimeResult;

  executorPayload!: CopilotRepairExecutionRecord['executorPayload'];

  @Field(() => String, { nullable: true })
  failureCode!: string | null;

  @Field(() => String, { nullable: true })
  failureMessage!: string | null;

  @Field(() => Date, { nullable: true })
  queuedAt!: Date | null;

  @Field(() => String, { nullable: true })
  workerLeaseId!: string | null;

  @Field(() => Date, { nullable: true })
  workerLeaseExpiresAt!: Date | null;

  @Field(() => SafeIntResolver)
  workerAttempt!: number;

  @Field(() => SafeIntResolver)
  workerMaxAttempts!: number;

  @Field(() => Date, { nullable: true })
  lastAttemptAt!: Date | null;

  @Field(() => Date, { nullable: true })
  completedAt!: Date | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => SafeIntResolver)
  auditEventCount!: number;

  @Field(() => [CopilotRepairExecutionAuditEventType])
  auditEvents!: CopilotRepairExecutionAuditEventRecord[];

  @Field(() => SafeIntResolver)
  sideEffectCount!: number;

  @Field(() => [CopilotRepairExecutionSideEffectType])
  sideEffects!: CopilotRepairExecutionSideEffectRecord[];

  @Field(() => CopilotAgentRunType, { nullable: true })
  agentRun?: CopilotAgentRunRecord | null;
}

@ObjectType()
class CopilotPromptRegistryRepairExecutionRequestType implements CopilotPromptRegistryRepairExecutionRequest {
  @Field(() => Boolean)
  accepted!: boolean;

  @Field(() => Boolean)
  executionRequested!: boolean;

  @Field(() => CopilotRepairExecutionRecordType, { nullable: true })
  executionRecord?: CopilotRepairExecutionRecord | null;

  @Field(() => String)
  expectedCandidateEvidenceSetFingerprint!: string;

  @Field(() => String)
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprint!: string;

  @Field(() => [String])
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs!: string[];

  @Field(() => String)
  expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion!: string;

  @Field(() => String)
  expectedEmbeddingIndexContractEvidenceSetFingerprint!: string;

  @Field(() => String)
  expectedRerankRuntimeContractEvidenceSetFingerprint!: string;

  @Field(() => String)
  expectedPreparedRouteOrderEvidenceSetFingerprint!: string;

  @Field(() => String)
  expectedTargetLocatorFingerprint!: string;

  @Field(() => String)
  expectedRepairGateManifestFingerprint!: string;

  @Field(() => String)
  expectedRepairGateManifestExportPolicyFingerprint!: string;

  @Field(() => String)
  expectedRepairGateManifestRetentionPolicyFingerprint!: string;

  @Field(() => Boolean)
  approvalRecordRequestCreated!: boolean;

  @Field(() => String)
  approvalRecordRequestFingerprint!: string;

  @Field(() => [String])
  approvalRecordRequestInputs!: string[];

  @Field(() => String)
  approvalRecordRequestStatus!: string;

  @Field(() => String)
  approvalRecordRequestVersion!: string;

  @Field(() => Boolean)
  auditEventRequestCreated!: boolean;

  @Field(() => String)
  auditEventRequestFingerprint!: string;

  @Field(() => [String])
  auditEventRequestInputs!: string[];

  @Field(() => String)
  auditEventRequestStatus!: string;

  @Field(() => String)
  auditEventRequestVersion!: string;

  @Field(() => Boolean)
  executionCompletionEventRequestCreated!: boolean;

  @Field(() => String)
  executionCompletionEventRequestFingerprint!: string;

  @Field(() => [String])
  executionCompletionEventRequestInputs!: string[];

  @Field(() => String)
  executionCompletionEventRequestStatus!: string;

  @Field(() => String)
  executionCompletionEventRequestVersion!: string;

  @Field(() => Boolean)
  executionCompletionRequestCreated!: boolean;

  @Field(() => String)
  executionCompletionRequestFingerprint!: string;

  @Field(() => [String])
  executionCompletionRequestInputs!: string[];

  @Field(() => String)
  executionCompletionRequestStatus!: string;

  @Field(() => String)
  executionCompletionRequestVersion!: string;

  @Field(() => Boolean)
  executionFinalizationEventRequestCreated!: boolean;

  @Field(() => String)
  executionFinalizationEventRequestFingerprint!: string;

  @Field(() => [String])
  executionFinalizationEventRequestInputs!: string[];

  @Field(() => String)
  executionFinalizationEventRequestStatus!: string;

  @Field(() => String)
  executionFinalizationEventRequestVersion!: string;

  @Field(() => Boolean)
  executionFinalizationRequestCreated!: boolean;

  @Field(() => String)
  executionFinalizationRequestFingerprint!: string;

  @Field(() => [String])
  executionFinalizationRequestInputs!: string[];

  @Field(() => String)
  executionFinalizationRequestStatus!: string;

  @Field(() => String)
  executionFinalizationRequestVersion!: string;

  @Field(() => Boolean)
  executionStatusPollRequestCreated!: boolean;

  @Field(() => String)
  executionStatusPollRequestFingerprint!: string;

  @Field(() => [String])
  executionStatusPollRequestInputs!: string[];

  @Field(() => String)
  executionStatusPollRequestStatus!: string;

  @Field(() => String)
  executionStatusPollRequestVersion!: string;

  @Field(() => Boolean)
  executionOperationEntryRequestCreated!: boolean;

  @Field(() => String)
  executionOperationEntryRequestFingerprint!: string;

  @Field(() => [String])
  executionOperationEntryRequestInputs!: string[];

  @Field(() => String)
  executionOperationEntryRequestStatus!: string;

  @Field(() => String)
  executionOperationEntryRequestVersion!: string;

  @Field(() => Boolean)
  executionApprovalUiRequestCreated!: boolean;

  @Field(() => String)
  executionApprovalUiRequestFingerprint!: string;

  @Field(() => [String])
  executionApprovalUiRequestInputs!: string[];

  @Field(() => String)
  executionApprovalUiRequestStatus!: string;

  @Field(() => String)
  executionApprovalUiRequestVersion!: string;

  @Field(() => Boolean)
  executionDiffPreviewRequestCreated!: boolean;

  @Field(() => String)
  executionDiffPreviewRequestFingerprint!: string;

  @Field(() => [String])
  executionDiffPreviewRequestInputs!: string[];

  @Field(() => String)
  executionDiffPreviewRequestStatus!: string;

  @Field(() => String)
  executionDiffPreviewRequestVersion!: string;

  @Field(() => Boolean)
  executionApprovalDecisionRequestCreated!: boolean;

  @Field(() => String)
  executionApprovalDecisionRequestFingerprint!: string;

  @Field(() => [String])
  executionApprovalDecisionRequestInputs!: string[];

  @Field(() => String)
  executionApprovalDecisionRequestStatus!: string;

  @Field(() => String)
  executionApprovalDecisionRequestVersion!: string;

  @Field(() => Boolean)
  executionStartRequestCreated!: boolean;

  @Field(() => String)
  executionStartRequestFingerprint!: string;

  @Field(() => [String])
  executionStartRequestInputs!: string[];

  @Field(() => String)
  executionStartRequestStatus!: string;

  @Field(() => String)
  executionStartRequestVersion!: string;

  @Field(() => Boolean)
  executionQueueRequestCreated!: boolean;

  @Field(() => String)
  executionQueueRequestFingerprint!: string;

  @Field(() => [String])
  executionQueueRequestInputs!: string[];

  @Field(() => String)
  executionQueueRequestStatus!: string;

  @Field(() => String)
  executionQueueRequestVersion!: string;

  @Field(() => Boolean)
  executionWorkerLeaseRequestCreated!: boolean;

  @Field(() => String)
  executionWorkerLeaseRequestFingerprint!: string;

  @Field(() => [String])
  executionWorkerLeaseRequestInputs!: string[];

  @Field(() => String)
  executionWorkerLeaseRequestStatus!: string;

  @Field(() => String)
  executionWorkerLeaseRequestVersion!: string;

  @Field(() => Boolean)
  executionJobRunRequestCreated!: boolean;

  @Field(() => String)
  executionJobRunRequestFingerprint!: string;

  @Field(() => [String])
  executionJobRunRequestInputs!: string[];

  @Field(() => String)
  executionJobRunRequestStatus!: string;

  @Field(() => String)
  executionJobRunRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepRequestInputs!: string[];

  @Field(() => String)
  executionRunStepRequestStatus!: string;

  @Field(() => String)
  executionRunStepRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepTraceRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepTraceRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepTraceRequestInputs!: string[];

  @Field(() => String)
  executionRunStepTraceRequestStatus!: string;

  @Field(() => String)
  executionRunStepTraceRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepResultRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepResultRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepResultRequestInputs!: string[];

  @Field(() => String)
  executionRunStepResultRequestStatus!: string;

  @Field(() => String)
  executionRunStepResultRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepCompletionRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepCompletionRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepCompletionRequestInputs!: string[];

  @Field(() => String)
  executionRunStepCompletionRequestStatus!: string;

  @Field(() => String)
  executionRunStepCompletionRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepStatusEventRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepStatusEventRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepStatusEventRequestInputs!: string[];

  @Field(() => String)
  executionRunStepStatusEventRequestStatus!: string;

  @Field(() => String)
  executionRunStepStatusEventRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepRetryRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepRetryRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepRetryRequestInputs!: string[];

  @Field(() => String)
  executionRunStepRetryRequestStatus!: string;

  @Field(() => String)
  executionRunStepRetryRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepRetryAttemptRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepRetryAttemptRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepRetryAttemptRequestInputs!: string[];

  @Field(() => String)
  executionRunStepRetryAttemptRequestStatus!: string;

  @Field(() => String)
  executionRunStepRetryAttemptRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepRetryAttemptStatusEventRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepRetryAttemptStatusEventRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepRetryAttemptStatusEventRequestInputs!: string[];

  @Field(() => String)
  executionRunStepRetryAttemptStatusEventRequestStatus!: string;

  @Field(() => String)
  executionRunStepRetryAttemptStatusEventRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepRetryAttemptTraceRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepRetryAttemptTraceRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepRetryAttemptTraceRequestInputs!: string[];

  @Field(() => String)
  executionRunStepRetryAttemptTraceRequestStatus!: string;

  @Field(() => String)
  executionRunStepRetryAttemptTraceRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepRetryAttemptResultRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepRetryAttemptResultRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepRetryAttemptResultRequestInputs!: string[];

  @Field(() => String)
  executionRunStepRetryAttemptResultRequestStatus!: string;

  @Field(() => String)
  executionRunStepRetryAttemptResultRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepRetryAttemptCompletionRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepRetryAttemptCompletionRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepRetryAttemptCompletionRequestInputs!: string[];

  @Field(() => String)
  executionRunStepRetryAttemptCompletionRequestStatus!: string;

  @Field(() => String)
  executionRunStepRetryAttemptCompletionRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepRetryAttemptCompletionStatusEventRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepRetryAttemptCompletionStatusEventRequestInputs!: string[];

  @Field(() => String)
  executionRunStepRetryAttemptCompletionStatusEventRequestStatus!: string;

  @Field(() => String)
  executionRunStepRetryAttemptCompletionStatusEventRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepRetryAttemptFinalizationRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepRetryAttemptFinalizationRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepRetryAttemptFinalizationRequestInputs!: string[];

  @Field(() => String)
  executionRunStepRetryAttemptFinalizationRequestStatus!: string;

  @Field(() => String)
  executionRunStepRetryAttemptFinalizationRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepRetryAttemptFinalizationStatusEventRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepRetryAttemptFinalizationStatusEventRequestInputs!: string[];

  @Field(() => String)
  executionRunStepRetryAttemptFinalizationStatusEventRequestStatus!: string;

  @Field(() => String)
  executionRunStepRetryAttemptFinalizationStatusEventRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepRetryAttemptCloseRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepRetryAttemptCloseRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepRetryAttemptCloseRequestInputs!: string[];

  @Field(() => String)
  executionRunStepRetryAttemptCloseRequestStatus!: string;

  @Field(() => String)
  executionRunStepRetryAttemptCloseRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepRetryAttemptCloseStatusEventRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepRetryAttemptCloseStatusEventRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepRetryAttemptCloseStatusEventRequestInputs!: string[];

  @Field(() => String)
  executionRunStepRetryAttemptCloseStatusEventRequestStatus!: string;

  @Field(() => String)
  executionRunStepRetryAttemptCloseStatusEventRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepRetryAttemptRetentionPolicyRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepRetryAttemptRetentionPolicyRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepRetryAttemptRetentionPolicyRequestInputs!: string[];

  @Field(() => String)
  executionRunStepRetryAttemptRetentionPolicyRequestStatus!: string;

  @Field(() => String)
  executionRunStepRetryAttemptRetentionPolicyRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepRetryAttemptRetentionPolicyRuleRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepRetryAttemptRetentionPolicyRuleRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepRetryAttemptRetentionPolicyRuleRequestInputs!: string[];

  @Field(() => String)
  executionRunStepRetryAttemptRetentionPolicyRuleRequestStatus!: string;

  @Field(() => String)
  executionRunStepRetryAttemptRetentionPolicyRuleRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepRetryAttemptRetentionLeaseRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepRetryAttemptRetentionLeaseRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepRetryAttemptRetentionLeaseRequestInputs!: string[];

  @Field(() => String)
  executionRunStepRetryAttemptRetentionLeaseRequestStatus!: string;

  @Field(() => String)
  executionRunStepRetryAttemptRetentionLeaseRequestVersion!: string;

  @Field(() => Boolean)
  executionRunStepRetryAttemptArchiveRequestCreated!: boolean;

  @Field(() => String)
  executionRunStepRetryAttemptArchiveRequestFingerprint!: string;

  @Field(() => [String])
  executionRunStepRetryAttemptArchiveRequestInputs!: string[];

  @Field(() => String)
  executionRunStepRetryAttemptArchiveRequestStatus!: string;

  @Field(() => String)
  executionRunStepRetryAttemptArchiveRequestVersion!: string;

  @Field(() => Boolean)
  executionFailureEventRequestCreated!: boolean;

  @Field(() => String)
  executionFailureEventRequestFingerprint!: string;

  @Field(() => [String])
  executionFailureEventRequestInputs!: string[];

  @Field(() => String)
  executionFailureEventRequestStatus!: string;

  @Field(() => String)
  executionFailureEventRequestVersion!: string;

  @Field(() => Boolean)
  executionProviderResponseRequestCreated!: boolean;

  @Field(() => String)
  executionProviderResponseRequestFingerprint!: string;

  @Field(() => [String])
  executionProviderResponseRequestInputs!: string[];

  @Field(() => String)
  executionProviderResponseRequestStatus!: string;

  @Field(() => String)
  executionProviderResponseRequestVersion!: string;

  @Field(() => Boolean)
  executionResultRequestCreated!: boolean;

  @Field(() => String)
  executionResultRequestFingerprint!: string;

  @Field(() => [String])
  executionResultRequestInputs!: string[];

  @Field(() => String)
  executionResultRequestStatus!: string;

  @Field(() => String)
  executionResultRequestVersion!: string;

  @Field(() => Boolean)
  executionRetryPolicyRequestCreated!: boolean;

  @Field(() => String)
  executionRetryPolicyRequestFingerprint!: string;

  @Field(() => [String])
  executionRetryPolicyRequestInputs!: string[];

  @Field(() => String)
  executionRetryPolicyRequestStatus!: string;

  @Field(() => String)
  executionRetryPolicyRequestVersion!: string;

  @Field(() => Boolean)
  executionRollbackExecutorRequestCreated!: boolean;

  @Field(() => String)
  executionRollbackExecutorRequestFingerprint!: string;

  @Field(() => [String])
  executionRollbackExecutorRequestInputs!: string[];

  @Field(() => String)
  executionRollbackExecutorRequestStatus!: string;

  @Field(() => String)
  executionRollbackExecutorRequestVersion!: string;

  @Field(() => Boolean)
  executionRollbackOperationRequestCreated!: boolean;

  @Field(() => String)
  executionRollbackOperationRequestFingerprint!: string;

  @Field(() => [String])
  executionRollbackOperationRequestInputs!: string[];

  @Field(() => String)
  executionRollbackOperationRequestStatus!: string;

  @Field(() => String)
  executionRollbackOperationRequestVersion!: string;

  @Field(() => Boolean)
  executionRollbackOutcomeRequestCreated!: boolean;

  @Field(() => String)
  executionRollbackOutcomeRequestFingerprint!: string;

  @Field(() => [String])
  executionRollbackOutcomeRequestInputs!: string[];

  @Field(() => String)
  executionRollbackOutcomeRequestStatus!: string;

  @Field(() => String)
  executionRollbackOutcomeRequestVersion!: string;

  @Field(() => Boolean)
  executionRollbackTriggerRequestCreated!: boolean;

  @Field(() => String)
  executionRollbackTriggerRequestFingerprint!: string;

  @Field(() => [String])
  executionRollbackTriggerRequestInputs!: string[];

  @Field(() => String)
  executionRollbackTriggerRequestStatus!: string;

  @Field(() => String)
  executionRollbackTriggerRequestVersion!: string;

  @Field(() => Boolean)
  executionTraceRequestCreated!: boolean;

  @Field(() => String)
  executionTraceRequestFingerprint!: string;

  @Field(() => [String])
  executionTraceRequestInputs!: string[];

  @Field(() => String)
  executionTraceRequestStatus!: string;

  @Field(() => String)
  executionTraceRequestVersion!: string;

  @Field(() => Boolean)
  executionStateRequestCreated!: boolean;

  @Field(() => String)
  executionStateRequestFingerprint!: string;

  @Field(() => [String])
  executionStateRequestInputs!: string[];

  @Field(() => String)
  executionStateRequestStatus!: string;

  @Field(() => String)
  executionStateRequestVersion!: string;

  @Field(() => Boolean)
  repairJobRequestCreated!: boolean;

  @Field(() => String)
  repairJobRequestFingerprint!: string;

  @Field(() => [String])
  repairJobRequestInputs!: string[];

  @Field(() => String)
  repairJobRequestStatus!: string;

  @Field(() => String)
  repairJobRequestVersion!: string;

  @Field(() => Boolean)
  rollbackPlanRequestCreated!: boolean;

  @Field(() => String)
  rollbackPlanRequestFingerprint!: string;

  @Field(() => [String])
  rollbackPlanRequestInputs!: string[];

  @Field(() => String)
  rollbackPlanRequestStatus!: string;

  @Field(() => String)
  rollbackPlanRequestVersion!: string;

  @Field(() => Boolean)
  idempotencyLockAcquired!: boolean;

  @Field(() => String)
  idempotencyLockFingerprint!: string;

  @Field(() => [String])
  idempotencyLockInputs!: string[];

  @Field(() => String)
  idempotencyLockScope!: string;

  @Field(() => String)
  idempotencyLockStatus!: string;

  @Field(() => String)
  idempotencyLockVersion!: string;

  @Field(() => [String])
  matchedFields!: string[];

  @Field(() => [String])
  mismatchedFields!: string[];

  @Field(() => Boolean)
  mutationAvailable!: boolean;

  @Field(() => CopilotPromptRegistryRepairPreflightType)
  preflight!: CopilotPromptRegistryRepairPreflight;

  @Field(() => Boolean)
  readOnly!: boolean;

  @Field(() => String)
  requestFingerprint!: string;

  @Field(() => [String])
  requestInputs!: string[];

  @Field(() => String)
  requestStatus!: string;

  @Field(() => String)
  requestVersion!: string;

  @Field(() => Boolean)
  supportBundleArtifactCreated!: boolean;

  @Field(() => String)
  supportBundleArtifactFingerprint!: string;

  @Field(() => [String])
  supportBundleArtifactInputs!: string[];

  @Field(() => Boolean)
  supportBundleArtifactRecordRequestCreated!: boolean;

  @Field(() => String)
  supportBundleArtifactRecordRequestFingerprint!: string;

  @Field(() => [String])
  supportBundleArtifactRecordRequestInputs!: string[];

  @Field(() => String)
  supportBundleArtifactRecordRequestStatus!: string;

  @Field(() => String)
  supportBundleArtifactRecordRequestVersion!: string;

  @Field(() => String)
  supportBundleArtifactStatus!: string;

  @Field(() => String)
  supportBundleArtifactVersion!: string;

  @Field(() => String)
  supportBundleArchiveFormat!: string;

  @Field(() => Boolean)
  supportBundleArchiveRequestCreated!: boolean;

  @Field(() => String)
  supportBundleArchiveRequestFingerprint!: string;

  @Field(() => [String])
  supportBundleArchiveRequestInputs!: string[];

  @Field(() => String)
  supportBundleArchiveRequestStatus!: string;

  @Field(() => String)
  supportBundleArchiveRequestVersion!: string;

  @Field(() => String)
  supportBundleArchiveScope!: string;

  @Field(() => String)
  supportBundleArchiveSignaturePolicy!: string;

  @Field(() => Boolean)
  supportBundleArchiveSignatureRequestCreated!: boolean;

  @Field(() => String)
  supportBundleArchiveSignatureRequestFingerprint!: string;

  @Field(() => [String])
  supportBundleArchiveSignatureRequestInputs!: string[];

  @Field(() => String)
  supportBundleArchiveSignatureRequestStatus!: string;

  @Field(() => String)
  supportBundleArchiveSignatureRequestVersion!: string;

  @Field(() => Boolean)
  supportBundleAuditPersistenceRequestCreated!: boolean;

  @Field(() => String)
  supportBundleAuditPersistenceRequestFingerprint!: string;

  @Field(() => [String])
  supportBundleAuditPersistenceRequestInputs!: string[];

  @Field(() => String)
  supportBundleAuditPersistenceRequestStatus!: string;

  @Field(() => String)
  supportBundleAuditPersistenceRequestVersion!: string;

  @Field(() => String)
  supportBundleAuditPersistenceStatus!: string;

  @Field(() => Boolean)
  supportBundleDownloadAuthorizationRequestCreated!: boolean;

  @Field(() => String)
  supportBundleDownloadAuthorizationRequestFingerprint!: string;

  @Field(() => [String])
  supportBundleDownloadAuthorizationRequestInputs!: string[];

  @Field(() => String)
  supportBundleDownloadAuthorizationRequestStatus!: string;

  @Field(() => String)
  supportBundleDownloadAuthorizationRequestVersion!: string;

  @Field(() => String)
  supportBundleDownloadAuthorizationStatus!: string;

  @Field(() => Boolean)
  supportBundleDownloadResolverRequestCreated!: boolean;

  @Field(() => String)
  supportBundleDownloadResolverRequestFingerprint!: string;

  @Field(() => [String])
  supportBundleDownloadResolverRequestInputs!: string[];

  @Field(() => String)
  supportBundleDownloadResolverRequestStatus!: string;

  @Field(() => String)
  supportBundleDownloadResolverRequestVersion!: string;

  @Field(() => String)
  supportBundleDownloadResolverRoute!: string;

  @Field(() => String)
  supportBundleManifestFilename!: string;

  @Field(() => String)
  supportBundleManifestFingerprint!: string;

  @Field(() => String)
  supportBundleManifestMetadataFilename!: string;

  @Field(() => String)
  supportBundleManifestMetadataFingerprint!: string;

  @Field(() => Boolean)
  supportBundlePackageCreated!: boolean;

  @Field(() => String)
  supportBundlePackageFingerprint!: string;

  @Field(() => [String])
  supportBundlePackageInputs!: string[];

  @Field(() => String)
  supportBundlePackageStatus!: string;

  @Field(() => String)
  supportBundlePackageVersion!: string;

  @Field(() => Boolean)
  supportBundleRetentionCleanupRequestCreated!: boolean;

  @Field(() => String)
  supportBundleRetentionCleanupRequestFingerprint!: string;

  @Field(() => [String])
  supportBundleRetentionCleanupRequestInputs!: string[];

  @Field(() => String)
  supportBundleRetentionCleanupRequestStatus!: string;

  @Field(() => String)
  supportBundleRetentionCleanupRequestVersion!: string;

  @Field(() => String)
  supportBundleRetentionCleanupStatus!: string;

  @Field(() => String)
  supportBundleSignedUrlPolicy!: string;

  @Field(() => Boolean)
  supportBundleSignedUrlRequestCreated!: boolean;

  @Field(() => String)
  supportBundleSignedUrlRequestFingerprint!: string;

  @Field(() => [String])
  supportBundleSignedUrlRequestInputs!: string[];

  @Field(() => String)
  supportBundleSignedUrlRequestStatus!: string;

  @Field(() => String)
  supportBundleSignedUrlRequestVersion!: string;

  @Field(() => String)
  supportBundleSignedUrlScope!: string;

  @Field(() => Boolean)
  supportBundleStorageKeyRequestCreated!: boolean;

  @Field(() => String)
  supportBundleStorageKeyRequestFingerprint!: string;

  @Field(() => [String])
  supportBundleStorageKeyRequestInputs!: string[];

  @Field(() => String)
  supportBundleStorageKeyRequestStatus!: string;

  @Field(() => String)
  supportBundleStorageKeyRequestVersion!: string;

  @Field(() => String)
  supportBundleStorageKeyScope!: string;

  @Field(() => String)
  supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprint!: string;

  @Field(() => [String])
  supportBundleTaskRouteEffectiveSourceEvidenceSetDiagnosticsFingerprints!: string[];

  @Field(() => [
    CopilotPromptRegistryRepairExecutionRequestSourceEvidenceEntryType,
  ])
  supportBundleTaskRouteEffectiveSourceEvidenceSetEntries!: CopilotPromptRegistryRepairExecutionRequestSourceEvidenceEntry[];

  @Field(() => [String])
  supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprintInputs!: string[];

  @Field(() => [String])
  supportBundleTaskRouteEffectiveSourceEvidenceSetOperationFingerprints!: string[];

  @Field(() => [String])
  supportBundleTaskRouteEffectiveSourceEvidenceSetSourceFingerprints!: string[];

  @Field(() => String)
  supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprintVersion!: string;
}

@ObjectType()
class CopilotPromptRegistryPublishGateVerdictType implements PromptRegistryPublishGateVerdict {
  @Field(() => CopilotPromptRegistryPublishGateActionRouteDryRunType, {
    nullable: true,
  })
  actionRouteDryRun?: CopilotPromptRegistryPublishGateActionRouteDryRun;

  @Field(() => Boolean)
  allowed!: PromptRegistryPublishGateVerdict['allowed'];

  @Field(() => SafeIntResolver)
  blockingCount!: PromptRegistryPublishGateVerdict['blockingCount'];

  @Field(() => SafeIntResolver)
  errorCount!: PromptRegistryPublishGateVerdict['errorCount'];

  @Field(() => SafeIntResolver)
  issueCount!: PromptRegistryPublishGateVerdict['issueCount'];

  @Field(() => [CopilotPromptRegistryValidationIssueType])
  issues!: PromptRegistryPublishGateVerdict['issues'];

  @Field(() => CopilotPromptRegistryPublishGateModelRouteType, {
    nullable: true,
  })
  modelRoute?: CopilotPromptRegistryPublishGateModelRoute;

  @Field(() => [CopilotPromptRegistryPublishGateModelRouteType])
  modelRoutes!: CopilotPromptRegistryPublishGateModelRoute[];

  @Field(() => [CopilotTaskRouteDiagnosticsType])
  taskRoutes!: CopilotPromptRegistryPublishGateTaskRoute[];

  @Field(() => String)
  name!: PromptRegistryPublishGateVerdict['name'];

  @Field(() => String)
  publishStatus!: PromptRegistryPublishGateVerdict['publishStatus'];

  @Field(() => String)
  reason!: PromptRegistryPublishGateVerdict['reason'];

  @Field(() => String)
  registryFingerprint!: PromptRegistryPublishGateVerdict['registryFingerprint'];

  @Field(() => SafeIntResolver)
  registryId!: PromptRegistryPublishGateVerdict['registryId'];

  @Field(() => Date)
  registryUpdatedAt!: PromptRegistryPublishGateVerdict['registryUpdatedAt'];

  @Field(() => [CopilotPromptRegistryValidationRemediationType])
  remediations!: PromptRegistryPublishGateVerdict['remediations'];

  @Field(() => [CopilotPromptRegistryPublishGateRepairRecommendationType])
  repairRecommendations!: CopilotPromptRegistryPublishGateRepairRecommendation[];

  @Field(() => [CopilotPromptRegistryPublishGateRepairActionCatalogEntryType])
  repairActionCatalog!: CopilotPromptRegistryPublishGateRepairActionCatalogEntry[];

  @Field(() => String)
  repairActionCatalogFingerprint!: string;

  @Field(() => CopilotPromptRegistryPublishGateRepairActionMutationGuardType)
  repairActionMutationGuard!: CopilotPromptRegistryPublishGateRepairActionMutationGuard;

  @Field(() => CopilotPromptRegistryPublishGateRepairActionPreviewType)
  repairActionPreview!: CopilotPromptRegistryPublishGateRepairActionPreview;

  @Field(() => CopilotPromptRegistryPublishGateRepairGateManifestType)
  repairGateManifest!: CopilotPromptRegistryPublishGateRepairGateManifest;

  @Field(
    () => CopilotPromptRegistryPublishGateRepairGateManifestExportMetadataType
  )
  repairGateManifestExportMetadata!: CopilotPromptRegistryPublishGateRepairGateManifestExportMetadata;

  @Field(() => Boolean)
  stale!: PromptRegistryPublishGateVerdict['stale'];

  @Field(() => [String])
  staleReasons!: PromptRegistryPublishGateVerdict['staleReasons'];

  @Field(() => String)
  status!: PromptRegistryPublishGateVerdict['status'];
}

@ObjectType()
class CopilotPromptCatalogVersionEvidenceType implements PromptCatalogVersionEvidence {
  @Field(() => String)
  revision!: string;

  @Field(() => String)
  fingerprint!: string;

  @Field(() => String)
  modelStrategyFingerprint!: string;

  @Field(() => String)
  templateFingerprint!: string;

  @Field(() => String, { nullable: true })
  defaultPolicy?: PromptCatalogVersionEvidence['defaultPolicy'];

  @Field(() => Boolean)
  overrideApplied!: boolean;

  @Field(() => String, { nullable: true })
  modelConfigPath?: PromptCatalogVersionEvidence['modelConfigPath'];

  @Field(() => String, { nullable: true })
  optionalModelsConfigPath?: PromptCatalogVersionEvidence['optionalModelsConfigPath'];

  @Field(() => String, { nullable: true })
  proModelsConfigPath?: PromptCatalogVersionEvidence['proModelsConfigPath'];

  @Field(() => String, { nullable: true })
  registryFingerprint?: PromptCatalogVersionEvidence['registryFingerprint'];

  @Field(() => SafeIntResolver, { nullable: true })
  registryId?: PromptCatalogVersionEvidence['registryId'];

  @Field(() => SafeIntResolver, { nullable: true })
  registryMessageCount?: PromptCatalogVersionEvidence['registryMessageCount'];

  @Field(() => Boolean, { nullable: true })
  registryModified?: PromptCatalogVersionEvidence['registryModified'];

  @Field(() => Date, { nullable: true })
  registryUpdatedAt?: PromptCatalogVersionEvidence['registryUpdatedAt'];

  @Field(() => String, { nullable: true })
  registryValidationDetail?: PromptCatalogVersionEvidence['registryValidationDetail'];

  @Field(() => SafeIntResolver, { nullable: true })
  registryValidationBlockingCount?: PromptCatalogVersionEvidence['registryValidationBlockingCount'];

  @Field(() => SafeIntResolver, { nullable: true })
  registryValidationErrorCount?: PromptCatalogVersionEvidence['registryValidationErrorCount'];

  @Field(() => SafeIntResolver, { nullable: true })
  registryValidationIssueCount?: PromptCatalogVersionEvidence['registryValidationIssueCount'];

  @Field(() => [CopilotPromptRegistryValidationIssueType], { nullable: true })
  registryValidationIssues?: PromptCatalogVersionEvidence['registryValidationIssues'];

  @Field(() => String, { nullable: true })
  registryValidationPublishStatus?: PromptCatalogVersionEvidence['registryValidationPublishStatus'];

  @Field(() => [CopilotPromptRegistryValidationRemediationType], {
    nullable: true,
  })
  registryValidationRemediations?: PromptCatalogVersionEvidence['registryValidationRemediations'];

  @Field(() => String, { nullable: true })
  registryValidationReason?: PromptCatalogVersionEvidence['registryValidationReason'];

  @Field(() => String, { nullable: true })
  registryValidationStatus?: PromptCatalogVersionEvidence['registryValidationStatus'];

  @Field(() => String, { nullable: true })
  registryRecordSource?: PromptCatalogVersionEvidence['registryRecordSource'];

  @Field(() => String, { nullable: true })
  registryRevision?: PromptCatalogVersionEvidence['registryRevision'];

  @Field(() => String, { nullable: true })
  registryRevisionActorId?: PromptCatalogVersionEvidence['registryRevisionActorId'];

  @Field(() => String, { nullable: true })
  registryRevisionFingerprint?: PromptCatalogVersionEvidence['registryRevisionFingerprint'];

  @Field(() => String, { nullable: true })
  registryRevisionId?: PromptCatalogVersionEvidence['registryRevisionId'];

  @Field(() => SafeIntResolver, { nullable: true })
  registryRevisionPublishEventCount?: PromptCatalogVersionEvidence['registryRevisionPublishEventCount'];

  @Field(() => [CopilotRegistryRevisionPublishEventType], {
    nullable: true,
  })
  registryRevisionPublishEvents?: PromptCatalogVersionEvidence['registryRevisionPublishEvents'];

  @Field(() => String, { nullable: true })
  registryRevisionScope?: PromptCatalogVersionEvidence['registryRevisionScope'];

  @Field(() => String, { nullable: true })
  registryRevisionStatus?: PromptCatalogVersionEvidence['registryRevisionStatus'];

  @Field(() => String, { nullable: true })
  registryRevisionWorkspaceId?: PromptCatalogVersionEvidence['registryRevisionWorkspaceId'];

  @Field(() => [CopilotPromptRegistrySourceChainEntryType], {
    nullable: true,
  })
  registrySourceChain?: PromptCatalogVersionEvidence['registrySourceChain'];

  @Field(() => String, { nullable: true })
  registrySourceChainFingerprint?: PromptCatalogVersionEvidence['registrySourceChainFingerprint'];
}

@ObjectType()
class CopilotPromptRegistrySourceChainEntryType implements PromptRegistrySourceChainEntry {
  @Field(() => String)
  source!: string;

  @Field(() => String)
  scope!: string;

  @Field(() => String)
  status!: string;

  @Field(() => String, { nullable: true })
  actorId?: string;

  @Field(() => String, { nullable: true })
  configPath?: string;

  @Field(() => String, { nullable: true })
  fingerprint?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  registryId?: number;

  @Field(() => String, { nullable: true })
  revision?: string;

  @Field(() => String, { nullable: true })
  updatedAt?: string;

  @Field(() => String, { nullable: true })
  workspaceId?: string;
}

@ObjectType()
class CopilotPromptCatalogItemType implements PromptCatalogItem {
  @Field(() => String)
  name!: string;

  @Field(() => String)
  revision!: string;

  @Field(() => String)
  fingerprint!: string;

  @Field(() => String)
  modelStrategyFingerprint!: string;

  @Field(() => String)
  templateFingerprint!: string;

  @Field(() => CopilotPromptCatalogVersionEvidenceType)
  versionEvidence!: PromptCatalogItem['versionEvidence'];

  @Field(() => String, { nullable: true })
  action?: string;

  @Field(() => String)
  model!: string;

  @Field(() => String)
  modelSource!: PromptCatalogItem['modelSource'];

  @Field(() => String, { nullable: true })
  modelConfigPath?: PromptCatalogItem['modelConfigPath'];

  @Field(() => [String])
  optionalModels!: string[];

  @Field(() => String)
  optionalModelsSource!: PromptCatalogItem['optionalModelsSource'];

  @Field(() => String, { nullable: true })
  optionalModelsConfigPath?: PromptCatalogItem['optionalModelsConfigPath'];

  @Field(() => SafeIntResolver)
  optionalModelCount!: number;

  @Field(() => [String])
  paramKeys!: string[];

  @Field(() => SafeIntResolver)
  paramCount!: number;

  @Field(() => String)
  source!: PromptCatalogItem['source'];

  @Field(() => String)
  category!: PromptCatalogItem['category'];

  @Field(() => String, { nullable: true })
  defaultPolicy?: PromptCatalogItem['defaultPolicy'];

  @Field(() => Boolean)
  overrideApplied!: boolean;

  @Field(() => SafeIntResolver)
  proModelCount!: number;

  @Field(() => String)
  proModelsSource!: PromptCatalogItem['proModelsSource'];

  @Field(() => String, { nullable: true })
  proModelsConfigPath?: PromptCatalogItem['proModelsConfigPath'];

  @Field(() => String, { nullable: true })
  registryFingerprint?: PromptCatalogItem['registryFingerprint'];

  @Field(() => SafeIntResolver, { nullable: true })
  registryId?: PromptCatalogItem['registryId'];

  @Field(() => SafeIntResolver, { nullable: true })
  registryMessageCount?: PromptCatalogItem['registryMessageCount'];

  @Field(() => Boolean, { nullable: true })
  registryModified?: PromptCatalogItem['registryModified'];

  @Field(() => Date, { nullable: true })
  registryUpdatedAt?: PromptCatalogItem['registryUpdatedAt'];

  @Field(() => String, { nullable: true })
  registryValidationDetail?: PromptCatalogItem['registryValidationDetail'];

  @Field(() => SafeIntResolver, { nullable: true })
  registryValidationBlockingCount?: PromptCatalogItem['registryValidationBlockingCount'];

  @Field(() => SafeIntResolver, { nullable: true })
  registryValidationErrorCount?: PromptCatalogItem['registryValidationErrorCount'];

  @Field(() => SafeIntResolver, { nullable: true })
  registryValidationIssueCount?: PromptCatalogItem['registryValidationIssueCount'];

  @Field(() => [CopilotPromptRegistryValidationIssueType], { nullable: true })
  registryValidationIssues?: PromptCatalogItem['registryValidationIssues'];

  @Field(() => String, { nullable: true })
  registryValidationPublishStatus?: PromptCatalogItem['registryValidationPublishStatus'];

  @Field(() => [CopilotPromptRegistryValidationRemediationType], {
    nullable: true,
  })
  registryValidationRemediations?: PromptCatalogItem['registryValidationRemediations'];

  @Field(() => String, { nullable: true })
  registryValidationReason?: PromptCatalogItem['registryValidationReason'];

  @Field(() => String, { nullable: true })
  registryValidationStatus?: PromptCatalogItem['registryValidationStatus'];

  @Field(() => String, { nullable: true })
  registryRecordSource?: PromptCatalogItem['registryRecordSource'];

  @Field(() => String, { nullable: true })
  registryRevision?: PromptCatalogItem['registryRevision'];

  @Field(() => String, { nullable: true })
  registryRevisionActorId?: PromptCatalogItem['registryRevisionActorId'];

  @Field(() => String, { nullable: true })
  registryRevisionFingerprint?: PromptCatalogItem['registryRevisionFingerprint'];

  @Field(() => String, { nullable: true })
  registryRevisionId?: PromptCatalogItem['registryRevisionId'];

  @Field(() => SafeIntResolver, { nullable: true })
  registryRevisionPublishEventCount?: PromptCatalogItem['registryRevisionPublishEventCount'];

  @Field(() => [CopilotRegistryRevisionPublishEventType], {
    nullable: true,
  })
  registryRevisionPublishEvents?: PromptCatalogItem['registryRevisionPublishEvents'];

  @Field(() => String, { nullable: true })
  registryRevisionScope?: PromptCatalogItem['registryRevisionScope'];

  @Field(() => String, { nullable: true })
  registryRevisionStatus?: PromptCatalogItem['registryRevisionStatus'];

  @Field(() => String, { nullable: true })
  registryRevisionWorkspaceId?: PromptCatalogItem['registryRevisionWorkspaceId'];

  @Field(() => [CopilotPromptRegistrySourceChainEntryType], {
    nullable: true,
  })
  registrySourceChain?: PromptCatalogItem['registrySourceChain'];

  @Field(() => String, { nullable: true })
  registrySourceChainFingerprint?: PromptCatalogItem['registrySourceChainFingerprint'];
}

@ObjectType()
class CopilotModelPromptSourceType implements CopilotModelPromptSource {
  @Field(() => String)
  candidateSource!: CopilotModelPromptSource['candidateSource'];

  @Field(() => String, { nullable: true })
  modelSource?: CopilotModelPromptSource['modelSource'];

  @Field(() => String, { nullable: true })
  modelConfigPath?: CopilotModelPromptSource['modelConfigPath'];
}

@ObjectType()
class CopilotActionRunAgentRuntimeTimelineItemType implements CopilotActionRunAgentRuntimeTimelineItem {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  eventKey!: string;

  @Field(() => SafeIntResolver)
  sequence!: number;

  @Field(() => String)
  eventType!: string;

  @Field(() => String)
  label!: string;

  @Field(() => String)
  runId!: string;

  @Field(() => String, { nullable: true })
  stepId!: string | null;

  @Field(() => String, { nullable: true })
  stepType!: string | null;

  @Field(() => String)
  status!: string;

  @Field(() => String, { nullable: true })
  kind!: string | null;

  @Field(() => SafeIntResolver)
  routeCount!: number;

  @Field(() => SafeIntResolver)
  actualRouteCount!: number;

  @Field(() => Boolean)
  routeCountMismatch!: boolean;

  @Field(() => [String])
  routeTargets!: string[];

  @Field(() => [String])
  fallbackProviderIds!: string[];

  @Field(() => [String])
  routeModelBackendKinds!: string[];

  @Field(() => [String])
  routeCanonicalModelKeys!: string[];

  @Field(() => [String])
  routeBehaviorFlags!: string[];

  @Field(() => [String])
  routeDimensionEvidence!: string[];

  @Field(() => String)
  routeEvidenceFingerprint!: string;
}

@ObjectType()
class CopilotActionRunAgentRuntimeDiagnosticsManifestType implements CopilotActionRunAgentRuntimeDiagnosticsManifest {
  @Field(() => String)
  version!: string;

  @Field(() => String)
  fingerprint!: string;

  @Field(() => String)
  actionId!: string;

  @Field(() => String)
  actionVersion!: string;

  @Field(() => String)
  runStatus!: string;

  @Field(() => String)
  projectionContractFingerprint!: string;

  @Field(() => String)
  timelineRouteEvidenceSetFingerprint!: string;

  @Field(() => String)
  projectionSource!: string;

  @Field(() => String)
  schemaReadiness!: string;

  @Field(() => [String])
  nativeTraceEventTypes!: string[];

  @Field(() => [String])
  timelineEventTypes!: string[];

  @Field(() => Boolean)
  hasPreparedRouteTrace!: boolean;

  @Field(() => SafeIntResolver)
  preparedRouteStepCount!: number;

  @Field(() => SafeIntResolver)
  preparedRouteCount!: number;

  @Field(() => SafeIntResolver)
  preparedRouteActualCount!: number;

  @Field(() => SafeIntResolver)
  timelineItemCount!: number;

  @Field(() => SafeIntResolver)
  projectionGapCount!: number;

  @Field(() => SafeIntResolver)
  timelineGapCount!: number;

  @Field(() => SafeIntResolver)
  schemaReadinessGapCount!: number;
}

@ObjectType()
class CopilotActionRunAgentRuntimeDiagnosticsManifestExportMetadataType implements CopilotActionRunAgentRuntimeDiagnosticsManifestExportMetadata {
  @Field(() => String)
  version!: string;

  @Field(() => String)
  artifact!: string;

  @Field(() => String)
  filename!: string;

  @Field(() => String)
  mime!: string;

  @Field(() => String)
  metadataFilename!: string;

  @Field(() => String)
  manifestVersion!: string;

  @Field(() => String)
  manifestFingerprint!: string;

  @Field(() => String)
  actionId!: string;

  @Field(() => String)
  actionVersion!: string;

  @Field(() => String)
  runId!: string;

  @Field(() => String)
  runStatus!: string;

  @Field(() => String)
  projectionSource!: string;

  @Field(() => String)
  schemaReadiness!: string;

  @Field(() => String)
  boundary!: string;

  @Field(() => String)
  exportPolicyVersion!: string;

  @Field(() => String)
  exportPolicyStatus!: string;

  @Field(() => String)
  exportPolicyFingerprint!: string;

  @Field(() => String)
  auditEventVersion!: string;

  @Field(() => String)
  auditEventStatus!: string;

  @Field(() => Boolean)
  auditEventCreated!: boolean;

  @Field(() => String)
  auditEventFingerprint!: string;

  @Field(() => String)
  retentionPolicyVersion!: string;

  @Field(() => String)
  retentionPolicyStatus!: string;

  @Field(() => String)
  retentionPolicyFingerprint!: string;
}

@ObjectType()
class CopilotSupportBundleSourceEvidenceSummaryType implements CopilotSupportBundleSourceEvidenceSummary {
  @Field(() => String)
  source!: string;

  @Field(() => SafeIntResolver)
  promptCatalogItemCount!: number;

  @Field(() => SafeIntResolver)
  actionRunCount!: number;

  @Field(() => SafeIntResolver)
  taskRouteCount!: number;

  @Field(() => [String])
  includedSections!: string[];
}

@ObjectType()
class CopilotSupportBundleRetentionType {
  @Field(() => String)
  status!: string;

  @Field(() => String)
  expiresAt!: string;
}

@ObjectType()
class CopilotSupportBundleManifestType implements CopilotSupportBundleManifest {
  @Field(() => String)
  version!: string;

  @Field(() => String)
  bundleId!: string;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  actorId!: string;

  @Field(() => String)
  createdAt!: string;

  @Field(() => String)
  expiresAt!: string;

  @Field(() => CopilotSupportBundleSourceEvidenceSummaryType)
  sourceEvidenceSummary!: CopilotSupportBundleSourceEvidenceSummary;

  @Field(() => String)
  sourceEvidenceSetFingerprint!: string;

  @Field(() => GraphQLJSON)
  archive!: CopilotSupportBundleManifest['archive'];

  @Field(() => CopilotSupportBundleRetentionType)
  retention!: CopilotSupportBundleManifest['retention'];
}

@ObjectType()
class CopilotSupportBundleAuditEventType implements CopilotSupportBundleAuditEventRecord {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  bundleId!: string;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  actorId!: string;

  @Field(() => String)
  eventType!: CopilotSupportBundleAuditEventRecord['eventType'];

  @Field(() => String)
  eventFingerprint!: string;

  @Field(() => GraphQLJSON)
  metadata!: CopilotSupportBundleAuditEventRecord['metadata'];

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType()
class CopilotSupportBundleTransferEventType implements CopilotSupportBundleTransferEventRecord {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  authorizationId!: string;

  @Field(() => String)
  artifactKind!: CopilotSupportBundleTransferEventRecord['artifactKind'];

  @Field(() => String)
  manifestFingerprint!: string;

  @Field(() => String)
  artifactFingerprint!: string;

  @Field(() => String)
  authorizationFingerprint!: string;

  @Field(() => String)
  deliveryMethod!: CopilotSupportBundleTransferEventRecord['deliveryMethod'];

  @Field(() => String, { nullable: true })
  eventId!: string | null;

  @Field(() => String)
  eventSource!: string;

  @Field(() => Date)
  transferredAt!: Date;

  @Field(() => String)
  notificationAuthEvidenceFingerprint!: string;

  @Field(() => String)
  storageKey!: string;

  @Field(() => SafeIntResolver)
  storageByteSize!: number;

  @Field(() => String)
  storageContentType!: string;

  @Field(() => String)
  eventFingerprint!: string;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType()
class CopilotSupportBundleTransferForwardingEventType implements CopilotSupportBundleTransferForwardingEventRecord {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  authorizationId!: string;

  @Field(() => String)
  status!: CopilotSupportBundleTransferForwardingEventRecord['status'];

  @Field(() => String, { nullable: true })
  eventId!: string | null;

  @Field(() => String)
  eventSource!: string;

  @Field(() => String)
  forwardingEventFingerprint!: string;

  @Field(() => GraphQLJSON)
  forwardingPayload!: Record<string, unknown>;

  @Field(() => String)
  forwardingPayloadFingerprint!: string;

  @Field(() => String, { nullable: true })
  providerSignatureEvidenceFingerprint!: string | null;

  @Field(() => String, { nullable: true })
  forwardedTransferEventFingerprint!: string | null;

  @Field(() => SafeIntResolver)
  attemptCount!: number;

  @Field(() => SafeIntResolver)
  maxAttempts!: number;

  @Field(() => Date, { nullable: true })
  nextAttemptAt!: Date | null;

  @Field(() => String, { nullable: true })
  workerLeaseId!: string | null;

  @Field(() => Date, { nullable: true })
  workerLeaseExpiresAt!: Date | null;

  @Field(() => Date, { nullable: true })
  lastAttemptAt!: Date | null;

  @Field(() => Date, { nullable: true })
  forwardedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  deadLetteredAt!: Date | null;

  @Field(() => String, { nullable: true })
  failureCode!: string | null;

  @Field(() => String, { nullable: true })
  failureMessage!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType()
class CopilotSupportBundleType implements CopilotSupportBundleRecord {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  actorId!: string;

  @Field(() => String)
  status!: CopilotSupportBundleRecord['status'];

  @Field(() => CopilotSupportBundleSourceEvidenceSummaryType)
  sourceEvidenceSummary!: CopilotSupportBundleSourceEvidenceSummary;

  @Field(() => String)
  sourceEvidenceSetFingerprint!: string;

  @Field(() => String)
  manifestFingerprint!: string;

  @Field(() => CopilotSupportBundleManifestType)
  manifestJson!: CopilotSupportBundleManifest;

  @Field(() => String, { nullable: true })
  manifestStorageKey!: string | null;

  @Field(() => SafeIntResolver, { nullable: true })
  manifestByteSize!: number | null;

  @Field(() => String, { nullable: true })
  manifestMime!: string | null;

  @Field(() => String, { nullable: true })
  manifestFilename!: string | null;

  @Field(() => String, { nullable: true })
  archiveStorageKey!: string | null;

  @Field(() => SafeIntResolver, { nullable: true })
  archiveByteSize!: number | null;

  @Field(() => String, { nullable: true })
  archiveFingerprint!: string | null;

  @Field(() => String, { nullable: true })
  archiveMime!: string | null;

  @Field(() => String, { nullable: true })
  archiveFilename!: string | null;

  @Field(() => String)
  retentionStatus!: CopilotSupportBundleRecord['retentionStatus'];

  @Field(() => Date)
  expiresAt!: Date;

  @Field(() => String, { nullable: true })
  failureCode!: string | null;

  @Field(() => String, { nullable: true })
  failureMessage!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => SafeIntResolver)
  auditEventCount!: number;

  @Field(() => [CopilotSupportBundleAuditEventType])
  auditEvents!: CopilotSupportBundleAuditEventRecord[];

  @Field(() => SafeIntResolver)
  transferEventCount!: number;

  @Field(() => [CopilotSupportBundleTransferEventType])
  transferEvents!: CopilotSupportBundleTransferEventRecord[];

  @Field(() => SafeIntResolver)
  transferForwardingEventCount!: number;

  @Field(() => [CopilotSupportBundleTransferForwardingEventType])
  transferForwardingEvents!: CopilotSupportBundleTransferForwardingEventRecord[];
}

@ObjectType()
class CopilotSupportBundleDownloadAuthorizationType {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  bundleId!: string;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  actorId!: string;

  @Field(() => String)
  status!: CopilotSupportBundleDownloadAuthorizationResult['status'];

  @Field(() => String)
  artifactKind!: CopilotSupportBundleDownloadAuthorizationResult['artifactKind'];

  @Field(() => String)
  artifactFilename!: string;

  @Field(() => String)
  artifactMime!: string;

  @Field(() => String)
  manifestFingerprint!: string;

  @Field(() => String)
  artifactFingerprint!: string;

  @Field(() => String)
  authorizationFingerprint!: string;

  @Field(() => String)
  deliveryMethod!: CopilotSupportBundleDownloadAuthorizationResult['deliveryMethod'];

  @Field(() => String, { nullable: true })
  directDownloadUrl!: string | null;

  @Field(() => Date, { nullable: true })
  directDownloadExpiresAt!: Date | null;

  @Field(() => Date)
  expiresAt!: Date;

  @Field(() => Date, { nullable: true })
  downloadedAt!: Date | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => String)
  downloadUrl!: string;
}

@ObjectType()
class CopilotSupportBundleRetentionCleanupType implements CopilotSupportBundleRetentionCleanupResult {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  actorId!: string;

  @Field(() => Date)
  cleanedAt!: Date;

  @Field(() => String)
  cleanupFingerprint!: string;

  @Field(() => SafeIntResolver)
  expiredBundleCount!: number;

  @Field(() => SafeIntResolver)
  expiredAuthorizationCount!: number;

  @Field(() => SafeIntResolver)
  archiveObjectCleanupRetryCount!: number;

  @Field(() => SafeIntResolver)
  archiveObjectCleanupRecoveredCount!: number;

  @Field(() => SafeIntResolver)
  archiveObjectCleanupFailedCount!: number;

  @Field(() => SafeIntResolver)
  manifestObjectRewriteRetryCount!: number;

  @Field(() => SafeIntResolver)
  manifestObjectRewriteRecoveredCount!: number;

  @Field(() => SafeIntResolver)
  manifestObjectRewriteFailedCount!: number;

  @Field(() => [CopilotSupportBundleType])
  expiredBundles!: CopilotSupportBundleRecord[];
}

@ObjectType()
class CopilotRegistryRevisionPublishEventType implements RegistryRevisionPublishEventRecord {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  registryFamily!: RegistryRevisionPublishEventRecord['registryFamily'];

  @Field(() => String)
  revisionId!: string;

  @Field(() => String, { nullable: true })
  registryProviderId?: string | null;

  @Field(() => String, { nullable: true })
  registryModelId?: string | null;

  @Field(() => String, { nullable: true })
  workspaceId?: string | null;

  @Field(() => String, { nullable: true })
  actorId?: string | null;

  @Field(() => String)
  scopeType!: RegistryRevisionPublishEventRecord['scopeType'];

  @Field(() => String)
  registryKey!: string;

  @Field(() => String)
  revision!: string;

  @Field(() => String)
  revisionFingerprint!: string;

  @Field(() => String)
  revisionStatus!: string;

  @Field(() => String)
  eventType!: RegistryRevisionPublishEventRecord['eventType'];

  @Field(() => String)
  publishSource!: RegistryRevisionPublishEventRecord['publishSource'];

  @Field(() => String)
  eventFingerprint!: string;

  @Field(() => GraphQLJSON)
  metadata!: RegistryRevisionPublishEventRecord['metadata'];

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType()
class CopilotPromptRegistryRevisionType
  implements
    Pick<
      PromptRegistryRevision,
      | 'actorId'
      | 'createdAt'
      | 'fallbackSourceChain'
      | 'fingerprint'
      | 'id'
      | 'promptName'
      | 'revision'
      | 'scopeType'
      | 'status'
      | 'updatedAt'
      | 'workspaceId'
    >,
    RegistryRevisionPublishEventHistory
{
  @Field(() => String)
  id!: string;

  @Field(() => String)
  promptName!: string;

  @Field(() => String)
  scopeType!: PromptRegistryRevision['scopeType'];

  @Field(() => String, { nullable: true })
  workspaceId?: string;

  @Field(() => String, { nullable: true })
  actorId?: string;

  @Field(() => String)
  revision!: string;

  @Field(() => String)
  status!: PromptRegistryRevision['status'];

  @Field(() => String)
  fingerprint!: string;

  @Field(() => GraphQLJSON)
  fallbackSourceChain!: PromptRegistryRevision['fallbackSourceChain'];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => SafeIntResolver)
  publishEventCount!: number;

  @Field(() => [CopilotRegistryRevisionPublishEventType])
  publishEvents!: RegistryRevisionPublishEventRecord[];
}

@ObjectType()
class CopilotPromptRegistryBodyEditDiffLineType {
  @Field(() => String)
  kind!: 'added' | 'context' | 'removed';

  @Field(() => SafeIntResolver, { nullable: true })
  oldLine?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  newLine?: number;

  @Field(() => String)
  text!: string;
}

@ObjectType()
class CopilotPromptRegistryBodyEditDiffType {
  @Field(() => String)
  version!: 'prompt-registry-body-edit-diff/v1';

  @Field(() => SafeIntResolver)
  addedLineCount!: number;

  @Field(() => SafeIntResolver)
  removedLineCount!: number;

  @Field(() => SafeIntResolver)
  unchangedLineCount!: number;

  @Field(() => [CopilotPromptRegistryBodyEditDiffLineType])
  lines!: PromptRegistryBodyEditPreview['diff']['lines'];
}

@ObjectType()
class CopilotPromptRegistryBodyEditPreviewType implements PromptRegistryBodyEditPreview {
  @Field(() => String)
  version!: 'prompt-registry-body-edit-preview/v1';

  @Field(() => String)
  name!: string;

  @Field(() => SafeIntResolver)
  registryId!: number;

  @Field(() => String)
  registryFingerprint!: string;

  @Field(() => Date)
  registryUpdatedAt!: Date;

  @Field(() => SafeIntResolver)
  messageIndex!: number;

  @Field(() => String)
  currentContent!: string;

  @Field(() => String)
  nextContent!: string;

  @Field(() => String)
  currentContentFingerprint!: string;

  @Field(() => String)
  nextContentFingerprint!: string;

  @Field(() => String)
  diffFingerprint!: string;

  @Field(() => String)
  previewFingerprint!: string;

  @Field(() => Boolean)
  changed!: boolean;

  @Field(() => CopilotPromptRegistryBodyEditDiffType)
  diff!: PromptRegistryBodyEditPreview['diff'];
}

@ObjectType()
class CopilotPromptRegistryBodyEditPublishType implements PromptRegistryBodyEditPublishResult {
  @Field(() => CopilotPromptRegistryBodyEditPreviewType)
  preview!: PromptRegistryBodyEditPreview;

  @Field(() => CopilotPromptRegistryRevisionType)
  revision!: PromptRegistryBodyEditPublishResult['revision'];
}

@ObjectType()
class CopilotProviderHealthProbeAttemptType implements Pick<
  CopilotProviderHealthProbeAttemptRecord,
  | 'actorId'
  | 'attemptCount'
  | 'checkedAt'
  | 'completedAt'
  | 'createdAt'
  | 'deadLetteredAt'
  | 'failureCode'
  | 'failureMessage'
  | 'id'
  | 'maxAttempts'
  | 'providerHealthStateFingerprint'
  | 'providerHealthStateId'
  | 'providerId'
  | 'providerProfileFingerprint'
  | 'providerProfileSource'
  | 'providerProfileSnapshot'
  | 'providerRegistryRevisionFingerprint'
  | 'providerRegistryRevisionId'
  | 'providerType'
  | 'requestFingerprint'
  | 'resultFingerprint'
  | 'resultLastError'
  | 'resultMetadata'
  | 'resultStatus'
  | 'scheduledAt'
  | 'scopeType'
  | 'status'
  | 'updatedAt'
  | 'workerLeaseExpiresAt'
  | 'workerLeaseId'
  | 'workspaceId'
> {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  providerId!: string;

  @Field(() => String, { nullable: true })
  providerType!: CopilotProviderHealthProbeAttemptRecord['providerType'];

  @Field(() => String)
  scopeType!: CopilotProviderHealthProbeAttemptRecord['scopeType'];

  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  actorId!: string;

  @Field(() => String)
  providerRegistryRevisionId!: string;

  @Field(() => String)
  providerRegistryRevisionFingerprint!: string;

  @Field(() => String, { nullable: true })
  providerProfileSource!: CopilotProviderHealthProbeAttemptRecord['providerProfileSource'];

  @Field(() => String)
  providerProfileFingerprint!: string;

  @Field(() => GraphQLJSON)
  providerProfileSnapshot!: Record<string, unknown>;

  @Field(() => String)
  requestFingerprint!: string;

  @Field(() => String)
  status!: CopilotProviderHealthProbeAttemptRecord['status'];

  @Field(() => SafeIntResolver)
  attemptCount!: number;

  @Field(() => SafeIntResolver)
  maxAttempts!: number;

  @Field(() => Date)
  scheduledAt!: Date;

  @Field(() => String, { nullable: true })
  workerLeaseId!: string | null;

  @Field(() => Date, { nullable: true })
  workerLeaseExpiresAt!: Date | null;

  @Field(() => Date, { nullable: true })
  checkedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  completedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  deadLetteredAt!: Date | null;

  @Field(() => String, { nullable: true })
  failureCode!: string | null;

  @Field(() => String, { nullable: true })
  failureMessage!: string | null;

  @Field(() => String, { nullable: true })
  resultStatus!: CopilotProviderHealthProbeAttemptRecord['resultStatus'];

  @Field(() => String, { nullable: true })
  resultLastError!: string | null;

  @Field(() => GraphQLJSON)
  resultMetadata!: Record<string, unknown>;

  @Field(() => String, { nullable: true })
  resultFingerprint!: string | null;

  @Field(() => String, { nullable: true })
  providerHealthStateId!: string | null;

  @Field(() => String, { nullable: true })
  providerHealthStateFingerprint!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType()
class CopilotProviderRegistryRevisionType
  implements
    Pick<
      ProviderRegistryRevision,
      | 'actorId'
      | 'createdAt'
      | 'fallbackSourceChain'
      | 'fingerprint'
      | 'id'
      | 'providerId'
      | 'providerProfile'
      | 'providerType'
      | 'revision'
      | 'scopeType'
      | 'status'
      | 'updatedAt'
      | 'workspaceId'
    >,
    RegistryRevisionPublishEventHistory
{
  @Field(() => String)
  id!: string;

  @Field(() => String)
  providerId!: string;

  @Field(() => String, { nullable: true })
  providerType?: ProviderRegistryRevision['providerType'];

  @Field(() => String)
  scopeType!: ProviderRegistryRevision['scopeType'];

  @Field(() => String, { nullable: true })
  workspaceId?: string;

  @Field(() => String, { nullable: true })
  actorId?: string;

  @Field(() => String)
  revision!: string;

  @Field(() => String)
  status!: ProviderRegistryRevision['status'];

  @Field(() => String)
  fingerprint!: string;

  @Field(() => GraphQLJSON)
  providerProfile!: ProviderRegistryRevision['providerProfile'];

  @Field(() => GraphQLJSON)
  fallbackSourceChain!: ProviderRegistryRevision['fallbackSourceChain'];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => SafeIntResolver)
  publishEventCount!: number;

  @Field(() => [CopilotRegistryRevisionPublishEventType])
  publishEvents!: RegistryRevisionPublishEventRecord[];

  @Field(() => CopilotProviderHealthProbeAttemptType, {
    nullable: true,
    description:
      'Immediate durable no-network provider health probe attempt created for this workspace provider revision.',
  })
  providerHealthProbeAttempt?: CopilotProviderHealthProbeAttemptRecord;
}

@ObjectType()
class CopilotModelRegistryRevisionType
  implements
    Pick<
      ModelRegistryRevision,
      | 'actorId'
      | 'createdAt'
      | 'fallbackSourceChain'
      | 'fingerprint'
      | 'id'
      | 'modelDefinition'
      | 'modelId'
      | 'providerId'
      | 'revision'
      | 'scopeType'
      | 'status'
      | 'updatedAt'
      | 'workspaceId'
    >,
    RegistryRevisionPublishEventHistory
{
  @Field(() => String)
  id!: string;

  @Field(() => String)
  providerId!: string;

  @Field(() => String)
  modelId!: string;

  @Field(() => String)
  scopeType!: ModelRegistryRevision['scopeType'];

  @Field(() => String, { nullable: true })
  workspaceId?: string;

  @Field(() => String, { nullable: true })
  actorId?: string;

  @Field(() => String)
  revision!: string;

  @Field(() => String)
  status!: ModelRegistryRevision['status'];

  @Field(() => String)
  fingerprint!: string;

  @Field(() => GraphQLJSON)
  modelDefinition!: ModelRegistryRevision['modelDefinition'];

  @Field(() => GraphQLJSON)
  fallbackSourceChain!: ModelRegistryRevision['fallbackSourceChain'];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => SafeIntResolver)
  publishEventCount!: number;

  @Field(() => [CopilotRegistryRevisionPublishEventType])
  publishEvents!: RegistryRevisionPublishEventRecord[];
}

@ObjectType()
class CopilotTaskRoutePolicyRevisionType
  implements
    Pick<
      TaskRoutePolicyRevision,
      | 'actorId'
      | 'configKey'
      | 'configPath'
      | 'createdAt'
      | 'fallbackSourceChain'
      | 'featureKind'
      | 'fingerprint'
      | 'id'
      | 'modelId'
      | 'revision'
      | 'scopeType'
      | 'status'
      | 'updatedAt'
      | 'workspaceId'
    >,
    RegistryRevisionPublishEventHistory
{
  @Field(() => String)
  id!: string;

  @Field(() => String)
  featureKind!: TaskRoutePolicyRevision['featureKind'];

  @Field(() => String)
  scopeType!: TaskRoutePolicyRevision['scopeType'];

  @Field(() => String, { nullable: true })
  workspaceId?: string;

  @Field(() => String, { nullable: true })
  actorId?: string;

  @Field(() => String)
  revision!: string;

  @Field(() => String)
  status!: TaskRoutePolicyRevision['status'];

  @Field(() => String, { nullable: true })
  modelId?: string;

  @Field(() => String, { nullable: true })
  configKey?: string;

  @Field(() => String, { nullable: true })
  configPath?: string;

  @Field(() => String)
  fingerprint!: string;

  @Field(() => GraphQLJSON)
  fallbackSourceChain!: TaskRoutePolicyRevision['fallbackSourceChain'];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => SafeIntResolver)
  publishEventCount!: number;

  @Field(() => [CopilotRegistryRevisionPublishEventType])
  publishEvents!: RegistryRevisionPublishEventRecord[];
}

@ObjectType()
class CopilotProviderHealthEventType implements CopilotProviderHealthEventRecord {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  stateId!: string;

  @Field(() => String)
  providerId!: string;

  @Field(() => String, { nullable: true })
  providerType?: CopilotProviderHealthEventRecord['providerType'];

  @Field(() => String)
  scopeType!: CopilotProviderHealthEventRecord['scopeType'];

  @Field(() => String, { nullable: true })
  workspaceId?: string;

  @Field(() => String, { nullable: true })
  actorId?: string;

  @Field(() => String)
  status!: CopilotProviderHealthEventRecord['status'];

  @Field(() => Date)
  checkedAt!: Date;

  @Field(() => String, { nullable: true })
  lastError?: string;

  @Field(() => String)
  source!: CopilotProviderHealthEventRecord['source'];

  @Field(() => String)
  eventType!: CopilotProviderHealthEventRecord['eventType'];

  @Field(() => String)
  fingerprint!: string;

  @Field(() => String)
  stateFingerprint!: string;

  @Field(() => GraphQLJSON)
  metadata!: CopilotProviderHealthEventRecord['metadata'];

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType()
class CopilotProviderHealthStateType implements Pick<
  CopilotProviderHealthState,
  | 'actorId'
  | 'checkedAt'
  | 'createdAt'
  | 'fingerprint'
  | 'id'
  | 'lastError'
  | 'eventCount'
  | 'events'
  | 'providerId'
  | 'providerType'
  | 'scopeType'
  | 'source'
  | 'status'
  | 'updatedAt'
  | 'workspaceId'
> {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  providerId!: string;

  @Field(() => String, { nullable: true })
  providerType?: CopilotProviderHealthState['providerType'];

  @Field(() => String)
  scopeType!: CopilotProviderHealthState['scopeType'];

  @Field(() => String, { nullable: true })
  workspaceId?: string;

  @Field(() => String, { nullable: true })
  actorId?: string;

  @Field(() => String)
  status!: CopilotProviderHealthState['status'];

  @Field(() => Date)
  checkedAt!: Date;

  @Field(() => String, { nullable: true })
  lastError?: string;

  @Field(() => String)
  source!: CopilotProviderHealthState['source'];

  @Field(() => String)
  fingerprint!: string;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => SafeIntResolver)
  eventCount!: number;

  @Field(() => [CopilotProviderHealthEventType])
  events!: CopilotProviderHealthEventRecord[];
}

@ObjectType()
class CopilotActionRunDiagnosticsItemType implements CopilotActionRunDiagnosticsItem {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  actionId!: string;

  @Field(() => String)
  actionVersion!: string;

  @Field(() => String)
  agentRuntimeDiagnosticsFingerprint!: string;

  @Field(() => CopilotActionRunAgentRuntimeDiagnosticsManifestType)
  agentRuntimeDiagnosticsManifest!: CopilotActionRunAgentRuntimeDiagnosticsManifest;

  @Field(
    () => CopilotActionRunAgentRuntimeDiagnosticsManifestExportMetadataType
  )
  agentRuntimeDiagnosticsManifestExportMetadata!: CopilotActionRunAgentRuntimeDiagnosticsManifestExportMetadata;

  @Field(() => [String])
  agentRuntimeNativeTraceEventTypes!: string[];

  @Field(() => [String])
  agentRuntimeProjectedSchemaComponents!: string[];

  @Field(() => [String])
  agentRuntimeProjectedRunStatuses!: string[];

  @Field(() => [String])
  agentRuntimeProjectedStepStatuses!: string[];

  @Field(() => [String])
  agentRuntimeProjectedStepTypes!: string[];

  @Field(() => [String])
  agentRuntimeProjectedTimelineEventTypes!: string[];

  @Field(() => String)
  agentRuntimeProjectionContractFingerprint!: string;

  @Field(() => String)
  agentRuntimeProjectionSource!: string;

  @Field(() => [String])
  agentRuntimeProjectionGaps!: string[];

  @Field(() => [String])
  agentRuntimeRunStatusGaps!: string[];

  @Field(() => String)
  agentRuntimeRunId!: string;

  @Field(() => String)
  agentRuntimeRunStatus!: string;

  @Field(() => String)
  agentRuntimeSchemaReadiness!: string;

  @Field(() => [String])
  agentRuntimeSchemaReadinessGaps!: string[];

  @Field(() => SafeIntResolver)
  agentRuntimeStepCount!: number;

  @Field(() => [String])
  agentRuntimeStepStatusGaps!: string[];

  @Field(() => [String])
  agentRuntimeStepIds!: string[];

  @Field(() => [String])
  agentRuntimeStepKinds!: string[];

  @Field(() => [String])
  agentRuntimeStepStatuses!: string[];

  @Field(() => [String])
  agentRuntimeStepTypes!: string[];

  @Field(() => [String])
  agentRuntimeTimelineEntries!: string[];

  @Field(() => [String])
  agentRuntimeTimelineEventTypes!: string[];

  @Field(() => [String])
  agentRuntimeTimelineGaps!: string[];

  @Field(() => [CopilotActionRunAgentRuntimeTimelineItemType])
  agentRuntimeTimelineItems!: CopilotActionRunAgentRuntimeTimelineItem[];

  @Field(() => String)
  agentRuntimeTimelineRouteEvidenceSetFingerprint!: string;

  @Field(() => [String])
  agentRuntimeTargetRunStatuses!: string[];

  @Field(() => [String])
  agentRuntimeTargetSchemaComponents!: string[];

  @Field(() => [String])
  agentRuntimeTargetStepStatuses!: string[];

  @Field(() => [String])
  agentRuntimeTargetStepTypes!: string[];

  @Field(() => [String])
  agentRuntimeTargetTimelineEventTypes!: string[];

  @Field(() => [String])
  agentRuntimeUnsupportedRunStatuses!: string[];

  @Field(() => [String])
  agentRuntimeUnsupportedStepStatuses!: string[];

  @Field(() => [String])
  agentRuntimeUnsupportedStepTypes!: string[];

  @Field(() => [String])
  agentRuntimeUnsupportedTimelineEventTypes!: string[];

  @Field(() => String)
  status!: string;

  @Field(() => SafeIntResolver)
  attempt!: number;

  @Field(() => String, { nullable: true })
  retryOf!: string | null;

  @Field(() => String, { nullable: true })
  docId!: string | null;

  @Field(() => String, { nullable: true })
  sessionId!: string | null;

  @Field(() => String, { nullable: true })
  errorCode!: string | null;

  @Field(() => Boolean)
  hasPreparedRouteTrace!: boolean;

  @Field(() => SafeIntResolver)
  preparedRouteStepCount!: number;

  @Field(() => SafeIntResolver)
  preparedRouteCount!: number;

  @Field(() => SafeIntResolver)
  preparedRouteActualCount!: number;

  @Field(() => [String])
  preparedRouteStepRouteCounts!: string[];

  @Field(() => [String])
  preparedRouteStepRouteCountMismatches!: string[];

  @Field(() => [String])
  preparedRouteStepIds!: string[];

  @Field(() => [String])
  preparedRouteKinds!: string[];

  @Field(() => [String])
  preparedRouteOrder!: string[];

  @Field(() => [String])
  preparedRouteFallbackOrder!: string[];

  @Field(() => [String])
  preparedRouteProtocols!: string[];

  @Field(() => [String])
  preparedRouteModelBackendKinds!: string[];

  @Field(() => [String])
  preparedRouteCanonicalModelKeys!: string[];

  @Field(() => [String])
  preparedRouteBehaviorFlags!: string[];

  @Field(() => [String])
  preparedRouteDimensionEvidence!: string[];

  @Field(() => [String])
  preparedRouteRequestLayers!: string[];

  @Field(() => [String])
  preparedRouteStepOrder!: string[];

  @Field(() => [String])
  preparedRouteStepFallbackOrder!: string[];

  @Field(() => [String])
  preparedRouteStepProtocols!: string[];

  @Field(() => [String])
  preparedRouteStepModelBackendKinds!: string[];

  @Field(() => [String])
  preparedRouteStepCanonicalModelKeys!: string[];

  @Field(() => [String])
  preparedRouteStepBehaviorFlags!: string[];

  @Field(() => [String])
  preparedRouteStepDimensionEvidence!: string[];

  @Field(() => [String])
  preparedRouteStepRequestLayers!: string[];

  @Field(() => [String])
  preparedRouteProviderIds!: string[];

  @Field(() => [String])
  preparedRouteModelIds!: string[];

  @Field(() => [String])
  preparedRouteRequestedModelIds!: string[];

  @Field(() => [String])
  preparedRouteRequestedModelSources!: string[];

  @Field(() => [String])
  preparedRouteStepRequestedModelSources!: string[];

  @Field(() => [String])
  preparedRouteTargets!: string[];

  @Field(() => [String])
  preparedRouteStepTargets!: string[];

  @Field(() => [String])
  preparedRouteRequestedTargets!: string[];

  @Field(() => [String])
  preparedRouteStepRequestedTargets!: string[];

  @Field(() => [String])
  preparedRouteFallbackProviderIds!: string[];

  @Field(() => [String])
  preparedRouteStepFallbackProviderIds!: string[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

function modelListRoutePolicyContext(workspaceId?: string | null) {
  return {
    featureKind: 'chat' as const,
    ...(workspaceId ? { workspaceId } : {}),
  };
}

function toSupportBundleTaskRouteSnapshot(
  route: CopilotTaskRouteDiagnosticsType
): CopilotSupportBundleTaskRouteSnapshot {
  return {
    featureKind: route.featureKind,
    configured: route.configured,
    routePolicyEnabled: route.policyEnabled,
    ...(route.policyWorkspaceId
      ? { routePolicyWorkspaceId: route.policyWorkspaceId }
      : {}),
    ...(route.requestedModelId
      ? { requestedModelId: route.requestedModelId }
      : {}),
    ...(route.requestedModelSource
      ? { requestedModelSource: route.requestedModelSource }
      : {}),
    fallbackProviderIds: [...route.fallbackProviderIds],
    preparedProviderCount: route.preparedProviderCount,
    ...(route.providerId ? { providerId: route.providerId } : {}),
    ...(route.providerProfileId
      ? { providerProfileId: route.providerProfileId }
      : {}),
    ...(route.modelId ? { modelId: route.modelId } : {}),
    ...(route.protocol ? { protocol: route.protocol } : {}),
    ...(route.requestLayer ? { requestLayer: route.requestLayer } : {}),
    ...(route.modelBackendKind
      ? { modelBackendKind: route.modelBackendKind }
      : {}),
    ...(route.canonicalModelKey
      ? { canonicalModelKey: route.canonicalModelKey }
      : {}),
    ...(route.behaviorFlags?.length
      ? { behaviorFlags: [...route.behaviorFlags] }
      : {}),
    ...(route.errorCode ? { errorCode: route.errorCode } : {}),
    ...(route.errorMessage ? { errorMessage: route.errorMessage } : {}),
    ...(route.effectiveSourceFingerprint
      ? { diagnosticsFingerprint: route.effectiveSourceFingerprint }
      : {}),
    ...(route.effectiveSourceFingerprint
      ? {
          taskRouteEffectiveSourceFingerprint: route.effectiveSourceFingerprint,
        }
      : {}),
  };
}

type PromptRegistryPublishGateModelRouteTarget = {
  featureKind: CopilotProviderRoutePolicyFeatureKind;
  outputType: ModelOutputType;
};

type PromptRegistryPublishGateModelRouteCandidate = {
  candidateConfigPath?: string;
  candidateIndex: number;
  candidateKind: 'default' | 'optional' | 'pro' | 'registry';
  modelId: string;
  requestedModelSource?: string;
};

type PromptRegistryPublishGateRoutePolicyMetadata = {
  policyAllowedPrivacy?: string[];
  policyAllowedProviderIds?: string[];
  policyBlockedProviderIds?: string[];
  policyEnabled: boolean;
  policyFeatureKind?: string;
  policyPreferredPrivacy?: string[];
  policyWorkspaceId?: string;
};

type PromptRegistryPublishGateRouteCandidateDiagnostics = Awaited<
  ReturnType<CopilotProviderFactory['describeRouteCandidates']>
>[number];

function resolvePromptRegistryPublishGateModelRouteTarget(
  prompt: Pick<ResolvedPrompt, 'model' | 'name'> &
    Partial<
      Pick<ResolvedPrompt, 'action' | 'category' | 'config' | 'defaultPolicy'>
    >
): PromptRegistryPublishGateModelRouteTarget {
  if (
    prompt.defaultPolicy === 'image' ||
    prompt.category === 'image' ||
    isImagePromptCategory(prompt)
  ) {
    return {
      featureKind: 'image',
      outputType: ModelOutputType.Image,
    };
  }

  if (prompt.defaultPolicy === 'structured') {
    return {
      featureKind: 'action',
      outputType: ModelOutputType.Structured,
    };
  }

  if (
    prompt.defaultPolicy === 'transcript' ||
    prompt.category === 'transcript' ||
    isTranscriptPromptCategory(prompt)
  ) {
    return {
      featureKind: 'transcript',
      outputType: ModelOutputType.Text,
    };
  }

  return {
    featureKind: 'chat',
    outputType: ModelOutputType.Object,
  };
}

function resolvePromptRegistryPublishGateModelRouteCandidates(
  prompt: Pick<ResolvedPrompt, 'config' | 'model'> &
    Partial<
      Pick<
        ResolvedPrompt,
        | 'modelConfigPath'
        | 'modelSource'
        | 'optionalModels'
        | 'optionalModelsConfigPath'
        | 'optionalModelsSource'
        | 'proModelsConfigPath'
        | 'proModelsSource'
      >
    >,
  registryModelIds: string[] = []
): PromptRegistryPublishGateModelRouteCandidate[] {
  const candidates: PromptRegistryPublishGateModelRouteCandidate[] = [
    {
      candidateConfigPath:
        prompt.modelConfigPath ?? 'ai_prompts_metadata.model',
      candidateIndex: 0,
      candidateKind: 'default',
      modelId: prompt.model,
      requestedModelSource: prompt.modelSource ?? 'registry',
    },
  ];

  const optionalModels = prompt.optionalModels ?? [];
  optionalModels.forEach((modelId, index) => {
    candidates.push({
      candidateConfigPath:
        prompt.optionalModelsConfigPath ?? 'ai_prompts_metadata.optionalModels',
      candidateIndex: index,
      candidateKind: 'optional',
      modelId,
      requestedModelSource: prompt.optionalModelsSource ?? 'registry',
    });
  });

  const proModels = prompt.config?.proModels ?? [];
  proModels.forEach((modelId, index) => {
    candidates.push({
      candidateConfigPath:
        prompt.proModelsConfigPath ?? 'ai_prompts_metadata.config.proModels',
      candidateIndex: index,
      candidateKind: 'pro',
      modelId,
      requestedModelSource: prompt.proModelsSource ?? 'registry',
    });
  });

  const existingModelIds = new Set(
    candidates.map(candidate => candidate.modelId)
  );
  uniqueStrings(registryModelIds)
    .filter(modelId => !existingModelIds.has(modelId))
    .forEach((modelId, index) => {
      candidates.push({
        candidateConfigPath: 'copilot.providers.profiles[].models',
        candidateIndex: index,
        candidateKind: 'registry',
        modelId,
        requestedModelSource: 'registry',
      });
    });

  return candidates.filter(candidate => candidate.modelId);
}

function collectModelCapabilityTypes(
  capabilities:
    | Partial<ResolvedProviderModel>['capabilities']
    | NonNullable<
        ResolvedCopilotProvider['profile']['modelDefinitions']
      >[number]['capabilities']
    | undefined
) {
  if (!Array.isArray(capabilities) || !capabilities.length) {
    return {};
  }

  const inputTypes = Array.from(
    new Set(capabilities.flatMap(capability => capability.input ?? []))
  );
  const outputTypes = Array.from(
    new Set(capabilities.flatMap(capability => capability.output ?? []))
  );
  const attachmentKinds = Array.from(
    new Set(
      capabilities.flatMap(capability => capability.attachments?.kinds ?? [])
    )
  );
  const attachmentSourceKinds = Array.from(
    new Set(
      capabilities.flatMap(
        capability => capability.attachments?.sourceKinds ?? []
      )
    )
  );
  const hasAttachmentCapability = capabilities.some(
    capability => capability.attachments !== undefined
  );
  const attachmentAllowRemoteUrls = capabilities.some(
    capability => capability.attachments?.allowRemoteUrls === true
  );
  const structuredAttachmentKinds = Array.from(
    new Set(
      capabilities.flatMap(
        capability => capability.structuredAttachments?.kinds ?? []
      )
    )
  );
  const structuredAttachmentSourceKinds = Array.from(
    new Set(
      capabilities.flatMap(
        capability => capability.structuredAttachments?.sourceKinds ?? []
      )
    )
  );
  const hasStructuredAttachmentCapability = capabilities.some(
    capability => capability.structuredAttachments !== undefined
  );
  const structuredAttachmentAllowRemoteUrls = capabilities.some(
    capability => capability.structuredAttachments?.allowRemoteUrls === true
  );

  return {
    ...(inputTypes.length ? { routeInputTypes: inputTypes } : {}),
    ...(outputTypes.length ? { routeOutputTypes: outputTypes } : {}),
    ...(attachmentKinds.length
      ? { routeAttachmentKinds: attachmentKinds }
      : {}),
    ...(attachmentSourceKinds.length
      ? { routeAttachmentSourceKinds: attachmentSourceKinds }
      : {}),
    ...(hasAttachmentCapability
      ? { routeAttachmentAllowRemoteUrls: attachmentAllowRemoteUrls }
      : {}),
    ...(structuredAttachmentKinds.length
      ? { routeStructuredAttachmentKinds: structuredAttachmentKinds }
      : {}),
    ...(structuredAttachmentSourceKinds.length
      ? {
          routeStructuredAttachmentSourceKinds: structuredAttachmentSourceKinds,
        }
      : {}),
    ...(hasStructuredAttachmentCapability
      ? {
          routeStructuredAttachmentAllowRemoteUrls:
            structuredAttachmentAllowRemoteUrls,
        }
      : {}),
  };
}

function selectPromptRegistryPublishGateRouteCandidate(
  candidates: PromptRegistryPublishGateRouteCandidateDiagnostics[]
) {
  return (
    candidates.find(candidate => candidate.matched) ??
    candidates.find(candidate => candidate.registrySelected) ??
    candidates.find(candidate => candidate.registryAvailable !== false) ??
    candidates[0]
  );
}

function promptRegistryPublishGateRouteCandidateMetadata(
  candidate: PromptRegistryPublishGateRouteCandidateDiagnostics | undefined
): Partial<CopilotPromptRegistryPublishGateModelRoute> {
  if (!candidate) {
    return {};
  }

  return {
    providerId: candidate.providerId,
    ...(candidate.providerName ? { providerName: candidate.providerName } : {}),
    ...(candidate.providerSource
      ? { providerSource: candidate.providerSource }
      : {}),
    ...(candidate.providerProfileId
      ? { providerProfileId: candidate.providerProfileId }
      : {}),
    ...(candidate.providerProfileSource
      ? { providerProfileSource: candidate.providerProfileSource }
      : {}),
    ...(candidate.providerProfileConfigPath
      ? { providerProfileConfigPath: candidate.providerProfileConfigPath }
      : {}),
    ...(candidate.providerConfiguredModelIds !== undefined
      ? { providerConfiguredModelIds: candidate.providerConfiguredModelIds }
      : {}),
    ...(candidate.providerConfiguredModelCount !== undefined
      ? { providerConfiguredModelCount: candidate.providerConfiguredModelCount }
      : {}),
    ...(candidate.providerType ? { providerType: candidate.providerType } : {}),
    ...(candidate.privacy ? { providerPrivacy: candidate.privacy } : {}),
    ...(candidate.health
      ? {
          providerHealth:
            candidate.health === 'healthy' ||
            candidate.health === 'degraded' ||
            candidate.health === 'down'
              ? candidate.health
              : 'unknown',
        }
      : {}),
    ...(candidate.healthCheckedAt
      ? { providerHealthCheckedAt: candidate.healthCheckedAt }
      : {}),
    ...(candidate.providerPriority !== undefined
      ? { providerPriority: candidate.providerPriority }
      : {}),
    ...(candidate.modelId ? { modelId: candidate.modelId } : {}),
    ...(candidate.routeRawModelId
      ? { routeRawModelId: candidate.routeRawModelId }
      : {}),
    ...(candidate.routeModelDefinitionSource
      ? { routeModelDefinitionSource: candidate.routeModelDefinitionSource }
      : {}),
    ...(candidate.routeModelDefinitionId
      ? { routeModelDefinitionId: candidate.routeModelDefinitionId }
      : {}),
    ...(candidate.routeModelDefinitionAliases?.length
      ? { routeModelDefinitionAliases: candidate.routeModelDefinitionAliases }
      : {}),
    ...(candidate.routeModelAliasMatched !== undefined
      ? { routeModelAliasMatched: candidate.routeModelAliasMatched }
      : {}),
    ...(candidate.modelRegistryRevision
      ? { modelRegistryRevision: candidate.modelRegistryRevision }
      : {}),
    ...(candidate.modelRegistryRevisionActorId
      ? { modelRegistryRevisionActorId: candidate.modelRegistryRevisionActorId }
      : {}),
    ...(candidate.modelRegistryRevisionFingerprint
      ? {
          modelRegistryRevisionFingerprint:
            candidate.modelRegistryRevisionFingerprint,
        }
      : {}),
    ...(candidate.modelRegistryRevisionId
      ? { modelRegistryRevisionId: candidate.modelRegistryRevisionId }
      : {}),
    ...(candidate.modelRegistryRevisionScope
      ? { modelRegistryRevisionScope: candidate.modelRegistryRevisionScope }
      : {}),
    ...(candidate.modelRegistryRevisionSourceChain
      ? {
          modelRegistryRevisionSourceChain:
            candidate.modelRegistryRevisionSourceChain as CopilotModelRegistrySourceChainEntry[],
        }
      : {}),
    ...(candidate.modelRegistryRevisionSourceChainFingerprint
      ? {
          modelRegistryRevisionSourceChainFingerprint:
            candidate.modelRegistryRevisionSourceChainFingerprint,
        }
      : {}),
    ...(candidate.modelRegistryRevisionStatus
      ? { modelRegistryRevisionStatus: candidate.modelRegistryRevisionStatus }
      : {}),
    ...(candidate.modelRegistryRevisionWorkspaceId
      ? {
          modelRegistryRevisionWorkspaceId:
            candidate.modelRegistryRevisionWorkspaceId,
        }
      : {}),
    ...(candidate.modelRegistryRevisionPublishEventCount !== undefined
      ? {
          modelRegistryRevisionPublishEventCount:
            candidate.modelRegistryRevisionPublishEventCount,
        }
      : {}),
    ...(candidate.modelRegistryRevisionPublishEvents !== undefined
      ? {
          modelRegistryRevisionPublishEvents:
            candidate.modelRegistryRevisionPublishEvents,
        }
      : {}),
  };
}

function toPromptRegistryPublishGateRouteCandidate(
  candidate:
    | PromptRegistryPublishGateRouteCandidateDiagnostics
    | CopilotTaskRouteCandidateDiagnosticsType
): CopilotPromptRegistryPublishGateRouteCandidate {
  return {
    ...(candidate.candidateModelIds !== undefined
      ? { candidateModelIds: candidate.candidateModelIds }
      : {}),
    ...(candidate.costInputPer1M !== undefined
      ? { costInputPer1M: candidate.costInputPer1M }
      : {}),
    ...(candidate.costOutputPer1M !== undefined
      ? { costOutputPer1M: candidate.costOutputPer1M }
      : {}),
    ...(candidate.routeContextWindow !== undefined
      ? { routeContextWindow: candidate.routeContextWindow }
      : {}),
    ...(candidate.routeMaxOutputTokens !== undefined
      ? { routeMaxOutputTokens: candidate.routeMaxOutputTokens }
      : {}),
    ...(candidate.routeEmbeddingDimensions !== undefined
      ? { routeEmbeddingDimensions: candidate.routeEmbeddingDimensions }
      : {}),
    ...(definedArray(candidate.routeInputTypes) !== undefined
      ? { routeInputTypes: definedArray(candidate.routeInputTypes) }
      : {}),
    ...(definedArray(candidate.routeOutputTypes) !== undefined
      ? { routeOutputTypes: definedArray(candidate.routeOutputTypes) }
      : {}),
    ...(definedArray(candidate.routeAttachmentKinds) !== undefined
      ? { routeAttachmentKinds: definedArray(candidate.routeAttachmentKinds) }
      : {}),
    ...(definedArray(candidate.routeAttachmentSourceKinds) !== undefined
      ? {
          routeAttachmentSourceKinds: definedArray(
            candidate.routeAttachmentSourceKinds
          ),
        }
      : {}),
    ...(candidate.routeAttachmentAllowRemoteUrls !== undefined
      ? {
          routeAttachmentAllowRemoteUrls:
            candidate.routeAttachmentAllowRemoteUrls,
        }
      : {}),
    ...(definedArray(candidate.routeStructuredAttachmentKinds) !== undefined
      ? {
          routeStructuredAttachmentKinds: definedArray(
            candidate.routeStructuredAttachmentKinds
          ),
        }
      : {}),
    ...(definedArray(candidate.routeStructuredAttachmentSourceKinds) !==
    undefined
      ? {
          routeStructuredAttachmentSourceKinds: definedArray(
            candidate.routeStructuredAttachmentSourceKinds
          ),
        }
      : {}),
    ...(candidate.routeStructuredAttachmentAllowRemoteUrls !== undefined
      ? {
          routeStructuredAttachmentAllowRemoteUrls:
            candidate.routeStructuredAttachmentAllowRemoteUrls,
        }
      : {}),
    ...(candidate.health ? { health: candidate.health } : {}),
    ...(candidate.healthCheckedAt
      ? { healthCheckedAt: candidate.healthCheckedAt }
      : {}),
    matched: candidate.matched,
    ...(candidate.modelId ? { modelId: candidate.modelId } : {}),
    ...(candidate.privacy ? { privacy: candidate.privacy } : {}),
    ...(candidate.providerConfiguredModelCount !== undefined
      ? { providerConfiguredModelCount: candidate.providerConfiguredModelCount }
      : {}),
    ...(candidate.providerConfiguredModelIds !== undefined
      ? { providerConfiguredModelIds: candidate.providerConfiguredModelIds }
      : {}),
    providerId: candidate.providerId,
    ...(candidate.providerName ? { providerName: candidate.providerName } : {}),
    ...(candidate.providerPriority !== undefined
      ? { providerPriority: candidate.providerPriority }
      : {}),
    ...(candidate.providerProfileConfigPath
      ? { providerProfileConfigPath: candidate.providerProfileConfigPath }
      : {}),
    ...(candidate.providerProfileId
      ? { providerProfileId: candidate.providerProfileId }
      : {}),
    ...(candidate.providerProfileSource
      ? { providerProfileSource: candidate.providerProfileSource }
      : {}),
    ...(candidate.providerSource
      ? { providerSource: candidate.providerSource }
      : {}),
    ...(candidate.providerType ? { providerType: candidate.providerType } : {}),
    reasons: candidate.reasons,
    ...(candidate.registryAvailable !== undefined
      ? { registryAvailable: candidate.registryAvailable }
      : {}),
    ...(candidate.registryKind ? { registryKind: candidate.registryKind } : {}),
    ...(candidate.registrySelected !== undefined
      ? { registrySelected: candidate.registrySelected }
      : {}),
    ...(candidate.requestedModelId
      ? { requestedModelId: candidate.requestedModelId }
      : {}),
    ...(candidate.routeModelAliasMatched !== undefined
      ? { routeModelAliasMatched: candidate.routeModelAliasMatched }
      : {}),
    ...(candidate.routeModelDefinitionAliases?.length
      ? { routeModelDefinitionAliases: candidate.routeModelDefinitionAliases }
      : {}),
    ...(candidate.routeModelDefinitionId
      ? { routeModelDefinitionId: candidate.routeModelDefinitionId }
      : {}),
    ...(candidate.routeModelDefinitionSource
      ? { routeModelDefinitionSource: candidate.routeModelDefinitionSource }
      : {}),
    ...(candidate.modelRegistryRevision
      ? { modelRegistryRevision: candidate.modelRegistryRevision }
      : {}),
    ...(candidate.modelRegistryRevisionActorId
      ? { modelRegistryRevisionActorId: candidate.modelRegistryRevisionActorId }
      : {}),
    ...(candidate.modelRegistryRevisionFingerprint
      ? {
          modelRegistryRevisionFingerprint:
            candidate.modelRegistryRevisionFingerprint,
        }
      : {}),
    ...(candidate.modelRegistryRevisionId
      ? { modelRegistryRevisionId: candidate.modelRegistryRevisionId }
      : {}),
    ...(candidate.modelRegistryRevisionScope
      ? { modelRegistryRevisionScope: candidate.modelRegistryRevisionScope }
      : {}),
    ...(candidate.modelRegistryRevisionSourceChain
      ? {
          modelRegistryRevisionSourceChain:
            candidate.modelRegistryRevisionSourceChain as CopilotModelRegistrySourceChainEntry[],
        }
      : {}),
    ...(candidate.modelRegistryRevisionSourceChainFingerprint
      ? {
          modelRegistryRevisionSourceChainFingerprint:
            candidate.modelRegistryRevisionSourceChainFingerprint,
        }
      : {}),
    ...(candidate.modelRegistryRevisionStatus
      ? { modelRegistryRevisionStatus: candidate.modelRegistryRevisionStatus }
      : {}),
    ...(candidate.modelRegistryRevisionWorkspaceId
      ? {
          modelRegistryRevisionWorkspaceId:
            candidate.modelRegistryRevisionWorkspaceId,
        }
      : {}),
    ...(candidate.modelRegistryRevisionPublishEventCount !== undefined
      ? {
          modelRegistryRevisionPublishEventCount:
            candidate.modelRegistryRevisionPublishEventCount,
        }
      : {}),
    ...(candidate.modelRegistryRevisionPublishEvents !== undefined
      ? {
          modelRegistryRevisionPublishEvents:
            candidate.modelRegistryRevisionPublishEvents,
        }
      : {}),
    ...(candidate.routeRawModelId
      ? { routeRawModelId: candidate.routeRawModelId }
      : {}),
  };
}

function buildPromptRegistryPublishGateRouteTrace(
  policyCandidates: CopilotPromptRegistryPublishGatePolicyCandidate[],
  routeCandidates: CopilotPromptRegistryPublishGateRouteCandidate[]
): CopilotPromptRegistryPublishGateRouteTracePhase[] {
  return [
    {
      phase: 'policy',
      candidateCount: policyCandidates.length,
      availableCount: policyCandidates.filter(candidate => candidate.available)
        .length,
      selectedCount: policyCandidates.filter(candidate => candidate.allowed)
        .length,
      blockedCount: policyCandidates.filter(candidate => !candidate.allowed)
        .length,
      reasons: uniqueStrings(
        policyCandidates.flatMap(candidate => candidate.reasons)
      ),
    },
    {
      phase: 'resolution',
      candidateCount: routeCandidates.length,
      availableCount: routeCandidates.filter(
        candidate => candidate.registryAvailable !== false
      ).length,
      selectedCount: routeCandidates.filter(
        candidate => candidate.registrySelected
      ).length,
      matchedCount: routeCandidates.filter(candidate => candidate.matched)
        .length,
      reasons: uniqueStrings(
        routeCandidates.flatMap(candidate => candidate.reasons)
      ),
    },
  ];
}

function promptRegistryPublishGateDiagnosticsErrorMetadata(
  stage: 'describe_route_candidates' | 'resolve_provider',
  error: unknown
) {
  return {
    diagnosticsErrorCode:
      error instanceof Error && error.name !== 'Error' ? error.name : stage,
    diagnosticsErrorMessage:
      error instanceof Error ? error.message : 'Unknown diagnostics error',
    diagnosticsErrorStage: stage,
  };
}

function withPromptRegistryPublishGateModelRouteEffectiveSourceFingerprint(
  route: CopilotPromptRegistryPublishGateModelRoute
): CopilotPromptRegistryPublishGateModelRoute {
  return {
    ...route,
    effectiveSourceFingerprint:
      buildPromptRegistryPublishGateModelRouteEffectiveSourceFingerprint(route),
    effectiveSourceFingerprintInputs: [
      ...PROMPT_REGISTRY_PUBLISH_GATE_MODEL_ROUTE_EFFECTIVE_SOURCE_FINGERPRINT_INPUTS,
    ],
    effectiveSourceFingerprintVersion:
      PROMPT_REGISTRY_PUBLISH_GATE_MODEL_ROUTE_EFFECTIVE_SOURCE_FINGERPRINT_VERSION,
  };
}

function diagnosticsErrorCode(error: unknown, fallbackCode: string) {
  return error instanceof Error && error.name !== 'Error'
    ? error.name
    : fallbackCode;
}

function diagnosticsErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown diagnostics error';
}

async function settleTaskRouteDiagnosticsProbe<T>(
  stage: string,
  probe: () => Promise<T> | T
): Promise<{ errors: CopilotTaskRouteDiagnosticsError[]; value?: T }> {
  try {
    return { errors: [], value: await probe() };
  } catch (error) {
    return {
      errors: [
        {
          code: diagnosticsErrorCode(error, stage),
          message: diagnosticsErrorMessage(error),
          stage,
        },
      ],
    };
  }
}

function compactEvidence(
  values: Array<string | undefined | null | false>,
  maxCount = 10
) {
  return uniqueStrings(
    values.filter((value): value is string => Boolean(value))
  ).slice(0, maxCount);
}

function definedArray<T>(values: T[] | undefined) {
  return values?.length ? values : undefined;
}

const TASK_ROUTE_RECOMMENDATION_EVIDENCE_LIMIT = 192;

function modelRouteCandidateProfileStructuredEvidence(
  route: CopilotPromptRegistryPublishGateModelRoute
) {
  const policyCandidateSnapshot: CopilotPromptRegistryPublishGatePolicyCandidate[] =
    route.policyCandidates.map(candidate => ({
      allowed: candidate.allowed,
      available: candidate.available,
      candidateFingerprint: candidate.candidateFingerprint,
      candidateKey: candidate.candidateKey,
      health: candidate.health,
      ...(candidate.healthCheckedAt
        ? { healthCheckedAt: candidate.healthCheckedAt }
        : {}),
      privacy: candidate.privacy,
      providerId: candidate.providerId,
      ...(candidate.providerConfiguredModelCount !== undefined
        ? {
            providerConfiguredModelCount:
              candidate.providerConfiguredModelCount,
          }
        : {}),
      ...(candidate.providerConfiguredModelIds?.length
        ? {
            providerConfiguredModelIds: candidate.providerConfiguredModelIds,
          }
        : {}),
      ...(candidate.providerName
        ? { providerName: candidate.providerName }
        : {}),
      ...(candidate.providerPriority !== undefined
        ? { providerPriority: candidate.providerPriority }
        : {}),
      ...(candidate.providerProfileConfigPath
        ? { providerProfileConfigPath: candidate.providerProfileConfigPath }
        : {}),
      ...(candidate.providerProfileId
        ? { providerProfileId: candidate.providerProfileId }
        : {}),
      ...(candidate.providerProfileSource
        ? { providerProfileSource: candidate.providerProfileSource }
        : {}),
      ...(candidate.providerSource
        ? { providerSource: candidate.providerSource }
        : {}),
      ...(candidate.providerType
        ? { providerType: candidate.providerType }
        : {}),
      ...(candidate.registryAvailable !== undefined
        ? { registryAvailable: candidate.registryAvailable }
        : {}),
      ...(candidate.registryKind
        ? { registryKind: candidate.registryKind }
        : {}),
      ...(candidate.registrySelected !== undefined
        ? { registrySelected: candidate.registrySelected }
        : {}),
      reasons: candidate.reasons,
    }));
  const routeCandidateSnapshot = route.routeCandidates;
  const routeTraceSnapshot = route.routeTrace.map(phase => ({
    ...(phase.availableCount !== undefined
      ? { availableCount: phase.availableCount }
      : {}),
    ...(phase.blockedCount !== undefined
      ? { blockedCount: phase.blockedCount }
      : {}),
    candidateCount: phase.candidateCount,
    ...(phase.matchedCount !== undefined
      ? { matchedCount: phase.matchedCount }
      : {}),
    phase: phase.phase,
    ...(phase.selectedCount !== undefined
      ? { selectedCount: phase.selectedCount }
      : {}),
    reasons: phase.reasons,
  }));
  const candidates = [
    ...route.policyCandidates.map((candidate, index) =>
      taskRouteRepairCandidateEvidenceBase(
        'policyCandidate',
        {
          allowed: candidate.allowed,
          available: candidate.available,
          candidateKey: candidate.candidateKey,
          health: candidate.health,
          healthCheckedAt: candidate.healthCheckedAt,
          policyCandidates: policyCandidateSnapshot,
          policyCandidateSnapshotFingerprint: taskRouteSnapshotFingerprint(
            policyCandidateSnapshot
          ),
          privacy: candidate.privacy,
          providerConfiguredModelCount: candidate.providerConfiguredModelCount,
          providerConfiguredModelIds: candidate.providerConfiguredModelIds,
          providerId: candidate.providerId,
          providerName: candidate.providerName,
          providerPriority: candidate.providerPriority,
          providerProfileConfigPath: candidate.providerProfileConfigPath,
          providerProfileId: candidate.providerProfileId,
          providerProfileSource: candidate.providerProfileSource,
          providerSource: candidate.providerSource,
          providerType: candidate.providerType,
          reasons: candidate.reasons,
          registryAvailable: candidate.registryAvailable,
          registryKind: candidate.registryKind,
          registrySelected: candidate.registrySelected,
          requestedModelId: route.requestedModelId,
          requestedModelSource: route.requestedModelSource,
          routeCandidateSnapshotFingerprint: taskRouteSnapshotFingerprint(
            routeCandidateSnapshot
          ),
          routeTrace: routeTraceSnapshot,
          routeTracePhases: route.routeTrace.map(phase => phase.phase),
          routeTraceSnapshotFingerprint:
            taskRouteSnapshotFingerprint(routeTraceSnapshot),
        },
        index
      )
    ),
    ...route.routeCandidates.map((candidate, index) =>
      taskRouteRepairCandidateEvidenceBase(
        'routeCandidate',
        {
          candidateModelIds: candidate.candidateModelIds,
          costInputPer1M: candidate.costInputPer1M,
          costOutputPer1M: candidate.costOutputPer1M,
          fallbackProviderIds: route.fallbackProviderIds,
          health: candidate.health,
          healthCheckedAt: candidate.healthCheckedAt,
          matched: candidate.matched,
          modelId: candidate.modelId,
          policyCandidates: policyCandidateSnapshot,
          policyCandidateSnapshotFingerprint: taskRouteSnapshotFingerprint(
            policyCandidateSnapshot
          ),
          privacy: candidate.privacy,
          providerConfiguredModelCount: candidate.providerConfiguredModelCount,
          providerConfiguredModelIds: candidate.providerConfiguredModelIds,
          providerId: candidate.providerId,
          providerName: candidate.providerName,
          providerPriority: candidate.providerPriority,
          providerProfileConfigPath: candidate.providerProfileConfigPath,
          providerProfileId: candidate.providerProfileId,
          providerProfileSource: candidate.providerProfileSource,
          providerSource: candidate.providerSource,
          providerType: candidate.providerType,
          reasons: candidate.reasons,
          registryAvailable: candidate.registryAvailable,
          registryKind: candidate.registryKind,
          registrySelected: candidate.registrySelected,
          requestedModelId:
            candidate.requestedModelId ?? route.requestedModelId,
          requestedModelSource: route.requestedModelSource,
          routeAttachmentAllowRemoteUrls:
            candidate.routeAttachmentAllowRemoteUrls,
          routeAttachmentKinds: candidate.routeAttachmentKinds,
          routeAttachmentSourceKinds: candidate.routeAttachmentSourceKinds,
          routeCandidateSnapshotFingerprint: taskRouteSnapshotFingerprint(
            routeCandidateSnapshot
          ),
          routeContextWindow: candidate.routeContextWindow,
          routeEmbeddingDimensions: candidate.routeEmbeddingDimensions,
          routeInputTypes: candidate.routeInputTypes,
          routeMaxOutputTokens: candidate.routeMaxOutputTokens,
          routeModelAliasMatched: candidate.routeModelAliasMatched,
          routeModelDefinitionAliases: candidate.routeModelDefinitionAliases,
          routeModelDefinitionId: candidate.routeModelDefinitionId,
          routeModelDefinitionSource: candidate.routeModelDefinitionSource,
          routeOutputTypes: candidate.routeOutputTypes,
          routeRawModelId: candidate.routeRawModelId,
          routeStructuredAttachmentAllowRemoteUrls:
            candidate.routeStructuredAttachmentAllowRemoteUrls,
          routeStructuredAttachmentKinds:
            candidate.routeStructuredAttachmentKinds,
          routeStructuredAttachmentSourceKinds:
            candidate.routeStructuredAttachmentSourceKinds,
          routeTrace: routeTraceSnapshot,
          routeTracePhases: route.routeTrace.map(phase => phase.phase),
          routeTraceSnapshotFingerprint:
            taskRouteSnapshotFingerprint(routeTraceSnapshot),
        },
        index
      )
    ),
  ];

  return candidates.map(candidate => ({
    candidateFingerprint:
      taskRouteRepairCandidateEvidenceFingerprint(candidate),
    ...candidate,
  }));
}

function taskRouteRepairCandidateEvidenceBase(
  scope: string,
  candidate: {
    allowed?: boolean;
    available?: boolean;
    candidateKey?: string;
    candidateModelIds?: string[];
    costInputPer1M?: number;
    costOutputPer1M?: number;
    diagnosticsErrors?: CopilotTaskRouteDiagnosticsError[];
    diagnosticsErrorSnapshotFingerprint?: string;
    dimensionMismatch?: boolean;
    embeddingIndexContractDimensions?: number;
    embeddingIndexContractFingerprint?: string;
    embeddingIndexContractStatus?: string;
    embeddingIndexContractVersion?: string;
    errorCategory?: string;
    errorCode?: string;
    fallbackProviderIds?: string[];
    health?: string;
    healthCheckedAt?: string;
    matched?: boolean;
    modelEmbeddingDimensions?: number;
    modelId?: string;
    prepared?: boolean;
    preparedModelId?: string;
    prepareCandidateSnapshotFingerprint?: string;
    preparedRouteOrderFingerprint?: string;
    preparedRouteSnapshotFingerprint?: string;
    preparedRoutes?: CopilotPreparedTaskRouteDiagnosticsType[];
    providerCapabilitySnapshotFingerprint?: string;
    providerCostSnapshotFingerprint?: string;
    providerHealthSnapshotFingerprint?: string;
    providerLimitSnapshotFingerprint?: string;
    rerankRuntimeContractFingerprint?: string;
    rerankRuntimeContractStatus?: string;
    rerankRuntimeContractTopK?: number;
    rerankRuntimeContractVersion?: string;
    taskRouteEmbeddingIndexContractSnapshotFingerprint?: string;
    taskRouteRerankRuntimeContractSnapshotFingerprint?: string;
    taskRouteDimensionSnapshotFingerprint?: string;
    taskRouteEffectiveSourceFingerprint?: string;
    taskRouteModelSourceSnapshotFingerprint?: string;
    preparedRouteTargets?: string[];
    preparedRouteTargetFingerprint?: string;
    policyCandidates?: CopilotPromptRegistryPublishGatePolicyCandidate[];
    policyCandidateSnapshotFingerprint?: string;
    privacy?: string;
    providerConfiguredModelCount?: number;
    providerConfiguredModelIds?: string[];
    providerId: string;
    providerName?: string;
    providerPriority?: number;
    providerProfileConfigPath?: string;
    providerProfileId?: string;
    providerProfileSource?: string;
    providerSource?: string;
    providerType?: string;
    reasons?: string[];
    registryAvailable?: boolean;
    registryKind?: string;
    registrySelected?: boolean;
    requestedModelConfigKey?: string;
    requestedModelConfigPath?: string;
    requestedDimensions?: number;
    requestedModelId?: string;
    requestedModelSource?: string;
    routeAttachmentAllowRemoteUrls?: boolean;
    routeAttachmentKinds?: string[];
    routeAttachmentSourceKinds?: string[];
    routeCandidateSnapshotFingerprint?: string;
    routeContextWindow?: number;
    routeEmbeddingDimensions?: number;
    routeInputTypes?: string[];
    routeMaxOutputTokens?: number;
    routeModelAliasMatched?: boolean;
    routeModelDefinitionAliases?: string[];
    routeModelDefinitionId?: string;
    routeModelDefinitionSource?: CopilotModelDefinitionSource;
    modelRegistryRevision?: string;
    modelRegistryRevisionActorId?: string;
    modelRegistryRevisionFingerprint?: string;
    modelRegistryRevisionId?: string;
    modelRegistryRevisionScope?: string;
    modelRegistryRevisionSourceChain?: CopilotModelRegistrySourceChainEntry[];
    modelRegistryRevisionSourceChainFingerprint?: string;
    modelRegistryRevisionStatus?: string;
    modelRegistryRevisionWorkspaceId?: string;
    modelRegistryRevisionPublishEventCount?: number;
    modelRegistryRevisionPublishEvents?: RegistryRevisionPublishEventRecord[];
    routeOutputTypes?: string[];
    routeRawModelId?: string;
    routeStructuredAttachmentAllowRemoteUrls?: boolean;
    routeStructuredAttachmentKinds?: string[];
    routeStructuredAttachmentSourceKinds?: string[];
    routeTrace?: CopilotPromptRegistryPublishGateRouteTracePhase[];
    routeTracePhases?: string[];
    routeTraceSnapshotFingerprint?: string;
  },
  index: number
): Omit<
  CopilotPromptRegistryPublishGateRepairCandidateEvidence,
  'candidateFingerprint'
> {
  return {
    ...(candidate.allowed !== undefined ? { allowed: candidate.allowed } : {}),
    ...(candidate.available !== undefined
      ? { available: candidate.available }
      : {}),
    candidateIndex: index,
    ...(candidate.candidateKey !== undefined
      ? { candidateKey: candidate.candidateKey }
      : {}),
    ...(definedArray(candidate.candidateModelIds) !== undefined
      ? { candidateModelIds: definedArray(candidate.candidateModelIds) }
      : {}),
    ...(candidate.costInputPer1M !== undefined
      ? { costInputPer1M: candidate.costInputPer1M }
      : {}),
    ...(candidate.costOutputPer1M !== undefined
      ? { costOutputPer1M: candidate.costOutputPer1M }
      : {}),
    ...(definedArray(candidate.diagnosticsErrors) !== undefined
      ? { diagnosticsErrors: definedArray(candidate.diagnosticsErrors) }
      : {}),
    ...(candidate.diagnosticsErrorSnapshotFingerprint !== undefined
      ? {
          diagnosticsErrorSnapshotFingerprint:
            candidate.diagnosticsErrorSnapshotFingerprint,
        }
      : {}),
    ...(candidate.dimensionMismatch !== undefined
      ? { dimensionMismatch: candidate.dimensionMismatch }
      : {}),
    ...(candidate.embeddingIndexContractDimensions !== undefined
      ? {
          embeddingIndexContractDimensions:
            candidate.embeddingIndexContractDimensions,
        }
      : {}),
    ...(candidate.embeddingIndexContractFingerprint !== undefined
      ? {
          embeddingIndexContractFingerprint:
            candidate.embeddingIndexContractFingerprint,
        }
      : {}),
    ...(candidate.embeddingIndexContractStatus !== undefined
      ? { embeddingIndexContractStatus: candidate.embeddingIndexContractStatus }
      : {}),
    ...(candidate.embeddingIndexContractVersion !== undefined
      ? {
          embeddingIndexContractVersion:
            candidate.embeddingIndexContractVersion,
        }
      : {}),
    ...(candidate.errorCategory !== undefined
      ? { errorCategory: candidate.errorCategory }
      : {}),
    ...(candidate.errorCode !== undefined
      ? { errorCode: candidate.errorCode }
      : {}),
    ...(candidate.fallbackProviderIds !== undefined
      ? { fallbackProviderIds: candidate.fallbackProviderIds }
      : {}),
    ...(candidate.health !== undefined ? { health: candidate.health } : {}),
    ...(candidate.healthCheckedAt !== undefined
      ? { healthCheckedAt: candidate.healthCheckedAt }
      : {}),
    ...(candidate.matched !== undefined ? { matched: candidate.matched } : {}),
    ...(candidate.modelEmbeddingDimensions !== undefined
      ? { modelEmbeddingDimensions: candidate.modelEmbeddingDimensions }
      : {}),
    ...(candidate.modelId !== undefined ? { modelId: candidate.modelId } : {}),
    ...(candidate.prepared !== undefined
      ? { prepared: candidate.prepared }
      : {}),
    ...(candidate.preparedModelId !== undefined
      ? { preparedModelId: candidate.preparedModelId }
      : {}),
    ...(candidate.prepareCandidateSnapshotFingerprint !== undefined
      ? {
          prepareCandidateSnapshotFingerprint:
            candidate.prepareCandidateSnapshotFingerprint,
        }
      : {}),
    ...(candidate.preparedRouteOrderFingerprint !== undefined
      ? {
          preparedRouteOrderFingerprint:
            candidate.preparedRouteOrderFingerprint,
        }
      : {}),
    ...(candidate.preparedRouteSnapshotFingerprint !== undefined
      ? {
          preparedRouteSnapshotFingerprint:
            candidate.preparedRouteSnapshotFingerprint,
        }
      : {}),
    ...(candidate.preparedRoutes !== undefined
      ? { preparedRoutes: candidate.preparedRoutes }
      : {}),
    ...(candidate.providerCapabilitySnapshotFingerprint !== undefined
      ? {
          providerCapabilitySnapshotFingerprint:
            candidate.providerCapabilitySnapshotFingerprint,
        }
      : {}),
    ...(candidate.providerCostSnapshotFingerprint !== undefined
      ? {
          providerCostSnapshotFingerprint:
            candidate.providerCostSnapshotFingerprint,
        }
      : {}),
    ...(candidate.providerHealthSnapshotFingerprint !== undefined
      ? {
          providerHealthSnapshotFingerprint:
            candidate.providerHealthSnapshotFingerprint,
        }
      : {}),
    ...(candidate.providerLimitSnapshotFingerprint !== undefined
      ? {
          providerLimitSnapshotFingerprint:
            candidate.providerLimitSnapshotFingerprint,
        }
      : {}),
    ...(candidate.rerankRuntimeContractFingerprint !== undefined
      ? {
          rerankRuntimeContractFingerprint:
            candidate.rerankRuntimeContractFingerprint,
        }
      : {}),
    ...(candidate.rerankRuntimeContractStatus !== undefined
      ? {
          rerankRuntimeContractStatus: candidate.rerankRuntimeContractStatus,
        }
      : {}),
    ...(candidate.rerankRuntimeContractTopK !== undefined
      ? {
          rerankRuntimeContractTopK: candidate.rerankRuntimeContractTopK,
        }
      : {}),
    ...(candidate.rerankRuntimeContractVersion !== undefined
      ? {
          rerankRuntimeContractVersion: candidate.rerankRuntimeContractVersion,
        }
      : {}),
    ...(candidate.taskRouteEmbeddingIndexContractSnapshotFingerprint !==
    undefined
      ? {
          taskRouteEmbeddingIndexContractSnapshotFingerprint:
            candidate.taskRouteEmbeddingIndexContractSnapshotFingerprint,
        }
      : {}),
    ...(candidate.taskRouteRerankRuntimeContractSnapshotFingerprint !==
    undefined
      ? {
          taskRouteRerankRuntimeContractSnapshotFingerprint:
            candidate.taskRouteRerankRuntimeContractSnapshotFingerprint,
        }
      : {}),
    ...(candidate.taskRouteDimensionSnapshotFingerprint !== undefined
      ? {
          taskRouteDimensionSnapshotFingerprint:
            candidate.taskRouteDimensionSnapshotFingerprint,
        }
      : {}),
    ...(candidate.taskRouteEffectiveSourceFingerprint !== undefined
      ? {
          taskRouteEffectiveSourceFingerprint:
            candidate.taskRouteEffectiveSourceFingerprint,
        }
      : {}),
    ...(candidate.taskRouteModelSourceSnapshotFingerprint !== undefined
      ? {
          taskRouteModelSourceSnapshotFingerprint:
            candidate.taskRouteModelSourceSnapshotFingerprint,
        }
      : {}),
    ...(candidate.preparedRouteTargets !== undefined
      ? {
          preparedRouteTargets: candidate.preparedRouteTargets,
        }
      : {}),
    ...(candidate.preparedRouteTargetFingerprint !== undefined
      ? {
          preparedRouteTargetFingerprint:
            candidate.preparedRouteTargetFingerprint,
        }
      : {}),
    ...(candidate.policyCandidates !== undefined
      ? { policyCandidates: candidate.policyCandidates }
      : {}),
    ...(candidate.policyCandidateSnapshotFingerprint !== undefined
      ? {
          policyCandidateSnapshotFingerprint:
            candidate.policyCandidateSnapshotFingerprint,
        }
      : {}),
    ...(candidate.privacy !== undefined ? { privacy: candidate.privacy } : {}),
    ...(candidate.providerConfiguredModelCount !== undefined
      ? { providerConfiguredModelCount: candidate.providerConfiguredModelCount }
      : {}),
    ...(definedArray(candidate.providerConfiguredModelIds) !== undefined
      ? {
          providerConfiguredModelIds: definedArray(
            candidate.providerConfiguredModelIds
          ),
        }
      : {}),
    providerId: candidate.providerId,
    ...(candidate.providerName !== undefined
      ? { providerName: candidate.providerName }
      : {}),
    ...(candidate.providerPriority !== undefined
      ? { providerPriority: candidate.providerPriority }
      : {}),
    ...(candidate.providerProfileConfigPath !== undefined
      ? { providerProfileConfigPath: candidate.providerProfileConfigPath }
      : {}),
    ...(candidate.providerProfileId !== undefined
      ? { providerProfileId: candidate.providerProfileId }
      : {}),
    ...(candidate.providerProfileSource !== undefined
      ? { providerProfileSource: candidate.providerProfileSource }
      : {}),
    ...(candidate.providerSource !== undefined
      ? { providerSource: candidate.providerSource }
      : {}),
    ...(candidate.providerType !== undefined
      ? { providerType: candidate.providerType }
      : {}),
    reasons: uniqueStrings(candidate.reasons ?? []),
    ...(candidate.registryAvailable !== undefined
      ? { registryAvailable: candidate.registryAvailable }
      : {}),
    ...(candidate.registryKind !== undefined
      ? { registryKind: candidate.registryKind }
      : {}),
    ...(candidate.registrySelected !== undefined
      ? { registrySelected: candidate.registrySelected }
      : {}),
    ...(candidate.requestedModelConfigKey !== undefined
      ? { requestedModelConfigKey: candidate.requestedModelConfigKey }
      : {}),
    ...(candidate.requestedModelConfigPath !== undefined
      ? { requestedModelConfigPath: candidate.requestedModelConfigPath }
      : {}),
    ...(candidate.requestedDimensions !== undefined
      ? { requestedDimensions: candidate.requestedDimensions }
      : {}),
    ...(candidate.requestedModelId !== undefined
      ? { requestedModelId: candidate.requestedModelId }
      : {}),
    ...(candidate.requestedModelSource !== undefined
      ? { requestedModelSource: candidate.requestedModelSource }
      : {}),
    ...(candidate.routeAttachmentAllowRemoteUrls !== undefined
      ? {
          routeAttachmentAllowRemoteUrls:
            candidate.routeAttachmentAllowRemoteUrls,
        }
      : {}),
    ...(definedArray(candidate.routeAttachmentKinds) !== undefined
      ? { routeAttachmentKinds: definedArray(candidate.routeAttachmentKinds) }
      : {}),
    ...(definedArray(candidate.routeAttachmentSourceKinds) !== undefined
      ? {
          routeAttachmentSourceKinds: definedArray(
            candidate.routeAttachmentSourceKinds
          ),
        }
      : {}),
    ...(candidate.routeCandidateSnapshotFingerprint !== undefined
      ? {
          routeCandidateSnapshotFingerprint:
            candidate.routeCandidateSnapshotFingerprint,
        }
      : {}),
    ...(candidate.routeContextWindow !== undefined
      ? { routeContextWindow: candidate.routeContextWindow }
      : {}),
    ...(candidate.routeEmbeddingDimensions !== undefined
      ? { routeEmbeddingDimensions: candidate.routeEmbeddingDimensions }
      : {}),
    ...(definedArray(candidate.routeInputTypes) !== undefined
      ? { routeInputTypes: definedArray(candidate.routeInputTypes) }
      : {}),
    ...(candidate.routeMaxOutputTokens !== undefined
      ? { routeMaxOutputTokens: candidate.routeMaxOutputTokens }
      : {}),
    ...(candidate.routeModelAliasMatched !== undefined
      ? { routeModelAliasMatched: candidate.routeModelAliasMatched }
      : {}),
    ...(definedArray(candidate.routeModelDefinitionAliases) !== undefined
      ? {
          routeModelDefinitionAliases: definedArray(
            candidate.routeModelDefinitionAliases
          ),
        }
      : {}),
    ...(candidate.routeModelDefinitionId !== undefined
      ? { routeModelDefinitionId: candidate.routeModelDefinitionId }
      : {}),
    ...(candidate.routeModelDefinitionSource !== undefined
      ? { routeModelDefinitionSource: candidate.routeModelDefinitionSource }
      : {}),
    ...(candidate.modelRegistryRevision !== undefined
      ? { modelRegistryRevision: candidate.modelRegistryRevision }
      : {}),
    ...(candidate.modelRegistryRevisionActorId !== undefined
      ? {
          modelRegistryRevisionActorId: candidate.modelRegistryRevisionActorId,
        }
      : {}),
    ...(candidate.modelRegistryRevisionFingerprint !== undefined
      ? {
          modelRegistryRevisionFingerprint:
            candidate.modelRegistryRevisionFingerprint,
        }
      : {}),
    ...(candidate.modelRegistryRevisionId !== undefined
      ? { modelRegistryRevisionId: candidate.modelRegistryRevisionId }
      : {}),
    ...(candidate.modelRegistryRevisionScope !== undefined
      ? { modelRegistryRevisionScope: candidate.modelRegistryRevisionScope }
      : {}),
    ...(candidate.modelRegistryRevisionSourceChain !== undefined
      ? {
          modelRegistryRevisionSourceChain:
            candidate.modelRegistryRevisionSourceChain,
        }
      : {}),
    ...(candidate.modelRegistryRevisionSourceChainFingerprint !== undefined
      ? {
          modelRegistryRevisionSourceChainFingerprint:
            candidate.modelRegistryRevisionSourceChainFingerprint,
        }
      : {}),
    ...(candidate.modelRegistryRevisionStatus !== undefined
      ? { modelRegistryRevisionStatus: candidate.modelRegistryRevisionStatus }
      : {}),
    ...(candidate.modelRegistryRevisionWorkspaceId !== undefined
      ? {
          modelRegistryRevisionWorkspaceId:
            candidate.modelRegistryRevisionWorkspaceId,
        }
      : {}),
    ...(candidate.modelRegistryRevisionPublishEventCount !== undefined
      ? {
          modelRegistryRevisionPublishEventCount:
            candidate.modelRegistryRevisionPublishEventCount,
        }
      : {}),
    ...(candidate.modelRegistryRevisionPublishEvents !== undefined
      ? {
          modelRegistryRevisionPublishEvents:
            candidate.modelRegistryRevisionPublishEvents,
        }
      : {}),
    ...(definedArray(candidate.routeOutputTypes) !== undefined
      ? { routeOutputTypes: definedArray(candidate.routeOutputTypes) }
      : {}),
    ...(candidate.routeRawModelId !== undefined
      ? { routeRawModelId: candidate.routeRawModelId }
      : {}),
    ...(candidate.routeStructuredAttachmentAllowRemoteUrls !== undefined
      ? {
          routeStructuredAttachmentAllowRemoteUrls:
            candidate.routeStructuredAttachmentAllowRemoteUrls,
        }
      : {}),
    ...(definedArray(candidate.routeStructuredAttachmentKinds) !== undefined
      ? {
          routeStructuredAttachmentKinds: definedArray(
            candidate.routeStructuredAttachmentKinds
          ),
        }
      : {}),
    ...(definedArray(candidate.routeStructuredAttachmentSourceKinds) !==
    undefined
      ? {
          routeStructuredAttachmentSourceKinds: definedArray(
            candidate.routeStructuredAttachmentSourceKinds
          ),
        }
      : {}),
    ...(candidate.routeTrace !== undefined
      ? { routeTrace: candidate.routeTrace }
      : {}),
    ...(candidate.routeTracePhases !== undefined
      ? { routeTracePhases: candidate.routeTracePhases }
      : {}),
    ...(candidate.routeTraceSnapshotFingerprint !== undefined
      ? {
          routeTraceSnapshotFingerprint:
            candidate.routeTraceSnapshotFingerprint,
        }
      : {}),
    scope,
  };
}

function taskRouteCandidateProfileStructuredEvidence(
  route: CopilotPromptRegistryPublishGateTaskRoute
) {
  const candidateEvidence = (
    scope: string,
    candidate: {
      allowed?: boolean;
      available?: boolean;
      candidateKey?: string;
      candidateModelIds?: string[];
      costInputPer1M?: number;
      costOutputPer1M?: number;
      diagnosticsErrors?: CopilotTaskRouteDiagnosticsError[];
      diagnosticsErrorSnapshotFingerprint?: string;
      dimensionMismatch?: boolean;
      embeddingIndexContractDimensions?: number;
      embeddingIndexContractFingerprint?: string;
      embeddingIndexContractStatus?: string;
      embeddingIndexContractVersion?: string;
      errorCategory?: string;
      errorCode?: string;
      fallbackProviderIds?: string[];
      health?: string;
      healthCheckedAt?: string;
      matched?: boolean;
      modelEmbeddingDimensions?: number;
      modelId?: string;
      prepared?: boolean;
      preparedModelId?: string;
      prepareCandidateSnapshotFingerprint?: string;
      preparedRouteOrderFingerprint?: string;
      preparedRouteSnapshotFingerprint?: string;
      preparedRoutes?: CopilotPreparedTaskRouteDiagnosticsType[];
      providerCapabilitySnapshotFingerprint?: string;
      providerCostSnapshotFingerprint?: string;
      providerHealthSnapshotFingerprint?: string;
      providerLimitSnapshotFingerprint?: string;
      taskRouteEmbeddingIndexContractSnapshotFingerprint?: string;
      taskRouteDimensionSnapshotFingerprint?: string;
      taskRouteEffectiveSourceFingerprint?: string;
      taskRouteModelSourceSnapshotFingerprint?: string;
      preparedRouteTargets?: string[];
      preparedRouteTargetFingerprint?: string;
      policyCandidates?: CopilotPromptRegistryPublishGatePolicyCandidate[];
      policyCandidateSnapshotFingerprint?: string;
      privacy?: string;
      providerConfiguredModelCount?: number;
      providerConfiguredModelIds?: string[];
      providerId: string;
      providerName?: string;
      providerPriority?: number;
      providerProfileConfigPath?: string;
      providerProfileId?: string;
      providerProfileSource?: string;
      providerSource?: string;
      providerType?: string;
      reasons?: string[];
      registryAvailable?: boolean;
      registryKind?: string;
      registrySelected?: boolean;
      requestedModelConfigKey?: string;
      requestedModelConfigPath?: string;
      requestedDimensions?: number;
      requestedModelId?: string;
      requestedModelSource?: string;
      routeAttachmentAllowRemoteUrls?: boolean;
      routeAttachmentKinds?: string[];
      routeAttachmentSourceKinds?: string[];
      routeCandidateSnapshotFingerprint?: string;
      routeContextWindow?: number;
      routeEmbeddingDimensions?: number;
      routeInputTypes?: string[];
      routeMaxOutputTokens?: number;
      routeModelAliasMatched?: boolean;
      routeModelDefinitionAliases?: string[];
      routeModelDefinitionId?: string;
      routeModelDefinitionSource?: CopilotModelDefinitionSource;
      routeOutputTypes?: string[];
      routeRawModelId?: string;
      routeStructuredAttachmentAllowRemoteUrls?: boolean;
      routeStructuredAttachmentKinds?: string[];
      routeStructuredAttachmentSourceKinds?: string[];
      routeTrace?: CopilotPromptRegistryPublishGateRouteTracePhase[];
      routeTracePhases?: string[];
      routeTraceSnapshotFingerprint?: string;
    },
    index: number
  ): CopilotPromptRegistryPublishGateRepairCandidateEvidence => {
    const policyCandidateSnapshot: CopilotPromptRegistryPublishGatePolicyCandidate[] =
      route.policyCandidates.map(candidate => ({
        allowed: candidate.allowed,
        available: candidate.available,
        candidateFingerprint: candidate.candidateFingerprint,
        candidateKey: candidate.candidateKey,
        health: candidate.health,
        ...(candidate.healthCheckedAt
          ? { healthCheckedAt: candidate.healthCheckedAt }
          : {}),
        privacy: candidate.privacy,
        providerId: candidate.providerId,
        ...(candidate.providerConfiguredModelCount !== undefined
          ? {
              providerConfiguredModelCount:
                candidate.providerConfiguredModelCount,
            }
          : {}),
        ...(candidate.providerConfiguredModelIds?.length
          ? {
              providerConfiguredModelIds: candidate.providerConfiguredModelIds,
            }
          : {}),
        ...(candidate.providerName
          ? { providerName: candidate.providerName }
          : {}),
        ...(candidate.providerPriority !== undefined
          ? { providerPriority: candidate.providerPriority }
          : {}),
        ...(candidate.providerProfileConfigPath
          ? {
              providerProfileConfigPath: candidate.providerProfileConfigPath,
            }
          : {}),
        ...(candidate.providerProfileId
          ? { providerProfileId: candidate.providerProfileId }
          : {}),
        ...(candidate.providerProfileSource
          ? { providerProfileSource: candidate.providerProfileSource }
          : {}),
        ...(candidate.providerSource
          ? { providerSource: candidate.providerSource }
          : {}),
        ...(candidate.providerType
          ? { providerType: candidate.providerType }
          : {}),
        ...(candidate.registryAvailable !== undefined
          ? { registryAvailable: candidate.registryAvailable }
          : {}),
        ...(candidate.registryKind
          ? { registryKind: candidate.registryKind }
          : {}),
        ...(candidate.registrySelected !== undefined
          ? { registrySelected: candidate.registrySelected }
          : {}),
        reasons: candidate.reasons,
      }));
    const routeCandidateSnapshot = route.routeCandidates.map(
      toPromptRegistryPublishGateRouteCandidate
    );
    const prepareCandidateSnapshot = taskRoutePrepareCandidateSnapshot(
      route.prepareCandidates
    );
    const preparedRouteSnapshot = taskRoutePreparedRouteSnapshot(
      route.preparedRoutes
    );
    const preparedRouteOrderSnapshot = taskRoutePreparedRouteOrderSnapshot(
      route.preparedRoutes
    );
    const providerCapabilitySnapshot =
      taskRouteProviderCapabilitySnapshot(route);
    const providerCostSnapshot = taskRouteProviderCostSnapshot(route);
    const providerHealthSnapshot = taskRouteProviderHealthSnapshot(route);
    const providerLimitSnapshot = taskRouteProviderLimitSnapshot(route);
    const taskRouteDimensionSnapshotValue = taskRouteDimensionSnapshot(route);
    const taskRouteEmbeddingIndexContractSnapshotValue =
      taskRouteEmbeddingIndexContractSnapshot(route);
    const taskRouteRerankRuntimeContractSnapshotValue =
      taskRouteRerankRuntimeContractSnapshot(route);
    const taskRouteModelSourceSnapshotValue =
      taskRouteModelSourceSnapshot(route);
    const diagnosticsErrorSnapshot = route.diagnosticsErrors.map(error => ({
      code: error.code,
      message: error.message,
      stage: error.stage,
    }));
    const routeTraceSnapshot = route.routeTrace.map(phase => ({
      ...(phase.availableCount !== undefined
        ? { availableCount: phase.availableCount }
        : {}),
      ...(phase.blockedCount !== undefined
        ? { blockedCount: phase.blockedCount }
        : {}),
      candidateCount: phase.candidateCount,
      ...(phase.matchedCount !== undefined
        ? { matchedCount: phase.matchedCount }
        : {}),
      phase: phase.phase,
      ...(phase.preparedCount !== undefined
        ? { preparedCount: phase.preparedCount }
        : {}),
      reasons: phase.reasons,
      ...(phase.selectedCount !== undefined
        ? { selectedCount: phase.selectedCount }
        : {}),
    }));
    const evidence = taskRouteRepairCandidateEvidenceBase(
      scope,
      {
        ...candidate,
        ...(diagnosticsErrorSnapshot.length
          ? {
              diagnosticsErrors: diagnosticsErrorSnapshot,
              diagnosticsErrorSnapshotFingerprint: taskRouteSnapshotFingerprint(
                diagnosticsErrorSnapshot
              ),
            }
          : {}),
        fallbackProviderIds: route.fallbackProviderIds,
        prepareCandidateSnapshotFingerprint: taskRouteSnapshotFingerprint(
          prepareCandidateSnapshot
        ),
        preparedRouteOrderFingerprint: taskRouteSnapshotFingerprint(
          preparedRouteOrderSnapshot
        ),
        preparedRouteSnapshotFingerprint: taskRouteSnapshotFingerprint(
          preparedRouteSnapshot
        ),
        preparedRoutes: preparedRouteSnapshot,
        providerCapabilitySnapshotFingerprint: taskRouteSnapshotFingerprint(
          providerCapabilitySnapshot
        ),
        providerCostSnapshotFingerprint:
          taskRouteSnapshotFingerprint(providerCostSnapshot),
        providerHealthSnapshotFingerprint: taskRouteSnapshotFingerprint(
          providerHealthSnapshot
        ),
        providerLimitSnapshotFingerprint: taskRouteSnapshotFingerprint(
          providerLimitSnapshot
        ),
        taskRouteDimensionSnapshotFingerprint: taskRouteSnapshotFingerprint(
          taskRouteDimensionSnapshotValue
        ),
        ...(route.effectiveSourceFingerprint
          ? {
              taskRouteEffectiveSourceFingerprint:
                route.effectiveSourceFingerprint,
            }
          : {}),
        ...(taskRouteEmbeddingIndexContractSnapshotValue.length
          ? {
              taskRouteEmbeddingIndexContractSnapshotFingerprint:
                taskRouteSnapshotFingerprint(
                  taskRouteEmbeddingIndexContractSnapshotValue
                ),
            }
          : {}),
        ...(taskRouteRerankRuntimeContractSnapshotValue.length
          ? {
              taskRouteRerankRuntimeContractSnapshotFingerprint:
                taskRouteSnapshotFingerprint(
                  taskRouteRerankRuntimeContractSnapshotValue
                ),
            }
          : {}),
        taskRouteModelSourceSnapshotFingerprint: taskRouteSnapshotFingerprint(
          taskRouteModelSourceSnapshotValue
        ),
        preparedRouteTargets: route.preparedRouteTargets,
        preparedRouteTargetFingerprint: route.preparedRouteTargetFingerprint,
        policyCandidates: policyCandidateSnapshot,
        policyCandidateSnapshotFingerprint: taskRouteSnapshotFingerprint(
          policyCandidateSnapshot
        ),
        ...(route.dimensionMismatch !== undefined
          ? { dimensionMismatch: route.dimensionMismatch }
          : {}),
        ...(route.embeddingIndexContractDimensions !== undefined
          ? {
              embeddingIndexContractDimensions:
                route.embeddingIndexContractDimensions,
            }
          : {}),
        ...(route.embeddingIndexContractFingerprint
          ? {
              embeddingIndexContractFingerprint:
                route.embeddingIndexContractFingerprint,
            }
          : {}),
        ...(route.embeddingIndexContractStatus
          ? { embeddingIndexContractStatus: route.embeddingIndexContractStatus }
          : {}),
        ...(route.embeddingIndexContractVersion
          ? {
              embeddingIndexContractVersion:
                route.embeddingIndexContractVersion,
            }
          : {}),
        ...(route.rerankRuntimeContractFingerprint
          ? {
              rerankRuntimeContractFingerprint:
                route.rerankRuntimeContractFingerprint,
            }
          : {}),
        ...(route.rerankRuntimeContractStatus
          ? { rerankRuntimeContractStatus: route.rerankRuntimeContractStatus }
          : {}),
        ...(route.rerankRuntimeContractTopK !== undefined
          ? {
              rerankRuntimeContractTopK: route.rerankRuntimeContractTopK,
            }
          : {}),
        ...(route.rerankRuntimeContractVersion
          ? {
              rerankRuntimeContractVersion: route.rerankRuntimeContractVersion,
            }
          : {}),
        ...(route.modelEmbeddingDimensions !== undefined
          ? { modelEmbeddingDimensions: route.modelEmbeddingDimensions }
          : {}),
        ...(route.requestedDimensions !== undefined
          ? { requestedDimensions: route.requestedDimensions }
          : {}),
        requestedModelConfigKey: route.requestedModelConfigKey,
        requestedModelConfigPath: route.requestedModelConfigPath,
        requestedModelSource: route.requestedModelSource,
        routeCandidateSnapshotFingerprint: taskRouteSnapshotFingerprint(
          routeCandidateSnapshot
        ),
        routeTrace: routeTraceSnapshot,
        routeTracePhases: route.routeTrace.map(phase => phase.phase),
        routeTraceSnapshotFingerprint:
          taskRouteSnapshotFingerprint(routeTraceSnapshot),
      },
      index
    );

    return {
      candidateFingerprint:
        taskRouteRepairCandidateEvidenceFingerprint(evidence),
      ...evidence,
      ...(evidence.taskRouteEffectiveSourceFingerprint
        ? {
            taskRouteEffectiveSourceFingerprintInputs: [
              ...COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_FINGERPRINT_INPUTS,
            ],
            taskRouteEffectiveSourceFingerprintVersion:
              COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_FINGERPRINT_VERSION,
          }
        : {}),
      prepareCandidates: prepareCandidateSnapshot,
      routeCandidates: routeCandidateSnapshot,
      taskRouteModelSourceSnapshotEntries: taskRouteModelSourceSnapshotValue,
    };
  };

  return [
    ...route.policyCandidates.map((candidate, index) =>
      candidateEvidence('policyCandidate', candidate, index)
    ),
    ...route.routeCandidates.map((candidate, index) =>
      candidateEvidence('routeCandidate', candidate, index)
    ),
    ...(route.prepareCandidates ?? []).map((candidate, index) =>
      candidateEvidence('prepareCandidate', candidate, index)
    ),
  ];
}

function taskRouteCandidateProfileEvidence(
  candidateEvidence: CopilotPromptRegistryPublishGateRepairCandidateEvidence[]
) {
  const candidateCapabilityLimitCostEvidence = (
    candidate: CopilotPromptRegistryPublishGateRepairCandidateEvidence
  ) => [
    candidate.costInputPer1M !== undefined
      ? `${candidate.scope}#${candidate.candidateIndex}:costInputPer1M:${candidate.costInputPer1M}`
      : null,
    candidate.costOutputPer1M !== undefined
      ? `${candidate.scope}#${candidate.candidateIndex}:costOutputPer1M:${candidate.costOutputPer1M}`
      : null,
    candidate.routeContextWindow !== undefined
      ? `${candidate.scope}#${candidate.candidateIndex}:routeContextWindow:${candidate.routeContextWindow}`
      : null,
    candidate.routeMaxOutputTokens !== undefined
      ? `${candidate.scope}#${candidate.candidateIndex}:routeMaxOutputTokens:${candidate.routeMaxOutputTokens}`
      : null,
    candidate.routeEmbeddingDimensions !== undefined
      ? `${candidate.scope}#${candidate.candidateIndex}:routeEmbeddingDimensions:${candidate.routeEmbeddingDimensions}`
      : null,
    ...(candidate.routeInputTypes ?? []).map(
      inputType =>
        `${candidate.scope}#${candidate.candidateIndex}:routeInputType:${inputType}`
    ),
    ...(candidate.routeOutputTypes ?? []).map(
      outputType =>
        `${candidate.scope}#${candidate.candidateIndex}:routeOutputType:${outputType}`
    ),
    ...(candidate.routeAttachmentKinds ?? []).map(
      kind =>
        `${candidate.scope}#${candidate.candidateIndex}:routeAttachmentKind:${kind}`
    ),
    ...(candidate.routeAttachmentSourceKinds ?? []).map(
      kind =>
        `${candidate.scope}#${candidate.candidateIndex}:routeAttachmentSourceKind:${kind}`
    ),
    candidate.routeAttachmentAllowRemoteUrls !== undefined
      ? `${candidate.scope}#${candidate.candidateIndex}:routeAttachmentAllowRemoteUrls:${candidate.routeAttachmentAllowRemoteUrls}`
      : null,
    ...(candidate.routeStructuredAttachmentKinds ?? []).map(
      kind =>
        `${candidate.scope}#${candidate.candidateIndex}:routeStructuredAttachmentKind:${kind}`
    ),
    ...(candidate.routeStructuredAttachmentSourceKinds ?? []).map(
      kind =>
        `${candidate.scope}#${candidate.candidateIndex}:routeStructuredAttachmentSourceKind:${kind}`
    ),
    candidate.routeStructuredAttachmentAllowRemoteUrls !== undefined
      ? `${candidate.scope}#${candidate.candidateIndex}:routeStructuredAttachmentAllowRemoteUrls:${candidate.routeStructuredAttachmentAllowRemoteUrls}`
      : null,
  ];
  const candidateEmbeddingIndexContractEvidence = (
    candidate: CopilotPromptRegistryPublishGateRepairCandidateEvidence
  ) => [
    candidate.embeddingIndexContractVersion
      ? `${candidate.scope}#${candidate.candidateIndex}:embeddingIndexContractVersion:${candidate.embeddingIndexContractVersion}`
      : null,
    candidate.embeddingIndexContractDimensions !== undefined
      ? `${candidate.scope}#${candidate.candidateIndex}:embeddingIndexContractDimensions:${candidate.embeddingIndexContractDimensions}`
      : null,
    candidate.embeddingIndexContractStatus
      ? `${candidate.scope}#${candidate.candidateIndex}:embeddingIndexContractStatus:${candidate.embeddingIndexContractStatus}`
      : null,
    candidate.embeddingIndexContractFingerprint
      ? `${candidate.scope}#${candidate.candidateIndex}:embeddingIndexContractFingerprint:${candidate.embeddingIndexContractFingerprint}`
      : null,
  ];
  const candidateRerankRuntimeContractEvidence = (
    candidate: CopilotPromptRegistryPublishGateRepairCandidateEvidence
  ) => [
    candidate.rerankRuntimeContractVersion
      ? `${candidate.scope}#${candidate.candidateIndex}:rerankRuntimeContractVersion:${candidate.rerankRuntimeContractVersion}`
      : null,
    candidate.rerankRuntimeContractTopK !== undefined
      ? `${candidate.scope}#${candidate.candidateIndex}:rerankRuntimeContractTopK:${candidate.rerankRuntimeContractTopK}`
      : null,
    candidate.rerankRuntimeContractStatus
      ? `${candidate.scope}#${candidate.candidateIndex}:rerankRuntimeContractStatus:${candidate.rerankRuntimeContractStatus}`
      : null,
    candidate.rerankRuntimeContractFingerprint
      ? `${candidate.scope}#${candidate.candidateIndex}:rerankRuntimeContractFingerprint:${candidate.rerankRuntimeContractFingerprint}`
      : null,
  ];

  const primaryRouteEvidence = candidateEvidence
    .filter(candidate => candidate.candidateIndex === 0)
    .flatMap(candidate =>
      compactEvidence(
        [
          `${candidate.scope}#${candidate.candidateIndex}:providerId:${candidate.providerId}`,
          candidate.allowed !== undefined
            ? `${candidate.scope}#${candidate.candidateIndex}:allowed:${candidate.allowed}`
            : null,
          candidate.available !== undefined
            ? `${candidate.scope}#${candidate.candidateIndex}:available:${candidate.available}`
            : null,
          candidate.matched !== undefined
            ? `${candidate.scope}#${candidate.candidateIndex}:matched:${candidate.matched}`
            : null,
          candidate.prepared !== undefined
            ? `${candidate.scope}#${candidate.candidateIndex}:prepared:${candidate.prepared}`
            : null,
          candidate.diagnosticsErrorSnapshotFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:diagnosticsErrorSnapshotFingerprint:${candidate.diagnosticsErrorSnapshotFingerprint}`
            : null,
          candidate.modelId
            ? `${candidate.scope}#${candidate.candidateIndex}:modelId:${candidate.modelId}`
            : null,
          candidate.preparedModelId
            ? `${candidate.scope}#${candidate.candidateIndex}:preparedModelId:${candidate.preparedModelId}`
            : null,
          candidate.providerProfileId
            ? `${candidate.scope}#${candidate.candidateIndex}:providerProfileId:${candidate.providerProfileId}`
            : null,
          candidate.providerProfileConfigPath
            ? `${candidate.scope}#${candidate.candidateIndex}:providerProfileConfigPath:${candidate.providerProfileConfigPath}`
            : null,
          ...(candidate.providerConfiguredModelIds ?? []).map(
            modelId =>
              `${candidate.scope}#${candidate.candidateIndex}:providerConfiguredModel:${modelId}`
          ),
          candidate.privacy
            ? `${candidate.scope}#${candidate.candidateIndex}:privacy:${candidate.privacy}`
            : null,
          candidate.health
            ? `${candidate.scope}#${candidate.candidateIndex}:health:${candidate.health}`
            : null,
          candidate.healthCheckedAt
            ? `${candidate.scope}#${candidate.candidateIndex}:healthCheckedAt:${candidate.healthCheckedAt}`
            : null,
          candidate.errorCode
            ? `${candidate.scope}#${candidate.candidateIndex}:errorCode:${candidate.errorCode}`
            : null,
          candidate.errorCategory
            ? `${candidate.scope}#${candidate.candidateIndex}:errorCategory:${candidate.errorCategory}`
            : null,
          candidate.registryKind
            ? `${candidate.scope}#${candidate.candidateIndex}:registryKind:${candidate.registryKind}`
            : null,
          candidate.registryAvailable !== undefined
            ? `${candidate.scope}#${candidate.candidateIndex}:registryAvailable:${candidate.registryAvailable}`
            : null,
          candidate.registrySelected !== undefined
            ? `${candidate.scope}#${candidate.candidateIndex}:registrySelected:${candidate.registrySelected}`
            : null,
          candidate.routeModelDefinitionSource
            ? `${candidate.scope}#${candidate.candidateIndex}:routeModelDefinitionSource:${candidate.routeModelDefinitionSource}`
            : null,
          candidate.routeModelDefinitionId
            ? `${candidate.scope}#${candidate.candidateIndex}:routeModelDefinitionId:${candidate.routeModelDefinitionId}`
            : null,
          ...(candidate.routeModelDefinitionAliases ?? []).map(
            alias =>
              `${candidate.scope}#${candidate.candidateIndex}:routeModelDefinitionAlias:${alias}`
          ),
          candidate.routeModelAliasMatched !== undefined
            ? `${candidate.scope}#${candidate.candidateIndex}:routeModelAliasMatched:${candidate.routeModelAliasMatched}`
            : null,
          candidate.modelRegistryRevisionId
            ? `${candidate.scope}#${candidate.candidateIndex}:modelRegistryRevisionId:${candidate.modelRegistryRevisionId}`
            : null,
          candidate.modelRegistryRevision
            ? `${candidate.scope}#${candidate.candidateIndex}:modelRegistryRevision:${candidate.modelRegistryRevision}`
            : null,
          candidate.modelRegistryRevisionScope
            ? `${candidate.scope}#${candidate.candidateIndex}:modelRegistryRevisionScope:${candidate.modelRegistryRevisionScope}`
            : null,
          candidate.modelRegistryRevisionFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:modelRegistryRevisionFingerprint:${candidate.modelRegistryRevisionFingerprint}`
            : null,
          candidate.modelRegistryRevisionSourceChainFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:modelRegistryRevisionSourceChainFingerprint:${candidate.modelRegistryRevisionSourceChainFingerprint}`
            : null,
          candidate.routeRawModelId
            ? `${candidate.scope}#${candidate.candidateIndex}:routeRawModelId:${candidate.routeRawModelId}`
            : null,
          ...candidateCapabilityLimitCostEvidence(candidate),
          ...candidateRerankRuntimeContractEvidence(candidate),
        ],
        44
      )
    );
  const primaryEvidence = candidateEvidence
    .filter(candidate => candidate.candidateIndex === 0)
    .flatMap(candidate =>
      compactEvidence(
        [
          `${candidate.scope}#${candidate.candidateIndex}:candidateFingerprint:${candidate.candidateFingerprint}`,
          `${candidate.scope}#${candidate.candidateIndex}:providerId:${candidate.providerId}`,
          candidate.allowed !== undefined
            ? `${candidate.scope}#${candidate.candidateIndex}:allowed:${candidate.allowed}`
            : null,
          candidate.available !== undefined
            ? `${candidate.scope}#${candidate.candidateIndex}:available:${candidate.available}`
            : null,
          candidate.matched !== undefined
            ? `${candidate.scope}#${candidate.candidateIndex}:matched:${candidate.matched}`
            : null,
          candidate.prepared !== undefined
            ? `${candidate.scope}#${candidate.candidateIndex}:prepared:${candidate.prepared}`
            : null,
          candidate.diagnosticsErrorSnapshotFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:diagnosticsErrorSnapshotFingerprint:${candidate.diagnosticsErrorSnapshotFingerprint}`
            : null,
          ...(candidate.diagnosticsErrors ?? []).flatMap((error, index) => [
            `${candidate.scope}#${candidate.candidateIndex}:diagnosticsError#${index}:stage:${error.stage}`,
            `${candidate.scope}#${candidate.candidateIndex}:diagnosticsError#${index}:code:${error.code}`,
            `${candidate.scope}#${candidate.candidateIndex}:diagnosticsError#${index}:message:${error.message}`,
          ]),
          candidate.requestedModelId
            ? `${candidate.scope}#${candidate.candidateIndex}:requestedModelId:${candidate.requestedModelId}`
            : null,
          candidate.requestedModelSource
            ? `${candidate.scope}#${candidate.candidateIndex}:requestedModelSource:${candidate.requestedModelSource}`
            : null,
          candidate.requestedModelConfigPath
            ? `${candidate.scope}#${candidate.candidateIndex}:requestedModelConfigPath:${candidate.requestedModelConfigPath}`
            : null,
          candidate.requestedDimensions !== undefined
            ? `${candidate.scope}#${candidate.candidateIndex}:requestedDimensions:${candidate.requestedDimensions}`
            : null,
          candidate.modelEmbeddingDimensions !== undefined
            ? `${candidate.scope}#${candidate.candidateIndex}:modelEmbeddingDimensions:${candidate.modelEmbeddingDimensions}`
            : null,
          candidate.dimensionMismatch !== undefined
            ? `${candidate.scope}#${candidate.candidateIndex}:dimensionMismatch:${candidate.dimensionMismatch}`
            : null,
          ...candidateEmbeddingIndexContractEvidence(candidate),
          ...candidateRerankRuntimeContractEvidence(candidate),
          ...candidateCapabilityLimitCostEvidence(candidate),
          candidate.modelId
            ? `${candidate.scope}#${candidate.candidateIndex}:modelId:${candidate.modelId}`
            : null,
          candidate.preparedModelId
            ? `${candidate.scope}#${candidate.candidateIndex}:preparedModelId:${candidate.preparedModelId}`
            : null,
          candidate.prepareCandidateSnapshotFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:prepareCandidateSnapshotFingerprint:${candidate.prepareCandidateSnapshotFingerprint}`
            : null,
          candidate.preparedRouteOrderFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:preparedRouteOrderFingerprint:${candidate.preparedRouteOrderFingerprint}`
            : null,
          candidate.preparedRouteSnapshotFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:preparedRouteSnapshotFingerprint:${candidate.preparedRouteSnapshotFingerprint}`
            : null,
          candidate.providerCapabilitySnapshotFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:providerCapabilitySnapshotFingerprint:${candidate.providerCapabilitySnapshotFingerprint}`
            : null,
          candidate.providerCostSnapshotFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:providerCostSnapshotFingerprint:${candidate.providerCostSnapshotFingerprint}`
            : null,
          candidate.providerHealthSnapshotFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:providerHealthSnapshotFingerprint:${candidate.providerHealthSnapshotFingerprint}`
            : null,
          candidate.providerLimitSnapshotFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:providerLimitSnapshotFingerprint:${candidate.providerLimitSnapshotFingerprint}`
            : null,
          candidate.taskRouteDimensionSnapshotFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteDimensionSnapshotFingerprint:${candidate.taskRouteDimensionSnapshotFingerprint}`
            : null,
          candidate.taskRouteEmbeddingIndexContractSnapshotFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteEmbeddingIndexContractSnapshotFingerprint:${candidate.taskRouteEmbeddingIndexContractSnapshotFingerprint}`
            : null,
          candidate.taskRouteRerankRuntimeContractSnapshotFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteRerankRuntimeContractSnapshotFingerprint:${candidate.taskRouteRerankRuntimeContractSnapshotFingerprint}`
            : null,
          candidate.taskRouteEffectiveSourceFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteEffectiveSourceFingerprint:${candidate.taskRouteEffectiveSourceFingerprint}`
            : null,
          candidate.taskRouteModelSourceSnapshotFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteModelSourceSnapshotFingerprint:${candidate.taskRouteModelSourceSnapshotFingerprint}`
            : null,
          candidate.policyCandidateSnapshotFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:policyCandidateSnapshotFingerprint:${candidate.policyCandidateSnapshotFingerprint}`
            : null,
          candidate.routeCandidateSnapshotFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:routeCandidateSnapshotFingerprint:${candidate.routeCandidateSnapshotFingerprint}`
            : null,
          candidate.routeTraceSnapshotFingerprint
            ? `${candidate.scope}#${candidate.candidateIndex}:routeTraceSnapshotFingerprint:${candidate.routeTraceSnapshotFingerprint}`
            : null,
          candidate.providerProfileId
            ? `${candidate.scope}#${candidate.candidateIndex}:providerProfileId:${candidate.providerProfileId}`
            : null,
          candidate.providerProfileSource
            ? `${candidate.scope}#${candidate.candidateIndex}:providerProfileSource:${candidate.providerProfileSource}`
            : null,
          candidate.providerProfileConfigPath
            ? `${candidate.scope}#${candidate.candidateIndex}:providerProfileConfigPath:${candidate.providerProfileConfigPath}`
            : null,
          candidate.providerConfiguredModelCount != null
            ? `${candidate.scope}#${candidate.candidateIndex}:providerConfiguredModelCount:${candidate.providerConfiguredModelCount}`
            : null,
          ...(candidate.providerConfiguredModelIds ?? []).map(
            modelId =>
              `${candidate.scope}#${candidate.candidateIndex}:providerConfiguredModel:${modelId}`
          ),
          ...(candidate.candidateModelIds ?? []).map(
            modelId =>
              `${candidate.scope}#${candidate.candidateIndex}:candidateModel:${modelId}`
          ),
          candidate.registryKind
            ? `${candidate.scope}#${candidate.candidateIndex}:registryKind:${candidate.registryKind}`
            : null,
          candidate.registryAvailable !== undefined
            ? `${candidate.scope}#${candidate.candidateIndex}:registryAvailable:${candidate.registryAvailable}`
            : null,
          candidate.registrySelected !== undefined
            ? `${candidate.scope}#${candidate.candidateIndex}:registrySelected:${candidate.registrySelected}`
            : null,
          candidate.routeModelDefinitionSource
            ? `${candidate.scope}#${candidate.candidateIndex}:routeModelDefinitionSource:${candidate.routeModelDefinitionSource}`
            : null,
          candidate.routeModelDefinitionId
            ? `${candidate.scope}#${candidate.candidateIndex}:routeModelDefinitionId:${candidate.routeModelDefinitionId}`
            : null,
          ...(candidate.routeModelDefinitionAliases ?? []).map(
            alias =>
              `${candidate.scope}#${candidate.candidateIndex}:routeModelDefinitionAlias:${alias}`
          ),
          candidate.routeModelAliasMatched !== undefined
            ? `${candidate.scope}#${candidate.candidateIndex}:routeModelAliasMatched:${candidate.routeModelAliasMatched}`
            : null,
          candidate.routeRawModelId
            ? `${candidate.scope}#${candidate.candidateIndex}:routeRawModelId:${candidate.routeRawModelId}`
            : null,
          candidate.privacy
            ? `${candidate.scope}#${candidate.candidateIndex}:privacy:${candidate.privacy}`
            : null,
          candidate.health
            ? `${candidate.scope}#${candidate.candidateIndex}:health:${candidate.health}`
            : null,
          candidate.healthCheckedAt
            ? `${candidate.scope}#${candidate.candidateIndex}:healthCheckedAt:${candidate.healthCheckedAt}`
            : null,
          candidate.errorCode
            ? `${candidate.scope}#${candidate.candidateIndex}:errorCode:${candidate.errorCode}`
            : null,
          candidate.errorCategory
            ? `${candidate.scope}#${candidate.candidateIndex}:errorCategory:${candidate.errorCategory}`
            : null,
        ],
        64
      )
    );
  const fingerprintEvidence = candidateEvidence.flatMap(candidate =>
    compactEvidence(
      [
        `${candidate.scope}#${candidate.candidateIndex}:candidateFingerprint:${candidate.candidateFingerprint}`,
        candidate.prepareCandidateSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:prepareCandidateSnapshotFingerprint:${candidate.prepareCandidateSnapshotFingerprint}`
          : null,
        candidate.preparedRouteOrderFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:preparedRouteOrderFingerprint:${candidate.preparedRouteOrderFingerprint}`
          : null,
        candidate.preparedRouteSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:preparedRouteSnapshotFingerprint:${candidate.preparedRouteSnapshotFingerprint}`
          : null,
        candidate.providerCapabilitySnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:providerCapabilitySnapshotFingerprint:${candidate.providerCapabilitySnapshotFingerprint}`
          : null,
        candidate.providerCostSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:providerCostSnapshotFingerprint:${candidate.providerCostSnapshotFingerprint}`
          : null,
        candidate.providerHealthSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:providerHealthSnapshotFingerprint:${candidate.providerHealthSnapshotFingerprint}`
          : null,
        candidate.providerLimitSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:providerLimitSnapshotFingerprint:${candidate.providerLimitSnapshotFingerprint}`
          : null,
        candidate.taskRouteDimensionSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteDimensionSnapshotFingerprint:${candidate.taskRouteDimensionSnapshotFingerprint}`
          : null,
        candidate.taskRouteEmbeddingIndexContractSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteEmbeddingIndexContractSnapshotFingerprint:${candidate.taskRouteEmbeddingIndexContractSnapshotFingerprint}`
          : null,
        candidate.taskRouteRerankRuntimeContractSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteRerankRuntimeContractSnapshotFingerprint:${candidate.taskRouteRerankRuntimeContractSnapshotFingerprint}`
          : null,
        candidate.taskRouteEffectiveSourceFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteEffectiveSourceFingerprint:${candidate.taskRouteEffectiveSourceFingerprint}`
          : null,
        candidate.taskRouteModelSourceSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteModelSourceSnapshotFingerprint:${candidate.taskRouteModelSourceSnapshotFingerprint}`
          : null,
        candidate.policyCandidateSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:policyCandidateSnapshotFingerprint:${candidate.policyCandidateSnapshotFingerprint}`
          : null,
        candidate.routeCandidateSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:routeCandidateSnapshotFingerprint:${candidate.routeCandidateSnapshotFingerprint}`
          : null,
        candidate.routeTraceSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:routeTraceSnapshotFingerprint:${candidate.routeTraceSnapshotFingerprint}`
          : null,
        candidate.diagnosticsErrorSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:diagnosticsErrorSnapshotFingerprint:${candidate.diagnosticsErrorSnapshotFingerprint}`
          : null,
      ],
      14
    )
  );
  const inventoryEvidence = candidateEvidence.flatMap(candidate =>
    compactEvidence(
      [
        candidate.providerConfiguredModelCount != null
          ? `${candidate.scope}#${candidate.candidateIndex}:providerConfiguredModelCount:${candidate.providerConfiguredModelCount}`
          : null,
        candidate.providerProfileId
          ? `${candidate.scope}#${candidate.candidateIndex}:providerProfileId:${candidate.providerProfileId}`
          : null,
        candidate.providerProfileSource
          ? `${candidate.scope}#${candidate.candidateIndex}:providerProfileSource:${candidate.providerProfileSource}`
          : null,
        candidate.providerProfileConfigPath
          ? `${candidate.scope}#${candidate.candidateIndex}:providerProfileConfigPath:${candidate.providerProfileConfigPath}`
          : null,
        ...(candidate.providerConfiguredModelIds ?? []).map(
          modelId =>
            `${candidate.scope}#${candidate.candidateIndex}:providerConfiguredModel:${modelId}`
        ),
        ...(candidate.candidateModelIds ?? []).map(
          modelId =>
            `${candidate.scope}#${candidate.candidateIndex}:candidateModel:${modelId}`
        ),
      ],
      10
    )
  );
  const summaryEvidence = candidateEvidence.flatMap(candidate =>
    compactEvidence(
      [
        `${candidate.scope}#${candidate.candidateIndex}:providerId:${candidate.providerId}`,
        candidate.allowed !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:allowed:${candidate.allowed}`
          : null,
        candidate.available !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:available:${candidate.available}`
          : null,
        candidate.matched !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:matched:${candidate.matched}`
          : null,
        candidate.prepared !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:prepared:${candidate.prepared}`
          : null,
        candidate.diagnosticsErrorSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:diagnosticsErrorSnapshotFingerprint:${candidate.diagnosticsErrorSnapshotFingerprint}`
          : null,
        candidate.requestedModelId
          ? `${candidate.scope}#${candidate.candidateIndex}:requestedModelId:${candidate.requestedModelId}`
          : null,
        candidate.requestedModelSource
          ? `${candidate.scope}#${candidate.candidateIndex}:requestedModelSource:${candidate.requestedModelSource}`
          : null,
        candidate.requestedModelConfigPath
          ? `${candidate.scope}#${candidate.candidateIndex}:requestedModelConfigPath:${candidate.requestedModelConfigPath}`
          : null,
        candidate.requestedDimensions !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:requestedDimensions:${candidate.requestedDimensions}`
          : null,
        candidate.modelEmbeddingDimensions !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:modelEmbeddingDimensions:${candidate.modelEmbeddingDimensions}`
          : null,
        candidate.dimensionMismatch !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:dimensionMismatch:${candidate.dimensionMismatch}`
          : null,
        ...candidateEmbeddingIndexContractEvidence(candidate),
        ...candidateRerankRuntimeContractEvidence(candidate),
        candidate.modelId
          ? `${candidate.scope}#${candidate.candidateIndex}:modelId:${candidate.modelId}`
          : null,
        candidate.preparedModelId
          ? `${candidate.scope}#${candidate.candidateIndex}:preparedModelId:${candidate.preparedModelId}`
          : null,
        candidate.privacy
          ? `${candidate.scope}#${candidate.candidateIndex}:privacy:${candidate.privacy}`
          : null,
        candidate.health
          ? `${candidate.scope}#${candidate.candidateIndex}:health:${candidate.health}`
          : null,
        candidate.healthCheckedAt
          ? `${candidate.scope}#${candidate.candidateIndex}:healthCheckedAt:${candidate.healthCheckedAt}`
          : null,
        candidate.errorCode
          ? `${candidate.scope}#${candidate.candidateIndex}:errorCode:${candidate.errorCode}`
          : null,
        candidate.errorCategory
          ? `${candidate.scope}#${candidate.candidateIndex}:errorCategory:${candidate.errorCategory}`
          : null,
        candidate.registryKind
          ? `${candidate.scope}#${candidate.candidateIndex}:registryKind:${candidate.registryKind}`
          : null,
        candidate.registryAvailable !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:registryAvailable:${candidate.registryAvailable}`
          : null,
        candidate.registrySelected !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:registrySelected:${candidate.registrySelected}`
          : null,
        candidate.routeModelDefinitionSource
          ? `${candidate.scope}#${candidate.candidateIndex}:routeModelDefinitionSource:${candidate.routeModelDefinitionSource}`
          : null,
        candidate.routeModelDefinitionId
          ? `${candidate.scope}#${candidate.candidateIndex}:routeModelDefinitionId:${candidate.routeModelDefinitionId}`
          : null,
        ...(candidate.routeModelDefinitionAliases ?? []).map(
          alias =>
            `${candidate.scope}#${candidate.candidateIndex}:routeModelDefinitionAlias:${alias}`
        ),
        candidate.routeModelAliasMatched !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:routeModelAliasMatched:${candidate.routeModelAliasMatched}`
          : null,
        candidate.routeRawModelId
          ? `${candidate.scope}#${candidate.candidateIndex}:routeRawModelId:${candidate.routeRawModelId}`
          : null,
        ...candidateCapabilityLimitCostEvidence(candidate),
        candidate.providerProfileId
          ? `${candidate.scope}#${candidate.candidateIndex}:providerProfileId:${candidate.providerProfileId}`
          : null,
        candidate.providerProfileConfigPath
          ? `${candidate.scope}#${candidate.candidateIndex}:providerProfileConfigPath:${candidate.providerProfileConfigPath}`
          : null,
        ...(candidate.providerConfiguredModelIds ?? []).map(
          modelId =>
            `${candidate.scope}#${candidate.candidateIndex}:providerConfiguredModel:${modelId}`
        ),
      ],
      40
    )
  );
  const priorityEvidence = candidateEvidence.flatMap(candidate =>
    compactEvidence(
      [
        `${candidate.scope}#${candidate.candidateIndex}:providerId:${candidate.providerId}`,
        candidate.allowed !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:allowed:${candidate.allowed}`
          : null,
        candidate.available !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:available:${candidate.available}`
          : null,
        candidate.matched !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:matched:${candidate.matched}`
          : null,
        candidate.prepared !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:prepared:${candidate.prepared}`
          : null,
        candidate.diagnosticsErrorSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:diagnosticsErrorSnapshotFingerprint:${candidate.diagnosticsErrorSnapshotFingerprint}`
          : null,
        candidate.requestedModelSource
          ? `${candidate.scope}#${candidate.candidateIndex}:requestedModelSource:${candidate.requestedModelSource}`
          : null,
        candidate.requestedModelConfigPath
          ? `${candidate.scope}#${candidate.candidateIndex}:requestedModelConfigPath:${candidate.requestedModelConfigPath}`
          : null,
        candidate.requestedDimensions !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:requestedDimensions:${candidate.requestedDimensions}`
          : null,
        candidate.modelEmbeddingDimensions !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:modelEmbeddingDimensions:${candidate.modelEmbeddingDimensions}`
          : null,
        candidate.dimensionMismatch !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:dimensionMismatch:${candidate.dimensionMismatch}`
          : null,
        ...candidateEmbeddingIndexContractEvidence(candidate),
        ...candidateRerankRuntimeContractEvidence(candidate),
        candidate.preparedModelId
          ? `${candidate.scope}#${candidate.candidateIndex}:preparedModelId:${candidate.preparedModelId}`
          : null,
        candidate.privacy
          ? `${candidate.scope}#${candidate.candidateIndex}:privacy:${candidate.privacy}`
          : null,
        candidate.health
          ? `${candidate.scope}#${candidate.candidateIndex}:health:${candidate.health}`
          : null,
        candidate.healthCheckedAt
          ? `${candidate.scope}#${candidate.candidateIndex}:healthCheckedAt:${candidate.healthCheckedAt}`
          : null,
        candidate.errorCode
          ? `${candidate.scope}#${candidate.candidateIndex}:errorCode:${candidate.errorCode}`
          : null,
        candidate.errorCategory
          ? `${candidate.scope}#${candidate.candidateIndex}:errorCategory:${candidate.errorCategory}`
          : null,
        candidate.prepareCandidateSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:prepareCandidateSnapshotFingerprint:${candidate.prepareCandidateSnapshotFingerprint}`
          : null,
        candidate.preparedRouteOrderFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:preparedRouteOrderFingerprint:${candidate.preparedRouteOrderFingerprint}`
          : null,
        candidate.preparedRouteSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:preparedRouteSnapshotFingerprint:${candidate.preparedRouteSnapshotFingerprint}`
          : null,
        candidate.providerCapabilitySnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:providerCapabilitySnapshotFingerprint:${candidate.providerCapabilitySnapshotFingerprint}`
          : null,
        candidate.providerCostSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:providerCostSnapshotFingerprint:${candidate.providerCostSnapshotFingerprint}`
          : null,
        candidate.providerHealthSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:providerHealthSnapshotFingerprint:${candidate.providerHealthSnapshotFingerprint}`
          : null,
        candidate.providerLimitSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:providerLimitSnapshotFingerprint:${candidate.providerLimitSnapshotFingerprint}`
          : null,
        candidate.taskRouteDimensionSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteDimensionSnapshotFingerprint:${candidate.taskRouteDimensionSnapshotFingerprint}`
          : null,
        candidate.taskRouteEmbeddingIndexContractSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteEmbeddingIndexContractSnapshotFingerprint:${candidate.taskRouteEmbeddingIndexContractSnapshotFingerprint}`
          : null,
        candidate.taskRouteRerankRuntimeContractSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteRerankRuntimeContractSnapshotFingerprint:${candidate.taskRouteRerankRuntimeContractSnapshotFingerprint}`
          : null,
        candidate.taskRouteEffectiveSourceFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteEffectiveSourceFingerprint:${candidate.taskRouteEffectiveSourceFingerprint}`
          : null,
        candidate.taskRouteModelSourceSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteModelSourceSnapshotFingerprint:${candidate.taskRouteModelSourceSnapshotFingerprint}`
          : null,
        candidate.policyCandidateSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:policyCandidateSnapshotFingerprint:${candidate.policyCandidateSnapshotFingerprint}`
          : null,
        candidate.routeCandidateSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:routeCandidateSnapshotFingerprint:${candidate.routeCandidateSnapshotFingerprint}`
          : null,
        candidate.routeTraceSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:routeTraceSnapshotFingerprint:${candidate.routeTraceSnapshotFingerprint}`
          : null,
        candidate.registryKind
          ? `${candidate.scope}#${candidate.candidateIndex}:registryKind:${candidate.registryKind}`
          : null,
        candidate.registryAvailable !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:registryAvailable:${candidate.registryAvailable}`
          : null,
        candidate.registrySelected !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:registrySelected:${candidate.registrySelected}`
          : null,
        candidate.routeModelDefinitionSource
          ? `${candidate.scope}#${candidate.candidateIndex}:routeModelDefinitionSource:${candidate.routeModelDefinitionSource}`
          : null,
        candidate.routeModelDefinitionId
          ? `${candidate.scope}#${candidate.candidateIndex}:routeModelDefinitionId:${candidate.routeModelDefinitionId}`
          : null,
        ...(candidate.routeModelDefinitionAliases ?? []).map(
          alias =>
            `${candidate.scope}#${candidate.candidateIndex}:routeModelDefinitionAlias:${alias}`
        ),
        candidate.routeModelAliasMatched !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:routeModelAliasMatched:${candidate.routeModelAliasMatched}`
          : null,
        candidate.routeRawModelId
          ? `${candidate.scope}#${candidate.candidateIndex}:routeRawModelId:${candidate.routeRawModelId}`
          : null,
        ...candidateCapabilityLimitCostEvidence(candidate),
        candidate.providerProfileId
          ? `${candidate.scope}#${candidate.candidateIndex}:providerProfileId:${candidate.providerProfileId}`
          : null,
        candidate.providerProfileConfigPath
          ? `${candidate.scope}#${candidate.candidateIndex}:providerProfileConfigPath:${candidate.providerProfileConfigPath}`
          : null,
        ...(candidate.providerConfiguredModelIds ?? []).map(
          modelId =>
            `${candidate.scope}#${candidate.candidateIndex}:providerConfiguredModel:${modelId}`
        ),
      ],
      44
    )
  );
  const detailedEvidence = candidateEvidence.flatMap(candidate =>
    compactEvidence(
      [
        `${candidate.scope}#${candidate.candidateIndex}:candidateFingerprint:${candidate.candidateFingerprint}`,
        candidate.candidateKey
          ? `${candidate.scope}#${candidate.candidateIndex}:candidateKey:${candidate.candidateKey}`
          : null,
        `${candidate.scope}#${candidate.candidateIndex}:providerId:${candidate.providerId}`,
        candidate.allowed !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:allowed:${candidate.allowed}`
          : null,
        candidate.available !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:available:${candidate.available}`
          : null,
        candidate.matched !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:matched:${candidate.matched}`
          : null,
        candidate.prepared !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:prepared:${candidate.prepared}`
          : null,
        candidate.diagnosticsErrorSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:diagnosticsErrorSnapshotFingerprint:${candidate.diagnosticsErrorSnapshotFingerprint}`
          : null,
        ...(candidate.diagnosticsErrors ?? []).flatMap((error, index) => [
          `${candidate.scope}#${candidate.candidateIndex}:diagnosticsError#${index}:stage:${error.stage}`,
          `${candidate.scope}#${candidate.candidateIndex}:diagnosticsError#${index}:code:${error.code}`,
          `${candidate.scope}#${candidate.candidateIndex}:diagnosticsError#${index}:message:${error.message}`,
        ]),
        candidate.requestedModelId
          ? `${candidate.scope}#${candidate.candidateIndex}:requestedModelId:${candidate.requestedModelId}`
          : null,
        candidate.requestedModelSource
          ? `${candidate.scope}#${candidate.candidateIndex}:requestedModelSource:${candidate.requestedModelSource}`
          : null,
        candidate.requestedModelConfigKey
          ? `${candidate.scope}#${candidate.candidateIndex}:requestedModelConfigKey:${candidate.requestedModelConfigKey}`
          : null,
        candidate.requestedModelConfigPath
          ? `${candidate.scope}#${candidate.candidateIndex}:requestedModelConfigPath:${candidate.requestedModelConfigPath}`
          : null,
        candidate.requestedDimensions !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:requestedDimensions:${candidate.requestedDimensions}`
          : null,
        candidate.modelEmbeddingDimensions !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:modelEmbeddingDimensions:${candidate.modelEmbeddingDimensions}`
          : null,
        candidate.dimensionMismatch !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:dimensionMismatch:${candidate.dimensionMismatch}`
          : null,
        ...candidateEmbeddingIndexContractEvidence(candidate),
        ...candidateRerankRuntimeContractEvidence(candidate),
        candidate.modelId
          ? `${candidate.scope}#${candidate.candidateIndex}:modelId:${candidate.modelId}`
          : null,
        candidate.preparedModelId
          ? `${candidate.scope}#${candidate.candidateIndex}:preparedModelId:${candidate.preparedModelId}`
          : null,
        candidate.registryKind
          ? `${candidate.scope}#${candidate.candidateIndex}:registryKind:${candidate.registryKind}`
          : null,
        candidate.registryAvailable !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:registryAvailable:${candidate.registryAvailable}`
          : null,
        candidate.registrySelected !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:registrySelected:${candidate.registrySelected}`
          : null,
        candidate.prepareCandidateSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:prepareCandidateSnapshotFingerprint:${candidate.prepareCandidateSnapshotFingerprint}`
          : null,
        candidate.preparedRouteOrderFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:preparedRouteOrderFingerprint:${candidate.preparedRouteOrderFingerprint}`
          : null,
        candidate.preparedRouteSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:preparedRouteSnapshotFingerprint:${candidate.preparedRouteSnapshotFingerprint}`
          : null,
        candidate.providerCapabilitySnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:providerCapabilitySnapshotFingerprint:${candidate.providerCapabilitySnapshotFingerprint}`
          : null,
        candidate.providerCostSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:providerCostSnapshotFingerprint:${candidate.providerCostSnapshotFingerprint}`
          : null,
        candidate.providerHealthSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:providerHealthSnapshotFingerprint:${candidate.providerHealthSnapshotFingerprint}`
          : null,
        candidate.providerLimitSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:providerLimitSnapshotFingerprint:${candidate.providerLimitSnapshotFingerprint}`
          : null,
        candidate.taskRouteDimensionSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteDimensionSnapshotFingerprint:${candidate.taskRouteDimensionSnapshotFingerprint}`
          : null,
        candidate.taskRouteEmbeddingIndexContractSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteEmbeddingIndexContractSnapshotFingerprint:${candidate.taskRouteEmbeddingIndexContractSnapshotFingerprint}`
          : null,
        candidate.taskRouteRerankRuntimeContractSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteRerankRuntimeContractSnapshotFingerprint:${candidate.taskRouteRerankRuntimeContractSnapshotFingerprint}`
          : null,
        candidate.taskRouteEffectiveSourceFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteEffectiveSourceFingerprint:${candidate.taskRouteEffectiveSourceFingerprint}`
          : null,
        candidate.taskRouteModelSourceSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:taskRouteModelSourceSnapshotFingerprint:${candidate.taskRouteModelSourceSnapshotFingerprint}`
          : null,
        candidate.policyCandidateSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:policyCandidateSnapshotFingerprint:${candidate.policyCandidateSnapshotFingerprint}`
          : null,
        candidate.routeCandidateSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:routeCandidateSnapshotFingerprint:${candidate.routeCandidateSnapshotFingerprint}`
          : null,
        candidate.routeTraceSnapshotFingerprint
          ? `${candidate.scope}#${candidate.candidateIndex}:routeTraceSnapshotFingerprint:${candidate.routeTraceSnapshotFingerprint}`
          : null,
        candidate.routeModelDefinitionSource
          ? `${candidate.scope}#${candidate.candidateIndex}:routeModelDefinitionSource:${candidate.routeModelDefinitionSource}`
          : null,
        candidate.routeModelDefinitionId
          ? `${candidate.scope}#${candidate.candidateIndex}:routeModelDefinitionId:${candidate.routeModelDefinitionId}`
          : null,
        ...(candidate.routeModelDefinitionAliases ?? []).map(
          alias =>
            `${candidate.scope}#${candidate.candidateIndex}:routeModelDefinitionAlias:${alias}`
        ),
        candidate.routeModelAliasMatched !== undefined
          ? `${candidate.scope}#${candidate.candidateIndex}:routeModelAliasMatched:${candidate.routeModelAliasMatched}`
          : null,
        candidate.routeRawModelId
          ? `${candidate.scope}#${candidate.candidateIndex}:routeRawModelId:${candidate.routeRawModelId}`
          : null,
        ...candidateCapabilityLimitCostEvidence(candidate),
        candidate.providerName
          ? `${candidate.scope}#${candidate.candidateIndex}:providerName:${candidate.providerName}`
          : null,
        candidate.providerSource
          ? `${candidate.scope}#${candidate.candidateIndex}:providerSource:${candidate.providerSource}`
          : null,
        candidate.providerType
          ? `${candidate.scope}#${candidate.candidateIndex}:providerType:${candidate.providerType}`
          : null,
        candidate.providerProfileId
          ? `${candidate.scope}#${candidate.candidateIndex}:providerProfileId:${candidate.providerProfileId}`
          : null,
        candidate.providerProfileSource
          ? `${candidate.scope}#${candidate.candidateIndex}:providerProfileSource:${candidate.providerProfileSource}`
          : null,
        candidate.providerProfileConfigPath
          ? `${candidate.scope}#${candidate.candidateIndex}:providerProfileConfigPath:${candidate.providerProfileConfigPath}`
          : null,
        candidate.providerConfiguredModelCount != null
          ? `${candidate.scope}#${candidate.candidateIndex}:providerConfiguredModelCount:${candidate.providerConfiguredModelCount}`
          : null,
        ...(candidate.providerConfiguredModelIds ?? []).map(
          modelId =>
            `${candidate.scope}#${candidate.candidateIndex}:providerConfiguredModel:${modelId}`
        ),
        ...(candidate.candidateModelIds ?? []).map(
          modelId =>
            `${candidate.scope}#${candidate.candidateIndex}:candidateModel:${modelId}`
        ),
        ...candidate.reasons.map(
          reason =>
            `${candidate.scope}#${candidate.candidateIndex}:reason:${reason}`
        ),
      ],
      52
    )
  );

  return uniqueStrings([
    ...primaryRouteEvidence,
    ...primaryEvidence,
    ...fingerprintEvidence,
    ...inventoryEvidence,
    ...summaryEvidence,
    ...priorityEvidence,
    ...detailedEvidence,
  ]);
}

function providerHealthNeedsRepair(health: string | undefined | null) {
  return Boolean(health && health !== 'healthy' && health !== 'unknown');
}

function routeRepairTarget(
  route: Pick<
    CopilotPromptRegistryPublishGateModelRoute,
    | 'candidateConfigPath'
    | 'candidateKind'
    | 'featureKind'
    | 'providerProfileConfigPath'
    | 'requestedModelId'
  >
) {
  return (
    route.candidateConfigPath ??
    route.providerProfileConfigPath ??
    `copilot.providers.route.${route.featureKind}.${route.candidateKind}`
  );
}

function modelRouteRepairInstanceKey(
  route: Pick<
    CopilotPromptRegistryPublishGateModelRoute,
    | 'candidateIndex'
    | 'candidateKind'
    | 'featureKind'
    | 'outputType'
    | 'requestedModelId'
  >
) {
  return [
    route.featureKind,
    route.outputType,
    route.candidateKind,
    route.candidateIndex,
    route.requestedModelId ?? 'unknown',
  ].join(':');
}

function taskRouteRepairTarget(
  route: Pick<
    CopilotPromptRegistryPublishGateTaskRoute,
    'featureKind' | 'requestedModelConfigPath'
  >
) {
  return (
    route.requestedModelConfigPath ??
    `copilot.tasks.models.${route.featureKind}`
  );
}

function taskRouteRepairInstanceKey(
  route: Pick<
    CopilotPromptRegistryPublishGateTaskRoute,
    'featureKind' | 'requestedModelId' | 'requestedModelConfigKey'
  >,
  suffix: string
) {
  return [
    route.featureKind,
    route.requestedModelConfigKey ?? 'task-config',
    route.requestedModelId ?? 'default-route',
    suffix,
  ].join(':');
}

function repairTargetLocatorBase(
  verdict: Pick<
    PromptRegistryPublishGateVerdict,
    'registryFingerprint' | 'registryId' | 'registryUpdatedAt'
  >,
  kind: string,
  path: string
) {
  return {
    kind,
    path,
    registryFingerprint: verdict.registryFingerprint,
    registryId: verdict.registryId,
    registryUpdatedAt: verdict.registryUpdatedAt.toISOString(),
  };
}

function registryRepairTargetLocator(
  verdict: PromptRegistryPublishGateVerdict,
  path: string
): CopilotPromptRegistryPublishGateRepairTargetLocator {
  return repairTargetLocatorBase(verdict, 'prompt_registry', path);
}

function modelRouteRepairTargetLocator(
  verdict: PromptRegistryPublishGateVerdict,
  route: CopilotPromptRegistryPublishGateModelRoute,
  target: string
): CopilotPromptRegistryPublishGateRepairTargetLocator {
  return {
    ...repairTargetLocatorBase(verdict, 'model_route', target),
    candidateIndex: route.candidateIndex,
    candidateKind: route.candidateKind,
    featureKind: route.featureKind,
    outputType: route.outputType,
    ...(route.providerId ? { providerId: route.providerId } : {}),
    ...(route.providerProfileConfigPath
      ? { providerProfileConfigPath: route.providerProfileConfigPath }
      : {}),
    ...(route.providerProfileId
      ? { providerProfileId: route.providerProfileId }
      : {}),
    ...(route.providerProfileSource
      ? { providerProfileSource: route.providerProfileSource }
      : {}),
    ...(route.requestedModelId
      ? { requestedModelId: route.requestedModelId }
      : {}),
    ...(route.requestedModelSource
      ? { requestedModelSource: route.requestedModelSource }
      : {}),
  };
}

function taskRouteRepairTargetLocator(
  verdict: PromptRegistryPublishGateVerdict,
  route: CopilotPromptRegistryPublishGateTaskRoute,
  target: string
): CopilotPromptRegistryPublishGateRepairTargetLocator {
  return {
    ...repairTargetLocatorBase(verdict, 'task_route', target),
    featureKind: route.featureKind,
    ...(route.providerId ? { providerId: route.providerId } : {}),
    ...(route.providerProfileConfigPath
      ? { providerProfileConfigPath: route.providerProfileConfigPath }
      : {}),
    ...(route.providerProfileId
      ? { providerProfileId: route.providerProfileId }
      : {}),
    ...(route.providerProfileSource
      ? { providerProfileSource: route.providerProfileSource }
      : {}),
    ...(route.requestedModelConfigKey
      ? { requestedModelConfigKey: route.requestedModelConfigKey }
      : {}),
    ...(route.requestedModelConfigPath
      ? { requestedModelConfigPath: route.requestedModelConfigPath }
      : {}),
    ...(route.requestedModelId
      ? { requestedModelId: route.requestedModelId }
      : {}),
    ...(route.requestedModelSource
      ? { requestedModelSource: route.requestedModelSource }
      : {}),
  };
}

function actionRouteRepairTargetLocator(
  verdict: PromptRegistryPublishGateVerdict,
  dryRun: CopilotPromptRegistryPublishGateActionRouteDryRun,
  target: string,
  input?: {
    route?: CopilotPromptRegistryPublishGateActionRouteDryRunRoute;
    step?: CopilotPromptRegistryPublishGateActionRouteDryRunStep;
  }
): CopilotPromptRegistryPublishGateRepairTargetLocator {
  const route = input?.route;
  const step = input?.step;
  return {
    ...repairTargetLocatorBase(verdict, 'action_route', target),
    ...(dryRun.actionId ? { actionId: dryRun.actionId } : {}),
    featureKind: dryRun.featureKind,
    status: dryRun.status,
    ...(step?.stepId ? { stepId: step.stepId } : {}),
    ...(step?.requestedModelId
      ? { requestedModelId: step.requestedModelId }
      : {}),
    ...(step?.requestedModelSource
      ? { requestedModelSource: step.requestedModelSource }
      : {}),
    ...(route?.providerId ? { providerId: route.providerId } : {}),
    ...(route?.providerProfileConfigPath
      ? { providerProfileConfigPath: route.providerProfileConfigPath }
      : {}),
    ...(route?.providerProfileId
      ? { providerProfileId: route.providerProfileId }
      : {}),
    ...(route?.providerProfileSource
      ? { providerProfileSource: route.providerProfileSource }
      : {}),
    ...(route?.routeIndex != null ? { routeIndex: route.routeIndex } : {}),
    ...(route?.fallbackOrderIndex != null
      ? { fallbackOrderIndex: route.fallbackOrderIndex }
      : {}),
  };
}

function actionDryRunRepairTarget(
  dryRun: CopilotPromptRegistryPublishGateActionRouteDryRun
) {
  return dryRun.actionId
    ? `ai_prompts_metadata.action.${dryRun.actionId}`
    : `ai_prompts_metadata.${dryRun.featureKind}`;
}

function actionDryRunRepairInstancePrefix(
  dryRun: CopilotPromptRegistryPublishGateActionRouteDryRun
) {
  return dryRun.actionId ?? dryRun.featureKind;
}

function promptRegistryRepairActionSafety(suggestedActionKind: string) {
  if (
    suggestedActionKind === 'check_provider_health' ||
    suggestedActionKind === 'check_action_provider_health' ||
    suggestedActionKind === 'inspect_task_route_diagnostics'
  ) {
    return 'read_only_probe';
  }
  if (suggestedActionKind === 'refresh_publish_gate') {
    return 'read_only_refresh';
  }
  if (
    suggestedActionKind === 'fix_embedding_dimensions' ||
    suggestedActionKind === 'relax_provider_route_policy' ||
    suggestedActionKind === 'relax_task_route_policy'
  ) {
    return 'manual_review_required';
  }
  if (suggestedActionKind === 'review_action_route_dry_run') {
    return 'dry_run_required';
  }
  return 'preview_required';
}

function promptRegistryRepairSafetyReviewMode(safety: string) {
  if (safety === 'read_only_probe') {
    return 'probe';
  }
  if (safety === 'read_only_refresh') {
    return 'refresh';
  }
  if (safety === 'dry_run_required') {
    return 'dry_run';
  }
  if (safety === 'manual_review_required') {
    return 'manual_review';
  }
  return 'preview';
}

function promptRegistryRepairPreviewStatus(safety: string) {
  if (safety === 'read_only_probe') {
    return 'read_only_probe';
  }
  if (safety === 'read_only_refresh') {
    return 'read_only_refresh';
  }
  if (safety === 'dry_run_required') {
    return 'dry_run_required';
  }
  if (safety === 'manual_review_required') {
    return 'manual_review_required';
  }
  return 'preview_required';
}

function promptRegistryRepairPreviewSummaryStatus(
  operations: CopilotPromptRegistryPublishGateRepairActionPreviewOperation[]
) {
  const statuses = new Set(
    operations.map(operation => operation.previewStatus)
  );
  if (!statuses.size) {
    return 'ready';
  }
  if (statuses.has('manual_review_required')) {
    return 'manual_review_required';
  }
  if (statuses.has('dry_run_required')) {
    return 'dry_run_required';
  }
  if (statuses.has('preview_required')) {
    return 'preview_required';
  }
  if (statuses.has('read_only_refresh')) {
    return 'read_only_refresh';
  }
  return 'read_only_probe';
}

function promptRegistryRepairActionRequiredCapabilities(
  suggestedActionKind: string
) {
  if (suggestedActionKind === 'refresh_publish_gate') {
    return ['publish_gate.read'];
  }
  if (suggestedActionKind.startsWith('registry_')) {
    return ['prompt_registry.read', 'prompt_registry.preview_write'];
  }
  if (
    suggestedActionKind === 'repair_default_model_route' ||
    suggestedActionKind === 'review_non_default_model_route'
  ) {
    return ['model_registry.read', 'provider_route.preview'];
  }
  if (
    suggestedActionKind === 'relax_provider_route_policy' ||
    suggestedActionKind === 'relax_task_route_policy'
  ) {
    return ['provider_route_policy.read', 'provider_route_policy.preview'];
  }
  if (
    suggestedActionKind === 'check_provider_health' ||
    suggestedActionKind === 'check_action_provider_health'
  ) {
    return ['provider_profile.read', 'provider_health.probe'];
  }
  if (suggestedActionKind === 'inspect_task_route_diagnostics') {
    return ['task_route.read', 'provider_diagnostics.read'];
  }
  if (suggestedActionKind === 'repair_task_model_route') {
    return ['task_route.read', 'model_registry.read', 'provider_route.preview'];
  }
  if (suggestedActionKind === 'fix_embedding_dimensions') {
    return [
      'task_route.read',
      'embedding_index.read',
      'embedding_index.migration_review',
    ];
  }
  if (suggestedActionKind === 'review_action_route_dry_run') {
    return ['action_route.read', 'action_route.dry_run'];
  }
  if (suggestedActionKind === 'repair_action_fallback_route_coverage') {
    return ['action_route.read', 'provider_route.preview'];
  }
  return ['repair_action.review'];
}

function promptRegistryRepairActionInputSchema(suggestedActionKind: string) {
  const baseProperties: Record<string, unknown> = {
    diagnosticsFingerprint: {
      description:
        'Expected repair recommendation diagnostics fingerprint returned by the publish gate.',
      type: 'string',
    },
    expectedRegistryFingerprint: {
      description:
        'Expected Prompt Registry fingerprint returned by the publish gate.',
      type: 'string',
    },
    expectedRegistryId: {
      description:
        'Expected Prompt Registry row id returned by the publish gate.',
      type: 'integer',
    },
    expectedRegistryUpdatedAt: {
      description:
        'Expected Prompt Registry updated timestamp returned by the publish gate.',
      type: 'string',
    },
    targetLocator: {
      additionalProperties: true,
      description: 'Opaque repair target locator returned by the publish gate.',
      type: 'object',
    },
  };
  const baseRequired = ['diagnosticsFingerprint', 'targetLocator'];
  const withProperties = (
    properties: Record<string, unknown>,
    required: string[] = []
  ) => ({
    additionalProperties: false,
    properties: {
      ...baseProperties,
      ...properties,
    },
    required: [...baseRequired, ...required],
    type: 'object',
  });

  if (
    suggestedActionKind === 'check_provider_health' ||
    suggestedActionKind === 'check_action_provider_health'
  ) {
    return withProperties({
      probeOnly: {
        const: true,
        description: 'Provider health checks are read-only probes.',
      },
    });
  }
  if (suggestedActionKind === 'refresh_publish_gate') {
    return withProperties({
      refreshOnly: {
        const: true,
        description:
          'Refreshes publish gate diagnostics without applying changes.',
      },
    });
  }
  if (suggestedActionKind === 'review_action_route_dry_run') {
    return withProperties({
      dryRunOnly: {
        const: true,
        description: 'Runs action route diagnostics without applying changes.',
      },
    });
  }
  if (suggestedActionKind === 'fix_embedding_dimensions') {
    return withProperties({
      migrationPlanRequired: {
        const: true,
        description:
          'Embedding dimension repairs require an explicit index migration plan.',
      },
    });
  }
  return withProperties({
    previewOnly: {
      const: true,
      description:
        'Repair actions must produce a preview diff before any write is allowed.',
    },
  });
}

function stableRepairRecommendationStringify(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableRepairRecommendationStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => {
        const item = (value as Record<string, unknown>)[key];
        return item === undefined
          ? null
          : `${JSON.stringify(key)}:${stableRepairRecommendationStringify(item)}`;
      })
      .filter(Boolean)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaFingerprint() {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        candidateEvidenceReferenceSchemaFields: [
          ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_FIELDS,
        ],
        candidateEvidenceReferenceSchemaVersion:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_VERSION,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactFingerprint(
  schemaFingerprint: string
) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        artifactStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_STATUS,
        registryStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_REGISTRY_STATUS,
        schemaFingerprint,
        schemaVersion:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_VERSION,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordFingerprint(input: {
  artifactFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        artifactFingerprint: input.artifactFingerprint,
        artifactStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_STATUS,
        recordStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STATUS,
        schemaFingerprint: input.schemaFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprint(input: {
  recordFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        persistenceStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_PERSISTENCE_STATUS,
        recordFingerprint: input.recordFingerprint,
        recordStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STATUS,
        schemaFingerprint: input.schemaFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageFingerprint(input: {
  recordFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        recordFingerprint: input.recordFingerprint,
        recordStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STATUS,
        schemaFingerprint: input.schemaFingerprint,
        storageStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_STATUS,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprint(input: {
  schemaFingerprint: string;
  storageFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        backendStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_BACKEND_STATUS,
        schemaFingerprint: input.schemaFingerprint,
        storageFingerprint: input.storageFingerprint,
        storageStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_STATUS,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprint(input: {
  backendFingerprint: string;
  schemaFingerprint: string;
  storageFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        backendFingerprint: input.backendFingerprint,
        objectStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_STATUS,
        schemaFingerprint: input.schemaFingerprint,
        storageFingerprint: input.storageFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprint(input: {
  objectFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        archiveInclusionStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_STATUS,
        objectFingerprint: input.objectFingerprint,
        objectStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_STATUS,
        schemaFingerprint: input.schemaFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprint(input: {
  archiveInclusionFingerprint: string;
  objectFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        archiveInclusionFingerprint: input.archiveInclusionFingerprint,
        manifestEntryStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_STATUS,
        objectFingerprint: input.objectFingerprint,
        schemaFingerprint: input.schemaFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprint(input: {
  manifestEntryFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        manifestEntryFingerprint: input.manifestEntryFingerprint,
        manifestEntryPersistenceStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_STATUS,
        manifestEntryStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_STATUS,
        schemaFingerprint: input.schemaFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint(input: {
  manifestEntryPersistenceFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        manifestEntryPersistenceFingerprint:
          input.manifestEntryPersistenceFingerprint,
        manifestEntryPersistenceRecordStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STATUS,
        manifestEntryPersistenceStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_STATUS,
        schemaFingerprint: input.schemaFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint(input: {
  persistenceRecordFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        persistenceRecordFingerprint: input.persistenceRecordFingerprint,
        persistenceRecordStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STATUS,
        schemaFingerprint: input.schemaFingerprint,
        storageStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_STATUS,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint(input: {
  schemaFingerprint: string;
  storageFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        backendStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_BACKEND_STATUS,
        schemaFingerprint: input.schemaFingerprint,
        storageFingerprint: input.storageFingerprint,
        storageStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_STATUS,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint(input: {
  backendFingerprint: string;
  schemaFingerprint: string;
  storageFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        backendFingerprint: input.backendFingerprint,
        objectStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_STATUS,
        schemaFingerprint: input.schemaFingerprint,
        storageFingerprint: input.storageFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint(input: {
  objectFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        archiveInclusionStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_STATUS,
        objectFingerprint: input.objectFingerprint,
        objectStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_STATUS,
        schemaFingerprint: input.schemaFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint(input: {
  archiveInclusionFingerprint: string;
  objectFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        archiveInclusionFingerprint: input.archiveInclusionFingerprint,
        manifestEntryStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_STATUS,
        objectFingerprint: input.objectFingerprint,
        schemaFingerprint: input.schemaFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint(input: {
  manifestEntryFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        manifestEntryFingerprint: input.manifestEntryFingerprint,
        manifestEntryPersistenceStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_STATUS,
        manifestEntryStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_STATUS,
        schemaFingerprint: input.schemaFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint(input: {
  manifestEntryPersistenceFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        manifestEntryPersistenceFingerprint:
          input.manifestEntryPersistenceFingerprint,
        manifestEntryPersistenceRecordStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STATUS,
        manifestEntryPersistenceStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_STATUS,
        schemaFingerprint: input.schemaFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint(input: {
  persistenceRecordFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        persistenceRecordFingerprint: input.persistenceRecordFingerprint,
        persistenceRecordStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STATUS,
        schemaFingerprint: input.schemaFingerprint,
        storageStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_STATUS,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint(input: {
  schemaFingerprint: string;
  storageFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        backendStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_BACKEND_STATUS,
        schemaFingerprint: input.schemaFingerprint,
        storageFingerprint: input.storageFingerprint,
        storageStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_STATUS,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint(input: {
  backendFingerprint: string;
  schemaFingerprint: string;
  storageFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        backendFingerprint: input.backendFingerprint,
        objectStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_STATUS,
        schemaFingerprint: input.schemaFingerprint,
        storageFingerprint: input.storageFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint(input: {
  objectFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        archiveInclusionStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_STATUS,
        objectFingerprint: input.objectFingerprint,
        objectStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_STATUS,
        schemaFingerprint: input.schemaFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint(input: {
  archiveInclusionFingerprint: string;
  objectFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        archiveInclusionFingerprint: input.archiveInclusionFingerprint,
        manifestEntryStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_STATUS,
        objectFingerprint: input.objectFingerprint,
        schemaFingerprint: input.schemaFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint(input: {
  manifestEntryFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        manifestEntryFingerprint: input.manifestEntryFingerprint,
        manifestEntryPersistenceStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_STATUS,
        manifestEntryStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_STATUS,
        schemaFingerprint: input.schemaFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint(input: {
  manifestEntryPersistenceFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        manifestEntryPersistenceFingerprint:
          input.manifestEntryPersistenceFingerprint,
        manifestEntryPersistenceRecordStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STATUS,
        manifestEntryPersistenceStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_STATUS,
        schemaFingerprint: input.schemaFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint(input: {
  persistenceRecordFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        persistenceRecordFingerprint: input.persistenceRecordFingerprint,
        persistenceRecordStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STATUS,
        schemaFingerprint: input.schemaFingerprint,
        storageStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_STATUS,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint(input: {
  schemaFingerprint: string;
  storageFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        backendStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_BACKEND_STATUS,
        schemaFingerprint: input.schemaFingerprint,
        storageFingerprint: input.storageFingerprint,
        storageStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_STATUS,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint(input: {
  backendFingerprint: string;
  schemaFingerprint: string;
  storageFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        backendFingerprint: input.backendFingerprint,
        objectStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_STATUS,
        schemaFingerprint: input.schemaFingerprint,
        storageFingerprint: input.storageFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint(input: {
  objectFingerprint: string;
  schemaFingerprint: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        archiveInclusionStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_STATUS,
        objectFingerprint: input.objectFingerprint,
        objectStatus:
          COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_STATUS,
        schemaFingerprint: input.schemaFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function taskRouteRepairCandidateEvidenceFingerprint(
  evidence: Omit<
    CopilotPromptRegistryPublishGateRepairCandidateEvidence,
    'candidateFingerprint'
  >
) {
  return createHash('sha256')
    .update(stableRepairRecommendationStringify(evidence))
    .digest('hex')
    .slice(0, 16);
}

function taskRoutePrepareCandidateSnapshot(
  candidates: CopilotTaskRoutePrepareCandidateDiagnosticsType[] | undefined
) {
  return (candidates ?? []).map(candidate => ({
    ...(definedArray(candidate.candidateModelIds) !== undefined
      ? { candidateModelIds: definedArray(candidate.candidateModelIds) }
      : {}),
    ...(candidate.costInputPer1M !== undefined
      ? { costInputPer1M: candidate.costInputPer1M }
      : {}),
    ...(candidate.costOutputPer1M !== undefined
      ? { costOutputPer1M: candidate.costOutputPer1M }
      : {}),
    ...(candidate.routeContextWindow !== undefined
      ? { routeContextWindow: candidate.routeContextWindow }
      : {}),
    ...(candidate.routeMaxOutputTokens !== undefined
      ? { routeMaxOutputTokens: candidate.routeMaxOutputTokens }
      : {}),
    ...(candidate.routeEmbeddingDimensions !== undefined
      ? { routeEmbeddingDimensions: candidate.routeEmbeddingDimensions }
      : {}),
    ...(definedArray(candidate.routeInputTypes) !== undefined
      ? { routeInputTypes: definedArray(candidate.routeInputTypes) }
      : {}),
    ...(definedArray(candidate.routeOutputTypes) !== undefined
      ? { routeOutputTypes: definedArray(candidate.routeOutputTypes) }
      : {}),
    ...(definedArray(candidate.routeAttachmentKinds) !== undefined
      ? { routeAttachmentKinds: definedArray(candidate.routeAttachmentKinds) }
      : {}),
    ...(definedArray(candidate.routeAttachmentSourceKinds) !== undefined
      ? {
          routeAttachmentSourceKinds: definedArray(
            candidate.routeAttachmentSourceKinds
          ),
        }
      : {}),
    ...(candidate.routeAttachmentAllowRemoteUrls !== undefined
      ? {
          routeAttachmentAllowRemoteUrls:
            candidate.routeAttachmentAllowRemoteUrls,
        }
      : {}),
    ...(definedArray(candidate.routeStructuredAttachmentKinds) !== undefined
      ? {
          routeStructuredAttachmentKinds: definedArray(
            candidate.routeStructuredAttachmentKinds
          ),
        }
      : {}),
    ...(definedArray(candidate.routeStructuredAttachmentSourceKinds) !==
    undefined
      ? {
          routeStructuredAttachmentSourceKinds: definedArray(
            candidate.routeStructuredAttachmentSourceKinds
          ),
        }
      : {}),
    ...(candidate.routeStructuredAttachmentAllowRemoteUrls !== undefined
      ? {
          routeStructuredAttachmentAllowRemoteUrls:
            candidate.routeStructuredAttachmentAllowRemoteUrls,
        }
      : {}),
    ...(candidate.errorCategory
      ? { errorCategory: candidate.errorCategory }
      : {}),
    ...(candidate.errorCode ? { errorCode: candidate.errorCode } : {}),
    ...(candidate.health ? { health: candidate.health } : {}),
    ...(candidate.healthCheckedAt
      ? { healthCheckedAt: candidate.healthCheckedAt }
      : {}),
    ...(candidate.modelId ? { modelId: candidate.modelId } : {}),
    prepared: candidate.prepared,
    ...(candidate.preparedModelId
      ? { preparedModelId: candidate.preparedModelId }
      : {}),
    ...(candidate.privacy ? { privacy: candidate.privacy } : {}),
    ...(candidate.providerConfiguredModelCount !== undefined
      ? { providerConfiguredModelCount: candidate.providerConfiguredModelCount }
      : {}),
    ...(definedArray(candidate.providerConfiguredModelIds) !== undefined
      ? {
          providerConfiguredModelIds: definedArray(
            candidate.providerConfiguredModelIds
          ),
        }
      : {}),
    providerId: candidate.providerId,
    ...(candidate.providerName ? { providerName: candidate.providerName } : {}),
    ...(candidate.providerPriority !== undefined
      ? { providerPriority: candidate.providerPriority }
      : {}),
    ...(candidate.providerProfileConfigPath
      ? { providerProfileConfigPath: candidate.providerProfileConfigPath }
      : {}),
    ...(candidate.providerProfileId
      ? { providerProfileId: candidate.providerProfileId }
      : {}),
    ...(candidate.providerProfileSource
      ? { providerProfileSource: candidate.providerProfileSource }
      : {}),
    ...(candidate.providerSource
      ? { providerSource: candidate.providerSource }
      : {}),
    ...(candidate.providerType ? { providerType: candidate.providerType } : {}),
    reasons: candidate.reasons,
    ...(candidate.registryAvailable !== undefined
      ? { registryAvailable: candidate.registryAvailable }
      : {}),
    ...(candidate.registryKind ? { registryKind: candidate.registryKind } : {}),
    ...(candidate.registrySelected !== undefined
      ? { registrySelected: candidate.registrySelected }
      : {}),
    ...(candidate.requestedModelId
      ? { requestedModelId: candidate.requestedModelId }
      : {}),
    ...(candidate.routeModelAliasMatched !== undefined
      ? { routeModelAliasMatched: candidate.routeModelAliasMatched }
      : {}),
    ...(definedArray(candidate.routeModelDefinitionAliases) !== undefined
      ? {
          routeModelDefinitionAliases: definedArray(
            candidate.routeModelDefinitionAliases
          ),
        }
      : {}),
    ...(candidate.routeModelDefinitionId
      ? { routeModelDefinitionId: candidate.routeModelDefinitionId }
      : {}),
    ...(candidate.routeModelDefinitionSource
      ? { routeModelDefinitionSource: candidate.routeModelDefinitionSource }
      : {}),
    ...(candidate.routeRawModelId
      ? { routeRawModelId: candidate.routeRawModelId }
      : {}),
  }));
}

function taskRouteProviderCapabilitySnapshot(
  route: CopilotPromptRegistryPublishGateTaskRoute
) {
  const capabilityCandidate = (
    scope: string,
    candidate: {
      modelId?: string;
      preparedModelId?: string;
      providerId: string;
      providerProfileConfigPath?: string;
      providerProfileId?: string;
      providerProfileSource?: string;
      providerSource?: string;
      providerType?: string;
      requestedModelId?: string;
      routeInputTypes?: string[];
      routeModelDefinitionId?: string;
      routeModelDefinitionSource?: string;
      routeOutputTypes?: string[];
      routeAttachmentKinds?: string[];
      routeAttachmentSourceKinds?: string[];
      routeAttachmentAllowRemoteUrls?: boolean;
      routeStructuredAttachmentKinds?: string[];
      routeStructuredAttachmentSourceKinds?: string[];
      routeStructuredAttachmentAllowRemoteUrls?: boolean;
      routeRawModelId?: string;
    },
    index: number
  ) => ({
    candidateIndex: index,
    ...(candidate.modelId ? { modelId: candidate.modelId } : {}),
    ...(candidate.preparedModelId
      ? { preparedModelId: candidate.preparedModelId }
      : {}),
    providerId: candidate.providerId,
    ...(candidate.providerProfileConfigPath
      ? { providerProfileConfigPath: candidate.providerProfileConfigPath }
      : {}),
    ...(candidate.providerProfileId
      ? { providerProfileId: candidate.providerProfileId }
      : {}),
    ...(candidate.providerProfileSource
      ? { providerProfileSource: candidate.providerProfileSource }
      : {}),
    ...(candidate.providerSource
      ? { providerSource: candidate.providerSource }
      : {}),
    ...(candidate.providerType ? { providerType: candidate.providerType } : {}),
    ...(candidate.requestedModelId
      ? { requestedModelId: candidate.requestedModelId }
      : {}),
    ...(definedArray(candidate.routeInputTypes) !== undefined
      ? { routeInputTypes: definedArray(candidate.routeInputTypes) }
      : {}),
    ...(candidate.routeModelDefinitionId
      ? { routeModelDefinitionId: candidate.routeModelDefinitionId }
      : {}),
    ...(candidate.routeModelDefinitionSource
      ? { routeModelDefinitionSource: candidate.routeModelDefinitionSource }
      : {}),
    ...(definedArray(candidate.routeOutputTypes) !== undefined
      ? { routeOutputTypes: definedArray(candidate.routeOutputTypes) }
      : {}),
    ...(definedArray(candidate.routeAttachmentKinds) !== undefined
      ? { routeAttachmentKinds: definedArray(candidate.routeAttachmentKinds) }
      : {}),
    ...(definedArray(candidate.routeAttachmentSourceKinds) !== undefined
      ? {
          routeAttachmentSourceKinds: definedArray(
            candidate.routeAttachmentSourceKinds
          ),
        }
      : {}),
    ...(candidate.routeAttachmentAllowRemoteUrls !== undefined
      ? {
          routeAttachmentAllowRemoteUrls:
            candidate.routeAttachmentAllowRemoteUrls,
        }
      : {}),
    ...(definedArray(candidate.routeStructuredAttachmentKinds) !== undefined
      ? {
          routeStructuredAttachmentKinds: definedArray(
            candidate.routeStructuredAttachmentKinds
          ),
        }
      : {}),
    ...(definedArray(candidate.routeStructuredAttachmentSourceKinds) !==
    undefined
      ? {
          routeStructuredAttachmentSourceKinds: definedArray(
            candidate.routeStructuredAttachmentSourceKinds
          ),
        }
      : {}),
    ...(candidate.routeStructuredAttachmentAllowRemoteUrls !== undefined
      ? {
          routeStructuredAttachmentAllowRemoteUrls:
            candidate.routeStructuredAttachmentAllowRemoteUrls,
        }
      : {}),
    ...(candidate.routeRawModelId
      ? { routeRawModelId: candidate.routeRawModelId }
      : {}),
    scope,
  });

  return [
    ...route.routeCandidates.map((candidate, index) =>
      capabilityCandidate('routeCandidate', candidate, index)
    ),
    ...(route.prepareCandidates ?? []).map((candidate, index) =>
      capabilityCandidate('prepareCandidate', candidate, index)
    ),
  ];
}

function taskRouteProviderCostSnapshot(
  route: CopilotPromptRegistryPublishGateTaskRoute
) {
  const costCandidate = (
    scope: string,
    candidate: {
      costInputPer1M?: number;
      costOutputPer1M?: number;
      modelId?: string;
      preparedModelId?: string;
      providerId: string;
      providerProfileConfigPath?: string;
      providerProfileId?: string;
      providerProfileSource?: string;
      providerSource?: string;
      providerType?: string;
      requestedModelId?: string;
      routeModelDefinitionId?: string;
      routeModelDefinitionSource?: string;
      routeRawModelId?: string;
    },
    index: number
  ) => ({
    candidateIndex: index,
    ...(candidate.costInputPer1M !== undefined
      ? { costInputPer1M: candidate.costInputPer1M }
      : {}),
    ...(candidate.costOutputPer1M !== undefined
      ? { costOutputPer1M: candidate.costOutputPer1M }
      : {}),
    ...(candidate.modelId ? { modelId: candidate.modelId } : {}),
    ...(candidate.preparedModelId
      ? { preparedModelId: candidate.preparedModelId }
      : {}),
    providerId: candidate.providerId,
    ...(candidate.providerProfileConfigPath
      ? { providerProfileConfigPath: candidate.providerProfileConfigPath }
      : {}),
    ...(candidate.providerProfileId
      ? { providerProfileId: candidate.providerProfileId }
      : {}),
    ...(candidate.providerProfileSource
      ? { providerProfileSource: candidate.providerProfileSource }
      : {}),
    ...(candidate.providerSource
      ? { providerSource: candidate.providerSource }
      : {}),
    ...(candidate.providerType ? { providerType: candidate.providerType } : {}),
    ...(candidate.requestedModelId
      ? { requestedModelId: candidate.requestedModelId }
      : {}),
    ...(candidate.routeModelDefinitionId
      ? { routeModelDefinitionId: candidate.routeModelDefinitionId }
      : {}),
    ...(candidate.routeModelDefinitionSource
      ? { routeModelDefinitionSource: candidate.routeModelDefinitionSource }
      : {}),
    ...(candidate.routeRawModelId
      ? { routeRawModelId: candidate.routeRawModelId }
      : {}),
    scope,
  });

  return [
    ...route.routeCandidates.map((candidate, index) =>
      costCandidate('routeCandidate', candidate, index)
    ),
    ...(route.prepareCandidates ?? []).map((candidate, index) =>
      costCandidate('prepareCandidate', candidate, index)
    ),
  ];
}

function taskRouteProviderLimitSnapshot(
  route: CopilotPromptRegistryPublishGateTaskRoute
) {
  const limitCandidate = (
    scope: string,
    candidate: {
      modelId?: string;
      preparedModelId?: string;
      providerId: string;
      providerProfileConfigPath?: string;
      providerProfileId?: string;
      providerProfileSource?: string;
      providerSource?: string;
      providerType?: string;
      requestedModelId?: string;
      routeContextWindow?: number;
      routeEmbeddingDimensions?: number;
      routeMaxOutputTokens?: number;
      routeModelDefinitionId?: string;
      routeModelDefinitionSource?: string;
      routeRawModelId?: string;
    },
    index: number
  ) => ({
    candidateIndex: index,
    ...(candidate.modelId ? { modelId: candidate.modelId } : {}),
    ...(candidate.preparedModelId
      ? { preparedModelId: candidate.preparedModelId }
      : {}),
    providerId: candidate.providerId,
    ...(candidate.providerProfileConfigPath
      ? { providerProfileConfigPath: candidate.providerProfileConfigPath }
      : {}),
    ...(candidate.providerProfileId
      ? { providerProfileId: candidate.providerProfileId }
      : {}),
    ...(candidate.providerProfileSource
      ? { providerProfileSource: candidate.providerProfileSource }
      : {}),
    ...(candidate.providerSource
      ? { providerSource: candidate.providerSource }
      : {}),
    ...(candidate.providerType ? { providerType: candidate.providerType } : {}),
    ...(candidate.requestedModelId
      ? { requestedModelId: candidate.requestedModelId }
      : {}),
    ...(candidate.routeContextWindow !== undefined
      ? { routeContextWindow: candidate.routeContextWindow }
      : {}),
    ...(candidate.routeEmbeddingDimensions !== undefined
      ? { routeEmbeddingDimensions: candidate.routeEmbeddingDimensions }
      : {}),
    ...(candidate.routeMaxOutputTokens !== undefined
      ? { routeMaxOutputTokens: candidate.routeMaxOutputTokens }
      : {}),
    ...(candidate.routeModelDefinitionId
      ? { routeModelDefinitionId: candidate.routeModelDefinitionId }
      : {}),
    ...(candidate.routeModelDefinitionSource
      ? { routeModelDefinitionSource: candidate.routeModelDefinitionSource }
      : {}),
    ...(candidate.routeRawModelId
      ? { routeRawModelId: candidate.routeRawModelId }
      : {}),
    scope,
  });

  return [
    ...route.routeCandidates.map((candidate, index) =>
      limitCandidate('routeCandidate', candidate, index)
    ),
    ...(route.prepareCandidates ?? []).map((candidate, index) =>
      limitCandidate('prepareCandidate', candidate, index)
    ),
  ];
}

function taskRoutePreparedRouteSnapshot(
  routes: CopilotPreparedTaskRouteDiagnosticsType[] | undefined
) {
  return (routes ?? []).map(route => ({
    ...(definedArray(route.behaviorFlags) !== undefined
      ? { behaviorFlags: definedArray(route.behaviorFlags) }
      : {}),
    ...(route.canonicalModelKey
      ? { canonicalModelKey: route.canonicalModelKey }
      : {}),
    ...(route.dimensionMismatch !== undefined
      ? { dimensionMismatch: route.dimensionMismatch }
      : {}),
    ...(route.fallbackOrderIndex !== undefined
      ? { fallbackOrderIndex: route.fallbackOrderIndex }
      : {}),
    ...(route.modelBackendKind
      ? { modelBackendKind: route.modelBackendKind }
      : {}),
    ...(route.modelEmbeddingDimensions !== undefined
      ? { modelEmbeddingDimensions: route.modelEmbeddingDimensions }
      : {}),
    modelId: route.modelId,
    ...(route.protocol ? { protocol: route.protocol } : {}),
    ...(route.providerConfiguredModelCount !== undefined
      ? { providerConfiguredModelCount: route.providerConfiguredModelCount }
      : {}),
    ...(definedArray(route.providerConfiguredModelIds) !== undefined
      ? {
          providerConfiguredModelIds: definedArray(
            route.providerConfiguredModelIds
          ),
        }
      : {}),
    providerId: route.providerId,
    ...(route.providerName ? { providerName: route.providerName } : {}),
    ...(route.providerPriority !== undefined
      ? { providerPriority: route.providerPriority }
      : {}),
    ...(route.providerProfileConfigPath
      ? { providerProfileConfigPath: route.providerProfileConfigPath }
      : {}),
    ...(route.providerProfileId
      ? { providerProfileId: route.providerProfileId }
      : {}),
    ...(route.providerProfileSource
      ? { providerProfileSource: route.providerProfileSource }
      : {}),
    ...(route.providerSource ? { providerSource: route.providerSource } : {}),
    ...(route.providerType ? { providerType: route.providerType } : {}),
    ...(route.requestLayer ? { requestLayer: route.requestLayer } : {}),
    ...(route.requestedDimensions !== undefined
      ? { requestedDimensions: route.requestedDimensions }
      : {}),
    routeIndex: route.routeIndex,
  }));
}

function taskRoutePreparedRouteOrderSnapshot(
  routes: CopilotPreparedTaskRouteDiagnosticsType[] | undefined
) {
  return taskRoutePreparedRouteSnapshot(routes).map(route => ({
    ...(route.fallbackOrderIndex !== undefined
      ? { fallbackOrderIndex: route.fallbackOrderIndex }
      : {}),
    modelId: route.modelId,
    providerId: route.providerId,
    ...(route.routeIndex !== undefined ? { routeIndex: route.routeIndex } : {}),
  }));
}

function taskRouteDimensionSnapshot(
  route: CopilotPromptRegistryPublishGateTaskRoute
) {
  const preparedRoutes = (route.preparedRoutes ?? []).map(route => ({
    ...(route.dimensionMismatch !== undefined
      ? { dimensionMismatch: route.dimensionMismatch }
      : {}),
    ...(route.modelEmbeddingDimensions !== undefined
      ? { modelEmbeddingDimensions: route.modelEmbeddingDimensions }
      : {}),
    modelId: route.modelId,
    providerId: route.providerId,
    ...(route.requestedDimensions !== undefined
      ? { requestedDimensions: route.requestedDimensions }
      : {}),
    routeIndex: route.routeIndex,
  }));

  return {
    ...(route.dimensionMismatch !== undefined
      ? { dimensionMismatch: route.dimensionMismatch }
      : {}),
    featureKind: route.featureKind,
    ...(route.modelEmbeddingDimensions !== undefined
      ? { modelEmbeddingDimensions: route.modelEmbeddingDimensions }
      : {}),
    ...(route.modelId ? { modelId: route.modelId } : {}),
    preparedRoutes,
    ...(route.providerId ? { providerId: route.providerId } : {}),
    ...(route.requestedDimensions !== undefined
      ? { requestedDimensions: route.requestedDimensions }
      : {}),
    ...(route.requestedModelId
      ? { requestedModelId: route.requestedModelId }
      : {}),
  };
}

function taskRouteEmbeddingIndexContractSnapshot(
  route: CopilotPromptRegistryPublishGateTaskRoute
) {
  if (!route.embeddingIndexContractVersion) {
    return [];
  }

  return [
    {
      embeddingIndexContractDimensions:
        route.embeddingIndexContractDimensions ?? null,
      embeddingIndexContractFingerprint:
        route.embeddingIndexContractFingerprint ?? null,
      embeddingIndexContractStatus: route.embeddingIndexContractStatus ?? null,
      embeddingIndexContractVersion: route.embeddingIndexContractVersion,
      featureKind: route.featureKind,
      modelEmbeddingDimensions: route.modelEmbeddingDimensions ?? null,
      modelId: route.modelId ?? null,
      providerId: route.providerId ?? null,
      requestedDimensions: route.requestedDimensions ?? null,
      requestedModelId: route.requestedModelId ?? null,
    },
  ];
}

function taskRouteRerankRuntimeContractSnapshot(
  route: CopilotPromptRegistryPublishGateTaskRoute
) {
  if (!route.rerankRuntimeContractVersion) {
    return [];
  }

  return [
    {
      candidateCount: route.candidateCount ?? null,
      featureKind: route.featureKind,
      modelId: route.modelId ?? null,
      preparedProviderCount: route.preparedProviderCount ?? null,
      providerId: route.providerId ?? null,
      requestedModelId: route.requestedModelId ?? null,
      rerankRuntimeContractFingerprint:
        route.rerankRuntimeContractFingerprint ?? null,
      rerankRuntimeContractStatus: route.rerankRuntimeContractStatus ?? null,
      rerankRuntimeContractTopK: route.rerankRuntimeContractTopK ?? null,
      rerankRuntimeContractVersion: route.rerankRuntimeContractVersion,
    },
  ];
}

function taskRouteModelSourceSnapshot(
  route: CopilotPromptRegistryPublishGateTaskRoute
) {
  return [
    {
      featureKind: route.featureKind,
      ...(route.requestedModelConfigKey
        ? { requestedModelConfigKey: route.requestedModelConfigKey }
        : {}),
      ...(route.requestedModelConfigPath
        ? { requestedModelConfigPath: route.requestedModelConfigPath }
        : {}),
      ...(route.requestedModelId
        ? { requestedModelId: route.requestedModelId }
        : {}),
      ...(route.requestedModelSource
        ? { requestedModelSource: route.requestedModelSource }
        : {}),
    },
  ];
}

function taskRouteProviderHealthSnapshot(
  route: CopilotPromptRegistryPublishGateTaskRoute
) {
  const healthCandidate = (
    scope: string,
    candidate: {
      health?: string;
      healthCheckedAt?: string;
      modelId?: string;
      preparedModelId?: string;
      providerId: string;
      providerProfileConfigPath?: string;
      providerProfileId?: string;
      providerProfileSource?: string;
      providerSource?: string;
      providerType?: string;
      requestedModelId?: string;
    },
    index: number
  ) => ({
    candidateIndex: index,
    ...(candidate.health ? { health: candidate.health } : {}),
    ...(candidate.healthCheckedAt
      ? { healthCheckedAt: candidate.healthCheckedAt }
      : {}),
    ...(candidate.modelId ? { modelId: candidate.modelId } : {}),
    ...(candidate.preparedModelId
      ? { preparedModelId: candidate.preparedModelId }
      : {}),
    providerId: candidate.providerId,
    ...(candidate.providerProfileConfigPath
      ? { providerProfileConfigPath: candidate.providerProfileConfigPath }
      : {}),
    ...(candidate.providerProfileId
      ? { providerProfileId: candidate.providerProfileId }
      : {}),
    ...(candidate.providerProfileSource
      ? { providerProfileSource: candidate.providerProfileSource }
      : {}),
    ...(candidate.providerSource
      ? { providerSource: candidate.providerSource }
      : {}),
    ...(candidate.providerType ? { providerType: candidate.providerType } : {}),
    ...(candidate.requestedModelId
      ? { requestedModelId: candidate.requestedModelId }
      : {}),
    scope,
  });

  return [
    ...route.policyCandidates.map((candidate, index) =>
      healthCandidate('policyCandidate', candidate, index)
    ),
    ...route.routeCandidates.map((candidate, index) =>
      healthCandidate('routeCandidate', candidate, index)
    ),
    ...(route.prepareCandidates ?? []).map((candidate, index) =>
      healthCandidate('prepareCandidate', candidate, index)
    ),
  ];
}

function taskRouteSnapshotFingerprint(candidates: unknown) {
  return createHash('sha256')
    .update(stableRepairRecommendationStringify(candidates))
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairRecommendationFingerprint(
  recommendation: Omit<
    CopilotPromptRegistryPublishGateRepairRecommendation,
    'diagnosticsFingerprint'
  >
) {
  const payload = stableRepairRecommendationStringify({
    category: recommendation.category,
    code: recommendation.code,
    evidence: recommendation.evidence,
    instanceKey: recommendation.instanceKey,
    suggestedActionCatalogVersion: recommendation.suggestedActionCatalogVersion,
    suggestedActionInputSchema: recommendation.suggestedActionInputSchema,
    suggestedActionKind: recommendation.suggestedActionKind,
    suggestedActionRequiredCapabilities:
      recommendation.suggestedActionRequiredCapabilities,
    suggestedActionSafety: recommendation.suggestedActionSafety,
    target: recommendation.target,
    targetLocator: recommendation.targetLocator,
  });

  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

function buildPromptRegistryPublishGateRepairRecommendations(input: {
  actionRouteDryRun?: CopilotPromptRegistryPublishGateActionRouteDryRun;
  modelRoutes: CopilotPromptRegistryPublishGateModelRoute[];
  taskRoutes: CopilotPromptRegistryPublishGateTaskRoute[];
  verdict: PromptRegistryPublishGateVerdict;
}): CopilotPromptRegistryPublishGateRepairRecommendation[] {
  const recommendations: CopilotPromptRegistryPublishGateRepairRecommendation[] =
    [];
  const seen = new Set<string>();
  const pushRecommendation = (
    recommendation: Omit<
      CopilotPromptRegistryPublishGateRepairRecommendation,
      | 'suggestedActionCatalogVersion'
      | 'diagnosticsFingerprint'
      | 'suggestedActionInputSchema'
      | 'suggestedActionRequiredCapabilities'
      | 'suggestedActionSafety'
    >
  ) => {
    const key = [
      recommendation.category,
      recommendation.code,
      recommendation.target,
      recommendation.instanceKey,
    ].join(':');
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const preparedRecommendation: Omit<
      CopilotPromptRegistryPublishGateRepairRecommendation,
      'diagnosticsFingerprint'
    > = {
      ...recommendation,
      evidence: uniqueStrings(recommendation.evidence).slice(
        0,
        recommendation.category === 'task_route'
          ? TASK_ROUTE_RECOMMENDATION_EVIDENCE_LIMIT
          : 10
      ),
      suggestedActionCatalogVersion:
        COPILOT_PROMPT_REGISTRY_REPAIR_ACTION_CATALOG_VERSION,
      suggestedActionInputSchema: promptRegistryRepairActionInputSchema(
        recommendation.suggestedActionKind
      ),
      suggestedActionRequiredCapabilities:
        promptRegistryRepairActionRequiredCapabilities(
          recommendation.suggestedActionKind
        ),
      suggestedActionSafety: promptRegistryRepairActionSafety(
        recommendation.suggestedActionKind
      ),
    };
    recommendations.push({
      ...preparedRecommendation,
      diagnosticsFingerprint: promptRegistryRepairRecommendationFingerprint(
        preparedRecommendation
      ),
    });
  };

  if (input.verdict.stale) {
    pushRecommendation({
      category: 'prompt_registry',
      code: 'publish_gate_version_stale',
      detail:
        'The publish gate was evaluated against an older expected registry version.',
      evidence: compactEvidence([
        `registryId:${input.verdict.registryId}`,
        `registryFingerprint:${input.verdict.registryFingerprint}`,
        ...input.verdict.staleReasons.map(reason => `stale:${reason}`),
      ]),
      severity: 'warning',
      suggestedAction:
        'Refresh the Prompt Registry diagnostics before publishing or repairing this prompt.',
      suggestedActionKind: 'refresh_publish_gate',
      target: 'ai_prompts_metadata',
      targetLocator: registryRepairTargetLocator(
        input.verdict,
        'ai_prompts_metadata'
      ),
      title: 'Refresh publish gate diagnostics',
    });
  }

  for (const remediation of input.verdict.remediations ?? []) {
    pushRecommendation({
      category: 'prompt_registry',
      code: `registry_${remediation.kind}`,
      detail: remediation.detail,
      evidence: compactEvidence([
        `registryId:${input.verdict.registryId}`,
        `target:${remediation.target}`,
        `kind:${remediation.kind}`,
      ]),
      severity: input.verdict.allowed ? 'info' : 'error',
      suggestedAction: remediation.detail,
      suggestedActionKind: `registry_${remediation.kind}`,
      target: remediation.target,
      targetLocator: registryRepairTargetLocator(
        input.verdict,
        remediation.target
      ),
      title: remediation.label,
    });
  }

  for (const route of input.modelRoutes) {
    const target = routeRepairTarget(route);
    const requestedModelId = route.requestedModelId ?? route.modelId;
    if (!route.available) {
      const isDefaultRoute = route.candidateKind === 'default';
      pushRecommendation({
        candidateEvidence: isDefaultRoute
          ? modelRouteCandidateProfileStructuredEvidence(route)
          : undefined,
        category: 'model_route',
        code: `${route.candidateKind}_model_route_unavailable`,
        detail: `No available ${route.outputType} provider route was found for ${route.candidateKind} model "${requestedModelId ?? 'unknown'}".`,
        evidence: compactEvidence([
          `candidate:${route.candidateKind}#${route.candidateIndex}`,
          requestedModelId ? `requestedModelId:${requestedModelId}` : null,
          route.requestedModelSource
            ? `requestedModelSource:${route.requestedModelSource}`
            : null,
          `featureKind:${route.featureKind}`,
          `outputType:${route.outputType}`,
          `matchedCandidateCount:${route.matchedCandidateCount}`,
          route.diagnosticsErrorStage
            ? `diagnosticsStage:${route.diagnosticsErrorStage}`
            : null,
          route.diagnosticsErrorCode
            ? `diagnosticsCode:${route.diagnosticsErrorCode}`
            : null,
          route.diagnosticsErrorMessage
            ? `diagnosticsMessage:${route.diagnosticsErrorMessage}`
            : null,
          ...route.reasons.map(reason => `reason:${reason}`),
        ]),
        instanceKey: modelRouteRepairInstanceKey(route),
        severity: isDefaultRoute ? 'error' : 'warning',
        suggestedAction: isDefaultRoute
          ? 'Configure a provider profile/model definition that supports the default prompt model and output type, or update ai_prompts_metadata.model to a routable alias.'
          : 'Either add a provider route for this optional/pro/registry model, or remove the unroutable candidate from the prompt/model registry list.',
        suggestedActionKind: isDefaultRoute
          ? 'repair_default_model_route'
          : 'review_non_default_model_route',
        target,
        targetLocator: modelRouteRepairTargetLocator(
          input.verdict,
          route,
          target
        ),
        title: isDefaultRoute
          ? 'Repair default model route'
          : 'Review non-default model route',
      });
    }

    const policyPhase = route.routeTrace.find(
      phase => phase.phase === 'policy'
    );
    if (
      policyPhase &&
      policyPhase.candidateCount > 0 &&
      (policyPhase.selectedCount ?? 0) === 0
    ) {
      pushRecommendation({
        category: 'provider_policy',
        code: `${route.featureKind}_provider_policy_blocks_route`,
        detail: `Provider route policy selected no providers for ${route.featureKind}.`,
        evidence: compactEvidence([
          `featureKind:${route.featureKind}`,
          route.policyWorkspaceId
            ? `workspaceId:${route.policyWorkspaceId}`
            : 'workspaceId:global',
          ...(route.policyAllowedProviderIds ?? []).map(
            providerId => `allowedProvider:${providerId}`
          ),
          ...(route.policyBlockedProviderIds ?? []).map(
            providerId => `blockedProvider:${providerId}`
          ),
          ...(route.policyAllowedPrivacy ?? []).map(
            privacy => `allowedPrivacy:${privacy}`
          ),
          ...policyPhase.reasons.map(reason => `reason:${reason}`),
        ]),
        instanceKey: modelRouteRepairInstanceKey(route),
        severity: route.candidateKind === 'default' ? 'error' : 'warning',
        suggestedAction:
          'Update copilot provider route policy to allow at least one healthy provider that can serve this feature and privacy requirement.',
        suggestedActionKind: 'relax_provider_route_policy',
        target: `copilot.providers.routePolicy.${route.featureKind}`,
        targetLocator: modelRouteRepairTargetLocator(
          input.verdict,
          route,
          `copilot.providers.routePolicy.${route.featureKind}`
        ),
        title: 'Relax provider route policy',
      });
    }

    if (providerHealthNeedsRepair(route.providerHealth)) {
      pushRecommendation({
        category: 'provider_health',
        code: 'selected_provider_health_not_healthy',
        detail: `Selected provider "${route.providerId ?? 'unknown'}" reports health "${route.providerHealth}".`,
        evidence: compactEvidence([
          route.providerId ? `providerId:${route.providerId}` : null,
          route.providerHealth ? `health:${route.providerHealth}` : null,
          route.providerHealthCheckedAt
            ? `checkedAt:${route.providerHealthCheckedAt}`
            : null,
          route.providerHealthLastError
            ? `lastError:${route.providerHealthLastError}`
            : null,
        ]),
        instanceKey: modelRouteRepairInstanceKey(route),
        severity: 'warning',
        suggestedAction:
          'Check the provider profile credentials, endpoint, and model availability before relying on this route.',
        suggestedActionKind: 'check_provider_health',
        target:
          route.providerProfileConfigPath ??
          route.providerId ??
          'copilot.providers.profiles',
        targetLocator: modelRouteRepairTargetLocator(
          input.verdict,
          route,
          route.providerProfileConfigPath ??
            route.providerId ??
            'copilot.providers.profiles'
        ),
        title: 'Check provider health',
      });
    }
  }

  for (const route of input.taskRoutes) {
    const target = taskRouteRepairTarget(route);
    const diagnosticsErrors = route.diagnosticsErrors ?? [];
    const candidateEvidence =
      taskRouteCandidateProfileStructuredEvidence(route);
    const candidateProfileEvidence =
      taskRouteCandidateProfileEvidence(candidateEvidence);
    const taskBlocked =
      !route.configured ||
      route.preparedProviderCount === 0 ||
      Boolean(route.errorCode);
    if (diagnosticsErrors.length) {
      pushRecommendation({
        candidateEvidence,
        category: 'task_route',
        code: `${route.featureKind}_task_route_diagnostics_error`,
        detail: `Task route "${route.featureKind}" diagnostics reported probe errors.`,
        evidence: compactEvidence(
          [
            `featureKind:${route.featureKind}`,
            `configured:${route.configured}`,
            `preparedProviderCount:${route.preparedProviderCount}`,
            route.requestedModelId
              ? `requestedModelId:${route.requestedModelId}`
              : null,
            ...diagnosticsErrors.flatMap(error => [
              `diagnosticsStage:${error.stage}`,
              `diagnosticsCode:${error.code}`,
              `diagnosticsMessage:${error.message}`,
            ]),
            ...candidateProfileEvidence,
          ],
          TASK_ROUTE_RECOMMENDATION_EVIDENCE_LIMIT
        ),
        instanceKey: taskRouteRepairInstanceKey(route, 'diagnostics-error'),
        severity: 'warning',
        suggestedAction:
          'Inspect provider diagnostics, route candidate probes, and prepare probes before relying on this task route evidence.',
        suggestedActionKind: 'inspect_task_route_diagnostics',
        target,
        targetLocator: taskRouteRepairTargetLocator(
          input.verdict,
          route,
          target
        ),
        title: 'Inspect task route diagnostics',
      });
    }
    if (taskBlocked) {
      pushRecommendation({
        candidateEvidence,
        category: 'task_route',
        code: `${route.featureKind}_task_route_unavailable`,
        detail: `Task route "${route.featureKind}" has no prepared provider route.`,
        evidence: compactEvidence(
          [
            `featureKind:${route.featureKind}`,
            `configured:${route.configured}`,
            `preparedProviderCount:${route.preparedProviderCount}`,
            route.requestedModelId
              ? `requestedModelId:${route.requestedModelId}`
              : null,
            route.requestedModelSource
              ? `requestedModelSource:${route.requestedModelSource}`
              : null,
            route.errorCode ? `errorCode:${route.errorCode}` : null,
            ...diagnosticsErrors.flatMap(error => [
              `diagnosticsStage:${error.stage}`,
              `diagnosticsCode:${error.code}`,
              `diagnosticsMessage:${error.message}`,
            ]),
            ...(route.routeTrace ?? []).flatMap(phase =>
              phase.reasons.map(reason => `${phase.phase}:${reason}`)
            ),
            ...candidateProfileEvidence,
          ],
          TASK_ROUTE_RECOMMENDATION_EVIDENCE_LIMIT
        ),
        instanceKey: taskRouteRepairInstanceKey(route, 'unavailable'),
        severity: 'warning',
        suggestedAction:
          'Configure copilot.tasks.models and provider model definitions so this task has a matching prepared route.',
        suggestedActionKind: 'repair_task_model_route',
        target,
        targetLocator: taskRouteRepairTargetLocator(
          input.verdict,
          route,
          target
        ),
        title: 'Repair task model route',
      });
    }

    if (route.dimensionMismatch) {
      pushRecommendation({
        candidateEvidence,
        category: 'task_route',
        code: `${route.featureKind}_embedding_dimension_mismatch`,
        detail: `Task route "${route.featureKind}" reports embedding dimension mismatch.`,
        evidence: compactEvidence(
          [
            route.requestedDimensions != null
              ? `requestedDimensions:${route.requestedDimensions}`
              : null,
            route.modelEmbeddingDimensions != null
              ? `modelEmbeddingDimensions:${route.modelEmbeddingDimensions}`
              : null,
            route.modelId ? `modelId:${route.modelId}` : null,
            ...candidateProfileEvidence,
          ],
          TASK_ROUTE_RECOMMENDATION_EVIDENCE_LIMIT
        ),
        instanceKey: taskRouteRepairInstanceKey(
          route,
          'embedding-dimension-mismatch'
        ),
        severity: 'error',
        suggestedAction:
          'Use an embedding model with the configured pgvector dimension, or migrate the index/schema before switching dimensions.',
        suggestedActionKind: 'fix_embedding_dimensions',
        target,
        targetLocator: taskRouteRepairTargetLocator(
          input.verdict,
          route,
          target
        ),
        title: 'Fix embedding dimensions',
      });
    }

    const policyPhase = route.routeTrace.find(
      phase => phase.phase === 'policy'
    );
    if (
      policyPhase &&
      policyPhase.candidateCount > 0 &&
      (policyPhase.selectedCount ?? 0) === 0
    ) {
      pushRecommendation({
        candidateEvidence,
        category: 'provider_policy',
        code: `${route.featureKind}_task_policy_blocks_route`,
        detail: `Provider route policy selected no providers for task route "${route.featureKind}".`,
        evidence: compactEvidence(
          [
            `featureKind:${route.featureKind}`,
            route.policyWorkspaceId
              ? `workspaceId:${route.policyWorkspaceId}`
              : 'workspaceId:global',
            ...(route.policyAllowedProviderIds ?? []).map(
              providerId => `allowedProvider:${providerId}`
            ),
            ...(route.policyBlockedProviderIds ?? []).map(
              providerId => `blockedProvider:${providerId}`
            ),
            ...policyPhase.reasons.map(reason => `reason:${reason}`),
            ...candidateProfileEvidence,
          ],
          TASK_ROUTE_RECOMMENDATION_EVIDENCE_LIMIT
        ),
        instanceKey: taskRouteRepairInstanceKey(route, 'policy-blocked'),
        severity: 'warning',
        suggestedAction:
          'Update route policy or provider privacy settings so embedding/rerank task providers are eligible.',
        suggestedActionKind: 'relax_task_route_policy',
        target: `copilot.providers.routePolicy.${route.featureKind}`,
        targetLocator: taskRouteRepairTargetLocator(
          input.verdict,
          route,
          `copilot.providers.routePolicy.${route.featureKind}`
        ),
        title: 'Relax task route policy',
      });
    }
  }

  const dryRun = input.actionRouteDryRun;
  if (dryRun) {
    if (dryRun.status !== 'succeeded') {
      pushRecommendation({
        category: 'action_route',
        code: `action_route_dry_run_${dryRun.status}`,
        detail: `Action route dry-run ${dryRun.status}.`,
        evidence: compactEvidence([
          dryRun.actionId ? `actionId:${dryRun.actionId}` : null,
          `featureKind:${dryRun.featureKind}`,
          dryRun.diagnosticsErrorStage
            ? `diagnosticsStage:${dryRun.diagnosticsErrorStage}`
            : null,
          dryRun.diagnosticsErrorCode
            ? `diagnosticsCode:${dryRun.diagnosticsErrorCode}`
            : null,
          dryRun.diagnosticsErrorMessage
            ? `diagnosticsMessage:${dryRun.diagnosticsErrorMessage}`
            : null,
          dryRun.errorCode ? `errorCode:${dryRun.errorCode}` : null,
          dryRun.errorMessage ? `errorMessage:${dryRun.errorMessage}` : null,
        ]),
        instanceKey: `${actionDryRunRepairInstancePrefix(dryRun)}:dry-run:${dryRun.status}`,
        severity: dryRun.status === 'failed' ? 'warning' : 'info',
        suggestedAction:
          'Check the action prompt messages, default model, and provider route before enabling this action prompt for users.',
        suggestedActionKind: 'review_action_route_dry_run',
        target: actionDryRunRepairTarget(dryRun),
        targetLocator: actionRouteRepairTargetLocator(
          input.verdict,
          dryRun,
          actionDryRunRepairTarget(dryRun)
        ),
        title: 'Review action route dry-run',
      });
    }

    for (const step of dryRun.steps) {
      if (step.routeCountMismatch || step.actualRouteCount === 0) {
        pushRecommendation({
          category: 'action_route',
          code: `${dryRun.featureKind}_${step.stepId}_route_count_mismatch`,
          detail: `Action dry-run step "${step.stepId}" prepared ${step.actualRouteCount} route(s), expected ${step.routeCount}.`,
          evidence: compactEvidence([
            dryRun.actionId ? `actionId:${dryRun.actionId}` : null,
            `stepId:${step.stepId}`,
            `kind:${step.kind}`,
            `actualRouteCount:${step.actualRouteCount}`,
            `routeCount:${step.routeCount}`,
            step.requestedModelId
              ? `requestedModelId:${step.requestedModelId}`
              : null,
            ...step.fallbackProviderIds.map(
              providerId => `fallbackProvider:${providerId}`
            ),
          ]),
          instanceKey: `${actionDryRunRepairInstancePrefix(dryRun)}:${step.stepId}:route-count-mismatch`,
          severity: 'warning',
          suggestedAction:
            'Add or repair provider routes for every fallback provider expected by this action step.',
          suggestedActionKind: 'repair_action_fallback_route_coverage',
          target: actionDryRunRepairTarget(dryRun),
          targetLocator: actionRouteRepairTargetLocator(
            input.verdict,
            dryRun,
            actionDryRunRepairTarget(dryRun),
            { step }
          ),
          title: 'Repair action fallback route coverage',
        });
      }

      for (const route of step.routes) {
        if (providerHealthNeedsRepair(route.providerHealth)) {
          pushRecommendation({
            category: 'action_route',
            code: `${dryRun.featureKind}_${step.stepId}_provider_health_not_healthy`,
            detail: `Action dry-run step "${step.stepId}" selected provider "${route.providerId}" with health "${route.providerHealth}".`,
            evidence: compactEvidence([
              dryRun.actionId ? `actionId:${dryRun.actionId}` : null,
              `stepId:${step.stepId}`,
              `kind:${step.kind}`,
              `providerId:${route.providerId}`,
              `routeIndex:${route.routeIndex}`,
              route.fallbackOrderIndex != null
                ? `fallbackOrderIndex:${route.fallbackOrderIndex}`
                : null,
              route.providerHealth ? `health:${route.providerHealth}` : null,
              route.providerHealthCheckedAt
                ? `checkedAt:${route.providerHealthCheckedAt}`
                : null,
              route.providerHealthLastError
                ? `lastError:${route.providerHealthLastError}`
                : null,
              route.providerProfileConfigPath
                ? `providerProfileConfigPath:${route.providerProfileConfigPath}`
                : null,
              step.requestedModelId
                ? `requestedModelId:${step.requestedModelId}`
                : null,
            ]),
            instanceKey: [
              actionDryRunRepairInstancePrefix(dryRun),
              step.stepId,
              route.providerId,
              route.routeIndex,
            ].join(':'),
            severity: 'warning',
            suggestedAction:
              'Check the action route provider profile health before enabling this action prompt for users.',
            suggestedActionKind: 'check_action_provider_health',
            target: actionDryRunRepairTarget(dryRun),
            targetLocator: actionRouteRepairTargetLocator(
              input.verdict,
              dryRun,
              actionDryRunRepairTarget(dryRun),
              { route, step }
            ),
            title: 'Check action provider health',
          });
        }
      }
    }
  }

  return recommendations;
}

function buildPromptRegistryPublishGateRepairActionCatalog(
  recommendations: CopilotPromptRegistryPublishGateRepairRecommendation[]
): CopilotPromptRegistryPublishGateRepairActionCatalogEntry[] {
  const entries = new Map<
    string,
    CopilotPromptRegistryPublishGateRepairActionCatalogEntry
  >();

  for (const recommendation of recommendations) {
    const key = [
      recommendation.suggestedActionCatalogVersion,
      recommendation.suggestedActionKind,
    ].join(':');
    const current = entries.get(key);
    if (current) {
      current.recommendationCount += 1;
      continue;
    }
    entries.set(key, {
      actionKind: recommendation.suggestedActionKind,
      catalogVersion: recommendation.suggestedActionCatalogVersion,
      inputSchema: recommendation.suggestedActionInputSchema,
      recommendationCount: 1,
      requiredCapabilities: recommendation.suggestedActionRequiredCapabilities,
      safety: recommendation.suggestedActionSafety,
    });
  }

  return [...entries.values()].sort((a, b) =>
    `${a.catalogVersion}:${a.actionKind}`.localeCompare(
      `${b.catalogVersion}:${b.actionKind}`
    )
  );
}

function promptRegistryPublishGateRepairActionCatalogFingerprint(
  entries: CopilotPromptRegistryPublishGateRepairActionCatalogEntry[]
) {
  const payload = stableRepairRecommendationStringify(
    entries.map(entry => ({
      actionKind: entry.actionKind,
      catalogVersion: entry.catalogVersion,
      inputSchema: entry.inputSchema,
      recommendationCount: entry.recommendationCount,
      requiredCapabilities: entry.requiredCapabilities,
      safety: entry.safety,
    }))
  );

  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

function buildPromptRegistryPublishGateRepairActionMutationGuard(input: {
  catalogFingerprint: string;
  recommendations: CopilotPromptRegistryPublishGateRepairRecommendation[];
  verdict: PromptRegistryPublishGateVerdict;
}): CopilotPromptRegistryPublishGateRepairActionMutationGuard {
  const recommendationFingerprints = input.recommendations
    .map(recommendation => recommendation.diagnosticsFingerprint)
    .sort();
  const recommendationCategories = uniqueStrings(
    input.recommendations.map(recommendation => recommendation.category)
  ).sort();
  const recommendationCodes = uniqueStrings(
    input.recommendations.map(recommendation => recommendation.code)
  ).sort();
  const suggestedActionKinds = uniqueStrings(
    input.recommendations.map(
      recommendation => recommendation.suggestedActionKind
    )
  ).sort();
  const intentFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        recommendationCategories,
        recommendationCodes,
        suggestedActionKinds,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const requiredCapabilities = uniqueStrings(
    input.recommendations.flatMap(
      recommendation => recommendation.suggestedActionRequiredCapabilities
    )
  ).sort();
  const safetyLevels = uniqueStrings(
    input.recommendations.map(
      recommendation => recommendation.suggestedActionSafety
    )
  ).sort();
  const requiredReviewModes = uniqueStrings(
    safetyLevels.map(promptRegistryRepairSafetyReviewMode)
  ).sort();
  const inputSchemaFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify(
        uniqueStrings(
          input.recommendations.map(recommendation =>
            stableRepairRecommendationStringify(
              recommendation.suggestedActionInputSchema
            )
          )
        ).sort()
      )
    )
    .digest('hex')
    .slice(0, 16);
  const targetLocatorSnapshots = uniqueStrings(
    input.recommendations.flatMap(recommendation =>
      recommendation.targetLocator
        ? [stableRepairRecommendationStringify(recommendation.targetLocator)]
        : []
    )
  ).sort();
  const targetLocatorFingerprint = createHash('sha256')
    .update(stableRepairRecommendationStringify(targetLocatorSnapshots))
    .digest('hex')
    .slice(0, 16);
  const targetLocatorKinds = uniqueStrings(
    input.recommendations.flatMap(recommendation =>
      recommendation.targetLocator?.kind
        ? [recommendation.targetLocator.kind]
        : []
    )
  ).sort();
  const catalogVersion =
    input.recommendations[0]?.suggestedActionCatalogVersion ??
    COPILOT_PROMPT_REGISTRY_REPAIR_ACTION_CATALOG_VERSION;
  const expectedRegistryUpdatedAt =
    input.verdict.registryUpdatedAt.toISOString();
  const auditSummary = [
    `registry:${input.verdict.registryId}`,
    `registryFingerprint:${input.verdict.registryFingerprint}`,
    `catalog:${catalogVersion}`,
    `catalogFingerprint:${input.catalogFingerprint}`,
    `recommendations:${input.recommendations.length}`,
    `intent:${intentFingerprint}`,
    `targetLocators:${targetLocatorSnapshots.length}`,
    `targetKinds:${targetLocatorKinds.join(',') || 'none'}`,
    `reviewModes:${requiredReviewModes.join(',') || 'none'}`,
    `safety:${safetyLevels.join(',') || 'none'}`,
  ].join(' | ');
  const auditSummaryFingerprint = createHash('sha256')
    .update(auditSummary)
    .digest('hex')
    .slice(0, 16);
  const guard: Omit<
    CopilotPromptRegistryPublishGateRepairActionMutationGuard,
    'guardFingerprint'
  > = {
    auditSummary,
    auditSummaryFingerprint,
    catalogFingerprint: input.catalogFingerprint,
    catalogVersion,
    expectedRegistryFingerprint: input.verdict.registryFingerprint,
    expectedRegistryId: input.verdict.registryId,
    expectedRegistryUpdatedAt,
    intentFingerprint,
    inputSchemaFingerprint,
    recommendationCategories,
    recommendationCount: input.recommendations.length,
    recommendationCodes,
    recommendationFingerprints,
    requiredCapabilities,
    requiredReviewModes,
    required: input.recommendations.length > 0,
    safetyLevels,
    suggestedActionKinds,
    targetLocatorCount: targetLocatorSnapshots.length,
    targetLocatorFingerprint,
    targetLocatorKinds,
  };
  const payload = stableRepairRecommendationStringify(guard);

  return {
    ...guard,
    guardFingerprint: createHash('sha256')
      .update(payload)
      .digest('hex')
      .slice(0, 16),
  };
}

function promptRegistryRepairTargetLocatorFingerprint(
  locator?: CopilotPromptRegistryPublishGateRepairTargetLocator
) {
  return createHash('sha256')
    .update(stableRepairRecommendationStringify(locator ?? null))
    .digest('hex')
    .slice(0, 16);
}

function candidateEvidenceCategoryFromKey(key?: string) {
  if (!key) {
    return undefined;
  }

  const trimmedKey = key.trim();
  if (trimmedKey.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmedKey);
      if (Array.isArray(parsed)) {
        return parsed[0] === 'policy' ? 'policy' : 'route';
      }
    } catch {
      return undefined;
    }
  }

  const [category] = key.split(':');
  return category || undefined;
}

function promptRegistryRepairCandidateEvidenceSnapshot(
  candidateEvidence:
    | CopilotPromptRegistryPublishGateRepairCandidateEvidence[]
    | undefined
) {
  const evidence = candidateEvidence ?? [];
  const candidateEvidenceEntries = evidence
    .map(candidate => {
      const candidateEvidenceCategory = candidateEvidenceCategoryFromKey(
        candidate.candidateKey
      );

      return {
        ...(candidateEvidenceCategory ? { candidateEvidenceCategory } : {}),
        candidateEvidenceFingerprint: candidate.candidateFingerprint,
        ...(candidate.candidateKey
          ? { candidateEvidenceKey: candidate.candidateKey }
          : {}),
        candidateEvidenceProviderId: candidate.providerId,
        candidateEvidenceScope: candidate.scope,
        candidateIndex: candidate.candidateIndex,
        ...(candidate.preparedRouteOrderFingerprint
          ? {
              preparedRouteOrderFingerprint:
                candidate.preparedRouteOrderFingerprint,
            }
          : {}),
        ...(candidate.preparedRoutes?.length
          ? { preparedRouteEntries: candidate.preparedRoutes }
          : {}),
        ...(candidate.policyCandidates?.length
          ? { policyCandidateEntries: candidate.policyCandidates }
          : {}),
        ...(candidate.prepareCandidates?.length
          ? { prepareCandidateEntries: candidate.prepareCandidates }
          : {}),
        ...(candidate.routeCandidates?.length
          ? { routeCandidateEntries: candidate.routeCandidates }
          : {}),
        ...(candidate.taskRouteEffectiveSourceFingerprint
          ? {
              taskRouteEffectiveSourceFingerprint:
                candidate.taskRouteEffectiveSourceFingerprint,
            }
          : {}),
        ...(candidate.taskRouteModelSourceSnapshotEntries?.length
          ? {
              taskRouteModelSourceSnapshotEntries:
                candidate.taskRouteModelSourceSnapshotEntries,
            }
          : {}),
        ...(candidate.taskRouteModelSourceSnapshotFingerprint
          ? {
              taskRouteModelSourceSnapshotFingerprint:
                candidate.taskRouteModelSourceSnapshotFingerprint,
            }
          : {}),
      };
    })
    .sort((left, right) =>
      [
        left.candidateEvidenceScope,
        String(left.candidateIndex),
        left.candidateEvidenceProviderId,
        left.candidateEvidenceFingerprint,
      ]
        .join(':')
        .localeCompare(
          [
            right.candidateEvidenceScope,
            String(right.candidateIndex),
            right.candidateEvidenceProviderId,
            right.candidateEvidenceFingerprint,
          ].join(':')
        )
    );
  const candidateEvidenceFingerprints = uniqueStrings(
    evidence.map(candidate => candidate.candidateFingerprint)
  ).sort();
  const candidateEvidenceKeys = uniqueStrings(
    evidence.flatMap(candidate =>
      candidate.candidateKey ? [candidate.candidateKey] : []
    )
  ).sort();
  const preparedRouteOrderFingerprints = uniqueStrings(
    evidence.flatMap(candidate =>
      candidate.preparedRouteOrderFingerprint
        ? [candidate.preparedRouteOrderFingerprint]
        : []
    )
  ).sort();
  const embeddingIndexContractEvidenceFingerprints = uniqueStrings(
    evidence.flatMap(candidate =>
      candidate.taskRouteEmbeddingIndexContractSnapshotFingerprint
        ? [candidate.taskRouteEmbeddingIndexContractSnapshotFingerprint]
        : []
    )
  ).sort();
  const rerankRuntimeContractEvidenceFingerprints = uniqueStrings(
    evidence.flatMap(candidate =>
      candidate.taskRouteRerankRuntimeContractSnapshotFingerprint
        ? [candidate.taskRouteRerankRuntimeContractSnapshotFingerprint]
        : []
    )
  ).sort();
  const taskRouteEffectiveSourceFingerprints = uniqueStrings(
    evidence.flatMap(candidate =>
      candidate.taskRouteEffectiveSourceFingerprint
        ? [candidate.taskRouteEffectiveSourceFingerprint]
        : []
    )
  ).sort();

  return {
    candidateEvidenceCount: evidence.length,
    candidateEvidenceEntries,
    candidateEvidenceFingerprint: createHash('sha256')
      .update(
        stableRepairRecommendationStringify({
          candidateEvidenceFingerprints,
          candidateEvidenceKeys,
        })
      )
      .digest('hex')
      .slice(0, 16),
    candidateEvidenceFingerprints,
    candidateEvidenceKeys,
    embeddingIndexContractEvidenceFingerprints,
    rerankRuntimeContractEvidenceFingerprints,
    taskRouteEffectiveSourceFingerprints,
    preparedRouteOrderFingerprints,
  };
}

function buildPromptRegistryPublishGateRepairActionPreview(input: {
  catalogFingerprint: string;
  guard: CopilotPromptRegistryPublishGateRepairActionMutationGuard;
  recommendations: CopilotPromptRegistryPublishGateRepairRecommendation[];
}): CopilotPromptRegistryPublishGateRepairActionPreview {
  const operations = input.recommendations.map(recommendation => {
    const targetLocatorFingerprint =
      promptRegistryRepairTargetLocatorFingerprint(
        recommendation.targetLocator
      );
    const candidateEvidenceSnapshot =
      promptRegistryRepairCandidateEvidenceSnapshot(
        recommendation.candidateEvidence
      );
    const operation: Omit<
      CopilotPromptRegistryPublishGateRepairActionPreviewOperation,
      'operationFingerprint'
    > = {
      actionKind: recommendation.suggestedActionKind,
      ...candidateEvidenceSnapshot,
      category: recommendation.category,
      code: recommendation.code,
      diagnosticsFingerprint: recommendation.diagnosticsFingerprint,
      inputSchema: recommendation.suggestedActionInputSchema,
      ...(recommendation.instanceKey
        ? { instanceKey: recommendation.instanceKey }
        : {}),
      previewStatus: promptRegistryRepairPreviewStatus(
        recommendation.suggestedActionSafety
      ),
      requiredCapabilities: [
        ...recommendation.suggestedActionRequiredCapabilities,
      ].sort(),
      reviewMode: promptRegistryRepairSafetyReviewMode(
        recommendation.suggestedActionSafety
      ),
      safety: recommendation.suggestedActionSafety,
      target: recommendation.target,
      ...(recommendation.targetLocator
        ? { targetLocator: recommendation.targetLocator }
        : {}),
      targetLocatorFingerprint,
    };
    const operationFingerprint = createHash('sha256')
      .update(
        stableRepairRecommendationStringify({
          actionKind: operation.actionKind,
          catalogVersion: input.guard.catalogVersion,
          candidateEvidenceFingerprint: operation.candidateEvidenceFingerprint,
          code: operation.code,
          diagnosticsFingerprint: operation.diagnosticsFingerprint,
          embeddingIndexContractEvidenceFingerprints:
            operation.embeddingIndexContractEvidenceFingerprints,
          rerankRuntimeContractEvidenceFingerprints:
            operation.rerankRuntimeContractEvidenceFingerprints,
          taskRouteEffectiveSourceFingerprints:
            operation.taskRouteEffectiveSourceFingerprints,
          inputSchema: operation.inputSchema,
          preparedRouteOrderFingerprints:
            operation.preparedRouteOrderFingerprints,
          previewStatus: operation.previewStatus,
          requiredCapabilities: operation.requiredCapabilities,
          reviewMode: operation.reviewMode,
          safety: operation.safety,
          target: operation.target,
          targetLocatorFingerprint: operation.targetLocatorFingerprint,
        })
      )
      .digest('hex')
      .slice(0, 16);

    return {
      ...operation,
      operationFingerprint,
    };
  });
  const operationFingerprints = operations
    .map(operation => operation.operationFingerprint)
    .sort();
  const operationSetFingerprint = createHash('sha256')
    .update(stableRepairRecommendationStringify(operationFingerprints))
    .digest('hex')
    .slice(0, 16);
  const candidateEvidenceSetFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify(
        operations
          .map(operation => ({
            candidateEvidenceFingerprint:
              operation.candidateEvidenceFingerprint,
            candidateEvidenceFingerprints:
              operation.candidateEvidenceFingerprints,
            candidateEvidenceKeys: operation.candidateEvidenceKeys,
            diagnosticsFingerprint: operation.diagnosticsFingerprint,
            embeddingIndexContractEvidenceFingerprints:
              operation.embeddingIndexContractEvidenceFingerprints,
            rerankRuntimeContractEvidenceFingerprints:
              operation.rerankRuntimeContractEvidenceFingerprints,
            taskRouteEffectiveSourceFingerprints:
              operation.taskRouteEffectiveSourceFingerprints,
            operationFingerprint: operation.operationFingerprint,
            preparedRouteOrderFingerprints:
              operation.preparedRouteOrderFingerprints,
          }))
          .sort((left, right) =>
            left.operationFingerprint.localeCompare(right.operationFingerprint)
          )
      )
    )
    .digest('hex')
    .slice(0, 16);
  const taskRouteEffectiveSourceEvidenceSetFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify(
        operations
          .map(operation => ({
            diagnosticsFingerprint: operation.diagnosticsFingerprint,
            operationFingerprint: operation.operationFingerprint,
            taskRouteEffectiveSourceFingerprints:
              operation.taskRouteEffectiveSourceFingerprints,
          }))
          .sort((left, right) =>
            left.operationFingerprint.localeCompare(right.operationFingerprint)
          )
      )
    )
    .digest('hex')
    .slice(0, 16);
  const taskRouteEffectiveSourceEvidenceSetFingerprintInputs = [
    ...COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_EVIDENCE_SET_FINGERPRINT_INPUTS,
  ];
  const taskRouteEffectiveSourceEvidenceSetFingerprintVersion =
    COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_EVIDENCE_SET_FINGERPRINT_VERSION;
  const embeddingIndexContractEvidenceSetFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify(
        operations
          .map(operation => ({
            diagnosticsFingerprint: operation.diagnosticsFingerprint,
            embeddingIndexContractEvidenceFingerprints:
              operation.embeddingIndexContractEvidenceFingerprints,
            operationFingerprint: operation.operationFingerprint,
          }))
          .sort((left, right) =>
            left.operationFingerprint.localeCompare(right.operationFingerprint)
          )
      )
    )
    .digest('hex')
    .slice(0, 16);
  const rerankRuntimeContractEvidenceSetFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify(
        operations
          .map(operation => ({
            diagnosticsFingerprint: operation.diagnosticsFingerprint,
            operationFingerprint: operation.operationFingerprint,
            rerankRuntimeContractEvidenceFingerprints:
              operation.rerankRuntimeContractEvidenceFingerprints,
          }))
          .sort((left, right) =>
            left.operationFingerprint.localeCompare(right.operationFingerprint)
          )
      )
    )
    .digest('hex')
    .slice(0, 16);
  const preparedRouteOrderEvidenceSetFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify(
        operations
          .map(operation => ({
            diagnosticsFingerprint: operation.diagnosticsFingerprint,
            operationFingerprint: operation.operationFingerprint,
            preparedRouteOrderFingerprints:
              operation.preparedRouteOrderFingerprints,
          }))
          .sort((left, right) =>
            left.operationFingerprint.localeCompare(right.operationFingerprint)
          )
      )
    )
    .digest('hex')
    .slice(0, 16);
  const requiredCapabilities = uniqueStrings(
    operations.flatMap(operation => operation.requiredCapabilities)
  ).sort();
  const approvalModes = uniqueStrings(
    operations.map(operation => operation.reviewMode)
  ).sort();
  const approvalRequired = approvalModes.some(mode =>
    ['dry_run', 'manual_review', 'preview'].includes(mode)
  );
  const authorizationStatus = operations.length
    ? approvalRequired
      ? 'approval_required'
      : 'preauthorized_read_only'
    : 'not_required';
  const approvalPolicyVersion = 'repair-preview-approval/v1';
  const approvalCheckpoints = [
    'read_only_contract',
    'operation_set',
    'capability_scope',
    'authorization_snapshot',
    authorizationStatus,
    ...approvalModes.map(mode => `review_mode:${mode}`),
  ].sort();
  const authorizationFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        approvalModes,
        approvalRequired,
        authorizationStatus,
        operationSetFingerprint,
        requiredCapabilities,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const approvalPolicyFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        approvalCheckpoints,
        approvalModes,
        approvalPolicyVersion,
        approvalRequired,
        authorizationFingerprint,
        authorizationStatus,
        operationSetFingerprint,
        requiredCapabilities,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const previewPayload = stableRepairRecommendationStringify({
    approvalPolicyFingerprint,
    auditSummaryFingerprint: input.guard.auditSummaryFingerprint,
    authorizationFingerprint,
    candidateEvidenceSetFingerprint,
    taskRouteEffectiveSourceEvidenceSetFingerprint,
    catalogFingerprint: input.catalogFingerprint,
    catalogVersion: input.guard.catalogVersion,
    embeddingIndexContractEvidenceSetFingerprint,
    guardFingerprint: input.guard.guardFingerprint,
    operationSetFingerprint,
    preparedRouteOrderEvidenceSetFingerprint,
    rerankRuntimeContractEvidenceSetFingerprint,
    operations: operations.map(operation => ({
      actionKind: operation.actionKind,
      candidateEvidenceFingerprint: operation.candidateEvidenceFingerprint,
      diagnosticsFingerprint: operation.diagnosticsFingerprint,
      embeddingIndexContractEvidenceFingerprints:
        operation.embeddingIndexContractEvidenceFingerprints,
      operationFingerprint: operation.operationFingerprint,
      preparedRouteOrderFingerprints: operation.preparedRouteOrderFingerprints,
      rerankRuntimeContractEvidenceFingerprints:
        operation.rerankRuntimeContractEvidenceFingerprints,
      taskRouteEffectiveSourceFingerprints:
        operation.taskRouteEffectiveSourceFingerprints,
      previewStatus: operation.previewStatus,
      reviewMode: operation.reviewMode,
      safety: operation.safety,
      target: operation.target,
      targetLocatorFingerprint: operation.targetLocatorFingerprint,
    })),
  });
  const previewFingerprint = createHash('sha256')
    .update(previewPayload)
    .digest('hex')
    .slice(0, 16);
  const submissionContractVersion = 'repair-preview-submission/v1';
  const submissionRequiredInputs = [
    'approvalPolicyFingerprint',
    'authorizationFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'embeddingIndexContractEvidenceSetFingerprint',
    'preparedRouteOrderEvidenceSetFingerprint',
    'rerankRuntimeContractEvidenceSetFingerprint',
    'expectedRegistryFingerprint',
    'expectedRegistryId',
    'expectedRegistryUpdatedAt',
    'guardFingerprint',
    'operationSetFingerprint',
    'previewFingerprint',
    'targetLocatorFingerprint',
  ].sort();
  const submissionFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        approvalPolicyFingerprint,
        authorizationFingerprint,
        candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint,
        catalogFingerprint: input.catalogFingerprint,
        contractVersion: submissionContractVersion,
        embeddingIndexContractEvidenceSetFingerprint,
        expectedRegistryFingerprint: input.guard.expectedRegistryFingerprint,
        expectedRegistryId: input.guard.expectedRegistryId,
        expectedRegistryUpdatedAt: input.guard.expectedRegistryUpdatedAt,
        guardFingerprint: input.guard.guardFingerprint,
        operationSetFingerprint,
        preparedRouteOrderEvidenceSetFingerprint,
        previewFingerprint,
        rerankRuntimeContractEvidenceSetFingerprint,
        requiredInputs: submissionRequiredInputs,
        targetLocatorFingerprint: input.guard.targetLocatorFingerprint,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const submissionContract: CopilotPromptRegistryPublishGateRepairActionSubmissionContract =
    {
      approvalPolicyFingerprint,
      authorizationFingerprint,
      candidateEvidenceSetFingerprint,
      taskRouteEffectiveSourceEvidenceSetFingerprint,
      taskRouteEffectiveSourceEvidenceSetFingerprintInputs,
      taskRouteEffectiveSourceEvidenceSetFingerprintVersion,
      catalogFingerprint: input.catalogFingerprint,
      contractVersion: submissionContractVersion,
      embeddingIndexContractEvidenceSetFingerprint,
      expectedRegistryFingerprint: input.guard.expectedRegistryFingerprint,
      expectedRegistryId: input.guard.expectedRegistryId,
      expectedRegistryUpdatedAt: input.guard.expectedRegistryUpdatedAt,
      guardFingerprint: input.guard.guardFingerprint,
      idempotencyKey: [
        input.guard.expectedRegistryId,
        input.guard.expectedRegistryFingerprint,
        previewFingerprint,
        operationSetFingerprint,
      ].join(':'),
      mutationAvailable: false,
      operationSetFingerprint,
      preparedRouteOrderEvidenceSetFingerprint,
      previewFingerprint,
      readOnly: true,
      rerankRuntimeContractEvidenceSetFingerprint,
      requiredInputs: submissionRequiredInputs,
      status: 'read_only_contract',
      submissionFingerprint,
      targetLocatorFingerprint: input.guard.targetLocatorFingerprint,
    };

  return {
    approvalCheckpoints,
    approvalModes,
    approvalPolicyFingerprint,
    approvalPolicyVersion,
    approvalRequired,
    auditSummaryFingerprint: input.guard.auditSummaryFingerprint,
    authorizationFingerprint,
    authorizationStatus,
    candidateCount: operations.length,
    candidateEvidenceSetFingerprint,
    taskRouteEffectiveSourceEvidenceSetFingerprint,
    taskRouteEffectiveSourceEvidenceSetFingerprintInputs,
    taskRouteEffectiveSourceEvidenceSetFingerprintVersion,
    embeddingIndexContractEvidenceSetFingerprint,
    preparedRouteOrderEvidenceSetFingerprint,
    rerankRuntimeContractEvidenceSetFingerprint,
    catalogFingerprint: input.catalogFingerprint,
    catalogVersion: input.guard.catalogVersion,
    guardFingerprint: input.guard.guardFingerprint,
    operationFingerprints,
    operationSetFingerprint,
    operations,
    previewFingerprint,
    readOnly: true,
    requiredCapabilities,
    status: promptRegistryRepairPreviewSummaryStatus(operations),
    submissionContract,
  };
}

function buildPromptRegistryPublishGateRepairGateManifest(input: {
  guard: CopilotPromptRegistryPublishGateRepairActionMutationGuard;
  preview: CopilotPromptRegistryPublishGateRepairActionPreview;
  recommendations: CopilotPromptRegistryPublishGateRepairRecommendation[];
  verdict: PromptRegistryPublishGateVerdict;
}): CopilotPromptRegistryPublishGateRepairGateManifest {
  const version = 'prompt-registry-repair-gate-manifest/v1';
  const boundary = 'repair_gate_manifest_only_no_prompt_or_provider_payload';
  const registryUpdatedAt = input.verdict.registryUpdatedAt.toISOString();
  const submission = input.preview.submissionContract;
  const operationFingerprints = [...input.preview.operationFingerprints].sort();
  const recommendationFingerprints = [
    ...input.guard.recommendationFingerprints,
  ].sort();
  const manifestWithoutFingerprint = {
    version,
    boundary,
    registryFingerprint: input.verdict.registryFingerprint,
    registryId: input.verdict.registryId,
    registryUpdatedAt,
    gateStatus: input.verdict.status,
    publishStatus: input.verdict.publishStatus,
    reason: input.verdict.reason,
    issueCount: input.verdict.issueCount,
    blockingCount: input.verdict.blockingCount,
    recommendationCount: input.recommendations.length,
    operationCount: input.preview.operations.length,
    guardFingerprint: input.guard.guardFingerprint,
    previewFingerprint: input.preview.previewFingerprint,
    submissionFingerprint: submission.submissionFingerprint,
    candidateEvidenceSetFingerprint:
      input.preview.candidateEvidenceSetFingerprint,
    taskRouteEffectiveSourceEvidenceSetFingerprint:
      input.preview.taskRouteEffectiveSourceEvidenceSetFingerprint,
    embeddingIndexContractEvidenceSetFingerprint:
      input.preview.embeddingIndexContractEvidenceSetFingerprint,
    rerankRuntimeContractEvidenceSetFingerprint:
      input.preview.rerankRuntimeContractEvidenceSetFingerprint,
    preparedRouteOrderEvidenceSetFingerprint:
      input.preview.preparedRouteOrderEvidenceSetFingerprint,
    operationSetFingerprint: input.preview.operationSetFingerprint,
    targetLocatorFingerprint: submission.targetLocatorFingerprint,
    approvalPolicyFingerprint: input.preview.approvalPolicyFingerprint,
    authorizationFingerprint: input.preview.authorizationFingerprint,
    catalogFingerprint: input.preview.catalogFingerprint,
    catalogVersion: input.preview.catalogVersion,
    readOnly: input.preview.readOnly,
    mutationAvailable: submission.mutationAvailable,
    requiredCapabilities: [...input.preview.requiredCapabilities].sort(),
    requiredReviewModes: [...input.guard.requiredReviewModes].sort(),
    safetyLevels: [...input.guard.safetyLevels].sort(),
    operationFingerprints,
    recommendationFingerprints,
  };
  const fingerprint = createHash('sha256')
    .update(stableRepairRecommendationStringify(manifestWithoutFingerprint))
    .digest('hex')
    .slice(0, 16);

  return {
    ...manifestWithoutFingerprint,
    taskRouteEffectiveSourceEvidenceSetFingerprintInputs:
      input.preview.taskRouteEffectiveSourceEvidenceSetFingerprintInputs,
    taskRouteEffectiveSourceEvidenceSetFingerprintVersion:
      input.preview.taskRouteEffectiveSourceEvidenceSetFingerprintVersion,
    fingerprint,
  };
}

function promptRegistryRepairGateManifestFilename(
  manifest: CopilotPromptRegistryPublishGateRepairGateManifest
) {
  return `prompt-registry-repair-gate-manifest-${manifest.registryId}-${manifest.fingerprint}.json`;
}

function promptRegistryRepairGateManifestMetadataFilename(
  manifest: CopilotPromptRegistryPublishGateRepairGateManifest
) {
  return `prompt-registry-repair-gate-manifest-metadata-${manifest.registryId}-${manifest.fingerprint}.json`;
}

function promptRegistryRepairGateManifestRedactionPolicyFingerprint(input: {
  artifact: string;
  boundary: string;
  manifestFingerprint: string;
  manifestVersion: string;
  redactionPolicyStatus: string;
  redactionPolicyVersion: string;
  registryFingerprint: string;
  registryId: number;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        version:
          'prompt-registry-repair-gate-manifest-redaction-policy-fingerprint/v1',
        ...input,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairGateManifestExportPolicyFingerprint(input: {
  artifact: string;
  boundary: string;
  exportPolicyStatus: string;
  exportPolicyVersion: string;
  filename: string;
  gateStatus: string;
  manifestFingerprint: string;
  manifestVersion: string;
  metadataFilename: string;
  mime: string;
  publishStatus: string;
  redactionPolicyFingerprint: string;
  registryFingerprint: string;
  registryId: number;
  registryUpdatedAt: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        version:
          'prompt-registry-repair-gate-manifest-export-policy-fingerprint/v1',
        ...input,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairGateManifestAuditEventFingerprint(input: {
  auditEventCreated: boolean;
  auditEventStatus: string;
  auditEventVersion: string;
  exportPolicyFingerprint: string;
  manifestFingerprint: string;
  registryId: number;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        version:
          'prompt-registry-repair-gate-manifest-audit-event-fingerprint/v1',
        ...input,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function promptRegistryRepairGateManifestRetentionPolicyFingerprint(input: {
  artifact: string;
  boundary: string;
  exportPolicyFingerprint: string;
  manifestFingerprint: string;
  registryId: number;
  retentionPolicyStatus: string;
  retentionPolicyVersion: string;
}) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        version:
          'prompt-registry-repair-gate-manifest-retention-policy-fingerprint/v1',
        ...input,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function buildPromptRegistryPublishGateRepairGateManifestExportMetadata(
  manifest: CopilotPromptRegistryPublishGateRepairGateManifest
): CopilotPromptRegistryPublishGateRepairGateManifestExportMetadata {
  const artifact = 'prompt_registry_repair_gate_manifest_json';
  const filename = promptRegistryRepairGateManifestFilename(manifest);
  const metadataFilename =
    promptRegistryRepairGateManifestMetadataFilename(manifest);
  const mime = 'application/json;charset=utf-8';
  const redactionPolicyVersion =
    'prompt-registry-repair-gate-manifest-redaction-policy/v1';
  const redactionPolicyStatus =
    'redacted_projection_no_prompt_provider_payload_or_secret';
  const redactionPolicyFingerprint =
    promptRegistryRepairGateManifestRedactionPolicyFingerprint({
      artifact,
      boundary: manifest.boundary,
      manifestFingerprint: manifest.fingerprint,
      manifestVersion: manifest.version,
      redactionPolicyStatus,
      redactionPolicyVersion,
      registryFingerprint: manifest.registryFingerprint,
      registryId: manifest.registryId,
    });
  const exportPolicyVersion =
    'prompt-registry-repair-gate-manifest-export-policy/v1';
  const exportPolicyStatus = 'read_only_projection';
  const exportPolicyFingerprint =
    promptRegistryRepairGateManifestExportPolicyFingerprint({
      artifact,
      boundary: manifest.boundary,
      exportPolicyStatus,
      exportPolicyVersion,
      filename,
      gateStatus: manifest.gateStatus,
      manifestFingerprint: manifest.fingerprint,
      manifestVersion: manifest.version,
      metadataFilename,
      mime,
      publishStatus: manifest.publishStatus,
      redactionPolicyFingerprint,
      registryFingerprint: manifest.registryFingerprint,
      registryId: manifest.registryId,
      registryUpdatedAt: manifest.registryUpdatedAt,
    });
  const auditEventVersion =
    'prompt-registry-repair-gate-manifest-export-audit-event/v1';
  const auditEventStatus = 'not_created_read_only';
  const auditEventCreated = false;
  const auditEventFingerprint =
    promptRegistryRepairGateManifestAuditEventFingerprint({
      auditEventCreated,
      auditEventStatus,
      auditEventVersion,
      exportPolicyFingerprint,
      manifestFingerprint: manifest.fingerprint,
      registryId: manifest.registryId,
    });
  const retentionPolicyVersion =
    'prompt-registry-repair-gate-manifest-retention-policy/v1';
  const retentionPolicyStatus = 'not_persisted_read_only';
  const retentionPolicyFingerprint =
    promptRegistryRepairGateManifestRetentionPolicyFingerprint({
      artifact,
      boundary: manifest.boundary,
      exportPolicyFingerprint,
      manifestFingerprint: manifest.fingerprint,
      registryId: manifest.registryId,
      retentionPolicyStatus,
      retentionPolicyVersion,
    });

  return {
    version: 'prompt-registry-repair-gate-manifest-export-metadata/v1',
    artifact,
    filename,
    mime,
    metadataFilename,
    manifestVersion: manifest.version,
    manifestFingerprint: manifest.fingerprint,
    registryFingerprint: manifest.registryFingerprint,
    registryId: manifest.registryId,
    registryUpdatedAt: manifest.registryUpdatedAt,
    gateStatus: manifest.gateStatus,
    publishStatus: manifest.publishStatus,
    boundary: manifest.boundary,
    redactionPolicyVersion,
    redactionPolicyStatus,
    redactionPolicyFingerprint,
    exportPolicyVersion,
    exportPolicyStatus,
    exportPolicyFingerprint,
    auditEventVersion,
    auditEventStatus,
    auditEventCreated,
    auditEventFingerprint,
    retentionPolicyVersion,
    retentionPolicyStatus,
    retentionPolicyFingerprint,
  };
}

function buildPromptRegistryRepairPreflight(
  current: CopilotPromptRegistryPublishGateRepairActionSubmissionContract,
  expected: CopilotPromptRegistryRepairSubmissionInput,
  actor: {
    actorId: string;
    actorType: string;
    source: string;
  },
  permission: {
    checked: boolean;
    checkMode: string;
    requiredPermission: WorkspaceAction;
    scope: string;
    status: string;
    workspaceId?: string;
  },
  capability: {
    catalogFingerprint: string;
    checkMode: string;
    requiredCapabilities: string[];
    source: string;
    status: string;
  },
  approval: {
    approvalCheckpoints: string[];
    approvalModes: string[];
    approvalPolicyFingerprint: string;
    approvalRequired: boolean;
    authorizationFingerprint: string;
    authorizationStatus: string;
  }
): CopilotPromptRegistryRepairPreflight {
  const checks: Array<
    [keyof CopilotPromptRegistryRepairSubmissionInput, boolean]
  > = [
    [
      'approvalPolicyFingerprint',
      expected.approvalPolicyFingerprint === current.approvalPolicyFingerprint,
    ],
    [
      'authorizationFingerprint',
      expected.authorizationFingerprint === current.authorizationFingerprint,
    ],
    [
      'candidateEvidenceSetFingerprint',
      expected.candidateEvidenceSetFingerprint ===
        current.candidateEvidenceSetFingerprint,
    ],
    [
      'taskRouteEffectiveSourceEvidenceSetFingerprint',
      expected.taskRouteEffectiveSourceEvidenceSetFingerprint ===
        current.taskRouteEffectiveSourceEvidenceSetFingerprint,
    ],
    [
      'embeddingIndexContractEvidenceSetFingerprint',
      expected.embeddingIndexContractEvidenceSetFingerprint ===
        current.embeddingIndexContractEvidenceSetFingerprint,
    ],
    [
      'rerankRuntimeContractEvidenceSetFingerprint',
      expected.rerankRuntimeContractEvidenceSetFingerprint ===
        current.rerankRuntimeContractEvidenceSetFingerprint,
    ],
    [
      'preparedRouteOrderEvidenceSetFingerprint',
      expected.preparedRouteOrderEvidenceSetFingerprint ===
        current.preparedRouteOrderEvidenceSetFingerprint,
    ],
    [
      'catalogFingerprint',
      expected.catalogFingerprint === current.catalogFingerprint,
    ],
    ['contractVersion', expected.contractVersion === current.contractVersion],
    [
      'expectedRegistryFingerprint',
      expected.expectedRegistryFingerprint ===
        current.expectedRegistryFingerprint,
    ],
    [
      'expectedRegistryId',
      expected.expectedRegistryId === current.expectedRegistryId,
    ],
    [
      'expectedRegistryUpdatedAt',
      expected.expectedRegistryUpdatedAt === current.expectedRegistryUpdatedAt,
    ],
    [
      'guardFingerprint',
      expected.guardFingerprint === current.guardFingerprint,
    ],
    ['idempotencyKey', expected.idempotencyKey === current.idempotencyKey],
    [
      'operationSetFingerprint',
      expected.operationSetFingerprint === current.operationSetFingerprint,
    ],
    [
      'previewFingerprint',
      expected.previewFingerprint === current.previewFingerprint,
    ],
    [
      'requiredInputs',
      stableRepairRecommendationStringify(expected.requiredInputs) ===
        stableRepairRecommendationStringify(current.requiredInputs),
    ],
    [
      'submissionFingerprint',
      expected.submissionFingerprint === current.submissionFingerprint,
    ],
    [
      'targetLocatorFingerprint',
      expected.targetLocatorFingerprint === current.targetLocatorFingerprint,
    ],
  ];
  const matchedFields = checks
    .filter(([, matched]) => matched)
    .map(([field]) => field)
    .sort();
  const mismatchedFields = checks
    .filter(([, matched]) => !matched)
    .map(([field]) => field)
    .sort();
  const actorSnapshotVersion = 'repair-preflight-actor-snapshot/v1';
  const actorSnapshotInputs = [
    'actorHash',
    'actorType',
    'source',
    'workspaceId',
  ].sort();
  const actorHash = createHash('sha256')
    .update(actor.actorId)
    .digest('hex')
    .slice(0, 16);
  const actorSnapshotStatus = actor.actorId
    ? 'bound_to_current_user'
    : 'missing_actor';
  const actorFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        actorHash,
        actorType: actor.actorType,
        inputs: actorSnapshotInputs,
        source: actor.source,
        status: actorSnapshotStatus,
        version: actorSnapshotVersion,
        workspaceId: permission.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const permissionFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        checkMode: permission.checkMode,
        checked: permission.checked,
        requiredPermission: permission.requiredPermission,
        scope: permission.scope,
        status: permission.status,
        workspaceId: permission.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const requiredCapabilities = [...capability.requiredCapabilities].sort();
  const capabilityFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        catalogFingerprint: capability.catalogFingerprint,
        checkMode: capability.checkMode,
        requiredCapabilities,
        source: capability.source,
        status: capability.status,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const reviewBindingVersion = 'repair-preflight-review-binding/v1';
  const reviewBindingInputs = [
    'candidateEvidenceSetFingerprint',
    'capabilityFingerprint',
    'embeddingIndexContractEvidenceSetFingerprint',
    'preparedRouteOrderEvidenceSetFingerprint',
    'permissionFingerprint',
    'rerankRuntimeContractEvidenceSetFingerprint',
    'submissionFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'targetLocatorFingerprint',
  ].sort();
  const reviewBindingStatus = mismatchedFields.length
    ? 'stale_submission'
    : 'ready_for_review';
  const reviewBindingFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        capabilityFingerprint,
        contractVersion: current.contractVersion,
        currentSubmissionFingerprint: current.submissionFingerprint,
        candidateEvidenceSetFingerprint:
          current.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          current.taskRouteEffectiveSourceEvidenceSetFingerprint,
        embeddingIndexContractEvidenceSetFingerprint:
          current.embeddingIndexContractEvidenceSetFingerprint,
        preparedRouteOrderEvidenceSetFingerprint:
          current.preparedRouteOrderEvidenceSetFingerprint,
        rerankRuntimeContractEvidenceSetFingerprint:
          current.rerankRuntimeContractEvidenceSetFingerprint,
        expectedSubmissionFingerprint: expected.submissionFingerprint,
        expectedCandidateEvidenceSetFingerprint:
          expected.candidateEvidenceSetFingerprint,
        expectedTaskRouteEffectiveSourceEvidenceSetFingerprint:
          expected.taskRouteEffectiveSourceEvidenceSetFingerprint,
        expectedEmbeddingIndexContractEvidenceSetFingerprint:
          expected.embeddingIndexContractEvidenceSetFingerprint,
        expectedPreparedRouteOrderEvidenceSetFingerprint:
          expected.preparedRouteOrderEvidenceSetFingerprint,
        expectedRerankRuntimeContractEvidenceSetFingerprint:
          expected.rerankRuntimeContractEvidenceSetFingerprint,
        expectedTargetLocatorFingerprint: expected.targetLocatorFingerprint,
        inputs: reviewBindingInputs,
        permissionFingerprint,
        status: reviewBindingStatus,
        targetLocatorFingerprint: current.targetLocatorFingerprint,
        version: reviewBindingVersion,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const auditBindingVersion = 'repair-preflight-audit-binding/v1';
  const auditBindingInputs = [
    'actorFingerprint',
    'capabilityFingerprint',
    'permissionFingerprint',
    'reviewBindingFingerprint',
  ].sort();
  const auditBindingStatus = reviewBindingStatus;
  const auditBindingFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        actorFingerprint,
        capabilityFingerprint,
        inputs: auditBindingInputs,
        permissionFingerprint,
        reviewBindingFingerprint,
        status: auditBindingStatus,
        version: auditBindingVersion,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const policyBindingVersion = 'repair-preflight-policy-binding/v1';
  const policyBindingInputs = [
    'actorFingerprint',
    'approvalPolicyFingerprint',
    'auditBindingFingerprint',
    'authorizationFingerprint',
    'capabilityFingerprint',
    'permissionFingerprint',
  ].sort();
  const policyBindingStatus = reviewBindingStatus;
  const policySource = 'repair_action_preview_policy_snapshot';
  const policyBindingFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        actorFingerprint,
        approvalPolicyFingerprint: current.approvalPolicyFingerprint,
        auditBindingFingerprint,
        authorizationFingerprint: current.authorizationFingerprint,
        capabilityFingerprint,
        inputs: policyBindingInputs,
        permissionFingerprint,
        source: policySource,
        status: policyBindingStatus,
        version: policyBindingVersion,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const approvalRequestVersion = 'repair-preflight-approval-request/v1';
  const approvalModes = [...approval.approvalModes].sort();
  const approvalCheckpoints = [...approval.approvalCheckpoints].sort();
  const approvalRequestInputs = [
    'approvalCheckpoints',
    'approvalModes',
    'approvalPolicyFingerprint',
    'approvalRequired',
    'authorizationFingerprint',
    'authorizationStatus',
    'policyBindingFingerprint',
    'reviewBindingFingerprint',
  ].sort();
  const approvalRequestStatus = approval.approvalRequired
    ? 'approval_required'
    : 'approval_not_required';
  const approvalRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        approvalCheckpoints,
        approvalModes,
        approvalPolicyFingerprint: approval.approvalPolicyFingerprint,
        approvalRequired: approval.approvalRequired,
        authorizationFingerprint: approval.authorizationFingerprint,
        authorizationStatus: approval.authorizationStatus,
        inputs: approvalRequestInputs,
        policyBindingFingerprint,
        reviewBindingFingerprint,
        status: approvalRequestStatus,
        version: approvalRequestVersion,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const approvalRecordVersion = 'repair-preflight-approval-record/v1';
  const approvalRecordInputs = [
    'actorFingerprint',
    'approvalRequestFingerprint',
    'auditBindingFingerprint',
    'policyBindingFingerprint',
    'reviewBindingFingerprint',
    'workspaceId',
  ].sort();
  const approvalRecordStatus = 'not_created_read_only';
  const approvalRecordFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        actorFingerprint,
        approvalRequestFingerprint,
        auditBindingFingerprint,
        created: false,
        inputs: approvalRecordInputs,
        policyBindingFingerprint,
        reviewBindingFingerprint,
        status: approvalRecordStatus,
        version: approvalRecordVersion,
        workspaceId: permission.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const auditEventVersion = 'repair-preflight-audit-event/v1';
  const auditEventInputs = [
    'actorFingerprint',
    'approvalRecordFingerprint',
    'auditBindingFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'embeddingIndexContractEvidenceSetFingerprint',
    'operationSetFingerprint',
    'policyBindingFingerprint',
    'repairJobFingerprint',
    'rerankRuntimeContractEvidenceSetFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
  ].sort();
  const auditEventStatus = 'not_created_read_only';
  const idempotencyVersion = 'repair-preflight-idempotency/v1';
  const idempotencyScope = permission.workspaceId
    ? 'workspace'
    : 'global_diagnostics';
  const idempotencyStatus = 'not_acquired_read_only';
  const idempotencyFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        candidateEvidenceSetFingerprint:
          current.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          current.taskRouteEffectiveSourceEvidenceSetFingerprint,
        embeddingIndexContractEvidenceSetFingerprint:
          current.embeddingIndexContractEvidenceSetFingerprint,
        idempotencyKey: current.idempotencyKey,
        lockAcquired: false,
        rerankRuntimeContractEvidenceSetFingerprint:
          current.rerankRuntimeContractEvidenceSetFingerprint,
        reviewBindingFingerprint,
        scope: idempotencyScope,
        status: idempotencyStatus,
        version: idempotencyVersion,
        workspaceId: permission.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const repairJobVersion = 'repair-preflight-job-contract/v1';
  const repairJobInputs = [
    'actorFingerprint',
    'auditBindingFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'embeddingIndexContractEvidenceSetFingerprint',
    'idempotencyFingerprint',
    'operationSetFingerprint',
    'policyBindingFingerprint',
    'rerankRuntimeContractEvidenceSetFingerprint',
    'reviewBindingFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
  ].sort();
  const repairJobStatus = 'not_created_read_only';
  const repairJobFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        actorFingerprint,
        auditBindingFingerprint,
        candidateEvidenceSetFingerprint:
          current.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          current.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        embeddingIndexContractEvidenceSetFingerprint:
          current.embeddingIndexContractEvidenceSetFingerprint,
        idempotencyFingerprint,
        inputs: repairJobInputs,
        operationSetFingerprint: current.operationSetFingerprint,
        policyBindingFingerprint,
        rerankRuntimeContractEvidenceSetFingerprint:
          current.rerankRuntimeContractEvidenceSetFingerprint,
        reviewBindingFingerprint,
        status: repairJobStatus,
        submissionFingerprint: current.submissionFingerprint,
        targetLocatorFingerprint: current.targetLocatorFingerprint,
        version: repairJobVersion,
        workspaceId: permission.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const auditEventFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        actorFingerprint,
        approvalRecordFingerprint,
        auditBindingFingerprint,
        candidateEvidenceSetFingerprint:
          current.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          current.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        embeddingIndexContractEvidenceSetFingerprint:
          current.embeddingIndexContractEvidenceSetFingerprint,
        inputs: auditEventInputs,
        operationSetFingerprint: current.operationSetFingerprint,
        policyBindingFingerprint,
        repairJobFingerprint,
        rerankRuntimeContractEvidenceSetFingerprint:
          current.rerankRuntimeContractEvidenceSetFingerprint,
        status: auditEventStatus,
        submissionFingerprint: current.submissionFingerprint,
        targetLocatorFingerprint: current.targetLocatorFingerprint,
        version: auditEventVersion,
        workspaceId: permission.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionStateVersion = 'repair-preflight-execution-state/v1';
  const executionStateInputs = [
    'auditEventFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'embeddingIndexContractEvidenceSetFingerprint',
    'idempotencyFingerprint',
    'operationSetFingerprint',
    'repairJobFingerprint',
    'rerankRuntimeContractEvidenceSetFingerprint',
    'reviewBindingFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
  ].sort();
  const executionStateStatus = 'not_started_read_only';
  const executionStateFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventFingerprint,
        candidateEvidenceSetFingerprint:
          current.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          current.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        embeddingIndexContractEvidenceSetFingerprint:
          current.embeddingIndexContractEvidenceSetFingerprint,
        idempotencyFingerprint,
        inputs: executionStateInputs,
        operationSetFingerprint: current.operationSetFingerprint,
        repairJobFingerprint,
        rerankRuntimeContractEvidenceSetFingerprint:
          current.rerankRuntimeContractEvidenceSetFingerprint,
        reviewBindingFingerprint,
        status: executionStateStatus,
        submissionFingerprint: current.submissionFingerprint,
        targetLocatorFingerprint: current.targetLocatorFingerprint,
        version: executionStateVersion,
        workspaceId: permission.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const rollbackPlanVersion = 'repair-preflight-rollback-plan/v1';
  const rollbackPlanInputs = [
    'auditEventFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'embeddingIndexContractEvidenceSetFingerprint',
    'executionStateFingerprint',
    'operationSetFingerprint',
    'repairJobFingerprint',
    'rerankRuntimeContractEvidenceSetFingerprint',
    'reviewBindingFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
  ].sort();
  const rollbackPlanStatus = 'not_created_read_only';
  const rollbackPlanFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventFingerprint,
        candidateEvidenceSetFingerprint:
          current.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          current.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        embeddingIndexContractEvidenceSetFingerprint:
          current.embeddingIndexContractEvidenceSetFingerprint,
        executionStateFingerprint,
        inputs: rollbackPlanInputs,
        operationSetFingerprint: current.operationSetFingerprint,
        repairJobFingerprint,
        rerankRuntimeContractEvidenceSetFingerprint:
          current.rerankRuntimeContractEvidenceSetFingerprint,
        reviewBindingFingerprint,
        status: rollbackPlanStatus,
        submissionFingerprint: current.submissionFingerprint,
        targetLocatorFingerprint: current.targetLocatorFingerprint,
        version: rollbackPlanVersion,
        workspaceId: permission.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionGateVersion = 'repair-preflight-execution-gate/v1';
  const executionGateInputs = [
    'approvalRecordFingerprint',
    'approvalRequestFingerprint',
    'auditEventFingerprint',
    'executionStateFingerprint',
    'idempotencyFingerprint',
    'mutationAvailable',
    'policyBindingFingerprint',
    'readOnly',
    'repairJobFingerprint',
    'reviewBindingFingerprint',
    'rollbackPlanFingerprint',
    'targetLocatorFingerprint',
  ].sort();
  const executionGateStatus = mismatchedFields.length
    ? 'blocked_stale_submission'
    : current.readOnly
      ? 'blocked_read_only'
      : 'blocked_precondition';
  const executionGateFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        approvalRecordFingerprint,
        approvalRequestFingerprint,
        auditEventFingerprint,
        executionStateFingerprint,
        idempotencyFingerprint,
        inputs: executionGateInputs,
        mutationAvailable: current.mutationAvailable,
        policyBindingFingerprint,
        readOnly: current.readOnly,
        repairJobFingerprint,
        reviewBindingFingerprint,
        rollbackPlanFingerprint,
        status: executionGateStatus,
        targetLocatorFingerprint: current.targetLocatorFingerprint,
        version: executionGateVersion,
        workspaceId: permission.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);

  const preflight: CopilotPromptRegistryRepairPreflight = {
    accepted: false,
    actorFingerprint,
    actorSnapshotInputs,
    actorSnapshotStatus,
    actorSnapshotVersion,
    actorType: actor.actorType,
    approvalCheckpoints,
    approvalModes,
    approvalRecordCreated: false,
    approvalRecordFingerprint,
    approvalRecordInputs,
    approvalRecordStatus,
    approvalRecordVersion,
    approvalRequestFingerprint,
    approvalRequestInputs,
    approvalRequestStatus,
    approvalRequestVersion,
    approvalRequired: approval.approvalRequired,
    auditBindingFingerprint,
    auditBindingInputs,
    auditBindingStatus,
    auditBindingVersion,
    auditEventCreated: false,
    auditEventFingerprint,
    auditEventInputs,
    auditEventStatus,
    auditEventVersion,
    authorizationStatus: approval.authorizationStatus,
    candidateEvidenceSetFingerprint: current.candidateEvidenceSetFingerprint,
    taskRouteEffectiveSourceEvidenceSetFingerprint:
      current.taskRouteEffectiveSourceEvidenceSetFingerprint,
    taskRouteEffectiveSourceEvidenceSetFingerprintInputs: [
      ...COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_EVIDENCE_SET_FINGERPRINT_INPUTS,
    ],
    taskRouteEffectiveSourceEvidenceSetFingerprintVersion:
      COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_EVIDENCE_SET_FINGERPRINT_VERSION,
    embeddingIndexContractEvidenceSetFingerprint:
      current.embeddingIndexContractEvidenceSetFingerprint,
    preparedRouteOrderEvidenceSetFingerprint:
      current.preparedRouteOrderEvidenceSetFingerprint,
    rerankRuntimeContractEvidenceSetFingerprint:
      current.rerankRuntimeContractEvidenceSetFingerprint,
    capabilityCheckMode: capability.checkMode,
    capabilityFingerprint,
    capabilitySource: capability.source,
    capabilityStatus: capability.status,
    contractVersion: current.contractVersion,
    currentSubmissionFingerprint: current.submissionFingerprint,
    expectedSubmissionFingerprint: expected.submissionFingerprint,
    executionGateFingerprint,
    executionGateInputs,
    executionGateStatus,
    executionGateVersion,
    executionStateCreated: false,
    executionStateFingerprint,
    executionStateInputs,
    executionStateStatus,
    executionStateVersion,
    expectedCandidateEvidenceSetFingerprint:
      expected.candidateEvidenceSetFingerprint,
    expectedTaskRouteEffectiveSourceEvidenceSetFingerprint:
      expected.taskRouteEffectiveSourceEvidenceSetFingerprint,
    expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs: [
      ...COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_EVIDENCE_SET_FINGERPRINT_INPUTS,
    ],
    expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion:
      COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_EVIDENCE_SET_FINGERPRINT_VERSION,
    expectedEmbeddingIndexContractEvidenceSetFingerprint:
      expected.embeddingIndexContractEvidenceSetFingerprint,
    expectedPreparedRouteOrderEvidenceSetFingerprint:
      expected.preparedRouteOrderEvidenceSetFingerprint,
    expectedRerankRuntimeContractEvidenceSetFingerprint:
      expected.rerankRuntimeContractEvidenceSetFingerprint,
    expectedTargetLocatorFingerprint: expected.targetLocatorFingerprint,
    idempotencyFingerprint,
    idempotencyKey: current.idempotencyKey,
    idempotencyLockAcquired: false,
    idempotencyScope,
    idempotencyStatus,
    idempotencyVersion,
    matchedFields,
    mismatchedFields,
    mutationAvailable: false,
    permissionCheckMode: permission.checkMode,
    permissionChecked: permission.checked,
    permissionFingerprint,
    permissionScope: permission.scope,
    permissionStatus: permission.status,
    policyBindingFingerprint,
    policyBindingInputs,
    policyBindingStatus,
    policyBindingVersion,
    policySource,
    requiredCapabilities,
    requiredCapabilityCount: requiredCapabilities.length,
    requiredPermission: permission.requiredPermission,
    repairJobCreated: false,
    repairJobFingerprint,
    repairJobInputs,
    repairJobStatus,
    repairJobVersion,
    reviewBindingFingerprint,
    reviewBindingInputs,
    reviewBindingStatus,
    reviewBindingVersion,
    rollbackPlanCreated: false,
    rollbackPlanFingerprint,
    rollbackPlanInputs,
    rollbackPlanStatus,
    rollbackPlanVersion,
    readOnly: true,
    status: reviewBindingStatus,
    targetLocatorFingerprint: current.targetLocatorFingerprint,
  };
  if (permission.workspaceId) {
    preflight.workspaceId = permission.workspaceId;
  }

  return preflight;
}

function candidateEvidenceClassificationSummary(
  candidateEvidenceKeys: string[]
) {
  const categories: string[] = [];
  const providerIds: string[] = [];
  const scopes: string[] = [];

  for (const key of candidateEvidenceKeys) {
    const trimmedKey = key.trim();
    if (trimmedKey.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(trimmedKey);
        if (!Array.isArray(parsed)) {
          continue;
        }
        if (parsed[0] === 'policy') {
          const [, featureKind, workspaceId, providerId] = parsed;
          categories.push('policy');
          if (typeof providerId === 'string' && providerId) {
            providerIds.push(providerId);
          }
          const scopeParts = [featureKind, workspaceId].filter(
            (part): part is string => typeof part === 'string' && !!part
          );
          if (scopeParts.length) {
            scopes.push(scopeParts.join(':'));
          }
        } else {
          const [registryKind, providerId] = parsed;
          categories.push('route');
          if (typeof providerId === 'string' && providerId) {
            providerIds.push(providerId);
          }
          if (typeof registryKind === 'string' && registryKind) {
            scopes.push(registryKind);
          }
        }
      } catch {
        // Non-structured keys remain valid evidence anchors without a summary.
      }
      continue;
    }

    const parts = key.split(':');
    if (parts.length >= 2) {
      categories.push(parts[0]);
      providerIds.push(parts[parts.length - 1]);
      if (parts.length >= 3) {
        scopes.push(parts.slice(1, -1).join(':'));
      }
    }
  }

  const candidateEvidenceCategories = uniqueStrings(categories).sort();

  return {
    candidateEvidenceCategoryCount: candidateEvidenceCategories.length,
    candidateEvidenceCategories,
    candidateEvidenceProviderIds: uniqueStrings(providerIds).sort(),
    candidateEvidenceScopes: uniqueStrings(scopes).sort(),
  };
}

function buildPromptRegistryRepairExecutionRequest(
  input: CopilotPromptRegistryRepairExecutionRequestInput,
  preflight: CopilotPromptRegistryRepairPreflight,
  repairActionPreview: CopilotPromptRegistryPublishGateRepairActionPreview,
  repairGateManifest: CopilotPromptRegistryPublishGateRepairGateManifest,
  repairGateManifestExportMetadata: CopilotPromptRegistryPublishGateRepairGateManifestExportMetadata
): CopilotPromptRegistryRepairExecutionRequest {
  const checks: Array<
    [keyof CopilotPromptRegistryRepairExecutionRequestInput, boolean]
  > = [
    [
      'expectedApprovalRecordFingerprint',
      input.expectedApprovalRecordFingerprint ===
        preflight.approvalRecordFingerprint,
    ],
    [
      'expectedApprovalRequestFingerprint',
      input.expectedApprovalRequestFingerprint ===
        preflight.approvalRequestFingerprint,
    ],
    [
      'expectedAuditEventFingerprint',
      input.expectedAuditEventFingerprint === preflight.auditEventFingerprint,
    ],
    [
      'expectedCandidateEvidenceSetFingerprint',
      input.expectedCandidateEvidenceSetFingerprint ===
        preflight.candidateEvidenceSetFingerprint,
    ],
    [
      'expectedTaskRouteEffectiveSourceEvidenceSetFingerprint',
      input.expectedTaskRouteEffectiveSourceEvidenceSetFingerprint ===
        preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
    ],
    [
      'expectedEmbeddingIndexContractEvidenceSetFingerprint',
      input.expectedEmbeddingIndexContractEvidenceSetFingerprint ===
        preflight.embeddingIndexContractEvidenceSetFingerprint,
    ],
    [
      'expectedRerankRuntimeContractEvidenceSetFingerprint',
      input.expectedRerankRuntimeContractEvidenceSetFingerprint ===
        preflight.rerankRuntimeContractEvidenceSetFingerprint,
    ],
    [
      'expectedPreparedRouteOrderEvidenceSetFingerprint',
      input.expectedPreparedRouteOrderEvidenceSetFingerprint ===
        preflight.preparedRouteOrderEvidenceSetFingerprint,
    ],
    [
      'expectedTargetLocatorFingerprint',
      input.expectedTargetLocatorFingerprint ===
        preflight.targetLocatorFingerprint,
    ],
    [
      'expectedRepairGateManifestFingerprint',
      input.expectedRepairGateManifestFingerprint ===
        repairGateManifest.fingerprint,
    ],
    [
      'expectedRepairGateManifestExportPolicyFingerprint',
      input.expectedRepairGateManifestExportPolicyFingerprint ===
        repairGateManifestExportMetadata.exportPolicyFingerprint,
    ],
    [
      'expectedRepairGateManifestRetentionPolicyFingerprint',
      input.expectedRepairGateManifestRetentionPolicyFingerprint ===
        repairGateManifestExportMetadata.retentionPolicyFingerprint,
    ],
    [
      'expectedExecutionGateFingerprint',
      input.expectedExecutionGateFingerprint ===
        preflight.executionGateFingerprint,
    ],
    [
      'expectedExecutionGateStatus',
      input.expectedExecutionGateStatus === preflight.executionGateStatus,
    ],
    [
      'expectedExecutionStateFingerprint',
      input.expectedExecutionStateFingerprint ===
        preflight.executionStateFingerprint,
    ],
    [
      'expectedIdempotencyFingerprint',
      input.expectedIdempotencyFingerprint === preflight.idempotencyFingerprint,
    ],
    [
      'expectedPolicyBindingFingerprint',
      input.expectedPolicyBindingFingerprint ===
        preflight.policyBindingFingerprint,
    ],
    [
      'expectedPreflightStatus',
      input.expectedPreflightStatus === preflight.status,
    ],
    [
      'expectedRepairJobFingerprint',
      input.expectedRepairJobFingerprint === preflight.repairJobFingerprint,
    ],
    [
      'expectedReviewBindingFingerprint',
      input.expectedReviewBindingFingerprint ===
        preflight.reviewBindingFingerprint,
    ],
    [
      'expectedRollbackPlanFingerprint',
      input.expectedRollbackPlanFingerprint ===
        preflight.rollbackPlanFingerprint,
    ],
  ];
  const matchedFields = checks
    .filter(([, matched]) => matched)
    .map(([field]) => field)
    .sort();
  const mismatchedFields = checks
    .filter(([, matched]) => !matched)
    .map(([field]) => field)
    .sort();
  const requestVersion = 'repair-execution-request/v1';
  const requestInputs = checks.map(([field]) => field).sort();
  const requestStatus = preflight.mismatchedFields.length
    ? 'blocked_stale_submission'
    : mismatchedFields.length
      ? 'blocked_stale_preflight'
      : 'blocked_read_only';
  const supportBundleTaskRouteEffectiveSourceEvidenceSetOperationFingerprints =
    repairActionPreview.operations
      .map(operation => operation.operationFingerprint)
      .sort();
  const candidateEvidenceReferenceSchemaFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaFingerprint();
  const candidateEvidenceReferenceSchemaArtifactFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactFingerprint(
      candidateEvidenceReferenceSchemaFingerprint
    );
  const candidateEvidenceReferenceSchemaArtifactRecordFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordFingerprint(
      {
        artifactFingerprint:
          candidateEvidenceReferenceSchemaArtifactFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprint(
      {
        recordFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageFingerprint(
      {
        recordFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprint(
      {
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
        storageFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprint(
      {
        backendFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
        storageFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprint(
      {
        objectFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprint(
      {
        archiveInclusionFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprint,
        objectFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprint(
      {
        manifestEntryFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint(
      {
        manifestEntryPersistenceFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint(
      {
        persistenceRecordFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint(
      {
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
        storageFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint(
      {
        backendFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
        storageFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint(
      {
        objectFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint(
      {
        archiveInclusionFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint,
        objectFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint(
      {
        manifestEntryFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint(
      {
        manifestEntryPersistenceFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint(
      {
        persistenceRecordFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint(
      {
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
        storageFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint(
      {
        backendFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
        storageFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint(
      {
        objectFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint(
      {
        archiveInclusionFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint,
        objectFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint(
      {
        manifestEntryFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint(
      {
        manifestEntryPersistenceFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint(
      {
        persistenceRecordFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint(
      {
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
        storageFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint(
      {
        backendFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
        storageFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint,
      }
    );
  const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint =
    promptRegistryRepairCandidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint(
      {
        objectFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprint,
      }
    );
  const supportBundleTaskRouteEffectiveSourceEvidenceSetEntries =
    repairActionPreview.operations
      .map(operation => {
        const candidateEvidenceKeys = [
          ...operation.candidateEvidenceKeys,
        ].sort();

        return {
          ...candidateEvidenceClassificationSummary(candidateEvidenceKeys),
          candidateEvidenceCount: operation.candidateEvidenceCount,
          candidateEvidenceEntries: operation.candidateEvidenceEntries,
          candidateEvidenceReferenceSchemaArtifactFingerprint:
            candidateEvidenceReferenceSchemaArtifactFingerprint,
          candidateEvidenceReferenceSchemaArtifactFingerprintInputs: [
            ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_FINGERPRINT_INPUTS,
          ],
          candidateEvidenceReferenceSchemaArtifactRecordFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordFingerprintInputs: [
            ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_FINGERPRINT_INPUTS,
          ],
          candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_PERSISTENCE_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordPersistenceStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_PERSISTENCE_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_BACKEND_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageBackendStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_BACKEND_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_BACKEND_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_BACKEND_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_BACKEND_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_BACKEND_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_BACKEND_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_BACKEND_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_INCLUSION_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_OBJECT_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STORAGE_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_RECORD_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_ARCHIVE_MANIFEST_ENTRY_PERSISTENCE_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprint:
            candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprint,
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprintInputs:
            [
              ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_FINGERPRINT_INPUTS,
            ],
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_OBJECT_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStorageStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STORAGE_STATUS,
          candidateEvidenceReferenceSchemaArtifactRecordStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_RECORD_STATUS,
          candidateEvidenceReferenceSchemaArtifactStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_ARTIFACT_STATUS,
          candidateEvidenceReferenceSchemaFields: [
            ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_FIELDS,
          ],
          candidateEvidenceReferenceSchemaFingerprint:
            candidateEvidenceReferenceSchemaFingerprint,
          candidateEvidenceReferenceSchemaFingerprintInputs: [
            ...COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_FINGERPRINT_INPUTS,
          ],
          candidateEvidenceReferenceSchemaRegistryStatus:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_REGISTRY_STATUS,
          candidateEvidenceReferenceSchemaVersion:
            COPILOT_PROMPT_REGISTRY_REPAIR_CANDIDATE_EVIDENCE_REFERENCE_SCHEMA_VERSION,
          candidateEvidenceFingerprint: operation.candidateEvidenceFingerprint,
          candidateEvidenceFingerprints: [
            ...operation.candidateEvidenceFingerprints,
          ].sort(),
          candidateEvidenceKeys,
          diagnosticsFingerprint: operation.diagnosticsFingerprint,
          operationFingerprint: operation.operationFingerprint,
          taskRouteEffectiveSourceFingerprints: [
            ...operation.taskRouteEffectiveSourceFingerprints,
          ].sort(),
        };
      })
      .sort((left, right) =>
        left.operationFingerprint.localeCompare(right.operationFingerprint)
      );
  const supportBundleTaskRouteEffectiveSourceEvidenceSetDiagnosticsFingerprints =
    uniqueStrings(
      repairActionPreview.operations.map(
        operation => operation.diagnosticsFingerprint
      )
    ).sort();
  const supportBundleTaskRouteEffectiveSourceEvidenceSetSourceFingerprints =
    uniqueStrings(
      repairActionPreview.operations.flatMap(
        operation => operation.taskRouteEffectiveSourceFingerprints
      )
    ).sort();
  const supportBundleArtifactVersion =
    'prompt-registry-repair-gate-support-bundle-artifact/v1';
  const supportBundleArtifactStatus = 'not_created_read_only';
  const supportBundleArtifactInputs = [
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'embeddingIndexContractEvidenceSetFingerprint',
    'manifestExportPolicyFingerprint',
    'manifestFingerprint',
    'manifestMetadataRetentionPolicyFingerprint',
    'preparedRouteOrderEvidenceSetFingerprint',
    'requestStatus',
    'rerankRuntimeContractEvidenceSetFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
  ].sort();
  const supportBundleArtifactFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        embeddingIndexContractEvidenceSetFingerprint:
          preflight.embeddingIndexContractEvidenceSetFingerprint,
        inputs: supportBundleArtifactInputs,
        manifestExportPolicyFingerprint:
          repairGateManifestExportMetadata.exportPolicyFingerprint,
        manifestFilename: repairGateManifestExportMetadata.filename,
        manifestFingerprint: repairGateManifest.fingerprint,
        manifestMetadataFilename:
          repairGateManifestExportMetadata.metadataFilename,
        manifestMetadataRetentionPolicyFingerprint:
          repairGateManifestExportMetadata.retentionPolicyFingerprint,
        preparedRouteOrderEvidenceSetFingerprint:
          preflight.preparedRouteOrderEvidenceSetFingerprint,
        requestStatus,
        rerankRuntimeContractEvidenceSetFingerprint:
          preflight.rerankRuntimeContractEvidenceSetFingerprint,
        status: supportBundleArtifactStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: supportBundleArtifactVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const supportBundlePackageVersion =
    'prompt-registry-repair-gate-support-bundle-package/v1';
  const supportBundlePackageStatus = 'not_created_read_only';
  const supportBundleDownloadAuthorizationStatus = 'not_checked_read_only';
  const supportBundleAuditPersistenceStatus = 'not_persisted_read_only';
  const supportBundleRetentionCleanupStatus = 'not_scheduled_read_only';
  const supportBundleDownloadAuthorizationRequestVersion =
    'prompt-registry-repair-gate-support-bundle-download-authorization-request/v1';
  const supportBundleDownloadAuthorizationRequestStatus =
    'not_created_read_only';
  const supportBundleDownloadAuthorizationRequestInputs = [
    'actorFingerprint',
    'authorizationStatus',
    'downloadAuthorizationStatus',
    'exportPolicyFingerprint',
    'manifestFingerprint',
    'manifestMetadataFingerprint',
    'requestStatus',
    'supportBundleArtifactFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
  ].sort();
  const supportBundleDownloadAuthorizationRequestFingerprint = createHash(
    'sha256'
  )
    .update(
      stableRepairRecommendationStringify({
        actorFingerprint: preflight.actorFingerprint,
        authorizationStatus: preflight.authorizationStatus,
        created: false,
        downloadAuthorizationStatus: supportBundleDownloadAuthorizationStatus,
        exportPolicyFingerprint:
          repairGateManifestExportMetadata.exportPolicyFingerprint,
        inputs: supportBundleDownloadAuthorizationRequestInputs,
        manifestFilename: repairGateManifestExportMetadata.filename,
        manifestFingerprint: repairGateManifest.fingerprint,
        manifestMetadataFilename:
          repairGateManifestExportMetadata.metadataFilename,
        manifestMetadataFingerprint:
          repairGateManifestExportMetadata.exportPolicyFingerprint,
        requestStatus,
        status: supportBundleDownloadAuthorizationRequestStatus,
        supportBundleArtifactFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        version: supportBundleDownloadAuthorizationRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const supportBundlePackageInputs = [
    'auditEventFingerprint',
    'auditEventStatus',
    'auditPersistenceStatus',
    'downloadAuthorizationRequestFingerprint',
    'downloadAuthorizationStatus',
    'exportPolicyFingerprint',
    'manifestFingerprint',
    'manifestMetadataFingerprint',
    'redactionPolicyFingerprint',
    'retentionCleanupStatus',
    'retentionPolicyFingerprint',
    'supportBundleArtifactFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
  ].sort();
  const supportBundlePackageFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventFingerprint:
          repairGateManifestExportMetadata.auditEventFingerprint,
        auditEventStatus: repairGateManifestExportMetadata.auditEventStatus,
        auditPersistenceStatus: supportBundleAuditPersistenceStatus,
        created: false,
        downloadAuthorizationStatus: supportBundleDownloadAuthorizationStatus,
        downloadAuthorizationRequestFingerprint:
          supportBundleDownloadAuthorizationRequestFingerprint,
        exportPolicyFingerprint:
          repairGateManifestExportMetadata.exportPolicyFingerprint,
        inputs: supportBundlePackageInputs,
        manifestFilename: repairGateManifestExportMetadata.filename,
        manifestFingerprint: repairGateManifest.fingerprint,
        manifestMetadataFilename:
          repairGateManifestExportMetadata.metadataFilename,
        manifestMetadataFingerprint:
          repairGateManifestExportMetadata.exportPolicyFingerprint,
        redactionPolicyFingerprint:
          repairGateManifestExportMetadata.redactionPolicyFingerprint,
        retentionCleanupStatus: supportBundleRetentionCleanupStatus,
        retentionPolicyFingerprint:
          repairGateManifestExportMetadata.retentionPolicyFingerprint,
        status: supportBundlePackageStatus,
        supportBundleArtifactFingerprint,
        supportBundleArtifactStatus,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        version: supportBundlePackageVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const supportBundleAuditPersistenceRequestVersion =
    'prompt-registry-repair-gate-support-bundle-audit-persistence-request/v1';
  const supportBundleAuditPersistenceRequestStatus = 'not_created_read_only';
  const supportBundleAuditPersistenceRequestInputs = [
    'actorFingerprint',
    'auditEventFingerprint',
    'auditEventStatus',
    'auditPersistenceStatus',
    'downloadAuthorizationRequestFingerprint',
    'exportPolicyFingerprint',
    'manifestFingerprint',
    'requestStatus',
    'supportBundlePackageFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
  ].sort();
  const supportBundleAuditPersistenceRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        actorFingerprint: preflight.actorFingerprint,
        auditEventFingerprint:
          repairGateManifestExportMetadata.auditEventFingerprint,
        auditEventStatus: repairGateManifestExportMetadata.auditEventStatus,
        auditPersistenceStatus: supportBundleAuditPersistenceStatus,
        created: false,
        downloadAuthorizationRequestFingerprint:
          supportBundleDownloadAuthorizationRequestFingerprint,
        exportPolicyFingerprint:
          repairGateManifestExportMetadata.exportPolicyFingerprint,
        inputs: supportBundleAuditPersistenceRequestInputs,
        manifestFilename: repairGateManifestExportMetadata.filename,
        manifestFingerprint: repairGateManifest.fingerprint,
        requestStatus,
        status: supportBundleAuditPersistenceRequestStatus,
        supportBundlePackageFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        version: supportBundleAuditPersistenceRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const supportBundleRetentionCleanupRequestVersion =
    'prompt-registry-repair-gate-support-bundle-retention-cleanup-request/v1';
  const supportBundleRetentionCleanupRequestStatus = 'not_scheduled_read_only';
  const supportBundleRetentionCleanupRequestInputs = [
    'actorFingerprint',
    'auditPersistenceRequestFingerprint',
    'manifestFingerprint',
    'requestStatus',
    'retentionCleanupStatus',
    'retentionPolicyFingerprint',
    'retentionPolicyStatus',
    'supportBundlePackageFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
  ].sort();
  const supportBundleRetentionCleanupRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        actorFingerprint: preflight.actorFingerprint,
        auditPersistenceRequestFingerprint:
          supportBundleAuditPersistenceRequestFingerprint,
        created: false,
        inputs: supportBundleRetentionCleanupRequestInputs,
        manifestFilename: repairGateManifestExportMetadata.filename,
        manifestFingerprint: repairGateManifest.fingerprint,
        requestStatus,
        retentionCleanupStatus: supportBundleRetentionCleanupStatus,
        retentionPolicyFingerprint:
          repairGateManifestExportMetadata.retentionPolicyFingerprint,
        retentionPolicyStatus:
          repairGateManifestExportMetadata.retentionPolicyStatus,
        status: supportBundleRetentionCleanupRequestStatus,
        supportBundlePackageFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        version: supportBundleRetentionCleanupRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const supportBundleArtifactRecordRequestVersion =
    'prompt-registry-repair-gate-support-bundle-artifact-record-request/v1';
  const supportBundleArtifactRecordRequestStatus = 'not_created_read_only';
  const supportBundleArtifactRecordRequestInputs = [
    'artifactFingerprint',
    'artifactStatus',
    'auditPersistenceRequestFingerprint',
    'downloadAuthorizationRequestFingerprint',
    'manifestFingerprint',
    'manifestMetadataFingerprint',
    'packageFingerprint',
    'requestStatus',
    'retentionCleanupRequestFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
  ].sort();
  const supportBundleArtifactRecordRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        artifactFingerprint: supportBundleArtifactFingerprint,
        artifactStatus: supportBundleArtifactStatus,
        auditPersistenceRequestFingerprint:
          supportBundleAuditPersistenceRequestFingerprint,
        created: false,
        downloadAuthorizationRequestFingerprint:
          supportBundleDownloadAuthorizationRequestFingerprint,
        inputs: supportBundleArtifactRecordRequestInputs,
        manifestFilename: repairGateManifestExportMetadata.filename,
        manifestFingerprint: repairGateManifest.fingerprint,
        manifestMetadataFilename:
          repairGateManifestExportMetadata.metadataFilename,
        manifestMetadataFingerprint:
          repairGateManifestExportMetadata.exportPolicyFingerprint,
        packageFingerprint: supportBundlePackageFingerprint,
        requestStatus,
        retentionCleanupRequestFingerprint:
          supportBundleRetentionCleanupRequestFingerprint,
        status: supportBundleArtifactRecordRequestStatus,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        version: supportBundleArtifactRecordRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const supportBundleStorageKeyRequestVersion =
    'prompt-registry-repair-gate-support-bundle-storage-key-request/v1';
  const supportBundleStorageKeyRequestStatus = 'not_allocated_read_only';
  const supportBundleStorageKeyScope = 'support_bundle_artifact_record';
  const supportBundleStorageKeyRequestInputs = [
    'artifactFingerprint',
    'artifactRecordRequestFingerprint',
    'manifestFingerprint',
    'packageFingerprint',
    'requestStatus',
    'storageKeyScope',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
  ].sort();
  const supportBundleStorageKeyRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        artifactFingerprint: supportBundleArtifactFingerprint,
        artifactRecordRequestFingerprint:
          supportBundleArtifactRecordRequestFingerprint,
        created: false,
        inputs: supportBundleStorageKeyRequestInputs,
        manifestFilename: repairGateManifestExportMetadata.filename,
        manifestFingerprint: repairGateManifest.fingerprint,
        packageFingerprint: supportBundlePackageFingerprint,
        requestStatus,
        scope: supportBundleStorageKeyScope,
        status: supportBundleStorageKeyRequestStatus,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        version: supportBundleStorageKeyRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const supportBundleArchiveRequestVersion =
    'prompt-registry-repair-gate-support-bundle-archive-request/v1';
  const supportBundleArchiveRequestStatus = 'not_created_read_only';
  const supportBundleArchiveFormat = 'json_manifest_bundle';
  const supportBundleArchiveScope = 'support_bundle_download_archive';
  const supportBundleArchiveRequestInputs = [
    'archiveFormat',
    'archiveScope',
    'artifactFingerprint',
    'artifactRecordRequestFingerprint',
    'manifestFingerprint',
    'manifestMetadataFingerprint',
    'packageFingerprint',
    'requestStatus',
    'storageKeyRequestFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
  ].sort();
  const supportBundleArchiveRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        archiveFormat: supportBundleArchiveFormat,
        archiveScope: supportBundleArchiveScope,
        artifactFingerprint: supportBundleArtifactFingerprint,
        artifactRecordRequestFingerprint:
          supportBundleArtifactRecordRequestFingerprint,
        created: false,
        inputs: supportBundleArchiveRequestInputs,
        manifestFilename: repairGateManifestExportMetadata.filename,
        manifestFingerprint: repairGateManifest.fingerprint,
        manifestMetadataFilename:
          repairGateManifestExportMetadata.metadataFilename,
        manifestMetadataFingerprint:
          repairGateManifestExportMetadata.exportPolicyFingerprint,
        packageFingerprint: supportBundlePackageFingerprint,
        requestStatus,
        status: supportBundleArchiveRequestStatus,
        storageKeyRequestFingerprint: supportBundleStorageKeyRequestFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        version: supportBundleArchiveRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const supportBundleArchiveSignatureRequestVersion =
    'prompt-registry-repair-gate-support-bundle-archive-signature-request/v1';
  const supportBundleArchiveSignatureRequestStatus = 'not_signed_read_only';
  const supportBundleArchiveSignaturePolicy =
    'support_bundle_archive_signature_read_only';
  const supportBundleArchiveSignatureRequestInputs = [
    'archiveFormat',
    'archiveRequestFingerprint',
    'archiveScope',
    'artifactRecordRequestFingerprint',
    'manifestFingerprint',
    'manifestMetadataFingerprint',
    'packageFingerprint',
    'requestStatus',
    'signaturePolicy',
    'storageKeyRequestFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
  ].sort();
  const supportBundleArchiveSignatureRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        archiveFormat: supportBundleArchiveFormat,
        archiveRequestFingerprint: supportBundleArchiveRequestFingerprint,
        archiveScope: supportBundleArchiveScope,
        artifactRecordRequestFingerprint:
          supportBundleArtifactRecordRequestFingerprint,
        created: false,
        inputs: supportBundleArchiveSignatureRequestInputs,
        manifestFilename: repairGateManifestExportMetadata.filename,
        manifestFingerprint: repairGateManifest.fingerprint,
        manifestMetadataFilename:
          repairGateManifestExportMetadata.metadataFilename,
        manifestMetadataFingerprint:
          repairGateManifestExportMetadata.exportPolicyFingerprint,
        packageFingerprint: supportBundlePackageFingerprint,
        requestStatus,
        signaturePolicy: supportBundleArchiveSignaturePolicy,
        status: supportBundleArchiveSignatureRequestStatus,
        storageKeyRequestFingerprint: supportBundleStorageKeyRequestFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        version: supportBundleArchiveSignatureRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const supportBundleDownloadResolverRequestVersion =
    'prompt-registry-repair-gate-support-bundle-download-resolver-request/v1';
  const supportBundleDownloadResolverRequestStatus = 'not_registered_read_only';
  const supportBundleDownloadResolverRoute =
    'support_bundle_signed_archive_download';
  const supportBundleDownloadResolverRequestInputs = [
    'archiveRequestFingerprint',
    'archiveSignatureRequestFingerprint',
    'artifactRecordRequestFingerprint',
    'downloadAuthorizationRequestFingerprint',
    'downloadResolverRoute',
    'manifestFingerprint',
    'packageFingerprint',
    'requestStatus',
    'storageKeyRequestFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
  ].sort();
  const supportBundleDownloadResolverRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        archiveRequestFingerprint: supportBundleArchiveRequestFingerprint,
        archiveSignatureRequestFingerprint:
          supportBundleArchiveSignatureRequestFingerprint,
        artifactRecordRequestFingerprint:
          supportBundleArtifactRecordRequestFingerprint,
        created: false,
        downloadAuthorizationRequestFingerprint:
          supportBundleDownloadAuthorizationRequestFingerprint,
        downloadResolverRoute: supportBundleDownloadResolverRoute,
        inputs: supportBundleDownloadResolverRequestInputs,
        manifestFilename: repairGateManifestExportMetadata.filename,
        manifestFingerprint: repairGateManifest.fingerprint,
        packageFingerprint: supportBundlePackageFingerprint,
        requestStatus,
        status: supportBundleDownloadResolverRequestStatus,
        storageKeyRequestFingerprint: supportBundleStorageKeyRequestFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        version: supportBundleDownloadResolverRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const supportBundleSignedUrlRequestVersion =
    'prompt-registry-repair-gate-support-bundle-signed-url-request/v1';
  const supportBundleSignedUrlRequestStatus = 'not_issued_read_only';
  const supportBundleSignedUrlPolicy = 'support_bundle_signed_url_read_only';
  const supportBundleSignedUrlScope = 'support_bundle_download_resolver';
  const supportBundleSignedUrlRequestInputs = [
    'archiveSignatureRequestFingerprint',
    'artifactRecordRequestFingerprint',
    'downloadAuthorizationRequestFingerprint',
    'downloadResolverRequestFingerprint',
    'manifestFingerprint',
    'packageFingerprint',
    'requestStatus',
    'signedUrlPolicy',
    'signedUrlScope',
    'storageKeyRequestFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
  ].sort();
  const supportBundleSignedUrlRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        archiveSignatureRequestFingerprint:
          supportBundleArchiveSignatureRequestFingerprint,
        artifactRecordRequestFingerprint:
          supportBundleArtifactRecordRequestFingerprint,
        created: false,
        downloadAuthorizationRequestFingerprint:
          supportBundleDownloadAuthorizationRequestFingerprint,
        downloadResolverRequestFingerprint:
          supportBundleDownloadResolverRequestFingerprint,
        inputs: supportBundleSignedUrlRequestInputs,
        manifestFilename: repairGateManifestExportMetadata.filename,
        manifestFingerprint: repairGateManifest.fingerprint,
        packageFingerprint: supportBundlePackageFingerprint,
        requestStatus,
        signedUrlPolicy: supportBundleSignedUrlPolicy,
        signedUrlScope: supportBundleSignedUrlScope,
        status: supportBundleSignedUrlRequestStatus,
        storageKeyRequestFingerprint: supportBundleStorageKeyRequestFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        version: supportBundleSignedUrlRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const idempotencyLockVersion = 'repair-execution-idempotency-lock/v1';
  const idempotencyLockStatus = 'not_acquired_read_only';
  const idempotencyLockScope = preflight.idempotencyScope;
  const idempotencyLockInputs = [
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'idempotencyFingerprint',
    'idempotencyKey',
    'preparedRouteOrderEvidenceSetFingerprint',
    'policyBindingFingerprint',
    'requestStatus',
    'reviewBindingFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
  ].sort();
  const idempotencyLockFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        acquired: false,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        idempotencyFingerprint: preflight.idempotencyFingerprint,
        idempotencyKey: preflight.idempotencyKey,
        inputs: idempotencyLockInputs,
        preparedRouteOrderEvidenceSetFingerprint:
          preflight.preparedRouteOrderEvidenceSetFingerprint,
        policyBindingFingerprint: preflight.policyBindingFingerprint,
        requestStatus,
        reviewBindingFingerprint: preflight.reviewBindingFingerprint,
        scope: idempotencyLockScope,
        status: idempotencyLockStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: idempotencyLockVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const approvalRecordRequestVersion =
    'repair-execution-approval-record-request/v1';
  const approvalRecordRequestStatus = 'not_created_read_only';
  const approvalRecordRequestInputs = [
    'actorFingerprint',
    'approvalRecordFingerprint',
    'approvalRequestFingerprint',
    'auditBindingFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'idempotencyLockFingerprint',
    'preparedRouteOrderEvidenceSetFingerprint',
    'policyBindingFingerprint',
    'requestStatus',
    'reviewBindingFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const approvalRecordRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        actorFingerprint: preflight.actorFingerprint,
        approvalRecordFingerprint: preflight.approvalRecordFingerprint,
        approvalRequestFingerprint: preflight.approvalRequestFingerprint,
        auditBindingFingerprint: preflight.auditBindingFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        idempotencyLockFingerprint,
        inputs: approvalRecordRequestInputs,
        preparedRouteOrderEvidenceSetFingerprint:
          preflight.preparedRouteOrderEvidenceSetFingerprint,
        policyBindingFingerprint: preflight.policyBindingFingerprint,
        requestStatus,
        reviewBindingFingerprint: preflight.reviewBindingFingerprint,
        status: approvalRecordRequestStatus,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: approvalRecordRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const auditEventRequestVersion = 'repair-execution-audit-event-request/v1';
  const auditEventRequestStatus = 'not_created_read_only';
  const auditEventRequestInputs = [
    'actorFingerprint',
    'approvalRecordRequestFingerprint',
    'auditBindingFingerprint',
    'auditEventFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'preparedRouteOrderEvidenceSetFingerprint',
    'policyBindingFingerprint',
    'repairJobFingerprint',
    'requestStatus',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const auditEventRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        actorFingerprint: preflight.actorFingerprint,
        approvalRecordRequestFingerprint,
        auditBindingFingerprint: preflight.auditBindingFingerprint,
        auditEventFingerprint: preflight.auditEventFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        idempotencyLockFingerprint,
        inputs: auditEventRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        preparedRouteOrderEvidenceSetFingerprint:
          preflight.preparedRouteOrderEvidenceSetFingerprint,
        policyBindingFingerprint: preflight.policyBindingFingerprint,
        repairJobFingerprint: preflight.repairJobFingerprint,
        requestStatus,
        status: auditEventRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: auditEventRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const repairJobRequestVersion = 'repair-execution-repair-job-request/v1';
  const repairJobRequestStatus = 'not_created_read_only';
  const repairJobRequestInputs = [
    'actorFingerprint',
    'approvalRecordRequestFingerprint',
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'preparedRouteOrderEvidenceSetFingerprint',
    'policyBindingFingerprint',
    'repairJobFingerprint',
    'requestStatus',
    'reviewBindingFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const repairJobRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        actorFingerprint: preflight.actorFingerprint,
        approvalRecordRequestFingerprint,
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        idempotencyLockFingerprint,
        inputs: repairJobRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        preparedRouteOrderEvidenceSetFingerprint:
          preflight.preparedRouteOrderEvidenceSetFingerprint,
        policyBindingFingerprint: preflight.policyBindingFingerprint,
        repairJobFingerprint: preflight.repairJobFingerprint,
        requestStatus,
        reviewBindingFingerprint: preflight.reviewBindingFingerprint,
        status: repairJobRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: repairJobRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionStateRequestVersion = 'repair-execution-state-request/v1';
  const executionStateRequestStatus = 'not_started_read_only';
  const executionStateRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionStateFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'preparedRouteOrderEvidenceSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'reviewBindingFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionStateRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionStateFingerprint: preflight.executionStateFingerprint,
        idempotencyLockFingerprint,
        inputs: executionStateRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        preparedRouteOrderEvidenceSetFingerprint:
          preflight.preparedRouteOrderEvidenceSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        reviewBindingFingerprint: preflight.reviewBindingFingerprint,
        status: executionStateRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionStateRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const rollbackPlanRequestVersion =
    'repair-execution-rollback-plan-request/v1';
  const rollbackPlanRequestStatus = 'not_created_read_only';
  const rollbackPlanRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionStateRequestFingerprint',
    'operationSetFingerprint',
    'preparedRouteOrderEvidenceSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'reviewBindingFingerprint',
    'rollbackPlanFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const rollbackPlanRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionStateRequestFingerprint,
        inputs: rollbackPlanRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        preparedRouteOrderEvidenceSetFingerprint:
          preflight.preparedRouteOrderEvidenceSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        reviewBindingFingerprint: preflight.reviewBindingFingerprint,
        rollbackPlanFingerprint: preflight.rollbackPlanFingerprint,
        status: rollbackPlanRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: rollbackPlanRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionTraceRequestVersion = 'repair-execution-trace-request/v1';
  const executionTraceRequestStatus = 'not_created_read_only';
  const executionTraceRequestInputs = [
    'actorFingerprint',
    'approvalRecordRequestFingerprint',
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionStateRequestFingerprint',
    'idempotencyLockFingerprint',
    'preparedRouteOrderEvidenceSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionTraceRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        actorFingerprint: preflight.actorFingerprint,
        approvalRecordRequestFingerprint,
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionStateRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionTraceRequestInputs,
        preparedRouteOrderEvidenceSetFingerprint:
          preflight.preparedRouteOrderEvidenceSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionTraceRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionTraceRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionResultRequestVersion = 'repair-execution-result-request/v1';
  const executionResultRequestStatus = 'not_recorded_read_only';
  const executionResultRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionStateRequestFingerprint',
    'executionTraceRequestFingerprint',
    'preparedRouteOrderEvidenceSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionResultRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionStateRequestFingerprint,
        executionTraceRequestFingerprint,
        inputs: executionResultRequestInputs,
        preparedRouteOrderEvidenceSetFingerprint:
          preflight.preparedRouteOrderEvidenceSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionResultRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionResultRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRetryPolicyRequestVersion =
    'repair-execution-retry-policy-request/v1';
  const executionRetryPolicyRequestStatus = 'not_created_read_only';
  const executionRetryPolicyRequestInputs = [
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionResultRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionTraceRequestFingerprint',
    'idempotencyLockFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRetryPolicyRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        created: false,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        executionResultRequestFingerprint,
        executionStateRequestFingerprint,
        executionTraceRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRetryPolicyRequestInputs,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRetryPolicyRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRetryPolicyRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionProviderResponseRequestVersion =
    'repair-execution-provider-response-request/v1';
  const executionProviderResponseRequestStatus = 'not_recorded_read_only';
  const executionProviderResponseRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionTraceRequestFingerprint',
    'idempotencyLockFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionProviderResponseRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionStateRequestFingerprint,
        executionTraceRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionProviderResponseRequestInputs,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionProviderResponseRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionProviderResponseRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionFailureEventRequestVersion =
    'repair-execution-failure-event-request/v1';
  const executionFailureEventRequestStatus = 'not_recorded_read_only';
  const executionFailureEventRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionProviderResponseRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionTraceRequestFingerprint',
    'idempotencyLockFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionFailureEventRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionProviderResponseRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionStateRequestFingerprint,
        executionTraceRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionFailureEventRequestInputs,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionFailureEventRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionFailureEventRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRollbackTriggerRequestVersion =
    'repair-execution-rollback-trigger-request/v1';
  const executionRollbackTriggerRequestStatus = 'not_created_read_only';
  const executionRollbackTriggerRequestInputs = [
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionFailureEventRequestFingerprint',
    'executionProviderResponseRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionTraceRequestFingerprint',
    'idempotencyLockFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRollbackTriggerRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionFailureEventRequestFingerprint,
        executionProviderResponseRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionStateRequestFingerprint,
        executionTraceRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRollbackTriggerRequestInputs,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRollbackTriggerRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRollbackTriggerRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRollbackExecutorRequestVersion =
    'repair-execution-rollback-executor-request/v1';
  const executionRollbackExecutorRequestStatus = 'not_started_read_only';
  const executionRollbackExecutorRequestInputs = [
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionFailureEventRequestFingerprint',
    'executionProviderResponseRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRollbackTriggerRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionTraceRequestFingerprint',
    'idempotencyLockFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRollbackExecutorRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionFailureEventRequestFingerprint,
        executionProviderResponseRequestFingerprint,
        executionResultRequestFingerprint,
        executionRollbackTriggerRequestFingerprint,
        executionStateRequestFingerprint,
        executionTraceRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRollbackExecutorRequestInputs,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRollbackExecutorRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRollbackExecutorRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRollbackOperationRequestVersion =
    'repair-execution-rollback-operation-request/v1';
  const executionRollbackOperationRequestStatus = 'not_created_read_only';
  const executionRollbackOperationRequestInputs = [
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionFailureEventRequestFingerprint',
    'executionProviderResponseRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRollbackExecutorRequestFingerprint',
    'executionRollbackTriggerRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionTraceRequestFingerprint',
    'idempotencyLockFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRollbackOperationRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionFailureEventRequestFingerprint,
        executionProviderResponseRequestFingerprint,
        executionResultRequestFingerprint,
        executionRollbackExecutorRequestFingerprint,
        executionRollbackTriggerRequestFingerprint,
        executionStateRequestFingerprint,
        executionTraceRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRollbackOperationRequestInputs,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRollbackOperationRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRollbackOperationRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRollbackOutcomeRequestVersion =
    'repair-execution-rollback-outcome-request/v1';
  const executionRollbackOutcomeRequestStatus = 'not_recorded_read_only';
  const executionRollbackOutcomeRequestInputs = [
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionFailureEventRequestFingerprint',
    'executionProviderResponseRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRollbackExecutorRequestFingerprint',
    'executionRollbackOperationRequestFingerprint',
    'executionRollbackTriggerRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionTraceRequestFingerprint',
    'idempotencyLockFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRollbackOutcomeRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionFailureEventRequestFingerprint,
        executionProviderResponseRequestFingerprint,
        executionResultRequestFingerprint,
        executionRollbackExecutorRequestFingerprint,
        executionRollbackOperationRequestFingerprint,
        executionRollbackTriggerRequestFingerprint,
        executionStateRequestFingerprint,
        executionTraceRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRollbackOutcomeRequestInputs,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRollbackOutcomeRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRollbackOutcomeRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionCompletionRequestVersion =
    'repair-execution-completion-request/v1';
  const executionCompletionRequestStatus = 'not_completed_read_only';
  const executionCompletionRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionFailureEventRequestFingerprint',
    'executionProviderResponseRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRollbackOutcomeRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionTraceRequestFingerprint',
    'idempotencyLockFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionCompletionRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        completed: false,
        executionFailureEventRequestFingerprint,
        executionProviderResponseRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionRollbackOutcomeRequestFingerprint,
        executionStateRequestFingerprint,
        executionTraceRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionCompletionRequestInputs,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionCompletionRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionCompletionRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionCompletionEventRequestVersion =
    'repair-execution-completion-event-request/v1';
  const executionCompletionEventRequestStatus = 'not_recorded_read_only';
  const executionCompletionEventRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionCompletionRequestFingerprint',
    'executionFailureEventRequestFingerprint',
    'executionProviderResponseRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRollbackOutcomeRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionTraceRequestFingerprint',
    'idempotencyLockFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionCompletionEventRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionCompletionRequestFingerprint,
        executionFailureEventRequestFingerprint,
        executionProviderResponseRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionRollbackOutcomeRequestFingerprint,
        executionStateRequestFingerprint,
        executionTraceRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionCompletionEventRequestInputs,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionCompletionEventRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionCompletionEventRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionFinalizationRequestVersion =
    'repair-execution-finalization-request/v1';
  const executionFinalizationRequestStatus = 'not_finalized_read_only';
  const executionFinalizationRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionCompletionEventRequestFingerprint',
    'executionCompletionRequestFingerprint',
    'executionFailureEventRequestFingerprint',
    'executionProviderResponseRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRollbackOutcomeRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionTraceRequestFingerprint',
    'idempotencyLockFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionFinalizationRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        executionCompletionEventRequestFingerprint,
        executionCompletionRequestFingerprint,
        executionFailureEventRequestFingerprint,
        executionProviderResponseRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionRollbackOutcomeRequestFingerprint,
        executionStateRequestFingerprint,
        executionTraceRequestFingerprint,
        finalized: false,
        idempotencyLockFingerprint,
        inputs: executionFinalizationRequestInputs,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionFinalizationRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionFinalizationRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionFinalizationEventRequestVersion =
    'repair-execution-finalization-event-request/v1';
  const executionFinalizationEventRequestStatus = 'not_recorded_read_only';
  const executionFinalizationEventRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionCompletionEventRequestFingerprint',
    'executionCompletionRequestFingerprint',
    'executionFailureEventRequestFingerprint',
    'executionFinalizationRequestFingerprint',
    'executionProviderResponseRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRollbackOutcomeRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionTraceRequestFingerprint',
    'idempotencyLockFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionFinalizationEventRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionCompletionEventRequestFingerprint,
        executionCompletionRequestFingerprint,
        executionFailureEventRequestFingerprint,
        executionFinalizationRequestFingerprint,
        executionProviderResponseRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionRollbackOutcomeRequestFingerprint,
        executionStateRequestFingerprint,
        executionTraceRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionFinalizationEventRequestInputs,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionFinalizationEventRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionFinalizationEventRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionStatusPollRequestVersion =
    'repair-execution-status-poll-request/v1';
  const executionStatusPollRequestStatus = 'not_started_read_only';
  const executionStatusPollRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionCompletionEventRequestFingerprint',
    'executionCompletionRequestFingerprint',
    'executionFailureEventRequestFingerprint',
    'executionFinalizationEventRequestFingerprint',
    'executionFinalizationRequestFingerprint',
    'executionProviderResponseRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRollbackOutcomeRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionTraceRequestFingerprint',
    'idempotencyLockFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionStatusPollRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionCompletionEventRequestFingerprint,
        executionCompletionRequestFingerprint,
        executionFailureEventRequestFingerprint,
        executionFinalizationEventRequestFingerprint,
        executionFinalizationRequestFingerprint,
        executionProviderResponseRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionRollbackOutcomeRequestFingerprint,
        executionStateRequestFingerprint,
        executionTraceRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionStatusPollRequestInputs,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionStatusPollRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionStatusPollRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionOperationEntryRequestVersion =
    'repair-execution-operation-entry-request/v1';
  const executionOperationEntryRequestStatus = 'not_opened_read_only';
  const executionOperationEntryRequestInputs = [
    'approvalRecordRequestFingerprint',
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionCompletionEventRequestFingerprint',
    'executionCompletionRequestFingerprint',
    'executionFailureEventRequestFingerprint',
    'executionFinalizationEventRequestFingerprint',
    'executionFinalizationRequestFingerprint',
    'executionProviderResponseRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRollbackOutcomeRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'idempotencyLockFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionOperationEntryRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        approvalRecordRequestFingerprint,
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionCompletionEventRequestFingerprint,
        executionCompletionRequestFingerprint,
        executionFailureEventRequestFingerprint,
        executionFinalizationEventRequestFingerprint,
        executionFinalizationRequestFingerprint,
        executionProviderResponseRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionRollbackOutcomeRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        executionTraceRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionOperationEntryRequestInputs,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionOperationEntryRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionOperationEntryRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionApprovalUiRequestVersion =
    'repair-execution-approval-ui-request/v1';
  const executionApprovalUiRequestStatus = 'not_rendered_read_only';
  const executionApprovalUiRequestInputs = [
    'approvalRecordRequestFingerprint',
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionOperationEntryRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'idempotencyLockFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionApprovalUiRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        approvalRecordRequestFingerprint,
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionOperationEntryRequestFingerprint,
        executionStatusPollRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionApprovalUiRequestInputs,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionApprovalUiRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionApprovalUiRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionDiffPreviewRequestVersion =
    'repair-execution-diff-preview-request/v1';
  const executionDiffPreviewRequestStatus = 'not_generated_read_only';
  const executionDiffPreviewRequestInputs = [
    'approvalRecordRequestFingerprint',
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionApprovalUiRequestFingerprint',
    'executionOperationEntryRequestFingerprint',
    'guardFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'previewFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionDiffPreviewRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        approvalRecordRequestFingerprint,
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionApprovalUiRequestFingerprint,
        executionOperationEntryRequestFingerprint,
        guardFingerprint: input.submission.guardFingerprint,
        idempotencyLockFingerprint,
        inputs: executionDiffPreviewRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        previewFingerprint: input.submission.previewFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionDiffPreviewRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionDiffPreviewRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionApprovalDecisionRequestVersion =
    'repair-execution-approval-decision-request/v1';
  const executionApprovalDecisionRequestStatus = 'not_recorded_read_only';
  const executionApprovalDecisionRequestInputs = [
    'approvalRecordRequestFingerprint',
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionApprovalUiRequestFingerprint',
    'executionDiffPreviewRequestFingerprint',
    'idempotencyLockFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionApprovalDecisionRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        approvalRecordRequestFingerprint,
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionApprovalUiRequestFingerprint,
        executionDiffPreviewRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionApprovalDecisionRequestInputs,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionApprovalDecisionRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionApprovalDecisionRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionStartRequestVersion = 'repair-execution-start-request/v1';
  const executionStartRequestStatus = 'not_started_read_only';
  const executionStartRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionApprovalDecisionRequestFingerprint',
    'executionOperationEntryRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionStartRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionApprovalDecisionRequestFingerprint,
        executionOperationEntryRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionStartRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionStartRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionStartRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionQueueRequestVersion = 'repair-execution-queue-request/v1';
  const executionQueueRequestStatus = 'not_enqueued_read_only';
  const executionQueueRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionQueueRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionStartRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionQueueRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionQueueRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionQueueRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionWorkerLeaseRequestVersion =
    'repair-execution-worker-lease-request/v1';
  const executionWorkerLeaseRequestStatus = 'not_acquired_read_only';
  const executionWorkerLeaseRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionQueueRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionWorkerLeaseRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionQueueRequestFingerprint,
        executionStartRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionWorkerLeaseRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionWorkerLeaseRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionWorkerLeaseRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionJobRunRequestVersion = 'repair-execution-job-run-request/v1';
  const executionJobRunRequestStatus = 'not_started_read_only';
  const executionJobRunRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionQueueRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionJobRunRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionQueueRequestFingerprint,
        executionStartRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        executionWorkerLeaseRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionJobRunRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionJobRunRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionJobRunRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRunStepRequestVersion = 'repair-execution-run-step-request/v1';
  const executionRunStepRequestStatus = 'not_created_read_only';
  const executionRunStepRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionJobRunRequestFingerprint,
        executionQueueRequestFingerprint,
        executionStartRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        executionWorkerLeaseRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRunStepRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRunStepRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRunStepRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRunStepTraceRequestVersion =
    'repair-execution-run-step-trace-request/v1';
  const executionRunStepTraceRequestStatus = 'not_created_read_only';
  const executionRunStepTraceRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepTraceRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionJobRunRequestFingerprint,
        executionQueueRequestFingerprint,
        executionRunStepRequestFingerprint,
        executionStartRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        executionTraceRequestFingerprint,
        executionWorkerLeaseRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRunStepTraceRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRunStepTraceRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRunStepTraceRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRunStepResultRequestVersion =
    'repair-execution-run-step-result-request/v1';
  const executionRunStepResultRequestStatus = 'not_recorded_read_only';
  const executionRunStepResultRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepResultRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionJobRunRequestFingerprint,
        executionQueueRequestFingerprint,
        executionResultRequestFingerprint,
        executionRunStepRequestFingerprint,
        executionRunStepTraceRequestFingerprint,
        executionStartRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        executionTraceRequestFingerprint,
        executionWorkerLeaseRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRunStepResultRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRunStepResultRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRunStepResultRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRunStepCompletionRequestVersion =
    'repair-execution-run-step-completion-request/v1';
  const executionRunStepCompletionRequestStatus = 'not_completed_read_only';
  const executionRunStepCompletionRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepResultRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepCompletionRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        completed: false,
        executionJobRunRequestFingerprint,
        executionQueueRequestFingerprint,
        executionResultRequestFingerprint,
        executionRunStepRequestFingerprint,
        executionRunStepResultRequestFingerprint,
        executionRunStepTraceRequestFingerprint,
        executionStartRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        executionTraceRequestFingerprint,
        executionWorkerLeaseRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRunStepCompletionRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRunStepCompletionRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRunStepCompletionRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRunStepStatusEventRequestVersion =
    'repair-execution-run-step-status-event-request/v1';
  const executionRunStepStatusEventRequestStatus = 'not_recorded_read_only';
  const executionRunStepStatusEventRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRunStepCompletionRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepResultRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepStatusEventRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionJobRunRequestFingerprint,
        executionQueueRequestFingerprint,
        executionResultRequestFingerprint,
        executionRunStepCompletionRequestFingerprint,
        executionRunStepRequestFingerprint,
        executionRunStepResultRequestFingerprint,
        executionRunStepTraceRequestFingerprint,
        executionStartRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        executionTraceRequestFingerprint,
        executionWorkerLeaseRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRunStepStatusEventRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRunStepStatusEventRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRunStepStatusEventRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRunStepRetryRequestVersion =
    'repair-execution-run-step-retry-request/v1';
  const executionRunStepRetryRequestStatus = 'not_scheduled_read_only';
  const executionRunStepRetryRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRunStepCompletionRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepResultRequestFingerprint',
    'executionRunStepStatusEventRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepRetryRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionJobRunRequestFingerprint,
        executionQueueRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionRunStepCompletionRequestFingerprint,
        executionRunStepRequestFingerprint,
        executionRunStepResultRequestFingerprint,
        executionRunStepStatusEventRequestFingerprint,
        executionRunStepTraceRequestFingerprint,
        executionStartRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        executionTraceRequestFingerprint,
        executionWorkerLeaseRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRunStepRetryRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRunStepRetryRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRunStepRetryRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRunStepRetryAttemptRequestVersion =
    'repair-execution-run-step-retry-attempt-request/v1';
  const executionRunStepRetryAttemptRequestStatus = 'not_created_read_only';
  const executionRunStepRetryAttemptRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRunStepCompletionRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepResultRequestFingerprint',
    'executionRunStepRetryRequestFingerprint',
    'executionRunStepStatusEventRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepRetryAttemptRequestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionJobRunRequestFingerprint,
        executionQueueRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionRunStepCompletionRequestFingerprint,
        executionRunStepRequestFingerprint,
        executionRunStepResultRequestFingerprint,
        executionRunStepRetryRequestFingerprint,
        executionRunStepStatusEventRequestFingerprint,
        executionRunStepTraceRequestFingerprint,
        executionStartRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        executionTraceRequestFingerprint,
        executionWorkerLeaseRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRunStepRetryAttemptRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRunStepRetryAttemptRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRunStepRetryAttemptRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRunStepRetryAttemptStatusEventRequestVersion =
    'repair-execution-run-step-retry-attempt-status-event-request/v1';
  const executionRunStepRetryAttemptStatusEventRequestStatus =
    'not_recorded_read_only';
  const executionRunStepRetryAttemptStatusEventRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRunStepCompletionRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepResultRequestFingerprint',
    'executionRunStepRetryAttemptRequestFingerprint',
    'executionRunStepRetryRequestFingerprint',
    'executionRunStepStatusEventRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepRetryAttemptStatusEventRequestFingerprint = createHash(
    'sha256'
  )
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionJobRunRequestFingerprint,
        executionQueueRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionRunStepCompletionRequestFingerprint,
        executionRunStepRequestFingerprint,
        executionRunStepResultRequestFingerprint,
        executionRunStepRetryAttemptRequestFingerprint,
        executionRunStepRetryRequestFingerprint,
        executionRunStepStatusEventRequestFingerprint,
        executionRunStepTraceRequestFingerprint,
        executionStartRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        executionTraceRequestFingerprint,
        executionWorkerLeaseRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRunStepRetryAttemptStatusEventRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRunStepRetryAttemptStatusEventRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRunStepRetryAttemptStatusEventRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRunStepRetryAttemptTraceRequestVersion =
    'repair-execution-run-step-retry-attempt-trace-request/v1';
  const executionRunStepRetryAttemptTraceRequestStatus =
    'not_created_read_only';
  const executionRunStepRetryAttemptTraceRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRunStepCompletionRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepResultRequestFingerprint',
    'executionRunStepRetryAttemptRequestFingerprint',
    'executionRunStepRetryAttemptStatusEventRequestFingerprint',
    'executionRunStepRetryRequestFingerprint',
    'executionRunStepStatusEventRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepRetryAttemptTraceRequestFingerprint = createHash(
    'sha256'
  )
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionJobRunRequestFingerprint,
        executionQueueRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionRunStepCompletionRequestFingerprint,
        executionRunStepRequestFingerprint,
        executionRunStepResultRequestFingerprint,
        executionRunStepRetryAttemptRequestFingerprint,
        executionRunStepRetryAttemptStatusEventRequestFingerprint,
        executionRunStepRetryRequestFingerprint,
        executionRunStepStatusEventRequestFingerprint,
        executionRunStepTraceRequestFingerprint,
        executionStartRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        executionTraceRequestFingerprint,
        executionWorkerLeaseRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRunStepRetryAttemptTraceRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRunStepRetryAttemptTraceRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRunStepRetryAttemptTraceRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRunStepRetryAttemptResultRequestVersion =
    'repair-execution-run-step-retry-attempt-result-request/v1';
  const executionRunStepRetryAttemptResultRequestStatus =
    'not_recorded_read_only';
  const executionRunStepRetryAttemptResultRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRunStepCompletionRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepResultRequestFingerprint',
    'executionRunStepRetryAttemptRequestFingerprint',
    'executionRunStepRetryAttemptStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptTraceRequestFingerprint',
    'executionRunStepRetryRequestFingerprint',
    'executionRunStepStatusEventRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepRetryAttemptResultRequestFingerprint = createHash(
    'sha256'
  )
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        created: false,
        executionJobRunRequestFingerprint,
        executionQueueRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionRunStepCompletionRequestFingerprint,
        executionRunStepRequestFingerprint,
        executionRunStepResultRequestFingerprint,
        executionRunStepRetryAttemptRequestFingerprint,
        executionRunStepRetryAttemptStatusEventRequestFingerprint,
        executionRunStepRetryAttemptTraceRequestFingerprint,
        executionRunStepRetryRequestFingerprint,
        executionRunStepStatusEventRequestFingerprint,
        executionRunStepTraceRequestFingerprint,
        executionStartRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        executionTraceRequestFingerprint,
        executionWorkerLeaseRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRunStepRetryAttemptResultRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRunStepRetryAttemptResultRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRunStepRetryAttemptResultRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRunStepRetryAttemptCompletionRequestVersion =
    'repair-execution-run-step-retry-attempt-completion-request/v1';
  const executionRunStepRetryAttemptCompletionRequestStatus =
    'not_completed_read_only';
  const executionRunStepRetryAttemptCompletionRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRunStepCompletionRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepResultRequestFingerprint',
    'executionRunStepRetryAttemptRequestFingerprint',
    'executionRunStepRetryAttemptResultRequestFingerprint',
    'executionRunStepRetryAttemptStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptTraceRequestFingerprint',
    'executionRunStepRetryRequestFingerprint',
    'executionRunStepStatusEventRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepRetryAttemptCompletionRequestFingerprint = createHash(
    'sha256'
  )
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        completed: false,
        executionJobRunRequestFingerprint,
        executionQueueRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionRunStepCompletionRequestFingerprint,
        executionRunStepRequestFingerprint,
        executionRunStepResultRequestFingerprint,
        executionRunStepRetryAttemptRequestFingerprint,
        executionRunStepRetryAttemptResultRequestFingerprint,
        executionRunStepRetryAttemptStatusEventRequestFingerprint,
        executionRunStepRetryAttemptTraceRequestFingerprint,
        executionRunStepRetryRequestFingerprint,
        executionRunStepStatusEventRequestFingerprint,
        executionRunStepTraceRequestFingerprint,
        executionStartRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        executionTraceRequestFingerprint,
        executionWorkerLeaseRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRunStepRetryAttemptCompletionRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRunStepRetryAttemptCompletionRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRunStepRetryAttemptCompletionRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRunStepRetryAttemptCompletionStatusEventRequestVersion =
    'repair-execution-run-step-retry-attempt-completion-status-event-request/v1';
  const executionRunStepRetryAttemptCompletionStatusEventRequestStatus =
    'not_recorded_read_only';
  const executionRunStepRetryAttemptCompletionStatusEventRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRunStepCompletionRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepResultRequestFingerprint',
    'executionRunStepRetryAttemptCompletionRequestFingerprint',
    'executionRunStepRetryAttemptRequestFingerprint',
    'executionRunStepRetryAttemptResultRequestFingerprint',
    'executionRunStepRetryAttemptStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptTraceRequestFingerprint',
    'executionRunStepRetryRequestFingerprint',
    'executionRunStepStatusEventRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint =
    createHash('sha256')
      .update(
        stableRepairRecommendationStringify({
          auditEventRequestFingerprint,
          candidateEvidenceSetFingerprint:
            preflight.candidateEvidenceSetFingerprint,
          taskRouteEffectiveSourceEvidenceSetFingerprint:
            preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
          created: false,
          executionJobRunRequestFingerprint,
          executionQueueRequestFingerprint,
          executionResultRequestFingerprint,
          executionRetryPolicyRequestFingerprint,
          executionRunStepCompletionRequestFingerprint,
          executionRunStepRequestFingerprint,
          executionRunStepResultRequestFingerprint,
          executionRunStepRetryAttemptCompletionRequestFingerprint,
          executionRunStepRetryAttemptRequestFingerprint,
          executionRunStepRetryAttemptResultRequestFingerprint,
          executionRunStepRetryAttemptStatusEventRequestFingerprint,
          executionRunStepRetryAttemptTraceRequestFingerprint,
          executionRunStepRetryRequestFingerprint,
          executionRunStepStatusEventRequestFingerprint,
          executionRunStepTraceRequestFingerprint,
          executionStartRequestFingerprint,
          executionStateRequestFingerprint,
          executionStatusPollRequestFingerprint,
          executionTraceRequestFingerprint,
          executionWorkerLeaseRequestFingerprint,
          idempotencyLockFingerprint,
          inputs:
            executionRunStepRetryAttemptCompletionStatusEventRequestInputs,
          operationSetFingerprint: input.submission.operationSetFingerprint,
          repairJobRequestFingerprint,
          requestStatus,
          rollbackPlanRequestFingerprint,
          status:
            executionRunStepRetryAttemptCompletionStatusEventRequestStatus,
          submissionFingerprint: preflight.currentSubmissionFingerprint,
          targetLocatorFingerprint: preflight.targetLocatorFingerprint,
          version:
            executionRunStepRetryAttemptCompletionStatusEventRequestVersion,
          workspaceId: preflight.workspaceId ?? null,
        })
      )
      .digest('hex')
      .slice(0, 16);
  const executionRunStepRetryAttemptFinalizationRequestVersion =
    'repair-execution-run-step-retry-attempt-finalization-request/v1';
  const executionRunStepRetryAttemptFinalizationRequestStatus =
    'not_finalized_read_only';
  const executionRunStepRetryAttemptFinalizationRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRunStepCompletionRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepResultRequestFingerprint',
    'executionRunStepRetryAttemptCompletionRequestFingerprint',
    'executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptRequestFingerprint',
    'executionRunStepRetryAttemptResultRequestFingerprint',
    'executionRunStepRetryAttemptStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptTraceRequestFingerprint',
    'executionRunStepRetryRequestFingerprint',
    'executionRunStepStatusEventRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepRetryAttemptFinalizationRequestFingerprint = createHash(
    'sha256'
  )
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        executionJobRunRequestFingerprint,
        executionQueueRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionRunStepCompletionRequestFingerprint,
        executionRunStepRequestFingerprint,
        executionRunStepResultRequestFingerprint,
        executionRunStepRetryAttemptCompletionRequestFingerprint,
        executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint,
        executionRunStepRetryAttemptRequestFingerprint,
        executionRunStepRetryAttemptResultRequestFingerprint,
        executionRunStepRetryAttemptStatusEventRequestFingerprint,
        executionRunStepRetryAttemptTraceRequestFingerprint,
        executionRunStepRetryRequestFingerprint,
        executionRunStepStatusEventRequestFingerprint,
        executionRunStepTraceRequestFingerprint,
        executionStartRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        executionTraceRequestFingerprint,
        executionWorkerLeaseRequestFingerprint,
        finalized: false,
        idempotencyLockFingerprint,
        inputs: executionRunStepRetryAttemptFinalizationRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRunStepRetryAttemptFinalizationRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRunStepRetryAttemptFinalizationRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRunStepRetryAttemptFinalizationStatusEventRequestVersion =
    'repair-execution-run-step-retry-attempt-finalization-status-event-request/v1';
  const executionRunStepRetryAttemptFinalizationStatusEventRequestStatus =
    'not_recorded_read_only';
  const executionRunStepRetryAttemptFinalizationStatusEventRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRunStepCompletionRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepResultRequestFingerprint',
    'executionRunStepRetryAttemptCompletionRequestFingerprint',
    'executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptFinalizationRequestFingerprint',
    'executionRunStepRetryAttemptRequestFingerprint',
    'executionRunStepRetryAttemptResultRequestFingerprint',
    'executionRunStepRetryAttemptStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptTraceRequestFingerprint',
    'executionRunStepRetryRequestFingerprint',
    'executionRunStepStatusEventRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint =
    createHash('sha256')
      .update(
        stableRepairRecommendationStringify({
          auditEventRequestFingerprint,
          candidateEvidenceSetFingerprint:
            preflight.candidateEvidenceSetFingerprint,
          taskRouteEffectiveSourceEvidenceSetFingerprint:
            preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
          created: false,
          executionJobRunRequestFingerprint,
          executionQueueRequestFingerprint,
          executionResultRequestFingerprint,
          executionRetryPolicyRequestFingerprint,
          executionRunStepCompletionRequestFingerprint,
          executionRunStepRequestFingerprint,
          executionRunStepResultRequestFingerprint,
          executionRunStepRetryAttemptCompletionRequestFingerprint,
          executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint,
          executionRunStepRetryAttemptFinalizationRequestFingerprint,
          executionRunStepRetryAttemptRequestFingerprint,
          executionRunStepRetryAttemptResultRequestFingerprint,
          executionRunStepRetryAttemptStatusEventRequestFingerprint,
          executionRunStepRetryAttemptTraceRequestFingerprint,
          executionRunStepRetryRequestFingerprint,
          executionRunStepStatusEventRequestFingerprint,
          executionRunStepTraceRequestFingerprint,
          executionStartRequestFingerprint,
          executionStateRequestFingerprint,
          executionStatusPollRequestFingerprint,
          executionTraceRequestFingerprint,
          executionWorkerLeaseRequestFingerprint,
          idempotencyLockFingerprint,
          inputs:
            executionRunStepRetryAttemptFinalizationStatusEventRequestInputs,
          operationSetFingerprint: input.submission.operationSetFingerprint,
          repairJobRequestFingerprint,
          requestStatus,
          rollbackPlanRequestFingerprint,
          status:
            executionRunStepRetryAttemptFinalizationStatusEventRequestStatus,
          submissionFingerprint: preflight.currentSubmissionFingerprint,
          targetLocatorFingerprint: preflight.targetLocatorFingerprint,
          version:
            executionRunStepRetryAttemptFinalizationStatusEventRequestVersion,
          workspaceId: preflight.workspaceId ?? null,
        })
      )
      .digest('hex')
      .slice(0, 16);
  const executionRunStepRetryAttemptCloseRequestVersion =
    'repair-execution-run-step-retry-attempt-close-request/v1';
  const executionRunStepRetryAttemptCloseRequestStatus = 'not_closed_read_only';
  const executionRunStepRetryAttemptCloseRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRunStepCompletionRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepResultRequestFingerprint',
    'executionRunStepRetryAttemptCompletionRequestFingerprint',
    'executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptFinalizationRequestFingerprint',
    'executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptRequestFingerprint',
    'executionRunStepRetryAttemptResultRequestFingerprint',
    'executionRunStepRetryAttemptStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptTraceRequestFingerprint',
    'executionRunStepRetryRequestFingerprint',
    'executionRunStepStatusEventRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepRetryAttemptCloseRequestFingerprint = createHash(
    'sha256'
  )
    .update(
      stableRepairRecommendationStringify({
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        closed: false,
        executionJobRunRequestFingerprint,
        executionQueueRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionRunStepCompletionRequestFingerprint,
        executionRunStepRequestFingerprint,
        executionRunStepResultRequestFingerprint,
        executionRunStepRetryAttemptCompletionRequestFingerprint,
        executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint,
        executionRunStepRetryAttemptFinalizationRequestFingerprint,
        executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint,
        executionRunStepRetryAttemptRequestFingerprint,
        executionRunStepRetryAttemptResultRequestFingerprint,
        executionRunStepRetryAttemptStatusEventRequestFingerprint,
        executionRunStepRetryAttemptTraceRequestFingerprint,
        executionRunStepRetryRequestFingerprint,
        executionRunStepStatusEventRequestFingerprint,
        executionRunStepTraceRequestFingerprint,
        executionStartRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        executionTraceRequestFingerprint,
        executionWorkerLeaseRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRunStepRetryAttemptCloseRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRunStepRetryAttemptCloseRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRunStepRetryAttemptCloseRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const executionRunStepRetryAttemptCloseStatusEventRequestVersion =
    'repair-execution-run-step-retry-attempt-close-status-event-request/v1';
  const executionRunStepRetryAttemptCloseStatusEventRequestStatus =
    'not_recorded_read_only';
  const executionRunStepRetryAttemptCloseStatusEventRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRunStepCompletionRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepResultRequestFingerprint',
    'executionRunStepRetryAttemptCloseRequestFingerprint',
    'executionRunStepRetryAttemptCompletionRequestFingerprint',
    'executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptFinalizationRequestFingerprint',
    'executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptRequestFingerprint',
    'executionRunStepRetryAttemptResultRequestFingerprint',
    'executionRunStepRetryAttemptStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptTraceRequestFingerprint',
    'executionRunStepRetryRequestFingerprint',
    'executionRunStepStatusEventRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepRetryAttemptCloseStatusEventRequestFingerprint =
    createHash('sha256')
      .update(
        stableRepairRecommendationStringify({
          auditEventRequestFingerprint,
          candidateEvidenceSetFingerprint:
            preflight.candidateEvidenceSetFingerprint,
          taskRouteEffectiveSourceEvidenceSetFingerprint:
            preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
          created: false,
          executionJobRunRequestFingerprint,
          executionQueueRequestFingerprint,
          executionResultRequestFingerprint,
          executionRetryPolicyRequestFingerprint,
          executionRunStepCompletionRequestFingerprint,
          executionRunStepRequestFingerprint,
          executionRunStepResultRequestFingerprint,
          executionRunStepRetryAttemptCloseRequestFingerprint,
          executionRunStepRetryAttemptCompletionRequestFingerprint,
          executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint,
          executionRunStepRetryAttemptFinalizationRequestFingerprint,
          executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint,
          executionRunStepRetryAttemptRequestFingerprint,
          executionRunStepRetryAttemptResultRequestFingerprint,
          executionRunStepRetryAttemptStatusEventRequestFingerprint,
          executionRunStepRetryAttemptTraceRequestFingerprint,
          executionRunStepRetryRequestFingerprint,
          executionRunStepStatusEventRequestFingerprint,
          executionRunStepTraceRequestFingerprint,
          executionStartRequestFingerprint,
          executionStateRequestFingerprint,
          executionStatusPollRequestFingerprint,
          executionTraceRequestFingerprint,
          executionWorkerLeaseRequestFingerprint,
          idempotencyLockFingerprint,
          inputs: executionRunStepRetryAttemptCloseStatusEventRequestInputs,
          operationSetFingerprint: input.submission.operationSetFingerprint,
          repairJobRequestFingerprint,
          requestStatus,
          rollbackPlanRequestFingerprint,
          status: executionRunStepRetryAttemptCloseStatusEventRequestStatus,
          submissionFingerprint: preflight.currentSubmissionFingerprint,
          targetLocatorFingerprint: preflight.targetLocatorFingerprint,
          version: executionRunStepRetryAttemptCloseStatusEventRequestVersion,
          workspaceId: preflight.workspaceId ?? null,
        })
      )
      .digest('hex')
      .slice(0, 16);
  const executionRunStepRetryAttemptRetentionPolicyRequestVersion =
    'repair-execution-run-step-retry-attempt-retention-policy-request/v1';
  const executionRunStepRetryAttemptRetentionPolicyRequestStatus =
    'not_created_read_only';
  const executionRunStepRetryAttemptRetentionPolicyRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRunStepCompletionRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepResultRequestFingerprint',
    'executionRunStepRetryAttemptCloseRequestFingerprint',
    'executionRunStepRetryAttemptCloseStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptCompletionRequestFingerprint',
    'executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptFinalizationRequestFingerprint',
    'executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptRequestFingerprint',
    'executionRunStepRetryAttemptResultRequestFingerprint',
    'executionRunStepRetryAttemptStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptTraceRequestFingerprint',
    'executionRunStepRetryRequestFingerprint',
    'executionRunStepStatusEventRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepRetryAttemptRetentionPolicyRequestFingerprint =
    createHash('sha256')
      .update(
        stableRepairRecommendationStringify({
          auditEventRequestFingerprint,
          candidateEvidenceSetFingerprint:
            preflight.candidateEvidenceSetFingerprint,
          taskRouteEffectiveSourceEvidenceSetFingerprint:
            preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
          created: false,
          executionJobRunRequestFingerprint,
          executionQueueRequestFingerprint,
          executionResultRequestFingerprint,
          executionRetryPolicyRequestFingerprint,
          executionRunStepCompletionRequestFingerprint,
          executionRunStepRequestFingerprint,
          executionRunStepResultRequestFingerprint,
          executionRunStepRetryAttemptCloseRequestFingerprint,
          executionRunStepRetryAttemptCloseStatusEventRequestFingerprint,
          executionRunStepRetryAttemptCompletionRequestFingerprint,
          executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint,
          executionRunStepRetryAttemptFinalizationRequestFingerprint,
          executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint,
          executionRunStepRetryAttemptRequestFingerprint,
          executionRunStepRetryAttemptResultRequestFingerprint,
          executionRunStepRetryAttemptStatusEventRequestFingerprint,
          executionRunStepRetryAttemptTraceRequestFingerprint,
          executionRunStepRetryRequestFingerprint,
          executionRunStepStatusEventRequestFingerprint,
          executionRunStepTraceRequestFingerprint,
          executionStartRequestFingerprint,
          executionStateRequestFingerprint,
          executionStatusPollRequestFingerprint,
          executionTraceRequestFingerprint,
          executionWorkerLeaseRequestFingerprint,
          idempotencyLockFingerprint,
          inputs: executionRunStepRetryAttemptRetentionPolicyRequestInputs,
          operationSetFingerprint: input.submission.operationSetFingerprint,
          repairJobRequestFingerprint,
          requestStatus,
          rollbackPlanRequestFingerprint,
          status: executionRunStepRetryAttemptRetentionPolicyRequestStatus,
          submissionFingerprint: preflight.currentSubmissionFingerprint,
          targetLocatorFingerprint: preflight.targetLocatorFingerprint,
          version: executionRunStepRetryAttemptRetentionPolicyRequestVersion,
          workspaceId: preflight.workspaceId ?? null,
        })
      )
      .digest('hex')
      .slice(0, 16);
  const executionRunStepRetryAttemptRetentionPolicyRuleRequestVersion =
    'repair-execution-run-step-retry-attempt-retention-policy-rule-request/v1';
  const executionRunStepRetryAttemptRetentionPolicyRuleRequestStatus =
    'not_created_read_only';
  const executionRunStepRetryAttemptRetentionPolicyRuleRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRunStepCompletionRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepResultRequestFingerprint',
    'executionRunStepRetryAttemptCloseRequestFingerprint',
    'executionRunStepRetryAttemptCloseStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptCompletionRequestFingerprint',
    'executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptFinalizationRequestFingerprint',
    'executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptRequestFingerprint',
    'executionRunStepRetryAttemptRetentionPolicyRequestFingerprint',
    'executionRunStepRetryAttemptResultRequestFingerprint',
    'executionRunStepRetryAttemptStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptTraceRequestFingerprint',
    'executionRunStepRetryRequestFingerprint',
    'executionRunStepStatusEventRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepRetryAttemptRetentionPolicyRuleRequestFingerprint =
    createHash('sha256')
      .update(
        stableRepairRecommendationStringify({
          auditEventRequestFingerprint,
          candidateEvidenceSetFingerprint:
            preflight.candidateEvidenceSetFingerprint,
          taskRouteEffectiveSourceEvidenceSetFingerprint:
            preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
          created: false,
          executionJobRunRequestFingerprint,
          executionQueueRequestFingerprint,
          executionResultRequestFingerprint,
          executionRetryPolicyRequestFingerprint,
          executionRunStepCompletionRequestFingerprint,
          executionRunStepRequestFingerprint,
          executionRunStepResultRequestFingerprint,
          executionRunStepRetryAttemptCloseRequestFingerprint,
          executionRunStepRetryAttemptCloseStatusEventRequestFingerprint,
          executionRunStepRetryAttemptCompletionRequestFingerprint,
          executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint,
          executionRunStepRetryAttemptFinalizationRequestFingerprint,
          executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint,
          executionRunStepRetryAttemptRequestFingerprint,
          executionRunStepRetryAttemptRetentionPolicyRequestFingerprint,
          executionRunStepRetryAttemptResultRequestFingerprint,
          executionRunStepRetryAttemptStatusEventRequestFingerprint,
          executionRunStepRetryAttemptTraceRequestFingerprint,
          executionRunStepRetryRequestFingerprint,
          executionRunStepStatusEventRequestFingerprint,
          executionRunStepTraceRequestFingerprint,
          executionStartRequestFingerprint,
          executionStateRequestFingerprint,
          executionStatusPollRequestFingerprint,
          executionTraceRequestFingerprint,
          executionWorkerLeaseRequestFingerprint,
          idempotencyLockFingerprint,
          inputs: executionRunStepRetryAttemptRetentionPolicyRuleRequestInputs,
          operationSetFingerprint: input.submission.operationSetFingerprint,
          repairJobRequestFingerprint,
          requestStatus,
          rollbackPlanRequestFingerprint,
          status: executionRunStepRetryAttemptRetentionPolicyRuleRequestStatus,
          submissionFingerprint: preflight.currentSubmissionFingerprint,
          targetLocatorFingerprint: preflight.targetLocatorFingerprint,
          version:
            executionRunStepRetryAttemptRetentionPolicyRuleRequestVersion,
          workspaceId: preflight.workspaceId ?? null,
        })
      )
      .digest('hex')
      .slice(0, 16);
  const executionRunStepRetryAttemptRetentionLeaseRequestVersion =
    'repair-execution-run-step-retry-attempt-retention-lease-request/v1';
  const executionRunStepRetryAttemptRetentionLeaseRequestStatus =
    'not_acquired_read_only';
  const executionRunStepRetryAttemptRetentionLeaseRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRunStepCompletionRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepResultRequestFingerprint',
    'executionRunStepRetryAttemptCloseRequestFingerprint',
    'executionRunStepRetryAttemptCloseStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptCompletionRequestFingerprint',
    'executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptFinalizationRequestFingerprint',
    'executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptRequestFingerprint',
    'executionRunStepRetryAttemptRetentionPolicyRequestFingerprint',
    'executionRunStepRetryAttemptRetentionPolicyRuleRequestFingerprint',
    'executionRunStepRetryAttemptResultRequestFingerprint',
    'executionRunStepRetryAttemptStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptTraceRequestFingerprint',
    'executionRunStepRetryRequestFingerprint',
    'executionRunStepStatusEventRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepRetryAttemptRetentionLeaseRequestFingerprint =
    createHash('sha256')
      .update(
        stableRepairRecommendationStringify({
          acquired: false,
          auditEventRequestFingerprint,
          candidateEvidenceSetFingerprint:
            preflight.candidateEvidenceSetFingerprint,
          taskRouteEffectiveSourceEvidenceSetFingerprint:
            preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
          executionJobRunRequestFingerprint,
          executionQueueRequestFingerprint,
          executionResultRequestFingerprint,
          executionRetryPolicyRequestFingerprint,
          executionRunStepCompletionRequestFingerprint,
          executionRunStepRequestFingerprint,
          executionRunStepResultRequestFingerprint,
          executionRunStepRetryAttemptCloseRequestFingerprint,
          executionRunStepRetryAttemptCloseStatusEventRequestFingerprint,
          executionRunStepRetryAttemptCompletionRequestFingerprint,
          executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint,
          executionRunStepRetryAttemptFinalizationRequestFingerprint,
          executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint,
          executionRunStepRetryAttemptRequestFingerprint,
          executionRunStepRetryAttemptRetentionPolicyRequestFingerprint,
          executionRunStepRetryAttemptRetentionPolicyRuleRequestFingerprint,
          executionRunStepRetryAttemptResultRequestFingerprint,
          executionRunStepRetryAttemptStatusEventRequestFingerprint,
          executionRunStepRetryAttemptTraceRequestFingerprint,
          executionRunStepRetryRequestFingerprint,
          executionRunStepStatusEventRequestFingerprint,
          executionRunStepTraceRequestFingerprint,
          executionStartRequestFingerprint,
          executionStateRequestFingerprint,
          executionStatusPollRequestFingerprint,
          executionTraceRequestFingerprint,
          executionWorkerLeaseRequestFingerprint,
          idempotencyLockFingerprint,
          inputs: executionRunStepRetryAttemptRetentionLeaseRequestInputs,
          operationSetFingerprint: input.submission.operationSetFingerprint,
          repairJobRequestFingerprint,
          requestStatus,
          rollbackPlanRequestFingerprint,
          status: executionRunStepRetryAttemptRetentionLeaseRequestStatus,
          submissionFingerprint: preflight.currentSubmissionFingerprint,
          targetLocatorFingerprint: preflight.targetLocatorFingerprint,
          version: executionRunStepRetryAttemptRetentionLeaseRequestVersion,
          workspaceId: preflight.workspaceId ?? null,
        })
      )
      .digest('hex')
      .slice(0, 16);
  const executionRunStepRetryAttemptArchiveRequestVersion =
    'repair-execution-run-step-retry-attempt-archive-request/v1';
  const executionRunStepRetryAttemptArchiveRequestStatus =
    'not_archived_read_only';
  const executionRunStepRetryAttemptArchiveRequestInputs = [
    'auditEventRequestFingerprint',
    'candidateEvidenceSetFingerprint',
    'taskRouteEffectiveSourceEvidenceSetFingerprint',
    'executionJobRunRequestFingerprint',
    'executionQueueRequestFingerprint',
    'executionResultRequestFingerprint',
    'executionRetryPolicyRequestFingerprint',
    'executionRunStepCompletionRequestFingerprint',
    'executionRunStepRequestFingerprint',
    'executionRunStepResultRequestFingerprint',
    'executionRunStepRetryAttemptCloseRequestFingerprint',
    'executionRunStepRetryAttemptCloseStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptCompletionRequestFingerprint',
    'executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptFinalizationRequestFingerprint',
    'executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptRequestFingerprint',
    'executionRunStepRetryAttemptRetentionLeaseRequestFingerprint',
    'executionRunStepRetryAttemptRetentionPolicyRequestFingerprint',
    'executionRunStepRetryAttemptRetentionPolicyRuleRequestFingerprint',
    'executionRunStepRetryAttemptResultRequestFingerprint',
    'executionRunStepRetryAttemptStatusEventRequestFingerprint',
    'executionRunStepRetryAttemptTraceRequestFingerprint',
    'executionRunStepRetryRequestFingerprint',
    'executionRunStepStatusEventRequestFingerprint',
    'executionRunStepTraceRequestFingerprint',
    'executionStartRequestFingerprint',
    'executionStateRequestFingerprint',
    'executionStatusPollRequestFingerprint',
    'executionTraceRequestFingerprint',
    'executionWorkerLeaseRequestFingerprint',
    'idempotencyLockFingerprint',
    'operationSetFingerprint',
    'repairJobRequestFingerprint',
    'requestStatus',
    'rollbackPlanRequestFingerprint',
    'submissionFingerprint',
    'targetLocatorFingerprint',
    'workspaceId',
  ].sort();
  const executionRunStepRetryAttemptArchiveRequestFingerprint = createHash(
    'sha256'
  )
    .update(
      stableRepairRecommendationStringify({
        archived: false,
        auditEventRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        executionJobRunRequestFingerprint,
        executionQueueRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionRunStepCompletionRequestFingerprint,
        executionRunStepRequestFingerprint,
        executionRunStepResultRequestFingerprint,
        executionRunStepRetryAttemptCloseRequestFingerprint,
        executionRunStepRetryAttemptCloseStatusEventRequestFingerprint,
        executionRunStepRetryAttemptCompletionRequestFingerprint,
        executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint,
        executionRunStepRetryAttemptFinalizationRequestFingerprint,
        executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint,
        executionRunStepRetryAttemptRequestFingerprint,
        executionRunStepRetryAttemptRetentionLeaseRequestFingerprint,
        executionRunStepRetryAttemptRetentionPolicyRequestFingerprint,
        executionRunStepRetryAttemptRetentionPolicyRuleRequestFingerprint,
        executionRunStepRetryAttemptResultRequestFingerprint,
        executionRunStepRetryAttemptStatusEventRequestFingerprint,
        executionRunStepRetryAttemptTraceRequestFingerprint,
        executionRunStepRetryRequestFingerprint,
        executionRunStepStatusEventRequestFingerprint,
        executionRunStepTraceRequestFingerprint,
        executionStartRequestFingerprint,
        executionStateRequestFingerprint,
        executionStatusPollRequestFingerprint,
        executionTraceRequestFingerprint,
        executionWorkerLeaseRequestFingerprint,
        idempotencyLockFingerprint,
        inputs: executionRunStepRetryAttemptArchiveRequestInputs,
        operationSetFingerprint: input.submission.operationSetFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanRequestFingerprint,
        status: executionRunStepRetryAttemptArchiveRequestStatus,
        submissionFingerprint: preflight.currentSubmissionFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        version: executionRunStepRetryAttemptArchiveRequestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const requestFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        executionApprovalDecisionRequestFingerprint,
        approvalRecordRequestFingerprint,
        auditEventRequestFingerprint,
        executionApprovalUiRequestFingerprint,
        executionCompletionEventRequestFingerprint,
        executionCompletionRequestFingerprint,
        executionDiffPreviewRequestFingerprint,
        executionFinalizationEventRequestFingerprint,
        executionFinalizationRequestFingerprint,
        executionFailureEventRequestFingerprint,
        executionJobRunRequestFingerprint,
        executionOperationEntryRequestFingerprint,
        executionProviderResponseRequestFingerprint,
        executionQueueRequestFingerprint,
        executionResultRequestFingerprint,
        executionRetryPolicyRequestFingerprint,
        executionRollbackExecutorRequestFingerprint,
        executionRollbackOperationRequestFingerprint,
        executionRollbackOutcomeRequestFingerprint,
        executionRollbackTriggerRequestFingerprint,
        executionRunStepCompletionRequestFingerprint,
        executionRunStepRequestFingerprint,
        executionRunStepResultRequestFingerprint,
        executionRunStepRetryAttemptArchiveRequestFingerprint,
        executionRunStepRetryAttemptCloseRequestFingerprint,
        executionRunStepRetryAttemptCloseStatusEventRequestFingerprint,
        executionRunStepRetryAttemptCompletionRequestFingerprint,
        executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint,
        executionRunStepRetryAttemptFinalizationRequestFingerprint,
        executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint,
        executionRunStepRetryAttemptRequestFingerprint,
        executionRunStepRetryAttemptRetentionLeaseRequestFingerprint,
        executionRunStepRetryAttemptRetentionPolicyRequestFingerprint,
        executionRunStepRetryAttemptRetentionPolicyRuleRequestFingerprint,
        executionRunStepRetryAttemptResultRequestFingerprint,
        executionRunStepRetryAttemptStatusEventRequestFingerprint,
        executionRunStepRetryAttemptTraceRequestFingerprint,
        executionRunStepRetryRequestFingerprint,
        executionRunStepStatusEventRequestFingerprint,
        executionRunStepTraceRequestFingerprint,
        executionStartRequestFingerprint,
        executionStatusPollRequestFingerprint,
        executionWorkerLeaseRequestFingerprint,
        candidateEvidenceSetFingerprint:
          preflight.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
        embeddingIndexContractEvidenceSetFingerprint:
          preflight.embeddingIndexContractEvidenceSetFingerprint,
        preparedRouteOrderEvidenceSetFingerprint:
          preflight.preparedRouteOrderEvidenceSetFingerprint,
        rerankRuntimeContractEvidenceSetFingerprint:
          preflight.rerankRuntimeContractEvidenceSetFingerprint,
        executionGateFingerprint: preflight.executionGateFingerprint,
        executionStateRequestFingerprint,
        expectedTaskRouteEffectiveSourceEvidenceSetFingerprint:
          input.expectedTaskRouteEffectiveSourceEvidenceSetFingerprint,
        expectedEmbeddingIndexContractEvidenceSetFingerprint:
          input.expectedEmbeddingIndexContractEvidenceSetFingerprint,
        expectedRerankRuntimeContractEvidenceSetFingerprint:
          input.expectedRerankRuntimeContractEvidenceSetFingerprint,
        expectedRepairGateManifestExportPolicyFingerprint:
          input.expectedRepairGateManifestExportPolicyFingerprint,
        expectedRepairGateManifestFingerprint:
          input.expectedRepairGateManifestFingerprint,
        expectedRepairGateManifestRetentionPolicyFingerprint:
          input.expectedRepairGateManifestRetentionPolicyFingerprint,
        expectedTargetLocatorFingerprint:
          input.expectedTargetLocatorFingerprint,
        idempotencyLockFingerprint,
        inputs: requestInputs,
        matchedFields,
        mismatchedFields,
        preflightStatus: preflight.status,
        readOnly: true,
        repairJobFingerprint: preflight.repairJobFingerprint,
        repairJobRequestFingerprint,
        requestStatus,
        rollbackPlanFingerprint: preflight.rollbackPlanFingerprint,
        rollbackPlanRequestFingerprint,
        supportBundleSignedUrlRequestFingerprint,
        supportBundleArtifactRecordRequestFingerprint,
        supportBundleArtifactFingerprint,
        supportBundleArchiveRequestFingerprint,
        supportBundleArchiveSignatureRequestFingerprint,
        supportBundleAuditPersistenceRequestFingerprint,
        supportBundleDownloadAuthorizationRequestFingerprint,
        supportBundleDownloadResolverRequestFingerprint,
        supportBundlePackageFingerprint,
        supportBundleRetentionCleanupRequestFingerprint,
        supportBundleStorageKeyRequestFingerprint,
        targetLocatorFingerprint: preflight.targetLocatorFingerprint,
        executionTraceRequestFingerprint,
        version: requestVersion,
        workspaceId: preflight.workspaceId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);

  return {
    accepted: false,
    executionRequested: false,
    expectedCandidateEvidenceSetFingerprint:
      input.expectedCandidateEvidenceSetFingerprint,
    expectedTaskRouteEffectiveSourceEvidenceSetFingerprint:
      input.expectedTaskRouteEffectiveSourceEvidenceSetFingerprint,
    expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs: [
      ...COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_EVIDENCE_SET_FINGERPRINT_INPUTS,
    ],
    expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion:
      COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_EVIDENCE_SET_FINGERPRINT_VERSION,
    expectedEmbeddingIndexContractEvidenceSetFingerprint:
      input.expectedEmbeddingIndexContractEvidenceSetFingerprint,
    expectedRerankRuntimeContractEvidenceSetFingerprint:
      input.expectedRerankRuntimeContractEvidenceSetFingerprint,
    expectedPreparedRouteOrderEvidenceSetFingerprint:
      input.expectedPreparedRouteOrderEvidenceSetFingerprint,
    expectedTargetLocatorFingerprint: input.expectedTargetLocatorFingerprint,
    expectedRepairGateManifestFingerprint:
      input.expectedRepairGateManifestFingerprint,
    expectedRepairGateManifestExportPolicyFingerprint:
      input.expectedRepairGateManifestExportPolicyFingerprint,
    expectedRepairGateManifestRetentionPolicyFingerprint:
      input.expectedRepairGateManifestRetentionPolicyFingerprint,
    approvalRecordRequestCreated: false,
    approvalRecordRequestFingerprint,
    approvalRecordRequestInputs,
    approvalRecordRequestStatus,
    approvalRecordRequestVersion,
    auditEventRequestCreated: false,
    auditEventRequestFingerprint,
    auditEventRequestInputs,
    auditEventRequestStatus,
    auditEventRequestVersion,
    executionCompletionEventRequestCreated: false,
    executionCompletionEventRequestFingerprint,
    executionCompletionEventRequestInputs,
    executionCompletionEventRequestStatus,
    executionCompletionEventRequestVersion,
    executionCompletionRequestCreated: false,
    executionCompletionRequestFingerprint,
    executionCompletionRequestInputs,
    executionCompletionRequestStatus,
    executionCompletionRequestVersion,
    executionFinalizationEventRequestCreated: false,
    executionFinalizationEventRequestFingerprint,
    executionFinalizationEventRequestInputs,
    executionFinalizationEventRequestStatus,
    executionFinalizationEventRequestVersion,
    executionFinalizationRequestCreated: false,
    executionFinalizationRequestFingerprint,
    executionFinalizationRequestInputs,
    executionFinalizationRequestStatus,
    executionFinalizationRequestVersion,
    executionStatusPollRequestCreated: false,
    executionStatusPollRequestFingerprint,
    executionStatusPollRequestInputs,
    executionStatusPollRequestStatus,
    executionStatusPollRequestVersion,
    executionOperationEntryRequestCreated: false,
    executionOperationEntryRequestFingerprint,
    executionOperationEntryRequestInputs,
    executionOperationEntryRequestStatus,
    executionOperationEntryRequestVersion,
    executionApprovalUiRequestCreated: false,
    executionApprovalUiRequestFingerprint,
    executionApprovalUiRequestInputs,
    executionApprovalUiRequestStatus,
    executionApprovalUiRequestVersion,
    executionDiffPreviewRequestCreated: false,
    executionDiffPreviewRequestFingerprint,
    executionDiffPreviewRequestInputs,
    executionDiffPreviewRequestStatus,
    executionDiffPreviewRequestVersion,
    executionApprovalDecisionRequestCreated: false,
    executionApprovalDecisionRequestFingerprint,
    executionApprovalDecisionRequestInputs,
    executionApprovalDecisionRequestStatus,
    executionApprovalDecisionRequestVersion,
    executionStartRequestCreated: false,
    executionStartRequestFingerprint,
    executionStartRequestInputs,
    executionStartRequestStatus,
    executionStartRequestVersion,
    executionQueueRequestCreated: false,
    executionQueueRequestFingerprint,
    executionQueueRequestInputs,
    executionQueueRequestStatus,
    executionQueueRequestVersion,
    executionWorkerLeaseRequestCreated: false,
    executionWorkerLeaseRequestFingerprint,
    executionWorkerLeaseRequestInputs,
    executionWorkerLeaseRequestStatus,
    executionWorkerLeaseRequestVersion,
    executionJobRunRequestCreated: false,
    executionJobRunRequestFingerprint,
    executionJobRunRequestInputs,
    executionJobRunRequestStatus,
    executionJobRunRequestVersion,
    executionRunStepRequestCreated: false,
    executionRunStepRequestFingerprint,
    executionRunStepRequestInputs,
    executionRunStepRequestStatus,
    executionRunStepRequestVersion,
    executionRunStepTraceRequestCreated: false,
    executionRunStepTraceRequestFingerprint,
    executionRunStepTraceRequestInputs,
    executionRunStepTraceRequestStatus,
    executionRunStepTraceRequestVersion,
    executionRunStepResultRequestCreated: false,
    executionRunStepResultRequestFingerprint,
    executionRunStepResultRequestInputs,
    executionRunStepResultRequestStatus,
    executionRunStepResultRequestVersion,
    executionRunStepCompletionRequestCreated: false,
    executionRunStepCompletionRequestFingerprint,
    executionRunStepCompletionRequestInputs,
    executionRunStepCompletionRequestStatus,
    executionRunStepCompletionRequestVersion,
    executionRunStepStatusEventRequestCreated: false,
    executionRunStepStatusEventRequestFingerprint,
    executionRunStepStatusEventRequestInputs,
    executionRunStepStatusEventRequestStatus,
    executionRunStepStatusEventRequestVersion,
    executionRunStepRetryRequestCreated: false,
    executionRunStepRetryRequestFingerprint,
    executionRunStepRetryRequestInputs,
    executionRunStepRetryRequestStatus,
    executionRunStepRetryRequestVersion,
    executionRunStepRetryAttemptRequestCreated: false,
    executionRunStepRetryAttemptRequestFingerprint,
    executionRunStepRetryAttemptRequestInputs,
    executionRunStepRetryAttemptRequestStatus,
    executionRunStepRetryAttemptRequestVersion,
    executionRunStepRetryAttemptStatusEventRequestCreated: false,
    executionRunStepRetryAttemptStatusEventRequestFingerprint,
    executionRunStepRetryAttemptStatusEventRequestInputs,
    executionRunStepRetryAttemptStatusEventRequestStatus,
    executionRunStepRetryAttemptStatusEventRequestVersion,
    executionRunStepRetryAttemptTraceRequestCreated: false,
    executionRunStepRetryAttemptTraceRequestFingerprint,
    executionRunStepRetryAttemptTraceRequestInputs,
    executionRunStepRetryAttemptTraceRequestStatus,
    executionRunStepRetryAttemptTraceRequestVersion,
    executionRunStepRetryAttemptResultRequestCreated: false,
    executionRunStepRetryAttemptResultRequestFingerprint,
    executionRunStepRetryAttemptResultRequestInputs,
    executionRunStepRetryAttemptResultRequestStatus,
    executionRunStepRetryAttemptResultRequestVersion,
    executionRunStepRetryAttemptCompletionRequestCreated: false,
    executionRunStepRetryAttemptCompletionRequestFingerprint,
    executionRunStepRetryAttemptCompletionRequestInputs,
    executionRunStepRetryAttemptCompletionRequestStatus,
    executionRunStepRetryAttemptCompletionRequestVersion,
    executionRunStepRetryAttemptCompletionStatusEventRequestCreated: false,
    executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint,
    executionRunStepRetryAttemptCompletionStatusEventRequestInputs,
    executionRunStepRetryAttemptCompletionStatusEventRequestStatus,
    executionRunStepRetryAttemptCompletionStatusEventRequestVersion,
    executionRunStepRetryAttemptFinalizationRequestCreated: false,
    executionRunStepRetryAttemptFinalizationRequestFingerprint,
    executionRunStepRetryAttemptFinalizationRequestInputs,
    executionRunStepRetryAttemptFinalizationRequestStatus,
    executionRunStepRetryAttemptFinalizationRequestVersion,
    executionRunStepRetryAttemptFinalizationStatusEventRequestCreated: false,
    executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint,
    executionRunStepRetryAttemptFinalizationStatusEventRequestInputs,
    executionRunStepRetryAttemptFinalizationStatusEventRequestStatus,
    executionRunStepRetryAttemptFinalizationStatusEventRequestVersion,
    executionRunStepRetryAttemptCloseRequestCreated: false,
    executionRunStepRetryAttemptCloseRequestFingerprint,
    executionRunStepRetryAttemptCloseRequestInputs,
    executionRunStepRetryAttemptCloseRequestStatus,
    executionRunStepRetryAttemptCloseRequestVersion,
    executionRunStepRetryAttemptCloseStatusEventRequestCreated: false,
    executionRunStepRetryAttemptCloseStatusEventRequestFingerprint,
    executionRunStepRetryAttemptCloseStatusEventRequestInputs,
    executionRunStepRetryAttemptCloseStatusEventRequestStatus,
    executionRunStepRetryAttemptCloseStatusEventRequestVersion,
    executionRunStepRetryAttemptRetentionPolicyRequestCreated: false,
    executionRunStepRetryAttemptRetentionPolicyRequestFingerprint,
    executionRunStepRetryAttemptRetentionPolicyRequestInputs,
    executionRunStepRetryAttemptRetentionPolicyRequestStatus,
    executionRunStepRetryAttemptRetentionPolicyRequestVersion,
    executionRunStepRetryAttemptRetentionPolicyRuleRequestCreated: false,
    executionRunStepRetryAttemptRetentionPolicyRuleRequestFingerprint,
    executionRunStepRetryAttemptRetentionPolicyRuleRequestInputs,
    executionRunStepRetryAttemptRetentionPolicyRuleRequestStatus,
    executionRunStepRetryAttemptRetentionPolicyRuleRequestVersion,
    executionRunStepRetryAttemptRetentionLeaseRequestCreated: false,
    executionRunStepRetryAttemptRetentionLeaseRequestFingerprint,
    executionRunStepRetryAttemptRetentionLeaseRequestInputs,
    executionRunStepRetryAttemptRetentionLeaseRequestStatus,
    executionRunStepRetryAttemptRetentionLeaseRequestVersion,
    executionRunStepRetryAttemptArchiveRequestCreated: false,
    executionRunStepRetryAttemptArchiveRequestFingerprint,
    executionRunStepRetryAttemptArchiveRequestInputs,
    executionRunStepRetryAttemptArchiveRequestStatus,
    executionRunStepRetryAttemptArchiveRequestVersion,
    executionFailureEventRequestCreated: false,
    executionFailureEventRequestFingerprint,
    executionFailureEventRequestInputs,
    executionFailureEventRequestStatus,
    executionFailureEventRequestVersion,
    executionProviderResponseRequestCreated: false,
    executionProviderResponseRequestFingerprint,
    executionProviderResponseRequestInputs,
    executionProviderResponseRequestStatus,
    executionProviderResponseRequestVersion,
    executionResultRequestCreated: false,
    executionResultRequestFingerprint,
    executionResultRequestInputs,
    executionResultRequestStatus,
    executionResultRequestVersion,
    executionRetryPolicyRequestCreated: false,
    executionRetryPolicyRequestFingerprint,
    executionRetryPolicyRequestInputs,
    executionRetryPolicyRequestStatus,
    executionRetryPolicyRequestVersion,
    executionRollbackExecutorRequestCreated: false,
    executionRollbackExecutorRequestFingerprint,
    executionRollbackExecutorRequestInputs,
    executionRollbackExecutorRequestStatus,
    executionRollbackExecutorRequestVersion,
    executionRollbackOperationRequestCreated: false,
    executionRollbackOperationRequestFingerprint,
    executionRollbackOperationRequestInputs,
    executionRollbackOperationRequestStatus,
    executionRollbackOperationRequestVersion,
    executionRollbackOutcomeRequestCreated: false,
    executionRollbackOutcomeRequestFingerprint,
    executionRollbackOutcomeRequestInputs,
    executionRollbackOutcomeRequestStatus,
    executionRollbackOutcomeRequestVersion,
    executionRollbackTriggerRequestCreated: false,
    executionRollbackTriggerRequestFingerprint,
    executionRollbackTriggerRequestInputs,
    executionRollbackTriggerRequestStatus,
    executionRollbackTriggerRequestVersion,
    executionTraceRequestCreated: false,
    executionTraceRequestFingerprint,
    executionTraceRequestInputs,
    executionTraceRequestStatus,
    executionTraceRequestVersion,
    executionStateRequestCreated: false,
    executionStateRequestFingerprint,
    executionStateRequestInputs,
    executionStateRequestStatus,
    executionStateRequestVersion,
    idempotencyLockAcquired: false,
    idempotencyLockFingerprint,
    idempotencyLockInputs,
    idempotencyLockScope,
    idempotencyLockStatus,
    idempotencyLockVersion,
    matchedFields,
    mismatchedFields,
    mutationAvailable: false,
    preflight,
    readOnly: true,
    repairJobRequestCreated: false,
    repairJobRequestFingerprint,
    repairJobRequestInputs,
    repairJobRequestStatus,
    repairJobRequestVersion,
    rollbackPlanRequestCreated: false,
    rollbackPlanRequestFingerprint,
    rollbackPlanRequestInputs,
    rollbackPlanRequestStatus,
    rollbackPlanRequestVersion,
    requestFingerprint,
    requestInputs,
    requestStatus,
    requestVersion,
    supportBundleArtifactCreated: false,
    supportBundleArtifactFingerprint,
    supportBundleArtifactInputs,
    supportBundleArtifactRecordRequestCreated: false,
    supportBundleArtifactRecordRequestFingerprint,
    supportBundleArtifactRecordRequestInputs,
    supportBundleArtifactRecordRequestStatus,
    supportBundleArtifactRecordRequestVersion,
    supportBundleArtifactStatus,
    supportBundleArtifactVersion,
    supportBundleArchiveFormat,
    supportBundleArchiveRequestCreated: false,
    supportBundleArchiveRequestFingerprint,
    supportBundleArchiveRequestInputs,
    supportBundleArchiveRequestStatus,
    supportBundleArchiveRequestVersion,
    supportBundleArchiveScope,
    supportBundleArchiveSignaturePolicy,
    supportBundleArchiveSignatureRequestCreated: false,
    supportBundleArchiveSignatureRequestFingerprint,
    supportBundleArchiveSignatureRequestInputs,
    supportBundleArchiveSignatureRequestStatus,
    supportBundleArchiveSignatureRequestVersion,
    supportBundleAuditPersistenceRequestCreated: false,
    supportBundleAuditPersistenceRequestFingerprint,
    supportBundleAuditPersistenceRequestInputs,
    supportBundleAuditPersistenceRequestStatus,
    supportBundleAuditPersistenceRequestVersion,
    supportBundleAuditPersistenceStatus,
    supportBundleDownloadAuthorizationRequestCreated: false,
    supportBundleDownloadAuthorizationRequestFingerprint,
    supportBundleDownloadAuthorizationRequestInputs,
    supportBundleDownloadAuthorizationRequestStatus,
    supportBundleDownloadAuthorizationRequestVersion,
    supportBundleDownloadAuthorizationStatus,
    supportBundleDownloadResolverRequestCreated: false,
    supportBundleDownloadResolverRequestFingerprint,
    supportBundleDownloadResolverRequestInputs,
    supportBundleDownloadResolverRequestStatus,
    supportBundleDownloadResolverRequestVersion,
    supportBundleDownloadResolverRoute,
    supportBundleManifestFilename: repairGateManifestExportMetadata.filename,
    supportBundleManifestFingerprint: repairGateManifest.fingerprint,
    supportBundleManifestMetadataFilename:
      repairGateManifestExportMetadata.metadataFilename,
    supportBundleManifestMetadataFingerprint:
      repairGateManifestExportMetadata.exportPolicyFingerprint,
    supportBundlePackageCreated: false,
    supportBundlePackageFingerprint,
    supportBundlePackageInputs,
    supportBundlePackageStatus,
    supportBundlePackageVersion,
    supportBundleRetentionCleanupRequestCreated: false,
    supportBundleRetentionCleanupRequestFingerprint,
    supportBundleRetentionCleanupRequestInputs,
    supportBundleRetentionCleanupRequestStatus,
    supportBundleRetentionCleanupRequestVersion,
    supportBundleRetentionCleanupStatus,
    supportBundleSignedUrlPolicy,
    supportBundleSignedUrlRequestCreated: false,
    supportBundleSignedUrlRequestFingerprint,
    supportBundleSignedUrlRequestInputs,
    supportBundleSignedUrlRequestStatus,
    supportBundleSignedUrlRequestVersion,
    supportBundleSignedUrlScope,
    supportBundleStorageKeyRequestCreated: false,
    supportBundleStorageKeyRequestFingerprint,
    supportBundleStorageKeyRequestInputs,
    supportBundleStorageKeyRequestStatus,
    supportBundleStorageKeyRequestVersion,
    supportBundleStorageKeyScope,
    supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprint:
      preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
    supportBundleTaskRouteEffectiveSourceEvidenceSetDiagnosticsFingerprints,
    supportBundleTaskRouteEffectiveSourceEvidenceSetEntries,
    supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprintInputs: [
      ...COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_EVIDENCE_SET_FINGERPRINT_INPUTS,
    ],
    supportBundleTaskRouteEffectiveSourceEvidenceSetOperationFingerprints,
    supportBundleTaskRouteEffectiveSourceEvidenceSetSourceFingerprints,
    supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprintVersion:
      COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_EVIDENCE_SET_FINGERPRINT_VERSION,
  };
}

function buildPromptRegistryRepairExecutorPayload(input: {
  current: CopilotPromptRegistryPublishGateVerdictType;
  request: CopilotPromptRegistryRepairExecutionRequest;
}) {
  const preview = input.current.repairActionPreview;
  const fallbackSourceChain = [
    {
      source: 'legacy_registry',
      scope: 'global',
      status: input.current.publishStatus,
      fingerprint: input.current.registryFingerprint,
      registryId: input.current.registryId,
      revision: input.current.registryFingerprint,
      updatedAt: input.current.registryUpdatedAt.toISOString(),
    },
    {
      source: 'repair_execution_request',
      scope: 'workspace',
      status: 'prepared_for_approval',
      fingerprint: input.request.requestFingerprint,
    },
  ];

  return {
    version: 'prompt-registry-revision-executor-payload/v1' as const,
    kind: 'prompt_registry_revision_publish' as const,
    expectedRegistryFingerprint: input.current.registryFingerprint,
    expectedRegistryId: input.current.registryId,
    expectedRegistryUpdatedAt: input.current.registryUpdatedAt.toISOString(),
    operationFingerprints: [...preview.operationFingerprints].sort(),
    operationKinds: uniqueStrings(
      preview.operations.map(operation => operation.actionKind)
    ).sort(),
    operationSetFingerprint: preview.operationSetFingerprint,
    previewFingerprint: preview.previewFingerprint,
    catalogFingerprint: preview.catalogFingerprint,
    fallbackSourceChain,
  };
}

function isTaskRoutePolicyFeatureKind(
  value: string | undefined
): value is TaskRoutePolicyFeatureKind {
  return (
    value === 'embedding' ||
    value === 'workspace_indexing' ||
    value === 'rerank'
  );
}

function configKeyFromTaskRouteFeatureKind(
  featureKind: TaskRoutePolicyFeatureKind
): 'embedding' | 'workspaceIndexing' | 'rerank' {
  if (featureKind === 'workspace_indexing') {
    return 'workspaceIndexing';
  }
  return featureKind;
}

function selectTaskRoutePolicyRepairModelId(
  operation: CopilotPromptRegistryPublishGateRepairActionPreviewOperation
) {
  const candidateModelId = (
    candidate: CopilotPromptRegistryPublishGateRouteCandidate
  ) => {
    if (!candidate.matched) {
      return undefined;
    }
    if (candidate.requestedModelId) {
      return candidate.requestedModelId;
    }
    if (candidate.providerId && candidate.routeModelDefinitionId) {
      return `${candidate.providerId}/${candidate.routeModelDefinitionId}`;
    }
    if (candidate.providerId && candidate.modelId) {
      return `${candidate.providerId}/${candidate.modelId}`;
    }
    return candidate.modelId;
  };

  for (const entry of operation.candidateEvidenceEntries) {
    const matchedCandidate = entry.routeCandidateEntries?.find(
      candidate => candidate.matched && candidateModelId(candidate)
    );
    const matchedModelId = matchedCandidate
      ? candidateModelId(matchedCandidate)
      : undefined;
    if (matchedModelId) {
      return matchedModelId;
    }

    const policyModelId = entry.policyCandidateEntries
      ?.filter(candidate => candidate.allowed && candidate.available)
      .flatMap(candidate =>
        (candidate.providerConfiguredModelIds ?? []).map(
          modelId => `${candidate.providerId}/${modelId}`
        )
      )
      .find(Boolean);
    if (policyModelId) {
      return policyModelId;
    }

    const routeCandidate = entry.routeCandidateEntries?.find(
      candidate => candidate.matched && candidateModelId(candidate)
    );
    const routeModelId = routeCandidate
      ? candidateModelId(routeCandidate)
      : undefined;
    if (routeModelId) {
      return routeModelId;
    }

    const preparedRoute = entry.preparedRouteEntries?.find(
      route => route.modelId
    );
    if (preparedRoute?.providerId && preparedRoute.modelId) {
      return `${preparedRoute.providerId}/${preparedRoute.modelId}`;
    }
    if (preparedRoute?.modelId) {
      return preparedRoute.modelId;
    }
  }

  return operation.targetLocator?.requestedModelId;
}

function buildTaskRoutePolicyRepairExecutorPayload(input: {
  current: CopilotPromptRegistryPublishGateVerdictType;
  request: CopilotPromptRegistryRepairExecutionRequest;
  workspaceId: string;
}) {
  const preview = input.current.repairActionPreview;
  const candidates: {
    featureKind: TaskRoutePolicyFeatureKind;
    modelId: string;
    operation: CopilotPromptRegistryPublishGateRepairActionPreviewOperation;
  }[] = [];
  for (const operation of preview.operations) {
    if (
      operation.actionKind !== 'repair_task_model_route' ||
      operation.targetLocator?.kind !== 'task_route' ||
      !isTaskRoutePolicyFeatureKind(operation.targetLocator.featureKind)
    ) {
      continue;
    }

    const modelId = selectTaskRoutePolicyRepairModelId(operation);
    if (modelId) {
      candidates.push({
        featureKind: operation.targetLocator.featureKind,
        modelId,
        operation,
      });
    }
  }
  const selected =
    candidates.find(
      candidate =>
        candidate.featureKind === 'rerank' &&
        candidate.operation.targetLocator?.requestedModelId
    ) ??
    candidates.find(
      candidate => candidate.operation.targetLocator?.requestedModelId
    ) ??
    candidates.find(candidate => candidate.featureKind === 'rerank') ??
    candidates[0];
  if (!selected) {
    return null;
  }

  const { featureKind, modelId, operation } = selected;
  const targetLocator = operation.targetLocator;
  if (!targetLocator || targetLocator.kind !== 'task_route') {
    return null;
  }

  const configKey =
    targetLocator.requestedModelConfigKey ??
    configKeyFromTaskRouteFeatureKind(featureKind);
  const configPath =
    targetLocator.requestedModelConfigPath ??
    `copilot.tasks.models.${configKey}`;
  const fallbackSourceChain: TaskRoutePolicySourceChainEntry[] = [
    {
      source: targetLocator.requestedModelId
        ? 'config_fallback'
        : 'provider_default',
      scope: 'global',
      status: 'available',
      featureKind,
      ...(targetLocator.requestedModelId
        ? { modelId: targetLocator.requestedModelId }
        : {}),
      configKey: configKey as 'embedding' | 'workspaceIndexing' | 'rerank',
      configPath,
    },
    {
      source: 'config_fallback',
      scope: 'workspace',
      status: 'prepared_for_approval',
      featureKind,
      fingerprint: input.request.requestFingerprint,
      modelId,
      configKey: configKey as 'embedding' | 'workspaceIndexing' | 'rerank',
      configPath,
      workspaceId: input.workspaceId,
    },
  ];

  return {
    version: 'task-route-policy-revision-executor-payload/v1' as const,
    kind: 'task_route_policy_revision_publish' as const,
    featureKind,
    modelId,
    configKey: configKey as 'embedding' | 'workspaceIndexing' | 'rerank',
    configPath,
    operationFingerprint: operation.operationFingerprint,
    operationSetFingerprint: preview.operationSetFingerprint,
    previewFingerprint: preview.previewFingerprint,
    catalogFingerprint: preview.catalogFingerprint,
    targetLocatorFingerprint: operation.targetLocatorFingerprint,
    taskRouteEffectiveSourceFingerprints: [
      ...operation.taskRouteEffectiveSourceFingerprints,
    ].sort(),
    candidateEvidenceFingerprints: [
      ...operation.candidateEvidenceFingerprints,
    ].sort(),
    fallbackSourceChain,
  };
}

function outputTypeToModelDefinitionOutput(
  outputType: string
): ModelOutputType {
  if (outputType === ModelOutputType.Object) {
    return ModelOutputType.Object;
  }
  if (outputType === ModelOutputType.Structured) {
    return ModelOutputType.Structured;
  }
  if (outputType === ModelOutputType.Image) {
    return ModelOutputType.Image;
  }
  if (outputType === ModelOutputType.Embedding) {
    return ModelOutputType.Embedding;
  }
  if (outputType === ModelOutputType.Rerank) {
    return ModelOutputType.Rerank;
  }
  return ModelOutputType.Text;
}

function modelRegistryRepairAliasOutputs(
  outputType: string
): ModelOutputType[] {
  const output = outputTypeToModelDefinitionOutput(outputType);

  return output === ModelOutputType.Object
    ? [ModelOutputType.Object, ModelOutputType.Text]
    : [output];
}

function selectModelRegistryRepairProviderCandidate(
  operation: CopilotPromptRegistryPublishGateRepairActionPreviewOperation
) {
  for (const entry of operation.candidateEvidenceEntries) {
    const policyCandidate = entry.policyCandidateEntries
      ?.filter(candidate => candidate.allowed && candidate.available)
      .find(candidate => candidate.providerConfiguredModelIds?.length);
    const providerModelId = policyCandidate?.providerConfiguredModelIds?.[0];
    if (policyCandidate && providerModelId) {
      return {
        providerId: policyCandidate.providerId,
        providerModelId,
        providerName: policyCandidate.providerName,
        providerProfileSource: policyCandidate.providerProfileSource,
      };
    }

    const routeCandidate = entry.routeCandidateEntries?.find(
      candidate =>
        candidate.matched &&
        candidate.providerId &&
        (candidate.routeModelDefinitionId ||
          candidate.modelId ||
          candidate.requestedModelId)
    );
    const routeProviderModelId =
      routeCandidate?.routeModelDefinitionId ??
      routeCandidate?.modelId ??
      routeCandidate?.requestedModelId;
    if (routeCandidate?.providerId && routeProviderModelId) {
      return {
        providerId: routeCandidate.providerId,
        providerModelId: routeProviderModelId,
        providerName: routeCandidate.providerName,
        providerProfileSource: routeCandidate.providerProfileSource,
      };
    }

    const preparedRoute = entry.preparedRouteEntries?.find(
      route => route.providerId && route.modelId
    );
    if (preparedRoute) {
      return {
        providerId: preparedRoute.providerId,
        providerModelId: preparedRoute.modelId,
        providerName: preparedRoute.providerName,
        providerProfileSource: preparedRoute.providerProfileSource,
      };
    }
  }

  return null;
}

function buildModelRegistryRepairExecutorPayload(input: {
  current: CopilotPromptRegistryPublishGateVerdictType;
  request: CopilotPromptRegistryRepairExecutionRequest;
  workspaceId: string;
}) {
  const preview = input.current.repairActionPreview;
  const operation = preview.operations.find(
    operation =>
      operation.actionKind === 'repair_default_model_route' &&
      operation.targetLocator?.kind === 'model_route' &&
      operation.targetLocator.requestedModelId
  );
  if (!operation?.targetLocator?.requestedModelId) {
    return null;
  }

  const candidate = selectModelRegistryRepairProviderCandidate(operation);
  if (!candidate) {
    return null;
  }

  const modelId = operation.targetLocator.requestedModelId;
  const outputs = modelRegistryRepairAliasOutputs(
    operation.targetLocator.outputType ?? ModelOutputType.Text
  );
  const displayName = `${modelId} (repair alias)`;
  const fallbackSourceChain = [
    {
      source: 'provider_profile' as const,
      scope: 'global' as const,
      status: 'available',
      providerId: candidate.providerId,
      modelId: candidate.providerModelId,
      ...(candidate.providerProfileSource
        ? { revision: candidate.providerProfileSource }
        : {}),
    },
    {
      source: 'config_fallback' as const,
      scope: 'workspace' as const,
      status: 'prepared_for_approval',
      fingerprint: input.request.requestFingerprint,
      providerId: candidate.providerId,
      modelId,
      workspaceId: input.workspaceId,
    },
  ];
  const modelDefinition = {
    id: modelId,
    rawModelId: candidate.providerModelId,
    displayName,
    aliases: [candidate.providerModelId],
    capabilities: [
      {
        input: [ModelInputType.Text],
        output: outputs,
      },
    ],
  };

  return {
    version: 'model-registry-revision-executor-payload/v1' as const,
    kind: 'model_registry_revision_publish' as const,
    providerId: candidate.providerId,
    modelId,
    rawModelId: candidate.providerModelId,
    displayName,
    aliases: [candidate.providerModelId],
    modelDefinition,
    operationFingerprint: operation.operationFingerprint,
    operationSetFingerprint: preview.operationSetFingerprint,
    previewFingerprint: preview.previewFingerprint,
    catalogFingerprint: preview.catalogFingerprint,
    targetLocatorFingerprint: operation.targetLocatorFingerprint,
    candidateEvidenceFingerprints: [
      ...operation.candidateEvidenceFingerprints,
    ].sort(),
    fallbackSourceChain,
  };
}

function buildRepairExecutorPayload(input: {
  current: CopilotPromptRegistryPublishGateVerdictType;
  request: CopilotPromptRegistryRepairExecutionRequest;
  workspaceId: string;
}) {
  return (
    buildTaskRoutePolicyRepairExecutorPayload(input) ??
    buildModelRegistryRepairExecutorPayload(input) ??
    buildPromptRegistryRepairExecutorPayload(input)
  );
}

function promptRegistryPublishGateActionTextResultSchema() {
  return {
    type: 'object',
    properties: {
      result: { type: 'string' },
    },
    required: ['result'],
    additionalProperties: false,
  };
}

function isPromptRegistryPublishGateActionDryRunCandidate(
  prompt: Pick<ResolvedPrompt, 'category' | 'defaultPolicy'> &
    Partial<Pick<ResolvedPrompt, 'action' | 'model' | 'name' | 'config'>>
) {
  return (
    prompt.defaultPolicy === 'structured' ||
    prompt.defaultPolicy === 'image' ||
    prompt.category === 'image' ||
    (prompt.name !== undefined &&
      isImagePromptCategory({ ...prompt, name: prompt.name }))
  );
}

function promptRegistryPublishGateDryRunErrorCode(error: unknown) {
  return error instanceof Error && error.name !== 'Error'
    ? error.name
    : 'action_route_dry_run_failed';
}

function promptRegistryPublishGateActionDryRunDiagnosticsErrorMetadata(
  stage:
    | 'build_image_plan'
    | 'build_structured_plan'
    | 'missing_execution_plan_builder'
    | 'missing_prompt_messages',
  error?: unknown
) {
  const code = error ? promptRegistryPublishGateDryRunErrorCode(error) : stage;
  const message = error
    ? error instanceof Error
      ? error.message
      : 'Unknown dry-run error'
    : stage === 'missing_execution_plan_builder'
      ? 'Action route dry-run requires execution plans.'
      : 'Registry prompt does not expose messages for dry-run.';

  return {
    diagnosticsErrorCode: code,
    diagnosticsErrorMessage: message,
    diagnosticsErrorStage: stage,
  };
}

function toPromptRegistryPublishGateActionRouteDryRunRoute(
  route: ExecutionRouteDiagnostics,
  routeIndex: number,
  fallbackProviderIds: string[]
): CopilotPromptRegistryPublishGateActionRouteDryRunRoute {
  const fallbackOrderIndex = fallbackProviderIds.indexOf(route.providerId);

  return {
    providerId: route.providerId,
    modelId: route.model,
    routeIndex,
    ...(fallbackOrderIndex >= 0 ? { fallbackOrderIndex } : {}),
    protocol: route.protocol,
    requestLayer: route.backendConfig.request_layer,
    ...(route.providerName ? { providerName: route.providerName } : {}),
    ...(route.providerSource ? { providerSource: route.providerSource } : {}),
    ...(route.providerProfileId
      ? { providerProfileId: route.providerProfileId }
      : {}),
    ...(route.providerProfileSource
      ? { providerProfileSource: route.providerProfileSource }
      : {}),
    ...(route.providerProfileConfigPath
      ? { providerProfileConfigPath: route.providerProfileConfigPath }
      : {}),
    ...(route.providerConfiguredModelIds?.length
      ? { providerConfiguredModelIds: route.providerConfiguredModelIds }
      : {}),
    ...(route.providerConfiguredModelCount != null
      ? { providerConfiguredModelCount: route.providerConfiguredModelCount }
      : {}),
    ...(route.providerType ? { providerType: route.providerType } : {}),
    ...(route.providerPrivacy
      ? { providerPrivacy: route.providerPrivacy }
      : {}),
    ...(route.providerHealth ? { providerHealth: route.providerHealth } : {}),
    ...(route.providerHealthCheckedAt
      ? { providerHealthCheckedAt: route.providerHealthCheckedAt }
      : {}),
    ...(route.providerHealthLastError
      ? { providerHealthLastError: route.providerHealthLastError }
      : {}),
    ...(route.providerPriority != null
      ? { providerPriority: route.providerPriority }
      : {}),
    ...(route.routeModelAliasMatched !== undefined
      ? { routeModelAliasMatched: route.routeModelAliasMatched }
      : {}),
    ...(route.routeModelDefinitionAliases?.length
      ? { routeModelDefinitionAliases: route.routeModelDefinitionAliases }
      : {}),
    ...(route.routeModelDefinitionId
      ? { routeModelDefinitionId: route.routeModelDefinitionId }
      : {}),
    ...(route.routeModelDefinitionSource
      ? { routeModelDefinitionSource: route.routeModelDefinitionSource }
      : {}),
    ...(route.routeRawModelId
      ? { routeRawModelId: route.routeRawModelId }
      : {}),
  };
}

function toPromptRegistryPublishGateActionRouteDryRunStep(input: {
  fallbackProviderIds: string[];
  kind: CopilotPromptRegistryPublishGateActionRouteDryRunStep['kind'];
  plan: {
    routeDiagnostics?: ExecutionRouteDiagnostics[];
    routePolicy: { fallbackOrder: string[] };
  };
  requestedModelId?: string;
  requestedModelSource?: string;
  stepId: string;
}): CopilotPromptRegistryPublishGateActionRouteDryRunStep {
  const fallbackProviderIds =
    input.plan.routePolicy.fallbackOrder.length > 0
      ? input.plan.routePolicy.fallbackOrder
      : input.fallbackProviderIds;
  const routes = (input.plan.routeDiagnostics ?? []).map((route, index) =>
    toPromptRegistryPublishGateActionRouteDryRunRoute(
      route,
      index,
      fallbackProviderIds
    )
  );
  const routeCount = fallbackProviderIds.length || routes.length;

  return {
    actualRouteCount: routes.length,
    fallbackProviderIds,
    kind: input.kind,
    ...(input.requestedModelId
      ? { requestedModelId: input.requestedModelId }
      : {}),
    ...(input.requestedModelSource
      ? { requestedModelSource: input.requestedModelSource }
      : {}),
    routeCount,
    routeCountMismatch: routeCount !== routes.length,
    routes,
    stepId: input.stepId,
  };
}

function promptRegistryPublishGateActionDryRunRouteCountSummary(
  steps: CopilotPromptRegistryPublishGateActionRouteDryRunStep[]
): Pick<
  CopilotPromptRegistryPublishGateActionRouteDryRun,
  | 'actualRouteCount'
  | 'expectedRouteCount'
  | 'missingRouteCount'
  | 'routeCountMismatch'
  | 'routeCountMismatchStepIds'
> {
  const actualRouteCount = steps.reduce(
    (sum, step) => sum + step.actualRouteCount,
    0
  );
  const expectedRouteCount = steps.reduce(
    (sum, step) => sum + step.routeCount,
    0
  );
  const routeCountMismatchStepIds = steps
    .filter(step => step.routeCountMismatch || step.actualRouteCount === 0)
    .map(step => step.stepId);

  return {
    actualRouteCount,
    expectedRouteCount,
    missingRouteCount: Math.max(expectedRouteCount - actualRouteCount, 0),
    routeCountMismatch: routeCountMismatchStepIds.length > 0,
    routeCountMismatchStepIds,
  };
}

function promptRegistryPublishGateActionDryRunResult(
  dryRun: Omit<
    CopilotPromptRegistryPublishGateActionRouteDryRun,
    | 'actualRouteCount'
    | 'expectedRouteCount'
    | 'missingRouteCount'
    | 'routeCountMismatch'
    | 'routeCountMismatchStepIds'
  >
): CopilotPromptRegistryPublishGateActionRouteDryRun {
  return {
    ...dryRun,
    ...promptRegistryPublishGateActionDryRunRouteCountSummary(dryRun.steps),
  };
}

function providerProfileConfigPath(
  profile: Pick<ResolvedCopilotProvider['profile'], 'id' | 'source' | 'type'> &
    Pick<
      Partial<ResolvedCopilotProvider['profile']>,
      'providerRegistryRevisionId'
    >
) {
  if (profile.source === 'configured') {
    return `copilot.providers.profiles[id=${profile.id}]`;
  }
  if (profile.source === 'legacy') {
    return `copilot.providers.${profile.type}`;
  }
  if (profile.source === 'db_revision') {
    return profile.providerRegistryRevisionId
      ? `ai_provider_registry_revisions[id=${profile.providerRegistryRevisionId}]`
      : `ai_provider_registry_revisions[provider_id=${profile.id}]`;
  }
  if (profile.source === 'byok_local') {
    return 'workspace.byok.local';
  }
  if (profile.source === 'byok_server') {
    return 'workspace.byok.server';
  }
  return undefined;
}

function resolveProfileModelDefinition(
  profile: ResolvedCopilotProvider['profile'],
  requestedModelId: string,
  routeModelId: string
) {
  return (profile.modelDefinitions ?? []).find(definition => {
    return (
      definition.id === requestedModelId ||
      definition.id === routeModelId ||
      definition.rawModelId === requestedModelId ||
      definition.rawModelId === routeModelId ||
      definition.aliases?.includes(requestedModelId) ||
      definition.aliases?.includes(routeModelId)
    );
  });
}

function resolveModelDefinitionSource(
  profile: ResolvedCopilotProvider['profile'],
  resolvedProviderModel: Partial<ResolvedProviderModel> | undefined,
  profileDefinition: ReturnType<typeof resolveProfileModelDefinition>
): CopilotModelDefinitionSource | undefined {
  if (profileDefinition?.registryRecordSource === 'db_revision') {
    return 'db_revision';
  }
  if (profileDefinition) {
    return 'provider_profile';
  }
  if (resolvedProviderModel?.canonicalKey) {
    return 'native_registry';
  }
  return profile.models?.length ? 'provider_runtime' : undefined;
}

function getProfileConfiguredModelIds(
  profile: ResolvedCopilotProvider['profile']
) {
  return uniqueStrings([
    ...(profile.models ?? []),
    ...(profile.modelDefinitions ?? []).flatMap(model => [
      model.id,
      ...(model.aliases ?? []),
    ]),
  ]);
}

function buildModelListEffectiveSourceFingerprint(
  model: Pick<
    CopilotModelType,
    | 'id'
    | 'promptAction'
    | 'promptCategory'
    | 'promptDefaultPolicy'
    | 'promptModelConfigPath'
    | 'promptModelSource'
    | 'promptModelSources'
    | 'promptName'
    | 'promptOverrideApplied'
    | 'promptSource'
    | 'providerConfiguredModelCount'
    | 'providerConfiguredModelIds'
    | 'providerId'
    | 'providerPrivacy'
    | 'providerPriority'
    | 'providerProfileConfigPath'
    | 'providerProfileId'
    | 'providerProfileSource'
    | 'providerSource'
    | 'providerType'
    | 'registryAvailable'
    | 'registryKind'
    | 'registrySelected'
    | 'routeBackendKind'
    | 'routeCanonicalModelKey'
    | 'routeFallbackProviderIds'
    | 'routeModelAliasMatched'
    | 'routeModelDefinitionAliases'
    | 'routeModelDefinitionId'
    | 'routeModelDefinitionSource'
    | 'modelRegistryRevision'
    | 'modelRegistryRevisionActorId'
    | 'modelRegistryRevisionFingerprint'
    | 'modelRegistryRevisionId'
    | 'modelRegistryRevisionScope'
    | 'modelRegistryRevisionSourceChain'
    | 'modelRegistryRevisionSourceChainFingerprint'
    | 'modelRegistryRevisionStatus'
    | 'modelRegistryRevisionWorkspaceId'
    | 'modelRegistryRevisionPublishEventCount'
    | 'modelRegistryRevisionPublishEvents'
    | 'routeModelId'
    | 'routePolicyAllowedPrivacy'
    | 'routePolicyAllowedProviderIds'
    | 'routePolicyBlockedProviderIds'
    | 'routePolicyEnabled'
    | 'routePolicyFeatureKind'
    | 'routePolicyPreferredPrivacy'
    | 'routePolicyWorkspaceId'
    | 'routeRawModelId'
    | 'sources'
  >
) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        effectiveSourceFingerprintVersion:
          COPILOT_MODEL_LIST_EFFECTIVE_SOURCE_FINGERPRINT_VERSION,
        id: model.id,
        promptAction: model.promptAction ?? null,
        promptCategory: model.promptCategory,
        promptDefaultPolicy: model.promptDefaultPolicy ?? null,
        promptModelConfigPath: model.promptModelConfigPath ?? null,
        promptModelSource: model.promptModelSource ?? null,
        promptModelSources: model.promptModelSources,
        promptName: model.promptName,
        promptOverrideApplied: model.promptOverrideApplied,
        promptSource: model.promptSource,
        providerConfiguredModelCount:
          model.providerConfiguredModelCount ?? null,
        providerConfiguredModelIds: model.providerConfiguredModelIds ?? null,
        providerId: model.providerId ?? null,
        providerPrivacy: model.providerPrivacy ?? null,
        providerPriority: model.providerPriority ?? null,
        providerProfileConfigPath: model.providerProfileConfigPath ?? null,
        providerProfileId: model.providerProfileId ?? null,
        providerProfileSource: model.providerProfileSource ?? null,
        providerSource: model.providerSource ?? null,
        providerType: model.providerType ?? null,
        registryAvailable: model.registryAvailable ?? null,
        registryKind: model.registryKind ?? null,
        registrySelected: model.registrySelected ?? null,
        routeBackendKind: model.routeBackendKind ?? null,
        routeCanonicalModelKey: model.routeCanonicalModelKey ?? null,
        routeFallbackProviderIds: model.routeFallbackProviderIds ?? null,
        routeModelAliasMatched: model.routeModelAliasMatched ?? null,
        routeModelDefinitionAliases: model.routeModelDefinitionAliases ?? null,
        routeModelDefinitionId: model.routeModelDefinitionId ?? null,
        routeModelDefinitionSource: model.routeModelDefinitionSource ?? null,
        modelRegistryRevision: model.modelRegistryRevision ?? null,
        modelRegistryRevisionActorId:
          model.modelRegistryRevisionActorId ?? null,
        modelRegistryRevisionFingerprint:
          model.modelRegistryRevisionFingerprint ?? null,
        modelRegistryRevisionId: model.modelRegistryRevisionId ?? null,
        modelRegistryRevisionScope: model.modelRegistryRevisionScope ?? null,
        modelRegistryRevisionSourceChain:
          model.modelRegistryRevisionSourceChain ?? null,
        modelRegistryRevisionSourceChainFingerprint:
          model.modelRegistryRevisionSourceChainFingerprint ?? null,
        modelRegistryRevisionStatus: model.modelRegistryRevisionStatus ?? null,
        modelRegistryRevisionWorkspaceId:
          model.modelRegistryRevisionWorkspaceId ?? null,
        routeModelId: model.routeModelId ?? null,
        routePolicyAllowedPrivacy: model.routePolicyAllowedPrivacy ?? null,
        routePolicyAllowedProviderIds:
          model.routePolicyAllowedProviderIds ?? null,
        routePolicyBlockedProviderIds:
          model.routePolicyBlockedProviderIds ?? null,
        routePolicyEnabled: model.routePolicyEnabled,
        routePolicyFeatureKind: model.routePolicyFeatureKind ?? null,
        routePolicyPreferredPrivacy: model.routePolicyPreferredPrivacy ?? null,
        routePolicyWorkspaceId: model.routePolicyWorkspaceId ?? null,
        routeRawModelId: model.routeRawModelId ?? null,
        sources: model.sources,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function buildPromptRegistryPublishGateModelRouteEffectiveSourceFingerprint(
  route: Pick<
    CopilotPromptRegistryPublishGateModelRoute,
    | 'candidateConfigPath'
    | 'candidateIndex'
    | 'candidateKind'
    | 'configured'
    | 'fallbackProviderIds'
    | 'featureKind'
    | 'modelId'
    | 'outputType'
    | 'policyAllowedPrivacy'
    | 'policyAllowedProviderIds'
    | 'policyBlockedProviderIds'
    | 'policyCandidates'
    | 'policyEnabled'
    | 'policyFeatureKind'
    | 'policyPreferredPrivacy'
    | 'policyWorkspaceId'
    | 'providerConfiguredModelCount'
    | 'providerConfiguredModelIds'
    | 'providerId'
    | 'providerPrivacy'
    | 'providerPriority'
    | 'providerProfileConfigPath'
    | 'providerProfileId'
    | 'providerProfileSource'
    | 'providerSource'
    | 'providerType'
    | 'requestedModelId'
    | 'requestedModelSource'
    | 'routeCandidates'
    | 'routeModelAliasMatched'
    | 'routeModelDefinitionAliases'
    | 'routeModelDefinitionId'
    | 'routeModelDefinitionSource'
    | 'routeRawModelId'
  >
) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        effectiveSourceFingerprintVersion:
          PROMPT_REGISTRY_PUBLISH_GATE_MODEL_ROUTE_EFFECTIVE_SOURCE_FINGERPRINT_VERSION,
        candidateConfigPath: route.candidateConfigPath ?? null,
        candidateIndex: route.candidateIndex,
        candidateKind: route.candidateKind,
        configured: route.configured,
        fallbackProviderIds: route.fallbackProviderIds,
        featureKind: route.featureKind,
        modelId: route.modelId ?? null,
        outputType: route.outputType,
        policyAllowedPrivacy: route.policyAllowedPrivacy ?? null,
        policyAllowedProviderIds: route.policyAllowedProviderIds ?? null,
        policyBlockedProviderIds: route.policyBlockedProviderIds ?? null,
        policyCandidates: route.policyCandidates.map(candidate => ({
          allowed: candidate.allowed,
          available: candidate.available,
          privacy: candidate.privacy,
          providerConfiguredModelCount:
            candidate.providerConfiguredModelCount ?? null,
          providerConfiguredModelIds:
            candidate.providerConfiguredModelIds ?? null,
          providerId: candidate.providerId,
          providerPriority: candidate.providerPriority ?? null,
          providerProfileConfigPath:
            candidate.providerProfileConfigPath ?? null,
          providerProfileId: candidate.providerProfileId ?? null,
          providerProfileSource: candidate.providerProfileSource ?? null,
          providerSource: candidate.providerSource ?? null,
          providerType: candidate.providerType ?? null,
          registryAvailable: candidate.registryAvailable ?? null,
          registryKind: candidate.registryKind ?? null,
          registrySelected: candidate.registrySelected ?? null,
        })),
        policyEnabled: route.policyEnabled,
        policyFeatureKind: route.policyFeatureKind ?? null,
        policyPreferredPrivacy: route.policyPreferredPrivacy ?? null,
        policyWorkspaceId: route.policyWorkspaceId ?? null,
        providerConfiguredModelCount:
          route.providerConfiguredModelCount ?? null,
        providerConfiguredModelIds: route.providerConfiguredModelIds ?? null,
        providerId: route.providerId ?? null,
        providerPrivacy: route.providerPrivacy ?? null,
        providerPriority: route.providerPriority ?? null,
        providerProfileConfigPath: route.providerProfileConfigPath ?? null,
        providerProfileId: route.providerProfileId ?? null,
        providerProfileSource: route.providerProfileSource ?? null,
        providerSource: route.providerSource ?? null,
        providerType: route.providerType ?? null,
        requestedModelId: route.requestedModelId ?? null,
        requestedModelSource: route.requestedModelSource ?? null,
        routeCandidates: route.routeCandidates.map(candidate => ({
          candidateModelIds: candidate.candidateModelIds ?? null,
          matched: candidate.matched,
          modelId: candidate.modelId ?? null,
          providerConfiguredModelCount:
            candidate.providerConfiguredModelCount ?? null,
          providerConfiguredModelIds:
            candidate.providerConfiguredModelIds ?? null,
          providerId: candidate.providerId,
          providerPriority: candidate.providerPriority ?? null,
          providerProfileConfigPath:
            candidate.providerProfileConfigPath ?? null,
          providerProfileId: candidate.providerProfileId ?? null,
          providerProfileSource: candidate.providerProfileSource ?? null,
          providerSource: candidate.providerSource ?? null,
          providerType: candidate.providerType ?? null,
          registryAvailable: candidate.registryAvailable ?? null,
          registryKind: candidate.registryKind ?? null,
          registrySelected: candidate.registrySelected ?? null,
          requestedModelId: candidate.requestedModelId ?? null,
          routeModelAliasMatched: candidate.routeModelAliasMatched ?? null,
          routeModelDefinitionAliases:
            candidate.routeModelDefinitionAliases ?? null,
          routeModelDefinitionId: candidate.routeModelDefinitionId ?? null,
          routeModelDefinitionSource:
            candidate.routeModelDefinitionSource ?? null,
          routeRawModelId: candidate.routeRawModelId ?? null,
        })),
        routeModelAliasMatched: route.routeModelAliasMatched ?? null,
        routeModelDefinitionAliases: route.routeModelDefinitionAliases ?? null,
        routeModelDefinitionId: route.routeModelDefinitionId ?? null,
        routeModelDefinitionSource: route.routeModelDefinitionSource ?? null,
        routeRawModelId: route.routeRawModelId ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function compactTaskRouteDiagnosticsErrors(
  errors: CopilotTaskRouteDiagnosticsError[] | undefined
) {
  return (errors ?? []).map(error => ({
    code: error.code,
    message: error.message,
    stage: error.stage,
  }));
}

function taskRoutePolicyCandidateEffectiveSourceSnapshot(
  candidates: CopilotTaskRouteEffectiveSourceFingerprintInput['policyCandidates']
) {
  return candidates.map(candidate => ({
    allowed: candidate.allowed,
    available: candidate.available,
    candidateFingerprint: candidate.candidateFingerprint,
    candidateKey: candidate.candidateKey,
    health: candidate.health,
    privacy: candidate.privacy,
    providerConfiguredModelCount:
      candidate.providerConfiguredModelCount ?? null,
    providerConfiguredModelIds: candidate.providerConfiguredModelIds ?? null,
    providerId: candidate.providerId,
    providerPriority: candidate.providerPriority ?? null,
    providerProfileConfigPath: candidate.providerProfileConfigPath ?? null,
    providerProfileId: candidate.providerProfileId ?? null,
    providerProfileSource: candidate.providerProfileSource ?? null,
    providerSource: candidate.providerSource ?? null,
    providerType: candidate.providerType ?? null,
    registryAvailable: candidate.registryAvailable ?? null,
    registryKind: candidate.registryKind ?? null,
    registrySelected: candidate.registrySelected ?? null,
    reasons: candidate.reasons,
  }));
}

function taskRouteRouteCandidateEffectiveSourceSnapshot(
  candidates: CopilotTaskRouteEffectiveSourceFingerprintInput['routeCandidates']
) {
  return candidates.map(candidate => ({
    candidateKey: candidate.candidateKey ?? null,
    candidateModelIds: candidate.candidateModelIds ?? null,
    matched: candidate.matched,
    modelId: candidate.modelId ?? null,
    providerConfiguredModelCount:
      candidate.providerConfiguredModelCount ?? null,
    providerConfiguredModelIds: candidate.providerConfiguredModelIds ?? null,
    providerId: candidate.providerId,
    providerPriority: candidate.providerPriority ?? null,
    providerProfileConfigPath: candidate.providerProfileConfigPath ?? null,
    providerProfileId: candidate.providerProfileId ?? null,
    providerProfileSource: candidate.providerProfileSource ?? null,
    providerSource: candidate.providerSource ?? null,
    providerType: candidate.providerType ?? null,
    registryAvailable: candidate.registryAvailable ?? null,
    registryKind: candidate.registryKind ?? null,
    registrySelected: candidate.registrySelected ?? null,
    requestedModelId: candidate.requestedModelId ?? null,
    routeModelAliasMatched: candidate.routeModelAliasMatched ?? null,
    routeModelDefinitionAliases: candidate.routeModelDefinitionAliases ?? null,
    routeModelDefinitionId: candidate.routeModelDefinitionId ?? null,
    routeModelDefinitionSource: candidate.routeModelDefinitionSource ?? null,
    routeRawModelId: candidate.routeRawModelId ?? null,
  }));
}

function taskRoutePrepareCandidateEffectiveSourceSnapshot(
  candidates: CopilotTaskRouteEffectiveSourceFingerprintInput['prepareCandidates']
) {
  return candidates.map(candidate => ({
    candidateKey: candidate.candidateKey ?? null,
    candidateModelIds: candidate.candidateModelIds ?? null,
    errorCategory: candidate.errorCategory ?? null,
    errorCode: candidate.errorCode ?? null,
    modelId: candidate.modelId ?? null,
    prepared: candidate.prepared,
    preparedModelId: candidate.preparedModelId ?? null,
    providerConfiguredModelCount:
      candidate.providerConfiguredModelCount ?? null,
    providerConfiguredModelIds: candidate.providerConfiguredModelIds ?? null,
    providerId: candidate.providerId,
    providerPriority: candidate.providerPriority ?? null,
    providerProfileConfigPath: candidate.providerProfileConfigPath ?? null,
    providerProfileId: candidate.providerProfileId ?? null,
    providerProfileSource: candidate.providerProfileSource ?? null,
    providerSource: candidate.providerSource ?? null,
    providerType: candidate.providerType ?? null,
    registryAvailable: candidate.registryAvailable ?? null,
    registryKind: candidate.registryKind ?? null,
    registrySelected: candidate.registrySelected ?? null,
    requestedModelId: candidate.requestedModelId ?? null,
    routeModelAliasMatched: candidate.routeModelAliasMatched ?? null,
    routeModelDefinitionAliases: candidate.routeModelDefinitionAliases ?? null,
    routeModelDefinitionId: candidate.routeModelDefinitionId ?? null,
    routeModelDefinitionSource: candidate.routeModelDefinitionSource ?? null,
    routeRawModelId: candidate.routeRawModelId ?? null,
  }));
}

function taskRouteTraceEffectiveSourceSnapshot(
  phases: CopilotTaskRouteEffectiveSourceFingerprintInput['routeTrace']
) {
  return phases.map(phase => ({
    availableCount: phase.availableCount ?? null,
    blockedCount: phase.blockedCount ?? null,
    candidateCount: phase.candidateCount,
    matchedCount: phase.matchedCount ?? null,
    phase: phase.phase,
    preparedCount: phase.preparedCount ?? null,
    reasons: phase.reasons,
    selectedCount: phase.selectedCount ?? null,
  }));
}

function buildTaskRouteEffectiveSourceFingerprint(
  route: CopilotTaskRouteEffectiveSourceFingerprintInput
) {
  return createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        effectiveSourceFingerprintVersion:
          COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_FINGERPRINT_VERSION,
        behaviorFlags: route.behaviorFlags ?? null,
        candidateCount: route.candidateCount ?? null,
        canonicalModelKey: route.canonicalModelKey ?? null,
        configured: route.configured,
        diagnosticsErrors: compactTaskRouteDiagnosticsErrors(
          route.diagnosticsErrors
        ),
        dimensionMismatch: route.dimensionMismatch ?? null,
        embeddingIndexContractDimensions:
          route.embeddingIndexContractDimensions ?? null,
        embeddingIndexContractFingerprint:
          route.embeddingIndexContractFingerprint ?? null,
        embeddingIndexContractStatus:
          route.embeddingIndexContractStatus ?? null,
        embeddingIndexContractVersion:
          route.embeddingIndexContractVersion ?? null,
        errorCode: route.errorCode ?? null,
        fallbackProviderIds: route.fallbackProviderIds,
        featureKind: route.featureKind,
        modelBackendKind: route.modelBackendKind ?? null,
        modelEmbeddingDimensions: route.modelEmbeddingDimensions ?? null,
        modelId: route.modelId ?? null,
        policyAllowedPrivacy: route.policyAllowedPrivacy ?? null,
        policyAllowedProviderIds: route.policyAllowedProviderIds ?? null,
        policyBlockedProviderIds: route.policyBlockedProviderIds ?? null,
        policyCandidates: taskRoutePolicyCandidateEffectiveSourceSnapshot(
          route.policyCandidates
        ),
        policyEnabled: route.policyEnabled,
        policyFeatureKind: route.policyFeatureKind ?? null,
        policyPreferredPrivacy: route.policyPreferredPrivacy ?? null,
        policyWorkspaceId: route.policyWorkspaceId ?? null,
        prepareCandidates: taskRoutePrepareCandidateEffectiveSourceSnapshot(
          route.prepareCandidates
        ),
        preparedProviderCount: route.preparedProviderCount,
        preparedRouteOrder: taskRoutePreparedRouteOrderSnapshot(
          route.preparedRoutes
        ),
        preparedRouteTargetFingerprint: route.preparedRouteTargetFingerprint,
        preparedRouteTargets: route.preparedRouteTargets,
        preparedRoutes: taskRoutePreparedRouteSnapshot(route.preparedRoutes),
        protocol: route.protocol ?? null,
        providerConfiguredModelCount:
          route.providerConfiguredModelCount ?? null,
        providerConfiguredModelIds: route.providerConfiguredModelIds ?? null,
        providerId: route.providerId ?? null,
        providerPriority: route.providerPriority ?? null,
        providerProfileConfigPath: route.providerProfileConfigPath ?? null,
        providerProfileId: route.providerProfileId ?? null,
        providerProfileSource: route.providerProfileSource ?? null,
        providerSource: route.providerSource ?? null,
        providerType: route.providerType ?? null,
        rerankRuntimeContractFingerprint:
          route.rerankRuntimeContractFingerprint ?? null,
        rerankRuntimeContractStatus: route.rerankRuntimeContractStatus ?? null,
        rerankRuntimeContractTopK: route.rerankRuntimeContractTopK ?? null,
        rerankRuntimeContractVersion:
          route.rerankRuntimeContractVersion ?? null,
        requestedDimensions: route.requestedDimensions ?? null,
        requestedModelConfigKey: route.requestedModelConfigKey ?? null,
        requestedModelConfigPath: route.requestedModelConfigPath ?? null,
        requestedModelId: route.requestedModelId ?? null,
        requestedModelSource: route.requestedModelSource ?? null,
        requestLayer: route.requestLayer ?? null,
        routeCandidates: taskRouteRouteCandidateEffectiveSourceSnapshot(
          route.routeCandidates
        ),
        routeTrace: taskRouteTraceEffectiveSourceSnapshot(route.routeTrace),
        taskRoutePolicyRevision: route.taskRoutePolicyRevision ?? null,
        taskRoutePolicyRevisionActorId:
          route.taskRoutePolicyRevisionActorId ?? null,
        taskRoutePolicyRevisionFingerprint:
          route.taskRoutePolicyRevisionFingerprint ?? null,
        taskRoutePolicyRevisionId: route.taskRoutePolicyRevisionId ?? null,
        taskRoutePolicyRevisionScope:
          route.taskRoutePolicyRevisionScope ?? null,
        taskRoutePolicyRevisionSourceChain:
          route.taskRoutePolicyRevisionSourceChain?.map(entry => ({
            actorId: entry.actorId ?? null,
            configKey: entry.configKey ?? null,
            configPath: entry.configPath ?? null,
            featureKind: entry.featureKind ?? null,
            fingerprint: entry.fingerprint ?? null,
            modelId: entry.modelId ?? null,
            revision: entry.revision ?? null,
            scope: entry.scope,
            source: entry.source,
            status: entry.status,
            updatedAt: entry.updatedAt ?? null,
            workspaceId: entry.workspaceId ?? null,
          })) ?? null,
        taskRoutePolicyRevisionSourceChainFingerprint:
          route.taskRoutePolicyRevisionSourceChainFingerprint ?? null,
        taskRoutePolicyRevisionStatus:
          route.taskRoutePolicyRevisionStatus ?? null,
        taskRoutePolicyRevisionWorkspaceId:
          route.taskRoutePolicyRevisionWorkspaceId ?? null,
        topK: route.topK ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function withTaskRouteEffectiveSourceFingerprint<
  T extends CopilotTaskRouteEffectiveSourceFingerprintInput,
>(route: T): T & { effectiveSourceFingerprint: string } {
  return {
    ...route,
    effectiveSourceFingerprint: buildTaskRouteEffectiveSourceFingerprint(route),
    effectiveSourceFingerprintInputs: [
      ...COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_FINGERPRINT_INPUTS,
    ],
    effectiveSourceFingerprintVersion:
      COPILOT_TASK_ROUTE_EFFECTIVE_SOURCE_FINGERPRINT_VERSION,
  };
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function buildTaskRoutePreparedTargetSummary(input: {
  featureKind: string;
  preparedRoutes: Pick<
    CopilotPreparedTaskRouteDiagnosticsType,
    'modelId' | 'providerId'
  >[];
  requestedModelConfigKey?: string;
  requestedModelConfigPath?: string;
  requestedModelId?: string;
  requestedModelSource?: string;
}) {
  const targets = uniqueStrings(
    input.preparedRoutes.map(
      preparedRoute => `${preparedRoute.providerId}/${preparedRoute.modelId}`
    )
  );
  const payload = stableRepairRecommendationStringify({
    featureKind: input.featureKind,
    requestedModelConfigKey: input.requestedModelConfigKey ?? null,
    requestedModelConfigPath: input.requestedModelConfigPath ?? null,
    requestedModelId: input.requestedModelId ?? null,
    requestedModelSource: input.requestedModelSource ?? null,
    targets,
  });

  return {
    preparedRouteTargetFingerprint: createHash('sha256')
      .update(payload)
      .digest('hex')
      .slice(0, 16),
    preparedRouteTargets: targets,
  };
}

function taskRoutePolicyRevisionMetadata(
  model: Awaited<ReturnType<TaskPolicy['resolveEffectiveRerankModel']>>
) {
  return {
    ...(model.registryRevision?.revision
      ? { taskRoutePolicyRevision: model.registryRevision.revision }
      : {}),
    ...(model.registryRevisionActorId
      ? { taskRoutePolicyRevisionActorId: model.registryRevisionActorId }
      : {}),
    ...(model.registryRevisionFingerprint
      ? {
          taskRoutePolicyRevisionFingerprint: model.registryRevisionFingerprint,
        }
      : {}),
    ...(model.registryRevisionId
      ? { taskRoutePolicyRevisionId: model.registryRevisionId }
      : {}),
    ...(model.registryRevisionScope
      ? { taskRoutePolicyRevisionScope: model.registryRevisionScope }
      : {}),
    ...(model.fallbackSourceChain
      ? { taskRoutePolicyRevisionSourceChain: model.fallbackSourceChain }
      : {}),
    ...(model.registrySourceChainFingerprint
      ? {
          taskRoutePolicyRevisionSourceChainFingerprint:
            model.registrySourceChainFingerprint,
        }
      : {}),
    ...(model.registryRevisionStatus
      ? { taskRoutePolicyRevisionStatus: model.registryRevisionStatus }
      : {}),
    ...(model.registryRevisionWorkspaceId
      ? {
          taskRoutePolicyRevisionWorkspaceId: model.registryRevisionWorkspaceId,
        }
      : {}),
    ...(model.registryRevisionPublishEventCount !== undefined
      ? {
          taskRoutePolicyRevisionPublishEventCount:
            model.registryRevisionPublishEventCount,
        }
      : {}),
    ...(model.registryRevisionPublishEvents !== undefined
      ? {
          taskRoutePolicyRevisionPublishEvents:
            model.registryRevisionPublishEvents,
        }
      : {}),
  };
}

function buildEmbeddingIndexContractSnapshot(input: {
  dimensionMismatch?: boolean;
  featureKind: string;
  modelEmbeddingDimensions?: number;
  modelId?: string;
  requestedDimensions?: number;
}) {
  if (input.featureKind !== 'workspace_indexing') {
    return {};
  }

  const embeddingIndexContractVersion = 'workspace-embedding-index/v2';
  const embeddingIndexContractStatus =
    input.dimensionMismatch === true
      ? 'dimension_mismatch'
      : 'compatible_with_current_pgvector_index';
  const embeddingIndexContractDimensions = EMBEDDING_DIMENSIONS;
  const embeddingIndexContractFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        dimensionMismatch: input.dimensionMismatch ?? null,
        embeddingIndexContractDimensions,
        embeddingIndexContractStatus,
        embeddingIndexContractVersion,
        featureKind: input.featureKind,
        modelEmbeddingDimensions: input.modelEmbeddingDimensions ?? null,
        modelId: input.modelId ?? null,
        requestedDimensions: input.requestedDimensions ?? null,
      })
    )
    .digest('hex')
    .slice(0, 16);

  return {
    embeddingIndexContractDimensions,
    embeddingIndexContractFingerprint,
    embeddingIndexContractStatus,
    embeddingIndexContractVersion,
  };
}

function buildRerankRuntimeContractSnapshot(input: {
  candidateCount?: number;
  featureKind: string;
  modelId?: string;
  preparedProviderCount?: number;
  requestedModelId?: string;
  topK?: number;
}) {
  if (input.featureKind !== 'rerank') {
    return {};
  }

  const rerankRuntimeContractVersion = 'workspace-rerank-runtime/v1';
  const rerankRuntimeContractStatus =
    (input.preparedProviderCount ?? 0) > 0
      ? 'prepared_route_available'
      : 'no_prepared_route_read_only';
  const rerankRuntimeContractFingerprint = createHash('sha256')
    .update(
      stableRepairRecommendationStringify({
        candidateCount: input.candidateCount ?? null,
        featureKind: input.featureKind,
        modelId: input.modelId ?? null,
        preparedProviderCount: input.preparedProviderCount ?? 0,
        requestedModelId: input.requestedModelId ?? null,
        rerankRuntimeContractStatus,
        rerankRuntimeContractTopK: input.topK ?? null,
        rerankRuntimeContractVersion,
      })
    )
    .digest('hex')
    .slice(0, 16);

  return {
    rerankRuntimeContractFingerprint,
    rerankRuntimeContractStatus,
    rerankRuntimeContractTopK: input.topK,
    rerankRuntimeContractVersion,
  };
}

function buildTaskRouteCandidateKey(
  candidate: Pick<
    CopilotTaskRouteCandidateDiagnosticsType,
    | 'candidateModelIds'
    | 'modelId'
    | 'providerId'
    | 'registryKind'
    | 'requestedModelId'
  >
) {
  const modelIds = uniqueStrings([
    ...(candidate.modelId ? [candidate.modelId] : []),
    ...(candidate.requestedModelId ? [candidate.requestedModelId] : []),
    ...(candidate.candidateModelIds ?? []),
  ]).sort();

  return JSON.stringify([
    candidate.registryKind ?? 'unknown_registry',
    candidate.providerId,
    candidate.requestedModelId ?? '',
    candidate.modelId ?? '',
    modelIds,
  ]);
}

function buildTaskRoutePolicyCandidateKey(input: {
  candidate: CopilotProviderEffectiveRoutePolicyCandidateDiagnostics;
  featureKind: CopilotProviderRoutePolicyFeatureKind;
  workspaceId?: string;
}) {
  return JSON.stringify([
    'policy',
    input.featureKind,
    input.workspaceId ?? 'global',
    input.candidate.providerId,
    input.candidate.providerProfileId ?? '',
    input.candidate.registryKind ?? 'unknown_registry',
    input.candidate.registryAvailable ?? null,
    input.candidate.registrySelected ?? null,
    input.candidate.privacy,
    input.candidate.health,
    input.candidate.available,
    input.candidate.allowed,
  ]);
}

function withTaskRoutePolicyCandidateKeys(
  candidates: CopilotProviderEffectiveRoutePolicyCandidateDiagnostics[],
  context: {
    featureKind: CopilotProviderRoutePolicyFeatureKind;
    workspaceId?: string;
  }
): CopilotTaskRoutePolicyCandidateWithKey[] {
  return candidates.map((candidate, index) => {
    const candidateKey = buildTaskRoutePolicyCandidateKey({
      candidate,
      ...context,
    });
    const evidence = taskRouteRepairCandidateEvidenceBase(
      'policyCandidate',
      { ...candidate, candidateKey },
      index
    );

    return {
      ...candidate,
      candidateFingerprint:
        taskRouteRepairCandidateEvidenceFingerprint(evidence),
      candidateKey,
    };
  });
}

function taskRoutePolicyMetadata(
  routePolicy: CopilotProviderRoutePolicySummary
) {
  const base = routePolicyMetadataBase(routePolicy);
  return {
    policyEnabled: base.enabled,
    ...(base.featureKind ? { policyFeatureKind: base.featureKind } : {}),
    ...(base.workspaceId ? { policyWorkspaceId: base.workspaceId } : {}),
    ...(base.allowedProviderIds !== undefined
      ? { policyAllowedProviderIds: base.allowedProviderIds }
      : {}),
    ...(base.blockedProviderIds !== undefined
      ? { policyBlockedProviderIds: base.blockedProviderIds }
      : {}),
    ...(base.allowedPrivacy !== undefined
      ? { policyAllowedPrivacy: base.allowedPrivacy }
      : {}),
    ...(base.preferredPrivacy !== undefined
      ? { policyPreferredPrivacy: base.preferredPrivacy }
      : {}),
  };
}

function routePolicyMetadataBase(
  routePolicy: CopilotProviderRoutePolicySummary
) {
  return {
    enabled: routePolicy.enabled,
    featureKind: routePolicy.featureKind,
    workspaceId: routePolicy.workspaceId,
    allowedProviderIds: routePolicy.allowedProviderIds,
    blockedProviderIds: routePolicy.blockedProviderIds,
    allowedPrivacy: routePolicy.allowedPrivacy,
    preferredPrivacy: routePolicy.preferredPrivacy,
  };
}

function buildTaskRoutePrepareCandidates(
  routeCandidates: CopilotTaskRouteCandidateDiagnosticsType[],
  preparedRoutes: CopilotPreparedTaskRouteDiagnosticsType[],
  providerPrepareCandidates: CopilotProviderPrepareCandidateDiagnostics[] = [],
  diagnosticsErrors: CopilotTaskRouteDiagnosticsError[] = []
): CopilotTaskRoutePrepareCandidateDiagnosticsType[] {
  const prepareProbeError = diagnosticsErrors.find(error =>
    error.stage.includes('prepare_candidates')
  );
  const matchedCandidates = routeCandidates.filter(
    candidate => candidate.matched
  );
  const matchedCandidateCountByProviderId = new Map<string, number>();
  for (const candidate of matchedCandidates) {
    matchedCandidateCountByProviderId.set(
      candidate.providerId,
      (matchedCandidateCountByProviderId.get(candidate.providerId) ?? 0) + 1
    );
  }

  const providerPrepareCandidatesByProviderId = new Map<
    string,
    CopilotProviderPrepareCandidateDiagnostics
  >();
  const providerPrepareCandidatesByProviderModel = new Map<
    string,
    CopilotProviderPrepareCandidateDiagnostics
  >();
  const providerModelKey = (providerId: string, modelId?: string) =>
    modelId ? JSON.stringify([providerId, modelId]) : null;
  for (const candidate of providerPrepareCandidates) {
    providerPrepareCandidatesByProviderId.set(candidate.providerId, candidate);
    const key = providerModelKey(candidate.providerId, candidate.modelId);
    if (key) {
      providerPrepareCandidatesByProviderModel.set(key, candidate);
    }
  }

  const candidateModelIds = (
    candidate: CopilotTaskRouteCandidateDiagnosticsType
  ) =>
    uniqueStrings([
      ...(candidate.modelId ? [candidate.modelId] : []),
      ...(candidate.requestedModelId ? [candidate.requestedModelId] : []),
      ...(candidate.candidateModelIds ?? []),
    ]);
  const isSingleCandidateProvider = (providerId: string) =>
    (matchedCandidateCountByProviderId.get(providerId) ?? 0) <= 1;
  const findProviderPrepareCandidate = (
    candidate: CopilotTaskRouteCandidateDiagnosticsType
  ) => {
    for (const modelId of candidateModelIds(candidate)) {
      const key = providerModelKey(candidate.providerId, modelId);
      const providerPrepareCandidate = key
        ? providerPrepareCandidatesByProviderModel.get(key)
        : undefined;
      if (providerPrepareCandidate) {
        return providerPrepareCandidate;
      }
    }

    return isSingleCandidateProvider(candidate.providerId)
      ? providerPrepareCandidatesByProviderId.get(candidate.providerId)
      : undefined;
  };
  const findPreparedRoute = (
    candidate: CopilotTaskRouteCandidateDiagnosticsType,
    providerPrepareCandidate:
      | CopilotProviderPrepareCandidateDiagnostics
      | undefined
  ) => {
    const models = new Set([
      ...candidateModelIds(candidate),
      ...(providerPrepareCandidate?.preparedModelId
        ? [providerPrepareCandidate.preparedModelId]
        : []),
    ]);
    const preparedRoute = preparedRoutes.find(route => {
      if (route.providerId !== candidate.providerId) {
        return false;
      }
      if (!models.size) {
        return isSingleCandidateProvider(candidate.providerId);
      }
      return (
        models.has(route.modelId) ||
        (!!route.canonicalModelKey && models.has(route.canonicalModelKey))
      );
    });
    if (preparedRoute) {
      return preparedRoute;
    }

    return isSingleCandidateProvider(candidate.providerId)
      ? preparedRoutes.find(route => route.providerId === candidate.providerId)
      : undefined;
  };

  return matchedCandidates.map(candidate => {
    const candidateKey =
      candidate.candidateKey ?? buildTaskRouteCandidateKey(candidate);
    const providerPrepareCandidate = findProviderPrepareCandidate(candidate);
    const preparedRoute = findPreparedRoute(
      candidate,
      providerPrepareCandidate
    );
    const prepared = !!preparedRoute;
    const preparedReasons = [
      'prepared_route_available',
      ...(providerPrepareCandidate?.reasons ?? []),
    ];
    if (
      candidate.modelId &&
      preparedRoute?.modelId &&
      candidate.modelId !== preparedRoute.modelId
    ) {
      preparedReasons.push('prepared_model_resolved');
    }
    const reasons = prepared
      ? uniqueStrings(preparedReasons)
      : uniqueStrings([
          candidate.registrySelected === false
            ? 'prepared_route_not_selected'
            : 'prepared_route_filtered',
          ...(providerPrepareCandidate?.reasons ?? []),
        ]);
    const routeRawModelId =
      candidate.routeRawModelId ?? providerPrepareCandidate?.routeRawModelId;
    const routeModelDefinitionSource =
      candidate.routeModelDefinitionSource ??
      providerPrepareCandidate?.routeModelDefinitionSource;
    const routeModelDefinitionId =
      candidate.routeModelDefinitionId ??
      providerPrepareCandidate?.routeModelDefinitionId;
    const routeModelDefinitionAliases =
      candidate.routeModelDefinitionAliases ??
      providerPrepareCandidate?.routeModelDefinitionAliases;
    const routeModelAliasMatched =
      candidate.routeModelAliasMatched ??
      providerPrepareCandidate?.routeModelAliasMatched;
    const modelRegistryRevision =
      candidate.modelRegistryRevision ??
      providerPrepareCandidate?.modelRegistryRevision;
    const modelRegistryRevisionActorId =
      candidate.modelRegistryRevisionActorId ??
      providerPrepareCandidate?.modelRegistryRevisionActorId;
    const modelRegistryRevisionFingerprint =
      candidate.modelRegistryRevisionFingerprint ??
      providerPrepareCandidate?.modelRegistryRevisionFingerprint;
    const modelRegistryRevisionId =
      candidate.modelRegistryRevisionId ??
      providerPrepareCandidate?.modelRegistryRevisionId;
    const modelRegistryRevisionScope =
      candidate.modelRegistryRevisionScope ??
      providerPrepareCandidate?.modelRegistryRevisionScope;
    const modelRegistryRevisionSourceChain =
      (candidate.modelRegistryRevisionSourceChain ??
        providerPrepareCandidate?.modelRegistryRevisionSourceChain) as
        | CopilotModelRegistrySourceChainEntry[]
        | undefined;
    const modelRegistryRevisionSourceChainFingerprint =
      candidate.modelRegistryRevisionSourceChainFingerprint ??
      providerPrepareCandidate?.modelRegistryRevisionSourceChainFingerprint;
    const modelRegistryRevisionStatus =
      candidate.modelRegistryRevisionStatus ??
      providerPrepareCandidate?.modelRegistryRevisionStatus;
    const modelRegistryRevisionWorkspaceId =
      candidate.modelRegistryRevisionWorkspaceId ??
      providerPrepareCandidate?.modelRegistryRevisionWorkspaceId;
    const modelRegistryRevisionPublishEventCount =
      candidate.modelRegistryRevisionPublishEventCount ??
      providerPrepareCandidate?.modelRegistryRevisionPublishEventCount;
    const modelRegistryRevisionPublishEvents =
      candidate.modelRegistryRevisionPublishEvents ??
      providerPrepareCandidate?.modelRegistryRevisionPublishEvents;
    const costInputPer1M =
      candidate.costInputPer1M ?? providerPrepareCandidate?.costInputPer1M;
    const costOutputPer1M =
      candidate.costOutputPer1M ?? providerPrepareCandidate?.costOutputPer1M;
    const routeContextWindow =
      candidate.routeContextWindow ??
      providerPrepareCandidate?.routeContextWindow;
    const routeMaxOutputTokens =
      candidate.routeMaxOutputTokens ??
      providerPrepareCandidate?.routeMaxOutputTokens;
    const routeEmbeddingDimensions =
      candidate.routeEmbeddingDimensions ??
      providerPrepareCandidate?.routeEmbeddingDimensions;
    const routeInputTypes =
      candidate.routeInputTypes ?? providerPrepareCandidate?.routeInputTypes;
    const routeOutputTypes =
      candidate.routeOutputTypes ?? providerPrepareCandidate?.routeOutputTypes;
    const routeAttachmentKinds =
      candidate.routeAttachmentKinds ??
      providerPrepareCandidate?.routeAttachmentKinds;
    const routeAttachmentSourceKinds =
      candidate.routeAttachmentSourceKinds ??
      providerPrepareCandidate?.routeAttachmentSourceKinds;
    const routeAttachmentAllowRemoteUrls =
      candidate.routeAttachmentAllowRemoteUrls ??
      providerPrepareCandidate?.routeAttachmentAllowRemoteUrls;
    const routeStructuredAttachmentKinds =
      candidate.routeStructuredAttachmentKinds ??
      providerPrepareCandidate?.routeStructuredAttachmentKinds;
    const routeStructuredAttachmentSourceKinds =
      candidate.routeStructuredAttachmentSourceKinds ??
      providerPrepareCandidate?.routeStructuredAttachmentSourceKinds;
    const routeStructuredAttachmentAllowRemoteUrls =
      candidate.routeStructuredAttachmentAllowRemoteUrls ??
      providerPrepareCandidate?.routeStructuredAttachmentAllowRemoteUrls;

    const providerName =
      candidate.providerName ?? providerPrepareCandidate?.providerName;
    const providerSource =
      candidate.providerSource ?? providerPrepareCandidate?.providerSource;
    const providerProfileId =
      candidate.providerProfileId ??
      providerPrepareCandidate?.providerProfileId;
    const providerProfileSource =
      candidate.providerProfileSource ??
      providerPrepareCandidate?.providerProfileSource;
    const providerProfileConfigPath =
      candidate.providerProfileConfigPath ??
      providerPrepareCandidate?.providerProfileConfigPath;
    const providerConfiguredModelIds =
      candidate.providerConfiguredModelIds ??
      providerPrepareCandidate?.providerConfiguredModelIds;
    const providerConfiguredModelCount =
      candidate.providerConfiguredModelCount ??
      providerPrepareCandidate?.providerConfiguredModelCount;
    const providerType =
      candidate.providerType ?? providerPrepareCandidate?.providerType;
    const providerPriority =
      candidate.providerPriority ?? providerPrepareCandidate?.providerPriority;
    const privacy = candidate.privacy ?? providerPrepareCandidate?.privacy;
    const health = candidate.health ?? providerPrepareCandidate?.health;
    const healthCheckedAt =
      candidate.healthCheckedAt ?? providerPrepareCandidate?.healthCheckedAt;

    return {
      candidateKey,
      providerId: candidate.providerId,
      ...(providerName ? { providerName } : {}),
      ...(providerSource ? { providerSource } : {}),
      ...(providerProfileId ? { providerProfileId } : {}),
      ...(providerProfileSource ? { providerProfileSource } : {}),
      ...(providerProfileConfigPath ? { providerProfileConfigPath } : {}),
      ...(providerConfiguredModelIds !== undefined
        ? { providerConfiguredModelIds }
        : {}),
      ...(providerConfiguredModelCount !== undefined
        ? { providerConfiguredModelCount }
        : {}),
      ...(providerType ? { providerType } : {}),
      ...(providerPriority !== undefined ? { providerPriority } : {}),
      ...(privacy ? { privacy } : {}),
      ...(health ? { health } : {}),
      ...(healthCheckedAt ? { healthCheckedAt } : {}),
      ...(candidate.registryKind
        ? { registryKind: candidate.registryKind }
        : {}),
      ...(candidate.registryAvailable !== undefined
        ? { registryAvailable: candidate.registryAvailable }
        : {}),
      ...(candidate.registrySelected !== undefined
        ? { registrySelected: candidate.registrySelected }
        : {}),
      ...(candidate.requestedModelId
        ? { requestedModelId: candidate.requestedModelId }
        : {}),
      ...(candidate.modelId ? { modelId: candidate.modelId } : {}),
      ...(routeRawModelId ? { routeRawModelId } : {}),
      ...(routeModelDefinitionSource ? { routeModelDefinitionSource } : {}),
      ...(routeModelDefinitionId ? { routeModelDefinitionId } : {}),
      ...(routeModelDefinitionAliases ? { routeModelDefinitionAliases } : {}),
      ...(routeModelAliasMatched !== undefined
        ? { routeModelAliasMatched }
        : {}),
      ...(modelRegistryRevision ? { modelRegistryRevision } : {}),
      ...(modelRegistryRevisionActorId ? { modelRegistryRevisionActorId } : {}),
      ...(modelRegistryRevisionFingerprint
        ? { modelRegistryRevisionFingerprint }
        : {}),
      ...(modelRegistryRevisionId ? { modelRegistryRevisionId } : {}),
      ...(modelRegistryRevisionScope ? { modelRegistryRevisionScope } : {}),
      ...(modelRegistryRevisionSourceChain
        ? { modelRegistryRevisionSourceChain }
        : {}),
      ...(modelRegistryRevisionSourceChainFingerprint
        ? { modelRegistryRevisionSourceChainFingerprint }
        : {}),
      ...(modelRegistryRevisionStatus ? { modelRegistryRevisionStatus } : {}),
      ...(modelRegistryRevisionWorkspaceId
        ? { modelRegistryRevisionWorkspaceId }
        : {}),
      ...(modelRegistryRevisionPublishEventCount !== undefined
        ? { modelRegistryRevisionPublishEventCount }
        : {}),
      ...(modelRegistryRevisionPublishEvents !== undefined
        ? { modelRegistryRevisionPublishEvents }
        : {}),
      ...(costInputPer1M !== undefined ? { costInputPer1M } : {}),
      ...(costOutputPer1M !== undefined ? { costOutputPer1M } : {}),
      ...(routeContextWindow !== undefined ? { routeContextWindow } : {}),
      ...(routeMaxOutputTokens !== undefined ? { routeMaxOutputTokens } : {}),
      ...(routeEmbeddingDimensions !== undefined
        ? { routeEmbeddingDimensions }
        : {}),
      ...(routeInputTypes !== undefined ? { routeInputTypes } : {}),
      ...(routeOutputTypes !== undefined ? { routeOutputTypes } : {}),
      ...(routeAttachmentKinds !== undefined ? { routeAttachmentKinds } : {}),
      ...(routeAttachmentSourceKinds !== undefined
        ? { routeAttachmentSourceKinds }
        : {}),
      ...(routeAttachmentAllowRemoteUrls !== undefined
        ? { routeAttachmentAllowRemoteUrls }
        : {}),
      ...(routeStructuredAttachmentKinds !== undefined
        ? { routeStructuredAttachmentKinds }
        : {}),
      ...(routeStructuredAttachmentSourceKinds !== undefined
        ? { routeStructuredAttachmentSourceKinds }
        : {}),
      ...(routeStructuredAttachmentAllowRemoteUrls !== undefined
        ? { routeStructuredAttachmentAllowRemoteUrls }
        : {}),
      ...(candidate.candidateModelIds !== undefined
        ? { candidateModelIds: candidate.candidateModelIds }
        : {}),
      prepared,
      ...(preparedRoute?.modelId
        ? { preparedModelId: preparedRoute.modelId }
        : {}),
      ...(providerPrepareCandidate?.errorCode
        ? { errorCode: providerPrepareCandidate.errorCode }
        : prepareProbeError
          ? { errorCode: 'provider_prepare_error' }
          : {}),
      ...(providerPrepareCandidate?.errorCategory
        ? { errorCategory: providerPrepareCandidate.errorCategory }
        : prepareProbeError
          ? { errorCategory: 'provider_prepare_error' }
          : {}),
      reasons,
    };
  });
}

function buildTaskRouteTrace(
  policyCandidates: CopilotProviderRoutePolicyCandidateDiagnostics[],
  routeCandidates: CopilotTaskRouteCandidateDiagnosticsType[],
  preparedRoutes: CopilotPreparedTaskRouteDiagnosticsType[],
  providerPrepareCandidates: CopilotProviderPrepareCandidateDiagnostics[] = []
): CopilotTaskRouteTracePhaseDiagnosticsType[] {
  const matchedRouteCandidateCount = routeCandidates.filter(
    candidate => candidate.matched
  ).length;
  const preparedPhaseReasons = uniqueStrings([
    ...(preparedRoutes.length < matchedRouteCandidateCount
      ? ['prepared_route_filtered']
      : []),
    ...providerPrepareCandidates.flatMap(candidate => candidate.reasons),
  ]);
  return [
    {
      phase: 'policy',
      candidateCount: policyCandidates.length,
      availableCount: policyCandidates.filter(candidate => candidate.available)
        .length,
      selectedCount: policyCandidates.filter(candidate => candidate.allowed)
        .length,
      blockedCount: policyCandidates.filter(candidate => !candidate.allowed)
        .length,
      reasons: uniqueStrings(
        policyCandidates.flatMap(candidate => candidate.reasons)
      ),
    },
    {
      phase: 'resolution',
      candidateCount: routeCandidates.length,
      availableCount: routeCandidates.filter(
        candidate => candidate.registryAvailable !== false
      ).length,
      selectedCount: routeCandidates.filter(
        candidate => candidate.registrySelected
      ).length,
      matchedCount: matchedRouteCandidateCount,
      reasons: uniqueStrings(
        routeCandidates.flatMap(candidate => candidate.reasons)
      ),
    },
    {
      phase: 'prepared',
      candidateCount: matchedRouteCandidateCount,
      selectedCount: preparedRoutes.length ? 1 : 0,
      preparedCount: preparedRoutes.length,
      reasons: preparedPhaseReasons,
    },
  ];
}

@ObjectType()
class CopilotModelRegistrySourceChainEntryType implements CopilotModelRegistrySourceChainEntry {
  @Field(() => String, { nullable: true })
  actorId?: string;

  @Field(() => String, { nullable: true })
  fingerprint?: string;

  @Field(() => String, { nullable: true })
  modelId?: string;

  @Field(() => String, { nullable: true })
  providerId?: string;

  @Field(() => String, { nullable: true })
  revision?: string;

  @Field(() => String)
  scope!: string;

  @Field(() => String)
  source!: string;

  @Field(() => String)
  status!: string;

  @Field(() => String, { nullable: true })
  updatedAt?: string;

  @Field(() => String, { nullable: true })
  workspaceId?: string;
}

@ObjectType()
class CopilotModelType {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => [String])
  sources!: CopilotModelSource[];

  @Field(() => String)
  promptName!: string;

  @Field(() => String, { nullable: true })
  promptAction?: string;

  @Field(() => String)
  promptSource!: string;

  @Field(() => String)
  promptCategory!: string;

  @Field(() => String, { nullable: true })
  promptDefaultPolicy?: string;

  @Field(() => Boolean)
  promptOverrideApplied!: boolean;

  @Field(() => String, { nullable: true })
  promptModelSource?: string;

  @Field(() => String, { nullable: true })
  promptModelConfigPath?: string;

  @Field(() => [CopilotModelPromptSourceType])
  promptModelSources!: CopilotModelPromptSourceType[];

  @Field(() => String, { nullable: true })
  providerId?: string;

  @Field(() => String, { nullable: true })
  providerName?: string;

  @Field(() => String, { nullable: true })
  providerSource?: string;

  @Field(() => String, { nullable: true })
  providerProfileId?: string;

  @Field(() => String, { nullable: true })
  providerProfileSource?: string;

  @Field(() => String, { nullable: true })
  providerProfileConfigPath?: string;

  @Field(() => [String], { nullable: true })
  providerConfiguredModelIds?: string[];

  @Field(() => SafeIntResolver, { nullable: true })
  providerConfiguredModelCount?: number;

  @Field(() => String, { nullable: true })
  registryKind?: string;

  @Field(() => Boolean, { nullable: true })
  registryAvailable?: boolean;

  @Field(() => Boolean, { nullable: true })
  registrySelected?: boolean;

  @Field(() => String, { nullable: true })
  effectiveSourceFingerprint?: string;

  @Field(() => [String], { nullable: true })
  effectiveSourceFingerprintInputs?: string[];

  @Field(() => String, { nullable: true })
  effectiveSourceFingerprintVersion?: string;

  @Field(() => String, { nullable: true })
  routeModelId?: string;

  @Field(() => [String], { nullable: true })
  routeFallbackProviderIds?: string[];

  @Field(() => String, { nullable: true })
  routeBackendKind?: string;

  @Field(() => String, { nullable: true })
  routeCanonicalModelKey?: string;

  @Field(() => String, { nullable: true })
  routeRawModelId?: string;

  @Field(() => String, { nullable: true })
  routeModelDefinitionSource?: CopilotModelDefinitionSource;

  @Field(() => String, { nullable: true })
  routeModelDefinitionId?: string;

  @Field(() => [String], { nullable: true })
  routeModelDefinitionAliases?: string[];

  @Field(() => Boolean, { nullable: true })
  routeModelAliasMatched?: boolean;

  @Field(() => String, { nullable: true })
  modelRegistryRevision?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionActorId?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionFingerprint?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionId?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionScope?: string;

  @Field(() => [CopilotModelRegistrySourceChainEntryType], { nullable: true })
  modelRegistryRevisionSourceChain?: CopilotModelRegistrySourceChainEntry[];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionSourceChainFingerprint?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionStatus?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionWorkspaceId?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  modelRegistryRevisionPublishEventCount?: number;

  @Field(() => [CopilotRegistryRevisionPublishEventType], { nullable: true })
  modelRegistryRevisionPublishEvents?: RegistryRevisionPublishEventRecord[];

  @Field(() => String, { nullable: true })
  routeProtocol?: string;

  @Field(() => String, { nullable: true })
  routeRequestLayer?: string;

  @Field(() => [String], { nullable: true })
  routeBehaviorFlags?: string[];

  @Field(() => [String], { nullable: true })
  routeInputTypes?: string[];

  @Field(() => [String], { nullable: true })
  routeOutputTypes?: string[];

  @Field(() => [String], { nullable: true })
  routeAttachmentKinds?: string[];

  @Field(() => [String], { nullable: true })
  routeAttachmentSourceKinds?: string[];

  @Field(() => Boolean, { nullable: true })
  routeAttachmentAllowRemoteUrls?: boolean;

  @Field(() => [String], { nullable: true })
  routeStructuredAttachmentKinds?: string[];

  @Field(() => [String], { nullable: true })
  routeStructuredAttachmentSourceKinds?: string[];

  @Field(() => Boolean, { nullable: true })
  routeStructuredAttachmentAllowRemoteUrls?: boolean;

  @Field(() => String, { nullable: true })
  providerType?: string;

  @Field(() => String, { nullable: true })
  providerPrivacy?: CopilotProviderPrivacy;

  @Field(() => String, { nullable: true })
  providerHealth?: CopilotProviderHealthStatus;

  @Field(() => String, { nullable: true })
  providerHealthCheckedAt?: string;

  @Field(() => String, { nullable: true })
  providerHealthLastError?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  providerPriority?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  contextWindow?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  maxOutputTokens?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  embeddingDimensions?: number;

  @Field(() => Number, { nullable: true })
  costInputPer1M?: number;

  @Field(() => Number, { nullable: true })
  costOutputPer1M?: number;

  @Field(() => Boolean)
  routePolicyEnabled!: boolean;

  @Field(() => String, { nullable: true })
  routePolicyFeatureKind?: string;

  @Field(() => String, { nullable: true })
  routePolicyWorkspaceId?: string;

  @Field(() => [String], { nullable: true })
  routePolicyAllowedProviderIds?: string[];

  @Field(() => [String], { nullable: true })
  routePolicyBlockedProviderIds?: string[];

  @Field(() => [String], { nullable: true })
  routePolicyAllowedPrivacy?: string[];

  @Field(() => [String], { nullable: true })
  routePolicyPreferredPrivacy?: string[];
}

@ObjectType()
class CopilotPreparedTaskRouteDiagnosticsType {
  @Field(() => String)
  providerId!: string;

  @Field(() => String, { nullable: true })
  providerName?: string;

  @Field(() => String, { nullable: true })
  providerSource?: string;

  @Field(() => String, { nullable: true })
  providerProfileId?: string;

  @Field(() => String, { nullable: true })
  providerProfileSource?: string;

  @Field(() => String, { nullable: true })
  providerProfileConfigPath?: string;

  @Field(() => [String], { nullable: true })
  providerConfiguredModelIds?: string[];

  @Field(() => SafeIntResolver, { nullable: true })
  providerConfiguredModelCount?: number;

  @Field(() => String, { nullable: true })
  providerType?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  providerPriority?: number;

  @Field(() => String)
  modelId!: string;

  @Field(() => SafeIntResolver)
  routeIndex!: number;

  @Field(() => SafeIntResolver, { nullable: true })
  fallbackOrderIndex?: number;

  @Field(() => String, { nullable: true })
  protocol?: string;

  @Field(() => String, { nullable: true })
  requestLayer?: string;

  @Field(() => String, { nullable: true })
  modelBackendKind?: string;

  @Field(() => String, { nullable: true })
  canonicalModelKey?: string;

  @Field(() => [String], { nullable: true })
  behaviorFlags?: string[];

  @Field(() => SafeIntResolver, { nullable: true })
  requestedDimensions?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  modelEmbeddingDimensions?: number;

  @Field(() => Boolean, { nullable: true })
  dimensionMismatch?: boolean;
}

@ObjectType()
class CopilotActionRunPreparedRouteDiagnosticsRouteType {
  @Field(() => String)
  providerId!: string;

  @Field(() => String)
  modelId!: string;

  @Field(() => SafeIntResolver)
  routeIndex!: number;

  @Field(() => SafeIntResolver, { nullable: true })
  fallbackOrderIndex?: number;

  @Field(() => String, { nullable: true })
  protocol?: string;

  @Field(() => String, { nullable: true })
  requestLayer?: string;

  @Field(() => String, { nullable: true })
  modelBackendKind?: string;

  @Field(() => String, { nullable: true })
  canonicalModelKey?: string;

  @Field(() => [String], { nullable: true })
  behaviorFlags?: string[];

  @Field(() => SafeIntResolver, { nullable: true })
  requestedDimensions?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  modelEmbeddingDimensions?: number;

  @Field(() => Boolean, { nullable: true })
  dimensionMismatch?: boolean;

  @Field(() => SafeIntResolver, { nullable: true })
  providerConfiguredModelCount?: number;

  @Field(() => [String], { nullable: true })
  providerConfiguredModelIds?: string[];

  @Field(() => String, { nullable: true })
  providerHealth?: string;

  @Field(() => String, { nullable: true })
  providerHealthCheckedAt?: string;

  @Field(() => String, { nullable: true })
  providerHealthLastError?: string;

  @Field(() => String, { nullable: true })
  providerName?: string;

  @Field(() => String, { nullable: true })
  providerPrivacy?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  providerPriority?: number;

  @Field(() => String, { nullable: true })
  providerProfileConfigPath?: string;

  @Field(() => String, { nullable: true })
  providerProfileId?: string;

  @Field(() => String, { nullable: true })
  providerProfileSource?: string;

  @Field(() => String, { nullable: true })
  providerSource?: string;

  @Field(() => String, { nullable: true })
  providerType?: string;

  @Field(() => Boolean, { nullable: true })
  routeModelAliasMatched?: boolean;

  @Field(() => [String], { nullable: true })
  routeModelDefinitionAliases?: string[];

  @Field(() => String, { nullable: true })
  routeModelDefinitionId?: string;

  @Field(() => String, { nullable: true })
  routeModelDefinitionSource?: string;

  @Field(() => String, { nullable: true })
  routeRawModelId?: string;
}

@ObjectType()
class CopilotActionRunPreparedRouteDiagnosticsStepType {
  @Field(() => String)
  stepId!: string;

  @Field(() => String)
  kind!: CopilotActionRunPreparedRouteTrace['steps'][number]['kind'];

  @Field(() => SafeIntResolver)
  routeCount!: number;

  @Field(() => SafeIntResolver)
  actualRouteCount!: number;

  @Field(() => Boolean)
  routeCountMismatch!: boolean;

  @Field(() => String, { nullable: true })
  requestedModelId?: string;

  @Field(() => String, { nullable: true })
  requestedModelSource?: string;

  @Field(() => [String])
  fallbackProviderIds!: string[];

  @Field(() => [CopilotActionRunPreparedRouteDiagnosticsRouteType])
  routes!: CopilotActionRunPreparedRouteDiagnosticsRouteType[];
}

@ObjectType()
class CopilotActionRunPreparedRouteDiagnosticsType {
  @Field(() => String)
  type!: 'prepared_routes';

  @Field(() => String)
  status!: 'succeeded';

  @Field(() => [CopilotActionRunPreparedRouteDiagnosticsStepType])
  steps!: CopilotActionRunPreparedRouteDiagnosticsStepType[];
}

@ObjectType()
class CopilotPromptRegistryPublishGateActionRouteDryRunRouteType implements CopilotPromptRegistryPublishGateActionRouteDryRunRoute {
  @Field(() => String)
  providerId!: string;

  @Field(() => String)
  modelId!: string;

  @Field(() => SafeIntResolver)
  routeIndex!: number;

  @Field(() => SafeIntResolver, { nullable: true })
  fallbackOrderIndex?: number;

  @Field(() => String, { nullable: true })
  protocol?: string;

  @Field(() => String, { nullable: true })
  requestLayer?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  providerConfiguredModelCount?: number;

  @Field(() => [String], { nullable: true })
  providerConfiguredModelIds?: string[];

  @Field(() => String, { nullable: true })
  providerHealth?: string;

  @Field(() => String, { nullable: true })
  providerHealthCheckedAt?: string;

  @Field(() => String, { nullable: true })
  providerHealthLastError?: string;

  @Field(() => String, { nullable: true })
  providerName?: string;

  @Field(() => String, { nullable: true })
  providerPrivacy?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  providerPriority?: number;

  @Field(() => String, { nullable: true })
  providerProfileConfigPath?: string;

  @Field(() => String, { nullable: true })
  providerProfileId?: string;

  @Field(() => String, { nullable: true })
  providerProfileSource?: string;

  @Field(() => String, { nullable: true })
  providerSource?: string;

  @Field(() => String, { nullable: true })
  providerType?: string;

  @Field(() => Boolean, { nullable: true })
  routeModelAliasMatched?: boolean;

  @Field(() => [String], { nullable: true })
  routeModelDefinitionAliases?: string[];

  @Field(() => String, { nullable: true })
  routeModelDefinitionId?: string;

  @Field(() => String, { nullable: true })
  routeModelDefinitionSource?: string;

  @Field(() => String, { nullable: true })
  routeRawModelId?: string;
}

@ObjectType()
class CopilotPromptRegistryPublishGateActionRouteDryRunStepType implements CopilotPromptRegistryPublishGateActionRouteDryRunStep {
  @Field(() => String)
  stepId!: string;

  @Field(() => String)
  kind!: CopilotPromptRegistryPublishGateActionRouteDryRunStep['kind'];

  @Field(() => SafeIntResolver)
  routeCount!: number;

  @Field(() => SafeIntResolver)
  actualRouteCount!: number;

  @Field(() => Boolean)
  routeCountMismatch!: boolean;

  @Field(() => String, { nullable: true })
  requestedModelId?: string;

  @Field(() => String, { nullable: true })
  requestedModelSource?: string;

  @Field(() => [String])
  fallbackProviderIds!: string[];

  @Field(() => [CopilotPromptRegistryPublishGateActionRouteDryRunRouteType])
  routes!: CopilotPromptRegistryPublishGateActionRouteDryRunRoute[];
}

@ObjectType()
class CopilotPromptRegistryPublishGateActionRouteDryRunType implements CopilotPromptRegistryPublishGateActionRouteDryRun {
  @Field(() => String, { nullable: true })
  actionId?: string;

  @Field(() => SafeIntResolver)
  actualRouteCount!: CopilotPromptRegistryPublishGateActionRouteDryRun['actualRouteCount'];

  @Field(() => String, { nullable: true })
  diagnosticsErrorCode?: string;

  @Field(() => String, { nullable: true })
  diagnosticsErrorMessage?: string;

  @Field(() => String, { nullable: true })
  diagnosticsErrorStage?: string;

  @Field(() => String, { nullable: true })
  errorCode?: string;

  @Field(() => String, { nullable: true })
  errorMessage?: string;

  @Field(() => SafeIntResolver)
  expectedRouteCount!: CopilotPromptRegistryPublishGateActionRouteDryRun['expectedRouteCount'];

  @Field(() => String)
  featureKind!: string;

  @Field(() => SafeIntResolver)
  missingRouteCount!: CopilotPromptRegistryPublishGateActionRouteDryRun['missingRouteCount'];

  @Field(() => Boolean)
  routeCountMismatch!: CopilotPromptRegistryPublishGateActionRouteDryRun['routeCountMismatch'];

  @Field(() => [String])
  routeCountMismatchStepIds!: CopilotPromptRegistryPublishGateActionRouteDryRun['routeCountMismatchStepIds'];

  @Field(() => String)
  status!: CopilotPromptRegistryPublishGateActionRouteDryRun['status'];

  @Field(() => [CopilotPromptRegistryPublishGateActionRouteDryRunStepType])
  steps!: CopilotPromptRegistryPublishGateActionRouteDryRunStep[];
}

@ObjectType()
class CopilotTaskRoutePolicyCandidateDiagnosticsType {
  @Field(() => String)
  candidateFingerprint!: string;

  @Field(() => String)
  candidateKey!: string;

  @Field(() => String)
  providerId!: string;

  @Field(() => String, { nullable: true })
  providerName?: string;

  @Field(() => String, { nullable: true })
  providerProfileId?: string;

  @Field(() => String, { nullable: true })
  providerProfileSource?: string;

  @Field(() => String, { nullable: true })
  providerProfileConfigPath?: string;

  @Field(() => [String], { nullable: true })
  providerConfiguredModelIds?: string[];

  @Field(() => SafeIntResolver, { nullable: true })
  providerConfiguredModelCount?: number;

  @Field(() => String, { nullable: true })
  providerSource?: string;

  @Field(() => String, { nullable: true })
  providerType?: string;

  @Field(() => Boolean, { nullable: true })
  registryAvailable?: boolean;

  @Field(() => String, { nullable: true })
  registryKind?: string;

  @Field(() => Boolean, { nullable: true })
  registrySelected?: boolean;

  @Field(() => SafeIntResolver, { nullable: true })
  providerPriority?: number;

  @Field(() => String)
  privacy!: string;

  @Field(() => String)
  health!: string;

  @Field(() => String, { nullable: true })
  healthCheckedAt?: string;

  @Field(() => Boolean)
  available!: boolean;

  @Field(() => Boolean)
  allowed!: boolean;

  @Field(() => [String])
  reasons!: string[];
}

@ObjectType()
class CopilotTaskRouteCandidateDiagnosticsType {
  @Field(() => String, { nullable: true })
  candidateKey?: string;

  @Field(() => Number, { nullable: true })
  costInputPer1M?: number;

  @Field(() => Number, { nullable: true })
  costOutputPer1M?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  routeContextWindow?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  routeMaxOutputTokens?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  routeEmbeddingDimensions?: number;

  @Field(() => [String], { nullable: true })
  routeInputTypes?: string[];

  @Field(() => [String], { nullable: true })
  routeOutputTypes?: string[];

  @Field(() => [String], { nullable: true })
  routeAttachmentKinds?: string[];

  @Field(() => [String], { nullable: true })
  routeAttachmentSourceKinds?: string[];

  @Field(() => Boolean, { nullable: true })
  routeAttachmentAllowRemoteUrls?: boolean;

  @Field(() => [String], { nullable: true })
  routeStructuredAttachmentKinds?: string[];

  @Field(() => [String], { nullable: true })
  routeStructuredAttachmentSourceKinds?: string[];

  @Field(() => Boolean, { nullable: true })
  routeStructuredAttachmentAllowRemoteUrls?: boolean;

  @Field(() => String, { nullable: true })
  registryKind?: string;

  @Field(() => Boolean, { nullable: true })
  registryAvailable?: boolean;

  @Field(() => Boolean, { nullable: true })
  registrySelected?: boolean;

  @Field(() => String)
  providerId!: string;

  @Field(() => String, { nullable: true })
  providerName?: string;

  @Field(() => String, { nullable: true })
  providerSource?: string;

  @Field(() => String, { nullable: true })
  providerProfileId?: string;

  @Field(() => String, { nullable: true })
  providerProfileSource?: string;

  @Field(() => String, { nullable: true })
  providerProfileConfigPath?: string;

  @Field(() => [String], { nullable: true })
  providerConfiguredModelIds?: string[];

  @Field(() => SafeIntResolver, { nullable: true })
  providerConfiguredModelCount?: number;

  @Field(() => String, { nullable: true })
  providerType?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  providerPriority?: number;

  @Field(() => String, { nullable: true })
  privacy?: string;

  @Field(() => String, { nullable: true })
  health?: string;

  @Field(() => String, { nullable: true })
  healthCheckedAt?: string;

  @Field(() => String, { nullable: true })
  requestedModelId?: string;

  @Field(() => String, { nullable: true })
  modelId?: string;

  @Field(() => String, { nullable: true })
  routeRawModelId?: string;

  @Field(() => String, { nullable: true })
  routeModelDefinitionSource?: CopilotModelDefinitionSource;

  @Field(() => String, { nullable: true })
  routeModelDefinitionId?: string;

  @Field(() => [String], { nullable: true })
  routeModelDefinitionAliases?: string[];

  @Field(() => Boolean, { nullable: true })
  routeModelAliasMatched?: boolean;

  @Field(() => String, { nullable: true })
  modelRegistryRevision?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionActorId?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionFingerprint?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionId?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionScope?: string;

  @Field(() => [CopilotModelRegistrySourceChainEntryType], { nullable: true })
  modelRegistryRevisionSourceChain?: CopilotModelRegistrySourceChainEntry[];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionSourceChainFingerprint?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionStatus?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionWorkspaceId?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  modelRegistryRevisionPublishEventCount?: number;

  @Field(() => [CopilotRegistryRevisionPublishEventType], { nullable: true })
  modelRegistryRevisionPublishEvents?: RegistryRevisionPublishEventRecord[];

  @Field(() => [String], { nullable: true })
  candidateModelIds?: string[];

  @Field(() => Boolean)
  matched!: boolean;

  @Field(() => [String])
  reasons!: string[];
}

@ObjectType()
class CopilotTaskRoutePrepareCandidateDiagnosticsType {
  @Field(() => String, { nullable: true })
  candidateKey?: string;

  @Field(() => Number, { nullable: true })
  costInputPer1M?: number;

  @Field(() => Number, { nullable: true })
  costOutputPer1M?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  routeContextWindow?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  routeMaxOutputTokens?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  routeEmbeddingDimensions?: number;

  @Field(() => [String], { nullable: true })
  routeInputTypes?: string[];

  @Field(() => [String], { nullable: true })
  routeOutputTypes?: string[];

  @Field(() => [String], { nullable: true })
  routeAttachmentKinds?: string[];

  @Field(() => [String], { nullable: true })
  routeAttachmentSourceKinds?: string[];

  @Field(() => Boolean, { nullable: true })
  routeAttachmentAllowRemoteUrls?: boolean;

  @Field(() => [String], { nullable: true })
  routeStructuredAttachmentKinds?: string[];

  @Field(() => [String], { nullable: true })
  routeStructuredAttachmentSourceKinds?: string[];

  @Field(() => Boolean, { nullable: true })
  routeStructuredAttachmentAllowRemoteUrls?: boolean;

  @Field(() => String, { nullable: true })
  registryKind?: string;

  @Field(() => Boolean, { nullable: true })
  registryAvailable?: boolean;

  @Field(() => Boolean, { nullable: true })
  registrySelected?: boolean;

  @Field(() => String)
  providerId!: string;

  @Field(() => String, { nullable: true })
  providerName?: string;

  @Field(() => String, { nullable: true })
  providerSource?: string;

  @Field(() => String, { nullable: true })
  providerProfileId?: string;

  @Field(() => String, { nullable: true })
  providerProfileSource?: string;

  @Field(() => String, { nullable: true })
  providerProfileConfigPath?: string;

  @Field(() => [String], { nullable: true })
  providerConfiguredModelIds?: string[];

  @Field(() => SafeIntResolver, { nullable: true })
  providerConfiguredModelCount?: number;

  @Field(() => String, { nullable: true })
  providerType?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  providerPriority?: number;

  @Field(() => String, { nullable: true })
  privacy?: string;

  @Field(() => String, { nullable: true })
  health?: string;

  @Field(() => String, { nullable: true })
  healthCheckedAt?: string;

  @Field(() => String, { nullable: true })
  requestedModelId?: string;

  @Field(() => String, { nullable: true })
  modelId?: string;

  @Field(() => String, { nullable: true })
  routeRawModelId?: string;

  @Field(() => String, { nullable: true })
  routeModelDefinitionSource?: CopilotModelDefinitionSource;

  @Field(() => String, { nullable: true })
  routeModelDefinitionId?: string;

  @Field(() => [String], { nullable: true })
  routeModelDefinitionAliases?: string[];

  @Field(() => Boolean, { nullable: true })
  routeModelAliasMatched?: boolean;

  @Field(() => String, { nullable: true })
  modelRegistryRevision?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionActorId?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionFingerprint?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionId?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionScope?: string;

  @Field(() => [CopilotModelRegistrySourceChainEntryType], { nullable: true })
  modelRegistryRevisionSourceChain?: CopilotModelRegistrySourceChainEntry[];

  @Field(() => String, { nullable: true })
  modelRegistryRevisionSourceChainFingerprint?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionStatus?: string;

  @Field(() => String, { nullable: true })
  modelRegistryRevisionWorkspaceId?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  modelRegistryRevisionPublishEventCount?: number;

  @Field(() => [CopilotRegistryRevisionPublishEventType], { nullable: true })
  modelRegistryRevisionPublishEvents?: RegistryRevisionPublishEventRecord[];

  @Field(() => [String], { nullable: true })
  candidateModelIds?: string[];

  @Field(() => Boolean)
  prepared!: boolean;

  @Field(() => String, { nullable: true })
  preparedModelId?: string;

  @Field(() => String, { nullable: true })
  errorCode?: string;

  @Field(() => String, { nullable: true })
  errorCategory?: string;

  @Field(() => [String])
  reasons!: string[];
}

@ObjectType()
class CopilotTaskRouteTracePhaseDiagnosticsType {
  @Field(() => String)
  phase!: string;

  @Field(() => SafeIntResolver)
  candidateCount!: number;

  @Field(() => SafeIntResolver, { nullable: true })
  availableCount?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  selectedCount?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  blockedCount?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  matchedCount?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  preparedCount?: number;

  @Field(() => [String])
  reasons!: string[];
}

@ObjectType()
class CopilotTaskRouteDiagnosticsErrorType implements CopilotTaskRouteDiagnosticsError {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  message!: string;

  @Field(() => String)
  stage!: string;
}

@ObjectType()
class CopilotTaskRoutePolicySourceChainEntryType implements TaskRoutePolicySourceChainEntry {
  @Field(() => String)
  source!: TaskRoutePolicySourceChainEntry['source'];

  @Field(() => String)
  scope!: TaskRoutePolicySourceChainEntry['scope'];

  @Field(() => String)
  status!: TaskRoutePolicySourceChainEntry['status'];

  @Field(() => String, { nullable: true })
  actorId?: string;

  @Field(() => String, { nullable: true })
  configKey?: string;

  @Field(() => String, { nullable: true })
  configPath?: string;

  @Field(() => String, { nullable: true })
  featureKind?: TaskRoutePolicySourceChainEntry['featureKind'];

  @Field(() => String, { nullable: true })
  fingerprint?: string;

  @Field(() => String, { nullable: true })
  modelId?: string;

  @Field(() => String, { nullable: true })
  revision?: string;

  @Field(() => String, { nullable: true })
  updatedAt?: string;

  @Field(() => String, { nullable: true })
  workspaceId?: string;
}

@ObjectType()
class CopilotTaskRouteDiagnosticsType {
  @Field(() => Boolean)
  configured!: boolean;

  @Field(() => String, { nullable: true })
  effectiveSourceFingerprint?: string;

  @Field(() => [String], { nullable: true })
  effectiveSourceFingerprintInputs?: string[];

  @Field(() => String, { nullable: true })
  effectiveSourceFingerprintVersion?: string;

  @Field(() => [CopilotTaskRouteDiagnosticsErrorType])
  diagnosticsErrors!: CopilotTaskRouteDiagnosticsError[];

  @Field(() => String, { nullable: true })
  errorCode?: string;

  @Field(() => String, { nullable: true })
  errorMessage?: string;

  @Field(() => String)
  featureKind!: string;

  @Field(() => Boolean)
  policyEnabled!: boolean;

  @Field(() => String, { nullable: true })
  policyFeatureKind?: string;

  @Field(() => String, { nullable: true })
  policyWorkspaceId?: string;

  @Field(() => [String], { nullable: true })
  policyAllowedProviderIds?: string[];

  @Field(() => [String], { nullable: true })
  policyBlockedProviderIds?: string[];

  @Field(() => [String], { nullable: true })
  policyAllowedPrivacy?: string[];

  @Field(() => [String], { nullable: true })
  policyPreferredPrivacy?: string[];

  @Field(() => [CopilotTaskRoutePolicyCandidateDiagnosticsType])
  policyCandidates!: CopilotTaskRoutePolicyCandidateDiagnosticsType[];

  @Field(() => [CopilotTaskRouteCandidateDiagnosticsType])
  routeCandidates!: CopilotTaskRouteCandidateDiagnosticsType[];

  @Field(() => [CopilotTaskRouteTracePhaseDiagnosticsType])
  routeTrace!: CopilotTaskRouteTracePhaseDiagnosticsType[];

  @Field(() => [CopilotTaskRoutePrepareCandidateDiagnosticsType])
  prepareCandidates!: CopilotTaskRoutePrepareCandidateDiagnosticsType[];

  @Field(() => String, { nullable: true })
  requestedModelId?: string;

  @Field(() => String, { nullable: true })
  requestedModelConfigKey?: string;

  @Field(() => String, { nullable: true })
  requestedModelConfigPath?: string;

  @Field(() => String, { nullable: true })
  requestedModelSource?: string;

  @Field(() => String, { nullable: true })
  taskRoutePolicyRevision?: string;

  @Field(() => String, { nullable: true })
  taskRoutePolicyRevisionActorId?: string;

  @Field(() => String, { nullable: true })
  taskRoutePolicyRevisionFingerprint?: string;

  @Field(() => String, { nullable: true })
  taskRoutePolicyRevisionId?: string;

  @Field(() => String, { nullable: true })
  taskRoutePolicyRevisionScope?: string;

  @Field(() => [CopilotTaskRoutePolicySourceChainEntryType], {
    nullable: true,
  })
  taskRoutePolicyRevisionSourceChain?: TaskRoutePolicySourceChainEntry[];

  @Field(() => String, { nullable: true })
  taskRoutePolicyRevisionSourceChainFingerprint?: string;

  @Field(() => String, { nullable: true })
  taskRoutePolicyRevisionStatus?: string;

  @Field(() => String, { nullable: true })
  taskRoutePolicyRevisionWorkspaceId?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  taskRoutePolicyRevisionPublishEventCount?: number;

  @Field(() => [CopilotRegistryRevisionPublishEventType], { nullable: true })
  taskRoutePolicyRevisionPublishEvents?: RegistryRevisionPublishEventRecord[];

  @Field(() => String, { nullable: true })
  providerId?: string;

  @Field(() => String, { nullable: true })
  providerName?: string;

  @Field(() => String, { nullable: true })
  providerSource?: string;

  @Field(() => String, { nullable: true })
  providerProfileId?: string;

  @Field(() => String, { nullable: true })
  providerProfileSource?: string;

  @Field(() => String, { nullable: true })
  providerProfileConfigPath?: string;

  @Field(() => [String], { nullable: true })
  providerConfiguredModelIds?: string[];

  @Field(() => SafeIntResolver, { nullable: true })
  providerConfiguredModelCount?: number;

  @Field(() => String, { nullable: true })
  providerType?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  providerPriority?: number;

  @Field(() => String, { nullable: true })
  modelId?: string;

  @Field(() => String, { nullable: true })
  protocol?: string;

  @Field(() => String, { nullable: true })
  requestLayer?: string;

  @Field(() => String, { nullable: true })
  modelBackendKind?: string;

  @Field(() => String, { nullable: true })
  canonicalModelKey?: string;

  @Field(() => [String], { nullable: true })
  behaviorFlags?: string[];

  @Field(() => [String])
  fallbackProviderIds!: string[];

  @Field(() => [CopilotPreparedTaskRouteDiagnosticsType])
  preparedRoutes!: CopilotPreparedTaskRouteDiagnosticsType[];

  @Field(() => SafeIntResolver)
  preparedProviderCount!: number;

  @Field(() => [String])
  preparedRouteTargets!: string[];

  @Field(() => String)
  preparedRouteTargetFingerprint!: string;

  @Field(() => SafeIntResolver, { nullable: true })
  requestedDimensions?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  modelEmbeddingDimensions?: number;

  @Field(() => Boolean, { nullable: true })
  dimensionMismatch?: boolean;

  @Field(() => String, { nullable: true })
  embeddingIndexContractVersion?: string;

  @Field(() => String, { nullable: true })
  embeddingIndexContractStatus?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  embeddingIndexContractDimensions?: number;

  @Field(() => String, { nullable: true })
  embeddingIndexContractFingerprint?: string;

  @Field(() => String, { nullable: true })
  rerankRuntimeContractVersion?: string;

  @Field(() => String, { nullable: true })
  rerankRuntimeContractStatus?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  rerankRuntimeContractTopK?: number;

  @Field(() => String, { nullable: true })
  rerankRuntimeContractFingerprint?: string;

  @Field(() => SafeIntResolver, { nullable: true })
  candidateCount?: number;

  @Field(() => SafeIntResolver, { nullable: true })
  topK?: number;
}

@ObjectType()
export class CopilotModelsType {
  @Field(() => String)
  defaultModel!: string;

  @Field(() => String)
  promptDefaultModel!: string;

  @Field(() => String)
  defaultModelSource!: 'prompt' | 'fallback_route';

  @Field(() => String, { nullable: true })
  defaultModelFallbackReason?: string;

  @Field(() => [CopilotModelType])
  optionalModels!: CopilotModelType[];

  @Field(() => [CopilotModelType])
  proModels!: CopilotModelType[];

  @Field(() => CopilotTaskRouteDiagnosticsType, { nullable: true })
  embeddingRoute?: CopilotTaskRouteDiagnosticsType;

  @Field(() => CopilotTaskRouteDiagnosticsType, { nullable: true })
  rerankRoute?: CopilotTaskRouteDiagnosticsType;
}

@ObjectType()
export class CopilotSessionType {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  docId!: string | null;

  @Field(() => ID, { nullable: true })
  selectedContextProjectId!: string | null;

  @Field(() => Boolean)
  pinned!: boolean;

  @Field(() => String, { nullable: true })
  title!: string | null;

  @Field(() => ID, { nullable: true })
  parentSessionId!: string | null;

  @Field(() => String)
  promptName!: string;

  @Field(() => String)
  model!: string;

  @Field(() => [String])
  optionalModels!: string[];
}

// ================== Resolver ==================

@ObjectType('Copilot')
export class CopilotType {
  @Field(() => ID, { nullable: true })
  workspaceId!: string | null;
}

@Throttle()
@Resolver(() => CopilotType)
export class CopilotResolver {
  private readonly modelNames = new Map<string, string>();

  constructor(
    private readonly ac: PermissionAccess,
    private readonly mutex: RequestMutex,
    private readonly prompt: PromptService,
    private readonly chatSession: ChatSessionService,
    private readonly historyProjector: CompatHistoryProjector,
    private readonly inbox: ConversationInboxService,
    private readonly contextScopeResolver: ContextScopeResolver,
    private readonly providerFactory: CopilotProviderFactory,
    private readonly providerRegistry: CopilotProviderRegistryService,
    private readonly capabilityRuntime: CapabilityRuntime,
    private readonly taskPolicy: TaskPolicy,
    private readonly modelsStore: Models,
    private readonly url: URLHelper,
    private readonly jobs: JobQueue,
    private readonly officeAgentCommands: OfficeAgentCommandService,
    @Optional() private readonly plans?: ExecutionPlanBuilder,
    @Optional()
    private readonly agentRuntimeWorkflowRegistry?: CopilotAgentRuntimeWorkflowRegistry
  ) {}

  private async projectTaskForViewer(
    run: CopilotAgentRunRecord,
    userId: string
  ) {
    return await projectCopilotTaskForViewer(run, userId, this.ac);
  }

  @ResolveField(() => CopilotQuotaType, {
    name: 'quota',
    description: 'Get the quota of the user in the workspace',
    complexity: 2,
  })
  async getQuota(@CurrentUser() user: CurrentUser): Promise<CopilotQuotaType> {
    return await this.chatSession.getQuota(user.id);
  }

  private async assertPermission(
    user: CurrentUser,
    options: { workspaceId?: string | null; docId?: string | null },
    fallbackAction?: DocAction
  ) {
    const { workspaceId, docId } = options;
    if (!workspaceId) {
      throw new NotFoundException('Workspace not found');
    }
    if (docId) {
      await this.ac
        .user(user.id)
        .doc({ workspaceId, docId })
        .allowLocal()
        .assert(fallbackAction ?? 'Doc.Update');
    } else {
      await this.ac
        .user(user.id)
        .workspace(workspaceId)
        .allowLocal()
        .assert('Workspace.Copilot');
    }
    return { userId: user.id, workspaceId, docId: docId || undefined };
  }

  private toSupportBundleDownloadAuthorizationType(
    authorization:
      | CopilotSupportBundleDownloadAuthorization
      | CopilotSupportBundleDownloadAuthorizationResult
  ): CopilotSupportBundleDownloadAuthorizationType {
    if (authorization.directDownloadUrl) {
      return {
        ...authorization,
        downloadUrl: authorization.directDownloadUrl,
      };
    }
    if (!('downloadToken' in authorization)) {
      throw new Error(
        'Support bundle API proxy download token is not available'
      );
    }
    return {
      ...authorization,
      downloadUrl: this.url.link(
        `/api/copilot/support-bundles/${authorization.id}/artifact`,
        {
          token: authorization.downloadToken,
        }
      ),
    };
  }

  private providerRegistryFallbackSourceChain(
    profile: NormalizedCopilotProviderProfile
  ): ProviderRegistrySourceChainEntry[] {
    return [
      {
        source:
          profile.source === 'legacy'
            ? ('legacy_profile' as const)
            : ('provider_profile' as const),
        scope: 'global' as const,
        status: profile.enabled ? 'available' : 'disabled',
        providerId: profile.id,
        providerType: profile.type,
        revision: profile.source,
        fingerprint: createHash('sha256')
          .update(
            stableRepairRecommendationStringify({
              version: 'provider-registry-publish-fallback-source/v1',
              providerId: profile.id,
              providerProfileConfigPath: providerProfileConfigPath(profile),
              providerSource: profile.source,
              providerType: profile.type,
            })
          )
          .digest('hex')
          .slice(0, 16),
      },
    ];
  }

  private modelRegistryFallbackSourceChain(
    profile: NormalizedCopilotProviderProfile,
    modelId: string
  ): ModelRegistrySourceChainEntry[] {
    const profileModel = profile.modelDefinitions.find(definition => {
      return (
        definition.id === modelId ||
        definition.rawModelId === modelId ||
        (definition.aliases ?? []).includes(modelId)
      );
    });

    return [
      {
        source: 'provider_profile' as const,
        scope: 'global' as const,
        status: profileModel ? 'available' : 'provider_available',
        providerId: profile.id,
        modelId,
        revision: profile.source,
        fingerprint: createHash('sha256')
          .update(
            stableRepairRecommendationStringify({
              version: 'model-registry-publish-fallback-source/v1',
              providerId: profile.id,
              providerProfileConfigPath: providerProfileConfigPath(profile),
              providerSource: profile.source,
              modelId,
              profileModelId: profileModel?.id ?? null,
            })
          )
          .digest('hex')
          .slice(0, 16),
      },
    ];
  }

  private taskRoutePolicyFallbackModel(
    featureKind: TaskRoutePolicyFeatureKind
  ) {
    if (featureKind === 'embedding') {
      return this.taskPolicy.resolveEmbeddingModel();
    }
    if (featureKind === 'workspace_indexing') {
      return this.taskPolicy.resolveWorkspaceIndexingModel();
    }
    if (featureKind === 'rerank') {
      return this.taskPolicy.resolveRerankModel();
    }
    throw new Error('Unsupported task route policy feature kind');
  }

  private taskRoutePolicyFallbackSourceChain(
    featureKind: TaskRoutePolicyFeatureKind,
    model: ReturnType<TaskPolicy['resolveRerankModel']>
  ): TaskRoutePolicySourceChainEntry[] {
    if (model.modelId) {
      return [
        {
          source: 'config_fallback',
          scope: 'global',
          status: 'available',
          featureKind,
          modelId: model.modelId,
          ...(model.configKey ? { configKey: model.configKey } : {}),
          ...(model.configPath ? { configPath: model.configPath } : {}),
        },
      ];
    }

    return [
      {
        source: 'provider_default',
        scope: 'global',
        status: 'available',
        featureKind,
      },
    ];
  }

  private taskRoutePolicyOutputType(featureKind: TaskRoutePolicyFeatureKind) {
    return featureKind === 'rerank'
      ? ModelOutputType.Rerank
      : ModelOutputType.Embedding;
  }

  private async assertTaskRoutePolicyPublishRouteable(input: {
    featureKind: TaskRoutePolicyFeatureKind;
    modelId: string;
    workspaceId: string;
  }) {
    const candidates = await this.providerFactory.describeRouteCandidates(
      {
        modelId: input.modelId,
        outputType: this.taskRoutePolicyOutputType(input.featureKind),
      },
      {},
      {
        workspaceId: input.workspaceId,
        featureKind: input.featureKind,
      }
    );
    if (!candidates.some(candidate => candidate.matched)) {
      throw new Error('Task route policy model is not routeable');
    }
  }

  @ResolveField(() => [CopilotPromptCatalogItemType], {
    description: 'List prompt catalog metadata for diagnostics',
    complexity: 2,
  })
  async prompts(
    @Parent() copilot: CopilotType
  ): Promise<CopilotPromptCatalogItemType[]> {
    return this.prompt.listCatalog(copilot?.workspaceId);
  }

  private async resolveTaskRouteDiagnostics(copilot?: CopilotType): Promise<{
    embeddingRoute: CopilotTaskRouteDiagnosticsType;
    rerankRoute: CopilotTaskRouteDiagnosticsType;
  }> {
    const taskRouteOptions = copilot?.workspaceId
      ? { workspace: copilot.workspaceId }
      : {};
    const workspaceIndexingModel =
      await this.taskPolicy.resolveEffectiveWorkspaceIndexingModel(
        copilot?.workspaceId
      );
    const rerankModel = await this.taskPolicy.resolveEffectiveRerankModel(
      copilot?.workspaceId
    );
    const workspaceIndexingModelId = workspaceIndexingModel.modelId;
    const rerankModelId = rerankModel.modelId;
    const embeddingRoutePolicyContext = {
      ...(copilot?.workspaceId ? { workspaceId: copilot.workspaceId } : {}),
      featureKind: 'workspace_indexing' as const,
    };
    const rerankRoutePolicyContext = {
      ...(copilot?.workspaceId ? { workspaceId: copilot.workspaceId } : {}),
      featureKind: 'rerank' as const,
    };
    const embeddingRoutePolicy = this.providerFactory.describeRoutePolicy(
      embeddingRoutePolicyContext,
      ModelOutputType.Embedding
    );
    const describeEmbeddingRoutePolicyCandidates = () =>
      this.providerFactory.describeEffectiveRoutePolicyCandidates(
        embeddingRoutePolicyContext,
        ModelOutputType.Embedding
      );
    const describeEmbeddingRouteCandidates = () =>
      this.providerFactory.describeRouteCandidates(
        {
          modelId: workspaceIndexingModelId,
          outputType: ModelOutputType.Embedding,
        },
        {},
        embeddingRoutePolicyContext
      );
    const describeEmbeddingPrepareCandidates = () =>
      this.providerFactory.describeEmbeddingPrepareCandidates(
        workspaceIndexingModelId,
        'ping',
        {
          ...taskRouteOptions,
          dimensions: EMBEDDING_DIMENSIONS,
          featureKind: 'workspace_indexing',
        }
      );
    const rerankRoutePolicy = this.providerFactory.describeRoutePolicy(
      rerankRoutePolicyContext,
      ModelOutputType.Rerank
    );
    const describeRerankRoutePolicyCandidates = () =>
      this.providerFactory.describeEffectiveRoutePolicyCandidates(
        rerankRoutePolicyContext,
        ModelOutputType.Rerank
      );
    const describeRerankRouteCandidates = () =>
      this.providerFactory.describeRouteCandidates(
        {
          modelId: rerankModelId,
          outputType: ModelOutputType.Rerank,
        },
        {},
        rerankRoutePolicyContext
      );
    const rerankProbeRequest = {
      query: 'ping',
      candidates: [{ text: 'ping' }],
    };
    const describeRerankPrepareCandidates = () =>
      this.providerFactory.describeRerankPrepareCandidates(
        rerankModelId,
        rerankProbeRequest,
        {
          ...taskRouteOptions,
          featureKind: 'rerank',
        }
      );
    const describeEmbeddingRoute =
      async (): Promise<CopilotTaskRouteDiagnosticsType> => {
        const [
          routePolicyCandidatesResult,
          routeResult,
          routeCandidatesResult,
          prepareCandidatesResult,
        ] = await Promise.all([
          settleTaskRouteDiagnosticsProbe(
            'describe_route_policy_candidates',
            describeEmbeddingRoutePolicyCandidates
          ),
          settleTaskRouteDiagnosticsProbe('describe_embedding_route', () =>
            this.capabilityRuntime.describeEmbeddingRoute(
              workspaceIndexingModelId,
              {
                ...taskRouteOptions,
                dimensions: EMBEDDING_DIMENSIONS,
                featureKind: 'workspace_indexing',
              }
            )
          ),
          settleTaskRouteDiagnosticsProbe(
            'describe_route_candidates',
            describeEmbeddingRouteCandidates
          ),
          settleTaskRouteDiagnosticsProbe(
            'describe_embedding_prepare_candidates',
            describeEmbeddingPrepareCandidates
          ),
        ]);
        const diagnosticsErrors = [
          ...routePolicyCandidatesResult.errors,
          ...routeResult.errors,
          ...routeCandidatesResult.errors,
          ...prepareCandidatesResult.errors,
        ];
        const embeddingRoutePolicyCandidates = withTaskRoutePolicyCandidateKeys(
          routePolicyCandidatesResult.value ?? [],
          embeddingRoutePolicyContext
        );
        const route = routeResult.value;
        const routeCandidates: CopilotTaskRouteCandidateDiagnosticsType[] = (
          routeCandidatesResult.value ?? []
        ).map(candidate => {
          const { modelRegistryRevisionSourceChain, ...routeCandidate } =
            candidate;
          return {
            ...routeCandidate,
            ...(modelRegistryRevisionSourceChain
              ? {
                  modelRegistryRevisionSourceChain:
                    modelRegistryRevisionSourceChain as CopilotModelRegistrySourceChainEntry[],
                }
              : {}),
            candidateKey: buildTaskRouteCandidateKey(candidate),
          };
        });
        const providerPrepareCandidates = prepareCandidatesResult.value ?? [];
        const emptyPreparedTargetSummary = buildTaskRoutePreparedTargetSummary({
          featureKind: 'workspace_indexing',
          preparedRoutes: [],
          requestedModelConfigKey: workspaceIndexingModel.configKey,
          requestedModelConfigPath: workspaceIndexingModel.configPath,
          requestedModelId: workspaceIndexingModelId,
          requestedModelSource: workspaceIndexingModel.source,
        });
        if (!route) {
          return {
            configured: false,
            diagnosticsErrors,
            errorCode: routeResult.errors[0]?.code,
            errorMessage: routeResult.errors[0]?.message,
            featureKind: 'workspace_indexing',
            ...taskRoutePolicyMetadata(embeddingRoutePolicy),
            policyCandidates: embeddingRoutePolicyCandidates,
            routeCandidates,
            routeTrace: buildTaskRouteTrace(
              embeddingRoutePolicyCandidates,
              routeCandidates,
              [],
              providerPrepareCandidates
            ),
            prepareCandidates: buildTaskRoutePrepareCandidates(
              routeCandidates,
              [],
              providerPrepareCandidates,
              diagnosticsErrors
            ),
            requestedModelId: workspaceIndexingModelId,
            requestedModelConfigKey: workspaceIndexingModel.configKey,
            requestedModelConfigPath: workspaceIndexingModel.configPath,
            requestedModelSource: workspaceIndexingModel.source,
            ...taskRoutePolicyRevisionMetadata(workspaceIndexingModel),
            fallbackProviderIds: [],
            preparedRoutes: [],
            preparedProviderCount: 0,
            ...emptyPreparedTargetSummary,
            requestedDimensions: EMBEDDING_DIMENSIONS,
            ...buildEmbeddingIndexContractSnapshot({
              featureKind: 'workspace_indexing',
              requestedDimensions: EMBEDDING_DIMENSIONS,
            }),
          };
        }
        const prepareCandidates = buildTaskRoutePrepareCandidates(
          routeCandidates,
          route.preparedRoutes,
          providerPrepareCandidates,
          diagnosticsErrors
        );
        const preparedTargetSummary = buildTaskRoutePreparedTargetSummary({
          featureKind: 'workspace_indexing',
          preparedRoutes: route.preparedRoutes,
          requestedModelConfigKey: workspaceIndexingModel.configKey,
          requestedModelConfigPath: workspaceIndexingModel.configPath,
          requestedModelId: route.requestedModelId,
          requestedModelSource: workspaceIndexingModel.source,
        });
        return {
          configured: route.configured,
          diagnosticsErrors,
          errorCode: route.errorCode,
          errorMessage: route.errorMessage,
          featureKind: 'workspace_indexing',
          ...taskRoutePolicyMetadata(embeddingRoutePolicy),
          policyCandidates: embeddingRoutePolicyCandidates,
          routeCandidates,
          routeTrace: buildTaskRouteTrace(
            embeddingRoutePolicyCandidates,
            routeCandidates,
            route.preparedRoutes,
            providerPrepareCandidates
          ),
          prepareCandidates,
          requestedModelId: route.requestedModelId,
          requestedModelConfigKey: workspaceIndexingModel.configKey,
          requestedModelConfigPath: workspaceIndexingModel.configPath,
          requestedModelSource: workspaceIndexingModel.source,
          ...taskRoutePolicyRevisionMetadata(workspaceIndexingModel),
          fallbackProviderIds: route.fallbackOrder,
          preparedRoutes: route.preparedRoutes,
          preparedProviderCount: route.preparedProviderCount,
          ...preparedTargetSummary,
          providerId: route.providerId,
          providerName: route.providerName,
          providerSource: route.providerSource,
          providerProfileId: route.providerProfileId,
          providerProfileSource: route.providerProfileSource,
          providerProfileConfigPath: route.providerProfileConfigPath,
          providerConfiguredModelIds: route.providerConfiguredModelIds,
          providerConfiguredModelCount: route.providerConfiguredModelCount,
          providerType: route.providerType,
          providerPriority: route.providerPriority,
          modelId: route.modelId,
          protocol: route.protocol,
          requestLayer: route.requestLayer,
          modelBackendKind: route.modelBackendKind,
          canonicalModelKey: route.canonicalModelKey,
          behaviorFlags: route.behaviorFlags,
          requestedDimensions: route.requestedDimensions,
          modelEmbeddingDimensions: route.modelEmbeddingDimensions,
          dimensionMismatch: route.dimensionMismatch,
          ...buildEmbeddingIndexContractSnapshot({
            dimensionMismatch: route.dimensionMismatch,
            featureKind: 'workspace_indexing',
            modelEmbeddingDimensions: route.modelEmbeddingDimensions,
            modelId: route.modelId,
            requestedDimensions: route.requestedDimensions,
          }),
        };
      };
    const describeRerankRoute =
      async (): Promise<CopilotTaskRouteDiagnosticsType> => {
        const [
          routePolicyCandidatesResult,
          routeResult,
          routeCandidatesResult,
          prepareCandidatesResult,
        ] = await Promise.all([
          settleTaskRouteDiagnosticsProbe(
            'describe_route_policy_candidates',
            describeRerankRoutePolicyCandidates
          ),
          settleTaskRouteDiagnosticsProbe('describe_rerank_route', () =>
            this.capabilityRuntime.describeRerankRoute(rerankModelId, {
              ...taskRouteOptions,
              featureKind: 'rerank',
            })
          ),
          settleTaskRouteDiagnosticsProbe(
            'describe_route_candidates',
            describeRerankRouteCandidates
          ),
          settleTaskRouteDiagnosticsProbe(
            'describe_rerank_prepare_candidates',
            describeRerankPrepareCandidates
          ),
        ]);
        const diagnosticsErrors = [
          ...routePolicyCandidatesResult.errors,
          ...routeResult.errors,
          ...routeCandidatesResult.errors,
          ...prepareCandidatesResult.errors,
        ];
        const rerankRoutePolicyCandidates = withTaskRoutePolicyCandidateKeys(
          routePolicyCandidatesResult.value ?? [],
          rerankRoutePolicyContext
        );
        const route = routeResult.value;
        const routeCandidates: CopilotTaskRouteCandidateDiagnosticsType[] = (
          routeCandidatesResult.value ?? []
        ).map(candidate => {
          const { modelRegistryRevisionSourceChain, ...routeCandidate } =
            candidate;
          return {
            ...routeCandidate,
            ...(modelRegistryRevisionSourceChain
              ? {
                  modelRegistryRevisionSourceChain:
                    modelRegistryRevisionSourceChain as CopilotModelRegistrySourceChainEntry[],
                }
              : {}),
            candidateKey: buildTaskRouteCandidateKey(candidate),
          };
        });
        const providerPrepareCandidates = prepareCandidatesResult.value ?? [];
        const emptyPreparedTargetSummary = buildTaskRoutePreparedTargetSummary({
          featureKind: 'rerank',
          preparedRoutes: [],
          requestedModelConfigKey: rerankModel.configKey,
          requestedModelConfigPath: rerankModel.configPath,
          requestedModelId: rerankModelId,
          requestedModelSource: rerankModel.source,
        });
        if (!route) {
          return {
            configured: false,
            diagnosticsErrors,
            errorCode: routeResult.errors[0]?.code,
            errorMessage: routeResult.errors[0]?.message,
            featureKind: 'rerank',
            ...taskRoutePolicyMetadata(rerankRoutePolicy),
            policyCandidates: rerankRoutePolicyCandidates,
            routeCandidates,
            routeTrace: buildTaskRouteTrace(
              rerankRoutePolicyCandidates,
              routeCandidates,
              [],
              providerPrepareCandidates
            ),
            prepareCandidates: buildTaskRoutePrepareCandidates(
              routeCandidates,
              [],
              providerPrepareCandidates,
              diagnosticsErrors
            ),
            requestedModelId: rerankModelId,
            requestedModelConfigKey: rerankModel.configKey,
            requestedModelConfigPath: rerankModel.configPath,
            requestedModelSource: rerankModel.source,
            ...taskRoutePolicyRevisionMetadata(rerankModel),
            fallbackProviderIds: [],
            preparedRoutes: [],
            preparedProviderCount: 0,
            ...emptyPreparedTargetSummary,
            ...buildRerankRuntimeContractSnapshot({
              featureKind: 'rerank',
              preparedProviderCount: 0,
              requestedModelId: rerankModelId,
            }),
          };
        }
        const prepareCandidates = buildTaskRoutePrepareCandidates(
          routeCandidates,
          route.preparedRoutes,
          providerPrepareCandidates,
          diagnosticsErrors
        );
        const preparedTargetSummary = buildTaskRoutePreparedTargetSummary({
          featureKind: 'rerank',
          preparedRoutes: route.preparedRoutes,
          requestedModelConfigKey: rerankModel.configKey,
          requestedModelConfigPath: rerankModel.configPath,
          requestedModelId: route.requestedModelId,
          requestedModelSource: rerankModel.source,
        });
        return {
          configured: route.configured,
          diagnosticsErrors,
          errorCode: route.errorCode,
          errorMessage: route.errorMessage,
          featureKind: 'rerank',
          ...taskRoutePolicyMetadata(rerankRoutePolicy),
          policyCandidates: rerankRoutePolicyCandidates,
          routeCandidates,
          routeTrace: buildTaskRouteTrace(
            rerankRoutePolicyCandidates,
            routeCandidates,
            route.preparedRoutes,
            providerPrepareCandidates
          ),
          prepareCandidates,
          requestedModelId: route.requestedModelId,
          requestedModelConfigKey: rerankModel.configKey,
          requestedModelConfigPath: rerankModel.configPath,
          requestedModelSource: rerankModel.source,
          ...taskRoutePolicyRevisionMetadata(rerankModel),
          fallbackProviderIds: route.fallbackOrder,
          preparedRoutes: route.preparedRoutes,
          preparedProviderCount: route.preparedProviderCount,
          ...preparedTargetSummary,
          providerId: route.providerId,
          providerName: route.providerName,
          providerSource: route.providerSource,
          providerProfileId: route.providerProfileId,
          providerProfileSource: route.providerProfileSource,
          providerProfileConfigPath: route.providerProfileConfigPath,
          providerConfiguredModelIds: route.providerConfiguredModelIds,
          providerConfiguredModelCount: route.providerConfiguredModelCount,
          providerType: route.providerType,
          providerPriority: route.providerPriority,
          modelId: route.modelId,
          protocol: route.protocol,
          requestLayer: route.requestLayer,
          modelBackendKind: route.modelBackendKind,
          canonicalModelKey: route.canonicalModelKey,
          behaviorFlags: route.behaviorFlags,
          candidateCount: route.candidateCount,
          topK: route.topK,
          ...buildRerankRuntimeContractSnapshot({
            candidateCount: route.candidateCount,
            featureKind: 'rerank',
            modelId: route.modelId,
            preparedProviderCount: route.preparedProviderCount,
            requestedModelId: route.requestedModelId,
            topK: route.topK,
          }),
        };
      };

    const [embeddingRoute, rerankRoute] = await Promise.all([
      describeEmbeddingRoute(),
      describeRerankRoute(),
    ]);

    return {
      embeddingRoute: withTaskRouteEffectiveSourceFingerprint(embeddingRoute),
      rerankRoute: withTaskRouteEffectiveSourceFingerprint(rerankRoute),
    };
  }

  private async resolvePromptRegistryPublishGateModelRouteCandidate(
    candidate: PromptRegistryPublishGateModelRouteCandidate,
    routeTarget: PromptRegistryPublishGateModelRouteTarget,
    routePolicyContext: {
      featureKind: CopilotProviderRoutePolicyFeatureKind;
      workspaceId?: string;
    },
    routePolicyMetadata: PromptRegistryPublishGateRoutePolicyMetadata,
    policyCandidates: CopilotPromptRegistryPublishGatePolicyCandidate[]
  ): Promise<CopilotPromptRegistryPublishGateModelRoute> {
    const baseRoute = {
      candidateIndex: candidate.candidateIndex,
      candidateKind: candidate.candidateKind,
      ...(candidate.candidateConfigPath
        ? { candidateConfigPath: candidate.candidateConfigPath }
        : {}),
      checked: true,
      fallbackProviderIds: [],
      featureKind: routeTarget.featureKind,
      outputType: routeTarget.outputType,
      policyCandidates,
      ...(candidate.requestedModelSource
        ? { requestedModelSource: candidate.requestedModelSource }
        : {}),
      ...routePolicyMetadata,
    };

    const condition = {
      modelId: candidate.modelId,
      outputType: routeTarget.outputType,
    };
    let candidates: Awaited<
      ReturnType<CopilotProviderFactory['describeRouteCandidates']>
    > = [];
    try {
      candidates = await this.providerFactory.describeRouteCandidates(
        condition,
        {},
        routePolicyContext
      );
    } catch (error) {
      return withPromptRegistryPublishGateModelRouteEffectiveSourceFingerprint({
        ...baseRoute,
        ...promptRegistryPublishGateDiagnosticsErrorMetadata(
          'describe_route_candidates',
          error
        ),
        available: false,
        candidateCount: 0,
        configured: true,
        matchedCandidateCount: 0,
        reasons: uniqueStrings([
          'model_route_unavailable',
          'model_route_diagnostics_error',
          error instanceof Error ? error.constructor.name : 'unknown_error',
        ]),
        requestedModelId: candidate.modelId,
        routeCandidates: [],
        routeTrace: buildPromptRegistryPublishGateRouteTrace(
          policyCandidates,
          []
        ),
      });
    }
    const matchedCandidates = candidates.filter(candidate => candidate.matched);
    const selectedCandidate =
      selectPromptRegistryPublishGateRouteCandidate(candidates);
    const routeCandidates = candidates.map(
      toPromptRegistryPublishGateRouteCandidate
    );
    const routeTrace = buildPromptRegistryPublishGateRouteTrace(
      policyCandidates,
      routeCandidates
    );

    try {
      const resolved = await this.providerFactory.resolveProvider(
        condition,
        {},
        routePolicyContext
      );
      if (!resolved) {
        return withPromptRegistryPublishGateModelRouteEffectiveSourceFingerprint(
          {
            ...baseRoute,
            ...promptRegistryPublishGateRouteCandidateMetadata(
              selectedCandidate
            ),
            available: false,
            candidateCount: candidates.length,
            configured: true,
            matchedCandidateCount: matchedCandidates.length,
            reasons: uniqueStrings([
              'model_route_unavailable',
              candidates.length
                ? 'no_matching_provider_route'
                : 'no_provider_route_candidates',
              ...candidates.flatMap(candidate => candidate.reasons),
            ]),
            requestedModelId: candidate.modelId,
            routeCandidates,
            routeTrace,
          }
        );
      }

      const providerModel = resolved.provider.resolveModel(
        resolved.modelId ?? candidate.modelId,
        resolved.execution
      );
      const resolvedProviderModel = providerModel as
        | Partial<ResolvedProviderModel>
        | undefined;
      const routeModelId =
        providerModel?.id ?? resolved.modelId ?? candidate.modelId;
      const profileDefinition = resolveProfileModelDefinition(
        resolved.profile,
        candidate.modelId,
        routeModelId
      );
      const routeModelDefinitionSource = resolveModelDefinitionSource(
        resolved.profile,
        resolvedProviderModel,
        profileDefinition
      );
      const routeModelDefinitionId =
        profileDefinition?.id ?? resolvedProviderModel?.canonicalKey;
      const routeRawModelId =
        profileDefinition?.rawModelId ??
        (routeModelDefinitionId &&
        resolvedProviderModel?.id &&
        resolvedProviderModel.id !== routeModelDefinitionId
          ? resolvedProviderModel.id
          : undefined);
      const profileConfigPath = providerProfileConfigPath(resolved.profile);
      const profileModelIds = getProfileConfiguredModelIds(resolved.profile);

      return withPromptRegistryPublishGateModelRouteEffectiveSourceFingerprint({
        ...baseRoute,
        ...promptRegistryPublishGateRouteCandidateMetadata(selectedCandidate),
        available: true,
        candidateCount: candidates.length,
        configured: true,
        fallbackProviderIds: resolved.fallbackProviderIds ?? [],
        matchedCandidateCount: matchedCandidates.length,
        ...(resolvedProviderModel?.backendKind
          ? { modelBackendKind: resolvedProviderModel.backendKind }
          : {}),
        modelId: routeModelId,
        ...(resolvedProviderModel?.canonicalKey
          ? { canonicalModelKey: resolvedProviderModel.canonicalKey }
          : {}),
        ...(resolvedProviderModel?.protocol
          ? { protocol: resolvedProviderModel.protocol }
          : {}),
        providerId: resolved.providerId,
        ...(resolved.profile.displayName
          ? { providerName: resolved.profile.displayName }
          : {}),
        ...(resolved.profile.source
          ? { providerSource: resolved.profile.source }
          : {}),
        providerProfileId: resolved.profile.id,
        ...(resolved.profile.source
          ? { providerProfileSource: resolved.profile.source }
          : {}),
        ...(profileConfigPath
          ? { providerProfileConfigPath: profileConfigPath }
          : {}),
        ...(profileModelIds.length
          ? {
              providerConfiguredModelCount: profileModelIds.length,
              providerConfiguredModelIds: profileModelIds,
            }
          : {}),
        providerType: resolved.profile.type,
        providerPrivacy: resolved.profile.privacy ?? 'cloud',
        providerHealth: resolved.profile.health?.status ?? 'unknown',
        ...(resolved.profile.health?.lastCheckedAt
          ? { providerHealthCheckedAt: resolved.profile.health.lastCheckedAt }
          : {}),
        ...(resolved.profile.health?.lastError
          ? { providerHealthLastError: resolved.profile.health.lastError }
          : {}),
        providerPriority: resolved.profile.priority,
        reasons: uniqueStrings([
          'model_route_available',
          ...matchedCandidates.flatMap(candidate => candidate.reasons),
        ]),
        requestedModelId: candidate.modelId,
        routeCandidates,
        routeTrace,
        ...(resolvedProviderModel?.requestLayer
          ? { requestLayer: resolvedProviderModel.requestLayer }
          : {}),
        ...(resolvedProviderModel?.behaviorFlags?.length
          ? { behaviorFlags: resolvedProviderModel.behaviorFlags }
          : {}),
        ...(profileDefinition?.aliases?.includes(candidate.modelId) !==
        undefined
          ? {
              routeModelAliasMatched: profileDefinition?.aliases?.includes(
                candidate.modelId
              ),
            }
          : {}),
        ...(profileDefinition?.aliases?.length
          ? { routeModelDefinitionAliases: profileDefinition.aliases }
          : {}),
        ...(routeModelDefinitionId ? { routeModelDefinitionId } : {}),
        ...(routeModelDefinitionSource ? { routeModelDefinitionSource } : {}),
        ...(routeRawModelId ? { routeRawModelId } : {}),
      });
    } catch (error) {
      return withPromptRegistryPublishGateModelRouteEffectiveSourceFingerprint({
        ...baseRoute,
        ...promptRegistryPublishGateRouteCandidateMetadata(selectedCandidate),
        ...promptRegistryPublishGateDiagnosticsErrorMetadata(
          'resolve_provider',
          error
        ),
        available: false,
        candidateCount: candidates.length,
        configured: true,
        matchedCandidateCount: matchedCandidates.length,
        reasons: uniqueStrings([
          'model_route_unavailable',
          'model_route_resolution_error',
          error instanceof Error ? error.constructor.name : 'unknown_error',
          ...candidates.flatMap(candidate => candidate.reasons),
        ]),
        requestedModelId: candidate.modelId,
        routeCandidates,
        routeTrace,
      });
    }
  }

  private async resolvePromptRegistryPublishGateUnavailableRegistryPromptRoute(
    copilot?: CopilotType
  ): Promise<CopilotPromptRegistryPublishGateModelRoute> {
    const routePolicyContext = modelListRoutePolicyContext(
      copilot?.workspaceId
    );
    const routePolicy =
      this.providerFactory.describeRoutePolicy(routePolicyContext);
    const policyCandidates = withTaskRoutePolicyCandidateKeys(
      await this.providerFactory.describeEffectiveRoutePolicyCandidates(
        routePolicyContext
      ),
      routePolicyContext
    );

    return withPromptRegistryPublishGateModelRouteEffectiveSourceFingerprint({
      checked: true,
      fallbackProviderIds: [],
      featureKind: routePolicyContext.featureKind,
      outputType: ModelOutputType.Text,
      policyCandidates,
      requestedModelSource: 'registry',
      ...taskRoutePolicyMetadata(routePolicy),
      available: false,
      candidateCount: 0,
      candidateIndex: 0,
      candidateKind: 'default',
      configured: false,
      matchedCandidateCount: 0,
      reasons: ['registry_prompt_unavailable'],
      routeCandidates: [],
      routeTrace: buildPromptRegistryPublishGateRouteTrace(
        policyCandidates,
        []
      ),
    });
  }

  private async resolvePromptRegistryPublishGateModelRoutes(
    verdict: PromptRegistryPublishGateVerdict,
    copilot?: CopilotType
  ): Promise<CopilotPromptRegistryPublishGateModelRoute[]> {
    const registryPrompt =
      await this.modelsStore.copilotPrompt.getRegistryPrompt(verdict.name);
    if (!registryPrompt?.model) {
      return [
        await this.resolvePromptRegistryPublishGateUnavailableRegistryPromptRoute(
          copilot
        ),
      ];
    }

    const resolvedPrompt = await this.prompt.get(verdict.name);
    const prompt =
      resolvedPrompt?.source === 'registry' ? resolvedPrompt : registryPrompt;
    const routeTarget =
      resolvePromptRegistryPublishGateModelRouteTarget(prompt);
    const routePolicyContext = {
      ...(copilot?.workspaceId ? { workspaceId: copilot.workspaceId } : {}),
      featureKind: routeTarget.featureKind,
    };
    const routePolicy =
      this.providerFactory.describeRoutePolicy(routePolicyContext);
    const routePolicyMetadata = taskRoutePolicyMetadata(routePolicy);
    const policyCandidates = withTaskRoutePolicyCandidateKeys(
      await this.providerFactory.describeEffectiveRoutePolicyCandidates(
        routePolicyContext
      ),
      routePolicyContext
    );
    const configuredModelIds =
      await this.resolveEffectiveConfiguredModelIds(routePolicyContext);

    const modelRouteCandidates =
      resolvePromptRegistryPublishGateModelRouteCandidates(
        prompt,
        configuredModelIds
      );

    return await Promise.all(
      modelRouteCandidates.map(candidate =>
        this.resolvePromptRegistryPublishGateModelRouteCandidate(
          candidate,
          routeTarget,
          routePolicyContext,
          routePolicyMetadata,
          policyCandidates
        )
      )
    );
  }

  private async resolveEffectiveConfiguredModelIds(
    routePolicyContext: CopilotAccessContext
  ) {
    if (this.providerFactory.getEffectiveModelSelectionScope) {
      return (
        await this.providerFactory.getEffectiveModelSelectionScope(
          routePolicyContext
        )
      ).configuredModelIds;
    }

    return this.providerFactory.getConfiguredModelIds(routePolicyContext);
  }

  private async resolvePromptRegistryPublishGateActionRouteDryRun(
    prompt: CopilotPromptRegistryPublishGateActionRouteDryRunPrompt,
    copilot?: CopilotType
  ): Promise<CopilotPromptRegistryPublishGateActionRouteDryRun | undefined> {
    if (!isPromptRegistryPublishGateActionDryRunCandidate(prompt)) {
      return undefined;
    }

    const actionId = prompt.action ?? prompt.name;
    const featureKind =
      prompt.defaultPolicy === 'image' ||
      prompt.category === 'image' ||
      isImagePromptCategory(prompt)
        ? 'image'
        : 'action';

    if (!this.plans) {
      const diagnostics =
        promptRegistryPublishGateActionDryRunDiagnosticsErrorMetadata(
          'missing_execution_plan_builder'
        );
      return promptRegistryPublishGateActionDryRunResult({
        ...(actionId ? { actionId } : {}),
        ...diagnostics,
        errorCode: diagnostics.diagnosticsErrorCode,
        errorMessage: diagnostics.diagnosticsErrorMessage,
        featureKind,
        status: 'skipped',
        steps: [],
      });
    }

    const messages = prompt.messages ?? [];
    if (!messages.length) {
      const diagnostics =
        promptRegistryPublishGateActionDryRunDiagnosticsErrorMetadata(
          'missing_prompt_messages'
        );
      return promptRegistryPublishGateActionDryRunResult({
        ...(actionId ? { actionId } : {}),
        ...diagnostics,
        errorCode: diagnostics.diagnosticsErrorCode,
        errorMessage: diagnostics.diagnosticsErrorMessage,
        featureKind,
        status: 'skipped',
        steps: [],
      });
    }

    try {
      if (featureKind === 'image') {
        try {
          const plan = await this.plans.buildImagePlan(
            { modelId: prompt.model },
            messages,
            {
              ...prompt.config,
              ...(copilot?.workspaceId
                ? { workspace: copilot.workspaceId }
                : {}),
              featureKind: 'image',
            }
          );

          return promptRegistryPublishGateActionDryRunResult({
            ...(actionId ? { actionId } : {}),
            featureKind,
            status: 'succeeded',
            steps: [
              toPromptRegistryPublishGateActionRouteDryRunStep({
                fallbackProviderIds: plan.routePolicy.fallbackOrder,
                kind: 'image',
                plan,
                requestedModelId: prompt.model,
                requestedModelSource: prompt.modelSource,
                stepId: 'generate-image',
              }),
            ],
          });
        } catch (error) {
          const diagnostics =
            promptRegistryPublishGateActionDryRunDiagnosticsErrorMetadata(
              'build_image_plan',
              error
            );
          return promptRegistryPublishGateActionDryRunResult({
            ...(actionId ? { actionId } : {}),
            ...diagnostics,
            errorCode: diagnostics.diagnosticsErrorCode,
            errorMessage: diagnostics.diagnosticsErrorMessage,
            featureKind,
            status: 'failed',
            steps: [],
          });
        }
      }

      const responseContract = buildStructuredResponseFromSchemaJson(
        promptRegistryPublishGateActionTextResultSchema()
      ) as RequiredStructuredOutputContract;
      try {
        const plan = await this.plans.buildStructuredPlan(
          { modelId: prompt.model },
          messages,
          {
            ...prompt.config,
            ...(copilot?.workspaceId ? { workspace: copilot.workspaceId } : {}),
            featureKind: 'action',
          },
          undefined,
          responseContract
        );

        return promptRegistryPublishGateActionDryRunResult({
          ...(actionId ? { actionId } : {}),
          featureKind,
          status: 'succeeded',
          steps: [
            toPromptRegistryPublishGateActionRouteDryRunStep({
              fallbackProviderIds: plan.routePolicy.fallbackOrder,
              kind: 'structured',
              plan,
              requestedModelId: prompt.model,
              requestedModelSource: prompt.modelSource,
              stepId: 'generate',
            }),
          ],
        });
      } catch (error) {
        const diagnostics =
          promptRegistryPublishGateActionDryRunDiagnosticsErrorMetadata(
            'build_structured_plan',
            error
          );
        return promptRegistryPublishGateActionDryRunResult({
          ...(actionId ? { actionId } : {}),
          ...diagnostics,
          errorCode: diagnostics.diagnosticsErrorCode,
          errorMessage: diagnostics.diagnosticsErrorMessage,
          featureKind,
          status: 'failed',
          steps: [],
        });
      }
    } catch (error) {
      const diagnostics =
        promptRegistryPublishGateActionDryRunDiagnosticsErrorMetadata(
          featureKind === 'image'
            ? 'build_image_plan'
            : 'build_structured_plan',
          error
        );
      return promptRegistryPublishGateActionDryRunResult({
        ...(actionId ? { actionId } : {}),
        ...diagnostics,
        errorCode: diagnostics.diagnosticsErrorCode,
        errorMessage: diagnostics.diagnosticsErrorMessage,
        featureKind,
        status: 'failed',
        steps: [],
      });
    }
  }

  private async resolvePromptRegistryPublishGateActionRouteDryRunForVerdict(
    verdict: PromptRegistryPublishGateVerdict,
    copilot?: CopilotType
  ): Promise<CopilotPromptRegistryPublishGateActionRouteDryRun | undefined> {
    const prompt = await this.prompt.get(verdict.name);
    if (!prompt || prompt.source !== 'registry') {
      return undefined;
    }

    return await this.resolvePromptRegistryPublishGateActionRouteDryRun(
      prompt,
      copilot
    );
  }

  private toPromptRegistryModelRouteIssue(
    verdict: PromptRegistryPublishGateVerdict,
    modelRoute: CopilotPromptRegistryPublishGateModelRoute
  ): CopilotPromptRegistryValidationIssue {
    const requestedModelId = modelRoute.requestedModelId ?? 'unknown';
    const sourceLocator = {
      field: 'model',
      path: 'model',
      registryFingerprint: verdict.registryFingerprint,
      registryId: verdict.registryId,
      registryUpdatedAt: verdict.registryUpdatedAt.toISOString(),
      table: 'ai_prompts_metadata' as const,
    };

    return {
      code: 'unavailable',
      detail: `model.${requestedModelId}:route_unavailable`,
      fieldLabel: 'Model Route',
      message: `Prompt registry default model "${requestedModelId}" has no available ${modelRoute.outputType} provider route for ${modelRoute.featureKind}.`,
      path: 'model',
      publishBlocking: true,
      reason: 'model_route_unavailable',
      severity: 'error',
      source: 'copilot.providers.route',
      sourceLocator,
    };
  }

  private toPromptRegistryModelRouteRemediation(
    verdict: PromptRegistryPublishGateVerdict
  ): CopilotPromptRegistryValidationRemediation {
    return {
      detail:
        'Configure a provider route that supports the registry prompt default model and output type, or change ai_prompts_metadata.model to a routable model.',
      kind: 'configure_model_route',
      label: 'Configure model route',
      target: 'copilot.providers / ai_prompts_metadata.model',
      targetLocator: {
        field: 'model',
        path: 'model',
        registryFingerprint: verdict.registryFingerprint,
        registryId: verdict.registryId,
        registryUpdatedAt: verdict.registryUpdatedAt.toISOString(),
        table: 'ai_prompts_metadata',
      },
    };
  }

  private toPromptRegistryPublishGateVerdictWithRepairRecommendations(input: {
    actionRouteDryRun?: CopilotPromptRegistryPublishGateActionRouteDryRun;
    modelRoute?: CopilotPromptRegistryPublishGateModelRoute;
    modelRoutes?: CopilotPromptRegistryPublishGateModelRoute[];
    taskRoutes?: CopilotPromptRegistryPublishGateTaskRoute[];
    verdict: PromptRegistryPublishGateVerdict;
  }): CopilotPromptRegistryPublishGateVerdictType {
    const modelRoutes =
      input.modelRoutes ?? (input.modelRoute ? [input.modelRoute] : []);
    const taskRoutes = input.taskRoutes ?? [];
    const verdict = {
      ...input.verdict,
      ...(input.actionRouteDryRun
        ? { actionRouteDryRun: input.actionRouteDryRun }
        : {}),
      ...(input.modelRoute ? { modelRoute: input.modelRoute } : {}),
      modelRoutes,
      taskRoutes,
    };
    const repairRecommendations =
      buildPromptRegistryPublishGateRepairRecommendations({
        actionRouteDryRun: input.actionRouteDryRun,
        modelRoutes,
        taskRoutes,
        verdict,
      });
    const repairActionCatalog =
      buildPromptRegistryPublishGateRepairActionCatalog(repairRecommendations);
    const repairActionCatalogFingerprint =
      promptRegistryPublishGateRepairActionCatalogFingerprint(
        repairActionCatalog
      );
    const repairActionMutationGuard =
      buildPromptRegistryPublishGateRepairActionMutationGuard({
        catalogFingerprint: repairActionCatalogFingerprint,
        recommendations: repairRecommendations,
        verdict,
      });
    const repairActionPreview =
      buildPromptRegistryPublishGateRepairActionPreview({
        catalogFingerprint: repairActionCatalogFingerprint,
        guard: repairActionMutationGuard,
        recommendations: repairRecommendations,
      });
    const repairGateManifest = buildPromptRegistryPublishGateRepairGateManifest(
      {
        guard: repairActionMutationGuard,
        preview: repairActionPreview,
        recommendations: repairRecommendations,
        verdict,
      }
    );
    const repairGateManifestExportMetadata =
      buildPromptRegistryPublishGateRepairGateManifestExportMetadata(
        repairGateManifest
      );

    return {
      ...verdict,
      repairActionCatalog,
      repairActionCatalogFingerprint,
      repairActionMutationGuard,
      repairActionPreview,
      repairGateManifest,
      repairGateManifestExportMetadata,
      repairRecommendations,
    };
  }

  private async withPromptRegistryPublishGateRouteReadiness(
    verdict: PromptRegistryPublishGateVerdict,
    copilot?: CopilotType
  ): Promise<CopilotPromptRegistryPublishGateVerdictType> {
    const resolveTaskRoutes = async () => {
      try {
        const { embeddingRoute, rerankRoute } =
          await this.resolveTaskRouteDiagnostics(copilot);
        return [embeddingRoute, rerankRoute];
      } catch {
        return [];
      }
    };
    const resolveActionRouteDryRun = async () => {
      try {
        return await this.resolvePromptRegistryPublishGateActionRouteDryRunForVerdict(
          verdict,
          copilot
        );
      } catch {
        return undefined;
      }
    };

    if (!verdict.allowed || verdict.reason !== 'ready') {
      return this.toPromptRegistryPublishGateVerdictWithRepairRecommendations({
        modelRoutes: [],
        taskRoutes: [],
        verdict,
      });
    }

    const [modelRoutes, taskRoutes, actionRouteDryRun] = await Promise.all([
      this.resolvePromptRegistryPublishGateModelRoutes(verdict, copilot),
      resolveTaskRoutes(),
      resolveActionRouteDryRun(),
    ]);
    const modelRoute = modelRoutes[0];
    if (!modelRoute) {
      return this.toPromptRegistryPublishGateVerdictWithRepairRecommendations({
        actionRouteDryRun,
        modelRoutes: [],
        taskRoutes,
        verdict,
      });
    }
    if (modelRoute.available) {
      return this.toPromptRegistryPublishGateVerdictWithRepairRecommendations({
        actionRouteDryRun,
        modelRoute,
        modelRoutes,
        taskRoutes,
        verdict,
      });
    }

    const issue = this.toPromptRegistryModelRouteIssue(verdict, modelRoute);

    const blockedVerdict = {
      ...verdict,
      allowed: false,
      blockingCount: verdict.blockingCount + 1,
      errorCount: verdict.errorCount + 1,
      issueCount: verdict.issueCount + 1,
      issues: [...verdict.issues, issue],
      actionRouteDryRun,
      modelRoute,
      modelRoutes,
      publishStatus: 'blocked' as const,
      reason: 'model_route_unavailable' as const,
      remediations: [
        ...verdict.remediations,
        this.toPromptRegistryModelRouteRemediation(verdict),
      ],
      status: 'ignored' as const,
    };

    return this.toPromptRegistryPublishGateVerdictWithRepairRecommendations({
      actionRouteDryRun,
      modelRoute,
      modelRoutes,
      taskRoutes,
      verdict: blockedVerdict,
    });
  }

  private promptRegistryPublishFallbackSourceChain(input: {
    current: CopilotPromptRegistryPublishGateVerdictType;
    workspaceId: string;
  }): PromptRegistrySourceChainEntry[] {
    const routeReviewFingerprint = createHash('sha256')
      .update(
        stableRepairRecommendationStringify({
          version: 'prompt-registry-direct-publish-route-review/v1',
          promptName: input.current.name,
          registryFingerprint: input.current.registryFingerprint,
          modelRouteFingerprints: input.current.modelRoutes
            .map(route => route.effectiveSourceFingerprint)
            .filter((fingerprint): fingerprint is string => !!fingerprint)
            .sort(),
          taskRouteFingerprints: input.current.taskRoutes
            .map(route => route.effectiveSourceFingerprint)
            .filter((fingerprint): fingerprint is string => !!fingerprint)
            .sort(),
          actionRouteDryRunStatus:
            input.current.actionRouteDryRun?.status ?? null,
        })
      )
      .digest('hex')
      .slice(0, 16);

    return [
      {
        source: 'legacy_registry',
        scope: 'global',
        status: input.current.status,
        fingerprint: input.current.registryFingerprint,
        registryId: input.current.registryId,
        revision: input.current.registryFingerprint,
        updatedAt: input.current.registryUpdatedAt.toISOString(),
      },
      {
        source: 'publish_gate_route_review',
        scope: 'workspace',
        status: input.current.allowed ? 'route_ready' : 'blocked',
        fingerprint: routeReviewFingerprint,
        revision:
          input.current.repairGateManifest?.fingerprint ??
          input.current.repairActionCatalogFingerprint,
        workspaceId: input.workspaceId,
      },
      {
        source: 'direct_publish',
        scope: 'workspace',
        status: 'reviewed',
        fingerprint: createHash('sha256')
          .update(
            stableRepairRecommendationStringify({
              version: 'prompt-registry-direct-publish-source/v1',
              promptName: input.current.name,
              registryFingerprint: input.current.registryFingerprint,
              registryId: input.current.registryId,
              workspaceId: input.workspaceId,
            })
          )
          .digest('hex')
          .slice(0, 16),
        workspaceId: input.workspaceId,
      },
    ];
  }

  private async assertPromptRegistryPublishGateReady(input: {
    expectedVersion?: CopilotPromptRegistryPublishGateExpectedVersionInput;
    name: string;
    workspaceId: string;
  }): Promise<CopilotPromptRegistryPublishGateVerdictType> {
    const verdict =
      await this.modelsStore.copilotPrompt.getRegistryPublishGateVerdict(
        input.name,
        input.expectedVersion ?? {}
      );
    if (!verdict) {
      throw new NotFoundException('Prompt registry row not found');
    }

    const current = await this.withPromptRegistryPublishGateRouteReadiness(
      verdict,
      {
        workspaceId: input.workspaceId,
      }
    );
    if (!current.allowed) {
      throw new Error(
        `Prompt registry publish gate is not ready: ${current.reason}`
      );
    }

    return current;
  }

  @ResolveField(() => CopilotPromptRegistryPublishGateVerdictType, {
    nullable: true,
    description:
      'Evaluate whether the current prompt registry row can pass the publish gate',
    complexity: 2,
  })
  async promptRegistryPublishGate(
    @Parent() copilot: CopilotType,
    @Args('name') name: string,
    @Args('expectedVersion', {
      type: () => CopilotPromptRegistryPublishGateExpectedVersionInput,
      nullable: true,
    })
    expectedVersion?: CopilotPromptRegistryPublishGateExpectedVersionInput
  ): Promise<CopilotPromptRegistryPublishGateVerdictType | null> {
    const verdict =
      await this.modelsStore.copilotPrompt.getRegistryPublishGateVerdict(
        name,
        expectedVersion ?? {}
      );
    if (!verdict) {
      return null;
    }

    return await this.withPromptRegistryPublishGateRouteReadiness(
      verdict,
      copilot
    );
  }

  private async buildPromptRegistryRepairPreflightContextForCurrentUser(
    user: CurrentUser,
    copilot: CopilotType,
    name: string,
    submission: CopilotPromptRegistryRepairSubmissionInput,
    expectedVersion?: CopilotPromptRegistryPublishGateExpectedVersionInput
  ): Promise<{
    current: CopilotPromptRegistryPublishGateVerdictType;
    preflight: CopilotPromptRegistryRepairPreflightType;
  } | null> {
    const requiredPermission: WorkspaceAction = 'Workspace.Copilot';
    const permission = copilot.workspaceId
      ? {
          checked: true,
          checkMode: 'workspace_assert',
          requiredPermission,
          scope: 'workspace',
          status: 'granted',
          workspaceId: copilot.workspaceId,
        }
      : {
          checked: false,
          checkMode: 'not_checked',
          requiredPermission,
          scope: 'global',
          status: 'workspace_not_selected',
        };
    if (copilot.workspaceId) {
      await this.ac
        .user(user.id)
        .workspace(copilot.workspaceId)
        .allowLocal()
        .assert(requiredPermission);
    }

    const verdict =
      await this.modelsStore.copilotPrompt.getRegistryPublishGateVerdict(
        name,
        expectedVersion ?? {}
      );
    if (!verdict) {
      return null;
    }

    const current = await this.withPromptRegistryPublishGateRouteReadiness(
      verdict,
      copilot
    );

    const preflight = buildPromptRegistryRepairPreflight(
      current.repairActionPreview.submissionContract,
      submission,
      {
        actorId: user.id,
        actorType: 'user',
        source: 'current_user',
      },
      permission,
      {
        catalogFingerprint: current.repairActionPreview.catalogFingerprint,
        checkMode: 'preview_capability_snapshot',
        requiredCapabilities: current.repairActionPreview.requiredCapabilities,
        source: 'repair_action_preview',
        status: current.repairActionPreview.requiredCapabilities.length
          ? 'declared'
          : 'not_required',
      },
      {
        approvalCheckpoints: current.repairActionPreview.approvalCheckpoints,
        approvalModes: current.repairActionPreview.approvalModes,
        approvalPolicyFingerprint:
          current.repairActionPreview.approvalPolicyFingerprint,
        approvalRequired: current.repairActionPreview.approvalRequired,
        authorizationFingerprint:
          current.repairActionPreview.authorizationFingerprint,
        authorizationStatus: current.repairActionPreview.authorizationStatus,
      }
    );

    return { current, preflight };
  }

  private async buildPromptRegistryRepairPreflightForCurrentUser(
    user: CurrentUser,
    copilot: CopilotType,
    name: string,
    submission: CopilotPromptRegistryRepairSubmissionInput,
    expectedVersion?: CopilotPromptRegistryPublishGateExpectedVersionInput
  ): Promise<CopilotPromptRegistryRepairPreflightType | null> {
    const context =
      await this.buildPromptRegistryRepairPreflightContextForCurrentUser(
        user,
        copilot,
        name,
        submission,
        expectedVersion
      );

    return context?.preflight ?? null;
  }

  @ResolveField(() => CopilotPromptRegistryRepairPreflightType, {
    nullable: true,
    description:
      'Read-only preflight for a prompt registry repair submission contract',
    complexity: 2,
  })
  async promptRegistryRepairPreflight(
    @CurrentUser() user: CurrentUser,
    @Parent() copilot: CopilotType,
    @Args('name') name: string,
    @Args('submission', {
      type: () => CopilotPromptRegistryRepairSubmissionInput,
    })
    submission: CopilotPromptRegistryRepairSubmissionInput,
    @Args('expectedVersion', {
      type: () => CopilotPromptRegistryPublishGateExpectedVersionInput,
      nullable: true,
    })
    expectedVersion?: CopilotPromptRegistryPublishGateExpectedVersionInput
  ): Promise<CopilotPromptRegistryRepairPreflightType | null> {
    return await this.buildPromptRegistryRepairPreflightForCurrentUser(
      user,
      copilot,
      name,
      submission,
      expectedVersion
    );
  }

  @Mutation(() => CopilotPromptRegistryRepairExecutionRequestType, {
    description:
      'Request prompt registry repair execution. Approval-gated requests can publish a DB-backed workspace prompt registry revision after approval.',
  })
  @CallMetric('ai', 'prompt_registry_repair_execution_request')
  async requestCopilotPromptRegistryRepairExecution(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotPromptRegistryRepairExecutionRequestInput,
    })
    input: CopilotPromptRegistryRepairExecutionRequestInput
  ): Promise<CopilotPromptRegistryRepairExecutionRequestType> {
    const context =
      await this.buildPromptRegistryRepairPreflightContextForCurrentUser(
        user,
        { workspaceId: input.workspaceId },
        input.name,
        input.submission,
        input.expectedVersion
      );

    if (!context) {
      throw new NotFoundException('Prompt registry repair preflight not found');
    }

    const request = buildPromptRegistryRepairExecutionRequest(
      input,
      context.preflight,
      context.current.repairActionPreview,
      context.current.repairGateManifest,
      context.current.repairGateManifestExportMetadata
    );
    const executorPayload = buildRepairExecutorPayload({
      current: context.current,
      request,
      workspaceId: input.workspaceId,
    });
    const repairExecutionModel = this.modelsStore.copilotRepairExecution;

    if (!repairExecutionModel || !input.workspaceId) {
      return request;
    }

    const { record } = await repairExecutionModel.createOrReuse({
      workspaceId: input.workspaceId,
      actorId: user.id,
      promptName: input.name,
      requestedAction:
        context.current.repairActionPreview.operations
          .map(operation => operation.actionKind)
          .sort()
          .join(',') || 'prompt_registry_repair',
      approvalRequired: context.preflight.approvalRequired,
      permissionStatus: context.preflight.permissionStatus,
      idempotencyKey: context.preflight.idempotencyKey,
      idempotencyFingerprint: context.preflight.idempotencyFingerprint,
      requestFingerprint: request.requestFingerprint,
      candidateEvidenceSetFingerprint:
        context.preflight.candidateEvidenceSetFingerprint,
      taskRouteEvidenceSetFingerprint:
        context.preflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
      targetLocatorFingerprint: context.preflight.targetLocatorFingerprint,
      repairJobFingerprint: context.preflight.repairJobFingerprint,
      approvalRecordFingerprint: context.preflight.approvalRecordFingerprint,
      auditEventFingerprint: context.preflight.auditEventFingerprint,
      executorPayload,
    });
    const agentRun =
      await this.modelsStore.copilotAgentRuntime?.createOrReuseForRepairExecution(
        {
          record,
        }
      );
    const executionRecord = {
      ...record,
      agentRun: agentRun ?? null,
    };

    return {
      ...request,
      accepted: true,
      executionRequested: true,
      executionRecord,
      idempotencyLockAcquired: true,
      idempotencyLockStatus: 'acquired_persisted',
      repairJobRequestCreated: true,
      repairJobRequestStatus: record.status,
      requestStatus: record.status,
    };
  }

  @Mutation(() => CopilotRepairExecutionRecordType, {
    description:
      'Approve or reject a persisted repair execution request that is waiting for approval.',
  })
  @CallMetric('ai', 'repair_execution_approval_decision')
  async decideCopilotRepairExecutionApproval(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotRepairExecutionApprovalDecisionInput,
    })
    input: CopilotRepairExecutionApprovalDecisionInput
  ): Promise<CopilotRepairExecutionRecordType> {
    if (input.decision !== 'approve' && input.decision !== 'reject') {
      throw new BadRequest('Unsupported repair execution approval decision');
    }

    const { workspaceId } = await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });
    const record = await this.modelsStore.copilotRepairExecution.decideApproval(
      {
        workspaceId,
        actorId: user.id,
        id: input.executionRequestId,
        decision: input.decision,
        reason: input.reason,
      }
    );
    const agentRun =
      await this.modelsStore.copilotAgentRuntime?.syncRepairExecution({
        record,
      });

    if (input.decision === 'approve') {
      await this.jobs.add(
        'copilot.repairExecution.run',
        {
          workspaceId,
          executionRequestId: record.id,
        },
        {
          jobId: `copilot-repair-execution-run-${record.id}`,
        }
      );
    }

    return {
      ...record,
      agentRun: agentRun ?? null,
    };
  }

  @Mutation(() => CopilotRepairExecutionRecordType, {
    description:
      'Cancel, retry, or recover a stale persisted repair execution request after workspace permission checks.',
  })
  @CallMetric('ai', 'repair_execution_control')
  async controlCopilotRepairExecution(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotRepairExecutionControlInput,
    })
    input: CopilotRepairExecutionControlInput
  ): Promise<CopilotRepairExecutionRecordType> {
    if (
      input.action !== 'cancel' &&
      input.action !== 'retry' &&
      input.action !== 'recover_stale' &&
      input.action !== 'resume_with_payload'
    ) {
      throw new BadRequest('Unsupported repair execution control action');
    }

    const { workspaceId } = await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });
    const record =
      await this.modelsStore.copilotRepairExecution.controlExecution({
        workspaceId,
        actorId: user.id,
        id: input.executionRequestId,
        action: input.action,
        executorPayload: input.executorPayload,
        reason: input.reason,
      });
    const agentRun =
      input.action === 'cancel' && record.status === 'running'
        ? await this.modelsStore.copilotAgentRuntime?.getBySource(
            record.workspaceId,
            'repair_execution_request',
            record.id
          )
        : await this.modelsStore.copilotAgentRuntime?.syncRepairExecution({
            record,
          });

    if (
      input.action === 'retry' ||
      input.action === 'resume_with_payload' ||
      (input.action === 'recover_stale' && record.status === 'queued')
    ) {
      await this.jobs.add(
        'copilot.repairExecution.run',
        {
          workspaceId,
          executionRequestId: record.id,
        },
        {
          jobId: `copilot-repair-execution-run-${record.id}-${input.action}-${record.workerAttempt}-${record.workerMaxAttempts}`,
        }
      );
    }

    return {
      ...record,
      agentRun: agentRun ?? null,
    };
  }

  @Mutation(() => CopilotAgentRunType, {
    description:
      'Request an approval-gated Agent Runtime office task that updates one workspace document after approval.',
  })
  @CallMetric('ai', 'agent_runtime_doc_update_request')
  async requestCopilotAgentRuntimeDocUpdate(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotAgentRuntimeDocUpdateRequestInput,
    })
    input: CopilotAgentRuntimeDocUpdateRequestInput
  ): Promise<CopilotAgentRunType> {
    return await createAgentRuntimeDocUpdateRequest({
      ac: this.ac,
      models: this.modelsStore,
      actorId: user.id,
      request: input,
    });
  }

  @Mutation(() => CopilotAgentRunType, {
    description:
      'Preview and persist one native Office AI command as an immutable approval-gated Agent Runtime task.',
  })
  @CallMetric('ai', 'agent_runtime_office_command_request')
  async requestCopilotAgentRuntimeOfficeCommand(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotAgentRuntimeOfficeCommandRequestInput,
    })
    input: CopilotAgentRuntimeOfficeCommandRequestInput
  ): Promise<CopilotAgentRunType> {
    const { workspaceId } = await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });
    try {
      const result = await this.officeAgentCommands.request({
        workspaceId,
        actorId: user.id,
        command: input.command,
        title: input.title,
        reason: input.reason,
      });
      return result.run;
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequest(error.message);
      }
      throw error;
    }
  }

  @Mutation(() => CopilotAgentRunType, {
    description:
      'Control a standalone persisted Agent Runtime run outside repair execution.',
  })
  @CallMetric('ai', 'agent_runtime_control')
  async controlCopilotAgentRuntimeRun(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotAgentRuntimeControlInput,
    })
    input: CopilotAgentRuntimeControlInput
  ): Promise<CopilotAgentRunType> {
    if (
      input.action !== 'approve' &&
      input.action !== 'cancel' &&
      input.action !== 'reject' &&
      input.action !== 'resume'
    ) {
      throw new Error('Unsupported Agent Runtime control action');
    }

    const { workspaceId } = await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });

    let record;
    try {
      record =
        await this.modelsStore.copilotAgentRuntime.controlRunForWorkspaceViewer(
          {
            workspaceId,
            actorId: user.id,
            id: input.runId,
            action: input.action,
            reason: input.reason,
            expectedApprovalFingerprint: input.expectedApprovalFingerprint,
          }
        );
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Agent runtime')) {
        throw new BadRequest(error.message);
      }
      throw error;
    }

    if (input.action === 'approve' || input.action === 'resume') {
      await this.jobs.add(
        'copilot.agentRuntime.run',
        {
          workspaceId,
          runId: record.id,
        },
        {
          jobId: `copilot-agent-runtime-run-${record.id}-${input.action}-${record.workerAttempt}-${record.workerMaxAttempts}`,
        }
      );
    }

    return record;
  }

  @Mutation(() => CopilotTaskType, {
    description:
      'Control a current-user Copilot task after workspace and actor ownership checks.',
  })
  @CallMetric('ai', 'copilot_task_control')
  async controlCopilotTask(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotTaskControlInput,
    })
    input: CopilotTaskControlInput
  ): Promise<CopilotTaskType> {
    if (
      input.action !== 'abandon' &&
      input.action !== 'approve' &&
      input.action !== 'cancel' &&
      input.action !== 'reject' &&
      input.action !== 'resume'
    ) {
      throw new BadRequest('Unsupported Copilot task control action');
    }

    const { workspaceId } = await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });

    let record;
    try {
      record = await this.modelsStore.copilotAgentRuntime.controlRunForActor({
        workspaceId,
        actorId: user.id,
        id: input.taskId,
        action: input.action,
        reason: input.reason,
        expectedApprovalFingerprint: input.expectedApprovalFingerprint,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.startsWith('Agent runtime') ||
          error.message.startsWith('Copilot task'))
      ) {
        throw new BadRequest(error.message);
      }
      throw error;
    }

    if (input.action === 'approve' || input.action === 'resume') {
      await this.jobs.add(
        'copilot.agentRuntime.run',
        {
          workspaceId,
          runId: record.id,
        },
        {
          jobId: `copilot-agent-runtime-run-${record.id}-${input.action}-${record.workerAttempt}-${record.workerMaxAttempts}`,
        }
      );
    }

    return await this.projectTaskForViewer(record, user.id);
  }

  @Mutation(() => CopilotSupportBundleType, {
    description:
      'Create a DB-backed support bundle request with a minimal persisted manifest.',
  })
  @CallMetric('ai', 'support_bundle_create')
  async createCopilotSupportBundle(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotSupportBundleCreateInput,
    })
    input: CopilotSupportBundleCreateInput
  ): Promise<CopilotSupportBundleType> {
    const { workspaceId } = await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });

    const [promptCatalog, taskRouteDiagnostics] = await Promise.all([
      this.prompt.listCatalog(workspaceId),
      this.resolveTaskRouteDiagnostics({ workspaceId }),
    ]);

    return await this.modelsStore.copilotSupportBundle.create({
      workspaceId,
      actorId: user.id,
      promptCatalog,
      taskRoutes: [
        toSupportBundleTaskRouteSnapshot(taskRouteDiagnostics.embeddingRoute),
        toSupportBundleTaskRouteSnapshot(taskRouteDiagnostics.rerankRoute),
      ],
    });
  }

  @Mutation(() => CopilotSupportBundleDownloadAuthorizationType, {
    description:
      'Authorize a short-lived manifest or archive artifact download for a DB-backed support bundle.',
  })
  @CallMetric('ai', 'support_bundle_download_authorize')
  async authorizeCopilotSupportBundleDownload(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotSupportBundleDownloadAuthorizeInput,
    })
    input: CopilotSupportBundleDownloadAuthorizeInput
  ): Promise<CopilotSupportBundleDownloadAuthorizationType> {
    const { workspaceId } = await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });

    const authorization =
      await this.modelsStore.copilotSupportBundle.authorizeDownload({
        bundleId: input.bundleId,
        workspaceId,
        actorId: user.id,
        artifactKind: input.artifactKind,
      });

    return this.toSupportBundleDownloadAuthorizationType(authorization);
  }

  @Mutation(() => CopilotSupportBundleDownloadAuthorizationType, {
    description:
      'Acknowledge client completion telemetry for a direct object-storage support bundle download.',
  })
  @CallMetric('ai', 'support_bundle_direct_download_acknowledge')
  async acknowledgeCopilotSupportBundleDirectDownload(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotSupportBundleDirectDownloadAcknowledgeInput,
    })
    input: CopilotSupportBundleDirectDownloadAcknowledgeInput
  ): Promise<CopilotSupportBundleDownloadAuthorizationType> {
    const { workspaceId } = await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });

    const authorization =
      await this.modelsStore.copilotSupportBundle.acknowledgeDirectDownload({
        authorizationId: input.authorizationId,
        workspaceId,
        actorId: user.id,
      });

    return this.toSupportBundleDownloadAuthorizationType(authorization);
  }

  @Mutation(() => CopilotSupportBundleRetentionCleanupType, {
    description:
      'Expire DB-backed support bundles whose retention window has elapsed and retry failed archive object cleanup.',
  })
  @CallMetric('ai', 'support_bundle_retention_cleanup')
  async cleanupCopilotSupportBundleRetention(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotSupportBundleRetentionCleanupInput,
    })
    input: CopilotSupportBundleRetentionCleanupInput
  ): Promise<CopilotSupportBundleRetentionCleanupType> {
    const { workspaceId } = await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });

    return await this.modelsStore.copilotSupportBundle.cleanupRetention({
      workspaceId,
      actorId: user.id,
      limit: input.limit,
    });
  }

  @Mutation(() => CopilotSupportBundleTransferForwardingEventType, {
    description:
      'Queue a fresh replay for a dead-lettered support bundle transfer forwarding event without mutating terminal evidence.',
  })
  @CallMetric('ai', 'support_bundle_transfer_forwarding_replay')
  async replayCopilotSupportBundleTransferForwardingEvent(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotSupportBundleTransferForwardingReplayInput,
    })
    input: CopilotSupportBundleTransferForwardingReplayInput
  ): Promise<CopilotSupportBundleTransferForwardingEventType> {
    const { workspaceId } = await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });

    return await this.modelsStore.copilotSupportBundle.replayDeadLetteredDirectDownloadTransferForwardingEvent(
      {
        workspaceId,
        actorId: user.id,
        forwardingEventId: input.forwardingEventId,
        maxAttempts: input.maxAttempts,
      }
    );
  }

  @Mutation(() => CopilotPromptRegistryBodyEditPreviewType, {
    description:
      'Preview a Prompt Registry message body edit and return a publishable diff fingerprint before writing.',
  })
  @CallMetric('ai', 'prompt_registry_body_edit_preview')
  async previewCopilotPromptRegistryBodyEdit(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotPromptRegistryBodyEditPreviewInput,
    })
    input: CopilotPromptRegistryBodyEditPreviewInput
  ): Promise<CopilotPromptRegistryBodyEditPreviewType> {
    await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });
    const preview =
      await this.modelsStore.copilotPrompt.previewRegistryPromptBodyEdit({
        name: input.name,
        messageIndex: input.messageIndex,
        nextContent: input.nextContent,
        expectedVersion: input.expectedVersion,
      });
    if (!preview) {
      throw new NotFoundException('Prompt registry row not found');
    }
    return preview;
  }

  @Mutation(() => CopilotPromptRegistryBodyEditPublishType, {
    description:
      'Publish a Prompt Registry message body edit after a matching diff preview fingerprint.',
  })
  @CallMetric('ai', 'prompt_registry_body_edit_publish')
  async publishCopilotPromptRegistryBodyEdit(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotPromptRegistryBodyEditPublishInput,
    })
    input: CopilotPromptRegistryBodyEditPublishInput
  ): Promise<CopilotPromptRegistryBodyEditPublishType> {
    const { workspaceId } = await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });

    return await this.modelsStore.copilotPrompt.publishRegistryPromptBodyEdit({
      workspaceId,
      actorId: user.id,
      name: input.name,
      messageIndex: input.messageIndex,
      nextContent: input.nextContent,
      expectedPreviewFingerprint: input.expectedPreviewFingerprint,
      expectedVersion: input.expectedVersion,
      idempotencyKey: input.idempotencyKey,
      reviewNote: input.reviewNote,
    });
  }

  @Mutation(() => CopilotPromptRegistryRevisionType, {
    description:
      'Publish a workspace-scoped DB-backed prompt registry revision after publish-gate and route-readiness checks.',
  })
  @CallMetric('ai', 'prompt_registry_revision_publish')
  async publishCopilotPromptRegistryRevision(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotPromptRegistryPublishInput,
    })
    input: CopilotPromptRegistryPublishInput
  ): Promise<CopilotPromptRegistryRevisionType> {
    const { workspaceId } = await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });
    const current = await this.assertPromptRegistryPublishGateReady({
      workspaceId,
      name: input.name,
      expectedVersion: input.expectedVersion,
    });

    return await this.modelsStore.copilotPromptRegistryRevision.publishWorkspaceRevision(
      {
        workspaceId,
        actorId: user.id,
        promptName: current.name,
        revision: input.revision,
        idempotencyKey: input.idempotencyKey,
        registryFingerprint: current.registryFingerprint,
        registryId: current.registryId,
        registryUpdatedAt: current.registryUpdatedAt.toISOString(),
        gateStatus: current.status,
        publishStatus: current.publishStatus,
        validationReason: current.reason,
        validationIssueCount: current.issueCount,
        validationBlockingCount: current.blockingCount,
        validationErrorCount: current.errorCount,
        modelRouteFingerprints: current.modelRoutes
          .map(route => route.effectiveSourceFingerprint)
          .filter((fingerprint): fingerprint is string => !!fingerprint),
        taskRouteFingerprints: current.taskRoutes
          .map(route => route.effectiveSourceFingerprint)
          .filter((fingerprint): fingerprint is string => !!fingerprint),
        actionRouteDryRunStatus: current.actionRouteDryRun?.status ?? null,
        repairActionCatalogFingerprint: current.repairActionCatalogFingerprint,
        repairGateManifestFingerprint: current.repairGateManifest.fingerprint,
        reviewNote: input.reviewNote,
        fallbackSourceChain: this.promptRegistryPublishFallbackSourceChain({
          current,
          workspaceId,
        }),
      }
    );
  }

  @Mutation(() => CopilotProviderRegistryRevisionType, {
    description:
      'Publish a workspace-scoped DB-backed provider profile metadata revision for an existing configured provider.',
  })
  @CallMetric('ai', 'provider_registry_revision_publish')
  async publishCopilotProviderRegistryRevision(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotProviderRegistryPublishInput,
    })
    input: CopilotProviderRegistryPublishInput
  ): Promise<CopilotProviderRegistryRevisionType> {
    const { workspaceId } = await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });
    const profile = this.providerRegistry.getProviderProfile(input.providerId);
    if (!profile) {
      throw new NotFoundException('Provider profile not found');
    }

    return await this.modelsStore.copilotProviderRegistryRevision.publishWorkspaceRevision(
      {
        workspaceId,
        actorId: user.id,
        providerId: profile.id,
        providerType: profile.type,
        revision: input.revision,
        idempotencyKey: input.idempotencyKey,
        displayName: input.displayName,
        enabled: input.enabled,
        models: input.models,
        modelDefinitions: input.modelDefinitions,
        privacy: input.privacy,
        priority: input.priority,
        fallbackSourceChain: this.providerRegistryFallbackSourceChain(profile),
      }
    );
  }

  @Mutation(() => CopilotModelRegistryRevisionType, {
    description: [
      'Publish a workspace-scoped DB-backed model definition revision',
      'for an existing configured provider.',
    ].join(' '),
  })
  @CallMetric('ai', 'model_registry_revision_publish')
  async publishCopilotModelRegistryRevision(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotModelRegistryPublishInput,
    })
    input: CopilotModelRegistryPublishInput
  ): Promise<CopilotModelRegistryRevisionType> {
    const { workspaceId } = await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });
    const profile = this.providerRegistry.getProviderProfile(input.providerId);
    if (!profile) {
      throw new NotFoundException('Provider profile not found');
    }

    return await this.modelsStore.copilotModelRegistryRevision.publishWorkspaceRevision(
      {
        workspaceId,
        actorId: user.id,
        providerId: profile.id,
        modelId: input.modelId,
        revision: input.revision,
        idempotencyKey: input.idempotencyKey,
        modelDefinition: input.modelDefinition,
        fallbackSourceChain: this.modelRegistryFallbackSourceChain(
          profile,
          input.modelId
        ),
      }
    );
  }

  @Mutation(() => CopilotTaskRoutePolicyRevisionType, {
    description: [
      'Publish a workspace-scoped DB-backed task route policy revision',
      'for embedding, workspace indexing, or rerank model selection.',
    ].join(' '),
  })
  @CallMetric('ai', 'task_route_policy_revision_publish')
  async publishCopilotTaskRoutePolicyRevision(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotTaskRoutePolicyPublishInput,
    })
    input: CopilotTaskRoutePolicyPublishInput
  ): Promise<CopilotTaskRoutePolicyRevisionType> {
    const { workspaceId } = await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });
    const fallback = this.taskRoutePolicyFallbackModel(input.featureKind);
    await this.assertTaskRoutePolicyPublishRouteable({
      workspaceId,
      featureKind: input.featureKind,
      modelId: input.modelId,
    });

    return await this.modelsStore.copilotTaskRoutePolicyRevision.publishWorkspaceRevision(
      {
        workspaceId,
        actorId: user.id,
        featureKind: input.featureKind,
        modelId: input.modelId,
        revision: input.revision,
        idempotencyKey: input.idempotencyKey,
        configKey: fallback.configKey,
        configPath: fallback.configPath,
        fallbackSourceChain: this.taskRoutePolicyFallbackSourceChain(
          input.featureKind,
          fallback
        ),
      }
    );
  }

  @Mutation(() => CopilotProviderHealthStateType, {
    description:
      'Persist a workspace-scoped provider health state for an existing configured provider.',
  })
  @CallMetric('ai', 'provider_health_state_record')
  async recordCopilotProviderHealthState(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotProviderHealthStateRecordInput,
    })
    input: CopilotProviderHealthStateRecordInput
  ): Promise<CopilotProviderHealthStateType> {
    const { workspaceId } = await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });
    const profile = this.providerRegistry.getProviderProfile(input.providerId);
    if (!profile) {
      throw new NotFoundException('Provider profile not found');
    }

    return await this.modelsStore.copilotProviderHealthState.upsertWorkspaceState(
      {
        workspaceId,
        actorId: user.id,
        providerId: profile.id,
        providerType: profile.type,
        status: input.status,
        lastError: input.lastError,
        source: 'manual_override',
        providerProfileSource: profile.source,
      }
    );
  }

  @Mutation(() => CopilotProviderHealthProbeAttemptType, {
    description:
      'Queue a fresh Provider Health probe attempt for a dead-lettered workspace attempt without mutating terminal evidence.',
  })
  @CallMetric('ai', 'provider_health_probe_attempt_retry')
  async retryCopilotProviderHealthProbeAttempt(
    @CurrentUser() user: CurrentUser,
    @Args('input', {
      type: () => CopilotProviderHealthProbeAttemptRetryInput,
    })
    input: CopilotProviderHealthProbeAttemptRetryInput
  ): Promise<CopilotProviderHealthProbeAttemptType> {
    const { workspaceId } = await this.assertPermission(user, {
      workspaceId: input.workspaceId,
    });

    return await this.modelsStore.copilotProviderHealthState.retryDeadLetteredProviderHealthProbeAttempt(
      {
        workspaceId,
        attemptId: input.attemptId,
      }
    );
  }

  @ResolveField(() => CopilotActionRunPreparedRouteDiagnosticsType, {
    nullable: true,
    description:
      'Get sanitized prepared route diagnostics for an action run in the current workspace',
    complexity: 2,
  })
  async actionRunPreparedRouteTrace(
    @CurrentUser() user: CurrentUser,
    @Parent() copilot: CopilotType,
    @Args('runId') runId: string
  ): Promise<CopilotActionRunPreparedRouteDiagnosticsType | null> {
    const { workspaceId } = await this.assertPermission(user, copilot);

    return await this.modelsStore.copilotActionRun.getPreparedRouteTrace(
      runId,
      {
        userId: user.id,
        workspaceId,
      }
    );
  }

  @ResolveField(() => [CopilotActionRunDiagnosticsItemType], {
    description:
      'List recent sanitized action runs for diagnostics in the current workspace',
    complexity: 2,
  })
  async actionRuns(
    @CurrentUser() user: CurrentUser,
    @Parent() copilot: CopilotType,
    @Args('limit', { type: () => SafeIntResolver, nullable: true })
    limit?: number
  ): Promise<CopilotActionRunDiagnosticsItemType[]> {
    const { workspaceId } = await this.assertPermission(user, copilot);

    return await this.modelsStore.copilotActionRun.listRecentDiagnostics(
      {
        userId: user.id,
        workspaceId,
      },
      { limit }
    );
  }

  @ResolveField(() => [CopilotSupportBundleType], {
    description:
      'List recent DB-backed support bundle requests for the current workspace',
    complexity: 2,
  })
  async supportBundles(
    @CurrentUser() user: CurrentUser,
    @Parent() copilot: CopilotType,
    @Args('limit', { type: () => SafeIntResolver, nullable: true })
    limit?: number,
    @Args('filter', {
      type: () => CopilotSupportBundleListFilterInput,
      nullable: true,
    })
    filter?: CopilotSupportBundleListFilterInput
  ): Promise<CopilotSupportBundleType[]> {
    const { workspaceId } = await this.assertPermission(user, copilot);

    return await this.modelsStore.copilotSupportBundle.list(workspaceId, {
      filter,
      limit,
    });
  }

  @ResolveField(() => CopilotSupportBundleType, {
    nullable: true,
    description:
      'Get a DB-backed support bundle request and record a read audit event',
    complexity: 2,
  })
  async supportBundle(
    @CurrentUser() user: CurrentUser,
    @Parent() copilot: CopilotType,
    @Args('id') id: string
  ): Promise<CopilotSupportBundleType | null> {
    const { workspaceId } = await this.assertPermission(user, copilot);
    const bundle = await this.modelsStore.copilotSupportBundle.get(
      workspaceId,
      id
    );

    if (!bundle) {
      return null;
    }

    await this.modelsStore.copilotSupportBundle.recordRead({
      bundleId: bundle.id,
      workspaceId,
      actorId: user.id,
      manifestFingerprint: bundle.manifestFingerprint,
    });

    return await this.modelsStore.copilotSupportBundle.get(workspaceId, id);
  }

  @ResolveField(() => [CopilotAgentRunType], {
    description:
      'List recent persisted Agent Runtime runs for the current workspace',
    complexity: 2,
  })
  async agentRuns(
    @CurrentUser() user: CurrentUser,
    @Parent() copilot: CopilotType,
    @Args('limit', { type: () => SafeIntResolver, nullable: true })
    limit?: number,
    @Args('filter', {
      type: () => CopilotAgentRunListFilterInput,
      nullable: true,
    })
    filter?: CopilotAgentRunListFilterInput
  ): Promise<CopilotAgentRunType[]> {
    const { workspaceId } = await this.assertPermission(user, copilot);

    return await this.modelsStore.copilotAgentRuntime.listForWorkspaceViewer(
      workspaceId,
      user.id,
      { filter, limit }
    );
  }

  @ResolveField(() => [CopilotTaskType], {
    description:
      'List standalone Copilot tasks owned by the current user in one workspace or across all accessible workspaces.',
    complexity: 2,
  })
  async copilotTasks(
    @CurrentUser() user: CurrentUser,
    @Parent() copilot: CopilotType,
    @Args('limit', { type: () => SafeIntResolver, nullable: true })
    limit?: number,
    @Args('filter', {
      type: () => CopilotTaskListFilterInput,
      nullable: true,
    })
    filter?: CopilotTaskListFilterInput
  ): Promise<CopilotTaskType[]> {
    const runs = copilot.workspaceId
      ? await this.modelsStore.copilotAgentRuntime.listForActor(
          (await this.assertPermission(user, copilot)).workspaceId,
          user.id,
          { filter, limit }
        )
      : await this.modelsStore.copilotAgentRuntime.listForActorAcrossAccessibleWorkspaces(
          user.id,
          { filter, limit }
        );
    return await Promise.all(
      runs.map(run => this.projectTaskForViewer(run, user.id))
    );
  }

  @ResolveField(() => [CopilotRepairExecutionRecordType], {
    description:
      'List recent persisted repair execution requests for the current workspace',
    complexity: 2,
  })
  async repairExecutions(
    @CurrentUser() user: CurrentUser,
    @Parent() copilot: CopilotType,
    @Args('limit', { type: () => SafeIntResolver, nullable: true })
    limit?: number,
    @Args('filter', {
      type: () => CopilotRepairExecutionListFilterInput,
      nullable: true,
    })
    filter?: CopilotRepairExecutionListFilterInput
  ): Promise<CopilotRepairExecutionRecordType[]> {
    const { workspaceId } = await this.assertPermission(user, copilot);

    const records = await this.modelsStore.copilotRepairExecution.list(
      workspaceId,
      {
        filter,
        limit,
      }
    );
    const recordsWithRuns = await Promise.all(
      records.map(async record => ({
        ...record,
        agentRun:
          (await this.modelsStore.copilotAgentRuntime?.getBySource(
            workspaceId,
            'repair_execution_request',
            record.id
          )) ?? null,
      }))
    );

    return recordsWithRuns;
  }

  @ResolveField(() => [CopilotAgentRuntimeWorkflowAdapterType], {
    description:
      'List registered Agent Runtime workflow adapter capabilities for standalone run diagnostics',
    complexity: 1,
  })
  async agentRuntimeWorkflowAdapters(
    @CurrentUser() user: CurrentUser,
    @Parent() copilot: CopilotType
  ): Promise<CopilotAgentRuntimeWorkflowAdapterType[]> {
    await this.assertPermission(user, copilot);

    return this.agentRuntimeWorkflowRegistry?.adapterCapabilities() ?? [];
  }

  @ResolveField(() => [CopilotProviderHealthProbeAttemptType], {
    description:
      'List recent DB-backed provider health probe attempts for the current workspace',
    complexity: 2,
  })
  async providerHealthProbeAttempts(
    @CurrentUser() user: CurrentUser,
    @Parent() copilot: CopilotType,
    @Args('limit', { type: () => SafeIntResolver, nullable: true })
    limit?: number,
    @Args('filter', {
      type: () => CopilotProviderHealthProbeAttemptFilterInput,
      nullable: true,
    })
    filter?: CopilotProviderHealthProbeAttemptFilterInput
  ): Promise<CopilotProviderHealthProbeAttemptType[]> {
    const { workspaceId } = await this.assertPermission(user, copilot);

    return await this.modelsStore.copilotProviderHealthState.listProviderHealthProbeAttempts(
      {
        filter,
        workspaceId,
        limit,
      }
    );
  }

  @ResolveField(() => CopilotAgentRunType, {
    nullable: true,
    description:
      'Get a persisted Agent Runtime run with steps and timeline for the current workspace',
    complexity: 2,
  })
  async agentRun(
    @CurrentUser() user: CurrentUser,
    @Parent() copilot: CopilotType,
    @Args('id') id: string
  ): Promise<CopilotAgentRunType | null> {
    const { workspaceId } = await this.assertPermission(user, copilot);

    return await this.modelsStore.copilotAgentRuntime.getForWorkspaceViewer(
      workspaceId,
      user.id,
      id
    );
  }

  @ResolveField(() => CopilotTaskType, {
    nullable: true,
    description:
      'Get one standalone Copilot task owned by the current user in the current workspace.',
    complexity: 2,
  })
  async copilotTask(
    @CurrentUser() user: CurrentUser,
    @Parent() copilot: CopilotType,
    @Args('id') id: string
  ): Promise<CopilotTaskType | null> {
    const { workspaceId } = await this.assertPermission(user, copilot);
    const run = await this.modelsStore.copilotAgentRuntime.getForActor(
      workspaceId,
      user.id,
      id
    );
    return run ? await this.projectTaskForViewer(run, user.id) : null;
  }

  @ResolveField(() => CopilotModelsType, {
    description:
      'List available models for a prompt, with human-readable names',
    complexity: 2,
  })
  async models(
    @Args('promptName') promptName: string,
    @Parent() copilot?: CopilotType
  ): Promise<CopilotModelsType> {
    const prompt = await this.prompt.get(promptName);
    if (!prompt) {
      throw new NotFoundException('Prompt not found');
    }
    const routePolicyContext = modelListRoutePolicyContext(
      copilot?.workspaceId
    );
    const promptMetadata = {
      promptName: prompt.name,
      ...(prompt.action ? { promptAction: prompt.action } : {}),
      promptSource: prompt.source,
      promptCategory: prompt.category,
      ...(prompt.defaultPolicy
        ? { promptDefaultPolicy: prompt.defaultPolicy }
        : {}),
      promptOverrideApplied: prompt.overrideApplied,
    };
    const routePolicyMetadata = (
      routePolicy: CopilotProviderRoutePolicySummary
    ) => ({
      routePolicyEnabled: routePolicy.enabled,
      ...(routePolicy.featureKind
        ? { routePolicyFeatureKind: routePolicy.featureKind }
        : {}),
      ...(routePolicy.workspaceId
        ? { routePolicyWorkspaceId: routePolicy.workspaceId }
        : {}),
      ...(routePolicy.allowedProviderIds !== undefined
        ? { routePolicyAllowedProviderIds: routePolicy.allowedProviderIds }
        : {}),
      ...(routePolicy.blockedProviderIds !== undefined
        ? { routePolicyBlockedProviderIds: routePolicy.blockedProviderIds }
        : {}),
      ...(routePolicy.allowedPrivacy !== undefined
        ? { routePolicyAllowedPrivacy: routePolicy.allowedPrivacy }
        : {}),
      ...(routePolicy.preferredPrivacy !== undefined
        ? { routePolicyPreferredPrivacy: routePolicy.preferredPrivacy }
        : {}),
    });
    const resolvePromptModelProvenance = (
      sources: CopilotModelSource[]
    ): Pick<
      CopilotModelCandidate,
      'promptModelConfigPath' | 'promptModelSource' | 'promptModelSources'
    > => {
      const promptModelSources = sources.map(source => {
        if (source === 'default') {
          return {
            candidateSource: source,
            ...(prompt.modelConfigPath
              ? { modelConfigPath: prompt.modelConfigPath }
              : {}),
            modelSource: prompt.modelSource,
          };
        }

        if (source === 'fallback_route') {
          return {
            candidateSource: source,
          };
        }

        if (source === 'prompt') {
          return {
            candidateSource: source,
            ...(prompt.optionalModelsConfigPath
              ? { modelConfigPath: prompt.optionalModelsConfigPath }
              : {}),
            modelSource: prompt.optionalModelsSource,
          };
        }

        if (source === 'pro') {
          return {
            candidateSource: source,
            ...(prompt.proModelsConfigPath
              ? { modelConfigPath: prompt.proModelsConfigPath }
              : {}),
            modelSource: prompt.proModelsSource,
          };
        }

        return {
          candidateSource: source,
        };
      });

      if (sources.includes('default')) {
        return {
          promptModelSources,
          ...(prompt.modelConfigPath
            ? { promptModelConfigPath: prompt.modelConfigPath }
            : {}),
          promptModelSource: prompt.modelSource,
        };
      }

      if (sources.includes('prompt')) {
        return {
          promptModelSources,
          ...(prompt.optionalModelsConfigPath
            ? { promptModelConfigPath: prompt.optionalModelsConfigPath }
            : {}),
          promptModelSource: prompt.optionalModelsSource,
        };
      }

      if (sources.includes('pro')) {
        return {
          promptModelSources,
          ...(prompt.proModelsConfigPath
            ? { promptModelConfigPath: prompt.proModelsConfigPath }
            : {}),
          promptModelSource: prompt.proModelsSource,
        };
      }

      return { promptModelSources };
    };
    const collectCandidates = (
      entries: Array<{ id?: string; source: CopilotModelSource }>
    ): CopilotModelCandidate[] => {
      const candidates = new Map<string, CopilotModelSource[]>();
      for (const entry of entries) {
        if (!entry.id) {
          continue;
        }
        const sources = candidates.get(entry.id) ?? [];
        if (!sources.includes(entry.source)) {
          sources.push(entry.source);
        }
        candidates.set(entry.id, sources);
      }
      return Array.from(candidates.entries()).map(([id, sources]) => ({
        id,
        ...resolvePromptModelProvenance(sources),
        sources,
      }));
    };
    const convertModels = async (candidates: CopilotModelCandidate[]) => {
      if (!candidates.length) {
        return [];
      }

      const routePolicy =
        this.providerFactory.describeRoutePolicy(routePolicyContext);
      const models = await Promise.all(
        candidates.map(async candidate => {
          const {
            id,
            promptModelConfigPath,
            promptModelSource,
            promptModelSources,
            sources,
          } = candidate;
          const resolved = await this.providerFactory.resolveProvider(
            {
              modelId: id,
              outputType: ModelOutputType.Text,
            },
            {},
            routePolicyContext
          );
          if (!resolved) {
            return null;
          }

          const providerModel = resolved.provider.resolveModel(
            resolved.modelId ?? id,
            resolved.execution
          );
          const resolvedProviderModel = providerModel as
            | Partial<ResolvedProviderModel>
            | undefined;
          const routeModelId = providerModel?.id ?? resolved.modelId ?? id;
          const profileModelIds = getProfileConfiguredModelIds(
            resolved.profile
          );
          const profileDefinition = resolveProfileModelDefinition(
            resolved.profile,
            id,
            routeModelId
          );
          const routeModelDefinitionSource = resolveModelDefinitionSource(
            resolved.profile,
            resolvedProviderModel,
            profileDefinition
          );
          const routeModelAliasMatched =
            profileDefinition?.aliases?.includes(id);
          const modelRegistryMetadata =
            profileDefinition?.registryRecordSource === 'db_revision'
              ? {
                  modelRegistryRevision: profileDefinition.registryRevision,
                  modelRegistryRevisionActorId:
                    profileDefinition.registryRevisionActorId,
                  modelRegistryRevisionFingerprint:
                    profileDefinition.registryRevisionFingerprint,
                  modelRegistryRevisionId: profileDefinition.registryRevisionId,
                  modelRegistryRevisionScope:
                    profileDefinition.registryRevisionScope,
                  modelRegistryRevisionSourceChain:
                    profileDefinition.registryRevisionSourceChain,
                  modelRegistryRevisionSourceChainFingerprint:
                    profileDefinition.registryRevisionSourceChainFingerprint,
                  modelRegistryRevisionStatus:
                    profileDefinition.registryRevisionStatus,
                  modelRegistryRevisionWorkspaceId:
                    profileDefinition.registryRevisionWorkspaceId,
                  modelRegistryRevisionPublishEventCount:
                    profileDefinition.registryRevisionPublishEventCount,
                  modelRegistryRevisionPublishEvents:
                    profileDefinition.registryRevisionPublishEvents,
                }
              : {};
          const profileConfigPath = providerProfileConfigPath(resolved.profile);
          const routeModelDefinitionId =
            profileDefinition?.id ??
            resolvedProviderModel?.canonicalKey ??
            (routeModelDefinitionSource === 'provider_runtime'
              ? routeModelId
              : undefined);
          const routeRawModelId =
            profileDefinition?.rawModelId ??
            (routeModelDefinitionId &&
            resolvedProviderModel?.id &&
            resolvedProviderModel.id !== routeModelDefinitionId
              ? resolvedProviderModel.id
              : undefined);
          const routeCapabilities = profileDefinition?.capabilities?.length
            ? profileDefinition.capabilities
            : resolvedProviderModel?.capabilities;
          const modelDefinitionMetadata = {
            ...(resolvedProviderModel?.backendKind
              ? { routeBackendKind: resolvedProviderModel.backendKind }
              : {}),
            ...(resolvedProviderModel?.canonicalKey
              ? {
                  routeCanonicalModelKey: resolvedProviderModel.canonicalKey,
                }
              : {}),
            ...(routeRawModelId ? { routeRawModelId } : {}),
            ...(routeModelDefinitionSource
              ? { routeModelDefinitionSource }
              : {}),
            ...(routeModelDefinitionId ? { routeModelDefinitionId } : {}),
            ...(profileDefinition?.aliases?.length
              ? { routeModelDefinitionAliases: profileDefinition.aliases }
              : {}),
            ...(routeModelAliasMatched !== undefined
              ? { routeModelAliasMatched }
              : {}),
            ...modelRegistryMetadata,
            ...(resolvedProviderModel?.protocol
              ? { routeProtocol: resolvedProviderModel.protocol }
              : {}),
            ...(resolvedProviderModel?.requestLayer
              ? { routeRequestLayer: resolvedProviderModel.requestLayer }
              : {}),
            ...(resolvedProviderModel?.behaviorFlags?.length
              ? {
                  routeBehaviorFlags: resolvedProviderModel.behaviorFlags,
                }
              : {}),
            ...collectModelCapabilityTypes(routeCapabilities),
          };
          const baseModelMetadata = {
            id,
            sources,
            ...promptMetadata,
            ...(promptModelSource ? { promptModelSource } : {}),
            ...(promptModelConfigPath ? { promptModelConfigPath } : {}),
            promptModelSources,
            providerId: resolved.providerId,
            ...(resolved.profile.displayName
              ? { providerName: resolved.profile.displayName }
              : {}),
            ...(resolved.profile.source
              ? { providerSource: resolved.profile.source }
              : {}),
            providerProfileId: resolved.profile.id,
            ...(resolved.profile.source
              ? { providerProfileSource: resolved.profile.source }
              : {}),
            ...(profileConfigPath
              ? { providerProfileConfigPath: profileConfigPath }
              : {}),
            ...(profileModelIds.length
              ? {
                  providerConfiguredModelIds: profileModelIds,
                  providerConfiguredModelCount: profileModelIds.length,
                }
              : {}),
            routeModelId,
            ...(resolved.fallbackProviderIds?.length
              ? { routeFallbackProviderIds: resolved.fallbackProviderIds }
              : {}),
            ...(resolved.registryKind
              ? { registryKind: resolved.registryKind }
              : {}),
            ...(resolved.registryAvailable !== undefined
              ? { registryAvailable: resolved.registryAvailable }
              : {}),
            ...(resolved.registrySelected !== undefined
              ? { registrySelected: resolved.registrySelected }
              : {}),
            ...modelDefinitionMetadata,
            providerType: resolved.profile.type,
            providerPrivacy: resolved.profile.privacy ?? 'cloud',
            providerHealth: resolved.profile.health?.status ?? 'unknown',
            ...(resolved.profile.health?.lastCheckedAt
              ? {
                  providerHealthCheckedAt:
                    resolved.profile.health.lastCheckedAt,
                }
              : {}),
            ...(resolved.profile.health?.lastError
              ? {
                  providerHealthLastError: resolved.profile.health.lastError,
                }
              : {}),
            providerPriority: resolved.profile.priority,
            ...routePolicyMetadata(routePolicy),
          };

          const limits = providerModel
            ? resolveModelLimits(providerModel)
            : undefined;
          const contextWindow =
            profileDefinition?.limits?.contextWindow ?? limits?.contextWindow;
          const maxOutputTokens =
            profileDefinition?.limits?.maxOutputTokens ??
            limits?.maxOutputTokens;
          const embeddingDimensions =
            profileDefinition?.limits?.embeddingDimensions ??
            limits?.embeddingDimensions;
          const costInputPer1M =
            profileDefinition?.cost?.inputPer1M ??
            resolvedProviderModel?.cost?.inputPer1M;
          const costOutputPer1M =
            profileDefinition?.cost?.outputPer1M ??
            resolvedProviderModel?.cost?.outputPer1M;
          const modelMetadata = {
            ...baseModelMetadata,
            ...(contextWindow !== undefined ? { contextWindow } : {}),
            ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
            ...(embeddingDimensions !== undefined
              ? { embeddingDimensions }
              : {}),
            ...(costInputPer1M !== undefined ? { costInputPer1M } : {}),
            ...(costOutputPer1M !== undefined ? { costOutputPer1M } : {}),
          };
          const effectiveSourceFingerprint =
            buildModelListEffectiveSourceFingerprint(modelMetadata);
          const effectiveSourceMetadata = {
            effectiveSourceFingerprint,
            effectiveSourceFingerprintInputs: [
              ...COPILOT_MODEL_LIST_EFFECTIVE_SOURCE_FINGERPRINT_INPUTS,
            ],
            effectiveSourceFingerprintVersion:
              COPILOT_MODEL_LIST_EFFECTIVE_SOURCE_FINGERPRINT_VERSION,
          };

          const cachedName = this.modelNames.get(id);
          if (cachedName) {
            return {
              ...modelMetadata,
              ...effectiveSourceMetadata,
              name: cachedName,
            };
          }

          const name = providerModel?.name;
          if (name) {
            this.modelNames.set(id, name);
            return { ...modelMetadata, ...effectiveSourceMetadata, name };
          }
          return null;
        })
      );

      return models.filter(model => !!model) as CopilotModelType[];
    };
    const taskRoutes = await this.resolveTaskRouteDiagnostics(copilot);
    const proModels = prompt.config?.proModels || [];
    const configuredModelIds =
      await this.resolveEffectiveConfiguredModelIds(routePolicyContext);
    const resolvedPromptDefault = await this.providerFactory.resolveModelId(
      {
        modelId: prompt.model,
        outputType: ModelOutputType.Text,
      },
      {},
      routePolicyContext
    );
    const defaultModel = resolvedPromptDefault
      ? prompt.model
      : ((await this.providerFactory.resolveModelId(
          {
            outputType: ModelOutputType.Text,
          },
          {},
          routePolicyContext
        )) ?? prompt.model);
    const defaultModelSource = resolvedPromptDefault
      ? ('prompt' as const)
      : ('fallback_route' as const);

    return {
      defaultModel,
      promptDefaultModel: prompt.model,
      defaultModelSource,
      ...(defaultModelSource === 'fallback_route'
        ? { defaultModelFallbackReason: 'prompt_default_unavailable' }
        : {}),
      embeddingRoute: taskRoutes.embeddingRoute,
      rerankRoute: taskRoutes.rerankRoute,
      optionalModels: await convertModels(
        collectCandidates([
          {
            id: defaultModel,
            source:
              defaultModelSource === 'fallback_route'
                ? 'fallback_route'
                : 'default',
          },
          ...prompt.optionalModels.map(id => ({
            id,
            source: 'prompt' as const,
          })),
          ...configuredModelIds.map(id => ({
            id,
            source: 'registry' as const,
          })),
        ])
      ),
      proModels: await convertModels(
        collectCandidates(
          proModels.map(id => ({
            id,
            source: 'pro' as const,
          }))
        )
      ),
    };
  }

  @ResolveField(() => CopilotSessionType, {
    description: 'Get the session by id',
    complexity: 2,
  })
  async session(
    @Parent() copilot: CopilotType,
    @CurrentUser() user: CurrentUser,
    @Args('sessionId') sessionId: string
  ): Promise<CopilotSessionType> {
    await this.assertPermission(user, copilot);
    const state = await this.chatSession.getMetaState(sessionId);
    if (!state) {
      throw new NotFoundException('Session not found');
    }

    const projected = this.historyProjector.projectSession(state, {
      requestUserId: user.id,
      skipVisibilityFilter: true,
    });
    if (!projected) {
      throw new NotFoundException('Session not found');
    }

    return this.transformToSessionType(projected);
  }

  @ResolveField(() => [CopilotSessionType], {
    description: 'Get the session list in the workspace',
    deprecationReason: 'use `chats` instead',
    complexity: 2,
  })
  async sessions(
    @Parent() copilot: CopilotType,
    @CurrentUser() user: CurrentUser,
    @Args('docId', { nullable: true }) maybeDocId?: string,
    @Args('options', { nullable: true }) options?: QueryChatSessionsInput
  ): Promise<CopilotSessionType[]> {
    if (!copilot.workspaceId) {
      return [];
    }

    const appendOptions = await this.assertPermission(
      user,
      Object.assign({}, copilot, { docId: maybeDocId })
    );

    const sessions = (
      await this.chatSession.listMetaStates(
        Object.assign({}, options, appendOptions)
      )
    )
      .map(state =>
        this.historyProjector.projectSession(state, {
          requestUserId: user.id,
        })
      )
      .filter((history): history is Omit<ChatHistory, 'messages'> => !!history);
    if (appendOptions.docId) {
      type Session = Omit<ChatHistory, 'messages'> & { docId: string };
      const filtered = sessions.filter((s): s is Session => !!s.docId);
      const accessible = await this.ac
        .user(user.id)
        .workspace(copilot.workspaceId)
        .docs(filtered, 'Doc.Update');
      return accessible.map(this.transformToSessionType);
    } else {
      return sessions.map(this.transformToSessionType);
    }
  }

  @ResolveField(() => [CopilotHistoriesType], {
    deprecationReason: 'use `chats` instead',
  })
  @CallMetric('ai', 'histories')
  async histories(
    @Parent() copilot: CopilotType,
    @CurrentUser() user: CurrentUser,
    @Args('docId', { nullable: true }) docId?: string,
    @Args('options', { nullable: true }) options?: QueryChatHistoriesInput
  ): Promise<CopilotHistoriesType[]> {
    const workspaceId = copilot.workspaceId;
    if (!workspaceId) {
      return [];
    } else {
      await this.assertPermission(user, { workspaceId, docId }, 'Doc.Read');
    }

    const histories = (
      await this.chatSession.listStates(
        Object.assign({}, options, { userId: user.id, workspaceId, docId })
      )
    )
      .map(state =>
        this.historyProjector.projectHistory(state, {
          requestUserId: user.id,
          withMessages: true,
          withPrompt: options?.withPrompt,
          action: options?.action,
        })
      )
      .filter((history): history is ChatHistory => !!history);

    return histories.map(h => ({
      ...h,
      // filter out empty messages
      messages: h.messages.filter(
        m => m.content || m.attachments?.length
      ) as ChatMessageType[],
    }));
  }

  @ResolveField(() => PaginatedCopilotHistoriesType, {})
  @CallMetric('ai', 'histories')
  async chats(
    @Parent() copilot: CopilotType,
    @CurrentUser() user: CurrentUser,
    @Args('pagination', PaginationInput.decode) pagination: PaginationInput,
    @Args('docId', { nullable: true }) docId?: string,
    @Args('options', { nullable: true }) options?: QueryChatHistoriesInput
  ): Promise<PaginatedCopilotHistoriesType> {
    const workspaceId = copilot.workspaceId;
    if (!workspaceId) {
      return paginate([], 'updatedAt', pagination, 0);
    } else {
      await this.assertPermission(user, { workspaceId, docId }, 'Doc.Read');
    }

    const finalOptions = Object.assign(
      {},
      options,
      { userId: user.id, workspaceId, docId },
      { skip: pagination.offset, limit: pagination.first }
    );
    const totalCount = await this.chatSession.count(finalOptions);
    const histories: ChatHistory[] = options?.withMessages
      ? (await this.chatSession.listStates(finalOptions))
          .map(state =>
            this.historyProjector.projectHistory(state, {
              requestUserId: user.id,
              withMessages: true,
              withPrompt: options?.withPrompt,
              action: options?.action,
            })
          )
          .filter((history): history is ChatHistory => !!history)
      : (await this.chatSession.listMetaStates(finalOptions)).flatMap(state => {
          const session = this.historyProjector.projectSession(state, {
            requestUserId: user.id,
          });
          return session
            ? [{ ...session, messages: [] as ChatHistory['messages'] }]
            : [];
        });

    return paginate(
      histories.map(h => ({
        ...h,
        // filter out empty messages
        messages: h.messages.filter(
          m => m.content || m.attachments?.length
        ) as ChatMessageType[],
      })),
      'updatedAt',
      pagination,
      totalCount
    );
  }

  private async createCopilotSessionInternal(
    user: CurrentUser,
    options: CreateChatSessionInput
  ): Promise<string> {
    // permission check based on session type
    await this.assertPermission(user, options);

    const lockFlag = `${COPILOT_LOCKER}:session:${user.id}:${options.workspaceId}`;
    await using lock = await this.mutex.acquire(lockFlag);
    if (!lock) {
      throw new TooManyRequest('Server is busy');
    }

    return await this.chatSession.create({
      ...options,
      pinned: options.pinned ?? false,
      docId: options.docId ?? null,
      userId: user.id,
    });
  }

  @Mutation(() => String, {
    description: 'Create a chat session',
    deprecationReason: 'use `createCopilotSessionWithHistory` instead',
  })
  @CallMetric('ai', 'chat_session_create')
  async createCopilotSession(
    @CurrentUser() user: CurrentUser,
    @Args({ name: 'options', type: () => CreateChatSessionInput })
    options: CreateChatSessionInput
  ): Promise<string> {
    return await this.createCopilotSessionInternal(user, options);
  }

  @Mutation(() => CopilotHistoriesType, {
    description: 'Create a chat session and return full session payload',
  })
  @CallMetric('ai', 'chat_session_create_with_history')
  async createCopilotSessionWithHistory(
    @CurrentUser() user: CurrentUser,
    @Args({ name: 'options', type: () => CreateChatSessionInput })
    options: CreateChatSessionInput
  ): Promise<CopilotHistoriesType> {
    const sessionId = await this.createCopilotSessionInternal(user, options);
    const state = await this.chatSession.getState(sessionId);
    if (!state) {
      throw new NotFoundException('Session not found');
    }
    const session = this.historyProjector.projectHistory(state, {
      requestUserId: user.id,
      withMessages: true,
      withPrompt: false,
      action: !!state.prompt.action,
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return {
      ...session,
      messages: session.messages.map(message => ({
        ...message,
        id: message.id,
      })) as ChatMessageType[],
    };
  }

  @Mutation(() => String, {
    description: 'Update a chat session',
  })
  @CallMetric('ai', 'chat_session_update')
  async updateCopilotSession(
    @CurrentUser() user: CurrentUser,
    @Args({ name: 'options', type: () => UpdateChatSessionInput })
    options: UpdateChatSessionInput
  ): Promise<string> {
    const session = await this.chatSession.get(options.sessionId);
    if (!session) {
      throw new CopilotSessionNotFound();
    }

    const config = await this.assertPermission(user, session.config);
    const { workspaceId, docId: currentDocId } = config;
    const { docId: newDocId } = options;
    // check permission if the docId is changed
    if (newDocId !== undefined && newDocId !== currentDocId) {
      await this.assertPermission(user, { workspaceId, docId: newDocId });
    }
    if (
      options.selectedContextProjectId !== undefined &&
      options.selectedContextProjectId !== null
    ) {
      const selectedContextProjectId = options.selectedContextProjectId.trim();
      if (!selectedContextProjectId) {
        options.selectedContextProjectId = null;
      } else {
        const scope = await this.contextScopeResolver.resolve({
          userId: user.id,
          workspaceId,
          sessionId: options.sessionId,
          primaryDocId:
            newDocId === undefined ? (currentDocId ?? null) : newDocId,
          selectedProjectId: selectedContextProjectId,
        });
        if (scope.selectedProjectId !== selectedContextProjectId) {
          throw new BadRequest(
            'The selected context project is not active or does not match a readable context document'
          );
        }
        options.selectedContextProjectId = selectedContextProjectId;
      }
    }

    const lockFlag = `${COPILOT_LOCKER}:session:${user.id}:${workspaceId}`;
    await using lock = await this.mutex.acquire(lockFlag);
    if (!lock) {
      throw new TooManyRequest('Server is busy');
    }

    return await this.chatSession.update({
      ...options,
      userId: user.id,
    });
  }

  @Mutation(() => String, {
    description: 'Create a chat session',
  })
  @CallMetric('ai', 'chat_session_fork')
  async forkCopilotSession(
    @CurrentUser() user: CurrentUser,
    @Args({ name: 'options', type: () => ForkChatSessionInput })
    options: ForkChatSessionInput
  ): Promise<string> {
    await this.ac
      .user(user.id)
      .doc(options)
      .projectScope(null)
      .allowLocal()
      .assert('Doc.Update');
    const lockFlag = `${COPILOT_LOCKER}:session:${user.id}:${options.workspaceId}`;
    await using lock = await this.mutex.acquire(lockFlag);
    if (!lock) {
      throw new TooManyRequest('Server is busy');
    }

    if (options.workspaceId === options.docId) {
      // filter out session create request for root doc
      throw new CopilotDocNotFound({ docId: options.docId });
    }

    return await this.chatSession.fork({
      ...options,
      userId: user.id,
    });
  }

  @Mutation(() => [String], {
    description: 'Cleanup sessions',
  })
  @CallMetric('ai', 'chat_session_cleanup')
  async cleanupCopilotSession(
    @CurrentUser() user: CurrentUser,
    @Args({ name: 'options', type: () => DeleteSessionInput })
    options: DeleteSessionInput
  ): Promise<string[]> {
    const { workspaceId, docId, sessionIds } = options;
    if (docId) {
      await this.ac
        .user(user.id)
        .doc({ workspaceId, docId })
        .allowLocal()
        .assert('Doc.Update');
    } else {
      await this.ac
        .user(user.id)
        .workspace(workspaceId)
        .allowLocal()
        .assert('Workspace.Copilot');
    }
    if (!sessionIds.length) {
      throw new NotFoundException('Session not found');
    }
    const lockFlag = `${COPILOT_LOCKER}:session:${user.id}:${workspaceId}`;
    await using lock = await this.mutex.acquire(lockFlag);
    if (!lock) {
      throw new TooManyRequest('Server is busy');
    }

    return await this.chatSession.cleanup({
      ...options,
      userId: user.id,
    });
  }

  @Mutation(() => String, {
    description: 'Create a chat message',
  })
  @CallMetric('ai', 'chat_message_create')
  async createCopilotMessage(
    @CurrentUser() user: CurrentUser,
    @Args({ name: 'options', type: () => CreateChatMessageInput })
    options: CreateChatMessageInput
  ): Promise<string> {
    const lockFlag = `${COPILOT_LOCKER}:message:${user?.id}:${options.sessionId}`;
    await using lock = await this.mutex.acquire(lockFlag);
    if (!lock) {
      throw new TooManyRequest('Server is busy');
    }
    try {
      return await this.inbox.createMessage(user.id, options);
    } catch (e: any) {
      throw new CopilotFailedToCreateMessage(e.message);
    }
  }

  private transformToSessionType(session: Omit<ChatHistory, 'messages'>) {
    return { id: session.sessionId, ...session };
  }
}

@Throttle()
@Resolver(() => UserType)
export class UserCopilotResolver {
  constructor(private readonly ac: PermissionAccess) {}

  @ResolveField(() => CopilotType)
  async copilot(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { nullable: true }) workspaceId?: string
  ): Promise<CopilotType> {
    if (workspaceId) {
      await this.ac
        .user(user.id)
        .workspace(workspaceId)
        .allowLocal()
        .assert('Workspace.Copilot');
    }
    return { workspaceId: workspaceId || null };
  }
}
