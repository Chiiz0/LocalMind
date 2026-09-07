import type { SearchMenuConfig } from '@affine/core/blocksuite/ai/components/ai-chat-add-context/type';
import type { DocDisplayConfig } from '@affine/core/blocksuite/ai/components/ai-chat-chips';
import { AIReasoningService } from '@affine/core/modules/ai-button/services/reasoning';
import { GraphQLService } from '@affine/core/modules/cloud';
import {
  type ProjectResourceFieldsFragment,
  projectResourceQuery,
  searchProjectResourcesQuery,
} from '@affine/graphql';
import { I18n } from '@affine/i18n';
import type { LinkedMenuItem } from '@blocksuite/affine/widgets/linked-doc';
import {
  ArrowLeftSmallIcon,
  ArrowRightSmallIcon,
  PageIcon,
} from '@blocksuite/icons/lit';
import { type Signal, signal } from '@preact/signals-core';
import { useService } from '@toeverything/infra';
import { useEffect, useMemo } from 'react';

export function useProjectChatConfig(projectId: string) {
  const graphql = useService(GraphQLService);
  const reasoning = useService(AIReasoningService);
  const config = useMemo(() => {
    let controller = new AbortController();
    const resources = new Map<string, ProjectResourceFieldsFragment>();
    const titles = new Map<string, Signal<string>>();
    const title = (resourceId: string) => {
      let value = titles.get(resourceId);
      if (!value) {
        value = signal('');
        if (titles.size >= 256) return value;
        titles.set(resourceId, value);
        const current = value;
        const requestController = controller;
        void graphql
          .gql({
            query: projectResourceQuery,
            variables: { projectId, resourceId },
            signal: requestController.signal,
          })
          .then(result => {
            if (requestController.signal.aborted) return;
            resources.set(resourceId, result.projectResource);
            current.value = result.projectResource.title;
          })
          .catch(() => {
            if (requestController !== controller) return;
            resources.delete(resourceId);
            current.value = '';
          });
      }
      return value;
    };
    const docDisplayConfig: DocDisplayConfig = {
      getIcon: () => PageIcon(),
      getTitle: id => title(id).value,
      getTitleSignal: id => ({ signal: title(id), cleanup: () => {} }),
      getDocMeta: id => {
        const resource = resources.get(id);
        return resource ? { id, title: resource.title } : null;
      },
      getDocPrimaryMode: id =>
        resources.get(id)?.kind === 'edgeless' ? 'edgeless' : 'page',
      getDoc: () => null,
      getReferenceDocs: () => ({ signal: signal([]), cleanup: () => {} }),
      getTags: () => ({ signal: signal([]), cleanup: () => {} }),
      getTagTitle: () => '',
      getTagPageIds: () => [],
      getCollections: () => ({ signal: signal([]), cleanup: () => {} }),
      getCollectionPageIds: () => [],
    };
    const searchMenuConfig: SearchMenuConfig = {
      supportsCategories: false,
      getDocMenuGroup: (query, action, abortSignal) => {
        const ownerSignal = controller.signal;
        const items = signal<LinkedMenuItem[]>([]);
        const loading = signal(false);
        const load = async (
          cursor?: string,
          previous: (string | undefined)[] = []
        ) => {
          if (loading.value || abortSignal.aborted || ownerSignal.aborted)
            return;
          loading.value = true;
          try {
            const result = await graphql.gql({
              query: searchProjectResourcesQuery,
              variables: {
                projectId,
                query: query.slice(0, 128),
                cursor,
                limit: 20,
              },
              signal: AbortSignal.any([abortSignal, ownerSignal]),
            });
            if (abortSignal.aborted || ownerSignal.aborted) return;
            const page = result.searchProjectResources;
            const selected = page.items.map(item => ({
              name: `${item.path.map(part => part.title).join(' / ')} (v${item.contentVersion})`,
              key: item.id,
              icon: PageIcon(),
              action: () =>
                action({
                  id: item.id,
                  title: item.title,
                  tags: [],
                  createDate: 0,
                }),
            }));
            items.value = [
              ...(previous.length
                ? [
                    {
                      key: 'project-previous',
                      name: I18n.t(
                        'com.affine.localmind.documentCreation.previous'
                      ),
                      icon: ArrowLeftSmallIcon(),
                      action: () =>
                        load(
                          previous[previous.length - 1],
                          previous.slice(0, -1)
                        ),
                    },
                  ]
                : []),
              ...selected,
              ...(page.nextCursor
                ? [
                    {
                      key: 'project-more',
                      name: I18n.t(
                        'com.affine.localmind.documentCreation.next'
                      ),
                      icon: ArrowRightSmallIcon(),
                      action: () =>
                        load(page.nextCursor ?? undefined, [
                          ...previous,
                          cursor,
                        ]),
                    },
                  ]
                : []),
            ];
          } catch {
            if (!abortSignal.aborted && !ownerSignal.aborted)
              items.value = [
                {
                  key: 'project-retry',
                  name: I18n.t('com.affine.localmind.project-files.retry'),
                  icon: PageIcon(),
                  action: () => load(cursor, previous),
                },
              ];
          } finally {
            loading.value = false;
          }
        };
        load().catch(console.error);
        return {
          name: I18n.t('com.affine.localmind.project-files.title'),
          items,
          loading,
        };
      },
      getTagMenuGroup: () => ({ name: '', items: [] }),
      getCollectionMenuGroup: () => ({ name: '', items: [] }),
    };
    return {
      docDisplayConfig,
      searchMenuConfig,
      activate: () => {
        if (controller.signal.aborted) controller = new AbortController();
      },
      dispose: () => controller.abort(),
    };
  }, [graphql, projectId]);
  useEffect(() => {
    config.activate();
    return config.dispose;
  }, [config]);
  return {
    docDisplayConfig: config.docDisplayConfig,
    searchMenuConfig: config.searchMenuConfig,
    reasoningConfig: {
      enabled: reasoning.enabled,
      setEnabled: reasoning.setEnabled,
    },
  };
}
