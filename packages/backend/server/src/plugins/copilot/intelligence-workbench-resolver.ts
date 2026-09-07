import { NotFoundException } from '@nestjs/common';
import {
  Args,
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type {
  AccessRequest,
  AiContextProjectBlocker,
  AiContextProjectGrant,
  AiContextProjectInvitation,
} from '@prisma/client';

import { BadRequest, Throttle } from '../../base';
import type { CurrentUser as CurrentUserType } from '../../core/auth';
import { CurrentUser } from '../../core/auth';
import { PermissionAccess } from '../../core/permission';
import {
  INTELLIGENCE_WORKBENCH_ACCESS_REQUEST_STATUSES,
  INTELLIGENCE_WORKBENCH_BLOCKER_STATUSES,
  INTELLIGENCE_WORKBENCH_BLOCKER_TYPES,
  INTELLIGENCE_WORKBENCH_INVITATION_STATUSES,
  type IntelligenceWorkbenchAccessRequestStatus,
  type IntelligenceWorkbenchBlockerStatus,
  type IntelligenceWorkbenchBlockerType,
  type IntelligenceWorkbenchInvitationStatus,
  type IntelligenceWorkbenchTaskItem,
  Models,
} from '../../models';
import {
  CopilotTaskType,
  CopilotType,
  projectCopilotTaskForViewer,
} from './resolver';

const ACCESS_REQUEST_VIEWS = [
  'requester',
  'beneficiary',
  'project',
  'source',
] as const;
type AccessRequestView = (typeof ACCESS_REQUEST_VIEWS)[number];

const PROJECT_INVITATION_DIRECTIONS = [
  'incoming',
  'outgoing',
  'project',
] as const;
type ProjectInvitationDirection =
  (typeof PROJECT_INVITATION_DIRECTIONS)[number];

type PresentableAccessRequest = AccessRequest & {
  projectGrant?: { status: string } | null;
  requesterSuppliedIdentity?: boolean;
};

@ObjectType()
export class CopilotAccessRequestType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => String, { nullable: true })
  docId!: string | null;

  @Field(() => String)
  beneficiaryType!: string;

  @Field(() => String, { nullable: true })
  beneficiaryUserId!: string | null;

  @Field(() => String, { nullable: true })
  beneficiaryProjectId!: string | null;

  @Field(() => String)
  requesterUserId!: string;

  @Field(() => String)
  requestedLevel!: string;

  @Field(() => String)
  purpose!: string;

  @Field(() => String, { nullable: true })
  requestedTitle!: string | null;

  @Field(() => String)
  status!: string;

  @Field(() => String, { nullable: true })
  resolvedByUserId!: string | null;

  @Field(() => String, { nullable: true })
  resolutionReason!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  resolvedAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  expiresAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType()
export class CopilotProjectInvitationType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  projectId!: string;

  @Field(() => String)
  inviteeUserId!: string;

  @Field(() => String)
  inviterUserId!: string;

  @Field(() => String)
  status!: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  acceptedAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  declinedAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  withdrawnAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType()
export class CopilotProjectGrantType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  projectId!: string;

  @Field(() => String)
  projectName!: string;

  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  docId!: string;

  @Field(() => String)
  level!: string;

  @Field(() => String)
  status!: string;

  @Field(() => String)
  source!: string;

  @Field(() => String)
  approvingSide!: string;

  @Field(() => Boolean)
  revocable!: boolean;

  @Field(() => String, { nullable: true })
  grantedByUserId!: string | null;

  @Field(() => String, { nullable: true })
  accessRequestId!: string | null;

  @Field(() => GraphQLISODateTime)
  grantedAt!: Date;

  @Field(() => String, { nullable: true })
  revokedByUserId!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  revokedAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType()
export class CopilotProjectGrantRevocationType {
  @Field(() => CopilotProjectGrantType)
  grant!: CopilotProjectGrantType;

  @Field(() => String, { nullable: true })
  rerequestCardId!: string | null;

  @Field(() => Int)
  quarantinedMemoryCount!: number;
}

@ObjectType()
export class CopilotProjectAiPolicyType {
  @Field(() => ID)
  projectId!: string;

  @Field(() => String)
  policy!: string;

  @Field(() => String, { nullable: true })
  updatedByUserId!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  updatedAt!: Date | null;
}

@ObjectType()
export class CopilotBlockerType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  projectId!: string;

  @Field(() => String)
  creatorUserId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  type!: string;

  @Field(() => String)
  waitingOn!: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  dueAt!: Date | null;

  @Field(() => Boolean)
  overdue!: boolean;

  @Field(() => String)
  status!: string;

  @Field(() => String)
  origin!: string;

  @Field(() => String, { nullable: true })
  resolutionActorUserId!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  resolvedAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@InputType()
export class CreateCopilotBlockerInput {
  @Field(() => ID)
  projectId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  type!: IntelligenceWorkbenchBlockerType;

  @Field(() => String)
  waitingOn!: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  dueAt?: Date;
}

@InputType()
export class CopilotBlockerSuggestionInput {
  @Field(() => String)
  aiSuggestionId!: string;

  @Field(() => String)
  confirmationProof!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  type!: IntelligenceWorkbenchBlockerType;

  @Field(() => String)
  waitingOn!: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  dueAt?: Date | null;

  @Field(() => String)
  origin!: 'ai_suggested';

  @Field(() => Boolean)
  confirmationRequired!: true;
}

@InputType()
export class ConfirmCopilotBlockerSuggestionInput {
  @Field(() => ID)
  projectId!: string;

  @Field(() => CopilotBlockerSuggestionInput)
  suggestion!: CopilotBlockerSuggestionInput;
}

@InputType()
export class RequestCopilotDocumentAccessInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => String)
  docId!: string;

  @Field(() => String, { nullable: true })
  projectId?: string;

  @Field(() => String, { nullable: true, defaultValue: 'read' })
  requestedLevel?: 'read' | 'write';

  @Field(() => String, { nullable: true })
  requestedTitle?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  expiresAt?: Date;

  @Field(() => String, { nullable: true })
  idempotencyKey?: string;
}

@InputType()
export class ResolveCopilotAccessRequestInput {
  @Field(() => ID)
  requestId!: string;

  @Field(() => String, { nullable: true })
  reason?: string;
}

@InputType()
export class SendCopilotProjectInvitationInput {
  @Field(() => ID)
  projectId!: string;

  @Field(() => String)
  email!: string;
}

@InputType()
export class RevokeCopilotProjectGrantInput {
  @Field(() => ID)
  grantId!: string;

  @Field(() => String, { nullable: true })
  reason?: string;
}

@InputType()
export class ReRequestCopilotProjectDocumentInput {
  @Field(() => ID)
  grantId!: string;

  @Field(() => String, { nullable: true })
  idempotencyKey?: string;
}

@InputType()
export class SetCopilotProjectAiPolicyInput {
  @Field(() => ID)
  projectId!: string;

  @Field(() => String)
  policy!: 'read_only' | 'read_write';
}

@InputType()
export class RemoveCopilotProjectMemberInput {
  @Field(() => ID)
  projectId!: string;

  @Field(() => String)
  memberUserId!: string;
}

@InputType()
export class TransferCopilotProjectOwnershipInput {
  @Field(() => ID)
  projectId!: string;

  @Field(() => String)
  memberUserId!: string;
}

@ObjectType()
export class CopilotWorkbenchBlockerTaskType {
  @Field(() => String)
  creatorUserId!: string;

  @Field(() => String)
  type!: string;

  @Field(() => String)
  waitingOn!: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  dueAt!: Date | null;

  @Field(() => Boolean)
  overdue!: boolean;

  @Field(() => String)
  origin!: string;

  @Field(() => String, { nullable: true })
  resolutionActorUserId!: string | null;
}

@ObjectType()
export class CopilotWorkbenchTaskItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  entityId!: string;

  @Field(() => String)
  kind!: string;

  @Field(() => String)
  segment!: string;

  @Field(() => String, { nullable: true })
  attention!: string | null;

  @Field(() => String, { nullable: true })
  workspaceId!: string | null;

  @Field(() => String, { nullable: true })
  projectId!: string | null;

  @Field(() => String, { nullable: true })
  title!: string | null;

  @Field(() => String)
  status!: string;

  @Field(() => String, { nullable: true })
  requestedLevel!: string | null;

  @Field(() => String, { nullable: true })
  documentId!: string | null;

  @Field(() => Boolean)
  redacted!: boolean;

  @Field(() => String, { nullable: true })
  relatedUserId!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  completedAt!: Date | null;

  @Field(() => [String])
  availableActions!: string[];

  @Field(() => CopilotTaskType, { nullable: true })
  run!: CopilotTaskType | null;

  @Field(() => CopilotWorkbenchBlockerTaskType, { nullable: true })
  blocker!: CopilotWorkbenchBlockerTaskType | null;
}

@ObjectType()
export class CopilotWorkbenchTaskSegmentType {
  @Field(() => [CopilotWorkbenchTaskItemType])
  items!: CopilotWorkbenchTaskItemType[];

  @Field(() => Boolean)
  capped!: boolean;
}

@ObjectType()
export class CopilotWorkbenchTaskPanelType {
  @Field(() => CopilotWorkbenchTaskSegmentType)
  todo!: CopilotWorkbenchTaskSegmentType;

  @Field(() => CopilotWorkbenchTaskSegmentType)
  inProgress!: CopilotWorkbenchTaskSegmentType;

  @Field(() => CopilotWorkbenchTaskSegmentType)
  done!: CopilotWorkbenchTaskSegmentType;
}

@ObjectType()
export class CopilotWorkbenchTaskListType {
  @Field(() => [CopilotWorkbenchTaskItemType])
  items!: CopilotWorkbenchTaskItemType[];

  @Field(() => Boolean)
  capped!: boolean;

  @Field(() => String, { nullable: true })
  nextCursor!: string | null;
}

@Resolver(() => CopilotType)
@Throttle()
export class IntelligenceWorkbenchResolver {
  constructor(
    private readonly ac: PermissionAccess,
    private readonly models: Models
  ) {}

  private presentAccessRequest(
    request: PresentableAccessRequest,
    actorUserId: string,
    sourceView = false
  ): CopilotAccessRequestType {
    const identityVisible =
      sourceView ||
      request.beneficiaryType === 'user' ||
      (request.requesterSuppliedIdentity !== false &&
        request.requesterUserIdSnapshot === actorUserId) ||
      request.projectGrant?.status === 'active';
    return {
      id: request.id,
      workspaceId: request.workspaceId,
      docId: identityVisible ? request.docId : null,
      beneficiaryType: request.beneficiaryType,
      beneficiaryUserId: request.beneficiaryUserId,
      beneficiaryProjectId: request.beneficiaryProjectId,
      requesterUserId:
        request.requesterUserId ?? request.requesterUserIdSnapshot,
      requestedLevel: request.requestedLevel,
      purpose: request.purpose,
      requestedTitle: identityVisible ? request.requestedTitle : null,
      status: request.status,
      resolvedByUserId: request.resolvedByUserId,
      resolutionReason: request.resolutionReason,
      resolvedAt: request.resolvedAt,
      expiresAt: request.expiresAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private presentInvitation(
    invitation: AiContextProjectInvitation | null
  ): CopilotProjectInvitationType {
    if (!invitation)
      throw new NotFoundException('Project invitation not found');
    return {
      id: invitation.id,
      projectId: invitation.projectId,
      inviteeUserId: invitation.inviteeUserId,
      inviterUserId:
        invitation.inviterUserId ?? invitation.inviterUserIdSnapshot,
      status: invitation.status,
      acceptedAt: invitation.acceptedAt,
      declinedAt: invitation.declinedAt,
      withdrawnAt: invitation.withdrawnAt,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
    };
  }

  private presentGrant(
    grant: (AiContextProjectGrant & { project: { name: string } }) | null
  ): CopilotProjectGrantType {
    if (!grant) throw new NotFoundException('Project grant not found');
    return {
      id: grant.id,
      projectId: grant.projectId,
      projectName: grant.project.name,
      workspaceId: grant.workspaceId,
      docId: grant.docId,
      level: grant.level,
      status: grant.status,
      source: grant.source,
      approvingSide: grant.approvingSide,
      revocable: grant.revocable,
      grantedByUserId: grant.grantedByUserId ?? grant.grantorUserIdSnapshot,
      accessRequestId: grant.accessRequestId,
      grantedAt: grant.grantedAt,
      revokedByUserId: grant.revokedByUserId ?? grant.revokerUserIdSnapshot,
      revokedAt: grant.revokedAt,
      createdAt: grant.createdAt,
      updatedAt: grant.updatedAt,
    };
  }

  private presentBlocker(blocker: AiContextProjectBlocker): CopilotBlockerType {
    return {
      id: blocker.id,
      projectId: blocker.projectId,
      creatorUserId: blocker.creatorUserId ?? blocker.creatorUserIdSnapshot,
      title: blocker.title,
      type: blocker.type,
      waitingOn: blocker.waitingOn,
      dueAt: blocker.dueAt,
      overdue:
        blocker.status === 'waiting' &&
        blocker.dueAt !== null &&
        blocker.dueAt.getTime() < Date.now(),
      status: blocker.status,
      origin: blocker.origin,
      resolutionActorUserId:
        blocker.resolutionActorUserId ?? blocker.resolutionActorUserIdSnapshot,
      resolvedAt: blocker.resolvedAt,
      createdAt: blocker.createdAt,
      updatedAt: blocker.updatedAt,
    };
  }

  private async presentTaskItem(
    item: IntelligenceWorkbenchTaskItem,
    userId: string
  ): Promise<CopilotWorkbenchTaskItemType> {
    const run = item.run
      ? await projectCopilotTaskForViewer(item.run, userId, this.ac)
      : null;
    return {
      id: item.id,
      entityId: item.entityId,
      kind: item.kind,
      segment: item.segment,
      attention: item.attention,
      workspaceId: item.workspaceId,
      projectId: item.projectId,
      title: item.title,
      status: item.status,
      requestedLevel: item.requestedLevel,
      documentId: item.documentId,
      redacted: item.redacted,
      relatedUserId: item.relatedUserId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      completedAt: item.completedAt,
      availableActions: run?.availableActions ?? item.availableActions,
      run,
      blocker: item.blocker,
    };
  }

  @ResolveField(() => [CopilotBlockerType], {
    description:
      'List reminder-only Blockers visible through active global Project membership.',
    complexity: 2,
  })
  async workbenchBlockers(
    @Parent() copilot: CopilotType,
    @CurrentUser() user: CurrentUserType,
    @Args('projectId', { type: () => ID, nullable: true }) projectId?: string,
    @Args('statuses', { type: () => [String], nullable: true })
    statuses?: IntelligenceWorkbenchBlockerStatus[],
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 })
    limit?: number
  ) {
    if (copilot.workspaceId) {
      throw new BadRequest(
        'Workbench Blockers are available only from user-level Copilot'
      );
    }
    if (
      statuses?.some(
        status => !INTELLIGENCE_WORKBENCH_BLOCKER_STATUSES.includes(status)
      )
    ) {
      throw new BadRequest('Invalid Blocker status');
    }
    const blockers = await this.models.intelligenceWorkbenchBlocker.list({
      userId: user.id,
      projectId,
      statuses,
      limit,
    });
    return blockers.map(blocker => this.presentBlocker(blocker));
  }

  @ResolveField(() => CopilotWorkbenchTaskPanelType, {
    description:
      'Project the current user task attention panel across all currently accessible workspaces.',
    complexity: 3,
  })
  async workbenchTaskPanel(
    @Parent() copilot: CopilotType,
    @CurrentUser() user: CurrentUserType,
    @Args('projectId', { type: () => ID, nullable: true }) projectId?: string
  ): Promise<CopilotWorkbenchTaskPanelType> {
    if (copilot.workspaceId) {
      throw new BadRequest(
        'Workbench task panel is available only from user-level Copilot'
      );
    }
    const panel =
      await this.models.intelligenceWorkbenchTaskProjection.listPanel({
        userId: user.id,
        projectId,
      });
    return {
      todo: {
        capped: panel.todo.capped,
        items: await Promise.all(
          panel.todo.items.map(item => this.presentTaskItem(item, user.id))
        ),
      },
      inProgress: {
        capped: panel.inProgress.capped,
        items: await Promise.all(
          panel.inProgress.items.map(item =>
            this.presentTaskItem(item, user.id)
          )
        ),
      },
      done: {
        capped: panel.done.capped,
        items: await Promise.all(
          panel.done.items.map(item => this.presentTaskItem(item, user.id))
        ),
      },
    };
  }

  @ResolveField(() => CopilotWorkbenchTaskListType, {
    description:
      'List the current user workbench tasks across all currently accessible workspaces.',
    complexity: 3,
  })
  async workbenchTasks(
    @Parent() copilot: CopilotType,
    @CurrentUser() user: CurrentUserType,
    @Args('projectId', { type: () => ID, nullable: true }) projectId?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('cursor', { type: () => String, nullable: true }) cursor?: string,
    @Args('filter', { type: () => String, nullable: true }) filter?: string
  ): Promise<CopilotWorkbenchTaskListType> {
    if (copilot.workspaceId) {
      throw new BadRequest(
        'Workbench tasks are available only from user-level Copilot'
      );
    }
    const list = await this.models.intelligenceWorkbenchTaskProjection.listAll({
      userId: user.id,
      projectId,
      limit,
      cursor,
      filter,
    });
    return {
      capped: list.capped,
      nextCursor: list.nextCursor,
      items: await Promise.all(
        list.items.map(item => this.presentTaskItem(item, user.id))
      ),
    };
  }

  @ResolveField(() => CopilotWorkbenchTaskItemType, {
    nullable: true,
    complexity: 3,
  })
  async workbenchTask(
    @Parent() copilot: CopilotType,
    @CurrentUser() user: CurrentUserType,
    @Args('taskId', { type: () => String }) taskId: string
  ): Promise<CopilotWorkbenchTaskItemType | null> {
    if (copilot.workspaceId)
      throw new BadRequest('Workbench task details require user-level Copilot');
    const list = await this.models.intelligenceWorkbenchTaskProjection.listAll({
      userId: user.id,
      taskId,
      limit: 1,
    });
    return list.items[0]
      ? await this.presentTaskItem(list.items[0], user.id)
      : null;
  }

  @ResolveField(() => [CopilotAccessRequestType], {
    description: 'List access requests visible to the current user.',
    complexity: 2,
  })
  async workbenchAccessRequests(
    @Parent() copilot: CopilotType,
    @CurrentUser() user: CurrentUserType,
    @Args('view', {
      type: () => String,
      nullable: true,
      defaultValue: 'requester',
    })
    view?: AccessRequestView,
    @Args('projectId', { type: () => ID, nullable: true }) projectId?: string,
    @Args('workspaceId', { type: () => String, nullable: true })
    workspaceId?: string,
    @Args('docId', { type: () => String, nullable: true }) docId?: string,
    @Args('statuses', { type: () => [String], nullable: true })
    statuses?: IntelligenceWorkbenchAccessRequestStatus[],
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 })
    limit?: number
  ) {
    if (copilot.workspaceId) {
      throw new BadRequest(
        'Workbench access requests are available only from user-level Copilot'
      );
    }
    const normalizedView = view ?? 'requester';
    if (!ACCESS_REQUEST_VIEWS.includes(normalizedView)) {
      throw new BadRequest('Invalid access request view');
    }
    if (
      statuses?.some(
        status =>
          !INTELLIGENCE_WORKBENCH_ACCESS_REQUEST_STATUSES.includes(status)
      )
    ) {
      throw new BadRequest('Invalid access request status');
    }
    if (normalizedView === 'source') {
      if (!workspaceId) {
        throw new BadRequest('Source access request view requires workspaceId');
      }
      const requests =
        await this.models.intelligenceWorkbenchAuthorization.listAccessRequests(
          {
            actorUserId: user.id,
            view: 'source',
            workspaceId,
            docIds: docId ? [docId] : undefined,
            statuses,
            limit,
          }
        );
      const permitted = await this.ac
        .user(user.id)
        .workspace(workspaceId)
        .allowLocal()
        .docs(requests, 'Doc.Users.Manage');
      return permitted.map(request =>
        this.presentAccessRequest(request, user.id, true)
      );
    }
    const requests =
      await this.models.intelligenceWorkbenchAuthorization.listAccessRequests({
        actorUserId: user.id,
        view: normalizedView,
        projectId,
        statuses,
        limit,
      });
    return requests.map(request => this.presentAccessRequest(request, user.id));
  }

  @ResolveField(() => [CopilotProjectInvitationType], {
    description: 'List project invitations visible to the current user.',
    complexity: 2,
  })
  async workbenchProjectInvitations(
    @Parent() copilot: CopilotType,
    @CurrentUser() user: CurrentUserType,
    @Args('direction', {
      type: () => String,
      nullable: true,
      defaultValue: 'incoming',
    })
    direction?: ProjectInvitationDirection,
    @Args('projectId', { type: () => ID, nullable: true }) projectId?: string,
    @Args('statuses', { type: () => [String], nullable: true })
    statuses?: IntelligenceWorkbenchInvitationStatus[],
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 })
    limit?: number
  ) {
    if (copilot.workspaceId) {
      throw new BadRequest(
        'Workbench project invitations are available only from user-level Copilot'
      );
    }
    const normalizedDirection = direction ?? 'incoming';
    if (!PROJECT_INVITATION_DIRECTIONS.includes(normalizedDirection)) {
      throw new BadRequest('Invalid project invitation direction');
    }
    if (
      statuses?.some(
        status => !INTELLIGENCE_WORKBENCH_INVITATION_STATUSES.includes(status)
      )
    ) {
      throw new BadRequest('Invalid project invitation status');
    }
    const invitations =
      await this.models.intelligenceWorkbenchAuthorization.listProjectInvitations(
        {
          actorUserId: user.id,
          direction: normalizedDirection,
          projectId,
          statuses,
          limit,
        }
      );
    return invitations.map(invitation => this.presentInvitation(invitation));
  }

  @ResolveField(() => [CopilotProjectGrantType], {
    description:
      'List project grants on source documents the current user may manage.',
    complexity: 2,
  })
  async workbenchProjectGrantsForSource(
    @Parent() copilot: CopilotType,
    @CurrentUser() user: CurrentUserType,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('docId', { type: () => String, nullable: true }) docId?: string,
    @Args('statuses', { type: () => [String], nullable: true })
    statuses?: Array<'active' | 'revoked'>,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 100 })
    limit?: number
  ) {
    if (copilot.workspaceId) {
      throw new BadRequest(
        'Workbench source grants are available only from user-level Copilot'
      );
    }
    if (statuses?.some(status => !['active', 'revoked'].includes(status))) {
      throw new BadRequest('Invalid project grant status');
    }
    const grants =
      await this.models.intelligenceWorkbenchAuthorization.listProjectGrantsForSource(
        { actorUserId: user.id, workspaceId, docId, statuses, limit }
      );
    const permitted = await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .allowLocal()
      .docs(grants, 'Doc.Users.Manage');
    return permitted.map(grant => this.presentGrant(grant));
  }

  @Mutation(() => CopilotAccessRequestType)
  async requestCopilotDocumentAccess(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: RequestCopilotDocumentAccessInput
  ) {
    const result = input.projectId
      ? await this.models.intelligenceWorkbenchAuthorization.requestAccess({
          workspaceId: input.workspaceId,
          docId: input.docId,
          requesterUserId: user.id,
          requestedLevel: input.requestedLevel ?? 'read',
          requestedTitle: input.requestedTitle,
          expiresAt: input.expiresAt,
          idempotencyKey: input.idempotencyKey,
          beneficiaryType: 'project',
          beneficiaryProjectId: input.projectId,
        })
      : await this.models.intelligenceWorkbenchAuthorization.requestAccess({
          workspaceId: input.workspaceId,
          docId: input.docId,
          requesterUserId: user.id,
          requestedLevel: input.requestedLevel ?? 'read',
          requestedTitle: input.requestedTitle,
          expiresAt: input.expiresAt,
          idempotencyKey: input.idempotencyKey,
          beneficiaryType: 'user',
          beneficiaryUserId: user.id,
        });
    return this.presentAccessRequest(result.request, user.id);
  }

  @Mutation(() => CopilotAccessRequestType)
  async approveCopilotAccessRequest(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: ResolveCopilotAccessRequestInput
  ) {
    const request =
      await this.models.intelligenceWorkbenchAuthorization.approveAccessRequest(
        {
          requestId: input.requestId,
          actorUserId: user.id,
          resolutionReason: input.reason,
        }
      );
    return this.presentAccessRequest(request, user.id, true);
  }

  @Mutation(() => CopilotAccessRequestType)
  async rejectCopilotAccessRequest(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: ResolveCopilotAccessRequestInput
  ) {
    const request =
      await this.models.intelligenceWorkbenchAuthorization.rejectAccessRequest({
        requestId: input.requestId,
        actorUserId: user.id,
        resolutionReason: input.reason,
      });
    return this.presentAccessRequest(request, user.id, true);
  }

  @Mutation(() => CopilotAccessRequestType)
  async withdrawCopilotAccessRequest(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: ResolveCopilotAccessRequestInput
  ) {
    const request =
      await this.models.intelligenceWorkbenchAuthorization.withdrawAccessRequest(
        {
          requestId: input.requestId,
          actorUserId: user.id,
          resolutionReason: input.reason,
        }
      );
    return this.presentAccessRequest(request, user.id);
  }

  @Mutation(() => CopilotProjectInvitationType)
  async sendCopilotProjectInvitation(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: SendCopilotProjectInvitationInput
  ) {
    const invitee = await this.models.user.getUserByEmail(input.email);
    if (!invitee) throw new NotFoundException('Invitee not found');
    const result =
      await this.models.intelligenceWorkbenchAuthorization.sendProjectInvitation(
        {
          projectId: input.projectId,
          inviterUserId: user.id,
          inviteeUserId: invitee.id,
        }
      );
    return this.presentInvitation(result.invitation);
  }

  @Mutation(() => CopilotProjectInvitationType)
  async acceptCopilotProjectInvitation(
    @CurrentUser() user: CurrentUserType,
    @Args('invitationId', { type: () => ID }) invitationId: string
  ) {
    return this.presentInvitation(
      await this.models.intelligenceWorkbenchAuthorization.acceptProjectInvitation(
        { invitationId, actorUserId: user.id }
      )
    );
  }

  @Mutation(() => CopilotProjectInvitationType)
  async declineCopilotProjectInvitation(
    @CurrentUser() user: CurrentUserType,
    @Args('invitationId', { type: () => ID }) invitationId: string
  ) {
    return this.presentInvitation(
      await this.models.intelligenceWorkbenchAuthorization.declineProjectInvitation(
        { invitationId, actorUserId: user.id }
      )
    );
  }

  @Mutation(() => CopilotProjectInvitationType)
  async withdrawCopilotProjectInvitation(
    @CurrentUser() user: CurrentUserType,
    @Args('invitationId', { type: () => ID }) invitationId: string
  ) {
    return this.presentInvitation(
      await this.models.intelligenceWorkbenchAuthorization.withdrawProjectInvitation(
        { invitationId, actorUserId: user.id }
      )
    );
  }

  @Mutation(() => CopilotProjectGrantRevocationType)
  async revokeCopilotProjectGrant(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: RevokeCopilotProjectGrantInput
  ) {
    const result =
      await this.models.intelligenceWorkbenchAuthorization.revokeProjectGrantById(
        {
          grantId: input.grantId,
          actorUserId: user.id,
          reason: input.reason,
        }
      );
    const stored =
      await this.models.intelligenceWorkbenchAuthorization.getProjectGrant(
        result.grant.id
      );
    return { ...result, grant: this.presentGrant(stored) };
  }

  @Mutation(() => CopilotAccessRequestType)
  async reRequestCopilotProjectDocumentAccess(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: ReRequestCopilotProjectDocumentInput
  ) {
    const result =
      await this.models.intelligenceWorkbenchAuthorization.reRequestRevokedProjectDocument(
        {
          grantId: input.grantId,
          requesterUserId: user.id,
          idempotencyKey: input.idempotencyKey,
        }
      );
    return this.presentAccessRequest(result.request, user.id);
  }

  @Mutation(() => CopilotProjectAiPolicyType)
  async setCopilotContextProjectAiPolicy(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: SetCopilotProjectAiPolicyInput
  ) {
    const project =
      await this.models.intelligenceWorkbenchAuthorization.setProjectAiPolicy({
        projectId: input.projectId,
        actorUserId: user.id,
        policy: input.policy,
      });
    if (!project) throw new NotFoundException('Context project not found');
    return {
      projectId: project.id,
      policy: project.aiPolicy,
      updatedByUserId: project.aiPolicyUpdatedByUserId,
      updatedAt: project.aiPolicyUpdatedAt,
    };
  }

  @Mutation(() => Boolean)
  async removeCopilotContextProjectMember(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: RemoveCopilotProjectMemberInput
  ) {
    return await this.models.intelligenceWorkbenchAuthorization.removeProjectMember(
      {
        projectId: input.projectId,
        actorUserId: user.id,
        memberUserId: input.memberUserId,
      }
    );
  }

  @Mutation(() => Boolean)
  async transferCopilotContextProjectOwnership(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: TransferCopilotProjectOwnershipInput
  ) {
    await this.models.intelligenceWorkbenchAuthorization.transferProjectOwnership(
      {
        projectId: input.projectId,
        actorUserId: user.id,
        memberUserId: input.memberUserId,
      }
    );
    return true;
  }

  @Mutation(() => CopilotBlockerType)
  async createCopilotBlocker(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: CreateCopilotBlockerInput
  ) {
    if (!INTELLIGENCE_WORKBENCH_BLOCKER_TYPES.includes(input.type)) {
      throw new BadRequest('Invalid Blocker type');
    }
    return this.presentBlocker(
      await this.models.intelligenceWorkbenchBlocker.createManual({
        projectId: input.projectId,
        actorUserId: user.id,
        title: input.title,
        type: input.type,
        waitingOn: input.waitingOn,
        dueAt: input.dueAt,
      })
    );
  }

  @Mutation(() => CopilotBlockerType)
  async confirmCopilotBlockerSuggestion(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: ConfirmCopilotBlockerSuggestionInput
  ) {
    if (
      input.suggestion.origin !== 'ai_suggested' ||
      input.suggestion.confirmationRequired !== true
    ) {
      throw new BadRequest('Invalid Blocker suggestion confirmation');
    }
    if (!INTELLIGENCE_WORKBENCH_BLOCKER_TYPES.includes(input.suggestion.type)) {
      throw new BadRequest('Invalid Blocker type');
    }
    return this.presentBlocker(
      await this.models.intelligenceWorkbenchBlocker.confirmSuggestion({
        projectId: input.projectId,
        actorUserId: user.id,
        suggestion: {
          aiSuggestionId: input.suggestion.aiSuggestionId,
          confirmationProof: input.suggestion.confirmationProof,
          title: input.suggestion.title,
          type: input.suggestion.type,
          waitingOn: input.suggestion.waitingOn,
          dueAt: input.suggestion.dueAt,
        },
      })
    );
  }

  @Mutation(() => CopilotBlockerType)
  async resolveCopilotBlocker(
    @CurrentUser() user: CurrentUserType,
    @Args('blockerId', { type: () => ID }) blockerId: string
  ) {
    return this.presentBlocker(
      await this.models.intelligenceWorkbenchBlocker.resolve({
        blockerId,
        actorUserId: user.id,
      })
    );
  }

  @Mutation(() => CopilotBlockerType)
  async abandonCopilotBlocker(
    @CurrentUser() user: CurrentUserType,
    @Args('blockerId', { type: () => ID }) blockerId: string
  ) {
    return this.presentBlocker(
      await this.models.intelligenceWorkbenchBlocker.abandon({
        blockerId,
        actorUserId: user.id,
      })
    );
  }

  @Mutation(() => Boolean)
  async leaveCopilotContextProject(
    @CurrentUser() user: CurrentUserType,
    @Args('projectId', { type: () => ID }) projectId: string
  ) {
    return await this.models.intelligenceWorkbenchAuthorization.leaveProject({
      projectId,
      userId: user.id,
    });
  }
}
