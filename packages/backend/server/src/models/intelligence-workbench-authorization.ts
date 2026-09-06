import { createHash, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import {
  type AccessRequest,
  type AiContextProjectGrant,
  type AiContextProjectInvitation,
  Prisma,
} from '@prisma/client';

import { BadRequest, NotFound } from '../base';
import { BaseModel } from './base';
import {
  permissionDocumentLockKey,
  permissionWorkspaceLockKey,
} from './permission-write';

export const INTELLIGENCE_WORKBENCH_GRANT_LEVELS = ['read', 'write'] as const;
export type IntelligenceWorkbenchGrantLevel =
  (typeof INTELLIGENCE_WORKBENCH_GRANT_LEVELS)[number];

export const INTELLIGENCE_WORKBENCH_PROJECT_AI_POLICIES = [
  'read_only',
  'read_write',
] as const;
export type IntelligenceWorkbenchProjectAiPolicy =
  (typeof INTELLIGENCE_WORKBENCH_PROJECT_AI_POLICIES)[number];

export const INTELLIGENCE_WORKBENCH_ACCESS_REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'expired',
  'withdrawn',
] as const;
export type IntelligenceWorkbenchAccessRequestStatus =
  (typeof INTELLIGENCE_WORKBENCH_ACCESS_REQUEST_STATUSES)[number];

export const INTELLIGENCE_WORKBENCH_INVITATION_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'withdrawn',
] as const;
export type IntelligenceWorkbenchInvitationStatus =
  (typeof INTELLIGENCE_WORKBENCH_INVITATION_STATUSES)[number];

const PROJECT_DOCUMENT_LIMIT = 100;
const MAX_ID_LENGTH = 512;
const MAX_TITLE_LENGTH = 512;
const MAX_REASON_LENGTH = 512;
const MAX_IDEMPOTENCY_KEY_LENGTH = 512;

type ProjectMembership = {
  aiPolicy: IntelligenceWorkbenchProjectAiPolicy;
  projectStatus: string;
  role: 'owner' | 'member';
};

type ProjectDocumentRef = {
  projectId: string;
  workspaceId: string;
  docId: string;
};

export type IntelligenceWorkbenchProjectDocumentAccess = ProjectMembership & {
  grantId: string | null;
  grantLevel: IntelligenceWorkbenchGrantLevel | null;
  grantStatus: 'active' | 'revoked' | null;
};

export type IntelligenceWorkbenchRequestAccessInput = {
  workspaceId: string;
  docId: string;
  requesterUserId: string;
  requestedLevel: IntelligenceWorkbenchGrantLevel;
  requestedTitle?: string | null;
  expiresAt?: Date | null;
  idempotencyKey?: string;
} & (
  | { beneficiaryType: 'user'; beneficiaryUserId: string }
  | { beneficiaryType: 'project'; beneficiaryProjectId: string }
);

function requireString(
  value: unknown,
  field: string,
  maxLength = MAX_ID_LENGTH
) {
  if (typeof value !== 'string') {
    throw new BadRequest(`${field} must contain 1-${maxLength} characters`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new BadRequest(`${field} must contain 1-${maxLength} characters`);
  }
  return normalized;
}

function optionalString(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null) return null;
  return requireString(value, field, maxLength);
}

function requireGrantLevel(value: unknown): IntelligenceWorkbenchGrantLevel {
  if (
    typeof value !== 'string' ||
    !INTELLIGENCE_WORKBENCH_GRANT_LEVELS.includes(
      value as IntelligenceWorkbenchGrantLevel
    )
  ) {
    throw new BadRequest('Project grant level must be read or write');
  }
  return value as IntelligenceWorkbenchGrantLevel;
}

function requireProjectAiPolicy(
  value: unknown
): IntelligenceWorkbenchProjectAiPolicy {
  if (
    typeof value !== 'string' ||
    !INTELLIGENCE_WORKBENCH_PROJECT_AI_POLICIES.includes(
      value as IntelligenceWorkbenchProjectAiPolicy
    )
  ) {
    throw new BadRequest('Project AI policy must be read_only or read_write');
  }
  return value as IntelligenceWorkbenchProjectAiPolicy;
}

function fingerprint(parts: Array<string | null | undefined>) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

export function capProjectGrantLevel(
  ownLevel: IntelligenceWorkbenchGrantLevel,
  requestedLevel: IntelligenceWorkbenchGrantLevel
) {
  return ownLevel === 'read' ? 'read' : requestedLevel;
}

function projectDocumentCardId(input: ProjectDocumentRef) {
  return fingerprint([
    'intelligence-workbench-project-document-card/v1',
    input.projectId,
    input.workspaceId,
    input.docId,
  ]);
}

function terminalTimestampData(
  status: Exclude<IntelligenceWorkbenchInvitationStatus, 'pending'>,
  now: Date
) {
  return {
    acceptedAt: status === 'accepted' ? now : null,
    declinedAt: status === 'declined' ? now : null,
    withdrawnAt: status === 'withdrawn' ? now : null,
  };
}

@Injectable()
export class IntelligenceWorkbenchAuthorizationModel extends BaseModel {
  @Transactional()
  async lockProjectDocumentAuthorization(input: ProjectDocumentRef) {
    const projectId = requireString(input.projectId, 'projectId');
    const workspaceId = requireString(input.workspaceId, 'workspaceId');
    const docId = requireString(input.docId, 'docId');
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${permissionWorkspaceLockKey(workspaceId)}, 0))`;
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${permissionDocumentLockKey(workspaceId, docId)}, 0))`;
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intelligence-workbench:project-document:${projectId}:${workspaceId}:${docId}`}, 0))`;
  }

  async getProjectDocumentAccess(
    input: ProjectDocumentRef & { userId: string }
  ) {
    const membership = await this.projectMembership(
      input.projectId,
      input.userId
    );
    if (!membership || membership.projectStatus !== 'active') return null;
    const grant = await this.db.aiContextProjectGrant.findFirst({
      where: {
        projectId: input.projectId,
        workspaceId: input.workspaceId,
        docId: input.docId,
      },
      orderBy: [{ grantedAt: 'desc' }, { id: 'desc' }],
      select: { id: true, level: true, status: true },
    });
    return {
      ...membership,
      grantId: grant?.id ?? null,
      grantLevel:
        (grant?.level as IntelligenceWorkbenchGrantLevel | undefined) ?? null,
      grantStatus: (grant?.status as 'active' | 'revoked' | undefined) ?? null,
    } satisfies IntelligenceWorkbenchProjectDocumentAccess;
  }

  @Transactional()
  async lockProjectDocumentAccessForExecution(
    input: ProjectDocumentRef & { userId: string }
  ) {
    await this.lockProjectDocumentAuthorization(input);
    const projectId = requireString(input.projectId, 'projectId');
    const workspaceId = requireString(input.workspaceId, 'workspaceId');
    const docId = requireString(input.docId, 'docId');
    const userId = requireString(input.userId, 'userId');
    const memberships = await this.db.$queryRaw<
      Array<{
        role: string;
        projectStatus: string;
        aiPolicy: string;
      }>
    >`
      SELECT
        member.role,
        project.status AS "projectStatus",
        project.ai_policy AS "aiPolicy"
      FROM ai_context_projects project
      JOIN ai_context_project_members member
        ON member.project_id = project.id
       AND member.user_id = ${userId}
      WHERE project.id = ${projectId}
      FOR SHARE OF project, member
    `;
    const membership = memberships[0];
    if (!membership || membership.projectStatus !== 'active') return null;

    const grants = await this.db.$queryRaw<
      Array<{ id: string; level: string; status: string }>
    >`
      SELECT id, level, status
      FROM ai_context_project_grants
      WHERE project_id = ${projectId}
        AND workspace_id = ${workspaceId}
        AND doc_id = ${docId}
      ORDER BY granted_at DESC, id DESC
      LIMIT 1
      FOR SHARE
    `;
    const grant = grants[0];
    return {
      role: membership.role as 'owner' | 'member',
      projectStatus: membership.projectStatus,
      aiPolicy: membership.aiPolicy as IntelligenceWorkbenchProjectAiPolicy,
      grantId: grant?.id ?? null,
      grantLevel:
        (grant?.level as IntelligenceWorkbenchGrantLevel | undefined) ?? null,
      grantStatus: (grant?.status as 'active' | 'revoked' | undefined) ?? null,
    } satisfies IntelligenceWorkbenchProjectDocumentAccess;
  }

  async listGrantedProjectDocuments(input: {
    projectId: string;
    userId: string;
  }) {
    const membership = await this.projectMembership(
      input.projectId,
      input.userId
    );
    if (!membership || membership.projectStatus !== 'active') return [];
    return await this.db.aiContextProjectGrant.findMany({
      where: { projectId: input.projectId, status: 'active' },
      orderBy: [{ grantedAt: 'asc' }, { id: 'asc' }],
    });
  }

  async getAccessRequest(id: string) {
    return await this.db.accessRequest.findUnique({
      where: { id },
      include: {
        auditEvents: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        projectGrant: true,
      },
    });
  }

  async getAccessRequestNotification(requestId: string, viewerUserId: string) {
    const request = await this.db.accessRequest.findUnique({
      where: { id: requestId },
    });
    const unavailable = { requestId, status: 'unavailable', canDecide: false };
    if (!request) return unavailable;
    let sourceActor = false;
    try {
      await this.requireSourceDecisionActor({
        workspaceId: request.workspaceId,
        docId: request.docId,
        userId: viewerUserId,
      });
      sourceActor = true;
    } catch (error) {
      if (!(error instanceof NotFound)) throw error;
    }
    const requester = request.requesterUserId === viewerUserId;
    if (!sourceActor && !requester) return unavailable;
    const identityVisible =
      sourceActor || (requester && request.requesterSuppliedIdentity);
    const [project, doc] = await Promise.all([
      request.beneficiaryProjectId
        ? this.db.aiContextProject.findUnique({
            where: { id: request.beneficiaryProjectId },
            select: { name: true },
          })
        : null,
      sourceActor
        ? this.models.doc.getMeta(request.workspaceId, request.docId)
        : null,
    ]);
    const expired =
      request.status === 'pending' &&
      !!request.expiresAt &&
      request.expiresAt <= new Date();
    return {
      requestId,
      status: expired ? 'expired' : request.status,
      canDecide: sourceActor && request.status === 'pending' && !expired,
      docId: identityVisible ? request.docId : null,
      docTitle: sourceActor
        ? (doc?.title ?? request.requestedTitle)
        : identityVisible
          ? request.requestedTitle
          : null,
      projectId: request.beneficiaryProjectId,
      projectName: project?.name ?? null,
      requestedLevel: request.requestedLevel,
      resolutionReason: request.resolutionReason,
    };
  }

  async listAccessRequests(input: {
    actorUserId: string;
    view: 'requester' | 'beneficiary' | 'project' | 'source';
    projectId?: string;
    workspaceId?: string;
    docIds?: string[];
    statuses?: IntelligenceWorkbenchAccessRequestStatus[];
    limit?: number;
  }) {
    const actorUserId = requireString(input.actorUserId, 'actorUserId');
    const limit = Math.max(1, Math.min(input.limit ?? 50, 100));
    const statuses = input.statuses?.map(status => {
      if (!INTELLIGENCE_WORKBENCH_ACCESS_REQUEST_STATUSES.includes(status)) {
        throw new BadRequest('Invalid access request status');
      }
      return status;
    });
    const status = statuses?.length ? { in: statuses } : undefined;
    const projectGrant = { select: { status: true } } as const;
    if (input.view === 'requester') {
      return await this.db.accessRequest.findMany({
        where: { requesterUserId: actorUserId, status },
        include: { projectGrant },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: limit,
      });
    }
    if (input.view === 'beneficiary') {
      return await this.db.accessRequest.findMany({
        where: {
          beneficiaryType: 'user',
          beneficiaryUserId: actorUserId,
          status,
        },
        include: { projectGrant },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: limit,
      });
    }
    if (input.view === 'project') {
      const projectId = requireString(input.projectId, 'projectId');
      const membership = await this.projectMembership(projectId, actorUserId);
      if (!membership) return [];
      return await this.db.accessRequest.findMany({
        where: {
          beneficiaryType: 'project',
          beneficiaryProjectId: projectId,
          status,
        },
        include: { projectGrant },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: limit,
      });
    }
    const workspaceId = requireString(input.workspaceId, 'workspaceId');
    const docIds = input.docIds
      ? [...new Set(input.docIds.map(docId => requireString(docId, 'docId')))]
      : null;
    if (docIds && !docIds.length) return [];
    const documentFilter = docIds
      ? Prisma.sql`AND request.doc_id IN (${Prisma.join(docIds)})`
      : Prisma.empty;
    const statusFilter = statuses?.length
      ? Prisma.sql`AND request.status IN (${Prisma.join(statuses)})`
      : Prisma.empty;
    const ids = await this.db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT request.id
      FROM access_requests request
      WHERE request.workspace_id = ${workspaceId}
        ${documentFilter}
        ${statusFilter}
        AND (
          EXISTS (
            SELECT 1
            FROM workspace_members member
            WHERE member.workspace_id = request.workspace_id
              AND member.user_id = ${actorUserId}
              AND member.state = 'active'
              AND member.role IN ('owner', 'admin')
          ) OR EXISTS (
            SELECT 1
            FROM doc_grants grant_row
            WHERE grant_row.workspace_id = request.workspace_id
              AND grant_row.doc_id = request.doc_id
              AND grant_row.principal_type = 'user'
              AND grant_row.principal_id = ${actorUserId}
              AND grant_row.role = 'owner'
          )
        )
      ORDER BY request.updated_at DESC, request.id DESC
      LIMIT ${limit}
    `);
    if (!ids.length) return [];
    const requests = await this.db.accessRequest.findMany({
      where: { id: { in: ids.map(row => row.id) } },
      include: { projectGrant },
    });
    const requestById = new Map(requests.map(request => [request.id, request]));
    return ids.flatMap(row => {
      const request = requestById.get(row.id);
      return request ? [request] : [];
    });
  }

  @Transactional()
  async addProjectDocument(
    input: Omit<
      Extract<
        IntelligenceWorkbenchRequestAccessInput,
        { beneficiaryType: 'project' }
      >,
      'beneficiaryType' | 'beneficiaryProjectId'
    > & {
      projectId: string;
      groupId?: string | null;
      sortOrder?: number;
    }
  ) {
    const normalizedInput = {
      ...input,
      projectId: requireString(input.projectId, 'projectId'),
      workspaceId: requireString(input.workspaceId, 'workspaceId'),
      docId: requireString(input.docId, 'docId'),
      requesterUserId: requireString(input.requesterUserId, 'requesterUserId'),
    };
    await this.lockProjectDocumentAuthorization(normalizedInput);
    const membership = await this.requireActiveProjectMembership(
      normalizedInput.projectId,
      normalizedInput.requesterUserId
    );
    const activeGrant = await this.findActiveProjectGrant(normalizedInput);
    if (activeGrant) {
      return { kind: 'granted' as const, grant: activeGrant, membership };
    }
    if (membership.role === 'owner') {
      const capability = await this.sourceDocumentCapability({
        workspaceId: normalizedInput.workspaceId,
        docId: normalizedInput.docId,
        userId: normalizedInput.requesterUserId,
      });
      if (capability.canShare && capability.level) {
        const grant = await this.createProjectGrant({
          ...normalizedInput,
          requestedLevel: capProjectGrantLevel(
            capability.level,
            requireGrantLevel(normalizedInput.requestedLevel)
          ),
          actorUserId: normalizedInput.requesterUserId,
          addedByUserId: normalizedInput.requesterUserId,
          source: 'direct',
        });
        return { kind: 'granted' as const, grant, membership };
      }
    }
    const requested = await this.createAccessRequest({
      ...normalizedInput,
      beneficiaryType: 'project',
      beneficiaryProjectId: normalizedInput.projectId,
    });
    return { kind: 'requested' as const, ...requested, membership };
  }

  @Transactional()
  async grantProjectDocument(input: {
    projectId: string;
    workspaceId: string;
    docId: string;
    actorUserId: string;
    requestedLevel: IntelligenceWorkbenchGrantLevel;
    suppliedTitle?: string | null;
    groupId?: string | null;
    sortOrder?: number;
  }) {
    await this.lockProjectDocumentAuthorization(input);
    const membership = await this.requireActiveProjectMembership(
      input.projectId,
      input.actorUserId
    );
    if (membership.role !== 'owner') {
      throw new NotFound('Project not found');
    }
    const capability = await this.sourceDocumentCapability({
      ...input,
      userId: input.actorUserId,
    });
    if (!capability.canShare || !capability.level) {
      throw new BadRequest(
        'Document sharing authority is required for a direct project grant'
      );
    }
    return await this.createProjectGrant({
      ...input,
      requestedLevel: capProjectGrantLevel(
        capability.level,
        requireGrantLevel(input.requestedLevel)
      ),
      addedByUserId: input.actorUserId,
      source: 'direct',
    });
  }

  @Transactional()
  async requestProjectDocumentAccess(
    input: Omit<
      Extract<
        IntelligenceWorkbenchRequestAccessInput,
        { beneficiaryType: 'project' }
      >,
      'beneficiaryType' | 'beneficiaryProjectId'
    > & {
      projectId: string;
      groupId?: string | null;
      sortOrder?: number;
    }
  ) {
    await this.lockProjectDocumentAuthorization(input);
    await this.requireActiveProjectMembership(
      input.projectId,
      input.requesterUserId
    );
    const activeGrant = await this.findActiveProjectGrant(input);
    if (activeGrant) {
      throw new BadRequest('This document already has an active project grant');
    }
    return await this.createAccessRequest({
      ...input,
      beneficiaryType: 'project',
      beneficiaryProjectId: input.projectId,
    });
  }

  @Transactional()
  async requestUserDocumentAccess(
    input: Omit<
      Extract<
        IntelligenceWorkbenchRequestAccessInput,
        { beneficiaryType: 'user' }
      >,
      'beneficiaryType' | 'beneficiaryUserId'
    >
  ) {
    await this.lockSourceDocument(input.workspaceId, input.docId);
    return await this.createAccessRequest({
      ...input,
      beneficiaryType: 'user',
      beneficiaryUserId: input.requesterUserId,
    });
  }

  @Transactional()
  async requestAccess(input: IntelligenceWorkbenchRequestAccessInput) {
    if (input.beneficiaryType === 'user') {
      if (input.beneficiaryUserId !== input.requesterUserId) {
        throw new BadRequest(
          'A personal access request must benefit the requesting user'
        );
      }
      return await this.requestUserDocumentAccess(input);
    }
    return await this.requestProjectDocumentAccess({
      ...input,
      projectId: input.beneficiaryProjectId,
    });
  }

  @Transactional()
  async approveAccessRequest(input: {
    requestId: string;
    actorUserId: string;
    resolutionReason?: string | null;
    now?: Date;
  }) {
    const request = await this.requireAccessRequest(input.requestId);
    await this.lockAccessRequest(request);
    const current = await this.requireAccessRequest(input.requestId);
    await this.requireSourceDecisionActor({
      workspaceId: current.workspaceId,
      docId: current.docId,
      userId: input.actorUserId,
    });
    if (current.status !== 'pending') return current;
    const now = input.now ?? new Date();
    if (current.expiresAt && current.expiresAt <= now) {
      return await this.expirePendingAccessRequest(current, now);
    }
    if (current.beneficiaryType === 'project' && current.beneficiaryProjectId) {
      await this.requireActiveProject(current.beneficiaryProjectId);
      const placeholder = await this.db.aiContextProjectDoc.findUnique({
        where: {
          projectId_workspaceId_docId: {
            projectId: current.beneficiaryProjectId,
            workspaceId: current.workspaceId,
            docId: current.docId,
          },
        },
        select: { status: true },
      });
      if (placeholder?.status !== 'pending') {
        throw new NotFound('Access request not found');
      }
      await this.createProjectGrant({
        projectId: current.beneficiaryProjectId,
        workspaceId: current.workspaceId,
        docId: current.docId,
        requestedLevel:
          current.requestedLevel as IntelligenceWorkbenchGrantLevel,
        suppliedTitle: current.requestedTitle,
        actorUserId: input.actorUserId,
        addedByUserId: current.requesterUserId,
        source: 'access_request',
        accessRequestId: current.id,
      });
    } else if (
      current.beneficiaryType === 'user' &&
      current.beneficiaryUserId
    ) {
      await this.upsertPersonalDocGrant({
        workspaceId: current.workspaceId,
        docId: current.docId,
        userId: current.beneficiaryUserId,
        level: current.requestedLevel as IntelligenceWorkbenchGrantLevel,
        grantedByUserId: input.actorUserId,
      });
    } else {
      throw new Error('Access request beneficiary shape is invalid');
    }
    return await this.resolveAccessRequest({
      request: current,
      status: 'approved',
      actorUserId: input.actorUserId,
      resolutionReason: input.resolutionReason,
      now,
    });
  }

  @Transactional()
  async rejectAccessRequest(input: {
    requestId: string;
    actorUserId: string;
    resolutionReason?: string | null;
    now?: Date;
  }) {
    const request = await this.requireAccessRequest(input.requestId);
    await this.lockAccessRequest(request);
    const current = await this.requireAccessRequest(input.requestId);
    await this.requireSourceDecisionActor({
      workspaceId: current.workspaceId,
      docId: current.docId,
      userId: input.actorUserId,
    });
    if (current.status !== 'pending') return current;
    const now = input.now ?? new Date();
    if (current.expiresAt && current.expiresAt <= now) {
      return await this.expirePendingAccessRequest(current, now);
    }
    return await this.resolveAccessRequest({
      request: current,
      status: 'rejected',
      actorUserId: input.actorUserId,
      resolutionReason: input.resolutionReason,
      now,
    });
  }

  @Transactional()
  async expireAccessRequest(input: { requestId: string; now?: Date }) {
    const request = await this.requireAccessRequest(input.requestId);
    await this.lockAccessRequest(request);
    const current = await this.requireAccessRequest(input.requestId);
    if (current.status !== 'pending') return current;
    const now = input.now ?? new Date();
    if (!current.expiresAt || current.expiresAt > now) return current;
    return await this.expirePendingAccessRequest(current, now);
  }

  @Transactional()
  async expireDueAccessRequests(input: { now?: Date; limit?: number } = {}) {
    const now = input.now ?? new Date();
    const requests = await this.db.accessRequest.findMany({
      where: {
        status: 'pending',
        expiresAt: { lte: now },
      },
      orderBy: [
        { workspaceId: 'asc' },
        { docId: 'asc' },
        { beneficiaryProjectId: 'asc' },
        { id: 'asc' },
      ],
      take: Math.max(1, Math.min(input.limit ?? 100, 500)),
    });
    let expiredCount = 0;
    for (const request of requests) {
      await this.lockAccessRequest(request);
      const current = await this.db.accessRequest.findUnique({
        where: { id: request.id },
      });
      if (
        !current ||
        current.status !== 'pending' ||
        !current.expiresAt ||
        current.expiresAt > now
      ) {
        continue;
      }
      await this.expirePendingAccessRequest(current, now);
      expiredCount++;
    }
    return expiredCount;
  }

  @Transactional()
  async withdrawAccessRequest(input: {
    requestId: string;
    actorUserId: string;
    resolutionReason?: string | null;
    now?: Date;
  }) {
    const request = await this.requireAccessRequest(input.requestId);
    await this.lockAccessRequest(request);
    const current = await this.requireAccessRequest(input.requestId);
    const allowed =
      current.requesterUserId === input.actorUserId ||
      (current.beneficiaryType === 'user' &&
        current.beneficiaryUserId === input.actorUserId) ||
      (current.beneficiaryProjectId
        ? (
            await this.projectMembership(
              current.beneficiaryProjectId,
              input.actorUserId
            )
          )?.role === 'owner'
        : false);
    if (!allowed) throw new NotFound('Access request not found');
    if (current.status !== 'pending') return current;
    return await this.resolveAccessRequest({
      request: current,
      status: 'withdrawn',
      actorUserId: input.actorUserId,
      resolutionReason: input.resolutionReason,
      now: input.now ?? new Date(),
    });
  }

  async listProjectGrantsForSource(input: {
    actorUserId: string;
    workspaceId: string;
    docId?: string;
    statuses?: Array<'active' | 'revoked'>;
    limit?: number;
  }) {
    const actorUserId = requireString(input.actorUserId, 'actorUserId');
    const workspaceId = requireString(input.workspaceId, 'workspaceId');
    const docId = input.docId ? requireString(input.docId, 'docId') : null;
    const statuses = input.statuses?.map(status => {
      if (status !== 'active' && status !== 'revoked') {
        throw new BadRequest('Invalid project grant status');
      }
      return status;
    });
    const limit = Math.max(1, Math.min(input.limit ?? 100, 200));
    const documentFilter = docId
      ? Prisma.sql`AND grant_row.doc_id = ${docId}`
      : Prisma.empty;
    const statusFilter = statuses?.length
      ? Prisma.sql`AND grant_row.status IN (${Prisma.join(statuses)})`
      : Prisma.empty;
    const ids = await this.db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT grant_row.id
      FROM ai_context_project_grants grant_row
      WHERE grant_row.workspace_id = ${workspaceId}
        ${documentFilter}
        ${statusFilter}
        AND (
          EXISTS (
            SELECT 1
            FROM workspace_members member
            WHERE member.workspace_id = grant_row.workspace_id
              AND member.user_id = ${actorUserId}
              AND member.state = 'active'
              AND member.role IN ('owner', 'admin')
          ) OR EXISTS (
            SELECT 1
            FROM doc_grants document_grant
            WHERE document_grant.workspace_id = grant_row.workspace_id
              AND document_grant.doc_id = grant_row.doc_id
              AND document_grant.principal_type = 'user'
              AND document_grant.principal_id = ${actorUserId}
              AND document_grant.role = 'owner'
          )
        )
      ORDER BY grant_row.updated_at DESC, grant_row.id DESC
      LIMIT ${limit}
    `);
    if (!ids.length) return [];
    const grants = await this.db.aiContextProjectGrant.findMany({
      where: { id: { in: ids.map(row => row.id) } },
      include: { project: { select: { id: true, name: true, status: true } } },
    });
    const grantById = new Map(grants.map(grant => [grant.id, grant]));
    return ids.flatMap(row => {
      const grant = grantById.get(row.id);
      return grant ? [grant] : [];
    });
  }

  async getProjectGrant(id: string) {
    return await this.db.aiContextProjectGrant.findUnique({
      where: { id: requireString(id, 'grantId') },
      include: {
        auditEvents: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        project: { select: { id: true, name: true, status: true } },
      },
    });
  }

  @Transactional()
  async revokeProjectGrantById(input: {
    grantId: string;
    actorUserId: string;
    reason?: string | null;
    now?: Date;
  }) {
    const grant = await this.db.aiContextProjectGrant.findUnique({
      where: { id: requireString(input.grantId, 'grantId') },
    });
    if (!grant) throw new NotFound('Project grant not found');
    await this.lockProjectDocumentAuthorization(grant);
    await this.requireSourceDecisionActor({
      workspaceId: grant.workspaceId,
      docId: grant.docId,
      userId: input.actorUserId,
    });
    const current = await this.db.aiContextProjectGrant.findUnique({
      where: { id: grant.id },
    });
    if (!current) throw new NotFound('Project grant not found');
    if (current.status === 'revoked') {
      return {
        grant: current,
        rerequestCardId: projectDocumentCardId(current),
        quarantinedMemoryCount: 0,
      };
    }
    return await this.revokeProjectGrantInternal({
      grant: current,
      actorUserId: input.actorUserId,
      reason: input.reason,
      keepPlaceholder: true,
      now: input.now ?? new Date(),
    });
  }

  @Transactional()
  async reRequestRevokedProjectDocument(input: {
    grantId: string;
    requesterUserId: string;
    idempotencyKey?: string;
    now?: Date;
  }) {
    const grant = await this.db.aiContextProjectGrant.findUnique({
      where: { id: requireString(input.grantId, 'grantId') },
    });
    if (!grant) throw new NotFound('Project grant not found');
    await this.lockProjectDocumentAuthorization(grant);
    await this.requireActiveProjectMembership(
      grant.projectId,
      input.requesterUserId
    );
    const current = await this.db.aiContextProjectGrant.findUnique({
      where: { id: grant.id },
    });
    if (!current || current.status !== 'revoked') {
      throw new NotFound('Project grant not found');
    }
    if (await this.findActiveProjectGrant(current)) {
      throw new BadRequest('This document already has an active project grant');
    }
    const document = await this.db.aiContextProjectDoc.findUnique({
      where: {
        projectId_workspaceId_docId: {
          projectId: current.projectId,
          workspaceId: current.workspaceId,
          docId: current.docId,
        },
      },
      select: { groupId: true, sortOrder: true },
    });
    const requested = await this.createAccessRequest({
      workspaceId: current.workspaceId,
      docId: current.docId,
      requesterUserId: input.requesterUserId,
      requestedLevel: current.level as IntelligenceWorkbenchGrantLevel,
      requestedTitle: null,
      requesterSuppliedIdentity: false,
      beneficiaryType: 'project',
      beneficiaryProjectId: current.projectId,
      projectId: current.projectId,
      groupId: document?.groupId ?? null,
      sortOrder: document?.sortOrder ?? 0,
      idempotencyKey: input.idempotencyKey,
    });
    return {
      ...requested,
      rerequestCardId: projectDocumentCardId(current),
    };
  }

  @Transactional()
  async revokeProjectGrant(
    input: ProjectDocumentRef & {
      actorUserId: string;
      reason?: string | null;
      now?: Date;
    }
  ) {
    await this.lockProjectDocumentAuthorization(input);
    await this.requireSourceDecisionActor({
      ...input,
      userId: input.actorUserId,
    });
    const grant = await this.findActiveProjectGrant(input);
    if (!grant) {
      const revoked = await this.db.aiContextProjectGrant.findFirst({
        where: {
          projectId: input.projectId,
          workspaceId: input.workspaceId,
          docId: input.docId,
          status: 'revoked',
        },
        orderBy: [{ revokedAt: 'desc' }, { id: 'desc' }],
      });
      if (!revoked) throw new NotFound('Project grant not found');
      return {
        grant: revoked,
        rerequestCardId: projectDocumentCardId(input),
        quarantinedMemoryCount: 0,
      };
    }
    return await this.revokeProjectGrantInternal({
      grant,
      actorUserId: input.actorUserId,
      reason: input.reason,
      keepPlaceholder: true,
      now: input.now ?? new Date(),
    });
  }

  @Transactional()
  async removeProjectDocument(
    input: ProjectDocumentRef & {
      actorUserId: string;
      now?: Date;
    }
  ) {
    await this.lockProjectDocumentAuthorization(input);
    const membership = await this.requireActiveProjectMembership(
      input.projectId,
      input.actorUserId
    );
    if (membership.role !== 'owner') {
      throw new NotFound('Project document not found');
    }
    const grant = await this.findActiveProjectGrant(input);
    let quarantinedMemoryCount = 0;
    if (grant) {
      const revoked = await this.revokeProjectGrantInternal({
        grant,
        actorUserId: input.actorUserId,
        reason: 'project_document_removed',
        keepPlaceholder: false,
        now: input.now ?? new Date(),
      });
      quarantinedMemoryCount = revoked.quarantinedMemoryCount;
    }
    const now = input.now ?? new Date();
    const pendingRequests = await this.db.accessRequest.findMany({
      where: {
        beneficiaryType: 'project',
        beneficiaryProjectId: input.projectId,
        workspaceId: input.workspaceId,
        docId: input.docId,
        status: 'pending',
      },
    });
    for (const request of pendingRequests) {
      await this.resolveAccessRequest({
        request,
        status: 'withdrawn',
        actorUserId: input.actorUserId,
        resolutionReason: 'project_document_removed',
        now,
      });
    }
    const deleted = await this.db.aiContextProjectDoc.deleteMany({
      where: {
        projectId: input.projectId,
        workspaceId: input.workspaceId,
        docId: input.docId,
      },
    });
    return { removed: deleted.count === 1, quarantinedMemoryCount };
  }

  @Transactional()
  async removeSourceDocumentAuthorizations(input: {
    workspaceId: string;
    docId: string;
    now?: Date;
  }) {
    const workspaceId = requireString(input.workspaceId, 'workspaceId');
    const docId = requireString(input.docId, 'docId');
    const now = input.now ?? new Date();
    await this.lockSourceDocument(workspaceId, docId);
    const projectIds = (
      await this.db.aiContextProjectDoc.findMany({
        where: { workspaceId, docId },
        select: { projectId: true },
        orderBy: { projectId: 'asc' },
      })
    ).map(document => document.projectId);
    for (const projectId of projectIds) {
      await this.lockProjectDocumentKey({ projectId, workspaceId, docId });
    }
    const grants = await this.db.aiContextProjectGrant.findMany({
      where: { workspaceId, docId, status: 'active' },
      orderBy: [{ projectId: 'asc' }, { id: 'asc' }],
    });
    let quarantinedMemoryCount = 0;
    for (const grant of grants) {
      const revoked = await this.revokeProjectGrantInternal({
        grant,
        actorUserId: null,
        actorUserIdSnapshot: 'system:source-document-deleted',
        reason: 'source_document_deleted',
        keepPlaceholder: false,
        now,
      });
      quarantinedMemoryCount += revoked.quarantinedMemoryCount;
    }
    const pendingRequests = await this.db.accessRequest.findMany({
      where: { workspaceId, docId, status: 'pending' },
      orderBy: { id: 'asc' },
    });
    for (const request of pendingRequests) {
      await this.resolveAccessRequest({
        request,
        status: 'withdrawn',
        actorUserId: null,
        actorUserIdSnapshot: 'system:source-document-deleted',
        resolutionReason: 'source_document_deleted',
        now,
      });
    }
    const projectDocuments = await this.db.aiContextProjectDoc.deleteMany({
      where: { workspaceId, docId },
    });
    return {
      projectDocumentCount: projectDocuments.count,
      revokedGrantCount: grants.length,
      withdrawnRequestCount: pendingRequests.length,
      quarantinedMemoryCount,
    };
  }

  @Transactional()
  async withdrawPendingProjectWorkForArchive(input: {
    projectId: string;
    actorUserId: string;
    now?: Date;
  }) {
    const projectId = requireString(input.projectId, 'projectId');
    const actorUserId = requireString(input.actorUserId, 'actorUserId');
    const now = input.now ?? new Date();
    await this.lockProjectMembership(projectId);
    const membership = await this.requireActiveProjectMembership(
      projectId,
      actorUserId
    );
    if (membership.role !== 'owner') throw new NotFound('Project not found');

    const requests = await this.db.accessRequest.findMany({
      where: {
        beneficiaryType: 'project',
        beneficiaryProjectId: projectId,
        status: 'pending',
      },
      orderBy: [{ workspaceId: 'asc' }, { docId: 'asc' }, { id: 'asc' }],
    });
    let withdrawnRequestCount = 0;
    for (const request of requests) {
      await this.lockAccessRequest(request);
      const current = await this.db.accessRequest.findUnique({
        where: { id: request.id },
      });
      if (!current || current.status !== 'pending') continue;
      await this.resolveAccessRequest({
        request: current,
        status: 'withdrawn',
        actorUserId: null,
        actorUserIdSnapshot: 'system:project_archived',
        resolutionReason: 'project_archived',
        now,
      });
      withdrawnRequestCount++;
    }

    const invitations = await this.db.aiContextProjectInvitation.findMany({
      where: { projectId, status: 'pending' },
      orderBy: [{ inviteeUserId: 'asc' }, { id: 'asc' }],
    });
    let withdrawnInvitationCount = 0;
    for (const invitation of invitations) {
      await this.lockProjectInvitation(projectId, invitation.inviteeUserId);
      const current = await this.db.aiContextProjectInvitation.findUnique({
        where: { id: invitation.id },
      });
      if (!current || current.status !== 'pending') continue;
      await this.transitionProjectInvitation({
        invitation: current,
        status: 'withdrawn',
        actorUserId: null,
        actorUserIdSnapshot: 'system:project_archived',
        now,
      });
      withdrawnInvitationCount++;
    }
    return { withdrawnRequestCount, withdrawnInvitationCount };
  }

  @Transactional()
  async attachProjectMemorySources(input: {
    memoryId: string;
    projectId: string;
    documents: Array<{ workspaceId: string; docId: string }>;
  }) {
    const uniqueDocuments = new Map<
      string,
      { workspaceId: string; docId: string }
    >();
    for (const document of input.documents) {
      const workspaceId = requireString(document.workspaceId, 'workspaceId');
      const docId = requireString(document.docId, 'docId');
      uniqueDocuments.set(`${workspaceId}\0${docId}`, { workspaceId, docId });
    }
    if (!uniqueDocuments.size) {
      throw new BadRequest(
        'Project memory requires at least one source document'
      );
    }
    const documents = [...uniqueDocuments.values()].sort(
      (left, right) =>
        left.workspaceId.localeCompare(right.workspaceId) ||
        left.docId.localeCompare(right.docId)
    );
    for (const document of documents) {
      await this.lockProjectDocumentAuthorization({
        projectId: input.projectId,
        ...document,
      });
    }
    await this.requireActiveProject(input.projectId);
    const memory = await this.db.aiContextMemory.findFirst({
      where: {
        id: input.memoryId,
        projectId: input.projectId,
        scope: 'project',
      },
      select: { id: true },
    });
    if (!memory) throw new NotFound('Project memory not found');
    const grants = await this.db.aiContextProjectGrant.findMany({
      where: {
        projectId: input.projectId,
        status: 'active',
        OR: documents,
      },
    });
    const grantByDocument = new Map(
      grants.map(grant => [`${grant.workspaceId}\0${grant.docId}`, grant])
    );
    if (grantByDocument.size !== uniqueDocuments.size) {
      throw new BadRequest(
        'Every project memory source requires an active project grant'
      );
    }
    await this.db.aiContextMemorySource.createMany({
      data: documents.map(document => {
        const grant = grantByDocument.get(
          `${document.workspaceId}\0${document.docId}`
        );
        if (!grant) throw new Error('Active project grant disappeared');
        return {
          memoryId: input.memoryId,
          projectId: input.projectId,
          workspaceId: document.workspaceId,
          docId: document.docId,
          projectGrantId: grant.id,
        };
      }),
      skipDuplicates: true,
    });
    return await this.db.aiContextMemorySource.findMany({
      where: { memoryId: input.memoryId },
      orderBy: [{ createdAt: 'asc' }, { projectGrantId: 'asc' }],
    });
  }

  async getProjectInvitation(id: string) {
    return await this.db.aiContextProjectInvitation.findUnique({
      where: { id },
      include: {
        auditEvents: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
    });
  }

  async listProjectInvitations(input: {
    actorUserId: string;
    direction: 'incoming' | 'outgoing' | 'project';
    projectId?: string;
    statuses?: IntelligenceWorkbenchInvitationStatus[];
    limit?: number;
  }) {
    const status = input.statuses?.length ? { in: input.statuses } : undefined;
    const limit = Math.max(1, Math.min(input.limit ?? 50, 100));
    if (input.direction === 'incoming') {
      return await this.db.aiContextProjectInvitation.findMany({
        where: { inviteeUserId: input.actorUserId, status },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      });
    }
    if (input.direction === 'outgoing') {
      return await this.db.aiContextProjectInvitation.findMany({
        where: { inviterUserId: input.actorUserId, status },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      });
    }
    const projectId = requireString(input.projectId, 'projectId');
    const membership = await this.projectMembership(
      projectId,
      input.actorUserId
    );
    if (membership?.role !== 'owner') return [];
    return await this.db.aiContextProjectInvitation.findMany({
      where: { projectId, status },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }

  @Transactional()
  async sendProjectInvitation(input: {
    projectId: string;
    inviterUserId: string;
    inviteeUserId: string;
  }) {
    const projectId = requireString(input.projectId, 'projectId');
    const inviterUserId = requireString(input.inviterUserId, 'inviterUserId');
    const inviteeUserId = requireString(input.inviteeUserId, 'inviteeUserId');
    if (inviterUserId === inviteeUserId) {
      throw new BadRequest('A project owner cannot invite themselves');
    }
    await this.lockProjectInvitation(projectId, inviteeUserId);
    const membership = await this.requireActiveProjectMembership(
      projectId,
      inviterUserId
    );
    if (membership.role !== 'owner') throw new NotFound('Project not found');
    const existingMember = await this.db.aiContextProjectMember.findUnique({
      where: { projectId_userId: { projectId, userId: inviteeUserId } },
    });
    if (existingMember)
      throw new BadRequest('User is already a project member');
    const existing = await this.db.aiContextProjectInvitation.findFirst({
      where: { projectId, inviteeUserId, status: 'pending' },
    });
    if (existing) return { created: false, invitation: existing };
    const invitation = await this.db.aiContextProjectInvitation.create({
      data: {
        projectId,
        inviteeUserId,
        inviterUserId,
        inviterUserIdSnapshot: inviterUserId,
        status: 'pending',
      },
    });
    await this.appendInvitationAudit({
      invitationId: invitation.id,
      eventType: 'sent',
      fromStatus: null,
      toStatus: 'pending',
      actorUserId: inviterUserId,
    });
    return { created: true, invitation };
  }

  @Transactional()
  async transferProjectOwnership(input: {
    projectId: string;
    actorUserId: string;
    memberUserId: string;
  }) {
    const projectId = requireString(input.projectId, 'projectId');
    const actorUserId = requireString(input.actorUserId, 'actorUserId');
    const memberUserId = requireString(input.memberUserId, 'memberUserId');
    if (actorUserId === memberUserId) {
      throw new BadRequest('Project ownership must transfer to another member');
    }
    await this.lockProjectMembership(projectId);
    const actor = await this.requireActiveProjectMembership(
      projectId,
      actorUserId
    );
    if (actor.role !== 'owner') throw new NotFound('Project not found');
    const target = await this.db.aiContextProjectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: memberUserId },
      },
    });
    if (!target) throw new NotFound('Project member not found');

    await this.db.aiContextProjectMember.update({
      where: {
        projectId_userId: { projectId, userId: memberUserId },
      },
      data: { role: 'owner' },
    });
    await this.db.aiContextProjectMember.update({
      where: {
        projectId_userId: { projectId, userId: actorUserId },
      },
      data: { role: 'member' },
    });
    await this.db.aiContextProjectMembershipAuditEvent.create({
      data: {
        projectId,
        eventType: 'ownership_transferred',
        actorUserId,
        actorUserIdSnapshot: actorUserId,
        subjectUserId: memberUserId,
        subjectUserIdSnapshot: memberUserId,
        eventFingerprint: fingerprint([
          'intelligence-workbench-project-membership-audit/v1',
          projectId,
          'ownership_transferred',
          actorUserId,
          memberUserId,
          randomUUID(),
        ]),
        metadata: {
          actorPreviousRole: actor.role,
          actorRole: 'member',
          subjectPreviousRole: target.role,
          subjectRole: 'owner',
        },
      },
    });
    return await this.db.aiContextProjectMember.findMany({
      where: { projectId },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
  }

  @Transactional()
  async acceptProjectInvitation(input: {
    invitationId: string;
    actorUserId: string;
    now?: Date;
  }) {
    return await this.resolveProjectInvitation({
      ...input,
      status: 'accepted',
    });
  }

  @Transactional()
  async declineProjectInvitation(input: {
    invitationId: string;
    actorUserId: string;
    now?: Date;
  }) {
    return await this.resolveProjectInvitation({
      ...input,
      status: 'declined',
    });
  }

  @Transactional()
  async withdrawProjectInvitation(input: {
    invitationId: string;
    actorUserId: string;
    now?: Date;
  }) {
    return await this.resolveProjectInvitation({
      ...input,
      status: 'withdrawn',
    });
  }

  @Transactional()
  async removeProjectMember(input: {
    projectId: string;
    actorUserId: string;
    memberUserId: string;
  }) {
    await this.lockProjectMembership(input.projectId);
    const actor = await this.requireActiveProjectMembership(
      input.projectId,
      input.actorUserId
    );
    if (actor.role !== 'owner') throw new NotFound('Project not found');
    await this.assertProjectMemberCanBeRemoved(
      input.projectId,
      input.memberUserId
    );
    const result = await this.db.aiContextProjectMember.deleteMany({
      where: { projectId: input.projectId, userId: input.memberUserId },
    });
    return result.count === 1;
  }

  @Transactional()
  async leaveProject(input: { projectId: string; userId: string }) {
    await this.lockProjectMembership(input.projectId);
    await this.requireActiveProjectMembership(input.projectId, input.userId);
    await this.assertProjectMemberCanBeRemoved(input.projectId, input.userId);
    const result = await this.db.aiContextProjectMember.deleteMany({
      where: { projectId: input.projectId, userId: input.userId },
    });
    return result.count === 1;
  }

  @Transactional()
  async setProjectAiPolicy(input: {
    projectId: string;
    actorUserId: string;
    policy: IntelligenceWorkbenchProjectAiPolicy;
  }) {
    const projectId = requireString(input.projectId, 'projectId');
    const actorUserId = requireString(input.actorUserId, 'actorUserId');
    const policy = requireProjectAiPolicy(input.policy);
    await this.lockProjectMembership(projectId);
    const membership = await this.requireActiveProjectMembership(
      projectId,
      actorUserId
    );
    if (membership.role !== 'owner') throw new NotFound('Project not found');
    const project = await this.db.aiContextProject.findUnique({
      where: { id: projectId },
      select: { aiPolicy: true },
    });
    if (!project) throw new NotFound('Project not found');
    if (project.aiPolicy === policy) {
      return await this.db.aiContextProject.findUnique({
        where: { id: projectId },
      });
    }
    const now = new Date();
    const updated = await this.db.aiContextProject.update({
      where: { id: projectId },
      data: {
        aiPolicy: policy,
        aiPolicyUpdatedByUserId: actorUserId,
        aiPolicyUpdatedAt: now,
      },
    });
    await this.db.aiContextProjectPolicyAuditEvent.create({
      data: {
        projectId,
        actorUserId,
        actorUserIdSnapshot: actorUserId,
        previousPolicy: project.aiPolicy,
        policy,
        eventFingerprint: fingerprint([
          'intelligence-workbench-project-policy/v1',
          projectId,
          project.aiPolicy,
          policy,
          now.toISOString(),
        ]),
      },
    });
    return updated;
  }

  private async projectMembership(projectId: string, userId: string) {
    const membership = await this.db.aiContextProjectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: {
        project: { select: { status: true, aiPolicy: true } },
      },
    });
    if (!membership) return null;
    return {
      role: membership.role as 'owner' | 'member',
      projectStatus: membership.project.status,
      aiPolicy: membership.project
        .aiPolicy as IntelligenceWorkbenchProjectAiPolicy,
    } satisfies ProjectMembership;
  }

  private async requireProjectMembership(projectId: string, userId: string) {
    const membership = await this.projectMembership(projectId, userId);
    if (!membership) throw new NotFound('Project not found');
    return membership;
  }

  private async requireActiveProjectMembership(
    projectId: string,
    userId: string
  ) {
    const membership = await this.requireProjectMembership(projectId, userId);
    if (membership.projectStatus !== 'active') {
      throw new NotFound('Project not found');
    }
    return membership;
  }

  private async requireActiveProject(projectId: string) {
    const project = await this.db.aiContextProject.findFirst({
      where: { id: projectId, status: 'active' },
      select: { id: true },
    });
    if (!project) throw new NotFound('Project not found');
    return project;
  }

  private async lockSourceDocument(workspaceId: string, docId: string) {
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${permissionWorkspaceLockKey(workspaceId)}, 0))`;
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${permissionDocumentLockKey(workspaceId, docId)}, 0))`;
  }

  private async lockProjectDocumentKey(input: ProjectDocumentRef) {
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intelligence-workbench:project-document:${input.projectId}:${input.workspaceId}:${input.docId}`}, 0))`;
  }

  private async lockProjectMembership(projectId: string) {
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intelligence-workbench:project-membership:${projectId}`}, 0))`;
  }

  private async assertProjectMemberCanBeRemoved(
    projectId: string,
    userId: string
  ) {
    const member = await this.db.aiContextProjectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    });
    if (member?.role !== 'owner') return;
    const ownerCount = await this.db.aiContextProjectMember.count({
      where: { projectId, role: 'owner' },
    });
    if (ownerCount <= 1) {
      throw new BadRequest('A project must retain at least one owner');
    }
  }

  private async lockProjectInvitation(
    projectId: string,
    inviteeUserId: string
  ) {
    await this.lockProjectMembership(projectId);
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intelligence-workbench:project-invitation:${projectId}:${inviteeUserId}`}, 0))`;
  }

  private async sourceDocumentCapability(input: {
    workspaceId: string;
    docId: string;
    userId: string;
  }) {
    const rows = await this.db.$queryRaw<
      Array<{
        memberRole: string | null;
        explicitRole: string | null;
        memberDefaultRole: string;
        sharingEnabled: boolean;
        runtimeKnown: boolean;
        runtimeStale: boolean;
        staleAfter: Date | null;
      }>
    >`
      SELECT
        member.role AS "memberRole",
        NULLIF(explicit_grant.role, 'none') AS "explicitRole",
        COALESCE(
          doc_policy.member_default_role,
          workspace_policy.member_default_doc_role,
          'manager'
        ) AS "memberDefaultRole",
        COALESCE(workspace_policy.sharing_enabled, true) AS "sharingEnabled",
        COALESCE(runtime.known, false) AS "runtimeKnown",
        COALESCE(runtime.stale, true) AS "runtimeStale",
        runtime.stale_after AS "staleAfter"
      FROM workspaces workspace
      LEFT JOIN workspace_members member
        ON member.workspace_id = workspace.id
       AND member.user_id = ${input.userId}
       AND member.state = 'active'
      LEFT JOIN workspace_access_policies workspace_policy
        ON workspace_policy.workspace_id = workspace.id
      LEFT JOIN doc_access_policies doc_policy
        ON doc_policy.workspace_id = workspace.id
       AND doc_policy.doc_id = ${input.docId}
      LEFT JOIN doc_grants explicit_grant
        ON explicit_grant.workspace_id = workspace.id
       AND explicit_grant.doc_id = ${input.docId}
       AND explicit_grant.principal_type = 'user'
       AND explicit_grant.principal_id = ${input.userId}
      LEFT JOIN effective_workspace_quota_states runtime
        ON runtime.workspace_id = workspace.id
      WHERE workspace.id = ${input.workspaceId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return { canShare: false, level: null };
    const runtimeStale =
      row.runtimeStale ||
      (row.staleAfter !== null && row.staleAfter <= new Date());
    let role = row.explicitRole;
    if (row.memberRole === 'owner') {
      role = 'owner';
    } else if (row.memberRole === 'admin') {
      role = 'manager';
    } else if (row.memberRole === 'member' && !role) {
      role = row.memberDefaultRole;
    } else if (!row.memberRole && role) {
      role = row.sharingEnabled
        ? role === 'owner' || role === 'manager'
          ? 'editor'
          : role
        : null;
    }
    const canShare =
      row.runtimeKnown &&
      !runtimeStale &&
      (role === 'owner' || role === 'manager');
    return {
      canShare,
      level:
        role === 'owner' || role === 'manager' || role === 'editor'
          ? ('write' as const)
          : role === 'commenter' || role === 'reader'
            ? ('read' as const)
            : null,
    };
  }

  private async requireSourceDecisionActor(input: {
    workspaceId: string;
    docId: string;
    userId: string;
  }) {
    const rows = await this.db.$queryRaw<Array<{ allowed: boolean }>>`
      SELECT (
        EXISTS (
          SELECT 1
          FROM workspace_members member
          WHERE member.workspace_id = ${input.workspaceId}
            AND member.user_id = ${input.userId}
            AND member.state = 'active'
            AND member.role IN ('owner', 'admin')
        ) OR EXISTS (
          SELECT 1
          FROM doc_grants explicit_grant
          WHERE explicit_grant.workspace_id = ${input.workspaceId}
            AND explicit_grant.doc_id = ${input.docId}
            AND explicit_grant.principal_type = 'user'
            AND explicit_grant.principal_id = ${input.userId}
            AND explicit_grant.role = 'owner'
        )
      ) AS "allowed"
    `;
    if (!rows[0]?.allowed) throw new NotFound('Access request not found');
  }

  private async findActiveProjectGrant(input: ProjectDocumentRef) {
    return await this.db.aiContextProjectGrant.findFirst({
      where: {
        projectId: input.projectId,
        workspaceId: input.workspaceId,
        docId: input.docId,
        status: 'active',
      },
    });
  }

  private async ensureProjectDocumentCapacity(projectId: string) {
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intelligence-workbench:project-document-capacity:${projectId}`}, 0))`;
    const count = await this.db.aiContextProjectDoc.count({
      where: { projectId },
    });
    if (count >= PROJECT_DOCUMENT_LIMIT) {
      throw new BadRequest(
        `A project cannot contain more than ${PROJECT_DOCUMENT_LIMIT} documents`
      );
    }
  }

  private async createProjectGrant(
    input: ProjectDocumentRef & {
      actorUserId: string;
      addedByUserId?: string | null;
      requestedLevel: IntelligenceWorkbenchGrantLevel | string;
      suppliedTitle?: string | null;
      groupId?: string | null;
      sortOrder?: number;
      source: 'direct' | 'access_request';
      accessRequestId?: string;
    }
  ) {
    const level = requireGrantLevel(input.requestedLevel);
    const title = optionalString(
      input.suppliedTitle,
      'suppliedTitle',
      MAX_TITLE_LENGTH
    );
    if (input.source === 'direct') {
      await this.withdrawSupersededProjectRequests({
        ...input,
        actorUserId: input.actorUserId,
      });
    }
    const existing = await this.findActiveProjectGrant(input);
    if (existing) {
      if (existing.level !== level) {
        throw new BadRequest(
          'An active project grant already exists at a different level'
        );
      }
      if (input.groupId !== undefined || input.sortOrder !== undefined) {
        await this.db.aiContextProjectDoc.updateMany({
          where: {
            projectId: input.projectId,
            workspaceId: input.workspaceId,
            docId: input.docId,
            status: 'granted',
          },
          data: {
            groupId: input.groupId,
            sortOrder: input.sortOrder,
          },
        });
      }
      return existing;
    }
    const documentKey = {
      projectId_workspaceId_docId: {
        projectId: input.projectId,
        workspaceId: input.workspaceId,
        docId: input.docId,
      },
    };
    const document = await this.db.aiContextProjectDoc.findUnique({
      where: documentKey,
      select: { projectId: true },
    });
    if (!document) await this.ensureProjectDocumentCapacity(input.projectId);
    await this.db.aiContextProjectDoc.upsert({
      where: documentKey,
      create: {
        projectId: input.projectId,
        workspaceId: input.workspaceId,
        docId: input.docId,
        groupId: input.groupId ?? null,
        sortOrder: input.sortOrder ?? 0,
        status: 'granted',
        requestedLevel: level,
        addedByUserId: input.addedByUserId ?? input.actorUserId,
        placeholderInitiatorUserId: null,
        suppliedTitle: null,
        revokedAt: null,
      },
      update: {
        groupId: input.groupId,
        sortOrder: input.sortOrder,
        status: 'granted',
        requestedLevel: level,
        addedByUserId: input.addedByUserId ?? input.actorUserId,
        placeholderInitiatorUserId: null,
        suppliedTitle: null,
        revokedAt: null,
      },
    });
    const now = new Date();
    const grant = await this.db.aiContextProjectGrant.create({
      data: {
        projectId: input.projectId,
        workspaceId: input.workspaceId,
        docId: input.docId,
        level,
        status: 'active',
        source: input.source,
        approvingSide: 'source',
        revocable: true,
        grantedByUserId: input.actorUserId,
        grantorUserIdSnapshot: input.actorUserId,
        accessRequestId: input.accessRequestId,
        grantedAt: now,
      },
    });
    await this.db.aiContextProjectGrantAuditEvent.create({
      data: {
        grantId: grant.id,
        eventType: 'granted',
        actorUserId: input.actorUserId,
        actorUserIdSnapshot: input.actorUserId,
        level,
        source: input.source,
        eventFingerprint: fingerprint([
          'intelligence-workbench-project-grant/v1',
          grant.id,
          'granted',
        ]),
        metadata: {
          accessRequestId: input.accessRequestId ?? null,
          requestedTitlePresent: title !== null,
        },
      },
    });
    return grant;
  }

  private async withdrawSupersededProjectRequests(
    input: ProjectDocumentRef & { actorUserId: string }
  ) {
    const pending = await this.db.accessRequest.findMany({
      where: {
        beneficiaryType: 'project',
        beneficiaryProjectId: input.projectId,
        workspaceId: input.workspaceId,
        docId: input.docId,
        status: 'pending',
      },
      orderBy: { id: 'asc' },
    });
    const now = new Date();
    for (const request of pending) {
      await this.resolveAccessRequest({
        request,
        status: 'withdrawn',
        actorUserId: input.actorUserId,
        resolutionReason: 'superseded_by_direct_grant',
        now,
      });
    }
  }

  private async createAccessRequest(
    input: IntelligenceWorkbenchRequestAccessInput & {
      projectId?: string;
      groupId?: string | null;
      sortOrder?: number;
      requesterSuppliedIdentity?: boolean;
    }
  ) {
    const requesterSuppliedIdentity = input.requesterSuppliedIdentity ?? true;
    const normalized = {
      workspaceId: requireString(input.workspaceId, 'workspaceId'),
      docId: requireString(input.docId, 'docId'),
      requesterUserId: requireString(input.requesterUserId, 'requesterUserId'),
      requestedLevel: requireGrantLevel(input.requestedLevel),
      requestedTitle: optionalString(
        input.requestedTitle,
        'requestedTitle',
        MAX_TITLE_LENGTH
      ),
      requesterSuppliedIdentity,
    };
    if (
      !normalized.requesterSuppliedIdentity &&
      normalized.requestedTitle !== null
    ) {
      throw new BadRequest(
        'A request without requester-supplied document identity cannot include a title'
      );
    }
    const idempotencyKey =
      input.idempotencyKey === undefined
        ? randomUUID()
        : requireString(
            input.idempotencyKey,
            'idempotencyKey',
            MAX_IDEMPOTENCY_KEY_LENGTH
          );
    const beneficiary =
      input.beneficiaryType === 'user'
        ? {
            beneficiaryType: 'user' as const,
            beneficiaryUserId: requireString(
              input.beneficiaryUserId,
              'beneficiaryUserId'
            ),
            beneficiaryProjectId: null,
          }
        : {
            beneficiaryType: 'project' as const,
            beneficiaryUserId: null,
            beneficiaryProjectId: requireString(
              input.beneficiaryProjectId,
              'beneficiaryProjectId'
            ),
          };
    const requestFingerprint = fingerprint([
      'intelligence-workbench-access-request/v1',
      normalized.workspaceId,
      normalized.docId,
      beneficiary.beneficiaryType,
      beneficiary.beneficiaryUserId ?? beneficiary.beneficiaryProjectId,
      normalized.requesterUserId,
      normalized.requestedLevel,
      String(normalized.requesterSuppliedIdentity),
      idempotencyKey,
    ]);
    const replay = await this.db.accessRequest.findUnique({
      where: { requestFingerprint },
    });
    if (replay) return { created: false, request: replay };
    if (input.expiresAt && input.expiresAt <= new Date()) {
      throw new BadRequest('Access request expiration must be in the future');
    }
    const pending = await this.db.accessRequest.findFirst({
      where: {
        workspaceId: normalized.workspaceId,
        docId: normalized.docId,
        beneficiaryType: beneficiary.beneficiaryType,
        beneficiaryUserId: beneficiary.beneficiaryUserId,
        beneficiaryProjectId: beneficiary.beneficiaryProjectId,
        status: 'pending',
      },
    });
    if (pending) {
      if (pending.expiresAt && pending.expiresAt <= new Date()) {
        await this.expirePendingAccessRequest(pending, new Date());
      } else {
        return { created: false, request: pending };
      }
    }
    const request = await this.db.accessRequest.create({
      data: {
        ...normalized,
        ...beneficiary,
        requesterUserIdSnapshot: normalized.requesterUserId,
        requestFingerprint,
        status: 'pending',
        expiresAt: input.expiresAt ?? null,
      },
    });
    if (beneficiary.beneficiaryProjectId) {
      const documentKey = {
        projectId_workspaceId_docId: {
          projectId: beneficiary.beneficiaryProjectId,
          workspaceId: normalized.workspaceId,
          docId: normalized.docId,
        },
      };
      const document = await this.db.aiContextProjectDoc.findUnique({
        where: documentKey,
        select: { projectId: true },
      });
      if (!document) {
        await this.ensureProjectDocumentCapacity(
          beneficiary.beneficiaryProjectId
        );
      }
      await this.db.aiContextProjectDoc.upsert({
        where: documentKey,
        create: {
          projectId: beneficiary.beneficiaryProjectId,
          workspaceId: normalized.workspaceId,
          docId: normalized.docId,
          groupId: input.groupId ?? null,
          sortOrder: input.sortOrder ?? 0,
          status: 'pending',
          requestedLevel: normalized.requestedLevel,
          addedByUserId: normalized.requesterUserId,
          placeholderInitiatorUserId: normalized.requesterSuppliedIdentity
            ? normalized.requesterUserId
            : null,
          suppliedTitle: normalized.requestedTitle,
        },
        update: {
          groupId: input.groupId,
          sortOrder: input.sortOrder,
          status: 'pending',
          requestedLevel: normalized.requestedLevel,
          placeholderInitiatorUserId: normalized.requesterSuppliedIdentity
            ? normalized.requesterUserId
            : null,
          suppliedTitle: normalized.requestedTitle,
          revokedAt: null,
        },
      });
    }
    await this.appendAccessRequestAudit({
      requestId: request.id,
      eventType: 'requested',
      fromStatus: null,
      toStatus: 'pending',
      actorUserId: normalized.requesterUserId,
      metadata: {
        requesterSuppliedIdentity: normalized.requesterSuppliedIdentity,
      },
    });
    return { created: true, request };
  }

  private async requireAccessRequest(id: string) {
    const request = await this.db.accessRequest.findUnique({
      where: { id: requireString(id, 'requestId') },
    });
    if (!request) throw new NotFound('Access request not found');
    return request;
  }

  private async lockAccessRequest(request: {
    id: string;
    workspaceId: string;
    docId: string;
    beneficiaryProjectId: string | null;
  }) {
    if (request.beneficiaryProjectId) {
      await this.lockProjectDocumentAuthorization({
        projectId: request.beneficiaryProjectId,
        workspaceId: request.workspaceId,
        docId: request.docId,
      });
    } else {
      await this.lockSourceDocument(request.workspaceId, request.docId);
    }
    await this.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`intelligence-workbench:access-request:${request.id}`}, 0))`;
  }

  private async resolveAccessRequest(input: {
    request: AccessRequest;
    status: 'approved' | 'rejected' | 'withdrawn';
    actorUserId: string | null;
    actorUserIdSnapshot?: string;
    resolutionReason?: string | null;
    now: Date;
  }) {
    const resolutionReason = optionalString(
      input.resolutionReason,
      'resolutionReason',
      MAX_REASON_LENGTH
    );
    const actorUserIdSnapshot = input.actorUserIdSnapshot ?? input.actorUserId;
    if (!actorUserIdSnapshot) {
      throw new Error('Access request resolution requires actor provenance');
    }
    const request = await this.db.accessRequest.update({
      where: { id: input.request.id, status: 'pending' },
      data: {
        status: input.status,
        resolvedByUserId: input.actorUserId,
        resolverUserIdSnapshot: actorUserIdSnapshot,
        resolutionReason,
        resolvedAt: input.now,
      },
    });
    await this.appendAccessRequestAudit({
      requestId: request.id,
      eventType: input.status,
      fromStatus: 'pending',
      toStatus: input.status,
      actorUserId: input.actorUserId,
      actorUserIdSnapshot,
      metadata: resolutionReason ? { resolutionReason } : undefined,
    });
    if (
      input.status !== 'approved' &&
      request.beneficiaryType === 'project' &&
      request.beneficiaryProjectId
    ) {
      await this.db.aiContextProjectDoc.updateMany({
        where: {
          projectId: request.beneficiaryProjectId,
          workspaceId: request.workspaceId,
          docId: request.docId,
          status: 'pending',
        },
        data: {
          status: 'revoked',
          placeholderInitiatorUserId: null,
          suppliedTitle: null,
          revokedAt: input.now,
        },
      });
    }
    return request;
  }

  private async expirePendingAccessRequest(request: AccessRequest, now: Date) {
    const expired = await this.db.accessRequest.update({
      where: { id: request.id, status: 'pending' },
      data: { status: 'expired', resolvedAt: now },
    });
    await this.appendAccessRequestAudit({
      requestId: request.id,
      eventType: 'expired',
      fromStatus: 'pending',
      toStatus: 'expired',
      actorUserId: null,
    });
    if (request.beneficiaryProjectId) {
      await this.db.aiContextProjectDoc.updateMany({
        where: {
          projectId: request.beneficiaryProjectId,
          workspaceId: request.workspaceId,
          docId: request.docId,
          status: 'pending',
        },
        data: {
          status: 'revoked',
          placeholderInitiatorUserId: null,
          suppliedTitle: null,
          revokedAt: now,
        },
      });
    }
    return expired;
  }

  private async appendAccessRequestAudit(input: {
    requestId: string;
    eventType: 'requested' | 'approved' | 'rejected' | 'expired' | 'withdrawn';
    fromStatus: string | null;
    toStatus: string;
    actorUserId: string | null;
    actorUserIdSnapshot?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const event = await this.db.accessRequestAuditEvent.create({
      data: {
        accessRequestId: input.requestId,
        eventType: input.eventType,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        actorUserId: input.actorUserId,
        actorUserIdSnapshot: input.actorUserIdSnapshot ?? input.actorUserId,
        eventFingerprint: fingerprint([
          'intelligence-workbench-access-request-audit/v1',
          input.requestId,
          input.eventType,
        ]),
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    const request = await this.requireAccessRequest(input.requestId);
    await this.models.notification.syncAccessRequest(request);
    return event;
  }

  private async upsertPersonalDocGrant(input: {
    workspaceId: string;
    docId: string;
    userId: string;
    level: IntelligenceWorkbenchGrantLevel;
    grantedByUserId: string;
  }) {
    const requestedRole = input.level === 'write' ? 'editor' : 'reader';
    const rows = await this.db.$queryRaw<
      Array<{ role: 'owner' | 'manager' | 'editor' | 'commenter' | 'reader' }>
    >`
      INSERT INTO doc_grants (
        workspace_id,
        doc_id,
        principal_type,
        principal_id,
        role,
        granted_by,
        created_at,
        updated_at
      ) VALUES (
        ${input.workspaceId},
        ${input.docId},
        'user',
        ${input.userId},
        ${requestedRole},
        ${input.grantedByUserId},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (workspace_id, doc_id, principal_type, principal_id)
      DO UPDATE SET
        role = CASE
          WHEN doc_grants.role = 'owner' THEN 'owner'
          WHEN doc_grants.role = 'manager' THEN 'manager'
          WHEN doc_grants.role = 'editor' THEN 'editor'
          WHEN doc_grants.role = 'commenter' AND EXCLUDED.role = 'reader'
            THEN 'commenter'
          WHEN EXCLUDED.role = 'editor' THEN 'editor'
          ELSE 'reader'
        END,
        granted_by = EXCLUDED.granted_by,
        updated_at = CURRENT_TIMESTAMP
      RETURNING role
    `;
    return rows[0];
  }

  private async revokeProjectGrantInternal(input: {
    grant: AiContextProjectGrant;
    actorUserId: string | null;
    actorUserIdSnapshot?: string;
    reason?: string | null;
    keepPlaceholder: boolean;
    now: Date;
  }) {
    const reason = optionalString(input.reason, 'reason', MAX_REASON_LENGTH);
    const actorUserIdSnapshot = input.actorUserIdSnapshot ?? input.actorUserId;
    if (!actorUserIdSnapshot) {
      throw new Error('Project grant revocation requires actor provenance');
    }
    const quarantined = await this.db.aiContextMemory.updateMany({
      where: {
        scope: 'project',
        status: 'active',
        sources: { some: { projectGrantId: input.grant.id } },
      },
      data: {
        status: 'disabled',
        quarantinedAt: input.now,
        quarantineReason: reason ?? 'project_grant_revoked',
        quarantinedByProjectGrantId: input.grant.id,
      },
    });
    const grant = await this.db.aiContextProjectGrant.update({
      where: { id: input.grant.id },
      data: {
        status: 'revoked',
        revokedByUserId: input.actorUserId,
        revokerUserIdSnapshot: actorUserIdSnapshot,
        revokedAt: input.now,
      },
    });
    if (input.keepPlaceholder) {
      await this.db.aiContextProjectDoc.updateMany({
        where: {
          projectId: grant.projectId,
          workspaceId: grant.workspaceId,
          docId: grant.docId,
        },
        data: {
          status: 'revoked',
          requestedLevel: grant.level,
          placeholderInitiatorUserId: null,
          suppliedTitle: null,
          revokedAt: input.now,
        },
      });
    }
    await this.db.aiContextProjectGrantAuditEvent.create({
      data: {
        grantId: grant.id,
        eventType: 'revoked',
        actorUserId: input.actorUserId,
        actorUserIdSnapshot,
        level: grant.level,
        source: grant.source,
        eventFingerprint: fingerprint([
          'intelligence-workbench-project-grant/v1',
          grant.id,
          'revoked',
        ]),
        metadata: {
          reason,
          quarantinedMemoryCount: quarantined.count,
        },
      },
    });
    return {
      grant,
      rerequestCardId: input.keepPlaceholder
        ? projectDocumentCardId(grant)
        : null,
      quarantinedMemoryCount: quarantined.count,
    };
  }

  private async resolveProjectInvitation(input: {
    invitationId: string;
    actorUserId: string;
    status: Exclude<IntelligenceWorkbenchInvitationStatus, 'pending'>;
    now?: Date;
  }) {
    const actorUserId = requireString(input.actorUserId, 'actorUserId');
    const invitation = await this.db.aiContextProjectInvitation.findUnique({
      where: { id: requireString(input.invitationId, 'invitationId') },
    });
    if (!invitation) throw new NotFound('Project invitation not found');
    await this.lockProjectInvitation(
      invitation.projectId,
      invitation.inviteeUserId
    );
    const current = await this.db.aiContextProjectInvitation.findUnique({
      where: { id: invitation.id },
    });
    if (!current) throw new NotFound('Project invitation not found');
    if (input.status === 'accepted' || input.status === 'declined') {
      if (current.inviteeUserId !== actorUserId) {
        throw new NotFound('Project invitation not found');
      }
    } else {
      const membership = await this.projectMembership(
        current.projectId,
        actorUserId
      );
      if (
        current.inviterUserId !== actorUserId &&
        membership?.role !== 'owner'
      ) {
        throw new NotFound('Project invitation not found');
      }
    }
    if (current.status !== 'pending') return current;
    const now = input.now ?? new Date();
    if (input.status === 'accepted') {
      await this.requireActiveProject(current.projectId);
      await this.db.aiContextProjectMember.upsert({
        where: {
          projectId_userId: {
            projectId: current.projectId,
            userId: current.inviteeUserId,
          },
        },
        create: {
          projectId: current.projectId,
          userId: current.inviteeUserId,
          role: 'member',
        },
        update: {},
      });
    }
    return await this.transitionProjectInvitation({
      invitation: current,
      status: input.status,
      actorUserId,
      now,
    });
  }

  private async transitionProjectInvitation(input: {
    invitation: AiContextProjectInvitation;
    status: Exclude<IntelligenceWorkbenchInvitationStatus, 'pending'>;
    actorUserId: string | null;
    actorUserIdSnapshot?: string;
    now: Date;
  }) {
    const actorUserIdSnapshot = input.actorUserIdSnapshot ?? input.actorUserId;
    if (!actorUserIdSnapshot) {
      throw new Error(
        'Project invitation resolution requires actor provenance'
      );
    }
    const updated = await this.db.aiContextProjectInvitation.update({
      where: { id: input.invitation.id },
      data: {
        status: input.status,
        ...terminalTimestampData(input.status, input.now),
      },
    });
    await this.appendInvitationAudit({
      invitationId: input.invitation.id,
      eventType: input.status,
      fromStatus: 'pending',
      toStatus: input.status,
      actorUserId: input.actorUserId,
      actorUserIdSnapshot,
    });
    return updated;
  }

  private async appendInvitationAudit(input: {
    invitationId: string;
    eventType: 'sent' | 'accepted' | 'declined' | 'withdrawn';
    fromStatus: string | null;
    toStatus: string;
    actorUserId: string | null;
    actorUserIdSnapshot?: string;
  }) {
    return await this.db.aiContextProjectInvitationAuditEvent.create({
      data: {
        invitationId: input.invitationId,
        eventType: input.eventType,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        actorUserId: input.actorUserId,
        actorUserIdSnapshot: input.actorUserIdSnapshot ?? input.actorUserId,
        eventFingerprint: fingerprint([
          'intelligence-workbench-project-invitation-audit/v1',
          input.invitationId,
          input.eventType,
        ]),
      },
    });
  }
}
