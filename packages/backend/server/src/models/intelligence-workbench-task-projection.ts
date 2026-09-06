import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { BadRequest } from '../base';
import { BaseModel } from './base';
import type { CopilotAgentRunRecord } from './copilot-agent-runtime';
import type {
  IntelligenceWorkbenchBlockerOrigin,
  IntelligenceWorkbenchBlockerType,
} from './intelligence-workbench-blocker';

export const INTELLIGENCE_WORKBENCH_TODO_LIMIT = 50;
export const INTELLIGENCE_WORKBENCH_IN_PROGRESS_LIMIT = 50;
export const INTELLIGENCE_WORKBENCH_DONE_LIMIT = 20;
export const INTELLIGENCE_WORKBENCH_FULL_LIST_LIMIT = 100;
export const INTELLIGENCE_WORKBENCH_DONE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type IntelligenceWorkbenchTaskItemKind =
  | 'run'
  | 'access_request'
  | 'project_invitation'
  | 'project_grant'
  | 'blocker';

export type IntelligenceWorkbenchTaskSegment = 'todo' | 'in_progress' | 'done';

export type IntelligenceWorkbenchTaskAttention =
  | 'needs_my_action'
  | 'waiting_on_others'
  | null;

export type IntelligenceWorkbenchTaskAction =
  | 'abandon'
  | 'approve'
  | 'cancel'
  | 'reject'
  | 'resume'
  | 'approve_access_request'
  | 'reject_access_request'
  | 'withdraw_access_request'
  | 'request_project_access'
  | 'accept_project_invitation'
  | 'decline_project_invitation'
  | 'withdraw_project_invitation'
  | 'resolve_blocker'
  | 'abandon_blocker';

export type IntelligenceWorkbenchTaskBlocker = {
  creatorUserId: string;
  type: IntelligenceWorkbenchBlockerType;
  waitingOn: string;
  dueAt: Date | null;
  overdue: boolean;
  origin: IntelligenceWorkbenchBlockerOrigin;
  resolutionActorUserId: string | null;
};

export type IntelligenceWorkbenchTaskItem = {
  id: string;
  entityId: string;
  kind: IntelligenceWorkbenchTaskItemKind;
  segment: IntelligenceWorkbenchTaskSegment;
  attention: IntelligenceWorkbenchTaskAttention;
  workspaceId: string | null;
  projectId: string | null;
  title: string | null;
  status: string;
  requestedLevel: string | null;
  documentId: string | null;
  redacted: boolean;
  relatedUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  availableActions: IntelligenceWorkbenchTaskAction[];
  run: CopilotAgentRunRecord | null;
  blocker: IntelligenceWorkbenchTaskBlocker | null;
};

export type IntelligenceWorkbenchTaskProjectionSegment = {
  items: IntelligenceWorkbenchTaskItem[];
  capped: boolean;
};

export type IntelligenceWorkbenchTaskPanel = {
  todo: IntelligenceWorkbenchTaskProjectionSegment;
  inProgress: IntelligenceWorkbenchTaskProjectionSegment;
  done: IntelligenceWorkbenchTaskProjectionSegment;
};

type RunCandidateRow = {
  id: string;
  workspaceId: string;
};

type AccessRequestCandidateRow = {
  id: string;
  workspaceId: string;
  docId: string;
  beneficiaryType: string;
  beneficiaryUserId: string | null;
  beneficiaryProjectId: string | null;
  requesterUserIdSnapshot: string;
  requesterSuppliedIdentity: boolean;
  requestedLevel: string;
  requestedTitle: string | null;
  status: string;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sourceDecisionActor: boolean;
  projectMember: boolean;
  projectOwner: boolean;
  activeProjectGrant: boolean;
};

type ProjectInvitationCandidateRow = {
  id: string;
  projectId: string;
  projectName: string;
  inviteeUserId: string;
  inviterUserIdSnapshot: string;
  status: string;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  withdrawnAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  invitee: boolean;
  inviter: boolean;
  projectOwner: boolean;
};

type ProjectGrantCandidateRow = {
  id: string;
  projectId: string;
  projectName: string;
  projectStatus: string;
  workspaceId: string;
  docId: string;
  level: string;
  status: string;
  grantedAt: Date;
  revokedAt: Date | null;
  updatedAt: Date;
  projectMember: boolean;
  sourceManager: boolean;
  hasRevokedPlaceholder: boolean;
  hasPendingRequest: boolean;
  hasActiveReplacement: boolean;
  latestRevokedGrant: boolean;
};

type BlockerCandidateRow = {
  id: string;
  projectId: string;
  creatorUserIdSnapshot: string;
  title: string;
  type: string;
  waitingOn: string;
  dueAt: Date | null;
  status: string;
  origin: string;
  resolutionActorUserIdSnapshot: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  overdue: boolean;
};

type BoundedItems = {
  items: IntelligenceWorkbenchTaskItem[];
  capped: boolean;
};

const HISTORY_KINDS = [
  'run',
  'access_request',
  'project_invitation',
  'project_grant',
  'blocker',
] as const;
export const WORKBENCH_TASK_FILTERS = [
  'all',
  'active',
  'approval',
  'completed',
] as const;
type HistoryFilter = (typeof WORKBENCH_TASK_FILTERS)[number];
type HistoryCursor = {
  userId: string;
  projectId: string | null;
  filter: HistoryFilter;
  updatedAt: string;
  kind: IntelligenceWorkbenchTaskItemKind;
  entityId: string;
};
type HistorySelection = {
  cursor: HistoryCursor | null;
  filter: HistoryFilter;
  taskId: string | null;
};

function historyOrder(
  left: IntelligenceWorkbenchTaskItem,
  right: IntelligenceWorkbenchTaskItem
) {
  return (
    right.updatedAt.getTime() - left.updatedAt.getTime() ||
    HISTORY_KINDS.indexOf(left.kind) - HISTORY_KINDS.indexOf(right.kind) ||
    (left.entityId < right.entityId
      ? 1
      : left.entityId > right.entityId
        ? -1
        : 0)
  );
}

function decodeHistoryCursor(
  value: string | null | undefined,
  scope: Pick<HistoryCursor, 'userId' | 'projectId' | 'filter'>
): HistoryCursor | null {
  if (!value) return null;
  try {
    if (value.length > 4096) throw new Error();
    const cursor: HistoryCursor = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8')
    );
    if (
      cursor.userId !== scope.userId ||
      cursor.projectId !== scope.projectId ||
      cursor.filter !== scope.filter ||
      !HISTORY_KINDS.includes(cursor.kind) ||
      typeof cursor.entityId !== 'string' ||
      !cursor.entityId ||
      cursor.entityId.length > 512 ||
      typeof cursor.updatedAt !== 'string' ||
      !Number.isFinite(new Date(cursor.updatedAt).getTime())
    )
      throw new Error();
    return cursor;
  } catch {
    throw new BadRequest('Invalid task history cursor');
  }
}

function normalizeOptionalId(value: string | null | undefined, field: string) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new BadRequest(`${field} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > 512) {
    throw new BadRequest(`${field} must contain 1-512 characters`);
  }
  return normalized;
}

function newestFirst(
  left: IntelligenceWorkbenchTaskItem,
  right: IntelligenceWorkbenchTaskItem
) {
  const difference = right.updatedAt.getTime() - left.updatedAt.getTime();
  return difference || left.id.localeCompare(right.id);
}

function panelTodoOrder(
  left: IntelligenceWorkbenchTaskItem,
  right: IntelligenceWorkbenchTaskItem
) {
  const leftPriority = left.attention === 'needs_my_action' ? 0 : 1;
  const rightPriority = right.attention === 'needs_my_action' ? 0 : 1;
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;
  const leftOverdue = left.blocker?.overdue ? 0 : 1;
  const rightOverdue = right.blocker?.overdue ? 0 : 1;
  if (leftOverdue !== rightOverdue) return leftOverdue - rightOverdue;
  if (leftOverdue === 0 && rightOverdue === 0) {
    const leftDueAt = left.blocker?.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightDueAt =
      right.blocker?.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (leftDueAt !== rightDueAt) return leftDueAt - rightDueAt;
  }
  return newestFirst(left, right);
}

function panelDoneOrder(
  left: IntelligenceWorkbenchTaskItem,
  right: IntelligenceWorkbenchTaskItem
) {
  const leftTime = (left.completedAt ?? left.updatedAt).getTime();
  const rightTime = (right.completedAt ?? right.updatedAt).getTime();
  return rightTime - leftTime || left.id.localeCompare(right.id);
}

function boundItems(
  sources: BoundedItems[],
  limit: number,
  compare: (
    left: IntelligenceWorkbenchTaskItem,
    right: IntelligenceWorkbenchTaskItem
  ) => number
): IntelligenceWorkbenchTaskProjectionSegment {
  const items = sources.flatMap(source => source.items).sort(compare);
  return {
    items: items.slice(0, limit),
    capped: sources.some(source => source.capped) || items.length > limit,
  };
}

function runItem(
  run: CopilotAgentRunRecord,
  segment: IntelligenceWorkbenchTaskSegment
): IntelligenceWorkbenchTaskItem {
  return {
    id: `run:${run.workspaceId}:${run.id}`,
    entityId: run.id,
    kind: 'run',
    segment,
    attention: segment === 'todo' ? 'needs_my_action' : null,
    workspaceId: run.workspaceId,
    projectId: run.projectId ?? null,
    title: run.title,
    status: run.status,
    requestedLevel: null,
    documentId: null,
    redacted: false,
    relatedUserId: null,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
    availableActions: [],
    run,
    blocker: null,
  };
}

@Injectable()
export class IntelligenceWorkbenchTaskProjectionModel extends BaseModel {
  async listPanel(input: {
    userId: string;
    projectId?: string | null;
    now?: Date;
  }): Promise<IntelligenceWorkbenchTaskPanel> {
    const userId = normalizeOptionalId(input.userId, 'userId');
    if (!userId) throw new BadRequest('userId is required');
    const projectId = normalizeOptionalId(input.projectId, 'projectId');
    const now = input.now ?? new Date();
    const doneSince = new Date(
      now.getTime() - INTELLIGENCE_WORKBENCH_DONE_WINDOW_MS
    );

    await this.models.intelligenceWorkbenchAuthorization.expireDueAccessRequests(
      { now }
    );

    const [
      runTodo,
      runInProgress,
      runDone,
      authTodo,
      authDone,
      blockerTodo,
      blockerDone,
    ] = await Promise.all([
      this.listRunItems({
        userId,
        projectId,
        statuses: ['waiting_approval', 'waiting_for_location', 'failed'],
        segment: 'todo',
        limit: INTELLIGENCE_WORKBENCH_TODO_LIMIT,
      }),
      this.listRunItems({
        userId,
        projectId,
        statuses: ['queued', 'running'],
        segment: 'in_progress',
        limit: INTELLIGENCE_WORKBENCH_IN_PROGRESS_LIMIT,
      }),
      this.listRunItems({
        userId,
        projectId,
        statuses: ['completed', 'cancelled'],
        segment: 'done',
        completedSince: doneSince,
        limit: INTELLIGENCE_WORKBENCH_DONE_LIMIT,
      }),
      this.listAuthorizationItems({
        userId,
        projectId,
        mode: 'todo',
        now,
        limit: INTELLIGENCE_WORKBENCH_TODO_LIMIT,
      }),
      this.listAuthorizationItems({
        userId,
        projectId,
        mode: 'done',
        now,
        completedSince: doneSince,
        limit: INTELLIGENCE_WORKBENCH_DONE_LIMIT,
      }),
      this.listBlockerItems({
        userId,
        projectId,
        mode: 'todo',
        now,
        limit: INTELLIGENCE_WORKBENCH_TODO_LIMIT,
      }),
      this.listBlockerItems({
        userId,
        projectId,
        mode: 'done',
        now,
        completedSince: doneSince,
        limit: INTELLIGENCE_WORKBENCH_DONE_LIMIT,
      }),
    ]);

    return {
      todo: boundItems(
        [runTodo, authTodo, blockerTodo],
        INTELLIGENCE_WORKBENCH_TODO_LIMIT,
        panelTodoOrder
      ),
      inProgress: boundItems(
        [runInProgress],
        INTELLIGENCE_WORKBENCH_IN_PROGRESS_LIMIT,
        newestFirst
      ),
      done: boundItems(
        [runDone, authDone, blockerDone],
        INTELLIGENCE_WORKBENCH_DONE_LIMIT,
        panelDoneOrder
      ),
    };
  }

  async listAll(input: {
    userId: string;
    projectId?: string | null;
    limit?: number;
    now?: Date;
    filter?: string;
    cursor?: string | null;
    taskId?: string;
  }) {
    const userId = normalizeOptionalId(input.userId, 'userId');
    if (!userId) throw new BadRequest('userId is required');
    const projectId = normalizeOptionalId(input.projectId, 'projectId');
    const filter = input.filter ?? 'all';
    if (!WORKBENCH_TASK_FILTERS.includes(filter as HistoryFilter))
      throw new BadRequest('Invalid task filter');
    const scope = { userId, projectId, filter: filter as HistoryFilter };
    const history: HistorySelection = {
      cursor: decodeHistoryCursor(input.cursor, scope),
      filter: scope.filter,
      taskId: normalizeOptionalId(input.taskId, 'taskId'),
    };
    const limit = Math.max(
      1,
      Math.min(
        Math.trunc(input.limit ?? INTELLIGENCE_WORKBENCH_FULL_LIST_LIMIT),
        INTELLIGENCE_WORKBENCH_FULL_LIST_LIMIT
      )
    );
    const now = input.now ?? new Date();
    await this.models.intelligenceWorkbenchAuthorization.expireDueAccessRequests(
      { now }
    );
    const [runs, authorization, blockers] = await Promise.all([
      this.listRunItems({
        userId,
        projectId,
        statuses: [
          'waiting_approval',
          'waiting_for_location',
          'failed',
          'queued',
          'running',
          'completed',
          'cancelled',
        ],
        segment: null,
        limit,
        history,
      }),
      this.listAuthorizationItems({
        userId,
        projectId,
        mode: 'all',
        now,
        limit,
        history,
      }),
      this.listBlockerItems({
        userId,
        projectId,
        mode: 'all',
        now,
        limit,
        history,
      }),
    ]);
    const items = [...runs.items, ...authorization.items, ...blockers.items]
      .sort(historyOrder)
      .slice(0, limit);
    const capped =
      runs.capped ||
      authorization.capped ||
      blockers.capped ||
      runs.items.length + authorization.items.length + blockers.items.length >
        limit;
    const last = items.at(-1);
    return {
      items,
      capped,
      nextCursor:
        capped && last
          ? Buffer.from(
              JSON.stringify({
                ...scope,
                updatedAt: last.updatedAt.toISOString(),
                kind: last.kind,
                entityId: last.entityId,
              } satisfies HistoryCursor)
            ).toString('base64url')
          : null,
    };
  }

  private async queryCandidates<T>(
    query: Prisma.Sql,
    kind: IntelligenceWorkbenchTaskItemKind,
    limit: number,
    history?: HistorySelection
  ): Promise<T[]> {
    if (!history)
      return this.db.$queryRaw<T[]>(Prisma.sql`${query} LIMIT ${limit + 1}`);
    const { cursor, filter, taskId } = history;
    const prefixes = {
      run: 'run:',
      access_request: 'access-request:',
      project_invitation: 'project-invitation:',
      project_grant: 'project-grant:',
      blocker: 'blocker:',
    };
    let identity = Prisma.sql`TRUE`;
    if (taskId) {
      if (!taskId.startsWith(prefixes[kind])) return [];
      const entityId = taskId.slice(prefixes[kind].length);
      if (kind === 'run') {
        const separator = entityId.indexOf(':');
        if (separator < 1) return [];
        identity = Prisma.sql`"workspaceId" = ${entityId.slice(0, separator)} AND id = ${entityId.slice(separator + 1)}`;
      } else {
        identity = Prisma.sql`id = ${entityId}`;
      }
    }
    const rerequest = Prisma.sql`status = 'revoked' AND "projectStatus" = 'active' AND "projectMember" AND "latestRevokedGrant" AND "hasRevokedPlaceholder" AND NOT "hasPendingRequest" AND NOT "hasActiveReplacement"`;
    const filterSql =
      filter === 'all'
        ? Prisma.sql`TRUE`
        : kind === 'run'
          ? Prisma.sql`status IN (${Prisma.join(filter === 'active' ? ['queued', 'running'] : filter === 'approval' ? ['waiting_approval', 'waiting_for_location', 'failed'] : ['completed', 'cancelled'])})`
          : filter === 'active'
            ? Prisma.sql`FALSE`
            : kind === 'project_grant'
              ? filter === 'approval'
                ? Prisma.sql`(${rerequest})`
                : Prisma.sql`NOT (${rerequest})`
              : filter === 'completed'
                ? Prisma.sql`status <> ${kind === 'blocker' ? 'waiting' : 'pending'}`
                : kind === 'access_request'
                  ? Prisma.sql`status = 'pending' AND "sourceDecisionActor"`
                  : kind === 'project_invitation'
                    ? Prisma.sql`status = 'pending' AND invitee`
                    : Prisma.sql`FALSE`;
    let seek = Prisma.sql`TRUE`;
    if (cursor) {
      const sameTime =
        kind === cursor.kind
          ? Prisma.sql`id COLLATE "C" < ${cursor.entityId}`
          : Prisma.sql`${HISTORY_KINDS.indexOf(kind) > HISTORY_KINDS.indexOf(cursor.kind)}`;
      seek = Prisma.sql`("updatedAt" < ${new Date(cursor.updatedAt)} OR ("updatedAt" = ${new Date(cursor.updatedAt)} AND ${sameTime}))`;
    }
    return this.db.$queryRaw<T[]>(Prisma.sql`
      SELECT * FROM (${query}) candidates
      WHERE ${filterSql} AND ${seek}
        AND ${identity}
      ORDER BY "updatedAt" DESC, id COLLATE "C" DESC
      LIMIT ${limit + 1}
    `);
  }

  private async listRunItems(input: {
    userId: string;
    projectId: string | null;
    statuses: string[];
    segment: IntelligenceWorkbenchTaskSegment | null;
    completedSince?: Date;
    limit: number;
    history?: HistorySelection;
  }): Promise<BoundedItems> {
    const completedSince = input.completedSince
      ? Prisma.sql`AND run.completed_at >= ${input.completedSince}`
      : Prisma.empty;
    const rows = await this.queryCandidates<RunCandidateRow>(
      Prisma.sql`
      SELECT
        run.id,
        run.status,
        run.updated_at AS "updatedAt",
        run.workspace_id AS "workspaceId"
      FROM ai_agent_runs run
      JOIN workspace_members workspace_member
        ON workspace_member.workspace_id = run.workspace_id
       AND workspace_member.user_id = ${input.userId}
       AND workspace_member.state = 'active'
      LEFT JOIN ai_sessions_metadata session
        ON session.id = run.session_id
       AND session.user_id = run.actor_id
       AND session.workspace_id = run.workspace_id
      WHERE run.actor_id = ${input.userId}
        AND run.source_type <> 'repair_execution_request'
        AND run.status IN (${Prisma.join(input.statuses)})
        AND (
          ${input.projectId}::varchar IS NULL
          OR (
            session.selected_context_project_id = ${input.projectId}
            AND EXISTS (
              SELECT 1
              FROM ai_context_projects project
              JOIN ai_context_project_members project_member
                ON project_member.project_id = project.id
               AND project_member.user_id = ${input.userId}
              WHERE project.id = ${input.projectId}
                AND project.status = 'active'
            )
          )
        )
        ${completedSince}
      ORDER BY run.updated_at DESC, run.id DESC
    `,
      'run',
      input.limit,
      input.history
    );
    const runs = await Promise.all(
      rows
        .slice(0, input.limit)
        .map(row =>
          this.models.copilotAgentRuntime.get(row.workspaceId, row.id)
        )
    );
    return {
      items: runs.flatMap(run => {
        if (!run) return [];
        const segment =
          input.segment ??
          (run.status === 'queued' || run.status === 'running'
            ? 'in_progress'
            : run.status === 'waiting_approval' ||
                run.status === 'waiting_for_location' ||
                run.status === 'failed'
              ? 'todo'
              : 'done');
        return [runItem(run, segment)];
      }),
      capped: rows.length > input.limit,
    };
  }

  private async listAuthorizationItems(input: {
    userId: string;
    projectId: string | null;
    mode: 'todo' | 'done' | 'all';
    now: Date;
    completedSince?: Date;
    limit: number;
    history?: HistorySelection;
  }): Promise<BoundedItems> {
    const [requests, invitations, grants] = await Promise.all([
      this.listAccessRequestItems(input),
      this.listProjectInvitationItems(input),
      this.listProjectGrantItems(input),
    ]);
    const compare = input.history
      ? historyOrder
      : input.mode === 'todo'
        ? panelTodoOrder
        : panelDoneOrder;
    const combined = [requests, invitations, grants]
      .flatMap(source => source.items)
      .sort(compare);
    return {
      items: combined.slice(0, input.limit),
      capped:
        [requests, invitations, grants].some(source => source.capped) ||
        combined.length > input.limit,
    };
  }

  private async listAccessRequestItems(input: {
    userId: string;
    projectId: string | null;
    mode: 'todo' | 'done' | 'all';
    now: Date;
    completedSince?: Date;
    limit: number;
    history?: HistorySelection;
  }): Promise<BoundedItems> {
    const lifecycle =
      input.mode === 'todo'
        ? Prisma.sql`
            AND request.status = 'pending'
            AND (request.expires_at IS NULL OR request.expires_at > ${input.now})
          `
        : input.mode === 'done'
          ? Prisma.sql`
              AND request.status <> 'pending'
              AND request.resolved_at >= ${input.completedSince as Date}
            `
          : Prisma.empty;
    const canonicalGrantFilter =
      input.mode === 'todo'
        ? Prisma.empty
        : Prisma.sql`
            AND NOT (
              request.beneficiary_type = 'project'
              AND request.status = 'approved'
              AND EXISTS (
                SELECT 1
                FROM ai_context_project_grants project_grant
                WHERE project_grant.access_request_id = request.id
              )
            )
          `;
    const ordering =
      input.mode === 'todo'
        ? Prisma.sql`"sourceDecisionActor" DESC, request.updated_at DESC, request.id DESC`
        : Prisma.sql`request.updated_at DESC, request.id DESC`;
    const rows = await this.queryCandidates<AccessRequestCandidateRow>(
      Prisma.sql`
        WITH visible_request_ids AS (
          SELECT request.id
          FROM access_requests request
          WHERE request.requester_user_id = ${input.userId}
          ${lifecycle}

          UNION

          SELECT request.id
          FROM access_requests request
          WHERE request.beneficiary_type = 'user'
            AND request.beneficiary_user_id = ${input.userId}
          ${lifecycle}

          UNION

          SELECT request.id
          FROM ai_context_project_members project_member
          JOIN access_requests request
            ON request.beneficiary_type = 'project'
           AND request.beneficiary_project_id = project_member.project_id
          WHERE project_member.user_id = ${input.userId}
          ${lifecycle}

          UNION

          SELECT request.id
          FROM workspace_members workspace_member
          JOIN access_requests request
            ON request.workspace_id = workspace_member.workspace_id
          WHERE workspace_member.user_id = ${input.userId}
            AND workspace_member.state = 'active'
            AND workspace_member.role IN ('owner', 'admin')
          ${lifecycle}

          UNION

          SELECT request.id
          FROM doc_grants doc_grant
          JOIN access_requests request
            ON request.workspace_id = doc_grant.workspace_id
           AND request.doc_id = doc_grant.doc_id
          WHERE doc_grant.principal_type = 'user'
            AND doc_grant.principal_id = ${input.userId}
            AND doc_grant.role = 'owner'
          ${lifecycle}
        )
        SELECT
          request.id,
          request.workspace_id AS "workspaceId",
          request.doc_id AS "docId",
          request.beneficiary_type AS "beneficiaryType",
          request.beneficiary_user_id AS "beneficiaryUserId",
          request.beneficiary_project_id AS "beneficiaryProjectId",
          request.requester_user_id_snapshot AS "requesterUserIdSnapshot",
          request.requester_supplied_identity AS "requesterSuppliedIdentity",
          request.requested_level AS "requestedLevel",
          request.requested_title AS "requestedTitle",
          request.status,
          request.resolved_at AS "resolvedAt",
          request.created_at AS "createdAt",
          request.updated_at AS "updatedAt",
          (
            EXISTS (
              SELECT 1
              FROM workspace_members workspace_member
              WHERE workspace_member.workspace_id = request.workspace_id
                AND workspace_member.user_id = ${input.userId}
                AND workspace_member.state = 'active'
                AND workspace_member.role IN ('owner', 'admin')
            ) OR EXISTS (
              SELECT 1
              FROM doc_grants doc_grant
              WHERE doc_grant.workspace_id = request.workspace_id
                AND doc_grant.doc_id = request.doc_id
                AND doc_grant.principal_type = 'user'
                AND doc_grant.principal_id = ${input.userId}
                AND doc_grant.role = 'owner'
            )
          ) AS "sourceDecisionActor",
          EXISTS (
            SELECT 1
            FROM ai_context_project_members project_member
            WHERE project_member.project_id = request.beneficiary_project_id
              AND project_member.user_id = ${input.userId}
          ) AS "projectMember",
          EXISTS (
            SELECT 1
            FROM ai_context_project_members project_member
            WHERE project_member.project_id = request.beneficiary_project_id
              AND project_member.user_id = ${input.userId}
              AND project_member.role = 'owner'
          ) AS "projectOwner",
          EXISTS (
            SELECT 1
            FROM ai_context_project_grants project_grant
            WHERE project_grant.access_request_id = request.id
              AND project_grant.status = 'active'
          ) AS "activeProjectGrant"
        FROM visible_request_ids visible
        JOIN access_requests request ON request.id = visible.id
        WHERE TRUE
        ${canonicalGrantFilter}
        AND (
          ${input.projectId}::varchar IS NULL
          OR (
            request.beneficiary_type = 'project'
            AND request.beneficiary_project_id = ${input.projectId}
            AND EXISTS (
              SELECT 1
              FROM ai_context_projects project
              JOIN ai_context_project_members project_member
                ON project_member.project_id = project.id
               AND project_member.user_id = ${input.userId}
              WHERE project.id = ${input.projectId}
                AND project.status = 'active'
            )
          )
        )
        ORDER BY ${ordering}
      `,
      'access_request',
      input.limit,
      input.history
    );
    return {
      items: rows.slice(0, input.limit).map(row => {
        const sourceDecisionActor = row.sourceDecisionActor;
        const canWithdraw =
          row.requesterUserIdSnapshot === input.userId ||
          row.beneficiaryUserId === input.userId ||
          row.projectOwner;
        const visibleIdentity =
          sourceDecisionActor ||
          (row.requesterSuppliedIdentity &&
            row.requesterUserIdSnapshot === input.userId) ||
          row.beneficiaryUserId === input.userId ||
          (row.projectMember && row.activeProjectGrant);
        const pending = row.status === 'pending';
        const actions: IntelligenceWorkbenchTaskAction[] = [];
        if (pending && sourceDecisionActor) {
          actions.push('approve_access_request', 'reject_access_request');
        }
        if (pending && canWithdraw) actions.push('withdraw_access_request');
        return {
          id: `access-request:${row.id}`,
          entityId: row.id,
          kind: 'access_request' as const,
          segment: pending ? ('todo' as const) : ('done' as const),
          attention: pending
            ? sourceDecisionActor
              ? ('needs_my_action' as const)
              : ('waiting_on_others' as const)
            : null,
          workspaceId: row.workspaceId,
          projectId: row.beneficiaryProjectId,
          title: visibleIdentity ? row.requestedTitle : null,
          status: row.status,
          requestedLevel: row.requestedLevel,
          documentId: visibleIdentity ? row.docId : null,
          redacted: !visibleIdentity,
          relatedUserId: row.requesterUserIdSnapshot,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          completedAt: row.resolvedAt,
          availableActions: actions,
          run: null,
          blocker: null,
        } satisfies IntelligenceWorkbenchTaskItem;
      }),
      capped: rows.length > input.limit,
    };
  }

  private async listProjectInvitationItems(input: {
    userId: string;
    projectId: string | null;
    mode: 'todo' | 'done' | 'all';
    completedSince?: Date;
    limit: number;
    history?: HistorySelection;
  }): Promise<BoundedItems> {
    const lifecycle =
      input.mode === 'todo'
        ? Prisma.sql`AND invitation.status = 'pending'`
        : input.mode === 'done'
          ? Prisma.sql`
              AND invitation.status <> 'pending'
              AND invitation.updated_at >= ${input.completedSince as Date}
            `
          : Prisma.empty;
    const ordering =
      input.mode === 'todo'
        ? Prisma.sql`invitee DESC, invitation.updated_at DESC, invitation.id DESC`
        : Prisma.sql`invitation.updated_at DESC, invitation.id DESC`;
    const rows = await this.queryCandidates<ProjectInvitationCandidateRow>(
      Prisma.sql`
        WITH visible_invitation_ids AS (
          SELECT invitation.id
          FROM ai_context_project_invitations invitation
          WHERE invitation.invitee_user_id = ${input.userId}
          ${lifecycle}

          UNION

          SELECT invitation.id
          FROM ai_context_project_invitations invitation
          WHERE invitation.inviter_user_id = ${input.userId}
          ${lifecycle}

          UNION

          SELECT invitation.id
          FROM ai_context_project_members project_member
          JOIN ai_context_project_invitations invitation
            ON invitation.project_id = project_member.project_id
          WHERE project_member.user_id = ${input.userId}
            AND (
              project_member.role = 'owner'
              OR invitation.status = 'accepted'
            )
          ${lifecycle}
        )
        SELECT
          invitation.id,
          invitation.project_id AS "projectId",
          project.name AS "projectName",
          invitation.invitee_user_id AS "inviteeUserId",
          invitation.inviter_user_id_snapshot AS "inviterUserIdSnapshot",
          invitation.status,
          invitation.accepted_at AS "acceptedAt",
          invitation.declined_at AS "declinedAt",
          invitation.withdrawn_at AS "withdrawnAt",
          invitation.created_at AS "createdAt",
          invitation.updated_at AS "updatedAt",
          invitation.invitee_user_id = ${input.userId} AS invitee,
          invitation.inviter_user_id_snapshot = ${input.userId} AS inviter,
          EXISTS (
            SELECT 1
            FROM ai_context_project_members project_member
            WHERE project_member.project_id = invitation.project_id
              AND project_member.user_id = ${input.userId}
              AND project_member.role = 'owner'
          ) AS "projectOwner"
        FROM visible_invitation_ids visible
        JOIN ai_context_project_invitations invitation ON invitation.id = visible.id
        JOIN ai_context_projects project ON project.id = invitation.project_id
        WHERE (
          ${input.projectId}::varchar IS NULL
          OR (
            invitation.project_id = ${input.projectId}
            AND project.status = 'active'
            AND EXISTS (
              SELECT 1
              FROM ai_context_project_members project_member
              WHERE project_member.project_id = project.id
                AND project_member.user_id = ${input.userId}
            )
          )
        )
        ORDER BY ${ordering}
      `,
      'project_invitation',
      input.limit,
      input.history
    );
    return {
      items: rows.slice(0, input.limit).map(row => {
        const pending = row.status === 'pending';
        const actions: IntelligenceWorkbenchTaskAction[] = [];
        if (pending && row.invitee) {
          actions.push(
            'accept_project_invitation',
            'decline_project_invitation'
          );
        } else if (pending && (row.inviter || row.projectOwner)) {
          actions.push('withdraw_project_invitation');
        }
        return {
          id: `project-invitation:${row.id}`,
          entityId: row.id,
          kind: 'project_invitation' as const,
          segment: pending ? ('todo' as const) : ('done' as const),
          attention: pending
            ? row.invitee
              ? ('needs_my_action' as const)
              : ('waiting_on_others' as const)
            : null,
          workspaceId: null,
          projectId: row.projectId,
          title: row.projectName,
          status: row.status,
          requestedLevel: null,
          documentId: null,
          redacted: false,
          relatedUserId: row.inviteeUserId,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          completedAt:
            row.acceptedAt ?? row.declinedAt ?? row.withdrawnAt ?? null,
          availableActions: actions,
          run: null,
          blocker: null,
        } satisfies IntelligenceWorkbenchTaskItem;
      }),
      capped: rows.length > input.limit,
    };
  }

  private async listProjectGrantItems(input: {
    userId: string;
    projectId: string | null;
    mode: 'todo' | 'done' | 'all';
    completedSince?: Date;
    limit: number;
    history?: HistorySelection;
  }): Promise<BoundedItems> {
    const latestRevokedGrant = Prisma.sql`
      NOT EXISTS (
        SELECT 1
        FROM ai_context_project_grants newer_revoked_grant
        WHERE newer_revoked_grant.project_id = grant_row.project_id
          AND newer_revoked_grant.workspace_id = grant_row.workspace_id
          AND newer_revoked_grant.doc_id = grant_row.doc_id
          AND newer_revoked_grant.status = 'revoked'
          AND (
            newer_revoked_grant.revoked_at > grant_row.revoked_at
            OR (
              newer_revoked_grant.revoked_at = grant_row.revoked_at
              AND newer_revoked_grant.granted_at > grant_row.granted_at
            )
            OR (
              newer_revoked_grant.revoked_at = grant_row.revoked_at
              AND newer_revoked_grant.granted_at = grant_row.granted_at
              AND newer_revoked_grant.id > grant_row.id
            )
          )
      )
    `;
    const lifecycle =
      input.mode === 'todo'
        ? Prisma.sql`AND grant_row.status = 'revoked'`
        : input.mode === 'done'
          ? Prisma.sql`
              AND (
                (grant_row.status = 'active' AND grant_row.granted_at >= ${input.completedSince as Date})
                OR (grant_row.status = 'revoked' AND grant_row.revoked_at >= ${input.completedSince as Date})
              )
            `
          : Prisma.empty;
    const actionability =
      input.mode === 'todo'
        ? Prisma.sql`
            AND project.status = 'active'
            AND ${latestRevokedGrant}
            AND EXISTS (
              SELECT 1
              FROM ai_context_project_members project_member
              WHERE project_member.project_id = grant_row.project_id
                AND project_member.user_id = ${input.userId}
            )
            AND EXISTS (
              SELECT 1
              FROM ai_context_project_docs project_document
              WHERE project_document.project_id = grant_row.project_id
                AND project_document.workspace_id = grant_row.workspace_id
                AND project_document.doc_id = grant_row.doc_id
                AND project_document.status = 'revoked'
            )
            AND NOT EXISTS (
              SELECT 1
              FROM access_requests request
              WHERE request.beneficiary_type = 'project'
                AND request.beneficiary_project_id = grant_row.project_id
                AND request.workspace_id = grant_row.workspace_id
                AND request.doc_id = grant_row.doc_id
                AND request.status = 'pending'
            )
            AND NOT EXISTS (
              SELECT 1
              FROM ai_context_project_grants active_grant
              WHERE active_grant.project_id = grant_row.project_id
                AND active_grant.workspace_id = grant_row.workspace_id
                AND active_grant.doc_id = grant_row.doc_id
                AND active_grant.status = 'active'
                AND active_grant.id <> grant_row.id
            )
          `
        : input.mode === 'done'
          ? Prisma.sql`
              AND NOT (
                grant_row.status = 'revoked'
                AND ${latestRevokedGrant}
                AND project.status = 'active'
                AND EXISTS (
                  SELECT 1
                  FROM ai_context_project_members project_member
                  WHERE project_member.project_id = grant_row.project_id
                    AND project_member.user_id = ${input.userId}
                )
                AND EXISTS (
                  SELECT 1
                  FROM ai_context_project_docs project_document
                  WHERE project_document.project_id = grant_row.project_id
                    AND project_document.workspace_id = grant_row.workspace_id
                    AND project_document.doc_id = grant_row.doc_id
                    AND project_document.status = 'revoked'
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM access_requests request
                  WHERE request.beneficiary_type = 'project'
                    AND request.beneficiary_project_id = grant_row.project_id
                    AND request.workspace_id = grant_row.workspace_id
                    AND request.doc_id = grant_row.doc_id
                    AND request.status = 'pending'
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM ai_context_project_grants active_grant
                  WHERE active_grant.project_id = grant_row.project_id
                    AND active_grant.workspace_id = grant_row.workspace_id
                    AND active_grant.doc_id = grant_row.doc_id
                    AND active_grant.status = 'active'
                    AND active_grant.id <> grant_row.id
                )
              )
            `
          : Prisma.empty;
    const rows = await this.queryCandidates<ProjectGrantCandidateRow>(
      Prisma.sql`
      WITH visible_grant_ids AS (
        SELECT grant_row.id
        FROM ai_context_project_members project_member
        JOIN ai_context_project_grants grant_row
          ON grant_row.project_id = project_member.project_id
        WHERE project_member.user_id = ${input.userId}
        ${lifecycle}

        UNION

        SELECT grant_row.id
        FROM workspace_members workspace_member
        JOIN ai_context_project_grants grant_row
          ON grant_row.workspace_id = workspace_member.workspace_id
        WHERE workspace_member.user_id = ${input.userId}
          AND workspace_member.state = 'active'
          AND workspace_member.role IN ('owner', 'admin')
        ${lifecycle}

        UNION

        SELECT grant_row.id
        FROM doc_grants doc_grant
        JOIN ai_context_project_grants grant_row
          ON grant_row.workspace_id = doc_grant.workspace_id
         AND grant_row.doc_id = doc_grant.doc_id
        WHERE doc_grant.principal_type = 'user'
          AND doc_grant.principal_id = ${input.userId}
          AND doc_grant.role = 'owner'
        ${lifecycle}
      )
      SELECT
        grant_row.id,
        grant_row.project_id AS "projectId",
        project.name AS "projectName",
        project.status AS "projectStatus",
        grant_row.workspace_id AS "workspaceId",
        grant_row.doc_id AS "docId",
        grant_row.level,
        grant_row.status,
        grant_row.granted_at AS "grantedAt",
        grant_row.revoked_at AS "revokedAt",
        grant_row.updated_at AS "updatedAt",
        EXISTS (
          SELECT 1
          FROM ai_context_project_members project_member
          WHERE project_member.project_id = grant_row.project_id
            AND project_member.user_id = ${input.userId}
        ) AS "projectMember",
        (
          EXISTS (
            SELECT 1
            FROM workspace_members workspace_member
            WHERE workspace_member.workspace_id = grant_row.workspace_id
              AND workspace_member.user_id = ${input.userId}
              AND workspace_member.state = 'active'
              AND workspace_member.role IN ('owner', 'admin')
          ) OR EXISTS (
            SELECT 1
            FROM doc_grants doc_grant
            WHERE doc_grant.workspace_id = grant_row.workspace_id
              AND doc_grant.doc_id = grant_row.doc_id
              AND doc_grant.principal_type = 'user'
              AND doc_grant.principal_id = ${input.userId}
              AND doc_grant.role = 'owner'
          )
        ) AS "sourceManager",
        EXISTS (
          SELECT 1
          FROM ai_context_project_docs project_document
          WHERE project_document.project_id = grant_row.project_id
            AND project_document.workspace_id = grant_row.workspace_id
            AND project_document.doc_id = grant_row.doc_id
            AND project_document.status = 'revoked'
        ) AS "hasRevokedPlaceholder",
        EXISTS (
          SELECT 1
          FROM access_requests request
          WHERE request.beneficiary_type = 'project'
            AND request.beneficiary_project_id = grant_row.project_id
            AND request.workspace_id = grant_row.workspace_id
            AND request.doc_id = grant_row.doc_id
            AND request.status = 'pending'
        ) AS "hasPendingRequest",
        EXISTS (
          SELECT 1
          FROM ai_context_project_grants active_grant
          WHERE active_grant.project_id = grant_row.project_id
            AND active_grant.workspace_id = grant_row.workspace_id
            AND active_grant.doc_id = grant_row.doc_id
            AND active_grant.status = 'active'
            AND active_grant.id <> grant_row.id
          ) AS "hasActiveReplacement",
          ${latestRevokedGrant} AS "latestRevokedGrant"
      FROM visible_grant_ids visible
      JOIN ai_context_project_grants grant_row ON grant_row.id = visible.id
      JOIN ai_context_projects project ON project.id = grant_row.project_id
      WHERE (
        ${input.projectId}::varchar IS NULL
        OR (
          grant_row.project_id = ${input.projectId}
          AND project.status = 'active'
          AND EXISTS (
            SELECT 1
            FROM ai_context_project_members project_member
            WHERE project_member.project_id = project.id
              AND project_member.user_id = ${input.userId}
          )
        )
      )
      ${actionability}
      ORDER BY grant_row.updated_at DESC, grant_row.id DESC
    `,
      'project_grant',
      input.limit,
      input.history
    );
    const items = rows.flatMap(row => {
      const needsRerequest =
        row.status === 'revoked' &&
        row.projectStatus === 'active' &&
        row.projectMember &&
        row.latestRevokedGrant &&
        row.hasRevokedPlaceholder &&
        !row.hasPendingRequest &&
        !row.hasActiveReplacement;
      const segment = needsRerequest ? ('todo' as const) : ('done' as const);
      return [
        {
          id: `project-grant:${row.id}`,
          entityId: row.id,
          kind: 'project_grant' as const,
          segment,
          attention: needsRerequest ? ('needs_my_action' as const) : null,
          workspaceId: row.workspaceId,
          projectId: row.projectId,
          title: row.projectName,
          status: row.status,
          requestedLevel: row.level,
          documentId:
            row.status === 'active' || row.sourceManager ? row.docId : null,
          redacted: row.status !== 'active' && !row.sourceManager,
          relatedUserId: null,
          createdAt: row.grantedAt,
          updatedAt: row.updatedAt,
          completedAt: needsRerequest ? null : (row.revokedAt ?? row.grantedAt),
          availableActions: needsRerequest
            ? (['request_project_access'] as const)
            : [],
          run: null,
          blocker: null,
        } satisfies IntelligenceWorkbenchTaskItem,
      ];
    });
    return {
      items: items.slice(0, input.limit),
      capped: rows.length > input.limit || items.length > input.limit,
    };
  }

  private async listBlockerItems(input: {
    userId: string;
    projectId: string | null;
    mode: 'todo' | 'done' | 'all';
    now: Date;
    completedSince?: Date;
    limit: number;
    history?: HistorySelection;
  }): Promise<BoundedItems> {
    const lifecycle =
      input.mode === 'todo'
        ? Prisma.sql`AND blocker.status = 'waiting'`
        : input.mode === 'done'
          ? Prisma.sql`
              AND blocker.status IN ('resolved', 'abandoned')
              AND blocker.resolved_at >= ${input.completedSince as Date}
            `
          : Prisma.empty;
    const ordering =
      input.mode === 'todo'
        ? Prisma.sql`
            CASE
              WHEN blocker.due_at IS NOT NULL AND blocker.due_at < ${input.now}
                THEN 0
              ELSE 1
            END,
            blocker.due_at ASC NULLS LAST,
            blocker.updated_at DESC,
            blocker.id DESC
          `
        : input.mode === 'done'
          ? Prisma.sql`blocker.resolved_at DESC, blocker.id DESC`
          : Prisma.sql`blocker.updated_at DESC, blocker.id DESC`;
    const rows = await this.queryCandidates<BlockerCandidateRow>(
      Prisma.sql`
      SELECT
        blocker.id,
        blocker.project_id AS "projectId",
        blocker.creator_user_id_snapshot AS "creatorUserIdSnapshot",
        blocker.title,
        blocker.type,
        blocker.waiting_on AS "waitingOn",
        blocker.due_at AS "dueAt",
        blocker.status,
        blocker.origin,
        blocker.resolution_actor_user_id_snapshot AS "resolutionActorUserIdSnapshot",
        blocker.resolved_at AS "resolvedAt",
        blocker.created_at AS "createdAt",
        blocker.updated_at AS "updatedAt",
        (
          blocker.status = 'waiting' AND
          blocker.due_at IS NOT NULL AND
          blocker.due_at < ${input.now}
        ) AS overdue
      FROM ai_context_project_members project_member
      JOIN ai_context_projects project
        ON project.id = project_member.project_id
       AND project.status = 'active'
      JOIN ai_context_project_blockers blocker
        ON blocker.project_id = project.id
      WHERE project_member.user_id = ${input.userId}
        AND (
          ${input.projectId}::varchar IS NULL OR
          blocker.project_id = ${input.projectId}
        )
        ${lifecycle}
      ORDER BY ${ordering}
    `,
      'blocker',
      input.limit,
      input.history
    );
    return {
      items: rows.slice(0, input.limit).map(row => {
        const waiting = row.status === 'waiting';
        return {
          id: `blocker:${row.id}`,
          entityId: row.id,
          kind: 'blocker' as const,
          segment: waiting ? ('todo' as const) : ('done' as const),
          attention: waiting ? ('waiting_on_others' as const) : null,
          workspaceId: null,
          projectId: row.projectId,
          title: row.title,
          status: row.status,
          requestedLevel: null,
          documentId: null,
          redacted: false,
          relatedUserId: row.creatorUserIdSnapshot,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          completedAt: row.resolvedAt,
          availableActions: waiting
            ? (['resolve_blocker', 'abandon_blocker'] as const)
            : [],
          run: null,
          blocker: {
            creatorUserId: row.creatorUserIdSnapshot,
            type: row.type as IntelligenceWorkbenchBlockerType,
            waitingOn: row.waitingOn,
            dueAt: row.dueAt,
            overdue: row.overdue,
            origin: row.origin as IntelligenceWorkbenchBlockerOrigin,
            resolutionActorUserId: row.resolutionActorUserIdSnapshot,
          },
        } satisfies IntelligenceWorkbenchTaskItem;
      }),
      capped: rows.length > input.limit,
    };
  }
}
