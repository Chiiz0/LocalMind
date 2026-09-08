import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { Models } from '../../models';
import type {
  CopilotAgentRunRecord,
  CopilotAgentStepType,
} from '../../models/copilot-agent-runtime';
import type { ProjectAgentRun } from '../../models/copilot-project-agent-runtime';

const AGENT_RUNTIME_WORKFLOW_ADAPTER_CAPABILITIES_VERSION =
  'agent-runtime-workflow-adapter-capabilities/v1';
const AGENT_RUNTIME_WORKER_ADAPTER_RESOLUTION_VERSION =
  'agent-runtime-worker-adapter-resolution/v1';

const AGENT_RUNTIME_STEP_TYPES = new Set<CopilotAgentStepType>([
  'approval',
  'codex',
  'handoff',
  'mcp',
  'model',
  'tool',
]);

const AGENT_RUNTIME_ADAPTER_SIDE_EFFECT_MODES =
  new Set<CopilotAgentRuntimeWorkflowAdapterSideEffectMode>([
    'none',
    'workspace_write',
    'project_write',
    'external_tool',
  ]);
const AGENT_RUNTIME_WORKFLOW_MAX_LENGTH = 128;
const AGENT_RUNTIME_CAPABILITY_SUMMARY_MAX_LENGTH = 512;
const AGENT_RUNTIME_ADAPTER_MAX_COUNT = 24;

export type CopilotAgentRuntimeWorkflowAdapterSideEffectMode =
  | 'none'
  | 'workspace_write'
  | 'project_write'
  | 'external_tool';

export interface CopilotAgentRuntimeWorkflowAdapterCapabilities {
  readonly version: string;
  readonly supportedStepTypes: readonly CopilotAgentStepType[];
  readonly sideEffectMode: CopilotAgentRuntimeWorkflowAdapterSideEffectMode;
  readonly summary: string;
}

export interface CopilotAgentRuntimeWorkflowAdapterInput {
  run: CopilotAgentRunRecord;
  workerLeaseId: string;
  workerAttempt: number;
  checkCancellationRequested(): Promise<CopilotAgentRunRecord | null>;
}

export interface CopilotAgentRuntimeWorkflowAdapter {
  readonly workflow: string;
  readonly capabilities: CopilotAgentRuntimeWorkflowAdapterCapabilities;
  execute(input: CopilotAgentRuntimeWorkflowAdapterInput): Promise<void>;
}

export interface ProjectAgentRuntimeWorkflowAdapter {
  readonly workflow: string;
  readonly capabilities: CopilotAgentRuntimeWorkflowAdapterCapabilities;
  execute(run: ProjectAgentRun): Promise<Prisma.InputJsonObject>;
  prepare?(
    run: ProjectAgentRun
  ): Promise<(run: ProjectAgentRun) => Promise<Prisma.InputJsonObject>>;
}

function requireAdapterString(
  value: unknown,
  field: string,
  maxLength: number,
  requiredMessage?: string
) {
  if (typeof value !== 'string') {
    throw new Error(
      requiredMessage ?? `Agent Runtime workflow adapter requires ${field}`
    );
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(
      requiredMessage ?? `Agent Runtime workflow adapter requires ${field}`
    );
  }
  if (normalized.length > maxLength) {
    throw new Error(`Agent Runtime workflow adapter ${field} is too long`);
  }
  return normalized;
}

@Injectable()
export class CopilotAgentRuntimeWorkflowRegistry {
  private readonly projectAdapters = new Map<
    string,
    ProjectAgentRuntimeWorkflowAdapter
  >();
  private readonly adapters = new Map<
    string,
    CopilotAgentRuntimeWorkflowAdapter
  >();

  constructor(private readonly models: Models) {
    this.register({
      workflow: 'agent_runtime_local_completion',
      capabilities: {
        version: AGENT_RUNTIME_WORKFLOW_ADAPTER_CAPABILITIES_VERSION,
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
          'Completes local Agent Runtime workflows through the generic worker completion contract.',
      },
      execute: async ({ run, workerLeaseId }) => {
        await this.models.copilotAgentRuntime.completeStandaloneWorkerExecution(
          {
            workspaceId: run.workspaceId,
            id: run.id,
            workerLeaseId,
            workerAttempt: run.workerAttempt,
            adapterWorkflow: 'agent_runtime_local_completion',
            sideEffectMode: 'none',
            summary:
              'Local Agent Runtime workflow adapter completed without external side effects.',
            adapterResolution: this.completedAdapterResolution(
              run,
              'agent_runtime_local_completion'
            ),
          }
        );
      },
    });
    this.register({
      workflow: 'agent_runtime_record_only',
      capabilities: {
        version: AGENT_RUNTIME_WORKFLOW_ADAPTER_CAPABILITIES_VERSION,
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
      execute: async ({ run, workerLeaseId }) => {
        await this.models.copilotAgentRuntime.completeStandaloneRecordOnlyExecution(
          {
            workspaceId: run.workspaceId,
            id: run.id,
            workerLeaseId,
            workerAttempt: run.workerAttempt,
          }
        );
      },
    });
  }

  private adapterCapabilitySnapshots() {
    return this.adapterCapabilities().map(adapter => ({
      workflow: adapter.workflow,
      supportedStepTypes: [...adapter.capabilities.supportedStepTypes],
      sideEffectMode: adapter.capabilities.sideEffectMode,
    }));
  }

  private requestedStepTypes(run: CopilotAgentRunRecord) {
    return [...new Set(run.steps.map(step => step.stepType))].sort();
  }

  completedAdapterResolution(run: CopilotAgentRunRecord, workflow: string) {
    const registeredAdapters = this.adapterCapabilitySnapshots();
    const adapter = registeredAdapters.find(item => item.workflow === workflow);
    if (!adapter) {
      throw new Error(
        `Agent Runtime workflow adapter disappeared: ${workflow}`
      );
    }
    return {
      version: AGENT_RUNTIME_WORKER_ADAPTER_RESOLUTION_VERSION,
      status: 'completed',
      workflow: run.workflow,
      requestedStepTypes: this.requestedStepTypes(run),
      adapter,
      registeredAdapters,
    };
  }

  register(adapter: CopilotAgentRuntimeWorkflowAdapter) {
    if (!adapter || typeof adapter !== 'object') {
      throw new Error('Agent Runtime workflow adapter requires adapter');
    }
    const workflow = requireAdapterString(
      adapter.workflow,
      'workflow',
      AGENT_RUNTIME_WORKFLOW_MAX_LENGTH
    );
    if (!adapter.capabilities || typeof adapter.capabilities !== 'object') {
      throw new Error(
        `Agent Runtime workflow adapter requires capabilities: ${workflow}`
      );
    }
    if (
      adapter.capabilities.version !==
      AGENT_RUNTIME_WORKFLOW_ADAPTER_CAPABILITIES_VERSION
    ) {
      throw new Error(
        `Agent Runtime workflow adapter has unsupported capability version: ${workflow}`
      );
    }
    if (
      !AGENT_RUNTIME_ADAPTER_SIDE_EFFECT_MODES.has(
        adapter.capabilities.sideEffectMode
      )
    ) {
      throw new Error(
        `Agent Runtime workflow adapter has unsupported side-effect mode: ${workflow}`
      );
    }
    const summary = requireAdapterString(
      adapter.capabilities.summary,
      'capability summary',
      AGENT_RUNTIME_CAPABILITY_SUMMARY_MAX_LENGTH,
      `Agent Runtime workflow adapter requires capability summary: ${workflow}`
    );
    if (!Array.isArray(adapter.capabilities.supportedStepTypes)) {
      throw new Error(
        `Agent Runtime workflow adapter requires supported step types: ${workflow}`
      );
    }
    const supportedStepTypes = [
      ...new Set(adapter.capabilities.supportedStepTypes),
    ].sort((left, right) => left.localeCompare(right));
    if (!supportedStepTypes.length) {
      throw new Error(
        `Agent Runtime workflow adapter requires supported step types: ${workflow}`
      );
    }
    const unsupportedCapabilityStepTypes = supportedStepTypes.filter(
      stepType => !AGENT_RUNTIME_STEP_TYPES.has(stepType)
    );
    if (unsupportedCapabilityStepTypes.length) {
      throw new Error(
        [
          'Agent Runtime workflow adapter declares unsupported step types:',
          `${workflow}: ${unsupportedCapabilityStepTypes.join(', ')}`,
        ].join(' ')
      );
    }
    if (this.adapters.has(workflow)) {
      throw new Error(
        `Agent Runtime workflow adapter already registered: ${workflow}`
      );
    }
    if (this.adapters.size >= AGENT_RUNTIME_ADAPTER_MAX_COUNT) {
      throw new Error('Agent Runtime workflow adapter registry is full');
    }
    if (typeof adapter.execute !== 'function') {
      throw new Error(
        `Agent Runtime workflow adapter requires executor: ${workflow}`
      );
    }
    const capabilities = Object.freeze({
      version: AGENT_RUNTIME_WORKFLOW_ADAPTER_CAPABILITIES_VERSION,
      supportedStepTypes: Object.freeze([...supportedStepTypes]),
      sideEffectMode: adapter.capabilities.sideEffectMode,
      summary,
    });
    this.adapters.set(
      workflow,
      Object.freeze({
        workflow,
        capabilities,
        execute: adapter.execute,
      })
    );
  }

  get(workflow: string) {
    if (this.projectAdapters.has(workflow)) return null;
    return this.adapters.get(workflow) ?? null;
  }

  registerProject(adapter: ProjectAgentRuntimeWorkflowAdapter) {
    this.register({
      workflow: adapter.workflow,
      capabilities: adapter.capabilities,
      execute: async () => {
        throw new Error('Project adapter requires a Project worker lease');
      },
    });
    this.projectAdapters.set(adapter.workflow, Object.freeze(adapter));
  }

  getProject(workflow: string) {
    return this.projectAdapters.get(workflow) ?? null;
  }

  assertRunSupported(
    adapter: CopilotAgentRuntimeWorkflowAdapter,
    run: CopilotAgentRunRecord
  ) {
    const supported = new Set(adapter.capabilities.supportedStepTypes);
    const unsupportedStepTypes = [
      ...new Set(
        run.steps
          .map(step => step.stepType)
          .filter(stepType => !supported.has(stepType))
      ),
    ].sort();
    if (!unsupportedStepTypes.length) {
      return null;
    }

    return {
      code: 'unsupported_agent_runtime_adapter_contract',
      message: [
        `Agent Runtime workflow adapter ${adapter.workflow} does not support`,
        `step types: ${unsupportedStepTypes.join(', ')}.`,
        `Supported step types: ${adapter.capabilities.supportedStepTypes.join(
          ', '
        )}.`,
      ].join(' '),
      unsupportedStepTypes,
    };
  }

  supportedWorkflows() {
    return [...this.adapters.keys()].sort();
  }

  adapterCapabilities() {
    return this.supportedWorkflows().map(workflow => {
      const adapter = this.adapters.get(workflow);
      if (!adapter) {
        throw new Error(
          `Agent Runtime workflow adapter disappeared: ${workflow}`
        );
      }
      return {
        workflow,
        capabilities: {
          ...adapter.capabilities,
          supportedStepTypes: [...adapter.capabilities.supportedStepTypes],
        },
      };
    });
  }
}
