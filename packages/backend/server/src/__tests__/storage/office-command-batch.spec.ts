import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';

import { createMinimalXlsxFixture } from '@localmind/office/testing';
import { OfficeArtifactKind, OfficeRevisionOrigin } from '@prisma/client';
import test from 'ava';
import Sinon from 'sinon';

import { OFFICE_FORMATS, OfficeCommandService } from '../../core/office';
import type { PermissionAccess } from '../../core/permission';
import type { WorkspaceBlobStorage } from '../../core/storage';
import type { Models } from '../../models';

const bytes = createMinimalXlsxFixture();
const policy = OFFICE_FORMATS.xlsx;

function fingerprint(value: Uint8Array) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

const command = {
  version: 'localmind-office-command/v1',
  commandId: 'command-1',
  idempotencyKey: 'command-key-1',
  artifactId: 'artifact-1',
  expectedRevisionId: 'revision-1',
  source: 'ai',
  operation: 'office.workbook.cell.set',
  target: { type: 'cell', sheetId: '7', address: 'B2' },
  input: { type: 'number', value: 42 },
} as const;

const batch = {
  version: 'localmind-office-command-batch/v1',
  batchId: 'batch-1',
  idempotencyKey: 'batch-key-1',
  artifactId: command.artifactId,
  expectedRevisionId: command.expectedRevisionId,
  source: command.source,
  commands: [
    command,
    {
      ...command,
      commandId: 'command-2',
      idempotencyKey: 'command-key-2',
      target: { ...command.target, address: 'B3' },
      input: { type: 'formula', formula: 'SUM(B1:B2)' },
    },
  ],
} as const;

function fixture(options?: {
  currentRevisionId?: string;
  permissionError?: Error;
  appendRevision?: Sinon.SinonStub;
}) {
  const appendRevision =
    options?.appendRevision ??
    Sinon.stub().callsFake(async input => ({
      created: true,
      revision: {
        id: 'revision-2',
        artifactId: 'artifact-1',
        sequence: 2,
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
        kind: OfficeArtifactKind.workbook,
      }),
      getCurrentRevision: Sinon.stub().resolves({
        id: options?.currentRevisionId ?? 'revision-1',
        packageBlobKey: 'office/package/xlsx/source.xlsx',
        packageMimeType: policy.mimeType,
        packageByteSize: bytes.byteLength,
        packageFingerprint: fingerprint(bytes),
      }),
      appendRevision,
    },
  } as unknown as Models;
  const storage = {
    get: Sinon.stub().callsFake(async () => ({
      body: Readable.from(Buffer.from(bytes)),
      metadata: {
        contentType: policy.mimeType,
        contentLength: bytes.byteLength,
      },
    })),
    put: Sinon.stub().resolves(),
  } as unknown as WorkspaceBlobStorage;
  const assert = options?.permissionError
    ? Sinon.stub().rejects(options.permissionError)
    : Sinon.stub().resolves();
  const access = {
    user: Sinon.stub().returns({
      workspace: Sinon.stub().returns({ assert }),
    }),
  } as unknown as PermissionAccess;
  return {
    service: new OfficeCommandService(models, storage, access),
    models,
    storage,
    appendRevision,
    assert,
  };
}

test('previews an atomic batch without persistence and commits exactly one AI revision', async t => {
  const f = fixture();

  const preview = await f.service.previewBatch({
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    batch,
  });
  t.is(preview.summary.operation, 'office.command.batch');
  t.is(preview.summary.commandCount, batch.commands.length);
  t.false((f.storage.put as Sinon.SinonStub).called);
  t.false(f.appendRevision.called);

  const result = await f.service.executeBatch({
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    batch,
  });
  t.true(result.created);
  t.is(result.revision.id, 'revision-2');
  t.is((f.storage.put as Sinon.SinonStub).callCount, 2);
  t.true(f.appendRevision.calledOnce);
  const revisionInput = f.appendRevision.firstCall.args[0];
  t.is(revisionInput.origin, OfficeRevisionOrigin.ai);
  t.is(revisionInput.expectedParentRevisionId, 'revision-1');
  t.is(revisionInput.operationSummary.operation, 'office.command.batch');
  t.is(revisionInput.operationSummary.commandCount, batch.commands.length);
  t.is(revisionInput.operationSummary.source, 'ai');
});

test('source rejection prevents both Office blobs and revision creation on every attempt', async t => {
  const f = fixture();
  const check = f.models.copilotContext
    .withDocumentSourcesShared as Sinon.SinonStub;
  check.rejects(new Error('unshared_source'));
  for (let attempt = 0; attempt < 2; attempt++) {
    await t.throwsAsync(
      f.service.executeBatch({
        workspaceId: 'workspace-1',
        actorId: 'user-1',
        sourceSessionId: 'session-1',
        batch,
      }),
      { message: 'unshared_source' }
    );
  }
  t.is(check.callCount, 2);
  t.like(check.firstCall.args[0], {
    sessionId: 'session-1',
    sink: { type: 'tool_write', id: 'artifact-1', workspaceId: 'workspace-1' },
  });
  t.false((f.storage.put as Sinon.SinonStub).called);
  t.false(f.appendRevision.called);
});

test('does not persist partial package or state bytes when a middle batch command fails', async t => {
  const f = fixture();
  const invalidBatch = {
    ...batch,
    commands: [
      command,
      {
        ...batch.commands[1],
        target: { ...batch.commands[1].target, sheetId: 'missing-sheet' },
      },
    ],
  };

  await t.throwsAsync(
    f.service.executeBatch({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      batch: invalidBatch,
    }),
    { message: /sheet not found/i }
  );
  t.false((f.storage.put as Sinon.SinonStub).called);
  t.false(f.appendRevision.called);
});

test('reuses the same immutable revision for an identical batch idempotency replay', async t => {
  let firstFingerprint: string | undefined;
  const appendRevision = Sinon.stub().callsFake(async input => {
    if (!firstFingerprint) firstFingerprint = input.idempotencyFingerprint;
    t.is(input.idempotencyFingerprint, firstFingerprint);
    return {
      created: appendRevision.callCount === 1,
      revision: {
        id: 'revision-2',
        artifactId: 'artifact-1',
        sequence: 2,
      },
    };
  });
  const f = fixture({ appendRevision });

  const first = await f.service.executeBatch({
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    batch,
  });
  const replay = await f.service.executeBatch({
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    batch,
  });

  t.true(first.created);
  t.false(replay.created);
  t.is(first.revision.id, replay.revision.id);
  t.is(appendRevision.callCount, 2);
  t.is(
    appendRevision.firstCall.args[0].package.fingerprint,
    appendRevision.secondCall.args[0].package.fingerprint
  );
  t.is(
    appendRevision.firstCall.args[0].state.fingerprint,
    appendRevision.secondCall.args[0].state.fingerprint
  );
});

test('rejects an idempotency key reused for different batch evidence', async t => {
  let acceptedFingerprint: string | undefined;
  const appendRevision = Sinon.stub().callsFake(async input => {
    if (!acceptedFingerprint) {
      acceptedFingerprint = input.idempotencyFingerprint;
      return {
        created: true,
        revision: {
          id: 'revision-2',
          artifactId: 'artifact-1',
          sequence: 2,
        },
      };
    }
    if (input.idempotencyFingerprint !== acceptedFingerprint) {
      throw new Error('Office revision idempotency conflict');
    }
    throw new Error('expected different batch evidence');
  });
  const f = fixture({ appendRevision });
  await f.service.executeBatch({
    workspaceId: 'workspace-1',
    actorId: 'user-1',
    batch,
  });

  await t.throwsAsync(
    f.service.executeBatch({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      batch: {
        ...batch,
        commands: [
          { ...command, input: { type: 'number', value: 43 } },
          batch.commands[1],
        ],
      },
    }),
    { message: /idempotency conflict/ }
  );
  t.is(appendRevision.callCount, 2);
});

test('rejects stale revisions and permission loss before reading or writing bytes', async t => {
  const stale = fixture({ currentRevisionId: 'revision-newer' });
  await t.throwsAsync(
    stale.service.executeBatch({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      batch,
    }),
    { message: /revision conflict/ }
  );
  t.false((stale.storage.get as Sinon.SinonStub).called);
  t.false((stale.storage.put as Sinon.SinonStub).called);
  t.false(stale.appendRevision.called);

  const denied = fixture({ permissionError: new Error('permission denied') });
  await t.throwsAsync(
    denied.service.executeBatch({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      batch,
    }),
    { message: 'permission denied' }
  );
  t.false(
    (denied.models.officeArtifact.get as unknown as Sinon.SinonStub).called
  );
  t.false((denied.storage.get as Sinon.SinonStub).called);
  t.false((denied.storage.put as Sinon.SinonStub).called);
  t.false(denied.appendRevision.called);
});
