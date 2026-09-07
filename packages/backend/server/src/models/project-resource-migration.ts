import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma, type ProjectResourceMigration } from '@prisma/client';

import { BadRequest } from '../base';
import { BaseModel } from './base';
import { type ProjectActor, projectResourceHash } from './project-resource';

export type ProjectMigrationLease = {
  id: string;
  leaseId: string;
  attempt: number;
};

@Injectable()
export class ProjectResourceMigrationModel extends BaseModel {
  @Transactional()
  async discover(projectId?: string) {
    const references = await this.db.aiContextProjectDoc.findMany({
      where: {
        projectId,
        internalResourceId: null,
        resourceMigration: null,
        project: { status: 'active' },
      },
      orderBy: [{ projectId: 'asc' }, { workspaceId: 'asc' }, { docId: 'asc' }],
      take: 50,
    });
    for (const reference of references) {
      const id = projectResourceHash([
        reference.projectId,
        reference.workspaceId,
        reference.docId,
      ]);
      const actorId =
        reference.addedByUserId ?? reference.placeholderInitiatorUserId;
      const result = await this.db.projectResourceMigration.createMany({
        data: [
          {
            id,
            projectId: reference.projectId,
            sourceWorkspaceId: reference.workspaceId,
            sourceResourceId: reference.docId,
            actorId,
            originalActorId: actorId,
            evidence: {
              legacyStatus: reference.status,
              groupId: reference.groupId,
              sortOrder: reference.sortOrder,
              createdAt: reference.createdAt.toISOString(),
            },
          },
        ],
        skipDuplicates: true,
      });
      if (result.count)
        await this.audit(
          await this.db.projectResourceMigration.findUniqueOrThrow({
            where: { id },
          })
        );
    }
    return references.length;
  }

  async get(input: ProjectActor & { migrationId: string }) {
    await this.models.projectResource.assertMember(input);
    const row = await this.db.projectResourceMigration.findFirst({
      where: { id: input.migrationId, projectId: input.projectId },
    });
    if (!row) throw new BadRequest('Project import migration is unavailable');
    return row;
  }

  async list(input: ProjectActor & { after?: string; limit?: number }) {
    await this.models.projectResource.assertMember(input);
    if ((input.after?.length ?? 0) > 256)
      throw new BadRequest('Invalid migration cursor');
    const limit = input.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 50)
      throw new BadRequest('Invalid migration page size');
    if (input.after) await this.get({ ...input, migrationId: input.after });
    return this.db.projectResourceMigration.findMany({
      where: { projectId: input.projectId, id: { gt: input.after } },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });
  }

  async queued() {
    return this.db.projectResourceMigration.findMany({
      where: {
        OR: [
          { status: 'pending' },
          { status: 'running', leaseExpiresAt: { lte: new Date() } },
        ],
      },
      orderBy: { updatedAt: 'asc' },
      take: 20,
    });
  }

  private async lock(id: string) {
    const rows = await this.db.$queryRaw<
      { id: string }[]
    >`SELECT id FROM project_resource_migrations WHERE id = ${id} FOR UPDATE`;
    return rows.length
      ? this.db.projectResourceMigration.findUnique({ where: { id } })
      : null;
  }

  @Transactional()
  async acquire(id: string) {
    const row = await this.lock(id);
    if (
      !row ||
      (row.status !== 'pending' &&
        !(
          row.status === 'running' &&
          row.leaseExpiresAt &&
          row.leaseExpiresAt <= new Date()
        ))
    )
      return null;
    const next = await this.db.projectResourceMigration.update({
      where: { id },
      data: {
        status: 'running',
        leaseId: randomUUID(),
        leaseExpiresAt: new Date(Date.now() + 120000),
        attempt: { increment: 1 },
        revision: { increment: 1 },
        failureCode: null,
      },
    });
    await this.audit(next);
    return next;
  }

  private async assertLease(input: ProjectMigrationLease) {
    const row = await this.lock(input.id);
    if (
      !row ||
      row.status !== 'running' ||
      row.leaseId !== input.leaseId ||
      row.attempt !== input.attempt ||
      !row.leaseExpiresAt ||
      row.leaseExpiresAt <= new Date()
    )
      throw new BadRequest('Project migration lease is no longer current');
    return row;
  }

  @Transactional<TransactionalAdapterPrisma>({ timeout: 60000 })
  async execute(
    input: ProjectMigrationLease,
    copy: (
      row: ProjectResourceMigration & { actorId: string }
    ) => Promise<{ id: string }>
  ) {
    const row = await this.assertLease(input);
    if (!row.actorId)
      throw new BadRequest('Project migration needs an authorized actor');
    const actor = { projectId: row.projectId, actorId: row.actorId };
    await this.models.intelligenceWorkbenchAuthorization.lockProjectDocumentAuthorization(
      {
        ...actor,
        workspaceId: row.sourceWorkspaceId,
        docId: row.sourceResourceId,
      }
    );
    await this.models.projectResource.assertMember(actor, true);
    const resource = await copy({ ...row, actorId: row.actorId });
    await this.assertLease(input);
    const event = await this.db.projectResourceAuditEvent.findFirst({
      where: {
        projectId: row.projectId,
        resourceId: resource.id,
        action: 'imported',
      },
      orderBy: { createdAt: 'desc' },
    });
    const evidence = event?.evidence as Prisma.JsonObject | undefined;
    if (
      !event ||
      evidence?.sourceWorkspaceId !== row.sourceWorkspaceId ||
      evidence.sourceResourceId !== row.sourceResourceId
    )
      throw new BadRequest('Project migration import evidence is unavailable');
    const source = await this.models.projectResource.get({
      ...actor,
      resourceId: resource.id,
    });
    const revision = source.officeArtifactId
      ? await this.models.officeArtifact.getCurrentRevision(
          { projectId: row.projectId },
          resource.id
        )
      : await this.models.projectResource.revision({
          ...actor,
          resourceId: resource.id,
        });
    if (!revision)
      throw new BadRequest('Project migration result has no saved revision');
    await this.db.aiContextProjectDoc.update({
      where: {
        projectId_workspaceId_docId: {
          projectId: row.projectId,
          workspaceId: row.sourceWorkspaceId,
          docId: row.sourceResourceId,
        },
      },
      data: { internalResourceId: resource.id },
    });
    const next = await this.db.projectResourceMigration.update({
      where: { id: row.id },
      data: {
        status: 'complete',
        resourceId: resource.id,
        leaseId: null,
        leaseExpiresAt: null,
        revision: { increment: 1 },
        evidence: {
          ...(row.evidence as Prisma.InputJsonObject),
          importEventId: event.id,
          source: evidence as Prisma.InputJsonObject,
          resourceKind: source.kind,
          resourceTitle: source.title,
          revisionId: revision.id,
          contentFingerprint:
            'packageFingerprint' in revision
              ? revision.packageFingerprint
              : revision.fingerprint,
        },
      },
    });
    await this.audit(next);
    return next;
  }

  @Transactional()
  async fail(
    input: ProjectMigrationLease,
    failureCode: 'authorization_required' | 'source_or_copy_unavailable'
  ) {
    const row = await this.lock(input.id);
    if (
      !row ||
      row.status !== 'running' ||
      row.leaseId !== input.leaseId ||
      row.attempt !== input.attempt
    )
      return;
    const next = await this.db.projectResourceMigration.update({
      where: { id: row.id },
      data: {
        status:
          failureCode === 'authorization_required'
            ? 'waiting_for_authorization'
            : 'failed',
        failureCode,
        leaseId: null,
        leaseExpiresAt: null,
        revision: { increment: 1 },
      },
    });
    await this.audit(next);
  }

  @Transactional()
  async change(
    input: ProjectActor & {
      migrationId: string;
      expectedRevision: number;
      action: 'retry' | 'cancel';
    }
  ) {
    await this.get(input);
    const row = await this.lock(input.migrationId);
    if (!row || row.revision !== input.expectedRevision)
      throw new BadRequest(
        'Project migration changed; reload before continuing'
      );
    if (row.status === 'running' || row.status === 'complete')
      throw new BadRequest(
        'This migration cannot be changed while running or after completion'
      );
    if (row.status === 'pending' && input.action === 'retry') return row;
    const next = await this.db.projectResourceMigration.update({
      where: { id: row.id },
      data: {
        status: input.action === 'retry' ? 'pending' : 'cancelled',
        actorId: input.actorId,
        failureCode: null,
        revision: { increment: 1 },
      },
    });
    await this.audit(next);
    return next;
  }

  private audit(row: ProjectResourceMigration) {
    return this.db.projectResourceMigrationEvent.create({
      data: {
        migrationId: row.id,
        revision: row.revision,
        status: row.status,
        actorId: row.actorId,
        evidence: {
          attempt: row.attempt,
          leaseId: row.leaseId,
          resourceId: row.resourceId,
          failureCode: row.failureCode,
          details: row.evidence as Prisma.InputJsonObject,
        },
      },
    });
  }
}
