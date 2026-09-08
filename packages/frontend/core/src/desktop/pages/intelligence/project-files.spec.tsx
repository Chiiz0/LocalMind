/** @vitest-environment happy-dom */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
} from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  gql: vi.fn(),
  confirm: vi.fn(),
  upload: vi.fn(),
  folders: new Map<string | null, unknown[]>(),
}));
vi.mock('@affine/core/modules/cloud', () => ({
  GraphQLService: class {},
  ServerService: class {},
}));
vi.mock('@toeverything/infra', () => ({
  useService: () => ({
    gql: mock.gql,
    server: { serverMetadata: { baseUrl: 'http://localhost' } },
  }),
}));
vi.mock('@affine/i18n', () => ({
  useI18n: () => new Proxy({}, { get: (_, key) => () => String(key) }),
}));
vi.mock('@affine/core/modules/project-resources/upload', () => ({
  uploadProjectBlobWithProgress: vi.fn(async () => 'blob-key'),
}));
vi.mock('./project-files-data', () => ({
  uploadProjectFile: (...args: unknown[]) => mock.upload(...args),
  useProjectFolder: ({ parentId }: { parentId: string | null }) => ({
    items: mock.folders.get(parentId) ?? [],
    isLoading: false,
    hasMore: false,
    error: null,
  }),
}));
vi.mock('./project-workspace-import', () => ({
  ProjectWorkspaceImportStatus: () => null,
  ProjectWorkspaceImportPicker: ({
    projectId,
    parentId,
  }: {
    projectId: string;
    parentId: string | null;
  }) => (
    <div data-testid="workspace-picker">
      {projectId}:{parentId}
    </div>
  ),
}));
vi.mock('@affine/component', () => ({
  useConfirmModal: () => ({ openConfirmModal: mock.confirm }),
  notify: { error: vi.fn() },
  Loading: () => <span>Loading</span>,
  Button: ({
    children,
    onClick,
    disabled,
  }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  IconButton: ({
    icon,
    onClick,
    disabled,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={props['aria-label']}
      aria-expanded={props['aria-expanded']}
      aria-pressed={props['aria-pressed']}
    >
      {icon}
    </button>
  ),
  Input: ({
    onChange,
    value,
    ...props
  }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
    onChange: (value: string) => void;
  }) => (
    <input
      aria-label={props['aria-label']}
      value={value}
      onChange={event => onChange(event.target.value)}
    />
  ),
  Menu: ({ children, items }: PropsWithChildren<{ items: ReactNode }>) => (
    <>
      {children}
      {items}
    </>
  ),
  MenuItem: ({
    children,
    onClick,
    disabled,
  }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Modal: ({ open, children }: PropsWithChildren<{ open: boolean }>) =>
    open ? <div role="dialog">{children}</div> : null,
  useDraggable: () => ({ dragRef: { current: null }, dragging: false }),
  useDropTarget: () => ({
    dropTargetRef: { current: null },
    draggedOver: false,
  }),
}));

import {
  acquireProjectResourceEditLeaseMutation,
  changeProjectResourceMutation,
  createProjectResourceMutation,
  permanentlyDeleteProjectResourceMutation,
  releaseProjectResourceEditLeaseMutation,
} from '@affine/graphql';

import { ProjectFiles, ProjectFileSelectionTree } from './project-files';

const file = (id: string, kind = 'page', parentId: string | null = null) => ({
  id,
  title: id,
  projectId: 'project-1',
  parentId,
  kind,
  version: 1,
  contentVersion: 1,
});
beforeEach(() => {
  vi.clearAllMocks();
  mock.folders.clear();
  mock.folders.set(null, [
    file('Alpha'),
    file('Beta'),
    file('Reports', 'folder'),
  ]);
  mock.folders.set('Reports', [file('Report', 'page', 'Reports')]);
});
afterEach(cleanup);

describe('Project file tree', () => {
  test('renaming an existing document obtains proof and releases it after the write', async () => {
    mock.gql.mockImplementation(async ({ query }) =>
      query === acquireProjectResourceEditLeaseMutation
        ? {
            acquireProjectResourceEditLease: {
              acquired: true,
              lease: {
                owned: true,
                leaseId: 'rename-lease',
                expiresAt: new Date(Date.now() + 60000).toISOString(),
              },
            },
          }
        : query === releaseProjectResourceEditLeaseMutation
          ? { releaseProjectResourceEditLease: true }
          : {}
    );
    render(
      <ProjectFiles
        projectId="project-1"
        selectedResourceId={null}
        onOpen={vi.fn()}
      />
    );
    const alpha = screen.getByRole('button', { name: 'Alpha' }).closest('li')!;
    fireEvent.click(
      within(alpha).getByText('com.affine.localmind.project-files.rename')
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Renamed document' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'com.affine.localmind.project-files.save',
      })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const write = mock.gql.mock.calls.find(
      ([request]) => request.query === changeProjectResourceMutation
    )![0];
    expect(write.variables.input).toMatchObject({
      resourceId: 'Alpha',
      title: 'Renamed document',
      editLease: { leaseId: 'rename-lease', tabId: expect.any(String) },
    });
    expect(mock.gql.mock.calls.at(-1)![0].query).toBe(
      releaseProjectResourceEditLeaseMutation
    );
  });

  test('permanent deletion is only available in trash and requires explicit destructive confirmation', async () => {
    mock.gql.mockResolvedValue({ permanentlyDeleteProjectResource: true });
    render(
      <ProjectFiles
        projectId="project-1"
        selectedResourceId={null}
        onOpen={vi.fn()}
      />
    );
    expect(
      screen.queryByText('com.affine.localmind.project-files.permanentlyDelete')
    ).toBeNull();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'com.affine.localmind.project-files.trash',
      })
    );
    fireEvent.click(
      screen.getAllByText(
        'com.affine.localmind.project-files.permanentlyDelete'
      )[0]
    );
    expect(mock.gql).not.toHaveBeenCalled();
    const confirmation = mock.confirm.mock.calls[0][0];
    expect(confirmation.confirmButtonOptions.variant).toBe('error');
    await act(() => confirmation.onConfirm());
    expect(mock.gql).toHaveBeenCalledWith(
      expect.objectContaining({
        query: permanentlyDeleteProjectResourceMutation,
        variables: {
          input: expect.objectContaining({
            projectId: 'project-1',
            resourceId: 'Alpha',
            expectedVersion: 1,
          }),
        },
      })
    );
  });
  test('create immediately opens an untitled resource and does not show a naming form', async () => {
    const open = vi.fn();
    mock.gql.mockResolvedValue({
      createProjectResource: { id: 'created', kind: 'page' },
    });
    render(
      <ProjectFiles
        projectId="project-1"
        selectedResourceId={null}
        onOpen={open}
      />
    );
    fireEvent.click(
      screen.getAllByText('com.affine.localmind.project-files.newDocument')[0]
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(open).toHaveBeenCalledWith('created'));
    expect(mock.gql).toHaveBeenCalledWith({
      query: createProjectResourceMutation,
      variables: {
        input: expect.objectContaining({
          projectId: 'project-1',
          title: 'Untitled',
          parentId: null,
        }),
      },
    });
  });

  test('pending changes only disable the affected row and reject repeated submissions', async () => {
    const pending = Promise.withResolvers<void>();
    mock.gql.mockReturnValue(pending.promise);
    render(
      <ProjectFiles
        projectId="project-1"
        selectedResourceId={null}
        onOpen={vi.fn()}
      />
    );
    const alpha = screen.getByRole('button', { name: 'Alpha' }).closest('li')!;
    const beta = screen.getByRole('button', { name: 'Beta' }).closest('li')!;
    fireEvent.click(
      within(alpha).getByText('com.affine.localmind.project-files.delete')
    );
    expect(
      within(alpha)
        .getByText('com.affine.localmind.project-files.delete')
        .hasAttribute('disabled')
    ).toBe(true);
    expect(
      within(beta)
        .getByText('com.affine.localmind.project-files.delete')
        .hasAttribute('disabled')
    ).toBe(false);
    fireEvent.click(
      within(alpha).getByText('com.affine.localmind.project-files.delete')
    );
    fireEvent.click(
      within(beta).getByText('com.affine.localmind.project-files.delete')
    );
    expect(mock.gql).toHaveBeenCalledTimes(2);
    expect(mock.gql.mock.calls[0][0]).toMatchObject({
      query: changeProjectResourceMutation,
      variables: {
        input: { resourceId: 'Alpha', trash: true, expectedVersion: 1 },
      },
    });
    await act(() => {
      pending.resolve();
      return pending.promise;
    });
  });

  test('folder expansion and multiselect issue no write mutations', () => {
    const toggle = vi.fn();
    render(
      <ProjectFileSelectionTree
        projectId="project-1"
        selected={new Set(['Alpha'])}
        disabled={false}
        onToggle={toggle}
      />
    );
    expect(
      screen.getByRole<HTMLInputElement>('checkbox', { name: 'Alpha' }).checked
    ).toBe(true);
    fireEvent.click(screen.getAllByRole('button', { name: 'Reports' })[0]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Report' }));
    expect(toggle).toHaveBeenCalledWith('Report');
    expect(
      screen.queryByText('com.affine.localmind.project-files.delete')
    ).toBeNull();
    expect(mock.gql).not.toHaveBeenCalled();
  });

  test('multiple files are queued into the current directory without blocking existing items', async () => {
    const pending = Promise.withResolvers<void>();
    mock.upload.mockReturnValue(pending.promise);
    const { container } = render(
      <ProjectFiles
        projectId="project-1"
        parentId="Reports"
        selectedResourceId={null}
        onOpen={vi.fn()}
      />
    );
    const files = [new File(['a'], 'a.txt'), new File(['b'], 'b.pdf')];
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files },
    });
    expect(mock.upload).toHaveBeenCalledTimes(2);
    expect(mock.upload.mock.calls.map(([, input]) => input.parentId)).toEqual([
      'Reports',
      'Reports',
    ]);
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Report' }).hasAttribute('disabled')
    ).toBe(false);
    await act(() => {
      pending.resolve();
      return pending.promise;
    });
    expect(
      screen.getAllByText('com.affine.localmind.project-files.upload.completed')
    ).toHaveLength(2);
  });
});

test('workspace import entry opens the picker for the current Project folder', () => {
  render(
    <ProjectFiles
      projectId="project-1"
      parentId="Reports"
      selectedResourceId={null}
      onOpen={vi.fn()}
    />
  );
  fireEvent.click(
    screen.getByRole('button', {
      name: 'com.affine.localmind.workspace-import.title',
    })
  );
  expect(screen.getByTestId('workspace-picker').textContent).toBe(
    'project-1:Reports'
  );
});
