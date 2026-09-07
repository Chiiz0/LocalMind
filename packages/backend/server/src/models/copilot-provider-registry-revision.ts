import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';

import {
  CopilotProviderType,
  ModelInputType,
  ModelOutputType,
} from '../plugins/copilot/providers/types';
import { BaseModel } from './base';
import type { CopilotProviderHealthProbeAttemptRecord } from './copilot-provider-health-state';
import {
  CopilotModelBackendKindValues,
  type CopilotModelDefinition,
  type CopilotModelDefinitionCapability,
  type CopilotProviderPrivacy,
  type CopilotProviderProfile,
  type CopilotProviderProfileSource,
  LlmProtocolValues,
  LlmRequestLayerValues,
} from './copilot-registry-definition-types';
import {
  createRegistryRevisionPublishEvent,
  getRegistryRevisionPublishEventHistory,
  type RegistryRevisionPublishEventHistory,
  withRegistryRevisionPublishEventHistory,
} from './copilot-registry-revision-publish-event';
import { warnUnknownRegistrySourceChainStatuses } from './copilot-registry-source-chain-logging';

const sourceChainLogger = new Logger('CopilotProviderRegistryRevisionModel');

export type ProviderRegistrySourceChainEntry = {
  source:
    | 'db_revision'
    | 'provider_profile'
    | 'legacy_profile'
    | 'config_fallback';
  scope: 'global' | 'workspace';
  status: string;
  actorId?: string;
  fingerprint?: string;
  providerId?: string;
  providerType?: string;
  revision?: string;
  updatedAt?: string;
  workspaceId?: string;
};

export type ProviderRegistryRevision = {
  id: string;
  providerId: string;
  providerType?: CopilotProviderType;
  scopeType: 'global' | 'workspace';
  workspaceId?: string;
  actorId?: string;
  revision: string;
  status: 'active' | 'archived' | 'disabled';
  fingerprint: string;
  providerProfile: CopilotProviderProfile;
  providerProfileSnapshot: unknown;
  fallbackSourceChain: ProviderRegistrySourceChainEntry[];
  fallbackSourceChainSnapshot: unknown;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ProviderRegistryRevisionPublishResult = ProviderRegistryRevision &
  RegistryRevisionPublishEventHistory & {
    providerHealthProbeAttempt?: CopilotProviderHealthProbeAttemptRecord;
  };

type ProviderRegistryRevisionRow = {
  id: string;
  providerId: string;
  providerType: string | null;
  scopeType: string;
  workspaceId: string | null;
  actorId: string | null;
  revision: string;
  status: string;
  fingerprint: string;
  providerProfile: unknown;
  fallbackSourceChain: unknown;
  metadata?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type ProviderRegistryPublishInput = {
  workspaceId: string;
  actorId: string;
  providerId: string;
  providerType: CopilotProviderType;
  revision?: string | null;
  idempotencyKey?: string | null;
  displayName?: string | null;
  enabled?: boolean | null;
  models?: string[] | null;
  modelDefinitions?: unknown;
  privacy?: CopilotProviderPrivacy | string | null;
  priority?: number | null;
  fallbackSourceChain?: ProviderRegistrySourceChainEntry[];
};

export type ProviderRegistryRepairExecutorPayload = {
  version: 'provider-registry-revision-executor-payload/v1';
  kind: 'provider_registry_revision_publish';
  providerId: string;
  providerType: CopilotProviderType;
  displayName?: string;
  enabled?: boolean;
  models?: string[];
  modelDefinitions?: unknown;
  privacy?: CopilotProviderPrivacy | string;
  priority?: number;
  operationFingerprint: string;
  operationSetFingerprint: string;
  previewFingerprint: string;
  catalogFingerprint: string;
  targetLocatorFingerprint: string;
  candidateEvidenceFingerprints: string[];
  fallbackSourceChain: ProviderRegistrySourceChainEntry[];
};

type ProviderRegistryRevisionConflictEvidence = {
  actorId: string | null;
  fallbackSourceChainFingerprint: string;
  fingerprint: string;
  id: string;
  metadataFingerprint: string;
  providerId: string;
  providerProfileFingerprint: string;
  providerType: CopilotProviderType | null;
  revision: string;
  scopeType: 'workspace';
  status: 'active';
  workspaceId: string;
};

function stableProviderRegistryStringify(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableProviderRegistryStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => {
        const item = (value as Record<string, unknown>)[key];
        return item === undefined
          ? null
          : `${JSON.stringify(key)}:${stableProviderRegistryStringify(item)}`;
      })
      .filter(Boolean)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function providerRegistryRevisionFingerprint(value: unknown) {
  return createHash('sha256')
    .update(stableProviderRegistryStringify(value))
    .digest('hex')
    .slice(0, 16);
}

const PROVIDER_TYPES = new Set<string>(Object.values(CopilotProviderType));
const PROVIDER_PRIVACY = new Set<string>(['cloud', 'private_cloud', 'local']);
const PROVIDER_SOURCES = new Set<string>([
  'configured',
  'legacy',
  'byok_server',
  'byok_local',
  'byok_project_global',
  'db_revision',
]);
const PROVIDER_REGISTRY_SOURCE_CHAIN_SOURCES = new Set([
  'db_revision',
  'provider_profile',
  'legacy_profile',
  'config_fallback',
]);
const PROVIDER_REGISTRY_SOURCE_CHAIN_SCOPES = new Set(['global', 'workspace']);
const PROVIDER_REGISTRY_SOURCE_CHAIN_STATUSES = new Set([
  'active',
  'available',
  'disabled',
]);
const PROVIDER_REGISTRY_REVISION_SCOPE_TYPES = new Set(['global', 'workspace']);
const PROVIDER_REGISTRY_REVISION_STATUSES = new Set([
  'active',
  'archived',
  'disabled',
]);
const SOURCE_CHAIN_MAX_ENTRIES = 16;
const SOURCE_CHAIN_OPTIONAL_STRING_MAX_LENGTH = 512;
const REGISTRY_PAYLOAD_STRING_MAX_LENGTH = 512;
const REGISTRY_METADATA_JSON_MAX_LENGTH = 16 * 1024;
const PROVIDER_PROFILE_JSON_MAX_LENGTH = 32 * 1024;
const REPAIR_REVISION_PREFIX = 'repair-';
const MODEL_BACKEND_KINDS = new Set<string>(CopilotModelBackendKindValues);
const LLM_PROTOCOLS = new Set<string>(LlmProtocolValues);
const LLM_REQUEST_LAYERS = new Set<string>(LlmRequestLayerValues);

function isProviderType(value: unknown): value is CopilotProviderType {
  return typeof value === 'string' && PROVIDER_TYPES.has(value);
}

function isProviderPrivacy(value: unknown): value is CopilotProviderPrivacy {
  return typeof value === 'string' && PROVIDER_PRIVACY.has(value);
}

function isProviderSource(
  value: unknown
): value is CopilotProviderProfileSource | 'db_revision' {
  return typeof value === 'string' && PROVIDER_SOURCES.has(value);
}

function isSourceChainEntry(
  value: unknown
): value is ProviderRegistrySourceChainEntry {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as ProviderRegistrySourceChainEntry).source === 'string' &&
    typeof (value as ProviderRegistrySourceChainEntry).scope === 'string' &&
    typeof (value as ProviderRegistrySourceChainEntry).status === 'string' &&
    PROVIDER_REGISTRY_SOURCE_CHAIN_SOURCES.has(
      (value as ProviderRegistrySourceChainEntry).source
    ) &&
    PROVIDER_REGISTRY_SOURCE_CHAIN_SCOPES.has(
      (value as ProviderRegistrySourceChainEntry).scope
    ) &&
    PROVIDER_REGISTRY_SOURCE_CHAIN_STATUSES.has(
      (value as ProviderRegistrySourceChainEntry).status
    )
  );
}

function normalizeSourceChain(
  value: unknown
): ProviderRegistrySourceChainEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  warnUnknownRegistrySourceChainStatuses({
    allowedStatuses: PROVIDER_REGISTRY_SOURCE_CHAIN_STATUSES,
    logger: sourceChainLogger,
    registryKind: 'provider registry',
    value,
  });

  return value
    .filter(isSourceChainEntry)
    .slice(0, SOURCE_CHAIN_MAX_ENTRIES)
    .map(entry => {
      const actorId = sourceChainString(entry.actorId);
      const fingerprint = sourceChainString(entry.fingerprint);
      const providerId = sourceChainString(entry.providerId);
      const providerType = isProviderType(entry.providerType)
        ? entry.providerType
        : undefined;
      const revision = sourceChainString(entry.revision);
      const updatedAt = sourceChainString(entry.updatedAt);
      const workspaceId = sourceChainString(entry.workspaceId);

      return {
        source: entry.source,
        scope: entry.scope,
        status: entry.status,
        ...(actorId ? { actorId } : {}),
        ...(fingerprint ? { fingerprint } : {}),
        ...(providerId ? { providerId } : {}),
        ...(providerType ? { providerType } : {}),
        ...(revision ? { revision } : {}),
        ...(updatedAt ? { updatedAt } : {}),
        ...(workspaceId ? { workspaceId } : {}),
      };
    });
}

function sourceChainString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed && trimmed.length <= SOURCE_CHAIN_OPTIONAL_STRING_MAX_LENGTH
    ? trimmed
    : undefined;
}

function stringsFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value
        .filter((item): item is string => {
          return (
            typeof item === 'string' &&
            item.trim().length > 0 &&
            item.trim().length <= REGISTRY_PAYLOAD_STRING_MAX_LENGTH
          );
        })
        .map(item => item.trim())
    ),
  ];
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized && normalized.length <= REGISTRY_PAYLOAD_STRING_MAX_LENGTH
    ? normalized
    : undefined;
}

function requireStringField(
  value: Record<string, unknown>,
  field: string
): string {
  const item = value[field];
  if (typeof item !== 'string') {
    throw new Error(
      `Invalid repair execution executor payload field: ${field}`
    );
  }
  const normalized = item.trim();
  if (!normalized || normalized.length > REGISTRY_PAYLOAD_STRING_MAX_LENGTH) {
    throw new Error(
      `Invalid repair execution executor payload field: ${field}`
    );
  }
  return normalized;
}

function requirePublishString(
  value: unknown,
  field: string,
  maxLength = REGISTRY_PAYLOAD_STRING_MAX_LENGTH
): string {
  if (typeof value !== 'string') {
    throw new Error(`Provider registry publish requires ${field}`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`Provider registry publish requires ${field}`);
  }
  return normalized;
}

function optionalPublishString(
  value: unknown,
  field: string
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`Provider registry publish contains invalid ${field}`);
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.length > REGISTRY_PAYLOAD_STRING_MAX_LENGTH) {
    throw new Error(`Provider registry publish contains invalid ${field}`);
  }
  return normalized;
}

function toRegistryMetadataJsonString(
  metadata: Record<string, unknown>
): string {
  const serialized = JSON.stringify(metadata);
  if (serialized.length > REGISTRY_METADATA_JSON_MAX_LENGTH) {
    throw new Error('Provider registry publish metadata is too large');
  }
  return serialized;
}

function requireRepairExecutionRequestId(value: unknown): string {
  return requirePublishString(
    value,
    'executionRequestId',
    REGISTRY_PAYLOAD_STRING_MAX_LENGTH - REPAIR_REVISION_PREFIX.length
  );
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function optionalPositiveInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function optionalNonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function sanitizeRouteOverride(
  value: unknown
):
  | NonNullable<
      NonNullable<CopilotModelDefinition['routeOverrides']>[keyof NonNullable<
        CopilotModelDefinition['routeOverrides']
      >]
    >
  | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const protocol = optionalString(record.protocol);
  const requestLayer = optionalString(record.requestLayer);
  return {
    ...(protocol && LLM_PROTOCOLS.has(protocol)
      ? { protocol: protocol as CopilotModelDefinition['protocol'] }
      : {}),
    ...(requestLayer && LLM_REQUEST_LAYERS.has(requestLayer)
      ? { requestLayer: requestLayer as CopilotModelDefinition['requestLayer'] }
      : {}),
  };
}

function sanitizeRouteOverrides(
  value: unknown
): CopilotModelDefinition['routeOverrides'] {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const outputTypes = new Set<string>(Object.values(ModelOutputType));
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => outputTypes.has(key))
    .map(([key, override]) => [key, sanitizeRouteOverride(override)] as const)
    .filter(
      (
        entry
      ): entry is readonly [
        string,
        NonNullable<ReturnType<typeof sanitizeRouteOverride>>,
      ] => {
        return !!entry[1] && Object.keys(entry[1]).length > 0;
      }
    );

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function sanitizeAttachmentCapability(
  value: unknown
): CopilotModelDefinitionCapability['attachments'] {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const kinds = stringsFromUnknown(record.kinds);
  if (!kinds.length) {
    return undefined;
  }

  return {
    kinds: kinds as NonNullable<
      CopilotModelDefinitionCapability['attachments']
    >['kinds'],
    ...(stringsFromUnknown(record.sourceKinds).length
      ? {
          sourceKinds: stringsFromUnknown(record.sourceKinds) as NonNullable<
            CopilotModelDefinitionCapability['attachments']
          >['sourceKinds'],
        }
      : {}),
    ...(optionalBoolean(record.allowRemoteUrls) !== undefined
      ? { allowRemoteUrls: optionalBoolean(record.allowRemoteUrls) }
      : {}),
  };
}

function sanitizeModelCapability(
  value: unknown
): CopilotModelDefinitionCapability | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const inputTypes = new Set<string>(Object.values(ModelInputType));
  const outputTypes = new Set<string>(Object.values(ModelOutputType));
  const input = stringsFromUnknown(record.input).filter(item =>
    inputTypes.has(item)
  ) as CopilotModelDefinitionCapability['input'];
  const output = stringsFromUnknown(record.output).filter(item =>
    outputTypes.has(item)
  ) as CopilotModelDefinitionCapability['output'];
  if (!input.length || !output.length) {
    return null;
  }

  const attachments = sanitizeAttachmentCapability(record.attachments);
  const structuredAttachments = sanitizeAttachmentCapability(
    record.structuredAttachments
  );

  return {
    input,
    output,
    ...(attachments ? { attachments } : {}),
    ...(structuredAttachments ? { structuredAttachments } : {}),
    ...(optionalBoolean(record.defaultForOutputType) !== undefined
      ? { defaultForOutputType: optionalBoolean(record.defaultForOutputType) }
      : {}),
  };
}

function sanitizeModelDefinition(value: unknown): CopilotModelDefinition {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid provider registry model definition');
  }

  const record = value as Record<string, unknown>;
  const id = optionalString(record.id);
  if (!id) {
    throw new Error('Provider registry model definition requires id');
  }

  const capabilities = Array.isArray(record.capabilities)
    ? record.capabilities
        .map(sanitizeModelCapability)
        .filter(
          (capability): capability is CopilotModelDefinitionCapability =>
            !!capability
        )
    : [];
  if (!capabilities.length) {
    throw new Error(
      `Provider registry model definition requires capabilities: ${id}`
    );
  }

  const limits =
    record.limits && typeof record.limits === 'object'
      ? {
          ...(optionalPositiveInt(
            (record.limits as Record<string, unknown>).contextWindow
          ) !== undefined
            ? {
                contextWindow: optionalPositiveInt(
                  (record.limits as Record<string, unknown>).contextWindow
                ),
              }
            : {}),
          ...(optionalPositiveInt(
            (record.limits as Record<string, unknown>).maxOutputTokens
          ) !== undefined
            ? {
                maxOutputTokens: optionalPositiveInt(
                  (record.limits as Record<string, unknown>).maxOutputTokens
                ),
              }
            : {}),
          ...(optionalPositiveInt(
            (record.limits as Record<string, unknown>).embeddingDimensions
          ) !== undefined
            ? {
                embeddingDimensions: optionalPositiveInt(
                  (record.limits as Record<string, unknown>).embeddingDimensions
                ),
              }
            : {}),
        }
      : undefined;
  const cost =
    record.cost && typeof record.cost === 'object'
      ? {
          ...(optionalNonNegativeNumber(
            (record.cost as Record<string, unknown>).inputPer1M
          ) !== undefined
            ? {
                inputPer1M: optionalNonNegativeNumber(
                  (record.cost as Record<string, unknown>).inputPer1M
                ),
              }
            : {}),
          ...(optionalNonNegativeNumber(
            (record.cost as Record<string, unknown>).outputPer1M
          ) !== undefined
            ? {
                outputPer1M: optionalNonNegativeNumber(
                  (record.cost as Record<string, unknown>).outputPer1M
                ),
              }
            : {}),
        }
      : undefined;
  const routeOverrides = sanitizeRouteOverrides(record.routeOverrides);
  const backendKind = optionalString(record.backendKind);
  const protocol = optionalString(record.protocol);
  const requestLayer = optionalString(record.requestLayer);

  return {
    id,
    ...(optionalString(record.rawModelId)
      ? { rawModelId: optionalString(record.rawModelId) }
      : {}),
    ...(optionalString(record.displayName)
      ? { displayName: optionalString(record.displayName) }
      : {}),
    ...(stringsFromUnknown(record.aliases).length
      ? { aliases: stringsFromUnknown(record.aliases) }
      : {}),
    ...(optionalBoolean(record.enabled) !== undefined
      ? { enabled: optionalBoolean(record.enabled) }
      : {}),
    ...(backendKind && MODEL_BACKEND_KINDS.has(backendKind)
      ? { backendKind: backendKind as CopilotModelDefinition['backendKind'] }
      : {}),
    ...(protocol && LLM_PROTOCOLS.has(protocol)
      ? { protocol: protocol as CopilotModelDefinition['protocol'] }
      : {}),
    ...(requestLayer && LLM_REQUEST_LAYERS.has(requestLayer)
      ? { requestLayer: requestLayer as CopilotModelDefinition['requestLayer'] }
      : {}),
    ...(routeOverrides
      ? {
          routeOverrides:
            routeOverrides as CopilotModelDefinition['routeOverrides'],
        }
      : {}),
    ...(stringsFromUnknown(record.behaviorFlags).length
      ? { behaviorFlags: stringsFromUnknown(record.behaviorFlags) }
      : {}),
    ...(limits && Object.keys(limits).length ? { limits } : {}),
    ...(cost && Object.keys(cost).length ? { cost } : {}),
    capabilities,
  };
}

function sanitizeModelDefinitions(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error('Provider registry modelDefinitions must be an array');
  }
  return value.map(sanitizeModelDefinition);
}

function normalizeHydratedModelDefinitions(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const modelDefinitions = value
    .map(item => {
      try {
        return sanitizeModelDefinition(item);
      } catch {
        return null;
      }
    })
    .filter((item): item is CopilotModelDefinition => item !== null);
  return modelDefinitions.length ? modelDefinitions : undefined;
}

function sanitizeRevision(value: unknown): string | undefined {
  const revision = optionalString(value);
  if (!revision) {
    return undefined;
  }
  if (revision.length > REGISTRY_PAYLOAD_STRING_MAX_LENGTH) {
    throw new Error('Provider registry revision is too long');
  }
  if (!/^[a-zA-Z0-9._:-]+$/.test(revision)) {
    throw new Error('Provider registry revision contains invalid characters');
  }
  return revision;
}

function sanitizeProviderProfile(
  input: ProviderRegistryPublishInput
): CopilotProviderProfile {
  const models =
    input.models === undefined || input.models === null
      ? undefined
      : stringsFromUnknown(input.models);
  const modelDefinitions = sanitizeModelDefinitions(input.modelDefinitions);

  return {
    id: input.providerId,
    type: input.providerType,
    source: 'db_revision',
    config: {},
    ...(optionalString(input.displayName)
      ? { displayName: optionalString(input.displayName) }
      : {}),
    ...(typeof input.priority === 'number' && Number.isFinite(input.priority)
      ? { priority: input.priority }
      : {}),
    ...(typeof input.enabled === 'boolean' ? { enabled: input.enabled } : {}),
    ...(isProviderPrivacy(input.privacy) ? { privacy: input.privacy } : {}),
    ...(models !== undefined ? { models } : {}),
    ...(modelDefinitions !== undefined ? { modelDefinitions } : {}),
  } as CopilotProviderProfile;
}

function normalizeRepairExecutorPayload(
  payload: unknown
): ProviderRegistryRepairExecutorPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid repair execution executor payload');
  }

  const record = payload as Record<string, unknown>;
  if (record.kind !== 'provider_registry_revision_publish') {
    throw new Error('Unsupported repair execution executor payload');
  }
  if (record.version !== 'provider-registry-revision-executor-payload/v1') {
    throw new Error('Unsupported repair execution executor payload version');
  }

  const providerType = record.providerType;
  if (!isProviderType(providerType)) {
    throw new Error(
      'Invalid repair execution executor payload field: providerType'
    );
  }

  return {
    version: 'provider-registry-revision-executor-payload/v1',
    kind: 'provider_registry_revision_publish',
    providerId: requireStringField(record, 'providerId'),
    providerType,
    ...(optionalString(record.displayName)
      ? { displayName: optionalString(record.displayName) }
      : {}),
    ...(optionalBoolean(record.enabled) !== undefined
      ? { enabled: optionalBoolean(record.enabled) }
      : {}),
    ...(Array.isArray(record.models)
      ? { models: stringsFromUnknown(record.models) }
      : {}),
    ...(record.modelDefinitions !== undefined
      ? { modelDefinitions: record.modelDefinitions }
      : {}),
    ...(isProviderPrivacy(record.privacy) ? { privacy: record.privacy } : {}),
    ...(typeof record.priority === 'number' && Number.isFinite(record.priority)
      ? { priority: record.priority }
      : {}),
    operationFingerprint: requireStringField(record, 'operationFingerprint'),
    operationSetFingerprint: requireStringField(
      record,
      'operationSetFingerprint'
    ),
    previewFingerprint: requireStringField(record, 'previewFingerprint'),
    catalogFingerprint: requireStringField(record, 'catalogFingerprint'),
    targetLocatorFingerprint: requireStringField(
      record,
      'targetLocatorFingerprint'
    ),
    candidateEvidenceFingerprints: stringsFromUnknown(
      record.candidateEvidenceFingerprints
    ),
    fallbackSourceChain: normalizeSourceChain(record.fallbackSourceChain),
  };
}

function normalizeProviderProfile(
  value: unknown,
  providerId: string,
  providerType?: CopilotProviderType
): CopilotProviderProfile {
  if (!value || typeof value !== 'object') {
    return {
      id: providerId,
      type: providerType ?? CopilotProviderType.OpenAICompatible,
      source: 'db_revision',
      config: {},
    } as CopilotProviderProfile;
  }

  const record = value as Partial<CopilotProviderProfile> &
    Record<string, unknown>;
  let serialized: string | null = null;
  try {
    serialized = JSON.stringify(record);
  } catch {
    serialized = null;
  }
  if (!serialized || serialized.length > PROVIDER_PROFILE_JSON_MAX_LENGTH) {
    return {
      id: providerId,
      type: providerType ?? CopilotProviderType.OpenAICompatible,
      source: 'db_revision',
      config: {},
    } as CopilotProviderProfile;
  }
  const type = isProviderType(record.type)
    ? record.type
    : (providerType ?? CopilotProviderType.OpenAICompatible);
  const source = isProviderSource(record.source)
    ? record.source
    : 'db_revision';
  const models = Array.isArray(record.models)
    ? stringsFromUnknown(record.models)
    : undefined;
  const modelDefinitions = normalizeHydratedModelDefinitions(
    record.modelDefinitions
  );

  return {
    ...(optionalString(record.displayName)
      ? { displayName: optionalString(record.displayName) }
      : {}),
    ...(typeof record.priority === 'number' && Number.isFinite(record.priority)
      ? { priority: record.priority }
      : {}),
    ...(typeof record.enabled === 'boolean' ? { enabled: record.enabled } : {}),
    ...(isProviderPrivacy(record.privacy) ? { privacy: record.privacy } : {}),
    ...(models ? { models } : {}),
    ...(modelDefinitions ? { modelDefinitions } : {}),
    id: providerId,
    type,
    source,
    config: {},
  } as CopilotProviderProfile;
}

function normalizeRevisionScopeType(
  value: unknown,
  workspaceId: string | null
): ProviderRegistryRevision['scopeType'] {
  if (
    typeof value === 'string' &&
    PROVIDER_REGISTRY_REVISION_SCOPE_TYPES.has(value)
  ) {
    return value as ProviderRegistryRevision['scopeType'];
  }
  return workspaceId ? 'workspace' : 'global';
}

function normalizeRevisionStatus(
  value: unknown
): ProviderRegistryRevision['status'] {
  if (
    typeof value === 'string' &&
    PROVIDER_REGISTRY_REVISION_STATUSES.has(value)
  ) {
    return value as ProviderRegistryRevision['status'];
  }
  return 'disabled';
}

function toRevision(
  row: ProviderRegistryRevisionRow
): ProviderRegistryRevision {
  const providerType = isProviderType(row.providerType)
    ? row.providerType
    : undefined;
  return {
    id: row.id,
    providerId: row.providerId,
    ...(providerType ? { providerType } : {}),
    scopeType: normalizeRevisionScopeType(row.scopeType, row.workspaceId),
    ...(row.workspaceId ? { workspaceId: row.workspaceId } : {}),
    ...(row.actorId ? { actorId: row.actorId } : {}),
    revision: row.revision,
    status: normalizeRevisionStatus(row.status),
    fingerprint: row.fingerprint,
    providerProfile: normalizeProviderProfile(
      row.providerProfile,
      row.providerId,
      providerType
    ),
    providerProfileSnapshot: row.providerProfile,
    fallbackSourceChain: normalizeSourceChain(row.fallbackSourceChain),
    fallbackSourceChainSnapshot: row.fallbackSourceChain,
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function providerRegistryRevisionJsonFingerprint(
  version: string,
  value: unknown
) {
  return providerRegistryRevisionFingerprint({ version, value });
}

function assertProviderRegistryRevisionMatchesConflictEvidence(
  revision: ProviderRegistryRevision,
  row: ProviderRegistryRevisionRow,
  expected: ProviderRegistryRevisionConflictEvidence
) {
  const providerProfileFingerprint = providerRegistryRevisionJsonFingerprint(
    'provider-registry-revision-provider-profile-conflict-evidence/v1',
    revision.providerProfile
  );
  const fallbackSourceChainFingerprint =
    providerRegistryRevisionJsonFingerprint(
      'provider-registry-revision-fallback-source-chain-conflict-evidence/v1',
      revision.fallbackSourceChain
    );
  const metadataFingerprint = providerRegistryRevisionJsonFingerprint(
    'provider-registry-revision-metadata-conflict-evidence/v1',
    row.metadata ?? {}
  );

  if (
    revision.id !== expected.id ||
    revision.providerId !== expected.providerId ||
    (revision.providerType ?? null) !== expected.providerType ||
    revision.scopeType !== expected.scopeType ||
    revision.workspaceId !== expected.workspaceId ||
    revision.actorId !== expected.actorId ||
    revision.revision !== expected.revision ||
    revision.status !== expected.status ||
    revision.fingerprint !== expected.fingerprint ||
    providerProfileFingerprint !== expected.providerProfileFingerprint ||
    fallbackSourceChainFingerprint !==
      expected.fallbackSourceChainFingerprint ||
    metadataFingerprint !== expected.metadataFingerprint
  ) {
    throw new Error(
      'Provider registry revision conflict reused mismatched row evidence'
    );
  }
}

@Injectable()
export class CopilotProviderRegistryRevisionModel extends BaseModel {
  @Transactional()
  async publishWorkspaceRevision(
    input: ProviderRegistryPublishInput
  ): Promise<ProviderRegistryRevisionPublishResult> {
    const workspaceId = requirePublishString(input.workspaceId, 'workspaceId');
    const actorId = requirePublishString(input.actorId, 'actorId');
    const providerId = requirePublishString(input.providerId, 'providerId');
    const idempotencyKey = optionalPublishString(
      input.idempotencyKey,
      'idempotencyKey'
    );

    return await this.publishWorkspaceRevisionRecord(
      {
        ...input,
        workspaceId,
        actorId,
        providerId,
        idempotencyKey,
      },
      {
        metadata: {
          version: 'provider-registry-revision-direct-publish/v1',
          publishSource: 'graphql_mutation',
          credentialBoundary: 'existing_configured_provider_runtime_reused',
          ...(idempotencyKey
            ? {
                idempotencyKeyFingerprint: providerRegistryRevisionFingerprint({
                  version: 'provider-registry-publish-idempotency-key/v1',
                  workspaceId,
                  providerId,
                  idempotencyKey,
                }),
              }
            : {}),
        },
      }
    );
  }

  @Transactional()
  async publishWorkspaceRepairRevision(input: {
    workspaceId: string;
    actorId: string;
    executionRequestId: string;
    requestFingerprint: string;
    candidateEvidenceSetFingerprint: string;
    taskRouteEvidenceSetFingerprint: string;
    repairJobFingerprint: string;
    approvalRecordFingerprint: string;
    payload: unknown;
  }): Promise<ProviderRegistryRevisionPublishResult> {
    const payload = normalizeRepairExecutorPayload(input.payload);
    const workspaceId = requirePublishString(input.workspaceId, 'workspaceId');
    const actorId = requirePublishString(input.actorId, 'actorId');
    const executionRequestId = requireRepairExecutionRequestId(
      input.executionRequestId
    );
    const requestFingerprint = requirePublishString(
      input.requestFingerprint,
      'requestFingerprint'
    );
    const candidateEvidenceSetFingerprint = requirePublishString(
      input.candidateEvidenceSetFingerprint,
      'candidateEvidenceSetFingerprint'
    );
    const taskRouteEvidenceSetFingerprint = requirePublishString(
      input.taskRouteEvidenceSetFingerprint,
      'taskRouteEvidenceSetFingerprint'
    );
    const repairJobFingerprint = requirePublishString(
      input.repairJobFingerprint,
      'repairJobFingerprint'
    );
    const approvalRecordFingerprint = requirePublishString(
      input.approvalRecordFingerprint,
      'approvalRecordFingerprint'
    );

    return await this.publishWorkspaceRevisionRecord(
      {
        workspaceId,
        actorId,
        providerId: payload.providerId,
        providerType: payload.providerType,
        revision: `repair-${executionRequestId}`,
        displayName: payload.displayName,
        enabled: payload.enabled,
        models: payload.models,
        modelDefinitions: payload.modelDefinitions,
        privacy: payload.privacy,
        priority: payload.priority,
        fallbackSourceChain: payload.fallbackSourceChain,
      },
      {
        id: `provider-registry-revision-${executionRequestId}`,
        metadata: {
          version: 'provider-registry-revision-repair-executor/v1',
          publishSource: 'repair_execution_worker',
          credentialBoundary: 'existing_configured_provider_runtime_reused',
          executionRequestId,
          requestFingerprint,
          candidateEvidenceSetFingerprint: candidateEvidenceSetFingerprint,
          taskRouteEvidenceSetFingerprint: taskRouteEvidenceSetFingerprint,
          repairJobFingerprint,
          approvalRecordFingerprint,
          operationFingerprint: payload.operationFingerprint,
          operationSetFingerprint: payload.operationSetFingerprint,
          previewFingerprint: payload.previewFingerprint,
          catalogFingerprint: payload.catalogFingerprint,
          targetLocatorFingerprint: payload.targetLocatorFingerprint,
          candidateEvidenceFingerprints: payload.candidateEvidenceFingerprints,
        },
      }
    );
  }

  private async publishWorkspaceRevisionRecord(
    input: ProviderRegistryPublishInput,
    options: {
      id?: string;
      metadata: Record<string, unknown>;
    }
  ): Promise<ProviderRegistryRevisionPublishResult> {
    const workspaceId = requirePublishString(input.workspaceId, 'workspaceId');
    const actorId = requirePublishString(input.actorId, 'actorId');
    const providerId = requirePublishString(input.providerId, 'providerId');
    const idempotencyKey = optionalPublishString(
      input.idempotencyKey,
      'idempotencyKey'
    );

    const providerProfile = sanitizeProviderProfile({
      ...input,
      providerId,
      idempotencyKey,
    });
    const fallbackSourceChain = normalizeSourceChain(
      input.fallbackSourceChain ?? []
    );
    const profileFingerprint = providerRegistryRevisionFingerprint({
      version: 'provider-registry-profile-metadata/v1',
      providerId,
      providerType: input.providerType,
      providerProfile,
      fallbackSourceChain,
    });
    const revision =
      sanitizeRevision(input.revision) ??
      `manual-${providerRegistryRevisionFingerprint({
        version: 'provider-registry-revision-id/v1',
        workspaceId,
        providerId,
        idempotencyKey: idempotencyKey ?? null,
        profileFingerprint,
      })}`;
    const fingerprint = providerRegistryRevisionFingerprint({
      version: 'provider-registry-revision-publish/v1',
      providerId,
      providerType: input.providerType,
      scopeType: 'workspace',
      workspaceId,
      actorId,
      revision,
      providerProfile,
      fallbackSourceChain,
    });
    const id =
      options.id ??
      `provider-registry-revision-${providerRegistryRevisionFingerprint({
        version: 'provider-registry-revision-row-id/v1',
        workspaceId,
        providerId,
        revision,
      })}`;
    const metadataWithFingerprint = {
      ...options.metadata,
      profileFingerprint,
    };
    const expectedConflictEvidence: ProviderRegistryRevisionConflictEvidence = {
      actorId,
      fallbackSourceChainFingerprint: providerRegistryRevisionJsonFingerprint(
        'provider-registry-revision-fallback-source-chain-conflict-evidence/v1',
        fallbackSourceChain
      ),
      fingerprint,
      id,
      metadataFingerprint: providerRegistryRevisionJsonFingerprint(
        'provider-registry-revision-metadata-conflict-evidence/v1',
        metadataWithFingerprint
      ),
      providerId,
      providerProfileFingerprint: providerRegistryRevisionJsonFingerprint(
        'provider-registry-revision-provider-profile-conflict-evidence/v1',
        providerProfile
      ),
      providerType: input.providerType ?? null,
      revision,
      scopeType: 'workspace',
      status: 'active',
      workspaceId,
    };
    const existingRow = await this.getWorkspaceRevisionRow({
      providerId,
      revision,
      workspaceId,
    });
    if (existingRow) {
      const existing = toRevision(existingRow);
      assertProviderRegistryRevisionMatchesConflictEvidence(
        existing,
        existingRow,
        expectedConflictEvidence
      );
      await createRegistryRevisionPublishEvent(this.db, {
        actorId,
        eventType: 'revision_reused',
        metadata: {
          profileFingerprint,
          providerId,
        },
        publishSource: String(options.metadata.publishSource) as
          | 'graphql_mutation'
          | 'repair_execution_worker',
        registryFamily: 'provider_registry',
        registryKey: providerId,
        registryProviderId: providerId,
        revision: existing.revision,
        revisionContent: existing.providerProfileSnapshot,
        revisionFallbackSourceChain: existing.fallbackSourceChainSnapshot,
        revisionFingerprint: existing.fingerprint,
        revisionId: existing.id,
        revisionMetadata: existing.metadata,
        revisionStatus: existing.status,
        revisionUpdatedAt: existing.updatedAt,
        scopeType: existing.scopeType,
        workspaceId: existing.workspaceId,
      });
      return await this.withImmediateProviderHealthProbeAttempt(
        await withRegistryRevisionPublishEventHistory(this.db, existing)
      );
    }

    const now = new Date();
    const metadataJson = toRegistryMetadataJsonString(metadataWithFingerprint);

    const insertedRows = await this.db.$queryRaw<Array<{ id: string }>>`
      INSERT INTO ai_provider_registry_revisions (
        id,
        provider_id,
        provider_type,
        scope_type,
        workspace_id,
        actor_id,
        revision,
        status,
        fingerprint,
        provider_profile,
        fallback_source_chain,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        ${id},
        ${providerId},
        ${input.providerType},
        ${'workspace'},
        ${workspaceId},
        ${actorId},
        ${revision},
        ${'active'},
        ${fingerprint},
        ${JSON.stringify(providerProfile)}::jsonb,
        ${JSON.stringify(fallbackSourceChain)}::jsonb,
        ${metadataJson}::jsonb,
        ${now},
        ${now}
      )
      ON CONFLICT ("provider_id", "workspace_id", "revision")
      WHERE "scope_type" = 'workspace' AND "workspace_id" IS NOT NULL
      DO NOTHING
      RETURNING id
    `;

    const createdRow = await this.getWorkspaceRevisionRow({
      providerId,
      revision,
      workspaceId,
    });
    const created = createdRow ? toRevision(createdRow) : null;
    if (!created) {
      throw new Error(`Created provider registry revision not found: ${id}`);
    }
    if (!createdRow) {
      throw new Error(
        `Created provider registry revision row not found: ${id}`
      );
    }
    assertProviderRegistryRevisionMatchesConflictEvidence(
      created,
      createdRow,
      expectedConflictEvidence
    );
    const revisionWasInserted = insertedRows.length > 0;
    await createRegistryRevisionPublishEvent(this.db, {
      actorId,
      ...(revisionWasInserted ? { createdAt: created.createdAt } : {}),
      eventType: revisionWasInserted ? 'revision_published' : 'revision_reused',
      metadata: {
        profileFingerprint,
        providerId,
      },
      publishSource: String(options.metadata.publishSource) as
        | 'graphql_mutation'
        | 'repair_execution_worker',
      registryFamily: 'provider_registry',
      registryKey: providerId,
      registryProviderId: providerId,
      revision: created.revision,
      revisionContent: created.providerProfileSnapshot,
      revisionFallbackSourceChain: created.fallbackSourceChainSnapshot,
      revisionFingerprint: created.fingerprint,
      revisionId: created.id,
      revisionMetadata: created.metadata,
      revisionStatus: created.status,
      revisionUpdatedAt: created.updatedAt,
      scopeType: created.scopeType,
      workspaceId: created.workspaceId,
    });
    return await this.withImmediateProviderHealthProbeAttempt(
      await withRegistryRevisionPublishEventHistory(this.db, created)
    );
  }

  private async withImmediateProviderHealthProbeAttempt<
    T extends ProviderRegistryRevision & RegistryRevisionPublishEventHistory,
  >(
    revision: T
  ): Promise<
    T & {
      providerHealthProbeAttempt?: CopilotProviderHealthProbeAttemptRecord;
    }
  > {
    if (revision.scopeType !== 'workspace' || !revision.workspaceId) {
      return revision;
    }

    const providerHealthProbeAttempt =
      await this.models.copilotProviderHealthState.enqueueWorkspaceProviderHealthProbeAttempt(
        {
          revision,
        }
      );

    return {
      ...revision,
      providerHealthProbeAttempt,
    };
  }

  async listLatestActiveByProviderIds(input: {
    providerIds: string[];
    workspaceId?: string | null;
  }): Promise<Map<string, ProviderRegistryRevision>> {
    const providerIds = [...new Set(input.providerIds)].filter(Boolean);
    if (!providerIds.length) {
      return new Map();
    }

    const rows = input.workspaceId
      ? await this.db.$queryRaw<ProviderRegistryRevisionRow[]>`
          SELECT DISTINCT ON (provider_id)
            id,
            provider_id AS "providerId",
            provider_type AS "providerType",
            scope_type AS "scopeType",
            workspace_id AS "workspaceId",
            actor_id AS "actorId",
            revision,
            status,
            fingerprint,
            provider_profile AS "providerProfile",
            fallback_source_chain AS "fallbackSourceChain",
            metadata,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM ai_provider_registry_revisions
          WHERE provider_id = ANY(${providerIds})
            AND status = 'active'
            AND (
              (scope_type = 'workspace' AND workspace_id = ${input.workspaceId})
              OR (scope_type = 'global' AND workspace_id IS NULL)
            )
          ORDER BY
            provider_id ASC,
            CASE WHEN scope_type = 'workspace' THEN 0 ELSE 1 END ASC,
            created_at DESC,
            id DESC
        `
      : await this.db.$queryRaw<ProviderRegistryRevisionRow[]>`
          SELECT DISTINCT ON (provider_id)
            id,
            provider_id AS "providerId",
            provider_type AS "providerType",
            scope_type AS "scopeType",
            workspace_id AS "workspaceId",
            actor_id AS "actorId",
            revision,
            status,
            fingerprint,
            provider_profile AS "providerProfile",
            fallback_source_chain AS "fallbackSourceChain",
            metadata,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM ai_provider_registry_revisions
          WHERE provider_id = ANY(${providerIds})
            AND status = 'active'
            AND scope_type = 'global'
            AND workspace_id IS NULL
          ORDER BY provider_id ASC, created_at DESC, id DESC
        `;

    return new Map(
      rows.map(row => {
        const revision = toRevision(row);
        return [revision.providerId, revision] as const;
      })
    );
  }

  async listLatestActiveWithPublishEventsByProviderIds(input: {
    providerIds: string[];
    workspaceId?: string | null;
  }): Promise<
    Map<string, ProviderRegistryRevision & RegistryRevisionPublishEventHistory>
  > {
    const revisionsByProvider = await this.listLatestActiveByProviderIds(input);
    const entries = await Promise.all(
      [...revisionsByProvider.entries()].map(async ([providerId, revision]) => {
        const history = await getRegistryRevisionPublishEventHistory(
          this.db,
          revision.id
        );
        return [
          providerId,
          {
            ...revision,
            ...history,
          },
        ] as const;
      })
    );

    return new Map(entries);
  }

  async listActiveWorkspaceProviderHealthProbeTargets(
    input: {
      limit?: number;
    } = {}
  ): Promise<ProviderRegistryRevision[]> {
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
    const rows = await this.db.$queryRaw<ProviderRegistryRevisionRow[]>`
      SELECT
        id,
        provider_id AS "providerId",
        provider_type AS "providerType",
        scope_type AS "scopeType",
        workspace_id AS "workspaceId",
        actor_id AS "actorId",
        revision,
        status,
        fingerprint,
        provider_profile AS "providerProfile",
        fallback_source_chain AS "fallbackSourceChain",
        metadata,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM ai_provider_registry_revisions
      WHERE status = ${'active'}
        AND scope_type = ${'workspace'}
        AND workspace_id IS NOT NULL
        AND actor_id IS NOT NULL
      ORDER BY updated_at ASC, created_at ASC, provider_id ASC, id ASC
      LIMIT ${limit}
    `;

    return rows.map(toRevision);
  }

  async resolve(
    workspaceId: string | null | undefined,
    providerId: string
  ): Promise<ProviderRegistryRevision | null> {
    const revisionsByProvider = await this.listLatestActiveByProviderIds({
      providerIds: [providerId],
      workspaceId,
    });
    return revisionsByProvider.get(providerId) ?? null;
  }

  private async getWorkspaceRevisionRow(input: {
    providerId: string;
    revision: string;
    workspaceId: string;
  }): Promise<ProviderRegistryRevisionRow | null> {
    const rows = await this.db.$queryRaw<ProviderRegistryRevisionRow[]>`
      SELECT
        id,
        provider_id AS "providerId",
        provider_type AS "providerType",
        scope_type AS "scopeType",
        workspace_id AS "workspaceId",
        actor_id AS "actorId",
        revision,
        status,
        fingerprint,
        provider_profile AS "providerProfile",
        fallback_source_chain AS "fallbackSourceChain",
        metadata,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM ai_provider_registry_revisions
      WHERE provider_id = ${input.providerId}
        AND scope_type = 'workspace'
        AND workspace_id = ${input.workspaceId}
        AND revision = ${input.revision}
      LIMIT 1
    `;

    return rows[0] ?? null;
  }
}
