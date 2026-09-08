import type { SearchMenuConfig } from '@affine/core/blocksuite/ai/components/ai-chat-add-context/type';
import type { DocDisplayConfig } from '@affine/core/blocksuite/ai/components/ai-chat-chips';
import { AIReasoningService } from '@affine/core/modules/ai-button/services/reasoning';
import { GraphQLService } from '@affine/core/modules/cloud';
import {
  type ProjectResourceFieldsFragment,
  projectResourceQuery,
} from '@affine/graphql';
import { I18n } from '@affine/i18n';
import { PageIcon } from '@blocksuite/icons/lit';
import { type Signal, signal } from '@preact/signals-core';
import { useService } from '@toeverything/infra';
import { useEffect, useMemo } from 'react';

export function useProjectChatConfig(
  projectId: string,
  openDocuments: () => void
) {
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
      getDocMenuGroup: () => ({ name: '', items: [] }),
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
    searchMenuConfig: {
      ...config.searchMenuConfig,
      selectDocuments: {
        label: I18n.t('com.affine.localmind.aiContext.selectDocuments'),
        open: openDocuments,
      },
    },
    reasoningConfig: {
      enabled: reasoning.enabled,
      setEnabled: reasoning.setEnabled,
    },
  };
}
