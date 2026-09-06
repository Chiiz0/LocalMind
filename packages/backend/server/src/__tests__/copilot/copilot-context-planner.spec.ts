import test from 'ava';

import type { PermissionService } from '../../core/permission';
import type { Models } from '../../models';
import { buildContextMemoryVisibilityWhere } from '../../models/copilot-context-memory';
import {
  classifyContextMemoryDlp,
  ContextMemoryService,
  deriveContextMemoryFactKey,
  extractDurableMemories,
  extractExplicitMemoryDecisions,
  sanitizeContextMemoryWriterDecision,
  shouldAttemptImplicitExtraction,
} from '../../plugins/copilot/context-memory-service';
import { ContextRuleService } from '../../plugins/copilot/context-rule-service';
import { ContextScopeResolver } from '../../plugins/copilot/context-scope-resolver';
import { renderBuiltInPromptSessionNative } from '../../plugins/copilot/prompt/native-contract';
import type { PromptMessage } from '../../plugins/copilot/providers/types';
import {
  CANDIDATE_CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
  CANDIDATE_CONTEXT_PLANNER_STRATEGY_VERSION,
  CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
  CONTEXT_PLANNER_STRATEGY_VERSION,
  ContextPlanner,
  LEGACY_CONTEXT_PLANNER_STRATEGY_VERSION,
  PREVIOUS_CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
  PREVIOUS_CONTEXT_PLANNER_STRATEGY_VERSION,
  SYSTEM_CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
  SYSTEM_CONTEXT_PLANNER_STRATEGY_VERSION,
  UNTRUSTED_CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
  UNTRUSTED_CONTEXT_PLANNER_STRATEGY_VERSION,
} from '../../plugins/copilot/runtime/context-planner';
import { ChatSession } from '../../plugins/copilot/session';

const message = (
  role: PromptMessage['role'],
  content: string
): PromptMessage => ({ role, content });

function tailRenderer(maxTurns: number) {
  return (turns: PromptMessage[]) => [
    message('system', 'Base prompt'),
    ...turns.slice(-maxTurns),
  ];
}

function grantedProjectDocuments(
  documents: Array<{ workspaceId: string; docId: string }>
) {
  return {
    intelligenceWorkbenchAuthorization: {
      listGrantedProjectDocuments: async () => documents,
    },
  };
}

test('ContextPlanner retains early and recent facts with a checkpoint', t => {
  const turns = [
    message('user', 'Remember that the deployment region is eu-west-1.'),
    message('assistant', 'Acknowledged.'),
    message('user', 'Intermediate discussion without a durable decision.'),
    message('assistant', 'Continuing.'),
    message('user', 'Produce the deployment checklist now.'),
  ];
  const result = new ContextPlanner().plan({
    turns,
    render: tailRenderer(3),
  });
  const content = result.messages.map(item => item.content).join('\n');

  t.true(content.includes('deployment region is eu-west-1'));
  t.true(content.includes('deployment checklist'));
  t.is(result.checkpoint?.strategyVersion, CONTEXT_PLANNER_STRATEGY_VERSION);
  t.is(
    result.checkpoint?.strategyFingerprint,
    CONTEXT_PLANNER_STRATEGY_FINGERPRINT
  );
  t.true((result.checkpoint?.summarizedMessageCount ?? 0) > 0);
});

test('ContextPlanner synthesizes multiple scoped fragments', t => {
  const result = new ContextPlanner().plan({
    turns: [message('user', 'What database and release rule should we use?')],
    memories: [
      {
        scope: 'workspace',
        kind: 'rule',
        content: 'Always require a rollback plan.',
      },
      {
        scope: 'project',
        kind: 'project_summary',
        content: 'The service persists data in PostgreSQL.',
      },
      {
        scope: 'project',
        kind: 'auto_memory',
        content: 'The project codename is Juniper.',
      },
    ],
    render: tailRenderer(8),
  });
  const content = result.messages.map(item => item.content).join('\n');

  t.true(content.includes('Always require a rollback plan.'));
  t.true(content.includes('PostgreSQL'));
  t.true(content.includes('Juniper'));
  t.is(result.diagnostics.injectedMemoryCount, 3);
});

test('ContextPlanner keeps user-owned context outside the primary system message', t => {
  const query = 'What is the database migration codename?';
  const result = new ContextPlanner().plan({
    turns: [message('user', query)],
    memories: [
      {
        id: 'memory-maple',
        scope: 'workspace',
        kind: 'auto_memory',
        content: 'The database migration codename is Maple-42.',
      },
    ],
    render: turns =>
      renderBuiltInPromptSessionNative({
        name: 'Chat With LocalMind AI',
        turns,
        renderParams: { content: query },
        maxTokenSize: 128 * 1024,
      }).messages,
  });
  const systemMessages = result.messages.filter(item => item.role === 'system');
  const contextMessage = result.messages.find(
    item =>
      item.role === 'user' && item.content.includes('Untrusted user context')
  );

  t.is(systemMessages.length, 1);
  t.false(systemMessages[0].content.includes('Maple-42'));
  t.true(contextMessage?.content.includes('Maple-42') ?? false);
  t.is(result.diagnostics.retainedMessageCount, 1);
  t.is(result.diagnostics.omittedMessageCount, 0);
  t.false(result.diagnostics.summaryInjected);
  t.is(result.checkpoint, undefined);
  t.like(result.trace.selectedMemories[0], {
    id: 'memory-maple',
    scope: 'workspace',
    kind: 'auto_memory',
    rank: 1,
  });
  t.true((result.trace.selectedMemories[0]?.score ?? 0) > 0);
  t.false(JSON.stringify(result.trace).includes('Maple-42'));
  t.true(result.trace.contextCharCount > 0);
});

test('ContextPlanner keeps the v4 system-context strategy available for replay', t => {
  const result = new ContextPlanner().plan(
    {
      turns: [message('user', 'What is the project codename?')],
      memories: [
        {
          scope: 'workspace',
          kind: 'auto_memory',
          content: 'The project codename is Juniper.',
        },
      ],
      render: tailRenderer(4),
    },
    SYSTEM_CONTEXT_PLANNER_STRATEGY_VERSION
  );
  const systemContext = result.messages.find(
    item => item.role === 'system' && item.content.includes('Juniper')
  );

  t.truthy(systemContext);
  t.is(
    result.diagnostics.strategyFingerprint,
    SYSTEM_CONTEXT_PLANNER_STRATEGY_FINGERPRINT
  );
});

test('ContextPlanner keeps the legacy strategy available for replay', t => {
  const turns = [
    message('user', 'Remember the obsolete retention detail.'),
    message('assistant', 'Acknowledged.'),
    message('user', 'Latest request.'),
  ];
  const result = new ContextPlanner().plan(
    {
      turns,
      memories: [
        {
          scope: 'workspace',
          kind: 'auto_memory',
          content: 'The hidden legacy codename is Juniper.',
        },
      ],
      render: tailRenderer(1),
    },
    LEGACY_CONTEXT_PLANNER_STRATEGY_VERSION
  );
  const content = result.messages.map(item => item.content).join('\n');

  t.false(content.includes('obsolete retention detail'));
  t.false(content.includes('hidden legacy codename'));
  t.is(result.checkpoint, undefined);
  t.is(
    result.diagnostics.strategyVersion,
    LEGACY_CONTEXT_PLANNER_STRATEGY_VERSION
  );
});

test('ContextPlanner keeps the previous rolling-summary strategy available for replay', t => {
  const result = new ContextPlanner().plan(
    {
      turns: [
        message('user', 'Remember that the retained region is eu-west-1.'),
        message('assistant', 'Acknowledged.'),
        message('user', 'Latest request.'),
      ],
      render: tailRenderer(2),
    },
    PREVIOUS_CONTEXT_PLANNER_STRATEGY_VERSION
  );

  t.is(
    result.diagnostics.strategyVersion,
    PREVIOUS_CONTEXT_PLANNER_STRATEGY_VERSION
  );
  t.is(
    result.diagnostics.strategyFingerprint,
    PREVIOUS_CONTEXT_PLANNER_STRATEGY_FINGERPRINT
  );
  t.true(
    result.messages.some(item =>
      item.content.includes('retained region is eu-west-1')
    )
  );
});

test('ContextPlanner keeps the bounded v3 candidate available for replay', t => {
  const result = new ContextPlanner().plan(
    {
      turns: [message('user', 'What is the project codename?')],
      memories: [
        {
          scope: 'workspace',
          kind: 'auto_memory',
          content: 'The project codename is Juniper.',
        },
      ],
      render: tailRenderer(4),
    },
    CANDIDATE_CONTEXT_PLANNER_STRATEGY_VERSION
  );

  t.is(
    result.diagnostics.strategyVersion,
    CANDIDATE_CONTEXT_PLANNER_STRATEGY_VERSION
  );
  t.is(
    result.diagnostics.strategyFingerprint,
    CANDIDATE_CONTEXT_PLANNER_STRATEGY_FINGERPRINT
  );
});

test('ContextPlanner reserves space for summary and marks memory as user-authored', t => {
  const result = new ContextPlanner().plan({
    turns: [
      message('user', 'Remember that deployment runs in eu-west-1.'),
      message('assistant', 'Acknowledged.'),
      message('user', 'Prepare the final checklist.'),
    ],
    memories: Array.from({ length: 20 }, (_, index) => ({
      scope: 'user' as const,
      kind: 'rule' as const,
      content: `Rule ${index}: ${'bounded context '.repeat(80)}`,
    })),
    render: tailRenderer(2),
  });
  const contextMessage = result.messages.find(item =>
    item.content.includes('[Untrusted user context')
  );

  t.truthy(contextMessage);
  t.true(
    contextMessage?.content.includes('deployment runs in eu-west-1') ?? false,
    'summary should not be displaced by large rules'
  );
  t.true(contextMessage?.content.includes('Untrusted user context') ?? false);
  t.true((contextMessage?.content.length ?? Infinity) <= 4_800);
});

test('ContextPlanner rejects stale checkpoints after the source prefix changes', t => {
  const result = new ContextPlanner().plan({
    turns: [
      message('user', 'Remember that the current database is PostgreSQL.'),
      message('assistant', 'Acknowledged.'),
      message('user', 'Continue.'),
    ],
    checkpoint: {
      strategyVersion: CONTEXT_PLANNER_STRATEGY_VERSION,
      strategyFingerprint: CONTEXT_PLANNER_STRATEGY_FINGERPRINT,
      summary: '- [user] Remember that the stale database was SQLite.',
      summarizedMessageCount: 2,
      sourceFingerprint: 'does-not-match',
      diagnostics: {},
    },
    render: tailRenderer(2),
  });
  const content = result.messages.map(item => item.content).join('\n');

  t.true(content.includes('current database is PostgreSQL'));
  t.false(content.includes('stale database was SQLite'));
});

test('ContextPlanner checkpoints long conversations without durable cues', t => {
  const result = new ContextPlanner().plan({
    turns: [
      message('user', 'We explored the first implementation approach.'),
      message('assistant', 'The discussion continued.'),
      message('user', 'Now compare the alternatives.'),
    ],
    render: tailRenderer(1),
  });

  t.true(
    result.checkpoint?.summary.includes('first implementation approach') ??
      false
  );
});

test('durable memory extraction rejects questions and secrets', t => {
  t.deepEqual(
    extractDurableMemories(
      'Remember that the codename is Juniper. What is the status? api_key=secret-value. Remember my password is hidden.'
    ),
    ['Remember that the codename is Juniper.']
  );
  t.deepEqual(
    extractDurableMemories(
      '我之前让你记住的数据库迁移代号是什么？请只回答代号。'
    ),
    []
  );
  t.deepEqual(
    extractDurableMemories(
      'What is the deployment codename? Reply with only the codename.'
    ),
    []
  );
  t.deepEqual(
    extractDurableMemories('The deployment codename is ORCHID_FACT.'),
    []
  );
  t.deepEqual(extractDurableMemories('The code constant is DEFAULT_FACT.'), []);
  t.deepEqual(extractDurableMemories('请记住：以后始终用中文回答。'), [
    '请记住：以后始终用中文回答。',
  ]);
  t.deepEqual(
    extractDurableMemories(
      'Remember that my preferred verification response starts with the conclusion.'
    ),
    [
      'Remember that my preferred verification response starts with the conclusion.',
    ]
  );
  t.is(
    extractExplicitMemoryDecisions(
      'Remember that we always use version 3.5 for builds.'
    )[0]?.content,
    'we always use version 3.5 for builds'
  );
  t.false(
    shouldAttemptImplicitExtraction('The code constant is DEFAULT_FACT.')
  );
  t.false(shouldAttemptImplicitExtraction('Tell me if the codename is ORCHID'));
  t.true(
    shouldAttemptImplicitExtraction(
      'The codename for the deployment is ORCHID.'
    )
  );
});

test('structured memory writer classifies explicit operations and DLP', t => {
  const add = extractExplicitMemoryDecisions(
    'Remember that the deployment region is eu-west-1.'
  );
  const update = extractExplicitMemoryDecisions(
    'Instead, answer in English from now on.'
  );
  const remove = extractExplicitMemoryDecisions(
    'Forget the deployment region.'
  );

  t.like(add[0], {
    operation: 'ADD',
    factKey: 'project:deployment_region',
  });
  t.like(update[0], {
    operation: 'UPDATE',
    factKey: 'preference:response_language',
  });
  t.like(remove[0], {
    operation: 'DELETE',
    factKey: 'project:deployment_region',
    content: null,
  });
  t.is(extractExplicitMemoryDecisions('I always run tests.').length, 0);
  t.is(deriveContextMemoryFactKey('中文回答'), 'preference:response_language');
  t.true(classifyContextMemoryDlp('api_key=secret-value').blocked);
  t.true(classifyContextMemoryDlp('Contact me at user@example.com').blocked);
  t.true(classifyContextMemoryDlp('Customer ID: ACME-123').blocked);
  t.false(classifyContextMemoryDlp('Use PostgreSQL for persistence').blocked);
  const emailSource = 'Remember my email is person@example.com.';
  const emailDecision = extractExplicitMemoryDecisions(emailSource)[0];
  t.is(emailDecision?.content, 'my email is person@example.com');
  t.like(sanitizeContextMemoryWriterDecision(emailDecision!, emailSource), {
    operation: 'NOOP',
    factKey: null,
    reasonCode: 'dlp_personal_data',
  });
});

test('ContextPlanner layers workspace policy above private user context', t => {
  const result = new ContextPlanner().plan({
    turns: [message('user', 'Prepare the release plan.')],
    memories: [
      {
        id: 'policy-a',
        scope: 'workspace',
        kind: 'rule',
        sourceType: 'policy',
        sourceRevisionId: 'policy-revision-a',
        matchReason: 'always',
        priority: 100,
        relevanceScore: 21,
        content: 'Never disclose restricted workspace data.',
      },
      {
        id: 'rule-a',
        scope: 'user',
        kind: 'rule',
        sourceType: 'rule',
        sourceRevisionId: 'rule-revision-a',
        matchReason: 'always',
        priority: 10,
        relevanceScore: 10,
        content: 'Start with the conclusion.',
      },
    ],
    render: tailRenderer(8),
  });
  const system = result.messages.filter(item => item.role === 'system');
  const userContext = result.messages.find(
    item =>
      item.role === 'user' && item.content.includes('Start with the conclusion')
  );

  t.is(system.length, 1);
  t.true(system[0].content.includes('[Workspace policy]'));
  t.true(
    system[0].content.includes('Never disclose restricted workspace data')
  );
  t.false(system[0].content.includes('Start with the conclusion'));
  t.truthy(userContext);
  t.deepEqual(
    result.trace.selectedMemories.map(item => item.sourceType),
    ['policy', 'rule']
  );
});

test('ContextPlanner avoids mid-conversation system messages without a primary system prompt', t => {
  const result = new ContextPlanner().plan({
    turns: [message('user', 'Prepare the release plan.')],
    memories: [
      {
        id: 'policy-a',
        scope: 'workspace',
        kind: 'rule',
        sourceType: 'policy',
        priority: 100,
        relevanceScore: 20,
        content: 'Keep restricted workspace data private.',
      },
    ],
    render: turns => turns,
  });

  t.false(result.messages.some(item => item.role === 'system'));
  t.true(
    result.messages.some(
      item =>
        item.role === 'user' &&
        item.content.includes('[Workspace policy]') &&
        item.content.includes('Keep restricted workspace data private.')
    )
  );
});

test('ContextPlanner keeps the v5 trust boundary immutable for replay', t => {
  const result = new ContextPlanner().plan(
    {
      turns: [message('user', 'What is the codename?')],
      memories: [
        {
          scope: 'workspace',
          kind: 'auto_memory',
          content: 'The codename is Juniper.',
        },
      ],
      render: tailRenderer(4),
    },
    UNTRUSTED_CONTEXT_PLANNER_STRATEGY_VERSION
  );

  t.is(
    result.diagnostics.strategyFingerprint,
    UNTRUSTED_CONTEXT_PLANNER_STRATEGY_FINGERPRINT
  );
  t.true(
    result.messages.some(
      item =>
        item.role === 'user' &&
        item.content.includes('Untrusted user context') &&
        item.content.includes('Juniper')
    )
  );
  t.false(
    result.messages.some(
      item => item.role === 'system' && item.content.includes('Juniper')
    )
  );
});

test('ContextRuleService applies modes, conditions, priority, and manual references', async t => {
  const now = new Date();
  const directive = (
    id: string,
    applicationMode: string,
    conditions: Record<string, unknown>,
    priority: number
  ) => ({
    id,
    ownerUserId: 'user-a',
    workspaceId: 'workspace-a',
    projectId: null,
    scope: 'workspace',
    name: id,
    description: '',
    applicationMode,
    priority,
    conditions,
    status: 'active',
    activeRevision: 1,
    createdAt: now,
    updatedAt: now,
    revisions: [
      {
        id: `${id}-revision`,
        revision: 1,
        content: `${id} instruction`,
      },
    ],
    hits: [],
  });
  const service = new ContextRuleService({
    copilotContextRule: {
      listRules: async () => [
        directive('always-rule', 'always', {}, 5),
        directive('deployment-rule', 'relevant', { keywords: ['deploy'] }, 20),
        directive('manual-rule', 'manual', {}, 50),
        directive('wrong-doc-rule', 'always', { docIds: ['doc-b'] }, 100),
      ],
      listPolicies: async () => [
        directive('workspace-policy', 'always', {}, 10),
      ],
    },
  } as unknown as Models);

  const result = await service.retrieveApplicable({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    scope: {
      userId: 'user-a',
      workspaceId: 'workspace-a',
      sessionId: 'session-a',
      primaryDocId: 'doc-a',
      readableDocIds: ['doc-a'],
      readableDocumentRefs: [{ workspaceId: 'workspace-a', docId: 'doc-a' }],
      candidateProjectIds: [],
      projectIds: [],
      selectedProjectId: null,
      projectResolution: 'none',
    },
    query: 'Please deploy now using @rule:manual-rule.',
  });

  t.deepEqual(
    result.map(item => item.id),
    ['workspace-policy', 'manual-rule', 'deployment-rule', 'always-rule']
  );
  t.false(result.some(item => item.id === 'wrong-doc-rule'));
  t.is(result.find(item => item.id === 'manual-rule')?.matchReason, 'manual');
});

test('ContextRuleService matches document conditions without widening equal ids across workspaces', async t => {
  const now = new Date();
  const directive = (
    id: string,
    scope: 'user' | 'workspace' | 'project',
    conditions: Record<string, unknown>,
    priority: number
  ) => ({
    id,
    ownerUserId: 'user-a',
    workspaceId: scope === 'workspace' ? 'workspace-a' : null,
    projectId: scope === 'project' ? 'project-a' : null,
    scope,
    name: id,
    description: '',
    applicationMode: 'always',
    priority,
    conditions,
    status: 'active',
    activeRevision: 1,
    createdAt: now,
    updatedAt: now,
    revisions: [
      {
        id: `${id}-revision`,
        revision: 1,
        content: `${id} instruction`,
      },
    ],
    hits: [],
  });
  const service = new ContextRuleService({
    copilotContextRule: {
      listRules: async () => [
        directive(
          'exact-project-ref',
          'project',
          {
            documentRefs: [{ workspaceId: 'workspace-a', docId: 'doc-shared' }],
          },
          40
        ),
        directive(
          'wrong-workspace-same-id',
          'project',
          {
            documentRefs: [{ workspaceId: 'workspace-b', docId: 'doc-shared' }],
          },
          100
        ),
        directive(
          'legacy-workspace-doc-id',
          'workspace',
          { docIds: ['doc-shared'] },
          30
        ),
        directive('legacy-user-doc-id', 'user', { docIds: ['doc-shared'] }, 20),
      ],
      listPolicies: async () => [],
    },
  } as unknown as Models);

  const result = await service.retrieveApplicable({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    scope: {
      userId: 'user-a',
      workspaceId: 'workspace-a',
      sessionId: 'session-a',
      primaryDocId: 'doc-shared',
      readableDocIds: ['doc-shared'],
      readableDocumentRefs: [
        { workspaceId: 'workspace-a', docId: 'doc-shared' },
      ],
      candidateProjectIds: ['project-a'],
      projectIds: ['project-a'],
      selectedProjectId: 'project-a',
      projectResolution: 'selected',
    },
    query: 'Apply the document instructions.',
  });

  t.deepEqual(
    result.map(item => item.id),
    ['exact-project-ref', 'legacy-workspace-doc-id', 'legacy-user-doc-id']
  );
  t.false(result.some(item => item.id === 'wrong-workspace-same-id'));
  t.true(result.every(item => item.matchReason === 'condition'));
});

test('hybrid retrieval sends only authorized memory ids to vector and rerank', async t => {
  const vectorIds: string[][] = [];
  const rerankIds: string[][] = [];
  let visibilityInput: Record<string, unknown> | null = null;
  const now = new Date();
  const memories = ['allowed-a', 'allowed-b'].map((id, index) => ({
    id,
    ownerUserId: 'user-a',
    workspaceId: 'workspace-a',
    docId: null,
    projectId: null,
    sourceSessionId: null,
    scope: 'workspace',
    kind: 'auto_memory',
    visibility: 'private',
    status: 'active',
    content: index ? 'Use PostgreSQL.' : 'Deployment region is eu-west-1.',
    fingerprint: id,
    factKey: `fact:${id}`,
    confidence: 1,
    importance: 0.8,
    sensitivity: 'private',
    captureMode: 'explicit',
    writerVersion: 'structured-memory-writer/v1',
    validFrom: now,
    validUntil: null,
    expiresAt: null,
    supersedesId: null,
    lastUsedAt: null,
    useCount: 0,
    embedding: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  }));
  const service = new ContextMemoryService(
    {
      copilotContextMemory: {
        expireDueMemories: async () => ({ count: 0 }),
        listVisible: async (input: Record<string, unknown>) => {
          visibilityInput = input;
          return memories;
        },
        matchAuthorizedEmbeddings: async (ids: string[]) => {
          vectorIds.push(ids);
          return ids.map((id, index) => ({ id, distance: index / 10 }));
        },
      },
    } as unknown as Models,
    undefined,
    {
      getClient: () => ({
        getEmbedding: async () => [1, 0],
        reRank: async (
          _query: string,
          candidates: Array<{ docId: string }>
        ) => {
          rerankIds.push(candidates.map(candidate => candidate.docId));
          return candidates.toReversed();
        },
      }),
    } as never
  );

  const result = await service.retrieveVisible({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    docIds: [],
    documentRefs: [{ workspaceId: 'workspace-b', docId: 'doc-b' }],
    projectIds: [],
    query: 'Which deployment region and database?',
  });

  t.deepEqual(vectorIds, [['allowed-a', 'allowed-b']]);
  t.deepEqual(rerankIds, [['allowed-a', 'allowed-b']]);
  t.deepEqual(visibilityInput, {
    userId: 'user-a',
    workspaceId: 'workspace-a',
    docIds: [],
    documentRefs: [{ workspaceId: 'workspace-b', docId: 'doc-b' }],
    projectIds: [],
  });
  t.deepEqual(result.map(memory => memory.id).toSorted(), [
    'allowed-a',
    'allowed-b',
  ]);
});

test('document-side automatic memory does not infer project authority', async t => {
  const stored: Array<Record<string, unknown>> = [];
  const service = new ContextMemoryService({
    ...grantedProjectDocuments([
      { workspaceId: 'workspace-a', docId: 'doc-a' },
    ]),
    copilotContextMemory: {
      getPreference: async () => ({ autoMemoryEnabled: false }),
      listProjectIdsForDoc: async () => ['project-a'],
      applyWriterDecision: async (input: Record<string, unknown>) => {
        stored.push(input);
        return { operation: 'ADD', memoryId: null };
      },
    },
  } as unknown as Models);

  await service.captureDurableTurn({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    docId: 'doc-a',
    sessionId: 'session-a',
    turn: {
      role: 'user',
      content: 'Remember that the project codename is Juniper.',
    } as never,
  });

  t.is(stored.length, 1);
  t.like(stored[0], {
    ownerUserId: 'user-a',
    workspaceId: 'workspace-a',
    docId: 'doc-a',
    projectId: null,
    scope: 'document',
  });
  t.like(stored[0].decision as Record<string, unknown>, {
    operation: 'ADD',
    factKey: 'project:codename',
  });
});

test('excluded project memory never falls back to document or workspace memory', async t => {
  let writes = 0;
  const service = new ContextMemoryService({
    copilotContextMemory: {
      applyWriterDecision: async () => {
        writes += 1;
        return { operation: 'ADD', memoryId: null };
      },
    },
  } as unknown as Models);

  for (const readableDocIds of [[], ['private-doc']]) {
    for (const projectResolution of [
      'selected',
      'invalid_selection',
    ] as const) {
      await service.captureDurableTurn({
        userId: 'user-a',
        workspaceId: 'workspace-a',
        sessionId: 'session-a',
        turn: {
          role: 'user',
          content: 'Remember that the project codename is Juniper.',
        } as never,
        scope: {
          userId: 'user-a',
          workspaceId: 'workspace-a',
          sessionId: 'session-a',
          primaryDocId: null,
          readableDocIds,
          readableDocumentRefs: readableDocIds.map(docId => ({
            workspaceId: 'workspace-a',
            docId,
          })),
          candidateProjectIds: ['project-a'],
          projectIds: [],
          selectedProjectId:
            projectResolution === 'selected' ? 'project-a' : null,
          projectResolution,
        },
      });
    }
  }
  t.is(writes, 0);
});

test('automatic memory setting disables implicit extraction but not explicit commands', async t => {
  let writes = 0;
  const service = new ContextMemoryService({
    copilotContextMemory: {
      getPreference: async () => ({ autoMemoryEnabled: false }),
      applyWriterDecision: async () => {
        writes += 1;
        return { operation: 'ADD', memoryId: null };
      },
    },
  } as unknown as Models);

  await service.captureDurableTurn({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    sessionId: 'session-a',
    turn: {
      role: 'user',
      content: 'Our deployment region is eu-west-1.',
    } as never,
  });
  await service.captureDurableTurn({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    sessionId: 'session-a',
    turn: {
      role: 'user',
      content: 'Remember that our deployment region is eu-west-1.',
    } as never,
  });

  t.is(writes, 1);
});

test('ordinary turns skip automatic memory settings and persistence work', async t => {
  let preferenceReads = 0;
  let projectReads = 0;
  let writes = 0;
  const service = new ContextMemoryService({
    copilotContextMemory: {
      getPreference: async () => {
        preferenceReads += 1;
        return { autoMemoryEnabled: true };
      },
      listProjectIdsForDoc: async () => {
        projectReads += 1;
        return [];
      },
      applyWriterDecision: async () => {
        writes += 1;
        return { operation: 'ADD', memoryId: null };
      },
    },
  } as unknown as Models);

  await service.captureDurableTurn({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    docId: 'doc-a',
    sessionId: 'session-a',
    turn: {
      role: 'user',
      content: 'Can you summarize the document for this meeting?',
    } as never,
  });

  t.is(preferenceReads, 0);
  t.is(projectReads, 0);
  t.is(writes, 0);
});

test('automatic memory uses workspace scope when no document is in scope', async t => {
  const stored: Array<Record<string, unknown>> = [];
  const service = new ContextMemoryService({
    copilotContextMemory: {
      getPreference: async () => null,
      applyWriterDecision: async (input: Record<string, unknown>) => {
        stored.push(input);
        return { operation: 'ADD', memoryId: null };
      },
    },
  } as unknown as Models);

  await service.captureDurableTurn({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    sessionId: 'session-a',
    turn: {
      role: 'user',
      content: 'Remember that the deployment codename is Juniper.',
    } as never,
    scope: {
      userId: 'user-a',
      workspaceId: 'workspace-a',
      sessionId: 'session-a',
      primaryDocId: null,
      readableDocIds: [],
      readableDocumentRefs: [],
      candidateProjectIds: [],
      projectIds: [],
      projectResolution: 'none',
      selectedProjectId: null,
    },
  });

  t.is(stored.length, 1);
  t.like(stored[0], {
    workspaceId: 'workspace-a',
    docId: null,
    projectId: null,
    scope: 'workspace',
  });
});

test('automatic memory fails closed across ambiguous projects', async t => {
  const stored: Array<Record<string, unknown>> = [];
  const service = new ContextMemoryService({
    copilotContextMemory: {
      getPreference: async () => null,
      applyWriterDecision: async (input: Record<string, unknown>) => {
        stored.push(input);
        return { operation: 'ADD', memoryId: null };
      },
    },
  } as unknown as Models);

  await service.captureDurableTurn({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    sessionId: 'session-a',
    turn: {
      role: 'user',
      content: 'Remember that the deployment codename is Juniper.',
    } as never,
    scope: {
      userId: 'user-a',
      workspaceId: 'workspace-a',
      sessionId: 'session-a',
      primaryDocId: null,
      readableDocIds: ['doc-a', 'doc-b'],
      readableDocumentRefs: [
        { workspaceId: 'workspace-a', docId: 'doc-a' },
        { workspaceId: 'workspace-a', docId: 'doc-b' },
      ],
      candidateProjectIds: ['project-a', 'project-b'],
      projectIds: [],
      projectResolution: 'ambiguous',
      selectedProjectId: null,
    },
  });

  t.is(stored.length, 0);
});

test('project memory excludes private attachments, invalid source config, and unreadable ungranted history', async t => {
  const stored: unknown[] = [];
  const sources = {
    docIds: [] as string[],
    hasPrivateAttachments: false,
    valid: true,
  };
  const models = {
    ...grantedProjectDocuments([
      { workspaceId: 'workspace-a', docId: 'granted-doc' },
    ]),
    copilotContext: { getSessionSources: async () => sources },
    copilotContextMemory: {
      listProjectMembershipsForDocs: async () => [],
      getProject: async () => ({
        id: 'project-a',
        status: 'active',
        members: [{ userId: 'user-a', role: 'member' }],
      }),
      getPreference: async () => ({ autoMemoryEnabled: true }),
      applyWriterDecision: async (input: unknown) => {
        stored.push(input);
        return { operation: 'ADD', memoryId: 'memory-1' };
      },
    },
  } as unknown as Models;
  const resolver = new ContextScopeResolver(models, {
    filterReadableDocs: async (input: { docs: Array<{ docId: string }> }) =>
      input.docs.filter(doc => doc.docId === 'granted-doc'),
  } as unknown as PermissionService);
  const resolve = () =>
    resolver.resolve({
      userId: 'user-a',
      workspaceId: 'workspace-a',
      sessionId: 'session-a',
      selectedProjectId: 'project-a',
    });
  t.deepEqual((await resolve()).projectIds, ['project-a']);
  const memory = new ContextMemoryService(models);
  for (const state of [
    { docIds: [], hasPrivateAttachments: true, valid: true },
    { docIds: [], hasPrivateAttachments: false, valid: false },
    {
      docIds: ['private-unreadable-doc'],
      hasPrivateAttachments: false,
      valid: true,
    },
  ]) {
    Object.assign(sources, state);
    const scope = await resolve();
    t.is(scope.selectedProjectId, 'project-a');
    t.deepEqual(scope.projectIds, []);
    await memory.captureDurableTurn({
      userId: 'user-a',
      workspaceId: 'workspace-a',
      sessionId: 'session-a',
      turn: {
        role: 'user',
        content: 'Remember that the private deployment region is eu-west-1.',
      } as never,
      scope,
    });
  }
  t.deepEqual(stored, []);
});

test('ContextScopeResolver recognizes candidates without implicitly enabling project memory', async t => {
  let membershipInput: Record<string, unknown> | null = null;
  const resolver = new ContextScopeResolver(
    {
      ...grantedProjectDocuments([
        { workspaceId: 'workspace-a', docId: 'doc-a' },
      ]),
      copilotContext: {
        getSessionSources: async () => ({
          docIds: ['doc-a', 'doc-denied'],
          hasPrivateAttachments: false,
          valid: true,
        }),
      },
      copilotContextMemory: {
        listProjectMembershipsForDocs: async (
          input: Record<string, unknown>
        ) => {
          membershipInput = input;
          return [
            {
              workspaceId: 'workspace-a',
              docId: 'doc-a',
              projectId: 'project-a',
            },
          ];
        },
        getProject: async () => ({
          id: 'project-a',
          status: 'active',
          members: [{ userId: 'user-a', role: 'member' }],
          documents: [{ workspaceId: 'workspace-a', docId: 'doc-a' }],
        }),
      },
    } as unknown as Models,
    {
      filterReadableDocs: async (input: { docs: Array<{ docId: string }> }) =>
        input.docs.filter(doc => doc.docId === 'doc-a'),
    } as unknown as PermissionService
  );

  const scope = await resolver.resolve({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    sessionId: 'session-a',
  });

  t.deepEqual(scope.readableDocIds, ['doc-a']);
  t.deepEqual(scope.projectIds, []);
  t.is(scope.projectResolution, 'single');
  t.deepEqual(membershipInput, {
    userId: 'user-a',
    workspaceId: 'workspace-a',
    docIds: ['doc-a'],
  });
});

test('ContextScopeResolver fails closed when attached docs span projects', async t => {
  const resolver = new ContextScopeResolver(
    {
      copilotContext: {
        getSessionSources: async () => ({
          docIds: ['doc-a', 'doc-b'],
          hasPrivateAttachments: false,
          valid: true,
        }),
      },
      copilotContextMemory: {
        listProjectMembershipsForDocs: async () => [
          {
            workspaceId: 'workspace-a',
            docId: 'doc-a',
            projectId: 'project-a',
          },
          {
            workspaceId: 'workspace-a',
            docId: 'doc-b',
            projectId: 'project-b',
          },
        ],
      },
    } as unknown as Models,
    {
      filterReadableDocs: async (input: { docs: Array<{ docId: string }> }) =>
        input.docs,
    } as unknown as PermissionService
  );

  const scope = await resolver.resolve({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    sessionId: 'session-a',
  });

  t.deepEqual(scope.candidateProjectIds, ['project-a', 'project-b']);
  t.deepEqual(scope.projectIds, []);
  t.is(scope.projectResolution, 'ambiguous');
});

test('ContextScopeResolver fails closed when attached docs mix project and non-project scope', async t => {
  const resolver = new ContextScopeResolver(
    {
      copilotContext: {
        getSessionSources: async () => ({
          docIds: ['doc-project', 'doc-unscoped'],
          hasPrivateAttachments: false,
          valid: true,
        }),
      },
      copilotContextMemory: {
        listProjectMembershipsForDocs: async () => [
          {
            workspaceId: 'workspace-a',
            docId: 'doc-project',
            projectId: 'project-a',
          },
        ],
      },
    } as unknown as Models,
    {
      filterReadableDocs: async (input: { docs: Array<{ docId: string }> }) =>
        input.docs,
    } as unknown as PermissionService
  );

  const scope = await resolver.resolve({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    sessionId: 'session-a',
  });

  t.deepEqual(scope.candidateProjectIds, ['project-a']);
  t.deepEqual(scope.projectIds, []);
  t.is(scope.projectResolution, 'mixed');
});

test('ContextScopeResolver accepts only an authorized project candidate selection', async t => {
  const resolver = new ContextScopeResolver(
    {
      ...grantedProjectDocuments([
        { workspaceId: 'workspace-a', docId: 'doc-b' },
      ]),
      copilotContext: {
        getSessionSources: async () => ({
          docIds: ['doc-a', 'doc-b'],
          hasPrivateAttachments: false,
          valid: true,
        }),
      },
      copilotContextMemory: {
        listProjectMembershipsForDocs: async () => [
          {
            workspaceId: 'workspace-a',
            docId: 'doc-a',
            projectId: 'project-a',
          },
          {
            workspaceId: 'workspace-a',
            docId: 'doc-b',
            projectId: 'project-b',
          },
        ],
        getProject: async (id: string) =>
          id === 'project-b'
            ? {
                id,
                status: 'active',
                members: [{ userId: 'user-a', role: 'member' }],
                documents: [{ workspaceId: 'workspace-a', docId: 'doc-b' }],
              }
            : null,
      },
    } as unknown as Models,
    {
      filterReadableDocs: async (input: { docs: Array<{ docId: string }> }) =>
        input.docs,
    } as unknown as PermissionService
  );

  const selected = await resolver.resolve({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    sessionId: 'session-a',
    selectedProjectId: 'project-b',
  });
  const stale = await resolver.resolve({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    sessionId: 'session-a',
    selectedProjectId: 'project-revoked',
  });

  t.is(selected.projectResolution, 'selected');
  t.deepEqual(selected.projectIds, []);
  t.is(selected.selectedProjectId, 'project-b');
  t.is(stale.projectResolution, 'invalid_selection');
  t.deepEqual(stale.projectIds, []);
  t.is(stale.selectedProjectId, null);
});

test('ContextScopeResolver resolves selected project documents in each source workspace', async t => {
  let grantInput: Record<string, unknown> | null = null;
  const permissionInputs: Array<{
    workspaceId: string;
    docs: Array<{ docId: string }>;
  }> = [];
  const resolver = new ContextScopeResolver(
    {
      intelligenceWorkbenchAuthorization: {
        listGrantedProjectDocuments: async (input: Record<string, unknown>) => {
          grantInput = input;
          return [
            { workspaceId: 'workspace-a', docId: 'doc-shared' },
            { workspaceId: 'workspace-b', docId: 'doc-shared' },
          ];
        },
      },
      copilotContext: {
        getSessionSources: async () => ({
          docIds: [],
          hasPrivateAttachments: false,
          valid: true,
        }),
      },
      copilotContextMemory: {
        listProjectMembershipsForDocs: async () => [],
        getProject: async () => ({
          id: 'project-global',
          status: 'active',
          members: [{ userId: 'user-a', role: 'owner' }],
          documents: [
            { workspaceId: 'workspace-a', docId: 'doc-shared' },
            { workspaceId: 'workspace-b', docId: 'doc-shared' },
          ],
        }),
      },
    } as unknown as Models,
    {
      filterReadableDocs: async (input: {
        workspaceId: string;
        docs: Array<{ docId: string }>;
      }) => {
        permissionInputs.push(input);
        return input.docs;
      },
    } as unknown as PermissionService
  );

  const scope = await resolver.resolve({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    sessionId: 'session-a',
    selectedProjectId: 'project-global',
  });

  t.is(scope.projectResolution, 'selected');
  t.deepEqual(scope.projectIds, ['project-global']);
  t.deepEqual(scope.readableDocIds, []);
  t.deepEqual(scope.readableDocumentRefs, [
    { workspaceId: 'workspace-a', docId: 'doc-shared' },
    { workspaceId: 'workspace-b', docId: 'doc-shared' },
  ]);
  t.deepEqual(permissionInputs.map(input => input.workspaceId).toSorted(), [
    'workspace-a',
    'workspace-b',
  ]);
  t.deepEqual(grantInput, {
    projectId: 'project-global',
    userId: 'user-a',
  });
});

test('ContextScopeResolver keeps selection but excludes project scope when one same-id cross-workspace ref is denied', async t => {
  const resolver = new ContextScopeResolver(
    {
      ...grantedProjectDocuments([
        { workspaceId: 'workspace-a', docId: 'doc-shared' },
        { workspaceId: 'workspace-b', docId: 'doc-shared' },
      ]),
      copilotContext: {
        getSessionSources: async () => ({
          docIds: [],
          hasPrivateAttachments: false,
          valid: true,
        }),
      },
      copilotContextMemory: {
        listProjectMembershipsForDocs: async () => [],
        getProject: async () => ({
          id: 'project-global',
          status: 'active',
          members: [{ userId: 'user-a', role: 'member' }],
          documents: [
            { workspaceId: 'workspace-a', docId: 'doc-shared' },
            { workspaceId: 'workspace-b', docId: 'doc-shared' },
          ],
        }),
      },
    } as unknown as Models,
    {
      filterReadableDocs: async (input: {
        workspaceId: string;
        docs: Array<{ docId: string }>;
      }) => (input.workspaceId === 'workspace-a' ? input.docs : []),
    } as unknown as PermissionService
  );

  const scope = await resolver.resolve({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    sessionId: 'session-a',
    selectedProjectId: 'project-global',
  });

  t.is(scope.projectResolution, 'selected');
  t.is(scope.selectedProjectId, 'project-global');
  t.deepEqual(scope.projectIds, []);
  t.deepEqual(scope.readableDocumentRefs, [
    { workspaceId: 'workspace-a', docId: 'doc-shared' },
  ]);
});

test('ContextScopeResolver keeps an empty member project selected with no refs', async t => {
  const resolver = new ContextScopeResolver(
    {
      ...grantedProjectDocuments([]),
      copilotContext: {
        getSessionSources: async () => ({
          docIds: [],
          hasPrivateAttachments: false,
          valid: true,
        }),
      },
      copilotContextMemory: {
        listProjectMembershipsForDocs: async () => [],
        getProject: async () => ({
          id: 'project-empty',
          status: 'active',
          members: [{ userId: 'user-a', role: 'owner' }],
          documents: [],
        }),
      },
    } as unknown as Models,
    {
      filterReadableDocs: async () => {
        throw new Error('empty project should not resolve document ACLs');
      },
    } as unknown as PermissionService
  );

  const scope = await resolver.resolve({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    sessionId: 'session-a',
    selectedProjectId: 'project-empty',
  });

  t.is(scope.projectResolution, 'selected');
  t.deepEqual(scope.projectIds, ['project-empty']);
  t.deepEqual(scope.readableDocumentRefs, []);
});

test('ContextScopeResolver keeps an all-denied member project selected without widening refs', async t => {
  const resolver = new ContextScopeResolver(
    {
      ...grantedProjectDocuments([
        { workspaceId: 'workspace-a', docId: 'doc-a' },
        { workspaceId: 'workspace-b', docId: 'doc-b' },
      ]),
      copilotContext: {
        getSessionSources: async () => ({
          docIds: [],
          hasPrivateAttachments: false,
          valid: true,
        }),
      },
      copilotContextMemory: {
        listProjectMembershipsForDocs: async () => [],
        getProject: async () => ({
          id: 'project-denied',
          status: 'active',
          members: [{ userId: 'user-a', role: 'member' }],
          documents: [
            { workspaceId: 'workspace-a', docId: 'doc-a' },
            { workspaceId: 'workspace-b', docId: 'doc-b' },
          ],
        }),
      },
    } as unknown as Models,
    {
      filterReadableDocs: async () => [],
    } as unknown as PermissionService
  );

  const scope = await resolver.resolve({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    sessionId: 'session-a',
    selectedProjectId: 'project-denied',
  });

  t.is(scope.projectResolution, 'selected');
  t.is(scope.selectedProjectId, 'project-denied');
  t.deepEqual(scope.projectIds, []);
  t.deepEqual(scope.readableDocIds, []);
  t.deepEqual(scope.readableDocumentRefs, []);
});

test('ContextScopeResolver fails closed when an automatically inferred project has an unreadable ref', async t => {
  const resolver = new ContextScopeResolver(
    {
      ...grantedProjectDocuments([
        { workspaceId: 'workspace-a', docId: 'doc-host' },
        { workspaceId: 'workspace-b', docId: 'doc-denied' },
      ]),
      copilotContext: {
        getSessionSources: async () => ({
          docIds: ['doc-host'],
          hasPrivateAttachments: false,
          valid: true,
        }),
      },
      copilotContextMemory: {
        listProjectMembershipsForDocs: async () => [
          {
            workspaceId: 'workspace-a',
            docId: 'doc-host',
            projectId: 'project-global',
          },
        ],
        getProject: async () => ({
          id: 'project-global',
          status: 'active',
          members: [{ userId: 'user-a', role: 'member' }],
          documents: [
            { workspaceId: 'workspace-a', docId: 'doc-host' },
            { workspaceId: 'workspace-b', docId: 'doc-denied' },
          ],
        }),
      },
    } as unknown as Models,
    {
      filterReadableDocs: async (input: {
        workspaceId: string;
        docs: Array<{ docId: string }>;
      }) => (input.workspaceId === 'workspace-a' ? input.docs : []),
    } as unknown as PermissionService
  );

  const scope = await resolver.resolve({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    sessionId: 'session-a',
  });

  t.is(scope.projectResolution, 'single');
  t.deepEqual(scope.candidateProjectIds, ['project-global']);
  t.deepEqual(scope.projectIds, []);
  t.is(scope.selectedProjectId, null);
});

test('ContextScopeResolver rejects selected projects for non-members', async t => {
  const resolver = new ContextScopeResolver(
    {
      copilotContext: {
        getSessionSources: async () => ({
          docIds: [],
          hasPrivateAttachments: false,
          valid: true,
        }),
      },
      copilotContextMemory: {
        listProjectMembershipsForDocs: async () => [],
        getProject: async () => ({
          id: 'project-private',
          status: 'active',
          members: [{ userId: 'user-b', role: 'owner' }],
          documents: [{ workspaceId: 'workspace-a', docId: 'doc-readable' }],
        }),
      },
    } as unknown as Models,
    {
      filterReadableDocs: async (input: { docs: Array<{ docId: string }> }) =>
        input.docs,
    } as unknown as PermissionService
  );

  const scope = await resolver.resolve({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    sessionId: 'session-a',
    selectedProjectId: 'project-private',
  });

  t.is(scope.projectResolution, 'invalid_selection');
  t.deepEqual(scope.projectIds, []);
  t.deepEqual(scope.readableDocumentRefs, []);
});

test('memory visibility keeps document scope local and project scope global', t => {
  const where = buildContextMemoryVisibilityWhere({
    userId: 'user-a',
    workspaceId: 'workspace-a',
    docId: 'doc-a',
    projectIds: ['project-a'],
  });
  const alternatives = where.OR as Array<Record<string, unknown>>;

  t.is(where.status, 'active');
  t.is(where.visibility, 'private');
  t.true(alternatives.length >= 4);
  t.false(
    alternatives.some(
      alternative =>
        alternative.workspaceId === 'workspace-b' ||
        alternative.docId === 'doc-b' ||
        (typeof alternative.docId === 'object' &&
          alternative.docId !== null &&
          Array.isArray((alternative.docId as { in?: unknown }).in) &&
          (alternative.docId as { in: unknown[] }).in.includes('doc-b')) ||
        (alternative.scope !== 'project' &&
          alternative.ownerUserId !== 'user-a')
    )
  );
  t.true(
    alternatives.some(
      alternative =>
        alternative.ownerUserId === 'user-a' &&
        alternative.workspaceId === 'workspace-a' &&
        alternative.scope === 'document' &&
        typeof alternative.docId === 'object' &&
        alternative.docId !== null &&
        Array.isArray((alternative.docId as { in?: unknown }).in) &&
        (alternative.docId as { in: unknown[] }).in.includes('doc-a')
    )
  );
  t.true(
    alternatives.some(
      alternative =>
        alternative.ownerUserId === undefined &&
        alternative.scope === 'project' &&
        alternative.workspaceId === null &&
        typeof alternative.projectId === 'object' &&
        alternative.projectId !== null &&
        Array.isArray((alternative.projectId as { in?: unknown }).in) &&
        (alternative.projectId as { in: unknown[] }).in.includes('project-a') &&
        typeof alternative.project === 'object' &&
        alternative.project !== null &&
        (alternative.project as { status?: unknown }).status === 'active' &&
        typeof (alternative.project as { members?: unknown }).members ===
          'object'
    )
  );
});

test('memory visibility keeps workspace and document reference pairs exact', t => {
  const where = buildContextMemoryVisibilityWhere({
    userId: 'user-a',
    workspaceId: 'workspace-host',
    documentRefs: [
      { workspaceId: 'workspace-a', docId: 'doc-a' },
      { workspaceId: 'workspace-b', docId: 'doc-b' },
      { workspaceId: 'workspace-a', docId: 'doc-a' },
    ],
  });
  const alternatives = where.OR as Array<Record<string, unknown>>;
  const documentScopes = alternatives.filter(
    alternative => alternative.scope === 'document'
  );

  t.deepEqual(documentScopes, [
    {
      ownerUserId: 'user-a',
      scope: 'document',
      workspaceId: 'workspace-a',
      docId: { in: ['doc-a'] },
      projectId: null,
    },
    {
      ownerUserId: 'user-a',
      scope: 'document',
      workspaceId: 'workspace-b',
      docId: { in: ['doc-b'] },
      projectId: null,
    },
  ]);
  t.false(
    documentScopes.some(
      scope =>
        scope.workspaceId === 'workspace-a' &&
        typeof scope.docId === 'object' &&
        scope.docId !== null &&
        (scope.docId as { in: string[] }).in.includes('doc-b')
    )
  );
});

test('ContextMemoryService loads document titles by exact ordered refs', async t => {
  let metadataInput: unknown = null;
  let metadataOptions: unknown = null;
  const service = new ContextMemoryService({
    doc: {
      findMetas: async (input: unknown, options: unknown) => {
        metadataInput = input;
        metadataOptions = options;
        return [
          { workspaceId: 'workspace-a', docId: 'doc-same', title: 'A' },
          { workspaceId: 'workspace-b', docId: 'doc-same', title: 'B' },
        ];
      },
    },
  } as unknown as Models);
  const refs = [
    { workspaceId: 'workspace-a', docId: 'doc-same' },
    { workspaceId: 'workspace-b', docId: 'doc-same' },
  ];

  const metas = await service.getDocumentMetas(refs);

  t.deepEqual(metadataInput, refs);
  t.deepEqual(metadataOptions, { select: { title: true } });
  t.deepEqual(
    metas.map(meta => meta?.title),
    ['A', 'B']
  );
});

test('ChatSession persists the planner checkpoint on save', async t => {
  const checkpoints: string[] = [];
  const traces: Array<Record<string, unknown>> = [];
  const session = new ChatSession(
    {
      userId: 'user-a',
      sessionId: 'session-a',
      workspaceId: 'workspace-a',
      docId: 'doc-a',
      prompt: {
        name: 'test',
        model: 'test',
        modelSource: 'built_in',
        optionalModels: [],
        optionalModelsSource: 'built_in',
        proModelsSource: 'built_in',
        paramKeys: [],
        params: {},
        source: 'built_in',
        category: 'text',
        overrideApplied: false,
      },
      turns: [
        {
          conversationId: 'session-a',
          role: 'user',
          content: 'Remember that the release uses eu-west-1.',
          attachments: [],
          metadata: {},
          renderTrace: [],
          toolEvents: [],
          createdAt: new Date(),
        },
        {
          conversationId: 'session-a',
          role: 'assistant',
          content: 'Acknowledged.',
          attachments: [],
          metadata: {},
          renderTrace: [],
          toolEvents: [],
          createdAt: new Date(),
        },
        {
          conversationId: 'session-a',
          role: 'user',
          content: 'Continue.',
          attachments: [],
          metadata: {},
          renderTrace: [],
          toolEvents: [],
          createdAt: new Date(),
        },
      ],
    },
    (_prompt, turns) => tailRenderer(2)(turns),
    undefined,
    undefined,
    {
      planner: new ContextPlanner(),
      memories: [],
      checkpoint: null,
      scope: {
        userId: 'user-a',
        workspaceId: 'workspace-a',
        sessionId: 'session-a',
        primaryDocId: 'doc-a',
        readableDocIds: ['doc-a'],
        readableDocumentRefs: [{ workspaceId: 'workspace-a', docId: 'doc-a' }],
        candidateProjectIds: [],
        projectIds: [],
        projectResolution: 'none',
        selectedProjectId: null,
      },
      saveCheckpoint: async checkpoint => {
        checkpoints.push(checkpoint.summary);
      },
      savePlanTrace: async trace => {
        traces.push(trace);
      },
      retrieveMemories: async () => [],
    }
  );

  session.finish({});
  await session.save();

  t.is(checkpoints.length, 1);
  t.true(checkpoints[0].includes('release uses eu-west-1'));
  t.is(traces.length, 1);
  t.like(traces[0], {
    sessionId: 'session-a',
    strategyVersion: CONTEXT_PLANNER_STRATEGY_VERSION,
    candidateMemoryCount: 0,
  });
  t.deepEqual((traces[0].scope as Record<string, unknown>).readableDocIds, [
    'doc-a',
  ]);
  t.deepEqual(
    (traces[0].scope as Record<string, unknown>).readableDocumentRefs,
    [{ workspaceId: 'workspace-a', docId: 'doc-a' }]
  );
});
