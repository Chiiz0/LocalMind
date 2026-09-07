import { Badge } from '@affine/admin/components/ui/badge';
import { Button } from '@affine/admin/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@affine/admin/components/ui/card';
import { Input } from '@affine/admin/components/ui/input';
import { ScrollArea } from '@affine/admin/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@affine/admin/components/ui/select';
import { Skeleton } from '@affine/admin/components/ui/skeleton';
import { Switch } from '@affine/admin/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@affine/admin/components/ui/table';
import { Textarea } from '@affine/admin/components/ui/textarea';
import { useMutation } from '@affine/admin/use-mutation';
import { useQuery } from '@affine/admin/use-query';
import { cn } from '@affine/admin/utils';
import {
  type AIModel,
  type AIModelPreparedTaskRoute,
  type AIModelTaskRoute,
  type AIModelTaskRouteCandidateTraceRow,
  type AIModelTaskRouteDiagnosticsSummary,
  type AIModelTaskRoutePhaseTraceRow,
  type AIModelTaskRoutePolicyCandidate,
  type AIModelTaskRoutePolicyCandidateTraceRow,
  type AIModelTaskRouteReadinessStatus,
  type AIModelTaskRouteReasonRemediationActionKind,
  type AIModelTaskRouteReasonSeverity,
  buildAIModels,
  formatAIModelCapabilityLabel,
  formatAIModelCostLabel,
  formatAIModelDefinitionLabel,
  formatAIModelDiagnosticsLabel,
  formatAIModelFallbackLabel,
  formatAIModelLimitsLabel,
  formatAIModelPromptDisplayName,
  formatAIModelPromptSourcesLabel,
  formatAIModelProviderLabel,
  formatAIModelProviderProfileLabel,
  formatAIModelRouteLabel,
  formatAIModelSourcesLabel,
  formatAIModelTaskModelSourceLabel,
  getAIModelPromptDefaultDiagnostics,
  getAIModelTaskRouteRemediationTarget,
  getAIModelTaskRoutesDiagnostics,
} from '@affine/core/modules/ai-button/services/models';
import {
  appConfigQuery,
  authorizeCopilotSupportBundleDownloadMutation,
  cleanupCopilotSupportBundleRetentionMutation,
  controlCopilotAgentRuntimeRunMutation,
  controlCopilotRepairExecutionMutation,
  createCopilotSupportBundleMutation,
  decideCopilotRepairExecutionApprovalMutation,
  getCopilotActionRunPreparedRouteTraceQuery,
  getCopilotActionRunsQuery,
  getCopilotAgentRunsQuery,
  getCopilotPromptRegistryPublishGateQuery,
  getCopilotPromptRegistryRepairPreflightQuery,
  getCopilotPromptsQuery,
  getCopilotProviderHealthProbeAttemptsQuery,
  getCopilotRepairExecutionsQuery,
  getCopilotSupportBundlesQuery,
  getPromptModelsQuery,
  getWorkspacesQuery,
  type QueryResponse,
  replayCopilotSupportBundleTransferForwardingEventMutation,
  requestCopilotPromptRegistryRepairExecutionMutation,
  retryCopilotProviderHealthProbeAttemptMutation,
  updateAppConfigMutation,
} from '@affine/graphql';
import { AlertCircleIcon, CheckCircle2Icon, RefreshCwIcon } from 'lucide-react';
import {
  type FormEvent,
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

import { Header } from '../header';
import { ProjectByokAdmin } from './project-byok';
import { WorkspaceByokAdmin } from './workspace-byok';

const ADMIN_AI_DEFAULT_PROMPT_NAME = 'Chat With LocalMind AI';
const ADMIN_AI_DEFAULT_PROMPT_DISPLAY_NAME = formatAIModelPromptDisplayName(
  ADMIN_AI_DEFAULT_PROMPT_NAME
);

function resolvePromptNameInput(value: string) {
  return value.trim() === ADMIN_AI_DEFAULT_PROMPT_DISPLAY_NAME
    ? ADMIN_AI_DEFAULT_PROMPT_NAME
    : value;
}

const PROMPT_CATALOG_ALL_CATEGORIES = '__all__';
const WORKSPACE_SCOPE_GLOBAL = '__global__';
const WORKSPACE_SCOPE_MANUAL = '__manual__';
const PROVIDER_HEALTH_PROBE_ATTEMPT_ALL_STATUSES = '__all__';
const PROVIDER_HEALTH_PROBE_ATTEMPT_STATUSES = [
  'queued',
  'processing',
  'retry_scheduled',
  'completed',
  'dead_lettered',
] as const;
const SUPPORT_BUNDLE_FORWARDING_ALL_STATUSES = '__all__';
const SUPPORT_BUNDLE_FORWARDING_STATUSES = [
  'queued',
  'processing',
  'retry_scheduled',
  'forwarded',
  'dead_lettered',
] as const;
const AGENT_RUN_ALL_STATUSES = '__all__';
const AGENT_RUN_STATUSES = [
  'queued',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'cancelled',
] as const;
const REPAIR_EXECUTION_ALL_STATUSES = '__all__';
const REPAIR_EXECUTION_STATUSES = [
  'queued',
  'waiting_approval',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;
const EMPTY_REPAIR_EXECUTION_PAYLOAD_JSON = '{\n  "kind": ""\n}';
const OPENAI_COMPATIBLE_API_STYLES = [
  'chat_completions',
  'responses',
  'auto',
] as const;
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_COMPATIBLE_API_STYLE = 'chat_completions';
const DEFAULT_GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const ENTERPRISE_CLI_PROVIDERS = [
  {
    id: 'WECOM',
    label: 'WeCom',
    toolsKey: 'enterpriseCliWecomAllowedTools',
  },
  {
    id: 'LARK',
    label: 'Lark',
    toolsKey: 'enterpriseCliLarkAllowedTools',
  },
  {
    id: 'DINGTALK',
    label: 'DingTalk',
    toolsKey: 'enterpriseCliDingTalkAllowedTools',
  },
] as const;
const AI_RUNTIME_PATH = '/admin/ai/runtime';
const AI_CONFIG_PATH = '/admin/ai';

type JsonConfigDraftKey =
  | 'providerProfilesJson'
  | 'providerDefaultsJson'
  | 'routePolicyJson'
  | 'promptDefaultsJson'
  | 'promptOverridesJson'
  | 'supportBundleWebhooksJson'
  | 'storageJson'
  | 'openaiCompatibleHeadersJson'
  | 'geminiVertexJson'
  | 'anthropicVertexJson';

type AppConfigData = {
  copilot?: {
    enabled?: boolean;
    byok?: {
      allowedProviders?: string[];
      allowCustomEndpoint?: boolean;
      allowPrivateEndpoint?: boolean;
      enabled?: boolean;
    };
    enterpriseCli?: {
      allowedProviders?: string[];
      allowedToolsByProvider?: {
        dingtalk?: string[];
        lark?: string[];
        wecom?: string[];
      };
      enabled?: boolean;
    };
    exa?: {
      key?: string;
    };
    prompts?: {
      defaults?: unknown;
      overrides?: unknown;
    };
    providers?: {
      anthropic?: {
        apiKey?: string;
        baseURL?: string;
      };
      anthropicVertex?: unknown;
      cloudflareWorkersAi?: {
        accountId?: string;
        apiToken?: string;
        baseURL?: string;
      };
      defaults?: unknown;
      fal?: {
        apiKey?: string;
      };
      gemini?: {
        apiKey?: string;
        baseURL?: string;
      };
      geminiVertex?: unknown;
      openai?: {
        apiKey?: string;
        baseURL?: string;
        oldApiStyle?: boolean;
      };
      openaiCompatible?: {
        apiKey?: string;
        apiStyle?: (typeof OPENAI_COMPATIBLE_API_STYLES)[number];
        baseURL?: string;
        headers?: unknown;
      };
      profiles?: unknown;
      routePolicy?: unknown;
    };
    storage?: unknown;
    supportBundles?: {
      objectStorageWebhooks?: unknown;
    };
    tasks?: {
      models?: {
        embedding?: string;
        rerank?: string;
        workspaceIndexing?: string;
      };
    };
    unsplash?: {
      key?: string;
    };
  };
};

type AiConfigDraft = {
  anthropicApiKey: string;
  anthropicBaseURL: string;
  anthropicVertexJson: string;
  byokAllowCustomEndpoint: boolean;
  byokAllowPrivateEndpoint: boolean;
  byokAllowedProviders: string;
  byokEnabled: boolean;
  cloudflareWorkersAiAccountId: string;
  cloudflareWorkersAiApiToken: string;
  cloudflareWorkersAiBaseURL: string;
  enabled: boolean;
  enterpriseCliAllowedProviders: string;
  enterpriseCliDingTalkAllowedTools: string;
  enterpriseCliEnabled: boolean;
  enterpriseCliLarkAllowedTools: string;
  enterpriseCliWecomAllowedTools: string;
  exaKey: string;
  falApiKey: string;
  geminiApiKey: string;
  geminiBaseURL: string;
  geminiVertexJson: string;
  openaiApiKey: string;
  openaiBaseURL: string;
  openaiCompatibleHeadersJson: string;
  openaiCompatibleApiKey: string;
  openaiCompatibleApiStyle: (typeof OPENAI_COMPATIBLE_API_STYLES)[number];
  openaiCompatibleBaseURL: string;
  openaiOldApiStyle: boolean;
  promptDefaultsJson: string;
  promptOverridesJson: string;
  providerDefaultsJson: string;
  providerProfilesJson: string;
  routePolicyJson: string;
  storageJson: string;
  supportBundleWebhooksJson: string;
  taskEmbeddingModel: string;
  taskRerankModel: string;
  taskWorkspaceIndexingModel: string;
  unsplashKey: string;
};

function normalizeOpenAICompatibleApiStyle(
  value: unknown
): AiConfigDraft['openaiCompatibleApiStyle'] {
  return OPENAI_COMPATIBLE_API_STYLES.includes(
    value as AiConfigDraft['openaiCompatibleApiStyle']
  )
    ? (value as AiConfigDraft['openaiCompatibleApiStyle'])
    : DEFAULT_OPENAI_COMPATIBLE_API_STYLE;
}

function formatJsonConfig(value: unknown, fallback: unknown) {
  return JSON.stringify(value ?? fallback, null, 2);
}

function parseJsonConfig(
  draft: AiConfigDraft,
  key: JsonConfigDraftKey,
  label: string
): { label: string; value: unknown } | { error: string; label: string } {
  try {
    return {
      label,
      value: JSON.parse(draft[key]),
    };
  } catch {
    return {
      error: `${label} JSON is invalid.`,
      label,
    };
  }
}

function getParsedJsonConfigValue(
  result: { label: string; value: unknown } | { error: string; label: string }
) {
  return 'value' in result ? result.value : undefined;
}

function parseCsvList(value: string) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function buildAiConfigDraft(
  appConfig: AppConfigData | undefined
): AiConfigDraft {
  const copilot = appConfig?.copilot;
  const providers = appConfig?.copilot?.providers;
  const openai = providers?.openai;
  const openaiCompatible = providers?.openaiCompatible;
  const tasks = copilot?.tasks?.models;

  return {
    anthropicApiKey: providers?.anthropic?.apiKey ?? '',
    anthropicBaseURL:
      providers?.anthropic?.baseURL ?? DEFAULT_ANTHROPIC_BASE_URL,
    anthropicVertexJson: formatJsonConfig(providers?.anthropicVertex, {}),
    byokAllowCustomEndpoint: copilot?.byok?.allowCustomEndpoint ?? false,
    byokAllowPrivateEndpoint: copilot?.byok?.allowPrivateEndpoint ?? false,
    byokAllowedProviders: (
      copilot?.byok?.allowedProviders ?? [
        'openai',
        'anthropic',
        'gemini',
        'fal',
      ]
    ).join(', '),
    byokEnabled: copilot?.byok?.enabled !== false,
    cloudflareWorkersAiAccountId:
      providers?.cloudflareWorkersAi?.accountId ?? '',
    cloudflareWorkersAiApiToken: providers?.cloudflareWorkersAi?.apiToken ?? '',
    cloudflareWorkersAiBaseURL: providers?.cloudflareWorkersAi?.baseURL ?? '',
    enabled: appConfig?.copilot?.enabled !== false,
    enterpriseCliAllowedProviders: (
      copilot?.enterpriseCli?.allowedProviders ?? ['WECOM', 'LARK', 'DINGTALK']
    ).join(', '),
    enterpriseCliDingTalkAllowedTools: (
      copilot?.enterpriseCli?.allowedToolsByProvider?.dingtalk ?? []
    ).join(', '),
    enterpriseCliEnabled: copilot?.enterpriseCli?.enabled === true,
    enterpriseCliLarkAllowedTools: (
      copilot?.enterpriseCli?.allowedToolsByProvider?.lark ?? []
    ).join(', '),
    enterpriseCliWecomAllowedTools: (
      copilot?.enterpriseCli?.allowedToolsByProvider?.wecom ?? []
    ).join(', '),
    exaKey: copilot?.exa?.key ?? '',
    falApiKey: providers?.fal?.apiKey ?? '',
    geminiApiKey: providers?.gemini?.apiKey ?? '',
    geminiBaseURL: providers?.gemini?.baseURL ?? DEFAULT_GEMINI_BASE_URL,
    geminiVertexJson: formatJsonConfig(providers?.geminiVertex, {}),
    openaiApiKey: openai?.apiKey ?? '',
    openaiBaseURL: openai?.baseURL ?? DEFAULT_OPENAI_BASE_URL,
    openaiCompatibleApiKey: openaiCompatible?.apiKey ?? '',
    openaiCompatibleHeadersJson: formatJsonConfig(
      openaiCompatible?.headers,
      {}
    ),
    openaiCompatibleApiStyle: normalizeOpenAICompatibleApiStyle(
      openaiCompatible?.apiStyle
    ),
    openaiCompatibleBaseURL: openaiCompatible?.baseURL ?? '',
    openaiOldApiStyle: openai?.oldApiStyle ?? false,
    promptDefaultsJson: formatJsonConfig(copilot?.prompts?.defaults, {}),
    promptOverridesJson: formatJsonConfig(copilot?.prompts?.overrides, []),
    providerDefaultsJson: formatJsonConfig(providers?.defaults, {}),
    providerProfilesJson: formatJsonConfig(providers?.profiles, []),
    routePolicyJson: formatJsonConfig(providers?.routePolicy, {}),
    storageJson: formatJsonConfig(copilot?.storage, {
      provider: 'fs',
      bucket: 'copilot',
      config: {
        path: '~/.affine/storage',
      },
    }),
    supportBundleWebhooksJson: formatJsonConfig(
      copilot?.supportBundles?.objectStorageWebhooks,
      []
    ),
    taskEmbeddingModel: tasks?.embedding ?? '',
    taskRerankModel: tasks?.rerank ?? '',
    taskWorkspaceIndexingModel: tasks?.workspaceIndexing ?? '',
    unsplashKey: copilot?.unsplash?.key ?? '',
  };
}

function trimOptionalSecret(value: string) {
  return value.trim();
}

function isSameAiConfigDraft(left: AiConfigDraft, right: AiConfigDraft) {
  return JSON.stringify(left) === JSON.stringify(right);
}

type PromptCatalogItem = NonNullable<
  NonNullable<
    QueryResponse<typeof getCopilotPromptsQuery>['currentUser']
  >['copilot']
>['prompts'][number];
type PromptRegistryPublishGateVerdict = NonNullable<
  NonNullable<
    NonNullable<
      QueryResponse<
        typeof getCopilotPromptRegistryPublishGateQuery
      >['currentUser']
    >['copilot']
  >['promptRegistryPublishGate']
>;
type PromptRegistryPublishGateModelRoute =
  PromptRegistryPublishGateVerdict['modelRoutes'][number];
type PromptRegistryPublishGateRouteCandidate =
  PromptRegistryPublishGateModelRoute['routeCandidates'][number];
type PromptRegistryPublishGatePolicyCandidate =
  PromptRegistryPublishGateModelRoute['policyCandidates'][number];
type PromptRegistryPublishGateRouteTracePhase =
  PromptRegistryPublishGateModelRoute['routeTrace'][number];
type PromptRegistryPublishGateTaskRoute =
  PromptRegistryPublishGateVerdict['taskRoutes'][number];
type PromptRegistryRepairPreflight = NonNullable<
  NonNullable<
    NonNullable<
      QueryResponse<
        typeof getCopilotPromptRegistryRepairPreflightQuery
      >['currentUser']
    >['copilot']
  >['promptRegistryRepairPreflight']
>;
type PromptRegistryRepairExecutionRequest = NonNullable<
  QueryResponse<
    typeof requestCopilotPromptRegistryRepairExecutionMutation
  >['requestCopilotPromptRegistryRepairExecution']
>;
type SupportBundleRequest = NonNullable<
  NonNullable<
    NonNullable<
      QueryResponse<typeof getCopilotSupportBundlesQuery>['currentUser']
    >['copilot']
  >['supportBundles']
>[number];
type SupportBundleAuditEvent = SupportBundleRequest['auditEvents'][number];
type SupportBundleTransferEvent =
  SupportBundleRequest['transferEvents'][number];
type SupportBundleTransferForwardingEvent =
  SupportBundleRequest['transferForwardingEvents'][number];
type SupportBundleDownloadAuthorization = NonNullable<
  QueryResponse<
    typeof authorizeCopilotSupportBundleDownloadMutation
  >['authorizeCopilotSupportBundleDownload']
>;
type SupportBundleRetentionCleanup = NonNullable<
  QueryResponse<
    typeof cleanupCopilotSupportBundleRetentionMutation
  >['cleanupCopilotSupportBundleRetention']
>;
type SupportBundleTransferForwardingReplayRecord = NonNullable<
  QueryResponse<
    typeof replayCopilotSupportBundleTransferForwardingEventMutation
  >['replayCopilotSupportBundleTransferForwardingEvent']
>;
type SupportBundleForwardingStatusFilter =
  | typeof SUPPORT_BUNDLE_FORWARDING_ALL_STATUSES
  | (typeof SUPPORT_BUNDLE_FORWARDING_STATUSES)[number];
type AgentRunRecord = NonNullable<
  NonNullable<
    NonNullable<
      QueryResponse<typeof getCopilotAgentRunsQuery>['currentUser']
    >['copilot']
  >['agentRuns']
>[number];
type AgentRuntimeWorkflowAdapter = NonNullable<
  NonNullable<
    NonNullable<
      QueryResponse<typeof getCopilotAgentRunsQuery>['currentUser']
    >['copilot']
  >['agentRuntimeWorkflowAdapters']
>[number];
type RepairExecutionRecord = NonNullable<
  NonNullable<
    NonNullable<
      QueryResponse<typeof getCopilotRepairExecutionsQuery>['currentUser']
    >['copilot']
  >['repairExecutions']
>[number];
type PromptRegistryPublishGateActionRouteDryRun = NonNullable<
  PromptRegistryPublishGateVerdict['actionRouteDryRun']
>;
type PromptRegistryPublishGateExpectedVersion = {
  registryFingerprint?: string;
  registryId?: number;
  registryUpdatedAt?: string;
};
type PromptRegistryRepairSubmissionContract =
  PromptRegistryPublishGateVerdict['repairActionPreview']['submissionContract'];
type PromptRegistryValidationSourceLocatorLike = {
  field: string;
  messageIndex?: number | null;
  path: string;
  registryFingerprint: string;
  registryId: number;
  registryUpdatedAt: string;
  table: string;
};
type PromptRegistryValidationIssueLike = {
  code: string;
  detail: string;
  fieldLabel: string;
  message?: string | null;
  messageIndex?: number | null;
  path: string;
  publishBlocking: boolean;
  reason: string;
  severity: string;
  source: string;
  sourceLocator: PromptRegistryValidationSourceLocatorLike;
};
type PromptRegistryValidationRemediationLike = {
  detail: string;
  kind: string;
  label: string;
  target: string;
  targetLocator: PromptRegistryValidationSourceLocatorLike;
};
type PromptRegistryPublishGateRepairTargetLocatorLike = NonNullable<
  PromptRegistryPublishGateVerdict['repairRecommendations'][number]['targetLocator']
>;
type WorkspaceScopeItem = QueryResponse<
  typeof getWorkspacesQuery
>['workspaces'][number];
type ActionRunPreparedRouteTrace = NonNullable<
  NonNullable<
    NonNullable<
      QueryResponse<
        typeof getCopilotActionRunPreparedRouteTraceQuery
      >['currentUser']
    >['copilot']
  >['actionRunPreparedRouteTrace']
>;
type ActionRunDiagnosticsItem = NonNullable<
  NonNullable<
    QueryResponse<typeof getCopilotActionRunsQuery>['currentUser']
  >['copilot']
>['actionRuns'][number];
type ProviderHealthProbeAttempt = NonNullable<
  NonNullable<
    QueryResponse<
      typeof getCopilotProviderHealthProbeAttemptsQuery
    >['currentUser']
  >['copilot']
>['providerHealthProbeAttempts'][number];
type ProviderHealthProbeAttemptRetryRecord = QueryResponse<
  typeof retryCopilotProviderHealthProbeAttemptMutation
>['retryCopilotProviderHealthProbeAttempt'];
type ProviderHealthProbeAttemptStatusFilter =
  | typeof PROVIDER_HEALTH_PROBE_ATTEMPT_ALL_STATUSES
  | (typeof PROVIDER_HEALTH_PROBE_ATTEMPT_STATUSES)[number];

const EMPTY_PROMPT_CATALOG: PromptCatalogItem[] = [];
const EMPTY_WORKSPACE_SCOPES: WorkspaceScopeItem[] = [];
const EMPTY_ACTION_RUNS: ActionRunDiagnosticsItem[] = [];
const EMPTY_SUPPORT_BUNDLES: SupportBundleRequest[] = [];
const EMPTY_AGENT_RUNS: AgentRunRecord[] = [];
const EMPTY_AGENT_RUNTIME_WORKFLOW_ADAPTERS: AgentRuntimeWorkflowAdapter[] = [];
const EMPTY_REPAIR_EXECUTIONS: RepairExecutionRecord[] = [];
const EMPTY_PROVIDER_HEALTH_PROBE_ATTEMPTS: ProviderHealthProbeAttempt[] = [];

type RepairExecutionApprovalDecisionRecord = QueryResponse<
  typeof decideCopilotRepairExecutionApprovalMutation
>['decideCopilotRepairExecutionApproval'];
type RepairExecutionControlRecord = QueryResponse<
  typeof controlCopilotRepairExecutionMutation
>['controlCopilotRepairExecution'];
type RepairExecutionAuditEvent = NonNullable<
  PromptRegistryRepairExecutionRequest['executionRecord']
>['auditEvents'][number];
type AgentRuntimeControlRecord = QueryResponse<
  typeof controlCopilotAgentRuntimeRunMutation
>['controlCopilotAgentRuntimeRun'];
type AgentRunStatusFilter =
  | typeof AGENT_RUN_ALL_STATUSES
  | (typeof AGENT_RUN_STATUSES)[number];
type RepairExecutionStatusFilter =
  | typeof REPAIR_EXECUTION_ALL_STATUSES
  | (typeof REPAIR_EXECUTION_STATUSES)[number];

const STATUS_LABELS: Record<AIModelTaskRouteReadinessStatus, string> = {
  blocked: 'Blocked',
  ready: 'Ready',
  unconfigured: 'Unconfigured',
  warning: 'Warning',
};

const FEATURE_LABELS: Record<string, string> = {
  config_fallback: 'Config fallback',
  db_revision: 'DB revision',
  legacy_registry: 'Legacy registry',
  rerank: 'Rerank',
  unknown: 'Unknown',
  workspace_indexing: 'Workspace indexing',
};

const STATUS_STYLES: Record<AIModelTaskRouteReadinessStatus, string> = {
  blocked: 'border-destructive/30 bg-destructive/10 text-destructive',
  ready: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  unconfigured: 'border-border bg-muted text-muted-foreground',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
};

const SEVERITY_STYLES: Record<AIModelTaskRouteReasonSeverity, string> = {
  error: 'text-destructive',
  info: 'text-muted-foreground',
  warning: 'text-amber-700',
};

const POLICY_CANDIDATE_STATUS_STYLES = {
  allowed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  blocked: 'border-destructive/30 bg-destructive/10 text-destructive',
  unavailable: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
} satisfies Record<string, string>;

const PROVIDER_PRIVACY_LABELS: Record<string, string> = {
  cloud: 'Cloud',
  local: 'Local',
  private_cloud: 'Private cloud',
};

const PROVIDER_HEALTH_LABELS: Record<string, string> = {
  degraded: 'Degraded',
  down: 'Down',
  healthy: 'Healthy',
  unknown: 'Unknown',
};

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  anthropicVertex: 'Anthropic Vertex',
  cloudflareWorkersAi: 'Cloudflare Workers AI',
  fal: 'FAL',
  gemini: 'Gemini',
  geminiVertex: 'Gemini Vertex',
  openai: 'OpenAI',
  openaiCompatible: 'OpenAI-compatible',
};

const PROVIDER_SOURCE_LABELS: Record<string, string> = {
  byok_local: 'BYOK local',
  byok_server: 'BYOK server',
  byok_project_global: 'Project BYOK global',
  configured: 'Configured',
  legacy: 'Legacy config',
};

function formatFeatureKind(featureKind: string) {
  return (
    FEATURE_LABELS[featureKind] ??
    featureKind
      .split('_')
      .filter(Boolean)
      .map(part => part[0].toUpperCase() + part.slice(1))
      .join(' ')
  );
}

function formatProviderMetadata(value: string, labels: Record<string, string>) {
  return labels[value] ?? formatFeatureKind(value);
}

function formatProviderIdentity(
  row:
    | AIModelTaskRoutePolicyCandidate
    | AIModelTaskRoutePolicyCandidateTraceRow
    | AIModelTaskRouteCandidateTraceRow
    | PromptRegistryPublishGatePolicyCandidate
    | PromptRegistryPublishGateRouteCandidate
) {
  return row.providerName && row.providerName !== row.providerId
    ? `${row.providerName} / ${row.providerId}`
    : row.providerId;
}

function formatActionKind(kind: AIModelTaskRouteReasonRemediationActionKind) {
  return kind
    .split('_')
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function compactList(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(' / ');
}

function TableViewport({
  children,
  className,
  minWidth = 'min-w-[760px]',
}: {
  children: ReactNode;
  className?: string;
  minWidth?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-md border border-border/70',
        className
      )}
    >
      <div className={minWidth}>{children}</div>
    </div>
  );
}

function buildPromptCatalogVersionEvidence(prompt: PromptCatalogItem) {
  const evidence = prompt.versionEvidence;

  return compactList([
    `revision ${evidence.revision}`,
    `fingerprint ${evidence.fingerprint}`,
    `model ${evidence.modelStrategyFingerprint}`,
    `template ${evidence.templateFingerprint}`,
    evidence.defaultPolicy
      ? `policy ${formatFeatureKind(evidence.defaultPolicy)}`
      : 'policy none',
    evidence.overrideApplied ? 'override yes' : 'override no',
    evidence.modelConfigPath
      ? `model config ${evidence.modelConfigPath}`
      : null,
    evidence.optionalModelsConfigPath
      ? `optional config ${evidence.optionalModelsConfigPath}`
      : null,
    evidence.proModelsConfigPath
      ? `pro config ${evidence.proModelsConfigPath}`
      : null,
    evidence.registryFingerprint
      ? `registry fingerprint ${evidence.registryFingerprint}`
      : null,
    evidence.registryId != null ? `registry id ${evidence.registryId}` : null,
    evidence.registryMessageCount != null
      ? `registry messages ${evidence.registryMessageCount}`
      : null,
    evidence.registryModified != null
      ? `registry modified ${evidence.registryModified ? 'yes' : 'no'}`
      : null,
    evidence.registryUpdatedAt
      ? `registry updated ${evidence.registryUpdatedAt}`
      : null,
    evidence.registryValidationStatus
      ? `registry status ${formatFeatureKind(evidence.registryValidationStatus)}`
      : null,
    evidence.registryValidationReason
      ? `registry reason ${formatFeatureKind(evidence.registryValidationReason)}`
      : null,
    evidence.registryValidationDetail
      ? `registry detail ${evidence.registryValidationDetail}`
      : null,
    evidence.registryValidationPublishStatus
      ? `registry publish ${formatFeatureKind(evidence.registryValidationPublishStatus)}`
      : null,
    evidence.registryValidationBlockingCount != null
      ? `registry blocking ${evidence.registryValidationBlockingCount}`
      : null,
    evidence.registryValidationIssueCount != null
      ? `registry issues ${evidence.registryValidationIssueCount}`
      : null,
    evidence.registryValidationErrorCount != null
      ? `registry errors ${evidence.registryValidationErrorCount}`
      : null,
    ...(evidence.registryValidationIssues ?? []).map(
      issue => `registry issue ${formatPromptRegistryValidationIssue(issue)}`
    ),
    ...(evidence.registryValidationRemediations ?? []).map(
      remediation =>
        `registry remediation ${formatPromptRegistryValidationRemediation(remediation)}`
    ),
    evidence.registryRecordSource
      ? `registry source ${formatFeatureKind(evidence.registryRecordSource)}`
      : null,
    evidence.registryRevision
      ? `registry revision ${evidence.registryRevision}`
      : null,
    evidence.registryRevisionId
      ? `registry revision id ${evidence.registryRevisionId}`
      : null,
    evidence.registryRevisionScope
      ? `registry revision scope ${formatFeatureKind(evidence.registryRevisionScope)}`
      : null,
    evidence.registryRevisionWorkspaceId
      ? `registry revision workspace ${evidence.registryRevisionWorkspaceId}`
      : null,
    evidence.registryRevisionActorId
      ? `registry revision actor ${evidence.registryRevisionActorId}`
      : null,
    evidence.registryRevisionFingerprint
      ? `registry revision fingerprint ${evidence.registryRevisionFingerprint}`
      : null,
    evidence.registryRevisionStatus
      ? `registry revision status ${formatFeatureKind(evidence.registryRevisionStatus)}`
      : null,
    evidence.registrySourceChainFingerprint
      ? `registry source chain fingerprint ${evidence.registrySourceChainFingerprint}`
      : null,
    ...(evidence.registrySourceChain ?? []).map(
      entry => `registry source chain ${formatPromptRegistrySourceChain(entry)}`
    ),
  ]);
}

function buildPromptRegistryPublishGateExpectedVersion(
  prompt: PromptCatalogItem
): PromptRegistryPublishGateExpectedVersion | undefined {
  const registryFingerprint =
    prompt.versionEvidence.registryFingerprint ??
    prompt.registryFingerprint ??
    prompt.registryValidationIssues?.[0]?.sourceLocator.registryFingerprint ??
    prompt.registryValidationRemediations?.[0]?.targetLocator
      .registryFingerprint;

  if (prompt.registryId == null || !prompt.registryUpdatedAt) {
    return undefined;
  }

  return {
    ...(registryFingerprint ? { registryFingerprint } : {}),
    registryId: prompt.registryId,
    registryUpdatedAt: prompt.registryUpdatedAt,
  };
}

function buildPromptRegistryRepairSubmissionInput(
  submissionContract: PromptRegistryRepairSubmissionContract
) {
  return {
    approvalPolicyFingerprint: submissionContract.approvalPolicyFingerprint,
    authorizationFingerprint: submissionContract.authorizationFingerprint,
    candidateEvidenceSetFingerprint:
      submissionContract.candidateEvidenceSetFingerprint,
    taskRouteEffectiveSourceEvidenceSetFingerprint:
      submissionContract.taskRouteEffectiveSourceEvidenceSetFingerprint,
    embeddingIndexContractEvidenceSetFingerprint:
      submissionContract.embeddingIndexContractEvidenceSetFingerprint,
    rerankRuntimeContractEvidenceSetFingerprint:
      submissionContract.rerankRuntimeContractEvidenceSetFingerprint,
    preparedRouteOrderEvidenceSetFingerprint:
      submissionContract.preparedRouteOrderEvidenceSetFingerprint,
    catalogFingerprint: submissionContract.catalogFingerprint,
    contractVersion: submissionContract.contractVersion,
    expectedRegistryFingerprint: submissionContract.expectedRegistryFingerprint,
    expectedRegistryId: submissionContract.expectedRegistryId,
    expectedRegistryUpdatedAt: submissionContract.expectedRegistryUpdatedAt,
    guardFingerprint: submissionContract.guardFingerprint,
    idempotencyKey: submissionContract.idempotencyKey,
    operationSetFingerprint: submissionContract.operationSetFingerprint,
    previewFingerprint: submissionContract.previewFingerprint,
    requiredInputs: submissionContract.requiredInputs,
    submissionFingerprint: submissionContract.submissionFingerprint,
    targetLocatorFingerprint: submissionContract.targetLocatorFingerprint,
  };
}

function buildPromptRegistryRepairExecutionRequestInput({
  expectedVersion,
  promptName,
  repairPreflight,
  verdict,
  submissionContract,
  workspaceId,
}: {
  expectedVersion: PromptRegistryPublishGateExpectedVersion | undefined;
  promptName: string;
  repairPreflight: PromptRegistryRepairPreflight;
  verdict: PromptRegistryPublishGateVerdict;
  submissionContract: PromptRegistryRepairSubmissionContract;
  workspaceId: string | undefined;
}) {
  return {
    expectedApprovalRecordFingerprint:
      repairPreflight.approvalRecordFingerprint,
    expectedApprovalRequestFingerprint:
      repairPreflight.approvalRequestFingerprint,
    expectedAuditEventFingerprint: repairPreflight.auditEventFingerprint,
    expectedCandidateEvidenceSetFingerprint:
      repairPreflight.candidateEvidenceSetFingerprint,
    expectedTaskRouteEffectiveSourceEvidenceSetFingerprint:
      repairPreflight.taskRouteEffectiveSourceEvidenceSetFingerprint,
    expectedEmbeddingIndexContractEvidenceSetFingerprint:
      repairPreflight.embeddingIndexContractEvidenceSetFingerprint,
    expectedRerankRuntimeContractEvidenceSetFingerprint:
      repairPreflight.rerankRuntimeContractEvidenceSetFingerprint,
    expectedPreparedRouteOrderEvidenceSetFingerprint:
      repairPreflight.preparedRouteOrderEvidenceSetFingerprint,
    expectedTargetLocatorFingerprint: repairPreflight.targetLocatorFingerprint,
    expectedRepairGateManifestFingerprint:
      verdict.repairGateManifest.fingerprint,
    expectedRepairGateManifestExportPolicyFingerprint:
      verdict.repairGateManifestExportMetadata.exportPolicyFingerprint,
    expectedRepairGateManifestRetentionPolicyFingerprint:
      verdict.repairGateManifestExportMetadata.retentionPolicyFingerprint,
    expectedExecutionGateFingerprint: repairPreflight.executionGateFingerprint,
    expectedExecutionGateStatus: repairPreflight.executionGateStatus,
    expectedExecutionStateFingerprint:
      repairPreflight.executionStateFingerprint,
    expectedIdempotencyFingerprint: repairPreflight.idempotencyFingerprint,
    expectedPolicyBindingFingerprint: repairPreflight.policyBindingFingerprint,
    expectedPreflightStatus: repairPreflight.status,
    expectedRepairJobFingerprint: repairPreflight.repairJobFingerprint,
    expectedReviewBindingFingerprint: repairPreflight.reviewBindingFingerprint,
    expectedRollbackPlanFingerprint: repairPreflight.rollbackPlanFingerprint,
    expectedVersion,
    name: promptName,
    submission: buildPromptRegistryRepairSubmissionInput(submissionContract),
    workspaceId: workspaceId ?? '',
  };
}

function formatPromptRegistryValidationIssue(
  issue: PromptRegistryValidationIssueLike
) {
  return compactList([
    issue.severity,
    issue.reason,
    issue.fieldLabel,
    issue.path,
    issue.code,
    issue.source,
    formatPromptRegistryValidationSourceLocator(issue.sourceLocator),
    issue.messageIndex != null ? `message ${issue.messageIndex}` : null,
    issue.publishBlocking ? 'blocking yes' : 'blocking no',
    issue.detail,
  ]);
}

function formatPromptRegistryValidationSourceLocator(
  locator: PromptRegistryValidationSourceLocatorLike
) {
  return compactList([
    `registry ${locator.registryId}`,
    `fingerprint ${locator.registryFingerprint}`,
    `updated ${locator.registryUpdatedAt}`,
    locator.table,
    locator.field,
    locator.path,
  ]);
}

function formatPromptRegistryValidationRemediation(
  remediation: PromptRegistryValidationRemediationLike
) {
  return compactList([
    remediation.kind,
    remediation.label,
    remediation.target,
    formatPromptRegistryValidationSourceLocator(remediation.targetLocator),
    remediation.detail,
  ]);
}

function formatPromptRegistrySourceChain(
  entry: NonNullable<PromptCatalogItem['registrySourceChain']>[number]
) {
  return compactList([
    entry.source,
    `scope ${entry.scope}`,
    `status ${entry.status}`,
    entry.revision ? `revision ${entry.revision}` : null,
    entry.fingerprint ? `fingerprint ${entry.fingerprint}` : null,
    entry.registryId != null ? `registry ${entry.registryId}` : null,
    entry.workspaceId ? `workspace ${entry.workspaceId}` : null,
    entry.actorId ? `actor ${entry.actorId}` : null,
    entry.configPath ? `config ${entry.configPath}` : null,
    entry.updatedAt ? `updated ${entry.updatedAt}` : null,
  ]);
}

function formatRegistryRevisionPublishEvent(
  event:
    | NonNullable<PromptCatalogItem['registryRevisionPublishEvents']>[number]
    | NonNullable<AIModel['modelRegistryRevisionPublishEvents']>[number]
    | NonNullable<
        AIModelTaskRoute['taskRoutePolicyRevisionPublishEvents']
      >[number]
) {
  return compactList([
    formatFeatureKind(event.eventType),
    event.publishSource,
    `fingerprint ${event.eventFingerprint}`,
    event.actorId ? `actor ${event.actorId}` : null,
    `created ${formatActionRunTimestamp(event.createdAt)}`,
  ]);
}

function matchesPromptCatalogSearch(prompt: PromptCatalogItem, search: string) {
  if (!search) {
    return true;
  }

  return [
    prompt.action,
    prompt.category,
    prompt.defaultPolicy,
    prompt.fingerprint,
    buildPromptCatalogVersionEvidence(prompt),
    prompt.model,
    prompt.modelConfigPath,
    prompt.modelSource,
    prompt.modelStrategyFingerprint,
    prompt.name,
    formatAIModelPromptDisplayName(prompt.name),
    prompt.optionalModelsConfigPath,
    prompt.optionalModelsSource,
    prompt.proModelsConfigPath,
    prompt.proModelsSource,
    prompt.registryFingerprint,
    prompt.registryFingerprint
      ? `registry fingerprint ${prompt.registryFingerprint}`
      : null,
    prompt.versionEvidence.registryFingerprint,
    prompt.versionEvidence.registryFingerprint
      ? `registry fingerprint ${prompt.versionEvidence.registryFingerprint}`
      : null,
    prompt.registryId?.toString(),
    prompt.registryMessageCount?.toString(),
    prompt.registryModified == null
      ? null
      : prompt.registryModified
        ? 'registry modified yes'
        : 'registry modified no',
    prompt.registryUpdatedAt,
    prompt.registryValidationDetail,
    prompt.registryValidationPublishStatus,
    prompt.registryValidationPublishStatus
      ? `registry publish ${formatFeatureKind(prompt.registryValidationPublishStatus)}`
      : null,
    prompt.registryValidationBlockingCount?.toString(),
    prompt.registryValidationBlockingCount != null
      ? `registry blocking ${prompt.registryValidationBlockingCount}`
      : null,
    prompt.registryValidationIssueCount?.toString(),
    prompt.registryValidationIssueCount != null
      ? `registry issues ${prompt.registryValidationIssueCount}`
      : null,
    prompt.registryValidationErrorCount?.toString(),
    prompt.registryValidationErrorCount != null
      ? `registry errors ${prompt.registryValidationErrorCount}`
      : null,
    ...(prompt.registryValidationIssues ?? []).flatMap(issue => [
      issue.path,
      issue.fieldLabel,
      issue.code,
      issue.message ?? null,
      issue.messageIndex?.toString(),
      issue.publishBlocking ? 'blocking yes' : 'blocking no',
      issue.reason,
      issue.severity,
      issue.source,
      issue.sourceLocator.table,
      issue.sourceLocator.field,
      issue.sourceLocator.path,
      issue.sourceLocator.registryId.toString(),
      `registry ${issue.sourceLocator.registryId}`,
      issue.sourceLocator.registryFingerprint,
      `fingerprint ${issue.sourceLocator.registryFingerprint}`,
      issue.sourceLocator.registryUpdatedAt,
      `updated ${issue.sourceLocator.registryUpdatedAt}`,
      issue.sourceLocator.messageIndex?.toString(),
      formatPromptRegistryValidationSourceLocator(issue.sourceLocator),
      issue.detail,
      formatPromptRegistryValidationIssue(issue),
    ]),
    ...(prompt.registryValidationRemediations ?? []).flatMap(remediation => [
      remediation.kind,
      remediation.label,
      remediation.target,
      remediation.targetLocator.table,
      remediation.targetLocator.field,
      remediation.targetLocator.path,
      remediation.targetLocator.registryId.toString(),
      `registry ${remediation.targetLocator.registryId}`,
      remediation.targetLocator.registryFingerprint,
      `fingerprint ${remediation.targetLocator.registryFingerprint}`,
      remediation.targetLocator.registryUpdatedAt,
      `updated ${remediation.targetLocator.registryUpdatedAt}`,
      remediation.targetLocator.messageIndex?.toString(),
      formatPromptRegistryValidationSourceLocator(remediation.targetLocator),
      remediation.detail,
      formatPromptRegistryValidationRemediation(remediation),
    ]),
    prompt.registryValidationReason,
    prompt.registryValidationStatus,
    prompt.registryRecordSource,
    prompt.registryRecordSource
      ? `registry source ${formatFeatureKind(prompt.registryRecordSource)}`
      : null,
    prompt.registryRevision,
    prompt.registryRevision
      ? `registry revision ${prompt.registryRevision}`
      : null,
    prompt.registryRevisionActorId,
    prompt.registryRevisionFingerprint,
    prompt.registryRevisionId,
    prompt.registryRevisionPublishEventCount?.toString(),
    prompt.registryRevisionPublishEventCount != null
      ? `registry publish events ${prompt.registryRevisionPublishEventCount}`
      : null,
    ...(prompt.registryRevisionPublishEvents ?? []).flatMap(event => [
      event.eventType,
      event.publishSource,
      event.eventFingerprint,
      event.actorId ?? null,
      event.createdAt,
      formatRegistryRevisionPublishEvent(event),
    ]),
    prompt.registryRevisionScope,
    prompt.registryRevisionStatus,
    prompt.registryRevisionWorkspaceId,
    prompt.registrySourceChainFingerprint,
    prompt.registrySourceChainFingerprint
      ? `registry source chain fingerprint ${prompt.registrySourceChainFingerprint}`
      : null,
    ...(prompt.registrySourceChain ?? []).flatMap(entry => [
      entry.source,
      entry.scope,
      entry.status,
      entry.revision ?? null,
      entry.fingerprint ?? null,
      entry.registryId?.toString(),
      entry.workspaceId ?? null,
      entry.actorId ?? null,
      entry.configPath ?? null,
      entry.updatedAt ?? null,
      formatPromptRegistrySourceChain(entry),
    ]),
    prompt.revision,
    prompt.source,
    prompt.templateFingerprint,
    ...prompt.optionalModels,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLocaleLowerCase()
    .includes(search);
}

function formatWorkspaceScopeLabel(workspace: WorkspaceScopeItem) {
  return compactList([
    workspace.id,
    workspace.team ? 'Team' : 'Personal',
    workspace.initialized ? 'Initialized' : 'Not initialized',
    workspace.enableAi ? 'AI enabled' : 'AI disabled',
    workspace.enableDocEmbedding ? 'Embedding enabled' : 'Embedding disabled',
  ]);
}

function usePromptCatalogData(workspaceId: string | undefined) {
  const { data } = useQuery({
    query: getCopilotPromptsQuery,
    variables: {
      workspaceId,
    },
  });
  return data;
}

function useWorkspaceScopeData() {
  const { data } = useQuery({
    query: getWorkspacesQuery,
  });
  return data;
}

function StatusBadge({ status }: { status: AIModelTaskRouteReadinessStatus }) {
  return (
    <Badge
      className={cn('border text-xs', STATUS_STYLES[status])}
      variant="outline"
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function SeverityText({
  severity,
  children,
}: {
  severity: AIModelTaskRouteReasonSeverity;
  children: ReactNode;
}) {
  return <span className={cn(SEVERITY_STYLES[severity])}>{children}</span>;
}

function RecommendedChecks({
  actions,
}: {
  actions: AIModelTaskRouteReasonRemediationActionKind[];
}) {
  if (!actions.length) {
    return <span className="text-muted-foreground">No action required</span>;
  }

  return (
    <div className="grid gap-2">
      {actions.map(action => {
        const target = getAIModelTaskRouteRemediationTarget(action);

        return (
          <div
            key={action}
            className="grid min-w-0 grid-cols-1 gap-3 rounded-md border border-border/70 bg-muted/20 p-3 md:grid-cols-[minmax(180px,240px)_minmax(160px,220px)_minmax(0,1fr)]"
          >
            <div className="min-w-0 space-y-1">
              <div className="text-[11px] font-medium uppercase text-muted-foreground">
                Action
              </div>
              <Badge
                variant="outline"
                className="h-auto max-w-full justify-start whitespace-normal break-words text-left font-normal leading-5"
              >
                {formatActionKind(action)}
              </Badge>
            </div>
            <div className="min-w-0 space-y-1">
              <div className="text-[11px] font-medium uppercase text-muted-foreground">
                Target
              </div>
              <Badge
                variant="outline"
                className="h-auto max-w-full justify-start whitespace-normal break-words border-border/70 bg-muted/40 text-left font-normal leading-5"
                title={target.description}
              >
                {target.label}
              </Badge>
            </div>
            <div className="min-w-0 space-y-1">
              <div className="text-[11px] font-medium uppercase text-muted-foreground">
                Details
              </div>
              <div className="break-words text-xs leading-5 text-muted-foreground">
                {target.description}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function ReasonSummary({
  route,
}: {
  route: AIModelTaskRouteDiagnosticsSummary;
}) {
  if (!route.reasonSummary.reasons.length) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium">Route reasons</div>
        <EmptyState>No route reason diagnostics returned.</EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Route reasons</div>
      <div className="flex flex-wrap gap-2">
        {route.reasonSummary.reasons.map(reason => (
          <Badge
            key={reason.code}
            variant="outline"
            className={cn('font-normal', SEVERITY_STYLES[reason.severity])}
            title={reason.description}
          >
            {reason.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function PolicyValueBadges({
  formatValue = formatFeatureKind,
  values,
}: {
  formatValue?: (value: string) => string;
  values: string[];
}) {
  if (!values.length) {
    return <span className="text-muted-foreground">Any</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map(value => (
        <Badge key={value} variant="outline" className="font-normal">
          {formatValue(value)}
        </Badge>
      ))}
    </div>
  );
}

function RoutePolicySummary({
  route,
}: {
  route: AIModelTaskRouteDiagnosticsSummary;
}) {
  const { policy } = route;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-medium">Route policy</div>
        <Badge variant="outline" className="font-normal">
          {policy.enabled == null
            ? 'Unknown'
            : policy.enabled
              ? 'Enabled'
              : 'Disabled'}
        </Badge>
        <Badge variant="outline" className="font-normal">
          {formatFeatureKind(policy.featureKind)}
        </Badge>
        <Badge variant="outline" className="font-normal">
          {policy.workspaceId ? `Workspace ${policy.workspaceId}` : 'Global'}
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        <div>
          <div className="text-xs text-muted-foreground">Allowed privacy</div>
          <div className="mt-1">
            <PolicyValueBadges values={policy.allowedPrivacy} />
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Preferred privacy</div>
          <div className="mt-1">
            <PolicyValueBadges values={policy.preferredPrivacy} />
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Allowed providers</div>
          <div className="mt-1">
            <PolicyValueBadges
              values={policy.allowedProviderIds}
              formatValue={value => value}
            />
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Blocked providers</div>
          <div className="mt-1">
            <PolicyValueBadges
              values={policy.blockedProviderIds}
              formatValue={value => value}
            />
          </div>
        </div>
      </div>
      {policy.label ? (
        <div className="break-words text-xs text-muted-foreground">
          {policy.label}
        </div>
      ) : null}
    </div>
  );
}

function PreparedRoutesSummary({
  routes,
}: {
  routes: AIModelPreparedTaskRoute[];
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Prepared routes</div>
      {routes.length ? (
        <TableViewport>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Runtime metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((route, index) => {
                const providerProfileLabel = formatAIModelProviderProfileLabel({
                  providerConfiguredModelCount:
                    route.providerConfiguredModelCount,
                  providerConfiguredModelIds: route.providerConfiguredModelIds,
                  providerProfileConfigPath: route.providerProfileConfigPath,
                  providerProfileId: route.providerProfileId,
                  providerProfileSource: route.providerProfileSource,
                });

                return (
                  <TableRow
                    key={`${route.providerId}:${route.modelId}:${index}`}
                  >
                    <TableCell className="break-words">
                      <div className="font-medium">{route.providerId}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {compactList([
                          route.providerType
                            ? formatProviderMetadata(
                                route.providerType,
                                PROVIDER_TYPE_LABELS
                              )
                            : null,
                          route.providerSource
                            ? formatProviderMetadata(
                                route.providerSource,
                                PROVIDER_SOURCE_LABELS
                              )
                            : null,
                          route.providerPriority != null
                            ? `Priority ${route.providerPriority}`
                            : null,
                        ]) || 'Provider metadata unavailable'}
                      </div>
                      {providerProfileLabel ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {providerProfileLabel}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="break-words font-medium">
                      {route.modelId}
                    </TableCell>
                    <TableCell className="break-words text-muted-foreground">
                      {compactList([
                        route.routeIndex != null
                          ? `Route #${route.routeIndex + 1}`
                          : null,
                        route.fallbackOrderIndex != null
                          ? `Fallback #${route.fallbackOrderIndex + 1}`
                          : null,
                        route.protocol ? `Protocol ${route.protocol}` : null,
                        route.requestLayer
                          ? `Layer ${route.requestLayer}`
                          : null,
                        route.modelBackendKind
                          ? `Backend ${route.modelBackendKind}`
                          : null,
                        route.canonicalModelKey
                          ? `Canonical ${route.canonicalModelKey}`
                          : null,
                        route.behaviorFlags?.length
                          ? `Flags ${route.behaviorFlags.join(', ')}`
                          : null,
                        route.requestedDimensions != null
                          ? `Requested ${route.requestedDimensions}d`
                          : null,
                        route.modelEmbeddingDimensions != null
                          ? `Model ${route.modelEmbeddingDimensions}d`
                          : null,
                        route.dimensionMismatch ? 'Dimension mismatch' : null,
                      ]) || 'No runtime metadata'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableViewport>
      ) : (
        <EmptyState>No prepared routes returned.</EmptyState>
      )}
    </div>
  );
}

function formatReasonSummaryText(
  summary: AIModelTaskRouteDiagnosticsSummary['reasonSummary']
) {
  return summary.reasons.length
    ? summary.reasons
        .map(reason => `${reason.label} (${reason.severity})`)
        .join(', ')
    : 'none';
}

function formatRoutePolicyText(
  policy: AIModelTaskRouteDiagnosticsSummary['policy']
) {
  return compactList([
    `Policy ${
      policy.enabled == null
        ? 'Unknown'
        : policy.enabled
          ? 'Enabled'
          : 'Disabled'
    }`,
    `Feature ${formatFeatureKind(policy.featureKind)}`,
    policy.workspaceId ? `Workspace ${policy.workspaceId}` : 'Workspace Global',
    policy.allowedPrivacy.length
      ? `Allowed privacy ${policy.allowedPrivacy
          .map(value => formatProviderMetadata(value, PROVIDER_PRIVACY_LABELS))
          .join(', ')}`
      : 'Allowed privacy Any',
    policy.preferredPrivacy.length
      ? `Preferred privacy ${policy.preferredPrivacy
          .map(value => formatProviderMetadata(value, PROVIDER_PRIVACY_LABELS))
          .join(', ')}`
      : 'Preferred privacy Any',
    policy.allowedProviderIds.length
      ? `Allowed providers ${policy.allowedProviderIds.join(', ')}`
      : 'Allowed providers Any',
    policy.blockedProviderIds.length
      ? `Blocked providers ${policy.blockedProviderIds.join(', ')}`
      : 'Blocked providers None',
  ]);
}

function formatDimensionEvidenceLabel(
  route: {
    dimensionMismatch?: boolean | null;
    modelEmbeddingDimensions?: number | null;
    requestedDimensions?: number | null;
  },
  options: { includeNegativeMismatch?: boolean } = {}
) {
  return compactList([
    route.requestedDimensions != null
      ? `requested ${route.requestedDimensions}d`
      : null,
    route.modelEmbeddingDimensions != null
      ? `model ${route.modelEmbeddingDimensions}d`
      : null,
    route.dimensionMismatch || options.includeNegativeMismatch
      ? `dimension mismatch ${route.dimensionMismatch ? 'yes' : 'no'}`
      : null,
  ]);
}

function formatTaskRoutePreparedRouteText(route: AIModelPreparedTaskRoute) {
  const providerProfileLabel = formatAIModelProviderProfileLabel({
    providerConfiguredModelCount: route.providerConfiguredModelCount,
    providerConfiguredModelIds: route.providerConfiguredModelIds,
    providerProfileConfigPath: route.providerProfileConfigPath,
    providerProfileId: route.providerProfileId,
    providerProfileSource: route.providerProfileSource,
  });

  return compactList([
    `${route.providerId}/${route.modelId}`,
    route.routeIndex != null ? `route #${route.routeIndex + 1}` : null,
    route.fallbackOrderIndex != null
      ? `fallback #${route.fallbackOrderIndex + 1}`
      : null,
    route.protocol ? `protocol ${route.protocol}` : null,
    route.requestLayer ? `layer ${route.requestLayer}` : null,
    route.modelBackendKind ? `backend ${route.modelBackendKind}` : null,
    route.canonicalModelKey ? `canonical ${route.canonicalModelKey}` : null,
    route.behaviorFlags?.length
      ? `flags ${route.behaviorFlags.join(', ')}`
      : null,
    route.providerType
      ? `type ${formatProviderMetadata(route.providerType, PROVIDER_TYPE_LABELS)}`
      : null,
    route.providerSource
      ? `source ${formatProviderMetadata(
          route.providerSource,
          PROVIDER_SOURCE_LABELS
        )}`
      : null,
    route.providerPriority != null
      ? `priority ${route.providerPriority}`
      : null,
    providerProfileLabel ? `profile ${providerProfileLabel}` : null,
    formatDimensionEvidenceLabel(route).replace(
      'dimension mismatch yes',
      'dimension mismatch'
    ),
  ]);
}

function formatTaskRouteDiagnosticsErrorText(error: {
  code: string;
  message: string;
  stage: string;
}) {
  return compactList([
    `stage ${formatFeatureKind(error.stage)}`,
    `code ${formatFeatureKind(error.code)}`,
    error.message ? `message ${error.message}` : null,
  ]);
}

function formatTaskRoutePolicySourceChainEntry(
  entry: NonNullable<
    AIModelTaskRoute['taskRoutePolicyRevisionSourceChain']
  >[number]
) {
  return compactList([
    formatFeatureKind(entry.source),
    formatFeatureKind(entry.scope),
    formatFeatureKind(entry.status),
    entry.featureKind
      ? `feature ${formatFeatureKind(entry.featureKind)}`
      : null,
    entry.modelId ? `model ${entry.modelId}` : null,
    entry.configKey ? `config key ${entry.configKey}` : null,
    entry.configPath ? `config ${entry.configPath}` : null,
    entry.revision ? `revision ${entry.revision}` : null,
    entry.fingerprint ? `fingerprint ${entry.fingerprint}` : null,
    entry.workspaceId ? `workspace ${entry.workspaceId}` : null,
    entry.actorId ? `actor ${entry.actorId}` : null,
    entry.updatedAt ? `updated ${entry.updatedAt}` : null,
  ]);
}

function formatTaskRoutePolicyCandidateText(
  row: AIModelTaskRoutePolicyCandidateTraceRow
) {
  const providerProfileLabel = formatAIModelProviderProfileLabel({
    providerConfiguredModelCount: row.providerConfiguredModelCount,
    providerConfiguredModelIds: row.providerConfiguredModelIds,
    providerProfileConfigPath: row.providerProfileConfigPath,
    providerProfileId: row.providerProfileId,
    providerProfileSource: row.providerProfileSource,
  });

  return compactList([
    row.candidateFingerprint ? `fingerprint ${row.candidateFingerprint}` : null,
    row.candidateKey,
    formatProviderIdentity(row),
    row.providerType
      ? `type ${formatProviderMetadata(row.providerType, PROVIDER_TYPE_LABELS)}`
      : null,
    row.providerSource
      ? `source ${formatProviderMetadata(
          row.providerSource,
          PROVIDER_SOURCE_LABELS
        )}`
      : null,
    row.providerPriority != null ? `priority ${row.providerPriority}` : null,
    formatProviderMetadata(row.privacy, PROVIDER_PRIVACY_LABELS),
    formatProviderMetadata(row.health, PROVIDER_HEALTH_LABELS),
    row.healthCheckedAt ? `checked ${row.healthCheckedAt}` : null,
    providerProfileLabel ? `profile ${providerProfileLabel}` : null,
    `status ${formatFeatureKind(row.status)}`,
    `reasons ${formatReasonSummaryText(row.reasonSummary)}`,
  ]);
}

function formatPromptRegistryPublishGatePolicyCandidate(
  row: AIModelTaskRoutePolicyCandidate
) {
  const providerProfileLabel = formatAIModelProviderProfileLabel({
    providerConfiguredModelCount: row.providerConfiguredModelCount,
    providerConfiguredModelIds: row.providerConfiguredModelIds,
    providerProfileConfigPath: row.providerProfileConfigPath,
    providerProfileId: row.providerProfileId,
    providerProfileSource: row.providerProfileSource,
  });

  return compactList([
    formatProviderIdentity(row),
    row.providerType
      ? `type ${formatProviderMetadata(row.providerType, PROVIDER_TYPE_LABELS)}`
      : null,
    row.providerSource
      ? `source ${formatProviderMetadata(
          row.providerSource,
          PROVIDER_SOURCE_LABELS
        )}`
      : null,
    row.providerPriority != null ? `priority ${row.providerPriority}` : null,
    `privacy ${formatProviderMetadata(row.privacy, PROVIDER_PRIVACY_LABELS)}`,
    `health ${formatProviderMetadata(row.health, PROVIDER_HEALTH_LABELS)}`,
    row.healthCheckedAt ? `checked ${row.healthCheckedAt}` : null,
    providerProfileLabel ? `profile ${providerProfileLabel}` : null,
    `available ${row.available ? 'yes' : 'no'}`,
    `allowed ${row.allowed ? 'yes' : 'no'}`,
    row.reasons.length
      ? `reasons ${row.reasons.map(formatFeatureKind).join(', ')}`
      : 'reasons none',
  ]);
}

function formatTaskRoutePhaseText(row: AIModelTaskRoutePhaseTraceRow) {
  return compactList([
    row.phase,
    `candidates ${row.candidateCount}`,
    row.availableCount != null ? `available ${row.availableCount}` : null,
    row.blockedCount != null ? `blocked ${row.blockedCount}` : null,
    row.matchedCount != null ? `matched ${row.matchedCount}` : null,
    row.selectedCount != null ? `selected ${row.selectedCount}` : null,
    row.preparedCount != null ? `prepared ${row.preparedCount}` : null,
    `severity ${row.severity}`,
    `reasons ${formatReasonSummaryText(row.reasonSummary)}`,
  ]);
}

function formatPromptRegistryPublishGateRoutePhaseText(
  row: PromptRegistryPublishGateRouteTracePhase
) {
  return compactList([
    row.phase,
    `candidates ${row.candidateCount}`,
    row.availableCount != null ? `available ${row.availableCount}` : null,
    row.blockedCount != null ? `blocked ${row.blockedCount}` : null,
    row.matchedCount != null ? `matched ${row.matchedCount}` : null,
    row.selectedCount != null ? `selected ${row.selectedCount}` : null,
    row.preparedCount != null ? `prepared ${row.preparedCount}` : null,
    row.reasons.length
      ? `reasons ${row.reasons.map(formatFeatureKind).join(', ')}`
      : 'reasons none',
  ]);
}

function formatTaskRouteCandidateText(row: AIModelTaskRouteCandidateTraceRow) {
  const providerProfileLabel = formatAIModelProviderProfileLabel(row);
  const modelDefinitionLabel = formatAIModelDefinitionLabel({
    routeBackendKind: null,
    routeBehaviorFlags: null,
    routeCanonicalModelKey: null,
    routeModelAliasMatched: row.routeModelAliasMatched,
    routeModelDefinitionAliases: row.routeModelDefinitionAliases,
    routeModelDefinitionId: row.routeModelDefinitionId,
    routeModelDefinitionSource: row.routeModelDefinitionSource,
    modelRegistryRevision: row.modelRegistryRevision,
    modelRegistryRevisionFingerprint: row.modelRegistryRevisionFingerprint,
    modelRegistryRevisionId: row.modelRegistryRevisionId,
    modelRegistryRevisionScope: row.modelRegistryRevisionScope,
    modelRegistryRevisionSourceChainFingerprint:
      row.modelRegistryRevisionSourceChainFingerprint,
    modelRegistryRevisionStatus: row.modelRegistryRevisionStatus,
    modelRegistryRevisionWorkspaceId: row.modelRegistryRevisionWorkspaceId,
    routeProtocol: null,
    routeRawModelId: row.routeRawModelId,
    routeRequestLayer: null,
  });
  const capabilityLabel = compactList([
    row.routeInputTypes?.length
      ? `input ${row.routeInputTypes.join(', ')}`
      : null,
    row.routeOutputTypes?.length
      ? `output ${row.routeOutputTypes.join(', ')}`
      : null,
    row.routeAttachmentKinds?.length
      ? `attachments ${row.routeAttachmentKinds.join(', ')}`
      : null,
    row.routeAttachmentSourceKinds?.length
      ? `attachment sources ${row.routeAttachmentSourceKinds.join(', ')}`
      : null,
    row.routeAttachmentAllowRemoteUrls != null
      ? `remote attachments ${row.routeAttachmentAllowRemoteUrls ? 'yes' : 'no'}`
      : null,
    row.routeStructuredAttachmentKinds?.length
      ? `structured attachments ${row.routeStructuredAttachmentKinds.join(', ')}`
      : null,
    row.routeStructuredAttachmentSourceKinds?.length
      ? `structured attachment sources ${row.routeStructuredAttachmentSourceKinds.join(', ')}`
      : null,
    row.routeStructuredAttachmentAllowRemoteUrls != null
      ? `structured remote attachments ${row.routeStructuredAttachmentAllowRemoteUrls ? 'yes' : 'no'}`
      : null,
  ]);
  const limitLabel = compactList([
    row.routeContextWindow != null ? `context ${row.routeContextWindow}` : null,
    row.routeMaxOutputTokens != null
      ? `output ${row.routeMaxOutputTokens}`
      : null,
    row.routeEmbeddingDimensions != null
      ? `embedding ${row.routeEmbeddingDimensions}`
      : null,
  ]);

  return compactList([
    row.candidateKey ?? null,
    formatProviderIdentity(row),
    row.modelId ? `model ${row.modelId}` : null,
    row.preparedModelId ? `prepared ${row.preparedModelId}` : null,
    row.requestedModelId ? `requested ${row.requestedModelId}` : null,
    row.providerType
      ? `type ${formatProviderMetadata(row.providerType, PROVIDER_TYPE_LABELS)}`
      : null,
    row.providerSource
      ? `source ${formatProviderMetadata(
          row.providerSource,
          PROVIDER_SOURCE_LABELS
        )}`
      : null,
    row.providerPriority != null ? `priority ${row.providerPriority}` : null,
    row.privacy
      ? `privacy ${formatProviderMetadata(row.privacy, PROVIDER_PRIVACY_LABELS)}`
      : null,
    row.health
      ? `health ${formatProviderMetadata(row.health, PROVIDER_HEALTH_LABELS)}`
      : null,
    row.healthCheckedAt ? `checked ${row.healthCheckedAt}` : null,
    providerProfileLabel ? `profile ${providerProfileLabel}` : null,
    modelDefinitionLabel ? `definition ${modelDefinitionLabel}` : null,
    capabilityLabel ? `capability ${capabilityLabel}` : null,
    limitLabel ? `limits ${limitLabel}` : null,
    row.candidateModelIds?.length
      ? `profile models ${row.candidateModelIds.join(', ')}`
      : null,
    row.registryKind ? `registry ${row.registryKind}` : null,
    row.registrySelected ? 'registry selected' : null,
    row.registryAvailable === false ? 'registry unavailable' : null,
    row.errorCode ? `code ${row.errorCode}` : null,
    row.errorCategory
      ? `category ${formatFeatureKind(row.errorCategory)}`
      : null,
    `status ${formatFeatureKind(row.status)}`,
    `severity ${row.severity}`,
    `reasons ${formatReasonSummaryText(row.reasonSummary)}`,
  ]);
}

function formatTaskRouteCandidateModelPublishEventLines(
  row: AIModelTaskRouteCandidateTraceRow
) {
  const events = row.modelRegistryRevisionPublishEvents ?? [];
  const candidateIdentity = compactList([row.providerId, row.modelId]);

  return [
    row.modelRegistryRevisionPublishEventCount != null
      ? `Candidate model registry revision publish events ${candidateIdentity || 'unknown'} ${row.modelRegistryRevisionPublishEventCount}`
      : null,
    ...events.map(
      event =>
        `Candidate model registry revision publish event ${candidateIdentity || 'unknown'} ${formatRegistryRevisionPublishEvent(event)}`
    ),
  ];
}

function formatPromptRegistryPublishGateTaskRoute(route: {
  diagnostics: AIModelTaskRouteDiagnosticsSummary;
  raw: PromptRegistryPublishGateTaskRoute;
}) {
  const { readiness } = route.diagnostics;
  const requestedModelSource =
    readiness.requestedModelSource ?? route.raw.requestedModelSource;
  const requestedModelConfigPath =
    readiness.requestedModelConfigPath ?? route.raw.requestedModelConfigPath;
  const preparedRouteTargets = route.raw.preparedRouteTargets ?? [];
  const preparedRouteTargetFingerprint =
    route.raw.preparedRouteTargetFingerprint;
  const providerProfileLabel = formatAIModelProviderProfileLabel({
    providerConfiguredModelCount: route.raw.providerConfiguredModelCount,
    providerConfiguredModelIds: route.raw.providerConfiguredModelIds,
    providerProfileConfigPath: route.raw.providerProfileConfigPath,
    providerProfileId: route.raw.providerProfileId,
    providerProfileSource: route.raw.providerProfileSource,
  });
  return compactList([
    formatFeatureKind(readiness.featureKind),
    `status ${STATUS_LABELS[readiness.status]}`,
    `configured ${readiness.configured ? 'yes' : 'no'}`,
    readiness.providerId ? `provider ${readiness.providerId}` : null,
    readiness.modelId ? `model ${readiness.modelId}` : null,
    providerProfileLabel ? `profile ${providerProfileLabel}` : null,
    (readiness.requestedModelId ?? route.raw.requestedModelId)
      ? `requested ${readiness.requestedModelId ?? route.raw.requestedModelId}`
      : null,
    requestedModelSource
      ? `source ${formatAIModelTaskModelSourceLabel(requestedModelSource)}`
      : null,
    requestedModelConfigPath ? `config ${requestedModelConfigPath}` : null,
    route.raw.effectiveSourceFingerprint
      ? `source fingerprint ${route.raw.effectiveSourceFingerprint}`
      : null,
    route.raw.effectiveSourceFingerprintVersion
      ? `source version ${route.raw.effectiveSourceFingerprintVersion}`
      : null,
    route.raw.effectiveSourceFingerprintInputs?.length
      ? `source inputs ${route.raw.effectiveSourceFingerprintInputs.join(', ')}`
      : null,
    route.raw.rerankRuntimeContractVersion
      ? `rerank runtime contract ${route.raw.rerankRuntimeContractVersion}`
      : null,
    route.raw.rerankRuntimeContractTopK != null
      ? `rerank runtime topK ${route.raw.rerankRuntimeContractTopK}`
      : null,
    route.raw.rerankRuntimeContractStatus
      ? `rerank runtime status ${formatFeatureKind(
          route.raw.rerankRuntimeContractStatus
        )}`
      : null,
    route.raw.rerankRuntimeContractFingerprint
      ? `rerank runtime fingerprint ${route.raw.rerankRuntimeContractFingerprint}`
      : null,
    `prepared providers ${readiness.preparedProviderCount}`,
    preparedRouteTargets.length
      ? `targets ${preparedRouteTargets.join(' -> ')}`
      : null,
    preparedRouteTargetFingerprint
      ? `target fingerprint ${preparedRouteTargetFingerprint}`
      : null,
    readiness.errorCode ? `code ${readiness.errorCode}` : null,
    route.diagnostics.reasonSummary.reasons.length
      ? `reasons ${formatReasonSummaryText(route.diagnostics.reasonSummary)}`
      : 'reasons none',
  ]);
}

function formatPromptRegistryPublishGateRouteCandidate(
  row: PromptRegistryPublishGateRouteCandidate
) {
  const providerProfileLabel = formatAIModelProviderProfileLabel(row);
  const modelDefinitionLabel = formatAIModelDefinitionLabel({
    routeBackendKind: null,
    routeBehaviorFlags: null,
    routeCanonicalModelKey: null,
    routeModelAliasMatched: row.routeModelAliasMatched,
    routeModelDefinitionAliases: row.routeModelDefinitionAliases,
    routeModelDefinitionId: row.routeModelDefinitionId,
    routeModelDefinitionSource: row.routeModelDefinitionSource,
    modelRegistryRevision: row.modelRegistryRevision,
    modelRegistryRevisionFingerprint: row.modelRegistryRevisionFingerprint,
    modelRegistryRevisionId: row.modelRegistryRevisionId,
    modelRegistryRevisionScope: row.modelRegistryRevisionScope,
    modelRegistryRevisionSourceChainFingerprint:
      row.modelRegistryRevisionSourceChainFingerprint,
    modelRegistryRevisionStatus: row.modelRegistryRevisionStatus,
    modelRegistryRevisionWorkspaceId: row.modelRegistryRevisionWorkspaceId,
    routeProtocol: null,
    routeRawModelId: row.routeRawModelId,
    routeRequestLayer: null,
  });

  return compactList([
    formatProviderIdentity(row),
    row.modelId ? `model ${row.modelId}` : null,
    row.requestedModelId ? `requested ${row.requestedModelId}` : null,
    row.providerType
      ? `type ${formatProviderMetadata(row.providerType, PROVIDER_TYPE_LABELS)}`
      : null,
    row.providerSource
      ? `source ${formatProviderMetadata(
          row.providerSource,
          PROVIDER_SOURCE_LABELS
        )}`
      : null,
    row.providerPriority != null ? `priority ${row.providerPriority}` : null,
    row.privacy
      ? `privacy ${formatProviderMetadata(row.privacy, PROVIDER_PRIVACY_LABELS)}`
      : null,
    row.health
      ? `health ${formatProviderMetadata(row.health, PROVIDER_HEALTH_LABELS)}`
      : null,
    row.healthCheckedAt ? `checked ${row.healthCheckedAt}` : null,
    providerProfileLabel ? `profile ${providerProfileLabel}` : null,
    modelDefinitionLabel ? `definition ${modelDefinitionLabel}` : null,
    row.candidateModelIds?.length
      ? `candidate models ${row.candidateModelIds.join(', ')}`
      : null,
    row.providerConfiguredModelIds?.length
      ? `profile models ${row.providerConfiguredModelIds.join(', ')}`
      : null,
    row.providerConfiguredModelCount != null
      ? `profile model count ${row.providerConfiguredModelCount}`
      : null,
    row.registryKind ? `registry ${row.registryKind}` : null,
    row.registrySelected ? 'registry selected' : null,
    row.registryAvailable === false ? 'registry unavailable' : null,
    `status ${row.matched ? 'Matched' : 'Unmatched'}`,
    row.reasons.length
      ? `reasons ${row.reasons.map(formatFeatureKind).join(', ')}`
      : 'reasons none',
  ]);
}

function buildTaskRouteDiagnosticsText({
  label,
  rawRoute,
  route,
}: {
  label: string;
  rawRoute?: AIModelTaskRoute | null;
  route: AIModelTaskRouteDiagnosticsSummary;
}) {
  const { readiness } = route;
  const routeIdentity = compactList([readiness.providerId, readiness.modelId]);
  const requestedModelId =
    readiness.requestedModelId ?? rawRoute?.requestedModelId;
  const requestedModelSource =
    readiness.requestedModelSource ?? rawRoute?.requestedModelSource;
  const requestedModelConfigPath =
    readiness.requestedModelConfigPath ?? rawRoute?.requestedModelConfigPath;
  const preparedRoutes = rawRoute?.preparedRoutes ?? [];
  const preparedRouteTargets = rawRoute?.preparedRouteTargets ?? [];
  const preparedRouteTargetFingerprint =
    rawRoute?.preparedRouteTargetFingerprint;
  const taskRoutePolicySourceChain =
    rawRoute?.taskRoutePolicyRevisionSourceChain ?? [];
  const taskRoutePolicyPublishEvents =
    rawRoute?.taskRoutePolicyRevisionPublishEvents ?? [];

  return [
    `Task route ${label}`,
    `Feature ${formatFeatureKind(readiness.featureKind)}`,
    `Status ${STATUS_LABELS[readiness.status]}`,
    `Severity ${readiness.severity}`,
    `Configured ${readiness.configured ? 'yes' : 'no'}`,
    `Route ${routeIdentity || 'not configured'}`,
    requestedModelId ? `Requested ${requestedModelId}` : null,
    requestedModelSource
      ? `Requested source ${formatAIModelTaskModelSourceLabel(
          requestedModelSource
        )}`
      : null,
    requestedModelConfigPath
      ? `Requested config ${requestedModelConfigPath}`
      : null,
    rawRoute?.taskRoutePolicyRevision
      ? `Task route policy revision ${rawRoute.taskRoutePolicyRevision}`
      : null,
    rawRoute?.taskRoutePolicyRevisionId
      ? `Task route policy revision id ${rawRoute.taskRoutePolicyRevisionId}`
      : null,
    rawRoute?.taskRoutePolicyRevisionScope
      ? `Task route policy revision scope ${formatFeatureKind(
          rawRoute.taskRoutePolicyRevisionScope
        )}`
      : null,
    rawRoute?.taskRoutePolicyRevisionStatus
      ? `Task route policy revision status ${formatFeatureKind(
          rawRoute.taskRoutePolicyRevisionStatus
        )}`
      : null,
    rawRoute?.taskRoutePolicyRevisionFingerprint
      ? `Task route policy revision fingerprint ${rawRoute.taskRoutePolicyRevisionFingerprint}`
      : null,
    rawRoute?.taskRoutePolicyRevisionSourceChainFingerprint
      ? `Task route policy source chain fingerprint ${rawRoute.taskRoutePolicyRevisionSourceChainFingerprint}`
      : null,
    rawRoute?.taskRoutePolicyRevisionPublishEventCount != null
      ? `Task route policy revision publish events ${rawRoute.taskRoutePolicyRevisionPublishEventCount}`
      : null,
    ...taskRoutePolicyPublishEvents.map(
      event =>
        `Task route policy revision publish event ${formatRegistryRevisionPublishEvent(event)}`
    ),
    taskRoutePolicySourceChain.length
      ? `Task route policy source chain ${taskRoutePolicySourceChain
          .map(formatTaskRoutePolicySourceChainEntry)
          .join(' -> ')}`
      : null,
    rawRoute?.embeddingIndexContractVersion
      ? `Embedding index contract ${rawRoute.embeddingIndexContractVersion}`
      : null,
    rawRoute?.embeddingIndexContractDimensions != null
      ? `Embedding index dimensions ${rawRoute.embeddingIndexContractDimensions}d`
      : null,
    rawRoute?.embeddingIndexContractStatus
      ? `Embedding index status ${formatFeatureKind(
          rawRoute.embeddingIndexContractStatus
        )}`
      : null,
    rawRoute?.embeddingIndexContractFingerprint
      ? `Embedding index fingerprint ${rawRoute.embeddingIndexContractFingerprint}`
      : null,
    rawRoute?.rerankRuntimeContractVersion
      ? `Rerank runtime contract ${rawRoute.rerankRuntimeContractVersion}`
      : null,
    rawRoute?.rerankRuntimeContractTopK != null
      ? `Rerank runtime topK ${rawRoute.rerankRuntimeContractTopK}`
      : null,
    rawRoute?.rerankRuntimeContractStatus
      ? `Rerank runtime status ${formatFeatureKind(
          rawRoute.rerankRuntimeContractStatus
        )}`
      : null,
    rawRoute?.rerankRuntimeContractFingerprint
      ? `Rerank runtime fingerprint ${rawRoute.rerankRuntimeContractFingerprint}`
      : null,
    `Prepared providers ${readiness.preparedProviderCount}`,
    preparedRouteTargets.length
      ? `Prepared targets ${preparedRouteTargets.join(' -> ')}`
      : null,
    preparedRouteTargetFingerprint
      ? `Prepared target fingerprint ${preparedRouteTargetFingerprint}`
      : null,
    readiness.errorCode ? `Error code ${readiness.errorCode}` : null,
    readiness.errorMessage ? `Error ${readiness.errorMessage}` : null,
    `Diagnostics errors ${rawRoute?.diagnosticsErrors?.length ?? 0}`,
    ...(rawRoute?.diagnosticsErrors ?? []).map(
      error => `Diagnostics error ${formatTaskRouteDiagnosticsErrorText(error)}`
    ),
    `Reasons ${formatReasonSummaryText(route.reasonSummary)}`,
    route.actionKinds.length
      ? `Recommended ${route.actionKinds
          .map(action => {
            const target = getAIModelTaskRouteRemediationTarget(action);
            return `${formatActionKind(action)} -> ${target.label}`;
          })
          .join(', ')}`
      : 'Recommended none',
    formatRoutePolicyText(route.policy),
    `Prepared routes ${preparedRoutes.length}`,
    ...preparedRoutes.map(
      preparedRoute =>
        `Prepared route ${formatTaskRoutePreparedRouteText(preparedRoute)}`
    ),
    `Policy candidates ${route.policyCandidateTrace.rows.length}`,
    ...route.policyCandidateTrace.rows.map(
      row => `Policy candidate ${formatTaskRoutePolicyCandidateText(row)}`
    ),
    `Phase trace ${route.phaseTrace.phases.length}`,
    ...route.phaseTrace.phases.map(
      row => `Phase ${formatTaskRoutePhaseText(row)}`
    ),
    `Candidate trace ${route.candidateTrace.rows.length}`,
    ...route.candidateTrace.rows.flatMap(row =>
      [
        `Candidate ${formatTaskRouteCandidateText(row)}`,
        ...formatTaskRouteCandidateModelPublishEventLines(row),
      ].filter((line): line is string => line != null)
    ),
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

function RouteSummaryCard({
  label,
  rawRoute,
  route,
}: {
  label: string;
  rawRoute?: AIModelTaskRoute | null;
  route: AIModelTaskRouteDiagnosticsSummary;
}) {
  const { readiness } = route;
  const identity = compactList([readiness.providerId, readiness.modelId]);
  const requestedModelId =
    readiness.requestedModelId ?? rawRoute?.requestedModelId;
  const requestedModelSource =
    readiness.requestedModelSource ?? rawRoute?.requestedModelSource;
  const requestedModelConfigPath =
    readiness.requestedModelConfigPath ?? rawRoute?.requestedModelConfigPath;
  const preparedRoutes = rawRoute?.preparedRoutes ?? [];
  const preparedRouteTargets = rawRoute?.preparedRouteTargets ?? [];
  const preparedRouteTargetFingerprint =
    rawRoute?.preparedRouteTargetFingerprint;
  const taskRoutePolicySourceChain =
    rawRoute?.taskRoutePolicyRevisionSourceChain ?? [];
  const diagnosticsText = buildTaskRouteDiagnosticsText({
    label,
    rawRoute,
    route,
  });

  return (
    <Card className="min-w-0 border-border/60 bg-card shadow-1">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{label}</CardTitle>
            <CardDescription>
              {formatFeatureKind(readiness.featureKind)}
            </CardDescription>
          </div>
          <StatusBadge status={readiness.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-md border border-border/70 bg-muted/30 p-3">
          <div className="text-sm font-medium">Task route diagnostics</div>
          <pre
            className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground"
            data-testid={`task-route-diagnostics-${readiness.featureKind.replaceAll(
              '_',
              '-'
            )}`}
          >
            {diagnosticsText}
          </pre>
        </div>

        <div className="grid grid-cols-1 gap-3 text-sm lg:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Route</div>
            <div className="mt-1 break-words font-medium">
              {identity || 'Not configured'}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Requested model</div>
            <div className="mt-1 break-words font-medium">
              {requestedModelId || 'Auto provider default'}
            </div>
            {requestedModelSource ? (
              <div className="mt-1 text-xs text-muted-foreground">
                Source {formatAIModelTaskModelSourceLabel(requestedModelSource)}
              </div>
            ) : null}
            {requestedModelConfigPath ? (
              <div className="mt-1 break-words text-xs text-muted-foreground">
                Config {requestedModelConfigPath}
              </div>
            ) : null}
            {rawRoute?.taskRoutePolicyRevision ? (
              <div className="mt-1 break-words text-xs text-muted-foreground">
                Revision {rawRoute.taskRoutePolicyRevision}
              </div>
            ) : null}
            {rawRoute?.taskRoutePolicyRevisionSourceChainFingerprint ? (
              <div className="mt-1 break-words text-xs text-muted-foreground">
                Source chain{' '}
                {rawRoute.taskRoutePolicyRevisionSourceChainFingerprint}
              </div>
            ) : null}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              Prepared providers
            </div>
            <div className="mt-1 font-medium">
              {readiness.preparedProviderCount}
            </div>
            {preparedRouteTargets.length ? (
              <div className="mt-1 break-words text-xs text-muted-foreground">
                {preparedRouteTargets.join(' -> ')}
              </div>
            ) : null}
            {preparedRouteTargetFingerprint ? (
              <div className="mt-1 break-words text-xs text-muted-foreground">
                Target fingerprint {preparedRouteTargetFingerprint}
              </div>
            ) : null}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Checks</div>
            <div className="mt-1">
              <SeverityText severity={readiness.severity}>
                {route.reasonSummary.reasons.length} reason
                {route.reasonSummary.reasons.length === 1 ? '' : 's'}
              </SeverityText>
            </div>
          </div>
        </div>

        {readiness.errorCode ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium">{readiness.errorCode}</div>
              {readiness.errorMessage ? (
                <div className="mt-1 break-words text-destructive/80">
                  {readiness.errorMessage}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="text-sm font-medium">Recommended checks</div>
          <RecommendedChecks actions={route.actionKinds} />
        </div>

        <ReasonSummary route={route} />
        <RoutePolicySummary route={route} />
        {taskRoutePolicySourceChain.length ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">Task route policy source</div>
            <div className="space-y-1 text-xs text-muted-foreground">
              {taskRoutePolicySourceChain.map((entry, index) => (
                <div key={`${entry.source}-${entry.scope}-${index}`}>
                  {formatTaskRoutePolicySourceChainEntry(entry)}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <PreparedRoutesSummary routes={preparedRoutes} />
        <PolicyCandidateTrace rows={route.policyCandidateTrace.rows} />
        <PhaseTrace phases={route.phaseTrace.phases} />
        <CandidateTrace rows={route.candidateTrace.rows} />
      </CardContent>
    </Card>
  );
}

function PolicyCandidateTrace({
  rows,
}: {
  rows: AIModelTaskRoutePolicyCandidateTraceRow[];
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Policy candidates</div>
      {rows.length ? (
        <TableViewport minWidth="min-w-[860px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Privacy</TableHead>
                <TableHead>Health</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead>Reasons</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.providerId}>
                  <TableCell className="break-words">
                    <div className="font-medium">
                      {formatProviderIdentity(row)}
                    </div>
                    {row.providerType ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatProviderMetadata(
                          row.providerType,
                          PROVIDER_TYPE_LABELS
                        )}
                      </div>
                    ) : null}
                    {row.providerSource ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatProviderMetadata(
                          row.providerSource,
                          PROVIDER_SOURCE_LABELS
                        )}
                      </div>
                    ) : null}
                    {row.providerPriority != null ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Priority {row.providerPriority}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {formatProviderMetadata(
                      row.privacy,
                      PROVIDER_PRIVACY_LABELS
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      {formatProviderMetadata(
                        row.health,
                        PROVIDER_HEALTH_LABELS
                      )}
                    </div>
                    {row.healthCheckedAt ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Checked {row.healthCheckedAt}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'border font-normal',
                        POLICY_CANDIDATE_STATUS_STYLES[row.status]
                      )}
                    >
                      {formatFeatureKind(row.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <SeverityText severity={row.severity}>
                      {row.reasonSummary.reasons
                        .map(reason => reason.label)
                        .join(', ') || 'No issues'}
                    </SeverityText>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableViewport>
      ) : (
        <EmptyState>No policy candidate diagnostics returned.</EmptyState>
      )}
    </div>
  );
}

function PhaseTrace({ phases }: { phases: AIModelTaskRoutePhaseTraceRow[] }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Phase trace</div>
      {phases.length ? (
        <TableViewport minWidth="min-w-[680px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phase</TableHead>
                <TableHead className="w-[120px]">Candidates</TableHead>
                <TableHead className="w-[120px]">Selected</TableHead>
                <TableHead>Reasons</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {phases.map(phase => (
                <TableRow key={phase.phase}>
                  <TableCell className="font-medium">{phase.phase}</TableCell>
                  <TableCell>{phase.candidateCount}</TableCell>
                  <TableCell>
                    {phase.selectedCount ?? phase.preparedCount ?? 0}
                  </TableCell>
                  <TableCell>
                    <SeverityText severity={phase.severity}>
                      {phase.reasonSummary.reasons
                        .map(reason => reason.label)
                        .join(', ') || 'No issues'}
                    </SeverityText>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableViewport>
      ) : (
        <EmptyState>No phase diagnostics returned.</EmptyState>
      )}
    </div>
  );
}

function CandidateTrace({
  rows,
}: {
  rows: AIModelTaskRouteCandidateTraceRow[];
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Candidate trace</div>
      {rows.length ? (
        <TableViewport minWidth="min-w-[860px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead>Reasons</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const providerProfileLabel =
                  formatAIModelProviderProfileLabel(row);
                const modelDefinitionLabel = formatAIModelDefinitionLabel({
                  routeBackendKind: null,
                  routeBehaviorFlags: null,
                  routeCanonicalModelKey: null,
                  routeModelAliasMatched: row.routeModelAliasMatched,
                  routeModelDefinitionAliases: row.routeModelDefinitionAliases,
                  routeModelDefinitionId: row.routeModelDefinitionId,
                  routeModelDefinitionSource: row.routeModelDefinitionSource,
                  modelRegistryRevision: row.modelRegistryRevision,
                  modelRegistryRevisionFingerprint:
                    row.modelRegistryRevisionFingerprint,
                  modelRegistryRevisionId: row.modelRegistryRevisionId,
                  modelRegistryRevisionScope: row.modelRegistryRevisionScope,
                  modelRegistryRevisionSourceChainFingerprint:
                    row.modelRegistryRevisionSourceChainFingerprint,
                  modelRegistryRevisionStatus: row.modelRegistryRevisionStatus,
                  modelRegistryRevisionWorkspaceId:
                    row.modelRegistryRevisionWorkspaceId,
                  modelRegistryRevisionPublishEventCount:
                    row.modelRegistryRevisionPublishEventCount,
                  routeProtocol: null,
                  routeRawModelId: row.routeRawModelId,
                  routeRequestLayer: null,
                });

                return (
                  <TableRow
                    key={row.candidateKey || `${row.providerId}-${index}`}
                  >
                    <TableCell className="break-words">
                      <div className="font-medium">
                        {formatProviderIdentity(row)}
                      </div>
                      {row.providerType ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatProviderMetadata(
                            row.providerType,
                            PROVIDER_TYPE_LABELS
                          )}
                        </div>
                      ) : null}
                      {row.providerSource ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatProviderMetadata(
                            row.providerSource,
                            PROVIDER_SOURCE_LABELS
                          )}
                        </div>
                      ) : null}
                      {row.providerPriority != null ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Priority {row.providerPriority}
                        </div>
                      ) : null}
                      {providerProfileLabel ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {providerProfileLabel}
                        </div>
                      ) : null}
                      {row.privacy ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatProviderMetadata(
                            row.privacy,
                            PROVIDER_PRIVACY_LABELS
                          )}
                        </div>
                      ) : null}
                      {row.health ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatProviderMetadata(
                            row.health,
                            PROVIDER_HEALTH_LABELS
                          )}
                        </div>
                      ) : null}
                      {row.healthCheckedAt ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Checked {row.healthCheckedAt}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="break-words">
                      {compactList([
                        row.modelId,
                        row.preparedModelId
                          ? `prepared ${row.preparedModelId}`
                          : null,
                        row.requestedModelId
                          ? `requested ${row.requestedModelId}`
                          : null,
                      ]) || 'Not selected'}
                      {modelDefinitionLabel ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {modelDefinitionLabel}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{formatFeatureKind(row.status)}</TableCell>
                    <TableCell>
                      <SeverityText severity={row.severity}>
                        {row.reasonSummary.reasons
                          .map(reason => reason.label)
                          .join(', ') || 'No issues'}
                      </SeverityText>
                      {row.errorCode || row.errorCategory ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {compactList([
                            row.errorCode ? `Code ${row.errorCode}` : null,
                            row.errorCategory
                              ? `Category ${formatFeatureKind(
                                  row.errorCategory
                                )}`
                              : null,
                          ])}
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableViewport>
      ) : (
        <EmptyState>No candidate diagnostics returned.</EmptyState>
      )}
    </div>
  );
}

function ModelDefaultBadges({ model }: { model: AIModel }) {
  const isPromptDefault = model.promptDefaultModel === model.id;
  const isFallbackDefault =
    model.isDefault &&
    !!model.promptDefaultModel &&
    model.promptDefaultModel !== model.id;

  if (!model.isDefault && !isPromptDefault) {
    return <span className="text-muted-foreground">No</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {model.isDefault ? (
        <Badge
          variant="outline"
          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
        >
          Active default
        </Badge>
      ) : null}
      {isPromptDefault ? (
        <Badge variant="outline" className="font-normal">
          Prompt default
        </Badge>
      ) : null}
      {isFallbackDefault ? (
        <Badge
          variant="outline"
          className="border-amber-500/30 bg-amber-500/10 font-normal text-amber-700"
          title={
            model.defaultModelFallbackReason
              ? formatFeatureKind(model.defaultModelFallbackReason)
              : undefined
          }
        >
          Prompt fallback
        </Badge>
      ) : null}
    </div>
  );
}

function ModelTable({
  models,
  promptName,
}: {
  models: AIModel[];
  promptName: string;
}) {
  const candidateDiagnosticsText = buildModelCandidateDiagnosticsText(
    models,
    promptName
  );

  return (
    <Card className="min-w-0 border-border/60 bg-card shadow-1">
      <CardHeader>
        <CardTitle className="text-base">Prompt model candidates</CardTitle>
        <CardDescription>
          Models returned for {formatAIModelPromptDisplayName(promptName)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {models.length ? (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium">
                Model candidates diagnostics
              </div>
              <pre
                className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground"
                data-testid="model-candidates-diagnostics"
              >
                {candidateDiagnosticsText}
              </pre>
            </div>
            <TableViewport minWidth="min-w-[1280px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Fallback</TableHead>
                    <TableHead>Definition</TableHead>
                    <TableHead className="w-[160px]">Source</TableHead>
                    <TableHead>Capabilities</TableHead>
                    <TableHead>Limits</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead className="w-[120px]">Default</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map(model => {
                    const providerProfileLabel =
                      formatAIModelProviderProfileLabel(model);
                    const modelDiagnosticsText =
                      formatAIModelDiagnosticsLabel(model);

                    return (
                      <TableRow key={model.id}>
                        <TableCell>
                          <div className="break-words font-medium">
                            {model.name}
                          </div>
                          <div className="mt-1 break-words text-xs text-muted-foreground">
                            {model.id}
                          </div>
                        </TableCell>
                        <TableCell className="break-words">
                          <div>
                            {formatAIModelProviderLabel(model) ||
                              'Unknown provider'}
                          </div>
                          {providerProfileLabel ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {providerProfileLabel}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="break-words">
                          {formatAIModelRouteLabel(model) || 'Unknown'}
                        </TableCell>
                        <TableCell className="break-words">
                          {formatAIModelFallbackLabel(model) || 'None'}
                        </TableCell>
                        <TableCell className="break-words">
                          {formatAIModelDefinitionLabel(model) || 'Unknown'}
                        </TableCell>
                        <TableCell className="break-words">
                          <div>
                            {formatAIModelSourcesLabel(model) || 'Prompt'}
                          </div>
                          {model.promptModelSource ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Model source{' '}
                              {formatFeatureKind(model.promptModelSource)}
                            </div>
                          ) : null}
                          {model.promptModelConfigPath ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Config {model.promptModelConfigPath}
                            </div>
                          ) : null}
                          {model.promptModelSources?.length ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Source chain{' '}
                              {formatAIModelPromptSourcesLabel(model)}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="break-words">
                          {formatAIModelCapabilityLabel(model) || 'Unknown'}
                        </TableCell>
                        <TableCell className="break-words">
                          {formatAIModelLimitsLabel(model) || 'Unknown'}
                        </TableCell>
                        <TableCell className="break-words">
                          {formatAIModelCostLabel(model) || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <ModelDefaultBadges model={model} />
                          <pre
                            className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/30 p-2 text-xs text-muted-foreground"
                            data-testid={`model-candidate-diagnostics-${model.id}`}
                          >
                            {modelDiagnosticsText}
                          </pre>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableViewport>
          </div>
        ) : (
          <EmptyState>No model candidates returned for this prompt.</EmptyState>
        )}
      </CardContent>
    </Card>
  );
}

function buildModelCandidateDiagnosticsText(
  models: AIModel[],
  promptName: string
) {
  return [
    `Prompt ${formatAIModelPromptDisplayName(promptName)}`,
    `Candidate count ${models.length}`,
    '',
    ...models.flatMap((model, index) => {
      const publishEvents = model.modelRegistryRevisionPublishEvents ?? [];
      return [
        index ? '---' : null,
        formatAIModelDiagnosticsLabel(model),
        model.modelRegistryRevisionPublishEventCount != null
          ? `Model registry revision publish events ${model.modelRegistryRevisionPublishEventCount}`
          : null,
        ...publishEvents.map(
          event =>
            `Model registry revision publish event ${formatRegistryRevisionPublishEvent(event)}`
        ),
      ];
    }),
  ]
    .filter((part): part is string => part != null)
    .join('\n');
}

function PromptCatalogSummary({
  prompt,
  workspaceId,
}: {
  prompt: PromptCatalogItem | undefined;
  workspaceId: string | undefined;
}) {
  if (!prompt) {
    return (
      <div className="rounded-md border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
        Prompt metadata is not available for the submitted prompt name.
      </div>
    );
  }

  const diagnosticsText = buildPromptCatalogDiagnosticsText(prompt);
  const versionEvidence = buildPromptCatalogVersionEvidence(prompt);

  return (
    <div className="space-y-3 rounded-md border border-border/60 p-4 text-sm">
      <div>
        <div className="text-sm font-medium">Prompt catalog diagnostics</div>
        <pre
          className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground"
          data-testid={`prompt-catalog-diagnostics-${prompt.name}`}
        >
          {diagnosticsText}
        </pre>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Version evidence</div>
        <div
          className="mt-1 break-words font-medium"
          data-testid={`prompt-catalog-version-evidence-${prompt.name}`}
        >
          {versionEvidence}
        </div>
      </div>
      <PromptRegistryPublishGatePanel
        prompt={prompt}
        workspaceId={workspaceId}
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div>
          <div className="text-xs text-muted-foreground">Catalog category</div>
          <div className="mt-1 font-medium">
            {formatFeatureKind(prompt.category)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Catalog source</div>
          <div className="mt-1 font-medium">
            {formatFeatureKind(prompt.source)}
          </div>
          <div className="mt-1 break-words text-xs text-muted-foreground">
            Revision {prompt.revision}
          </div>
          <div className="mt-1 break-words text-xs text-muted-foreground">
            Fingerprint {prompt.fingerprint}
          </div>
          <div className="mt-1 break-words text-xs text-muted-foreground">
            Model strategy {prompt.modelStrategyFingerprint}
          </div>
          <div className="mt-1 break-words text-xs text-muted-foreground">
            Template {prompt.templateFingerprint}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Default model</div>
          <div className="mt-1 break-words font-medium">{prompt.model}</div>
          <PromptCatalogSourceSummary
            configPath={prompt.modelConfigPath}
            source={prompt.modelSource}
          />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Prompt policy</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {prompt.defaultPolicy ? (
              <Badge variant="outline" className="font-normal">
                {formatFeatureKind(prompt.defaultPolicy)}
              </Badge>
            ) : null}
            {prompt.overrideApplied ? (
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 font-normal text-amber-700"
              >
                Override
              </Badge>
            ) : null}
            {!prompt.defaultPolicy && !prompt.overrideApplied ? (
              <span className="text-muted-foreground">Built-in default</span>
            ) : null}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Optional models</div>
          <div className="mt-1 font-medium">{prompt.optionalModelCount}</div>
          <PromptCatalogSourceSummary
            configPath={prompt.optionalModelsConfigPath}
            source={prompt.optionalModelsSource}
          />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Pro models</div>
          <div className="mt-1 font-medium">{prompt.proModelCount}</div>
          <PromptCatalogSourceSummary
            configPath={prompt.proModelsConfigPath}
            source={prompt.proModelsSource}
          />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Params</div>
          <div className="mt-1 font-medium">{prompt.paramCount}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Action</div>
          <div className="mt-1 break-words font-medium">
            {prompt.action || 'None'}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Registry source</div>
          <div className="mt-1 break-words font-medium">
            {prompt.registryRecordSource
              ? formatFeatureKind(prompt.registryRecordSource)
              : 'Config fallback'}
          </div>
          {prompt.registryRevision ? (
            <div className="mt-1 break-words text-xs text-muted-foreground">
              Revision {prompt.registryRevision}
            </div>
          ) : null}
          {prompt.registryRevisionScope ? (
            <div className="mt-1 break-words text-xs text-muted-foreground">
              Scope {formatFeatureKind(prompt.registryRevisionScope)}
              {prompt.registryRevisionWorkspaceId
                ? ` / ${prompt.registryRevisionWorkspaceId}`
                : ''}
            </div>
          ) : null}
          {prompt.registryRevisionStatus ? (
            <div className="mt-1 break-words text-xs text-muted-foreground">
              Revision status {formatFeatureKind(prompt.registryRevisionStatus)}
            </div>
          ) : null}
          {prompt.registryRevisionActorId ? (
            <div className="mt-1 break-words text-xs text-muted-foreground">
              Actor {prompt.registryRevisionActorId}
            </div>
          ) : null}
          {prompt.registryRevisionFingerprint ? (
            <div className="mt-1 break-words text-xs text-muted-foreground">
              Revision fingerprint {prompt.registryRevisionFingerprint}
            </div>
          ) : null}
          {prompt.registrySourceChainFingerprint ? (
            <div className="mt-1 break-words text-xs text-muted-foreground">
              Source chain fingerprint {prompt.registrySourceChainFingerprint}
            </div>
          ) : null}
          {(prompt.registrySourceChain ?? []).map(entry => (
            <div
              className="mt-1 break-words text-xs text-muted-foreground"
              key={`${entry.source}:${entry.scope}:${entry.revision ?? ''}:${entry.fingerprint ?? ''}`}
            >
              Source chain {formatPromptRegistrySourceChain(entry)}
            </div>
          ))}
        </div>
        {prompt.registryId != null ? (
          <div>
            <div className="text-xs text-muted-foreground">Registry record</div>
            <div className="mt-1 break-words font-medium">
              {prompt.registryId}
            </div>
            <div className="mt-1 break-words text-xs text-muted-foreground">
              Status{' '}
              {prompt.registryValidationStatus
                ? formatFeatureKind(prompt.registryValidationStatus)
                : 'Unknown'}
            </div>
            {prompt.registryValidationReason ? (
              <div className="mt-1 break-words text-xs text-muted-foreground">
                Reason {formatFeatureKind(prompt.registryValidationReason)}
              </div>
            ) : null}
            {prompt.registryValidationDetail ? (
              <div className="mt-1 break-words text-xs text-muted-foreground">
                Detail {prompt.registryValidationDetail}
              </div>
            ) : null}
            {prompt.registryValidationPublishStatus ? (
              <div className="mt-1 break-words text-xs text-muted-foreground">
                Publish{' '}
                {formatFeatureKind(prompt.registryValidationPublishStatus)}
              </div>
            ) : null}
            {prompt.registryValidationBlockingCount != null ? (
              <div className="mt-1 break-words text-xs text-muted-foreground">
                Blocking {prompt.registryValidationBlockingCount}
              </div>
            ) : null}
            {prompt.registryValidationIssueCount != null ? (
              <div className="mt-1 break-words text-xs text-muted-foreground">
                Issues {prompt.registryValidationIssueCount}
              </div>
            ) : null}
            {prompt.registryValidationErrorCount != null ? (
              <div className="mt-1 break-words text-xs text-muted-foreground">
                Errors {prompt.registryValidationErrorCount}
              </div>
            ) : null}
            {(prompt.registryValidationIssues ?? []).map(issue => (
              <div
                className="mt-1 break-words text-xs text-muted-foreground"
                key={`${issue.path}:${issue.code}:${issue.detail}`}
              >
                Issue {formatPromptRegistryValidationIssue(issue)}
              </div>
            ))}
            {(prompt.registryValidationRemediations ?? []).map(remediation => (
              <div
                className="mt-1 break-words text-xs text-muted-foreground"
                key={`${remediation.kind}:${remediation.target}`}
              >
                Remediation{' '}
                {formatPromptRegistryValidationRemediation(remediation)}
              </div>
            ))}
            <div className="mt-1 break-words text-xs text-muted-foreground">
              Messages {prompt.registryMessageCount ?? 0}
            </div>
            <div className="mt-1 break-words text-xs text-muted-foreground">
              Modified {prompt.registryModified ? 'yes' : 'no'}
            </div>
            {prompt.registryUpdatedAt ? (
              <div className="mt-1 break-words text-xs text-muted-foreground">
                Updated {prompt.registryUpdatedAt}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PromptRegistryPublishGatePanel({
  prompt,
  workspaceId,
}: {
  prompt: PromptCatalogItem;
  workspaceId: string | undefined;
}) {
  if (prompt.registryId == null) {
    return (
      <div className="rounded-md border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
        Prompt registry publish gate is not available for non-registry prompts.
      </div>
    );
  }

  const expectedVersion = buildPromptRegistryPublishGateExpectedVersion(prompt);

  return (
    <PromptRegistryPublishGateQueryResult
      key={`${prompt.name}:${workspaceId ?? 'global'}:${expectedVersion?.registryId ?? 'no-registry'}:${expectedVersion?.registryFingerprint ?? 'no-fingerprint'}`}
      expectedVersion={expectedVersion}
      promptName={prompt.name}
      workspaceId={workspaceId}
    />
  );
}

function PromptRegistryPublishGateQueryResult({
  expectedVersion,
  promptName,
  workspaceId,
}: {
  expectedVersion: PromptRegistryPublishGateExpectedVersion | undefined;
  promptName: string;
  workspaceId: string | undefined;
}) {
  const { data, isValidating } = useQuery({
    query: getCopilotPromptRegistryPublishGateQuery,
    variables: {
      expectedVersion,
      name: promptName,
      workspaceId,
    },
  });
  const verdict = data.currentUser?.copilot?.promptRegistryPublishGate ?? null;
  const submissionContract = verdict?.repairActionPreview.submissionContract;
  const { data: preflightData } = useQuery({
    query: getCopilotPromptRegistryRepairPreflightQuery,
    variables: {
      expectedVersion,
      name: promptName,
      submission: submissionContract
        ? buildPromptRegistryRepairSubmissionInput(submissionContract)
        : {
            approvalPolicyFingerprint: '',
            authorizationFingerprint: '',
            candidateEvidenceSetFingerprint: '',
            taskRouteEffectiveSourceEvidenceSetFingerprint: '',
            embeddingIndexContractEvidenceSetFingerprint: '',
            rerankRuntimeContractEvidenceSetFingerprint: '',
            preparedRouteOrderEvidenceSetFingerprint: '',
            catalogFingerprint: '',
            contractVersion: '',
            expectedRegistryFingerprint: '',
            expectedRegistryId: 0,
            expectedRegistryUpdatedAt: '',
            guardFingerprint: '',
            idempotencyKey: '',
            operationSetFingerprint: '',
            previewFingerprint: '',
            requiredInputs: [],
            submissionFingerprint: '',
            targetLocatorFingerprint: '',
          },
      workspaceId,
    },
  });
  const repairPreflight =
    preflightData.currentUser?.copilot?.promptRegistryRepairPreflight ?? null;
  const [repairExecutionRequest, setRepairExecutionRequest] =
    useState<PromptRegistryRepairExecutionRequest | null>(null);
  const [repairExecutionRequestError, setRepairExecutionRequestError] =
    useState<string | null>(null);
  const [approvalDecisionRecord, setApprovalDecisionRecord] =
    useState<RepairExecutionApprovalDecisionRecord | null>(null);
  const [approvalDecisionError, setApprovalDecisionError] = useState<
    string | null
  >(null);
  const [repairExecutionControlRecord, setRepairExecutionControlRecord] =
    useState<RepairExecutionControlRecord | null>(null);
  const [repairExecutionControlError, setRepairExecutionControlError] =
    useState<string | null>(null);
  const [
    repairExecutionResumePayloadJson,
    setRepairExecutionResumePayloadJson,
  ] = useState(EMPTY_REPAIR_EXECUTION_PAYLOAD_JSON);
  const {
    trigger: requestRepairExecution,
    isMutating: isRequestingRepairExecution,
  } = useMutation({
    mutation: requestCopilotPromptRegistryRepairExecutionMutation,
  });
  const {
    trigger: decideRepairExecutionApproval,
    isMutating: isDecidingRepairExecutionApproval,
  } = useMutation({
    mutation: decideCopilotRepairExecutionApprovalMutation,
  });
  const {
    trigger: controlRepairExecutionRequest,
    isMutating: isControllingRepairExecution,
  } = useMutation({
    mutation: controlCopilotRepairExecutionMutation,
  });
  const canCheckRepairExecutionRequest = Boolean(
    submissionContract && repairPreflight
  );

  const checkRepairExecutionRequest = () => {
    if (!submissionContract || !repairPreflight) {
      return;
    }

    setRepairExecutionRequest(null);
    setRepairExecutionRequestError(null);
    setApprovalDecisionRecord(null);
    setApprovalDecisionError(null);
    setRepairExecutionControlRecord(null);
    setRepairExecutionControlError(null);
    requestRepairExecution({
      input: buildPromptRegistryRepairExecutionRequestInput({
        expectedVersion,
        promptName,
        repairPreflight,
        verdict,
        submissionContract,
        workspaceId,
      }),
    })
      .then(data => {
        setRepairExecutionRequest(
          data.requestCopilotPromptRegistryRepairExecution
        );
      })
      .catch(error => {
        console.error(error);
        setRepairExecutionRequestError(
          error instanceof Error ? error.message : String(error)
        );
      });
  };
  const decideRepairExecution = (decision: 'approve' | 'reject') => {
    const executionRecord = repairExecutionRequest?.executionRecord;
    if (!workspaceId || !executionRecord) {
      return;
    }

    setApprovalDecisionRecord(null);
    setApprovalDecisionError(null);
    setRepairExecutionControlRecord(null);
    setRepairExecutionControlError(null);
    decideRepairExecutionApproval({
      input: {
        workspaceId,
        executionRequestId: executionRecord.id,
        decision,
      },
    })
      .then(data => {
        const record = data.decideCopilotRepairExecutionApproval;
        setApprovalDecisionRecord(record);
        setRepairExecutionRequest(previous =>
          previous
            ? {
                ...previous,
                executionRecord: record,
                repairJobRequestStatus: record.status,
                requestStatus: record.status,
              }
            : previous
        );
      })
      .catch(error => {
        console.error(error);
        setApprovalDecisionError(
          error instanceof Error ? error.message : String(error)
        );
      });
  };
  const controlRepairExecution = (
    action: 'cancel' | 'retry' | 'resume_with_payload'
  ) => {
    const executionRecord =
      repairExecutionControlRecord ??
      approvalDecisionRecord ??
      repairExecutionRequest?.executionRecord;
    if (!workspaceId || !executionRecord) {
      return;
    }

    let executorPayload: Record<string, string> | undefined;
    if (action === 'resume_with_payload') {
      try {
        executorPayload = parseRepairExecutionExecutorPayloadJson(
          repairExecutionResumePayloadJson
        );
      } catch (error) {
        setRepairExecutionControlError(
          error instanceof Error ? error.message : String(error)
        );
        return;
      }
    }

    setRepairExecutionControlRecord(null);
    setRepairExecutionControlError(null);
    controlRepairExecutionRequest({
      input: {
        workspaceId,
        executionRequestId: executionRecord.id,
        action,
        ...(executorPayload ? { executorPayload } : {}),
      },
    })
      .then(data => {
        const record = data.controlCopilotRepairExecution;
        setRepairExecutionControlRecord(record);
        setApprovalDecisionRecord(null);
        setRepairExecutionRequest(previous =>
          previous
            ? {
                ...previous,
                executionRecord: record,
                repairJobRequestStatus: record.status,
                requestStatus: record.status,
              }
            : previous
        );
      })
      .catch(error => {
        console.error(error);
        setRepairExecutionControlError(
          error instanceof Error ? error.message : String(error)
        );
      });
  };

  return (
    <PromptRegistryPublishGateResult
      approvalDecisionError={approvalDecisionError}
      approvalDecisionRecord={approvalDecisionRecord}
      canCheckRepairExecutionRequest={canCheckRepairExecutionRequest}
      checkRepairExecutionRequest={checkRepairExecutionRequest}
      controlRepairExecution={controlRepairExecution}
      decideRepairExecution={decideRepairExecution}
      expectedVersion={expectedVersion}
      isControllingRepairExecution={isControllingRepairExecution}
      isDecidingRepairExecutionApproval={isDecidingRepairExecutionApproval}
      isValidating={isValidating}
      isRequestingRepairExecution={isRequestingRepairExecution}
      promptName={promptName}
      repairExecutionControlError={repairExecutionControlError}
      repairExecutionControlRecord={repairExecutionControlRecord}
      repairExecutionRequest={repairExecutionRequest}
      repairExecutionRequestError={repairExecutionRequestError}
      repairExecutionResumePayloadJson={repairExecutionResumePayloadJson}
      repairPreflight={repairPreflight}
      setRepairExecutionResumePayloadJson={setRepairExecutionResumePayloadJson}
      verdict={verdict}
    />
  );
}

function PromptRegistryPublishGateResult({
  approvalDecisionError,
  approvalDecisionRecord,
  canCheckRepairExecutionRequest,
  checkRepairExecutionRequest,
  controlRepairExecution,
  decideRepairExecution,
  expectedVersion,
  isControllingRepairExecution,
  isDecidingRepairExecutionApproval,
  isValidating,
  isRequestingRepairExecution,
  promptName,
  repairExecutionControlError,
  repairExecutionControlRecord,
  repairExecutionRequest,
  repairExecutionRequestError,
  repairExecutionResumePayloadJson,
  repairPreflight,
  setRepairExecutionResumePayloadJson,
  verdict,
}: {
  approvalDecisionError: string | null;
  approvalDecisionRecord: RepairExecutionApprovalDecisionRecord | null;
  canCheckRepairExecutionRequest: boolean;
  checkRepairExecutionRequest: () => void;
  controlRepairExecution: (
    action: 'cancel' | 'retry' | 'resume_with_payload'
  ) => void;
  decideRepairExecution: (decision: 'approve' | 'reject') => void;
  expectedVersion: PromptRegistryPublishGateExpectedVersion | undefined;
  isControllingRepairExecution: boolean | undefined;
  isDecidingRepairExecutionApproval: boolean | undefined;
  isValidating: boolean | undefined;
  isRequestingRepairExecution: boolean | undefined;
  promptName: string;
  repairExecutionControlError: string | null;
  repairExecutionControlRecord: RepairExecutionControlRecord | null;
  repairExecutionRequest: PromptRegistryRepairExecutionRequest | null;
  repairExecutionRequestError: string | null;
  repairExecutionResumePayloadJson: string;
  repairPreflight: PromptRegistryRepairPreflight | null;
  setRepairExecutionResumePayloadJson: (value: string) => void;
  verdict: PromptRegistryPublishGateVerdict | null;
}) {
  if (!verdict) {
    return (
      <div className="rounded-md border border-border/60 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-medium">Prompt registry publish gate</div>
          {isValidating ? (
            <Badge variant="outline" className="font-normal">
              Refreshing
            </Badge>
          ) : null}
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          No publish gate verdict returned for{' '}
          {formatAIModelPromptDisplayName(promptName)}.
        </div>
      </div>
    );
  }

  const diagnosticsText = buildPromptRegistryPublishGateDiagnosticsText(
    verdict,
    expectedVersion,
    repairExecutionRequest,
    repairPreflight
  );
  const repairGateManifestJson =
    buildPromptRegistryRepairGateManifestJson(verdict);
  const repairGateManifestExportMetadataText =
    buildPromptRegistryRepairGateManifestExportMetadataText(verdict);
  const repairGateManifestExportMetadataJson =
    buildPromptRegistryRepairGateManifestExportMetadataJson(verdict);
  const modelRoutes = resolvePromptRegistryPublishGateModelRoutes(verdict);
  const taskRouteDiagnostics = getAIModelTaskRoutesDiagnostics({
    embeddingRoute: verdict.taskRoutes.find(
      route => route.featureKind === 'workspace_indexing'
    ),
    rerankRoute: verdict.taskRoutes.find(
      route => route.featureKind === 'rerank'
    ),
  });
  const taskRouteDiagnosticsByFeatureKind = new Map(
    taskRouteDiagnostics.routes.map(route => [
      route.readiness.featureKind,
      route,
    ])
  );
  const taskRoutes = verdict.taskRoutes
    .map(route => {
      const diagnostics = taskRouteDiagnosticsByFeatureKind.get(
        route.featureKind
      );
      return diagnostics ? { diagnostics, raw: route } : null;
    })
    .filter(
      (
        route
      ): route is {
        diagnostics: AIModelTaskRouteDiagnosticsSummary;
        raw: PromptRegistryPublishGateTaskRoute;
      } => !!route
    );
  const canDecideRepairExecution =
    repairExecutionRequest?.executionRecord?.status === 'waiting_approval';
  const currentRepairExecutionRecord =
    repairExecutionControlRecord ??
    approvalDecisionRecord ??
    repairExecutionRequest?.executionRecord ??
    null;
  const canCancelRepairExecution =
    currentRepairExecutionRecord?.status === 'waiting_approval' ||
    currentRepairExecutionRecord?.status === 'running' ||
    currentRepairExecutionRecord?.status === 'queued' ||
    currentRepairExecutionRecord?.status === 'failed';
  const canRetryRepairExecution =
    currentRepairExecutionRecord?.status === 'failed';
  const canResumeRepairExecutionWithPayload =
    currentRepairExecutionRecord?.status === 'failed' &&
    currentRepairExecutionRecord.sideEffectCount === 0;

  return (
    <div className="rounded-md border border-border/60 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="font-medium">Prompt registry publish gate</div>
        <Badge
          variant="outline"
          className={cn(
            'font-normal',
            verdict.allowed
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          )}
        >
          {verdict.allowed ? 'Allowed' : 'Blocked'}
        </Badge>
        <Badge variant="outline" className="font-normal">
          {formatFeatureKind(verdict.status)}
        </Badge>
        <Badge variant="outline" className="font-normal">
          Publish {formatFeatureKind(verdict.publishStatus)}
        </Badge>
        {isValidating ? (
          <Badge variant="outline" className="font-normal">
            Refreshing
          </Badge>
        ) : null}
        <Button
          disabled={
            !canCheckRepairExecutionRequest || isRequestingRepairExecution
          }
          onClick={checkRepairExecutionRequest}
          size="sm"
          type="button"
          variant="outline"
        >
          {isRequestingRepairExecution
            ? 'Checking request gate'
            : 'Check request gate'}
        </Button>
      </div>
      <pre
        className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground"
        data-testid={`prompt-registry-publish-gate-${promptName}`}
      >
        {diagnosticsText}
      </pre>
      <PromptRegistryRepairGateManifestArtifactPanel
        manifestJson={repairGateManifestJson}
        metadataJson={repairGateManifestExportMetadataJson}
        metadataText={repairGateManifestExportMetadataText}
        promptName={promptName}
        verdict={verdict}
      />
      {repairExecutionRequest ? (
        <div className="mt-2 space-y-2 break-words text-xs text-muted-foreground">
          <div>
            Repair execution request{' '}
            {formatPromptRegistryRepairExecutionRequest(repairExecutionRequest)}
          </div>
          {canDecideRepairExecution ? (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={isDecidingRepairExecutionApproval}
                onClick={() => decideRepairExecution('approve')}
                size="sm"
                type="button"
                variant="outline"
              >
                Approve execution
              </Button>
              <Button
                disabled={isDecidingRepairExecutionApproval}
                onClick={() => decideRepairExecution('reject')}
                size="sm"
                type="button"
                variant="outline"
              >
                Reject execution
              </Button>
            </div>
          ) : null}
          {currentRepairExecutionRecord &&
          (canCancelRepairExecution ||
            canRetryRepairExecution ||
            canResumeRepairExecutionWithPayload) ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {canCancelRepairExecution ? (
                  <Button
                    disabled={isControllingRepairExecution}
                    onClick={() => controlRepairExecution('cancel')}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Cancel execution
                  </Button>
                ) : null}
                {canRetryRepairExecution ? (
                  <Button
                    disabled={isControllingRepairExecution}
                    onClick={() => controlRepairExecution('retry')}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Retry execution
                  </Button>
                ) : null}
              </div>
              {canResumeRepairExecutionWithPayload ? (
                <div className="space-y-2">
                  <Textarea
                    aria-label="Repair execution executor payload JSON"
                    className="min-h-24 font-mono text-xs"
                    value={repairExecutionResumePayloadJson}
                    onChange={event => {
                      setRepairExecutionResumePayloadJson(event.target.value);
                    }}
                  />
                  <Button
                    disabled={isControllingRepairExecution}
                    onClick={() =>
                      controlRepairExecution('resume_with_payload')
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Resume with payload
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {approvalDecisionRecord ? (
        <div className="mt-2 break-words text-xs text-muted-foreground">
          Repair execution approval decision{' '}
          {formatRepairExecutionRecord(approvalDecisionRecord)}
        </div>
      ) : null}
      {repairExecutionControlRecord ? (
        <div className="mt-2 break-words text-xs text-muted-foreground">
          Repair execution control{' '}
          {formatRepairExecutionRecord(repairExecutionControlRecord)}
        </div>
      ) : null}
      {approvalDecisionError ? (
        <div className="mt-2 break-words text-xs text-destructive">
          Repair execution approval decision error {approvalDecisionError}
        </div>
      ) : null}
      {repairExecutionControlError ? (
        <div className="mt-2 break-words text-xs text-destructive">
          Repair execution control error {repairExecutionControlError}
        </div>
      ) : null}
      {repairExecutionRequestError ? (
        <div className="mt-2 break-words text-xs text-destructive">
          Repair execution request error {repairExecutionRequestError}
        </div>
      ) : null}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div>
          <div className="text-xs text-muted-foreground">Registry row</div>
          <div className="mt-1 break-words font-medium">
            {verdict.registryId}
          </div>
          <div className="mt-1 break-words text-xs text-muted-foreground">
            Fingerprint {verdict.registryFingerprint}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Updated</div>
          <div className="mt-1 break-words font-medium">
            {verdict.registryUpdatedAt}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Issues</div>
          <div className="mt-1 break-words font-medium">
            {verdict.issueCount} total / {verdict.errorCount} error
            {verdict.errorCount === 1 ? '' : 's'} / {verdict.blockingCount}{' '}
            blocking
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Stale check</div>
          <div className="mt-1 break-words font-medium">
            {verdict.stale ? 'Stale' : 'Current'}
          </div>
          {verdict.staleReasons.length ? (
            <div className="mt-1 break-words text-xs text-muted-foreground">
              {verdict.staleReasons.map(formatFeatureKind).join(', ')}
            </div>
          ) : null}
        </div>
        {verdict.modelRoute ? (
          <div>
            <div className="text-xs text-muted-foreground">
              Default model route
            </div>
            <div className="mt-1 break-words font-medium">
              {verdict.modelRoute.available ? 'Available' : 'Unavailable'}
            </div>
            <div className="mt-1 break-words text-xs text-muted-foreground">
              {compactList([
                verdict.modelRoute.providerId,
                verdict.modelRoute.modelId,
                verdict.modelRoute.providerProfileId
                  ? `profile ${verdict.modelRoute.providerProfileId}`
                  : null,
                verdict.modelRoute.requestedModelId
                  ? `requested ${verdict.modelRoute.requestedModelId}`
                  : null,
              ]) || 'No route'}
            </div>
            {verdict.modelRoute.providerProfileConfigPath ? (
              <div className="mt-1 break-words text-xs text-muted-foreground">
                Config {verdict.modelRoute.providerProfileConfigPath}
              </div>
            ) : null}
            <div className="mt-1 break-words text-xs text-muted-foreground">
              Reasons{' '}
              {verdict.modelRoute.reasons.map(formatFeatureKind).join(', ') ||
                'none'}
            </div>
          </div>
        ) : null}
        {modelRoutes.length ? (
          <div className="md:col-span-3">
            <div className="text-xs text-muted-foreground">
              Model route candidates
            </div>
            <div className="mt-1 space-y-1">
              {modelRoutes.map(route => (
                <div
                  className="break-words text-xs text-muted-foreground"
                  key={`${route.candidateKind}:${route.candidateIndex}:${route.requestedModelId ?? route.modelId ?? 'unconfigured'}`}
                >
                  {formatPromptRegistryPublishGateModelRoute(route)}
                  {route.policyCandidates?.length ? (
                    <div className="mt-1 space-y-1 pl-3">
                      {route.policyCandidates.map((candidate, index) => (
                        <div key={`${candidate.providerId}:policy:${index}`}>
                          Policy candidate{' '}
                          {formatPromptRegistryPublishGatePolicyCandidate(
                            candidate
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {route.routeTrace?.length ? (
                    <div className="mt-1 space-y-1 pl-3">
                      {route.routeTrace.map((phase, index) => (
                        <div
                          key={`${route.candidateKind}:${route.candidateIndex}:phase:${phase.phase}:${index}`}
                        >
                          Phase{' '}
                          {formatPromptRegistryPublishGateRoutePhaseText(phase)}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {route.routeCandidates?.length ? (
                    <div className="mt-1 space-y-1 pl-3">
                      {route.routeCandidates.map((candidate, index) => (
                        <div key={`${candidate.providerId}:${index}`}>
                          Candidate{' '}
                          {formatPromptRegistryPublishGateRouteCandidate(
                            candidate
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {taskRoutes.length ? (
          <div className="md:col-span-4">
            <div className="text-xs text-muted-foreground">
              Task route evidence
            </div>
            <div className="mt-1 space-y-1">
              {taskRoutes.map(({ diagnostics, raw }) => (
                <div
                  className="break-words text-xs text-muted-foreground"
                  key={raw.featureKind}
                >
                  Task route{' '}
                  {formatPromptRegistryPublishGateTaskRoute({
                    diagnostics,
                    raw,
                  })}
                  {diagnostics.phaseTrace.phases.length ? (
                    <div className="mt-1 space-y-1 pl-3">
                      {diagnostics.phaseTrace.phases.map((phase, index) => (
                        <div key={`${raw.featureKind}:phase:${index}`}>
                          Phase {formatTaskRoutePhaseText(phase)}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {diagnostics.candidateTrace.rows.length ? (
                    <div className="mt-1 space-y-1 pl-3">
                      {diagnostics.candidateTrace.rows.map(
                        (candidate, index) => (
                          <div
                            key={`${raw.featureKind}:candidate:${candidate.providerId}:${index}`}
                          >
                            Candidate {formatTaskRouteCandidateText(candidate)}
                          </div>
                        )
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {verdict.actionRouteDryRun ? (
          <div className="md:col-span-4">
            <div className="text-xs text-muted-foreground">
              Action route dry-run evidence
            </div>
            <div className="mt-1 break-words text-xs text-muted-foreground">
              {formatPromptRegistryPublishGateActionRouteDryRun(
                verdict.actionRouteDryRun
              )}
            </div>
            {verdict.actionRouteDryRun.steps.length ? (
              <div className="mt-1 space-y-1">
                {verdict.actionRouteDryRun.steps.map(step => (
                  <div
                    className="break-words text-xs text-muted-foreground"
                    key={`${step.stepId}:${step.kind}`}
                  >
                    Step{' '}
                    {formatPromptRegistryPublishGateActionRouteDryRunStep(step)}
                    {step.routes.length ? (
                      <div className="mt-1 space-y-1 pl-3">
                        {step.routes.map(route => (
                          <div
                            key={`${step.stepId}:${route.routeIndex}:${route.providerId}:${route.modelId}`}
                          >
                            Route{' '}
                            {formatPromptRegistryPublishGateActionRouteDryRunRoute(
                              route
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {verdict.issues.length ? (
        <div className="mt-3 space-y-1">
          <div className="text-xs text-muted-foreground">Gate issues</div>
          {verdict.issues.map(issue => (
            <div
              className="break-words text-xs text-muted-foreground"
              key={`${issue.path}:${issue.code}:${issue.detail}`}
            >
              Issue {formatPromptRegistryValidationIssue(issue)}
            </div>
          ))}
        </div>
      ) : null}
      {verdict.remediations.length ? (
        <div className="mt-3 space-y-1">
          <div className="text-xs text-muted-foreground">Gate remediations</div>
          {verdict.remediations.map(remediation => (
            <div
              className="break-words text-xs text-muted-foreground"
              key={`${remediation.kind}:${remediation.target}`}
            >
              Remediation{' '}
              {formatPromptRegistryValidationRemediation(remediation)}
            </div>
          ))}
        </div>
      ) : null}
      {verdict.repairRecommendations.length ? (
        <div className="mt-3 space-y-1">
          <div className="text-xs text-muted-foreground">
            Repair recommendations
          </div>
          {verdict.repairRecommendations.map(recommendation => (
            <div
              className="break-words text-xs text-muted-foreground"
              key={`${recommendation.category}:${recommendation.code}:${recommendation.target}:${recommendation.instanceKey ?? ''}`}
            >
              Recommendation{' '}
              {formatPromptRegistryPublishGateRepairRecommendation(
                recommendation
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildPromptRegistryPublishGateDiagnosticsText(
  verdict: PromptRegistryPublishGateVerdict,
  expectedVersion: PromptRegistryPublishGateExpectedVersion | undefined,
  repairExecutionRequest: PromptRegistryRepairExecutionRequest | null,
  repairPreflight: PromptRegistryRepairPreflight | null
) {
  const modelRoutes = resolvePromptRegistryPublishGateModelRoutes(verdict);
  const taskRouteDiagnostics = getAIModelTaskRoutesDiagnostics({
    embeddingRoute: verdict.taskRoutes.find(
      route => route.featureKind === 'workspace_indexing'
    ),
    rerankRoute: verdict.taskRoutes.find(
      route => route.featureKind === 'rerank'
    ),
  });
  const taskRouteDiagnosticsByFeatureKind = new Map(
    taskRouteDiagnostics.routes.map(route => [
      route.readiness.featureKind,
      route,
    ])
  );
  const taskRoutes = verdict.taskRoutes
    .map(route => {
      const diagnostics = taskRouteDiagnosticsByFeatureKind.get(
        route.featureKind
      );
      return diagnostics ? { diagnostics, raw: route } : null;
    })
    .filter(
      (
        route
      ): route is {
        diagnostics: AIModelTaskRouteDiagnosticsSummary;
        raw: PromptRegistryPublishGateTaskRoute;
      } => !!route
    );

  return [
    `Prompt ${formatAIModelPromptDisplayName(verdict.name)}`,
    `Gate ${verdict.allowed ? 'Allowed' : 'Blocked'}`,
    `Status ${formatFeatureKind(verdict.status)}`,
    `Publish ${formatFeatureKind(verdict.publishStatus)}`,
    `Reason ${formatFeatureKind(verdict.reason)}`,
    `Registry id ${verdict.registryId}`,
    `Registry updated ${verdict.registryUpdatedAt}`,
    `Registry fingerprint ${verdict.registryFingerprint}`,
    expectedVersion?.registryId != null
      ? `Expected registry id ${expectedVersion.registryId}`
      : null,
    expectedVersion?.registryUpdatedAt
      ? `Expected registry updated ${expectedVersion.registryUpdatedAt}`
      : null,
    expectedVersion?.registryFingerprint
      ? `Expected registry fingerprint ${expectedVersion.registryFingerprint}`
      : null,
    `Stale ${verdict.stale ? 'yes' : 'no'}`,
    verdict.staleReasons.length
      ? `Stale reasons ${verdict.staleReasons.map(formatFeatureKind).join(', ')}`
      : 'Stale reasons none',
    `Issues ${verdict.issueCount}`,
    `Errors ${verdict.errorCount}`,
    `Blocking ${verdict.blockingCount}`,
    verdict.modelRoute
      ? `Model route ${formatPromptRegistryPublishGateModelRoute(verdict.modelRoute)}`
      : 'Model route not checked',
    modelRoutes.length
      ? `Model routes ${modelRoutes
          .map(formatPromptRegistryPublishGateModelRoute)
          .join(' | ')}`
      : null,
    ...modelRoutes.flatMap(route => [
      `Model route policy candidates ${formatFeatureKind(route.candidateKind)}#${route.candidateIndex} ${route.policyCandidates?.length ?? 0}`,
      ...(route.policyCandidates ?? []).map(
        candidate =>
          `Model route policy candidate ${formatPromptRegistryPublishGatePolicyCandidate(candidate)}`
      ),
      `Model route phase trace ${formatFeatureKind(route.candidateKind)}#${route.candidateIndex} ${route.routeTrace?.length ?? 0}`,
      ...(route.routeTrace ?? []).map(
        phase =>
          `Model route phase ${formatPromptRegistryPublishGateRoutePhaseText(phase)}`
      ),
      `Model route candidate trace ${formatFeatureKind(route.candidateKind)}#${route.candidateIndex} ${route.routeCandidates?.length ?? 0}`,
      ...(route.routeCandidates ?? []).map(
        candidate =>
          `Model route provider candidate ${formatPromptRegistryPublishGateRouteCandidate(candidate)}`
      ),
    ]),
    taskRoutes.length ? `Task routes ${taskRoutes.length}` : 'Task routes 0',
    ...taskRoutes.flatMap(({ diagnostics, raw }) => [
      `Task route ${formatPromptRegistryPublishGateTaskRoute({
        diagnostics,
        raw,
      })}`,
      `Task route phase trace ${formatFeatureKind(raw.featureKind)} ${diagnostics.phaseTrace.phases.length}`,
      ...diagnostics.phaseTrace.phases.map(
        phase => `Task route phase ${formatTaskRoutePhaseText(phase)}`
      ),
      `Task route candidate trace ${formatFeatureKind(raw.featureKind)} ${diagnostics.candidateTrace.rows.length}`,
      ...diagnostics.candidateTrace.rows.map(
        candidate =>
          `Task route candidate ${formatTaskRouteCandidateText(candidate)}`
      ),
      `Task route prepare candidates ${formatFeatureKind(raw.featureKind)} ${raw.prepareCandidates?.length ?? 0}`,
      `Task route diagnostics errors ${formatFeatureKind(raw.featureKind)} ${raw.diagnosticsErrors?.length ?? 0}`,
      ...(raw.diagnosticsErrors ?? []).map(
        error =>
          `Task route diagnostics error ${formatTaskRouteDiagnosticsErrorText(
            error
          )}`
      ),
    ]),
    verdict.actionRouteDryRun
      ? `Action route dry-run ${formatPromptRegistryPublishGateActionRouteDryRun(
          verdict.actionRouteDryRun
        )}`
      : 'Action route dry-run not checked',
    ...(verdict.actionRouteDryRun?.steps ?? []).flatMap(step => [
      `Action route dry-run step ${formatPromptRegistryPublishGateActionRouteDryRunStep(
        step
      )}`,
      ...step.routes.map(
        route =>
          `Action route dry-run route ${formatPromptRegistryPublishGateActionRouteDryRunRoute(
            route
          )}`
      ),
    ]),
    verdict.repairActionCatalog.length
      ? `Repair action catalog ${verdict.repairActionCatalog.length}`
      : 'Repair action catalog 0',
    verdict.repairActionCatalogFingerprint
      ? `Repair action catalog fingerprint ${verdict.repairActionCatalogFingerprint}`
      : null,
    `Repair action mutation guard ${formatPromptRegistryPublishGateRepairActionMutationGuard(
      verdict.repairActionMutationGuard
    )}`,
    `Repair action preview ${formatPromptRegistryPublishGateRepairActionPreview(
      verdict.repairActionPreview
    )}`,
    `Repair gate manifest ${formatPromptRegistryPublishGateRepairGateManifest(
      verdict.repairGateManifest
    )}`,
    `Repair gate manifest export metadata ${formatPromptRegistryPublishGateRepairGateManifestExportMetadata(
      verdict.repairGateManifestExportMetadata
    )}`,
    repairPreflight
      ? `Repair action preflight ${formatPromptRegistryRepairPreflight(repairPreflight)}`
      : 'Repair action preflight not checked',
    repairExecutionRequest
      ? `Repair execution request ${formatPromptRegistryRepairExecutionRequest(
          repairExecutionRequest
        )}`
      : 'Repair execution request not checked',
    ...verdict.repairActionPreview.operations.map(
      operation =>
        `Repair action preview operation ${formatPromptRegistryPublishGateRepairActionPreviewOperation(
          operation
        )}`
    ),
    ...verdict.repairActionCatalog.map(
      entry =>
        `Repair action catalog entry ${formatPromptRegistryPublishGateRepairActionCatalogEntry(
          entry
        )}`
    ),
    verdict.repairRecommendations.length
      ? `Repair recommendations ${verdict.repairRecommendations.length}`
      : 'Repair recommendations 0',
    ...verdict.repairRecommendations.map(
      recommendation =>
        `Repair recommendation ${formatPromptRegistryPublishGateRepairRecommendation(
          recommendation
        )}`
    ),
    ...(verdict.issues ?? []).map(
      issue => `Issue ${formatPromptRegistryValidationIssue(issue)}`
    ),
    ...(verdict.remediations ?? []).map(
      remediation =>
        `Remediation ${formatPromptRegistryValidationRemediation(remediation)}`
    ),
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

function resolvePromptRegistryPublishGateModelRoutes(
  verdict: PromptRegistryPublishGateVerdict
): PromptRegistryPublishGateModelRoute[] {
  if (verdict.modelRoutes?.length) {
    return verdict.modelRoutes;
  }

  return verdict.modelRoute ? [verdict.modelRoute] : [];
}

function formatPromptRegistryPublishGateActionRouteDryRun(
  dryRun: PromptRegistryPublishGateActionRouteDryRun
) {
  return compactList([
    `status ${formatFeatureKind(dryRun.status)}`,
    `feature ${formatFeatureKind(dryRun.featureKind)}`,
    dryRun.actionId ? `action ${dryRun.actionId}` : null,
    `steps ${dryRun.steps.length}`,
    `routes ${dryRun.actualRouteCount}/${dryRun.expectedRouteCount}`,
    dryRun.missingRouteCount
      ? `missing routes ${dryRun.missingRouteCount}`
      : null,
    dryRun.routeCountMismatch ? 'route count mismatch' : null,
    dryRun.routeCountMismatchStepIds.length
      ? `mismatch steps ${dryRun.routeCountMismatchStepIds.join(', ')}`
      : null,
    dryRun.diagnosticsErrorStage
      ? `diagnostics stage ${formatFeatureKind(dryRun.diagnosticsErrorStage)}`
      : null,
    dryRun.diagnosticsErrorCode
      ? `diagnostics code ${formatFeatureKind(dryRun.diagnosticsErrorCode)}`
      : null,
    dryRun.diagnosticsErrorMessage
      ? `diagnostics message ${dryRun.diagnosticsErrorMessage}`
      : null,
    dryRun.errorCode ? `error ${formatFeatureKind(dryRun.errorCode)}` : null,
    dryRun.errorMessage ? `message ${dryRun.errorMessage}` : null,
  ]);
}

function formatPromptRegistryPublishGateActionRouteDryRunStep(
  step: PromptRegistryPublishGateActionRouteDryRun['steps'][number]
) {
  return compactList([
    step.stepId,
    `kind ${formatFeatureKind(step.kind)}`,
    `routes ${step.actualRouteCount}/${step.routeCount}`,
    step.routeCountMismatch ? 'route count mismatch' : null,
    step.requestedModelId ? `requested ${step.requestedModelId}` : null,
    step.requestedModelSource
      ? `source ${formatFeatureKind(step.requestedModelSource)}`
      : null,
    step.fallbackProviderIds.length
      ? `fallback ${step.fallbackProviderIds.join(' -> ')}`
      : 'fallback none',
  ]);
}

function formatPromptRegistryPublishGateActionRouteDryRunRoute(
  route: PromptRegistryPublishGateActionRouteDryRun['steps'][number]['routes'][number]
) {
  return formatPreparedRouteTraceRoute(route);
}

function formatPromptRegistryPublishGateRepairRecommendation(
  recommendation: PromptRegistryPublishGateVerdict['repairRecommendations'][number]
) {
  const candidateEvidence = recommendation.candidateEvidence ?? [];
  return compactList([
    formatFeatureKind(recommendation.severity),
    formatFeatureKind(recommendation.category),
    recommendation.code,
    recommendation.title,
    recommendation.target,
    recommendation.instanceKey
      ? `instance ${recommendation.instanceKey}`
      : null,
    recommendation.diagnosticsFingerprint
      ? `fingerprint ${recommendation.diagnosticsFingerprint}`
      : null,
    recommendation.suggestedActionCatalogVersion
      ? `action catalog ${recommendation.suggestedActionCatalogVersion}`
      : null,
    `input schema ${formatRepairRecommendationInputSchema(
      recommendation.suggestedActionInputSchema
    )}`,
    recommendation.suggestedActionKind
      ? `action kind ${formatFeatureKind(recommendation.suggestedActionKind)}`
      : null,
    recommendation.suggestedActionSafety
      ? `action safety ${formatFeatureKind(
          recommendation.suggestedActionSafety
        )}`
      : null,
    recommendation.suggestedActionRequiredCapabilities.length
      ? `required capabilities ${recommendation.suggestedActionRequiredCapabilities.join(', ')}`
      : null,
    recommendation.targetLocator
      ? `locator ${formatPromptRegistryPublishGateRepairTargetLocator(
          recommendation.targetLocator
        )}`
      : null,
    recommendation.evidence.length
      ? `evidence ${recommendation.evidence.join(', ')}`
      : null,
    candidateEvidence.length
      ? `candidate evidence ${candidateEvidence.map(formatPromptRegistryPublishGateRepairCandidateEvidence).join(' | ')}`
      : null,
    recommendation.suggestedAction,
  ]);
}

function formatPromptRegistryPublishGateRepairCandidateEvidence(
  evidence: NonNullable<
    PromptRegistryPublishGateVerdict['repairRecommendations'][number]['candidateEvidence']
  >[number]
) {
  return compactList([
    `${formatPromptRegistryPublishGateRepairCandidateEvidenceScope(
      evidence.scope
    )} #${evidence.candidateIndex}`,
    `fingerprint ${evidence.candidateFingerprint}`,
    evidence.candidateKey ? `key ${evidence.candidateKey}` : null,
    `provider ${evidence.providerId}`,
    evidence.allowed != null
      ? `allowed ${evidence.allowed ? 'yes' : 'no'}`
      : null,
    evidence.available != null
      ? `available ${evidence.available ? 'yes' : 'no'}`
      : null,
    evidence.matched != null
      ? `matched ${evidence.matched ? 'yes' : 'no'}`
      : null,
    evidence.prepared != null
      ? `prepared ${evidence.prepared ? 'yes' : 'no'}`
      : null,
    evidence.providerName ? `name ${evidence.providerName}` : null,
    evidence.providerSource
      ? `source ${formatFeatureKind(evidence.providerSource)}`
      : null,
    evidence.providerType
      ? `type ${formatFeatureKind(evidence.providerType)}`
      : null,
    evidence.providerPriority != null
      ? `priority ${evidence.providerPriority}`
      : null,
    evidence.providerProfileId ? `profile ${evidence.providerProfileId}` : null,
    evidence.providerProfileSource
      ? `profile source ${formatFeatureKind(evidence.providerProfileSource)}`
      : null,
    evidence.providerProfileConfigPath
      ? `profile path ${evidence.providerProfileConfigPath}`
      : null,
    evidence.providerConfiguredModelCount != null
      ? `configured models ${evidence.providerConfiguredModelCount}`
      : null,
    evidence.providerConfiguredModelIds?.length
      ? `configured model ids ${evidence.providerConfiguredModelIds.join(', ')}`
      : null,
    evidence.requestedModelId ? `requested ${evidence.requestedModelId}` : null,
    evidence.requestedModelSource
      ? `requested source ${formatAIModelTaskModelSourceLabel(evidence.requestedModelSource)}`
      : null,
    evidence.requestedModelConfigKey
      ? `requested config key ${evidence.requestedModelConfigKey}`
      : null,
    evidence.requestedModelConfigPath
      ? `requested config path ${evidence.requestedModelConfigPath}`
      : null,
    evidence.requestedDimensions != null
      ? `requested ${evidence.requestedDimensions}d`
      : null,
    evidence.modelEmbeddingDimensions != null
      ? `model dimensions ${evidence.modelEmbeddingDimensions}d`
      : null,
    evidence.dimensionMismatch != null
      ? `dimension mismatch ${evidence.dimensionMismatch ? 'yes' : 'no'}`
      : null,
    evidence.embeddingIndexContractVersion
      ? `embedding index contract ${evidence.embeddingIndexContractVersion}`
      : null,
    evidence.embeddingIndexContractDimensions != null
      ? `embedding index dimensions ${evidence.embeddingIndexContractDimensions}d`
      : null,
    evidence.embeddingIndexContractStatus
      ? `embedding index status ${formatFeatureKind(
          evidence.embeddingIndexContractStatus
        )}`
      : null,
    evidence.embeddingIndexContractFingerprint
      ? `embedding index fingerprint ${evidence.embeddingIndexContractFingerprint}`
      : null,
    evidence.rerankRuntimeContractVersion
      ? `rerank runtime contract ${evidence.rerankRuntimeContractVersion}`
      : null,
    evidence.rerankRuntimeContractTopK != null
      ? `rerank runtime topK ${evidence.rerankRuntimeContractTopK}`
      : null,
    evidence.rerankRuntimeContractStatus
      ? `rerank runtime status ${formatFeatureKind(
          evidence.rerankRuntimeContractStatus
        )}`
      : null,
    evidence.rerankRuntimeContractFingerprint
      ? `rerank runtime fingerprint ${evidence.rerankRuntimeContractFingerprint}`
      : null,
    evidence.routeInputTypes?.length
      ? `input ${evidence.routeInputTypes.join(', ')}`
      : null,
    evidence.routeOutputTypes?.length
      ? `output ${evidence.routeOutputTypes.join(', ')}`
      : null,
    evidence.routeAttachmentKinds?.length
      ? `attachments ${evidence.routeAttachmentKinds.join(', ')}`
      : null,
    evidence.routeAttachmentSourceKinds?.length
      ? `attachment sources ${evidence.routeAttachmentSourceKinds.join(', ')}`
      : null,
    evidence.routeAttachmentAllowRemoteUrls != null
      ? `remote attachments ${evidence.routeAttachmentAllowRemoteUrls ? 'yes' : 'no'}`
      : null,
    evidence.routeStructuredAttachmentKinds?.length
      ? `structured attachments ${evidence.routeStructuredAttachmentKinds.join(
          ', '
        )}`
      : null,
    evidence.routeStructuredAttachmentSourceKinds?.length
      ? `structured attachment sources ${evidence.routeStructuredAttachmentSourceKinds.join(
          ', '
        )}`
      : null,
    evidence.routeStructuredAttachmentAllowRemoteUrls != null
      ? `structured remote attachments ${
          evidence.routeStructuredAttachmentAllowRemoteUrls ? 'yes' : 'no'
        }`
      : null,
    evidence.routeContextWindow != null
      ? `context ${evidence.routeContextWindow}`
      : null,
    evidence.routeMaxOutputTokens != null
      ? `max output ${evidence.routeMaxOutputTokens}`
      : null,
    evidence.routeEmbeddingDimensions != null
      ? `embedding ${evidence.routeEmbeddingDimensions}`
      : null,
    evidence.costInputPer1M != null
      ? `input cost ${evidence.costInputPer1M}/1M`
      : null,
    evidence.costOutputPer1M != null
      ? `output cost ${evidence.costOutputPer1M}/1M`
      : null,
    evidence.modelId ? `model ${evidence.modelId}` : null,
    evidence.preparedModelId ? `prepared ${evidence.preparedModelId}` : null,
    evidence.privacy
      ? `privacy ${formatProviderMetadata(evidence.privacy, PROVIDER_PRIVACY_LABELS)}`
      : null,
    evidence.health
      ? `health ${formatProviderMetadata(evidence.health, PROVIDER_HEALTH_LABELS)}`
      : null,
    evidence.healthCheckedAt ? `checked ${evidence.healthCheckedAt}` : null,
    evidence.errorCode ? `code ${evidence.errorCode}` : null,
    evidence.errorCategory
      ? `category ${formatFeatureKind(evidence.errorCategory)}`
      : null,
    evidence.registryKind ? `registry ${evidence.registryKind}` : null,
    evidence.registryAvailable != null
      ? `registry available ${evidence.registryAvailable ? 'yes' : 'no'}`
      : null,
    evidence.registrySelected != null
      ? `registry selected ${evidence.registrySelected ? 'yes' : 'no'}`
      : null,
    evidence.prepareCandidateSnapshotFingerprint
      ? `prepare snapshot fingerprint ${evidence.prepareCandidateSnapshotFingerprint}`
      : null,
    evidence.preparedRouteOrderFingerprint
      ? `prepared route order fingerprint ${evidence.preparedRouteOrderFingerprint}`
      : null,
    evidence.preparedRouteSnapshotFingerprint
      ? `prepared route snapshot fingerprint ${evidence.preparedRouteSnapshotFingerprint}`
      : null,
    evidence.preparedRoutes
      ? `prepared routes ${evidence.preparedRoutes.length}`
      : null,
    ...(evidence.preparedRoutes?.map(
      preparedRoute =>
        `prepared route ${formatTaskRoutePreparedRouteText(preparedRoute)}`
    ) ?? []),
    evidence.providerCapabilitySnapshotFingerprint
      ? `provider capability snapshot fingerprint ${evidence.providerCapabilitySnapshotFingerprint}`
      : null,
    evidence.providerCostSnapshotFingerprint
      ? `provider cost snapshot fingerprint ${evidence.providerCostSnapshotFingerprint}`
      : null,
    evidence.providerHealthSnapshotFingerprint
      ? `provider health snapshot fingerprint ${evidence.providerHealthSnapshotFingerprint}`
      : null,
    evidence.providerLimitSnapshotFingerprint
      ? `provider limit snapshot fingerprint ${evidence.providerLimitSnapshotFingerprint}`
      : null,
    evidence.taskRouteDimensionSnapshotFingerprint
      ? `task route dimension snapshot fingerprint ${evidence.taskRouteDimensionSnapshotFingerprint}`
      : null,
    evidence.taskRouteEmbeddingIndexContractSnapshotFingerprint
      ? `task route embedding index contract snapshot fingerprint ${evidence.taskRouteEmbeddingIndexContractSnapshotFingerprint}`
      : null,
    evidence.taskRouteRerankRuntimeContractSnapshotFingerprint
      ? `task route rerank runtime contract snapshot fingerprint ${evidence.taskRouteRerankRuntimeContractSnapshotFingerprint}`
      : null,
    evidence.taskRouteEffectiveSourceFingerprint
      ? `task route source fingerprint ${evidence.taskRouteEffectiveSourceFingerprint}`
      : null,
    evidence.taskRouteEffectiveSourceFingerprintVersion
      ? `task route source version ${evidence.taskRouteEffectiveSourceFingerprintVersion}`
      : null,
    evidence.taskRouteEffectiveSourceFingerprintInputs?.length
      ? `task route source inputs ${evidence.taskRouteEffectiveSourceFingerprintInputs.join(', ')}`
      : null,
    evidence.taskRouteModelSourceSnapshotFingerprint
      ? `task route model source snapshot fingerprint ${evidence.taskRouteModelSourceSnapshotFingerprint}`
      : null,
    evidence.preparedRouteTargets?.length
      ? `targets ${evidence.preparedRouteTargets.join(', ')}`
      : null,
    evidence.preparedRouteTargetFingerprint
      ? `target fingerprint ${evidence.preparedRouteTargetFingerprint}`
      : null,
    evidence.routeModelDefinitionSource
      ? `definition source ${formatFeatureKind(evidence.routeModelDefinitionSource)}`
      : null,
    evidence.routeModelDefinitionId
      ? `definition ${evidence.routeModelDefinitionId}`
      : null,
    evidence.routeModelDefinitionAliases?.length
      ? `definition aliases ${evidence.routeModelDefinitionAliases.join(', ')}`
      : null,
    evidence.routeModelAliasMatched != null
      ? `alias matched ${evidence.routeModelAliasMatched ? 'yes' : 'no'}`
      : null,
    evidence.routeRawModelId ? `raw model ${evidence.routeRawModelId}` : null,
    evidence.candidateModelIds?.length
      ? `candidate models ${evidence.candidateModelIds.join(', ')}`
      : null,
    evidence.diagnosticsErrorSnapshotFingerprint
      ? `diagnostics error snapshot fingerprint ${evidence.diagnosticsErrorSnapshotFingerprint}`
      : null,
    evidence.diagnosticsErrors?.length
      ? `diagnostics errors ${evidence.diagnosticsErrors
          .map(formatTaskRouteDiagnosticsErrorText)
          .join(' | ')}`
      : null,
    evidence.fallbackProviderIds?.length
      ? `fallback ${evidence.fallbackProviderIds.join(' -> ')}`
      : null,
    evidence.routeTracePhases?.length
      ? `route phases ${evidence.routeTracePhases.join(' -> ')}`
      : null,
    evidence.routeTraceSnapshotFingerprint
      ? `route trace snapshot fingerprint ${evidence.routeTraceSnapshotFingerprint}`
      : null,
    evidence.routeTrace?.length
      ? `route trace ${evidence.routeTrace
          .map(formatPromptRegistryPublishGateRoutePhaseText)
          .join(' | ')}`
      : null,
    evidence.policyCandidateSnapshotFingerprint
      ? `policy snapshot fingerprint ${evidence.policyCandidateSnapshotFingerprint}`
      : null,
    evidence.policyCandidates?.length
      ? `policy candidates ${evidence.policyCandidates
          .map(formatPromptRegistryPublishGatePolicyCandidate)
          .join(' | ')}`
      : null,
    evidence.routeCandidateSnapshotFingerprint
      ? `route snapshot fingerprint ${evidence.routeCandidateSnapshotFingerprint}`
      : null,
    evidence.reasons.length ? `reasons ${evidence.reasons.join(', ')}` : null,
  ]);
}

function formatPromptRegistryPublishGateRepairCandidateEvidenceScope(
  scope: string
) {
  return (
    {
      policyCandidate: 'Policy Candidate',
      prepareCandidate: 'Prepare Candidate',
      routeCandidate: 'Route Candidate',
    }[scope] ?? formatFeatureKind(scope)
  );
}

function formatPromptRegistryPublishGateRepairActionCatalogEntry(
  entry: PromptRegistryPublishGateVerdict['repairActionCatalog'][number]
) {
  return compactList([
    `action catalog ${entry.catalogVersion}`,
    `action kind ${formatFeatureKind(entry.actionKind)}`,
    `safety ${formatFeatureKind(entry.safety)}`,
    `recommendations ${entry.recommendationCount}`,
    entry.requiredCapabilities.length
      ? `required capabilities ${entry.requiredCapabilities.join(', ')}`
      : null,
    `input schema ${formatRepairRecommendationInputSchema(entry.inputSchema)}`,
  ]);
}

function formatPromptRegistryPublishGateRepairActionMutationGuard(
  guard: PromptRegistryPublishGateVerdict['repairActionMutationGuard']
) {
  return compactList([
    guard.required ? 'required yes' : 'required no',
    `fingerprint ${guard.guardFingerprint}`,
    `audit fingerprint ${guard.auditSummaryFingerprint}`,
    `audit summary ${guard.auditSummary}`,
    `catalog ${guard.catalogVersion}`,
    `catalog fingerprint ${guard.catalogFingerprint}`,
    `intent fingerprint ${guard.intentFingerprint}`,
    `input schema fingerprint ${guard.inputSchemaFingerprint}`,
    `target locator fingerprint ${guard.targetLocatorFingerprint}`,
    `target locators ${guard.targetLocatorCount}`,
    guard.targetLocatorKinds.length
      ? `target locator kinds ${guard.targetLocatorKinds.map(formatFeatureKind).join(', ')}`
      : 'target locator kinds none',
    `expected registry ${guard.expectedRegistryId}`,
    `expected fingerprint ${guard.expectedRegistryFingerprint}`,
    `expected updated ${guard.expectedRegistryUpdatedAt}`,
    `recommendations ${guard.recommendationCount}`,
    guard.recommendationCategories.length
      ? `recommendation categories ${guard.recommendationCategories.map(formatFeatureKind).join(', ')}`
      : 'recommendation categories none',
    guard.recommendationCodes.length
      ? `recommendation codes ${guard.recommendationCodes.join(', ')}`
      : 'recommendation codes none',
    guard.suggestedActionKinds.length
      ? `suggested actions ${guard.suggestedActionKinds.map(formatFeatureKind).join(', ')}`
      : 'suggested actions none',
    guard.requiredCapabilities.length
      ? `required capabilities ${guard.requiredCapabilities.join(', ')}`
      : 'required capabilities none',
    guard.requiredReviewModes.length
      ? `review modes ${guard.requiredReviewModes.map(formatFeatureKind).join(', ')}`
      : 'review modes none',
    guard.safetyLevels.length
      ? `safety levels ${guard.safetyLevels.map(formatFeatureKind).join(', ')}`
      : 'safety levels none',
    guard.recommendationFingerprints.length
      ? `recommendation fingerprints ${guard.recommendationFingerprints.join(', ')}`
      : 'recommendation fingerprints none',
  ]);
}

function formatPromptRegistryPublishGateRepairActionPreview(
  preview: PromptRegistryPublishGateVerdict['repairActionPreview']
) {
  const submission = preview.submissionContract;

  return compactList([
    `status ${formatFeatureKind(preview.status)}`,
    preview.readOnly ? 'read-only yes' : 'read-only no',
    `fingerprint ${preview.previewFingerprint}`,
    `guard fingerprint ${preview.guardFingerprint}`,
    `audit fingerprint ${preview.auditSummaryFingerprint}`,
    `authorization ${formatFeatureKind(preview.authorizationStatus)}`,
    `authorization fingerprint ${preview.authorizationFingerprint}`,
    `candidate evidence set fingerprint ${preview.candidateEvidenceSetFingerprint}`,
    `task route source evidence set fingerprint ${preview.taskRouteEffectiveSourceEvidenceSetFingerprint}`,
    `task route source evidence set version ${preview.taskRouteEffectiveSourceEvidenceSetFingerprintVersion}`,
    preview.taskRouteEffectiveSourceEvidenceSetFingerprintInputs.length
      ? `task route source evidence set inputs ${preview.taskRouteEffectiveSourceEvidenceSetFingerprintInputs.join(', ')}`
      : 'task route source evidence set inputs none',
    `embedding index contract evidence set fingerprint ${preview.embeddingIndexContractEvidenceSetFingerprint}`,
    `rerank runtime contract evidence set fingerprint ${preview.rerankRuntimeContractEvidenceSetFingerprint}`,
    `prepared route order evidence set fingerprint ${preview.preparedRouteOrderEvidenceSetFingerprint}`,
    `approval policy ${preview.approvalPolicyVersion}`,
    `approval policy fingerprint ${preview.approvalPolicyFingerprint}`,
    preview.approvalRequired ? 'approval required yes' : 'approval required no',
    preview.approvalModes.length
      ? `approval modes ${preview.approvalModes.map(formatFeatureKind).join(', ')}`
      : 'approval modes none',
    preview.approvalCheckpoints.length
      ? `approval checkpoints ${preview.approvalCheckpoints.map(formatFeatureKind).join(', ')}`
      : 'approval checkpoints none',
    preview.requiredCapabilities.length
      ? `required capabilities ${preview.requiredCapabilities.join(', ')}`
      : 'required capabilities none',
    `catalog ${preview.catalogVersion}`,
    `catalog fingerprint ${preview.catalogFingerprint}`,
    `operation set fingerprint ${preview.operationSetFingerprint}`,
    preview.operationFingerprints.length
      ? `operation fingerprints ${preview.operationFingerprints.join(', ')}`
      : 'operation fingerprints none',
    `target locator fingerprint ${submission.targetLocatorFingerprint}`,
    `submission contract ${submission.contractVersion}`,
    `submission fingerprint ${submission.submissionFingerprint}`,
    `submission candidate evidence set fingerprint ${submission.candidateEvidenceSetFingerprint}`,
    `submission task route source evidence set fingerprint ${submission.taskRouteEffectiveSourceEvidenceSetFingerprint}`,
    `submission task route source evidence set version ${submission.taskRouteEffectiveSourceEvidenceSetFingerprintVersion}`,
    submission.taskRouteEffectiveSourceEvidenceSetFingerprintInputs.length
      ? `submission task route source evidence set inputs ${submission.taskRouteEffectiveSourceEvidenceSetFingerprintInputs.join(', ')}`
      : 'submission task route source evidence set inputs none',
    `submission embedding index contract evidence set fingerprint ${submission.embeddingIndexContractEvidenceSetFingerprint}`,
    `submission rerank runtime contract evidence set fingerprint ${submission.rerankRuntimeContractEvidenceSetFingerprint}`,
    `submission prepared route order evidence set fingerprint ${submission.preparedRouteOrderEvidenceSetFingerprint}`,
    `submission status ${formatFeatureKind(submission.status)}`,
    submission.readOnly
      ? 'submission read-only yes'
      : 'submission read-only no',
    submission.mutationAvailable
      ? 'mutation available yes'
      : 'mutation available no',
    `idempotency key ${submission.idempotencyKey}`,
    `submission expected registry ${submission.expectedRegistryId}`,
    `submission expected fingerprint ${submission.expectedRegistryFingerprint}`,
    `submission expected updated ${submission.expectedRegistryUpdatedAt}`,
    submission.requiredInputs.length
      ? `submission required inputs ${submission.requiredInputs.join(', ')}`
      : 'submission required inputs none',
    `candidates ${preview.candidateCount}`,
    `operations ${preview.operations.length}`,
  ]);
}

function formatPromptRegistryPublishGateRepairGateManifest(
  manifest: PromptRegistryPublishGateVerdict['repairGateManifest']
) {
  return compactList([
    `${manifest.version}`,
    `fingerprint ${manifest.fingerprint}`,
    `boundary ${manifest.boundary}`,
    `registry ${manifest.registryId}`,
    `registry fingerprint ${manifest.registryFingerprint}`,
    `registry updated ${manifest.registryUpdatedAt}`,
    `gate ${formatFeatureKind(manifest.gateStatus)}`,
    `publish ${formatFeatureKind(manifest.publishStatus)}`,
    `reason ${formatFeatureKind(manifest.reason)}`,
    `issues ${manifest.issueCount}`,
    `blocking ${manifest.blockingCount}`,
    `recommendations ${manifest.recommendationCount}`,
    `operations ${manifest.operationCount}`,
    `guard ${manifest.guardFingerprint}`,
    `preview ${manifest.previewFingerprint}`,
    `submission ${manifest.submissionFingerprint}`,
    `candidate evidence set ${manifest.candidateEvidenceSetFingerprint}`,
    `task route source evidence set ${manifest.taskRouteEffectiveSourceEvidenceSetFingerprint}`,
    `task route source evidence set version ${manifest.taskRouteEffectiveSourceEvidenceSetFingerprintVersion}`,
    manifest.taskRouteEffectiveSourceEvidenceSetFingerprintInputs.length
      ? `task route source evidence set inputs ${manifest.taskRouteEffectiveSourceEvidenceSetFingerprintInputs.join(', ')}`
      : 'task route source evidence set inputs none',
    `embedding index contract evidence set ${manifest.embeddingIndexContractEvidenceSetFingerprint}`,
    `rerank runtime contract evidence set ${manifest.rerankRuntimeContractEvidenceSetFingerprint}`,
    `prepared route order evidence set ${manifest.preparedRouteOrderEvidenceSetFingerprint}`,
    `operation set ${manifest.operationSetFingerprint}`,
    `target locator ${manifest.targetLocatorFingerprint}`,
    `approval policy ${manifest.approvalPolicyFingerprint}`,
    `authorization ${manifest.authorizationFingerprint}`,
    `catalog ${manifest.catalogVersion}`,
    `catalog fingerprint ${manifest.catalogFingerprint}`,
    manifest.readOnly ? 'read-only yes' : 'read-only no',
    manifest.mutationAvailable
      ? 'mutation available yes'
      : 'mutation available no',
    manifest.requiredCapabilities.length
      ? `required capabilities ${manifest.requiredCapabilities.join(', ')}`
      : 'required capabilities none',
    manifest.requiredReviewModes.length
      ? `review modes ${manifest.requiredReviewModes.join(', ')}`
      : 'review modes none',
    manifest.safetyLevels.length
      ? `safety ${manifest.safetyLevels.join(', ')}`
      : 'safety none',
    manifest.operationFingerprints.length
      ? `operation fingerprints ${manifest.operationFingerprints.join(', ')}`
      : 'operation fingerprints none',
    manifest.recommendationFingerprints.length
      ? `recommendation fingerprints ${manifest.recommendationFingerprints.join(', ')}`
      : 'recommendation fingerprints none',
  ]);
}

function formatPromptRegistryPublishGateRepairGateManifestExportMetadata(
  metadata: PromptRegistryPublishGateVerdict['repairGateManifestExportMetadata']
) {
  return compactList([
    `${metadata.version}`,
    `artifact ${metadata.artifact}`,
    `filename ${metadata.filename}`,
    `mime ${metadata.mime}`,
    `metadata filename ${metadata.metadataFilename}`,
    `manifest ${metadata.manifestVersion}`,
    `manifest fingerprint ${metadata.manifestFingerprint}`,
    `registry ${metadata.registryId}`,
    `registry fingerprint ${metadata.registryFingerprint}`,
    `registry updated ${metadata.registryUpdatedAt}`,
    `gate ${formatFeatureKind(metadata.gateStatus)}`,
    `publish ${formatFeatureKind(metadata.publishStatus)}`,
    `boundary ${metadata.boundary}`,
    `redaction policy ${metadata.redactionPolicyVersion}`,
    `redaction status ${formatFeatureKind(metadata.redactionPolicyStatus)}`,
    `redaction fingerprint ${metadata.redactionPolicyFingerprint}`,
    `export policy ${metadata.exportPolicyVersion}`,
    `export status ${formatFeatureKind(metadata.exportPolicyStatus)}`,
    `export fingerprint ${metadata.exportPolicyFingerprint}`,
    `audit event ${metadata.auditEventVersion}`,
    `audit status ${formatFeatureKind(metadata.auditEventStatus)}`,
    metadata.auditEventCreated
      ? 'audit event created yes'
      : 'audit event created no',
    `audit fingerprint ${metadata.auditEventFingerprint}`,
    `retention policy ${metadata.retentionPolicyVersion}`,
    `retention status ${formatFeatureKind(metadata.retentionPolicyStatus)}`,
    `retention fingerprint ${metadata.retentionPolicyFingerprint}`,
  ]);
}

function buildPromptRegistryRepairGateManifestJson(
  verdict: PromptRegistryPublishGateVerdict
) {
  return JSON.stringify(verdict.repairGateManifest, null, 2);
}

function buildPromptRegistryRepairGateManifestExportMetadataText(
  verdict: PromptRegistryPublishGateVerdict
) {
  const metadata = verdict.repairGateManifestExportMetadata;

  return [
    `Export artifact ${metadata.artifact}`,
    `Filename ${metadata.filename}`,
    `MIME ${metadata.mime}`,
    `Metadata filename ${metadata.metadataFilename}`,
    `Metadata ${metadata.version}`,
    `Manifest ${metadata.manifestVersion}`,
    `Fingerprint ${metadata.manifestFingerprint}`,
    `Registry ${metadata.registryId}`,
    `Registry fingerprint ${metadata.registryFingerprint}`,
    `Registry updated ${metadata.registryUpdatedAt}`,
    `Gate status ${metadata.gateStatus}`,
    `Publish status ${metadata.publishStatus}`,
    `Boundary ${metadata.boundary}`,
    `Redaction policy ${metadata.redactionPolicyVersion}`,
    `Redaction policy status ${metadata.redactionPolicyStatus}`,
    `Redaction policy fingerprint ${metadata.redactionPolicyFingerprint}`,
    `Export policy ${metadata.exportPolicyVersion}`,
    `Export policy status ${metadata.exportPolicyStatus}`,
    `Export policy fingerprint ${metadata.exportPolicyFingerprint}`,
    `Audit event ${metadata.auditEventVersion}`,
    `Audit event status ${metadata.auditEventStatus}`,
    `Audit event created ${metadata.auditEventCreated ? 'yes' : 'no'}`,
    `Audit event fingerprint ${metadata.auditEventFingerprint}`,
    `Retention policy ${metadata.retentionPolicyVersion}`,
    `Retention policy status ${metadata.retentionPolicyStatus}`,
    `Retention policy fingerprint ${metadata.retentionPolicyFingerprint}`,
  ].join('\n');
}

function buildPromptRegistryRepairGateManifestExportMetadataJson(
  verdict: PromptRegistryPublishGateVerdict
) {
  return JSON.stringify(verdict.repairGateManifestExportMetadata, null, 2);
}

function parseRepairExecutionExecutorPayloadJson(value: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Executor payload JSON is invalid.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Executor payload JSON must be an object.');
  }
  return parsed as Record<string, string>;
}

function downloadPromptRegistryRepairGateManifestJson(
  verdict: PromptRegistryPublishGateVerdict,
  manifestJson: string
) {
  const blob = new Blob([manifestJson], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = verdict.repairGateManifestExportMetadata.filename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadPromptRegistryRepairGateManifestMetadataJson(
  verdict: PromptRegistryPublishGateVerdict,
  metadataJson: string
) {
  const blob = new Blob([metadataJson], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = verdict.repairGateManifestExportMetadata.metadataFilename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function PromptRegistryRepairGateManifestArtifactPanel({
  manifestJson,
  metadataJson,
  metadataText,
  promptName,
  verdict,
}: {
  manifestJson: string;
  metadataJson: string;
  metadataText: string;
  promptName: string;
  verdict: PromptRegistryPublishGateVerdict;
}) {
  return (
    <div className="mt-2 space-y-2 rounded-md border border-border/70 bg-muted/30 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs font-medium">Repair gate manifest artifact</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard?.writeText(manifestJson).catch(() => {});
          }}
        >
          Copy manifest JSON
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            downloadPromptRegistryRepairGateManifestJson(verdict, manifestJson);
          }}
        >
          Download manifest JSON
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard?.writeText(metadataText).catch(() => {});
          }}
        >
          Copy manifest metadata
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard?.writeText(metadataJson).catch(() => {});
          }}
        >
          Copy manifest metadata JSON
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            downloadPromptRegistryRepairGateManifestMetadataJson(
              verdict,
              metadataJson
            );
          }}
        >
          Download manifest metadata JSON
        </Button>
      </div>
      <pre
        className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground"
        data-testid={`prompt-registry-repair-gate-manifest-export-metadata-${promptName}`}
      >
        {metadataText}
      </pre>
      <pre
        className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground"
        data-testid={`prompt-registry-repair-gate-manifest-export-metadata-json-${promptName}`}
      >
        {metadataJson}
      </pre>
      <pre
        className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground"
        data-testid={`prompt-registry-repair-gate-manifest-json-${promptName}`}
      >
        {manifestJson}
      </pre>
    </div>
  );
}

function formatPromptRegistryRepairPreflight(
  preflight: PromptRegistryRepairPreflight
) {
  return compactList([
    `status ${formatFeatureKind(preflight.status)}`,
    preflight.readOnly ? 'read-only yes' : 'read-only no',
    preflight.mutationAvailable
      ? 'mutation available yes'
      : 'mutation available no',
    preflight.accepted ? 'accepted yes' : 'accepted no',
    `execution gate ${preflight.executionGateVersion}`,
    `execution gate status ${formatFeatureKind(preflight.executionGateStatus)}`,
    `execution gate fingerprint ${preflight.executionGateFingerprint}`,
    preflight.executionGateInputs.length
      ? `execution gate inputs ${preflight.executionGateInputs.join(', ')}`
      : 'execution gate inputs none',
    `approval request ${preflight.approvalRequestVersion}`,
    `approval request status ${formatFeatureKind(preflight.approvalRequestStatus)}`,
    preflight.approvalRequired
      ? 'approval required yes'
      : 'approval required no',
    `authorization status ${formatFeatureKind(preflight.authorizationStatus)}`,
    `candidate evidence set fingerprint ${preflight.candidateEvidenceSetFingerprint}`,
    `task route source evidence set fingerprint ${preflight.taskRouteEffectiveSourceEvidenceSetFingerprint}`,
    `task route source evidence set version ${preflight.taskRouteEffectiveSourceEvidenceSetFingerprintVersion}`,
    preflight.taskRouteEffectiveSourceEvidenceSetFingerprintInputs.length
      ? `task route source evidence set inputs ${preflight.taskRouteEffectiveSourceEvidenceSetFingerprintInputs.join(', ')}`
      : 'task route source evidence set inputs none',
    `embedding index contract evidence set fingerprint ${preflight.embeddingIndexContractEvidenceSetFingerprint}`,
    `rerank runtime contract evidence set fingerprint ${preflight.rerankRuntimeContractEvidenceSetFingerprint}`,
    `prepared route order evidence set fingerprint ${preflight.preparedRouteOrderEvidenceSetFingerprint}`,
    `expected candidate evidence set fingerprint ${preflight.expectedCandidateEvidenceSetFingerprint}`,
    `expected task route source evidence set fingerprint ${preflight.expectedTaskRouteEffectiveSourceEvidenceSetFingerprint}`,
    `expected task route source evidence set version ${preflight.expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion}`,
    preflight.expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs
      .length
      ? `expected task route source evidence set inputs ${preflight.expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs.join(', ')}`
      : 'expected task route source evidence set inputs none',
    `expected embedding index contract evidence set fingerprint ${preflight.expectedEmbeddingIndexContractEvidenceSetFingerprint}`,
    `expected rerank runtime contract evidence set fingerprint ${preflight.expectedRerankRuntimeContractEvidenceSetFingerprint}`,
    `expected prepared route order evidence set fingerprint ${preflight.expectedPreparedRouteOrderEvidenceSetFingerprint}`,
    `target locator fingerprint ${preflight.targetLocatorFingerprint}`,
    `expected target locator fingerprint ${preflight.expectedTargetLocatorFingerprint}`,
    `approval request fingerprint ${preflight.approvalRequestFingerprint}`,
    preflight.approvalModes.length
      ? `approval modes ${preflight.approvalModes.map(formatFeatureKind).join(', ')}`
      : 'approval modes none',
    preflight.approvalCheckpoints.length
      ? `approval checkpoints ${preflight.approvalCheckpoints.map(formatFeatureKind).join(', ')}`
      : 'approval checkpoints none',
    preflight.approvalRequestInputs.length
      ? `approval request inputs ${preflight.approvalRequestInputs.join(', ')}`
      : 'approval request inputs none',
    `approval record ${preflight.approvalRecordVersion}`,
    `approval record status ${formatFeatureKind(preflight.approvalRecordStatus)}`,
    preflight.approvalRecordCreated
      ? 'approval record created yes'
      : 'approval record created no',
    `approval record fingerprint ${preflight.approvalRecordFingerprint}`,
    preflight.approvalRecordInputs.length
      ? `approval record inputs ${preflight.approvalRecordInputs.join(', ')}`
      : 'approval record inputs none',
    `actor ${preflight.actorSnapshotVersion}`,
    `actor status ${formatFeatureKind(preflight.actorSnapshotStatus)}`,
    `actor type ${formatFeatureKind(preflight.actorType)}`,
    `actor fingerprint ${preflight.actorFingerprint}`,
    preflight.actorSnapshotInputs.length
      ? `actor inputs ${preflight.actorSnapshotInputs.join(', ')}`
      : 'actor inputs none',
    `audit binding ${preflight.auditBindingVersion}`,
    `audit binding status ${formatFeatureKind(preflight.auditBindingStatus)}`,
    `audit binding fingerprint ${preflight.auditBindingFingerprint}`,
    preflight.auditBindingInputs.length
      ? `audit binding inputs ${preflight.auditBindingInputs.join(', ')}`
      : 'audit binding inputs none',
    `audit event ${preflight.auditEventVersion}`,
    `audit event status ${formatFeatureKind(preflight.auditEventStatus)}`,
    preflight.auditEventCreated
      ? 'audit event created yes'
      : 'audit event created no',
    `audit event fingerprint ${preflight.auditEventFingerprint}`,
    preflight.auditEventInputs.length
      ? `audit event inputs ${preflight.auditEventInputs.join(', ')}`
      : 'audit event inputs none',
    `execution state ${preflight.executionStateVersion}`,
    `execution state status ${formatFeatureKind(preflight.executionStateStatus)}`,
    preflight.executionStateCreated
      ? 'execution state created yes'
      : 'execution state created no',
    `execution state fingerprint ${preflight.executionStateFingerprint}`,
    preflight.executionStateInputs.length
      ? `execution state inputs ${preflight.executionStateInputs.join(', ')}`
      : 'execution state inputs none',
    `rollback plan ${preflight.rollbackPlanVersion}`,
    `rollback plan status ${formatFeatureKind(preflight.rollbackPlanStatus)}`,
    preflight.rollbackPlanCreated
      ? 'rollback plan created yes'
      : 'rollback plan created no',
    `rollback plan fingerprint ${preflight.rollbackPlanFingerprint}`,
    preflight.rollbackPlanInputs.length
      ? `rollback plan inputs ${preflight.rollbackPlanInputs.join(', ')}`
      : 'rollback plan inputs none',
    `policy binding ${preflight.policyBindingVersion}`,
    `policy binding status ${formatFeatureKind(preflight.policyBindingStatus)}`,
    `policy source ${formatFeatureKind(preflight.policySource)}`,
    `policy binding fingerprint ${preflight.policyBindingFingerprint}`,
    preflight.policyBindingInputs.length
      ? `policy binding inputs ${preflight.policyBindingInputs.join(', ')}`
      : 'policy binding inputs none',
    `permission ${formatFeatureKind(preflight.permissionStatus)}`,
    preflight.permissionChecked
      ? 'permission checked yes'
      : 'permission checked no',
    `permission mode ${formatFeatureKind(preflight.permissionCheckMode)}`,
    `permission scope ${formatFeatureKind(preflight.permissionScope)}`,
    preflight.workspaceId
      ? `permission workspace ${preflight.workspaceId}`
      : 'permission workspace none',
    `required permission ${preflight.requiredPermission}`,
    `permission fingerprint ${preflight.permissionFingerprint}`,
    `capability ${formatFeatureKind(preflight.capabilityStatus)}`,
    `capability mode ${formatFeatureKind(preflight.capabilityCheckMode)}`,
    `capability source ${formatFeatureKind(preflight.capabilitySource)}`,
    `capability fingerprint ${preflight.capabilityFingerprint}`,
    `required capabilities ${preflight.requiredCapabilityCount}`,
    preflight.requiredCapabilities.length
      ? `capability set ${preflight.requiredCapabilities.join(', ')}`
      : 'capability set none',
    `review binding ${preflight.reviewBindingVersion}`,
    `review binding status ${formatFeatureKind(preflight.reviewBindingStatus)}`,
    `review binding fingerprint ${preflight.reviewBindingFingerprint}`,
    preflight.reviewBindingInputs.length
      ? `review binding inputs ${preflight.reviewBindingInputs.join(', ')}`
      : 'review binding inputs none',
    `idempotency ${preflight.idempotencyVersion}`,
    `idempotency status ${formatFeatureKind(preflight.idempotencyStatus)}`,
    `idempotency scope ${formatFeatureKind(preflight.idempotencyScope)}`,
    preflight.idempotencyLockAcquired
      ? 'idempotency lock acquired yes'
      : 'idempotency lock acquired no',
    `idempotency key ${preflight.idempotencyKey}`,
    `idempotency fingerprint ${preflight.idempotencyFingerprint}`,
    `repair job ${preflight.repairJobVersion}`,
    `repair job status ${formatFeatureKind(preflight.repairJobStatus)}`,
    preflight.repairJobCreated
      ? 'repair job created yes'
      : 'repair job created no',
    `repair job fingerprint ${preflight.repairJobFingerprint}`,
    preflight.repairJobInputs.length
      ? `repair job inputs ${preflight.repairJobInputs.join(', ')}`
      : 'repair job inputs none',
    `contract ${preflight.contractVersion}`,
    `current submission ${preflight.currentSubmissionFingerprint}`,
    `expected submission ${preflight.expectedSubmissionFingerprint}`,
    preflight.matchedFields.length
      ? `matched fields ${preflight.matchedFields.join(', ')}`
      : 'matched fields none',
    preflight.mismatchedFields.length
      ? `mismatched fields ${preflight.mismatchedFields.join(', ')}`
      : 'mismatched fields none',
  ]);
}

function formatPromptRegistryRepairExecutionRequest(
  request: PromptRegistryRepairExecutionRequest
) {
  return compactList([
    `version ${request.requestVersion}`,
    `status ${formatFeatureKind(request.requestStatus)}`,
    request.readOnly ? 'read-only yes' : 'read-only no',
    request.mutationAvailable
      ? 'mutation available yes'
      : 'mutation available no',
    request.accepted ? 'accepted yes' : 'accepted no',
    request.executionRequested
      ? 'execution requested yes'
      : 'execution requested no',
    request.executionRecord
      ? `execution record ${formatRepairExecutionRecord(request.executionRecord)}`
      : 'execution record none',
    request.executionRecord?.agentRun
      ? `agent run ${request.executionRecord.agentRun.id}`
      : request.executionRecord
        ? 'agent run none'
        : null,
    request.executionRecord?.agentRun
      ? `agent run status ${formatFeatureKind(request.executionRecord.agentRun.status)}`
      : null,
    request.executionRecord?.agentRun
      ? `agent run workflow ${request.executionRecord.agentRun.workflow}`
      : null,
    request.executionRecord?.agentRun
      ? `agent run source ${request.executionRecord.agentRun.sourceType}:${request.executionRecord.agentRun.sourceId}`
      : null,
    request.executionRecord?.agentRun
      ? `agent run timeline ${request.executionRecord.agentRun.timelineFingerprint}`
      : null,
    request.executionRecord?.agentRun
      ? `agent run execution results ${request.executionRecord.agentRun.executionResultCount}`
      : null,
    request.executionRecord?.agentRun?.executionResults.length
      ? `agent run execution result history ${request.executionRecord.agentRun.executionResults
          .map(
            result =>
              `${formatFeatureKind(result.resultStatus)}:${result.adapterWorkflow}:attempt ${result.workerAttempt}:${result.resultFingerprint}`
          )
          .join(' | ')}`
      : null,
    request.executionRecord?.agentRun
      ? request.executionRecord.agentRun.steps.length
        ? `agent run steps ${request.executionRecord.agentRun.steps
            .map(
              step =>
                `${step.stepKey}:${formatFeatureKind(step.stepType)}:${formatFeatureKind(step.status)}`
            )
            .join(' | ')}`
        : 'agent run steps none'
      : null,
    request.executionRecord?.agentRun
      ? request.executionRecord.agentRun.timelineEvents.length
        ? `agent run timeline events ${request.executionRecord.agentRun.timelineEvents
            .map(
              event =>
                `#${event.ordinal}:${formatFeatureKind(event.eventType)}:${formatFeatureKind(event.status)}:${event.summary}`
            )
            .join(' | ')}`
        : 'agent run timeline events none'
      : null,
    `expected candidate evidence set fingerprint ${request.expectedCandidateEvidenceSetFingerprint}`,
    `expected task route source evidence set fingerprint ${request.expectedTaskRouteEffectiveSourceEvidenceSetFingerprint}`,
    `expected task route source evidence set version ${request.expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion}`,
    request.expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs.length
      ? `expected task route source evidence set inputs ${request.expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs.join(', ')}`
      : 'expected task route source evidence set inputs none',
    `expected embedding index contract evidence set fingerprint ${request.expectedEmbeddingIndexContractEvidenceSetFingerprint}`,
    `expected rerank runtime contract evidence set fingerprint ${request.expectedRerankRuntimeContractEvidenceSetFingerprint}`,
    `expected prepared route order evidence set fingerprint ${request.expectedPreparedRouteOrderEvidenceSetFingerprint}`,
    `expected target locator fingerprint ${request.expectedTargetLocatorFingerprint}`,
    `expected repair gate manifest fingerprint ${request.expectedRepairGateManifestFingerprint}`,
    `expected repair gate manifest export policy fingerprint ${request.expectedRepairGateManifestExportPolicyFingerprint}`,
    `expected repair gate manifest retention policy fingerprint ${request.expectedRepairGateManifestRetentionPolicyFingerprint}`,
    `support bundle task route source evidence set fingerprint ${request.supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprint}`,
    `support bundle task route source evidence set version ${request.supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprintVersion}`,
    request
      .supportBundleTaskRouteEffectiveSourceEvidenceSetOperationFingerprints
      .length
      ? `support bundle task route source evidence set operations ${request.supportBundleTaskRouteEffectiveSourceEvidenceSetOperationFingerprints.join(
          ', '
        )}`
      : 'support bundle task route source evidence set operations none',
    request
      .supportBundleTaskRouteEffectiveSourceEvidenceSetDiagnosticsFingerprints
      .length
      ? `support bundle task route source evidence set diagnostics ${request.supportBundleTaskRouteEffectiveSourceEvidenceSetDiagnosticsFingerprints.join(
          ', '
        )}`
      : 'support bundle task route source evidence set diagnostics none',
    request.supportBundleTaskRouteEffectiveSourceEvidenceSetEntries.length
      ? `support bundle task route source evidence set entries ${request.supportBundleTaskRouteEffectiveSourceEvidenceSetEntries
          .map(
            entry =>
              `${entry.operationFingerprint}:${entry.diagnosticsFingerprint}:${
                entry.taskRouteEffectiveSourceFingerprints.length
                  ? entry.taskRouteEffectiveSourceFingerprints.join('|')
                  : 'sources:none'
              }:candidateEvidence:${entry.candidateEvidenceCount}:${
                entry.candidateEvidenceFingerprint
              }:${
                entry.candidateEvidenceFingerprints.length
                  ? entry.candidateEvidenceFingerprints.join('|')
                  : 'candidateEvidenceFingerprints:none'
              }:${
                entry.candidateEvidenceKeys.length
                  ? entry.candidateEvidenceKeys.join('|')
                  : 'candidateEvidenceKeys:none'
              }:referenceSchema:${
                entry.candidateEvidenceReferenceSchemaVersion
              }:${
                entry.candidateEvidenceReferenceSchemaFields.length
                  ? entry.candidateEvidenceReferenceSchemaFields.join('|')
                  : 'referenceSchemaFields:none'
              }:referenceSchemaArtifactFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactFingerprint
              }:referenceSchemaArtifactFingerprintInputs:${
                entry.candidateEvidenceReferenceSchemaArtifactFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactFingerprintInputs:none'
              }:referenceSchemaArtifactRecordFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordFingerprint
              }:referenceSchemaArtifactRecordFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordFingerprintInputs:none'
              }:referenceSchemaArtifactRecordPersistenceFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprint
              }:referenceSchemaArtifactRecordPersistenceFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordPersistenceFingerprintInputs:none'
              }:referenceSchemaArtifactRecordPersistenceStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordPersistenceStatus
              }:referenceSchemaArtifactRecordStorageFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprint
              }:referenceSchemaArtifactRecordStorageFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageBackendFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprint
              }:referenceSchemaArtifactRecordStorageBackendFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageBackendFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageBackendStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageBackendStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveInclusionStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus
              }:referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceStatus
              }:referenceSchemaArtifactRecordStorageObjectFingerprint:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprint
              }:referenceSchemaArtifactRecordStorageObjectFingerprintInputs:${
                entry
                  .candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprintInputs
                  .length
                  ? entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaArtifactRecordStorageObjectFingerprintInputs:none'
              }:referenceSchemaArtifactRecordStorageObjectStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageObjectStatus
              }:referenceSchemaArtifactRecordStorageStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStorageStatus
              }:referenceSchemaArtifactRecordStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactRecordStatus
              }:referenceSchemaArtifactStatus:${
                entry.candidateEvidenceReferenceSchemaArtifactStatus
              }:referenceSchemaFingerprint:${
                entry.candidateEvidenceReferenceSchemaFingerprint
              }:referenceSchemaFingerprintInputs:${
                entry.candidateEvidenceReferenceSchemaFingerprintInputs.length
                  ? entry.candidateEvidenceReferenceSchemaFingerprintInputs.join(
                      '|'
                    )
                  : 'referenceSchemaFingerprintInputs:none'
              }:referenceSchemaRegistryStatus:${
                entry.candidateEvidenceReferenceSchemaRegistryStatus
              }:candidateEvidenceEntries:${
                entry.candidateEvidenceEntries.length
                  ? entry.candidateEvidenceEntries
                      .map(
                        candidate =>
                          `${candidate.candidateEvidenceScope}#${candidate.candidateIndex}:${
                            candidate.candidateEvidenceCategory ??
                            'category:none'
                          }:${candidate.candidateEvidenceProviderId}:${
                            candidate.candidateEvidenceKey ??
                            'candidateEvidenceKey:none'
                          }:${candidate.candidateEvidenceFingerprint}:${
                            candidate.preparedRouteOrderFingerprint ??
                            'prepared:none'
                          }:preparedRouteEntries:${
                            candidate.preparedRouteEntries?.length
                              ? candidate.preparedRouteEntries
                                  .map(
                                    preparedRoute =>
                                      `${preparedRoute.providerId}:model:${
                                        preparedRoute.modelId
                                      }:route:${
                                        preparedRoute.routeIndex
                                      }:fallback:${
                                        preparedRoute.fallbackOrderIndex ??
                                        'fallback:none'
                                      }:profile:${
                                        preparedRoute.providerProfileId ??
                                        'profile:none'
                                      }:configuredModels:${
                                        preparedRoute.providerConfiguredModelIds
                                          ?.length
                                          ? preparedRoute.providerConfiguredModelIds.join(
                                              '^'
                                            )
                                          : 'configuredModels:none'
                                      }:backend:${
                                        preparedRoute.modelBackendKind ??
                                        'backend:none'
                                      }:requestLayer:${
                                        preparedRoute.requestLayer ??
                                        'requestLayer:none'
                                      }`
                                  )
                                  .join('~')
                              : 'preparedRouteEntries:none'
                          }:policyCandidateEntries:${
                            candidate.policyCandidateEntries?.length
                              ? candidate.policyCandidateEntries
                                  .map(
                                    policyCandidate =>
                                      `${policyCandidate.providerId}:allowed:${
                                        policyCandidate.allowed
                                      }:available:${
                                        policyCandidate.available
                                      }:health:${
                                        policyCandidate.health
                                      }:privacy:${
                                        policyCandidate.privacy
                                      }:registry:${
                                        policyCandidate.registryKind ??
                                        'registry:none'
                                      }:profile:${
                                        policyCandidate.providerProfileId ??
                                        'profile:none'
                                      }:reasons:${
                                        policyCandidate.reasons.length
                                          ? policyCandidate.reasons.join('^')
                                          : 'reasons:none'
                                      }`
                                  )
                                  .join('~')
                              : 'policyCandidateEntries:none'
                          }:prepareCandidateEntries:${
                            candidate.prepareCandidateEntries?.length
                              ? candidate.prepareCandidateEntries
                                  .map(
                                    prepareCandidate =>
                                      `${prepareCandidate.providerId}:prepared:${
                                        prepareCandidate.prepared
                                      }:model:${
                                        prepareCandidate.modelId ?? 'model:none'
                                      }:preparedModel:${
                                        prepareCandidate.preparedModelId ??
                                        'preparedModel:none'
                                      }:requested:${
                                        prepareCandidate.requestedModelId ??
                                        'requested:none'
                                      }:registry:${
                                        prepareCandidate.registryKind ??
                                        'registry:none'
                                      }:definition:${
                                        prepareCandidate.routeModelDefinitionId ??
                                        'definition:none'
                                      }:raw:${
                                        prepareCandidate.routeRawModelId ??
                                        'raw:none'
                                      }:error:${
                                        prepareCandidate.errorCode ??
                                        'error:none'
                                      }:reasons:${
                                        prepareCandidate.reasons.length
                                          ? prepareCandidate.reasons.join('^')
                                          : 'reasons:none'
                                      }`
                                  )
                                  .join('~')
                              : 'prepareCandidateEntries:none'
                          }:routeCandidateEntries:${
                            candidate.routeCandidateEntries?.length
                              ? candidate.routeCandidateEntries
                                  .map(
                                    routeCandidate =>
                                      `${routeCandidate.providerId}:matched:${
                                        routeCandidate.matched
                                      }:model:${
                                        routeCandidate.modelId ?? 'model:none'
                                      }:requested:${
                                        routeCandidate.requestedModelId ??
                                        'requested:none'
                                      }:registry:${
                                        routeCandidate.registryKind ??
                                        'registry:none'
                                      }:definition:${
                                        routeCandidate.routeModelDefinitionId ??
                                        'definition:none'
                                      }:raw:${
                                        routeCandidate.routeRawModelId ??
                                        'raw:none'
                                      }:reasons:${
                                        routeCandidate.reasons.length
                                          ? routeCandidate.reasons.join('^')
                                          : 'reasons:none'
                                      }`
                                  )
                                  .join('~')
                              : 'routeCandidateEntries:none'
                          }:${
                            candidate.taskRouteEffectiveSourceFingerprint ??
                            'source:none'
                          }:${
                            candidate.taskRouteModelSourceSnapshotFingerprint ??
                            'modelSource:none'
                          }:modelSourceEntries:${
                            candidate.taskRouteModelSourceSnapshotEntries
                              ?.length
                              ? candidate.taskRouteModelSourceSnapshotEntries
                                  .map(
                                    sourceEntry =>
                                      `${sourceEntry.featureKind}:${
                                        sourceEntry.requestedModelConfigKey ??
                                        'configKey:none'
                                      }:${
                                        sourceEntry.requestedModelConfigPath ??
                                        'configPath:none'
                                      }:${
                                        sourceEntry.requestedModelId ??
                                        'requestedModel:none'
                                      }:${
                                        sourceEntry.requestedModelSource ??
                                        'requestedSource:none'
                                      }`
                                  )
                                  .join('^')
                              : 'modelSourceEntries:none'
                          }`
                      )
                      .join('|')
                  : 'candidateEvidenceEntries:none'
              }:candidateEvidenceCategories:${entry.candidateEvidenceCategoryCount}:${
                entry.candidateEvidenceCategories.length
                  ? entry.candidateEvidenceCategories.join('|')
                  : 'candidateEvidenceCategories:none'
              }:${
                entry.candidateEvidenceProviderIds.length
                  ? entry.candidateEvidenceProviderIds.join('|')
                  : 'candidateEvidenceProviderIds:none'
              }:${
                entry.candidateEvidenceScopes.length
                  ? entry.candidateEvidenceScopes.join('|')
                  : 'candidateEvidenceScopes:none'
              }`
          )
          .join(', ')}`
      : 'support bundle task route source evidence set entries none',
    request.supportBundleTaskRouteEffectiveSourceEvidenceSetSourceFingerprints
      .length
      ? `support bundle task route source evidence set sources ${request.supportBundleTaskRouteEffectiveSourceEvidenceSetSourceFingerprints.join(
          ', '
        )}`
      : 'support bundle task route source evidence set sources none',
    request.supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprintInputs
      .length
      ? `support bundle task route source evidence set inputs ${request.supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprintInputs.join(
          ', '
        )}`
      : 'support bundle task route source evidence set inputs none',
    `support bundle artifact ${request.supportBundleArtifactVersion}`,
    `support bundle artifact status ${formatFeatureKind(
      request.supportBundleArtifactStatus
    )}`,
    request.supportBundleArtifactCreated
      ? 'support bundle artifact created yes'
      : 'support bundle artifact created no',
    `support bundle artifact fingerprint ${request.supportBundleArtifactFingerprint}`,
    request.supportBundleArtifactInputs.length
      ? `support bundle artifact inputs ${request.supportBundleArtifactInputs.join(
          ', '
        )}`
      : 'support bundle artifact inputs none',
    `support bundle artifact record request ${request.supportBundleArtifactRecordRequestVersion}`,
    `support bundle artifact record request status ${formatFeatureKind(
      request.supportBundleArtifactRecordRequestStatus
    )}`,
    request.supportBundleArtifactRecordRequestCreated
      ? 'support bundle artifact record request created yes'
      : 'support bundle artifact record request created no',
    `support bundle artifact record request fingerprint ${request.supportBundleArtifactRecordRequestFingerprint}`,
    request.supportBundleArtifactRecordRequestInputs.length
      ? `support bundle artifact record request inputs ${request.supportBundleArtifactRecordRequestInputs.join(
          ', '
        )}`
      : 'support bundle artifact record request inputs none',
    `support bundle storage key request ${request.supportBundleStorageKeyRequestVersion}`,
    `support bundle storage key request status ${formatFeatureKind(
      request.supportBundleStorageKeyRequestStatus
    )}`,
    request.supportBundleStorageKeyRequestCreated
      ? 'support bundle storage key request created yes'
      : 'support bundle storage key request created no',
    `support bundle storage key request fingerprint ${request.supportBundleStorageKeyRequestFingerprint}`,
    request.supportBundleStorageKeyRequestInputs.length
      ? `support bundle storage key request inputs ${request.supportBundleStorageKeyRequestInputs.join(
          ', '
        )}`
      : 'support bundle storage key request inputs none',
    `support bundle storage key scope ${formatFeatureKind(
      request.supportBundleStorageKeyScope
    )}`,
    `support bundle archive request ${request.supportBundleArchiveRequestVersion}`,
    `support bundle archive request status ${formatFeatureKind(
      request.supportBundleArchiveRequestStatus
    )}`,
    request.supportBundleArchiveRequestCreated
      ? 'support bundle archive request created yes'
      : 'support bundle archive request created no',
    `support bundle archive request fingerprint ${request.supportBundleArchiveRequestFingerprint}`,
    request.supportBundleArchiveRequestInputs.length
      ? `support bundle archive request inputs ${request.supportBundleArchiveRequestInputs.join(
          ', '
        )}`
      : 'support bundle archive request inputs none',
    `support bundle archive format ${formatFeatureKind(
      request.supportBundleArchiveFormat
    )}`,
    `support bundle archive scope ${formatFeatureKind(
      request.supportBundleArchiveScope
    )}`,
    `support bundle archive signature request ${request.supportBundleArchiveSignatureRequestVersion}`,
    `support bundle archive signature request status ${formatFeatureKind(
      request.supportBundleArchiveSignatureRequestStatus
    )}`,
    request.supportBundleArchiveSignatureRequestCreated
      ? 'support bundle archive signature request created yes'
      : 'support bundle archive signature request created no',
    `support bundle archive signature request fingerprint ${request.supportBundleArchiveSignatureRequestFingerprint}`,
    request.supportBundleArchiveSignatureRequestInputs.length
      ? `support bundle archive signature request inputs ${request.supportBundleArchiveSignatureRequestInputs.join(
          ', '
        )}`
      : 'support bundle archive signature request inputs none',
    `support bundle archive signature policy ${formatFeatureKind(
      request.supportBundleArchiveSignaturePolicy
    )}`,
    `support bundle manifest ${request.supportBundleManifestFilename}`,
    `support bundle manifest fingerprint ${request.supportBundleManifestFingerprint}`,
    `support bundle manifest metadata ${request.supportBundleManifestMetadataFilename}`,
    `support bundle manifest metadata fingerprint ${request.supportBundleManifestMetadataFingerprint}`,
    `support bundle package ${request.supportBundlePackageVersion}`,
    `support bundle package status ${formatFeatureKind(
      request.supportBundlePackageStatus
    )}`,
    request.supportBundlePackageCreated
      ? 'support bundle package created yes'
      : 'support bundle package created no',
    `support bundle package fingerprint ${request.supportBundlePackageFingerprint}`,
    request.supportBundlePackageInputs.length
      ? `support bundle package inputs ${request.supportBundlePackageInputs.join(
          ', '
        )}`
      : 'support bundle package inputs none',
    `support bundle download authorization request ${request.supportBundleDownloadAuthorizationRequestVersion}`,
    `support bundle download authorization request status ${formatFeatureKind(
      request.supportBundleDownloadAuthorizationRequestStatus
    )}`,
    request.supportBundleDownloadAuthorizationRequestCreated
      ? 'support bundle download authorization request created yes'
      : 'support bundle download authorization request created no',
    `support bundle download authorization request fingerprint ${request.supportBundleDownloadAuthorizationRequestFingerprint}`,
    request.supportBundleDownloadAuthorizationRequestInputs.length
      ? `support bundle download authorization request inputs ${request.supportBundleDownloadAuthorizationRequestInputs.join(
          ', '
        )}`
      : 'support bundle download authorization request inputs none',
    `support bundle download resolver request ${request.supportBundleDownloadResolverRequestVersion}`,
    `support bundle download resolver request status ${formatFeatureKind(
      request.supportBundleDownloadResolverRequestStatus
    )}`,
    request.supportBundleDownloadResolverRequestCreated
      ? 'support bundle download resolver request created yes'
      : 'support bundle download resolver request created no',
    `support bundle download resolver request fingerprint ${request.supportBundleDownloadResolverRequestFingerprint}`,
    request.supportBundleDownloadResolverRequestInputs.length
      ? `support bundle download resolver request inputs ${request.supportBundleDownloadResolverRequestInputs.join(
          ', '
        )}`
      : 'support bundle download resolver request inputs none',
    `support bundle download resolver route ${formatFeatureKind(
      request.supportBundleDownloadResolverRoute
    )}`,
    `support bundle signed url request ${request.supportBundleSignedUrlRequestVersion}`,
    `support bundle signed url request status ${formatFeatureKind(
      request.supportBundleSignedUrlRequestStatus
    )}`,
    request.supportBundleSignedUrlRequestCreated
      ? 'support bundle signed url request created yes'
      : 'support bundle signed url request created no',
    `support bundle signed url request fingerprint ${request.supportBundleSignedUrlRequestFingerprint}`,
    request.supportBundleSignedUrlRequestInputs.length
      ? `support bundle signed url request inputs ${request.supportBundleSignedUrlRequestInputs.join(
          ', '
        )}`
      : 'support bundle signed url request inputs none',
    `support bundle signed url policy ${formatFeatureKind(
      request.supportBundleSignedUrlPolicy
    )}`,
    `support bundle signed url scope ${formatFeatureKind(
      request.supportBundleSignedUrlScope
    )}`,
    `support bundle audit persistence request ${request.supportBundleAuditPersistenceRequestVersion}`,
    `support bundle audit persistence request status ${formatFeatureKind(
      request.supportBundleAuditPersistenceRequestStatus
    )}`,
    request.supportBundleAuditPersistenceRequestCreated
      ? 'support bundle audit persistence request created yes'
      : 'support bundle audit persistence request created no',
    `support bundle audit persistence request fingerprint ${request.supportBundleAuditPersistenceRequestFingerprint}`,
    request.supportBundleAuditPersistenceRequestInputs.length
      ? `support bundle audit persistence request inputs ${request.supportBundleAuditPersistenceRequestInputs.join(
          ', '
        )}`
      : 'support bundle audit persistence request inputs none',
    `support bundle retention cleanup request ${request.supportBundleRetentionCleanupRequestVersion}`,
    `support bundle retention cleanup request status ${formatFeatureKind(
      request.supportBundleRetentionCleanupRequestStatus
    )}`,
    request.supportBundleRetentionCleanupRequestCreated
      ? 'support bundle retention cleanup request created yes'
      : 'support bundle retention cleanup request created no',
    `support bundle retention cleanup request fingerprint ${request.supportBundleRetentionCleanupRequestFingerprint}`,
    request.supportBundleRetentionCleanupRequestInputs.length
      ? `support bundle retention cleanup request inputs ${request.supportBundleRetentionCleanupRequestInputs.join(
          ', '
        )}`
      : 'support bundle retention cleanup request inputs none',
    `support bundle download authorization status ${formatFeatureKind(
      request.supportBundleDownloadAuthorizationStatus
    )}`,
    `support bundle audit persistence status ${formatFeatureKind(
      request.supportBundleAuditPersistenceStatus
    )}`,
    `support bundle retention cleanup status ${formatFeatureKind(
      request.supportBundleRetentionCleanupStatus
    )}`,
    `approval record request ${request.approvalRecordRequestVersion}`,
    `approval record request status ${formatFeatureKind(
      request.approvalRecordRequestStatus
    )}`,
    request.approvalRecordRequestCreated
      ? 'approval record request created yes'
      : 'approval record request created no',
    `approval record request fingerprint ${request.approvalRecordRequestFingerprint}`,
    request.approvalRecordRequestInputs.length
      ? `approval record request inputs ${request.approvalRecordRequestInputs.join(
          ', '
        )}`
      : 'approval record request inputs none',
    `audit event request ${request.auditEventRequestVersion}`,
    `audit event request status ${formatFeatureKind(
      request.auditEventRequestStatus
    )}`,
    request.auditEventRequestCreated
      ? 'audit event request created yes'
      : 'audit event request created no',
    `audit event request fingerprint ${request.auditEventRequestFingerprint}`,
    request.auditEventRequestInputs.length
      ? `audit event request inputs ${request.auditEventRequestInputs.join(
          ', '
        )}`
      : 'audit event request inputs none',
    `execution completion event request ${request.executionCompletionEventRequestVersion}`,
    `execution completion event request status ${formatFeatureKind(
      request.executionCompletionEventRequestStatus
    )}`,
    request.executionCompletionEventRequestCreated
      ? 'execution completion event request created yes'
      : 'execution completion event request created no',
    `execution completion event request fingerprint ${request.executionCompletionEventRequestFingerprint}`,
    request.executionCompletionEventRequestInputs.length
      ? `execution completion event request inputs ${request.executionCompletionEventRequestInputs.join(
          ', '
        )}`
      : 'execution completion event request inputs none',
    `execution completion request ${request.executionCompletionRequestVersion}`,
    `execution completion request status ${formatFeatureKind(
      request.executionCompletionRequestStatus
    )}`,
    request.executionCompletionRequestCreated
      ? 'execution completion request created yes'
      : 'execution completion request created no',
    `execution completion request fingerprint ${request.executionCompletionRequestFingerprint}`,
    request.executionCompletionRequestInputs.length
      ? `execution completion request inputs ${request.executionCompletionRequestInputs.join(
          ', '
        )}`
      : 'execution completion request inputs none',
    `execution finalization event request ${request.executionFinalizationEventRequestVersion}`,
    `execution finalization event request status ${formatFeatureKind(
      request.executionFinalizationEventRequestStatus
    )}`,
    request.executionFinalizationEventRequestCreated
      ? 'execution finalization event request created yes'
      : 'execution finalization event request created no',
    `execution finalization event request fingerprint ${request.executionFinalizationEventRequestFingerprint}`,
    request.executionFinalizationEventRequestInputs.length
      ? `execution finalization event request inputs ${request.executionFinalizationEventRequestInputs.join(
          ', '
        )}`
      : 'execution finalization event request inputs none',
    `execution finalization request ${request.executionFinalizationRequestVersion}`,
    `execution finalization request status ${formatFeatureKind(
      request.executionFinalizationRequestStatus
    )}`,
    request.executionFinalizationRequestCreated
      ? 'execution finalization request created yes'
      : 'execution finalization request created no',
    `execution finalization request fingerprint ${request.executionFinalizationRequestFingerprint}`,
    request.executionFinalizationRequestInputs.length
      ? `execution finalization request inputs ${request.executionFinalizationRequestInputs.join(
          ', '
        )}`
      : 'execution finalization request inputs none',
    `execution status poll request ${request.executionStatusPollRequestVersion}`,
    `execution status poll request status ${formatFeatureKind(
      request.executionStatusPollRequestStatus
    )}`,
    request.executionStatusPollRequestCreated
      ? 'execution status poll request created yes'
      : 'execution status poll request created no',
    `execution status poll request fingerprint ${request.executionStatusPollRequestFingerprint}`,
    request.executionStatusPollRequestInputs.length
      ? `execution status poll request inputs ${request.executionStatusPollRequestInputs.join(
          ', '
        )}`
      : 'execution status poll request inputs none',
    `execution operation entry request ${request.executionOperationEntryRequestVersion}`,
    `execution operation entry request status ${formatFeatureKind(
      request.executionOperationEntryRequestStatus
    )}`,
    request.executionOperationEntryRequestCreated
      ? 'execution operation entry request created yes'
      : 'execution operation entry request created no',
    `execution operation entry request fingerprint ${request.executionOperationEntryRequestFingerprint}`,
    request.executionOperationEntryRequestInputs.length
      ? `execution operation entry request inputs ${request.executionOperationEntryRequestInputs.join(
          ', '
        )}`
      : 'execution operation entry request inputs none',
    `execution approval UI request ${request.executionApprovalUiRequestVersion}`,
    `execution approval UI request status ${formatFeatureKind(
      request.executionApprovalUiRequestStatus
    )}`,
    request.executionApprovalUiRequestCreated
      ? 'execution approval UI request created yes'
      : 'execution approval UI request created no',
    `execution approval UI request fingerprint ${request.executionApprovalUiRequestFingerprint}`,
    request.executionApprovalUiRequestInputs.length
      ? `execution approval UI request inputs ${request.executionApprovalUiRequestInputs.join(
          ', '
        )}`
      : 'execution approval UI request inputs none',
    `execution diff preview request ${request.executionDiffPreviewRequestVersion}`,
    `execution diff preview request status ${formatFeatureKind(
      request.executionDiffPreviewRequestStatus
    )}`,
    request.executionDiffPreviewRequestCreated
      ? 'execution diff preview request created yes'
      : 'execution diff preview request created no',
    `execution diff preview request fingerprint ${request.executionDiffPreviewRequestFingerprint}`,
    request.executionDiffPreviewRequestInputs.length
      ? `execution diff preview request inputs ${request.executionDiffPreviewRequestInputs.join(
          ', '
        )}`
      : 'execution diff preview request inputs none',
    `execution approval decision request ${request.executionApprovalDecisionRequestVersion}`,
    `execution approval decision request status ${formatFeatureKind(
      request.executionApprovalDecisionRequestStatus
    )}`,
    request.executionApprovalDecisionRequestCreated
      ? 'execution approval decision request created yes'
      : 'execution approval decision request created no',
    `execution approval decision request fingerprint ${request.executionApprovalDecisionRequestFingerprint}`,
    request.executionApprovalDecisionRequestInputs.length
      ? `execution approval decision request inputs ${request.executionApprovalDecisionRequestInputs.join(
          ', '
        )}`
      : 'execution approval decision request inputs none',
    `execution start request ${request.executionStartRequestVersion}`,
    `execution start request status ${formatFeatureKind(
      request.executionStartRequestStatus
    )}`,
    request.executionStartRequestCreated
      ? 'execution start request created yes'
      : 'execution start request created no',
    `execution start request fingerprint ${request.executionStartRequestFingerprint}`,
    request.executionStartRequestInputs.length
      ? `execution start request inputs ${request.executionStartRequestInputs.join(
          ', '
        )}`
      : 'execution start request inputs none',
    `execution queue request ${request.executionQueueRequestVersion}`,
    `execution queue request status ${formatFeatureKind(
      request.executionQueueRequestStatus
    )}`,
    request.executionQueueRequestCreated
      ? 'execution queue request created yes'
      : 'execution queue request created no',
    `execution queue request fingerprint ${request.executionQueueRequestFingerprint}`,
    request.executionQueueRequestInputs.length
      ? `execution queue request inputs ${request.executionQueueRequestInputs.join(
          ', '
        )}`
      : 'execution queue request inputs none',
    `execution worker lease request ${request.executionWorkerLeaseRequestVersion}`,
    `execution worker lease request status ${formatFeatureKind(
      request.executionWorkerLeaseRequestStatus
    )}`,
    request.executionWorkerLeaseRequestCreated
      ? 'execution worker lease request created yes'
      : 'execution worker lease request created no',
    `execution worker lease request fingerprint ${request.executionWorkerLeaseRequestFingerprint}`,
    request.executionWorkerLeaseRequestInputs.length
      ? `execution worker lease request inputs ${request.executionWorkerLeaseRequestInputs.join(
          ', '
        )}`
      : 'execution worker lease request inputs none',
    `execution job run request ${request.executionJobRunRequestVersion}`,
    `execution job run request status ${formatFeatureKind(
      request.executionJobRunRequestStatus
    )}`,
    request.executionJobRunRequestCreated
      ? 'execution job run request created yes'
      : 'execution job run request created no',
    `execution job run request fingerprint ${request.executionJobRunRequestFingerprint}`,
    request.executionJobRunRequestInputs.length
      ? `execution job run request inputs ${request.executionJobRunRequestInputs.join(
          ', '
        )}`
      : 'execution job run request inputs none',
    `execution run step request ${request.executionRunStepRequestVersion}`,
    `execution run step request status ${formatFeatureKind(
      request.executionRunStepRequestStatus
    )}`,
    request.executionRunStepRequestCreated
      ? 'execution run step request created yes'
      : 'execution run step request created no',
    `execution run step request fingerprint ${request.executionRunStepRequestFingerprint}`,
    request.executionRunStepRequestInputs.length
      ? `execution run step request inputs ${request.executionRunStepRequestInputs.join(
          ', '
        )}`
      : 'execution run step request inputs none',
    `execution run step trace request ${request.executionRunStepTraceRequestVersion}`,
    `execution run step trace request status ${formatFeatureKind(
      request.executionRunStepTraceRequestStatus
    )}`,
    request.executionRunStepTraceRequestCreated
      ? 'execution run step trace request created yes'
      : 'execution run step trace request created no',
    `execution run step trace request fingerprint ${request.executionRunStepTraceRequestFingerprint}`,
    request.executionRunStepTraceRequestInputs.length
      ? `execution run step trace request inputs ${request.executionRunStepTraceRequestInputs.join(
          ', '
        )}`
      : 'execution run step trace request inputs none',
    `execution run step result request ${request.executionRunStepResultRequestVersion}`,
    `execution run step result request status ${formatFeatureKind(
      request.executionRunStepResultRequestStatus
    )}`,
    request.executionRunStepResultRequestCreated
      ? 'execution run step result request created yes'
      : 'execution run step result request created no',
    `execution run step result request fingerprint ${request.executionRunStepResultRequestFingerprint}`,
    request.executionRunStepResultRequestInputs.length
      ? `execution run step result request inputs ${request.executionRunStepResultRequestInputs.join(
          ', '
        )}`
      : 'execution run step result request inputs none',
    `execution run step completion request ${request.executionRunStepCompletionRequestVersion}`,
    `execution run step completion request status ${formatFeatureKind(
      request.executionRunStepCompletionRequestStatus
    )}`,
    request.executionRunStepCompletionRequestCreated
      ? 'execution run step completion request created yes'
      : 'execution run step completion request created no',
    `execution run step completion request fingerprint ${request.executionRunStepCompletionRequestFingerprint}`,
    request.executionRunStepCompletionRequestInputs.length
      ? `execution run step completion request inputs ${request.executionRunStepCompletionRequestInputs.join(
          ', '
        )}`
      : 'execution run step completion request inputs none',
    `execution run step status event request ${request.executionRunStepStatusEventRequestVersion}`,
    `execution run step status event request status ${formatFeatureKind(
      request.executionRunStepStatusEventRequestStatus
    )}`,
    request.executionRunStepStatusEventRequestCreated
      ? 'execution run step status event request created yes'
      : 'execution run step status event request created no',
    `execution run step status event request fingerprint ${request.executionRunStepStatusEventRequestFingerprint}`,
    request.executionRunStepStatusEventRequestInputs.length
      ? `execution run step status event request inputs ${request.executionRunStepStatusEventRequestInputs.join(
          ', '
        )}`
      : 'execution run step status event request inputs none',
    `execution run step retry request ${request.executionRunStepRetryRequestVersion}`,
    `execution run step retry request status ${formatFeatureKind(
      request.executionRunStepRetryRequestStatus
    )}`,
    request.executionRunStepRetryRequestCreated
      ? 'execution run step retry request created yes'
      : 'execution run step retry request created no',
    `execution run step retry request fingerprint ${request.executionRunStepRetryRequestFingerprint}`,
    request.executionRunStepRetryRequestInputs.length
      ? `execution run step retry request inputs ${request.executionRunStepRetryRequestInputs.join(
          ', '
        )}`
      : 'execution run step retry request inputs none',
    `execution run step retry attempt request ${request.executionRunStepRetryAttemptRequestVersion}`,
    `execution run step retry attempt request status ${formatFeatureKind(
      request.executionRunStepRetryAttemptRequestStatus
    )}`,
    request.executionRunStepRetryAttemptRequestCreated
      ? 'execution run step retry attempt request created yes'
      : 'execution run step retry attempt request created no',
    `execution run step retry attempt request fingerprint ${request.executionRunStepRetryAttemptRequestFingerprint}`,
    request.executionRunStepRetryAttemptRequestInputs.length
      ? `execution run step retry attempt request inputs ${request.executionRunStepRetryAttemptRequestInputs.join(
          ', '
        )}`
      : 'execution run step retry attempt request inputs none',
    `execution run step retry attempt status event request ${request.executionRunStepRetryAttemptStatusEventRequestVersion}`,
    `execution run step retry attempt status event request status ${formatFeatureKind(
      request.executionRunStepRetryAttemptStatusEventRequestStatus
    )}`,
    request.executionRunStepRetryAttemptStatusEventRequestCreated
      ? 'execution run step retry attempt status event request created yes'
      : 'execution run step retry attempt status event request created no',
    `execution run step retry attempt status event request fingerprint ${request.executionRunStepRetryAttemptStatusEventRequestFingerprint}`,
    request.executionRunStepRetryAttemptStatusEventRequestInputs.length
      ? `execution run step retry attempt status event request inputs ${request.executionRunStepRetryAttemptStatusEventRequestInputs.join(
          ', '
        )}`
      : 'execution run step retry attempt status event request inputs none',
    `execution run step retry attempt trace request ${request.executionRunStepRetryAttemptTraceRequestVersion}`,
    `execution run step retry attempt trace request status ${formatFeatureKind(
      request.executionRunStepRetryAttemptTraceRequestStatus
    )}`,
    request.executionRunStepRetryAttemptTraceRequestCreated
      ? 'execution run step retry attempt trace request created yes'
      : 'execution run step retry attempt trace request created no',
    `execution run step retry attempt trace request fingerprint ${request.executionRunStepRetryAttemptTraceRequestFingerprint}`,
    request.executionRunStepRetryAttemptTraceRequestInputs.length
      ? `execution run step retry attempt trace request inputs ${request.executionRunStepRetryAttemptTraceRequestInputs.join(
          ', '
        )}`
      : 'execution run step retry attempt trace request inputs none',
    `execution run step retry attempt result request ${request.executionRunStepRetryAttemptResultRequestVersion}`,
    `execution run step retry attempt result request status ${formatFeatureKind(
      request.executionRunStepRetryAttemptResultRequestStatus
    )}`,
    request.executionRunStepRetryAttemptResultRequestCreated
      ? 'execution run step retry attempt result request created yes'
      : 'execution run step retry attempt result request created no',
    `execution run step retry attempt result request fingerprint ${request.executionRunStepRetryAttemptResultRequestFingerprint}`,
    request.executionRunStepRetryAttemptResultRequestInputs.length
      ? `execution run step retry attempt result request inputs ${request.executionRunStepRetryAttemptResultRequestInputs.join(
          ', '
        )}`
      : 'execution run step retry attempt result request inputs none',
    `execution run step retry attempt completion request ${request.executionRunStepRetryAttemptCompletionRequestVersion}`,
    `execution run step retry attempt completion request status ${formatFeatureKind(
      request.executionRunStepRetryAttemptCompletionRequestStatus
    )}`,
    request.executionRunStepRetryAttemptCompletionRequestCreated
      ? 'execution run step retry attempt completion request created yes'
      : 'execution run step retry attempt completion request created no',
    `execution run step retry attempt completion request fingerprint ${request.executionRunStepRetryAttemptCompletionRequestFingerprint}`,
    request.executionRunStepRetryAttemptCompletionRequestInputs.length
      ? `execution run step retry attempt completion request inputs ${request.executionRunStepRetryAttemptCompletionRequestInputs.join(
          ', '
        )}`
      : 'execution run step retry attempt completion request inputs none',
    `execution run step retry attempt completion status event request ${request.executionRunStepRetryAttemptCompletionStatusEventRequestVersion}`,
    `execution run step retry attempt completion status event request status ${formatFeatureKind(
      request.executionRunStepRetryAttemptCompletionStatusEventRequestStatus
    )}`,
    request.executionRunStepRetryAttemptCompletionStatusEventRequestCreated
      ? 'execution run step retry attempt completion status event request created yes'
      : 'execution run step retry attempt completion status event request created no',
    `execution run step retry attempt completion status event request fingerprint ${request.executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint}`,
    request.executionRunStepRetryAttemptCompletionStatusEventRequestInputs
      .length
      ? `execution run step retry attempt completion status event request inputs ${request.executionRunStepRetryAttemptCompletionStatusEventRequestInputs.join(
          ', '
        )}`
      : 'execution run step retry attempt completion status event request inputs none',
    `execution run step retry attempt finalization request ${request.executionRunStepRetryAttemptFinalizationRequestVersion}`,
    `execution run step retry attempt finalization request status ${formatFeatureKind(
      request.executionRunStepRetryAttemptFinalizationRequestStatus
    )}`,
    request.executionRunStepRetryAttemptFinalizationRequestCreated
      ? 'execution run step retry attempt finalization request created yes'
      : 'execution run step retry attempt finalization request created no',
    `execution run step retry attempt finalization request fingerprint ${request.executionRunStepRetryAttemptFinalizationRequestFingerprint}`,
    request.executionRunStepRetryAttemptFinalizationRequestInputs.length
      ? `execution run step retry attempt finalization request inputs ${request.executionRunStepRetryAttemptFinalizationRequestInputs.join(
          ', '
        )}`
      : 'execution run step retry attempt finalization request inputs none',
    `execution run step retry attempt finalization status event request ${request.executionRunStepRetryAttemptFinalizationStatusEventRequestVersion}`,
    `execution run step retry attempt finalization status event request status ${formatFeatureKind(
      request.executionRunStepRetryAttemptFinalizationStatusEventRequestStatus
    )}`,
    request.executionRunStepRetryAttemptFinalizationStatusEventRequestCreated
      ? 'execution run step retry attempt finalization status event request created yes'
      : 'execution run step retry attempt finalization status event request created no',
    `execution run step retry attempt finalization status event request fingerprint ${request.executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint}`,
    request.executionRunStepRetryAttemptFinalizationStatusEventRequestInputs
      .length
      ? `execution run step retry attempt finalization status event request inputs ${request.executionRunStepRetryAttemptFinalizationStatusEventRequestInputs.join(
          ', '
        )}`
      : 'execution run step retry attempt finalization status event request inputs none',
    `execution run step retry attempt close request ${request.executionRunStepRetryAttemptCloseRequestVersion}`,
    `execution run step retry attempt close request status ${formatFeatureKind(
      request.executionRunStepRetryAttemptCloseRequestStatus
    )}`,
    request.executionRunStepRetryAttemptCloseRequestCreated
      ? 'execution run step retry attempt close request created yes'
      : 'execution run step retry attempt close request created no',
    `execution run step retry attempt close request fingerprint ${request.executionRunStepRetryAttemptCloseRequestFingerprint}`,
    request.executionRunStepRetryAttemptCloseRequestInputs.length
      ? `execution run step retry attempt close request inputs ${request.executionRunStepRetryAttemptCloseRequestInputs.join(
          ', '
        )}`
      : 'execution run step retry attempt close request inputs none',
    `execution run step retry attempt close status event request ${request.executionRunStepRetryAttemptCloseStatusEventRequestVersion}`,
    `execution run step retry attempt close status event request status ${formatFeatureKind(
      request.executionRunStepRetryAttemptCloseStatusEventRequestStatus
    )}`,
    request.executionRunStepRetryAttemptCloseStatusEventRequestCreated
      ? 'execution run step retry attempt close status event request created yes'
      : 'execution run step retry attempt close status event request created no',
    `execution run step retry attempt close status event request fingerprint ${request.executionRunStepRetryAttemptCloseStatusEventRequestFingerprint}`,
    request.executionRunStepRetryAttemptCloseStatusEventRequestInputs.length
      ? `execution run step retry attempt close status event request inputs ${request.executionRunStepRetryAttemptCloseStatusEventRequestInputs.join(
          ', '
        )}`
      : 'execution run step retry attempt close status event request inputs none',
    `execution run step retry attempt retention policy request ${request.executionRunStepRetryAttemptRetentionPolicyRequestVersion}`,
    `execution run step retry attempt retention policy request status ${formatFeatureKind(
      request.executionRunStepRetryAttemptRetentionPolicyRequestStatus
    )}`,
    request.executionRunStepRetryAttemptRetentionPolicyRequestCreated
      ? 'execution run step retry attempt retention policy request created yes'
      : 'execution run step retry attempt retention policy request created no',
    `execution run step retry attempt retention policy request fingerprint ${request.executionRunStepRetryAttemptRetentionPolicyRequestFingerprint}`,
    request.executionRunStepRetryAttemptRetentionPolicyRequestInputs.length
      ? `execution run step retry attempt retention policy request inputs ${request.executionRunStepRetryAttemptRetentionPolicyRequestInputs.join(
          ', '
        )}`
      : 'execution run step retry attempt retention policy request inputs none',
    `execution run step retry attempt retention policy rule request ${request.executionRunStepRetryAttemptRetentionPolicyRuleRequestVersion}`,
    `execution run step retry attempt retention policy rule request status ${formatFeatureKind(
      request.executionRunStepRetryAttemptRetentionPolicyRuleRequestStatus
    )}`,
    request.executionRunStepRetryAttemptRetentionPolicyRuleRequestCreated
      ? 'execution run step retry attempt retention policy rule request created yes'
      : 'execution run step retry attempt retention policy rule request created no',
    `execution run step retry attempt retention policy rule request fingerprint ${request.executionRunStepRetryAttemptRetentionPolicyRuleRequestFingerprint}`,
    request.executionRunStepRetryAttemptRetentionPolicyRuleRequestInputs.length
      ? `execution run step retry attempt retention policy rule request inputs ${request.executionRunStepRetryAttemptRetentionPolicyRuleRequestInputs.join(
          ', '
        )}`
      : 'execution run step retry attempt retention policy rule request inputs none',
    `execution run step retry attempt retention lease request ${request.executionRunStepRetryAttemptRetentionLeaseRequestVersion}`,
    `execution run step retry attempt retention lease request status ${formatFeatureKind(
      request.executionRunStepRetryAttemptRetentionLeaseRequestStatus
    )}`,
    request.executionRunStepRetryAttemptRetentionLeaseRequestCreated
      ? 'execution run step retry attempt retention lease request created yes'
      : 'execution run step retry attempt retention lease request created no',
    `execution run step retry attempt retention lease request fingerprint ${request.executionRunStepRetryAttemptRetentionLeaseRequestFingerprint}`,
    request.executionRunStepRetryAttemptRetentionLeaseRequestInputs.length
      ? `execution run step retry attempt retention lease request inputs ${request.executionRunStepRetryAttemptRetentionLeaseRequestInputs.join(
          ', '
        )}`
      : 'execution run step retry attempt retention lease request inputs none',
    `execution run step retry attempt archive request ${request.executionRunStepRetryAttemptArchiveRequestVersion}`,
    `execution run step retry attempt archive request status ${formatFeatureKind(
      request.executionRunStepRetryAttemptArchiveRequestStatus
    )}`,
    request.executionRunStepRetryAttemptArchiveRequestCreated
      ? 'execution run step retry attempt archive request created yes'
      : 'execution run step retry attempt archive request created no',
    `execution run step retry attempt archive request fingerprint ${request.executionRunStepRetryAttemptArchiveRequestFingerprint}`,
    request.executionRunStepRetryAttemptArchiveRequestInputs.length
      ? `execution run step retry attempt archive request inputs ${request.executionRunStepRetryAttemptArchiveRequestInputs.join(
          ', '
        )}`
      : 'execution run step retry attempt archive request inputs none',
    `execution failure event request ${request.executionFailureEventRequestVersion}`,
    `execution failure event request status ${formatFeatureKind(
      request.executionFailureEventRequestStatus
    )}`,
    request.executionFailureEventRequestCreated
      ? 'execution failure event request created yes'
      : 'execution failure event request created no',
    `execution failure event request fingerprint ${request.executionFailureEventRequestFingerprint}`,
    request.executionFailureEventRequestInputs.length
      ? `execution failure event request inputs ${request.executionFailureEventRequestInputs.join(
          ', '
        )}`
      : 'execution failure event request inputs none',
    `execution provider response request ${request.executionProviderResponseRequestVersion}`,
    `execution provider response request status ${formatFeatureKind(
      request.executionProviderResponseRequestStatus
    )}`,
    request.executionProviderResponseRequestCreated
      ? 'execution provider response request created yes'
      : 'execution provider response request created no',
    `execution provider response request fingerprint ${request.executionProviderResponseRequestFingerprint}`,
    request.executionProviderResponseRequestInputs.length
      ? `execution provider response request inputs ${request.executionProviderResponseRequestInputs.join(
          ', '
        )}`
      : 'execution provider response request inputs none',
    `execution result request ${request.executionResultRequestVersion}`,
    `execution result request status ${formatFeatureKind(
      request.executionResultRequestStatus
    )}`,
    request.executionResultRequestCreated
      ? 'execution result request created yes'
      : 'execution result request created no',
    `execution result request fingerprint ${request.executionResultRequestFingerprint}`,
    request.executionResultRequestInputs.length
      ? `execution result request inputs ${request.executionResultRequestInputs.join(
          ', '
        )}`
      : 'execution result request inputs none',
    `execution retry policy request ${request.executionRetryPolicyRequestVersion}`,
    `execution retry policy request status ${formatFeatureKind(
      request.executionRetryPolicyRequestStatus
    )}`,
    request.executionRetryPolicyRequestCreated
      ? 'execution retry policy request created yes'
      : 'execution retry policy request created no',
    `execution retry policy request fingerprint ${request.executionRetryPolicyRequestFingerprint}`,
    request.executionRetryPolicyRequestInputs.length
      ? `execution retry policy request inputs ${request.executionRetryPolicyRequestInputs.join(
          ', '
        )}`
      : 'execution retry policy request inputs none',
    `execution rollback executor request ${request.executionRollbackExecutorRequestVersion}`,
    `execution rollback executor request status ${formatFeatureKind(
      request.executionRollbackExecutorRequestStatus
    )}`,
    request.executionRollbackExecutorRequestCreated
      ? 'execution rollback executor request created yes'
      : 'execution rollback executor request created no',
    `execution rollback executor request fingerprint ${request.executionRollbackExecutorRequestFingerprint}`,
    request.executionRollbackExecutorRequestInputs.length
      ? `execution rollback executor request inputs ${request.executionRollbackExecutorRequestInputs.join(
          ', '
        )}`
      : 'execution rollback executor request inputs none',
    `execution rollback operation request ${request.executionRollbackOperationRequestVersion}`,
    `execution rollback operation request status ${formatFeatureKind(
      request.executionRollbackOperationRequestStatus
    )}`,
    request.executionRollbackOperationRequestCreated
      ? 'execution rollback operation request created yes'
      : 'execution rollback operation request created no',
    `execution rollback operation request fingerprint ${request.executionRollbackOperationRequestFingerprint}`,
    request.executionRollbackOperationRequestInputs.length
      ? `execution rollback operation request inputs ${request.executionRollbackOperationRequestInputs.join(
          ', '
        )}`
      : 'execution rollback operation request inputs none',
    `execution rollback outcome request ${request.executionRollbackOutcomeRequestVersion}`,
    `execution rollback outcome request status ${formatFeatureKind(
      request.executionRollbackOutcomeRequestStatus
    )}`,
    request.executionRollbackOutcomeRequestCreated
      ? 'execution rollback outcome request created yes'
      : 'execution rollback outcome request created no',
    `execution rollback outcome request fingerprint ${request.executionRollbackOutcomeRequestFingerprint}`,
    request.executionRollbackOutcomeRequestInputs.length
      ? `execution rollback outcome request inputs ${request.executionRollbackOutcomeRequestInputs.join(
          ', '
        )}`
      : 'execution rollback outcome request inputs none',
    `execution rollback trigger request ${request.executionRollbackTriggerRequestVersion}`,
    `execution rollback trigger request status ${formatFeatureKind(
      request.executionRollbackTriggerRequestStatus
    )}`,
    request.executionRollbackTriggerRequestCreated
      ? 'execution rollback trigger request created yes'
      : 'execution rollback trigger request created no',
    `execution rollback trigger request fingerprint ${request.executionRollbackTriggerRequestFingerprint}`,
    request.executionRollbackTriggerRequestInputs.length
      ? `execution rollback trigger request inputs ${request.executionRollbackTriggerRequestInputs.join(
          ', '
        )}`
      : 'execution rollback trigger request inputs none',
    `execution trace request ${request.executionTraceRequestVersion}`,
    `execution trace request status ${formatFeatureKind(
      request.executionTraceRequestStatus
    )}`,
    request.executionTraceRequestCreated
      ? 'execution trace request created yes'
      : 'execution trace request created no',
    `execution trace request fingerprint ${request.executionTraceRequestFingerprint}`,
    request.executionTraceRequestInputs.length
      ? `execution trace request inputs ${request.executionTraceRequestInputs.join(
          ', '
        )}`
      : 'execution trace request inputs none',
    `execution state request ${request.executionStateRequestVersion}`,
    `execution state request status ${formatFeatureKind(
      request.executionStateRequestStatus
    )}`,
    request.executionStateRequestCreated
      ? 'execution state request created yes'
      : 'execution state request created no',
    `execution state request fingerprint ${request.executionStateRequestFingerprint}`,
    request.executionStateRequestInputs.length
      ? `execution state request inputs ${request.executionStateRequestInputs.join(
          ', '
        )}`
      : 'execution state request inputs none',
    `rollback plan request ${request.rollbackPlanRequestVersion}`,
    `rollback plan request status ${formatFeatureKind(
      request.rollbackPlanRequestStatus
    )}`,
    request.rollbackPlanRequestCreated
      ? 'rollback plan request created yes'
      : 'rollback plan request created no',
    `rollback plan request fingerprint ${request.rollbackPlanRequestFingerprint}`,
    request.rollbackPlanRequestInputs.length
      ? `rollback plan request inputs ${request.rollbackPlanRequestInputs.join(
          ', '
        )}`
      : 'rollback plan request inputs none',
    `repair job request ${request.repairJobRequestVersion}`,
    `repair job request status ${formatFeatureKind(
      request.repairJobRequestStatus
    )}`,
    request.repairJobRequestCreated
      ? 'repair job request created yes'
      : 'repair job request created no',
    `repair job request fingerprint ${request.repairJobRequestFingerprint}`,
    request.repairJobRequestInputs.length
      ? `repair job request inputs ${request.repairJobRequestInputs.join(', ')}`
      : 'repair job request inputs none',
    `idempotency lock ${request.idempotencyLockVersion}`,
    `idempotency lock status ${formatFeatureKind(
      request.idempotencyLockStatus
    )}`,
    `idempotency lock scope ${formatFeatureKind(request.idempotencyLockScope)}`,
    request.idempotencyLockAcquired
      ? 'idempotency lock acquired yes'
      : 'idempotency lock acquired no',
    `idempotency lock fingerprint ${request.idempotencyLockFingerprint}`,
    request.idempotencyLockInputs.length
      ? `idempotency lock inputs ${request.idempotencyLockInputs.join(', ')}`
      : 'idempotency lock inputs none',
    `fingerprint ${request.requestFingerprint}`,
    request.requestInputs.length
      ? `inputs ${request.requestInputs.join(', ')}`
      : 'inputs none',
    request.matchedFields.length
      ? `matched fields ${request.matchedFields.join(', ')}`
      : 'matched fields none',
    request.mismatchedFields.length
      ? `mismatched fields ${request.mismatchedFields.join(', ')}`
      : 'mismatched fields none',
    `preflight status ${formatFeatureKind(request.preflight.status)}`,
    `preflight execution gate status ${formatFeatureKind(
      request.preflight.executionGateStatus
    )}`,
    `preflight execution gate fingerprint ${request.preflight.executionGateFingerprint}`,
    `preflight approval record fingerprint ${request.preflight.approvalRecordFingerprint}`,
    `preflight approval request fingerprint ${request.preflight.approvalRequestFingerprint}`,
    `preflight audit event fingerprint ${request.preflight.auditEventFingerprint}`,
    `preflight candidate evidence set fingerprint ${request.preflight.candidateEvidenceSetFingerprint}`,
    `preflight task route source evidence set fingerprint ${request.preflight.taskRouteEffectiveSourceEvidenceSetFingerprint}`,
    `preflight task route source evidence set version ${request.preflight.taskRouteEffectiveSourceEvidenceSetFingerprintVersion}`,
    request.preflight.taskRouteEffectiveSourceEvidenceSetFingerprintInputs
      .length
      ? `preflight task route source evidence set inputs ${request.preflight.taskRouteEffectiveSourceEvidenceSetFingerprintInputs.join(', ')}`
      : 'preflight task route source evidence set inputs none',
    `preflight embedding index contract evidence set fingerprint ${request.preflight.embeddingIndexContractEvidenceSetFingerprint}`,
    `preflight rerank runtime contract evidence set fingerprint ${request.preflight.rerankRuntimeContractEvidenceSetFingerprint}`,
    `preflight prepared route order evidence set fingerprint ${request.preflight.preparedRouteOrderEvidenceSetFingerprint}`,
    `preflight expected task route source evidence set fingerprint ${request.preflight.expectedTaskRouteEffectiveSourceEvidenceSetFingerprint}`,
    `preflight expected task route source evidence set version ${request.preflight.expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion}`,
    request.preflight
      .expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs.length
      ? `preflight expected task route source evidence set inputs ${request.preflight.expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs.join(', ')}`
      : 'preflight expected task route source evidence set inputs none',
    `preflight expected embedding index contract evidence set fingerprint ${request.preflight.expectedEmbeddingIndexContractEvidenceSetFingerprint}`,
    `preflight expected rerank runtime contract evidence set fingerprint ${request.preflight.expectedRerankRuntimeContractEvidenceSetFingerprint}`,
    `preflight expected prepared route order evidence set fingerprint ${request.preflight.expectedPreparedRouteOrderEvidenceSetFingerprint}`,
    `preflight execution state fingerprint ${request.preflight.executionStateFingerprint}`,
    `preflight idempotency fingerprint ${request.preflight.idempotencyFingerprint}`,
    `preflight policy binding fingerprint ${request.preflight.policyBindingFingerprint}`,
    `preflight repair job fingerprint ${request.preflight.repairJobFingerprint}`,
    `preflight review binding fingerprint ${request.preflight.reviewBindingFingerprint}`,
    `preflight rollback plan fingerprint ${request.preflight.rollbackPlanFingerprint}`,
    request.preflight.workspaceId
      ? `preflight workspace ${request.preflight.workspaceId}`
      : 'preflight workspace none',
  ]);
}

function formatRepairExecutionRecord(
  record:
    | RepairExecutionRecord
    | NonNullable<PromptRegistryRepairExecutionRequest['executionRecord']>
) {
  const formatAuditEvent = (event: RepairExecutionAuditEvent) =>
    `${formatFeatureKind(event.eventType)}:${event.eventFingerprint}`;

  return compactList([
    record.id,
    `status ${formatFeatureKind(record.status)}`,
    `approval ${formatFeatureKind(record.approvalState)}`,
    `idempotency ${record.idempotencyKey}`,
    `audit events ${record.auditEventCount}`,
    record.auditEvents.length
      ? `audit history ${record.auditEvents.map(formatAuditEvent).join(' | ')}`
      : null,
    `executor ${record.runtimeResult.executor}`,
    record.runtimeResult.sideEffectsApplied
      ? 'side effects yes'
      : 'side effects no',
    `side effect ledger ${record.sideEffectCount}`,
    record.sideEffects.length
      ? `side effect history ${record.sideEffects
          .map(
            sideEffect =>
              `${formatFeatureKind(sideEffect.sideEffectKind)}:${sideEffect.sideEffectRecordId}:attempt ${sideEffect.workerAttempt}:${sideEffect.sideEffectFingerprint}`
          )
          .join(' | ')}`
      : null,
    record.runtimeResult.sideEffectKind
      ? `side effect ${formatFeatureKind(record.runtimeResult.sideEffectKind)}`
      : null,
    record.runtimeResult.sideEffectRecordId
      ? `side effect record ${record.runtimeResult.sideEffectRecordId}`
      : null,
    record.runtimeResult.sideEffectFingerprint
      ? `side effect fingerprint ${record.runtimeResult.sideEffectFingerprint}`
      : null,
    record.queuedAt ? `queued ${record.queuedAt}` : null,
    `worker attempt ${record.workerAttempt}/${record.workerMaxAttempts}`,
    record.lastAttemptAt ? `last attempt ${record.lastAttemptAt}` : null,
    record.workerLeaseId ? `worker lease ${record.workerLeaseId}` : null,
    record.workerLeaseExpiresAt
      ? `worker lease expires ${record.workerLeaseExpiresAt}`
      : null,
    record.completedAt ? `completed ${record.completedAt}` : null,
  ]);
}

function buildRepairExecutionListFilter(input: {
  status: RepairExecutionStatusFilter;
  query: string;
}) {
  const filter: {
    query?: string;
    status?: string;
  } = {};
  if (input.status !== REPAIR_EXECUTION_ALL_STATUSES) {
    filter.status = input.status;
  }
  const query = input.query.trim();
  if (query) {
    filter.query = /^[a-f0-9]{16}$/i.test(query) ? query.toLowerCase() : query;
  }
  return Object.keys(filter).length ? filter : undefined;
}

function formatPromptRegistryPublishGateRepairActionPreviewOperation(
  operation: PromptRegistryPublishGateVerdict['repairActionPreview']['operations'][number]
) {
  return compactList([
    formatFeatureKind(operation.previewStatus),
    `action kind ${formatFeatureKind(operation.actionKind)}`,
    `review ${formatFeatureKind(operation.reviewMode)}`,
    `safety ${formatFeatureKind(operation.safety)}`,
    formatFeatureKind(operation.category),
    operation.code,
    operation.target,
    operation.instanceKey ? `instance ${operation.instanceKey}` : null,
    `candidate evidence ${operation.candidateEvidenceCount}`,
    `candidate evidence fingerprint ${operation.candidateEvidenceFingerprint}`,
    operation.candidateEvidenceFingerprints.length
      ? `candidate evidence fingerprints ${operation.candidateEvidenceFingerprints.join(', ')}`
      : 'candidate evidence fingerprints none',
    operation.candidateEvidenceKeys.length
      ? `candidate evidence keys ${operation.candidateEvidenceKeys.join(', ')}`
      : 'candidate evidence keys none',
    operation.preparedRouteOrderFingerprints.length
      ? `prepared route order fingerprints ${operation.preparedRouteOrderFingerprints.join(', ')}`
      : 'prepared route order fingerprints none',
    operation.embeddingIndexContractEvidenceFingerprints.length
      ? `embedding index contract evidence fingerprints ${operation.embeddingIndexContractEvidenceFingerprints.join(', ')}`
      : 'embedding index contract evidence fingerprints none',
    operation.rerankRuntimeContractEvidenceFingerprints.length
      ? `rerank runtime contract evidence fingerprints ${operation.rerankRuntimeContractEvidenceFingerprints.join(', ')}`
      : 'rerank runtime contract evidence fingerprints none',
    operation.taskRouteEffectiveSourceFingerprints.length
      ? `task route source fingerprints ${operation.taskRouteEffectiveSourceFingerprints.join(', ')}`
      : 'task route source fingerprints none',
    `fingerprint ${operation.diagnosticsFingerprint}`,
    `operation fingerprint ${operation.operationFingerprint}`,
    `target locator fingerprint ${operation.targetLocatorFingerprint}`,
    operation.requiredCapabilities.length
      ? `required capabilities ${operation.requiredCapabilities.join(', ')}`
      : 'required capabilities none',
    `input schema ${formatRepairRecommendationInputSchema(
      operation.inputSchema
    )}`,
    operation.targetLocator
      ? `locator ${formatPromptRegistryPublishGateRepairTargetLocator(
          operation.targetLocator
        )}`
      : null,
  ]);
}

function formatRepairRecommendationInputSchema(schema: unknown) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return 'unknown';
  }
  const required = (schema as { required?: unknown }).required;
  return Array.isArray(required) && required.length
    ? `required ${required.join(', ')}`
    : 'no required fields';
}

function formatPromptRegistryPublishGateRepairTargetLocator(
  locator: PromptRegistryPublishGateRepairTargetLocatorLike
) {
  const providerProfileLabel = formatAIModelProviderProfileLabel({
    providerConfiguredModelCount: null,
    providerConfiguredModelIds: null,
    providerProfileConfigPath: locator.providerProfileConfigPath,
    providerProfileId: locator.providerProfileId,
    providerProfileSource: locator.providerProfileSource,
  });

  return compactList([
    locator.kind,
    locator.path,
    `registry ${locator.registryId}`,
    `fingerprint ${locator.registryFingerprint}`,
    `updated ${locator.registryUpdatedAt}`,
    locator.featureKind
      ? `feature ${formatFeatureKind(locator.featureKind)}`
      : null,
    locator.outputType
      ? `output ${formatFeatureKind(locator.outputType)}`
      : null,
    locator.candidateKind != null && locator.candidateIndex != null
      ? `candidate ${formatFeatureKind(locator.candidateKind)}#${locator.candidateIndex}`
      : null,
    locator.requestedModelId ? `requested ${locator.requestedModelId}` : null,
    locator.requestedModelConfigKey
      ? `config key ${locator.requestedModelConfigKey}`
      : null,
    locator.requestedModelConfigPath
      ? `config path ${locator.requestedModelConfigPath}`
      : null,
    locator.providerId ? `provider ${locator.providerId}` : null,
    providerProfileLabel ? `profile ${providerProfileLabel}` : null,
    locator.actionId ? `action ${locator.actionId}` : null,
    locator.stepId ? `step ${locator.stepId}` : null,
    locator.routeIndex != null ? `route #${locator.routeIndex + 1}` : null,
    locator.fallbackOrderIndex != null
      ? `fallback #${locator.fallbackOrderIndex + 1}`
      : null,
    locator.status ? `status ${formatFeatureKind(locator.status)}` : null,
  ]);
}

function formatPromptRegistryPublishGateModelRoute(
  route: PromptRegistryPublishGateModelRoute
) {
  return compactList([
    route.available ? 'Available' : 'Unavailable',
    `candidate ${formatFeatureKind(route.candidateKind)}#${route.candidateIndex}`,
    route.candidateConfigPath ? `config ${route.candidateConfigPath}` : null,
    route.checked ? 'checked yes' : 'checked no',
    route.configured ? 'configured yes' : 'configured no',
    route.diagnosticsErrorStage
      ? `diagnostics stage ${formatFeatureKind(route.diagnosticsErrorStage)}`
      : null,
    route.diagnosticsErrorCode
      ? `diagnostics code ${formatFeatureKind(route.diagnosticsErrorCode)}`
      : null,
    route.diagnosticsErrorMessage
      ? `diagnostics message ${route.diagnosticsErrorMessage}`
      : null,
    route.effectiveSourceFingerprint
      ? `source fingerprint ${route.effectiveSourceFingerprint}`
      : null,
    route.effectiveSourceFingerprintVersion
      ? `source version ${route.effectiveSourceFingerprintVersion}`
      : null,
    route.effectiveSourceFingerprintInputs?.length
      ? `source inputs ${route.effectiveSourceFingerprintInputs.join(', ')}`
      : null,
    `feature ${formatFeatureKind(route.featureKind)}`,
    `output ${formatFeatureKind(route.outputType)}`,
    route.requestedModelId ? `requested ${route.requestedModelId}` : null,
    route.requestedModelSource
      ? `source ${formatAIModelTaskModelSourceLabel(route.requestedModelSource)}`
      : null,
    route.providerId ? `provider ${route.providerId}` : null,
    route.providerName ? `provider name ${route.providerName}` : null,
    route.providerSource
      ? `provider source ${formatFeatureKind(route.providerSource)}`
      : null,
    route.providerType
      ? `provider type ${formatProviderMetadata(route.providerType, PROVIDER_TYPE_LABELS)}`
      : null,
    route.providerPrivacy
      ? `provider privacy ${formatProviderMetadata(route.providerPrivacy, PROVIDER_PRIVACY_LABELS)}`
      : null,
    route.providerHealth
      ? `provider health ${formatProviderMetadata(route.providerHealth, PROVIDER_HEALTH_LABELS)}`
      : null,
    route.providerHealthCheckedAt
      ? `provider checked ${route.providerHealthCheckedAt}`
      : null,
    route.providerHealthLastError
      ? `provider error ${route.providerHealthLastError}`
      : null,
    route.providerPriority != null
      ? `provider priority ${route.providerPriority}`
      : null,
    route.providerProfileId ? `profile ${route.providerProfileId}` : null,
    route.providerProfileSource
      ? `profile source ${formatFeatureKind(route.providerProfileSource)}`
      : null,
    route.providerProfileConfigPath
      ? `profile config ${route.providerProfileConfigPath}`
      : null,
    route.providerConfiguredModelIds?.length
      ? `profile models ${route.providerConfiguredModelIds.join(', ')}`
      : null,
    route.providerConfiguredModelCount != null
      ? `profile model count ${route.providerConfiguredModelCount}`
      : null,
    route.modelId ? `model ${route.modelId}` : null,
    route.fallbackProviderIds.length
      ? `fallback ${route.fallbackProviderIds.join(' -> ')}`
      : null,
    route.protocol ? `protocol ${route.protocol}` : null,
    route.requestLayer ? `layer ${route.requestLayer}` : null,
    route.modelBackendKind ? `backend ${route.modelBackendKind}` : null,
    route.canonicalModelKey ? `canonical ${route.canonicalModelKey}` : null,
    route.behaviorFlags?.length
      ? `flags ${route.behaviorFlags.join(', ')}`
      : null,
    route.routeModelDefinitionSource
      ? `definition source ${formatFeatureKind(route.routeModelDefinitionSource)}`
      : null,
    route.routeModelDefinitionId
      ? `definition ${route.routeModelDefinitionId}`
      : null,
    route.routeRawModelId ? `raw ${route.routeRawModelId}` : null,
    route.routeModelDefinitionAliases?.length
      ? `aliases ${route.routeModelDefinitionAliases.join(', ')}`
      : null,
    route.routeModelAliasMatched ? 'alias matched' : null,
    `candidates ${route.candidateCount}`,
    `matched ${route.matchedCandidateCount}`,
    route.policyEnabled ? 'policy enabled' : 'policy disabled',
    route.policyFeatureKind
      ? `policy feature ${formatFeatureKind(route.policyFeatureKind)}`
      : null,
    route.policyWorkspaceId ? `workspace ${route.policyWorkspaceId}` : null,
    route.policyAllowedProviderIds?.length
      ? `allowed providers ${route.policyAllowedProviderIds.join(', ')}`
      : null,
    route.policyBlockedProviderIds?.length
      ? `blocked providers ${route.policyBlockedProviderIds.join(', ')}`
      : null,
    route.policyAllowedPrivacy?.length
      ? `allowed privacy ${route.policyAllowedPrivacy
          .map(value => formatProviderMetadata(value, PROVIDER_PRIVACY_LABELS))
          .join(', ')}`
      : null,
    route.policyPreferredPrivacy?.length
      ? `preferred privacy ${route.policyPreferredPrivacy
          .map(value => formatProviderMetadata(value, PROVIDER_PRIVACY_LABELS))
          .join(', ')}`
      : null,
    route.reasons.length
      ? `reasons ${route.reasons.map(formatFeatureKind).join(', ')}`
      : 'reasons none',
  ]);
}

function buildPromptCatalogDiagnosticsText(prompt: PromptCatalogItem) {
  return [
    `Prompt ${formatAIModelPromptDisplayName(prompt.name)}`,
    `Action ${prompt.action || 'None'}`,
    `Category ${formatFeatureKind(prompt.category)}`,
    `Source ${formatFeatureKind(prompt.source)}`,
    `Revision ${prompt.revision}`,
    `Fingerprint ${prompt.fingerprint}`,
    `Model strategy fingerprint ${prompt.modelStrategyFingerprint}`,
    `Template fingerprint ${prompt.templateFingerprint}`,
    `Version evidence ${buildPromptCatalogVersionEvidence(prompt)}`,
    `Override ${prompt.overrideApplied ? 'yes' : 'no'}`,
    `Default policy ${
      prompt.defaultPolicy ? formatFeatureKind(prompt.defaultPolicy) : 'None'
    }`,
    `Default model ${prompt.model}`,
    `Default model source ${formatFeatureKind(prompt.modelSource)}`,
    prompt.modelConfigPath
      ? `Default model config ${prompt.modelConfigPath}`
      : null,
    `Optional models ${prompt.optionalModelCount}${
      prompt.optionalModels.length
        ? ` / ${prompt.optionalModels.join(' -> ')}`
        : ''
    }`,
    `Optional models source ${formatFeatureKind(prompt.optionalModelsSource)}`,
    prompt.optionalModelsConfigPath
      ? `Optional models config ${prompt.optionalModelsConfigPath}`
      : null,
    `Pro models ${prompt.proModelCount}`,
    `Pro models source ${formatFeatureKind(prompt.proModelsSource)}`,
    prompt.proModelsConfigPath
      ? `Pro models config ${prompt.proModelsConfigPath}`
      : null,
    prompt.registryId != null ? `Registry id ${prompt.registryId}` : null,
    prompt.registryMessageCount != null
      ? `Registry messages ${prompt.registryMessageCount}`
      : null,
    prompt.registryModified != null
      ? `Registry modified ${prompt.registryModified ? 'yes' : 'no'}`
      : null,
    prompt.registryUpdatedAt
      ? `Registry updated ${prompt.registryUpdatedAt}`
      : null,
    prompt.registryFingerprint
      ? `Registry fingerprint ${prompt.registryFingerprint}`
      : null,
    prompt.registryValidationStatus
      ? `Registry status ${formatFeatureKind(prompt.registryValidationStatus)}`
      : null,
    prompt.registryValidationReason
      ? `Registry reason ${formatFeatureKind(prompt.registryValidationReason)}`
      : null,
    prompt.registryValidationDetail
      ? `Registry detail ${prompt.registryValidationDetail}`
      : null,
    prompt.registryValidationPublishStatus
      ? `Registry publish ${formatFeatureKind(prompt.registryValidationPublishStatus)}`
      : null,
    prompt.registryValidationBlockingCount != null
      ? `Registry blocking ${prompt.registryValidationBlockingCount}`
      : null,
    prompt.registryValidationIssueCount != null
      ? `Registry issues ${prompt.registryValidationIssueCount}`
      : null,
    prompt.registryValidationErrorCount != null
      ? `Registry errors ${prompt.registryValidationErrorCount}`
      : null,
    ...(prompt.registryValidationIssues ?? []).map(
      issue => `Registry issue ${formatPromptRegistryValidationIssue(issue)}`
    ),
    ...(prompt.registryValidationRemediations ?? []).map(
      remediation =>
        `Registry remediation ${formatPromptRegistryValidationRemediation(remediation)}`
    ),
    prompt.registryRecordSource
      ? `Registry source ${formatFeatureKind(prompt.registryRecordSource)}`
      : null,
    prompt.registryRevision
      ? `Registry revision ${prompt.registryRevision}`
      : null,
    prompt.registryRevisionId
      ? `Registry revision id ${prompt.registryRevisionId}`
      : null,
    prompt.registryRevisionPublishEventCount != null
      ? `Registry revision publish events ${prompt.registryRevisionPublishEventCount}`
      : null,
    ...(prompt.registryRevisionPublishEvents ?? []).map(
      event =>
        `Registry revision publish event ${formatRegistryRevisionPublishEvent(event)}`
    ),
    prompt.registryRevisionScope
      ? `Registry revision scope ${formatFeatureKind(prompt.registryRevisionScope)}`
      : null,
    prompt.registryRevisionWorkspaceId
      ? `Registry revision workspace ${prompt.registryRevisionWorkspaceId}`
      : null,
    prompt.registryRevisionActorId
      ? `Registry revision actor ${prompt.registryRevisionActorId}`
      : null,
    prompt.registryRevisionFingerprint
      ? `Registry revision fingerprint ${prompt.registryRevisionFingerprint}`
      : null,
    prompt.registryRevisionStatus
      ? `Registry revision status ${formatFeatureKind(prompt.registryRevisionStatus)}`
      : null,
    prompt.registrySourceChainFingerprint
      ? `Registry source chain fingerprint ${prompt.registrySourceChainFingerprint}`
      : null,
    ...(prompt.registrySourceChain ?? []).map(
      entry => `Registry source chain ${formatPromptRegistrySourceChain(entry)}`
    ),
    `Params ${prompt.paramCount}${
      prompt.paramKeys.length ? ` / ${prompt.paramKeys.join(', ')}` : ''
    }`,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

function PromptCatalogSourceSummary({
  configPath,
  source,
}: {
  configPath?: string | null;
  source: string;
}) {
  return (
    <div className="mt-1 space-y-0.5 break-words text-xs text-muted-foreground">
      <div>Source {formatFeatureKind(source)}</div>
      {configPath ? <div>Config {configPath}</div> : null}
    </div>
  );
}

function ActionRunTraceRoutes({
  routes,
}: {
  routes: ActionRunPreparedRouteTrace['steps'][number]['routes'];
}) {
  if (!routes.length) {
    return <span className="text-muted-foreground">No routes</span>;
  }

  return (
    <div className="space-y-1">
      {routes.map(route => (
        <div
          key={`${route.routeIndex}:${route.providerId}:${route.modelId}`}
          className="min-w-0"
        >
          <div className="break-words font-medium">
            {route.providerId}/{route.modelId}
          </div>
          <div className="break-words text-xs text-muted-foreground">
            {compactList([
              `Route #${route.routeIndex + 1}`,
              route.fallbackOrderIndex != null
                ? `Fallback #${route.fallbackOrderIndex + 1}`
                : null,
              route.protocol ? `Protocol ${route.protocol}` : null,
              route.requestLayer ? `Layer ${route.requestLayer}` : null,
            ]) || 'No protocol metadata'}
          </div>
          <div className="break-words text-xs text-muted-foreground">
            {compactList([
              route.providerName ? `Provider ${route.providerName}` : null,
              route.providerType
                ? `Type ${formatProviderMetadata(route.providerType, PROVIDER_TYPE_LABELS)}`
                : null,
              route.providerSource
                ? `Source ${formatProviderMetadata(
                    route.providerSource,
                    PROVIDER_SOURCE_LABELS
                  )}`
                : null,
              route.providerPrivacy
                ? `Privacy ${formatProviderMetadata(
                    route.providerPrivacy,
                    PROVIDER_PRIVACY_LABELS
                  )}`
                : null,
              route.providerHealth
                ? `Health ${formatProviderMetadata(
                    route.providerHealth,
                    PROVIDER_HEALTH_LABELS
                  )}`
                : null,
              route.providerPriority != null
                ? `Priority ${route.providerPriority}`
                : null,
            ]) || 'No provider metadata'}
          </div>
          {route.providerProfileId ||
          route.providerProfileConfigPath ||
          route.providerConfiguredModelIds?.length ? (
            <div className="break-words text-xs text-muted-foreground">
              {compactList([
                route.providerProfileId
                  ? `Profile ${route.providerProfileId}`
                  : null,
                route.providerProfileSource
                  ? `Profile source ${formatProviderMetadata(
                      route.providerProfileSource,
                      PROVIDER_SOURCE_LABELS
                    )}`
                  : null,
                route.providerProfileConfigPath
                  ? `Config ${route.providerProfileConfigPath}`
                  : null,
                route.providerConfiguredModelIds?.length
                  ? `Profile models ${route.providerConfiguredModelIds.join(', ')}`
                  : null,
                route.providerConfiguredModelCount != null
                  ? `Profile model count ${route.providerConfiguredModelCount}`
                  : null,
              ])}
            </div>
          ) : null}
          {route.routeModelDefinitionId ||
          route.routeRawModelId ||
          route.modelBackendKind ||
          route.canonicalModelKey ||
          route.behaviorFlags?.length ||
          route.routeModelDefinitionAliases?.length ? (
            <div className="break-words text-xs text-muted-foreground">
              Definition{' '}
              {formatAIModelDefinitionLabel({
                routeBackendKind: route.modelBackendKind,
                routeBehaviorFlags: route.behaviorFlags,
                routeCanonicalModelKey: route.canonicalModelKey,
                routeModelAliasMatched: route.routeModelAliasMatched,
                routeModelDefinitionAliases: route.routeModelDefinitionAliases,
                routeModelDefinitionId: route.routeModelDefinitionId,
                routeModelDefinitionSource: route.routeModelDefinitionSource,
                routeProtocol: route.protocol,
                routeRawModelId: route.routeRawModelId,
                routeRequestLayer: route.requestLayer,
              })}
            </div>
          ) : null}
          {route.requestedDimensions != null ||
          route.modelEmbeddingDimensions != null ||
          route.dimensionMismatch != null ? (
            <div className="break-words text-xs text-muted-foreground">
              Dimensions{' '}
              {formatDimensionEvidenceLabel(route, {
                includeNegativeMismatch: true,
              })}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function formatPreparedRouteTraceRoute(route: {
  behaviorFlags?: string[] | null;
  canonicalModelKey?: string | null;
  dimensionMismatch?: boolean | null;
  fallbackOrderIndex?: number | null;
  modelId: string;
  modelBackendKind?: string | null;
  modelEmbeddingDimensions?: number | null;
  protocol?: string | null;
  providerConfiguredModelCount?: number | null;
  providerConfiguredModelIds?: string[] | null;
  providerHealth?: string | null;
  providerHealthCheckedAt?: string | null;
  providerHealthLastError?: string | null;
  providerId: string;
  providerName?: string | null;
  providerPrivacy?: string | null;
  providerPriority?: number | null;
  providerProfileConfigPath?: string | null;
  providerProfileId?: string | null;
  providerProfileSource?: string | null;
  providerSource?: string | null;
  providerType?: string | null;
  requestLayer?: string | null;
  requestedDimensions?: number | null;
  routeIndex: number;
  routeModelAliasMatched?: boolean | null;
  routeModelDefinitionAliases?: string[] | null;
  routeModelDefinitionId?: string | null;
  routeModelDefinitionSource?: string | null;
  routeRawModelId?: string | null;
}) {
  const providerProfileLabel = formatAIModelProviderProfileLabel({
    providerConfiguredModelCount: route.providerConfiguredModelCount,
    providerConfiguredModelIds: route.providerConfiguredModelIds,
    providerProfileConfigPath: route.providerProfileConfigPath,
    providerProfileId: route.providerProfileId,
    providerProfileSource: route.providerProfileSource,
  });

  return compactList([
    `${route.providerId}/${route.modelId}`,
    `route #${route.routeIndex + 1}`,
    route.fallbackOrderIndex != null
      ? `fallback #${route.fallbackOrderIndex + 1}`
      : null,
    route.protocol ? `protocol ${route.protocol}` : null,
    route.requestLayer ? `layer ${route.requestLayer}` : null,
    route.modelBackendKind ? `backend ${route.modelBackendKind}` : null,
    route.canonicalModelKey ? `canonical ${route.canonicalModelKey}` : null,
    route.behaviorFlags?.length
      ? `behavior ${route.behaviorFlags.join(', ')}`
      : null,
    route.requestedDimensions != null ||
    route.modelEmbeddingDimensions != null ||
    route.dimensionMismatch != null
      ? `dimensions ${formatDimensionEvidenceLabel(route, {
          includeNegativeMismatch: true,
        })}`
      : null,
    route.providerName ? `provider name ${route.providerName}` : null,
    route.providerType
      ? `provider type ${formatProviderMetadata(route.providerType, PROVIDER_TYPE_LABELS)}`
      : null,
    route.providerSource
      ? `provider source ${formatProviderMetadata(route.providerSource, PROVIDER_SOURCE_LABELS)}`
      : null,
    providerProfileLabel ? `profile ${providerProfileLabel}` : null,
    route.providerPrivacy
      ? `provider privacy ${formatProviderMetadata(route.providerPrivacy, PROVIDER_PRIVACY_LABELS)}`
      : null,
    route.providerHealth
      ? `provider health ${formatProviderMetadata(route.providerHealth, PROVIDER_HEALTH_LABELS)}`
      : null,
    route.providerHealthCheckedAt
      ? `provider checked ${route.providerHealthCheckedAt}`
      : null,
    route.providerHealthLastError
      ? `provider error ${route.providerHealthLastError}`
      : null,
    route.providerPriority != null
      ? `provider priority ${route.providerPriority}`
      : null,
    formatAIModelDefinitionLabel({
      routeBackendKind: route.modelBackendKind,
      routeBehaviorFlags: route.behaviorFlags,
      routeCanonicalModelKey: route.canonicalModelKey,
      routeModelAliasMatched: route.routeModelAliasMatched,
      routeModelDefinitionAliases: route.routeModelDefinitionAliases,
      routeModelDefinitionId: route.routeModelDefinitionId,
      routeModelDefinitionSource: route.routeModelDefinitionSource,
      routeProtocol: route.protocol,
      routeRawModelId: route.routeRawModelId,
      routeRequestLayer: route.requestLayer,
    }),
  ]);
}

function formatActionRunTraceRoute(
  route: ActionRunPreparedRouteTrace['steps'][number]['routes'][number]
) {
  return formatPreparedRouteTraceRoute(route);
}

function buildActionRunTraceDiagnosticsText(
  runId: string,
  trace: ActionRunPreparedRouteTrace
) {
  return [
    `Action run ${runId}`,
    `Trace ${trace.type}`,
    `Status ${formatFeatureKind(trace.status)}`,
    `Steps ${trace.steps.length}`,
    ...trace.steps.flatMap(step => [
      `Step ${step.stepId}`,
      `Kind ${formatFeatureKind(step.kind)}`,
      `Routes ${step.actualRouteCount}/${step.routeCount}`,
      step.routeCountMismatch
        ? `Route count mismatch expected ${step.routeCount} actual ${step.actualRouteCount}`
        : null,
      step.requestedModelId ? `Requested ${step.requestedModelId}` : null,
      step.requestedModelSource
        ? `Source ${formatFeatureKind(step.requestedModelSource)}`
        : null,
      step.fallbackProviderIds.length
        ? `Fallback ${step.fallbackProviderIds.join(' -> ')}`
        : 'Fallback none',
      ...step.routes.map(route => `Route ${formatActionRunTraceRoute(route)}`),
    ]),
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

function ActionRunTraceResult({
  runId,
  trace,
}: {
  runId: string;
  trace: ActionRunPreparedRouteTrace | null | undefined;
}) {
  if (!trace) {
    return (
      <EmptyState>
        No prepared route trace returned for action run {runId}.
      </EmptyState>
    );
  }

  if (!trace.steps.length) {
    return <EmptyState>No prepared route steps returned.</EmptyState>;
  }

  const diagnosticsText = buildActionRunTraceDiagnosticsText(runId, trace);

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border/70 bg-muted/30 p-3">
        <div className="text-sm font-medium">Trace diagnostics text</div>
        <pre
          className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground"
          data-testid={`action-run-trace-diagnostics-${runId}`}
        >
          {diagnosticsText}
        </pre>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Step</TableHead>
            <TableHead className="w-[120px]">Kind</TableHead>
            <TableHead>Routes</TableHead>
            <TableHead>Fallback</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trace.steps.map(step => (
            <TableRow key={step.stepId}>
              <TableCell className="break-words">
                <div className="font-medium">{step.stepId}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {step.routeCount} prepared route
                  {step.routeCount === 1 ? '' : 's'}
                </div>
                <div
                  className={cn(
                    'mt-1 text-xs',
                    step.routeCountMismatch
                      ? 'text-amber-700'
                      : 'text-muted-foreground'
                  )}
                >
                  {step.routeCountMismatch
                    ? `Mismatch expected ${step.routeCount} actual ${step.actualRouteCount}`
                    : `Actual ${step.actualRouteCount}`}
                </div>
                {step.requestedModelId ? (
                  <div className="mt-1 break-words text-xs text-muted-foreground">
                    Requested {step.requestedModelId}
                  </div>
                ) : null}
                {step.requestedModelSource ? (
                  <div className="mt-1 break-words text-xs text-muted-foreground">
                    Source {formatFeatureKind(step.requestedModelSource)}
                  </div>
                ) : null}
              </TableCell>
              <TableCell>{formatFeatureKind(step.kind)}</TableCell>
              <TableCell className="break-words">
                <ActionRunTraceRoutes routes={step.routes} />
              </TableCell>
              <TableCell className="break-words">
                {step.fallbackProviderIds.length
                  ? step.fallbackProviderIds.join(' -> ')
                  : 'None'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ActionRunTraceQueryResult({
  runId,
  workspaceId,
}: {
  runId: string;
  workspaceId: string;
}) {
  const { data, isValidating } = useQuery({
    query: getCopilotActionRunPreparedRouteTraceQuery,
    variables: {
      runId,
      workspaceId,
    },
  });
  const trace = data.currentUser?.copilot?.actionRunPreparedRouteTrace ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline" className="font-normal">
          Workspace {workspaceId}
        </Badge>
        <Badge variant="outline" className="font-normal">
          Run {runId}
        </Badge>
        {isValidating ? (
          <Badge variant="outline" className="font-normal">
            Refreshing
          </Badge>
        ) : null}
      </div>
      <ActionRunTraceResult runId={runId} trace={trace} />
    </div>
  );
}

function formatActionRunTimestamp(value: string) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }
  return timestamp.toLocaleString();
}

function formatActionRunPreparedRouteSummary(run: ActionRunDiagnosticsItem) {
  if (!run.hasPreparedRouteTrace) {
    return 'No prepared route trace';
  }

  const stepLabel =
    run.preparedRouteStepCount === 1
      ? '1 step'
      : `${run.preparedRouteStepCount} steps`;
  const routeLabel =
    run.preparedRouteCount === 1
      ? '1 route'
      : `${run.preparedRouteCount} routes`;

  return `${stepLabel} / ${routeLabel}`;
}

function formatActionRunPreparedRouteActualSummary(
  run: ActionRunDiagnosticsItem
) {
  if (!run.hasPreparedRouteTrace) {
    return null;
  }

  return run.preparedRouteActualCount === run.preparedRouteCount
    ? `Actual routes ${run.preparedRouteActualCount}`
    : `Actual routes ${run.preparedRouteActualCount} / declared ${run.preparedRouteCount}`;
}

function formatActionRunPreparedRouteProviders(run: ActionRunDiagnosticsItem) {
  if (!run.preparedRouteProviderIds.length) {
    return 'No prepared providers';
  }

  return `Providers ${run.preparedRouteProviderIds.join(' -> ')}`;
}

function formatActionRunPreparedRouteSteps(run: ActionRunDiagnosticsItem) {
  if (!run.preparedRouteStepIds.length) {
    return 'No prepared steps';
  }

  return `Steps ${run.preparedRouteStepIds.join(' -> ')}`;
}

function formatActionRunPreparedRouteModels(run: ActionRunDiagnosticsItem) {
  if (!run.preparedRouteModelIds.length) {
    return 'No prepared models';
  }

  return `Models ${run.preparedRouteModelIds.join(' -> ')}`;
}

function formatActionRunPreparedRouteRequestedModels(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteRequestedModelIds.length) {
    return 'No requested models';
  }

  return `Requested ${run.preparedRouteRequestedModelIds.join(' -> ')}`;
}

function formatActionRunPreparedRouteRequestedModelSources(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteRequestedModelSources.length) {
    return 'No requested model sources';
  }

  return `Requested sources ${run.preparedRouteRequestedModelSources
    .map(formatFeatureKind)
    .join(' -> ')}`;
}

function formatActionRunPreparedRouteStepRequestedModelSources(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteStepRequestedModelSources.length) {
    return 'No step requested model sources';
  }

  return `Step requested sources ${run.preparedRouteStepRequestedModelSources
    .map(value => {
      const [stepId, source] = value.split(' -> ');
      return source ? `${stepId} -> ${formatFeatureKind(source)}` : value;
    })
    .join(' | ')}`;
}

function formatActionRunPreparedRouteTargets(run: ActionRunDiagnosticsItem) {
  if (!run.preparedRouteTargets.length) {
    return 'No prepared targets';
  }

  return `Targets ${run.preparedRouteTargets.join(' -> ')}`;
}

function formatActionRunPreparedRouteOrder(run: ActionRunDiagnosticsItem) {
  if (!run.preparedRouteOrder.length) {
    return 'No route order';
  }

  return `Route order ${run.preparedRouteOrder.join(' | ')}`;
}

function formatActionRunPreparedRouteFallbackOrder(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteFallbackOrder.length) {
    return 'No fallback order';
  }

  return `Fallback order ${run.preparedRouteFallbackOrder.join(' | ')}`;
}

function formatActionRunPreparedRouteStepTargets(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteStepTargets.length) {
    return 'No prepared step targets';
  }

  return `Step targets ${run.preparedRouteStepTargets.join(' | ')}`;
}

function formatActionRunPreparedRouteRequestedTargets(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteRequestedTargets.length) {
    return 'No requested target pairs';
  }

  return `Requested targets ${run.preparedRouteRequestedTargets.join(' | ')}`;
}

function formatActionRunPreparedRouteStepRequestedTargets(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteStepRequestedTargets.length) {
    return 'No step requested target pairs';
  }

  return `Step requested targets ${run.preparedRouteStepRequestedTargets.join(
    ' | '
  )}`;
}

function formatActionRunPreparedRouteStepOrder(run: ActionRunDiagnosticsItem) {
  if (!run.preparedRouteStepOrder.length) {
    return 'No step route order';
  }

  return `Step route order ${run.preparedRouteStepOrder.join(' | ')}`;
}

function formatActionRunPreparedRouteStepRouteCounts(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteStepRouteCounts.length) {
    return 'No step route counts';
  }

  return `Step route counts ${run.preparedRouteStepRouteCounts.join(' | ')}`;
}

function formatActionRunPreparedRouteStepRouteCountMismatches(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteStepRouteCountMismatches.length) {
    return null;
  }

  return `Route count mismatch ${run.preparedRouteStepRouteCountMismatches.join(
    ' | '
  )}`;
}

function formatActionRunPreparedRouteStepFallbackOrder(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteStepFallbackOrder.length) {
    return 'No step fallback order';
  }

  return `Step fallback order ${run.preparedRouteStepFallbackOrder.join(
    ' | '
  )}`;
}

function formatActionRunPreparedRouteKinds(run: ActionRunDiagnosticsItem) {
  if (!run.preparedRouteKinds.length) {
    return 'No prepared kinds';
  }

  return `Kinds ${run.preparedRouteKinds.join(' -> ')}`;
}

function formatActionRunPreparedRouteProtocols(run: ActionRunDiagnosticsItem) {
  if (!run.preparedRouteProtocols.length) {
    return 'No route protocols';
  }

  return `Protocols ${run.preparedRouteProtocols.join(' -> ')}`;
}

function formatActionRunPreparedRouteModelBackendKinds(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteModelBackendKinds.length) {
    return 'No route backends';
  }

  return `Backends ${run.preparedRouteModelBackendKinds.join(' -> ')}`;
}

function formatActionRunPreparedRouteCanonicalModelKeys(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteCanonicalModelKeys.length) {
    return 'No canonical model keys';
  }

  return `Canonical models ${run.preparedRouteCanonicalModelKeys.join(' -> ')}`;
}

function formatActionRunPreparedRouteBehaviorFlags(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteBehaviorFlags.length) {
    return 'No behavior flags';
  }

  return `Behavior flags ${run.preparedRouteBehaviorFlags.join(' -> ')}`;
}

function formatActionRunPreparedRouteDimensionEvidence(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteDimensionEvidence.length) {
    return 'No dimension evidence';
  }

  return `Dimensions ${run.preparedRouteDimensionEvidence.join(' | ')}`;
}

function formatActionRunPreparedRouteStepProtocols(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteStepProtocols.length) {
    return 'No step protocol pairs';
  }

  return `Step protocols ${run.preparedRouteStepProtocols.join(' | ')}`;
}

function formatActionRunPreparedRouteStepModelBackendKinds(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteStepModelBackendKinds.length) {
    return 'No step backend pairs';
  }

  return `Step backends ${run.preparedRouteStepModelBackendKinds.join(' | ')}`;
}

function formatActionRunPreparedRouteStepCanonicalModelKeys(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteStepCanonicalModelKeys.length) {
    return 'No step canonical model pairs';
  }

  return `Step canonical models ${run.preparedRouteStepCanonicalModelKeys.join(
    ' | '
  )}`;
}

function formatActionRunPreparedRouteStepBehaviorFlags(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteStepBehaviorFlags.length) {
    return 'No step behavior flag pairs';
  }

  return `Step behavior flags ${run.preparedRouteStepBehaviorFlags.join(
    ' | '
  )}`;
}

function formatActionRunPreparedRouteStepDimensionEvidence(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteStepDimensionEvidence.length) {
    return 'No step dimension evidence';
  }

  return `Step dimensions ${run.preparedRouteStepDimensionEvidence.join(
    ' | '
  )}`;
}

function formatActionRunPreparedRouteRequestLayers(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteRequestLayers.length) {
    return 'No request layers';
  }

  return `Layers ${run.preparedRouteRequestLayers.join(' -> ')}`;
}

function formatActionRunPreparedRouteStepRequestLayers(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteStepRequestLayers.length) {
    return 'No step layer pairs';
  }

  return `Step layers ${run.preparedRouteStepRequestLayers.join(' | ')}`;
}

function formatActionRunPreparedRouteFallbacks(run: ActionRunDiagnosticsItem) {
  if (!run.preparedRouteFallbackProviderIds.length) {
    return null;
  }

  return `Fallback ${run.preparedRouteFallbackProviderIds.join(' -> ')}`;
}

function formatActionRunPreparedRouteStepFallbacks(
  run: ActionRunDiagnosticsItem
) {
  if (!run.preparedRouteStepFallbackProviderIds.length) {
    return null;
  }

  return `Step fallback ${run.preparedRouteStepFallbackProviderIds.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeSteps(run: ActionRunDiagnosticsItem) {
  if (!run.agentRuntimeStepIds.length) {
    return 'Agent runtime steps none';
  }

  return `Agent runtime steps ${run.agentRuntimeStepIds.join(' -> ')}`;
}

function formatActionRunAgentRuntimeStepTypes(run: ActionRunDiagnosticsItem) {
  if (!run.agentRuntimeStepTypes.length) {
    return 'Agent runtime step types none';
  }

  return `Agent runtime step types ${run.agentRuntimeStepTypes.join(' | ')}`;
}

function formatActionRunAgentRuntimeStepStatuses(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeStepStatuses.length) {
    return 'Agent runtime step statuses none';
  }

  return `Agent runtime step statuses ${run.agentRuntimeStepStatuses.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeStepKinds(run: ActionRunDiagnosticsItem) {
  if (!run.agentRuntimeStepKinds.length) {
    return 'Agent runtime step kinds none';
  }

  return `Agent runtime step kinds ${run.agentRuntimeStepKinds.join(' | ')}`;
}

function formatActionRunAgentRuntimeDiagnosticsFingerprint(
  run: ActionRunDiagnosticsItem
) {
  return `Agent runtime diagnostics fingerprint ${run.agentRuntimeDiagnosticsFingerprint}`;
}

function formatActionRunAgentRuntimeDiagnosticsManifest(
  run: ActionRunDiagnosticsItem
) {
  const manifest = run.agentRuntimeDiagnosticsManifest;

  return compactList([
    `Agent runtime diagnostics manifest ${manifest.version}`,
    `action ${manifest.actionId}@${manifest.actionVersion}`,
    `run status ${formatFeatureKind(manifest.runStatus)}`,
    `fingerprint ${manifest.fingerprint}`,
    `projection ${manifest.projectionContractFingerprint}`,
    `timeline ${manifest.timelineRouteEvidenceSetFingerprint}`,
    `source ${manifest.projectionSource}`,
    `schema ${manifest.schemaReadiness}`,
    manifest.hasPreparedRouteTrace ? 'prepared trace yes' : 'prepared trace no',
    `routes ${manifest.preparedRouteActualCount}/${manifest.preparedRouteCount}`,
    `steps ${manifest.preparedRouteStepCount}`,
    `timeline items ${manifest.timelineItemCount}`,
    `projection gaps ${manifest.projectionGapCount}`,
    `timeline gaps ${manifest.timelineGapCount}`,
    `schema gaps ${manifest.schemaReadinessGapCount}`,
    manifest.timelineEventTypes.length
      ? `timeline events ${manifest.timelineEventTypes.join(' -> ')}`
      : 'timeline events none',
    manifest.nativeTraceEventTypes.length
      ? `native events ${manifest.nativeTraceEventTypes.join(' -> ')}`
      : 'native events none',
  ]);
}

function formatActionRunAgentRuntimeProjectionContractFingerprint(
  run: ActionRunDiagnosticsItem
) {
  return `Agent runtime projection contract fingerprint ${run.agentRuntimeProjectionContractFingerprint}`;
}

function formatActionRunAgentRuntimeTimelineEntries(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeTimelineEntries.length) {
    return 'Agent runtime timeline entries none';
  }

  return `Agent runtime timeline entries ${run.agentRuntimeTimelineEntries.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeTimelineItems(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeTimelineItems.length) {
    return 'Agent runtime timeline items none';
  }

  return `Agent runtime timeline items ${run.agentRuntimeTimelineItems
    .map(item => formatActionRunAgentRuntimeTimelineItem(item))
    .join(' | ')}`;
}

function formatActionRunAgentRuntimeTimelineRouteEvidenceSetFingerprint(
  run: ActionRunDiagnosticsItem
) {
  return `Agent runtime timeline route evidence set fingerprint ${run.agentRuntimeTimelineRouteEvidenceSetFingerprint}`;
}

function formatActionRunAgentRuntimeTimelineItem(
  item: ActionRunDiagnosticsItem['agentRuntimeTimelineItems'][number]
) {
  return compactList([
    `#${item.sequence}`,
    `key ${item.eventKey}`,
    `Timeline ${formatFeatureKind(item.eventType)}`,
    `status ${formatFeatureKind(item.status)}`,
    item.stepId ? `step ${item.stepId}` : 'run',
    item.stepType ? `type ${formatFeatureKind(item.stepType)}` : null,
    item.kind ? `kind ${formatFeatureKind(item.kind)}` : null,
    `routes ${item.actualRouteCount}/${item.routeCount}`,
    item.routeCountMismatch ? 'route count mismatch' : null,
    item.routeTargets.length
      ? `targets ${item.routeTargets.join(' -> ')}`
      : null,
    item.fallbackProviderIds.length
      ? `fallback ${item.fallbackProviderIds.join(' -> ')}`
      : null,
    item.routeModelBackendKinds.length
      ? `backends ${item.routeModelBackendKinds.join(' -> ')}`
      : null,
    item.routeCanonicalModelKeys.length
      ? `canonical ${item.routeCanonicalModelKeys.join(' -> ')}`
      : null,
    item.routeBehaviorFlags.length
      ? `behavior ${item.routeBehaviorFlags.join(' -> ')}`
      : null,
    item.routeDimensionEvidence.length
      ? `dimensions ${item.routeDimensionEvidence.join(' | ')}`
      : null,
    `route fingerprint ${item.routeEvidenceFingerprint}`,
  ]);
}

function formatActionRunAgentRuntimeTimelineEventTypes(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeTimelineEventTypes.length) {
    return 'Agent runtime timeline event types none';
  }

  return `Agent runtime timeline event types ${run.agentRuntimeTimelineEventTypes.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeTargetTimelineEventTypes(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeTargetTimelineEventTypes.length) {
    return 'Agent runtime target timeline event types none';
  }

  return `Agent runtime target timeline event types ${run.agentRuntimeTargetTimelineEventTypes.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeProjectedTimelineEventTypes(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeProjectedTimelineEventTypes.length) {
    return 'Agent runtime projected timeline event types none';
  }

  return `Agent runtime projected timeline event types ${run.agentRuntimeProjectedTimelineEventTypes.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeUnsupportedTimelineEventTypes(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeUnsupportedTimelineEventTypes.length) {
    return 'Agent runtime unsupported timeline event types none';
  }

  return `Agent runtime unsupported timeline event types ${run.agentRuntimeUnsupportedTimelineEventTypes.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeTimelineGaps(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeTimelineGaps.length) {
    return 'Agent runtime timeline gaps none';
  }

  return `Agent runtime timeline gaps ${run.agentRuntimeTimelineGaps.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeTargetSchemaComponents(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeTargetSchemaComponents.length) {
    return 'Agent runtime target schema components none';
  }

  return `Agent runtime target schema components ${run.agentRuntimeTargetSchemaComponents.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeProjectedSchemaComponents(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeProjectedSchemaComponents.length) {
    return 'Agent runtime projected schema components none';
  }

  return `Agent runtime projected schema components ${run.agentRuntimeProjectedSchemaComponents.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeSchemaReadinessGaps(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeSchemaReadinessGaps.length) {
    return 'Agent runtime schema readiness gaps none';
  }

  return `Agent runtime schema readiness gaps ${run.agentRuntimeSchemaReadinessGaps.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeTargetRunStatuses(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeTargetRunStatuses.length) {
    return 'Agent runtime target run statuses none';
  }

  return `Agent runtime target run statuses ${run.agentRuntimeTargetRunStatuses.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeProjectedRunStatuses(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeProjectedRunStatuses.length) {
    return 'Agent runtime projected run statuses none';
  }

  return `Agent runtime projected run statuses ${run.agentRuntimeProjectedRunStatuses.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeUnsupportedRunStatuses(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeUnsupportedRunStatuses.length) {
    return 'Agent runtime unsupported run statuses none';
  }

  return `Agent runtime unsupported run statuses ${run.agentRuntimeUnsupportedRunStatuses.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeRunStatusGaps(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeRunStatusGaps.length) {
    return 'Agent runtime run status gaps none';
  }

  return `Agent runtime run status gaps ${run.agentRuntimeRunStatusGaps.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeTargetStepStatuses(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeTargetStepStatuses.length) {
    return 'Agent runtime target step statuses none';
  }

  return `Agent runtime target step statuses ${run.agentRuntimeTargetStepStatuses.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeProjectedStepStatuses(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeProjectedStepStatuses.length) {
    return 'Agent runtime projected step statuses none';
  }

  return `Agent runtime projected step statuses ${run.agentRuntimeProjectedStepStatuses.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeUnsupportedStepStatuses(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeUnsupportedStepStatuses.length) {
    return 'Agent runtime unsupported step statuses none';
  }

  return `Agent runtime unsupported step statuses ${run.agentRuntimeUnsupportedStepStatuses.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeStepStatusGaps(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeStepStatusGaps.length) {
    return 'Agent runtime step status gaps none';
  }

  return `Agent runtime step status gaps ${run.agentRuntimeStepStatusGaps.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeTargetStepTypes(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeTargetStepTypes.length) {
    return 'Agent runtime target step types none';
  }

  return `Agent runtime target step types ${run.agentRuntimeTargetStepTypes.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeProjectedStepTypes(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeProjectedStepTypes.length) {
    return 'Agent runtime projected step types none';
  }

  return `Agent runtime projected step types ${run.agentRuntimeProjectedStepTypes.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeProjectionGaps(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeProjectionGaps.length) {
    return 'Agent runtime projection gaps none';
  }

  return `Agent runtime projection gaps ${run.agentRuntimeProjectionGaps.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeUnsupportedStepTypes(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeUnsupportedStepTypes.length) {
    return 'Agent runtime unsupported step types none';
  }

  return `Agent runtime unsupported step types ${run.agentRuntimeUnsupportedStepTypes.join(
    ' | '
  )}`;
}

function formatActionRunAgentRuntimeNativeTraceEvents(
  run: ActionRunDiagnosticsItem
) {
  if (!run.agentRuntimeNativeTraceEventTypes.length) {
    return 'Agent runtime native trace events none';
  }

  return `Agent runtime native trace events ${run.agentRuntimeNativeTraceEventTypes.join(
    ' | '
  )}`;
}

function buildActionRunDiagnosticsText(run: ActionRunDiagnosticsItem) {
  const actualRouteCountLabel = formatActionRunPreparedRouteActualSummary(run);
  const routeCountMismatchLabel =
    formatActionRunPreparedRouteStepRouteCountMismatches(run);
  const fallbackLabel = formatActionRunPreparedRouteFallbacks(run);
  const stepFallbackLabel = formatActionRunPreparedRouteStepFallbacks(run);
  const lines = [
    `Action run ${run.id}`,
    `Action ${run.actionId}`,
    `Version ${run.actionVersion}`,
    `Status ${formatFeatureKind(run.status)}`,
    `Attempt ${run.attempt}`,
    run.retryOf ? `Retry of ${run.retryOf}` : null,
    run.docId ? `Doc ${run.docId}` : null,
    run.sessionId ? `Session ${run.sessionId}` : null,
    run.errorCode ? `Error ${run.errorCode}` : null,
    `Created ${run.createdAt}`,
    `Updated ${run.updatedAt}`,
    formatActionRunAgentRuntimeDiagnosticsFingerprint(run),
    formatActionRunAgentRuntimeDiagnosticsManifest(run),
    `Agent runtime projection ${run.agentRuntimeProjectionSource}`,
    formatActionRunAgentRuntimeProjectionContractFingerprint(run),
    `Agent runtime run ${run.agentRuntimeRunId}`,
    `Agent runtime status ${formatFeatureKind(run.agentRuntimeRunStatus)}`,
    `Agent runtime step count ${run.agentRuntimeStepCount}`,
    formatActionRunAgentRuntimeSteps(run),
    formatActionRunAgentRuntimeStepTypes(run),
    formatActionRunAgentRuntimeStepStatuses(run),
    formatActionRunAgentRuntimeStepKinds(run),
    formatActionRunAgentRuntimeTimelineEntries(run),
    formatActionRunAgentRuntimeTimelineItems(run),
    formatActionRunAgentRuntimeTimelineRouteEvidenceSetFingerprint(run),
    formatActionRunAgentRuntimeTimelineEventTypes(run),
    formatActionRunAgentRuntimeTargetTimelineEventTypes(run),
    formatActionRunAgentRuntimeProjectedTimelineEventTypes(run),
    formatActionRunAgentRuntimeUnsupportedTimelineEventTypes(run),
    formatActionRunAgentRuntimeTimelineGaps(run),
    `Agent runtime schema readiness ${formatFeatureKind(
      run.agentRuntimeSchemaReadiness
    )}`,
    formatActionRunAgentRuntimeTargetSchemaComponents(run),
    formatActionRunAgentRuntimeProjectedSchemaComponents(run),
    formatActionRunAgentRuntimeSchemaReadinessGaps(run),
    formatActionRunAgentRuntimeTargetRunStatuses(run),
    formatActionRunAgentRuntimeProjectedRunStatuses(run),
    formatActionRunAgentRuntimeUnsupportedRunStatuses(run),
    formatActionRunAgentRuntimeRunStatusGaps(run),
    formatActionRunAgentRuntimeTargetStepStatuses(run),
    formatActionRunAgentRuntimeProjectedStepStatuses(run),
    formatActionRunAgentRuntimeUnsupportedStepStatuses(run),
    formatActionRunAgentRuntimeStepStatusGaps(run),
    formatActionRunAgentRuntimeTargetStepTypes(run),
    formatActionRunAgentRuntimeProjectedStepTypes(run),
    formatActionRunAgentRuntimeProjectionGaps(run),
    formatActionRunAgentRuntimeUnsupportedStepTypes(run),
    formatActionRunAgentRuntimeNativeTraceEvents(run),
    `Prepared trace ${run.hasPreparedRouteTrace ? 'yes' : 'no'}`,
    formatActionRunPreparedRouteSummary(run),
  ];

  if (run.hasPreparedRouteTrace) {
    lines.push(
      actualRouteCountLabel,
      formatActionRunPreparedRouteSteps(run),
      formatActionRunPreparedRouteProviders(run),
      formatActionRunPreparedRouteModels(run),
      formatActionRunPreparedRouteRequestedModels(run),
      formatActionRunPreparedRouteRequestedModelSources(run),
      formatActionRunPreparedRouteStepRequestedModelSources(run),
      formatActionRunPreparedRouteTargets(run),
      formatActionRunPreparedRouteOrder(run),
      formatActionRunPreparedRouteFallbackOrder(run),
      formatActionRunPreparedRouteStepTargets(run),
      formatActionRunPreparedRouteRequestedTargets(run),
      formatActionRunPreparedRouteStepRequestedTargets(run),
      formatActionRunPreparedRouteStepOrder(run),
      formatActionRunPreparedRouteStepRouteCounts(run),
      routeCountMismatchLabel,
      formatActionRunPreparedRouteStepFallbackOrder(run),
      formatActionRunPreparedRouteKinds(run),
      formatActionRunPreparedRouteProtocols(run),
      formatActionRunPreparedRouteModelBackendKinds(run),
      formatActionRunPreparedRouteCanonicalModelKeys(run),
      formatActionRunPreparedRouteBehaviorFlags(run),
      formatActionRunPreparedRouteDimensionEvidence(run),
      formatActionRunPreparedRouteStepProtocols(run),
      formatActionRunPreparedRouteStepModelBackendKinds(run),
      formatActionRunPreparedRouteStepCanonicalModelKeys(run),
      formatActionRunPreparedRouteStepBehaviorFlags(run),
      formatActionRunPreparedRouteStepDimensionEvidence(run),
      formatActionRunPreparedRouteRequestLayers(run),
      formatActionRunPreparedRouteStepRequestLayers(run),
      fallbackLabel,
      stepFallbackLabel
    );
  }

  return lines.filter((line): line is string => Boolean(line)).join('\n');
}

function buildActionRunDiagnosticsManifestJson(run: ActionRunDiagnosticsItem) {
  return JSON.stringify(run.agentRuntimeDiagnosticsManifest, null, 2);
}

function buildActionRunDiagnosticsManifestFilename(runId: string) {
  const safeRunId =
    runId.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'run';

  return `action-run-diagnostics-manifest-${safeRunId}.json`;
}

function buildActionRunDiagnosticsManifestMetadataFilename(runId: string) {
  const safeRunId =
    runId.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'run';

  return `action-run-diagnostics-manifest-metadata-${safeRunId}.json`;
}

function buildActionRunDiagnosticsManifestExportMetadata(
  run: ActionRunDiagnosticsItem
) {
  const metadata = run.agentRuntimeDiagnosticsManifestExportMetadata;

  return [
    `Export artifact ${metadata.artifact}`,
    `Filename ${metadata.filename}`,
    `MIME ${metadata.mime}`,
    `Metadata filename ${metadata.metadataFilename}`,
    `Metadata ${metadata.version}`,
    `Manifest ${metadata.manifestVersion}`,
    `Fingerprint ${metadata.manifestFingerprint}`,
    `Action ${metadata.actionId}@${metadata.actionVersion}`,
    `Run ${metadata.runId}`,
    `Run status ${metadata.runStatus}`,
    `Projection source ${metadata.projectionSource}`,
    `Schema readiness ${metadata.schemaReadiness}`,
    `Boundary ${metadata.boundary}`,
    `Export policy ${metadata.exportPolicyVersion}`,
    `Export policy status ${metadata.exportPolicyStatus}`,
    `Export policy fingerprint ${metadata.exportPolicyFingerprint}`,
    `Audit event ${metadata.auditEventVersion}`,
    `Audit event status ${metadata.auditEventStatus}`,
    `Audit event created ${metadata.auditEventCreated ? 'yes' : 'no'}`,
    `Audit event fingerprint ${metadata.auditEventFingerprint}`,
    `Retention policy ${metadata.retentionPolicyVersion}`,
    `Retention policy status ${metadata.retentionPolicyStatus}`,
    `Retention policy fingerprint ${metadata.retentionPolicyFingerprint}`,
  ].join('\n');
}

function buildActionRunDiagnosticsManifestExportMetadataJson(
  run: ActionRunDiagnosticsItem
) {
  return JSON.stringify(
    run.agentRuntimeDiagnosticsManifestExportMetadata,
    null,
    2
  );
}

function downloadActionRunDiagnosticsManifestJson(
  runId: string,
  manifestFilename: string,
  manifestJson: string
) {
  const blob = new Blob([manifestJson], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download =
    manifestFilename || buildActionRunDiagnosticsManifestFilename(runId);
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadActionRunDiagnosticsManifestMetadataJson(
  runId: string,
  metadataFilename: string,
  metadataJson: string
) {
  const blob = new Blob([metadataJson], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download =
    metadataFilename ||
    buildActionRunDiagnosticsManifestMetadataFilename(runId);
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ActionRunDiagnosticsPanel({
  diagnosticsText,
  exportMetadataJson,
  exportMetadataFilename,
  exportMetadataText,
  manifestFilename,
  manifestJson,
  runId,
}: {
  diagnosticsText: string;
  exportMetadataJson: string;
  exportMetadataFilename: string;
  exportMetadataText: string;
  manifestFilename: string;
  manifestJson: string;
  runId: string;
}) {
  return (
    <div className="mt-2 space-y-2 rounded-md border border-border/70 bg-muted/30 p-2">
      <div>
        <div className="text-xs font-medium">Diagnostics text</div>
        <pre
          className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground"
          data-testid={`action-run-diagnostics-${runId}`}
        >
          {diagnosticsText}
        </pre>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs font-medium">Diagnostics manifest JSON</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText(manifestJson).catch(() => {});
            }}
          >
            Copy JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              downloadActionRunDiagnosticsManifestJson(
                runId,
                manifestFilename,
                manifestJson
              );
            }}
          >
            Download JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard
                ?.writeText(exportMetadataText)
                .catch(() => {});
            }}
          >
            Copy metadata
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard
                ?.writeText(exportMetadataJson)
                .catch(() => {});
            }}
          >
            Copy metadata JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              downloadActionRunDiagnosticsManifestMetadataJson(
                runId,
                exportMetadataFilename,
                exportMetadataJson
              );
            }}
          >
            Download metadata JSON
          </Button>
        </div>
        <pre
          className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground"
          data-testid={`action-run-diagnostics-manifest-export-metadata-${runId}`}
        >
          {exportMetadataText}
        </pre>
        <pre
          className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground"
          data-testid={`action-run-diagnostics-manifest-export-metadata-json-${runId}`}
        >
          {exportMetadataJson}
        </pre>
        <pre
          className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground"
          data-testid={`action-run-diagnostics-manifest-json-${runId}`}
        >
          {manifestJson}
        </pre>
      </div>
    </div>
  );
}

function ActionRunRecentList({
  actionRuns,
  isValidating,
  onSelect,
}: {
  actionRuns: ActionRunDiagnosticsItem[];
  isValidating: boolean;
  onSelect: (runId: string) => void;
}) {
  if (!actionRuns.length) {
    return (
      <EmptyState>
        No recent action runs returned for this workspace.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-medium">Recent action runs</div>
        <Badge variant="outline" className="font-normal">
          {actionRuns.length} run{actionRuns.length === 1 ? '' : 's'}
        </Badge>
        {isValidating ? (
          <Badge variant="outline" className="font-normal">
            Refreshing
          </Badge>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[144px]">Trace</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="w-[100px]">Inspect</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {actionRuns.map(run => {
            const diagnosticsText = buildActionRunDiagnosticsText(run);
            const exportMetadataJson =
              buildActionRunDiagnosticsManifestExportMetadataJson(run);
            const exportMetadataFilename =
              run.agentRuntimeDiagnosticsManifestExportMetadata
                .metadataFilename;
            const manifestFilename =
              run.agentRuntimeDiagnosticsManifestExportMetadata.filename;
            const exportMetadataText =
              buildActionRunDiagnosticsManifestExportMetadata(run);
            const manifestJson = buildActionRunDiagnosticsManifestJson(run);
            const fallbackLabel = formatActionRunPreparedRouteFallbacks(run);
            const stepFallbackLabel =
              formatActionRunPreparedRouteStepFallbacks(run);
            const actualRouteCountLabel =
              formatActionRunPreparedRouteActualSummary(run);
            const routeCountMismatchLabel =
              formatActionRunPreparedRouteStepRouteCountMismatches(run);

            return (
              <TableRow key={run.id}>
                <TableCell className="break-words">
                  <div className="font-medium">{run.actionId}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {compactList([
                      run.actionVersion,
                      `attempt ${run.attempt}`,
                      run.errorCode,
                    ])}
                  </div>
                  <div className="mt-1 break-words text-xs text-muted-foreground">
                    {run.id}
                  </div>
                  <div className="mt-1 break-words text-xs text-muted-foreground">
                    Agent runtime {formatFeatureKind(run.agentRuntimeRunStatus)}{' '}
                    / {run.agentRuntimeStepCount} step
                    {run.agentRuntimeStepCount === 1 ? '' : 's'}
                  </div>
                  <div className="mt-1 break-words text-xs text-muted-foreground">
                    {formatActionRunAgentRuntimeDiagnosticsFingerprint(run)}
                  </div>
                  <div className="mt-1 break-words text-xs text-muted-foreground">
                    {formatActionRunAgentRuntimeDiagnosticsManifest(run)}
                  </div>
                  <div className="mt-1 break-words text-xs text-muted-foreground">
                    {formatActionRunAgentRuntimeProjectionContractFingerprint(
                      run
                    )}
                  </div>
                  {run.agentRuntimeProjectionGaps.length ? (
                    <div className="mt-1 break-words text-xs text-amber-700">
                      {run.agentRuntimeProjectionGaps.length} projection gap
                      {run.agentRuntimeProjectionGaps.length === 1 ? '' : 's'}
                    </div>
                  ) : null}
                  {run.agentRuntimeTimelineGaps.length ? (
                    <div className="mt-1 break-words text-xs text-amber-700">
                      {run.agentRuntimeTimelineGaps.length} timeline gap
                      {run.agentRuntimeTimelineGaps.length === 1 ? '' : 's'}
                    </div>
                  ) : null}
                  {run.agentRuntimeTimelineItems.length ? (
                    <div
                      className="mt-2 space-y-1 border-l border-border pl-2"
                      data-testid={`action-run-timeline-${run.id}`}
                    >
                      {run.agentRuntimeTimelineItems.map(item => (
                        <div
                          key={item.id}
                          className="break-words text-xs text-muted-foreground"
                        >
                          {formatActionRunAgentRuntimeTimelineItem(item)}
                        </div>
                      ))}
                      <div className="break-words text-xs text-muted-foreground">
                        {formatActionRunAgentRuntimeTimelineRouteEvidenceSetFingerprint(
                          run
                        )}
                      </div>
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>{formatFeatureKind(run.status)}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        'font-normal',
                        run.hasPreparedRouteTrace
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                          : 'border-border bg-muted text-muted-foreground'
                      )}
                    >
                      {run.hasPreparedRouteTrace ? 'Prepared' : 'None'}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      {formatActionRunPreparedRouteSummary(run)}
                    </div>
                    {run.hasPreparedRouteTrace ? (
                      <>
                        {actualRouteCountLabel ? (
                          <div className="break-words text-xs text-muted-foreground">
                            {actualRouteCountLabel}
                          </div>
                        ) : null}
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteSteps(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteProviders(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteModels(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteRequestedModels(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteRequestedModelSources(
                            run
                          )}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteStepRequestedModelSources(
                            run
                          )}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteTargets(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteOrder(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteFallbackOrder(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteStepTargets(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteRequestedTargets(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteStepRequestedTargets(
                            run
                          )}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteStepOrder(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteStepRouteCounts(run)}
                        </div>
                        {routeCountMismatchLabel ? (
                          <div className="break-words text-xs text-amber-700">
                            {routeCountMismatchLabel}
                          </div>
                        ) : null}
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteStepFallbackOrder(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteKinds(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteProtocols(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteModelBackendKinds(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteCanonicalModelKeys(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteBehaviorFlags(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteDimensionEvidence(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteStepProtocols(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteStepModelBackendKinds(
                            run
                          )}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteStepCanonicalModelKeys(
                            run
                          )}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteStepBehaviorFlags(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteStepDimensionEvidence(
                            run
                          )}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteRequestLayers(run)}
                        </div>
                        <div className="break-words text-xs text-muted-foreground">
                          {formatActionRunPreparedRouteStepRequestLayers(run)}
                        </div>
                        {fallbackLabel ? (
                          <div className="break-words text-xs text-muted-foreground">
                            {fallbackLabel}
                          </div>
                        ) : null}
                        {stepFallbackLabel ? (
                          <div className="break-words text-xs text-muted-foreground">
                            {stepFallbackLabel}
                          </div>
                        ) : null}
                        <ActionRunDiagnosticsPanel
                          diagnosticsText={diagnosticsText}
                          exportMetadataJson={exportMetadataJson}
                          exportMetadataFilename={exportMetadataFilename}
                          exportMetadataText={exportMetadataText}
                          manifestFilename={manifestFilename}
                          manifestJson={manifestJson}
                          runId={run.id}
                        />
                      </>
                    ) : (
                      <ActionRunDiagnosticsPanel
                        diagnosticsText={diagnosticsText}
                        exportMetadataJson={exportMetadataJson}
                        exportMetadataFilename={exportMetadataFilename}
                        exportMetadataText={exportMetadataText}
                        manifestFilename={manifestFilename}
                        manifestJson={manifestJson}
                        runId={run.id}
                      />
                    )}
                  </div>
                </TableCell>
                <TableCell className="break-words text-xs text-muted-foreground">
                  {formatActionRunTimestamp(run.updatedAt)}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onSelect(run.id);
                    }}
                  >
                    Inspect
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ActionRunRecentListQuery({
  onSelect,
  workspaceId,
}: {
  onSelect: (runId: string) => void;
  workspaceId: string;
}) {
  const { data, isValidating } = useQuery({
    query: getCopilotActionRunsQuery,
    variables: {
      limit: 8,
      workspaceId,
    },
  });
  const actionRuns = data.currentUser?.copilot?.actionRuns ?? EMPTY_ACTION_RUNS;

  return (
    <ActionRunRecentList
      actionRuns={actionRuns}
      isValidating={isValidating}
      onSelect={onSelect}
    />
  );
}

function ActionRunTraceCard({
  actionRunId,
  actionRunIdInput,
  onActionRunIdInputChange,
  onActionRunSelect,
  onSubmit,
  workspaceId,
}: {
  actionRunId: string;
  actionRunIdInput: string;
  onActionRunIdInputChange: (value: string) => void;
  onActionRunSelect: (runId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  workspaceId: string | undefined;
}) {
  const nextActionRunId = actionRunIdInput.trim();

  return (
    <Card className="border-border/60 bg-card shadow-1">
      <CardHeader>
        <CardTitle className="text-base">Action run route trace</CardTitle>
        <CardDescription>
          Sanitized prepared route diagnostics for persisted action runs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-col gap-3 md:flex-row" onSubmit={onSubmit}>
          <label className="min-w-0 flex-1">
            <span className="text-xs text-muted-foreground">Action run ID</span>
            <Input
              className="mt-1"
              placeholder="Paste an action run id"
              value={actionRunIdInput}
              onChange={event => {
                onActionRunIdInputChange(event.target.value);
              }}
            />
          </label>
          <div className="flex items-end">
            <Button
              type="submit"
              variant="outline"
              className="h-9"
              disabled={!workspaceId || !nextActionRunId}
            >
              Inspect run
            </Button>
          </div>
        </form>

        {!workspaceId ? (
          <EmptyState>
            Select a workspace scope before inspecting an action run.
          </EmptyState>
        ) : (
          <ActionRunRecentListQuery
            onSelect={onActionRunSelect}
            workspaceId={workspaceId}
          />
        )}

        {workspaceId && !actionRunId ? (
          <EmptyState>
            Enter an action run ID or select a recent run to inspect prepared
            route diagnostics.
          </EmptyState>
        ) : null}

        {workspaceId && actionRunId ? (
          <ActionRunTraceQueryResult
            runId={actionRunId}
            workspaceId={workspaceId}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatSupportBundleStatus(status: string) {
  return formatFeatureKind(status);
}

function formatSupportBundleSummary(bundle: SupportBundleRequest) {
  return compactList([
    `manifest ${bundle.manifestFingerprint}`,
    bundle.archiveFingerprint ? `archive ${bundle.archiveFingerprint}` : null,
    `source ${bundle.sourceEvidenceSetFingerprint}`,
    `retention ${formatFeatureKind(bundle.retentionStatus)}`,
    `audit events ${bundle.auditEventCount}`,
    `transfer events ${bundle.transferEventCount}`,
    `transfer forwarding events ${bundle.transferForwardingEventCount}`,
    `expires ${formatActionRunTimestamp(bundle.expiresAt)}`,
  ]);
}

function formatSupportBundleAuditEvent(event: SupportBundleAuditEvent) {
  return compactList([
    `audit ${formatFeatureKind(event.eventType)}`,
    `fingerprint ${event.eventFingerprint}`,
    `actor ${event.actorId}`,
    `created ${formatActionRunTimestamp(event.createdAt)}`,
  ]);
}

function formatSupportBundleTransferEvent(event: SupportBundleTransferEvent) {
  return compactList([
    `transfer ${formatFeatureKind(event.deliveryMethod)}`,
    `source ${event.eventSource}`,
    event.eventId ? `event ${event.eventId}` : 'event none',
    `fingerprint ${event.eventFingerprint}`,
    `authorization ${event.authorizationId}`,
    `artifact ${formatFeatureKind(event.artifactKind)}:${event.artifactFingerprint}`,
    `manifest ${event.manifestFingerprint}`,
    `notification auth ${event.notificationAuthEvidenceFingerprint}`,
    `storage ${event.storageKey}`,
    `content ${event.storageContentType}`,
    `bytes ${event.storageByteSize}`,
    `transferred ${formatActionRunTimestamp(event.transferredAt)}`,
  ]);
}

function formatSupportBundleTransferForwardingEvent(
  event: SupportBundleTransferForwardingEvent
) {
  const replaySourceEventId =
    getSupportBundleForwardingReplaySourceEventId(event);

  return compactList([
    `forwarding ${formatFeatureKind(event.status)}`,
    `source ${event.eventSource}`,
    event.eventId ? `event ${event.eventId}` : 'event none',
    `fingerprint ${event.forwardingEventFingerprint}`,
    `payload ${event.forwardingPayloadFingerprint}`,
    replaySourceEventId ? `replay source ${replaySourceEventId}` : null,
    `authorization ${event.authorizationId}`,
    `signature ${event.providerSignatureEvidenceFingerprint}`,
    event.forwardedTransferEventFingerprint
      ? `forwarded transfer ${event.forwardedTransferEventFingerprint}`
      : null,
    `attempts ${event.attemptCount}/${event.maxAttempts}`,
    event.nextAttemptAt
      ? `next ${formatActionRunTimestamp(event.nextAttemptAt)}`
      : null,
    event.lastAttemptAt
      ? `last ${formatActionRunTimestamp(event.lastAttemptAt)}`
      : null,
    event.forwardedAt
      ? `forwarded ${formatActionRunTimestamp(event.forwardedAt)}`
      : null,
    event.deadLetteredAt
      ? `dead-lettered ${formatActionRunTimestamp(event.deadLetteredAt)}`
      : null,
    event.failureCode
      ? `failure ${formatFeatureKind(event.failureCode)}`
      : null,
    event.failureMessage ? `message ${event.failureMessage}` : null,
    event.workerLeaseId ? `lease ${event.workerLeaseId}` : null,
    event.workerLeaseExpiresAt
      ? `lease expires ${formatActionRunTimestamp(event.workerLeaseExpiresAt)}`
      : null,
    `updated ${formatActionRunTimestamp(event.updatedAt)}`,
  ]);
}

function getSupportBundleForwardingReplaySourceEventId(event: {
  forwardingPayload: unknown;
}) {
  const payload = event.forwardingPayload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const replay = (payload as Record<string, unknown>).replay;
  if (!replay || typeof replay !== 'object' || Array.isArray(replay)) {
    return null;
  }
  const sourceForwardingEventId = (replay as Record<string, unknown>)
    .sourceForwardingEventId;
  return typeof sourceForwardingEventId === 'string'
    ? sourceForwardingEventId
    : null;
}

function buildSupportBundleListFilter(input: {
  forwardingStatus: SupportBundleForwardingStatusFilter;
  query: string;
}) {
  const filter: {
    query?: string;
    transferForwardingStatus?: string;
  } = {};
  if (input.forwardingStatus !== SUPPORT_BUNDLE_FORWARDING_ALL_STATUSES) {
    filter.transferForwardingStatus = input.forwardingStatus;
  }
  const query = input.query.trim();
  if (query) {
    filter.query = /^[a-f0-9]{16}$/i.test(query) ? query.toLowerCase() : query;
  }
  return Object.keys(filter).length ? filter : undefined;
}

function formatProviderHealthProbeAttempt(attempt: ProviderHealthProbeAttempt) {
  const profileSnapshot = attempt.providerProfileSnapshot as Record<
    string,
    unknown
  > | null;
  const modelCount =
    typeof profileSnapshot?.modelCount === 'number'
      ? profileSnapshot.modelCount
      : null;

  return compactList([
    `probe ${formatFeatureKind(attempt.status)}`,
    `provider ${attempt.providerId}`,
    attempt.providerType
      ? `type ${formatProviderMetadata(
          attempt.providerType,
          PROVIDER_TYPE_LABELS
        )}`
      : null,
    `revision ${attempt.providerRegistryRevisionId}`,
    `revision fingerprint ${attempt.providerRegistryRevisionFingerprint}`,
    attempt.providerProfileSource
      ? `profile source ${formatFeatureKind(attempt.providerProfileSource)}`
      : null,
    `profile fingerprint ${attempt.providerProfileFingerprint}`,
    modelCount == null ? null : `profile models ${modelCount}`,
    `request ${attempt.requestFingerprint}`,
    `actor ${attempt.actorId}`,
    `attempts ${attempt.attemptCount}/${attempt.maxAttempts}`,
    `scheduled ${formatActionRunTimestamp(attempt.scheduledAt)}`,
    attempt.checkedAt
      ? `checked ${formatActionRunTimestamp(attempt.checkedAt)}`
      : null,
    attempt.completedAt
      ? `completed ${formatActionRunTimestamp(attempt.completedAt)}`
      : null,
    attempt.deadLetteredAt
      ? `dead-lettered ${formatActionRunTimestamp(attempt.deadLetteredAt)}`
      : null,
    attempt.resultStatus
      ? `result ${formatFeatureKind(attempt.resultStatus)}`
      : null,
    attempt.resultFingerprint
      ? `result fingerprint ${attempt.resultFingerprint}`
      : null,
    attempt.providerHealthStateId
      ? `state ${attempt.providerHealthStateId}`
      : null,
    attempt.providerHealthStateFingerprint
      ? `state fingerprint ${attempt.providerHealthStateFingerprint}`
      : null,
    attempt.failureCode
      ? `failure ${formatFeatureKind(attempt.failureCode)}`
      : null,
    attempt.failureMessage ? `message ${attempt.failureMessage}` : null,
    attempt.workerLeaseId ? `lease ${attempt.workerLeaseId}` : null,
    attempt.workerLeaseExpiresAt
      ? `lease expires ${formatActionRunTimestamp(
          attempt.workerLeaseExpiresAt
        )}`
      : null,
    `updated ${formatActionRunTimestamp(attempt.updatedAt)}`,
  ]);
}

function buildProviderHealthProbeAttemptFilter(input: {
  status: ProviderHealthProbeAttemptStatusFilter;
  query: string;
}) {
  const filter: {
    providerId?: string;
    providerProfileFingerprint?: string;
    providerRegistryRevisionFingerprint?: string;
    providerRegistryRevisionId?: string;
    query?: string;
    requestFingerprint?: string;
    resultFingerprint?: string;
    status?: string;
  } = {};
  if (input.status !== PROVIDER_HEALTH_PROBE_ATTEMPT_ALL_STATUSES) {
    filter.status = input.status;
  }

  const query = input.query.trim();
  if (query) {
    filter.query = /^[a-f0-9]{16}$/i.test(query) ? query.toLowerCase() : query;
  }

  return Object.keys(filter).length ? filter : undefined;
}

function ProviderHealthProbeAttemptsBlock({
  attempts,
  isRetrying,
  onRetry,
}: {
  attempts: ProviderHealthProbeAttempt[];
  isRetrying?: boolean;
  onRetry?: (attempt: ProviderHealthProbeAttempt) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Provider health probes</div>
      {attempts.length ? (
        <div className="space-y-2" data-testid="provider-health-probe-attempts">
          {attempts.map(attempt => (
            <div
              className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs"
              key={attempt.id}
            >
              <div className="min-w-0 flex-1 break-words">
                {formatProviderHealthProbeAttempt(attempt)}
              </div>
              {attempt.status === 'dead_lettered' && onRetry ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={isRetrying}
                  onClick={() => onRetry(attempt)}
                >
                  Retry
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div data-testid="provider-health-probe-attempts">
          <EmptyState>No provider health probe attempts returned.</EmptyState>
        </div>
      )}
    </div>
  );
}

function ProviderHealthProbeAttemptsQuery({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [retryRecord, setRetryRecord] =
    useState<ProviderHealthProbeAttemptRetryRecord | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<ProviderHealthProbeAttemptStatusFilter>(
      PROVIDER_HEALTH_PROBE_ATTEMPT_ALL_STATUSES
    );
  const [queryFilter, setQueryFilter] = useState('');
  const providerHealthProbeAttemptFilter = useMemo(
    () =>
      buildProviderHealthProbeAttemptFilter({
        status: statusFilter,
        query: queryFilter,
      }),
    [queryFilter, statusFilter]
  );
  const { data, mutate } = useQuery({
    query: getCopilotProviderHealthProbeAttemptsQuery,
    variables: {
      ...(providerHealthProbeAttemptFilter
        ? { filter: providerHealthProbeAttemptFilter }
        : {}),
      limit: 5,
      workspaceId,
    },
  });
  const { trigger: retryProbeAttempt, isMutating: isRetryingProbeAttempt } =
    useMutation({
      mutation: retryCopilotProviderHealthProbeAttemptMutation,
    });
  const attempts =
    data?.currentUser?.copilot?.providerHealthProbeAttempts ??
    EMPTY_PROVIDER_HEALTH_PROBE_ATTEMPTS;
  const displayAttempts =
    retryRecord && attempts.every(attempt => attempt.id !== retryRecord.id)
      ? [retryRecord, ...attempts]
      : attempts;
  const onRetry = (attempt: ProviderHealthProbeAttempt) => {
    setRetryRecord(null);
    setRetryError(null);
    retryProbeAttempt({
      input: {
        attemptId: attempt.id,
        workspaceId,
      },
    })
      .then(data => {
        setRetryRecord(data.retryCopilotProviderHealthProbeAttempt);
        mutate?.()?.catch(error => {
          console.error(error);
        });
      })
      .catch(error => {
        console.error(error);
        setRetryError(error instanceof Error ? error.message : String(error));
      });
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[180px_1fr]">
        <Select
          value={statusFilter}
          onValueChange={value => {
            setStatusFilter(value as ProviderHealthProbeAttemptStatusFilter);
          }}
        >
          <SelectTrigger aria-label="Provider health probe status">
            <SelectValue placeholder="All probe statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PROVIDER_HEALTH_PROBE_ATTEMPT_ALL_STATUSES}>
              All statuses
            </SelectItem>
            {PROVIDER_HEALTH_PROBE_ATTEMPT_STATUSES.map(status => (
              <SelectItem key={status} value={status}>
                {formatFeatureKind(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Provider health probe filter"
          placeholder="Provider, revision, request, profile, or result fingerprint"
          value={queryFilter}
          onChange={event => {
            setQueryFilter(event.target.value);
          }}
        />
      </div>
      <ProviderHealthProbeAttemptsBlock
        attempts={displayAttempts}
        isRetrying={isRetryingProbeAttempt}
        onRetry={onRetry}
      />
      {retryError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Provider health probe retry error {retryError}
        </div>
      ) : null}
    </div>
  );
}

function SupportBundleManifestBlock({
  bundle,
  isReplayingForwardingEvent,
  onReplayForwardingEvent,
}: {
  bundle: SupportBundleRequest;
  isReplayingForwardingEvent?: boolean;
  onReplayForwardingEvent?: (
    bundle: SupportBundleRequest,
    event: SupportBundleTransferForwardingEvent
  ) => void;
}) {
  const auditEvents = bundle.auditEvents.slice(0, 5);
  const transferEvents = bundle.transferEvents.slice(0, 5);
  const transferForwardingEvents = bundle.transferForwardingEvents.slice(0, 5);

  return (
    <div
      className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs"
      data-testid={`support-bundle-manifest-${bundle.id}`}
    >
      <div className="break-words font-medium">
        {formatSupportBundleSummary(bundle)}
      </div>
      <div className="mt-1 break-words text-muted-foreground">
        {compactList([
          bundle.manifestJson.version,
          `sections ${bundle.manifestJson.sourceEvidenceSummary.includedSections.join(', ')}`,
          `prompts ${bundle.manifestJson.sourceEvidenceSummary.promptCatalogItemCount}`,
          `action runs ${bundle.manifestJson.sourceEvidenceSummary.actionRunCount}`,
          `task routes ${bundle.manifestJson.sourceEvidenceSummary.taskRouteCount}`,
          bundle.archiveByteSize
            ? `archive bytes ${bundle.archiveByteSize}`
            : null,
          bundle.archiveStorageKey
            ? `storage ${bundle.archiveStorageKey}`
            : null,
        ])}
      </div>
      <div
        className="mt-2 space-y-1 break-words text-muted-foreground"
        data-testid={`support-bundle-audit-events-${bundle.id}`}
      >
        {auditEvents.length
          ? auditEvents.map(event => (
              <div key={event.id}>{formatSupportBundleAuditEvent(event)}</div>
            ))
          : 'audit events none'}
      </div>
      <div
        className="mt-2 space-y-1 break-words text-muted-foreground"
        data-testid={`support-bundle-transfer-events-${bundle.id}`}
      >
        {transferEvents.length
          ? transferEvents.map(event => (
              <div key={event.id}>
                {formatSupportBundleTransferEvent(event)}
              </div>
            ))
          : 'transfer events none'}
      </div>
      <div
        className="mt-2 space-y-1 break-words text-muted-foreground"
        data-testid={`support-bundle-transfer-forwarding-events-${bundle.id}`}
      >
        {transferForwardingEvents.length
          ? transferForwardingEvents.map(event => (
              <div
                className="flex flex-wrap items-start justify-between gap-2"
                key={event.id}
              >
                <div className="min-w-0 flex-1">
                  {formatSupportBundleTransferForwardingEvent(event)}
                </div>
                {event.status === 'dead_lettered' && onReplayForwardingEvent ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={isReplayingForwardingEvent}
                    onClick={() => onReplayForwardingEvent(bundle, event)}
                  >
                    Replay
                  </Button>
                ) : null}
              </div>
            ))
          : 'transfer forwarding events none'}
      </div>
    </div>
  );
}

function SupportBundleList({
  authorizeDownload,
  bundles,
  isAuthorizingDownload,
  isReplayingForwardingEvent,
  isValidating,
  onReplayForwardingEvent,
}: {
  authorizeDownload: (bundle: SupportBundleRequest) => void;
  bundles: SupportBundleRequest[];
  isAuthorizingDownload: boolean | undefined;
  isReplayingForwardingEvent?: boolean;
  isValidating: boolean;
  onReplayForwardingEvent?: (
    bundle: SupportBundleRequest,
    event: SupportBundleTransferForwardingEvent
  ) => void;
}) {
  if (!bundles.length) {
    return (
      <EmptyState>
        {isValidating
          ? 'Loading support bundle requests.'
          : 'No support bundle requests have been created for this workspace.'}
      </EmptyState>
    );
  }

  return (
    <TableViewport minWidth="min-w-[1080px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Manifest</TableHead>
            <TableHead>Retention</TableHead>
            <TableHead>Artifact</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bundles.map(bundle => (
            <TableRow key={bundle.id}>
              <TableCell className="align-top">
                <div className="flex flex-col gap-2">
                  <Badge variant="outline" className="w-fit font-normal">
                    {formatSupportBundleStatus(bundle.status)}
                  </Badge>
                  <span className="break-all text-xs text-muted-foreground">
                    {bundle.id}
                  </span>
                </div>
              </TableCell>
              <TableCell className="min-w-0 align-top">
                <SupportBundleManifestBlock
                  bundle={bundle}
                  isReplayingForwardingEvent={isReplayingForwardingEvent}
                  onReplayForwardingEvent={onReplayForwardingEvent}
                />
              </TableCell>
              <TableCell className="align-top text-xs text-muted-foreground">
                <div>{formatFeatureKind(bundle.retentionStatus)}</div>
                <div>{formatActionRunTimestamp(bundle.expiresAt)}</div>
              </TableCell>
              <TableCell className="align-top">
                <Button
                  disabled={
                    isAuthorizingDownload ||
                    bundle.status !== 'ready' ||
                    bundle.retentionStatus !== 'active'
                  }
                  onClick={() => authorizeDownload(bundle)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Download archive
                </Button>
              </TableCell>
              <TableCell className="align-top text-xs text-muted-foreground">
                {formatActionRunTimestamp(bundle.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableViewport>
  );
}

function SupportBundleStatusCard({
  workspaceId,
}: {
  workspaceId: string | undefined;
}) {
  const [createdBundle, setCreatedBundle] =
    useState<SupportBundleRequest | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [downloadAuthorization, setDownloadAuthorization] =
    useState<SupportBundleDownloadAuthorization | null>(null);
  const [downloadAuthorizationError, setDownloadAuthorizationError] = useState<
    string | null
  >(null);
  const [retentionCleanup, setRetentionCleanup] =
    useState<SupportBundleRetentionCleanup | null>(null);
  const [retentionCleanupError, setRetentionCleanupError] = useState<
    string | null
  >(null);
  const [forwardingReplay, setForwardingReplay] =
    useState<SupportBundleTransferForwardingReplayRecord | null>(null);
  const [forwardingReplayError, setForwardingReplayError] = useState<
    string | null
  >(null);
  const [forwardingStatusFilter, setForwardingStatusFilter] =
    useState<SupportBundleForwardingStatusFilter>(
      SUPPORT_BUNDLE_FORWARDING_ALL_STATUSES
    );
  const [forwardingQueryFilter, setForwardingQueryFilter] = useState('');
  const supportBundleListFilter = useMemo(
    () =>
      buildSupportBundleListFilter({
        forwardingStatus: forwardingStatusFilter,
        query: forwardingQueryFilter,
      }),
    [forwardingQueryFilter, forwardingStatusFilter]
  );
  const { data, isValidating, mutate } = useQuery(
    workspaceId
      ? {
          query: getCopilotSupportBundlesQuery,
          variables: {
            ...(supportBundleListFilter
              ? { filter: supportBundleListFilter }
              : {}),
            limit: 8,
            workspaceId,
          },
        }
      : undefined
  );
  const { trigger: createSupportBundle, isMutating } = useMutation({
    mutation: createCopilotSupportBundleMutation,
  });
  const {
    trigger: authorizeSupportBundleDownload,
    isMutating: isAuthorizingDownload,
  } = useMutation({
    mutation: authorizeCopilotSupportBundleDownloadMutation,
  });
  const {
    trigger: cleanupSupportBundleRetention,
    isMutating: isCleaningRetention,
  } = useMutation({
    mutation: cleanupCopilotSupportBundleRetentionMutation,
  });
  const {
    trigger: replaySupportBundleTransferForwardingEvent,
    isMutating: isReplayingForwardingEvent,
  } = useMutation({
    mutation: replayCopilotSupportBundleTransferForwardingEventMutation,
  });
  const bundles =
    data?.currentUser?.copilot?.supportBundles ?? EMPTY_SUPPORT_BUNDLES;
  const forwardingReplaySourceEventId = forwardingReplay
    ? getSupportBundleForwardingReplaySourceEventId(forwardingReplay)
    : null;
  const displayBundles =
    forwardingReplay && bundles.length
      ? bundles.map(bundle =>
          bundle.transferForwardingEvents.some(
            event => event.id === forwardingReplay.id
          )
            ? bundle
            : bundle.transferForwardingEvents.some(
                  event => event.id === forwardingReplaySourceEventId
                )
              ? {
                  ...bundle,
                  transferForwardingEventCount:
                    bundle.transferForwardingEventCount + 1,
                  transferForwardingEvents: [
                    forwardingReplay,
                    ...bundle.transferForwardingEvents,
                  ],
                }
              : bundle
        )
      : bundles;

  const onCreate = () => {
    if (!workspaceId) {
      return;
    }

    setCreatedBundle(null);
    setCreateError(null);
    createSupportBundle({
      input: {
        workspaceId,
      },
    })
      .then(result => {
        setCreatedBundle(result.createCopilotSupportBundle);
        mutate().catch(error => {
          console.error(error);
        });
      })
      .catch(error => {
        console.error(error);
        setCreateError(error instanceof Error ? error.message : String(error));
      });
  };
  const onAuthorizeDownload = (bundle: SupportBundleRequest) => {
    if (!workspaceId) {
      return;
    }

    setDownloadAuthorization(null);
    setDownloadAuthorizationError(null);
    authorizeSupportBundleDownload({
      input: {
        bundleId: bundle.id,
        artifactKind: 'archive_json',
        workspaceId,
      },
    })
      .then(result => {
        const authorization = result.authorizeCopilotSupportBundleDownload;
        setDownloadAuthorization(authorization);
        window.open(authorization.downloadUrl, '_blank', 'noopener,noreferrer');
        mutate().catch(error => {
          console.error(error);
        });
      })
      .catch(error => {
        console.error(error);
        setDownloadAuthorizationError(
          error instanceof Error ? error.message : String(error)
        );
      });
  };
  const onCleanupRetention = () => {
    if (!workspaceId) {
      return;
    }

    setRetentionCleanup(null);
    setRetentionCleanupError(null);
    cleanupSupportBundleRetention({
      input: {
        limit: 50,
        workspaceId,
      },
    })
      .then(result => {
        setRetentionCleanup(result.cleanupCopilotSupportBundleRetention);
        mutate().catch(error => {
          console.error(error);
        });
      })
      .catch(error => {
        console.error(error);
        setRetentionCleanupError(
          error instanceof Error ? error.message : String(error)
        );
      });
  };
  const onReplayForwardingEvent = (
    _bundle: SupportBundleRequest,
    event: SupportBundleTransferForwardingEvent
  ) => {
    if (!workspaceId) {
      return;
    }

    setForwardingReplay(null);
    setForwardingReplayError(null);
    replaySupportBundleTransferForwardingEvent({
      input: {
        forwardingEventId: event.id,
        workspaceId,
      },
    })
      .then(result => {
        setForwardingReplay(
          result.replayCopilotSupportBundleTransferForwardingEvent
        );
        mutate().catch(error => {
          console.error(error);
        });
      })
      .catch(error => {
        console.error(error);
        setForwardingReplayError(
          error instanceof Error ? error.message : String(error)
        );
      });
  };

  return (
    <Card className="border-border/60 bg-card shadow-1">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Support bundles</CardTitle>
            <CardDescription>
              DB-backed support bundle requests and minimal manifest metadata
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!workspaceId || isCleaningRetention}
              onClick={onCleanupRetention}
            >
              {isCleaningRetention ? 'Cleaning' : 'Cleanup retention'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!workspaceId || isMutating}
              onClick={onCreate}
            >
              {isMutating ? 'Creating' : 'Create bundle'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!workspaceId ? (
          <EmptyState>
            Select a workspace scope before creating or viewing support bundles.
          </EmptyState>
        ) : null}
        {createError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {createError}
          </div>
        ) : null}
        {downloadAuthorizationError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {downloadAuthorizationError}
          </div>
        ) : null}
        {retentionCleanupError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {retentionCleanupError}
          </div>
        ) : null}
        {forwardingReplayError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {forwardingReplayError}
          </div>
        ) : null}
        {createdBundle ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">Latest created bundle</div>
            <SupportBundleManifestBlock bundle={createdBundle} />
          </div>
        ) : null}
        {downloadAuthorization ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">
              Latest artifact download authorization
            </div>
            <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs">
              {compactList([
                downloadAuthorization.id,
                `status ${formatFeatureKind(downloadAuthorization.status)}`,
                `artifact ${downloadAuthorization.artifactFilename}`,
                `artifact fingerprint ${downloadAuthorization.artifactFingerprint}`,
                `manifest ${downloadAuthorization.manifestFingerprint}`,
                `authorization ${downloadAuthorization.authorizationFingerprint}`,
                `delivery ${formatFeatureKind(downloadAuthorization.deliveryMethod)}`,
                downloadAuthorization.directDownloadUrl
                  ? 'direct object-storage URL yes'
                  : 'direct object-storage URL no',
                downloadAuthorization.directDownloadExpiresAt
                  ? `direct expires ${formatActionRunTimestamp(
                      downloadAuthorization.directDownloadExpiresAt
                    )}`
                  : null,
                `expires ${formatActionRunTimestamp(downloadAuthorization.expiresAt)}`,
              ])}
            </div>
          </div>
        ) : null}
        {retentionCleanup ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">Latest retention cleanup</div>
            <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs">
              {compactList([
                retentionCleanup.cleanupFingerprint,
                `bundles ${retentionCleanup.expiredBundleCount}`,
                `authorizations ${retentionCleanup.expiredAuthorizationCount}`,
                `archive retries ${retentionCleanup.archiveObjectCleanupRetryCount}`,
                `archive recovered ${retentionCleanup.archiveObjectCleanupRecoveredCount}`,
                `archive failed ${retentionCleanup.archiveObjectCleanupFailedCount}`,
                `manifest retries ${retentionCleanup.manifestObjectRewriteRetryCount}`,
                `manifest recovered ${retentionCleanup.manifestObjectRewriteRecoveredCount}`,
                `manifest failed ${retentionCleanup.manifestObjectRewriteFailedCount}`,
                `cleaned ${formatActionRunTimestamp(retentionCleanup.cleanedAt)}`,
              ])}
            </div>
          </div>
        ) : null}
        {forwardingReplay ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">
              Latest transfer forwarding replay
            </div>
            <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs">
              {formatSupportBundleTransferForwardingEvent(forwardingReplay)}
            </div>
          </div>
        ) : null}
        {workspaceId ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[180px_1fr]">
            <Select
              value={forwardingStatusFilter}
              onValueChange={value => {
                setForwardingStatusFilter(
                  value as SupportBundleForwardingStatusFilter
                );
              }}
            >
              <SelectTrigger aria-label="Support bundle forwarding status">
                <SelectValue placeholder="All forwarding statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SUPPORT_BUNDLE_FORWARDING_ALL_STATUSES}>
                  All forwarding
                </SelectItem>
                {SUPPORT_BUNDLE_FORWARDING_STATUSES.map(status => (
                  <SelectItem key={status} value={status}>
                    {formatFeatureKind(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label="Support bundle forwarding filter"
              placeholder="Bundle, authorization, forwarding event, source, or fingerprint"
              value={forwardingQueryFilter}
              onChange={event => {
                setForwardingQueryFilter(event.target.value);
              }}
            />
          </div>
        ) : null}
        {workspaceId ? (
          <SupportBundleList
            authorizeDownload={onAuthorizeDownload}
            bundles={displayBundles}
            isAuthorizingDownload={isAuthorizingDownload}
            isReplayingForwardingEvent={isReplayingForwardingEvent}
            isValidating={isValidating}
            onReplayForwardingEvent={onReplayForwardingEvent}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatAgentRunTimestamp(
  value: AgentRunRecord['createdAt'] | null | undefined
) {
  return value ? formatActionRunTimestamp(String(value)) : 'None';
}

function formatAgentRunSteps(run: AgentRunRecord) {
  if (!run.steps.length) {
    return 'No persisted steps';
  }

  return run.steps
    .map(
      step =>
        `${step.stepKey}:${formatFeatureKind(step.stepType)}:${formatFeatureKind(step.status)}`
    )
    .join(' | ');
}

function formatAgentRunTimeline(run: AgentRunRecord) {
  if (!run.timelineEvents.length) {
    return 'No persisted timeline events';
  }

  return run.timelineEvents
    .map(
      event =>
        `#${event.ordinal}:${formatFeatureKind(event.eventType)}:${formatFeatureKind(event.status)}:${event.summary}`
    )
    .join(' | ');
}

function formatAgentRunExecutionResults(run: AgentRunRecord) {
  if (!run.executionResults.length) {
    return `Execution results ${run.executionResultCount}`;
  }

  return [
    `Execution results ${run.executionResultCount}`,
    run.executionResults
      .map(result =>
        compactList([
          formatFeatureKind(result.resultStatus),
          result.adapterWorkflow,
          result.executor,
          `attempt ${result.workerAttempt}`,
          `fingerprint ${result.resultFingerprint}`,
          `side effects ${
            result.sideEffectsApplied
              ? formatFeatureKind(result.sideEffectMode)
              : 'none'
          }`,
          result.failureCode
            ? `failure ${formatFeatureKind(result.failureCode)}`
            : null,
          result.summary,
        ])
      )
      .join(' | '),
  ].join(' / ');
}

function formatAgentRunWorkerState(run: AgentRunRecord) {
  return compactList([
    run.queuedAt ? `queued ${formatAgentRunTimestamp(run.queuedAt)}` : null,
    `worker attempt ${run.workerAttempt}/${run.workerMaxAttempts}`,
    run.lastAttemptAt
      ? `last attempt ${formatAgentRunTimestamp(run.lastAttemptAt)}`
      : null,
    run.workerLeaseId ? `lease ${run.workerLeaseId}` : null,
    run.workerLeaseExpiresAt
      ? `lease expires ${formatAgentRunTimestamp(run.workerLeaseExpiresAt)}`
      : null,
  ]);
}

function buildAgentRunListFilter(input: {
  status: AgentRunStatusFilter;
  query: string;
}) {
  const filter: {
    query?: string;
    status?: string;
  } = {};
  if (input.status !== AGENT_RUN_ALL_STATUSES) {
    filter.status = input.status;
  }
  const query = input.query.trim();
  if (query) {
    filter.query = /^[a-f0-9]{16}$/i.test(query) ? query.toLowerCase() : query;
  }
  return Object.keys(filter).length ? filter : undefined;
}

function RepairExecutionList({
  isValidating,
  repairExecutions,
}: {
  isValidating: boolean;
  repairExecutions: RepairExecutionRecord[];
}) {
  if (!repairExecutions.length) {
    return (
      <EmptyState>
        {isValidating
          ? 'Loading persisted repair execution requests.'
          : 'No persisted repair execution requests have been created for this workspace.'}
      </EmptyState>
    );
  }

  return (
    <TableViewport minWidth="min-w-[1200px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Request</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Fingerprints</TableHead>
            <TableHead>Runtime</TableHead>
            <TableHead>Ledger</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {repairExecutions.map(record => (
            <TableRow key={record.id}>
              <TableCell className="min-w-0 align-top">
                <div className="break-words font-medium">
                  {formatAIModelPromptDisplayName(record.promptName)}
                </div>
                <div className="mt-1 break-all text-xs text-muted-foreground">
                  {record.id}
                </div>
                <div className="mt-1 break-words text-xs text-muted-foreground">
                  {compactList([
                    `action ${record.requestedAction}`,
                    `actor ${record.actorId}`,
                  ])}
                </div>
              </TableCell>
              <TableCell className="align-top">
                <div className="flex flex-col gap-2">
                  <Badge variant="outline" className="w-fit font-normal">
                    {formatFeatureKind(record.status)}
                  </Badge>
                  <div className="break-words text-xs text-muted-foreground">
                    Approval {formatFeatureKind(record.approvalState)}
                  </div>
                  {record.failureCode ? (
                    <div className="break-words text-xs text-destructive">
                      {compactList([
                        formatFeatureKind(record.failureCode),
                        record.failureMessage ?? null,
                      ])}
                    </div>
                  ) : null}
                  <div className="break-words text-xs text-muted-foreground">
                    {compactList([
                      record.queuedAt
                        ? `queued ${formatActionRunTimestamp(record.queuedAt)}`
                        : null,
                      record.completedAt
                        ? `completed ${formatActionRunTimestamp(record.completedAt)}`
                        : null,
                      `attempt ${record.workerAttempt}/${record.workerMaxAttempts}`,
                      record.workerLeaseId
                        ? `lease ${record.workerLeaseId}`
                        : null,
                    ])}
                  </div>
                </div>
              </TableCell>
              <TableCell className="min-w-0 align-top">
                <div className="break-words text-xs text-muted-foreground">
                  {compactList([
                    `request ${record.requestFingerprint}`,
                    `idempotency ${record.idempotencyFingerprint}`,
                    `candidate ${record.candidateEvidenceSetFingerprint}`,
                    `task route ${record.taskRouteEvidenceSetFingerprint}`,
                    `target ${record.targetLocatorFingerprint}`,
                    `repair ${record.repairJobFingerprint}`,
                    `approval ${record.approvalRecordFingerprint}`,
                    `audit ${record.auditEventFingerprint}`,
                  ])}
                </div>
              </TableCell>
              <TableCell className="min-w-0 align-top">
                <div
                  className="break-words text-xs text-muted-foreground"
                  data-testid={`repair-execution-runtime-${record.id}`}
                >
                  {compactList([
                    `executor ${record.runtimeResult.executor}`,
                    record.runtimeResult.message,
                    record.runtimeResult.sideEffectsApplied
                      ? `side effects ${formatFeatureKind(
                          record.runtimeResult.sideEffectKind ?? 'applied'
                        )}`
                      : 'side effects none',
                    record.agentRun
                      ? `agent run ${record.agentRun.id}:${formatFeatureKind(
                          record.agentRun.status
                        )}`
                      : 'agent run none',
                  ])}
                </div>
              </TableCell>
              <TableCell className="min-w-0 align-top">
                <div
                  className="break-words text-xs text-muted-foreground"
                  data-testid={`repair-execution-ledger-${record.id}`}
                >
                  {formatRepairExecutionRecord(record)}
                </div>
              </TableCell>
              <TableCell className="align-top text-xs text-muted-foreground">
                {formatActionRunTimestamp(record.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableViewport>
  );
}

function RepairExecutionStatusCard({
  workspaceId,
}: {
  workspaceId: string | undefined;
}) {
  const [executionStatusFilter, setExecutionStatusFilter] =
    useState<RepairExecutionStatusFilter>(REPAIR_EXECUTION_ALL_STATUSES);
  const [executionQueryFilter, setExecutionQueryFilter] = useState('');
  const repairExecutionListFilter = useMemo(
    () =>
      buildRepairExecutionListFilter({
        status: executionStatusFilter,
        query: executionQueryFilter,
      }),
    [executionQueryFilter, executionStatusFilter]
  );
  const { data, isValidating } = useQuery(
    workspaceId
      ? {
          query: getCopilotRepairExecutionsQuery,
          variables: {
            ...(repairExecutionListFilter
              ? { filter: repairExecutionListFilter }
              : {}),
            limit: 8,
            workspaceId,
          },
        }
      : undefined
  );
  const repairExecutions =
    data?.currentUser?.copilot?.repairExecutions ?? EMPTY_REPAIR_EXECUTIONS;

  return (
    <Card className="border-border/60 bg-card shadow-1">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Repair executions</CardTitle>
            <CardDescription>
              Persisted repair request state, audit history, and side-effect
              ledger
            </CardDescription>
          </div>
          {workspaceId && isValidating ? (
            <Badge variant="outline" className="font-normal">
              Refreshing
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!workspaceId ? (
          <EmptyState>
            Select a workspace scope before viewing repair executions.
          </EmptyState>
        ) : null}
        {workspaceId ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[180px_1fr]">
            <Select
              value={executionStatusFilter}
              onValueChange={value => {
                setExecutionStatusFilter(value as RepairExecutionStatusFilter);
              }}
            >
              <SelectTrigger aria-label="Repair execution status">
                <SelectValue placeholder="All execution statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={REPAIR_EXECUTION_ALL_STATUSES}>
                  All executions
                </SelectItem>
                {REPAIR_EXECUTION_STATUSES.map(status => (
                  <SelectItem key={status} value={status}>
                    {formatFeatureKind(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label="Repair execution filter"
              placeholder="Request, prompt, action, approval, audit, side effect, failure, lease, or fingerprint"
              value={executionQueryFilter}
              onChange={event => {
                setExecutionQueryFilter(event.target.value);
              }}
            />
          </div>
        ) : null}
        {workspaceId ? (
          <RepairExecutionList
            isValidating={isValidating}
            repairExecutions={repairExecutions}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatAgentRuntimeWorkflowAdapter(
  adapter: AgentRuntimeWorkflowAdapter
) {
  return compactList([
    adapter.workflow,
    `version ${adapter.capabilities.version}`,
    `steps ${adapter.capabilities.supportedStepTypes
      .map(formatFeatureKind)
      .join(', ')}`,
    `side effects ${formatFeatureKind(adapter.capabilities.sideEffectMode)}`,
    adapter.capabilities.summary,
  ]);
}

function AgentRuntimeWorkflowAdapterList({
  adapters,
}: {
  adapters: AgentRuntimeWorkflowAdapter[];
}) {
  if (!adapters.length) {
    return (
      <EmptyState>
        No Agent Runtime workflow adapters are registered for standalone
        execution.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Workflow adapters</div>
      <div className="grid gap-2 md:grid-cols-2">
        {adapters.map(adapter => (
          <div
            key={adapter.workflow}
            className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs"
            data-testid={`agent-runtime-adapter-${adapter.workflow}`}
          >
            {formatAgentRuntimeWorkflowAdapter(adapter)}
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentRuntimeRunList({
  agentRuns,
  controlAgentRun,
  controlError,
  controlRecord,
  isControlling,
  isValidating,
}: {
  agentRuns: AgentRunRecord[];
  controlAgentRun: (run: AgentRunRecord, action: 'cancel' | 'resume') => void;
  controlError: string | null;
  controlRecord: AgentRuntimeControlRecord | null;
  isControlling: boolean;
  isValidating: boolean;
}) {
  if (!agentRuns.length) {
    return (
      <EmptyState>
        {isValidating
          ? 'Loading persisted Agent Runtime runs.'
          : 'No persisted Agent Runtime runs have been created for this workspace.'}
      </EmptyState>
    );
  }

  return (
    <TableViewport minWidth="min-w-[1260px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Steps</TableHead>
            <TableHead>Results</TableHead>
            <TableHead>Timeline</TableHead>
            <TableHead>Control</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agentRuns.map(run => (
            <TableRow key={run.id}>
              <TableCell className="min-w-0 align-top">
                <div className="break-words font-medium">
                  {run.title || run.workflow}
                </div>
                <div className="mt-1 break-all text-xs text-muted-foreground">
                  {run.id}
                </div>
                <div className="mt-1 break-words text-xs text-muted-foreground">
                  {compactList([
                    `workflow ${run.workflow}`,
                    `source ${run.sourceType}:${run.sourceId}`,
                    `actor ${run.actorId}`,
                  ])}
                </div>
                <div className="mt-1 break-words text-xs text-muted-foreground">
                  {compactList([
                    `target ${run.targetFingerprint}`,
                    `evidence ${run.evidenceFingerprint}`,
                    `timeline ${run.timelineFingerprint}`,
                  ])}
                </div>
              </TableCell>
              <TableCell className="align-top">
                <div className="flex flex-col gap-2">
                  <Badge variant="outline" className="w-fit font-normal">
                    {formatFeatureKind(run.status)}
                  </Badge>
                  {run.failureCode ? (
                    <div className="break-words text-xs text-destructive">
                      {compactList([
                        run.failureCode,
                        run.failureMessage ?? null,
                      ])}
                    </div>
                  ) : null}
                  <div className="break-words text-xs text-muted-foreground">
                    Started {formatAgentRunTimestamp(run.startedAt)}
                  </div>
                  <div className="break-words text-xs text-muted-foreground">
                    Completed {formatAgentRunTimestamp(run.completedAt)}
                  </div>
                  <div className="break-words text-xs text-muted-foreground">
                    {formatAgentRunWorkerState(run)}
                  </div>
                  {controlRecord?.id === run.id ? (
                    <div className="break-words text-xs text-muted-foreground">
                      Latest control {formatFeatureKind(controlRecord.status)}
                    </div>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="min-w-0 align-top">
                <div
                  className="break-words text-xs text-muted-foreground"
                  data-testid={`agent-runtime-steps-${run.id}`}
                >
                  {formatAgentRunSteps(run)}
                </div>
              </TableCell>
              <TableCell className="min-w-0 align-top">
                <div
                  className="break-words text-xs text-muted-foreground"
                  data-testid={`agent-runtime-results-${run.id}`}
                >
                  {formatAgentRunExecutionResults(run)}
                </div>
              </TableCell>
              <TableCell className="min-w-0 align-top">
                <div
                  className="break-words text-xs text-muted-foreground"
                  data-testid={`agent-runtime-timeline-${run.id}`}
                >
                  {formatAgentRunTimeline(run)}
                </div>
              </TableCell>
              <TableCell className="align-top">
                {run.sourceType === 'repair_execution_request' ? (
                  <div className="max-w-48 break-words text-xs text-muted-foreground">
                    Use repair execution controls
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        isControlling ||
                        run.status === 'completed' ||
                        run.status === 'failed' ||
                        run.status === 'cancelled'
                      }
                      onClick={() => controlAgentRun(run, 'cancel')}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        isControlling ||
                        (run.status !== 'failed' && run.status !== 'cancelled')
                      }
                      onClick={() => controlAgentRun(run, 'resume')}
                    >
                      Resume
                    </Button>
                  </div>
                )}
              </TableCell>
              <TableCell className="align-top text-xs text-muted-foreground">
                {formatAgentRunTimestamp(run.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {controlError ? (
        <div className="border-t border-border/70 p-3 text-xs text-destructive">
          Agent Runtime control error {controlError}
        </div>
      ) : null}
    </TableViewport>
  );
}

function AgentRuntimeStatusCard({
  workspaceId,
}: {
  workspaceId: string | undefined;
}) {
  const [controlRecord, setControlRecord] =
    useState<AgentRuntimeControlRecord | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [runStatusFilter, setRunStatusFilter] = useState<AgentRunStatusFilter>(
    AGENT_RUN_ALL_STATUSES
  );
  const [runQueryFilter, setRunQueryFilter] = useState('');
  const agentRunListFilter = useMemo(
    () =>
      buildAgentRunListFilter({
        status: runStatusFilter,
        query: runQueryFilter,
      }),
    [runQueryFilter, runStatusFilter]
  );
  const { data, isValidating, mutate } = useQuery(
    workspaceId
      ? {
          query: getCopilotAgentRunsQuery,
          variables: {
            ...(agentRunListFilter ? { filter: agentRunListFilter } : {}),
            limit: 8,
            workspaceId,
          },
        }
      : undefined
  );
  const {
    trigger: controlAgentRuntimeRunRequest,
    isMutating: isControllingAgentRuntimeRun,
  } = useMutation({
    mutation: controlCopilotAgentRuntimeRunMutation,
  });
  const agentRuns = data?.currentUser?.copilot?.agentRuns ?? EMPTY_AGENT_RUNS;
  const workflowAdapters =
    data?.currentUser?.copilot?.agentRuntimeWorkflowAdapters ??
    EMPTY_AGENT_RUNTIME_WORKFLOW_ADAPTERS;
  const displayAgentRuns =
    controlRecord && agentRuns.some(run => run.id === controlRecord.id)
      ? agentRuns.map(run =>
          run.id === controlRecord.id ? controlRecord : run
        )
      : controlRecord
        ? [controlRecord, ...agentRuns]
        : agentRuns;
  const controlAgentRun = (
    run: AgentRunRecord,
    action: 'cancel' | 'resume'
  ) => {
    if (!workspaceId) {
      return;
    }

    setControlRecord(null);
    setControlError(null);
    controlAgentRuntimeRunRequest({
      input: {
        action,
        runId: run.id,
        workspaceId,
      },
    })
      .then(data => {
        setControlRecord(data.controlCopilotAgentRuntimeRun);
        mutate?.()?.catch(error => {
          console.error(error);
        });
      })
      .catch(error => {
        console.error(error);
        setControlError(error instanceof Error ? error.message : String(error));
      });
  };

  return (
    <Card className="border-border/60 bg-card shadow-1">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Agent runtime runs</CardTitle>
            <CardDescription>
              Persisted AgentRun, AgentStep, and timeline state
            </CardDescription>
          </div>
          {workspaceId && isValidating ? (
            <Badge variant="outline" className="font-normal">
              Refreshing
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!workspaceId ? (
          <EmptyState>
            Select a workspace scope before viewing Agent Runtime runs.
          </EmptyState>
        ) : null}
        {workspaceId ? (
          <AgentRuntimeWorkflowAdapterList adapters={workflowAdapters} />
        ) : null}
        {workspaceId ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[180px_1fr]">
            <Select
              value={runStatusFilter}
              onValueChange={value => {
                setRunStatusFilter(value as AgentRunStatusFilter);
              }}
            >
              <SelectTrigger aria-label="Agent Runtime run status">
                <SelectValue placeholder="All run statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AGENT_RUN_ALL_STATUSES}>All runs</SelectItem>
                {AGENT_RUN_STATUSES.map(status => (
                  <SelectItem key={status} value={status}>
                    {formatFeatureKind(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label="Agent Runtime run filter"
              placeholder="Run, workflow, source, failure, lease, or fingerprint"
              value={runQueryFilter}
              onChange={event => {
                setRunQueryFilter(event.target.value);
              }}
            />
          </div>
        ) : null}
        {workspaceId ? (
          <AgentRuntimeRunList
            agentRuns={displayAgentRuns}
            controlAgentRun={controlAgentRun}
            controlError={controlError}
            controlRecord={controlRecord}
            isControlling={isControllingAgentRuntimeRun}
            isValidating={isValidating}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function AiPageSkeleton() {
  return (
    <div className="flex h-dvh flex-1 flex-col bg-background">
      <Header title="AI" />
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-5 sm:px-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}

function AiPageTabs({ active }: { active: 'config' | 'runtime' }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        asChild
        variant={active === 'config' ? 'default' : 'outline'}
        size="sm"
      >
        <Link to={AI_CONFIG_PATH}>Configuration</Link>
      </Button>
      <Button
        asChild
        variant={active === 'runtime' ? 'default' : 'outline'}
        size="sm"
      >
        <Link to={AI_RUNTIME_PATH}>Runtime</Link>
      </Button>
    </div>
  );
}

function AiConfigField({
  children,
  description,
  label,
}: {
  children: ReactNode;
  description?: string;
  label: string;
}) {
  return (
    <label className="block min-w-0 space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {description ? (
        <span className="block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      ) : null}
    </label>
  );
}

function AiJsonConfigField({
  description,
  label,
  onChange,
  rows = 8,
  value,
}: {
  description: string;
  label: string;
  onChange: (value: string) => void;
  rows?: number;
  value: string;
}) {
  return (
    <AiConfigField description={description} label={label}>
      <Textarea
        className="min-h-32 font-mono text-xs leading-5"
        rows={rows}
        spellCheck={false}
        value={value}
        onChange={event => onChange(event.target.value)}
      />
    </AiConfigField>
  );
}

function AiConfigSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card className="min-w-0 border-border/60 bg-card shadow-1">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function AiConfigPage({
  appConfig,
  onSaved,
}: {
  appConfig: AppConfigData | undefined;
  onSaved: () => Promise<unknown>;
}) {
  const savedDraft = useMemo(() => buildAiConfigDraft(appConfig), [appConfig]);
  const [draft, setDraft] = useState(savedDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const { trigger: updateAppConfig, isMutating } = useMutation({
    mutation: updateAppConfigMutation,
  });
  const providers = appConfig?.copilot?.providers;
  const openai = providers?.openai ?? {};
  const openaiCompatible = providers?.openaiCompatible ?? {};
  const cloudflareWorkersAi = providers?.cloudflareWorkersAi ?? {};
  const gemini = providers?.gemini ?? {};
  const anthropic = providers?.anthropic ?? {};
  const fal = providers?.fal ?? {};
  const enterpriseAllowedProviders = new Set(
    parseCsvList(draft.enterpriseCliAllowedProviders)
  );
  const isDirty = !isSameAiConfigDraft(savedDraft, draft);
  const openaiBaseURL = draft.openaiBaseURL.trim() || DEFAULT_OPENAI_BASE_URL;
  const openaiCompatibleBaseURL = draft.openaiCompatibleBaseURL.trim();
  const geminiBaseURL = draft.geminiBaseURL.trim() || DEFAULT_GEMINI_BASE_URL;
  const anthropicBaseURL =
    draft.anthropicBaseURL.trim() || DEFAULT_ANTHROPIC_BASE_URL;
  const canSave =
    isDirty &&
    !isMutating &&
    (!trimOptionalSecret(draft.openaiCompatibleApiKey) ||
      Boolean(openaiCompatibleBaseURL));

  useEffect(() => {
    setDraft(savedDraft);
    setFormError(null);
  }, [savedDraft]);

  const updateDraft = <Key extends keyof AiConfigDraft>(
    key: Key,
    value: AiConfigDraft[Key]
  ) => {
    setDraft(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSave) {
      return;
    }

    const openaiCompatibleHeaders = parseJsonConfig(
      draft,
      'openaiCompatibleHeadersJson',
      'OpenAI-compatible headers'
    );
    const providerProfiles = parseJsonConfig(
      draft,
      'providerProfilesJson',
      'Provider profiles'
    );
    const providerDefaults = parseJsonConfig(
      draft,
      'providerDefaultsJson',
      'Provider defaults'
    );
    const routePolicy = parseJsonConfig(
      draft,
      'routePolicyJson',
      'Route policy'
    );
    const promptDefaults = parseJsonConfig(
      draft,
      'promptDefaultsJson',
      'Prompt defaults'
    );
    const promptOverrides = parseJsonConfig(
      draft,
      'promptOverridesJson',
      'Prompt overrides'
    );
    const supportBundleWebhooks = parseJsonConfig(
      draft,
      'supportBundleWebhooksJson',
      'Support bundle object-storage webhooks'
    );
    const storage = parseJsonConfig(draft, 'storageJson', 'Copilot storage');
    const geminiVertex = parseJsonConfig(
      draft,
      'geminiVertexJson',
      'Gemini Vertex'
    );
    const anthropicVertex = parseJsonConfig(
      draft,
      'anthropicVertexJson',
      'Anthropic Vertex'
    );
    const parsedConfigs = [
      openaiCompatibleHeaders,
      providerProfiles,
      providerDefaults,
      routePolicy,
      promptDefaults,
      promptOverrides,
      supportBundleWebhooks,
      storage,
      geminiVertex,
      anthropicVertex,
    ];
    const invalidConfig = parsedConfigs.find(
      (result): result is { error: string; label: string } => 'error' in result
    );

    if (invalidConfig) {
      setFormError(invalidConfig.error);
      return;
    }

    setFormError(null);
    updateAppConfig({
      updates: [
        {
          module: 'copilot',
          key: 'enabled',
          value: draft.enabled,
        },
        {
          module: 'copilot',
          key: 'byok.enabled',
          value: draft.byokEnabled,
        },
        {
          module: 'copilot',
          key: 'byok.allowedProviders',
          value: parseCsvList(draft.byokAllowedProviders),
        },
        {
          module: 'copilot',
          key: 'byok.allowCustomEndpoint',
          value: draft.byokAllowCustomEndpoint,
        },
        {
          module: 'copilot',
          key: 'byok.allowPrivateEndpoint',
          value: draft.byokAllowPrivateEndpoint,
        },
        {
          module: 'copilot',
          key: 'enterpriseCli.enabled',
          value: draft.enterpriseCliEnabled,
        },
        {
          module: 'copilot',
          key: 'enterpriseCli.allowedProviders',
          value: parseCsvList(draft.enterpriseCliAllowedProviders),
        },
        {
          module: 'copilot',
          key: 'enterpriseCli.allowedToolsByProvider',
          value: {
            wecom: parseCsvList(draft.enterpriseCliWecomAllowedTools),
            lark: parseCsvList(draft.enterpriseCliLarkAllowedTools),
            dingtalk: parseCsvList(draft.enterpriseCliDingTalkAllowedTools),
          },
        },
        {
          module: 'copilot',
          key: 'providers.openai',
          value: {
            ...openai,
            apiKey: trimOptionalSecret(draft.openaiApiKey),
            baseURL: openaiBaseURL,
            oldApiStyle: draft.openaiOldApiStyle,
          },
        },
        {
          module: 'copilot',
          key: 'providers.openaiCompatible',
          value: {
            ...openaiCompatible,
            apiKey: trimOptionalSecret(draft.openaiCompatibleApiKey),
            apiStyle: draft.openaiCompatibleApiStyle,
            baseURL: openaiCompatibleBaseURL,
            headers: getParsedJsonConfigValue(openaiCompatibleHeaders),
          },
        },
        {
          module: 'copilot',
          key: 'providers.cloudflareWorkersAi',
          value: {
            ...cloudflareWorkersAi,
            accountId: draft.cloudflareWorkersAiAccountId.trim(),
            apiToken: trimOptionalSecret(draft.cloudflareWorkersAiApiToken),
            baseURL: draft.cloudflareWorkersAiBaseURL.trim(),
          },
        },
        {
          module: 'copilot',
          key: 'providers.fal',
          value: {
            ...fal,
            apiKey: trimOptionalSecret(draft.falApiKey),
          },
        },
        {
          module: 'copilot',
          key: 'providers.gemini',
          value: {
            ...gemini,
            apiKey: trimOptionalSecret(draft.geminiApiKey),
            baseURL: geminiBaseURL,
          },
        },
        {
          module: 'copilot',
          key: 'providers.geminiVertex',
          value: getParsedJsonConfigValue(geminiVertex),
        },
        {
          module: 'copilot',
          key: 'providers.anthropic',
          value: {
            ...anthropic,
            apiKey: trimOptionalSecret(draft.anthropicApiKey),
            baseURL: anthropicBaseURL,
          },
        },
        {
          module: 'copilot',
          key: 'providers.anthropicVertex',
          value: getParsedJsonConfigValue(anthropicVertex),
        },
        {
          module: 'copilot',
          key: 'providers.profiles',
          value: getParsedJsonConfigValue(providerProfiles),
        },
        {
          module: 'copilot',
          key: 'providers.defaults',
          value: getParsedJsonConfigValue(providerDefaults),
        },
        {
          module: 'copilot',
          key: 'providers.routePolicy',
          value: getParsedJsonConfigValue(routePolicy),
        },
        {
          module: 'copilot',
          key: 'prompts.defaults',
          value: getParsedJsonConfigValue(promptDefaults),
        },
        {
          module: 'copilot',
          key: 'prompts.overrides',
          value: getParsedJsonConfigValue(promptOverrides),
        },
        {
          module: 'copilot',
          key: 'tasks.models',
          value: {
            ...(draft.taskEmbeddingModel.trim()
              ? { embedding: draft.taskEmbeddingModel.trim() }
              : {}),
            ...(draft.taskWorkspaceIndexingModel.trim()
              ? { workspaceIndexing: draft.taskWorkspaceIndexingModel.trim() }
              : {}),
            ...(draft.taskRerankModel.trim()
              ? { rerank: draft.taskRerankModel.trim() }
              : {}),
          },
        },
        {
          module: 'copilot',
          key: 'supportBundles.objectStorageWebhooks',
          value: getParsedJsonConfigValue(supportBundleWebhooks),
        },
        {
          module: 'copilot',
          key: 'unsplash',
          value: {
            key: trimOptionalSecret(draft.unsplashKey),
          },
        },
        {
          module: 'copilot',
          key: 'exa',
          value: {
            key: trimOptionalSecret(draft.exaKey),
          },
        },
        {
          module: 'copilot',
          key: 'storage',
          value: getParsedJsonConfigValue(storage),
        },
      ],
    })
      .then(() => onSaved())
      .then(() => {
        toast.success('AI configuration saved.');
      })
      .catch(error => {
        console.error(error);
        toast.error('Failed to save AI configuration.');
      });
  };

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <AiConfigSection
        title="AI capability switches"
        description="Global AI enablement and workspace BYOK policy."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <div className="flex items-center justify-between gap-4 rounded-md border border-border/70 bg-muted/20 p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Server AI</div>
              <div className="text-xs text-muted-foreground">
                Enables chat, actions, search, indexing, rerank, and runtime
                workers.
              </div>
            </div>
            <Switch
              checked={draft.enabled}
              onCheckedChange={checked => updateDraft('enabled', checked)}
              aria-label="Enable AI"
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md border border-border/70 bg-muted/20 p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Workspace BYOK</div>
              <div className="text-xs text-muted-foreground">
                Lets instance administrators assign approved server credentials
                to department workspaces.
              </div>
            </div>
            <Switch
              checked={draft.byokEnabled}
              onCheckedChange={checked => updateDraft('byokEnabled', checked)}
              aria-label="Enable workspace BYOK"
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md border border-border/70 bg-muted/20 p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">BYOK custom endpoint</div>
              <div className="text-xs text-muted-foreground">
                Lets workspace BYOK profiles use custom compatible endpoints.
              </div>
            </div>
            <Switch
              checked={draft.byokAllowCustomEndpoint}
              onCheckedChange={checked =>
                updateDraft('byokAllowCustomEndpoint', checked)
              }
              aria-label="Allow BYOK custom endpoint"
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md border border-border/70 bg-muted/20 p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">BYOK private endpoints</div>
              <div className="text-xs text-muted-foreground">
                Allows trusted private-network targets. Takes effect only when
                custom endpoints are enabled.
              </div>
            </div>
            <Switch
              checked={draft.byokAllowPrivateEndpoint}
              onCheckedChange={checked =>
                updateDraft('byokAllowPrivateEndpoint', checked)
              }
              aria-label="Allow BYOK private endpoint"
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md border border-border/70 bg-muted/20 p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Enterprise CLI</div>
              <div className="text-xs text-muted-foreground">
                Enables governed user connections for enterprise platforms.
              </div>
            </div>
            <Switch
              checked={draft.enterpriseCliEnabled}
              onCheckedChange={checked =>
                updateDraft('enterpriseCliEnabled', checked)
              }
              aria-label="Enable Enterprise CLI"
            />
          </div>
        </div>
        <AiConfigField
          label="BYOK allowed providers"
          description="Comma-separated provider ids available for per-workspace BYOK routing."
        >
          <Input
            value={draft.byokAllowedProviders}
            onChange={event => {
              updateDraft('byokAllowedProviders', event.target.value);
            }}
          />
        </AiConfigField>
      </AiConfigSection>

      <AiConfigSection
        title="Enterprise CLI governance"
        description="Instance policy is the maximum capability. Users authorize and manage only their own platform connections."
      >
        <div className="overflow-hidden rounded-md border border-border/70">
          {ENTERPRISE_CLI_PROVIDERS.map((provider, index) => {
            const allowed = enterpriseAllowedProviders.has(provider.id);
            return (
              <div
                className={cn(
                  'grid min-w-0 gap-3 p-4 md:grid-cols-[180px_minmax(0,1fr)] md:items-center',
                  index ? 'border-t border-border/70' : null
                )}
                key={provider.id}
              >
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{provider.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {allowed ? 'Provider allowed' : 'Provider blocked'}
                    </div>
                  </div>
                  <Switch
                    checked={allowed}
                    disabled={!draft.enterpriseCliEnabled}
                    aria-label={`Allow ${provider.label} connections`}
                    onCheckedChange={checked => {
                      const next = new Set(enterpriseAllowedProviders);
                      if (checked) next.add(provider.id);
                      else next.delete(provider.id);
                      updateDraft(
                        'enterpriseCliAllowedProviders',
                        ENTERPRISE_CLI_PROVIDERS.filter(item =>
                          next.has(item.id)
                        )
                          .map(item => item.id)
                          .join(', ')
                      );
                    }}
                  />
                </div>
                <AiConfigField
                  label="Allowed tool names"
                  description="Comma-separated exact tool names. Use * only to allow the full discovered catalog for this provider."
                >
                  <Input
                    disabled={!draft.enterpriseCliEnabled || !allowed}
                    placeholder="tool_name, another_tool"
                    value={draft[provider.toolsKey]}
                    onChange={event => {
                      updateDraft(provider.toolsKey, event.target.value);
                    }}
                  />
                </AiConfigField>
              </div>
            );
          })}
        </div>
      </AiConfigSection>

      <AiConfigSection
        title="Provider credentials"
        description="Provider-level API credentials and endpoints used by server-side AI routing."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="space-y-3 rounded-md border border-border/60 bg-muted/10 p-4">
            <div className="text-sm font-medium">OpenAI</div>
            <AiConfigField label="API key">
              <Input
                type="password"
                autoComplete="off"
                placeholder="sk-..."
                value={draft.openaiApiKey}
                onChange={event => {
                  updateDraft('openaiApiKey', event.target.value);
                }}
              />
            </AiConfigField>
            <AiConfigField label="Base URL">
              <Input
                placeholder={DEFAULT_OPENAI_BASE_URL}
                value={draft.openaiBaseURL}
                onChange={event => {
                  updateDraft('openaiBaseURL', event.target.value);
                }}
              />
            </AiConfigField>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Legacy chat completions style
              </span>
              <Switch
                checked={draft.openaiOldApiStyle}
                onCheckedChange={checked =>
                  updateDraft('openaiOldApiStyle', checked)
                }
                aria-label="Use OpenAI legacy API style"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-border/60 bg-muted/10 p-4">
            <div className="text-sm font-medium">OpenAI-compatible</div>
            <AiConfigField label="API key">
              <Input
                type="password"
                autoComplete="off"
                placeholder="Optional for local endpoints"
                value={draft.openaiCompatibleApiKey}
                onChange={event => {
                  updateDraft('openaiCompatibleApiKey', event.target.value);
                }}
              />
            </AiConfigField>
            <AiConfigField label="Base URL">
              <Input
                placeholder="http://localhost:11434/v1"
                value={draft.openaiCompatibleBaseURL}
                onChange={event => {
                  updateDraft('openaiCompatibleBaseURL', event.target.value);
                }}
              />
            </AiConfigField>
            <AiConfigField label="Request API style">
              <Select
                value={draft.openaiCompatibleApiStyle}
                onValueChange={value => {
                  updateDraft(
                    'openaiCompatibleApiStyle',
                    normalizeOpenAICompatibleApiStyle(value)
                  );
                }}
              >
                <SelectTrigger aria-label="OpenAI-compatible request API style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chat_completions">
                    Chat Completions
                  </SelectItem>
                  <SelectItem value="responses">Responses</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                </SelectContent>
              </Select>
            </AiConfigField>
            <AiJsonConfigField
              label="Headers JSON"
              description="Optional static headers sent to compatible endpoints."
              rows={4}
              value={draft.openaiCompatibleHeadersJson}
              onChange={value =>
                updateDraft('openaiCompatibleHeadersJson', value)
              }
            />
          </div>

          <div className="space-y-3 rounded-md border border-border/60 bg-muted/10 p-4">
            <div className="text-sm font-medium">Gemini</div>
            <AiConfigField label="API key">
              <Input
                type="password"
                autoComplete="off"
                value={draft.geminiApiKey}
                onChange={event => {
                  updateDraft('geminiApiKey', event.target.value);
                }}
              />
            </AiConfigField>
            <AiConfigField label="Base URL">
              <Input
                placeholder={DEFAULT_GEMINI_BASE_URL}
                value={draft.geminiBaseURL}
                onChange={event => {
                  updateDraft('geminiBaseURL', event.target.value);
                }}
              />
            </AiConfigField>
          </div>

          <div className="space-y-3 rounded-md border border-border/60 bg-muted/10 p-4">
            <div className="text-sm font-medium">Anthropic</div>
            <AiConfigField label="API key">
              <Input
                type="password"
                autoComplete="off"
                value={draft.anthropicApiKey}
                onChange={event => {
                  updateDraft('anthropicApiKey', event.target.value);
                }}
              />
            </AiConfigField>
            <AiConfigField label="Base URL">
              <Input
                placeholder={DEFAULT_ANTHROPIC_BASE_URL}
                value={draft.anthropicBaseURL}
                onChange={event => {
                  updateDraft('anthropicBaseURL', event.target.value);
                }}
              />
            </AiConfigField>
          </div>

          <div className="space-y-3 rounded-md border border-border/60 bg-muted/10 p-4">
            <div className="text-sm font-medium">Cloudflare Workers AI</div>
            <AiConfigField label="API token">
              <Input
                type="password"
                autoComplete="off"
                value={draft.cloudflareWorkersAiApiToken}
                onChange={event => {
                  updateDraft(
                    'cloudflareWorkersAiApiToken',
                    event.target.value
                  );
                }}
              />
            </AiConfigField>
            <AiConfigField label="Account ID">
              <Input
                value={draft.cloudflareWorkersAiAccountId}
                onChange={event => {
                  updateDraft(
                    'cloudflareWorkersAiAccountId',
                    event.target.value
                  );
                }}
              />
            </AiConfigField>
            <AiConfigField label="Base URL">
              <Input
                value={draft.cloudflareWorkersAiBaseURL}
                onChange={event => {
                  updateDraft('cloudflareWorkersAiBaseURL', event.target.value);
                }}
              />
            </AiConfigField>
          </div>

          <div className="space-y-3 rounded-md border border-border/60 bg-muted/10 p-4">
            <div className="text-sm font-medium">FAL</div>
            <AiConfigField label="API key">
              <Input
                type="password"
                autoComplete="off"
                value={draft.falApiKey}
                onChange={event => {
                  updateDraft('falApiKey', event.target.value);
                }}
              />
            </AiConfigField>
          </div>
        </div>

        {!openaiCompatibleBaseURL &&
        trimOptionalSecret(draft.openaiCompatibleApiKey) ? (
          <div className="text-sm text-destructive">
            OpenAI-compatible base URL is required when an API key is set.
          </div>
        ) : null}
      </AiConfigSection>

      <AiConfigSection
        title="Provider registry and routing"
        description="Configure provider profiles, output defaults, route policy, and Vertex provider credentials."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <AiJsonConfigField
            label="Provider profiles JSON"
            description="copilot.providers.profiles: provider ids, privacy, priority, middleware, models, modelDefinitions, and provider-specific config."
            rows={12}
            value={draft.providerProfilesJson}
            onChange={value => updateDraft('providerProfilesJson', value)}
          />
          <AiJsonConfigField
            label="Provider defaults JSON"
            description="copilot.providers.defaults: defaults for text, object, embedding, image, rerank, structured, and fallback provider ids."
            value={draft.providerDefaultsJson}
            onChange={value => updateDraft('providerDefaultsJson', value)}
          />
          <AiJsonConfigField
            label="Route policy JSON"
            description="copilot.providers.routePolicy: global, per-feature, and per-workspace allow/block/privacy routing policy."
            rows={10}
            value={draft.routePolicyJson}
            onChange={value => updateDraft('routePolicyJson', value)}
          />
          <AiJsonConfigField
            label="Gemini Vertex JSON"
            description="copilot.providers.geminiVertex: location, project, baseURL, and googleAuthOptions."
            value={draft.geminiVertexJson}
            onChange={value => updateDraft('geminiVertexJson', value)}
          />
          <AiJsonConfigField
            label="Anthropic Vertex JSON"
            description="copilot.providers.anthropicVertex: location, project, baseURL, and googleAuthOptions."
            value={draft.anthropicVertexJson}
            onChange={value => updateDraft('anthropicVertexJson', value)}
          />
        </div>
      </AiConfigSection>

      <AiConfigSection
        title="Prompt and task models"
        description="Configure prompt model defaults, prompt-specific overrides, embedding, workspace indexing, and rerank aliases."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <AiConfigField
            label="Embedding model alias"
            description="copilot.tasks.models.embedding"
          >
            <Input
              value={draft.taskEmbeddingModel}
              onChange={event => {
                updateDraft('taskEmbeddingModel', event.target.value);
              }}
            />
          </AiConfigField>
          <AiConfigField
            label="Workspace indexing model alias"
            description="copilot.tasks.models.workspaceIndexing"
          >
            <Input
              value={draft.taskWorkspaceIndexingModel}
              onChange={event => {
                updateDraft('taskWorkspaceIndexingModel', event.target.value);
              }}
            />
          </AiConfigField>
          <AiConfigField
            label="Rerank model alias"
            description="copilot.tasks.models.rerank"
          >
            <Input
              value={draft.taskRerankModel}
              onChange={event => {
                updateDraft('taskRerankModel', event.target.value);
              }}
            />
          </AiConfigField>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <AiJsonConfigField
            label="Prompt defaults JSON"
            description="copilot.prompts.defaults: text, structured, image, and transcript default model policies."
            rows={10}
            value={draft.promptDefaultsJson}
            onChange={value => updateDraft('promptDefaultsJson', value)}
          />
          <AiJsonConfigField
            label="Prompt overrides JSON"
            description="copilot.prompts.overrides: per-prompt model, optionalModels, enabled state, and prompt config."
            rows={10}
            value={draft.promptOverridesJson}
            onChange={value => updateDraft('promptOverridesJson', value)}
          />
        </div>
      </AiConfigSection>

      <AiConfigSection
        title="Search, assets, storage, and support bundles"
        description="Configure web search, image source, copilot storage, and support bundle transfer webhooks."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AiConfigField label="Unsplash key">
            <Input
              type="password"
              autoComplete="off"
              value={draft.unsplashKey}
              onChange={event => {
                updateDraft('unsplashKey', event.target.value);
              }}
            />
          </AiConfigField>
          <AiConfigField label="Exa web search key">
            <Input
              type="password"
              autoComplete="off"
              value={draft.exaKey}
              onChange={event => {
                updateDraft('exaKey', event.target.value);
              }}
            />
          </AiConfigField>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <AiJsonConfigField
            label="Copilot storage JSON"
            description="copilot.storage: provider, bucket, and storage provider config used by copilot artifacts."
            rows={8}
            value={draft.storageJson}
            onChange={value => updateDraft('storageJson', value)}
          />
          <AiJsonConfigField
            label="Support bundle object-storage webhooks JSON"
            description="copilot.supportBundles.objectStorageWebhooks: HMAC webhook definitions for support bundle direct-download notifications."
            rows={8}
            value={draft.supportBundleWebhooksJson}
            onChange={value => updateDraft('supportBundleWebhooksJson', value)}
          />
        </div>
      </AiConfigSection>

      {formError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-background/95 py-4 backdrop-blur">
        <div className="text-sm text-muted-foreground">
          {isDirty
            ? 'Unsaved AI configuration changes'
            : 'AI configuration is up to date'}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {isDirty ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 min-w-[88px]"
              disabled={isMutating}
              onClick={() => setDraft(savedDraft)}
            >
              Cancel
            </Button>
          ) : null}
          <Button
            type="submit"
            className="h-9 min-w-[88px]"
            disabled={!canSave}
          >
            {isMutating ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function AiConfigPageContent() {
  const { data: appConfigData, mutate: mutateAppConfig } = useQuery({
    query: appConfigQuery,
  });

  return (
    <div className="flex h-dvh flex-1 flex-col bg-background">
      <Header title="AI" />
      <ScrollArea className="h-full">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-5 sm:px-6">
          <AiPageTabs active="config" />
          <ProjectByokAdmin />
          <AiConfigPage
            appConfig={appConfigData.appConfig as AppConfigData | undefined}
            onSaved={async () => {
              await mutateAppConfig();
            }}
          />
          <WorkspaceByokAdmin />
        </div>
      </ScrollArea>
    </div>
  );
}

function AiRuntimePageContent() {
  const [promptName, setPromptName] = useState(ADMIN_AI_DEFAULT_PROMPT_NAME);
  const [promptNameInput, setPromptNameInput] = useState(
    ADMIN_AI_DEFAULT_PROMPT_NAME
  );
  const [promptCatalogSearch, setPromptCatalogSearch] = useState('');
  const [promptCatalogCategory, setPromptCatalogCategory] = useState(
    PROMPT_CATALOG_ALL_CATEGORIES
  );
  const [workspaceId, setWorkspaceId] = useState<string | undefined>();
  const [workspaceIdInput, setWorkspaceIdInput] = useState('');
  const [actionRunId, setActionRunId] = useState('');
  const [actionRunIdInput, setActionRunIdInput] = useState('');
  const nextPromptName = promptNameInput.trim() || ADMIN_AI_DEFAULT_PROMPT_NAME;
  const nextWorkspaceId = workspaceIdInput.trim() || undefined;
  const nextActionRunId = actionRunIdInput.trim();
  const promptCatalogData = usePromptCatalogData(workspaceId);
  const workspaceScopeData = useWorkspaceScopeData();
  const promptCatalog =
    promptCatalogData.currentUser?.copilot?.prompts ?? EMPTY_PROMPT_CATALOG;
  const workspaceScopes =
    workspaceScopeData.workspaces ?? EMPTY_WORKSPACE_SCOPES;
  const promptCatalogCategories = useMemo(
    () =>
      [...new Set(promptCatalog.map(prompt => prompt.category))]
        .filter(Boolean)
        .sort((a, b) =>
          formatFeatureKind(a).localeCompare(formatFeatureKind(b))
        ),
    [promptCatalog]
  );
  const filteredPromptCatalog = useMemo(() => {
    const search = promptCatalogSearch.trim().toLocaleLowerCase();

    return promptCatalog.filter(prompt => {
      const matchesCategory =
        promptCatalogCategory === PROMPT_CATALOG_ALL_CATEGORIES ||
        prompt.category === promptCatalogCategory;

      return matchesCategory && matchesPromptCatalogSearch(prompt, search);
    });
  }, [promptCatalog, promptCatalogCategory, promptCatalogSearch]);
  const activePromptMetadata = promptCatalog.find(
    prompt => prompt.name === promptName
  );
  const selectedCatalogPromptName = filteredPromptCatalog.some(
    prompt => prompt.name === promptNameInput
  )
    ? promptNameInput
    : undefined;
  const selectedWorkspaceScope = nextWorkspaceId
    ? workspaceScopes.some(workspace => workspace.id === nextWorkspaceId)
      ? nextWorkspaceId
      : WORKSPACE_SCOPE_MANUAL
    : WORKSPACE_SCOPE_GLOBAL;
  const activeWorkspaceScope = workspaceId
    ? workspaceScopes.find(workspace => workspace.id === workspaceId)
    : undefined;
  const { data, isValidating, mutate } = useQuery({
    query: getPromptModelsQuery,
    variables: {
      promptName,
      workspaceId,
    },
  });
  const modelsPayload = data.currentUser?.copilot?.models;
  const models = useMemo(
    () => (modelsPayload ? buildAIModels(modelsPayload) : []),
    [modelsPayload]
  );
  const activeDefaultModel = useMemo(
    () =>
      models.find(model => model.id === modelsPayload?.defaultModel) ??
      models.find(model => model.isDefault) ??
      null,
    [models, modelsPayload?.defaultModel]
  );
  const activeDefaultSourceChain = activeDefaultModel
    ? formatAIModelSourcesLabel(activeDefaultModel)
    : null;
  const activeDefaultPromptSourceChain = activeDefaultModel
    ? formatAIModelPromptSourcesLabel(activeDefaultModel)
    : null;
  const diagnostics = useMemo(
    () =>
      getAIModelTaskRoutesDiagnostics({
        embeddingRoute: modelsPayload?.embeddingRoute,
        rerankRoute: modelsPayload?.rerankRoute,
      }),
    [modelsPayload?.embeddingRoute, modelsPayload?.rerankRoute]
  );
  const promptDefaultDiagnostics = useMemo(
    () => getAIModelPromptDefaultDiagnostics(modelsPayload),
    [modelsPayload]
  );
  const recommendedActionKinds = useMemo(
    () =>
      Array.from(
        new Set([
          ...promptDefaultDiagnostics.actionKinds,
          ...diagnostics.actionKinds,
        ])
      ),
    [diagnostics.actionKinds, promptDefaultDiagnostics.actionKinds]
  );
  const [embeddingDiagnostics, rerankDiagnostics] = diagnostics.routes;

  const onPromptSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPromptName(nextPromptName);
    setWorkspaceId(nextWorkspaceId);
  };
  const onActionRunSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionRunId(nextActionRunId);
  };
  const onActionRunSelect = (runId: string) => {
    setActionRunIdInput(runId);
    setActionRunId(runId);
  };

  return (
    <div className="flex h-dvh flex-1 flex-col bg-background">
      <Header
        title="AI"
        endFix={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              mutate().catch(err => {
                console.error(err);
              });
            }}
          >
            <RefreshCwIcon
              className={cn('h-4 w-4', isValidating && 'animate-spin')}
            />
            Refresh
          </Button>
        }
      />
      <ScrollArea className="h-full">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-5 sm:px-6">
          <AiPageTabs active="runtime" />

          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_360px] 2xl:items-start">
            <Card className="order-2 min-w-0 border-border/60 bg-card shadow-1 2xl:order-1">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      Model route diagnostics
                    </CardTitle>
                    <CardDescription>
                      Read-only task route checks for self-hosted AI providers
                    </CardDescription>
                  </div>
                  <StatusBadge status={diagnostics.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <form className="space-y-3" onSubmit={onPromptSubmit}>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="min-w-0">
                      <span className="text-xs text-muted-foreground">
                        Prompt catalog
                      </span>
                      <Select
                        value={selectedCatalogPromptName ?? ''}
                        onValueChange={value => {
                          setPromptNameInput(value);
                        }}
                      >
                        <SelectTrigger
                          aria-label="Prompt catalog"
                          className="mt-1"
                        >
                          <SelectValue placeholder="Select prompt" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredPromptCatalog.map(prompt => (
                            <SelectItem key={prompt.name} value={prompt.name}>
                              {formatAIModelPromptDisplayName(prompt.name)}
                            </SelectItem>
                          ))}
                          {!filteredPromptCatalog.length ? (
                            <div className="px-2 py-2 text-sm text-muted-foreground">
                              No prompts match the current filters.
                            </div>
                          ) : null}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="min-w-0">
                      <span className="text-xs text-muted-foreground">
                        Prompt search
                      </span>
                      <Input
                        className="mt-1"
                        placeholder="Search prompts, actions, or models"
                        value={promptCatalogSearch}
                        onChange={event => {
                          setPromptCatalogSearch(event.target.value);
                        }}
                      />
                    </label>
                    <label className="min-w-0">
                      <span className="text-xs text-muted-foreground">
                        Prompt category
                      </span>
                      <Select
                        value={promptCatalogCategory}
                        onValueChange={value => {
                          setPromptCatalogCategory(value);
                        }}
                      >
                        <SelectTrigger
                          aria-label="Prompt category"
                          className="mt-1"
                        >
                          <SelectValue placeholder="All categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={PROMPT_CATALOG_ALL_CATEGORIES}>
                            All categories
                          </SelectItem>
                          {promptCatalogCategories.map(category => (
                            <SelectItem key={category} value={category}>
                              {formatFeatureKind(category)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="min-w-0">
                      <span className="text-xs text-muted-foreground">
                        Prompt name
                      </span>
                      <Input
                        className="mt-1"
                        value={formatAIModelPromptDisplayName(promptNameInput)}
                        onChange={event => {
                          setPromptNameInput(
                            resolvePromptNameInput(event.target.value)
                          );
                        }}
                      />
                    </label>
                    <label className="min-w-0">
                      <span className="text-xs text-muted-foreground">
                        Workspace ID
                      </span>
                      <Input
                        className="mt-1"
                        placeholder="Global route diagnostics"
                        value={workspaceIdInput}
                        onChange={event => {
                          setWorkspaceIdInput(event.target.value);
                        }}
                      />
                    </label>
                    <label className="min-w-0">
                      <span className="text-xs text-muted-foreground">
                        Workspace selector
                      </span>
                      <Select
                        value={selectedWorkspaceScope}
                        onValueChange={value => {
                          if (value === WORKSPACE_SCOPE_GLOBAL) {
                            setWorkspaceIdInput('');
                            return;
                          }
                          if (value === WORKSPACE_SCOPE_MANUAL) {
                            return;
                          }
                          setWorkspaceIdInput(value);
                        }}
                      >
                        <SelectTrigger
                          aria-label="Workspace selector"
                          className="mt-1"
                        >
                          <SelectValue placeholder="Global route diagnostics" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={WORKSPACE_SCOPE_GLOBAL}>
                            Global route diagnostics
                          </SelectItem>
                          {workspaceScopes.map(workspace => (
                            <SelectItem key={workspace.id} value={workspace.id}>
                              {formatWorkspaceScopeLabel(workspace)}
                            </SelectItem>
                          ))}
                          <SelectItem value={WORKSPACE_SCOPE_MANUAL}>
                            Manual workspace ID
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Catalog results: {filteredPromptCatalog.length} /{' '}
                      {promptCatalog.length}
                    </span>
                    <span>Workspace options: {workspaceScopes.length}</span>
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    className="h-9"
                    disabled={
                      nextPromptName === promptName &&
                      nextWorkspaceId === workspaceId
                    }
                  >
                    Test route
                  </Button>
                </form>

                <PromptCatalogSummary
                  prompt={activePromptMetadata}
                  workspaceId={workspaceId}
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Active prompt
                    </div>
                    <div className="mt-1 break-words font-medium">
                      {formatAIModelPromptDisplayName(promptName)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Workspace scope
                    </div>
                    <div className="mt-1 break-words font-medium">
                      {workspaceId || 'Global'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Workspace metadata
                    </div>
                    <div className="mt-1 break-words font-medium">
                      {workspaceId
                        ? activeWorkspaceScope
                          ? compactList([
                              activeWorkspaceScope.role,
                              activeWorkspaceScope.enableAi
                                ? 'AI enabled'
                                : 'AI disabled',
                              activeWorkspaceScope.enableDocEmbedding
                                ? 'Embedding enabled'
                                : 'Embedding disabled',
                            ])
                          : 'Manual ID, metadata unavailable'
                        : 'Global policy'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Candidate models
                    </div>
                    <div className="mt-1 font-medium">{models.length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Prompt default
                    </div>
                    <div className="mt-1 break-words font-medium">
                      {modelsPayload?.promptDefaultModel ?? 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Active default
                    </div>
                    <div className="mt-1 break-words font-medium">
                      {modelsPayload?.defaultModel ?? 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Default source
                    </div>
                    <div className="mt-1 break-words font-medium">
                      {modelsPayload
                        ? formatFeatureKind(modelsPayload.defaultModelSource)
                        : 'Unknown'}
                    </div>
                    {modelsPayload?.defaultModelFallbackReason ? (
                      <div className="mt-1 break-words text-xs text-muted-foreground">
                        {formatFeatureKind(
                          modelsPayload.defaultModelFallbackReason
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Active source chain
                    </div>
                    <div className="mt-1 break-words font-medium">
                      {activeDefaultSourceChain || 'Unknown'}
                    </div>
                    {activeDefaultPromptSourceChain ? (
                      <div className="mt-1 break-words text-xs text-muted-foreground">
                        {activeDefaultPromptSourceChain}
                      </div>
                    ) : null}
                  </div>
                  <div className="lg:col-span-2 xl:col-span-3 2xl:col-span-4">
                    <div className="text-xs text-muted-foreground">
                      Recommended checks
                    </div>
                    <div className="mt-1">
                      <RecommendedChecks actions={recommendedActionKinds} />
                    </div>
                  </div>
                </div>

                {workspaceId ? (
                  <ProviderHealthProbeAttemptsQuery workspaceId={workspaceId} />
                ) : (
                  <ProviderHealthProbeAttemptsBlock
                    attempts={EMPTY_PROVIDER_HEALTH_PROBE_ATTEMPTS}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="order-1 min-w-0 self-start border-border/60 bg-card shadow-1 2xl:order-2">
              <CardHeader>
                <CardTitle className="text-base">Overall health</CardTitle>
                <CardDescription>
                  Embedding and rerank route readiness
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  {diagnostics.status === 'ready' ? (
                    <CheckCircle2Icon className="h-4 w-4 text-emerald-700" />
                  ) : (
                    <AlertCircleIcon className="h-4 w-4 text-amber-700" />
                  )}
                  <span className="font-medium">
                    {STATUS_LABELS[diagnostics.status]}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  Highest severity: {diagnostics.highestSeverity}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 items-start gap-5">
            <RouteSummaryCard
              label="Workspace indexing"
              rawRoute={modelsPayload?.embeddingRoute}
              route={embeddingDiagnostics}
            />
            <RouteSummaryCard
              label="Rerank"
              rawRoute={modelsPayload?.rerankRoute}
              route={rerankDiagnostics}
            />
          </div>

          <SupportBundleStatusCard workspaceId={workspaceId} />

          <RepairExecutionStatusCard workspaceId={workspaceId} />

          <AgentRuntimeStatusCard workspaceId={workspaceId} />

          <ActionRunTraceCard
            actionRunId={actionRunId}
            actionRunIdInput={actionRunIdInput}
            onActionRunIdInputChange={setActionRunIdInput}
            onActionRunSelect={onActionRunSelect}
            onSubmit={onActionRunSubmit}
            workspaceId={workspaceId}
          />

          <ModelTable models={models} promptName={promptName} />
        </div>
      </ScrollArea>
    </div>
  );
}

export function AiPage() {
  const location = useLocation();
  const isRuntimePage =
    location.pathname.replace(/\/+$/, '') === AI_RUNTIME_PATH;

  return (
    <Suspense fallback={<AiPageSkeleton />}>
      {isRuntimePage ? <AiRuntimePageContent /> : <AiConfigPageContent />}
    </Suspense>
  );
}

export { AiPage as Component };
