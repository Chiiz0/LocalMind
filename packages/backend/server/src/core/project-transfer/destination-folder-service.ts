import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { generateKeyBetween } from 'fractional-indexing';
import { z } from 'zod';

import { BadRequest } from '../../base';
import { Models } from '../../models';
import type { ProjectAgentRun } from '../../models/copilot-project-agent-runtime';
import {
  type ProjectActor,
  projectResourceHash,
} from '../../models/project-resource';
import {
  DocumentDestinationService,
  DocWriter,
  WorkspaceOrganizationService,
} from '../doc';
import { ProjectPublicationConflict } from './publication-service';

export const PROJECT_DESTINATION_FOLDER_WORKFLOW =
  'agent_runtime_project_destination_folder';
const commandSchema = z
  .object({
    version: z.literal('project-destination-folder/v1'),
    publicationId: z.string().uuid(),
    workspaceId: z.string().min(1).max(256),
    parentId: z.string().min(1).max(256).nullable(),
    folderId: z.string().uuid(),
    title: z.string().min(1).max(512),
    directoryRevision: z.string().length(64),
    directoryFingerprint: z.string().length(64),
    permissionFingerprint: z.string().length(64),
    requestHash: z.string().length(64),
    expiresAt: z.string().datetime(),
  })
  .strict();

@Injectable()
export class ProjectDestinationFolderService {
  constructor(
    private readonly models: Models,
    private readonly destinations: DocumentDestinationService,
    private readonly organization: WorkspaceOrganizationService,
    private readonly writer: DocWriter
  ) {}

  @Transactional()
  async prepare(
    input: ProjectActor & {
      publicationId: string;
      workspaceId: string;
      parentId: string | null;
      title: string;
      expectedDirectoryRevision: string;
      requestKey: string;
    }
  ) {
    const publication = await this.models.projectPublication.lock(input);
    const title = input.title.trim().normalize('NFC');
    if (
      !title ||
      title.length > 512 ||
      title.includes('/') ||
      title.includes('\\') ||
      [...title].some(character => character.charCodeAt(0) < 32) ||
      ['.', '..'].includes(title) ||
      !input.requestKey.trim() ||
      input.requestKey.length > 256
    )
      throw new BadRequest('Invalid destination folder request');
    const requestKey = `publication-folder:${projectResourceHash([input.actorId, input.publicationId, input.requestKey])}`;
    const requestHash = projectResourceHash({
      workspaceId: input.workspaceId,
      parentId: input.parentId,
      title,
      revision: input.expectedDirectoryRevision,
    });
    const previous = await this.models.copilotProjectAgentRuntime.findRequest({
      ...input,
      requestKey,
      sourceType: 'project_publication',
    });
    if (previous) {
      const command = commandSchema.parse(
        previous.steps.find(step => step.stepKey === 'execute')?.input
      );
      if (command.requestHash !== requestHash)
        throw new BadRequest('Folder request was reused with different input');
      return previous;
    }
    if (
      publication.status !== 'waiting_for_location' ||
      publication.expiresAt <= new Date()
    )
      throw new BadRequest('Publication is not waiting for a location');
    const folderId = randomUUID();
    return this.models.projectPublication.withTargetLock(
      { workspaceId: input.workspaceId, resourceId: folderId },
      async () => {
        const destination = await this.destinations.authorize({
          ...input,
          folderId: input.parentId,
          createFolder: true,
        });
        const revision = await this.organization.directoryRevision(
          input.workspaceId,
          input.actorId
        );
        if (revision !== input.expectedDirectoryRevision)
          throw new ProjectPublicationConflict();
        const permissions =
          await this.models.projectPublication.targetPermissions({
            workspaceId: input.workspaceId,
            resourceId: null,
            directoryIds: destination.path.map(item => item.id),
          });
        return this.models.copilotProjectAgentRuntime.prepare({
          ...input,
          requestKey,
          sessionId: publication.sessionId ?? undefined,
          sourceType: 'project_publication',
          workflow: PROJECT_DESTINATION_FOLDER_WORKFLOW,
          title: `Create folder: ${title}`,
          command: {
            version: 'project-destination-folder/v1',
            publicationId: input.publicationId,
            workspaceId: input.workspaceId,
            parentId: input.parentId,
            folderId,
            title,
            directoryRevision: revision,
            directoryFingerprint: destination.fingerprint,
            permissionFingerprint: permissions.fingerprint,
            requestHash,
            expiresAt: publication.expiresAt.toISOString(),
          },
        });
      }
    );
  }

  async runPrepared(run: ProjectAgentRun) {
    if (run.status !== 'queued') return run;
    const workerLeaseId = `project-folder-${randomUUID()}`;
    const leased = await this.models.copilotProjectAgentRuntime.acquire({
      projectId: run.projectId,
      runId: run.id,
      workerLeaseId,
    });
    if (!leased)
      return this.models.copilotProjectAgentRuntime.get({
        projectId: run.projectId,
        actorId: run.actorId,
        runId: run.id,
      });
    const lease = {
      projectId: run.projectId,
      actorId: run.actorId,
      runId: run.id,
      workerLeaseId,
      workerAttempt: leased.workerAttempt,
    };
    try {
      await this.writer.withDeferredBroadcasts(() =>
        this.models.copilotProjectAgentRuntime.execute(lease, current =>
          this.execute(current)
        )
      );
    } catch (error) {
      await this.models.copilotProjectAgentRuntime.fail(
        lease,
        error instanceof ProjectPublicationConflict
          ? 'publication_conflict'
          : 'destination_folder_failed',
        'Folder could not be created; reload the destination and review permissions'
      );
    }
    return this.models.copilotProjectAgentRuntime.get(lease);
  }

  async execute(run: ProjectAgentRun) {
    const command = commandSchema.parse(
      run.steps.find(step => step.stepKey === 'execute')?.input
    );
    const actor = { projectId: run.projectId, actorId: run.actorId };
    await this.models.projectPublication.get({
      ...actor,
      publicationId: command.publicationId,
    });
    if (command.expiresAt <= new Date().toISOString())
      throw new BadRequest('Folder request expired');
    return this.models.projectPublication.withTargetLock(
      { workspaceId: command.workspaceId, resourceId: command.folderId },
      async () => {
        const destination = await this.destinations.authorize({
          actorId: run.actorId,
          workspaceId: command.workspaceId,
          folderId: command.parentId,
          createFolder: true,
        });
        const permissions =
          await this.models.projectPublication.targetPermissions({
            workspaceId: command.workspaceId,
            resourceId: null,
            directoryIds: destination.path.map(item => item.id),
          });
        if (
          destination.fingerprint !== command.directoryFingerprint ||
          permissions.fingerprint !== command.permissionFingerprint
        )
          throw new ProjectPublicationConflict();
        const rows = await this.organization.readFolders(
          command.workspaceId,
          run.actorId
        );
        if (
          rows.some(
            row =>
              row.type === 'folder' &&
              (row.parentId ?? null) === command.parentId &&
              String(row.data).normalize('NFC').toLocaleLowerCase() ===
                command.title.toLocaleLowerCase()
          )
        )
          throw new BadRequest(
            'A folder with this name already exists at the selected location'
          );
        const indices = rows
          .filter(row => (row.parentId ?? null) === command.parentId)
          .map(row => row.index)
          .filter((value): value is string => typeof value === 'string')
          .sort();
        const result = await this.organization.applyConditionalFolderOperations(
          {
            workspaceId: command.workspaceId,
            actorId: run.actorId,
            expectedRevision: command.directoryRevision,
            authorizeDocument: async () => {
              throw new BadRequest('Folder request cannot write documents');
            },
            operations: [
              {
                op: 'upsert',
                key: command.folderId,
                values: {
                  type: 'folder',
                  data: command.title,
                  parentId: command.parentId,
                  index: generateKeyBetween(indices.at(-1) ?? null, null),
                },
              },
            ],
          }
        );
        return {
          version: 'project-destination-folder-receipt/v1',
          publicationId: command.publicationId,
          workspaceId: command.workspaceId,
          folderId: command.folderId,
          parentId: command.parentId,
          title: command.title,
          directoryRevision: result.revision,
        };
      }
    );
  }
}
