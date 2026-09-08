import { TransactionHost } from '@nestjs-cls/transactional';
import { Prisma } from '@prisma/client';
import test from 'ava';
import Sinon from 'sinon';

import { BadRequest } from '../../base';
import type {
  PermissionAccess,
  PermissionService,
} from '../../core/permission';
import type { Models } from '../../models';
import { CopilotContextService } from '../../plugins/copilot/context';
import { CopilotContextMemoryResolver } from '../../plugins/copilot/context-memory-resolver';
import type { EmbeddingClient } from '../../plugins/copilot/embedding';

test.before(() => {
  Sinon.stub(TransactionHost, 'getInstance').returns({
    withTransaction: (...args: unknown[]) => {
      const callback = args.at(-1);
      if (typeof callback !== 'function') {
        throw new TypeError('Transactional test callback is required');
      }
      return callback();
    },
  } as never);
});

test.after.always(() => {
  Sinon.restore();
});

function permissionAccess(
  assertPermission: (permission: string) => Promise<void> = async () => {}
) {
  const chain = {
    allowLocal: () => chain,
    assert: assertPermission,
    can: async () => true,
    docs: async <T>(documents: T[]) => documents,
    doc: () => chain,
    workspace: () => chain,
  };
  return { user: () => chain } as unknown as PermissionAccess;
}

function workbenchModels() {
  return {
    intelligenceWorkbenchAuthorization: {
      listAccessRequests: async () => [],
    },
    user: {
      getWorkspaceUsers: async () => [],
    },
  } as unknown as Models;
}

test('owned context rechecks live access before using cached configuration', async t => {
  let allowed = true;
  const service = new CopilotContextService(
    {} as never,
    {} as never,
    {
      copilotContext: {
        getBySessionId: async (sessionId: string) => {
          t.is(sessionId, 'session-1');
          return { id: 'context-1' };
        },
        getAccessInfo: async (contextId: string, userId: string) => {
          t.is(contextId, 'context-1');
          t.is(userId, 'user-1');
          return allowed
            ? {
                sessionId: 'session-1',
                session: { userId, workspaceId: 'workspace-1' },
              }
            : null;
        },
      },
    } as never,
    {} as never
  );
  const cached = Sinon.stub(service, 'get').resolves({} as never);
  await service.getOwnedContext('user-1', 'context-1', {
    workspaceId: 'workspace-1',
    sessionId: 'session-1',
  });
  t.is(cached.callCount, 1);
  await t.throwsAsync(
    service.getOwnedContext('user-1', 'context-1', {
      sessionId: 'another-session',
    })
  );
  await t.throwsAsync(
    service.getOwnedContext('user-1', 'context-1', {
      workspaceId: 'another-workspace',
    })
  );
  allowed = false;
  await t.throwsAsync(service.getOwnedContext('user-1', 'context-1'));
  await t.throwsAsync(
    service.getOwnedBySessionId('user-1', 'session-1', 'workspace-1')
  );
  t.is(cached.callCount, 1);
});

test('document context checks personal read access before cached attachments', async t => {
  let readable = true;
  const service = new CopilotContextService(
    {} as never,
    {} as never,
    {
      copilotContext: {
        getAccessInfo: async () => ({
          sessionId: 'session-1',
          session: {
            userId: 'user-1',
            workspaceId: 'workspace-1',
            docId: 'doc-1',
          },
        }),
      },
    } as never,
    {
      canDoc: async (input: Record<string, unknown>) => {
        t.like(input, {
          userId: 'user-1',
          workspaceId: 'workspace-1',
          docId: 'doc-1',
          projectId: null,
          action: 'Doc.Read',
        });
        return readable;
      },
    } as never
  );
  const cached = Sinon.stub(service, 'get').resolves({} as never);
  await service.getOwnedContext('user-1', 'context-1');
  readable = false;
  await t.throwsAsync(service.getOwnedContext('user-1', 'context-1'));
  t.is(cached.callCount, 1);
});

test('workspace semantic search applies Doc.Read before reranking', async t => {
  const readablePredicate = Prisma.sql`TRUE`;
  const rerankedDocIds: string[] = [];
  const client = {
    getEmbedding: async () => [1],
    reRank: async (
      _query: string,
      chunks: Array<{ docId?: string }>,
      topK: number
    ) => {
      rerankedDocIds.push(
        ...chunks.flatMap(chunk => (chunk.docId ? [chunk.docId] : []))
      );
      return chunks.slice(0, topK);
    },
  } as unknown as EmbeddingClient;
  const permission = {
    docReadableSqlPredicate: (input: {
      userId: string;
      projectId?: string | null;
    }) => {
      t.is(input.userId, 'user-1');
      t.is(input.projectId, null);
      return readablePredicate;
    },
  } as unknown as PermissionService;
  const models = {
    copilotContext: {
      matchWorkspaceEmbedding: async (
        _embedding: number[],
        _workspaceId: string,
        _topK: number,
        _threshold: number,
        predicate: Prisma.Sql
      ) =>
        predicate === readablePredicate
          ? [
              {
                docId: 'readable-doc',
                chunk: 0,
                content: 'readable',
                distance: 0,
              },
            ]
          : [
              {
                docId: 'hidden-doc',
                chunk: 0,
                content: 'hidden',
                distance: 0,
              },
            ],
    },
    copilotWorkspace: {
      matchFileEmbedding: async () => [],
      matchBlobEmbedding: async () => [],
    },
  } as unknown as Models;
  const context = new CopilotContextService(
    { getClient: () => client } as never,
    {} as never,
    models,
    permission
  );

  const result = await context.matchWorkspaceAll(
    'workspace-1',
    'query',
    10,
    undefined,
    0.8,
    undefined,
    0.85,
    { userId: 'user-1' }
  );

  t.deepEqual(rerankedDocIds, ['readable-doc']);
  t.deepEqual(
    result.map(chunk => ('docId' in chunk ? chunk.docId : undefined)),
    ['readable-doc']
  );
});

test('project semantic search passes the trusted project scope before reranking', async t => {
  const predicate = Prisma.sql`TRUE`;
  const context = new CopilotContextService(
    {
      getClient: () => ({ getEmbedding: async () => [1] }),
    } as never,
    {} as never,
    {
      copilotContext: {
        matchWorkspaceEmbedding: async (
          _embedding: number[],
          _workspaceId: string,
          _topK: number,
          _threshold: number,
          actualPredicate: Prisma.Sql,
          _matchDocIds: string[],
          restrictDocIds: string[]
        ) => {
          t.is(actualPredicate, predicate);
          t.deepEqual(restrictDocIds, ['granted-doc']);
          return [];
        },
      },
    } as never,
    {
      docReadableSqlPredicate: (input: { projectId?: string | null }) => {
        t.is(input.projectId, 'selected-project');
        return predicate;
      },
    } as never
  );
  await context.matchWorkspaceProjectDocs(
    'source-workspace',
    ['granted-doc'],
    'query',
    10,
    undefined,
    0.8,
    { userId: 'user-1' },
    'selected-project'
  );
});

test('workspace semantic search rejects calls without an actor', async t => {
  let embeddingCalled = false;
  const client = {
    getEmbedding: async () => {
      embeddingCalled = true;
      return [1];
    },
  } as unknown as EmbeddingClient;
  const context = new CopilotContextService(
    { getClient: () => client } as never,
    {} as never,
    {} as Models,
    {} as PermissionService
  );

  await t.throwsAsync(context.matchWorkspaceDocs('workspace-1', 'query', 10), {
    message: 'Document embedding search requires a user id.',
  });
  t.false(embeddingCalled);
});

test('context mutations expose validation failures as user-friendly errors', async t => {
  const resolver = new CopilotContextMemoryResolver(
    {} as never,
    {} as never,
    {} as never,
    workbenchModels()
  );

  const error = await t.throwsAsync(
    resolver.createCopilotContextMemory({ id: 'user-1' } as never, {
      scope: 'user',
      kind: 'rule',
      content: ' ',
    })
  );

  t.true(error instanceof BadRequest);
  t.is(error.message, 'Memory content is required');
});

test('context GraphQL mutations reject sensitive memory and rule content', async t => {
  const resolver = new CopilotContextMemoryResolver(
    permissionAccess(),
    {} as never,
    {} as never,
    workbenchModels()
  );

  const memoryError = await t.throwsAsync(
    resolver.createCopilotContextMemory({ id: 'user-1' } as never, {
      scope: 'user',
      kind: 'rule',
      content: 'Remember api_key=super-secret-value',
    })
  );
  t.true(memoryError instanceof BadRequest);
  t.true(memoryError.message.includes('cannot store secrets'));

  const ruleError = await t.throwsAsync(
    resolver.createCopilotContextRule({ id: 'user-1' } as never, {
      scope: 'user',
      name: 'Unsafe rule',
      applicationMode: 'always',
      priority: 0,
      content: 'Use Bearer abcdefghijklmnopqrstuvwxyz for requests.',
    })
  );
  t.true(ruleError instanceof BadRequest);
  t.true(ruleError.message.includes('cannot store secrets'));
});

test('context rule mutations hide rules owned by another user', async t => {
  const resolver = new CopilotContextMemoryResolver(
    permissionAccess(),
    {} as never,
    {
      getRule: async () => ({
        id: 'rule-1',
        ownerUserId: 'user-2',
      }),
    } as never,
    workbenchModels()
  );

  await t.throwsAsync(
    resolver.updateCopilotContextRule({ id: 'user-1' } as never, {
      id: 'rule-1',
      priority: 10,
    }),
    { message: 'Context rule not found' }
  );
});

test('workspace policy mutations require workspace settings permission', async t => {
  const checkedPermissions: string[] = [];
  const resolver = new CopilotContextMemoryResolver(
    permissionAccess(async permission => {
      checkedPermissions.push(permission);
      throw new Error('permission denied');
    }),
    {} as never,
    {} as never,
    workbenchModels()
  );

  await t.throwsAsync(
    resolver.createCopilotContextPolicy({ id: 'user-1' } as never, {
      workspaceId: 'workspace-1',
      name: 'Workspace policy',
      applicationMode: 'always',
      priority: 100,
      content: 'Keep workspace data private.',
    }),
    { message: 'permission denied' }
  );
  t.deepEqual(checkedPermissions, ['Workspace.Settings.Update']);
});

test('context memory undo stays bound to the current user and workspace', async t => {
  const calls: Array<[string, string, string]> = [];
  const resolver = new CopilotContextMemoryResolver(
    permissionAccess(),
    {
      undoWriterEvent: async (
        userId: string,
        workspaceId: string,
        eventId: string
      ) => {
        calls.push([userId, workspaceId, eventId]);
        return null;
      },
    } as never,
    {} as never,
    workbenchModels()
  );

  const error = await t.throwsAsync(
    resolver.undoCopilotContextMemoryEvent(
      { id: 'user-1' } as never,
      'workspace-1',
      'event-from-another-owner'
    )
  );
  t.true(error instanceof BadRequest);
  t.deepEqual(calls, [['user-1', 'workspace-1', 'event-from-another-owner']]);
});

test('global context project direct lookup fails closed for a non-member', async t => {
  let metadataRead = false;
  const resolver = new CopilotContextMemoryResolver(
    permissionAccess(),
    {
      getProject: async () => ({
        id: 'project-1',
        members: [{ userId: 'user-2', role: 'owner' }],
      }),
      getDocumentMetas: async () => {
        metadataRead = true;
        return [];
      },
    } as never,
    {} as never,
    workbenchModels()
  );

  await t.throwsAsync(
    resolver.contextProject(
      { workspaceId: null },
      { id: 'user-1' } as never,
      'project-1'
    ),
    { message: 'Context project not found' }
  );
  t.false(metadataRead, 'document metadata is not read before membership');
});
