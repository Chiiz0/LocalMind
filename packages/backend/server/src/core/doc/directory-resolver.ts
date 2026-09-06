import { createHash } from 'node:crypto';

import {
  Args,
  Field,
  ID,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { z } from 'zod';

import { BadRequest, Throttle } from '../../base';
import { Models } from '../../models';
import {
  WORKSPACE_DIRECTORY_MEMBERS,
  WORKSPACE_DIRECTORY_ROOT,
} from '../../models/workspace-directory-grant';
import { type CurrentUser as Actor, CurrentUser } from '../auth/session';
import { PermissionAccess } from '../permission';
import { RealtimePublisher } from '../realtime/publisher';
import { realtimeWorkspaceDirectoryPolicyRoom } from '../realtime/rooms';
import { WorkspaceOrganizationService } from './workspace-organization';

@ObjectType()
class WorkspaceDirectoryRightsType {
  @Field() canRead!: boolean;
  @Field() canWrite!: boolean;
  @Field() canOrganize!: boolean;
  @Field() canCreateFolder!: boolean;
}

@InputType()
class WorkspaceDirectoryRightsInput {
  @Field() canRead!: boolean;
  @Field() canWrite!: boolean;
  @Field() canOrganize!: boolean;
  @Field() canCreateFolder!: boolean;
}

@ObjectType()
class WorkspaceDirectoryPolicyDirectoryType {
  @Field(() => ID) id!: string;
  @Field(() => ID, { nullable: true }) parentId!: string | null;
  @Field() name!: string;
}

@ObjectType()
class WorkspaceDirectoryPolicyPrincipalType {
  @Field(() => ID) id!: string;
  @Field(() => String, { nullable: true }) name!: string | null;
  @Field(() => String, { nullable: true }) email!: string | null;
  @Field() allMembers!: boolean;
}

@ObjectType()
class WorkspaceDirectoryPolicyType {
  @Field(() => ID) directoryId!: string;
  @Field(() => ID) principalId!: string;
  @Field(() => WorkspaceDirectoryRightsType)
  rights!: WorkspaceDirectoryRightsType;
  @Field(() => Date) updatedAt!: Date;
}

@ObjectType()
class WorkspaceDirectoryPolicyAuditType {
  @Field(() => ID) id!: string;
  @Field(() => ID) actorId!: string;
  @Field(() => ID) directoryId!: string;
  @Field(() => ID) principalId!: string;
  @Field() action!: string;
  @Field(() => WorkspaceDirectoryRightsType, { nullable: true })
  before!: WorkspaceDirectoryRightsType | null;
  @Field(() => WorkspaceDirectoryRightsType, { nullable: true })
  after!: WorkspaceDirectoryRightsType | null;
  @Field(() => Date) createdAt!: Date;
}

@ObjectType()
class WorkspaceDirectoryAdministrationType {
  @Field() revision!: string;
  @Field(() => [WorkspaceDirectoryPolicyDirectoryType])
  directories!: WorkspaceDirectoryPolicyDirectoryType[];
  @Field(() => [WorkspaceDirectoryPolicyPrincipalType])
  principals!: WorkspaceDirectoryPolicyPrincipalType[];
  @Field(() => [WorkspaceDirectoryPolicyType])
  policies!: WorkspaceDirectoryPolicyType[];
  @Field(() => [WorkspaceDirectoryPolicyAuditType])
  auditEvents!: WorkspaceDirectoryPolicyAuditType[];
  @Field(() => String, { nullable: true })
  auditNextCursor!: string | null;
}

@ObjectType()
class WorkspaceDirectoryPolicyMutationType {
  @Field() revision!: string;
  @Field(() => WorkspaceDirectoryPolicyType, { nullable: true })
  policy!: WorkspaceDirectoryPolicyType | null;
}

@ObjectType()
class WorkspaceDirectoryEntryType {
  @Field(() => ID) id!: string;
  @Field(() => ID, { nullable: true }) parentId!: string | null;
  @Field() type!: string;
  @Field() data!: string;
  @Field() index!: string;
  @Field(() => WorkspaceDirectoryRightsType)
  rights!: WorkspaceDirectoryRightsType;
}

@ObjectType()
class WorkspaceDirectoryPageType {
  @Field() revision!: string;
  @Field() authorizationRevision!: string;
  @Field(() => [WorkspaceDirectoryEntryType])
  items!: WorkspaceDirectoryEntryType[];
  @Field(() => String, { nullable: true }) nextCursor!: string | null;
  @Field() fullSyncAllowed!: boolean;
  @Field(() => WorkspaceDirectoryRightsType)
  rootRights!: WorkspaceDirectoryRightsType;
}

@InputType()
class WorkspaceDirectoryValuesInput {
  @Field() type!: string;
  @Field() data!: string;
  @Field() index!: string;
  @Field(() => ID, { nullable: true }) parentId!: string | null;
}

@InputType()
class WorkspaceDirectoryChangeInput {
  @Field() op!: string;
  @Field(() => ID) key!: string;
  @Field(() => WorkspaceDirectoryValuesInput, { nullable: true })
  values?: WorkspaceDirectoryValuesInput;
}

@ObjectType()
class WorkspaceDirectoryMutationType {
  @Field() revision!: string;
}

const entrySchema = z.object({
  id: z.string().min(1).max(256),
  parentId: z.string().min(1).max(256).nullish(),
  type: z.enum(['folder', 'doc', 'tag', 'collection']),
  data: z.string().min(1).max(512),
  index: z.string().min(1).max(256),
});

@Throttle()
@Resolver()
export class WorkspaceDirectoryResolver {
  constructor(
    private readonly models: Models,
    private readonly ac: PermissionAccess,
    private readonly organization: WorkspaceOrganizationService,
    private readonly realtime: RealtimePublisher
  ) {}

  private mapPolicy(policy: {
    directoryId: string;
    principalId: string;
    canRead: boolean;
    canWrite: boolean;
    canOrganize: boolean;
    canCreateFolder: boolean;
    updatedAt: Date;
  }): WorkspaceDirectoryPolicyType {
    return {
      directoryId: policy.directoryId,
      principalId: policy.principalId,
      rights: {
        canRead: policy.canRead,
        canWrite: policy.canWrite,
        canOrganize: policy.canOrganize,
        canCreateFolder: policy.canCreateFolder,
      },
      updatedAt: policy.updatedAt,
    };
  }

  @Query(() => WorkspaceDirectoryAdministrationType)
  async workspaceDirectoryAdministration(
    @CurrentUser() actor: Actor,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('auditAfter', { type: () => String, nullable: true })
    auditAfter?: string
  ) {
    if (
      !workspaceId ||
      workspaceId.length > 256 ||
      (auditAfter?.length ?? 0) > 256
    )
      throw new BadRequest('Invalid directory permission administration');
    return await this.models.workspaceDirectoryGrant.withAdministrationLock(
      workspaceId,
      actor.id,
      async () => {
        const rows = await this.organization.readFoldersForAdministration(
          workspaceId,
          actor.id
        );
        const directories = rows.flatMap(row => {
          const parsed = entrySchema.safeParse(row);
          return parsed.success && parsed.data.type === 'folder'
            ? [
                {
                  id: parsed.data.id,
                  parentId: parsed.data.parentId ?? null,
                  name: parsed.data.data,
                },
              ]
            : [];
        });
        if (directories.length > 10_000)
          throw new BadRequest(
            'Directory permission administration exceeds its supported limit'
          );
        const directoryRevision = await this.organization.directoryRevision(
          workspaceId,
          actor.id
        );
        const [principals, policies, auditEvents] = await Promise.all([
          this.models.workspaceDirectoryGrant.principals(workspaceId, actor.id),
          this.models.workspaceDirectoryGrant.policies(workspaceId, actor.id),
          this.models.workspaceDirectoryGrant.history(
            workspaceId,
            actor.id,
            auditAfter
          ),
        ]);
        return {
          revision:
            await this.models.workspaceDirectoryGrant.administrationRevision(
              workspaceId,
              actor.id,
              directoryRevision
            ),
          directories: [
            { id: WORKSPACE_DIRECTORY_ROOT, parentId: null, name: 'Root' },
            ...directories,
          ],
          principals: [
            {
              id: WORKSPACE_DIRECTORY_MEMBERS,
              name: 'All Workspace members',
              email: null,
              allMembers: true,
            },
            ...principals.map(principal => ({
              ...principal,
              allMembers: false,
            })),
          ],
          policies: policies.map(policy => this.mapPolicy(policy)),
          auditEvents: auditEvents.map(event => ({
            ...event,
            before: event.before,
            after: event.after,
          })),
          auditNextCursor:
            auditEvents.length === 50 ? (auditEvents.at(-1)?.id ?? null) : null,
        };
      }
    );
  }

  @Mutation(() => WorkspaceDirectoryPolicyMutationType)
  async changeWorkspaceDirectoryPolicy(
    @CurrentUser() actor: Actor,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('expectedRevision') expectedRevision: string,
    @Args('directoryId', { type: () => ID }) directoryId: string,
    @Args('principalId', { type: () => ID }) principalId: string,
    @Args('rights', {
      type: () => WorkspaceDirectoryRightsInput,
      nullable: true,
    })
    rights?: WorkspaceDirectoryRightsInput | null
  ) {
    if (
      !workspaceId ||
      workspaceId.length > 256 ||
      !/^[a-f0-9]{64}$/.test(expectedRevision)
    )
      throw new BadRequest('Invalid directory permission change');
    const result = await this.models.workspaceDirectoryGrant.changeConditional(
      {
        workspaceId,
        actorId: actor.id,
        directoryId,
        principalId,
        rights: rights ?? null,
        expectedRevision,
      },
      {
        directoryRevision: async () =>
          await this.organization.directoryRevision(workspaceId, actor.id),
        assertDirectoryTarget: async () => {
          if (!rights || directoryId === WORKSPACE_DIRECTORY_ROOT) return;
          const folders = await this.organization.readFoldersForAdministration(
            workspaceId,
            actor.id
          );
          if (
            !folders.some(
              folder => folder.id === directoryId && folder.type === 'folder'
            )
          )
            throw new BadRequest(
              'Directory permission target no longer exists'
            );
        },
      }
    );
    this.realtime.publishChanged(
      'workspace.directory-policy.changed',
      { workspaceId },
      'directory-policy-updated',
      { room: realtimeWorkspaceDirectoryPolicyRoom(workspaceId) }
    );
    return {
      revision: result.revision,
      policy: result.policy ? this.mapPolicy(result.policy) : null,
    };
  }

  @Mutation(() => WorkspaceDirectoryMutationType)
  async mutateWorkspaceDirectory(
    @CurrentUser() actor: Actor,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('expectedRevision') expectedRevision: string,
    @Args('changes', { type: () => [WorkspaceDirectoryChangeInput] })
    changes: WorkspaceDirectoryChangeInput[]
  ) {
    if (
      !workspaceId ||
      workspaceId.length > 256 ||
      !/^[a-f0-9]{64}$/.test(expectedRevision)
    )
      throw new BadRequest('Invalid directory mutation');
    const parsed = z
      .array(
        z.discriminatedUnion('op', [
          z.object({
            op: z.literal('upsert'),
            key: z.string().min(1).max(256),
            values: entrySchema
              .omit({ id: true })
              .extend({ parentId: z.string().min(1).max(256).nullable() }),
          }),
          z.object({
            op: z.literal('delete'),
            key: z.string().min(1).max(256),
          }),
        ])
      )
      .min(1)
      .max(100)
      .safeParse(changes);
    if (!parsed.success) throw new BadRequest('Invalid directory changes');
    return await this.models.workspaceDirectoryGrant.withMutationLock(
      workspaceId,
      async () => {
        await this.ac
          .user(actor.id)
          .workspace(workspaceId)
          .assert('Workspace.Organize.Read');
        await this.ac
          .user(actor.id)
          .doc(workspaceId, `db$${workspaceId}$folders`)
          .projectScope(null)
          .assert('Doc.Update');
        return await this.organization.applyConditionalFolderOperations({
          workspaceId,
          actorId: actor.id,
          expectedRevision,
          operations: parsed.data,
          authorizeDocument: async docId => {
            await this.ac
              .user(actor.id)
              .doc(workspaceId, docId)
              .projectScope(null)
              .assert('Doc.Read');
          },
        });
      }
    );
  }

  @Query(() => WorkspaceDirectoryPageType)
  async workspaceDirectory(
    @CurrentUser() actor: Actor,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('after', { type: () => String, nullable: true }) after?: string
  ) {
    if (!workspaceId || workspaceId.length > 256 || (after?.length ?? 0) > 256)
      throw new BadRequest('Invalid directory page');
    return await this.models.workspaceDirectoryGrant.withMutationLock(
      workspaceId,
      async () => {
        await this.ac
          .user(actor.id)
          .workspace(workspaceId)
          .assert('Workspace.Organize.Read');
        const snapshot = await this.organization.readDirectory(
          workspaceId,
          actor.id
        );
        const rows = snapshot.entries.flatMap(({ row, rights }) => {
          const parsed = entrySchema.safeParse(row);
          return parsed.success
            ? [
                {
                  ...parsed.data,
                  parentId: parsed.data.parentId ?? null,
                  rights,
                },
              ]
            : [];
        });
        const byId = new Map(rows.map(row => [row.id, row]));
        const candidates = rows
          .filter(row => {
            let parentId = row.parentId;
            for (let depth = 0; parentId !== null; depth++) {
              const parent = byId.get(parentId);
              if (!parent || parent.type !== 'folder' || depth >= 64)
                return false;
              parentId = parent.parentId;
            }
            return true;
          })
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        const readable = new Set<string>();
        const documents = candidates.flatMap(row =>
          row.type === 'doc' ? [{ docId: row.data }] : []
        );
        // Bound native permission payloads while sharing the workspace context
        // within each batch. Every page still checks current personal ACL.
        for (let offset = 0; offset < documents.length; offset += 500) {
          const allowed = await this.ac
            .user(actor.id)
            .workspace(workspaceId)
            .projectScope(null)
            .docs(documents.slice(offset, offset + 500), 'Doc.Read');
          for (const document of allowed) readable.add(document.docId);
        }
        const items: WorkspaceDirectoryEntryType[] = [];
        for (const row of candidates) {
          if (row.type === 'doc' && !readable.has(row.data)) continue;
          items.push(row);
        }
        const { fullSyncAllowed, rootRights } = snapshot;
        // Include the entire visible authorization snapshot on every page: a
        // content-only revision cannot detect policy changes between requests.
        const authorizationRevision = createHash('sha256')
          .update(
            JSON.stringify({
              workspaceId,
              actorId: actor.id,
              fullSyncAllowed,
              rootRights,
              entries: items.map(item => ({
                id: item.id,
                rights: item.rights,
              })),
            })
          )
          .digest('hex');
        const page = items
          .filter(item => !after || item.id > after)
          .slice(0, 100);
        return {
          revision: snapshot.revision,
          authorizationRevision,
          items: page,
          nextCursor: page.length === 100 ? (page.at(-1)?.id ?? null) : null,
          fullSyncAllowed,
          rootRights,
        };
      }
    );
  }
}
