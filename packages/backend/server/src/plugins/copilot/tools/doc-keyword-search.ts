import { z } from 'zod';

import { SearchProviderNotFound } from '../../../base';
import type { DocReader } from '../../../core/doc';
import type {
  PermissionAccess,
  PermissionService,
} from '../../../core/permission';
import type { Models } from '../../../models';
import type { IndexerService } from '../../indexer';
import { workspaceSyncRequiredError } from './doc-sync';
import { toolError } from './error';
import { resolveAuthorizedProjectDocuments } from './project-doc';
import { defineTool } from './tool';
import type { CopilotChatOptions } from './types';

export const READABLE_DOC_IDS_CACHE_TTL_MS = 10_000;
export const MARKDOWN_KEYWORD_SEARCH_MAX_DOCUMENTS = 200;
const MARKDOWN_SEARCH_BATCH_SIZE = 16;
const MARKDOWN_HIGHLIGHT_CONTEXT = 120;

function isUnreadableDocumentContent(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { code?: unknown }).code;
  return (
    error.message.startsWith('parser_error:') ||
    error.message === 'invalid_binary' ||
    code === 'invalid_binary'
  );
}

export type WorkspaceKeywordSearchResult = {
  sourceWorkspaceId?: string;
  docId: string;
  blockId: string | null;
  title: string;
  highlight: string;
  createdAt: string | null;
  updatedAt: string | null;
  createdByUser?: unknown;
  updatedByUser?: unknown;
};

const projectDocumentKey = (workspaceId: string, docId: string) =>
  `${workspaceId}\0${docId}`;

function isoDate(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function findMarkdownMatch(source: string, query: string) {
  const normalizedSource = source.toLocaleLowerCase();
  const normalizedQuery = query.toLocaleLowerCase();
  const exactIndex = normalizedSource.indexOf(normalizedQuery);
  if (exactIndex >= 0) {
    return { index: exactIndex, length: query.length, exact: true };
  }

  const terms = Array.from(
    new Set(normalizedQuery.split(/\s+/).filter(term => term.length > 0))
  );
  const termIndexes = terms.map(term => normalizedSource.indexOf(term));
  if (!terms.length || termIndexes.some(index => index < 0)) {
    return null;
  }

  const firstTermIndex = Math.min(...termIndexes);
  const firstTerm = terms[termIndexes.indexOf(firstTermIndex)];
  return { index: firstTermIndex, length: firstTerm.length, exact: false };
}

function markdownHighlight(source: string, index: number, length: number) {
  const start = Math.max(0, index - MARKDOWN_HIGHLIGHT_CONTEXT);
  const end = Math.min(
    source.length,
    index + length + MARKDOWN_HIGHLIGHT_CONTEXT
  );
  const matchStart = index - start;
  const matchEnd = matchStart + length;
  const snippet = source.slice(start, end);
  return `${start > 0 ? '...' : ''}${snippet.slice(
    0,
    matchStart
  )}<b>${snippet.slice(matchStart, matchEnd)}</b>${snippet.slice(matchEnd)}${
    end < source.length ? '...' : ''
  }`;
}

export const createReadableDocIdsLoader = (
  permission: PermissionService,
  ttlMs = READABLE_DOC_IDS_CACHE_TTL_MS
) => {
  const cache = new Map<
    string,
    { expiresAt: number; promise: Promise<string[]> }
  >();
  return (input: {
    userId: string;
    workspaceId: string;
    projectId?: string | null;
  }) => {
    const key = JSON.stringify([
      input.userId,
      input.workspaceId,
      input.projectId === undefined ? { all: true } : input.projectId,
    ]);
    const existing = cache.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      return existing.promise;
    }
    const entry = {
      expiresAt: Date.now() + Math.max(ttlMs, 0),
      promise: permission.listReadableDocIds(input),
    };
    cache.set(key, entry);
    entry.promise = entry.promise.catch(error => {
      if (cache.get(key) === entry) cache.delete(key);
      throw error;
    });
    return entry.promise;
  };
};

async function searchReadableMarkdown(input: {
  ac: PermissionAccess;
  models: Models;
  docReader: DocReader;
  logger: Pick<Console, 'debug'>;
  workspaceId: string;
  userId: string;
  docIds: string[];
  projectId?: string | null;
  query: string;
  limit: number;
}): Promise<WorkspaceKeywordSearchResult[]> {
  const timestamps = await input.models.doc.findTimestampsByDocIds(
    input.workspaceId,
    input.docIds
  );
  const boundedDocIds = input.docIds
    .map(docId => ({ docId, updatedAt: timestamps[docId] ?? 0 }))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MARKDOWN_KEYWORD_SEARCH_MAX_DOCUMENTS)
    .map(item => item.docId);
  const matches: Array<
    WorkspaceKeywordSearchResult & { exact: boolean; titleMatch: boolean }
  > = [];

  for (
    let offset = 0;
    offset < boundedDocIds.length;
    offset += MARKDOWN_SEARCH_BATCH_SIZE
  ) {
    const batch = boundedDocIds.slice(
      offset,
      offset + MARKDOWN_SEARCH_BATCH_SIZE
    );
    const batchMatches = await Promise.all(
      batch.map(async docId => {
        const readable = await input.ac
          .user(input.userId)
          .workspace(input.workspaceId)
          .doc(docId)
          .projectScope(input.projectId ?? null)
          .can('Doc.Read');
        if (!readable) return null;
        let content;
        try {
          content = await input.docReader.getDocMarkdown(
            input.workspaceId,
            docId,
            false
          );
        } catch (error) {
          if (!isUnreadableDocumentContent(error)) throw error;
          input.logger.debug(
            `Skipping unreadable document ${docId} during fallback keyword search.`
          );
          return null;
        }
        if (!content) return null;
        const source = `${content.title}\n${content.markdown}`;
        const match = findMarkdownMatch(source, input.query);
        if (!match) return null;
        return {
          docId,
          blockId: null,
          title: content.title,
          highlight: markdownHighlight(source, match.index, match.length),
          exact: match.exact,
          titleMatch: findMarkdownMatch(content.title, input.query) !== null,
          createdAt: null,
          updatedAt: timestamps[docId]
            ? new Date(timestamps[docId]).toISOString()
            : null,
        };
      })
    );
    matches.push(...batchMatches.filter(match => match !== null));
  }

  return matches
    .toSorted(
      (left, right) =>
        Number(right.exact) - Number(left.exact) ||
        Number(right.titleMatch) - Number(left.titleMatch) ||
        (timestamps[right.docId] ?? 0) - (timestamps[left.docId] ?? 0)
    )
    .slice(0, input.limit)
    .map(({ exact: _exact, titleMatch: _titleMatch, ...match }) => match);
}

export const buildDocKeywordSearchGetter = (
  ac: PermissionAccess,
  permission: PermissionService,
  indexerService: IndexerService,
  models: Models,
  docReader: DocReader,
  logger: Pick<Console, 'debug' | 'warn'> = console
) => {
  const loadReadableDocIds = createReadableDocIdsLoader(permission, 0);
  const searchDocs = async (
    options: CopilotChatOptions,
    query?: string,
    limit = 20
  ) => {
    const queryTrimmed = query?.trim();
    if (!options || !queryTrimmed || !options.user || !options.workspace) {
      return toolError(
        'Doc Keyword Search Failed',
        'Missing workspace, user, or query for doc_keyword_search.'
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
    if (!canAccess) {
      return toolError(
        'Doc Keyword Search Failed',
        'You do not have permission to access this workspace.'
      );
    }
    const docIds = await loadReadableDocIds({
      userId: options.user,
      workspaceId: options.workspace,
      projectId: null,
    });
    try {
      const docs = await indexerService.searchDocsByKeyword(
        options.workspace,
        queryTrimmed,
        { docIds, limit }
      );

      const readableDocs = await ac
        .user(options.user)
        .workspace(options.workspace)
        .projectScope(null)
        .docs(docs, 'Doc.Read');
      return (readableDocs ?? []).map(doc => ({
        docId: doc.docId,
        blockId: doc.blockId,
        title: doc.title,
        highlight: doc.highlight,
        createdAt: isoDate(doc.createdAt),
        updatedAt: isoDate(doc.updatedAt),
        createdByUser: doc.createdByUser,
        updatedByUser: doc.updatedByUser,
      }));
    } catch (error) {
      const reason =
        error instanceof SearchProviderNotFound
          ? 'not configured'
          : error instanceof Error
            ? error.name
            : 'unknown error';
      logger.warn(
        `Workspace keyword index is unavailable (${reason}); using bounded permission-filtered Markdown search.`
      );
      return await searchReadableMarkdown({
        ac,
        models,
        docReader,
        logger,
        workspaceId: options.workspace,
        userId: options.user,
        docIds,
        query: queryTrimmed,
        limit: Math.min(Math.max(limit, 1), 100),
      });
    }
  };
  return searchDocs;
};

export const buildProjectDocKeywordSearchGetter = (
  ac: PermissionAccess,
  indexerService: IndexerService,
  models: Models,
  docReader: DocReader,
  logger: Pick<Console, 'debug' | 'warn'> = console
) => {
  return async (options: CopilotChatOptions, query?: string, limit = 20) => {
    const queryTrimmed = query?.trim();
    if (!options || !queryTrimmed) {
      return toolError(
        'Project Doc Keyword Search Failed',
        'Missing query for project document search.'
      );
    }
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
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

    let matches: WorkspaceKeywordSearchResult[];
    try {
      matches = (
        await Promise.all(
          [...documentsByWorkspace].map(async ([workspaceId, docIds]) => {
            const scopedDocIds = new Set(docIds);
            const docs = await indexerService.searchDocsByKeyword(
              workspaceId,
              queryTrimmed,
              { docIds, limit: boundedLimit }
            );
            return docs
              .filter(doc => scopedDocIds.has(doc.docId))
              .map(doc => ({
                sourceWorkspaceId: workspaceId,
                docId: doc.docId,
                blockId: doc.blockId,
                title: doc.title,
                highlight: doc.highlight,
                createdAt: isoDate(doc.createdAt),
                updatedAt: isoDate(doc.updatedAt),
                createdByUser: doc.createdByUser,
                updatedByUser: doc.updatedByUser,
              }));
          })
        )
      ).flat();
    } catch (error) {
      const reason =
        error instanceof SearchProviderNotFound
          ? 'not configured'
          : error instanceof Error
            ? error.name
            : 'unknown error';
      logger.warn(
        `Project keyword index is unavailable (${reason}); using bounded permission-filtered Markdown search.`
      );
      const timestampGroups = await Promise.all(
        [...documentsByWorkspace].map(async ([workspaceId, docIds]) => ({
          workspaceId,
          timestamps: await models.doc.findTimestampsByDocIds(
            workspaceId,
            docIds
          ),
        }))
      );
      const timestampByDocument = new Map<string, number>();
      for (const group of timestampGroups) {
        for (const [docId, timestamp] of Object.entries(group.timestamps)) {
          timestampByDocument.set(
            projectDocumentKey(group.workspaceId, docId),
            timestamp
          );
        }
      }
      const boundedDocuments = initialScope.documents
        .toSorted(
          (left, right) =>
            (timestampByDocument.get(
              projectDocumentKey(right.workspaceId, right.docId)
            ) ?? 0) -
            (timestampByDocument.get(
              projectDocumentKey(left.workspaceId, left.docId)
            ) ?? 0)
        )
        .slice(0, MARKDOWN_KEYWORD_SEARCH_MAX_DOCUMENTS);
      const boundedByWorkspace = new Map<string, string[]>();
      for (const document of boundedDocuments) {
        const docIds = boundedByWorkspace.get(document.workspaceId) ?? [];
        docIds.push(document.docId);
        boundedByWorkspace.set(document.workspaceId, docIds);
      }
      matches = (
        await Promise.all(
          [...boundedByWorkspace].map(async ([workspaceId, docIds]) => {
            const docs = await searchReadableMarkdown({
              ac,
              models,
              docReader,
              logger,
              workspaceId,
              userId: options.user as string,
              projectId: initialScope.projectId,
              docIds,
              query: queryTrimmed,
              limit: boundedLimit,
            });
            return docs.map(doc => ({
              ...doc,
              sourceWorkspaceId: workspaceId,
            }));
          })
        )
      ).flat();
    }

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
    return matches
      .filter(
        match =>
          !!match.sourceWorkspaceId &&
          currentlyAuthorized.has(
            projectDocumentKey(match.sourceWorkspaceId, match.docId)
          )
      )
      .toSorted((left, right) => {
        const leftUpdated = left.updatedAt
          ? new Date(left.updatedAt).getTime()
          : 0;
        const rightUpdated = right.updatedAt
          ? new Date(right.updatedAt).getTime()
          : 0;
        return rightUpdated - leftUpdated;
      })
      .slice(0, boundedLimit);
  };
};

export const createDocKeywordSearchTool = (
  searchDocs: (
    query: string,
    limit?: number
  ) => Promise<WorkspaceKeywordSearchResult[] | ReturnType<typeof toolError>>
) => {
  return defineTool({
    description:
      'Fuzzy search all workspace documents for the exact keyword or phrase supplied and return passages ranked by textual match. Use this tool by default whenever a straightforward term-based or keyword-base lookup is sufficient.',
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'The query to search for, e.g. "meeting notes" or "project plan".'
        ),
      limit: z.number().int().min(1).max(100).default(20),
    }),
    execute: async ({ query, limit }) => {
      try {
        const docs = await searchDocs(query, limit);
        if (!Array.isArray(docs)) {
          return docs;
        }
        return docs.map(doc => ({
          docId: doc.docId,
          title: doc.title,
          blockId: doc.blockId,
          highlight: doc.highlight,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          createdByUser: doc.createdByUser,
          updatedByUser: doc.updatedByUser,
        }));
      } catch (e: any) {
        return toolError('Doc Keyword Search Failed', e.message);
      }
    },
  });
};

export const createProjectDocKeywordSearchTool = (
  searchDocs: (
    query: string,
    limit?: number
  ) => Promise<WorkspaceKeywordSearchResult[] | ReturnType<typeof toolError>>
) =>
  defineTool({
    description:
      'Search only documents currently granted to the selected global Project. Results retain each source workspace and document id, and the total result count is bounded by limit.',
    inputSchema: z
      .object({
        query: z.string().trim().min(1),
        limit: z.number().int().min(1).max(100).default(20),
      })
      .strict(),
    execute: async ({ query, limit }) => {
      try {
        const docs = await searchDocs(query, limit);
        if (!Array.isArray(docs)) return docs;
        return docs.map(doc => ({
          sourceWorkspaceId: doc.sourceWorkspaceId,
          docId: doc.docId,
          title: doc.title,
          blockId: doc.blockId,
          highlight: doc.highlight,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          createdByUser: doc.createdByUser,
          updatedByUser: doc.updatedByUser,
        }));
      } catch (error) {
        return toolError(
          'Project Doc Keyword Search Failed',
          error instanceof Error
            ? error.message
            : 'Project document keyword search failed'
        );
      }
    },
  });
