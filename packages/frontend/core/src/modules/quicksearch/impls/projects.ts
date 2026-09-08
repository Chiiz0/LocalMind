import { notify } from '@affine/component';
import { UserFriendlyError } from '@affine/error';
import {
  copilotWorkbenchProjectsGetQuery,
  searchProjectResourcesQuery,
} from '@affine/graphql';
import { FolderIcon, PageIcon } from '@blocksuite/icons/rc';
import { Entity, LiveData } from '@toeverything/infra';

import { type DefaultServerService, GraphQLService } from '../../cloud';
import type { QuickSearchSession } from '../providers/quick-search-provider';
import type { QuickSearchItem } from '../types/item';

export type ProjectSearchPayload = { projectId: string; resourceId?: string };

export class ProjectsQuickSearchSession
  extends Entity
  implements QuickSearchSession<'project', ProjectSearchPayload>
{
  constructor(private readonly defaultServer: DefaultServerService) {
    super();
  }

  readonly items$ = new LiveData<
    QuickSearchItem<'project', ProjectSearchPayload>[]
  >([]);
  readonly error$ = new LiveData<UserFriendlyError | null>(null);
  readonly isLoading$ = new LiveData(false);
  private controller: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  query(query: string) {
    this.controller?.abort();
    clearTimeout(this.timer);
    const controller = new AbortController();
    this.controller = controller;
    this.items$.next([]);
    this.error$.next(null);
    this.isLoading$.next(true);
    this.timer = setTimeout(
      () => {
        void this.search(query.slice(0, 128), controller).catch(error =>
          this.reportError(error, controller.signal)
        );
      },
      query ? 250 : 0
    );
  }

  private async search(query: string, controller: AbortController) {
    const signal = controller.signal;
    const graphql = this.defaultServer.server.scope.get(GraphQLService);
    try {
      const result = await graphql.gql({
        query: copilotWorkbenchProjectsGetQuery,
        variables: { includeArchived: false },
        signal,
      });
      if (signal.aborted) return;
      const projects = result.currentUser?.copilot.contextProjects ?? [];
      const items: QuickSearchItem<'project', ProjectSearchPayload>[] = projects
        .filter(project =>
          project.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())
        )
        .map(project => ({
          id: `project:${project.id}`,
          source: 'project',
          label: { title: project.name },
          icon: FolderIcon,
          group: {
            id: 'projects',
            label: { i18nKey: 'com.affine.localmind.workbench.projects' },
            score: 10,
          },
          payload: { projectId: project.id },
        }));
      this.items$.next([...items]);
      if (!query.trim()) return;
      // Bound concurrent requests across the caller's authorized projects.
      for (let offset = 0; offset < projects.length; offset += 4) {
        const batch = await Promise.all(
          projects.slice(offset, offset + 4).map(async project => {
            const result = await graphql.gql({
              query: searchProjectResourcesQuery,
              variables: { projectId: project.id, query, limit: 20 },
              signal,
            });
            return { project, page: result.searchProjectResources };
          })
        );
        if (signal.aborted) return;
        for (const { project, page } of batch) {
          const appendPage = (page: (typeof batch)[number]['page']) => {
            items.push(
              ...page.items.map(item => ({
                id: `project-resource:${item.id}`,
                source: 'project' as const,
                label: {
                  title: item.title,
                  subTitle: item.path.map(part => part.title).join(' / '),
                },
                icon: PageIcon,
                group: { id: project.id, label: project.name },
                payload: { projectId: project.id, resourceId: item.id },
              }))
            );
            if (page.nextCursor)
              items.push({
                id: `project-more:${project.id}`,
                source: 'project',
                label: { i18nKey: 'com.affine.quicksearch.load-more' },
                group: { id: project.id, label: project.name },
                payload: { projectId: project.id },
                beforeSubmit: () => {
                  if (this.isLoading$.value || signal.aborted) return false;
                  this.isLoading$.next(true);
                  this.error$.next(null);
                  void graphql
                    .gql({
                      query: searchProjectResourcesQuery,
                      variables: {
                        projectId: project.id,
                        query,
                        limit: 20,
                        cursor: page.nextCursor,
                      },
                      signal,
                    })
                    .then(result => {
                      if (signal.aborted) return;
                      const index = items.findIndex(
                        item => item.id === `project-more:${project.id}`
                      );
                      if (index !== -1) items.splice(index, 1);
                      appendPage(result.searchProjectResources);
                      this.items$.next([...items]);
                    })
                    .catch(error => this.reportError(error, signal))
                    .finally(() => {
                      if (!signal.aborted) this.isLoading$.next(false);
                    });
                  return false;
                },
              });
          };
          appendPage(page);
        }
        this.items$.next([...items]);
      }
    } catch (error) {
      this.reportError(error, signal);
    } finally {
      if (!signal.aborted) this.isLoading$.next(false);
    }
  }

  private reportError(error: unknown, signal: AbortSignal) {
    if (signal.aborted) return;
    const friendly = UserFriendlyError.fromAny(error);
    this.error$.next(friendly);
    notify.error({ title: friendly.message });
  }

  override dispose() {
    clearTimeout(this.timer);
    this.controller?.abort();
    super.dispose();
  }
}
