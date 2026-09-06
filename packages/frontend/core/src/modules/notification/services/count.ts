import { LiveData, OnEvent, Service } from '@toeverything/infra';

import { AccountChanged, type AuthService } from '../../cloud';
import { ServerStarted } from '../../cloud/events/server-started';
import { RealtimeLiveQuery } from '../../cloud/realtime/live-query';
import { ApplicationFocused } from '../../lifecycle';
import type { NbstoreService } from '../../storage';
import type { NotificationStore } from '../stores/notification';

@OnEvent(ApplicationFocused, s => s.handleApplicationFocused)
@OnEvent(ServerStarted, s => s.handleServerStarted)
@OnEvent(AccountChanged, s => s.handleAccountChanged)
export class NotificationCountService extends Service {
  constructor(
    private readonly store: NotificationStore,
    private readonly authService: AuthService,
    private readonly nbstoreService: NbstoreService
  ) {
    super();
    const subscription = this.loggedIn$.subscribe(() => {
      this.subscribe();
      this.revalidate();
    });
    this.disposables.push(() => subscription.unsubscribe());
  }

  loggedIn$ = this.authService.session.status$.map(v => v === 'authenticated');

  readonly count$ = LiveData.from(this.store.watchNotificationCountCache(), 0);
  readonly isLoading$ = new LiveData(false);
  readonly error$ = new LiveData<any>(null);
  readonly revision$ = new LiveData(0);
  private refreshTimer?: ReturnType<typeof setInterval>;
  private readonly liveQuery = new RealtimeLiveQuery({
    request: signal => this.requestCount(signal),
    subscribe: () =>
      this.nbstoreService.realtime.subscribe('notification.count.changed', {}),
    applySnapshot: result => {
      this.setCount(result.count);
      this.revision$.setValue(this.revision$.value + 1);
    },
    applyEvent: event => {
      this.setCount(event.count);
      this.revision$.setValue(this.revision$.value + 1);
      return 'applied';
    },
    onError: error => this.error$.setValue(error),
  });

  revalidate = () => {
    if (!this.loggedIn$.value) {
      this.setCount(0);
      return;
    }
    this.liveQuery.revalidate();
  };

  handleApplicationFocused() {
    this.revalidate();
  }

  handleServerStarted() {
    this.subscribe();
    this.revalidate();
  }

  handleAccountChanged() {
    this.subscribe();
    this.revalidate();
  }

  setCount(count: number) {
    this.error$.setValue(null);
    this.store.setNotificationCountCache(count);
  }

  override dispose(): void {
    super.dispose();
    clearInterval(this.refreshTimer);
    this.liveQuery.dispose();
  }

  private subscribe() {
    clearInterval(this.refreshTimer);
    if (!this.loggedIn$.value) {
      this.liveQuery.stop();
      this.setCount(0);
      return;
    }
    this.liveQuery.start();
    // Reconcile a dropped event even when the transport remains connected.
    this.refreshTimer = setInterval(this.revalidate, 15000);
  }

  private async requestCount(signal: AbortSignal) {
    this.isLoading$.setValue(true);
    try {
      try {
        return await this.nbstoreService.realtime.request(
          'notification.count.get',
          {},
          { signal, timeoutMs: 10000 }
        );
      } catch (error) {
        if (signal.aborted) throw error;
        const notifications = await this.store.listNotification(
          { first: 1 },
          false,
          signal
        );
        if (!notifications) throw error;
        return { count: notifications.totalCount };
      }
    } finally {
      this.isLoading$.setValue(false);
    }
  }
}
