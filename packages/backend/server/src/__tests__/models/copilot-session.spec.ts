import { randomUUID } from 'node:crypto';

import { PrismaClient, User, Workspace } from '@prisma/client';
import ava, { ExecutionContext, TestFn } from 'ava';

import { CopilotPromptInvalid, CopilotSessionInvalidInput } from '../../base';
import {
  CopilotSessionModel,
  Models,
  UpdateChatSessionOptions,
  UserModel,
  WorkspaceModel,
} from '../../models';
import { createTestingModule, type TestingModule } from '../utils';
import { cleanObject } from '../utils/copilot';

interface Context {
  module: TestingModule;
  db: PrismaClient;
  user: UserModel;
  workspace: WorkspaceModel;
  copilotSession: CopilotSessionModel;
  models: Models;
}

const test = ava as TestFn<Context>;

test.before(async t => {
  const module = await createTestingModule();
  t.context.user = module.get(UserModel);
  t.context.workspace = module.get(WorkspaceModel);
  t.context.copilotSession = module.get(CopilotSessionModel);
  t.context.models = module.get(Models);
  t.context.db = module.get(PrismaClient);
  t.context.module = module;
});

let user: User;
let workspace: Workspace;

test.beforeEach(async t => {
  await t.context.module.initTestingDB();
  user = await t.context.user.create({
    email: 'test@affine.pro',
  });
  workspace = await t.context.workspace.create(user.id);
});

test.after(async t => {
  await t.context.module.close();
});

// Test data constants
const TEST_PROMPTS = {
  NORMAL: 'test-prompt',
  ACTION: 'action-prompt',
} as const;

// Helper functions
const createTestPrompts = async (
  _copilotSession: CopilotSessionModel,
  db: PrismaClient
) => {
  await db.aiPrompt.create({
    data: { name: TEST_PROMPTS.NORMAL, model: 'gpt-5-mini', action: null },
  });
  await db.aiPrompt.create({
    data: { name: TEST_PROMPTS.ACTION, model: 'gpt-5-mini', action: 'edit' },
  });
};

const createTestSession = async (
  t: ExecutionContext<Context>,
  overrides: Partial<{
    sessionId: string;
    userId: string;
    workspaceId: string;
    docId: string | null;
    pinned: boolean;
    promptName: string;
    promptAction: string | null;
  }> = {}
) => {
  const sessionData = {
    sessionId: randomUUID(),
    userId: user.id,
    workspaceId: workspace.id,
    docId: null,
    pinned: false,
    title: null,
    promptName: TEST_PROMPTS.NORMAL,
    promptAction: null,
    ...overrides,
  };

  await t.context.copilotSession.create(sessionData);
  return sessionData;
};

const getSessionStates = async (db: PrismaClient, sessionIds: string[]) => {
  const sessions = await Promise.all(
    sessionIds.map(id =>
      db.aiSession.findUnique({
        where: { id },
        select: { id: true, pinned: true, docId: true },
      })
    )
  );
  return sessions;
};

test('forks cannot move private or project history across user, workspace, or project boundaries', async t => {
  const { db, copilotSession, models } = t.context;
  await createTestPrompts(copilotSession, db);
  const personal = await createTestSession(t);
  const project = await db.aiContextProject.create({
    data: {
      name: 'Fork boundary',
      createdByUserId: user.id,
      members: { create: { userId: user.id, role: 'owner' } },
    },
  });
  const source = {
    ...personal,
    sessionId: randomUUID(),
    selectedContextProjectId: project.id,
  };
  await copilotSession.create(source);
  const child = {
    ...source,
    sessionId: randomUUID(),
    parentSessionId: source.sessionId,
  };
  t.truthy(await copilotSession.create(child));
  for (const selectedContextProjectId of [null, randomUUID()]) {
    await t.throwsAsync(
      copilotSession.create({
        ...child,
        sessionId: randomUUID(),
        selectedContextProjectId,
      })
    );
  }
  await t.throwsAsync(
    copilotSession.create({
      ...child,
      sessionId: randomUUID(),
      docId: 'another-doc',
    })
  );
  await t.throwsAsync(
    copilotSession.create({
      ...child,
      sessionId: randomUUID(),
      workspaceId: randomUUID(),
    })
  );
  await t.throwsAsync(
    copilotSession.create({
      ...child,
      sessionId: randomUUID(),
      parentSessionId: personal.sessionId,
    })
  );
  const anotherUser = await models.user.create({
    email: `fork-${randomUUID()}@example.com`,
  });
  await db.aiContextProjectMember.create({
    data: { projectId: project.id, userId: anotherUser.id, role: 'member' },
  });
  await t.throwsAsync(
    copilotSession.create({
      ...child,
      sessionId: randomUUID(),
      userId: anotherUser.id,
    })
  );
  await t.throwsAsync(
    copilotSession.create({
      ...personal,
      sessionId: randomUUID(),
      parentSessionId: personal.sessionId,
      userId: anotherUser.id,
    })
  );
  const foreignProjectForks = await copilotSession.list({
    userId: anotherUser.id,
    workspaceId: workspace.id,
    fork: true,
    action: false,
  });
  t.false(foreignProjectForks.some(session => session.id === child.sessionId));
  t.is(
    await copilotSession.count({
      userId: user.id,
      workspaceId: workspace.id,
      sessionId: child.sessionId,
    }),
    1
  );
  await db.aiContextProjectMember.updateMany({
    where: { projectId: project.id, userId: anotherUser.id },
    data: { role: 'owner' },
  });
  await db.aiContextProjectMember.deleteMany({
    where: { projectId: project.id, userId: user.id },
  });
  t.is(
    await copilotSession.count({
      userId: user.id,
      workspaceId: workspace.id,
      sessionId: child.sessionId,
      action: false,
      fork: true,
    }),
    0
  );
  await t.throwsAsync(
    copilotSession.create({ ...child, sessionId: randomUUID() })
  );
  await db.aiContextProjectMember.create({
    data: { projectId: project.id, userId: user.id, role: 'owner' },
  });
  await db.aiContextProject.update({
    where: { id: project.id },
    data: { status: 'archived' },
  });
  await t.throwsAsync(
    copilotSession.create({ ...child, sessionId: randomUUID() })
  );
  t.is(
    await copilotSession.count({
      userId: user.id,
      workspaceId: workspace.id,
      sessionId: child.sessionId,
    }),
    0
  );
  t.is(
    await copilotSession.count({
      userId: user.id,
      workspaceId: workspace.id,
      sessionId: child.sessionId,
      action: false,
      fork: true,
    }),
    0
  );
});

test('project selection cannot rebind a conversation or adopt previous personal messages', async t => {
  const { db, copilotSession } = t.context;
  await createTestPrompts(copilotSession, db);
  const project = await db.aiContextProject.create({
    data: {
      name: 'Conversation boundary',
      createdByUserId: user.id,
      members: { create: { userId: user.id, role: 'owner' } },
    },
  });
  const first = await createTestSession(t);
  await copilotSession.update({
    userId: user.id,
    sessionId: first.sessionId,
    selectedContextProjectId: project.id,
  });
  await t.throwsAsync(
    copilotSession.update({
      userId: user.id,
      sessionId: first.sessionId,
      selectedContextProjectId: null,
    }),
    { instanceOf: CopilotSessionInvalidInput }
  );
  await copilotSession.update({
    userId: user.id,
    sessionId: first.sessionId,
    selectedContextProjectId: project.id,
  });
  const personal = await createTestSession(t);
  await addMessagesToSession(
    copilotSession,
    personal.sessionId,
    'Personal material'
  );
  await t.throwsAsync(
    copilotSession.update({
      userId: user.id,
      sessionId: personal.sessionId,
      selectedContextProjectId: project.id,
    }),
    { instanceOf: CopilotSessionInvalidInput }
  );
  t.is(
    (
      await db.aiSession.findUniqueOrThrow({
        where: { id: personal.sessionId },
      })
    ).selectedContextProjectId,
    null
  );
  await t.throwsAsync(
    copilotSession.update({
      userId: user.id,
      sessionId: first.sessionId,
      docId: 'document',
    }),
    { instanceOf: CopilotSessionInvalidInput }
  );

  const projectState = {
    ...first,
    sessionId: randomUUID(),
    selectedContextProjectId: project.id,
  };
  t.is(await copilotSession.create(projectState, true), first.sessionId);
  t.is(
    await copilotSession.create(
      { ...projectState, selectedContextProjectId: null },
      true
    ),
    personal.sessionId
  );
  const other = await db.aiContextProject.create({
    data: {
      name: 'Another project',
      createdByUserId: user.id,
      members: { create: { userId: user.id, role: 'owner' } },
    },
  });
  const otherSession = await copilotSession.create(
    { ...projectState, selectedContextProjectId: other.id },
    true
  );
  t.not(otherSession, first.sessionId);
  t.not(otherSession, personal.sessionId);
  await t.throwsAsync(
    copilotSession.create({
      ...projectState,
      sessionId: randomUUID(),
      docId: 'document',
    }),
    { instanceOf: CopilotSessionInvalidInput }
  );
  const outsider = await t.context.user.create({
    email: 'outsider@affine.pro',
  });
  await t.throwsAsync(
    copilotSession.create({ ...projectState, userId: outsider.id }, true),
    { instanceOf: CopilotSessionInvalidInput }
  );
  await db.aiContextProject.update({
    where: { id: project.id },
    data: { status: 'archived' },
  });
  await t.throwsAsync(copilotSession.create(projectState, true), {
    instanceOf: CopilotSessionInvalidInput,
  });
});

const addMessagesToSession = async (
  copilotSession: CopilotSessionModel,
  sessionId: string,
  content: string,
  delayMs: number = 0
) => {
  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  await copilotSession.updateMessages({
    sessionId,
    userId: user.id,
    prompt: { model: 'gpt-5-mini' },
    messages: [
      {
        role: 'user',
        content,
        createdAt: new Date(),
      },
    ],
  });
};

const createSessionWithMessages = async (
  t: ExecutionContext<Context>,
  overrides: Parameters<typeof createTestSession>[1] = {},
  messageContent?: string,
  delayMs: number = 0
) => {
  const sessionData = await createTestSession(t, overrides);
  if (messageContent) {
    await addMessagesToSession(
      t.context.copilotSession,
      sessionData.sessionId,
      messageContent,
      delayMs
    );
  }
  return sessionData;
};

// Simplified update assertion helpers
type UpdateData = Omit<UpdateChatSessionOptions, 'userId' | 'sessionId'>;

test('should list and filter session type', async t => {
  const { copilotSession, db } = t.context;

  await createTestPrompts(copilotSession, db);

  const docId = 'doc-id-1';
  await createTestSession(t, { sessionId: randomUUID() });
  await createTestSession(t, { sessionId: randomUUID(), pinned: true });
  await createTestSession(t, { sessionId: randomUUID(), docId });
  await createTestSession(t, {
    sessionId: randomUUID(),
    docId,
    promptName: 'action-prompt',
    promptAction: 'action',
  });

  // should list sessions
  {
    const workspaceSessions = await copilotSession.list({
      userId: user.id,
      workspaceId: workspace.id,
      docId: null,
    });

    t.snapshot(
      workspaceSessions.map(s => ({ docId: s.docId, pinned: s.pinned })),
      'workspace sessions should include workspace and pinned sessions'
    );
  }

  {
    const docSessions = await copilotSession.list({
      userId: user.id,
      workspaceId: workspace.id,
      docId,
    });

    t.is(
      docSessions.length,
      2,
      'should return exactly 2 doc sessions for the specified docId'
    );

    t.true(
      docSessions.every(s => s.docId === docId),
      'all returned sessions should have the specified docId'
    );

    t.snapshot(
      cleanObject(
        docSessions.toSorted((a, b) =>
          a.promptName.localeCompare(b.promptName)
        ),
        ['id', 'userId', 'workspaceId', 'createdAt', 'updatedAt', 'tokenCost']
      ),
      'doc sessions should only include sessions with matching docId'
    );
  }

  // should identify session types
  {
    // check get session type
    const testCases = [
      { docId: null, pinned: false },
      { docId: undefined, pinned: false },
      { docId: null, pinned: true },
      { docId, pinned: false },
    ];

    const sessionTypeResults = testCases.map(session => ({
      session,
      type: copilotSession.getSessionType(session),
    }));

    t.snapshot(sessionTypeResults, 'session type identification results');
  }
});

test('should validate session prompt compatibility', async t => {
  const { copilotSession, db } = t.context;
  await createTestPrompts(copilotSession, db);

  const sessionTypes = [
    { name: 'workspace', session: { docId: null, pinned: false } },
    { name: 'pinned', session: { docId: null, pinned: true } },
    { name: 'doc', session: { docId: randomUUID(), pinned: false } },
  ];

  const result = sessionTypes.flatMap(({ name, session }) => [
    // non-action prompts should work for all session types
    {
      sessionType: name,
      promptType: 'non-action',
      shouldThrow: false,
      result: (() => {
        try {
          copilotSession.checkSessionPrompt(session, {
            name: TEST_PROMPTS.NORMAL,
            action: undefined,
          });
          return 'success';
        } catch (error) {
          return error instanceof CopilotPromptInvalid
            ? 'CopilotPromptInvalid'
            : 'unknown';
        }
      })(),
    },
    // action prompts should only work for doc session type
    {
      sessionType: name,
      promptType: 'action',
      shouldThrow: name !== 'doc',
      result: (() => {
        try {
          copilotSession.checkSessionPrompt(session, {
            name: TEST_PROMPTS.ACTION,
            action: 'edit',
          });
          return 'success';
        } catch (error) {
          return error instanceof CopilotPromptInvalid
            ? 'CopilotPromptInvalid'
            : 'unknown';
        }
      })(),
    },
  ]);

  t.snapshot(result, 'session prompt validation results');
});

test('should pin and unpin sessions', async t => {
  const { copilotSession, db } = t.context;

  await createTestPrompts(copilotSession, db);

  const firstSessionId = 'first-session-id';
  const secondSessionId = 'second-session-id';
  const thirdSessionId = 'third-session-id';

  // should unpin existing pinned session when creating a new one
  {
    await copilotSession.create({
      sessionId: firstSessionId,
      userId: user.id,
      workspaceId: workspace.id,
      docId: null,
      promptName: 'test-prompt',
      promptAction: null,
      pinned: true,
      title: null,
    });

    const firstSession = await copilotSession.get(firstSessionId);
    t.truthy(firstSession, 'first session should be created successfully');
    t.is(firstSession?.pinned, true, 'first session should be pinned');

    // should unpin the first one when creating second pinned session
    await copilotSession.create({
      sessionId: secondSessionId,
      userId: user.id,
      workspaceId: workspace.id,
      docId: null,
      promptName: 'test-prompt',
      promptAction: null,
      pinned: true,
      title: null,
    });

    const sessionStatesAfterSecondPin = await getSessionStates(db, [
      firstSessionId,
      secondSessionId,
    ]);

    t.snapshot(
      sessionStatesAfterSecondPin,
      'session states after creating second pinned session'
    );
  }

  // should can unpin a pinned session
  {
    await createTestSession(t, { sessionId: thirdSessionId, pinned: true });
    const unpinResult = await copilotSession.unpin(workspace.id, user.id);
    t.is(
      unpinResult,
      true,
      'unpin operation should return true when sessions are unpinned'
    );

    const unpinResultAgain = await copilotSession.unpin(workspace.id, user.id);
    t.snapshot(
      unpinResultAgain,
      'should return false when no sessions to unpin'
    );
  }

  // should unpin all sessions
  {
    const allSessionsAfterUnpin = await db.aiSession.findMany({
      where: { id: { in: [firstSessionId, secondSessionId, thirdSessionId] } },
      select: { pinned: true, id: true },
      orderBy: { id: 'asc' },
    });

    t.snapshot(
      allSessionsAfterUnpin,
      'all sessions should be unpinned after unpin operation'
    );
  }
});

test('should handle session updates and type conversions', async t => {
  const { copilotSession, db } = t.context;
  await createTestPrompts(copilotSession, db);

  const sessionId = randomUUID();
  const actionSessionId = randomUUID();
  const forkedSessionId = randomUUID();
  const parentSessionId = randomUUID();
  const docId = randomUUID();

  {
    await createTestSession(t, { sessionId });
    await createTestSession(t, {
      sessionId: actionSessionId,
      promptName: TEST_PROMPTS.ACTION,
      promptAction: 'edit',
      docId,
    });
    await createTestSession(t, { sessionId: parentSessionId, docId });
    await db.aiSession.create({
      data: {
        id: forkedSessionId,
        workspaceId: workspace.id,
        userId: user.id,
        docId,
        pinned: false,
        promptName: TEST_PROMPTS.NORMAL,
        promptAction: null,
        parentSessionId,
      },
    });
  }

  const updateTestCases = [
    // action sessions should reject all updates
    {
      sessionId: actionSessionId,
      updates: [
        { docId: 'new-doc', expected: 'reject' },
        { pinned: true, expected: 'reject' },
        { promptName: TEST_PROMPTS.NORMAL, expected: 'reject' },
      ],
    },
    // forked sessions should reject docId updates but allow others
    {
      sessionId: forkedSessionId,
      updates: [
        { pinned: true, expected: 'allow' },
        { promptName: TEST_PROMPTS.NORMAL, expected: 'allow' },
        { docId: 'new-doc', expected: 'reject' },
      ],
    },
    // Regular sessions - prompt validation
    {
      sessionId,
      updates: [
        { promptName: TEST_PROMPTS.NORMAL, expected: 'allow' },
        { promptName: TEST_PROMPTS.ACTION, expected: 'reject' },
        { promptName: 'non-existent-prompt', expected: 'reject' },
      ],
    },
  ];

  const updateResults = [];
  for (const { sessionId: testSessionId, updates } of updateTestCases) {
    for (const update of updates) {
      const { expected: _, ...updateData } = update;
      try {
        await t.context.copilotSession.update({
          ...updateData,
          userId: user.id,
          sessionId: testSessionId,
        });
        updateResults.push({
          sessionType:
            testSessionId === actionSessionId
              ? 'action'
              : testSessionId === forkedSessionId
                ? 'forked'
                : 'regular',
          update: updateData,
          result: 'success',
        });
      } catch (error) {
        updateResults.push({
          sessionType:
            testSessionId === actionSessionId
              ? 'action'
              : testSessionId === forkedSessionId
                ? 'forked'
                : 'regular',
          update: updateData,
          result:
            error instanceof CopilotSessionInvalidInput ? 'rejected' : 'error',
        });
      }
    }
  }

  t.snapshot(updateResults, 'session update validation results');

  // session type conversions
  const existingPinnedId = randomUUID();
  await createTestSession(t, { sessionId: existingPinnedId, pinned: true });

  await copilotSession.update({ userId: user.id, sessionId, pinned: true });

  // pinning behavior
  const states = await getSessionStates(db, [sessionId, existingPinnedId]);
  const pinnedCount = states.filter(s => s?.pinned).length;
  const unpinnedCount = states.filter(s => s && !s.pinned).length;

  t.snapshot(
    {
      totalSessions: states.length,
      pinnedSessions: pinnedCount,
      unpinnedSessions: unpinnedCount,
      onlyOneSessionPinned: pinnedCount === 1,
    },
    'pinning behavior - should unpin existing when pinning new'
  );

  // type conversions
  const conversionSteps = [];
  const conversions: Array<[string, UpdateData]> = [
    ['workspace_to_doc', { docId, pinned: false }],
    ['doc_to_workspace', { docId: null }],
    ['workspace_to_pinned', { pinned: true }],
  ];

  for (const [step, data] of conversions) {
    await copilotSession.update({ userId: user.id, sessionId, ...data });
    const session = await db.aiSession.findUnique({
      where: { id: sessionId },
      select: { docId: true, pinned: true },
    });
    conversionSteps.push({
      step,
      sessionState: {
        hasDocId: !!session?.docId,
        pinned: !!session?.pinned,
      },
      type: copilotSession.getSessionType(session!),
    });
  }

  t.snapshot(conversionSteps, 'session type conversion steps');
});

test('should handle session queries, ordering, and filtering', async t => {
  const { copilotSession, db } = t.context;
  await createTestPrompts(copilotSession, db);

  const docId = randomUUID();
  const sessionIds: string[] = [];
  const sessionConfigs = [
    { type: 'workspace', config: { docId: null, pinned: false } },
    { type: 'pinned', config: { docId: null, pinned: true } },
    { type: 'doc', config: { docId, pinned: false }, withMessages: true },
    {
      type: 'action',
      config: { docId, promptName: TEST_PROMPTS.ACTION, promptAction: 'edit' },
    },
  ];

  // create sessions with timing delays for ordering tests
  for (let i = 0; i < sessionConfigs.length; i++) {
    const { config, withMessages } = sessionConfigs[i];
    const sessionId = randomUUID();
    sessionIds.push(sessionId);

    if (withMessages) {
      await createSessionWithMessages(
        t,
        { sessionId, ...config },
        `Message for session ${i}`,
        100 * i
      );
    } else {
      await createTestSession(t, { sessionId, ...config });
    }
  }

  // Create additional doc sessions for multiple doc test
  for (let i = 0; i < 2; i++) {
    const sessionId = randomUUID();
    sessionIds.push(sessionId);
    await createSessionWithMessages(
      t,
      { sessionId, docId },
      `Additional doc message ${i}`,
      200 + 100 * i
    );
  }

  // create fork session
  const parentSessionId = sessionIds[2]; // use first doc session as parent
  const forkedSessionId = randomUUID();
  await db.aiSession.create({
    data: {
      id: forkedSessionId,
      workspaceId: workspace.id,
      userId: user.id,
      docId,
      pinned: false,
      promptName: TEST_PROMPTS.NORMAL,
      promptAction: null,
      parentSessionId,
    },
  });

  const baseParams = { userId: user.id, workspaceId: workspace.id };
  const docParams = { ...baseParams, docId };
  const queryTestCases = [
    { name: 'all_workspace_sessions', params: baseParams },
    {
      name: 'workspace_sessions_with_messages',
      params: { ...baseParams, docId: null, withMessages: true },
    },
    {
      name: 'doc_sessions_with_messages',
      params: { ...docParams, withMessages: true },
    },
    {
      name: 'recent_top3_sessions',
      params: { ...baseParams, limit: 3, sessionOrder: 'desc' as const },
    },
    {
      name: 'non_action_sessions',
      params: { ...docParams, action: false },
    },
    { name: 'non_fork_sessions', params: { ...docParams, fork: false } },
    {
      name: 'latest_valid_session',
      params: {
        ...docParams,
        limit: 1,
        sessionOrder: 'desc' as const,
        action: false,
        fork: false,
      },
    },
  ];

  const queryResults: Record<string, any> = {};
  for (const { name, params } of queryTestCases) {
    const sessions = await copilotSession.list(params);
    queryResults[name] = {
      count: sessions.length,
      sessionTypes: sessions.map(s => ({
        type: copilotSession.getSessionType(s),
        hasMessages: !!s.messages?.length,
        messageCount: s.messages?.length || 0,
        isAction: s.promptName === TEST_PROMPTS.ACTION,
        isFork: !!s.parentSessionId,
      })),
    };
  }

  t.snapshot(queryResults, 'comprehensive session query results');

  // should list sessions appear in correct order
  {
    const docSessionsWithMessages = await copilotSession.list({
      userId: user.id,
      workspaceId: workspace.id,
      docId,
      withMessages: true,
      sessionOrder: 'desc',
    });

    // check sessions are returned in desc order by updatedAt
    if (docSessionsWithMessages.length > 1) {
      for (let i = 1; i < docSessionsWithMessages.length; i++) {
        const currentSession = docSessionsWithMessages[i - 1];
        const nextSession = docSessionsWithMessages[i];
        t.true(
          currentSession.updatedAt >= nextSession.updatedAt,
          `sessions should be ordered by updatedAt desc: ${currentSession.updatedAt} >= ${nextSession.updatedAt}`
        );
      }
    }
  }

  // should update `updatedAt` when updating messages
  {
    const oldestDocSession = await copilotSession.list({
      userId: user.id,
      workspaceId: workspace.id,
      docId,
      sessionOrder: 'asc',
      limit: 1,
    });

    if (oldestDocSession.length > 0) {
      const sessionId = oldestDocSession[0].id;

      // get initial updatedAt
      const sessionBeforeUpdate = await db.aiSession.findUnique({
        where: { id: sessionId },
        select: { updatedAt: true },
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      await addMessagesToSession(
        copilotSession,
        sessionId,
        'Update to verify sorting'
      );

      const sessionAfterUpdate = await db.aiSession.findUnique({
        where: { id: sessionId },
        select: { updatedAt: true },
      });
      t.true(
        sessionAfterUpdate!.updatedAt > sessionBeforeUpdate!.updatedAt,
        'updatedAt should be updated after adding messages'
      );

      // the updated session now should appears first in desc order
      const sessionsAfterUpdate = await copilotSession.list({
        userId: user.id,
        workspaceId: workspace.id,
        docId,
        sessionOrder: 'desc',
      });
      t.is(
        sessionsAfterUpdate[0].id,
        sessionId,
        'session with updated messages should appear first in descending order'
      );
    }
  }

  // should get latest valid session
  {
    const latestValidSessions = await copilotSession.list({
      userId: user.id,
      workspaceId: workspace.id,
      docId,
      limit: 1,
      sessionOrder: 'desc',
      action: false,
      fork: false,
    });

    if (latestValidSessions.length > 0) {
      const latestSession = latestValidSessions[0];

      // verify this is indeed a non-action, non-fork session
      t.falsy(
        latestSession.parentSessionId,
        'latest session should not be a fork'
      );
      t.not(
        latestSession.promptName,
        TEST_PROMPTS.ACTION,
        'latest session should not use action prompt'
      );

      // verify it's the most recently updated among valid sessions
      const allValidSessions = await copilotSession.list({
        userId: user.id,
        workspaceId: workspace.id,
        docId,
        action: false,
        fork: false,
        sessionOrder: 'desc',
      });

      if (allValidSessions.length > 0) {
        t.is(
          allValidSessions[0].id,
          latestSession.id,
          'latest valid session should be the first in the ordered list'
        );
      }
    }
  }

  // session type identification
  const sessionTypeTests = [
    { docId: null, pinned: false },
    { docId: undefined, pinned: false },
    { docId: null, pinned: true },
    { docId: 'test-doc-id', pinned: false },
  ];

  const sessionTypeResults = sessionTypeTests.map(session => ({
    session,
    type: copilotSession.getSessionType(session),
  }));

  t.snapshot(sessionTypeResults, 'session type identification results');
});

test('should handle fork and session attachment operations', async t => {
  const { copilotSession } = t.context;
  await createTestPrompts(copilotSession, t.context.db);

  const parentSessionId = randomUUID();
  const docId = randomUUID();

  await createSessionWithMessages(
    t,
    { sessionId: parentSessionId, docId },
    'Original message'
  );

  const forkTestCases = [
    {
      sessionId: randomUUID(),
      docId: null,
      pinned: false,
      description: 'workspace fork',
    },
    { sessionId: randomUUID(), docId, pinned: false, description: 'doc fork' },
    {
      sessionId: randomUUID(),
      docId: null,
      pinned: true,
      description: 'pinned fork',
    },
  ];

  // test unpinning behavior
  const existingPinnedId = randomUUID();
  await createTestSession(t, { sessionId: existingPinnedId, pinned: true });

  const performForkOperation = async (
    copilotSession: CopilotSessionModel,
    parentSessionId: string,
    forkConfig: {
      sessionId: string;
      docId: string | null;
      pinned: boolean;
    }
  ) => {
    return await copilotSession.fork({
      sessionId: forkConfig.sessionId,
      userId: user.id,
      workspaceId: workspace.id,
      docId: forkConfig.docId,
      pinned: forkConfig.pinned,
      title: null,
      parentSessionId,
      prompt: { name: TEST_PROMPTS.NORMAL, action: null, model: 'gpt-5-mini' },
      messages: [
        {
          role: 'user',
          content: 'Original message',
          createdAt: new Date(),
        },
      ],
    });
  };

  // fork operations
  const forkResults = await Promise.all(
    forkTestCases.map(async test => {
      const returnedId = await performForkOperation(
        copilotSession,
        parentSessionId,
        test
      );
      const forkedSession = await copilotSession.get(test.sessionId);
      return {
        description: test.description,
        success: returnedId === test.sessionId,
        actualState: forkedSession
          ? {
              hasDocId: !!forkedSession.docId,
              isDocIdCorrect: forkedSession.docId === test.docId,
              pinned: forkedSession.pinned,
              hasParent: !!forkedSession.parentSessionId,
            }
          : null,
      };
    })
  );

  // check if pinned fork unpinned existing session
  const originalPinned = await copilotSession.get(existingPinnedId);

  t.snapshot(
    {
      forkResults,
      existingPinnedSessionUnpinned: !originalPinned?.pinned,
    },
    'fork operation results'
  );

  // attach/detach operations
  const workspaceSessionId = randomUUID();
  const existingDocSessionId = randomUUID();
  const attachTestDocId = randomUUID();

  // sessions for attach/detach test
  await createTestSession(t, { sessionId: workspaceSessionId, docId: null });
  await createTestSession(t, {
    sessionId: existingDocSessionId,
    docId: attachTestDocId,
  });

  // attach: workspace -> doc
  await copilotSession.update({
    userId: user.id,
    sessionId: workspaceSessionId,
    docId: attachTestDocId,
  });

  const docSessionsAfterAttach = await copilotSession.list({
    userId: user.id,
    workspaceId: workspace.id,
    docId: attachTestDocId,
  });

  // detach: doc -> workspace
  await copilotSession.update({
    userId: user.id,
    sessionId: workspaceSessionId,
    docId: null,
  });

  const workspaceSessionsAfterDetach = await copilotSession.list({
    userId: user.id,
    workspaceId: workspace.id,
    docId: null,
  });

  const remainingDocSessions = await copilotSession.list({
    userId: user.id,
    workspaceId: workspace.id,
    docId: attachTestDocId,
  });

  t.snapshot(
    {
      attachPhase: {
        docSessionCount: docSessionsAfterAttach.length,
        bothSessionsPresent:
          docSessionsAfterAttach.some(s => s.id === workspaceSessionId) &&
          docSessionsAfterAttach.some(s => s.id === existingDocSessionId),
      },
      detachPhase: {
        workspaceSessionExists: workspaceSessionsAfterDetach.some(
          s => s.id === workspaceSessionId && !s.pinned
        ),
        originalDocSessionRemains:
          remainingDocSessions.length === 1 &&
          remainingDocSessions[0].id === existingDocSessionId,
      },
    },
    'attach and detach operation results'
  );
});

test('should cleanup empty sessions correctly', async t => {
  const { copilotSession, db } = t.context;
  await createTestPrompts(copilotSession, db);

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // should be deleted
  const neverUsedSessionIds: string[] = [randomUUID(), randomUUID()];
  await Promise.all(
    neverUsedSessionIds.map(async id => {
      await createTestSession(t, { sessionId: id });
      await db.aiSession.update({
        where: { id },
        data: { messageCost: 0, updatedAt: oneDayAgo },
      });
    })
  );

  // should be marked as deleted
  const emptySessionIds: string[] = [randomUUID(), randomUUID()];
  await Promise.all(
    emptySessionIds.map(async id => {
      await createTestSession(t, { sessionId: id });
      await db.aiSession.update({
        where: { id },
        data: { messageCost: 100, updatedAt: oneDayAgo },
      });
    })
  );

  // should not be affected
  const recentSessionId = randomUUID();
  await createTestSession(t, { sessionId: recentSessionId });
  await db.aiSession.update({
    where: { id: recentSessionId },
    data: { messageCost: 0, updatedAt: twoHoursAgo },
  });

  // Create session with messages (should not be affected)
  const sessionWithMsgId = randomUUID();
  await createSessionWithMessages(
    t,
    { sessionId: sessionWithMsgId },
    'test message'
  );

  const result = await copilotSession.cleanupEmptySessions(oneDayAgo);

  const remainingSessions = await db.aiSession.findMany({
    where: {
      id: {
        in: [
          ...neverUsedSessionIds,
          ...emptySessionIds,
          recentSessionId,
          sessionWithMsgId,
        ],
      },
    },
    select: { id: true, deletedAt: true, pinned: true },
  });

  const sessionTypeOrder = {
    zeroCost: 0,
    noMessages: 1,
    recent: 2,
    withMessages: 3,
  };
  type SessionType = keyof typeof sessionTypeOrder;
  const remainingSessionDiagnostics = remainingSessions
    .map(s => {
      const type: SessionType = neverUsedSessionIds.includes(s.id)
        ? 'zeroCost'
        : emptySessionIds.includes(s.id)
          ? 'noMessages'
          : s.id === recentSessionId
            ? 'recent'
            : 'withMessages';

      return {
        deleted: !!s.deletedAt,
        pinned: s.pinned,
        type,
      };
    })
    .sort((a, b) => sessionTypeOrder[a.type] - sessionTypeOrder[b.type]);

  t.snapshot(
    {
      cleanupResult: result,
      remainingSessions: remainingSessionDiagnostics,
    },
    'cleanup empty sessions results'
  );
});

test('should append durable message and account durable costs', async t => {
  const { copilotSession, db } = t.context;
  await createTestPrompts(copilotSession, db);

  const { sessionId } = await createTestSession(t);
  const appended = await copilotSession.appendMessage({
    sessionId,
    userId: user.id,
    prompt: { model: 'gpt-5-mini' },
    message: {
      role: 'user',
      content: 'hello durable world',
      params: { foo: 'bar' },
      createdAt: new Date(),
    },
  });

  const afterAppend = await db.aiSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { messageCost: true, tokenCost: true },
  });

  t.truthy(appended.id);
  t.is(afterAppend.messageCost, 1);
  t.true(afterAppend.tokenCost > 0);
  t.deepEqual(appended.params, { foo: 'bar' });

  const appendedBare = await copilotSession.appendMessage({
    sessionId,
    userId: user.id,
    prompt: { model: 'gpt-5-mini' },
    message: {
      role: 'assistant',
      content: 'assistant reply',
      createdAt: new Date(),
    },
  });

  const storedBare = await db.aiSessionMessage.findUniqueOrThrow({
    where: { id: appendedBare.id },
    select: { params: true },
  });

  t.deepEqual(appendedBare.params, {});
  t.deepEqual(storedBare.params, {});

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.aiSession.update({
    where: { id: sessionId },
    data: { updatedAt: oneDayAgo },
  });

  const cleanup = await copilotSession.cleanupEmptySessions(oneDayAgo);
  const persisted = await db.aiSession.findUnique({
    where: { id: sessionId },
    select: { deletedAt: true, messageCost: true },
  });

  t.deepEqual(cleanup, { removed: 0, cleaned: 0 });
  t.truthy(persisted);
  t.is(persisted?.deletedAt, null);
  t.is(persisted?.messageCost, 1);
});

test('should count action runs without double-counting legacy action sessions', async t => {
  const { copilotSession, db, models } = t.context;
  await createTestPrompts(copilotSession, db);

  const regular = await createTestSession(t);
  await copilotSession.appendMessage({
    sessionId: regular.sessionId,
    userId: user.id,
    prompt: { model: 'gpt-5-mini' },
    message: {
      role: 'user',
      content: 'regular message',
      createdAt: new Date(),
    },
  });

  const legacyAction = await createTestSession(t, {
    promptName: TEST_PROMPTS.ACTION,
    promptAction: 'edit',
  });
  const migratedAction = await createTestSession(t, {
    promptName: TEST_PROMPTS.ACTION,
    promptAction: 'edit',
  });
  const run = await models.copilotActionRun.create({
    userId: user.id,
    workspaceId: workspace.id,
    sessionId: migratedAction.sessionId,
    actionId: 'mindmap.generate',
    actionVersion: 'v1',
  });
  await models.copilotActionRun.complete(run.id, {
    status: 'succeeded',
    result: { ok: true },
    trace: [{ type: 'action_done', status: 'succeeded' }],
  });
  const retryRun = await models.copilotActionRun.create({
    userId: user.id,
    workspaceId: workspace.id,
    sessionId: migratedAction.sessionId,
    actionId: 'mindmap.generate',
    actionVersion: 'v1',
    attempt: 2,
    retryOf: run.id,
  });
  await models.copilotActionRun.complete(retryRun.id, {
    status: 'aborted',
    errorCode: 'action_aborted',
    trace: [{ type: 'error', status: 'aborted' }],
  });
  const persistedRetry = await models.copilotActionRun.get(retryRun.id);
  const transcriptTask = await models.copilotTranscriptTask.create({
    userId: user.id,
    workspaceId: workspace.id,
    blobId: 'audio-1',
    strategy: 'gemini',
    recipeId: 'transcript.audio.gemini',
    recipeVersion: 'v1',
  });
  await models.copilotTranscriptTask.complete(transcriptTask.id, {
    status: 'ready',
    protectedResult: { normalizedTranscript: '00:00:01 A: Hello' },
  });
  await models.copilotTranscriptTask.settle(transcriptTask.id);

  t.like(persistedRetry, {
    status: 'aborted',
    attempt: 2,
    retryOf: run.id,
    errorCode: 'action_aborted',
    trace: [{ type: 'error', status: 'aborted' }],
  });
  t.is(await copilotSession.countUserMessages(user.id), 4);
  t.truthy(legacyAction.sessionId);
});

test('should expose sanitized action run prepared route trace', async t => {
  const { models } = t.context;
  const run = await models.copilotActionRun.create({
    userId: user.id,
    workspaceId: workspace.id,
    actionId: 'mindmap.generate',
    actionVersion: 'v1',
  });

  await models.copilotActionRun.complete(run.id, {
    status: 'succeeded',
    trace: {
      native: { prompt: 'should-not-be-returned' },
      preparedRoutes: {
        type: 'prepared_routes',
        status: 'succeeded',
        steps: [
          {
            stepId: 'generate',
            kind: 'structured',
            routeCount: 1,
            requestedModelId: 'local/office-structured',
            requestedModelSource: 'prompt_preference',
            fallbackProviderIds: ['ollama-main', 'openai-default'],
            routes: [
              {
                providerId: 'ollama-main',
                modelId: 'local/office-structured',
                routeIndex: 0,
                fallbackOrderIndex: 0,
                protocol: 'openai_chat',
                requestLayer: 'chat_completions',
                providerConfiguredModelCount: 2,
                providerConfiguredModelIds: [
                  'local/office-structured',
                  'office-structured',
                ],
                providerHealth: 'healthy',
                providerHealthCheckedAt: '2026-06-16T09:30:00.000Z',
                providerHealthLastError: 'should-be-returned',
                providerName: 'Local Ollama',
                providerPrivacy: 'local',
                providerPriority: 10,
                providerProfileConfigPath:
                  'copilot.providers.profiles[id=ollama-main]',
                providerProfileId: 'ollama-main',
                providerProfileSource: 'configured',
                providerSource: 'configured',
                providerType: 'openaiCompatible',
                routeModelAliasMatched: true,
                routeModelDefinitionAliases: ['office-structured'],
                routeModelDefinitionId: 'local/office-structured',
                routeModelDefinitionSource: 'provider_profile',
                routeRawModelId: 'qwen3:32b',
                backendConfig: {
                  base_url: 'http://host.docker.internal:11434/v1',
                  auth_token: 'should-not-be-returned',
                },
                messages: [{ role: 'user', content: 'secret prompt' }],
              },
            ],
          },
        ],
      },
    },
  });

  const trace = await models.copilotActionRun.getPreparedRouteTrace(run.id, {
    userId: user.id,
    workspaceId: workspace.id,
  });

  t.deepEqual(trace, {
    type: 'prepared_routes',
    status: 'succeeded',
    steps: [
      {
        stepId: 'generate',
        kind: 'structured',
        routeCount: 1,
        actualRouteCount: 1,
        routeCountMismatch: false,
        requestedModelId: 'local/office-structured',
        requestedModelSource: 'prompt_preference',
        fallbackProviderIds: ['ollama-main', 'openai-default'],
        routes: [
          {
            providerId: 'ollama-main',
            modelId: 'local/office-structured',
            routeIndex: 0,
            fallbackOrderIndex: 0,
            protocol: 'openai_chat',
            requestLayer: 'chat_completions',
            providerConfiguredModelCount: 2,
            providerConfiguredModelIds: [
              'local/office-structured',
              'office-structured',
            ],
            providerHealth: 'healthy',
            providerHealthCheckedAt: '2026-06-16T09:30:00.000Z',
            providerHealthLastError: 'should-be-returned',
            providerName: 'Local Ollama',
            providerPrivacy: 'local',
            providerPriority: 10,
            providerProfileConfigPath:
              'copilot.providers.profiles[id=ollama-main]',
            providerProfileId: 'ollama-main',
            providerProfileSource: 'configured',
            providerSource: 'configured',
            providerType: 'openaiCompatible',
            routeModelAliasMatched: true,
            routeModelDefinitionAliases: ['office-structured'],
            routeModelDefinitionId: 'local/office-structured',
            routeModelDefinitionSource: 'provider_profile',
            routeRawModelId: 'qwen3:32b',
          },
        ],
      },
    ],
  });
});

test('should scope and normalize direct action run prepared route trace', async t => {
  const { models } = t.context;
  const run = await models.copilotActionRun.create({
    userId: user.id,
    workspaceId: workspace.id,
    actionId: 'image.filter.sketch',
    actionVersion: 'v1',
  });

  await models.copilotActionRun.complete(run.id, {
    status: 'succeeded',
    trace: {
      type: 'prepared_routes',
      status: 'succeeded',
      steps: [
        {
          stepId: 'generate-image',
          kind: 'image',
          requestedModelId: 'gpt-image-1',
          requestedModelSource: 'unsafe-provider/model',
          fallbackProviderIds: ['openai-default'],
          routes: [
            {
              providerId: 'openai-default',
              modelId: 'gpt-image-1',
              routeIndex: 0,
              fallbackOrderIndex: 0,
              baseURL: 'https://example.invalid/v1',
            },
            {
              providerId: 123,
              modelId: 'invalid',
            },
          ],
        },
      ],
    },
  });

  t.is(
    await models.copilotActionRun.getPreparedRouteTrace(run.id, {
      userId: 'another-user',
      workspaceId: workspace.id,
    }),
    null
  );
  t.deepEqual(await models.copilotActionRun.getPreparedRouteTrace(run.id), {
    type: 'prepared_routes',
    status: 'succeeded',
    steps: [
      {
        stepId: 'generate-image',
        kind: 'image',
        routeCount: 1,
        actualRouteCount: 1,
        routeCountMismatch: false,
        requestedModelId: 'gpt-image-1',
        fallbackProviderIds: ['openai-default'],
        routes: [
          {
            providerId: 'openai-default',
            modelId: 'gpt-image-1',
            routeIndex: 0,
            fallbackOrderIndex: 0,
          },
        ],
      },
    ],
  });
});

test('should list recent sanitized action run diagnostics', async t => {
  const { models, user: userModel, workspace: workspaceModel } = t.context;
  const first = await models.copilotActionRun.create({
    userId: user.id,
    workspaceId: workspace.id,
    docId: 'doc-1',
    actionId: 'mindmap.generate',
    actionVersion: 'v1',
  });
  await models.copilotActionRun.complete(first.id, {
    status: 'succeeded',
    result: { secret: 'should-not-be-returned' },
    artifacts: [{ url: 'https://example.invalid/private' }],
    trace: {
      native: { prompt: 'should-not-be-returned' },
      preparedRoutes: {
        type: 'prepared_routes',
        status: 'succeeded',
        steps: [
          {
            stepId: 'generate',
            kind: 'structured',
            routeCount: 2,
            requestedModelId: 'local/office-structured',
            requestedModelSource: 'prompt_preference',
            fallbackProviderIds: ['ollama-main', 'openai-default'],
            routes: [
              {
                providerId: 'ollama-main',
                modelId: 'local/office-structured',
                routeIndex: 0,
                fallbackOrderIndex: 0,
                protocol: 'openai_chat',
                requestLayer: 'chat_completions',
                backendConfig: { authToken: 'should-not-be-returned' },
              },
              {
                providerId: 'openai-default',
                modelId: 'gpt-5-mini',
                routeIndex: 1,
                fallbackOrderIndex: 1,
                protocol: 'openai_chat',
                requestLayer: 'chat_completions',
                backendConfig: { authToken: 'should-not-be-returned' },
              },
            ],
          },
          {
            stepId: 'fallback-image',
            kind: 'image',
            routeCount: 1,
            requestedModelId: 'gpt-image-1',
            requestedModelSource: 'explicit',
            fallbackProviderIds: ['openai-default'],
            routes: [
              {
                providerId: 'openai-default',
                modelId: 'gpt-image-1',
                routeIndex: 0,
                fallbackOrderIndex: 0,
                protocol: 'openai_image',
                requestLayer: 'images',
                backendConfig: { authToken: 'should-not-be-returned' },
              },
            ],
          },
        ],
      },
    },
  });
  const second = await models.copilotActionRun.create({
    userId: user.id,
    workspaceId: workspace.id,
    actionId: 'image.filter.sketch',
    actionVersion: 'v1',
    retryOf: first.id,
  });
  await models.copilotActionRun.complete(second.id, {
    status: 'failed',
    errorCode: 'action_bridge_stream_error',
    trace: { type: 'error', status: 'failed' },
  });
  const otherUser = await userModel.create({
    email: 'other-action-run-owner@affine.pro',
  });
  const otherWorkspace = await workspaceModel.create(user.id);
  await models.copilotActionRun.create({
    userId: otherUser.id,
    workspaceId: workspace.id,
    actionId: 'other.user',
    actionVersion: 'v1',
  });
  await models.copilotActionRun.create({
    userId: user.id,
    workspaceId: otherWorkspace.id,
    actionId: 'other.workspace',
    actionVersion: 'v1',
  });

  const diagnostics = await models.copilotActionRun.listRecentDiagnostics({
    userId: user.id,
    workspaceId: workspace.id,
  });

  t.is(diagnostics.length, 2);
  t.deepEqual(
    diagnostics.map(run => run.id).sort(),
    [first.id, second.id].sort()
  );
  t.true(diagnostics.some(run => run.id === first.id));
  t.true(diagnostics.some(run => run.id === second.id));
  t.like(
    diagnostics.find(run => run.id === first.id),
    {
      actionId: 'mindmap.generate',
      actionVersion: 'v1',
      status: 'succeeded',
      attempt: 1,
      retryOf: null,
      docId: 'doc-1',
      sessionId: null,
      errorCode: null,
      hasPreparedRouteTrace: true,
      preparedRouteStepCount: 2,
      preparedRouteCount: 3,
      preparedRouteActualCount: 3,
      preparedRouteStepRouteCounts: [
        'generate -> 2/2',
        'fallback-image -> 1/1',
      ],
      preparedRouteStepRouteCountMismatches: [],
      preparedRouteStepIds: ['generate', 'fallback-image'],
      preparedRouteKinds: ['structured', 'image'],
      preparedRouteModelIds: [
        'local/office-structured',
        'gpt-5-mini',
        'gpt-image-1',
      ],
      preparedRouteProtocols: ['openai_chat', 'openai_image'],
      preparedRouteOrder: [
        '0 -> ollama-main/local/office-structured',
        '1 -> openai-default/gpt-5-mini',
        '0 -> openai-default/gpt-image-1',
      ],
      preparedRouteFallbackOrder: [
        '0 -> ollama-main/local/office-structured',
        '1 -> openai-default/gpt-5-mini',
        '0 -> openai-default/gpt-image-1',
      ],
      preparedRouteStepFallbackProviderIds: [
        'generate -> ollama-main -> openai-default',
        'fallback-image -> openai-default',
      ],
      preparedRouteProviderIds: ['ollama-main', 'openai-default'],
      preparedRouteRequestedModelIds: [
        'local/office-structured',
        'gpt-image-1',
      ],
      preparedRouteRequestedModelSources: ['prompt_preference', 'explicit'],
      preparedRouteStepRequestedModelSources: [
        'generate -> prompt_preference',
        'fallback-image -> explicit',
      ],
      preparedRouteRequestLayers: ['chat_completions', 'images'],
      preparedRouteStepProtocols: [
        'generate -> openai_chat',
        'fallback-image -> openai_image',
      ],
      preparedRouteStepRequestLayers: [
        'generate -> chat_completions',
        'fallback-image -> images',
      ],
      preparedRouteStepOrder: [
        'generate / 0 -> ollama-main/local/office-structured',
        'generate / 1 -> openai-default/gpt-5-mini',
        'fallback-image / 0 -> openai-default/gpt-image-1',
      ],
      preparedRouteStepFallbackOrder: [
        'generate / 0 -> ollama-main/local/office-structured',
        'generate / 1 -> openai-default/gpt-5-mini',
        'fallback-image / 0 -> openai-default/gpt-image-1',
      ],
      preparedRouteFallbackProviderIds: ['ollama-main', 'openai-default'],
      preparedRouteTargets: [
        'ollama-main/local/office-structured',
        'openai-default/gpt-5-mini',
        'openai-default/gpt-image-1',
      ],
      preparedRouteStepTargets: [
        'generate -> ollama-main/local/office-structured',
        'generate -> openai-default/gpt-5-mini',
        'fallback-image -> openai-default/gpt-image-1',
      ],
      preparedRouteRequestedTargets: [
        'local/office-structured -> ollama-main/local/office-structured',
        'local/office-structured -> openai-default/gpt-5-mini',
        'gpt-image-1 -> openai-default/gpt-image-1',
      ],
      preparedRouteStepRequestedTargets: [
        'generate / local/office-structured -> ollama-main/local/office-structured',
        'generate / local/office-structured -> openai-default/gpt-5-mini',
        'fallback-image / gpt-image-1 -> openai-default/gpt-image-1',
      ],
    }
  );
  t.like(
    diagnostics.find(run => run.id === second.id),
    {
      actionId: 'image.filter.sketch',
      status: 'failed',
      retryOf: first.id,
      errorCode: 'action_bridge_stream_error',
      hasPreparedRouteTrace: false,
      preparedRouteStepCount: 0,
      preparedRouteCount: 0,
      preparedRouteActualCount: 0,
      preparedRouteStepRouteCounts: [],
      preparedRouteStepRouteCountMismatches: [],
      preparedRouteStepIds: [],
      preparedRouteKinds: [],
      preparedRouteModelIds: [],
      preparedRouteOrder: [],
      preparedRouteFallbackOrder: [],
      preparedRouteStepFallbackProviderIds: [],
      preparedRouteProtocols: [],
      preparedRouteProviderIds: [],
      preparedRouteRequestedModelIds: [],
      preparedRouteRequestedModelSources: [],
      preparedRouteStepRequestedModelSources: [],
      preparedRouteRequestLayers: [],
      preparedRouteStepProtocols: [],
      preparedRouteStepOrder: [],
      preparedRouteStepFallbackOrder: [],
      preparedRouteStepRequestLayers: [],
      preparedRouteFallbackProviderIds: [],
      preparedRouteTargets: [],
      preparedRouteStepTargets: [],
      preparedRouteRequestedTargets: [],
      preparedRouteStepRequestedTargets: [],
    }
  );
  t.false('trace' in diagnostics[0]);
  t.false('inputSnapshot' in diagnostics[0]);
  t.false('result' in diagnostics[0]);
  t.false('artifacts' in diagnostics[0]);
});

test('should exclude BYOK provider usage from copilot quota cost', async t => {
  const { copilotSession, db, models } = t.context;
  await createTestPrompts(copilotSession, db);

  const regular = await createTestSession(t);
  const firstMessage = await copilotSession.appendMessage({
    sessionId: regular.sessionId,
    userId: user.id,
    prompt: { model: 'gpt-5-mini' },
    message: {
      role: 'user',
      content: 'regular message',
      createdAt: new Date(),
    },
  });
  const secondMessage = await copilotSession.appendMessage({
    sessionId: regular.sessionId,
    userId: user.id,
    prompt: { model: 'gpt-5-mini' },
    message: {
      role: 'user',
      content: 'second BYOK message',
      createdAt: new Date(),
    },
  });
  await copilotSession.appendMessage({
    sessionId: regular.sessionId,
    userId: user.id,
    prompt: { model: 'gpt-5-mini' },
    message: {
      role: 'user',
      content: 'quota-backed message',
      createdAt: new Date(),
    },
  });
  const failedRun = await models.copilotActionRun.create({
    userId: user.id,
    workspaceId: workspace.id,
    actionId: 'mindmap.generate',
    actionVersion: 'v1',
  });
  await models.copilotActionRun.complete(failedRun.id, {
    status: 'failed',
    errorCode: 'test_failed',
  });
  const pendingTranscriptTask = await models.copilotTranscriptTask.create({
    userId: user.id,
    workspaceId: workspace.id,
    blobId: 'pending-audio',
    strategy: 'gemini',
    recipeId: 'transcript.audio.gemini',
    recipeVersion: 'v1',
  });
  await models.copilotUsage.create({
    workspaceId: workspace.id,
    userId: user.id,
    provider: 'openai',
    providerSource: 'byok_server',
    featureKind: 'chat',
    billingUnitId: firstMessage.id,
  });
  await models.copilotUsage.create({
    workspaceId: workspace.id,
    userId: user.id,
    provider: 'openai',
    providerSource: 'byok_server',
    featureKind: 'chat',
    billingUnitId: firstMessage.id,
  });
  await models.copilotUsage.create({
    workspaceId: workspace.id,
    userId: user.id,
    provider: 'fal',
    providerSource: 'byok_server',
    featureKind: 'image',
    billingUnitId: secondMessage.id,
  });
  await models.copilotUsage.create({
    workspaceId: workspace.id,
    userId: user.id,
    provider: 'fal',
    providerSource: 'byok_server',
    featureKind: 'image',
  });
  await models.copilotUsage.create({
    workspaceId: workspace.id,
    userId: user.id,
    provider: 'openai',
    providerSource: 'byok_server',
    featureKind: 'action',
    billingUnitId: failedRun.id,
  });
  await models.copilotUsage.create({
    workspaceId: workspace.id,
    userId: user.id,
    provider: 'gemini',
    providerSource: 'byok_server',
    featureKind: 'transcript',
    billingUnitId: pendingTranscriptTask.id,
  });

  t.is(await copilotSession.countUserMessages(user.id), 1);
});

test('should get sessions for title generation correctly', async t => {
  const { copilotSession, db } = t.context;
  await createTestPrompts(copilotSession, db);

  // create valid sessions with messages
  const sessionIds: string[] = [randomUUID(), randomUUID()];
  await Promise.all(
    sessionIds.map(async (id, index) => {
      await createTestSession(t, { sessionId: id });
      await db.aiSession.update({
        where: { id },
        data: {
          updatedAt: new Date(Date.now() - index * 1000),
          messages: {
            create: Array.from({ length: index + 1 }, (_, i) => ({
              role: 'assistant',
              content: `assistant message ${i}`,
            })),
          },
        },
      });
    })
  );

  // create excluded sessions
  const excludedSessions = [
    {
      reason: 'hasTitle',
      setupFn: async (id: string) => {
        await createTestSession(t, { sessionId: id });
        await db.aiSession.update({
          where: { id },
          data: { title: 'Existing Title' },
        });
      },
    },
    {
      reason: 'isDeleted',
      setupFn: async (id: string) => {
        await createTestSession(t, { sessionId: id });
        await db.aiSession.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
      },
    },
    {
      reason: 'noMessages',
      setupFn: async (id: string) => {
        await createTestSession(t, { sessionId: id });
      },
    },
    {
      reason: 'isAction',
      setupFn: async (id: string) => {
        await createTestSession(t, {
          sessionId: id,
          promptName: TEST_PROMPTS.ACTION,
        });
      },
    },
    {
      reason: 'noAssistantMessages',
      setupFn: async (id: string) => {
        await createTestSession(t, { sessionId: id });
        await db.aiSessionMessage.create({
          data: { sessionId: id, role: 'user', content: 'User message only' },
        });
      },
    },
  ];

  await Promise.all(
    excludedSessions.map(async session => {
      await session.setupFn(randomUUID());
    })
  );

  const result = await copilotSession.toBeGenerateTitle();

  t.snapshot(
    {
      total: result.length,
      sessions: result.map(s => ({
        assistantMessageCount: s._count.messages,
        isValid: sessionIds.includes(s.id),
      })),
      onlyValidSessionsReturned: result.every(s => sessionIds.includes(s.id)),
    },
    'sessions for title generation results'
  );
});
