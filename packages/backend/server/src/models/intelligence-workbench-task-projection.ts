import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { BadRequest } from '../base';
import { BaseModel } from './base';
import type { CopilotAgentRunRecord } from './copilot-agent-runtime';
import type { ProjectAgentRun } from './copilot-project-agent-runtime';
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
  | 'project_run'
  | 'access_request'
  | 'project_invitation'
  | 'blocker'
  | 'file_request';
// File requests have their own delivery lifecycle, independent of reminder-only Blockers.

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
  projectTask?: ProjectAgentRun | null;
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
  'project_run',
  'access_request',
  'project_invitation',
  'blocker',
  'file_request',
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
      fileTodo,
      fileInProgress,
      fileDone,
      projectTodo,
      projectInProgress,
      projectDone,
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
      this.listFileRequestItems({
        userId,
        projectId,
        statuses: ['pending'],
        limit: INTELLIGENCE_WORKBENCH_TODO_LIMIT,
      }),
      this.listFileRequestItems({
        userId,
        projectId,
        statuses: ['in_progress'],
        limit: INTELLIGENCE_WORKBENCH_IN_PROGRESS_LIMIT,
      }),
      this.listFileRequestItems({
        userId,
        projectId,
        statuses: ['completed', 'declined', 'cancelled'],
        completedSince: doneSince,
        limit: INTELLIGENCE_WORKBENCH_DONE_LIMIT,
      }),
      this.listProjectRunItems({
        userId,
        projectId,
        statuses: [
          'waiting_approval',
          'waiting_for_location',
          'waiting_lease',
          'failed',
        ],
        limit: INTELLIGENCE_WORKBENCH_TODO_LIMIT,
      }),
      this.listProjectRunItems({
        userId,
        projectId,
        statuses: ['queued', 'running'],
        limit: INTELLIGENCE_WORKBENCH_IN_PROGRESS_LIMIT,
      }),
      this.listProjectRunItems({
        userId,
        projectId,
        statuses: ['completed', 'cancelled'],
        completedSince: doneSince,
        limit: INTELLIGENCE_WORKBENCH_DONE_LIMIT,
      }),
    ]);

    return {
      todo: boundItems(
        [runTodo, authTodo, blockerTodo, fileTodo, projectTodo],
        INTELLIGENCE_WORKBENCH_TODO_LIMIT,
        panelTodoOrder
      ),
      inProgress: boundItems(
        [runInProgress, fileInProgress, projectInProgress],
        INTELLIGENCE_WORKBENCH_IN_PROGRESS_LIMIT,
        newestFirst
      ),
      done: boundItems(
        [runDone, authDone, blockerDone, fileDone, projectDone],
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
    const [runs, authorization, blockers, files, projectRuns] =
      await Promise.all([
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
        this.listFileRequestItems({ userId, projectId, limit, history }),
        this.listProjectRunItems({ userId, projectId, limit, history }),
      ]);
    const items = [
      ...runs.items,
      ...authorization.items,
      ...blockers.items,
      ...files.items,
      ...projectRuns.items,
    ]
      .sort(historyOrder)
      .slice(0, limit);
    const capped =
      runs.capped ||
      authorization.capped ||
      blockers.capped ||
      files.capped ||
      projectRuns.capped ||
      runs.items.length +
        authorization.items.length +
        blockers.items.length +
        files.items.length >
        limit - projectRuns.items.length;
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
      project_run: 'project-run:',
      access_request: 'access-request:',
      project_invitation: 'project-invitation:',
      blocker: 'blocker:',
      file_request: 'file-request:',
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
    const filterSql =
      filter === 'all'
        ? Prisma.sql`TRUE`
        : kind === 'file_request'
          ? Prisma.sql`status IN (${Prisma.join(filter === 'active' ? ['in_progress'] : filter === 'approval' ? ['pending'] : ['completed', 'declined', 'cancelled'])})`
          : kind === 'run' || kind === 'project_run'
            ? Prisma.sql`status IN (${Prisma.join(filter === 'active' ? ['queued', 'running'] : filter === 'approval' ? ['waiting_approval', 'waiting_for_location', 'waiting_lease', 'failed'] : ['completed', 'cancelled'])})`
            : filter === 'active'
              ? Prisma.sql`FALSE`
              : filter === 'completed'
                ? Prisma.sql`status <> ${kind === 'blocker' ? 'waiting' : 'pending'}`
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

  private async listProjectRunItems(input: {
    userId: string;
    projectId: string | null;
    limit: number;
    statuses?: string[];
    completedSince?: Date;
    history?: HistorySelection;
  }): Promise<BoundedItems> {
    const rows = await this.queryCandidates<{ id: string; projectId: string }>(
      Prisma.sql`
      SELECT run.id, run.project_id AS "projectId", run.status, run.updated_at AS "updatedAt"
      FROM ai_agent_runs run
      JOIN ai_context_projects project ON project.id = run.project_id AND project.status = 'active'
      JOIN ai_context_project_members member ON member.project_id = project.id AND member.user_id = ${input.userId}
      WHERE run.workspace_id IS NULL AND run.actor_id = ${input.userId}
        AND NOT (run.workflow = 'agent_runtime_project_workspace_import' AND run.status = 'waiting_approval')
        ${input.projectId ? Prisma.sql`AND run.project_id = ${input.projectId}` : Prisma.empty}
        ${input.statuses ? Prisma.sql`AND run.status IN (${Prisma.join(input.statuses)})` : Prisma.empty}
        ${input.completedSince ? Prisma.sql`AND run.completed_at >= ${input.completedSince}` : Prisma.empty}
      ORDER BY run.updated_at DESC, run.id DESC
    `,
      'project_run',
      input.limit,
      input.history
    );
    const items: IntelligenceWorkbenchTaskItem[] = [];
    for (const row of rows.slice(0, input.limit)) {
      const run = await this.models.copilotProjectAgentRuntime.get({
        projectId: row.projectId,
        actorId: input.userId,
        runId: row.id,
      });
      const segment = ['queued', 'running'].includes(run.status)
        ? 'in_progress'
        : ['completed', 'cancelled'].includes(run.status)
          ? 'done'
          : 'todo';
      const approval =
        run.status === 'waiting_approval' &&
        run.workflow !== 'agent_runtime_project_publication' &&
        run.workflow !== 'agent_runtime_project_workspace_import';
      items.push({
        id: `project-run:${run.id}`,
        entityId: run.id,
        kind: 'project_run',
        segment,
        attention:
          segment === 'todo'
            ? run.status === 'waiting_lease'
              ? 'waiting_on_others'
              : 'needs_my_action'
            : null,
        workspaceId: null,
        projectId: run.projectId,
        title: run.title,
        status: run.status,
        requestedLevel: null,
        documentId: run.waitingLeaseResourceId,
        redacted: false,
        relatedUserId: null,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        completedAt: run.completedAt,
        availableActions:
          segment === 'done' || run.status === 'failed'
            ? []
            : approval
              ? ['approve', 'reject', 'cancel']
              : ['cancel'],
        run: null,
        projectTask: run,
        blocker: null,
      });
    }
    return { items, capped: rows.length > input.limit };
  }

  private async listFileRequestItems(input: {
    userId: string;
    projectId: string | null;
    statuses?: string[];
    completedSince?: Date;
    limit: number;
    history?: HistorySelection;
  }): Promise<BoundedItems> {
    const rows = await this.queryCandidates<{
      id: string;
      projectId: string;
      requesterId: string;
      recipientId: string;
      title: string;
      status: string;
      resourceId: string | null;
      createdAt: Date;
      updatedAt: Date;
      completedAt: Date | null;
    }>(
      Prisma.sql`
      SELECT request.id, request.project_id AS "projectId", request.requester_id AS "requesterId",
        request.recipient_id AS "recipientId", request.title, request.status, request.resource_id AS "resourceId",
        request.created_at AS "createdAt", request.updated_at AS "updatedAt", request.completed_at AS "completedAt"
      FROM project_file_requests request
      JOIN ai_context_projects project ON project.id = request.project_id AND project.status = 'active'
      JOIN ai_context_project_members sender ON sender.project_id = project.id AND sender.user_id = request.requester_id
      WHERE ${input.userId} IN (request.requester_id, request.recipient_id)
        ${input.projectId ? Prisma.sql`AND request.project_id = ${input.projectId}` : Prisma.empty}
        ${input.statuses ? Prisma.sql`AND request.status IN (${Prisma.join(input.statuses)})` : Prisma.empty}
        ${input.completedSince ? Prisma.sql`AND request.completed_at >= ${input.completedSince}` : Prisma.empty}
        AND ((request.recipient_workspace_id IS NULL AND EXISTS (
          SELECT 1 FROM ai_context_project_members member WHERE member.project_id = project.id AND member.user_id = request.recipient_id
        )) OR (request.recipient_workspace_id IS NOT NULL AND 2 = (
          SELECT count(*) FROM workspace_members member WHERE member.workspace_id = request.recipient_workspace_id
            AND member.user_id IN (request.requester_id, request.recipient_id) AND member.state = 'active'
        )))
      ORDER BY request.updated_at DESC, request.id DESC
    `,
      'file_request',
      input.limit,
      input.history
    );
    return {
      capped: rows.length > input.limit,
      items: rows.slice(0, input.limit).map(row => ({
        id: `file-request:${row.id}`,
        entityId: row.id,
        kind: 'file_request',
        projectId: row.projectId,
        workspaceId: null,
        title: row.title,
        status: row.status,
        segment:
          row.status === 'pending'
            ? 'todo'
            : row.status === 'in_progress'
              ? 'in_progress'
              : 'done',
        attention:
          row.status === 'pending'
            ? row.recipientId === input.userId
              ? 'needs_my_action'
              : 'waiting_on_others'
            : null,
        documentId: row.resourceId,
        requestedLevel: null,
        redacted: false,
        relatedUserId:
          row.requesterId === input.userId ? row.recipientId : row.requesterId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        completedAt: row.completedAt,
        availableActions: [],
        run: null,
        blocker: null,
      })),
    };
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
    const [requests, invitations] = await Promise.all([
      this.listAccessRequestItems(input),
      this.listProjectInvitationItems(input),
    ]);
    const compare = input.history
      ? historyOrder
      : input.mode === 'todo'
        ? panelTodoOrder
        : panelDoneOrder;
    const combined = [requests, invitations]
      .flatMap(source => source.items)
      .sort(compare);
    return {
      items: combined.slice(0, input.limit),
      capped:
        [requests, invitations].some(source => source.capped) ||
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
    const ordering = Prisma.sql`request.updated_at DESC, request.id DESC`;
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
        WHERE request.purpose = 'project_copy'
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
        if (pending && canWithdraw) actions.push('withdraw_access_request');
        return {
          id: `access-request:${row.id}`,
          entityId: row.id,
          kind: 'access_request' as const,
          segment: pending ? ('todo' as const) : ('done' as const),
          attention: pending ? ('waiting_on_others' as const) : null,
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
