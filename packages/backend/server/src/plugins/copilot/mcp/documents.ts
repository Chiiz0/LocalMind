import { Logger } from '@nestjs/common';
import { z } from 'zod';

import type {
  DocReader,
  DocWriter,
  StructuredDocService,
} from '../../../core/doc';
import type {
  PermissionAccess,
  PermissionService,
} from '../../../core/permission';
import { clearEmbeddingChunk, type Models } from '../../../models';
import type { IndexerService } from '../../indexer';
import type { CopilotContextService } from '../context/service';
import {
  buildDocKeywordSearchGetter,
  createReadableDocIdsLoader,
} from '../tools/doc-keyword-search';
import { createStructuredDocumentMcpTools } from './structured-document-tools';
import {
  abortIfNeeded,
  defineTool,
  DESTRUCTIVE_WRITE_TOOL,
  READ_ONLY_TOOL,
  RESULT_OUTPUT_SCHEMA,
  toolError,
  toolResult,
  type WorkspaceMcpResourceContents,
  type WorkspaceMcpToolDefinition,
  WRITE_TOOL,
} from './types';

type DocumentToolDependencies = {
  ac: PermissionAccess;
  permission: PermissionService;
  reader: DocReader;
  writer: DocWriter;
  structured: StructuredDocService;
  context: CopilotContextService;
  indexer: IndexerService;
  models: Models;
  logger: Logger;
};

export function createDocumentMcpSurface(
  dependencies: DocumentToolDependencies,
  userId: string,
  workspaceId: string
) {
  const {
    ac,
    context,
    indexer,
    logger,
    models,
    permission,
    reader,
    structured,
    writer,
  } = dependencies;
  const loadReadableDocIds = createReadableDocIdsLoader(permission);
  const keywordSearch = buildDocKeywordSearchGetter(
    ac,
    permission,
    indexer,
    models,
    reader,
    logger
  );
  const structuredTools = createStructuredDocumentMcpTools(
    { ac, logger, structured, models, writer },
    userId,
    workspaceId
  );

  const listDocuments = async (limit = 50, offset = 0) => {
    const readableDocIds = await loadReadableDocIds({ userId, workspaceId });
    const timestamps = await models.doc.findTimestampsByDocIds(
      workspaceId,
      readableDocIds
    );
    const selectedIds = readableDocIds
      .map(docId => ({ docId, updatedAt: timestamps[docId] ?? 0 }))
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(offset, offset + limit);
    const metas = await models.doc.findMetas(
      selectedIds.map(({ docId }) => ({ workspaceId, docId })),
      { select: { title: true, summary: true, mode: true } }
    );
    const metadataById = new Map(
      metas.flatMap(meta => (meta ? [[meta.docId, meta] as const] : []))
    );
    return {
      documents: selectedIds.map(({ docId, updatedAt }) => {
        const meta = metadataById.get(docId);
        return {
          docId,
          title: meta?.title ?? '',
          summary: meta?.summary ?? null,
          mode: meta?.mode ?? null,
          updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
        };
      }),
      total: readableDocIds.length,
      limit,
      offset,
    };
  };

  const readDocumentContent = async (docId: string) => {
    const accessible = await ac
      .user(userId)
      .workspace(workspaceId)
      .doc(docId)
      .can('Doc.Read');
    if (!accessible) return null;
    return await reader.getDocMarkdown(workspaceId, docId, false);
  };

  const readTools: WorkspaceMcpToolDefinition[] = [
    ...structuredTools.readTools,
    defineTool({
      name: 'list_documents',
      title: 'List Documents',
      description:
        'List readable workspace documents ordered by most recently updated.',
      parser: z
        .object({
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL,
      execute: async ({ limit, offset }) =>
        toolResult(await listDocuments(limit, offset)),
    }),
    defineTool({
      name: 'read_document',
      title: 'Read Document',
      description: 'Read an authorized workspace document as Markdown.',
      parser: z.object({ docId: z.string().min(1) }).strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL,
      execute: async ({ docId }, options) => {
        const content = await readDocumentContent(docId);
        if (!content) return toolError(`Doc with id ${docId} not found.`);
        const aborted = abortIfNeeded(options.signal);
        if (aborted) return aborted;
        return toolResult(
          { docId, markdown: content.markdown },
          content.markdown
        );
      },
    }),
    defineTool({
      name: 'semantic_search',
      title: 'Semantic Search',
      description:
        'Find conceptually related passages across readable embedded workspace documents. Prefer keyword_search for exact terms.',
      parser: z
        .object({
          query: z.string().min(1),
          limit: z.number().int().min(1).max(20).default(5),
        })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL,
      execute: async ({ query, limit }, options) => {
        const chunks = await context.matchWorkspaceDocs(
          workspaceId,
          query.trim(),
          limit,
          options.signal,
          undefined,
          { userId }
        );
        const readableChunks = await ac
          .user(userId)
          .workspace(workspaceId)
          .docs(
            chunks.filter(chunk => 'docId' in chunk),
            'Doc.Read'
          );
        const results = readableChunks.map(chunk => {
          const clean = clearEmbeddingChunk(chunk);
          return {
            docId: 'docId' in clean ? clean.docId : null,
            chunk: clean.chunk,
            content: clean.content,
            distance: clean.distance,
          };
        });
        return toolResult({ results }, JSON.stringify(results));
      },
    }),
    defineTool({
      name: 'keyword_search',
      title: 'Keyword Search',
      description:
        'Search readable workspace documents for an exact or fuzzy term and return the matched block and highlight.',
      parser: z
        .object({
          query: z.string().min(1),
          limit: z.number().int().min(1).max(100).default(20),
        })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL,
      execute: async ({ query, limit }) => {
        const results = await keywordSearch(
          { user: userId, workspace: workspaceId },
          query,
          limit
        );
        if (!Array.isArray(results)) return toolError(results.message);
        return toolResult({ results }, JSON.stringify(results));
      },
    }),
  ];

  const writeTools: WorkspaceMcpToolDefinition[] = [
    ...structuredTools.writeTools,
    defineTool({
      name: 'create_document',
      title: 'Create Document',
      description:
        'Document creation requires human location confirmation. Use delegate_to_localmind to create a durable task that waits for the user to select a workspace and root or folder.',
      parser: z
        .object({ title: z.string().min(1), content: z.string() })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: WRITE_TOOL,
      execute: async () =>
        toolError(
          'Document location confirmation is required. Use delegate_to_localmind; no document has been created.'
        ),
    }),
    defineTool({
      name: 'update_document',
      title: 'Update Document',
      description:
        'Replace a document body with Markdown while preserving document history. This does not update the title.',
      parser: z
        .object({ docId: z.string().min(1), content: z.string() })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: { ...DESTRUCTIVE_WRITE_TOOL, idempotentHint: true },
      execute: async ({ docId, content }) => {
        const accessible = await ac
          .user(userId)
          .workspace(workspaceId)
          .doc(docId)
          .can('Doc.Update');
        if (!accessible) return toolError(`Doc with id ${docId} not found.`);
        try {
          await writer.updateDoc(workspaceId, docId, content, userId, () =>
            models.copilotContext.assertDocumentSourcesShared({
              actorId: userId,
              sink: {
                type: 'document_update',
                id: docId,
                documentId: docId,
                workspaceId,
                phase: 'execute',
              },
            })
          );
          return toolResult({ success: true, docId });
        } catch (error) {
          logger.error(
            'Failed to update document through MCP',
            error instanceof Error ? error.stack : String(error)
          );
          return toolError('Failed to update document.');
        }
      },
    }),
    defineTool({
      name: 'update_document_meta',
      title: 'Update Document Metadata',
      description: 'Update document metadata. Currently only title is mutable.',
      parser: z
        .object({ docId: z.string().min(1), title: z.string().min(1) })
        .strict(),
      outputSchema: RESULT_OUTPUT_SCHEMA,
      annotations: { ...DESTRUCTIVE_WRITE_TOOL, idempotentHint: true },
      execute: async ({ docId, title }) => {
        const accessible = await ac
          .user(userId)
          .workspace(workspaceId)
          .doc(docId)
          .can('Doc.Update');
        if (!accessible) return toolError(`Doc with id ${docId} not found.`);
        try {
          const sanitizedTitle = title.replace(/[\r\n]+/g, ' ').trim();
          if (!sanitizedTitle) return toolError('Title cannot be empty.');
          await writer.updateDocMeta(
            workspaceId,
            docId,
            { title: sanitizedTitle },
            userId,
            () =>
              models.copilotContext.assertDocumentSourcesShared({
                actorId: userId,
                sink: {
                  type: 'document_update',
                  id: docId,
                  documentId: docId,
                  workspaceId,
                  phase: 'execute',
                },
              })
          );
          return toolResult({ success: true, docId });
        } catch (error) {
          logger.error(
            'Failed to update document metadata through MCP',
            error instanceof Error ? error.stack : String(error)
          );
          return toolError('Failed to update document metadata.');
        }
      },
    }),
  ];

  const resourcePrefix = `localmind://workspace/${encodeURIComponent(
    workspaceId
  )}/documents/`;

  const listResources = async (cursor?: string) => {
    if (cursor !== undefined && !/^\d+$/.test(cursor)) return null;
    const offset = cursor === undefined ? 0 : Number(cursor);
    if (!Number.isSafeInteger(offset)) return null;

    const page = await listDocuments(100, offset);
    const nextOffset = offset + page.documents.length;
    return {
      resources: page.documents.map(document => ({
        uri: `${resourcePrefix}${encodeURIComponent(document.docId)}`,
        name: document.docId,
        title: document.title || document.docId,
        description: document.summary ?? undefined,
        mimeType: 'text/markdown',
      })),
      ...(nextOffset < page.total ? { nextCursor: String(nextOffset) } : {}),
    };
  };

  const readResource = async (
    uri: string
  ): Promise<WorkspaceMcpResourceContents | null> => {
    if (!uri.startsWith(resourcePrefix)) return null;
    const encodedDocId = uri.slice(resourcePrefix.length);
    if (!encodedDocId || encodedDocId.includes('/')) return null;
    let docId: string;
    try {
      docId = decodeURIComponent(encodedDocId);
    } catch {
      return null;
    }
    const content = await readDocumentContent(docId);
    if (!content) return null;
    return { uri, mimeType: 'text/markdown', text: content.markdown };
  };

  return {
    readTools,
    writeTools,
    listResources,
    readResource,
    resourceTemplate: {
      uriTemplate: `${resourcePrefix}{docId}`,
      name: 'workspace-document',
      title: 'Workspace document',
      description: 'Read an authorized LocalMind workspace document by ID.',
      mimeType: 'text/markdown',
    },
  };
}
