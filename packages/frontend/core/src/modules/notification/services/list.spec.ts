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
        _includeRead: boolean,
        _signal?: AbortSignal
      ) => ({
        totalCount: notifications.length,
        edges: notifications.map(notification => ({
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
    readNotification: vi.fn(async () => true),
    readAllNotifications: vi.fn(async () => true),
    dismissNotification: vi.fn(async () => true),
    dismissReadNotifications: vi.fn(async () => true),
  };
  const count = {
    revision$: new LiveData(0),
    count$: new LiveData(1),
    setCount: vi.fn((value: number) => count.count$.setValue(value)),
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
  return { count, service, store };
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
    expect(service.notifications$.value).toEqual([
      { ...notification, read: true },
    ]);
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

    expect(service.notifications$.value).toEqual([unread]);
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
  });
});
