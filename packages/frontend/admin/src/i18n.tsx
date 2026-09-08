import {
  configureI18nModule,
  I18nProvider,
  I18nService,
} from '@affine/core/modules/i18n';
import { configureLocalStorageStateStorageImpls } from '@affine/core/modules/storage';
import { useI18n } from '@affine/i18n';
import {
  Framework,
  FrameworkRoot,
  useLiveData,
  useService,
} from '@toeverything/infra';
import type { PropsWithChildren } from 'react';

const framework = new Framework();
configureLocalStorageStateStorageImpls(framework);
configureI18nModule(framework);
const provider = framework.provider();

export function AdminI18nProvider({ children }: PropsWithChildren) {
  return (
    <FrameworkRoot framework={provider}>
      <I18nProvider>{children}</I18nProvider>
    </FrameworkRoot>
  );
}

export function AdminLanguageSelect() {
  const t = useI18n();
  const i18n = useService(I18nService).i18n;
  const current = useLiveData(i18n.currentLanguage$);
  return (
    <select
      aria-label={t['com.affine.appearanceSettings.language.title']()}
      className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
      value={current.key}
      onChange={event => i18n.changeLanguage(event.target.value)}
    >
      {i18n.languageList.map(language => (
        <option key={language.key} value={language.key} lang={language.key}>
          {language.originalName}
        </option>
      ))}
    </select>
  );
}
