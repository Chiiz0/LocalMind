/**
 * @vitest-environment happy-dom
 */
import {
  acquireProjectResourceEditLeaseMutation,
  projectResourceSourcesQuery,
  refreshProjectResourceSourceMutation,
  releaseProjectResourceEditLeaseMutation,
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
  write: vi.fn(),
  confirm: vi.fn(),
  mutate: vi.fn(),
  error: null as Error | null,
}));
vi.mock('@affine/core/modules/cloud', () => ({ GraphQLService: class {} }));
vi.mock('@toeverything/infra', () => ({
  useService: () => ({ gql: state.gql }),
}));
vi.mock('@affine/i18n', () => ({
  getOrCreateI18n: () => ({ t: (key: string) => key }),
  useI18n: () => new Proxy({}, { get: (_, key) => () => String(key) }),
}));
vi.mock('@affine/component', () => ({
  useConfirmModal: () => ({ openConfirmModal: state.confirm }),
  Button: ({
    loading: _loading,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) => (
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
    open ? children : null,
  Loading: () => <span>loading</span>,
}));
vi.mock('@affine/core/components/hooks/use-query', () => ({
  useQuery: (request?: { query: { id: string } }) => ({
    data:
      request?.query.id === projectResourceSourcesQuery.id
        ? {
            projectResourceSources: [
              {
                workspaceId: 'workspace',
                sourceResourceId: 'source',
                title: 'Source document',
                workspaceName: 'Workspace',
                sourceVersion: 'external-version',
                projectVersion: 7,
              },
            ],
          }
        : undefined,
    isLoading: false,
    error: state.error,
    mutate: state.mutate,
  }),
}));

import { ProjectSourceRefresh } from './project-source-refresh';

beforeEach(() => {
  vi.clearAllMocks();
  state.error = null;
  state.confirm.mockImplementation(({ onConfirm }: { onConfirm: () => void }) =>
    onConfirm()
  );
  state.gql.mockImplementation((request: { query: unknown }) => {
    if (request.query === acquireProjectResourceEditLeaseMutation)
      return Promise.resolve({
        acquireProjectResourceEditLease: {
          acquired: true,
          lease: {
            owned: true,
            leaseId: 'edit-lease',
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          },
        },
      });
    if (request.query === releaseProjectResourceEditLeaseMutation)
      return Promise.resolve({ releaseProjectResourceEditLease: true });
    return state.write(request);
  });
  state.mutate.mockResolvedValue(undefined);
});
afterEach(cleanup);
const label = (name: string) => `com.affine.localmind.${name}`;

test('source refresh freezes both versions and keeps a retry identity after a lost response', async () => {
  const refreshed = vi.fn();
  state.write
    .mockRejectedValueOnce(new Error('Response lost'))
    .mockResolvedValueOnce({});
  render(
    <ProjectSourceRefresh
      projectId="project"
      resourceId="internal"
      onRefreshed={refreshed}
    />
  );
  fireEvent.click(
    screen.getByRole('button', { name: label('source-refresh.title') })
  );
  const apply = screen.getByRole('button', {
    name: label('source-refresh.apply'),
  });
  expect(apply).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('radio'));
  fireEvent.click(apply);
  await screen.findByRole('alert');
  expect(state.confirm).toHaveBeenCalledOnce();
  const first = state.write.mock.calls[0][0];
  expect(first.query).toBe(refreshProjectResourceSourceMutation);
  expect(first.variables).toMatchObject({
    projectId: 'project',
    resourceId: 'internal',
    expectedContentVersion: 7,
    expectedSourceVersion: 'external-version',
    editLease: { tabId: expect.any(String), leaseId: 'edit-lease' },
  });
  expect(refreshed).not.toHaveBeenCalled();
  fireEvent.click(apply);
  await waitFor(() => expect(refreshed).toHaveBeenCalledOnce());
  expect(state.write.mock.calls[1][0]).toEqual(first);
});

test('a fresh comparison clears confirmation and an ACL error hides cached sources', async () => {
  const view = render(
    <ProjectSourceRefresh
      projectId="project"
      resourceId="internal"
      onRefreshed={vi.fn()}
    />
  );
  fireEvent.click(
    screen.getByRole('button', { name: label('source-refresh.title') })
  );
  fireEvent.click(screen.getByRole('radio'));
  fireEvent.click(
    screen.getByRole('button', { name: label('project-files.reload') })
  );
  expect(
    screen.getByRole('button', { name: label('source-refresh.apply') })
  ).toHaveProperty('disabled', true);
  expect(state.mutate).toHaveBeenCalledOnce();
  state.error = new Error('Source access revoked');
  view.rerender(
    <ProjectSourceRefresh
      projectId="project"
      resourceId="internal"
      onRefreshed={vi.fn()}
    />
  );
  expect(screen.queryByRole('radio')).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain(
    'com.affine.localmind.project-error.failed'
  );
});
