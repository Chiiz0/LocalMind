import { createHash } from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';

import {
  type FileUpload,
  ImageFormatNotSupported,
  sniffMime,
} from '../../../base';
import { PermissionAccess } from '../../../core/permission';
import { ProjectBlobStorage } from '../../../core/project';
import { Models } from '../../../models';
import { processImage } from '../../../native';
import { CompatSubmissionStore } from '../compat/submission-store';
import type { PromptMessage } from '../providers/types';
import { ChatSessionService } from '../session';
import { CopilotStorage } from '../storage';

const COPILOT_IMAGE_MAX_EDGE = 1536;

type CreateInboxMessage = {
  sessionId: string;
  content?: string;
  attachments?: string[];
  blob?: Promise<FileUpload>;
  blobs?: Promise<FileUpload>[];
  params?: Record<string, any>;
};

@Injectable()
export class ConversationInboxService {
  constructor(
    private readonly chatSession: ChatSessionService,
    private readonly ac: PermissionAccess,
    private readonly storage: CopilotStorage,
    private readonly submissions: CompatSubmissionStore,
    private readonly projectBlobs: ProjectBlobStorage,
    private readonly models: Models
  ) {}

  async createMessage(
    userId: string,
    options: CreateInboxMessage
  ): Promise<string> {
    const metadata = await this.chatSession.assertOwnedSession(
      userId,
      options.sessionId
    );
    const session = await this.chatSession.get(options.sessionId);
    if (!session || session.config.userId !== userId) {
      throw new BadRequestException('Session not found');
    }

    const attachments: PromptMessage['attachments'] = options.attachments || [];
    const blobs = await Promise.all(
      options.blob ? [options.blob] : options.blobs || []
    );

    const workspaceId = metadata.workspaceId;
    const projectId = metadata.selectedContextProjectId;
    if (blobs.length && workspaceId) {
      await this.ac
        .user(userId)
        .workspace(workspaceId)
        .allowLocal()
        .assert('Workspace.Blobs.Write');
    }

    for (const blob of blobs) {
      const uploaded = await this.storage.handleUpload(userId, blob);
      const detectedMime =
        sniffMime(uploaded.buffer, blob.mimetype)?.toLowerCase() ||
        blob.mimetype;
      let attachmentBuffer = uploaded.buffer;
      let attachmentMimeType = detectedMime;

      if (detectedMime.startsWith('image/')) {
        try {
          attachmentBuffer = await processImage(
            uploaded.buffer,
            COPILOT_IMAGE_MAX_EDGE,
            true
          );
          attachmentMimeType = 'image/webp';
        } catch {
          throw new ImageFormatNotSupported({ format: detectedMime });
        }
      }

      const filename = createHash('sha256')
        .update(attachmentBuffer)
        .digest('base64url');
      if (workspaceId) {
        const attachment = await this.storage.put(
          userId,
          workspaceId,
          filename,
          attachmentBuffer
        );
        attachments.push({ attachment, mimeType: attachmentMimeType });
      } else if (projectId) {
        await this.projectBlobs.put({
          projectId,
          actorId: userId,
          bytes: attachmentBuffer,
          mimeType: attachmentMimeType,
        });
        attachments.push({
          kind: 'data',
          data: attachmentBuffer.toString('base64'),
          encoding: 'base64',
          mimeType: attachmentMimeType,
        });
      }
    }

    await this.chatSession.assertOwnedSession(userId, options.sessionId);
    return await this.submissions.create({
      sessionId: options.sessionId,
      content: options.content,
      attachments,
      params:
        !workspaceId && projectId
          ? {
              ...options.params,
              projectContext: await this.models.copilotProjectContext.snapshot({
                projectId,
                actorId: userId,
                sessionId: options.sessionId,
              }),
            }
          : options.params,
    });
  }
}
