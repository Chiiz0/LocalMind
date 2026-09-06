import {
  mutateWorkspaceDirectoryMutation,
  type WorkspaceDirectoryChangeInput,
  type WorkspaceDirectoryQuery,
  workspaceDirectoryQuery,
} from '@affine/graphql';
import { LiveData, Store } from '@toeverything/infra';
import { merge, of, type Subscription, switchMap } from 'rxjs';

import type { WorkspaceServerService } from '../../cloud';
import type { NbstoreService } from '../../storage';
import type { WorkspaceService } from '../../workspace';

type Page = WorkspaceDirectoryQuery['workspaceDirectory'];
export type DirectoryAccessState = {
  mode: 'local' | 'loading' | 'full' | 'filtered' | 'error';
  items: Page['items'];
  error: string | null;
  revision?: string;
  rootRights?: Page['rootRights'];
};

export class DirectoryAccessStore extends Store {
  readonly saving$ = new LiveData(false);
  readonly state$ = new LiveData<DirectoryAccessState>({
    mode: 'loading',
    items: [],
    error: null,
  });
  private generation = 0;
  private identityGeneration = 0;
  private accessSubscription?: Subscription;
  private refreshing = false;
  private controller?: AbortController;

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly workspaceServerService: WorkspaceServerService,
    private readonly nbstoreService?: NbstoreService
  ) {
    super();
    if (workspaceService.workspace.flavour === 'local') {
      this.state$.next({ mode: 'local', items: [], error: null });
      return;
    }
    const subscription = workspaceServerService.server$
      .pipe(switchMap(server => server?.account$ ?? of(null)))
      .subscribe(account => {
        this.identityGeneration++;
        this.accessSubscription?.unsubscribe();
        this.refresh(true).catch(console.error);
        if (account && this.nbstoreService) {
          const input = { workspaceId: this.workspaceService.workspace.id };
          this.accessSubscription = merge(
            this.nbstoreService.realtime.subscribe(
              'workspace.access.changed',
              input
            ),
            this.nbstoreService.realtime.subscribe(
              'workspace.directory-policy.changed',
              input
            )
          ).subscribe({
            next: () => {
              this.refresh(true).catch(console.error);
            },
            error: () => {
              this.refresh(true).catch(console.error);
            },
          });
        }
      });
    const timer = setInterval(() => {
      if (!this.refreshing && !this.saving$.value)
        this.refresh().catch(console.error);
    }, 15_000);
    this.disposables.push(
      () => subscription.unsubscribe(),
      () => clearInterval(timer),
      () => {
        this.generation++;
        this.identityGeneration++;
        this.accessSubscription?.unsubscribe();
        this.controller?.abort();
      }
    );
  }

  async refresh(clear = false) {
    if (this.workspaceService.workspace.flavour === 'local') return;
    const generation = ++this.generation;
    this.refreshing = true;
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    if (clear || this.state$.value.mode === 'error')
      this.state$.next({ mode: 'loading', items: [], error: null });
    try {
      const server = this.workspaceServerService.server;
      if (!server?.account$.value)
        throw new Error('Sign in to load workspace directories');
      const items = new Map<string, Page['items'][number]>();
      const cursors = new Set<string>();
      let after: string | undefined;
      let firstPage: Page | undefined;
      do {
        const result = await server.gql({
          query: workspaceDirectoryQuery,
          variables: { workspaceId: this.workspaceService.workspace.id, after },
          context: { signal: controller.signal },
        });
        if (generation !== this.generation) return;
        const page = result.workspaceDirectory;
        firstPage ??= page;
        if (
          page.revision !== firstPage.revision ||
          page.authorizationRevision !== firstPage.authorizationRevision ||
          page.fullSyncAllowed !== firstPage.fullSyncAllowed ||
          JSON.stringify(page.rootRights) !==
            JSON.stringify(firstPage.rootRights)
        )
          throw new Error('Directory permissions changed while loading; retry');
        if (page.fullSyncAllowed) {
          this.state$.next({ mode: 'full', items: [], error: null });
          return;
        }
        for (const item of page.items) items.set(item.id, item);
        if (items.size > 10_000)
          throw new Error('Directory listing exceeds the supported limit');
        after = page.nextCursor ?? undefined;
        if (after && cursors.has(after))
          throw new Error('Directory pagination did not advance');
        if (after && cursors.size >= 100)
          throw new Error('Directory listing exceeds the supported limit');
        if (after) cursors.add(after);
      } while (after);
      this.state$.next({
        mode: 'filtered',
        items: [...items.values()],
        error: null,
        revision: firstPage?.revision,
        rootRights: firstPage?.rootRights,
      });
    } catch (error) {
      if (generation !== this.generation) return;
      this.state$.next({
        mode: 'error',
        items: [],
        error:
          error instanceof Error ? error.message : 'Directory loading failed',
      });
    } finally {
      if (generation === this.generation) this.refreshing = false;
    }
  }

  async mutate(changes: WorkspaceDirectoryChangeInput[]) {
    const state = this.state$.value;
    const server = this.workspaceServerService.server;
    if (state.mode !== 'filtered' || !state.revision || !server?.account$.value)
      throw new Error('Reload directory permissions before editing');
    if (this.saving$.value)
      throw new Error('A directory change is already in progress');
    const identityGeneration = this.identityGeneration;
    this.saving$.next(true);
    try {
      const result = await server.gql({
        query: mutateWorkspaceDirectoryMutation,
        variables: {
          workspaceId: this.workspaceService.workspace.id,
          expectedRevision: state.revision,
          changes,
        },
      });
      if (identityGeneration !== this.identityGeneration)
        throw new Error(
          'The active directory account changed during the operation'
        );
      await this.refresh(true);
      return result.mutateWorkspaceDirectory;
    } catch (error) {
      if (identityGeneration === this.identityGeneration)
        await this.refresh(true);
      throw error;
    } finally {
      this.saving$.next(false);
    }
  }
}
