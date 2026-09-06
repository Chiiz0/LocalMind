import assert from 'node:assert/strict';

import { PrismaClient } from '@prisma/client';

assert.equal(
  new URL(process.env.DATABASE_URL ?? '').pathname,
  '/localmind_project_ai_stage2_upgrade_20260906'
);
const mode = process.argv.at(-1);
assert.ok(mode === 'seed' || mode === 'verify');
const db = new PrismaClient();
const id = 'stage2-audience-upgrade-audit';
try {
  if (mode === 'seed') {
    await db.$executeRaw`
      INSERT INTO ai_shared_write_source_checks(id, session_id, actor_id, sink_type, sink_id,
        phase, allowed, reason_code, source_fingerprint, sources)
      VALUES (${id}, 'stage2-source-upgrade-empty', 'isolated-audit-actor', 'document_update', 'isolated-audit-sink',
        'execute', false, 'unshared_source', ${'a'.repeat(64)}, '[{"kind":"unknown","sourceId":"retained-legacy"}]'::jsonb)
    `;
    console.log(
      'Seeded a retained 334-migration source audit before audience migration.'
    );
  } else {
    const audit = await db.aiSharedWriteSourceCheck.findUniqueOrThrow({
      where: { id },
    });
    assert.deepEqual(audit.audienceEvidence, {});
    assert.equal(audit.allowed, false);
    assert.deepEqual(audit.sources, [
      { kind: 'unknown', sourceId: 'retained-legacy' },
    ]);
    await assert.rejects(
      db.aiSharedWriteSourceCheck.update({
        where: { id },
        data: { audienceEvidence: { rewritten: true } },
      })
    );
    await assert.rejects(
      db.aiSharedWriteSourceCheck.create({
        data: {
          id: `${id}-invalid`,
          sessionId: audit.sessionId,
          actorId: audit.actorId,
          sinkType: 'document_update',
          sinkId: audit.sinkId,
          phase: 'execute',
          allowed: false,
          reasonCode: 'unshared_source',
          sourceFingerprint: audit.sourceFingerprint,
          sources: [],
          audienceEvidence: { oversized: 'a'.repeat(1048576) },
        },
      })
    );
    const ready = await db.copilotDocumentOperation.findUniqueOrThrow({
      where: { id: 'stage2-location-upgrade-ready' },
    });
    assert.equal(ready.markdown, 'Retained upgrade content');
    assert.equal(ready.destinationRevision, 2);
    const indexes = await db.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE indexname = 'copilot_document_operations_location_expiration_idx'
    `;
    assert.equal(indexes.length, 1);
    console.log(
      'Verified 334-to-335 upgrade: retained legacy audit/content, immutable bounded audience evidence and location expiration index.'
    );
  }
} finally {
  await db.$disconnect();
}
