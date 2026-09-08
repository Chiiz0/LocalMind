import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';

import { type AiContextProjectGrant, PrismaClient } from '@prisma/client';
import test from 'ava';
import Sinon from 'sinon';

import { ConfigFactory } from '../../base';
import { EntitlementService } from '../../core/entitlement';
import { QuotaStateService } from '../../core/quota/state';
import { WorkspaceBlobStorage } from '../../core/storage/wrappers/blob';
import { StorageRuntimeProvider } from '../../core/storage-runtime';
import { BlobModel } from '../../models';
import { getMime } from '../../native';
import { Mockers } from '../mocks';
import {
  collectAllBlobSizes,
  completeBlobUpload,
  createBlobUpload,
  createTestingApp,
  createWorkspace,
  deleteWorkspace,
  getBlobUploadPartUrl,
  getWorkspaceBlobsSize,
  listBlobs,
  setBlob,
  TestingApp,
} from '../utils';

const OneMB = 1024 * 1024;
const RESTRICTED_QUOTA = {
  seatQuota: 0,
  blobLimit: OneMB,
  storageQuota: 2 * OneMB - 1,
  historyPeriod: 1,
  memberLimit: 1,
};
const SCOPED_FIXTURE_BLOB_ID = 'ldZMrM4PDlsNG4Q4YvCsz623h6TKu4qI9_FpTqIypfw=';

let app: TestingApp;
type CompleteResult =
  | {
      ok: true;
      contentType: string;
      contentLength: number;
      lastModifiedMs: number;
    }
  | {
      ok: false;
      reason:
        | 'not_found'
        | 'size_mismatch'
        | 'mime_mismatch'
        | 'checksum_mismatch'
        | 'size_too_large';
    };
const objects = new Map<
  string,
  {
    body: Buffer;
    metadata: {
      contentType: string;
      contentLength: number;
      lastModified: Date;
    };
  }
>();
const completeResults = new Map<string, CompleteResult>();
const storageRuntime = {
  providerCapabilities: async () => ({
    put: true,
    get: true,
    head: true,
    list: true,
    delete: true,
    presignPut: false,
    presignGet: false,
    multipartDirect: false,
    proxyUpload: false,
    assetpack: false,
    serverMediatedOnly: true,
  }),
  putObject: async (
    _scope: string,
    key: string,
    body: Buffer,
    metadata?: { contentType?: string; contentLength?: number }
  ) => {
    const object = {
      body,
      metadata: {
        contentType: metadata?.contentType ?? getMime(body),
        contentLength: metadata?.contentLength ?? body.length,
        lastModified: new Date(),
      },
    };
    objects.set(key, object);
    return object.metadata;
  },
  headObject: async (_scope: string, key: string) => {
    return objects.get(key)?.metadata;
  },
  getObject: async (_scope: string, key: string) => {
    const object = objects.get(key);
    return object
      ? { body: Readable.from(object.body), metadata: object.metadata }
      : {};
  },
  listObjects: async (_scope: string, prefix?: string) => {
    return Array.from(objects.entries())
      .filter(([key]) => !prefix || key.startsWith(prefix))
      .map(([key, object]) => ({ key, ...object.metadata }));
  },
  deleteObject: async (_scope: string, key: string) => {
    objects.delete(key);
  },
  presignPut: async () => undefined,
  presignGet: async () => undefined,
  createMultipartUpload: async () => undefined,
  presignUploadPart: async () => undefined,
  listMultipartUploadParts: async () => undefined,
  completeMultipartUpload: async () => undefined,
  completeWorkspaceBlobUpload: async (workspaceId: string, key: string) => {
    const objectKey = `${workspaceId}/${key}`;
    const configured = completeResults.get(objectKey);
    if (configured) return configured;
    const object = objects.get(objectKey);
    if (!object) return { ok: false, reason: 'not_found' };
    await app.get(BlobModel).upsert({
      workspaceId,
      key,
      mime: object.metadata.contentType,
      size: object.metadata.contentLength,
      status: 'completed',
      uploadId: null,
    });
    return {
      ok: true,
      contentType: object.metadata.contentType,
      contentLength: object.metadata.contentLength,
      lastModifiedMs: object.metadata.lastModified.getTime(),
    };
  },
};

test.before(async () => {
  app = await createTestingApp({
    tapModule: builder => {
      builder.overrideProvider(StorageRuntimeProvider).useValue(storageRuntime);
    },
  });
  app.get(ConfigFactory).override({
    storages: {
      blob: {
        storage: {
          provider: 'fs',
          bucket: 'test',
          config: { path: '/tmp/affine-test-storage' },
        },
      },
    },
  });
});

test.beforeEach(async () => {
  await app.initTestingDB();
  objects.clear();
  completeResults.clear();
});

test.after.always(async () => {
  await app.close();
});

async function withRestrictedWorkspaceQuota(workspaceId: string) {
  const quotaState = app.get(QuotaStateService);
  const entitlement = app.get(EntitlementService);
  const resolveUserEntitlement =
    entitlement.resolveUserEntitlement.bind(entitlement);
  const stub = Sinon.stub(entitlement, 'resolveUserEntitlement').callsFake(
    async userId => {
      const resolved = await resolveUserEntitlement(userId);
      return {
        ...resolved,
        quota: { ...resolved.quota, ...RESTRICTED_QUOTA },
      };
    }
  );
  await quotaState.reconcileWorkspaceQuotaState(workspaceId);
  return stub;
}

async function createScopedProjectAccess(level: 'read' | 'write') {
  const owner = await app.signupV1('scoped-owner@affine.pro');
  const workspace = await createWorkspace(app);
  const member = await app.signupV1('scoped-member@affine.pro');
  const docId = 'scoped-doc';
  await app.create(Mockers.DocSnapshot, {
    workspaceId: workspace.id,
    user: owner,
    docId,
    snapshotFile: 'test-doc-with-blob.snapshot.bin',
  });

  const db = app.get(PrismaClient);
  const project = await db.aiContextProject.create({
    data: {
      createdByUserId: owner.id,
      name: 'Scoped blob project',
      members: {
        create: [
          { userId: owner.id, role: 'owner' },
          { userId: member.id, role: 'member' },
        ],
      },
    },
  });
  const grant = await db.$transaction(async transaction => {
    return transaction.aiContextProjectGrant.create({
      data: {
        projectId: project.id,
        workspaceId: workspace.id,
        docId,
        level,
        status: 'active',
        source: 'direct',
        approvingSide: 'source',
        revocable: true,
        grantedByUserId: owner.id,
        grantorUserIdSnapshot: owner.id,
      },
    });
  });
  await app.switchUser(member);
  return { db, docId, grant, member, owner, workspace };
}

async function setScopedProjectGrantStatus(
  db: PrismaClient,
  grant: AiContextProjectGrant,
  actorUserId: string,
  status: 'active' | 'revoked'
) {
  const revokedAt = status === 'revoked' ? new Date() : null;
  await db.$transaction(async transaction => {
    await transaction.aiContextProjectGrant.update({
      where: { id: grant.id },
      data: {
        status,
        revokedByUserId: status === 'revoked' ? actorUserId : null,
        revokerUserIdSnapshot: status === 'revoked' ? actorUserId : null,
        revokedAt,
      },
    });
  });
}

async function createScopedBlobUpload(
  workspaceId: string,
  docScopeId: string,
  key: string,
  size: number,
  mime: string
) {
  const result = await app.gql(
    `mutation scopedCreateBlobUpload(
      $workspaceId: String!
      $docScopeId: String!
      $key: String!
      $size: Int!
      $mime: String!
    ) {
      createBlobUpload(
        workspaceId: $workspaceId
        docScopeId: $docScopeId
        key: $key
        size: $size
        mime: $mime
      ) {
        method
        blobKey
        alreadyUploaded
        uploadUrl
      }
    }`,
    { workspaceId, docScopeId, key, size, mime }
  );
  return result.createBlobUpload;
}

async function setScopedBlob(
  workspaceId: string,
  docScopeId: string,
  key: string,
  body: Buffer,
  mime = 'text/plain'
) {
  const response = await app
    .POST('/graphql')
    .set({ 'x-request-id': 'test', 'x-operation-name': 'scopedSetBlob' })
    .field(
      'operations',
      JSON.stringify({
        name: 'scopedSetBlob',
        query: `mutation scopedSetBlob(
          $workspaceId: String!
          $docScopeId: String!
          $blob: Upload!
        ) {
          setBlob(
            workspaceId: $workspaceId
            docScopeId: $docScopeId
            blob: $blob
          )
        }`,
        variables: { workspaceId, docScopeId, blob: null },
      })
    )
    .field('map', JSON.stringify({ '0': ['variables.blob'] }))
    .attach('0', body, { filename: key, contentType: mime })
    .expect(200);
  if (response.body.errors?.length) {
    throw new Error(response.body.errors[0].message);
  }
  return response.body.data.setBlob as string;
}

test('document-scoped blob download only exposes current document references', async t => {
  const { db, docId, grant, workspace } =
    await createScopedProjectAccess('read');
  const storage = app.get(WorkspaceBlobStorage);
  await storage.put(
    workspace.id,
    SCOPED_FIXTURE_BLOB_ID,
    Buffer.from('referenced'),
    { contentType: 'text/plain', contentLength: 10 }
  );
  await storage.put(workspace.id, 'other-doc-blob', Buffer.from('hidden'), {
    contentType: 'text/plain',
    contentLength: 6,
  });

  const referenced = await app.GET(
    `/api/workspaces/${workspace.id}/blobs/${encodeURIComponent(SCOPED_FIXTURE_BLOB_ID)}?docScopeId=${docId}`
  );
  t.is(referenced.status, 200);
  t.is(referenced.text, 'referenced');
  t.is(referenced.get('cache-control'), 'private, no-store');

  const unrelated = await app.GET(
    `/api/workspaces/${workspace.id}/blobs/other-doc-blob?docScopeId=${docId}`
  );
  t.is(unrelated.status, 404);

  const forgedBlobIds = [
    SCOPED_FIXTURE_BLOB_ID.slice(0, -1),
    SCOPED_FIXTURE_BLOB_ID.slice(1),
    `prefix-${SCOPED_FIXTURE_BLOB_ID}`,
    `${SCOPED_FIXTURE_BLOB_ID}-suffix`,
  ];
  for (const forgedBlobId of forgedBlobIds) {
    const forged = await app.GET(
      `/api/workspaces/${workspace.id}/blobs/${encodeURIComponent(forgedBlobId)}?docScopeId=${docId}`
    );
    t.is(forged.status, 404);
  }

  await setScopedProjectGrantStatus(
    db,
    grant,
    grant.grantorUserIdSnapshot!,
    'revoked'
  );
  const revoked = await app.GET(
    `/api/workspaces/${workspace.id}/blobs/${encodeURIComponent(SCOPED_FIXTURE_BLOB_ID)}?docScopeId=${docId}`
  );
  t.is(revoked.status, 403);
});

test('public document scope does not expose arbitrary workspace blobs', async t => {
  const owner = await app.signupV1('public-scoped-owner@affine.pro');
  const workspace = await createWorkspace(app);
  const docId = 'public-scoped-doc';
  await app.create(Mockers.DocSnapshot, {
    workspaceId: workspace.id,
    user: owner,
    docId,
    snapshotFile: 'test-doc-with-blob.snapshot.bin',
  });
  await app.get(PrismaClient).docAccessPolicy.create({
    data: {
      workspaceId: workspace.id,
      docId,
      visibility: 'public',
      publicRole: 'external',
    },
  });
  const storage = app.get(WorkspaceBlobStorage);
  await storage.put(workspace.id, 'unrelated-public-blob', Buffer.from('no'), {
    contentType: 'text/plain',
    contentLength: 2,
  });
  app.clearAuth();

  const response = await app.GET(
    `/api/workspaces/${workspace.id}/blobs/unrelated-public-blob?docScopeId=${docId}`
  );
  t.is(response.status, 404);
});

test('document-scoped uploads require a live write grant on the target doc', async t => {
  const { db, docId, grant, member, owner, workspace } =
    await createScopedProjectAccess('write');
  const body = Buffer.from('scoped upload');
  const key = sha256Base64urlWithPadding(body);

  const init = await createScopedBlobUpload(
    workspace.id,
    docId,
    key,
    body.byteLength,
    'text/plain'
  );
  t.is(init.method, 'GRAPHQL');
  t.falsy(init.uploadUrl);

  await app.switchUser(owner);
  await t.throwsAsync(
    app.gql(
      `query {
        workspace(id: "${workspace.id}") {
          blobUploadPartUrl(
            key: "${key}"
            uploadId: "scoped-upload"
            partNumber: 1
            docScopeId: "${docId}"
          ) {
            uploadUrl
          }
        }
      }`
    ),
    { message: /Scoped multipart blob upload is not supported/ }
  );
  await t.throwsAsync(
    app.gql(
      `mutation {
        completeBlobUpload(
          workspaceId: "${workspace.id}"
          docScopeId: "${docId}"
          key: "${key}"
          uploadId: "scoped-upload"
          parts: [{ partNumber: 1, etag: "etag" }]
        )
      }`
    ),
    { message: /Scoped multipart blob upload is not supported/ }
  );
  await t.throwsAsync(
    app.gql(
      `mutation {
        abortBlobUpload(
          workspaceId: "${workspace.id}"
          docScopeId: "${docId}"
          key: "${key}"
          uploadId: "scoped-upload"
        )
      }`
    ),
    { message: /Scoped multipart blob upload is not supported/ }
  );
  await app.switchUser(member);

  await setScopedProjectGrantStatus(db, grant, owner.id, 'revoked');
  await t.throwsAsync(
    setScopedBlob(workspace.id, docId, key, body),
    undefined,
    'revocation between create and upload must fail closed'
  );
  t.false(objects.has(`${workspace.id}/${key}`));

  await setScopedProjectGrantStatus(db, grant, owner.id, 'active');
  t.is(await setScopedBlob(workspace.id, docId, key, body), key);
  t.deepEqual(objects.get(`${workspace.id}/${key}`)?.body, body);

  const otherDocId = 'other-scoped-doc';
  await app.create(Mockers.DocSnapshot, {
    workspaceId: workspace.id,
    user: owner,
    docId: otherDocId,
  });
  await t.throwsAsync(
    createScopedBlobUpload(
      workspace.id,
      otherDocId,
      key,
      body.byteLength,
      'text/plain'
    ),
    undefined,
    'a write grant on one doc must not authorize another doc scope'
  );
});

test('read project grant cannot use any scoped blob write stage', async t => {
  const { docId, workspace } = await createScopedProjectAccess('read');
  const body = Buffer.from('read denied');
  const key = sha256Base64urlWithPadding(body);

  await t.throwsAsync(
    createScopedBlobUpload(
      workspace.id,
      docId,
      key,
      body.byteLength,
      'text/plain'
    )
  );
  await t.throwsAsync(setScopedBlob(workspace.id, docId, key, body));
  await t.throwsAsync(
    app.gql(
      `mutation {
        completeBlobUpload(
          workspaceId: "${workspace.id}"
          docScopeId: "${docId}"
          key: "${key}"
        )
      }`
    )
  );
  await t.throwsAsync(
    app.gql(
      `mutation {
        abortBlobUpload(
          workspaceId: "${workspace.id}"
          docScopeId: "${docId}"
          key: "${key}"
          uploadId: "unknown"
        )
      }`
    )
  );
});

test('should set blobs', async t => {
  await app.signupV1('u1@affine.pro');

  const workspace = await createWorkspace(app);

  const buffer1 = Buffer.from([0, 0]);
  const hash1 = await setBlob(app, workspace.id, buffer1);
  const buffer2 = Buffer.from([0, 1]);
  const hash2 = await setBlob(app, workspace.id, buffer2);

  const response1 = await app
    .GET(`/api/workspaces/${workspace.id}/blobs/${hash1}`)
    .buffer();

  t.deepEqual(response1.body, buffer1, 'failed to get blob');

  const response2 = await app
    .GET(`/api/workspaces/${workspace.id}/blobs/${hash2}`)
    .buffer();

  t.deepEqual(response2.body, buffer2, 'failed to get blob');
});

test('should list blobs', async t => {
  await app.signupV1('u1@affine.pro');

  const workspace = await createWorkspace(app);
  const blobs = await listBlobs(app, workspace.id);
  t.is(blobs.length, 0, 'failed to list blobs');

  const buffer1 = Buffer.from([0, 0]);
  const hash1 = await setBlob(app, workspace.id, buffer1);
  const buffer2 = Buffer.from([0, 1]);
  const hash2 = await setBlob(app, workspace.id, buffer2);

  const ret = await listBlobs(app, workspace.id);
  t.is(ret.length, 2, 'failed to list blobs');
  // list blob result is not ordered
  t.deepEqual(ret.map(x => x.key).sort(), [hash1, hash2].sort());
});

test('should keep partial blob metadata listing on DB path without storage scan', async t => {
  await app.signupV1('u1@affine.pro');

  const workspace = await createWorkspace(app);
  const storage = app.get(WorkspaceBlobStorage);
  const rt = app.get(StorageRuntimeProvider);
  const listSpy = Sinon.spy(rt, 'listObjects');
  t.teardown(() => listSpy.restore());

  const buffer1 = Buffer.from('with metadata');
  const buffer2 = Buffer.from('without metadata');
  const key1 = sha256Base64urlWithPadding(buffer1);
  const key2 = sha256Base64urlWithPadding(buffer2);
  await rt.putObject('blob', `${workspace.id}/${key1}`, buffer1, {
    contentType: 'text/plain',
    contentLength: buffer1.length,
  });
  await rt.putObject('blob', `${workspace.id}/${key2}`, buffer2, {
    contentType: 'text/plain',
    contentLength: buffer2.length,
  });

  const blobModel = app.get(BlobModel);
  await blobModel.upsert({
    workspaceId: workspace.id,
    key: key1,
    mime: 'text/plain',
    size: buffer1.length,
    status: 'completed',
    uploadId: null,
  });

  const listed = await storage.list(workspace.id);

  t.deepEqual(
    listed.map(blob => blob.key),
    [key1]
  );
  t.true(listSpy.notCalled);
});

test('should create pending blob upload with graphql fallback', async t => {
  await app.signupV1('u1@affine.pro');

  const workspace = await createWorkspace(app);
  const key = `upload-${Math.random().toString(16).slice(2, 8)}`;
  const size = 4;
  const mime = 'text/plain';

  const init = await createBlobUpload(app, workspace.id, key, size, mime);
  t.is(init.method, 'GRAPHQL');
  t.is(init.blobKey, key);

  const blobModel = app.get(BlobModel);
  const record = await blobModel.get(workspace.id, key);
  t.truthy(record);
  t.is(record?.status, 'pending');

  await createBlobUpload(
    app,
    workspace.id,
    key,
    size,
    'application/octet-stream'
  );
  t.is((await blobModel.get(workspace.id, key))?.mime, mime);

  const listed = await listBlobs(app, workspace.id);
  t.is(listed.length, 0);
});

test('should complete pending blob upload', async t => {
  await app.signupV1('u1@affine.pro');

  const workspace = await createWorkspace(app);
  const buffer = Buffer.from('done');
  const mime = 'text/plain';
  const key = sha256Base64urlWithPadding(buffer);

  await createBlobUpload(app, workspace.id, key, buffer.length, mime);

  const rt = app.get(StorageRuntimeProvider);

  await rt.putObject('blob', `${workspace.id}/${key}`, buffer, {
    contentType: mime,
    contentLength: buffer.length,
  });

  const completed = await completeBlobUpload(app, workspace.id, key);
  t.is(completed, key);

  const blobModel = app.get(BlobModel);
  const record = await blobModel.get(workspace.id, key);
  t.truthy(record);
  t.is(record?.status, 'completed');

  const listed = await listBlobs(app, workspace.id);
  t.is(listed.length, 1);

  const existing = await createBlobUpload(
    app,
    workspace.id,
    key,
    buffer.length,
    'audio/x-m4a'
  );
  t.true(existing.alreadyUploaded);
});

test('should reject complete when blob key mismatched', async t => {
  await app.signupV1('u1@affine.pro');

  const workspace = await createWorkspace(app);
  const buffer = Buffer.from('mismatch');
  const mime = 'text/plain';

  const wrongKey = sha256Base64urlWithPadding(Buffer.from('other'));
  await createBlobUpload(app, workspace.id, wrongKey, buffer.length, mime);

  const rt = app.get(StorageRuntimeProvider);

  await rt.putObject('blob', `${workspace.id}/${wrongKey}`, buffer, {
    contentType: mime,
    contentLength: buffer.length,
  });
  completeResults.set(`${workspace.id}/${wrongKey}`, {
    ok: false,
    reason: 'checksum_mismatch',
  });

  await t.throwsAsync(() => completeBlobUpload(app, workspace.id, wrongKey), {
    message: 'Blob key mismatch',
  });
});

test('should reject multipart upload part url on fs provider', async t => {
  await app.signupV1('u1@affine.pro');

  const workspace = await createWorkspace(app);

  await t.throwsAsync(
    () => getBlobUploadPartUrl(app, workspace.id, 'blob-key', 'upload', 1),
    {
      message: 'Multipart upload is not supported',
    }
  );
});

test('should auto delete blobs when workspace is deleted', async t => {
  await app.signupV1('u1@affine.pro');

  const workspace = await createWorkspace(app);
  const buffer1 = Buffer.from([0, 0]);
  await setBlob(app, workspace.id, buffer1);
  const buffer2 = Buffer.from([0, 1]);
  await setBlob(app, workspace.id, buffer2);
  const size = await collectAllBlobSizes(app);
  t.is(size, 4);
  const blobs = await listBlobs(app, workspace.id);
  t.is(blobs.length, 2);

  const rt = app.get(StorageRuntimeProvider);
  const listSpy = Sinon.spy(rt, 'listObjects');
  t.teardown(() => listSpy.restore());

  await deleteWorkspace(app, workspace.id);
  t.is(listSpy.callCount, 0);
});

test('should calc blobs size', async t => {
  await app.signupV1('u1@affine.pro');

  const workspace = await createWorkspace(app);

  const buffer1 = Buffer.from([0, 0]);
  await setBlob(app, workspace.id, buffer1);
  const buffer2 = Buffer.from([0, 1]);
  await setBlob(app, workspace.id, buffer2);

  const size = await getWorkspaceBlobsSize(app, workspace.id);
  t.is(size, 4, 'failed to collect blob sizes');
});

test('should calc all blobs size', async t => {
  await app.signupV1('u1@affine.pro');

  const workspace1 = await createWorkspace(app);

  const buffer1 = Buffer.from([0, 0]);
  await setBlob(app, workspace1.id, buffer1);
  const buffer2 = Buffer.from([0, 1]);
  await setBlob(app, workspace1.id, buffer2);

  const workspace2 = await createWorkspace(app);

  const buffer3 = Buffer.from([0, 0]);
  await setBlob(app, workspace2.id, buffer3);
  const buffer4 = Buffer.from([0, 1]);
  await setBlob(app, workspace2.id, buffer4);

  const size = await collectAllBlobSizes(app);
  t.is(size, 8, 'failed to collect all blob sizes');
});

test('should reject blob exceeded limit', async t => {
  await app.signupV1('u1@affine.pro');

  const workspace1 = await createWorkspace(app);
  const quotaStub = await withRestrictedWorkspaceQuota(workspace1.id);
  t.teardown(() => quotaStub.restore());

  const buffer1 = Buffer.from(
    Array.from({ length: RESTRICTED_QUOTA.blobLimit + 1 }, () => 0)
  );
  await t.throwsAsync(setBlob(app, workspace1.id, buffer1), {
    message: 'You have exceeded your blob size quota.',
  });
});

test('should reject blob exceeded storage quota', async t => {
  await app.signupV1('u1@affine.pro');

  const workspace = await createWorkspace(app);
  const quotaStub = await withRestrictedWorkspaceQuota(workspace.id);
  t.teardown(() => quotaStub.restore());

  const buffer = Buffer.from(Array.from({ length: OneMB }, () => 0));

  await t.notThrowsAsync(setBlob(app, workspace.id, buffer));
  await t.throwsAsync(setBlob(app, workspace.id, buffer), {
    message: 'You have exceeded your storage quota.',
  });
});

test('should throw error when blob size large than max file size', async t => {
  await app.signup();

  const workspace = await createWorkspace(app);

  const buffer = Buffer.from(new Uint8Array(1024 * 1024 * 11));
  await t.throwsAsync(setBlob(app, workspace.id, buffer), {
    message:
      'HTTP request error, message: File truncated as it exceeds the 10485760 byte size limit.',
  });
});

function sha256Base64urlWithPadding(buffer: Buffer) {
  return createHash('sha256')
    .update(buffer)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
