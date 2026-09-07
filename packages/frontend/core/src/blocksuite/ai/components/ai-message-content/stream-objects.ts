import type { FeatureFlagService } from '@affine/core/modules/feature-flag';
import type { PeekViewService } from '@affine/core/modules/peek-view';
import { WithDisposable } from '@blocksuite/affine/global/lit';
import type { ColorScheme } from '@blocksuite/affine/model';
import { unsafeCSSVarV2 } from '@blocksuite/affine/shared/theme';
import {
  type BlockStdScope,
  type EditorHost,
  ShadowlessElement,
} from '@blocksuite/affine/std';
import type { ExtensionType } from '@blocksuite/affine/store';
import type { NotificationService } from '@blocksuite/affine-shared/services';
import { PageIcon, ViewIcon } from '@blocksuite/icons/lit';
import type { Signal } from '@preact/signals-core';
import { css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';

import type { AffineAIPanelState } from '../../widgets/ai-panel/type';
import type { DocDisplayConfig } from '../ai-chat-chips';
import type {
  BlockerSuggestion,
  BlockerSuggestionConfirmation,
  BlockerSuggestionType,
  StreamObject,
} from '../ai-chat-messages';
import { isToolError } from '../ai-tools/tool-result-utils';

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const blockerSuggestionTypes = new Set<BlockerSuggestionType>([
  'wait_reply',
  'wait_file',
  'wait_decision',
  'custom',
]);
const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function boundedString(value: unknown, maximum = 512) {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximum &&
    value.trim() === value
    ? value
    : null;
}

export function blockerSuggestionFromToolResult(
  toolName: string,
  result: unknown,
  isError = false
): BlockerSuggestion | null {
  if (toolName !== 'blocker_suggest' || isError) return null;
  const value = record(result);
  if (!value) return null;
  const aiSuggestionId = boundedString(value.aiSuggestionId);
  const confirmationProof = boundedString(value.confirmationProof, 4096);
  const projectId = boundedString(value.projectId);
  const title = boundedString(value.title);
  const waitingOn = boundedString(value.waitingOn);
  const type = value.type;
  const dueAt = value.dueAt ?? null;
  const boundedDueAt = dueAt === null ? null : boundedString(dueAt, 128);
  if (
    !aiSuggestionId ||
    !uuidV4Pattern.test(aiSuggestionId) ||
    !confirmationProof ||
    !projectId ||
    !title ||
    !waitingOn ||
    typeof type !== 'string' ||
    !blockerSuggestionTypes.has(type as BlockerSuggestionType) ||
    value.origin !== 'ai_suggested' ||
    value.confirmationRequired !== true ||
    (dueAt !== null &&
      (!boundedDueAt || Number.isNaN(new Date(boundedDueAt).getTime())))
  ) {
    return null;
  }
  return {
    aiSuggestionId,
    confirmationProof,
    projectId,
    title,
    type: type as BlockerSuggestionType,
    waitingOn,
    dueAt: boundedDueAt,
    origin: 'ai_suggested',
    confirmationRequired: true,
  };
}

function officePreviewSummary(result: Record<string, unknown>) {
  const preview = record(result.previewSummary);
  const operation =
    typeof preview?.operation === 'string'
      ? preview.operation.replace(/^office\./, '').replace(/[._]/g, ' ')
      : null;
  const commandCount =
    typeof result.commandCount === 'number'
      ? result.commandCount
      : typeof preview?.commandCount === 'number'
        ? preview.commandCount
        : null;
  return [
    operation ? `Operation: ${operation}` : null,
    commandCount === null ? null : `Commands: ${commandCount}`,
  ]
    .filter(Boolean)
    .join('. ');
}

export type OfficeToolResultView =
  | { status: 'error'; name: string }
  | {
      status: 'success';
      kind: 'read' | 'request';
      name: string;
      results: Array<{ title: string; content: string }>;
    };

export function officeToolResultView(
  toolName: string,
  result: unknown,
  isError = false
): OfficeToolResultView {
  if (isError || !result || isToolError(result)) {
    const value = record(result);
    return {
      status: 'error',
      name: isToolError(result)
        ? result.name
        : toolName === 'office_read'
          ? 'Office read failed'
          : typeof value?.message === 'string' && value.message.length <= 120
            ? value.message
            : 'Office change request failed',
    };
  }
  const value = record(result);
  if (!value) {
    return {
      status: 'error',
      name: 'Office tool returned invalid evidence',
    };
  }
  if (toolName === 'office_read') {
    if (
      typeof value.revisionId !== 'string' ||
      !value.revisionId ||
      typeof value.sequence !== 'number' ||
      !Number.isInteger(value.sequence) ||
      value.sequence < 1
    )
      return { status: 'error', name: 'Office read failed' };
    const revision =
      typeof value.sequence === 'number'
        ? `Revision ${value.sequence}`
        : typeof value.revisionId === 'string'
          ? value.revisionId
          : 'Current revision';
    const content = value.truncated
      ? 'The Office state exceeded the bounded read limit. A stable-ID index was returned for a narrower follow-up read.'
      : 'Bounded native Office semantic state was read successfully.';
    return {
      status: 'success',
      kind: 'read',
      name: `Read ${revision}`,
      results: [{ title: revision, content }],
    };
  }
  const taskId = typeof value.taskId === 'string' ? value.taskId : null;
  const waiting = value.approvalRequired === true;
  const summary = officePreviewSummary(value);
  return {
    status: 'success',
    kind: 'request',
    name: waiting
      ? 'Office change awaiting approval'
      : 'Office change request saved',
    results: [
      {
        title: waiting ? 'Approval required' : 'Request persisted',
        content: [
          taskId ? `Task ${taskId}.` : null,
          waiting
            ? 'No Office revision has been created. Approve or reject the persisted task in the Office sidebar.'
            : 'Execution status is available from the persisted Office task.',
        ]
          .filter(Boolean)
          .join(' '),
      },
      ...(summary ? [{ title: 'Preview evidence', content: summary }] : []),
    ],
  };
}

export class ChatContentStreamObjects extends WithDisposable(
  ShadowlessElement
) {
  static override styles = css`
    .reasoning-wrapper {
      padding: 16px 20px;
      margin: 8px 0;
      border-radius: 8px;
      background-color: rgba(0, 0, 0, 0.05);
    }

    .blocker-suggestion {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 8px 0;
      padding: 12px;
      border: 0.5px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
      border-radius: 8px;
      background: ${unsafeCSSVarV2('layer/background/primary')};
      color: ${unsafeCSSVarV2('text/primary')};
    }

    .blocker-suggestion h4 {
      margin: 0;
      font-size: 13px;
      line-height: 18px;
      font-weight: 600;
      letter-spacing: 0;
    }

    .blocker-suggestion-title {
      min-width: 0;
      margin: 0;
      font-size: 13px;
      line-height: 19px;
      overflow-wrap: anywhere;
    }

    .blocker-suggestion-details {
      min-width: 0;
      display: grid;
      grid-template-columns: minmax(72px, auto) minmax(0, 1fr);
      gap: 4px 10px;
      margin: 0;
      font-size: 12px;
      line-height: 17px;
    }

    .blocker-suggestion-details dt {
      color: ${unsafeCSSVarV2('text/tertiary')};
    }

    .blocker-suggestion-details dd {
      min-width: 0;
      margin: 0;
      color: ${unsafeCSSVarV2('text/secondary')};
      overflow-wrap: anywhere;
    }

    .blocker-suggestion-footer {
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .blocker-suggestion-error {
      min-width: 0;
      color: ${unsafeCSSVarV2('button/error')};
      font-size: 12px;
      line-height: 17px;
      overflow-wrap: anywhere;
    }

    .blocker-suggestion button {
      min-height: 30px;
      flex-shrink: 0;
      padding: 5px 10px;
      border: 0;
      border-radius: 4px;
      background: ${unsafeCSSVarV2('button/primary')};
      color: ${unsafeCSSVarV2('text/pureWhite')};
      font: inherit;
      font-size: 12px;
      line-height: 18px;
      letter-spacing: 0;
      cursor: pointer;
    }

    .blocker-suggestion button:hover:not(:disabled) {
      filter: brightness(0.96);
    }

    .blocker-suggestion button:focus-visible {
      outline: 2px solid ${unsafeCSSVarV2('button/primary')};
      outline-offset: 2px;
    }

    .blocker-suggestion button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    @media (max-width: 480px) {
      .blocker-suggestion-details {
        grid-template-columns: minmax(0, 1fr);
        gap: 2px;
      }

      .blocker-suggestion-details dd:not(:last-child) {
        margin-bottom: 5px;
      }

      .blocker-suggestion-footer {
        align-items: stretch;
        flex-direction: column;
      }

      .blocker-suggestion button {
        width: 100%;
        font-size: 16px;
      }
    }
  `;

  @property({ attribute: false })
  accessor answer!: StreamObject[];

  @property({ attribute: false })
  accessor host: EditorHost | null | undefined;

  @property({ attribute: false })
  accessor std: BlockStdScope | null | undefined;

  @property({ attribute: false })
  accessor state: AffineAIPanelState = 'finished';

  @property({ attribute: false })
  accessor width: Signal<number | undefined> | undefined;

  @property({ attribute: false })
  accessor extensions!: ExtensionType[];

  @property({ attribute: false })
  accessor affineFeatureFlagService!: FeatureFlagService;

  @property({ attribute: false })
  accessor theme!: Signal<ColorScheme>;

  @property({ attribute: false })
  accessor independentMode: boolean | undefined;

  @property({ attribute: false })
  accessor notificationService!: NotificationService;

  @property({ attribute: false })
  accessor docDisplayService!: DocDisplayConfig;

  @property({ attribute: false })
  accessor peekViewService!: PeekViewService;

  @property({ attribute: false })
  accessor onOpenDoc!: (docId: string, sessionId?: string) => void;

  @property({ attribute: false })
  accessor blockerSuggestionConfirmation:
    | BlockerSuggestionConfirmation
    | undefined;

  @state()
  private accessor pendingBlockerSuggestions = new Set<string>();

  @state()
  private accessor confirmedBlockerSuggestions = new Set<string>();

  @state()
  private accessor blockerSuggestionErrors = new Set<string>();

  private async confirmBlockerSuggestion(suggestion: BlockerSuggestion) {
    const confirmation = this.blockerSuggestionConfirmation;
    const id = suggestion.aiSuggestionId;
    if (
      !confirmation ||
      this.pendingBlockerSuggestions.has(id) ||
      this.confirmedBlockerSuggestions.has(id)
    ) {
      return;
    }
    this.pendingBlockerSuggestions = new Set(
      this.pendingBlockerSuggestions
    ).add(id);
    const nextErrors = new Set(this.blockerSuggestionErrors);
    nextErrors.delete(id);
    this.blockerSuggestionErrors = nextErrors;
    try {
      await confirmation.onConfirm(suggestion);
      this.confirmedBlockerSuggestions = new Set(
        this.confirmedBlockerSuggestions
      ).add(id);
    } catch {
      this.blockerSuggestionErrors = new Set(this.blockerSuggestionErrors).add(
        id
      );
    } finally {
      const nextPending = new Set(this.pendingBlockerSuggestions);
      nextPending.delete(id);
      this.pendingBlockerSuggestions = nextPending;
    }
  }

  private renderBlockerSuggestion(streamObject: StreamObject) {
    if (streamObject.type !== 'tool-result') return null;
    const confirmation = this.blockerSuggestionConfirmation;
    const suggestion = blockerSuggestionFromToolResult(
      streamObject.toolName,
      streamObject.result,
      streamObject.isError === true
    );
    if (!confirmation || !suggestion) return null;
    const pending = this.pendingBlockerSuggestions.has(
      suggestion.aiSuggestionId
    );
    const confirmed = this.confirmedBlockerSuggestions.has(
      suggestion.aiSuggestionId
    );
    const failed = this.blockerSuggestionErrors.has(suggestion.aiSuggestionId);
    const { labels } = confirmation;
    return html`<section
      class="blocker-suggestion"
      aria-label=${labels.title}
      aria-busy=${pending ? 'true' : 'false'}
    >
      <h4>${labels.title}</h4>
      <p class="blocker-suggestion-title">${suggestion.title}</p>
      <dl class="blocker-suggestion-details">
        <dt>${labels.type}</dt>
        <dd>${labels.typeNames[suggestion.type]}</dd>
        <dt>${labels.waitingOn}</dt>
        <dd>${suggestion.waitingOn}</dd>
        ${suggestion.dueAt
          ? html`<dt>${labels.dueAt}</dt>
              <dd>${new Date(suggestion.dueAt).toLocaleString()}</dd>`
          : nothing}
      </dl>
      <div class="blocker-suggestion-footer">
        ${failed
          ? html`<span class="blocker-suggestion-error" role="alert"
              >${labels.failed}</span
            >`
          : html`<span></span>`}
        <button
          type="button"
          ?disabled=${pending || confirmed}
          @click=${() => void this.confirmBlockerSuggestion(suggestion)}
        >
          ${confirmed
            ? labels.created
            : pending
              ? labels.creating
              : labels.create}
        </button>
      </div>
    </section>`;
  }

  private renderOfficeToolCall(streamObject: StreamObject) {
    if (streamObject.type !== 'tool-call') return nothing;
    const name =
      streamObject.toolName === 'office_read'
        ? 'Reading current Office revision'
        : streamObject.toolName === 'office_command_batch_request'
          ? 'Preparing an atomic Office change set'
          : 'Preparing an Office change';
    return html`<tool-call-card
      .name=${name}
      .icon=${streamObject.toolName === 'office_read' ? ViewIcon() : PageIcon()}
      .width=${this.width}
    ></tool-call-card>`;
  }

  private renderOfficeToolResult(streamObject: StreamObject) {
    if (streamObject.type !== 'tool-result') return nothing;
    const view = officeToolResultView(
      streamObject.toolName,
      streamObject.result,
      streamObject.isError === true
    );
    if (view.status === 'error') {
      return html`<tool-call-failed
        .name=${view.name}
        .icon=${PageIcon()}
      ></tool-call-failed>`;
    }
    return html`<tool-result-card
      .name=${view.name}
      .icon=${view.kind === 'read' ? ViewIcon() : PageIcon()}
      .width=${this.width}
      .results=${view.results.map((result, index) => ({
        ...result,
        icon: view.kind === 'read' || index === 0 ? PageIcon() : ViewIcon(),
      }))}
    ></tool-result-card>`;
  }

  private renderToolCall(streamObject: StreamObject) {
    if (streamObject.type !== 'tool-call') {
      return nothing;
    }

    switch (streamObject.toolName) {
      case 'web_crawl_exa':
        return html`
          <web-crawl-tool
            .data=${streamObject}
            .width=${this.width}
          ></web-crawl-tool>
        `;
      case 'web_search_exa':
        return html`
          <web-search-tool
            .data=${streamObject}
            .width=${this.width}
          ></web-search-tool>
        `;
      case 'doc_compose':
        return html`
          <doc-compose-tool
            .std=${this.std || this.host?.std}
            .data=${streamObject}
            .width=${this.width}
            .theme=${this.theme}
            .notificationService=${this.notificationService}
          ></doc-compose-tool>
        `;
      case 'code_artifact':
        return html`
          <code-artifact-tool
            .std=${this.std || this.host?.std}
            .data=${streamObject}
            .width=${this.width}
            .theme=${this.theme}
          ></code-artifact-tool>
        `;
      case 'doc_edit':
        return html`
          <doc-edit-tool
            .data=${streamObject}
            .doc=${this.host?.store}
            .notificationService=${this.notificationService}
          ></doc-edit-tool>
        `;
      case 'doc_semantic_search':
        return html`<doc-semantic-search-result
          .data=${streamObject}
          .width=${this.width}
          .peekViewService=${this.peekViewService}
        ></doc-semantic-search-result>`;
      case 'doc_keyword_search':
        return html`<doc-keyword-search-result
          .data=${streamObject}
          .width=${this.width}
        ></doc-keyword-search-result>`;
      case 'doc_read':
        return html`<doc-read-result
          .data=${streamObject}
          .width=${this.width}
        ></doc-read-result>`;
      case 'office_read':
      case 'office_command_request':
      case 'office_command_batch_request':
        return this.renderOfficeToolCall(streamObject);
      case 'doc_create':
      case 'doc_update':
      case 'doc_update_meta':
        return html`<doc-write-tool
          .data=${streamObject}
          .width=${this.width}
          .peekViewService=${this.peekViewService}
          .docDisplayService=${this.docDisplayService}
          .onOpenDoc=${this.onOpenDoc}
        ></doc-write-tool>`;
      case 'section_edit':
        return html`
          <section-edit-tool
            .data=${streamObject}
            .extensions=${this.extensions}
            .affineFeatureFlagService=${this.affineFeatureFlagService}
            .notificationService=${this.notificationService}
            .theme=${this.theme}
            .host=${this.host}
            .independentMode=${this.independentMode}
          ></section-edit-tool>
        `;
      default: {
        const name = streamObject.toolName + ' tool calling';
        return html`
          <tool-call-card .name=${name} .width=${this.width}></tool-call-card>
        `;
      }
    }
  }

  private renderToolResult(streamObject: StreamObject) {
    if (streamObject.type !== 'tool-result') {
      return nothing;
    }

    switch (streamObject.toolName) {
      case 'web_crawl_exa':
        return html`
          <web-crawl-tool
            .data=${streamObject}
            .width=${this.width}
          ></web-crawl-tool>
        `;
      case 'web_search_exa':
        return html`
          <web-search-tool
            .data=${streamObject}
            .width=${this.width}
          ></web-search-tool>
        `;
      case 'doc_compose':
        return html`
          <doc-compose-tool
            .std=${this.std || this.host?.std}
            .data=${streamObject}
            .width=${this.width}
            .theme=${this.theme}
            .notificationService=${this.notificationService}
          ></doc-compose-tool>
        `;
      case 'code_artifact':
        return html`
          <code-artifact-tool
            .std=${this.std || this.host?.std}
            .data=${streamObject}
            .width=${this.width}
            .theme=${this.theme}
            .notificationService=${this.notificationService}
          ></code-artifact-tool>
        `;
      case 'doc_edit':
        return html`
          <doc-edit-tool
            .data=${streamObject}
            .host=${this.host}
            .renderRichText=${this.renderRichText.bind(this)}
            .notificationService=${this.notificationService}
          ></doc-edit-tool>
        `;
      case 'doc_semantic_search':
        return html`<doc-semantic-search-result
          .data=${streamObject}
          .width=${this.width}
          .docDisplayService=${this.docDisplayService}
          .peekViewService=${this.peekViewService}
          .onOpenDoc=${this.onOpenDoc}
        ></doc-semantic-search-result>`;
      case 'doc_keyword_search':
        return html`<doc-keyword-search-result
          .data=${streamObject}
          .width=${this.width}
          .peekViewService=${this.peekViewService}
          .onOpenDoc=${this.onOpenDoc}
        ></doc-keyword-search-result>`;
      case 'doc_read':
        return html`<doc-read-result
          .data=${streamObject}
          .width=${this.width}
          .peekViewService=${this.peekViewService}
          .onOpenDoc=${this.onOpenDoc}
        ></doc-read-result>`;
      case 'office_read':
      case 'office_command_request':
      case 'office_command_batch_request':
        return this.renderOfficeToolResult(streamObject);
      case 'blocker_suggest': {
        const suggestion = this.renderBlockerSuggestion(streamObject);
        if (suggestion) return suggestion;
        return html`
          <tool-result-card
            .name=${streamObject.toolName + ' tool result'}
            .width=${this.width}
          ></tool-result-card>
        `;
      }
      case 'doc_create':
      case 'doc_update':
      case 'doc_update_meta':
        return html`<doc-write-tool
          .data=${streamObject}
          .width=${this.width}
          .peekViewService=${this.peekViewService}
          .docDisplayService=${this.docDisplayService}
          .onOpenDoc=${this.onOpenDoc}
        ></doc-write-tool>`;
      case 'section_edit':
        return html`
          <section-edit-tool
            .data=${streamObject}
            .extensions=${this.extensions}
            .affineFeatureFlagService=${this.affineFeatureFlagService}
            .notificationService=${this.notificationService}
            .theme=${this.theme}
            .host=${this.host}
            .independentMode=${this.independentMode}
          ></section-edit-tool>
        `;
      default: {
        const name = streamObject.toolName + ' tool result';
        return html`
          <tool-result-card
            .name=${name}
            .width=${this.width}
          ></tool-result-card>
        `;
      }
    }
  }

  private renderRichText(text: string) {
    return html`<chat-content-rich-text
      .text=${text}
      .state=${this.state}
      .extensions=${this.extensions}
      .affineFeatureFlagService=${this.affineFeatureFlagService}
      .theme=${this.theme}
    ></chat-content-rich-text>`;
  }

  protected override render() {
    return html`<div>
      ${this.answer.map(data => {
        switch (data.type) {
          case 'text-delta':
            return this.renderRichText(data.textDelta);
          case 'reasoning':
            return html`
              <div class="reasoning-wrapper">
                ${this.renderRichText(data.textDelta)}
              </div>
            `;
          case 'tool-call':
            return this.renderToolCall(data);
          case 'tool-result':
            return this.renderToolResult(data);
          default:
            return nothing;
        }
      })}
    </div>`;
  }
}
