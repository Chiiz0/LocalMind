/**
 * @vitest-environment happy-dom
 */
import {
  changeProjectPublicationMutation,
  confirmProjectPublicationMutation,
  createProjectDestinationFolderMutation,
  previewProjectPublicationMutation,
  projectAgentTaskQuery,
  projectDestinationFoldersQuery,
  projectDestinationWorkspacesQuery,
  projectPublicationCandidatesQuery,
  type ProjectPublicationFieldsFragment,
  projectPublicationQuery,
  projectPublicationsQuery,
} from '@affine/graphql';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  data: new Map<string, unknown>(),
  errors: new Map<string, Error>(),
  gql: vi.fn(),
  query: vi.fn(),
  mutate: vi.fn(),
}));
vi.mock('@affine/core/modules/cloud', () => ({ GraphQLService: class {} }));
vi.mock('@toeverything/infra', () => ({
  useService: () => ({ gql: state.gql }),
}));
vi.mock('@affine/i18n', () => ({
  useI18n: () => new Proxy({}, { get: (_, key) => () => String(key) }),
}));
vi.mock('@affine/component', () => ({
  Button: ({
    loading: _loading,
    variant: _variant,
    prefix: _prefix,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    variant?: string;
    prefix?: ReactNode;
  }) => <button {...props} />,
  IconButton: ({
    icon,
    size: _size,
    tooltip: _tooltip,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    icon?: ReactNode;
    size?: string;
    tooltip?: string;
  }) => <button {...props}>{icon}</button>,
  Input: ({
    onChange,
    ...props
  }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
    onChange: (value: string) => void;
  }) => <input {...props} onChange={event => onChange(event.target.value)} />,
  Menu: ({ children, items }: { children: ReactNode; items: ReactNode }) => (
    <div>
      {children}
      {items}
    </div>
  ),
  MenuItem: ({
    prefixIcon: _icon,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { prefixIcon?: ReactNode }) => (
    <button {...props} />
  ),
  Modal: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? children : null,
  Loading: () => <span data-testid="loading" />,
}));
vi.mock('@affine/core/components/hooks/use-query', () => ({
  useQuery: (request?: { query: { id: string }; variables: unknown }) => {
    state.query(request);
    return {
      data: request ? state.data.get(request.query.id) : undefined,
      error: request ? state.errors.get(request.query.id) : null,
      isLoading: false,
      mutate: state.mutate,
    };
  },
}));

import { ProjectPublications } from './project-publications';

const label = (key: string) => `com.affine.localmind.publications.${key}`;
const files = (key: string) => `com.affine.localmind.project-files.${key}`;
let record: ProjectPublicationFieldsFragment;
function setRecord(changes: Partial<ProjectPublicationFieldsFragment> = {}) {
  record = { ...record, ...changes };
  state.data.set(projectPublicationsQuery.id, {
    projectPublications: { items: [record], nextCursor: null },
  });
  state.data.set(projectPublicationQuery.id, { projectPublication: record });
}
function directory(overrides: Record<string, unknown> = {}) {
  state.data.set(projectDestinationFoldersQuery.id, {
    projectDestinationFolders: {
      revision: 'directory-revision',
      current: {
        folderId: null,
        path: [],
        canSave: true,
        canCreateFolder: true,
      },
      items: [
        { folderId: 'folder-1', path: [{ id: 'folder-1', name: 'Planning' }] },
      ],
      nextCursor: 'next-page',
      ...overrides,
    },
  });
}
function open() {
  const view = render(
    <ProjectPublications projectId="project-1" resourceId="resource-1" />
  );
  fireEvent.click(screen.getByRole('button', { name: /Quarterly report/ }));
  return view;
}
beforeEach(() => {
  vi.clearAllMocks();
  state.data.clear();
  state.errors.clear();
  record = {
    id: 'publication-unique-1',
    projectId: 'project-1',
    resourceId: 'resource-1',
    runId: null,
    revision: 1,
    kind: 'publish',
    title: 'Quarterly report',
    status: 'waiting_for_location',
    sourceSequence: 3,
    createdAt: '2026-09-06T00:00:00Z',
    expiresAt: '2026-09-07T00:00:00Z',
    targetFingerprint: null,
    failureCode: null,
    target: null,
    preview: null,
    receipt: null,
  };
  setRecord();
  directory();
  state.data.set(projectDestinationWorkspacesQuery.id, {
    projectDestinationWorkspaces: [
      { id: 'workspace-1', name: 'Workspace One' },
      { id: 'workspace-2', name: 'Workspace Two' },
    ],
  });
  state.gql.mockResolvedValue({});
  state.mutate.mockResolvedValue(undefined);
});
afterEach(cleanup);

test('root is an explicit destination and only preview is submitted before confirmation', async () => {
  open();
  expect(screen.getByText(label('saved'), { exact: false })).toBeTruthy();
  expect(state.gql).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Workspace One' }));
  fireEvent.click(screen.getByRole('button', { name: label('current') }));
  await waitFor(() =>
    expect(state.gql).toHaveBeenCalledWith({
      query: previewProjectPublicationMutation,
      variables: {
        projectId: 'project-1',
        publicationId: record.id,
        expectedRevision: 1,
        workspaceId: 'workspace-1',
        folderId: null,
      },
    })
  );
  expect(state.gql).toHaveBeenCalledTimes(1);
});

test('confirmation shows exact target and difference, deduplicates clicks and recovers from permission rejection', async () => {
  setRecord({
    status: 'waiting_for_confirmation',
    targetFingerprint: 'frozen-preview',
    target: {
      workspaceId: 'workspace-1',
      resourceId: 'target-exact',
      folderId: null,
      expectedVersion: 'target-version-4',
    },
    preview: {
      resourceKind: 'page',
      workspaceName: 'Workspace One',
      targetTitle: 'Published report',
      targetSequence: 4,
      targetPath: [],
      audience: { memberCount: 5 },
      difference: { before: 'External old body', after: 'Internal new body' },
    },
  });
  const response = Promise.withResolvers<unknown>();
  state.gql.mockReturnValue(response.promise);
  open();
  expect(screen.getByText('External old body')).toBeTruthy();
  expect(screen.getByText('Internal new body')).toBeTruthy();
  expect(screen.getByText('v4')).toBeTruthy();
  expect(screen.getByText(/Published report/).dataset.targetResourceId).toBe(
    'target-exact'
  );
  const confirm = screen.getByRole('button', { name: label('confirm') });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(state.gql).toHaveBeenCalledTimes(1);
  expect(state.gql).toHaveBeenCalledWith({
    query: confirmProjectPublicationMutation,
    variables: {
      projectId: 'project-1',
      publicationId: record.id,
      expectedRevision: 1,
      targetFingerprint: 'frozen-preview',
    },
  });
  response.reject(new Error('Target permission changed'));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'Target permission changed'
    )
  );
  expect((confirm as HTMLButtonElement).disabled).toBe(false);
});

test('revoked preview disables confirmation and cancellation preserves the separate internal resource', async () => {
  setRecord({
    status: 'waiting_for_confirmation',
    targetFingerprint: 'frozen-preview',
  });
  open();
  expect(
    (
      screen.getByRole('button', {
        name: label('confirm'),
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: files('cancel') }));
  await waitFor(() =>
    expect(state.gql).toHaveBeenCalledWith({
      query: changeProjectPublicationMutation,
      variables: {
        projectId: 'project-1',
        publicationId: record.id,
        expectedRevision: 1,
        action: 'cancel',
      },
    })
  );
  expect(state.gql).toHaveBeenCalledTimes(1);
  expect(screen.getByText(label('saved'), { exact: false })).toBeTruthy();
});

test('folder pagination is scoped to the current parent and entering a child resets the page', () => {
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Workspace One' }));
  fireEvent.click(screen.getByRole('button', { name: files('more') }));
  expect(state.query).toHaveBeenCalledWith({
    query: projectDestinationFoldersQuery,
    variables: expect.objectContaining({
      parentId: null,
      cursor: 'next-page',
      limit: 20,
    }),
  });
  fireEvent.click(screen.getByRole('button', { name: /Planning/ }));
  expect(state.query).toHaveBeenCalledWith({
    query: projectDestinationFoldersQuery,
    variables: expect.objectContaining({
      parentId: 'folder-1',
      cursor: undefined,
      limit: 20,
    }),
  });
});

test('a late folder response cannot navigate a different Workspace', async () => {
  const response = Promise.withResolvers<unknown>();
  state.gql.mockReturnValue(response.promise);
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Workspace One' }));
  fireEvent.click(screen.getByRole('button', { name: files('newFolder') }));
  fireEvent.change(screen.getByRole('textbox', { name: files('newFolder') }), {
    target: { value: 'Approved folder' },
  });
  fireEvent.submit(
    screen.getByRole('textbox', { name: files('newFolder') }).closest('form')!
  );
  expect(state.gql).toHaveBeenCalledWith({
    query: createProjectDestinationFolderMutation,
    variables: expect.objectContaining({
      workspaceId: 'workspace-1',
      parentId: null,
      title: 'Approved folder',
    }),
  });
  fireEvent.click(screen.getByRole('button', { name: 'Workspace Two' }));
  response.resolve({
    createProjectDestinationFolder: {
      runId: 'run-1',
      status: 'completed',
      folderId: 'old-workspace-folder',
    },
  });
  await response.promise;
  await waitFor(() =>
    expect(state.query).toHaveBeenCalledWith({
      query: projectDestinationFoldersQuery,
      variables: expect.objectContaining({
        workspaceId: 'workspace-2',
        parentId: null,
      }),
    })
  );
  expect(
    state.query.mock.calls.some(
      ([request]) =>
        request?.query === projectDestinationFoldersQuery &&
        request.variables.workspaceId === 'workspace-2' &&
        request.variables.parentId === 'old-workspace-folder'
    )
  ).toBe(false);
});

test('queued folder creation reconciles the durable task receipt', async () => {
  state.gql.mockResolvedValue({
    createProjectDestinationFolder: {
      runId: 'folder-run',
      status: 'queued',
      folderId: null,
    },
  });
  state.data.set(projectAgentTaskQuery.id, {
    projectAgentTask: {
      id: 'folder-run',
      projectId: 'project-1',
      status: 'completed',
      title: 'Create folder',
      receipt: { folderId: 'created-folder' },
    },
  });
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Workspace One' }));
  fireEvent.click(screen.getByRole('button', { name: files('newFolder') }));
  const input = screen.getByRole('textbox', { name: files('newFolder') });
  fireEvent.change(input, { target: { value: 'Reports' } });
  fireEvent.submit(input.closest('form')!);
  await waitFor(() =>
    expect(state.query).toHaveBeenCalledWith({
      query: projectAgentTaskQuery,
      variables: { projectId: 'project-1', runId: 'folder-run' },
    })
  );
  await waitFor(() =>
    expect(state.query).toHaveBeenCalledWith({
      query: projectDestinationFoldersQuery,
      variables: expect.objectContaining({ parentId: 'created-folder' }),
    })
  );
});

test('same-title update candidates use their exact target IDs and read-only targets stay disabled', async () => {
  setRecord({ kind: 'update' });
  state.data.set(projectPublicationCandidatesQuery.id, {
    projectPublicationCandidates: {
      items: ['target-one', 'target-two'].map((resourceId, index) => ({
        resourceId,
        title: 'Same title',
        folderId: null,
        path: [],
        canUpdate: index === 1,
      })),
      nextCursor: null,
    },
  });
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Workspace One' }));
  const targets = screen.getAllByRole('button', { name: /Same title/ });
  expect((targets[0] as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(targets[1]);
  await waitFor(() =>
    expect(state.gql).toHaveBeenCalledWith({
      query: previewProjectPublicationMutation,
      variables: expect.objectContaining({
        targetResourceId: 'target-two',
        folderId: null,
      }),
    })
  );
});

test('Project changes clear the detail and stale cached publications cannot expose content', () => {
  const view = open();
  view.rerender(
    <ProjectPublications projectId="project-2" resourceId="resource-2" />
  );
  expect(screen.queryByText('Quarterly report')).toBeNull();
  expect(screen.getByText(label('empty'))).toBeTruthy();
  expect(screen.queryByText(label('saved'), { exact: false })).toBeNull();
});
