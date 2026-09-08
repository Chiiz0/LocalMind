import { createHash, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Prisma } from '@prisma/client';

import { BaseModel } from './base';
import type { CopilotRepairExecutionRecord } from './copilot-repair-execution';

export type CopilotAgentRunStatus =
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'waiting_for_location'
  | 'waiting_lease'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type CopilotAgentStepStatus =
  | 'pending'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'skipped';

export type CopilotAgentStepType =
  | 'model'
  | 'tool'
  | 'approval'
  | 'handoff'
  | 'codex'
  | 'mcp';

export type CopilotAgentTimelineEventType =
  | 'run_status'
  | 'model_step'
  | 'tool_step'
  | 'approval_step'
  | 'handoff_step'
  | 'codex_step'
  | 'mcp_step'
  | 'step_output'
  | 'step_error'
  | 'run_cancellation';

export type CopilotAgentTimelineEventRecord = {
  id: string;
  runId: string;
  stepId: string | null;
  workspaceId: string;
  actorId: string;
  eventType: CopilotAgentTimelineEventType;
  status: string;
  ordinal: number;
  summary: string;
  payload: Record<string, unknown>;
  eventFingerprint: string;
  createdAt: Date;
};

export type CopilotAgentRuntimeExecutionResultRecord = {
  id: string;
  runId: string;
  workspaceId: string;
  actorId: string;
  workflow: string;
  sourceType: string;
  sourceId: string;
  adapterWorkflow: string;
  executor: string;
  resultStatus: 'completed' | 'failed';
  sideEffectMode: string;
  sideEffectsApplied: boolean;
  summary: string;
  failureCode: string | null;
  failureMessage: string | null;
  resultPayload: Record<string, unknown>;
  resultFingerprint: string;
  workerAttempt: number;
  workerLeaseId: string;
  completedAt: Date;
  createdAt: Date;
};

export type CopilotAgentStepRecord = {
  id: string;
  runId: string;
  workspaceId: string;
  actorId: string;
  stepKey: string;
  stepType: CopilotAgentStepType;
  status: CopilotAgentStepStatus;
  title: string | null;
  order: number;
  evidenceFingerprint: string;
  outputSummary: Record<string, unknown>;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CopilotAgentRunRecord = {
  id: string;
  workspaceId: string;
  actorId: string;
  sessionId: string | null;
  projectId?: string | null;
  workflow: string;
  sourceType: string;
  sourceId: string;
  status: CopilotAgentRunStatus;
  title: string | null;
  targetFingerprint: string;
  evidenceFingerprint: string;
  timelineFingerprint: string;
  startedAt: Date | null;
  completedAt: Date | null;
  failureCode: string | null;
  failureMessage: string | null;
  queuedAt: Date | null;
  workerLeaseId: string | null;
  workerLeaseExpiresAt: Date | null;
  workerAttempt: number;
  workerMaxAttempts: number;
  lastAttemptAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  steps: CopilotAgentStepRecord[];
  timelineEvents: CopilotAgentTimelineEventRecord[];
  executionResultCount: number;
  executionResults: CopilotAgentRuntimeExecutionResultRecord[];
};

export type CopilotAgentRunListFilter = {
  query?: string | null;
  sourceId?: string | null;
  sourceType?: string | null;
  status?: CopilotAgentRunStatus | null;
  workflow?: string | null;
};

export type CopilotAgentRuntimeCreateStepInput = {
  stepKey: string;
  stepType: CopilotAgentStepType;
  status?: CopilotAgentStepStatus;
  title?: string | null;
  order?: number;
  outputSummary?: Record<string, unknown>;
};

export type CopilotAgentRuntimeCreateInput = {
  workspaceId: string;
  actorId: string;
  sessionId?: string | null;
  workflow: string;
  sourceType: string;
  sourceId: string;
  status?: CopilotAgentRunStatus;
  title?: string | null;
  target?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
  steps: CopilotAgentRuntimeCreateStepInput[];
};

export type CopilotAgentRuntimeControlAction =
  | 'abandon'
  | 'approve'
  | 'cancel'
  | 'reject'
  | 'resume';

type AgentRuntimeTimelineEventInput = {
  eventType: CopilotAgentTimelineEventType;
  status: string;
  ordinal: number;
  summary: string;
  stepId: string | null;
  payload: Record<string, unknown>;
};

type AgentRuntimeCreateStepEvidence = {
  evidenceFingerprint: string;
  order: number;
  stepKey: string;
  stepType: CopilotAgentStepType;
};

type AgentRuntimeCreateRunEvidence = {
  actorId: string;
  evidenceFingerprint: string;
  sourceId: string;
  sourceType: string;
  sessionId: string | null;
  steps: AgentRuntimeCreateStepEvidence[];
  targetFingerprint: string;
  title: string | null;
  workflow: string;
  workspaceId: string;
};

export type CopilotWorkbenchTaskSegmentRecord = {
  items: CopilotAgentRunRecord[];
  capped: boolean;
};

export type CopilotWorkbenchTaskPanelRecord = {
  todo: CopilotWorkbenchTaskSegmentRecord;
  inProgress: CopilotWorkbenchTaskSegmentRecord;
  done: CopilotWorkbenchTaskSegmentRecord;
};

type AgentRuntimeExecutionResultLedgerEvidence = {
  actorId: string;
  adapterWorkflow: string;
  completedAt: Date;
  executor: string;
  failureCode: string | null;
  failureMessage: string | null;
  resultFingerprint: string;
  resultPayload: Record<string, unknown>;
  resultStatus: 'completed' | 'failed';
  runId: string;
  sideEffectMode: string;
  sideEffectsApplied: boolean;
  sourceId: string;
  sourceType: string;
  summary: string;
  workerAttempt: number;
  workerLeaseId: string;
  workflow: string;
  workspaceId: string;
};

type AgentRuntimeCancelControlAction = 'cancel' | 'cancel_requested';

function stableAgentRuntimeStringify(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableAgentRuntimeStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => {
        const item = (value as Record<string, unknown>)[key];
        return item === undefined
          ? null
          : `${JSON.stringify(key)}:${stableAgentRuntimeStringify(item)}`;
      })
      .filter(Boolean)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function agentRuntimeFingerprint(value: unknown) {
  return createHash('sha256')
    .update(stableAgentRuntimeStringify(value))
    .digest('hex')
    .slice(0, 16);
}

const AGENT_RUNTIME_WORKER_FAILURE_MESSAGE_MAX_LENGTH = 1024;
const DEFAULT_AGENT_RUNTIME_WORKER_FAILURE_MESSAGE =
  'Agent Runtime worker execution failed';
const AGENT_RUNTIME_REQUIRED_STRING_MAX_LENGTH = 512;
const AGENT_RUNTIME_TITLE_MAX_LENGTH = 512;
const AGENT_RUNTIME_CONTROL_REASON_MAX_LENGTH = 1024;
const AGENT_RUNTIME_RECORD_ONLY_SUMMARY_MAX_LENGTH = 1024;
const AGENT_RUNTIME_WORKER_COMPLETION_SUMMARY_MAX_LENGTH = 1024;
const AGENT_RUNTIME_FAILURE_CODE_MAX_LENGTH = 128;
const AGENT_RUNTIME_JSON_PAYLOAD_MAX_LENGTH = 8192;
const AGENT_RUNTIME_SIDE_EFFECT_SUMMARY_MAX_LENGTH = 4096;
const AGENT_RUNTIME_CREATE_STEP_MAX_COUNT = 32;
const AGENT_RUNTIME_MAX_STEP_ORDER = 10_000;
const DEFAULT_AGENT_RUNTIME_RECORD_ONLY_SUMMARY =
  'Record-only Agent Runtime adapter completed without external side effects.';
const DEFAULT_AGENT_RUNTIME_WORKER_COMPLETION_SUMMARY =
  'Agent Runtime workflow adapter completed without external side effects.';
const AGENT_RUNTIME_STALE_WORKER_LEASE_FAILURE_CODE = 'stale_worker_lease';
const AGENT_RUNTIME_STALE_WORKER_LEASE_FAILURE_MESSAGE =
  'Expired standalone Agent Runtime worker lease recovered with no attempts remaining.';
const AGENT_RUNTIME_REPAIR_EXECUTION_SOURCE_TYPE = 'repair_execution_request';
const AGENT_RUNTIME_REPAIR_EXECUTION_WORKFLOW =
  'prompt_registry_repair_execution';
const AGENT_RUNTIME_REPAIR_RUN_PAYLOAD_VERSION =
  'agent-runtime-repair-execution-run/v1';
const AGENT_RUNTIME_REPAIR_STEP_PAYLOAD_VERSION =
  'agent-runtime-repair-execution-step/v1';
const AGENT_RUNTIME_ADAPTER_RESOLUTION_VERSION =
  'agent-runtime-worker-adapter-resolution/v1';
const AGENT_RUNTIME_WORKER_EXECUTION_RESULT_VERSION =
  'agent-runtime-worker-execution-result/v1';
const AGENT_RUNTIME_APPROVAL_CONTROL_PAYLOAD_VERSION =
  'agent-runtime-approval-control/v1';
const AGENT_RUNTIME_RUN_STATUSES = new Set<CopilotAgentRunStatus>([
  'queued',
  'running',
  'waiting_approval',
  'waiting_for_location',
  'completed',
  'failed',
  'cancelled',
]);
const AGENT_RUNTIME_STEP_STATUSES = new Set<CopilotAgentStepStatus>([
  'pending',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'skipped',
]);
const AGENT_RUNTIME_TIMELINE_STATUSES = new Set([
  ...AGENT_RUNTIME_RUN_STATUSES,
  ...AGENT_RUNTIME_STEP_STATUSES,
]);
const AGENT_RUNTIME_STEP_TYPES = new Set<CopilotAgentStepType>([
  'model',
  'tool',
  'approval',
  'handoff',
  'codex',
  'mcp',
]);
const AGENT_RUNTIME_ADAPTER_RESOLUTION_STATUSES = new Set([
  'completed',
  'unsupported_workflow',
  'unsupported_contract',
  'execution_failed',
  'invalid_executor_result',
  'incomplete_execution',
]);
const AGENT_RUNTIME_ADAPTER_SIDE_EFFECT_MODES = new Set([
  'none',
  'workspace_write',
  'project_write',
  'external_tool',
]);
const AGENT_RUNTIME_ADAPTER_SNAPSHOT_MAX_COUNT = 24;
const WORKBENCH_TODO_LIMIT = 50;
const WORKBENCH_IN_PROGRESS_LIMIT = 50;
const WORKBENCH_DONE_LIMIT = 20;
const COPILOT_TASK_LIST_MAX_LIMIT = 100;
const WORKBENCH_DONE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function toJsonString(value: unknown) {
  return JSON.stringify(value);
}

function normalizeWorkerFailureMessage(message: string) {
  const normalized = message.trim();
  if (!normalized) {
    return DEFAULT_AGENT_RUNTIME_WORKER_FAILURE_MESSAGE;
  }
  return normalized.slice(0, AGENT_RUNTIME_WORKER_FAILURE_MESSAGE_MAX_LENGTH);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isProjectDocumentWriteRun(run: CopilotAgentRunRecord) {
  return run.steps.some(step => {
    const request = step.outputSummary.docUpdateRequest;
    return (
      step.stepType === 'tool' &&
      isRecord(request) &&
      typeof request.projectId === 'string' &&
      request.projectId.trim().length > 0
    );
  });
}

function docWriteReconfirmationRequest(outputSummary: Record<string, unknown>) {
  const request = outputSummary.reconfirmationRequest;
  if (
    !isRecord(request) ||
    request.version !== 'agent-runtime-doc-update-reconfirmation/v1' ||
    request.reason !== 'document_version_drift' ||
    request.previewStatus !== 'invalidated' ||
    typeof request.documentWorkspaceId !== 'string' ||
    typeof request.documentId !== 'string' ||
    typeof request.actualVersion !== 'string' ||
    Number.isNaN(new Date(request.actualVersion).getTime())
  ) {
    return null;
  }
  return {
    documentWorkspaceId: request.documentWorkspaceId,
    documentId: request.documentId,
    actualVersion: request.actualVersion,
  };
}

function requireAgentRuntimeString(
  value: unknown,
  field: string,
  maxLength = AGENT_RUNTIME_REQUIRED_STRING_MAX_LENGTH
) {
  if (typeof value !== 'string') {
    throw new Error(`Agent runtime ${field} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Agent runtime ${field} is required`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`Agent runtime ${field} is too long`);
  }
  return normalized;
}

function optionalAgentRuntimeString(
  value: unknown,
  field: string,
  maxLength: number
) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`Agent runtime ${field} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length > maxLength) {
    throw new Error(`Agent runtime ${field} is too long`);
  }
  return normalized;
}

function normalizeControlReason(value: unknown) {
  const normalized = optionalAgentRuntimeString(
    value,
    'control reason',
    AGENT_RUNTIME_CONTROL_REASON_MAX_LENGTH
  );
  return normalized;
}

function normalizeRecordOnlySummary(value: unknown) {
  if (value === undefined || value === null) {
    return DEFAULT_AGENT_RUNTIME_RECORD_ONLY_SUMMARY;
  }
  if (typeof value !== 'string') {
    throw new Error('Agent runtime record-only summary must be a string');
  }
  const normalized = value.trim();
  if (!normalized) {
    return DEFAULT_AGENT_RUNTIME_RECORD_ONLY_SUMMARY;
  }
  return normalized.slice(0, AGENT_RUNTIME_RECORD_ONLY_SUMMARY_MAX_LENGTH);
}

function normalizeWorkerCompletionSummary(value: unknown) {
  if (value === undefined || value === null) {
    return DEFAULT_AGENT_RUNTIME_WORKER_COMPLETION_SUMMARY;
  }
  if (typeof value !== 'string') {
    throw new Error('Agent runtime worker completion summary must be a string');
  }
  const normalized = value.trim();
  if (!normalized) {
    return DEFAULT_AGENT_RUNTIME_WORKER_COMPLETION_SUMMARY;
  }
  return normalized.slice(
    0,
    AGENT_RUNTIME_WORKER_COMPLETION_SUMMARY_MAX_LENGTH
  );
}

function normalizeWorkerSideEffectSummary(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }
  const summary = normalizeAgentRuntimeJsonObject(value, 'side-effect summary');
  const serialized = stableAgentRuntimeStringify(summary);
  if (serialized.length > AGENT_RUNTIME_SIDE_EFFECT_SUMMARY_MAX_LENGTH) {
    throw new Error('Agent runtime side-effect summary is too large');
  }
  return summary;
}

function normalizeRunStatus(value: unknown): CopilotAgentRunStatus {
  if (
    typeof value !== 'string' ||
    !AGENT_RUNTIME_RUN_STATUSES.has(value as CopilotAgentRunStatus)
  ) {
    throw new Error('Agent runtime run status is invalid');
  }
  return value as CopilotAgentRunStatus;
}

function normalizeOptionalRunStatusFilter(
  value: unknown
): CopilotAgentRunStatus | null {
  if (value == null) {
    return null;
  }
  return normalizeRunStatus(value);
}

function normalizeAgentRunListFilterString(value: unknown, field: string) {
  return optionalAgentRuntimeString(
    value,
    `run list ${field}`,
    AGENT_RUNTIME_REQUIRED_STRING_MAX_LENGTH
  );
}

function normalizeAgentRunListFilter(
  input?: CopilotAgentRunListFilter | null
): Required<CopilotAgentRunListFilter> {
  return {
    query: normalizeAgentRunListFilterString(input?.query, 'query'),
    sourceId: normalizeAgentRunListFilterString(input?.sourceId, 'source id'),
    sourceType: normalizeAgentRunListFilterString(
      input?.sourceType,
      'source type'
    ),
    status: normalizeOptionalRunStatusFilter(input?.status),
    workflow: normalizeAgentRunListFilterString(input?.workflow, 'workflow'),
  };
}

function validateAgentRuntimeSourceWorkflow(input: {
  sourceType: string;
  workflow: string;
}) {
  const isRepairExecutionSource =
    input.sourceType === AGENT_RUNTIME_REPAIR_EXECUTION_SOURCE_TYPE;
  const isRepairExecutionWorkflow =
    input.workflow === AGENT_RUNTIME_REPAIR_EXECUTION_WORKFLOW;
  if (isRepairExecutionSource !== isRepairExecutionWorkflow) {
    throw new Error(
      'Agent runtime repair execution source/workflow pair is invalid'
    );
  }
}

function normalizeStepStatus(
  value: unknown
): CopilotAgentStepStatus | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    typeof value !== 'string' ||
    !AGENT_RUNTIME_STEP_STATUSES.has(value as CopilotAgentStepStatus)
  ) {
    throw new Error('Agent runtime step status is invalid');
  }
  return value as CopilotAgentStepStatus;
}

function normalizeTimelineStatus(value: unknown) {
  if (
    typeof value !== 'string' ||
    !AGENT_RUNTIME_TIMELINE_STATUSES.has(
      value as CopilotAgentRunStatus | CopilotAgentStepStatus
    )
  ) {
    throw new Error('Agent runtime timeline status is invalid');
  }
  return value;
}

function normalizeStepType(value: unknown): CopilotAgentStepType {
  if (
    typeof value !== 'string' ||
    !AGENT_RUNTIME_STEP_TYPES.has(value as CopilotAgentStepType)
  ) {
    throw new Error('Agent runtime step type is invalid');
  }
  return value as CopilotAgentStepType;
}

function normalizeStepOrder(value: unknown, fallback: number) {
  if (value === undefined) {
    return fallback;
  }
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > AGENT_RUNTIME_MAX_STEP_ORDER
  ) {
    throw new Error('Agent runtime step order is invalid');
  }
  return value;
}

function normalizeAgentRuntimeJsonObject(
  value: unknown,
  field: string
): Record<string, unknown> {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isRecord(value)) {
    throw new Error(`Agent runtime ${field} must be an object`);
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error(`Agent runtime ${field} must be JSON serializable`);
  }
  if (serialized.length > AGENT_RUNTIME_JSON_PAYLOAD_MAX_LENGTH) {
    throw new Error(`Agent runtime ${field} is too large`);
  }
  return JSON.parse(serialized) as Record<string, unknown>;
}

function normalizeAdapterResolution(value: unknown) {
  const resolution = normalizeAgentRuntimeJsonObject(
    value,
    'adapter resolution'
  );
  const version = requireAgentRuntimeString(
    resolution.version,
    'adapter resolution version'
  );
  if (version !== AGENT_RUNTIME_ADAPTER_RESOLUTION_VERSION) {
    throw new Error(
      `Agent runtime adapter resolution version is unsupported: ${version}`
    );
  }
  const status = requireAgentRuntimeString(
    resolution.status,
    'adapter resolution status'
  );
  if (!AGENT_RUNTIME_ADAPTER_RESOLUTION_STATUSES.has(status)) {
    throw new Error(
      `Agent runtime adapter resolution status is unsupported: ${status}`
    );
  }
  requireAgentRuntimeString(resolution.workflow, 'adapter resolution workflow');
  const requestedStepTypes = normalizeAdapterResolutionStepTypes(
    resolution.requestedStepTypes,
    'requested step types'
  );
  if (
    !Array.isArray(resolution.registeredAdapters) ||
    !resolution.registeredAdapters.length
  ) {
    throw new Error(
      'Agent runtime adapter resolution registered adapters are required'
    );
  }
  if (
    resolution.registeredAdapters.length >
    AGENT_RUNTIME_ADAPTER_SNAPSHOT_MAX_COUNT
  ) {
    throw new Error(
      'Agent runtime adapter resolution registered adapters exceed the limit'
    );
  }
  const registeredAdapters = resolution.registeredAdapters.map(adapter =>
    normalizeAdapterResolutionSnapshot(adapter, 'registered adapter')
  );
  const registeredAdapterWorkflows = new Set<string>();
  for (const adapter of registeredAdapters) {
    if (registeredAdapterWorkflows.has(adapter.workflow)) {
      throw new Error(
        'Agent runtime adapter resolution registered adapters must be unique'
      );
    }
    registeredAdapterWorkflows.add(adapter.workflow);
  }
  if (status !== 'unsupported_workflow') {
    const adapter = normalizeAdapterResolutionSnapshot(
      resolution.adapter,
      'adapter'
    );
    const workflow = requireAgentRuntimeString(
      resolution.workflow,
      'adapter resolution workflow'
    );
    if (adapter.workflow !== workflow) {
      throw new Error(
        'Agent runtime adapter resolution adapter workflow must match workflow'
      );
    }
    if (
      !registeredAdapters.some(registeredAdapter =>
        adapterResolutionSnapshotsMatch(registeredAdapter, adapter)
      )
    ) {
      throw new Error(
        'Agent runtime adapter resolution adapter must be registered'
      );
    }
    if (status === 'unsupported_contract') {
      const unsupportedStepTypes = normalizeAdapterResolutionStepTypes(
        resolution.unsupportedStepTypes,
        'unsupported step types'
      );
      for (const stepType of unsupportedStepTypes) {
        if (!requestedStepTypes.includes(stepType)) {
          throw new Error(
            'Agent runtime adapter resolution unsupported step type must be requested'
          );
        }
        if (adapter.supportedStepTypes.includes(stepType)) {
          throw new Error(
            'Agent runtime adapter resolution unsupported step type must not be adapter-supported'
          );
        }
      }
    } else if (resolution.unsupportedStepTypes !== undefined) {
      throw new Error(
        'Agent runtime adapter resolution unsupported step types are only valid for unsupported contracts'
      );
    }
  } else if (resolution.adapter !== undefined) {
    throw new Error(
      'Agent runtime adapter resolution adapter is not valid for unsupported workflows'
    );
  }
  return resolution;
}

function adapterWorkflowFromResolution(
  adapterResolution: Record<string, unknown> | undefined,
  fallbackWorkflow: string
) {
  if (adapterResolution && isRecord(adapterResolution.adapter)) {
    const workflow = adapterResolution.adapter.workflow;
    if (typeof workflow === 'string' && workflow.trim()) {
      return workflow.trim();
    }
  }
  return fallbackWorkflow;
}

function sideEffectModeFromResolution(
  adapterResolution: Record<string, unknown> | undefined
) {
  if (adapterResolution && isRecord(adapterResolution.adapter)) {
    const sideEffectMode = adapterResolution.adapter.sideEffectMode;
    if (typeof sideEffectMode === 'string' && sideEffectMode.trim()) {
      return sideEffectMode.trim();
    }
  }
  return 'none';
}

function validateCompletedAdapterResolution(input: {
  adapterResolution: Record<string, unknown>;
  adapterWorkflow: string;
  runWorkflow: string;
  sideEffectMode: string;
}) {
  if (input.adapterResolution.status !== 'completed') {
    throw new Error(
      'Agent runtime completion adapter resolution status must be completed'
    );
  }
  if (input.adapterResolution.workflow !== input.runWorkflow) {
    throw new Error(
      'Agent runtime completion adapter resolution workflow must match run'
    );
  }
  const adapter = input.adapterResolution.adapter;
  if (!isRecord(adapter)) {
    throw new Error(
      'Agent runtime completion adapter resolution requires adapter'
    );
  }
  if (adapter.workflow !== input.adapterWorkflow) {
    throw new Error(
      'Agent runtime completion adapter resolution adapter workflow must match'
    );
  }
  if (adapter.sideEffectMode !== input.sideEffectMode) {
    throw new Error(
      'Agent runtime completion adapter resolution side-effect mode must match'
    );
  }
}

function normalizeAdapterResolutionStepTypes(value: unknown, field: string) {
  if (!Array.isArray(value) || !value.length) {
    throw new Error(`Agent runtime adapter resolution ${field} are required`);
  }
  if (value.length > AGENT_RUNTIME_CREATE_STEP_MAX_COUNT) {
    throw new Error(
      `Agent runtime adapter resolution ${field} exceed the limit`
    );
  }
  const normalized = value.map(stepType => normalizeStepType(stepType));
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`Agent runtime adapter resolution ${field} must be unique`);
  }
  return normalized;
}

function normalizeAdapterResolutionSnapshot(value: unknown, field: string) {
  if (!isRecord(value)) {
    throw new Error(`Agent runtime adapter resolution ${field} is required`);
  }
  const workflow = requireAgentRuntimeString(
    value.workflow,
    `adapter resolution ${field} workflow`
  );
  const supportedStepTypes = normalizeAdapterResolutionStepTypes(
    value.supportedStepTypes,
    `${field} supported step types`
  );
  const sideEffectMode = requireAgentRuntimeString(
    value.sideEffectMode,
    `adapter resolution ${field} side-effect mode`
  );
  if (!AGENT_RUNTIME_ADAPTER_SIDE_EFFECT_MODES.has(sideEffectMode)) {
    throw new Error(
      `Agent runtime adapter resolution ${field} side-effect mode is unsupported: ${sideEffectMode}`
    );
  }
  return {
    workflow,
    supportedStepTypes,
    sideEffectMode,
  };
}

function adapterResolutionSnapshotsMatch(
  left: {
    workflow: string;
    supportedStepTypes: readonly CopilotAgentStepType[];
    sideEffectMode: string;
  },
  right: {
    workflow: string;
    supportedStepTypes: readonly CopilotAgentStepType[];
    sideEffectMode: string;
  }
) {
  return (
    left.workflow === right.workflow &&
    left.sideEffectMode === right.sideEffectMode &&
    left.supportedStepTypes.length === right.supportedStepTypes.length &&
    left.supportedStepTypes.every(stepType =>
      right.supportedStepTypes.includes(stepType)
    )
  );
}

function normalizeOptionalAgentRuntimeJsonObject(
  value: unknown,
  field: string
) {
  return value === undefined
    ? undefined
    : normalizeAgentRuntimeJsonObject(value, field);
}

function hydrateAgentRuntimeJsonObject(value: unknown) {
  try {
    return normalizeAgentRuntimeJsonObject(value, 'persisted JSON payload');
  } catch {
    return {};
  }
}

function hydrateAgentRuntimeStep(
  record: CopilotAgentStepRecord
): CopilotAgentStepRecord {
  return {
    ...record,
    outputSummary: hydrateAgentRuntimeJsonObject(record.outputSummary),
  };
}

function hydrateAgentRuntimeTimelineEvent(
  record: CopilotAgentTimelineEventRecord
): CopilotAgentTimelineEventRecord {
  return {
    ...record,
    payload: hydrateAgentRuntimeJsonObject(record.payload),
  };
}

function hydrateAgentRuntimeExecutionResult(
  record: CopilotAgentRuntimeExecutionResultRecord
): CopilotAgentRuntimeExecutionResultRecord {
  return {
    ...record,
    resultPayload: hydrateAgentRuntimeJsonObject(record.resultPayload),
  };
}

function latestAgentRuntimeControlAction(run: CopilotAgentRunRecord) {
  for (let index = run.timelineEvents.length - 1; index >= 0; index--) {
    const action = run.timelineEvents[index].payload.action;
    if (typeof action === 'string') {
      return action;
    }
  }
  return null;
}

function assertAgentRuntimeRunMatchesCreateConflictEvidence(
  run: CopilotAgentRunRecord,
  expected: AgentRuntimeCreateRunEvidence
) {
  if (
    run.workspaceId !== expected.workspaceId ||
    run.actorId !== expected.actorId ||
    run.sessionId !== expected.sessionId ||
    run.workflow !== expected.workflow ||
    run.sourceType !== expected.sourceType ||
    run.sourceId !== expected.sourceId ||
    run.title !== expected.title ||
    run.targetFingerprint !== expected.targetFingerprint ||
    run.evidenceFingerprint !== expected.evidenceFingerprint ||
    run.steps.length !== expected.steps.length
  ) {
    throw new Error(
      'Agent runtime run conflict reused mismatched create evidence'
    );
  }

  for (let index = 0; index < expected.steps.length; index++) {
    const step = run.steps[index];
    const expectedStep = expected.steps[index];
    if (
      !step ||
      step.stepKey !== expectedStep.stepKey ||
      step.stepType !== expectedStep.stepType ||
      step.order !== expectedStep.order ||
      step.evidenceFingerprint !== expectedStep.evidenceFingerprint
    ) {
      throw new Error(
        'Agent runtime run conflict reused mismatched create evidence'
      );
    }
  }
}

function assertAgentRuntimeExecutionResultMatchesLedgerEvidence(
  result: CopilotAgentRuntimeExecutionResultRecord,
  expected: AgentRuntimeExecutionResultLedgerEvidence
) {
  const resultPayloadFingerprint = agentRuntimeFingerprint({
    version: 'agent-runtime-execution-result-payload/readback/v1',
    payload: result.resultPayload,
  });
  const expectedPayloadFingerprint = agentRuntimeFingerprint({
    version: 'agent-runtime-execution-result-payload/readback/v1',
    payload: expected.resultPayload,
  });
  if (
    result.runId !== expected.runId ||
    result.workspaceId !== expected.workspaceId ||
    result.actorId !== expected.actorId ||
    result.workflow !== expected.workflow ||
    result.sourceType !== expected.sourceType ||
    result.sourceId !== expected.sourceId ||
    result.adapterWorkflow !== expected.adapterWorkflow ||
    result.executor !== expected.executor ||
    result.resultStatus !== expected.resultStatus ||
    result.sideEffectMode !== expected.sideEffectMode ||
    result.sideEffectsApplied !== expected.sideEffectsApplied ||
    result.summary !== expected.summary ||
    result.failureCode !== expected.failureCode ||
    result.failureMessage !== expected.failureMessage ||
    result.resultFingerprint !== expected.resultFingerprint ||
    result.workerAttempt !== expected.workerAttempt ||
    result.workerLeaseId !== expected.workerLeaseId ||
    result.completedAt.getTime() !== expected.completedAt.getTime() ||
    resultPayloadFingerprint !== expectedPayloadFingerprint
  ) {
    throw new Error(
      'Agent runtime execution result conflict reused mismatched ledger evidence'
    );
  }
}

function normalizeListLimit(limit: number | undefined) {
  return Math.min(Math.max(limit ?? 8, 1), 20);
}

function normalizeCopilotTaskListLimit(limit: number | undefined) {
  return Math.min(Math.max(limit ?? 8, 1), COPILOT_TASK_LIST_MAX_LIMIT);
}

function normalizeInitialStepStatus(
  status: CopilotAgentRunStatus,
  stepStatus?: CopilotAgentStepStatus
): CopilotAgentStepStatus {
  if (stepStatus) {
    return stepStatus;
  }
  switch (status) {
    case 'queued':
      return 'pending';
    case 'running':
      return 'running';
    case 'waiting_approval':
      return 'waiting_approval';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'skipped';
    default:
      return 'pending';
  }
}

function timelineEventTypeForStep(
  stepType: CopilotAgentStepType
): CopilotAgentTimelineEventType {
  switch (stepType) {
    case 'approval':
      return 'approval_step';
    case 'codex':
      return 'codex_step';
    case 'handoff':
      return 'handoff_step';
    case 'mcp':
      return 'mcp_step';
    case 'tool':
      return 'tool_step';
    case 'model':
    default:
      return 'model_step';
  }
}

function isTerminalRunStatus(status: CopilotAgentRunStatus) {
  return (
    status === 'completed' || status === 'failed' || status === 'cancelled'
  );
}

function isActiveStepStatus(status: CopilotAgentStepStatus) {
  return (
    status === 'pending' ||
    status === 'running' ||
    status === 'waiting_approval'
  );
}

function isTerminalStepStatus(status: CopilotAgentStepStatus) {
  return status === 'completed' || status === 'failed' || status === 'skipped';
}

function nextAgentRuntimeTransitionTimestamp(
  run: CopilotAgentRunRecord,
  proposedAt = new Date()
) {
  const persistedFloor = Math.max(
    run.createdAt.getTime(),
    run.updatedAt.getTime(),
    run.startedAt?.getTime() ?? 0,
    run.completedAt?.getTime() ?? 0,
    run.queuedAt?.getTime() ?? 0,
    run.lastAttemptAt?.getTime() ?? 0,
    ...run.steps.flatMap(step => [
      step.createdAt.getTime(),
      step.updatedAt.getTime(),
      step.startedAt?.getTime() ?? 0,
      step.completedAt?.getTime() ?? 0,
    ])
  );
  return new Date(Math.max(proposedAt.getTime(), persistedFloor + 1));
}

function repairExecutionSideEffectProjection(
  record: CopilotRepairExecutionRecord
) {
  const sideEffectSummary = isRecord(record.runtimeResult.sideEffectSummary)
    ? record.runtimeResult.sideEffectSummary
    : null;
  const rollbackContract = isRecord(sideEffectSummary?.rollbackContract)
    ? sideEffectSummary.rollbackContract
    : null;

  return {
    ...(record.runtimeResult.sideEffectFingerprint
      ? {
          sideEffectFingerprint: record.runtimeResult.sideEffectFingerprint,
        }
      : {}),
    ...(record.runtimeResult.sideEffectKind
      ? { sideEffectKind: record.runtimeResult.sideEffectKind }
      : {}),
    ...(record.runtimeResult.sideEffectRecordId
      ? {
          sideEffectRecordId: record.runtimeResult.sideEffectRecordId,
        }
      : {}),
    ...(rollbackContract
      ? { sideEffectRollbackContract: rollbackContract }
      : {}),
  };
}

function timelineFingerprintWithEvents(
  run: CopilotAgentRunRecord,
  events: AgentRuntimeTimelineEventInput[]
) {
  return agentRuntimeFingerprint({
    version: 'agent-runtime-timeline/v1',
    events: [
      ...run.timelineEvents.map(item => ({
        eventType: item.eventType,
        status: item.status,
        ordinal: item.ordinal,
        summary: item.summary,
      })),
      ...events.map(event => ({
        eventType: event.eventType,
        status: event.status,
        ordinal: event.ordinal,
        summary: event.summary,
      })),
    ],
  });
}

function controlledRunTimeline(input: {
  action: CopilotAgentRuntimeControlAction | AgentRuntimeCancelControlAction;
  actorId: string;
  reason?: string | null;
  run: CopilotAgentRunRecord;
  startedAt: Date;
}): AgentRuntimeTimelineEventInput {
  const approvalDecision =
    input.action === 'approve' || input.action === 'reject';
  const status: CopilotAgentRunStatus =
    input.action === 'approve'
      ? 'queued'
      : input.action === 'abandon' ||
          input.action === 'cancel' ||
          input.action === 'reject'
        ? 'cancelled'
        : input.action === 'cancel_requested'
          ? 'running'
          : 'queued';
  const nextOrdinal =
    Math.max(-1, ...input.run.timelineEvents.map(event => event.ordinal)) + 1;
  return {
    eventType:
      input.action === 'cancel' || input.action === 'cancel_requested'
        ? ('run_cancellation' as const)
        : ('run_status' as const),
    status,
    ordinal: nextOrdinal,
    summary:
      input.action === 'abandon'
        ? 'Failed agent runtime run manually abandoned'
        : input.action === 'cancel'
          ? 'Agent runtime run manually cancelled'
          : input.action === 'approve'
            ? 'Agent runtime run manually approved'
            : input.action === 'reject'
              ? 'Agent runtime run manually rejected'
              : input.action === 'cancel_requested'
                ? 'Agent runtime run cancellation requested'
                : 'Agent runtime run manually resumed',
    stepId: null,
    payload: {
      version: approvalDecision
        ? AGENT_RUNTIME_APPROVAL_CONTROL_PAYLOAD_VERSION
        : 'agent-runtime-manual-control/v1',
      action: input.action,
      actorId: input.actorId,
      previousStatus: input.run.status,
      workflow: input.run.workflow,
      sourceType: input.run.sourceType,
      sourceId: input.run.sourceId,
      controlledAt: input.startedAt.toISOString(),
      reason: normalizeControlReason(input.reason),
    },
  };
}

function controlledStepTimeline(input: {
  action: CopilotAgentRuntimeControlAction;
  actorId: string;
  ordinal: number;
  reason?: string | null;
  run: CopilotAgentRunRecord;
  startedAt: Date;
  status: CopilotAgentStepStatus;
  step: CopilotAgentStepRecord;
}) {
  const approvalDecision =
    input.action === 'approve' || input.action === 'reject';
  return {
    eventType: timelineEventTypeForStep(input.step.stepType),
    status: input.status,
    ordinal: input.ordinal,
    summary:
      input.action === 'cancel'
        ? `Agent runtime ${input.step.stepType} step manually cancelled`
        : input.action === 'approve'
          ? `Agent runtime ${input.step.stepType} step manually approved`
          : input.action === 'reject'
            ? `Agent runtime ${input.step.stepType} step manually rejected`
            : `Agent runtime ${input.step.stepType} step manually resumed`,
    stepId: input.step.id,
    payload: {
      version: approvalDecision
        ? AGENT_RUNTIME_APPROVAL_CONTROL_PAYLOAD_VERSION
        : 'agent-runtime-manual-control/v1',
      action: input.action,
      actorId: input.actorId,
      previousStatus: input.step.status,
      workflow: input.run.workflow,
      sourceType: input.run.sourceType,
      sourceId: input.run.sourceId,
      controlledAt: input.startedAt.toISOString(),
      reason: normalizeControlReason(input.reason),
    },
  };
}

function mapRepairExecutionRunStatus(
  status: CopilotRepairExecutionRecord['status']
): CopilotAgentRunStatus {
  switch (status) {
    case 'queued':
    case 'running':
    case 'waiting_approval':
    case 'completed':
    case 'failed':
    case 'cancelled':
      return status;
    default:
      return 'failed';
  }
}

function mapRepairExecutionStepStatus(
  status: CopilotRepairExecutionRecord['status']
): CopilotAgentStepStatus {
  switch (status) {
    case 'queued':
      return 'pending';
    case 'running':
      return 'running';
    case 'waiting_approval':
      return 'waiting_approval';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'skipped';
    default:
      return 'failed';
  }
}

function repairExecutionTimeline(input: {
  runId: string;
  stepId: string;
  record: CopilotRepairExecutionRecord;
  startOrdinal?: number;
}) {
  const runStatus = mapRepairExecutionRunStatus(input.record.status);
  const stepStatus = mapRepairExecutionStepStatus(input.record.status);
  const stepEventType =
    stepStatus === 'waiting_approval' || runStatus === 'cancelled'
      ? ('approval_step' as const)
      : ('model_step' as const);
  const stepSummary =
    runStatus === 'queued'
      ? 'Repair execution queued for worker'
      : runStatus === 'running'
        ? 'Repair execution worker running'
        : stepStatus === 'waiting_approval'
          ? 'Repair execution waiting for approval'
          : runStatus === 'cancelled'
            ? input.record.runtimeResult.executor ===
              'manual_repair_execution_control'
              ? 'Repair execution manually cancelled'
              : input.record.runtimeResult.executor ===
                  'repair_execution_worker_cooperative_cancel'
                ? 'Repair execution cooperatively cancelled before side effects'
                : 'Repair execution approval rejected'
            : input.record.runtimeResult.sideEffectsApplied
              ? 'Repair execution applied approved side effect'
              : 'Repair execution safe runtime step completed';
  return [
    {
      eventType: 'run_status' as const,
      status: runStatus,
      ordinal: input.startOrdinal ?? 0,
      summary: `Repair execution run ${runStatus}`,
      stepId: null,
      payload: {
        version: AGENT_RUNTIME_REPAIR_RUN_PAYLOAD_VERSION,
        workflow: 'prompt_registry_repair_execution',
        sourceType: 'repair_execution_request',
        sourceId: input.record.id,
        requestFingerprint: input.record.requestFingerprint,
        repairJobFingerprint: input.record.repairJobFingerprint,
      },
    },
    {
      eventType: stepEventType,
      status: stepStatus,
      ordinal: (input.startOrdinal ?? 0) + 1,
      summary: stepSummary,
      stepId: input.stepId,
      payload: {
        version: AGENT_RUNTIME_REPAIR_STEP_PAYLOAD_VERSION,
        repairExecutionRequestId: input.record.id,
        approvalState: input.record.approvalState,
        permissionStatus: input.record.permissionStatus,
        runtimeExecutor: input.record.runtimeResult.executor,
        sideEffectsApplied: input.record.runtimeResult.sideEffectsApplied,
        ...repairExecutionSideEffectProjection(input.record),
      },
    },
  ];
}

@Injectable()
export class CopilotAgentRuntimeModel extends BaseModel {
  @Transactional()
  async createRun(
    input: CopilotAgentRuntimeCreateInput
  ): Promise<CopilotAgentRunRecord> {
    const workflow = requireAgentRuntimeString(input.workflow, 'workflow');
    const sourceType = requireAgentRuntimeString(
      input.sourceType,
      'source type'
    );
    validateAgentRuntimeSourceWorkflow({ sourceType, workflow });
    const sourceId = requireAgentRuntimeString(input.sourceId, 'source id');
    const sessionId = optionalAgentRuntimeString(
      input.sessionId,
      'session id',
      AGENT_RUNTIME_REQUIRED_STRING_MAX_LENGTH
    );
    const title = optionalAgentRuntimeString(
      input.title,
      'title',
      AGENT_RUNTIME_TITLE_MAX_LENGTH
    );
    const target = normalizeOptionalAgentRuntimeJsonObject(
      input.target,
      'target'
    );
    const evidence = normalizeOptionalAgentRuntimeJsonObject(
      input.evidence,
      'evidence'
    );
    if (!input.steps.length) {
      throw new Error('Agent runtime run requires at least one step');
    }
    if (input.steps.length > AGENT_RUNTIME_CREATE_STEP_MAX_COUNT) {
      throw new Error('Agent runtime run has too many steps');
    }

    if (sessionId) {
      const sessionRows = await this.db.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM ai_sessions_metadata
        WHERE id = ${sessionId}
          AND user_id = ${input.actorId}
          AND workspace_id = ${input.workspaceId}
          AND deleted_at IS NULL
        LIMIT 1
      `;
      if (!sessionRows.length) {
        throw new Error(
          'Agent runtime session must be active and match its actor and workspace'
        );
      }
    }

    const existing = await this.getBySource(
      input.workspaceId,
      sourceType,
      sourceId
    );
    if (existing) {
      if (existing.sessionId !== sessionId) {
        throw new Error(
          'Agent runtime run conflict reused mismatched create session'
        );
      }
      return existing;
    }

    const runId = randomUUID();
    const createdAt = new Date();
    const runStatus = normalizeRunStatus(input.status ?? 'queued');
    const queuedAt = runStatus === 'queued' ? createdAt : null;
    const completedAt =
      runStatus === 'completed' ||
      runStatus === 'failed' ||
      runStatus === 'cancelled'
        ? createdAt
        : null;
    const targetFingerprint = agentRuntimeFingerprint({
      version: 'agent-runtime-generic-target/v1',
      workflow,
      sourceType,
      sourceId,
      target: target ?? {},
    });
    const evidenceFingerprint = agentRuntimeFingerprint({
      version: 'agent-runtime-generic-evidence/v1',
      workflow,
      sourceType,
      sourceId,
      evidence: evidence ?? {},
    });
    const steps = input.steps.map((step, index) => {
      const stepType = normalizeStepType(step.stepType);
      return {
        id: randomUUID(),
        stepKey: requireAgentRuntimeString(step.stepKey, 'step key'),
        stepType,
        status: normalizeInitialStepStatus(
          runStatus,
          normalizeStepStatus(step.status)
        ),
        title: optionalAgentRuntimeString(
          step.title,
          'step title',
          AGENT_RUNTIME_TITLE_MAX_LENGTH
        ),
        order: normalizeStepOrder(step.order, index),
        outputSummary: normalizeOptionalAgentRuntimeJsonObject(
          step.outputSummary,
          'step output summary'
        ),
      };
    });
    const timelineEvents = [
      {
        eventType: 'run_status' as const,
        status: runStatus,
        ordinal: 0,
        summary: `Agent runtime run ${runStatus}`,
        stepId: null,
        payload: {
          workflow,
          sourceType,
          sourceId,
        },
      },
      ...steps.map((step, index) => ({
        eventType: timelineEventTypeForStep(step.stepType),
        status: step.status,
        ordinal: index + 1,
        summary: `Agent runtime ${step.stepType} step ${step.status}`,
        stepId: step.id,
        payload: {
          workflow,
          sourceType,
          sourceId,
          stepKey: step.stepKey,
          stepType: step.stepType,
        },
      })),
    ];
    const timelineFingerprint = agentRuntimeFingerprint({
      version: 'agent-runtime-timeline/v1',
      events: timelineEvents.map(event => ({
        eventType: event.eventType,
        status: event.status,
        ordinal: event.ordinal,
        summary: event.summary,
      })),
    });

    const insertedRows = await this.db.$queryRaw<Array<{ id: string }>>`
      INSERT INTO ai_agent_runs (
        id,
        workspace_id,
        actor_id,
        session_id,
        workflow,
        source_type,
        source_id,
        status,
        title,
        target_fingerprint,
        evidence_fingerprint,
        timeline_fingerprint,
        started_at,
        completed_at,
        failure_code,
        failure_message,
        queued_at,
        worker_lease_id,
        worker_lease_expires_at,
        worker_attempt,
        worker_max_attempts,
        last_attempt_at,
        created_at,
        updated_at
      )
      VALUES (
        ${runId},
        ${input.workspaceId},
        ${input.actorId},
        ${sessionId},
        ${workflow},
        ${sourceType},
        ${sourceId},
        ${runStatus},
        ${title},
        ${targetFingerprint},
        ${evidenceFingerprint},
        ${timelineFingerprint},
        ${createdAt},
        ${completedAt},
        ${null},
        ${null},
        ${queuedAt},
        ${null},
        ${null},
        ${0},
        ${1},
        ${null},
        ${createdAt},
        ${createdAt}
      )
      ON CONFLICT (workspace_id, source_type, source_id) DO NOTHING
      RETURNING id
    `;

    if (!insertedRows.length) {
      const reused = await this.getBySource(
        input.workspaceId,
        sourceType,
        sourceId
      );
      if (!reused) {
        throw new Error(
          `Agent runtime run could not be reused after source conflict: ${sourceType}:${sourceId}`
        );
      }
      assertAgentRuntimeRunMatchesCreateConflictEvidence(reused, {
        actorId: input.actorId,
        evidenceFingerprint,
        sessionId,
        sourceId,
        sourceType,
        steps: steps.map(step => ({
          evidenceFingerprint: agentRuntimeFingerprint({
            version: 'agent-runtime-step-evidence/v1',
            runId: reused.id,
            stepKey: step.stepKey,
            stepType: step.stepType,
            evidenceFingerprint,
          }),
          order: step.order,
          stepKey: step.stepKey,
          stepType: step.stepType,
        })),
        targetFingerprint,
        title,
        workflow,
        workspaceId: input.workspaceId,
      });
      return reused;
    }

    for (const step of steps) {
      const stepEvidenceFingerprint = agentRuntimeFingerprint({
        version: 'agent-runtime-step-evidence/v1',
        runId,
        stepKey: step.stepKey,
        stepType: step.stepType,
        evidenceFingerprint,
      });
      const stepCompletedAt = isTerminalStepStatus(step.status)
        ? createdAt
        : null;
      await this.db.$executeRaw`
        INSERT INTO ai_agent_steps (
          id,
          run_id,
          workspace_id,
          actor_id,
          step_key,
          step_type,
          status,
          title,
          "order",
          evidence_fingerprint,
          output_summary,
          started_at,
          completed_at,
          created_at,
          updated_at
        )
        VALUES (
          ${step.id},
          ${runId},
          ${input.workspaceId},
          ${input.actorId},
          ${step.stepKey},
          ${step.stepType},
          ${step.status},
          ${step.title},
          ${step.order},
          ${stepEvidenceFingerprint},
          ${toJsonString({
            ...step.outputSummary,
            version: 'agent-runtime-step-output-summary/v1',
          })}::jsonb,
          ${createdAt},
          ${stepCompletedAt},
          ${createdAt},
          ${createdAt}
        )
      `;
    }

    for (const event of timelineEvents) {
      const eventId = randomUUID();
      const eventFingerprint = agentRuntimeFingerprint({
        version: 'agent-runtime-timeline-event/v1',
        runId,
        stepId: event.stepId,
        eventType: event.eventType,
        status: event.status,
        ordinal: event.ordinal,
        summary: event.summary,
        payload: event.payload,
      });
      await this.db.$executeRaw`
        INSERT INTO ai_agent_timeline_events (
          id,
          run_id,
          step_id,
          workspace_id,
          actor_id,
          event_type,
          status,
          ordinal,
          summary,
          payload,
          event_fingerprint,
          created_at
        )
        VALUES (
          ${eventId},
          ${runId},
          ${event.stepId},
          ${input.workspaceId},
          ${input.actorId},
          ${event.eventType},
          ${event.status},
          ${event.ordinal},
          ${event.summary},
          ${toJsonString(event.payload)}::jsonb,
          ${eventFingerprint},
          ${createdAt}
        )
      `;
    }

    const run = await this.get(input.workspaceId, runId);
    if (!run) {
      throw new Error(`Created agent runtime run not found: ${runId}`);
    }
    return run;
  }

  @Transactional()
  async controlRun(input: {
    workspaceId: string;
    actorId: string;
    id: string;
    action: CopilotAgentRuntimeControlAction;
    reason?: string | null;
    expectedApprovalFingerprint?: string;
  }): Promise<CopilotAgentRunRecord> {
    const existing = await this.get(input.workspaceId, input.id);
    if (!existing) {
      throw new Error(`Agent runtime run not found: ${input.id}`);
    }
    return await this.controlExistingRun(input, existing);
  }

  @Transactional()
  async controlRunForWorkspaceViewer(input: {
    workspaceId: string;
    actorId: string;
    id: string;
    action: CopilotAgentRuntimeControlAction;
    reason?: string | null;
    expectedApprovalFingerprint?: string;
  }): Promise<CopilotAgentRunRecord> {
    const existing = await this.getForWorkspaceViewer(
      input.workspaceId,
      input.actorId,
      input.id
    );
    if (!existing) {
      throw new Error(`Agent runtime run not found: ${input.id}`);
    }
    return await this.controlExistingRun(input, existing);
  }

  @Transactional()
  async controlRunForActor(input: {
    workspaceId: string;
    actorId: string;
    id: string;
    action: CopilotAgentRuntimeControlAction;
    reason?: string | null;
    expectedApprovalFingerprint?: string;
  }): Promise<CopilotAgentRunRecord> {
    const existing = await this.getForActor(
      input.workspaceId,
      input.actorId,
      input.id
    );
    if (!existing) {
      throw new Error(`Copilot task not found: ${input.id}`);
    }
    return await this.controlExistingRun(input, existing);
  }

  private async controlExistingRun(
    input: {
      workspaceId: string;
      actorId: string;
      id: string;
      action: CopilotAgentRuntimeControlAction;
      reason?: string | null;
      expectedApprovalFingerprint?: string;
    },
    existing: CopilotAgentRunRecord
  ) {
    if (existing.sourceType === 'repair_execution_request') {
      throw new Error(
        'Repair execution Agent Runtime runs must be controlled through repair execution controls'
      );
    }
    if (input.action === 'abandon') {
      return await this.abandonFailedStandaloneRun(input, existing);
    }
    if (input.action === 'approve' || input.action === 'reject') {
      return await this.decideStandaloneApprovalRun(input, existing);
    }
    if (input.action === 'cancel') {
      return await this.cancelStandaloneRun(input, existing);
    }
    if (input.action === 'resume') {
      return await this.resumeStandaloneRun(input, existing);
    }
    throw new Error('Unsupported Agent Runtime control action');
  }

  private async abandonFailedStandaloneRun(
    input: {
      workspaceId: string;
      actorId: string;
      id: string;
      action: CopilotAgentRuntimeControlAction;
      reason?: string | null;
    },
    existing: CopilotAgentRunRecord
  ) {
    if (
      existing.status === 'cancelled' &&
      latestAgentRuntimeControlAction(existing) === 'abandon'
    ) {
      return existing;
    }
    if (existing.status !== 'failed') {
      throw new Error(
        `Agent runtime run cannot be abandoned from status: ${existing.status}`
      );
    }

    const now = nextAgentRuntimeTransitionTimestamp(existing);
    const reason = normalizeControlReason(input.reason);
    const event = controlledRunTimeline({
      action: 'abandon',
      actorId: input.actorId,
      reason,
      run: existing,
      startedAt: now,
    });
    const timelineFingerprint = timelineFingerprintWithEvents(existing, [
      event,
    ]);
    const abandonedRows = await this.db.$queryRaw<Array<{ id: string }>>`
      UPDATE ai_agent_runs
      SET
        status = ${'cancelled'},
        timeline_fingerprint = ${timelineFingerprint},
        completed_at = ${now},
        queued_at = ${null},
        worker_lease_id = ${null},
        worker_lease_expires_at = ${null},
        updated_at = ${now}
      WHERE workspace_id = ${input.workspaceId}
        AND id = ${input.id}
        AND actor_id = ${existing.actorId}
        AND source_type <> ${'repair_execution_request'}
        AND source_type = ${existing.sourceType}
        AND source_id = ${existing.sourceId}
        AND workflow = ${existing.workflow}
        AND status = ${'failed'}
        AND title IS NOT DISTINCT FROM ${existing.title}
        AND target_fingerprint = ${existing.targetFingerprint}
        AND evidence_fingerprint = ${existing.evidenceFingerprint}
        AND timeline_fingerprint = ${existing.timelineFingerprint}
        AND started_at IS NOT DISTINCT FROM ${existing.startedAt}
        AND completed_at IS NOT DISTINCT FROM ${existing.completedAt}
        AND failure_code IS NOT DISTINCT FROM ${existing.failureCode}
        AND failure_message IS NOT DISTINCT FROM ${existing.failureMessage}
        AND queued_at IS NOT DISTINCT FROM ${existing.queuedAt}
        AND worker_lease_id IS NOT DISTINCT FROM ${existing.workerLeaseId}
        AND worker_lease_expires_at IS NOT DISTINCT FROM ${
          existing.workerLeaseExpiresAt
        }
        AND worker_attempt = ${existing.workerAttempt}
        AND worker_max_attempts = ${existing.workerMaxAttempts}
        AND last_attempt_at IS NOT DISTINCT FROM ${existing.lastAttemptAt}
        AND created_at = ${existing.createdAt}
        AND updated_at IS NOT DISTINCT FROM ${existing.updatedAt}
      RETURNING id
    `;
    if (!abandonedRows.length) {
      throw new Error(
        `Agent runtime run could not be abandoned because its state changed: ${input.id}`
      );
    }

    await this.insertTimelineEvent({
      actorId: input.actorId,
      event,
      runId: existing.id,
      workspaceId: input.workspaceId,
      createdAt: now,
    });

    const run = await this.get(input.workspaceId, input.id);
    if (!run) {
      throw new Error(`Abandoned agent runtime run not found: ${input.id}`);
    }
    return run;
  }

  private async decideStandaloneApprovalRun(
    input: {
      workspaceId: string;
      actorId: string;
      id: string;
      action: CopilotAgentRuntimeControlAction;
      reason?: string | null;
      expectedApprovalFingerprint?: string;
    },
    existing: CopilotAgentRunRecord
  ) {
    if (input.action !== 'approve' && input.action !== 'reject') {
      throw new Error('Unsupported Agent Runtime approval control action');
    }
    if (existing.status !== 'waiting_approval') {
      throw new Error(
        `Agent runtime run cannot be ${input.action}d from status: ${existing.status}`
      );
    }

    if (
      input.action === 'approve' &&
      (input.expectedApprovalFingerprint !== undefined ||
        existing.steps.some(step =>
          docWriteReconfirmationRequest(step.outputSummary)
        )) &&
      input.expectedApprovalFingerprint !== existing.timelineFingerprint
    ) {
      throw new Error(
        'Agent runtime approval changed; review the current preview before confirming'
      );
    }

    const now = nextAgentRuntimeTransitionTimestamp(existing);
    const reason = normalizeControlReason(input.reason);
    const approved = input.action === 'approve';
    const reconfirmationApproval = approved
      ? existing.steps
          .filter(
            step =>
              step.stepType === 'approval' && step.status === 'waiting_approval'
          )
          .map(step => ({
            step,
            request: docWriteReconfirmationRequest(step.outputSummary),
          }))
          .find(item => item.request !== null)
      : undefined;
    const reconfirmation = reconfirmationApproval?.request ?? null;
    const reconfirmationTool = reconfirmation
      ? existing.steps.find(step => {
          if (step.stepType !== 'tool' || !isActiveStepStatus(step.status)) {
            return false;
          }
          const request = step.outputSummary.docUpdateRequest;
          return (
            isRecord(request) &&
            request.docId === reconfirmation.documentId &&
            (request.sourceWorkspaceId ??
              request.workspaceId ??
              step.workspaceId) === reconfirmation.documentWorkspaceId
          );
        })
      : undefined;
    if (reconfirmation && !reconfirmationTool) {
      throw new Error(
        `Agent runtime doc update re-confirmation is missing its target tool step: ${existing.id}`
      );
    }
    const reconfirmationControl = reconfirmation
      ? {
          version: 'agent-runtime-doc-update-reconfirmation-control/v1',
          status: 'confirmed',
          actorId: input.actorId,
          confirmedAt: now.toISOString(),
          confirmedVersion: reconfirmation.actualVersion,
        }
      : null;
    const stepDecisions = existing.steps.map(step => {
      const nextStatus: CopilotAgentStepStatus = approved
        ? step.stepType === 'approval' && isActiveStepStatus(step.status)
          ? 'completed'
          : isTerminalStepStatus(step.status)
            ? step.status
            : 'pending'
        : isActiveStepStatus(step.status)
          ? 'skipped'
          : step.status;
      const outputPatch: Record<string, unknown> = {};
      if (
        reconfirmationControl &&
        (step.id === reconfirmationApproval?.step.id ||
          step.id === reconfirmationTool?.id)
      ) {
        outputPatch.reconfirmationControl = reconfirmationControl;
      }
      if (reconfirmation && step.id === reconfirmationTool?.id) {
        const request = step.outputSummary.docUpdateRequest;
        if (!isRecord(request)) {
          throw new Error(
            `Agent runtime doc update re-confirmation request is invalid: ${step.id}`
          );
        }
        outputPatch.docUpdateRequest = {
          ...request,
          expectedDocumentVersion: reconfirmation.actualVersion,
        };
      }
      return { step, nextStatus, outputPatch };
    });
    const changedStepDecisions = stepDecisions.filter(
      decision =>
        decision.nextStatus !== decision.step.status ||
        Object.keys(decision.outputPatch).length > 0
    );
    const event = controlledRunTimeline({
      action: input.action,
      actorId: input.actorId,
      reason,
      run: existing,
      startedAt: now,
    });
    const controlledStepEvents = changedStepDecisions.map(
      ({ step, nextStatus }, index) =>
        controlledStepTimeline({
          action: input.action,
          actorId: input.actorId,
          ordinal: event.ordinal + index + 1,
          reason,
          run: existing,
          startedAt: now,
          status: nextStatus,
          step,
        })
    );
    const events = [event, ...controlledStepEvents];
    const timelineFingerprint = timelineFingerprintWithEvents(existing, events);

    const decidedRows = await this.db.$queryRaw<Array<{ id: string }>>`
      UPDATE ai_agent_runs
      SET
        status = ${approved ? 'queued' : 'cancelled'},
        timeline_fingerprint = ${timelineFingerprint},
        completed_at = ${approved ? null : now},
        failure_code = ${null},
        failure_message = ${null},
        queued_at = ${approved ? now : null},
        worker_lease_id = ${null},
        worker_lease_expires_at = ${null},
        updated_at = ${now}
      WHERE workspace_id = ${input.workspaceId}
        AND id = ${input.id}
        AND actor_id = ${existing.actorId}
        AND source_type <> ${'repair_execution_request'}
        AND source_type = ${existing.sourceType}
        AND source_id = ${existing.sourceId}
        AND workflow = ${existing.workflow}
        AND status = ${'waiting_approval'}
        AND title IS NOT DISTINCT FROM ${existing.title}
        AND target_fingerprint = ${existing.targetFingerprint}
        AND evidence_fingerprint = ${existing.evidenceFingerprint}
        AND timeline_fingerprint = ${existing.timelineFingerprint}
        AND started_at IS NOT DISTINCT FROM ${existing.startedAt}
        AND completed_at IS NOT DISTINCT FROM ${existing.completedAt}
        AND failure_code IS NOT DISTINCT FROM ${existing.failureCode}
        AND failure_message IS NOT DISTINCT FROM ${existing.failureMessage}
        AND queued_at IS NOT DISTINCT FROM ${existing.queuedAt}
        AND worker_lease_id IS NOT DISTINCT FROM ${existing.workerLeaseId}
        AND worker_lease_expires_at IS NOT DISTINCT FROM ${
          existing.workerLeaseExpiresAt
        }
        AND worker_attempt = ${existing.workerAttempt}
        AND worker_max_attempts = ${existing.workerMaxAttempts}
        AND last_attempt_at IS NOT DISTINCT FROM ${existing.lastAttemptAt}
        AND created_at = ${existing.createdAt}
        AND updated_at IS NOT DISTINCT FROM ${existing.updatedAt}
      RETURNING id
    `;
    if (!decidedRows.length) {
      throw new Error(
        `Agent runtime approval decision could not update run because its state changed: ${input.id}`
      );
    }

    for (const { step, nextStatus, outputPatch } of changedStepDecisions) {
      const nextCompletedAt =
        nextStatus === 'completed' || nextStatus === 'skipped'
          ? (step.completedAt ?? now)
          : null;
      const updatedRows = await this.db.$queryRaw<Array<{ id: string }>>`
        UPDATE ai_agent_steps
        SET
          status = ${nextStatus},
          completed_at = ${nextCompletedAt},
          output_summary = (
            CASE
              WHEN jsonb_typeof(output_summary) = ${'object'} THEN output_summary
              ELSE ${'{}'}::jsonb
            END
          ) || ${toJsonString({
            approvalControl: {
              version: AGENT_RUNTIME_APPROVAL_CONTROL_PAYLOAD_VERSION,
              action: input.action,
              actorId: input.actorId,
              reason,
            },
            ...outputPatch,
          })}::jsonb,
          updated_at = ${now}
        WHERE workspace_id = ${input.workspaceId}
          AND run_id = ${input.id}
          AND id = ${step.id}
          AND actor_id = ${step.actorId}
          AND step_key = ${step.stepKey}
          AND step_type = ${step.stepType}
          AND status = ${step.status}
          AND title IS NOT DISTINCT FROM ${step.title}
          AND "order" = ${step.order}
          AND evidence_fingerprint = ${step.evidenceFingerprint}
          AND started_at IS NOT DISTINCT FROM ${step.startedAt}
          AND completed_at IS NOT DISTINCT FROM ${step.completedAt}
          AND output_summary IS NOT DISTINCT FROM ${toJsonString(
            step.outputSummary
          )}::jsonb
          AND created_at = ${step.createdAt}
          AND updated_at IS NOT DISTINCT FROM ${step.updatedAt}
        RETURNING id
      `;
      if (!updatedRows.length) {
        throw new Error(
          `Agent runtime approval decision could not update step because its state changed: ${step.id}`
        );
      }
    }

    for (const item of events) {
      await this.insertTimelineEvent({
        actorId: input.actorId,
        event: item,
        runId: existing.id,
        workspaceId: input.workspaceId,
        createdAt: now,
      });
    }

    const run = await this.get(input.workspaceId, input.id);
    if (!run) {
      throw new Error(
        `Approval-decided agent runtime run not found: ${input.id}`
      );
    }
    return run;
  }

  @Transactional()
  async createOrReuseForRepairExecution(input: {
    record: CopilotRepairExecutionRecord;
  }): Promise<CopilotAgentRunRecord> {
    const existing = await this.getBySource(
      input.record.workspaceId,
      'repair_execution_request',
      input.record.id
    );
    if (existing) {
      return existing;
    }

    const runId = randomUUID();
    const stepId = randomUUID();
    const createdAt = new Date();
    const runStatus = mapRepairExecutionRunStatus(input.record.status);
    const stepStatus = mapRepairExecutionStepStatus(input.record.status);
    const stepType: CopilotAgentStepType =
      stepStatus === 'waiting_approval' ? 'approval' : 'model';
    const startedAt = createdAt;
    const completedAt =
      runStatus === 'completed' ||
      runStatus === 'failed' ||
      runStatus === 'cancelled'
        ? createdAt
        : null;
    const targetFingerprint = agentRuntimeFingerprint({
      version: 'agent-runtime-target/v1',
      promptName: input.record.promptName,
      requestedAction: input.record.requestedAction,
      targetLocatorFingerprint: input.record.targetLocatorFingerprint,
    });
    const evidenceFingerprint = agentRuntimeFingerprint({
      version: 'agent-runtime-evidence/v1',
      candidateEvidenceSetFingerprint:
        input.record.candidateEvidenceSetFingerprint,
      taskRouteEvidenceSetFingerprint:
        input.record.taskRouteEvidenceSetFingerprint,
      repairJobFingerprint: input.record.repairJobFingerprint,
    });
    const timelineEvents = repairExecutionTimeline({
      runId,
      stepId,
      record: input.record,
    });
    const timelineFingerprint = agentRuntimeFingerprint({
      version: 'agent-runtime-timeline/v1',
      events: timelineEvents.map(event => ({
        eventType: event.eventType,
        status: event.status,
        ordinal: event.ordinal,
        summary: event.summary,
      })),
    });
    const stepOutputSummary = {
      version: AGENT_RUNTIME_REPAIR_STEP_PAYLOAD_VERSION,
      repairExecutionRequestId: input.record.id,
      approvalState: input.record.approvalState,
      permissionStatus: input.record.permissionStatus,
      runtimeExecutor: input.record.runtimeResult.executor,
      sideEffectsApplied: input.record.runtimeResult.sideEffectsApplied,
      ...repairExecutionSideEffectProjection(input.record),
    };
    const stepEvidenceFingerprint = agentRuntimeFingerprint({
      version: 'agent-runtime-step-evidence/v1',
      runId,
      stepKey: 'repair_execution',
      repairExecutionRequestId: input.record.id,
      evidenceFingerprint,
    });

    await this.db.$executeRaw`
      INSERT INTO ai_agent_runs (
        id,
        workspace_id,
        actor_id,
        workflow,
        source_type,
        source_id,
        status,
        title,
        target_fingerprint,
        evidence_fingerprint,
        timeline_fingerprint,
        started_at,
        completed_at,
        failure_code,
        failure_message,
        queued_at,
        worker_lease_id,
        worker_lease_expires_at,
        worker_attempt,
        worker_max_attempts,
        last_attempt_at,
        created_at,
        updated_at
      )
      VALUES (
        ${runId},
        ${input.record.workspaceId},
        ${input.record.actorId},
        ${'prompt_registry_repair_execution'},
        ${'repair_execution_request'},
        ${input.record.id},
        ${runStatus},
        ${`Repair execution: ${input.record.promptName}`},
        ${targetFingerprint},
        ${evidenceFingerprint},
        ${timelineFingerprint},
        ${startedAt},
        ${completedAt},
        ${input.record.failureCode},
        ${input.record.failureMessage},
        ${input.record.queuedAt},
        ${input.record.workerLeaseId},
        ${input.record.workerLeaseExpiresAt},
        ${input.record.workerAttempt},
        ${input.record.workerMaxAttempts},
        ${input.record.lastAttemptAt},
        ${createdAt},
        ${createdAt}
      )
    `;

    await this.db.$executeRaw`
      INSERT INTO ai_agent_steps (
        id,
        run_id,
        workspace_id,
        actor_id,
        step_key,
        step_type,
        status,
        title,
        "order",
        evidence_fingerprint,
        output_summary,
        started_at,
        completed_at,
        created_at,
        updated_at
      )
      VALUES (
        ${stepId},
        ${runId},
        ${input.record.workspaceId},
        ${input.record.actorId},
        ${'repair_execution'},
        ${stepType},
        ${stepStatus},
        ${'Repair execution request'},
        ${0},
        ${stepEvidenceFingerprint},
        ${toJsonString(stepOutputSummary)}::jsonb,
        ${startedAt},
        ${completedAt},
        ${createdAt},
        ${createdAt}
      )
    `;

    for (const event of timelineEvents) {
      const eventId = randomUUID();
      const eventFingerprint = agentRuntimeFingerprint({
        version: 'agent-runtime-timeline-event/v1',
        runId,
        stepId: event.stepId,
        eventType: event.eventType,
        status: event.status,
        ordinal: event.ordinal,
        summary: event.summary,
        payload: event.payload,
      });

      await this.db.$executeRaw`
        INSERT INTO ai_agent_timeline_events (
          id,
          run_id,
          step_id,
          workspace_id,
          actor_id,
          event_type,
          status,
          ordinal,
          summary,
          payload,
          event_fingerprint,
          created_at
        )
        VALUES (
          ${eventId},
          ${runId},
          ${event.stepId},
          ${input.record.workspaceId},
          ${input.record.actorId},
          ${event.eventType},
          ${event.status},
          ${event.ordinal},
          ${event.summary},
          ${toJsonString(event.payload)}::jsonb,
          ${eventFingerprint},
          ${createdAt}
        )
      `;
    }

    const run = await this.get(input.record.workspaceId, runId);
    if (!run) {
      throw new Error(`Created agent run not found: ${runId}`);
    }
    return run;
  }

  @Transactional()
  async syncRepairExecution(input: {
    record: CopilotRepairExecutionRecord;
  }): Promise<CopilotAgentRunRecord | null> {
    const existing = await this.getBySource(
      input.record.workspaceId,
      'repair_execution_request',
      input.record.id
    );
    if (!existing) {
      return null;
    }

    const step = existing.steps.find(
      item => item.stepKey === 'repair_execution'
    );
    if (!step) {
      return existing;
    }

    const updatedAt = nextAgentRuntimeTransitionTimestamp(existing);
    const runStatus = mapRepairExecutionRunStatus(input.record.status);
    const stepStatus = mapRepairExecutionStepStatus(input.record.status);
    const completedAt =
      runStatus === 'completed' ||
      runStatus === 'failed' ||
      runStatus === 'cancelled'
        ? updatedAt
        : null;
    const stepOutputSummary = {
      version: AGENT_RUNTIME_REPAIR_STEP_PAYLOAD_VERSION,
      repairExecutionRequestId: input.record.id,
      approvalState: input.record.approvalState,
      permissionStatus: input.record.permissionStatus,
      runtimeExecutor: input.record.runtimeResult.executor,
      sideEffectsApplied: input.record.runtimeResult.sideEffectsApplied,
      ...repairExecutionSideEffectProjection(input.record),
    };
    const nextOrdinal =
      Math.max(-1, ...existing.timelineEvents.map(event => event.ordinal)) + 1;
    const timelineEvents = repairExecutionTimeline({
      runId: existing.id,
      stepId: step.id,
      record: input.record,
      startOrdinal: nextOrdinal,
    });
    const timelineFingerprint = agentRuntimeFingerprint({
      version: 'agent-runtime-timeline/v1',
      events: [
        ...existing.timelineEvents.map(event => ({
          eventType: event.eventType,
          status: event.status,
          ordinal: event.ordinal,
          summary: event.summary,
        })),
        ...timelineEvents.map(event => ({
          eventType: event.eventType,
          status: event.status,
          ordinal: event.ordinal,
          summary: event.summary,
        })),
      ],
    });

    const updatedRunRows = await this.db.$queryRaw<Array<{ id: string }>>`
      UPDATE ai_agent_runs
      SET
        status = ${runStatus},
        timeline_fingerprint = ${timelineFingerprint},
        completed_at = ${completedAt},
        failure_code = ${input.record.failureCode},
        failure_message = ${input.record.failureMessage},
        queued_at = ${input.record.queuedAt},
        worker_lease_id = ${input.record.workerLeaseId},
        worker_lease_expires_at = ${input.record.workerLeaseExpiresAt},
        worker_attempt = ${input.record.workerAttempt},
        worker_max_attempts = ${input.record.workerMaxAttempts},
        last_attempt_at = ${input.record.lastAttemptAt},
        updated_at = ${updatedAt}
      WHERE workspace_id = ${input.record.workspaceId}
        AND id = ${existing.id}
        AND actor_id = ${existing.actorId}
        AND source_type = ${'repair_execution_request'}
        AND source_id = ${input.record.id}
        AND workflow = ${existing.workflow}
        AND status = ${existing.status}
        AND title IS NOT DISTINCT FROM ${existing.title}
        AND target_fingerprint = ${existing.targetFingerprint}
        AND evidence_fingerprint = ${existing.evidenceFingerprint}
        AND timeline_fingerprint = ${existing.timelineFingerprint}
        AND started_at IS NOT DISTINCT FROM ${existing.startedAt}
        AND completed_at IS NOT DISTINCT FROM ${existing.completedAt}
        AND failure_code IS NOT DISTINCT FROM ${existing.failureCode}
        AND failure_message IS NOT DISTINCT FROM ${existing.failureMessage}
        AND queued_at IS NOT DISTINCT FROM ${existing.queuedAt}
        AND worker_lease_id IS NOT DISTINCT FROM ${existing.workerLeaseId}
        AND worker_lease_expires_at IS NOT DISTINCT FROM ${
          existing.workerLeaseExpiresAt
        }
        AND worker_attempt = ${existing.workerAttempt}
        AND worker_max_attempts = ${existing.workerMaxAttempts}
        AND last_attempt_at IS NOT DISTINCT FROM ${existing.lastAttemptAt}
        AND created_at = ${existing.createdAt}
        AND updated_at IS NOT DISTINCT FROM ${existing.updatedAt}
      RETURNING id
    `;
    if (!updatedRunRows.length) {
      throw new Error(
        `Agent runtime repair execution sync could not update run because its state changed: ${existing.id}`
      );
    }

    const updatedStepRows = await this.db.$queryRaw<Array<{ id: string }>>`
      UPDATE ai_agent_steps
      SET
        status = ${stepStatus},
        step_type = ${
          stepStatus === 'waiting_approval' || runStatus === 'cancelled'
            ? 'approval'
            : 'model'
        },
        output_summary = ${toJsonString(stepOutputSummary)}::jsonb,
        completed_at = ${completedAt},
        updated_at = ${updatedAt}
      WHERE workspace_id = ${input.record.workspaceId}
        AND id = ${step.id}
        AND run_id = ${existing.id}
        AND actor_id = ${step.actorId}
        AND step_key = ${step.stepKey}
        AND status = ${step.status}
        AND step_type = ${step.stepType}
        AND title IS NOT DISTINCT FROM ${step.title}
        AND "order" = ${step.order}
        AND evidence_fingerprint = ${step.evidenceFingerprint}
        AND started_at IS NOT DISTINCT FROM ${step.startedAt}
        AND completed_at IS NOT DISTINCT FROM ${step.completedAt}
        AND output_summary IS NOT DISTINCT FROM ${toJsonString(
          step.outputSummary
        )}::jsonb
        AND created_at = ${step.createdAt}
        AND updated_at IS NOT DISTINCT FROM ${step.updatedAt}
      RETURNING id
    `;
    if (!updatedStepRows.length) {
      throw new Error(
        `Agent runtime repair execution sync could not update step because its state changed: ${step.id}`
      );
    }

    for (const event of timelineEvents) {
      const eventId = randomUUID();
      const eventFingerprint = agentRuntimeFingerprint({
        version: 'agent-runtime-timeline-event/v1',
        runId: existing.id,
        stepId: event.stepId,
        eventType: event.eventType,
        status: event.status,
        ordinal: event.ordinal,
        summary: event.summary,
        payload: event.payload,
      });

      await this.db.$executeRaw`
        INSERT INTO ai_agent_timeline_events (
          id,
          run_id,
          step_id,
          workspace_id,
          actor_id,
          event_type,
          status,
          ordinal,
          summary,
          payload,
          event_fingerprint,
          created_at
        )
        VALUES (
          ${eventId},
          ${existing.id},
          ${event.stepId},
          ${input.record.workspaceId},
          ${input.record.actorId},
          ${event.eventType},
          ${event.status},
          ${event.ordinal},
          ${event.summary},
          ${toJsonString(event.payload)}::jsonb,
          ${eventFingerprint},
          ${updatedAt}
        )
      `;
    }

    return await this.get(input.record.workspaceId, existing.id);
  }

  async get(workspaceId: string, id: string) {
    const rows = await this.db.$queryRaw<
      Omit<
        CopilotAgentRunRecord,
        'executionResultCount' | 'executionResults' | 'steps' | 'timelineEvents'
      >[]
    >`
      SELECT
        run.id,
        run.workspace_id AS "workspaceId",
        run.actor_id AS "actorId",
        run.session_id AS "sessionId",
        CASE
          WHEN project_member.user_id IS NOT NULL THEN project.id
          ELSE NULL
        END AS "projectId",
        run.workflow,
        run.source_type AS "sourceType",
        run.source_id AS "sourceId",
        run.status,
        run.title,
        run.target_fingerprint AS "targetFingerprint",
        run.evidence_fingerprint AS "evidenceFingerprint",
        run.timeline_fingerprint AS "timelineFingerprint",
        run.started_at AS "startedAt",
        run.completed_at AS "completedAt",
        run.failure_code AS "failureCode",
        run.failure_message AS "failureMessage",
        run.queued_at AS "queuedAt",
        run.worker_lease_id AS "workerLeaseId",
        run.worker_lease_expires_at AS "workerLeaseExpiresAt",
        run.worker_attempt AS "workerAttempt",
        run.worker_max_attempts AS "workerMaxAttempts",
        run.last_attempt_at AS "lastAttemptAt",
        run.created_at AS "createdAt",
        run.updated_at AS "updatedAt"
      FROM ai_agent_runs run
      LEFT JOIN ai_sessions_metadata session
        ON session.id = run.session_id
       AND session.user_id = run.actor_id
       AND session.workspace_id = run.workspace_id
      LEFT JOIN ai_context_projects project
        ON project.id = session.selected_context_project_id
       AND project.status = ${'active'}
      LEFT JOIN ai_context_project_members project_member
        ON project_member.project_id = project.id
       AND project_member.user_id = run.actor_id
      WHERE run.workspace_id = ${workspaceId} AND run.id = ${id}
      LIMIT 1
    `;
    const run = rows[0];
    if (!run) {
      return null;
    }

    return {
      ...run,
      ...(await this.listExecutionResults(run.workspaceId, run.id)),
      steps: await this.listSteps(run.workspaceId, run.id),
      timelineEvents: await this.listTimelineEvents(run.workspaceId, run.id),
    };
  }

  async getForActor(workspaceId: string, actorId: string, id: string) {
    const rows = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM ai_agent_runs
      WHERE workspace_id = ${workspaceId}
        AND actor_id = ${actorId}
        AND id = ${id}
        AND source_type <> ${'repair_execution_request'}
      LIMIT 1
    `;
    return rows[0] ? await this.get(workspaceId, id) : null;
  }

  async getForWorkspaceViewer(
    workspaceId: string,
    viewerId: string,
    id: string
  ) {
    const rows = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT run.id
      FROM ai_agent_runs run
      WHERE run.workspace_id = ${workspaceId}
        AND run.id = ${id}
        AND (
          run.actor_id = ${viewerId}
          OR NOT EXISTS (
            SELECT 1
            FROM ai_agent_steps project_write_step
            WHERE project_write_step.run_id = run.id
              AND project_write_step.workspace_id = run.workspace_id
              AND project_write_step.step_type = ${'tool'}
              AND NULLIF(
                project_write_step.output_summary -> 'docUpdateRequest' ->> 'projectId',
                ''
              ) IS NOT NULL
          )
        )
      LIMIT 1
    `;
    if (!rows[0]) return null;
    const run = await this.get(workspaceId, id);
    if (!run) return null;
    return run.actorId === viewerId || !isProjectDocumentWriteRun(run)
      ? run
      : null;
  }

  @Transactional()
  async currentLeasedStandaloneRunBeforeAdapterExecution(input: {
    workspaceId: string;
    id: string;
    workerLeaseId: string;
    workerAttempt: number;
  }): Promise<CopilotAgentRunRecord | null> {
    const now = new Date();
    const rows = await this.db.$queryRaw<
      Array<{
        id: string;
        sourceType: string;
        status: CopilotAgentRunStatus;
        workerAttempt: number;
        workerLeaseExpiresAt: Date | null;
        workerLeaseId: string | null;
        workspaceId: string;
      }>
    >`
      SELECT
        id,
        source_type AS "sourceType",
        status,
        worker_attempt AS "workerAttempt",
        worker_lease_id AS "workerLeaseId",
        worker_lease_expires_at AS "workerLeaseExpiresAt",
        workspace_id AS "workspaceId"
      FROM ai_agent_runs
      WHERE workspace_id = ${input.workspaceId}
        AND id = ${input.id}
      LIMIT 1
      FOR UPDATE
    `;
    const current = rows[0];
    if (!current) {
      throw new Error(`Agent runtime run not found: ${input.id}`);
    }
    if (
      current.sourceType === 'repair_execution_request' ||
      current.status !== 'running' ||
      current.workerLeaseId !== input.workerLeaseId ||
      current.workerAttempt !== input.workerAttempt ||
      !current.workerLeaseExpiresAt ||
      current.workerLeaseExpiresAt.getTime() <= now.getTime()
    ) {
      return null;
    }

    const run = await this.get(current.workspaceId, current.id);
    if (!run) {
      throw new Error(`Agent runtime run not found: ${input.id}`);
    }
    return run;
  }

  async getBySource(workspaceId: string, sourceType: string, sourceId: string) {
    const rows = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM ai_agent_runs
      WHERE workspace_id = ${workspaceId}
        AND source_type = ${sourceType}
        AND source_id = ${sourceId}
      LIMIT 1
    `;
    const id = rows[0]?.id;
    return id ? await this.get(workspaceId, id) : null;
  }

  async list(
    workspaceId: string,
    options: { filter?: CopilotAgentRunListFilter | null; limit?: number } = {}
  ) {
    const limit = normalizeListLimit(options.limit);
    const filter = normalizeAgentRunListFilter(options.filter);
    const rows = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM ai_agent_runs
      WHERE workspace_id = ${workspaceId}
        AND (${filter.status}::varchar IS NULL OR status = ${filter.status})
        AND (
          ${filter.workflow}::varchar IS NULL
          OR workflow = ${filter.workflow}
        )
        AND (
          ${filter.sourceType}::varchar IS NULL
          OR source_type = ${filter.sourceType}
        )
        AND (
          ${filter.sourceId}::varchar IS NULL
          OR source_id = ${filter.sourceId}
        )
        AND (
          ${filter.query}::varchar IS NULL
          OR id = ${filter.query}
          OR workflow = ${filter.query}
          OR source_type = ${filter.query}
          OR source_id = ${filter.query}
          OR target_fingerprint = ${filter.query}
          OR evidence_fingerprint = ${filter.query}
          OR timeline_fingerprint = ${filter.query}
          OR failure_code = ${filter.query}
          OR worker_lease_id = ${filter.query}
        )
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `;
    const runs = await Promise.all(
      rows.map(row => this.get(workspaceId, row.id))
    );
    return runs.filter((run): run is CopilotAgentRunRecord => !!run);
  }

  async listForWorkspaceViewer(
    workspaceId: string,
    viewerId: string,
    options: { filter?: CopilotAgentRunListFilter | null; limit?: number } = {}
  ) {
    const limit = normalizeListLimit(options.limit);
    const filter = normalizeAgentRunListFilter(options.filter);
    const rows = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT run.id
      FROM ai_agent_runs run
      WHERE run.workspace_id = ${workspaceId}
        AND (
          run.actor_id = ${viewerId}
          OR NOT EXISTS (
            SELECT 1
            FROM ai_agent_steps project_write_step
            WHERE project_write_step.run_id = run.id
              AND project_write_step.workspace_id = run.workspace_id
              AND project_write_step.step_type = ${'tool'}
              AND NULLIF(
                project_write_step.output_summary -> 'docUpdateRequest' ->> 'projectId',
                ''
              ) IS NOT NULL
          )
        )
        AND (${filter.status}::varchar IS NULL OR run.status = ${filter.status})
        AND (
          ${filter.workflow}::varchar IS NULL
          OR run.workflow = ${filter.workflow}
        )
        AND (
          ${filter.sourceType}::varchar IS NULL
          OR run.source_type = ${filter.sourceType}
        )
        AND (
          ${filter.sourceId}::varchar IS NULL
          OR run.source_id = ${filter.sourceId}
        )
        AND (
          ${filter.query}::varchar IS NULL
          OR run.id = ${filter.query}
          OR run.workflow = ${filter.query}
          OR run.source_type = ${filter.query}
          OR run.source_id = ${filter.query}
          OR run.target_fingerprint = ${filter.query}
          OR run.evidence_fingerprint = ${filter.query}
          OR run.timeline_fingerprint = ${filter.query}
          OR run.failure_code = ${filter.query}
          OR run.worker_lease_id = ${filter.query}
        )
      ORDER BY run.created_at DESC, run.id DESC
      LIMIT ${limit}
    `;
    const runs = await Promise.all(
      rows.map(row => this.getForWorkspaceViewer(workspaceId, viewerId, row.id))
    );
    return runs.filter((run): run is CopilotAgentRunRecord => !!run);
  }

  async listForActor(
    workspaceId: string,
    actorId: string,
    options: { filter?: CopilotAgentRunListFilter | null; limit?: number } = {}
  ) {
    const limit = normalizeCopilotTaskListLimit(options.limit);
    const filter = normalizeAgentRunListFilter(options.filter);
    const rows = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM ai_agent_runs
      WHERE workspace_id = ${workspaceId}
        AND actor_id = ${actorId}
        AND source_type <> ${'repair_execution_request'}
        AND (${filter.status}::varchar IS NULL OR status = ${filter.status})
        AND (
          ${filter.workflow}::varchar IS NULL
          OR workflow = ${filter.workflow}
        )
        AND (
          ${filter.sourceType}::varchar IS NULL
          OR source_type = ${filter.sourceType}
        )
        AND (
          ${filter.sourceId}::varchar IS NULL
          OR source_id = ${filter.sourceId}
        )
        AND (
          ${filter.query}::varchar IS NULL
          OR id = ${filter.query}
          OR workflow = ${filter.query}
          OR source_type = ${filter.query}
          OR source_id = ${filter.query}
          OR title ILIKE ${filter.query}
        )
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `;
    const runs = await Promise.all(
      rows.map(row => this.getForActor(workspaceId, actorId, row.id))
    );
    return runs.filter((run): run is CopilotAgentRunRecord => !!run);
  }

  async listForActorAcrossAccessibleWorkspaces(
    actorId: string,
    options: { filter?: CopilotAgentRunListFilter | null; limit?: number } = {}
  ) {
    const normalizedActorId = requireAgentRuntimeString(actorId, 'actor id');
    const limit = normalizeCopilotTaskListLimit(options.limit);
    const filter = normalizeAgentRunListFilter(options.filter);
    const rows = await this.db.$queryRaw<
      Array<{ id: string; workspaceId: string }>
    >`
      SELECT
        run.id,
        run.workspace_id AS "workspaceId"
      FROM ai_agent_runs run
      JOIN workspace_members workspace_member
        ON workspace_member.workspace_id = run.workspace_id
       AND workspace_member.user_id = ${normalizedActorId}
       AND workspace_member.state = 'active'
      WHERE run.actor_id = ${normalizedActorId}
        AND run.source_type <> ${'repair_execution_request'}
        AND (${filter.status}::varchar IS NULL OR run.status = ${filter.status})
        AND (
          ${filter.workflow}::varchar IS NULL
          OR run.workflow = ${filter.workflow}
        )
        AND (
          ${filter.sourceType}::varchar IS NULL
          OR run.source_type = ${filter.sourceType}
        )
        AND (
          ${filter.sourceId}::varchar IS NULL
          OR run.source_id = ${filter.sourceId}
        )
        AND (
          ${filter.query}::varchar IS NULL
          OR run.id = ${filter.query}
          OR run.workflow = ${filter.query}
          OR run.source_type = ${filter.query}
          OR run.source_id = ${filter.query}
          OR run.title ILIKE ${filter.query}
        )
      ORDER BY run.created_at DESC, run.id DESC
      LIMIT ${limit}
    `;
    const runs = await Promise.all(
      rows.map(row =>
        this.getForActor(row.workspaceId, normalizedActorId, row.id)
      )
    );
    return runs.filter((run): run is CopilotAgentRunRecord => !!run);
  }

  async listWorkbenchTaskPanel(input: {
    actorId: string;
    projectId?: string | null;
    now?: Date;
  }): Promise<CopilotWorkbenchTaskPanelRecord> {
    const actorId = requireAgentRuntimeString(input.actorId, 'actor id');
    const projectId = optionalAgentRuntimeString(
      input.projectId,
      'project id',
      AGENT_RUNTIME_REQUIRED_STRING_MAX_LENGTH
    );
    const now = input.now ?? new Date();

    const [todo, inProgress, done] = await Promise.all([
      this.listWorkbenchTaskSegment({
        actorId,
        projectId,
        statuses: ['waiting_approval', 'waiting_for_location', 'failed'],
        limit: WORKBENCH_TODO_LIMIT,
        ordering: 'todo',
      }),
      this.listWorkbenchTaskSegment({
        actorId,
        projectId,
        statuses: ['queued', 'running'],
        limit: WORKBENCH_IN_PROGRESS_LIMIT,
        ordering: 'active',
      }),
      this.listWorkbenchTaskSegment({
        actorId,
        projectId,
        statuses: ['completed', 'cancelled'],
        completedSince: new Date(now.getTime() - WORKBENCH_DONE_WINDOW_MS),
        limit: WORKBENCH_DONE_LIMIT,
        ordering: 'done',
      }),
    ]);

    return { todo, inProgress, done };
  }

  private async listWorkbenchTaskSegment(input: {
    actorId: string;
    projectId: string | null;
    statuses: readonly CopilotAgentRunStatus[];
    completedSince?: Date;
    limit: number;
    ordering: 'active' | 'done' | 'todo';
  }): Promise<CopilotWorkbenchTaskSegmentRecord> {
    const completedSincePredicate = input.completedSince
      ? Prisma.sql`AND run.completed_at >= ${input.completedSince}`
      : Prisma.sql``;
    const ordering =
      input.ordering === 'todo'
        ? Prisma.sql`
            CASE WHEN run.status = 'waiting_approval' THEN 0 ELSE 1 END ASC,
            run.updated_at DESC,
            run.id DESC
          `
        : input.ordering === 'done'
          ? Prisma.sql`run.completed_at DESC, run.id DESC`
          : Prisma.sql`run.updated_at DESC, run.id DESC`;
    const rows = await this.db.$queryRaw<
      Array<{ id: string; workspaceId: string }>
    >(Prisma.sql`
      SELECT
        run.id,
        run.workspace_id AS "workspaceId"
      FROM ai_agent_runs run
      JOIN workspace_members workspace_member
        ON workspace_member.workspace_id = run.workspace_id
       AND workspace_member.user_id = ${input.actorId}
       AND workspace_member.state = 'active'
      LEFT JOIN ai_sessions_metadata session
        ON session.id = run.session_id
       AND session.user_id = run.actor_id
       AND session.workspace_id = run.workspace_id
      LEFT JOIN ai_context_projects project
        ON project.id = session.selected_context_project_id
       AND project.status = 'active'
      LEFT JOIN ai_context_project_members project_member
        ON project_member.project_id = project.id
       AND project_member.user_id = ${input.actorId}
      WHERE run.actor_id = ${input.actorId}
        AND run.source_type <> 'repair_execution_request'
        AND run.status IN (${Prisma.join(input.statuses)})
        AND (
          ${input.projectId}::varchar IS NULL
          OR (
            project.id = ${input.projectId}
            AND project_member.user_id IS NOT NULL
          )
        )
        ${completedSincePredicate}
      ORDER BY ${ordering}
      LIMIT ${input.limit + 1}
    `);
    const capped = rows.length > input.limit;
    const runs = await Promise.all(
      rows.slice(0, input.limit).map(row => this.get(row.workspaceId, row.id))
    );
    const items = runs.filter(
      (run): run is CopilotAgentRunRecord =>
        !!run && (!input.projectId || run.projectId === input.projectId)
    );
    return { items, capped };
  }

  async listExpiredStandaloneWorkerLeases(input: {
    limit?: number;
  }): Promise<CopilotAgentRunRecord[]> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const now = new Date();
    const rows = await this.db.$queryRaw<
      Array<{ id: string; workspaceId: string }>
    >`
      SELECT
        id,
        workspace_id AS "workspaceId"
      FROM ai_agent_runs
      WHERE source_type <> ${'repair_execution_request'}
        AND status = ${'running'}
        AND workspace_id IS NOT NULL
        AND worker_lease_expires_at IS NOT NULL
        AND worker_lease_expires_at <= ${now}
      ORDER BY worker_lease_expires_at ASC, updated_at ASC, id ASC
      LIMIT ${limit}
    `;

    const runs = await Promise.all(
      rows.map(row => this.get(row.workspaceId, row.id))
    );
    return runs.filter((run): run is CopilotAgentRunRecord => !!run);
  }

  async listQueuedStandaloneRuns(input: {
    limit?: number;
  }): Promise<CopilotAgentRunRecord[]> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const rows = await this.db.$queryRaw<
      Array<{ id: string; workspaceId: string }>
    >`
      SELECT
        id,
        workspace_id AS "workspaceId"
      FROM ai_agent_runs
      WHERE source_type <> ${'repair_execution_request'}
        AND status = ${'queued'}
        AND workspace_id IS NOT NULL
        AND worker_attempt < worker_max_attempts
      ORDER BY queued_at ASC NULLS LAST, updated_at ASC, id ASC
      LIMIT ${limit}
    `;

    const runs = await Promise.all(
      rows.map(row => this.get(row.workspaceId, row.id))
    );
    return runs.filter((run): run is CopilotAgentRunRecord => !!run);
  }

  @Transactional()
  async recoverExpiredStandaloneWorkerLease(input: {
    workspaceId: string;
    id: string;
    reason?: string | null;
  }): Promise<CopilotAgentRunRecord> {
    const existing = await this.get(input.workspaceId, input.id);
    if (!existing) {
      throw new Error(`Agent runtime run not found: ${input.id}`);
    }
    if (existing.sourceType === 'repair_execution_request') {
      throw new Error(
        'Repair execution Agent Runtime runs must be recovered through repair execution sync'
      );
    }
    if (existing.status !== 'running') {
      throw new Error(
        `Agent runtime run cannot recover stale lease from status: ${existing.status}`
      );
    }

    const observedAt = new Date();
    if (
      !existing.workerLeaseExpiresAt ||
      existing.workerLeaseExpiresAt.getTime() > observedAt.getTime()
    ) {
      throw new Error('Agent runtime worker lease has not expired');
    }
    const now = nextAgentRuntimeTransitionTimestamp(existing, observedAt);
    const workerLeaseExpiresAt = existing.workerLeaseExpiresAt;

    const retryScheduled = existing.workerAttempt < existing.workerMaxAttempts;
    const nextStatus: CopilotAgentRunStatus = retryScheduled
      ? 'queued'
      : 'failed';
    const nextStepStatus: CopilotAgentStepStatus = retryScheduled
      ? 'pending'
      : 'failed';
    const activeSteps = existing.steps.filter(step =>
      isActiveStepStatus(step.status)
    );
    const failureCode = retryScheduled
      ? null
      : AGENT_RUNTIME_STALE_WORKER_LEASE_FAILURE_CODE;
    const failureMessage = retryScheduled
      ? null
      : AGENT_RUNTIME_STALE_WORKER_LEASE_FAILURE_MESSAGE;
    const nextOrdinal =
      Math.max(-1, ...existing.timelineEvents.map(item => item.ordinal)) + 1;
    const event: AgentRuntimeTimelineEventInput = {
      eventType: 'run_status',
      status: nextStatus,
      ordinal: nextOrdinal,
      summary: retryScheduled
        ? 'Agent runtime stale worker lease recovered'
        : 'Agent runtime stale worker lease failed run',
      stepId: null,
      payload: {
        version: 'agent-runtime-stale-lease-recovery/v1',
        executor: 'agent_runtime_stale_recovery_worker',
        previousStatus: existing.status,
        previousWorkerLeaseId: existing.workerLeaseId,
        previousWorkerLeaseExpiresAt: workerLeaseExpiresAt.toISOString(),
        reason:
          input.reason ?? 'system recovered expired Agent Runtime worker lease',
        retryScheduled,
        nextStatus,
        workerAttempt: existing.workerAttempt,
        workerMaxAttempts: existing.workerMaxAttempts,
        workflow: existing.workflow,
        sourceType: existing.sourceType,
        sourceId: existing.sourceId,
      },
    };
    const stepEvents: AgentRuntimeTimelineEventInput[] = activeSteps.map(
      (step, index) => ({
        eventType: timelineEventTypeForStep(step.stepType),
        status: nextStepStatus,
        ordinal: nextOrdinal + index + 1,
        summary: retryScheduled
          ? `Agent runtime ${step.stepType} step reset after stale lease`
          : `Agent runtime ${step.stepType} step failed after stale lease`,
        stepId: step.id,
        payload: {
          version: 'agent-runtime-stale-lease-recovery/v1',
          executor: 'agent_runtime_stale_recovery_worker',
          previousStatus: step.status,
          previousWorkerLeaseId: existing.workerLeaseId,
          previousWorkerLeaseExpiresAt: workerLeaseExpiresAt.toISOString(),
          reason:
            input.reason ??
            'system recovered expired Agent Runtime worker lease',
          retryScheduled,
          nextStatus: nextStepStatus,
          workerAttempt: existing.workerAttempt,
          workerMaxAttempts: existing.workerMaxAttempts,
          workflow: existing.workflow,
          sourceType: existing.sourceType,
          sourceId: existing.sourceId,
        },
      })
    );
    const events = [event, ...stepEvents];
    const timelineFingerprint = timelineFingerprintWithEvents(existing, events);

    const recoveredRows = await this.db.$queryRaw<Array<{ id: string }>>`
      UPDATE ai_agent_runs
      SET
        status = ${nextStatus},
        timeline_fingerprint = ${timelineFingerprint},
        completed_at = ${retryScheduled ? null : now},
        failure_code = ${failureCode},
        failure_message = ${failureMessage},
        queued_at = ${retryScheduled ? now : existing.queuedAt},
        worker_lease_id = ${null},
        worker_lease_expires_at = ${null},
        updated_at = ${now}
      WHERE workspace_id = ${input.workspaceId}
        AND id = ${input.id}
        AND actor_id = ${existing.actorId}
        AND source_type <> ${'repair_execution_request'}
        AND source_type = ${existing.sourceType}
        AND source_id = ${existing.sourceId}
        AND workflow = ${existing.workflow}
        AND status = ${'running'}
        AND title IS NOT DISTINCT FROM ${existing.title}
        AND target_fingerprint = ${existing.targetFingerprint}
        AND evidence_fingerprint = ${existing.evidenceFingerprint}
        AND timeline_fingerprint = ${existing.timelineFingerprint}
        AND started_at IS NOT DISTINCT FROM ${existing.startedAt}
        AND completed_at IS NOT DISTINCT FROM ${existing.completedAt}
        AND failure_code IS NOT DISTINCT FROM ${existing.failureCode}
        AND failure_message IS NOT DISTINCT FROM ${existing.failureMessage}
        AND queued_at IS NOT DISTINCT FROM ${existing.queuedAt}
        AND worker_lease_id IS NOT DISTINCT FROM ${existing.workerLeaseId}
        AND worker_attempt = ${existing.workerAttempt}
        AND worker_max_attempts = ${existing.workerMaxAttempts}
        AND last_attempt_at IS NOT DISTINCT FROM ${existing.lastAttemptAt}
        AND created_at = ${existing.createdAt}
        AND updated_at IS NOT DISTINCT FROM ${existing.updatedAt}
        AND worker_lease_expires_at <= ${now}
      RETURNING id
    `;
    if (!recoveredRows.length) {
      throw new Error(
        `Agent runtime stale lease could not be recovered because its run state changed: ${input.id}`
      );
    }

    if (!retryScheduled) {
      await this.createWorkerExecutionResultLedgerEntry({
        adapterWorkflow: existing.workflow,
        completedAt: now,
        executor: 'agent_runtime_stale_recovery_worker',
        failureCode: AGENT_RUNTIME_STALE_WORKER_LEASE_FAILURE_CODE,
        failureMessage: AGENT_RUNTIME_STALE_WORKER_LEASE_FAILURE_MESSAGE,
        resultStatus: 'failed',
        run: existing,
        sideEffectMode: 'none',
        sideEffectsApplied: false,
        summary: AGENT_RUNTIME_STALE_WORKER_LEASE_FAILURE_MESSAGE,
        terminalRunSnapshot: {
          completedAt: now,
          failureCode: AGENT_RUNTIME_STALE_WORKER_LEASE_FAILURE_CODE,
          failureMessage: AGENT_RUNTIME_STALE_WORKER_LEASE_FAILURE_MESSAGE,
          status: 'failed',
          timelineFingerprint,
          updatedAt: now,
          workerLeaseCleared: true,
        },
        workerLeaseId:
          existing.workerLeaseId ?? 'agent-runtime-stale-recovery-worker',
      });
    }

    for (const step of activeSteps) {
      const updatedStepRows = await this.db.$queryRaw<Array<{ id: string }>>`
        UPDATE ai_agent_steps
        SET
          status = ${nextStepStatus},
          completed_at = ${retryScheduled ? null : now},
          output_summary = (
            CASE
              WHEN jsonb_typeof(output_summary) = ${'object'} THEN output_summary
              ELSE ${'{}'}::jsonb
            END
          ) || ${toJsonString({
            staleLeaseRecovery: {
              version: 'agent-runtime-stale-lease-recovery/v1',
              executor: 'agent_runtime_stale_recovery_worker',
              reason:
                input.reason ??
                'system recovered expired Agent Runtime worker lease',
              retryScheduled,
              nextStatus,
              workerAttempt: existing.workerAttempt,
              workerMaxAttempts: existing.workerMaxAttempts,
              previousWorkerLeaseId: existing.workerLeaseId,
              previousWorkerLeaseExpiresAt:
                existing.workerLeaseExpiresAt.toISOString(),
            },
          })}::jsonb,
          updated_at = ${now}
        WHERE workspace_id = ${input.workspaceId}
          AND run_id = ${input.id}
          AND id = ${step.id}
          AND actor_id = ${step.actorId}
          AND step_key = ${step.stepKey}
          AND step_type = ${step.stepType}
          AND status = ${step.status}
          AND title IS NOT DISTINCT FROM ${step.title}
          AND "order" = ${step.order}
          AND evidence_fingerprint = ${step.evidenceFingerprint}
          AND started_at IS NOT DISTINCT FROM ${step.startedAt}
          AND completed_at IS NOT DISTINCT FROM ${step.completedAt}
          AND output_summary IS NOT DISTINCT FROM ${toJsonString(
            step.outputSummary
          )}::jsonb
          AND created_at = ${step.createdAt}
          AND updated_at IS NOT DISTINCT FROM ${step.updatedAt}
        RETURNING id
      `;
      if (!updatedStepRows.length) {
        throw new Error(
          `Agent runtime stale lease could not be recovered because its step state changed: ${step.id}`
        );
      }
    }

    for (const item of events) {
      await this.insertTimelineEvent({
        actorId: existing.actorId,
        event: item,
        runId: existing.id,
        workspaceId: existing.workspaceId,
        createdAt: now,
      });
    }

    const run = await this.get(input.workspaceId, input.id);
    if (!run) {
      throw new Error(`Recovered agent runtime run not found: ${input.id}`);
    }
    return run;
  }

  @Transactional()
  async acquireStandaloneWorkerLease(input: {
    workspaceId?: string | null;
    id?: string | null;
    workerId: string;
    leaseMs?: number;
  }): Promise<CopilotAgentRunRecord | null> {
    const leaseMs = input.leaseMs ?? 300000;
    const rows = await this.db.$queryRaw<
      Array<{
        id: string;
        workspaceId: string;
        leasedAt: Date;
        leaseExpiresAt: Date;
      }>
    >`
      WITH wall_clock AS MATERIALIZED (
        SELECT clock_timestamp() AS now
      ),
      candidate AS (
        SELECT
          run.id,
          run.workspace_id,
          wall_clock.now AS wall_clock_at,
          GREATEST(
            wall_clock.now,
            run.created_at,
            run.updated_at,
            COALESCE(run.started_at, run.created_at),
            COALESCE(run.queued_at, run.created_at),
            COALESCE(run.last_attempt_at, run.created_at),
            COALESCE(
              (
                SELECT MAX(
                  GREATEST(
                    step.created_at,
                    step.updated_at,
                    COALESCE(step.started_at, step.created_at),
                    COALESCE(step.completed_at, step.created_at)
                  )
                )
                FROM ai_agent_steps step
                WHERE step.run_id = run.id
              ),
              run.created_at
            )
          ) + INTERVAL '1 millisecond' AS transition_at
        FROM ai_agent_runs run
        CROSS JOIN wall_clock
        WHERE run.source_type <> ${'repair_execution_request'}
          AND run.worker_attempt < run.worker_max_attempts
          AND run.status = ${'queued'}
          AND (${input.workspaceId ?? null}::varchar IS NULL OR run.workspace_id = ${input.workspaceId ?? null})
          AND run.workspace_id IS NOT NULL
          AND (${input.id ?? null}::varchar IS NULL OR run.id = ${input.id ?? null})
          AND NOT EXISTS (
            SELECT 1
            FROM ai_agent_steps current_tool
            JOIN ai_agent_runs earlier
              ON earlier.id <> run.id
             AND earlier.status IN (${'queued'}, ${'running'})
             AND (
               COALESCE(earlier.queued_at, earlier.created_at),
               earlier.created_at,
               earlier.id
             ) < (
               COALESCE(run.queued_at, run.created_at),
               run.created_at,
               run.id
             )
            JOIN ai_agent_steps earlier_tool
              ON earlier_tool.run_id = earlier.id
             AND earlier_tool.step_type = ${'tool'}
             AND earlier_tool.output_summary -> 'docUpdateRequest' ->> 'projectId' IS NOT NULL
             AND earlier_tool.output_summary -> 'docUpdateRequest' ->> 'docId' =
                 current_tool.output_summary -> 'docUpdateRequest' ->> 'docId'
             AND COALESCE(
                   NULLIF(
                     earlier_tool.output_summary -> 'docUpdateRequest' ->> 'sourceWorkspaceId',
                     ''
                   ),
                   NULLIF(
                     earlier_tool.output_summary -> 'docUpdateRequest' ->> 'workspaceId',
                     ''
                   ),
                   earlier_tool.workspace_id
                 ) = COALESCE(
                   NULLIF(
                     current_tool.output_summary -> 'docUpdateRequest' ->> 'sourceWorkspaceId',
                     ''
                   ),
                   NULLIF(
                     current_tool.output_summary -> 'docUpdateRequest' ->> 'workspaceId',
                     ''
                   ),
                   current_tool.workspace_id
                 )
            WHERE current_tool.run_id = run.id
             AND current_tool.step_type = ${'tool'}
             AND current_tool.output_summary -> 'docUpdateRequest' ->> 'docId' IS NOT NULL
              AND current_tool.output_summary -> 'docUpdateRequest' ->> 'projectId' IS NOT NULL
          )
        ORDER BY run.queued_at ASC NULLS LAST, run.created_at ASC, run.id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE ai_agent_runs run
      SET
        status = ${'running'},
        queued_at = COALESCE(run.queued_at, run.created_at),
        worker_lease_id = ${input.workerId},
        worker_lease_expires_at = candidate.wall_clock_at + (${leaseMs} * INTERVAL '1 millisecond'),
        worker_attempt = run.worker_attempt + 1,
        last_attempt_at = candidate.transition_at,
        completed_at = ${null},
        failure_code = ${null},
        failure_message = ${null},
        updated_at = candidate.transition_at
      FROM candidate
      WHERE run.id = candidate.id
        AND run.workspace_id = candidate.workspace_id
      RETURNING
        run.id,
        run.workspace_id AS "workspaceId",
        run.last_attempt_at AS "leasedAt",
        run.worker_lease_expires_at AS "leaseExpiresAt"
    `;

    const leased = rows[0];
    if (!leased) {
      return null;
    }
    const now = leased.leasedAt;
    const leaseExpiresAt = leased.leaseExpiresAt;

    const run = await this.get(leased.workspaceId, leased.id);
    if (!run) {
      throw new Error(`Leased agent runtime run not found: ${leased.id}`);
    }

    const nextOrdinal =
      Math.max(-1, ...run.timelineEvents.map(item => item.ordinal)) + 1;
    const leasedSteps = run.steps.filter(step =>
      isActiveStepStatus(step.status)
    );
    const event: AgentRuntimeTimelineEventInput = {
      eventType: 'run_status',
      status: 'running',
      ordinal: nextOrdinal,
      summary: 'Agent runtime worker leased standalone run',
      stepId: null,
      payload: {
        version: 'agent-runtime-worker-lease/v1',
        executor: 'agent_runtime_worker',
        workerAttempt: run.workerAttempt,
        workerLeaseId: input.workerId,
        workerLeaseExpiresAt: leaseExpiresAt.toISOString(),
        workflow: run.workflow,
        sourceType: run.sourceType,
        sourceId: run.sourceId,
      },
    };
    const stepEvents: AgentRuntimeTimelineEventInput[] = leasedSteps.map(
      (step, index) => ({
        eventType: timelineEventTypeForStep(step.stepType),
        status: 'running',
        ordinal: nextOrdinal + index + 1,
        summary: `Agent runtime ${step.stepType} step running`,
        stepId: step.id,
        payload: {
          version: 'agent-runtime-worker-step-lease/v1',
          executor: 'agent_runtime_worker',
          stepKey: step.stepKey,
          stepType: step.stepType,
          workerAttempt: run.workerAttempt,
          workerLeaseId: input.workerId,
          workflow: run.workflow,
          sourceType: run.sourceType,
          sourceId: run.sourceId,
        },
      })
    );
    const events = [event, ...stepEvents];
    const timelineFingerprint = timelineFingerprintWithEvents(run, events);

    const updatedRunRows = await this.db.$queryRaw<Array<{ id: string }>>`
      UPDATE ai_agent_runs
      SET
        timeline_fingerprint = ${timelineFingerprint},
        updated_at = ${now}
      WHERE workspace_id = ${run.workspaceId}
        AND id = ${run.id}
        AND actor_id = ${run.actorId}
        AND source_type <> ${'repair_execution_request'}
        AND source_type = ${run.sourceType}
        AND source_id = ${run.sourceId}
        AND workflow = ${run.workflow}
        AND status = ${'running'}
        AND title IS NOT DISTINCT FROM ${run.title}
        AND target_fingerprint = ${run.targetFingerprint}
        AND evidence_fingerprint = ${run.evidenceFingerprint}
        AND timeline_fingerprint = ${run.timelineFingerprint}
        AND started_at IS NOT DISTINCT FROM ${run.startedAt}
        AND completed_at IS NOT DISTINCT FROM ${run.completedAt}
        AND failure_code IS NOT DISTINCT FROM ${run.failureCode}
        AND failure_message IS NOT DISTINCT FROM ${run.failureMessage}
        AND queued_at IS NOT DISTINCT FROM ${run.queuedAt}
        AND worker_lease_id = ${input.workerId}
        AND worker_lease_expires_at IS NOT DISTINCT FROM ${
          run.workerLeaseExpiresAt
        }
        AND worker_attempt = ${run.workerAttempt}
        AND worker_max_attempts = ${run.workerMaxAttempts}
        AND last_attempt_at IS NOT DISTINCT FROM ${run.lastAttemptAt}
        AND created_at = ${run.createdAt}
        AND updated_at IS NOT DISTINCT FROM ${run.updatedAt}
      RETURNING id
    `;
    if (!updatedRunRows.length) {
      throw new Error(
        `Agent runtime worker lease evidence could not be recorded because its run state changed: ${run.id}`
      );
    }

    for (const step of leasedSteps) {
      const updatedStepRows = await this.db.$queryRaw<Array<{ id: string }>>`
        UPDATE ai_agent_steps
        SET
          status = ${'running'},
          started_at = COALESCE(started_at, ${now}),
          completed_at = ${null},
          output_summary = (
            CASE
              WHEN jsonb_typeof(output_summary) = ${'object'} THEN output_summary
              ELSE ${'{}'}::jsonb
            END
          ) || ${toJsonString({
            workerLease: {
              version: 'agent-runtime-worker-step-lease/v1',
              executor: 'agent_runtime_worker',
              workerAttempt: run.workerAttempt,
              workerLeaseId: input.workerId,
            },
          })}::jsonb,
          updated_at = ${now}
        WHERE workspace_id = ${run.workspaceId}
          AND run_id = ${run.id}
          AND id = ${step.id}
          AND actor_id = ${step.actorId}
          AND step_key = ${step.stepKey}
          AND step_type = ${step.stepType}
          AND status = ${step.status}
          AND title IS NOT DISTINCT FROM ${step.title}
          AND "order" = ${step.order}
          AND evidence_fingerprint = ${step.evidenceFingerprint}
          AND started_at IS NOT DISTINCT FROM ${step.startedAt}
          AND completed_at IS NOT DISTINCT FROM ${step.completedAt}
          AND output_summary IS NOT DISTINCT FROM ${toJsonString(
            step.outputSummary
          )}::jsonb
          AND created_at = ${step.createdAt}
          AND updated_at IS NOT DISTINCT FROM ${step.updatedAt}
        RETURNING id
      `;
      if (!updatedStepRows.length) {
        throw new Error(
          `Agent runtime worker lease evidence could not be recorded because its step state changed: ${step.id}`
        );
      }
    }

    for (const item of events) {
      await this.insertTimelineEvent({
        actorId: run.actorId,
        event: item,
        runId: run.id,
        workspaceId: run.workspaceId,
        createdAt: now,
      });
    }

    const updated = await this.get(run.workspaceId, run.id);
    if (!updated) {
      throw new Error(`Leased agent runtime run not found: ${run.id}`);
    }
    return updated;
  }

  @Transactional()
  async returnStandaloneDocWriteForReconfirmation(input: {
    workspaceId: string;
    id: string;
    workerLeaseId: string;
    workerAttempt: number;
    documentWorkspaceId: string;
    documentId: string;
    expectedVersion: Date;
    actualVersion: Date;
  }): Promise<CopilotAgentRunRecord> {
    const existing = await this.get(input.workspaceId, input.id);
    if (!existing) {
      throw new Error(`Agent runtime run not found: ${input.id}`);
    }
    if (
      existing.status !== 'running' ||
      existing.workerLeaseId !== input.workerLeaseId ||
      existing.workerAttempt !== input.workerAttempt
    ) {
      throw new Error(
        `Agent runtime run is not leased by this worker: ${input.id}`
      );
    }

    const approvalStep = existing.steps.find(
      step => step.stepType === 'approval' && step.status === 'completed'
    );
    const toolStep = existing.steps.find(
      step => step.stepType === 'tool' && step.status === 'running'
    );
    if (!approvalStep || !toolStep) {
      throw new Error(
        `Agent runtime doc update cannot request re-confirmation without completed approval and running tool steps: ${input.id}`
      );
    }

    const now = nextAgentRuntimeTransitionTimestamp(existing);
    const nextOrdinal =
      Math.max(-1, ...existing.timelineEvents.map(item => item.ordinal)) + 1;
    const nextWorkerMaxAttempts = Math.max(
      existing.workerMaxAttempts,
      existing.workerAttempt + 1
    );
    const evidence = {
      version: 'agent-runtime-doc-update-reconfirmation/v1',
      reason: 'document_version_drift',
      workflow: existing.workflow,
      sourceType: existing.sourceType,
      sourceId: existing.sourceId,
      previousStatus: existing.status,
      documentWorkspaceId: input.documentWorkspaceId,
      documentId: input.documentId,
      expectedVersion: input.expectedVersion.toISOString(),
      actualVersion: input.actualVersion.toISOString(),
      previousApprovalStepId: approvalStep.id,
      workerAttempt: input.workerAttempt,
      nextWorkerMaxAttempts,
      previewStatus: 'invalidated',
      invalidatedAt: now.toISOString(),
    };
    const events: AgentRuntimeTimelineEventInput[] = [
      {
        eventType: 'run_status',
        status: 'waiting_approval',
        ordinal: nextOrdinal,
        summary:
          'Document changed while queued; confirmation is required again',
        stepId: null,
        payload: evidence,
      },
      {
        eventType: 'approval_step',
        status: 'waiting_approval',
        ordinal: nextOrdinal + 1,
        summary: 'Previous approval invalidated by document version drift',
        stepId: approvalStep.id,
        payload: evidence,
      },
      {
        eventType: 'tool_step',
        status: 'pending',
        ordinal: nextOrdinal + 2,
        summary: 'Document write paused before side effects',
        stepId: toolStep.id,
        payload: evidence,
      },
    ];
    const timelineFingerprint = timelineFingerprintWithEvents(existing, events);

    const updatedRunRows = await this.db.$queryRaw<Array<{ id: string }>>`
      UPDATE ai_agent_runs
      SET
        status = ${'waiting_approval'},
        timeline_fingerprint = ${timelineFingerprint},
        queued_at = ${null},
        worker_lease_id = ${null},
        worker_lease_expires_at = ${null},
        worker_max_attempts = ${nextWorkerMaxAttempts},
        failure_code = ${null},
        failure_message = ${null},
        completed_at = ${null},
        updated_at = ${now}
      WHERE workspace_id = ${input.workspaceId}
        AND id = ${input.id}
        AND status = ${'running'}
        AND worker_lease_id = ${input.workerLeaseId}
        AND worker_attempt = ${input.workerAttempt}
        AND worker_max_attempts = ${existing.workerMaxAttempts}
        AND timeline_fingerprint = ${existing.timelineFingerprint}
      RETURNING id
    `;
    if (!updatedRunRows.length) {
      throw new Error(
        `Agent runtime run could not request re-confirmation because its state changed: ${input.id}`
      );
    }

    const approvalOutput = {
      ...approvalStep.outputSummary,
      reconfirmationRequest: evidence,
    };
    const updatedApprovalRows = await this.db.$queryRaw<Array<{ id: string }>>`
      UPDATE ai_agent_steps
      SET
        status = ${'waiting_approval'},
        completed_at = ${null},
        output_summary = ${toJsonString(approvalOutput)}::jsonb,
        updated_at = ${now}
      WHERE id = ${approvalStep.id}
        AND run_id = ${existing.id}
        AND workspace_id = ${existing.workspaceId}
        AND status = ${'completed'}
        AND output_summary IS NOT DISTINCT FROM ${toJsonString(
          approvalStep.outputSummary
        )}::jsonb
      RETURNING id
    `;
    if (!updatedApprovalRows.length) {
      throw new Error(
        `Agent runtime approval step could not request re-confirmation because its state changed: ${approvalStep.id}`
      );
    }

    const toolOutput = {
      ...toolStep.outputSummary,
      reconfirmationRequest: evidence,
    };
    const updatedToolRows = await this.db.$queryRaw<Array<{ id: string }>>`
      UPDATE ai_agent_steps
      SET
        status = ${'pending'},
        completed_at = ${null},
        output_summary = ${toJsonString(toolOutput)}::jsonb,
        updated_at = ${now}
      WHERE id = ${toolStep.id}
        AND run_id = ${existing.id}
        AND workspace_id = ${existing.workspaceId}
        AND status = ${'running'}
        AND output_summary IS NOT DISTINCT FROM ${toJsonString(
          toolStep.outputSummary
        )}::jsonb
      RETURNING id
    `;
    if (!updatedToolRows.length) {
      throw new Error(
        `Agent runtime tool step could not pause for re-confirmation because its state changed: ${toolStep.id}`
      );
    }

    for (const event of events) {
      await this.insertTimelineEvent({
        actorId: existing.actorId,
        event,
        runId: existing.id,
        workspaceId: existing.workspaceId,
        createdAt: now,
      });
    }

    const updated = await this.get(input.workspaceId, input.id);
    if (!updated) {
      throw new Error(
        `Re-confirmation Agent Runtime run not found: ${input.id}`
      );
    }
    return updated;
  }

  @Transactional()
  async waitForDocumentLocation(input: {
    workspaceId: string;
    id: string;
    workerLeaseId: string;
    workerAttempt: number;
    operationId: string;
  }) {
    const existing =
      await this.currentLeasedStandaloneRunBeforeAdapterExecution(input);
    if (
      !existing ||
      !existing.sessionId ||
      existing.sourceType !== 'mcp_ai_delegation' ||
      existing.workflow !== 'agent_runtime_localmind_tool_agent'
    )
      throw new Error(
        'Document location wait requires the current delegated execution lease'
      );
    const operation = await this.db.copilotDocumentOperation.findFirst({
      where: {
        id: input.operationId,
        sessionId: existing.sessionId,
        actorId: existing.actorId,
      },
    });
    if (!operation || operation.status === 'complete')
      throw new Error('The pending document operation is unavailable');
    const now = nextAgentRuntimeTransitionTimestamp(existing);
    const event: AgentRuntimeTimelineEventInput = {
      eventType: 'run_status',
      status: 'waiting_for_location',
      stepId: null,
      ordinal:
        Math.max(-1, ...existing.timelineEvents.map(item => item.ordinal)) + 1,
      summary: 'Waiting for the user to confirm a document destination',
      payload: {
        version: 'delegated-document-location/v1',
        workflow: existing.workflow,
        sourceType: existing.sourceType,
        sourceId: existing.sourceId,
        operationId: operation.id,
        destinationRevision: operation.destinationRevision,
        expiresAt: operation.locationExpiresAt.toISOString(),
      },
    };
    const events: AgentRuntimeTimelineEventInput[] = [
      event,
      ...existing.steps
        .filter(step => step.status === 'running')
        .map((step, index) => ({
          eventType: 'tool_step' as const,
          status: 'pending' as const,
          ordinal: event.ordinal + index + 1,
          stepId: step.id,
          summary: 'Tool execution paused for location confirmation',
          payload: {
            version: 'delegated-document-location/v1',
            stepKey: step.stepKey,
            stepType: step.stepType,
          },
        })),
    ];
    const changed = await this.db.aiAgentRun.updateMany({
      where: {
        id: existing.id,
        status: 'running',
        workerLeaseId: input.workerLeaseId,
        workerAttempt: input.workerAttempt,
        timelineFingerprint: existing.timelineFingerprint,
      },
      data: {
        status: 'waiting_for_location',
        queuedAt: null,
        workerLeaseId: null,
        workerLeaseExpiresAt: null,
        timelineFingerprint: timelineFingerprintWithEvents(existing, events),
        workerMaxAttempts: Math.max(
          existing.workerMaxAttempts,
          existing.workerAttempt + 1
        ),
        updatedAt: now,
      },
    });
    if (changed.count !== 1)
      throw new Error('Delegated execution changed before location wait');
    await this.db.aiAgentStep.updateMany({
      where: { runId: existing.id, status: 'running' },
      data: { status: 'pending', completedAt: null, updatedAt: now },
    });
    for (const event of events)
      await this.insertTimelineEvent({
        actorId: existing.actorId,
        event,
        runId: existing.id,
        workspaceId: existing.workspaceId,
        createdAt: now,
      });
    return await this.get(input.workspaceId, input.id);
  }

  @Transactional()
  async resumeAfterDocumentLocation(input: {
    workspaceId: string;
    id: string;
    actorId: string;
    operationId: string;
  }) {
    await this.db
      .$queryRaw`SELECT id FROM ai_agent_runs WHERE id = ${input.id} AND workspace_id = ${input.workspaceId} FOR UPDATE`;
    const existing = await this.get(input.workspaceId, input.id);
    if (
      !existing ||
      existing.actorId !== input.actorId ||
      existing.sourceType !== 'mcp_ai_delegation' ||
      existing.workflow !== 'agent_runtime_localmind_tool_agent'
    )
      throw new Error('Delegated execution is unavailable');
    if (
      existing.status === 'queued' ||
      existing.status === 'running' ||
      existing.status === 'completed'
    )
      return existing;
    if (existing.status !== 'waiting_for_location' || !existing.sessionId)
      throw new Error('Delegated execution is not waiting for a location');
    const operation = await this.db.copilotDocumentOperation.findFirst({
      where: {
        id: input.operationId,
        sessionId: existing.sessionId,
        actorId: input.actorId,
        status: 'complete',
        destinationConfirmedBy: input.actorId,
      },
    });
    if (!operation)
      throw new Error('The confirmed document operation has not completed');
    const now = nextAgentRuntimeTransitionTimestamp(existing);
    const event: AgentRuntimeTimelineEventInput = {
      eventType: 'run_status',
      status: 'queued',
      stepId: null,
      ordinal:
        Math.max(-1, ...existing.timelineEvents.map(item => item.ordinal)) + 1,
      summary:
        'Document location confirmed; delegated execution queued to continue',
      payload: {
        version: 'delegated-document-location/v1',
        workflow: existing.workflow,
        sourceType: existing.sourceType,
        sourceId: existing.sourceId,
        operationId: operation.id,
        destinationRevision: operation.destinationRevision,
        confirmedBy: operation.destinationConfirmedBy,
      },
    };
    const changed = await this.db.aiAgentRun.updateMany({
      where: {
        id: existing.id,
        status: 'waiting_for_location',
        timelineFingerprint: existing.timelineFingerprint,
      },
      data: {
        status: 'queued',
        queuedAt: now,
        updatedAt: now,
        timelineFingerprint: timelineFingerprintWithEvents(existing, [event]),
      },
    });
    if (changed.count !== 1)
      throw new Error('Delegated execution changed while resuming');
    await this.insertTimelineEvent({
      actorId: input.actorId,
      event,
      runId: existing.id,
      workspaceId: existing.workspaceId,
      createdAt: now,
    });
    return await this.get(input.workspaceId, input.id);
  }

  @Transactional()
  async failStandaloneWorkerExecution(input: {
    workspaceId: string;
    id: string;
    workerLeaseId: string;
    workerAttempt: number;
    code: string;
    message: string;
    adapterResolution?: Record<string, unknown>;
  }): Promise<CopilotAgentRunRecord> {
    const existing = await this.get(input.workspaceId, input.id);
    if (!existing) {
      throw new Error(`Agent runtime run not found: ${input.id}`);
    }
    if (existing.sourceType === 'repair_execution_request') {
      throw new Error(
        'Repair execution Agent Runtime runs must be updated through repair execution sync'
      );
    }
    if (
      existing.status !== 'running' ||
      existing.workerLeaseId !== input.workerLeaseId ||
      existing.workerAttempt !== input.workerAttempt
    ) {
      throw new Error(
        `Agent runtime run is not leased by this worker: ${input.id}`
      );
    }

    const failedAt = nextAgentRuntimeTransitionTimestamp(existing);
    const failureCode = requireAgentRuntimeString(
      input.code,
      'failure code',
      AGENT_RUNTIME_FAILURE_CODE_MAX_LENGTH
    );
    const failureMessage = normalizeWorkerFailureMessage(input.message);
    const adapterResolution = normalizeOptionalAgentRuntimeJsonObject(
      input.adapterResolution,
      'adapter resolution'
    );
    if (adapterResolution) {
      normalizeAdapterResolution(adapterResolution);
      if (adapterResolution.status === 'completed') {
        throw new Error(
          'Agent runtime failure adapter resolution status cannot be completed'
        );
      }
    }
    const nextOrdinal =
      Math.max(-1, ...existing.timelineEvents.map(item => item.ordinal)) + 1;
    const failedSteps = existing.steps.filter(step =>
      isActiveStepStatus(step.status)
    );
    const stepErrorEvents: AgentRuntimeTimelineEventInput[] = failedSteps.map(
      (step, index) => ({
        eventType: 'step_error',
        status: 'failed',
        ordinal: nextOrdinal + index,
        summary: `Agent runtime ${step.stepType} step failed`,
        stepId: step.id,
        payload: {
          version: 'agent-runtime-worker-failure/v1',
          executor: 'agent_runtime_worker',
          failureCode,
          failureMessage,
          stepKey: step.stepKey,
          stepType: step.stepType,
          workerAttempt: existing.workerAttempt,
          workerLeaseId: input.workerLeaseId,
          ...(adapterResolution ? { adapterResolution } : {}),
        },
      })
    );
    const runEvent: AgentRuntimeTimelineEventInput = {
      eventType: 'run_status',
      status: 'failed',
      ordinal: nextOrdinal + stepErrorEvents.length,
      summary: 'Agent runtime worker failed standalone run',
      stepId: null,
      payload: {
        version: 'agent-runtime-worker-failure/v1',
        executor: 'agent_runtime_worker',
        failureCode,
        failureMessage,
        workerAttempt: existing.workerAttempt,
        workerMaxAttempts: existing.workerMaxAttempts,
        workerLeaseId: input.workerLeaseId,
        workflow: existing.workflow,
        sourceType: existing.sourceType,
        sourceId: existing.sourceId,
        ...(adapterResolution ? { adapterResolution } : {}),
      },
    };
    const events = [...stepErrorEvents, runEvent];
    const timelineFingerprint = timelineFingerprintWithEvents(existing, events);

    const failedRows = await this.db.$queryRaw<Array<{ id: string }>>`
      UPDATE ai_agent_runs
      SET
        status = ${'failed'},
        timeline_fingerprint = ${timelineFingerprint},
        completed_at = ${failedAt},
        failure_code = ${failureCode},
        failure_message = ${failureMessage},
        worker_lease_id = ${null},
        worker_lease_expires_at = ${null},
        updated_at = ${failedAt}
      WHERE workspace_id = ${input.workspaceId}
        AND id = ${input.id}
        AND actor_id = ${existing.actorId}
        AND source_type <> ${'repair_execution_request'}
        AND source_type = ${existing.sourceType}
        AND source_id = ${existing.sourceId}
        AND workflow = ${existing.workflow}
        AND status = ${'running'}
        AND title IS NOT DISTINCT FROM ${existing.title}
        AND target_fingerprint = ${existing.targetFingerprint}
        AND evidence_fingerprint = ${existing.evidenceFingerprint}
        AND timeline_fingerprint = ${existing.timelineFingerprint}
        AND started_at IS NOT DISTINCT FROM ${existing.startedAt}
        AND completed_at IS NOT DISTINCT FROM ${existing.completedAt}
        AND failure_code IS NOT DISTINCT FROM ${existing.failureCode}
        AND failure_message IS NOT DISTINCT FROM ${existing.failureMessage}
        AND queued_at IS NOT DISTINCT FROM ${existing.queuedAt}
        AND worker_lease_id = ${input.workerLeaseId}
        AND worker_lease_expires_at IS NOT DISTINCT FROM ${
          existing.workerLeaseExpiresAt
        }
        AND worker_attempt = ${input.workerAttempt}
        AND worker_max_attempts = ${existing.workerMaxAttempts}
        AND last_attempt_at IS NOT DISTINCT FROM ${existing.lastAttemptAt}
        AND created_at = ${existing.createdAt}
        AND updated_at IS NOT DISTINCT FROM ${existing.updatedAt}
      RETURNING id
    `;
    if (!failedRows.length) {
      throw new Error(
        `Agent runtime run could not be failed because its state changed: ${input.id}`
      );
    }

    await this.createWorkerExecutionResultLedgerEntry({
      adapterWorkflow: adapterWorkflowFromResolution(
        adapterResolution,
        existing.workflow
      ),
      completedAt: failedAt,
      executor: 'agent_runtime_worker',
      failureCode,
      failureMessage,
      resultStatus: 'failed',
      run: existing,
      sideEffectMode: sideEffectModeFromResolution(adapterResolution),
      sideEffectsApplied: false,
      summary: failureMessage,
      terminalRunSnapshot: {
        completedAt: failedAt,
        failureCode,
        failureMessage,
        status: 'failed',
        timelineFingerprint,
        updatedAt: failedAt,
        workerLeaseCleared: true,
      },
      workerLeaseId: input.workerLeaseId,
      ...(adapterResolution ? { adapterResolution } : {}),
    });

    for (const step of failedSteps) {
      const failedStepRows = await this.db.$queryRaw<Array<{ id: string }>>`
        UPDATE ai_agent_steps
        SET
          status = ${'failed'},
          completed_at = ${failedAt},
          output_summary = (
            CASE
              WHEN jsonb_typeof(output_summary) = ${'object'} THEN output_summary
              ELSE ${'{}'}::jsonb
            END
          ) || ${toJsonString({
            workerFailure: {
              version: 'agent-runtime-worker-failure/v1',
              executor: 'agent_runtime_worker',
              failureCode,
              failureMessage,
              workerAttempt: existing.workerAttempt,
              workerLeaseId: input.workerLeaseId,
              ...(adapterResolution ? { adapterResolution } : {}),
            },
          })}::jsonb,
          updated_at = ${failedAt}
        WHERE workspace_id = ${input.workspaceId}
          AND run_id = ${input.id}
          AND id = ${step.id}
          AND actor_id = ${step.actorId}
          AND step_key = ${step.stepKey}
          AND step_type = ${step.stepType}
          AND status = ${step.status}
          AND title IS NOT DISTINCT FROM ${step.title}
          AND "order" = ${step.order}
          AND evidence_fingerprint = ${step.evidenceFingerprint}
          AND started_at IS NOT DISTINCT FROM ${step.startedAt}
          AND completed_at IS NOT DISTINCT FROM ${step.completedAt}
          AND output_summary IS NOT DISTINCT FROM ${toJsonString(
            step.outputSummary
          )}::jsonb
          AND created_at = ${step.createdAt}
          AND updated_at IS NOT DISTINCT FROM ${step.updatedAt}
        RETURNING id
      `;
      if (!failedStepRows.length) {
        throw new Error(
          `Agent runtime step could not be failed because its state changed: ${step.id}`
        );
      }
    }

    for (const event of events) {
      await this.insertTimelineEvent({
        actorId: existing.actorId,
        event,
        runId: existing.id,
        workspaceId: existing.workspaceId,
        createdAt: failedAt,
      });
    }

    const run = await this.get(input.workspaceId, input.id);
    if (!run) {
      throw new Error(`Failed agent runtime run not found: ${input.id}`);
    }
    return run;
  }

  @Transactional()
  async completeStandaloneRecordOnlyExecution(input: {
    workspaceId: string;
    id: string;
    workerLeaseId: string;
    workerAttempt: number;
    summary?: string | null;
  }): Promise<CopilotAgentRunRecord> {
    const existing = await this.get(input.workspaceId, input.id);
    if (!existing) {
      throw new Error(`Agent runtime run not found: ${input.id}`);
    }
    if (existing.sourceType === 'repair_execution_request') {
      throw new Error(
        'Repair execution Agent Runtime runs must be updated through repair execution sync'
      );
    }
    if (
      existing.status !== 'running' ||
      existing.workerLeaseId !== input.workerLeaseId ||
      existing.workerAttempt !== input.workerAttempt
    ) {
      throw new Error(
        `Agent runtime run is not leased by this worker: ${input.id}`
      );
    }
    if (existing.workflow !== 'agent_runtime_record_only') {
      throw new Error(
        `Agent runtime workflow is not record-only executable: ${existing.workflow}`
      );
    }

    const completedAt = nextAgentRuntimeTransitionTimestamp(existing);
    const summary = normalizeRecordOnlySummary(input.summary);
    const nextOrdinal =
      Math.max(-1, ...existing.timelineEvents.map(item => item.ordinal)) + 1;
    const activeSteps = existing.steps.filter(step =>
      isActiveStepStatus(step.status)
    );
    const stepCompletedEvents: AgentRuntimeTimelineEventInput[] =
      activeSteps.map((step, index) => ({
        eventType: timelineEventTypeForStep(step.stepType),
        status: 'completed',
        ordinal: nextOrdinal + index,
        summary: `Agent runtime ${step.stepType} step completed`,
        stepId: step.id,
        payload: {
          version: 'agent-runtime-record-only-execution/v1',
          executor: 'agent_runtime_record_only_adapter',
          summary,
          stepKey: step.stepKey,
          stepType: step.stepType,
          workerAttempt: existing.workerAttempt,
          workerLeaseId: input.workerLeaseId,
        },
      }));
    const runEvent: AgentRuntimeTimelineEventInput = {
      eventType: 'run_status',
      status: 'completed',
      ordinal: nextOrdinal + stepCompletedEvents.length,
      summary: 'Agent runtime record-only worker completed standalone run',
      stepId: null,
      payload: {
        version: 'agent-runtime-record-only-execution/v1',
        executor: 'agent_runtime_record_only_adapter',
        summary,
        sideEffectsApplied: false,
        workerAttempt: existing.workerAttempt,
        workerMaxAttempts: existing.workerMaxAttempts,
        workerLeaseId: input.workerLeaseId,
        workflow: existing.workflow,
        sourceType: existing.sourceType,
        sourceId: existing.sourceId,
      },
    };
    const events = [...stepCompletedEvents, runEvent];
    const timelineFingerprint = timelineFingerprintWithEvents(existing, events);

    const completedRows = await this.db.$queryRaw<Array<{ id: string }>>`
      UPDATE ai_agent_runs
      SET
        status = ${'completed'},
        timeline_fingerprint = ${timelineFingerprint},
        completed_at = ${completedAt},
        failure_code = ${null},
        failure_message = ${null},
        worker_lease_id = ${null},
        worker_lease_expires_at = ${null},
        updated_at = ${completedAt}
      WHERE workspace_id = ${input.workspaceId}
        AND id = ${input.id}
        AND actor_id = ${existing.actorId}
        AND source_type <> ${'repair_execution_request'}
        AND source_type = ${existing.sourceType}
        AND source_id = ${existing.sourceId}
        AND workflow = ${existing.workflow}
        AND status = ${'running'}
        AND title IS NOT DISTINCT FROM ${existing.title}
        AND target_fingerprint = ${existing.targetFingerprint}
        AND evidence_fingerprint = ${existing.evidenceFingerprint}
        AND timeline_fingerprint = ${existing.timelineFingerprint}
        AND started_at IS NOT DISTINCT FROM ${existing.startedAt}
        AND completed_at IS NOT DISTINCT FROM ${existing.completedAt}
        AND failure_code IS NOT DISTINCT FROM ${existing.failureCode}
        AND failure_message IS NOT DISTINCT FROM ${existing.failureMessage}
        AND queued_at IS NOT DISTINCT FROM ${existing.queuedAt}
        AND worker_lease_id = ${input.workerLeaseId}
        AND worker_lease_expires_at IS NOT DISTINCT FROM ${
          existing.workerLeaseExpiresAt
        }
        AND worker_attempt = ${input.workerAttempt}
        AND worker_max_attempts = ${existing.workerMaxAttempts}
        AND last_attempt_at IS NOT DISTINCT FROM ${existing.lastAttemptAt}
        AND created_at = ${existing.createdAt}
        AND updated_at IS NOT DISTINCT FROM ${existing.updatedAt}
      RETURNING id
    `;
    if (!completedRows.length) {
      throw new Error(
        `Agent runtime run could not be completed because its state changed: ${input.id}`
      );
    }

    await this.createWorkerExecutionResultLedgerEntry({
      adapterWorkflow: 'agent_runtime_record_only',
      completedAt,
      executor: 'agent_runtime_record_only_adapter',
      resultStatus: 'completed',
      run: existing,
      sideEffectMode: 'none',
      sideEffectsApplied: false,
      summary,
      terminalRunSnapshot: {
        completedAt,
        failureCode: null,
        failureMessage: null,
        status: 'completed',
        timelineFingerprint,
        updatedAt: completedAt,
        workerLeaseCleared: true,
      },
      workerLeaseId: input.workerLeaseId,
    });

    for (const step of activeSteps) {
      const completedStepRows = await this.db.$queryRaw<Array<{ id: string }>>`
        UPDATE ai_agent_steps
        SET
          status = ${'completed'},
          completed_at = ${completedAt},
          output_summary = (
            CASE
              WHEN jsonb_typeof(output_summary) = ${'object'} THEN output_summary
              ELSE ${'{}'}::jsonb
            END
          ) || ${toJsonString({
            recordOnlyExecution: {
              version: 'agent-runtime-record-only-execution/v1',
              executor: 'agent_runtime_record_only_adapter',
              summary,
              sideEffectsApplied: false,
              workerAttempt: existing.workerAttempt,
              workerLeaseId: input.workerLeaseId,
            },
          })}::jsonb,
          updated_at = ${completedAt}
        WHERE workspace_id = ${input.workspaceId}
          AND run_id = ${input.id}
          AND id = ${step.id}
          AND actor_id = ${step.actorId}
          AND step_key = ${step.stepKey}
          AND step_type = ${step.stepType}
          AND status = ${step.status}
          AND title IS NOT DISTINCT FROM ${step.title}
          AND "order" = ${step.order}
          AND evidence_fingerprint = ${step.evidenceFingerprint}
          AND started_at IS NOT DISTINCT FROM ${step.startedAt}
          AND completed_at IS NOT DISTINCT FROM ${step.completedAt}
          AND output_summary IS NOT DISTINCT FROM ${toJsonString(
            step.outputSummary
          )}::jsonb
          AND created_at = ${step.createdAt}
          AND updated_at IS NOT DISTINCT FROM ${step.updatedAt}
        RETURNING id
      `;
      if (!completedStepRows.length) {
        throw new Error(
          `Agent runtime step could not be completed because its state changed: ${step.id}`
        );
      }
    }

    for (const event of events) {
      await this.insertTimelineEvent({
        actorId: existing.actorId,
        event,
        runId: existing.id,
        workspaceId: existing.workspaceId,
        createdAt: completedAt,
      });
    }

    const run = await this.get(input.workspaceId, input.id);
    if (!run) {
      throw new Error(`Completed agent runtime run not found: ${input.id}`);
    }
    return run;
  }

  @Transactional()
  async completeStandaloneWorkerExecution(input: {
    workspaceId: string;
    id: string;
    workerLeaseId: string;
    workerAttempt: number;
    adapterWorkflow: string;
    sideEffectMode: string;
    sideEffectsApplied?: boolean;
    sideEffectSummary?: Record<string, unknown> | null;
    summary?: string | null;
    adapterResolution: Record<string, unknown>;
  }): Promise<CopilotAgentRunRecord> {
    const existing = await this.get(input.workspaceId, input.id);
    if (!existing) {
      throw new Error(`Agent runtime run not found: ${input.id}`);
    }
    if (existing.sourceType === 'repair_execution_request') {
      throw new Error(
        'Repair execution Agent Runtime runs must be updated through repair execution sync'
      );
    }
    if (
      existing.status !== 'running' ||
      existing.workerLeaseId !== input.workerLeaseId ||
      existing.workerAttempt !== input.workerAttempt
    ) {
      throw new Error(
        `Agent runtime run is not leased by this worker: ${input.id}`
      );
    }
    const adapterWorkflow = requireAgentRuntimeString(
      input.adapterWorkflow,
      'adapter workflow'
    );
    if (adapterWorkflow !== existing.workflow) {
      throw new Error(
        'Agent runtime completion adapter workflow must match run workflow'
      );
    }
    const sideEffectMode = requireAgentRuntimeString(
      input.sideEffectMode,
      'side-effect mode'
    );
    if (sideEffectMode === 'project_write') {
      throw new Error('Project effects require a native Project worker lease');
    }
    if (!AGENT_RUNTIME_ADAPTER_SIDE_EFFECT_MODES.has(sideEffectMode)) {
      throw new Error(
        `Agent runtime completion side-effect mode is unsupported: ${sideEffectMode}`
      );
    }
    const adapterResolution = normalizeAgentRuntimeJsonObject(
      input.adapterResolution,
      'adapter resolution'
    );
    normalizeAdapterResolution(adapterResolution);
    validateCompletedAdapterResolution({
      adapterResolution,
      adapterWorkflow,
      runWorkflow: existing.workflow,
      sideEffectMode,
    });
    const sideEffectsApplied = input.sideEffectsApplied === true;
    if (sideEffectsApplied && sideEffectMode === 'none') {
      throw new Error(
        'Agent runtime completion cannot apply side effects in none mode'
      );
    }
    const sideEffectSummary = normalizeWorkerSideEffectSummary(
      input.sideEffectSummary
    );
    if (sideEffectsApplied && !sideEffectSummary) {
      throw new Error(
        'Agent runtime completion applied side effects require a side-effect summary'
      );
    }
    if (sideEffectSummary && !sideEffectsApplied) {
      throw new Error(
        'Agent runtime completion side-effect summary requires applied side effects'
      );
    }

    const completedAt = nextAgentRuntimeTransitionTimestamp(existing);
    const summary = normalizeWorkerCompletionSummary(input.summary);
    const nextOrdinal =
      Math.max(-1, ...existing.timelineEvents.map(item => item.ordinal)) + 1;
    const activeSteps = existing.steps.filter(step =>
      isActiveStepStatus(step.status)
    );
    const stepCompletedEvents: AgentRuntimeTimelineEventInput[] =
      activeSteps.map((step, index) => ({
        eventType: timelineEventTypeForStep(step.stepType),
        status: 'completed',
        ordinal: nextOrdinal + index,
        summary: `Agent runtime ${step.stepType} step completed`,
        stepId: step.id,
        payload: {
          version: 'agent-runtime-worker-completion/v1',
          executor: 'agent_runtime_worker',
          adapterWorkflow,
          sideEffectMode,
          sideEffectsApplied,
          ...(sideEffectSummary ? { sideEffectSummary } : {}),
          summary,
          stepKey: step.stepKey,
          stepType: step.stepType,
          workerAttempt: existing.workerAttempt,
          workerLeaseId: input.workerLeaseId,
          adapterResolution,
        },
      }));
    const runEvent: AgentRuntimeTimelineEventInput = {
      eventType: 'run_status',
      status: 'completed',
      ordinal: nextOrdinal + stepCompletedEvents.length,
      summary: 'Agent runtime worker completed standalone run',
      stepId: null,
      payload: {
        version: 'agent-runtime-worker-completion/v1',
        executor: 'agent_runtime_worker',
        adapterWorkflow,
        sideEffectMode,
        sideEffectsApplied,
        ...(sideEffectSummary ? { sideEffectSummary } : {}),
        summary,
        workerAttempt: existing.workerAttempt,
        workerMaxAttempts: existing.workerMaxAttempts,
        workerLeaseId: input.workerLeaseId,
        workflow: existing.workflow,
        sourceType: existing.sourceType,
        sourceId: existing.sourceId,
        adapterResolution,
      },
    };
    const events = [...stepCompletedEvents, runEvent];
    const timelineFingerprint = timelineFingerprintWithEvents(existing, events);

    const completedRows = await this.db.$queryRaw<Array<{ id: string }>>`
      UPDATE ai_agent_runs
      SET
        status = ${'completed'},
        timeline_fingerprint = ${timelineFingerprint},
        completed_at = ${completedAt},
        failure_code = ${null},
        failure_message = ${null},
        worker_lease_id = ${null},
        worker_lease_expires_at = ${null},
        updated_at = ${completedAt}
      WHERE workspace_id = ${input.workspaceId}
        AND id = ${input.id}
        AND actor_id = ${existing.actorId}
        AND source_type <> ${'repair_execution_request'}
        AND source_type = ${existing.sourceType}
        AND source_id = ${existing.sourceId}
        AND workflow = ${existing.workflow}
        AND status = ${'running'}
        AND title IS NOT DISTINCT FROM ${existing.title}
        AND target_fingerprint = ${existing.targetFingerprint}
        AND evidence_fingerprint = ${existing.evidenceFingerprint}
        AND timeline_fingerprint = ${existing.timelineFingerprint}
        AND started_at IS NOT DISTINCT FROM ${existing.startedAt}
        AND completed_at IS NOT DISTINCT FROM ${existing.completedAt}
        AND failure_code IS NOT DISTINCT FROM ${existing.failureCode}
        AND failure_message IS NOT DISTINCT FROM ${existing.failureMessage}
        AND queued_at IS NOT DISTINCT FROM ${existing.queuedAt}
        AND worker_lease_id = ${input.workerLeaseId}
        AND worker_lease_expires_at IS NOT DISTINCT FROM ${
          existing.workerLeaseExpiresAt
        }
        AND worker_attempt = ${input.workerAttempt}
        AND worker_max_attempts = ${existing.workerMaxAttempts}
        AND last_attempt_at IS NOT DISTINCT FROM ${existing.lastAttemptAt}
        AND created_at = ${existing.createdAt}
        AND updated_at IS NOT DISTINCT FROM ${existing.updatedAt}
      RETURNING id
    `;
    if (!completedRows.length) {
      throw new Error(
        `Agent runtime run could not be completed because its state changed: ${input.id}`
      );
    }

    await this.createWorkerExecutionResultLedgerEntry({
      adapterResolution,
      adapterWorkflow,
      completedAt,
      executor: 'agent_runtime_worker',
      resultStatus: 'completed',
      run: existing,
      sideEffectMode,
      sideEffectsApplied,
      sideEffectSummary,
      summary,
      terminalRunSnapshot: {
        completedAt,
        failureCode: null,
        failureMessage: null,
        status: 'completed',
        timelineFingerprint,
        updatedAt: completedAt,
        workerLeaseCleared: true,
      },
      workerLeaseId: input.workerLeaseId,
    });

    for (const step of activeSteps) {
      const completedStepRows = await this.db.$queryRaw<Array<{ id: string }>>`
        UPDATE ai_agent_steps
        SET
          status = ${'completed'},
          completed_at = ${completedAt},
          output_summary = (
            CASE
              WHEN jsonb_typeof(output_summary) = ${'object'} THEN output_summary
              ELSE ${'{}'}::jsonb
            END
          ) || ${toJsonString({
            workerCompletion: {
              version: 'agent-runtime-worker-completion/v1',
              executor: 'agent_runtime_worker',
              adapterWorkflow,
              sideEffectMode,
              sideEffectsApplied,
              ...(sideEffectSummary ? { sideEffectSummary } : {}),
              summary,
              workerAttempt: existing.workerAttempt,
              workerLeaseId: input.workerLeaseId,
              adapterResolution,
            },
          })}::jsonb,
          updated_at = ${completedAt}
        WHERE workspace_id = ${input.workspaceId}
          AND run_id = ${input.id}
          AND id = ${step.id}
          AND actor_id = ${step.actorId}
          AND step_key = ${step.stepKey}
          AND step_type = ${step.stepType}
          AND status = ${step.status}
          AND title IS NOT DISTINCT FROM ${step.title}
          AND "order" = ${step.order}
          AND evidence_fingerprint = ${step.evidenceFingerprint}
          AND started_at IS NOT DISTINCT FROM ${step.startedAt}
          AND completed_at IS NOT DISTINCT FROM ${step.completedAt}
          AND output_summary IS NOT DISTINCT FROM ${toJsonString(
            step.outputSummary
          )}::jsonb
          AND created_at = ${step.createdAt}
          AND updated_at IS NOT DISTINCT FROM ${step.updatedAt}
        RETURNING id
      `;
      if (!completedStepRows.length) {
        throw new Error(
          `Agent runtime step could not be completed because its state changed: ${step.id}`
        );
      }
    }

    for (const event of events) {
      await this.insertTimelineEvent({
        actorId: existing.actorId,
        event,
        runId: existing.id,
        workspaceId: existing.workspaceId,
        createdAt: completedAt,
      });
    }

    const run = await this.get(input.workspaceId, input.id);
    if (!run) {
      throw new Error(`Completed agent runtime run not found: ${input.id}`);
    }
    return run;
  }

  @Transactional()
  async cancelLeasedStandaloneRunIfCancellationRequested(input: {
    workspaceId: string;
    id: string;
    workerLeaseId: string;
    workerAttempt: number;
  }): Promise<CopilotAgentRunRecord | null> {
    const existing = await this.get(input.workspaceId, input.id);
    if (!existing) {
      throw new Error(`Agent runtime run not found: ${input.id}`);
    }
    if (existing.sourceType === 'repair_execution_request') {
      throw new Error(
        'Repair execution Agent Runtime runs must be controlled through repair execution controls'
      );
    }
    if (
      existing.status !== 'running' ||
      existing.workerLeaseId !== input.workerLeaseId ||
      existing.workerAttempt !== input.workerAttempt
    ) {
      return null;
    }

    const rows = await this.db.$queryRaw<
      Array<{
        actorId: string;
        payload: { reason?: string | null };
      }>
    >`
      SELECT actor_id AS "actorId", payload
      FROM ai_agent_timeline_events
      WHERE workspace_id = ${input.workspaceId}
        AND run_id = ${input.id}
        AND step_id IS NULL
        AND event_type = ${'run_cancellation'}
        AND status = ${'running'}
        AND payload->>'version' = ${'agent-runtime-manual-control/v1'}
        AND payload->>'action' = ${'cancel_requested'}
        AND payload->>'workerLeaseId' = ${input.workerLeaseId}
        AND (payload->>'workerAttempt')::int = ${existing.workerAttempt}
        AND created_at >= ${existing.lastAttemptAt}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `;
    const request = rows[0];
    if (!request) {
      return null;
    }

    return await this.cancelStandaloneRun(
      {
        workspaceId: input.workspaceId,
        actorId: request.actorId,
        id: input.id,
        action: 'cancel',
        reason: request.payload.reason,
        consumeRunningCancellation: true,
      },
      existing
    );
  }

  private async createWorkerExecutionResultLedgerEntry(input: {
    adapterResolution?: Record<string, unknown>;
    adapterWorkflow: string;
    completedAt: Date;
    executor: string;
    failureCode?: string | null;
    failureMessage?: string | null;
    resultStatus: 'completed' | 'failed';
    run: CopilotAgentRunRecord;
    sideEffectMode: string;
    sideEffectsApplied: boolean;
    sideEffectSummary?: Record<string, unknown> | null;
    summary: string;
    terminalRunSnapshot?: {
      completedAt: Date;
      failureCode: string | null;
      failureMessage: string | null;
      status: 'completed' | 'failed';
      timelineFingerprint: string;
      updatedAt: Date;
      workerLeaseCleared: boolean;
    };
    workerLeaseId: string;
  }) {
    const payload = {
      version: AGENT_RUNTIME_WORKER_EXECUTION_RESULT_VERSION,
      resultStatus: input.resultStatus,
      workflow: input.run.workflow,
      sourceType: input.run.sourceType,
      sourceId: input.run.sourceId,
      adapterWorkflow: input.adapterWorkflow,
      executor: input.executor,
      sideEffectMode: input.sideEffectMode,
      sideEffectsApplied: input.sideEffectsApplied,
      ...(input.sideEffectSummary
        ? { sideEffectSummary: input.sideEffectSummary }
        : {}),
      summary: input.summary,
      workerAttempt: input.run.workerAttempt,
      workerLeaseId: input.workerLeaseId,
      completedAt: input.completedAt.toISOString(),
      ...(input.failureCode ? { failureCode: input.failureCode } : {}),
      ...(input.failureMessage ? { failureMessage: input.failureMessage } : {}),
      ...(input.adapterResolution
        ? { adapterResolution: input.adapterResolution }
        : {}),
    };
    const resultFingerprint = agentRuntimeFingerprint({
      runId: input.run.id,
      payload,
    });
    const ledgerId = `agent-runtime-execution-result-${resultFingerprint}`;

    type TerminalRunSnapshot = NonNullable<typeof input.terminalRunSnapshot>;
    const terminalRunSnapshot: TerminalRunSnapshot =
      input.terminalRunSnapshot ?? {
        completedAt: input.completedAt,
        failureCode: input.failureCode ?? null,
        failureMessage: input.failureMessage ?? null,
        status: input.resultStatus,
        timelineFingerprint: input.run.timelineFingerprint,
        updatedAt: input.run.updatedAt,
        workerLeaseCleared: false,
      };

    const insertedRows = await this.db.$queryRaw<Array<{ id: string }>>`
      INSERT INTO ai_agent_runtime_execution_results (
        id,
        run_id,
        workspace_id,
        actor_id,
        workflow,
        source_type,
        source_id,
        adapter_workflow,
        executor,
        result_status,
        side_effect_mode,
        side_effects_applied,
        summary,
        failure_code,
        failure_message,
        result_payload,
        result_fingerprint,
        worker_attempt,
        worker_lease_id,
        completed_at,
        created_at
      )
      SELECT
        ${ledgerId},
        ${input.run.id},
        ${input.run.workspaceId},
        ${input.run.actorId},
        ${input.run.workflow},
        ${input.run.sourceType},
        ${input.run.sourceId},
        ${input.adapterWorkflow},
        ${input.executor},
        ${input.resultStatus},
        ${input.sideEffectMode},
        ${input.sideEffectsApplied},
        ${input.summary},
        ${input.failureCode ?? null},
        ${input.failureMessage ?? null},
        ${toJsonString(payload)}::jsonb,
        ${resultFingerprint},
        ${input.run.workerAttempt},
        ${input.workerLeaseId},
        ${input.completedAt},
        ${input.completedAt}
      FROM ai_agent_runs run
      WHERE run.id = ${input.run.id}
        AND run.workspace_id = ${input.run.workspaceId}
        AND run.actor_id = ${input.run.actorId}
        AND run.source_type <> ${'repair_execution_request'}
        AND run.source_type = ${input.run.sourceType}
        AND run.source_id = ${input.run.sourceId}
        AND run.workflow = ${input.run.workflow}
        AND run.status = ${terminalRunSnapshot.status}
        AND run.status = ${input.resultStatus}
        AND run.title IS NOT DISTINCT FROM ${input.run.title}
        AND run.target_fingerprint = ${input.run.targetFingerprint}
        AND run.evidence_fingerprint = ${input.run.evidenceFingerprint}
        AND run.timeline_fingerprint = ${
          terminalRunSnapshot.timelineFingerprint
        }
        AND run.started_at IS NOT DISTINCT FROM ${input.run.startedAt}
        AND run.completed_at = ${terminalRunSnapshot.completedAt}
        AND run.failure_code IS NOT DISTINCT FROM ${
          terminalRunSnapshot.failureCode
        }
        AND run.failure_message IS NOT DISTINCT FROM ${
          terminalRunSnapshot.failureMessage
        }
        AND run.queued_at IS NOT DISTINCT FROM ${input.run.queuedAt}
        AND (
          (
            ${terminalRunSnapshot.workerLeaseCleared}
            AND run.worker_lease_id IS NULL
            AND run.worker_lease_expires_at IS NULL
          )
          OR (
            NOT ${terminalRunSnapshot.workerLeaseCleared}
            AND run.worker_lease_id IS NOT DISTINCT FROM ${
              input.run.workerLeaseId
            }
            AND run.worker_lease_expires_at IS NOT DISTINCT FROM ${
              input.run.workerLeaseExpiresAt
            }
          )
        )
        AND run.worker_attempt = ${input.run.workerAttempt}
        AND run.worker_max_attempts = ${input.run.workerMaxAttempts}
        AND run.last_attempt_at IS NOT DISTINCT FROM ${input.run.lastAttemptAt}
        AND run.created_at = ${input.run.createdAt}
        AND run.updated_at IS NOT DISTINCT FROM ${terminalRunSnapshot.updatedAt}
      ON CONFLICT (run_id, worker_attempt) DO NOTHING
      RETURNING id
    `;
    if (insertedRows.length) {
      return;
    }

    const existing = await this.getExecutionResultByRunAttempt({
      runId: input.run.id,
      workerAttempt: input.run.workerAttempt,
    });
    if (!existing) {
      if (!insertedRows.length) {
        throw new Error(
          `Agent runtime execution result could not be recorded because its run state changed: ${input.run.id}`
        );
      }
      throw new Error('Created agent runtime execution result not found');
    }
    assertAgentRuntimeExecutionResultMatchesLedgerEvidence(existing, {
      actorId: input.run.actorId,
      adapterWorkflow: input.adapterWorkflow,
      completedAt: input.completedAt,
      executor: input.executor,
      failureCode: input.failureCode ?? null,
      failureMessage: input.failureMessage ?? null,
      resultFingerprint,
      resultPayload: payload,
      resultStatus: input.resultStatus,
      runId: input.run.id,
      sideEffectMode: input.sideEffectMode,
      sideEffectsApplied: input.sideEffectsApplied,
      sourceId: input.run.sourceId,
      sourceType: input.run.sourceType,
      summary: input.summary,
      workerAttempt: input.run.workerAttempt,
      workerLeaseId: input.workerLeaseId,
      workflow: input.run.workflow,
      workspaceId: input.run.workspaceId,
    });
  }

  private async listSteps(workspaceId: string, runId: string) {
    const rows = await this.db.$queryRaw<CopilotAgentStepRecord[]>`
      SELECT
        id,
        run_id AS "runId",
        workspace_id AS "workspaceId",
        actor_id AS "actorId",
        step_key AS "stepKey",
        step_type AS "stepType",
        status,
        title,
        "order",
        evidence_fingerprint AS "evidenceFingerprint",
        output_summary AS "outputSummary",
        started_at AS "startedAt",
        completed_at AS "completedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM ai_agent_steps
      WHERE workspace_id = ${workspaceId} AND run_id = ${runId}
      ORDER BY "order" ASC, created_at ASC
    `;
    return rows.map(hydrateAgentRuntimeStep);
  }

  private async listTimelineEvents(workspaceId: string, runId: string) {
    const rows = await this.db.$queryRaw<CopilotAgentTimelineEventRecord[]>`
      SELECT
        id,
        run_id AS "runId",
        step_id AS "stepId",
        workspace_id AS "workspaceId",
        actor_id AS "actorId",
        event_type AS "eventType",
        status,
        ordinal,
        summary,
        payload,
        event_fingerprint AS "eventFingerprint",
        created_at AS "createdAt"
      FROM ai_agent_timeline_events
      WHERE workspace_id = ${workspaceId} AND run_id = ${runId}
      ORDER BY ordinal ASC, created_at ASC
    `;
    return rows.map(hydrateAgentRuntimeTimelineEvent);
  }

  private async getExecutionResultByRunAttempt(input: {
    runId: string;
    workerAttempt: number;
  }) {
    const rows = await this.db.$queryRaw<
      CopilotAgentRuntimeExecutionResultRecord[]
    >`
        SELECT
          id,
          run_id AS "runId",
          workspace_id AS "workspaceId",
          actor_id AS "actorId",
          workflow,
          source_type AS "sourceType",
          source_id AS "sourceId",
          adapter_workflow AS "adapterWorkflow",
          executor,
          result_status AS "resultStatus",
          side_effect_mode AS "sideEffectMode",
          side_effects_applied AS "sideEffectsApplied",
          summary,
          failure_code AS "failureCode",
          failure_message AS "failureMessage",
          result_payload AS "resultPayload",
          result_fingerprint AS "resultFingerprint",
          worker_attempt AS "workerAttempt",
          worker_lease_id AS "workerLeaseId",
          completed_at AS "completedAt",
          created_at AS "createdAt"
        FROM ai_agent_runtime_execution_results
        WHERE run_id = ${input.runId}
          AND worker_attempt = ${input.workerAttempt}
        LIMIT 1
      `;
    return rows[0] ? hydrateAgentRuntimeExecutionResult(rows[0]) : null;
  }

  private async listExecutionResults(
    workspaceId: string,
    runId: string,
    options: { limit?: number } = {}
  ) {
    const limit = Math.min(Math.max(options.limit ?? 5, 1), 20);
    const rows = await this.db.$queryRaw<
      Array<
        CopilotAgentRuntimeExecutionResultRecord & {
          executionResultCount: number;
        }
      >
    >`
      SELECT
        id,
        run_id AS "runId",
        workspace_id AS "workspaceId",
        actor_id AS "actorId",
        workflow,
        source_type AS "sourceType",
        source_id AS "sourceId",
        adapter_workflow AS "adapterWorkflow",
        executor,
        result_status AS "resultStatus",
        side_effect_mode AS "sideEffectMode",
        side_effects_applied AS "sideEffectsApplied",
        summary,
        failure_code AS "failureCode",
        failure_message AS "failureMessage",
        result_payload AS "resultPayload",
        result_fingerprint AS "resultFingerprint",
        worker_attempt AS "workerAttempt",
        worker_lease_id AS "workerLeaseId",
        completed_at AS "completedAt",
        created_at AS "createdAt",
        COUNT(*) OVER()::int AS "executionResultCount"
      FROM ai_agent_runtime_execution_results
      WHERE workspace_id = ${workspaceId} AND run_id = ${runId}
      ORDER BY worker_attempt DESC, completed_at DESC, id DESC
      LIMIT ${limit}
    `;

    return {
      executionResultCount: rows[0]?.executionResultCount ?? 0,
      executionResults: rows.map(hydrateAgentRuntimeExecutionResult),
    };
  }

  private async cancelStandaloneRun(
    input: {
      workspaceId: string;
      actorId: string;
      id: string;
      action: CopilotAgentRuntimeControlAction;
      reason?: string | null;
      consumeRunningCancellation?: boolean;
    },
    existing: CopilotAgentRunRecord
  ) {
    if (isTerminalRunStatus(existing.status)) {
      throw new Error(
        `Agent runtime run cannot be cancelled from status: ${existing.status}`
      );
    }
    if (
      existing.status === 'running' &&
      existing.workerLeaseId &&
      !input.consumeRunningCancellation
    ) {
      return await this.requestRunningStandaloneCancellation(input, existing);
    }

    const now = nextAgentRuntimeTransitionTimestamp(existing);
    const reason = normalizeControlReason(input.reason);
    const event = controlledRunTimeline({
      action: 'cancel',
      actorId: input.actorId,
      reason,
      run: existing,
      startedAt: now,
    });
    const cancellableSteps = existing.steps.filter(step =>
      isActiveStepStatus(step.status)
    );
    const stepEvents = cancellableSteps.map((step, index) =>
      controlledStepTimeline({
        action: 'cancel',
        actorId: input.actorId,
        ordinal: event.ordinal + index + 1,
        reason,
        run: existing,
        startedAt: now,
        status: 'skipped',
        step,
      })
    );
    const events = [event, ...stepEvents];
    const timelineFingerprint = timelineFingerprintWithEvents(existing, events);

    const cancelledRows = await this.db.$queryRaw<Array<{ id: string }>>`
      UPDATE ai_agent_runs
      SET
        status = ${'cancelled'},
        timeline_fingerprint = ${timelineFingerprint},
        completed_at = ${now},
        failure_code = ${null},
        failure_message = ${null},
        queued_at = ${null},
        worker_lease_id = ${null},
        worker_lease_expires_at = ${null},
        updated_at = ${now}
      WHERE workspace_id = ${input.workspaceId}
        AND id = ${input.id}
        AND actor_id = ${existing.actorId}
        AND source_type <> ${'repair_execution_request'}
        AND source_type = ${existing.sourceType}
        AND source_id = ${existing.sourceId}
        AND workflow = ${existing.workflow}
        AND status = ${existing.status}
        AND title IS NOT DISTINCT FROM ${existing.title}
        AND target_fingerprint = ${existing.targetFingerprint}
        AND evidence_fingerprint = ${existing.evidenceFingerprint}
        AND timeline_fingerprint = ${existing.timelineFingerprint}
        AND started_at IS NOT DISTINCT FROM ${existing.startedAt}
        AND completed_at IS NOT DISTINCT FROM ${existing.completedAt}
        AND failure_code IS NOT DISTINCT FROM ${existing.failureCode}
        AND failure_message IS NOT DISTINCT FROM ${existing.failureMessage}
        AND queued_at IS NOT DISTINCT FROM ${existing.queuedAt}
        AND worker_lease_id IS NOT DISTINCT FROM ${existing.workerLeaseId}
        AND worker_lease_expires_at IS NOT DISTINCT FROM ${
          existing.workerLeaseExpiresAt
        }
        AND worker_attempt = ${existing.workerAttempt}
        AND worker_max_attempts = ${existing.workerMaxAttempts}
        AND last_attempt_at IS NOT DISTINCT FROM ${existing.lastAttemptAt}
        AND created_at = ${existing.createdAt}
        AND updated_at IS NOT DISTINCT FROM ${existing.updatedAt}
      RETURNING id
    `;
    if (!cancelledRows.length) {
      throw new Error(
        `Agent runtime run could not be cancelled because its state changed: ${input.id}`
      );
    }

    for (const step of cancellableSteps) {
      const updatedRows = await this.db.$queryRaw<Array<{ id: string }>>`
        UPDATE ai_agent_steps
        SET
          status = ${'skipped'},
          completed_at = ${now},
          output_summary = (
            CASE
              WHEN jsonb_typeof(output_summary) = ${'object'} THEN output_summary
              ELSE ${'{}'}::jsonb
            END
          ) || ${toJsonString({
            manualControl: {
              version: 'agent-runtime-manual-control/v1',
              action: 'cancel',
              actorId: input.actorId,
              reason,
            },
          })}::jsonb,
          updated_at = ${now}
        WHERE workspace_id = ${input.workspaceId}
          AND run_id = ${input.id}
          AND id = ${step.id}
          AND actor_id = ${step.actorId}
          AND step_key = ${step.stepKey}
          AND step_type = ${step.stepType}
          AND status = ${step.status}
          AND title IS NOT DISTINCT FROM ${step.title}
          AND "order" = ${step.order}
          AND evidence_fingerprint = ${step.evidenceFingerprint}
          AND started_at IS NOT DISTINCT FROM ${step.startedAt}
          AND completed_at IS NOT DISTINCT FROM ${step.completedAt}
          AND output_summary IS NOT DISTINCT FROM ${toJsonString(
            step.outputSummary
          )}::jsonb
          AND created_at = ${step.createdAt}
          AND updated_at IS NOT DISTINCT FROM ${step.updatedAt}
        RETURNING id
      `;
      if (!updatedRows.length) {
        throw new Error(
          `Agent runtime step could not be cancelled because its state changed: ${step.id}`
        );
      }
    }

    for (const event of events) {
      await this.insertTimelineEvent({
        actorId: input.actorId,
        event,
        runId: existing.id,
        workspaceId: input.workspaceId,
        createdAt: now,
      });
    }

    const run = await this.get(input.workspaceId, input.id);
    if (!run) {
      throw new Error(`Cancelled agent runtime run not found: ${input.id}`);
    }
    return run;
  }

  private async requestRunningStandaloneCancellation(
    input: {
      workspaceId: string;
      actorId: string;
      id: string;
      reason?: string | null;
    },
    existing: CopilotAgentRunRecord
  ) {
    if (!existing.workerLeaseId || !existing.workerLeaseExpiresAt) {
      throw new Error(
        'Agent runtime run cannot request running cancellation without an active worker lease'
      );
    }

    const now = nextAgentRuntimeTransitionTimestamp(existing);
    const reason = normalizeControlReason(input.reason);
    const event = controlledRunTimeline({
      action: 'cancel_requested',
      actorId: input.actorId,
      reason,
      run: existing,
      startedAt: now,
    });
    event.payload = {
      ...event.payload,
      workerAttempt: existing.workerAttempt,
      workerLeaseId: existing.workerLeaseId,
      workerLeaseExpiresAt: existing.workerLeaseExpiresAt.toISOString(),
    };
    const timelineFingerprint = timelineFingerprintWithEvents(existing, [
      event,
    ]);

    const rows = await this.db.$queryRaw<Array<{ id: string }>>`
      UPDATE ai_agent_runs
      SET
        timeline_fingerprint = ${timelineFingerprint},
        updated_at = ${now}
      WHERE workspace_id = ${input.workspaceId}
        AND id = ${input.id}
        AND actor_id = ${existing.actorId}
        AND source_type <> ${'repair_execution_request'}
        AND source_type = ${existing.sourceType}
        AND source_id = ${existing.sourceId}
        AND workflow = ${existing.workflow}
        AND status = ${'running'}
        AND title IS NOT DISTINCT FROM ${existing.title}
        AND target_fingerprint = ${existing.targetFingerprint}
        AND evidence_fingerprint = ${existing.evidenceFingerprint}
        AND timeline_fingerprint = ${existing.timelineFingerprint}
        AND started_at IS NOT DISTINCT FROM ${existing.startedAt}
        AND completed_at IS NOT DISTINCT FROM ${existing.completedAt}
        AND failure_code IS NOT DISTINCT FROM ${existing.failureCode}
        AND failure_message IS NOT DISTINCT FROM ${existing.failureMessage}
        AND queued_at IS NOT DISTINCT FROM ${existing.queuedAt}
        AND worker_lease_id = ${existing.workerLeaseId}
        AND worker_lease_expires_at IS NOT DISTINCT FROM ${
          existing.workerLeaseExpiresAt
        }
        AND worker_attempt = ${existing.workerAttempt}
        AND worker_max_attempts = ${existing.workerMaxAttempts}
        AND last_attempt_at IS NOT DISTINCT FROM ${existing.lastAttemptAt}
        AND created_at = ${existing.createdAt}
        AND updated_at IS NOT DISTINCT FROM ${existing.updatedAt}
      RETURNING id
    `;
    if (!rows.length) {
      throw new Error(
        `Agent runtime run could not request cancellation because its state changed: ${input.id}`
      );
    }

    await this.insertTimelineEvent({
      actorId: input.actorId,
      event,
      runId: existing.id,
      workspaceId: input.workspaceId,
      createdAt: now,
    });

    const run = await this.get(input.workspaceId, input.id);
    if (!run) {
      throw new Error(
        `Cancellation-requested agent runtime run not found: ${input.id}`
      );
    }
    return run;
  }

  private async resumeStandaloneRun(
    input: {
      workspaceId: string;
      actorId: string;
      id: string;
      action: CopilotAgentRuntimeControlAction;
      reason?: string | null;
    },
    existing: CopilotAgentRunRecord
  ) {
    if (
      existing.status === 'cancelled' &&
      latestAgentRuntimeControlAction(existing) === 'abandon'
    ) {
      throw new Error('Agent runtime abandoned run cannot be resumed');
    }
    if (existing.status !== 'failed' && existing.status !== 'cancelled') {
      throw new Error(
        `Agent runtime run cannot be resumed from status: ${existing.status}`
      );
    }

    if (existing.sourceType === 'mcp_ai_delegation') {
      await this.models.copilotMcpDelegation.resumeExecutionRequest({
        requestId: existing.sourceId,
        runId: existing.id,
        actorId: input.actorId,
        workspaceId: existing.workspaceId,
        sessionId: existing.sessionId ?? null,
      });
    }

    const now = nextAgentRuntimeTransitionTimestamp(existing);
    const workerMaxAttempts =
      existing.workerAttempt >= existing.workerMaxAttempts
        ? existing.workerAttempt + 1
        : existing.workerMaxAttempts;
    const reason = normalizeControlReason(input.reason);
    const event = controlledRunTimeline({
      action: 'resume',
      actorId: input.actorId,
      reason,
      run: existing,
      startedAt: now,
    });
    const resumableStepEvents = existing.steps.map((step, index) => {
      const nextStatus =
        step.status === 'completed'
          ? 'completed'
          : isActiveStepStatus(step.status)
            ? step.status
            : 'pending';
      return controlledStepTimeline({
        action: 'resume',
        actorId: input.actorId,
        ordinal: event.ordinal + index + 1,
        reason,
        run: existing,
        startedAt: now,
        status: nextStatus,
        step,
      });
    });
    const events = [event, ...resumableStepEvents];
    const timelineFingerprint = timelineFingerprintWithEvents(existing, events);

    const resumedRows = await this.db.$queryRaw<Array<{ id: string }>>`
      UPDATE ai_agent_runs
      SET
        status = ${'queued'},
        timeline_fingerprint = ${timelineFingerprint},
        completed_at = ${null},
        failure_code = ${null},
        failure_message = ${null},
        queued_at = ${now},
        worker_lease_id = ${null},
        worker_lease_expires_at = ${null},
        worker_max_attempts = ${workerMaxAttempts},
        updated_at = ${now}
      WHERE workspace_id = ${input.workspaceId}
        AND id = ${input.id}
        AND actor_id = ${existing.actorId}
        AND source_type <> ${'repair_execution_request'}
        AND source_type = ${existing.sourceType}
        AND source_id = ${existing.sourceId}
        AND workflow = ${existing.workflow}
        AND status = ${existing.status}
        AND title IS NOT DISTINCT FROM ${existing.title}
        AND target_fingerprint = ${existing.targetFingerprint}
        AND evidence_fingerprint = ${existing.evidenceFingerprint}
        AND timeline_fingerprint = ${existing.timelineFingerprint}
        AND started_at IS NOT DISTINCT FROM ${existing.startedAt}
        AND completed_at IS NOT DISTINCT FROM ${existing.completedAt}
        AND failure_code IS NOT DISTINCT FROM ${existing.failureCode}
        AND failure_message IS NOT DISTINCT FROM ${existing.failureMessage}
        AND queued_at IS NOT DISTINCT FROM ${existing.queuedAt}
        AND worker_lease_id IS NOT DISTINCT FROM ${existing.workerLeaseId}
        AND worker_lease_expires_at IS NOT DISTINCT FROM ${
          existing.workerLeaseExpiresAt
        }
        AND worker_attempt = ${existing.workerAttempt}
        AND worker_max_attempts = ${existing.workerMaxAttempts}
        AND last_attempt_at IS NOT DISTINCT FROM ${existing.lastAttemptAt}
        AND created_at = ${existing.createdAt}
        AND updated_at IS NOT DISTINCT FROM ${existing.updatedAt}
      RETURNING id
    `;
    if (!resumedRows.length) {
      throw new Error(
        `Agent runtime run could not be resumed because its state changed: ${input.id}`
      );
    }

    for (const step of existing.steps) {
      const nextStatus =
        step.status === 'completed'
          ? 'completed'
          : isActiveStepStatus(step.status)
            ? step.status
            : 'pending';
      const updatedRows = await this.db.$queryRaw<Array<{ id: string }>>`
        UPDATE ai_agent_steps
        SET
          status = ${nextStatus},
          completed_at = ${nextStatus === 'completed' ? step.completedAt : null},
          output_summary = (
            CASE
              WHEN jsonb_typeof(output_summary) = ${'object'} THEN output_summary
              ELSE ${'{}'}::jsonb
            END
          ) || ${toJsonString({
            manualControl: {
              version: 'agent-runtime-manual-control/v1',
              action: 'resume',
              actorId: input.actorId,
              reason,
            },
          })}::jsonb,
          updated_at = ${now}
        WHERE workspace_id = ${input.workspaceId}
          AND run_id = ${input.id}
          AND id = ${step.id}
          AND actor_id = ${step.actorId}
          AND step_key = ${step.stepKey}
          AND step_type = ${step.stepType}
          AND status = ${step.status}
          AND title IS NOT DISTINCT FROM ${step.title}
          AND "order" = ${step.order}
          AND evidence_fingerprint = ${step.evidenceFingerprint}
          AND started_at IS NOT DISTINCT FROM ${step.startedAt}
          AND completed_at IS NOT DISTINCT FROM ${step.completedAt}
          AND output_summary IS NOT DISTINCT FROM ${toJsonString(
            step.outputSummary
          )}::jsonb
          AND created_at = ${step.createdAt}
          AND updated_at IS NOT DISTINCT FROM ${step.updatedAt}
        RETURNING id
      `;
      if (!updatedRows.length) {
        throw new Error(
          `Agent runtime step could not be resumed because its state changed: ${step.id}`
        );
      }
    }

    for (const event of events) {
      await this.insertTimelineEvent({
        actorId: input.actorId,
        event,
        runId: existing.id,
        workspaceId: input.workspaceId,
        createdAt: now,
      });
    }

    const run = await this.get(input.workspaceId, input.id);
    if (!run) {
      throw new Error(`Resumed agent runtime run not found: ${input.id}`);
    }
    return run;
  }

  private async insertTimelineEvent(input: {
    actorId: string;
    event: AgentRuntimeTimelineEventInput;
    runId: string;
    workspaceId: string;
    createdAt: Date;
  }) {
    const eventId = randomUUID();
    const status = normalizeTimelineStatus(input.event.status);
    const eventFingerprint = agentRuntimeFingerprint({
      version: 'agent-runtime-timeline-event/v1',
      runId: input.runId,
      stepId: input.event.stepId,
      eventType: input.event.eventType,
      status,
      ordinal: input.event.ordinal,
      summary: input.event.summary,
      payload: input.event.payload,
    });

    await this.db.$executeRaw`
      INSERT INTO ai_agent_timeline_events (
        id,
        run_id,
        step_id,
        workspace_id,
        actor_id,
        event_type,
        status,
        ordinal,
        summary,
        payload,
        event_fingerprint,
        created_at
      )
      VALUES (
        ${eventId},
        ${input.runId},
        ${input.event.stepId},
        ${input.workspaceId},
        ${input.actorId},
        ${input.event.eventType},
        ${status},
        ${input.event.ordinal},
        ${input.event.summary},
        ${toJsonString(input.event.payload)}::jsonb,
        ${eventFingerprint},
        ${input.createdAt}
      )
    `;
  }
}
