import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Prisma, type ProjectFileRequest } from '@prisma/client';
import { z } from 'zod';

import { BadRequest, NotFound } from '../base';
import { BaseModel } from './base';
import { projectResourceHash } from './project-resource';

const id = z.string().trim().min(1).max(256);
const createSchema = z.object({
  projectId: id,
  actorId: id,
  recipientId: id,
  title: z.string().trim().min(1).max(256),
  requestKey: id,
  sessionId: id.optional(),
});
export type FileRequestRecipient = {
  id: string;
  name: string;
  workspaceId: string | null;
};

@Injectable()
export class ProjectFileRequestModel extends BaseModel {
  @Transactional()
  async recipients(input: {
    projectId: string;
    actorId: string;
    query: string;
  }) {
    await this.models.projectResource.assertMember(input);
    const query = z.string().trim().min(1).max(128).parse(input.query);
    return this.db.$queryRaw<FileRequestRecipient[]>(Prisma.sql`
      SELECT u.id, u.name,
        CASE WHEN EXISTS (
          SELECT 1 FROM ai_context_project_members pm
          WHERE pm.project_id = ${input.projectId} AND pm.user_id = u.id
        ) THEN NULL ELSE (
          SELECT peer.workspace_id FROM workspace_members peer
          JOIN workspace_members actor ON actor.workspace_id = peer.workspace_id
          WHERE peer.user_id = u.id AND peer.state = 'active'
            AND actor.user_id = ${input.actorId} AND actor.state = 'active'
          ORDER BY peer.workspace_id LIMIT 1
        ) END AS "workspaceId"
      FROM users u
      WHERE u.id <> ${input.actorId}
        AND (u.id = ${query} OR position(lower(${query}) in lower(u.name)) > 0)
        AND (EXISTS (
          SELECT 1 FROM ai_context_project_members pm
          WHERE pm.project_id = ${input.projectId} AND pm.user_id = u.id
        ) OR EXISTS (
          SELECT 1 FROM workspace_members peer
          JOIN workspace_members actor ON actor.workspace_id = peer.workspace_id
          WHERE peer.user_id = u.id AND peer.state = 'active'
            AND actor.user_id = ${input.actorId} AND actor.state = 'active'
        ))
      ORDER BY CASE WHEN lower(u.name) = lower(${query}) THEN 0 ELSE 1 END, u.name, u.id
      LIMIT 20
    `);
  }

  @Transactional()
  async create(input: z.input<typeof createSchema>) {
    const data = createSchema.parse(input);
    await this.models.projectResource.assertMember(data, true);
    if (data.sessionId) {
      const session = await this.db.aiSession.findFirst({
        where: {
          id: data.sessionId,
          userId: data.actorId,
          workspaceId: null,
          selectedContextProjectId: data.projectId,
          deletedAt: null,
        },
      });
      if (!session) throw new NotFound('Project conversation unavailable');
    }
    const fingerprint = projectResourceHash({
      recipientId: data.recipientId,
      title: data.title,
      sessionId: data.sessionId ?? null,
    });
    const existing = await this.db.projectFileRequest.findUnique({
      where: {
        projectId_requesterId_requestKey: {
          projectId: data.projectId,
          requesterId: data.actorId,
          requestKey: data.requestKey,
        },
      },
    });
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new BadRequest('File request key was reused');
      await this.assertAuthority(existing);
      return existing;
    }
    const recipient = (
      await this.recipients({ ...data, query: data.recipientId })
    ).find(r => r.id === data.recipientId);
    if (!recipient) throw new NotFound('Recipient unavailable');
    const request = await this.db.projectFileRequest.create({
      data: {
        projectId: data.projectId,
        requesterId: data.actorId,
        recipientId: recipient.id,
        recipientWorkspaceId: recipient.workspaceId,
        title: data.title,
        requestKey: data.requestKey,
        fingerprint,
        sourceSessionId: data.sessionId,
      },
    });
    await this.record(request, data.actorId, 'requested');
    return request;
  }

  @Transactional()
  async get(requestId: string, actorId: string) {
    const request = await this.db.projectFileRequest.findUnique({
      where: { id: id.parse(requestId) },
    });
    if (
      !request ||
      ![request.requesterId, request.recipientId].includes(actorId)
    )
      throw new NotFound('File request unavailable');
    await this.assertAuthority(request);
    return request;
  }

  async present(request: ProjectFileRequest, actorId: string) {
    const [project, users] = await Promise.all([
      this.db.aiContextProject.findUniqueOrThrow({
        where: { id: request.projectId },
        select: { name: true },
      }),
      this.db.user.findMany({
        where: { id: { in: [request.requesterId, request.recipientId] } },
        select: { id: true, name: true },
      }),
    ]);
    return {
      ...request,
      projectName: project.name,
      requesterName: users.find(u => u.id === request.requesterId)?.name ?? '',
      recipientName: users.find(u => u.id === request.recipientId)?.name ?? '',
      isRecipient: request.recipientId === actorId,
    };
  }

  private async assertAuthority(
    request: ProjectFileRequest,
    treeWrite = false
  ) {
    await this.models.projectResource.assertMember(
      { projectId: request.projectId, actorId: request.requesterId },
      treeWrite
    );
    if (request.recipientWorkspaceId) {
      const members = await this.db.$queryRaw<{ user_id: string }[]>(Prisma.sql`
        SELECT user_id FROM workspace_members WHERE workspace_id = ${request.recipientWorkspaceId}
          AND user_id IN (${request.requesterId}, ${request.recipientId}) AND state = 'active' FOR SHARE
      `);
      if (members.length !== 2)
        throw new NotFound('File request relationship unavailable');
    } else {
      await this.models.projectResource.assertMember({
        projectId: request.projectId,
        actorId: request.recipientId,
      });
    }
  }

  private async lock(requestId: string, actorId: string) {
    const initial = await this.db.projectFileRequest.findUnique({
      where: { id: requestId },
    });
    if (
      !initial ||
      ![initial.requesterId, initial.recipientId].includes(actorId)
    )
      throw new NotFound('File request unavailable');
    await this.assertAuthority(initial, true);
    await this.db
      .$queryRaw`SELECT id FROM project_file_requests WHERE id = ${requestId} FOR UPDATE`;
    return this.db.projectFileRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
  }

  @Transactional()
  async change(input: {
    requestId: string;
    actorId: string;
    expectedVersion: number;
    action: 'start' | 'decline' | 'cancel';
  }) {
    const request = await this.lock(input.requestId, input.actorId);
    const status = {
      start: 'in_progress',
      decline: 'declined',
      cancel: 'cancelled',
    }[input.action];
    if (
      input.action === 'cancel'
        ? request.requesterId !== input.actorId
        : request.recipientId !== input.actorId
    )
      throw new NotFound('File request unavailable');
    if (request.status === status) return request;
    if (
      request.version !== input.expectedVersion ||
      !['pending', 'in_progress'].includes(request.status) ||
      (input.action === 'start' && request.status !== 'pending')
    )
      throw new BadRequest(
        'File request changed. Reload it before continuing.'
      );
    const updated = await this.db.projectFileRequest.update({
      where: { id: request.id },
      data: {
        status,
        version: { increment: 1 },
        completedAt: input.action === 'start' ? null : new Date(),
      },
    });
    await this.record(updated, input.actorId, status);
    return updated;
  }

  @Transactional()
  async deliver(
    input: {
      requestId: string;
      actorId: string;
      expectedVersion: number;
      fileName: string;
      fingerprint: string;
    },
    save: (request: ProjectFileRequest) => Promise<string>
  ) {
    const request = await this.lock(input.requestId, input.actorId);
    if (request.recipientId !== input.actorId)
      throw new NotFound('File request unavailable');
    if (
      request.status === 'completed' &&
      request.deliveryFingerprint === input.fingerprint
    )
      return request;
    if (
      !['pending', 'in_progress'].includes(request.status) ||
      request.version !== input.expectedVersion
    )
      throw new BadRequest(
        'File request changed. Reload it before submitting.'
      );
    const resourceId = await save(request);
    const updated = await this.db.projectFileRequest.update({
      where: { id: request.id },
      data: {
        status: 'completed',
        version: { increment: 1 },
        resourceId,
        fileName: input.fileName,
        deliveryFingerprint: input.fingerprint,
        completedAt: new Date(),
      },
    });
    await this.db.projectResourceAuditEvent.create({
      data: {
        projectId: request.projectId,
        resourceId,
        actorId: input.actorId,
        action: 'file_request_delivered',
        evidence: {
          requestId: request.id,
          requesterId: request.requesterId,
          fingerprint: input.fingerprint,
        },
      },
    });
    await this.record(updated, input.actorId, 'completed');
    return updated;
  }

  private async record(
    request: ProjectFileRequest,
    actorId: string,
    action: string
  ) {
    await this.db.projectFileRequestEvent.create({
      data: {
        requestId: request.id,
        actorId,
        action,
        version: request.version,
      },
    });
    // Notification and refresh outbox commit with the request, independently of Redis delivery.
    for (const userId of [request.requesterId, request.recipientId]) {
      await this.db.notification.upsert({
        where: { id: `file-request:${request.id}:${userId}` },
        create: {
          id: `file-request:${request.id}:${userId}`,
          userId,
          type: 'ProjectFileRequest',
          level: 'Default',
          body: { requestId: request.id, createdByUserId: actorId },
          read: userId === actorId,
        },
        update: {
          read: userId === actorId,
          dismissedAt: userId === actorId ? undefined : null,
          body: { requestId: request.id, createdByUserId: actorId },
        },
      });
      await this.db.notificationRefresh.upsert({
        where: { userId },
        create: { userId, revision: randomUUID() },
        update: { revision: randomUUID() },
      });
    }
  }
}
