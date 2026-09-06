import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

const database = new URL(process.env.DATABASE_URL ?? '').pathname;
assert.match(database, /^\/localmind_project_ai_sources_upgrade_[a-z0-9_]+$/);
const mode = process.argv.at(-1);
assert.ok(mode === 'seed' || mode === 'verify');
const db = new PrismaClient();
const sessionId = 'context-source-upgrade-session';
const workspaceId = 'context-source-upgrade-workspace';
const emptyConfig = {
  workspaceId,
  files: [],
  blobs: [],
  docs: [],
  categories: [],
};

try {
  if (mode === 'seed') {
    await db.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          email: 'context-source-upgrade@localmind.test',
          name: 'Source upgrade fixture',
        },
      });
      await tx.aiPrompt.create({
        data: { name: 'context-source-upgrade', model: 'test', action: null },
      });
      await tx.aiSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          workspaceId,
          promptName: 'context-source-upgrade',
        },
      });
      await tx.aiSession.create({
        data: {
          id: `${sessionId}-empty`,
          userId: user.id,
          workspaceId,
          promptName: 'context-source-upgrade',
        },
      });
      await tx.aiContext.create({
        data: {
          sessionId,
          config: {
            ...emptyConfig,
            docs: [{ id: 'historical-document', createdAt: 1 }],
            blobs: [{ id: 'historical-private-attachment', createdAt: 1 }],
          },
        },
      });
      await tx.aiSessionMessage.create({
        data: {
          id: randomUUID(),
          sessionId,
          role: 'user',
          content: 'Isolated historical attachment fixture.',
        },
      });
    });
    console.log('Legacy source fixture created before provenance migration.');
  } else {
    const sources = await db.aiSessionContextSource.findMany({
      where: { sessionId },
    });
    assert.deepEqual(
      new Set(sources.map(source => source.kind)),
      new Set(['document', 'private_attachment', 'unknown'])
    );
    assert.ok(
      sources.some(
        source =>
          source.kind === 'unknown' && source.sourceId === 'legacy-history'
      )
    );
    assert.ok(
      sources.some(
        source =>
          source.kind === 'document' &&
          source.sourceId === 'historical-document' &&
          source.workspaceId === workspaceId
      )
    );
    assert.equal(
      await db.aiSessionContextSource.count({
        where: { sessionId: `${sessionId}-empty` },
      }),
      0
    );
    await db.aiContext.updateMany({
      where: { sessionId },
      data: { config: emptyConfig },
    });
    assert.equal(
      await db.aiSessionContextSource.count({ where: { sessionId } }),
      3
    );
    await assert.rejects(
      db.aiSessionContextSource.updateMany({
        where: { sessionId },
        data: { sourceId: 'rewritten' },
      })
    );
    await assert.rejects(
      db.aiSessionContextSource.deleteMany({ where: { sessionId } })
    );
    console.log(
      'Legacy provenance backfill and immutable removal evidence verified.'
    );
  }
} finally {
  await db.$disconnect();
}
