import { Logger } from '@nestjs/common';
import { z } from 'zod';

import type { DocReader } from '../../../core/doc';
import type { PermissionAccess } from '../../../core/permission';
import type { Models } from '../../../models';
import {
  createAgentRuntimeDocUpdateRequest,
  resolveProjectDocumentOperation,
} from '../agent-runtime-doc-update-request';
import {
  documentSyncPendingError,
  workspaceSyncRequiredError,
} from './doc-sync';
import { type ToolError, toolError } from './error';
import { defineTool } from './tool';
import type { CopilotChatOptions } from './types';

const logger = new Logger('ProjectDocTool');

export const createProjectDocAddTool = (input: {
  ac: PermissionAccess;
  models: Models;
  options: CopilotChatOptions;
}) =>
  defineTool({
    description:
      'Add a document to the current Project only when the user explicitly requests it. A Project Owner with source sharing rights may grant access directly; otherwise this submits an access request. Pending means no authorization has been granted. You cannot approve or reject requests.',
    inputSchema: z
      .object({
        source_workspace_id: z.string().trim().min(1).max(256),
        doc_id: z.string().trim().min(1).max(256),
        requested_level: z.enum(['read', 'write']),
      })
      .strict(),
    execute: async (request, execution) => {
      try {
        const latestUser = execution.messages?.findLast(
          message => message.role === 'user'
        )?.content;
        if (
          typeof latestUser !== 'string' ||
          /(?:不要|别|禁止|无需|不允许|不必|取消|\bdo\s+not\b|\bdon['’]t\b|\bnever\b|\bcancel\b)/i.test(
            latestUser
          ) ||
          !/(?:加入|添加|申请|授权|\badd\b|\brequest\b|\bshare\b)/i.test(
            latestUser
          ) ||
          !/(?:项目|\bproject\b)/i.test(latestUser)
        ) {
          throw new Error(
            'Adding a document or requesting project access requires an explicit user request.'
          );
        }
        const { user, workspace, session: sessionId } = input.options ?? {};
        const session = sessionId
          ? await input.models.copilotSession.getMeta(sessionId)
          : null;
        if (
          !user ||
          !workspace ||
          !session ||
          session.userId !== user ||
          session.workspaceId !== workspace ||
          session.docId ||
          !session.selectedContextProjectId
        ) {
          throw new Error(
            'Select an active project conversation before adding a document.'
          );
        }
        await input.ac
          .user(user)
          .workspace(workspace)
          .assert('Workspace.Copilot');
        const result =
          await input.models.intelligenceWorkbenchAuthorization.addProjectDocument(
            {
              projectId: session.selectedContextProjectId,
              workspaceId: request.source_workspace_id,
              docId: request.doc_id,
              requesterUserId: user,
              requestedLevel: request.requested_level,
            }
          );
        return {
          success: true,
          projectId: session.selectedContextProjectId,
          sourceWorkspaceId: request.source_workspace_id,
          docId: request.doc_id,
          status: result.kind === 'granted' ? 'granted' : result.request.status,
          accessRequestId:
            result.kind === 'requested' ? result.request.id : null,
          grantedLevel: result.kind === 'granted' ? result.grant.level : null,
          message:
            result.kind === 'granted'
              ? 'Document is authorized for the Project.'
              : 'Project access request submitted. Access is not granted until the source owner or workspace administrator approves.',
        };
      } catch (error) {
        return toolError(
          'Project Document Add Failed',
          error instanceof Error
            ? error.message
            : 'Project document addition failed.'
        );
      }
    },
  });

const isToolError = (result: ToolError | object): result is ToolError =>
  'type' in result && result.type === 'error';

export type AuthorizedProjectDocumentRef = {
  workspaceId: string;
  docId: string;
};

export async function resolveAuthorizedProjectDocuments(input: {
  ac: PermissionAccess;
  models: Models;
  options: CopilotChatOptions;
}) {
  const actorId = input.options?.user;
  const hostWorkspaceId = input.options?.workspace;
  const sessionId = input.options?.session;
  if (!actorId || !hostWorkspaceId || !sessionId) {
    throw new Error(
      'Project document access requires a host workspace, session, and user'
    );
  }

  const session = await input.models.copilotSession.getMeta(sessionId);
  if (
    !session ||
    session.userId !== actorId ||
    session.workspaceId !== hostWorkspaceId ||
    session.docId ||
    !session.selectedContextProjectId
  ) {
    throw new Error('Project document session is not active for this user');
  }
  await input.ac
    .user(actorId)
    .workspace(hostWorkspaceId)
    .allowLocal()
    .assert('Workspace.Copilot');

  const project = await input.models.copilotContextMemory.getProject(
    session.selectedContextProjectId
  );
  if (
    !project ||
    project.status !== 'active' ||
    !project.members.some(member => member.userId === actorId)
  ) {
    throw new Error('Project document access is not available');
  }

  const grants =
    await input.models.intelligenceWorkbenchAuthorization.listGrantedProjectDocuments(
      { projectId: project.id, userId: actorId }
    );
  const documentsByWorkspace = new Map<
    string,
    AuthorizedProjectDocumentRef[]
  >();
  const personalWorkspaces = await input.ac.user(actorId).documentWorkspaces();
  for (const workspaceId of personalWorkspaces) {
    const docIds = await input.ac
      .user(actorId)
      .workspace(workspaceId)
      .projectScope(null)
      .readableDocIds();
    documentsByWorkspace.set(
      workspaceId,
      docIds.map(docId => ({ workspaceId, docId }))
    );
  }
  for (const grant of grants) {
    const documents = documentsByWorkspace.get(grant.workspaceId) ?? [];
    if (!documents.some(document => document.docId === grant.docId)) {
      documents.push({ workspaceId: grant.workspaceId, docId: grant.docId });
    }
    documentsByWorkspace.set(grant.workspaceId, documents);
  }

  const readable = await Promise.all(
    [...documentsByWorkspace].map(([workspaceId, documents]) =>
      input.ac
        .user(actorId)
        .workspace(workspaceId)
        .projectScope(project.id)
        .allowLocal()
        .docs(documents, 'Doc.Read')
    )
  );
  return {
    projectId: project.id,
    documents: readable.flat(),
  };
}

export const buildProjectDocContentGetter = (
  ac: PermissionAccess,
  docReader: DocReader,
  models: Models
) => {
  return async (
    options: CopilotChatOptions,
    sourceWorkspaceId: string,
    docId: string
  ) => {
    if (
      !options?.user ||
      !options.workspace ||
      !options.session ||
      !sourceWorkspaceId ||
      !docId
    ) {
      return toolError(
        'Project Doc Read Failed',
        'Missing host workspace, session, user, source workspace, or document id.'
      );
    }

    const operation = await resolveProjectDocumentOperation({
      ac,
      models,
      actorId: options.user,
      sessionId: options.session,
      sourceWorkspaceId,
      docId,
      operation: 'read',
      approvalGate: 'none',
      expectedHostWorkspaceId: options.workspace,
    });
    const workspace = await models.workspace.get(sourceWorkspaceId);
    if (!workspace) return workspaceSyncRequiredError();

    const docMeta = await models.doc.getAuthors(sourceWorkspaceId, docId);
    if (!docMeta) return documentSyncPendingError(docId);
    const content = await docReader.getDocMarkdown(
      sourceWorkspaceId,
      docId,
      true
    );
    if (!content) return documentSyncPendingError(docId);

    return {
      projectId: operation.projectId,
      sourceWorkspaceId,
      docId,
      title: content.title,
      markdown: content.markdown,
      createdAt: docMeta.createdAt.toISOString(),
      updatedAt: docMeta.updatedAt.toISOString(),
      createdByUser: docMeta.createdByUser,
      updatedByUser: docMeta.updatedByUser,
    };
  };
};

type ProjectDocReadResult = Awaited<
  ReturnType<ReturnType<typeof buildProjectDocContentGetter>>
>;

export const createProjectDocReadTool = (
  getDoc: (
    sourceWorkspaceId: string,
    docId: string
  ) => Promise<ProjectDocReadResult>
) =>
  defineTool({
    description:
      'Read a document using your personal access or a valid grant to the current Project. Pass its actual source workspace and document id. Current membership and document access are checked on every call; grants to other Projects do not apply.',
    inputSchema: z
      .object({
        source_workspace_id: z
          .string()
          .trim()
          .min(1)
          .max(256)
          .describe('The workspace that owns the referenced document'),
        doc_id: z
          .string()
          .trim()
          .min(1)
          .max(256)
          .describe('The referenced document id'),
      })
      .strict(),
    execute: async ({ source_workspace_id, doc_id }) => {
      try {
        const doc = await getDoc(source_workspace_id, doc_id);
        return isToolError(doc) ? doc : { ...doc };
      } catch (error) {
        logger.warn('Project document read was denied or failed', error);
        return toolError(
          'Project Doc Read Failed',
          error instanceof Error
            ? error.message
            : 'Project document read failed'
        );
      }
    },
  });

export const createProjectDocUpdateRequestTool = (input: {
  ac: PermissionAccess;
  models: Models;
  options: CopilotChatOptions;
}) =>
  defineTool({
    description:
      'Create an approval request to replace the body of one document granted to the selected global Project. This tool never writes the document directly. Always pass the source workspace and document id from the Project reference, plus the complete proposed Markdown body.',
    inputSchema: z
      .object({
        source_workspace_id: z
          .string()
          .trim()
          .min(1)
          .max(256)
          .describe('The workspace that owns the referenced document'),
        doc_id: z
          .string()
          .trim()
          .min(1)
          .max(256)
          .describe('The referenced document id'),
        content: z
          .string()
          .min(1)
          .max(6_000)
          .describe('The complete proposed Markdown body, without a title H1'),
        title: z.string().trim().min(1).max(256).optional(),
        reason: z.string().trim().min(1).max(256).optional(),
        idempotency_key: z.string().trim().min(1).max(256).optional(),
      })
      .strict(),
    execute: async request => {
      try {
        if (
          !input.options?.user ||
          !input.options.workspace ||
          !input.options.session
        ) {
          return toolError(
            'Project Doc Update Request Failed',
            'Missing host workspace, session, or user context.'
          );
        }
        const run = await createAgentRuntimeDocUpdateRequest({
          ac: input.ac,
          models: input.models,
          actorId: input.options.user,
          expectedHostWorkspaceId: input.options.workspace,
          requireProject: true,
          request: {
            workspaceId: request.source_workspace_id,
            sessionId: input.options.session,
            docId: request.doc_id,
            content: request.content,
            idempotencyKey: request.idempotency_key,
            title: request.title,
            reason: request.reason,
          },
        });
        return {
          success: true,
          approvalRequired: true,
          runId: run.id,
          status: run.status,
          hostWorkspaceId: run.workspaceId,
          sourceWorkspaceId: request.source_workspace_id,
          docId: request.doc_id,
          message:
            'Document update request created. The document remains unchanged until the user approves it.',
        };
      } catch (error) {
        logger.warn(
          'Project document update request was denied or failed',
          error
        );
        return toolError(
          'Project Doc Update Request Failed',
          error instanceof Error
            ? error.message
            : 'Project document update request failed'
        );
      }
    },
  });
