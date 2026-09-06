/** @vitest-environment happy-dom */
/* eslint-disable rxjs/finnish */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { PublicDoc } from './public-page-button';

const mocks = vi.hoisted(() => ({
  disableShare: vi.fn(),
  enableShare: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@affine/component', () => ({
  Menu: ({
    items,
    children,
  }: React.PropsWithChildren<{ items: React.ReactNode }>) => (
    <>
      {items}
      {children}
    </>
  ),
  MenuItem: ({
    children,
    onSelect,
    disabled,
  }: React.PropsWithChildren<{ onSelect: () => void; disabled: boolean }>) => (
    <button onClick={onSelect} disabled={disabled}>
      {children}
    </button>
  ),
  MenuTrigger: ({ children }: React.PropsWithChildren) => (
    <span>{children}</span>
  ),
  notify: { success: mocks.success, error: mocks.error },
}));
vi.mock('@affine/i18n', () => ({
  useI18n: () => new Proxy({}, { get: (_, key) => () => String(key) }),
}));
vi.mock('@affine/core/modules/editor', () => ({ EditorService: 'editor' }));
vi.mock('@affine/core/modules/share-doc', () => ({
  ShareInfoService: 'share',
}));
vi.mock('@toeverything/infra', () => ({
  useLiveData: (value: { value: unknown }) => value.value,
  useService: (key: string) =>
    key === 'editor'
      ? { editor: { mode$: { value: 'page' } } }
      : {
          shareInfo: {
            isShared$: { value: true },
            isRevalidating$: { value: false },
            revalidate: () => {},
            disableShare: mocks.disableShare,
            enableShare: mocks.enableShare,
          },
        },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('prevents repeated revocation and reports success after completion', async () => {
  let finish!: () => void;
  mocks.disableShare.mockReturnValue(
    new Promise<void>(resolve => {
      finish = resolve;
    })
  );
  render(<PublicDoc />);
  const button = screen.getByRole('button', {
    name: 'com.affine.share-menu.option.link.no-access',
  });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(mocks.disableShare).toHaveBeenCalledTimes(1);
  expect(mocks.success).not.toHaveBeenCalled();
  finish();
  await waitFor(() => expect(mocks.success).toHaveBeenCalledTimes(1));
  expect(mocks.error).not.toHaveBeenCalled();
});

it('reports a failed revocation without a success notification', async () => {
  mocks.disableShare.mockRejectedValue(new Error('network unavailable'));
  render(<PublicDoc />);
  fireEvent.click(
    screen.getByRole('button', {
      name: 'com.affine.share-menu.option.link.no-access',
    })
  );
  await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
  expect(mocks.success).not.toHaveBeenCalled();
});

it('does not expose mutations in a disabled share view', () => {
  render(<PublicDoc disabled />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(mocks.disableShare).not.toHaveBeenCalled();
});
