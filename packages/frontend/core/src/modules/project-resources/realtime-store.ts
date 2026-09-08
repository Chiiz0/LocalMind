import type { Observable, Subscription } from 'rxjs';

export type ProjectRefreshChannel = 'list' | 'task' | 'resource' | 'lease';
type Listener = {
  projectId: string | null;
  channel: ProjectRefreshChannel;
  refresh: () => unknown | Promise<unknown>;
  active: boolean;
  running: boolean;
  queued: boolean;
};

export type ProjectRealtimeTransport = {
  global: (channel: 'list' | 'task') => Observable<unknown>;
  project: (
    projectId: string,
    channel: 'resource' | 'lease'
  ) => Observable<unknown>;
  onError: (error: unknown) => void;
};

/** One reconciliation clock and one subscription per scope, regardless of mounted queries. */
export class ProjectRealtimeStore {
  private readonly listeners = new Set<Listener>();
  private readonly subscriptions = new Map<string, Subscription>();
  private timer?: ReturnType<typeof setInterval>;
  private errorReported = false;

  constructor(private readonly transport: ProjectRealtimeTransport) {}

  subscribe(
    projectId: string | null,
    channel: ProjectRefreshChannel,
    refresh: Listener['refresh']
  ) {
    const listener: Listener = {
      projectId,
      channel,
      refresh,
      active: true,
      running: false,
      queued: false,
    };
    this.listeners.add(listener);
    this.connect();
    this.timer ??= setInterval(() => {
      this.connect();
      this.refreshAll();
    }, 15000);
    return () => {
      listener.active = false;
      this.listeners.delete(listener);
      this.connect();
      if (!this.listeners.size) this.dispose();
    };
  }

  private connect() {
    const wanted = new Map<string, () => Observable<unknown>>();
    for (const listener of this.listeners) {
      const { projectId, channel } = listener;
      const key = JSON.stringify([
        channel,
        channel === 'list' || channel === 'task' ? null : projectId,
      ]);
      if (channel === 'list' || channel === 'task')
        wanted.set(key, () => this.transport.global(channel));
      else if (projectId)
        wanted.set(key, () => this.transport.project(projectId, channel));
    }
    for (const [key, subscription] of this.subscriptions) {
      if (!wanted.has(key) || subscription.closed) {
        subscription.unsubscribe();
        this.subscriptions.delete(key);
      }
    }
    for (const [key, source] of wanted) {
      if (this.subscriptions.has(key)) continue;
      const [channel, projectId] = JSON.parse(key) as [
        ProjectRefreshChannel,
        string | null,
      ];
      const subscription = source().subscribe({
        next: () => {
          this.errorReported = false;
          for (const listener of this.listeners) {
            if (
              listener.channel === channel &&
              (!projectId || listener.projectId === projectId)
            )
              this.refresh(listener);
          }
        },
        error: error => this.report(error),
      });
      this.subscriptions.set(key, subscription);
    }
  }

  private report(error: unknown) {
    if (!this.errorReported) this.transport.onError(error);
    this.errorReported = true;
  }

  private refreshAll() {
    for (const listener of this.listeners) this.refresh(listener);
  }

  private refresh(listener: Listener) {
    if (!listener.active) return;
    if (listener.running) {
      listener.queued = true;
      return;
    }
    listener.running = true;
    void Promise.resolve()
      .then(() => (listener.active ? listener.refresh() : undefined))
      .catch(error => {
        if (listener.active) this.report(error);
      })
      .finally(() => {
        listener.running = false;
        if (listener.active && listener.queued) {
          listener.queued = false;
          this.refresh(listener);
        }
      });
  }

  dispose() {
    clearInterval(this.timer);
    this.timer = undefined;
    for (const subscription of this.subscriptions.values())
      subscription.unsubscribe();
    this.subscriptions.clear();
    for (const listener of this.listeners) listener.active = false;
    this.listeners.clear();
  }
}
