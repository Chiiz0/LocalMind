import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

assert.match(
  new URL(process.env.DATABASE_URL ?? '').pathname,
  /^\/localmind_project_ai_stage2_[a-z0-9_]+$/
);
const mode = process.argv.at(-1);
assert.ok(mode === 'seed' || mode === 'verify');
const db = new PrismaClient();
const prefix = 'stage2-source-upgrade';
try {
  if (mode === 'seed') {
    const user = await db.user.create({
      data: {
        email: `${prefix}@localmind.test`,
        name: 'Stage 2 source upgrade',
      },
    });
    await db.aiPrompt.create({
      data: { name: prefix, model: 'test', action: null },
    });
    for (const suffix of ['history', 'empty']) {
      const session = await db.aiSession.create({
        data: {
          id: `${prefix}-${suffix}`,
          userId: user.id,
          workspaceId: prefix,
          promptName: prefix,
        },
      });
      if (suffix === 'history')
        await db.aiSessionMessage.create({
          data: {
            sessionId: session.id,
            role: 'user',
            content: 'Isolated legacy source fixture.',
          },
        });
    }
    console.log(
      'Seeded historical and empty sessions before stage 2 migration.'
    );
  } else {
    for (const suffix of ['history', 'empty']) {
      assert.equal(
        await db.aiSessionContextSource.count({
          where: {
            sessionId: `${prefix}-${suffix}`,
            kind: 'unknown',
            sourceId: 'legacy-input-lineage',
          },
        }),
        1
      );
    }
    const session = await db.aiSession.findUniqueOrThrow({
      where: { id: `${prefix}-empty` },
    });
    const fresh = await db.aiSession.create({
      data: {
        userId: session.userId,
        workspaceId: prefix,
        promptName: prefix,
      },
    });
    await db.$executeRaw`
      INSERT INTO ai_session_context_sources(session_id, workspace_id, kind, source_id)
      SELECT ${fresh.id}, ${prefix}, 'unknown', 'unknown-' || source FROM generate_series(1, 4096) source
    `;
    await db.aiSessionContextSource.createMany({
      data: [
        {
          sessionId: fresh.id,
          workspaceId: prefix,
          kind: 'unknown',
          sourceId: 'unknown-1',
        },
      ],
      skipDuplicates: true,
    });
    assert.equal(
      await db.aiSessionContextSource.count({ where: { sessionId: fresh.id } }),
      4096
    );
    await db.aiSessionContextSource.createMany({
      data: [
        {
          sessionId: fresh.id,
          workspaceId: prefix,
          kind: 'unknown',
          sourceId: 'overflow',
        },
      ],
      skipDuplicates: true,
    });
    assert.equal(
      await db.aiSessionContextSource.count({ where: { sessionId: fresh.id } }),
      4097
    );
    assert.equal(
      await db.aiSessionContextSource.count({
        where: {
          sessionId: fresh.id,
          sourceId: 'source-budget-exceeded',
        },
      }),
      1
    );
    const message = await db.aiSessionMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: 'Private input.',
        attachments: [{ id: 'isolated-private' }],
      },
    });
    await db.aiSessionMessage.update({
      where: { id: message.id },
      data: { attachments: [], content: 'Rewritten' },
    });
    assert.equal(
      await db.aiSessionContextSource.count({
        where: {
          sessionId: session.id,
          sourceId: `rewritten-message:${message.id}`,
          kind: 'unknown',
        },
      }),
      1
    );
    assert.equal(
      await db.aiSessionContextSource.count({
        where: {
          sessionId: session.id,
          kind: 'private_attachment',
        },
      }),
      1
    );
    const audit = await db.aiSharedWriteSourceCheck.create({
      data: {
        id: randomUUID(),
        sessionId: session.id,
        actorId: session.userId,
        sinkType: 'document_update',
        sinkId: 'isolated',
        phase: 'execute',
        allowed: false,
        reasonCode: 'unshared_source',
        sourceFingerprint: '0'.repeat(64),
        sources: [],
      },
    });
    await assert.rejects(
      db.aiSharedWriteSourceCheck.update({
        where: { id: audit.id },
        data: { allowed: true },
      })
    );
    await assert.rejects(
      db.aiSharedWriteSourceCheck.delete({ where: { id: audit.id } })
    );
    await assert.rejects(
      db.aiSessionContextSource.updateMany({
        where: { sessionId: fresh.id },
        data: { evidence: { forged: true } },
      })
    );
    console.log(
      'Verified conservative upgrade, bounded unknown evidence, immutable history and audit. Fixtures retained.'
    );
  }
} finally {
  await db.$disconnect();
}
