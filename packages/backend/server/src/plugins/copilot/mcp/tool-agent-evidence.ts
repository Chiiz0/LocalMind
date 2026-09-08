import type { AiMcpDelegationToolCall } from '@prisma/client';

import { mcpDelegationFingerprint } from '../../../models/copilot-mcp-delegation';
import type { StreamObject } from '../providers/types';
import {
  WORKSPACE_EFFECT_OPERATIONS,
  type WorkspaceEffectOperation,
} from '../tools/workspace-organization';

const WRITE_TOOL_NAMES = new Set([
  'doc_create',
  'doc_update',
  'doc_update_meta',
  'workspace_folder_create',
  'workspace_folder_rename',
  'workspace_folder_move',
  'workspace_folder_delete',
  'workspace_folder_trash',
  'workspace_folder_restore',
  'workspace_folder_delete_permanently',
  'workspace_folder_add_document',
  'workspace_folder_move_document',
  'office_command_request',
  'office_command_batch_request',
  'doc_trash',
  'doc_restore',
  'doc_delete_permanently',
]);

export type ToolExecutionSummary = {
  workspaceId?: string;
  toolCallId?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  toolName: string;
  status: 'completed' | 'failed';
  argsFingerprint: string;
  sideEffectApplied?: boolean;
  documentId?: string;
  relation?: 'created' | 'updated';
  versionFingerprint?: string;
  documentIds?: string[];
  workspaceEffect?: {
    kind: 'workspace_organization';
    operation: WorkspaceEffectOperation;
    folderId?: string | null;
  };
  enterpriseEffect?: {
    connectionId: string;
    provider: string;
    toolName: string;
    risk: 'read' | 'write' | 'high';
  };
  sparkClawEffect?: {
    toolName: string;
    risk: 'read' | 'write' | 'high';
    idempotentReplay: boolean;
  };
};

export type DocumentArtifact = {
  workspaceId?: string;
  kind: 'document';
  relation: 'created' | 'updated';
  documentId: string;
  versionFingerprint: string;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nonBlankString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function referencedDocumentIds(
  event: Extract<StreamObject, { type: 'tool-result' }>
) {
  const ids = new Set<string>();
  const add = (value: unknown) => {
    const id = nonBlankString(value);
    if (id && ids.size < 20) ids.add(id);
  };
  const addRecord = (value: unknown) => {
    const record = objectValue(value);
    add(record.docId);
    add(record.doc_id);
    add(record.documentId);
  };

  addRecord(event.args);
  addRecord(event.result);
  if (Array.isArray(event.result)) {
    event.result.forEach(addRecord);
  } else {
    const result = objectValue(event.result);
    addRecord(result.conditionalNoop);
    if (Array.isArray(result.results)) result.results.forEach(addRecord);
    if (Array.isArray(result.documents)) result.documents.forEach(addRecord);
  }
  return [...ids];
}

export function toolExecutionSummary(
  event: Extract<StreamObject, { type: 'tool-result' }>
) {
  const result = objectValue(event.result);
  const failed =
    event.isError === true ||
    !!event.argumentParseError ||
    result.type === 'error' ||
    result.success === false;
  const documentIds = referencedDocumentIds(event);
  const documentId = documentIds[0];
  const creationConfirmed =
    !failed &&
    !!nonBlankString(result.docId ?? result.documentId) &&
    (result.documentCreated === true ||
      (result.documentCreated === undefined && result.success === true));
  const relation =
    creationConfirmed && event.toolName === 'doc_create'
      ? ('created' as const)
      : !failed &&
          (event.toolName === 'doc_update' ||
            event.toolName === 'doc_update_meta')
        ? ('updated' as const)
        : undefined;
  const versionFingerprint = mcpDelegationFingerprint({
    version: 'localmind-tool-agent-tool-arguments/v1',
    toolName: event.toolName,
    args: event.args,
  });
  const rawWorkspaceEffect = objectValue(result.workspaceEffect);
  const workspaceEffectOperations = new Set<string>(
    WORKSPACE_EFFECT_OPERATIONS
  );
  const workspaceEffectOperation = nonBlankString(rawWorkspaceEffect.operation);
  const workspaceEffectFolderId = nonBlankString(rawWorkspaceEffect.folderId);
  const workspaceEffect =
    !failed &&
    rawWorkspaceEffect.kind === 'workspace_organization' &&
    workspaceEffectOperation &&
    workspaceEffectOperations.has(workspaceEffectOperation)
      ? {
          kind: 'workspace_organization' as const,
          operation: workspaceEffectOperation as NonNullable<
            ToolExecutionSummary['workspaceEffect']
          >['operation'],
          ...(rawWorkspaceEffect.folderId === null
            ? { folderId: null }
            : workspaceEffectFolderId
              ? { folderId: workspaceEffectFolderId }
              : {}),
        }
      : undefined;
  const rawEnterpriseEffect = objectValue(result.enterpriseEffect);
  const enterpriseConnectionId = nonBlankString(
    rawEnterpriseEffect.connectionId
  );
  const enterpriseProvider = nonBlankString(rawEnterpriseEffect.provider);
  const enterpriseToolName = nonBlankString(rawEnterpriseEffect.toolName);
  const enterpriseRisk = nonBlankString(rawEnterpriseEffect.risk);
  const enterpriseEffect =
    !failed &&
    event.toolName === 'enterprise_cli_execute' &&
    enterpriseConnectionId &&
    enterpriseProvider &&
    enterpriseToolName &&
    enterpriseRisk &&
    new Set(['read', 'write', 'high']).has(enterpriseRisk)
      ? {
          connectionId: enterpriseConnectionId,
          provider: enterpriseProvider,
          toolName: enterpriseToolName,
          risk: enterpriseRisk as 'read' | 'write' | 'high',
        }
      : undefined;
  const localSideEffectApplied =
    !failed && WRITE_TOOL_NAMES.has(event.toolName)
      ? (event.toolName !== 'doc_create' || creationConfirmed) &&
        result.idempotentReplay !== true &&
        result.changed !== false
      : undefined;
  const enterpriseSideEffectApplied =
    enterpriseEffect?.risk === 'write' || enterpriseEffect?.risk === 'high'
      ? rawEnterpriseEffect.sideEffectApplied === true
      : undefined;
  const rawSparkClawEffect = objectValue(result.sparkClawEffect);
  const sparkClawToolName = nonBlankString(rawSparkClawEffect.toolName);
  const sparkClawRisk = nonBlankString(rawSparkClawEffect.risk);
  const sparkClawEffect =
    !failed &&
    event.toolName === 'sparkclaw_mcp_execute' &&
    sparkClawToolName &&
    sparkClawRisk &&
    new Set(['read', 'write', 'high']).has(sparkClawRisk)
      ? {
          toolName: sparkClawToolName,
          risk: sparkClawRisk as 'read' | 'write' | 'high',
          idempotentReplay: rawSparkClawEffect.idempotentReplay === true,
        }
      : undefined;
  const sparkClawSideEffectApplied =
    sparkClawEffect?.risk === 'write' || sparkClawEffect?.risk === 'high'
      ? rawSparkClawEffect.sideEffectApplied === true
      : undefined;
  const sideEffectApplied =
    localSideEffectApplied ??
    enterpriseSideEffectApplied ??
    sparkClawSideEffectApplied;
  return {
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    status: failed ? ('failed' as const) : ('completed' as const),
    argsFingerprint: versionFingerprint,
    ...(documentId ? { documentId } : {}),
    ...(documentIds.length ? { documentIds } : {}),
    ...(relation ? { relation, versionFingerprint } : {}),
    ...(sideEffectApplied !== undefined ? { sideEffectApplied } : {}),
    ...(workspaceEffect ? { workspaceEffect } : {}),
    ...(enterpriseEffect ? { enterpriseEffect } : {}),
    ...(sparkClawEffect ? { sparkClawEffect } : {}),
  };
}

export function documentArtifacts(executions: ToolExecutionSummary[]) {
  const artifacts = new Map<string, DocumentArtifact>();
  for (const execution of executions) {
    if (
      execution.status !== 'completed' ||
      !execution.documentId ||
      !execution.relation ||
      !execution.versionFingerprint
    ) {
      continue;
    }
    artifacts.set(
      `${execution.workspaceId ?? ''}:${execution.relation}:${execution.documentId}`,
      {
        ...(execution.workspaceId
          ? { workspaceId: execution.workspaceId }
          : {}),
        kind: 'document',
        relation: execution.relation,
        documentId: execution.documentId,
        versionFingerprint: execution.versionFingerprint,
      }
    );
  }
  return [...artifacts.values()];
}

// Raw checkpoints stay internal. Only this bounded projection may leave the worker.
export function toolAgentCheckpointReceipts(
  calls: AiMcpDelegationToolCall[],
  workspaceId: string
) {
  const toolExecutions: ToolExecutionSummary[] = [];
  const pendingToolCalls = [];
  for (const call of calls.slice(0, 20)) {
    const result = objectValue(call.result).value;
    const event: Extract<StreamObject, { type: 'tool-result' }> = {
      type: 'tool-result',
      toolCallId: call.callId,
      toolName: call.toolName,
      args: objectValue(call.args),
      result,
    };
    const summary = toolExecutionSummary(event);
    if (!call.completedAt) {
      pendingToolCalls.push({
        toolCallId: call.callId,
        toolName: call.toolName,
        status: 'unconfirmed',
        startedAt: call.createdAt.toISOString(),
        argsFingerprint: summary.argsFingerprint,
        documentIds: summary.documentIds ?? [],
        workspaceId,
      });
      continue;
    }
    toolExecutions.push({
      ...summary,
      workspaceId:
        nonBlankString(objectValue(result).workspaceId) ?? workspaceId,
      startedAt: call.createdAt.toISOString(),
      completedAt: call.completedAt.toISOString(),
      durationMs: Math.max(
        0,
        call.completedAt.getTime() - call.createdAt.getTime()
      ),
    });
  }
  return { toolExecutions, pendingToolCalls };
}

export function toolAgentCheckpointEvidence(
  calls: AiMcpDelegationToolCall[],
  workspaceId: string,
  previous: Record<string, unknown> = {}
) {
  const { toolExecutions, pendingToolCalls } = toolAgentCheckpointReceipts(
    calls,
    workspaceId
  );
  // A location-confirmed creation can have a newer receipt than its original
  // immutable tool checkpoint, which only recorded the location request.
  const executions = new Map<string, Record<string, unknown>>();
  if (Array.isArray(previous.toolExecutions)) {
    for (const value of previous.toolExecutions.slice(0, 20)) {
      const execution = objectValue(value);
      const id = nonBlankString(execution.toolCallId);
      if (id) executions.set(id, execution);
    }
  }
  for (const execution of toolExecutions) {
    const callId = execution.toolCallId;
    if (!callId) continue;
    const prior = executions.get(callId);
    executions.set(
      callId,
      prior?.relation === 'created' ? { ...execution, ...prior } : execution
    );
  }
  const artifacts = new Map<string, Record<string, unknown>>();
  const allArtifacts = [
    ...documentArtifacts(toolExecutions),
    ...(Array.isArray(previous.artifacts)
      ? previous.artifacts.slice(0, 20)
      : []),
  ];
  for (const value of allArtifacts) {
    const artifact = objectValue(value);
    artifacts.set(
      `${artifact.workspaceId ?? workspaceId}:${artifact.relation}:${artifact.documentId}`,
      artifact
    );
  }
  return {
    toolExecutions: [...executions.values()].slice(0, 20),
    artifacts: [...artifacts.values()].slice(0, 20),
    pendingToolCalls,
  };
}
