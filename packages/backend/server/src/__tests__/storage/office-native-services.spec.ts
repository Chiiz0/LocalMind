import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';

import {
  createMinimalPdfFixture,
  createMinimalPptxFixture,
  createMinimalXlsxFixture,
} from '@localmind/office/testing';
import { OfficeArtifactKind } from '@prisma/client';
import test from 'ava';
import Sinon from 'sinon';

import {
  OFFICE_FORMATS,
  OfficeCommandService,
  OfficeImportService,
} from '../../core/office';
import type { PermissionAccess } from '../../core/permission';
import type { WorkspaceBlobStorage } from '../../core/storage';
import type { Models } from '../../models';
import { workspaceOfficeStorage } from './office-storage.fixture';

function fingerprint(bytes: Uint8Array) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function permissions(result: 'allow' | 'deny' = 'allow') {
  const assert =
    result === 'allow'
      ? Sinon.stub().resolves()
      : Sinon.stub().rejects(new Error('permission denied'));
  return {
    assert,
    access: {
      user: Sinon.stub().returns({
        workspace: Sinon.stub().returns({ assert }),
      }),
    } as unknown as PermissionAccess,
  };
}

async function nativeCases() {
  return [
    {
      format: 'xlsx' as const,
      bytes: createMinimalXlsxFixture(),
      kind: OfficeArtifactKind.workbook,
      fileName: 'budget.xlsx',
      command: {
        version: 'localmind-office-command/v1',
        commandId: 'xlsx-cell',
        idempotencyKey: 'xlsx-cell',
        artifactId: 'artifact-xlsx',
        expectedRevisionId: 'revision-xlsx',
        source: 'user',
        operation: 'office.workbook.cell.set',
        target: { type: 'cell', sheetId: '7', address: 'D2' },
        input: { type: 'string', value: 'PRIVATE_CELL_VALUE' },
      },
      secret: 'PRIVATE_CELL_VALUE',
    },
    {
      format: 'pptx' as const,
      bytes: createMinimalPptxFixture(),
      kind: OfficeArtifactKind.presentation,
      fileName: 'briefing.pptx',
      command: {
        version: 'localmind-office-command/v1',
        commandId: 'pptx-text',
        idempotencyKey: 'pptx-text',
        artifactId: 'artifact-pptx',
        expectedRevisionId: 'revision-pptx',
        source: 'user',
        operation: 'office.presentation.shape.text.set',
        target: { type: 'shape', slideId: 'slide-rel', shapeId: '2' },
        text: 'PRIVATE_SLIDE_TEXT',
      },
      secret: 'PRIVATE_SLIDE_TEXT',
    },
    {
      format: 'pdf' as const,
      bytes: await createMinimalPdfFixture(),
      kind: OfficeArtifactKind.pdf,
      fileName: 'review.pdf',
      command: {
        version: 'localmind-office-command/v1',
        commandId: 'pdf-annotation',
        idempotencyKey: 'pdf-annotation',
        artifactId: 'artifact-pdf',
        expectedRevisionId: 'revision-pdf',
        source: 'user',
        operation: 'office.pdf.annotation.add',
        target: { type: 'page', pageIndex: 0 },
        annotation: {
          subtype: 'highlight',
          rect: { xPt: 70, yPt: 710, widthPt: 120, heightPt: 18 },
          contents: 'PRIVATE_PDF_COMMENT',
          color: '#FFFF00',
        },
      },
      secret: 'PRIVATE_PDF_COMMENT',
    },
  ];
}

test('imports XLSX, PPTX, and PDF through the native format registry', async t => {
  for (const item of await nativeCases()) {
    const policy = OFFICE_FORMATS[item.format];
    const createOrReuseImported = Sinon.stub().callsFake(async input => ({
      created: true,
      artifact: { id: `artifact-${item.format}`, kind: item.kind },
      revision: {
        id: `revision-${item.format}`,
        stateBlobKey: input.state?.key,
        stateFingerprint: input.state?.fingerprint,
      },
    }));
    const models = {
      blob: {
        get: Sinon.stub().resolves({
          key: `imports/${item.fileName}`,
          size: item.bytes.byteLength,
          mime: policy.mimeType,
          status: 'completed',
          deletedAt: null,
        }),
      },
      officeArtifact: { createOrReuseImported },
    } as unknown as Models;
    const put = Sinon.stub().resolves();
    const storage = {
      get: Sinon.stub().resolves({
        body: Readable.from(Buffer.from(item.bytes)),
        metadata: {
          contentType: policy.mimeType,
          contentLength: item.bytes.byteLength,
          lastModified: new Date(),
        },
      }),
      put,
    } as unknown as WorkspaceBlobStorage;
    const { access } = permissions();
    const service = new OfficeImportService(
      models,
      workspaceOfficeStorage(storage),
      access
    );

    const result = await service.import({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      sourceBlobKey: `imports/${item.fileName}`,
      title: item.fileName,
      sourceFileName: item.fileName,
      importIdempotencyKey: `import-${item.format}`,
    });

    t.is(result.format, item.format);
    t.regex(result.sourceFingerprint, /^sha256:[0-9a-f]{64}$/);
    t.is(put.callCount, 2);
    t.is(createOrReuseImported.firstCall.args[0].kind, item.kind);
    t.is(
      createOrReuseImported.firstCall.args[0].source.mimeType,
      policy.mimeType
    );
    t.true(Object.values(result.stats).some(value => value > 0));
  }
});

test('rejects MIME mismatch and denied import permissions before persistence', async t => {
  const bytes = createMinimalXlsxFixture();
  const createOrReuseImported = Sinon.stub();
  const models = {
    blob: {
      get: Sinon.stub().resolves({
        key: 'imports/budget.xlsx',
        size: bytes.byteLength,
        mime: 'application/octet-stream',
        status: 'completed',
        deletedAt: null,
      }),
    },
    officeArtifact: { createOrReuseImported },
  } as unknown as Models;
  const storage = {
    get: Sinon.stub(),
    put: Sinon.stub(),
  } as unknown as WorkspaceBlobStorage;
  const allowed = permissions();

  await t.throwsAsync(
    new OfficeImportService(
      models,
      workspaceOfficeStorage(storage),
      allowed.access
    ).import({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      sourceBlobKey: 'imports/budget.xlsx',
      title: 'Budget',
      sourceFileName: 'budget.xlsx',
      importIdempotencyKey: 'bad-mime',
    }),
    { message: /invalid MIME type/ }
  );
  t.false((storage.get as Sinon.SinonStub).called);
  t.false(createOrReuseImported.called);

  const denied = permissions('deny');
  const deniedModels = {
    blob: { get: Sinon.stub() },
  } as unknown as Models;
  await t.throwsAsync(
    new OfficeImportService(
      deniedModels,
      workspaceOfficeStorage(storage),
      denied.access
    ).import({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      sourceBlobKey: 'imports/budget.xlsx',
      title: 'Budget',
      sourceFileName: 'budget.xlsx',
      importIdempotencyKey: 'denied',
    }),
    { message: 'permission denied' }
  );
  t.false((deniedModels.blob.get as Sinon.SinonStub).called);
});

test('previews and executes XLSX, PPTX, and PDF commands with immutable evidence', async t => {
  for (const item of await nativeCases()) {
    const policy = OFFICE_FORMATS[item.format];
    const appendRevision = Sinon.stub().callsFake(async input => ({
      created: true,
      revision: {
        id: `revision-${item.format}-2`,
        artifactId: `artifact-${item.format}`,
        packageBlobKey: input.package.key,
        stateBlobKey: input.state?.key,
      },
    }));
    const models = {
      officeArtifact: {
        get: Sinon.stub().resolves({
          id: `artifact-${item.format}`,
          kind: item.kind,
        }),
        getCurrentRevision: Sinon.stub().resolves({
          id: `revision-${item.format}`,
          packageBlobKey: `office/package/${item.format}/source${policy.extension}`,
          packageMimeType: policy.mimeType,
          packageByteSize: item.bytes.byteLength,
          packageFingerprint: fingerprint(item.bytes),
        }),
        appendRevision,
      },
    } as unknown as Models;
    const put = Sinon.stub().resolves();
    const storage = {
      get: Sinon.stub().callsFake(async () => ({
        body: Readable.from(Buffer.from(item.bytes)),
        metadata: {
          contentType: policy.mimeType,
          contentLength: item.bytes.byteLength,
          lastModified: new Date(),
        },
      })),
      put,
    } as unknown as WorkspaceBlobStorage;
    const { access } = permissions();
    const service = new OfficeCommandService(
      models,
      workspaceOfficeStorage(storage),
      access
    );

    const preview = await service.preview({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      command: item.command,
    });
    t.regex(preview.packageFingerprint, /^sha256:[0-9a-f]{64}$/);
    t.false(put.called);
    t.false(appendRevision.called);

    const result = await service.execute({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      command: item.command,
    });
    t.is(put.callCount, 2);
    t.true(appendRevision.calledOnce);
    const revisionInput = appendRevision.firstCall.args[0];
    t.is(revisionInput.expectedParentRevisionId, `revision-${item.format}`);
    t.is(revisionInput.package.mimeType, policy.mimeType);
    t.regex(revisionInput.package.fingerprint, /^sha256:[0-9a-f]{64}$/);
    t.regex(revisionInput.state.fingerprint, /^sha256:[0-9a-f]{64}$/);
    t.false(
      JSON.stringify(revisionInput.operationSummary).includes(item.secret)
    );
    t.is(result.revision.id, `revision-${item.format}-2`);
  }
});

test('rejects stale revisions, altered bytes, and missing AI permission before writes', async t => {
  const [item] = await nativeCases();
  const policy = OFFICE_FORMATS[item.format];
  const appendRevision = Sinon.stub();
  const put = Sinon.stub();
  const baseArtifact = {
    get: Sinon.stub().resolves({ id: 'artifact-xlsx', kind: item.kind }),
    appendRevision,
  };
  const storage = {
    get: Sinon.stub().resolves({
      body: Readable.from(Buffer.from(item.bytes)),
      metadata: {
        contentType: policy.mimeType,
        contentLength: item.bytes.byteLength,
      },
    }),
    put,
  } as unknown as WorkspaceBlobStorage;
  const allowed = permissions();

  const staleModels = {
    officeArtifact: {
      ...baseArtifact,
      getCurrentRevision: Sinon.stub().resolves({ id: 'newer-revision' }),
    },
  } as unknown as Models;
  await t.throwsAsync(
    new OfficeCommandService(
      staleModels,
      workspaceOfficeStorage(storage),
      allowed.access
    ).execute({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      command: item.command,
    }),
    { message: /revision conflict/ }
  );
  t.false((storage.get as Sinon.SinonStub).called);

  const alteredModels = {
    officeArtifact: {
      ...baseArtifact,
      getCurrentRevision: Sinon.stub().resolves({
        id: 'revision-xlsx',
        packageBlobKey: 'source.xlsx',
        packageMimeType: policy.mimeType,
        packageByteSize: item.bytes.byteLength,
        packageFingerprint: `sha256:${'0'.repeat(64)}`,
      }),
    },
  } as unknown as Models;
  await t.throwsAsync(
    new OfficeCommandService(
      alteredModels,
      workspaceOfficeStorage(storage),
      allowed.access
    ).execute({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      command: item.command,
    }),
    { message: /fingerprint does not match/ }
  );
  t.false(put.called);
  t.false(appendRevision.called);

  const denied = permissions('deny');
  const aiCommand = { ...item.command, source: 'ai' };
  const deniedModels = {
    officeArtifact: { get: Sinon.stub() },
  } as unknown as Models;
  await t.throwsAsync(
    new OfficeCommandService(
      deniedModels,
      workspaceOfficeStorage(storage),
      denied.access
    ).execute({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      command: aiCommand,
    }),
    { message: 'permission denied' }
  );
  t.false((deniedModels.officeArtifact.get as Sinon.SinonStub).called);
});
