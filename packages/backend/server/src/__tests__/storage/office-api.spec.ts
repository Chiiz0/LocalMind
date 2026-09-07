import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';

import { OfficeArtifactKind, OfficeRevisionOrigin } from '@prisma/client';
import test from 'ava';
import Sinon from 'sinon';

import type { URLHelper } from '../../base';
import { OfficeArtifactService, OfficeResolver } from '../../core/office';
import type { PermissionAccess } from '../../core/permission';
import type { WorkspaceBlobStorage } from '../../core/storage';
import type { Models } from '../../models';
import { workspaceOfficeStorage } from './office-storage.fixture';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function fingerprint(bytes: Uint8Array) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

test('OfficeArtifactService checks read permission before listing artifacts', async t => {
  const denied = new Error('permission denied');
  const list = Sinon.stub();
  const models = { officeArtifact: { list } } as unknown as Models;
  const ac = {
    user: Sinon.stub().returns({
      workspace: Sinon.stub().returns({
        assert: Sinon.stub().rejects(denied),
      }),
    }),
  } as unknown as PermissionAccess;
  const service = new OfficeArtifactService(
    models,
    workspaceOfficeStorage({} as WorkspaceBlobStorage),
    ac
  );

  await t.throwsAsync(service.list('workspace-1', 'user-1'), { is: denied });
  t.false(list.called);
});

test('OfficeArtifactService verifies immutable state evidence on retrieval', async t => {
  const bytes = Buffer.from('{"schemaVersion":"test"}', 'utf8');
  const revision = {
    id: 'revision-1',
    workspaceId: 'workspace-1',
    artifactId: 'artifact-1',
    stateBlobKey: 'office/state/docx/state.json',
    stateByteSize: bytes.byteLength,
    stateFingerprint: fingerprint(bytes),
  };
  const models = {
    officeArtifact: {
      get: Sinon.stub().resolves({
        id: 'artifact-1',
        workspaceId: 'workspace-1',
      }),
      getRevision: Sinon.stub().resolves(revision),
    },
  } as unknown as Models;
  const storage = {
    get: Sinon.stub().resolves({
      body: Readable.from(bytes),
      metadata: {
        contentType: 'application/vnd.localmind.office.docx-state+json',
        contentLength: bytes.byteLength,
        lastModified: new Date(),
      },
    }),
  } as unknown as WorkspaceBlobStorage;
  const ac = {
    user: Sinon.stub().returns({
      workspace: Sinon.stub().returns({ assert: Sinon.stub().resolves() }),
    }),
  } as unknown as PermissionAccess;
  const service = new OfficeArtifactService(
    models,
    workspaceOfficeStorage(storage),
    ac
  );

  const asset = await service.readRevisionAsset(
    'workspace-1',
    'user-1',
    'artifact-1',
    'revision-1',
    'state'
  );

  t.deepEqual(asset.bytes, bytes);
  t.is(asset.revision.id, 'revision-1');
});

test('OfficeArtifactService compares verified immutable semantic revisions', async t => {
  const states = new Map([
    [
      'revision-1',
      Buffer.from(
        JSON.stringify({
          schemaVersion: 'localmind-office-docx-state/v1',
          body: [
            {
              type: 'paragraph',
              id: 'paragraph-1',
              text: 'Before',
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
        })
      ),
    ],
    [
      'revision-2',
      Buffer.from(
        JSON.stringify({
          schemaVersion: 'localmind-office-docx-state/v1',
          body: [
            {
              type: 'paragraph',
              id: 'paragraph-1',
              text: 'After',
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
        })
      ),
    ],
  ]);
  const artifact = {
    id: 'artifact-1',
    workspaceId: 'workspace-1',
    kind: OfficeArtifactKind.document,
  };
  const revisions = new Map(
    [...states].map(([id, bytes], index) => [
      id,
      {
        id,
        workspaceId: 'workspace-1',
        artifactId: 'artifact-1',
        sequence: index + 1,
        stateBlobKey: `office/state/${id}.json`,
        stateByteSize: bytes.byteLength,
        stateFingerprint: fingerprint(bytes),
      },
    ])
  );
  const models = {
    officeArtifact: {
      get: Sinon.stub().resolves(artifact),
      getRevision: Sinon.stub().callsFake(
        async (_workspaceId: string, _artifactId: string, revisionId: string) =>
          revisions.get(revisionId)
      ),
    },
  } as unknown as Models;
  const storage = {
    get: Sinon.stub().callsFake(async (_workspaceId: string, key: string) => {
      const revisionId = key.slice(key.lastIndexOf('/') + 1, -'.json'.length);
      const bytes = states.get(revisionId)!;
      return {
        body: Readable.from(bytes),
        metadata: { contentLength: bytes.byteLength },
      };
    }),
  } as unknown as WorkspaceBlobStorage;
  const ac = {
    user: Sinon.stub().returns({
      workspace: Sinon.stub().returns({ assert: Sinon.stub().resolves() }),
    }),
  } as unknown as PermissionAccess;
  const service = new OfficeArtifactService(
    models,
    workspaceOfficeStorage(storage),
    ac
  );

  const result = await service.compareRevisions(
    'workspace-1',
    'user-1',
    'artifact-1',
    'revision-1',
    'revision-2'
  );

  t.true(result.diff.changed);
  t.is(result.diff.summary.modified, 1);
  t.like(result.diff.changes[0], {
    entity: 'paragraph',
    id: 'paragraph-1',
    before: 'Before',
    after: 'After',
  });
  t.is((storage.get as Sinon.SinonStub).callCount, 2);
});

test('OfficeArtifactService rejects unauthorized or invalid revision comparisons', async t => {
  const validState = Buffer.from(
    JSON.stringify({
      schemaVersion: 'localmind-office-docx-state/v1',
      body: [],
      sections: [],
      stories: [],
      styles: [],
      references: {},
      review: { trackRevisions: false, comments: [] },
    })
  );
  const invalidJson = Buffer.from('{invalid');
  const wrongKind = Buffer.from(
    JSON.stringify({ schemaVersion: 'localmind-office-pdf-state/v1' })
  );
  const makeService = (before: Buffer, after: Buffer, ac: PermissionAccess) => {
    const bytesById = new Map([
      ['revision-1', before],
      ['revision-2', after],
    ]);
    const models = {
      officeArtifact: {
        get: Sinon.stub().resolves({
          id: 'artifact-1',
          workspaceId: 'workspace-1',
          kind: OfficeArtifactKind.document,
        }),
        getRevision: Sinon.stub().callsFake(
          async (
            _workspaceId: string,
            _artifactId: string,
            revisionId: string
          ) => {
            const bytes = bytesById.get(revisionId)!;
            return {
              id: revisionId,
              workspaceId: 'workspace-1',
              artifactId: 'artifact-1',
              stateBlobKey: `office/state/${revisionId}.json`,
              stateByteSize: bytes.byteLength,
              stateFingerprint: fingerprint(bytes),
            };
          }
        ),
      },
    } as unknown as Models;
    const storage = {
      get: Sinon.stub().callsFake(async (_workspaceId: string, key: string) => {
        const revisionId = key.slice(key.lastIndexOf('/') + 1, -'.json'.length);
        const bytes = bytesById.get(revisionId)!;
        return {
          body: Readable.from(bytes),
          metadata: { contentLength: bytes.byteLength },
        };
      }),
    } as unknown as WorkspaceBlobStorage;
    return {
      service: new OfficeArtifactService(
        models,
        workspaceOfficeStorage(storage),
        ac
      ),
      storage,
    };
  };

  const denied = new Error('permission denied');
  const deniedAccess = {
    user: Sinon.stub().returns({
      workspace: Sinon.stub().returns({
        assert: Sinon.stub().rejects(denied),
      }),
    }),
  } as unknown as PermissionAccess;
  const deniedCase = makeService(validState, validState, deniedAccess);
  await t.throwsAsync(
    deniedCase.service.compareRevisions(
      'workspace-1',
      'user-1',
      'artifact-1',
      'revision-1',
      'revision-2'
    ),
    { is: denied }
  );
  t.false((deniedCase.storage.get as Sinon.SinonStub).called);

  const allowedAccess = {
    user: Sinon.stub().returns({
      workspace: Sinon.stub().returns({ assert: Sinon.stub().resolves() }),
    }),
  } as unknown as PermissionAccess;
  await t.throwsAsync(
    makeService(
      validState,
      invalidJson,
      allowedAccess
    ).service.compareRevisions(
      'workspace-1',
      'user-1',
      'artifact-1',
      'revision-1',
      'revision-2'
    ),
    { message: /semantic state is not valid JSON: revision-2/ }
  );
  await t.throwsAsync(
    makeService(validState, wrongKind, allowedAccess).service.compareRevisions(
      'workspace-1',
      'user-1',
      'artifact-1',
      'revision-1',
      'revision-2'
    ),
    { message: /Office document semantic state is invalid/ }
  );
});

test('OfficeArtifactService serves bounded OOXML parts after package evidence verification', async t => {
  const bytes = await readFile(
    new URL('../../../../../common/native/fixtures/demo.docx', import.meta.url)
  );
  const revision = {
    id: 'revision-1',
    workspaceId: 'workspace-1',
    artifactId: 'artifact-1',
    packageBlobKey: 'office/package/docx/source.docx',
    packageMimeType: DOCX_MIME,
    packageByteSize: bytes.byteLength,
    packageFingerprint: fingerprint(bytes),
    createdAt: new Date(),
  };
  const models = {
    officeArtifact: {
      get: Sinon.stub().resolves({
        id: 'artifact-1',
        workspaceId: 'workspace-1',
        kind: OfficeArtifactKind.document,
      }),
      getRevision: Sinon.stub().resolves(revision),
    },
  } as unknown as Models;
  const storage = {
    get: Sinon.stub().callsFake(async () => ({
      body: Readable.from(bytes),
      metadata: {
        contentType: DOCX_MIME,
        contentLength: bytes.byteLength,
        lastModified: new Date(),
      },
    })),
  } as unknown as WorkspaceBlobStorage;
  const ac = {
    user: Sinon.stub().returns({
      workspace: Sinon.stub().returns({ assert: Sinon.stub().resolves() }),
    }),
  } as unknown as PermissionAccess;
  const service = new OfficeArtifactService(
    models,
    workspaceOfficeStorage(storage),
    ac
  );

  const part = await service.readRevisionPackagePart(
    'workspace-1',
    'user-1',
    'artifact-1',
    'revision-1',
    'word/media/image1.gif'
  );

  t.true(part.bytes.subarray(0, 6).equals(Buffer.from('GIF89a')));
  t.is(part.mimeType, 'image/gif');
  const pdf = await service.exportDocumentRevisionPdf(
    'workspace-1',
    'user-1',
    'artifact-1',
    'revision-1'
  );
  t.is(pdf.mimeType, 'application/pdf');
  t.true(pdf.bytes.subarray(0, 5).equals(Buffer.from('%PDF-')));
  t.regex(pdf.fingerprint, /^sha256:[0-9a-f]{64}$/);
  await t.throwsAsync(
    service.readRevisionPackagePart(
      'workspace-1',
      'user-1',
      'artifact-1',
      'revision-1',
      '../outside.bin'
    ),
    { message: /Invalid OPC part name/ }
  );
});

test('OfficeResolver rejects user attempts to forge AI command origin', async t => {
  const commandService = {
    preview: Sinon.stub(),
    execute: Sinon.stub(),
  };
  const resolver = new OfficeResolver(
    {} as OfficeArtifactService,
    {} as never,
    commandService as never,
    { link: (path: string) => `https://localmind.test${path}` } as URLHelper
  );
  const command = {
    version: 'localmind-office-command/v1',
    commandId: 'command-1',
    idempotencyKey: 'command-1',
    artifactId: 'artifact-1',
    expectedRevisionId: 'revision-1',
    source: 'ai',
    operation: 'office.document.text.format',
    target: {
      type: 'text_range',
      start: { blockId: 'paragraph:1', offset: 0 },
      end: { blockId: 'paragraph:1', offset: 1 },
    },
    format: { italic: true },
  };

  await t.throwsAsync(
    resolver.previewOfficeDocxCommand({ id: 'user-1' } as never, {
      workspaceId: 'workspace-1',
      command,
    }),
    { message: /must use source=user/ }
  );
  t.false(commandService.preview.called);
  t.false(commandService.execute.called);
});

test('OfficeResolver projects immutable revision asset URLs', async t => {
  const now = new Date();
  const revision = {
    id: 'revision-1',
    workspaceId: 'workspace-1',
    artifactId: 'artifact-1',
    sequence: 1,
    origin: OfficeRevisionOrigin.import,
    parentRevisionId: null,
    idempotencyKey: 'import-1',
    idempotencyFingerprint: fingerprint(Buffer.from('import')),
    packageBlobKey: 'office/package/docx/source.docx',
    packageMimeType: DOCX_MIME,
    packageByteSize: 42,
    packageFingerprint: fingerprint(Buffer.from('package')),
    stateBlobKey: 'office/state/docx/state.json',
    stateByteSize: 24,
    stateFingerprint: fingerprint(Buffer.from('state')),
    modelVersion: 'localmind-office-docx-model/v1',
    operationSummary: { type: 'import' },
    createdBy: 'user-1',
    createdAt: now,
  };
  const artifact = {
    id: 'artifact-1',
    workspaceId: 'workspace-1',
    kind: OfficeArtifactKind.document,
    title: 'Native document',
    sourceFileName: 'native.docx',
    sourceMimeType: DOCX_MIME,
    sourceBlobKey: 'office/package/docx/source.docx',
    sourceByteSize: 42,
    sourceFingerprint: fingerprint(Buffer.from('package')),
    importIdempotencyKey: 'import-1',
    importFingerprint: fingerprint(Buffer.from('import')),
    revisionCounter: 1,
    compatibility: { preservationLevel: 'L0' },
    createdBy: 'user-1',
    createdAt: now,
    updatedAt: now,
  };
  const artifacts = {
    get: Sinon.stub().resolves({ artifact, revision }),
  };
  const resolver = new OfficeResolver(
    artifacts as never,
    {} as never,
    {} as never,
    { link: (path: string) => `https://localmind.test${path}` } as URLHelper
  );

  const result = await resolver.officeArtifact(
    { id: 'user-1' } as never,
    'workspace-1',
    'artifact-1'
  );

  t.true(result.currentRevision.packageUrl.endsWith('/revision-1/package'));
  t.true(result.currentRevision.stateUrl?.endsWith('/revision-1/state'));
  t.is(result.currentRevision.packageFingerprint, revision.packageFingerprint);
});
