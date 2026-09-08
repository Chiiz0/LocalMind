/** @vitest-environment happy-dom */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import i18next from 'i18next';
import { useMemo } from 'react';
import { initReactI18next } from 'react-i18next';
import { afterEach, expect, test } from 'vitest';

import { createI18nWrapper } from './i18next';
import { I18nextProvider, useI18n } from './react';

afterEach(cleanup);

test('translation lookup resolves plural keys using the requested count', async () => {
  const instance = i18next.createInstance();
  await instance.init({
    lng: 'en',
    resources: {
      en: {
        translation: {
          pages_zero: 'No pages',
          pages_one: '{{count}} page',
          pages_other: '{{count}} pages',
        },
      },
    },
  });
  const t = createI18nWrapper(() => instance);
  expect(t.t('pages', { count: 0 })).toBe('No pages');
  expect(t.t('pages', { count: 1 })).toBe('1 page');
  expect(t.t('pages', { count: 3 })).toBe('3 pages');
});

test('switching language refreshes memoized labels without resetting form input', async () => {
  const instance = i18next.createInstance();
  await instance.use(initReactI18next).init({
    lng: 'en',
    resources: {
      en: { translation: { label: 'Save' } },
      'zh-Hans': { translation: { label: '保存' } },
    },
  });
  function Form() {
    const t = useI18n();
    const label = useMemo(() => t.t('label'), [t]);
    return (
      <>
        <input aria-label="Draft" defaultValue="" />
        <button>{label}</button>
      </>
    );
  }
  render(
    <I18nextProvider i18n={instance}>
      <Form />
    </I18nextProvider>
  );
  expect(screen.getByRole('button').textContent).toBe('Save');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Draft' } });
  await act(() => instance.changeLanguage('zh-Hans'));
  expect(screen.getByRole('button').textContent).toBe('保存');
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Draft');
  await act(() => instance.changeLanguage('en'));
  expect(screen.getByRole('button').textContent).toBe('Save');
});
