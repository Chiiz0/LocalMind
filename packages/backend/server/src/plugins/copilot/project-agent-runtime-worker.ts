import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { JOB_SIGNAL, OnJob } from '../../base';
import { DocWriter } from '../../core/doc';
import { ProjectResourceService } from '../../core/project';
import {
  PROJECT_DESTINATION_FOLDER_WORKFLOW,
  ProjectDestinationFolderService,
  ProjectPublicationService,
  ProjectWorkspaceImportService,
} from '../../core/project-transfer';
import { Models } from '../../models';
import { PROJECT_AGENT_WORKFLOW } from '../../models/copilot-project-agent-runtime';
import { PROJECT_PUBLICATION_WORKFLOW } from '../../models/project-publication';
import { PROJECT_WORKSPACE_IMPORT_WORKFLOW } from '../../models/project-workspace-import';
import { CopilotAgentRuntimeWorkflowRegistry } from './agent-runtime-workflow-registry';
import { projectTaskFailure } from './project-agent-runtime-error';
import { PROJECT_OFFICE_AGENT_WORKFLOW } from './project-office-agent-command';
import {
  executeProjectResourceRun,
  ProjectResourceCommandSchema,
} from './tools/project-doc';

declare global {
  interface Jobs {
    'copilot.projectAgentRuntime.run': { projectId?: string; runId?: string };
  }
}

@Injectable()
export class CopilotProjectAgentRuntimeWorker {
  private readonly logger = new Logger(CopilotProjectAgentRuntimeWorker.name);

  constructor(
    private readonly models: Models,
    resources: ProjectResourceService,
    publications: ProjectPublicationService,
    folders: ProjectDestinationFolderService,
    imports: ProjectWorkspaceImportService,
    private readonly writer: DocWriter,
    private readonly registry: CopilotAgentRuntimeWorkflowRegistry
  ) {
    registry.registerProject({
      workflow: PROJECT_WORKSPACE_IMPORT_WORKFLOW,
      capabilities: {
        version: 'agent-runtime-workflow-adapter-capabilities/v1',
        supportedStepTypes: ['approval', 'tool'],
        sideEffectMode: 'project_write',
        summary:
          'Import an independent Workspace copy after source permission approval.',
      },
      execute: run => imports.execute(run),
    });
    registry.registerProject({
      workflow: PROJECT_DESTINATION_FOLDER_WORKFLOW,
      capabilities: {
        version: 'agent-runtime-workflow-adapter-capabilities/v1',
        supportedStepTypes: ['tool'],
        sideEffectMode: 'workspace_write',
        summary:
          'Create the explicitly requested Workspace destination folder with its own durable receipt.',
      },
      execute: run => folders.execute(run),
    });
    registry.registerProject({
      workflow: PROJECT_PUBLICATION_WORKFLOW,
      capabilities: {
        version: 'agent-runtime-workflow-adapter-capabilities/v1',
        supportedStepTypes: ['approval', 'tool'],
        sideEffectMode: 'workspace_write',
        summary:
          'Publish a confirmed Project revision to its exact Workspace target with immutable receipts.',
      },
      execute: run => publications.execute(run),
    });
    registry.registerProject({
      workflow: PROJECT_AGENT_WORKFLOW,
      capabilities: {
        version: 'agent-runtime-workflow-adapter-capabilities/v1',
        supportedStepTypes: ['tool'],
        sideEffectMode: 'project_write',
        summary:
          'Persist internal Project resource operations through their native owner and immutable receipts.',
      },
      execute: run => executeProjectResourceRun(models, resources, run),
    });
  }

  @OnJob('copilot.projectAgentRuntime.run')
  async run(params: Jobs['copilot.projectAgentRuntime.run']) {
    await this.models.projectPublication.expire();
    const candidates =
      params.projectId && params.runId
        ? [{ projectId: params.projectId, id: params.runId }]
        : await this.models.copilotProjectAgentRuntime.pending(50);
    for (const candidate of candidates) {
      if (!candidate.projectId) continue;
      const workerLeaseId = `project-worker-${randomUUID()}`;
      const run = await this.models.copilotProjectAgentRuntime.acquire({
        projectId: candidate.projectId,
        runId: candidate.id,
        workerLeaseId,
      });
      if (!run) continue;
      const lease = {
        projectId: candidate.projectId,
        actorId: run.actorId,
        runId: run.id,
        workerLeaseId,
        workerAttempt: run.workerAttempt,
      };
      try {
        let resourceId: string | undefined;
        if (run.workflow === PROJECT_AGENT_WORKFLOW) {
          const command = ProjectResourceCommandSchema.parse(
            run.steps.find(step => step.stepKey === 'execute')?.input
          );
          const target =
            command.toolName === 'doc_update'
              ? command.arguments.doc_id
              : command.toolName === 'doc_update_meta'
                ? command.arguments.resource_id
                : undefined;
          if (typeof target === 'string') resourceId = target;
        } else if (run.workflow === PROJECT_OFFICE_AGENT_WORKFLOW) {
          const requestId = run.sourceId.slice('office:'.length);
          const request = await this.models.officeCommandRequest.get(
            { projectId: run.projectId },
            requestId
          );
          if (!request || request.requestedBy !== run.actorId)
            throw new Error('Project Office request is unavailable');
          resourceId = (
            await this.models.projectResource.assertOfficeResource({
              ...lease,
              artifactId: request.artifactId,
            })
          ).id;
        }
        if (resourceId) {
          const editing = await this.models.projectResourceEditLease.acquire({
            ...lease,
            resourceId,
            kind: 'ai_task',
            taskId: run.id,
            tabId: workerLeaseId,
          });
          if (!editing.acquired) {
            if (!editing.lease)
              throw new Error('Project edit lease changed during acquisition');
            await this.models.copilotProjectAgentRuntime.waitForEditLease({
              ...lease,
              resourceId,
              leaseId: editing.lease.leaseId,
            });
            continue;
          }
        }
        const adapter = this.registry.getProject(run.workflow);
        if (!adapter) throw new Error('Project task adapter is unavailable');
        let execute = (leased: typeof run) => adapter.execute(leased);
        if (adapter.prepare) {
          let stopped = false;
          let heartbeat: Promise<void> | undefined;
          let abort: (error: Error) => void = () => {};
          const interrupted = new Promise<never>((_, reject) => {
            abort = reject;
          });
          const deadline = setTimeout(() => {
            stopped = true;
            abort(new Error('Project task preparation timed out'));
          }, 300000);
          const timer = setInterval(() => {
            if (stopped || heartbeat) return;
            heartbeat = this.models.copilotProjectAgentRuntime
              .renew(lease)
              .then(active => {
                if (!active) throw new Error('Project task was cancelled');
              })
              .catch(() => {
                stopped = true;
                abort(new Error('Project task lease is no longer active'));
              })
              .finally(() => {
                heartbeat = undefined;
              });
          }, 20000);
          try {
            execute = await Promise.race([adapter.prepare(run), interrupted]);
          } finally {
            stopped = true;
            clearInterval(timer);
            clearTimeout(deadline);
            await heartbeat;
          }
          if (!(await this.models.copilotProjectAgentRuntime.renew(lease)))
            continue;
        }
        await this.writer.withDeferredBroadcasts(() =>
          this.models.copilotProjectAgentRuntime.execute(lease, leased =>
            execute(leased)
          )
        );
      } catch (error) {
        // Persist bounded failure evidence without copying resource bodies or provider errors.
        const failure = projectTaskFailure(error);
        this.logger.warn({
          message: 'Project task execution failed',
          runId: run.id,
          workflow: run.workflow,
          ...failure.diagnostic,
        });
        await this.models.copilotProjectAgentRuntime.fail(
          lease,
          failure.code,
          failure.message
        );
      } finally {
        await this.models.projectResourceEditLease.releaseTask(lease);
      }
    }
    return JOB_SIGNAL.Done;
  }
}
