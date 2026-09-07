import { z } from 'zod';

import {
  defineModuleConfig,
  StorageJSONSchema,
  StorageProviderConfig,
} from '../../base';
import type { RegistryRevisionPublishEventRecord } from '../../models/copilot-registry-revision-publish-event';
import type { LlmBackendConfig, LlmProtocol } from '../../native';
import {
  AnthropicOfficialConfig,
  AnthropicVertexConfig,
} from './providers/anthropic';
import { CloudflareWorkersAIConfig } from './providers/cloudflare';
import type { FalConfig } from './providers/fal';
import { GeminiGenerativeConfig, GeminiVertexConfig } from './providers/gemini';
import { OpenAICompatibleConfig, OpenAIConfig } from './providers/openai';
import {
  type CopilotModelBackendKind,
  CopilotProviderType,
  ModelInputType,
  ModelOutputType,
  type PromptAttachmentKind,
  PromptAttachmentKindSchema,
  type PromptAttachmentSourceKind,
  PromptAttachmentSourceKindSchema,
  type PromptConfig,
  PromptConfigStrictSchema,
  VertexSchema,
} from './providers/types';

export type CopilotProviderConfigMap = {
  [CopilotProviderType.OpenAI]: OpenAIConfig;
  [CopilotProviderType.OpenAICompatible]: OpenAICompatibleConfig;
  [CopilotProviderType.CloudflareWorkersAi]: CloudflareWorkersAIConfig;
  [CopilotProviderType.FAL]: FalConfig;
  [CopilotProviderType.Gemini]: GeminiGenerativeConfig;
  [CopilotProviderType.GeminiVertex]: GeminiVertexConfig;
  [CopilotProviderType.Anthropic]: AnthropicOfficialConfig;
  [CopilotProviderType.AnthropicVertex]: AnthropicVertexConfig;
};

export type ProviderSpecificConfig =
  CopilotProviderConfigMap[keyof CopilotProviderConfigMap];

export const RustRequestMiddlewareValues = [
  'normalize_messages',
  'clamp_max_tokens',
  'tool_schema_rewrite',
  'openai_request_compat',
  'omit_tool_choice',
] as const;
export type RustRequestMiddleware =
  (typeof RustRequestMiddlewareValues)[number];

export const RustStreamMiddlewareValues = [
  'stream_event_normalize',
  'citation_indexing',
] as const;
export type RustStreamMiddleware = (typeof RustStreamMiddlewareValues)[number];

export const NodeTextMiddlewareValues = [
  'citation_footnote',
  'callout',
  'thinking_format',
] as const;
export type NodeTextMiddleware = (typeof NodeTextMiddlewareValues)[number];

export type ProviderMiddlewareConfig = {
  rust?: { request?: RustRequestMiddleware[]; stream?: RustStreamMiddleware[] };
  node?: { text?: NodeTextMiddleware[] };
};

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

export const CopilotProviderRoutePolicyFeatureKindValues = [
  'chat',
  'action',
  'image',
  'embedding',
  'workspace_indexing',
  'rerank',
  'transcript',
] as const;
export type CopilotProviderRoutePolicyFeatureKind =
  (typeof CopilotProviderRoutePolicyFeatureKindValues)[number];

export type CopilotProviderRoutePolicyRule = {
  allowedProviderIds?: string[];
  blockedProviderIds?: string[];
  allowedPrivacy?: CopilotProviderPrivacy[];
  preferredPrivacy?: CopilotProviderPrivacy[];
};

export type CopilotProviderRoutePolicy = CopilotProviderRoutePolicyRule & {
  enabled?: boolean;
  byFeature?: Partial<
    Record<
      CopilotProviderRoutePolicyFeatureKind,
      CopilotProviderRoutePolicyRule
    >
  >;
  byWorkspace?: Record<string, CopilotProviderRoutePolicyRule>;
};

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
] as const;

export const LlmProtocolValues = [
  'openai_chat',
  'openai_responses',
  'openai_images',
  'anthropic',
  'gemini',
  'fal_image',
] as const;

export const LlmRequestLayerValues = [
  'anthropic',
  'chat_completions',
  'cloudflare_workers_ai',
  'responses',
  'openai_images',
  'fal',
  'vertex',
  'vertex_anthropic',
  'gemini_api',
  'gemini_vertex',
] as const;

type CopilotProviderProfileCommon = {
  id: string;
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

type CopilotProviderProfileVariant<T extends CopilotProviderType> = {
  type: T;
  config: CopilotProviderConfigMap[T];
};

export type CopilotProviderProfile = CopilotProviderProfileCommon &
  {
    [Type in CopilotProviderType]: CopilotProviderProfileVariant<Type>;
  }[CopilotProviderType];

export type CopilotProviderDefaults = Partial<
  Record<ModelOutputType, string>
> & {
  fallback?: string;
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

export type CopilotPromptOverride = {
  name: string;
  enabled?: boolean;
  model?: string;
  optionalModels?: string[];
  config?: PromptConfig;
};

export type CopilotPromptModelDefault = {
  enabled?: boolean;
  model?: string;
  optionalModels?: string[];
  proModels?: string[];
  includeNames?: string[];
  excludeNames?: string[];
  includeActions?: string[];
  excludeActions?: string[];
};

export type CopilotPromptDefaults = {
  text?: CopilotPromptModelDefault;
  structured?: CopilotPromptModelDefault;
  image?: CopilotPromptModelDefault;
  transcript?: CopilotPromptModelDefault;
};

export type CopilotTaskModelDefaults = {
  embedding?: string;
  workspaceIndexing?: string;
  rerank?: string;
};

export const CopilotSupportBundleObjectStorageWebhookProviderValues = [
  'aws_s3',
  'cloudflare_r2',
  's3_compatible',
] as const;
export type CopilotSupportBundleObjectStorageWebhookProvider =
  (typeof CopilotSupportBundleObjectStorageWebhookProviderValues)[number];

export const CopilotSupportBundleObjectStorageWebhookSignatureAlgorithmValues =
  ['hmac-sha256'] as const;
export type CopilotSupportBundleObjectStorageWebhookSignatureAlgorithm =
  (typeof CopilotSupportBundleObjectStorageWebhookSignatureAlgorithmValues)[number];

export type CopilotSupportBundleObjectStorageWebhookConfig = {
  id: string;
  provider: CopilotSupportBundleObjectStorageWebhookProvider;
  secret: string;
  verifier?: string;
  policy?: string;
  signatureAlgorithm?: CopilotSupportBundleObjectStorageWebhookSignatureAlgorithm;
};

const CopilotModelRouteOverrideShape = z.object({
  protocol: z.enum(LlmProtocolValues).optional(),
  requestLayer: z.enum(LlmRequestLayerValues).optional(),
});

const CopilotModelCapabilityShape = z.object({
  input: z.array(z.nativeEnum(ModelInputType)).min(1),
  output: z.array(z.nativeEnum(ModelOutputType)).min(1),
  attachments: z
    .object({
      kinds: z.array(PromptAttachmentKindSchema).min(1),
      sourceKinds: z.array(PromptAttachmentSourceKindSchema).optional(),
      allowRemoteUrls: z.boolean().optional(),
    })
    .optional(),
  structuredAttachments: z
    .object({
      kinds: z.array(PromptAttachmentKindSchema).min(1),
      sourceKinds: z.array(PromptAttachmentSourceKindSchema).optional(),
      allowRemoteUrls: z.boolean().optional(),
    })
    .optional(),
  defaultForOutputType: z.boolean().optional(),
});

const CopilotModelDefinitionShape = z.object({
  id: z.string().min(1),
  rawModelId: z.string().min(1).optional(),
  displayName: z.string().optional(),
  aliases: z.array(z.string().min(1)).optional(),
  enabled: z.boolean().optional(),
  backendKind: z.enum(CopilotModelBackendKindValues).optional(),
  protocol: z.enum(LlmProtocolValues).optional(),
  requestLayer: z.enum(LlmRequestLayerValues).optional(),
  routeOverrides: z
    .object({
      [ModelOutputType.Text]: CopilotModelRouteOverrideShape.optional(),
      [ModelOutputType.Object]: CopilotModelRouteOverrideShape.optional(),
      [ModelOutputType.Embedding]: CopilotModelRouteOverrideShape.optional(),
      [ModelOutputType.Image]: CopilotModelRouteOverrideShape.optional(),
      [ModelOutputType.Rerank]: CopilotModelRouteOverrideShape.optional(),
      [ModelOutputType.Structured]: CopilotModelRouteOverrideShape.optional(),
    })
    .optional(),
  behaviorFlags: z.array(z.string().min(1)).optional(),
  limits: z
    .object({
      contextWindow: z.number().int().positive().optional(),
      maxOutputTokens: z.number().int().positive().optional(),
      embeddingDimensions: z.number().int().positive().optional(),
    })
    .optional(),
  cost: z
    .object({
      inputPer1M: z.number().nonnegative().optional(),
      outputPer1M: z.number().nonnegative().optional(),
    })
    .optional(),
  capabilities: z.array(CopilotModelCapabilityShape).min(1),
});

const CopilotProviderPrivacyShape = z.enum(CopilotProviderPrivacyValues);

const CopilotProviderRoutePolicyRuleShape = z.object({
  allowedProviderIds: z.array(z.string().min(1)).optional(),
  blockedProviderIds: z.array(z.string().min(1)).optional(),
  allowedPrivacy: z.array(CopilotProviderPrivacyShape).optional(),
  preferredPrivacy: z.array(CopilotProviderPrivacyShape).optional(),
});

const CopilotProviderRoutePolicyByFeatureShape = z.object(
  Object.fromEntries(
    CopilotProviderRoutePolicyFeatureKindValues.map(featureKind => [
      featureKind,
      CopilotProviderRoutePolicyRuleShape.optional(),
    ])
  )
);

const CopilotProviderRoutePolicyShape =
  CopilotProviderRoutePolicyRuleShape.extend({
    enabled: z.boolean().optional(),
    byFeature: CopilotProviderRoutePolicyByFeatureShape.optional(),
    byWorkspace: z.record(CopilotProviderRoutePolicyRuleShape).optional(),
  });

const CopilotProviderProfileBaseShape = z.object({
  id: z.string().regex(/^[a-zA-Z0-9-_]+$/),
  displayName: z.string().optional(),
  priority: z.number().optional(),
  enabled: z.boolean().optional(),
  source: z.enum(CopilotProviderProfileSourceValues).optional(),
  models: z.array(z.string()).optional(),
  modelDefinitions: z.array(CopilotModelDefinitionShape).optional(),
  privacy: CopilotProviderPrivacyShape.optional(),
  middleware: z
    .object({
      rust: z
        .object({
          request: z.array(z.enum(RustRequestMiddlewareValues)).optional(),
          stream: z.array(z.enum(RustStreamMiddlewareValues)).optional(),
        })
        .optional(),
      node: z
        .object({ text: z.array(z.enum(NodeTextMiddlewareValues)).optional() })
        .optional(),
    })
    .optional(),
  health: z
    .object({
      status: z.enum(CopilotProviderHealthStatusValues),
      lastCheckedAt: z.string().optional(),
      lastError: z.string().optional(),
    })
    .optional(),
});

const OpenAIConfigShape = z.object({
  apiKey: z.string(),
  baseURL: z.string().optional(),
  oldApiStyle: z.boolean().optional(),
});

const OpenAICompatibleConfigShape = z.object({
  apiKey: z.string().optional(),
  baseURL: z.string(),
  headers: z.record(z.string()).optional(),
  apiStyle: z.enum(['chat_completions', 'responses', 'auto']).optional(),
});

const FalConfigShape = z.object({
  apiKey: z.string(),
});

const CloudflareWorkersAIConfigShape = z.object({
  apiToken: z.string(),
  accountId: z.string().optional(),
  baseURL: z.string().optional(),
});

const GeminiGenerativeConfigShape = z.object({
  apiKey: z.string(),
  baseURL: z.string().optional(),
});

const VertexProviderConfigShape = z.object({
  location: z.string().optional(),
  project: z.string().optional(),
  baseURL: z.string().optional(),
  googleAuthOptions: z.any().optional(),
  fetch: z.any().optional(),
});

const AnthropicOfficialConfigShape = z.object({
  apiKey: z.string(),
  baseURL: z.string().optional(),
});

const CopilotProviderProfileShape = z.discriminatedUnion('type', [
  CopilotProviderProfileBaseShape.extend({
    type: z.literal(CopilotProviderType.OpenAI),
    config: OpenAIConfigShape,
  }),
  CopilotProviderProfileBaseShape.extend({
    type: z.literal(CopilotProviderType.OpenAICompatible),
    config: OpenAICompatibleConfigShape,
  }),
  CopilotProviderProfileBaseShape.extend({
    type: z.literal(CopilotProviderType.FAL),
    config: FalConfigShape,
  }),
  CopilotProviderProfileBaseShape.extend({
    type: z.literal(CopilotProviderType.CloudflareWorkersAi),
    config: CloudflareWorkersAIConfigShape,
  }),
  CopilotProviderProfileBaseShape.extend({
    type: z.literal(CopilotProviderType.Gemini),
    config: GeminiGenerativeConfigShape,
  }),
  CopilotProviderProfileBaseShape.extend({
    type: z.literal(CopilotProviderType.GeminiVertex),
    config: VertexProviderConfigShape,
  }),
  CopilotProviderProfileBaseShape.extend({
    type: z.literal(CopilotProviderType.Anthropic),
    config: AnthropicOfficialConfigShape,
  }),
  CopilotProviderProfileBaseShape.extend({
    type: z.literal(CopilotProviderType.AnthropicVertex),
    config: VertexProviderConfigShape,
  }),
]);

const CopilotProviderDefaultsShape = z.object({
  [ModelOutputType.Text]: z.string().optional(),
  [ModelOutputType.Object]: z.string().optional(),
  [ModelOutputType.Embedding]: z.string().optional(),
  [ModelOutputType.Image]: z.string().optional(),
  [ModelOutputType.Rerank]: z.string().optional(),
  [ModelOutputType.Structured]: z.string().optional(),
  fallback: z.string().optional(),
});

const CopilotPromptOverrideShape = z.object({
  name: z.string().min(1),
  enabled: z.boolean().optional(),
  model: z.string().min(1).optional(),
  optionalModels: z.array(z.string().min(1)).optional(),
  config: PromptConfigStrictSchema.nullable().optional(),
});

const CopilotPromptModelDefaultShape = z.object({
  enabled: z.boolean().optional(),
  model: z.string().min(1).optional(),
  optionalModels: z.array(z.string().min(1)).optional(),
  proModels: z.array(z.string().min(1)).optional(),
  includeNames: z.array(z.string().min(1)).optional(),
  excludeNames: z.array(z.string().min(1)).optional(),
  includeActions: z.array(z.string().min(1)).optional(),
  excludeActions: z.array(z.string().min(1)).optional(),
});

const CopilotPromptDefaultsShape = z.object({
  text: CopilotPromptModelDefaultShape.optional(),
  structured: CopilotPromptModelDefaultShape.optional(),
  image: CopilotPromptModelDefaultShape.optional(),
  transcript: CopilotPromptModelDefaultShape.optional(),
});

const CopilotTaskModelDefaultsShape = z.object({
  embedding: z.string().min(1).optional(),
  workspaceIndexing: z.string().min(1).optional(),
  rerank: z.string().min(1).optional(),
});

const CopilotSupportBundleObjectStorageWebhookShape = z
  .object({
    id: z.string().min(1).max(128),
    provider: z.enum(CopilotSupportBundleObjectStorageWebhookProviderValues),
    secret: z.string().min(16).max(4096),
    verifier: z.string().min(1).max(128).optional(),
    policy: z.string().min(1).max(128).optional(),
    signatureAlgorithm: z
      .enum(CopilotSupportBundleObjectStorageWebhookSignatureAlgorithmValues)
      .optional(),
  })
  .strict();

const ExternalMcpEndpointShape = z.string().superRefine((value, context) => {
  try {
    const endpoint = new URL(value);
    if (
      !['http:', 'https:'].includes(endpoint.protocol) ||
      !endpoint.hostname ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      endpoint.pathname !== '/mcp'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'External MCP endpoint must be an exact HTTP(S) /mcp URL',
      });
    }
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'External MCP endpoint must be a valid URL',
    });
  }
});

const EnterpriseCliProviderShape = z.enum(['WECOM', 'LARK', 'DINGTALK']);
const EnterpriseCliToolPolicyNameShape = z
  .string()
  .trim()
  .max(64)
  .refine(
    value => value === '*' || /^[a-z][a-z0-9_]{0,63}$/.test(value),
    'Enterprise CLI tool allowlist entries must be exact tool names or *'
  );
const EnterpriseCliAllowedToolsByProviderShape = z
  .object({
    wecom: z.array(EnterpriseCliToolPolicyNameShape).max(2048),
    lark: z.array(EnterpriseCliToolPolicyNameShape).max(2048),
    dingtalk: z.array(EnterpriseCliToolPolicyNameShape).max(2048),
  })
  .strict();

const McpDelegationCallbackOriginShape = z
  .string()
  .max(2048)
  .superRefine((value, context) => {
    try {
      const origin = new URL(value);
      if (
        !['http:', 'https:'].includes(origin.protocol) ||
        !origin.hostname ||
        origin.username ||
        origin.password ||
        origin.pathname !== '/' ||
        origin.search ||
        origin.hash ||
        origin.origin !== value.replace(/\/$/, '')
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'MCP delegation callback allowlist entries must be exact HTTP(S) origins',
        });
      }
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'MCP delegation callback allowlist entries must be valid origins',
      });
    }
  });

declare global {
  interface AppConfigSchema {
    copilot: {
      enabled: boolean;
      byok: {
        enabled: ConfigItem<boolean>;
        allowedProviders: ConfigItem<
          Array<'openai' | 'anthropic' | 'gemini' | 'fal'>
        >;
        allowCustomEndpoint: ConfigItem<boolean>;
        allowPrivateEndpoint: ConfigItem<boolean>;
      };
      unsplash: ConfigItem<{
        key: string;
      }>;
      exa: ConfigItem<{
        key: string;
      }>;
      storage: ConfigItem<StorageProviderConfig>;
      prompts: {
        defaults: ConfigItem<CopilotPromptDefaults>;
        overrides: ConfigItem<CopilotPromptOverride[]>;
      };
      tasks: {
        models: ConfigItem<CopilotTaskModelDefaults>;
      };
      supportBundles: {
        objectStorageWebhooks: ConfigItem<
          CopilotSupportBundleObjectStorageWebhookConfig[]
        >;
      };
      externalMcp: {
        endpoint: ConfigItem<string>;
      };
      enterpriseCli: {
        enabled: ConfigItem<boolean>;
        allowedProviders: ConfigItem<Array<'WECOM' | 'LARK' | 'DINGTALK'>>;
        allowedToolsByProvider: ConfigItem<{
          wecom: string[];
          lark: string[];
          dingtalk: string[];
        }>;
        rootDir: ConfigItem<string>;
        binaries: {
          wecom: ConfigItem<string>;
          lark: ConfigItem<string>;
          dingtalk: ConfigItem<string>;
        };
      };
      mcpDelegation: {
        callbackAllowedOrigins: ConfigItem<string[]>;
      };
      providers: {
        profiles: ConfigItem<CopilotProviderProfile[]>;
        defaults: ConfigItem<CopilotProviderDefaults>;
        routePolicy: ConfigItem<CopilotProviderRoutePolicy>;
        openai: ConfigItem<OpenAIConfig>;
        openaiCompatible: ConfigItem<OpenAICompatibleConfig>;
        cloudflareWorkersAi: ConfigItem<CloudflareWorkersAIConfig>;
        fal: ConfigItem<FalConfig>;
        gemini: ConfigItem<GeminiGenerativeConfig>;
        geminiVertex: ConfigItem<GeminiVertexConfig>;
        anthropic: ConfigItem<AnthropicOfficialConfig>;
        anthropicVertex: ConfigItem<AnthropicVertexConfig>;
      };
    };
  }
}

defineModuleConfig('copilot', {
  enabled: {
    desc: 'Whether to enable LocalMind AI. <br> Documentation: <a href="https://github.com/Infinimesh-ai/LocalMind/blob/main/docs/localmind-deployment-ai.zh-CN.md" target="_blank">LocalMind AI deployment guide</a>',
    default: true,
  },
  'byok.enabled': {
    desc: 'Allow instance administrators to manage AI provider credentials by workspace through Admin AI.',
    default: true,
    shape: z.boolean(),
  },
  'byok.allowedProviders': {
    desc: 'AI providers that instance administrators may assign to workspaces through Admin AI.',
    default: ['openai', 'anthropic', 'gemini', 'fal'],
    shape: z.array(z.enum(['openai', 'anthropic', 'gemini', 'fal'])),
  },
  'byok.allowCustomEndpoint': {
    desc: 'Allow administrator-managed workspace AI credentials to use a custom provider endpoint.',
    default: false,
    shape: z.boolean(),
  },
  'byok.allowPrivateEndpoint': {
    desc: 'Whether administrator-managed workspace AI custom endpoints may resolve to private network targets. Enable only for trusted provider endpoints.',
    default: false,
    shape: z.boolean(),
  },
  'providers.profiles': {
    desc: 'The profile list for copilot providers.',
    default: [],
    shape: z.array(CopilotProviderProfileShape),
  },
  'providers.defaults': {
    desc: 'The default provider ids for model output types and global fallback.',
    default: {},
    shape: CopilotProviderDefaultsShape,
  },
  'providers.routePolicy': {
    desc: 'Config-driven provider route policy. Supports provider allow/block lists plus cloud/private_cloud/local privacy filters and preferences globally, per feature, or per workspace.',
    default: {},
    shape: CopilotProviderRoutePolicyShape,
  },
  'prompts.overrides': {
    desc: 'Config-driven prompt metadata overrides. Built-in prompt messages remain native fallback unless a later Prompt Registry layer replaces them.',
    default: [],
    shape: z.array(CopilotPromptOverrideShape),
  },
  'prompts.defaults': {
    desc: 'Global prompt model defaults for self-hosted deployments. The text bucket applies to text-like prompts, image/transcript apply to prompt category matches, and structured only applies to explicitly included structured prompts. Prompt overrides remain the more specific policy.',
    default: {},
    shape: CopilotPromptDefaultsShape,
  },
  'tasks.models': {
    desc: 'Optional task model aliases for embedding, workspace indexing, and rerank. Leave empty to let provider defaults and modelDefinitions choose task routes.',
    default: {},
    shape: CopilotTaskModelDefaultsShape,
  },
  'supportBundles.objectStorageWebhooks': {
    desc: 'Production object-storage webhooks for support bundle direct-download completion notifications. Each entry verifies raw webhook bodies with HMAC-SHA256 before forwarding provider event evidence into the durable transfer queue.',
    default: [],
    shape: z.array(CopilotSupportBundleObjectStorageWebhookShape),
  },
  'externalMcp.endpoint': {
    desc: 'The exact server-controlled SparkClaw Streamable HTTP MCP endpoint. Workspace clients can view but cannot change this URL.',
    default: 'http://192.168.20.252:18790/mcp',
    env: 'LOCALMIND_SPARKCLAW_MCP_ENDPOINT',
    shape: ExternalMcpEndpointShape,
  },
  'enterpriseCli.enabled': {
    desc: 'Enable user-scoped enterprise CLI connectors for WeCom, Lark, and DingTalk.',
    default: false,
    env: ['LOCALMIND_ENTERPRISE_CLI_ENABLED', 'boolean'],
    shape: z.boolean(),
  },
  'enterpriseCli.allowedProviders': {
    desc: 'Enterprise CLI providers that users may connect. Instance administrators own this allowlist.',
    default: ['WECOM', 'LARK', 'DINGTALK'],
    shape: z.array(EnterpriseCliProviderShape).max(3),
  },
  'enterpriseCli.allowedToolsByProvider': {
    desc: 'Exact Enterprise CLI tool names that LocalMind AI may use for each provider. Use * only when the instance administrator explicitly accepts the full discovered catalog.',
    default: { wecom: [], lark: [], dingtalk: [] },
    shape: EnterpriseCliAllowedToolsByProviderShape,
  },
  'enterpriseCli.rootDir': {
    desc: 'Server-controlled root directory for isolated enterprise CLI profiles.',
    default: '.localmind/enterprise-cli',
    env: 'LOCALMIND_ENTERPRISE_CLI_ROOT_DIR',
    shape: z.string().trim().min(1).max(2048),
  },
  'enterpriseCli.binaries.wecom': {
    desc: 'Server-controlled WeCom CLI binary path or executable name.',
    default: 'wecom-cli',
    env: 'LOCALMIND_WECOM_CLI_BINARY',
    shape: z.string().trim().min(1).max(2048),
  },
  'enterpriseCli.binaries.lark': {
    desc: 'Server-controlled Lark CLI binary path or executable name.',
    default: 'lark-cli',
    env: 'LOCALMIND_LARK_CLI_BINARY',
    shape: z.string().trim().min(1).max(2048),
  },
  'enterpriseCli.binaries.dingtalk': {
    desc: 'Server-controlled DingTalk Workspace CLI binary path or executable name.',
    default: 'dws',
    env: 'LOCALMIND_DINGTALK_CLI_BINARY',
    shape: z.string().trim().min(1).max(2048),
  },
  'mcpDelegation.callbackAllowedOrigins': {
    desc: 'Exact callback origins that may use HTTP or private network targets for LocalMind MCP delegation events. Keep empty unless a trusted local caller such as SparkClaw requires it.',
    default: [],
    shape: z.array(McpDelegationCallbackOriginShape).max(32),
  },
  'providers.openai': {
    desc: 'The config for the openai provider.',
    default: {
      apiKey: '',
      baseURL: 'https://api.openai.com/v1',
    },
    link: 'https://github.com/openai/openai-node',
  },
  'providers.openaiCompatible': {
    desc: 'The config for OpenAI-compatible endpoints such as OpenRouter, DeepSeek, Ollama, LM Studio, vLLM and LocalAI.',
    default: {
      apiKey: '',
      baseURL: '',
      apiStyle: 'chat_completions',
    },
    shape: OpenAICompatibleConfigShape,
  },
  'providers.cloudflareWorkersAi': {
    desc: 'The config for the Cloudflare Workers AI provider.',
    default: {
      apiToken: '',
      accountId: '',
    },
  },
  'providers.fal': {
    desc: 'The config for the fal provider.',
    default: {
      apiKey: '',
    },
  },
  'providers.gemini': {
    desc: 'The config for the gemini provider.',
    default: {
      apiKey: '',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    },
  },
  'providers.geminiVertex': {
    desc: 'The config for the gemini provider in Google Vertex AI.',
    default: {},
    schema: VertexSchema,
  },
  'providers.anthropic': {
    desc: 'The config for the anthropic provider.',
    default: {
      apiKey: '',
      baseURL: 'https://api.anthropic.com/v1',
    },
  },
  'providers.anthropicVertex': {
    desc: 'The config for the anthropic provider in Google Vertex AI.',
    default: {},
    schema: VertexSchema,
  },
  unsplash: {
    desc: 'The config for the unsplash key.',
    default: {
      key: '',
    },
  },
  exa: {
    desc: 'The config for the exa web search key.',
    default: {
      key: '',
    },
  },
  storage: {
    desc: 'The config for the storage provider.',
    default: {
      provider: 'fs',
      bucket: 'copilot',
      config: {
        path: '~/.affine/storage',
      },
    },
    schema: StorageJSONSchema,
  },
});
