import type { PeekViewService } from '@affine/core/modules/peek-view';
import { I18n } from '@affine/i18n';
import { WithDisposable } from '@blocksuite/global/lit';
import { PageIcon, SearchIcon } from '@blocksuite/icons/lit';
import { ShadowlessElement } from '@blocksuite/std';
import type { Signal } from '@preact/signals-core';
import { html, nothing } from 'lit';
import { property } from 'lit/decorators.js';

import { parseDocSearchResults } from './doc-search-result';
import { getToolErrorDisplayName, isToolError } from './tool-result-utils';

interface DocKeywordSearchToolCall {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: { query: string };
}

interface DocKeywordSearchToolResult {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  args: { query: string };
  result: unknown;
}

export class DocKeywordSearchResult extends WithDisposable(ShadowlessElement) {
  @property({ attribute: false })
  accessor data!: DocKeywordSearchToolCall | DocKeywordSearchToolResult;

  @property({ attribute: false })
  accessor width: Signal<number | undefined> | undefined;

  @property({ attribute: false })
  accessor onOpenDoc!: (docId: string, sessionId?: string) => void;

  @property({ attribute: false })
  accessor peekViewService!: PeekViewService;

  renderToolCall() {
    return html`<tool-call-card
      .name=${`Searching workspace documents for "${this.data.args.query}"`}
      .icon=${SearchIcon()}
      .width=${this.width}
    ></tool-call-card>`;
  }

  renderToolResult() {
    if (this.data.type !== 'tool-result') {
      return nothing;
    }
    const result = this.data.result;
    const parsed = isToolError(result)
      ? null
      : parseDocSearchResults(result, 'keyword');
    if (!parsed) {
      return html`<tool-call-failed
        .name=${getToolErrorDisplayName(
          isToolError(result) ? result : null,
          'Document search failed',
          {
            'Workspace Sync Required':
              'Enable workspace sync to search documents',
          }
        )}
        .icon=${SearchIcon()}
      ></tool-call-failed>`;
    }
    return html`<tool-result-card
      .name=${parsed.scope === 'project'
        ? I18n.t('com.affine.localmind.project-search.results', {
            count: parsed.items.length,
            query: this.data.args.query,
          })
        : `Found ${parsed.items.length} pages for "${this.data.args.query}"`}
      .icon=${SearchIcon()}
      .width=${this.width}
      .results=${parsed.items.map(item => ({
        title: item.title || I18n.t('Untitled'),
        icon: PageIcon(),
        content: item.content,
        onClick: () => {
          if (!item.docId) return;
          if (parsed.scope === 'project' || !this.peekViewService) {
            this.onOpenDoc?.(item.docId);
            return;
          }
          this.peekViewService.peekView
            .open({ type: 'doc', docRef: { docId: item.docId } })
            .catch(console.error);
        },
      }))}
    ></tool-result-card>`;
  }

  protected override render() {
    if (this.data.type === 'tool-call') {
      return this.renderToolCall();
    }
    return this.renderToolResult();
  }
}
