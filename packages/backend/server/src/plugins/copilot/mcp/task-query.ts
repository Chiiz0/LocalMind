import { Injectable } from '@nestjs/common';
import type { AiMcpDelegationRequest, McpCredential } from '@prisma/client';
import { z } from 'zod';

import { PermissionAccess } from '../../../core/permission';
import { Models } from '../../../models';
import type { CopilotAgentRunRecord } from '../../../models/copilot-agent-runtime';
import { mcpDelegationFingerprint } from '../../../models/copilot-mcp-delegation';
import { WORKSPACE_EFFECT_OPERATIONS } from '../tools/workspace-organization';
import {
  McpAttachmentReferenceError,
  McpAttachmentService,
} from './attachments';
import {
  MCP_TASK_CONTROL_CAPABILITY,
  MCP_TASK_QUERY_CAPABILITY,
} from './capabilities';
import {
  defineTool,
  READ_ONLY_TOOL,
  RESULT_OUTPUT_SCHEMA,
  toolResult,
  type WorkspaceMcpToolDefinition,
} from './types';

const TASK_WAIT_MAX_MS = 30_000;
const TASK_POLL_INTERVAL_MS = 1_000;
const TASK_POLL_AFTER_MS = 3_000;

export const LocalMindTaskPlanSchema = z
  .object({
    version: z.literal('localmind-task-plan/v1'),
    kind: z.enum([
      'answer',
      'document_update',
      'tool_agent',
      'unsupported_task',
    ]),
    summary: z.string().trim().min(1).max(1_000),
    steps: z
      .array(
        z
          .object({
            key: z.string().trim().min(1).max(128),
            type: z.enum([
              'model',
              'tool',
              'approval',
              'handoff',
              'codex',
              'mcp',
            ]),
            summary: z.string().trim().min(1).max(1_000),
          })
          .strict()
      )
      .min(1)
      .max(100),
    target: z
      .object({
        kind: z.literal('document'),
        documentId: z.string().trim().min(1).max(256),
        contentFingerprint: z.string().trim().min(8).max(128),
      })
      .strict()
      .optional(),
  })
  .strict();

export type LocalMindTaskPlan = z.infer<typeof LocalMindTaskPlanSchema>;

const GetLocalMindTaskInput = z
  .object({
    taskId: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .describe(
        'The taskId returned by delegate_to_localmind. This is not a document ID.'
      ),
    knownStateVersion: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .optional()
      .describe(
        'The stateVersion from the previous get_localmind_task result. Omit for the first read.'
      ),
    waitMs: z
      .number()
      .int()
      .min(0)
      .max(TASK_WAIT_MAX_MS)
      .default(0)
      .describe(
        'How long to wait for a change when knownStateVersion still matches, from 0 to 30000 milliseconds. Use 0 for an immediate read.'
      ),
  })
  .strict()
  .describe('Check one task previously started by delegate_to_localmind.');

type TaskQueryCredential = Pick<
  McpCredential,
  'familyId' | 'userId' | 'workspaceId'
>;

type TaskStateMarker = {
  locationOperation?: {
    id: string;
    status: string;
    destinationRevision: number;
    locationExpiresAt: Date;
  } | null;
  id: string;
  status: string;
  updatedAt: Date;
  planFingerprint: string | null;
  approvalDecision: string | null;
  approvalExpiresAt: Date | null;
  approvalResolvedAt: Date | null;
  agentRun: {
    id: string;
    status: string;
    timelineFingerprint: string;
    updatedAt: Date;
  } | null;
};

type PublicTaskStatus =
  | 'waiting_for_location'
  | 'planning'
  | 'waiting_approval'
  | 'queued'
  | 'running'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'cancelled';

type TaskAccessResult =
  | { record: AiMcpDelegationRequest }
  | { error: Record<string, unknown> };

type ProjectedTaskView = {
  view: Record<string, unknown>;
  stateVersion: string;
};

type TaskViewResult = ProjectedTaskView | { error: Record<string, unknown> };

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stateVersion(marker: TaskStateMarker, now = Date.now()) {
  return `sha256:${mcpDelegationFingerprint({
    version: 'localmind-task-state/v1',
    requestId: marker.id,
    requestStatus: marker.status,
    requestUpdatedAt: marker.updatedAt.toISOString(),
    location: marker.locationOperation
      ? {
          id: marker.locationOperation.id,
          status: marker.locationOperation.status,
          revision: marker.locationOperation.destinationRevision,
          expiresAt: marker.locationOperation.locationExpiresAt.toISOString(),
          expired: marker.locationOperation.locationExpiresAt.getTime() <= now,
        }
      : null,
    planFingerprint: marker.planFingerprint,
    approvalDecision: marker.approvalDecision,
    approvalExpired:
      marker.approvalDecision === null &&
      marker.approvalExpiresAt !== null &&
      marker.approvalExpiresAt.getTime() <= now,
    approvalResolvedAt: marker.approvalResolvedAt?.toISOString() ?? null,
    agentRun: marker.agentRun
      ? {
          id: marker.agentRun.id,
          status: marker.agentRun.status,
          timelineFingerprint: marker.agentRun.timelineFingerprint,
          updatedAt: marker.agentRun.updatedAt.toISOString(),
        }
      : null,
  })}`;
}

@Injectable()
export class McpAiTaskQueryService {
  constructor(
    private readonly ac: PermissionAccess,
    private readonly attachments: McpAttachmentService,
    private readonly models: Models
  ) {}

  createTool(credential: TaskQueryCredential): WorkspaceMcpToolDefinition {
    return defineTool({
      name: 'get_localmind_task',
      title: 'Check a LocalMind Task',
      description:
        "Use ONLY when the user asks for the status, progress, or final result of an existing task whose taskId was returned by delegate_to_localmind. Read that task's sanitized plan, steps, final result, errors, and artifact references. This read-only tool never starts, executes, retries, or cancels work and does not accept a natural-language task. Never create or guess a taskId. If terminal is false, wait for pollAfterMs and call this tool again, or use knownStateVersion with waitMs for a bounded long poll. Follow-ups that request additional work, revisions, continuations, or retries must use delegate_to_localmind instead.",
      parser: GetLocalMindTaskInput,
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL,
      execute: async (args, { signal }) =>
        toolResult(await this.getTask(credential, args, signal)),
    });
  }

  async getTask(
    credential: TaskQueryCredential,
    input: z.infer<typeof GetLocalMindTaskInput>,
    signal: AbortSignal
  ) {
    let projected = await this.projectTask(credential, input.taskId);
    if ('error' in projected) return projected.error;

    if (
      !input.knownStateVersion ||
      input.knownStateVersion !== projected.stateVersion ||
      input.waitMs === 0
    ) {
      return this.withChanged(
        projected,
        input.knownStateVersion !== projected.stateVersion
      );
    }

    const deadline = Date.now() + input.waitMs;
    while (!signal.aborted && Date.now() < deadline) {
      const remainingMs = deadline - Date.now();
      await this.wait(
        Math.min(TASK_POLL_INTERVAL_MS, Math.max(remainingMs, 0)),
        signal
      );
      if (signal.aborted) break;

      const marker =
        await this.models.copilotMcpDelegation.getRequestStateMarker({
          id: input.taskId,
          workspaceId: credential.workspaceId,
          actorId: credential.userId,
          credentialFamilyId: credential.familyId,
        });
      if (!marker) return { code: 'task_not_found' };
      if (stateVersion(marker) !== projected.stateVersion) {
        projected = await this.projectTask(credential, input.taskId);
        if ('error' in projected) return projected.error;
        return this.withChanged(projected, true);
      }
    }

    projected = await this.projectTask(credential, input.taskId);
    if ('error' in projected) return projected.error;
    return this.withChanged(
      projected,
      input.knownStateVersion !== projected.stateVersion
    );
  }

  private async projectTask(
    credential: TaskQueryCredential,
    taskId: string
  ): Promise<TaskViewResult> {
    const access = await this.loadAuthorizedTask(credential, taskId);
    if ('error' in access) return access;
    const record = access.record;
    const run = record.agentRunId
      ? await this.models.copilotAgentRuntime.get(
          record.workspaceId,
          record.agentRunId
        )
      : null;
    if (
      record.agentRunId &&
      (!run ||
        run.workspaceId !== record.workspaceId ||
        run.actorId !== record.actorId ||
        run.sourceType !== 'mcp_ai_delegation' ||
        run.sourceId !== record.id)
    ) {
      return { error: { code: 'task_state_invalid' } };
    }
    const marker: TaskStateMarker = {
      locationOperation: record.locationOperationId
        ? await this.models.copilotDocumentOperation.get({
            actorId: record.actorId,
            operationId: record.locationOperationId,
          })
        : null,
      id: record.id,
      status: record.status,
      updatedAt: record.updatedAt,
      planFingerprint: record.planFingerprint,
      approvalDecision: record.approvalDecision,
      approvalExpiresAt: record.approvalExpiresAt,
      approvalResolvedAt: record.approvalResolvedAt,
      agentRun: run
        ? {
            id: run.id,
            status: run.status,
            timelineFingerprint: run.timelineFingerprint,
            updatedAt: run.updatedAt,
          }
        : null,
    };
    const version = stateVersion(marker);
    const planResult = LocalMindTaskPlanSchema.safeParse(record.planSnapshot);
    if (
      record.planFingerprint &&
      (!planResult.success ||
        mcpDelegationFingerprint(planResult.data) !== record.planFingerprint)
    ) {
      return { error: { code: 'task_state_invalid' } };
    }
    const plan = planResult.success ? planResult.data : null;
    const status = this.publicStatus(record, run);
    const terminal = ['completed', 'failed', 'rejected', 'cancelled'].includes(
      status
    );
    const updatedAt =
      run && run.updatedAt > record.updatedAt
        ? run.updatedAt
        : record.updatedAt;

    return {
      stateVersion: version,
      view: {
        protocolVersion: 'localmind.task.v1',
        taskId: record.id,
        stateVersion: version,
        status,
        terminal,
        phase: this.phase(status),
        createdAt: record.createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        pollAfterMs: terminal ? null : TASK_POLL_AFTER_MS,
        plan,
        steps: this.steps(run, plan),
        approval: this.approval(record, plan, status),
        location:
          status === 'waiting_for_location' && record.locationOperationId
            ? {
                operationId: record.locationOperationId,
                confirmationChannel: 'authenticated_user',
                status:
                  marker.locationOperation &&
                  marker.locationOperation.locationExpiresAt <= new Date()
                    ? 'expired'
                    : marker.locationOperation?.status,
                revision: marker.locationOperation?.destinationRevision,
                expiresAt:
                  marker.locationOperation?.locationExpiresAt.toISOString(),
              }
            : null,
        result: this.result(record, run, status, plan),
        error: this.error(record, status),
        artifacts: this.artifacts(record, status, plan),
        availableControls: this.availableControls(record, run, status),
      },
    };
  }

  private async loadAuthorizedTask(
    credential: TaskQueryCredential,
    taskId: string
  ): Promise<TaskAccessResult> {
    const record =
      await this.models.copilotMcpDelegation.getRequestForCredentialFamily({
        id: taskId,
        workspaceId: credential.workspaceId,
        actorId: credential.userId,
        credentialFamilyId: credential.familyId,
      });
    if (!record) return { error: { code: 'task_not_found' } };

    const activeCredential =
      await this.models.mcpCredential.findUsableFamilyCredential(
        record.credentialFamilyId,
        record.actorId,
        record.workspaceId
      );
    if (!activeCredential) {
      return { error: { code: 'credential_inactive' } };
    }
    if (!record.capabilitySnapshot.includes(MCP_TASK_QUERY_CAPABILITY)) {
      return {
        error: {
          code: 'credential_scope_denied',
          requiredCapabilities: [MCP_TASK_QUERY_CAPABILITY],
        },
      };
    }
    const workspaceAllowed = await this.ac
      .user(record.actorId)
      .workspace(record.workspaceId)
      .allowLocal()
      .can('Workspace.Copilot');
    if (!workspaceAllowed) {
      return {
        error: {
          code: 'permission_denied',
          missingPermission: 'Workspace.Copilot',
        },
      };
    }

    const persistedResult =
      record.result &&
      typeof record.result === 'object' &&
      !Array.isArray(record.result)
        ? (record.result as Record<string, unknown>)
        : {};
    const attachmentsWereExpectedToPersist =
      !['credential_scope_denied', 'permission_denied'].includes(
        record.status
      ) &&
      stringValue(persistedResult.code) !== 'attachment_persistence_failed';
    if (attachmentsWereExpectedToPersist) {
      try {
        await this.attachments.authorizeReferences({
          workspaceId: record.workspaceId,
          actorId: record.actorId,
          credentialFamilyId: record.credentialFamilyId,
          attachmentIds: record.requestedAttachmentIds,
        });
      } catch (error) {
        if (error instanceof McpAttachmentReferenceError) {
          return { error: error.result };
        }
        return { error: { code: 'resource_not_accessible' } };
      }
    }

    const documentAccess = await Promise.all(
      this.referencedDocuments(record).map(
        async ({ workspaceId, documentId }) => ({
          documentId,
          allowed: await this.ac
            .user(record.actorId)
            .doc({ workspaceId, docId: documentId })
            .allowLocal()
            .can('Doc.Read'),
        })
      )
    );
    const deniedDocument = documentAccess.find(item => !item.allowed);
    if (deniedDocument) {
      return {
        error: {
          code: 'permission_denied',
          missingPermission: 'Doc.Read',
          documentId: deniedDocument.documentId,
        },
      };
    }
    return { record };
  }

  private referencedDocuments(record: AiMcpDelegationRequest) {
    const ids = new Map<string, { workspaceId: string; documentId: string }>();
    const result = objectValue(record.result);
    const add = (value: unknown, workspaceId = record.workspaceId) => {
      const documentId = stringValue(value);
      if (documentId)
        ids.set(`${workspaceId}:${documentId}`, { workspaceId, documentId });
    };
    record.requestedDocumentIds.forEach(id => add(id));
    add(record.targetDocumentId);
    add(result.documentId);
    if (Array.isArray(result.toolExecutions)) {
      result.toolExecutions.slice(0, 20).forEach(value => {
        const execution = objectValue(value);
        const workspaceId =
          stringValue(execution.workspaceId) ?? record.workspaceId;
        add(execution.documentId, workspaceId);
        if (Array.isArray(execution.documentIds)) {
          execution.documentIds
            .slice(0, 20)
            .forEach(id => add(id, workspaceId));
        }
      });
    }
    if (Array.isArray(result.artifacts)) {
      result.artifacts.slice(0, 20).forEach(value => {
        const artifact = objectValue(value);
        add(
          artifact.documentId,
          stringValue(artifact.workspaceId) ?? record.workspaceId
        );
      });
    }
    return [...ids.values()];
  }

  private publicStatus(
    record: AiMcpDelegationRequest,
    run: CopilotAgentRunRecord | null
  ): PublicTaskStatus {
    if (
      record.status === 'waiting_approval' &&
      !record.approvalDecision &&
      record.approvalExpiresAt &&
      record.approvalExpiresAt.getTime() <= Date.now()
    ) {
      return 'failed';
    }
    if (record.status === 'completed') return 'completed';
    if (record.status === 'rejected') return 'rejected';
    if (record.status === 'cancelled') return 'cancelled';
    if (this.isFailureStatus(record.status)) return 'failed';
    if (run) {
      if (this.cancellationRequested(run)) return 'cancelling';
      // Keep the public task status stable while an internal edit lease is pending.
      return run.status === 'waiting_lease' ? 'queued' : run.status;
    }
    return record.status === 'waiting_approval'
      ? 'waiting_approval'
      : 'planning';
  }

  private isFailureStatus(status: string) {
    return [
      'unsupported_task',
      'credential_scope_denied',
      'permission_denied',
      'resource_not_accessible',
      'failed',
    ].includes(status);
  }

  private phase(status: PublicTaskStatus) {
    if (status === 'planning') return 'planning';
    if (status === 'waiting_approval') return 'approval';
    if (status === 'waiting_for_location') return 'location';
    if (status === 'queued') return 'queue';
    if (status === 'running' || status === 'cancelling') return 'execution';
    return 'terminal';
  }

  private steps(
    run: CopilotAgentRunRecord | null,
    plan: LocalMindTaskPlan | null
  ) {
    if (!run) return [];
    const planSteps = new Map(
      plan?.steps.map(step => [step.key, step.summary]) ?? []
    );
    return run.steps.map(step => ({
      key: step.stepKey,
      type: step.stepType,
      status: step.status,
      summary:
        planSteps.get(step.stepKey) ?? step.title ?? 'LocalMind task step',
      startedAt: step.startedAt?.toISOString() ?? null,
      completedAt: step.completedAt?.toISOString() ?? null,
    }));
  }

  private approval(
    record: AiMcpDelegationRequest,
    plan: LocalMindTaskPlan | null,
    taskStatus: PublicTaskStatus
  ) {
    if (!record.approvalId || !record.approvalExpiresAt) return null;
    const expired =
      !record.approvalDecision &&
      record.approvalExpiresAt.getTime() <= Date.now();
    return {
      id: record.approvalId,
      status:
        record.approvalDecision ??
        (taskStatus === 'cancelled'
          ? 'cancelled'
          : expired
            ? 'expired'
            : 'pending'),
      risk: 'reversible',
      summary: plan?.summary ?? 'LocalMind task approval',
      previewHash: record.approvalPreviewHash,
      expiresAt: record.approvalExpiresAt.toISOString(),
      resolvedAt:
        record.approvalResolvedAt?.toISOString() ??
        (taskStatus === 'cancelled' ? record.updatedAt.toISOString() : null),
      decisionChannel: 'service_callback',
      operation: plan?.target
        ? {
            kind: 'document_update',
            documentId: plan.target.documentId,
            contentFingerprint: plan.target.contentFingerprint,
          }
        : null,
    };
  }

  private result(
    record: AiMcpDelegationRequest,
    run: CopilotAgentRunRecord | null,
    status: PublicTaskStatus,
    plan: LocalMindTaskPlan | null
  ) {
    if (status !== 'completed') return null;
    const result = objectValue(record.result);
    if (result.kind === 'answer') {
      const answer = stringValue(result.answer);
      return answer ? { kind: 'answer', answer } : null;
    }
    if (result.kind === 'tool_agent' || plan?.kind === 'tool_agent') {
      const answer = stringValue(result.answer);
      const toolExecutions = Array.isArray(result.toolExecutions)
        ? result.toolExecutions.slice(0, 20).flatMap(value => {
            const execution = objectValue(value);
            const toolName = stringValue(execution.toolName);
            const executionStatus = stringValue(execution.status);
            const argsFingerprint = stringValue(execution.argsFingerprint);
            if (
              !toolName ||
              !['completed', 'failed'].includes(executionStatus ?? '') ||
              !argsFingerprint
            ) {
              return [];
            }
            const documentId = stringValue(execution.documentId);
            const documentIds = Array.isArray(execution.documentIds)
              ? execution.documentIds
                  .map(stringValue)
                  .filter((value): value is string => value !== null)
                  .slice(0, 20)
              : [];
            const relation = stringValue(execution.relation);
            const rawWorkspaceEffect = objectValue(execution.workspaceEffect);
            const workspaceOperation = stringValue(
              rawWorkspaceEffect.operation
            );
            const workspaceEffect =
              rawWorkspaceEffect.kind === 'workspace_organization' &&
              workspaceOperation &&
              (WORKSPACE_EFFECT_OPERATIONS as readonly string[]).includes(
                workspaceOperation
              )
                ? {
                    kind: 'workspace_organization',
                    operation: workspaceOperation,
                    ...(rawWorkspaceEffect.folderId === null
                      ? { folderId: null }
                      : stringValue(rawWorkspaceEffect.folderId)
                        ? {
                            folderId: stringValue(rawWorkspaceEffect.folderId),
                          }
                        : {}),
                  }
                : null;
            return [
              {
                toolName,
                status: executionStatus,
                argsFingerprint,
                ...(documentId ? { documentId } : {}),
                ...(stringValue(execution.workspaceId)
                  ? { workspaceId: stringValue(execution.workspaceId) }
                  : {}),
                ...(documentIds.length ? { documentIds } : {}),
                ...(relation && ['created', 'updated'].includes(relation)
                  ? { relation }
                  : {}),
                ...(workspaceEffect ? { workspaceEffect } : {}),
              },
            ];
          })
        : [];
      return {
        kind: 'tool_agent',
        summary: answer ?? 'LocalMind completed the delegated tool task.',
        toolExecutions,
      };
    }
    if (result.kind === 'document_update' || plan?.kind === 'document_update') {
      const documentId =
        stringValue(result.documentId) ?? plan?.target?.documentId ?? null;
      if (!documentId) return null;
      return {
        kind: 'document_update',
        summary: 'LocalMind completed the authorized document update.',
        documentId,
        contentFingerprint:
          stringValue(result.contentFingerprint) ??
          plan?.target?.contentFingerprint ??
          null,
        sideEffectFingerprint: stringValue(result.sideEffectFingerprint),
      };
    }
    const executionResult = run?.executionResults[0];
    return {
      kind: 'execution',
      summary: executionResult?.summary ?? 'LocalMind task completed.',
    };
  }

  private error(record: AiMcpDelegationRequest, status: PublicTaskStatus) {
    if (!['failed', 'rejected', 'cancelled'].includes(status)) return null;
    const result = objectValue(record.result);
    const approvalExpired =
      record.status === 'waiting_approval' &&
      !record.approvalDecision &&
      !!record.approvalExpiresAt &&
      record.approvalExpiresAt.getTime() <= Date.now();
    const code = approvalExpired
      ? 'approval_expired'
      : status === 'rejected'
        ? 'approval_rejected'
        : status === 'cancelled'
          ? 'task_cancelled'
          : this.safeFailureCode(stringValue(result.code));
    const details: Record<string, unknown> = {};
    const missingPermission = stringValue(result.missingPermission);
    const documentId = stringValue(result.documentId);
    const attachmentId = stringValue(result.attachmentId);
    const requiredToolName = stringValue(result.requiredToolName);
    const requiredToolNames = Array.isArray(result.requiredToolNames)
      ? result.requiredToolNames
          .map(stringValue)
          .filter((toolName): toolName is string => toolName !== null)
          .slice(0, 16)
      : [];
    if (missingPermission) details.missingPermission = missingPermission;
    if (documentId) details.documentId = documentId;
    if (attachmentId) details.attachmentId = attachmentId;
    if (requiredToolName) details.requiredToolName = requiredToolName;
    if (requiredToolNames.length) details.requiredToolNames = requiredToolNames;
    if (Array.isArray(result.requiredCapabilities)) {
      details.requiredCapabilities = result.requiredCapabilities.filter(
        capability => typeof capability === 'string'
      );
    }
    return {
      code,
      message: this.failureMessage(code),
      retryable: [
        'ai_planning_failed',
        'request_aborted',
        'required_read_evidence_missing',
        'required_side_effect_missing',
        'required_tool_evidence_missing',
        'required_tool_unavailable',
        'tool_execution_limit_exceeded',
        'tool_snapshot_failed',
        'tool_agent_timeout',
      ].includes(code),
      ...(Object.keys(details).length ? { details } : {}),
    };
  }

  private safeFailureCode(code: string | null) {
    const allowed = new Set([
      'agent_runtime_adapter_execution_failed',
      'approval_callback_not_configured',
      'ai_planning_failed',
      'attachment_evidence_mismatch',
      'attachment_limit_exceeded',
      'attachment_materialization_failed',
      'attachment_persistence_failed',
      'attachment_total_size_exceeded',
      'context_too_large',
      'credential_inactive',
      'credential_scope_denied',
      'permission_denied',
      'request_aborted',
      'required_read_evidence_missing',
      'required_side_effect_missing',
      'required_tool_evidence_missing',
      'required_tool_unavailable',
      'resource_not_accessible',
      'resource_version_conflict',
      'task_plan_persistence_failed',
      'tool_agent_timeout',
      'tool_execution_limit_exceeded',
      'tool_snapshot_failed',
      'unsupported_task',
    ]);
    return code && allowed.has(code) ? code : 'task_failed';
  }

  private failureMessage(code: string) {
    const messages: Record<string, string> = {
      agent_runtime_adapter_execution_failed:
        'LocalMind could not execute the authorized document update.',
      approval_callback_not_configured:
        'The task required approval, but no callback was configured.',
      approval_expired: 'The task approval expired before a decision.',
      approval_rejected: 'The task approval was rejected.',
      ai_planning_failed: 'LocalMind could not plan the task.',
      attachment_evidence_mismatch:
        'A task attachment changed after it was uploaded.',
      attachment_limit_exceeded: 'The task contains too many attachments.',
      attachment_materialization_failed:
        'LocalMind could not read a task attachment.',
      attachment_persistence_failed:
        'LocalMind could not persist a task attachment.',
      attachment_total_size_exceeded:
        'The task attachments exceed the combined size limit.',
      context_too_large: 'The authorized task context was too large.',
      credential_inactive: 'The delegated credential family is inactive.',
      credential_scope_denied:
        'The task credential capability ceiling is insufficient.',
      permission_denied: 'The delegated user no longer has required access.',
      request_aborted: 'The task request was aborted.',
      required_read_evidence_missing:
        'LocalMind did not produce the required successful document-read evidence.',
      required_side_effect_missing:
        'LocalMind did not produce the required successful side-effect evidence.',
      required_tool_evidence_missing:
        'LocalMind did not produce all successful tool evidence required to complete the task.',
      required_tool_unavailable:
        'A tool required to complete the LocalMind task is no longer available.',
      resource_not_accessible: 'A required task resource is not accessible.',
      resource_version_conflict:
        'A task resource changed before the authorized update executed.',
      task_cancelled: 'The task was cancelled.',
      task_failed: 'The LocalMind task failed.',
      task_plan_persistence_failed:
        'LocalMind could not persist the task plan.',
      tool_agent_timeout:
        'LocalMind tool execution timed out before the task completed.',
      tool_execution_limit_exceeded:
        'LocalMind reached the maximum number of tool executions before the task completed.',
      tool_snapshot_failed:
        'LocalMind could not freeze the task tool capabilities before execution.',
      unsupported_task: 'LocalMind does not support this task yet.',
    };
    return messages[code] ?? messages.task_failed;
  }

  private artifacts(
    record: AiMcpDelegationRequest,
    status: PublicTaskStatus,
    plan: LocalMindTaskPlan | null
  ) {
    if (status !== 'completed') return [];
    const result = objectValue(record.result);
    if (plan?.kind === 'tool_agent') {
      if (!Array.isArray(result.artifacts)) return [];
      return result.artifacts.slice(0, 20).flatMap(value => {
        const artifact = objectValue(value);
        const documentId = stringValue(artifact.documentId);
        const relation = stringValue(artifact.relation);
        const versionFingerprint = stringValue(artifact.versionFingerprint);
        if (
          artifact.kind !== 'document' ||
          !documentId ||
          !relation ||
          !['created', 'updated'].includes(relation)
        ) {
          return [];
        }
        return [
          {
            kind: 'document',
            relation,
            reference: {
              type: 'localmind_document',
              workspaceId:
                stringValue(artifact.workspaceId) ?? record.workspaceId,
              documentId,
            },
            versionFingerprint,
          },
        ];
      });
    }
    if (plan?.kind !== 'document_update') return [];
    const documentId =
      stringValue(result.documentId) ?? plan.target?.documentId ?? null;
    if (!documentId) return [];
    return [
      {
        kind: 'document',
        relation: 'updated',
        reference: {
          type: 'localmind_document',
          documentId,
        },
        versionFingerprint:
          stringValue(result.contentFingerprint) ??
          plan.target?.contentFingerprint ??
          null,
      },
    ];
  }

  private availableControls(
    record: AiMcpDelegationRequest,
    run: CopilotAgentRunRecord | null,
    status: PublicTaskStatus
  ) {
    if (
      !run ||
      !record.capabilitySnapshot.includes(MCP_TASK_CONTROL_CAPABILITY) ||
      this.cancellationRequested(run)
    ) {
      return [];
    }
    return [
      'waiting_approval',
      'waiting_for_location',
      'queued',
      'running',
    ].includes(status)
      ? ['cancel']
      : [];
  }

  private cancellationRequested(run: CopilotAgentRunRecord) {
    return (
      run.status === 'running' &&
      run.timelineEvents.some(event => {
        const payload = objectValue(event.payload);
        return (
          event.eventType === 'run_cancellation' &&
          payload.action === 'cancel_requested'
        );
      })
    );
  }

  private withChanged(projected: ProjectedTaskView, changed: boolean) {
    return { ...projected.view, changed };
  }

  private wait(milliseconds: number, signal: AbortSignal) {
    return new Promise<void>(resolve => {
      if (milliseconds <= 0 || signal.aborted) return resolve();
      const timer = setTimeout(done, milliseconds);
      signal.addEventListener('abort', done, { once: true });
      function done() {
        clearTimeout(timer);
        signal.removeEventListener('abort', done);
        resolve();
      }
    });
  }
}
