import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { PrismaClient } from '@prisma/client';
import test from 'ava';
import * as Y from 'yjs';

import type { CurrentUser } from '../../core/auth/session';
import { WorkspaceDirectoryResolver } from '../../core/doc/directory-resolver';
import { DocumentDestinationService } from '../../core/doc/document-destination';
import { WorkspaceOrganizationService } from '../../core/doc/workspace-organization';
import { PermissionAccess } from '../../core/permission';
import { Models } from '../../models';
import { createTestingModule } from '../utils';

const allowed = {
  canRead: true,
  canWrite: true,
  canOrganize: true,
  canCreateFolder: true,
};

test.serial(
  'isolated 10000-row directory pagination, policy drift and scale evidence',
  async t => {
    t.timeout(600_000);
    assert.match(
      new URL(process.env.DATABASE_URL ?? '').pathname,
      /^\/localmind_project_ai_scale_[a-z0-9_]+$/
    );
    // Never reset a database here: benchmark fixtures remain available for inspection.
    await using module = await createTestingModule({}, false);
    await module.init();
    const models = module.get(Models);
    const db = module.get(PrismaClient);
    const ac = module.get(PermissionAccess);
    const organization = module.get(WorkspaceOrganizationService);
    const resolver = module.get(WorkspaceDirectoryResolver);
    const owner = await models.user.create({
      email: `directory-scale-${randomUUID()}@example.invalid`,
    });
    const workspace = await models.workspace.create(owner.id);
    const workspaceId = workspace.id;
    const actor = {
      ...owner,
      hasPassword: false,
      emailVerified: false,
    } as CurrentUser;
    await db.effectiveWorkspaceQuotaState.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        ownerUserId: owner.id,
        plan: 'free',
        seatLimit: 100,
        blobLimit: 0,
        storageQuota: 0,
        historyPeriodSeconds: 0,
        known: true,
        stale: false,
      },
      update: {},
    });
    const doc = new Y.Doc();
    const rows = Array.from({ length: 10_000 }, (_, index) => ({
      id: `row-${String(index).padStart(5, '0')}`,
      type: index < 9000 ? 'folder' : 'doc',
      data: index < 9000 ? `Directory ${index}` : `document-${index}`,
      parentId:
        index > 0 && index < 64
          ? `row-${String(index - 1).padStart(5, '0')}`
          : null,
      index: 'a0',
    }));
    for (const row of rows) {
      const record = doc.getMap(row.id);
      for (const [key, value] of Object.entries(row)) record.set(key, value);
    }
    const blob = Y.encodeStateAsUpdate(doc);
    await db.snapshot.create({
      data: {
        workspaceId,
        id: `db$${workspaceId}$folders`,
        blob,
        size: blob.byteLength,
        updatedAt: new Date(),
        createdBy: owner.id,
      },
    });
    doc.destroy();
    await db.workspaceDirectoryGrant.createMany({
      data: rows
        .filter(row => row.type === 'folder')
        .map(row => ({
          workspaceId,
          directoryId: row.id,
          principalId: '*',
          ...allowed,
        })),
    });
    let calls = 0;
    db.$use(async (params, next) => {
      calls++;
      return next(params);
    });
    const measurements: Record<string, unknown>[] = [];
    async function measure<T>(name: string, run: () => Promise<T>) {
      const initialCalls = calls;
      const start = performance.now();
      const heapStart = process.memoryUsage().heapUsed;
      let peakRss = process.memoryUsage().rss;
      const timer = setInterval(() => {
        peakRss = Math.max(peakRss, process.memoryUsage().rss);
      }, 10);
      try {
        return await run();
      } finally {
        clearInterval(timer);
        measurements.push({
          name,
          milliseconds: Math.round((performance.now() - start) * 100) / 100,
          prismaCalls: calls - initialCalls,
          heapDeltaMiB:
            (process.memoryUsage().heapUsed - heapStart) / 1024 ** 2,
          peakRssMiB: Math.max(peakRss, process.memoryUsage().rss) / 1024 ** 2,
        });
      }
    }
    if (process.env.LOCALMIND_DIRECTORY_BASELINE === '1') {
      await measure('legacy-per-row-authorization-and-revision', async () => {
        // Reproduce the pre-optimization two permission passes against this same
        // immutable fixture. The benchmark does not publish or change any policy.
        const byId = new Map(rows.map(row => [row.id, row]));
        const checked = new Set<string>();
        for (let pass = 0; pass < 2; pass++) {
          for (const row of rows) {
            if (pass === 1 && row.type === 'doc')
              await ac
                .user(owner.id)
                .doc(workspaceId, row.data)
                .projectScope(null)
                .can('Doc.Read');
            const path: string[] = [];
            let current: typeof row | undefined = row;
            while (current) {
              if (current.type === 'folder') path.push(current.id);
              current = current.parentId
                ? byId.get(current.parentId)
                : undefined;
            }
            const key = JSON.stringify(path);
            if (pass === 0 && checked.has(key)) continue;
            checked.add(key);
            await models.workspaceDirectoryGrant.rights({
              workspaceId,
              actorId: owner.id,
              directoryIds: path,
            });
          }
        }
        await organization.directoryRevision(workspaceId, owner.id);
      });
    }
    const first = await measure('optimized-first-page', () =>
      resolver.workspaceDirectory(actor, workspaceId)
    );
    t.is(first.items.length, 100);
    t.is(first.revision, createHash('sha256').update(blob).digest('hex'));
    t.is(
      first.items.find(item => item.id === 'row-00063')?.rights.canRead,
      true
    );
    const firstCost = measurements.at(-1);
    t.true(Number(firstCost?.prismaCalls) < 100);
    const destinations = module.get(DocumentDestinationService);
    const locationPage = await measure('destination-picker-page', () =>
      destinations.folders({
        actorId: owner.id,
        workspaceId,
      })
    );
    t.is(locationPage.items.length, 100);
    t.is(
      locationPage.items.find(item => item.folderId === 'row-00063')?.path
        .length,
      64
    );
    t.true(Number(measurements.at(-1)?.prismaCalls) < 30);
    await measure('optimized-all-pages', async () => {
      const ids = new Set(first.items.map(item => item.id));
      let cursor = first.nextCursor;
      let pages = 1;
      while (cursor) {
        const page = await resolver.workspaceDirectory(
          actor,
          workspaceId,
          cursor
        );
        t.is(page.revision, first.revision);
        t.is(page.authorizationRevision, first.authorizationRevision);
        for (const item of page.items) {
          t.false(ids.has(item.id));
          ids.add(item.id);
        }
        cursor = page.nextCursor;
        assert.ok(++pages <= 101);
      }
      t.is(ids.size, 10_000);
      measurements.push({ name: 'pagination', pages, rows: ids.size });
    });
    const before = await measure('administration-read', () =>
      resolver.workspaceDirectoryAdministration(actor, workspaceId)
    );
    const results = await measure('concurrent-policy-change', () =>
      Promise.allSettled(
        [false, true].map(canRead =>
          resolver.changeWorkspaceDirectoryPolicy(
            actor,
            workspaceId,
            before.revision,
            'row-00000',
            '*',
            { ...allowed, canRead, canWrite: false }
          )
        )
      )
    );
    t.is(results.filter(result => result.status === 'fulfilled').length, 1);
    t.is(results.filter(result => result.status === 'rejected').length, 1);
    // Direct model administration emits no realtime event. A subsequent page
    // must still revoke access with the unchanged content revision.
    await models.workspaceDirectoryGrant.set({
      workspaceId,
      actorId: owner.id,
      directoryId: 'row-00000',
      principalId: '*',
      rights: { ...allowed, canRead: false },
    });
    const revoked = await measure('policy-change-without-realtime', () =>
      resolver.workspaceDirectory(actor, workspaceId)
    );
    t.is(revoked.revision, first.revision);
    t.not(revoked.authorizationRevision, first.authorizationRevision);
    t.false(revoked.fullSyncAllowed);
    t.false(revoked.items.some(item => item.id <= 'row-00063'));
    const revokedLocations = await destinations.folders({
      actorId: owner.id,
      workspaceId,
    });
    t.false(revokedLocations.items.some(item => item.folderId! <= 'row-00063'));
    const plan = await db.$queryRaw`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT directory_id, principal_id, can_read, can_write, can_organize, can_create_folder
    FROM workspace_directory_grants
    WHERE workspace_id = ${workspaceId} AND principal_id IN ('*', ${owner.id})
    LIMIT 20003
  `;
    console.log(
      JSON.stringify({
        fixture: {
          workspaceId,
          rows: 10000,
          policies: 9000,
          depth: 64,
          snapshotBytes: blob.byteLength,
        },
        measurements,
        policyQueryPlan: plan,
      })
    );
  }
);
