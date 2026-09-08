import { I18nController } from '@affine/core/modules/i18n/lit-controller';
import type { CopilotChatHistoryFragment } from '@affine/graphql';
import { I18n } from '@affine/i18n';
import { WithDisposable } from '@blocksuite/affine/global/lit';
import { type NotificationService } from '@blocksuite/affine/shared/services';
import { unsafeCSSVarV2 } from '@blocksuite/affine/shared/theme';
import { ShadowlessElement } from '@blocksuite/affine/std';
import type { Store } from '@blocksuite/affine/store';
import { css, html } from 'lit';
import { property } from 'lit/decorators.js';

import type { ChatContextValue } from '../ai-chat-content';

export class AIHistoryClear extends WithDisposable(ShadowlessElement) {
  readonly languageController = new I18nController(this);

  @property({ attribute: false })
  accessor chatContextValue!: ChatContextValue;

  @property({ attribute: false })
  accessor session!: CopilotChatHistoryFragment | null | undefined;

  @property({ attribute: false })
  accessor notificationService!: NotificationService;

  @property({ attribute: false })
  accessor doc!: Store;

  @property({ attribute: false })
  accessor onHistoryCleared!: () => void;

  @property({ attribute: false })
  accessor onClearHistory!: (sessionIds: string[]) => Promise<void> | void;

  static override styles = css`
    .chat-history-clear {
      cursor: pointer;
      color: ${unsafeCSSVarV2('icon/primary')};
    }
    .chat-history-clear[aria-disabled='true'] {
      cursor: not-allowed;
      color: ${unsafeCSSVarV2('icon/secondary')};
    }
  `;

  private get _isHistoryClearDisabled() {
    return (
      this.chatContextValue.status === 'loading' ||
      this.chatContextValue.status === 'transmitting' ||
      !this.chatContextValue.messages.length ||
      !this.session
    );
  }

  private readonly _cleanupHistories = async () => {
    if (this._isHistoryClearDisabled || !this.session) {
      return;
    }
    const sessionId = this.session.sessionId;
    try {
      const confirm = await this.notificationService.confirm({
        get title() {
          return I18n['com.affine.ui.clear-history']();
        },
        get message() {
          return I18n[
            'com.affine.ui.are-you-sure-you-want-to-clear-all-history-this-action-will-permanently-delete-all-content-including'
          ]();
        },
        get confirmText() {
          return I18n['com.affine.payment.modal.resume.confirm']();
        },
        get cancelText() {
          return I18n['com.affine.localmind.aiContext.cancel']();
        },
      });

      if (confirm) {
        const actionIds = this.chatContextValue.messages
          .filter(item => 'sessionId' in item)
          .map(item => item.sessionId);
        await this.onClearHistory([
          ...(sessionId ? [sessionId] : []),
          ...(actionIds || []),
        ]);
        this.notificationService.toast(I18n['com.affine.ui.history-cleared']());
        this.onHistoryCleared?.();
      }
    } catch {
      this.notificationService.toast(
        I18n['com.affine.ui.failed-to-clear-history']()
      );
    }
  };

  override render() {
    return html`
      <div
        class="chat-history-clear"
        aria-disabled=${this._isHistoryClearDisabled}
        @click=${this._cleanupHistories}
        data-testid="chat-panel-clear"
      >
        ${I18n['com.affine.office.clear']()}
      </div>
    `;
  }
}
