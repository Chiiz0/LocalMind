import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Prisma, type ProjectPublication } from '@prisma/client';
import { z } from 'zod';

import { BadRequest } from '../base';
import { BaseModel } from './base';
import {
  permissionDocumentLockKey,
  permissionWorkspaceLockKey,
} from './permission-write';
import { type ProjectActor, projectResourceHash } from './project-resource';

export const PROJECT_PUBLICATION_WORKFLOW = 'agent_runtime_project_publication';
export const publicationTargetSchema = z
  .object({
    workspaceId: z.string().min(1).max(256),
    folderId: z.string().min(1).max(256).nullable(),
    resourceId: z.string().min(1).max(256),
    folderFingerprint: z.string().length(64),
    expectedVersion: z.string().min(1).max(512).nullable(),
    permissionFingerprint: z.string().length(64),
  })
  .strict();
export type PublicationTarget = z.infer<typeof publicationTargetSchema>;

const cursorSchema = z
  .object({
    projectId: z.string(),
    actorId: z.string(),
    resourceId: z.string().nullable(),
    id: z.string(),
    createdAt: z.string().datetime(),
  })
  .strict();

@Injectable()
export class ProjectPublicationModel extends BaseModel {
  @Transactional()
  async prepare(
    input: ProjectActor & {
      resourceId: string;
      sessionId?: string;
      kind: 'publish' | 'update';
      requestKey: string;
    }
  ) {
    await this.models.projectResource.assertMember(input, true);
    if (
      !input.requestKey.trim() ||
      input.requestKey.length > 256 ||
      !['publish', 'update'].includes(input.kind)
    )
      throw new BadRequest('Invalid publication request');
    if (input.sessionId) {
      const session = await this.db.aiSession.findUnique({
        where: { id: input.sessionId },
      });
      if (
        !session ||
        session.userId !== input.actorId ||
        session.workspaceId ||
        session.deletedAt ||
        session.selectedContextProjectId !== input.projectId
      )
        throw new BadRequest('Publication conversation is unavailable');
    }
    const requestFingerprint = projectResourceHash({
      resourceId: input.resourceId,
      sessionId: input.sessionId ?? null,
      kind: input.kind,
    });
    const previous = await this.db.projectPublication.findUnique({
      where: {
        projectId_actorId_requestKey: {
          projectId: input.projectId,
          actorId: input.actorId,
          requestKey: input.requestKey,
        },
      },
    });
    if (previous) {
      if (previous.requestFingerprint !== requestFingerprint)
        throw new BadRequest(
          'Publication request was reused with different input'
        );
      return previous;
    }
    const source = await this.source(input);
    const now = new Date();
    const record = await this.db.projectPublication.create({
      data: {
        id: randomUUID(),
        projectId: input.projectId,
        resourceId: input.resourceId,
        actorId: input.actorId,
        sessionId: input.sessionId,
        kind: input.kind,
        requestKey: input.requestKey,
        requestFingerprint,
        sourceSequence: source.sequence,
        sourceResourceVersion: source.resource.version,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      },
    });
    await this.audit(record, 'prepared');
    return record;
  }

  async source(input: ProjectActor & { resourceId: string }) {
    const resource = await this.models.projectResource.get(input);
    if (resource.kind === 'folder')
      throw new BadRequest('Choose a saved resource to publish');
    const office = resource.officeArtifactId
      ? await this.models.officeArtifact.get(
          { projectId: input.projectId },
          resource.officeArtifactId
        )
      : null;
    const sequence = office?.revisionCounter ?? resource.contentVersion;
    if (sequence < 1)
      throw new BadRequest('Save the Project resource before publishing');
    return { resource, sequence, office };
  }

  @Transactional()
  async withTargetLock<T>(
    input: { workspaceId: string; resourceId: string },
    operation: () => Promise<T>
  ) {
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${permissionWorkspaceLockKey(input.workspaceId)}, 0))`;
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${permissionDocumentLockKey(input.workspaceId, input.resourceId)}, 0))`;
    return this.models.workspaceDirectoryGrant.withMutationLock(
      input.workspaceId,
      operation
    );
  }

  async targetPermissions(input: {
    workspaceId: string;
    resourceId: string | null;
    directoryIds: string[];
  }) {
    const { workspaceId, resourceId } = input;
    const members = await this.db.workspaceMember.findMany({
      where: { workspaceId, state: 'active' },
      orderBy: { userId: 'asc' },
      select: { userId: true, role: true },
      take: 20001,
    });
    const directories = await this.db.workspaceDirectoryGrant.findMany({
      where: {
        workspaceId,
        directoryId: { in: ['$root', ...input.directoryIds] },
      },
      orderBy: [{ directoryId: 'asc' }, { principalId: 'asc' }],
      take: 20001,
    });
    const grants = resourceId
      ? await this.db.docGrant.findMany({
          where: { workspaceId, docId: resourceId },
          orderBy: [{ principalType: 'asc' }, { principalId: 'asc' }],
          take: 20001,
        })
      : [];
    if ([members, directories, grants].some(rows => rows.length > 20000))
      throw new BadRequest('Publication audience exceeds its evidence limit');
    const workspace = await this.db.workspaceAccessPolicy.findUnique({
      where: { workspaceId },
    });
    const document = resourceId
      ? await this.db.docAccessPolicy.findUnique({
          where: { workspaceId_docId: { workspaceId, docId: resourceId } },
        })
      : null;
    return {
      fingerprint: projectResourceHash({
        members,
        directories,
        grants,
        workspace,
        document,
      }),
      memberCount: members.length,
      grantCount: grants.length,
      visibility: document?.visibility ?? workspace?.visibility ?? 'private',
    };
  }

  async workspaceCandidates(input: {
    workspaceId: string;
    after?: string;
    query: string;
    kind: string;
  }) {
    if (
      input.kind === 'page' ||
      input.kind === 'edgeless' ||
      input.kind === 'file'
    ) {
      // Older documents can exist without workspace_pages metadata.
      const rows = await this.db.$queryRaw<
        { resourceId: string; title: string | null }[]
      >`
        SELECT d.id AS "resourceId", p.title
        FROM (
          SELECT guid AS id FROM snapshots WHERE workspace_id = ${input.workspaceId}
          UNION
          SELECT guid AS id FROM updates WHERE workspace_id = ${input.workspaceId}
        ) d
        LEFT JOIN workspace_pages p
          ON p.workspace_id = ${input.workspaceId} AND p.page_id = d.id
        WHERE d.id > ${input.after ?? ''} AND d.id <> ${input.workspaceId}
          AND left(d.id, 3) <> 'db$'
          AND COALESCE(p.mode, 0) = ${input.kind === 'edgeless' ? 1 : 0}
          AND NOT COALESCE(p.blocked, false)
          AND (${input.query} = '' OR p.title IS NULL
            OR strpos(lower(p.title), lower(${input.query})) > 0
            OR strpos(lower(d.id), lower(${input.query})) > 0)
        ORDER BY d.id ASC LIMIT 101
      `;
      return rows.map(row => ({ ...row, kind: input.kind }));
    }
    if (!['document', 'workbook', 'presentation', 'pdf'].includes(input.kind))
      throw new BadRequest('Unsupported publication target type');
    const rows = await this.db.officeArtifact.findMany({
      where: {
        workspaceId: input.workspaceId,
        id: { gt: input.after },
        kind: input.kind as 'document' | 'workbook' | 'presentation' | 'pdf',
        ...(input.query
          ? { title: { contains: input.query, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { id: 'asc' },
      take: 101,
    });
    return rows.map(row => ({
      resourceId: row.id,
      title: row.title,
      kind: row.kind,
    }));
  }

  async get(input: ProjectActor & { publicationId: string }) {
    await this.models.projectResource.assertMember(input);
    const record = await this.db.projectPublication.findFirst({
      where: {
        id: input.publicationId,
        projectId: input.projectId,
        actorId: input.actorId,
      },
    });
    if (!record) throw new BadRequest('Publication request is unavailable');
    return record;
  }

  async forRun(input: ProjectActor & { runId: string }) {
    await this.models.projectResource.assertMember(input);
    return this.db.projectPublication.findFirst({
      where: {
        projectId: input.projectId,
        actorId: input.actorId,
        runId: input.runId,
      },
    });
  }

  async list(
    input: ProjectActor & {
      resourceId?: string;
      cursor?: string;
      limit?: number;
    }
  ) {
    await this.models.projectResource.assertMember(input);
    const limit = input.limit ?? 20;
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      (input.cursor?.length ?? 0) > 4096
    )
      throw new BadRequest('Invalid publication page');
    let cursor: z.infer<typeof cursorSchema> | null = null;
    if (input.cursor) {
      try {
        cursor = cursorSchema.parse(
          JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'))
        );
      } catch {
        throw new BadRequest('Invalid publication cursor');
      }
      if (
        cursor.projectId !== input.projectId ||
        cursor.actorId !== input.actorId ||
        cursor.resourceId !== (input.resourceId ?? null)
      )
        throw new BadRequest('Publication cursor belongs to another query');
    }
    const records = await this.db.projectPublication.findMany({
      where: {
        projectId: input.projectId,
        actorId: input.actorId,
        resourceId: input.resourceId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                {
                  createdAt: new Date(cursor.createdAt),
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const items = records.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        records.length > limit && last
          ? Buffer.from(
              JSON.stringify({
                projectId: input.projectId,
                actorId: input.actorId,
                resourceId: input.resourceId ?? null,
                id: last.id,
                createdAt: last.createdAt.toISOString(),
              })
            ).toString('base64url')
          : null,
    };
  }

  @Transactional()
  async lock(
    input: ProjectActor & { publicationId: string; expectedRevision?: number }
  ) {
    await this.models.projectResource.assertMember(input, true);
    await this.db
      .$queryRaw`SELECT id FROM project_publications WHERE id = ${input.publicationId} AND project_id = ${input.projectId} FOR UPDATE`;
    const record = await this.get(input);
    if (
      input.expectedRevision !== undefined &&
      record.revision !== input.expectedRevision
    )
      throw new BadRequest('Publication changed; reload before continuing');
    return record;
  }

  @Transactional()
  async setPreview(
    input: ProjectActor & {
      publicationId: string;
      expectedRevision: number;
      sourceSequence: number;
      sourceResourceVersion: number;
      target: PublicationTarget;
      preview: Prisma.InputJsonObject;
      runId: string;
    }
  ) {
    const record = await this.lock(input);
    if (record.status !== 'waiting_for_location')
      throw new BadRequest('Publication is not waiting for a location');
    if (record.expiresAt <= new Date())
      throw new BadRequest('Publication expired; prepare it again');
    const target = publicationTargetSchema.parse(input.target);
    const run = await this.models.copilotProjectAgentRuntime.get({
      ...input,
      runId: input.runId,
    });
    if (
      run.sourceType !== 'project_publication' ||
      run.status !== 'waiting_approval' ||
      run.sourceId !== `${record.id}:${record.revision}`
    )
      throw new BadRequest('Publication preview execution does not match');
    const next = await this.db.projectPublication.update({
      where: { id: record.id },
      data: {
        revision: { increment: 1 },
        status: 'waiting_for_confirmation',
        target,
        preview: input.preview,
        runId: input.runId,
        sourceSequence: input.sourceSequence,
        sourceResourceVersion: input.sourceResourceVersion,
      },
    });
    await this.audit(next, 'previewed');
    return next;
  }

  @Transactional()
  async submit(
    input: ProjectActor & {
      publicationId: string;
      expectedRevision: number;
      targetFingerprint: string;
    }
  ) {
    const record = await this.lock({ ...input, expectedRevision: undefined });
    if (!record.runId)
      throw new BadRequest('Choose a publication target first');
    const run = await this.models.copilotProjectAgentRuntime.get({
      ...input,
      runId: record.runId,
    });
    if (run.targetFingerprint !== input.targetFingerprint)
      throw new BadRequest('Publication confirmation changed');
    if (
      record.status === 'submitted' &&
      record.revision >= input.expectedRevision + 1
    )
      return record;
    if (
      record.revision !== input.expectedRevision ||
      record.status !== 'waiting_for_confirmation' ||
      record.expiresAt <= new Date()
    )
      throw new BadRequest('Publication confirmation is no longer current');
    await this.models.copilotProjectAgentRuntime.approve({
      ...input,
      runId: run.id,
    });
    const next = await this.db.projectPublication.update({
      where: { id: record.id },
      data: { revision: { increment: 1 }, status: 'submitted' },
    });
    await this.audit(next, 'confirmed');
    return next;
  }

  @Transactional()
  async cancel(
    input: ProjectActor & { publicationId: string; expectedRevision: number }
  ) {
    const record = await this.lock({ ...input, expectedRevision: undefined });
    if (record.status === 'cancelled' || record.status === 'expired')
      return record;
    if (record.revision !== input.expectedRevision)
      throw new BadRequest('Publication changed; reload before cancelling');
    if (record.runId) {
      const run = await this.models.copilotProjectAgentRuntime.cancel({
        ...input,
        runId: record.runId,
      });
      if (run.status === 'completed' || run.status === 'running') return record;
    }
    const next = await this.db.projectPublication.update({
      where: { id: record.id },
      data: { revision: { increment: 1 }, status: 'cancelled' },
    });
    await this.audit(next, 'cancelled');
    return next;
  }

  @Transactional()
  async reopen(
    input: ProjectActor & { publicationId: string; expectedRevision: number }
  ) {
    const record = await this.lock(input);
    if (record.runId) {
      const run = await this.models.copilotProjectAgentRuntime.get({
        ...input,
        runId: record.runId,
      });
      if (run.status === 'running' || run.status === 'completed')
        throw new BadRequest(
          'Running or completed publication cannot be replaced'
        );
      await this.models.copilotProjectAgentRuntime.cancel({
        ...input,
        runId: record.runId,
      });
    }
    const next = await this.db.projectPublication.update({
      where: { id: record.id },
      data: {
        revision: { increment: 1 },
        status: 'waiting_for_location',
        runId: null,
        target: Prisma.DbNull,
        preview: Prisma.DbNull,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await this.audit(next, 'reopened');
    return next;
  }

  @Transactional()
  async recordCompleted(
    input: ProjectActor & {
      publicationId: string;
      runId: string;
      targetVersion: string;
      receipt: Prisma.InputJsonObject;
    }
  ) {
    const record = await this.lock(input);
    if (
      record.status !== 'submitted' ||
      record.runId !== input.runId ||
      !record.target
    )
      throw new BadRequest('Publication no longer matches its execution');
    const target = publicationTargetSchema.parse(record.target);
    if (!input.targetVersion || input.targetVersion.length > 512)
      throw new BadRequest('Invalid publication result version');
    await this.db.projectPublicationTarget.upsert({
      where: {
        projectId_resourceId_workspaceId_targetResourceId: {
          projectId: input.projectId,
          resourceId: record.resourceId,
          workspaceId: target.workspaceId,
          targetResourceId: target.resourceId,
        },
      },
      create: {
        projectId: input.projectId,
        resourceId: record.resourceId,
        workspaceId: target.workspaceId,
        targetResourceId: target.resourceId,
        sourceSequence: record.sourceSequence,
        targetVersion: input.targetVersion,
        publicationId: record.id,
      },
      update: {
        sourceSequence: record.sourceSequence,
        targetVersion: input.targetVersion,
        publicationId: record.id,
      },
    });
    const next = await this.db.projectPublication.update({
      where: { id: record.id },
      data: { revision: { increment: 1 } },
    });
    await this.audit(next, 'completed', input.receipt);
    return next;
  }

  @Transactional()
  async expire(limit = 50) {
    const rows = await this.db.$queryRaw<
      ProjectPublication[]
    >`SELECT id FROM project_publications WHERE status IN ('waiting_for_location', 'waiting_for_confirmation') AND expires_at <= now() ORDER BY expires_at LIMIT ${Math.min(100, Math.max(1, limit))} FOR UPDATE SKIP LOCKED`;
    for (const row of rows) {
      const next = await this.db.projectPublication.update({
        where: { id: row.id },
        data: { status: 'expired', revision: { increment: 1 } },
      });
      await this.audit(next, 'expired');
    }
    return rows.length;
  }

  async targets(input: ProjectActor & { resourceId: string }) {
    await this.models.projectResource.get(input);
    return this.db.projectPublicationTarget.findMany({
      where: { projectId: input.projectId, resourceId: input.resourceId },
      orderBy: [{ updatedAt: 'desc' }, { workspaceId: 'asc' }],
      take: 100,
    });
  }

  private async audit(
    record: ProjectPublication,
    action: string,
    receipt?: Prisma.InputJsonObject
  ) {
    await this.db.projectPublicationEvent.create({
      data: {
        publicationId: record.id,
        revision: record.revision,
        status: record.status,
        snapshot: JSON.parse(
          JSON.stringify({ ...record, action, ...(receipt ? { receipt } : {}) })
        ) as Prisma.InputJsonObject,
      },
    });
  }
}
