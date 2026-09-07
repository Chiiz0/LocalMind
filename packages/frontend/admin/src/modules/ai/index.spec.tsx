/**
 * @vitest-environment happy-dom
 */
import { createHash } from 'node:crypto';

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
  replayCopilotSupportBundleTransferForwardingEventMutation,
  requestCopilotPromptRegistryRepairExecutionMutation,
  retryCopilotProviderHealthProbeAttemptMutation,
  updateAppConfigMutation,
} from '@affine/graphql';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const mutateMock = vi.fn();
const requestRepairExecutionMock = vi.fn();
const decideRepairExecutionApprovalMock = vi.fn();
const controlRepairExecutionMock = vi.fn();
const controlAgentRuntimeRunMock = vi.fn();
const createSupportBundleMock = vi.fn();
const authorizeSupportBundleDownloadMock = vi.fn();
const cleanupSupportBundleRetentionMock = vi.fn();
const replaySupportBundleTransferForwardingEventMock = vi.fn();
const retryProviderHealthProbeAttemptMock = vi.fn();
const updateAppConfigMock = vi.fn();
const writeTextMock = vi.fn();
const createObjectURLMock = vi.fn();
const revokeObjectURLMock = vi.fn();
const anchorClickMock = vi.fn();
const windowOpenMock = vi.fn();

function stableFixtureStringify(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableFixtureStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => {
        const item = (value as Record<string, unknown>)[key];
        return item === undefined
          ? null
          : `${JSON.stringify(key)}:${stableFixtureStringify(item)}`;
      })
      .filter(Boolean)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function stripNullishFixtureFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripNullishFixtureFields);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== null && item !== undefined)
        .map(([key, item]) => [key, stripNullishFixtureFields(item)])
    );
  }
  return value;
}

function repairExecutionAuditEventsFixture(
  eventTypes: string[],
  executionRequestId = 'repair-execution-1'
) {
  return eventTypes.map((eventType, index) => ({
    actorId: 'user-1',
    createdAt: `2026-06-20T09:${String(index).padStart(2, '0')}:00.000Z`,
    eventFingerprint: `audit-${eventType.replaceAll('_', '-')}-${index}`,
    eventType,
    executionRequestId,
    id: `${executionRequestId}-audit-${index}`,
    metadata: {
      version: 'repair-execution-audit-event-fixture/v1',
    },
    workspaceId: 'workspace-1',
  }));
}

const taskRouteEffectiveSourceFingerprintInputsFixture = [
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
  'topK',
];
const taskRouteEffectiveSourceFingerprintVersionFixture =
  'copilot-task-route-effective-source/v1';
const taskRouteEffectiveSourceEvidenceSetFingerprintInputsFixture = [
  'diagnosticsFingerprint',
  'operationFingerprint',
  'taskRouteEffectiveSourceFingerprints',
];
const taskRouteEffectiveSourceEvidenceSetFingerprintVersionFixture =
  'copilot-task-route-effective-source-evidence-set/v1';
const candidateEvidenceReferenceSchemaVersionFixture =
  'prompt-registry-repair-candidate-evidence-reference/v1';
const candidateEvidenceReferenceSchemaFieldsFixture = [
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
];
const candidateEvidenceReferenceSchemaFingerprintInputsFixture = [
  'candidateEvidenceReferenceSchemaFields',
  'candidateEvidenceReferenceSchemaVersion',
];
const candidateEvidenceReferenceSchemaRegistryStatusFixture =
  'not_persisted_read_only';
const candidateEvidenceReferenceSchemaArtifactStatusFixture =
  'not_created_read_only';
const candidateEvidenceReferenceSchemaFingerprintFixture = createHash('sha256')
  .update(
    stableFixtureStringify({
      candidateEvidenceReferenceSchemaFields: [
        ...candidateEvidenceReferenceSchemaFieldsFixture,
      ],
      candidateEvidenceReferenceSchemaVersion:
        candidateEvidenceReferenceSchemaVersionFixture,
    })
  )
  .digest('hex')
  .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactFingerprintFixture = createHash(
  'sha256'
)
  .update(
    stableFixtureStringify({
      artifactStatus: candidateEvidenceReferenceSchemaArtifactStatusFixture,
      registryStatus: candidateEvidenceReferenceSchemaRegistryStatusFixture,
      schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
      schemaVersion: candidateEvidenceReferenceSchemaVersionFixture,
    })
  )
  .digest('hex')
  .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactFingerprintInputsFixture = [
  'artifactStatus',
  'registryStatus',
  'schemaFingerprint',
  'schemaVersion',
];
const candidateEvidenceReferenceSchemaArtifactRecordStatusFixture =
  'not_created_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        artifactFingerprint:
          candidateEvidenceReferenceSchemaArtifactFingerprintFixture,
        artifactStatus: candidateEvidenceReferenceSchemaArtifactStatusFixture,
        recordStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordFingerprintInputsFixture = [
  'artifactFingerprint',
  'artifactStatus',
  'recordStatus',
  'schemaFingerprint',
];
const candidateEvidenceReferenceSchemaArtifactRecordPersistenceStatusFixture =
  'not_persisted_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        persistenceStatus:
          candidateEvidenceReferenceSchemaArtifactRecordPersistenceStatusFixture,
        recordFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordFingerprintFixture,
        recordStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprintInputsFixture =
  [
    'persistenceStatus',
    'recordFingerprint',
    'recordStatus',
    'schemaFingerprint',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageStatusFixture =
  'not_allocated_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        recordFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordFingerprintFixture,
        recordStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
        storageStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageStatusFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprintInputsFixture =
  ['recordFingerprint', 'recordStatus', 'schemaFingerprint', 'storageStatus'];
const candidateEvidenceReferenceSchemaArtifactRecordStorageBackendStatusFixture =
  'not_selected_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        backendStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageBackendStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
        storageFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprintFixture,
        storageStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageStatusFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprintInputsFixture =
  ['backendStatus', 'schemaFingerprint', 'storageFingerprint', 'storageStatus'];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectStatusFixture =
  'not_materialized_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        backendFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprintFixture,
        objectStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
        storageFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprintInputsFixture =
  [
    'backendFingerprint',
    'objectStatus',
    'schemaFingerprint',
    'storageFingerprint',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionStatusFixture =
  'not_included_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        archiveInclusionStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionStatusFixture,
        objectFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprintFixture,
        objectStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintInputsFixture =
  [
    'archiveInclusionStatus',
    'objectFingerprint',
    'objectStatus',
    'schemaFingerprint',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryStatusFixture =
  'not_created_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        archiveInclusionFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintFixture,
        manifestEntryStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryStatusFixture,
        objectFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprintFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintInputsFixture =
  [
    'archiveInclusionFingerprint',
    'manifestEntryStatus',
    'objectFingerprint',
    'schemaFingerprint',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceStatusFixture =
  'not_persisted_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        manifestEntryFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintFixture,
        manifestEntryPersistenceStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceStatusFixture,
        manifestEntryStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputsFixture =
  [
    'manifestEntryFingerprint',
    'manifestEntryPersistenceStatus',
    'manifestEntryStatus',
    'schemaFingerprint',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStatusFixture =
  'not_created_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        manifestEntryPersistenceFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintFixture,
        manifestEntryPersistenceRecordStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStatusFixture,
        manifestEntryPersistenceStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputsFixture =
  [
    'manifestEntryPersistenceFingerprint',
    'manifestEntryPersistenceRecordStatus',
    'manifestEntryPersistenceStatus',
    'schemaFingerprint',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatusFixture =
  'not_allocated_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        persistenceRecordFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintFixture,
        persistenceRecordStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
        storageStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatusFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputsFixture =
  [
    'persistenceRecordFingerprint',
    'persistenceRecordStatus',
    'schemaFingerprint',
    'storageStatus',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatusFixture =
  'not_selected_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        backendStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
        storageFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintFixture,
        storageStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatusFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputsFixture =
  ['backendStatus', 'schemaFingerprint', 'storageFingerprint', 'storageStatus'];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatusFixture =
  'not_materialized_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        backendFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintFixture,
        objectStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
        storageFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputsFixture =
  [
    'backendFingerprint',
    'objectStatus',
    'schemaFingerprint',
    'storageFingerprint',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatusFixture =
  'not_included_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        archiveInclusionStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatusFixture,
        objectFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintFixture,
        objectStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputsFixture =
  [
    'archiveInclusionStatus',
    'objectFingerprint',
    'objectStatus',
    'schemaFingerprint',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatusFixture =
  'not_created_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        archiveInclusionFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintFixture,
        manifestEntryStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatusFixture,
        objectFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputsFixture =
  [
    'archiveInclusionFingerprint',
    'manifestEntryStatus',
    'objectFingerprint',
    'schemaFingerprint',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatusFixture =
  'not_persisted_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        manifestEntryFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintFixture,
        manifestEntryPersistenceStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatusFixture,
        manifestEntryStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputsFixture =
  [
    'manifestEntryFingerprint',
    'manifestEntryPersistenceStatus',
    'manifestEntryStatus',
    'schemaFingerprint',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatusFixture =
  'not_created_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        manifestEntryPersistenceFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintFixture,
        manifestEntryPersistenceRecordStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatusFixture,
        manifestEntryPersistenceStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputsFixture =
  [
    'manifestEntryPersistenceFingerprint',
    'manifestEntryPersistenceRecordStatus',
    'manifestEntryPersistenceStatus',
    'schemaFingerprint',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatusFixture =
  'not_allocated_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        persistenceRecordFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintFixture,
        persistenceRecordStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
        storageStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatusFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputsFixture =
  [
    'persistenceRecordFingerprint',
    'persistenceRecordStatus',
    'schemaFingerprint',
    'storageStatus',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatusFixture =
  'not_selected_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        backendStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
        storageFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintFixture,
        storageStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatusFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputsFixture =
  ['backendStatus', 'schemaFingerprint', 'storageFingerprint', 'storageStatus'];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatusFixture =
  'not_materialized_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        backendFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintFixture,
        objectStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
        storageFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputsFixture =
  [
    'backendFingerprint',
    'objectStatus',
    'schemaFingerprint',
    'storageFingerprint',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatusFixture =
  'not_included_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        archiveInclusionStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatusFixture,
        objectFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintFixture,
        objectStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputsFixture =
  [
    'archiveInclusionStatus',
    'objectFingerprint',
    'objectStatus',
    'schemaFingerprint',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatusFixture =
  'not_created_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        archiveInclusionFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintFixture,
        manifestEntryStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatusFixture,
        objectFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputsFixture =
  [
    'archiveInclusionFingerprint',
    'manifestEntryStatus',
    'objectFingerprint',
    'schemaFingerprint',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatusFixture =
  'not_persisted_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        manifestEntryFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintFixture,
        manifestEntryPersistenceStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatusFixture,
        manifestEntryStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputsFixture =
  [
    'manifestEntryFingerprint',
    'manifestEntryPersistenceStatus',
    'manifestEntryStatus',
    'schemaFingerprint',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatusFixture =
  'not_created_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        manifestEntryPersistenceFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintFixture,
        manifestEntryPersistenceRecordStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatusFixture,
        manifestEntryPersistenceStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputsFixture =
  [
    'manifestEntryPersistenceFingerprint',
    'manifestEntryPersistenceRecordStatus',
    'manifestEntryPersistenceStatus',
    'schemaFingerprint',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatusFixture =
  'not_allocated_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        persistenceRecordFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintFixture,
        persistenceRecordStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
        storageStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatusFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputsFixture =
  [
    'persistenceRecordFingerprint',
    'persistenceRecordStatus',
    'schemaFingerprint',
    'storageStatus',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatusFixture =
  'not_selected_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        backendStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
        storageFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintFixture,
        storageStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatusFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputsFixture =
  ['backendStatus', 'schemaFingerprint', 'storageFingerprint', 'storageStatus'];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatusFixture =
  'not_materialized_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        backendFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintFixture,
        objectStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
        storageFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputsFixture =
  [
    'backendFingerprint',
    'objectStatus',
    'schemaFingerprint',
    'storageFingerprint',
  ];
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatusFixture =
  'not_included_read_only';
const candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintFixture =
  createHash('sha256')
    .update(
      stableFixtureStringify({
        archiveInclusionStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatusFixture,
        objectFingerprint:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintFixture,
        objectStatus:
          candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatusFixture,
        schemaFingerprint: candidateEvidenceReferenceSchemaFingerprintFixture,
      })
    )
    .digest('hex')
    .slice(0, 16);

function candidateEvidenceCategoryFromKeyFixture(key?: string) {
  if (!key) {
    return null;
  }

  const trimmedKey = key.trim();
  if (trimmedKey.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmedKey);
      if (Array.isArray(parsed)) {
        return parsed[0] === 'policy' ? 'policy' : 'route';
      }
    } catch {
      return null;
    }
  }

  return key.split(':')[0] || null;
}

function candidateEvidenceClassificationSummaryFixture(
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
        // Keep opaque keys as anchors without inventing classifications.
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

  const candidateEvidenceCategories = Array.from(new Set(categories)).sort();

  return {
    candidateEvidenceCategoryCount: candidateEvidenceCategories.length,
    candidateEvidenceCategories,
    candidateEvidenceProviderIds: Array.from(new Set(providerIds)).sort(),
    candidateEvidenceScopes: Array.from(new Set(scopes)).sort(),
  };
}

function candidateEvidenceReferenceEntriesFixture(
  candidateEvidence: Array<{
    candidateFingerprint: string;
    candidateIndex: number;
    candidateKey?: string;
    preparedRouteOrderFingerprint?: string | null;
    preparedRoutes?: Array<{
      behaviorFlags?: string[] | null;
      canonicalModelKey?: string | null;
      dimensionMismatch?: boolean | null;
      fallbackOrderIndex?: number | null;
      modelBackendKind?: string | null;
      modelEmbeddingDimensions?: number | null;
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
      routeIndex: number;
    }> | null;
    policyCandidates?: Array<{
      allowed: boolean;
      available: boolean;
      health: string;
      healthCheckedAt?: string | null;
      privacy: string;
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
      registryAvailable?: boolean | null;
      registryKind?: string | null;
      registrySelected?: boolean | null;
      reasons: string[];
    }> | null;
    prepareCandidates?: Array<{
      candidateModelIds?: string[] | null;
      costInputPer1M?: number | null;
      costOutputPer1M?: number | null;
      errorCategory?: string | null;
      errorCode?: string | null;
      health?: string | null;
      healthCheckedAt?: string | null;
      modelId?: string | null;
      prepared: boolean;
      preparedModelId?: string | null;
      privacy?: string | null;
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
      reasons: string[];
      registryAvailable?: boolean | null;
      registryKind?: string | null;
      registrySelected?: boolean | null;
      requestedModelId?: string | null;
      routeAttachmentAllowRemoteUrls?: boolean | null;
      routeAttachmentKinds?: string[] | null;
      routeAttachmentSourceKinds?: string[] | null;
      routeModelAliasMatched?: boolean | null;
      routeModelDefinitionAliases?: string[] | null;
      routeModelDefinitionId?: string | null;
      routeModelDefinitionSource?: string | null;
      routeRawModelId?: string | null;
      routeStructuredAttachmentAllowRemoteUrls?: boolean | null;
      routeStructuredAttachmentKinds?: string[] | null;
      routeStructuredAttachmentSourceKinds?: string[] | null;
    }> | null;
    providerId: string;
    routeCandidates?: Array<{
      candidateModelIds?: string[] | null;
      costInputPer1M?: number | null;
      costOutputPer1M?: number | null;
      health?: string | null;
      healthCheckedAt?: string | null;
      matched: boolean;
      modelId?: string | null;
      privacy?: string | null;
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
      reasons: string[];
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
      routeOutputTypes?: string[] | null;
      routeRawModelId?: string | null;
      routeStructuredAttachmentAllowRemoteUrls?: boolean | null;
      routeStructuredAttachmentKinds?: string[] | null;
      routeStructuredAttachmentSourceKinds?: string[] | null;
    }> | null;
    scope: string;
    taskRouteEffectiveSourceFingerprint?: string | null;
    taskRouteModelSourceSnapshotEntries?: Array<{
      featureKind: string;
      requestedModelConfigKey?: string | null;
      requestedModelConfigPath?: string | null;
      requestedModelId?: string | null;
      requestedModelSource?: string | null;
    }> | null;
    taskRouteModelSourceSnapshotFingerprint?: string | null;
  }>
) {
  return candidateEvidence
    .map(candidate => ({
      candidateEvidenceCategory: candidateEvidenceCategoryFromKeyFixture(
        candidate.candidateKey
      ),
      candidateEvidenceFingerprint: candidate.candidateFingerprint,
      candidateEvidenceKey: candidate.candidateKey ?? null,
      candidateEvidenceProviderId: candidate.providerId,
      candidateEvidenceScope: candidate.scope,
      candidateIndex: candidate.candidateIndex,
      preparedRouteOrderFingerprint:
        candidate.preparedRouteOrderFingerprint ?? null,
      preparedRouteEntries: candidate.preparedRoutes ?? null,
      policyCandidateEntries: candidate.policyCandidates ?? null,
      prepareCandidateEntries: candidate.prepareCandidates ?? null,
      routeCandidateEntries: candidate.routeCandidates ?? null,
      taskRouteEffectiveSourceFingerprint:
        candidate.taskRouteEffectiveSourceFingerprint ?? null,
      taskRouteModelSourceSnapshotEntries:
        candidate.taskRouteModelSourceSnapshotEntries ?? null,
      taskRouteModelSourceSnapshotFingerprint:
        candidate.taskRouteModelSourceSnapshotFingerprint ?? null,
    }))
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
}

function candidateEvidenceFixture<T extends Record<string, unknown>>(
  evidence: T
) {
  const { prepareCandidates, ...fingerprintedEvidence } = evidence;
  const candidateFingerprint = createHash('sha256')
    .update(
      stableFixtureStringify(stripNullishFixtureFields(fingerprintedEvidence))
    )
    .digest('hex')
    .slice(0, 16);

  return {
    candidateFingerprint,
    ...fingerprintedEvidence,
    ...(prepareCandidates !== undefined ? { prepareCandidates } : {}),
    ...(evidence.taskRouteEffectiveSourceFingerprint
      ? {
          taskRouteEffectiveSourceFingerprintInputs: [
            ...taskRouteEffectiveSourceFingerprintInputsFixture,
          ],
          taskRouteEffectiveSourceFingerprintVersion:
            taskRouteEffectiveSourceFingerprintVersionFixture,
        }
      : {}),
  };
}

function taskRouteTargetFingerprintFixture(input: {
  featureKind: string;
  targets: string[];
}) {
  return createHash('sha256')
    .update(stableFixtureStringify(input))
    .digest('hex')
    .slice(0, 16);
}

function taskRouteSnapshotFingerprintFixture(candidates: unknown) {
  return createHash('sha256')
    .update(stableFixtureStringify(candidates))
    .digest('hex')
    .slice(0, 16);
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
      stableFixtureStringify({
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
      stableFixtureStringify({
        version: 'agent-runtime-timeline-route-evidence-set/v1',
        routeEvidenceFingerprints,
      })
    )
    .digest('hex')
    .slice(0, 16);
}

function taskRoutePrepareCandidateSnapshotFixture<
  T extends {
    candidateModelIds?: string[] | null;
    costInputPer1M?: number | null;
    costOutputPer1M?: number | null;
    errorCategory?: string | null;
    errorCode?: string | null;
    health?: string | null;
    healthCheckedAt?: string | null;
    modelId?: string | null;
    prepared: boolean;
    preparedModelId?: string | null;
    privacy?: string | null;
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
    reasons: string[];
    registryAvailable?: boolean | null;
    registryKind?: string | null;
    registrySelected?: boolean | null;
    requestedModelId?: string | null;
    routeAttachmentAllowRemoteUrls?: boolean | null;
    routeAttachmentKinds?: string[] | null;
    routeAttachmentSourceKinds?: string[] | null;
    routeModelAliasMatched?: boolean | null;
    routeModelDefinitionAliases?: string[] | null;
    routeModelDefinitionId?: string | null;
    routeModelDefinitionSource?: string | null;
    routeStructuredAttachmentAllowRemoteUrls?: boolean | null;
    routeStructuredAttachmentKinds?: string[] | null;
    routeStructuredAttachmentSourceKinds?: string[] | null;
    routeRawModelId?: string | null;
  },
>(candidates: T[]) {
  return candidates.map(candidate =>
    stripNullishFixtureFields({
      candidateModelIds: candidate.candidateModelIds,
      costInputPer1M: candidate.costInputPer1M,
      costOutputPer1M: candidate.costOutputPer1M,
      errorCategory: candidate.errorCategory,
      errorCode: candidate.errorCode,
      health: candidate.health,
      healthCheckedAt: candidate.healthCheckedAt,
      modelId: candidate.modelId,
      prepared: candidate.prepared,
      preparedModelId: candidate.preparedModelId,
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
      requestedModelId: candidate.requestedModelId,
      routeAttachmentAllowRemoteUrls: candidate.routeAttachmentAllowRemoteUrls,
      routeAttachmentKinds: candidate.routeAttachmentKinds,
      routeAttachmentSourceKinds: candidate.routeAttachmentSourceKinds,
      routeModelAliasMatched: candidate.routeModelAliasMatched,
      routeModelDefinitionAliases: candidate.routeModelDefinitionAliases,
      routeModelDefinitionId: candidate.routeModelDefinitionId,
      routeModelDefinitionSource: candidate.routeModelDefinitionSource,
      routeStructuredAttachmentAllowRemoteUrls:
        candidate.routeStructuredAttachmentAllowRemoteUrls,
      routeStructuredAttachmentKinds: candidate.routeStructuredAttachmentKinds,
      routeStructuredAttachmentSourceKinds:
        candidate.routeStructuredAttachmentSourceKinds,
      routeRawModelId: candidate.routeRawModelId,
    })
  );
}

function taskRoutePreparedRouteSnapshotFixture<
  T extends {
    behaviorFlags?: string[] | null;
    canonicalModelKey?: string | null;
    dimensionMismatch?: boolean | null;
    fallbackOrderIndex?: number | null;
    modelBackendKind?: string | null;
    modelEmbeddingDimensions?: number | null;
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
    requestLayer?: string | null;
    requestedDimensions?: number | null;
    routeIndex?: number | null;
  },
>(routes: T[]) {
  return routes.map(route =>
    stripNullishFixtureFields({
      behaviorFlags: route.behaviorFlags?.length
        ? route.behaviorFlags
        : undefined,
      canonicalModelKey: route.canonicalModelKey,
      dimensionMismatch: route.dimensionMismatch,
      fallbackOrderIndex: route.fallbackOrderIndex,
      modelBackendKind: route.modelBackendKind,
      modelEmbeddingDimensions: route.modelEmbeddingDimensions,
      modelId: route.modelId,
      protocol: route.protocol,
      providerConfiguredModelCount: route.providerConfiguredModelCount,
      providerConfiguredModelIds: route.providerConfiguredModelIds?.length
        ? route.providerConfiguredModelIds
        : undefined,
      providerId: route.providerId,
      providerName: route.providerName,
      providerPriority: route.providerPriority,
      providerProfileConfigPath: route.providerProfileConfigPath,
      providerProfileId: route.providerProfileId,
      providerProfileSource: route.providerProfileSource,
      providerSource: route.providerSource,
      providerType: route.providerType,
      requestLayer: route.requestLayer,
      requestedDimensions: route.requestedDimensions,
      routeIndex: route.routeIndex,
    })
  );
}

function taskRoutePreparedRouteOrderSnapshotFixture<
  T extends {
    fallbackOrderIndex?: number | null;
    modelId: string;
    providerId: string;
    routeIndex?: number | null;
  },
>(routes: T[]) {
  return routes.map(route =>
    stripNullishFixtureFields({
      fallbackOrderIndex: route.fallbackOrderIndex,
      modelId: route.modelId,
      providerId: route.providerId,
      routeIndex: route.routeIndex,
    })
  );
}

function taskRouteDimensionSnapshotFixture(route: {
  dimensionMismatch?: boolean | null;
  featureKind: string;
  modelEmbeddingDimensions?: number | null;
  modelId?: string | null;
  preparedRoutes: {
    dimensionMismatch?: boolean | null;
    modelEmbeddingDimensions?: number | null;
    modelId: string;
    providerId: string;
    requestedDimensions?: number | null;
    routeIndex?: number | null;
  }[];
  providerId?: string | null;
  requestedDimensions?: number | null;
  requestedModelId?: string | null;
}) {
  const preparedRoutes = route.preparedRoutes.map(route =>
    stripNullishFixtureFields({
      dimensionMismatch: route.dimensionMismatch,
      modelEmbeddingDimensions: route.modelEmbeddingDimensions,
      modelId: route.modelId,
      providerId: route.providerId,
      requestedDimensions: route.requestedDimensions,
      routeIndex: route.routeIndex,
    })
  );

  return stripNullishFixtureFields({
    dimensionMismatch: route.dimensionMismatch,
    featureKind: route.featureKind,
    modelEmbeddingDimensions: route.modelEmbeddingDimensions,
    modelId: route.modelId,
    preparedRoutes,
    providerId: route.providerId,
    requestedDimensions: route.requestedDimensions,
    requestedModelId: route.requestedModelId,
  });
}

function taskRouteEmbeddingIndexContractSnapshotFixture(route: {
  embeddingIndexContractDimensions?: number | null;
  embeddingIndexContractFingerprint?: string | null;
  embeddingIndexContractStatus?: string | null;
  embeddingIndexContractVersion?: string | null;
  featureKind: string;
  modelEmbeddingDimensions?: number | null;
  modelId?: string | null;
  providerId?: string | null;
  requestedDimensions?: number | null;
  requestedModelId?: string | null;
}) {
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

function taskRouteRerankRuntimeContractSnapshotFixture(route: {
  candidateCount?: number | null;
  featureKind: string;
  modelId?: string | null;
  preparedProviderCount?: number | null;
  providerId?: string | null;
  requestedModelId?: string | null;
  rerankRuntimeContractFingerprint?: string | null;
  rerankRuntimeContractStatus?: string | null;
  rerankRuntimeContractTopK?: number | null;
  rerankRuntimeContractVersion?: string | null;
}) {
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

function taskRouteModelSourceSnapshotFixture(route: {
  featureKind: string;
  requestedModelConfigKey?: string | null;
  requestedModelConfigPath?: string | null;
  requestedModelId?: string | null;
  requestedModelSource?: string | null;
}) {
  return [
    stripNullishFixtureFields({
      featureKind: route.featureKind,
      requestedModelConfigKey: route.requestedModelConfigKey,
      requestedModelConfigPath: route.requestedModelConfigPath,
      requestedModelId: route.requestedModelId,
      requestedModelSource: route.requestedModelSource,
    }),
  ];
}

function taskRouteProviderHealthSnapshotFixture(route: {
  policyCandidates: {
    health?: string | null;
    healthCheckedAt?: string | null;
    modelId?: string | null;
    preparedModelId?: string | null;
    providerId: string;
    providerProfileConfigPath?: string | null;
    providerProfileId?: string | null;
    providerProfileSource?: string | null;
    providerSource?: string | null;
    providerType?: string | null;
    requestedModelId?: string | null;
  }[];
  routeCandidates: {
    health?: string | null;
    healthCheckedAt?: string | null;
    modelId?: string | null;
    preparedModelId?: string | null;
    providerId: string;
    providerProfileConfigPath?: string | null;
    providerProfileId?: string | null;
    providerProfileSource?: string | null;
    providerSource?: string | null;
    providerType?: string | null;
    requestedModelId?: string | null;
  }[];
  prepareCandidates: {
    health?: string | null;
    healthCheckedAt?: string | null;
    modelId?: string | null;
    preparedModelId?: string | null;
    providerId: string;
    providerProfileConfigPath?: string | null;
    providerProfileId?: string | null;
    providerProfileSource?: string | null;
    providerSource?: string | null;
    providerType?: string | null;
    requestedModelId?: string | null;
  }[];
}) {
  const healthCandidate = (
    scope: string,
    candidate: {
      health?: string | null;
      healthCheckedAt?: string | null;
      modelId?: string | null;
      preparedModelId?: string | null;
      providerId: string;
      providerProfileConfigPath?: string | null;
      providerProfileId?: string | null;
      providerProfileSource?: string | null;
      providerSource?: string | null;
      providerType?: string | null;
      requestedModelId?: string | null;
    },
    index: number
  ) =>
    stripNullishFixtureFields({
      candidateIndex: index,
      health: candidate.health,
      healthCheckedAt: candidate.healthCheckedAt,
      modelId: candidate.modelId,
      preparedModelId: candidate.preparedModelId,
      providerId: candidate.providerId,
      providerProfileConfigPath: candidate.providerProfileConfigPath,
      providerProfileId: candidate.providerProfileId,
      providerProfileSource: candidate.providerProfileSource,
      providerSource: candidate.providerSource,
      providerType: candidate.providerType,
      requestedModelId: candidate.requestedModelId,
      scope,
    });

  return [
    ...route.policyCandidates.map((candidate, index) =>
      healthCandidate('policyCandidate', candidate, index)
    ),
    ...route.routeCandidates.map((candidate, index) =>
      healthCandidate('routeCandidate', candidate, index)
    ),
    ...route.prepareCandidates.map((candidate, index) =>
      healthCandidate('prepareCandidate', candidate, index)
    ),
  ];
}

function taskRouteProviderCostSnapshotFixture(route: {
  routeCandidates: {
    costInputPer1M?: number | null;
    costOutputPer1M?: number | null;
    modelId?: string | null;
    preparedModelId?: string | null;
    providerId: string;
    providerProfileConfigPath?: string | null;
    providerProfileId?: string | null;
    providerProfileSource?: string | null;
    providerSource?: string | null;
    providerType?: string | null;
    requestedModelId?: string | null;
    routeModelDefinitionId?: string | null;
    routeModelDefinitionSource?: string | null;
    routeRawModelId?: string | null;
  }[];
  prepareCandidates: {
    costInputPer1M?: number | null;
    costOutputPer1M?: number | null;
    modelId?: string | null;
    preparedModelId?: string | null;
    providerId: string;
    providerProfileConfigPath?: string | null;
    providerProfileId?: string | null;
    providerProfileSource?: string | null;
    providerSource?: string | null;
    providerType?: string | null;
    requestedModelId?: string | null;
    routeModelDefinitionId?: string | null;
    routeModelDefinitionSource?: string | null;
    routeRawModelId?: string | null;
  }[];
}) {
  const costCandidate = (
    scope: string,
    candidate: {
      costInputPer1M?: number | null;
      costOutputPer1M?: number | null;
      modelId?: string | null;
      preparedModelId?: string | null;
      providerId: string;
      providerProfileConfigPath?: string | null;
      providerProfileId?: string | null;
      providerProfileSource?: string | null;
      providerSource?: string | null;
      providerType?: string | null;
      requestedModelId?: string | null;
      routeModelDefinitionId?: string | null;
      routeModelDefinitionSource?: string | null;
      routeRawModelId?: string | null;
    },
    index: number
  ) =>
    stripNullishFixtureFields({
      candidateIndex: index,
      costInputPer1M: candidate.costInputPer1M,
      costOutputPer1M: candidate.costOutputPer1M,
      modelId: candidate.modelId,
      preparedModelId: candidate.preparedModelId,
      providerId: candidate.providerId,
      providerProfileConfigPath: candidate.providerProfileConfigPath,
      providerProfileId: candidate.providerProfileId,
      providerProfileSource: candidate.providerProfileSource,
      providerSource: candidate.providerSource,
      providerType: candidate.providerType,
      requestedModelId: candidate.requestedModelId,
      routeModelDefinitionId: candidate.routeModelDefinitionId,
      routeModelDefinitionSource: candidate.routeModelDefinitionSource,
      routeRawModelId: candidate.routeRawModelId,
      scope,
    });

  return [
    ...route.routeCandidates.map((candidate, index) =>
      costCandidate('routeCandidate', candidate, index)
    ),
    ...route.prepareCandidates.map((candidate, index) =>
      costCandidate('prepareCandidate', candidate, index)
    ),
  ];
}

function taskRouteProviderLimitSnapshotFixture(route: {
  routeCandidates: {
    modelId?: string | null;
    preparedModelId?: string | null;
    providerId: string;
    providerProfileConfigPath?: string | null;
    providerProfileId?: string | null;
    providerProfileSource?: string | null;
    providerSource?: string | null;
    providerType?: string | null;
    requestedModelId?: string | null;
    routeContextWindow?: number | null;
    routeEmbeddingDimensions?: number | null;
    routeMaxOutputTokens?: number | null;
    routeModelDefinitionId?: string | null;
    routeModelDefinitionSource?: string | null;
    routeRawModelId?: string | null;
  }[];
  prepareCandidates: {
    modelId?: string | null;
    preparedModelId?: string | null;
    providerId: string;
    providerProfileConfigPath?: string | null;
    providerProfileId?: string | null;
    providerProfileSource?: string | null;
    providerSource?: string | null;
    providerType?: string | null;
    requestedModelId?: string | null;
    routeContextWindow?: number | null;
    routeEmbeddingDimensions?: number | null;
    routeMaxOutputTokens?: number | null;
    routeModelDefinitionId?: string | null;
    routeModelDefinitionSource?: string | null;
    routeRawModelId?: string | null;
  }[];
}) {
  const limitCandidate = (
    scope: string,
    candidate: {
      modelId?: string | null;
      preparedModelId?: string | null;
      providerId: string;
      providerProfileConfigPath?: string | null;
      providerProfileId?: string | null;
      providerProfileSource?: string | null;
      providerSource?: string | null;
      providerType?: string | null;
      requestedModelId?: string | null;
      routeContextWindow?: number | null;
      routeEmbeddingDimensions?: number | null;
      routeMaxOutputTokens?: number | null;
      routeModelDefinitionId?: string | null;
      routeModelDefinitionSource?: string | null;
      routeRawModelId?: string | null;
    },
    index: number
  ) =>
    stripNullishFixtureFields({
      candidateIndex: index,
      modelId: candidate.modelId,
      preparedModelId: candidate.preparedModelId,
      providerId: candidate.providerId,
      providerProfileConfigPath: candidate.providerProfileConfigPath,
      providerProfileId: candidate.providerProfileId,
      providerProfileSource: candidate.providerProfileSource,
      providerSource: candidate.providerSource,
      providerType: candidate.providerType,
      requestedModelId: candidate.requestedModelId,
      routeContextWindow: candidate.routeContextWindow,
      routeEmbeddingDimensions: candidate.routeEmbeddingDimensions,
      routeMaxOutputTokens: candidate.routeMaxOutputTokens,
      routeModelDefinitionId: candidate.routeModelDefinitionId,
      routeModelDefinitionSource: candidate.routeModelDefinitionSource,
      routeRawModelId: candidate.routeRawModelId,
      scope,
    });

  return [
    ...route.routeCandidates.map((candidate, index) =>
      limitCandidate('routeCandidate', candidate, index)
    ),
    ...route.prepareCandidates.map((candidate, index) =>
      limitCandidate('prepareCandidate', candidate, index)
    ),
  ];
}

function taskRouteProviderCapabilitySnapshotFixture(route: {
  routeCandidates: {
    modelId?: string | null;
    preparedModelId?: string | null;
    providerId: string;
    providerProfileConfigPath?: string | null;
    providerProfileId?: string | null;
    providerProfileSource?: string | null;
    providerSource?: string | null;
    providerType?: string | null;
    requestedModelId?: string | null;
    routeAttachmentAllowRemoteUrls?: boolean | null;
    routeAttachmentKinds?: string[] | null;
    routeAttachmentSourceKinds?: string[] | null;
    routeInputTypes?: string[] | null;
    routeModelDefinitionId?: string | null;
    routeModelDefinitionSource?: string | null;
    routeOutputTypes?: string[] | null;
    routeStructuredAttachmentAllowRemoteUrls?: boolean | null;
    routeStructuredAttachmentKinds?: string[] | null;
    routeStructuredAttachmentSourceKinds?: string[] | null;
    routeRawModelId?: string | null;
  }[];
  prepareCandidates: {
    modelId?: string | null;
    preparedModelId?: string | null;
    providerId: string;
    providerProfileConfigPath?: string | null;
    providerProfileId?: string | null;
    providerProfileSource?: string | null;
    providerSource?: string | null;
    providerType?: string | null;
    requestedModelId?: string | null;
    routeAttachmentAllowRemoteUrls?: boolean | null;
    routeAttachmentKinds?: string[] | null;
    routeAttachmentSourceKinds?: string[] | null;
    routeInputTypes?: string[] | null;
    routeModelDefinitionId?: string | null;
    routeModelDefinitionSource?: string | null;
    routeOutputTypes?: string[] | null;
    routeStructuredAttachmentAllowRemoteUrls?: boolean | null;
    routeStructuredAttachmentKinds?: string[] | null;
    routeStructuredAttachmentSourceKinds?: string[] | null;
    routeRawModelId?: string | null;
  }[];
}) {
  const capabilityCandidate = (
    scope: string,
    candidate: {
      modelId?: string | null;
      preparedModelId?: string | null;
      providerId: string;
      providerProfileConfigPath?: string | null;
      providerProfileId?: string | null;
      providerProfileSource?: string | null;
      providerSource?: string | null;
      providerType?: string | null;
      requestedModelId?: string | null;
      routeAttachmentAllowRemoteUrls?: boolean | null;
      routeAttachmentKinds?: string[] | null;
      routeAttachmentSourceKinds?: string[] | null;
      routeInputTypes?: string[] | null;
      routeModelDefinitionId?: string | null;
      routeModelDefinitionSource?: string | null;
      routeOutputTypes?: string[] | null;
      routeStructuredAttachmentAllowRemoteUrls?: boolean | null;
      routeStructuredAttachmentKinds?: string[] | null;
      routeStructuredAttachmentSourceKinds?: string[] | null;
      routeRawModelId?: string | null;
    },
    index: number
  ) =>
    stripNullishFixtureFields({
      candidateIndex: index,
      modelId: candidate.modelId,
      preparedModelId: candidate.preparedModelId,
      providerId: candidate.providerId,
      providerProfileConfigPath: candidate.providerProfileConfigPath,
      providerProfileId: candidate.providerProfileId,
      providerProfileSource: candidate.providerProfileSource,
      providerSource: candidate.providerSource,
      providerType: candidate.providerType,
      requestedModelId: candidate.requestedModelId,
      routeAttachmentAllowRemoteUrls: candidate.routeAttachmentAllowRemoteUrls,
      routeAttachmentKinds: candidate.routeAttachmentKinds,
      routeAttachmentSourceKinds: candidate.routeAttachmentSourceKinds,
      routeInputTypes: candidate.routeInputTypes,
      routeModelDefinitionId: candidate.routeModelDefinitionId,
      routeModelDefinitionSource: candidate.routeModelDefinitionSource,
      routeOutputTypes: candidate.routeOutputTypes,
      routeStructuredAttachmentAllowRemoteUrls:
        candidate.routeStructuredAttachmentAllowRemoteUrls,
      routeStructuredAttachmentKinds: candidate.routeStructuredAttachmentKinds,
      routeStructuredAttachmentSourceKinds:
        candidate.routeStructuredAttachmentSourceKinds,
      routeRawModelId: candidate.routeRawModelId,
      scope,
    });

  return [
    ...route.routeCandidates.map((candidate, index) =>
      capabilityCandidate('routeCandidate', candidate, index)
    ),
    ...route.prepareCandidates.map((candidate, index) =>
      capabilityCandidate('prepareCandidate', candidate, index)
    ),
  ];
}

function expectQueryCall(query: unknown, variables: Record<string, unknown>) {
  expect(useQueryMock).toHaveBeenCalledWith(
    expect.objectContaining({
      query,
      variables,
    })
  );
}

function hasQueryCall(query: unknown) {
  return useQueryMock.mock.calls.some(([options]) =>
    Boolean(options && (options as { query?: unknown }).query === query)
  );
}

vi.mock('@affine/admin/use-query', () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock('@affine/admin/use-mutation', () => ({
  useMutation: (...args: unknown[]) => useMutationMock(...args),
}));

vi.mock('../header', () => ({
  Header: ({ title, endFix }: { title: string; endFix?: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {endFix}
    </div>
  ),
}));

vi.mock('./workspace-byok', () => ({
  WorkspaceByokAdmin: () => <div>Workspace AI credentials</div>,
}));

vi.mock('./project-byok', () => ({
  ProjectByokAdmin: () => <div>Global Project BYOK</div>,
}));

import { AiPage } from './index';

function renderAiPage(initialPath = '/admin/ai/runtime') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AiPage />
    </MemoryRouter>
  );
}

const routeTrace = [
  {
    availableCount: 1,
    blockedCount: 0,
    candidateCount: 1,
    matchedCount: 1,
    phase: 'policy',
    preparedCount: 0,
    reasons: ['candidate_allowed'],
    selectedCount: 1,
  },
  {
    availableCount: 1,
    blockedCount: 0,
    candidateCount: 1,
    matchedCount: 0,
    phase: 'resolution',
    preparedCount: 0,
    reasons: ['no_profile_model_match'],
    selectedCount: 0,
  },
];

const standaloneAgentRunPayload = {
  actorId: 'user-1',
  completedAt: null,
  createdAt: '2026-06-20T09:10:00.000Z',
  evidenceFingerprint: 'agent-evidence-standalone',
  executionResultCount: 0,
  executionResults: [],
  failureCode: null,
  failureMessage: null,
  id: 'agent-run-standalone',
  lastAttemptAt: '2026-06-20T09:10:00.000Z',
  queuedAt: '2026-06-20T09:10:00.000Z',
  sourceId: 'standalone-run-1',
  sourceType: 'agent_runtime_manual',
  startedAt: '2026-06-20T09:10:00.000Z',
  status: 'running',
  targetFingerprint: 'agent-target-standalone',
  timelineFingerprint: 'agent-timeline-standalone',
  title: 'Standalone runtime run',
  updatedAt: '2026-06-20T09:11:00.000Z',
  workerAttempt: 1,
  workerLeaseExpiresAt: '2026-06-20T09:15:00.000Z',
  workerLeaseId: 'agent-runtime-worker-fixture',
  workerMaxAttempts: 1,
  workflow: 'office_task_runtime',
  workspaceId: 'workspace-1',
  steps: [
    {
      actorId: 'user-1',
      completedAt: null,
      createdAt: '2026-06-20T09:10:00.000Z',
      evidenceFingerprint: 'agent-step-evidence-standalone',
      id: 'agent-step-standalone',
      order: 0,
      outputSummary: {
        toolName: 'workspace-search',
        version: 'agent-runtime-step-output-summary/v1',
      },
      runId: 'agent-run-standalone',
      startedAt: '2026-06-20T09:10:00.000Z',
      status: 'running',
      stepKey: 'tool_lookup',
      stepType: 'tool',
      title: 'Workspace lookup',
      updatedAt: '2026-06-20T09:11:00.000Z',
      workspaceId: 'workspace-1',
    },
  ],
  timelineEvents: [
    {
      actorId: 'user-1',
      createdAt: '2026-06-20T09:10:00.000Z',
      eventFingerprint: 'agent-event-standalone-1',
      eventType: 'run_status',
      id: 'agent-event-standalone-1',
      ordinal: 0,
      payload: {
        sourceId: 'standalone-run-1',
        sourceType: 'agent_runtime_manual',
        workflow: 'office_task_runtime',
      },
      runId: 'agent-run-standalone',
      status: 'running',
      stepId: null,
      summary: 'Agent runtime run running',
      workspaceId: 'workspace-1',
    },
    {
      actorId: 'user-1',
      createdAt: '2026-06-20T09:10:00.000Z',
      eventFingerprint: 'agent-event-standalone-2',
      eventType: 'tool_step',
      id: 'agent-event-standalone-2',
      ordinal: 1,
      payload: {
        sourceId: 'standalone-run-1',
        sourceType: 'agent_runtime_manual',
        stepKey: 'tool_lookup',
        stepType: 'tool',
        workflow: 'office_task_runtime',
      },
      runId: 'agent-run-standalone',
      status: 'running',
      stepId: 'agent-step-standalone',
      summary: 'Agent runtime tool step running',
      workspaceId: 'workspace-1',
    },
  ],
};

const completedAgentRunPayload = {
  actorId: 'user-1',
  completedAt: '2026-06-20T09:30:00.000Z',
  createdAt: '2026-06-20T09:20:00.000Z',
  evidenceFingerprint: 'agent-evidence-completed',
  executionResultCount: 1,
  executionResults: [
    {
      actorId: 'user-1',
      adapterWorkflow: 'agent_runtime_record_only',
      completedAt: '2026-06-20T09:30:00.000Z',
      createdAt: '2026-06-20T09:30:00.000Z',
      executor: 'agent_runtime_record_only_adapter',
      failureCode: null,
      failureMessage: null,
      id: 'agent-runtime-execution-result-1',
      resultFingerprint: 'agentresult1111',
      resultPayload: {
        resultStatus: 'completed',
        sideEffectsApplied: false,
        summary: 'Record-only Agent Runtime adapter completed.',
        version: 'agent-runtime-worker-execution-result/v1',
      },
      resultStatus: 'completed',
      runId: 'agent-run-completed',
      sideEffectMode: 'none',
      sideEffectsApplied: false,
      sourceId: 'completed-run-1',
      sourceType: 'agent_runtime_manual',
      summary: 'Record-only Agent Runtime adapter completed.',
      workerAttempt: 1,
      workerLeaseId: 'agent-runtime-completed-worker',
      workflow: 'agent_runtime_record_only',
      workspaceId: 'workspace-1',
    },
  ],
  failureCode: null,
  failureMessage: null,
  id: 'agent-run-completed',
  lastAttemptAt: '2026-06-20T09:29:00.000Z',
  queuedAt: '2026-06-20T09:20:00.000Z',
  sourceId: 'completed-run-1',
  sourceType: 'agent_runtime_manual',
  startedAt: '2026-06-20T09:20:00.000Z',
  status: 'completed',
  targetFingerprint: 'agent-target-completed',
  timelineFingerprint: 'agent-timeline-completed',
  title: 'Completed runtime run',
  updatedAt: '2026-06-20T09:30:00.000Z',
  workerAttempt: 1,
  workerLeaseExpiresAt: null,
  workerLeaseId: null,
  workerMaxAttempts: 1,
  workflow: 'agent_runtime_record_only',
  workspaceId: 'workspace-1',
  steps: [
    {
      actorId: 'user-1',
      completedAt: '2026-06-20T09:30:00.000Z',
      createdAt: '2026-06-20T09:20:00.000Z',
      evidenceFingerprint: 'agent-step-evidence-completed',
      id: 'agent-step-completed',
      order: 0,
      outputSummary: {
        recordOnlyExecution: {
          executor: 'agent_runtime_record_only_adapter',
          sideEffectsApplied: false,
          summary: 'Record-only Agent Runtime adapter completed.',
          version: 'agent-runtime-record-only-execution/v1',
          workerAttempt: 1,
          workerLeaseId: 'agent-runtime-completed-worker',
        },
      },
      runId: 'agent-run-completed',
      startedAt: '2026-06-20T09:20:00.000Z',
      status: 'completed',
      stepKey: 'record_context',
      stepType: 'model',
      title: 'Record context',
      updatedAt: '2026-06-20T09:30:00.000Z',
      workspaceId: 'workspace-1',
    },
  ],
  timelineEvents: [
    {
      actorId: 'user-1',
      createdAt: '2026-06-20T09:30:00.000Z',
      eventFingerprint: 'agent-event-completed-1',
      eventType: 'run_status',
      id: 'agent-event-completed-1',
      ordinal: 0,
      payload: {
        sourceId: 'completed-run-1',
        sourceType: 'agent_runtime_manual',
        workflow: 'agent_runtime_record_only',
      },
      runId: 'agent-run-completed',
      status: 'completed',
      stepId: null,
      summary: 'Agent runtime record-only worker completed standalone run',
      workspaceId: 'workspace-1',
    },
  ],
};

const blockedRoute = {
  behaviorFlags: [],
  candidateCount: 1,
  canonicalModelKey: null,
  configured: false,
  diagnosticsErrors: [
    {
      code: 'EmbeddingPrepareDiagnosticsFailure',
      message: 'embedding prepare diagnostics unavailable',
      stage: 'describe_embedding_prepare_candidates',
    },
  ],
  dimensionMismatch: false,
  effectiveSourceFingerprint: 'blocked1111222233',
  effectiveSourceFingerprintInputs: [
    'featureKind',
    'preparedRoutes',
    'routeCandidates',
  ],
  effectiveSourceFingerprintVersion: 'copilot-task-route-effective-source/v1',
  embeddingIndexContractDimensions: 4096,
  embeddingIndexContractFingerprint: 'eeee1111dddd2222',
  embeddingIndexContractStatus: 'compatible_with_current_pgvector_index',
  embeddingIndexContractVersion: 'workspace-embedding-index/v2',
  errorCode: 'no_provider_available',
  errorMessage: 'No provider is configured for embedding.',
  fallbackProviderIds: ['ollama-main', 'openai-fallback'],
  featureKind: 'workspace_indexing',
  modelBackendKind: null,
  modelEmbeddingDimensions: null,
  modelId: null,
  policyAllowedPrivacy: ['local'],
  policyAllowedProviderIds: [],
  policyBlockedProviderIds: [],
  policyEnabled: true,
  policyFeatureKind: 'workspace_indexing',
  policyPreferredPrivacy: ['local'],
  policyWorkspaceId: null,
  policyCandidates: [
    {
      allowed: true,
      available: false,
      candidateFingerprint: 'abcd1234efef5678',
      candidateKey: 'policy:workspace_indexing:global:ollama-main',
      health: 'down',
      healthCheckedAt: '2026-06-16T10:00:00.000Z',
      privacy: 'local',
      providerId: 'ollama-main',
      providerName: 'Local Ollama',
      providerProfileConfigPath: 'workspace.byok.local',
      providerProfileId: 'ollama-main',
      providerProfileSource: 'byok_local',
      providerConfiguredModelIds: ['workspace-embedding', 'nomic-embed-text'],
      providerConfiguredModelCount: 2,
      providerSource: 'byok_local',
      providerPriority: 10,
      providerType: 'openaiCompatible',
      reasons: ['provider_unavailable'],
    },
  ],
  routeCandidates: [
    {
      candidateKey: 'route:ollama-main',
      candidateModelIds: ['nomic-embed-text'],
      matched: false,
      modelId: null,
      providerId: 'ollama-main',
      providerName: 'Local Ollama',
      providerSource: 'byok_local',
      providerProfileId: 'ollama-main',
      providerProfileSource: 'byok_local',
      providerProfileConfigPath: 'workspace.byok.local',
      providerConfiguredModelIds: ['workspace-embedding', 'nomic-embed-text'],
      providerConfiguredModelCount: 2,
      providerType: 'openaiCompatible',
      providerPriority: 10,
      privacy: 'local',
      health: 'down',
      healthCheckedAt: '2026-06-16T10:00:00.000Z',
      costInputPer1M: 0.01,
      costOutputPer1M: 0.02,
      routeContextWindow: 8192,
      routeMaxOutputTokens: 1024,
      routeEmbeddingDimensions: 768,
      routeInputTypes: ['text'],
      routeOutputTypes: ['embedding'],
      routeAttachmentKinds: ['file'],
      routeAttachmentSourceKinds: ['url', 'data'],
      routeAttachmentAllowRemoteUrls: true,
      routeStructuredAttachmentKinds: ['image'],
      routeStructuredAttachmentSourceKinds: ['file_handle'],
      routeStructuredAttachmentAllowRemoteUrls: false,
      routeRawModelId: 'nomic-embed-text',
      routeModelDefinitionSource: 'provider_profile',
      routeModelDefinitionId: 'workspace-embedding',
      routeModelDefinitionAliases: ['nomic-embed-text'],
      routeModelAliasMatched: false,
      reasons: ['no_profile_model_match'],
      registryAvailable: true,
      registryKind: 'byok',
      registrySelected: false,
      requestedModelId: 'workspace-embedding',
    },
  ],
  routeTrace,
  prepareCandidates: [
    {
      candidateKey: 'route:ollama-main',
      candidateModelIds: ['nomic-embed-text'],
      errorCategory: 'network',
      errorCode: 'prepare_failed',
      modelId: null,
      prepared: false,
      preparedModelId: null,
      providerId: 'ollama-main',
      providerName: 'Local Ollama',
      providerSource: 'byok_local',
      providerProfileId: 'ollama-main',
      providerProfileSource: 'byok_local',
      providerProfileConfigPath: 'workspace.byok.local',
      providerConfiguredModelIds: ['workspace-embedding', 'nomic-embed-text'],
      providerConfiguredModelCount: 2,
      providerType: 'openaiCompatible',
      providerPriority: 10,
      privacy: 'local',
      health: 'down',
      healthCheckedAt: '2026-06-16T10:00:00.000Z',
      costInputPer1M: 0.01,
      costOutputPer1M: 0.02,
      routeContextWindow: 8192,
      routeMaxOutputTokens: 1024,
      routeEmbeddingDimensions: 768,
      routeInputTypes: ['text'],
      routeOutputTypes: ['embedding'],
      routeAttachmentKinds: ['file'],
      routeAttachmentSourceKinds: ['url', 'data'],
      routeAttachmentAllowRemoteUrls: true,
      routeStructuredAttachmentKinds: ['image'],
      routeStructuredAttachmentSourceKinds: ['file_handle'],
      routeStructuredAttachmentAllowRemoteUrls: false,
      routeRawModelId: 'nomic-embed-text',
      routeModelDefinitionSource: 'provider_profile',
      routeModelDefinitionId: 'workspace-embedding',
      routeModelDefinitionAliases: ['nomic-embed-text'],
      routeModelAliasMatched: false,
      reasons: ['prepared_route_filtered', 'provider_prepare_network_error'],
      registryAvailable: true,
      registryKind: 'byok',
      registrySelected: false,
      requestedModelId: 'workspace-embedding',
    },
    {
      candidateKey: 'prepare:openai-fallback',
      candidateModelIds: ['text-embedding-3-large'],
      modelId: 'text-embedding-3-large',
      prepared: false,
      preparedModelId: null,
      providerId: 'openai-fallback',
      providerName: 'OpenAI Fallback',
      providerSource: 'configured',
      providerType: 'openai',
      privacy: 'private_cloud',
      health: 'degraded',
      costInputPer1M: 0.13,
      costOutputPer1M: 0.13,
      routeInputTypes: ['text'],
      routeOutputTypes: ['embedding'],
      routeAttachmentKinds: ['file'],
      routeAttachmentSourceKinds: ['url'],
      routeAttachmentAllowRemoteUrls: true,
      reasons: ['provider_prepare_returned_empty'],
      registryAvailable: true,
      registryKind: 'quota_backed',
      registrySelected: false,
      requestedModelId: 'workspace-embedding',
    },
  ],
  preparedProviderCount: 0,
  preparedRouteTargets: [],
  preparedRouteTargetFingerprint: taskRouteTargetFingerprintFixture({
    featureKind: 'workspace_indexing',
    targets: [],
  }),
  preparedRoutes: [],
  providerId: null,
  protocol: null,
  requestedModelConfigKey: 'workspaceIndexing',
  requestedModelConfigPath: 'copilot.tasks.models.workspaceIndexing',
  requestedModelId: 'workspace-embedding',
  requestedModelSource: 'workspace_indexing',
  requestedDimensions: 4096,
  requestLayer: null,
  topK: null,
};

const readyRoute = {
  ...blockedRoute,
  configured: true,
  diagnosticsErrors: [],
  effectiveSourceFingerprint: 'ready444455556666',
  errorCode: null,
  errorMessage: null,
  fallbackProviderIds: ['ollama-main'],
  featureKind: 'rerank',
  embeddingIndexContractDimensions: null,
  embeddingIndexContractFingerprint: null,
  embeddingIndexContractStatus: null,
  embeddingIndexContractVersion: null,
  modelId: 'bge-reranker-v2',
  rerankRuntimeContractFingerprint: 'eeee2222ffff3333',
  rerankRuntimeContractStatus: 'prepared_route_available',
  rerankRuntimeContractTopK: 5,
  rerankRuntimeContractVersion: 'workspace-rerank-runtime/v1',
  policyCandidates: [
    {
      allowed: true,
      available: true,
      candidateKey: 'policy:rerank:global:ollama-main',
      health: 'healthy',
      privacy: 'local',
      providerId: 'ollama-main',
      providerName: 'Local Ollama',
      providerProfileConfigPath: 'copilot.providers.profiles[id=ollama-main]',
      providerProfileId: 'ollama-main',
      providerProfileSource: 'configured',
      providerConfiguredModelIds: ['workspace-rerank', 'bge-reranker-v2'],
      providerConfiguredModelCount: 2,
      providerSource: 'configured',
      providerPriority: 10,
      providerType: 'openaiCompatible',
      reasons: ['candidate_allowed'],
    },
  ],
  routeCandidates: [
    {
      candidateKey: 'route:ollama-main-rerank',
      candidateModelIds: ['bge-reranker-v2'],
      matched: true,
      modelId: 'bge-reranker-v2',
      providerId: 'ollama-main',
      providerName: 'Local Ollama',
      providerSource: 'configured',
      providerProfileId: 'ollama-main',
      providerProfileSource: 'configured',
      providerProfileConfigPath: 'copilot.providers.profiles[id=ollama-main]',
      providerConfiguredModelIds: ['workspace-rerank', 'bge-reranker-v2'],
      providerConfiguredModelCount: 2,
      providerType: 'openaiCompatible',
      providerPriority: 10,
      privacy: 'local',
      health: 'healthy',
      modelRegistryRevision: 'workspace-rerank-model-r1',
      modelRegistryRevisionActorId: 'user-1',
      modelRegistryRevisionFingerprint: 'modelregistry11112222',
      modelRegistryRevisionId: 'model-registry-rerank-1',
      modelRegistryRevisionScope: 'workspace',
      modelRegistryRevisionSourceChain: [
        {
          actorId: 'user-1',
          fingerprint: 'modelregistry11112222',
          modelId: 'workspace-rerank',
          providerId: 'ollama-main',
          revision: 'workspace-rerank-model-r1',
          scope: 'workspace',
          source: 'db_revision',
          status: 'active',
          updatedAt: '2026-06-21T09:05:00.000Z',
          workspaceId: 'workspace-1',
        },
      ],
      modelRegistryRevisionSourceChainFingerprint: 'modelchain11112222',
      modelRegistryRevisionStatus: 'active',
      modelRegistryRevisionWorkspaceId: 'workspace-1',
      modelRegistryRevisionPublishEventCount: 1,
      modelRegistryRevisionPublishEvents: [
        {
          actorId: 'user-1',
          createdAt: '2026-06-21T09:05:10.000Z',
          eventFingerprint: 'modelpublish1111',
          eventType: 'revision_published',
          id: 'model-registry-publish-event-1',
          metadata: {
            modelId: 'workspace-rerank',
            providerId: 'ollama-main',
          },
          publishSource: 'repair_execution_worker',
          registryFamily: 'model_registry',
          registryKey: 'ollama-main:workspace-rerank',
          registryModelId: 'workspace-rerank',
          registryProviderId: 'ollama-main',
          revision: 'workspace-rerank-model-r1',
          revisionFingerprint: 'modelregistry11112222',
          revisionId: 'model-registry-rerank-1',
          revisionStatus: 'active',
          scopeType: 'workspace',
          workspaceId: 'workspace-1',
        },
      ],
      routeModelDefinitionSource: 'provider_profile',
      routeModelDefinitionId: 'workspace-rerank',
      routeModelDefinitionAliases: ['bge-reranker-v2'],
      routeModelAliasMatched: false,
      reasons: ['profile_model_matched'],
      registryAvailable: true,
      registryKind: 'byok',
      registrySelected: true,
      requestedModelId: 'workspace-rerank',
    },
  ],
  routeTrace: [
    {
      availableCount: 1,
      blockedCount: 0,
      candidateCount: 1,
      matchedCount: 1,
      phase: 'policy',
      preparedCount: 0,
      reasons: ['candidate_allowed'],
      selectedCount: 1,
    },
  ],
  prepareCandidates: [
    {
      candidateKey: 'route:ollama-main-rerank',
      candidateModelIds: ['bge-reranker-v2'],
      errorCode: null,
      modelId: 'bge-reranker-v2',
      prepared: true,
      preparedModelId: 'bge-reranker-v2',
      providerId: 'ollama-main',
      providerName: 'Local Ollama',
      providerSource: 'configured',
      providerProfileId: 'ollama-main',
      providerProfileSource: 'configured',
      providerProfileConfigPath: 'copilot.providers.profiles[id=ollama-main]',
      providerConfiguredModelIds: ['workspace-rerank', 'bge-reranker-v2'],
      providerConfiguredModelCount: 2,
      providerType: 'openaiCompatible',
      providerPriority: 10,
      privacy: 'local',
      health: 'healthy',
      modelRegistryRevision: 'workspace-rerank-model-r1',
      modelRegistryRevisionActorId: 'user-1',
      modelRegistryRevisionFingerprint: 'modelregistry11112222',
      modelRegistryRevisionId: 'model-registry-rerank-1',
      modelRegistryRevisionScope: 'workspace',
      modelRegistryRevisionSourceChain: [
        {
          actorId: 'user-1',
          fingerprint: 'modelregistry11112222',
          modelId: 'workspace-rerank',
          providerId: 'ollama-main',
          revision: 'workspace-rerank-model-r1',
          scope: 'workspace',
          source: 'db_revision',
          status: 'active',
          updatedAt: '2026-06-21T09:05:00.000Z',
          workspaceId: 'workspace-1',
        },
      ],
      modelRegistryRevisionSourceChainFingerprint: 'modelchain11112222',
      modelRegistryRevisionStatus: 'active',
      modelRegistryRevisionWorkspaceId: 'workspace-1',
      modelRegistryRevisionPublishEventCount: 1,
      modelRegistryRevisionPublishEvents: [
        {
          actorId: 'user-1',
          createdAt: '2026-06-21T09:05:10.000Z',
          eventFingerprint: 'modelpublish1111',
          eventType: 'revision_published',
          id: 'model-registry-publish-event-1',
          metadata: {
            modelId: 'workspace-rerank',
            providerId: 'ollama-main',
          },
          publishSource: 'repair_execution_worker',
          registryFamily: 'model_registry',
          registryKey: 'ollama-main:workspace-rerank',
          registryModelId: 'workspace-rerank',
          registryProviderId: 'ollama-main',
          revision: 'workspace-rerank-model-r1',
          revisionFingerprint: 'modelregistry11112222',
          revisionId: 'model-registry-rerank-1',
          revisionStatus: 'active',
          scopeType: 'workspace',
          workspaceId: 'workspace-1',
        },
      ],
      routeModelDefinitionSource: 'provider_profile',
      routeModelDefinitionId: 'workspace-rerank',
      routeModelDefinitionAliases: ['bge-reranker-v2'],
      routeModelAliasMatched: false,
      reasons: ['prepared_route_selected'],
      registryAvailable: true,
      registryKind: 'byok',
      registrySelected: true,
      requestedModelId: 'workspace-rerank',
    },
  ],
  preparedProviderCount: 1,
  preparedRouteTargets: ['ollama-main/bge-reranker-v2'],
  preparedRouteTargetFingerprint: taskRouteTargetFingerprintFixture({
    featureKind: 'rerank',
    targets: ['ollama-main/bge-reranker-v2'],
  }),
  preparedRoutes: [
    {
      behaviorFlags: [],
      canonicalModelKey: 'bge-reranker-v2',
      modelBackendKind: 'rerank',
      modelId: 'bge-reranker-v2',
      protocol: 'openai-compatible',
      providerConfiguredModelCount: 2,
      providerConfiguredModelIds: ['workspace-rerank', 'bge-reranker-v2'],
      providerId: 'ollama-main',
      providerName: 'Local Ollama',
      providerPriority: 10,
      providerProfileConfigPath: 'copilot.providers.profiles[id=ollama-main]',
      providerProfileId: 'ollama-main',
      providerProfileSource: 'configured',
      providerSource: 'configured',
      providerType: 'openaiCompatible',
      requestLayer: 'chat',
      routeIndex: 0,
      fallbackOrderIndex: 0,
    },
  ],
  providerId: 'ollama-main',
  providerConfiguredModelCount: 2,
  providerConfiguredModelIds: ['workspace-rerank', 'bge-reranker-v2'],
  providerName: 'Local Ollama',
  providerPriority: 10,
  providerProfileConfigPath: 'copilot.providers.profiles[id=ollama-main]',
  providerProfileId: 'ollama-main',
  providerProfileSource: 'configured',
  providerSource: 'configured',
  providerType: 'openaiCompatible',
  requestedModelConfigKey: 'rerank',
  requestedModelConfigPath: 'copilot.tasks.models.rerank',
  requestedModelId: 'workspace-rerank',
  requestedModelSource: 'db_revision',
  taskRoutePolicyRevision: 'workspace-rerank-r1',
  taskRoutePolicyRevisionActorId: 'user-1',
  taskRoutePolicyRevisionFingerprint: 'routepolicy11112222',
  taskRoutePolicyRevisionId: 'task-route-policy-rerank-1',
  taskRoutePolicyRevisionScope: 'workspace',
  taskRoutePolicyRevisionSourceChain: [
    {
      actorId: 'user-1',
      configKey: 'rerank',
      configPath: 'copilot.tasks.models.rerank',
      featureKind: 'rerank',
      fingerprint: 'routepolicy11112222',
      modelId: 'workspace-rerank',
      revision: 'workspace-rerank-r1',
      scope: 'workspace',
      source: 'db_revision',
      status: 'active',
      updatedAt: '2026-06-21T09:00:00.000Z',
      workspaceId: 'workspace-1',
    },
    {
      configKey: 'rerank',
      configPath: 'copilot.tasks.models.rerank',
      featureKind: 'rerank',
      modelId: 'workspace-rerank',
      scope: 'global',
      source: 'config_fallback',
      status: 'available',
    },
  ],
  taskRoutePolicyRevisionSourceChainFingerprint: 'routechain11112222',
  taskRoutePolicyRevisionStatus: 'active',
  taskRoutePolicyRevisionWorkspaceId: 'workspace-1',
  taskRoutePolicyRevisionPublishEventCount: 1,
  taskRoutePolicyRevisionPublishEvents: [
    {
      actorId: 'user-1',
      createdAt: '2026-06-21T09:00:10.000Z',
      eventFingerprint: 'taskroutepublish1111',
      eventType: 'revision_published',
      id: 'task-route-policy-publish-event-1',
      metadata: {
        featureKind: 'rerank',
      },
      publishSource: 'repair_execution_worker',
      registryFamily: 'task_route_policy',
      registryKey: 'rerank',
      registryModelId: null,
      registryProviderId: null,
      revision: 'workspace-rerank-r1',
      revisionFingerprint: 'routepolicy11112222',
      revisionId: 'task-route-policy-rerank-1',
      revisionStatus: 'active',
      scopeType: 'workspace',
      workspaceId: 'workspace-1',
    },
  ],
  topK: 5,
};

const readyRouteRerankRuntimeContractSnapshotFingerprint =
  taskRouteSnapshotFingerprintFixture(
    taskRouteRerankRuntimeContractSnapshotFixture(readyRoute)
  );
const modelRouteEffectiveSourceFingerprintInputs = [
  'candidateKind',
  'policyCandidates',
  'routeCandidates',
];
const modelRouteEffectiveSourceFingerprintVersion =
  'prompt-registry-publish-gate-model-route-effective-source/v1';

const rerankRepairCandidateEvidence = candidateEvidenceFixture({
  allowed: true,
  available: true,
  candidateIndex: 0,
  candidateKey: 'policy:rerank:global:ollama-main',
  fallbackProviderIds: readyRoute.fallbackProviderIds,
  modelId: readyRoute.modelId,
  prepared: true,
  preparedModelId: readyRoute.modelId,
  preparedRouteSnapshotFingerprint: taskRouteSnapshotFingerprintFixture(
    taskRoutePreparedRouteSnapshotFixture(readyRoute.preparedRoutes)
  ),
  preparedRouteOrderFingerprint: taskRouteSnapshotFingerprintFixture(
    taskRoutePreparedRouteOrderSnapshotFixture(readyRoute.preparedRoutes)
  ),
  preparedRoutes: taskRoutePreparedRouteSnapshotFixture(
    readyRoute.preparedRoutes
  ),
  providerCapabilitySnapshotFingerprint: taskRouteSnapshotFingerprintFixture(
    taskRouteProviderCapabilitySnapshotFixture(readyRoute)
  ),
  providerHealthSnapshotFingerprint: taskRouteSnapshotFingerprintFixture(
    taskRouteProviderHealthSnapshotFixture(readyRoute)
  ),
  providerCostSnapshotFingerprint: taskRouteSnapshotFingerprintFixture(
    taskRouteProviderCostSnapshotFixture(readyRoute)
  ),
  providerLimitSnapshotFingerprint: taskRouteSnapshotFingerprintFixture(
    taskRouteProviderLimitSnapshotFixture(readyRoute)
  ),
  rerankRuntimeContractFingerprint: readyRoute.rerankRuntimeContractFingerprint,
  rerankRuntimeContractStatus: readyRoute.rerankRuntimeContractStatus,
  rerankRuntimeContractTopK: readyRoute.rerankRuntimeContractTopK,
  rerankRuntimeContractVersion: readyRoute.rerankRuntimeContractVersion,
  taskRouteRerankRuntimeContractSnapshotFingerprint:
    readyRouteRerankRuntimeContractSnapshotFingerprint,
  taskRouteEffectiveSourceFingerprint: readyRoute.effectiveSourceFingerprint,
  taskRouteModelSourceSnapshotEntries:
    taskRouteModelSourceSnapshotFixture(readyRoute),
  taskRouteModelSourceSnapshotFingerprint: taskRouteSnapshotFingerprintFixture(
    taskRouteModelSourceSnapshotFixture(readyRoute)
  ),
  preparedRouteTargets: readyRoute.preparedRouteTargets,
  preparedRouteTargetFingerprint: readyRoute.preparedRouteTargetFingerprint,
  policyCandidates: readyRoute.policyCandidates,
  policyCandidateSnapshotFingerprint: taskRouteSnapshotFingerprintFixture(
    readyRoute.policyCandidates
  ),
  providerConfiguredModelCount: readyRoute.providerConfiguredModelCount,
  providerConfiguredModelIds: readyRoute.providerConfiguredModelIds,
  providerId: readyRoute.providerId,
  providerName: readyRoute.providerName,
  providerPriority: readyRoute.providerPriority,
  providerProfileConfigPath: readyRoute.providerProfileConfigPath,
  providerProfileId: readyRoute.providerProfileId,
  providerProfileSource: readyRoute.providerProfileSource,
  providerSource: readyRoute.providerSource,
  providerType: readyRoute.providerType,
  reasons: ['candidate_allowed'],
  requestedModelId: readyRoute.requestedModelId,
  requestedModelConfigKey: readyRoute.requestedModelConfigKey,
  requestedModelConfigPath: readyRoute.requestedModelConfigPath,
  requestedModelSource: readyRoute.requestedModelSource,
  routeCandidateSnapshotFingerprint: taskRouteSnapshotFingerprintFixture(
    readyRoute.routeCandidates
  ),
  routeCandidates: readyRoute.routeCandidates,
  routeTrace: readyRoute.routeTrace,
  routeTracePhases: readyRoute.routeTrace.map(phase => phase.phase),
  routeTraceSnapshotFingerprint: taskRouteSnapshotFingerprintFixture(
    readyRoute.routeTrace
  ),
  scope: 'policyCandidate',
});

const modelsPayload = {
  defaultModel: 'gpt-4o-mini',
  defaultModelFallbackReason: 'prompt_default_unavailable',
  defaultModelSource: 'fallback_route',
  promptDefaultModel: 'gemini-2.5-flash',
  embeddingRoute: blockedRoute,
  rerankRoute: readyRoute,
  optionalModels: [
    {
      contextWindow: 128000,
      costInputPer1M: 0.15,
      costOutputPer1M: 0.6,
      embeddingDimensions: null,
      id: 'gpt-4o-mini',
      maxOutputTokens: 16000,
      name: 'GPT 4o mini',
      promptAction: 'chat',
      promptCategory: 'text',
      promptDefaultPolicy: 'text',
      promptModelConfigPath: 'copilot.prompts.overrides[].optionalModels',
      promptModelSource: 'override',
      promptModelSources: [
        {
          candidateSource: 'fallback_route',
        },
        {
          candidateSource: 'prompt',
          modelConfigPath: 'copilot.prompts.overrides[].optionalModels',
          modelSource: 'override',
        },
        {
          candidateSource: 'registry',
        },
      ],
      promptName: 'Chat With LocalMind AI',
      promptOverrideApplied: false,
      promptSource: 'built_in',
      providerId: 'openai-main',
      providerName: 'OpenAI',
      routeModelId: 'gpt-4o-mini',
      providerSource: 'configured',
      providerProfileId: 'openai-main',
      providerProfileSource: 'configured',
      providerProfileConfigPath: 'copilot.providers.profiles[id=openai-main]',
      providerConfiguredModelIds: ['gpt-4o-mini', 'fast-chat'],
      providerConfiguredModelCount: 2,
      providerType: 'OpenAI',
      providerPrivacy: 'cloud',
      providerHealth: 'healthy',
      providerHealthCheckedAt: null,
      providerHealthLastError: null,
      providerPriority: 10,
      routeBackendKind: 'openai',
      routeBehaviorFlags: [],
      routeCanonicalModelKey: 'gpt-4o-mini',
      routeRawModelId: 'gpt-4o-mini-2026-06-01',
      routeModelDefinitionSource: 'provider_profile',
      routeModelDefinitionId: 'gpt-4o-mini',
      routeModelDefinitionAliases: ['fast-chat'],
      routeModelAliasMatched: false,
      modelRegistryRevision: 'workspace-openai-gpt-r1',
      modelRegistryRevisionActorId: 'user-1',
      modelRegistryRevisionFingerprint: 'modelregistry33334444',
      modelRegistryRevisionId: 'model-registry-openai-gpt-1',
      modelRegistryRevisionScope: 'workspace',
      modelRegistryRevisionSourceChain: [
        {
          actorId: 'user-1',
          fingerprint: 'modelregistry33334444',
          modelId: 'gpt-4o-mini',
          providerId: 'openai-main',
          revision: 'workspace-openai-gpt-r1',
          scope: 'workspace',
          source: 'db_revision',
          status: 'active',
          updatedAt: '2026-06-21T10:05:00.000Z',
          workspaceId: 'workspace-1',
        },
      ],
      modelRegistryRevisionSourceChainFingerprint: 'modelchain33334444',
      modelRegistryRevisionStatus: 'active',
      modelRegistryRevisionWorkspaceId: 'workspace-1',
      modelRegistryRevisionPublishEventCount: 1,
      modelRegistryRevisionPublishEvents: [
        {
          actorId: 'user-1',
          createdAt: '2026-06-21T10:05:10.000Z',
          eventFingerprint: 'modelpublish3333',
          eventType: 'revision_published',
          id: 'model-registry-publish-event-openai-gpt-1',
          metadata: {
            modelId: 'gpt-4o-mini',
            providerId: 'openai-main',
          },
          publishSource: 'graphql_mutation',
          registryFamily: 'model_registry',
          registryKey: 'openai-main:gpt-4o-mini',
          registryModelId: 'gpt-4o-mini',
          registryProviderId: 'openai-main',
          revision: 'workspace-openai-gpt-r1',
          revisionFingerprint: 'modelregistry33334444',
          revisionId: 'model-registry-openai-gpt-1',
          revisionStatus: 'active',
          scopeType: 'workspace',
          workspaceId: 'workspace-1',
        },
      ],
      routeFallbackProviderIds: ['ollama-main', 'openai-default'],
      routeInputTypes: ['text'],
      routeOutputTypes: ['text'],
      routeProtocol: 'openai',
      routeRequestLayer: 'chat',
      routePolicyAllowedPrivacy: ['cloud', 'local'],
      routePolicyAllowedProviderIds: [],
      routePolicyBlockedProviderIds: [],
      routePolicyEnabled: true,
      routePolicyFeatureKind: 'chat',
      routePolicyPreferredPrivacy: ['local'],
      routePolicyWorkspaceId: null,
      sources: ['fallback_route', 'prompt', 'registry'],
    },
  ],
  proModels: [],
};

const providerHealthProbeAttemptsPayload = [
  {
    id: 'provider-health-probe-admin-1',
    providerId: 'localmind-db-provider',
    providerType: 'openaiCompatible',
    scopeType: 'workspace',
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    providerRegistryRevisionId: 'provider-registry-admin-1',
    providerRegistryRevisionFingerprint: 'providerregistry1111',
    providerProfileSource: 'db_revision',
    providerProfileFingerprint: 'providerprofile1111',
    providerProfileSnapshot: {
      version: 'provider-health-probe-target/v1',
      providerId: 'localmind-db-provider',
      modelCount: 1,
    },
    requestFingerprint: 'probeattempt1111',
    status: 'completed',
    attemptCount: 1,
    maxAttempts: 3,
    scheduledAt: '2026-06-23T09:00:00.000Z',
    workerLeaseId: null,
    workerLeaseExpiresAt: null,
    checkedAt: '2026-06-23T09:00:10.000Z',
    completedAt: '2026-06-23T09:00:11.000Z',
    deadLetteredAt: null,
    failureCode: null,
    failureMessage: null,
    resultStatus: 'healthy',
    resultLastError: null,
    resultMetadata: {
      version: 'provider-health-probe-attempt-result/v1',
    },
    resultFingerprint: 'proberesult1111',
    providerHealthStateId: 'provider-health-state-admin-1',
    providerHealthStateFingerprint: 'providerhealth1111',
    createdAt: '2026-06-23T09:00:00.000Z',
    updatedAt: '2026-06-23T09:00:11.000Z',
  },
  {
    id: 'provider-health-probe-dead-admin-1',
    providerId: 'localmind-db-provider',
    providerType: 'openaiCompatible',
    scopeType: 'workspace',
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    providerRegistryRevisionId: 'provider-registry-admin-1',
    providerRegistryRevisionFingerprint: 'providerregistry1111',
    providerProfileSource: 'db_revision',
    providerProfileFingerprint: 'providerprofile1111',
    providerProfileSnapshot: {
      version: 'provider-health-probe-target/v1',
      providerId: 'localmind-db-provider',
      modelCount: 1,
    },
    requestFingerprint: 'probeattemptdead1111',
    status: 'dead_lettered',
    attemptCount: 3,
    maxAttempts: 3,
    scheduledAt: '2026-06-23T08:00:00.000Z',
    workerLeaseId: null,
    workerLeaseExpiresAt: null,
    checkedAt: null,
    completedAt: null,
    deadLetteredAt: '2026-06-23T08:04:00.000Z',
    failureCode: 'provider_profile_unavailable',
    failureMessage: 'Provider profile unavailable',
    resultStatus: null,
    resultLastError: null,
    resultMetadata: {},
    resultFingerprint: null,
    providerHealthStateId: null,
    providerHealthStateFingerprint: null,
    createdAt: '2026-06-23T08:00:00.000Z',
    updatedAt: '2026-06-23T08:04:00.000Z',
  },
];

const providerHealthProbeRetryPayload = {
  ...providerHealthProbeAttemptsPayload[1],
  id: 'provider-health-probe-retry-admin-1',
  requestFingerprint: 'probeattemptretry1111',
  status: 'queued',
  attemptCount: 0,
  scheduledAt: '2026-06-23T08:05:00.000Z',
  deadLetteredAt: null,
  failureCode: null,
  failureMessage: null,
  createdAt: '2026-06-23T08:05:00.000Z',
  updatedAt: '2026-06-23T08:05:00.000Z',
};

const promptCatalogPayload = [
  {
    action: 'chat',
    category: 'text',
    defaultPolicy: 'text',
    fingerprint: 'a1b2c3d4e5f60708',
    model: 'gpt-4o-mini',
    modelConfigPath: 'copilot.prompts.overrides[].model',
    modelSource: 'override',
    modelStrategyFingerprint: '9999aaaabbbbcccc',
    name: 'Chat With LocalMind AI',
    optionalModelsConfigPath: 'copilot.prompts.overrides[].optionalModels',
    optionalModelCount: 2,
    optionalModels: ['gpt-4o-mini', 'gpt-4o'],
    optionalModelsSource: 'override',
    overrideApplied: true,
    paramCount: 1,
    paramKeys: ['content'],
    proModelsConfigPath: 'copilot.prompts.overrides[].config.proModels',
    proModelCount: 1,
    proModelsSource: 'override',
    registryFingerprint: null,
    registryId: null,
    registryMessageCount: null,
    registryModified: null,
    registryUpdatedAt: null,
    registryValidationBlockingCount: null,
    registryValidationDetail: null,
    registryValidationErrorCount: null,
    registryValidationIssueCount: null,
    registryValidationIssues: null,
    registryValidationPublishStatus: null,
    registryValidationRemediations: null,
    registryValidationReason: null,
    registryValidationStatus: null,
    revision: 'built_in:text:override:a1b2c3d4e5f60708',
    source: 'built_in',
    templateFingerprint: '1111222233334444',
    versionEvidence: {
      defaultPolicy: 'text',
      fingerprint: 'a1b2c3d4e5f60708',
      modelConfigPath: 'copilot.prompts.overrides[].model',
      modelStrategyFingerprint: '9999aaaabbbbcccc',
      optionalModelsConfigPath: 'copilot.prompts.overrides[].optionalModels',
      overrideApplied: true,
      proModelsConfigPath: 'copilot.prompts.overrides[].config.proModels',
      registryFingerprint: null,
      registryId: null,
      registryMessageCount: null,
      registryModified: null,
      registryUpdatedAt: null,
      registryValidationBlockingCount: null,
      registryValidationDetail: null,
      registryValidationErrorCount: null,
      registryValidationIssueCount: null,
      registryValidationIssues: null,
      registryValidationPublishStatus: null,
      registryValidationRemediations: null,
      registryValidationReason: null,
      registryValidationStatus: null,
      revision: 'built_in:text:override:a1b2c3d4e5f60708',
      templateFingerprint: '1111222233334444',
    },
  },
  {
    action: 'make-it-real',
    category: 'text',
    defaultPolicy: null,
    fingerprint: 'b1c2d3e4f5061728',
    model: 'claude-3-5-sonnet-latest',
    modelConfigPath: null,
    modelSource: 'built_in',
    modelStrategyFingerprint: '8888aaaabbbbcccc',
    name: 'Make it real',
    optionalModelsConfigPath: null,
    optionalModelCount: 1,
    optionalModels: ['claude-3-5-sonnet-latest'],
    optionalModelsSource: 'built_in',
    overrideApplied: false,
    paramCount: 0,
    paramKeys: [],
    proModelsConfigPath: null,
    proModelCount: 0,
    proModelsSource: 'built_in',
    registryFingerprint: 'b1c2d3e4f5061728',
    registryId: 42,
    registryMessageCount: 2,
    registryModified: true,
    registryUpdatedAt: '2026-06-17T04:05:06.000Z',
    registryValidationBlockingCount: 0,
    registryValidationDetail: 'ready',
    registryValidationErrorCount: 0,
    registryValidationIssueCount: 0,
    registryValidationIssues: [],
    registryValidationPublishStatus: 'allowed',
    registryValidationRemediations: [],
    registryValidationReason: 'ready',
    registryValidationStatus: 'ready',
    registryRecordSource: 'db_revision',
    registryRevision: 'workspace-r2',
    registryRevisionActorId: 'user-1',
    registryRevisionFingerprint: 'db11112222333344',
    registryRevisionId: 'prompt-revision-workspace',
    registryRevisionPublishEventCount: 2,
    registryRevisionPublishEvents: [
      {
        actorId: 'user-1',
        createdAt: '2026-06-18T04:06:00.000Z',
        eventFingerprint: 'publishreuse1111',
        eventType: 'revision_reused',
        id: 'registry-publish-event-reused',
        metadata: {
          revision: 'workspace-r2',
        },
        publishSource: 'graphql_mutation',
        registryFamily: 'prompt_registry',
        registryKey: 'Make it real',
        registryModelId: null,
        registryProviderId: null,
        revision: 'workspace-r2',
        revisionFingerprint: 'db11112222333344',
        revisionId: 'prompt-revision-workspace',
        revisionStatus: 'active',
        scopeType: 'workspace',
        workspaceId: 'workspace-1',
      },
      {
        actorId: 'user-1',
        createdAt: '2026-06-18T04:05:06.000Z',
        eventFingerprint: 'publishcreated1111',
        eventType: 'revision_published',
        id: 'registry-publish-event-created',
        metadata: {
          revision: 'workspace-r2',
        },
        publishSource: 'graphql_mutation',
        registryFamily: 'prompt_registry',
        registryKey: 'Make it real',
        registryModelId: null,
        registryProviderId: null,
        revision: 'workspace-r2',
        revisionFingerprint: 'db11112222333344',
        revisionId: 'prompt-revision-workspace',
        revisionStatus: 'active',
        scopeType: 'workspace',
        workspaceId: 'workspace-1',
      },
    ],
    registryRevisionScope: 'workspace',
    registryRevisionStatus: 'active',
    registryRevisionWorkspaceId: 'workspace-1',
    registrySourceChain: [
      {
        actorId: 'user-1',
        configPath: null,
        fingerprint: 'db11112222333344',
        registryId: null,
        revision: 'workspace-r2',
        scope: 'workspace',
        source: 'db_revision',
        status: 'active',
        updatedAt: '2026-06-18T04:05:06.000Z',
        workspaceId: 'workspace-1',
      },
      {
        actorId: null,
        configPath: 'ai_prompts_metadata',
        fingerprint: 'b1c2d3e4f5061728',
        registryId: 42,
        revision: 'registry:no-policy:base:b1c2d3e4f5061728',
        scope: 'global',
        source: 'legacy_registry',
        status: 'ready',
        updatedAt: '2026-06-17T04:05:06.000Z',
        workspaceId: null,
      },
      {
        actorId: null,
        configPath: 'native_prompt_catalog',
        fingerprint: 'configaaaabbbbcccc',
        registryId: null,
        revision: 'built_in:no-policy:base:configaaaabbbbcccc',
        scope: 'global',
        source: 'config_fallback',
        status: 'available',
        updatedAt: null,
        workspaceId: null,
      },
    ],
    registrySourceChainFingerprint: 'chain111122223333',
    revision: 'registry:no-policy:base:b1c2d3e4f5061728',
    source: 'registry',
    templateFingerprint: '2222333344445555',
    versionEvidence: {
      defaultPolicy: null,
      fingerprint: 'b1c2d3e4f5061728',
      modelConfigPath: null,
      modelStrategyFingerprint: '8888aaaabbbbcccc',
      optionalModelsConfigPath: null,
      overrideApplied: false,
      proModelsConfigPath: null,
      registryFingerprint: 'b1c2d3e4f5061728',
      registryId: 42,
      registryMessageCount: 2,
      registryModified: true,
      registryUpdatedAt: '2026-06-17T04:05:06.000Z',
      registryValidationBlockingCount: 0,
      registryValidationDetail: 'ready',
      registryValidationErrorCount: 0,
      registryValidationIssueCount: 0,
      registryValidationIssues: [],
      registryValidationPublishStatus: 'allowed',
      registryValidationRemediations: [],
      registryValidationReason: 'ready',
      registryValidationStatus: 'ready',
      registryRecordSource: 'db_revision',
      registryRevision: 'workspace-r2',
      registryRevisionActorId: 'user-1',
      registryRevisionFingerprint: 'db11112222333344',
      registryRevisionId: 'prompt-revision-workspace',
      registryRevisionPublishEventCount: 2,
      registryRevisionPublishEvents: [
        {
          actorId: 'user-1',
          createdAt: '2026-06-18T04:06:00.000Z',
          eventFingerprint: 'publishreuse1111',
          eventType: 'revision_reused',
          id: 'registry-publish-event-reused',
          metadata: {
            revision: 'workspace-r2',
          },
          publishSource: 'graphql_mutation',
          registryFamily: 'prompt_registry',
          registryKey: 'Make it real',
          registryModelId: null,
          registryProviderId: null,
          revision: 'workspace-r2',
          revisionFingerprint: 'db11112222333344',
          revisionId: 'prompt-revision-workspace',
          revisionStatus: 'active',
          scopeType: 'workspace',
          workspaceId: 'workspace-1',
        },
        {
          actorId: 'user-1',
          createdAt: '2026-06-18T04:05:06.000Z',
          eventFingerprint: 'publishcreated1111',
          eventType: 'revision_published',
          id: 'registry-publish-event-created',
          metadata: {
            revision: 'workspace-r2',
          },
          publishSource: 'graphql_mutation',
          registryFamily: 'prompt_registry',
          registryKey: 'Make it real',
          registryModelId: null,
          registryProviderId: null,
          revision: 'workspace-r2',
          revisionFingerprint: 'db11112222333344',
          revisionId: 'prompt-revision-workspace',
          revisionStatus: 'active',
          scopeType: 'workspace',
          workspaceId: 'workspace-1',
        },
      ],
      registryRevisionScope: 'workspace',
      registryRevisionStatus: 'active',
      registryRevisionWorkspaceId: 'workspace-1',
      registrySourceChain: [
        {
          actorId: 'user-1',
          configPath: null,
          fingerprint: 'db11112222333344',
          registryId: null,
          revision: 'workspace-r2',
          scope: 'workspace',
          source: 'db_revision',
          status: 'active',
          updatedAt: '2026-06-18T04:05:06.000Z',
          workspaceId: 'workspace-1',
        },
        {
          actorId: null,
          configPath: 'ai_prompts_metadata',
          fingerprint: 'b1c2d3e4f5061728',
          registryId: 42,
          revision: 'registry:no-policy:base:b1c2d3e4f5061728',
          scope: 'global',
          source: 'legacy_registry',
          status: 'ready',
          updatedAt: '2026-06-17T04:05:06.000Z',
          workspaceId: null,
        },
        {
          actorId: null,
          configPath: 'native_prompt_catalog',
          fingerprint: 'configaaaabbbbcccc',
          registryId: null,
          revision: 'built_in:no-policy:base:configaaaabbbbcccc',
          scope: 'global',
          source: 'config_fallback',
          status: 'available',
          updatedAt: null,
          workspaceId: null,
        },
      ],
      registrySourceChainFingerprint: 'chain111122223333',
      revision: 'registry:no-policy:base:b1c2d3e4f5061728',
      templateFingerprint: '2222333344445555',
    },
  },
  {
    action: 'image',
    category: 'image',
    defaultPolicy: 'image',
    fingerprint: 'c1d2e3f405162738',
    model: 'gpt-image-1',
    modelConfigPath: 'copilot.prompts.defaults.image.model',
    modelSource: 'default_policy',
    modelStrategyFingerprint: '7777aaaabbbbcccc',
    name: 'Generate image',
    optionalModelsConfigPath: 'copilot.prompts.defaults.image.optionalModels',
    optionalModelCount: 1,
    optionalModels: ['gpt-image-1'],
    optionalModelsSource: 'default_policy',
    overrideApplied: false,
    paramCount: 1,
    paramKeys: ['prompt'],
    proModelsConfigPath: null,
    proModelCount: 0,
    proModelsSource: 'built_in',
    registryFingerprint: null,
    registryId: null,
    registryMessageCount: null,
    registryModified: null,
    registryUpdatedAt: null,
    registryValidationBlockingCount: null,
    registryValidationDetail: null,
    registryValidationErrorCount: null,
    registryValidationIssueCount: null,
    registryValidationIssues: null,
    registryValidationPublishStatus: null,
    registryValidationRemediations: null,
    registryValidationReason: null,
    registryValidationStatus: null,
    revision: 'built_in:image:base:c1d2e3f405162738',
    source: 'built_in',
    templateFingerprint: '3333444455556666',
    versionEvidence: {
      defaultPolicy: 'image',
      fingerprint: 'c1d2e3f405162738',
      modelConfigPath: 'copilot.prompts.defaults.image.model',
      modelStrategyFingerprint: '7777aaaabbbbcccc',
      optionalModelsConfigPath: 'copilot.prompts.defaults.image.optionalModels',
      overrideApplied: false,
      proModelsConfigPath: null,
      registryFingerprint: null,
      registryId: null,
      registryMessageCount: null,
      registryModified: null,
      registryUpdatedAt: null,
      registryValidationBlockingCount: null,
      registryValidationDetail: null,
      registryValidationErrorCount: null,
      registryValidationIssueCount: null,
      registryValidationIssues: null,
      registryValidationPublishStatus: null,
      registryValidationRemediations: null,
      registryValidationReason: null,
      registryValidationStatus: null,
      revision: 'built_in:image:base:c1d2e3f405162738',
      templateFingerprint: '3333444455556666',
    },
  },
  {
    action: 'legacy-empty',
    category: 'text',
    defaultPolicy: null,
    fingerprint: 'd1e2f3a405162738',
    model: 'legacy-empty-model',
    modelConfigPath: 'ai_prompts_metadata.model',
    modelSource: 'registry',
    modelStrategyFingerprint: '6666aaaabbbbcccc',
    name: 'Legacy empty registry prompt',
    optionalModelsConfigPath: 'ai_prompts_metadata.optional_models',
    optionalModelCount: 0,
    optionalModels: [],
    optionalModelsSource: 'registry',
    overrideApplied: false,
    paramCount: 0,
    paramKeys: [],
    proModelsConfigPath: null,
    proModelCount: 0,
    proModelsSource: 'registry',
    registryFingerprint: 'feedfacecafebeef',
    registryId: 84,
    registryMessageCount: 0,
    registryModified: false,
    registryUpdatedAt: '2026-06-17T05:06:07.000Z',
    registryValidationBlockingCount: 3,
    registryValidationDetail: 'messages:empty',
    registryValidationErrorCount: 3,
    registryValidationIssueCount: 3,
    registryValidationIssues: [
      {
        code: 'empty',
        detail: 'messages:empty',
        fieldLabel: 'Messages',
        message: 'Prompt registry seed has no messages.',
        messageIndex: null,
        path: 'messages',
        publishBlocking: true,
        reason: 'missing_messages',
        severity: 'error',
        source: 'ai_prompts_messages',
        sourceLocator: {
          field: 'messages',
          messageIndex: null,
          path: 'messages',
          registryFingerprint: 'feedfacecafebeef',
          registryId: 84,
          registryUpdatedAt: '2026-06-17T05:06:07.000Z',
          table: 'ai_prompts_messages',
        },
      },
      {
        code: 'invalid_type',
        detail: 'message[0].content:invalid_type',
        fieldLabel: 'Message 0 Content',
        message: 'Expected string, received null',
        messageIndex: 0,
        path: 'message[0].content',
        publishBlocking: true,
        reason: 'invalid_message',
        severity: 'error',
        source: 'ai_prompts_messages[0].content',
        sourceLocator: {
          field: 'content',
          messageIndex: 0,
          path: 'message[0].content',
          registryFingerprint: 'feedfacecafebeef',
          registryId: 84,
          registryUpdatedAt: '2026-06-17T05:06:07.000Z',
          table: 'ai_prompts_messages',
        },
      },
      {
        code: 'missing',
        detail: 'template.topic:missing_param',
        fieldLabel: 'Template Param',
        message:
          'Prompt template variable "topic" is not declared in ai_prompts_messages.params.',
        messageIndex: 0,
        path: 'message[0].params.topic',
        publishBlocking: true,
        reason: 'missing_template_param',
        severity: 'error',
        source: 'ai_prompts_messages[0].params.topic',
        sourceLocator: {
          field: 'params.topic',
          messageIndex: 0,
          path: 'message[0].params.topic',
          registryFingerprint: 'feedfacecafebeef',
          registryId: 84,
          registryUpdatedAt: '2026-06-17T05:06:07.000Z',
          table: 'ai_prompts_messages',
        },
      },
    ],
    registryValidationPublishStatus: 'blocked',
    registryValidationRemediations: [
      {
        detail:
          'Create at least one valid prompt message for this registry seed.',
        kind: 'add_messages',
        label: 'Add prompt messages',
        target: 'ai_prompts_messages',
        targetLocator: {
          field: 'messages',
          messageIndex: null,
          path: 'messages',
          registryFingerprint: 'feedfacecafebeef',
          registryId: 84,
          registryUpdatedAt: '2026-06-17T05:06:07.000Z',
          table: 'ai_prompts_messages',
        },
      },
      {
        detail:
          'Declare default values for every prompt template variable in ai_prompts_messages.params.',
        kind: 'declare_template_param',
        label: 'Declare template params',
        target: 'ai_prompts_messages.params',
        targetLocator: {
          field: 'params',
          messageIndex: null,
          path: 'messages.params',
          registryFingerprint: 'feedfacecafebeef',
          registryId: 84,
          registryUpdatedAt: '2026-06-17T05:06:07.000Z',
          table: 'ai_prompts_messages',
        },
      },
    ],
    registryValidationReason: 'missing_messages',
    registryValidationStatus: 'ignored',
    revision: 'registry:no-policy:base:d1e2f3a405162738',
    source: 'registry',
    templateFingerprint: '4444555566667777',
    versionEvidence: {
      defaultPolicy: null,
      fingerprint: 'd1e2f3a405162738',
      modelConfigPath: 'ai_prompts_metadata.model',
      modelStrategyFingerprint: '6666aaaabbbbcccc',
      optionalModelsConfigPath: 'ai_prompts_metadata.optional_models',
      overrideApplied: false,
      proModelsConfigPath: null,
      registryFingerprint: 'feedfacecafebeef',
      registryId: 84,
      registryMessageCount: 0,
      registryModified: false,
      registryUpdatedAt: '2026-06-17T05:06:07.000Z',
      registryValidationBlockingCount: 3,
      registryValidationDetail: 'messages:empty',
      registryValidationErrorCount: 3,
      registryValidationIssueCount: 3,
      registryValidationIssues: [
        {
          code: 'empty',
          detail: 'messages:empty',
          fieldLabel: 'Messages',
          message: 'Prompt registry seed has no messages.',
          messageIndex: null,
          path: 'messages',
          publishBlocking: true,
          reason: 'missing_messages',
          severity: 'error',
          source: 'ai_prompts_messages',
          sourceLocator: {
            field: 'messages',
            messageIndex: null,
            path: 'messages',
            registryFingerprint: 'feedfacecafebeef',
            registryId: 84,
            registryUpdatedAt: '2026-06-17T05:06:07.000Z',
            table: 'ai_prompts_messages',
          },
        },
        {
          code: 'invalid_type',
          detail: 'message[0].content:invalid_type',
          fieldLabel: 'Message 0 Content',
          message: 'Expected string, received null',
          messageIndex: 0,
          path: 'message[0].content',
          publishBlocking: true,
          reason: 'invalid_message',
          severity: 'error',
          source: 'ai_prompts_messages[0].content',
          sourceLocator: {
            field: 'content',
            messageIndex: 0,
            path: 'message[0].content',
            registryFingerprint: 'feedfacecafebeef',
            registryId: 84,
            registryUpdatedAt: '2026-06-17T05:06:07.000Z',
            table: 'ai_prompts_messages',
          },
        },
        {
          code: 'missing',
          detail: 'template.topic:missing_param',
          fieldLabel: 'Template Param',
          message:
            'Prompt template variable "topic" is not declared in ai_prompts_messages.params.',
          messageIndex: 0,
          path: 'message[0].params.topic',
          publishBlocking: true,
          reason: 'missing_template_param',
          severity: 'error',
          source: 'ai_prompts_messages[0].params.topic',
          sourceLocator: {
            field: 'params.topic',
            messageIndex: 0,
            path: 'message[0].params.topic',
            registryFingerprint: 'feedfacecafebeef',
            registryId: 84,
            registryUpdatedAt: '2026-06-17T05:06:07.000Z',
            table: 'ai_prompts_messages',
          },
        },
      ],
      registryValidationPublishStatus: 'blocked',
      registryValidationRemediations: [
        {
          detail:
            'Create at least one valid prompt message for this registry seed.',
          kind: 'add_messages',
          label: 'Add prompt messages',
          target: 'ai_prompts_messages',
          targetLocator: {
            field: 'messages',
            messageIndex: null,
            path: 'messages',
            registryFingerprint: 'feedfacecafebeef',
            registryId: 84,
            registryUpdatedAt: '2026-06-17T05:06:07.000Z',
            table: 'ai_prompts_messages',
          },
        },
        {
          detail:
            'Declare default values for every prompt template variable in ai_prompts_messages.params.',
          kind: 'declare_template_param',
          label: 'Declare template params',
          target: 'ai_prompts_messages.params',
          targetLocator: {
            field: 'params',
            messageIndex: null,
            path: 'messages.params',
            registryFingerprint: 'feedfacecafebeef',
            registryId: 84,
            registryUpdatedAt: '2026-06-17T05:06:07.000Z',
            table: 'ai_prompts_messages',
          },
        },
      ],
      registryValidationReason: 'missing_messages',
      registryValidationStatus: 'ignored',
      revision: 'registry:no-policy:base:d1e2f3a405162738',
      templateFingerprint: '4444555566667777',
    },
  },
];

const defaultPublishGateRouteProviderMetadata = {
  providerConfiguredModelCount: 2,
  providerConfiguredModelIds: ['claude-3-5-sonnet-latest', 'make-it-real'],
  providerHealth: 'healthy',
  providerHealthCheckedAt: '2026-06-17T03:00:00.000Z',
  providerHealthLastError: null,
  providerName: 'Anthropic Main',
  providerPrivacy: 'cloud',
  providerPriority: 10,
  providerProfileConfigPath: 'copilot.providers.profiles[id=anthropic-main]',
  providerProfileId: 'anthropic-main',
  providerProfileSource: 'configured',
  providerSource: 'configured',
  providerType: 'anthropic',
};

const publishGatePolicyCandidates = [
  {
    allowed: true,
    available: true,
    health: 'healthy',
    healthCheckedAt: '2026-06-17T03:00:00.000Z',
    privacy: 'cloud',
    providerId: 'anthropic-main',
    providerName: 'Anthropic Main',
    providerPriority: 10,
    providerConfiguredModelCount: 2,
    providerConfiguredModelIds: ['claude-3-5-sonnet-latest', 'make-it-real'],
    providerProfileConfigPath: 'copilot.providers.profiles[id=anthropic-main]',
    providerProfileId: 'anthropic-main',
    providerProfileSource: 'configured',
    providerSource: 'configured',
    providerType: 'anthropic',
    reasons: ['candidate_allowed', 'privacy_preferred'],
  },
  {
    allowed: false,
    available: true,
    health: 'healthy',
    healthCheckedAt: null,
    privacy: 'cloud',
    providerId: 'openai-secondary',
    providerName: 'OpenAI Secondary',
    providerPriority: 5,
    providerConfiguredModelCount: 2,
    providerConfiguredModelIds: ['office-chat-fast', 'gpt-4o-mini'],
    providerProfileConfigPath:
      'copilot.providers.profiles[id=openai-secondary]',
    providerProfileId: 'openai-secondary',
    providerProfileSource: 'configured',
    providerSource: 'configured',
    providerType: 'openai',
    reasons: ['provider_not_allowed'],
  },
];

const defaultPublishGateRouteTrace = [
  {
    availableCount: 2,
    blockedCount: 1,
    candidateCount: 2,
    matchedCount: null,
    phase: 'policy',
    reasons: ['candidate_allowed', 'privacy_preferred', 'provider_not_allowed'],
    selectedCount: 1,
  },
  {
    availableCount: 1,
    blockedCount: null,
    candidateCount: 1,
    matchedCount: 1,
    phase: 'resolution',
    reasons: ['capability_matched', 'registry_selected'],
    selectedCount: 1,
  },
];

const optionalPublishGateRouteTrace = [
  defaultPublishGateRouteTrace[0],
  {
    availableCount: 2,
    blockedCount: null,
    candidateCount: 2,
    matchedCount: 0,
    phase: 'resolution',
    reasons: ['capability_mismatch', 'profile_model_not_allowed'],
    selectedCount: 0,
  },
];

const registryPublishGateRouteTrace = [
  defaultPublishGateRouteTrace[0],
  {
    availableCount: 1,
    blockedCount: null,
    candidateCount: 1,
    matchedCount: 1,
    phase: 'resolution',
    reasons: ['profile_model_matched'],
    selectedCount: 1,
  },
];

const defaultPublishGateRouteCandidate = {
  candidateModelIds: ['claude-3-5-sonnet-latest', 'make-it-real'],
  health: 'healthy',
  healthCheckedAt: '2026-06-17T03:00:00.000Z',
  matched: true,
  modelId: 'claude-3-5-sonnet-latest',
  privacy: 'cloud',
  providerConfiguredModelCount: 2,
  providerConfiguredModelIds: ['claude-3-5-sonnet-latest', 'make-it-real'],
  providerId: 'anthropic-main',
  providerName: 'Anthropic Main',
  providerPriority: 10,
  providerProfileConfigPath: 'copilot.providers.profiles[id=anthropic-main]',
  providerProfileId: 'anthropic-main',
  providerProfileSource: 'configured',
  providerSource: 'configured',
  providerType: 'anthropic',
  reasons: ['capability_matched', 'registry_selected'],
  registryAvailable: true,
  registryKind: 'byok',
  registrySelected: true,
  requestedModelId: 'claude-3-5-sonnet-latest',
  routeModelAliasMatched: false,
  routeModelDefinitionAliases: ['make-it-real'],
  routeModelDefinitionId: 'claude-3-5-sonnet-latest',
  routeModelDefinitionSource: 'native_registry',
  routeRawModelId: null,
};

const optionalPublishGateRouteCandidates = [
  {
    candidateModelIds: ['missing-object', 'openai-fallback/missing-object'],
    health: 'degraded',
    healthCheckedAt: '2026-06-17T03:30:00.000Z',
    matched: false,
    modelId: 'missing-object',
    privacy: 'cloud',
    providerConfiguredModelCount: 2,
    providerConfiguredModelIds: [
      'missing-object',
      'openai-fallback/missing-object',
    ],
    providerId: 'openai-fallback',
    providerName: 'OpenAI Fallback',
    providerPriority: 20,
    providerProfileConfigPath: 'copilot.providers.profiles[id=openai-fallback]',
    providerProfileId: 'openai-fallback',
    providerProfileSource: 'configured',
    providerSource: 'configured',
    providerType: 'openai',
    reasons: ['capability_mismatch'],
    registryAvailable: true,
    registryKind: 'byok',
    registrySelected: false,
    requestedModelId: 'openai-fallback/missing-object',
    routeModelAliasMatched: false,
    routeModelDefinitionAliases: [],
    routeModelDefinitionId: null,
    routeModelDefinitionSource: null,
    routeRawModelId: null,
  },
  {
    candidateModelIds: ['office-chat-fast', 'gpt-4o-mini'],
    health: 'healthy',
    healthCheckedAt: null,
    matched: false,
    modelId: 'gpt-4o-mini',
    privacy: 'cloud',
    providerConfiguredModelCount: 2,
    providerConfiguredModelIds: ['office-chat-fast', 'gpt-4o-mini'],
    providerId: 'openai-secondary',
    providerName: 'OpenAI Secondary',
    providerPriority: 5,
    providerProfileConfigPath:
      'copilot.providers.profiles[id=openai-secondary]',
    providerProfileId: 'openai-secondary',
    providerProfileSource: 'configured',
    providerSource: 'configured',
    providerType: 'openai',
    reasons: ['profile_model_not_allowed'],
    registryAvailable: true,
    registryKind: 'quota_backed',
    registrySelected: false,
    requestedModelId: 'openai-fallback/missing-object',
    routeModelAliasMatched: false,
    routeModelDefinitionAliases: ['office-chat-fast'],
    routeModelDefinitionId: 'office-chat-fast',
    routeModelDefinitionSource: 'provider_profile',
    routeRawModelId: 'gpt-4o-mini',
  },
];

const registryPublishGateRouteCandidate = {
  candidateModelIds: ['office-chat-fast', 'gpt-4o-mini'],
  health: 'healthy',
  healthCheckedAt: null,
  matched: true,
  modelId: 'gpt-4o-mini',
  privacy: 'cloud',
  providerConfiguredModelCount: 2,
  providerConfiguredModelIds: ['office-chat-fast', 'gpt-4o-mini'],
  providerId: 'openai-fallback',
  providerName: 'OpenAI Fallback',
  providerPriority: 20,
  providerProfileConfigPath: 'copilot.providers.profiles[id=openai-fallback]',
  providerProfileId: 'openai-fallback',
  providerProfileSource: 'configured',
  providerSource: 'configured',
  providerType: 'openai',
  reasons: ['profile_model_matched'],
  registryAvailable: true,
  registryKind: 'byok',
  registrySelected: true,
  requestedModelId: 'office-chat-fast',
  routeModelAliasMatched: true,
  routeModelDefinitionAliases: ['office-chat-fast'],
  routeModelDefinitionId: 'office-chat-fast',
  routeModelDefinitionSource: 'provider_profile',
  routeRawModelId: 'gpt-4o-mini',
};

const actionRouteDryRun = {
  actionId: 'make-it-real',
  actualRouteCount: 1,
  diagnosticsErrorCode: null,
  diagnosticsErrorMessage: null,
  diagnosticsErrorStage: null,
  errorCode: null,
  errorMessage: null,
  expectedRouteCount: 1,
  featureKind: 'action',
  missingRouteCount: 0,
  routeCountMismatch: false,
  routeCountMismatchStepIds: [],
  status: 'succeeded',
  steps: [
    {
      actualRouteCount: 1,
      fallbackProviderIds: ['openai-fallback'],
      kind: 'structured',
      requestedModelId: 'office-structured',
      requestedModelSource: 'registry',
      routeCount: 1,
      routeCountMismatch: false,
      routes: [
        {
          fallbackOrderIndex: 0,
          modelId: 'gpt-4o-mini',
          protocol: 'openai_chat',
          providerConfiguredModelCount: 2,
          providerConfiguredModelIds: ['office-structured', 'gpt-4o-mini'],
          providerHealth: 'degraded',
          providerHealthCheckedAt: '2026-06-17T09:00:00.000Z',
          providerHealthLastError: 'provider probe timed out',
          providerId: 'openai-fallback',
          providerName: 'OpenAI Fallback',
          providerPrivacy: 'cloud',
          providerPriority: 20,
          providerProfileConfigPath:
            'copilot.providers.profiles[id=openai-fallback]',
          providerProfileId: 'openai-fallback',
          providerProfileSource: 'configured',
          providerSource: 'configured',
          providerType: 'openai',
          requestLayer: 'chat_completions',
          routeIndex: 0,
          routeModelAliasMatched: true,
          routeModelDefinitionAliases: ['office-structured'],
          routeModelDefinitionId: 'office-structured',
          routeModelDefinitionSource: 'provider_profile',
          routeRawModelId: 'gpt-4o-mini',
        },
      ],
      stepId: 'generate',
    },
  ],
};

const failedActionRouteDryRun = {
  actionId: 'make-it-real',
  actualRouteCount: 0,
  diagnosticsErrorCode: 'StructuredDryRunFailure',
  diagnosticsErrorMessage: 'structured dry-run unavailable',
  diagnosticsErrorStage: 'build_structured_plan',
  errorCode: 'StructuredDryRunFailure',
  errorMessage: 'structured dry-run unavailable',
  expectedRouteCount: 0,
  featureKind: 'action',
  missingRouteCount: 0,
  routeCountMismatch: false,
  routeCountMismatchStepIds: [],
  status: 'failed',
  steps: [],
};

const repairActionInputSchemaFixture = {
  additionalProperties: false,
  properties: {
    diagnosticsFingerprint: { type: 'string' },
    targetLocator: { type: 'object' },
  },
  required: ['diagnosticsFingerprint', 'targetLocator'],
  type: 'object',
};

const repairActionCatalogEntry = (
  actionKind: string,
  requiredCapabilities: string[],
  safety: string,
  recommendationCount = 1
) => ({
  actionKind,
  catalogVersion: 'repair-actions/v1',
  inputSchema: repairActionInputSchemaFixture,
  recommendationCount,
  requiredCapabilities,
  safety,
});
const repairActionMutationGuard = (input: {
  auditSummary: string;
  auditSummaryFingerprint: string;
  catalogFingerprint: string;
  expectedRegistryFingerprint: string;
  expectedRegistryId: number;
  expectedRegistryUpdatedAt: string;
  guardFingerprint: string;
  intentFingerprint: string;
  inputSchemaFingerprint: string;
  recommendationCategories: string[];
  recommendationFingerprints: string[];
  recommendationCodes: string[];
  requiredCapabilities: string[];
  requiredReviewModes: string[];
  safetyLevels: string[];
  suggestedActionKinds: string[];
  targetLocatorCount: number;
  targetLocatorFingerprint: string;
  targetLocatorKinds: string[];
}) => ({
  auditSummary: input.auditSummary,
  auditSummaryFingerprint: input.auditSummaryFingerprint,
  catalogFingerprint: input.catalogFingerprint,
  catalogVersion: 'repair-actions/v1',
  expectedRegistryFingerprint: input.expectedRegistryFingerprint,
  expectedRegistryId: input.expectedRegistryId,
  expectedRegistryUpdatedAt: input.expectedRegistryUpdatedAt,
  guardFingerprint: input.guardFingerprint,
  intentFingerprint: input.intentFingerprint,
  inputSchemaFingerprint: input.inputSchemaFingerprint,
  recommendationCategories: input.recommendationCategories,
  recommendationCount: input.recommendationFingerprints.length,
  recommendationCodes: input.recommendationCodes,
  recommendationFingerprints: input.recommendationFingerprints,
  requiredCapabilities: input.requiredCapabilities,
  requiredReviewModes: input.requiredReviewModes,
  required: input.recommendationFingerprints.length > 0,
  safetyLevels: input.safetyLevels,
  suggestedActionKinds: input.suggestedActionKinds,
  targetLocatorCount: input.targetLocatorCount,
  targetLocatorFingerprint: input.targetLocatorFingerprint,
  targetLocatorKinds: input.targetLocatorKinds,
});

const repairActionPreviewReviewMode = (safety: string) => {
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
};

const repairActionPreviewStatus = (safety: string) => {
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
};

const repairActionPreviewSummaryStatus = (
  operations: Array<{ previewStatus: string }>
) => {
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
};

const repairActionPreviewAuthorizationStatus = (
  operations: Array<{ reviewMode: string }>
) => {
  if (!operations.length) {
    return 'not_required';
  }
  return operations.some(operation =>
    ['dry_run', 'manual_review', 'preview'].includes(operation.reviewMode)
  )
    ? 'approval_required'
    : 'preauthorized_read_only';
};

const repairActionPreviewApprovalCheckpoints = (input: {
  approvalModes: string[];
  authorizationStatus: string;
}) =>
  [
    'read_only_contract',
    'operation_set',
    'capability_scope',
    'authorization_snapshot',
    input.authorizationStatus,
    ...input.approvalModes.map(mode => `review_mode:${mode}`),
  ].sort();

function withRepairActionPreview<
  T extends {
    blockingCount: number;
    issueCount: number;
    publishStatus: string;
    reason: string;
    registryFingerprint: string;
    registryId: number;
    registryUpdatedAt: string;
    repairActionCatalogFingerprint: string;
    repairActionMutationGuard: ReturnType<typeof repairActionMutationGuard>;
    repairRecommendations: Array<{
      candidateEvidence?: Array<{
        candidateFingerprint: string;
        candidateIndex: number;
        candidateKey?: string;
        providerId: string;
        scope: string;
        taskRouteEmbeddingIndexContractSnapshotFingerprint?: string | null;
        taskRouteRerankRuntimeContractSnapshotFingerprint?: string | null;
        taskRouteEffectiveSourceFingerprint?: string | null;
        taskRouteEffectiveSourceFingerprintInputs?: string[] | null;
        taskRouteEffectiveSourceFingerprintVersion?: string | null;
        preparedRouteOrderFingerprint?: string | null;
      }> | null;
      category: string;
      code: string;
      diagnosticsFingerprint: string;
      instanceKey?: string | null;
      suggestedActionInputSchema: Record<string, unknown>;
      suggestedActionKind: string;
      suggestedActionRequiredCapabilities: string[];
      suggestedActionSafety: string;
      target: string;
      targetLocator?: Record<string, unknown> | null;
    }>;
    status: string;
  },
>(
  verdict: T,
  input: {
    operationFingerprints: string[];
    operationSetFingerprint: string;
    authorizationFingerprint: string;
    approvalPolicyFingerprint: string;
    candidateEvidenceSetFingerprint: string;
    taskRouteEffectiveSourceEvidenceSetFingerprint: string;
    embeddingIndexContractEvidenceSetFingerprint: string;
    rerankRuntimeContractEvidenceSetFingerprint: string;
    preparedRouteOrderEvidenceSetFingerprint: string;
    previewFingerprint: string;
    submissionFingerprint: string;
    targetLocatorFingerprints: string[];
  }
) {
  const repairActionPreview = (() => {
    const operations = verdict.repairRecommendations.map(
      (recommendation, index) => {
        const candidateEvidence = recommendation.candidateEvidence ?? [];
        const candidateEvidenceFingerprints = Array.from(
          new Set(
            candidateEvidence.map(evidence => evidence.candidateFingerprint)
          )
        ).sort();
        const candidateEvidenceKeys = Array.from(
          new Set(
            candidateEvidence.flatMap(evidence =>
              evidence.candidateKey ? [evidence.candidateKey] : []
            )
          )
        ).sort();
        const preparedRouteOrderFingerprints = Array.from(
          new Set(
            candidateEvidence.flatMap(evidence =>
              evidence.preparedRouteOrderFingerprint
                ? [evidence.preparedRouteOrderFingerprint]
                : []
            )
          )
        ).sort();
        const embeddingIndexContractEvidenceFingerprints = Array.from(
          new Set(
            candidateEvidence.flatMap(evidence =>
              evidence.taskRouteEmbeddingIndexContractSnapshotFingerprint
                ? [evidence.taskRouteEmbeddingIndexContractSnapshotFingerprint]
                : []
            )
          )
        ).sort();
        const rerankRuntimeContractEvidenceFingerprints = Array.from(
          new Set(
            candidateEvidence.flatMap(evidence =>
              evidence.taskRouteRerankRuntimeContractSnapshotFingerprint
                ? [evidence.taskRouteRerankRuntimeContractSnapshotFingerprint]
                : []
            )
          )
        ).sort();
        const taskRouteEffectiveSourceFingerprints = Array.from(
          new Set(
            candidateEvidence.flatMap(evidence =>
              evidence.taskRouteEffectiveSourceFingerprint
                ? [evidence.taskRouteEffectiveSourceFingerprint]
                : []
            )
          )
        ).sort();

        return {
          actionKind: recommendation.suggestedActionKind,
          candidateEvidenceCount: candidateEvidence.length,
          candidateEvidenceEntries:
            candidateEvidenceReferenceEntriesFixture(candidateEvidence),
          candidateEvidenceFingerprint: createHash('sha256')
            .update(
              stableFixtureStringify({
                candidateEvidenceFingerprints,
                candidateEvidenceKeys,
              })
            )
            .digest('hex')
            .slice(0, 16),
          candidateEvidenceFingerprints,
          candidateEvidenceKeys,
          category: recommendation.category,
          code: recommendation.code,
          diagnosticsFingerprint: recommendation.diagnosticsFingerprint,
          inputSchema: recommendation.suggestedActionInputSchema,
          instanceKey: recommendation.instanceKey ?? null,
          operationFingerprint: input.operationFingerprints[index],
          embeddingIndexContractEvidenceFingerprints,
          rerankRuntimeContractEvidenceFingerprints,
          taskRouteEffectiveSourceFingerprints,
          preparedRouteOrderFingerprints,
          previewStatus: repairActionPreviewStatus(
            recommendation.suggestedActionSafety
          ),
          requiredCapabilities: [
            ...recommendation.suggestedActionRequiredCapabilities,
          ],
          reviewMode: repairActionPreviewReviewMode(
            recommendation.suggestedActionSafety
          ),
          safety: recommendation.suggestedActionSafety,
          target: recommendation.target,
          targetLocator: recommendation.targetLocator ?? null,
          targetLocatorFingerprint: input.targetLocatorFingerprints[index],
        };
      }
    );
    const approvalModes = Array.from(
      new Set(operations.map(operation => operation.reviewMode))
    ).sort();
    const approvalRequired = approvalModes.some(mode =>
      ['dry_run', 'manual_review', 'preview'].includes(mode)
    );
    const requiredCapabilities = Array.from(
      new Set(operations.flatMap(operation => operation.requiredCapabilities))
    ).sort();
    const authorizationStatus =
      repairActionPreviewAuthorizationStatus(operations);
    const approvalCheckpoints = repairActionPreviewApprovalCheckpoints({
      approvalModes,
      authorizationStatus,
    });

    return {
      approvalCheckpoints,
      approvalModes,
      approvalPolicyFingerprint: input.approvalPolicyFingerprint,
      approvalPolicyVersion: 'repair-preview-approval/v1',
      approvalRequired,
      auditSummaryFingerprint:
        verdict.repairActionMutationGuard.auditSummaryFingerprint,
      authorizationFingerprint: input.authorizationFingerprint,
      authorizationStatus,
      candidateCount: verdict.repairRecommendations.length,
      candidateEvidenceSetFingerprint: input.candidateEvidenceSetFingerprint,
      taskRouteEffectiveSourceEvidenceSetFingerprint:
        input.taskRouteEffectiveSourceEvidenceSetFingerprint,
      taskRouteEffectiveSourceEvidenceSetFingerprintInputs: [
        ...taskRouteEffectiveSourceEvidenceSetFingerprintInputsFixture,
      ],
      taskRouteEffectiveSourceEvidenceSetFingerprintVersion:
        taskRouteEffectiveSourceEvidenceSetFingerprintVersionFixture,
      embeddingIndexContractEvidenceSetFingerprint:
        input.embeddingIndexContractEvidenceSetFingerprint,
      rerankRuntimeContractEvidenceSetFingerprint:
        input.rerankRuntimeContractEvidenceSetFingerprint,
      preparedRouteOrderEvidenceSetFingerprint:
        input.preparedRouteOrderEvidenceSetFingerprint,
      catalogFingerprint: verdict.repairActionCatalogFingerprint,
      catalogVersion: verdict.repairActionMutationGuard.catalogVersion,
      guardFingerprint: verdict.repairActionMutationGuard.guardFingerprint,
      operationFingerprints: [...input.operationFingerprints].sort(),
      operationSetFingerprint: input.operationSetFingerprint,
      operations,
      previewFingerprint: input.previewFingerprint,
      readOnly: true,
      requiredCapabilities,
      status: repairActionPreviewSummaryStatus(operations),
      submissionContract: {
        approvalPolicyFingerprint: input.approvalPolicyFingerprint,
        authorizationFingerprint: input.authorizationFingerprint,
        candidateEvidenceSetFingerprint: input.candidateEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprint:
          input.taskRouteEffectiveSourceEvidenceSetFingerprint,
        taskRouteEffectiveSourceEvidenceSetFingerprintInputs: [
          ...taskRouteEffectiveSourceEvidenceSetFingerprintInputsFixture,
        ],
        taskRouteEffectiveSourceEvidenceSetFingerprintVersion:
          taskRouteEffectiveSourceEvidenceSetFingerprintVersionFixture,
        embeddingIndexContractEvidenceSetFingerprint:
          input.embeddingIndexContractEvidenceSetFingerprint,
        rerankRuntimeContractEvidenceSetFingerprint:
          input.rerankRuntimeContractEvidenceSetFingerprint,
        preparedRouteOrderEvidenceSetFingerprint:
          input.preparedRouteOrderEvidenceSetFingerprint,
        catalogFingerprint: verdict.repairActionCatalogFingerprint,
        contractVersion: 'repair-preview-submission/v1',
        expectedRegistryFingerprint:
          verdict.repairActionMutationGuard.expectedRegistryFingerprint,
        expectedRegistryId:
          verdict.repairActionMutationGuard.expectedRegistryId,
        expectedRegistryUpdatedAt:
          verdict.repairActionMutationGuard.expectedRegistryUpdatedAt,
        guardFingerprint: verdict.repairActionMutationGuard.guardFingerprint,
        idempotencyKey: [
          verdict.repairActionMutationGuard.expectedRegistryId,
          verdict.repairActionMutationGuard.expectedRegistryFingerprint,
          input.previewFingerprint,
          input.operationSetFingerprint,
        ].join(':'),
        mutationAvailable: false,
        operationSetFingerprint: input.operationSetFingerprint,
        previewFingerprint: input.previewFingerprint,
        readOnly: true,
        requiredInputs: [
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
        ].sort(),
        status: 'read_only_contract',
        submissionFingerprint: input.submissionFingerprint,
        targetLocatorFingerprint:
          verdict.repairActionMutationGuard.targetLocatorFingerprint,
      },
    };
  })();
  const manifestWithoutFingerprint = {
    version: 'prompt-registry-repair-gate-manifest/v1',
    boundary: 'repair_gate_manifest_only_no_prompt_or_provider_payload',
    registryFingerprint: verdict.registryFingerprint,
    registryId: verdict.registryId,
    registryUpdatedAt: verdict.registryUpdatedAt,
    gateStatus: verdict.status,
    publishStatus: verdict.publishStatus,
    reason: verdict.reason,
    issueCount: verdict.issueCount,
    blockingCount: verdict.blockingCount,
    recommendationCount: verdict.repairRecommendations.length,
    operationCount: repairActionPreview.operations.length,
    guardFingerprint: verdict.repairActionMutationGuard.guardFingerprint,
    previewFingerprint: repairActionPreview.previewFingerprint,
    submissionFingerprint:
      repairActionPreview.submissionContract.submissionFingerprint,
    candidateEvidenceSetFingerprint:
      repairActionPreview.candidateEvidenceSetFingerprint,
    taskRouteEffectiveSourceEvidenceSetFingerprint:
      repairActionPreview.taskRouteEffectiveSourceEvidenceSetFingerprint,
    taskRouteEffectiveSourceEvidenceSetFingerprintInputs:
      repairActionPreview.taskRouteEffectiveSourceEvidenceSetFingerprintInputs,
    taskRouteEffectiveSourceEvidenceSetFingerprintVersion:
      repairActionPreview.taskRouteEffectiveSourceEvidenceSetFingerprintVersion,
    embeddingIndexContractEvidenceSetFingerprint:
      repairActionPreview.embeddingIndexContractEvidenceSetFingerprint,
    rerankRuntimeContractEvidenceSetFingerprint:
      repairActionPreview.rerankRuntimeContractEvidenceSetFingerprint,
    preparedRouteOrderEvidenceSetFingerprint:
      repairActionPreview.preparedRouteOrderEvidenceSetFingerprint,
    operationSetFingerprint: repairActionPreview.operationSetFingerprint,
    targetLocatorFingerprint:
      repairActionPreview.submissionContract.targetLocatorFingerprint,
    approvalPolicyFingerprint: repairActionPreview.approvalPolicyFingerprint,
    authorizationFingerprint: repairActionPreview.authorizationFingerprint,
    catalogFingerprint: repairActionPreview.catalogFingerprint,
    catalogVersion: repairActionPreview.catalogVersion,
    readOnly: repairActionPreview.readOnly,
    mutationAvailable: repairActionPreview.submissionContract.mutationAvailable,
    requiredCapabilities: [...repairActionPreview.requiredCapabilities].sort(),
    requiredReviewModes: [
      ...verdict.repairActionMutationGuard.requiredReviewModes,
    ].sort(),
    safetyLevels: [...verdict.repairActionMutationGuard.safetyLevels].sort(),
    operationFingerprints: [
      ...repairActionPreview.operationFingerprints,
    ].sort(),
    recommendationFingerprints: [
      ...verdict.repairActionMutationGuard.recommendationFingerprints,
    ].sort(),
  };
  const repairGateManifest = {
    ...manifestWithoutFingerprint,
    fingerprint: createHash('sha256')
      .update(stableFixtureStringify(manifestWithoutFingerprint))
      .digest('hex')
      .slice(0, 16),
  };
  const repairGateManifestExportMetadata = (() => {
    const artifact = 'prompt_registry_repair_gate_manifest_json';
    const filename = `prompt-registry-repair-gate-manifest-${repairGateManifest.registryId}-${repairGateManifest.fingerprint}.json`;
    const metadataFilename = `prompt-registry-repair-gate-manifest-metadata-${repairGateManifest.registryId}-${repairGateManifest.fingerprint}.json`;
    const mime = 'application/json;charset=utf-8';
    const redactionPolicyVersion =
      'prompt-registry-repair-gate-manifest-redaction-policy/v1';
    const redactionPolicyStatus =
      'redacted_projection_no_prompt_provider_payload_or_secret';
    const redactionPolicyFingerprint = createHash('sha256')
      .update(
        stableFixtureStringify({
          version:
            'prompt-registry-repair-gate-manifest-redaction-policy-fingerprint/v1',
          artifact,
          boundary: repairGateManifest.boundary,
          manifestFingerprint: repairGateManifest.fingerprint,
          manifestVersion: repairGateManifest.version,
          redactionPolicyStatus,
          redactionPolicyVersion,
          registryFingerprint: repairGateManifest.registryFingerprint,
          registryId: repairGateManifest.registryId,
        })
      )
      .digest('hex')
      .slice(0, 16);
    const exportPolicyVersion =
      'prompt-registry-repair-gate-manifest-export-policy/v1';
    const exportPolicyStatus = 'read_only_projection';
    const exportPolicyFingerprint = createHash('sha256')
      .update(
        stableFixtureStringify({
          version:
            'prompt-registry-repair-gate-manifest-export-policy-fingerprint/v1',
          artifact,
          boundary: repairGateManifest.boundary,
          exportPolicyStatus,
          exportPolicyVersion,
          filename,
          gateStatus: repairGateManifest.gateStatus,
          manifestFingerprint: repairGateManifest.fingerprint,
          manifestVersion: repairGateManifest.version,
          metadataFilename,
          mime,
          publishStatus: repairGateManifest.publishStatus,
          redactionPolicyFingerprint,
          registryFingerprint: repairGateManifest.registryFingerprint,
          registryId: repairGateManifest.registryId,
          registryUpdatedAt: repairGateManifest.registryUpdatedAt,
        })
      )
      .digest('hex')
      .slice(0, 16);
    const auditEventVersion =
      'prompt-registry-repair-gate-manifest-export-audit-event/v1';
    const auditEventStatus = 'not_created_read_only';
    const auditEventCreated = false;
    const auditEventFingerprint = createHash('sha256')
      .update(
        stableFixtureStringify({
          version:
            'prompt-registry-repair-gate-manifest-audit-event-fingerprint/v1',
          auditEventCreated,
          auditEventStatus,
          auditEventVersion,
          exportPolicyFingerprint,
          manifestFingerprint: repairGateManifest.fingerprint,
          registryId: repairGateManifest.registryId,
        })
      )
      .digest('hex')
      .slice(0, 16);
    const retentionPolicyVersion =
      'prompt-registry-repair-gate-manifest-retention-policy/v1';
    const retentionPolicyStatus = 'not_persisted_read_only';
    const retentionPolicyFingerprint = createHash('sha256')
      .update(
        stableFixtureStringify({
          version:
            'prompt-registry-repair-gate-manifest-retention-policy-fingerprint/v1',
          artifact,
          boundary: repairGateManifest.boundary,
          exportPolicyFingerprint,
          manifestFingerprint: repairGateManifest.fingerprint,
          registryId: repairGateManifest.registryId,
          retentionPolicyStatus,
          retentionPolicyVersion,
        })
      )
      .digest('hex')
      .slice(0, 16);

    return {
      version: 'prompt-registry-repair-gate-manifest-export-metadata/v1',
      artifact,
      filename,
      mime,
      metadataFilename,
      manifestVersion: repairGateManifest.version,
      manifestFingerprint: repairGateManifest.fingerprint,
      registryFingerprint: repairGateManifest.registryFingerprint,
      registryId: repairGateManifest.registryId,
      registryUpdatedAt: repairGateManifest.registryUpdatedAt,
      gateStatus: repairGateManifest.gateStatus,
      publishStatus: repairGateManifest.publishStatus,
      boundary: repairGateManifest.boundary,
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
  })();

  return {
    ...verdict,
    repairActionPreview,
    repairGateManifest,
    repairGateManifestExportMetadata,
  };
}

/*
 * The helper above keeps the fixtures close to the backend read-only preview
 * contract while still letting tests pin representative fingerprints.
 */

const readyPublishGateVerdict = withRepairActionPreview(
  {
    actionRouteDryRun,
    allowed: true,
    blockingCount: 0,
    errorCount: 0,
    issueCount: 0,
    issues: [],
    modelRoute: {
      available: true,
      behaviorFlags: ['tool_calls'],
      candidateCount: 1,
      candidateConfigPath: 'ai_prompts_metadata.model',
      candidateIndex: 0,
      candidateKind: 'default',
      canonicalModelKey: 'claude-3-5-sonnet-latest',
      checked: true,
      configured: true,
      effectiveSourceFingerprint: 'modelroute11112222',
      effectiveSourceFingerprintInputs:
        modelRouteEffectiveSourceFingerprintInputs,
      effectiveSourceFingerprintVersion:
        modelRouteEffectiveSourceFingerprintVersion,
      fallbackProviderIds: ['anthropic-main', 'openai-fallback'],
      featureKind: 'chat',
      matchedCandidateCount: 1,
      modelBackendKind: 'anthropic',
      modelId: 'claude-3-5-sonnet-latest',
      outputType: 'text',
      policyAllowedPrivacy: ['cloud'],
      policyAllowedProviderIds: ['anthropic-main'],
      policyBlockedProviderIds: [],
      policyEnabled: true,
      policyFeatureKind: 'chat',
      policyPreferredPrivacy: ['cloud'],
      policyWorkspaceId: null,
      policyCandidates: publishGatePolicyCandidates,
      protocol: 'anthropic',
      providerId: 'anthropic-main',
      ...defaultPublishGateRouteProviderMetadata,
      reasons: [
        'model_route_available',
        'capability_matched',
        'registry_selected',
      ],
      requestedModelId: 'claude-3-5-sonnet-latest',
      requestedModelSource: 'registry',
      requestLayer: 'messages',
      routeModelAliasMatched: false,
      routeModelDefinitionAliases: ['make-it-real'],
      routeModelDefinitionId: 'claude-3-5-sonnet-latest',
      routeModelDefinitionSource: 'native_registry',
      routeRawModelId: null,
      routeCandidates: [defaultPublishGateRouteCandidate],
      routeTrace: defaultPublishGateRouteTrace,
    },
    modelRoutes: [
      {
        available: true,
        behaviorFlags: ['tool_calls'],
        candidateCount: 1,
        candidateConfigPath: 'ai_prompts_metadata.model',
        candidateIndex: 0,
        candidateKind: 'default',
        canonicalModelKey: 'claude-3-5-sonnet-latest',
        checked: true,
        configured: true,
        effectiveSourceFingerprint: 'modelroute11112222',
        effectiveSourceFingerprintInputs:
          modelRouteEffectiveSourceFingerprintInputs,
        effectiveSourceFingerprintVersion:
          modelRouteEffectiveSourceFingerprintVersion,
        fallbackProviderIds: ['anthropic-main', 'openai-fallback'],
        featureKind: 'chat',
        matchedCandidateCount: 1,
        modelBackendKind: 'anthropic',
        modelId: 'claude-3-5-sonnet-latest',
        outputType: 'text',
        policyAllowedPrivacy: ['cloud'],
        policyAllowedProviderIds: ['anthropic-main'],
        policyBlockedProviderIds: [],
        policyEnabled: true,
        policyFeatureKind: 'chat',
        policyPreferredPrivacy: ['cloud'],
        policyWorkspaceId: null,
        policyCandidates: publishGatePolicyCandidates,
        protocol: 'anthropic',
        providerId: 'anthropic-main',
        ...defaultPublishGateRouteProviderMetadata,
        reasons: [
          'model_route_available',
          'capability_matched',
          'registry_selected',
        ],
        requestedModelId: 'claude-3-5-sonnet-latest',
        requestedModelSource: 'registry',
        requestLayer: 'messages',
        routeModelAliasMatched: false,
        routeModelDefinitionAliases: ['make-it-real'],
        routeModelDefinitionId: 'claude-3-5-sonnet-latest',
        routeModelDefinitionSource: 'native_registry',
        routeRawModelId: null,
        routeCandidates: [defaultPublishGateRouteCandidate],
        routeTrace: defaultPublishGateRouteTrace,
      },
      {
        available: false,
        behaviorFlags: [],
        candidateCount: 1,
        candidateConfigPath: 'copilot.prompts.overrides[].optionalModels',
        candidateIndex: 0,
        candidateKind: 'optional',
        canonicalModelKey: null,
        checked: true,
        configured: true,
        diagnosticsErrorCode: 'RouteDiagnosticsFailure',
        diagnosticsErrorMessage: 'provider registry diagnostics unavailable',
        diagnosticsErrorStage: 'describe_route_candidates',
        effectiveSourceFingerprint: 'modelroute33334444',
        effectiveSourceFingerprintInputs:
          modelRouteEffectiveSourceFingerprintInputs,
        effectiveSourceFingerprintVersion:
          modelRouteEffectiveSourceFingerprintVersion,
        fallbackProviderIds: [],
        featureKind: 'chat',
        matchedCandidateCount: 0,
        modelBackendKind: null,
        modelId: null,
        outputType: 'text',
        policyAllowedPrivacy: ['cloud'],
        policyAllowedProviderIds: ['anthropic-main'],
        policyBlockedProviderIds: [],
        policyEnabled: true,
        policyFeatureKind: 'chat',
        policyPreferredPrivacy: ['cloud'],
        policyWorkspaceId: null,
        policyCandidates: publishGatePolicyCandidates,
        protocol: null,
        providerId: null,
        providerConfiguredModelCount: 2,
        providerConfiguredModelIds: [
          'missing-object',
          'openai-fallback/missing-object',
        ],
        providerHealth: 'degraded',
        providerHealthCheckedAt: '2026-06-17T03:30:00.000Z',
        providerHealthLastError: null,
        providerName: 'OpenAI Fallback',
        providerPrivacy: 'cloud',
        providerPriority: 20,
        providerProfileConfigPath:
          'copilot.providers.profiles[id=openai-fallback]',
        providerProfileId: 'openai-fallback',
        providerProfileSource: 'configured',
        providerSource: 'configured',
        providerType: 'openai',
        reasons: ['model_route_unavailable', 'capability_mismatch'],
        requestedModelId: 'openai-fallback/missing-object',
        requestedModelSource: 'override',
        requestLayer: null,
        routeModelAliasMatched: null,
        routeModelDefinitionAliases: null,
        routeModelDefinitionId: null,
        routeModelDefinitionSource: null,
        routeRawModelId: null,
        routeCandidates: optionalPublishGateRouteCandidates,
        routeTrace: optionalPublishGateRouteTrace,
      },
      {
        available: true,
        behaviorFlags: ['tool_calls'],
        candidateCount: 1,
        candidateConfigPath: 'copilot.providers.profiles[].models',
        candidateIndex: 0,
        candidateKind: 'registry',
        canonicalModelKey: 'office-chat-fast',
        checked: true,
        configured: true,
        effectiveSourceFingerprint: 'modelroute55556666',
        effectiveSourceFingerprintInputs:
          modelRouteEffectiveSourceFingerprintInputs,
        effectiveSourceFingerprintVersion:
          modelRouteEffectiveSourceFingerprintVersion,
        fallbackProviderIds: ['openai-fallback'],
        featureKind: 'chat',
        matchedCandidateCount: 1,
        modelBackendKind: 'openai_chat',
        modelId: 'gpt-4o-mini',
        outputType: 'text',
        policyAllowedPrivacy: ['cloud'],
        policyAllowedProviderIds: ['anthropic-main'],
        policyBlockedProviderIds: [],
        policyEnabled: true,
        policyFeatureKind: 'chat',
        policyPreferredPrivacy: ['cloud'],
        policyWorkspaceId: null,
        policyCandidates: publishGatePolicyCandidates,
        protocol: 'openai_chat',
        providerId: 'openai-fallback',
        providerConfiguredModelCount: 2,
        providerConfiguredModelIds: ['office-chat-fast', 'gpt-4o-mini'],
        providerHealth: 'healthy',
        providerHealthCheckedAt: null,
        providerHealthLastError: null,
        providerName: 'OpenAI Fallback',
        providerPrivacy: 'cloud',
        providerPriority: 20,
        providerProfileConfigPath:
          'copilot.providers.profiles[id=openai-fallback]',
        providerProfileId: 'openai-fallback',
        providerProfileSource: 'configured',
        providerSource: 'configured',
        providerType: 'openai',
        reasons: ['model_route_available', 'profile_model_matched'],
        requestedModelId: 'office-chat-fast',
        requestedModelSource: 'registry',
        requestLayer: 'chat_completions',
        routeModelAliasMatched: true,
        routeModelDefinitionAliases: ['office-chat-fast'],
        routeModelDefinitionId: 'office-chat-fast',
        routeModelDefinitionSource: 'provider_profile',
        routeRawModelId: 'gpt-4o-mini',
        routeCandidates: [registryPublishGateRouteCandidate],
        routeTrace: registryPublishGateRouteTrace,
      },
    ],
    taskRoutes: [blockedRoute, readyRoute],
    name: 'Make it real',
    publishStatus: 'allowed',
    reason: 'ready',
    registryFingerprint: 'b1c2d3e4f5061728',
    registryId: 42,
    registryUpdatedAt: '2026-06-17T04:05:06.000Z',
    remediations: [],
    repairActionCatalogFingerprint: 'aaaabbbbccccdddd',
    repairActionMutationGuard: repairActionMutationGuard({
      auditSummary:
        'registry:42 | registryFingerprint:b1c2d3e4f5061728 | catalog:repair-actions/v1 | catalogFingerprint:aaaabbbbccccdddd | recommendations:4 | intent:abc111def2223333 | targetLocators:4 | targetKinds:action_route,model_route,task_route | reviewModes:preview,probe | safety:preview_required,read_only_probe',
      auditSummaryFingerprint: 'aaaabbbb11112222',
      catalogFingerprint: 'aaaabbbbccccdddd',
      expectedRegistryFingerprint: 'b1c2d3e4f5061728',
      expectedRegistryId: 42,
      expectedRegistryUpdatedAt: '2026-06-17T04:05:06.000Z',
      guardFingerprint: '1111aaaabbbbcccc',
      intentFingerprint: 'abc111def2223333',
      inputSchemaFingerprint: 'aaa111bbb222cccc',
      recommendationCategories: ['action_route', 'model_route', 'task_route'],
      recommendationCodes: [
        'action_generate_provider_health_not_healthy',
        'optional_model_route_unavailable',
        'selected_provider_health_not_healthy',
        'workspace_indexing_task_route_unavailable',
      ],
      recommendationFingerprints: [
        '1111222233334444',
        '2222333344445555',
        '3333444455556666',
        '4444555566667777',
      ],
      requiredCapabilities: [
        'action_route.read',
        'model_registry.read',
        'provider_health.probe',
        'provider_profile.read',
        'provider_route.preview',
        'task_route.read',
      ],
      requiredReviewModes: ['preview', 'probe'],
      safetyLevels: ['preview_required', 'read_only_probe'],
      suggestedActionKinds: [
        'check_action_provider_health',
        'check_provider_health',
        'repair_task_model_route',
        'review_non_default_model_route',
      ],
      targetLocatorCount: 4,
      targetLocatorFingerprint: 'ddd111eee222ffff',
      targetLocatorKinds: ['action_route', 'model_route', 'task_route'],
    }),
    repairActionCatalog: [
      repairActionCatalogEntry(
        'check_action_provider_health',
        ['provider_profile.read', 'provider_health.probe'],
        'read_only_probe'
      ),
      repairActionCatalogEntry(
        'check_provider_health',
        ['provider_profile.read', 'provider_health.probe'],
        'read_only_probe'
      ),
      repairActionCatalogEntry(
        'repair_task_model_route',
        ['task_route.read', 'model_registry.read', 'provider_route.preview'],
        'preview_required'
      ),
      repairActionCatalogEntry(
        'review_non_default_model_route',
        ['model_registry.read', 'provider_route.preview'],
        'preview_required'
      ),
    ],
    repairRecommendations: [
      {
        candidateEvidence: null,
        category: 'model_route',
        code: 'optional_model_route_unavailable',
        detail:
          'No available text provider route was found for optional model "openai-fallback/missing-object".',
        diagnosticsFingerprint: '1111222233334444',
        evidence: [
          'candidate:optional#0',
          'requestedModelId:openai-fallback/missing-object',
          'requestedModelSource:override',
          'featureKind:chat',
          'outputType:text',
          'matchedCandidateCount:0',
          'diagnosticsStage:describe_route_candidates',
          'diagnosticsCode:RouteDiagnosticsFailure',
          'diagnosticsMessage:provider registry diagnostics unavailable',
          'reason:model_route_unavailable',
          'reason:capability_mismatch',
        ],
        instanceKey: 'chat:text:optional:0:openai-fallback/missing-object',
        severity: 'warning',
        suggestedAction:
          'Either add a provider route for this optional/pro/registry model, or remove the unroutable candidate from the prompt/model registry list.',
        suggestedActionCatalogVersion: 'repair-actions/v1',
        suggestedActionInputSchema: repairActionInputSchemaFixture,
        suggestedActionKind: 'review_non_default_model_route',
        suggestedActionRequiredCapabilities: [
          'model_registry.read',
          'provider_route.preview',
        ],
        suggestedActionSafety: 'preview_required',
        target: 'copilot.prompts.overrides[].optionalModels',
        targetLocator: {
          candidateIndex: 0,
          candidateKind: 'optional',
          featureKind: 'chat',
          kind: 'model_route',
          outputType: 'text',
          path: 'copilot.prompts.overrides[].optionalModels',
          providerId: null,
          providerProfileConfigPath:
            'copilot.providers.profiles[id=openai-fallback]',
          providerProfileId: 'openai-fallback',
          providerProfileSource: 'configured',
          registryFingerprint: 'b1c2d3e4f5061728',
          registryId: 42,
          registryUpdatedAt: '2026-06-17T04:05:06.000Z',
          requestedModelId: 'openai-fallback/missing-object',
          requestedModelSource: 'override',
        },
        title: 'Review non-default model route',
      },
      {
        candidateEvidence: null,
        category: 'provider_health',
        code: 'selected_provider_health_not_healthy',
        detail:
          'Selected provider "openai-fallback" reports health "degraded".',
        diagnosticsFingerprint: '2222333344445555',
        evidence: [
          'providerId:openai-fallback',
          'health:degraded',
          'checkedAt:2026-06-17T03:30:00.000Z',
        ],
        instanceKey: 'chat:text:optional:0:openai-fallback/missing-object',
        severity: 'warning',
        suggestedAction:
          'Check the provider profile credentials, endpoint, and model availability before relying on this route.',
        suggestedActionCatalogVersion: 'repair-actions/v1',
        suggestedActionInputSchema: repairActionInputSchemaFixture,
        suggestedActionKind: 'check_provider_health',
        suggestedActionRequiredCapabilities: [
          'provider_profile.read',
          'provider_health.probe',
        ],
        suggestedActionSafety: 'read_only_probe',
        target: 'copilot.providers.profiles[id=openai-fallback]',
        targetLocator: {
          candidateIndex: 0,
          candidateKind: 'optional',
          featureKind: 'chat',
          kind: 'model_route',
          outputType: 'text',
          path: 'copilot.providers.profiles[id=openai-fallback]',
          providerId: null,
          providerProfileConfigPath:
            'copilot.providers.profiles[id=openai-fallback]',
          providerProfileId: 'openai-fallback',
          providerProfileSource: 'configured',
          registryFingerprint: 'b1c2d3e4f5061728',
          registryId: 42,
          registryUpdatedAt: '2026-06-17T04:05:06.000Z',
          requestedModelId: 'openai-fallback/missing-object',
          requestedModelSource: 'override',
        },
        title: 'Check provider health',
      },
      {
        candidateEvidence: [
          candidateEvidenceFixture({
            allowed: true,
            available: false,
            candidateIndex: 0,
            candidateKey: 'policy:workspace_indexing:global:ollama-main',
            candidateModelIds: null,
            diagnosticsErrors: blockedRoute.diagnosticsErrors,
            diagnosticsErrorSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                blockedRoute.diagnosticsErrors
              ),
            dimensionMismatch: blockedRoute.dimensionMismatch,
            embeddingIndexContractDimensions:
              blockedRoute.embeddingIndexContractDimensions,
            embeddingIndexContractFingerprint:
              blockedRoute.embeddingIndexContractFingerprint,
            embeddingIndexContractStatus:
              blockedRoute.embeddingIndexContractStatus,
            embeddingIndexContractVersion:
              blockedRoute.embeddingIndexContractVersion,
            fallbackProviderIds: blockedRoute.fallbackProviderIds,
            modelEmbeddingDimensions: blockedRoute.modelEmbeddingDimensions,
            modelId: null,
            preparedModelId: null,
            prepareCandidateSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRoutePrepareCandidateSnapshotFixture(
                  blockedRoute.prepareCandidates
                )
              ),
            prepareCandidates: taskRoutePrepareCandidateSnapshotFixture(
              blockedRoute.prepareCandidates
            ),
            preparedRouteSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRoutePreparedRouteSnapshotFixture(
                  blockedRoute.preparedRoutes
                )
              ),
            preparedRouteOrderFingerprint: taskRouteSnapshotFingerprintFixture(
              taskRoutePreparedRouteOrderSnapshotFixture(
                blockedRoute.preparedRoutes
              )
            ),
            preparedRoutes: taskRoutePreparedRouteSnapshotFixture(
              blockedRoute.preparedRoutes
            ),
            providerCapabilitySnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteProviderCapabilitySnapshotFixture(blockedRoute)
              ),
            providerHealthSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteProviderHealthSnapshotFixture(blockedRoute)
              ),
            providerCostSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteProviderCostSnapshotFixture(blockedRoute)
              ),
            providerLimitSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteProviderLimitSnapshotFixture(blockedRoute)
              ),
            taskRouteDimensionSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteDimensionSnapshotFixture(blockedRoute)
              ),
            taskRouteEmbeddingIndexContractSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteEmbeddingIndexContractSnapshotFixture(blockedRoute)
              ),
            taskRouteEffectiveSourceFingerprint:
              blockedRoute.effectiveSourceFingerprint,
            taskRouteModelSourceSnapshotEntries:
              taskRouteModelSourceSnapshotFixture(blockedRoute),
            taskRouteModelSourceSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteModelSourceSnapshotFixture(blockedRoute)
              ),
            preparedRouteTargets: blockedRoute.preparedRouteTargets,
            preparedRouteTargetFingerprint:
              blockedRoute.preparedRouteTargetFingerprint,
            policyCandidates: blockedRoute.policyCandidates,
            policyCandidateSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                blockedRoute.policyCandidates
              ),
            providerConfiguredModelCount: 1,
            providerConfiguredModelIds: ['workspace-embedding'],
            providerId: 'ollama-main',
            providerName: 'Local Ollama',
            providerPriority: 10,
            providerProfileConfigPath:
              'copilot.providers.profiles[id=ollama-main]',
            providerProfileId: 'ollama-main',
            providerProfileSource: 'configured',
            providerSource: 'configured',
            providerType: 'openai_compatible',
            reasons: ['policy_allowed'],
            requestedDimensions: blockedRoute.requestedDimensions,
            requestedModelId: null,
            requestedModelConfigKey: 'workspaceIndexing',
            requestedModelConfigPath: 'copilot.tasks.models.workspaceIndexing',
            requestedModelSource: 'workspace_indexing',
            routeCandidateSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(blockedRoute.routeCandidates),
            routeCandidates: blockedRoute.routeCandidates,
            routeModelDefinitionId: null,
            routeTrace: blockedRoute.routeTrace,
            routeTracePhases: blockedRoute.routeTrace.map(phase => phase.phase),
            routeTraceSnapshotFingerprint: taskRouteSnapshotFingerprintFixture(
              blockedRoute.routeTrace
            ),
            scope: 'policyCandidate',
          }),
          candidateEvidenceFixture({
            candidateIndex: 0,
            candidateKey: 'route:ollama-main',
            candidateModelIds: ['workspace-embedding'],
            fallbackProviderIds: blockedRoute.fallbackProviderIds,
            health: 'down',
            healthCheckedAt: '2026-06-16T10:00:00.000Z',
            diagnosticsErrors: blockedRoute.diagnosticsErrors,
            diagnosticsErrorSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                blockedRoute.diagnosticsErrors
              ),
            dimensionMismatch: blockedRoute.dimensionMismatch,
            embeddingIndexContractDimensions:
              blockedRoute.embeddingIndexContractDimensions,
            embeddingIndexContractFingerprint:
              blockedRoute.embeddingIndexContractFingerprint,
            embeddingIndexContractStatus:
              blockedRoute.embeddingIndexContractStatus,
            embeddingIndexContractVersion:
              blockedRoute.embeddingIndexContractVersion,
            matched: false,
            modelEmbeddingDimensions: blockedRoute.modelEmbeddingDimensions,
            modelId: 'workspace-embedding',
            preparedModelId: null,
            prepareCandidateSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRoutePrepareCandidateSnapshotFixture(
                  blockedRoute.prepareCandidates
                )
              ),
            prepareCandidates: taskRoutePrepareCandidateSnapshotFixture(
              blockedRoute.prepareCandidates
            ),
            preparedRouteSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRoutePreparedRouteSnapshotFixture(
                  blockedRoute.preparedRoutes
                )
              ),
            preparedRouteOrderFingerprint: taskRouteSnapshotFingerprintFixture(
              taskRoutePreparedRouteOrderSnapshotFixture(
                blockedRoute.preparedRoutes
              )
            ),
            preparedRoutes: taskRoutePreparedRouteSnapshotFixture(
              blockedRoute.preparedRoutes
            ),
            providerCapabilitySnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteProviderCapabilitySnapshotFixture(blockedRoute)
              ),
            providerHealthSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteProviderHealthSnapshotFixture(blockedRoute)
              ),
            providerCostSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteProviderCostSnapshotFixture(blockedRoute)
              ),
            providerLimitSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteProviderLimitSnapshotFixture(blockedRoute)
              ),
            taskRouteDimensionSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteDimensionSnapshotFixture(blockedRoute)
              ),
            taskRouteEmbeddingIndexContractSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteEmbeddingIndexContractSnapshotFixture(blockedRoute)
              ),
            taskRouteEffectiveSourceFingerprint:
              blockedRoute.effectiveSourceFingerprint,
            taskRouteModelSourceSnapshotEntries:
              taskRouteModelSourceSnapshotFixture(blockedRoute),
            taskRouteModelSourceSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteModelSourceSnapshotFixture(blockedRoute)
              ),
            preparedRouteTargets: blockedRoute.preparedRouteTargets,
            preparedRouteTargetFingerprint:
              blockedRoute.preparedRouteTargetFingerprint,
            policyCandidates: blockedRoute.policyCandidates,
            policyCandidateSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                blockedRoute.policyCandidates
              ),
            privacy: 'local',
            providerConfiguredModelCount: 1,
            providerConfiguredModelIds: ['workspace-embedding'],
            providerId: 'ollama-main',
            providerName: 'Local Ollama',
            providerPriority: 10,
            providerProfileConfigPath:
              'copilot.providers.profiles[id=ollama-main]',
            providerProfileId: 'ollama-main',
            providerProfileSource: 'configured',
            providerSource: 'configured',
            providerType: 'openai_compatible',
            reasons: ['model_alias_matched'],
            registryAvailable: true,
            registryKind: 'byok',
            registrySelected: false,
            requestedDimensions: blockedRoute.requestedDimensions,
            requestedModelId: 'workspace-embedding',
            requestedModelConfigKey: 'workspaceIndexing',
            requestedModelConfigPath: 'copilot.tasks.models.workspaceIndexing',
            requestedModelSource: 'workspace_indexing',
            costInputPer1M: 0.01,
            costOutputPer1M: 0.02,
            routeAttachmentAllowRemoteUrls: true,
            routeAttachmentKinds: ['file'],
            routeAttachmentSourceKinds: ['url', 'data'],
            routeCandidateSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(blockedRoute.routeCandidates),
            routeCandidates: blockedRoute.routeCandidates,
            routeContextWindow: 8192,
            routeEmbeddingDimensions: 768,
            routeInputTypes: ['text'],
            routeMaxOutputTokens: 1024,
            routeModelAliasMatched: false,
            routeModelDefinitionAliases: ['nomic-embed-text'],
            routeModelDefinitionId: 'workspace-embedding',
            routeModelDefinitionSource: 'provider_profile',
            routeOutputTypes: ['embedding'],
            routeRawModelId: 'nomic-embed-text',
            routeStructuredAttachmentAllowRemoteUrls: false,
            routeStructuredAttachmentKinds: ['image'],
            routeStructuredAttachmentSourceKinds: ['file_handle'],
            routeTrace: blockedRoute.routeTrace,
            routeTracePhases: blockedRoute.routeTrace.map(phase => phase.phase),
            routeTraceSnapshotFingerprint: taskRouteSnapshotFingerprintFixture(
              blockedRoute.routeTrace
            ),
            scope: 'routeCandidate',
          }),
          candidateEvidenceFixture({
            candidateIndex: 0,
            candidateKey: 'prepare:ollama-main',
            candidateModelIds: ['workspace-embedding'],
            errorCategory: 'network',
            errorCode: 'prepare_failed',
            fallbackProviderIds: blockedRoute.fallbackProviderIds,
            health: 'down',
            healthCheckedAt: '2026-06-16T10:00:00.000Z',
            diagnosticsErrors: blockedRoute.diagnosticsErrors,
            diagnosticsErrorSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                blockedRoute.diagnosticsErrors
              ),
            dimensionMismatch: blockedRoute.dimensionMismatch,
            embeddingIndexContractDimensions:
              blockedRoute.embeddingIndexContractDimensions,
            embeddingIndexContractFingerprint:
              blockedRoute.embeddingIndexContractFingerprint,
            embeddingIndexContractStatus:
              blockedRoute.embeddingIndexContractStatus,
            embeddingIndexContractVersion:
              blockedRoute.embeddingIndexContractVersion,
            modelEmbeddingDimensions: blockedRoute.modelEmbeddingDimensions,
            modelId: 'workspace-embedding',
            prepared: false,
            preparedModelId: 'nomic-embed-text',
            prepareCandidateSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRoutePrepareCandidateSnapshotFixture(
                  blockedRoute.prepareCandidates
                )
              ),
            prepareCandidates: taskRoutePrepareCandidateSnapshotFixture(
              blockedRoute.prepareCandidates
            ),
            preparedRouteSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRoutePreparedRouteSnapshotFixture(
                  blockedRoute.preparedRoutes
                )
              ),
            preparedRouteOrderFingerprint: taskRouteSnapshotFingerprintFixture(
              taskRoutePreparedRouteOrderSnapshotFixture(
                blockedRoute.preparedRoutes
              )
            ),
            preparedRoutes: taskRoutePreparedRouteSnapshotFixture(
              blockedRoute.preparedRoutes
            ),
            providerCapabilitySnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteProviderCapabilitySnapshotFixture(blockedRoute)
              ),
            providerHealthSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteProviderHealthSnapshotFixture(blockedRoute)
              ),
            providerCostSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteProviderCostSnapshotFixture(blockedRoute)
              ),
            providerLimitSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteProviderLimitSnapshotFixture(blockedRoute)
              ),
            taskRouteDimensionSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteDimensionSnapshotFixture(blockedRoute)
              ),
            taskRouteEmbeddingIndexContractSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteEmbeddingIndexContractSnapshotFixture(blockedRoute)
              ),
            taskRouteEffectiveSourceFingerprint:
              blockedRoute.effectiveSourceFingerprint,
            taskRouteModelSourceSnapshotEntries:
              taskRouteModelSourceSnapshotFixture(blockedRoute),
            taskRouteModelSourceSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                taskRouteModelSourceSnapshotFixture(blockedRoute)
              ),
            preparedRouteTargets: blockedRoute.preparedRouteTargets,
            preparedRouteTargetFingerprint:
              blockedRoute.preparedRouteTargetFingerprint,
            policyCandidates: blockedRoute.policyCandidates,
            policyCandidateSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(
                blockedRoute.policyCandidates
              ),
            privacy: 'local',
            providerConfiguredModelCount: 1,
            providerConfiguredModelIds: ['workspace-embedding'],
            providerId: 'ollama-main',
            providerName: 'Local Ollama',
            providerPriority: 10,
            providerProfileConfigPath:
              'copilot.providers.profiles[id=ollama-main]',
            providerProfileId: 'ollama-main',
            providerProfileSource: 'configured',
            providerSource: 'configured',
            providerType: 'openai_compatible',
            reasons: ['prepared_route_candidate'],
            registryAvailable: true,
            registryKind: 'byok',
            registrySelected: false,
            requestedDimensions: blockedRoute.requestedDimensions,
            requestedModelId: 'workspace-embedding',
            requestedModelConfigKey: 'workspaceIndexing',
            requestedModelConfigPath: 'copilot.tasks.models.workspaceIndexing',
            requestedModelSource: 'workspace_indexing',
            costInputPer1M: 0.01,
            costOutputPer1M: 0.02,
            routeAttachmentAllowRemoteUrls: true,
            routeAttachmentKinds: ['file'],
            routeAttachmentSourceKinds: ['url'],
            routeCandidateSnapshotFingerprint:
              taskRouteSnapshotFingerprintFixture(blockedRoute.routeCandidates),
            routeCandidates: blockedRoute.routeCandidates,
            routeContextWindow: 8192,
            routeEmbeddingDimensions: 768,
            routeInputTypes: ['text'],
            routeMaxOutputTokens: 1024,
            routeModelAliasMatched: false,
            routeModelDefinitionAliases: ['nomic-embed-text'],
            routeModelDefinitionId: 'workspace-embedding',
            routeModelDefinitionSource: 'provider_profile',
            routeOutputTypes: ['embedding'],
            routeRawModelId: 'nomic-embed-text',
            routeStructuredAttachmentAllowRemoteUrls: false,
            routeStructuredAttachmentKinds: ['image'],
            routeStructuredAttachmentSourceKinds: ['file_handle'],
            routeTrace: blockedRoute.routeTrace,
            routeTracePhases: blockedRoute.routeTrace.map(phase => phase.phase),
            routeTraceSnapshotFingerprint: taskRouteSnapshotFingerprintFixture(
              blockedRoute.routeTrace
            ),
            scope: 'prepareCandidate',
          }),
        ],
        category: 'task_route',
        code: 'workspace_indexing_task_route_unavailable',
        detail:
          'Task route "workspace_indexing" has no prepared provider route.',
        diagnosticsFingerprint: '3333444455556666',
        evidence: [
          'featureKind:workspace_indexing',
          'configured:false',
          'preparedProviderCount:0',
          'requestedModelId:workspace-embedding',
          'requestedModelSource:task_config',
          'diagnosticsStage:describe_embedding_prepare_candidates',
          'diagnosticsCode:EmbeddingPrepareDiagnosticsFailure',
          'diagnosticsMessage:embedding prepare diagnostics unavailable',
          'policyCandidate#0:providerProfileId:ollama-main',
          'policyCandidate#0:providerProfileConfigPath:copilot.providers.profiles[id=ollama-main]',
          'routeCandidate#0:providerConfiguredModel:workspace-embedding',
          'prepareCandidate#0:preparedModelId:nomic-embed-text',
        ],
        instanceKey:
          'workspace_indexing:workspaceIndexing:workspace-embedding:unavailable',
        severity: 'warning',
        suggestedAction:
          'Configure copilot.tasks.models and provider model definitions so this task has a matching prepared route.',
        suggestedActionCatalogVersion: 'repair-actions/v1',
        suggestedActionInputSchema: repairActionInputSchemaFixture,
        suggestedActionKind: 'repair_task_model_route',
        suggestedActionRequiredCapabilities: [
          'task_route.read',
          'model_registry.read',
          'provider_route.preview',
        ],
        suggestedActionSafety: 'preview_required',
        target: 'copilot.tasks.models.workspaceIndexing',
        targetLocator: {
          featureKind: 'workspace_indexing',
          kind: 'task_route',
          path: 'copilot.tasks.models.workspaceIndexing',
          providerId: null,
          registryFingerprint: 'b1c2d3e4f5061728',
          registryId: 42,
          registryUpdatedAt: '2026-06-17T04:05:06.000Z',
          requestedModelConfigKey: 'workspaceIndexing',
          requestedModelConfigPath: 'copilot.tasks.models.workspaceIndexing',
          requestedModelId: 'workspace-embedding',
          requestedModelSource: 'task_config',
        },
        title: 'Repair task model route',
      },
      {
        candidateEvidence: null,
        category: 'action_route',
        code: 'action_generate_provider_health_not_healthy',
        detail:
          'Action dry-run step "generate" selected provider "openai-fallback" with health "degraded".',
        diagnosticsFingerprint: '4444555566667777',
        evidence: [
          'actionId:make-it-real',
          'stepId:generate',
          'kind:structured',
          'providerId:openai-fallback',
          'routeIndex:0',
          'fallbackOrderIndex:0',
          'health:degraded',
          'checkedAt:2026-06-17T09:00:00.000Z',
          'lastError:provider probe timed out',
          'providerProfileConfigPath:copilot.providers.profiles[id=openai-fallback]',
          'requestedModelId:office-structured',
        ],
        instanceKey: 'make-it-real:generate:openai-fallback:0',
        severity: 'warning',
        suggestedAction:
          'Check the action route provider profile health before enabling this action prompt for users.',
        suggestedActionCatalogVersion: 'repair-actions/v1',
        suggestedActionInputSchema: repairActionInputSchemaFixture,
        suggestedActionKind: 'check_action_provider_health',
        suggestedActionRequiredCapabilities: [
          'provider_profile.read',
          'provider_health.probe',
        ],
        suggestedActionSafety: 'read_only_probe',
        target: 'ai_prompts_metadata.action.make-it-real',
        targetLocator: {
          actionId: 'make-it-real',
          fallbackOrderIndex: 0,
          featureKind: 'action',
          kind: 'action_route',
          path: 'ai_prompts_metadata.action.make-it-real',
          providerId: 'openai-fallback',
          providerProfileConfigPath:
            'copilot.providers.profiles[id=openai-fallback]',
          providerProfileId: 'openai-fallback',
          providerProfileSource: 'configured',
          registryFingerprint: 'b1c2d3e4f5061728',
          registryId: 42,
          registryUpdatedAt: '2026-06-17T04:05:06.000Z',
          requestedModelId: 'office-structured',
          requestedModelSource: 'registry',
          routeIndex: 0,
          status: 'succeeded',
          stepId: 'generate',
        },
        title: 'Check action provider health',
      },
    ],
    stale: false,
    staleReasons: [],
    status: 'ready',
  },
  {
    operationFingerprints: [
      '1111aaaa2222bbbb',
      '2222bbbb3333cccc',
      '3333cccc4444dddd',
      '4444dddd5555eeee',
    ],
    operationSetFingerprint: 'abcd1111efef2222',
    authorizationFingerprint: 'aaaa2222bbbb3333',
    approvalPolicyFingerprint: 'aaaa3333bbbb4444',
    candidateEvidenceSetFingerprint: 'aaaa5555bbbb6666',
    taskRouteEffectiveSourceEvidenceSetFingerprint: 'aaaa5656bbbb6767',
    embeddingIndexContractEvidenceSetFingerprint: 'aaaa6666bbbb7777',
    rerankRuntimeContractEvidenceSetFingerprint: 'aaaa8888bbbb9999',
    preparedRouteOrderEvidenceSetFingerprint: 'aaaa7777bbbb8888',
    previewFingerprint: '9999aaaabbbbcccc',
    submissionFingerprint: 'aaaa4444bbbb5555',
    targetLocatorFingerprints: [
      'aaaa1111bbbb2222',
      'bbbb2222cccc3333',
      'cccc3333dddd4444',
      'dddd4444eeee5555',
    ],
  }
);

const rerankRepairPublishGateVerdict = withRepairActionPreview(
  {
    ...readyPublishGateVerdict,
    name: 'Make it real',
    repairActionCatalogFingerprint: 'ddddaaaabbbbcccc',
    repairActionMutationGuard: repairActionMutationGuard({
      auditSummary:
        'registry:42 | registryFingerprint:b1c2d3e4f5061728 | catalog:repair-actions/v1 | catalogFingerprint:ddddaaaabbbbcccc | recommendations:1 | intent:abc999def8887777 | targetLocators:1 | targetKinds:task_route | reviewModes:preview | safety:preview_required',
      auditSummaryFingerprint: 'ddddbbbb11112222',
      catalogFingerprint: 'ddddaaaabbbbcccc',
      expectedRegistryFingerprint: 'b1c2d3e4f5061728',
      expectedRegistryId: 42,
      expectedRegistryUpdatedAt: '2026-06-17T04:05:06.000Z',
      guardFingerprint: 'dddd1111bbbb2222',
      intentFingerprint: 'abc999def8887777',
      inputSchemaFingerprint: 'ddd111bbb222cccc',
      recommendationCategories: ['task_route'],
      recommendationCodes: ['rerank_task_route_unavailable'],
      recommendationFingerprints: ['9999aaaabbbbcccc'],
      requiredCapabilities: [
        'model_registry.read',
        'provider_route.preview',
        'task_route.read',
      ],
      requiredReviewModes: ['preview'],
      safetyLevels: ['preview_required'],
      suggestedActionKinds: ['repair_task_model_route'],
      targetLocatorCount: 1,
      targetLocatorFingerprint: 'ddd999eee888ffff',
      targetLocatorKinds: ['task_route'],
    }),
    repairActionCatalog: [
      repairActionCatalogEntry(
        'repair_task_model_route',
        ['task_route.read', 'model_registry.read', 'provider_route.preview'],
        'preview_required'
      ),
    ],
    repairRecommendations: [
      {
        candidateEvidence: [rerankRepairCandidateEvidence],
        category: 'task_route',
        code: 'rerank_task_route_unavailable',
        detail: 'Task route "rerank" has no prepared provider route.',
        diagnosticsFingerprint: '9999aaaabbbbcccc',
        evidence: [
          'featureKind:rerank',
          'configured:true',
          'preparedProviderCount:1',
          'policyCandidate#0:rerankRuntimeContractVersion:workspace-rerank-runtime/v1',
          'policyCandidate#0:rerankRuntimeContractTopK:5',
          'policyCandidate#0:rerankRuntimeContractStatus:prepared_route_available',
          `policyCandidate#0:taskRouteRerankRuntimeContractSnapshotFingerprint:${readyRouteRerankRuntimeContractSnapshotFingerprint}`,
        ],
        instanceKey: 'rerank:rerank:workspace-rerank:unavailable',
        severity: 'warning',
        suggestedAction:
          'Configure copilot.tasks.models and provider model definitions so this task has a matching prepared route.',
        suggestedActionCatalogVersion: 'repair-actions/v1',
        suggestedActionInputSchema: repairActionInputSchemaFixture,
        suggestedActionKind: 'repair_task_model_route',
        suggestedActionRequiredCapabilities: [
          'task_route.read',
          'model_registry.read',
          'provider_route.preview',
        ],
        suggestedActionSafety: 'preview_required',
        target: 'copilot.tasks.models.rerank',
        targetLocator: {
          featureKind: 'rerank',
          kind: 'task_route',
          path: 'copilot.tasks.models.rerank',
          providerId: 'ollama-main',
          providerProfileConfigPath:
            'copilot.providers.profiles[id=ollama-main]',
          providerProfileId: 'ollama-main',
          providerProfileSource: 'configured',
          registryFingerprint: 'b1c2d3e4f5061728',
          registryId: 42,
          registryUpdatedAt: '2026-06-17T04:05:06.000Z',
          requestedModelConfigKey: 'rerank',
          requestedModelConfigPath: 'copilot.tasks.models.rerank',
          requestedModelId: 'workspace-rerank',
          requestedModelSource: 'rerank',
        },
        title: 'Repair rerank task route',
      },
    ],
  },
  {
    operationFingerprints: ['9999ddddaaaabbbb'],
    operationSetFingerprint: 'dcba1111efef2222',
    authorizationFingerprint: 'dddd2222bbbb3333',
    approvalPolicyFingerprint: 'dddd3333bbbb4444',
    candidateEvidenceSetFingerprint: 'dddd5555bbbb6666',
    taskRouteEffectiveSourceEvidenceSetFingerprint: 'dddd5656bbbb6767',
    embeddingIndexContractEvidenceSetFingerprint: 'dddd6666bbbb7777',
    rerankRuntimeContractEvidenceSetFingerprint: 'dddd8888bbbb9999',
    preparedRouteOrderEvidenceSetFingerprint: 'dddd7777bbbb8888',
    previewFingerprint: 'dddd9999bbbbcccc',
    submissionFingerprint: 'dddd4444bbbb5555',
    targetLocatorFingerprints: ['dddd1111eeee2222'],
  }
);

const blockedPublishGateVerdict = withRepairActionPreview(
  {
    actionRouteDryRun: null,
    allowed: false,
    blockingCount: 3,
    errorCount: 3,
    issueCount: 3,
    issues: [
      {
        code: 'empty',
        detail: 'messages:empty',
        fieldLabel: 'Messages',
        message: 'Prompt registry seed has no messages.',
        messageIndex: null,
        path: 'messages',
        publishBlocking: true,
        reason: 'missing_messages',
        severity: 'error',
        source: 'ai_prompts_messages',
        sourceLocator: {
          field: 'messages',
          messageIndex: null,
          path: 'messages',
          registryFingerprint: 'feedfacecafebeef',
          registryId: 84,
          registryUpdatedAt: '2026-06-17T05:06:07.000Z',
          table: 'ai_prompts_messages',
        },
      },
      {
        code: 'invalid_type',
        detail: 'message[0].content:invalid_type',
        fieldLabel: 'Message 0 Content',
        message: 'Expected string, received null',
        messageIndex: 0,
        path: 'message[0].content',
        publishBlocking: true,
        reason: 'invalid_message',
        severity: 'error',
        source: 'ai_prompts_messages[0].content',
        sourceLocator: {
          field: 'content',
          messageIndex: 0,
          path: 'message[0].content',
          registryFingerprint: 'feedfacecafebeef',
          registryId: 84,
          registryUpdatedAt: '2026-06-17T05:06:07.000Z',
          table: 'ai_prompts_messages',
        },
      },
      {
        code: 'missing',
        detail: 'template.topic:missing_param',
        fieldLabel: 'Template Param',
        message:
          'Prompt template variable "topic" is not declared in ai_prompts_messages.params.',
        messageIndex: 0,
        path: 'message[0].params.topic',
        publishBlocking: true,
        reason: 'missing_template_param',
        severity: 'error',
        source: 'ai_prompts_messages[0].params.topic',
        sourceLocator: {
          field: 'params.topic',
          messageIndex: 0,
          path: 'message[0].params.topic',
          registryFingerprint: 'feedfacecafebeef',
          registryId: 84,
          registryUpdatedAt: '2026-06-17T05:06:07.000Z',
          table: 'ai_prompts_messages',
        },
      },
    ],
    modelRoute: null,
    modelRoutes: [],
    taskRoutes: [],
    name: 'Legacy empty registry prompt',
    publishStatus: 'blocked',
    reason: 'missing_messages',
    registryFingerprint: 'feedfacecafebeef',
    registryId: 84,
    registryUpdatedAt: '2026-06-17T05:06:07.000Z',
    remediations: [
      {
        detail:
          'Create at least one valid prompt message for this registry seed.',
        kind: 'add_messages',
        label: 'Add prompt messages',
        target: 'ai_prompts_messages',
        targetLocator: {
          field: 'messages',
          messageIndex: null,
          path: 'messages',
          registryFingerprint: 'feedfacecafebeef',
          registryId: 84,
          registryUpdatedAt: '2026-06-17T05:06:07.000Z',
          table: 'ai_prompts_messages',
        },
      },
      {
        detail:
          'Declare default values for every prompt template variable in ai_prompts_messages.params.',
        kind: 'declare_template_param',
        label: 'Declare template params',
        target: 'ai_prompts_messages.params',
        targetLocator: {
          field: 'params',
          messageIndex: null,
          path: 'messages.params',
          registryFingerprint: 'feedfacecafebeef',
          registryId: 84,
          registryUpdatedAt: '2026-06-17T05:06:07.000Z',
          table: 'ai_prompts_messages',
        },
      },
    ],
    repairActionCatalog: [
      repairActionCatalogEntry(
        'registry_add_messages',
        ['prompt_registry.read', 'prompt_registry.preview_write'],
        'preview_required'
      ),
      repairActionCatalogEntry(
        'registry_declare_template_param',
        ['prompt_registry.read', 'prompt_registry.preview_write'],
        'preview_required'
      ),
    ],
    repairActionCatalogFingerprint: 'bbbbaaaaccccdddd',
    repairActionMutationGuard: repairActionMutationGuard({
      auditSummary:
        'registry:84 | registryFingerprint:feedfacecafebeef | catalog:repair-actions/v1 | catalogFingerprint:bbbbaaaaccccdddd | recommendations:2 | intent:def222abc3334444 | targetLocators:2 | targetKinds:prompt_registry | reviewModes:preview | safety:preview_required',
      auditSummaryFingerprint: 'bbbbcccc22223333',
      catalogFingerprint: 'bbbbaaaaccccdddd',
      expectedRegistryFingerprint: 'feedfacecafebeef',
      expectedRegistryId: 84,
      expectedRegistryUpdatedAt: '2026-06-17T05:06:07.000Z',
      guardFingerprint: '2222aaaabbbbcccc',
      intentFingerprint: 'def222abc3334444',
      inputSchemaFingerprint: 'bbb222ccc333dddd',
      recommendationCategories: ['prompt_registry'],
      recommendationFingerprints: ['5555666677778888', '6666777788889999'],
      recommendationCodes: [
        'registry_add_messages',
        'registry_declare_template_param',
      ],
      requiredCapabilities: [
        'prompt_registry.preview_write',
        'prompt_registry.read',
      ],
      requiredReviewModes: ['preview'],
      safetyLevels: ['preview_required'],
      suggestedActionKinds: [
        'registry_add_messages',
        'registry_declare_template_param',
      ],
      targetLocatorCount: 2,
      targetLocatorFingerprint: 'eee222fff333aaaa',
      targetLocatorKinds: ['prompt_registry'],
    }),
    repairRecommendations: [
      {
        candidateEvidence: null,
        category: 'prompt_registry',
        code: 'registry_add_messages',
        detail:
          'Create at least one valid prompt message for this registry seed.',
        diagnosticsFingerprint: '5555666677778888',
        evidence: [
          'registryId:84',
          'target:ai_prompts_messages',
          'kind:add_messages',
        ],
        severity: 'error',
        suggestedAction:
          'Create at least one valid prompt message for this registry seed.',
        suggestedActionCatalogVersion: 'repair-actions/v1',
        suggestedActionInputSchema: repairActionInputSchemaFixture,
        suggestedActionKind: 'registry_add_messages',
        suggestedActionRequiredCapabilities: [
          'prompt_registry.read',
          'prompt_registry.preview_write',
        ],
        suggestedActionSafety: 'preview_required',
        target: 'ai_prompts_messages',
        targetLocator: {
          kind: 'prompt_registry',
          path: 'ai_prompts_messages',
          registryFingerprint: 'feedfacecafebeef',
          registryId: 84,
          registryUpdatedAt: '2026-06-17T05:06:07.000Z',
        },
        title: 'Add prompt messages',
      },
      {
        candidateEvidence: null,
        category: 'prompt_registry',
        code: 'registry_declare_template_param',
        detail:
          'Declare default values for every prompt template variable in ai_prompts_messages.params.',
        diagnosticsFingerprint: '6666777788889999',
        evidence: [
          'registryId:84',
          'target:ai_prompts_messages.params',
          'kind:declare_template_param',
        ],
        severity: 'error',
        suggestedAction:
          'Declare default values for every prompt template variable in ai_prompts_messages.params.',
        suggestedActionCatalogVersion: 'repair-actions/v1',
        suggestedActionInputSchema: repairActionInputSchemaFixture,
        suggestedActionKind: 'registry_declare_template_param',
        suggestedActionRequiredCapabilities: [
          'prompt_registry.read',
          'prompt_registry.preview_write',
        ],
        suggestedActionSafety: 'preview_required',
        target: 'ai_prompts_messages.params',
        targetLocator: {
          kind: 'prompt_registry',
          path: 'ai_prompts_messages.params',
          registryFingerprint: 'feedfacecafebeef',
          registryId: 84,
          registryUpdatedAt: '2026-06-17T05:06:07.000Z',
        },
        title: 'Declare template params',
      },
    ],
    stale: false,
    staleReasons: [],
    status: 'ignored',
  },
  {
    operationFingerprints: ['5555eeee6666ffff', '6666ffff7777aaaa'],
    operationSetFingerprint: 'bcde2222fafa3333',
    authorizationFingerprint: 'bbbb3333cccc4444',
    approvalPolicyFingerprint: 'bbbb4444cccc5555',
    candidateEvidenceSetFingerprint: 'bbbb6666cccc7777',
    taskRouteEffectiveSourceEvidenceSetFingerprint: 'bbbb6767cccc7878',
    embeddingIndexContractEvidenceSetFingerprint: 'bbbb7777cccc8888',
    rerankRuntimeContractEvidenceSetFingerprint: 'bbbb9999cccc0000',
    preparedRouteOrderEvidenceSetFingerprint: 'bbbb8888cccc9999',
    previewFingerprint: '8888aaaabbbbcccc',
    submissionFingerprint: 'bbbb5555cccc6666',
    targetLocatorFingerprints: ['eeee5555ffff6666', 'ffff6666aaaa7777'],
  }
);

const actionDryRunFailedPublishGateVerdict = withRepairActionPreview(
  {
    ...readyPublishGateVerdict,
    actionRouteDryRun: failedActionRouteDryRun,
    repairActionCatalogFingerprint: 'ccccbbbbaaaadddd',
    repairActionMutationGuard: repairActionMutationGuard({
      auditSummary:
        'registry:42 | registryFingerprint:b1c2d3e4f5061728 | catalog:repair-actions/v1 | catalogFingerprint:ccccbbbbaaaadddd | recommendations:5 | intent:fed333cba4445555 | targetLocators:5 | targetKinds:action_route,model_route,task_route | reviewModes:dry_run,preview,probe | safety:dry_run_required,preview_required,read_only_probe',
      auditSummaryFingerprint: 'ccccdddd33334444',
      catalogFingerprint: 'ccccbbbbaaaadddd',
      expectedRegistryFingerprint: 'b1c2d3e4f5061728',
      expectedRegistryId: 42,
      expectedRegistryUpdatedAt: '2026-06-17T04:05:06.000Z',
      guardFingerprint: '3333aaaabbbbcccc',
      intentFingerprint: 'fed333cba4445555',
      inputSchemaFingerprint: 'ccc333ddd444eeee',
      recommendationCategories: [
        ...readyPublishGateVerdict.repairActionMutationGuard
          .recommendationCategories,
      ],
      recommendationFingerprints: [
        ...readyPublishGateVerdict.repairActionMutationGuard
          .recommendationFingerprints,
        '777788889999aaaa',
      ],
      recommendationCodes: [
        'action_generate_provider_health_not_healthy',
        'action_route_dry_run_failed',
        'optional_model_route_unavailable',
        'selected_provider_health_not_healthy',
        'workspace_indexing_task_route_unavailable',
      ],
      requiredCapabilities: [
        ...readyPublishGateVerdict.repairActionMutationGuard
          .requiredCapabilities,
      ],
      requiredReviewModes: [
        'dry_run',
        ...readyPublishGateVerdict.repairActionMutationGuard
          .requiredReviewModes,
      ],
      safetyLevels: [
        'dry_run_required',
        ...readyPublishGateVerdict.repairActionMutationGuard.safetyLevels,
      ],
      suggestedActionKinds: [
        'check_action_provider_health',
        'check_provider_health',
        'repair_task_model_route',
        'review_action_route_dry_run',
        'review_non_default_model_route',
      ],
      targetLocatorCount: 5,
      targetLocatorFingerprint: 'fff333aaa444bbbb',
      targetLocatorKinds: [
        ...readyPublishGateVerdict.repairActionMutationGuard.targetLocatorKinds,
      ],
    }),
    repairActionCatalog: [
      ...readyPublishGateVerdict.repairActionCatalog,
      repairActionCatalogEntry(
        'review_action_route_dry_run',
        ['action_route.read', 'action_route.dry_run'],
        'dry_run_required'
      ),
    ],
    repairRecommendations: [
      ...readyPublishGateVerdict.repairRecommendations,
      {
        candidateEvidence: null,
        category: 'action_route',
        code: 'action_route_dry_run_failed',
        detail: 'Action route dry-run failed.',
        diagnosticsFingerprint: '777788889999aaaa',
        evidence: [
          'actionId:make-it-real',
          'featureKind:action',
          'diagnosticsStage:build_structured_plan',
          'diagnosticsCode:StructuredDryRunFailure',
          'diagnosticsMessage:structured dry-run unavailable',
          'errorCode:StructuredDryRunFailure',
          'errorMessage:structured dry-run unavailable',
        ],
        instanceKey: 'make-it-real:dry-run:failed',
        severity: 'warning',
        suggestedAction:
          'Check the action prompt messages, default model, and provider route before enabling this action prompt for users.',
        suggestedActionCatalogVersion: 'repair-actions/v1',
        suggestedActionInputSchema: repairActionInputSchemaFixture,
        suggestedActionKind: 'review_action_route_dry_run',
        suggestedActionRequiredCapabilities: [
          'action_route.read',
          'action_route.dry_run',
        ],
        suggestedActionSafety: 'dry_run_required',
        target: 'ai_prompts_metadata.action.make-it-real',
        targetLocator: {
          actionId: 'make-it-real',
          featureKind: 'action',
          kind: 'action_route',
          path: 'ai_prompts_metadata.action.make-it-real',
          registryFingerprint: 'b1c2d3e4f5061728',
          registryId: 42,
          registryUpdatedAt: '2026-06-17T04:05:06.000Z',
          status: 'failed',
        },
        title: 'Review action route dry-run',
      },
    ],
  },
  {
    operationFingerprints: [
      ...readyPublishGateVerdict.repairActionPreview.operations.map(
        operation => operation.operationFingerprint
      ),
      '7777aaaa8888bbbb',
    ],
    operationSetFingerprint: 'cdef3333abab4444',
    authorizationFingerprint: 'cccc4444dddd5555',
    approvalPolicyFingerprint: 'cccc5555dddd6666',
    candidateEvidenceSetFingerprint: 'cccc7777dddd8888',
    taskRouteEffectiveSourceEvidenceSetFingerprint: 'cccc7878dddd8989',
    embeddingIndexContractEvidenceSetFingerprint: 'cccc8888dddd9999',
    rerankRuntimeContractEvidenceSetFingerprint: 'cccc0000dddd1111',
    preparedRouteOrderEvidenceSetFingerprint: 'cccc9999dddd0000',
    previewFingerprint: '7777aaaabbbbcccc',
    submissionFingerprint: 'cccc6666dddd7777',
    targetLocatorFingerprints: [
      ...readyPublishGateVerdict.repairActionPreview.operations.map(
        operation => operation.targetLocatorFingerprint
      ),
      'aaaa7777bbbb8888',
    ],
  }
);

const workspaceScopePayload = [
  {
    enableAi: true,
    enableDocEmbedding: true,
    id: 'workspace-1',
    initialized: true,
    owner: {
      id: 'user-1',
    },
    role: 'Owner',
    team: true,
  },
  {
    enableAi: false,
    enableDocEmbedding: false,
    id: 'workspace-2',
    initialized: false,
    owner: {
      id: 'user-2',
    },
    role: 'Collaborator',
    team: false,
  },
];

const supportBundlesPayload = [
  {
    actorId: 'user-1',
    archiveByteSize: 512,
    archiveFilename: 'localmind-support-bundle-support-bundle-1.archive.json',
    archiveFingerprint: 'archive111122223333',
    archiveMime: 'application/json',
    archiveStorageKey: 'support-bundles/support-bundle-1/archive.json',
    auditEventCount: 2,
    auditEvents: [
      {
        actorId: 'user-1',
        bundleId: 'support-bundle-1',
        createdAt: '2026-06-20T08:01:00.000Z',
        eventFingerprint: 'auditarchive1111',
        eventType: 'archive_created',
        id: 'support-bundle-audit-2',
        metadata: {
          archiveFingerprint: 'archive111122223333',
          manifestFingerprint: 'manifest111122223333',
        },
        workspaceId: 'workspace-1',
      },
      {
        actorId: 'user-1',
        bundleId: 'support-bundle-1',
        createdAt: '2026-06-20T08:00:00.000Z',
        eventFingerprint: 'auditcreated1111',
        eventType: 'created',
        id: 'support-bundle-audit-1',
        metadata: {
          manifestFingerprint: 'manifest111122223333',
          sourceEvidenceSetFingerprint: 'source111122223333',
        },
        workspaceId: 'workspace-1',
      },
    ],
    createdAt: '2026-06-20T08:00:00.000Z',
    expiresAt: '2026-07-04T08:00:00.000Z',
    failureCode: null,
    failureMessage: null,
    id: 'support-bundle-1',
    manifestByteSize: 256,
    manifestFilename: 'localmind-support-bundle-support-bundle-1.manifest.json',
    manifestFingerprint: 'manifest111122223333',
    manifestMime: 'application/json',
    manifestStorageKey: 'support-bundles/support-bundle-1/manifest.json',
    manifestJson: {
      actorId: 'user-1',
      archive: {
        archiveFingerprint: 'archive111122223333',
        artifactKind: 'archive_json',
        byteSize: 512,
        filename: 'localmind-support-bundle-support-bundle-1.archive.json',
        mime: 'application/json',
        storageKey: 'support-bundles/support-bundle-1/archive.json',
      },
      bundleId: 'support-bundle-1',
      createdAt: '2026-06-20T08:00:00.000Z',
      expiresAt: '2026-07-04T08:00:00.000Z',
      retention: {
        expiresAt: '2026-07-04T08:00:00.000Z',
        status: 'active',
      },
      sourceEvidenceSetFingerprint: 'source111122223333',
      sourceEvidenceSummary: {
        actionRunCount: 3,
        includedSections: [
          'prompt_catalog_count',
          'actor_action_run_count',
          'task_route_summary',
        ],
        promptCatalogItemCount: 4,
        source: 'db_backed_minimal_manifest',
        taskRouteCount: 2,
      },
      version: 'copilot-support-bundle-manifest/v1',
      workspaceId: 'workspace-1',
    },
    retentionStatus: 'active',
    sourceEvidenceSetFingerprint: 'source111122223333',
    sourceEvidenceSummary: {
      actionRunCount: 3,
      includedSections: [
        'prompt_catalog_count',
        'actor_action_run_count',
        'task_route_summary',
      ],
      promptCatalogItemCount: 4,
      source: 'db_backed_minimal_manifest',
      taskRouteCount: 2,
    },
    status: 'ready',
    transferEventCount: 1,
    transferEvents: [
      {
        artifactFingerprint: 'archive111122223333',
        artifactKind: 'archive_json',
        authorizationFingerprint: 'download-auth-11112222',
        authorizationId: 'download-auth-1',
        createdAt: '2026-06-20T08:06:00.000Z',
        deliveryMethod: 'object_storage_signed_url',
        eventFingerprint: 'transfer111122223333',
        eventId: 'support-bundle-transfer-ok-admin',
        eventSource: 'object_storage_event_admin',
        id: 'transfer-event-1',
        manifestFingerprint: 'manifest111122223333',
        notificationAuthEvidenceFingerprint: 'auth-evidence11112222',
        storageByteSize: 512,
        storageContentType: 'application/json',
        storageKey: 'support-bundles/support-bundle-1/archive.json',
        transferredAt: '2026-06-20T08:05:30.000Z',
      },
    ],
    transferForwardingEventCount: 1,
    transferForwardingEvents: [
      {
        attemptCount: 3,
        authorizationId: 'download-auth-1',
        createdAt: '2026-06-20T08:04:00.000Z',
        deadLetteredAt: '2026-06-20T08:07:00.000Z',
        eventId: 'support-bundle-forwarding-dead-letter-admin',
        eventSource: 'object_storage_event_admin',
        failureCode: 'support_bundle_transfer_event_storage_key_mismatch',
        failureMessage: 'Support bundle transfer event storage key mismatch',
        forwardedAt: null,
        forwardedTransferEventFingerprint: null,
        forwardingEventFingerprint: 'forwarding111122223333',
        forwardingPayload: {
          version: 'copilot-support-bundle-transfer-forwarding-payload/v1',
        },
        forwardingPayloadFingerprint: 'payload111122223333',
        id: 'transfer-forwarding-event-1',
        lastAttemptAt: '2026-06-20T08:06:30.000Z',
        maxAttempts: 3,
        nextAttemptAt: null,
        providerSignatureEvidenceFingerprint: 'signature11112222',
        status: 'dead_lettered',
        updatedAt: '2026-06-20T08:07:00.000Z',
        workerLeaseExpiresAt: null,
        workerLeaseId: null,
      },
    ],
    updatedAt: '2026-06-20T08:00:00.000Z',
    workspaceId: 'workspace-1',
  },
];

const supportBundleForwardingReplayPayload = {
  ...supportBundlesPayload[0].transferForwardingEvents[0],
  attemptCount: 0,
  createdAt: '2026-06-20T08:08:00.000Z',
  deadLetteredAt: null,
  failureCode: null,
  failureMessage: null,
  forwardingEventFingerprint: 'forwardingreplay1111',
  forwardingPayload: {
    replay: {
      sourceForwardingEventId: 'transfer-forwarding-event-1',
      version: 'copilot-support-bundle-transfer-forwarding-replay/v1',
    },
    version: 'copilot-support-bundle-transfer-forwarding-payload/v1',
  },
  forwardingPayloadFingerprint: 'payloadreplay1111',
  id: 'transfer-forwarding-replay-1',
  lastAttemptAt: null,
  nextAttemptAt: '2026-06-20T08:08:00.000Z',
  status: 'queued',
  updatedAt: '2026-06-20T08:08:00.000Z',
};

const agentRuntimeWorkflowAdaptersPayload = [
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
];

const agentRunsPayload = [
  {
    actorId: 'user-1',
    completedAt: null,
    createdAt: '2026-06-20T09:00:00.000Z',
    evidenceFingerprint: 'agent-evidence-1111',
    executionResultCount: 0,
    executionResults: [],
    failureCode: null,
    failureMessage: null,
    id: 'agent-run-1',
    lastAttemptAt: null,
    queuedAt: '2026-06-20T09:05:00.000Z',
    sourceId: 'repair-execution-1',
    sourceType: 'repair_execution_request',
    startedAt: '2026-06-20T09:00:00.000Z',
    status: 'queued',
    targetFingerprint: 'agent-target-1111',
    timelineFingerprint: 'agent-timeline-2222',
    title: 'Repair execution: Make it real',
    updatedAt: '2026-06-20T09:05:00.000Z',
    workerAttempt: 0,
    workerLeaseExpiresAt: null,
    workerLeaseId: null,
    workerMaxAttempts: 3,
    workflow: 'prompt_registry_repair_execution',
    workspaceId: 'workspace-1',
    steps: [
      {
        actorId: 'user-1',
        completedAt: null,
        createdAt: '2026-06-20T09:00:00.000Z',
        evidenceFingerprint: 'agent-step-evidence-1111',
        id: 'agent-step-1',
        order: 0,
        outputSummary: {
          approvalState: 'approved',
          repairExecutionRequestId: 'repair-execution-1',
          runtimeExecutor: 'queued_repair_execution_worker',
          sideEffectsApplied: false,
          version: 'agent-runtime-step-output-summary/v1',
        },
        runId: 'agent-run-1',
        startedAt: '2026-06-20T09:00:00.000Z',
        status: 'pending',
        stepKey: 'repair_execution',
        stepType: 'model',
        title: 'Repair execution request',
        updatedAt: '2026-06-20T09:05:00.000Z',
        workspaceId: 'workspace-1',
      },
    ],
    timelineEvents: [
      {
        actorId: 'user-1',
        createdAt: '2026-06-20T09:00:00.000Z',
        eventFingerprint: 'agent-event-1111',
        eventType: 'run_status',
        id: 'agent-event-1',
        ordinal: 0,
        payload: {
          requestFingerprint: 'repair-request-1111',
          sourceId: 'repair-execution-1',
          sourceType: 'repair_execution_request',
          workflow: 'prompt_registry_repair_execution',
        },
        runId: 'agent-run-1',
        status: 'waiting_approval',
        stepId: null,
        summary: 'Repair execution run waiting_approval',
        workspaceId: 'workspace-1',
      },
      {
        actorId: 'user-1',
        createdAt: '2026-06-20T09:05:00.000Z',
        eventFingerprint: 'agent-event-3333',
        eventType: 'run_status',
        id: 'agent-event-3',
        ordinal: 2,
        payload: {
          requestFingerprint: 'repair-request-1111',
          sourceId: 'repair-execution-1',
          sourceType: 'repair_execution_request',
          workflow: 'prompt_registry_repair_execution',
        },
        runId: 'agent-run-1',
        status: 'queued',
        stepId: null,
        summary: 'Repair execution run queued',
        workspaceId: 'workspace-1',
      },
      {
        actorId: 'user-1',
        createdAt: '2026-06-20T09:05:00.000Z',
        eventFingerprint: 'agent-event-4444',
        eventType: 'model_step',
        id: 'agent-event-4',
        ordinal: 3,
        payload: {
          approvalState: 'approved',
          permissionStatus: 'granted',
          runtimeExecutor: 'queued_repair_execution_worker',
          sideEffectsApplied: false,
        },
        runId: 'agent-run-1',
        status: 'pending',
        stepId: 'agent-step-1',
        summary: 'Repair execution queued for worker',
        workspaceId: 'workspace-1',
      },
    ],
  },
  standaloneAgentRunPayload,
  completedAgentRunPayload,
];

const repairExecutionsPayload = [
  {
    actorId: 'user-1',
    approvalRecordFingerprint: 'approval-record-1111',
    approvalState: 'approved',
    auditEventCount: 4,
    auditEvents: repairExecutionAuditEventsFixture([
      'queued',
      'approval_approved',
      'waiting_approval',
      'requested',
    ]),
    auditEventFingerprint: 'audit-event-1111',
    candidateEvidenceSetFingerprint: 'aaaa5555bbbb6666',
    completedAt: null,
    createdAt: '2026-06-20T09:00:00.000Z',
    failureCode: null,
    failureMessage: null,
    id: 'repair-execution-1',
    idempotencyFingerprint: 'efef1111abab2222',
    idempotencyKey: 'repair-idempotency-key-1',
    lastAttemptAt: null,
    permissionStatus: 'granted',
    promptName: 'Make it real',
    queuedAt: '2026-06-20T09:05:00.000Z',
    repairJobFingerprint: 'bcbc1111dede2222',
    requestFingerprint: 'repair-request-1111',
    requestedAction: 'prompt_registry_repair',
    runtimeResult: {
      executor: 'queued_repair_execution_worker',
      message: 'Approval accepted; repair execution queued for worker runtime.',
      sideEffectsApplied: false,
      version: 'repair-execution-runtime-result/v1',
    },
    sideEffectCount: 0,
    sideEffects: [],
    status: 'queued',
    targetLocatorFingerprint: 'ddd111eee222ffff',
    taskRouteEvidenceSetFingerprint: 'aaaa5656bbbb6767',
    updatedAt: '2026-06-20T09:05:00.000Z',
    workerAttempt: 0,
    workerLeaseExpiresAt: null,
    workerLeaseId: null,
    workerMaxAttempts: 3,
    workspaceId: 'workspace-1',
    agentRun: agentRunsPayload[0],
  },
  {
    actorId: 'user-1',
    approvalRecordFingerprint: 'approval-record-2222',
    approvalState: 'approved',
    auditEventCount: 6,
    auditEvents: repairExecutionAuditEventsFixture(
      ['completed', 'side_effect_applied', 'running', 'queued', 'requested'],
      'repair-execution-completed'
    ),
    auditEventFingerprint: 'audit-event-2222',
    candidateEvidenceSetFingerprint: 'candidate2222',
    completedAt: '2026-06-20T09:30:00.000Z',
    createdAt: '2026-06-20T09:10:00.000Z',
    failureCode: null,
    failureMessage: null,
    id: 'repair-execution-completed',
    idempotencyFingerprint: 'idempotency2222',
    idempotencyKey: 'repair-idempotency-key-2',
    lastAttemptAt: '2026-06-20T09:29:00.000Z',
    permissionStatus: 'granted',
    promptName: 'Make it real',
    queuedAt: '2026-06-20T09:11:00.000Z',
    repairJobFingerprint: 'repairjob2222',
    requestFingerprint: 'repair-request-2222',
    requestedAction: 'prompt_registry_repair',
    runtimeResult: {
      executor: 'prompt_registry_revision_publish_worker',
      message:
        'Repair execution worker published a DB-backed workspace prompt registry revision.',
      sideEffectsApplied: true,
      sideEffectFingerprint: 'sideeffect1111',
      sideEffectKind: 'prompt_registry_revision',
      sideEffectRecordId: 'prompt-revision-repair-execution-completed',
      sideEffectSummary: {
        revision: 'repair-repair-execution-completed',
        version: 'prompt-registry-side-effect-summary/v1',
      },
      version: 'repair-execution-runtime-result/v1',
    },
    sideEffectCount: 1,
    sideEffects: [
      {
        actorId: 'user-1',
        appliedAt: '2026-06-20T09:30:00.000Z',
        createdAt: '2026-06-20T09:30:00.000Z',
        executionRequestId: 'repair-execution-completed',
        executorPayloadFingerprint: 'executorpayload1111',
        id: 'repair-execution-side-effect-repair-execution-completed',
        sideEffectFingerprint: 'sideeffect1111',
        sideEffectKind: 'prompt_registry_revision',
        sideEffectRecordId: 'prompt-revision-repair-execution-completed',
        sideEffectSummary: {
          revision: 'repair-repair-execution-completed',
          version: 'prompt-registry-side-effect-summary/v1',
        },
        workerAttempt: 1,
        workerLeaseId: 'repair-worker-lease-1',
        workspaceId: 'workspace-1',
      },
    ],
    status: 'completed',
    targetLocatorFingerprint: 'target2222',
    taskRouteEvidenceSetFingerprint: 'taskroute2222',
    updatedAt: '2026-06-20T09:30:00.000Z',
    workerAttempt: 1,
    workerLeaseExpiresAt: null,
    workerLeaseId: null,
    workerMaxAttempts: 3,
    workspaceId: 'workspace-1',
    agentRun: {
      ...agentRunsPayload[0],
      completedAt: '2026-06-20T09:30:00.000Z',
      id: 'agent-run-repair-completed',
      sourceId: 'repair-execution-completed',
      status: 'completed',
      title: 'Repair execution: Make it real completed',
      updatedAt: '2026-06-20T09:30:00.000Z',
    },
  },
];

const actionRunPreparedRouteTracePayload = {
  status: 'succeeded',
  type: 'prepared_routes',
  steps: [
    {
      actualRouteCount: 1,
      fallbackProviderIds: ['ollama-main', 'openai-default'],
      kind: 'structured',
      requestedModelId: 'local/office-structured',
      requestedModelSource: 'prompt_preference',
      routeCount: 2,
      routeCountMismatch: true,
      routes: [
        {
          behaviorFlags: ['tool_calls'],
          canonicalModelKey: 'local/office-structured',
          dimensionMismatch: true,
          fallbackOrderIndex: 0,
          modelId: 'local/office-structured',
          modelBackendKind: 'openai_chat',
          modelEmbeddingDimensions: 1536,
          protocol: 'openai_chat',
          providerConfiguredModelCount: 2,
          providerConfiguredModelIds: [
            'local/office-structured',
            'office-structured',
          ],
          providerHealth: 'healthy',
          providerHealthCheckedAt: '2026-06-16T09:30:00.000Z',
          providerHealthLastError: null,
          providerId: 'ollama-main',
          providerName: 'Local Ollama',
          providerPrivacy: 'local',
          providerPriority: 10,
          providerProfileConfigPath:
            'copilot.providers.profiles[id=ollama-main]',
          providerProfileId: 'ollama-main',
          providerProfileSource: 'configured',
          providerSource: 'configured',
          providerType: 'openaiCompatible',
          requestLayer: 'chat_completions',
          requestedDimensions: 1024,
          routeModelAliasMatched: true,
          routeModelDefinitionAliases: ['office-structured'],
          routeModelDefinitionId: 'local/office-structured',
          routeModelDefinitionSource: 'provider_profile',
          routeRawModelId: 'qwen3:32b',
          routeIndex: 0,
        },
      ],
      stepId: 'generate',
    },
    {
      actualRouteCount: 1,
      fallbackProviderIds: [],
      kind: 'image',
      requestedModelId: 'gpt-image-1',
      requestedModelSource: 'explicit',
      routeCount: 1,
      routeCountMismatch: false,
      routes: [
        {
          modelId: 'gpt-image-1',
          protocol: 'openai_image',
          providerId: 'openai-default',
          requestLayer: 'images',
          routeIndex: 0,
        },
      ],
      stepId: 'generate-image',
    },
  ],
};

const actionRunTimelineRunRouteEvidenceFingerprint =
  actionRunTimelineRouteEvidenceFingerprintFixture({
    actualRouteCount: 3,
    eventType: 'run_status',
    fallbackProviderIds: ['ollama-main', 'openai-default'],
    kind: null,
    routeBehaviorFlags: ['tool_calls', 'image_generation'],
    routeCanonicalModelKeys: ['local/office-structured', 'gpt-image-1'],
    routeCount: 3,
    routeCountMismatch: false,
    routeDimensionEvidence: [
      'requested 1024d / model 1024d / dimension mismatch no',
    ],
    routeModelBackendKinds: ['openai_chat', 'openai_image'],
    routeTargets: [
      'ollama-main/local/office-structured',
      'openai-default/gpt-5-mini',
      'openai-default/gpt-image-1',
    ],
    stepId: null,
  });

const actionRunTimelineGenerateRouteEvidenceFingerprint =
  actionRunTimelineRouteEvidenceFingerprintFixture({
    actualRouteCount: 1,
    eventType: 'model_step',
    fallbackProviderIds: ['ollama-main', 'openai-default'],
    kind: 'structured',
    routeBehaviorFlags: ['tool_calls'],
    routeCanonicalModelKeys: ['local/office-structured'],
    routeCount: 2,
    routeCountMismatch: true,
    routeDimensionEvidence: [
      'requested 1024d / model 1024d / dimension mismatch no',
    ],
    routeModelBackendKinds: ['openai_chat'],
    routeTargets: ['ollama-main/local/office-structured'],
    stepId: 'generate',
  });

const actionRunTimelineImageRouteEvidenceFingerprint =
  actionRunTimelineRouteEvidenceFingerprintFixture({
    actualRouteCount: 1,
    eventType: 'model_step',
    fallbackProviderIds: ['openai-default'],
    kind: 'image',
    routeBehaviorFlags: ['image_generation'],
    routeCanonicalModelKeys: ['gpt-image-1'],
    routeCount: 1,
    routeCountMismatch: false,
    routeDimensionEvidence: [],
    routeModelBackendKinds: ['openai_image'],
    routeTargets: ['openai-default/gpt-image-1'],
    stepId: 'generate-image',
  });

const failedActionRunTimelineRouteEvidenceFingerprint =
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

const actionRunTimelineRouteEvidenceSetFingerprint =
  actionRunTimelineRouteEvidenceSetFingerprintFixture([
    actionRunTimelineRunRouteEvidenceFingerprint,
    actionRunTimelineGenerateRouteEvidenceFingerprint,
    actionRunTimelineImageRouteEvidenceFingerprint,
  ]);

const failedActionRunTimelineRouteEvidenceSetFingerprint =
  actionRunTimelineRouteEvidenceSetFingerprintFixture([
    failedActionRunTimelineRouteEvidenceFingerprint,
  ]);

const actionRunProjectionContractFingerprint = 'abcd1111eeee2222';
const failedActionRunProjectionContractFingerprint = 'abcd3333eeee4444';
const actionRunAgentRuntimeDiagnosticsFingerprint = 'feed1111beef2222';
const failedActionRunAgentRuntimeDiagnosticsFingerprint = 'feed3333beef4444';
const actionRunManifestExportPolicyFingerprint = 'face1111cafe2222';
const failedActionRunManifestExportPolicyFingerprint = 'face3333cafe4444';
const actionRunManifestExportAuditEventFingerprint = 'dead1111bead2222';
const failedActionRunManifestExportAuditEventFingerprint = 'dead3333bead4444';
const actionRunManifestRetentionPolicyFingerprint = 'babe1111feed2222';
const failedActionRunManifestRetentionPolicyFingerprint = 'babe3333feed4444';

const actionRunsPayload = [
  {
    actionId: 'mindmap.generate',
    actionVersion: 'v1',
    agentRuntimeDiagnosticsFingerprint:
      actionRunAgentRuntimeDiagnosticsFingerprint,
    agentRuntimeDiagnosticsManifest: {
      actionId: 'mindmap.generate',
      actionVersion: 'v1',
      fingerprint: actionRunAgentRuntimeDiagnosticsFingerprint,
      hasPreparedRouteTrace: true,
      nativeTraceEventTypes: ['action_trace', 'tool:dispatch'],
      preparedRouteActualCount: 3,
      preparedRouteCount: 3,
      preparedRouteStepCount: 2,
      projectionContractFingerprint: actionRunProjectionContractFingerprint,
      projectionGapCount: 5,
      projectionSource: 'ai_action_run_agent_runtime_projection/v1',
      runStatus: 'completed',
      schemaReadiness: 'projection_contract_only',
      schemaReadinessGapCount: 7,
      timelineEventTypes: ['run_status', 'model_step'],
      timelineGapCount: 10,
      timelineItemCount: 3,
      timelineRouteEvidenceSetFingerprint:
        actionRunTimelineRouteEvidenceSetFingerprint,
      version: 'agent-runtime-diagnostics-manifest/v1',
    },
    agentRuntimeDiagnosticsManifestExportMetadata: {
      actionId: 'mindmap.generate',
      actionVersion: 'v1',
      artifact: 'action_run_diagnostics_manifest_json',
      auditEventCreated: false,
      auditEventFingerprint: actionRunManifestExportAuditEventFingerprint,
      auditEventStatus: 'not_created_read_only',
      auditEventVersion:
        'action-run-diagnostics-manifest-export-audit-event/v1',
      boundary: 'manifest_only_no_raw_trace_or_provider_payload',
      exportPolicyFingerprint: actionRunManifestExportPolicyFingerprint,
      exportPolicyStatus: 'read_only_projection',
      exportPolicyVersion: 'action-run-diagnostics-manifest-export-policy/v1',
      filename: 'action-run-diagnostics-manifest-run-123.json',
      manifestFingerprint: actionRunAgentRuntimeDiagnosticsFingerprint,
      manifestVersion: 'agent-runtime-diagnostics-manifest/v1',
      metadataFilename: 'action-run-diagnostics-manifest-metadata-run-123.json',
      mime: 'application/json;charset=utf-8',
      projectionSource: 'ai_action_run_agent_runtime_projection/v1',
      retentionPolicyFingerprint: actionRunManifestRetentionPolicyFingerprint,
      retentionPolicyStatus: 'not_persisted_read_only',
      retentionPolicyVersion:
        'action-run-diagnostics-manifest-retention-policy/v1',
      runId: 'run-123',
      runStatus: 'completed',
      schemaReadiness: 'projection_contract_only',
      version: 'action-run-diagnostics-manifest-export-metadata/v1',
    },
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
    agentRuntimeProjectionContractFingerprint:
      actionRunProjectionContractFingerprint,
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
    agentRuntimeRunId: 'run-123',
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
    agentRuntimeStepCount: 2,
    agentRuntimeStepStatusGaps: [
      'waiting_approval -> not_projected',
      'retrying -> not_projected',
      'rollback_running -> not_projected',
      'blocked -> not_projected',
    ],
    agentRuntimeStepIds: ['generate', 'generate-image'],
    agentRuntimeStepKinds: [
      'generate -> structured',
      'generate-image -> image',
    ],
    agentRuntimeStepStatuses: [
      'generate -> completed',
      'generate-image -> completed',
    ],
    agentRuntimeStepTypes: ['generate -> model', 'generate-image -> model'],
    agentRuntimeTimelineEntries: [
      'run -> completed',
      'generate -> model_step -> completed -> structured -> 2/2',
      'generate-image -> model_step -> completed -> image -> 1/1',
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
        actualRouteCount: 3,
        eventKey: 'run_status',
        eventType: 'run_status',
        id: 'run-123:run_status',
        kind: null,
        label: 'run -> completed',
        routeCount: 3,
        routeCountMismatch: false,
        routeTargets: [
          'ollama-main/local/office-structured',
          'openai-default/gpt-5-mini',
          'openai-default/gpt-image-1',
        ],
        fallbackProviderIds: ['ollama-main', 'openai-default'],
        routeModelBackendKinds: ['openai_chat', 'openai_image'],
        routeCanonicalModelKeys: ['local/office-structured', 'gpt-image-1'],
        routeBehaviorFlags: ['tool_calls', 'image_generation'],
        routeDimensionEvidence: [
          'requested 1024d / model 1024d / dimension mismatch no',
        ],
        routeEvidenceFingerprint: actionRunTimelineRunRouteEvidenceFingerprint,
        runId: 'run-123',
        sequence: 0,
        status: 'completed',
        stepId: null,
        stepType: null,
      },
      {
        actualRouteCount: 1,
        eventKey: 'model_step:generate',
        eventType: 'model_step',
        id: 'run-123:0:generate:model_step',
        kind: 'structured',
        label: 'generate -> model_step -> completed -> structured -> 2/2',
        routeCount: 2,
        routeCountMismatch: true,
        routeTargets: ['ollama-main/local/office-structured'],
        fallbackProviderIds: ['ollama-main', 'openai-default'],
        routeModelBackendKinds: ['openai_chat'],
        routeCanonicalModelKeys: ['local/office-structured'],
        routeBehaviorFlags: ['tool_calls'],
        routeDimensionEvidence: [
          'requested 1024d / model 1024d / dimension mismatch no',
        ],
        routeEvidenceFingerprint:
          actionRunTimelineGenerateRouteEvidenceFingerprint,
        runId: 'run-123',
        sequence: 1,
        status: 'completed',
        stepId: 'generate',
        stepType: 'model',
      },
      {
        actualRouteCount: 1,
        eventKey: 'model_step:generate-image',
        eventType: 'model_step',
        id: 'run-123:1:generate-image:model_step',
        kind: 'image',
        label: 'generate-image -> model_step -> completed -> image -> 1/1',
        routeCount: 1,
        routeCountMismatch: false,
        routeTargets: ['openai-default/gpt-image-1'],
        fallbackProviderIds: ['openai-default'],
        routeModelBackendKinds: ['openai_image'],
        routeCanonicalModelKeys: ['gpt-image-1'],
        routeBehaviorFlags: ['image_generation'],
        routeDimensionEvidence: [],
        routeEvidenceFingerprint:
          actionRunTimelineImageRouteEvidenceFingerprint,
        runId: 'run-123',
        sequence: 2,
        status: 'completed',
        stepId: 'generate-image',
        stepType: 'model',
      },
    ],
    agentRuntimeTimelineRouteEvidenceSetFingerprint:
      actionRunTimelineRouteEvidenceSetFingerprint,
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
    attempt: 2,
    createdAt: '2026-06-16T09:00:00.000Z',
    docId: 'doc-1',
    errorCode: null,
    hasPreparedRouteTrace: true,
    id: 'run-123',
    preparedRouteActualCount: 3,
    preparedRouteBehaviorFlags: ['tool_calls', 'image_generation'],
    preparedRouteCanonicalModelKeys: ['local/office-structured', 'gpt-image-1'],
    preparedRouteCount: 3,
    preparedRouteDimensionEvidence: [
      'requested 1024d / model 1024d / dimension mismatch no',
    ],
    preparedRouteFallbackProviderIds: ['ollama-main', 'openai-default'],
    preparedRouteFallbackOrder: [
      '0 -> ollama-main/local/office-structured',
      '1 -> openai-default/gpt-5-mini',
      '0 -> openai-default/gpt-image-1',
    ],
    preparedRouteStepFallbackProviderIds: [
      'generate -> ollama-main -> openai-default',
      'generate-image -> openai-default',
    ],
    preparedRouteKinds: ['structured', 'image'],
    preparedRouteModelIds: [
      'local/office-structured',
      'gpt-5-mini',
      'gpt-image-1',
    ],
    preparedRouteModelBackendKinds: ['openai_chat', 'openai_image'],
    preparedRouteOrder: [
      '0 -> ollama-main/local/office-structured',
      '1 -> openai-default/gpt-5-mini',
      '0 -> openai-default/gpt-image-1',
    ],
    preparedRouteProtocols: ['openai_chat', 'openai_image'],
    preparedRouteProviderIds: ['ollama-main', 'openai-default'],
    preparedRouteRequestedModelIds: ['local/office-structured', 'gpt-image-1'],
    preparedRouteRequestedModelSources: ['prompt_preference', 'explicit'],
    preparedRouteStepRequestedModelSources: [
      'generate -> prompt_preference',
      'generate-image -> explicit',
    ],
    preparedRouteRequestLayers: ['chat_completions', 'images'],
    preparedRouteStepProtocols: [
      'generate -> openai_chat',
      'generate-image -> openai_image',
    ],
    preparedRouteStepModelBackendKinds: [
      'generate -> openai_chat',
      'generate-image -> openai_image',
    ],
    preparedRouteStepCanonicalModelKeys: [
      'generate -> local/office-structured',
      'generate-image -> gpt-image-1',
    ],
    preparedRouteStepBehaviorFlags: [
      'generate -> tool_calls',
      'generate-image -> image_generation',
    ],
    preparedRouteStepDimensionEvidence: [
      'generate -> requested 1024d / model 1024d / dimension mismatch no',
    ],
    preparedRouteStepRequestLayers: [
      'generate -> chat_completions',
      'generate-image -> images',
    ],
    preparedRouteStepFallbackOrder: [
      'generate / 0 -> ollama-main/local/office-structured',
      'generate / 1 -> openai-default/gpt-5-mini',
      'generate-image / 0 -> openai-default/gpt-image-1',
    ],
    preparedRouteStepOrder: [
      'generate / 0 -> ollama-main/local/office-structured',
      'generate / 1 -> openai-default/gpt-5-mini',
      'generate-image / 0 -> openai-default/gpt-image-1',
    ],
    preparedRouteStepRouteCountMismatches: [],
    preparedRouteStepRouteCounts: ['generate -> 2/2', 'generate-image -> 1/1'],
    preparedRouteStepCount: 2,
    preparedRouteStepIds: ['generate', 'generate-image'],
    preparedRouteTargets: [
      'ollama-main/local/office-structured',
      'openai-default/gpt-5-mini',
      'openai-default/gpt-image-1',
    ],
    preparedRouteStepTargets: [
      'generate -> ollama-main/local/office-structured',
      'generate -> openai-default/gpt-5-mini',
      'generate-image -> openai-default/gpt-image-1',
    ],
    preparedRouteRequestedTargets: [
      'local/office-structured -> ollama-main/local/office-structured',
      'local/office-structured -> openai-default/gpt-5-mini',
      'gpt-image-1 -> openai-default/gpt-image-1',
    ],
    preparedRouteStepRequestedTargets: [
      'generate / local/office-structured -> ollama-main/local/office-structured',
      'generate / local/office-structured -> openai-default/gpt-5-mini',
      'generate-image / gpt-image-1 -> openai-default/gpt-image-1',
    ],
    retryOf: 'run-122',
    sessionId: 'session-1',
    status: 'succeeded',
    updatedAt: '2026-06-16T10:00:00.000Z',
  },
  {
    actionId: 'image.filter.sketch',
    actionVersion: 'v1',
    agentRuntimeDiagnosticsFingerprint:
      failedActionRunAgentRuntimeDiagnosticsFingerprint,
    agentRuntimeDiagnosticsManifest: {
      actionId: 'image.filter.sketch',
      actionVersion: 'v1',
      fingerprint: failedActionRunAgentRuntimeDiagnosticsFingerprint,
      hasPreparedRouteTrace: false,
      nativeTraceEventTypes: [],
      preparedRouteActualCount: 0,
      preparedRouteCount: 0,
      preparedRouteStepCount: 0,
      projectionContractFingerprint:
        failedActionRunProjectionContractFingerprint,
      projectionGapCount: 6,
      projectionSource: 'ai_action_run_agent_runtime_projection/v1',
      runStatus: 'failed',
      schemaReadiness: 'projection_contract_only',
      schemaReadinessGapCount: 7,
      timelineEventTypes: ['run_status'],
      timelineGapCount: 11,
      timelineItemCount: 1,
      timelineRouteEvidenceSetFingerprint:
        failedActionRunTimelineRouteEvidenceSetFingerprint,
      version: 'agent-runtime-diagnostics-manifest/v1',
    },
    agentRuntimeDiagnosticsManifestExportMetadata: {
      actionId: 'image.filter.sketch',
      actionVersion: 'v1',
      artifact: 'action_run_diagnostics_manifest_json',
      auditEventCreated: false,
      auditEventFingerprint: failedActionRunManifestExportAuditEventFingerprint,
      auditEventStatus: 'not_created_read_only',
      auditEventVersion:
        'action-run-diagnostics-manifest-export-audit-event/v1',
      boundary: 'manifest_only_no_raw_trace_or_provider_payload',
      exportPolicyFingerprint: failedActionRunManifestExportPolicyFingerprint,
      exportPolicyStatus: 'read_only_projection',
      exportPolicyVersion: 'action-run-diagnostics-manifest-export-policy/v1',
      filename: 'action-run-diagnostics-manifest-run-failed.json',
      manifestFingerprint: failedActionRunAgentRuntimeDiagnosticsFingerprint,
      manifestVersion: 'agent-runtime-diagnostics-manifest/v1',
      metadataFilename:
        'action-run-diagnostics-manifest-metadata-run-failed.json',
      mime: 'application/json;charset=utf-8',
      projectionSource: 'ai_action_run_agent_runtime_projection/v1',
      retentionPolicyFingerprint:
        failedActionRunManifestRetentionPolicyFingerprint,
      retentionPolicyStatus: 'not_persisted_read_only',
      retentionPolicyVersion:
        'action-run-diagnostics-manifest-retention-policy/v1',
      runId: 'run-failed',
      runStatus: 'failed',
      schemaReadiness: 'projection_contract_only',
      version: 'action-run-diagnostics-manifest-export-metadata/v1',
    },
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
    agentRuntimeProjectionContractFingerprint:
      failedActionRunProjectionContractFingerprint,
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
    agentRuntimeRunId: 'run-failed',
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
        actualRouteCount: 0,
        eventKey: 'run_status',
        eventType: 'run_status',
        id: 'run-failed:run_status',
        kind: null,
        label: 'run -> failed',
        routeCount: 0,
        routeCountMismatch: false,
        routeTargets: [],
        fallbackProviderIds: [],
        routeModelBackendKinds: [],
        routeCanonicalModelKeys: [],
        routeBehaviorFlags: [],
        routeDimensionEvidence: [],
        routeEvidenceFingerprint:
          failedActionRunTimelineRouteEvidenceFingerprint,
        runId: 'run-failed',
        sequence: 0,
        status: 'failed',
        stepId: null,
        stepType: null,
      },
    ],
    agentRuntimeTimelineRouteEvidenceSetFingerprint:
      failedActionRunTimelineRouteEvidenceSetFingerprint,
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
    attempt: 1,
    createdAt: '2026-06-16T08:00:00.000Z',
    docId: null,
    errorCode: 'action_bridge_stream_error',
    hasPreparedRouteTrace: false,
    id: 'run-failed',
    preparedRouteActualCount: 0,
    preparedRouteBehaviorFlags: [],
    preparedRouteCanonicalModelKeys: [],
    preparedRouteCount: 0,
    preparedRouteDimensionEvidence: [],
    preparedRouteFallbackProviderIds: [],
    preparedRouteFallbackOrder: [],
    preparedRouteStepFallbackProviderIds: [],
    preparedRouteKinds: [],
    preparedRouteModelBackendKinds: [],
    preparedRouteModelIds: [],
    preparedRouteOrder: [],
    preparedRouteProtocols: [],
    preparedRouteProviderIds: [],
    preparedRouteRequestedModelIds: [],
    preparedRouteRequestedModelSources: [],
    preparedRouteStepRequestedModelSources: [],
    preparedRouteRequestLayers: [],
    preparedRouteStepProtocols: [],
    preparedRouteStepModelBackendKinds: [],
    preparedRouteStepCanonicalModelKeys: [],
    preparedRouteStepBehaviorFlags: [],
    preparedRouteStepDimensionEvidence: [],
    preparedRouteStepRequestLayers: [],
    preparedRouteStepFallbackOrder: [],
    preparedRouteStepOrder: [],
    preparedRouteStepRouteCountMismatches: [],
    preparedRouteStepRouteCounts: [],
    preparedRouteStepCount: 0,
    preparedRouteStepIds: [],
    preparedRouteTargets: [],
    preparedRouteStepTargets: [],
    preparedRouteRequestedTargets: [],
    preparedRouteStepRequestedTargets: [],
    retryOf: null,
    sessionId: null,
    status: 'failed',
    updatedAt: '2026-06-16T08:05:00.000Z',
  },
];

describe('AiPage', () => {
  beforeAll(() => {
    if (!Element.prototype.hasPointerCapture) {
      Object.defineProperty(Element.prototype, 'hasPointerCapture', {
        value: () => false,
      });
    }
    if (!Element.prototype.setPointerCapture) {
      Object.defineProperty(Element.prototype, 'setPointerCapture', {
        value: () => {},
      });
    }
    if (!Element.prototype.releasePointerCapture) {
      Object.defineProperty(Element.prototype, 'releasePointerCapture', {
        value: () => {},
      });
    }
  });

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURLMock,
    });
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      configurable: true,
      value: anchorClickMock,
    });
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    mutateMock.mockReset();
    mutateMock.mockResolvedValue(undefined);
    writeTextMock.mockReset();
    writeTextMock.mockResolvedValue(undefined);
    createObjectURLMock.mockReset();
    createObjectURLMock.mockReturnValue('blob:action-run-manifest');
    revokeObjectURLMock.mockReset();
    anchorClickMock.mockReset();
    windowOpenMock.mockReset();
    windowOpenMock.mockReturnValue(null);
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: windowOpenMock,
    });
    requestRepairExecutionMock.mockReset();
    decideRepairExecutionApprovalMock.mockReset();
    controlRepairExecutionMock.mockReset();
    controlAgentRuntimeRunMock.mockReset();
    createSupportBundleMock.mockReset();
    authorizeSupportBundleDownloadMock.mockReset();
    cleanupSupportBundleRetentionMock.mockReset();
    replaySupportBundleTransferForwardingEventMock.mockReset();
    retryProviderHealthProbeAttemptMock.mockReset();
    updateAppConfigMock.mockReset();
    updateAppConfigMock.mockResolvedValue({ updateAppConfig: {} });
    createSupportBundleMock.mockResolvedValue({
      createCopilotSupportBundle: {
        ...supportBundlesPayload[0],
        auditEventCount: 1,
        auditEvents: supportBundlesPayload[0].auditEvents.slice(0, 1),
        id: 'support-bundle-created',
        transferEventCount: 0,
        transferEvents: [],
        transferForwardingEventCount: 0,
        transferForwardingEvents: [],
      },
    });
    authorizeSupportBundleDownloadMock.mockResolvedValue({
      authorizeCopilotSupportBundleDownload: {
        actorId: 'user-1',
        artifactFingerprint: 'archive111122223333',
        artifactFilename:
          'localmind-support-bundle-support-bundle-1.archive.json',
        artifactKind: 'archive_json',
        artifactMime: 'application/json',
        authorizationFingerprint: 'download-auth-11112222',
        bundleId: 'support-bundle-1',
        createdAt: '2026-06-20T08:05:00.000Z',
        deliveryMethod: 'api_proxy',
        directDownloadExpiresAt: null,
        directDownloadUrl: null,
        downloadedAt: null,
        downloadUrl:
          'http://localhost/api/copilot/support-bundles/download-auth-1/artifact?token=download-token-1',
        expiresAt: '2026-06-20T08:20:00.000Z',
        id: 'download-auth-1',
        manifestFingerprint: 'manifest111122223333',
        status: 'authorized',
        updatedAt: '2026-06-20T08:05:00.000Z',
        workspaceId: 'workspace-1',
      },
    });
    cleanupSupportBundleRetentionMock.mockResolvedValue({
      cleanupCopilotSupportBundleRetention: {
        actorId: 'user-1',
        archiveObjectCleanupFailedCount: 0,
        archiveObjectCleanupRecoveredCount: 1,
        archiveObjectCleanupRetryCount: 1,
        cleanedAt: '2026-06-20T08:10:00.000Z',
        cleanupFingerprint: 'cleanup111122223333',
        expiredAuthorizationCount: 1,
        expiredBundleCount: 1,
        manifestObjectRewriteFailedCount: 0,
        manifestObjectRewriteRecoveredCount: 1,
        manifestObjectRewriteRetryCount: 1,
        expiredBundles: [
          {
            ...supportBundlesPayload[0],
            auditEventCount: 3,
            auditEvents: [
              {
                ...supportBundlesPayload[0].auditEvents[0],
                createdAt: '2026-06-20T08:10:00.000Z',
                eventFingerprint: 'auditretention1111',
                eventType: 'retention_expired',
                id: 'support-bundle-audit-3',
              },
              ...supportBundlesPayload[0].auditEvents,
            ],
            id: 'support-bundle-expired',
            manifestJson: {
              ...supportBundlesPayload[0].manifestJson,
              retention: {
                ...supportBundlesPayload[0].manifestJson.retention,
                status: 'expired',
              },
            },
            retentionStatus: 'expired',
            status: 'expired',
          },
        ],
        workspaceId: 'workspace-1',
      },
    });
    replaySupportBundleTransferForwardingEventMock.mockResolvedValue({
      replayCopilotSupportBundleTransferForwardingEvent:
        supportBundleForwardingReplayPayload,
    });
    retryProviderHealthProbeAttemptMock.mockResolvedValue({
      retryCopilotProviderHealthProbeAttempt: providerHealthProbeRetryPayload,
    });
    requestRepairExecutionMock.mockImplementation(
      async ({
        input,
      }: {
        input: {
          expectedApprovalRecordFingerprint: string;
          expectedApprovalRequestFingerprint: string;
          expectedAuditEventFingerprint: string;
          expectedCandidateEvidenceSetFingerprint: string;
          expectedTaskRouteEffectiveSourceEvidenceSetFingerprint: string;
          expectedEmbeddingIndexContractEvidenceSetFingerprint: string;
          expectedRerankRuntimeContractEvidenceSetFingerprint: string;
          expectedPreparedRouteOrderEvidenceSetFingerprint: string;
          expectedTargetLocatorFingerprint: string;
          expectedRepairGateManifestFingerprint: string;
          expectedRepairGateManifestExportPolicyFingerprint: string;
          expectedRepairGateManifestRetentionPolicyFingerprint: string;
          expectedExecutionGateFingerprint: string;
          expectedExecutionGateStatus: string;
          expectedExecutionStateFingerprint: string;
          expectedIdempotencyFingerprint: string;
          expectedPolicyBindingFingerprint: string;
          expectedPreflightStatus: string;
          expectedRepairJobFingerprint: string;
          expectedReviewBindingFingerprint: string;
          expectedRollbackPlanFingerprint: string;
          workspaceId?: string;
        };
      }) => ({
        requestCopilotPromptRegistryRepairExecution: {
          accepted: false,
          executionRecord: input.workspaceId
            ? {
                actorId: 'user-1',
                approvalRecordFingerprint: 'approval-record-1111',
                approvalState: 'waiting',
                auditEventCount: 2,
                auditEvents: repairExecutionAuditEventsFixture([
                  'waiting_approval',
                  'requested',
                ]),
                auditEventFingerprint: input.expectedAuditEventFingerprint,
                candidateEvidenceSetFingerprint:
                  input.expectedCandidateEvidenceSetFingerprint,
                completedAt: null,
                createdAt: '2026-06-20T09:00:00.000Z',
                failureCode: null,
                failureMessage: null,
                id: 'repair-execution-1',
                idempotencyFingerprint: input.expectedIdempotencyFingerprint,
                idempotencyKey: 'repair-idempotency-key-1',
                lastAttemptAt: null,
                permissionStatus: 'granted',
                promptName: readyPublishGateVerdict.name,
                queuedAt: null,
                repairJobFingerprint: input.expectedRepairJobFingerprint,
                requestFingerprint: 'repair-request-1111',
                requestedAction: 'prompt_registry_repair',
                runtimeResult: {
                  executor: 'approval_gate',
                  message:
                    'Execution request persisted and waiting for approval.',
                  sideEffectsApplied: false,
                  version: 'repair-execution-runtime-result/v1',
                },
                sideEffectCount: 0,
                sideEffects: [],
                status: 'waiting_approval',
                targetLocatorFingerprint:
                  input.expectedTargetLocatorFingerprint,
                taskRouteEvidenceSetFingerprint:
                  input.expectedTaskRouteEffectiveSourceEvidenceSetFingerprint,
                updatedAt: '2026-06-20T09:00:00.000Z',
                workerAttempt: 0,
                workerLeaseExpiresAt: null,
                workerLeaseId: null,
                workerMaxAttempts: 3,
                workspaceId: input.workspaceId,
                agentRun: {
                  actorId: 'user-1',
                  completedAt: null,
                  createdAt: '2026-06-20T09:00:00.000Z',
                  evidenceFingerprint: 'agent-evidence-1111',
                  executionResultCount: 0,
                  executionResults: [],
                  failureCode: null,
                  failureMessage: null,
                  id: 'agent-run-1',
                  lastAttemptAt: null,
                  queuedAt: null,
                  sourceId: 'repair-execution-1',
                  sourceType: 'repair_execution_request',
                  startedAt: '2026-06-20T09:00:00.000Z',
                  status: 'waiting_approval',
                  targetFingerprint: 'agent-target-1111',
                  timelineFingerprint: 'agent-timeline-1111',
                  title: 'Repair execution: Make it real',
                  updatedAt: '2026-06-20T09:00:00.000Z',
                  workerAttempt: 0,
                  workerLeaseExpiresAt: null,
                  workerLeaseId: null,
                  workerMaxAttempts: 3,
                  workflow: 'prompt_registry_repair_execution',
                  workspaceId: input.workspaceId,
                  steps: [
                    {
                      actorId: 'user-1',
                      completedAt: null,
                      createdAt: '2026-06-20T09:00:00.000Z',
                      evidenceFingerprint: 'agent-step-evidence-1111',
                      id: 'agent-step-1',
                      order: 0,
                      outputSummary: {
                        approvalState: 'waiting',
                        repairExecutionRequestId: 'repair-execution-1',
                        runtimeExecutor: 'approval_gate',
                        sideEffectsApplied: false,
                        version: 'agent-runtime-step-output-summary/v1',
                      },
                      runId: 'agent-run-1',
                      startedAt: '2026-06-20T09:00:00.000Z',
                      status: 'waiting_approval',
                      stepKey: 'repair_execution',
                      stepType: 'approval',
                      title: 'Repair execution request',
                      updatedAt: '2026-06-20T09:00:00.000Z',
                      workspaceId: input.workspaceId,
                    },
                  ],
                  timelineEvents: [
                    {
                      actorId: 'user-1',
                      createdAt: '2026-06-20T09:00:00.000Z',
                      eventFingerprint: 'agent-event-1111',
                      eventType: 'run_status',
                      id: 'agent-event-1',
                      ordinal: 0,
                      payload: {
                        requestFingerprint: 'repair-request-1111',
                        sourceId: 'repair-execution-1',
                        sourceType: 'repair_execution_request',
                        workflow: 'prompt_registry_repair_execution',
                      },
                      runId: 'agent-run-1',
                      status: 'waiting_approval',
                      stepId: null,
                      summary: 'Repair execution run waiting_approval',
                      workspaceId: input.workspaceId,
                    },
                    {
                      actorId: 'user-1',
                      createdAt: '2026-06-20T09:00:00.000Z',
                      eventFingerprint: 'agent-event-2222',
                      eventType: 'approval_step',
                      id: 'agent-event-2',
                      ordinal: 1,
                      payload: {
                        approvalState: 'waiting',
                        permissionStatus: 'granted',
                        runtimeExecutor: 'approval_gate',
                        sideEffectsApplied: false,
                      },
                      runId: 'agent-run-1',
                      status: 'waiting_approval',
                      stepId: 'agent-step-1',
                      summary: 'Repair execution waiting for approval',
                      workspaceId: input.workspaceId,
                    },
                  ],
                },
              }
            : null,
          approvalRecordRequestCreated: false,
          approvalRecordRequestFingerprint: input.workspaceId
            ? 'aaaa3333bbbb4444'
            : 'dddd3333eeee4444',
          approvalRecordRequestInputs: [
            'actorFingerprint',
            'approvalRecordFingerprint',
            'approvalRequestFingerprint',
            'auditBindingFingerprint',
            'candidateEvidenceSetFingerprint',
            'taskRouteEffectiveSourceEvidenceSetFingerprint',
            'idempotencyLockFingerprint',
            'policyBindingFingerprint',
            'preparedRouteOrderEvidenceSetFingerprint',
            'requestStatus',
            'reviewBindingFingerprint',
            'targetLocatorFingerprint',
            'workspaceId',
          ],
          approvalRecordRequestStatus: 'not_created_read_only',
          approvalRecordRequestVersion:
            'repair-execution-approval-record-request/v1',
          auditEventRequestCreated: false,
          auditEventRequestFingerprint: input.workspaceId
            ? 'aaaa5555bbbb6666'
            : 'dddd5555eeee6666',
          auditEventRequestInputs: [
            'actorFingerprint',
            'approvalRecordRequestFingerprint',
            'auditBindingFingerprint',
            'auditEventFingerprint',
            'candidateEvidenceSetFingerprint',
            'taskRouteEffectiveSourceEvidenceSetFingerprint',
            'idempotencyLockFingerprint',
            'operationSetFingerprint',
            'policyBindingFingerprint',
            'preparedRouteOrderEvidenceSetFingerprint',
            'repairJobFingerprint',
            'requestStatus',
            'submissionFingerprint',
            'targetLocatorFingerprint',
            'workspaceId',
          ],
          auditEventRequestStatus: 'not_created_read_only',
          auditEventRequestVersion: 'repair-execution-audit-event-request/v1',
          executionCompletionEventRequestCreated: false,
          executionCompletionEventRequestFingerprint: input.workspaceId
            ? 'aaaa7777bbbb8888'
            : 'dddd7777eeee8888',
          executionCompletionEventRequestInputs: [
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
          ],
          executionCompletionEventRequestStatus: 'not_recorded_read_only',
          executionCompletionEventRequestVersion:
            'repair-execution-completion-event-request/v1',
          executionCompletionRequestCreated: false,
          executionCompletionRequestFingerprint: input.workspaceId
            ? 'aaaa6666bbbb7777'
            : 'dddd6666eeee7777',
          executionCompletionRequestInputs: [
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
          ],
          executionCompletionRequestStatus: 'not_completed_read_only',
          executionCompletionRequestVersion:
            'repair-execution-completion-request/v1',
          executionFinalizationEventRequestCreated: false,
          executionFinalizationEventRequestFingerprint: input.workspaceId
            ? 'aaaa9999bbbbaaaa'
            : 'dddd9999eeeeaaaa',
          executionFinalizationEventRequestInputs: [
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
          ],
          executionFinalizationEventRequestStatus: 'not_recorded_read_only',
          executionFinalizationEventRequestVersion:
            'repair-execution-finalization-event-request/v1',
          executionFinalizationRequestCreated: false,
          executionFinalizationRequestFingerprint: input.workspaceId
            ? 'aaaa8888bbbb9999'
            : 'dddd8888eeee9999',
          executionFinalizationRequestInputs: [
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
          ],
          executionFinalizationRequestStatus: 'not_finalized_read_only',
          executionFinalizationRequestVersion:
            'repair-execution-finalization-request/v1',
          executionStatusPollRequestCreated: false,
          executionStatusPollRequestFingerprint: input.workspaceId
            ? 'aaaabbbb9999aaaa'
            : 'ddddbbbb9999aaaa',
          executionStatusPollRequestInputs: [
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
          ],
          executionStatusPollRequestStatus: 'not_started_read_only',
          executionStatusPollRequestVersion:
            'repair-execution-status-poll-request/v1',
          executionOperationEntryRequestCreated: false,
          executionOperationEntryRequestFingerprint: input.workspaceId
            ? 'aaaacccc9999bbbb'
            : 'ddddcccc9999bbbb',
          executionOperationEntryRequestInputs: [
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
          ],
          executionOperationEntryRequestStatus: 'not_opened_read_only',
          executionOperationEntryRequestVersion:
            'repair-execution-operation-entry-request/v1',
          executionApprovalUiRequestCreated: false,
          executionApprovalUiRequestFingerprint: input.workspaceId
            ? 'aaaadddd9999cccc'
            : 'dddddddd9999cccc',
          executionApprovalUiRequestInputs: [
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
          ],
          executionApprovalUiRequestStatus: 'not_rendered_read_only',
          executionApprovalUiRequestVersion:
            'repair-execution-approval-ui-request/v1',
          executionDiffPreviewRequestCreated: false,
          executionDiffPreviewRequestFingerprint: input.workspaceId
            ? 'aaaaeeee9999dddd'
            : 'ddddeeee9999dddd',
          executionDiffPreviewRequestInputs: [
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
          ],
          executionDiffPreviewRequestStatus: 'not_generated_read_only',
          executionDiffPreviewRequestVersion:
            'repair-execution-diff-preview-request/v1',
          executionApprovalDecisionRequestCreated: false,
          executionApprovalDecisionRequestFingerprint: input.workspaceId
            ? 'aaaa11119999eeee'
            : 'dddd11119999eeee',
          executionApprovalDecisionRequestInputs: [
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
          ],
          executionApprovalDecisionRequestStatus: 'not_recorded_read_only',
          executionApprovalDecisionRequestVersion:
            'repair-execution-approval-decision-request/v1',
          executionStartRequestCreated: false,
          executionStartRequestFingerprint: input.workspaceId
            ? 'aaaa22229999ffff'
            : 'dddd22229999ffff',
          executionStartRequestInputs: [
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
          ],
          executionStartRequestStatus: 'not_started_read_only',
          executionStartRequestVersion: 'repair-execution-start-request/v1',
          executionQueueRequestCreated: false,
          executionQueueRequestFingerprint: input.workspaceId
            ? 'aaaa333399991111'
            : 'dddd333399991111',
          executionQueueRequestInputs: [
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
          ],
          executionQueueRequestStatus: 'not_enqueued_read_only',
          executionQueueRequestVersion: 'repair-execution-queue-request/v1',
          executionWorkerLeaseRequestCreated: false,
          executionWorkerLeaseRequestFingerprint: input.workspaceId
            ? 'aaaa444499992222'
            : 'dddd444499992222',
          executionWorkerLeaseRequestInputs: [
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
          ],
          executionWorkerLeaseRequestStatus: 'not_acquired_read_only',
          executionWorkerLeaseRequestVersion:
            'repair-execution-worker-lease-request/v1',
          executionJobRunRequestCreated: false,
          executionJobRunRequestFingerprint: input.workspaceId
            ? 'aaaa555599993333'
            : 'dddd555599993333',
          executionJobRunRequestInputs: [
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
          ],
          executionJobRunRequestStatus: 'not_started_read_only',
          executionJobRunRequestVersion: 'repair-execution-job-run-request/v1',
          executionRunStepRequestCreated: false,
          executionRunStepRequestFingerprint: input.workspaceId
            ? 'aaaa666699994444'
            : 'dddd666699994444',
          executionRunStepRequestInputs: [
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
          ],
          executionRunStepRequestStatus: 'not_created_read_only',
          executionRunStepRequestVersion:
            'repair-execution-run-step-request/v1',
          executionRunStepTraceRequestCreated: false,
          executionRunStepTraceRequestFingerprint: input.workspaceId
            ? 'aaaa777799995555'
            : 'dddd777799995555',
          executionRunStepTraceRequestInputs: [
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
          ],
          executionRunStepTraceRequestStatus: 'not_created_read_only',
          executionRunStepTraceRequestVersion:
            'repair-execution-run-step-trace-request/v1',
          executionRunStepResultRequestCreated: false,
          executionRunStepResultRequestFingerprint: input.workspaceId
            ? 'aaaa888899996666'
            : 'dddd888899996666',
          executionRunStepResultRequestInputs: [
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
          ],
          executionRunStepResultRequestStatus: 'not_recorded_read_only',
          executionRunStepResultRequestVersion:
            'repair-execution-run-step-result-request/v1',
          executionRunStepCompletionRequestCreated: false,
          executionRunStepCompletionRequestFingerprint: input.workspaceId
            ? 'aaaa999988887777'
            : 'dddd999988887777',
          executionRunStepCompletionRequestInputs: [
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
          ],
          executionRunStepCompletionRequestStatus: 'not_completed_read_only',
          executionRunStepCompletionRequestVersion:
            'repair-execution-run-step-completion-request/v1',
          executionRunStepStatusEventRequestCreated: false,
          executionRunStepStatusEventRequestFingerprint: input.workspaceId
            ? 'aaaabbbb88887777'
            : 'ddddbbbb88887777',
          executionRunStepStatusEventRequestInputs: [
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
          ],
          executionRunStepStatusEventRequestStatus: 'not_recorded_read_only',
          executionRunStepStatusEventRequestVersion:
            'repair-execution-run-step-status-event-request/v1',
          executionRunStepRetryRequestCreated: false,
          executionRunStepRetryRequestFingerprint: input.workspaceId
            ? 'aaaaaaaa88889999'
            : 'ddddaaaa88889999',
          executionRunStepRetryRequestInputs: [
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
          ],
          executionRunStepRetryRequestStatus: 'not_scheduled_read_only',
          executionRunStepRetryRequestVersion:
            'repair-execution-run-step-retry-request/v1',
          executionRunStepRetryAttemptRequestCreated: false,
          executionRunStepRetryAttemptRequestFingerprint: input.workspaceId
            ? 'aaaacccc88889999'
            : 'ddddcccc88889999',
          executionRunStepRetryAttemptRequestInputs: [
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
          ],
          executionRunStepRetryAttemptRequestStatus: 'not_created_read_only',
          executionRunStepRetryAttemptRequestVersion:
            'repair-execution-run-step-retry-attempt-request/v1',
          executionRunStepRetryAttemptStatusEventRequestCreated: false,
          executionRunStepRetryAttemptStatusEventRequestFingerprint:
            input.workspaceId ? 'aaaabbbb88887777' : 'ddddbbbb88887777',
          executionRunStepRetryAttemptStatusEventRequestInputs: [
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
          ],
          executionRunStepRetryAttemptStatusEventRequestStatus:
            'not_recorded_read_only',
          executionRunStepRetryAttemptStatusEventRequestVersion:
            'repair-execution-run-step-retry-attempt-status-event-request/v1',
          executionRunStepRetryAttemptTraceRequestCreated: false,
          executionRunStepRetryAttemptTraceRequestFingerprint: input.workspaceId
            ? 'aaaadddd88887777'
            : 'dddddddd88887777',
          executionRunStepRetryAttemptTraceRequestInputs: [
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
          ],
          executionRunStepRetryAttemptTraceRequestStatus:
            'not_created_read_only',
          executionRunStepRetryAttemptTraceRequestVersion:
            'repair-execution-run-step-retry-attempt-trace-request/v1',
          executionRunStepRetryAttemptResultRequestCreated: false,
          executionRunStepRetryAttemptResultRequestFingerprint:
            input.workspaceId ? 'aaaaeeee88887777' : 'ddddeeee88887777',
          executionRunStepRetryAttemptResultRequestInputs: [
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
          ],
          executionRunStepRetryAttemptResultRequestStatus:
            'not_recorded_read_only',
          executionRunStepRetryAttemptResultRequestVersion:
            'repair-execution-run-step-retry-attempt-result-request/v1',
          executionRunStepRetryAttemptCompletionRequestCreated: false,
          executionRunStepRetryAttemptCompletionRequestFingerprint:
            input.workspaceId ? 'aaaaffff88887777' : 'ddddffff88887777',
          executionRunStepRetryAttemptCompletionRequestInputs: [
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
          ],
          executionRunStepRetryAttemptCompletionRequestStatus:
            'not_completed_read_only',
          executionRunStepRetryAttemptCompletionRequestVersion:
            'repair-execution-run-step-retry-attempt-completion-request/v1',
          executionRunStepRetryAttemptCompletionStatusEventRequestCreated: false,
          executionRunStepRetryAttemptCompletionStatusEventRequestFingerprint:
            input.workspaceId ? 'aaaaffff99997777' : 'ddddffff99997777',
          executionRunStepRetryAttemptCompletionStatusEventRequestInputs: [
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
          ],
          executionRunStepRetryAttemptCompletionStatusEventRequestStatus:
            'not_recorded_read_only',
          executionRunStepRetryAttemptCompletionStatusEventRequestVersion:
            'repair-execution-run-step-retry-attempt-completion-status-event-request/v1',
          executionRunStepRetryAttemptFinalizationRequestCreated: false,
          executionRunStepRetryAttemptFinalizationRequestFingerprint:
            input.workspaceId ? 'aaaaffffaa997777' : 'ddddffffaa997777',
          executionRunStepRetryAttemptFinalizationRequestInputs: [
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
          ],
          executionRunStepRetryAttemptFinalizationRequestStatus:
            'not_finalized_read_only',
          executionRunStepRetryAttemptFinalizationRequestVersion:
            'repair-execution-run-step-retry-attempt-finalization-request/v1',
          executionRunStepRetryAttemptFinalizationStatusEventRequestCreated: false,
          executionRunStepRetryAttemptFinalizationStatusEventRequestFingerprint:
            input.workspaceId ? 'aaaaffffbb997777' : 'ddddffffbb997777',
          executionRunStepRetryAttemptFinalizationStatusEventRequestInputs: [
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
          ],
          executionRunStepRetryAttemptFinalizationStatusEventRequestStatus:
            'not_recorded_read_only',
          executionRunStepRetryAttemptFinalizationStatusEventRequestVersion:
            'repair-execution-run-step-retry-attempt-finalization-status-event-request/v1',
          executionRunStepRetryAttemptCloseRequestCreated: false,
          executionRunStepRetryAttemptCloseRequestFingerprint: input.workspaceId
            ? 'aaaaffffcc997777'
            : 'ddddffffcc997777',
          executionRunStepRetryAttemptCloseRequestInputs: [
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
          ],
          executionRunStepRetryAttemptCloseRequestStatus:
            'not_closed_read_only',
          executionRunStepRetryAttemptCloseRequestVersion:
            'repair-execution-run-step-retry-attempt-close-request/v1',
          executionRunStepRetryAttemptCloseStatusEventRequestCreated: false,
          executionRunStepRetryAttemptCloseStatusEventRequestFingerprint:
            input.workspaceId ? 'aaaaffffdd997777' : 'ddddffffdd997777',
          executionRunStepRetryAttemptCloseStatusEventRequestInputs: [
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
          ],
          executionRunStepRetryAttemptCloseStatusEventRequestStatus:
            'not_recorded_read_only',
          executionRunStepRetryAttemptCloseStatusEventRequestVersion:
            'repair-execution-run-step-retry-attempt-close-status-event-request/v1',
          executionRunStepRetryAttemptRetentionPolicyRequestCreated: false,
          executionRunStepRetryAttemptRetentionPolicyRequestFingerprint:
            input.workspaceId ? 'aaaaffffaa997777' : 'ddddffffaa447777',
          executionRunStepRetryAttemptRetentionPolicyRequestInputs: [
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
          ],
          executionRunStepRetryAttemptRetentionPolicyRequestStatus:
            'not_created_read_only',
          executionRunStepRetryAttemptRetentionPolicyRequestVersion:
            'repair-execution-run-step-retry-attempt-retention-policy-request/v1',
          executionRunStepRetryAttemptRetentionPolicyRuleRequestCreated: false,
          executionRunStepRetryAttemptRetentionPolicyRuleRequestFingerprint:
            input.workspaceId ? 'aaaaffffaa887777' : 'ddddffffaa887777',
          executionRunStepRetryAttemptRetentionPolicyRuleRequestInputs: [
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
            'executionRunStepRetryAttemptRetentionPolicyRequestFingerprint',
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
          ],
          executionRunStepRetryAttemptRetentionPolicyRuleRequestStatus:
            'not_created_read_only',
          executionRunStepRetryAttemptRetentionPolicyRuleRequestVersion:
            'repair-execution-run-step-retry-attempt-retention-policy-rule-request/v1',
          executionRunStepRetryAttemptRetentionLeaseRequestCreated: false,
          executionRunStepRetryAttemptRetentionLeaseRequestFingerprint:
            input.workspaceId ? 'aaaaffffaa667777' : 'ddddffffaa667777',
          executionRunStepRetryAttemptRetentionLeaseRequestInputs: [
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
            'executionRunStepRetryAttemptRetentionPolicyRequestFingerprint',
            'executionRunStepRetryAttemptRetentionPolicyRuleRequestFingerprint',
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
          ],
          executionRunStepRetryAttemptRetentionLeaseRequestStatus:
            'not_acquired_read_only',
          executionRunStepRetryAttemptRetentionLeaseRequestVersion:
            'repair-execution-run-step-retry-attempt-retention-lease-request/v1',
          executionRunStepRetryAttemptArchiveRequestCreated: false,
          executionRunStepRetryAttemptArchiveRequestFingerprint:
            input.workspaceId ? 'aaaaffffee997777' : 'ddddffffee997777',
          executionRunStepRetryAttemptArchiveRequestInputs: [
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
            'executionRunStepRetryAttemptRetentionLeaseRequestFingerprint',
            'executionRunStepRetryAttemptRetentionPolicyRequestFingerprint',
            'executionRunStepRetryAttemptRetentionPolicyRuleRequestFingerprint',
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
          ],
          executionRunStepRetryAttemptArchiveRequestStatus:
            'not_archived_read_only',
          executionRunStepRetryAttemptArchiveRequestVersion:
            'repair-execution-run-step-retry-attempt-archive-request/v1',
          executionFailureEventRequestCreated: false,
          executionFailureEventRequestFingerprint: input.workspaceId
            ? 'aaaaffffddddeeee'
            : 'ddddffffddddeeee',
          executionFailureEventRequestInputs: [
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
          ],
          executionFailureEventRequestStatus: 'not_recorded_read_only',
          executionFailureEventRequestVersion:
            'repair-execution-failure-event-request/v1',
          executionProviderResponseRequestCreated: false,
          executionProviderResponseRequestFingerprint: input.workspaceId
            ? 'aaaaccccddddbbbb'
            : 'ddddccccddddbbbb',
          executionProviderResponseRequestInputs: [
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
          ],
          executionProviderResponseRequestStatus: 'not_recorded_read_only',
          executionProviderResponseRequestVersion:
            'repair-execution-provider-response-request/v1',
          executionResultRequestCreated: false,
          executionResultRequestFingerprint: input.workspaceId
            ? 'aaaaddddccccbbbb'
            : 'ddddddddccccbbbb',
          executionResultRequestInputs: [
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
          ],
          executionResultRequestStatus: 'not_recorded_read_only',
          executionResultRequestVersion: 'repair-execution-result-request/v1',
          executionRetryPolicyRequestCreated: false,
          executionRetryPolicyRequestFingerprint: input.workspaceId
            ? 'aaaabbbbddddcccc'
            : 'ddddbbbbddddcccc',
          executionRetryPolicyRequestInputs: [
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
          ],
          executionRetryPolicyRequestStatus: 'not_created_read_only',
          executionRetryPolicyRequestVersion:
            'repair-execution-retry-policy-request/v1',
          executionRollbackExecutorRequestCreated: false,
          executionRollbackExecutorRequestFingerprint: input.workspaceId
            ? 'aaaaccccffffeeee'
            : 'ddddccccffffeeee',
          executionRollbackExecutorRequestInputs: [
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
          ],
          executionRollbackExecutorRequestStatus: 'not_started_read_only',
          executionRollbackExecutorRequestVersion:
            'repair-execution-rollback-executor-request/v1',
          executionRollbackOperationRequestCreated: false,
          executionRollbackOperationRequestFingerprint: input.workspaceId
            ? 'aaaaddddffffeeee'
            : 'ddddddddffffeeee',
          executionRollbackOperationRequestInputs: [
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
          ],
          executionRollbackOperationRequestStatus: 'not_created_read_only',
          executionRollbackOperationRequestVersion:
            'repair-execution-rollback-operation-request/v1',
          executionRollbackOutcomeRequestCreated: false,
          executionRollbackOutcomeRequestFingerprint: input.workspaceId
            ? 'aaaaeeeeffffdddd'
            : 'ddddeeeeffffdddd',
          executionRollbackOutcomeRequestInputs: [
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
          ],
          executionRollbackOutcomeRequestStatus: 'not_recorded_read_only',
          executionRollbackOutcomeRequestVersion:
            'repair-execution-rollback-outcome-request/v1',
          executionRollbackTriggerRequestCreated: false,
          executionRollbackTriggerRequestFingerprint: input.workspaceId
            ? 'aaaabbbbffffeeee'
            : 'ddddbbbbffffeeee',
          executionRollbackTriggerRequestInputs: [
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
          ],
          executionRollbackTriggerRequestStatus: 'not_created_read_only',
          executionRollbackTriggerRequestVersion:
            'repair-execution-rollback-trigger-request/v1',
          executionTraceRequestCreated: false,
          executionTraceRequestFingerprint: input.workspaceId
            ? 'aaaabbbbccccdddd'
            : 'ddddbbbbccccdddd',
          executionTraceRequestInputs: [
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
          ],
          executionTraceRequestStatus: 'not_created_read_only',
          executionTraceRequestVersion: 'repair-execution-trace-request/v1',
          executionRequested: false,
          expectedCandidateEvidenceSetFingerprint:
            input.expectedCandidateEvidenceSetFingerprint,
          expectedTaskRouteEffectiveSourceEvidenceSetFingerprint:
            input.expectedTaskRouteEffectiveSourceEvidenceSetFingerprint,
          expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs: [
            ...taskRouteEffectiveSourceEvidenceSetFingerprintInputsFixture,
          ],
          expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion:
            taskRouteEffectiveSourceEvidenceSetFingerprintVersionFixture,
          expectedEmbeddingIndexContractEvidenceSetFingerprint:
            input.expectedEmbeddingIndexContractEvidenceSetFingerprint,
          expectedRerankRuntimeContractEvidenceSetFingerprint:
            input.expectedRerankRuntimeContractEvidenceSetFingerprint,
          expectedPreparedRouteOrderEvidenceSetFingerprint:
            input.expectedPreparedRouteOrderEvidenceSetFingerprint,
          expectedTargetLocatorFingerprint:
            input.expectedTargetLocatorFingerprint,
          expectedRepairGateManifestFingerprint:
            input.expectedRepairGateManifestFingerprint,
          expectedRepairGateManifestExportPolicyFingerprint:
            input.expectedRepairGateManifestExportPolicyFingerprint,
          expectedRepairGateManifestRetentionPolicyFingerprint:
            input.expectedRepairGateManifestRetentionPolicyFingerprint,
          idempotencyLockAcquired: false,
          idempotencyLockFingerprint: input.workspaceId
            ? 'abab3333cdcd4444'
            : 'efef3333abab4444',
          idempotencyLockInputs: [
            'candidateEvidenceSetFingerprint',
            'taskRouteEffectiveSourceEvidenceSetFingerprint',
            'idempotencyFingerprint',
            'idempotencyKey',
            'policyBindingFingerprint',
            'preparedRouteOrderEvidenceSetFingerprint',
            'requestStatus',
            'reviewBindingFingerprint',
            'submissionFingerprint',
            'targetLocatorFingerprint',
          ],
          idempotencyLockScope: input.workspaceId
            ? 'workspace'
            : 'global_diagnostics',
          idempotencyLockStatus: 'not_acquired_read_only',
          idempotencyLockVersion: 'repair-execution-idempotency-lock/v1',
          executionStateRequestCreated: false,
          executionStateRequestFingerprint: input.workspaceId
            ? 'aaaa9999bbbb0000'
            : 'dddd9999eeee0000',
          executionStateRequestInputs: [
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
          ],
          executionStateRequestStatus: 'not_started_read_only',
          executionStateRequestVersion: 'repair-execution-state-request/v1',
          rollbackPlanRequestCreated: false,
          rollbackPlanRequestFingerprint: input.workspaceId
            ? 'aaaaccccbbbbdddd'
            : 'ddddcccceeeedddd',
          rollbackPlanRequestInputs: [
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
          ],
          rollbackPlanRequestStatus: 'not_created_read_only',
          rollbackPlanRequestVersion:
            'repair-execution-rollback-plan-request/v1',
          repairJobRequestCreated: false,
          repairJobRequestFingerprint: input.workspaceId
            ? 'aaaa7777bbbb8888'
            : 'dddd7777eeee8888',
          repairJobRequestInputs: [
            'actorFingerprint',
            'approvalRecordRequestFingerprint',
            'auditEventRequestFingerprint',
            'candidateEvidenceSetFingerprint',
            'taskRouteEffectiveSourceEvidenceSetFingerprint',
            'idempotencyLockFingerprint',
            'operationSetFingerprint',
            'policyBindingFingerprint',
            'preparedRouteOrderEvidenceSetFingerprint',
            'repairJobFingerprint',
            'requestStatus',
            'reviewBindingFingerprint',
            'submissionFingerprint',
            'targetLocatorFingerprint',
            'workspaceId',
          ],
          repairJobRequestStatus: 'not_created_read_only',
          repairJobRequestVersion: 'repair-execution-repair-job-request/v1',
          matchedFields: [
            'expectedApprovalRecordFingerprint',
            'expectedApprovalRequestFingerprint',
            'expectedAuditEventFingerprint',
            'expectedCandidateEvidenceSetFingerprint',
            'expectedTaskRouteEffectiveSourceEvidenceSetFingerprint',
            'expectedEmbeddingIndexContractEvidenceSetFingerprint',
            'expectedExecutionGateFingerprint',
            'expectedExecutionGateStatus',
            'expectedExecutionStateFingerprint',
            'expectedIdempotencyFingerprint',
            'expectedPolicyBindingFingerprint',
            'expectedPreflightStatus',
            'expectedPreparedRouteOrderEvidenceSetFingerprint',
            'expectedRepairGateManifestExportPolicyFingerprint',
            'expectedRepairGateManifestFingerprint',
            'expectedRepairGateManifestRetentionPolicyFingerprint',
            'expectedRepairJobFingerprint',
            'expectedRerankRuntimeContractEvidenceSetFingerprint',
            'expectedReviewBindingFingerprint',
            'expectedRollbackPlanFingerprint',
            'expectedTargetLocatorFingerprint',
          ],
          mismatchedFields: [],
          mutationAvailable: false,
          preflight: {
            approvalRecordFingerprint: input.expectedApprovalRecordFingerprint,
            approvalRequestFingerprint:
              input.expectedApprovalRequestFingerprint,
            auditEventFingerprint: input.expectedAuditEventFingerprint,
            candidateEvidenceSetFingerprint:
              input.expectedCandidateEvidenceSetFingerprint,
            taskRouteEffectiveSourceEvidenceSetFingerprint:
              input.expectedTaskRouteEffectiveSourceEvidenceSetFingerprint,
            taskRouteEffectiveSourceEvidenceSetFingerprintInputs: [
              ...taskRouteEffectiveSourceEvidenceSetFingerprintInputsFixture,
            ],
            taskRouteEffectiveSourceEvidenceSetFingerprintVersion:
              taskRouteEffectiveSourceEvidenceSetFingerprintVersionFixture,
            embeddingIndexContractEvidenceSetFingerprint:
              input.expectedEmbeddingIndexContractEvidenceSetFingerprint,
            rerankRuntimeContractEvidenceSetFingerprint:
              input.expectedRerankRuntimeContractEvidenceSetFingerprint,
            preparedRouteOrderEvidenceSetFingerprint:
              input.expectedPreparedRouteOrderEvidenceSetFingerprint,
            expectedTaskRouteEffectiveSourceEvidenceSetFingerprint:
              input.expectedTaskRouteEffectiveSourceEvidenceSetFingerprint,
            expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs: [
              ...taskRouteEffectiveSourceEvidenceSetFingerprintInputsFixture,
            ],
            expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion:
              taskRouteEffectiveSourceEvidenceSetFingerprintVersionFixture,
            expectedEmbeddingIndexContractEvidenceSetFingerprint:
              input.expectedEmbeddingIndexContractEvidenceSetFingerprint,
            expectedRerankRuntimeContractEvidenceSetFingerprint:
              input.expectedRerankRuntimeContractEvidenceSetFingerprint,
            expectedPreparedRouteOrderEvidenceSetFingerprint:
              input.expectedPreparedRouteOrderEvidenceSetFingerprint,
            expectedTargetLocatorFingerprint:
              input.expectedTargetLocatorFingerprint,
            executionGateFingerprint: input.expectedExecutionGateFingerprint,
            executionGateStatus: input.expectedExecutionGateStatus,
            executionStateFingerprint: input.expectedExecutionStateFingerprint,
            idempotencyFingerprint: input.expectedIdempotencyFingerprint,
            policyBindingFingerprint: input.expectedPolicyBindingFingerprint,
            repairJobFingerprint: input.expectedRepairJobFingerprint,
            reviewBindingFingerprint: input.expectedReviewBindingFingerprint,
            rollbackPlanFingerprint: input.expectedRollbackPlanFingerprint,
            status: input.expectedPreflightStatus,
            targetLocatorFingerprint: input.expectedTargetLocatorFingerprint,
            workspaceId: input.workspaceId || null,
          },
          readOnly: true,
          requestFingerprint: input.workspaceId
            ? 'eeeeaaaabbbb9999'
            : 'ddddaaaabbbb8888',
          requestInputs: [
            'expectedApprovalRecordFingerprint',
            'expectedApprovalRequestFingerprint',
            'expectedAuditEventFingerprint',
            'expectedCandidateEvidenceSetFingerprint',
            'expectedTaskRouteEffectiveSourceEvidenceSetFingerprint',
            'expectedEmbeddingIndexContractEvidenceSetFingerprint',
            'expectedExecutionGateFingerprint',
            'expectedExecutionGateStatus',
            'expectedExecutionStateFingerprint',
            'expectedIdempotencyFingerprint',
            'expectedPolicyBindingFingerprint',
            'expectedPreflightStatus',
            'expectedPreparedRouteOrderEvidenceSetFingerprint',
            'expectedRepairGateManifestExportPolicyFingerprint',
            'expectedRepairGateManifestFingerprint',
            'expectedRepairGateManifestRetentionPolicyFingerprint',
            'expectedRepairJobFingerprint',
            'expectedRerankRuntimeContractEvidenceSetFingerprint',
            'expectedReviewBindingFingerprint',
            'expectedRollbackPlanFingerprint',
            'expectedTargetLocatorFingerprint',
          ],
          requestStatus: 'blocked_read_only',
          requestVersion: 'repair-execution-request/v1',
          supportBundleArtifactCreated: false,
          supportBundleArtifactFingerprint: input.workspaceId
            ? 'abab5555cdcd6666'
            : 'efef5555abab6666',
          supportBundleArtifactInputs: [
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
          ],
          supportBundleArtifactRecordRequestCreated: false,
          supportBundleArtifactRecordRequestFingerprint: input.workspaceId
            ? 'bbbb9999cccc0000'
            : 'ffff9999eeee0000',
          supportBundleArtifactRecordRequestInputs: [
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
          ],
          supportBundleArtifactRecordRequestStatus: 'not_created_read_only',
          supportBundleArtifactRecordRequestVersion:
            'prompt-registry-repair-gate-support-bundle-artifact-record-request/v1',
          supportBundleArtifactStatus: 'not_created_read_only',
          supportBundleArtifactVersion:
            'prompt-registry-repair-gate-support-bundle-artifact/v1',
          supportBundleArchiveFormat: 'json_manifest_bundle',
          supportBundleArchiveRequestCreated: false,
          supportBundleArchiveRequestFingerprint: input.workspaceId
            ? 'dddd9999eeee0000'
            : 'bbbb9999eeee0000',
          supportBundleArchiveRequestInputs: [
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
          ],
          supportBundleArchiveRequestStatus: 'not_created_read_only',
          supportBundleArchiveRequestVersion:
            'prompt-registry-repair-gate-support-bundle-archive-request/v1',
          supportBundleArchiveScope: 'support_bundle_download_archive',
          supportBundleArchiveSignaturePolicy:
            'support_bundle_archive_signature_read_only',
          supportBundleArchiveSignatureRequestCreated: false,
          supportBundleArchiveSignatureRequestFingerprint: input.workspaceId
            ? 'eeee9999ffff0000'
            : 'cccc9999ffff0000',
          supportBundleArchiveSignatureRequestInputs: [
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
          ],
          supportBundleArchiveSignatureRequestStatus: 'not_signed_read_only',
          supportBundleArchiveSignatureRequestVersion:
            'prompt-registry-repair-gate-support-bundle-archive-signature-request/v1',
          supportBundleStorageKeyRequestCreated: false,
          supportBundleStorageKeyRequestFingerprint: input.workspaceId
            ? 'cccc9999dddd0000'
            : 'aaaa9999dddd0000',
          supportBundleStorageKeyRequestInputs: [
            'artifactFingerprint',
            'artifactRecordRequestFingerprint',
            'manifestFingerprint',
            'packageFingerprint',
            'requestStatus',
            'storageKeyScope',
            'taskRouteEffectiveSourceEvidenceSetFingerprint',
          ],
          supportBundleStorageKeyRequestStatus: 'not_allocated_read_only',
          supportBundleStorageKeyRequestVersion:
            'prompt-registry-repair-gate-support-bundle-storage-key-request/v1',
          supportBundleStorageKeyScope: 'support_bundle_artifact_record',
          supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprint:
            input.expectedTaskRouteEffectiveSourceEvidenceSetFingerprint,
          supportBundleTaskRouteEffectiveSourceEvidenceSetDiagnosticsFingerprints:
            Array.from(
              new Set(
                readyPublishGateVerdict.repairActionPreview.operations.map(
                  operation => operation.diagnosticsFingerprint
                )
              )
            ).sort(),
          supportBundleTaskRouteEffectiveSourceEvidenceSetEntries:
            readyPublishGateVerdict.repairActionPreview.operations
              .map(operation => {
                const candidateEvidenceKeys = [
                  ...operation.candidateEvidenceKeys,
                ].sort();

                return {
                  ...candidateEvidenceClassificationSummaryFixture(
                    candidateEvidenceKeys
                  ),
                  candidateEvidenceCount: operation.candidateEvidenceCount,
                  candidateEvidenceReferenceSchemaArtifactFingerprint:
                    candidateEvidenceReferenceSchemaArtifactFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactFingerprintInputs: [
                    ...candidateEvidenceReferenceSchemaArtifactFingerprintInputsFixture,
                  ],
                  candidateEvidenceReferenceSchemaArtifactRecordFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordPersistenceStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordPersistenceStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageBackendStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageBackendStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStorageObjectStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageObjectStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordStorageStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStorageStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprint:
                    candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprintFixture,
                  candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprintInputs:
                    [
                      ...candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprintInputsFixture,
                    ],
                  candidateEvidenceReferenceSchemaArtifactRecordStatus:
                    candidateEvidenceReferenceSchemaArtifactRecordStatusFixture,
                  candidateEvidenceReferenceSchemaArtifactStatus:
                    candidateEvidenceReferenceSchemaArtifactStatusFixture,
                  candidateEvidenceReferenceSchemaFields: [
                    ...candidateEvidenceReferenceSchemaFieldsFixture,
                  ],
                  candidateEvidenceReferenceSchemaFingerprint:
                    candidateEvidenceReferenceSchemaFingerprintFixture,
                  candidateEvidenceReferenceSchemaFingerprintInputs: [
                    ...candidateEvidenceReferenceSchemaFingerprintInputsFixture,
                  ],
                  candidateEvidenceReferenceSchemaRegistryStatus:
                    candidateEvidenceReferenceSchemaRegistryStatusFixture,
                  candidateEvidenceReferenceSchemaVersion:
                    candidateEvidenceReferenceSchemaVersionFixture,
                  candidateEvidenceEntries: [
                    ...operation.candidateEvidenceEntries,
                  ],
                  candidateEvidenceFingerprint:
                    operation.candidateEvidenceFingerprint,
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
                left.operationFingerprint.localeCompare(
                  right.operationFingerprint
                )
              ),
          supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprintInputs: [
            ...taskRouteEffectiveSourceEvidenceSetFingerprintInputsFixture,
          ],
          supportBundleTaskRouteEffectiveSourceEvidenceSetOperationFingerprints:
            readyPublishGateVerdict.repairActionPreview.operations
              .map(operation => operation.operationFingerprint)
              .sort(),
          supportBundleTaskRouteEffectiveSourceEvidenceSetSourceFingerprints:
            Array.from(
              new Set(
                readyPublishGateVerdict.repairActionPreview.operations.flatMap(
                  operation => operation.taskRouteEffectiveSourceFingerprints
                )
              )
            ).sort(),
          supportBundleTaskRouteEffectiveSourceEvidenceSetFingerprintVersion:
            taskRouteEffectiveSourceEvidenceSetFingerprintVersionFixture,
          supportBundleAuditPersistenceRequestCreated: false,
          supportBundleAuditPersistenceRequestFingerprint: input.workspaceId
            ? 'ffff9999eeeeaaaa'
            : 'dddd9999ccccaaaa',
          supportBundleAuditPersistenceRequestInputs: [
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
          ],
          supportBundleAuditPersistenceRequestStatus: 'not_created_read_only',
          supportBundleAuditPersistenceRequestVersion:
            'prompt-registry-repair-gate-support-bundle-audit-persistence-request/v1',
          supportBundleAuditPersistenceStatus: 'not_persisted_read_only',
          supportBundleDownloadAuthorizationRequestCreated: false,
          supportBundleDownloadAuthorizationRequestFingerprint:
            input.workspaceId ? 'eeee7777ffff8888' : 'cccc7777dddd8888',
          supportBundleDownloadAuthorizationRequestInputs: [
            'actorFingerprint',
            'authorizationStatus',
            'downloadAuthorizationStatus',
            'exportPolicyFingerprint',
            'manifestFingerprint',
            'manifestMetadataFingerprint',
            'requestStatus',
            'supportBundleArtifactFingerprint',
            'taskRouteEffectiveSourceEvidenceSetFingerprint',
          ],
          supportBundleDownloadAuthorizationRequestStatus:
            'not_created_read_only',
          supportBundleDownloadAuthorizationRequestVersion:
            'prompt-registry-repair-gate-support-bundle-download-authorization-request/v1',
          supportBundleDownloadAuthorizationStatus: 'not_checked_read_only',
          supportBundleDownloadResolverRequestCreated: false,
          supportBundleDownloadResolverRequestFingerprint: input.workspaceId
            ? 'ffff7777aaaa8888'
            : 'dddd7777eeee8888',
          supportBundleDownloadResolverRequestInputs: [
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
          ],
          supportBundleDownloadResolverRequestStatus:
            'not_registered_read_only',
          supportBundleDownloadResolverRequestVersion:
            'prompt-registry-repair-gate-support-bundle-download-resolver-request/v1',
          supportBundleDownloadResolverRoute:
            'support_bundle_signed_archive_download',
          supportBundleSignedUrlPolicy: 'support_bundle_signed_url_read_only',
          supportBundleSignedUrlRequestCreated: false,
          supportBundleSignedUrlRequestFingerprint: input.workspaceId
            ? 'aaaa7777bbbb8888'
            : 'eeee7777ffff8888',
          supportBundleSignedUrlRequestInputs: [
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
          ],
          supportBundleSignedUrlRequestStatus: 'not_issued_read_only',
          supportBundleSignedUrlRequestVersion:
            'prompt-registry-repair-gate-support-bundle-signed-url-request/v1',
          supportBundleSignedUrlScope: 'support_bundle_download_resolver',
          supportBundleManifestFilename: `prompt-registry-repair-gate-manifest-42-${input.expectedRepairGateManifestFingerprint}.json`,
          supportBundleManifestFingerprint:
            input.expectedRepairGateManifestFingerprint,
          supportBundleManifestMetadataFilename: `prompt-registry-repair-gate-manifest-metadata-42-${input.expectedRepairGateManifestFingerprint}.json`,
          supportBundleManifestMetadataFingerprint:
            input.expectedRepairGateManifestExportPolicyFingerprint,
          supportBundlePackageCreated: false,
          supportBundlePackageFingerprint: input.workspaceId
            ? 'cdcd7777efef8888'
            : 'abab7777cdcd8888',
          supportBundlePackageInputs: [
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
          ],
          supportBundlePackageStatus: 'not_created_read_only',
          supportBundlePackageVersion:
            'prompt-registry-repair-gate-support-bundle-package/v1',
          supportBundleRetentionCleanupRequestCreated: false,
          supportBundleRetentionCleanupRequestFingerprint: input.workspaceId
            ? 'aaaa9999bbbb0000'
            : 'eeee9999ffff0000',
          supportBundleRetentionCleanupRequestInputs: [
            'actorFingerprint',
            'auditPersistenceRequestFingerprint',
            'manifestFingerprint',
            'requestStatus',
            'retentionCleanupStatus',
            'retentionPolicyFingerprint',
            'retentionPolicyStatus',
            'supportBundlePackageFingerprint',
            'taskRouteEffectiveSourceEvidenceSetFingerprint',
          ],
          supportBundleRetentionCleanupRequestStatus: 'not_scheduled_read_only',
          supportBundleRetentionCleanupRequestVersion:
            'prompt-registry-repair-gate-support-bundle-retention-cleanup-request/v1',
          supportBundleRetentionCleanupStatus: 'not_scheduled_read_only',
        },
      })
    );
    decideRepairExecutionApprovalMock.mockResolvedValue({
      decideCopilotRepairExecutionApproval: {
        actorId: 'user-1',
        approvalRecordFingerprint: 'approval-record-1111',
        approvalState: 'approved',
        auditEventCount: 4,
        auditEvents: repairExecutionAuditEventsFixture([
          'queued',
          'approval_approved',
          'waiting_approval',
          'requested',
        ]),
        auditEventFingerprint: 'audit-event-1111',
        candidateEvidenceSetFingerprint: 'aaaa5555bbbb6666',
        completedAt: null,
        createdAt: '2026-06-20T09:00:00.000Z',
        failureCode: null,
        failureMessage: null,
        id: 'repair-execution-1',
        idempotencyFingerprint: 'efef1111abab2222',
        idempotencyKey: 'repair-idempotency-key-1',
        lastAttemptAt: null,
        permissionStatus: 'granted',
        promptName: readyPublishGateVerdict.name,
        queuedAt: '2026-06-20T09:05:00.000Z',
        repairJobFingerprint: 'bcbc1111dede2222',
        requestFingerprint: 'repair-request-1111',
        requestedAction: 'prompt_registry_repair',
        runtimeResult: {
          executor: 'queued_repair_execution_worker',
          message:
            'Approval accepted; repair execution queued for worker runtime.',
          sideEffectsApplied: false,
          version: 'repair-execution-runtime-result/v1',
        },
        sideEffectCount: 0,
        sideEffects: [],
        status: 'queued',
        targetLocatorFingerprint: 'ddd111eee222ffff',
        taskRouteEvidenceSetFingerprint: 'aaaa5656bbbb6767',
        updatedAt: '2026-06-20T09:05:00.000Z',
        workerAttempt: 0,
        workerLeaseExpiresAt: null,
        workerLeaseId: null,
        workerMaxAttempts: 3,
        workspaceId: 'workspace-1',
        agentRun: {
          actorId: 'user-1',
          completedAt: null,
          createdAt: '2026-06-20T09:00:00.000Z',
          evidenceFingerprint: 'agent-evidence-1111',
          executionResultCount: 0,
          executionResults: [],
          failureCode: null,
          failureMessage: null,
          id: 'agent-run-1',
          lastAttemptAt: null,
          queuedAt: '2026-06-20T09:05:00.000Z',
          sourceId: 'repair-execution-1',
          sourceType: 'repair_execution_request',
          startedAt: '2026-06-20T09:00:00.000Z',
          status: 'queued',
          targetFingerprint: 'agent-target-1111',
          timelineFingerprint: 'agent-timeline-queued',
          title: 'Repair execution: Make it real',
          updatedAt: '2026-06-20T09:05:00.000Z',
          workerAttempt: 0,
          workerLeaseExpiresAt: null,
          workerLeaseId: null,
          workerMaxAttempts: 3,
          workflow: 'prompt_registry_repair_execution',
          workspaceId: 'workspace-1',
          steps: [
            {
              actorId: 'user-1',
              completedAt: null,
              createdAt: '2026-06-20T09:00:00.000Z',
              evidenceFingerprint: 'agent-step-evidence-1111',
              id: 'agent-step-1',
              order: 0,
              outputSummary: {
                approvalState: 'approved',
                repairExecutionRequestId: 'repair-execution-1',
                runtimeExecutor: 'queued_repair_execution_worker',
                sideEffectsApplied: false,
                version: 'agent-runtime-step-output-summary/v1',
              },
              runId: 'agent-run-1',
              startedAt: '2026-06-20T09:00:00.000Z',
              status: 'pending',
              stepKey: 'repair_execution',
              stepType: 'model',
              title: 'Repair execution request',
              updatedAt: '2026-06-20T09:05:00.000Z',
              workspaceId: 'workspace-1',
            },
          ],
          timelineEvents: [
            {
              actorId: 'user-1',
              createdAt: '2026-06-20T09:00:00.000Z',
              eventFingerprint: 'agent-event-1111',
              eventType: 'run_status',
              id: 'agent-event-1',
              ordinal: 0,
              payload: {},
              runId: 'agent-run-1',
              status: 'waiting_approval',
              stepId: null,
              summary: 'Repair execution run waiting_approval',
              workspaceId: 'workspace-1',
            },
            {
              actorId: 'user-1',
              createdAt: '2026-06-20T09:00:00.000Z',
              eventFingerprint: 'agent-event-2222',
              eventType: 'approval_step',
              id: 'agent-event-2',
              ordinal: 1,
              payload: {},
              runId: 'agent-run-1',
              status: 'waiting_approval',
              stepId: 'agent-step-1',
              summary: 'Repair execution waiting for approval',
              workspaceId: 'workspace-1',
            },
            {
              actorId: 'user-1',
              createdAt: '2026-06-20T09:05:00.000Z',
              eventFingerprint: 'agent-event-3333',
              eventType: 'run_status',
              id: 'agent-event-3',
              ordinal: 2,
              payload: {},
              runId: 'agent-run-1',
              status: 'queued',
              stepId: null,
              summary: 'Repair execution run queued',
              workspaceId: 'workspace-1',
            },
            {
              actorId: 'user-1',
              createdAt: '2026-06-20T09:05:00.000Z',
              eventFingerprint: 'agent-event-4444',
              eventType: 'model_step',
              id: 'agent-event-4',
              ordinal: 3,
              payload: {
                runtimeExecutor: 'queued_repair_execution_worker',
                sideEffectsApplied: false,
              },
              runId: 'agent-run-1',
              status: 'pending',
              stepId: 'agent-step-1',
              summary: 'Repair execution queued for worker',
              workspaceId: 'workspace-1',
            },
          ],
        },
      },
    });
    controlRepairExecutionMock.mockImplementation(
      ({
        input,
      }: {
        input: {
          action: 'cancel' | 'retry' | 'resume_with_payload';
          executorPayload?: Record<string, string>;
          executionRequestId: string;
          workspaceId: string;
        };
      }) =>
        Promise.resolve({
          controlCopilotRepairExecution:
            input.action === 'retry' || input.action === 'resume_with_payload'
              ? {
                  actorId: 'user-1',
                  approvalRecordFingerprint: 'approval-record-1111',
                  approvalState: 'approved',
                  auditEventCount: 11,
                  auditEvents: repairExecutionAuditEventsFixture([
                    'queued',
                    input.action === 'resume_with_payload'
                      ? 'manual_resume_requested'
                      : 'manual_retry_requested',
                    'failed',
                    'running',
                    'queued',
                  ]),
                  auditEventFingerprint: 'audit-event-1111',
                  candidateEvidenceSetFingerprint: 'aaaa5555bbbb6666',
                  completedAt: null,
                  createdAt: '2026-06-20T09:00:00.000Z',
                  failureCode: null,
                  failureMessage: null,
                  id: input.executionRequestId,
                  idempotencyFingerprint: 'efef1111abab2222',
                  idempotencyKey: 'repair-idempotency-key-1',
                  lastAttemptAt: '2026-06-20T09:09:00.000Z',
                  permissionStatus: 'granted',
                  promptName: readyPublishGateVerdict.name,
                  queuedAt: '2026-06-20T09:11:00.000Z',
                  repairJobFingerprint: 'bcbc1111dede2222',
                  requestFingerprint: 'repair-request-1111',
                  requestedAction: 'prompt_registry_repair',
                  runtimeResult: {
                    executor:
                      input.action === 'resume_with_payload'
                        ? 'manual_repair_execution_payload_correction'
                        : 'manual_repair_execution_control',
                    message:
                      input.action === 'resume_with_payload'
                        ? 'Manual resume with corrected executor payload requested; repair execution queued for worker runtime.'
                        : 'Manual retry requested; repair execution queued for worker runtime.',
                    sideEffectsApplied: false,
                    version: 'repair-execution-runtime-result/v1',
                  },
                  sideEffectCount: 0,
                  sideEffects: [],
                  status: 'queued',
                  targetLocatorFingerprint: 'ddd111eee222ffff',
                  taskRouteEvidenceSetFingerprint: 'aaaa5656bbbb6767',
                  updatedAt: '2026-06-20T09:11:00.000Z',
                  workerAttempt: 2,
                  workerLeaseExpiresAt: null,
                  workerLeaseId: null,
                  workerMaxAttempts: 3,
                  workspaceId: input.workspaceId,
                  agentRun: {
                    actorId: 'user-1',
                    completedAt: null,
                    createdAt: '2026-06-20T09:00:00.000Z',
                    evidenceFingerprint: 'agent-evidence-1111',
                    executionResultCount: 0,
                    executionResults: [],
                    failureCode: null,
                    failureMessage: null,
                    id: 'agent-run-1',
                    lastAttemptAt: '2026-06-20T09:09:00.000Z',
                    queuedAt: '2026-06-20T09:11:00.000Z',
                    sourceId: input.executionRequestId,
                    sourceType: 'repair_execution_request',
                    startedAt: '2026-06-20T09:00:00.000Z',
                    status: 'queued',
                    targetFingerprint: 'agent-target-1111',
                    timelineFingerprint:
                      input.action === 'resume_with_payload'
                        ? 'agent-timeline-manual-resume-payload'
                        : 'agent-timeline-manual-retry',
                    title: 'Repair execution: Make it real',
                    updatedAt: '2026-06-20T09:11:00.000Z',
                    workerAttempt: 2,
                    workerLeaseExpiresAt: null,
                    workerLeaseId: null,
                    workerMaxAttempts: 3,
                    workflow: 'prompt_registry_repair_execution',
                    workspaceId: input.workspaceId,
                    steps: [
                      {
                        actorId: 'user-1',
                        completedAt: null,
                        createdAt: '2026-06-20T09:00:00.000Z',
                        evidenceFingerprint: 'agent-step-evidence-1111',
                        id: 'agent-step-1',
                        order: 0,
                        outputSummary: {
                          approvalState: 'approved',
                          repairExecutionRequestId: input.executionRequestId,
                          runtimeExecutor:
                            input.action === 'resume_with_payload'
                              ? 'manual_repair_execution_payload_correction'
                              : 'manual_repair_execution_control',
                          sideEffectsApplied: false,
                          version: 'agent-runtime-step-output-summary/v1',
                        },
                        runId: 'agent-run-1',
                        startedAt: '2026-06-20T09:00:00.000Z',
                        status: 'pending',
                        stepKey: 'repair_execution',
                        stepType: 'model',
                        title: 'Repair execution request',
                        updatedAt: '2026-06-20T09:11:00.000Z',
                        workspaceId: input.workspaceId,
                      },
                    ],
                    timelineEvents: [
                      {
                        actorId: 'user-1',
                        createdAt: '2026-06-20T09:11:00.000Z',
                        eventFingerprint: 'agent-event-retry-1',
                        eventType: 'run_status',
                        id: 'agent-event-retry-1',
                        ordinal: 0,
                        payload: {},
                        runId: 'agent-run-1',
                        status: 'queued',
                        stepId: null,
                        summary: 'Repair execution run queued',
                        workspaceId: input.workspaceId,
                      },
                      {
                        actorId: 'user-1',
                        createdAt: '2026-06-20T09:11:00.000Z',
                        eventFingerprint: 'agent-event-retry-2',
                        eventType: 'model_step',
                        id: 'agent-event-retry-2',
                        ordinal: 1,
                        payload: {
                          runtimeExecutor:
                            input.action === 'resume_with_payload'
                              ? 'manual_repair_execution_payload_correction'
                              : 'manual_repair_execution_control',
                          sideEffectsApplied: false,
                        },
                        runId: 'agent-run-1',
                        status: 'pending',
                        stepId: 'agent-step-1',
                        summary: 'Repair execution queued for worker',
                        workspaceId: input.workspaceId,
                      },
                    ],
                  },
                }
              : {
                  actorId: 'user-1',
                  approvalRecordFingerprint: 'approval-record-1111',
                  approvalState: 'approved',
                  auditEventCount: 5,
                  auditEvents: repairExecutionAuditEventsFixture([
                    'cancelled',
                    'queued',
                    'approval_approved',
                    'waiting_approval',
                    'requested',
                  ]),
                  auditEventFingerprint: 'audit-event-1111',
                  candidateEvidenceSetFingerprint: 'aaaa5555bbbb6666',
                  completedAt: '2026-06-20T09:06:00.000Z',
                  createdAt: '2026-06-20T09:00:00.000Z',
                  failureCode: null,
                  failureMessage: null,
                  id: input.executionRequestId,
                  idempotencyFingerprint: 'efef1111abab2222',
                  idempotencyKey: 'repair-idempotency-key-1',
                  lastAttemptAt: null,
                  permissionStatus: 'granted',
                  promptName: readyPublishGateVerdict.name,
                  queuedAt: '2026-06-20T09:05:00.000Z',
                  repairJobFingerprint: 'bcbc1111dede2222',
                  requestFingerprint: 'repair-request-1111',
                  requestedAction: 'prompt_registry_repair',
                  runtimeResult: {
                    executor: 'manual_repair_execution_control',
                    message:
                      'Manual cancellation requested; repair execution request cancelled.',
                    sideEffectsApplied: false,
                    version: 'repair-execution-runtime-result/v1',
                  },
                  sideEffectCount: 0,
                  sideEffects: [],
                  status: 'cancelled',
                  targetLocatorFingerprint: 'ddd111eee222ffff',
                  taskRouteEvidenceSetFingerprint: 'aaaa5656bbbb6767',
                  updatedAt: '2026-06-20T09:06:00.000Z',
                  workerAttempt: 0,
                  workerLeaseExpiresAt: null,
                  workerLeaseId: null,
                  workerMaxAttempts: 3,
                  workspaceId: input.workspaceId,
                  agentRun: {
                    actorId: 'user-1',
                    completedAt: '2026-06-20T09:06:00.000Z',
                    createdAt: '2026-06-20T09:00:00.000Z',
                    evidenceFingerprint: 'agent-evidence-1111',
                    executionResultCount: 0,
                    executionResults: [],
                    failureCode: null,
                    failureMessage: null,
                    id: 'agent-run-1',
                    lastAttemptAt: null,
                    queuedAt: '2026-06-20T09:05:00.000Z',
                    sourceId: input.executionRequestId,
                    sourceType: 'repair_execution_request',
                    startedAt: '2026-06-20T09:00:00.000Z',
                    status: 'cancelled',
                    targetFingerprint: 'agent-target-1111',
                    timelineFingerprint: 'agent-timeline-manual-cancel',
                    title: 'Repair execution: Make it real',
                    updatedAt: '2026-06-20T09:06:00.000Z',
                    workerAttempt: 0,
                    workerLeaseExpiresAt: null,
                    workerLeaseId: null,
                    workerMaxAttempts: 3,
                    workflow: 'prompt_registry_repair_execution',
                    workspaceId: input.workspaceId,
                    steps: [
                      {
                        actorId: 'user-1',
                        completedAt: '2026-06-20T09:06:00.000Z',
                        createdAt: '2026-06-20T09:00:00.000Z',
                        evidenceFingerprint: 'agent-step-evidence-1111',
                        id: 'agent-step-1',
                        order: 0,
                        outputSummary: {
                          approvalState: 'approved',
                          repairExecutionRequestId: input.executionRequestId,
                          runtimeExecutor: 'manual_repair_execution_control',
                          sideEffectsApplied: false,
                          version: 'agent-runtime-step-output-summary/v1',
                        },
                        runId: 'agent-run-1',
                        startedAt: '2026-06-20T09:00:00.000Z',
                        status: 'skipped',
                        stepKey: 'repair_execution',
                        stepType: 'approval',
                        title: 'Repair execution request',
                        updatedAt: '2026-06-20T09:06:00.000Z',
                        workspaceId: input.workspaceId,
                      },
                    ],
                    timelineEvents: [
                      {
                        actorId: 'user-1',
                        createdAt: '2026-06-20T09:06:00.000Z',
                        eventFingerprint: 'agent-event-cancel-1',
                        eventType: 'run_status',
                        id: 'agent-event-cancel-1',
                        ordinal: 0,
                        payload: {},
                        runId: 'agent-run-1',
                        status: 'cancelled',
                        stepId: null,
                        summary: 'Repair execution run cancelled',
                        workspaceId: input.workspaceId,
                      },
                      {
                        actorId: 'user-1',
                        createdAt: '2026-06-20T09:06:00.000Z',
                        eventFingerprint: 'agent-event-cancel-2',
                        eventType: 'approval_step',
                        id: 'agent-event-cancel-2',
                        ordinal: 1,
                        payload: {
                          runtimeExecutor: 'manual_repair_execution_control',
                          sideEffectsApplied: false,
                        },
                        runId: 'agent-run-1',
                        status: 'skipped',
                        stepId: 'agent-step-1',
                        summary: 'Repair execution approval rejected',
                        workspaceId: input.workspaceId,
                      },
                    ],
                  },
                },
        })
    );
    useMutationMock.mockImplementation(({ mutation }) => {
      if (mutation === requestCopilotPromptRegistryRepairExecutionMutation) {
        return {
          isMutating: false,
          trigger: requestRepairExecutionMock,
        };
      }
      if (mutation === decideCopilotRepairExecutionApprovalMutation) {
        return {
          isMutating: false,
          trigger: decideRepairExecutionApprovalMock,
        };
      }
      if (mutation === controlCopilotRepairExecutionMutation) {
        return {
          isMutating: false,
          trigger: controlRepairExecutionMock,
        };
      }
      if (mutation === controlCopilotAgentRuntimeRunMutation) {
        return {
          isMutating: false,
          trigger: controlAgentRuntimeRunMock,
        };
      }
      if (mutation === createCopilotSupportBundleMutation) {
        return {
          isMutating: false,
          trigger: createSupportBundleMock,
        };
      }
      if (mutation === authorizeCopilotSupportBundleDownloadMutation) {
        return {
          isMutating: false,
          trigger: authorizeSupportBundleDownloadMock,
        };
      }
      if (mutation === cleanupCopilotSupportBundleRetentionMutation) {
        return {
          isMutating: false,
          trigger: cleanupSupportBundleRetentionMock,
        };
      }
      if (
        mutation === replayCopilotSupportBundleTransferForwardingEventMutation
      ) {
        return {
          isMutating: false,
          trigger: replaySupportBundleTransferForwardingEventMock,
        };
      }
      if (mutation === retryCopilotProviderHealthProbeAttemptMutation) {
        return {
          isMutating: false,
          trigger: retryProviderHealthProbeAttemptMock,
        };
      }
      if (mutation === updateAppConfigMutation) {
        return {
          isMutating: false,
          trigger: updateAppConfigMock,
        };
      }
      throw new Error('Unexpected mutation');
    });
    useQueryMock.mockImplementation(options => {
      if (!options) {
        return {
          data: undefined,
          isValidating: false,
          mutate: vi.fn(),
        };
      }

      const { query, variables } = options;

      if (query === appConfigQuery) {
        return {
          data: {
            appConfig: {
              copilot: {
                enabled: true,
                byok: {
                  allowedProviders: ['openai', 'anthropic', 'gemini', 'fal'],
                  allowCustomEndpoint: true,
                  allowPrivateEndpoint: false,
                  enabled: true,
                },
                exa: {
                  key: '',
                },
                prompts: {
                  defaults: {
                    text: {
                      model: 'gpt-4o-mini',
                    },
                  },
                  overrides: [
                    {
                      name: 'Chat With LocalMind AI',
                      model: 'gpt-4o-mini',
                    },
                  ],
                },
                providers: {
                  anthropic: {
                    apiKey: '',
                    baseURL: 'https://api.anthropic.com/v1',
                  },
                  anthropicVertex: {},
                  cloudflareWorkersAi: {
                    accountId: '',
                    apiToken: '',
                    baseURL: '',
                  },
                  defaults: {
                    text: 'openai-main',
                    fallback: 'openai-main',
                  },
                  fal: {
                    apiKey: '',
                  },
                  gemini: {
                    apiKey: '',
                    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
                  },
                  geminiVertex: {},
                  openai: {
                    apiKey: '',
                    baseURL: 'https://api.openai.com/v1',
                  },
                  openaiCompatible: {
                    apiKey: '',
                    apiStyle: 'chat_completions',
                    baseURL: '',
                  },
                  profiles: [
                    {
                      id: 'openai-main',
                      type: 'openai',
                      config: {
                        apiKey: '',
                      },
                    },
                  ],
                  routePolicy: {
                    enabled: true,
                  },
                },
                storage: {
                  provider: 'fs',
                  bucket: 'copilot',
                  config: {
                    path: '~/.affine/storage',
                  },
                },
                supportBundles: {
                  objectStorageWebhooks: [],
                },
                tasks: {
                  models: {
                    embedding: 'text-embedding-3-small',
                    rerank: 'bge-reranker-v2',
                    workspaceIndexing: 'workspace-embedding',
                  },
                },
                unsplash: {
                  key: '',
                },
              },
            },
          },
          isValidating: false,
          mutate: vi.fn(),
        };
      }

      if (query === getCopilotPromptsQuery) {
        return {
          data: {
            currentUser: {
              copilot: {
                prompts: promptCatalogPayload,
              },
            },
          },
          isValidating: false,
          mutate: vi.fn(),
        };
      }

      if (query === getPromptModelsQuery) {
        return {
          data: {
            currentUser: {
              copilot: {
                models: modelsPayload,
              },
            },
          },
          isValidating: false,
          mutate: mutateMock,
        };
      }

      if (query === getCopilotProviderHealthProbeAttemptsQuery) {
        return {
          data: {
            currentUser: {
              copilot: {
                providerHealthProbeAttempts: providerHealthProbeAttemptsPayload,
              },
            },
          },
          isValidating: false,
          mutate: vi.fn(),
        };
      }

      if (query === getCopilotPromptRegistryPublishGateQuery) {
        const name = (variables as { name?: string } | undefined)?.name;
        const workspaceId = (variables as { workspaceId?: string } | undefined)
          ?.workspaceId;

        return {
          data: {
            currentUser: {
              copilot: {
                promptRegistryPublishGate:
                  name === 'Legacy empty registry prompt'
                    ? blockedPublishGateVerdict
                    : name === 'Make it real' &&
                        workspaceId === 'rerank-workspace'
                      ? rerankRepairPublishGateVerdict
                      : name === 'Make it real' && workspaceId === 'workspace-1'
                        ? actionDryRunFailedPublishGateVerdict
                        : readyPublishGateVerdict,
              },
            },
          },
          isValidating: false,
          mutate: vi.fn(),
        };
      }

      if (query === getCopilotPromptRegistryRepairPreflightQuery) {
        const variablesInput = variables as
          | {
              submission?: {
                candidateEvidenceSetFingerprint?: string;
                contractVersion?: string;
                embeddingIndexContractEvidenceSetFingerprint?: string;
                idempotencyKey?: string;
                preparedRouteOrderEvidenceSetFingerprint?: string;
                rerankRuntimeContractEvidenceSetFingerprint?: string;
                submissionFingerprint?: string;
                targetLocatorFingerprint?: string;
                taskRouteEffectiveSourceEvidenceSetFingerprint?: string;
              };
              workspaceId?: string;
            }
          | undefined;
        const submission = variablesInput?.submission;

        return {
          data: {
            currentUser: {
              copilot: {
                promptRegistryRepairPreflight: {
                  accepted: false,
                  actorFingerprint: variablesInput?.workspaceId
                    ? '5151aaaabbbb6666'
                    : '4141aaaabbbb5555',
                  actorSnapshotInputs: [
                    'actorHash',
                    'actorType',
                    'source',
                    'workspaceId',
                  ],
                  actorSnapshotStatus: 'bound_to_current_user',
                  actorSnapshotVersion: 'repair-preflight-actor-snapshot/v1',
                  actorType: 'user',
                  approvalCheckpoints: variablesInput?.workspaceId
                    ? [
                        'approval_required',
                        'authorization_snapshot',
                        'capability_scope',
                        'operation_set',
                        'read_only_contract',
                        'review_mode:dry_run',
                        'review_mode:preview',
                        'review_mode:probe',
                      ]
                    : [
                        'approval_required',
                        'authorization_snapshot',
                        'capability_scope',
                        'operation_set',
                        'read_only_contract',
                        'review_mode:preview',
                        'review_mode:probe',
                      ],
                  approvalModes: variablesInput?.workspaceId
                    ? ['dry_run', 'preview', 'probe']
                    : ['preview', 'probe'],
                  approvalRecordCreated: false,
                  approvalRecordFingerprint: variablesInput?.workspaceId
                    ? '9696aaaabbbb1111'
                    : '8585aaaabbbb0000',
                  approvalRecordInputs: [
                    'actorFingerprint',
                    'approvalRequestFingerprint',
                    'auditBindingFingerprint',
                    'policyBindingFingerprint',
                    'reviewBindingFingerprint',
                    'workspaceId',
                  ],
                  approvalRecordStatus: 'not_created_read_only',
                  approvalRecordVersion: 'repair-preflight-approval-record/v1',
                  approvalRequestFingerprint: variablesInput?.workspaceId
                    ? '8585aaaabbbb0000'
                    : '7474aaaabbbb9999',
                  approvalRequestInputs: [
                    'approvalCheckpoints',
                    'approvalModes',
                    'approvalPolicyFingerprint',
                    'approvalRequired',
                    'authorizationFingerprint',
                    'authorizationStatus',
                    'policyBindingFingerprint',
                    'reviewBindingFingerprint',
                  ],
                  approvalRequestStatus: 'approval_required',
                  approvalRequestVersion:
                    'repair-preflight-approval-request/v1',
                  approvalRequired: true,
                  auditBindingFingerprint: variablesInput?.workspaceId
                    ? '6262aaaabbbb7777'
                    : '5252aaaabbbb6666',
                  auditBindingInputs: [
                    'actorFingerprint',
                    'capabilityFingerprint',
                    'permissionFingerprint',
                    'reviewBindingFingerprint',
                  ],
                  auditBindingStatus: 'ready_for_review',
                  auditBindingVersion: 'repair-preflight-audit-binding/v1',
                  auditEventCreated: false,
                  auditEventFingerprint: variablesInput?.workspaceId
                    ? 'a7a7aaaabbbb2222'
                    : '9696aaaabbbb1111',
                  auditEventInputs: [
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
                  ],
                  auditEventStatus: 'not_created_read_only',
                  auditEventVersion: 'repair-preflight-audit-event/v1',
                  authorizationStatus: 'approval_required',
                  candidateEvidenceSetFingerprint:
                    submission?.candidateEvidenceSetFingerprint ?? '',
                  taskRouteEffectiveSourceEvidenceSetFingerprint:
                    submission?.taskRouteEffectiveSourceEvidenceSetFingerprint ??
                    '',
                  taskRouteEffectiveSourceEvidenceSetFingerprintInputs: [
                    ...taskRouteEffectiveSourceEvidenceSetFingerprintInputsFixture,
                  ],
                  taskRouteEffectiveSourceEvidenceSetFingerprintVersion:
                    taskRouteEffectiveSourceEvidenceSetFingerprintVersionFixture,
                  embeddingIndexContractEvidenceSetFingerprint:
                    submission?.embeddingIndexContractEvidenceSetFingerprint ??
                    '',
                  rerankRuntimeContractEvidenceSetFingerprint:
                    submission?.rerankRuntimeContractEvidenceSetFingerprint ??
                    '',
                  preparedRouteOrderEvidenceSetFingerprint:
                    submission?.preparedRouteOrderEvidenceSetFingerprint ?? '',
                  capabilityCheckMode: 'preview_capability_snapshot',
                  capabilityFingerprint: variablesInput?.workspaceId
                    ? 'aaaa1111bbbb2222'
                    : 'dddd1111eeee2222',
                  capabilitySource: 'repair_action_preview',
                  capabilityStatus: 'declared',
                  contractVersion: submission?.contractVersion ?? '',
                  currentSubmissionFingerprint:
                    submission?.submissionFingerprint ?? '',
                  expectedSubmissionFingerprint:
                    submission?.submissionFingerprint ?? '',
                  executionGateFingerprint: variablesInput?.workspaceId
                    ? '6969aaaabbbb0000'
                    : '5858aaaabbbb9999',
                  executionGateInputs: [
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
                  ],
                  executionGateStatus: 'blocked_read_only',
                  executionGateVersion: 'repair-preflight-execution-gate/v1',
                  executionStateCreated: false,
                  executionStateFingerprint: variablesInput?.workspaceId
                    ? 'c8c8aaaabbbb3333'
                    : 'b7b7aaaabbbb2222',
                  executionStateInputs: [
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
                  ],
                  executionStateStatus: 'not_started_read_only',
                  executionStateVersion: 'repair-preflight-execution-state/v1',
                  expectedCandidateEvidenceSetFingerprint:
                    submission?.candidateEvidenceSetFingerprint ?? '',
                  expectedTaskRouteEffectiveSourceEvidenceSetFingerprint:
                    submission?.taskRouteEffectiveSourceEvidenceSetFingerprint ??
                    '',
                  expectedTaskRouteEffectiveSourceEvidenceSetFingerprintInputs:
                    [
                      ...taskRouteEffectiveSourceEvidenceSetFingerprintInputsFixture,
                    ],
                  expectedTaskRouteEffectiveSourceEvidenceSetFingerprintVersion:
                    taskRouteEffectiveSourceEvidenceSetFingerprintVersionFixture,
                  expectedEmbeddingIndexContractEvidenceSetFingerprint:
                    submission?.embeddingIndexContractEvidenceSetFingerprint ??
                    '',
                  expectedRerankRuntimeContractEvidenceSetFingerprint:
                    submission?.rerankRuntimeContractEvidenceSetFingerprint ??
                    '',
                  expectedPreparedRouteOrderEvidenceSetFingerprint:
                    submission?.preparedRouteOrderEvidenceSetFingerprint ?? '',
                  expectedTargetLocatorFingerprint:
                    submission?.targetLocatorFingerprint ?? '',
                  rollbackPlanCreated: false,
                  rollbackPlanFingerprint: variablesInput?.workspaceId
                    ? 'd9d9aaaabbbb4444'
                    : 'c8c8aaaabbbb3333',
                  rollbackPlanInputs: [
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
                  ],
                  rollbackPlanStatus: 'not_created_read_only',
                  rollbackPlanVersion: 'repair-preflight-rollback-plan/v1',
                  idempotencyFingerprint: variablesInput?.workspaceId
                    ? 'abab1111cdcd2222'
                    : 'efef1111abab2222',
                  idempotencyKey:
                    variablesInput?.submission?.idempotencyKey ?? '',
                  idempotencyLockAcquired: false,
                  idempotencyScope: variablesInput?.workspaceId
                    ? 'workspace'
                    : 'global_diagnostics',
                  idempotencyStatus: 'not_acquired_read_only',
                  idempotencyVersion: 'repair-preflight-idempotency/v1',
                  matchedFields: [
                    'approvalPolicyFingerprint',
                    'authorizationFingerprint',
                    'candidateEvidenceSetFingerprint',
                    'taskRouteEffectiveSourceEvidenceSetFingerprint',
                    'catalogFingerprint',
                    'contractVersion',
                    'embeddingIndexContractEvidenceSetFingerprint',
                    'expectedRegistryFingerprint',
                    'expectedRegistryId',
                    'expectedRegistryUpdatedAt',
                    'guardFingerprint',
                    'idempotencyKey',
                    'operationSetFingerprint',
                    'preparedRouteOrderEvidenceSetFingerprint',
                    'previewFingerprint',
                    'requiredInputs',
                    'rerankRuntimeContractEvidenceSetFingerprint',
                    'submissionFingerprint',
                    'targetLocatorFingerprint',
                  ],
                  mismatchedFields: [],
                  mutationAvailable: false,
                  permissionCheckMode: variablesInput?.workspaceId
                    ? 'workspace_assert'
                    : 'not_checked',
                  permissionChecked: Boolean(variablesInput?.workspaceId),
                  permissionFingerprint: variablesInput?.workspaceId
                    ? '1111222233334444'
                    : '9999888877776666',
                  permissionScope: variablesInput?.workspaceId
                    ? 'workspace'
                    : 'global',
                  permissionStatus: variablesInput?.workspaceId
                    ? 'granted'
                    : 'workspace_not_selected',
                  policyBindingFingerprint: variablesInput?.workspaceId
                    ? '7373aaaabbbb8888'
                    : '6363aaaabbbb7777',
                  policyBindingInputs: [
                    'actorFingerprint',
                    'approvalPolicyFingerprint',
                    'auditBindingFingerprint',
                    'authorizationFingerprint',
                    'capabilityFingerprint',
                    'permissionFingerprint',
                  ],
                  policyBindingStatus: 'ready_for_review',
                  policyBindingVersion: 'repair-preflight-policy-binding/v1',
                  policySource: 'repair_action_preview_policy_snapshot',
                  readOnly: true,
                  requiredCapabilities: variablesInput?.workspaceId
                    ? [
                        'action_route.dry_run',
                        'action_route.read',
                        'model_registry.read',
                        'provider_health.probe',
                        'provider_profile.read',
                        'provider_route.preview',
                        'task_route.read',
                      ]
                    : [
                        'model_registry.read',
                        'provider_health.probe',
                        'provider_profile.read',
                        'provider_route.preview',
                        'task_route.read',
                      ],
                  requiredCapabilityCount: variablesInput?.workspaceId ? 7 : 5,
                  requiredPermission: 'Workspace.Copilot',
                  repairJobCreated: false,
                  repairJobFingerprint: variablesInput?.workspaceId
                    ? 'dfdf1111ecec2222'
                    : 'bcbc1111dede2222',
                  repairJobInputs: [
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
                  ],
                  repairJobStatus: 'not_created_read_only',
                  repairJobVersion: 'repair-preflight-job-contract/v1',
                  reviewBindingFingerprint: variablesInput?.workspaceId
                    ? 'eeee1111ffff2222'
                    : 'cccc1111dddd2222',
                  reviewBindingInputs: [
                    'candidateEvidenceSetFingerprint',
                    'taskRouteEffectiveSourceEvidenceSetFingerprint',
                    'capabilityFingerprint',
                    'embeddingIndexContractEvidenceSetFingerprint',
                    'permissionFingerprint',
                    'preparedRouteOrderEvidenceSetFingerprint',
                    'rerankRuntimeContractEvidenceSetFingerprint',
                    'submissionFingerprint',
                    'targetLocatorFingerprint',
                  ],
                  reviewBindingStatus: 'ready_for_review',
                  reviewBindingVersion: 'repair-preflight-review-binding/v1',
                  status: 'ready_for_review',
                  targetLocatorFingerprint:
                    submission?.targetLocatorFingerprint ?? '',
                  workspaceId: variablesInput?.workspaceId ?? null,
                },
              },
            },
          },
          isValidating: false,
          mutate: vi.fn(),
        };
      }

      if (query === getWorkspacesQuery) {
        return {
          data: {
            workspaces: workspaceScopePayload,
          },
          isValidating: false,
          mutate: vi.fn(),
        };
      }

      if (query === getCopilotActionRunPreparedRouteTraceQuery) {
        return {
          data: {
            currentUser: {
              copilot: {
                actionRunPreparedRouteTrace: actionRunPreparedRouteTracePayload,
              },
            },
          },
          isValidating: false,
          mutate: vi.fn(),
        };
      }

      if (query === getCopilotActionRunsQuery) {
        return {
          data: {
            currentUser: {
              copilot: {
                actionRuns: actionRunsPayload,
              },
            },
          },
          isValidating: false,
          mutate: vi.fn(),
        };
      }

      if (query === getCopilotSupportBundlesQuery) {
        return {
          data: {
            currentUser: {
              copilot: {
                supportBundles: supportBundlesPayload,
              },
            },
          },
          isValidating: false,
          mutate: mutateMock,
        };
      }

      if (query === getCopilotAgentRunsQuery) {
        return {
          data: {
            currentUser: {
              copilot: {
                agentRuntimeWorkflowAdapters:
                  agentRuntimeWorkflowAdaptersPayload,
                agentRuns: agentRunsPayload,
              },
            },
          },
          isValidating: false,
          mutate: mutateMock,
        };
      }

      if (query === getCopilotRepairExecutionsQuery) {
        return {
          data: {
            currentUser: {
              copilot: {
                repairExecutions: repairExecutionsPayload,
              },
            },
          },
          isValidating: false,
          mutate: vi.fn(),
        };
      }

      throw new Error('Unexpected query');
    });
  });

  afterEach(() => {
    cleanup();
  });

  test('renders complete AI configuration separately from runtime diagnostics', () => {
    renderAiPage('/admin/ai');

    expect(screen.getByText('Configuration')).not.toBeNull();
    expect(screen.getByText('Global Project BYOK')).not.toBeNull();
    expect(screen.getByText('Runtime')).not.toBeNull();
    expect(screen.getByText('AI capability switches')).not.toBeNull();
    expect(screen.getByText('Enterprise CLI governance')).not.toBeNull();
    expect(screen.getAllByText('Allowed tool names')).toHaveLength(3);
    expect(screen.getByText('Provider credentials')).not.toBeNull();
    expect(screen.getByText('Provider registry and routing')).not.toBeNull();
    expect(screen.getByText('Prompt and task models')).not.toBeNull();
    expect(
      screen.getByText('Search, assets, storage, and support bundles')
    ).not.toBeNull();
    expect(screen.getByText('Workspace BYOK')).not.toBeNull();
    expect(screen.getByText('BYOK private endpoints')).not.toBeNull();
    expect(screen.getByText('Workspace AI credentials')).not.toBeNull();
    expect(screen.getByText('BYOK allowed providers')).not.toBeNull();
    expect(screen.getByText('OpenAI')).not.toBeNull();
    expect(screen.getByText('OpenAI-compatible')).not.toBeNull();
    expect(screen.getByText('Gemini')).not.toBeNull();
    expect(screen.getByText('Anthropic')).not.toBeNull();
    expect(screen.getByText('Cloudflare Workers AI')).not.toBeNull();
    expect(screen.getByText('FAL')).not.toBeNull();
    expect(screen.getByText('Provider profiles JSON')).not.toBeNull();
    expect(screen.getByText('Provider defaults JSON')).not.toBeNull();
    expect(screen.getByText('Route policy JSON')).not.toBeNull();
    expect(screen.getByText('Gemini Vertex JSON')).not.toBeNull();
    expect(screen.getByText('Anthropic Vertex JSON')).not.toBeNull();
    expect(screen.getByText('Prompt defaults JSON')).not.toBeNull();
    expect(screen.getByText('Prompt overrides JSON')).not.toBeNull();
    expect(screen.getByText('Embedding model alias')).not.toBeNull();
    expect(screen.getByText('Workspace indexing model alias')).not.toBeNull();
    expect(screen.getByText('Rerank model alias')).not.toBeNull();
    expect(screen.getByText('Unsplash key')).not.toBeNull();
    expect(screen.getByText('Exa web search key')).not.toBeNull();
    expect(screen.getByText('Copilot storage JSON')).not.toBeNull();
    expect(
      screen.getByText('Support bundle object-storage webhooks JSON')
    ).not.toBeNull();
    expect(screen.queryByText('Model route diagnostics')).toBeNull();
    expect(screen.queryByText('Agent runtime runs')).toBeNull();
  });

  test('saves administrator-owned Enterprise CLI provider and tool policy', async () => {
    renderAiPage('/admin/ai');

    fireEvent.click(screen.getByLabelText('Enable Enterprise CLI'));
    const toolInputs = screen.getAllByPlaceholderText(
      'tool_name, another_tool'
    );
    fireEvent.change(toolInputs[1], {
      target: { value: 'lark_docs_search, lark_calendar_list' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

    await waitFor(() => {
      expect(updateAppConfigMock).toHaveBeenCalledWith({
        updates: expect.arrayContaining([
          {
            module: 'copilot',
            key: 'enterpriseCli.enabled',
            value: true,
          },
          {
            module: 'copilot',
            key: 'enterpriseCli.allowedProviders',
            value: ['WECOM', 'LARK', 'DINGTALK'],
          },
          {
            module: 'copilot',
            key: 'enterpriseCli.allowedToolsByProvider',
            value: {
              wecom: [],
              lark: ['lark_docs_search', 'lark_calendar_list'],
              dingtalk: [],
            },
          },
        ]),
      });
    });
  });

  test('saves private endpoint policy from Admin AI configuration', async () => {
    renderAiPage('/admin/ai');

    fireEvent.click(screen.getByLabelText('Allow BYOK private endpoint'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

    await waitFor(() => {
      expect(updateAppConfigMock).toHaveBeenCalledWith({
        updates: expect.arrayContaining([
          {
            module: 'copilot',
            key: 'byok.allowPrivateEndpoint',
            value: true,
          },
        ]),
      });
    });
  });

  test('queries prompt models for the admin diagnostics page', () => {
    renderAiPage();

    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: getCopilotPromptsQuery,
        variables: {
          workspaceId: undefined,
        },
      })
    );
    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: getPromptModelsQuery,
        variables: {
          promptName: 'Chat With LocalMind AI',
          workspaceId: undefined,
        },
      })
    );
    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: getWorkspacesQuery,
      })
    );
    expect(screen.getByText('Model route diagnostics')).not.toBeNull();
    expect(screen.getByText('Active prompt')).not.toBeNull();
    expect(screen.getByText('Workspace scope')).not.toBeNull();
    expect(screen.getAllByText('Global').length).toBeGreaterThan(0);
    expect(screen.getByText('Workspace selector')).not.toBeNull();
    expect(screen.getByText('Workspace options: 2')).not.toBeNull();
    expect(screen.getByText('Support bundles')).not.toBeNull();
    expect(
      screen.getByText(
        'Select a workspace scope before creating or viewing support bundles.'
      )
    ).not.toBeNull();
    expect(screen.getByText('Agent runtime runs')).not.toBeNull();
    expect(screen.getByText('Repair executions')).not.toBeNull();
    expect(
      screen.getByText(
        'Select a workspace scope before viewing repair executions.'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Select a workspace scope before viewing Agent Runtime runs.'
      )
    ).not.toBeNull();
    expect(
      (
        screen.getByRole('button', {
          name: 'Create bundle',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: 'Cleanup retention',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(screen.getByText('Action run route trace')).not.toBeNull();
    expect(
      screen.getByText(
        'Select a workspace scope before inspecting an action run.'
      )
    ).not.toBeNull();
    expect(
      (
        screen.getByRole('button', {
          name: 'Inspect run',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(hasQueryCall(getCopilotActionRunPreparedRouteTraceQuery)).toBe(
      false
    );
    expect(hasQueryCall(getCopilotActionRunsQuery)).toBe(false);
    expect(hasQueryCall(getCopilotSupportBundlesQuery)).toBe(false);
    expect(hasQueryCall(getCopilotAgentRunsQuery)).toBe(false);
    expect(hasQueryCall(getCopilotRepairExecutionsQuery)).toBe(false);
    expect(hasQueryCall(getCopilotProviderHealthProbeAttemptsQuery)).toBe(
      false
    );
    expect(hasQueryCall(getCopilotPromptRegistryPublishGateQuery)).toBe(false);
    expect(
      (screen.getByLabelText('Prompt name') as HTMLInputElement).value
    ).toBe('LocalMind AI');
    expect(screen.getByText('Catalog category')).not.toBeNull();
    expect(screen.getByText('Catalog source')).not.toBeNull();
    expect(screen.getByText('Override')).not.toBeNull();
    expect(screen.getAllByText('Built In').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Source Override').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Config copilot.prompts.overrides[].model')
    ).not.toBeNull();
    expect(
      screen.getAllByText('Config copilot.prompts.overrides[].optionalModels')
        .length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText('Config copilot.prompts.overrides[].config.proModels')
    ).not.toBeNull();
    expect(screen.getByText('GPT 4o mini')).not.toBeNull();
    expect(
      screen.getByText('OpenAI (openai-main) / Configured / Cloud / Healthy')
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Profile openai-main / Configured / config copilot.providers.profiles[id=openai-main] / 2 configured models / models gpt-4o-mini, fast-chat'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Provider profile / Definition gpt-4o-mini / Raw gpt-4o-mini-2026-06-01 / Aliases fast-chat / Registry model-registry-openai-gpt-1 / Revision workspace-openai-gpt-r1 / Scope workspace / Status active / Fingerprint modelregistry33334444 / Source chain modelchain33334444 / Workspace workspace-1 / Publish events 1 / openai / Canonical gpt-4o-mini / Protocol openai / Layer chat'
      )
    ).not.toBeNull();
    expect(screen.getByText('Model source Override')).not.toBeNull();
    expect(
      screen.getByText(
        'Source chain Fallback Route -> Prompt Prompt override config copilot.prompts.overrides[].optionalModels -> Registry'
      )
    ).not.toBeNull();
    expect(
      screen.getAllByText('Config copilot.prompts.overrides[].optionalModels')
        .length
    ).toBeGreaterThan(0);
  });

  test('updates diagnostics query when prompt and workspace scope are submitted', () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Prompt name'), {
      target: {
        value: 'Make it real',
      },
    });
    fireEvent.change(screen.getByLabelText('Workspace ID'), {
      target: {
        value: 'workspace-1',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));

    expectQueryCall(getPromptModelsQuery, {
      promptName: 'Make it real',
      workspaceId: 'workspace-1',
    });
  });

  test('renders and creates DB-backed support bundles for a workspace scope', async () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Workspace ID'), {
      target: {
        value: 'workspace-1',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));

    await waitFor(() => {
      expectQueryCall(getCopilotSupportBundlesQuery, {
        limit: 8,
        workspaceId: 'workspace-1',
      });
    });
    expectQueryCall(getCopilotProviderHealthProbeAttemptsQuery, {
      limit: 5,
      workspaceId: 'workspace-1',
    });
    const providerHealthProbeAttempts = screen.getByTestId(
      'provider-health-probe-attempts'
    );
    expect(providerHealthProbeAttempts.textContent).toContain(
      'probe Completed / provider localmind-db-provider / type OpenAI-compatible / revision provider-registry-admin-1 / revision fingerprint providerregistry1111'
    );
    expect(providerHealthProbeAttempts.textContent).toContain(
      'profile source DB revision / profile fingerprint providerprofile1111 / profile models 1 / request probeattempt1111 / actor user-1 / attempts 1/3'
    );
    expect(providerHealthProbeAttempts.textContent).toContain(
      'result Healthy / result fingerprint proberesult1111 / state provider-health-state-admin-1 / state fingerprint providerhealth1111'
    );
    expect(providerHealthProbeAttempts.textContent).toContain(
      'probe Dead Lettered / provider localmind-db-provider / type OpenAI-compatible / revision provider-registry-admin-1'
    );
    expect(providerHealthProbeAttempts.textContent).toContain(
      'failure Provider Profile Unavailable / message Provider profile unavailable'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retryProviderHealthProbeAttemptMock).toHaveBeenCalledWith({
      input: {
        attemptId: 'provider-health-probe-dead-admin-1',
        workspaceId: 'workspace-1',
      },
    });
    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Provider health probe status' }),
      {
        key: 'ArrowDown',
      }
    );
    fireEvent.click(screen.getByRole('option', { name: 'Dead Lettered' }));
    fireEvent.change(screen.getByLabelText('Provider health probe filter'), {
      target: {
        value: 'probeattemptdead1111',
      },
    });
    expectQueryCall(getCopilotProviderHealthProbeAttemptsQuery, {
      filter: {
        query: 'probeattemptdead1111',
        status: 'dead_lettered',
      },
      limit: 5,
      workspaceId: 'workspace-1',
    });
    expect(screen.getByText('Support bundles')).not.toBeNull();
    expect(screen.getByText('support-bundle-1')).not.toBeNull();
    const bundleManifest = screen.getByTestId(
      'support-bundle-manifest-support-bundle-1'
    );
    expect(bundleManifest.textContent).toContain(
      'manifest manifest111122223333 / archive archive111122223333 / source source111122223333 / retention Active / audit events 2 / transfer events 1 / transfer forwarding events 1'
    );
    expect(bundleManifest.textContent).toContain(
      'copilot-support-bundle-manifest/v1 / sections prompt_catalog_count, actor_action_run_count, task_route_summary / prompts 4 / action runs 3 / task routes 2 / archive bytes 512 / storage support-bundles/support-bundle-1/archive.json'
    );
    const auditEvents = screen.getByTestId(
      'support-bundle-audit-events-support-bundle-1'
    );
    expect(auditEvents.textContent).toContain(
      'audit Archive Created / fingerprint auditarchive1111 / actor user-1'
    );
    expect(auditEvents.textContent).toContain(
      'audit Created / fingerprint auditcreated1111 / actor user-1'
    );
    const transferEvents = screen.getByTestId(
      'support-bundle-transfer-events-support-bundle-1'
    );
    expect(transferEvents.textContent).toContain(
      'transfer Object Storage Signed Url / source object_storage_event_admin / event support-bundle-transfer-ok-admin / fingerprint transfer111122223333 / authorization download-auth-1'
    );
    expect(transferEvents.textContent).toContain(
      'artifact Archive Json:archive111122223333 / manifest manifest111122223333 / notification auth auth-evidence11112222 / storage support-bundles/support-bundle-1/archive.json / content application/json / bytes 512'
    );
    const transferForwardingEvents = screen.getByTestId(
      'support-bundle-transfer-forwarding-events-support-bundle-1'
    );
    expect(transferForwardingEvents.textContent).toContain(
      'forwarding Dead Lettered / source object_storage_event_admin / event support-bundle-forwarding-dead-letter-admin / fingerprint forwarding111122223333 / payload payload111122223333 / authorization download-auth-1 / signature signature11112222'
    );
    expect(transferForwardingEvents.textContent).toContain('attempts 3/3');
    expect(transferForwardingEvents.textContent).toContain(
      'failure Support Bundle Transfer Event Storage Key Mismatch'
    );
    fireEvent.keyDown(
      screen.getByRole('combobox', {
        name: 'Support bundle forwarding status',
      }),
      {
        key: 'ArrowDown',
      }
    );
    fireEvent.click(screen.getByRole('option', { name: 'Dead Lettered' }));
    fireEvent.change(
      screen.getByLabelText('Support bundle forwarding filter'),
      {
        target: {
          value: 'forwarding111122223333',
        },
      }
    );
    expectQueryCall(getCopilotSupportBundlesQuery, {
      filter: {
        query: 'forwarding111122223333',
        transferForwardingStatus: 'dead_lettered',
      },
      limit: 8,
      workspaceId: 'workspace-1',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
    await waitFor(() => {
      expect(
        replaySupportBundleTransferForwardingEventMock
      ).toHaveBeenCalledWith({
        input: {
          forwardingEventId: 'transfer-forwarding-event-1',
          workspaceId: 'workspace-1',
        },
      });
    });
    expect(
      screen.getByText('Latest transfer forwarding replay')
    ).not.toBeNull();
    expect(screen.getAllByText(/forwarding Queued/)[0].textContent).toContain(
      'forwarding Queued / source object_storage_event_admin / event support-bundle-forwarding-dead-letter-admin / fingerprint forwardingreplay1111 / payload payloadreplay1111 / replay source transfer-forwarding-event-1'
    );
    expect(
      screen.getByTestId(
        'support-bundle-transfer-forwarding-events-support-bundle-1'
      ).textContent
    ).toContain(
      'forwarding Queued / source object_storage_event_admin / event support-bundle-forwarding-dead-letter-admin / fingerprint forwardingreplay1111 / payload payloadreplay1111 / replay source transfer-forwarding-event-1'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download archive' }));

    await waitFor(() => {
      expect(authorizeSupportBundleDownloadMock).toHaveBeenCalledWith({
        input: {
          bundleId: 'support-bundle-1',
          artifactKind: 'archive_json',
          workspaceId: 'workspace-1',
        },
      });
    });
    await waitFor(() => {
      expect(windowOpenMock).toHaveBeenCalledWith(
        'http://localhost/api/copilot/support-bundles/download-auth-1/artifact?token=download-token-1',
        '_blank',
        'noopener,noreferrer'
      );
    });
    expect(
      screen.getByText('Latest artifact download authorization')
    ).not.toBeNull();
    expect(
      screen
        .getAllByText(/download-auth-1/)
        .some(element =>
          element.textContent?.includes(
            'download-auth-1 / status Authorized / artifact localmind-support-bundle-support-bundle-1.archive.json / artifact fingerprint archive111122223333 / manifest manifest111122223333 / authorization download-auth-11112222 / delivery Api Proxy / direct object-storage URL no'
          )
        )
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Cleanup retention' }));

    await waitFor(() => {
      expect(cleanupSupportBundleRetentionMock).toHaveBeenCalledWith({
        input: {
          limit: 50,
          workspaceId: 'workspace-1',
        },
      });
    });
    expect(screen.getByText('Latest retention cleanup')).not.toBeNull();
    expect(screen.getByText(/cleanup111122223333/).textContent).toContain(
      'cleanup111122223333 / bundles 1 / authorizations 1 / archive retries 1 / archive recovered 1 / archive failed 0'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create bundle' }));

    await waitFor(() => {
      expect(createSupportBundleMock).toHaveBeenCalledWith({
        input: {
          workspaceId: 'workspace-1',
        },
      });
    });
    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalled();
    });
    expect(screen.getByText('Latest created bundle')).not.toBeNull();
    expect(
      screen.getByTestId('support-bundle-manifest-support-bundle-created')
    ).not.toBeNull();
  });

  test('renders persisted Agent Runtime runs for a workspace scope', async () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Workspace ID'), {
      target: {
        value: 'workspace-1',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));

    await waitFor(() => {
      expectQueryCall(getCopilotAgentRunsQuery, {
        limit: 8,
        workspaceId: 'workspace-1',
      });
    });
    expectQueryCall(getCopilotRepairExecutionsQuery, {
      limit: 8,
      workspaceId: 'workspace-1',
    });
    expect(screen.getByText('Repair executions')).not.toBeNull();
    expect(screen.getByText('repair-execution-1')).not.toBeNull();
    expect(screen.getByText('repair-execution-completed')).not.toBeNull();
    expect(
      screen.getByTestId('repair-execution-runtime-repair-execution-1')
        .textContent
    ).toContain('agent run agent-run-1:Queued');
    expect(
      screen.getByTestId('repair-execution-ledger-repair-execution-completed')
        .textContent
    ).toContain(
      'side effect history Prompt Registry Revision:prompt-revision-repair-execution-completed:attempt 1:sideeffect1111'
    );
    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Repair execution status' }),
      {
        key: 'ArrowDown',
      }
    );
    fireEvent.click(screen.getByRole('option', { name: 'Completed' }));
    fireEvent.change(screen.getByLabelText('Repair execution filter'), {
      target: {
        value: 'sideeffect1111',
      },
    });
    expectQueryCall(getCopilotRepairExecutionsQuery, {
      filter: {
        query: 'sideeffect1111',
        status: 'completed',
      },
      limit: 8,
      workspaceId: 'workspace-1',
    });
    expect(screen.getByText('Agent runtime runs')).not.toBeNull();
    expect(
      screen.getByTestId('agent-runtime-adapter-agent_runtime_record_only')
        .textContent
    ).toContain('agent_runtime_record_only');
    expect(
      screen.getByTestId('agent-runtime-adapter-agent_runtime_record_only')
        .textContent
    ).toContain('steps Approval, Codex, Handoff, Mcp, Model, Tool');
    expect(
      screen.getByTestId('agent-runtime-adapter-agent_runtime_record_only')
        .textContent
    ).toContain('side effects None');
    expect(screen.getByText('Repair execution: Make it real')).not.toBeNull();
    expect(screen.getByText('agent-run-1')).not.toBeNull();
    expect(screen.getAllByText('Queued').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/workflow prompt_registry_repair_execution/)
    ).not.toBeNull();
    expect(
      screen.getByText(/source repair_execution_request:repair-execution-1/)
    ).not.toBeNull();
    expect(
      screen.getByTestId('agent-runtime-steps-agent-run-1').textContent
    ).toContain('repair_execution:Model:Pending');
    expect(
      screen.getByTestId('agent-runtime-timeline-agent-run-1').textContent
    ).toContain(
      '#0:Run Status:Waiting Approval:Repair execution run waiting_approval'
    );
    expect(
      screen.getByTestId('agent-runtime-timeline-agent-run-1').textContent
    ).toContain('#2:Run Status:Queued:Repair execution run queued');
    expect(
      screen.getByTestId('agent-runtime-timeline-agent-run-1').textContent
    ).toContain('#3:Model Step:Pending:Repair execution queued for worker');
    expect(screen.getByText('Standalone runtime run')).not.toBeNull();
    expect(screen.getByText('Use repair execution controls')).not.toBeNull();
    expect(
      screen.getByTestId('agent-runtime-steps-agent-run-standalone').textContent
    ).toContain('tool_lookup:Tool:Running');
    expect(screen.getByText('Completed runtime run')).not.toBeNull();
    expect(
      screen.getByTestId('agent-runtime-results-agent-run-completed')
        .textContent
    ).toContain('Execution results 1');
    expect(
      screen.getByTestId('agent-runtime-results-agent-run-completed')
        .textContent
    ).toContain('fingerprint agentresult1111');
    expect(
      screen.getByTestId('agent-runtime-results-agent-run-completed')
        .textContent
    ).toContain('attempt 1');
    expect(
      screen.getByTestId('agent-runtime-results-agent-run-completed')
        .textContent
    ).toContain('side effects none');
    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Agent Runtime run status' }),
      {
        key: 'ArrowDown',
      }
    );
    fireEvent.click(screen.getByRole('option', { name: 'Completed' }));
    fireEvent.change(screen.getByLabelText('Agent Runtime run filter'), {
      target: {
        value: 'agentresult1111',
      },
    });
    expectQueryCall(getCopilotAgentRunsQuery, {
      filter: {
        query: 'agentresult1111',
        status: 'completed',
      },
      limit: 8,
      workspaceId: 'workspace-1',
    });
  });

  test('controls standalone Agent Runtime runs from the persisted run list', async () => {
    const standaloneRun = agentRunsPayload[1]!;
    controlAgentRuntimeRunMock.mockResolvedValue({
      controlCopilotAgentRuntimeRun: {
        ...standaloneRun,
        completedAt: '2026-06-20T09:12:00.000Z',
        status: 'cancelled',
        timelineFingerprint: 'agent-timeline-cancelled',
        updatedAt: '2026-06-20T09:12:00.000Z',
        steps: standaloneRun.steps.map(step => ({
          ...step,
          completedAt: '2026-06-20T09:12:00.000Z',
          status: 'skipped',
          outputSummary: {
            ...step.outputSummary,
            manualControl: {
              action: 'cancel',
              reason: null,
              version: 'agent-runtime-manual-control/v1',
            },
          },
        })),
        timelineEvents: [
          ...standaloneRun.timelineEvents,
          {
            actorId: 'user-1',
            createdAt: '2026-06-20T09:12:00.000Z',
            eventFingerprint: 'agent-event-standalone-cancelled',
            eventType: 'run_cancellation',
            id: 'agent-event-standalone-cancelled',
            ordinal: 2,
            payload: {
              action: 'cancel',
              previousStatus: 'running',
              sourceId: 'standalone-run-1',
              sourceType: 'agent_runtime_manual',
              version: 'agent-runtime-manual-control/v1',
              workflow: 'office_task_runtime',
            },
            runId: 'agent-run-standalone',
            status: 'cancelled',
            stepId: null,
            summary: 'Agent runtime run manually cancelled',
            workspaceId: 'workspace-1',
          },
        ],
      },
    });
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Workspace ID'), {
      target: {
        value: 'workspace-1',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));

    await waitFor(() => {
      expect(screen.getByText('Standalone runtime run')).not.toBeNull();
    });
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    const enabledCancelButton = cancelButtons.find(
      button => !(button as HTMLButtonElement).disabled
    ) as HTMLButtonElement | undefined;
    expect(enabledCancelButton).not.toBeUndefined();
    fireEvent.click(enabledCancelButton!);

    await waitFor(() => {
      expect(controlAgentRuntimeRunMock).toHaveBeenCalledWith({
        input: {
          action: 'cancel',
          runId: 'agent-run-standalone',
          workspaceId: 'workspace-1',
        },
      });
    });
    await waitFor(() => {
      expect(
        screen.getByTestId('agent-runtime-steps-agent-run-standalone')
          .textContent
      ).toContain('tool_lookup:Tool:Skipped');
    });
    expect(
      screen.getByTestId('agent-runtime-timeline-agent-run-standalone')
        .textContent
    ).toContain(
      '#2:Run Cancellation:Cancelled:Agent runtime run manually cancelled'
    );
    expect(screen.getByText('Latest control Cancelled')).not.toBeNull();
    expect(mutateMock).toHaveBeenCalled();
  });

  test('checks prompt registry repair execution request gate on demand', async () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Prompt name'), {
      target: {
        value: 'Make it real',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));

    expect(useMutationMock).toHaveBeenCalledWith({
      mutation: requestCopilotPromptRegistryRepairExecutionMutation,
    });
    expect(requestRepairExecutionMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Check request gate' }));

    await waitFor(() => {
      expect(requestRepairExecutionMock).toHaveBeenCalledWith({
        input: expect.objectContaining({
          expectedApprovalRecordFingerprint: '8585aaaabbbb0000',
          expectedApprovalRequestFingerprint: '7474aaaabbbb9999',
          expectedAuditEventFingerprint: '9696aaaabbbb1111',
          expectedCandidateEvidenceSetFingerprint: 'aaaa5555bbbb6666',
          expectedTaskRouteEffectiveSourceEvidenceSetFingerprint:
            'aaaa5656bbbb6767',
          expectedEmbeddingIndexContractEvidenceSetFingerprint:
            'aaaa6666bbbb7777',
          expectedRerankRuntimeContractEvidenceSetFingerprint:
            'aaaa8888bbbb9999',
          expectedPreparedRouteOrderEvidenceSetFingerprint: 'aaaa7777bbbb8888',
          expectedTargetLocatorFingerprint: 'ddd111eee222ffff',
          expectedRepairGateManifestFingerprint:
            readyPublishGateVerdict.repairGateManifest.fingerprint,
          expectedRepairGateManifestExportPolicyFingerprint:
            readyPublishGateVerdict.repairGateManifestExportMetadata
              .exportPolicyFingerprint,
          expectedRepairGateManifestRetentionPolicyFingerprint:
            readyPublishGateVerdict.repairGateManifestExportMetadata
              .retentionPolicyFingerprint,
          expectedExecutionGateFingerprint: '5858aaaabbbb9999',
          expectedExecutionGateStatus: 'blocked_read_only',
          expectedExecutionStateFingerprint: 'b7b7aaaabbbb2222',
          expectedIdempotencyFingerprint: 'efef1111abab2222',
          expectedPolicyBindingFingerprint: '6363aaaabbbb7777',
          expectedPreflightStatus: 'ready_for_review',
          expectedRepairJobFingerprint: 'bcbc1111dede2222',
          expectedReviewBindingFingerprint: 'cccc1111dddd2222',
          expectedRollbackPlanFingerprint: 'c8c8aaaabbbb3333',
          expectedVersion: {
            registryFingerprint: 'b1c2d3e4f5061728',
            registryId: 42,
            registryUpdatedAt: '2026-06-17T04:05:06.000Z',
          },
          name: 'Make it real',
          submission: expect.objectContaining({
            approvalPolicyFingerprint: 'aaaa3333bbbb4444',
            authorizationFingerprint: 'aaaa2222bbbb3333',
            candidateEvidenceSetFingerprint: 'aaaa5555bbbb6666',
            taskRouteEffectiveSourceEvidenceSetFingerprint: 'aaaa5656bbbb6767',
            embeddingIndexContractEvidenceSetFingerprint: 'aaaa6666bbbb7777',
            rerankRuntimeContractEvidenceSetFingerprint: 'aaaa8888bbbb9999',
            preparedRouteOrderEvidenceSetFingerprint: 'aaaa7777bbbb8888',
            catalogFingerprint: 'aaaabbbbccccdddd',
            contractVersion: 'repair-preview-submission/v1',
            expectedRegistryFingerprint: 'b1c2d3e4f5061728',
            expectedRegistryId: 42,
            expectedRegistryUpdatedAt: '2026-06-17T04:05:06.000Z',
            guardFingerprint: '1111aaaabbbbcccc',
            idempotencyKey:
              '42:b1c2d3e4f5061728:9999aaaabbbbcccc:abcd1111efef2222',
            operationSetFingerprint: 'abcd1111efef2222',
            previewFingerprint: '9999aaaabbbbcccc',
            requiredInputs: [
              'approvalPolicyFingerprint',
              'authorizationFingerprint',
              'candidateEvidenceSetFingerprint',
              'embeddingIndexContractEvidenceSetFingerprint',
              'expectedRegistryFingerprint',
              'expectedRegistryId',
              'expectedRegistryUpdatedAt',
              'guardFingerprint',
              'operationSetFingerprint',
              'preparedRouteOrderEvidenceSetFingerprint',
              'previewFingerprint',
              'rerankRuntimeContractEvidenceSetFingerprint',
              'targetLocatorFingerprint',
              'taskRouteEffectiveSourceEvidenceSetFingerprint',
            ],
            submissionFingerprint: 'aaaa4444bbbb5555',
            targetLocatorFingerprint: 'ddd111eee222ffff',
          }),
          workspaceId: '',
        }),
      });
    });

    await waitFor(() => {
      expect(
        screen.getAllByText(/Repair execution request version/).length
      ).toBeGreaterThan(0);
    });
    const globalRepairExecutionRequest = screen
      .getAllByText(/Repair execution request version/)
      .at(-1)!;
    expect(globalRepairExecutionRequest.textContent).toContain(
      'version repair-execution-request/v1 / status Blocked Read Only'
    );
    expect(globalRepairExecutionRequest.textContent).toContain(
      'accepted no / execution requested no / execution record none'
    );
    expect(globalRepairExecutionRequest.textContent).toContain(
      'expected candidate evidence set fingerprint aaaa5555bbbb6666'
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `expected repair gate manifest fingerprint ${readyPublishGateVerdict.repairGateManifest.fingerprint} / expected repair gate manifest export policy fingerprint ${readyPublishGateVerdict.repairGateManifestExportMetadata.exportPolicyFingerprint} / expected repair gate manifest retention policy fingerprint ${readyPublishGateVerdict.repairGateManifestExportMetadata.retentionPolicyFingerprint}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      'support bundle task route source evidence set fingerprint aaaa5656bbbb6767 / support bundle task route source evidence set version copilot-task-route-effective-source-evidence-set/v1'
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain('execution record none');

    fireEvent.change(screen.getByLabelText('Workspace ID'), {
      target: {
        value: 'workspace-1',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check request gate' }));

    await waitFor(() => {
      expect(
        screen.getAllByText(
          /execution record repair-execution-1 \/ status Waiting Approval .* side effects no/
        ).length
      ).toBeGreaterThan(0);
    });
    const waitingRepairExecutionRequest = screen
      .getAllByText(
        /execution record repair-execution-1 \/ status Waiting Approval .* side effects no/
      )
      .at(-1)!;
    expect(waitingRepairExecutionRequest.textContent).toContain(
      'execution record repair-execution-1 / status Waiting Approval'
    );
    expect(waitingRepairExecutionRequest.textContent).toContain(
      '/ approval Waiting'
    );
    expect(waitingRepairExecutionRequest.textContent).toContain(
      '/ audit events 2'
    );
    expect(waitingRepairExecutionRequest.textContent).toContain(
      'audit history Waiting Approval:audit-waiting-approval-0 | Requested:audit-requested-1'
    );
    expect(waitingRepairExecutionRequest.textContent).toContain(
      'side effect ledger 0'
    );
    expect(waitingRepairExecutionRequest.textContent).toContain(
      'agent run agent-run-1'
    );
    expect(waitingRepairExecutionRequest.textContent).toContain(
      'agent run status Waiting Approval'
    );
    expect(waitingRepairExecutionRequest.textContent).toContain(
      'agent run workflow prompt_registry_repair_execution'
    );
    expect(waitingRepairExecutionRequest.textContent).toContain(
      'agent run steps repair_execution:Approval:Waiting Approval'
    );
    expect(waitingRepairExecutionRequest.textContent).toContain(
      'agent run timeline events #0:Run Status:Waiting Approval:Repair execution run waiting_approval | #1:Approval Step:Waiting Approval:Repair execution waiting for approval'
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      'support bundle task route source evidence set operations 1111aaaa2222bbbb, 2222bbbb3333cccc, 3333cccc4444dddd, 4444dddd5555eeee / support bundle task route source evidence set diagnostics 1111222233334444, 2222333344445555, 3333444455556666, 4444555566667777'
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      'support bundle task route source evidence set entries 1111aaaa2222bbbb:1111222233334444:sources:none:candidateEvidence:0:'
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      'candidateEvidenceEntries:candidateEvidenceEntries:none:candidateEvidenceCategories:0:candidateEvidenceCategories:none:candidateEvidenceProviderIds:none:candidateEvidenceScopes:none'
    );
    expect(
      screen.getByRole('button', { name: 'Approve execution' })
    ).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Reject execution' })
    ).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Approve execution' }));

    await waitFor(() => {
      expect(decideRepairExecutionApprovalMock).toHaveBeenCalledWith({
        input: {
          workspaceId: 'workspace-1',
          executionRequestId: 'repair-execution-1',
          decision: 'approve',
        },
      });
    });
    await waitFor(() => {
      expect(
        screen.getAllByText(/Repair execution approval decision/).length
      ).toBeGreaterThan(0);
    });
    expect(
      screen.getAllByText(/Repair execution approval decision/).at(-1)!
        .textContent
    ).toContain(
      'repair-execution-1 / status Queued / approval Approved / idempotency repair-idempotency-key-1 / audit events 4'
    );
    expect(
      screen.getAllByText(/Repair execution approval decision/).at(-1)!
        .textContent
    ).toContain(
      'executor queued_repair_execution_worker / side effects no / side effect ledger 0'
    );
    expect(
      screen.getAllByText(/Repair execution approval decision/).at(-1)!
        .textContent
    ).toContain('queued 2026-06-20T09:05:00.000Z / worker attempt 0/3');
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain('execution record repair-execution-1 / status Queued');
    const taskRouteSourceEntry =
      readyPublishGateVerdict.repairActionPreview.operations.find(
        operation => operation.taskRouteEffectiveSourceFingerprints.length
      );
    expect(taskRouteSourceEntry).toBeTruthy();
    const taskRouteSourceEntryClassification =
      candidateEvidenceClassificationSummaryFixture(
        [...(taskRouteSourceEntry?.candidateEvidenceKeys ?? [])].sort()
      );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `${taskRouteSourceEntry?.operationFingerprint}:${taskRouteSourceEntry?.diagnosticsFingerprint}:${taskRouteSourceEntry?.taskRouteEffectiveSourceFingerprints.join('|')}:candidateEvidence:${taskRouteSourceEntry?.candidateEvidenceCount}:${taskRouteSourceEntry?.candidateEvidenceFingerprint}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchema:${candidateEvidenceReferenceSchemaVersionFixture}:${candidateEvidenceReferenceSchemaFieldsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactFingerprint:${candidateEvidenceReferenceSchemaArtifactFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordPersistenceFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordPersistenceFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordPersistenceFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordPersistenceStatus:${candidateEvidenceReferenceSchemaArtifactRecordPersistenceStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageBackendFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageBackendFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageBackendFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageBackendStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageBackendStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveInclusionStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveInclusionStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageBackendStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveInclusionStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceRecordStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryPersistenceStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectArchiveManifestEntryStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageObjectStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStorageStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceRecordStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectArchiveManifestEntryPersistenceStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectFingerprint:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectFingerprintInputs:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageObjectStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageObjectStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStorageStatus:${candidateEvidenceReferenceSchemaArtifactRecordStorageStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactRecordStatus:${candidateEvidenceReferenceSchemaArtifactRecordStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaArtifactStatus:${candidateEvidenceReferenceSchemaArtifactStatusFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaFingerprint:${candidateEvidenceReferenceSchemaFingerprintFixture}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaFingerprintInputs:${candidateEvidenceReferenceSchemaFingerprintInputsFixture.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `referenceSchemaRegistryStatus:${candidateEvidenceReferenceSchemaRegistryStatusFixture}`
    );
    const taskRouteSourceCandidateEntry =
      taskRouteSourceEntry?.candidateEvidenceEntries[0];
    expect(taskRouteSourceCandidateEntry).toBeTruthy();
    const taskRouteSourceCandidateModelSourceEntries =
      taskRouteSourceCandidateEntry?.taskRouteModelSourceSnapshotEntries
        ?.map(
          entry =>
            `${entry.featureKind}:${entry.requestedModelConfigKey ?? 'configKey:none'}:${entry.requestedModelConfigPath ?? 'configPath:none'}:${entry.requestedModelId ?? 'requestedModel:none'}:${entry.requestedModelSource ?? 'requestedSource:none'}`
        )
        .join('^') ?? 'modelSourceEntries:none';
    const taskRouteSourceCandidatePolicyEntries =
      taskRouteSourceCandidateEntry?.policyCandidateEntries
        ?.map(
          entry =>
            `${entry.providerId}:allowed:${entry.allowed}:available:${entry.available}:health:${entry.health}:privacy:${entry.privacy}:registry:${entry.registryKind ?? 'registry:none'}:profile:${entry.providerProfileId ?? 'profile:none'}:reasons:${
              entry.reasons.length ? entry.reasons.join('^') : 'reasons:none'
            }`
        )
        .join('~') ?? 'policyCandidateEntries:none';
    const taskRouteSourceCandidatePreparedRouteEntries =
      taskRouteSourceCandidateEntry?.preparedRouteEntries
        ?.map(
          entry =>
            `${entry.providerId}:model:${entry.modelId}:route:${entry.routeIndex}:fallback:${entry.fallbackOrderIndex ?? 'fallback:none'}:profile:${entry.providerProfileId ?? 'profile:none'}:configuredModels:${
              entry.providerConfiguredModelIds?.length
                ? entry.providerConfiguredModelIds.join('^')
                : 'configuredModels:none'
            }:backend:${entry.modelBackendKind ?? 'backend:none'}:requestLayer:${entry.requestLayer ?? 'requestLayer:none'}`
        )
        .join('~') || 'preparedRouteEntries:none';
    const taskRouteSourceCandidatePrepareEntries =
      taskRouteSourceCandidateEntry?.prepareCandidateEntries
        ?.map(
          entry =>
            `${entry.providerId}:prepared:${entry.prepared}:model:${entry.modelId ?? 'model:none'}:preparedModel:${entry.preparedModelId ?? 'preparedModel:none'}:requested:${entry.requestedModelId ?? 'requested:none'}:registry:${entry.registryKind ?? 'registry:none'}:definition:${entry.routeModelDefinitionId ?? 'definition:none'}:raw:${entry.routeRawModelId ?? 'raw:none'}:error:${entry.errorCode ?? 'error:none'}:reasons:${
              entry.reasons.length ? entry.reasons.join('^') : 'reasons:none'
            }`
        )
        .join('~') ?? 'prepareCandidateEntries:none';
    const taskRouteSourceCandidateRouteEntries =
      taskRouteSourceCandidateEntry?.routeCandidateEntries
        ?.map(
          entry =>
            `${entry.providerId}:matched:${entry.matched}:model:${entry.modelId ?? 'model:none'}:requested:${entry.requestedModelId ?? 'requested:none'}:registry:${entry.registryKind ?? 'registry:none'}:definition:${entry.routeModelDefinitionId ?? 'definition:none'}:raw:${entry.routeRawModelId ?? 'raw:none'}:reasons:${
              entry.reasons.length ? entry.reasons.join('^') : 'reasons:none'
            }`
        )
        .join('~') ?? 'routeCandidateEntries:none';
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `candidateEvidenceEntries:${taskRouteSourceCandidateEntry?.candidateEvidenceScope}#${taskRouteSourceCandidateEntry?.candidateIndex}:${taskRouteSourceCandidateEntry?.candidateEvidenceCategory}:${taskRouteSourceCandidateEntry?.candidateEvidenceProviderId}:${taskRouteSourceCandidateEntry?.candidateEvidenceKey}:${taskRouteSourceCandidateEntry?.candidateEvidenceFingerprint}:${taskRouteSourceCandidateEntry?.preparedRouteOrderFingerprint ?? 'prepared:none'}:preparedRouteEntries:${taskRouteSourceCandidatePreparedRouteEntries}:policyCandidateEntries:${taskRouteSourceCandidatePolicyEntries}:prepareCandidateEntries:${taskRouteSourceCandidatePrepareEntries}:routeCandidateEntries:${taskRouteSourceCandidateRouteEntries}:${taskRouteSourceCandidateEntry?.taskRouteEffectiveSourceFingerprint ?? 'source:none'}:${taskRouteSourceCandidateEntry?.taskRouteModelSourceSnapshotFingerprint ?? 'modelSource:none'}:modelSourceEntries:${taskRouteSourceCandidateModelSourceEntries}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      `candidateEvidenceCategories:${taskRouteSourceEntryClassification.candidateEvidenceCategoryCount}:${taskRouteSourceEntryClassification.candidateEvidenceCategories.join('|')}:${taskRouteSourceEntryClassification.candidateEvidenceProviderIds.join('|')}:${taskRouteSourceEntryClassification.candidateEvidenceScopes.join('|')}`
    );
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain('support bundle task route source evidence set sources ');
    expect(
      screen.getByTestId('prompt-registry-publish-gate-Make it real')
        .textContent
    ).toContain(
      'support bundle task route source evidence set inputs diagnosticsFingerprint, operationFingerprint, taskRouteEffectiveSourceFingerprints'
    );
    const workspaceRepairExecutionRequest = screen
      .getAllByText(
        /execution record repair-execution-1 \/ status Queued .* side effects no/
      )
      .at(-1)!;
    expect(workspaceRepairExecutionRequest.textContent).toContain(
      'execution record repair-execution-1 / status Queued'
    );
    expect(workspaceRepairExecutionRequest.textContent).toContain(
      '/ approval Approved'
    );
    expect(workspaceRepairExecutionRequest.textContent).toContain(
      '/ audit events 4'
    );
    expect(workspaceRepairExecutionRequest.textContent).toContain(
      'side effect ledger 0'
    );
    expect(workspaceRepairExecutionRequest.textContent).toContain(
      '/ worker attempt 0/3'
    );
    expect(workspaceRepairExecutionRequest.textContent).toContain(
      '/ queued 2026-06-20T09:05:00.000Z'
    );
    expect(workspaceRepairExecutionRequest.textContent).toContain(
      'agent run agent-run-1'
    );
    expect(workspaceRepairExecutionRequest.textContent).toContain(
      'agent run status Queued'
    );
    expect(workspaceRepairExecutionRequest.textContent).toContain(
      'agent run workflow prompt_registry_repair_execution'
    );
    expect(workspaceRepairExecutionRequest.textContent).toContain(
      'agent run steps repair_execution:Model:Pending'
    );
    expect(workspaceRepairExecutionRequest.textContent).toContain(
      'agent run timeline events #0:Run Status:Waiting Approval:Repair execution run waiting_approval | #1:Approval Step:Waiting Approval:Repair execution waiting for approval | #2:Run Status:Queued:Repair execution run queued | #3:Model Step:Pending:Repair execution queued for worker'
    );
    expect(
      screen.getByRole('button', { name: 'Cancel execution' })
    ).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel execution' }));

    await waitFor(() => {
      expect(controlRepairExecutionMock).toHaveBeenCalledWith({
        input: {
          workspaceId: 'workspace-1',
          executionRequestId: 'repair-execution-1',
          action: 'cancel',
        },
      });
    });
    await waitFor(() => {
      expect(
        screen.getAllByText(/Repair execution control/).length
      ).toBeGreaterThan(0);
    });
    const cancelledRepairExecutionRequest = screen
      .getAllByText(/Repair execution control/)
      .at(-1)!;
    expect(cancelledRepairExecutionRequest.textContent).toContain(
      'repair-execution-1 / status Cancelled'
    );
    expect(cancelledRepairExecutionRequest.textContent).toContain(
      'executor manual_repair_execution_control'
    );
    expect(cancelledRepairExecutionRequest.textContent).toContain(
      'completed 2026-06-20T09:06:00.000Z'
    );
  });

  test('retries a failed persisted repair execution from Admin', async () => {
    const defaultRequestRepairExecution =
      requestRepairExecutionMock.getMockImplementation();
    requestRepairExecutionMock.mockImplementationOnce(async input => {
      const result = await defaultRequestRepairExecution?.(input);
      const request = result.requestCopilotPromptRegistryRepairExecution;
      const executionRecord = request.executionRecord;
      if (!executionRecord) {
        throw new Error('Expected repair execution record fixture');
      }

      return {
        requestCopilotPromptRegistryRepairExecution: {
          ...request,
          accepted: true,
          executionRequested: true,
          executionRecord: {
            ...executionRecord,
            approvalState: 'approved',
            auditEventCount: 9,
            auditEvents: repairExecutionAuditEventsFixture([
              'failed',
              'running',
              'queued',
              'approval_approved',
              'waiting_approval',
            ]),
            completedAt: '2026-06-20T09:10:00.000Z',
            failureCode: 'unsupported_executor_payload',
            failureMessage: 'Unsupported repair execution executor payload',
            lastAttemptAt: '2026-06-20T09:09:00.000Z',
            queuedAt: '2026-06-20T09:05:00.000Z',
            runtimeResult: {
              executor: 'repair_execution_worker',
              message:
                'Repair execution worker failed with unsupported_executor_payload: Unsupported repair execution executor payload',
              sideEffectsApplied: false,
              version: 'repair-execution-runtime-result/v1',
            },
            sideEffectCount: 0,
            sideEffects: [],
            status: 'failed',
            updatedAt: '2026-06-20T09:10:00.000Z',
            workerAttempt: 2,
            agentRun: executionRecord.agentRun
              ? {
                  ...executionRecord.agentRun,
                  completedAt: '2026-06-20T09:10:00.000Z',
                  failureCode: 'unsupported_executor_payload',
                  failureMessage:
                    'Unsupported repair execution executor payload',
                  status: 'failed',
                  steps: executionRecord.agentRun.steps.map(
                    (step: Record<string, unknown>, index: number) =>
                      index === 0
                        ? {
                            ...step,
                            completedAt: '2026-06-20T09:10:00.000Z',
                            status: 'failed',
                          }
                        : step
                  ),
                }
              : null,
          },
          repairJobRequestStatus: 'failed',
          requestStatus: 'failed',
        },
      };
    });

    renderAiPage();

    fireEvent.change(screen.getByLabelText('Prompt name'), {
      target: {
        value: 'Make it real',
      },
    });
    fireEvent.change(screen.getByLabelText('Workspace ID'), {
      target: {
        value: 'workspace-1',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check request gate' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Retry execution' })
      ).not.toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Retry execution' }));

    await waitFor(() => {
      expect(controlRepairExecutionMock).toHaveBeenCalledWith({
        input: {
          workspaceId: 'workspace-1',
          executionRequestId: 'repair-execution-1',
          action: 'retry',
        },
      });
    });
    await waitFor(() => {
      expect(
        screen.getAllByText(/Repair execution control/).length
      ).toBeGreaterThan(0);
    });
    const retriedRepairExecutionRequest = screen
      .getAllByText(/Repair execution control/)
      .at(-1)!;
    expect(retriedRepairExecutionRequest.textContent).toContain(
      'repair-execution-1 / status Queued'
    );
    expect(retriedRepairExecutionRequest.textContent).toContain(
      'executor manual_repair_execution_control'
    );
    expect(retriedRepairExecutionRequest.textContent).toContain(
      'worker attempt 2/3'
    );
  });

  test('resumes a failed persisted repair execution with corrected payload from Admin', async () => {
    const defaultRequestRepairExecution =
      requestRepairExecutionMock.getMockImplementation();
    requestRepairExecutionMock.mockImplementationOnce(async input => {
      const result = await defaultRequestRepairExecution?.(input);
      const request = result.requestCopilotPromptRegistryRepairExecution;
      const executionRecord = request.executionRecord;
      if (!executionRecord) {
        throw new Error('Expected repair execution record fixture');
      }

      return {
        requestCopilotPromptRegistryRepairExecution: {
          ...request,
          accepted: true,
          executionRequested: true,
          executionRecord: {
            ...executionRecord,
            approvalState: 'approved',
            auditEventCount: 9,
            auditEvents: repairExecutionAuditEventsFixture([
              'failed',
              'running',
              'queued',
              'approval_approved',
              'waiting_approval',
            ]),
            completedAt: '2026-06-20T09:10:00.000Z',
            failureCode: 'unsupported_executor_payload',
            failureMessage: 'Unsupported repair execution executor payload',
            lastAttemptAt: '2026-06-20T09:09:00.000Z',
            queuedAt: '2026-06-20T09:05:00.000Z',
            runtimeResult: {
              executor: 'repair_execution_worker',
              message:
                'Repair execution worker failed with unsupported_executor_payload: Unsupported repair execution executor payload',
              sideEffectsApplied: false,
              version: 'repair-execution-runtime-result/v1',
            },
            sideEffectCount: 0,
            sideEffects: [],
            status: 'failed',
            updatedAt: '2026-06-20T09:10:00.000Z',
            workerAttempt: 2,
            agentRun: executionRecord.agentRun
              ? {
                  ...executionRecord.agentRun,
                  completedAt: '2026-06-20T09:10:00.000Z',
                  failureCode: 'unsupported_executor_payload',
                  failureMessage:
                    'Unsupported repair execution executor payload',
                  status: 'failed',
                  steps: executionRecord.agentRun.steps.map(
                    (step: Record<string, unknown>, index: number) =>
                      index === 0
                        ? {
                            ...step,
                            completedAt: '2026-06-20T09:10:00.000Z',
                            status: 'failed',
                          }
                        : step
                  ),
                }
              : null,
          },
          repairJobRequestStatus: 'failed',
          requestStatus: 'failed',
        },
      };
    });

    renderAiPage();

    fireEvent.change(screen.getByLabelText('Prompt name'), {
      target: {
        value: 'Make it real',
      },
    });
    fireEvent.change(screen.getByLabelText('Workspace ID'), {
      target: {
        value: 'workspace-1',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check request gate' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Resume with payload' })
      ).not.toBeNull();
    });
    fireEvent.change(
      screen.getByLabelText('Repair execution executor payload JSON'),
      {
        target: {
          value: JSON.stringify(
            {
              kind: 'prompt_registry_revision_publish',
              version: 'prompt-registry-revision-executor-payload/v1',
            },
            null,
            2
          ),
        },
      }
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Resume with payload' })
    );

    await waitFor(() => {
      expect(controlRepairExecutionMock).toHaveBeenCalledWith({
        input: {
          workspaceId: 'workspace-1',
          executionRequestId: 'repair-execution-1',
          action: 'resume_with_payload',
          executorPayload: {
            kind: 'prompt_registry_revision_publish',
            version: 'prompt-registry-revision-executor-payload/v1',
          },
        },
      });
    });
    await waitFor(() => {
      expect(
        screen.getAllByText(/Repair execution control/).length
      ).toBeGreaterThan(0);
    });
    const resumedRepairExecutionRequest = screen
      .getAllByText(/Repair execution control/)
      .at(-1)!;
    expect(resumedRepairExecutionRequest.textContent).toContain(
      'repair-execution-1 / status Queued'
    );
    expect(resumedRepairExecutionRequest.textContent).toContain(
      'executor manual_repair_execution_payload_correction'
    );
  });

  test('shows repair execution side effect ledger history in Admin', async () => {
    const defaultRequestRepairExecution =
      requestRepairExecutionMock.getMockImplementation();
    requestRepairExecutionMock.mockImplementationOnce(async input => {
      const result = await defaultRequestRepairExecution?.(input);
      const request = result.requestCopilotPromptRegistryRepairExecution;
      const executionRecord = request.executionRecord;
      if (!executionRecord) {
        throw new Error('Expected repair execution record fixture');
      }

      return {
        requestCopilotPromptRegistryRepairExecution: {
          ...request,
          accepted: true,
          executionRequested: true,
          executionRecord: {
            ...executionRecord,
            approvalState: 'approved',
            auditEventCount: 6,
            auditEvents: repairExecutionAuditEventsFixture([
              'completed',
              'side_effect_applied',
              'running',
              'queued',
              'approval_approved',
            ]),
            completedAt: '2026-06-20T09:30:00.000Z',
            lastAttemptAt: '2026-06-20T09:29:00.000Z',
            queuedAt: '2026-06-20T09:05:00.000Z',
            runtimeResult: {
              executor: 'prompt_registry_revision_publish_worker',
              message:
                'Repair execution worker published a Prompt Registry revision.',
              sideEffectsApplied: true,
              sideEffectFingerprint: 'sideeffect1111',
              sideEffectKind: 'prompt_registry_revision',
              sideEffectRecordId: 'prompt-revision-repair-execution-1',
              sideEffectSummary: {
                revision: 'repair-repair-execution-1',
                version: 'prompt-registry-side-effect-summary/v1',
              },
              version: 'repair-execution-runtime-result/v1',
            },
            sideEffectCount: 1,
            sideEffects: [
              {
                actorId: 'user-1',
                appliedAt: '2026-06-20T09:30:00.000Z',
                createdAt: '2026-06-20T09:30:00.000Z',
                executionRequestId: 'repair-execution-1',
                executorPayloadFingerprint: 'executorpayload1111',
                id: 'repair-execution-side-effect-repair-execution-1',
                sideEffectFingerprint: 'sideeffect1111',
                sideEffectKind: 'prompt_registry_revision',
                sideEffectRecordId: 'prompt-revision-repair-execution-1',
                sideEffectSummary: {
                  revision: 'repair-repair-execution-1',
                  version: 'prompt-registry-side-effect-summary/v1',
                },
                workerAttempt: 1,
                workerLeaseId: 'repair-worker-lease-1',
                workspaceId: 'workspace-1',
              },
            ],
            status: 'completed',
            updatedAt: '2026-06-20T09:30:00.000Z',
            workerAttempt: 1,
            agentRun: executionRecord.agentRun
              ? {
                  ...executionRecord.agentRun,
                  completedAt: '2026-06-20T09:30:00.000Z',
                  status: 'completed',
                  steps: executionRecord.agentRun.steps.map(
                    (step: Record<string, unknown>, index: number) =>
                      index === 0
                        ? {
                            ...step,
                            completedAt: '2026-06-20T09:30:00.000Z',
                            status: 'completed',
                          }
                        : step
                  ),
                }
              : null,
          },
          repairJobRequestStatus: 'completed',
          requestStatus: 'completed',
        },
      };
    });

    renderAiPage();

    fireEvent.change(screen.getByLabelText('Prompt name'), {
      target: {
        value: 'Make it real',
      },
    });
    fireEvent.change(screen.getByLabelText('Workspace ID'), {
      target: {
        value: 'workspace-1',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check request gate' }));

    await waitFor(() => {
      expect(
        screen.getAllByText(/execution record repair-execution-1/).length
      ).toBeGreaterThan(0);
    });
    const completedRepairExecutionRequest = screen
      .getAllByText(/execution record repair-execution-1/)
      .at(-1)!;
    expect(completedRepairExecutionRequest.textContent).toContain(
      'status Completed'
    );
    expect(completedRepairExecutionRequest.textContent).toContain(
      'side effects yes'
    );
    expect(completedRepairExecutionRequest.textContent).toContain(
      'side effect ledger 1'
    );
    expect(completedRepairExecutionRequest.textContent).toContain(
      'side effect history Prompt Registry Revision:prompt-revision-repair-execution-1:attempt 1:sideeffect1111'
    );
    expect(completedRepairExecutionRequest.textContent).toContain(
      'side effect fingerprint sideeffect1111'
    );
  });

  test('uses prompt catalog metadata without hiding manual prompt diagnostics', async () => {
    renderAiPage();

    expect(screen.getByText('Prompt catalog')).not.toBeNull();
    expect(screen.getByText('Prompt search')).not.toBeNull();
    expect(screen.getByText('Prompt category')).not.toBeNull();
    expect(screen.getByText('Catalog results: 4 / 4')).not.toBeNull();
    expect(screen.getAllByText('gpt-4o-mini').length).toBeGreaterThan(0);
    expect(screen.getByText('Optional models')).not.toBeNull();
    expect(screen.getByText('Pro models')).not.toBeNull();
    const promptCatalogDiagnostics = screen.getByTestId(
      'prompt-catalog-diagnostics-Chat With LocalMind AI'
    ).textContent;
    expect(promptCatalogDiagnostics).toContain('Prompt LocalMind AI');
    expect(promptCatalogDiagnostics).toContain('Action chat');
    expect(promptCatalogDiagnostics).toContain('Category Text');
    expect(promptCatalogDiagnostics).toContain('Source Built In');
    expect(promptCatalogDiagnostics).toContain(
      'Revision built_in:text:override:a1b2c3d4e5f60708'
    );
    expect(promptCatalogDiagnostics).toContain('Fingerprint a1b2c3d4e5f60708');
    expect(promptCatalogDiagnostics).toContain(
      'Model strategy fingerprint 9999aaaabbbbcccc'
    );
    expect(promptCatalogDiagnostics).toContain(
      'Template fingerprint 1111222233334444'
    );
    expect(promptCatalogDiagnostics).toContain(
      'Version evidence revision built_in:text:override:a1b2c3d4e5f60708 / fingerprint a1b2c3d4e5f60708 / model 9999aaaabbbbcccc / template 1111222233334444 / policy Text / override yes / model config copilot.prompts.overrides[].model / optional config copilot.prompts.overrides[].optionalModels / pro config copilot.prompts.overrides[].config.proModels'
    );
    expect(promptCatalogDiagnostics).toContain('Override yes');
    expect(promptCatalogDiagnostics).toContain('Default policy Text');
    expect(promptCatalogDiagnostics).toContain('Default model gpt-4o-mini');
    expect(promptCatalogDiagnostics).toContain('Default model source Override');
    expect(promptCatalogDiagnostics).toContain(
      'Default model config copilot.prompts.overrides[].model'
    );
    expect(promptCatalogDiagnostics).toContain(
      'Optional models 2 / gpt-4o-mini -> gpt-4o'
    );
    expect(promptCatalogDiagnostics).toContain(
      'Optional models source Override'
    );
    expect(promptCatalogDiagnostics).toContain(
      'Optional models config copilot.prompts.overrides[].optionalModels'
    );
    expect(promptCatalogDiagnostics).toContain('Pro models 1');
    expect(promptCatalogDiagnostics).toContain('Pro models source Override');
    expect(promptCatalogDiagnostics).toContain(
      'Pro models config copilot.prompts.overrides[].config.proModels'
    );
    expect(promptCatalogDiagnostics).toContain('Params 1 / content');
    expect(promptCatalogDiagnostics).not.toContain('Registry id');
    expect(
      screen.getAllByText('Revision built_in:text:override:a1b2c3d4e5f60708')
        .length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Fingerprint a1b2c3d4e5f60708').length).toBe(1);
    expect(screen.getAllByText('Model strategy 9999aaaabbbbcccc').length).toBe(
      1
    );
    expect(screen.getAllByText('Template 1111222233334444').length).toBe(1);
    expect(
      screen.getByTestId(
        'prompt-catalog-version-evidence-Chat With LocalMind AI'
      ).textContent
    ).toContain(
      'revision built_in:text:override:a1b2c3d4e5f60708 / fingerprint a1b2c3d4e5f60708 / model 9999aaaabbbbcccc / template 1111222233334444 / policy Text / override yes / model config copilot.prompts.overrides[].model / optional config copilot.prompts.overrides[].optionalModels / pro config copilot.prompts.overrides[].config.proModels'
    );

    fireEvent.change(screen.getByLabelText('Prompt name'), {
      target: {
        value: 'Make it real',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));

    const registryPromptDiagnostics = screen.getByTestId(
      'prompt-catalog-diagnostics-Make it real'
    ).textContent;
    expect(registryPromptDiagnostics).toContain('Source Registry');
    expect(registryPromptDiagnostics).toContain('Registry id 42');
    expect(registryPromptDiagnostics).toContain('Registry messages 2');
    expect(registryPromptDiagnostics).toContain('Registry modified yes');
    expect(registryPromptDiagnostics).toContain(
      'Registry updated 2026-06-17T04:05:06.000Z'
    );
    expect(registryPromptDiagnostics).toContain(
      'Registry fingerprint b1c2d3e4f5061728'
    );
    expect(registryPromptDiagnostics).toContain('Registry status Ready');
    expect(registryPromptDiagnostics).toContain('Registry reason Ready');
    expect(registryPromptDiagnostics).toContain('Registry detail ready');
    expect(registryPromptDiagnostics).toContain('Registry publish Allowed');
    expect(registryPromptDiagnostics).toContain('Registry blocking 0');
    expect(registryPromptDiagnostics).toContain('Registry issues 0');
    expect(registryPromptDiagnostics).toContain('Registry errors 0');
    expect(registryPromptDiagnostics).not.toContain('Registry issue error');
    expect(registryPromptDiagnostics).not.toContain('Registry remediation');
    expect(registryPromptDiagnostics).toContain('Registry source DB revision');
    expect(registryPromptDiagnostics).toContain(
      'Registry revision workspace-r2'
    );
    expect(registryPromptDiagnostics).toContain(
      'Registry revision id prompt-revision-workspace'
    );
    expect(registryPromptDiagnostics).toContain(
      'Registry revision publish events 2'
    );
    expect(registryPromptDiagnostics).toContain(
      'Registry revision publish event Revision Reused / graphql_mutation / fingerprint publishreuse1111 / actor user-1'
    );
    expect(registryPromptDiagnostics).toContain(
      'Registry revision publish event Revision Published / graphql_mutation / fingerprint publishcreated1111 / actor user-1'
    );
    expect(registryPromptDiagnostics).toContain(
      'Registry revision scope Workspace'
    );
    expect(registryPromptDiagnostics).toContain(
      'Registry revision workspace workspace-1'
    );
    expect(registryPromptDiagnostics).toContain(
      'Registry revision actor user-1'
    );
    expect(registryPromptDiagnostics).toContain(
      'Registry revision fingerprint db11112222333344'
    );
    expect(registryPromptDiagnostics).toContain(
      'Registry revision status Active'
    );
    expect(registryPromptDiagnostics).toContain(
      'Registry source chain fingerprint chain111122223333'
    );
    expect(registryPromptDiagnostics).toContain(
      'Registry source chain db_revision / scope workspace / status active / revision workspace-r2 / fingerprint db11112222333344 / workspace workspace-1 / actor user-1 / updated 2026-06-18T04:05:06.000Z'
    );
    expect(registryPromptDiagnostics).toContain(
      'Registry source chain legacy_registry / scope global / status ready / revision registry:no-policy:base:b1c2d3e4f5061728 / fingerprint b1c2d3e4f5061728 / registry 42 / config ai_prompts_metadata / updated 2026-06-17T04:05:06.000Z'
    );
    expect(registryPromptDiagnostics).toContain(
      'Version evidence revision registry:no-policy:base:b1c2d3e4f5061728 / fingerprint b1c2d3e4f5061728 / model 8888aaaabbbbcccc / template 2222333344445555 / policy none / override no / registry fingerprint b1c2d3e4f5061728 / registry id 42 / registry messages 2 / registry modified yes / registry updated 2026-06-17T04:05:06.000Z / registry status Ready / registry reason Ready / registry detail ready / registry publish Allowed / registry blocking 0 / registry issues 0 / registry errors 0 / registry source DB revision / registry revision workspace-r2'
    );
    expect(screen.getAllByText('Registry source').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DB revision').length).toBeGreaterThan(0);
    expect(screen.getByText('Revision workspace-r2')).not.toBeNull();
    expect(screen.getByText('Scope Workspace / workspace-1')).not.toBeNull();
    expect(screen.getByText('Revision status Active')).not.toBeNull();
    expect(screen.getByText('Actor user-1')).not.toBeNull();
    expect(
      screen.getByText('Revision fingerprint db11112222333344')
    ).not.toBeNull();
    expect(
      screen.getByText('Source chain fingerprint chain111122223333')
    ).not.toBeNull();
    expect(screen.getByText('Registry record')).not.toBeNull();
    expect(screen.getAllByText('42').length).toBeGreaterThan(0);
    expect(screen.getByText('Status Ready')).not.toBeNull();
    expect(screen.getByText('Reason Ready')).not.toBeNull();
    expect(screen.getByText('Detail ready')).not.toBeNull();
    expect(screen.getAllByText('Publish Allowed').length).toBeGreaterThan(0);
    expect(screen.getByText('Blocking 0')).not.toBeNull();
    expect(screen.getByText('Issues 0')).not.toBeNull();
    expect(screen.getByText('Errors 0')).not.toBeNull();
    expect(screen.getByText('Messages 2')).not.toBeNull();
    expect(screen.getByText('Modified yes')).not.toBeNull();
    expect(screen.getByText('Updated 2026-06-17T04:05:06.000Z')).not.toBeNull();
    await waitFor(() => {
      expect(useQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          query: getCopilotPromptRegistryPublishGateQuery,
          variables: {
            expectedVersion: {
              registryFingerprint: 'b1c2d3e4f5061728',
              registryId: 42,
              registryUpdatedAt: '2026-06-17T04:05:06.000Z',
            },
            name: 'Make it real',
            workspaceId: undefined,
          },
        })
      );
    });
    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: getCopilotPromptRegistryRepairPreflightQuery,
        variables: expect.objectContaining({
          expectedVersion: {
            registryFingerprint: 'b1c2d3e4f5061728',
            registryId: 42,
            registryUpdatedAt: '2026-06-17T04:05:06.000Z',
          },
          name: 'Make it real',
          submission: expect.objectContaining({
            contractVersion: 'repair-preview-submission/v1',
            preparedRouteOrderEvidenceSetFingerprint: 'aaaa7777bbbb8888',
            submissionFingerprint: 'aaaa4444bbbb5555',
          }),
          workspaceId: undefined,
        }),
      })
    );
    const readyGateDiagnostics = screen.getByTestId(
      'prompt-registry-publish-gate-Make it real'
    ).textContent;
    expect(readyGateDiagnostics).toContain('Prompt Make it real');
    expect(readyGateDiagnostics).toContain('Gate Allowed');
    expect(readyGateDiagnostics).toContain('Status Ready');
    expect(readyGateDiagnostics).toContain('Publish Allowed');
    expect(readyGateDiagnostics).toContain('Registry id 42');
    expect(readyGateDiagnostics).toContain(
      'Registry updated 2026-06-17T04:05:06.000Z'
    );
    expect(readyGateDiagnostics).toContain(
      'Registry fingerprint b1c2d3e4f5061728'
    );
    expect(readyGateDiagnostics).toContain('Expected registry id 42');
    expect(readyGateDiagnostics).toContain(
      'Expected registry fingerprint b1c2d3e4f5061728'
    );
    expect(readyGateDiagnostics).toContain(
      'Expected registry updated 2026-06-17T04:05:06.000Z'
    );
    expect(readyGateDiagnostics).toContain('Stale no');
    expect(readyGateDiagnostics).toContain('Issues 0');
    expect(readyGateDiagnostics).toContain(
      'Model route Available / candidate Default#0 / config ai_prompts_metadata.model / checked yes'
    );
    expect(readyGateDiagnostics).toContain(
      'provider name Anthropic Main / provider source Configured / provider type Anthropic'
    );
    expect(readyGateDiagnostics).toContain(
      'profile anthropic-main / profile source Configured / profile config copilot.providers.profiles[id=anthropic-main]'
    );
    expect(readyGateDiagnostics).toContain(
      'profile models claude-3-5-sonnet-latest, make-it-real / profile model count 2'
    );
    expect(readyGateDiagnostics).toContain(
      'Model routes Available / candidate Default#0 / config ai_prompts_metadata.model'
    );
    expect(readyGateDiagnostics).toContain(
      'Unavailable / candidate Optional#0 / config copilot.prompts.overrides[].optionalModels'
    );
    expect(readyGateDiagnostics).toContain(
      'requested openai-fallback/missing-object / source override'
    );
    expect(readyGateDiagnostics).toContain(
      'provider health Degraded / provider checked 2026-06-17T03:30:00.000Z'
    );
    expect(readyGateDiagnostics).toContain(
      'diagnostics stage Describe Route Candidates / diagnostics code RouteDiagnosticsFailure / diagnostics message provider registry diagnostics unavailable'
    );
    expect(readyGateDiagnostics).toContain(
      'profile openai-fallback / profile source Configured / profile config copilot.providers.profiles[id=openai-fallback]'
    );
    expect(readyGateDiagnostics).toContain(
      'Available / candidate Registry#0 / config copilot.providers.profiles[].models'
    );
    expect(readyGateDiagnostics).toContain(
      'requested office-chat-fast / source registry / provider openai-fallback'
    );
    expect(readyGateDiagnostics).toContain(
      'profile openai-fallback / profile source Configured / profile config copilot.providers.profiles[id=openai-fallback]'
    );
    expect(readyGateDiagnostics).toContain(
      'profile models office-chat-fast, gpt-4o-mini / profile model count 2 / model gpt-4o-mini'
    );
    expect(readyGateDiagnostics).toContain(
      'Model route policy candidates Default#0 2'
    );
    expect(readyGateDiagnostics).toContain(
      'Model route policy candidate Anthropic Main / anthropic-main / type Anthropic'
    );
    expect(readyGateDiagnostics).toContain(
      'profile Profile anthropic-main / Configured / config copilot.providers.profiles[id=anthropic-main] / 2 configured models / models claude-3-5-sonnet-latest, make-it-real'
    );
    expect(readyGateDiagnostics).toContain(
      'available yes / allowed yes / reasons Candidate Allowed, Privacy Preferred'
    );
    expect(readyGateDiagnostics).toContain(
      'Model route policy candidate OpenAI Secondary / openai-secondary / type OpenAI'
    );
    expect(readyGateDiagnostics).toContain(
      'profile Profile openai-secondary / Configured / config copilot.providers.profiles[id=openai-secondary] / 2 configured models / models office-chat-fast, gpt-4o-mini'
    );
    expect(readyGateDiagnostics).toContain(
      'available yes / allowed no / reasons Provider Not Allowed'
    );
    expect(readyGateDiagnostics).toContain(
      'Model route phase trace Default#0 2'
    );
    expect(readyGateDiagnostics).toContain(
      'Model route phase policy / candidates 2 / available 2 / blocked 1 / selected 1 / reasons Candidate Allowed, Privacy Preferred, Provider Not Allowed'
    );
    expect(readyGateDiagnostics).toContain(
      'Model route phase trace Optional#0 2'
    );
    expect(readyGateDiagnostics).toContain(
      'Model route phase resolution / candidates 2 / available 2 / matched 0 / selected 0 / reasons Capability Mismatch, Profile Model Not Allowed'
    );
    expect(readyGateDiagnostics).toContain(
      'Model route candidate trace Default#0 1'
    );
    expect(readyGateDiagnostics).toContain(
      'source fingerprint modelroute11112222'
    );
    expect(readyGateDiagnostics).toContain(
      'source version prompt-registry-publish-gate-model-route-effective-source/v1'
    );
    expect(readyGateDiagnostics).toContain(
      'source inputs candidateKind, policyCandidates, routeCandidates'
    );
    expect(readyGateDiagnostics).toContain(
      'Model route candidate trace Optional#0 2'
    );
    expect(readyGateDiagnostics).toContain(
      'Model route provider candidate Anthropic Main / anthropic-main / model claude-3-5-sonnet-latest'
    );
    expect(readyGateDiagnostics).toContain(
      'status Matched / reasons Capability Matched, Registry Selected'
    );
    expect(readyGateDiagnostics).toContain(
      'Model route provider candidate OpenAI Secondary / openai-secondary / model gpt-4o-mini'
    );
    expect(readyGateDiagnostics).toContain(
      'registry quota_backed / status Unmatched / reasons Profile Model Not Allowed'
    );
    expect(readyGateDiagnostics).toContain('Task routes 2');
    expect(readyGateDiagnostics).toContain(
      'Task route Workspace indexing / status Blocked / configured no'
    );
    expect(readyGateDiagnostics).toContain(
      'requested workspace-embedding / source Workspace indexing task model / config copilot.tasks.models.workspaceIndexing'
    );
    expect(readyGateDiagnostics).toContain(
      'source fingerprint blocked1111222233'
    );
    expect(readyGateDiagnostics).toContain(
      'source version copilot-task-route-effective-source/v1'
    );
    expect(readyGateDiagnostics).toContain(
      'source inputs featureKind, preparedRoutes, routeCandidates'
    );
    expect(readyGateDiagnostics).toContain(
      'Task route phase trace Workspace indexing 2'
    );
    expect(readyGateDiagnostics).toContain(
      'Local Ollama / ollama-main / requested workspace-embedding'
    );
    expect(readyGateDiagnostics).toContain(
      'Task route Rerank / status Ready / configured yes'
    );
    expect(readyGateDiagnostics).toContain(
      'provider ollama-main / model bge-reranker-v2'
    );
    expect(readyGateDiagnostics).toContain(
      'requested workspace-rerank / source DB-backed task route policy / config copilot.tasks.models.rerank'
    );
    expect(readyGateDiagnostics).toContain(
      'rerank runtime contract workspace-rerank-runtime/v1 / rerank runtime topK 5'
    );
    expect(readyGateDiagnostics).toContain(
      `prepared providers 1 / targets ollama-main/bge-reranker-v2 / target fingerprint ${readyRoute.preparedRouteTargetFingerprint}`
    );
    expect(readyGateDiagnostics).toContain(
      'Task route prepare candidates Rerank 1'
    );
    expect(readyGateDiagnostics).toContain(
      'Task route diagnostics errors Workspace indexing 1'
    );
    expect(readyGateDiagnostics).toContain(
      'Task route diagnostics error stage Describe Embedding Prepare Candidates / code EmbeddingPrepareDiagnosticsFailure / message embedding prepare diagnostics unavailable'
    );
    expect(readyGateDiagnostics).toContain(
      'Action route dry-run status Succeeded / feature Action / action make-it-real / steps 1 / routes 1/1'
    );
    expect(readyGateDiagnostics).toContain(
      'Action route dry-run step generate / kind Structured / routes 1/1 / requested office-structured / source Registry / fallback openai-fallback'
    );
    expect(readyGateDiagnostics).toContain(
      'Action route dry-run route openai-fallback/gpt-4o-mini / route #1 / fallback #1 / protocol openai_chat / layer chat_completions'
    );
    expect(readyGateDiagnostics).toContain(
      'profile Profile openai-fallback / Configured / config copilot.providers.profiles[id=openai-fallback] / 2 configured models / models office-structured, gpt-4o-mini'
    );
    expect(readyGateDiagnostics).toContain('Repair action catalog 4');
    expect(readyGateDiagnostics).toContain(
      'Repair action catalog fingerprint aaaabbbbccccdddd'
    );
    expect(readyGateDiagnostics).toContain(
      'Repair action mutation guard required yes / fingerprint 1111aaaabbbbcccc / audit fingerprint aaaabbbb11112222 / audit summary registry:42 | registryFingerprint:b1c2d3e4f5061728 | catalog:repair-actions/v1 | catalogFingerprint:aaaabbbbccccdddd | recommendations:4 | intent:abc111def2223333 | targetLocators:4 | targetKinds:action_route,model_route,task_route | reviewModes:preview,probe | safety:preview_required,read_only_probe / catalog repair-actions/v1 / catalog fingerprint aaaabbbbccccdddd / intent fingerprint abc111def2223333 / input schema fingerprint aaa111bbb222cccc / target locator fingerprint ddd111eee222ffff / target locators 4 / target locator kinds Action Route, Model Route, Task Route / expected registry 42 / expected fingerprint b1c2d3e4f5061728 / expected updated 2026-06-17T04:05:06.000Z / recommendations 4 / recommendation categories Action Route, Model Route, Task Route / recommendation codes action_generate_provider_health_not_healthy, optional_model_route_unavailable, selected_provider_health_not_healthy, workspace_indexing_task_route_unavailable / suggested actions Check Action Provider Health, Check Provider Health, Repair Task Model Route, Review Non Default Model Route / required capabilities action_route.read, model_registry.read, provider_health.probe, provider_profile.read, provider_route.preview, task_route.read / review modes Preview, Probe / safety levels Preview Required, Read Only Probe / recommendation fingerprints 1111222233334444, 2222333344445555, 3333444455556666, 4444555566667777'
    );
    expect(readyGateDiagnostics).toContain(
      'Repair action preview status Preview Required / read-only yes / fingerprint 9999aaaabbbbcccc'
    );
    expect(readyGateDiagnostics).toContain(
      `Repair gate manifest prompt-registry-repair-gate-manifest/v1 / fingerprint ${readyPublishGateVerdict.repairGateManifest.fingerprint} / boundary repair_gate_manifest_only_no_prompt_or_provider_payload / registry 42 / registry fingerprint b1c2d3e4f5061728 / registry updated 2026-06-17T04:05:06.000Z / gate Ready / publish Allowed / reason Ready / issues 0 / blocking 0 / recommendations 4 / operations 4`
    );
    expect(readyGateDiagnostics).toContain(
      `Repair gate manifest export metadata prompt-registry-repair-gate-manifest-export-metadata/v1 / artifact prompt_registry_repair_gate_manifest_json / filename prompt-registry-repair-gate-manifest-42-${readyPublishGateVerdict.repairGateManifest.fingerprint}.json / mime application/json;charset=utf-8 / metadata filename prompt-registry-repair-gate-manifest-metadata-42-${readyPublishGateVerdict.repairGateManifest.fingerprint}.json / manifest prompt-registry-repair-gate-manifest/v1 / manifest fingerprint ${readyPublishGateVerdict.repairGateManifest.fingerprint}`
    );
    expect(readyGateDiagnostics).toContain(
      'redaction policy prompt-registry-repair-gate-manifest-redaction-policy/v1 / redaction status Redacted Projection No Prompt Provider Payload Or Secret'
    );
    expect(readyGateDiagnostics).toContain(
      'export policy prompt-registry-repair-gate-manifest-export-policy/v1 / export status Read Only Projection'
    );
    expect(readyGateDiagnostics).toContain(
      'audit event prompt-registry-repair-gate-manifest-export-audit-event/v1 / audit status Not Created Read Only / audit event created no'
    );
    expect(readyGateDiagnostics).toContain(
      'retention policy prompt-registry-repair-gate-manifest-retention-policy/v1 / retention status Not Persisted Read Only'
    );
    const readyManifestExportMetadata =
      screen.getByTestId(
        'prompt-registry-repair-gate-manifest-export-metadata-Make it real'
      ).textContent ?? '';
    expect(readyManifestExportMetadata).toContain(
      'Export artifact prompt_registry_repair_gate_manifest_json'
    );
    expect(readyManifestExportMetadata).toContain(
      `Filename prompt-registry-repair-gate-manifest-42-${readyPublishGateVerdict.repairGateManifest.fingerprint}.json`
    );
    expect(readyManifestExportMetadata).toContain(
      'MIME application/json;charset=utf-8'
    );
    expect(readyManifestExportMetadata).toContain(
      `Metadata filename prompt-registry-repair-gate-manifest-metadata-42-${readyPublishGateVerdict.repairGateManifest.fingerprint}.json`
    );
    expect(readyManifestExportMetadata).toContain(
      'Metadata prompt-registry-repair-gate-manifest-export-metadata/v1'
    );
    expect(readyManifestExportMetadata).toContain(
      'Manifest prompt-registry-repair-gate-manifest/v1'
    );
    expect(readyManifestExportMetadata).toContain(
      `Fingerprint ${readyPublishGateVerdict.repairGateManifest.fingerprint}`
    );
    expect(readyManifestExportMetadata).toContain('Registry 42');
    expect(readyManifestExportMetadata).toContain(
      'Registry fingerprint b1c2d3e4f5061728'
    );
    expect(readyManifestExportMetadata).toContain(
      'Registry updated 2026-06-17T04:05:06.000Z'
    );
    expect(readyManifestExportMetadata).toContain('Gate status ready');
    expect(readyManifestExportMetadata).toContain('Publish status allowed');
    expect(readyManifestExportMetadata).toContain(
      'Boundary repair_gate_manifest_only_no_prompt_or_provider_payload'
    );
    expect(readyManifestExportMetadata).toContain(
      'Redaction policy prompt-registry-repair-gate-manifest-redaction-policy/v1'
    );
    expect(readyManifestExportMetadata).toContain(
      'Redaction policy status redacted_projection_no_prompt_provider_payload_or_secret'
    );
    expect(readyManifestExportMetadata).toContain(
      `Redaction policy fingerprint ${readyPublishGateVerdict.repairGateManifestExportMetadata.redactionPolicyFingerprint}`
    );
    expect(readyManifestExportMetadata).toContain(
      'Export policy prompt-registry-repair-gate-manifest-export-policy/v1'
    );
    expect(readyManifestExportMetadata).toContain(
      'Export policy status read_only_projection'
    );
    expect(readyManifestExportMetadata).toContain(
      `Export policy fingerprint ${readyPublishGateVerdict.repairGateManifestExportMetadata.exportPolicyFingerprint}`
    );
    expect(readyManifestExportMetadata).toContain(
      'Audit event prompt-registry-repair-gate-manifest-export-audit-event/v1'
    );
    expect(readyManifestExportMetadata).toContain(
      'Audit event status not_created_read_only'
    );
    expect(readyManifestExportMetadata).toContain('Audit event created no');
    expect(readyManifestExportMetadata).toContain(
      `Audit event fingerprint ${readyPublishGateVerdict.repairGateManifestExportMetadata.auditEventFingerprint}`
    );
    expect(readyManifestExportMetadata).toContain(
      'Retention policy prompt-registry-repair-gate-manifest-retention-policy/v1'
    );
    expect(readyManifestExportMetadata).toContain(
      'Retention policy status not_persisted_read_only'
    );
    expect(readyManifestExportMetadata).toContain(
      `Retention policy fingerprint ${readyPublishGateVerdict.repairGateManifestExportMetadata.retentionPolicyFingerprint}`
    );
    const readyManifestJson =
      screen.getByTestId(
        'prompt-registry-repair-gate-manifest-json-Make it real'
      ).textContent ?? '';
    expect(JSON.parse(readyManifestJson)).toEqual(
      readyPublishGateVerdict.repairGateManifest
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy manifest JSON' }));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(readyManifestJson);
    });
    const readyManifestMetadataJson =
      screen.getByTestId(
        'prompt-registry-repair-gate-manifest-export-metadata-json-Make it real'
      ).textContent ?? '';
    expect(JSON.parse(readyManifestMetadataJson)).toEqual(
      readyPublishGateVerdict.repairGateManifestExportMetadata
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy manifest metadata' })
    );
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(readyManifestExportMetadata);
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy manifest metadata JSON' })
    );
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(readyManifestMetadataJson);
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Download manifest JSON' })
    );
    expect(createObjectURLMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'application/json;charset=utf-8',
      })
    );
    const repairManifestDownloadAnchor = anchorClickMock.mock
      .contexts[0] as HTMLAnchorElement;
    expect(repairManifestDownloadAnchor.download).toBe(
      readyPublishGateVerdict.repairGateManifestExportMetadata.filename
    );
    expect(revokeObjectURLMock).toHaveBeenCalledWith(
      'blob:action-run-manifest'
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Download manifest metadata JSON' })
    );
    expect(createObjectURLMock).toHaveBeenCalledTimes(2);
    const repairManifestMetadataDownloadAnchor = anchorClickMock.mock
      .contexts[1] as HTMLAnchorElement;
    expect(repairManifestMetadataDownloadAnchor.download).toBe(
      readyPublishGateVerdict.repairGateManifestExportMetadata.metadataFilename
    );
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(2);
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    anchorClickMock.mockClear();
    expect(readyGateDiagnostics).toContain(
      'candidate evidence set aaaa5555bbbb6666 / task route source evidence set aaaa5656bbbb6767 / task route source evidence set version copilot-task-route-effective-source-evidence-set/v1 / task route source evidence set inputs diagnosticsFingerprint, operationFingerprint, taskRouteEffectiveSourceFingerprints / embedding index contract evidence set aaaa6666bbbb7777 / rerank runtime contract evidence set aaaa8888bbbb9999 / prepared route order evidence set aaaa7777bbbb8888'
    );
    expect(readyGateDiagnostics).toContain(
      'candidate evidence set fingerprint aaaa5555bbbb6666 / task route source evidence set fingerprint aaaa5656bbbb6767 / task route source evidence set version copilot-task-route-effective-source-evidence-set/v1 / task route source evidence set inputs diagnosticsFingerprint, operationFingerprint, taskRouteEffectiveSourceFingerprints / embedding index contract evidence set fingerprint aaaa6666bbbb7777 / rerank runtime contract evidence set fingerprint aaaa8888bbbb9999 / prepared route order evidence set fingerprint aaaa7777bbbb8888'
    );
    expect(readyGateDiagnostics).toContain(
      'submission candidate evidence set fingerprint aaaa5555bbbb6666 / submission task route source evidence set fingerprint aaaa5656bbbb6767 / submission task route source evidence set version copilot-task-route-effective-source-evidence-set/v1 / submission task route source evidence set inputs diagnosticsFingerprint, operationFingerprint, taskRouteEffectiveSourceFingerprints / submission embedding index contract evidence set fingerprint aaaa6666bbbb7777 / submission rerank runtime contract evidence set fingerprint aaaa8888bbbb9999 / submission prepared route order evidence set fingerprint aaaa7777bbbb8888'
    );
    expect(readyGateDiagnostics).toContain(
      'submission required inputs approvalPolicyFingerprint, authorizationFingerprint, candidateEvidenceSetFingerprint'
    );
    expect(readyGateDiagnostics).toContain(
      'taskRouteEffectiveSourceEvidenceSetFingerprint'
    );
    expect(readyGateDiagnostics).toContain(
      'Repair action preflight status Ready For Review / read-only yes / mutation available no / accepted no'
    );
    expect(readyGateDiagnostics).toContain(
      'candidate evidence set fingerprint aaaa5555bbbb6666 / task route source evidence set fingerprint aaaa5656bbbb6767 / task route source evidence set version copilot-task-route-effective-source-evidence-set/v1 / task route source evidence set inputs diagnosticsFingerprint, operationFingerprint, taskRouteEffectiveSourceFingerprints / embedding index contract evidence set fingerprint aaaa6666bbbb7777 / rerank runtime contract evidence set fingerprint aaaa8888bbbb9999 / prepared route order evidence set fingerprint aaaa7777bbbb8888 / expected candidate evidence set fingerprint aaaa5555bbbb6666 / expected task route source evidence set fingerprint aaaa5656bbbb6767 / expected task route source evidence set version copilot-task-route-effective-source-evidence-set/v1 / expected task route source evidence set inputs diagnosticsFingerprint, operationFingerprint, taskRouteEffectiveSourceFingerprints / expected embedding index contract evidence set fingerprint aaaa6666bbbb7777 / expected rerank runtime contract evidence set fingerprint aaaa8888bbbb9999 / expected prepared route order evidence set fingerprint aaaa7777bbbb8888'
    );
    expect(readyGateDiagnostics).toContain(
      'audit event inputs actorFingerprint, approvalRecordFingerprint, auditBindingFingerprint, candidateEvidenceSetFingerprint, taskRouteEffectiveSourceEvidenceSetFingerprint, embeddingIndexContractEvidenceSetFingerprint'
    );
    expect(readyGateDiagnostics).toContain(
      'execution state inputs auditEventFingerprint, candidateEvidenceSetFingerprint, taskRouteEffectiveSourceEvidenceSetFingerprint, embeddingIndexContractEvidenceSetFingerprint'
    );
    expect(readyGateDiagnostics).toContain(
      'rollback plan inputs auditEventFingerprint, candidateEvidenceSetFingerprint, taskRouteEffectiveSourceEvidenceSetFingerprint, embeddingIndexContractEvidenceSetFingerprint'
    );
    expect(readyGateDiagnostics).toContain(
      'review binding inputs candidateEvidenceSetFingerprint, taskRouteEffectiveSourceEvidenceSetFingerprint'
    );
    expect(readyGateDiagnostics).toContain(
      'repair job inputs actorFingerprint, auditBindingFingerprint, candidateEvidenceSetFingerprint, taskRouteEffectiveSourceEvidenceSetFingerprint, embeddingIndexContractEvidenceSetFingerprint'
    );
    expect(readyGateDiagnostics).toContain(
      'matched fields approvalPolicyFingerprint, authorizationFingerprint, candidateEvidenceSetFingerprint, taskRouteEffectiveSourceEvidenceSetFingerprint'
    );
    expect(readyGateDiagnostics).toMatch(
      /Repair action preview operation Preview Required \/ action kind Review Non Default Model Route .* candidate evidence 0 \/ candidate evidence fingerprint [0-9a-f]{16} \/ candidate evidence fingerprints none \/ candidate evidence keys none \/ prepared route order fingerprints none \/ embedding index contract evidence fingerprints none \/ rerank runtime contract evidence fingerprints none \/ task route source fingerprints none \/ fingerprint 1111222233334444 \/ operation fingerprint 1111aaaa2222bbbb \/ target locator fingerprint aaaa1111bbbb2222 \/ required capabilities model_registry\.read, provider_route\.preview \/ input schema required diagnosticsFingerprint, targetLocator/
    );
    expect(readyGateDiagnostics).toMatch(
      /Repair action preview operation Read Only Probe \/ action kind Check Action Provider Health .* candidate evidence 0 \/ candidate evidence fingerprint [0-9a-f]{16} \/ candidate evidence fingerprints none \/ candidate evidence keys none \/ prepared route order fingerprints none \/ embedding index contract evidence fingerprints none \/ rerank runtime contract evidence fingerprints none \/ task route source fingerprints none \/ fingerprint 4444555566667777 \/ operation fingerprint 4444dddd5555eeee \/ target locator fingerprint dddd4444eeee5555 \/ required capabilities provider_profile\.read, provider_health\.probe \/ input schema required diagnosticsFingerprint, targetLocator/
    );
    expect(readyGateDiagnostics).toContain(
      'Repair action catalog entry action catalog repair-actions/v1 / action kind Check Provider Health / safety Read Only Probe / recommendations 1 / required capabilities provider_profile.read, provider_health.probe / input schema required diagnosticsFingerprint, targetLocator'
    );
    expect(readyGateDiagnostics).toContain(
      'Repair action catalog entry action catalog repair-actions/v1 / action kind Repair Task Model Route / safety Preview Required / recommendations 1 / required capabilities task_route.read, model_registry.read, provider_route.preview / input schema required diagnosticsFingerprint, targetLocator'
    );
    expect(readyGateDiagnostics).toContain('Repair recommendations 4');
    expect(readyGateDiagnostics).toContain(
      'Repair recommendation Warning / Model Route / optional_model_route_unavailable / Review non-default model route / copilot.prompts.overrides[].optionalModels / instance chat:text:optional:0:openai-fallback/missing-object / fingerprint 1111222233334444 / action catalog repair-actions/v1 / input schema required diagnosticsFingerprint, targetLocator / action kind Review Non Default Model Route / action safety Preview Required / required capabilities model_registry.read, provider_route.preview'
    );
    expect(readyGateDiagnostics).toContain(
      'locator model_route / copilot.prompts.overrides[].optionalModels / registry 42 / fingerprint b1c2d3e4f5061728 / updated 2026-06-17T04:05:06.000Z / feature Chat / output Text / candidate Optional#0 / requested openai-fallback/missing-object / profile Profile openai-fallback / Configured / config copilot.providers.profiles[id=openai-fallback]'
    );
    expect(readyGateDiagnostics).toContain(
      'evidence candidate:optional#0, requestedModelId:openai-fallback/missing-object'
    );
    expect(readyGateDiagnostics).toContain(
      'diagnosticsStage:describe_route_candidates, diagnosticsCode:RouteDiagnosticsFailure'
    );
    expect(readyGateDiagnostics).toContain(
      'Repair recommendation Warning / Task Route / workspace_indexing_task_route_unavailable / Repair task model route / copilot.tasks.models.workspaceIndexing / instance workspace_indexing:workspaceIndexing:workspace-embedding:unavailable / fingerprint 3333444455556666 / action catalog repair-actions/v1 / input schema required diagnosticsFingerprint, targetLocator / action kind Repair Task Model Route / action safety Preview Required / required capabilities task_route.read, model_registry.read, provider_route.preview'
    );
    expect(
      screen.getByText(
        /Repair action preview operation Preview Required \/ action kind Repair Task Model Route .* candidate evidence 3 \/ candidate evidence fingerprint [0-9a-f]{16} \/ candidate evidence fingerprints [0-9a-f]{16}, [0-9a-f]{16}, [0-9a-f]{16} \/ candidate evidence keys policy:workspace_indexing:global:ollama-main, prepare:ollama-main, route:ollama-main \/ prepared route order fingerprints [0-9a-f]{16} \/ embedding index contract evidence fingerprints [0-9a-f]{16} \/ rerank runtime contract evidence fingerprints none \/ task route source fingerprints blocked1111222233/
      )
    ).not.toBeNull();
    expect(readyGateDiagnostics).toContain(
      'locator task_route / copilot.tasks.models.workspaceIndexing / registry 42 / fingerprint b1c2d3e4f5061728 / updated 2026-06-17T04:05:06.000Z / feature Workspace indexing / requested workspace-embedding / config key workspaceIndexing / config path copilot.tasks.models.workspaceIndexing'
    );
    expect(readyGateDiagnostics).toContain(
      'policyCandidate#0:providerProfileId:ollama-main, policyCandidate#0:providerProfileConfigPath:copilot.providers.profiles[id=ollama-main]'
    );
    expect(readyGateDiagnostics).toContain(
      'routeCandidate#0:providerConfiguredModel:workspace-embedding, prepareCandidate#0:preparedModelId:nomic-embed-text'
    );
    expect(readyGateDiagnostics).toContain(
      'candidate evidence Policy Candidate #0 / fingerprint '
    );
    expect(readyGateDiagnostics).toContain(
      `key policy:workspace_indexing:global:ollama-main / provider ollama-main`
    );
    expect(readyGateDiagnostics).toContain(
      'requested source Workspace indexing task model / requested config key workspaceIndexing / requested config path copilot.tasks.models.workspaceIndexing'
    );
    expect(readyGateDiagnostics).toContain(
      `targets ${blockedRoute.preparedRouteTargets.join(', ')}`
    );
    expect(readyGateDiagnostics).toContain(
      `target fingerprint ${blockedRoute.preparedRouteTargetFingerprint}`
    );
    expect(readyGateDiagnostics).toContain(
      `fallback ${blockedRoute.fallbackProviderIds.join(' -> ')}`
    );
    expect(readyGateDiagnostics).toContain(
      `route phases ${blockedRoute.routeTrace.map(phase => phase.phase).join(' -> ')}`
    );
    expect(readyGateDiagnostics).toContain(
      `route trace snapshot fingerprint ${taskRouteSnapshotFingerprintFixture(blockedRoute.routeTrace)}`
    );
    expect(readyGateDiagnostics).toContain(
      'route trace policy / candidates 1 / available 1 / blocked 0 / matched 1 / selected 1 / prepared 0 / reasons Candidate Allowed'
    );
    expect(readyGateDiagnostics).toContain(
      `policy snapshot fingerprint ${taskRouteSnapshotFingerprintFixture(blockedRoute.policyCandidates)}`
    );
    expect(readyGateDiagnostics).toContain(
      'policy candidates Local Ollama / ollama-main / type OpenAI-compatible / source BYOK local'
    );
    expect(readyGateDiagnostics).toContain(
      `route snapshot fingerprint ${taskRouteSnapshotFingerprintFixture(blockedRoute.routeCandidates)}`
    );
    expect(readyGateDiagnostics).toContain(
      `prepare snapshot fingerprint ${taskRouteSnapshotFingerprintFixture(taskRoutePrepareCandidateSnapshotFixture(blockedRoute.prepareCandidates))}`
    );
    expect(readyGateDiagnostics).toContain(
      `prepared route snapshot fingerprint ${taskRouteSnapshotFingerprintFixture(taskRoutePreparedRouteSnapshotFixture(blockedRoute.preparedRoutes))}`
    );
    expect(readyGateDiagnostics).toContain(
      `prepared route order fingerprint ${taskRouteSnapshotFingerprintFixture(taskRoutePreparedRouteOrderSnapshotFixture(blockedRoute.preparedRoutes))}`
    );
    expect(readyGateDiagnostics).toContain(
      `prepared routes ${blockedRoute.preparedRoutes.length}`
    );
    expect(readyGateDiagnostics).toContain(
      `provider capability snapshot fingerprint ${taskRouteSnapshotFingerprintFixture(taskRouteProviderCapabilitySnapshotFixture(blockedRoute))}`
    );
    expect(readyGateDiagnostics).toContain(
      `provider cost snapshot fingerprint ${taskRouteSnapshotFingerprintFixture(taskRouteProviderCostSnapshotFixture(blockedRoute))}`
    );
    expect(readyGateDiagnostics).toContain(
      `provider limit snapshot fingerprint ${taskRouteSnapshotFingerprintFixture(taskRouteProviderLimitSnapshotFixture(blockedRoute))}`
    );
    expect(readyGateDiagnostics).toContain(
      `task route dimension snapshot fingerprint ${taskRouteSnapshotFingerprintFixture(taskRouteDimensionSnapshotFixture(blockedRoute))}`
    );
    expect(readyGateDiagnostics).toContain(
      `task route embedding index contract snapshot fingerprint ${taskRouteSnapshotFingerprintFixture(taskRouteEmbeddingIndexContractSnapshotFixture(blockedRoute))}`
    );
    expect(readyGateDiagnostics).toContain(
      `task route source fingerprint ${blockedRoute.effectiveSourceFingerprint}`
    );
    expect(readyGateDiagnostics).toContain(
      `task route source version ${taskRouteEffectiveSourceFingerprintVersionFixture}`
    );
    expect(readyGateDiagnostics).toContain(
      `task route source inputs ${taskRouteEffectiveSourceFingerprintInputsFixture.join(', ')}`
    );
    expect(readyGateDiagnostics).toContain(
      `embedding index contract ${blockedRoute.embeddingIndexContractVersion} / embedding index dimensions ${blockedRoute.embeddingIndexContractDimensions}d / embedding index status Compatible With Current Pgvector Index / embedding index fingerprint ${blockedRoute.embeddingIndexContractFingerprint}`
    );
    expect(readyGateDiagnostics).toContain(
      `requested ${blockedRoute.requestedDimensions}d / dimension mismatch no`
    );
    expect(readyGateDiagnostics).toContain(
      `task route model source snapshot fingerprint ${taskRouteSnapshotFingerprintFixture(taskRouteModelSourceSnapshotFixture(blockedRoute))}`
    );
    expect(readyGateDiagnostics).toContain(
      `provider health snapshot fingerprint ${taskRouteSnapshotFingerprintFixture(taskRouteProviderHealthSnapshotFixture(blockedRoute))}`
    );
    expect(readyGateDiagnostics).toContain(
      `diagnostics error snapshot fingerprint ${taskRouteSnapshotFingerprintFixture(blockedRoute.diagnosticsErrors)}`
    );
    expect(readyGateDiagnostics).toContain(
      'diagnostics errors stage Describe Embedding Prepare Candidates / code EmbeddingPrepareDiagnosticsFailure / message embedding prepare diagnostics unavailable'
    );
    expect(readyGateDiagnostics).toContain(
      'provider ollama-main / allowed yes / available no / name Local Ollama / source Configured / type Openai Compatible / priority 10 / profile ollama-main / profile source Configured / profile path copilot.providers.profiles[id=ollama-main] / configured models 1 / configured model ids workspace-embedding'
    );
    expect(readyGateDiagnostics).toContain(
      'Policy Candidate #0 / fingerprint '
    );
    expect(readyGateDiagnostics).toContain(
      'provider ollama-main / allowed yes / available no'
    );
    expect(readyGateDiagnostics).toContain('Route Candidate #0 / fingerprint ');
    expect(readyGateDiagnostics).toContain(
      'key route:ollama-main / provider ollama-main / matched no'
    );
    expect(readyGateDiagnostics).toContain(
      'registry byok / registry available yes / registry selected no'
    );
    expect(readyGateDiagnostics).toContain(
      'privacy Local / health Down / checked 2026-06-16T10:00:00.000Z'
    );
    expect(readyGateDiagnostics).toContain(
      'definition source Provider Profile / definition workspace-embedding / definition aliases nomic-embed-text / alias matched no / raw model nomic-embed-text'
    );
    expect(readyGateDiagnostics).toContain(
      'input text / output embedding / attachments file / attachment sources url, data / remote attachments yes / structured attachments image / structured attachment sources file_handle / structured remote attachments no / context 8192 / max output 1024 / embedding 768 / input cost 0.01/1M / output cost 0.02/1M'
    );
    expect(readyGateDiagnostics).toContain(
      'capability input text / output embedding / attachments file / attachment sources url, data / remote attachments yes / structured attachments image / structured attachment sources file_handle / structured remote attachments no'
    );
    expect(readyGateDiagnostics).toContain(
      'limits context 8192 / output 1024 / embedding 768'
    );
    expect(readyGateDiagnostics).toContain(
      'Prepare Candidate #0 / fingerprint '
    );
    expect(readyGateDiagnostics).toContain(
      `key prepare:ollama-main / provider ollama-main / prepared no / name Local Ollama / source Configured / type Openai Compatible / priority 10 / profile ollama-main / profile source Configured / profile path copilot.providers.profiles[id=ollama-main] / configured models 1 / configured model ids workspace-embedding / requested workspace-embedding / requested source Workspace indexing task model / requested config key workspaceIndexing / requested config path copilot.tasks.models.workspaceIndexing / requested 4096d / dimension mismatch no / embedding index contract ${blockedRoute.embeddingIndexContractVersion} / embedding index dimensions ${blockedRoute.embeddingIndexContractDimensions}d / embedding index status Compatible With Current Pgvector Index / embedding index fingerprint ${blockedRoute.embeddingIndexContractFingerprint} / input text / output embedding / attachments file / attachment sources url / remote attachments yes / structured attachments image / structured attachment sources file_handle / structured remote attachments no / context 8192 / max output 1024 / embedding 768 / input cost 0.01/1M / output cost 0.02/1M / model workspace-embedding / prepared nomic-embed-text`
    );
    expect(readyGateDiagnostics).toContain(
      'prepared nomic-embed-text / privacy Local / health Down / checked 2026-06-16T10:00:00.000Z / code prepare_failed / category Network / registry byok / registry available yes / registry selected no'
    );
    expect(readyGateDiagnostics).toContain(
      'prepared nomic-embed-text / privacy Local / health Down / checked 2026-06-16T10:00:00.000Z / code prepare_failed / category Network'
    );
    expect(readyGateDiagnostics).toContain(
      'capability input text / output embedding / attachments file / attachment sources url / remote attachments yes'
    );
    expect(readyGateDiagnostics).toContain(
      'limits context 8192 / output 1024 / embedding 768'
    );
    expect(readyGateDiagnostics).toContain(
      'Repair recommendation Warning / Action Route / action_generate_provider_health_not_healthy / Check action provider health / ai_prompts_metadata.action.make-it-real / instance make-it-real:generate:openai-fallback:0 / fingerprint 4444555566667777 / action catalog repair-actions/v1 / input schema required diagnosticsFingerprint, targetLocator / action kind Check Action Provider Health / action safety Read Only Probe / required capabilities provider_profile.read, provider_health.probe'
    );
    expect(readyGateDiagnostics).toContain(
      'locator action_route / ai_prompts_metadata.action.make-it-real / registry 42 / fingerprint b1c2d3e4f5061728 / updated 2026-06-17T04:05:06.000Z / feature Action / requested office-structured / provider openai-fallback / profile Profile openai-fallback / Configured / config copilot.providers.profiles[id=openai-fallback] / action make-it-real / step generate / route #1 / fallback #1 / status Succeeded'
    );
    expect(readyGateDiagnostics).toContain(
      'providerId:openai-fallback, routeIndex:0, fallbackOrderIndex:0, health:degraded, checkedAt:2026-06-17T09:00:00.000Z'
    );
    expect(screen.getByText('Prompt registry publish gate')).not.toBeNull();
    expect(screen.getAllByText('Allowed').length).toBeGreaterThan(0);
    expect(screen.getByText('Default model route')).not.toBeNull();
    expect(screen.getByText('Model route candidates')).not.toBeNull();
    expect(screen.getByText('Task route evidence')).not.toBeNull();
    expect(screen.getByText('Action route dry-run evidence')).not.toBeNull();
    expect(screen.getByText('Repair recommendations')).not.toBeNull();
    expect(
      screen.getByText(
        /Recommendation Warning \/ Action Route \/ action_generate_provider_health_not_healthy/
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        /Recommendation Warning \/ Model Route \/ optional_model_route_unavailable/
      )
    ).not.toBeNull();
    expect(
      screen.getAllByText(
        /candidate evidence Policy Candidate #0 \/ fingerprint [0-9a-f]{16} \/ key policy:workspace_indexing:global:ollama-main \/ provider ollama-main/
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'status Succeeded / feature Action / action make-it-real / steps 1 / routes 1/1'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        /Step generate \/ kind Structured \/ routes 1\/1 \/ requested office-structured/
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        /Route openai-fallback\/gpt-4o-mini \/ route #1 \/ fallback #1/
      )
    ).not.toBeNull();
    expect(
      screen.getAllByText(/Task route Workspace indexing \/ status Blocked/)
        .length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Task route Rerank \/ status Ready/).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /Candidate OpenAI Secondary \/ openai-secondary \/ model gpt-4o-mini/
      )
    ).not.toBeNull();
    expect(
      screen.getAllByText(
        /Policy candidate OpenAI Secondary \/ openai-secondary \/ type OpenAI/
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /Phase policy \/ candidates 2 \/ available 2 \/ blocked 1 \/ selected 1/
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /Phase resolution \/ candidates 2 \/ available 2 \/ matched 0 \/ selected 0/
      )
    ).not.toBeNull();
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'anthropic-main / claude-3-5-sonnet-latest / profile anthropic-main / requested claude-3-5-sonnet-latest'
      )
    ).not.toBeNull();
    expect(
      screen.getByText('Config copilot.providers.profiles[id=anthropic-main]')
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Reasons Model Route Available, Capability Matched, Registry Selected'
      )
    ).not.toBeNull();

    fireEvent.change(screen.getByLabelText('Workspace ID'), {
      target: {
        value: 'workspace-1',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));

    const failedDryRunDiagnostics = screen.getByTestId(
      'prompt-registry-publish-gate-Make it real'
    ).textContent;
    expect(failedDryRunDiagnostics).toContain(
      'Action route dry-run status Failed / feature Action / action make-it-real / steps 0 / routes 0/0 / diagnostics stage Build Structured Plan / diagnostics code StructuredDryRunFailure / diagnostics message structured dry-run unavailable / error StructuredDryRunFailure / message structured dry-run unavailable'
    );
    expect(failedDryRunDiagnostics).toContain(
      'Repair action catalog fingerprint ccccbbbbaaaadddd'
    );
    expect(failedDryRunDiagnostics).toContain(
      'Repair action mutation guard required yes / fingerprint 3333aaaabbbbcccc / audit fingerprint ccccdddd33334444 / audit summary registry:42 | registryFingerprint:b1c2d3e4f5061728 | catalog:repair-actions/v1 | catalogFingerprint:ccccbbbbaaaadddd | recommendations:5 | intent:fed333cba4445555 | targetLocators:5 | targetKinds:action_route,model_route,task_route | reviewModes:dry_run,preview,probe | safety:dry_run_required,preview_required,read_only_probe / catalog repair-actions/v1 / catalog fingerprint ccccbbbbaaaadddd / intent fingerprint fed333cba4445555 / input schema fingerprint ccc333ddd444eeee / target locator fingerprint fff333aaa444bbbb / target locators 5 / target locator kinds Action Route, Model Route, Task Route / expected registry 42 / expected fingerprint b1c2d3e4f5061728 / expected updated 2026-06-17T04:05:06.000Z / recommendations 5 / recommendation categories Action Route, Model Route, Task Route / recommendation codes action_generate_provider_health_not_healthy, action_route_dry_run_failed, optional_model_route_unavailable, selected_provider_health_not_healthy, workspace_indexing_task_route_unavailable / suggested actions Check Action Provider Health, Check Provider Health, Repair Task Model Route, Review Action Route Dry Run, Review Non Default Model Route / required capabilities action_route.read, model_registry.read, provider_health.probe, provider_profile.read, provider_route.preview, task_route.read / review modes Dry Run, Preview, Probe / safety levels Dry Run Required, Preview Required, Read Only Probe / recommendation fingerprints 1111222233334444, 2222333344445555, 3333444455556666, 4444555566667777, 777788889999aaaa'
    );
    expect(failedDryRunDiagnostics).toContain(
      'Repair action preview status Dry Run Required / read-only yes / fingerprint 7777aaaabbbbcccc'
    );
    expect(failedDryRunDiagnostics).toContain(
      'candidate evidence set fingerprint cccc7777dddd8888 / task route source evidence set fingerprint cccc7878dddd8989 / task route source evidence set version copilot-task-route-effective-source-evidence-set/v1 / task route source evidence set inputs diagnosticsFingerprint, operationFingerprint, taskRouteEffectiveSourceFingerprints / embedding index contract evidence set fingerprint cccc8888dddd9999 / rerank runtime contract evidence set fingerprint cccc0000dddd1111 / prepared route order evidence set fingerprint cccc9999dddd0000'
    );
    expect(failedDryRunDiagnostics).toContain(
      'expected candidate evidence set fingerprint cccc7777dddd8888 / expected task route source evidence set fingerprint cccc7878dddd8989 / expected task route source evidence set version copilot-task-route-effective-source-evidence-set/v1 / expected task route source evidence set inputs diagnosticsFingerprint, operationFingerprint, taskRouteEffectiveSourceFingerprints / expected embedding index contract evidence set fingerprint cccc8888dddd9999 / expected rerank runtime contract evidence set fingerprint cccc0000dddd1111 / expected prepared route order evidence set fingerprint cccc9999dddd0000'
    );
    expect(failedDryRunDiagnostics).toMatch(
      /Repair action preview operation Dry Run Required \/ action kind Review Action Route Dry Run .* candidate evidence 0 \/ candidate evidence fingerprint [0-9a-f]{16} \/ candidate evidence fingerprints none \/ candidate evidence keys none \/ prepared route order fingerprints none \/ embedding index contract evidence fingerprints none \/ rerank runtime contract evidence fingerprints none \/ task route source fingerprints none \/ fingerprint 777788889999aaaa \/ operation fingerprint 7777aaaa8888bbbb \/ target locator fingerprint aaaa7777bbbb8888 \/ required capabilities action_route\.read, action_route\.dry_run \/ input schema required diagnosticsFingerprint, targetLocator/
    );
    expect(failedDryRunDiagnostics).toContain(
      'Repair recommendation Warning / Action Route / action_route_dry_run_failed / Review action route dry-run / ai_prompts_metadata.action.make-it-real / instance make-it-real:dry-run:failed'
    );
    expect(failedDryRunDiagnostics).toContain(
      'diagnosticsStage:build_structured_plan, diagnosticsCode:StructuredDryRunFailure, diagnosticsMessage:structured dry-run unavailable'
    );
    expect(
      screen.getAllByText(
        /status Failed \/ feature Action \/ action make-it-real \/ steps 0 \/ routes 0\/0 \/ diagnostics stage Build Structured Plan/
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /Recommendation Warning \/ Action Route \/ action_route_dry_run_failed/
      )
    ).not.toBeNull();

    fireEvent.change(screen.getByLabelText('Prompt name'), {
      target: {
        value: 'Manual prompt',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));

    await waitFor(() => {
      expectQueryCall(getPromptModelsQuery, {
        promptName: 'Manual prompt',
        workspaceId: 'workspace-1',
      });
    });
    expect(
      screen.getByText(
        'Prompt metadata is not available for the submitted prompt name.'
      )
    ).not.toBeNull();
  });

  test('shows rerank runtime contract in repair candidate evidence', async () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Prompt name'), {
      target: {
        value: 'Make it real',
      },
    });
    fireEvent.change(screen.getByLabelText('Workspace ID'), {
      target: {
        value: 'rerank-workspace',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));

    await waitFor(() => {
      expectQueryCall(getCopilotPromptRegistryPublishGateQuery, {
        expectedVersion: {
          registryFingerprint: 'b1c2d3e4f5061728',
          registryId: 42,
          registryUpdatedAt: '2026-06-17T04:05:06.000Z',
        },
        name: 'Make it real',
        workspaceId: 'rerank-workspace',
      });
    });

    const diagnostics = screen.getByTestId(
      'prompt-registry-publish-gate-Make it real'
    ).textContent;
    expect(diagnostics).toContain(
      'Repair recommendation Warning / Task Route / rerank_task_route_unavailable / Repair rerank task route / copilot.tasks.models.rerank'
    );
    expect(diagnostics).toContain(
      'rerank runtime contract workspace-rerank-runtime/v1 / rerank runtime topK 5 / rerank runtime status Prepared Route Available / rerank runtime fingerprint eeee2222ffff3333'
    );
    expect(diagnostics).toContain(
      `task route rerank runtime contract snapshot fingerprint ${readyRouteRerankRuntimeContractSnapshotFingerprint}`
    );
    expect(diagnostics).toContain(
      `task route source fingerprint ${readyRoute.effectiveSourceFingerprint}`
    );
    expect(diagnostics).toContain(
      `task route source version ${taskRouteEffectiveSourceFingerprintVersionFixture}`
    );
    expect(diagnostics).toContain(
      `task route source inputs ${taskRouteEffectiveSourceFingerprintInputsFixture.join(', ')}`
    );
    expect(diagnostics).toContain(
      `task route source fingerprints ${readyRoute.effectiveSourceFingerprint}`
    );
    expect(diagnostics).toContain(
      'policyCandidate#0:rerankRuntimeContractVersion:workspace-rerank-runtime/v1'
    );
    expect(diagnostics).toMatch(
      /candidate evidence Policy Candidate #0 \/ fingerprint [0-9a-f]{16} \/ key policy:rerank:global:ollama-main \/ provider ollama-main/
    );
    expect(diagnostics).toContain(
      'prepared route ollama-main/bge-reranker-v2 / route #1 / fallback #1 / protocol openai-compatible / layer chat / backend rerank'
    );
  });

  test('filters prompt catalog options by search', () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'make',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Prompt catalog' }),
      {
        key: 'ArrowDown',
      }
    );

    expect(screen.getByRole('option', { name: 'Make it real' })).not.toBeNull();
    expect(screen.queryByRole('option', { name: 'LocalMind AI' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Generate image' })).toBeNull();
    expect(
      screen.queryByRole('option', { name: 'Legacy empty registry prompt' })
    ).toBeNull();
  });

  test('filters prompt catalog options by provenance metadata', () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'defaults.image',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Prompt catalog' }),
      {
        key: 'ArrowDown',
      }
    );

    expect(
      screen.getByRole('option', { name: 'Generate image' })
    ).not.toBeNull();
    expect(screen.queryByRole('option', { name: 'LocalMind AI' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Make it real' })).toBeNull();
    expect(
      screen.queryByRole('option', { name: 'Legacy empty registry prompt' })
    ).toBeNull();
  });

  test('filters prompt catalog options by revision metadata', () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'c1d2e3f405162738',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Prompt catalog' }),
      {
        key: 'ArrowDown',
      }
    );

    expect(
      screen.getByRole('option', { name: 'Generate image' })
    ).not.toBeNull();
    expect(screen.queryByRole('option', { name: 'LocalMind AI' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Make it real' })).toBeNull();
    expect(
      screen.queryByRole('option', { name: 'Legacy empty registry prompt' })
    ).toBeNull();
  });

  test('filters prompt catalog options by model strategy fingerprint', () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: '7777aaaabbbbcccc',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Prompt catalog' }),
      {
        key: 'ArrowDown',
      }
    );

    expect(
      screen.getByRole('option', { name: 'Generate image' })
    ).not.toBeNull();
    expect(screen.queryByRole('option', { name: 'LocalMind AI' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Make it real' })).toBeNull();
    expect(
      screen.queryByRole('option', { name: 'Legacy empty registry prompt' })
    ).toBeNull();
  });

  test('filters prompt catalog options by version evidence bundle', () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value:
          'policy Image / override no / model config copilot.prompts.defaults.image.model',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Prompt catalog' }),
      {
        key: 'ArrowDown',
      }
    );

    expect(
      screen.getByRole('option', { name: 'Generate image' })
    ).not.toBeNull();
    expect(screen.queryByRole('option', { name: 'LocalMind AI' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Make it real' })).toBeNull();
    expect(
      screen.queryByRole('option', { name: 'Legacy empty registry prompt' })
    ).toBeNull();
  });

  test('filters prompt catalog options by registry evidence', () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'registry id 42 / registry messages 2',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Prompt catalog' }),
      {
        key: 'ArrowDown',
      }
    );

    expect(screen.getByRole('option', { name: 'Make it real' })).not.toBeNull();
    expect(screen.queryByRole('option', { name: 'LocalMind AI' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Generate image' })).toBeNull();
    expect(
      screen.queryByRole('option', { name: 'Legacy empty registry prompt' })
    ).toBeNull();
  });

  test('filters prompt catalog options by DB-backed registry revision', () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'registry source DB revision / registry revision workspace-r2',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Prompt catalog' }),
      {
        key: 'ArrowDown',
      }
    );

    expect(screen.getByRole('option', { name: 'Make it real' })).not.toBeNull();
    expect(screen.queryByRole('option', { name: 'LocalMind AI' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Generate image' })).toBeNull();
    expect(
      screen.queryByRole('option', { name: 'Legacy empty registry prompt' })
    ).toBeNull();
  });

  test('filters prompt catalog options by category', () => {
    renderAiPage();

    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Prompt category' }),
      {
        key: 'ArrowDown',
      }
    );
    fireEvent.click(screen.getByRole('option', { name: 'Image' }));
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Prompt catalog' }),
      {
        key: 'ArrowDown',
      }
    );

    expect(
      screen.getByRole('option', { name: 'Generate image' })
    ).not.toBeNull();
    expect(screen.queryByRole('option', { name: 'LocalMind AI' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Make it real' })).toBeNull();
    expect(
      screen.queryByRole('option', { name: 'Legacy empty registry prompt' })
    ).toBeNull();
  });

  test('shows ignored registry seed validation diagnostics', () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'messages:empty',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'registry issue error',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'registry errors 3',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'registry blocking 3',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'registry publish Blocked',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'ai_prompts_messages[0].content',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'template.topic:missing_param',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'Remediation declare_template_param',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'ai_prompts_messages content message[0].content',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'registry 84',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'fingerprint feedfacecafebeef',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'blocking yes',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'updated 2026-06-17T05:06:07.000Z',
      },
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();

    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Prompt catalog' }),
      {
        key: 'ArrowDown',
      }
    );
    fireEvent.click(
      screen.getByRole('option', { name: 'Legacy empty registry prompt' })
    );

    expect(
      (screen.getByLabelText('Prompt name') as HTMLInputElement).value
    ).toBe('Legacy empty registry prompt');
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));

    const diagnostics = screen.getByTestId(
      'prompt-catalog-diagnostics-Legacy empty registry prompt'
    ).textContent;
    expect(diagnostics).toContain('Registry id 84');
    expect(diagnostics).toContain('Registry messages 0');
    expect(diagnostics).toContain('Registry modified no');
    expect(diagnostics).toContain('Registry status Ignored');
    expect(diagnostics).toContain('Registry reason Missing Messages');
    expect(diagnostics).toContain('Registry detail messages:empty');
    expect(diagnostics).toContain('Registry publish Blocked');
    expect(diagnostics).toContain('Registry blocking 3');
    expect(diagnostics).toContain('Registry issues 3');
    expect(diagnostics).toContain('Registry errors 3');
    expect(diagnostics).toContain(
      'Registry issue error / missing_messages / Messages / messages / empty / ai_prompts_messages / registry 84 / fingerprint feedfacecafebeef / updated 2026-06-17T05:06:07.000Z / ai_prompts_messages / messages / messages / blocking yes / messages:empty'
    );
    expect(diagnostics).toContain(
      'Registry issue error / invalid_message / Message 0 Content / message[0].content / invalid_type / ai_prompts_messages[0].content / registry 84 / fingerprint feedfacecafebeef / updated 2026-06-17T05:06:07.000Z / ai_prompts_messages / content / message[0].content / message 0 / blocking yes / message[0].content:invalid_type'
    );
    expect(diagnostics).toContain(
      'Registry issue error / missing_template_param / Template Param / message[0].params.topic / missing / ai_prompts_messages[0].params.topic / registry 84 / fingerprint feedfacecafebeef / updated 2026-06-17T05:06:07.000Z / ai_prompts_messages / params.topic / message[0].params.topic / message 0 / blocking yes / template.topic:missing_param'
    );
    expect(diagnostics).toContain(
      'Registry remediation add_messages / Add prompt messages / ai_prompts_messages / registry 84 / fingerprint feedfacecafebeef / updated 2026-06-17T05:06:07.000Z / ai_prompts_messages / messages / messages / Create at least one valid prompt message for this registry seed.'
    );
    expect(diagnostics).toContain(
      'Registry remediation declare_template_param / Declare template params / ai_prompts_messages.params / registry 84 / fingerprint feedfacecafebeef / updated 2026-06-17T05:06:07.000Z / ai_prompts_messages / params / messages.params / Declare default values for every prompt template variable in ai_prompts_messages.params.'
    );
    expect(screen.getByText('Status Ignored')).not.toBeNull();
    expect(screen.getByText('Reason Missing Messages')).not.toBeNull();
    expect(screen.getByText('Detail messages:empty')).not.toBeNull();
    expect(screen.getAllByText('Publish Blocked').length).toBeGreaterThan(0);
    expect(screen.getByText('Blocking 3')).not.toBeNull();
    expect(screen.getByText('Issues 3')).not.toBeNull();
    expect(screen.getByText('Errors 3')).not.toBeNull();
    expect(
      screen.getAllByText(
        'Issue error / missing_messages / Messages / messages / empty / ai_prompts_messages / registry 84 / fingerprint feedfacecafebeef / updated 2026-06-17T05:06:07.000Z / ai_prompts_messages / messages / messages / blocking yes / messages:empty'
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        'Issue error / invalid_message / Message 0 Content / message[0].content / invalid_type / ai_prompts_messages[0].content / registry 84 / fingerprint feedfacecafebeef / updated 2026-06-17T05:06:07.000Z / ai_prompts_messages / content / message[0].content / message 0 / blocking yes / message[0].content:invalid_type'
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        'Issue error / missing_template_param / Template Param / message[0].params.topic / missing / ai_prompts_messages[0].params.topic / registry 84 / fingerprint feedfacecafebeef / updated 2026-06-17T05:06:07.000Z / ai_prompts_messages / params.topic / message[0].params.topic / message 0 / blocking yes / template.topic:missing_param'
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        'Remediation add_messages / Add prompt messages / ai_prompts_messages / registry 84 / fingerprint feedfacecafebeef / updated 2026-06-17T05:06:07.000Z / ai_prompts_messages / messages / messages / Create at least one valid prompt message for this registry seed.'
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        'Remediation declare_template_param / Declare template params / ai_prompts_messages.params / registry 84 / fingerprint feedfacecafebeef / updated 2026-06-17T05:06:07.000Z / ai_prompts_messages / params / messages.params / Declare default values for every prompt template variable in ai_prompts_messages.params.'
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByText('Messages 0')).not.toBeNull();
    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: getCopilotPromptRegistryPublishGateQuery,
        variables: {
          expectedVersion: {
            registryFingerprint: 'feedfacecafebeef',
            registryId: 84,
            registryUpdatedAt: '2026-06-17T05:06:07.000Z',
          },
          name: 'Legacy empty registry prompt',
          workspaceId: undefined,
        },
      })
    );
    const blockedGateDiagnostics = screen.getByTestId(
      'prompt-registry-publish-gate-Legacy empty registry prompt'
    ).textContent;
    expect(blockedGateDiagnostics).toContain(
      'Prompt Legacy empty registry prompt'
    );
    expect(blockedGateDiagnostics).toContain('Gate Blocked');
    expect(blockedGateDiagnostics).toContain('Status Ignored');
    expect(blockedGateDiagnostics).toContain('Publish Blocked');
    expect(blockedGateDiagnostics).toContain('Reason Missing Messages');
    expect(blockedGateDiagnostics).toContain('Registry id 84');
    expect(blockedGateDiagnostics).toContain(
      'Expected registry fingerprint feedfacecafebeef'
    );
    expect(blockedGateDiagnostics).toContain('Blocking 3');
    expect(blockedGateDiagnostics).toContain('Model route not checked');
    expect(blockedGateDiagnostics).toContain(
      'Issue error / missing_messages / Messages / messages / empty / ai_prompts_messages / registry 84 / fingerprint feedfacecafebeef / updated 2026-06-17T05:06:07.000Z / ai_prompts_messages / messages / messages / blocking yes / messages:empty'
    );
    expect(blockedGateDiagnostics).toContain(
      'Issue error / missing_template_param / Template Param / message[0].params.topic / missing / ai_prompts_messages[0].params.topic / registry 84 / fingerprint feedfacecafebeef / updated 2026-06-17T05:06:07.000Z / ai_prompts_messages / params.topic / message[0].params.topic / message 0 / blocking yes / template.topic:missing_param'
    );
    expect(blockedGateDiagnostics).toContain(
      'Remediation add_messages / Add prompt messages / ai_prompts_messages / registry 84 / fingerprint feedfacecafebeef / updated 2026-06-17T05:06:07.000Z / ai_prompts_messages / messages / messages / Create at least one valid prompt message for this registry seed.'
    );
    expect(blockedGateDiagnostics).toContain(
      'Remediation declare_template_param / Declare template params / ai_prompts_messages.params / registry 84 / fingerprint feedfacecafebeef / updated 2026-06-17T05:06:07.000Z / ai_prompts_messages / params / messages.params / Declare default values for every prompt template variable in ai_prompts_messages.params.'
    );
    expect(blockedGateDiagnostics).toContain('Repair action catalog 2');
    expect(blockedGateDiagnostics).toContain(
      'Repair action catalog fingerprint bbbbaaaaccccdddd'
    );
    expect(blockedGateDiagnostics).toContain(
      'Repair action mutation guard required yes / fingerprint 2222aaaabbbbcccc / audit fingerprint bbbbcccc22223333 / audit summary registry:84 | registryFingerprint:feedfacecafebeef | catalog:repair-actions/v1 | catalogFingerprint:bbbbaaaaccccdddd | recommendations:2 | intent:def222abc3334444 | targetLocators:2 | targetKinds:prompt_registry | reviewModes:preview | safety:preview_required / catalog repair-actions/v1 / catalog fingerprint bbbbaaaaccccdddd / intent fingerprint def222abc3334444 / input schema fingerprint bbb222ccc333dddd / target locator fingerprint eee222fff333aaaa / target locators 2 / target locator kinds Prompt Registry / expected registry 84 / expected fingerprint feedfacecafebeef / expected updated 2026-06-17T05:06:07.000Z / recommendations 2 / recommendation categories Prompt Registry / recommendation codes registry_add_messages, registry_declare_template_param / suggested actions Registry Add Messages, Registry Declare Template Param / required capabilities prompt_registry.preview_write, prompt_registry.read / review modes Preview / safety levels Preview Required / recommendation fingerprints 5555666677778888, 6666777788889999'
    );
    expect(blockedGateDiagnostics).toContain(
      'Repair action preview status Preview Required / read-only yes / fingerprint 8888aaaabbbbcccc'
    );
    expect(blockedGateDiagnostics).toContain(
      `Repair gate manifest prompt-registry-repair-gate-manifest/v1 / fingerprint ${blockedPublishGateVerdict.repairGateManifest.fingerprint} / boundary repair_gate_manifest_only_no_prompt_or_provider_payload / registry 84 / registry fingerprint feedfacecafebeef / registry updated 2026-06-17T05:06:07.000Z / gate Ignored / publish Blocked / reason Missing Messages / issues 3 / blocking 3 / recommendations 2 / operations 2`
    );
    expect(blockedGateDiagnostics).toContain(
      `Repair gate manifest export metadata prompt-registry-repair-gate-manifest-export-metadata/v1 / artifact prompt_registry_repair_gate_manifest_json / filename prompt-registry-repair-gate-manifest-84-${blockedPublishGateVerdict.repairGateManifest.fingerprint}.json / mime application/json;charset=utf-8 / metadata filename prompt-registry-repair-gate-manifest-metadata-84-${blockedPublishGateVerdict.repairGateManifest.fingerprint}.json / manifest prompt-registry-repair-gate-manifest/v1 / manifest fingerprint ${blockedPublishGateVerdict.repairGateManifest.fingerprint}`
    );
    expect(blockedGateDiagnostics).toContain(
      'redaction policy prompt-registry-repair-gate-manifest-redaction-policy/v1 / redaction status Redacted Projection No Prompt Provider Payload Or Secret'
    );
    expect(blockedGateDiagnostics).toContain(
      'retention policy prompt-registry-repair-gate-manifest-retention-policy/v1 / retention status Not Persisted Read Only'
    );
    expect(blockedGateDiagnostics).toContain(
      'candidate evidence set fingerprint bbbb6666cccc7777 / task route source evidence set fingerprint bbbb6767cccc7878 / task route source evidence set version copilot-task-route-effective-source-evidence-set/v1 / task route source evidence set inputs diagnosticsFingerprint, operationFingerprint, taskRouteEffectiveSourceFingerprints / embedding index contract evidence set fingerprint bbbb7777cccc8888 / rerank runtime contract evidence set fingerprint bbbb9999cccc0000 / prepared route order evidence set fingerprint bbbb8888cccc9999'
    );
    expect(blockedGateDiagnostics).toContain(
      'expected candidate evidence set fingerprint bbbb6666cccc7777 / expected task route source evidence set fingerprint bbbb6767cccc7878 / expected task route source evidence set version copilot-task-route-effective-source-evidence-set/v1 / expected task route source evidence set inputs diagnosticsFingerprint, operationFingerprint, taskRouteEffectiveSourceFingerprints / expected embedding index contract evidence set fingerprint bbbb7777cccc8888 / expected rerank runtime contract evidence set fingerprint bbbb9999cccc0000 / expected prepared route order evidence set fingerprint bbbb8888cccc9999'
    );
    expect(blockedGateDiagnostics).toMatch(
      /Repair action preview operation Preview Required \/ action kind Registry Add Messages .* candidate evidence 0 \/ candidate evidence fingerprint [0-9a-f]{16} \/ candidate evidence fingerprints none \/ candidate evidence keys none \/ prepared route order fingerprints none \/ embedding index contract evidence fingerprints none \/ rerank runtime contract evidence fingerprints none \/ task route source fingerprints none \/ fingerprint 5555666677778888 \/ operation fingerprint 5555eeee6666ffff \/ target locator fingerprint eeee5555ffff6666 \/ required capabilities prompt_registry\.read, prompt_registry\.preview_write \/ input schema required diagnosticsFingerprint, targetLocator/
    );
    expect(blockedGateDiagnostics).toContain('Repair recommendations 2');
    expect(blockedGateDiagnostics).toContain(
      'Repair recommendation Error / Prompt Registry / registry_add_messages / Add prompt messages / ai_prompts_messages'
    );
    expect(blockedGateDiagnostics).toContain(
      'Repair recommendation Error / Prompt Registry / registry_declare_template_param / Declare template params / ai_prompts_messages.params'
    );
    expect(screen.getByText('Repair recommendations')).not.toBeNull();
    expect(
      screen.getAllByText(
        /Recommendation Error \/ Prompt Registry \/ registry_add_messages/
      ).length
    ).toBeGreaterThan(0);
  });

  test('manual prompt diagnostics still submit when catalog filters hide it', async () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Prompt search'), {
      target: {
        value: 'make',
      },
    });
    fireEvent.change(screen.getByLabelText('Prompt name'), {
      target: {
        value: 'Manual prompt',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));

    await waitFor(() => {
      expect(useQueryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          query: getPromptModelsQuery,
          variables: {
            promptName: 'Manual prompt',
            workspaceId: undefined,
          },
        })
      );
    });
    expect(screen.getByText('Catalog results: 1 / 4')).not.toBeNull();
  });

  test('trims workspace scope and falls back to global diagnostics', () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Workspace ID'), {
      target: {
        value: ' workspace-1 ',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));
    expectQueryCall(getPromptModelsQuery, {
      promptName: 'Chat With LocalMind AI',
      workspaceId: 'workspace-1',
    });

    fireEvent.change(screen.getByLabelText('Workspace ID'), {
      target: {
        value: '   ',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));
    expectQueryCall(getPromptModelsQuery, {
      promptName: 'Chat With LocalMind AI',
      workspaceId: undefined,
    });
  });

  test('selects an accessible workspace scope for diagnostics', () => {
    renderAiPage();

    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Workspace selector' }),
      {
        key: 'ArrowDown',
      }
    );
    fireEvent.click(
      screen.getByRole('option', {
        name: 'workspace-1 / Team / Initialized / AI enabled / Embedding enabled',
      })
    );
    expect(
      (screen.getByLabelText('Workspace ID') as HTMLInputElement).value
    ).toBe('workspace-1');

    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));

    expectQueryCall(getPromptModelsQuery, {
      promptName: 'Chat With LocalMind AI',
      workspaceId: 'workspace-1',
    });
    expect(
      screen.getByText('Owner / AI enabled / Embedding enabled')
    ).not.toBeNull();
  });

  test('workspace selector can reset diagnostics back to global scope', () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Workspace ID'), {
      target: {
        value: 'workspace-1',
      },
    });
    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Workspace selector' }),
      {
        key: 'ArrowDown',
      }
    );
    fireEvent.click(
      screen.getByRole('option', { name: 'Global route diagnostics' })
    );
    expect(
      (screen.getByLabelText('Workspace ID') as HTMLInputElement).value
    ).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));

    expectQueryCall(getPromptModelsQuery, {
      promptName: 'Chat With LocalMind AI',
      workspaceId: undefined,
    });
  });

  test('manual workspace ID remains available for unknown scopes', () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Workspace ID'), {
      target: {
        value: 'workspace-manual',
      },
    });

    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Workspace selector' }),
      {
        key: 'ArrowDown',
      }
    );
    expect(
      screen.getByRole('option', { name: 'Manual workspace ID' })
    ).not.toBeNull();
    fireEvent.click(
      screen.getByRole('option', { name: 'Manual workspace ID' })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));

    expectQueryCall(getPromptModelsQuery, {
      promptName: 'Chat With LocalMind AI',
      workspaceId: 'workspace-manual',
    });
  });

  test('renders action run prepared route trace for a workspace scope', async () => {
    renderAiPage();

    fireEvent.change(screen.getByLabelText('Workspace ID'), {
      target: {
        value: 'workspace-1',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test route' }));
    await waitFor(() => {
      expectQueryCall(getCopilotActionRunsQuery, {
        limit: 8,
        workspaceId: 'workspace-1',
      });
    });
    expect(screen.getByText('Recent action runs')).not.toBeNull();
    expect(screen.getByText('mindmap.generate')).not.toBeNull();
    expect(screen.getByText('image.filter.sketch')).not.toBeNull();
    expect(screen.getAllByText('Prepared').length).toBeGreaterThan(0);
    expect(screen.getByText('2 steps / 3 routes')).not.toBeNull();
    expect(screen.getByText('Actual routes 3')).not.toBeNull();
    expect(screen.getByText('Steps generate -> generate-image')).not.toBeNull();
    expect(
      screen.getByText('Providers ollama-main -> openai-default')
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Models local/office-structured -> gpt-5-mini -> gpt-image-1'
      )
    ).not.toBeNull();
    expect(
      screen.getByText('Requested local/office-structured -> gpt-image-1')
    ).not.toBeNull();
    expect(
      screen.getByText('Requested sources Prompt Preference -> Explicit')
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Step requested sources generate -> Prompt Preference | generate-image -> Explicit'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Targets ollama-main/local/office-structured -> openai-default/gpt-5-mini -> openai-default/gpt-image-1'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Route order 0 -> ollama-main/local/office-structured | 1 -> openai-default/gpt-5-mini | 0 -> openai-default/gpt-image-1'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Fallback order 0 -> ollama-main/local/office-structured | 1 -> openai-default/gpt-5-mini | 0 -> openai-default/gpt-image-1'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Step targets generate -> ollama-main/local/office-structured | generate -> openai-default/gpt-5-mini | generate-image -> openai-default/gpt-image-1'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Requested targets local/office-structured -> ollama-main/local/office-structured | local/office-structured -> openai-default/gpt-5-mini | gpt-image-1 -> openai-default/gpt-image-1'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Step requested targets generate / local/office-structured -> ollama-main/local/office-structured | generate / local/office-structured -> openai-default/gpt-5-mini | generate-image / gpt-image-1 -> openai-default/gpt-image-1'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Step route order generate / 0 -> ollama-main/local/office-structured | generate / 1 -> openai-default/gpt-5-mini | generate-image / 0 -> openai-default/gpt-image-1'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Step route counts generate -> 2/2 | generate-image -> 1/1'
      )
    ).not.toBeNull();
    expect(screen.queryByText(/Route count mismatch/)).toBeNull();
    expect(
      screen.getByText(
        'Step fallback order generate / 0 -> ollama-main/local/office-structured | generate / 1 -> openai-default/gpt-5-mini | generate-image / 0 -> openai-default/gpt-image-1'
      )
    ).not.toBeNull();
    expect(screen.getByText('Kinds structured -> image')).not.toBeNull();
    expect(
      screen.getByText('Protocols openai_chat -> openai_image')
    ).not.toBeNull();
    expect(
      screen.getByText('Backends openai_chat -> openai_image')
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Canonical models local/office-structured -> gpt-image-1'
      )
    ).not.toBeNull();
    expect(
      screen.getByText('Behavior flags tool_calls -> image_generation')
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Dimensions requested 1024d / model 1024d / dimension mismatch no'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Step protocols generate -> openai_chat | generate-image -> openai_image'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Step backends generate -> openai_chat | generate-image -> openai_image'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Step canonical models generate -> local/office-structured | generate-image -> gpt-image-1'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Step behavior flags generate -> tool_calls | generate-image -> image_generation'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Step dimensions generate -> requested 1024d / model 1024d / dimension mismatch no'
      )
    ).not.toBeNull();
    expect(
      screen.getByText('Layers chat_completions -> images')
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Step layers generate -> chat_completions | generate-image -> images'
      )
    ).not.toBeNull();
    expect(
      screen.getAllByText('Fallback ollama-main -> openai-default').length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Step fallback generate -> ollama-main -> openai-default | generate-image -> openai-default'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        `Agent runtime diagnostics fingerprint ${actionRunAgentRuntimeDiagnosticsFingerprint}`
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        `Agent runtime diagnostics manifest agent-runtime-diagnostics-manifest/v1 / action mindmap.generate@v1 / run status Completed / fingerprint ${actionRunAgentRuntimeDiagnosticsFingerprint} / projection ${actionRunProjectionContractFingerprint} / timeline ${actionRunTimelineRouteEvidenceSetFingerprint} / source ai_action_run_agent_runtime_projection/v1 / schema projection_contract_only / prepared trace yes / routes 3/3 / steps 2 / timeline items 3 / projection gaps 5 / timeline gaps 10 / schema gaps 7 / timeline events run_status -> model_step / native events action_trace -> tool:dispatch`
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        `Agent runtime projection contract fingerprint ${actionRunProjectionContractFingerprint}`
      )
    ).not.toBeNull();
    const visibleTimeline =
      screen.getByTestId('action-run-timeline-run-123').textContent ?? '';
    expect(visibleTimeline).toContain(
      `#0 / key run_status / Timeline Run Status / status Completed / run / routes 3/3 / targets ollama-main/local/office-structured -> openai-default/gpt-5-mini -> openai-default/gpt-image-1 / fallback ollama-main -> openai-default / backends openai_chat -> openai_image / canonical local/office-structured -> gpt-image-1 / behavior tool_calls -> image_generation / dimensions requested 1024d / model 1024d / dimension mismatch no / route fingerprint ${actionRunTimelineRunRouteEvidenceFingerprint}`
    );
    expect(visibleTimeline).toContain(
      `#1 / key model_step:generate / Timeline Model Step / status Completed / step generate / type Model / kind Structured / routes 1/2 / route count mismatch / targets ollama-main/local/office-structured / fallback ollama-main -> openai-default / backends openai_chat / canonical local/office-structured / behavior tool_calls / dimensions requested 1024d / model 1024d / dimension mismatch no / route fingerprint ${actionRunTimelineGenerateRouteEvidenceFingerprint}`
    );
    expect(visibleTimeline).toContain(
      `#2 / key model_step:generate-image / Timeline Model Step / status Completed / step generate-image / type Model / kind Image / routes 1/1 / targets openai-default/gpt-image-1 / fallback openai-default / backends openai_image / canonical gpt-image-1 / behavior image_generation / route fingerprint ${actionRunTimelineImageRouteEvidenceFingerprint}`
    );
    expect(visibleTimeline).toContain(
      `Agent runtime timeline route evidence set fingerprint ${actionRunTimelineRouteEvidenceSetFingerprint}`
    );
    const failedVisibleTimeline =
      screen.getByTestId('action-run-timeline-run-failed').textContent ?? '';
    expect(failedVisibleTimeline).toContain(
      `#0 / key run_status / Timeline Run Status / status Failed / run / routes 0/0 / route fingerprint ${failedActionRunTimelineRouteEvidenceFingerprint}`
    );
    expect(failedVisibleTimeline).toContain(
      `Agent runtime timeline route evidence set fingerprint ${failedActionRunTimelineRouteEvidenceSetFingerprint}`
    );
    const actionRunDiagnostics =
      screen.getByTestId('action-run-diagnostics-run-123').textContent ?? '';
    expect(actionRunDiagnostics).toContain('Action run run-123');
    expect(actionRunDiagnostics).toContain('Action mindmap.generate');
    expect(actionRunDiagnostics).toContain('Status Succeeded');
    expect(actionRunDiagnostics).toContain('Retry of run-122');
    expect(actionRunDiagnostics).toContain('Doc doc-1');
    expect(actionRunDiagnostics).toContain('Session session-1');
    expect(actionRunDiagnostics).toContain('Prepared trace yes');
    expect(actionRunDiagnostics).toContain(
      `Agent runtime diagnostics fingerprint ${actionRunAgentRuntimeDiagnosticsFingerprint}`
    );
    expect(actionRunDiagnostics).toContain(
      `Agent runtime diagnostics manifest agent-runtime-diagnostics-manifest/v1 / action mindmap.generate@v1 / run status Completed / fingerprint ${actionRunAgentRuntimeDiagnosticsFingerprint} / projection ${actionRunProjectionContractFingerprint} / timeline ${actionRunTimelineRouteEvidenceSetFingerprint} / source ai_action_run_agent_runtime_projection/v1 / schema projection_contract_only / prepared trace yes / routes 3/3 / steps 2 / timeline items 3 / projection gaps 5 / timeline gaps 10 / schema gaps 7 / timeline events run_status -> model_step / native events action_trace -> tool:dispatch`
    );
    const actionRunExportMetadata =
      screen.getByTestId(
        'action-run-diagnostics-manifest-export-metadata-run-123'
      ).textContent ?? '';
    expect(actionRunExportMetadata).toContain(
      'Export artifact action_run_diagnostics_manifest_json'
    );
    expect(actionRunExportMetadata).toContain(
      'Filename action-run-diagnostics-manifest-run-123.json'
    );
    expect(actionRunExportMetadata).toContain(
      'MIME application/json;charset=utf-8'
    );
    expect(actionRunExportMetadata).toContain(
      'Metadata filename action-run-diagnostics-manifest-metadata-run-123.json'
    );
    expect(actionRunExportMetadata).toContain(
      'Metadata action-run-diagnostics-manifest-export-metadata/v1'
    );
    expect(actionRunExportMetadata).toContain(
      'Manifest agent-runtime-diagnostics-manifest/v1'
    );
    expect(actionRunExportMetadata).toContain(
      `Fingerprint ${actionRunAgentRuntimeDiagnosticsFingerprint}`
    );
    expect(actionRunExportMetadata).toContain('Action mindmap.generate@v1');
    expect(actionRunExportMetadata).toContain('Run run-123');
    expect(actionRunExportMetadata).toContain('Run status completed');
    expect(actionRunExportMetadata).toContain(
      'Projection source ai_action_run_agent_runtime_projection/v1'
    );
    expect(actionRunExportMetadata).toContain(
      'Schema readiness projection_contract_only'
    );
    expect(actionRunExportMetadata).toContain(
      'Boundary manifest_only_no_raw_trace_or_provider_payload'
    );
    expect(actionRunExportMetadata).toContain(
      'Export policy action-run-diagnostics-manifest-export-policy/v1'
    );
    expect(actionRunExportMetadata).toContain(
      'Export policy status read_only_projection'
    );
    expect(actionRunExportMetadata).toContain(
      `Export policy fingerprint ${actionRunManifestExportPolicyFingerprint}`
    );
    expect(actionRunExportMetadata).toContain(
      'Audit event action-run-diagnostics-manifest-export-audit-event/v1'
    );
    expect(actionRunExportMetadata).toContain(
      'Audit event status not_created_read_only'
    );
    expect(actionRunExportMetadata).toContain('Audit event created no');
    expect(actionRunExportMetadata).toContain(
      `Audit event fingerprint ${actionRunManifestExportAuditEventFingerprint}`
    );
    expect(actionRunExportMetadata).toContain(
      'Retention policy action-run-diagnostics-manifest-retention-policy/v1'
    );
    expect(actionRunExportMetadata).toContain(
      'Retention policy status not_persisted_read_only'
    );
    expect(actionRunExportMetadata).toContain(
      `Retention policy fingerprint ${actionRunManifestRetentionPolicyFingerprint}`
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Copy metadata' })[0]
    );
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(actionRunExportMetadata);
    });
    const actionRunExportMetadataJson =
      screen.getByTestId(
        'action-run-diagnostics-manifest-export-metadata-json-run-123'
      ).textContent ?? '';
    expect(JSON.parse(actionRunExportMetadataJson)).toEqual(
      actionRunsPayload[0].agentRuntimeDiagnosticsManifestExportMetadata
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Copy metadata JSON' })[0]
    );
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(actionRunExportMetadataJson);
    });
    const actionRunManifestJson =
      screen.getByTestId('action-run-diagnostics-manifest-json-run-123')
        .textContent ?? '';
    expect(JSON.parse(actionRunManifestJson)).toEqual(
      actionRunsPayload[0].agentRuntimeDiagnosticsManifest
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy JSON' })[0]);
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(actionRunManifestJson);
    });
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Download JSON' })[0]
    );
    expect(createObjectURLMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'application/json;charset=utf-8',
      })
    );
    const manifestDownloadAnchor = anchorClickMock.mock
      .contexts[0] as HTMLAnchorElement;
    expect(manifestDownloadAnchor.download).toBe(
      'action-run-diagnostics-manifest-run-123.json'
    );
    expect(manifestDownloadAnchor.href).toBe('blob:action-run-manifest');
    expect(revokeObjectURLMock).toHaveBeenCalledWith(
      'blob:action-run-manifest'
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Download metadata JSON' })[0]
    );
    expect(createObjectURLMock).toHaveBeenCalledTimes(2);
    const metadataDownloadAnchor = anchorClickMock.mock
      .contexts[1] as HTMLAnchorElement;
    expect(metadataDownloadAnchor.download).toBe(
      'action-run-diagnostics-manifest-metadata-run-123.json'
    );
    expect(metadataDownloadAnchor.href).toBe('blob:action-run-manifest');
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(2);
    expect(actionRunDiagnostics).toContain(
      'Agent runtime projection ai_action_run_agent_runtime_projection/v1'
    );
    expect(actionRunDiagnostics).toContain(
      `Agent runtime projection contract fingerprint ${actionRunProjectionContractFingerprint}`
    );
    expect(actionRunDiagnostics).toContain('Agent runtime run run-123');
    expect(actionRunDiagnostics).toContain('Agent runtime status Completed');
    expect(actionRunDiagnostics).toContain('Agent runtime step count 2');
    expect(actionRunDiagnostics).toContain(
      'Agent runtime step types generate -> model | generate-image -> model'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime step statuses generate -> completed | generate-image -> completed'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime step kinds generate -> structured | generate-image -> image'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime timeline entries run -> completed | generate -> model_step -> completed -> structured -> 2/2 | generate-image -> model_step -> completed -> image -> 1/1'
    );
    expect(actionRunDiagnostics).toContain(
      `Agent runtime timeline items #0 / key run_status / Timeline Run Status / status Completed / run / routes 3/3 / targets ollama-main/local/office-structured -> openai-default/gpt-5-mini -> openai-default/gpt-image-1 / fallback ollama-main -> openai-default / backends openai_chat -> openai_image / canonical local/office-structured -> gpt-image-1 / behavior tool_calls -> image_generation / dimensions requested 1024d / model 1024d / dimension mismatch no / route fingerprint ${actionRunTimelineRunRouteEvidenceFingerprint} | #1 / key model_step:generate / Timeline Model Step / status Completed / step generate / type Model / kind Structured / routes 1/2 / route count mismatch / targets ollama-main/local/office-structured / fallback ollama-main -> openai-default / backends openai_chat / canonical local/office-structured / behavior tool_calls / dimensions requested 1024d / model 1024d / dimension mismatch no / route fingerprint ${actionRunTimelineGenerateRouteEvidenceFingerprint} | #2 / key model_step:generate-image / Timeline Model Step / status Completed / step generate-image / type Model / kind Image / routes 1/1 / targets openai-default/gpt-image-1 / fallback openai-default / backends openai_image / canonical gpt-image-1 / behavior image_generation / route fingerprint ${actionRunTimelineImageRouteEvidenceFingerprint}`
    );
    expect(actionRunDiagnostics).toContain(
      `Agent runtime timeline route evidence set fingerprint ${actionRunTimelineRouteEvidenceSetFingerprint}`
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime timeline event types run_status | model_step'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime target timeline event types run_status | model_step | tool_step | approval_step | handoff_step | codex_step | mcp_step | step_output | step_error | retry_attempt | rollback_state | run_cancellation'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime projected timeline event types run_status | model_step'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime unsupported timeline event types tool_step | approval_step | handoff_step | codex_step | mcp_step | step_output | step_error | retry_attempt | rollback_state | run_cancellation'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime timeline gaps tool_step -> not_projected | approval_step -> not_projected | handoff_step -> not_projected | codex_step -> not_projected | mcp_step -> not_projected | step_output -> not_projected | step_error -> not_projected | retry_attempt -> not_projected | rollback_state -> not_projected | run_cancellation -> not_projected'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime schema readiness Projection Contract Only'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime target schema components db_agent_run_table | db_agent_step_table | graphql_run_status_enum | graphql_step_status_enum | graphql_step_type_enum | schema_migration | registry_source_of_truth'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime projected schema components typescript_projection_contract | graphql_string_diagnostics_fields | graphql_structured_timeline_items'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime schema readiness gaps db_agent_run_table -> not_persisted | db_agent_step_table -> not_persisted | graphql_run_status_enum -> string_field | graphql_step_status_enum -> string_field | graphql_step_type_enum -> string_field | schema_migration -> not_created | registry_source_of_truth -> not_created'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime target run statuses queued | running | waiting_approval | completed | failed | cancelled | retrying | rollback_running | archived'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime projected run statuses queued | running | completed | failed | cancelled'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime unsupported run statuses waiting_approval | retrying | rollback_running | archived'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime run status gaps waiting_approval -> not_projected | retrying -> not_projected | rollback_running -> not_projected | archived -> not_projected'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime target step statuses pending | running | waiting_approval | completed | failed | skipped | retrying | rollback_running | blocked'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime projected step statuses pending | running | completed | failed | skipped'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime unsupported step statuses waiting_approval | retrying | rollback_running | blocked'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime step status gaps waiting_approval -> not_projected | retrying -> not_projected | rollback_running -> not_projected | blocked -> not_projected'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime target step types model | tool | approval | handoff | codex | mcp'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime projected step types model'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime projection gaps tool -> not_projected | approval -> not_projected | handoff -> not_projected | codex -> not_projected | mcp -> not_projected'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime unsupported step types tool | approval | handoff | codex | mcp'
    );
    expect(actionRunDiagnostics).toContain(
      'Agent runtime native trace events action_trace | tool:dispatch'
    );
    expect(actionRunDiagnostics).toContain('2 steps / 3 routes');
    expect(actionRunDiagnostics).toContain(
      'Requested sources Prompt Preference -> Explicit'
    );
    expect(actionRunDiagnostics).toContain(
      'Backends openai_chat -> openai_image'
    );
    expect(actionRunDiagnostics).toContain(
      'Canonical models local/office-structured -> gpt-image-1'
    );
    expect(actionRunDiagnostics).toContain(
      'Behavior flags tool_calls -> image_generation'
    );
    expect(actionRunDiagnostics).toContain(
      'Dimensions requested 1024d / model 1024d / dimension mismatch no'
    );
    expect(actionRunDiagnostics).toContain(
      'Step backends generate -> openai_chat | generate-image -> openai_image'
    );
    expect(actionRunDiagnostics).toContain(
      'Step canonical models generate -> local/office-structured | generate-image -> gpt-image-1'
    );
    expect(actionRunDiagnostics).toContain(
      'Step behavior flags generate -> tool_calls | generate-image -> image_generation'
    );
    expect(actionRunDiagnostics).toContain(
      'Step dimensions generate -> requested 1024d / model 1024d / dimension mismatch no'
    );
    expect(actionRunDiagnostics).toContain(
      'Step requested targets generate / local/office-structured -> ollama-main/local/office-structured | generate / local/office-structured -> openai-default/gpt-5-mini | generate-image / gpt-image-1 -> openai-default/gpt-image-1'
    );
    expect(actionRunDiagnostics).toContain(
      'Step fallback generate -> ollama-main -> openai-default | generate-image -> openai-default'
    );
    const failedRunDiagnostics =
      screen.getByTestId('action-run-diagnostics-run-failed').textContent ?? '';
    const failedRunExportMetadata =
      screen.getByTestId(
        'action-run-diagnostics-manifest-export-metadata-run-failed'
      ).textContent ?? '';
    const failedRunManifestJson =
      screen.getByTestId('action-run-diagnostics-manifest-json-run-failed')
        .textContent ?? '';
    expect(JSON.parse(failedRunManifestJson)).toEqual(
      actionRunsPayload[1].agentRuntimeDiagnosticsManifest
    );
    expect(failedRunExportMetadata).toContain(
      'Filename action-run-diagnostics-manifest-run-failed.json'
    );
    expect(failedRunExportMetadata).toContain(
      'Metadata filename action-run-diagnostics-manifest-metadata-run-failed.json'
    );
    expect(failedRunExportMetadata).toContain('Run status failed');
    expect(failedRunExportMetadata).toContain(
      'Boundary manifest_only_no_raw_trace_or_provider_payload'
    );
    expect(failedRunExportMetadata).toContain(
      `Export policy fingerprint ${failedActionRunManifestExportPolicyFingerprint}`
    );
    expect(failedRunExportMetadata).toContain(
      'Audit event status not_created_read_only'
    );
    expect(failedRunExportMetadata).toContain(
      `Audit event fingerprint ${failedActionRunManifestExportAuditEventFingerprint}`
    );
    expect(failedRunExportMetadata).toContain(
      'Retention policy status not_persisted_read_only'
    );
    expect(failedRunExportMetadata).toContain(
      `Retention policy fingerprint ${failedActionRunManifestRetentionPolicyFingerprint}`
    );
    const failedRunExportMetadataJson =
      screen.getByTestId(
        'action-run-diagnostics-manifest-export-metadata-json-run-failed'
      ).textContent ?? '';
    expect(JSON.parse(failedRunExportMetadataJson)).toEqual(
      actionRunsPayload[1].agentRuntimeDiagnosticsManifestExportMetadata
    );
    expect(failedRunDiagnostics).toContain('Action run run-failed');
    expect(failedRunDiagnostics).toContain('Status Failed');
    expect(failedRunDiagnostics).toContain('Error action_bridge_stream_error');
    expect(failedRunDiagnostics).toContain('Agent runtime run run-failed');
    expect(failedRunDiagnostics).toContain('Agent runtime status Failed');
    expect(failedRunDiagnostics).toContain('Agent runtime steps none');
    expect(failedRunDiagnostics).toContain(
      'Agent runtime timeline entries run -> failed'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime timeline items #0 / key run_status / Timeline Run Status / status Failed / run / routes 0/0'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime timeline event types run_status'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime target timeline event types run_status | model_step | tool_step | approval_step | handoff_step | codex_step | mcp_step | step_output | step_error | retry_attempt | rollback_state | run_cancellation'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime projected timeline event types run_status | model_step'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime unsupported timeline event types tool_step | approval_step | handoff_step | codex_step | mcp_step | step_output | step_error | retry_attempt | rollback_state | run_cancellation'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime timeline gaps model_step -> no_prepared_route_trace | tool_step -> not_projected | approval_step -> not_projected | handoff_step -> not_projected | codex_step -> not_projected | mcp_step -> not_projected | step_output -> not_projected | step_error -> not_projected | retry_attempt -> not_projected | rollback_state -> not_projected | run_cancellation -> not_projected'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime schema readiness Projection Contract Only'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime target schema components db_agent_run_table | db_agent_step_table | graphql_run_status_enum | graphql_step_status_enum | graphql_step_type_enum | schema_migration | registry_source_of_truth'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime projected schema components typescript_projection_contract | graphql_string_diagnostics_fields | graphql_structured_timeline_items'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime schema readiness gaps db_agent_run_table -> not_persisted | db_agent_step_table -> not_persisted | graphql_run_status_enum -> string_field | graphql_step_status_enum -> string_field | graphql_step_type_enum -> string_field | schema_migration -> not_created | registry_source_of_truth -> not_created'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime target run statuses queued | running | waiting_approval | completed | failed | cancelled | retrying | rollback_running | archived'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime projected run statuses queued | running | completed | failed | cancelled'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime unsupported run statuses waiting_approval | retrying | rollback_running | archived'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime run status gaps waiting_approval -> not_projected | retrying -> not_projected | rollback_running -> not_projected | archived -> not_projected'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime target step statuses pending | running | waiting_approval | completed | failed | skipped | retrying | rollback_running | blocked'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime projected step statuses pending | running | completed | failed | skipped'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime unsupported step statuses waiting_approval | retrying | rollback_running | blocked'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime step status gaps waiting_approval -> not_projected | retrying -> not_projected | rollback_running -> not_projected | blocked -> not_projected'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime target step types model | tool | approval | handoff | codex | mcp'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime projected step types model'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime projection gaps model -> no_prepared_route_trace | tool -> not_projected | approval -> not_projected | handoff -> not_projected | codex -> not_projected | mcp -> not_projected'
    );
    expect(failedRunDiagnostics).toContain(
      'Agent runtime native trace events none'
    );
    expect(failedRunDiagnostics).toContain('Prepared trace no');
    expect(failedRunDiagnostics).toContain('No prepared route trace');
    expect(screen.getByText('No prepared route trace')).not.toBeNull();
    expect(screen.getAllByText('Failed').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/action_bridge_stream_error/).length
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Inspect' })[0]);
    await waitFor(() => {
      expectQueryCall(getCopilotActionRunPreparedRouteTraceQuery, {
        runId: 'run-123',
        workspaceId: 'workspace-1',
      });
    });
    expect(
      (screen.getByLabelText('Action run ID') as HTMLInputElement).value
    ).toBe('run-123');

    fireEvent.change(screen.getByLabelText('Action run ID'), {
      target: {
        value: ' run-manual ',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Inspect run' }));

    await waitFor(() => {
      expectQueryCall(getCopilotActionRunPreparedRouteTraceQuery, {
        runId: 'run-manual',
        workspaceId: 'workspace-1',
      });
    });
    expect(screen.getByText('Workspace workspace-1')).not.toBeNull();
    expect(screen.getByText('Run run-manual')).not.toBeNull();
    const traceDiagnostics =
      screen.getByTestId('action-run-trace-diagnostics-run-manual')
        .textContent ?? '';
    expect(traceDiagnostics).toContain('Action run run-manual');
    expect(traceDiagnostics).toContain('Trace prepared_routes');
    expect(traceDiagnostics).toContain('Status Succeeded');
    expect(traceDiagnostics).toContain('Steps 2');
    expect(traceDiagnostics).toContain('Step generate');
    expect(traceDiagnostics).toContain(
      'Route count mismatch expected 2 actual 1'
    );
    expect(traceDiagnostics).toContain('Requested local/office-structured');
    expect(traceDiagnostics).toContain('Source Prompt Preference');
    expect(traceDiagnostics).toContain(
      'Fallback ollama-main -> openai-default'
    );
    expect(traceDiagnostics).toContain(
      'Route ollama-main/local/office-structured / route #1 / fallback #1 / protocol openai_chat / layer chat_completions / backend openai_chat / canonical local/office-structured / behavior tool_calls / dimensions requested 1024d / model 1536d / dimension mismatch yes'
    );
    expect(traceDiagnostics).toContain(
      'provider name Local Ollama / provider type OpenAI-compatible / provider source Configured'
    );
    expect(traceDiagnostics).toContain(
      'profile Profile ollama-main / Configured / config copilot.providers.profiles[id=ollama-main] / 2 configured models / models local/office-structured, office-structured'
    );
    expect(traceDiagnostics).toContain(
      'Provider profile / Definition local/office-structured / Raw qwen3:32b / Aliases office-structured / Alias matched / openai_chat / Canonical local/office-structured / Protocol openai_chat / Layer chat_completions / Flags tool_calls'
    );
    expect(traceDiagnostics).toContain('Step generate-image');
    expect(traceDiagnostics).toContain('Fallback none');
    expect(traceDiagnostics).toContain(
      'Route openai-default/gpt-image-1 / route #1 / protocol openai_image / layer images'
    );
    expect(screen.getByText('generate')).not.toBeNull();
    expect(screen.getByText('Structured')).not.toBeNull();
    expect(screen.getByText('Mismatch expected 2 actual 1')).not.toBeNull();
    expect(screen.getAllByText('Actual 1').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Requested local/office-structured')
    ).not.toBeNull();
    expect(screen.getByText('Source Prompt Preference')).not.toBeNull();
    expect(
      screen.getByText('ollama-main/local/office-structured')
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Route #1 / Fallback #1 / Protocol openai_chat / Layer chat_completions'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Provider Local Ollama / Type OpenAI-compatible / Source Configured / Privacy Local / Health Healthy / Priority 10'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Profile ollama-main / Profile source Configured / Config copilot.providers.profiles[id=ollama-main] / Profile models local/office-structured, office-structured / Profile model count 2'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Definition Provider profile / Definition local/office-structured / Raw qwen3:32b / Aliases office-structured / Alias matched / openai_chat / Canonical local/office-structured / Protocol openai_chat / Layer chat_completions / Flags tool_calls'
      )
    ).not.toBeNull();
    expect(
      screen.getByText(
        'Dimensions requested 1024d / model 1536d / dimension mismatch yes'
      )
    ).not.toBeNull();
    expect(
      screen.getAllByText('ollama-main -> openai-default').length
    ).toBeGreaterThan(0);
    expect(screen.getByText('generate-image')).not.toBeNull();
    expect(screen.getByText('Requested gpt-image-1')).not.toBeNull();
    expect(screen.getByText('Source Explicit')).not.toBeNull();
    expect(screen.getByText('openai-default/gpt-image-1')).not.toBeNull();
    expect(screen.getAllByText('None').length).toBeGreaterThan(0);
  });

  test('renders blocked task route diagnostics and recommended checks', () => {
    renderAiPage();

    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
    expect(screen.getByText('no_provider_available')).not.toBeNull();
    expect(
      screen.getByText('No provider is configured for embedding.')
    ).not.toBeNull();
    expect(screen.getAllByText('Configure Provider').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Check Prompt Default').length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByText('Check Model Profile').length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByText('Prompt registry').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Provider profiles').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Model registry').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Provider runtime logs').length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByText('Prepare trace').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        'Prompt default model, default policy, category defaults, overrides, and prompt catalog metadata.'
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        'Provider enablement, credentials, endpoint, health, privacy, and profile configuration.'
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        'Runtime adapter registration, container networking, native prepare, and provider logs.'
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Provider unavailable').length).toBeGreaterThan(
      0
    );
    expect(
      screen.getAllByText('No profile model match').length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Route policy').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Policy candidates').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Requested model').length).toBeGreaterThan(0);
    expect(screen.getAllByText('workspace-embedding').length).toBeGreaterThan(
      0
    );
    expect(
      screen.getAllByText('Source Workspace indexing task model').length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Config copilot.tasks.models.workspaceIndexing')
        .length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Source DB-backed task route policy').length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Config copilot.tasks.models.rerank').length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Prepared routes').length).toBeGreaterThan(0);
    expect(screen.getByText('No prepared routes returned.')).not.toBeNull();
    expect(screen.getAllByText('Allowed privacy').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Preferred privacy').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Local').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Local Ollama/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('OpenAI-compatible').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BYOK local').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Configured').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        'Profile ollama-main / BYOK local / config workspace.byok.local / 2 configured models / models workspace-embedding, nomic-embed-text'
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        'Provider profile / Definition workspace-embedding / Raw nomic-embed-text / Aliases nomic-embed-text'
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Fallback Route / Prompt / Registry').length
    ).toBe(2);
    expect(screen.getByText('Active source chain')).not.toBeNull();
    expect(
      screen.getAllByText(
        'Fallback Route -> Prompt Prompt override config copilot.prompts.overrides[].optionalModels -> Registry'
      ).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText('prompt, registry')).toBeNull();
    expect(screen.getAllByText('Route openai-main/gpt-4o-mini').length).toBe(1);
    expect(screen.getAllByText('ollama-main -> openai-default').length).toBe(1);
    const workspaceIndexingDiagnostics = screen.getByTestId(
      'task-route-diagnostics-workspace-indexing'
    ).textContent;
    expect(workspaceIndexingDiagnostics).toContain(
      'Task route Workspace indexing'
    );
    expect(workspaceIndexingDiagnostics).toContain('Status Blocked');
    expect(workspaceIndexingDiagnostics).toContain('Configured no');
    expect(workspaceIndexingDiagnostics).toContain(
      'Requested workspace-embedding'
    );
    expect(workspaceIndexingDiagnostics).toContain(
      'Requested source Workspace indexing task model'
    );
    expect(workspaceIndexingDiagnostics).toContain(
      'Requested config copilot.tasks.models.workspaceIndexing'
    );
    expect(workspaceIndexingDiagnostics).toContain(
      'Embedding index contract workspace-embedding-index/v2'
    );
    expect(workspaceIndexingDiagnostics).toContain(
      'Embedding index dimensions 4096d'
    );
    expect(workspaceIndexingDiagnostics).toContain(
      'Embedding index status Compatible With Current Pgvector Index'
    );
    expect(workspaceIndexingDiagnostics).toContain(
      'Embedding index fingerprint eeee1111dddd2222'
    );
    expect(workspaceIndexingDiagnostics).toContain(
      'Error code no_provider_available'
    );
    expect(workspaceIndexingDiagnostics).toContain(
      'No provider is configured for embedding.'
    );
    expect(workspaceIndexingDiagnostics).toContain('Diagnostics errors 1');
    expect(workspaceIndexingDiagnostics).toContain(
      'Diagnostics error stage Describe Embedding Prepare Candidates / code EmbeddingPrepareDiagnosticsFailure / message embedding prepare diagnostics unavailable'
    );
    expect(workspaceIndexingDiagnostics).toContain(
      'Configure Provider -> Provider profiles'
    );
    expect(workspaceIndexingDiagnostics).toContain('Allowed privacy Local');
    expect(workspaceIndexingDiagnostics).toContain('Policy candidates 1');
    expect(workspaceIndexingDiagnostics).toContain(
      'Policy candidate fingerprint abcd1234efef5678 / policy:workspace_indexing:global:ollama-main / Local Ollama / ollama-main'
    );
    expect(workspaceIndexingDiagnostics).toContain(
      'policy:workspace_indexing:global:ollama-main'
    );
    expect(workspaceIndexingDiagnostics).toContain(
      'profile Profile ollama-main / BYOK local / config workspace.byok.local / 2 configured models / models workspace-embedding, nomic-embed-text'
    );
    expect(workspaceIndexingDiagnostics).toContain('Phase policy');
    expect(workspaceIndexingDiagnostics).toContain('Phase resolution');
    expect(workspaceIndexingDiagnostics).toContain('Candidate trace');
    expect(workspaceIndexingDiagnostics).toContain('code prepare_failed');
    expect(workspaceIndexingDiagnostics).toContain('category Network');
    const rerankDiagnostics = screen.getByTestId(
      'task-route-diagnostics-rerank'
    ).textContent;
    expect(rerankDiagnostics).toContain('Task route Rerank');
    expect(rerankDiagnostics).toContain('Status Ready');
    expect(rerankDiagnostics).toContain('Route ollama-main / bge-reranker-v2');
    expect(rerankDiagnostics).toContain(
      'Requested source DB-backed task route policy'
    );
    expect(rerankDiagnostics).toContain(
      'Task route policy revision workspace-rerank-r1'
    );
    expect(rerankDiagnostics).toContain(
      'Task route policy revision id task-route-policy-rerank-1'
    );
    expect(rerankDiagnostics).toContain(
      'Task route policy revision scope Workspace'
    );
    expect(rerankDiagnostics).toContain(
      'Task route policy revision status Active'
    );
    expect(rerankDiagnostics).toContain(
      'Task route policy revision fingerprint routepolicy11112222'
    );
    expect(rerankDiagnostics).toContain(
      'Task route policy source chain fingerprint routechain11112222'
    );
    expect(rerankDiagnostics).toContain(
      'Task route policy revision publish events 1'
    );
    expect(rerankDiagnostics).toContain(
      'Task route policy revision publish event Revision Published / repair_execution_worker / fingerprint taskroutepublish1111 / actor user-1'
    );
    expect(rerankDiagnostics).toContain(
      'Task route policy source chain DB revision / Workspace / Active / feature Rerank / model workspace-rerank'
    );
    expect(rerankDiagnostics).toContain('Prepared providers 1');
    expect(rerankDiagnostics).toContain(
      'Prepared targets ollama-main/bge-reranker-v2'
    );
    expect(rerankDiagnostics).toContain(
      `Prepared target fingerprint ${readyRoute.preparedRouteTargetFingerprint}`
    );
    expect(rerankDiagnostics).not.toContain('Embedding index contract');
    expect(rerankDiagnostics).toContain(
      'Rerank runtime contract workspace-rerank-runtime/v1'
    );
    expect(rerankDiagnostics).toContain('Rerank runtime topK 5');
    expect(rerankDiagnostics).toContain(
      'Rerank runtime status Prepared Route Available'
    );
    expect(rerankDiagnostics).toContain(
      'Rerank runtime fingerprint eeee2222ffff3333'
    );
    expect(rerankDiagnostics).toContain(
      'Prepared route ollama-main/bge-reranker-v2'
    );
    expect(rerankDiagnostics).toContain('route #1 / fallback #1');
    expect(rerankDiagnostics).toContain(
      'type OpenAI-compatible / source Configured / priority 10 / profile Profile ollama-main / Configured / config copilot.providers.profiles[id=ollama-main] / 2 configured models / models workspace-rerank, bge-reranker-v2'
    );
    expect(rerankDiagnostics).toContain('Policy candidates 1');
    expect(rerankDiagnostics).toContain('policy:rerank:global:ollama-main');
    expect(rerankDiagnostics).toContain(
      'profile Profile ollama-main / Configured / config copilot.providers.profiles[id=ollama-main] / 2 configured models / models workspace-rerank, bge-reranker-v2'
    );
    expect(rerankDiagnostics).toContain('Registry model-registry-rerank-1');
    expect(rerankDiagnostics).toContain('Revision workspace-rerank-model-r1');
    expect(rerankDiagnostics).toContain(
      'Task route policy revision publish events 1'
    );
    expect(rerankDiagnostics).toContain(
      'Candidate model registry revision publish events ollama-main / bge-reranker-v2 1'
    );
    expect(rerankDiagnostics).toContain(
      'Candidate model registry revision publish event ollama-main / bge-reranker-v2 Revision Published / repair_execution_worker / fingerprint modelpublish1111 / actor user-1'
    );
    const modelCandidatesDiagnostics = screen.getByTestId(
      'model-candidates-diagnostics'
    ).textContent;
    expect(modelCandidatesDiagnostics).toContain('Prompt LocalMind AI');
    expect(modelCandidatesDiagnostics).toContain('Candidate count 1');
    expect(modelCandidatesDiagnostics).toContain('Candidate gpt-4o-mini');
    expect(modelCandidatesDiagnostics).toContain(
      'Fallback providers ollama-main -> openai-default'
    );
    expect(modelCandidatesDiagnostics).toContain(
      'Model registry revision publish events 1'
    );
    expect(modelCandidatesDiagnostics).toContain(
      'Model registry revision publish event Revision Published / graphql_mutation / fingerprint modelpublish3333 / actor user-1'
    );
    const modelCandidateDiagnostics = screen.getByTestId(
      'model-candidate-diagnostics-gpt-4o-mini'
    ).textContent;
    expect(modelCandidateDiagnostics).toContain('Candidate gpt-4o-mini');
    expect(modelCandidateDiagnostics).toContain('Prompt LocalMind AI');
    expect(modelCandidateDiagnostics).toContain('Action chat');
    expect(modelCandidateDiagnostics).toContain('Built-in');
    expect(modelCandidateDiagnostics).toContain(
      'Provider OpenAI (openai-main)'
    );
    expect(modelCandidateDiagnostics).toContain(
      'Provider profile Profile openai-main'
    );
    expect(modelCandidateDiagnostics).toContain(
      'Route openai-main/gpt-4o-mini'
    );
    expect(modelCandidateDiagnostics).toContain(
      'Fallback providers ollama-main -> openai-default'
    );
    expect(modelCandidateDiagnostics).toContain(
      'Model definition Provider profile / Definition gpt-4o-mini'
    );
    expect(modelCandidateDiagnostics).toContain(
      'Registry model-registry-openai-gpt-1'
    );
    expect(modelCandidateDiagnostics).toContain('Publish events 1');
    expect(modelCandidateDiagnostics).toContain(
      'Capabilities Input text / Output text'
    );
    expect(modelCandidateDiagnostics).toContain('Policy Chat');
    expect(modelCandidateDiagnostics).toContain(
      'Sources Fallback Route / Prompt / Registry'
    );
    expect(modelCandidateDiagnostics).toContain('Limits 128K ctx / 16K out');
    expect(modelCandidateDiagnostics).toContain(
      'Cost $0.1500/M in / $0.6000/M out'
    );
    expect(
      screen.getAllByText(
        'Provider profile / Definition gpt-4o-mini / Raw gpt-4o-mini-2026-06-01 / Aliases fast-chat / Registry model-registry-openai-gpt-1 / Revision workspace-openai-gpt-r1 / Scope workspace / Status active / Fingerprint modelregistry33334444 / Source chain modelchain33334444 / Workspace workspace-1 / Publish events 1 / openai / Canonical gpt-4o-mini / Protocol openai / Layer chat'
      ).length
    ).toBe(1);
    expect(screen.getAllByText('Input text / Output text').length).toBe(1);
    expect(screen.getAllByText('128K ctx / 16K out').length).toBe(1);
    expect(screen.getAllByText('$0.1500/M in / $0.6000/M out').length).toBe(1);
    expect(screen.getAllByText('Active default').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Prompt fallback').length).toBe(1);
    expect(screen.getAllByText('Priority 10').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Down').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Checked 2026-06-16T10:00:00.000Z').length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Global').length).toBeGreaterThan(0);
    expect(screen.getAllByText('gemini-2.5-flash').length).toBeGreaterThan(0);
    expect(screen.getAllByText('gpt-4o-mini').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Fallback Route').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Prompt Default Unavailable').length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Code prepare_failed/).length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByText(/Category Network/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Prepare Only').length).toBeGreaterThan(0);
    expect(screen.queryByText('prepare_only')).toBeNull();
  });

  test('renders ready rerank route and candidate trace', () => {
    renderAiPage();

    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0);
    expect(screen.getAllByText('workspace-rerank').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/bge-reranker-v2/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ollama-main/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Route #1 / Fallback #1 / Protocol openai-compatible / Layer chat / Backend rerank / Canonical bge-reranker-v2'
      )
    ).not.toBeNull();
    expect(
      screen.getByText('OpenAI-compatible / Configured / Priority 10')
    ).not.toBeNull();
    expect(
      screen.getAllByText(/prepared bge-reranker-v2/).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        'Profile ollama-main / Configured / config copilot.providers.profiles[id=ollama-main] / 2 configured models / models workspace-rerank, bge-reranker-v2'
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        'Provider profile / Definition workspace-rerank / Aliases bge-reranker-v2 / Registry model-registry-rerank-1 / Revision workspace-rerank-model-r1 / Scope workspace / Status active / Fingerprint modelregistry11112222 / Source chain modelchain11112222 / Workspace workspace-1 / Publish events 1'
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Healthy').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Allowed').length).toBeGreaterThan(0);
  });
});
