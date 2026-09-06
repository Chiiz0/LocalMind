import { Readable } from 'node:stream';

import test from 'ava';
import Sinon from 'sinon';

import type {
  OfficeArtifactService,
  OfficeCommandService,
} from '../../core/office';
import type { WorkspaceBlobStorage } from '../../core/storage';
import type { Models } from '../../models';
import type {
  CopilotAgentRuntimeWorkflowAdapter,
  CopilotAgentRuntimeWorkflowRegistry,
} from '../../plugins/copilot/agent-runtime-workflow-registry';
import {
  AGENT_RUNTIME_OFFICE_COMMAND_WORKFLOW,
  CopilotAgentRuntimeOfficeCommandAdapter,
  OfficeAgentCommandService,
} from '../../plugins/copilot/office-agent-command';
import {
  buildOfficeCommandBatchRequestHandler,
  buildOfficeCommandRequestHandler,
  buildOfficeReadHandler,
} from '../../plugins/copilot/tools/office';

const command = {
  version: 'localmind-office-command/v1',
  commandId: 'command-1',
  idempotencyKey: 'office-command-1',
  artifactId: 'artifact-1',
  expectedRevisionId: 'revision-1',
  source: 'ai',
  operation: 'office.document.text.format',
  target: {
    type: 'text_range',
    start: { blockId: 'paragraph-1', offset: 0 },
    end: { blockId: 'paragraph-1', offset: 4 },
  },
  format: { fontSizePt: 14, italic: true },
} as const;

const batch = {
  version: 'localmind-office-command-batch/v1',
  batchId: 'batch-1',
  idempotencyKey: 'office-batch-1',
  artifactId: command.artifactId,
  expectedRevisionId: command.expectedRevisionId,
  source: 'ai',
  commands: [
    command,
    {
      ...command,
      commandId: 'command-2',
      idempotencyKey: 'office-command-2',
      format: { textColor: '#0000FF', underline: { style: 'single' } },
    },
  ],
} as const;

const preview = {
  artifact: {
    id: 'artifact-1',
    kind: 'document' as const,
    title: 'Quarterly Plan',
    sourceFileName: 'quarterly-plan.docx',
  },
  revision: { id: 'revision-1', sequence: 1 },
  packageFingerprint: `sha256:${'1'.repeat(64)}`,
  stateFingerprint: `sha256:${'2'.repeat(64)}`,
  stats: { changedRuns: 1 },
  summary: { operation: command.operation, changedRuns: 1 },
};

function requestRecord(value: typeof command | typeof batch = command) {
  const bytes = Buffer.from(JSON.stringify(value), 'utf8');
  return {
    bytes,
    request: {
      id: 'request-1',
      workspaceId: 'workspace-1',
      artifactId: value.artifactId,
      expectedRevisionId: value.expectedRevisionId,
      requestedBy: 'user-1',
      idempotencyKey: value.idempotencyKey,
      commandBlobKey: 'office/command/request.json',
      commandByteSize: bytes.byteLength,
      commandFingerprint: '',
      previewPackageFingerprint: preview.packageFingerprint,
      previewStateFingerprint: preview.stateFingerprint,
      previewSummary: preview.summary,
      createdAt: new Date(),
    },
  };
}

test('creates an approval-gated Agent Runtime run without applying the Office command', async t => {
  const createRun = Sinon.stub().callsFake(async input => ({
    id: 'run-1',
    ...input,
  }));
  const createOrReuse = Sinon.stub().callsFake(async input => ({
    created: true,
    request: {
      id: 'request-1',
      ...input,
      requestedBy: input.actorId,
    },
  }));
  const models = {
    officeCommandRequest: { createOrReuse },
    copilotContext: { assertDocumentSourcesShared: Sinon.stub().resolves() },
    copilotAgentRuntime: { createRun },
  } as unknown as Models;
  const storage = {
    put: Sinon.stub().resolves(),
  } as unknown as WorkspaceBlobStorage;
  const commands = {
    preview: Sinon.stub().resolves(preview),
    execute: Sinon.stub(),
  } as unknown as OfficeCommandService;
  const service = new OfficeAgentCommandService(
    models,
    storage,
    commands,
    {} as OfficeArtifactService
  );

  const result = await service.request({
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    command,
    reason: 'Apply approved formatting',
  });

  t.is(result.run.status, 'waiting_approval');
  t.is(
    createRun.firstCall.args[0].workflow,
    AGENT_RUNTIME_OFFICE_COMMAND_WORKFLOW
  );
  t.deepEqual(
    createRun.firstCall.args[0].steps.map(
      (step: { status: string }) => step.status
    ),
    ['waiting_approval', 'waiting_approval']
  );
  const approvalRequest =
    createRun.firstCall.args[0].steps[0].outputSummary.approvalRequest;
  t.is(approvalRequest.previewPackageFingerprint, preview.packageFingerprint);
  t.is(approvalRequest.previewStateFingerprint, preview.stateFingerprint);
  t.is(approvalRequest.artifactKind, preview.artifact.kind);
  t.is(approvalRequest.artifactTitle, preview.artifact.title);
  t.is(approvalRequest.sourceFileName, preview.artifact.sourceFileName);
  t.is(approvalRequest.revisionSequence, preview.revision.sequence);
  t.regex(approvalRequest.requestFingerprint, /^sha256:[0-9a-f]{64}$/);
  t.true((storage.put as Sinon.SinonStub).calledOnce);
  t.false((commands.execute as Sinon.SinonStub).called);
});

test('accepts approval-gated AI commands for every native Office engine', async t => {
  const commands = [
    {
      version: 'localmind-office-command/v1',
      commandId: 'workbook-command',
      idempotencyKey: 'workbook-command',
      artifactId: 'workbook-1',
      expectedRevisionId: 'workbook-revision-1',
      source: 'ai',
      operation: 'office.workbook.cell.set',
      target: { type: 'cell', sheetId: 'sheet-1', address: 'B2' },
      input: { type: 'formula', formula: 'SUM(A1:A2)' },
    },
    {
      version: 'localmind-office-command/v1',
      commandId: 'presentation-command',
      idempotencyKey: 'presentation-command',
      artifactId: 'presentation-1',
      expectedRevisionId: 'presentation-revision-1',
      source: 'ai',
      operation: 'office.presentation.shape.text.set',
      target: { type: 'shape', slideId: 'slide-1', shapeId: 'shape-1' },
      text: 'Native slide text',
    },
    {
      version: 'localmind-office-command/v1',
      commandId: 'pdf-command',
      idempotencyKey: 'pdf-command',
      artifactId: 'pdf-1',
      expectedRevisionId: 'pdf-revision-1',
      source: 'ai',
      operation: 'office.pdf.annotation.add',
      target: { type: 'page', pageIndex: 0 },
      annotation: {
        subtype: 'highlight',
        rect: { xPt: 10, yPt: 10, widthPt: 100, heightPt: 20 },
        contents: 'Review this',
        color: '#FFFF00',
      },
    },
  ];
  const createRun = Sinon.stub().callsFake(async input => ({
    id: `run-${input.sourceId}`,
    ...input,
  }));
  const createOrReuse = Sinon.stub().callsFake(async input => ({
    created: true,
    request: {
      id: `request-${input.artifactId}`,
      ...input,
      requestedBy: input.actorId,
    },
  }));
  const models = {
    officeCommandRequest: { createOrReuse },
    copilotContext: { assertDocumentSourcesShared: Sinon.stub().resolves() },
    copilotAgentRuntime: { createRun },
  } as unknown as Models;
  const storage = {
    put: Sinon.stub().resolves(),
  } as unknown as WorkspaceBlobStorage;
  const officeCommands = {
    preview: Sinon.stub().callsFake(async ({ command }) => ({
      ...preview,
      artifact: { id: command.artifactId },
      revision: { id: command.expectedRevisionId },
      summary: { operation: command.operation },
    })),
    execute: Sinon.stub(),
  } as unknown as OfficeCommandService;
  const service = new OfficeAgentCommandService(
    models,
    storage,
    officeCommands,
    {} as OfficeArtifactService
  );

  for (const candidate of commands) {
    const result = await service.request({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      command: candidate,
    });
    t.is(result.run.status, 'waiting_approval');
  }
  t.is((officeCommands.preview as Sinon.SinonStub).callCount, commands.length);
  t.false((officeCommands.execute as Sinon.SinonStub).called);
});

function adapterFixture(options?: {
  preview?: typeof preview;
  previewError?: Error;
  payload?:
    | { kind: 'command'; command: typeof command }
    | { kind: 'batch'; batch: typeof batch };
  executionCreated?: boolean;
}) {
  const payload = options?.payload ?? ({ kind: 'command', command } as const);
  const persisted = requestRecord(
    payload.kind === 'command' ? payload.command : payload.batch
  );
  let adapter: CopilotAgentRuntimeWorkflowAdapter | undefined;
  const completeStandaloneWorkerExecution = Sinon.stub().resolves();
  const models = {
    copilotAgentRuntime: { completeStandaloneWorkerExecution },
  } as unknown as Models;
  const commandService = {
    preview: options?.previewError
      ? Sinon.stub().rejects(options.previewError)
      : Sinon.stub().resolves(options?.preview ?? preview),
    previewBatch: options?.previewError
      ? Sinon.stub().rejects(options.previewError)
      : Sinon.stub().resolves(options?.preview ?? preview),
    execute: Sinon.stub().resolves({
      created: options?.executionCreated ?? true,
      revision: {
        id: 'revision-2',
        artifactId: 'artifact-1',
        sequence: 2,
      },
      packageFingerprint: `sha256:${'3'.repeat(64)}`,
      stateFingerprint: `sha256:${'4'.repeat(64)}`,
    }),
    executeBatch: Sinon.stub().resolves({
      created: options?.executionCreated ?? true,
      revision: {
        id: 'revision-2',
        artifactId: 'artifact-1',
        sequence: 2,
      },
      packageFingerprint: `sha256:${'3'.repeat(64)}`,
      stateFingerprint: `sha256:${'4'.repeat(64)}`,
    }),
  } as unknown as OfficeCommandService;
  const requests = {
    readRequest: Sinon.stub().resolves({
      request: {
        ...persisted.request,
        commandFingerprint: `sha256:${'5'.repeat(64)}`,
      },
      payload,
      ...(payload.kind === 'command' ? { command: payload.command } : {}),
    }),
  } as unknown as OfficeAgentCommandService;
  const registry = {
    register: Sinon.stub().callsFake(value => {
      adapter = value;
    }),
    completedAdapterResolution: Sinon.stub().returns({
      version: 'agent-runtime-worker-adapter-resolution/v1',
      status: 'completed',
    }),
  } as unknown as CopilotAgentRuntimeWorkflowRegistry;
  new CopilotAgentRuntimeOfficeCommandAdapter(
    models,
    commandService,
    requests,
    registry
  );
  if (!adapter)
    throw new Error('Office Agent Runtime adapter was not registered');
  return {
    adapter,
    completeStandaloneWorkerExecution,
    commandService,
    requests,
  };
}

function approvedRun() {
  return {
    id: 'run-1',
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    workflow: AGENT_RUNTIME_OFFICE_COMMAND_WORKFLOW,
    sourceType: 'office_command_request',
    sourceId: 'request-1',
    workerAttempt: 1,
    steps: [
      {
        id: 'approval-1',
        stepKey: 'approve_office_command',
        stepType: 'approval',
        status: 'completed',
        outputSummary: {},
      },
      {
        id: 'tool-1',
        stepKey: 'execute_office_command',
        stepType: 'tool',
        status: 'running',
        outputSummary: {
          officeCommandRequest: {
            version: 'agent-runtime-office-command-request/v1',
            requestId: 'request-1',
            commandFingerprint: `sha256:${'5'.repeat(64)}`,
          },
        },
      },
    ],
  };
}

test('executes an approved Office command and records immutable revision evidence', async t => {
  const fixture = adapterFixture();

  await fixture.adapter.execute({
    run: approvedRun() as never,
    workerLeaseId: 'lease-1',
    workerAttempt: 1,
    checkCancellationRequested: Sinon.stub().resolves(null),
  });

  t.true((fixture.commandService.preview as Sinon.SinonStub).calledOnce);
  t.true((fixture.commandService.execute as Sinon.SinonStub).calledOnce);
  t.true(fixture.completeStandaloneWorkerExecution.calledOnce);
  const completion =
    fixture.completeStandaloneWorkerExecution.firstCall.args[0];
  t.true(completion.sideEffectsApplied);
  t.is(
    completion.sideEffectSummary.version,
    'agent-runtime-office-command-side-effect/v1'
  );
  t.is(completion.sideEffectSummary.sideEffectKind, 'office_revision');
  t.is(completion.sideEffectSummary.sideEffectRecordId, 'revision-2');
  t.is(completion.sideEffectSummary.revisionId, 'revision-2');
  t.is(completion.sideEffectSummary.sequence, 2);
  t.is(completion.sideEffectSummary.operation, command.operation);
  t.is(completion.sideEffectSummary.commandCount, 1);
  t.false(completion.sideEffectSummary.idempotentReplay);
  t.regex(
    completion.sideEffectSummary.sideEffectFingerprint,
    /^sha256:[0-9a-f]{64}$/
  );
});

test('executes an approved atomic Office batch and records replay evidence', async t => {
  const fixture = adapterFixture({
    payload: { kind: 'batch', batch },
    executionCreated: false,
  });

  await fixture.adapter.execute({
    run: approvedRun() as never,
    workerLeaseId: 'lease-1',
    workerAttempt: 1,
    checkCancellationRequested: Sinon.stub().resolves(null),
  });

  t.false((fixture.commandService.preview as Sinon.SinonStub).called);
  t.false((fixture.commandService.execute as Sinon.SinonStub).called);
  t.true((fixture.commandService.previewBatch as Sinon.SinonStub).calledOnce);
  t.true((fixture.commandService.executeBatch as Sinon.SinonStub).calledOnce);
  const completion =
    fixture.completeStandaloneWorkerExecution.firstCall.args[0];
  t.true(completion.sideEffectsApplied);
  t.is(completion.sideEffectSummary.operation, 'office.command.batch');
  t.is(completion.sideEffectSummary.commandCount, batch.commands.length);
  t.is(completion.sideEffectSummary.sideEffectKind, 'office_revision');
  t.is(completion.sideEffectSummary.sideEffectRecordId, 'revision-2');
  t.true(completion.sideEffectSummary.idempotentReplay);
});

test('does not read or write Office state after cancellation is observed', async t => {
  const fixture = adapterFixture();

  await fixture.adapter.execute({
    run: approvedRun() as never,
    workerLeaseId: 'lease-1',
    workerAttempt: 1,
    checkCancellationRequested: Sinon.stub().resolves(approvedRun()),
  });

  t.false((fixture.requests.readRequest as Sinon.SinonStub).called);
  t.false((fixture.commandService.execute as Sinon.SinonStub).called);
  t.false(fixture.completeStandaloneWorkerExecution.called);
});

test('rejects permission revocation and preview evidence drift before side effects', async t => {
  const denied = adapterFixture({
    previewError: new Error('permission denied'),
  });
  await t.throwsAsync(
    denied.adapter.execute({
      run: approvedRun() as never,
      workerLeaseId: 'lease-1',
      workerAttempt: 1,
      checkCancellationRequested: Sinon.stub().resolves(null),
    }),
    { message: 'permission denied' }
  );
  t.false((denied.commandService.execute as Sinon.SinonStub).called);

  const drifted = adapterFixture({
    preview: {
      ...preview,
      packageFingerprint: `sha256:${'9'.repeat(64)}`,
    },
  });
  await t.throwsAsync(
    drifted.adapter.execute({
      run: approvedRun() as never,
      workerLeaseId: 'lease-1',
      workerAttempt: 1,
      checkCancellationRequested: Sinon.stub().resolves(null),
    }),
    { message: /preview evidence changed/ }
  );
  t.false((drifted.commandService.execute as Sinon.SinonStub).called);
});

test('rejects tampered persisted Office command bytes', async t => {
  const record = requestRecord();
  const models = {
    officeCommandRequest: {
      get: Sinon.stub().resolves({
        ...record.request,
        commandFingerprint: `sha256:${'0'.repeat(64)}`,
      }),
    },
  } as unknown as Models;
  const storage = {
    get: Sinon.stub().resolves({
      body: Readable.from(record.bytes),
      metadata: {
        contentType: 'application/vnd.localmind.office-command+json',
        contentLength: record.bytes.byteLength,
      },
    }),
  } as unknown as WorkspaceBlobStorage;
  const service = new OfficeAgentCommandService(
    models,
    storage,
    {} as OfficeCommandService,
    {} as OfficeArtifactService
  );

  await t.throwsAsync(service.readRequest('workspace-1', 'request-1'), {
    message: /fingerprint does not match/,
  });
});

test('returns bounded indexes and selector projections for large Office states', async t => {
  const largeText = 'LocalMind '.repeat(140_000);
  const state = {
    schemaVersion: 'localmind-office-docx-state/v1',
    modelVersion: 'localmind-office-docx-model/v1',
    body: [
      {
        type: 'paragraph',
        id: 'paragraph-1',
        text: largeText,
        runs: [],
        fields: [],
        bookmarks: [],
      },
      {
        type: 'paragraph',
        id: 'paragraph-2',
        text: 'Target paragraph',
        runs: [],
        fields: [],
        bookmarks: [],
      },
    ],
    sections: [],
    stories: [],
    styles: [],
    references: {},
    review: { trackRevisions: false, comments: [] },
    stats: { paragraphs: 2 },
  };
  const bytes = Buffer.from(JSON.stringify(state));
  const artifacts = {
    getRevision: Sinon.stub().resolves({
      id: 'revision-1',
      sequence: 1,
      stateFingerprint: `sha256:${'1'.repeat(64)}`,
    }),
    readRevisionAsset: Sinon.stub().resolves({ bytes }),
  } as unknown as OfficeArtifactService;
  const service = new OfficeAgentCommandService(
    {} as Models,
    {} as WorkspaceBlobStorage,
    {} as OfficeCommandService,
    artifacts
  );

  const index = await service.readStateForAi({
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    artifactId: 'artifact-1',
  });
  t.true(index.truncated);
  t.is((index.index as { kind: string }).kind, 'document');

  const selected = await service.readStateForAi({
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    artifactId: 'artifact-1',
    selector: {
      kind: 'document',
      block_ids: ['paragraph-2'],
    },
  });
  t.false(selected.truncated);
  t.deepEqual(
    (selected.state as { blocks: Array<{ id: string }> }).blocks.map(
      block => block.id
    ),
    ['paragraph-2']
  );

  await t.throwsAsync(
    service.readStateForAi({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      artifactId: 'artifact-1',
      selector: { kind: 'pdf', page_index: 0 },
    }),
    { message: /selector does not match PDF state/ }
  );
});

test('revalidates current Office context and rejects stale stable selections', async t => {
  const state = {
    schemaVersion: 'localmind-office-docx-state/v1',
    modelVersion: 'localmind-office-docx-model/v1',
    body: [
      {
        type: 'paragraph',
        id: 'paragraph-1',
        text: 'Plan',
        runs: [{ text: 'Plan' }],
      },
    ],
    sections: [{}],
    stories: [],
  };
  const artifacts = {
    get: Sinon.stub().resolves({
      artifact: {
        id: 'artifact-1',
        kind: 'document',
        title: 'Plan',
        sourceFileName: 'plan.docx',
      },
      revision: { id: 'revision-1', sequence: 1 },
    }),
    readRevisionAsset: Sinon.stub().resolves({
      bytes: Buffer.from(JSON.stringify(state), 'utf8'),
    }),
  } as unknown as OfficeArtifactService;
  const service = new OfficeAgentCommandService(
    {} as Models,
    {} as WorkspaceBlobStorage,
    {} as OfficeCommandService,
    artifacts
  );
  const context = {
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

  await t.notThrowsAsync(
    service.validateAiContext({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      context,
    })
  );
  await t.throwsAsync(
    service.validateAiContext({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      context: {
        ...context,
        selection: {
          ...context.selection,
          target: {
            ...context.selection.target,
            end: { blockId: 'paragraph-1', offset: 5 },
          },
        },
      },
    }),
    { message: /selection offset is stale/ }
  );
  await t.throwsAsync(
    service.validateAiContext({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      context: { ...context, revisionId: 'revision-stale' },
    }),
    { message: /revision conflict/ }
  );
  await t.throwsAsync(
    service.validateAiContext({
      workspaceId: 'workspace-other',
      actorId: 'user-1',
      context,
    }),
    { message: /workspace does not match/ }
  );
});

test('requires a matching office_read proof before single or batch writes', async t => {
  let proof: { artifactId: string; revisionId: string } | null = null;
  const request = Sinon.stub().resolves({
    run: { id: 'run-1', status: 'waiting_approval' },
    request: {
      id: 'request-1',
      artifactId: 'artifact-1',
      expectedRevisionId: 'revision-1',
      commandFingerprint: `sha256:${'1'.repeat(64)}`,
    },
    preview,
  });
  const requestBatch = Sinon.stub().resolves({
    run: { id: 'run-2', status: 'waiting_approval' },
    request: {
      id: 'request-2',
      artifactId: 'artifact-1',
      expectedRevisionId: 'revision-1',
      commandFingerprint: `sha256:${'2'.repeat(64)}`,
    },
    preview,
  });
  const service = {
    readStateForAi: Sinon.stub().callsFake(async input => ({
      artifactId: input.artifactId,
      revisionId: input.revisionId ?? 'revision-1',
      sequence: 1,
      stateFingerprint: `sha256:${'3'.repeat(64)}`,
      truncated: false,
      byteSize: 2,
      state: {},
    })),
    request,
    requestBatch,
  } as unknown as OfficeAgentCommandService;
  const officeContext = {
    version: 'localmind-office-ai-context/v1',
    workspaceId: 'workspace-1',
    artifactId: 'artifact-1',
    artifactKind: 'document',
    revisionId: 'revision-1',
  } as const;
  const options = {
    user: 'user-1',
    workspace: 'workspace-1',
    officeContext,
  } as never;
  const read = buildOfficeReadHandler(service, value => {
    proof = value;
  });
  const write = buildOfficeCommandRequestHandler(service, () => proof);
  const writeBatch = buildOfficeCommandBatchRequestHandler(
    service,
    () => proof
  );

  await t.throwsAsync(write(options, command), {
    message: /Call office_read successfully before requesting a write/,
  });
  await t.throwsAsync(read(options, 'artifact-other', 'revision-1'), {
    message: /current Office artifact/,
  });
  await read(options);
  Sinon.assert.calledOnceWithMatch(service.readStateForAi as Sinon.SinonStub, {
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    artifactId: 'artifact-1',
    revisionId: 'revision-1',
  });
  await t.notThrowsAsync(write(options, command));
  await t.notThrowsAsync(writeBatch(options, batch));
  t.true(request.calledOnce);
  t.true(requestBatch.calledOnce);

  await t.throwsAsync(
    write(options, {
      ...command,
      expectedRevisionId: 'revision-other',
    }),
    { message: /validated current revision/ }
  );
  await t.throwsAsync(
    writeBatch(options, {
      ...batch,
      artifactId: 'artifact-other',
      commands: batch.commands.map(item => ({
        ...item,
        artifactId: 'artifact-other',
      })),
    }),
    { message: /current Office artifact/ }
  );
});
