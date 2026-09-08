/** @vitest-environment happy-dom */
import {
  acquireProjectResourceEditLeaseMutation,
  projectAgentTaskQuery,
  projectResourceEditLeaseQuery,
  releaseProjectResourceEditLeaseMutation,
  renewProjectResourceEditLeaseMutation,
} from '@affine/graphql';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { ProjectEditLeaseStore } from './edit-lease-store';

const input = { projectId: 'project', resourceId: 'resource', tabId: 'tab' };
const held = (leaseId = 'lease') => ({
  ...input,
  kind: 'user',
  holderId: 'user',
  holderName: 'Editor',
  owned: true,
  leaseId,
  acquiredAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60000).toISOString(),
});
function fixture() {
  const gql = vi.fn(async ({ query }: { query: { id: string } }) => {
    if (query === acquireProjectResourceEditLeaseMutation)
      return {
        acquireProjectResourceEditLease: { acquired: true, lease: held() },
      };
    if (query === renewProjectResourceEditLeaseMutation)
      return {
        renewProjectResourceEditLease: { acquired: true, lease: held() },
      };
    if (query === projectResourceEditLeaseQuery)
      return { projectResourceEditLease: held() };
    if (query === releaseProjectResourceEditLeaseMutation)
      return { releaseProjectResourceEditLease: true };
    throw new Error('Unexpected operation');
  });
  const store = new ProjectEditLeaseStore({ gql: gql as never }, input);
  return { store, gql };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('duplicate mounts and a short write share authority until the last consumer leaves', async () => {
  const { store, gql } = fixture();
  const first = store.retain();
  const second = store.retain();
  await store.acquire();
  const operation = vi.fn(async proof => proof);
  await store.withProof(operation);
  expect(operation).toHaveBeenCalledWith({ tabId: 'tab', leaseId: 'lease' });
  await first();
  expect(
    gql.mock.calls.filter(
      ([request]) => request.query === releaseProjectResourceEditLeaseMutation
    )
  ).toHaveLength(0);
  expect(store.snapshot().proof).not.toBeNull();
  await second();
  expect(
    gql.mock.calls.filter(
      ([request]) => request.query === acquireProjectResourceEditLeaseMutation
    )
  ).toHaveLength(1);
  expect(
    gql.mock.calls.filter(
      ([request]) => request.query === releaseProjectResourceEditLeaseMutation
    )
  ).toHaveLength(1);
});

test('a late acquisition is released after unmount and never grants write access', async () => {
  const { store, gql } = fixture();
  let resolve!: (value: never) => void;
  gql.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      })
  );
  const leave = store.retain();
  await Promise.resolve();
  const released = leave();
  resolve({
    acquireProjectResourceEditLease: { acquired: true, lease: held('late') },
  } as never);
  await released;
  expect(store.snapshot().proof).toBeNull();
  expect(gql).toHaveBeenLastCalledWith(
    expect.objectContaining({
      query: releaseProjectResourceEditLeaseMutation,
      variables: { input: { ...input, leaseId: 'late' } },
    })
  );
});

test('pagehide releases and pageshow acquires again without remounting', async () => {
  const { store, gql } = fixture();
  const leave = store.retain();
  await store.acquire();
  window.dispatchEvent(new Event('pagehide'));
  expect(store.snapshot().proof).toBeNull();
  await vi.advanceTimersByTimeAsync(0);
  window.dispatchEvent(new Event('pageshow'));
  await store.acquire();
  expect(store.snapshot().proof).not.toBeNull();
  expect(
    gql.mock.calls.filter(
      ([request]) => request.query === acquireProjectResourceEditLeaseMutation
    )
  ).toHaveLength(2);
  await leave();
});

test('two renewal failures revoke proof and snapshots cannot silently restore it', async () => {
  const { store, gql } = fixture();
  const leave = store.retain();
  await store.acquire();
  gql.mockRejectedValueOnce(new Error('offline'));
  await vi.advanceTimersByTimeAsync(20000);
  expect(store.snapshot().proof).not.toBeNull();
  gql.mockRejectedValueOnce(new Error('offline'));
  await vi.advanceTimersByTimeAsync(20000);
  expect(store.snapshot().proof).toBeNull();
  await store.refresh();
  expect(store.snapshot().proof).toBeNull();
  await store.renew();
  expect(store.snapshot().proof).not.toBeNull();
  await leave();
});

test('a competing editor prevents the short operation from executing', async () => {
  const { store, gql } = fixture();
  gql.mockImplementation(
    async () =>
      ({
        acquireProjectResourceEditLease: {
          acquired: false,
          lease: { ...held(), owned: false, leaseId: null },
        },
      }) as never
  );
  const operation = vi.fn();
  await expect(store.withProof(operation)).rejects.toThrow('unavailable');
  expect(operation).not.toHaveBeenCalled();
  expect(
    gql.mock.calls.some(
      ([request]) => request.query === releaseProjectResourceEditLeaseMutation
    )
  ).toBe(false);
});

test('15 second snapshots never postpone the 20 second renewal deadline', async () => {
  const { store, gql } = fixture();
  const leave = store.retain();
  await store.acquire();
  for (let index = 0; index < 4; index++) {
    await vi.advanceTimersByTimeAsync(15000);
    await store.refresh();
  }
  expect(
    gql.mock.calls.filter(
      ([request]) => request.query === renewProjectResourceEditLeaseMutation
    )
  ).toHaveLength(3);
  expect(store.snapshot().proof).not.toBeNull();
  await leave();
});

test('handoff stops renewal and competing acquisitions until the exact AI task completes', async () => {
  const { store, gql } = fixture();
  const leave = store.retain();
  await store.acquire();
  const original = gql.getMockImplementation()!;
  let status = 'queued';
  gql.mockImplementation(async request => {
    if (request.query === projectAgentTaskQuery)
      return {
        projectAgentTask: { id: 'task', projectId: 'project', status },
      } as never;
    if (request.query === projectResourceEditLeaseQuery)
      return { projectResourceEditLease: null } as never;
    return original(request);
  });
  expect(await store.handoff('task')).toBe(true);
  expect(store.snapshot().proof).toBeNull();
  await store.acquire();
  await vi.advanceTimersByTimeAsync(60000);
  expect(
    gql.mock.calls.filter(
      ([r]) => r.query === renewProjectResourceEditLeaseMutation
    )
  ).toHaveLength(0);
  await store.trackHandoff('task');
  expect(store.snapshot().proof).toBeNull();
  status = 'running';
  await store.refresh();
  expect(store.snapshot().proof).toBeNull();
  status = 'completed';
  await store.refresh();
  expect(store.snapshot().handoff).toBeNull();
  expect(store.snapshot().proof).not.toBeNull();
  expect(
    gql.mock.calls.filter(
      ([r]) => r.query === acquireProjectResourceEditLeaseMutation
    )
  ).toHaveLength(2);
  await leave();
});

test.each(['failed', 'cancelled', 'waiting_approval'])(
  'handoff recovers after %s without assuming a successful approval response',
  async status => {
    const { store, gql } = fixture();
    const leave = store.retain();
    await store.acquire();
    await store.handoff('task');
    gql.mockResolvedValueOnce({
      projectAgentTask: { id: 'task', projectId: 'project', status },
    } as never);
    await store.trackHandoff('task');
    expect(store.snapshot().handoff).toBeNull();
    expect(store.snapshot().proof).not.toBeNull();
    await leave();
  }
);

test('failed release and late unsaved changes never proceed with a handoff', async () => {
  const { store, gql } = fixture();
  const leave = store.retain();
  await store.acquire();
  await expect(store.handoff('task', () => false)).rejects.toThrow('unsaved');
  expect(store.snapshot().proof).not.toBeNull();
  gql.mockRejectedValueOnce(new Error('offline'));
  await expect(store.handoff('task')).rejects.toThrow('offline');
  expect(store.snapshot().handoff).toBeNull();
  expect(store.snapshot().proof).not.toBeNull();
  await leave();
});

test('lost task status response keeps the editor read-only, including across pageshow', async () => {
  const { store, gql } = fixture();
  const leave = store.retain();
  await store.acquire();
  await store.handoff('task');
  gql.mockRejectedValueOnce(new Error('offline'));
  await expect(store.trackHandoff('task')).rejects.toThrow('offline');
  expect(store.snapshot().handoff?.submitted).toBe(true);
  expect(store.snapshot().proof).toBeNull();
  window.dispatchEvent(new Event('pagehide'));
  await vi.advanceTimersByTimeAsync(0);
  gql.mockResolvedValueOnce({
    projectAgentTask: { id: 'task', projectId: 'project', status: 'running' },
  } as never);
  window.dispatchEvent(new Event('pageshow'));
  await vi.advanceTimersByTimeAsync(0);
  expect(store.snapshot().proof).toBeNull();
  expect(
    gql.mock.calls.filter(
      ([r]) => r.query === acquireProjectResourceEditLeaseMutation
    )
  ).toHaveLength(1);
  await leave();
});

test('an uncertain approval cannot restore editing from an unchanged pending snapshot', async () => {
  const { store, gql } = fixture();
  const leave = store.retain();
  await store.acquire();
  await store.handoff('task');
  const original = gql.getMockImplementation()!;
  gql.mockImplementation(async request => {
    if (request.query === projectAgentTaskQuery)
      return {
        projectAgentTask: {
          id: 'task',
          projectId: 'project',
          status: 'waiting_approval',
        },
      } as never;
    if (request.query === projectResourceEditLeaseQuery)
      return { projectResourceEditLease: null } as never;
    return original(request);
  });
  await store.trackHandoff('task', true);
  await store.refresh();
  expect(store.snapshot().handoff?.uncertain).toBe(true);
  expect(store.snapshot().proof).toBeNull();
  expect(
    gql.mock.calls.filter(
      ([r]) => r.query === acquireProjectResourceEditLeaseMutation
    )
  ).toHaveLength(1);
  await leave();
});
