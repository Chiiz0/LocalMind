import { Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { ProjectRealtimeStore } from './realtime-store';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup() {
  const list$ = new Subject();
  const task$ = new Subject();
  const projects = new Map<string, Subject<unknown>>();
  const global = vi.fn((channel: 'list' | 'task') =>
    channel === 'list' ? list$ : task$
  );
  const project = vi.fn((id: string) => {
    let subject$ = projects.get(id);
    if (!subject$) projects.set(id, (subject$ = new Subject()));
    return subject$;
  });
  const onError = vi.fn();
  const store = new ProjectRealtimeStore({ global, project, onError });
  return { store, list$, task$, projects, global, project, onError };
}

test('shares subscriptions, isolates Project rooms and leaves the last room consumer', async () => {
  const { store, project, projects } = setup();
  const first = vi.fn();
  const second = vi.fn();
  const foreign = vi.fn();
  const stopFirst = store.subscribe('alpha', 'resource', first);
  const stopSecond = store.subscribe('alpha', 'resource', second);
  const stopForeign = store.subscribe('beta', 'resource', foreign);
  expect(project).toHaveBeenCalledTimes(2);
  projects.get('alpha')!.next({ changed: true });
  await vi.advanceTimersByTimeAsync(0);
  expect(first).toHaveBeenCalledOnce();
  expect(second).toHaveBeenCalledOnce();
  expect(foreign).not.toHaveBeenCalled();
  stopFirst();
  expect(projects.get('alpha')!.observed).toBe(true);
  stopSecond();
  expect(projects.get('alpha')!.observed).toBe(false);
  stopForeign();
  expect(vi.getTimerCount()).toBe(0);
});

test('a lost event converges to the current server snapshot at 15 seconds', async () => {
  const { store, task$ } = setup();
  let serverState = 'waiting_approval';
  let visibleState = serverState;
  const refresh = vi.fn(() => {
    visibleState = serverState;
  });
  const stop = store.subscribe('project', 'task', refresh);
  serverState = 'running';
  await vi.advanceTimersByTimeAsync(14999);
  expect(visibleState).toBe('waiting_approval');
  await vi.advanceTimersByTimeAsync(1);
  expect(visibleState).toBe('running');
  serverState = 'completed';
  task$.next({ type: 'ready' });
  await vi.advanceTimersByTimeAsync(0);
  expect(visibleState).toBe('completed');
  stop();
});

test('a failed subscription retries while fallback snapshots remain active', async () => {
  const recovered$ = new Subject();
  const project = vi
    .fn()
    .mockReturnValueOnce(throwError(() => new Error('offline')))
    .mockReturnValue(recovered$);
  const onError = vi.fn();
  const store = new ProjectRealtimeStore({
    global: () => recovered$,
    project,
    onError,
  });
  const refresh = vi.fn();
  const stop = store.subscribe('project', 'resource', refresh);
  expect(onError).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(15000);
  expect(project).toHaveBeenCalledTimes(2);
  expect(refresh).toHaveBeenCalledOnce();
  recovered$.next({ type: 'ready' });
  await vi.advanceTimersByTimeAsync(0);
  expect(refresh).toHaveBeenCalledTimes(2);
  stop();
});

test('coalesces events during a snapshot and suppresses stale callbacks after leaving', async () => {
  const { store, list$ } = setup();
  let complete: (() => void) | undefined;
  const refresh = vi.fn(
    () =>
      new Promise<void>(resolve => {
        complete = resolve;
      })
  );
  const stop = store.subscribe(null, 'list', refresh);
  list$.next({ changed: true });
  await vi.advanceTimersByTimeAsync(0);
  list$.next({ changed: true });
  list$.next({ changed: true });
  expect(refresh).toHaveBeenCalledOnce();
  complete!();
  await vi.advanceTimersByTimeAsync(0);
  expect(refresh).toHaveBeenCalledTimes(2);
  stop();
  complete!();
  await vi.advanceTimersByTimeAsync(15000);
  expect(refresh).toHaveBeenCalledTimes(2);
});
