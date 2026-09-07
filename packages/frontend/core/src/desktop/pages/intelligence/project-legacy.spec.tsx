/**
 * @vitest-environment happy-dom
 */
import {
  changeProjectLegacyOperationMutation,
  changeProjectResourceMigrationMutation,
  projectLegacyConversationsQuery,
  projectLegacyMessagesQuery,
  projectLegacyOperationsQuery,
  projectResourceMigrationsQuery,
  requestProjectMigrationPermissionMutation,
} from '@affine/graphql';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  gql: vi.fn(),
  mutate: vi.fn(),
  changed: vi.fn(),
  data: new Map<string, unknown>(),
  errors: new Map<string, Error>(),
}));
vi.mock('@affine/core/modules/cloud', () => ({ GraphQLService: class {} }));
vi.mock('@toeverything/infra', () => ({
  useService: () => ({ gql: state.gql }),
}));
vi.mock('@affine/i18n', () => ({
  useI18n: () => new Proxy({}, { get: (_, key) => () => String(key) }),
}));
vi.mock('@affine/component', () => ({
  Button: (props: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} />
  ),
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
  Modal: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  Loading: () => <span>loading</span>,
}));
vi.mock('@affine/core/components/hooks/use-query', () => ({
  useQuery: (request?: { query: { id: string } }) => ({
    data: request ? state.data.get(request.query.id) : undefined,
    error: request ? state.errors.get(request.query.id) : undefined,
    isLoading: false,
    mutate: state.mutate,
  }),
}));
vi.mock('./project-files-data', () => ({ projectFilesChanged: state.changed }));

import { ProjectLegacy } from './project-legacy';
import { ProjectMigrations } from './project-migrations';

const label = (name: string) => `com.affine.localmind.${name}`;
const row = {
  id: 'legacy-request',
  title: 'Original request',
  status: 'pending',
  revision: 3,
  resourceId: null,
  createdAt: '2026-09-06T00:00:00Z',
};
function openPanel(container: HTMLElement) {
  const panel = container.querySelector('details')!;
  panel.open = true;
  fireEvent(panel, new Event('toggle'));
}
beforeEach(() => {
  vi.clearAllMocks();
  state.data.clear();
  state.errors.clear();
  state.mutate.mockResolvedValue(undefined);
  state.data.set(projectLegacyOperationsQuery.id, {
    projectLegacyOperations: { items: [row], nextCursor: null },
  });
  state.data.set(projectLegacyConversationsQuery.id, {
    projectLegacyConversations: { items: [], nextCursor: null },
  });
});
afterEach(cleanup);

test('recovery preserves operation identity after a lost response and suppresses duplicate clicks', async () => {
  let reject!: (reason: Error) => void;
  state.gql
    .mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      })
    )
    .mockResolvedValueOnce({
      changeProjectLegacyOperation: { resourceId: 'internal' },
    });
  const view = render(<ProjectLegacy projectId="project" onOpen={vi.fn()} />);
  openPanel(view.container);
  const recover = await screen.findByRole('button', {
    name: label('legacy.recover'),
  });
  fireEvent.click(recover);
  fireEvent.click(recover);
  expect(state.gql).toHaveBeenCalledOnce();
  reject(new Error('Response lost'));
  await screen.findByRole('alert');
  await waitFor(() => expect(recover).toHaveProperty('disabled', false));
  fireEvent.click(recover);
  await waitFor(() => expect(state.changed).toHaveBeenCalledWith('project'));
  expect(state.gql.mock.calls[0][0]).toEqual({
    query: changeProjectLegacyOperationMutation,
    variables: {
      projectId: 'project',
      operationId: row.id,
      expectedRevision: 3,
      action: 'recover',
    },
  });
  expect(state.gql.mock.calls[1][0]).toEqual(state.gql.mock.calls[0][0]);
});

test('historical messages disclose truncation and close when switching projects', async () => {
  state.data.set(projectLegacyConversationsQuery.id, {
    projectLegacyConversations: {
      items: [
        { id: 'session', title: 'Old conversation', createdAt: row.createdAt },
      ],
      nextCursor: null,
    },
  });
  state.data.set(projectLegacyMessagesQuery.id, {
    projectLegacyMessages: {
      items: [
        {
          id: 'message',
          role: 'user',
          content: 'Historical text',
          truncated: true,
          createdAt: row.createdAt,
        },
      ],
      nextCursor: null,
    },
  });
  const view = render(<ProjectLegacy projectId="project" onOpen={vi.fn()} />);
  openPanel(view.container);
  fireEvent.click(
    await screen.findByRole('button', { name: /Old conversation/ })
  );
  expect(screen.getByText('Historical text')).toBeTruthy();
  expect(screen.getByText(label('legacy.truncated'))).toBeTruthy();
  view.rerender(<ProjectLegacy projectId="another" onOpen={vi.fn()} />);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByText('Historical text')).toBeNull();
});

test('ACL errors hide cached historical operations and conversations', async () => {
  state.errors.set(
    projectLegacyOperationsQuery.id,
    new Error('Membership revoked')
  );
  state.errors.set(
    projectLegacyConversationsQuery.id,
    new Error('Membership revoked')
  );
  const view = render(<ProjectLegacy projectId="project" onOpen={vi.fn()} />);
  openPanel(view.container);
  await screen.findByRole('alert');
  expect(screen.queryByText('Original request')).toBeNull();
  expect(
    screen.queryByRole('button', { name: label('legacy.recover') })
  ).toBeNull();
});

test('migration permission requests reuse pending identity and can be requested again after rejection', async () => {
  state.data.set(projectResourceMigrationsQuery.id, {
    projectResourceMigrations: {
      items: [
        { ...row, projectId: 'project', status: 'waiting_for_authorization' },
      ],
      nextCursor: null,
    },
  });
  let permissionStatus = 'pending';
  state.gql.mockImplementation(async ({ query }) =>
    query.id === requestProjectMigrationPermissionMutation.id
      ? { requestProjectMigrationPermission: { status: permissionStatus } }
      : {}
  );
  const view = render(
    <ProjectMigrations projectId="project" onOpen={vi.fn()} />
  );
  openPanel(view.container);
  const request = await screen.findByRole('button', {
    name: label('migrations.request'),
  });
  await waitFor(() => expect(request).toHaveProperty('disabled', false));
  fireEvent.click(request);
  await screen.findByRole('status');
  await waitFor(() => expect(request).toHaveProperty('disabled', false));
  permissionStatus = 'rejected';
  fireEvent.click(request);
  await screen.findByText(label('migrations.permissionRejected'));
  await waitFor(() => expect(request).toHaveProperty('disabled', false));
  fireEvent.click(request);
  await waitFor(() => expect(request).toHaveProperty('disabled', false));
  const requests = state.gql.mock.calls
    .map(([call]) => call)
    .filter(
      call => call.query.id === requestProjectMigrationPermissionMutation.id
    );
  expect(requests).toHaveLength(3);
  expect(requests[1].variables.requestKey).toBe(
    requests[0].variables.requestKey
  );
  expect(requests[2].variables.requestKey).not.toBe(
    requests[0].variables.requestKey
  );
  fireEvent.click(
    screen.getByRole('button', { name: label('project-files.retry') })
  );
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  expect(state.gql).toHaveBeenLastCalledWith({
    query: changeProjectResourceMigrationMutation,
    variables: {
      projectId: 'project',
      migrationId: row.id,
      expectedRevision: 3,
      action: 'retry',
    },
  });
});

test('migration lists discard cached rows from a previous Project', async () => {
  state.data.set(projectResourceMigrationsQuery.id, {
    projectResourceMigrations: {
      items: [
        { ...row, projectId: 'project', status: 'waiting_for_authorization' },
      ],
      nextCursor: null,
    },
  });
  state.gql.mockResolvedValue({});
  const view = render(
    <ProjectMigrations projectId="project" onOpen={vi.fn()} />
  );
  openPanel(view.container);
  await screen.findByText('Original request');
  view.rerender(<ProjectMigrations projectId="another" onOpen={vi.fn()} />);
  openPanel(view.container);
  await screen.findByText(label('migrations.empty'));
  expect(screen.queryByText('Original request')).toBeNull();
});
