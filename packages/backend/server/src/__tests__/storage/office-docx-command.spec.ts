import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';

import {
  type DocxParagraph,
  openDocxPackage,
  readDocxSemanticState,
} from '@localmind/office/docx';
import { OfficeArtifactKind } from '@prisma/client';
import test from 'ava';
import Sinon from 'sinon';

import { OfficeDocxCommandService } from '../../core/office';
import type { PermissionAccess } from '../../core/permission';
import type { WorkspaceBlobStorage } from '../../core/storage';
import type { Models } from '../../models';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function fingerprint(bytes: Uint8Array) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function firstEditableParagraph(bytes: Uint8Array) {
  const state = readDocxSemanticState(openDocxPackage(bytes));
  const queue = [...state.body];
  while (queue.length) {
    const block = queue.shift();
    if (block?.type === 'paragraph' && block.text.length >= 4) return block;
    if (block?.type === 'contentControl') queue.unshift(...block.blocks);
    if (block?.type === 'table') {
      for (const row of block.rows) {
        for (const cell of row.cells) queue.unshift(...cell.blocks);
      }
    }
  }
  throw new Error('fixture has no editable paragraph');
}

test('executes a DOCX format command into immutable package/state evidence', async t => {
  const sourceBytes = await readFile(
    new URL('../../../../../common/native/fixtures/demo.docx', import.meta.url)
  );
  const paragraph = firstEditableParagraph(sourceBytes);
  const parentFingerprint = fingerprint(sourceBytes);
  const appendRevision = Sinon.stub().callsFake(async input => ({
    created: true,
    revision: {
      id: 'revision-2',
      packageBlobKey: input.package.key,
      stateBlobKey: input.state?.key,
    },
  }));
  const models = {
    copilotContext: {
      withDocumentSourcesShared: Sinon.stub().callsFake(
        async (_input, execute) => await execute()
      ),
    },
    officeArtifact: {
      get: Sinon.stub().resolves({
        id: 'artifact-1',
        kind: OfficeArtifactKind.document,
      }),
      getCurrentRevision: Sinon.stub().resolves({
        id: 'revision-1',
        packageBlobKey: 'office/package/docx/source.docx',
        packageMimeType: DOCX_MIME,
        packageByteSize: sourceBytes.byteLength,
        packageFingerprint: parentFingerprint,
      }),
      appendRevision,
    },
  } as unknown as Models;
  const puts: Array<{
    key: string;
    bytes: Buffer;
    contentType?: string;
  }> = [];
  const storage = {
    get: Sinon.stub().resolves({
      body: Readable.from(sourceBytes),
      metadata: {
        contentType: DOCX_MIME,
        contentLength: sourceBytes.byteLength,
        lastModified: new Date(),
      },
    }),
    put: Sinon.stub().callsFake(async (_workspaceId, key, bytes, metadata) => {
      puts.push({
        key,
        bytes: Buffer.from(bytes),
        contentType: metadata?.contentType,
      });
    }),
  } as unknown as WorkspaceBlobStorage;
  const assertPermission = Sinon.stub().resolves();
  const ac = {
    user: Sinon.stub().returns({
      workspace: Sinon.stub().returns({ assert: assertPermission }),
    }),
  } as unknown as PermissionAccess;
  const service = new OfficeDocxCommandService(models, storage, ac);

  const result = await service.execute({
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    command: {
      version: 'localmind-office-command/v1',
      commandId: 'command-1',
      idempotencyKey: 'command-1',
      artifactId: 'artifact-1',
      expectedRevisionId: 'revision-1',
      source: 'ai',
      operation: 'office.document.text.format',
      target: {
        type: 'text_range',
        start: { blockId: paragraph.id, offset: 0 },
        end: { blockId: paragraph.id, offset: 4 },
      },
      format: { fontSizePt: 14, textColor: '#0000FF', italic: true },
    },
  });

  t.is(assertPermission.callCount, 2);
  t.deepEqual(
    assertPermission
      .getCalls()
      .map(call => call.args[0])
      .sort((left, right) => String(left).localeCompare(String(right))),
    ['Workspace.Blobs.Write', 'Workspace.Copilot']
  );
  t.is(puts.length, 2);
  t.regex(puts[0].key, /^office\/package\/docx\/[0-9a-f]{64}\.docx$/);
  t.regex(puts[1].key, /^office\/state\/docx\/[0-9a-f]{64}\.json$/);
  t.is(puts[0].contentType, DOCX_MIME);
  const outputState = readDocxSemanticState(openDocxPackage(puts[0].bytes));
  const outputParagraph = outputState.body.find(
    block => block.type === 'paragraph' && block.id === paragraph.id
  ) as DocxParagraph | undefined;
  t.is(outputParagraph?.text, paragraph.text);
  t.true(outputParagraph?.runs.some(run => run.format?.italic) ?? false);
  const modelInput = appendRevision.firstCall.args[0];
  t.is(modelInput.expectedParentRevisionId, 'revision-1');
  t.is(modelInput.package.fingerprint, fingerprint(puts[0].bytes));
  t.is(modelInput.state.fingerprint, fingerprint(puts[1].bytes));
  t.regex(modelInput.idempotencyFingerprint, /^sha256:[0-9a-f]{64}$/);
  t.is(result.revision.id, 'revision-2');
});

test('persists DOCX text replacement without storing replacement text in revision summary', async t => {
  const sourceBytes = await readFile(
    new URL('../../../../../common/native/fixtures/demo.docx', import.meta.url)
  );
  const paragraph = firstEditableParagraph(sourceBytes);
  const appendRevision = Sinon.stub().callsFake(async input => ({
    created: true,
    revision: { id: 'revision-2', artifactId: 'artifact-1' },
    input,
  }));
  const models = {
    copilotContext: {
      withDocumentSourcesShared: Sinon.stub().callsFake(
        async (_input, execute) => await execute()
      ),
    },
    officeArtifact: {
      get: Sinon.stub().resolves({
        id: 'artifact-1',
        kind: OfficeArtifactKind.document,
      }),
      getCurrentRevision: Sinon.stub().resolves({
        id: 'revision-1',
        packageBlobKey: 'office/package/docx/source.docx',
        packageMimeType: DOCX_MIME,
        packageByteSize: sourceBytes.byteLength,
        packageFingerprint: fingerprint(sourceBytes),
      }),
      appendRevision,
    },
  } as unknown as Models;
  const storage = {
    get: Sinon.stub().resolves({
      body: Readable.from(sourceBytes),
      metadata: {
        contentType: DOCX_MIME,
        contentLength: sourceBytes.byteLength,
        lastModified: new Date(),
      },
    }),
    put: Sinon.stub().resolves(),
  } as unknown as WorkspaceBlobStorage;
  const ac = {
    user: Sinon.stub().returns({
      workspace: Sinon.stub().returns({ assert: Sinon.stub().resolves() }),
    }),
  } as unknown as PermissionAccess;
  const service = new OfficeDocxCommandService(models, storage, ac);

  await service.execute({
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    command: {
      version: 'localmind-office-command/v1',
      commandId: 'replace-command',
      idempotencyKey: 'replace-command',
      artifactId: 'artifact-1',
      expectedRevisionId: 'revision-1',
      source: 'user',
      operation: 'office.document.text.replace',
      target: {
        type: 'text_range',
        start: { blockId: paragraph.id, offset: 0 },
        end: { blockId: paragraph.id, offset: 4 },
      },
      text: 'Private replacement',
    },
  });

  const operationSummary = appendRevision.firstCall.args[0].operationSummary;
  t.is(operationSummary.operation, 'office.document.text.replace');
  t.is(operationSummary.replacementTextLength, 19);
  t.false('text' in operationSummary);
});

test('rejects altered parent bytes before writing command evidence', async t => {
  const sourceBytes = await readFile(
    new URL('../../../../../common/native/fixtures/demo.docx', import.meta.url)
  );
  const paragraph = firstEditableParagraph(sourceBytes);
  const appendRevision = Sinon.stub();
  const models = {
    copilotContext: {
      withDocumentSourcesShared: Sinon.stub().callsFake(
        async (_input, execute) => await execute()
      ),
    },
    officeArtifact: {
      get: Sinon.stub().resolves({
        id: 'artifact-1',
        kind: OfficeArtifactKind.document,
      }),
      getCurrentRevision: Sinon.stub().resolves({
        id: 'revision-1',
        packageBlobKey: 'office/package/docx/source.docx',
        packageMimeType: DOCX_MIME,
        packageByteSize: sourceBytes.byteLength,
        packageFingerprint: `sha256:${'0'.repeat(64)}`,
      }),
      appendRevision,
    },
  } as unknown as Models;
  const put = Sinon.stub();
  const storage = {
    get: Sinon.stub().resolves({
      body: Readable.from(sourceBytes),
      metadata: {
        contentType: DOCX_MIME,
        contentLength: sourceBytes.byteLength,
        lastModified: new Date(),
      },
    }),
    put,
  } as unknown as WorkspaceBlobStorage;
  const ac = {
    user: Sinon.stub().returns({
      workspace: Sinon.stub().returns({ assert: Sinon.stub().resolves() }),
    }),
  } as unknown as PermissionAccess;
  const service = new OfficeDocxCommandService(models, storage, ac);

  await t.throwsAsync(
    service.execute({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      command: {
        version: 'localmind-office-command/v1',
        commandId: 'command-tampered',
        idempotencyKey: 'command-tampered',
        artifactId: 'artifact-1',
        expectedRevisionId: 'revision-1',
        source: 'user',
        operation: 'office.document.text.format',
        target: {
          type: 'text_range',
          start: { blockId: paragraph.id, offset: 0 },
          end: { blockId: paragraph.id, offset: 4 },
        },
        format: { bold: true },
      },
    }),
    { message: /fingerprint does not match/ }
  );
  t.false(put.called);
  t.false(appendRevision.called);
});

test('previews a DOCX command without writing blobs or revisions', async t => {
  const sourceBytes = await readFile(
    new URL('../../../../../common/native/fixtures/demo.docx', import.meta.url)
  );
  const paragraph = firstEditableParagraph(sourceBytes);
  const appendRevision = Sinon.stub();
  const put = Sinon.stub();
  const models = {
    copilotContext: {
      withDocumentSourcesShared: Sinon.stub().callsFake(
        async (_input, execute) => await execute()
      ),
    },
    officeArtifact: {
      get: Sinon.stub().resolves({
        id: 'artifact-1',
        kind: OfficeArtifactKind.document,
      }),
      getCurrentRevision: Sinon.stub().resolves({
        id: 'revision-1',
        packageBlobKey: 'office/package/docx/source.docx',
        packageMimeType: DOCX_MIME,
        packageByteSize: sourceBytes.byteLength,
        packageFingerprint: fingerprint(sourceBytes),
      }),
      appendRevision,
    },
  } as unknown as Models;
  const storage = {
    get: Sinon.stub().resolves({
      body: Readable.from(sourceBytes),
      metadata: {
        contentType: DOCX_MIME,
        contentLength: sourceBytes.byteLength,
        lastModified: new Date(),
      },
    }),
    put,
  } as unknown as WorkspaceBlobStorage;
  const ac = {
    user: Sinon.stub().returns({
      workspace: Sinon.stub().returns({ assert: Sinon.stub().resolves() }),
    }),
  } as unknown as PermissionAccess;
  const service = new OfficeDocxCommandService(models, storage, ac);

  const result = await service.preview({
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    command: {
      version: 'localmind-office-command/v1',
      commandId: 'command-preview',
      idempotencyKey: 'command-preview',
      artifactId: 'artifact-1',
      expectedRevisionId: 'revision-1',
      source: 'user',
      operation: 'office.document.text.format',
      target: {
        type: 'text_range',
        start: { blockId: paragraph.id, offset: 0 },
        end: { blockId: paragraph.id, offset: 4 },
      },
      format: { underline: { style: 'wavy', color: '#FF0000' } },
    },
  });

  t.is(result.artifact.id, 'artifact-1');
  t.is(result.revision.id, 'revision-1');
  t.regex(result.packageFingerprint, /^sha256:[0-9a-f]{64}$/);
  t.regex(result.stateFingerprint, /^sha256:[0-9a-f]{64}$/);
  t.true(
    typeof result.summary.changedRuns === 'number' &&
      result.summary.changedRuns > 0
  );
  t.false(put.called);
  t.false(appendRevision.called);
});

test('rejects a stale DOCX command before reading or writing bytes', async t => {
  const get = Sinon.stub();
  const put = Sinon.stub();
  const appendRevision = Sinon.stub();
  const models = {
    copilotContext: {
      withDocumentSourcesShared: Sinon.stub().callsFake(
        async (_input, execute) => await execute()
      ),
    },
    officeArtifact: {
      get: Sinon.stub().resolves({
        id: 'artifact-1',
        kind: OfficeArtifactKind.document,
      }),
      getCurrentRevision: Sinon.stub().resolves({ id: 'revision-current' }),
      appendRevision,
    },
  } as unknown as Models;
  const storage = { get, put } as unknown as WorkspaceBlobStorage;
  const ac = {
    user: Sinon.stub().returns({
      workspace: Sinon.stub().returns({ assert: Sinon.stub().resolves() }),
    }),
  } as unknown as PermissionAccess;
  const service = new OfficeDocxCommandService(models, storage, ac);

  await t.throwsAsync(
    service.execute({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      command: {
        version: 'localmind-office-command/v1',
        commandId: 'command-stale',
        idempotencyKey: 'command-stale',
        artifactId: 'artifact-1',
        expectedRevisionId: 'revision-stale',
        source: 'user',
        operation: 'office.document.text.format',
        target: {
          type: 'text_range',
          start: { blockId: 'paragraph:1', offset: 0 },
          end: { blockId: 'paragraph:1', offset: 1 },
        },
        format: { bold: true },
      },
    }),
    { message: /revision conflict/ }
  );
  t.false(get.called);
  t.false(put.called);
  t.false(appendRevision.called);
});
