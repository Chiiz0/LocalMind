import { NotificationLevel, NotificationType } from '@affine/graphql';
import { Framework, LiveData } from '@toeverything/infra';
import { describe, expect, test, vi } from 'vitest';

import type { Notification } from '../stores/notification';
import { NotificationListService } from './list';

function makeNotification(id: string, read = false): Notification {
  return {
    id,
    type: NotificationType.Mention,
    level: NotificationLevel.Default,
    read,
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
    body: {},
  };
}

function createService(notifications: Notification[] = []) {
  const store = {
    listNotification: vi.fn(
      async (
        _pagination: unknown,
        includeRead: boolean,
        _signal?: AbortSignal
      ) => ({
        totalCount: notifications.filter(n => includeRead || !n.read).length,
        edges: notifications
          .filter(n => includeRead || !n.read)
          .map(notification => ({
            cursor: notification.createdAt,
            node: notification,
          })),
        pageInfo: {
          startCursor: null,
          endCursor: null,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      })
    ),
    readNotification: vi.fn(async (id: string) => {
      notifications = notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      );
      return true;
    }),
    readAllNotifications: vi.fn(async () => {
      notifications = notifications.map(n => ({ ...n, read: true }));
      return true;
    }),
    dismissNotification: vi.fn(async (id: string) => {
      notifications = notifications.filter(n => n.id !== id);
      return true;
    }),
    dismissReadNotifications: vi.fn(async () => {
      notifications = notifications.filter(n => !n.read);
      return true;
    }),
    dismissAllNotifications: vi.fn(async () => {
      notifications = [];
      return true;
    }),
  };
  const count = {
    revision$: new LiveData(0),
    count$: new LiveData(1),
    setCount: vi.fn((value: number) => count.count$.setValue(value)),
    revalidate: vi.fn(),
  };
  const framework = new Framework();
  framework.service(
    NotificationListService,
    () =>
      new NotificationListService(
        store as unknown as ConstructorParameters<
          typeof NotificationListService
        >[0],
        count as unknown as ConstructorParameters<
          typeof NotificationListService
        >[1]
      )
  );
  const service = framework.provider().get(NotificationListService);
  return {
    count,
    service,
    store,
    add: (n: Notification) => notifications.push(n),
  };
}

describe('NotificationListService', () => {
  test('realtime revisions refresh status even when the unread count is unchanged', async () => {
    const { service, store, count } = createService([makeNotification('one')]);
    service.loadMore();
    await vi.waitFor(() =>
      expect(service.notifications$.value).toHaveLength(1)
    );
    count.revision$.setValue(1);
    await vi.waitFor(() =>
      expect(store.listNotification).toHaveBeenCalledTimes(2)
    );
    expect(store.listNotification.mock.calls[1][0]).toEqual({
      first: 8,
      after: undefined,
    });
    await vi.waitFor(() =>
      expect(service.notifications$.value).toHaveLength(1)
    );
  });
  test('loads unread and all modes with distinct query variables', async () => {
    const { service, store } = createService([makeNotification('one')]);

    service.loadMore();
    await vi.waitFor(() => expect(store.listNotification).toHaveBeenCalled());
    expect(store.listNotification.mock.calls[0][1]).toBe(false);

    service.setMode('all');
    await vi.waitFor(() =>
      expect(store.listNotification).toHaveBeenCalledTimes(2)
    );
    expect(store.listNotification.mock.calls[1][1]).toBe(true);
  });

  test('keeps read notifications in all mode and deletes only on dismiss', async () => {
    const notification = makeNotification('one');
    const { count, service, store } = createService([notification]);
    service.mode$.setValue('all');
    service.notifications$.setValue([notification]);

    await service.readNotification(notification.id);
    await vi.waitFor(() =>
      expect(service.notifications$.value).toEqual([
        { ...notification, read: true },
      ])
    );
    expect(count.setCount).toHaveBeenCalledWith(0);

    await service.dismissNotification(notification.id);
    expect(service.notifications$.value).toEqual([]);
    expect(store.dismissNotification).toHaveBeenCalledWith(notification.id);
  });

  test('deletes only read notifications from the local all view', async () => {
    const unread = makeNotification('unread');
    const read = makeNotification('read', true);
    const { service, store } = createService([unread, read]);
    service.mode$.setValue('all');
    service.notifications$.setValue([unread, read]);

    await service.dismissReadNotifications();

    await vi.waitFor(() =>
      expect(service.notifications$.value).toEqual([unread])
    );
    expect(store.dismissReadNotifications).toHaveBeenCalledOnce();
  });

  test('restores unread count when an optimistic delete fails', async () => {
    const notification = makeNotification('one');
    const { count, service, store } = createService([notification]);
    service.notifications$.setValue([notification]);
    store.dismissNotification.mockRejectedValueOnce(new Error('failed'));

    await expect(service.dismissNotification(notification.id)).rejects.toThrow(
      'failed'
    );

    expect(count.count$.value).toBe(1);
    await vi.waitFor(() =>
      expect(service.notifications$.value).toEqual([notification])
    );
  });

  test('clears beyond the loaded page, prevents repeated submissions and reloads from the first page', async () => {
    const notifications = Array.from({ length: 120 }, (_, i) =>
      makeNotification(String(i))
    );
    const { count, service, store } = createService(notifications);
    service.notifications$.setValue(notifications.slice(0, 8));
    service.nextCursor$.setValue('old-cursor');
    count.count$.setValue(120);
    let finish!: () => void;
    const clear = store.dismissAllNotifications.getMockImplementation()!;
    store.dismissAllNotifications.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => {
        finish = resolve;
      });
      return clear();
    });
    const pending = service.dismissAllNotifications();
    await service.dismissAllNotifications();
    expect(service.isMutating$.value).toBe(true);
    expect(count.count$.value).toBe(0);
    expect(service.notifications$.value).toEqual([]);
    count.revision$.setValue(1);
    expect(store.listNotification).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(store.dismissAllNotifications).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(service.hasMore$.value).toBe(false));
    expect(store.listNotification.mock.lastCall?.[0]).toEqual({
      first: 8,
      after: undefined,
    });
    expect(count.revalidate).toHaveBeenCalledOnce();
    expect(service.isMutating$.value).toBe(false);
  });

  test('preserves a newer unread count received before a read mutation responds', async () => {
    const one = makeNotification('one');
    const two = makeNotification('two');
    const { count, service, store, add } = createService([one, two]);
    count.count$.setValue(2);
    service.notifications$.setValue([one, two]);
    const read = store.readNotification.getMockImplementation()!;
    store.readNotification.mockImplementationOnce(async id => {
      await read(id);
      add(makeNotification('new'));
      count.count$.setValue(2);
      count.revision$.setValue(1);
      return true;
    });
    await service.readNotification('one');
    await vi.waitFor(() =>
      expect(service.notifications$.value.map(n => n.id)).toEqual([
        'two',
        'new',
      ])
    );
    expect(count.count$.value).toBe(2);
  });

  test('failed clear restores notifications and permits retry', async () => {
    const one = makeNotification('one');
    const { service, store, count } = createService([one]);
    service.notifications$.setValue([one]);
    store.dismissAllNotifications.mockRejectedValueOnce(new Error('offline'));
    await expect(service.dismissAllNotifications()).rejects.toThrow('offline');
    await vi.waitFor(() => expect(service.notifications$.value).toEqual([one]));
    expect(count.count$.value).toBe(1);
    expect(service.isMutating$.value).toBe(false);
    await service.dismissAllNotifications();
    expect(service.notifications$.value).toEqual([]);
  });
});
