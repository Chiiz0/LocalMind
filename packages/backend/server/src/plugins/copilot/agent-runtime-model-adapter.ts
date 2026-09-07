import { setTimeout as delay } from 'node:timers/promises';

import { Injectable, Logger } from '@nestjs/common';

import { Models } from '../../models';
import type {
  CopilotAgentRunRecord,
  CopilotAgentStepRecord,
} from '../../models/copilot-agent-runtime';
import {
  type CopilotAgentRuntimeWorkflowAdapterInput,
  CopilotAgentRuntimeWorkflowRegistry,
} from './agent-runtime-workflow-registry';
import type { PromptParams } from './providers/types';
import { PromptRuntime } from './runtime/prompt-runtime';

export const AGENT_RUNTIME_MODEL_COMPLETION_WORKFLOW =
  'agent_runtime_model_completion';
export const AGENT_RUNTIME_MODEL_REQUEST_VERSION =
  'agent-runtime-model-request/v1';

const MODEL_REQUEST_STRING_MAX_LENGTH = 512;
const MODEL_REQUEST_PARAM_MAX_COUNT = 32;
const MODEL_REQUEST_PARAM_KEY_MAX_LENGTH = 128;
const MODEL_REQUEST_PARAM_VALUE_MAX_LENGTH = 4096;
const MODEL_COMPLETION_OUTPUT_EVIDENCE_MAX_LENGTH = 640;
const MODEL_COMPLETION_TIMEOUT_MS = 120_000;
const MODEL_COMPLETION_CANCELLATION_POLL_MS = 1_000;
const MODEL_COMPLETION_REDACTED_SECRET = '[redacted-secret]';
const MODEL_COMPLETION_REDACTED_EMAIL = '[redacted-email]';
const MODEL_COMPLETION_REDACTED_CREDENTIALS = '[redacted-credentials]';
const MODEL_COMPLETION_SECRET_ASSIGNMENT_PATTERN =
  /\b(api[-_\s]?key|access[-_\s]?token|refresh[-_\s]?token|auth[-_\s]?token|authorization|secret|password|client[-_\s]?secret)\b(\s*[:=]\s*)(["']?)[^"',;\s]+(["']?)/gi;
const MODEL_COMPLETION_BEARER_SECRET_PATTERN =
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const MODEL_COMPLETION_PROVIDER_SECRET_PATTERN =
  /\b(?:sk-[A-Za-z0-9_-]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,}|AKIA[0-9A-Z]{12,})\b/g;
const MODEL_COMPLETION_URL_CREDENTIAL_PATTERN =
  /\b([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^@\s/]+@/gi;
const MODEL_COMPLETION_EMAIL_PATTERN =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

type AgentRuntimeModelRequest = {
  modelId: string | undefined;
  params: PromptParams;
  promptName: string;
};

function modelRequestError(stepKey: string, reason: string): Error {
  return new Error(
    `Agent runtime model step "${stepKey}" has an invalid model request: ${reason}`
  );
}

function requireModelRequestString(
  value: unknown,
  stepKey: string,
  field: string,
  maxLength: number
) {
  if (typeof value !== 'string') {
    throw modelRequestError(stepKey, `${field} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw modelRequestError(stepKey, `${field} must not be blank`);
  }
  if (normalized.length > maxLength) {
    throw modelRequestError(stepKey, `${field} is too long`);
  }
  return normalized;
}

function normalizeModelRequestOutput(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }
  const redacted = redactModelCompletionOutput(normalized);
  if (redacted.length <= MODEL_COMPLETION_OUTPUT_EVIDENCE_MAX_LENGTH) {
    return redacted;
  }
  return `${redacted.slice(0, MODEL_COMPLETION_OUTPUT_EVIDENCE_MAX_LENGTH)}…`;
}

function redactModelCompletionOutput(value: string) {
  return value
    .replace(
      MODEL_COMPLETION_URL_CREDENTIAL_PATTERN,
      (_match: string, protocol: string) =>
        `${protocol}${MODEL_COMPLETION_REDACTED_CREDENTIALS}@`
    )
    .replace(
      MODEL_COMPLETION_SECRET_ASSIGNMENT_PATTERN,
      (
        _match: string,
        key: string,
        separator: string,
        openQuote: string,
        closeQuote: string
      ) => {
        const quote = openQuote || closeQuote || '';
        return `${key}${separator}${quote}${MODEL_COMPLETION_REDACTED_SECRET}${quote}`;
      }
    )
    .replace(
      MODEL_COMPLETION_BEARER_SECRET_PATTERN,
      `Bearer ${MODEL_COMPLETION_REDACTED_SECRET}`
    )
    .replace(
      MODEL_COMPLETION_PROVIDER_SECRET_PATTERN,
      MODEL_COMPLETION_REDACTED_SECRET
    )
    .replace(MODEL_COMPLETION_EMAIL_PATTERN, MODEL_COMPLETION_REDACTED_EMAIL);
}

@Injectable()
export class CopilotAgentRuntimeModelCompletionAdapter {
  private readonly logger = new Logger(
    CopilotAgentRuntimeModelCompletionAdapter.name
  );

  constructor(
    private readonly models: Models,
    private readonly promptRuntime: PromptRuntime,
    private readonly workflowRegistry: CopilotAgentRuntimeWorkflowRegistry
  ) {
    this.workflowRegistry.register({
      workflow: AGENT_RUNTIME_MODEL_COMPLETION_WORKFLOW,
      capabilities: {
        version: 'agent-runtime-workflow-adapter-capabilities/v1',
        supportedStepTypes: ['model'],
        sideEffectMode: 'none',
        summary:
          'Executes one persisted model step through the DB-routed Copilot prompt/provider stack and records bounded output evidence.',
      },
      execute: input => this.execute(input),
    });
  }

  private requireModelStep(run: CopilotAgentRunRecord) {
    const activeModelSteps = run.steps.filter(
      step =>
        step.stepType === 'model' &&
        (step.status === 'pending' ||
          step.status === 'running' ||
          step.status === 'waiting_approval')
    );
    if (activeModelSteps.length !== 1) {
      throw new Error(
        `Agent runtime model completion requires exactly one active model step, found ${activeModelSteps.length}: ${run.id}`
      );
    }
    return activeModelSteps[0];
  }

  private normalizeModelRequest(
    step: CopilotAgentStepRecord
  ): AgentRuntimeModelRequest {
    const request = step.outputSummary.modelRequest;
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      throw modelRequestError(
        step.stepKey,
        'step output summary must persist a modelRequest object'
      );
    }
    const modelRequest = request as Record<string, unknown>;
    const version = requireModelRequestString(
      modelRequest.version,
      step.stepKey,
      'version',
      MODEL_REQUEST_STRING_MAX_LENGTH
    );
    if (version !== AGENT_RUNTIME_MODEL_REQUEST_VERSION) {
      throw modelRequestError(
        step.stepKey,
        `version must be ${AGENT_RUNTIME_MODEL_REQUEST_VERSION}`
      );
    }
    const promptName = requireModelRequestString(
      modelRequest.promptName,
      step.stepKey,
      'promptName',
      MODEL_REQUEST_STRING_MAX_LENGTH
    );
    const modelId =
      modelRequest.modelId === undefined || modelRequest.modelId === null
        ? undefined
        : requireModelRequestString(
            modelRequest.modelId,
            step.stepKey,
            'modelId',
            MODEL_REQUEST_STRING_MAX_LENGTH
          );

    const params: PromptParams = {};
    if (modelRequest.params !== undefined && modelRequest.params !== null) {
      if (
        typeof modelRequest.params !== 'object' ||
        Array.isArray(modelRequest.params)
      ) {
        throw modelRequestError(step.stepKey, 'params must be an object');
      }
      const entries = Object.entries(
        modelRequest.params as Record<string, unknown>
      );
      if (entries.length > MODEL_REQUEST_PARAM_MAX_COUNT) {
        throw modelRequestError(step.stepKey, 'params has too many entries');
      }
      for (const [key, value] of entries) {
        if (!key.trim() || key.length > MODEL_REQUEST_PARAM_KEY_MAX_LENGTH) {
          throw modelRequestError(step.stepKey, 'params has an invalid key');
        }
        if (typeof value !== 'string') {
          throw modelRequestError(
            step.stepKey,
            `params.${key} must be a string`
          );
        }
        if (value.length > MODEL_REQUEST_PARAM_VALUE_MAX_LENGTH) {
          throw modelRequestError(step.stepKey, `params.${key} is too long`);
        }
        params[key] = value;
      }
    }

    return { modelId, params, promptName };
  }

  private async execute(input: CopilotAgentRuntimeWorkflowAdapterInput) {
    const { run, workerLeaseId, workerAttempt, checkCancellationRequested } =
      input;
    const step = this.requireModelStep(run);
    const request = this.normalizeModelRequest(step);

    if (await checkCancellationRequested()) {
      this.logger.debug(
        `Agent runtime model completion cancelled before provider call: ${run.id}`
      );
      return;
    }

    const abortController = new AbortController();
    const pollerStopController = new AbortController();
    let pollingStopped = false;
    let cancellationConsumed = false;
    let timedOut = false;
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      abortController.abort();
    }, MODEL_COMPLETION_TIMEOUT_MS);
    const cancellationPoller = (async () => {
      while (!pollingStopped) {
        await delay(MODEL_COMPLETION_CANCELLATION_POLL_MS, undefined, {
          signal: pollerStopController.signal,
        }).catch(() => {});
        if (pollingStopped) {
          return;
        }
        try {
          const cancelled = await checkCancellationRequested();
          if (cancelled) {
            cancellationConsumed = true;
            abortController.abort();
            return;
          }
        } catch (error) {
          this.logger.debug(
            `Agent runtime model completion cancellation poll stopped for ${run.id}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`
          );
          return;
        }
      }
    })();

    let outputText: string;
    try {
      outputText = await this.promptRuntime.runText(
        request.promptName,
        request.params,
        {
          modelId: request.modelId,
          providerOptions: {
            signal: abortController.signal,
            user: run.actorId,
            workspace: run.workspaceId,
            session: run.sessionId ?? undefined,
          },
        }
      );
    } catch (error) {
      if (cancellationConsumed) {
        this.logger.debug(
          `Agent runtime model completion cancelled during provider call: ${run.id}`
        );
        return;
      }
      if (timedOut) {
        throw new Error(
          `Agent runtime model step "${step.stepKey}" timed out after ${MODEL_COMPLETION_TIMEOUT_MS}ms`
        );
      }
      throw error;
    } finally {
      pollingStopped = true;
      pollerStopController.abort();
      clearTimeout(timeoutTimer);
      await cancellationPoller;
    }

    if (cancellationConsumed) {
      this.logger.debug(
        `Agent runtime model completion cancelled after provider call: ${run.id}`
      );
      return;
    }
    if (await checkCancellationRequested()) {
      this.logger.debug(
        `Agent runtime model completion cancelled before completion write: ${run.id}`
      );
      return;
    }

    const outputEvidence = normalizeModelRequestOutput(outputText);
    const summary = [
      `Model step "${step.stepKey}" completed through prompt "${request.promptName}"`,
      request.modelId ? ` (requested model ${request.modelId})` : '',
      outputEvidence ? `: ${outputEvidence}` : ': [empty model output]',
    ].join('');

    await this.models.copilotAgentRuntime.completeStandaloneWorkerExecution({
      workspaceId: run.workspaceId,
      id: run.id,
      workerLeaseId,
      workerAttempt,
      adapterWorkflow: AGENT_RUNTIME_MODEL_COMPLETION_WORKFLOW,
      sideEffectMode: 'none',
      summary,
      adapterResolution: this.workflowRegistry.completedAdapterResolution(
        run,
        AGENT_RUNTIME_MODEL_COMPLETION_WORKFLOW
      ),
    });
  }
}
