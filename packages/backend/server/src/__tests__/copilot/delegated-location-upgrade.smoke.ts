import assert from 'node:assert/strict';

import { PrismaClient } from '@prisma/client';

assert.equal(
  new URL(process.env.DATABASE_URL ?? '').pathname,
  '/localmind_project_ai_stage2_upgrade_20260906'
);
const mode = process.argv.at(-1);
assert.ok(mode === 'seed' || mode === 'verify');
const db = new PrismaClient();
const prefix = 'stage2-location-upgrade';
try {
  const session = await db.aiSession.findUniqueOrThrow({
    where: { id: 'stage2-source-upgrade-empty' },
  });
  if (mode === 'seed') {
    for (const state of ['waiting_location', 'ready']) {
      const id = `${prefix}-${state}`;
      const confirmed = state === 'ready';
      await db.$executeRaw`
        INSERT INTO copilot_document_operations(id, session_id, actor_id, request_key, content_fingerprint,
          title, markdown, document_id, status, destination_workspace_id, destination_revision,
          destination_confirmed_at, destination_fingerprint, updated_at)
        VALUES (${id}, ${session.id}, ${session.userId}, ${id}, ${'a'.repeat(64)}, 'Isolated upgrade draft',
          'Retained upgrade content', ${id}, ${state}, ${confirmed ? session.workspaceId : null},
          ${confirmed ? 1 : 0}, ${confirmed ? new Date() : null}, ${confirmed ? 'b'.repeat(64) : null}, now())
      `;
    }
    console.log(
      'Seeded unconfirmed and previously confirmed operations before location migrations.'
    );
  } else {
    const waiting = await db.copilotDocumentOperation.findUniqueOrThrow({
      where: { id: `${prefix}-waiting_location` },
    });
    const ready = await db.copilotDocumentOperation.findUniqueOrThrow({
      where: { id: `${prefix}-ready` },
    });
    assert.equal(waiting.destinationConfirmedBy, null);
    assert.equal(ready.destinationConfirmedBy, session.userId);
    assert.deepEqual(ready.destinationEvidence, {});
    assert.equal(ready.status, 'ready');
    assert.equal(ready.markdown, 'Retained upgrade content');
    assert.equal(waiting.createdDocumentAt, null);
    assert.equal(ready.createdDocumentAt, null);
    assert.ok(ready.locationExpiresAt > ready.createdAt);
    await assert.rejects(
      db.copilotDocumentOperation.update({
        where: { id: ready.id },
        data: { destinationConfirmedBy: null },
      })
    );
    await assert.rejects(
      db.copilotDocumentOperation.update({
        where: { id: ready.id },
        data: { destinationRevision: 2 },
      })
    );
    const evidence = {
      actorId: session.userId,
      workspaceId: session.workspaceId,
      canCreateDoc: true,
      canReadOrganization: true,
      canSync: true,
      canRead: true,
      canWrite: true,
      canOrganize: true,
    };
    await db.copilotDocumentOperation.update({
      where: { id: ready.id },
      data: {
        destinationRevision: 2,
        destinationEvidence: evidence,
        destinationConfirmedAt: new Date(),
        locationExpiresAt: new Date(Date.now() + 86400000),
      },
    });
    assert.equal(
      await db.copilotDocumentOperationEvent.count({
        where: {
          operationId: ready.id,
          eventType: 'location_permission_confirmed',
        },
      }),
      1
    );
    assert.equal(
      await db.aiSessionContextSource.count({
        where: {
          sessionId: session.id,
          kind: 'unknown',
          sourceId: 'legacy-input-lineage',
        },
      }),
      1
    );
    console.log(
      'Verified 332-to-334 upgrade, retained content and lineage, conservative legacy evidence, immutable confirmation actor and revision audit.'
    );
  }
} finally {
  await db.$disconnect();
}
