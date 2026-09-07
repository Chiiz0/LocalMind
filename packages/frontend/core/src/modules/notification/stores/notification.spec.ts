/** @vitest-environment happy-dom */

import {
  dismissAllNotificationsMutation,
  dismissNotificationMutation,
  dismissReadNotificationsMutation,
  listNotificationsQuery,
} from '@affine/graphql';
import { Framework } from '@toeverything/infra';
import { describe, expect, test, vi } from 'vitest';

import { GraphQLService } from '../../cloud';
import { ServerService } from '../../cloud/services/server';
import { GlobalSessionState } from '../../storage';
import { NotificationStore } from './notification';

function createStore(gql: ReturnType<typeof vi.fn>) {
  const framework = new Framework();
  framework.service(GraphQLService, { gql } as any);
  framework.service(ServerService, { server: { id: 'server-1' } } as any);
  framework.impl(GlobalSessionState, {} as any);
  framework.store(NotificationStore, [
    GraphQLService,
    ServerService,
    GlobalSessionState,
  ]);
  return framework.provider().get(NotificationStore);
}

describe('NotificationStore', () => {
  test('forwards the include-read list mode', async () => {
    const gql = vi.fn().mockResolvedValue({
      currentUser: { notifications: { edges: [] } },
    });
    const store = createStore(gql);
    const signal = new AbortController().signal;

    await store.listNotification({ first: 8 }, true, signal);

    expect(gql).toHaveBeenCalledWith({
      query: listNotificationsQuery,
      variables: {
        pagination: { first: 8 },
        includeRead: true,
      },
      context: { signal },
    });
  });

  test('uses dedicated dismissal mutations', async () => {
    const gql = vi.fn().mockResolvedValue({});
    const store = createStore(gql);

    await store.dismissNotification('notification-1');
    await store.dismissReadNotifications();
    await store.dismissAllNotifications();

    expect(gql).toHaveBeenNthCalledWith(1, {
      query: dismissNotificationMutation,
      variables: { id: 'notification-1' },
    });
    expect(gql).toHaveBeenNthCalledWith(2, {
      query: dismissReadNotificationsMutation,
    });
    expect(gql).toHaveBeenNthCalledWith(3, {
      query: dismissAllNotificationsMutation,
    });
  });
});
