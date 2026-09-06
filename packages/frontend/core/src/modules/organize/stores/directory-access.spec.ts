import { Framework, LiveData } from '@toeverything/infra';
import { Subject } from 'rxjs';
import { afterEach, expect, test, vi } from 'vitest';

import type { WorkspaceServerService } from '../../cloud';
import type { NbstoreService } from '../../storage';
import type { WorkspaceService } from '../../workspace';
import { DirectoryAccessStore } from './directory-access';

const rights = {
  canRead: true,
  canWrite: true,
  canOrganize: true,
  canCreateFolder: true,
};
const page = (id: string, nextCursor: string | null = null) => ({
  workspaceDirectory: {
    revision: 'a'.repeat(64),
    authorizationRevision: 'b'.repeat(64),
    fullSyncAllowed: false,
    rootRights: rights,
    nextCursor,
    items: [
      { id, parentId: null, type: 'folder', data: id, index: 'a0', rights },
    ],
  },
});
const stores: DirectoryAccessStore[] = [];
afterEach(() => {
  stores.splice(0).forEach(store => store.dispose());
  vi.useRealTimers();
});
function fixture(
  gql = vi.fn().mockResolvedValue(page('visible')),
  flavour = 'affine-cloud'
) {
  const accessEvents$ = new Subject<{ changed: true; reason: string }>();
  const policyEvents$ = new Subject<{ changed: true; reason: string }>();
  const subscribeAccess = vi.fn((topic: string) =>
    topic === 'workspace.directory-policy.changed'
      ? policyEvents$
      : accessEvents$
  );
  const account$ = new LiveData<{ id: string } | null>({ id: 'actor' });
  const server$ = new LiveData({ account$, gql });
  const framework = new Framework();
  framework.store(
    DirectoryAccessStore,
    () =>
      new DirectoryAccessStore(
        {
          workspace: { id: 'workspace', flavour },
        } as unknown as WorkspaceService,
        {
          server$,
          get server() {
            return server$.value;
          },
        } as unknown as WorkspaceServerService,
        {
          realtime: { subscribe: subscribeAccess },
        } as unknown as NbstoreService
      )
  );
  const store = framework.provider().get(DirectoryAccessStore);
  stores.push(store);
  return {
    store,
    gql,
    account$,
    accessEvents$,
    policyEvents$,
    subscribeAccess,
  };
}

test('local workspaces retain local data without a network request', () => {
  const { store, gql } = fixture(vi.fn(), 'local');
  expect(store.state$.value.mode).toBe('local');
  expect(gql).not.toHaveBeenCalled();
});

test('restricted directory pages are published only after the complete load', async () => {
  const second = Promise.withResolvers<ReturnType<typeof page>>();
  const { store } = fixture(
    vi
      .fn()
      .mockResolvedValueOnce(page('one', 'one'))
      .mockReturnValueOnce(second.promise)
  );
  await vi.waitFor(() => expect(store.state$.value.mode).toBe('loading'));
  second.resolve(page('two'));
  await vi.waitFor(() =>
    expect(store.state$.value.items.map(item => item.id)).toEqual([
      'one',
      'two',
    ])
  );
  expect(store.state$.value.mode).toBe('filtered');
});

test('account changes discard a late response from the previous actor', async () => {
  const old = Promise.withResolvers<ReturnType<typeof page>>();
  const { store, account$ } = fixture(
    vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue(page('new-actor'))
  );
  account$.next({ id: 'new' });
  await vi.waitFor(() =>
    expect(store.state$.value.items[0]?.id).toBe('new-actor')
  );
  old.resolve(page('private-old-actor'));
  await Promise.resolve();
  expect(store.state$.value.items.map(item => item.id)).toEqual(['new-actor']);
});

test('access loss clears visible rows and retry can restore authorized data', async () => {
  const { store, gql } = fixture();
  await vi.waitFor(() => expect(store.state$.value.mode).toBe('filtered'));
  gql.mockRejectedValueOnce(new Error('Access revoked'));
  await store.refresh();
  expect(store.state$.value).toEqual({
    mode: 'error',
    items: [],
    error: 'Access revoked',
  });
  await store.refresh();
  expect(store.state$.value.mode).toBe('filtered');
});

test('pagination loops fail closed rather than publishing a partial tree', async () => {
  const { store } = fixture(vi.fn().mockResolvedValue(page('one', 'same')));
  await vi.waitFor(() => expect(store.state$.value.mode).toBe('error'));
  expect(store.state$.value.items).toEqual([]);
});

test('periodic revalidation does not repeatedly cancel a slow active request', async () => {
  vi.useFakeTimers();
  const pending = Promise.withResolvers<ReturnType<typeof page>>();
  const { store, gql } = fixture(vi.fn().mockReturnValue(pending.promise));
  await vi.advanceTimersByTimeAsync(30_000);
  expect(gql).toHaveBeenCalledTimes(1);
  pending.resolve(page('loaded'));
  await vi.advanceTimersByTimeAsync(0);
  expect(store.state$.value.mode).toBe('filtered');
});

test('directory writes use the loaded revision and refresh after server completion', async () => {
  const { store, gql } = fixture();
  await vi.waitFor(() => expect(store.state$.value.mode).toBe('filtered'));
  gql
    .mockResolvedValueOnce({
      mutateWorkspaceDirectory: { revision: 'b'.repeat(64) },
    })
    .mockResolvedValueOnce(page('after-write'));
  const changes = [
    {
      op: 'upsert',
      key: 'new',
      values: { type: 'folder', data: 'New', parentId: null, index: 'a0' },
    },
  ];
  await store.mutate(changes);
  expect(gql.mock.calls[1][0]).toMatchObject({
    variables: {
      workspaceId: 'workspace',
      expectedRevision: 'a'.repeat(64),
      changes,
    },
  });
  expect(store.state$.value.items[0]?.id).toBe('after-write');
  expect(store.saving$.value).toBe(false);
});

test('duplicate submissions cannot launch a second directory mutation', async () => {
  const { store, gql } = fixture();
  await vi.waitFor(() => expect(store.state$.value.mode).toBe('filtered'));
  const pending = Promise.withResolvers<{
    mutateWorkspaceDirectory: { revision: string };
  }>();
  gql.mockReturnValueOnce(pending.promise);
  const first = store.mutate([{ op: 'delete', key: 'visible' }]);
  await expect(
    store.mutate([{ op: 'delete', key: 'visible' }])
  ).rejects.toThrow(/already in progress/);
  expect(gql).toHaveBeenCalledTimes(2);
  pending.resolve({ mutateWorkspaceDirectory: { revision: 'b'.repeat(64) } });
  await first;
});

test('failed mutations propagate denial and reload current permissions', async () => {
  const { store, gql } = fixture();
  await vi.waitFor(() => expect(store.state$.value.mode).toBe('filtered'));
  gql
    .mockRejectedValueOnce(new Error('Write permission revoked'))
    .mockResolvedValueOnce(page('still-readable'));
  await expect(
    store.mutate([{ op: 'delete', key: 'visible' }])
  ).rejects.toThrow(/permission revoked/);
  expect(store.state$.value.items[0]?.id).toBe('still-readable');
  expect(store.saving$.value).toBe(false);
});

test('directory pages from different revisions never form a displayed snapshot', async () => {
  const second = page('two');
  second.workspaceDirectory.revision = 'b'.repeat(64);
  const { store } = fixture(
    vi
      .fn()
      .mockResolvedValueOnce(page('one', 'one'))
      .mockResolvedValueOnce(second)
  );
  await vi.waitFor(() => expect(store.state$.value.mode).toBe('error'));
  expect(store.state$.value.items).toEqual([]);
});

test('policy-only changes across pages never publish mixed authorization snapshots', async () => {
  const second = page('two');
  second.workspaceDirectory.authorizationRevision = 'c'.repeat(64);
  const { store } = fixture(
    vi
      .fn()
      .mockResolvedValueOnce(page('one', 'one'))
      .mockResolvedValueOnce(second)
  );
  await vi.waitFor(() => expect(store.state$.value.mode).toBe('error'));
  expect(store.state$.value.items).toEqual([]);
});

test('workspace access events clear old rows before revalidation completes', async () => {
  const { store, gql, accessEvents$, subscribeAccess, account$ } = fixture();
  await vi.waitFor(() => expect(store.state$.value.mode).toBe('filtered'));
  expect(subscribeAccess).toHaveBeenCalledWith('workspace.access.changed', {
    workspaceId: 'workspace',
  });
  const pending = Promise.withResolvers<ReturnType<typeof page>>();
  gql.mockReturnValueOnce(pending.promise);
  accessEvents$.next({ changed: true, reason: 'members-updated' });
  expect(store.state$.value.mode).toBe('loading');
  expect(store.state$.value.items).toEqual([]);
  pending.reject(new Error('Workspace membership revoked'));
  await vi.waitFor(() => expect(store.state$.value.mode).toBe('error'));
  account$.next(null);
  expect(accessEvents$.observed).toBe(false);
});

test('directory policy events clear old rows before revalidation completes', async () => {
  const { store, gql, policyEvents$, subscribeAccess } = fixture();
  await vi.waitFor(() => expect(store.state$.value.mode).toBe('filtered'));
  expect(subscribeAccess).toHaveBeenCalledWith(
    'workspace.directory-policy.changed',
    { workspaceId: 'workspace' }
  );
  const pending = Promise.withResolvers<ReturnType<typeof page>>();
  gql.mockReturnValueOnce(pending.promise);
  policyEvents$.next({ changed: true, reason: 'directory-policy-updated' });
  expect(store.state$.value.mode).toBe('loading');
  expect(store.state$.value.items).toEqual([]);
  pending.resolve(page('policy-filtered'));
  await vi.waitFor(() =>
    expect(store.state$.value.items[0]?.id).toBe('policy-filtered')
  );
});

test('same-account access refresh during a write preserves its real result', async () => {
  const { store, gql, accessEvents$ } = fixture();
  await vi.waitFor(() => expect(store.state$.value.mode).toBe('filtered'));
  const pending = Promise.withResolvers<{
    mutateWorkspaceDirectory: { revision: string };
  }>();
  gql.mockReturnValueOnce(pending.promise);
  const saving = store.mutate([{ op: 'delete', key: 'visible' }]);
  accessEvents$.next({ changed: true, reason: 'members-updated' });
  await vi.waitFor(() => expect(store.state$.value.mode).toBe('filtered'));
  pending.resolve({ mutateWorkspaceDirectory: { revision: 'new-revision' } });
  await expect(saving).resolves.toEqual({ revision: 'new-revision' });
  expect(store.saving$.value).toBe(false);
});
