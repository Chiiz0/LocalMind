import { createHash } from 'node:crypto';

import { z } from 'zod';

import { BadRequest } from '../../../base';
import type { Models } from '../../../models';
import { defineTool } from './tool';

export const PROJECT_COLLABORATION_POLICY = [
  'In a Project conversation, treat the user\'s explicit requests to perform supported actions as instructions to execute, including "ask member-01 for file a". Do not replace them with example wording unless the user asks only for a draft.',
  'For a file request: call project_file_request_recipients to resolve the recipient, then project_file_request_create with the returned exact recipient ID and the requested file name. If several people match, ask the user to choose. Never guess a user ID, invite a member, or change permissions.',
  'A successful file request sends an in-app notification and creates a durable task: the sender waits on the recipient; the recipient can start, submit a file, or decline. Report the actual request ID and waiting state, not completion. No external email or messenger is sent by this tool.',
  'For a reminder-only wait (waiting for a reply, file, or decision without sending a request), call blocker_suggest and present its confirmation card. A deadline is optional: pass due_at:null if the user gave no date; do not require a reminder time. A suggestion is not a saved reminder. Never substitute a Blocker for a file request or create both for the same request.',
  'If the required tool is unavailable or returns an error, explain the exact limitation and do not claim that a person was contacted or a task created.',
].join('\n');

export function createProjectFileRequestTools(
  models: Models,
  scope: {
    projectId: string;
    actorId: string;
    sessionId: string;
    turnId?: string;
  }
) {
  return {
    project_file_request_recipients: {
      ...defineTool({
        description:
          'Resolve a recipient by name or exact ID among current Project members and people sharing an active Workspace with the requester. Returns at most 20 candidates. Resolve ambiguity before sending a file request.',
        inputSchema: z
          .object({ query: z.string().trim().min(1).max(128) })
          .strict(),
        execute: async ({ query }) =>
          models.projectFileRequest
            .recipients({ ...scope, query })
            .then(rows => rows.map(({ id, name }) => ({ id, name }))),
      }),
      sideEffectType: 'read' as const,
    },
    project_file_request_create: {
      ...defineTool({
        description:
          'Send an in-app file request to the exact resolved recipient when the user explicitly asks you to obtain a file. Creates a durable waiting task and notifies the recipient. Does not grant Project membership or read any recipient file. Do not use for drafting a message or a reminder-only wait.',
        inputSchema: z
          .object({
            recipient_id: z.string().min(1).max(256),
            file_name: z.string().trim().min(1).max(256),
            user_requested: z.literal(true),
          })
          .strict(),
        execute: async ({ recipient_id, file_name }, options) => {
          if (!options.toolCallId)
            throw new BadRequest(
              'A stable file request tool call ID is required'
            );
          options.signal?.throwIfAborted();
          const requestKey = createHash('sha256')
            .update(
              JSON.stringify([
                scope.sessionId,
                scope.turnId ?? null,
                options.toolCallId,
              ])
            )
            .digest('hex');
          const request = await models.projectFileRequest.create({
            ...scope,
            recipientId: recipient_id,
            title: file_name,
            requestKey,
          });
          return {
            requestId: request.id,
            projectId: request.projectId,
            status: request.status,
            recipientId: request.recipientId,
            fileName: request.title,
            notificationSent: true,
            taskCreated: true,
            url: `/intelligence?fileRequest=${encodeURIComponent(request.id)}`,
          };
        },
      }),
      sideEffectType: 'project_write' as const,
    },
  };
}
