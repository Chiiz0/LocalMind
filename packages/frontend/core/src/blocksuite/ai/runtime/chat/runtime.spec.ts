/**
 * @vitest-environment happy-dom
 */
import type { CopilotChatHistoryFragment } from '@affine/graphql';
import { describe, expect, test, vi } from 'vitest';

import type { AIRequestService } from '../request';
import { AIChatRuntime } from './runtime';
import {
  DocAIChatSessionStrategy,
  ForkAIChatSessionStrategy,
  PlaygroundAIChatSessionStrategy,
  WorkspaceAIChatSessionStrategy,
} from './session-strategy';
import type { AIChatScope } from './state';

const docScope: AIChatScope = {
  kind: 'doc',
  workspaceId: 'workspace-1',
  docId: 'doc-1',
};

function session(
  overrides: Partial<CopilotChatHistoryFragment> = {}
): CopilotChatHistoryFragment {
  return {
    sessionId: 'session-1',
    workspaceId: 'workspace-1',
    docId: 'doc-1',
    title: 'Session 1',
    pinned: false,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    parentSessionId: null,
    promptName: 'Chat With LocalMind AI',
    action: null,
    optionalModels: null,
    tokens: 0,
    ...overrides,
  } as CopilotChatHistoryFragment;
}

async function* stream(chunks: string[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function waitUntil(assertion: () => void) {
  for (let i = 0; i < 100; i++) {
    try {
      assertion();
      return;
    } catch {
      await Promise.resolve();
    }
  }
  assertion();
}

function createRequest(
  overrides: Partial<AIRequestService> = {}
): AIRequestService {
  return {
    getSessions: vi.fn().mockResolvedValue([]),
    getRecentSessions: vi.fn().mockResolvedValue([]),
    getSession: vi.fn().mockResolvedValue(null),
    createSessionWithHistory: vi.fn().mockResolvedValue(session()),
    updateSession: vi.fn().mockResolvedValue(undefined),
    cleanupSessions: vi.fn().mockResolvedValue(undefined),
    executeAction: vi.fn().mockResolvedValue(stream(['hello'])),
    histories: {
      ids: vi.fn().mockResolvedValue([]),
    },
    context: {
      createContext: vi.fn().mockResolvedValue('context-1'),
      getContextId: vi.fn().mockResolvedValue(undefined),
      addContextDoc: vi.fn().mockResolvedValue(undefined),
      removeContextDoc: vi.fn().mockResolvedValue(undefined),
      addContextFile: vi
        .fn()
        .mockResolvedValue({ id: 'file-1', status: 'processing' }),
      removeContextFile: vi.fn().mockResolvedValue(undefined),
      addContextTag: vi.fn().mockResolvedValue(undefined),
      removeContextTag: vi.fn().mockResolvedValue(undefined),
      addContextCollection: vi.fn().mockResolvedValue(undefined),
      removeContextCollection: vi.fn().mockResolvedValue(undefined),
      getContextDocsAndFiles: vi.fn().mockResolvedValue(undefined),
      matchContext: vi.fn().mockResolvedValue({ files: [], docs: [] }),
      addContextBlob: vi
        .fn()
        .mockResolvedValue({ id: 'blob-1', status: 'processing' }),
      removeContextBlob: vi.fn().mockResolvedValue(undefined),
      getSessionScope: vi.fn().mockResolvedValue(null),
      pollContextDocsAndFiles: vi.fn(),
      pollEmbeddingStatus: vi.fn(),
    },
    ...overrides,
  } as unknown as AIRequestService;
}

function createRuntime(request = createRequest()) {
  return new AIChatRuntime({
    request,
    scope: docScope,
    strategy: new DocAIChatSessionStrategy(),
  });
}

describe('AIChatRuntime', () => {
  test('initializes doc scope with a draft tab when no session exists', async () => {
    const runtime = createRuntime();

    await runtime.dispatch({ type: 'initialize' });

    const snapshot = runtime.getSnapshot();
    expect(snapshot.readiness).toBe('ready');
    expect(snapshot.activeSessionId).toBeNull();
    expect(snapshot.tabs).toEqual([
      expect.objectContaining({ kind: 'draft', hasMessages: false }),
    ]);
    expect(snapshot.uiPolicy.showDraftTab).toBe(true);
  });

  test('initializes doc scope with full messages for the latest session', async () => {
    const listedSession = session({ sessionId: 'session-1', messages: [] });
    const fullSession = session({
      sessionId: 'session-1',
      messages: [
        {
          id: 'message-1',
          role: 'user',
          content: 'previous chat',
          attachments: [],
          streamObjects: [],
          createdAt: new Date().toISOString(),
        },
      ],
    });
    const request = createRequest({
      getSessions: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([listedSession]),
      getSession: vi.fn().mockResolvedValue(fullSession),
    });
    const runtime = createRuntime(request);

    await runtime.dispatch({ type: 'initialize' });

    expect(request.getSession).toHaveBeenCalledWith('workspace-1', 'session-1');
    expect(runtime.getSnapshot().messages).toEqual(fullSession.messages);
  });

  test('send creates a session once and ignores duplicate sends while transmitting', async () => {
    let release!: () => void;
    const blockedStream = {
      async *[Symbol.asyncIterator]() {
        await new Promise<void>(resolve => {
          release = resolve;
        });
        yield 'done';
      },
    };
    const request = createRequest({
      executeAction: vi.fn().mockResolvedValue(blockedStream),
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({ type: 'initialize' });

    const firstSend = runtime.dispatch({ type: 'send', input: 'hello' });
    await waitUntil(() => {
      expect(request.executeAction).toHaveBeenCalled();
    });
    await runtime.dispatch({ type: 'send', input: 'again' });
    release();
    await firstSend;

    expect(request.createSessionWithHistory).toHaveBeenCalledTimes(1);
    expect(request.executeAction).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot().messages.at(-1)?.content).toBe('done');
    expect(runtime.getSnapshot().uiPolicy.canCreateNewSession).toBe(true);
  });

  test('send creates a new session with the provided prompt scope', async () => {
    const request = createRequest();
    const runtime = createRuntime(request);
    await runtime.dispatch({ type: 'initialize' });

    await runtime.dispatch({
      type: 'send',
      input: 'create one image',
      promptName: 'Generate image',
    });

    expect(request.createSessionWithHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        promptName: 'Generate image',
      })
    );
    expect(request.executeAction).toHaveBeenCalledWith(
      'chat',
      expect.objectContaining({
        modelId: undefined,
        sessionId: 'session-1',
      })
    );
  });

  test('marks first send and retry only for an opted-in Intelligence Workbench runtime', async () => {
    const request = createRequest({
      createSessionWithHistory: vi
        .fn()
        .mockResolvedValue(session({ docId: null })),
    });
    const runtime = new AIChatRuntime({
      request,
      scope: { kind: 'workspace', workspaceId: 'workspace-1' },
      strategy: new WorkspaceAIChatSessionStrategy(),
      chatSurface: 'intelligence_workbench',
      projectId: 'project-1',
    });
    await runtime.dispatch({ type: 'initialize' });

    await runtime.dispatch({ type: 'send', input: 'track this blocker' });
    expect(request.executeAction).toHaveBeenLastCalledWith(
      'chat',
      expect.objectContaining({ chatSurface: 'intelligence_workbench' })
    );

    await runtime.dispatch({ type: 'retry', messageId: '' });
    expect(request.executeAction).toHaveBeenLastCalledWith(
      'chat',
      expect.objectContaining({
        chatSurface: 'intelligence_workbench',
        retry: true,
      })
    );
  });

  test('Intelligence without a project creates no session and sends no message', async () => {
    const request = createRequest();
    const runtime = new AIChatRuntime({
      request,
      scope: { kind: 'workspace', workspaceId: 'workspace-1' },
      strategy: new WorkspaceAIChatSessionStrategy(),
      chatSurface: 'intelligence_workbench',
      projectId: null,
    });
    await runtime.dispatch({ type: 'initialize' });
    await runtime.dispatch({ type: 'send', input: 'create something' });
    expect(request.createSessionWithHistory).not.toHaveBeenCalled();
    expect(request.executeAction).not.toHaveBeenCalled();
    expect(runtime.getSnapshot().messages).toEqual([]);
  });

  test('Intelligence filters history and refuses opening or rebinding another project session', async () => {
    const own = session({ docId: null, selectedContextProjectId: 'project-1' });
    const other = session({
      sessionId: 'other',
      docId: null,
      selectedContextProjectId: 'project-2',
      messages: [
        {
          id: 'secret',
          role: 'user',
          content: 'private history',
          attachments: ['project-2-private-attachment'],
          streamObjects: [],
          createdAt: new Date().toISOString(),
        },
      ] as never,
    });
    const request = createRequest({
      getSessions: vi.fn().mockResolvedValue([other]),
      getSession: vi.fn().mockResolvedValue(other),
      getRecentSessions: vi.fn().mockResolvedValue([own, other]),
    });
    const runtime = new AIChatRuntime({
      request,
      scope: { kind: 'workspace', workspaceId: 'workspace-1' },
      strategy: new WorkspaceAIChatSessionStrategy(),
      chatSurface: 'intelligence_workbench',
      projectId: 'project-1',
    });
    await runtime.dispatch({ type: 'initialize' });
    await runtime.dispatch({ type: 'refreshHistory' });
    await runtime.dispatch({ type: 'openSession', sessionId: 'other' });
    await runtime.dispatch({
      type: 'setSelectedContextProject',
      projectId: 'project-2',
    });
    expect(runtime.getSnapshot().history.recent).toEqual([own]);
    expect(runtime.getSnapshot().messages).toEqual([]);
    expect(JSON.stringify(runtime.getSnapshot())).not.toContain(
      'project-2-private-attachment'
    );
    expect(runtime.getSnapshot().activeSessionId).toBeNull();
    expect(runtime.getSnapshot().composer.projectScope.selectedProjectId).toBe(
      'project-1'
    );
    expect(request.updateSession).not.toHaveBeenCalled();
  });

  test('does not mark ordinary document chat requests as Workbench traffic', async () => {
    const request = createRequest();
    const runtime = createRuntime(request);
    await runtime.dispatch({ type: 'initialize' });

    await runtime.dispatch({ type: 'send', input: 'ordinary document chat' });

    expect(request.executeAction).toHaveBeenCalledWith(
      'chat',
      expect.not.objectContaining({ chatSurface: expect.anything() })
    );
  });

  test('send passes the captured Office context to the request service', async () => {
    const request = createRequest();
    const runtime = createRuntime(request);
    const officeContext = {
      version: 'localmind-office-ai-context/v1',
      workspaceId: 'workspace-1',
      artifactId: 'artifact-1',
      artifactKind: 'document',
      revisionId: 'revision-1',
      selection: {
        kind: 'document',
        target: {
          type: 'text_range',
          start: { blockId: 'paragraph-1', offset: 0 },
          end: { blockId: 'paragraph-1', offset: 4 },
        },
      },
    } as const;
    await runtime.dispatch({ type: 'initialize' });

    await runtime.dispatch({ type: 'send', input: 'format it', officeContext });

    expect(request.executeAction).toHaveBeenCalledWith(
      'chat',
      expect.objectContaining({ officeContext })
    );
  });

  test('send keeps the default chat prompt when no prompt scope is provided', async () => {
    const request = createRequest();
    const runtime = createRuntime(request);
    await runtime.dispatch({ type: 'initialize' });

    await runtime.dispatch({ type: 'send', input: 'hello' });

    expect(request.createSessionWithHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        promptName: 'Chat With LocalMind AI',
      })
    );
  });

  test('send falls back to the default chat prompt when prompt scope is blank', async () => {
    const request = createRequest();
    const runtime = createRuntime(request);
    await runtime.dispatch({ type: 'initialize' });

    await runtime.dispatch({ type: 'send', input: 'hello', promptName: '   ' });

    expect(request.createSessionWithHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        promptName: 'Chat With LocalMind AI',
      })
    );
  });

  test('context creation uses the provided prompt scope before first send', async () => {
    const request = createRequest();
    const runtime = createRuntime(request);
    await runtime.dispatch({ type: 'initialize' });

    await runtime.dispatch({
      type: 'addContextItem',
      item: { kind: 'doc', docId: 'doc-2' },
      promptName: 'slides.outline',
    });

    expect(request.createSessionWithHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        promptName: 'slides.outline',
      })
    );
    expect(runtime.getSnapshot().activeSessionId).toBe('session-1');
  });

  test('context-only session can open a clean draft', async () => {
    const runtime = createRuntime();
    await runtime.dispatch({ type: 'initialize' });
    await runtime.dispatch({
      type: 'addContextItem',
      item: { kind: 'doc', docId: 'doc-2' },
    });

    expect(runtime.getSnapshot().uiPolicy.canCreateNewSession).toBe(true);

    await runtime.dispatch({ type: 'createNewSession' });

    expect(runtime.getSnapshot().activeSessionId).toBeNull();
    expect(runtime.getSnapshot().composer.context).toEqual(
      expect.objectContaining({
        contextId: null,
        items: [],
        modifiedDocuments: [],
      })
    );
  });

  test('loads project candidates and persists an explicit project selection', async () => {
    let selectedProjectId: string | null = null;
    const getSessionScope = vi.fn(async () => ({
      sessionId: 'session-1',
      primaryDocId: 'doc-1',
      readableDocIds: ['doc-1', 'doc-2'],
      readableDocumentRefs: [],
      candidateProjectIds: ['project-1', 'project-2'],
      projectIds: selectedProjectId ? [selectedProjectId] : [],
      selectedProjectId,
      projectResolution: selectedProjectId ? 'selected' : 'ambiguous',
      candidateProjects: [
        { id: 'project-1', name: 'One' },
        { id: 'project-2', name: 'Two' },
      ],
    }));
    const updateSession = vi.fn(
      async (input: { selectedContextProjectId?: string | null }) => {
        selectedProjectId = input.selectedContextProjectId ?? null;
        return 'session-1';
      }
    );
    const baseRequest = createRequest();
    const request = createRequest({
      updateSession,
      context: {
        ...baseRequest.context,
        getSessionScope,
      },
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({ type: 'openSessionObject', session: session() });

    await runtime.dispatch({ type: 'loadProjectScope' });
    expect(runtime.getSnapshot().composer.projectScope).toEqual(
      expect.objectContaining({
        projectResolution: 'ambiguous',
        selectedProjectId: null,
        candidates: [
          { id: 'project-1', name: 'One' },
          { id: 'project-2', name: 'Two' },
        ],
      })
    );

    await runtime.dispatch({
      type: 'setSelectedContextProject',
      projectId: 'project-2',
    });
    expect(updateSession).toHaveBeenCalledWith({
      sessionId: 'session-1',
      selectedContextProjectId: 'project-2',
    });
    expect(runtime.getSnapshot().composer.projectScope).toEqual(
      expect.objectContaining({
        projectResolution: 'selected',
        selectedProjectId: 'project-2',
      })
    );
  });

  test('persists a draft project selection before the first message executes', async () => {
    const updateSession = vi.fn().mockResolvedValue('session-1');
    const executeAction = vi.fn().mockResolvedValue(stream(['hello']));
    const request = createRequest({ updateSession, executeAction });
    const runtime = createRuntime(request);
    await runtime.dispatch({ type: 'initialize' });

    await runtime.dispatch({
      type: 'setSelectedContextProject',
      projectId: 'project-1',
      projectName: 'One',
    });

    expect(updateSession).not.toHaveBeenCalled();
    expect(runtime.getSnapshot().composer.projectScope).toEqual(
      expect.objectContaining({
        projectResolution: 'selected',
        selectedProjectId: 'project-1',
        candidates: [{ id: 'project-1', name: 'One' }],
      })
    );

    await runtime.dispatch({ type: 'send', input: 'Use this project' });

    expect(updateSession).toHaveBeenCalledWith({
      sessionId: 'session-1',
      selectedContextProjectId: 'project-1',
    });
    expect(updateSession.mock.invocationCallOrder[0]).toBeLessThan(
      executeAction.mock.invocationCallOrder[0]
    );
    expect(executeAction).toHaveBeenCalledWith(
      'chat',
      expect.objectContaining({ sessionId: 'session-1' })
    );
  });

  test.each([
    ['switches', 'project-2', 1],
    ['clears', null, 0],
  ] as const)(
    '%s a draft project selection while the first session is being created',
    async (_label, latestProjectId, expectedUpdateCount) => {
      let resolveSession!: (value: CopilotChatHistoryFragment) => void;
      const createSessionWithHistory = vi.fn(
        () =>
          new Promise<CopilotChatHistoryFragment>(resolve => {
            resolveSession = resolve;
          })
      );
      const updateSession = vi.fn().mockResolvedValue('session-1');
      const executeAction = vi.fn().mockResolvedValue(stream(['hello']));
      const request = createRequest({
        createSessionWithHistory,
        updateSession,
        executeAction,
      });
      const runtime = createRuntime(request);
      await runtime.dispatch({ type: 'initialize' });
      await runtime.dispatch({
        type: 'setSelectedContextProject',
        projectId: 'project-1',
      });

      const send = runtime.dispatch({
        type: 'send',
        input: 'Use this project',
      });
      await waitUntil(() => {
        expect(createSessionWithHistory).toHaveBeenCalledTimes(1);
      });
      await runtime.dispatch({
        type: 'setSelectedContextProject',
        projectId: latestProjectId,
      });
      resolveSession(session());
      await send;

      expect(updateSession).toHaveBeenCalledTimes(expectedUpdateCount);
      expect(updateSession).not.toHaveBeenCalledWith({
        sessionId: 'session-1',
        selectedContextProjectId: 'project-1',
      });
      if (latestProjectId) {
        expect(updateSession).toHaveBeenCalledWith({
          sessionId: 'session-1',
          selectedContextProjectId: latestProjectId,
        });
        expect(updateSession.mock.invocationCallOrder[0]).toBeLessThan(
          executeAction.mock.invocationCallOrder[0]
        );
      }
    }
  );

  test('keeps a revoked stored project selection fail closed', async () => {
    const baseRequest = createRequest();
    const request = createRequest({
      context: {
        ...baseRequest.context,
        getSessionScope: vi.fn().mockResolvedValue({
          sessionId: 'session-1',
          primaryDocId: null,
          readableDocIds: [],
          candidateProjectIds: [],
          projectIds: [],
          selectedProjectId: null,
          projectResolution: 'invalid_selection',
          candidateProjects: [],
        }),
      },
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({ type: 'openSessionObject', session: session() });

    await runtime.dispatch({ type: 'loadProjectScope' });

    expect(runtime.getSnapshot().composer.projectScope).toEqual(
      expect.objectContaining({
        projectResolution: 'invalid_selection',
        selectedProjectId: null,
        candidates: [],
      })
    );
  });

  test('send binds an unbound session to the active doc after success', async () => {
    const unboundSession = session({ docId: null });
    const boundSession = session({ docId: 'doc-1' });
    const request = createRequest({
      getSession: vi.fn().mockResolvedValue(boundSession),
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({
      type: 'openSessionObject',
      session: unboundSession,
    });

    await runtime.dispatch({ type: 'send', input: 'hello' });

    expect(request.updateSession).toHaveBeenCalledWith({
      sessionId: 'session-1',
      docId: 'doc-1',
    });
    expect(request.getSession).toHaveBeenCalledWith('workspace-1', 'session-1');
    expect(runtime.getSnapshot().sessions[0].docId).toBe('doc-1');
  });

  test('new session opens a draft tab and persists on first send', async () => {
    const request = createRequest({
      createSessionWithHistory: vi
        .fn()
        .mockResolvedValue(session({ sessionId: 'session-2', messages: [] })),
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session({
        sessionId: 'session-1',
        title: 'One',
        messages: [
          {
            id: 'message-1',
            role: 'user',
            content: 'existing chat',
            attachments: [],
            streamObjects: [],
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    });

    await runtime.dispatch({ type: 'createNewSession' });

    expect(request.createSessionWithHistory).not.toHaveBeenCalled();
    expect(runtime.getSnapshot().activeSessionId).toBeNull();
    expect(runtime.getSnapshot().messages).toEqual([]);
    expect(runtime.getSnapshot().uiPolicy.showDraftTab).toBe(true);
    expect(runtime.getSnapshot().tabs).toEqual([
      expect.objectContaining({ kind: 'session', sessionId: 'session-1' }),
      expect.objectContaining({ kind: 'draft' }),
    ]);

    await runtime.dispatch({ type: 'send', input: 'hello' });

    expect(request.createSessionWithHistory).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot().activeSessionId).toBe('session-2');
    expect(runtime.getSnapshot().uiPolicy.showDraftTab).toBe(false);
    expect(runtime.getSnapshot().tabs).toEqual([
      expect.objectContaining({ kind: 'session', sessionId: 'session-1' }),
      expect.objectContaining({ kind: 'session', sessionId: 'session-2' }),
    ]);
  });

  test('toggle pin updates tab and session snapshots', async () => {
    const request = createRequest();
    const runtime = createRuntime(request);
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session({ pinned: false }),
    });

    await runtime.dispatch({ type: 'togglePinActiveSession' });

    expect(request.updateSession).toHaveBeenCalledWith({
      sessionId: 'session-1',
      pinned: true,
    });
    expect(runtime.getSnapshot().tabs[0]).toEqual(
      expect.objectContaining({ pinned: true })
    );
    expect(runtime.getSnapshot().sessions[0]).toEqual(
      expect.objectContaining({ pinned: true })
    );
  });

  test('new session inserts the draft tab after the active tab', async () => {
    const runtime = createRuntime();
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session({
        sessionId: 'session-1',
        messages: [
          {
            id: 'message-1',
            role: 'user',
            content: 'first chat',
            attachments: [],
            streamObjects: [],
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    });
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session({
        sessionId: 'session-2',
        messages: [
          {
            id: 'message-2',
            role: 'user',
            content: 'second chat',
            attachments: [],
            streamObjects: [],
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    });
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session({
        sessionId: 'session-1',
        messages: [
          {
            id: 'message-1',
            role: 'user',
            content: 'first chat',
            attachments: [],
            streamObjects: [],
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    });

    await runtime.dispatch({ type: 'createNewSession' });

    expect(runtime.getSnapshot().tabs.map(tab => tab.kind)).toEqual([
      'session',
      'draft',
      'session',
    ]);
    expect(runtime.getSnapshot().tabs.map(tab => tab.id)).toEqual([
      'session-1',
      expect.stringContaining('draft:'),
      'session-2',
    ]);
  });

  test('close active tab falls back to the previous session tab', async () => {
    const runtime = createRuntime();
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session({ sessionId: 'session-1', title: 'One' }),
    });
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session({ sessionId: 'session-2', title: 'Two' }),
    });

    await runtime.dispatch({ type: 'closeTab', tabId: 'session-2' });

    expect(runtime.getSnapshot().activeSessionId).toBe('session-1');
  });

  test('close active tab reloads fallback session messages', async () => {
    const fallbackSession = session({
      sessionId: 'session-1',
      title: 'One',
      messages: [
        {
          id: 'message-1',
          role: 'user',
          content: 'old chat',
          attachments: [],
          streamObjects: [],
          createdAt: new Date().toISOString(),
        },
      ],
    });
    const request = createRequest({
      getSession: vi.fn().mockResolvedValue(fallbackSession),
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session({ sessionId: 'session-1', title: 'One', messages: [] }),
    });
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session({ sessionId: 'session-2', title: 'Two', messages: [] }),
    });

    await runtime.dispatch({ type: 'closeTab', tabId: 'session-2' });

    expect(request.getSession).toHaveBeenCalledWith('workspace-1', 'session-1');
    expect(runtime.getSnapshot().activeSessionId).toBe('session-1');
    expect(runtime.getSnapshot().messages).toEqual(fallbackSession.messages);
  });

  test('closing the last session ignores an in-flight context poll', async () => {
    let releasePoll!: (value: unknown) => void;
    const request = createRequest();
    (
      request.context.getContextDocsAndFiles as ReturnType<typeof vi.fn>
    ).mockImplementation(
      () =>
        new Promise(resolve => {
          releasePoll = resolve;
        })
    );
    const runtime = createRuntime(request);
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session(),
    });
    await runtime.dispatch({
      type: 'addContextItem',
      item: { kind: 'doc', docId: 'doc-2' },
    });

    await runtime.dispatch({ type: 'startContextPolling' });
    await waitUntil(() => {
      expect(request.context.getContextDocsAndFiles).toHaveBeenCalledTimes(1);
    });
    await runtime.dispatch({ type: 'closeTab', tabId: 'session-1' });
    releasePoll({
      docs: [
        {
          id: 'doc-2',
          status: 'finished',
          snapshotUpdatedAt: 2,
          updatedAt: 20,
          isModified: true,
        },
      ],
    });
    await Promise.resolve();

    expect(runtime.getSnapshot().activeSessionId).toBeNull();
    expect(runtime.getSnapshot().composer.context).toEqual(
      expect.objectContaining({
        contextId: null,
        items: [],
        modifiedDocuments: [],
      })
    );
    runtime.dispose();
  });

  test('refreshHistory keeps current doc sessions separate from recent sessions', async () => {
    const currentDoc = [session({ sessionId: 'doc-session' })];
    const recent = [session({ sessionId: 'recent-session', docId: null })];
    const request = createRequest({
      getSessions: vi.fn().mockResolvedValue(currentDoc),
      getRecentSessions: vi.fn().mockResolvedValue(recent),
    });
    const runtime = createRuntime(request);

    await runtime.dispatch({ type: 'refreshHistory' });

    expect(runtime.getSnapshot().history.currentDoc).toEqual(currentDoc);
    expect(runtime.getSnapshot().history.recent).toEqual(recent);
  });

  test('other-doc session returns a navigation request instead of opening a tab', async () => {
    const runtime = createRuntime();

    await runtime.dispatch({
      type: 'openSessionObject',
      session: session({ sessionId: 'session-2', docId: 'doc-2' }),
    });

    expect(runtime.getSnapshot().navigationRequest).toEqual({
      workspaceId: 'workspace-1',
      docId: 'doc-2',
      sessionId: 'session-2',
      resetTabs: true,
    });
    expect(runtime.getSnapshot().activeSessionId).toBeNull();
  });

  test('stale stream result does not commit after scope switch', async () => {
    let release!: () => void;
    const delayedStream = {
      async *[Symbol.asyncIterator]() {
        await new Promise<void>(resolve => {
          release = resolve;
        });
        yield 'late';
      },
    };
    const request = createRequest({
      executeAction: vi.fn().mockResolvedValue(delayedStream),
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({ type: 'initialize' });
    const send = runtime.dispatch({ type: 'send', input: 'hello' });
    await waitUntil(() => {
      expect(request.executeAction).toHaveBeenCalled();
    });

    await runtime.dispatch({
      type: 'setScope',
      scope: { kind: 'doc', workspaceId: 'workspace-1', docId: 'doc-2' },
    });
    release();
    await send;

    expect(runtime.getSnapshot().scope).toEqual({
      kind: 'doc',
      workspaceId: 'workspace-1',
      docId: 'doc-2',
    });
    expect(runtime.getSnapshot().messages).toEqual([]);
  });

  test('stale session creation does not open after scope switch', async () => {
    let releaseSession!: (value: CopilotChatHistoryFragment) => void;
    const request = createRequest({
      createSessionWithHistory: vi.fn().mockReturnValue(
        new Promise<CopilotChatHistoryFragment>(resolve => {
          releaseSession = resolve;
        })
      ),
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({ type: 'initialize' });

    const send = runtime.dispatch({ type: 'send', input: 'hello' });
    await runtime.dispatch({
      type: 'setScope',
      scope: { kind: 'doc', workspaceId: 'workspace-1', docId: 'doc-2' },
    });
    releaseSession(session({ sessionId: 'late-session' }));
    await send;

    expect(runtime.getSnapshot().activeSessionId).toBeNull();
    expect(runtime.getSnapshot().sessions).toEqual([]);
  });

  test('send failure commits error status without throwing', async () => {
    const error = new Error('network failed');
    const request = createRequest({
      executeAction: vi.fn().mockRejectedValue(error),
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({ type: 'initialize' });

    await runtime.dispatch({ type: 'send', input: 'hello' });

    expect(runtime.getSnapshot().status).toBe('error');
    expect(runtime.getSnapshot().error).toBe(error);
    expect(runtime.getSnapshot().messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'hello' }),
      expect.objectContaining({ role: 'assistant', content: '' }),
    ]);
  });

  test('send remains successful when refreshing the assistant message id fails', async () => {
    const error = new Error('history unavailable');
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const request = createRequest();
    (request.histories.ids as ReturnType<typeof vi.fn>).mockRejectedValue(
      error
    );
    const runtime = createRuntime(request);
    await runtime.dispatch({ type: 'initialize' });

    await runtime.dispatch({ type: 'send', input: 'hello' });

    expect(runtime.getSnapshot().status).toBe('success');
    expect(runtime.getSnapshot().error).toBeNull();
    expect(runtime.getSnapshot().messages.at(-1)).toEqual(
      expect.objectContaining({ role: 'assistant', content: 'hello' })
    );
    expect(consoleError).toHaveBeenCalledWith(error);
    consoleError.mockRestore();
  });

  test('stop marks the active assistant response as complete', async () => {
    let release!: () => void;
    const blockedStream = {
      async *[Symbol.asyncIterator]() {
        yield 'partial';
        await new Promise<void>(resolve => {
          release = resolve;
        });
        yield 'late';
      },
    };
    const request = createRequest({
      executeAction: vi.fn().mockResolvedValue(blockedStream),
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({ type: 'initialize' });

    const send = runtime.dispatch({ type: 'send', input: 'hello' });
    await waitUntil(() => {
      expect(runtime.getSnapshot().status).toBe('transmitting');
    });

    await runtime.dispatch({ type: 'stop' });
    release();
    await send;

    expect(runtime.getSnapshot().status).toBe('success');
    expect(runtime.getSnapshot().messages.at(-1)).toEqual(
      expect.objectContaining({ role: 'assistant', content: 'partial' })
    );
  });

  test('clearError resets error status', async () => {
    const error = new Error('network failed');
    const runtime = createRuntime(
      createRequest({
        executeAction: vi.fn().mockRejectedValue(error),
      })
    );
    await runtime.dispatch({ type: 'initialize' });
    await runtime.dispatch({ type: 'send', input: 'hello' });

    await runtime.dispatch({ type: 'clearError' });

    expect(runtime.getSnapshot().status).toBe('idle');
    expect(runtime.getSnapshot().error).toBeNull();
  });

  test('retry failure commits error status and keeps the retried assistant placeholder', async () => {
    const error = new Error('retry failed');
    const request = createRequest({
      executeAction: vi.fn().mockRejectedValue(error),
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session({
        messages: [
          {
            id: 'user-1',
            role: 'user',
            content: 'hello',
            createdAt: new Date().toISOString(),
            attachments: null,
            streamObjects: null,
          },
          {
            id: 'assistant-1',
            role: 'assistant',
            content: 'old',
            createdAt: new Date().toISOString(),
            attachments: null,
            streamObjects: null,
          },
        ],
      }),
    });

    await runtime.dispatch({ type: 'retry', messageId: 'assistant-1' });

    expect(runtime.getSnapshot().status).toBe('error');
    expect(runtime.getSnapshot().error).toBe(error);
    expect(runtime.getSnapshot().messages[1]).toEqual(
      expect.objectContaining({ role: 'assistant', content: '' })
    );
  });

  test('stale openSession result does not commit after scope switch', async () => {
    let release!: (value: CopilotChatHistoryFragment) => void;
    const request = createRequest({
      getSession: vi.fn().mockReturnValue(
        new Promise<CopilotChatHistoryFragment>(resolve => {
          release = resolve;
        })
      ),
    });
    const runtime = createRuntime(request);

    const open = runtime.dispatch({
      type: 'openSession',
      sessionId: 'session-2',
    });
    await runtime.dispatch({
      type: 'setScope',
      scope: { kind: 'doc', workspaceId: 'workspace-1', docId: 'doc-2' },
    });
    release(session({ sessionId: 'session-2' }));
    await open;

    expect(runtime.getSnapshot().scope).toEqual({
      kind: 'doc',
      workspaceId: 'workspace-1',
      docId: 'doc-2',
    });
    expect(runtime.getSnapshot().activeSessionId).toBeNull();
  });

  test('retry uses existing session and preserves user messages', async () => {
    const request = createRequest({
      executeAction: vi.fn().mockResolvedValue(stream(['retry'])),
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session({
        messages: [
          {
            id: 'user-1',
            role: 'user',
            content: 'hello',
            createdAt: new Date().toISOString(),
            attachments: null,
            streamObjects: null,
          },
          {
            id: 'assistant-1',
            role: 'assistant',
            content: 'old',
            createdAt: new Date().toISOString(),
            attachments: null,
            streamObjects: null,
          },
        ],
      }),
    });

    await runtime.dispatch({ type: 'retry', messageId: 'assistant-1' });

    expect(runtime.getSnapshot().messages[0].content).toBe('hello');
    expect(runtime.getSnapshot().messages[1].content).toBe('retry');
    expect(request.executeAction).toHaveBeenCalledWith(
      'chat',
      expect.objectContaining({ retry: true, sessionId: 'session-1' })
    );
  });

  test('retry remains successful when refreshing the assistant message id fails', async () => {
    const error = new Error('history unavailable');
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const request = createRequest({
      executeAction: vi.fn().mockResolvedValue(stream(['retry'])),
    });
    (request.histories.ids as ReturnType<typeof vi.fn>).mockRejectedValue(
      error
    );
    const runtime = createRuntime(request);
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session({
        messages: [
          {
            id: 'user-1',
            role: 'user',
            content: 'hello',
            createdAt: new Date().toISOString(),
            attachments: null,
            streamObjects: null,
          },
          {
            id: '',
            role: 'assistant',
            content: 'old',
            createdAt: new Date().toISOString(),
            attachments: null,
            streamObjects: null,
          },
        ],
      }),
    });

    await runtime.dispatch({ type: 'retry', messageId: '' });

    expect(runtime.getSnapshot().status).toBe('success');
    expect(runtime.getSnapshot().error).toBeNull();
    expect(runtime.getSnapshot().messages[1]).toEqual(
      expect.objectContaining({ role: 'assistant', content: 'retry' })
    );
    expect(consoleError).toHaveBeenCalledWith(error);
    consoleError.mockRestore();
  });

  test('retry reuses failed initial messages when no session was created', async () => {
    const error = new Error('create session failed');
    const request = createRequest({
      createSessionWithHistory: vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(session({ sessionId: 'session-2' })),
      executeAction: vi.fn().mockResolvedValue(stream(['retry'])),
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({ type: 'initialize' });
    await runtime.dispatch({ type: 'send', input: 'hello' });

    expect(runtime.getSnapshot().activeSessionId).toBeNull();
    expect(runtime.getSnapshot().status).toBe('error');

    await runtime.dispatch({ type: 'retry', messageId: '' });

    expect(runtime.getSnapshot().activeSessionId).toBe('session-2');
    expect(runtime.getSnapshot().status).toBe('success');
    expect(runtime.getSnapshot().messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'hello' }),
      expect.objectContaining({ role: 'assistant', content: 'retry' }),
    ]);
  });

  test('history refresh does not stale an active stream', async () => {
    let release!: () => void;
    const delayedStream = {
      async *[Symbol.asyncIterator]() {
        await new Promise<void>(resolve => {
          release = resolve;
        });
        yield 'late';
      },
    };
    const request = createRequest({
      executeAction: vi.fn().mockResolvedValue(delayedStream),
      getRecentSessions: vi
        .fn()
        .mockResolvedValue([session({ sessionId: 'recent' })]),
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({ type: 'initialize' });

    const send = runtime.dispatch({ type: 'send', input: 'hello' });
    await waitUntil(() => {
      expect(request.executeAction).toHaveBeenCalled();
    });
    await runtime.dispatch({ type: 'refreshHistory' });
    release();
    await send;

    expect(runtime.getSnapshot().messages.at(-1)?.content).toBe('late');
    expect(runtime.getSnapshot().history.recent[0].sessionId).toBe('recent');
  });

  test('context add remove and poll preserve operation order', async () => {
    const request = createRequest();
    const runtime = createRuntime(request);
    await runtime.dispatch({ type: 'initialize' });

    await runtime.dispatch({
      type: 'addContextItem',
      item: { kind: 'doc', docId: 'doc-2' },
    });
    await runtime.dispatch({
      type: 'addContextItem',
      item: { kind: 'blob', blobId: 'blob-1' },
    });
    await runtime.dispatch({
      type: 'removeContextItem',
      item: { kind: 'doc', docId: 'doc-2' },
    });
    (
      request.context.getContextDocsAndFiles as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      blobs: [{ blobId: 'blob-1', status: 'finished' }],
    });
    await runtime.dispatch({ type: 'pollContext' });

    expect(request.context.createContext).toHaveBeenCalledTimes(1);
    expect(request.context.addContextDoc).toHaveBeenCalledWith({
      contextId: 'context-1',
      docId: 'doc-2',
    });
    expect(request.context.removeContextDoc).toHaveBeenCalledWith({
      contextId: 'context-1',
      docId: 'doc-2',
    });
    expect(runtime.getSnapshot().composer.context.items).toEqual([
      { kind: 'blob', blobId: 'blob-1', state: 'finished' },
    ]);
  });

  test('an interleaved poll cannot invalidate an in-flight context add', async () => {
    let releasePoll!: (value: unknown) => void;
    let releaseAdd!: () => void;
    const addContextDoc = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(
        () =>
          new Promise<void>(resolve => {
            releaseAdd = resolve;
          })
      );
    const request = createRequest();
    (request.context.addContextDoc as ReturnType<typeof vi.fn>) = addContextDoc;
    (
      request.context.getContextId as ReturnType<typeof vi.fn>
    ).mockResolvedValue('context-1');
    (
      request.context.getContextDocsAndFiles as ReturnType<typeof vi.fn>
    ).mockImplementation(
      () =>
        new Promise(resolve => {
          releasePoll = resolve;
        })
    );
    const runtime = createRuntime(request);
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session(),
    });
    await runtime.dispatch({
      type: 'addContextItem',
      item: { kind: 'doc', docId: 'doc-2' },
    });

    const poll = runtime.dispatch({ type: 'pollContext' });
    await waitUntil(() => {
      expect(request.context.getContextDocsAndFiles).toHaveBeenCalledTimes(1);
    });
    const add = runtime.dispatch({
      type: 'addContextItem',
      item: { kind: 'doc', docId: 'doc-3' },
    });
    await waitUntil(() => {
      expect(addContextDoc).toHaveBeenCalledTimes(2);
      expect(runtime.getSnapshot().composer.context.loading).toBe(true);
    });

    releasePoll({ docs: [{ id: 'doc-2', status: 'finished' }] });
    await poll;
    expect(runtime.getSnapshot().composer.context.loading).toBe(true);

    releaseAdd();
    await add;
    expect(runtime.getSnapshot().composer.context.loading).toBe(false);
    expect(runtime.getSnapshot().composer.context.items).toEqual([
      { kind: 'doc', docId: 'doc-2' },
      { kind: 'doc', docId: 'doc-3' },
    ]);
  });

  test('loadContext restores existing session context without creating a new context', async () => {
    const request = createRequest();
    (
      request.context.getContextId as ReturnType<typeof vi.fn>
    ).mockResolvedValue('context-1');
    (
      request.context.getContextDocsAndFiles as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      docs: [
        {
          id: 'doc-2',
          status: 'finished',
          createdAt: 2,
          snapshotUpdatedAt: 2,
          updatedAt: 20,
          isModified: true,
        },
      ],
      files: [
        {
          id: 'file-1',
          blobId: 'blob-file-1',
          name: 'note.pdf',
          status: 'processing',
          createdAt: 1,
        },
      ],
      tags: [
        {
          id: 'tag-1',
          docs: [
            {
              id: 'doc-2',
              status: 'finished',
              snapshotUpdatedAt: 2,
              updatedAt: 18,
              isModified: true,
            },
            {
              id: 'tag-doc',
              status: 'failed',
              snapshotUpdatedAt: 3,
              updatedAt: 30,
              isModified: true,
            },
          ],
          createdAt: 3,
        },
      ],
      collections: [],
      blobs: [],
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session(),
    });

    await runtime.dispatch({ type: 'loadContext' });

    expect(request.context.createContext).not.toHaveBeenCalled();
    expect(runtime.getSnapshot().composer.context.contextId).toBe('context-1');
    expect(runtime.getSnapshot().composer.context.items).toEqual([
      expect.objectContaining({
        kind: 'file',
        fileId: 'file-1',
        blobId: 'blob-file-1',
        state: 'processing',
      }),
      { kind: 'doc', docId: 'doc-2', state: 'finished', createdAt: 2 },
      {
        kind: 'tag',
        tagId: 'tag-1',
        docIds: ['doc-2', 'tag-doc'],
        state: 'finished',
        createdAt: 3,
        tooltip: undefined,
      },
    ]);
    expect(runtime.getSnapshot().composer.context.embeddingCount).toEqual({
      finished: 2,
      processing: 1,
      failed: 1,
    });
    expect(runtime.getSnapshot().composer.context.modifiedDocuments).toEqual([
      { docId: 'doc-2', updatedAt: 20 },
      { docId: 'tag-doc', updatedAt: 30 },
    ]);
  });

  test('keeps polling idle document contexts for later saved updates', async () => {
    vi.useFakeTimers();
    const request = createRequest();
    (
      request.context.getContextId as ReturnType<typeof vi.fn>
    ).mockResolvedValue('context-1');
    (
      request.context.getContextDocsAndFiles as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      docs: [
        {
          id: 'doc-2',
          status: 'finished',
          createdAt: 2,
          snapshotUpdatedAt: 2,
          updatedAt: 2,
          isModified: false,
        },
      ],
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session(),
    });
    await runtime.dispatch({ type: 'loadContext' });

    await runtime.dispatch({ type: 'startContextPolling' });
    await waitUntil(() => {
      expect(request.context.getContextDocsAndFiles).toHaveBeenCalledTimes(2);
    });
    await vi.advanceTimersByTimeAsync(10000);
    await waitUntil(() => {
      expect(request.context.getContextDocsAndFiles).toHaveBeenCalledTimes(3);
    });
    await vi.advanceTimersByTimeAsync(10000);
    expect(request.context.getContextDocsAndFiles).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(10000);
    await waitUntil(() => {
      expect(request.context.getContextDocsAndFiles).toHaveBeenCalledTimes(4);
    });

    runtime.dispose();
    vi.useRealTimers();
  });

  test('pauses context polling while the document is hidden', async () => {
    const hiddenDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'hidden'
    );
    let hidden = true;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });
    const request = createRequest();
    (
      request.context.getContextId as ReturnType<typeof vi.fn>
    ).mockResolvedValue('context-1');
    (
      request.context.getContextDocsAndFiles as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      docs: [{ id: 'doc-2', status: 'finished' }],
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session(),
    });
    await runtime.dispatch({ type: 'loadContext' });

    await runtime.dispatch({ type: 'startContextPolling' });
    await Promise.resolve();
    expect(request.context.getContextDocsAndFiles).toHaveBeenCalledTimes(1);

    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await waitUntil(() => {
      expect(request.context.getContextDocsAndFiles).toHaveBeenCalledTimes(2);
    });

    runtime.dispose();
    if (hiddenDescriptor) {
      Object.defineProperty(document, 'hidden', hiddenDescriptor);
    } else {
      Reflect.deleteProperty(document, 'hidden');
    }
  });

  test('new chat clears context and modified document state', async () => {
    const request = createRequest();
    (
      request.context.getContextId as ReturnType<typeof vi.fn>
    ).mockResolvedValue('context-1');
    (
      request.context.getContextDocsAndFiles as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      docs: [
        {
          id: 'doc-2',
          status: 'finished',
          createdAt: 2,
          snapshotUpdatedAt: 2,
          updatedAt: 20,
          isModified: true,
        },
      ],
    });
    const runtime = createRuntime(request);
    await runtime.dispatch({
      type: 'openSessionObject',
      session: session({
        messages: [
          {
            id: 'message-1',
            role: 'user',
            content: 'read doc-2',
            attachments: [],
            streamObjects: [],
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    });
    await runtime.dispatch({ type: 'loadContext' });
    expect(
      runtime.getSnapshot().composer.context.modifiedDocuments
    ).toHaveLength(1);

    await runtime.dispatch({ type: 'createNewSession' });

    expect(runtime.getSnapshot().composer.context).toEqual(
      expect.objectContaining({
        contextId: null,
        items: [],
        modifiedDocuments: [],
      })
    );
  });

  test('pollEmbeddingStatus updates composer embedding completion state', async () => {
    const request = createRequest();
    (request.context.pollEmbeddingStatus as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(async (_workspaceId, onPoll) => {
        onPoll({ embedded: 1, total: 2 });
      })
      .mockImplementationOnce(async (_workspaceId, onPoll) => {
        onPoll({ embedded: 2, total: 2 });
      });
    const runtime = createRuntime(request);

    await runtime.dispatch({ type: 'pollEmbeddingStatus' });
    expect(runtime.getSnapshot().composer.context.embeddingCompleted).toBe(
      false
    );

    await runtime.dispatch({ type: 'pollEmbeddingStatus' });
    expect(runtime.getSnapshot().composer.context.embeddingCompleted).toBe(
      true
    );
  });

  test('startContextPolling owns context polling lifecycle', async () => {
    const request = createRequest();
    (
      request.context.getContextDocsAndFiles as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      docs: [{ docId: 'doc-2', status: 'finished' }],
    });
    (
      request.context.getContextId as ReturnType<typeof vi.fn>
    ).mockResolvedValue('context-1');
    const runtime = createRuntime(request);

    await runtime.dispatch({
      type: 'openSessionObject',
      session: session(),
    });
    await runtime.dispatch({ type: 'loadContext' });
    await runtime.dispatch({ type: 'startContextPolling' });
    await waitUntil(() => {
      expect(request.context.getContextDocsAndFiles).toHaveBeenCalledTimes(2);
    });

    expect(runtime.getSnapshot().composer.context.polling).toBe(false);
    expect(runtime.getSnapshot().composer.context.embeddingCount).toEqual({
      finished: 1,
      processing: 0,
      failed: 0,
    });
  });

  test('fork strategy creates child session from parent without doc tab restrictions', async () => {
    const request = createRequest({
      forkChat: vi.fn().mockResolvedValue('fork-session'),
      getSession: vi.fn().mockResolvedValue(
        session({
          sessionId: 'fork-session',
          docId: 'another-doc',
          parentSessionId: 'parent-session',
        })
      ),
    });
    const runtime = new AIChatRuntime({
      request,
      scope: {
        kind: 'fork',
        workspaceId: 'workspace-1',
        docId: 'doc-1',
        parentSessionId: 'parent-session',
        latestMessageId: 'message-1',
      },
      strategy: new ForkAIChatSessionStrategy(),
    });

    await runtime.dispatch({ type: 'send', input: 'hello' });

    expect(request.forkChat).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      docId: 'doc-1',
      sessionId: 'parent-session',
      latestMessageId: 'message-1',
    });
    expect(runtime.getSnapshot().navigationRequest).toBeNull();
    expect(runtime.getSnapshot().activeSessionId).toBe('fork-session');
  });

  test('playground strategy creates fork sessions from parent scope', async () => {
    const request = createRequest({
      forkChat: vi.fn().mockResolvedValue('playground-fork'),
      getSession: vi.fn().mockResolvedValue(
        session({
          sessionId: 'playground-fork',
          docId: 'doc-1',
          parentSessionId: 'root-session',
        })
      ),
    });
    const runtime = new AIChatRuntime({
      request,
      scope: {
        kind: 'playground',
        workspaceId: 'workspace-1',
        docId: 'doc-1',
        parentSessionId: 'root-session',
      },
      strategy: new PlaygroundAIChatSessionStrategy(),
    });

    const forkSession = await runtime.createSession();

    expect(request.forkChat).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      docId: 'doc-1',
      sessionId: 'root-session',
    });
    expect(forkSession?.sessionId).toBe('playground-fork');
  });
});
