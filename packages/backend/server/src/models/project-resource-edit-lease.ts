import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Prisma } from '@prisma/client';

import { AccessDenied, BadRequest } from '../base';
import { BaseModel } from './base';
import type { ProjectActor } from './project-resource';

export type ProjectEditLeaseOwner = { tabId: string } & (
  | { kind: 'user'; taskId?: never }
  | { kind: 'ai_task'; taskId: string }
);
export type ProjectEditLeaseProof = ProjectEditLeaseOwner & { leaseId: string };
type ResourceActor = ProjectActor & { resourceId: string };
type Lease = Prisma.ProjectResourceEditLeaseGetPayload<{
  include: { holder: { select: { id: true; name: true; email: true } } };
}>;

export class ProjectEditLeaseRequired extends AccessDenied {
  constructor() {
    super('An active Project resource edit lease is required');
  }
}

@Injectable()
export class ProjectResourceEditLeaseModel extends BaseModel {
  @Transactional()
  async get(input: ResourceActor) {
    await this.models.projectResource.get(input);
    return this.current(input.resourceId);
  }

  @Transactional()
  async list(input: ProjectActor) {
    await this.models.projectResource.assertMember(input);
    return this.db.projectResourceEditLease.findMany({
      where: {
        projectId: input.projectId,
        expiresAt: { gt: await this.now() },
      },
      include: { holder: { select: { id: true, name: true, email: true } } },
      orderBy: { resourceId: 'asc' },
      take: 1000,
    });
  }

  @Transactional()
  async acquire(input: ResourceActor & ProjectEditLeaseOwner) {
    this.validate(input);
    await this.lockResource(input);
    const now = await this.now();
    const expiresAt = await this.expiration(input, now);
    const acquired = await this.db.$queryRaw<{ resource_id: string }[]>`
      INSERT INTO project_resource_edit_leases(resource_id, project_id, lease_id, holder_id, tab_id, kind, task_id, acquired_at, expires_at)
      VALUES (${input.resourceId}, ${input.projectId}, ${randomUUID()}, ${input.actorId}, ${input.tabId}, ${input.kind}, ${input.taskId ?? null}, ${now}, ${expiresAt})
      ON CONFLICT(resource_id) DO UPDATE SET
        lease_id = CASE WHEN project_resource_edit_leases.expires_at > ${now} THEN project_resource_edit_leases.lease_id ELSE EXCLUDED.lease_id END,
        acquired_at = CASE WHEN project_resource_edit_leases.expires_at > ${now} THEN project_resource_edit_leases.acquired_at ELSE EXCLUDED.acquired_at END,
        holder_id = EXCLUDED.holder_id, tab_id = EXCLUDED.tab_id, kind = EXCLUDED.kind, task_id = EXCLUDED.task_id, expires_at = EXCLUDED.expires_at
      WHERE project_resource_edit_leases.expires_at <= ${now} OR (
        project_resource_edit_leases.holder_id = EXCLUDED.holder_id AND project_resource_edit_leases.tab_id = EXCLUDED.tab_id
        AND project_resource_edit_leases.kind = EXCLUDED.kind AND project_resource_edit_leases.task_id IS NOT DISTINCT FROM EXCLUDED.task_id
      ) RETURNING resource_id
    `;
    return {
      acquired: acquired.length === 1,
      lease: await this.current(input.resourceId),
    };
  }

  @Transactional()
  async renew(input: ResourceActor & ProjectEditLeaseProof) {
    this.validate(input);
    await this.lockResource(input);
    const now = await this.now();
    const expiresAt = await this.expiration(input, now);
    const renewed = await this.db.projectResourceEditLease.updateMany({
      where: { ...this.identity(input), expiresAt: { gt: now } },
      data: { expiresAt },
    });
    if (!renewed.count) {
      await this.db.projectResourceAuditEvent.create({
        data: {
          projectId: input.projectId,
          resourceId: input.resourceId,
          actorId: input.actorId,
          action: 'edit_lease_renewal_denied',
          evidence: {
            leaseId: input.leaseId,
            tabId: input.tabId,
            kind: input.kind,
          },
        },
      });
      await this.db.projectRealtimeOutbox.create({
        data: {
          topic: 'project.lease.changed',
          scopeId: input.projectId,
          resourceId: input.resourceId,
        },
      });
    }
    return {
      acquired: renewed.count === 1,
      lease: await this.current(input.resourceId),
    };
  }

  @Transactional()
  async release(input: ResourceActor & ProjectEditLeaseProof) {
    this.validate(input);
    // Revoked members can release only their own exact lease; no role grants an override.
    const released = await this.db.projectResourceEditLease.deleteMany({
      where: this.identity(input),
    });
    return released.count === 1;
  }

  @Transactional()
  async assertHeld(
    input: ResourceActor & { editLease?: ProjectEditLeaseProof }
  ) {
    if (!input.editLease) throw new ProjectEditLeaseRequired();
    const proof = { ...input, ...input.editLease };
    this.validate(proof);
    await this.lockResource(input);
    const lease = await this.db.projectResourceEditLease.findFirst({
      where: { ...this.identity(proof), expiresAt: { gt: await this.now() } },
    });
    if (!lease) throw new ProjectEditLeaseRequired();
    if (proof.kind === 'ai_task')
      await this.expiration(proof, await this.now());
    return lease;
  }

  async proofForTask(
    input: ProjectActor & {
      runId: string;
      workerLeaseId: string;
      resourceId: string;
    }
  ) {
    const lease = await this.db.projectResourceEditLease.findFirst({
      where: {
        resourceId: input.resourceId,
        projectId: input.projectId,
        holderId: input.actorId,
        kind: 'ai_task',
        taskId: input.runId,
        tabId: input.workerLeaseId,
        expiresAt: { gt: await this.now() },
      },
    });
    if (!lease) throw new ProjectEditLeaseRequired();
    return {
      kind: 'ai_task',
      taskId: input.runId,
      tabId: input.workerLeaseId,
      leaseId: lease.leaseId,
    } satisfies ProjectEditLeaseProof;
  }

  async releaseTask(
    input: ProjectActor & { runId: string; workerLeaseId: string }
  ) {
    return this.db.projectResourceEditLease.deleteMany({
      where: {
        projectId: input.projectId,
        holderId: input.actorId,
        kind: 'ai_task',
        taskId: input.runId,
        tabId: input.workerLeaseId,
      },
    });
  }

  async expire(limit = 100) {
    // A bounded sweep produces release events even when no editor requests a new lease.
    return this.db.$executeRaw`
      DELETE FROM project_resource_edit_leases WHERE resource_id IN (
        SELECT resource_id FROM project_resource_edit_leases WHERE expires_at <= clock_timestamp()
        ORDER BY expires_at LIMIT ${Math.min(1000, Math.max(1, limit))} FOR UPDATE SKIP LOCKED
      ) AND expires_at <= clock_timestamp()
    `;
  }

  view(lease: Lease | null, identity?: { actorId: string; tabId: string }) {
    if (!lease) return null;
    const owned =
      lease.kind === 'user' &&
      lease.holderId === identity?.actorId &&
      lease.tabId === identity.tabId;
    return {
      resourceId: lease.resourceId,
      projectId: lease.projectId,
      kind: lease.kind,
      holderName: lease.holder.name || lease.holder.email,
      holderId: lease.holderId,
      acquiredAt: lease.acquiredAt,
      expiresAt: lease.expiresAt,
      owned,
      leaseId: owned ? lease.leaseId : null,
    };
  }

  private async current(resourceId: string): Promise<Lease | null> {
    return this.db.projectResourceEditLease.findFirst({
      where: { resourceId, expiresAt: { gt: await this.now() } },
      include: { holder: { select: { id: true, name: true, email: true } } },
    });
  }

  private async lockResource(input: ResourceActor) {
    await this.models.projectResource.get({ ...input, includeTrash: true });
    await this.db
      .$queryRaw`SELECT id FROM project_resources WHERE id = ${input.resourceId} AND project_id = ${input.projectId} FOR UPDATE`;
  }

  private async now() {
    const [clock] = await this.db.$queryRaw<
      { now: Date }[]
    >`SELECT clock_timestamp() AS now`;
    return clock.now;
  }

  private async expiration(
    input: ProjectActor & ProjectEditLeaseOwner,
    now: Date
  ) {
    let expiresAt = new Date(now.getTime() + 60000);
    if (input.kind === 'ai_task') {
      const run = await this.db.aiAgentRun.findFirst({
        where: {
          id: input.taskId,
          projectId: input.projectId,
          actorId: input.actorId,
          status: 'running',
          workerLeaseId: input.tabId,
          workerLeaseExpiresAt: { gt: now },
        },
      });
      if (!run?.workerLeaseExpiresAt) throw new ProjectEditLeaseRequired();
      expiresAt = new Date(
        Math.min(expiresAt.getTime(), run.workerLeaseExpiresAt.getTime())
      );
    }
    return expiresAt;
  }

  private identity(input: ResourceActor & ProjectEditLeaseProof) {
    return {
      resourceId: input.resourceId,
      projectId: input.projectId,
      holderId: input.actorId,
      leaseId: input.leaseId,
      tabId: input.tabId,
      kind: input.kind,
      taskId: input.taskId ?? null,
    };
  }

  private validate(input: ProjectEditLeaseOwner & { leaseId?: string }) {
    if (
      typeof input.tabId !== 'string' ||
      !input.tabId.trim() ||
      input.tabId.length > 128 ||
      (input.leaseId !== undefined &&
        (typeof input.leaseId !== 'string' ||
          !input.leaseId.trim() ||
          input.leaseId.length > 128))
    )
      throw new BadRequest('Invalid Project edit lease identity');
  }
}
