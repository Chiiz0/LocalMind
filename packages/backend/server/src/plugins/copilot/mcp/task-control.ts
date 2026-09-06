import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { AiMcpDelegationRequest, McpCredential } from '@prisma/client';
import { z } from 'zod';

import { JobQueue } from '../../../base';
import { PermissionAccess } from '../../../core/permission';
import { Models } from '../../../models';
import type { CopilotAgentRunRecord } from '../../../models/copilot-agent-runtime';
import { mcpDelegationFingerprint } from '../../../models/copilot-mcp-delegation';
import { MCP_TASK_CONTROL_CAPABILITY } from './capabilities';
import {
  defineTool,
  RESULT_OUTPUT_SCHEMA,
  toolResult,
  type WorkspaceMcpToolDefinition,
} from './types';

const ControlLocalMindTaskInput = z
  .object({
    taskId: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .describe(
        'The unfinished taskId returned by delegate_to_localmind. This is not a document ID.'
      ),
    action: z
      .literal('cancel')
      .describe(
        'The only supported control action. Must be exactly cancel; approval, rejection, retry, and resume are not supported.'
      ),
    idempotencyKey: z
      .string()
      .trim()
      .min(1)
      .max(256)
      .describe(
        'A caller-generated stable key for this exact cancellation request. Reuse it only when retrying the same cancellation.'
      ),
    reason: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .optional()
      .describe('An optional short user-provided reason for cancellation.'),
  })
  .strict()
  .describe('Cancel one unfinished task previously started by LocalMind.');

type TaskControlCredential = Pick<
  McpCredential,
  'familyId' | 'userId' | 'workspaceId'
>;

type ControlInput = z.infer<typeof ControlLocalMindTaskInput>;

type ControlTransactionResult = {
  response: Record<string, unknown>;
  callbackRequestId: string | null;
};

type ControlAccessResult =
  | { record: AiMcpDelegationRequest }
  | { error: Record<string, unknown> };

@Injectable()
export class McpAiTaskControlService {
  constructor(
    private readonly ac: PermissionAccess,
    private readonly models: Models,
    private readonly jobs: JobQueue
  ) {}

  createTool(credential: TaskControlCredential): WorkspaceMcpToolDefinition {
    return defineTool({
      name: 'control_localmind_task',
      title: 'Cancel a LocalMind Task',
      description:
        'Use ONLY when the user explicitly asks to stop or cancel an unfinished task previously started by delegate_to_localmind. The only valid action is cancel. This tool cannot start, approve, reject, retry, resume, query, create, or edit anything. Queued work is cancelled immediately; running work receives a cooperative cancellation request, after which get_localmind_task reports progress to terminal cancellation.',
      parser: ControlLocalMindTaskInput,
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      execute: async args => toolResult(await this.control(credential, args)),
    });
  }

  async control(credential: TaskControlCredential, input: ControlInput) {
    const result = await this.applyControl(credential, input);
    if (result.callbackRequestId) {
      await this.scheduleCancellationCallback(result.callbackRequestId);
    }
    return result.response;
  }

  async reconcileCancelledAgentRun(run: CopilotAgentRunRecord) {
    if (run.status !== 'cancelled' || run.sourceType !== 'mcp_ai_delegation') {
      return false;
    }
    const requestId = await this.reconcileCancelledAgentRunTransaction(run);
    if (requestId) await this.scheduleCancellationCallback(requestId);
    return !!requestId;
  }

  @Transactional()
  private async applyControl(
    credential: TaskControlCredential,
    input: ControlInput
  ): Promise<ControlTransactionResult> {
    const access = await this.loadAuthorizedTask(credential, input.taskId);
    if ('error' in access) {
      return { response: access.error, callbackRequestId: null };
    }
    const record = access.record;
    const reason = input.reason?.trim() ?? null;
    const requestFingerprint = mcpDelegationFingerprint({
      version: 'localmind-task-control-request/v1',
      taskId: record.id,
      action: input.action,
      reason,
    });
    const claimed = await this.models.copilotMcpDelegation.claimControl({
      requestId: record.id,
      workspaceId: record.workspaceId,
      actorId: record.actorId,
      credentialFamilyId: record.credentialFamilyId,
      action: input.action,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint,
    });
    if (!claimed.created) {
      if (claimed.record.requestFingerprint !== requestFingerprint) {
        return {
          response: { code: 'idempotency_conflict' },
          callbackRequestId: null,
        };
      }
      if (
        claimed.record.status === 'completed' &&
        claimed.record.outcome &&
        typeof claimed.record.outcome === 'object' &&
        !Array.isArray(claimed.record.outcome)
      ) {
        return {
          response: {
            ...(claimed.record.outcome as Record<string, unknown>),
            idempotentReplay: true,
          },
          callbackRequestId: null,
        };
      }
      return {
        response: {
          protocolVersion: 'localmind.task-control.v1',
          controlId: claimed.record.id,
          taskId: record.id,
          action: 'cancel',
          outcome: 'control_in_progress',
        },
        callbackRequestId: null,
      };
    }

    const run = record.agentRunId
      ? await this.models.copilotAgentRuntime.get(
          record.workspaceId,
          record.agentRunId
        )
      : null;
    if (
      run &&
      (run.actorId !== record.actorId ||
        run.sourceType !== 'mcp_ai_delegation' ||
        run.sourceId !== record.id)
    ) {
      throw new Error('MCP delegation Agent Runtime linkage is invalid');
    }

    let outcome: Record<string, unknown>;
    let callbackRequestId: string | null = null;
    if (!run) {
      outcome = this.outcome(
        claimed.record.id,
        record.id,
        'not_cancellable',
        this.taskStatus(record, null),
        true
      );
    } else if (run.status === 'cancelled') {
      const finalized = await this.finalizeCancellation(
        record,
        run,
        claimed.record.id,
        'cooperative'
      );
      outcome = this.outcome(
        claimed.record.id,
        record.id,
        'cancelled',
        'cancelled',
        true
      );
      callbackRequestId = finalized ? record.id : null;
    } else if (
      run.status === 'completed' ||
      run.status === 'failed' ||
      record.status === 'completed' ||
      record.status === 'rejected' ||
      this.isFailureStatus(record.status) ||
      record.status === 'cancelled'
    ) {
      outcome = this.outcome(
        claimed.record.id,
        record.id,
        'not_cancellable',
        this.taskStatus(record, run),
        true
      );
    } else {
      const controlled = await this.models.copilotAgentRuntime.controlRun({
        workspaceId: record.workspaceId,
        actorId: record.actorId,
        id: run.id,
        action: 'cancel',
        reason,
      });
      if (controlled.status === 'cancelled') {
        const finalized = await this.finalizeCancellation(
          record,
          controlled,
          claimed.record.id,
          'immediate'
        );
        if (!finalized) {
          throw new Error(
            'MCP delegation cancellation could not finalize task state'
          );
        }
        outcome = this.outcome(
          claimed.record.id,
          record.id,
          'cancelled',
          'cancelled',
          true
        );
        callbackRequestId = record.id;
      } else {
        outcome = this.outcome(
          claimed.record.id,
          record.id,
          'cancellation_requested',
          'cancelling',
          false
        );
      }
    }

    await this.models.copilotMcpDelegation.completeControl({
      id: claimed.record.id,
      requestFingerprint,
      outcome,
      outcomeFingerprint: mcpDelegationFingerprint(outcome),
    });
    return { response: outcome, callbackRequestId };
  }

  @Transactional()
  private async reconcileCancelledAgentRunTransaction(
    run: CopilotAgentRunRecord
  ) {
    const record = await this.models.copilotMcpDelegation.getRequestByAgentRun(
      run.id
    );
    if (
      !record ||
      record.id !== run.sourceId ||
      record.workspaceId !== run.workspaceId ||
      record.actorId !== run.actorId
    ) {
      return null;
    }
    if (record.status === 'cancelled') return null;
    if (
      record.status !== 'processing' &&
      record.status !== 'waiting_approval' &&
      record.status !== 'waiting_for_location'
    ) {
      return null;
    }
    const control =
      await this.models.copilotMcpDelegation.latestCompletedCancelControl(
        record.id
      );
    const finalized = await this.finalizeCancellation(
      record,
      run,
      control?.id ?? null,
      'cooperative'
    );
    return finalized ? record.id : null;
  }

  private async loadAuthorizedTask(
    credential: TaskControlCredential,
    taskId: string
  ): Promise<ControlAccessResult> {
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
    if (!record.capabilitySnapshot.includes(MCP_TASK_CONTROL_CAPABILITY)) {
      return {
        error: {
          code: 'credential_scope_denied',
          requiredCapabilities: [MCP_TASK_CONTROL_CAPABILITY],
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
    return { record };
  }

  private async finalizeCancellation(
    record: AiMcpDelegationRequest,
    run: CopilotAgentRunRecord,
    controlId: string | null,
    mode: 'immediate' | 'cooperative'
  ) {
    const finalized =
      await this.models.copilotMcpDelegation.finalizeCancellation({
        id: record.id,
        workspaceId: record.workspaceId,
        actorId: record.actorId,
        agentRunId: run.id,
        controlId,
        mode,
      });
    if (!finalized) return null;

    await this.models.copilotMcpDelegation.cancelPendingApprovalCallback(
      record.id
    );
    const endpoint = await this.models.copilotMcpDelegation.getEndpoint(
      record.credentialFamilyId
    );
    if (!endpoint) return finalized;
    await this.models.copilotMcpDelegation.enqueueCallback({
      requestId: record.id,
      eventType: 'task_cancelled',
      payload: {
        version: 'localmind-mcp-callback/v1',
        event: 'task_cancelled',
        requestId: record.id,
        status: finalized.status,
        result: finalized.result,
      },
    });
    return finalized;
  }

  private outcome(
    controlId: string,
    taskId: string,
    outcome: 'cancelled' | 'cancellation_requested' | 'not_cancellable',
    taskStatus: string,
    terminal: boolean
  ) {
    return {
      protocolVersion: 'localmind.task-control.v1',
      controlId,
      taskId,
      action: 'cancel',
      outcome,
      taskStatus,
      terminal,
      pollAfterMs: terminal ? null : 1_000,
      idempotentReplay: false,
    };
  }

  private taskStatus(
    record: AiMcpDelegationRequest,
    run: CopilotAgentRunRecord | null
  ) {
    if (record.status === 'completed') return 'completed';
    if (record.status === 'rejected') return 'rejected';
    if (record.status === 'cancelled' || run?.status === 'cancelled') {
      return 'cancelled';
    }
    if (this.isFailureStatus(record.status) || run?.status === 'failed') {
      return 'failed';
    }
    return run?.status ?? record.status;
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

  private scheduleCancellationCallback(requestId: string) {
    return this.jobs.add(
      'copilot.mcpDelegation.deliverCallback',
      { requestId },
      { jobId: `copilot-mcp-delegation-cancelled-${requestId}` }
    );
  }
}
