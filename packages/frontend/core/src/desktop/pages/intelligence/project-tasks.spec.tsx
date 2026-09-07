/**
 * @vitest-environment happy-dom
 */
import {
  approveProjectAgentTaskMutation,
  cancelProjectAgentTaskMutation,
  type ProjectAgentTaskFieldsFragment,
} from '@affine/graphql';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ButtonHTMLAttributes } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  tasks: [] as ProjectAgentTaskFieldsFragment[],
  nextCursor: null as string | null,
  error: null as Error | null,
  loading: false,
  gql: vi.fn(),
  query: vi.fn(),
  mutate: vi.fn(),
}));
vi.mock('@affine/core/modules/cloud', () => ({ GraphQLService: class {} }));
vi.mock('./project-publications', () => ({ ProjectPublications: () => null }));
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
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    variant?: string;
  }) => <button {...props} />,
  IconButton: ({
    size: _size,
    tooltip: _tooltip,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    size?: string;
    tooltip?: string;
  }) => <button {...props} />,
  Loading: () => <span data-testid="loading" />,
}));
vi.mock('@affine/core/components/hooks/use-query', () => ({
  useQuery: (request: unknown) => {
    state.query(request);
    return {
      data: {
        projectAgentTasks: { items: state.tasks, nextCursor: state.nextCursor },
      },
      error: state.error,
      isLoading: state.loading,
      mutate: state.mutate,
    };
  },
}));

import { ProjectTasks } from './project-tasks';

const label = (key: string) => `com.affine.localmind.project-tasks.${key}`;
const files = (key: string) => `com.affine.localmind.project-files.${key}`;
const task = (
  overrides: Partial<ProjectAgentTaskFieldsFragment> = {}
): ProjectAgentTaskFieldsFragment => ({
  id: 'request-unique-1',
  projectId: 'project-1',
  sessionId: 'session-1',
  title: 'Update workbook',
  status: 'waiting_approval',
  workflow: 'agent_runtime_project_office_command',
  targetFingerprint: 'exact-preview',
  workerAttempt: 0,
  createdAt: '2026-09-06T00:00:00.000Z',
  updatedAt: '2026-09-06T00:00:00.000Z',
  failureCode: null,
  failureMessage: null,
  receipt: null,
  preview: {
    artifactTitle: 'Budget',
    reason: 'Set the forecast to 12',
    revisionSequence: 3,
    commandCount: 1,
  },
  ...overrides,
});
beforeEach(() => {
  vi.clearAllMocks();
  state.tasks = [task()];
  state.error = null;
  state.loading = false;
  state.nextCursor = null;
  state.gql.mockResolvedValue({});
  state.mutate.mockResolvedValue(undefined);
});
afterEach(cleanup);

test('approval uses the displayed task fingerprint once and keeps failed controls recoverable', async () => {
  const pending = Promise.withResolvers<unknown>();
  state.gql.mockReturnValue(pending.promise);
  render(
    <ProjectTasks
      projectId="project-1"
      sessionId="session-1"
      onOpenResource={vi.fn()}
    />
  );
  expect(screen.getByText('Set the forecast to 12')).toBeTruthy();
  expect(screen.getByText('v3')).toBeTruthy();
  const approve = screen.getByRole('button', { name: label('approve') });
  fireEvent.click(approve);
  fireEvent.click(approve);
  expect(state.gql).toHaveBeenCalledTimes(1);
  expect(state.gql).toHaveBeenCalledWith({
    query: approveProjectAgentTaskMutation,
    variables: {
      projectId: 'project-1',
      runId: 'request-unique-1',
      targetFingerprint: 'exact-preview',
    },
  });
  pending.reject(new Error('Permission changed'));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'Permission changed'
    )
  );
  expect((approve as HTMLButtonElement).disabled).toBe(false);
  state.gql.mockResolvedValue({});
  fireEvent.click(screen.getByRole('button', { name: files('cancel') }));
  await waitFor(() =>
    expect(state.gql).toHaveBeenCalledWith({
      query: cancelProjectAgentTaskMutation,
      variables: { projectId: 'project-1', runId: 'request-unique-1' },
    })
  );
});

test('only completed receipts open resources and stale foreign tasks stay hidden', () => {
  const open = vi.fn();
  state.tasks = [
    task({ status: 'completed', receipt: { resourceId: 'saved-resource' } }),
    task({
      id: 'foreign',
      projectId: 'project-2',
      title: 'Foreign private title',
    }),
  ];
  render(<ProjectTasks projectId="project-1" onOpenResource={open} />);
  expect(screen.queryByText('Foreign private title')).toBeNull();
  expect(screen.queryByRole('button', { name: label('approve') })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: files('open') }));
  expect(open).toHaveBeenCalledWith('saved-resource');
});

test('pagination is bounded and changing Project resets the cursor and errors', async () => {
  state.nextCursor = 'page-2';
  const { rerender } = render(
    <ProjectTasks projectId="project-1" onOpenResource={vi.fn()} />
  );
  fireEvent.click(screen.getByRole('button', { name: files('more') }));
  await waitFor(() =>
    expect(state.query).toHaveBeenLastCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          projectId: 'project-1',
          cursor: 'page-2',
          limit: 20,
        }),
      })
    )
  );
  state.tasks = [];
  state.nextCursor = null;
  rerender(<ProjectTasks projectId="project-2" onOpenResource={vi.fn()} />);
  expect(state.query).toHaveBeenLastCalledWith(
    expect.objectContaining({
      variables: expect.objectContaining({
        projectId: 'project-2',
        cursor: undefined,
        limit: 20,
      }),
    })
  );
  expect(screen.getByText(label('empty'))).toBeTruthy();
  state.error = new Error('Connection unavailable');
  rerender(<ProjectTasks projectId="project-2" onOpenResource={vi.fn()} />);
  expect(screen.getByRole('alert').textContent).toContain(
    'Connection unavailable'
  );
  fireEvent.click(screen.getByRole('button', { name: files('retry') }));
  expect(state.mutate).toHaveBeenCalled();
});
