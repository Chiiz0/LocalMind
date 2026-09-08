import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import { createMinimalXlsxFixture } from '@localmind/office/testing';
import { PrismaClient } from '@prisma/client';
import ava, { type TestFn } from 'ava';
import Sinon from 'sinon';
import { applyUpdate, Doc, encodeStateAsUpdate, Map as YMap } from 'yjs';

import { DocReader, DocWriter } from '../../core/doc';
import { OFFICE_FORMATS, OfficeImportService } from '../../core/office';
import { ProjectBlobStorage, ProjectResourceService } from '../../core/project';
import {
  ProjectImportService,
  ProjectTransferModule,
} from '../../core/project-transfer';
import { ProjectResourceSourceResolver } from '../../core/project-transfer/source-resolver';
import { WorkspaceBlobStorage } from '../../core/storage';
import { Models } from '../../models';
import { createDocWithMarkdown, parseYDocToMarkdown } from '../../native';
import { createTestingModule, type TestingModule } from '../utils';

const test = ava.serial as TestFn<{
  module: TestingModule;
  db: PrismaClient;
  models: Models;
  imports: ProjectImportService;
  projectId: string;
  workspaceId: string;
  actorId: string;
  readerId: string;
  sourceId: string;
}>;

test.before(async t => {
  const module = await createTestingModule({
    imports: [ProjectTransferModule],
  });
  Object.assign(t.context, {
    module,
    db: module.get(PrismaClient),
    models: module.get(Models),
    imports: module.get(ProjectImportService),
  });
});
test.beforeEach(async t => {
  const { module, db, models } = t.context;
  await module.initTestingDB();
  const actor = await models.user.create({ email: 'source-owner@example.com' });
  const owner = await models.user.create({
    email: 'project-owner@example.com',
  });
  const reader = await models.user.create({
    email: 'source-reader@example.com',
  });
  const workspace = await models.workspace.create(actor.id);
  await db.effectiveWorkspaceQuotaState.upsert({
    where: { workspaceId: workspace.id },
    create: {
      workspaceId: workspace.id,
      plan: 'free',
      ownerUserId: actor.id,
      seatLimit: 100,
      blobLimit: 0,
      storageQuota: 0,
      historyPeriodSeconds: 0,
      known: true,
      stale: false,
    },
    update: { known: true, stale: false, staleAfter: null },
  });
  const project = await db.aiContextProject.create({
    data: {
      name: 'Independent imported copies',
      aiPolicy: 'read_only',
      members: {
        create: [
          { userId: owner.id, role: 'owner' },
          { userId: actor.id, role: 'member' },
          { userId: reader.id, role: 'member' },
        ],
      },
    },
  });
  const sourceId = randomUUID();
  await module
    .get(DocWriter)
    .pushDocUpdate(
      workspace.id,
      sourceId,
      createDocWithMarkdown(
        'Source document',
        'Original source body',
        sourceId
      ),
      actor.id
    );
  await db.docGrant.create({
    data: {
      workspaceId: workspace.id,
      docId: sourceId,
      principalType: 'user',
      principalId: reader.id,
      role: 'reader',
    },
  });
  Object.assign(t.context, {
    projectId: project.id,
    workspaceId: workspace.id,
    actorId: actor.id,
    readerId: reader.id,
    sourceId,
  });
});
test.after.always(async t => {
  await t.context.module.close();
});

test('explicit source refresh preserves identity, rejects stale versions and permissions, and replays once', async t => {
  const {
    module,
    db,
    imports,
    models,
    projectId,
    workspaceId,
    actorId,
    readerId,
    sourceId,
  } = t.context;
  const actor = { projectId, actorId };
  const source = {
    ...actor,
    workspaceId,
    sourceResourceId: sourceId,
    kind: 'page' as const,
  };
  const imported = await imports.import({ ...source, requestKey: 'initial' });
  const first = await models.projectResource.revision({
    ...actor,
    resourceId: imported.id,
  });
  const original = await module.get(DocReader).getDoc(workspaceId, sourceId);
  const document = new Doc();
  applyUpdate(document, original!.bin);
  document.getMap('refresh-fixture').set('version', 2);
  await module
    .get(DocWriter)
    .pushDocUpdate(
      workspaceId,
      sourceId,
      encodeStateAsUpdate(document),
      actorId
    );
  document.destroy();
  t.is(
    (await models.projectResource.get({ ...actor, resourceId: imported.id }))
      .contentVersion,
    1
  );
  const latest = await module.get(DocReader).getDoc(workspaceId, sourceId);
  const sourceVersion = createHash('sha256').update(latest!.bin).digest('hex');
  const lease = (
    await models.projectResourceEditLease.acquire({
      ...actor,
      resourceId: imported.id,
      kind: 'user',
      tabId: 'source-refresh',
    })
  ).lease!;
  const editLease = {
    kind: 'user' as const,
    tabId: lease.tabId,
    leaseId: lease.leaseId,
  };
  const input = {
    ...source,
    requestKey: 'refresh',
    editLease,
    replace: {
      resourceId: imported.id,
      expectedContentVersion: 1,
      expectedSourceVersion: sourceVersion,
    },
  };
  await t.throwsAsync(imports.import({ ...input, editLease: undefined }), {
    message: /edit lease/,
  });
  await t.throwsAsync(
    imports.import({
      ...input,
      replace: { ...input.replace, expectedSourceVersion: 'stale' },
    }),
    { message: /Source changed/ }
  );
  await t.throwsAsync(
    imports.import({
      ...input,
      replace: { ...input.replace, expectedContentVersion: 2 },
    }),
    { message: /Project content changed/ }
  );
  await t.throwsAsync(imports.import({ ...input, actorId: readerId }));
  t.is(await db.projectResourceRevision.count(), 1);
  const refreshed = await imports.import(input);
  t.is(refreshed.id, imported.id);
  t.is(refreshed.contentVersion, 2);
  t.is((await imports.import(input)).contentVersion, 2);
  t.is(await db.projectResource.count(), 1);
  t.is(await db.projectResourceRevision.count(), 2);
  t.deepEqual(
    await models.projectResource.revision({
      ...actor,
      resourceId: imported.id,
      sequence: 1,
    }),
    first
  );
  t.deepEqual(
    Buffer.from(
      (await module.get(DocReader).getDoc(workspaceId, sourceId))!.bin
    ),
    Buffer.from(latest!.bin)
  );
  const resolver = module.get(ProjectResourceSourceResolver);
  const user = await models.user.get(actorId);
  const principal = {
    ...user!,
    hasPassword: !!user!.password,
    emailVerified: !!user!.emailVerifiedAt,
  };
  const sources = await resolver.projectResourceSources(
    principal,
    projectId,
    imported.id
  );
  t.is(sources[0].sourceVersion, sourceVersion);
  t.is(sources[0].projectVersion, 2);
  await t.throwsAsync(
    resolver.refreshProjectResourceSource(
      principal,
      projectId,
      imported.id,
      workspaceId,
      randomUUID(),
      2,
      sourceVersion,
      'forged',
      { tabId: editLease.tabId, leaseId: editLease.leaseId }
    ),
    { message: /linked/ }
  );
  t.deepEqual(
    await resolver.projectResourceSources(
      {
        ...(await models.user.get(readerId))!,
        hasPassword: false,
        emailVerified: false,
      },
      projectId,
      imported.id
    ),
    []
  );
});

test('native Office source refresh appends an independent native version without creating a new resource', async t => {
  const { module, db, imports, models, projectId, workspaceId, actorId } =
    t.context;
  const bytes = Buffer.from(createMinimalXlsxFixture());
  const policy = OFFICE_FORMATS.xlsx;
  await module
    .get(WorkspaceBlobStorage)
    .put(workspaceId, 'refresh.xlsx', bytes, { contentType: policy.mimeType });
  const native = await module.get(OfficeImportService).import({
    workspaceId,
    actorId,
    sourceBlobKey: 'refresh.xlsx',
    sourceFileName: 'refresh.xlsx',
    title: 'Source spreadsheet',
    importIdempotencyKey: 'source-office',
  });
  const source = {
    projectId,
    actorId,
    workspaceId,
    sourceResourceId: native.artifact.id,
    kind: 'workbook' as const,
  };
  const imported = await imports.import({
    ...source,
    requestKey: 'office-initial',
  });
  const first = await models.officeArtifact.getCurrentRevision(
    { projectId },
    imported.id
  );
  const input = {
    ...source,
    requestKey: 'office-refresh',
    editLease: {
      kind: 'user' as const,
      tabId: 'office-refresh',
      leaseId: (
        await models.projectResourceEditLease.acquire({
          ...source,
          resourceId: imported.id,
          kind: 'user',
          tabId: 'office-refresh',
        })
      ).lease!.leaseId,
    },
    replace: {
      resourceId: imported.id,
      expectedContentVersion: 1,
      expectedSourceVersion: native.revision.id,
    },
  };
  await t.throwsAsync(imports.import({ ...input, editLease: undefined }), {
    message: /edit lease/,
  });
  t.is((await imports.import(input)).id, imported.id);
  t.is((await imports.import(input)).id, imported.id);
  const result = await models.officeArtifact.getCurrentRevision(
    { projectId },
    imported.id
  );
  t.is(result?.sequence, 2);
  t.is(result?.parentRevisionId, first?.id);
  t.is(result?.packageFingerprint, native.revision.packageFingerprint);
  t.is(await db.projectResource.count(), 1);
  t.is(
    (
      await models.officeArtifact.getCurrentRevision(
        workspaceId,
        native.artifact.id
      )
    )?.sequence,
    1
  );
});

test('ordinary Project member imports an independent snapshot and attachments with source evidence', async t => {
  const {
    module,
    db,
    imports,
    models,
    projectId,
    workspaceId,
    actorId,
    sourceId,
  } = t.context;
  const ydoc = new Doc();
  const original = await module.get(DocReader).getDoc(workspaceId, sourceId);
  t.truthy(original);
  applyUpdate(ydoc, original!.bin);
  const image = new YMap();
  image.set('sys:flavour', 'affine:image');
  image.set('prop:sourceId', 'source-image');
  ydoc.getMap('blocks').set('image', image);
  await module
    .get(WorkspaceBlobStorage)
    .put(workspaceId, 'source-image', Buffer.from('Image bytes'), {
      contentType: 'image/png',
    });
  await module
    .get(DocWriter)
    .pushDocUpdate(workspaceId, sourceId, encodeStateAsUpdate(ydoc), actorId);
  ydoc.destroy();
  const before = await module.get(DocReader).getDoc(workspaceId, sourceId);
  const input = {
    projectId,
    workspaceId,
    actorId,
    sourceResourceId: sourceId,
    requestKey: 'copy',
    kind: 'page' as const,
  };
  const resource = await imports.import(input);
  t.not(resource.id, sourceId);
  t.is(resource.projectId, projectId);
  t.is((await imports.import(input)).id, resource.id);
  t.is(await db.projectResource.count(), 1);
  t.is(await db.projectResourceAttachment.count(), 1);
  const attachment = await db.projectResourceAttachment.findFirstOrThrow();
  t.true(attachment.key.startsWith('sha256-'));
  t.deepEqual(
    (
      await module
        .get(ProjectBlobStorage)
        .read({ projectId, actorId, key: attachment.key })
    ).bytes,
    Buffer.from('Image bytes')
  );
  const audit = await db.projectResourceAuditEvent.findFirstOrThrow({
    where: { action: 'imported' },
  });
  t.is(
    (audit.evidence as { sourceResourceId: string }).sourceResourceId,
    sourceId
  );
  await module.get(ProjectResourceService).updateMarkdown({
    projectId,
    actorId,
    resourceId: resource.id,
    markdown: 'Internal edit',
    expectedContentVersion: 1,
    requestKey: 'edit',
    origin: 'user',
    editLease: {
      kind: 'user',
      tabId: 'internal-editor',
      leaseId: (
        await models.projectResourceEditLease.acquire({
          projectId,
          actorId,
          resourceId: resource.id,
          kind: 'user',
          tabId: 'internal-editor',
        })
      ).lease!.leaseId,
    },
  });
  const after = await module.get(DocReader).getDoc(workspaceId, sourceId);
  if (!after || !before) throw new Error('Source document disappeared');
  t.deepEqual(Buffer.from(after.bin), Buffer.from(before.bin));
  t.is(
    (
      await models.projectResource.revision({
        projectId,
        actorId,
        resourceId: resource.id,
      })
    ).sequence,
    2
  );
});

test('read access and historical grants cannot copy; disabling source sharing blocks new imports without invalidating approved copies', async t => {
  const {
    module,
    db,
    imports,
    models,
    projectId,
    workspaceId,
    actorId,
    readerId,
    sourceId,
  } = t.context;
  const input = {
    projectId,
    workspaceId,
    actorId: readerId,
    sourceResourceId: sourceId,
    requestKey: 'reader-copy',
    kind: 'page' as const,
  };
  await t.throwsAsync(imports.import(input), { message: /Source permission/ });
  t.is(await db.projectBlob.count(), 0);
  await db.aiContextProjectGrant.create({
    data: {
      projectId,
      workspaceId,
      docId: sourceId,
      level: 'read',
      source: 'direct',
      grantedByUserId: actorId,
      grantorUserIdSnapshot: actorId,
    },
  });
  await t.throwsAsync(imports.import(input), { message: /Source permission/ });
  t.is(await db.projectBlob.count(), 0);
  const request =
    await models.intelligenceWorkbenchAuthorization.requestProjectCopy({
      projectId,
      workspaceId,
      docId: sourceId,
      actorId: readerId,
      requestKey: 'copy-request',
    });
  t.is(request.request.purpose, 'project_copy');
  await models.intelligenceWorkbenchAuthorization.approveAccessRequest({
    requestId: request.request.id,
    actorUserId: actorId,
  });
  const copy = await imports.import(input);
  t.is(copy.kind, 'page');
  t.is(await db.workspaceMember.count({ where: { userId: readerId } }), 0);
  await t.throwsAsync(
    db.accessRequest.update({
      where: { id: request.request.id },
      data: { purpose: 'access' },
    })
  );
  await db.workspaceAccessPolicy.upsert({
    where: { workspaceId },
    create: { workspaceId, sharingEnabled: false },
    update: { sharingEnabled: false },
  });
  await t.throwsAsync(imports.import({ ...input, requestKey: 'another-copy' }));
  t.truthy(
    await module
      .get(ProjectResourceService)
      .readDocument({ projectId, actorId: readerId, resourceId: copy.id })
  );
  t.is(await db.projectResource.count(), 1);
});

test('Office imports keep native type, source package and independent Artifact identity', async t => {
  const { module, imports, projectId, workspaceId, actorId } = t.context;
  const bytes = Buffer.from(createMinimalXlsxFixture());
  await module
    .get(WorkspaceBlobStorage)
    .put(workspaceId, 'imports/source.xlsx', bytes, {
      contentType: OFFICE_FORMATS.xlsx.mimeType,
    });
  const source = await module.get(OfficeImportService).import({
    workspaceId,
    actorId,
    sourceBlobKey: 'imports/source.xlsx',
    sourceFileName: 'source.xlsx',
    title: 'Source workbook',
    importIdempotencyKey: 'source-import',
  });
  const input = {
    projectId,
    workspaceId,
    actorId,
    sourceResourceId: source.artifact.id,
    requestKey: 'office-copy',
    kind: 'workbook' as const,
  };
  const copy = await imports.import(input);
  t.not(copy.id, source.artifact.id);
  t.is(copy.kind, 'workbook');
  t.is(copy.officeArtifactId, copy.id);
  t.is((await imports.import(input)).id, copy.id);
  const internal = await t.context.models.officeArtifact.get(
    { projectId },
    copy.id
  );
  t.is(internal?.workspaceId, null);
  t.is(internal?.sourceFingerprint, source.artifact.sourceFingerprint);
  t.is(
    (await t.context.models.officeArtifact.get(workspaceId, source.artifact.id))
      ?.revisionCounter,
    1
  );
});

test('source writes wait until the imported snapshot and evidence commit', async t => {
  const { module, imports, projectId, workspaceId, actorId, sourceId } =
    t.context;
  const blobs = module.get(ProjectBlobStorage);
  const originalPut = blobs.put.bind(blobs);
  let entered!: () => void;
  let release!: () => void;
  const copying = new Promise<void>(resolve => {
    entered = resolve;
  });
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const stub = Sinon.stub(blobs, 'put').callsFake(async input => {
    entered();
    await gate;
    return originalPut(input);
  });
  const importing = imports.import({
    projectId,
    workspaceId,
    actorId,
    sourceResourceId: sourceId,
    requestKey: 'locked-copy',
    kind: 'page',
  });
  let pendingWrite: Promise<unknown> | undefined;
  try {
    await copying;
    let written = false;
    pendingWrite = module
      .get(DocWriter)
      .pushDocUpdate(
        workspaceId,
        sourceId,
        createDocWithMarkdown(
          'Changed source',
          'External concurrent update',
          sourceId
        ),
        actorId
      )
      .then(() => {
        written = true;
      });
    await delay(100);
    t.false(written);
    release();
    const copied = await importing;
    await pendingWrite;
    const internal = await module
      .get(ProjectResourceService)
      .readDocument({ projectId, actorId, resourceId: copied.id });
    t.true(
      parseYDocToMarkdown(internal.bytes, copied.id, true).markdown.includes(
        'Original source body'
      )
    );
    t.false(
      parseYDocToMarkdown(internal.bytes, copied.id, true).markdown.includes(
        'External concurrent update'
      )
    );
  } finally {
    release();
    await Promise.allSettled([
      importing,
      ...(pendingWrite ? [pendingWrite] : []),
    ]);
    stub.restore();
  }
});
