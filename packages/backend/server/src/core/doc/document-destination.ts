import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { BadRequest, NotFound } from '../../base';
import { Models } from '../../models';
import { PermissionAccess } from '../permission';
import { WorkspaceOrganizationService } from './workspace-organization';

const folderSchema = z.object({
  id: z.string().min(1).max(256),
  type: z.literal('folder'),
  parentId: z.string().min(1).max(256).nullish(),
  data: z.string().min(1).max(512),
  index: z.string().max(128).optional(),
});
const locationCursorSchema = z
  .object({
    workspaceId: z.string().min(1).max(256),
    parentId: z.string().min(1).max(256).nullable(),
    query: z.string().max(128),
    revision: z.string().length(64),
    after: z.string().min(1).max(256),
    position: z.string().max(128),
  })
  .strict();
export type DocumentDestination = {
  workspaceId: string;
  folderId: string | null;
  path: { id: string; name: string }[];
  fingerprint: string;
};

@Injectable()
export class DocumentDestinationService {
  constructor(
    private readonly ac: PermissionAccess,
    private readonly organization: WorkspaceOrganizationService,
    private readonly models: Models
  ) {}

  async workspaces(actorId: string) {
    const candidates =
      await this.models.workspaceDirectoryGrant.memberWorkspaces(actorId);
    const visible: { id: string; name: string }[] = [];
    for (const { workspace } of candidates) {
      const access = this.ac.user(actorId).workspace(workspace.id);
      if (
        (await access.can('Workspace.CreateDoc')) &&
        (await access.can('Workspace.Sync'))
      ) {
        visible.push({
          id: workspace.id,
          name: workspace.name ?? workspace.id,
        });
      }
    }
    return visible;
  }

  async folders(input: {
    actorId: string;
    workspaceId: string;
    after?: string;
  }) {
    const access = this.ac.user(input.actorId).workspace(input.workspaceId);
    await access.assert('Workspace.CreateDoc');
    await access.assert('Workspace.Organize.Read');
    await access.assert('Workspace.Sync');
    const directory = await this.organization.readDirectory(
      input.workspaceId,
      input.actorId
    );
    const folders = new Map<string, z.infer<typeof folderSchema>>();
    for (const { row } of directory.entries) {
      const parsed = folderSchema.safeParse(row);
      if (parsed.success) folders.set(parsed.data.id, parsed.data);
    }
    const candidates = directory.entries
      .filter(
        ({ row }) =>
          row.type === 'folder' &&
          typeof row.id === 'string' &&
          (!input.after || row.id > input.after)
      )
      .sort((a, b) =>
        String(a.row.id) < String(b.row.id)
          ? -1
          : String(a.row.id) > String(b.row.id)
            ? 1
            : 0
      )
      .slice(0, 100);
    const items: DocumentDestination[] = [];
    for (const { row, rights } of candidates) {
      if (!rights.canRead || !rights.canWrite || !rights.canOrganize) continue;
      try {
        items.push(
          this.describe({ ...input, folderId: String(row.id) }, folders)
        );
      } catch (error) {
        if (!(error instanceof NotFound) && !(error instanceof BadRequest))
          throw error;
      }
    }
    return {
      items,
      nextCursor:
        candidates.length === 100 ? String(candidates.at(-1)?.row.id) : null,
    };
  }

  async locations(input: {
    actorId: string;
    workspaceId: string;
    parentId: string | null;
    query?: string;
    cursor?: string;
    limit?: number;
  }) {
    const query = (input.query ?? '').trim();
    const limit = input.limit ?? 50;
    if (
      !input.workspaceId ||
      input.workspaceId.length > 256 ||
      input.parentId === undefined ||
      (input.parentId?.length ?? 0) > 256 ||
      query.length > 128 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      (input.cursor?.length ?? 0) > 2048
    )
      throw new BadRequest('Invalid destination page');
    const access = this.ac.user(input.actorId).workspace(input.workspaceId);
    await access.assert('Workspace.Organize.Read');
    const directory = await this.organization.readDirectory(
      input.workspaceId,
      input.actorId
    );
    const folders = new Map<string, z.infer<typeof folderSchema>>();
    const rights = new Map(
      directory.entries.map(entry => [String(entry.row.id), entry.rights])
    );
    for (const { row } of directory.entries) {
      const parsed = folderSchema.safeParse(row);
      if (parsed.success) folders.set(parsed.data.id, parsed.data);
    }
    const currentRights = input.parentId
      ? rights.get(input.parentId)
      : directory.rootRights;
    if (!currentRights?.canRead)
      throw new NotFound('Selected directory is unavailable');
    let after: string | undefined;
    let position = '';
    if (input.cursor) {
      let decoded: z.infer<typeof locationCursorSchema>;
      try {
        decoded = locationCursorSchema.parse(
          JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'))
        );
      } catch {
        throw new BadRequest('Invalid destination cursor');
      }
      if (
        decoded.workspaceId !== input.workspaceId ||
        decoded.parentId !== input.parentId ||
        decoded.query !== query ||
        decoded.revision !== directory.revision
      )
        throw new BadRequest('Destination changed; reload this directory');
      after = decoded.after;
      position = decoded.position;
    }
    const canCreateDoc =
      (await access.can('Workspace.CreateDoc')) &&
      (await access.can('Workspace.Sync'));
    const describe = (folderId: string | null) => {
      const destination = this.describe(
        { workspaceId: input.workspaceId, folderId },
        folders
      );
      const policy = folderId ? rights.get(folderId) : directory.rootRights;
      if (!policy?.canRead)
        throw new NotFound('Selected directory is unavailable');
      return {
        ...destination,
        canSave: canCreateDoc && policy.canWrite && policy.canOrganize,
        canCreateFolder:
          destination.path.length < 64 &&
          canCreateDoc &&
          policy.canWrite &&
          policy.canOrganize &&
          policy.canCreateFolder,
      };
    };
    const candidates = [...folders.values()]
      .filter(
        folder =>
          (!after ||
            (folder.index ?? '') > position ||
            ((folder.index ?? '') === position && folder.id > after)) &&
          (query
            ? folder.data
                .toLocaleLowerCase()
                .includes(query.toLocaleLowerCase())
            : (folder.parentId ?? null) === input.parentId)
      )
      .sort((a, b) =>
        (a.index ?? '') < (b.index ?? '')
          ? -1
          : (a.index ?? '') > (b.index ?? '')
            ? 1
            : a.id < b.id
              ? -1
              : a.id > b.id
                ? 1
                : 0
      );
    const items: ReturnType<typeof describe>[] = [];
    for (const folder of candidates) {
      try {
        items.push(describe(folder.id));
      } catch (error) {
        if (!(error instanceof BadRequest || error instanceof NotFound))
          throw error;
      }
      if (items.length > limit) break;
    }
    const page = items.slice(0, limit);
    const last = page.at(-1);
    const nextCursor =
      items.length > limit && last?.folderId
        ? Buffer.from(
            JSON.stringify({
              workspaceId: input.workspaceId,
              parentId: input.parentId,
              query,
              revision: directory.revision,
              after: last.folderId,
              position: folders.get(last.folderId)?.index ?? '',
            })
          ).toString('base64url')
        : null;
    return {
      current: describe(input.parentId),
      revision: directory.revision,
      items: page,
      nextCursor,
    };
  }

  async authorize(input: {
    actorId: string;
    workspaceId: string;
    folderId: string | null;
    createFolder?: boolean;
    expectedFingerprint?: string;
  }): Promise<
    DocumentDestination & {
      permissionEvidence: Record<string, string | boolean>;
    }
  > {
    if (
      !input.workspaceId ||
      input.workspaceId.length > 256 ||
      input.folderId === undefined
    )
      throw new BadRequest(
        'Select a workspace and an explicit root or directory'
      );
    const access = this.ac.user(input.actorId).workspace(input.workspaceId);
    await access.assert('Workspace.CreateDoc');
    await access.assert('Workspace.Organize.Read');
    await access.assert('Workspace.Sync');
    const rows = input.folderId
      ? await this.organization.readFolders(input.workspaceId, input.actorId)
      : [];
    const folders = new Map<string, z.infer<typeof folderSchema>>();
    for (const row of rows) {
      if (row.type !== 'folder') continue;
      const parsed = folderSchema.safeParse(row);
      if (parsed.success) folders.set(parsed.data.id, parsed.data);
    }
    const destination = this.describe(input, folders);
    if (input.createFolder && destination.path.length >= 64)
      throw new BadRequest('Directory nesting exceeds its limit');
    const rights = await this.models.workspaceDirectoryGrant.rights({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      directoryIds: destination.path.map(folder => folder.id),
    });
    if (
      !rights.canRead ||
      !rights.canWrite ||
      !rights.canOrganize ||
      (input.createFolder && !rights.canCreateFolder)
    )
      throw new NotFound(
        'The selected directory does not allow this operation'
      );
    return {
      ...destination,
      permissionEvidence: {
        actorId: input.actorId,
        workspaceId: input.workspaceId,
        canCreateDoc: true,
        canReadOrganization: true,
        canSync: true,
        ...rights,
      },
    };
  }

  private describe(
    input: {
      workspaceId: string;
      folderId: string | null;
      expectedFingerprint?: string;
    },
    folders: Map<string, z.infer<typeof folderSchema>>
  ): DocumentDestination {
    const path: { id: string; name: string; parentId: string | null }[] = [];
    let current = input.folderId;
    const seen = new Set<string>();
    while (current !== null) {
      if (seen.has(current) || path.length >= 64)
        throw new BadRequest('Directory path is invalid or too deeply nested');
      seen.add(current);
      const folder = folders.get(current);
      if (!folder) throw new NotFound('Selected directory is unavailable');
      path.unshift({
        id: folder.id,
        name: folder.data,
        parentId: folder.parentId ?? null,
      });
      current = folder.parentId ?? null;
    }
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          workspaceId: input.workspaceId,
          folderId: input.folderId,
          path,
        })
      )
      .digest('hex');
    if (input.expectedFingerprint && input.expectedFingerprint !== fingerprint)
      throw new BadRequest(
        'The selected directory changed; select the location again'
      );
    return {
      workspaceId: input.workspaceId,
      folderId: input.folderId,
      path,
      fingerprint,
    };
  }
}
