import { createHash } from 'node:crypto';

import { Logger } from '@nestjs/common';
import { z } from 'zod';

import { DocWriter } from '../../../core/doc';
import { PermissionAccess } from '../../../core/permission';
import type { Models } from '../../../models';
import type { CopilotDocumentCopyService } from '../document-copy-service';
import { toolError } from './error';
import { defineTool } from './tool';
import type { CopilotChatOptions } from './types';

const logger = new Logger('DocWriteTool');

export const createDocCopyRequestTool = (
  copies: CopilotDocumentCopyService,
  options: CopilotChatOptions
) =>
  defineTool({
    description:
      'Prepare an independent copy of an existing document into another workspace only when the user requests it. Preserve the original; do not synchronize or copy its permissions. The user must choose a destination before creation. This returns a pending operation, not a created document. Check doc_creation_status for the real result.',
    inputSchema: z
      .object({
        source_workspace_id: z.string().min(1).max(256),
        source_document_id: z.string().min(1).max(256),
        title: z.string().trim().min(1).max(512),
        add_to_project: z
          .boolean()
          .default(false)
          .describe(
            'Only request project addition if the user explicitly requested it.'
          ),
      })
      .strict(),
    execute: async ({
      source_workspace_id,
      source_document_id,
      title,
      add_to_project,
    }) => {
      try {
        if (!options?.user || !options.session)
          throw new Error(
            'Document copying requires the current user conversation'
          );
        const operation = await copies.prepare({
          actorId: options.user,
          sessionId: options.session,
          workspaceId: source_workspace_id,
          documentId: source_document_id,
          title,
          addToProject: add_to_project,
        });
        return {
          operationId: operation.id,
          status: operation.status,
          documentCreated: !!operation.createdDocumentAt,
          documentId: operation.createdDocumentAt ? operation.documentId : null,
          message: operation.createdDocumentAt
            ? 'Copy creation is recorded. Check its current placement and project status.'
            : 'Waiting for the user to choose the copy destination. No copy has been created.',
        };
      } catch (error) {
        return toolError(
          'Document Copy Request Failed',
          error instanceof Error
            ? error.message
            : 'Document copy request is unavailable'
        );
      }
    },
  });

export const createDocCreationStatusTool = (
  models: Models,
  options: CopilotChatOptions
) =>
  defineTool({
    description:
      'Read persisted document creation and project-addition results for this conversation. Only documentCreated=true proves creation; projectStatus=requested is still awaiting authorization.',
    inputSchema: z
      .object({ operation_id: z.string().min(1).max(256) })
      .strict(),
    execute: async ({ operation_id }) => {
      try {
        if (!options?.user || !options.session)
          throw new Error(
            'Document status requires the current user conversation'
          );
        const operation = await models.copilotDocumentOperation.receipt({
          operationId: operation_id,
          actorId: options.user,
          sessionId: options.session,
        });
        return {
          operationId: operation.id,
          status: operation.status,
          documentCreated: !!operation.createdDocumentAt,
          placementComplete: !!operation.placedDocumentAt,
          documentId: operation.createdDocumentAt ? operation.documentId : null,
          workspaceId: operation.destinationWorkspaceId,
          projectStatus: operation.projectStatus,
          accessRequestId: operation.accessRequestId,
        };
      } catch (error) {
        return toolError(
          'Document Creation Status Failed',
          error instanceof Error
            ? error.message
            : 'Document status is unavailable'
        );
      }
    },
  });

export const createDocCreateRequestTool = (
  ac: PermissionAccess,
  models: Models,
  options: CopilotChatOptions
) =>
  defineTool({
    description:
      'Prepare a new document for the user to choose its storage workspace and explicit root or folder. This does not create a document. Report waiting for location selection until a persisted operation result confirms creation. Never use a document or folder as a substitute for creating a Project.',
    inputSchema: z
      .object({
        title: z.string().trim().min(1).max(512),
        content: z.string().max(1024 * 1024),
        add_to_project: z
          .boolean()
          .default(false)
          .describe(
            'Request addition only if the user explicitly asked to add the created document to the current Project.'
          ),
      })
      .strict(),
    execute: async ({ title, content, add_to_project }, executeOptions) => {
      try {
        if (!options?.user || !options.workspace || !options.session)
          throw new Error(
            'Document creation requires a user conversation and location selection'
          );
        const session = await models.copilotSession.getMeta(options.session);
        if (
          !session ||
          session.userId !== options.user ||
          session.workspaceId !== options.workspace
        )
          throw new Error('Document creation conversation is unavailable');
        await ac
          .user(options.user)
          .workspace(options.workspace)
          .assert('Workspace.Copilot');
        const operation =
          await models.copilotDocumentOperation.prepareForLatestTurn({
            actorId: options.user,
            sessionId: options.session,
            title: sanitizeTitle(title),
            markdown: stripLeadingH1(content),
            addToProject: add_to_project,
            ...(options.taskId
              ? { delegatedCallId: executeOptions.toolCallId }
              : {}),
          });
        return {
          operationId: operation.id,
          status: operation.status,
          documentCreated: !!operation.createdDocumentAt,
          projectStatus: operation.projectStatus,
          documentId: operation.createdDocumentAt ? operation.documentId : null,
          workspaceId: operation.destinationWorkspaceId,
          message: operation.createdDocumentAt
            ? 'Document creation is recorded. Check its placement and project-addition status separately.'
            : 'Waiting for the user to select a storage workspace and location. No document has been created.',
        };
      } catch (error) {
        return toolError(
          'Document Creation Request Failed',
          error instanceof Error
            ? error.message
            : 'Document creation request failed'
        );
      }
    },
  });

const stripLeadingH1 = (content: string) =>
  content.replace(/^[ \t]{0,3}#\s+[^\n]*#*\s*\n*/, '');

const sanitizeTitle = (title: string) => title.replace(/[\r\n]+/g, ' ').trim();

const delegatedDocumentId = (taskId: string, title: string) =>
  createHash('sha256')
    .update('localmind-delegated-doc-create/v1\0')
    .update(taskId)
    .update('\0')
    .update(title)
    .digest('base64url')
    .slice(0, 21);

export const buildDocCreateHandler = (
  ac: PermissionAccess,
  writer: DocWriter
) => {
  return async (
    options: CopilotChatOptions,
    title: string,
    content: string
  ) => {
    if (!options?.user || !options.workspace) {
      return toolError(
        'Doc Create Failed',
        'Missing user or workspace context'
      );
    }

    await ac
      .user(options.user)
      .workspace(options.workspace)
      .assert('Workspace.CreateDoc');

    const sanitizedTitle = sanitizeTitle(title);
    if (!sanitizedTitle) {
      return toolError('Doc Create Failed', 'Title cannot be empty');
    }

    const strippedContent = stripLeadingH1(content);
    const requestedDocId = options.taskId
      ? delegatedDocumentId(options.taskId, sanitizedTitle)
      : undefined;
    const result = await writer.createDoc(
      options.workspace,
      sanitizedTitle,
      strippedContent,
      options.user,
      requestedDocId
    );

    return {
      success: true,
      docId: result.docId,
      idempotentReplay: result.idempotentReplay ?? false,
      message: `Document "${sanitizedTitle}" created successfully`,
    };
  };
};

function documentWriteSourceGuard(
  models: Models,
  actorId: string,
  workspaceId: string,
  sessionId: string | undefined,
  docId: string
) {
  return () =>
    models.copilotContext.assertDocumentSourcesShared({
      actorId,
      sessionId,
      sink: {
        type: 'document_update',
        id: docId,
        documentId: docId,
        workspaceId,
        phase: 'execute',
      },
    });
}

export const buildDocUpdateHandler = (
  ac: PermissionAccess,
  writer: DocWriter,
  models: Models
) => {
  return async (
    options: CopilotChatOptions,
    docId: string,
    content: string
  ) => {
    const notFound = toolError(
      'Doc Update Failed',
      `Doc with id ${docId} not found.`
    );

    if (!options?.user || !options.workspace) {
      return notFound;
    }

    const canAccess = await ac
      .user(options.user)
      .workspace(options.workspace)
      .doc(docId)
      .can('Doc.Update');

    if (!canAccess) {
      return notFound;
    }

    const beforeWrite = documentWriteSourceGuard(
      models,
      options.user,
      options.workspace,
      options.session,
      docId
    );
    await beforeWrite();
    const result = await writer.updateDoc(
      options.workspace,
      docId,
      content,
      options.user,
      beforeWrite
    );

    return {
      success: true,
      docId,
      changed: result.changed !== false,
      idempotentReplay: result.changed === false,
      message: 'Document updated successfully',
    };
  };
};

export const buildDocUpdateMetaHandler = (
  ac: PermissionAccess,
  writer: DocWriter,
  models: Models
) => {
  return async (options: CopilotChatOptions, docId: string, title: string) => {
    const notFound = toolError(
      'Doc Meta Update Failed',
      `Doc with id ${docId} not found.`
    );

    if (!options?.user || !options.workspace) {
      return notFound;
    }

    const canAccess = await ac
      .user(options.user)
      .workspace(options.workspace)
      .doc(docId)
      .can('Doc.Update');

    if (!canAccess) {
      return notFound;
    }

    const sanitizedTitle = sanitizeTitle(title);
    if (!sanitizedTitle) {
      return toolError('Doc Meta Update Failed', 'Title cannot be empty');
    }

    const beforeWrite = documentWriteSourceGuard(
      models,
      options.user,
      options.workspace,
      options.session,
      docId
    );
    await beforeWrite();
    await writer.updateDocMeta(
      options.workspace,
      docId,
      { title: sanitizedTitle },
      options.user,
      beforeWrite
    );

    return {
      success: true,
      docId,
      message: 'Document title updated successfully',
    };
  };
};

export const createDocCreateTool = (
  createDoc: (title: string, content: string) => Promise<object>
) => {
  return defineTool({
    description:
      'Create a new document in the workspace with the given title and markdown content. Returns the ID of the created document. This tool not support insert or update database block and image yet.',
    inputSchema: z.object({
      title: z.string().min(1).describe('The title of the new document'),
      content: z
        .string()
        .describe('The markdown content for the document body'),
    }),
    execute: async ({ title, content }) => {
      try {
        return await createDoc(title, content);
      } catch (err: any) {
        logger.error(`Failed to create document: ${title}`, err);
        return toolError('Doc Create Failed', err.message);
      }
    },
  });
};

export const createDocUpdateTool = (
  updateDoc: (docId: string, content: string) => Promise<object>
) => {
  return defineTool({
    description:
      'Update an existing document with new markdown content (body only). Uses structural diffing to apply minimal changes. This does NOT update the document title. This tool not support insert or update database block and image yet.',
    inputSchema: z.object({
      doc_id: z.string().describe('The ID of the document to update'),
      content: z
        .string()
        .describe(
          'The complete new markdown content for the document body (do NOT include a title H1)'
        ),
    }),
    execute: async ({ doc_id, content }) => {
      try {
        return await updateDoc(doc_id, content);
      } catch (err: any) {
        logger.error(`Failed to update document: ${doc_id}`, err);
        return toolError('Doc Update Failed', err.message);
      }
    },
  });
};

export const createDocUpdateMetaTool = (
  updateDocMeta: (docId: string, title: string) => Promise<object>
) => {
  return defineTool({
    description: 'Update document metadata (currently title only).',
    inputSchema: z.object({
      doc_id: z.string().describe('The ID of the document to update'),
      title: z.string().min(1).describe('The new document title'),
    }),
    execute: async ({ doc_id, title }) => {
      try {
        return await updateDocMeta(doc_id, title);
      } catch (err: any) {
        logger.error(`Failed to update document meta: ${doc_id}`, err);
        return toolError('Doc Meta Update Failed', err.message);
      }
    },
  });
};
