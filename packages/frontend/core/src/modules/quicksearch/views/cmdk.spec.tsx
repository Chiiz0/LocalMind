/** @vitest-environment happy-dom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CMDK } from './cmdk';

vi.mock('@affine/component', () => ({
  IconButton: ({
    tooltip,
    children,
    ...props
  }: React.PropsWithChildren<{ tooltip: string }>) => (
    <button aria-label={tooltip} {...props}>
      {children}
    </button>
  ),
}));
vi.mock('@affine/i18n', () => ({
  useI18n: () =>
    new Proxy(
      {
        t: (value: string | { i18nKey: string }) =>
          typeof value === 'string' ? value : value.i18nKey,
      },
      { get: (target, key) => (key === 't' ? target.t : () => String(key)) }
    ),
  isI18nString: (value: unknown) =>
    typeof value === 'string' ||
    !!(value && typeof value === 'object' && 'i18nKey' in value),
  i18nTime: () => '',
}));
const doc = (id: string) => ({
  id,
  source: 'docs',
  label: { title: id },
  payload: { docId: id },
});
afterEach(cleanup);

describe('document search keyboard continuity', () => {
  it('selects a valid result after the previously selected document disappears', async () => {
    const submit = vi.fn();
    const { rerender } = render(
      <CMDK
        query="a"
        groups={[{ items: [doc('a'), doc('b')] }]}
        onSubmit={submit}
      />
    );
    await waitFor(() =>
      expect(
        screen.getByRole('option', { name: 'a' }).getAttribute('aria-selected')
      ).toBe('true')
    );
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    rerender(
      <CMDK query="c" groups={[{ items: [doc('c')] }]} onSubmit={submit} />
    );
    await waitFor(() =>
      expect(
        screen.getByRole('option', { name: 'c' }).getAttribute('aria-selected')
      ).toBe('true')
    );
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(submit).toHaveBeenCalledWith(doc('c'));
  });

  it('does not submit an IME candidate and preserves the side-open intent', async () => {
    const submit = vi.fn();
    const beside = vi.fn();
    render(
      <CMDK
        query="资料"
        groups={[{ items: [doc('source')] }]}
        onSubmit={submit}
        onOpenBeside={beside}
      />
    );
    await waitFor(() =>
      expect(screen.getByRole('option').getAttribute('aria-selected')).toBe(
        'true'
      )
    );
    fireEvent.keyDown(screen.getByRole('combobox'), {
      key: 'Enter',
      isComposing: true,
    });
    expect(submit).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('combobox'), {
      key: 'Enter',
      altKey: true,
    });
    expect(beside).toHaveBeenCalledWith(doc('source'));
    expect(submit).not.toHaveBeenCalled();
  });
});
