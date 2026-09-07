/**
 * @vitest-environment happy-dom
 */
import { describe, expect, test, vi } from 'vitest';

import { resolveActionPromptName } from './action-definitions';
import { type CopilotClient, Endpoint } from './copilot-client';
import { textToText, toImage } from './message-transport';
import { AIRequestService } from './service';

Object.defineProperty(globalThis, 'EventSource', {
  configurable: true,
  value: {
    CLOSED: 2,
  },
});

vi.mock('@affine/graphql', () => ({
  ContextCategories: {
    Tag: 'tag',
    Collection: 'collection',
  },
}));

function createClosedEventSource(): EventSource {
  return {
    readyState: EventSource.CLOSED,
    addEventListener: vi.fn(),
    close: vi.fn(),
  } as unknown as EventSource;
}

function createClient(
  overrides: Partial<
    Pick<
      CopilotClient,
      | 'gql'
      | 'createSession'
      | 'createMessage'
      | 'getSessions'
      | 'getHistories'
      | 'chatTextStream'
      | 'imagesStream'
    >
  > = {}
) {
  return {
    gql: vi.fn().mockResolvedValue({}),
    createSession: vi.fn().mockImplementation(async options => {
      return `session:${options.promptName}`;
    }),
    createMessage: vi.fn().mockResolvedValue('message-1'),
    getSessions: vi.fn().mockResolvedValue([]),
    getHistories: vi.fn().mockResolvedValue([]),
    chatTextStream: vi.fn(() => createClosedEventSource()),
    imagesStream: vi.fn(() => createClosedEventSource()),
    ...overrides,
  } as unknown as CopilotClient;
}

async function drain(stream: AsyncIterable<unknown>) {
  for await (const chunk of stream) {
    void chunk;
  }
}

async function drainActionResult(
  stream: string | AsyncIterable<unknown> | undefined
) {
  expect(stream).toBeDefined();
  expect(typeof stream).not.toBe('string');
  await drain(stream as AsyncIterable<unknown>);
}

describe('runtime request transport', () => {
  test('keeps non-image attachment bytes, filename and MIME intact', async () => {
    const client = createClient();
    const document = new File(['Native Office bytes'], 'report.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    await drain(
      textToText({
        client,
        sessionId: 'project-session',
        content: 'Read this file',
        attachments: [document],
        stream: true,
      }) as AsyncIterable<string>
    );
    const blobs = vi.mocked(client.createMessage).mock.calls[0][0].blobs;
    expect(blobs).toHaveLength(1);
    const sent = blobs?.[0] as File;
    expect(sent.name).toBe(document.name);
    expect(sent.type).toBe(document.type);
    expect(await sent.text()).toBe('Native Office bytes');
  });

  test('does not create a stream after cancellation', async () => {
    const controller = new AbortController();
    const client = createClient({
      createMessage: vi.fn().mockImplementation(async () => {
        controller.abort();
        return 'message-1';
      }),
    });

    await drain(
      textToText({
        client,
        sessionId: 'session-1',
        workspaceId: 'workspace-1',
        content: 'hello',
        stream: true,
        signal: controller.signal,
      }) as AsyncIterable<string>
    );

    expect(client.gql).not.toHaveBeenCalled();
    expect(client.chatTextStream).not.toHaveBeenCalled();
  });

  test('does not create an image stream after cancellation', async () => {
    const controller = new AbortController();
    const client = createClient({
      createMessage: vi.fn().mockImplementation(async () => {
        controller.abort();
        return 'message-1';
      }),
    });

    await drain(
      toImage({
        client,
        sessionId: 'session-1',
        workspaceId: 'workspace-1',
        content: 'image',
        endpoint: Endpoint.Images,
        signal: controller.signal,
      }) as AsyncIterable<string>
    );

    expect(client.gql).not.toHaveBeenCalled();
    expect(client.imagesStream).not.toHaveBeenCalled();
  });

  test('forwards the Workbench surface marker only on marked text streams', async () => {
    const client = createClient();

    await drain(
      textToText({
        client,
        sessionId: 'session-1',
        workspaceId: 'workspace-1',
        content: 'workbench chat',
        stream: true,
        chatSurface: 'intelligence_workbench',
      }) as AsyncIterable<string>
    );
    expect(client.chatTextStream).toHaveBeenLastCalledWith(
      expect.objectContaining({ chatSurface: 'intelligence_workbench' }),
      Endpoint.StreamObject
    );

    await expect(
      textToText({
        client,
        sessionId: 'session-non-stream',
        workspaceId: 'workspace-1',
        content: 'non-stream workbench chat',
        chatSurface: 'intelligence_workbench',
      }) as Promise<string>
    ).resolves.toBe('');
    expect(client.chatTextStream).toHaveBeenLastCalledWith(
      expect.objectContaining({
        chatSurface: 'intelligence_workbench',
        sessionId: 'session-non-stream',
      }),
      Endpoint.StreamObject
    );

    await drain(
      textToText({
        client,
        sessionId: 'session-2',
        workspaceId: 'workspace-1',
        content: 'document chat',
        stream: true,
      }) as AsyncIterable<string>
    );
    expect(client.chatTextStream).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ chatSurface: expect.anything() }),
      Endpoint.StreamObject
    );
  });
});

describe('AIRequestService action definitions', () => {
  test('resolves static and dynamic action prompt names', () => {
    expect(
      resolveActionPromptName('createSlides', {
        workspaceId: 'workspace-1',
        input: 'make slides',
      })
    ).toBe('slides.outline');
    expect(
      resolveActionPromptName('makeItReal', {
        workspaceId: 'workspace-1',
        input: 'make html',
        attachments: ['blob-1'],
      })
    ).toBe('Make it real');
    expect(
      resolveActionPromptName('makeItReal', {
        workspaceId: 'workspace-1',
        input: 'make html',
      })
    ).toBe('Make it real with text');
    expect(
      resolveActionPromptName('filterImage', {
        workspaceId: 'workspace-1',
        input: 'convert',
        style: 'Sketch style',
      })
    ).toBe('image.filter.sketch');
  });

  test('throws when a dynamic action prompt cannot be resolved', () => {
    expect(() =>
      resolveActionPromptName('filterImage', {
        workspaceId: 'workspace-1',
        input: 'convert',
      })
    ).toThrow('filterImage requires a promptName');
    expect(() =>
      resolveActionPromptName('processImage', {
        workspaceId: 'workspace-1',
        input: 'process',
      })
    ).toThrow('processImage requires a promptName');
  });

  test('persists the strict Office context in the user message params', async () => {
    const client = createClient();
    const service = new AIRequestService(client);
    const officeContext = {
      version: 'localmind-office-ai-context/v1',
      workspaceId: 'workspace-1',
      artifactId: 'artifact-1',
      artifactKind: 'workbook',
      revisionId: 'revision-3',
      selection: {
        kind: 'workbook',
        target: {
          type: 'cell_range',
          sheetId: 'sheet-1',
          range: 'B2:D8',
        },
      },
    } as const;

    await drainActionResult(
      (await service.executeAction('chat', {
        workspaceId: 'workspace-1',
        input: 'format the selected range',
        officeContext,
        stream: true,
      })) as AsyncIterable<unknown>
    );

    expect(client.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ officeContext }),
      }),
      expect.anything()
    );
  });

  test('routes action-stream requests through action endpoint', async () => {
    const client = createClient();
    const service = new AIRequestService(client);

    await drainActionResult(
      (await service.executeAction('brainstormMindmap', {
        workspaceId: 'workspace-1',
        input: 'make a map',
        stream: true,
      })) as AsyncIterable<unknown>
    );
    await drainActionResult(
      (await service.executeAction('createSlides', {
        workspaceId: 'workspace-1',
        input: 'make slides',
        stream: true,
      })) as AsyncIterable<unknown>
    );
    await drainActionResult(
      (await service.executeAction('filterImage', {
        workspaceId: 'workspace-1',
        input: 'convert',
        attachments: ['blob-1'],
        style: 'Sketch style',
      })) as AsyncIterable<unknown>
    );

    expect(client.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ promptName: 'mindmap.generate' })
    );
    expect(client.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ promptName: 'slides.outline' })
    );
    expect(client.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ promptName: 'image.filter.sketch' })
    );
    expect(client.chatTextStream).toHaveBeenCalledWith(
      expect.objectContaining({ actionId: 'mindmap.generate' }),
      Endpoint.Action
    );
    expect(client.chatTextStream).toHaveBeenCalledWith(
      expect.objectContaining({ actionId: 'slides.outline' }),
      Endpoint.Action
    );
    expect(client.chatTextStream).toHaveBeenCalledWith(
      expect.objectContaining({ actionId: 'image.filter.sketch' }),
      Endpoint.Action
    );
    expect(client.imagesStream).not.toHaveBeenCalled();
  });

  test('passes selected modelId through text and image action transports', async () => {
    const client = createClient();
    const service = new AIRequestService(client);

    await drainActionResult(
      (await service.executeAction('summary', {
        workspaceId: 'workspace-1',
        input: 'summarize',
        modelId: 'text-model',
        modelSelection: {
          modelId: 'text-model',
          promptName: 'Summary',
          source: 'prompt_preference',
        },
        stream: true,
      })) as AsyncIterable<unknown>
    );
    await drainActionResult(
      (await service.executeAction('createImage', {
        workspaceId: 'workspace-1',
        input: 'draw',
        modelId: 'image-model',
        stream: true,
      })) as AsyncIterable<unknown>
    );
    await drainActionResult(
      (await service.executeAction('filterImage', {
        workspaceId: 'workspace-1',
        input: 'convert',
        attachments: ['blob-1'],
        style: 'Sketch style',
        modelId: 'image-action-model',
        modelSelection: {
          modelId: 'image-action-model',
          promptName: 'image.filter.sketch',
          source: 'explicit',
        },
        stream: true,
      })) as AsyncIterable<unknown>
    );

    expect(client.chatTextStream).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'text-model',
        modelSelectionSource: 'prompt_preference',
      }),
      Endpoint.StreamObject
    );
    expect(client.imagesStream).toHaveBeenCalledWith(
      'session:Generate image',
      'message-1',
      undefined,
      undefined,
      undefined,
      'image-model'
    );
    expect(client.chatTextStream).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'image-action-model',
        modelSelectionSource: 'explicit',
      }),
      Endpoint.Action
    );
  });

  test('reuses the last action session for retry', async () => {
    const client = createClient();
    const service = new AIRequestService(client);

    await drainActionResult(
      (await service.executeAction('summary', {
        workspaceId: 'workspace-1',
        input: 'summarize',
        stream: true,
      })) as AsyncIterable<unknown>
    );
    await drainActionResult(
      (await service.executeAction('summary', {
        workspaceId: 'workspace-1',
        input: 'summarize again',
        retry: true,
        stream: true,
      })) as AsyncIterable<unknown>
    );

    expect(client.createSession).toHaveBeenCalledTimes(1);
    expect(client.createMessage).toHaveBeenCalledTimes(1);
    expect(client.chatTextStream).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionId: 'session:Summary',
        retry: true,
      }),
      Endpoint.StreamObject
    );
  });

  test('reports action result against the matching host action', async () => {
    const client = createClient();
    const service = new AIRequestService(client);
    const events: string[] = [];
    const hostOne = {} as NonNullable<
      BlockSuitePresets.AITextActionOptions['host']
    >;
    const hostTwo = {} as NonNullable<
      BlockSuitePresets.AITextActionOptions['host']
    >;
    const subscription = service.actionEvents$.subscribe(event => {
      events.push(
        `${event.options.host === hostOne ? 'one' : 'two'}:${event.event}:${
          event.promptName
        }:${event.modelSelection?.source ?? 'none'}`
      );
    });

    await drainActionResult(
      (await service.executeAction('summary', {
        workspaceId: 'workspace-1',
        input: 'first',
        host: hostOne,
        modelId: 'summary-model',
        modelSelection: {
          modelId: 'summary-model',
          promptName: 'Summary',
          source: 'prompt_preference',
        },
        stream: true,
      })) as AsyncIterable<unknown>
    );
    await drainActionResult(
      (await service.executeAction('translate', {
        workspaceId: 'workspace-1',
        input: 'second',
        lang: 'French',
        host: hostTwo,
        stream: true,
      })) as AsyncIterable<unknown>
    );

    const reportedEvent = service.reportLastAction(
      'result:continue-in-chat',
      hostOne
    );
    subscription.unsubscribe();

    expect(events).toEqual([
      'one:started:Summary:prompt_preference',
      'one:finished:Summary:prompt_preference',
      'two:started:Translate to:none',
      'two:finished:Translate to:none',
      'one:result:continue-in-chat:Summary:prompt_preference',
    ]);
    expect(reportedEvent).toMatchObject({
      action: 'summary',
      event: 'result:continue-in-chat',
      modelSelection: {
        modelId: 'summary-model',
        promptName: 'Summary',
        source: 'prompt_preference',
      },
      options: {
        modelSelection: {
          modelId: 'summary-model',
          promptName: 'Summary',
          source: 'prompt_preference',
        },
      },
      promptName: 'Summary',
    });
  });

  test('loads sessions through history query with messages', async () => {
    const history = {
      sessionId: 'session-1',
      workspaceId: 'workspace-1',
      docId: 'doc-1',
      messages: [{ id: 'message-1', role: 'user', content: 'hello' }],
    };
    const client = createClient({
      getHistories: vi.fn().mockResolvedValue([history]),
    });
    const service = new AIRequestService(client);

    const session = await service.getSession('workspace-1', 'session-1');

    expect(client.getHistories).toHaveBeenCalledWith(
      'workspace-1',
      {},
      undefined,
      expect.objectContaining({
        sessionId: 'session-1',
        withMessages: true,
      })
    );
    expect(session?.messages).toEqual(history.messages);
  });

  test('loads chat history lists with messages for title derivation', async () => {
    const client = createClient();
    const service = new AIRequestService(client);

    await service.getSessions('workspace-1', 'doc-1', {
      action: false,
      fork: false,
    });
    await service.getRecentSessions('workspace-1', 10, 20);

    expect(client.getSessions).toHaveBeenCalledWith(
      'workspace-1',
      {},
      'doc-1',
      expect.objectContaining({
        action: false,
        fork: false,
        withMessages: true,
      }),
      undefined
    );
    expect(client.getHistories).toHaveBeenCalledWith(
      'workspace-1',
      { first: 10, offset: 20 },
      undefined,
      expect.objectContaining({
        action: false,
        fork: false,
        sessionOrder: 'desc',
        withMessages: true,
      })
    );
  });
});
