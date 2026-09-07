import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { JOB_SIGNAL, OnJob } from '../../base';
import { DocWriter } from '../../core/doc';
import { ProjectResourceService } from '../../core/project';
import {
  PROJECT_DESTINATION_FOLDER_WORKFLOW,
  ProjectDestinationFolderService,
  ProjectPublicationConflict,
  ProjectPublicationService,
} from '../../core/project-transfer';
import { Models } from '../../models';
import { PROJECT_AGENT_WORKFLOW } from '../../models/copilot-project-agent-runtime';
import { PROJECT_PUBLICATION_WORKFLOW } from '../../models/project-publication';
import { CopilotAgentRuntimeWorkflowRegistry } from './agent-runtime-workflow-registry';
import { executeProjectResourceRun } from './tools/project-resources';

declare global {
  interface Jobs {
    'copilot.projectAgentRuntime.run': { projectId?: string; runId?: string };
  }
}

@Injectable()
export class CopilotProjectAgentRuntimeWorker {
  constructor(
    private readonly models: Models,
    resources: ProjectResourceService,
    publications: ProjectPublicationService,
    folders: ProjectDestinationFolderService,
    private readonly writer: DocWriter,
    private readonly registry: CopilotAgentRuntimeWorkflowRegistry
  ) {
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
        const adapter = this.registry.getProject(run.workflow);
        if (!adapter) throw new Error('Project task adapter is unavailable');
        await this.writer.withDeferredBroadcasts(() =>
          this.models.copilotProjectAgentRuntime.execute(lease, leased =>
            adapter.execute(leased)
          )
        );
      } catch (error) {
        // Persist bounded failure evidence without copying resource bodies or provider errors.
        await this.models.copilotProjectAgentRuntime.fail(
          lease,
          error instanceof ProjectPublicationConflict
            ? 'publication_conflict'
            : 'project_operation_failed',
          error instanceof ProjectPublicationConflict
            ? error.message
            : 'Project operation could not execute; review membership, resource versions and tool availability'
        );
      }
    }
    return JOB_SIGNAL.Done;
  }
}
