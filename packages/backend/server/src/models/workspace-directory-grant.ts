import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Prisma } from '@prisma/client';

import { BadRequest, NotFound } from '../base';
import { BaseModel } from './base';
import { permissionWorkspaceLockKey } from './permission-write';

export const WORKSPACE_DIRECTORY_ROOT = '$root';
export const WORKSPACE_DIRECTORY_MEMBERS = '*';
export type DirectoryRights = {
  canRead: boolean;
  canWrite: boolean;
  canOrganize: boolean;
  canCreateFolder: boolean;
};

type DirectoryPolicyIdentity = {
  workspaceId: string;
  directoryId: string;
  principalId: string;
};

// This snapshot is owned by one request/transaction, never a process cache.
export function directoryPolicySnapshot(
  actorId: string,
  rows: Array<DirectoryRights & { directoryId: string; principalId: string }>
) {
  const policies = new Map<string, DirectoryRights>();
  for (const row of rows) {
    if (row.principalId === WORKSPACE_DIRECTORY_MEMBERS)
      policies.set(row.directoryId, row);
  }
  for (const row of rows) {
    if (row.principalId === actorId) policies.set(row.directoryId, row);
  }
  return {
    fullSyncAllowed: [...policies.values()].every(row => row.canRead),
    rights(directoryIds: string[]): DirectoryRights {
      if (directoryIds.length > 64)
        throw new BadRequest(
          'Directory nesting exceeds its authorization limit'
        );
      const rights: DirectoryRights = {
        canRead: true,
        canWrite: true,
        canOrganize: true,
        canCreateFolder: true,
      };
      for (const directoryId of new Set([
        WORKSPACE_DIRECTORY_ROOT,
        ...directoryIds,
      ])) {
        const row = policies.get(directoryId);
        if (!row) continue;
        rights.canRead &&= row.canRead;
        rights.canWrite &&= row.canWrite;
        rights.canOrganize &&= row.canOrganize;
        rights.canCreateFolder &&= row.canCreateFolder;
      }
      return rights;
    },
  };
}

@Injectable()
export class WorkspaceDirectoryGrantModel extends BaseModel {
  private async lock(workspaceId: string) {
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`directory-authorization:${workspaceId}`}, 0))`;
  }

  @Transactional()
  async withMutationLock<T>(workspaceId: string, operation: () => Promise<T>) {
    await this.lock(workspaceId);
    return await operation();
  }

  async memberWorkspaces(actorId: string) {
    return await this.db.workspaceMember.findMany({
      where: { userId: actorId, state: 'active' },
      select: { workspace: { select: { id: true, name: true } } },
      orderBy: { workspaceId: 'asc' },
      take: 200,
    });
  }

  async canReadWholeTable(workspaceId: string, actorId: string) {
    return (await this.snapshot(workspaceId, actorId)).fullSyncAllowed;
  }

  async snapshot(workspaceId: string, actorId: string) {
    const rows = await this.db.workspaceDirectoryGrant.findMany({
      where: {
        workspaceId,
        principalId: { in: [WORKSPACE_DIRECTORY_MEMBERS, actorId] },
      },
      select: {
        directoryId: true,
        principalId: true,
        canRead: true,
        canWrite: true,
        canOrganize: true,
        canCreateFolder: true,
      },
      take: 20_003,
    });
    if (rows.length > 20_002)
      throw new BadRequest('Directory policies exceed the supported limit');
    return directoryPolicySnapshot(actorId, rows);
  }
  async rights(input: {
    workspaceId: string;
    actorId: string;
    directoryIds: string[];
  }): Promise<DirectoryRights> {
    if (input.directoryIds.length > 64)
      throw new BadRequest('Directory nesting exceeds its authorization limit');
    const rows = await this.db.workspaceDirectoryGrant.findMany({
      where: {
        workspaceId: input.workspaceId,
        directoryId: { in: [WORKSPACE_DIRECTORY_ROOT, ...input.directoryIds] },
        principalId: { in: [WORKSPACE_DIRECTORY_MEMBERS, input.actorId] },
      },
    });
    return directoryPolicySnapshot(input.actorId, rows).rights(
      input.directoryIds
    );
  }

  async assertAdministrator(workspaceId: string, actorId: string) {
    const admin = await this.db.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: actorId,
        state: 'active',
        role: { in: ['owner', 'admin'] },
      },
      select: { userId: true },
    });
    if (!admin)
      throw new NotFound('Directory permission administration is unavailable');
  }

  @Transactional()
  async withAdministrationLock<T>(
    workspaceId: string,
    actorId: string,
    operation: () => Promise<T>
  ) {
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${permissionWorkspaceLockKey(workspaceId)}, 0))`;
    await this.lock(workspaceId);
    await this.assertAdministrator(workspaceId, actorId);
    return await operation();
  }

  async policies(workspaceId: string, actorId: string) {
    await this.assertAdministrator(workspaceId, actorId);
    return await this.listPolicies(workspaceId);
  }

  private async listPolicies(workspaceId: string) {
    return await this.db.workspaceDirectoryGrant.findMany({
      where: { workspaceId },
      orderBy: [{ directoryId: 'asc' }, { principalId: 'asc' }],
    });
  }

  private async revision(workspaceId: string, directoryRevision: string) {
    const policies = (await this.listPolicies(workspaceId)).map(policy => ({
      directoryId: policy.directoryId,
      principalId: policy.principalId,
      canRead: policy.canRead,
      canWrite: policy.canWrite,
      canOrganize: policy.canOrganize,
      canCreateFolder: policy.canCreateFolder,
    }));
    return createHash('sha256')
      .update(JSON.stringify({ directoryRevision, policies }))
      .digest('hex');
  }

  async administrationRevision(
    workspaceId: string,
    actorId: string,
    directoryRevision: string
  ) {
    await this.assertAdministrator(workspaceId, actorId);
    return await this.revision(workspaceId, directoryRevision);
  }

  async principals(workspaceId: string, actorId: string) {
    await this.assertAdministrator(workspaceId, actorId);
    const members = await this.db.workspaceMember.findMany({
      where: { workspaceId, state: 'active' },
      select: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { userId: 'asc' },
      take: 1001,
    });
    if (members.length > 1000)
      throw new BadRequest(
        'Directory policy member list exceeds its supported limit'
      );
    return members.map(member => member.user);
  }

  async history(workspaceId: string, actorId: string, after?: string) {
    await this.assertAdministrator(workspaceId, actorId);
    const cursor = after
      ? await this.db.workspaceDirectoryPolicyEvent.findFirst({
          where: { id: after, workspaceId },
        })
      : null;
    if (after && !cursor)
      throw new BadRequest('Directory audit cursor is unavailable');
    return await this.db.workspaceDirectoryPolicyEvent.findMany({
      where: {
        workspaceId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
  }

  // Human administration only; never registered as an AI tool.
  async set(input: {
    workspaceId: string;
    actorId: string;
    directoryId: string;
    principalId: string;
    rights: DirectoryRights;
  }) {
    return await this.change(input);
  }

  async changeConditional(
    input: {
      workspaceId: string;
      actorId: string;
      directoryId: string;
      principalId: string;
      rights: DirectoryRights | null;
      expectedRevision: string;
    },
    options: {
      directoryRevision: () => Promise<string>;
      assertDirectoryTarget: () => Promise<void>;
    }
  ) {
    return await this.withAdministrationLock(
      input.workspaceId,
      input.actorId,
      async () => {
        const directoryRevision = await options.directoryRevision();
        const revision = await this.revision(
          input.workspaceId,
          directoryRevision
        );
        if (revision !== input.expectedRevision)
          throw new BadRequest(
            'Directory permissions changed; refresh before editing'
          );
        await options.assertDirectoryTarget();
        const policy = await this.changeLocked(input);
        return {
          policy,
          revision: await this.revision(input.workspaceId, directoryRevision),
        };
      }
    );
  }

  async change(input: {
    workspaceId: string;
    actorId: string;
    directoryId: string;
    principalId: string;
    rights: DirectoryRights | null;
  }) {
    return await this.withAdministrationLock(
      input.workspaceId,
      input.actorId,
      async () => await this.changeLocked(input)
    );
  }

  private async changeLocked(
    input: DirectoryPolicyIdentity & {
      actorId: string;
      rights: DirectoryRights | null;
    }
  ) {
    if (
      !input.directoryId ||
      input.directoryId.length > 256 ||
      !input.principalId ||
      input.principalId.length > 256
    )
      throw new BadRequest('Invalid directory permission target');
    if (
      input.rights &&
      (Object.keys(input.rights).sort().join(',') !==
        'canCreateFolder,canOrganize,canRead,canWrite' ||
        Object.values(input.rights).some(value => typeof value !== 'boolean'))
    )
      throw new BadRequest('Directory permissions must be boolean');
    if (input.rights && input.principalId !== WORKSPACE_DIRECTORY_MEMBERS) {
      const member = await this.db.workspaceMember.findFirst({
        where: {
          workspaceId: input.workspaceId,
          userId: input.principalId,
          state: 'active',
        },
        select: { userId: true },
      });
      if (!member)
        throw new BadRequest(
          'Directory permission principal must be an active Workspace member'
        );
    }
    const identity: DirectoryPolicyIdentity = {
      workspaceId: input.workspaceId,
      directoryId: input.directoryId,
      principalId: input.principalId,
    };
    const before = await this.db.workspaceDirectoryGrant.findUnique({
      where: { workspaceId_directoryId_principalId: identity },
    });
    const evidence = (rights: DirectoryRights) => ({
      canRead: rights.canRead,
      canWrite: rights.canWrite,
      canOrganize: rights.canOrganize,
      canCreateFolder: rights.canCreateFolder,
    });
    if (
      JSON.stringify(before ? evidence(before) : null) ===
      JSON.stringify(input.rights ? evidence(input.rights) : null)
    )
      return before;
    const changed = input.rights
      ? await this.db.workspaceDirectoryGrant.upsert({
          where: { workspaceId_directoryId_principalId: identity },
          create: { ...identity, ...input.rights },
          update: input.rights,
        })
      : null;
    if (!input.rights)
      await this.db.workspaceDirectoryGrant.deleteMany({ where: identity });
    await this.db.workspaceDirectoryPolicyEvent.create({
      data: {
        ...identity,
        actorId: input.actorId,
        action: input.rights ? 'set' : 'clear',
        before: before ? evidence(before) : Prisma.DbNull,
        after: input.rights ? evidence(input.rights) : Prisma.DbNull,
      },
    });
    return changed;
  }
}
