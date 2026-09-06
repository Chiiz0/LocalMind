import { omit } from 'lodash-es';
import { z } from 'zod';

import type { PermissionAccess } from '../../../core/permission';
import {
  type ChunkSimilarity,
  clearEmbeddingChunk,
  type Models,
} from '../../../models';
import { CopilotContextService } from '../context/service';
import { workspaceSyncRequiredError } from './doc-sync';
import { toolError } from './error';
import { resolveAuthorizedProjectDocuments } from './project-doc';
import { defineTool } from './tool';
import type { CopilotChatOptions } from './types';

const getEmbeddingRouteContext = (options: CopilotChatOptions) => ({
  userId: options?.user,
  byokLeaseId: options?.byokLeaseId,
});

const projectDocumentKey = (workspaceId: string, docId: string) =>
  `${workspaceId}\0${docId}`;

export const buildDocSearchGetter = (
  ac: PermissionAccess,
  context: CopilotContextService,
  sessionId: string | undefined,
  models: Models
) => {
  const searchDocs = async (
    options: CopilotChatOptions,
    query?: string,
    signal?: AbortSignal
  ) => {
    if (!options || !query?.trim() || !options.user || !options.workspace) {
      return toolError(
        'Doc Semantic Search Failed',
        'Missing workspace, user, or query for doc_semantic_search.'
      );
    }
    const workspace = await models.workspace.get(options.workspace);
    if (!workspace) {
      return workspaceSyncRequiredError();
    }
    const canAccess = await ac
      .user(options.user)
      .workspace(options.workspace)
      .can('Workspace.Read');
    if (!canAccess)
      return toolError(
        'Doc Semantic Search Failed',
        'You do not have permission to access this workspace.'
      );
    const routeContext = getEmbeddingRouteContext(options);
    const [chunks, contextChunks] = await Promise.all([
      context.matchWorkspaceAll(
        options.workspace,
        query,
        10,
        signal,
        0.8,
        undefined,
        0.85,
        routeContext
      ),
      sessionId
        ? context
            .getOwnedBySessionId(options.user, sessionId, options.workspace)
            .then(
              current =>
                current?.matchFiles(
                  query,
                  10,
                  signal,
                  0.85,
                  0.5,
                  routeContext
                ) ?? []
            )
        : [],
    ]);

    const docChunks = await ac
      .user(options.user)
      .workspace(options.workspace)
      .projectScope(null)
      .docs(
        chunks.filter(c => 'docId' in c),
        'Doc.Read'
      );
    const blobChunks = chunks.filter(c => 'blobId' in c);
    const fileChunks = chunks.filter(c => 'fileId' in c);
    if (contextChunks.length) {
      fileChunks.push(...contextChunks);
    }
    if (!blobChunks.length && !docChunks.length && !fileChunks.length) {
      return [];
    }

    const docIds = docChunks.map(c => ({
      // oxlint-disable-next-line no-non-null-assertion
      workspaceId: options.workspace!,
      docId: c.docId,
    }));
    const docAuthors = await models.doc
      .findAuthors(docIds)
      .then(
        docs =>
          new Map(
            docs
              .filter(d => !!d)
              .map(doc => [doc.id, omit(doc, ['id', 'workspaceId'])])
          )
      );
    const docMetas = await models.doc
      .findMetas(docIds, { select: { title: true } })
      .then(
        docs =>
          new Map(
            docs
              .filter(d => !!d)
              .map(doc => [
                doc.docId,
                Object.assign({}, doc, docAuthors.get(doc.docId)),
              ])
          )
      );

    return [
      ...fileChunks.map(clearEmbeddingChunk),
      ...blobChunks.map(clearEmbeddingChunk),
      ...docChunks.map(c => ({
        ...c,
        ...docMetas.get(c.docId),
      })),
    ] as ChunkSimilarity[];
  };
  return searchDocs;
};

export const createDocSemanticSearchTool = (
  searchDocs: (
    query: string,
    signal?: AbortSignal
  ) => Promise<ChunkSimilarity[] | ReturnType<typeof toolError>>
) => {
  return defineTool({
    description:
      'Retrieve conceptually related passages by performing vector-based semantic similarity search across embedded documents; use this tool only when exact keyword search fails or the user explicitly needs meaning-level matches (e.g., paraphrases, synonyms, broader concepts, recent documents).',
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'The query statement to search for, e.g. "What is the capital of France?"\nWhen querying specific terms or IDs, you should provide the complete string instead of separating it with delimiters.\nFor example, if a user wants to look up the ID "sicDoe1is", use "What is sicDoe1is" instead of "si code 1is".'
        ),
    }),
    execute: async ({ query }, options) => {
      try {
        return await searchDocs(query, options.signal);
      } catch (e: any) {
        return toolError('Doc Semantic Search Failed', e.message);
      }
    },
  });
};

export const buildProjectDocSearchGetter = (
  ac: PermissionAccess,
  context: CopilotContextService,
  models: Models
) => {
  return async (
    options: CopilotChatOptions,
    query?: string,
    signal?: AbortSignal
  ) => {
    if (!options || !query?.trim()) {
      return toolError(
        'Project Doc Semantic Search Failed',
        'Missing query for project document search.'
      );
    }
    const initialScope = await resolveAuthorizedProjectDocuments({
      ac,
      models,
      options,
    });
    const documentsByWorkspace = new Map<string, string[]>();
    for (const document of initialScope.documents) {
      const docIds = documentsByWorkspace.get(document.workspaceId) ?? [];
      docIds.push(document.docId);
      documentsByWorkspace.set(document.workspaceId, docIds);
    }
    const routeContext = getEmbeddingRouteContext(options);
    const matches = (
      await Promise.all(
        [...documentsByWorkspace].map(async ([workspaceId, docIds]) => {
          const chunks = await context.matchWorkspaceProjectDocs(
            workspaceId,
            docIds,
            query,
            10,
            signal,
            0.8,
            routeContext,
            initialScope.projectId
          );
          return chunks.map(chunk => ({
            ...chunk,
            sourceWorkspaceId: workspaceId,
          }));
        })
      )
    ).flat();

    const currentScope = await resolveAuthorizedProjectDocuments({
      ac,
      models,
      options,
    });
    if (currentScope.projectId !== initialScope.projectId) {
      throw new Error('Project selection changed during document search');
    }
    const currentlyAuthorized = new Set(
      currentScope.documents.map(document =>
        projectDocumentKey(document.workspaceId, document.docId)
      )
    );
    const authorizedMatches = matches
      .filter(match =>
        currentlyAuthorized.has(
          projectDocumentKey(match.sourceWorkspaceId, match.docId)
        )
      )
      .toSorted(
        (left, right) =>
          (left.distance ?? Number.POSITIVE_INFINITY) -
          (right.distance ?? Number.POSITIVE_INFINITY)
      )
      .slice(0, 10);
    if (!authorizedMatches.length) return [];

    const refs = authorizedMatches.map(match => ({
      workspaceId: match.sourceWorkspaceId,
      docId: match.docId,
    }));
    const [authors, metas] = await Promise.all([
      models.doc.findAuthors(refs),
      models.doc.findMetas(refs, { select: { title: true } }),
    ]);
    const authorByDocument = new Map(
      authors
        .filter(author => !!author)
        .map(author => [
          projectDocumentKey(author.workspaceId, author.id),
          omit(author, ['id', 'workspaceId']),
        ])
    );
    const metaByDocument = new Map(
      metas
        .filter(meta => !!meta)
        .map(meta => [projectDocumentKey(meta.workspaceId, meta.docId), meta])
    );
    return authorizedMatches.map(match => {
      const key = projectDocumentKey(match.sourceWorkspaceId, match.docId);
      return {
        ...clearEmbeddingChunk(match),
        ...metaByDocument.get(key),
        ...authorByDocument.get(key),
        sourceWorkspaceId: match.sourceWorkspaceId,
      };
    });
  };
};

export const createProjectDocSemanticSearchTool = (
  searchDocs: (
    query: string,
    signal?: AbortSignal
  ) => Promise<ChunkSimilarity[] | ReturnType<typeof toolError>>
) =>
  defineTool({
    description:
      'Search only documents currently granted to the selected global Project. Results retain each source workspace and document id, and authorization is checked again before results are returned.',
    inputSchema: z
      .object({
        query: z.string().trim().min(1),
      })
      .strict(),
    execute: async ({ query }, options) => {
      try {
        return await searchDocs(query, options.signal);
      } catch (error) {
        return toolError(
          'Project Doc Semantic Search Failed',
          error instanceof Error
            ? error.message
            : 'Project document semantic search failed'
        );
      }
    },
  });
