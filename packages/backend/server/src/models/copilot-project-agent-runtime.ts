import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { type AiAgentRun, Prisma } from '@prisma/client';

import { BadRequest } from '../base';
import { BaseModel } from './base';
import {
  agentRuntimeFingerprint,
  type CopilotAgentRunStatus,
} from './copilot-agent-runtime';
import type { ProjectActor } from './project-resource';
import {
  PROJECT_WORKSPACE_IMPORT_WORKFLOW,
  projectWorkspaceImportCommand,
} from './project-workspace-import';

const include = {
  steps: { orderBy: { order: 'asc' as const } },
  timelineEvents: { orderBy: { ordinal: 'asc' as const } },
  projectExecutionResults: { orderBy: { workerAttempt: 'asc' as const } },
} satisfies Prisma.AiAgentRunInclude;

export type ProjectAgentRun = Prisma.AiAgentRunGetPayload<{
  include: typeof include;
}> & { projectId: string; workspaceId: null };
export type ProjectAgentLease = ProjectActor & {
  runId: string;
  workerLeaseId: string;
  workerAttempt: number;
};

export const PROJECT_AGENT_WORKFLOW = 'agent_runtime_project_resource';

@Injectable()
export class CopilotProjectAgentRuntimeModel extends BaseModel {
  async findRequest(
    input: ProjectActor & { sourceType: string; requestKey: string }
  ) {
    await this.models.projectResource.assertMember(input);
    const run = await this.db.aiAgentRun.findUnique({
      where: {
        projectId_sourceType_sourceId: {
          projectId: input.projectId,
          sourceType: input.sourceType,
          sourceId: input.requestKey,
        },
      },
    });
    if (!run) return null;
    return this.get({ ...input, runId: run.id });
  }

  @Transactional()
  async prepare(
    input: ProjectActor & {
      requestKey: string;
      sessionId?: string;
      workflow: string;
      sourceType: 'project_resource' | 'project_publication' | 'project_import';
      title: string;
      command: Prisma.InputJsonObject;
      status?: 'queued' | 'waiting_for_location' | 'waiting_approval';
    }
  ) {
    await this.models.projectResource.assertMember(input, true);
    for (const value of [input.requestKey, input.workflow, input.title]) {
      if (!value.trim() || value.length > 512)
        throw new BadRequest('Invalid Project task identity');
    }
    if (Buffer.byteLength(JSON.stringify(input.command)) > 2 * 1024 * 1024)
      throw new BadRequest('Project task input exceeds its bounds');
    if (input.sessionId) {
      const sessions = await this.db.$queryRaw<{ id: string }[]>`
        SELECT id FROM ai_sessions_metadata WHERE id = ${input.sessionId}
          AND user_id = ${input.actorId} AND workspace_id IS NULL
          AND selected_context_project_id = ${input.projectId} AND deleted_at IS NULL
        FOR SHARE
      `;
      if (!sessions.length)
        throw new BadRequest('Project task conversation is unavailable');
    }
    const targetFingerprint = agentRuntimeFingerprint(
      input.sourceType === 'project_resource'
        ? { ...input.command, readProof: undefined }
        : input.command
    );
    const existing = await this.db.aiAgentRun.findUnique({
      where: {
        projectId_sourceType_sourceId: {
          projectId: input.projectId,
          sourceType: input.sourceType,
          sourceId: input.requestKey,
        },
      },
      include,
    });
    if (existing) {
      if (
        existing.actorId !== input.actorId ||
        existing.sessionId !== (input.sessionId ?? null) ||
        existing.workflow !== input.workflow ||
        existing.targetFingerprint !== targetFingerprint
      )
        throw new BadRequest(
          'Project task request was reused with different input'
        );
      return this.read(input.projectId, existing.id);
    }
    const now = new Date();
    const status = input.status ?? 'queued';
    const run = await this.db.aiAgentRun.create({
      data: {
        id: randomUUID(),
        workspaceId: null,
        projectId: input.projectId,
        actorId: input.actorId,
        sessionId: input.sessionId,
        workflow: input.workflow,
        sourceType: input.sourceType,
        sourceId: input.requestKey,
        title: input.title,
        status,
        targetFingerprint,
        evidenceFingerprint: agentRuntimeFingerprint({
          actorId: input.actorId,
          projectId: input.projectId,
          sessionId: input.sessionId,
          command: input.command,
        }),
        timelineFingerprint: targetFingerprint,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
        queuedAt: status === 'queued' ? now : null,
        workerMaxAttempts: 3,
      },
    });
    await this.event(
      run,
      status,
      'Project task prepared',
      { requestFingerprint: targetFingerprint },
      now
    );
    if (status === 'waiting_approval') {
      const approval = await this.db.aiAgentStep.create({
        data: {
          id: randomUUID(),
          runId: run.id,
          workspaceId: null,
          projectId: input.projectId,
          actorId: input.actorId,
          stepKey: 'approve',
          stepType: 'approval',
          status: 'waiting_approval',
          evidenceFingerprint: targetFingerprint,
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
      await this.event(
        run,
        'waiting_approval',
        'Project operation awaits approval',
        { targetFingerprint },
        now,
        approval.id,
        'approval_step'
      );
    }
    const step = await this.db.aiAgentStep.create({
      data: {
        id: randomUUID(),
        runId: run.id,
        workspaceId: null,
        projectId: input.projectId,
        actorId: input.actorId,
        stepKey: 'execute',
        order: 1,
        stepType: 'tool',
        status: 'pending',
        evidenceFingerprint: targetFingerprint,
        input: input.command,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
    await this.event(
      run,
      'pending',
      'Project operation prepared',
      {},
      now,
      step.id
    );
    return this.get(inputWithRun(input, run.id));
  }

  @Transactional()
  async get(input: ProjectActor & { runId: string }) {
    await this.models.projectResource.assertMember(input);
    const run = await this.read(input.projectId, input.runId);
    if (run.actorId !== input.actorId)
      throw new BadRequest('Project task belongs to another actor');
    return run;
  }

  @Transactional()
  async list(
    input: ProjectActor & {
      sessionId?: string;
      beforeId?: string;
      limit?: number;
    }
  ) {
    await this.models.projectResource.assertMember(input);
    const limit = input.limit ?? 30;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequest('Invalid Project task page size');
    const cursor = input.beforeId
      ? await this.get({ ...input, runId: input.beforeId })
      : null;
    if (cursor && input.sessionId && cursor.sessionId !== input.sessionId)
      throw new BadRequest(
        'Project task cursor belongs to another conversation'
      );
    const rows = await this.db.aiAgentRun.findMany({
      where: {
        projectId: input.projectId,
        workspaceId: null,
        actorId: input.actorId,
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const items = rows.slice(0, limit);
    return {
      items,
      nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  @Transactional()
  async approve(
    input: ProjectActor & { runId: string; targetFingerprint: string }
  ) {
    await this.models.projectResource.assertMember(input, true);
    const run = await this.lock(input.projectId, input.runId);
    if (
      run.actorId !== input.actorId ||
      run.targetFingerprint !== input.targetFingerprint
    )
      throw new BadRequest('Project task confirmation does not match');
    if (run.workflow === PROJECT_WORKSPACE_IMPORT_WORKFLOW)
      throw new BadRequest(
        'Source copy requests must be approved through the source notification'
      );
    const approval = run.steps.find(step => step.stepKey === 'approve');
    if (!approval)
      throw new BadRequest('This Project task does not request approval');
    if (approval.status === 'completed') return run;
    if (run.status !== 'waiting_approval')
      throw new BadRequest('Project task is no longer waiting for approval');
    await this.stepStatus(
      run,
      'completed',
      { actorId: input.actorId, targetFingerprint: run.targetFingerprint },
      'approve'
    );
    return this.transition(
      run,
      'queued',
      'Project operation approved',
      {
        action: 'approve',
        actorId: input.actorId,
        targetFingerprint: run.targetFingerprint,
      },
      { queuedAt: new Date() }
    );
  }

  @Transactional()
  async decide(
    input: ProjectActor & {
      runId: string;
      targetFingerprint: string;
      expectedStatus: string;
      requestKey: string;
      action: 'approve' | 'reject' | 'cancel';
    }
  ) {
    if (
      !input.requestKey.trim() ||
      input.requestKey.length > 256 ||
      !['approve', 'reject', 'cancel'].includes(input.action)
    )
      throw new BadRequest('Invalid Project task decision');
    await this.models.projectResource.assertMember(input, true);
    const run = await this.lock(input.projectId, input.runId);
    if (
      run.actorId !== input.actorId ||
      run.targetFingerprint !== input.targetFingerprint
    )
      throw new BadRequest('Project task confirmation does not match');
    const decisions = run.timelineEvents.filter(event => {
      const value = event.payload as Prisma.JsonObject;
      return value.action === 'task_decision';
    });
    const replay = decisions.find(
      event =>
        (event.payload as Prisma.JsonObject).requestKey === input.requestKey
    );
    if (replay) {
      const value = replay.payload as Prisma.JsonObject;
      if (
        value.decision !== input.action ||
        value.expectedStatus !== input.expectedStatus
      )
        throw new BadRequest('Project task decision key was reused');
    }
    if (
      replay ||
      decisions.some(
        event => (event.payload as Prisma.JsonObject).decision === 'cancel'
      ) ||
      run.timelineEvents.some(
        event =>
          (event.payload as Prisma.JsonObject).action === 'cancel_requested'
      ) ||
      run.status !== input.expectedStatus ||
      ['completed', 'failed', 'cancelled'].includes(run.status)
    ) {
      const previous =
        replay ??
        run.timelineEvents.findLast(
          event =>
            (event.eventType === 'run_status' &&
              event.status === 'cancelled') ||
            ['task_decision', 'approve', 'cancel_requested'].includes(
              String((event.payload as Prisma.JsonObject).action)
            )
        );
      const payload = previous?.payload as Prisma.JsonObject | undefined;
      const action =
        payload?.decision ??
        (previous?.status === 'cancelled' ||
        payload?.action === 'cancel_requested'
          ? 'cancel'
          : payload?.action);
      return {
        run,
        applied: false,
        decision: ['approve', 'reject', 'cancel'].includes(String(action))
          ? String(action)
          : run.status === 'cancelled'
            ? 'cancel'
            : null,
        processedById: previous?.actorId ?? run.actorId,
        processedAt: previous?.createdAt ?? run.updatedAt,
      };
    }
    if (input.action !== 'cancel' && run.status !== 'waiting_approval')
      throw new BadRequest('Project task is no longer waiting for approval');
    const result =
      input.action === 'approve'
        ? await this.approve(input)
        : await this.cancel(input);
    const now = new Date();
    await this.event(
      result,
      result.status,
      'Project task decision recorded',
      {
        action: 'task_decision',
        decision: input.action,
        requestKey: input.requestKey,
        expectedStatus: input.expectedStatus,
        actorId: input.actorId,
      },
      now
    );
    return {
      run: await this.read(input.projectId, input.runId),
      applied: true,
      decision: input.action,
      processedById: input.actorId,
      processedAt: now,
    };
  }

  async pending(limit = 50) {
    await this.resumeWorkspaceImports();
    await this.resumeWaitingLeases();
    return this.db.aiAgentRun.findMany({
      where: {
        workspaceId: null,
        projectId: { not: null },
        OR: [
          { status: 'queued' },
          { status: 'running', workerLeaseExpiresAt: { lte: new Date() } },
        ],
      },
      select: { id: true, projectId: true },
      orderBy: [{ queuedAt: 'asc' }, { id: 'asc' }],
      take: Math.min(100, Math.max(1, limit)),
    });
  }

  async resumeWorkspaceImports() {
    // Query resolved requests first so a page of pending approvals cannot starve recovery.
    const rows = await this.db.$queryRaw<{ id: string; projectId: string }[]>`
      SELECT run.id, run.project_id AS "projectId" FROM ai_agent_runs run
      JOIN ai_agent_steps step ON step.run_id = run.id AND step.step_key = 'execute'
      LEFT JOIN access_requests request ON request.id = step.input->>'accessRequestId'
      WHERE run.workflow = ${PROJECT_WORKSPACE_IMPORT_WORKFLOW} AND run.status = 'waiting_approval'
        AND (request.id IS NULL OR request.status <> 'pending' OR request.expires_at <= NOW())
      ORDER BY run.created_at, run.id LIMIT 50
    `;
    for (const row of rows)
      await this.resolveWorkspaceImport(row.projectId, row.id);
  }

  @Transactional()
  private async resolveWorkspaceImport(projectId: string, runId: string) {
    const run = await this.lock(projectId, runId);
    if (
      run.workflow !== PROJECT_WORKSPACE_IMPORT_WORKFLOW ||
      run.status !== 'waiting_approval'
    )
      return;
    const command = projectWorkspaceImportCommand.parse(
      run.steps.find(step => step.stepKey === 'execute')?.input
    );
    const request = command.accessRequestId
      ? await this.db.accessRequest.findUnique({
          where: { id: command.accessRequestId },
        })
      : null;
    if (
      !request ||
      request.purpose !== 'project_copy' ||
      request.beneficiaryProjectId !== projectId ||
      request.workspaceId !== command.workspaceId ||
      request.docId !== command.sourceResourceId
    ) {
      await this.cancelCurrent(run);
      return;
    }
    if (
      request.status === 'pending' &&
      (!request.expiresAt || request.expiresAt > new Date())
    )
      return;
    if (request.status !== 'approved') {
      await this.cancelCurrent(run);
      return;
    }
    await this.stepStatus(
      run,
      'completed',
      {
        accessRequestId: request.id,
        approvedBy: request.resolverUserIdSnapshot,
      },
      'approve'
    );
    await this.transition(
      run,
      'queued',
      'Source copy approved; import queued',
      { accessRequestId: request.id },
      { queuedAt: new Date() }
    );
  }

  @Transactional()
  async retryWorkspaceImport(input: ProjectActor & { runId: string }) {
    await this.models.projectResource.assertMember(input, true);
    const run = await this.lock(input.projectId, input.runId);
    if (
      run.actorId !== input.actorId ||
      run.workflow !== PROJECT_WORKSPACE_IMPORT_WORKFLOW
    )
      throw new BadRequest('Import task is unavailable');
    if (run.status !== 'failed') return run;
    await this.stepStatus(run, 'pending');
    return this.transition(
      run,
      'queued',
      'Workspace import retried',
      { previousFailureCode: run.failureCode },
      {
        queuedAt: new Date(),
        completedAt: null,
        failureCode: null,
        failureMessage: null,
        workerMaxAttempts: run.workerAttempt + 3,
        workerLeaseId: null,
        workerLeaseExpiresAt: null,
      }
    );
  }

  @Transactional()
  async waitForEditLease(
    input: ProjectAgentLease & { resourceId: string; leaseId: string }
  ) {
    const run = await this.lock(input.projectId, input.runId);
    this.requireLease(run, input);
    if (await this.cancellationRequested(run.id))
      return this.cancelCurrent(run);
    const waiting = await this.transition(
      run,
      'waiting_lease',
      'Project task is waiting for the current editor',
      {
        resourceId: input.resourceId,
        leaseId: input.leaseId,
        leaseRetryCount: run.leaseRetryCount,
      },
      {
        waitingLeaseResourceId: input.resourceId,
        waitingLeaseId: input.leaseId,
        workerLeaseId: null,
        workerLeaseExpiresAt: null,
        queuedAt: null,
      }
    );
    await this.stepStatus(waiting, 'pending');
    return waiting;
  }

  async resumeWaitingLeases(projectId?: string, resourceId?: string) {
    const candidates = await this.db.aiAgentRun.findMany({
      where: {
        status: 'waiting_lease',
        leaseRetryCount: 0,
        ...(projectId ? { projectId } : {}),
        ...(resourceId ? { waitingLeaseResourceId: resourceId } : {}),
      },
      select: { id: true, projectId: true },
      orderBy: { updatedAt: 'asc' },
      take: 100,
    });
    const resumed = [];
    for (const candidate of candidates) {
      if (
        candidate.projectId &&
        (await this.resumeWaitingLease(candidate.projectId, candidate.id))
      )
        resumed.push(candidate);
    }
    return resumed;
  }

  @Transactional()
  private async resumeWaitingLease(projectId: string, runId: string) {
    const run = await this.lock(projectId, runId);
    if (
      run.status !== 'waiting_lease' ||
      run.leaseRetryCount !== 0 ||
      !run.waitingLeaseResourceId
    )
      return false;
    if (await this.cancellationRequested(run.id)) {
      await this.cancelCurrent(run);
      return false;
    }
    const held = await this.db.$queryRaw<{ resource_id: string }[]>`
      SELECT resource_id FROM project_resource_edit_leases WHERE resource_id = ${run.waitingLeaseResourceId} AND expires_at > clock_timestamp()
    `;
    if (held.length) return false;
    await this.transition(
      run,
      'queued',
      'Project editing ended; retrying the task once',
      {
        resourceId: run.waitingLeaseResourceId,
        previousLeaseId: run.waitingLeaseId,
        leaseRetryCount: 1,
      },
      { queuedAt: new Date(), leaseRetryCount: 1 }
    );
    return true;
  }

  @Transactional()
  async acquire(input: {
    projectId: string;
    runId: string;
    workerLeaseId: string;
    leaseMs?: number;
  }) {
    const run = await this.lock(input.projectId, input.runId);
    const now = new Date();
    if (
      run.status === 'running' &&
      run.workerLeaseExpiresAt &&
      run.workerLeaseExpiresAt <= now
    ) {
      if (run.workerAttempt >= run.workerMaxAttempts) {
        await this.finish(
          run,
          null,
          'stale_worker_lease',
          'Project task exhausted its worker leases'
        );
        return null;
      }
      await this.transition(
        run,
        'queued',
        'Expired Project lease recovered',
        {
          previousWorkerLeaseId: run.workerLeaseId,
          previousWorkerAttempt: run.workerAttempt,
        },
        { workerLeaseId: null, workerLeaseExpiresAt: null, queuedAt: now }
      );
    } else if (run.status !== 'queued') return null;
    if (await this.cancellationRequested(run.id)) {
      await this.cancelCurrent(await this.read(input.projectId, input.runId));
      return null;
    }
    if (run.workerAttempt >= run.workerMaxAttempts) return null;
    const leaseMs = input.leaseMs ?? 300000;
    if (
      !input.workerLeaseId.trim() ||
      input.workerLeaseId.length > 512 ||
      leaseMs < 100 ||
      leaseMs > 900000
    )
      throw new BadRequest('Invalid Project worker lease');
    const leased = await this.transition(
      await this.read(input.projectId, input.runId),
      'running',
      'Project worker lease acquired',
      {},
      {
        workerLeaseId: input.workerLeaseId,
        workerAttempt: run.workerAttempt + 1,
        workerLeaseExpiresAt: new Date(now.getTime() + leaseMs),
        lastAttemptAt: now,
      }
    );
    await this.stepStatus(leased, 'running');
    return this.read(input.projectId, input.runId);
  }

  @Transactional<TransactionalAdapterPrisma>({ timeout: 60000 })
  async execute(
    input: ProjectAgentLease,
    operation: (run: ProjectAgentRun) => Promise<Prisma.InputJsonObject>
  ) {
    // Lock membership before the run, matching resource writes and cancellation.
    await this.models.projectResource.assertMember(input, true);
    const run = await this.lock(input.projectId, input.runId);
    this.requireLease(run, input);
    if (
      run.steps.some(
        step => step.stepType === 'approval' && step.status !== 'completed'
      )
    )
      throw new BadRequest('Project operation approval is required');
    if (await this.cancellationRequested(run.id)) {
      await this.cancelCurrent(run);
      return null;
    }
    if (run.sessionId) {
      const session = await this.db.aiSession.findUnique({
        where: { id: run.sessionId },
      });
      if (
        !session ||
        session.deletedAt ||
        session.workspaceId ||
        session.userId !== run.actorId ||
        session.selectedContextProjectId !== run.projectId
      )
        throw new BadRequest('Project task conversation authorization changed');
    }
    const receipt = await operation(run);
    if (Buffer.byteLength(JSON.stringify(receipt)) > 64 * 1024)
      throw new BadRequest('Project task receipt exceeds its bounds');
    await this.models.projectResource.assertMember(input);
    this.requireLease(await this.read(input.projectId, input.runId), input);
    await this.finish(run, receipt);
    return receipt;
  }

  @Transactional()
  async renew(input: ProjectAgentLease) {
    await this.models.projectResource.assertMember(input, true);
    const run = await this.lock(input.projectId, input.runId);
    this.requireLease(run, input);
    if (await this.cancellationRequested(run.id)) {
      await this.cancelCurrent(run);
      await this.models.projectResourceEditLease.releaseTask(input);
      return false;
    }
    await this.transition(
      run,
      'running',
      'Project worker lease renewed',
      { action: 'worker_lease_renewed', workerLeaseId: input.workerLeaseId },
      { workerLeaseExpiresAt: new Date(Date.now() + 300000) }
    );
    const leases = await this.db.projectResourceEditLease.findMany({
      where: {
        projectId: input.projectId,
        taskId: run.id,
        tabId: input.workerLeaseId,
      },
    });
    for (const lease of leases) {
      const result = await this.models.projectResourceEditLease.renew({
        ...input,
        resourceId: lease.resourceId,
        kind: 'ai_task',
        taskId: run.id,
        tabId: input.workerLeaseId,
        leaseId: lease.leaseId,
      });
      if (!result.acquired)
        throw new BadRequest('Project resource edit lease expired');
    }
    return true;
  }

  @Transactional()
  async fail(input: ProjectAgentLease, code: string, message: string) {
    const run = await this.lock(input.projectId, input.runId);
    if (
      run.status !== 'running' ||
      run.workerLeaseId !== input.workerLeaseId ||
      run.workerAttempt !== input.workerAttempt
    )
      return run;
    if (await this.cancellationRequested(run.id))
      return this.cancelCurrent(run);
    await this.finish(run, null, code, message);
    return this.read(input.projectId, input.runId);
  }

  @Transactional()
  async cancel(input: ProjectActor & { runId: string }) {
    await this.models.projectResource.assertMember(input, true);
    const run = await this.lock(input.projectId, input.runId);
    if (run.actorId !== input.actorId)
      throw new BadRequest('Project task belongs to another actor');
    if (['completed', 'failed', 'cancelled'].includes(run.status)) return run;
    if (run.status !== 'running') return this.cancelCurrent(run);
    if (!(await this.cancellationRequested(run.id))) {
      await this.event(
        run,
        run.status,
        'Project task cancellation requested',
        { action: 'cancel_requested' },
        new Date(),
        undefined,
        'run_cancellation'
      );
    }
    return this.read(input.projectId, input.runId);
  }

  private async read(projectId: string, runId: string) {
    const run = await this.db.aiAgentRun.findFirst({
      where: { id: runId, projectId, workspaceId: null },
      include,
    });
    if (!run?.projectId || run.workspaceId !== null)
      throw new BadRequest('Project task is unavailable');
    return {
      ...run,
      projectId: run.projectId,
      workspaceId: null,
    } satisfies ProjectAgentRun;
  }

  private async lock(projectId: string, runId: string) {
    await this.db
      .$queryRaw`SELECT id FROM ai_agent_runs WHERE id = ${runId} AND project_id = ${projectId} AND workspace_id IS NULL FOR UPDATE`;
    return this.read(projectId, runId);
  }

  private requireLease(run: ProjectAgentRun, input: ProjectAgentLease) {
    if (
      run.actorId !== input.actorId ||
      run.status !== 'running' ||
      run.workerLeaseId !== input.workerLeaseId ||
      run.workerAttempt !== input.workerAttempt ||
      !run.workerLeaseExpiresAt ||
      run.workerLeaseExpiresAt <= new Date()
    )
      throw new BadRequest('Project worker lease changed');
  }

  private async cancellationRequested(runId: string) {
    return !!(await this.db.aiAgentTimelineEvent.findFirst({
      where: {
        runId,
        eventType: 'run_cancellation',
        payload: { path: ['action'], equals: 'cancel_requested' },
      },
    }));
  }

  private async cancelCurrent(run: ProjectAgentRun) {
    const now = new Date(Math.max(Date.now(), run.updatedAt.getTime()));
    const cancelled = await this.transition(
      run,
      'cancelled',
      'Project task cancelled',
      {},
      {
        workerLeaseId: null,
        workerLeaseExpiresAt: null,
        completedAt: now,
        queuedAt: null,
      },
      now
    );
    await this.stepStatus(cancelled, 'skipped');
    if (
      run.steps.some(
        step => step.stepKey === 'approve' && step.status !== 'completed'
      )
    )
      await this.stepStatus(cancelled, 'skipped', undefined, 'approve');
    return this.read(run.projectId, run.id);
  }

  private async finish(
    run: ProjectAgentRun,
    receipt: Prisma.InputJsonObject | null,
    code?: string,
    message?: string
  ) {
    const workerLeaseId = run.workerLeaseId;
    if (!workerLeaseId)
      throw new BadRequest('Project execution receipt requires a worker lease');
    const completedAt = new Date(Math.max(Date.now(), run.updatedAt.getTime()));
    const resultStatus = receipt ? 'completed' : 'failed';
    const sideEffectMode =
      run.sourceType === 'project_publication'
        ? 'workspace_write'
        : 'project_write';
    const summary = receipt
      ? 'Project resource operation saved'
      : (message ?? 'Project operation failed').slice(0, 1024);
    const failureCode = receipt
      ? null
      : (code ?? 'project_operation_failed').slice(0, 128);
    const adapter = {
      workflow: run.workflow,
      supportedStepTypes: [
        ...new Set(run.steps.map(step => step.stepType)),
      ].sort(),
      sideEffectMode,
    };
    const resultPayload = {
      version: 'agent-runtime-worker-execution-result/v1',
      resultStatus,
      workflow: run.workflow,
      sourceType: run.sourceType,
      sourceId: run.sourceId,
      adapterWorkflow: run.workflow,
      executor: 'agent_runtime_worker',
      sideEffectMode,
      sideEffectsApplied: !!receipt,
      summary,
      workerAttempt: run.workerAttempt,
      workerLeaseId,
      completedAt: completedAt.toISOString(),
      ...(receipt
        ? {
            sideEffectSummary: receipt,
            adapterResolution: {
              version: 'agent-runtime-worker-adapter-resolution/v1',
              status: 'completed',
              workflow: run.workflow,
              requestedStepTypes: adapter.supportedStepTypes,
              adapter,
              registeredAdapters: [adapter],
            },
          }
        : { failureCode, failureMessage: summary }),
    };
    const resultFingerprint = agentRuntimeFingerprint(resultPayload);
    const updated = await this.transition(
      run,
      resultStatus,
      summary,
      { resultFingerprint },
      {
        completedAt,
        failureCode,
        failureMessage: receipt ? null : summary,
        workerLeaseId: null,
        workerLeaseExpiresAt: null,
      },
      completedAt
    );
    await this.stepStatus(
      updated,
      resultStatus,
      receipt ?? { failureCode, message: summary }
    );
    await this.db.aiAgentRuntimeExecutionResult.create({
      data: {
        id: randomUUID(),
        runId: run.id,
        projectId: run.projectId,
        workspaceId: null,
        actorId: run.actorId,
        workflow: run.workflow,
        sourceType: run.sourceType,
        sourceId: run.sourceId,
        adapterWorkflow: run.workflow,
        executor: 'agent_runtime_worker',
        resultStatus,
        sideEffectMode,
        sideEffectsApplied: !!receipt,
        summary,
        failureCode,
        failureMessage: receipt ? null : summary,
        resultPayload,
        resultFingerprint,
        workerAttempt: run.workerAttempt,
        workerLeaseId,
        completedAt,
        createdAt: completedAt,
      },
    });
  }

  private async transition(
    run: ProjectAgentRun,
    status: CopilotAgentRunStatus,
    summary: string,
    payload: Prisma.InputJsonObject,
    data: Prisma.AiAgentRunUncheckedUpdateInput,
    now = new Date()
  ) {
    // A worker clock can move behind the last persisted transition.
    now = new Date(Math.max(now.getTime(), run.updatedAt.getTime()));
    const updated = await this.db.aiAgentRun.update({
      where: { id: run.id },
      data: {
        ...data,
        status,
        updatedAt: now,
        timelineFingerprint: agentRuntimeFingerprint({
          previous: run.timelineFingerprint,
          status,
          payload,
          now: now.toISOString(),
        }),
      },
      include,
    });
    await this.event(
      updated,
      status,
      summary,
      {
        ...payload,
        previousStatus: run.status,
        workerAttempt: updated.workerAttempt,
      },
      now
    );
    return {
      ...updated,
      projectId: run.projectId,
      workspaceId: null,
    } satisfies ProjectAgentRun;
  }

  private async stepStatus(
    run: ProjectAgentRun,
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped',
    output?: Prisma.InputJsonObject,
    stepKey = 'execute'
  ) {
    const step = run.steps.find(step => step.stepKey === stepKey);
    if (!step) throw new BadRequest('Project task execution step is missing');
    const now = new Date(
      Math.max(Date.now(), run.updatedAt.getTime(), step.updatedAt.getTime())
    );
    await this.db.aiAgentStep.update({
      where: { id: step.id },
      data: {
        status,
        startedAt: step.startedAt ?? now,
        updatedAt: now,
        completedAt: status === 'running' || status === 'pending' ? null : now,
        ...(output ? { outputSummary: output } : {}),
      },
    });
    await this.event(
      run,
      status,
      `Project operation ${status}`,
      {},
      now,
      step.id,
      step.stepType === 'approval' ? 'approval_step' : 'tool_step'
    );
  }

  private async event(
    run: AiAgentRun,
    status: string,
    summary: string,
    input: Prisma.InputJsonObject,
    now: Date,
    stepId?: string,
    eventType?: string
  ) {
    const payload = {
      version: 'agent-runtime-project/v1',
      ...input,
      workflow: run.workflow,
      sourceType: run.sourceType,
      sourceId: run.sourceId,
    };
    const last = await this.db.aiAgentTimelineEvent.aggregate({
      where: { runId: run.id },
      _max: { ordinal: true },
    });
    await this.db.aiAgentTimelineEvent.create({
      data: {
        id: randomUUID(),
        runId: run.id,
        workspaceId: null,
        projectId: run.projectId,
        actorId: run.actorId,
        stepId,
        eventType: eventType ?? (stepId ? 'tool_step' : 'run_status'),
        status,
        ordinal: (last._max.ordinal ?? -1) + 1,
        summary,
        payload,
        eventFingerprint: agentRuntimeFingerprint({
          status,
          payload,
          stepId,
          now: now.toISOString(),
        }),
        createdAt: now,
      },
    });
  }
}

function inputWithRun(input: ProjectActor, runId: string) {
  return { projectId: input.projectId, actorId: input.actorId, runId };
}
