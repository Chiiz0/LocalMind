import type { PeekViewService } from '@affine/core/modules/peek-view';
import { I18n } from '@affine/i18n';
import { WithDisposable } from '@blocksuite/global/lit';
import { AiEmbeddingIcon, PageIcon } from '@blocksuite/icons/lit';
import { ShadowlessElement } from '@blocksuite/std';
import type { Signal } from '@preact/signals-core';
import { html, nothing } from 'lit';
import { property } from 'lit/decorators.js';

import type { DocDisplayConfig } from '../ai-chat-chips';
import { parseDocSearchResults } from './doc-search-result';
import { getToolErrorDisplayName, isToolError } from './tool-result-utils';

interface DocSemanticSearchToolCall {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: { query: string };
}

interface DocSemanticSearchToolResult {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  args: { query: string };
  result: unknown;
}

function parseResultContent(content: string) {
  const properties = [
    'Title',
    'Created at',
    'Updated at',
    'Created by',
    'Updated by',
  ];
  try {
    // A row starts with "Title: ${title}\n"
    const title = content.match(/^Title:\s+(.*)\n/)?.[1];
    // from first row that not starts with "${propertyName}:" to end of the content
    const rows = content.split('\n');
    const startIndex = rows.findIndex(
      line => !properties.some(property => line.startsWith(`${property}:`))
    );
    const text = rows.slice(startIndex).join('\n');
    return {
      title,
      content: text,
      icon: PageIcon(),
    };
  } catch (error) {
    console.error('Failed to parse result content', error);
    return null;
  }
}

export class DocSemanticSearchResult extends WithDisposable(ShadowlessElement) {
  @property({ attribute: false })
  accessor data!: DocSemanticSearchToolCall | DocSemanticSearchToolResult;

  @property({ attribute: false })
  accessor width: Signal<number | undefined> | undefined;

  @property({ attribute: false })
  accessor docDisplayService!: DocDisplayConfig;

  @property({ attribute: false })
  accessor onOpenDoc!: (docId: string, sessionId?: string) => void;

  @property({ attribute: false })
  accessor peekViewService!: PeekViewService;

  renderToolCall() {
    return html`<tool-call-card
      .name=${`Finding semantically related pages for "${this.data.args.query}"`}
      .icon=${AiEmbeddingIcon()}
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
      : parseDocSearchResults(result, 'semantic');
    if (!parsed) {
      return html`<tool-call-failed
        .name=${getToolErrorDisplayName(
          isToolError(result) ? result : null,
          'Semantic search failed',
          {
            'Workspace Sync Required':
              'Enable workspace sync to search documents',
          }
        )}
        .icon=${AiEmbeddingIcon()}
      ></tool-call-failed>`;
    }
    return html`<tool-result-card
      .name=${parsed.scope === 'project'
        ? I18n.t('com.affine.localmind.project-search.results', {
            count: parsed.items.length,
            query: this.data.args.query,
          })
        : `Found semantically related pages for "${this.data.args.query}"`}
      .icon=${AiEmbeddingIcon()}
      .width=${this.width}
      .results=${parsed.items.map(item => {
        const docId = item.docId;
        const preview = item.content ? parseResultContent(item.content) : null;
        return {
          ...preview,
          icon: PageIcon(),
          title:
            (parsed.scope === 'workspace' && item.docId
              ? this.docDisplayService?.getTitle(item.docId)
              : null) ||
            item.title ||
            preview?.title ||
            I18n.t('Untitled'),
          content: parsed.scope === 'project' ? item.content : preview?.content,
          onClick: docId
            ? () => {
                if (parsed.scope === 'project' || !this.peekViewService) {
                  this.onOpenDoc?.(docId);
                  return;
                }
                this.peekViewService.peekView
                  .open({ type: 'doc', docRef: { docId } })
                  .catch(console.error);
              }
            : undefined,
        };
      })}
    ></tool-result-card>`;
  }

  protected override render() {
    const { data } = this;

    if (data.type === 'tool-call') {
      return this.renderToolCall();
    }
    if (data.type === 'tool-result') {
      return this.renderToolResult();
    }
    return nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'doc-semantic-search-result': DocSemanticSearchResult;
  }
}
