import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { createI18nWrapper, getOrCreateI18n } from './i18next';

export const useI18n = () => {
  // Shared components can also render outside the main application's provider.
  getOrCreateI18n();
  const { i18n, t } = useTranslation('translation');

  // A new wrapper invalidates consumers' memoized labels when the locale changes.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => createI18nWrapper(() => i18n), [i18n, t]);
};

export { I18nextProvider, Trans, useTranslation } from 'react-i18next';
