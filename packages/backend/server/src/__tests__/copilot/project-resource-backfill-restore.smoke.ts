import '../../prelude';

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { ConfigFactory } from '../../base';
import { DocReader } from '../../core/doc';
import { inspectDocumentCopySnapshot } from '../../core/doc/copy-snapshot';
import { OfficeArtifactService } from '../../core/office';
import { ProjectBlobStorage } from '../../core/project';
import { ProjectTransferModule } from '../../core/project-transfer';
import { ProjectLegacyResolver } from '../../core/project-transfer/legacy-resolver';
import { ProjectResourceMigrationService } from '../../core/project-transfer/migration-service';
import { Models } from '../../models';
import { createTestingModule } from '../utils';

assert(
  [
    '/localmind_project_native_upgrade_20260906',
    '/localmind_project_native_upgrade_final_20260906',
  ].includes(new URL(process.env.DATABASE_URL!).pathname),
  'Only the restored upgrade database may be backfilled'
);
const storagePath = process.env.PROJECT_RESTORE_STORAGE;
assert(
  storagePath?.startsWith('/tmp/localmind-project-native-restore/'),
  'An isolated restored Blob directory is required'
);
const module = await createTestingModule(
  { imports: [ProjectTransferModule] },
  false
);
module.get(ConfigFactory).override({
  storages: {
    blob: {
      storage: {
        provider: 'fs',
        bucket: 'blobs',
        config: { path: storagePath },
      },
    },
  },
});
await module.init();
const db = module.get(PrismaClient);
const models = module.get(Models);
const worker = module.get(ProjectResourceMigrationService);
const hash = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
const workspaceEvidence = () => db.$queryRaw`
  SELECT 'snapshots' AS kind, count(*)::text AS count,
    md5(COALESCE(string_agg(md5(row_to_json(t)::text), '' ORDER BY t.workspace_id, t.guid), '')) AS fingerprint FROM snapshots t
  UNION ALL SELECT 'updates', count(*)::text,
    md5(COALESCE(string_agg(md5(row_to_json(t)::text), '' ORDER BY t.workspace_id, t.guid, t.created_at), '')) FROM updates t
  UNION ALL SELECT 'blobs', count(*)::text,
    md5(COALESCE(string_agg(md5(row_to_json(t)::text), '' ORDER BY t.workspace_id, t.key), '')) FROM blobs t
  UNION ALL SELECT 'office', count(*)::text,
    md5(COALESCE(string_agg(md5(row_to_json(t)::text), '' ORDER BY t.id), '')) FROM office_artifacts t WHERE t.workspace_id IS NOT NULL
`;
try {
  const before = await workspaceEvidence();
  const originalOperations = await db.copilotDocumentOperation.findMany({
    where: { projectId: { not: null } },
    select: {
      id: true,
      actorId: true,
      projectId: true,
      title: true,
      markdown: true,
      contentFingerprint: true,
      status: true,
      documentId: true,
      createdDocumentAt: true,
    },
    orderBy: { id: 'asc' },
  });
  const referenceCount = await db.aiContextProjectDoc.count();
  assert(referenceCount > 0, 'Restore contains no historical references');
  for (let page = 0; page < 100; page++) {
    if (!(await models.projectResourceMigration.discover())) break;
    assert(page < 99, 'Discovery exceeded the restore fixture limit');
  }
  // Stop after one batch item, then rediscover and resume through the same worker.
  const initial = await models.projectResourceMigration.queued();
  if (initial[0]) await worker.migrate(initial[0].id);
  await models.projectResourceMigration.discover();
  for (let page = 0; page < 100; page++) {
    const rows = await models.projectResourceMigration.queued();
    if (!rows.length) break;
    for (const row of rows) await worker.migrate(row.id);
    assert(page < 99, 'Backfill exceeded the restore fixture limit');
  }
  const rows = await db.projectResourceMigration.findMany({
    orderBy: { id: 'asc' },
  });
  const counts: Record<string, number> = {};
  let attachments = 0;
  for (const row of rows) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    if (row.status !== 'complete') {
      assert.equal(row.resourceId, null);
      assert(
        ['waiting_for_authorization', 'failed', 'cancelled'].includes(
          row.status
        )
      );
      continue;
    }
    assert(row.actorId && row.resourceId);
    const actor = {
      projectId: row.projectId,
      actorId: row.actorId,
      resourceId: row.resourceId,
    };
    const resource = await models.projectResource.get(actor);
    const evidence = row.evidence as {
      source: { sourceFingerprint: string; attachmentCount: number };
      importEventId: string;
    };
    assert(
      await db.projectResourceAuditEvent.findUnique({
        where: { id: evidence.importEventId },
      })
    );
    if (resource.officeArtifactId) {
      const native = module.get(OfficeArtifactService);
      const revision = await models.officeArtifact.getCurrentRevision(
        { projectId: row.projectId },
        resource.id
      );
      const saved = await native.readRevisionAsset(
        { projectId: row.projectId },
        row.actorId,
        resource.id,
        revision!.id,
        'package'
      );
      assert.equal(hash(saved.bytes), evidence.source.sourceFingerprint);
    } else {
      const source = await module
        .get(DocReader)
        .getDoc(row.sourceWorkspaceId, row.sourceResourceId);
      assert(source);
      assert.equal(hash(source.bin), evidence.source.sourceFingerprint);
      const revision = await models.projectResource.revision(actor);
      const saved = await module
        .get(ProjectBlobStorage)
        .read({ ...actor, key: revision.blobKey });
      assert.equal(hash(saved.bytes), revision.fingerprint);
      const inspected = inspectDocumentCopySnapshot(source.bin);
      assert.equal(inspected.blobIds.length, evidence.source.attachmentCount);
      const attached = await db.projectResourceAttachment.findMany({
        where: { revisionId: revision.id },
      });
      for (const item of attached) {
        const blob = await module
          .get(ProjectBlobStorage)
          .read({ ...actor, key: item.key });
        assert.equal(hash(blob.bytes), blob.blob.fingerprint);
      }
      attachments += attached.length;
    }
    await worker.migrate(row.id);
  }
  assert.deepEqual(
    await db.projectResourceMigration.findMany({ orderBy: { id: 'asc' } }),
    rows,
    'Completed requests changed during replay'
  );
  assert.deepEqual(
    await workspaceEvidence(),
    before,
    'Backfill modified Workspace data'
  );
  const legacy = module.get(ProjectLegacyResolver);
  for (const operation of originalOperations) {
    const user = await models.user.get(operation.actorId);
    if (!user || !operation.projectId) continue;
    try {
      const row = await models.copilotDocumentOperation.legacyProjectOperation({
        projectId: operation.projectId,
        actorId: operation.actorId,
        operationId: operation.id,
      });
      if (row.projectMigrationStatus === 'pending')
        await legacy.changeProjectLegacyOperation(
          user,
          operation.projectId,
          operation.id,
          row.projectMigrationRevision,
          'recover'
        );
    } catch {
      const row = await db.copilotDocumentOperation.findUniqueOrThrow({
        where: { id: operation.id },
      });
      assert(
        ['pending', 'blocked', 'cancelled'].includes(
          row.projectMigrationStatus!
        )
      );
    }
  }
  assert.deepEqual(
    await db.copilotDocumentOperation.findMany({
      where: { projectId: { not: null } },
      select: {
        id: true,
        actorId: true,
        projectId: true,
        title: true,
        markdown: true,
        contentFingerprint: true,
        status: true,
        documentId: true,
        createdDocumentAt: true,
      },
      orderBy: { id: 'asc' },
    }),
    originalOperations,
    'Historical operation identity or original result changed'
  );
  assert.deepEqual(
    await workspaceEvidence(),
    before,
    'Legacy recovery modified Workspace data'
  );
  const legacyStates = await db.copilotDocumentOperation.groupBy({
    by: ['projectMigrationStatus'],
    where: { projectId: { not: null } },
    _count: true,
  });
  console.log(
    JSON.stringify({
      referenceCount,
      discovered: rows.length,
      counts,
      verifiedAttachments: attachments,
      workspaceDataUnchanged: true,
      replayUnchanged: true,
      legacyStates,
    })
  );
} finally {
  await module.close();
}
