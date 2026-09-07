import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { BadRequest } from '../base';
import { BaseModel } from './base';
import type { ProjectActor } from './project-resource';

const id = z.string().min(1).max(256);
export const ProjectChatContextItemsSchema = z
  .array(
    z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('resource'),
          resourceId: id,
          sequence: z.number().int().positive(),
        })
        .strict(),
      z
        .object({
          kind: z.literal('blob'),
          blobKey: id,
          name: z.string().trim().min(1).max(512),
        })
        .strict(),
    ])
  )
  .max(16);
export type ProjectChatContextItem = z.infer<
  typeof ProjectChatContextItemsSchema
>[number];
export const ProjectChatContextSnapshotSchema = z
  .object({
    version: z.literal('localmind-project-chat-context/v1'),
    projectId: id,
    contextVersion: z.number().int().nonnegative(),
    items: ProjectChatContextItemsSchema,
  })
  .strict();

@Injectable()
export class CopilotProjectContextModel extends BaseModel {
  private async authorize(
    input: ProjectActor & { sessionId: string },
    write = false
  ) {
    await this.models.projectResource.assertMember(input);
    const sessions = await this.db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM ai_sessions_metadata WHERE id = ${input.sessionId} AND user_id = ${input.actorId}
        AND selected_context_project_id = ${input.projectId} AND workspace_id IS NULL AND doc_id IS NULL AND deleted_at IS NULL
      ${write ? Prisma.sql`FOR UPDATE` : Prisma.sql`FOR SHARE`}
    `);
    if (!sessions.length)
      throw new BadRequest('Project context conversation is unavailable');
  }

  @Transactional()
  async get(input: ProjectActor & { sessionId: string }) {
    await this.authorize(input);
    const context = await this.db.projectChatContext.findUnique({
      where: { sessionId: input.sessionId },
    });
    if (context && context.projectId !== input.projectId)
      throw new BadRequest('Project context owner changed');
    return {
      projectId: input.projectId,
      sessionId: input.sessionId,
      version: context?.version ?? 0,
      items: ProjectChatContextItemsSchema.parse(context?.items ?? []),
    };
  }

  @Transactional()
  async set(
    input: ProjectActor & {
      sessionId: string;
      expectedVersion: number;
      items: unknown;
    }
  ) {
    await this.authorize(input, true);
    const current = await this.get(input);
    const items = ProjectChatContextItemsSchema.parse(input.items);
    if (
      new Set(
        items.map(item =>
          item.kind === 'resource'
            ? `resource:${item.resourceId}`
            : `blob:${item.blobKey}`
        )
      ).size !== items.length
    )
      throw new BadRequest('Project context contains duplicate items');
    if (current.version !== input.expectedVersion)
      throw new BadRequest('Project context changed; reload before updating');
    let attachmentBytes = 0;
    for (const item of items) {
      const detail = await this.describe(input, item);
      attachmentBytes += detail.byteSize ?? 0;
    }
    if (attachmentBytes > 50 * 1024 * 1024)
      throw new BadRequest(
        'Project context attachments exceed their total size limit'
      );
    if (current.version)
      await this.db.projectChatContext.update({
        where: { sessionId: input.sessionId, version: input.expectedVersion },
        data: { items, version: { increment: 1 } },
      });
    else
      await this.db.projectChatContext.create({
        data: { sessionId: input.sessionId, projectId: input.projectId, items },
      });
    return this.get(input);
  }

  @Transactional()
  async describe(input: ProjectActor, item: ProjectChatContextItem) {
    if (item.kind === 'blob') {
      const blob = await this.models.projectResource.getBlob({
        ...input,
        key: item.blobKey,
      });
      if (blob.byteSize > 50 * 1024 * 1024)
        throw new BadRequest('Project attachment exceeds its size limit');
      return {
        ...item,
        title: item.name,
        mimeType: blob.mimeType,
        byteSize: blob.byteSize,
        currentSequence: null,
        resourceKind: 'file',
      };
    }
    const resource = await this.models.projectResource.get({
      ...input,
      resourceId: item.resourceId,
    });
    if (resource.kind === 'folder')
      throw new BadRequest('Choose a Project document or file');
    let currentSequence = resource.contentVersion;
    if (resource.officeArtifactId) {
      const office = await this.models.officeArtifact.get(
        { projectId: input.projectId },
        resource.officeArtifactId
      );
      const revision = await this.db.officeRevision.findFirst({
        where: {
          projectId: input.projectId,
          artifactId: resource.officeArtifactId,
          sequence: item.sequence,
        },
      });
      if (!office || !revision)
        throw new BadRequest('Project Office context revision is unavailable');
      currentSequence = office.revisionCounter;
    } else
      await this.models.projectResource.revision({
        ...input,
        resourceId: resource.id,
        sequence: item.sequence,
      });
    return {
      ...item,
      title: resource.title,
      resourceKind: resource.kind,
      currentSequence,
      mimeType: null,
      byteSize: null,
    };
  }

  @Transactional()
  async snapshot(input: ProjectActor & { sessionId: string }) {
    const context = await this.get(input);
    for (const item of context.items) await this.describe(input, item);
    await this.recordSources(input, context.items);
    return ProjectChatContextSnapshotSchema.parse({
      version: 'localmind-project-chat-context/v1',
      projectId: input.projectId,
      contextVersion: context.version,
      items: context.items,
    });
  }

  @Transactional()
  async validateSnapshot(
    input: ProjectActor & { sessionId: string; snapshot: unknown }
  ) {
    await this.authorize(input);
    const snapshot = ProjectChatContextSnapshotSchema.parse(input.snapshot);
    if (snapshot.projectId !== input.projectId)
      throw new BadRequest(
        'Project context snapshot belongs to another Project'
      );
    for (const item of snapshot.items) await this.describe(input, item);
    await this.recordSources(input, snapshot.items);
    return snapshot;
  }

  private recordSources(
    input: ProjectActor & { sessionId: string },
    items: ProjectChatContextItem[]
  ) {
    return this.models.copilotContext.recordInputSources({
      ...input,
      sources: items.map(item => ({
        workspaceId: null,
        kind:
          item.kind === 'resource'
            ? ('project_resource' as const)
            : ('project_blob' as const),
        sourceId:
          item.kind === 'resource'
            ? `${item.resourceId}@${item.sequence}`
            : item.blobKey,
      })),
    });
  }
}
