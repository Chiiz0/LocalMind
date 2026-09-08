/** @vitest-environment happy-dom */
import { notify } from '@affine/component';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  type ProjectEditGuard,
  ProjectEditorGuard,
  useProjectEditGuard,
  useProjectUnsavedConfirmation,
} from './edit-guard';

vi.mock('@affine/i18n', () => ({
  useI18n: () => new Proxy({}, { get: (_, key) => () => String(key) }),
}));
vi.mock('@affine/component', () => ({
  notify: { error: vi.fn() },
  Button: ({
    children,
    onClick,
    disabled,
  }: PropsWithChildren<{ onClick: () => void; disabled: boolean }>) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Modal: ({ open, children }: PropsWithChildren<{ open: boolean }>) =>
    open ? <div role="dialog">{children}</div> : null,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup(saveError = false) {
  let dirty = true;
  const guard: ProjectEditGuard = {
    get hasUnsavedChanges() {
      return dirty;
    },
    save: vi.fn(async () => {
      if (saveError) throw new Error('private server exception');
      dirty = false;
    }),
    discard: vi.fn(async () => {
      dirty = false;
    }),
    suspend: vi.fn(),
    resume: vi.fn(),
  };
  const reload = vi.fn();
  function Editor() {
    useProjectEditGuard(guard);
    const confirm = useProjectUnsavedConfirmation();
    return (
      <>
        <Link to="/project">Close</Link>
        <button
          onClick={() => {
            void confirm()
              .then(allowed => {
                if (allowed) reload();
              })
              .catch(error => notify.error({ title: String(error) }));
          }}
        >
          History
        </button>
      </>
    );
  }
  const router = createMemoryRouter(
    [
      {
        path: '/resource',
        element: (
          <ProjectEditorGuard>
            <Editor />
          </ProjectEditorGuard>
        ),
      },
      { path: '/project', element: <p>Project files</p> },
    ],
    { initialEntries: ['/resource'] }
  );
  render(<RouterProvider router={router} />);
  return { guard, router, reload };
}

describe('ProjectEditorGuard', () => {
  test('cancel stays on the resource and discard leaves without saving', async () => {
    const { guard, router } = setup();
    fireEvent.click(screen.getByText('Close'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(guard.suspend).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Cancel'));
    expect(router.state.location.pathname).toBe('/resource');
    expect(guard.hasUnsavedChanges).toBe(true);
    fireEvent.click(screen.getByText('Close'));
    fireEvent.click(
      screen.getByText('com.affine.localmind.project-files.discard')
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/project')
    );
    expect(guard.discard).toHaveBeenCalledOnce();
    expect(guard.save).not.toHaveBeenCalled();
  });

  test('save must finish before navigation; failure is localized and retains changes', async () => {
    const { guard, router } = setup(true);
    fireEvent.click(screen.getByText('Close'));
    fireEvent.click(
      screen.getByText('com.affine.localmind.project-files.save')
    );
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith({
        title: 'com.affine.localmind.project-files.operationFailed',
      })
    );
    expect(router.state.location.pathname).toBe('/resource');
    expect(guard.hasUnsavedChanges).toBe(true);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText('private server exception')).toBeNull();
  });

  test('history selection shares the guard and only proceeds after save', async () => {
    const { guard, reload, router } = setup();
    fireEvent.click(screen.getByText('History'));
    await act(async () => {});
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByText('com.affine.localmind.project-files.save')
    );
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(guard.save).toHaveBeenCalledOnce();
    expect(router.state.location.pathname).toBe('/resource');
    expect(guard.hasUnsavedChanges).toBe(false);
  });
});
