import { parseOfficeCommand, parseOfficeCommandBatch } from '@localmind/office';
import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

import { BadRequest } from '../../base';
import { OfficeCommandService, officeFingerprint } from '../../core/office';
import { ProjectBlobStorage } from '../../core/project';
import {
  Models,
  OFFICE_COMMAND_BLOB_MIME,
  OFFICE_COMMAND_MAX_BYTES,
} from '../../models';
import type { ProjectAgentRun } from '../../models/copilot-project-agent-runtime';
import type { ProjectActor } from '../../models/project-resource';
import { CopilotAgentRuntimeWorkflowRegistry } from './agent-runtime-workflow-registry';
import {
  OfficeAgentCommandService,
  type OfficeAiReadSelector,
} from './office-agent-command';

export const PROJECT_OFFICE_AGENT_WORKFLOW =
  'agent_runtime_project_office_command';
const payloadSchema = z
  .object({
    version: z.literal(1),
    requestId: z.string().min(1).max(512),
    preview: z.record(z.unknown()),
  })
  .strict();

@Injectable()
export class ProjectOfficeAgentCommandService {
  constructor(
    private readonly models: Models,
    private readonly blobs: ProjectBlobStorage,
    private readonly commands: OfficeCommandService,
    private readonly office: OfficeAgentCommandService
  ) {}

  private async authorize(input: ProjectActor & { sessionId: string }) {
    const session = await this.models.copilotSession.getMeta(input.sessionId);
    if (
      !session ||
      session.userId !== input.actorId ||
      session.workspaceId ||
      session.docId ||
      session.selectedContextProjectId !== input.projectId
    )
      throw new BadRequest(
        'Project Office conversation does not match its resource owner'
      );
    await this.models.projectResource.assertMember(input);
  }

  async read(
    input: ProjectActor & {
      sessionId: string;
      artifactId: string;
      revisionId?: string;
      selector?: OfficeAiReadSelector;
    }
  ) {
    await this.authorize(input);
    const result = await this.office.readStateForAi(input);
    await this.models.copilotContext.recordInputSources({
      ...input,
      sources: [
        {
          workspaceId: null,
          kind: 'project_resource',
          sourceId: `${input.artifactId}@${result.sequence}`,
        },
      ],
    });
    return result;
  }

  @Transactional()
  async request(
    input: ProjectActor & {
      sessionId: string;
      command?: unknown;
      batch?: unknown;
      title?: string;
      readProof: { artifactId: string; revisionId: string } | null;
    }
  ) {
    await this.authorize(input);
    if (!(env.dev || env.selfhosted || env.namespaces.canary))
      throw new BadRequest('Document write tools are disabled');
    const payload =
      input.batch !== undefined
        ? {
            kind: 'batch' as const,
            value: parseOfficeCommandBatch(input.batch),
          }
        : {
            kind: 'command' as const,
            value: parseOfficeCommand(input.command),
          };
    const value = payload.value;
    if (value.source !== 'ai')
      throw new BadRequest('Project Office AI commands require source=ai');
    if (
      input.readProof?.artifactId !== value.artifactId ||
      input.readProof.revisionId !== value.expectedRevisionId
    )
      throw new BadRequest(
        'Read the current Project Office revision before requesting an edit'
      );
    return this.models.copilotContext.withProjectSourcesShared(
      {
        ...input,
        sink: {
          type: 'tool_write',
          projectId: input.projectId,
          id: value.artifactId,
          phase: 'prepare',
        },
      },
      async () => {
        const bytes = Buffer.from(JSON.stringify(value));
        if (bytes.length > OFFICE_COMMAND_MAX_BYTES)
          throw new BadRequest('Project Office command exceeds its byte limit');
        const commandFingerprint = officeFingerprint(bytes);
        const previous = await this.models.officeCommandRequest.getByKey(
          { projectId: input.projectId },
          value.artifactId,
          value.idempotencyKey
        );
        if (
          previous &&
          (previous.requestedBy !== input.actorId ||
            previous.commandFingerprint !== commandFingerprint)
        )
          throw new BadRequest(
            'Project Office command request was reused with different input'
          );
        let request = previous;
        if (!request) {
          const preview =
            payload.kind === 'command'
              ? await this.commands.preview({
                  ...input,
                  command: payload.value,
                })
              : await this.commands.previewBatch({
                  ...input,
                  batch: payload.value,
                });
          const blob = await this.blobs.put({
            ...input,
            bytes,
            mimeType: OFFICE_COMMAND_BLOB_MIME,
          });
          request = (
            await this.models.officeCommandRequest.createOrReuse({
              ...input,
              artifactId: value.artifactId,
              expectedRevisionId: value.expectedRevisionId,
              idempotencyKey: value.idempotencyKey,
              commandBlobKey: blob.key,
              commandByteSize: bytes.length,
              commandFingerprint,
              previewPackageFingerprint: preview.packageFingerprint,
              previewStateFingerprint: preview.stateFingerprint,
              previewSummary: JSON.parse(
                JSON.stringify({
                  artifactId: value.artifactId,
                  artifactTitle: preview.artifact.title,
                  artifactKind: preview.artifact.kind,
                  expectedRevisionId: value.expectedRevisionId,
                  revisionSequence: preview.revision.sequence,
                  reason: 'reason' in value ? value.reason : null,
                  summary: preview.summary,
                  operation:
                    payload.kind === 'command'
                      ? payload.value.operation
                      : 'office.command.batch',
                  commandCount:
                    payload.kind === 'command'
                      ? 1
                      : payload.value.commands.length,
                })
              ) as Prisma.InputJsonObject,
            })
          ).request;
        }
        const run = await this.models.copilotProjectAgentRuntime.prepare({
          ...input,
          workflow: PROJECT_OFFICE_AGENT_WORKFLOW,
          sourceType: 'project_resource',
          requestKey: `office:${request.id}`,
          title: input.title ?? 'Approve Project Office changes',
          status: 'waiting_approval',
          command: {
            version: 1,
            requestId: request.id,
            preview: request.previewSummary as Prisma.InputJsonObject,
          },
        });
        return {
          success: true,
          approvalRequired: run.status === 'waiting_approval',
          taskId: run.id,
          taskStatus: run.status,
          projectId: input.projectId,
          requestId: request.id,
          artifactId: value.artifactId,
          expectedRevisionId: value.expectedRevisionId,
          commandFingerprint,
          previewPackageFingerprint: request.previewPackageFingerprint,
          previewStateFingerprint: request.previewStateFingerprint,
          previewSummary: request.previewSummary,
        };
      }
    );
  }

  async execute(run: ProjectAgentRun): Promise<Prisma.InputJsonObject> {
    if (!run.sessionId || run.workflow !== PROJECT_OFFICE_AGENT_WORKFLOW)
      throw new BadRequest('Project Office task identity is invalid');
    if (!(env.dev || env.selfhosted || env.namespaces.canary))
      throw new BadRequest('Document write tools are disabled');
    const scope = {
      projectId: run.projectId,
      actorId: run.actorId,
      sessionId: run.sessionId,
    };
    await this.authorize(scope);
    const reference = payloadSchema.parse(
      run.steps.find(step => step.stepKey === 'execute')?.input
    );
    if (
      run.sourceId !== `office:${reference.requestId}` ||
      !run.steps.some(
        step => step.stepType === 'approval' && step.status === 'completed'
      )
    )
      throw new BadRequest('Project Office task approval is missing');
    const request = await this.models.officeCommandRequest.get(
      { projectId: run.projectId },
      reference.requestId
    );
    if (!request || request.requestedBy !== run.actorId)
      throw new BadRequest('Project Office command request is unavailable');
    const { bytes, blob } = await this.blobs.read({
      ...scope,
      key: request.commandBlobKey,
    });
    if (
      blob.mimeType !== OFFICE_COMMAND_BLOB_MIME ||
      bytes.length !== request.commandByteSize ||
      officeFingerprint(bytes) !== request.commandFingerprint
    )
      throw new BadRequest('Project Office command evidence changed');
    const json: unknown = JSON.parse(bytes.toString());
    const batch =
      !!json &&
      typeof json === 'object' &&
      'version' in json &&
      json.version === 'localmind-office-command-batch/v1';
    const value = batch
      ? parseOfficeCommandBatch(json)
      : parseOfficeCommand(json);
    if (
      value.source !== 'ai' ||
      value.artifactId !== request.artifactId ||
      value.expectedRevisionId !== request.expectedRevisionId ||
      value.idempotencyKey !== request.idempotencyKey
    )
      throw new BadRequest('Project Office command identity changed');
    const preview = batch
      ? await this.commands.previewBatch({ ...scope, batch: value })
      : await this.commands.preview({ ...scope, command: value });
    if (
      preview.packageFingerprint !== request.previewPackageFingerprint ||
      preview.stateFingerprint !== request.previewStateFingerprint
    )
      throw new BadRequest(
        'Project Office preview changed; create a new request'
      );
    const result = batch
      ? await this.commands.executeBatch({
          ...scope,
          sourceSessionId: run.sessionId,
          batch: value,
        })
      : await this.commands.execute({
          ...scope,
          sourceSessionId: run.sessionId,
          command: value,
        });
    return {
      status: 'saved',
      owner: { kind: 'project', projectId: run.projectId },
      sideEffectKind: 'office_revision',
      sideEffectRecordId: result.revision.id,
      artifactId: result.revision.artifactId,
      revisionId: result.revision.id,
      sequence: result.revision.sequence,
      requestId: request.id,
      packageFingerprint: result.packageFingerprint,
      stateFingerprint: result.stateFingerprint,
    };
  }
}

@Injectable()
export class ProjectOfficeAgentCommandAdapter {
  constructor(
    service: ProjectOfficeAgentCommandService,
    registry: CopilotAgentRuntimeWorkflowRegistry
  ) {
    registry.registerProject({
      workflow: PROJECT_OFFICE_AGENT_WORKFLOW,
      capabilities: {
        version: 'agent-runtime-workflow-adapter-capabilities/v1',
        supportedStepTypes: ['approval', 'tool'],
        sideEffectMode: 'project_write',
        summary:
          'Execute explicitly approved native Project Office commands with immutable revision and preview evidence.',
      },
      execute: run => service.execute(run),
    });
  }
}
