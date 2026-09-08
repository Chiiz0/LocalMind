import { createHash, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import {
  Prisma,
  type ProjectResource,
  ProjectResourceKind,
} from '@prisma/client';
import { generateKeyBetween } from 'fractional-indexing';
import { z } from 'zod';

import { AccessDenied, BadRequest, ResourceConflict } from '../base';
import { BaseModel } from './base';
import type { ProjectEditLeaseProof } from './project-resource-edit-lease';

export const PROJECT_RESOURCE_MAX_DEPTH = 64;
export const PROJECT_BLOB_MAX_BYTES = 512 * 1024 * 1024;

export type ProjectActor = { projectId: string; actorId: string };
export type ProjectBlobEvidence = {
  key: string;
  mimeType: string;
  byteSize: number;
  fingerprint: string;
};

const cursorSchema = z
  .object({
    projectId: z.string(),
    parentId: z.string().nullable(),
    trash: z.boolean(),
    search: z.string(),
    sortKey: z.string().max(256),
    id: z.string().max(512),
  })
  .strict();

const searchCursorSchema = z
  .object({
    projectId: z.string().min(1).max(256),
    query: z.string().max(128),
    id: z.string().min(1).max(256),
  })
  .strict();

export function projectResourceHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function boundedString(value: string, field: string, max = 256) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new BadRequest(`Invalid Project resource ${field}`);
  return value.trim().normalize('NFC');
}

function titleValue(value: string) {
  const title = boundedString(value, 'title', 512);
  if (
    [...title].some(char => char.charCodeAt(0) < 32) ||
    /[/\\]/.test(title) ||
    title === '.' ||
    title === '..'
  )
    throw new BadRequest(
      'Project resource title contains unsupported characters'
    );
  return title;
}

@Injectable()
export class ProjectResourceModel extends BaseModel {
  @Transactional()
  async search(
    input: ProjectActor & {
      query: string;
      cursor?: string | null;
      limit?: number;
    }
  ) {
    await this.assertMember(input);
    if (typeof input.query !== 'string' || input.query.length > 128)
      throw new BadRequest('Invalid Project search query');
    const query = input.query.trim().normalize('NFC');
    const limit = input.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequest(
        'Project search page size must be between 1 and 100'
      );
    let after: z.infer<typeof searchCursorSchema> | undefined;
    if (input.cursor) {
      try {
        if (input.cursor.length > 4096) throw new Error('Invalid cursor');
        after = searchCursorSchema.parse(
          JSON.parse(Buffer.from(input.cursor, 'base64url').toString())
        );
      } catch {
        throw new BadRequest('Invalid Project search cursor');
      }
      if (after.projectId !== input.projectId || after.query !== query)
        throw new BadRequest('Project search cursor belongs to another query');
    }
    const rows = await this.db.$queryRaw<
      {
        id: string;
        title: string;
        kind: ProjectResourceKind;
        contentVersion: number;
        snippet: string;
      }[]
    >(Prisma.sql`
      SELECT resource.id, resource.title, resource.kind, COALESCE(office.revision_counter, resource.content_version) AS "contentVersion",
        CASE WHEN resource.search_version = COALESCE(office.revision_counter, resource.content_version) THEN
          substring(resource.search_text FROM greatest(1, strpos(lower(resource.search_text), lower(${query})) - 100) FOR 600)
          ELSE '' END AS snippet
      FROM project_resources resource
      LEFT JOIN office_artifacts office ON office.id = resource.office_artifact_id AND office.project_id = resource.project_id
      WHERE resource.project_id = ${input.projectId} AND resource.trashed_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM project_resource_deletions WHERE resource_id = resource.id)
        AND resource.kind <> 'folder'
        ${after ? Prisma.sql`AND resource.id > ${after.id}` : Prisma.empty}
        AND (position(lower(${query}) in lower(resource.title)) > 0 OR (
          resource.search_version = COALESCE(office.revision_counter, resource.content_version) AND (
            to_tsvector('simple'::regconfig, resource.title || E'\\n' || resource.search_text) @@ websearch_to_tsquery('simple'::regconfig, ${query})
            OR position(lower(${query}) in lower(resource.search_text)) > 0
          )
        ))
        AND NOT EXISTS (
          WITH RECURSIVE ancestors AS (
            SELECT id, parent_id, trashed_at, 1 AS depth FROM project_resources
              WHERE id = resource.parent_id AND project_id = resource.project_id
            UNION ALL
            SELECT parent.id, parent.parent_id, parent.trashed_at, ancestor.depth + 1
              FROM project_resources parent JOIN ancestors ancestor ON parent.id = ancestor.parent_id
              WHERE parent.project_id = resource.project_id AND ancestor.depth < 64
          ) SELECT 1 FROM ancestors WHERE trashed_at IS NOT NULL
        )
      ORDER BY resource.id LIMIT ${limit + 1}
    `);
    const items = [];
    for (const row of rows.slice(0, limit)) {
      const path = await this.pathUnchecked(input.projectId, row.id);
      items.push({
        ...row,
        projectId: input.projectId,
        path: path.map(node => ({ id: node.id, title: node.title })),
      });
    }
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > limit && last
          ? Buffer.from(
              JSON.stringify({ projectId: input.projectId, query, id: last.id })
            ).toString('base64url')
          : null,
    };
  }

  @Transactional()
  async updateSearchText(
    input: ProjectActor & { resourceId: string; sequence: number; text: string }
  ) {
    const resource = await this.get(input);
    const office = resource.officeArtifactId
      ? await this.db.$queryRaw<
          { revisionCounter: number }[]
        >`SELECT revision_counter AS "revisionCounter" FROM office_artifacts WHERE id = ${resource.officeArtifactId} AND project_id = ${input.projectId} FOR SHARE`
      : null;
    if (
      input.sequence !==
      (office?.[0]?.revisionCounter ?? resource.contentVersion)
    )
      return false;
    if (Buffer.byteLength(input.text) > 1024 * 1024)
      throw new BadRequest('Project search text exceeds its bounds');
    const result = await this.db.projectResource.updateMany({
      where: {
        id: resource.id,
        projectId: input.projectId,
        contentVersion: resource.contentVersion,
      },
      data: { searchText: input.text, searchVersion: input.sequence },
    });
    return result.count === 1;
  }

  async pendingSearchIndex(afterId?: string) {
    return this.db.$queryRaw<
      {
        id: string;
        projectId: string;
        actorId: string;
        officeArtifactId: string | null;
      }[]
    >(Prisma.sql`
      SELECT resource.id, resource.project_id AS "projectId", resource.office_artifact_id AS "officeArtifactId",
        (SELECT min(user_id) FROM ai_context_project_members WHERE project_id = resource.project_id) AS "actorId"
      FROM project_resources resource
      JOIN ai_context_projects project ON project.id = resource.project_id AND project.status = 'active'
      LEFT JOIN office_artifacts office ON office.id = resource.office_artifact_id AND office.project_id = resource.project_id
      WHERE resource.kind <> 'folder' AND resource.trashed_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM project_resource_deletions WHERE resource_id = resource.id)
        AND resource.search_version < COALESCE(office.revision_counter, resource.content_version)
        AND EXISTS (SELECT 1 FROM ai_context_project_members WHERE project_id = resource.project_id)
        ${afterId ? Prisma.sql`AND resource.id > ${afterId}` : Prisma.empty}
      ORDER BY resource.id LIMIT 20
    `);
  }

  @Transactional()
  async withMember<T>(
    input: ProjectActor,
    operation: () => Promise<T>,
    treeWrite = false
  ) {
    await this.assertMember(input, treeWrite);
    return operation();
  }

  @Transactional()
  async assertMember(input: ProjectActor, treeWrite = false) {
    // The locks also serialize revocation/archive with the enclosing write.
    const projects = await this.db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM ai_context_projects
      WHERE id = ${input.projectId} AND status = 'active'
      ${treeWrite ? Prisma.sql`FOR UPDATE` : Prisma.sql`FOR SHARE`}
    `);
    if (!projects.length) throw new AccessDenied('Project is unavailable');
    const members = await this.db.$queryRaw<{ user_id: string }[]>(Prisma.sql`
      SELECT user_id FROM ai_context_project_members
      WHERE project_id = ${input.projectId} AND user_id = ${input.actorId}
      FOR SHARE
    `);
    if (!members.length)
      throw new AccessDenied('Project membership is required');
  }

  @Transactional()
  async assertOfficeResource(input: ProjectActor & { artifactId: string }) {
    await this.assertMember(input);
    const node = await this.db.projectResource.findFirst({
      where: { projectId: input.projectId, officeArtifactId: input.artifactId },
    });
    if (!node) throw new BadRequest('Project Office resource is unavailable');
    return this.get({ ...input, resourceId: node.id });
  }

  @Transactional()
  async get(
    input: ProjectActor & { resourceId: string; includeTrash?: boolean }
  ) {
    await this.assertMember(input);
    const node = await this.requireNode(input.projectId, input.resourceId);
    await this.pathUnchecked(input.projectId, node.id, input.includeTrash);
    return node;
  }

  @Transactional()
  async path(input: ProjectActor & { resourceId: string }) {
    await this.assertMember(input);
    return this.pathUnchecked(input.projectId, input.resourceId);
  }

  private async requireNode(projectId: string, resourceId: string) {
    const node = await this.db.projectResource.findFirst({
      where: { id: resourceId, projectId, deletion: null },
    });
    if (!node) throw new BadRequest('Project resource is unavailable');
    return node;
  }

  private async pathUnchecked(
    projectId: string,
    id: string,
    includeTrash = false
  ) {
    const path: ProjectResource[] = [];
    let current: string | null = id;
    const visited = new Set<string>();
    while (current) {
      if (visited.has(current) || path.length >= PROJECT_RESOURCE_MAX_DEPTH)
        throw new BadRequest(
          'Project path exceeds the maximum depth or contains a cycle'
        );
      visited.add(current);
      const node = await this.requireNode(projectId, current);
      if (node.trashedAt && !includeTrash)
        throw new BadRequest('Project resource is in Trash');
      if (path.length && node.kind !== 'folder')
        throw new BadRequest('Project parent is not a folder');
      path.unshift(node);
      current = node.parentId;
    }
    return path;
  }

  private async requireParent(projectId: string, parentId: string | null) {
    if (!parentId) return [];
    const path = await this.pathUnchecked(projectId, parentId);
    if (path.at(-1)?.kind !== 'folder')
      throw new BadRequest('Choose a Project folder');
    return path;
  }

  @Transactional()
  async list(
    input: ProjectActor & {
      parentId?: string | null;
      cursor?: string | null;
      limit?: number;
      trash?: boolean;
      search?: string;
    }
  ) {
    await this.assertMember(input);
    const parentId = input.parentId ?? null;
    const limit = input.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequest('Project page size must be between 1 and 100');
    const search = input.search?.trim() ?? '';
    if (search.length > 128) throw new BadRequest('Project search is too long');
    if (parentId) await this.requireParent(input.projectId, parentId);
    const scope = {
      projectId: input.projectId,
      parentId,
      trash: !!input.trash,
      search,
    };
    let after: z.infer<typeof cursorSchema> | undefined;
    if (input.cursor) {
      try {
        if (input.cursor.length > 4096) throw new Error('Invalid cursor');
        after = cursorSchema.parse(
          JSON.parse(Buffer.from(input.cursor, 'base64url').toString())
        );
      } catch {
        throw new BadRequest('Invalid Project page cursor');
      }
      if (
        Object.entries(scope).some(
          ([key, value]) => after?.[key as keyof typeof scope] !== value
        )
      )
        throw new BadRequest(
          'Project page cursor belongs to another folder or query'
        );
    }
    const trashed =
      input.trash && !parentId
        ? await this.db.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT resource.id FROM project_resources resource
        WHERE resource.project_id = ${input.projectId} AND resource.trashed_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM project_resource_deletions WHERE resource_id = resource.id)
        AND (${search} = '' OR position(lower(${search}) in lower(resource.title)) > 0)
        ${after ? Prisma.sql`AND (resource.sort_key, resource.id) > (${after.sortKey}, ${after.id})` : Prisma.empty}
        AND NOT EXISTS (
          WITH RECURSIVE ancestors AS (
            SELECT id, parent_id, trashed_at, 1 AS depth FROM project_resources WHERE id = resource.parent_id AND project_id = resource.project_id
            UNION ALL
            SELECT parent.id, parent.parent_id, parent.trashed_at, ancestor.depth + 1 FROM project_resources parent
            JOIN ancestors ancestor ON parent.id = ancestor.parent_id
            WHERE parent.project_id = resource.project_id AND ancestor.depth < 64
          ) SELECT 1 FROM ancestors WHERE trashed_at IS NOT NULL
        ) ORDER BY resource.sort_key, resource.id LIMIT ${limit + 1}
      `)
        : null;
    const rows = await this.db.projectResource.findMany({
      where: {
        projectId: input.projectId,
        ...(trashed
          ? { id: { in: trashed.map(row => row.id) } }
          : { parentId }),
        trashedAt: input.trash ? { not: null } : null,
        deletion: null,
        ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
        ...(after
          ? {
              OR: [
                { sortKey: { gt: after.sortKey } },
                { sortKey: after.sortKey, id: { gt: after.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ sortKey: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > limit && last
          ? Buffer.from(
              JSON.stringify({ ...scope, sortKey: last.sortKey, id: last.id })
            ).toString('base64url')
          : null,
    };
  }

  @Transactional()
  async storeBlob(
    input: ProjectActor & ProjectBlobEvidence,
    store: () => Promise<void>
  ) {
    await this.assertMember(input);
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`project-blob:${input.projectId}:${input.key}`}, 0))`;
    const existing = await this.db.projectBlob.findUnique({
      where: { projectId_key: { projectId: input.projectId, key: input.key } },
    });
    const blob = await this.registerBlob(input);
    if (!existing) await store();
    return blob;
  }

  @Transactional()
  async registerBlob(input: ProjectActor & ProjectBlobEvidence) {
    await this.assertMember(input);
    if (
      !/^[a-f0-9]{64}$/.test(input.fingerprint) ||
      input.key !== `sha256-${input.fingerprint}` ||
      !Number.isSafeInteger(input.byteSize) ||
      input.byteSize < 0 ||
      input.byteSize > PROJECT_BLOB_MAX_BYTES
    )
      throw new BadRequest('Invalid Project Blob evidence');
    const mimeType = boundedString(input.mimeType, 'MIME type');
    const identity = { projectId: input.projectId, key: input.key };
    await this.db.projectBlob.createMany({
      data: [
        {
          ...identity,
          mimeType,
          byteSize: input.byteSize,
          fingerprint: input.fingerprint,
          createdBy: input.actorId,
        },
      ],
      skipDuplicates: true,
    });
    const blob = await this.db.projectBlob.findUniqueOrThrow({
      where: { projectId_key: identity },
    });
    if (
      blob.byteSize !== input.byteSize ||
      blob.mimeType !== mimeType ||
      blob.fingerprint !== input.fingerprint
    )
      throw new BadRequest(
        'Project Blob evidence differs from the existing object'
      );
    return blob;
  }

  @Transactional()
  async assertBlobDownload(input: ProjectActor & { key: string }) {
    const blob = await this.getBlob(input);
    const references = Prisma.sql`
      resource.project_id = ${input.projectId} AND (
        EXISTS (SELECT 1 FROM project_resource_revisions revision WHERE revision.resource_id = resource.id AND revision.blob_key = ${input.key})
        OR EXISTS (SELECT 1 FROM project_resource_attachments attachment WHERE attachment.resource_id = resource.id AND attachment.key = ${input.key})
        OR EXISTS (SELECT 1 FROM office_revisions revision WHERE revision.artifact_id = resource.office_artifact_id AND (revision.package_blob_key = ${input.key} OR revision.state_blob_key = ${input.key}))
      )
    `;
    const visible = await this.db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT resource.id FROM project_resources resource WHERE ${references} AND resource.trashed_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM project_resource_deletions WHERE resource_id = resource.id)
      AND NOT EXISTS (
        WITH RECURSIVE ancestors AS (
          SELECT id, parent_id, trashed_at, 1 AS depth FROM project_resources WHERE id = resource.parent_id AND project_id = resource.project_id
          UNION ALL
          SELECT parent.id, parent.parent_id, parent.trashed_at, ancestor.depth + 1
          FROM project_resources parent JOIN ancestors ancestor ON parent.id = ancestor.parent_id
          WHERE parent.project_id = resource.project_id AND ancestor.depth < 64
        ) SELECT 1 FROM ancestors WHERE trashed_at IS NOT NULL
      ) LIMIT 1
    `);
    if (visible.length) return;
    const linked = await this.db.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT resource.id FROM project_resources resource WHERE ${references} LIMIT 1`
    );
    if (linked.length || blob.createdBy !== input.actorId)
      throw new BadRequest('Project Blob has no available resource');
  }

  @Transactional()
  async getBlob(input: ProjectActor & { key: string }) {
    await this.assertMember(input);
    const blob = await this.db.projectBlob.findUnique({
      where: { projectId_key: { projectId: input.projectId, key: input.key } },
    });
    if (!blob) throw new BadRequest('Project Blob is unavailable');
    return blob;
  }

  @Transactional()
  async findCreation(
    input: ProjectActor & { requestKey: string; requestHash: string }
  ) {
    await this.assertMember(input);
    const node = await this.db.projectResource.findUnique({
      where: {
        projectId_createdBy_creationKey: {
          projectId: input.projectId,
          createdBy: input.actorId,
          creationKey: boundedString(input.requestKey, 'request key'),
        },
      },
    });
    if (node && node.creationHash !== input.requestHash)
      throw new BadRequest(
        'Project creation request key was reused with different content'
      );
    if (node) await this.get({ ...input, resourceId: node.id });
    return node;
  }

  @Transactional()
  async create(
    input: ProjectActor & {
      resourceId?: string;
      parentId?: string | null;
      kind: ProjectResourceKind;
      title: string;
      requestKey: string;
      requestHash?: string;
      blobKey?: string;
      officeArtifactId?: string;
      attachmentKeys?: string[];
      origin?: 'user' | 'ai' | 'import';
      searchText?: string;
    }
  ) {
    await this.assertMember(input, true);
    const title = titleValue(input.title);
    const requestKey = boundedString(input.requestKey, 'request key');
    const parentId = input.parentId ?? null;
    const hash =
      input.requestHash ??
      projectResourceHash({
        parentId,
        title,
        kind: input.kind,
        blobKey: input.blobKey ?? null,
        officeArtifactId: input.officeArtifactId ?? null,
        origin: input.origin ?? 'user',
      });
    const existing = await this.db.projectResource.findUnique({
      where: {
        projectId_createdBy_creationKey: {
          projectId: input.projectId,
          createdBy: input.actorId,
          creationKey: requestKey,
        },
      },
    });
    if (existing) {
      if (existing.creationHash !== hash)
        throw new BadRequest(
          'Project creation request key was reused with different content'
        );
      return this.get({ ...input, resourceId: existing.id });
    }
    if (!Object.values(ProjectResourceKind).includes(input.kind))
      throw new BadRequest('Unsupported Project resource kind');
    const nativeOffice = [
      'document',
      'workbook',
      'presentation',
      'pdf',
    ].includes(input.kind);
    if (
      nativeOffice !== !!input.officeArtifactId ||
      (input.kind === 'folder' || nativeOffice) === !!input.blobKey
    )
      throw new BadRequest('Project resource content does not match its type');
    const parentPath = await this.requireParent(input.projectId, parentId);
    if (parentPath.length >= PROJECT_RESOURCE_MAX_DEPTH)
      throw new BadRequest('Project path exceeds the maximum depth');
    await this.assertFolderName(input.projectId, parentId, input.kind, title);
    const last = await this.db.projectResource.findFirst({
      where: { projectId: input.projectId, parentId },
      orderBy: [{ sortKey: 'desc' }, { id: 'desc' }],
    });
    const node = await this.db.projectResource.create({
      data: {
        id: input.resourceId ?? randomUUID(),
        projectId: input.projectId,
        parentId,
        kind: input.kind,
        officeArtifactId: input.officeArtifactId,
        title,
        sortKey: generateKeyBetween(last?.sortKey ?? null, null),
        createdBy: input.actorId,
        creationKey: requestKey,
        creationHash: hash,
      },
    });
    if (input.blobKey)
      await this.appendRevision({
        ...input,
        resourceId: node.id,
        blobKey: input.blobKey,
        expectedContentVersion: 0,
        requestKey,
        origin: input.origin ?? 'user',
      });
    await this.audit(input, node.id, 'created', {
      kind: node.kind,
      parentId,
      requestKey,
    });
    return this.requireNode(input.projectId, node.id);
  }

  @Transactional()
  async findRevisionRequest(
    input: ProjectActor & {
      resourceId: string;
      requestKey: string;
      requestHash: string;
    }
  ) {
    await this.get(input);
    const revision = await this.db.projectResourceRevision.findUnique({
      where: {
        resourceId_createdBy_requestKey: {
          resourceId: input.resourceId,
          createdBy: input.actorId,
          requestKey: boundedString(input.requestKey, 'request key'),
        },
      },
    });
    if (revision && revision.requestHash !== input.requestHash)
      throw new BadRequest(
        'Project save request key was reused with different content'
      );
    return revision;
  }

  @Transactional()
  async appendRevision(
    input: ProjectActor & {
      resourceId: string;
      blobKey: string;
      expectedContentVersion: number;
      requestKey: string;
      requestHash?: string;
      origin: 'user' | 'ai' | 'import';
      editLease?: ProjectEditLeaseProof;
      attachmentKeys?: string[];
      searchText?: string;
    }
  ) {
    await this.assertMember(input);
    await this.db
      .$queryRaw`SELECT id FROM project_resources WHERE id = ${input.resourceId} AND project_id = ${input.projectId} FOR UPDATE`;
    const node = await this.get(input);
    if (node.kind === 'folder' || node.officeArtifactId)
      throw new BadRequest(
        'This resource does not use Project document revisions'
      );
    const requestKey = boundedString(input.requestKey, 'request key');
    const requestHash =
      input.requestHash ??
      projectResourceHash({
        blobKey: input.blobKey,
        expectedContentVersion: input.expectedContentVersion,
        origin: input.origin,
      });
    const existing = await this.db.projectResourceRevision.findUnique({
      where: {
        resourceId_createdBy_requestKey: {
          resourceId: node.id,
          createdBy: input.actorId,
          requestKey,
        },
      },
    });
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new BadRequest(
          'Project save request key was reused with different content'
        );
      return existing;
    }
    if (node.contentVersion !== input.expectedContentVersion)
      throw new ResourceConflict(
        'Project content changed; reload and compare before saving'
      );
    if (node.contentVersion > 0)
      await this.models.projectResourceEditLease.assertHeld(input);
    const blob = await this.getBlob({ ...input, key: input.blobKey });
    const parent = node.contentVersion
      ? await this.db.projectResourceRevision.findUniqueOrThrow({
          where: {
            resourceId_sequence: {
              resourceId: node.id,
              sequence: node.contentVersion,
            },
          },
        })
      : null;
    const revision = await this.db.projectResourceRevision.create({
      data: {
        projectId: node.projectId,
        resourceId: node.id,
        sequence: node.contentVersion + 1,
        parentId: parent?.id,
        blobKey: blob.key,
        fingerprint: blob.fingerprint,
        origin: input.origin,
        requestKey,
        requestHash,
        createdBy: input.actorId,
      },
    });
    if (input.attachmentKeys?.length) {
      if (input.attachmentKeys.length > 256)
        throw new BadRequest('Project document has too many attachments');
      await this.db.projectResourceAttachment.createMany({
        data: [...new Set(input.attachmentKeys)].map(key => ({
          revisionId: revision.id,
          projectId: node.projectId,
          resourceId: node.id,
          key,
        })),
      });
    }
    await this.db.projectResource.update({
      where: { id: node.id },
      data: {
        contentVersion: revision.sequence,
        searchText: input.searchText ?? '',
        searchVersion: input.searchText !== undefined ? revision.sequence : 0,
      },
    });
    await this.audit(input, node.id, 'saved', {
      revisionId: revision.id,
      sequence: revision.sequence,
      fingerprint: revision.fingerprint,
      origin: revision.origin,
    });
    if (node.contentVersion > 0)
      await this.models.projectResourceEditLease.assertHeld(input);
    return revision;
  }

  @Transactional()
  async revision(
    input: ProjectActor & { resourceId: string; sequence?: number }
  ) {
    const node = await this.get(input);
    const revision = await this.db.projectResourceRevision.findUnique({
      where: {
        resourceId_sequence: {
          resourceId: node.id,
          sequence: input.sequence ?? node.contentVersion,
        },
      },
    });
    if (!revision)
      throw new BadRequest('Project resource revision is unavailable');
    return revision;
  }

  @Transactional()
  async findChangeRequest(
    input: Parameters<ProjectResourceModel['change']>[0]
  ) {
    await this.assertMember(input);
    if (!input.requestKey) return null;
    const previous = await this.db.projectResourceAuditEvent.findUnique({
      where: {
        projectId_actorId_requestKey: {
          projectId: input.projectId,
          actorId: input.actorId,
          requestKey: boundedString(input.requestKey, 'request key'),
        },
      },
    });
    if (!previous) return null;
    if (
      previous.resourceId !== input.resourceId ||
      previous.requestHash !== this.changeHash(input)
    )
      throw new BadRequest(
        'Project tree request key was reused for a different change'
      );
    return this.get({ ...input, includeTrash: true });
  }

  private changeHash(input: Parameters<ProjectResourceModel['change']>[0]) {
    return projectResourceHash({
      resourceId: input.resourceId,
      expectedVersion: input.expectedVersion,
      title: input.title,
      parentId: input.parentId,
      beforeId: input.beforeId,
      trash: input.trash,
    });
  }

  @Transactional()
  async change(
    input: ProjectActor & {
      resourceId: string;
      expectedVersion: number;
      requestKey?: string;
      title?: string;
      parentId?: string | null;
      beforeId?: string | null;
      trash?: boolean;
    }
  ) {
    await this.assertMember(input, true);
    const previous = await this.findChangeRequest(input);
    if (previous) return previous;
    const node = await this.get({
      ...input,
      includeTrash: input.trash === false,
    });
    if (node.version !== input.expectedVersion)
      throw new ResourceConflict(
        'Project tree changed; reload before making this change'
      );
    const title =
      input.title === undefined ? node.title : titleValue(input.title);
    const parentId =
      input.parentId === undefined ? node.parentId : input.parentId;
    const path = await this.requireParent(input.projectId, parentId);
    if (path.some(parent => parent.id === node.id))
      throw new BadRequest('A Project folder cannot contain itself');
    const descendants = await this.db.$queryRaw<{ depth: number }[]>`
      WITH RECURSIVE children AS (
        SELECT id, 1 AS depth FROM project_resources WHERE id = ${node.id} AND project_id = ${input.projectId}
        UNION ALL
        SELECT r.id, c.depth + 1 FROM project_resources r JOIN children c ON r.parent_id = c.id
        WHERE r.project_id = ${input.projectId} AND c.depth <= ${PROJECT_RESOURCE_MAX_DEPTH}
      ) SELECT MAX(depth)::int AS depth FROM children
    `;
    if (path.length + (descendants[0]?.depth ?? 1) > PROJECT_RESOURCE_MAX_DEPTH)
      throw new BadRequest('Project path exceeds the maximum depth');
    await this.assertFolderName(
      input.projectId,
      parentId,
      node.kind,
      title,
      node.id
    );
    let sortKey = node.sortKey;
    if (parentId !== node.parentId || input.beforeId !== undefined) {
      const before = input.beforeId
        ? await this.requireNode(input.projectId, input.beforeId)
        : null;
      if (
        before &&
        (before.parentId !== parentId ||
          before.trashedAt ||
          before.id === node.id)
      )
        throw new BadRequest('Project sort target is unavailable');
      const previous = await this.db.projectResource.findFirst({
        where: {
          projectId: input.projectId,
          parentId,
          id: { not: node.id },
          ...(before ? { sortKey: { lt: before.sortKey } } : {}),
        },
        orderBy: [{ sortKey: 'desc' }, { id: 'desc' }],
      });
      sortKey = generateKeyBetween(
        previous?.sortKey ?? null,
        before?.sortKey ?? null
      );
      if (sortKey.length > 256)
        throw new BadRequest('Project folder ordering requires compaction');
    }
    const updated = await this.db.projectResource.update({
      where: { id: node.id, version: input.expectedVersion },
      data: {
        title,
        parentId,
        sortKey,
        version: { increment: 1 },
        ...(input.trash === undefined
          ? {}
          : { trashedAt: input.trash ? new Date() : null }),
      },
    });
    if (node.officeArtifactId && title !== node.title)
      await this.db.officeArtifact.update({
        where: { id: node.officeArtifactId },
        data: { title },
      });
    await this.audit(
      input,
      node.id,
      input.trash === true
        ? 'trashed'
        : input.trash === false
          ? 'restored'
          : 'changed',
      {
        previousVersion: node.version,
        version: updated.version,
        parentId,
        previousParentId: node.parentId,
        renamed: title !== node.title,
        reordered: sortKey !== node.sortKey,
      },
      input.requestKey
        ? { requestKey: input.requestKey, requestHash: this.changeHash(input) }
        : undefined
    );
    return updated;
  }

  @Transactional()
  async permanentlyDelete(
    input: ProjectActor & {
      resourceId: string;
      expectedVersion: number;
      requestKey: string;
    }
  ) {
    await this.assertMember(input, true);
    const requestKey = boundedString(input.requestKey, 'request key');
    const previous = await this.db.projectResourceDeletion.findUnique({
      where: { resourceId: input.resourceId },
    });
    if (previous) {
      if (
        previous.projectId !== input.projectId ||
        previous.actorId !== input.actorId ||
        previous.requestKey !== requestKey ||
        previous.expectedVersion !== input.expectedVersion
      )
        throw new BadRequest(
          'Project resource was already permanently deleted'
        );
      return true;
    }
    const node = await this.get({ ...input, includeTrash: true });
    if (!node.trashedAt || node.version !== input.expectedVersion)
      throw new BadRequest(
        'Move the current resource to Trash before permanently deleting it'
      );
    const descendants = await this.db.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE tree AS (
        SELECT id FROM project_resources WHERE id = ${node.id} AND project_id = ${input.projectId}
        UNION ALL SELECT child.id FROM project_resources child JOIN tree ON child.parent_id = tree.id WHERE child.project_id = ${input.projectId}
      ) SELECT id FROM tree ORDER BY id LIMIT 10001
    `;
    if (descendants.length > 10000)
      throw new BadRequest('Delete smaller Project folders first');
    const ids = descendants.map(row => row.id);
    await this.db.$queryRaw(
      Prisma.sql`SELECT id FROM project_resources WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`
    );
    const held = await this.db.$queryRaw<{ resource_id: string }[]>(Prisma.sql`
      SELECT resource_id FROM project_resource_edit_leases WHERE resource_id IN (${Prisma.join(ids)}) AND expires_at > clock_timestamp()
    `);
    if (held.length)
      throw new BadRequest(
        'Wait for editing to end before permanently deleting this resource'
      );
    await this.db.projectResourceDeletion.createMany({
      data: ids.map(resourceId => ({
        resourceId,
        projectId: input.projectId,
        actorId: input.actorId,
        rootResourceId: node.id,
        requestKey,
        expectedVersion: node.version,
      })),
      skipDuplicates: true,
    });
    await this.audit(
      input,
      node.id,
      'permanently_deleted',
      { resourceCount: ids.length, expectedVersion: node.version },
      {
        requestKey,
        requestHash: projectResourceHash({
          resourceId: node.id,
          expectedVersion: node.version,
        }),
      }
    );
    await this.db.projectRealtimeOutbox.create({
      data: {
        topic: 'project.resource.changed',
        scopeId: input.projectId,
        resourceId: node.id,
      },
    });
    return true;
  }

  private async assertFolderName(
    projectId: string,
    parentId: string | null,
    kind: ProjectResourceKind,
    title: string,
    exceptId?: string
  ) {
    if (kind !== 'folder') return;
    const duplicate = await this.db.projectResource.findFirst({
      where: {
        projectId,
        parentId,
        kind: 'folder',
        trashedAt: null,
        title: { equals: title, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (duplicate)
      throw new BadRequest(
        'A folder with this name already exists in this Project location'
      );
  }

  @Transactional()
  async linkedSources(input: ProjectActor & { resourceId: string }) {
    await this.get(input);
    const imports = await this.db.projectResourceAuditEvent.findMany({
      where: {
        projectId: input.projectId,
        resourceId: input.resourceId,
        action: 'imported',
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    const publications = await this.db.projectPublicationTarget.findMany({
      where: { projectId: input.projectId, resourceId: input.resourceId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    const sources = new Map<
      string,
      { workspaceId: string; sourceResourceId: string }
    >();
    for (const row of imports) {
      const evidence = row.evidence as Prisma.JsonObject;
      if (
        typeof evidence.sourceWorkspaceId === 'string' &&
        typeof evidence.sourceResourceId === 'string'
      ) {
        const value = {
          workspaceId: evidence.sourceWorkspaceId,
          sourceResourceId: evidence.sourceResourceId,
        };
        sources.set(JSON.stringify(value), value);
      }
    }
    for (const row of publications) {
      const value = {
        workspaceId: row.workspaceId,
        sourceResourceId: row.targetResourceId,
      };
      sources.set(JSON.stringify(value), value);
    }
    return [...sources.values()];
  }

  @Transactional()
  async findImportRequest(
    input: ProjectActor & {
      resourceId: string;
      requestKey: string;
      requestHash: string;
    }
  ) {
    await this.get(input);
    const event = await this.db.projectResourceAuditEvent.findUnique({
      where: {
        projectId_actorId_requestKey: {
          projectId: input.projectId,
          actorId: input.actorId,
          requestKey: input.requestKey,
        },
      },
    });
    if (
      event &&
      (event.resourceId !== input.resourceId ||
        event.requestHash !== input.requestHash)
    )
      throw new BadRequest(
        'Source refresh request was reused with different content'
      );
    return event;
  }

  @Transactional()
  async recordImport(
    input: ProjectActor & {
      resourceId: string;
      sourceWorkspaceId: string;
      sourceResourceId: string;
      sourceVersion: string;
      sourceFingerprint: string;
      authorization: Prisma.InputJsonObject;
      attachmentCount: number;
      requestKey?: string;
      requestHash?: string;
    }
  ) {
    await this.get(input);
    return this.audit(
      input,
      input.resourceId,
      'imported',
      {
        sourceWorkspaceId: input.sourceWorkspaceId,
        sourceResourceId: input.sourceResourceId,
        sourceVersion: input.sourceVersion,
        sourceFingerprint: input.sourceFingerprint,
        authorization: input.authorization,
        attachmentCount: input.attachmentCount,
      },
      input.requestKey && input.requestHash
        ? { requestKey: input.requestKey, requestHash: input.requestHash }
        : undefined
    );
  }

  private audit(
    input: ProjectActor,
    resourceId: string,
    action: string,
    evidence: Prisma.InputJsonObject,
    request?: { requestKey: string; requestHash: string }
  ) {
    return this.db.projectResourceAuditEvent.create({
      data: {
        projectId: input.projectId,
        actorId: input.actorId,
        resourceId,
        action,
        evidence,
        ...request,
      },
    });
  }
}
