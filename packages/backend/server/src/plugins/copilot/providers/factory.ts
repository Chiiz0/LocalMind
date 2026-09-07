import { Injectable, Logger } from '@nestjs/common';

import { CopilotByokNotConfigured } from '../../../base';
import { ServerFeature, ServerService } from '../../../core';
import type { RegistryRevisionPublishEventRecord } from '../../../models/copilot-registry-revision-publish-event';
import { type CopilotAccessContext, CopilotAccessPolicy } from '../access';
import type {
  CopilotModelDefinition,
  CopilotProviderPrivacy,
  CopilotProviderProfileSource,
  CopilotProviderRoutePolicyFeatureKind,
} from '../config';
import type { RequiredStructuredOutputContract } from '../runtime/contracts';
import { getProviderRuntimeHost } from '../runtime/provider-runtime-context';
import type { CopilotProvider } from './provider';
import {
  type ResolvedProviderModel,
  resolveModelContextWindow,
} from './provider-model-runtime';
import {
  applyProviderRoutePolicy,
  buildProviderRegistry,
  type CopilotProviderRegistry,
  type CopilotProviderRoutePolicyCandidateDiagnostics,
  describeProviderRoutePolicy,
  describeProviderRoutePolicyCandidates,
  getProfileModelIds,
  isProviderRouteHealthy,
  type NormalizedCopilotProviderProfile,
  parseModelPrefix,
  providerProfileConfigPathHint,
  resolveModel,
  stripProviderPrefix,
} from './provider-registry';
import type {
  CopilotProviderExecution,
  PreparedNativeEmbeddingExecution,
  PreparedNativeExecution,
  PreparedNativeImageExecution,
  PreparedNativeRerankExecution,
  PreparedNativeStructuredExecution,
} from './provider-runtime-contract';
import { CopilotProviderRegistryService } from './registry-service';
import {
  type CopilotChatOptions,
  type CopilotEmbeddingOptions,
  type CopilotImageOptions,
  type CopilotProviderModel,
  CopilotProviderType,
  type CopilotRerankRequest,
  type CopilotStructuredOptions,
  type ModelAttachmentCapability,
  type ModelCapability,
  ModelFullConditions,
  ModelOutputType,
  type PromptMessage,
} from './types';

export type ResolvedCopilotProvider = {
  registryKind?: 'byok' | 'quota_backed';
  registryAvailable?: boolean;
  registrySelected?: boolean;
  providerId: string;
  provider: CopilotProvider;
  execution: CopilotProviderExecution;
  profile: NormalizedCopilotProviderProfile;
  rawModelId?: string;
  modelId?: string;
  explicitProviderId?: string;
  fallbackProviderIds?: string[];
  prepared?: PreparedNativeExecution;
  preparedStructured?: PreparedNativeStructuredExecution;
  preparedEmbedding?: PreparedNativeEmbeddingExecution;
  preparedRerank?: PreparedNativeRerankExecution;
  preparedImage?: PreparedNativeImageExecution;
};

type CopilotRouteModelDefinitionSource =
  | 'db_revision'
  | 'native_registry'
  | 'provider_profile'
  | 'provider_runtime';

export type CopilotProviderRouteCandidateDiagnostics = {
  registryKind?: 'byok' | 'quota_backed';
  registryAvailable?: boolean;
  registrySelected?: boolean;
  providerId: string;
  providerName?: string;
  providerSource?: CopilotProviderProfileSource;
  providerProfileId?: string;
  providerProfileSource?: CopilotProviderProfileSource;
  providerProfileConfigPath?: string;
  providerConfiguredModelIds?: string[];
  providerConfiguredModelCount?: number;
  providerType?: CopilotProviderType;
  providerPriority?: number;
  privacy?: CopilotProviderPrivacy;
  health?: string;
  healthCheckedAt?: string;
  requestedModelId?: string;
  modelId?: string;
  routeRawModelId?: string;
  routeModelDefinitionSource?: CopilotRouteModelDefinitionSource;
  modelRegistryRevision?: string;
  modelRegistryRevisionActorId?: string;
  modelRegistryRevisionFingerprint?: string;
  modelRegistryRevisionId?: string;
  modelRegistryRevisionScope?: string;
  modelRegistryRevisionSourceChain?: unknown[];
  modelRegistryRevisionSourceChainFingerprint?: string;
  modelRegistryRevisionStatus?: string;
  modelRegistryRevisionWorkspaceId?: string;
  modelRegistryRevisionPublishEventCount?: number;
  modelRegistryRevisionPublishEvents?: RegistryRevisionPublishEventRecord[];
  routeModelDefinitionId?: string;
  routeModelDefinitionAliases?: string[];
  routeModelAliasMatched?: boolean;
  costInputPer1M?: number;
  costOutputPer1M?: number;
  routeContextWindow?: number;
  routeMaxOutputTokens?: number;
  routeEmbeddingDimensions?: number;
  routeInputTypes?: string[];
  routeOutputTypes?: string[];
  routeAttachmentKinds?: string[];
  routeAttachmentSourceKinds?: string[];
  routeAttachmentAllowRemoteUrls?: boolean;
  routeStructuredAttachmentKinds?: string[];
  routeStructuredAttachmentSourceKinds?: string[];
  routeStructuredAttachmentAllowRemoteUrls?: boolean;
  candidateModelIds?: string[];
  matched: boolean;
  reasons: string[];
};

export type CopilotProviderEffectiveRoutePolicyCandidateDiagnostics =
  CopilotProviderRoutePolicyCandidateDiagnostics & {
    registryKind?: 'byok' | 'quota_backed';
    registryAvailable?: boolean;
    registrySelected?: boolean;
  };

export type CopilotProviderEffectiveModelSelectionScope = {
  projectModelId?: string;
  providerIds: string[];
  configuredModelIds: string[];
};

export type CopilotProviderHealthProbeResult = {
  providerId: string;
  providerType?: CopilotProviderType;
  status: 'healthy' | 'degraded' | 'down';
  checkedAt: Date;
  errorCode?: string;
  errorMessage?: string;
  diagnostics: {
    providerRegistered: boolean;
    providerConfigured: boolean;
    profileEnabled: boolean;
    configuredModelIds: string[];
    matchedModelId?: string;
    reasons: string[];
  };
};

const PROVIDER_HEALTH_NETWORK_PROBE_PROMPT: PromptMessage[] = [
  {
    role: 'system',
    content: 'Reply with exactly: OK',
  },
  {
    role: 'user',
    content: 'Provider health probe. Reply OK.',
  },
];

export type CopilotProviderPrepareCandidateDiagnostics = {
  providerId: string;
  providerName?: string;
  providerSource?: CopilotProviderProfileSource;
  providerProfileId?: string;
  providerProfileSource?: CopilotProviderProfileSource;
  providerProfileConfigPath?: string;
  providerConfiguredModelIds?: string[];
  providerConfiguredModelCount?: number;
  providerType?: CopilotProviderType;
  providerPriority?: number;
  privacy?: CopilotProviderPrivacy;
  health?: string;
  healthCheckedAt?: string;
  modelId?: string;
  routeRawModelId?: string;
  routeModelDefinitionSource?: CopilotRouteModelDefinitionSource;
  modelRegistryRevision?: string;
  modelRegistryRevisionActorId?: string;
  modelRegistryRevisionFingerprint?: string;
  modelRegistryRevisionId?: string;
  modelRegistryRevisionScope?: string;
  modelRegistryRevisionSourceChain?: unknown[];
  modelRegistryRevisionSourceChainFingerprint?: string;
  modelRegistryRevisionStatus?: string;
  modelRegistryRevisionWorkspaceId?: string;
  modelRegistryRevisionPublishEventCount?: number;
  modelRegistryRevisionPublishEvents?: RegistryRevisionPublishEventRecord[];
  routeModelDefinitionId?: string;
  routeModelDefinitionAliases?: string[];
  routeModelAliasMatched?: boolean;
  costInputPer1M?: number;
  costOutputPer1M?: number;
  routeContextWindow?: number;
  routeMaxOutputTokens?: number;
  routeEmbeddingDimensions?: number;
  routeInputTypes?: string[];
  routeOutputTypes?: string[];
  routeAttachmentKinds?: string[];
  routeAttachmentSourceKinds?: string[];
  routeAttachmentAllowRemoteUrls?: boolean;
  routeStructuredAttachmentKinds?: string[];
  routeStructuredAttachmentSourceKinds?: string[];
  routeStructuredAttachmentAllowRemoteUrls?: boolean;
  prepared: boolean;
  preparedModelId?: string;
  errorCode?: string;
  errorCategory?: string;
  reasons: string[];
};

type RoutePreparationResult = Partial<
  Pick<
    ResolvedCopilotProvider,
    | 'prepared'
    | 'preparedStructured'
    | 'preparedEmbedding'
    | 'preparedRerank'
    | 'preparedImage'
    | 'modelId'
  >
>;

type EffectiveProviderRegistry = {
  byokRegistry: CopilotProviderRegistry;
  quotaBackedRegistry: CopilotProviderRegistry;
  quotaBackedRoutesAvailable: boolean;
};

type RouteContext = {
  workspaceId?: string;
  featureKind?: CopilotProviderRoutePolicyFeatureKind;
};

function isInstanceManagedOutputType(outputType?: ModelOutputType) {
  return (
    outputType === ModelOutputType.Embedding ||
    outputType === ModelOutputType.Rerank
  );
}

function getRoutePolicyContext(
  context: RouteContext,
  outputType?: ModelOutputType
): RouteContext {
  return isInstanceManagedOutputType(outputType)
    ? { featureKind: context.featureKind }
    : context;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function appendReasons(
  candidate: CopilotProviderRouteCandidateDiagnostics,
  reasons: string[]
): CopilotProviderRouteCandidateDiagnostics {
  if (!reasons.length) {
    return candidate;
  }

  return {
    ...candidate,
    reasons: unique([...candidate.reasons, ...reasons]),
  };
}

function routeCandidateProviderMetadata(
  profile: NormalizedCopilotProviderProfile
) {
  const providerConfiguredModelIds = getProfileModelIds(profile);
  const providerProfileConfigPath = providerProfileConfigPathHint(profile);

  return {
    ...(profile.displayName ? { providerName: profile.displayName } : {}),
    providerSource: profile.source,
    providerProfileId: profile.id,
    providerProfileSource: profile.source,
    ...(providerProfileConfigPath ? { providerProfileConfigPath } : {}),
    ...(providerConfiguredModelIds.length
      ? {
          providerConfiguredModelIds,
          providerConfiguredModelCount: providerConfiguredModelIds.length,
        }
      : {}),
    providerType: profile.type,
    providerPriority: profile.priority,
    privacy: profile.privacy,
    health: profile.health?.status ?? 'unknown',
    ...(profile.health?.lastCheckedAt
      ? { healthCheckedAt: profile.health.lastCheckedAt }
      : {}),
  };
}

function resolveProfileModelDefinition(
  profile: NormalizedCopilotProviderProfile,
  requestedModelId: string | undefined,
  routeModelId: string | undefined
) {
  return profile.modelDefinitions.find(definition => {
    const aliases = definition.aliases ?? [];
    return [requestedModelId, routeModelId].some(
      id =>
        !!id &&
        (definition.id === id ||
          definition.rawModelId === id ||
          aliases.includes(id))
    );
  });
}

function resolveModelDefinitionSource(
  profile: NormalizedCopilotProviderProfile,
  resolvedProviderModel: Partial<ResolvedProviderModel> | undefined,
  profileDefinition: CopilotModelDefinition | undefined
): CopilotRouteModelDefinitionSource | undefined {
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

function collectProviderModelCapabilityTypes(
  providerModel: CopilotProviderModel | undefined
) {
  const capabilities = providerModel?.capabilities ?? [];
  if (!capabilities.length) {
    return {};
  }

  const routeInputTypes = unique(
    capabilities.flatMap(capability => capability.input ?? [])
  );
  const routeOutputTypes = unique(
    capabilities.flatMap(capability => capability.output ?? [])
  );
  const routeAttachmentKinds = unique(
    capabilities.flatMap(capability => capability.attachments?.kinds ?? [])
  );
  const routeAttachmentSourceKinds = unique(
    capabilities.flatMap(
      capability => capability.attachments?.sourceKinds ?? []
    )
  );
  const hasRouteAttachmentCapability = capabilities.some(
    capability => capability.attachments !== undefined
  );
  const routeAttachmentAllowRemoteUrls = capabilities.some(
    capability => capability.attachments?.allowRemoteUrls === true
  );
  const routeStructuredAttachmentKinds = unique(
    capabilities.flatMap(
      capability => capability.structuredAttachments?.kinds ?? []
    )
  );
  const routeStructuredAttachmentSourceKinds = unique(
    capabilities.flatMap(
      capability => capability.structuredAttachments?.sourceKinds ?? []
    )
  );
  const hasRouteStructuredAttachmentCapability = capabilities.some(
    capability => capability.structuredAttachments !== undefined
  );
  const routeStructuredAttachmentAllowRemoteUrls = capabilities.some(
    capability => capability.structuredAttachments?.allowRemoteUrls === true
  );

  return {
    ...(routeInputTypes.length ? { routeInputTypes } : {}),
    ...(routeOutputTypes.length ? { routeOutputTypes } : {}),
    ...(routeAttachmentKinds.length ? { routeAttachmentKinds } : {}),
    ...(routeAttachmentSourceKinds.length
      ? { routeAttachmentSourceKinds }
      : {}),
    ...(hasRouteAttachmentCapability ? { routeAttachmentAllowRemoteUrls } : {}),
    ...(routeStructuredAttachmentKinds.length
      ? { routeStructuredAttachmentKinds }
      : {}),
    ...(routeStructuredAttachmentSourceKinds.length
      ? { routeStructuredAttachmentSourceKinds }
      : {}),
    ...(hasRouteStructuredAttachmentCapability
      ? { routeStructuredAttachmentAllowRemoteUrls }
      : {}),
  };
}

function routeCandidateModelDefinitionMetadata(
  profile: NormalizedCopilotProviderProfile,
  provider: CopilotProvider,
  requestedModelId: string | undefined,
  routeModelId: string | undefined,
  execution: CopilotProviderExecution
) {
  const modelId = routeModelId ?? requestedModelId;
  const providerModel = modelId
    ? provider.resolveModel(modelId, execution)
    : undefined;
  const resolvedProviderModel = providerModel as
    | Partial<ResolvedProviderModel>
    | undefined;
  const resolvedModelId = providerModel?.id ?? routeModelId ?? requestedModelId;
  const profileDefinition = resolveProfileModelDefinition(
    profile,
    requestedModelId,
    resolvedModelId
  );
  const routeModelDefinitionSource = resolveModelDefinitionSource(
    profile,
    resolvedProviderModel,
    profileDefinition
  );
  const routeModelDefinitionId =
    profileDefinition?.id ??
    resolvedProviderModel?.canonicalKey ??
    (routeModelDefinitionSource === 'provider_runtime'
      ? resolvedModelId
      : undefined);
  const routeRawModelId =
    profileDefinition?.rawModelId ??
    (resolvedProviderModel?.id &&
    resolvedProviderModel.id !== routeModelDefinitionId
      ? resolvedProviderModel.id
      : undefined);
  const aliasMatchTarget = requestedModelId ?? routeModelId;
  const routeModelAliasMatched =
    aliasMatchTarget !== undefined
      ? profileDefinition?.aliases?.includes(aliasMatchTarget)
      : undefined;
  const costInputPer1M =
    profileDefinition?.cost?.inputPer1M ??
    resolvedProviderModel?.cost?.inputPer1M;
  const costOutputPer1M =
    profileDefinition?.cost?.outputPer1M ??
    resolvedProviderModel?.cost?.outputPer1M;
  const routeContextWindow =
    profileDefinition?.limits?.contextWindow ??
    resolvedProviderModel?.limits?.contextWindow;
  const routeMaxOutputTokens =
    profileDefinition?.limits?.maxOutputTokens ??
    resolvedProviderModel?.limits?.maxOutputTokens;
  const routeEmbeddingDimensions =
    profileDefinition?.limits?.embeddingDimensions ??
    resolvedProviderModel?.limits?.embeddingDimensions;
  const modelRegistryRevisionMetadata = profileDefinition?.registryRecordSource
    ? {
        modelRegistryRevision: profileDefinition.registryRevision,
        modelRegistryRevisionActorId: profileDefinition.registryRevisionActorId,
        modelRegistryRevisionFingerprint:
          profileDefinition.registryRevisionFingerprint,
        modelRegistryRevisionId: profileDefinition.registryRevisionId,
        modelRegistryRevisionScope: profileDefinition.registryRevisionScope,
        modelRegistryRevisionSourceChain:
          profileDefinition.registryRevisionSourceChain,
        modelRegistryRevisionSourceChainFingerprint:
          profileDefinition.registryRevisionSourceChainFingerprint,
        modelRegistryRevisionStatus: profileDefinition.registryRevisionStatus,
        modelRegistryRevisionWorkspaceId:
          profileDefinition.registryRevisionWorkspaceId,
        modelRegistryRevisionPublishEventCount:
          profileDefinition.registryRevisionPublishEventCount,
        modelRegistryRevisionPublishEvents:
          profileDefinition.registryRevisionPublishEvents,
      }
    : {};

  return {
    ...modelRegistryRevisionMetadata,
    ...(routeRawModelId ? { routeRawModelId } : {}),
    ...(routeModelDefinitionSource ? { routeModelDefinitionSource } : {}),
    ...(routeModelDefinitionId ? { routeModelDefinitionId } : {}),
    ...(profileDefinition?.aliases?.length
      ? { routeModelDefinitionAliases: profileDefinition.aliases }
      : {}),
    ...(routeModelAliasMatched !== undefined ? { routeModelAliasMatched } : {}),
    ...(costInputPer1M !== undefined ? { costInputPer1M } : {}),
    ...(costOutputPer1M !== undefined ? { costOutputPer1M } : {}),
    ...(routeContextWindow !== undefined ? { routeContextWindow } : {}),
    ...(routeMaxOutputTokens !== undefined ? { routeMaxOutputTokens } : {}),
    ...(routeEmbeddingDimensions !== undefined
      ? { routeEmbeddingDimensions }
      : {}),
    ...collectProviderModelCapabilityTypes(providerModel),
  };
}

function prepareDiagnosticErrorCode(error: unknown) {
  return error instanceof Error && error.name !== 'Error'
    ? error.name
    : 'provider_prepare_error';
}

function prepareDiagnosticErrorCategory(error: unknown) {
  const code =
    error instanceof Error
      ? error.name
      : typeof error === 'string'
        ? error
        : '';
  const normalized = code.toLowerCase();

  if (
    normalized.includes('auth') ||
    normalized.includes('credential') ||
    normalized.includes('permission') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden')
  ) {
    return 'auth';
  }

  if (
    normalized.includes('timeout') ||
    normalized.includes('abort') ||
    normalized.includes('network') ||
    normalized.includes('connection') ||
    normalized.includes('fetch')
  ) {
    return 'network';
  }

  if (normalized.includes('model') || normalized.includes('alias')) {
    return 'model';
  }

  if (
    normalized.includes('schema') ||
    normalized.includes('json') ||
    normalized.includes('validation') ||
    normalized.includes('parse')
  ) {
    return 'schema';
  }

  return 'runtime';
}

function prepareDiagnosticErrorReason(errorCategory: string) {
  return `provider_prepare_${errorCategory}_error`;
}

function capabilityForOutput(
  capability: ModelCapability,
  outputType?: ModelOutputType
) {
  return outputType ? capability.output.includes(outputType) : true;
}

function attachmentCapabilityForOutput(
  capability: ModelCapability,
  outputType?: ModelOutputType
): ModelAttachmentCapability | undefined {
  return outputType === ModelOutputType.Structured
    ? (capability.structuredAttachments ?? capability.attachments)
    : capability.attachments;
}

@Injectable()
export class CopilotProviderFactory {
  constructor(
    private readonly server: ServerService,
    private readonly registries: CopilotProviderRegistryService,
    private readonly access: CopilotAccessPolicy
  ) {}

  private readonly logger = new Logger(CopilotProviderFactory.name);

  readonly #providers = new Map<string, CopilotProvider>();
  readonly #providerIdsByType = new Map<CopilotProviderType, Set<string>>();
  readonly #runtimeProvidersByType = new Map<
    CopilotProviderType,
    CopilotProvider
  >();

  private getRegistry() {
    return this.registries.getRegistry();
  }

  private getProviderByProfile(
    providerId: string,
    profile: NormalizedCopilotProviderProfile
  ) {
    return (
      this.#providers.get(providerId) ??
      this.#runtimeProvidersByType.get(profile.type) ??
      Array.from(this.#providerIdsByType.get(profile.type) ?? [])
        .map(id => this.#providers.get(id))
        .find((provider): provider is CopilotProvider => !!provider)
    );
  }

  private providerAvailable(
    providerId: string,
    profile: NormalizedCopilotProviderProfile
  ) {
    return (
      isProviderRouteHealthy(profile) &&
      !!this.getProviderByProfile(providerId, profile)
    );
  }

  private getAvailableProviderIds(registry: CopilotProviderRegistry) {
    return Array.from(registry.profiles.entries())
      .filter(([providerId, profile]) =>
        this.providerAvailable(providerId, profile)
      )
      .map(([providerId]) => providerId);
  }

  private getProfileModelIds(profile: NormalizedCopilotProviderProfile) {
    return getProfileModelIds(profile);
  }

  async probeProviderProfile(input: {
    providerId: string;
    workspaceId: string;
  }): Promise<CopilotProviderHealthProbeResult> {
    const checkedAt = new Date();
    const registry = await this.registries.getRegistryWithModelRevisions(
      input.workspaceId
    );
    const profile = registry.profiles.get(input.providerId);
    if (!profile) {
      return {
        providerId: input.providerId,
        status: 'down',
        checkedAt,
        errorCode: 'provider_profile_missing',
        errorMessage:
          'Provider profile is no longer active in the workspace registry.',
        diagnostics: {
          providerRegistered: false,
          providerConfigured: false,
          profileEnabled: false,
          configuredModelIds: [],
          reasons: ['provider_profile_missing'],
        },
      };
    }

    const provider = this.getProviderByProfile(input.providerId, profile);
    const configuredModelIds = this.getProfileModelIds(profile);
    const diagnostics = {
      providerRegistered: !!provider,
      providerConfigured: false,
      profileEnabled: profile.enabled,
      configuredModelIds,
      reasons: [] as string[],
    };
    if (!profile.enabled) {
      diagnostics.reasons.push('provider_profile_disabled');
    }
    if (!provider) {
      diagnostics.reasons.push('provider_runtime_missing');
      return {
        providerId: input.providerId,
        providerType: profile.type,
        status: 'down',
        checkedAt,
        errorCode: 'provider_runtime_missing',
        errorMessage:
          'No provider runtime is registered for the workspace provider profile.',
        diagnostics,
      };
    }

    const execution = { providerId: input.providerId, profile };
    diagnostics.providerConfigured = provider.configured(execution);
    if (!diagnostics.providerConfigured) {
      diagnostics.reasons.push('provider_runtime_not_configured');
      return {
        providerId: input.providerId,
        providerType: profile.type,
        status: 'degraded',
        checkedAt,
        errorCode: 'provider_runtime_not_configured',
        errorMessage:
          'Provider runtime is registered but is missing required configuration.',
        diagnostics,
      };
    }

    const candidateModelIds = configuredModelIds.length
      ? configuredModelIds
      : [undefined];
    try {
      for (const modelId of candidateModelIds) {
        const matched = await provider.match(
          {
            ...(modelId ? { modelId } : {}),
            outputType: ModelOutputType.Text,
          },
          execution
        );
        if (matched) {
          const normalized = await provider.checkParams({
            cond: {
              ...(modelId ? { modelId } : {}),
              outputType: ModelOutputType.Text,
            },
            withAttachment: false,
            execution,
          });
          const selectedModel = provider.selectModel(normalized, execution);
          diagnostics.reasons.push('provider_profile_probe_succeeded');
          return {
            providerId: input.providerId,
            providerType: profile.type,
            status: 'healthy',
            checkedAt,
            diagnostics: {
              ...diagnostics,
              matchedModelId: normalized.modelId ?? modelId ?? selectedModel.id,
            },
          };
        }
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Provider runtime contract probe failed';
      diagnostics.reasons.push('provider_runtime_contract_error');
      return {
        providerId: input.providerId,
        providerType: profile.type,
        status: 'degraded',
        checkedAt,
        errorCode: 'provider_runtime_contract_error',
        errorMessage: message,
        diagnostics,
      };
    }

    diagnostics.reasons.push('provider_model_unmatched');
    return {
      providerId: input.providerId,
      providerType: profile.type,
      status: 'degraded',
      checkedAt,
      errorCode: 'provider_model_unmatched',
      errorMessage:
        'Provider runtime is configured but no text-capable model matched the provider profile.',
      diagnostics,
    };
  }

  async probeProviderProfileNetwork(input: {
    actorId?: string;
    providerId: string;
    timeoutMs?: number;
    workspaceId: string;
  }): Promise<CopilotProviderHealthProbeResult> {
    const contractResult = await this.probeProviderProfile({
      providerId: input.providerId,
      workspaceId: input.workspaceId,
    });
    if (contractResult.status !== 'healthy') {
      return {
        ...contractResult,
        diagnostics: {
          ...contractResult.diagnostics,
          reasons: [
            ...contractResult.diagnostics.reasons,
            'provider_network_probe_skipped_contract_not_healthy',
          ],
        },
      };
    }

    const checkedAt = new Date();
    const registry = await this.registries.getRegistryWithModelRevisions(
      input.workspaceId
    );
    const profile = registry.profiles.get(input.providerId);
    const provider = profile
      ? this.getProviderByProfile(input.providerId, profile)
      : null;
    if (!profile || !provider) {
      return {
        ...contractResult,
        status: 'down',
        checkedAt,
        errorCode: 'provider_network_probe_runtime_missing',
        errorMessage:
          'Provider runtime disappeared before the network probe could run.',
        diagnostics: {
          ...contractResult.diagnostics,
          providerRegistered: false,
          reasons: [
            ...contractResult.diagnostics.reasons,
            'provider_network_probe_runtime_missing',
          ],
        },
      };
    }

    const modelId =
      contractResult.diagnostics.matchedModelId ??
      this.getProfileModelIds(profile)[0];
    const execution = { providerId: input.providerId, profile };
    const abortController = new AbortController();
    let timedOut = false;
    const timeout = input.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          abortController.abort();
        }, input.timeoutMs)
      : null;

    try {
      const output = await getProviderRuntimeHost(provider).run.text(
        modelId ? { modelId } : {},
        PROVIDER_HEALTH_NETWORK_PROBE_PROMPT,
        {
          featureKind: 'action',
          maxTokens: 8,
          signal: abortController.signal,
          temperature: 0,
          user: input.actorId,
          workspace: input.workspaceId,
        },
        execution
      );
      if (!output.trim()) {
        return {
          ...contractResult,
          status: 'degraded',
          checkedAt,
          errorCode: 'provider_network_probe_empty_response',
          errorMessage:
            'Provider network probe completed but returned an empty response.',
          diagnostics: {
            ...contractResult.diagnostics,
            reasons: [
              ...contractResult.diagnostics.reasons,
              'provider_network_probe_empty_response',
            ],
          },
        };
      }
      return {
        ...contractResult,
        checkedAt,
        diagnostics: {
          ...contractResult.diagnostics,
          matchedModelId:
            contractResult.diagnostics.matchedModelId ?? modelId ?? undefined,
          reasons: [
            ...contractResult.diagnostics.reasons,
            'provider_network_probe_succeeded',
          ],
        },
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Provider network probe failed';
      return {
        ...contractResult,
        status: 'down',
        checkedAt,
        errorCode: timedOut
          ? 'provider_network_probe_timeout'
          : 'provider_network_probe_failed',
        errorMessage: message,
        diagnostics: {
          ...contractResult.diagnostics,
          reasons: [
            ...contractResult.diagnostics.reasons,
            timedOut
              ? 'provider_network_probe_timeout'
              : 'provider_network_probe_failed',
          ],
        },
      };
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private getConfiguredModelIdsFromRegistry(
    registry: CopilotProviderRegistry,
    context: RouteContext = {}
  ) {
    const providerIds = this.getModelSelectionProviderIdsFromRegistry(
      registry,
      context
    );

    return this.getConfiguredModelIdsForProviderIds(registry, providerIds);
  }

  private getConfiguredModelIdsForProviderIds(
    registry: CopilotProviderRegistry,
    providerIds: string[]
  ) {
    return providerIds.flatMap(providerId => {
      const profile = registry.profiles.get(providerId);
      if (!profile) {
        return [];
      }
      return this.getProfileModelIds(profile).map(
        modelId => `${providerId}/${modelId}`
      );
    });
  }

  private getModelSelectionProviderIdsFromRegistry(
    registry: CopilotProviderRegistry,
    context: RouteContext = {}
  ) {
    return applyProviderRoutePolicy(
      registry,
      registry.order.filter(providerId => {
        const profile = registry.profiles.get(providerId);
        return profile ? this.providerAvailable(providerId, profile) : false;
      }),
      context
    );
  }

  private profileAllowsModel(
    profile: NormalizedCopilotProviderProfile,
    modelId: string
  ) {
    const modelIds = this.getProfileModelIds(profile);
    if (!modelIds.length) {
      return true;
    }

    return (
      modelIds.includes(modelId) ||
      profile.modelDefinitions.some(
        model =>
          model.rawModelId === modelId ||
          model.id === modelId ||
          model.aliases?.includes(modelId)
      )
    );
  }

  private describeCapabilityMismatchReasons(
    model: CopilotProviderModel | undefined,
    cond: ModelFullConditions
  ): string[] {
    if (!model) {
      return [];
    }

    const capabilities = model.capabilities ?? [];
    if (!capabilities.length) {
      return ['capability_not_declared'];
    }

    const outputCapabilities = capabilities.filter(capability =>
      capabilityForOutput(capability, cond.outputType)
    );
    const reasons: string[] = [];
    if (!outputCapabilities.length) {
      reasons.push('output_not_supported');
    }

    const inputTypes = cond.inputTypes ?? [];
    const inputCapabilities = outputCapabilities.length
      ? outputCapabilities
      : capabilities;
    if (
      inputTypes.length &&
      !inputCapabilities.some(capability =>
        inputTypes.every(inputType => capability.input.includes(inputType))
      )
    ) {
      reasons.push('input_not_supported');
    }

    const attachmentKinds = cond.attachmentKinds ?? [];
    const attachmentSourceKinds = cond.attachmentSourceKinds ?? [];
    const requiresAttachmentCheck =
      attachmentKinds.length ||
      attachmentSourceKinds.length ||
      cond.hasRemoteAttachments;
    if (requiresAttachmentCheck) {
      const attachmentCapabilities = inputCapabilities
        .map(capability =>
          attachmentCapabilityForOutput(capability, cond.outputType)
        )
        .filter(
          (
            capability
          ): capability is NonNullable<
            ReturnType<typeof attachmentCapabilityForOutput>
          > => !!capability
        );
      if (!attachmentCapabilities.length) {
        reasons.push('attachment_not_supported');
      } else {
        if (
          attachmentKinds.length &&
          !attachmentCapabilities.some(capability =>
            attachmentKinds.every(kind => capability.kinds.includes(kind))
          )
        ) {
          reasons.push('attachment_kind_not_supported');
        }
        if (
          attachmentSourceKinds.length &&
          !attachmentCapabilities.some(capability =>
            attachmentSourceKinds.every(
              sourceKind =>
                !capability.sourceKinds?.length ||
                capability.sourceKinds.includes(sourceKind)
            )
          )
        ) {
          reasons.push('attachment_source_not_supported');
        }
        if (
          cond.hasRemoteAttachments &&
          !attachmentCapabilities.some(capability => capability.allowRemoteUrls)
        ) {
          reasons.push('remote_attachment_not_supported');
        }
      }
    }

    return unique(reasons);
  }

  private describeCapabilityMismatchReasonsForModels(
    provider: CopilotProvider,
    execution: CopilotProviderExecution,
    modelIds: string[],
    cond: ModelFullConditions
  ) {
    return unique(
      modelIds.flatMap(modelId =>
        this.describeCapabilityMismatchReasons(
          provider.resolveModel(modelId, execution),
          { ...cond, modelId }
        )
      )
    );
  }

  getConfiguredModelIds(context: RouteContext = {}) {
    return unique(
      this.getConfiguredModelIdsFromRegistry(this.getRegistry(), context)
    );
  }

  async getEffectiveModelSelectionScope(
    context: CopilotAccessContext = {}
  ): Promise<CopilotProviderEffectiveModelSelectionScope> {
    const { byokRegistry, quotaBackedRegistry, quotaBackedRoutesAvailable } =
      await this.getEffectiveRegistry(context);
    const routePolicyContext = {
      workspaceId: this.byokRouteContext(byokRegistry, context).workspaceId,
      featureKind: context.featureKind,
    };
    const byokProviderIds = this.getModelSelectionProviderIdsFromRegistry(
      byokRegistry,
      routePolicyContext
    );
    const quotaBackedProviderIds = quotaBackedRoutesAvailable
      ? this.getModelSelectionProviderIdsFromRegistry(
          quotaBackedRegistry,
          routePolicyContext
        )
      : [];

    return {
      providerIds: unique([...byokProviderIds, ...quotaBackedProviderIds]),
      ...(this.isProjectByokRegistry(byokRegistry)
        ? {
            projectModelId: [...byokRegistry.profiles.values()][0]?.models?.[0],
          }
        : {}),
      configuredModelIds: unique([
        ...this.getConfiguredModelIdsForProviderIds(
          byokRegistry,
          byokProviderIds
        ),
        ...this.getConfiguredModelIdsForProviderIds(
          quotaBackedRegistry,
          quotaBackedProviderIds
        ),
      ]),
    };
  }

  describeRoutePolicy(
    context: RouteContext = {},
    outputType?: ModelOutputType
  ) {
    return describeProviderRoutePolicy(
      this.getRegistry(),
      getRoutePolicyContext(context, outputType)
    );
  }

  describeRoutePolicyCandidates(context: RouteContext = {}) {
    const registry = this.getRegistry();
    return describeProviderRoutePolicyCandidates(
      registry,
      registry.order,
      context,
      this.getAvailableProviderIds(registry)
    );
  }

  async describeEffectiveRoutePolicyCandidates(
    context: CopilotAccessContext = {},
    outputType?: ModelOutputType
  ): Promise<CopilotProviderEffectiveRoutePolicyCandidateDiagnostics[]> {
    const { byokRegistry, quotaBackedRegistry, quotaBackedRoutesAvailable } =
      await this.getEffectiveRegistry(context, outputType);
    const routePolicyContext = getRoutePolicyContext(
      {
        workspaceId: context.workspaceId,
        featureKind: context.featureKind,
      },
      outputType
    );
    if (quotaBackedRoutesAvailable) {
      return describeProviderRoutePolicyCandidates(
        quotaBackedRegistry,
        quotaBackedRegistry.order,
        routePolicyContext,
        this.getAvailableProviderIds(quotaBackedRegistry)
      ).map(candidate => {
        const registrySelected = candidate.allowed;
        return {
          ...candidate,
          registryKind: 'quota_backed' as const,
          registryAvailable: true,
          registrySelected,
          reasons: unique([
            ...candidate.reasons,
            ...(registrySelected ? ['registry_selected'] : []),
          ]),
        };
      });
    }

    const byokRoutePolicyContext = {
      workspaceId: this.byokRouteContext(byokRegistry, context).workspaceId,
      featureKind: context.featureKind,
    };
    const byokRegistryAvailable = byokRegistry.order.length > 0;
    const byokCandidates = describeProviderRoutePolicyCandidates(
      byokRegistry,
      byokRegistry.order,
      byokRoutePolicyContext,
      this.getAvailableProviderIds(byokRegistry)
    ).map(candidate => {
      const registrySelected = byokRegistryAvailable && candidate.allowed;
      return {
        ...candidate,
        registryKind: 'byok' as const,
        registryAvailable: byokRegistryAvailable,
        registrySelected,
        reasons: unique([
          ...candidate.reasons,
          ...(!byokRegistryAvailable ? ['registry_unavailable'] : []),
          ...(registrySelected ? ['registry_selected'] : []),
        ]),
      };
    });
    const quotaBackedCandidates = describeProviderRoutePolicyCandidates(
      quotaBackedRegistry,
      quotaBackedRegistry.order,
      byokRoutePolicyContext,
      this.getAvailableProviderIds(quotaBackedRegistry)
    ).map(candidate => {
      return {
        ...candidate,
        registryKind: 'quota_backed' as const,
        registryAvailable: quotaBackedRoutesAvailable,
        registrySelected: false,
        reasons: unique([
          ...candidate.reasons,
          ...(!quotaBackedRoutesAvailable ? ['registry_unavailable'] : []),
        ]),
      };
    });

    return [...byokCandidates, ...quotaBackedCandidates];
  }

  private async describeRouteCandidatesFromRegistry(
    registry: CopilotProviderRegistry,
    cond: ModelFullConditions,
    filter: {
      prefer?: CopilotProviderType;
    } = {},
    context: CopilotAccessContext = {},
    registryDiagnostics: Pick<
      CopilotProviderRouteCandidateDiagnostics,
      'registryAvailable' | 'registryKind' | 'registrySelected'
    > = {}
  ): Promise<CopilotProviderRouteCandidateDiagnostics[]> {
    const routePolicyContext = {
      workspaceId: context.workspaceId,
      featureKind: context.featureKind,
    };
    const route = resolveModel({
      registry,
      modelId: cond.modelId,
      outputType: cond.outputType,
      availableProviderIds: this.getAvailableProviderIds(registry),
      preferredProviderIds: this.getPreferredProviderIds(
        registry,
        filter.prefer,
        routePolicyContext
      ),
      routePolicyContext,
    });

    return await Promise.all(
      route.candidateProviderIds.map(async providerId => {
        const profile = registry.profiles.get(providerId);
        const provider = profile
          ? this.getProviderByProfile(providerId, profile)
          : undefined;
        const candidateModelIds = profile
          ? this.getProfileModelIds(profile)
          : [];
        const candidateModelMetadata = candidateModelIds.length
          ? { candidateModelIds }
          : {};
        const providerMetadata = profile
          ? routeCandidateProviderMetadata(profile)
          : {};
        if (!profile || !provider) {
          return {
            ...registryDiagnostics,
            providerId,
            ...providerMetadata,
            ...candidateModelMetadata,
            matched: false,
            reasons: ['provider_runtime_unavailable'],
          };
        }

        const normalizedCond = this.normalizeCond(registry, providerId, cond);
        const requestedModelId = normalizedCond.modelId;
        const execution = { providerId, profile };
        if (
          requestedModelId &&
          !this.profileAllowsModel(profile, requestedModelId)
        ) {
          return {
            ...registryDiagnostics,
            providerId,
            ...providerMetadata,
            requestedModelId,
            ...candidateModelMetadata,
            matched: false,
            reasons: ['profile_model_not_allowed'],
          };
        }

        if (!requestedModelId && candidateModelIds.length) {
          const matchedModelId = (
            await Promise.all(
              candidateModelIds.map(async modelId => {
                try {
                  return (await provider.match(
                    { ...normalizedCond, modelId },
                    execution
                  ))
                    ? modelId
                    : null;
                } catch {
                  return null;
                }
              })
            )
          ).find((modelId): modelId is string => !!modelId);

          const candidateMismatchReasons =
            this.describeCapabilityMismatchReasonsForModels(
              provider,
              execution,
              candidateModelIds,
              normalizedCond
            );
          return matchedModelId
            ? {
                ...registryDiagnostics,
                providerId,
                ...providerMetadata,
                modelId: matchedModelId,
                ...routeCandidateModelDefinitionMetadata(
                  profile,
                  provider,
                  matchedModelId,
                  matchedModelId,
                  execution
                ),
                ...candidateModelMetadata,
                matched: true,
                reasons: ['profile_model_matched', 'capability_matched'],
              }
            : {
                ...registryDiagnostics,
                providerId,
                ...providerMetadata,
                ...candidateModelMetadata,
                matched: false,
                reasons: unique([
                  'no_profile_model_match',
                  'capability_mismatch',
                  ...candidateMismatchReasons,
                ]),
              };
        }

        let matched = false;
        try {
          matched = await provider.match(normalizedCond, execution);
        } catch {
          return {
            ...registryDiagnostics,
            providerId,
            ...providerMetadata,
            ...(requestedModelId ? { requestedModelId } : {}),
            ...candidateModelMetadata,
            matched: false,
            reasons: ['capability_match_error'],
          };
        }

        const requestedModel = requestedModelId
          ? provider.resolveModel(requestedModelId, execution)
          : undefined;
        const modelDefinitionMetadata = requestedModelId
          ? routeCandidateModelDefinitionMetadata(
              profile,
              provider,
              requestedModelId,
              requestedModelId,
              execution
            )
          : {};
        return {
          ...registryDiagnostics,
          providerId,
          ...providerMetadata,
          ...(requestedModelId
            ? { requestedModelId, modelId: requestedModelId }
            : {}),
          ...modelDefinitionMetadata,
          ...candidateModelMetadata,
          matched,
          reasons: matched
            ? ['capability_matched']
            : unique([
                'capability_mismatch',
                ...this.describeCapabilityMismatchReasons(
                  requestedModel,
                  normalizedCond
                ),
              ]),
        };
      })
    );
  }

  async describeRouteCandidates(
    cond: ModelFullConditions,
    filter: {
      prefer?: CopilotProviderType;
    } = {},
    context: CopilotAccessContext = {}
  ) {
    const { byokRegistry, quotaBackedRegistry, quotaBackedRoutesAvailable } =
      await this.getEffectiveRegistry(context, cond.outputType);
    if (quotaBackedRoutesAvailable) {
      const instanceContext = getRoutePolicyContext(context, cond.outputType);
      const quotaBackedCandidates =
        await this.describeRouteCandidatesFromRegistry(
          quotaBackedRegistry,
          cond,
          filter,
          instanceContext,
          {
            registryKind: 'quota_backed',
            registryAvailable: true,
          }
        );

      return quotaBackedCandidates.map(candidate =>
        appendReasons(
          {
            ...candidate,
            registrySelected: candidate.matched,
          },
          candidate.matched ? ['registry_selected'] : []
        )
      );
    }

    const byokCond = this.normalizeByokCond(
      byokRegistry,
      quotaBackedRegistry,
      cond
    );
    const byokCandidates = await this.describeRouteCandidatesFromRegistry(
      byokRegistry,
      byokCond,
      filter,
      this.byokRouteContext(byokRegistry, context),
      {
        registryKind: 'byok',
        registryAvailable: byokRegistry.order.length > 0,
      }
    );
    const byokSelected = byokCandidates.some(candidate => candidate.matched);
    const quotaBackedCandidates =
      await this.describeRouteCandidatesFromRegistry(
        quotaBackedRegistry,
        cond,
        filter,
        context,
        {
          registryKind: 'quota_backed',
          registryAvailable: quotaBackedRoutesAvailable,
        }
      );
    const annotateByokCandidate = (
      candidate: CopilotProviderRouteCandidateDiagnostics
    ) =>
      appendReasons(
        {
          ...candidate,
          registrySelected: byokSelected && candidate.matched,
        },
        [
          byokSelected && candidate.matched ? 'registry_selected' : null,
          !byokRegistry.order.length ? 'registry_unavailable' : null,
        ].filter((reason): reason is string => !!reason)
      );
    const annotateQuotaBackedCandidate = (
      candidate: CopilotProviderRouteCandidateDiagnostics
    ) =>
      appendReasons(
        {
          ...candidate,
          registrySelected: false,
        },
        [!quotaBackedRoutesAvailable ? 'registry_unavailable' : null].filter(
          (reason): reason is string => !!reason
        )
      );

    return [
      ...byokCandidates.map(annotateByokCandidate),
      ...quotaBackedCandidates.map(annotateQuotaBackedCandidate),
    ];
  }

  private getPreferredProviderIds(
    registry: CopilotProviderRegistry,
    type?: CopilotProviderType,
    context: RouteContext = {}
  ) {
    if (!type) return undefined;
    const providerIds = registry.byType.get(type)?.filter(providerId => {
      const profile = registry.profiles.get(providerId);
      return profile ? this.providerAvailable(providerId, profile) : false;
    });
    return providerIds
      ? applyProviderRoutePolicy(registry, providerIds, context)
      : undefined;
  }

  private normalizeCond(
    registry: CopilotProviderRegistry,
    providerId: string,
    cond: ModelFullConditions
  ): ModelFullConditions {
    const modelId = stripProviderPrefix(registry, providerId, cond.modelId);
    return { ...cond, modelId };
  }

  private normalizeByokCond(
    byokRegistry: CopilotProviderRegistry,
    quotaBackedRegistry: CopilotProviderRegistry,
    cond: ModelFullConditions
  ): ModelFullConditions {
    if (this.isProjectByokRegistry(byokRegistry)) {
      return { ...cond, modelId: undefined };
    }
    if (!cond.modelId || parseModelPrefix(byokRegistry, cond.modelId)) {
      return cond;
    }

    const quotaBackedRoute = parseModelPrefix(
      quotaBackedRegistry,
      cond.modelId
    );
    if (!quotaBackedRoute?.modelId) {
      return cond;
    }

    const modelId = quotaBackedRoute.modelId;
    if (
      Array.from(byokRegistry.profiles.values()).some(profile =>
        this.profileAllowsModel(profile, modelId)
      )
    ) {
      return { ...cond, modelId };
    }

    return { ...cond, modelId: undefined };
  }

  private async getEffectiveRegistry(
    context: CopilotAccessContext = {},
    outputType?: ModelOutputType
  ): Promise<EffectiveProviderRegistry> {
    const instanceManaged = isInstanceManagedOutputType(outputType);
    const byokProfiles = instanceManaged
      ? []
      : (await this.access.resolveRouteAccess(context)).byokProfiles;
    const quotaBackedRegistry =
      await this.registries.getRegistryWithModelRevisions(
        instanceManaged ||
          byokProfiles.some(profile => profile.source === 'byok_project_global')
          ? undefined
          : context.workspaceId
      );

    return {
      byokRegistry: buildProviderRegistry({
        profiles: byokProfiles,
        defaults: {},
      }),
      quotaBackedRegistry,
      quotaBackedRoutesAvailable: instanceManaged,
    };
  }

  private getRequestContext(
    options?:
      | CopilotChatOptions
      | CopilotStructuredOptions
      | CopilotImageOptions
  ): CopilotAccessContext {
    return {
      userId: options?.user,
      sessionId: options?.session,
      workspaceId: options?.workspace,
      byokLeaseId: options?.byokLeaseId,
      featureKind: options?.featureKind,
      quotaBackedRoutesAllowed: options?.quotaBackedRoutesAllowed,
    };
  }

  private isProjectByokRegistry(registry: CopilotProviderRegistry) {
    return [...registry.profiles.values()].some(
      profile => profile.source === 'byok_project_global'
    );
  }

  private byokRouteContext(
    registry: CopilotProviderRegistry,
    context: CopilotAccessContext
  ) {
    return this.isProjectByokRegistry(registry)
      ? { ...context, workspaceId: undefined }
      : context;
  }

  private filterPreparedRoutes(routes: Array<ResolvedCopilotProvider | null>) {
    return routes.filter(
      (route): route is ResolvedCopilotProvider => route !== null
    );
  }

  private async prepareResolvedRoutes(
    routes: ResolvedCopilotProvider[],
    prepare: (
      route: ResolvedCopilotProvider
    ) => Promise<RoutePreparationResult | null | undefined>
  ) {
    const preparedRoutes = await Promise.all(
      routes.map(async route => {
        const prepared = await prepare(route);
        return prepared ? { ...route, ...prepared } : null;
      })
    );

    return this.filterPreparedRoutes(preparedRoutes);
  }

  private async describePrepareCandidates<
    TPrepared extends { route: { model: string } },
  >(
    routes: ResolvedCopilotProvider[],
    prepare: (
      route: ResolvedCopilotProvider
    ) => Promise<TPrepared | null | undefined>
  ): Promise<CopilotProviderPrepareCandidateDiagnostics[]> {
    return await Promise.all(
      routes.map(async route => {
        const providerMetadata = routeCandidateProviderMetadata(route.profile);
        const baseModelDefinitionMetadata =
          routeCandidateModelDefinitionMetadata(
            route.profile,
            route.provider,
            route.modelId,
            route.modelId,
            route.execution
          );
        try {
          const prepared = await prepare(route);
          if (!prepared) {
            return {
              providerId: route.providerId,
              ...providerMetadata,
              ...(route.modelId ? { modelId: route.modelId } : {}),
              ...baseModelDefinitionMetadata,
              prepared: false,
              reasons: ['provider_prepare_returned_empty'],
            };
          }

          const preparedModelDefinitionMetadata =
            route.modelId === prepared.route.model
              ? baseModelDefinitionMetadata
              : routeCandidateModelDefinitionMetadata(
                  route.profile,
                  route.provider,
                  route.modelId,
                  prepared.route.model,
                  route.execution
                );
          return {
            providerId: route.providerId,
            ...providerMetadata,
            ...(route.modelId ? { modelId: route.modelId } : {}),
            ...preparedModelDefinitionMetadata,
            prepared: true,
            preparedModelId: prepared.route.model,
            reasons: ['provider_prepare_succeeded'],
          };
        } catch (error) {
          const errorCategory = prepareDiagnosticErrorCategory(error);
          return {
            providerId: route.providerId,
            ...providerMetadata,
            ...(route.modelId ? { modelId: route.modelId } : {}),
            ...baseModelDefinitionMetadata,
            prepared: false,
            errorCode: prepareDiagnosticErrorCode(error),
            errorCategory,
            reasons: [
              'provider_prepare_error',
              prepareDiagnosticErrorReason(errorCategory),
            ],
          };
        }
      })
    );
  }

  async resolveProvider(
    cond: ModelFullConditions,
    filter: {
      prefer?: CopilotProviderType;
    } = {},
    context: CopilotAccessContext = {}
  ): Promise<ResolvedCopilotProvider | null> {
    return (await this.resolveRoutes(cond, filter, context))[0] ?? null;
  }

  async resolveModelId(
    cond: ModelFullConditions,
    filter: {
      prefer?: CopilotProviderType;
    } = {},
    context: CopilotAccessContext = {}
  ): Promise<string | undefined> {
    const route = await this.resolveProvider(cond, filter, context);
    if (!route) {
      return;
    }

    if (cond.modelId) {
      return route.rawModelId ?? cond.modelId;
    }

    const model = route.provider.selectModel(
      { ...cond, modelId: route.modelId },
      route.execution
    );

    return `${route.providerId}/${route.modelId ?? model.id}`;
  }

  async resolveModelContextWindow(
    cond: ModelFullConditions,
    filter: {
      prefer?: CopilotProviderType;
    } = {},
    context: CopilotAccessContext = {}
  ): Promise<number | undefined> {
    const route = await this.resolveProvider(cond, filter, context);
    if (!route) {
      return;
    }

    const model = route.provider.selectModel(
      { ...cond, modelId: route.modelId },
      route.execution
    );

    return resolveModelContextWindow(model);
  }

  async resolveRoutes(
    cond: ModelFullConditions,
    filter: {
      prefer?: CopilotProviderType;
    } = {},
    context: CopilotAccessContext = {}
  ): Promise<ResolvedCopilotProvider[]> {
    this.logger.debug(
      `Resolving copilot provider for output type: ${cond.outputType}`
    );
    const { byokRegistry, quotaBackedRegistry, quotaBackedRoutesAvailable } =
      await this.getEffectiveRegistry(context, cond.outputType);
    if (quotaBackedRoutesAvailable) {
      const instanceContext = getRoutePolicyContext(context, cond.outputType);
      const resolved = await this.resolveRoutesFromRegistry(
        quotaBackedRegistry,
        cond,
        filter,
        instanceContext,
        {
          registryKind: 'quota_backed',
          registryAvailable: true,
        }
      );
      const fallbackProviderIds = resolved.map(route => route.providerId);
      return resolved.map(route => ({
        ...route,
        fallbackProviderIds,
        registrySelected: true,
      }));
    }

    const byokCond = this.normalizeByokCond(
      byokRegistry,
      quotaBackedRegistry,
      cond
    );
    const byokRoutes = await this.resolveRoutesFromRegistry(
      byokRegistry,
      byokCond,
      filter,
      this.byokRouteContext(byokRegistry, context),
      {
        registryKind: 'byok',
        registryAvailable: byokRegistry.order.length > 0,
      }
    );
    const normalizedByokRoutes =
      byokCond === cond || this.isProjectByokRegistry(byokRegistry)
        ? byokRoutes
        : byokRoutes.map(route => ({ ...route, rawModelId: cond.modelId }));
    if (!byokRegistry.order.length) {
      throw new CopilotByokNotConfigured();
    }
    const resolved = normalizedByokRoutes;
    for (const route of resolved) {
      this.logger.debug(
        `Copilot provider candidate found: ${route.provider.type} (${route.providerId})`
      );
    }

    const fallbackProviderIds = resolved.map(route => route.providerId);
    return resolved.map(route => ({
      ...route,
      fallbackProviderIds,
      registrySelected: route.registryKind === 'byok' ? true : undefined,
    }));
  }

  private async resolveRoutesFromRegistry(
    registry: CopilotProviderRegistry,
    cond: ModelFullConditions,
    filter: {
      prefer?: CopilotProviderType;
    } = {},
    context: CopilotAccessContext = {},
    registryDiagnostics: Pick<
      ResolvedCopilotProvider,
      'registryAvailable' | 'registryKind'
    > = {}
  ): Promise<ResolvedCopilotProvider[]> {
    const routePolicyContext = {
      workspaceId: context.workspaceId,
      featureKind: context.featureKind,
    };
    const route = resolveModel({
      registry,
      modelId: cond.modelId,
      outputType: cond.outputType,
      availableProviderIds: this.getAvailableProviderIds(registry),
      preferredProviderIds: this.getPreferredProviderIds(
        registry,
        filter.prefer,
        routePolicyContext
      ),
      routePolicyContext,
    });

    const resolved: ResolvedCopilotProvider[] = [];
    for (const providerId of route.candidateProviderIds) {
      const profile = registry.profiles.get(providerId);
      const provider = profile
        ? this.getProviderByProfile(providerId, profile)
        : undefined;
      if (!provider || !profile) continue;

      const normalizedCond = this.normalizeCond(registry, providerId, cond);
      if (
        normalizedCond.modelId &&
        !this.profileAllowsModel(profile, normalizedCond.modelId)
      ) {
        continue;
      }

      const execution = { providerId, profile };
      const profileModelIds = this.getProfileModelIds(profile);
      if (!normalizedCond.modelId && profileModelIds.length) {
        const matchedModelId = (
          await Promise.all(
            profileModelIds.map(async modelId =>
              (await provider.match({ ...normalizedCond, modelId }, execution))
                ? modelId
                : null
            )
          )
        ).find((modelId): modelId is string => !!modelId);
        if (!matchedModelId) continue;

        resolved.push({
          ...registryDiagnostics,
          providerId,
          provider,
          execution,
          profile,
          rawModelId: route.rawModelId,
          modelId: matchedModelId,
          explicitProviderId: route.explicitProviderId,
        });
        continue;
      }

      const matched = await provider.match(normalizedCond, execution);
      if (!matched) continue;

      resolved.push({
        ...registryDiagnostics,
        providerId,
        provider,
        execution,
        profile,
        rawModelId: route.rawModelId,
        modelId: normalizedCond.modelId,
        explicitProviderId: route.explicitProviderId,
      });
    }

    return resolved;
  }

  async prepareRoutes(
    kind: 'text' | 'streamText' | 'streamObject',
    cond: ModelFullConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions = {},
    filter: {
      prefer?: CopilotProviderType;
    } = {}
  ): Promise<ResolvedCopilotProvider[]> {
    const routes = await this.resolveRoutes(
      cond,
      filter,
      this.getRequestContext(options)
    );
    return await this.prepareResolvedRoutes(routes, async route => {
      const prepared = await getProviderRuntimeHost(
        route.provider
      ).prepare.chat(
        kind,
        { ...cond, modelId: route.modelId },
        messages,
        options,
        route.execution
      );
      const normalizedPrepared = prepared?.route ? prepared : undefined;
      if (!normalizedPrepared) {
        return null;
      }

      return {
        modelId: normalizedPrepared.route.model,
        prepared: normalizedPrepared,
      };
    });
  }

  async prepareStructuredRoutes(
    cond: ModelFullConditions,
    messages: PromptMessage[],
    options: CopilotStructuredOptions = {},
    filter: {
      prefer?: CopilotProviderType;
    } = {},
    responseContract?: RequiredStructuredOutputContract
  ): Promise<ResolvedCopilotProvider[]> {
    const routes = await this.resolveRoutes(
      cond,
      filter,
      this.getRequestContext(options)
    );
    return await this.prepareResolvedRoutes(routes, async route => {
      const preparedStructured =
        (await getProviderRuntimeHost(route.provider).prepare.structured(
          { ...cond, modelId: route.modelId },
          messages,
          options,
          responseContract,
          route.execution
        )) ?? undefined;
      if (!preparedStructured) {
        return null;
      }

      return {
        modelId: preparedStructured.route.model,
        preparedStructured,
      };
    });
  }

  async prepareEmbeddingRoutes(
    modelId: string | undefined,
    input: string | string[],
    options: CopilotEmbeddingOptions = {}
  ): Promise<ResolvedCopilotProvider[]> {
    const routes = await this.resolveRoutes(
      { modelId, outputType: ModelOutputType.Embedding },
      {},
      {
        ...this.getRequestContext(options),
        featureKind: options?.featureKind ?? 'embedding',
      }
    );
    return await this.prepareResolvedRoutes(routes, async route => {
      const preparedEmbedding =
        (await getProviderRuntimeHost(route.provider).prepare.embedding(
          { modelId: route.modelId },
          input,
          options,
          route.execution
        )) ?? undefined;
      if (!preparedEmbedding) {
        return null;
      }

      return {
        modelId: preparedEmbedding.route.model,
        preparedEmbedding,
      };
    });
  }

  async describeEmbeddingPrepareCandidates(
    modelId: string | undefined,
    input: string | string[],
    options: CopilotEmbeddingOptions = {}
  ): Promise<CopilotProviderPrepareCandidateDiagnostics[]> {
    try {
      const routes = await this.resolveRoutes(
        { modelId, outputType: ModelOutputType.Embedding },
        {},
        {
          ...this.getRequestContext(options),
          featureKind: options?.featureKind ?? 'embedding',
        }
      );
      return await this.describePrepareCandidates(routes, route =>
        getProviderRuntimeHost(route.provider).prepare.embedding(
          { modelId: route.modelId },
          input,
          options,
          route.execution
        )
      );
    } catch {
      return [];
    }
  }

  async prepareRerankRoutes(
    modelId: string | undefined,
    request: CopilotRerankRequest,
    options: CopilotChatOptions = {}
  ): Promise<ResolvedCopilotProvider[]> {
    const routes = await this.resolveRoutes(
      {
        modelId,
        outputType: ModelOutputType.Rerank,
      },
      {},
      { ...this.getRequestContext(options), featureKind: 'rerank' }
    );
    return await this.prepareResolvedRoutes(routes, async route => {
      const preparedRerank =
        (await getProviderRuntimeHost(route.provider).prepare.rerank(
          { modelId: route.modelId },
          request,
          options,
          route.execution
        )) ?? undefined;
      if (!preparedRerank) {
        return null;
      }

      return {
        modelId: preparedRerank.route.model,
        preparedRerank,
      };
    });
  }

  async describeRerankPrepareCandidates(
    modelId: string | undefined,
    request: CopilotRerankRequest,
    options: CopilotChatOptions = {}
  ): Promise<CopilotProviderPrepareCandidateDiagnostics[]> {
    try {
      const routes = await this.resolveRoutes(
        {
          modelId,
          outputType: ModelOutputType.Rerank,
        },
        {},
        { ...this.getRequestContext(options), featureKind: 'rerank' }
      );
      return await this.describePrepareCandidates(routes, route =>
        getProviderRuntimeHost(route.provider).prepare.rerank(
          { modelId: route.modelId },
          request,
          options,
          route.execution
        )
      );
    } catch {
      return [];
    }
  }

  async prepareImageRoutes(
    cond: ModelFullConditions,
    messages: PromptMessage[],
    options: CopilotImageOptions = {},
    filter: {
      prefer?: CopilotProviderType;
    } = {}
  ): Promise<ResolvedCopilotProvider[]> {
    const routes = await this.resolveRoutes(cond, filter, {
      ...this.getRequestContext(options),
      featureKind: options?.featureKind ?? 'image',
    });
    return await this.prepareResolvedRoutes(routes, async route => {
      const preparedImage =
        (await getProviderRuntimeHost(route.provider).prepare.image(
          { ...cond, modelId: route.modelId },
          messages,
          options,
          route.execution
        )) ?? undefined;
      if (!preparedImage) {
        return null;
      }

      return {
        modelId: preparedImage.route.model,
        preparedImage,
      };
    });
  }

  async getProvider(
    cond: ModelFullConditions,
    filter: {
      prefer?: CopilotProviderType;
    } = {}
  ): Promise<CopilotProvider | null> {
    return (await this.resolveProvider(cond, filter))?.provider ?? null;
  }

  async getProviderByModel(
    modelId: string,
    filter: {
      prefer?: CopilotProviderType;
    } = {}
  ): Promise<CopilotProvider | null> {
    this.logger.debug(`Resolving copilot provider for model: ${modelId}`);
    return this.getProvider({ modelId }, filter);
  }

  register(providerId: string, provider: CopilotProvider) {
    const existed = this.#providers.get(providerId);
    if (existed?.type && existed.type !== provider.type) {
      const ids = this.#providerIdsByType.get(existed.type);
      ids?.delete(providerId);
      if (!ids?.size) {
        this.#providerIdsByType.delete(existed.type);
      }
    }

    this.#providers.set(providerId, provider);

    const ids = this.#providerIdsByType.get(provider.type) ?? new Set<string>();
    ids.add(providerId);
    this.#providerIdsByType.set(provider.type, ids);

    this.logger.log(
      `Copilot provider [${provider.type}] registered as [${providerId}].`
    );
    this.server.enableFeature(ServerFeature.Copilot);
  }

  registerRuntime(provider: CopilotProvider) {
    this.#runtimeProvidersByType.set(provider.type, provider);
  }

  unregister(providerId: string, provider: CopilotProvider) {
    const existed = this.#providers.get(providerId);
    if (!existed || existed !== provider) {
      return;
    }

    this.#providers.delete(providerId);

    const ids = this.#providerIdsByType.get(provider.type);
    ids?.delete(providerId);
    if (!ids?.size) {
      this.#providerIdsByType.delete(provider.type);
    }

    this.logger.log(
      `Copilot provider [${provider.type}] unregistered from [${providerId}].`
    );
  }
}
