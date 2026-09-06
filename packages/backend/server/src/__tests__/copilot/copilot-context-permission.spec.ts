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
import { IntelligenceWorkbenchResolver } from '../../plugins/copilot/intelligence-workbench-resolver';

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

function workbenchModels(
  documents: Array<{ workspaceId: string; docId: string; status?: string }> = []
) {
  return {
    intelligenceWorkbenchAuthorization: {
      listGrantedProjectDocuments: async () =>
        documents.filter(
          document => (document.status ?? 'granted') === 'granted'
        ),
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
        documents: [],
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

test('global context project filters identical doc ids by source workspace', async t => {
  const checkedWorkspaces: string[] = [];
  const metadataRefs: Array<{ workspaceId: string; docId: string }> = [];
  const access = {
    user: () => ({
      workspace: (workspaceId: string) => ({
        allowLocal() {
          return this;
        },
        docs: async <T extends { workspaceId: string }>(documents: T[]) => {
          checkedWorkspaces.push(workspaceId);
          return workspaceId === 'workspace-a' ? documents : [];
        },
      }),
    }),
  } as unknown as PermissionAccess;
  const project = {
    id: 'project-1',
    createdByUserId: 'user-1',
    name: 'Cross-workspace project',
    description: '',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    members: [{ userId: 'user-1', role: 'owner' }],
    documents: [
      {
        projectId: 'project-1',
        workspaceId: 'workspace-a',
        docId: 'same-doc-id',
        groupId: null,
        sortOrder: 0,
        status: 'granted',
        requestedLevel: 'read',
        addedByUserId: 'user-1',
        placeholderInitiatorUserId: null,
        suppliedTitle: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        projectId: 'project-1',
        workspaceId: 'workspace-b',
        docId: 'same-doc-id',
        groupId: null,
        sortOrder: 1,
        status: 'granted',
        requestedLevel: 'read',
        addedByUserId: 'user-1',
        placeholderInitiatorUserId: null,
        suppliedTitle: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };
  const resolver = new CopilotContextMemoryResolver(
    access,
    {
      listProjects: async () => [project],
      getDocumentMetas: async (
        refs: Array<{ workspaceId: string; docId: string }>
      ) => {
        metadataRefs.push(
          ...refs.map(({ workspaceId, docId }) => ({ workspaceId, docId }))
        );
        return refs.map(() => ({ title: 'Readable title' }));
      },
    } as never,
    {} as never,
    workbenchModels(project.documents)
  );

  const result = await resolver.contextProjects(
    { workspaceId: null },
    { id: 'user-1' } as never,
    false
  );

  t.deepEqual(checkedWorkspaces.sort(), ['workspace-a', 'workspace-b']);
  t.deepEqual(metadataRefs, [
    { workspaceId: 'workspace-a', docId: 'same-doc-id' },
  ]);
  t.deepEqual(
    result[0]?.documents.map(document => ({
      workspaceId: document.workspaceId,
      docId: document.docId,
      title: document.title,
    })),
    [
      {
        workspaceId: 'workspace-a',
        docId: 'same-doc-id',
        title: 'Readable title',
      },
    ]
  );
});

test('project resolver redacts pending document identity until its grant is active', async t => {
  const document = {
    projectId: 'project-1',
    workspaceId: 'source-workspace',
    docId: 'sensitive-doc',
    groupId: null,
    sortOrder: 0,
    status: 'pending',
    requestedLevel: 'read',
    addedByUserId: 'initiator-1',
    placeholderInitiatorUserId: 'initiator-1' as string | null,
    suppliedTitle: 'Sensitive title' as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const project = {
    id: 'project-1',
    createdByUserId: 'initiator-1',
    name: 'Shared project',
    description: '',
    status: 'active',
    aiPolicy: 'read_only',
    createdAt: new Date(),
    updatedAt: new Date(),
    members: [
      { userId: 'initiator-1', role: 'owner' },
      { userId: 'member-2', role: 'member' },
    ],
    documents: [document],
  };
  const resolver = new CopilotContextMemoryResolver(
    permissionAccess(),
    {
      listProjects: async () => [project],
      getProject: async () => project,
      getDocumentMetas: async () => [{ title: 'Approved title' }],
    } as never,
    {} as never,
    workbenchModels([document])
  );
  const viewer = { id: 'member-2' } as never;

  const [pendingProject] = await resolver.contextProjects(
    { workspaceId: null },
    viewer,
    false
  );
  t.like(pendingProject?.documents[0], {
    workspaceId: 'source-workspace',
    docId: null,
    title: null,
    suppliedTitle: null,
    status: 'pending',
    requestedLevel: 'read',
  });

  document.status = 'granted';
  document.placeholderInitiatorUserId = null;
  document.suppliedTitle = null;
  const approvedProject = await resolver.contextProject(
    { workspaceId: null },
    viewer,
    project.id
  );
  t.like(approvedProject.documents[0], {
    workspaceId: 'source-workspace',
    docId: 'sensitive-doc',
    title: 'Approved title',
    status: 'granted',
  });
});

test('adding a project document delegates the two-branch decision to authorization', async t => {
  let authorizationInput: Record<string, unknown> | null = null;
  const pendingDocument = {
    projectId: 'project-1',
    workspaceId: 'workspace-1',
    docId: 'reader-only-doc',
    groupId: null,
    sortOrder: 0,
    status: 'pending',
    requestedLevel: 'write',
    addedByUserId: 'user-1',
    placeholderInitiatorUserId: 'user-1',
    suppliedTitle: 'Known title',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const resolver = new CopilotContextMemoryResolver(
    permissionAccess(),
    {
      getProject: async () => ({
        id: 'project-1',
        createdByUserId: 'user-1',
        name: 'Project',
        description: '',
        status: 'active',
        aiPolicy: 'read_only',
        members: [{ userId: 'user-1', role: 'owner' }],
        documents: authorizationInput ? [pendingDocument] : [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      getDocumentMetas: async () => [],
    } as never,
    {} as never,
    {
      intelligenceWorkbenchAuthorization: {
        addProjectDocument: async (input: Record<string, unknown>) => {
          authorizationInput = input;
          return { kind: 'requested' };
        },
        listGrantedProjectDocuments: async () => [],
        listAccessRequests: async () => [
          {
            id: 'request-1',
            workspaceId: 'workspace-1',
            docId: 'reader-only-doc',
          },
        ],
      },
      user: {
        getWorkspaceUsers: async () => [],
      },
    } as never
  );

  const result = await resolver.addCopilotContextProjectDocument(
    { id: 'user-1' } as never,
    {
      projectId: 'project-1',
      workspaceId: 'workspace-1',
      docId: 'reader-only-doc',
      requestedLevel: 'write',
      requestedTitle: 'Known title',
    }
  );
  t.like(authorizationInput, {
    projectId: 'project-1',
    requesterUserId: 'user-1',
    requestedLevel: 'write',
  });
  t.is(result.outcome, 'requested');
  t.is(result.projectDocument.status, 'pending');
  t.is(result.projectDocument.docId, 'reader-only-doc');
});

test('project access request identity follows the live grant in the resolver response', async t => {
  const now = new Date();
  const request = {
    id: 'request-1',
    workspaceId: 'workspace-1',
    docId: 'sensitive-doc',
    beneficiaryType: 'project',
    beneficiaryUserId: null,
    beneficiaryProjectId: 'project-1',
    requesterUserId: 'initiator-1',
    requesterUserIdSnapshot: 'initiator-1',
    requestedLevel: 'read',
    requestedTitle: 'Sensitive title' as string | null,
    status: 'pending',
    resolvedByUserId: null,
    resolutionReason: null,
    resolvedAt: null,
    expiresAt: null,
    idempotencyKey: null,
    createdAt: now,
    updatedAt: now,
  };
  let projected = {
    ...request,
    requesterSuppliedIdentity: true,
    projectGrant: null as { status: string } | null,
  };
  const blindRerequest = {
    ...request,
    id: 'request-2',
    requesterUserId: 'member-2',
    requesterUserIdSnapshot: 'member-2',
    requesterSuppliedIdentity: false,
    requestedTitle: null,
    projectGrant: null as { status: string } | null,
  };
  const resolver = new IntelligenceWorkbenchResolver(permissionAccess(), {
    intelligenceWorkbenchAuthorization: {
      listAccessRequests: async () => [projected],
      reRequestRevokedProjectDocument: async () => ({
        request: blindRerequest,
      }),
    },
  } as never);

  const queryAsOtherMember = () =>
    resolver.workbenchAccessRequests(
      { workspaceId: null },
      { id: 'member-2' } as never,
      'project',
      'project-1',
      undefined,
      undefined,
      undefined,
      50
    );

  const pending = await queryAsOtherMember();
  t.is(pending[0]?.docId, null);
  t.is(pending[0]?.requestedTitle, null);

  projected = {
    ...projected,
    status: 'approved',
    projectGrant: { status: 'active' },
  };
  const approved = await queryAsOtherMember();
  t.is(approved[0]?.docId, 'sensitive-doc');
  t.is(approved[0]?.requestedTitle, 'Sensitive title');

  projected = {
    ...projected,
    projectGrant: { status: 'revoked' },
  };
  const revoked = await queryAsOtherMember();
  t.is(revoked[0]?.docId, null);
  t.is(revoked[0]?.requestedTitle, null);

  const mutationResult = await resolver.reRequestCopilotProjectDocumentAccess(
    { id: 'member-2' } as never,
    { grantId: 'revoked-grant' }
  );
  t.is(mutationResult.docId, null);
  t.is(mutationResult.requestedTitle, null);

  projected = blindRerequest;
  const blindPendingForRequester = await queryAsOtherMember();
  t.is(blindPendingForRequester[0]?.docId, null);
  t.is(blindPendingForRequester[0]?.requestedTitle, null);

  projected = {
    ...blindRerequest,
    status: 'approved',
    projectGrant: { status: 'active' },
  };
  const blindApproved = await queryAsOtherMember();
  t.is(blindApproved[0]?.docId, 'sensitive-doc');
});

test('project memories and rules stay hidden when any project document is unreadable', async t => {
  const project = {
    id: 'project-1',
    createdByUserId: 'user-1',
    name: 'Permission boundary project',
    description: '',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    members: [{ userId: 'user-1', role: 'owner' }],
    documents: [
      {
        projectId: 'project-1',
        workspaceId: 'workspace-a',
        docId: 'doc-a',
        groupId: null,
        sortOrder: 0,
        status: 'granted',
        requestedLevel: 'read',
        createdAt: new Date(),
      },
      {
        projectId: 'project-1',
        workspaceId: 'workspace-b',
        docId: 'doc-b',
        groupId: null,
        sortOrder: 1,
        status: 'granted',
        requestedLevel: 'read',
        createdAt: new Date(),
      },
    ],
  };

  for (const readableWorkspaces of [
    new Set(['workspace-a']),
    new Set<string>(),
  ]) {
    let memoryProjectIds: string[] | undefined;
    let ruleProjectIds: string[] | undefined;
    const access = {
      user: () => ({
        workspace: (workspaceId: string) => {
          const chain = {
            allowLocal: () => chain,
            assert: async () => {},
            docs: async <T>(documents: T[]) =>
              readableWorkspaces.has(workspaceId) ? documents : [],
          };
          return chain;
        },
      }),
    } as unknown as PermissionAccess;
    const resolver = new CopilotContextMemoryResolver(
      access,
      {
        listProjects: async () => [project],
        listManageable: async (input: { projectIds?: string[] }) => {
          memoryProjectIds = input.projectIds;
          return [
            { id: 'personal-memory', content: 'PERSONAL_MEMORY' },
            ...(input.projectIds?.includes(project.id)
              ? [
                  {
                    id: 'project-memory',
                    content: 'PROJECT_MEMORY_MUST_NOT_LEAK',
                  },
                ]
              : []),
          ];
        },
      } as never,
      {
        listRules: async (input: { projectIds?: string[] }) => {
          ruleProjectIds = input.projectIds;
          return [
            { id: 'personal-rule', content: 'PERSONAL_RULE' },
            ...(input.projectIds?.includes(project.id)
              ? [
                  {
                    id: 'project-rule',
                    content: 'PROJECT_RULE_MUST_NOT_LEAK',
                  },
                ]
              : []),
          ];
        },
      } as never,
      workbenchModels(project.documents)
    );

    const memories = await resolver.contextMemories(
      { workspaceId: null },
      { id: 'user-1' } as never,
      undefined,
      false
    );
    const rules = await resolver.contextRules(
      { workspaceId: 'workspace-a' },
      { id: 'user-1' } as never,
      false
    );

    t.deepEqual(memoryProjectIds, []);
    t.deepEqual(ruleProjectIds, []);
    t.deepEqual(
      memories.map(memory => memory.id),
      ['personal-memory']
    );
    t.deepEqual(
      rules.map(rule => rule.id),
      ['personal-rule']
    );
  }
});

test('a pending placeholder does not block granted project context or enter its readable scope', async t => {
  const checkedDocIds: string[] = [];
  let memoryProjectIds: string[] | undefined;
  const project = {
    id: 'project-1',
    createdByUserId: 'user-1',
    name: 'Partially pending project',
    description: '',
    status: 'active',
    members: [{ userId: 'user-1', role: 'owner' }],
    documents: [
      {
        projectId: 'project-1',
        workspaceId: 'workspace-a',
        docId: 'granted-doc',
        status: 'granted',
      },
      {
        projectId: 'project-1',
        workspaceId: 'workspace-b',
        docId: 'pending-doc',
        status: 'pending',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const access = {
    user: () => ({
      workspace: () => {
        const chain = {
          allowLocal: () => chain,
          docs: async <T extends { docId: string }>(documents: T[]) => {
            checkedDocIds.push(...documents.map(document => document.docId));
            return documents;
          },
        };
        return chain;
      },
    }),
  } as unknown as PermissionAccess;
  const resolver = new CopilotContextMemoryResolver(
    access,
    {
      listProjects: async () => [project],
      listManageable: async (input: { projectIds?: string[] }) => {
        memoryProjectIds = input.projectIds;
        return [{ id: 'project-memory', content: 'AUTHORIZED_PROJECT_MEMORY' }];
      },
    } as never,
    {} as never,
    workbenchModels(project.documents)
  );

  const memories = await resolver.contextMemories(
    { workspaceId: null },
    { id: 'user-1' } as never,
    undefined,
    false
  );

  t.deepEqual(checkedDocIds, ['granted-doc']);
  t.deepEqual(memoryProjectIds, ['project-1']);
  t.deepEqual(
    memories.map(memory => memory.id),
    ['project-memory']
  );
});

test('project memory and rule management fail closed for unreadable owners and non-owners', async t => {
  const exercise = async (input: {
    role: 'owner' | 'member';
    readableWorkspaces: Set<string>;
  }) => {
    const writes: string[] = [];
    const project = {
      id: 'project-1',
      status: 'active',
      members: [{ userId: 'user-1', role: input.role }],
      documents: [
        {
          workspaceId: 'workspace-a',
          docId: 'doc-a',
          status: 'granted',
        },
        {
          workspaceId: 'workspace-b',
          docId: 'doc-b',
          status: 'granted',
        },
      ],
    };
    const access = {
      user: () => ({
        workspace: (workspaceId: string) => {
          const chain = {
            allowLocal: () => chain,
            assert: async () => {},
            docs: async <T>(documents: T[]) =>
              input.readableWorkspaces.has(workspaceId) ? documents : [],
          };
          return chain;
        },
      }),
    } as unknown as PermissionAccess;
    const resolver = new CopilotContextMemoryResolver(
      access,
      {
        getProject: async () => project,
        get: async () => ({
          id: 'memory-1',
          ownerUserId: 'user-1',
          scope: 'project',
          projectId: project.id,
          status: 'active',
        }),
        create: async () => {
          writes.push('create-memory');
        },
        update: async () => {
          writes.push('update-memory');
        },
        delete: async () => {
          writes.push('delete-memory');
        },
      } as never,
      {
        getRule: async () => ({
          id: 'rule-1',
          ownerUserId: 'user-1',
          scope: 'project',
          projectId: project.id,
          workspaceId: null,
        }),
        createRule: async () => {
          writes.push('create-rule');
        },
        updateRule: async () => {
          writes.push('update-rule');
        },
        deleteRule: async () => {
          writes.push('delete-rule');
        },
      } as never,
      workbenchModels(project.documents)
    );
    const user = { id: 'user-1' } as never;
    const operations = [
      () =>
        resolver.createCopilotContextMemory(user, {
          scope: 'project',
          kind: 'project_summary',
          projectId: project.id,
          content: 'Project memory',
        }),
      () =>
        resolver.updateCopilotContextMemory(user, {
          id: 'memory-1',
          content: 'Updated project memory',
        }),
      () => resolver.deleteCopilotContextMemory(user, 'memory-1'),
      () =>
        resolver.createCopilotContextRule(user, {
          scope: 'project',
          projectId: project.id,
          name: 'Project rule',
          applicationMode: 'always',
          priority: 0,
          content: 'Project rule content',
        }),
      () =>
        resolver.updateCopilotContextRule(user, {
          id: 'rule-1',
          priority: 1,
        }),
      () => resolver.deleteCopilotContextRule(user, 'rule-1'),
    ];
    for (const operation of operations) {
      await t.throwsAsync(operation(), {
        message: 'Context project not found',
      });
    }
    t.deepEqual(writes, []);
  };

  await exercise({
    role: 'owner',
    readableWorkspaces: new Set(['workspace-a']),
  });
  await exercise({
    role: 'member',
    readableWorkspaces: new Set(['workspace-a', 'workspace-b']),
  });
});

test('project document add maps a lost membership race to not found without metadata reads', async t => {
  let metadataRead = false;
  const resolver = new CopilotContextMemoryResolver(
    permissionAccess(),
    {
      getProject: async () => ({
        id: 'project-1',
        status: 'active',
        members: [{ userId: 'user-1', role: 'owner' }],
        documents: [],
      }),
      getDocumentMetas: async () => {
        metadataRead = true;
        return [];
      },
    } as never,
    {} as never,
    {
      intelligenceWorkbenchAuthorization: {
        addProjectDocument: async () => {
          throw new Error('Context project not found');
        },
      },
    } as never
  );

  await t.throwsAsync(
    resolver.addCopilotContextProjectDocument({ id: 'user-1' } as never, {
      projectId: 'project-1',
      workspaceId: 'workspace-1',
      docId: 'doc-1',
    }),
    { message: 'Context project not found' }
  );
  t.false(metadataRead);
});
