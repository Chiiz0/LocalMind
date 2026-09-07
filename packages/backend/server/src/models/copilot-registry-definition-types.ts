import type { LlmBackendConfig, LlmProtocol } from '../native';
import type {
  CopilotModelBackendKind,
  CopilotProviderType,
  ModelInputType,
  ModelOutputType,
  PromptAttachmentKind,
  PromptAttachmentSourceKind,
} from '../plugins/copilot/providers/types';
import type { RegistryRevisionPublishEventRecord } from './copilot-registry-revision-publish-event';

export const CopilotProviderProfileSourceValues = [
  'configured',
  'legacy',
  'db_revision',
  'byok_server',
  'byok_local',
  'byok_project_global',
] as const;

export type CopilotProviderProfileSource =
  (typeof CopilotProviderProfileSourceValues)[number];

export const CopilotProviderPrivacyValues = [
  'cloud',
  'private_cloud',
  'local',
] as const;

export type CopilotProviderPrivacy =
  (typeof CopilotProviderPrivacyValues)[number];

export const CopilotModelBackendKindValues = [
  'openai_chat',
  'openai_responses',
  'anthropic',
  'cloudflare_workers_ai',
  'gemini_api',
  'gemini_vertex',
  'fal',
  'anthropic_vertex',
  'deepseek',
  'kimi',
  'opencode_go',
  'opencode_zen',
] as const satisfies readonly CopilotModelBackendKind[];

export const LlmProtocolValues = [
  'openai_chat',
  'openai_responses',
  'openai_images',
  'anthropic',
  'gemini',
  'fal_image',
] as const satisfies readonly LlmProtocol[];

export const LlmRequestLayerValues = [
  'anthropic',
  'chat_completions',
  'chat_completions_no_v1',
  'cloudflare_workers_ai',
  'responses',
  'openai_images',
  'fal',
  'vertex',
  'vertex_anthropic',
  'gemini_api',
  'gemini_vertex',
] as const satisfies readonly NonNullable<LlmBackendConfig['request_layer']>[];

export const CopilotProviderHealthStatusValues = [
  'unknown',
  'healthy',
  'degraded',
  'down',
] as const;

export type CopilotProviderHealthStatus =
  (typeof CopilotProviderHealthStatusValues)[number];

export type CopilotProviderHealth = {
  status: CopilotProviderHealthStatus;
  lastCheckedAt?: string;
  lastError?: string;
};

export type RustRequestMiddleware =
  | 'normalize_messages'
  | 'clamp_max_tokens'
  | 'tool_schema_rewrite'
  | 'openai_request_compat';

export type RustStreamMiddleware =
  | 'stream_event_normalize'
  | 'citation_indexing';

export type NodeTextMiddleware =
  | 'citation_footnote'
  | 'callout'
  | 'thinking_format';

export type ProviderMiddlewareConfig = {
  rust?: { request?: RustRequestMiddleware[]; stream?: RustStreamMiddleware[] };
  node?: { text?: NodeTextMiddleware[] };
};

export type CopilotModelDefinitionCapability = {
  input: ModelInputType[];
  output: ModelOutputType[];
  attachments?: {
    kinds: PromptAttachmentKind[];
    sourceKinds?: PromptAttachmentSourceKind[];
    allowRemoteUrls?: boolean;
  };
  structuredAttachments?: {
    kinds: PromptAttachmentKind[];
    sourceKinds?: PromptAttachmentSourceKind[];
    allowRemoteUrls?: boolean;
  };
  defaultForOutputType?: boolean;
};

export type CopilotModelRouteOverride = {
  protocol?: LlmProtocol;
  requestLayer?: LlmBackendConfig['request_layer'];
};

export type CopilotModelRegistrySourceChainEntry = {
  source:
    | 'db_revision'
    | 'provider_profile'
    | 'native_registry'
    | 'config_fallback';
  scope: 'global' | 'workspace';
  status: string;
  actorId?: string;
  fingerprint?: string;
  modelId?: string;
  providerId?: string;
  revision?: string;
  updatedAt?: string;
  workspaceId?: string;
};

export type CopilotModelDefinition = {
  id: string;
  rawModelId?: string;
  displayName?: string;
  aliases?: string[];
  enabled?: boolean;
  backendKind?: CopilotModelBackendKind;
  protocol?: LlmProtocol;
  requestLayer?: LlmBackendConfig['request_layer'];
  routeOverrides?: Partial<Record<ModelOutputType, CopilotModelRouteOverride>>;
  behaviorFlags?: string[];
  limits?: {
    contextWindow?: number;
    maxOutputTokens?: number;
    embeddingDimensions?: number;
  };
  cost?: {
    inputPer1M?: number;
    outputPer1M?: number;
  };
  capabilities: CopilotModelDefinitionCapability[];
  registryRecordSource?: 'db_revision';
  registryRevision?: string;
  registryRevisionActorId?: string;
  registryRevisionFingerprint?: string;
  registryRevisionId?: string;
  registryRevisionScope?: 'global' | 'workspace';
  registryRevisionSourceChain?: CopilotModelRegistrySourceChainEntry[];
  registryRevisionSourceChainFingerprint?: string;
  registryRevisionStatus?: string;
  registryRevisionWorkspaceId?: string;
  registryRevisionPublishEventCount?: number;
  registryRevisionPublishEvents?: RegistryRevisionPublishEventRecord[];
};

export type CopilotProviderProfile = {
  id: string;
  type: CopilotProviderType;
  config: Record<string, unknown>;
  displayName?: string;
  priority?: number;
  enabled?: boolean;
  models?: string[];
  modelDefinitions?: CopilotModelDefinition[];
  privacy?: CopilotProviderPrivacy;
  source?: CopilotProviderProfileSource;
  middleware?: ProviderMiddlewareConfig;
  health?: CopilotProviderHealth;
};
