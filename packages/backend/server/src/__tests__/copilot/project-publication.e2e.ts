import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  createMinimalPdfFixture,
  createMinimalPptxFixture,
  createMinimalXlsxFixture,
} from '@localmind/office/testing';
import { PrismaClient } from '@prisma/client';
import test from 'ava';
import Sinon from 'sinon';
import { applyUpdate, Doc, encodeStateAsUpdate, Map as YMap } from 'yjs';

import {
  DocReader,
  DocumentDestinationService,
  DocWriter,
  WorkspaceOrganizationService,
} from '../../core/doc';
import { readFileCopySnapshot } from '../../core/doc/copy-snapshot';
import { OFFICE_FORMATS, OfficeImportService } from '../../core/office';
import { ProjectBlobStorage, ProjectResourceService } from '../../core/project';
import {
  ProjectDestinationFolderService,
  ProjectPublicationConflict,
  ProjectPublicationService,
} from '../../core/project-transfer';
import { publicationTargetSchema } from '../../models/project-publication';
import { parseYDocToMarkdown } from '../../native';
import { CopilotProjectAgentRuntimeWorker } from '../../plugins/copilot/project-agent-runtime-worker';
import { createTestingApp, type TestingApp } from '../utils';

let app: TestingApp;
test.before(async () => {
  app = await createTestingApp();
});
test.beforeEach(async () => {
  await app.initTestingDB();
});
test.after.always(async () => {
  await app.close();
});

async function workspace(actorId: string) {
  const workspace = await app.models.workspace.create(actorId);
  const db = app.get(PrismaClient);
  await db.effectiveWorkspaceQuotaState.create({
    data: {
      workspaceId: workspace.id,
      ownerUserId: actorId,
      plan: 'free',
      seatLimit: 100,
      blobLimit: 0,
      storageQuota: 0,
      historyPeriodSeconds: 0,
      known: true,
      stale: false,
    },
  });
  const doc = new Doc();
  doc.getMap('meta').set('name', 'Publication destination');
  const bytes = encodeStateAsUpdate(doc);
  doc.destroy();
  await db.snapshot.create({
    data: {
      workspaceId: workspace.id,
      id: workspace.id,
      blob: bytes,
      size: bytes.length,
      createdBy: actorId,
      updatedAt: new Date(),
    },
  });
  return workspace.id;
}

async function fixture() {
  const user = await app.createUser();
  await app
    .POST('/api/auth/sign-in')
    .set('x-affine-version', '0.27.0')
    .send({ email: user.email, password: user.password })
    .expect(200);
  const owner = await app.models.user.create({
    email: 'publication-owner@example.com',
  });
  const db = app.get(PrismaClient);
  const project = await db.aiContextProject.create({
    data: {
      name: 'Internal resources',
      aiPolicy: 'read_only',
      members: {
        create: [
          { userId: owner.id, role: 'owner' },
          { userId: user.id, role: 'member' },
        ],
      },
    },
  });
  const actor = { actorId: user.id, projectId: project.id };
  const resource = await app.get(ProjectResourceService).createDocument({
    ...actor,
    title: 'Independent document',
    markdown: 'Original internal body',
    requestKey: 'source',
  });
  return {
    ...actor,
    resourceId: resource.id,
    workspaceId: await workspace(user.id),
    db,
    service: app.get(ProjectPublicationService),
  };
}

async function prepare(
  scope: Awaited<ReturnType<typeof fixture>>,
  options: {
    workspaceId?: string;
    targetResourceId?: string;
    requestKey?: string;
  } = {}
) {
  const record = await scope.service.prepare({
    ...scope,
    kind: options.targetResourceId ? 'update' : 'publish',
    requestKey: options.requestKey ?? randomUUID(),
  });
  return scope.service.preview({
    ...scope,
    publicationId: record.id,
    expectedRevision: record.revision,
    workspaceId: options.workspaceId ?? scope.workspaceId,
    folderId: null,
    targetResourceId: options.targetResourceId,
  });
}

async function execute(
  scope: Awaited<ReturnType<typeof fixture>>,
  record: Awaited<ReturnType<typeof prepare>>
) {
  const run = await app.models.copilotProjectAgentRuntime.get({
    ...scope,
    runId: record.runId!,
  });
  const input = {
    ...scope,
    publicationId: record.id,
    expectedRevision: record.revision,
    targetFingerprint: run.targetFingerprint,
  };
  await scope.service.submit(input);
  await scope.service.submit(input);
  await app
    .get(CopilotProjectAgentRuntimeWorker)
    .run({ projectId: scope.projectId, runId: run.id });
  return app.models.copilotProjectAgentRuntime.get({ ...scope, runId: run.id });
}

async function body(workspaceId: string, resourceId: string) {
  const doc = await app.get(DocReader).getDoc(workspaceId, resourceId);
  if (!doc) throw new Error('Document is missing');
  return parseYDocToMarkdown(Buffer.from(doc.bin), resourceId, true).markdown;
}

test.serial(
  'expired publications retain internal content and reopen with a new confirmation and one external receipt',
  async t => {
    const scope = await fixture();
    const clock = Sinon.useFakeTimers({
      now: Date.now() - 25 * 60 * 60 * 1000,
      toFake: ['Date'],
    });
    let expired;
    try {
      expired = await app.models.projectPublication.prepare({
        ...scope,
        kind: 'publish',
        requestKey: 'expire-and-resume',
      });
    } finally {
      clock.restore();
    }
    const internalBefore = await scope.db.projectResourceRevision.count({
      where: { resourceId: scope.resourceId },
    });
    t.is(await app.models.projectPublication.expire(), 1);
    t.is(await app.models.projectPublication.expire(), 0);
    const record = await app.models.projectPublication.get({
      ...scope,
      publicationId: expired.id,
    });
    t.is(record.status, 'expired');
    await t.throwsAsync(
      scope.service.preview({
        ...scope,
        publicationId: record.id,
        expectedRevision: record.revision,
        folderId: null,
      })
    );
    const reopened = await app.models.projectPublication.reopen({
      ...scope,
      publicationId: record.id,
      expectedRevision: record.revision,
    });
    const preview = await scope.service.preview({
      ...scope,
      publicationId: reopened.id,
      expectedRevision: reopened.revision,
      folderId: null,
    });
    t.is((await execute(scope, preview)).status, 'completed');
    t.is((await execute(scope, preview)).status, 'completed');
    t.is(
      await scope.db.projectPublicationTarget.count({
        where: { resourceId: scope.resourceId },
      }),
      1
    );
    t.is(
      await scope.db.projectResourceRevision.count({
        where: { resourceId: scope.resourceId },
      }),
      internalBefore
    );
    t.true(
      (
        await body(
          scope.workspaceId,
          publicationTargetSchema.parse(preview.target).resourceId
        )
      ).includes('Original internal body')
    );
  }
);

test.serial(
  'ordinary member publishes two independent copies and updates only the exact confirmed target with its ACL intact',
  async t => {
    const scope = await fixture();
    const first = await prepare(scope);
    const secondWorkspace = await workspace(scope.actorId);
    const second = await prepare(scope, { workspaceId: secondWorkspace });
    t.is((await execute(scope, first)).status, 'completed');
    t.is((await execute(scope, second)).status, 'completed');
    const firstTarget = publicationTargetSchema.parse(first.target);
    const secondTarget = publicationTargetSchema.parse(second.target);
    t.not(firstTarget.resourceId, scope.resourceId);
    t.not(secondTarget.resourceId, firstTarget.resourceId);
    const candidates = await scope.service.targets({
      ...scope,
      parentId: null,
    });
    t.true(
      candidates.items.some(
        item =>
          item.resourceId === firstTarget.resourceId &&
          item.title === 'Independent document' &&
          item.canUpdate
      )
    );
    await scope.db.workspaceDoc.deleteMany({
      where: { workspaceId: scope.workspaceId, docId: firstTarget.resourceId },
    });
    const legacyCandidates = await scope.service.targets({
      ...scope,
      parentId: null,
      query: 'Independent document',
    });
    t.true(
      legacyCandidates.items.some(
        item =>
          item.resourceId === firstTarget.resourceId &&
          item.title === 'Independent document' &&
          item.canUpdate
      )
    );
    const grants = await scope.db.docGrant.findMany({
      where: { workspaceId: scope.workspaceId, docId: firstTarget.resourceId },
    });
    await app.get(ProjectResourceService).updateMarkdown({
      ...scope,
      expectedContentVersion: 1,
      markdown: 'Internal second version',
      requestKey: 'internal-edit',
      origin: 'user',
    });
    const update = await prepare(scope, {
      targetResourceId: firstTarget.resourceId,
    });
    t.is((await execute(scope, update)).status, 'completed');
    t.true(
      (await body(scope.workspaceId, firstTarget.resourceId)).includes(
        'Internal second version'
      )
    );
    t.false(
      (await body(scope.workspaceId, firstTarget.resourceId)).includes(
        'Original internal body'
      )
    );
    t.true(
      (await body(secondWorkspace, secondTarget.resourceId)).includes(
        'Original internal body'
      )
    );
    t.deepEqual(
      await scope.db.docGrant.findMany({
        where: {
          workspaceId: scope.workspaceId,
          docId: firstTarget.resourceId,
        },
      }),
      grants
    );
    const replay = await app
      .get(CopilotProjectAgentRuntimeWorker)
      .run({ projectId: scope.projectId, runId: update.runId! });
    t.truthy(replay);
    t.is(await scope.db.projectPublicationTarget.count(), 2);
    t.is(
      await scope.db.aiAgentRuntimeExecutionResult.count({
        where: { runId: update.runId! },
      }),
      1
    );
    t.is((await app.models.projectResource.revision(scope)).sequence, 2);
  }
);

test.serial(
  'source changes invalidate confirmation and target changes after approval produce a conflict without an overwrite',
  async t => {
    const scope = await fixture();
    const stale = await prepare(scope);
    await app.get(ProjectResourceService).updateMarkdown({
      ...scope,
      expectedContentVersion: 1,
      markdown: 'New internal content',
      requestKey: 'edit',
      origin: 'user',
    });
    await t.throwsAsync(execute(scope, stale), {
      instanceOf: ProjectPublicationConflict,
    });
    t.is(await scope.db.projectPublicationTarget.count(), 0);
    const published = await prepare(scope);
    t.is((await execute(scope, published)).status, 'completed');
    const target = publicationTargetSchema.parse(published.target);
    const update = await prepare(scope, {
      targetResourceId: target.resourceId,
    });
    const run = await app.models.copilotProjectAgentRuntime.get({
      ...scope,
      runId: update.runId!,
    });
    await scope.service.submit({
      ...scope,
      publicationId: update.id,
      expectedRevision: update.revision,
      targetFingerprint: run.targetFingerprint,
    });
    await app
      .get(DocWriter)
      .updateDoc(
        scope.workspaceId,
        target.resourceId,
        'Concurrent external content',
        scope.actorId
      );
    const before = await body(scope.workspaceId, target.resourceId);
    await app
      .get(CopilotProjectAgentRuntimeWorker)
      .run({ projectId: scope.projectId, runId: run.id });
    const result = await app.models.copilotProjectAgentRuntime.get({
      ...scope,
      runId: run.id,
    });
    t.is(result.status, 'failed');
    t.is(result.failureCode, 'publication_conflict');
    t.is(await body(scope.workspaceId, target.resourceId), before);
    t.is(
      (await scope.db.projectPublicationTarget.findFirstOrThrow())
        .publicationId,
      published.id
    );
  }
);

test.serial(
  'cancel, audience drift, revoked membership and failed writes retain the internal resource and cannot claim publication success',
  async t => {
    const scope = await fixture();
    const cancelled = await prepare(scope);
    await app.models.projectPublication.cancel({
      ...scope,
      publicationId: cancelled.id,
      expectedRevision: cancelled.revision,
    });
    await t.throwsAsync(execute(scope, cancelled));
    const changed = await prepare(scope);
    const newcomer = await app.models.user.create({
      email: 'new-audience@example.com',
    });
    await scope.db.workspaceMember.create({
      data: {
        workspaceId: scope.workspaceId,
        userId: newcomer.id,
        state: 'active',
        role: 'member',
      },
    });
    await t.throwsAsync(execute(scope, changed), {
      instanceOf: ProjectPublicationConflict,
    });
    const failing = await prepare(scope);
    const writer = app.get(DocWriter);
    const original = writer.createDocFromSnapshot.bind(writer);
    const stub = Sinon.stub(writer, 'createDocFromSnapshot').callsFake(
      async (...args) => {
        await original(...args);
        throw new Error('Simulated response interruption before commit');
      }
    );
    try {
      t.is((await execute(scope, failing)).status, 'failed');
    } finally {
      stub.restore();
    }
    const target = publicationTargetSchema.parse(failing.target);
    t.is(
      await app.get(DocReader).getDoc(scope.workspaceId, target.resourceId),
      null
    );
    t.is(await scope.db.projectPublicationTarget.count(), 0);
    t.truthy(await app.models.projectResource.get(scope));
    const revoked = await prepare(scope);
    const run = await app.models.copilotProjectAgentRuntime.get({
      ...scope,
      runId: revoked.runId!,
    });
    await scope.service.submit({
      ...scope,
      publicationId: revoked.id,
      expectedRevision: revoked.revision,
      targetFingerprint: run.targetFingerprint,
    });
    await scope.db.aiContextProjectMember.delete({
      where: {
        projectId_userId: { projectId: scope.projectId, userId: scope.actorId },
      },
    });
    await app
      .get(CopilotProjectAgentRuntimeWorker)
      .run({ projectId: scope.projectId, runId: run.id });
    t.is(
      (await scope.db.aiAgentRun.findUniqueOrThrow({ where: { id: run.id } }))
        .status,
      'failed'
    );
    t.is(await scope.db.projectPublicationTarget.count(), 0);
  }
);

test.serial(
  'publication API persists distinct same-title requests and enforces actor, confirmation and immutable audit boundaries',
  async t => {
    const scope = await fixture();
    const mutation = `mutation($projectId: String!, $resourceId: String!, $requestKey: String!) { prepareProjectPublication(projectId: $projectId, resourceId: $resourceId, requestKey: $requestKey, kind: "publish") { id revision status resourceId } }`;
    const input = {
      projectId: scope.projectId,
      resourceId: scope.resourceId,
      requestKey: 'first',
    };
    const first = await app.gql<{
      prepareProjectPublication: { id: string; status: string };
    }>(mutation, input);
    const replay = await app.gql<typeof first>(mutation, input);
    const second = await app.gql<typeof first>(mutation, {
      ...input,
      requestKey: 'second',
    });
    t.is(first.prepareProjectPublication.status, 'waiting_for_location');
    t.is(
      first.prepareProjectPublication.id,
      replay.prepareProjectPublication.id
    );
    t.not(
      first.prepareProjectPublication.id,
      second.prepareProjectPublication.id
    );
    const event = await scope.db.projectPublicationEvent.findFirstOrThrow();
    await t.throwsAsync(
      scope.db.projectPublicationEvent.update({
        where: { id: event.id },
        data: { status: 'submitted' },
      })
    );
    await t.throwsAsync(
      scope.db.projectPublication.update({
        where: { id: first.prepareProjectPublication.id },
        data: { revision: { increment: 1 }, status: 'cancelled' },
      })
    );
    t.is(await scope.db.projectResource.count(), 1);
  }
);

test.serial(
  'all four Office formats publish original package bytes and update independent target revision chains',
  async t => {
    const scope = await fixture();
    const fixtures = [
      {
        format: 'docx' as const,
        bytes: await readFile(
          new URL(
            '../../../../../common/native/fixtures/demo.docx',
            import.meta.url
          )
        ),
      },
      {
        format: 'xlsx' as const,
        bytes: Buffer.from(createMinimalXlsxFixture()),
      },
      {
        format: 'pptx' as const,
        bytes: Buffer.from(createMinimalPptxFixture()),
      },
      {
        format: 'pdf' as const,
        bytes: Buffer.from(await createMinimalPdfFixture()),
      },
    ];
    for (const { format, bytes } of fixtures) {
      const blob = await app
        .get(ProjectBlobStorage)
        .put({ ...scope, bytes, mimeType: OFFICE_FORMATS[format].mimeType });
      const imported = await app.get(OfficeImportService).import({
        projectId: scope.projectId,
        actorId: scope.actorId,
        title: `Native ${format}`,
        sourceFileName: `native.${format}`,
        sourceBlobKey: blob.key,
        importIdempotencyKey: format,
      });
      const source = { ...scope, resourceId: imported.artifact.id };
      const record = await prepare(source);
      t.truthy(
        record.preview &&
          (record.preview as { difference?: { after?: string } }).difference
            ?.after,
        `${format} preview includes saved content`
      );
      const run = await execute(source, record);
      t.is(run.status, 'completed', `${format}: ${run.failureMessage}`);
      const target = publicationTargetSchema.parse(record.target);
      const result = await app.models.officeArtifact.getCurrentRevision(
        scope.workspaceId,
        target.resourceId
      );
      t.is(result?.packageFingerprint, imported.revision.packageFingerprint);
      t.not(target.resourceId, imported.artifact.id);
      const update = await prepare(source, {
        targetResourceId: target.resourceId,
      });
      t.is((await execute(source, update)).status, 'completed');
      const next = await app.models.officeArtifact.getCurrentRevision(
        scope.workspaceId,
        target.resourceId
      );
      t.is(next?.sequence, 2);
      t.is(next?.parentRevisionId, result?.id);
      t.is(
        (
          await app.models.officeArtifact.getCurrentRevision(
            { projectId: scope.projectId },
            source.resourceId
          )
        )?.sequence,
        1
      );
    }
  }
);

test.serial(
  'standalone files publish independent attachment bytes and never overwrite a document body',
  async t => {
    const scope = await fixture();
    const resources = app.get(ProjectResourceService);
    const bytes = Buffer.from('An independent file attachment');
    const blob = await app
      .get(ProjectBlobStorage)
      .put({ ...scope, bytes, mimeType: 'text/plain' });
    const resource = await resources.createFile({
      projectId: scope.projectId,
      actorId: scope.actorId,
      title: 'report.txt',
      blobKey: blob.key,
      requestKey: 'file',
    });
    const source = { ...scope, resourceId: resource.id };
    const record = await prepare(source);
    t.is((await execute(source, record)).status, 'completed');
    const target = publicationTargetSchema.parse(record.target);
    const stored = await app
      .get(DocReader)
      .getDoc(scope.workspaceId, target.resourceId);
    const attachment = readFileCopySnapshot(stored!.bin);
    t.is(attachment?.mimeType, 'text/plain');
    t.is(attachment?.byteSize, bytes.length);
    t.not(attachment?.key, blob.key);
    const candidates = await source.service.targets({
      ...source,
      parentId: null,
    });
    t.deepEqual(
      candidates.items.map(item => item.resourceId),
      [target.resourceId]
    );
    const update = await prepare(source, {
      targetResourceId: target.resourceId,
    });
    t.is((await execute(source, update)).status, 'completed');
    const normal = await prepare(scope);
    t.is((await execute(scope, normal)).status, 'completed');
    await t.throwsAsync(
      prepare(source, {
        targetResourceId: publicationTargetSchema.parse(normal.target)
          .resourceId,
      }),
      { message: /containing only the target file/ }
    );
    t.deepEqual((await resources.readFile(source)).bytes, bytes);
    const canvas = new Doc();
    applyUpdate(canvas, stored!.bin);
    const surface = new YMap();
    surface.set('sys:flavour', 'affine:surface');
    const elements = new YMap();
    elements.set('shape', new YMap([['type', 'shape']]));
    surface.set('prop:elements', elements);
    canvas.getMap('blocks').set('surface-with-content', surface);
    t.is(readFileCopySnapshot(encodeStateAsUpdate(canvas)), null);
    canvas.destroy();
  }
);

test.serial(
  'attachment publication copies frozen bytes into target ownership',
  async t => {
    const scope = await fixture();
    const resources = app.get(ProjectResourceService);
    const source = await resources.readDocument(scope);
    const blob = await app.get(ProjectBlobStorage).put({
      ...scope,
      bytes: Buffer.from('Attachment content'),
      mimeType: 'text/plain',
    });
    const doc = new Doc();
    applyUpdate(doc, source.bytes);
    const block = new YMap();
    block.set('sys:flavour', 'affine:attachment');
    block.set('prop:sourceId', blob.key);
    doc.getMap('blocks').set('attachment', block);
    await resources.saveDocument({
      ...scope,
      expectedContentVersion: 1,
      bytes: Buffer.from(encodeStateAsUpdate(doc)),
      requestKey: 'attachment',
    });
    doc.destroy();
    const record = await prepare(scope);
    t.is((await execute(scope, record)).status, 'completed');
    const target = publicationTargetSchema.parse(record.target);
    const copied = await scope.db.blob.findFirstOrThrow({
      where: {
        workspaceId: scope.workspaceId,
        key: { startsWith: `ai-copy-${target.resourceId}-` },
      },
    });
    t.is(copied.status, 'completed');
    t.is(copied.mime, 'text/plain');
    t.not(copied.key, blob.key);
  }
);

test.serial(
  'destination folders have independent durable receipts, duplicate protection and survive publication cancellation',
  async t => {
    const scope = await fixture();
    const publication = await scope.service.prepare({
      ...scope,
      kind: 'publish',
      requestKey: 'folder-publication',
    });
    const folders = app.get(ProjectDestinationFolderService);
    const directory = await app
      .get(DocumentDestinationService)
      .locations({ ...scope, parentId: null });
    const input = {
      ...scope,
      publicationId: publication.id,
      parentId: null,
      title: 'Reports',
      requestKey: 'folder',
      expectedDirectoryRevision: directory.revision,
    };
    const prepared = await folders.prepare(input);
    t.is((await folders.prepare(input)).id, prepared.id);
    const result = await folders.runPrepared(prepared);
    t.is(result.status, 'completed');
    const replay = await folders.runPrepared(await folders.prepare(input));
    t.is(replay.id, result.id);
    t.is(replay.projectExecutionResults.length, 1);
    await app.models.projectPublication.cancel({
      ...scope,
      publicationId: publication.id,
      expectedRevision: publication.revision,
    });
    const rows = await app
      .get(WorkspaceOrganizationService)
      .readFolders(scope.workspaceId, scope.actorId);
    t.is(
      rows.filter(row => row.type === 'folder' && row.data === 'Reports')
        .length,
      1
    );
    t.truthy(await app.models.projectResource.get(scope));
    const another = await scope.service.prepare({
      ...scope,
      kind: 'publish',
      requestKey: 'another-publication',
    });
    const current = await app
      .get(DocumentDestinationService)
      .locations({ ...scope, parentId: null });
    const duplicate = await folders.prepare({
      ...input,
      publicationId: another.id,
      expectedDirectoryRevision: current.revision,
      requestKey: 'duplicate',
    });
    t.is((await folders.runPrepared(duplicate)).status, 'failed');
    t.is(
      (
        await app
          .get(WorkspaceOrganizationService)
          .readFolders(scope.workspaceId, scope.actorId)
      ).filter(row => row.type === 'folder').length,
      1
    );
  }
);
