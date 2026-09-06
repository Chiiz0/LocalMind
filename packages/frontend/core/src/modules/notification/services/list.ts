import {
  catchErrorInto,
  effect,
  fromPromise,
  LiveData,
  onComplete,
  onStart,
  Service,
  smartRetry,
} from '@toeverything/infra';
import { EMPTY, exhaustMap, tap } from 'rxjs';

import type { Notification, NotificationStore } from '../stores/notification';
import type { NotificationCountService } from './count';

export class NotificationListService extends Service {
  mode$ = new LiveData<'unread' | 'all'>('unread');
  isLoading$ = new LiveData(false);
  notifications$ = new LiveData<Notification[]>([]);
  nextCursor$ = new LiveData<string | undefined>(undefined);
  hasMore$ = new LiveData(true);
  error$ = new LiveData<any>(null);

  readonly PAGE_SIZE = 8;

  constructor(
    private readonly store: NotificationStore,
    private readonly notificationCount: NotificationCountService
  ) {
    super();
    const subscription = this.notificationCount.revision$.subscribe(
      revision => {
        if (!revision) return;
        if (
          this.notifications$.value.length ||
          !this.hasMore$.value ||
          this.isLoading$.value
        ) {
          this.reset();
          this.loadMore();
        }
      }
    );
    this.disposables.push(() => subscription.unsubscribe());
  }

  readonly loadMore = effect(
    exhaustMap(() => {
      if (!this.hasMore$.value) {
        return EMPTY;
      }
      return fromPromise(signal =>
        this.store.listNotification(
          {
            first: this.PAGE_SIZE,
            after: this.nextCursor$.value,
          },
          this.mode$.value === 'all',
          signal
        )
      ).pipe(
        tap(result => {
          if (!result) {
            // If the user is not logged in, we just ignore the result.
            return;
          }
          const { edges, pageInfo, totalCount } = result;
          this.notifications$.next([
            ...this.notifications$.value,
            ...edges.map(edge => edge.node),
          ]);

          if (this.mode$.value === 'unread') {
            this.notificationCount.setCount(totalCount);
          }

          this.hasMore$.next(pageInfo.hasNextPage);
          this.nextCursor$.next(pageInfo.endCursor ?? undefined);
        }),
        smartRetry(),
        catchErrorInto(this.error$),
        onStart(() => {
          this.isLoading$.setValue(true);
        }),
        onComplete(() => this.isLoading$.setValue(false))
      );
    })
  );

  reset() {
    this.notifications$.setValue([]);
    this.hasMore$.setValue(true);
    this.nextCursor$.setValue(undefined);
    this.isLoading$.setValue(false);
    this.error$.setValue(null);
    this.loadMore.reset();
  }

  retry() {
    this.error$.setValue(null);
    this.loadMore.reset();
    this.loadMore();
  }

  setMode(mode: 'unread' | 'all') {
    if (mode === this.mode$.value) return;
    this.mode$.setValue(mode);
    this.reset();
    this.loadMore();
  }

  async readNotification(id: string) {
    const existing = this.notifications$.value.find(
      notification => notification.id === id
    );
    await this.store.readNotification(id);
    if (this.mode$.value === 'unread') {
      this.notifications$.next(
        this.notifications$.value.filter(notification => notification.id !== id)
      );
    } else {
      this.notifications$.next(
        this.notifications$.value.map(notification =>
          notification.id === id
            ? { ...notification, read: true }
            : notification
        )
      );
    }
    if (existing && !existing.read) {
      this.notificationCount.setCount(
        Math.max(this.notificationCount.count$.value - 1, 0)
      );
    }
  }

  async readAllNotifications() {
    const previousNotifications = this.notifications$.value;
    const previousCount = this.notificationCount.count$.value;
    if (this.mode$.value === 'unread') {
      this.reset();
      this.hasMore$.setValue(false);
    } else {
      this.notifications$.next(
        previousNotifications.map(notification => ({
          ...notification,
          read: true,
        }))
      );
    }
    this.notificationCount.setCount(0);

    try {
      await this.store.readAllNotifications();
    } catch (err) {
      this.notificationCount.setCount(previousCount);
      // rollback the optimistic clear all notifications
      this.reset();
      this.loadMore();

      // rethrow the error to the caller, to notify the user
      throw err;
    }
  }

  async dismissNotification(id: string) {
    const previousNotifications = this.notifications$.value;
    const previousCount = this.notificationCount.count$.value;
    const existing = previousNotifications.find(
      notification => notification.id === id
    );
    this.notifications$.next(
      previousNotifications.filter(notification => notification.id !== id)
    );
    if (existing && !existing.read) {
      this.notificationCount.setCount(
        Math.max(this.notificationCount.count$.value - 1, 0)
      );
    }

    try {
      await this.store.dismissNotification(id);
    } catch (err) {
      this.notificationCount.setCount(previousCount);
      this.reset();
      this.loadMore();
      throw err;
    }
  }

  async dismissReadNotifications() {
    const previousNotifications = this.notifications$.value;
    this.notifications$.next(
      previousNotifications.filter(notification => !notification.read)
    );
    try {
      await this.store.dismissReadNotifications();
    } catch (err) {
      this.reset();
      this.loadMore();
      throw err;
    }
  }
}
