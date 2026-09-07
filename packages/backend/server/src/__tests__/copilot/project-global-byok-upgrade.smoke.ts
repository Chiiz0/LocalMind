import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.PROJECT_BYOK_UPGRADE_DATABASE_URL;
assert(
  databaseUrl &&
    new URL(databaseUrl).pathname.startsWith(
      '/localmind_project_byok_upgrade_'
    ),
  'An isolated Project BYOK upgrade database is required.'
);
const serverRoot = resolve('packages/backend/server');
const fixtureRoot = mkdtempSync(resolve(tmpdir(), 'project-byok-upgrade-'));
cpSync(
  resolve(serverRoot, 'schema.prisma'),
  resolve(fixtureRoot, 'schema.prisma')
);
mkdirSync(resolve(fixtureRoot, 'migrations'));
const migrationEntries = readdirSync(resolve(serverRoot, 'migrations'));
for (const entry of migrationEntries) {
  if (
    entry !== 'migration_lock.toml' &&
    entry >= '20260906040000_project_global_byok'
  )
    continue;
  cpSync(
    resolve(serverRoot, 'migrations', entry),
    resolve(fixtureRoot, 'migrations', entry),
    { recursive: true }
  );
}
const migrate = (schema: string) =>
  execFileSync(
    'yarn',
    [
      'workspace',
      '@affine/server',
      'prisma',
      'migrate',
      'deploy',
      '--schema',
      schema,
    ],
    {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    }
  );
const db = new PrismaClient({ datasourceUrl: databaseUrl });
try {
  const existing = await db.$queryRaw<
    Array<{ name: string | null }>
  >`SELECT to_regclass('public._prisma_migrations')::text AS name`;
  assert.equal(
    existing[0].name,
    null,
    'Upgrade fixture must start with an empty database.'
  );
  migrate(resolve(fixtureRoot, 'schema.prisma'));
  const oldTable = await db.$queryRaw<
    Array<{ name: string | null }>
  >`SELECT to_regclass('public.ai_project_byok_config')::text AS name`;
  assert.equal(oldTable[0].name, null);
  const user = await db.user.create({
    data: { name: 'Upgrade fixture', email: `${randomUUID()}@example.test` },
  });
  const workspace = await db.workspace.create({ data: {} });
  const credential = await db.aiWorkspaceByokConfig.create({
    data: {
      workspaceId: workspace.id,
      provider: 'openai',
      name: 'Existing workspace credential',
      encryptedApiKey: 'synthetic-existing-ciphertext',
      modelId: 'existing-model',
    },
  });
  const project = await db.aiContextProject.create({
    data: {
      name: 'Existing Project',
      members: { create: { userId: user.id, role: 'owner' } },
    },
  });
  const prompt = await db.aiPrompt.create({
    data: { name: 'BYOK upgrade prompt', model: 'existing-model' },
  });
  const session = await db.aiSession.create({
    data: {
      userId: user.id,
      workspaceId: workspace.id,
      selectedContextProjectId: project.id,
      promptName: prompt.name,
    },
  });
  migrate(resolve(serverRoot, 'schema.prisma'));
  assert.deepEqual(
    await db.aiWorkspaceByokConfig.findUnique({ where: { id: credential.id } }),
    credential
  );
  assert.deepEqual(
    await db.aiSession.findUnique({ where: { id: session.id } }),
    session
  );
  assert.equal(await db.aiProjectByokConfig.count(), 0);
  assert.equal(await db.aiProjectByokAuditEvent.count(), 0);
  const migrations = await db.$queryRaw<
    Array<{ count: bigint }>
  >`SELECT count(*) AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  const currentMigrationCount = migrationEntries.filter(
    entry => entry !== 'migration_lock.toml'
  ).length;
  assert.equal(Number(migrations[0].count), currentMigrationCount);
  console.log(
    `335-to-${currentMigrationCount} upgrade passed; Workspace credentials and Project sessions preserved; global BYOK remains unconfigured.`
  );
} finally {
  await db.$disconnect();
}
