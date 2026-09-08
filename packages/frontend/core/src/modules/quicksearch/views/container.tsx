import { Button } from '@affine/component';
import { UserFriendlyError } from '@affine/error';
import { useI18n } from '@affine/i18n';
import { useLiveData, useServices } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { QuickSearchService } from '../services/quick-search';
import type { QuickSearchGroup } from '../types/group';
import type { QuickSearchItem } from '../types/item';
import { CMDK } from './cmdk';
import { QuickSearchModal } from './modal';

export const QuickSearchContainer = () => {
  const { quickSearchService } = useServices({
    QuickSearchService,
  });
  const quickSearch = quickSearchService.quickSearch;
  const open = useLiveData(quickSearch.show$);
  const query = useLiveData(quickSearch.query$);
  const loading = useLiveData(quickSearch.isLoading$);
  const loadingProgress = useLiveData(quickSearch.loadingProgress$);
  const items = useLiveData(quickSearch.items$);
  const error = useLiveData(quickSearch.error$);
  const options = useLiveData(quickSearch.options$);
  const i18n = useI18n();
  const focusOpenedDocument = useRef<(() => void) | undefined>(undefined);
  const [mode, setMode] = useState<'docs' | 'commands'>('docs');
  useEffect(() => {
    if (!open) setMode('docs');
  }, [open]);

  const onToggleQuickSearch = useCallback(
    (open: boolean) => {
      if (open) {
        // should never be here
      } else {
        quickSearch.hide();
      }
    },
    [quickSearch]
  );

  const groups = useMemo(() => {
    const groups: { group?: QuickSearchGroup; items: QuickSearchItem[] }[] = [];

    for (const item of items) {
      if (
        options?.searchModes &&
        (mode === 'commands'
          ? item.source !== 'commands'
          : ![
              'docs',
              'recent-doc',
              'link',
              'tags',
              'collections',
              'project',
            ].includes(item.source))
      )
        continue;
      const group = item.group;
      const existingGroup = groups.find(g => g.group?.id === group?.id);
      if (existingGroup) {
        existingGroup.items.push(item);
      } else {
        groups.push({ group, items: [item] });
      }
    }

    for (const { items } of groups) {
      items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    }

    groups.sort((a, b) => {
      const group = (b.group?.score ?? 0) - (a.group?.score ?? 0);
      if (group !== 0) {
        return group;
      }
      return (b.items[0].score ?? 0) - (a.items[0].score ?? 0);
    });

    return groups;
  }, [items, mode, options?.searchModes]);

  const handleChangeQuery = useCallback(
    (query: string) => {
      quickSearch.setQuery(query);
    },
    [quickSearch]
  );

  const handleSubmit = useCallback(
    (item: QuickSearchItem) => {
      if (
        ['docs', 'recent-doc', 'link'].includes(item.source) &&
        item.payload?.docId
      )
        focusOpenedDocument.current = options?.focusOpenedDocument;
      quickSearch.submit(item);
    },
    [quickSearch, options?.focusOpenedDocument]
  );
  const handleOpenBeside = useCallback(
    (item: QuickSearchItem) => {
      focusOpenedDocument.current = options?.focusOpenedDocument;
      quickSearch.submit({ ...item, openMode: 'beside' });
    },
    [quickSearch, options?.focusOpenedDocument]
  );

  return (
    <QuickSearchModal
      open={open}
      onOpenChange={onToggleQuickSearch}
      onCloseAutoFocus={event => {
        if (focusOpenedDocument.current) {
          event.preventDefault();
          focusOpenedDocument.current();
          focusOpenedDocument.current = undefined;
        }
      }}
    >
      {options?.searchModes && (
        <div
          role="tablist"
          style={{ display: 'flex', gap: 4, padding: '8px 16px' }}
        >
          <Button
            role="tab"
            aria-selected={mode === 'docs'}
            onClick={() => setMode('docs')}
          >
            {i18n['com.affine.quicksearch.mode.documents']()}
          </Button>
          <Button
            role="tab"
            aria-selected={mode === 'commands'}
            onClick={() => setMode('commands')}
          >
            {i18n['com.affine.quicksearch.mode.commands']()}
          </Button>
        </div>
      )}
      <CMDK
        query={query}
        groups={groups}
        error={error ? UserFriendlyError.fromAny(error).message : null}
        loading={loading}
        loadingProgress={loadingProgress}
        onQueryChange={handleChangeQuery}
        onSubmit={handleSubmit}
        onOpenBeside={options?.openBeside ? handleOpenBeside : undefined}
        inputLabel={options?.label && i18n.t(options.label)}
        placeholder={options?.placeholder && i18n.t(options.placeholder)}
      />
    </QuickSearchModal>
  );
};
