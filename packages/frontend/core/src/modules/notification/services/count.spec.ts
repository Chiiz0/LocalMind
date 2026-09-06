/** @vitest-environment happy-dom */
import { Framework, LiveData } from '@toeverything/infra';
import { BehaviorSubject, Subject } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';

import { NotificationCountService } from './count';

function fixture(authenticated = true) {
  const status$ = new LiveData(
    authenticated ? 'authenticated' : 'unauthenticated'
  );
  const events$ = new Subject<{ type: 'ready' } | { count: number }>();
  const cached$ = new BehaviorSubject(1);
  const store = {
    watchNotificationCountCache: () => cached$,
    setNotificationCountCache: (count: number) => cached$.next(count),
    listNotification: vi.fn().mockResolvedValue({ totalCount: 1 }),
  };
  const realtime = {
    subscribe: () => events$,
    request: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const framework = new Framework();
  framework.service(
    NotificationCountService,
    () =>
      new NotificationCountService(
        store as unknown as ConstructorParameters<
          typeof NotificationCountService
        >[0],
        {
          session: { status$ },
        } as unknown as ConstructorParameters<
          typeof NotificationCountService
        >[1],
        { realtime } as unknown as ConstructorParameters<
          typeof NotificationCountService
        >[2]
      )
  );
  const service = framework.provider().get(NotificationCountService);
  return { service, events$, store, realtime, status$ };
}

describe('notification reconnect snapshots', () => {
  test('an existing session starts snapshots without a new account event', async () => {
    const { service } = fixture();
    try {
      await vi.waitFor(() => expect(service.revision$.value).toBe(1));
    } finally {
      service.dispose();
    }
  });

  test('authentication becoming ready starts polling and logout stops it', async () => {
    vi.useFakeTimers();
    const { service, realtime, status$ } = fixture(false);
    try {
      expect(realtime.request).not.toHaveBeenCalled();
      status$.setValue('authenticated');
      await vi.advanceTimersByTimeAsync(15000);
      expect(realtime.request).toHaveBeenCalledTimes(2);
      status$.setValue('unauthenticated');
      await vi.advanceTimersByTimeAsync(30000);
      expect(realtime.request).toHaveBeenCalledTimes(2);
      expect(service.count$.value).toBe(0);
    } finally {
      service.dispose();
      vi.useRealTimers();
    }
  });

  test('a dropped event converges through periodic snapshots and disposal stops polling', async () => {
    vi.useFakeTimers();
    const { service, realtime } = fixture();
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(service.revision$.value).toBe(1);
      await vi.advanceTimersByTimeAsync(15000);
      expect(service.revision$.value).toBe(2);
      service.dispose();
      await vi.advanceTimersByTimeAsync(30000);
      expect(realtime.request).toHaveBeenCalledTimes(2);
    } finally {
      service.dispose();
      vi.useRealTimers();
    }
  });

  test('reconnect refreshes status even when the unread count stays the same', async () => {
    const { service, events$ } = fixture();
    try {
      service.handleServerStarted();
      await vi.waitFor(() => expect(service.revision$.value).toBe(1));
      events$.next({ type: 'ready' });
      await vi.waitFor(() => expect(service.revision$.value).toBe(2));
      expect(service.count$.value).toBe(1);
    } finally {
      service.dispose();
    }
  });

  test('transport failure recovers the durable HTTP snapshot', async () => {
    const { service, store, realtime, status$ } = fixture(false);
    realtime.request.mockRejectedValue(new Error('realtime unavailable'));
    store.listNotification.mockResolvedValue({ totalCount: 3 });
    try {
      status$.setValue('authenticated');
      await vi.waitFor(() => expect(service.count$.value).toBe(3));
      expect(service.revision$.value).toBe(1);
      expect(service.error$.value).toBeNull();
      expect(store.listNotification).toHaveBeenCalledWith(
        { first: 1 },
        false,
        expect.any(AbortSignal)
      );
    } finally {
      service.dispose();
    }
  });

  test('disposing the account service ignores a late fallback response', async () => {
    const { service, store, realtime, status$ } = fixture(false);
    realtime.request.mockRejectedValue(new Error('realtime unavailable'));
    let resolve!: (value: { totalCount: number }) => void;
    store.listNotification.mockImplementation(
      () =>
        new Promise(done => {
          resolve = done;
        })
    );
    status$.setValue('authenticated');
    await vi.waitFor(() =>
      expect(store.listNotification).toHaveBeenCalledOnce()
    );
    service.dispose();
    resolve({ totalCount: 99 });
    await Promise.resolve();
    await Promise.resolve();
    expect(service.revision$.value).toBe(0);
    expect(service.count$.value).toBe(0);
  });
});
