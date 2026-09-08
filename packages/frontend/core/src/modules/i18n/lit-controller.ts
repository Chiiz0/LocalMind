import { getOrCreateI18n } from '@affine/i18n';
import type { ReactiveController, ReactiveControllerHost } from 'lit';

/** Keeps editor menus in sync with the application's display language. */
export class I18nController implements ReactiveController {
  private readonly i18n = getOrCreateI18n();
  private readonly refresh = () => this.host.requestUpdate();

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this);
  }

  hostConnected() {
    this.i18n.on('languageChanged', this.refresh);
  }

  hostDisconnected() {
    this.i18n.off('languageChanged', this.refresh);
  }
}
