import test from 'ava';
import Sinon from 'sinon';
import { z } from 'zod';

import { OFFICE_COMMAND_MAX_BYTES } from '../../models';
import { CapabilityPolicyHost } from '../../plugins/copilot/runtime/hosts/capability-policy-host';
import { ToolRuntime } from '../../plugins/copilot/runtime/tool-runtime';
import { TurnOrchestrator } from '../../plugins/copilot/runtime/turn-orchestrator';

const officeContext = {
  version: 'localmind-office-ai-context/v1',
  workspaceId: 'workspace-1',
  artifactId: 'artifact-1',
  artifactKind: 'pdf',
  revisionId: 'revision-1',
  selection: {
    kind: 'pdf',
    target: { type: 'page', pageIndex: 0 },
  },
} as const;

test('native Project collaboration survives empty legacy prompt config while Office and Workspace scopes stay bounded', async t => {
  const host = new CapabilityPolicyHost(
    { features: [] } as never,
    {} as never,
    {} as never,
    {
      getEffectiveModelSelectionScope: Sinon.stub().resolves({
        projectModelId: 'byok/model',
      }),
      resolveModelContextWindow: Sinon.stub().resolves(32_000),
    } as never
  );
  const session = {
    config: {
      sessionId: 'session-1',
      userId: 'user-1',
      workspaceId: null,
      selectedContextProjectId: 'project-1',
      promptConfig: {},
    },
    model: 'byok/model',
  };
  const selection = await host.selectChat(session as never, {
    responseMode: 'object',
    chatSurface: 'intelligence_workbench',
  });
  t.deepEqual(selection.providerOptions.tools, ['blocker']);
  const office = await host.selectChat(session as never, {
    responseMode: 'object',
    officeContext,
  });
  t.deepEqual(office.providerOptions.tools, ['office']);
  const workspace = await host.selectChat(
    {
      ...session,
      config: { ...session.config, workspaceId: 'workspace-1' },
    } as never,
    { responseMode: 'text' }
  );
  t.is(workspace.providerOptions.tools, undefined);
});

test('forces Office chats onto BYOK-only routing and the native Office tool group', async t => {
  const resolveModelId = Sinon.stub().resolves('byok/model');
  const resolveModelContextWindow = Sinon.stub().resolves(32_000);
  const host = new CapabilityPolicyHost(
    { features: [] } as never,
    {} as never,
    {
      resolveRequestedModel: Sinon.stub().returns({
        selectedModel: 'byok/model',
        matchedOptionalModel: true,
      }),
    } as never,
    {
      getEffectiveModelSelectionScope: Sinon.stub().resolves({
        providerIds: ['byok'],
        configuredModelIds: ['byok/model'],
      }),
      resolveModelId,
      resolveModelContextWindow,
    } as never
  );
  const selection = await host.selectChat(
    {
      config: {
        sessionId: 'session-1',
        userId: 'user-1',
        workspaceId: 'workspace-1',
        promptConfig: { tools: ['docRead', 'webSearch'] },
      },
      model: 'byok/model',
      optionalModels: ['byok/model'],
    } as never,
    {
      responseMode: 'text',
      quotaBackedRoutesAllowed: true,
      officeContext,
      byokLeaseId: 'lease-1',
    }
  );

  t.deepEqual(selection.providerOptions.tools, ['office']);
  t.false(selection.providerOptions.quotaBackedRoutesAllowed);
  t.deepEqual(selection.providerOptions.officeContext, officeContext);
  for (const call of resolveModelId.getCalls()) {
    t.false(call.args[2].quotaBackedRoutesAllowed);
    t.is(call.args[2].byokLeaseId, 'lease-1');
  }
  t.false(resolveModelContextWindow.firstCall.args[2].quotaBackedRoutesAllowed);
});

test('exposes only bounded read and approval-gated Office request tools', async t => {
  const readStateForAi = Sinon.stub().resolves({
    artifactId: officeContext.artifactId,
    revisionId: officeContext.revisionId,
    sequence: 1,
    stateFingerprint: `sha256:${'1'.repeat(64)}`,
    truncated: false,
    byteSize: 2,
    state: {},
  });
  const request = Sinon.stub().resolves({
    run: { id: 'run-1', status: 'waiting_approval' },
    request: {
      id: 'request-1',
      artifactId: officeContext.artifactId,
      expectedRevisionId: officeContext.revisionId,
      commandFingerprint: `sha256:${'2'.repeat(64)}`,
    },
    preview: {
      packageFingerprint: `sha256:${'3'.repeat(64)}`,
      stateFingerprint: `sha256:${'4'.repeat(64)}`,
      summary: { operation: 'office.pdf.page.rotate' },
    },
  });
  const requestBatch = Sinon.stub().resolves({
    run: { id: 'run-2', status: 'waiting_approval' },
    request: {
      id: 'request-2',
      artifactId: officeContext.artifactId,
      expectedRevisionId: officeContext.revisionId,
      commandFingerprint: `sha256:${'5'.repeat(64)}`,
    },
    preview: {
      packageFingerprint: `sha256:${'6'.repeat(64)}`,
      stateFingerprint: `sha256:${'7'.repeat(64)}`,
      summary: { operation: 'office.command.batch' },
    },
  });
  const runtime = new ToolRuntime(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { readStateForAi, request, requestBatch } as never,
    {} as never,
    {} as never
  );

  const tools = await runtime.getTools(
    {
      tools: ['office'],
      user: 'user-1',
      workspace: 'workspace-1',
      officeContext,
    },
    'byok/model'
  );

  t.deepEqual(Object.keys(tools).sort(), [
    'office_command_batch_request',
    'office_command_request',
    'office_read',
  ]);
  const readResult = await tools.office_read.execute?.({}, {});
  t.deepEqual(readResult, {
    artifactId: officeContext.artifactId,
    revisionId: officeContext.revisionId,
    sequence: 1,
    stateFingerprint: `sha256:${'1'.repeat(64)}`,
    truncated: false,
    byteSize: 2,
    state: {},
  });
  Sinon.assert.calledOnceWithExactly(readStateForAi, {
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    artifactId: officeContext.artifactId,
    revisionId: officeContext.revisionId,
    selector: undefined,
  });
  const readSchema = tools.office_read.jsonSchema ?? {};
  const readProperties = (readSchema.properties ?? {}) as Record<
    string,
    unknown
  >;
  t.false(Object.hasOwn(readSchema, 'required'));
  t.deepEqual(Object.keys(readProperties), ['selector']);
  t.false(Object.hasOwn(readProperties, 'artifact_id'));
  t.false(Object.hasOwn(readProperties, 'revision_id'));
  t.false(readSchema.additionalProperties as boolean);

  const inputSchema = tools.office_read.inputSchema;
  t.true(inputSchema instanceof z.ZodType);
  if (!(inputSchema instanceof z.ZodType)) return;
  for (const selector of [null, 'null']) {
    readStateForAi.resetHistory();
    await tools.office_read.execute?.(inputSchema.parse({ selector }), {});
    Sinon.assert.calledOnceWithExactly(readStateForAi, {
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      artifactId: officeContext.artifactId,
      revisionId: officeContext.revisionId,
      selector: undefined,
    });
  }
  readStateForAi.resetHistory();
  const encodedSelector = inputSchema.parse({
    selector: '{"kind":"pdf","page_index":0}',
  });
  await tools.office_read.execute?.(encodedSelector, {});
  Sinon.assert.calledOnceWithExactly(readStateForAi, {
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    artifactId: officeContext.artifactId,
    revisionId: officeContext.revisionId,
    selector: { kind: 'pdf', page_index: 0 },
  });

  const command = {
    version: 'localmind-office-command/v1',
    commandId: 'command-1',
    idempotencyKey: 'command-1',
    artifactId: officeContext.artifactId,
    expectedRevisionId: officeContext.revisionId,
    source: 'ai',
    operation: 'office.pdf.page.rotate',
    target: { type: 'page', pageIndex: 0 },
    rotationDeg: 90,
  } as const;
  const batch = {
    version: 'localmind-office-command-batch/v1',
    batchId: 'batch-1',
    idempotencyKey: 'batch-1',
    artifactId: officeContext.artifactId,
    expectedRevisionId: officeContext.revisionId,
    source: 'ai',
    commands: [command],
  } as const;
  const commandSchema = tools.office_command_request.inputSchema;
  const batchSchema = tools.office_command_batch_request.inputSchema;
  t.true(commandSchema instanceof z.ZodType);
  t.true(batchSchema instanceof z.ZodType);
  if (
    !(commandSchema instanceof z.ZodType) ||
    !(batchSchema instanceof z.ZodType)
  ) {
    return;
  }

  const encodedCommand = commandSchema.parse({
    command: JSON.stringify(command),
  });
  const encodedBatch = batchSchema.parse({ batch: JSON.stringify(batch) });
  t.deepEqual(encodedCommand.command, command);
  t.deepEqual(encodedBatch.batch, batch);
  await tools.office_command_request.execute?.(encodedCommand, {});
  await tools.office_command_batch_request.execute?.(encodedBatch, {});
  Sinon.assert.calledOnceWithExactly(request, {
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    command,
    title: undefined,
    reason: undefined,
  });
  Sinon.assert.calledOnceWithExactly(requestBatch, {
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    batch,
    title: undefined,
    reason: undefined,
  });

  t.throws(() => commandSchema.parse({ command: '{"version":' }), {
    message: /command must be valid JSON/,
  });
  t.throws(() => batchSchema.parse({ batch: '{"version":' }), {
    message: /batch must be valid JSON/,
  });
  const oversizedJson = `{"padding":"${'x'.repeat(OFFICE_COMMAND_MAX_BYTES)}"}`;
  t.throws(() => commandSchema.parse({ command: oversizedJson }));
  t.throws(() => batchSchema.parse({ batch: oversizedJson }));
});

test('revalidates persisted Office turn context and injects fixed-layout planner policy', async t => {
  const latestTurn = {
    id: 'turn-1',
    conversationId: 'session-1',
    role: 'user',
    content: 'Rewrite the PDF body text',
    attachments: [],
    metadata: { officeContext },
    renderTrace: [],
    toolEvents: [],
    createdAt: new Date('2026-09-04T08:00:00.000Z'),
  };
  const finish = Sinon.stub().returns([
    { role: 'system', content: 'Base planner policy' },
    { role: 'user', content: latestTurn.content },
  ]);
  const session = {
    config: {
      sessionId: 'session-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    },
    finish,
  };
  const conversations = {
    prepareTurn: Sinon.stub().resolves({
      latestTurn,
      session,
      params: {},
      messageId: 'message-1',
      quotaBackedRoutesAllowed: true,
    }),
    buildLatestTurnPromptParams: Sinon.stub().returns({}),
  };
  const validateAiContext = Sinon.stub().resolves({
    context: officeContext,
    artifact: { title: 'Review', sourceFileName: 'review.pdf' },
    revision: { sequence: 1 },
  });
  const selectChat = Sinon.stub().resolves({
    model: 'byok/model',
    contextWindow: 32_000,
    providerOptions: {
      tools: ['office'],
      officeContext,
      quotaBackedRoutesAllowed: false,
    },
  });
  const persistTextResult = Sinon.stub().resolves();
  const orchestrator = new TurnOrchestrator(
    conversations as never,
    { getOwnedBySessionId: Sinon.stub().resolves(null) } as never,
    { validateAiContext } as never,
    { selectChat } as never,
    {
      streamText: Sinon.stub().callsFake(async function* () {
        yield 'Use a supported PDF command.';
      }),
    } as never,
    {} as never,
    { persistTextResult } as never,
    {} as never
  );

  const result = await orchestrator.streamText('user-1', 'session-1', {});
  const chunks: string[] = [];
  for await (const chunk of result.stream) chunks.push(chunk);

  t.deepEqual(chunks, ['Use a supported PDF command.']);
  Sinon.assert.calledOnceWithMatch(validateAiContext, {
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    context: officeContext,
  });
  Sinon.assert.calledOnceWithMatch(selectChat, session, {
    responseMode: 'text',
    quotaBackedRoutesAllowed: false,
    officeContext,
  });
  const policy = result.finalMessage.find(
    message =>
      message.role === 'system' && message.content.includes('office_read')
  );
  t.truthy(policy);
  t.regex(policy?.content ?? '', /Never invent stable IDs/);
  t.regex(policy?.content ?? '', /do not claim the edit completed/i);
  t.regex(policy?.content ?? '', /PDF is fixed-layout/);
  t.regex(policy?.content ?? '', /reject body-text rewrite or reflow/i);
  t.true(persistTextResult.calledOnce);
});

test('supports the object stream transport used by Office AI Chat', async t => {
  const latestTurn = {
    id: 'turn-1',
    conversationId: 'session-1',
    role: 'user',
    content: 'Read the current PDF page',
    attachments: [],
    metadata: { officeContext },
    renderTrace: [],
    toolEvents: [],
    createdAt: new Date('2026-09-04T08:00:00.000Z'),
  };
  const finish = Sinon.stub().returns([
    { role: 'system', content: 'Base planner policy' },
    { role: 'user', content: latestTurn.content },
  ]);
  const session = {
    config: {
      sessionId: 'session-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
    },
    finish,
  };
  const conversations = {
    prepareTurn: Sinon.stub().resolves({
      latestTurn,
      session,
      params: {},
      messageId: 'message-1',
      quotaBackedRoutesAllowed: true,
    }),
    buildLatestTurnPromptParams: Sinon.stub().returns({}),
  };
  const validateAiContext = Sinon.stub().resolves({
    context: officeContext,
    artifact: { title: 'Review', sourceFileName: 'review.pdf' },
    revision: { sequence: 1 },
  });
  const selectChat = Sinon.stub().resolves({
    model: 'byok/model',
    contextWindow: 32_000,
    providerOptions: {
      tools: ['office'],
      officeContext,
      quotaBackedRoutesAllowed: false,
    },
  });
  const persistObjectResult = Sinon.stub().resolves();
  const chunk = {
    type: 'text-delta',
    textDelta: 'Current page read.',
  } as const;
  const orchestrator = new TurnOrchestrator(
    conversations as never,
    { getOwnedBySessionId: Sinon.stub().resolves(null) } as never,
    { validateAiContext } as never,
    { selectChat } as never,
    {
      streamObject: Sinon.stub().callsFake(async function* () {
        yield chunk;
      }),
    } as never,
    {} as never,
    { persistObjectResult } as never,
    {} as never
  );

  const result = await orchestrator.streamObject('user-1', 'session-1', {});
  const chunks = [];
  for await (const value of result.stream) chunks.push(value);

  t.deepEqual(chunks, [chunk]);
  Sinon.assert.calledOnceWithMatch(selectChat, session, {
    responseMode: 'object',
    quotaBackedRoutesAllowed: false,
    officeContext,
  });
  t.truthy(
    result.finalMessage.find(
      message =>
        message.role === 'system' && message.content.includes('office_read')
    )
  );
  Sinon.assert.calledOnceWithExactly(
    persistObjectResult,
    session,
    [chunk],
    false
  );
});
