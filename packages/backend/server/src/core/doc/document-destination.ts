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
});
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
