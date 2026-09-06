import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import {
  type AccessRequest,
  Notification,
  NotificationLevel,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { z } from 'zod';

import { Due, PaginationInput } from '../base';
import { BaseModel } from './base';
import { DocMode } from './common';

export { NotificationLevel, NotificationType };
export type { Notification };

// #region input

export const ONE_YEAR = Due.ms('1y');
const IdSchema = z.string().trim().min(1).max(100);

export const BaseNotificationCreateSchema = z.object({
  userId: IdSchema,
  level: z
    .nativeEnum(NotificationLevel)
    .optional()
    .default(NotificationLevel.Default),
});

export const MentionDocSchema = z.object({
  id: IdSchema,
  // Allow empty string, will display as `Untitled` at frontend
  title: z.string().trim().max(255),
  mode: z.nativeEnum(DocMode),
  // blockId or elementId is required at least one
  blockId: IdSchema.optional(),
  elementId: IdSchema.optional(),
});

export type MentionDoc = z.infer<typeof MentionDocSchema>;
export type MentionDocCreate = z.input<typeof MentionDocSchema>;

const MentionNotificationBodySchema = z.object({
  workspaceId: IdSchema,
  createdByUserId: IdSchema,
  doc: MentionDocSchema,
});

export type MentionNotificationBody = z.infer<
  typeof MentionNotificationBodySchema
>;

export const MentionNotificationCreateSchema =
  BaseNotificationCreateSchema.extend({
    body: MentionNotificationBodySchema,
  });

export type MentionNotificationCreate = z.input<
  typeof MentionNotificationCreateSchema
>;

const InvitationNotificationBodySchema = z.object({
  workspaceId: IdSchema,
  createdByUserId: IdSchema,
  inviteId: IdSchema,
});

export type InvitationNotificationBody = z.infer<
  typeof InvitationNotificationBodySchema
>;

export const InvitationNotificationCreateSchema =
  BaseNotificationCreateSchema.extend({
    body: InvitationNotificationBodySchema,
  });

export type InvitationNotificationCreate = z.input<
  typeof InvitationNotificationCreateSchema
>;

const InvitationReviewDeclinedNotificationBodySchema = z.object({
  workspaceId: IdSchema,
  createdByUserId: IdSchema,
});

export type InvitationReviewDeclinedNotificationBody = z.infer<
  typeof InvitationReviewDeclinedNotificationBodySchema
>;

export const InvitationReviewDeclinedNotificationCreateSchema =
  BaseNotificationCreateSchema.extend({
    body: InvitationReviewDeclinedNotificationBodySchema,
  });

export type InvitationReviewDeclinedNotificationCreate = z.input<
  typeof InvitationReviewDeclinedNotificationCreateSchema
>;

export const CommentNotificationBodySchema = z.object({
  workspaceId: IdSchema,
  createdByUserId: IdSchema,
  commentId: IdSchema,
  replyId: IdSchema.optional(),
  doc: MentionDocSchema,
});

export type CommentNotificationBody = z.infer<
  typeof CommentNotificationBodySchema
>;

export const CommentNotificationCreateSchema =
  BaseNotificationCreateSchema.extend({
    body: CommentNotificationBodySchema,
  });

export type CommentNotificationCreate = z.input<
  typeof CommentNotificationCreateSchema
>;

export const CommentMentionNotificationCreateSchema =
  BaseNotificationCreateSchema.extend({
    body: CommentNotificationBodySchema,
  });

export type UnionNotificationBody =
  | AccessRequestNotificationBody
  | MentionNotificationBody
  | InvitationNotificationBody
  | InvitationReviewDeclinedNotificationBody
  | CommentNotificationBody;

export type AccessRequestNotificationBody = {
  workspaceId: string;
  createdByUserId: string;
  requestId: string;
};

// #endregion

// #region output

export type MentionNotification = Notification &
  z.infer<typeof MentionNotificationCreateSchema>;

export type InvitationNotification = Notification &
  z.infer<typeof InvitationNotificationCreateSchema>;

export type InvitationReviewDeclinedNotification = Notification &
  z.infer<typeof InvitationReviewDeclinedNotificationCreateSchema>;

export type CommentNotification = Notification &
  z.infer<typeof CommentNotificationCreateSchema>;

export type UnionNotification =
  | (Notification & { body: AccessRequestNotificationBody })
  | MentionNotification
  | InvitationNotification
  | InvitationReviewDeclinedNotification
  | CommentNotification;

// #endregion

@Injectable()
export class NotificationModel extends BaseModel {
  private async enqueueRefresh(userId: string) {
    const revision = randomUUID();
    await this.db.notificationRefresh.upsert({
      where: { userId },
      create: { userId, revision },
      update: { revision },
    });
  }

  async pendingRefreshes() {
    return await this.db.notificationRefresh.findMany({
      orderBy: [{ updatedAt: 'asc' }, { userId: 'asc' }],
      take: 100,
    });
  }

  async acknowledgeRefresh(userId: string, revision: string) {
    return await this.db.notificationRefresh.deleteMany({
      where: { userId, revision },
    });
  }

  async deferRefresh(userId: string, revision: string) {
    return await this.db.notificationRefresh.updateMany({
      where: { userId, revision },
      data: { updatedAt: new Date() },
    });
  }

  @Transactional()
  async reconcileAccessRequestRecipients() {
    // Find missing recipients from current authority, without replaying every
    // pending notification or relying on a role-change realtime event.
    const missing = await this.db.$queryRaw<
      Array<{ requestId: string; userId: string }>
    >`
      SELECT request.id AS "requestId", recipient.user_id AS "userId"
      FROM access_requests request
      CROSS JOIN LATERAL (
        SELECT user_id FROM workspace_members
        WHERE workspace_id = request.workspace_id AND state = 'active'
          AND role IN ('owner', 'admin')
        UNION
        SELECT principal_id FROM doc_grants
        WHERE workspace_id = request.workspace_id AND doc_id = request.doc_id
          AND principal_type = 'user' AND role = 'owner'
      ) recipient
      WHERE request.status = 'pending'
        AND (request.expires_at IS NULL OR request.expires_at > CURRENT_TIMESTAMP)
        AND NOT EXISTS (
          SELECT 1 FROM notifications notification
          WHERE notification.id = 'access:' || request.id || ':' || recipient.user_id
        )
      ORDER BY request.created_at, request.id, recipient.user_id
      LIMIT 100
    `;
    for (const { requestId, userId } of missing) {
      const request = await this.db.accessRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
      const inserted = await this.db.notification.createMany({
        data: {
          id: `access:${request.id}:${userId}`,
          userId,
          type: NotificationType.AccessRequest,
          level: NotificationLevel.Default,
          body: {
            workspaceId: request.workspaceId,
            createdByUserId: request.requesterUserIdSnapshot,
            requestId: request.id,
          },
          read: request.status !== 'pending',
        },
        skipDuplicates: true,
      });
      if (inserted.count) await this.enqueueRefresh(userId);
    }
    return missing.length;
  }

  @Transactional()
  async syncAccessRequest(request: AccessRequest) {
    const body: AccessRequestNotificationBody = {
      workspaceId: request.workspaceId,
      createdByUserId: request.requesterUserIdSnapshot,
      requestId: request.id,
    };
    if (request.status === 'pending') {
      const recipients = await this.db.$queryRaw<{ userId: string }[]>`
        SELECT user_id AS "userId" FROM workspace_members
        WHERE workspace_id = ${request.workspaceId} AND state = 'active'
          AND role IN ('owner', 'admin')
        UNION
        SELECT principal_id AS "userId" FROM doc_grants
        WHERE workspace_id = ${request.workspaceId} AND doc_id = ${request.docId}
          AND principal_type = 'user' AND role = 'owner'
      `;
      for (const { userId } of recipients) {
        const id = `access:${request.id}:${userId}`;
        await this.db.notification.upsert({
          where: { id },
          update: {},
          create: {
            id,
            userId,
            type: NotificationType.AccessRequest,
            level: NotificationLevel.Default,
            body,
          },
        });
        await this.enqueueRefresh(userId);
      }
      return;
    }
    const notificationWhere = {
      type: NotificationType.AccessRequest,
      body: { path: ['requestId'], equals: request.id },
    };
    const recipients = await this.db.notification.findMany({
      where: notificationWhere,
      select: { userId: true },
      distinct: ['userId'],
    });
    await this.db.notification.updateMany({
      where: notificationWhere,
      data: { read: true },
    });
    for (const { userId } of recipients) await this.enqueueRefresh(userId);
    if (request.requesterUserId) {
      const id = `access-result:${request.id}:${request.requesterUserId}`;
      await this.db.notification.upsert({
        where: { id },
        update: {},
        create: {
          id,
          userId: request.requesterUserId,
          type: NotificationType.AccessRequestResolved,
          level: NotificationLevel.Default,
          body,
        },
      });
      await this.enqueueRefresh(request.requesterUserId);
    }
  }

  // #region mention

  @Transactional()
  async createMention(input: MentionNotificationCreate) {
    const data = MentionNotificationCreateSchema.parse(input);
    const row = await this.create({
      userId: data.userId,
      level: data.level,
      type: NotificationType.Mention,
      body: data.body,
    });
    await this.createIscpDeliveries(row.id, data.userId);
    this.logger.debug(
      `Created mention notification:${row.id} for user:${data.userId} in workspace:${data.body.workspaceId}`
    );
    return row as MentionNotification;
  }

  // #endregion

  // #region invitation

  async createInvitation(
    input: InvitationNotificationCreate,
    type: NotificationType = NotificationType.Invitation
  ) {
    const data = InvitationNotificationCreateSchema.parse(input);
    const row = await this.create({
      userId: data.userId,
      level: data.level,
      type,
      body: data.body,
    });
    this.logger.debug(
      `Created ${type} notification ${row.id} to user ${data.userId} in workspace ${data.body.workspaceId}`
    );
    return row as InvitationNotification;
  }

  async createInvitationReviewDeclined(
    input: InvitationReviewDeclinedNotificationCreate
  ) {
    const data = InvitationReviewDeclinedNotificationCreateSchema.parse(input);
    const type = NotificationType.InvitationReviewDeclined;
    const row = await this.create({
      userId: data.userId,
      level: data.level,
      type,
      body: data.body,
    });
    this.logger.debug(
      `Created ${type} notification ${row.id} to user ${data.userId} in workspace ${data.body.workspaceId}`
    );
    return row as InvitationReviewDeclinedNotification;
  }

  // #endregion

  // #region comment

  async createComment(input: CommentNotificationCreate) {
    const data = CommentNotificationCreateSchema.parse(input);
    const type = NotificationType.Comment;
    const row = await this.create({
      userId: data.userId,
      level: data.level,
      type,
      body: data.body,
    });
    this.logger.debug(
      `Created ${type} notification ${row.id} to user ${data.userId} in workspace ${data.body.workspaceId}`
    );
    return row as CommentNotification;
  }

  @Transactional()
  async createCommentMention(input: CommentNotificationCreate) {
    const data = CommentMentionNotificationCreateSchema.parse(input);
    const type = NotificationType.CommentMention;
    const row = await this.create({
      userId: data.userId,
      level: data.level,
      type,
      body: data.body,
    });
    await this.createIscpDeliveries(row.id, data.userId);
    this.logger.debug(
      `Created ${type} notification ${row.id} to user ${data.userId} in workspace ${data.body.workspaceId}`
    );
    return row as CommentNotification;
  }

  // #endregion

  // #region common

  private async create(data: Prisma.NotificationUncheckedCreateInput) {
    return await this.db.notification.create({
      data,
    });
  }

  private async createIscpDeliveries(notificationId: string, userId: string) {
    const settings = await this.models.userSettings.get(userId);
    if (!settings.receiveSparkClawNotifications) return;
    const endpoints = await this.db.iscpAgentEndpoint.findMany({
      where: { userId, status: { not: 'revoked' } },
      select: { id: true },
    });
    if (!endpoints.length) return;
    await this.db.notificationDelivery.createMany({
      data: endpoints.map(endpoint => ({
        notificationId,
        endpointId: endpoint.id,
      })),
      skipDuplicates: true,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    await this.db.notification.update({
      where: { id: notificationId, userId, dismissedAt: null },
      data: {
        read: true,
      },
    });
  }

  async markInvitationAsRead(userId: string, inviteId: string) {
    const { count } = await this.db.notification.updateMany({
      where: {
        userId,
        type: NotificationType.Invitation,
        read: false,
        dismissedAt: null,
        body: { path: ['inviteId'], equals: inviteId },
      },
      data: { read: true },
    });
    return count;
  }

  async markAllAsRead(userId: string) {
    const { count } = await this.db.notification.updateMany({
      where: { userId, dismissedAt: null },
      data: {
        read: true,
      },
    });
    this.logger.log(
      `Marked all notifications as read for user ${userId}, count: ${count}`
    );
  }

  async dismiss(notificationId: string, userId: string) {
    await this.db.notification.update({
      where: { id: notificationId, userId },
      data: { dismissedAt: new Date() },
    });
  }

  async dismissRead(userId: string) {
    const { count } = await this.db.notification.updateMany({
      where: { userId, read: true, dismissedAt: null },
      data: { dismissedAt: new Date() },
    });
    return count;
  }

  /**
   * Find many notifications by user id, exclude read notifications by default
   */
  async findManyByUserId(
    userId: string,
    options?: {
      includeRead?: boolean;
    } & PaginationInput
  ) {
    const rows = await this.db.notification.findMany({
      where: {
        userId,
        dismissedAt: null,
        ...(options?.includeRead ? {} : { read: false }),
        ...(options?.after ? { createdAt: { lt: options.after } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: options?.offset,
      take: options?.first,
    });
    return rows as UnionNotification[];
  }

  async countByUserId(userId: string, options: { includeRead?: boolean } = {}) {
    return this.db.notification.count({
      where: {
        userId,
        dismissedAt: null,
        ...(options.includeRead ? {} : { read: false }),
      },
    });
  }

  async get(notificationId: string) {
    const row = await this.db.notification.findUnique({
      where: { id: notificationId },
    });
    return row as UnionNotification;
  }

  async findExpiredNotificationUserIds() {
    const rows = await this.db.notification.findMany({
      distinct: ['userId'],
      select: { userId: true },
      where: { createdAt: { lte: new Date(Date.now() - ONE_YEAR) } },
    });
    return rows.map(row => row.userId);
  }

  async cleanExpiredNotifications() {
    const { count } = await this.db.notification.deleteMany({
      // delete notifications that are older than one year
      where: { createdAt: { lte: new Date(Date.now() - ONE_YEAR) } },
    });
    if (count > 0) {
      this.logger.log(`Deleted ${count} expired notifications`);
    }
    return count;
  }

  // #endregion
}
