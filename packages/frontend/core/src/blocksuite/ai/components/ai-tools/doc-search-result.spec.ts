/**
 * @vitest-environment happy-dom
 */
import { getOrCreateI18n } from '@affine/i18n';
import { render } from 'lit';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { DocKeywordSearchResult } from './doc-keyword-search-result';
import { DocSemanticSearchResult } from './doc-semantic-search-result';
import type { ToolResultCard } from './tool-result-card';

beforeAll(async () => {
  await getOrCreateI18n().changeLanguage('en');
});

afterEach(() => document.body.replaceChildren());

describe.each([
  ['keyword', DocKeywordSearchResult],
  ['semantic', DocSemanticSearchResult],
] as const)('%s document search cards', (kind, Component) => {
  function renderResult(result: unknown) {
    const openProject = vi.fn();
    const peek = vi.fn().mockResolvedValue(undefined);
    const getTitle = vi.fn().mockReturnValue('Current workspace title');
    const instance = Object.create(Component.prototype) as
      | DocKeywordSearchResult
      | DocSemanticSearchResult;
    Object.defineProperties(instance, {
      data: {
        value: {
          type: 'tool-result',
          toolName: `doc_${kind}_search`,
          toolCallId: 'search-1',
          args: { query: 'budget' },
          result,
        },
      },
      width: { value: undefined },
      docDisplayService: { value: { getTitle } },
      onOpenDoc: { value: openProject },
      peekViewService: { value: { peekView: { open: peek } } },
    });
    const container = document.createElement('div');
    document.body.append(container);
    render(instance.renderToolResult(), container);
    return {
      container,
      card: container.querySelector<ToolResultCard>('tool-result-card'),
      openProject,
      peek,
      getTitle,
    };
  }

  test('restores an empty Project search without throwing or an undefined count', () => {
    const { card, container } = renderResult({
      items: [],
      nextCursor: null,
      retrievalMode: 'keyword',
    });
    expect(card?.results).toEqual([]);
    expect(card?.name).toBe('Project files found for "budget": 0');
    expect(container.querySelector('tool-call-failed')).toBeNull();
  });

  test('renders Project file names and snippets and opens through the Project handler', () => {
    const { card, openProject, peek, getTitle } = renderResult({
      items: [
        {
          id: 'resource-1',
          projectId: 'project-1',
          title: 'Budget workbook',
          snippet: 'Forecast for next quarter',
          kind: 'workbook',
          contentVersion: 3,
          path: [{ id: 'folder-1', title: 'Finance' }],
        },
      ],
      nextCursor: 'more-results',
      retrievalMode: 'keyword',
    });
    expect(card?.name).toBe('Project files found for "budget": 1');
    expect(card?.results[0]).toMatchObject({
      title: 'Budget workbook',
      content: 'Forecast for next quarter',
    });
    card?.results[0].onClick?.();
    expect(openProject).toHaveBeenCalledWith('resource-1');
    expect(peek).not.toHaveBeenCalled();
    expect(getTitle).not.toHaveBeenCalled();
  });

  test('keeps existing Workspace results and their peek navigation', () => {
    const { card, openProject, peek } = renderResult([
      {
        docId: 'workspace-doc',
        title: 'Workspace budget',
        content: 'Title: Workspace budget\nCreated by: Owner\nBudget content',
      },
    ]);
    expect(card?.results).toHaveLength(1);
    expect(card?.results[0].title).toBe(
      kind === 'keyword' ? 'Workspace budget' : 'Current workspace title'
    );
    card?.results[0].onClick?.();
    expect(peek).toHaveBeenCalledWith({
      type: 'doc',
      docRef: { docId: 'workspace-doc' },
    });
    expect(openProject).not.toHaveBeenCalled();
  });

  test.each([
    null,
    { message: 'Search failed' },
    { items: null },
    { items: [null] },
    { items: [{ id: 'resource-1' }] },
    [null],
    'invalid result',
  ])('renders invalid persisted results as a failed card: %j', result => {
    const { container, card, openProject, peek } = renderResult(result);
    expect(card).toBeNull();
    expect(container.querySelector('tool-call-failed')).not.toBeNull();
    expect(openProject).not.toHaveBeenCalled();
    expect(peek).not.toHaveBeenCalled();
  });

  test('preserves actionable tool errors', () => {
    const { container, card } = renderResult({
      type: 'error',
      name: 'Workspace Sync Required',
      message: 'Internal details',
    });
    expect(card).toBeNull();
    const failed = container.querySelector('tool-call-failed') as
      | (HTMLElement & { name: string })
      | null;
    expect(failed?.name).toBe('Enable workspace sync to search documents');
  });
});
