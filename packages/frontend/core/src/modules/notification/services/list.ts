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
  isMutating$ = new LiveData(false);
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
        if (!revision || this.isMutating$.value) return;
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
      if (!this.hasMore$.value || this.isMutating$.value) {
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
    return this.mutate(
      () => {
        const existing = this.notifications$.value.find(n => n.id === id);
        this.notifications$.next(
          this.mode$.value === 'unread'
            ? this.notifications$.value.filter(n => n.id !== id)
            : this.notifications$.value.map(n =>
                n.id === id ? { ...n, read: true } : n
              )
        );
        if (existing && !existing.read) {
          this.notificationCount.setCount(
            Math.max(this.notificationCount.count$.value - 1, 0)
          );
        }
      },
      () => this.store.readNotification(id)
    );
  }

  async readAllNotifications() {
    return this.mutate(
      () => {
        this.notifications$.next(
          this.mode$.value === 'unread'
            ? []
            : this.notifications$.value.map(n => ({ ...n, read: true }))
        );
        this.notificationCount.setCount(0);
      },
      () => this.store.readAllNotifications()
    );
  }

  async dismissNotification(id: string) {
    return this.mutate(
      () => {
        const existing = this.notifications$.value.find(n => n.id === id);
        this.notifications$.next(
          this.notifications$.value.filter(n => n.id !== id)
        );
        if (existing && !existing.read) {
          this.notificationCount.setCount(
            Math.max(this.notificationCount.count$.value - 1, 0)
          );
        }
      },
      () => this.store.dismissNotification(id)
    );
  }

  async dismissReadNotifications() {
    return this.mutate(
      () => {
        this.notifications$.next(
          this.notifications$.value.filter(n => !n.read)
        );
      },
      () => this.store.dismissReadNotifications()
    );
  }

  async dismissAllNotifications() {
    return this.mutate(
      () => {
        this.notifications$.next([]);
        this.notificationCount.setCount(0);
      },
      () => this.store.dismissAllNotifications()
    );
  }

  private async mutate(
    optimistic: () => void,
    request: () => Promise<unknown>
  ) {
    if (this.isMutating$.value) return;
    this.isMutating$.setValue(true);
    const previousCount = this.notificationCount.count$.value;
    const revision = this.notificationCount.revision$.value;
    this.loadMore.reset();
    this.isLoading$.setValue(false);
    optimistic();
    try {
      await request();
    } catch (err) {
      if (this.notificationCount.revision$.value === revision) {
        this.notificationCount.setCount(previousCount);
      }
      throw err;
    } finally {
      // Reconcile pagination and notifications received while the mutation ran.
      this.isMutating$.setValue(false);
      this.reset();
      this.loadMore();
      this.notificationCount.revalidate();
    }
  }
}
