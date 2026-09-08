import {
  getPromptModelsQuery,
  type QueryResponse,
  SubscriptionStatus,
} from '@affine/graphql';
import { I18n } from '@affine/i18n';
import type { Signal } from '@blocksuite/affine/shared/utils';
import { signal } from '@preact/signals-core';
import { LiveData, Service } from '@toeverything/infra';
import type { Subscription } from 'rxjs';

import type { GraphQLService, SubscriptionService } from '../../cloud';
import type { GlobalStateService } from '../../storage';

const AI_MODEL_ID_KEY = 'AIModelId';
const AI_MODEL_DEFAULT_PROMPT_NAME = 'Chat With LocalMind AI';
const AI_MODEL_LEGACY_DEFAULT_PROMPT_NAME = 'Chat With AFFiNE AI';
const AI_MODEL_DEFAULT_PROMPT_DISPLAY_NAME = 'LocalMind AI';

export function formatAIModelPromptDisplayName(promptName: string) {
  return promptName === AI_MODEL_DEFAULT_PROMPT_NAME ||
    promptName === AI_MODEL_LEGACY_DEFAULT_PROMPT_NAME
    ? AI_MODEL_DEFAULT_PROMPT_DISPLAY_NAME
    : promptName;
}

function normalizeAIModelPromptName(promptName?: string | null) {
  const nextPromptName = promptName?.trim();
  if (nextPromptName === AI_MODEL_LEGACY_DEFAULT_PROMPT_NAME) {
    return AI_MODEL_DEFAULT_PROMPT_NAME;
  }
  return nextPromptName || AI_MODEL_DEFAULT_PROMPT_NAME;
}

export function resolveAIModelPromptName(
  promptName?: string | null,
  sessionPromptName?: string | null
) {
  return normalizeAIModelPromptName(
    promptName?.trim() || sessionPromptName?.trim()
  );
}

export function getAIModelIdKey(
  workspaceId?: string | null,
  promptName?: string | null
) {
  const parts = [AI_MODEL_ID_KEY];
  if (workspaceId) {
    parts.push(workspaceId);
  }
  const nextPromptName = normalizeAIModelPromptName(promptName);
  if (nextPromptName !== AI_MODEL_DEFAULT_PROMPT_NAME) {
    parts.push(`prompt:${encodeURIComponent(nextPromptName)}`);
  }
  return parts.join(':');
}

export interface AIModel {
  name: string;
  id: string;
  version: string;
  category: string;
  defaultModelFallbackReason?: string | null;
  defaultModelSource?: string | null;
  promptName?: string | null;
  promptAction?: string | null;
  promptSource?: string | null;
  promptCategory?: string | null;
  promptDefaultModel?: string | null;
  promptDefaultPolicy?: string | null;
  promptModelConfigPath?: string | null;
  promptModelSource?: string | null;
  promptModelSources?: AIModelPromptSource[] | null;
  promptOverrideApplied?: boolean | null;
  providerId?: string | null;
  providerName?: string | null;
  routeModelId?: string | null;
  routeFallbackProviderIds?: string[] | null;
  providerType?: string | null;
  providerSource?: string | null;
  providerProfileId?: string | null;
  providerProfileSource?: string | null;
  providerProfileConfigPath?: string | null;
  providerConfiguredModelIds?: string[] | null;
  providerConfiguredModelCount?: number | null;
  providerPrivacy?: string | null;
  providerHealth?: string | null;
  providerHealthCheckedAt?: string | null;
  providerHealthLastError?: string | null;
  providerPriority?: number | null;
  registryAvailable?: boolean | null;
  registryKind?: string | null;
  registrySelected?: boolean | null;
  effectiveSourceFingerprint?: string | null;
  effectiveSourceFingerprintInputs?: string[] | null;
  effectiveSourceFingerprintVersion?: string | null;
  routeBackendKind?: string | null;
  routeCanonicalModelKey?: string | null;
  routeRawModelId?: string | null;
  routeModelDefinitionSource?: string | null;
  routeModelDefinitionId?: string | null;
  routeModelDefinitionAliases?: string[] | null;
  routeModelAliasMatched?: boolean | null;
  modelRegistryRevision?: string | null;
  modelRegistryRevisionActorId?: string | null;
  modelRegistryRevisionFingerprint?: string | null;
  modelRegistryRevisionId?: string | null;
  modelRegistryRevisionScope?: string | null;
  modelRegistryRevisionSourceChain?: AIModelRegistrySourceChainEntry[] | null;
  modelRegistryRevisionSourceChainFingerprint?: string | null;
  modelRegistryRevisionStatus?: string | null;
  modelRegistryRevisionWorkspaceId?: string | null;
  modelRegistryRevisionPublishEventCount?: number | null;
  modelRegistryRevisionPublishEvents?:
    | AIModelRegistryRevisionPublishEvent[]
    | null;
  routeProtocol?: string | null;
  routeRequestLayer?: string | null;
  routeBehaviorFlags?: string[] | null;
  routeInputTypes?: string[] | null;
  routeOutputTypes?: string[] | null;
  routeAttachmentAllowRemoteUrls?: boolean | null;
  routeAttachmentKinds?: string[] | null;
  routeAttachmentSourceKinds?: string[] | null;
  routeStructuredAttachmentAllowRemoteUrls?: boolean | null;
  routeStructuredAttachmentKinds?: string[] | null;
  routeStructuredAttachmentSourceKinds?: string[] | null;
  contextWindow?: number | null;
  maxOutputTokens?: number | null;
  embeddingDimensions?: number | null;
  costInputPer1M?: number | null;
  costOutputPer1M?: number | null;
  sources?: string[];
  routePolicyEnabled?: boolean | null;
  routePolicyFeatureKind?: string | null;
  routePolicyWorkspaceId?: string | null;
  routePolicyAllowedProviderIds?: string[] | null;
  routePolicyBlockedProviderIds?: string[] | null;
  routePolicyAllowedPrivacy?: string[] | null;
  routePolicyPreferredPrivacy?: string[] | null;
  embeddingRoute?: AIModelTaskRoute | null;
  rerankRoute?: AIModelTaskRoute | null;
  isPro: boolean;
  isDefault: boolean;
}

export interface AIModelPromptSource {
  candidateSource: string;
  modelConfigPath?: string | null;
  modelSource?: string | null;
}

export interface AIModelRegistrySourceChainEntry {
  actorId?: string | null;
  fingerprint?: string | null;
  modelId?: string | null;
  providerId?: string | null;
  revision?: string | null;
  scope: string;
  source: string;
  status: string;
  updatedAt?: string | null;
  workspaceId?: string | null;
}

export interface AIModelRegistryRevisionPublishEvent {
  actorId?: string | null;
  createdAt: string;
  eventFingerprint: string;
  eventType: string;
  id: string;
  metadata?: unknown;
  publishSource: string;
  registryFamily: string;
  registryKey: string;
  registryModelId?: string | null;
  registryProviderId?: string | null;
  revision: string;
  revisionFingerprint: string;
  revisionId: string;
  revisionStatus: string;
  scopeType: string;
  workspaceId?: string | null;
}

export interface AIModelTaskRoute {
  behaviorFlags?: string[] | null;
  candidateCount?: number | null;
  canonicalModelKey?: string | null;
  configured: boolean;
  diagnosticsErrors?: AIModelTaskRouteDiagnosticsError[] | null;
  dimensionMismatch?: boolean | null;
  effectiveSourceFingerprint?: string | null;
  effectiveSourceFingerprintInputs?: string[] | null;
  effectiveSourceFingerprintVersion?: string | null;
  embeddingIndexContractDimensions?: number | null;
  embeddingIndexContractFingerprint?: string | null;
  embeddingIndexContractStatus?: string | null;
  embeddingIndexContractVersion?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  fallbackProviderIds?: string[] | null;
  featureKind: string;
  modelBackendKind?: string | null;
  modelEmbeddingDimensions?: number | null;
  modelId?: string | null;
  policyAllowedProviderIds?: string[] | null;
  policyAllowedPrivacy?: string[] | null;
  policyBlockedProviderIds?: string[] | null;
  policyEnabled?: boolean | null;
  policyFeatureKind?: string | null;
  policyPreferredPrivacy?: string[] | null;
  policyWorkspaceId?: string | null;
  policyCandidates?: AIModelTaskRoutePolicyCandidate[] | null;
  routeCandidates?: AIModelTaskRouteCandidate[] | null;
  routeTrace?: AIModelTaskRouteTracePhase[] | null;
  prepareCandidates?: AIModelTaskRoutePrepareCandidate[] | null;
  preparedProviderCount: number;
  preparedRouteTargetFingerprint?: string | null;
  preparedRouteTargets?: string[] | null;
  providerConfiguredModelCount?: number | null;
  providerConfiguredModelIds?: string[] | null;
  providerId?: string | null;
  providerName?: string | null;
  providerPriority?: number | null;
  providerProfileConfigPath?: string | null;
  providerProfileId?: string | null;
  providerProfileSource?: string | null;
  providerSource?: string | null;
  providerType?: string | null;
  protocol?: string | null;
  requestedModelConfigKey?: string | null;
  requestedModelConfigPath?: string | null;
  requestedModelId?: string | null;
  requestedModelSource?: string | null;
  taskRoutePolicyRevision?: string | null;
  taskRoutePolicyRevisionActorId?: string | null;
  taskRoutePolicyRevisionFingerprint?: string | null;
  taskRoutePolicyRevisionId?: string | null;
  taskRoutePolicyRevisionScope?: string | null;
  taskRoutePolicyRevisionSourceChain?:
    | AIModelTaskRoutePolicySourceChainEntry[]
    | null;
  taskRoutePolicyRevisionSourceChainFingerprint?: string | null;
  taskRoutePolicyRevisionStatus?: string | null;
  taskRoutePolicyRevisionWorkspaceId?: string | null;
  taskRoutePolicyRevisionPublishEventCount?: number | null;
  taskRoutePolicyRevisionPublishEvents?:
    | AIModelRegistryRevisionPublishEvent[]
    | null;
  requestedDimensions?: number | null;
  requestLayer?: string | null;
  rerankRuntimeContractFingerprint?: string | null;
  rerankRuntimeContractStatus?: string | null;
  rerankRuntimeContractTopK?: number | null;
  rerankRuntimeContractVersion?: string | null;
  topK?: number | null;
  preparedRoutes?: AIModelPreparedTaskRoute[] | null;
}

export interface AIModelTaskRoutePolicySourceChainEntry {
  actorId?: string | null;
  configKey?: string | null;
  configPath?: string | null;
  featureKind?: string | null;
  fingerprint?: string | null;
  modelId?: string | null;
  revision?: string | null;
  scope: string;
  source: string;
  status: string;
  updatedAt?: string | null;
  workspaceId?: string | null;
}

export interface AIModelTaskRouteDiagnosticsError {
  code: string;
  message: string;
  stage: string;
}

export interface AIModelPreparedTaskRoute {
  behaviorFlags?: string[] | null;
  canonicalModelKey?: string | null;
  dimensionMismatch?: boolean | null;
  fallbackOrderIndex?: number | null;
  modelEmbeddingDimensions?: number | null;
  modelBackendKind?: string | null;
  modelId: string;
  protocol?: string | null;
  providerConfiguredModelCount?: number | null;
  providerConfiguredModelIds?: string[] | null;
  providerId: string;
  providerName?: string | null;
  providerPriority?: number | null;
  providerProfileConfigPath?: string | null;
  providerProfileId?: string | null;
  providerProfileSource?: string | null;
  providerSource?: string | null;
  providerType?: string | null;
  requestedDimensions?: number | null;
  requestLayer?: string | null;
  routeIndex?: number | null;
}

export interface AIModelTaskRoutePolicyCandidate {
  allowed: boolean;
  available: boolean;
  candidateFingerprint?: string | null;
  candidateKey?: string | null;
  health: string;
  healthCheckedAt?: string | null;
  privacy: string;
  providerId: string;
  providerConfiguredModelCount?: number | null;
  providerConfiguredModelIds?: string[] | null;
  providerName?: string | null;
  providerProfileConfigPath?: string | null;
  providerProfileId?: string | null;
  providerProfileSource?: string | null;
  providerSource?: string | null;
  providerPriority?: number | null;
  providerType?: string | null;
  registryAvailable?: boolean | null;
  registryKind?: string | null;
  registrySelected?: boolean | null;
  reasons: string[];
}

export interface AIModelTaskRouteCandidate {
  candidateKey?: string | null;
  candidateModelIds?: string[] | null;
  matched: boolean;
  modelRegistryRevision?: string | null;
  modelRegistryRevisionActorId?: string | null;
  modelRegistryRevisionFingerprint?: string | null;
  modelRegistryRevisionId?: string | null;
  modelRegistryRevisionScope?: string | null;
  modelRegistryRevisionSourceChain?: AIModelRegistrySourceChainEntry[] | null;
  modelRegistryRevisionSourceChainFingerprint?: string | null;
  modelRegistryRevisionStatus?: string | null;
  modelRegistryRevisionWorkspaceId?: string | null;
  modelRegistryRevisionPublishEventCount?: number | null;
  modelRegistryRevisionPublishEvents?:
    | AIModelRegistryRevisionPublishEvent[]
    | null;
  modelId?: string | null;
  providerId: string;
  providerConfiguredModelCount?: number | null;
  providerConfiguredModelIds?: string[] | null;
  providerName?: string | null;
  providerProfileConfigPath?: string | null;
  providerProfileId?: string | null;
  providerProfileSource?: string | null;
  providerSource?: string | null;
  providerType?: string | null;
  providerPriority?: number | null;
  privacy?: string | null;
  health?: string | null;
  healthCheckedAt?: string | null;
  routeRawModelId?: string | null;
  routeAttachmentAllowRemoteUrls?: boolean | null;
  routeAttachmentKinds?: string[] | null;
  routeAttachmentSourceKinds?: string[] | null;
  routeContextWindow?: number | null;
  routeEmbeddingDimensions?: number | null;
  routeInputTypes?: string[] | null;
  routeMaxOutputTokens?: number | null;
  routeModelDefinitionSource?: string | null;
  routeModelDefinitionId?: string | null;
  routeModelDefinitionAliases?: string[] | null;
  routeModelAliasMatched?: boolean | null;
  routeOutputTypes?: string[] | null;
  routeStructuredAttachmentAllowRemoteUrls?: boolean | null;
  routeStructuredAttachmentKinds?: string[] | null;
  routeStructuredAttachmentSourceKinds?: string[] | null;
  reasons: string[];
  registryAvailable?: boolean | null;
  registryKind?: string | null;
  registrySelected?: boolean | null;
  requestedModelId?: string | null;
}

export interface AIModelTaskRoutePrepareCandidate {
  candidateKey?: string | null;
  candidateModelIds?: string[] | null;
  errorCategory?: string | null;
  errorCode?: string | null;
  modelRegistryRevision?: string | null;
  modelRegistryRevisionActorId?: string | null;
  modelRegistryRevisionFingerprint?: string | null;
  modelRegistryRevisionId?: string | null;
  modelRegistryRevisionScope?: string | null;
  modelRegistryRevisionSourceChain?: AIModelRegistrySourceChainEntry[] | null;
  modelRegistryRevisionSourceChainFingerprint?: string | null;
  modelRegistryRevisionStatus?: string | null;
  modelRegistryRevisionWorkspaceId?: string | null;
  modelRegistryRevisionPublishEventCount?: number | null;
  modelRegistryRevisionPublishEvents?:
    | AIModelRegistryRevisionPublishEvent[]
    | null;
  providerConfiguredModelCount?: number | null;
  providerConfiguredModelIds?: string[] | null;
  providerName?: string | null;
  providerProfileConfigPath?: string | null;
  providerProfileId?: string | null;
  providerProfileSource?: string | null;
  providerSource?: string | null;
  providerType?: string | null;
  providerPriority?: number | null;
  privacy?: string | null;
  health?: string | null;
  healthCheckedAt?: string | null;
  modelId?: string | null;
  prepared: boolean;
  preparedModelId?: string | null;
  providerId: string;
  routeRawModelId?: string | null;
  routeAttachmentAllowRemoteUrls?: boolean | null;
  routeAttachmentKinds?: string[] | null;
  routeAttachmentSourceKinds?: string[] | null;
  routeContextWindow?: number | null;
  routeEmbeddingDimensions?: number | null;
  routeInputTypes?: string[] | null;
  routeMaxOutputTokens?: number | null;
  routeModelDefinitionSource?: string | null;
  routeModelDefinitionId?: string | null;
  routeModelDefinitionAliases?: string[] | null;
  routeModelAliasMatched?: boolean | null;
  routeOutputTypes?: string[] | null;
  routeStructuredAttachmentAllowRemoteUrls?: boolean | null;
  routeStructuredAttachmentKinds?: string[] | null;
  routeStructuredAttachmentSourceKinds?: string[] | null;
  reasons: string[];
  registryAvailable?: boolean | null;
  registryKind?: string | null;
  registrySelected?: boolean | null;
  requestedModelId?: string | null;
}

export interface AIModelTaskRouteTracePhase {
  availableCount?: number | null;
  blockedCount?: number | null;
  candidateCount: number;
  matchedCount?: number | null;
  phase: string;
  preparedCount?: number | null;
  reasons: string[];
  selectedCount?: number | null;
}

export type AIModelTaskRouteReasonPhase =
  | 'policy'
  | 'prompt'
  | 'resolution'
  | 'prepared'
  | 'unknown';

export type AIModelTaskRouteReasonSeverity = 'info' | 'warning' | 'error';

export type AIModelTaskRouteReasonActionKind =
  | 'none'
  | 'check_model_capability'
  | 'check_model_profile'
  | 'check_prompt_default'
  | 'check_policy'
  | 'check_privacy_policy'
  | 'check_provider_runtime'
  | 'check_quota'
  | 'check_registry'
  | 'configure_provider'
  | 'inspect_prepare_trace';

export type AIModelTaskRouteReasonRemediationActionKind = Exclude<
  AIModelTaskRouteReasonActionKind,
  'none'
>;

export type AIModelTaskRouteRemediationTargetKind =
  | 'model_registry'
  | 'prepare_trace'
  | 'prompt_registry'
  | 'provider_profiles'
  | 'provider_registry'
  | 'provider_runtime_logs'
  | 'quota'
  | 'route_policy';

export interface AIModelTaskRouteRemediationTarget {
  description: string;
  kind: AIModelTaskRouteRemediationTargetKind;
  label: string;
}

export type AIModelTaskRouteReasonSource =
  | 'policy_candidate'
  | 'prompt_default'
  | 'prepare_candidate'
  | 'route_candidate'
  | 'route_trace';

export interface AIModelTaskRouteReasonMetadata {
  code: string;
  label: string;
  description: string;
  phase: AIModelTaskRouteReasonPhase;
  severity: AIModelTaskRouteReasonSeverity;
  actionKind?: AIModelTaskRouteReasonActionKind;
  remediation?: string;
}

export interface AIModelTaskRouteReasonSummaryItem extends AIModelTaskRouteReasonMetadata {
  count: number;
  sources: AIModelTaskRouteReasonSource[];
}

export interface AIModelTaskRouteReasonSummarySeverityGroup {
  count: number;
  reasons: AIModelTaskRouteReasonSummaryItem[];
  severity: AIModelTaskRouteReasonSeverity;
}

export interface AIModelTaskRouteReasonSummaryActionGroup {
  actionKind: AIModelTaskRouteReasonRemediationActionKind;
  count: number;
  reasons: AIModelTaskRouteReasonSummaryItem[];
}

export interface AIModelTaskRouteReasonSummary {
  byActionKind: AIModelTaskRouteReasonSummaryActionGroup[];
  bySeverity: AIModelTaskRouteReasonSummarySeverityGroup[];
  highestSeverity: AIModelTaskRouteReasonSeverity;
  reasons: AIModelTaskRouteReasonSummaryItem[];
}

export type AIModelTaskRouteReadinessStatus =
  | 'blocked'
  | 'ready'
  | 'unconfigured'
  | 'warning';

export interface AIModelTaskRouteReadinessSummary {
  actionKinds: AIModelTaskRouteReasonRemediationActionKind[];
  configured: boolean;
  dimensionMismatch?: boolean | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  featureKind: string;
  modelId?: string | null;
  preparedProviderCount: number;
  providerId?: string | null;
  reasonSummary: AIModelTaskRouteReasonSummary;
  requestedModelConfigKey?: string | null;
  requestedModelConfigPath?: string | null;
  requestedModelId?: string | null;
  requestedModelSource?: string | null;
  severity: AIModelTaskRouteReasonSeverity;
  status: AIModelTaskRouteReadinessStatus;
}

export interface AIModelTaskRoutesReadinessSummary {
  actionKinds: AIModelTaskRouteReasonRemediationActionKind[];
  highestSeverity: AIModelTaskRouteReasonSeverity;
  routes: AIModelTaskRouteReadinessSummary[];
  status: AIModelTaskRouteReadinessStatus;
}

export type AIModelTaskRouteCandidateTraceStatus =
  | 'filtered'
  | 'matched'
  | 'prepare_only'
  | 'prepared'
  | 'unmatched';

export interface AIModelTaskRouteCandidateTraceRow {
  actionKinds: AIModelTaskRouteReasonRemediationActionKind[];
  candidateKey?: string | null;
  candidateModelIds?: string[] | null;
  errorCategory?: string | null;
  errorCode?: string | null;
  matched?: boolean | null;
  modelId?: string | null;
  prepared?: boolean | null;
  preparedModelId?: string | null;
  providerId: string;
  providerConfiguredModelCount?: number | null;
  providerConfiguredModelIds?: string[] | null;
  providerName?: string | null;
  providerProfileConfigPath?: string | null;
  providerProfileId?: string | null;
  providerProfileSource?: string | null;
  providerSource?: string | null;
  providerType?: string | null;
  providerPriority?: number | null;
  privacy?: string | null;
  health?: string | null;
  healthCheckedAt?: string | null;
  reasonSummary: AIModelTaskRouteReasonSummary;
  registryAvailable?: boolean | null;
  registryKind?: string | null;
  registrySelected?: boolean | null;
  requestedModelId?: string | null;
  routeAttachmentAllowRemoteUrls?: boolean | null;
  routeAttachmentKinds?: string[] | null;
  routeAttachmentSourceKinds?: string[] | null;
  routeContextWindow?: number | null;
  routeEmbeddingDimensions?: number | null;
  routeInputTypes?: string[] | null;
  routeMaxOutputTokens?: number | null;
  routeModelAliasMatched?: boolean | null;
  routeModelDefinitionAliases?: string[] | null;
  routeModelDefinitionId?: string | null;
  routeModelDefinitionSource?: string | null;
  modelRegistryRevision?: string | null;
  modelRegistryRevisionActorId?: string | null;
  modelRegistryRevisionFingerprint?: string | null;
  modelRegistryRevisionId?: string | null;
  modelRegistryRevisionScope?: string | null;
  modelRegistryRevisionSourceChain?: AIModelRegistrySourceChainEntry[] | null;
  modelRegistryRevisionSourceChainFingerprint?: string | null;
  modelRegistryRevisionStatus?: string | null;
  modelRegistryRevisionWorkspaceId?: string | null;
  modelRegistryRevisionPublishEventCount?: number | null;
  modelRegistryRevisionPublishEvents?:
    | AIModelRegistryRevisionPublishEvent[]
    | null;
  routeOutputTypes?: string[] | null;
  routeStructuredAttachmentAllowRemoteUrls?: boolean | null;
  routeStructuredAttachmentKinds?: string[] | null;
  routeStructuredAttachmentSourceKinds?: string[] | null;
  routeRawModelId?: string | null;
  severity: AIModelTaskRouteReasonSeverity;
  status: AIModelTaskRouteCandidateTraceStatus;
}

export interface AIModelTaskRouteCandidateTraceSummary {
  actionKinds: AIModelTaskRouteReasonRemediationActionKind[];
  highestSeverity: AIModelTaskRouteReasonSeverity;
  rows: AIModelTaskRouteCandidateTraceRow[];
}

export type AIModelTaskRoutePolicyCandidateTraceStatus =
  | 'allowed'
  | 'blocked'
  | 'unavailable';

export interface AIModelTaskRoutePolicyCandidateTraceRow {
  actionKinds: AIModelTaskRouteReasonRemediationActionKind[];
  allowed: boolean;
  available: boolean;
  candidateFingerprint?: string | null;
  candidateKey?: string | null;
  health: string;
  healthCheckedAt?: string | null;
  privacy: string;
  providerId: string;
  providerConfiguredModelCount?: number | null;
  providerConfiguredModelIds?: string[] | null;
  providerName?: string | null;
  providerProfileConfigPath?: string | null;
  providerProfileId?: string | null;
  providerProfileSource?: string | null;
  providerSource?: string | null;
  providerPriority?: number | null;
  providerType?: string | null;
  registryAvailable?: boolean | null;
  registryKind?: string | null;
  registrySelected?: boolean | null;
  reasonSummary: AIModelTaskRouteReasonSummary;
  severity: AIModelTaskRouteReasonSeverity;
  status: AIModelTaskRoutePolicyCandidateTraceStatus;
}

export interface AIModelTaskRoutePolicyCandidateTraceSummary {
  actionKinds: AIModelTaskRouteReasonRemediationActionKind[];
  highestSeverity: AIModelTaskRouteReasonSeverity;
  rows: AIModelTaskRoutePolicyCandidateTraceRow[];
}

export interface AIModelTaskRoutePhaseTraceRow {
  actionKinds: AIModelTaskRouteReasonRemediationActionKind[];
  availableCount?: number | null;
  blockedCount?: number | null;
  candidateCount: number;
  matchedCount?: number | null;
  phase: string;
  preparedCount?: number | null;
  reasonSummary: AIModelTaskRouteReasonSummary;
  selectedCount?: number | null;
  severity: AIModelTaskRouteReasonSeverity;
}

export interface AIModelTaskRoutePhaseTraceSummary {
  actionKinds: AIModelTaskRouteReasonRemediationActionKind[];
  highestSeverity: AIModelTaskRouteReasonSeverity;
  phases: AIModelTaskRoutePhaseTraceRow[];
}

export interface AIModelTaskRoutePolicySummary {
  allowedPrivacy: string[];
  allowedProviderIds: string[];
  blockedProviderIds: string[];
  enabled: boolean | null;
  featureKind: string;
  label: string | null;
  preferredPrivacy: string[];
  workspaceId: string | null;
}

export interface AIModelTaskRouteDiagnosticsSummary {
  actionKinds: AIModelTaskRouteReasonRemediationActionKind[];
  candidateTrace: AIModelTaskRouteCandidateTraceSummary;
  phaseTrace: AIModelTaskRoutePhaseTraceSummary;
  policy: AIModelTaskRoutePolicySummary;
  policyCandidateTrace: AIModelTaskRoutePolicyCandidateTraceSummary;
  readiness: AIModelTaskRouteReadinessSummary;
  reasonSummary: AIModelTaskRouteReasonSummary;
}

export interface AIModelTaskRoutesDiagnosticsSummary {
  actionKinds: AIModelTaskRouteReasonRemediationActionKind[];
  highestSeverity: AIModelTaskRouteReasonSeverity;
  routes: AIModelTaskRouteDiagnosticsSummary[];
  status: AIModelTaskRouteReadinessStatus;
}

export interface AIModelPromptDefaultDiagnosticsSummary {
  actionKinds: AIModelTaskRouteReasonRemediationActionKind[];
  activeDefaultModel?: string | null;
  defaultModelSource?: string | null;
  promptDefaultModel?: string | null;
  reasonSummary: AIModelTaskRouteReasonSummary;
}

export interface AIModelPromptDefaultDiagnosticsInput {
  defaultModel?: string | null;
  defaultModelFallbackReason?: string | null;
  defaultModelSource?: string | null;
  id?: string | null;
  isDefault?: boolean | null;
  promptDefaultModel?: string | null;
}

const PROVIDER_PRIVACY_LABELS: Record<string, string> = {
  cloud: 'Cloud',
  private_cloud: 'Private cloud',
  local: 'Local',
};

const PROVIDER_HEALTH_LABELS: Record<string, string> = {
  unknown: 'Unknown',
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
};

const PROVIDER_SOURCE_LABELS: Record<string, string> = {
  byok_local: 'BYOK local',
  byok_server: 'BYOK server',
  configured: 'Configured',
  legacy: 'Legacy config',
};

const PROVIDER_HEALTH_SORT_ORDER: Record<string, number> = {
  healthy: 0,
  unknown: 1,
  degraded: 2,
  down: 3,
};

const PROVIDER_PRIVACY_SORT_ORDER: Record<string, number> = {
  local: 0,
  private_cloud: 1,
  cloud: 2,
};

const MODEL_SOURCE_LABELS: Record<string, string> = {
  default: 'Default',
  fallback_route: 'Fallback Route',
  prompt: 'Prompt',
  registry: 'Registry',
  pro: 'Pro',
};

const ROUTE_POLICY_FEATURE_LABELS: Record<string, string> = {
  action: 'Action',
  chat: 'Chat',
  embedding: 'Embedding',
  image: 'Image',
  rerank: 'Rerank',
  transcript: 'Transcript',
  workspace_indexing: 'Workspace indexing',
};

const PROMPT_SOURCE_LABELS: Record<string, string> = {
  built_in: 'Built-in',
  compat: 'Compat',
};

const PROMPT_CATEGORY_LABELS: Record<string, string> = {
  image: 'Image',
  text: 'Text',
  transcript: 'Transcript',
};

const PROMPT_DEFAULT_POLICY_LABELS: Record<string, string> = {
  image: 'Image default',
  structured: 'Structured default',
  text: 'Text default',
  transcript: 'Transcript default',
};

const PROMPT_DEFAULT_MODEL_SOURCE_LABELS: Record<string, string> = {
  fallback_route: 'Fallback Route',
  prompt: 'Prompt',
};

const PROMPT_MODEL_SOURCE_LABELS: Record<string, string> = {
  built_in: 'Built-in prompt',
  compat: 'Compat prompt',
  default_policy: 'Prompt default policy',
  override: 'Prompt override',
};

const MODEL_DEFINITION_SOURCE_LABELS: Record<string, string> = {
  db_revision: 'DB-backed model registry',
  native_registry: 'Native registry',
  provider_profile: 'Provider profile',
  provider_runtime: 'Provider runtime',
};

const TASK_MODEL_SOURCE_LABELS: Record<string, string> = {
  db_revision: 'DB-backed task route policy',
  embedding: 'Embedding task model',
  provider_default: 'Auto provider default',
  rerank: 'Rerank task model',
  workspace_indexing: 'Workspace indexing task model',
  workspace_indexing_embedding_fallback: 'Embedding task model fallback',
};

const TASK_ROUTE_REASON_METADATA: Record<
  string,
  Omit<AIModelTaskRouteReasonMetadata, 'code'>
> = {
  prompt_default_unavailable: {
    get label() {
      return I18n['com.affine.ui.prompt-default-unavailable']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-prompt-default-model-is-not-routable-so-the-active-default-uses-a-fallback-route'
      ]();
    },
    phase: 'prompt',
    severity: 'warning',
    actionKind: 'check_prompt_default',
    remediation:
      'Update the prompt default model or prompt default policy to a model alias that is routable in the current provider registry and workspace policy.',
  },
  candidate_allowed: {
    get label() {
      return I18n['com.affine.ui.policy-allowed']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-candidate-passed-route-policy-checks'
      ]();
    },
    phase: 'policy',
    severity: 'info',
    actionKind: 'none',
  },
  provider_unavailable: {
    get label() {
      return I18n['com.affine.ui.provider-unavailable']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-is-not-currently-available-for-routing'
      ]();
    },
    phase: 'policy',
    severity: 'error',
    actionKind: 'configure_provider',
    remediation:
      'Check that the provider is enabled, healthy, and has the required credentials or local endpoint configured.',
  },
  provider_blocked: {
    get label() {
      return I18n['com.affine.ui.provider-blocked']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-route-policy-explicitly-blocks-this-provider'
      ]();
    },
    phase: 'policy',
    severity: 'warning',
    actionKind: 'check_policy',
    remediation:
      'Review the route policy blocked-provider list or select a different provider.',
  },
  provider_not_allowed: {
    get label() {
      return I18n['com.affine.ui.provider-not-allowed']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-route-policy-allowed-provider-list-excludes-this-provider'
      ]();
    },
    phase: 'policy',
    severity: 'warning',
    actionKind: 'check_policy',
    remediation:
      'Add the provider to the allowed-provider policy list or choose a provider already allowed for this feature.',
  },
  privacy_not_allowed: {
    get label() {
      return I18n['com.affine.ui.privacy-not-allowed']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-privacy-class-is-not-allowed-by-route-policy'
      ]();
    },
    phase: 'policy',
    severity: 'warning',
    actionKind: 'check_privacy_policy',
    remediation:
      'Allow this privacy class in route policy or route the task to a provider with an allowed privacy class.',
  },
  privacy_preferred: {
    get label() {
      return I18n['com.affine.ui.preferred-privacy']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-privacy-class-matches-a-preferred-route-policy'
      ]();
    },
    phase: 'policy',
    severity: 'info',
    actionKind: 'none',
  },
  privacy_not_preferred: {
    get label() {
      return I18n['com.affine.ui.privacy-not-preferred']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-privacy-class-is-allowed-but-not-preferred'
      ]();
    },
    phase: 'policy',
    severity: 'info',
    actionKind: 'check_privacy_policy',
    remediation:
      'If this provider should be prioritized, add its privacy class to the preferred privacy policy.',
  },
  registry_selected: {
    get label() {
      return I18n['com.affine.ui.registry-selected']();
    },
    get description() {
      return I18n[
        'com.affine.ui.this-registry-branch-produced-a-selected-route-candidate'
      ]();
    },
    phase: 'resolution',
    severity: 'info',
    actionKind: 'none',
  },
  registry_shadowed_by_byok: {
    get label() {
      return I18n['com.affine.ui.legacy-platform-route-disabled']();
    },
    get description() {
      return I18n[
        'com.affine.ui.this-legacy-platform-candidate-is-not-eligible-for-byok-only-execution'
      ]();
    },
    phase: 'resolution',
    severity: 'info',
    actionKind: 'check_registry',
    remediation: 'Configure an eligible BYOK provider and model for this task.',
  },
  registry_unavailable: {
    get label() {
      return I18n['com.affine.ui.registry-unavailable']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-registry-branch-is-unavailable-for-this-request'
      ]();
    },
    phase: 'resolution',
    severity: 'warning',
    actionKind: 'check_registry',
    remediation:
      'Check whether the BYOK registry has an eligible, enabled provider profile for this request.',
  },
  quota_exceeded_fallback_candidate: {
    get label() {
      return I18n['com.affine.ui.legacy-quota-candidate']();
    },
    get description() {
      return I18n[
        'com.affine.ui.an-older-diagnostic-identified-a-platform-route-that-is-disabled-under-byok-only-execution'
      ]();
    },
    phase: 'resolution',
    severity: 'warning',
    actionKind: 'check_quota',
    remediation: 'Configure an eligible BYOK provider and model for this task.',
  },
  profile_model_matched: {
    get label() {
      return I18n['com.affine.ui.profile-model-matched']();
    },
    get description() {
      return I18n[
        'com.affine.ui.a-configured-provider-profile-model-matched-the-request'
      ]();
    },
    phase: 'resolution',
    severity: 'info',
    actionKind: 'none',
  },
  profile_model_not_allowed: {
    get label() {
      return I18n['com.affine.ui.profile-model-not-allowed']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-requested-model-is-outside-the-provider-profile-allowlist'
      ]();
    },
    phase: 'resolution',
    severity: 'warning',
    actionKind: 'check_model_profile',
    remediation:
      'Add the requested model or alias to the provider profile allowlist, or update the task model request.',
  },
  no_profile_model_match: {
    get label() {
      return I18n['com.affine.ui.no-profile-model-match']();
    },
    get description() {
      return I18n[
        'com.affine.ui.no-configured-profile-model-matched-the-requested-capability'
      ]();
    },
    phase: 'resolution',
    severity: 'warning',
    actionKind: 'check_model_profile',
    remediation:
      'Add a provider profile model with the requested capability or change the task default model.',
  },
  capability_matched: {
    get label() {
      return I18n['com.affine.ui.capability-matched']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-model-satisfies-the-requested-capability'
      ]();
    },
    phase: 'resolution',
    severity: 'info',
    actionKind: 'none',
  },
  capability_mismatch: {
    get label() {
      return I18n['com.affine.ui.capability-mismatch']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-model-does-not-satisfy-the-requested-capability'
      ]();
    },
    phase: 'resolution',
    severity: 'warning',
    actionKind: 'check_model_capability',
    remediation:
      'Update model capability metadata or choose a model that supports the requested input, output, and attachment requirements.',
  },
  capability_match_error: {
    get label() {
      return I18n['com.affine.ui.capability-match-error']();
    },
    get description() {
      return I18n[
        'com.affine.ui.capability-matching-failed-before-route-preparation'
      ]();
    },
    phase: 'resolution',
    severity: 'error',
    actionKind: 'check_provider_runtime',
    remediation:
      'Inspect provider model metadata and runtime logs for capability matching errors.',
  },
  provider_runtime_unavailable: {
    get label() {
      return I18n['com.affine.ui.provider-runtime-unavailable']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-runtime-is-unavailable-for-this-candidate'
      ]();
    },
    phase: 'resolution',
    severity: 'error',
    actionKind: 'check_provider_runtime',
    remediation:
      'Check that the provider runtime adapter is registered and supports this provider type.',
  },
  capability_not_declared: {
    get label() {
      return I18n['com.affine.ui.capability-not-declared']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-model-has-no-declared-capability-metadata'
      ]();
    },
    phase: 'resolution',
    severity: 'warning',
    actionKind: 'check_model_capability',
    remediation:
      'Declare capability metadata for this model in the model registry or provider profile.',
  },
  output_not_supported: {
    get label() {
      return I18n['com.affine.ui.output-not-supported']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-model-does-not-support-the-requested-output-type'
      ]();
    },
    phase: 'resolution',
    severity: 'warning',
    actionKind: 'check_model_capability',
    remediation:
      'Use a model that supports the requested output type or update the model capability declaration.',
  },
  input_not_supported: {
    get label() {
      return I18n['com.affine.ui.input-not-supported']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-model-does-not-support-the-requested-input-type'
      ]();
    },
    phase: 'resolution',
    severity: 'warning',
    actionKind: 'check_model_capability',
    remediation:
      'Use a model that supports the requested input type or update the model capability declaration.',
  },
  attachment_not_supported: {
    get label() {
      return I18n['com.affine.ui.attachment-not-supported']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-model-does-not-support-attachments-for-this-route'
      ]();
    },
    phase: 'resolution',
    severity: 'warning',
    actionKind: 'check_model_capability',
    remediation:
      'Use a model with attachment support or disable attachment-dependent routing for this task.',
  },
  attachment_kind_not_supported: {
    get label() {
      return I18n['com.affine.ui.attachment-kind-not-supported']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-model-does-not-support-the-requested-attachment-kind'
      ]();
    },
    phase: 'resolution',
    severity: 'warning',
    actionKind: 'check_model_capability',
    remediation:
      'Use a model that supports this attachment kind or adjust the task attachment requirements.',
  },
  attachment_source_not_supported: {
    get label() {
      return I18n['com.affine.ui.attachment-source-not-supported']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-model-does-not-support-the-requested-attachment-source'
      ]();
    },
    phase: 'resolution',
    severity: 'warning',
    actionKind: 'check_model_capability',
    remediation:
      'Use a model that supports this attachment source or normalize the attachment before routing.',
  },
  remote_attachment_not_supported: {
    get label() {
      return I18n['com.affine.ui.remote-attachment-not-supported']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-model-does-not-allow-remote-attachment-urls'
      ]();
    },
    phase: 'resolution',
    severity: 'warning',
    actionKind: 'check_model_capability',
    remediation:
      'Use a provider that accepts remote attachments or proxy/download attachments before dispatch.',
  },
  prepared_route_available: {
    get label() {
      return I18n['com.affine.ui.prepared-route-available']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-matched-candidate-produced-a-prepared-native-route'
      ]();
    },
    phase: 'prepared',
    severity: 'info',
    actionKind: 'none',
  },
  prepared_model_resolved: {
    get label() {
      return I18n['com.affine.ui.prepared-model-resolved']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-prepared-native-route-resolved-a-model-alias-or-raw-model'
      ]();
    },
    phase: 'prepared',
    severity: 'info',
    actionKind: 'none',
  },
  prepared_route_not_selected: {
    get label() {
      return I18n['com.affine.ui.prepared-route-not-selected']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-matched-candidate-belongs-to-a-registry-branch-not-selected'
      ]();
    },
    phase: 'prepared',
    severity: 'info',
    actionKind: 'check_registry',
    remediation:
      'Review registry branch selection if this candidate was expected to become the active prepared route.',
  },
  prepared_route_filtered: {
    get label() {
      return I18n['com.affine.ui.prepared-route-filtered']();
    },
    get description() {
      return I18n[
        'com.affine.ui.a-matched-candidate-did-not-appear-in-the-prepared-route-list'
      ]();
    },
    phase: 'prepared',
    severity: 'warning',
    actionKind: 'inspect_prepare_trace',
    remediation:
      'Inspect prepare candidates to determine whether provider prepare returned empty, failed, or was not selected.',
  },
  provider_prepare_succeeded: {
    get label() {
      return I18n['com.affine.ui.provider-prepare-succeeded']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-runtime-prepare-boundary-produced-a-route'
      ]();
    },
    phase: 'prepared',
    severity: 'info',
    actionKind: 'none',
  },
  provider_prepare_returned_empty: {
    get label() {
      return I18n['com.affine.ui.provider-prepare-returned-empty']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-runtime-prepare-boundary-returned-no-route'
      ]();
    },
    phase: 'prepared',
    severity: 'warning',
    actionKind: 'inspect_prepare_trace',
    remediation:
      'Check provider prepare support for this task and model, including request layer and model capability metadata.',
  },
  provider_prepare_error: {
    get label() {
      return I18n['com.affine.ui.provider-prepare-error']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-provider-runtime-prepare-boundary-threw-a-sanitized-error'
      ]();
    },
    phase: 'prepared',
    severity: 'error',
    actionKind: 'check_provider_runtime',
    remediation:
      'Inspect the sanitized prepare error code and provider runtime logs; credentials and raw endpoint details are intentionally not exposed here.',
  },
  provider_prepare_auth_error: {
    get label() {
      return I18n['com.affine.ui.prepare-auth-error']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-sanitized-prepare-error-category-points-to-credentials-or-authorization'
      ]();
    },
    phase: 'prepared',
    severity: 'error',
    actionKind: 'configure_provider',
    remediation:
      'Check provider credentials, BYOK lease availability, and server-side authorization settings without exposing secrets in diagnostics.',
  },
  provider_prepare_model_error: {
    get label() {
      return I18n['com.affine.ui.prepare-model-error']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-sanitized-prepare-error-category-points-to-model-or-alias-resolution'
      ]();
    },
    phase: 'prepared',
    severity: 'error',
    actionKind: 'check_model_profile',
    remediation:
      'Check provider profile model IDs, aliases, and default task model settings for this feature.',
  },
  provider_prepare_network_error: {
    get label() {
      return I18n['com.affine.ui.prepare-network-error']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-sanitized-prepare-error-category-points-to-network-endpoint-timeout-or-abort-handling'
      ]();
    },
    phase: 'prepared',
    severity: 'error',
    actionKind: 'check_provider_runtime',
    remediation:
      'Check local endpoint reachability, container networking, timeout settings, and provider runtime logs.',
  },
  provider_prepare_runtime_error: {
    get label() {
      return I18n['com.affine.ui.prepare-runtime-error']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-sanitized-prepare-error-category-points-to-an-uncategorized-provider-runtime-failure'
      ]();
    },
    phase: 'prepared',
    severity: 'error',
    actionKind: 'check_provider_runtime',
    remediation:
      'Inspect provider runtime logs for the sanitized error code; raw endpoint, headers, and response bodies are intentionally not exposed here.',
  },
  provider_prepare_schema_error: {
    get label() {
      return I18n['com.affine.ui.prepare-schema-error']();
    },
    get description() {
      return I18n[
        'com.affine.ui.the-sanitized-prepare-error-category-points-to-schema-json-validation-or-parsing'
      ]();
    },
    phase: 'prepared',
    severity: 'error',
    actionKind: 'check_model_capability',
    remediation:
      'Check structured output support, request-layer compatibility, and model capability metadata for this provider profile.',
  },
};

const TASK_ROUTE_REMEDIATION_TARGETS: Record<
  AIModelTaskRouteReasonRemediationActionKind,
  AIModelTaskRouteRemediationTarget
> = {
  check_prompt_default: {
    kind: 'prompt_registry',
    get label() {
      return I18n['com.affine.ui.prompt-registry']();
    },
    get description() {
      return I18n[
        'com.affine.ui.prompt-default-model-default-policy-category-defaults-overrides-and-prompt-catalog-metadata'
      ]();
    },
  },
  check_model_capability: {
    kind: 'model_registry',
    get label() {
      return I18n['com.affine.ui.model-registry']();
    },
    get description() {
      return I18n[
        'com.affine.ui.model-capability-metadata-embedding-dimensions-aliases-and-output-input-support'
      ]();
    },
  },
  check_model_profile: {
    kind: 'model_registry',
    get label() {
      return I18n['com.affine.ui.model-registry']();
    },
    get description() {
      return I18n[
        'com.affine.ui.provider-profile-model-ids-aliases-task-defaults-and-model-allowlists'
      ]();
    },
  },
  check_policy: {
    kind: 'route_policy',
    get label() {
      return I18n['com.affine.ui.route-policy']();
    },
    get description() {
      return I18n[
        'com.affine.ui.allowed-providers-blocked-providers-workspace-policy-and-feature-policy'
      ]();
    },
  },
  check_privacy_policy: {
    kind: 'route_policy',
    get label() {
      return I18n['com.affine.ui.route-policy']();
    },
    get description() {
      return I18n[
        'com.affine.ui.allowed-privacy-classes-preferred-privacy-classes-and-local-cloud-routing-policy'
      ]();
    },
  },
  check_provider_runtime: {
    kind: 'provider_runtime_logs',
    get label() {
      return I18n['com.affine.ui.provider-runtime-logs']();
    },
    get description() {
      return I18n[
        'com.affine.ui.runtime-adapter-registration-container-networking-native-prepare-and-provider-logs'
      ]();
    },
  },
  check_quota: {
    kind: 'quota',
    get label() {
      return I18n['com.affine.ui.legacy-quota-diagnostics']();
    },
    get description() {
      return I18n[
        'com.affine.ui.compatibility-quota-evidence-runtime-provider-execution-is-byok-only-and-does-not-enforce-platform-q'
      ]();
    },
  },
  check_registry: {
    kind: 'provider_registry',
    get label() {
      return I18n['com.affine.ui.provider-registry']();
    },
    get description() {
      return I18n[
        'com.affine.ui.byok-route-selection-provider-priority-model-binding-and-disabled-legacy-platform-branches'
      ]();
    },
  },
  configure_provider: {
    kind: 'provider_profiles',
    get label() {
      return I18n['com.affine.ui.provider-profiles']();
    },
    get description() {
      return I18n[
        'com.affine.ui.provider-enablement-credentials-endpoint-health-privacy-and-profile-configuration'
      ]();
    },
  },
  inspect_prepare_trace: {
    kind: 'prepare_trace',
    get label() {
      return I18n['com.affine.ui.prepare-trace']();
    },
    get description() {
      return I18n[
        'com.affine.ui.matched-route-candidates-prepare-candidates-sanitized-prepare-errors-and-prepared-native-routes'
      ]();
    },
  },
};

const TASK_ROUTE_REASON_SEVERITY_RANK: Record<
  AIModelTaskRouteReasonSeverity,
  number
> = {
  error: 0,
  warning: 1,
  info: 2,
};

const TASK_ROUTE_REASON_PHASE_RANK: Record<
  AIModelTaskRouteReasonPhase,
  number
> = {
  prompt: 0,
  policy: 1,
  resolution: 2,
  prepared: 3,
  unknown: 4,
};

const TASK_ROUTE_READINESS_STATUS_RANK: Record<
  AIModelTaskRouteReadinessStatus,
  number
> = {
  blocked: 0,
  unconfigured: 1,
  warning: 2,
  ready: 3,
};

function formatCompactTokenCount(value: number | null | undefined) {
  if (!value || value <= 0) {
    return null;
  }

  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }

  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`;
  }

  return String(value);
}

type CopilotModels = NonNullable<
  NonNullable<
    QueryResponse<typeof getPromptModelsQuery>['currentUser']
  >['copilot']
>['models'];

export function buildGetPromptModelsVariables(
  promptName: string,
  workspaceId?: string
) {
  return { promptName, workspaceId };
}

export function getAIModelPromptFetchKey(
  promptName: string,
  workspaceId?: string
) {
  return JSON.stringify([workspaceId ?? null, promptName]);
}

export function getAIModelTaskRouteReasonMetadata(
  code: string
): AIModelTaskRouteReasonMetadata {
  const metadata = TASK_ROUTE_REASON_METADATA[code];
  return {
    code,
    ...(metadata ?? {
      label: code,
      get description() {
        return I18n['com.affine.ui.unrecognized-route-diagnostic-reason']();
      },
      phase: 'unknown' as const,
      severity: 'info' as const,
    }),
  };
}

export function getAIModelTaskRouteReasonMetadataList(
  reasons: string[]
): AIModelTaskRouteReasonMetadata[] {
  return Array.from(new Set(reasons)).map(getAIModelTaskRouteReasonMetadata);
}

function formatAIModelTaskRouteReasonLabels(
  reasons: string[] | null | undefined
) {
  return (reasons ?? [])
    .map(reason => getAIModelTaskRouteReasonMetadata(reason).label)
    .join(', ');
}

export function getAIModelTaskRouteRemediationTarget(
  actionKind: AIModelTaskRouteReasonRemediationActionKind
): AIModelTaskRouteRemediationTarget {
  return TASK_ROUTE_REMEDIATION_TARGETS[actionKind];
}

export function getAIModelTaskRouteRemediationTargets(
  actionKinds: AIModelTaskRouteReasonRemediationActionKind[]
): AIModelTaskRouteRemediationTarget[] {
  const targetsByKind = new Map<
    AIModelTaskRouteRemediationTargetKind,
    AIModelTaskRouteRemediationTarget
  >();
  for (const actionKind of actionKinds) {
    const target = getAIModelTaskRouteRemediationTarget(actionKind);
    targetsByKind.set(target.kind, target);
  }
  return Array.from(targetsByKind.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}

function compareTaskRouteReasonMetadata(
  a: Pick<AIModelTaskRouteReasonMetadata, 'code' | 'phase' | 'severity'>,
  b: Pick<AIModelTaskRouteReasonMetadata, 'code' | 'phase' | 'severity'>
) {
  const severityDiff =
    TASK_ROUTE_REASON_SEVERITY_RANK[a.severity] -
    TASK_ROUTE_REASON_SEVERITY_RANK[b.severity];
  if (severityDiff !== 0) {
    return severityDiff;
  }

  const phaseDiff =
    TASK_ROUTE_REASON_PHASE_RANK[a.phase] -
    TASK_ROUTE_REASON_PHASE_RANK[b.phase];
  if (phaseDiff !== 0) {
    return phaseDiff;
  }

  return a.code.localeCompare(b.code);
}

function collectAIModelTaskRouteReasonEntries(
  route: AIModelTaskRoute | null | undefined
) {
  if (!route) {
    return [];
  }

  return [
    ...(route.routeTrace ?? []).flatMap(phase =>
      phase.reasons.map(code => ({ code, source: 'route_trace' as const }))
    ),
    ...(route.policyCandidates ?? []).flatMap(candidate =>
      candidate.reasons.map(code => ({
        code,
        source: 'policy_candidate' as const,
      }))
    ),
    ...(route.routeCandidates ?? []).flatMap(candidate =>
      candidate.reasons.map(code => ({
        code,
        source: 'route_candidate' as const,
      }))
    ),
    ...(route.prepareCandidates ?? []).flatMap(candidate =>
      candidate.reasons.map(code => ({
        code,
        source: 'prepare_candidate' as const,
      }))
    ),
  ];
}

function buildAIModelTaskRouteReasonSummary(
  entries: { code: string; source: AIModelTaskRouteReasonSource }[]
): AIModelTaskRouteReasonSummary {
  const reasonsByCode = new Map<string, AIModelTaskRouteReasonSummaryItem>();
  for (const { code, source } of entries) {
    const existing = reasonsByCode.get(code);
    if (existing) {
      existing.count += 1;
      existing.sources = Array.from(new Set([...existing.sources, source]));
      continue;
    }

    reasonsByCode.set(code, {
      ...getAIModelTaskRouteReasonMetadata(code),
      count: 1,
      sources: [source],
    });
  }

  const reasons = Array.from(reasonsByCode.values()).sort(
    compareTaskRouteReasonMetadata
  );
  const highestSeverity = reasons[0]?.severity ?? 'info';
  const bySeverity = (['error', 'warning', 'info'] as const).flatMap(
    severity => {
      const severityReasons = reasons.filter(
        reason => reason.severity === severity
      );
      return severityReasons.length
        ? [
            {
              severity,
              reasons: severityReasons,
              count: severityReasons.reduce(
                (total, reason) => total + reason.count,
                0
              ),
            },
          ]
        : [];
    }
  );
  const actionGroups = new Map<
    AIModelTaskRouteReasonRemediationActionKind,
    AIModelTaskRouteReasonSummaryItem[]
  >();
  for (const reason of reasons) {
    if (!reason.actionKind || reason.actionKind === 'none') {
      continue;
    }

    const actionKind =
      reason.actionKind as AIModelTaskRouteReasonRemediationActionKind;
    actionGroups.set(actionKind, [
      ...(actionGroups.get(actionKind) ?? []),
      reason,
    ]);
  }
  const byActionKind = Array.from(actionGroups.entries())
    .map(([actionKind, actionReasons]) => ({
      actionKind,
      reasons: actionReasons,
      count: actionReasons.reduce((total, reason) => total + reason.count, 0),
    }))
    .sort((a, b) => {
      const severityDiff =
        TASK_ROUTE_REASON_SEVERITY_RANK[a.reasons[0]?.severity ?? 'info'] -
        TASK_ROUTE_REASON_SEVERITY_RANK[b.reasons[0]?.severity ?? 'info'];
      if (severityDiff !== 0) {
        return severityDiff;
      }

      return a.actionKind.localeCompare(b.actionKind);
    });

  return {
    byActionKind,
    bySeverity,
    highestSeverity,
    reasons,
  };
}

export function getAIModelTaskRouteReasonSummary(
  route: AIModelTaskRoute | null | undefined
): AIModelTaskRouteReasonSummary {
  return buildAIModelTaskRouteReasonSummary(
    collectAIModelTaskRouteReasonEntries(route)
  );
}

export function getAIModelPromptDefaultDiagnostics(
  model: AIModelPromptDefaultDiagnosticsInput | null | undefined
): AIModelPromptDefaultDiagnosticsSummary {
  const reasonSummary = buildAIModelTaskRouteReasonSummary(
    model?.defaultModelFallbackReason
      ? [
          {
            code: model.defaultModelFallbackReason,
            source: 'prompt_default' as const,
          },
        ]
      : []
  );

  return {
    actionKinds: reasonSummary.byActionKind.map(group => group.actionKind),
    activeDefaultModel:
      model?.defaultModel ?? (model?.isDefault ? model.id : null),
    defaultModelSource: model?.defaultModelSource ?? null,
    promptDefaultModel: model?.promptDefaultModel ?? null,
    reasonSummary,
  };
}

function taskRouteReadinessStatus(
  route: AIModelTaskRoute | null | undefined,
  reasonSummary: AIModelTaskRouteReasonSummary
): AIModelTaskRouteReadinessStatus {
  if (!route) {
    return 'unconfigured';
  }

  if (
    !route.configured ||
    !!route.errorCode ||
    route.preparedProviderCount <= 0
  ) {
    return 'blocked';
  }

  if (route.dimensionMismatch || reasonSummary.highestSeverity !== 'info') {
    return 'warning';
  }

  return 'ready';
}

function taskRouteReadinessSeverity(
  status: AIModelTaskRouteReadinessStatus
): AIModelTaskRouteReasonSeverity {
  if (status === 'blocked') {
    return 'error';
  }

  if (status === 'warning' || status === 'unconfigured') {
    return 'warning';
  }

  return 'info';
}

export function getAIModelTaskRouteReadiness(
  route: AIModelTaskRoute | null | undefined,
  fallbackFeatureKind = 'unknown'
): AIModelTaskRouteReadinessSummary {
  const reasonSummary = getAIModelTaskRouteReasonSummary(route);
  const status = taskRouteReadinessStatus(route, reasonSummary);

  return {
    actionKinds: reasonSummary.byActionKind.map(group => group.actionKind),
    configured: route?.configured ?? false,
    ...(route?.dimensionMismatch !== undefined
      ? { dimensionMismatch: route.dimensionMismatch }
      : {}),
    ...(route?.errorCode ? { errorCode: route.errorCode } : {}),
    ...(route?.errorMessage ? { errorMessage: route.errorMessage } : {}),
    featureKind: route?.featureKind ?? fallbackFeatureKind,
    ...(route?.modelId ? { modelId: route.modelId } : {}),
    preparedProviderCount: route?.preparedProviderCount ?? 0,
    ...(route?.providerId ? { providerId: route.providerId } : {}),
    reasonSummary,
    ...(route?.requestedModelConfigKey
      ? { requestedModelConfigKey: route.requestedModelConfigKey }
      : {}),
    ...(route?.requestedModelConfigPath
      ? { requestedModelConfigPath: route.requestedModelConfigPath }
      : {}),
    ...(route?.requestedModelId
      ? { requestedModelId: route.requestedModelId }
      : {}),
    ...(route?.requestedModelSource
      ? { requestedModelSource: route.requestedModelSource }
      : {}),
    severity: taskRouteReadinessSeverity(status),
    status,
  };
}

export function getAIModelTaskRoutePhaseTrace(
  route: AIModelTaskRoute | null | undefined
): AIModelTaskRoutePhaseTraceSummary {
  if (!route) {
    return {
      actionKinds: [],
      highestSeverity: 'info',
      phases: [],
    };
  }

  const phases = (route.routeTrace ?? []).map(phase => {
    const reasonSummary = buildAIModelTaskRouteReasonSummary(
      phase.reasons.map(code => ({
        code,
        source: 'route_trace' as const,
      }))
    );

    return {
      actionKinds: reasonSummary.byActionKind.map(group => group.actionKind),
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
      reasonSummary,
      ...(phase.selectedCount !== undefined
        ? { selectedCount: phase.selectedCount }
        : {}),
      severity: reasonSummary.highestSeverity,
    };
  });

  return {
    actionKinds: Array.from(
      new Set(phases.flatMap(phase => phase.actionKinds))
    ),
    highestSeverity:
      phases
        .map(phase => phase.severity)
        .sort(
          (a, b) =>
            TASK_ROUTE_REASON_SEVERITY_RANK[a] -
            TASK_ROUTE_REASON_SEVERITY_RANK[b]
        )[0] ?? 'info',
    phases,
  };
}

function taskRouteCandidateTraceKey(
  candidate: Pick<
    AIModelTaskRouteCandidate | AIModelTaskRoutePrepareCandidate,
    | 'candidateKey'
    | 'candidateModelIds'
    | 'modelId'
    | 'providerId'
    | 'registryKind'
    | 'requestedModelId'
  >
) {
  if (candidate.candidateKey) {
    return candidate.candidateKey;
  }

  return JSON.stringify([
    candidate.registryKind ?? 'unknown_registry',
    candidate.providerId,
    candidate.requestedModelId ?? '',
    candidate.modelId ?? '',
    Array.from(
      new Set([
        ...(candidate.modelId ? [candidate.modelId] : []),
        ...(candidate.requestedModelId ? [candidate.requestedModelId] : []),
        ...(candidate.candidateModelIds ?? []),
      ])
    ).sort(),
  ]);
}

function taskRouteCandidateTraceStatus(
  routeCandidate: AIModelTaskRouteCandidate | undefined,
  prepareCandidate: AIModelTaskRoutePrepareCandidate | undefined
): AIModelTaskRouteCandidateTraceStatus {
  if (!routeCandidate) {
    return 'prepare_only';
  }

  if (!routeCandidate.matched) {
    return 'unmatched';
  }

  if (!prepareCandidate) {
    return 'matched';
  }

  return prepareCandidate.prepared ? 'prepared' : 'filtered';
}

function taskRouteModelRegistryMetadata(
  routeCandidate: AIModelTaskRouteCandidate | undefined,
  prepareCandidate: AIModelTaskRoutePrepareCandidate | undefined
) {
  const candidate = routeCandidate ?? prepareCandidate;
  return {
    modelRegistryRevision: candidate?.modelRegistryRevision ?? null,
    modelRegistryRevisionActorId:
      candidate?.modelRegistryRevisionActorId ?? null,
    modelRegistryRevisionFingerprint:
      candidate?.modelRegistryRevisionFingerprint ?? null,
    modelRegistryRevisionId: candidate?.modelRegistryRevisionId ?? null,
    modelRegistryRevisionScope: candidate?.modelRegistryRevisionScope ?? null,
    modelRegistryRevisionSourceChain:
      candidate?.modelRegistryRevisionSourceChain ?? null,
    modelRegistryRevisionSourceChainFingerprint:
      candidate?.modelRegistryRevisionSourceChainFingerprint ?? null,
    modelRegistryRevisionStatus: candidate?.modelRegistryRevisionStatus ?? null,
    modelRegistryRevisionWorkspaceId:
      candidate?.modelRegistryRevisionWorkspaceId ?? null,
    modelRegistryRevisionPublishEventCount:
      candidate?.modelRegistryRevisionPublishEventCount ?? null,
    modelRegistryRevisionPublishEvents:
      candidate?.modelRegistryRevisionPublishEvents ?? null,
  };
}

export function getAIModelTaskRouteCandidateTrace(
  route: AIModelTaskRoute | null | undefined
): AIModelTaskRouteCandidateTraceSummary {
  if (!route) {
    return {
      actionKinds: [],
      highestSeverity: 'info',
      rows: [],
    };
  }

  const rowsByKey = new Map<
    string,
    {
      prepareCandidate?: AIModelTaskRoutePrepareCandidate;
      routeCandidate?: AIModelTaskRouteCandidate;
    }
  >();
  const orderedKeys: string[] = [];
  const addKey = (key: string) => {
    let row = rowsByKey.get(key);
    if (!row) {
      row = {};
      rowsByKey.set(key, row);
      orderedKeys.push(key);
    }
    return row;
  };

  for (const candidate of route.routeCandidates ?? []) {
    addKey(taskRouteCandidateTraceKey(candidate)).routeCandidate = candidate;
  }
  for (const candidate of route.prepareCandidates ?? []) {
    addKey(taskRouteCandidateTraceKey(candidate)).prepareCandidate = candidate;
  }

  const rows = orderedKeys.map(key => {
    const { prepareCandidate, routeCandidate } = rowsByKey.get(key) ?? {};
    const reasonSummary = buildAIModelTaskRouteReasonSummary([
      ...(routeCandidate?.reasons ?? []).map(code => ({
        code,
        source: 'route_candidate' as const,
      })),
      ...(prepareCandidate?.reasons ?? []).map(code => ({
        code,
        source: 'prepare_candidate' as const,
      })),
    ]);
    const status = taskRouteCandidateTraceStatus(
      routeCandidate,
      prepareCandidate
    );

    return {
      actionKinds: reasonSummary.byActionKind.map(group => group.actionKind),
      candidateKey:
        routeCandidate?.candidateKey ?? prepareCandidate?.candidateKey ?? null,
      candidateModelIds:
        routeCandidate?.candidateModelIds ??
        prepareCandidate?.candidateModelIds ??
        null,
      ...(prepareCandidate?.errorCode
        ? { errorCode: prepareCandidate.errorCode }
        : {}),
      ...(prepareCandidate?.errorCategory
        ? { errorCategory: prepareCandidate.errorCategory }
        : {}),
      matched: routeCandidate?.matched ?? null,
      modelId: routeCandidate?.modelId ?? prepareCandidate?.modelId ?? null,
      ...taskRouteModelRegistryMetadata(routeCandidate, prepareCandidate),
      prepared: prepareCandidate?.prepared ?? null,
      preparedModelId: prepareCandidate?.preparedModelId ?? null,
      providerId:
        routeCandidate?.providerId ?? prepareCandidate?.providerId ?? '',
      providerConfiguredModelCount:
        routeCandidate?.providerConfiguredModelCount ??
        prepareCandidate?.providerConfiguredModelCount ??
        null,
      providerConfiguredModelIds:
        routeCandidate?.providerConfiguredModelIds ??
        prepareCandidate?.providerConfiguredModelIds ??
        null,
      providerName:
        routeCandidate?.providerName ?? prepareCandidate?.providerName ?? null,
      providerProfileConfigPath:
        routeCandidate?.providerProfileConfigPath ??
        prepareCandidate?.providerProfileConfigPath ??
        null,
      providerProfileId:
        routeCandidate?.providerProfileId ??
        prepareCandidate?.providerProfileId ??
        null,
      providerProfileSource:
        routeCandidate?.providerProfileSource ??
        prepareCandidate?.providerProfileSource ??
        null,
      providerSource:
        routeCandidate?.providerSource ??
        prepareCandidate?.providerSource ??
        null,
      providerType:
        routeCandidate?.providerType ?? prepareCandidate?.providerType ?? null,
      providerPriority:
        routeCandidate?.providerPriority ??
        prepareCandidate?.providerPriority ??
        null,
      privacy: routeCandidate?.privacy ?? prepareCandidate?.privacy ?? null,
      health: routeCandidate?.health ?? prepareCandidate?.health ?? null,
      healthCheckedAt:
        routeCandidate?.healthCheckedAt ??
        prepareCandidate?.healthCheckedAt ??
        null,
      reasonSummary,
      registryAvailable:
        routeCandidate?.registryAvailable ??
        prepareCandidate?.registryAvailable ??
        null,
      registryKind:
        routeCandidate?.registryKind ?? prepareCandidate?.registryKind ?? null,
      registrySelected:
        routeCandidate?.registrySelected ??
        prepareCandidate?.registrySelected ??
        null,
      requestedModelId:
        routeCandidate?.requestedModelId ??
        prepareCandidate?.requestedModelId ??
        null,
      routeAttachmentAllowRemoteUrls:
        routeCandidate?.routeAttachmentAllowRemoteUrls ??
        prepareCandidate?.routeAttachmentAllowRemoteUrls ??
        null,
      routeAttachmentKinds:
        routeCandidate?.routeAttachmentKinds ??
        prepareCandidate?.routeAttachmentKinds ??
        null,
      routeAttachmentSourceKinds:
        routeCandidate?.routeAttachmentSourceKinds ??
        prepareCandidate?.routeAttachmentSourceKinds ??
        null,
      routeContextWindow:
        routeCandidate?.routeContextWindow ??
        prepareCandidate?.routeContextWindow ??
        null,
      routeEmbeddingDimensions:
        routeCandidate?.routeEmbeddingDimensions ??
        prepareCandidate?.routeEmbeddingDimensions ??
        null,
      routeInputTypes:
        routeCandidate?.routeInputTypes ??
        prepareCandidate?.routeInputTypes ??
        null,
      routeMaxOutputTokens:
        routeCandidate?.routeMaxOutputTokens ??
        prepareCandidate?.routeMaxOutputTokens ??
        null,
      routeModelAliasMatched:
        routeCandidate?.routeModelAliasMatched ??
        prepareCandidate?.routeModelAliasMatched ??
        null,
      routeModelDefinitionAliases:
        routeCandidate?.routeModelDefinitionAliases ??
        prepareCandidate?.routeModelDefinitionAliases ??
        null,
      routeModelDefinitionId:
        routeCandidate?.routeModelDefinitionId ??
        prepareCandidate?.routeModelDefinitionId ??
        null,
      routeModelDefinitionSource:
        routeCandidate?.routeModelDefinitionSource ??
        prepareCandidate?.routeModelDefinitionSource ??
        null,
      routeOutputTypes:
        routeCandidate?.routeOutputTypes ??
        prepareCandidate?.routeOutputTypes ??
        null,
      routeStructuredAttachmentAllowRemoteUrls:
        routeCandidate?.routeStructuredAttachmentAllowRemoteUrls ??
        prepareCandidate?.routeStructuredAttachmentAllowRemoteUrls ??
        null,
      routeStructuredAttachmentKinds:
        routeCandidate?.routeStructuredAttachmentKinds ??
        prepareCandidate?.routeStructuredAttachmentKinds ??
        null,
      routeStructuredAttachmentSourceKinds:
        routeCandidate?.routeStructuredAttachmentSourceKinds ??
        prepareCandidate?.routeStructuredAttachmentSourceKinds ??
        null,
      routeRawModelId:
        routeCandidate?.routeRawModelId ??
        prepareCandidate?.routeRawModelId ??
        null,
      severity: reasonSummary.highestSeverity,
      status,
    };
  });

  return {
    actionKinds: Array.from(new Set(rows.flatMap(row => row.actionKinds))),
    highestSeverity:
      rows
        .map(row => row.severity)
        .sort(
          (a, b) =>
            TASK_ROUTE_REASON_SEVERITY_RANK[a] -
            TASK_ROUTE_REASON_SEVERITY_RANK[b]
        )[0] ?? 'info',
    rows,
  };
}

function taskRoutePolicyCandidateTraceStatus(
  candidate: AIModelTaskRoutePolicyCandidate
): AIModelTaskRoutePolicyCandidateTraceStatus {
  if (!candidate.available) {
    return 'unavailable';
  }

  return candidate.allowed ? 'allowed' : 'blocked';
}

export function getAIModelTaskRoutePolicyCandidateTrace(
  route: AIModelTaskRoute | null | undefined
): AIModelTaskRoutePolicyCandidateTraceSummary {
  if (!route) {
    return {
      actionKinds: [],
      highestSeverity: 'info',
      rows: [],
    };
  }

  const rows = (route.policyCandidates ?? []).map(candidate => {
    const reasonSummary = buildAIModelTaskRouteReasonSummary(
      candidate.reasons.map(code => ({
        code,
        source: 'policy_candidate' as const,
      }))
    );

    return {
      actionKinds: reasonSummary.byActionKind.map(group => group.actionKind),
      allowed: candidate.allowed,
      available: candidate.available,
      candidateFingerprint: candidate.candidateFingerprint ?? null,
      candidateKey: candidate.candidateKey ?? null,
      health: candidate.health,
      healthCheckedAt: candidate.healthCheckedAt ?? null,
      privacy: candidate.privacy,
      providerId: candidate.providerId,
      providerConfiguredModelCount: candidate.providerConfiguredModelCount,
      providerConfiguredModelIds: candidate.providerConfiguredModelIds ?? null,
      providerName: candidate.providerName ?? null,
      providerProfileConfigPath: candidate.providerProfileConfigPath ?? null,
      providerProfileId: candidate.providerProfileId ?? null,
      providerProfileSource: candidate.providerProfileSource ?? null,
      providerSource: candidate.providerSource ?? null,
      providerPriority: candidate.providerPriority ?? null,
      providerType: candidate.providerType,
      registryAvailable: candidate.registryAvailable ?? null,
      registryKind: candidate.registryKind ?? null,
      registrySelected: candidate.registrySelected ?? null,
      reasonSummary,
      severity: reasonSummary.highestSeverity,
      status: taskRoutePolicyCandidateTraceStatus(candidate),
    };
  });

  return {
    actionKinds: Array.from(new Set(rows.flatMap(row => row.actionKinds))),
    highestSeverity:
      rows
        .map(row => row.severity)
        .sort(
          (a, b) =>
            TASK_ROUTE_REASON_SEVERITY_RANK[a] -
            TASK_ROUTE_REASON_SEVERITY_RANK[b]
        )[0] ?? 'info',
    rows,
  };
}

export function getAIModelTaskRoutePolicySummary(
  route: AIModelTaskRoute | null | undefined,
  fallbackFeatureKind = 'unknown'
): AIModelTaskRoutePolicySummary {
  const label = route ? formatTaskRoutePolicyLabel(route) : null;

  return {
    allowedPrivacy: route?.policyAllowedPrivacy ?? [],
    allowedProviderIds: route?.policyAllowedProviderIds ?? [],
    blockedProviderIds: route?.policyBlockedProviderIds ?? [],
    enabled: route?.policyEnabled ?? null,
    featureKind:
      route?.policyFeatureKind ?? route?.featureKind ?? fallbackFeatureKind,
    label,
    preferredPrivacy: route?.policyPreferredPrivacy ?? [],
    workspaceId: route?.policyWorkspaceId ?? null,
  };
}

export function getAIModelTaskRouteDiagnostics(
  route: AIModelTaskRoute | null | undefined,
  fallbackFeatureKind = 'unknown'
): AIModelTaskRouteDiagnosticsSummary {
  const readiness = getAIModelTaskRouteReadiness(route, fallbackFeatureKind);
  const reasonSummary = readiness.reasonSummary;
  const phaseTrace = getAIModelTaskRoutePhaseTrace(route);
  const candidateTrace = getAIModelTaskRouteCandidateTrace(route);
  const policy = getAIModelTaskRoutePolicySummary(route, fallbackFeatureKind);
  const policyCandidateTrace = getAIModelTaskRoutePolicyCandidateTrace(route);

  return {
    actionKinds: Array.from(
      new Set([
        ...readiness.actionKinds,
        ...phaseTrace.actionKinds,
        ...candidateTrace.actionKinds,
        ...policyCandidateTrace.actionKinds,
      ])
    ),
    candidateTrace,
    phaseTrace,
    policy,
    policyCandidateTrace,
    readiness,
    reasonSummary,
  };
}

export function getAIModelTaskRoutesReadiness(
  model: Pick<AIModel, 'embeddingRoute' | 'rerankRoute'>
): AIModelTaskRoutesReadinessSummary {
  const routes = [
    getAIModelTaskRouteReadiness(model.embeddingRoute, 'workspace_indexing'),
    getAIModelTaskRouteReadiness(model.rerankRoute, 'rerank'),
  ];
  const status = routes
    .map(route => route.status)
    .sort(
      (a, b) =>
        TASK_ROUTE_READINESS_STATUS_RANK[a] -
        TASK_ROUTE_READINESS_STATUS_RANK[b]
    )[0];
  const highestSeverity = routes
    .map(route => route.severity)
    .sort(
      (a, b) =>
        TASK_ROUTE_REASON_SEVERITY_RANK[a] - TASK_ROUTE_REASON_SEVERITY_RANK[b]
    )[0];

  return {
    actionKinds: Array.from(
      new Set(routes.flatMap(route => route.actionKinds))
    ),
    highestSeverity,
    routes,
    status,
  };
}

export function getAIModelTaskRoutesDiagnostics(
  model: Pick<AIModel, 'embeddingRoute' | 'rerankRoute'>
): AIModelTaskRoutesDiagnosticsSummary {
  const routes = [
    getAIModelTaskRouteDiagnostics(model.embeddingRoute, 'workspace_indexing'),
    getAIModelTaskRouteDiagnostics(model.rerankRoute, 'rerank'),
  ];
  const status = routes
    .map(route => route.readiness.status)
    .sort(
      (a, b) =>
        TASK_ROUTE_READINESS_STATUS_RANK[a] -
        TASK_ROUTE_READINESS_STATUS_RANK[b]
    )[0];
  const highestSeverity = routes
    .map(route => route.readiness.severity)
    .sort(
      (a, b) =>
        TASK_ROUTE_REASON_SEVERITY_RANK[a] - TASK_ROUTE_REASON_SEVERITY_RANK[b]
    )[0];

  return {
    actionKinds: Array.from(
      new Set(routes.flatMap(route => route.actionKinds))
    ),
    highestSeverity,
    routes,
    status,
  };
}

function formatProviderMetadataLabel(
  value: string | null | undefined,
  labels: Record<string, string>
) {
  if (!value) {
    return null;
  }
  return labels[value] ?? value;
}

function metadataSortRank(
  value: string | null | undefined,
  order: Record<string, number>
) {
  return value
    ? (order[value] ?? Number.MAX_SAFE_INTEGER)
    : Number.MAX_SAFE_INTEGER;
}

export function sortAIModelsForSelection(models: AIModel[]): AIModel[] {
  return models
    .map((model, index) => ({ model, index }))
    .sort((a, b) => {
      if (a.model.isDefault !== b.model.isDefault) {
        return a.model.isDefault ? -1 : 1;
      }

      const healthDiff =
        metadataSortRank(a.model.providerHealth, PROVIDER_HEALTH_SORT_ORDER) -
        metadataSortRank(b.model.providerHealth, PROVIDER_HEALTH_SORT_ORDER);
      if (healthDiff !== 0) {
        return healthDiff;
      }

      const privacyDiff =
        metadataSortRank(a.model.providerPrivacy, PROVIDER_PRIVACY_SORT_ORDER) -
        metadataSortRank(b.model.providerPrivacy, PROVIDER_PRIVACY_SORT_ORDER);
      if (privacyDiff !== 0) {
        return privacyDiff;
      }

      const contextWindowDiff =
        (b.model.contextWindow ?? 0) - (a.model.contextWindow ?? 0);
      if (contextWindowDiff !== 0) {
        return contextWindowDiff;
      }

      const maxOutputTokensDiff =
        (b.model.maxOutputTokens ?? 0) - (a.model.maxOutputTokens ?? 0);
      if (maxOutputTokensDiff !== 0) {
        return maxOutputTokensDiff;
      }

      return a.index - b.index;
    })
    .map(({ model }) => model);
}

export function buildAIModels(models: CopilotModels): AIModel[] {
  const { defaultModel, optionalModels, proModels } = models;
  return sortAIModelsForSelection(
    optionalModels.map(model => {
      const [category] = model.name.split(' ');
      const version = model.name.slice(category.length + 1);
      return {
        name: model.name,
        id: model.id,
        version,
        category,
        defaultModelFallbackReason: models.defaultModelFallbackReason,
        defaultModelSource: models.defaultModelSource,
        promptName: model.promptName,
        promptAction: model.promptAction,
        promptSource: model.promptSource,
        promptCategory: model.promptCategory,
        promptDefaultModel: models.promptDefaultModel,
        promptDefaultPolicy: model.promptDefaultPolicy,
        promptModelConfigPath: model.promptModelConfigPath,
        promptModelSource: model.promptModelSource,
        promptModelSources: model.promptModelSources,
        promptOverrideApplied: model.promptOverrideApplied,
        providerId: model.providerId,
        providerName: model.providerName,
        routeModelId: model.routeModelId,
        routeFallbackProviderIds: model.routeFallbackProviderIds,
        providerType: model.providerType,
        providerSource: model.providerSource ?? null,
        ...(model.providerProfileId !== undefined
          ? { providerProfileId: model.providerProfileId }
          : {}),
        ...(model.providerProfileSource !== undefined
          ? { providerProfileSource: model.providerProfileSource }
          : {}),
        ...(model.providerProfileConfigPath !== undefined
          ? { providerProfileConfigPath: model.providerProfileConfigPath }
          : {}),
        ...(model.providerConfiguredModelIds !== undefined
          ? { providerConfiguredModelIds: model.providerConfiguredModelIds }
          : {}),
        ...(model.providerConfiguredModelCount !== undefined
          ? { providerConfiguredModelCount: model.providerConfiguredModelCount }
          : {}),
        providerPrivacy: model.providerPrivacy,
        providerHealth: model.providerHealth,
        providerHealthCheckedAt: model.providerHealthCheckedAt,
        providerHealthLastError: model.providerHealthLastError,
        providerPriority: model.providerPriority,
        registryAvailable: model.registryAvailable,
        effectiveSourceFingerprint: model.effectiveSourceFingerprint,
        effectiveSourceFingerprintInputs:
          model.effectiveSourceFingerprintInputs,
        effectiveSourceFingerprintVersion:
          model.effectiveSourceFingerprintVersion,
        registryKind: model.registryKind,
        registrySelected: model.registrySelected,
        routeBackendKind: model.routeBackendKind,
        routeCanonicalModelKey: model.routeCanonicalModelKey,
        ...(model.routeRawModelId !== undefined
          ? { routeRawModelId: model.routeRawModelId }
          : {}),
        ...(model.routeModelDefinitionSource !== undefined
          ? { routeModelDefinitionSource: model.routeModelDefinitionSource }
          : {}),
        ...(model.routeModelDefinitionId !== undefined
          ? { routeModelDefinitionId: model.routeModelDefinitionId }
          : {}),
        ...(model.routeModelDefinitionAliases !== undefined
          ? { routeModelDefinitionAliases: model.routeModelDefinitionAliases }
          : {}),
        ...(model.routeModelAliasMatched !== undefined
          ? { routeModelAliasMatched: model.routeModelAliasMatched }
          : {}),
        ...(model.modelRegistryRevision !== undefined
          ? { modelRegistryRevision: model.modelRegistryRevision }
          : {}),
        ...(model.modelRegistryRevisionActorId !== undefined
          ? { modelRegistryRevisionActorId: model.modelRegistryRevisionActorId }
          : {}),
        ...(model.modelRegistryRevisionFingerprint !== undefined
          ? {
              modelRegistryRevisionFingerprint:
                model.modelRegistryRevisionFingerprint,
            }
          : {}),
        ...(model.modelRegistryRevisionId !== undefined
          ? { modelRegistryRevisionId: model.modelRegistryRevisionId }
          : {}),
        ...(model.modelRegistryRevisionScope !== undefined
          ? { modelRegistryRevisionScope: model.modelRegistryRevisionScope }
          : {}),
        ...(model.modelRegistryRevisionSourceChain !== undefined
          ? {
              modelRegistryRevisionSourceChain:
                model.modelRegistryRevisionSourceChain,
            }
          : {}),
        ...(model.modelRegistryRevisionSourceChainFingerprint !== undefined
          ? {
              modelRegistryRevisionSourceChainFingerprint:
                model.modelRegistryRevisionSourceChainFingerprint,
            }
          : {}),
        ...(model.modelRegistryRevisionStatus !== undefined
          ? { modelRegistryRevisionStatus: model.modelRegistryRevisionStatus }
          : {}),
        ...(model.modelRegistryRevisionWorkspaceId !== undefined
          ? {
              modelRegistryRevisionWorkspaceId:
                model.modelRegistryRevisionWorkspaceId,
            }
          : {}),
        ...(model.modelRegistryRevisionPublishEventCount !== undefined
          ? {
              modelRegistryRevisionPublishEventCount:
                model.modelRegistryRevisionPublishEventCount,
            }
          : {}),
        ...(model.modelRegistryRevisionPublishEvents !== undefined
          ? {
              modelRegistryRevisionPublishEvents:
                model.modelRegistryRevisionPublishEvents,
            }
          : {}),
        routeProtocol: model.routeProtocol,
        routeRequestLayer: model.routeRequestLayer,
        routeBehaviorFlags: model.routeBehaviorFlags,
        routeInputTypes: model.routeInputTypes,
        routeOutputTypes: model.routeOutputTypes,
        routeAttachmentAllowRemoteUrls: model.routeAttachmentAllowRemoteUrls,
        routeAttachmentKinds: model.routeAttachmentKinds,
        routeAttachmentSourceKinds: model.routeAttachmentSourceKinds,
        routeStructuredAttachmentAllowRemoteUrls:
          model.routeStructuredAttachmentAllowRemoteUrls,
        routeStructuredAttachmentKinds: model.routeStructuredAttachmentKinds,
        routeStructuredAttachmentSourceKinds:
          model.routeStructuredAttachmentSourceKinds,
        contextWindow: model.contextWindow,
        maxOutputTokens: model.maxOutputTokens,
        embeddingDimensions: model.embeddingDimensions,
        costInputPer1M: model.costInputPer1M,
        costOutputPer1M: model.costOutputPer1M,
        sources: model.sources ?? [],
        routePolicyEnabled: model.routePolicyEnabled,
        routePolicyFeatureKind: model.routePolicyFeatureKind,
        routePolicyWorkspaceId: model.routePolicyWorkspaceId,
        routePolicyAllowedProviderIds: model.routePolicyAllowedProviderIds,
        routePolicyBlockedProviderIds: model.routePolicyBlockedProviderIds,
        routePolicyAllowedPrivacy: model.routePolicyAllowedPrivacy,
        routePolicyPreferredPrivacy: model.routePolicyPreferredPrivacy,
        embeddingRoute: models.embeddingRoute,
        rerankRoute: models.rerankRoute,
        isPro: proModels.some(proModel => proModel.id === model.id),
        isDefault: model.id === defaultModel,
      };
    })
  );
}

export function shouldResetUnavailableAIModel(
  modelId: string | undefined,
  models: Pick<AIModel, 'id'>[]
) {
  return !!modelId && !models.some(model => model.id === modelId);
}

export function resolveDefaultPromptAIModelSeedId(
  promptName: string | undefined,
  workspaceDefaultPromptModelId: string | undefined,
  globalDefaultPromptModelId: string | undefined
) {
  if (normalizeAIModelPromptName(promptName) === AI_MODEL_DEFAULT_PROMPT_NAME) {
    return undefined;
  }

  return workspaceDefaultPromptModelId || globalDefaultPromptModelId;
}

export function resolveAvailableAIModelId(
  modelIds: (string | undefined)[],
  models: Pick<AIModel, 'id'>[]
) {
  const availableModelIds = new Set(models.map(model => model.id));
  return modelIds.find(
    (modelId): modelId is string => !!modelId && availableModelIds.has(modelId)
  );
}

export function formatAIModelProviderLabel(
  model: Pick<
    AIModel,
    | 'providerHealth'
    | 'providerId'
    | 'providerName'
    | 'providerPrivacy'
    | 'providerSource'
    | 'providerType'
  >
) {
  const providerLabel =
    model.providerName && model.providerId
      ? `${model.providerName} (${model.providerId})`
      : model.providerName || model.providerId || model.providerType;
  return [
    providerLabel,
    formatProviderMetadataLabel(model.providerSource, PROVIDER_SOURCE_LABELS),
    formatProviderMetadataLabel(model.providerPrivacy, PROVIDER_PRIVACY_LABELS),
    formatProviderMetadataLabel(model.providerHealth, PROVIDER_HEALTH_LABELS),
  ]
    .filter(Boolean)
    .join(' / ');
}

export function formatAIModelProviderProfileLabel(
  model: Pick<
    AIModel,
    | 'providerConfiguredModelCount'
    | 'providerConfiguredModelIds'
    | 'providerProfileConfigPath'
    | 'providerProfileId'
    | 'providerProfileSource'
  >
) {
  return [
    model.providerProfileId ? `Profile ${model.providerProfileId}` : null,
    formatProviderMetadataLabel(
      model.providerProfileSource,
      PROVIDER_SOURCE_LABELS
    ),
    model.providerProfileConfigPath
      ? `config ${model.providerProfileConfigPath}`
      : null,
    model.providerConfiguredModelCount != null
      ? `${model.providerConfiguredModelCount} configured model${
          model.providerConfiguredModelCount === 1 ? '' : 's'
        }`
      : null,
    model.providerConfiguredModelIds?.length
      ? `models ${model.providerConfiguredModelIds.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join(' / ');
}

export function formatAIModelHealthDetailLabel(
  model: Pick<AIModel, 'providerHealthCheckedAt' | 'providerHealthLastError'>
) {
  return [
    model.providerHealthCheckedAt
      ? `Checked ${model.providerHealthCheckedAt}`
      : null,
    model.providerHealthLastError
      ? `Last error ${model.providerHealthLastError}`
      : null,
  ]
    .filter(Boolean)
    .join(' / ');
}

export function formatAIModelRouteLabel(
  model: Pick<AIModel, 'providerId' | 'routeModelId'>
) {
  const route = [model.providerId, model.routeModelId]
    .filter(Boolean)
    .join('/');
  return route ? `Route ${route}` : '';
}

export function formatAIModelFallbackLabel(
  model: Pick<AIModel, 'routeFallbackProviderIds'>
) {
  return model.routeFallbackProviderIds?.length
    ? model.routeFallbackProviderIds.join(' -> ')
    : '';
}

export function formatAIModelRegistryBranchLabel(
  model: Pick<
    AIModel,
    'registryAvailable' | 'registryKind' | 'registrySelected'
  >
) {
  return [
    model.registryKind ? `registry ${model.registryKind}` : null,
    model.registrySelected ? 'selected registry' : null,
    model.registryAvailable === false ? 'registry unavailable' : null,
  ]
    .filter(Boolean)
    .join(' / ');
}

export function formatAIModelEffectiveSourceLabel(
  model: Pick<
    AIModel,
    | 'effectiveSourceFingerprint'
    | 'effectiveSourceFingerprintInputs'
    | 'effectiveSourceFingerprintVersion'
  >
) {
  return [
    model.effectiveSourceFingerprint
      ? `Source fingerprint ${model.effectiveSourceFingerprint}`
      : null,
    model.effectiveSourceFingerprintVersion
      ? `Source version ${model.effectiveSourceFingerprintVersion}`
      : null,
    model.effectiveSourceFingerprintInputs?.length
      ? `Source inputs ${model.effectiveSourceFingerprintInputs.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join(' / ');
}

export function formatAIModelDefinitionLabel(
  model: Partial<
    Pick<
      AIModel,
      | 'routeBackendKind'
      | 'routeBehaviorFlags'
      | 'routeCanonicalModelKey'
      | 'routeModelAliasMatched'
      | 'routeModelDefinitionAliases'
      | 'routeModelDefinitionId'
      | 'routeModelDefinitionSource'
      | 'modelRegistryRevision'
      | 'modelRegistryRevisionFingerprint'
      | 'modelRegistryRevisionId'
      | 'modelRegistryRevisionScope'
      | 'modelRegistryRevisionSourceChainFingerprint'
      | 'modelRegistryRevisionStatus'
      | 'modelRegistryRevisionWorkspaceId'
      | 'modelRegistryRevisionPublishEventCount'
      | 'routeProtocol'
      | 'routeRawModelId'
      | 'routeRequestLayer'
    >
  >
) {
  return [
    model.routeModelDefinitionSource
      ? formatProviderMetadataLabel(
          model.routeModelDefinitionSource,
          MODEL_DEFINITION_SOURCE_LABELS
        )
      : null,
    model.routeModelDefinitionId
      ? `Definition ${model.routeModelDefinitionId}`
      : null,
    model.routeRawModelId ? `Raw ${model.routeRawModelId}` : null,
    model.routeModelDefinitionAliases?.length
      ? `Aliases ${model.routeModelDefinitionAliases.join(', ')}`
      : null,
    model.routeModelAliasMatched ? 'Alias matched' : null,
    model.modelRegistryRevisionId
      ? `Registry ${model.modelRegistryRevisionId}`
      : null,
    model.modelRegistryRevision
      ? `Revision ${model.modelRegistryRevision}`
      : null,
    model.modelRegistryRevisionScope
      ? `Scope ${model.modelRegistryRevisionScope}`
      : null,
    model.modelRegistryRevisionStatus
      ? `Status ${model.modelRegistryRevisionStatus}`
      : null,
    model.modelRegistryRevisionFingerprint
      ? `Fingerprint ${model.modelRegistryRevisionFingerprint}`
      : null,
    model.modelRegistryRevisionSourceChainFingerprint
      ? `Source chain ${model.modelRegistryRevisionSourceChainFingerprint}`
      : null,
    model.modelRegistryRevisionWorkspaceId
      ? `Workspace ${model.modelRegistryRevisionWorkspaceId}`
      : null,
    model.modelRegistryRevisionPublishEventCount != null
      ? `Publish events ${model.modelRegistryRevisionPublishEventCount}`
      : null,
    model.routeBackendKind || null,
    model.routeCanonicalModelKey
      ? `Canonical ${model.routeCanonicalModelKey}`
      : null,
    model.routeProtocol ? `Protocol ${model.routeProtocol}` : null,
    model.routeRequestLayer ? `Layer ${model.routeRequestLayer}` : null,
    model.routeBehaviorFlags?.length
      ? `Flags ${model.routeBehaviorFlags.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join(' / ');
}

export function formatAIModelCapabilityLabel(
  model: Pick<
    AIModel,
    | 'routeAttachmentAllowRemoteUrls'
    | 'routeAttachmentKinds'
    | 'routeAttachmentSourceKinds'
    | 'routeInputTypes'
    | 'routeOutputTypes'
    | 'routeStructuredAttachmentAllowRemoteUrls'
    | 'routeStructuredAttachmentKinds'
    | 'routeStructuredAttachmentSourceKinds'
  >
) {
  return [
    model.routeInputTypes?.length
      ? `Input ${model.routeInputTypes.join(', ')}`
      : null,
    model.routeOutputTypes?.length
      ? `Output ${model.routeOutputTypes.join(', ')}`
      : null,
    model.routeAttachmentKinds?.length
      ? `Attachments ${model.routeAttachmentKinds.join(', ')}`
      : null,
    model.routeAttachmentSourceKinds?.length
      ? `Attachment sources ${model.routeAttachmentSourceKinds.join(', ')}`
      : null,
    model.routeAttachmentAllowRemoteUrls != null
      ? `Remote attachments ${model.routeAttachmentAllowRemoteUrls ? 'yes' : 'no'}`
      : null,
    model.routeStructuredAttachmentKinds?.length
      ? `Structured attachments ${model.routeStructuredAttachmentKinds.join(', ')}`
      : null,
    model.routeStructuredAttachmentSourceKinds?.length
      ? `Structured attachment sources ${model.routeStructuredAttachmentSourceKinds.join(', ')}`
      : null,
    model.routeStructuredAttachmentAllowRemoteUrls != null
      ? `Structured remote attachments ${model.routeStructuredAttachmentAllowRemoteUrls ? 'yes' : 'no'}`
      : null,
  ]
    .filter(Boolean)
    .join(' / ');
}

export function formatAIModelSourcesLabel(
  model: Pick<AIModel, 'isDefault' | 'isPro' | 'sources'>
) {
  const sources = [...(model.sources ?? [])];
  if (
    model.isDefault &&
    !sources.includes('default') &&
    !sources.includes('fallback_route')
  ) {
    sources.unshift('default');
  }
  if (model.isPro && !sources.includes('pro')) {
    sources.push('pro');
  }

  return Array.from(new Set(sources))
    .map(source => MODEL_SOURCE_LABELS[source] ?? source)
    .join(' / ');
}

function formatAIModelPromptSource(source: AIModelPromptSource) {
  return [
    MODEL_SOURCE_LABELS[source.candidateSource] ?? source.candidateSource,
    source.modelSource
      ? formatProviderMetadataLabel(
          source.modelSource,
          PROMPT_MODEL_SOURCE_LABELS
        )
      : null,
    source.modelConfigPath ? `config ${source.modelConfigPath}` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

export function formatAIModelPromptSourcesLabel(
  model: Pick<AIModel, 'promptModelSources'>
) {
  return (model.promptModelSources ?? [])
    .map(formatAIModelPromptSource)
    .filter(Boolean)
    .join(' -> ');
}

export function formatAIModelPromptLabel(
  model: Pick<
    AIModel,
    | 'defaultModelFallbackReason'
    | 'defaultModelSource'
    | 'promptAction'
    | 'promptCategory'
    | 'promptDefaultModel'
    | 'promptDefaultPolicy'
    | 'promptModelConfigPath'
    | 'promptModelSource'
    | 'promptModelSources'
    | 'promptName'
    | 'promptOverrideApplied'
    | 'promptSource'
  >
) {
  const promptIdentity = [
    model.promptName ? formatAIModelPromptDisplayName(model.promptName) : null,
    model.promptAction ? `Action ${model.promptAction}` : null,
  ]
    .filter(Boolean)
    .join(' / ');
  const defaultModelFallbackReason = model.defaultModelFallbackReason
    ? getAIModelTaskRouteReasonMetadata(model.defaultModelFallbackReason).label
    : null;
  const promptModelSourcesLabel = formatAIModelPromptSourcesLabel(model);

  return [
    promptIdentity || null,
    formatProviderMetadataLabel(model.promptSource, PROMPT_SOURCE_LABELS),
    model.promptDefaultModel
      ? `Prompt default ${model.promptDefaultModel}`
      : null,
    model.defaultModelSource
      ? `Default source ${formatProviderMetadataLabel(
          model.defaultModelSource,
          PROMPT_DEFAULT_MODEL_SOURCE_LABELS
        )}`
      : null,
    defaultModelFallbackReason
      ? `Fallback ${defaultModelFallbackReason}`
      : null,
    model.promptModelSource
      ? `Model source ${formatProviderMetadataLabel(
          model.promptModelSource,
          PROMPT_MODEL_SOURCE_LABELS
        )}`
      : null,
    model.promptModelConfigPath
      ? `Config ${model.promptModelConfigPath}`
      : null,
    promptModelSourcesLabel ? `Source chain ${promptModelSourcesLabel}` : null,
    model.promptCategory
      ? `Category ${formatProviderMetadataLabel(
          model.promptCategory,
          PROMPT_CATEGORY_LABELS
        )}`
      : null,
    model.promptDefaultPolicy
      ? formatProviderMetadataLabel(
          model.promptDefaultPolicy,
          PROMPT_DEFAULT_POLICY_LABELS
        )
      : null,
    model.promptOverrideApplied ? 'Prompt override' : null,
  ]
    .filter(Boolean)
    .join(' / ');
}

export function formatAIModelTaskModelSourceLabel(
  source: string | null | undefined
) {
  return formatProviderMetadataLabel(source, TASK_MODEL_SOURCE_LABELS);
}

function formatRoutePolicyValues(
  values: string[] | null | undefined,
  labels: Record<string, string> = {}
) {
  return (values ?? [])
    .map(value => labels[value] ?? value)
    .filter(Boolean)
    .join(', ');
}

export function formatAIModelRoutePolicyLabel(
  model: Pick<
    AIModel,
    | 'routePolicyAllowedPrivacy'
    | 'routePolicyAllowedProviderIds'
    | 'routePolicyBlockedProviderIds'
    | 'routePolicyEnabled'
    | 'routePolicyFeatureKind'
    | 'routePolicyPreferredPrivacy'
    | 'routePolicyWorkspaceId'
  >
) {
  if (model.routePolicyEnabled === false) {
    return 'Policy disabled';
  }

  const details = [
    model.routePolicyWorkspaceId
      ? `Workspace ${model.routePolicyWorkspaceId}`
      : null,
    model.routePolicyAllowedPrivacy?.length
      ? `Allowed ${formatRoutePolicyValues(
          model.routePolicyAllowedPrivacy,
          PROVIDER_PRIVACY_LABELS
        )}`
      : null,
    model.routePolicyPreferredPrivacy?.length
      ? `Preferred ${formatRoutePolicyValues(
          model.routePolicyPreferredPrivacy,
          PROVIDER_PRIVACY_LABELS
        )}`
      : null,
    model.routePolicyAllowedProviderIds?.length
      ? `Providers ${formatRoutePolicyValues(
          model.routePolicyAllowedProviderIds
        )}`
      : null,
    model.routePolicyBlockedProviderIds?.length
      ? `Blocked ${formatRoutePolicyValues(
          model.routePolicyBlockedProviderIds
        )}`
      : null,
  ].filter((detail): detail is string => !!detail);

  if (!details.length) {
    return '';
  }

  const featureKind = formatProviderMetadataLabel(
    model.routePolicyFeatureKind,
    ROUTE_POLICY_FEATURE_LABELS
  );

  return [`Policy${featureKind ? ` ${featureKind}` : ''}`, ...details].join(
    ' / '
  );
}

function formatTaskRoutePolicyLabel(
  route: Pick<
    AIModelTaskRoute,
    | 'policyAllowedPrivacy'
    | 'policyAllowedProviderIds'
    | 'policyBlockedProviderIds'
    | 'policyEnabled'
    | 'policyFeatureKind'
    | 'policyPreferredPrivacy'
    | 'policyWorkspaceId'
  >
) {
  const label = formatAIModelRoutePolicyLabel({
    routePolicyAllowedPrivacy: route.policyAllowedPrivacy,
    routePolicyAllowedProviderIds: route.policyAllowedProviderIds,
    routePolicyBlockedProviderIds: route.policyBlockedProviderIds,
    routePolicyEnabled: route.policyEnabled,
    routePolicyFeatureKind: route.policyFeatureKind,
    routePolicyPreferredPrivacy: route.policyPreferredPrivacy,
    routePolicyWorkspaceId: route.policyWorkspaceId,
  });

  return label ? label.replace(/^Policy/, 'policy') : null;
}

export function formatAIModelLimitsLabel(
  model: Pick<
    AIModel,
    'contextWindow' | 'embeddingDimensions' | 'maxOutputTokens'
  >
) {
  const contextWindow = formatCompactTokenCount(model.contextWindow);
  const maxOutputTokens = formatCompactTokenCount(model.maxOutputTokens);

  return [
    contextWindow ? `${contextWindow} ctx` : null,
    maxOutputTokens ? `${maxOutputTokens} out` : null,
  ]
    .filter(Boolean)
    .join(' / ');
}

function formatCostPerMillion(value: number | null | undefined) {
  if (value == null || value < 0) {
    return null;
  }

  return `$${Number.isInteger(value) ? value : value.toFixed(4)}/M`;
}

export function formatAIModelCostLabel(
  model: Pick<AIModel, 'costInputPer1M' | 'costOutputPer1M'>
) {
  const inputCost = formatCostPerMillion(model.costInputPer1M);
  const outputCost = formatCostPerMillion(model.costOutputPer1M);

  return [
    inputCost ? `${inputCost} in` : null,
    outputCost ? `${outputCost} out` : null,
  ]
    .filter(Boolean)
    .join(' / ');
}

function formatTaskRouteIdentity(route: AIModelTaskRoute) {
  const routeLabel = [route.providerId, route.modelId]
    .filter(Boolean)
    .join('/');
  return routeLabel || (route.configured ? 'configured' : 'not configured');
}

function formatTaskRouteDimensions(route: AIModelTaskRoute) {
  if (
    route.requestedDimensions == null &&
    route.modelEmbeddingDimensions == null
  ) {
    return null;
  }

  const details = [
    route.requestedDimensions != null
      ? `requested ${route.requestedDimensions}d`
      : null,
    route.modelEmbeddingDimensions != null
      ? `model ${route.modelEmbeddingDimensions}d`
      : null,
    route.dimensionMismatch ? 'dimension mismatch' : null,
  ].filter(Boolean);

  return details.length ? details.join(' / ') : null;
}

function formatPreparedTaskRoute(route: AIModelPreparedTaskRoute) {
  const providerProfileLabel = formatTaskRouteProviderProfileLabel(route);
  const details = [
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
    route.providerType ? `type ${route.providerType}` : null,
    route.providerSource
      ? `source ${formatProviderMetadataLabel(
          route.providerSource,
          PROVIDER_SOURCE_LABELS
        )}`
      : null,
    route.providerPriority != null
      ? `priority ${route.providerPriority}`
      : null,
    providerProfileLabel ? `profile ${providerProfileLabel}` : null,
    route.requestedDimensions != null
      ? `requested ${route.requestedDimensions}d`
      : null,
    route.modelEmbeddingDimensions != null
      ? `model ${route.modelEmbeddingDimensions}d`
      : null,
    route.dimensionMismatch ? 'dimension mismatch' : null,
  ].filter(Boolean);

  return details.join(' ');
}

function formatPreparedTaskRoutes(
  routes: AIModelPreparedTaskRoute[] | null | undefined
) {
  const preparedRoutes = routes ?? [];
  return preparedRoutes.length
    ? `prepared routes ${preparedRoutes.map(formatPreparedTaskRoute).join(' -> ')}`
    : null;
}

function formatTaskRoutePolicyCandidate(
  candidate: AIModelTaskRoutePolicyCandidate
) {
  const providerIdentity =
    candidate.providerName && candidate.providerName !== candidate.providerId
      ? `${candidate.providerName}/${candidate.providerId}`
      : candidate.providerId;
  const providerProfileLabel = formatTaskRouteProviderProfileLabel(candidate);
  const details = [
    candidate.candidateFingerprint
      ? `fingerprint ${candidate.candidateFingerprint}`
      : null,
    candidate.candidateKey ? `key ${candidate.candidateKey}` : null,
    candidate.providerType ? `type ${candidate.providerType}` : null,
    candidate.providerSource
      ? `source ${formatProviderMetadataLabel(
          candidate.providerSource,
          PROVIDER_SOURCE_LABELS
        )}`
      : null,
    candidate.providerPriority != null
      ? `priority ${candidate.providerPriority}`
      : null,
    candidate.registryKind ? `registry ${candidate.registryKind}` : null,
    candidate.registrySelected ? 'selected registry' : null,
    candidate.registryAvailable === false ? 'registry unavailable' : null,
    candidate.allowed ? 'allowed' : 'blocked',
    candidate.available ? 'available' : 'unavailable',
    formatProviderMetadataLabel(candidate.privacy, PROVIDER_PRIVACY_LABELS),
    formatProviderMetadataLabel(candidate.health, PROVIDER_HEALTH_LABELS),
    candidate.healthCheckedAt ? `checked ${candidate.healthCheckedAt}` : null,
    providerProfileLabel ? `profile ${providerProfileLabel}` : null,
    candidate.reasons.length
      ? `reasons ${formatAIModelTaskRouteReasonLabels(candidate.reasons)}`
      : null,
  ].filter(Boolean);

  return `${providerIdentity} (${details.join('; ')})`;
}

function formatTaskRoutePolicyCandidates(
  candidates: AIModelTaskRoutePolicyCandidate[] | null | undefined
) {
  const policyCandidates = candidates ?? [];
  return policyCandidates.length
    ? `policy candidates ${policyCandidates
        .map(formatTaskRoutePolicyCandidate)
        .join(' -> ')}`
    : null;
}

function formatTaskRouteProviderProfileLabel(
  candidate: Pick<
    | AIModelTaskRouteCandidate
    | AIModelPreparedTaskRoute
    | AIModelTaskRoute
    | AIModelTaskRoutePolicyCandidate
    | AIModelTaskRoutePrepareCandidate,
    | 'providerConfiguredModelCount'
    | 'providerConfiguredModelIds'
    | 'providerProfileConfigPath'
    | 'providerProfileId'
    | 'providerProfileSource'
  >
) {
  return formatAIModelProviderProfileLabel({
    providerConfiguredModelCount: candidate.providerConfiguredModelCount,
    providerConfiguredModelIds: candidate.providerConfiguredModelIds,
    providerProfileConfigPath: candidate.providerProfileConfigPath,
    providerProfileId: candidate.providerProfileId,
    providerProfileSource: candidate.providerProfileSource,
  });
}

function formatTaskRouteModelDefinitionLabel(
  candidate: Pick<
    AIModelTaskRouteCandidate | AIModelTaskRoutePrepareCandidate,
    | 'modelRegistryRevision'
    | 'modelRegistryRevisionFingerprint'
    | 'modelRegistryRevisionId'
    | 'modelRegistryRevisionScope'
    | 'modelRegistryRevisionSourceChainFingerprint'
    | 'modelRegistryRevisionStatus'
    | 'modelRegistryRevisionWorkspaceId'
    | 'modelRegistryRevisionPublishEventCount'
    | 'routeModelAliasMatched'
    | 'routeModelDefinitionAliases'
    | 'routeModelDefinitionId'
    | 'routeModelDefinitionSource'
    | 'routeRawModelId'
  >
) {
  return formatAIModelDefinitionLabel({
    routeBackendKind: null,
    routeBehaviorFlags: null,
    routeCanonicalModelKey: null,
    routeModelAliasMatched: candidate.routeModelAliasMatched,
    routeModelDefinitionAliases: candidate.routeModelDefinitionAliases,
    routeModelDefinitionId: candidate.routeModelDefinitionId,
    routeModelDefinitionSource: candidate.routeModelDefinitionSource,
    modelRegistryRevision: candidate.modelRegistryRevision,
    modelRegistryRevisionFingerprint:
      candidate.modelRegistryRevisionFingerprint,
    modelRegistryRevisionId: candidate.modelRegistryRevisionId,
    modelRegistryRevisionScope: candidate.modelRegistryRevisionScope,
    modelRegistryRevisionSourceChainFingerprint:
      candidate.modelRegistryRevisionSourceChainFingerprint,
    modelRegistryRevisionStatus: candidate.modelRegistryRevisionStatus,
    modelRegistryRevisionWorkspaceId:
      candidate.modelRegistryRevisionWorkspaceId,
    modelRegistryRevisionPublishEventCount:
      candidate.modelRegistryRevisionPublishEventCount,
    routeProtocol: null,
    routeRawModelId: candidate.routeRawModelId,
    routeRequestLayer: null,
  });
}

function formatTaskRouteCandidate(candidate: AIModelTaskRouteCandidate) {
  const providerIdentity =
    candidate.providerName && candidate.providerName !== candidate.providerId
      ? `${candidate.providerName}/${candidate.providerId}`
      : candidate.providerId;
  const identity = [candidate.providerId, candidate.modelId]
    .filter(Boolean)
    .join('/');
  const providerProfileLabel = formatTaskRouteProviderProfileLabel(candidate);
  const modelDefinitionLabel = formatTaskRouteModelDefinitionLabel(candidate);
  const details = [
    candidate.providerType ? `type ${candidate.providerType}` : null,
    candidate.providerSource
      ? `source ${formatProviderMetadataLabel(
          candidate.providerSource,
          PROVIDER_SOURCE_LABELS
        )}`
      : null,
    candidate.providerPriority != null
      ? `priority ${candidate.providerPriority}`
      : null,
    formatProviderMetadataLabel(candidate.privacy, PROVIDER_PRIVACY_LABELS),
    formatProviderMetadataLabel(candidate.health, PROVIDER_HEALTH_LABELS),
    candidate.healthCheckedAt ? `checked ${candidate.healthCheckedAt}` : null,
    candidate.registryKind ? `registry ${candidate.registryKind}` : null,
    candidate.registrySelected ? 'selected registry' : null,
    candidate.registryAvailable === false ? 'registry unavailable' : null,
    candidate.matched ? 'matched' : 'unmatched',
    candidate.requestedModelId
      ? `requested ${candidate.requestedModelId}`
      : null,
    providerProfileLabel ? `profile ${providerProfileLabel}` : null,
    modelDefinitionLabel ? `definition ${modelDefinitionLabel}` : null,
    candidate.candidateModelIds?.length
      ? `profile models ${candidate.candidateModelIds.join(', ')}`
      : null,
    candidate.reasons.length
      ? `reasons ${formatAIModelTaskRouteReasonLabels(candidate.reasons)}`
      : null,
  ].filter(Boolean);

  return `${identity || providerIdentity} (${details.join('; ')})`;
}

function formatTaskRoutePrepareCandidate(
  candidate: AIModelTaskRoutePrepareCandidate
) {
  const providerIdentity =
    candidate.providerName && candidate.providerName !== candidate.providerId
      ? `${candidate.providerName}/${candidate.providerId}`
      : candidate.providerId;
  const identity = [candidate.providerId, candidate.modelId]
    .filter(Boolean)
    .join('/');
  const providerProfileLabel = formatTaskRouteProviderProfileLabel(candidate);
  const modelDefinitionLabel = formatTaskRouteModelDefinitionLabel(candidate);
  const details = [
    candidate.providerType ? `type ${candidate.providerType}` : null,
    candidate.providerSource
      ? `source ${formatProviderMetadataLabel(
          candidate.providerSource,
          PROVIDER_SOURCE_LABELS
        )}`
      : null,
    candidate.providerPriority != null
      ? `priority ${candidate.providerPriority}`
      : null,
    formatProviderMetadataLabel(candidate.privacy, PROVIDER_PRIVACY_LABELS),
    formatProviderMetadataLabel(candidate.health, PROVIDER_HEALTH_LABELS),
    candidate.healthCheckedAt ? `checked ${candidate.healthCheckedAt}` : null,
    candidate.registryKind ? `registry ${candidate.registryKind}` : null,
    candidate.registrySelected ? 'selected registry' : null,
    candidate.registryAvailable === false ? 'registry unavailable' : null,
    candidate.prepared ? 'prepared' : 'not prepared',
    candidate.preparedModelId ? `prepared ${candidate.preparedModelId}` : null,
    candidate.errorCode ? `code ${candidate.errorCode}` : null,
    candidate.errorCategory ? `category ${candidate.errorCategory}` : null,
    candidate.requestedModelId
      ? `requested ${candidate.requestedModelId}`
      : null,
    providerProfileLabel ? `profile ${providerProfileLabel}` : null,
    modelDefinitionLabel ? `definition ${modelDefinitionLabel}` : null,
    candidate.candidateModelIds?.length
      ? `profile models ${candidate.candidateModelIds.join(', ')}`
      : null,
    candidate.reasons.length
      ? `reasons ${formatAIModelTaskRouteReasonLabels(candidate.reasons)}`
      : null,
  ].filter(Boolean);

  return `${identity || providerIdentity} (${details.join('; ')})`;
}

function formatTaskRoutePrepareCandidates(
  candidates: AIModelTaskRoutePrepareCandidate[] | null | undefined
) {
  const prepareCandidates = candidates ?? [];
  return prepareCandidates.length
    ? `prepare candidates ${prepareCandidates
        .map(formatTaskRoutePrepareCandidate)
        .join(' -> ')}`
    : null;
}

function formatTaskRouteDiagnosticsErrors(
  errors: AIModelTaskRouteDiagnosticsError[] | null | undefined
) {
  const diagnosticsErrors = errors ?? [];
  return diagnosticsErrors.length
    ? `diagnostics errors ${diagnosticsErrors
        .map(
          error =>
            `${error.stage}:${error.code}${error.message ? `:${error.message}` : ''}`
        )
        .join(' -> ')}`
    : null;
}

function formatTaskRouteCandidates(
  candidates: AIModelTaskRouteCandidate[] | null | undefined
) {
  const routeCandidates = candidates ?? [];
  return routeCandidates.length
    ? `route candidates ${routeCandidates
        .map(formatTaskRouteCandidate)
        .join(' -> ')}`
    : null;
}

function formatAIModelTaskRoute(route: AIModelTaskRoute | null | undefined) {
  if (!route) {
    return null;
  }

  const feature = formatProviderMetadataLabel(
    route.featureKind,
    ROUTE_POLICY_FEATURE_LABELS
  );
  const providerProfileLabel = formatTaskRouteProviderProfileLabel(route);
  const details = [
    feature || route.featureKind,
    route.requestedModelId ? `requested ${route.requestedModelId}` : null,
    route.requestedModelSource
      ? `source ${formatAIModelTaskModelSourceLabel(route.requestedModelSource)}`
      : null,
    route.requestedModelConfigPath
      ? `config ${route.requestedModelConfigPath}`
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
    formatTaskRouteIdentity(route),
    route.fallbackProviderIds?.length
      ? `fallback ${route.fallbackProviderIds.join(' -> ')}`
      : null,
    route.preparedProviderCount > 0
      ? `${route.preparedProviderCount} prepared provider${
          route.preparedProviderCount === 1 ? '' : 's'
        }`
      : null,
    route.protocol ? `protocol ${route.protocol}` : null,
    route.requestLayer ? `layer ${route.requestLayer}` : null,
    route.modelBackendKind ? `backend ${route.modelBackendKind}` : null,
    route.canonicalModelKey ? `canonical ${route.canonicalModelKey}` : null,
    route.behaviorFlags?.length
      ? `flags ${route.behaviorFlags.join(', ')}`
      : null,
    providerProfileLabel ? `profile ${providerProfileLabel}` : null,
    route.taskRoutePolicyRevisionPublishEventCount != null
      ? `policy publish events ${route.taskRoutePolicyRevisionPublishEventCount}`
      : null,
    formatTaskRoutePolicyLabel(route),
    formatTaskRoutePolicyCandidates(route.policyCandidates),
    formatTaskRouteCandidates(route.routeCandidates),
    formatTaskRoutePrepareCandidates(route.prepareCandidates),
    formatTaskRouteDiagnosticsErrors(route.diagnosticsErrors),
    formatPreparedTaskRoutes(route.preparedRoutes),
    route.errorCode ? `code ${route.errorCode}` : null,
    route.errorMessage ? `error ${route.errorMessage}` : null,
    formatTaskRouteDimensions(route),
    route.candidateCount != null ? `${route.candidateCount} candidates` : null,
    route.topK != null ? `top ${route.topK}` : null,
  ].filter(Boolean);

  return details.join(' / ');
}

export function formatAIModelTaskRoutesLabel(
  model: Pick<AIModel, 'embeddingRoute' | 'rerankRoute'>
) {
  return [
    formatAIModelTaskRoute(model.embeddingRoute),
    formatAIModelTaskRoute(model.rerankRoute),
  ]
    .filter(Boolean)
    .join(' | ');
}

export function formatAIModelMenuLabels(
  model: Pick<
    AIModel,
    | 'contextWindow'
    | 'costInputPer1M'
    | 'costOutputPer1M'
    | 'effectiveSourceFingerprint'
    | 'effectiveSourceFingerprintInputs'
    | 'effectiveSourceFingerprintVersion'
    | 'embeddingDimensions'
    | 'isDefault'
    | 'isPro'
    | 'maxOutputTokens'
    | 'providerHealth'
    | 'providerId'
    | 'providerName'
    | 'providerPrivacy'
    | 'providerType'
    | 'registryAvailable'
    | 'registryKind'
    | 'registrySelected'
    | 'routeFallbackProviderIds'
    | 'routeAttachmentAllowRemoteUrls'
    | 'routeAttachmentKinds'
    | 'routeAttachmentSourceKinds'
    | 'routeInputTypes'
    | 'routeModelId'
    | 'routeOutputTypes'
    | 'routeStructuredAttachmentAllowRemoteUrls'
    | 'routeStructuredAttachmentKinds'
    | 'routeStructuredAttachmentSourceKinds'
    | 'routePolicyAllowedPrivacy'
    | 'routePolicyAllowedProviderIds'
    | 'routePolicyBlockedProviderIds'
    | 'routePolicyEnabled'
    | 'routePolicyFeatureKind'
    | 'routePolicyPreferredPrivacy'
    | 'routePolicyWorkspaceId'
    | 'sources'
  >
) {
  const fallbackLabel = formatAIModelFallbackLabel(model);
  const registryBranchLabel = formatAIModelRegistryBranchLabel(model);
  const effectiveSourceLabel = formatAIModelEffectiveSourceLabel(model);

  return [
    formatAIModelProviderLabel(model),
    formatAIModelRouteLabel(model),
    fallbackLabel ? `Fallback ${fallbackLabel}` : null,
    registryBranchLabel || null,
    effectiveSourceLabel || null,
    formatAIModelCapabilityLabel(model),
    formatAIModelRoutePolicyLabel(model),
    formatAIModelSourcesLabel(model),
    formatAIModelLimitsLabel(model),
    formatAIModelCostLabel(model),
  ].filter((label): label is string => !!label);
}

export function formatAIModelDiagnosticsLabel(
  model: Pick<
    AIModel,
    | 'contextWindow'
    | 'costInputPer1M'
    | 'costOutputPer1M'
    | 'embeddingRoute'
    | 'embeddingDimensions'
    | 'id'
    | 'isDefault'
    | 'isPro'
    | 'maxOutputTokens'
    | 'promptAction'
    | 'promptCategory'
    | 'promptDefaultModel'
    | 'promptDefaultPolicy'
    | 'promptModelConfigPath'
    | 'promptModelSource'
    | 'promptModelSources'
    | 'promptName'
    | 'promptOverrideApplied'
    | 'promptSource'
    | 'defaultModelFallbackReason'
    | 'defaultModelSource'
    | 'effectiveSourceFingerprint'
    | 'effectiveSourceFingerprintInputs'
    | 'effectiveSourceFingerprintVersion'
    | 'providerHealth'
    | 'providerHealthCheckedAt'
    | 'providerHealthLastError'
    | 'providerId'
    | 'providerName'
    | 'providerPrivacy'
    | 'providerConfiguredModelCount'
    | 'providerConfiguredModelIds'
    | 'providerProfileConfigPath'
    | 'providerProfileId'
    | 'providerProfileSource'
    | 'providerSource'
    | 'providerPriority'
    | 'providerType'
    | 'registryAvailable'
    | 'registryKind'
    | 'registrySelected'
    | 'routeBackendKind'
    | 'routeBehaviorFlags'
    | 'routeCanonicalModelKey'
    | 'routeAttachmentAllowRemoteUrls'
    | 'routeAttachmentKinds'
    | 'routeAttachmentSourceKinds'
    | 'routeInputTypes'
    | 'routeModelAliasMatched'
    | 'routeModelDefinitionAliases'
    | 'routeModelDefinitionId'
    | 'routeModelDefinitionSource'
    | 'modelRegistryRevision'
    | 'modelRegistryRevisionFingerprint'
    | 'modelRegistryRevisionId'
    | 'modelRegistryRevisionScope'
    | 'modelRegistryRevisionSourceChainFingerprint'
    | 'modelRegistryRevisionStatus'
    | 'modelRegistryRevisionWorkspaceId'
    | 'modelRegistryRevisionPublishEventCount'
    | 'routeModelId'
    | 'routeFallbackProviderIds'
    | 'routeOutputTypes'
    | 'routeStructuredAttachmentAllowRemoteUrls'
    | 'routeStructuredAttachmentKinds'
    | 'routeStructuredAttachmentSourceKinds'
    | 'routeProtocol'
    | 'routeRawModelId'
    | 'routeRequestLayer'
    | 'rerankRoute'
    | 'routePolicyAllowedPrivacy'
    | 'routePolicyAllowedProviderIds'
    | 'routePolicyBlockedProviderIds'
    | 'routePolicyEnabled'
    | 'routePolicyFeatureKind'
    | 'routePolicyPreferredPrivacy'
    | 'routePolicyWorkspaceId'
    | 'sources'
  >
) {
  const providerLabel = formatAIModelProviderLabel(model);
  const providerProfileLabel = formatAIModelProviderProfileLabel(model);
  const healthDetailLabel = formatAIModelHealthDetailLabel(model);
  const routeLabel = formatAIModelRouteLabel(model);
  const fallbackLabel = formatAIModelFallbackLabel(model);
  const registryBranchLabel = formatAIModelRegistryBranchLabel(model);
  const effectiveSourceLabel = formatAIModelEffectiveSourceLabel(model);
  const definitionLabel = formatAIModelDefinitionLabel(model);
  const capabilityLabel = formatAIModelCapabilityLabel(model);
  const routePolicyLabel = formatAIModelRoutePolicyLabel(model);
  const sourcesLabel = formatAIModelSourcesLabel(model);
  const promptLabel = formatAIModelPromptLabel(model);
  const limitsLabel = formatAIModelLimitsLabel(model);
  const costLabel = formatAIModelCostLabel(model);
  const taskRoutesLabel = formatAIModelTaskRoutesLabel(model);

  return [
    `Candidate ${model.id}`,
    promptLabel ? `Prompt ${promptLabel}` : null,
    providerLabel ? `Provider ${providerLabel}` : null,
    providerProfileLabel ? `Provider profile ${providerProfileLabel}` : null,
    healthDetailLabel ? `Provider health ${healthDetailLabel}` : null,
    model.providerPriority != null
      ? `Provider priority ${model.providerPriority}`
      : null,
    routeLabel || null,
    fallbackLabel ? `Fallback providers ${fallbackLabel}` : null,
    registryBranchLabel ? `Registry branch ${registryBranchLabel}` : null,
    effectiveSourceLabel || null,
    definitionLabel ? `Model definition ${definitionLabel}` : null,
    capabilityLabel ? `Capabilities ${capabilityLabel}` : null,
    routePolicyLabel || null,
    taskRoutesLabel ? `Task routes ${taskRoutesLabel}` : null,
    sourcesLabel ? `Sources ${sourcesLabel}` : null,
    limitsLabel ? `Limits ${limitsLabel}` : null,
    costLabel ? `Cost ${costLabel}` : null,
  ]
    .filter((part): part is string => !!part)
    .join('\n');
}

export type AIModelSelection = Pick<
  AIModelService,
  'modelId' | 'models' | 'setWorkspaceId' | 'setPromptName' | 'setModel'
>;

export class AIModelService extends Service {
  modelId: Signal<string | undefined> = signal(undefined);

  models: Signal<AIModel[]> = signal([]);

  private workspaceId?: string;

  private promptName = AI_MODEL_DEFAULT_PROMPT_NAME;

  private loadedModelsScope?: { promptName: string; workspaceId?: string };

  private promptModelsInflight?: Map<
    string,
    ReturnType<AIModelService['fetchModelsForPrompt']>
  >;

  private modelIdSubscription?: Subscription;

  constructor(
    private readonly globalStateService: GlobalStateService,
    private readonly gqlService: GraphQLService,
    private readonly subscriptionService: SubscriptionService
  ) {
    super();

    this.bindModelId();
    this.disposables.push(() => this.modelIdSubscription?.unsubscribe());

    this.init().catch(err => {
      console.error(err);
    });
  }

  private get modelIdKey() {
    return getAIModelIdKey(this.workspaceId, this.promptName);
  }

  private readonly bindModelId = () => {
    this.modelIdSubscription?.unsubscribe();
    const modelId$ = LiveData.from(
      this.globalStateService.globalState.watch<string>(this.modelIdKey),
      this.globalStateService.globalState.get<string>(this.modelIdKey)
    );
    const sub = modelId$.subscribe(modelId => {
      this.modelId.value = modelId;
    });
    this.modelIdSubscription = sub;
  };

  private resolveModelForPromptFromCandidates(
    promptName: string,
    workspaceId: string | undefined,
    models: Pick<AIModel, 'id'>[]
  ) {
    const modelId = this.globalStateService.globalState.get<string>(
      getAIModelIdKey(workspaceId, promptName)
    );
    const legacyModelId = workspaceId
      ? this.globalStateService.globalState.get<string>(
          getAIModelIdKey(undefined, promptName)
        )
      : undefined;
    const defaultPromptModelId = resolveDefaultPromptAIModelSeedId(
      promptName,
      this.globalStateService.globalState.get<string>(
        getAIModelIdKey(workspaceId, AI_MODEL_DEFAULT_PROMPT_NAME)
      ),
      this.globalStateService.globalState.get<string>(
        getAIModelIdKey(undefined, AI_MODEL_DEFAULT_PROMPT_NAME)
      )
    );

    return resolveAvailableAIModelId(
      [modelId, legacyModelId, defaultPromptModelId],
      models
    );
  }

  resetModel = () => {
    this.globalStateService.globalState.set(this.modelIdKey, undefined);
  };

  getModelForPrompt(
    promptName?: string | null,
    workspaceId: string | null | undefined = this.workspaceId
  ) {
    const nextWorkspaceId = workspaceId || undefined;
    const nextPromptName = resolveAIModelPromptName(promptName);
    const modelId = this.globalStateService.globalState.get<string>(
      getAIModelIdKey(nextWorkspaceId, nextPromptName)
    );

    const loadedModelsScope = this.loadedModelsScope;
    if (
      !loadedModelsScope ||
      loadedModelsScope.workspaceId !== nextWorkspaceId ||
      loadedModelsScope.promptName !== nextPromptName
    ) {
      return modelId;
    }

    return this.resolveModelForPromptFromCandidates(
      nextPromptName,
      nextWorkspaceId,
      this.models.value
    );
  }

  async ensureModelForPrompt(
    promptName?: string | null,
    workspaceId: string | null | undefined = this.workspaceId
  ) {
    const nextWorkspaceId = workspaceId || undefined;
    const nextPromptName = resolveAIModelPromptName(promptName);
    const loadedModelsScope = this.loadedModelsScope;
    if (
      loadedModelsScope &&
      loadedModelsScope.workspaceId === nextWorkspaceId &&
      loadedModelsScope.promptName === nextPromptName
    ) {
      return this.resolveModelForPromptFromCandidates(
        nextPromptName,
        nextWorkspaceId,
        this.models.value
      );
    }

    const models = await this.ensurePromptModelsRequest(
      nextPromptName,
      nextWorkspaceId
    ).catch((err: unknown) => {
      console.error(err);
      return undefined;
    });
    if (!models) {
      return undefined;
    }

    return this.resolveModelForPromptFromCandidates(
      nextPromptName,
      nextWorkspaceId,
      buildAIModels(models)
    );
  }

  setModel = (modelId: string) => {
    const isSubscribed =
      this.subscriptionService.subscription.ai$.value?.status ===
      SubscriptionStatus.Active;
    const model = this.models.value.find(model => model.id === modelId);
    if (!isSubscribed && model?.isPro) {
      return;
    }
    this.globalStateService.globalState.set(this.modelIdKey, modelId);
  };

  setWorkspaceId = (workspaceId?: string | null) => {
    const nextWorkspaceId = workspaceId || undefined;
    if (this.workspaceId === nextWorkspaceId) {
      return;
    }

    this.workspaceId = nextWorkspaceId;
    this.bindModelId();
    this.initModels().catch(err => {
      console.error(err);
    });
  };

  setPromptName = (promptName?: string | null) => {
    const nextPromptName = resolveAIModelPromptName(promptName);
    if (this.promptName === nextPromptName) {
      return;
    }

    this.promptName = nextPromptName;
    this.bindModelId();
    this.initModels().catch(err => {
      console.error(err);
    });
  };

  private readonly init = async () => {
    await this.initModels();

    // subscribe to ai purchase status
    const sub = this.subscriptionService.subscription.ai$.subscribe(
      subscription => {
        const isSubscribed = subscription?.status === SubscriptionStatus.Active;
        const model = this.models.value.find(
          model => model.id === this.modelId.value
        );
        if (!isSubscribed && model?.isPro) {
          this.resetModel();
        }
      }
    );
    this.disposables.push(() => sub.unsubscribe());
  };

  private readonly initModels = async () => {
    const models = await this.fetchModelsForPrompt(this.promptName);
    if (models) {
      this.models.value = buildAIModels(models);
      this.loadedModelsScope = {
        promptName: this.promptName,
        workspaceId: this.workspaceId,
      };
      const currentModelId = this.globalStateService.globalState.get<string>(
        this.modelIdKey
      );
      const legacyModelId = this.globalStateService.globalState.get<string>(
        getAIModelIdKey(undefined, this.promptName)
      );
      const workspaceDefaultPromptModelId =
        this.promptName === AI_MODEL_DEFAULT_PROMPT_NAME
          ? undefined
          : this.globalStateService.globalState.get<string>(
              getAIModelIdKey(this.workspaceId, AI_MODEL_DEFAULT_PROMPT_NAME)
            );
      const globalDefaultPromptModelId =
        this.promptName === AI_MODEL_DEFAULT_PROMPT_NAME
          ? undefined
          : this.globalStateService.globalState.get<string>(
              getAIModelIdKey(undefined, AI_MODEL_DEFAULT_PROMPT_NAME)
            );
      const defaultPromptModelId = resolveDefaultPromptAIModelSeedId(
        this.promptName,
        workspaceDefaultPromptModelId,
        globalDefaultPromptModelId
      );

      const availableModelId = resolveAvailableAIModelId(
        [currentModelId, legacyModelId, defaultPromptModelId],
        this.models.value
      );

      if (availableModelId && availableModelId !== currentModelId) {
        this.globalStateService.globalState.set(
          this.modelIdKey,
          availableModelId
        );
      } else if (
        !availableModelId &&
        shouldResetUnavailableAIModel(currentModelId, this.models.value)
      ) {
        this.resetModel();
      }
    }
  };

  async fetchModelsForPrompt(
    promptName: string,
    workspaceId = this.workspaceId
  ) {
    return this.gqlService
      .gql({
        query: getPromptModelsQuery,
        variables: buildGetPromptModelsVariables(promptName, workspaceId),
      })
      .then(res => res.currentUser?.copilot?.models);
  }

  private ensurePromptModelsRequest(
    promptName: string,
    workspaceId = this.workspaceId
  ) {
    const fetchKey = getAIModelPromptFetchKey(promptName, workspaceId);
    const promptModelsInflight =
      this.promptModelsInflight ?? (this.promptModelsInflight = new Map());
    const inflight = promptModelsInflight.get(fetchKey);
    if (inflight) {
      return inflight;
    }

    const request = this.fetchModelsForPrompt(promptName, workspaceId).finally(
      () => {
        promptModelsInflight.delete(fetchKey);
      }
    );
    promptModelsInflight.set(fetchKey, request);
    return request;
  }
}
