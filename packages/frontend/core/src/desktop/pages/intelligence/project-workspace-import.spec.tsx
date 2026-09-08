/** @vitest-environment happy-dom */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { PropsWithChildren, ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  gql: vi.fn(),
  query: vi.fn(),
  mutate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  sourceError: false,
  permission: 'approval',
  sources: true,
  status: 'waiting_approval',
  failureCode: null as string | null,
}));
vi.mock('@affine/core/modules/cloud', () => ({ GraphQLService: class {} }));
vi.mock('@toeverything/infra', () => ({
  useService: () => ({ gql: mock.gql }),
}));
vi.mock('@affine/core/components/hooks/use-query', () => ({
  useQuery: (...args: unknown[]) => mock.query(...args),
}));
vi.mock('@affine/i18n', () => ({
  useI18n: () => new Proxy({}, { get: (_, key) => () => String(key) }),
}));
vi.mock('@affine/component', () => ({
  notify: { success: mock.success, error: mock.error },
  Loading: () => <span>Loading</span>,
  Button: ({
    children,
    disabled,
    onClick,
  }: PropsWithChildren<{ disabled?: boolean; onClick?: () => void }>) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Input: ({
    value,
    onChange,
    disabled,
    ...props
  }: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    'aria-label'?: string;
  }) => (
    <input
      aria-label={props['aria-label']}
      value={value}
      disabled={disabled}
      onChange={event => onChange(event.target.value)}
    />
  ),
  Modal: ({ children, title }: { children: ReactNode; title: string }) => (
    <div role="dialog" aria-label={title}>
      {children}
    </div>
  ),
}));

import {
  projectImportSourcesQuery,
  projectImportWorkspacesQuery,
  projectWorkspaceImportsQuery,
  retryProjectWorkspaceImportMutation,
  submitProjectWorkspaceImportMutation,
} from '@affine/graphql';

import {
  ProjectWorkspaceImportPicker,
  ProjectWorkspaceImportStatus,
} from './project-workspace-import';
const key = (value: string) => `com.affine.localmind.workspace-import.${value}`;
beforeEach(() => {
  vi.clearAllMocks();
  mock.sourceError = false;
  mock.permission = 'approval';
  mock.sources = true;
  mock.status = 'waiting_approval';
  mock.failureCode = null;
  mock.mutate.mockResolvedValue(undefined);
  mock.query.mockImplementation(options => ({
    isLoading: false,
    mutate: mock.mutate,
    error:
      options?.query === projectImportSourcesQuery && mock.sourceError
        ? new Error('denied')
        : undefined,
    data:
      options?.query === projectImportWorkspacesQuery
        ? {
            projectImportWorkspaces: {
              items: [
                { id: 'workspace-1', name: 'Engineering' },
                { id: 'workspace-2', name: 'Finance' },
              ],
              nextCursor: null,
            },
          }
        : options?.query === projectImportSourcesQuery
          ? {
              projectImportSources: {
                items: mock.sources
                  ? [
                      {
                        id: 'doc-1',
                        title: 'Report',
                        kind: 'page',
                        permission: mock.permission,
                      },
                    ]
                  : [],
                nextCursor: null,
              },
            }
          : options?.query === projectWorkspaceImportsQuery
            ? {
                projectWorkspaceImports: {
                  items: [
                    {
                      id: 'run-1',
                      title: 'Report',
                      status: mock.status,
                      failureCode: mock.failureCode,
                      resourceId: mock.status === 'completed' ? 'copy-1' : null,
                    },
                  ],
                  nextCursor: null,
                },
              }
            : undefined,
  }));
});
afterEach(cleanup);
function choose() {
  fireEvent.click(screen.getByRole('button', { name: 'Engineering' }));
  fireEvent.click(screen.getByRole('radio'));
}

test('selects a workspace before files and submits an explicit approval request to the current folder', async () => {
  const submitted = vi.fn(),
    close = vi.fn();
  const pending = Promise.withResolvers<unknown>();
  mock.gql.mockReturnValue(pending.promise);
  render(
    <ProjectWorkspaceImportPicker
      projectId="project-1"
      parentId="folder-1"
      onSubmitted={submitted}
      onClose={close}
    />
  );
  expect(screen.queryByRole('radio')).toBeNull();
  expect(
    screen.getByRole('button', { name: key('import') }).hasAttribute('disabled')
  ).toBe(true);
  choose();
  expect(screen.getByRole('status').textContent).toBe(key('approvalHint'));
  fireEvent.click(screen.getByRole('button', { name: key('request') }));
  fireEvent.click(screen.getByRole('button', { name: key('request') }));
  expect(mock.gql).toHaveBeenCalledTimes(1);
  expect(mock.gql).toHaveBeenCalledWith({
    query: submitProjectWorkspaceImportMutation,
    variables: {
      input: {
        projectId: 'project-1',
        parentId: 'folder-1',
        workspaceId: 'workspace-1',
        sourceResourceId: 'doc-1',
        requestApproval: true,
        requestKey: expect.any(String),
      },
    },
  });
  await act(() => {
    pending.resolve({
      submitProjectWorkspaceImport: { status: 'waiting_approval' },
    });
    return pending.promise;
  });
  expect(submitted).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
  expect(mock.success).toHaveBeenCalledWith({ title: key('requested') });
});

test('direct permission uses import confirmation and retains its idempotency key on retry', async () => {
  mock.permission = 'direct';
  mock.gql
    .mockRejectedValueOnce(new Error('connection lost'))
    .mockResolvedValue({ submitProjectWorkspaceImport: { status: 'queued' } });
  render(
    <ProjectWorkspaceImportPicker
      projectId="project-1"
      parentId={null}
      onSubmitted={vi.fn()}
      onClose={vi.fn()}
    />
  );
  choose();
  expect(screen.getByRole('status').textContent).toBe(key('copyHint'));
  fireEvent.click(screen.getByRole('button', { name: key('import') }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: key('import') }));
  await waitFor(() => expect(mock.gql).toHaveBeenCalledTimes(2));
  expect(mock.gql.mock.calls[0][0]).toEqual(mock.gql.mock.calls[1][0]);
  expect(mock.gql.mock.calls[1][0].variables.input.requestApproval).toBe(false);
});

test('changing workspace or search clears selection and never imports an old source', () => {
  render(
    <ProjectWorkspaceImportPicker
      projectId="project-1"
      parentId={null}
      onSubmitted={vi.fn()}
      onClose={vi.fn()}
    />
  );
  choose();
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'New search' },
  });
  expect(screen.getByRole<HTMLInputElement>('radio').checked).toBe(false);
  expect(
    screen.getByRole('button', { name: key('import') }).hasAttribute('disabled')
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: key('workspace') }));
  fireEvent.click(screen.getByRole('button', { name: 'Finance' }));
  expect(screen.getByRole<HTMLInputElement>('radio').checked).toBe(false);
  expect(mock.gql).not.toHaveBeenCalled();
});

test('policy blocked files cannot be selected; load failures provide retry', () => {
  mock.permission = 'blocked';
  const view = render(
    <ProjectWorkspaceImportPicker
      projectId="project-1"
      parentId={null}
      onSubmitted={vi.fn()}
      onClose={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Engineering' }));
  expect(screen.getByRole('radio').hasAttribute('disabled')).toBe(true);
  mock.sourceError = true;
  view.rerender(
    <ProjectWorkspaceImportPicker
      projectId="project-1"
      parentId={null}
      onSubmitted={vi.fn()}
      onClose={vi.fn()}
    />
  );
  expect(screen.getByRole('alert').textContent).toContain(key('loadFailed'));
  expect(screen.queryByRole('radio')).toBeNull();
  fireEvent.click(screen.getByText('com.affine.localmind.project-files.retry'));
  expect(mock.mutate).toHaveBeenCalledOnce();
});

test('failed task retry references the durable task and completed history opens its copy', async () => {
  mock.status = 'failed';
  mock.gql.mockResolvedValue({});
  const open = vi.fn();
  const view = render(
    <ProjectWorkspaceImportStatus
      projectId="project-1"
      parentId={null}
      revision={1}
      onOpen={open}
    />
  );
  fireEvent.click(screen.getByText('com.affine.localmind.project-files.retry'));
  await waitFor(() =>
    expect(mock.gql).toHaveBeenCalledWith({
      query: retryProjectWorkspaceImportMutation,
      variables: { projectId: 'project-1', runId: 'run-1' },
    })
  );
  mock.status = 'completed';
  view.rerender(
    <ProjectWorkspaceImportStatus
      projectId="project-1"
      parentId={null}
      revision={2}
      onOpen={open}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: key('history') }));
  fireEvent.click(screen.getByRole('button', { name: key('open') }));
  expect(open).toHaveBeenCalledWith('copy-1');
});

test('a completed import remains visible and opens its copy without finding history', () => {
  mock.status = 'completed';
  const open = vi.fn();
  render(
    <ProjectWorkspaceImportStatus
      projectId="project-1"
      parentId={null}
      revision={1}
      onOpen={open}
    />
  );
  expect(screen.getByText(key('completed'))).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: key('open') }));
  expect(open).toHaveBeenCalledWith('copy-1');
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('a queued import becomes running, then shows a recoverable timeout instead of disappearing', () => {
  mock.status = 'queued';
  const props = {
    projectId: 'project-1',
    parentId: null,
    revision: 1,
    onOpen: vi.fn(),
  };
  const view = render(<ProjectWorkspaceImportStatus {...props} />);
  expect(screen.getByText(key('queued'))).toBeTruthy();
  mock.status = 'running';
  view.rerender(<ProjectWorkspaceImportStatus {...props} />);
  expect(screen.getByText(key('processing'))).toBeTruthy();
  mock.status = 'failed';
  mock.failureCode = 'project_operation_timeout';
  view.rerender(<ProjectWorkspaceImportStatus {...props} />);
  expect(screen.getByText(key('timeout'))).toBeTruthy();
  expect(
    screen.getByRole('button', {
      name: 'com.affine.localmind.project-files.retry',
    })
  ).toBeTruthy();
});
