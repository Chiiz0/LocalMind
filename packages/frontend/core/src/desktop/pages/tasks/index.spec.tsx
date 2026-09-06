/**
 * @vitest-environment happy-dom
 */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  PropsWithChildren,
  ReactElement,
} from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  openConfirmModal: vi.fn(),
  gql: vi.fn(),
  hostMetadata: { id: 'host-workspace' } as { id: string } | null,
  hostWorkspace: {
    id: 'host-workspace',
    scope: {
      id: 'host-workspace-scope',
      get: vi.fn(() => ({
        server: { scope: { id: 'host-server-scope' } },
      })),
    },
  } as {
    id: string;
    scope: {
      id: string;
      get: ReturnType<typeof vi.fn>;
    };
  } | null,
  layoutReady: vi.fn(),
  notifyError: vi.fn(),
  query: vi.fn(),
  listTaskIds: null as string[] | null,
  nextCursor: null as string | null,
  detailOverrides: {} as Record<string, object>,
  workspacesRevalidating: false,
}));

const tokens = vi.hoisted(() => ({
  GraphQLService: class GraphQLService {},
  ServerService: class ServerService {},
  WorkspaceServerService: class WorkspaceServerService {},
  WorkspaceService: class WorkspaceService {},
  acceptInvitationMutation: Symbol('acceptInvitationMutation'),
  abandonBlockerMutation: Symbol('abandonBlockerMutation'),
  approveAccessMutation: Symbol('approveAccessMutation'),
  controlMutation: Symbol('controlMutation'),
  declineInvitationMutation: Symbol('declineInvitationMutation'),
  rejectAccessMutation: Symbol('rejectAccessMutation'),
  requestProjectAccessMutation: Symbol('requestProjectAccessMutation'),
  resolveBlockerMutation: Symbol('resolveBlockerMutation'),
  tasksQuery: Symbol('tasksQuery'),
  detailQuery: Symbol('detailQuery'),
  withdrawAccessMutation: Symbol('withdrawAccessMutation'),
  withdrawInvitationMutation: Symbol('withdrawInvitationMutation'),
}));

const run = (
  id: string,
  workspaceId: string,
  title: string,
  artifacts: Array<{
    kind: string;
    id: string;
    title: string;
    workspaceId: string;
  }> = [],
  status = 'running',
  availableActions = ['cancel'],
  abandoned = false
) => ({
  id,
  workspaceId,
  projectId: null,
  title,
  workflow: 'test',
  status,
  createdAt: '2026-09-04T00:00:00.000Z',
  updatedAt: '2026-09-04T00:01:00.000Z',
  startedAt: '2026-09-04T00:00:30.000Z',
  completedAt: null,
  failureCode: status === 'failed' ? 'TEST_FAILURE' : null,
  failureMessage: status === 'failed' ? 'Retry or abandon this task' : null,
  resultSummary: null,
  approvalSummary: null,
  approvalFingerprint: 'current-approval-fingerprint',
  documentUpdate: null,
  resultEvidence: null,
  availableActions,
  abandoned,
  approval: null,
  artifacts,
  steps: [],
});

const tasks = [
  {
    id: 'run:workspace-a-task',
    entityId: 'workspace-a-task',
    kind: 'run',
    segment: 'todo',
    attention: null,
    workspaceId: 'workspace-a',
    projectId: null,
    title: 'Workspace A task',
    status: 'running',
    requestedLevel: null,
    documentId: null,
    redacted: false,
    relatedUserId: null,
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:01:00.000Z',
    completedAt: null,
    availableActions: ['cancel'],
    run: run('workspace-a-task', 'workspace-a', 'Workspace A task'),
  },
  {
    id: 'run:workspace-b-hidden',
    entityId: 'workspace-b-hidden',
    kind: 'run',
    segment: 'todo',
    attention: 'needs_my_action',
    workspaceId: 'workspace-b',
    projectId: null,
    title: 'Truncated workspace B task',
    status: 'failed',
    requestedLevel: null,
    documentId: null,
    redacted: false,
    relatedUserId: null,
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:01:00.000Z',
    completedAt: null,
    availableActions: ['resume', 'abandon'],
    run: run(
      'workspace-b-hidden',
      'workspace-b',
      'Truncated workspace B task',
      [
        {
          kind: 'document',
          id: 'doc-b',
          title: 'Document B',
          workspaceId: 'document-source-workspace',
        },
        {
          kind: 'office',
          id: 'office-b',
          title: 'Office B',
          workspaceId: 'workspace-b',
        },
      ],
      'failed',
      ['resume', 'abandon']
    ),
  },
  {
    id: 'access_request:request-1',
    entityId: 'request-1',
    kind: 'access_request',
    segment: 'todo',
    attention: 'needs_my_action',
    workspaceId: 'workspace-b',
    projectId: 'project-1',
    title: 'Quarterly plan access',
    status: 'pending',
    requestedLevel: 'read',
    documentId: 'doc-b',
    redacted: false,
    relatedUserId: 'requester-1',
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:01:00.000Z',
    completedAt: null,
    availableActions: ['approve_access_request', 'reject_access_request'],
    run: null,
  },
  {
    id: 'run:workspace-a-abandoned',
    entityId: 'workspace-a-abandoned',
    kind: 'run',
    segment: 'done',
    attention: null,
    workspaceId: 'workspace-a',
    projectId: null,
    title: 'Abandoned task',
    status: 'cancelled',
    requestedLevel: null,
    documentId: null,
    redacted: false,
    relatedUserId: null,
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:01:00.000Z',
    completedAt: '2026-09-04T00:01:00.000Z',
    availableActions: [],
    run: run(
      'workspace-a-abandoned',
      'workspace-a',
      'Abandoned task',
      [],
      'cancelled',
      [],
      true
    ),
  },
  {
    id: 'access_request:redacted-request',
    entityId: 'redacted-request',
    kind: 'access_request',
    segment: 'todo',
    attention: 'waiting_on_others',
    workspaceId: 'workspace-secret',
    projectId: 'project-1',
    title: 'Sensitive document title',
    status: 'pending',
    requestedLevel: 'read',
    documentId: 'sensitive-document-id',
    redacted: true,
    relatedUserId: 'requester-2',
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:01:00.000Z',
    completedAt: null,
    availableActions: [],
    run: null,
  },
  {
    id: 'blocker:blocker-1',
    entityId: 'blocker-1',
    kind: 'blocker',
    segment: 'todo',
    attention: 'waiting_on_others',
    workspaceId: null,
    projectId: 'project-1',
    title: 'Vendor launch dependency',
    status: 'waiting',
    requestedLevel: null,
    documentId: null,
    redacted: false,
    relatedUserId: null,
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:01:00.000Z',
    completedAt: null,
    availableActions: ['resolve_blocker', 'abandon_blocker'],
    blocker: {
      creatorUserId: 'user-1',
      type: 'wait_file',
      waitingOn: 'External reviewer',
      dueAt: '2026-09-03T17:00:00.000Z',
      overdue: true,
      origin: 'ai_suggested',
      resolutionActorUserId: null,
    },
    run: null,
  },
];

vi.mock('@affine/component', () => ({
  useConfirmModal: () => ({ openConfirmModal: state.openConfirmModal }),
  Input: () => <input />,
  Button: ({
    children,
    loading: _loading,
    prefix: _prefix,
    variant: _variant,
    ...props
  }: PropsWithChildren<
    ButtonHTMLAttributes<HTMLButtonElement> & {
      loading?: boolean;
      prefix?: ReactElement;
      variant?: string;
    }
  >) => <button {...props}>{children}</button>,
  IconButton: ({
    icon,
    size: _size,
    tooltip: _tooltip,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    icon?: ReactElement;
    size?: string;
    tooltip?: string;
  }) => <button {...props}>{icon}</button>,
  Loading: () => <div data-testid="loading" />,
  notify: { error: state.notifyError, success: vi.fn() },
  Tabs: {
    Root: ({
      children,
      onValueChange,
    }: PropsWithChildren<{ onValueChange: (value: string) => void }>) => (
      <div
        onClick={event => {
          const value = (event.target as HTMLElement).closest('button')?.dataset
            .value;
          if (value) onValueChange(value);
        }}
      >
        {children}
      </div>
    ),
    List: ({
      children,
      ...props
    }: PropsWithChildren<HTMLAttributes<HTMLElement>>) => (
      <div {...props}>{children}</div>
    ),
    Trigger: ({ children, value }: PropsWithChildren<{ value: string }>) => (
      <button type="button" data-value={value}>
        {children}
      </button>
    ),
  },
}));

vi.mock('@affine/core/components/hooks/use-query', () => ({
  useQuery: (request?: {
    query: symbol;
    variables: { taskId?: string; filter?: string; cursor?: string };
  }) => {
    state.query(request);
    const selected = tasks.find(task => task.id === request?.variables.taskId);
    const items = tasks.filter(
      task =>
        (!state.listTaskIds || state.listTaskIds.includes(task.id)) &&
        (request?.variables.filter === 'approval'
          ? task.attention === 'needs_my_action'
          : request?.variables.filter === 'completed'
            ? task.segment === 'done'
            : request?.variables.filter === 'active'
              ? task.status === 'running'
              : true)
    );
    return {
      data: {
        currentUser: {
          copilot:
            request?.query === tokens.detailQuery
              ? {
                  workbenchTask: selected
                    ? { ...selected, ...state.detailOverrides[selected.id] }
                    : null,
                }
              : {
                  workbenchTasks: {
                    capped: false,
                    nextCursor: request?.variables.cursor
                      ? null
                      : state.nextCursor,
                    items,
                  },
                },
        },
      },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    };
  },
}));

vi.mock('@affine/core/components/providers/swr-config-provider', () => ({
  SWRConfigProvider: ({ children }: PropsWithChildren) => (
    <div data-testid="swr-config">{children}</div>
  ),
}));

vi.mock('@affine/core/modules/cloud', () => ({
  GraphQLService: tokens.GraphQLService,
  ServerService: tokens.ServerService,
  WorkspaceServerService: tokens.WorkspaceServerService,
}));

vi.mock('@affine/core/modules/desktop-api', () => ({
  useAppLayoutReady: state.layoutReady,
}));

vi.mock('@affine/core/modules/workspace', () => ({
  WorkspaceService: tokens.WorkspaceService,
}));

vi.mock('@affine/core/modules/workbench', () => ({
  ViewBody: ({ children }: PropsWithChildren) => children,
  ViewHeader: ({ children }: PropsWithChildren) => children,
  ViewIcon: () => null,
  ViewTitle: () => null,
}));

vi.mock('@affine/error', () => ({
  UserFriendlyError: { fromAny: (error: Error) => error },
}));

vi.mock('@affine/graphql', () => ({
  acceptCopilotProjectInvitationMutation: tokens.acceptInvitationMutation,
  abandonCopilotBlockerMutation: tokens.abandonBlockerMutation,
  approveCopilotAccessRequestMutation: tokens.approveAccessMutation,
  controlCopilotTaskMutation: tokens.controlMutation,
  copilotWorkbenchTasksGetQuery: tokens.tasksQuery,
  copilotWorkbenchTaskGetQuery: tokens.detailQuery,
  declineCopilotProjectInvitationMutation: tokens.declineInvitationMutation,
  rejectCopilotAccessRequestMutation: tokens.rejectAccessMutation,
  reRequestCopilotProjectDocumentAccessMutation:
    tokens.requestProjectAccessMutation,
  resolveCopilotBlockerMutation: tokens.resolveBlockerMutation,
  withdrawCopilotAccessRequestMutation: tokens.withdrawAccessMutation,
  withdrawCopilotProjectInvitationMutation: tokens.withdrawInvitationMutation,
}));

vi.mock('@affine/i18n', () => ({
  useI18n: () =>
    new Proxy(
      {},
      {
        get: (_target, key) => () => String(key),
      }
    ),
}));

vi.mock('@blocksuite/icons/rc', () => ({
  ArrowLeftSmallIcon: () => <svg />,
  ArrowRightSmallIcon: () => <svg />,
  PageIcon: () => <svg />,
  ResetIcon: () => <svg />,
  WarningIcon: () => <svg />,
}));

vi.mock('@toeverything/infra', () => ({
  FrameworkScope: ({
    children,
    scope,
  }: PropsWithChildren<{ scope?: { id?: string } }>) => (
    <div data-testid={scope?.id ?? 'missing-scope'}>{children}</div>
  ),
  useService: (token: unknown) => {
    if (token === tokens.GraphQLService) return { gql: state.gql };
    if (token === tokens.ServerService)
      return { server: { baseUrl: 'https://source-server.test' } };
    throw new Error('Global Tasks must not resolve a workspace service');
  },
}));

vi.mock('../intelligence/host', () => ({
  useWorkbenchHost: () => ({
    hostMetadata: state.hostMetadata,
    hostWorkspace: state.hostWorkspace,
    workspacesRevalidating: state.workspacesRevalidating,
  }),
}));

import { Component as TasksComponent } from './index';

const Component = () => (
  <Routes>
    <Route path="/tasks" element={<TasksComponent />} />
    <Route path="*" element={null} />
  </Routes>
);

const LocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
};

describe('Global Tasks page', () => {
  beforeEach(() => {
    state.openConfirmModal.mockReset();
    state.gql.mockReset();
    state.hostMetadata = { id: 'host-workspace' };
    state.hostWorkspace = {
      id: 'host-workspace',
      scope: {
        id: 'host-workspace-scope',
        get: vi.fn(() => ({
          server: { scope: { id: 'host-server-scope' } },
        })),
      },
    };
    state.layoutReady.mockReset();
    state.notifyError.mockReset();
    state.query.mockReset();
    state.listTaskIds = null;
    state.nextCursor = null;
    state.detailOverrides = {};
    state.workspacesRevalidating = false;
  });

  afterEach(cleanup);

  test('loads user-level history and operates a non-run authorization item', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/tasks?filter=approval&taskId=access_request%3Arequest-1',
        ]}
      >
        <Component />
        <LocationProbe />
      </MemoryRouter>
    );

    expect(screen.getByTestId('global-tasks-page')).not.toBeNull();
    expect(screen.getByTestId('host-server-scope')).not.toBeNull();
    expect(screen.getByTestId('host-workspace-scope')).not.toBeNull();
    expect(state.layoutReady).toHaveBeenCalledTimes(1);
    expect(state.query).toHaveBeenCalledWith({
      query: tokens.tasksQuery,
      variables: { limit: 100, filter: 'approval', cursor: undefined },
    });
    expect(screen.getAllByText('Quarterly plan access')).toHaveLength(2);
    expect(screen.getByText('workspace-b')).not.toBeNull();
    expect(screen.getByText('project-1')).not.toBeNull();
    expect(screen.getByText('doc-b')).not.toBeNull();
    expect(screen.getByText('requester-1')).not.toBeNull();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'com.affine.localmind.workbench.action.approveAccess',
      })
    );
    expect(state.gql).not.toHaveBeenCalled();
    expect(state.openConfirmModal).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          'com.affine.localmind.accessNotification.projectConfirmation',
        autoFocusConfirm: false,
      })
    );
    await act(async () => state.openConfirmModal.mock.calls[0][0].onCancel());
    expect(state.gql).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'com.affine.localmind.workbench.action.approveAccess',
      })
    );
    await act(async () => state.openConfirmModal.mock.calls[1][0].onConfirm());
    await waitFor(() => {
      expect(state.gql).toHaveBeenCalledWith({
        query: tokens.approveAccessMutation,
        variables: { input: { requestId: 'request-1' } },
      });
    });
  });

  test('opens an Office artifact in the task source workspace', () => {
    render(
      <MemoryRouter
        initialEntries={['/tasks?filter=all&taskId=run%3Aworkspace-b-hidden']}
      >
        <Component />
        <LocationProbe />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Office B' }));
    expect(screen.getByTestId('location').textContent).toBe(
      '/workspace/workspace-b/office/office-b'
    );
  });

  test('keeps an old deep-link target outside the current page and opens its document source workspace', () => {
    state.listTaskIds = [tasks[0].id];
    render(
      <MemoryRouter
        initialEntries={['/tasks?filter=all&taskId=run%3Aworkspace-b-hidden']}
      >
        <Component />
        <LocationProbe />
      </MemoryRouter>
    );
    expect(
      screen.getByRole('heading', { name: 'Truncated workspace B task' })
    ).not.toBeNull();
    expect(screen.getByTestId('location').textContent).toContain(
      'taskId=run%3Aworkspace-b-hidden'
    );
    expect(state.query).toHaveBeenCalledWith({
      query: tokens.detailQuery,
      variables: { taskId: 'run:workspace-b-hidden' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Document B' }));
    expect(screen.getByTestId('location').textContent).toBe(
      '/workspace/document-source-workspace/doc-b?server=https%3A%2F%2Fsource-server.test&docScope=doc-b&access=write'
    );
  });

  test('keeps inaccessible deep links instead of selecting another task', () => {
    render(
      <MemoryRouter initialEntries={['/tasks?filter=all&taskId=run%3Amissing']}>
        <Component />
        <LocationProbe />
      </MemoryRouter>
    );
    expect(
      screen.getByText('com.affine.localmind.tasks.history.unavailable')
    ).not.toBeNull();
    expect(screen.getByTestId('location').textContent).toContain(
      'taskId=run%3Amissing'
    );
  });

  test('requests the next cursor and resets pagination when the server filter changes', () => {
    state.nextCursor = 'next-page-cursor';
    render(
      <MemoryRouter initialEntries={['/tasks?filter=all']}>
        <Component />
        <LocationProbe />
      </MemoryRouter>
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'com.affine.localmind.tasks.history.next',
      })
    );
    expect(state.query).toHaveBeenCalledWith({
      query: tokens.tasksQuery,
      variables: { limit: 100, filter: 'all', cursor: 'next-page-cursor' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'com.affine.localmind.tasks.filter.approval',
      })
    );
    expect(state.query).toHaveBeenCalledWith({
      query: tokens.tasksQuery,
      variables: { limit: 100, filter: 'approval', cursor: undefined },
    });
  });

  test('renders approval reason and invalidated document preview and confirms the reviewed fingerprint', async () => {
    const task = tasks[1];
    state.detailOverrides[task.id] = {
      status: 'waiting_approval',
      availableActions: ['approve', 'reject'],
      run: {
        ...task.run,
        status: 'waiting_approval',
        availableActions: ['approve', 'reject'],
        approvalSummary: {
          reason: 'Update the reviewed plan',
          operation: 'docs.replace',
          commandCount: 1,
          previewSummary: { stats: { paragraphs: 3 } },
        },
        documentUpdate: {
          workspaceId: 'document-source-workspace',
          docId: 'doc-b',
          content: 'Reviewed replacement content',
          expectedVersion: '2026-09-04T00:02:00.000Z',
          previousVersion: '2026-09-04T00:01:00.000Z',
          needsReconfirmation: true,
        },
      },
    };
    render(
      <MemoryRouter
        initialEntries={[
          '/tasks?filter=approval&taskId=run%3Aworkspace-b-hidden',
        ]}
      >
        <Component />
      </MemoryRouter>
    );
    expect(screen.getByText('Update the reviewed plan')).not.toBeNull();
    expect(screen.getByText('Reviewed replacement content')).not.toBeNull();
    expect(screen.getByRole('alert').textContent).toBe(
      'com.affine.localmind.tasks.approval.changed'
    );
    expect(screen.getByText('docs.replace')).not.toBeNull();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'com.affine.localmind.tasks.approval.confirmAgain',
      })
    );
    await waitFor(() =>
      expect(state.gql).toHaveBeenCalledWith({
        query: tokens.controlMutation,
        variables: {
          input: {
            taskId: 'workspace-b-hidden',
            workspaceId: 'workspace-b',
            action: 'approve',
            expectedApprovalFingerprint: 'current-approval-fingerprint',
          },
        },
      })
    );
  });

  test('restores authorization controls after a denied decision', async () => {
    state.gql.mockRejectedValueOnce(new Error('Denied'));
    render(
      <MemoryRouter
        initialEntries={[
          '/tasks?filter=approval&taskId=access_request%3Arequest-1',
        ]}
      >
        <Component />
      </MemoryRouter>
    );

    const approve = screen.getByRole('button', {
      name: 'com.affine.localmind.workbench.action.approveAccess',
    });
    fireEvent.click(approve);
    expect(state.gql).not.toHaveBeenCalled();
    await act(async () => state.openConfirmModal.mock.calls[0][0].onConfirm());

    await waitFor(() => {
      expect(state.notifyError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Denied' })
      );
      expect(approve.hasAttribute('disabled')).toBe(false);
    });
  });

  test('never renders document identity for a redacted authorization item', () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/tasks?filter=all&taskId=access_request%3Aredacted-request',
        ]}
      >
        <Component />
      </MemoryRouter>
    );

    expect(
      screen.getAllByText('com.affine.localmind.tasks.authorization.redacted')
    ).toHaveLength(2);
    expect(screen.queryByText('Sensitive document title')).toBeNull();
    expect(screen.queryByText('sensitive-document-id')).toBeNull();
    expect(screen.getByText('workspace-secret')).not.toBeNull();
    expect(screen.getByText('project-1')).not.toBeNull();
    expect(screen.getByText('requester-2')).not.toBeNull();
  });

  test('renders blocker details and suppresses duplicate transitions while pending', async () => {
    let release: ((value: unknown) => void) | undefined;
    state.gql.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          release = resolve;
        })
    );
    render(
      <MemoryRouter
        initialEntries={['/tasks?filter=all&taskId=blocker%3Ablocker-1']}
      >
        <Component />
      </MemoryRouter>
    );

    expect(screen.getAllByText('Vendor launch dependency')).toHaveLength(2);
    expect(screen.getByText('External reviewer')).not.toBeNull();
    expect(
      screen.getByText('com.affine.localmind.workbench.blocker.type.file')
    ).not.toBeNull();
    expect(
      screen.getByText('com.affine.localmind.workbench.blocker.overdue')
    ).not.toBeNull();
    expect(
      screen.getByText('com.affine.localmind.workbench.blocker.origin.ai')
    ).not.toBeNull();
    expect(
      screen.getByText('com.affine.localmind.tasks.authorization.kind.blocker')
    ).not.toBeNull();

    const resolve = screen.getByRole('button', {
      name: 'com.affine.localmind.workbench.blocker.resolve',
    });
    const abandon = screen.getByRole('button', {
      name: 'com.affine.localmind.workbench.blocker.abandon',
    });
    fireEvent.click(resolve);
    fireEvent.click(resolve);

    expect(state.gql).toHaveBeenCalledTimes(1);
    expect(state.gql).toHaveBeenCalledWith({
      query: tokens.resolveBlockerMutation,
      variables: { blockerId: 'blocker-1' },
    });
    expect(resolve.hasAttribute('disabled')).toBe(true);
    expect(abandon.hasAttribute('disabled')).toBe(true);

    release?.({});
    await waitFor(() => {
      expect(resolve.hasAttribute('disabled')).toBe(false);
      expect(abandon.hasAttribute('disabled')).toBe(false);
    });
  });

  test('restores blocker controls and reports a denied transition', async () => {
    state.gql.mockRejectedValueOnce(new Error('Blocker transition denied'));
    render(
      <MemoryRouter
        initialEntries={['/tasks?filter=all&taskId=blocker%3Ablocker-1']}
      >
        <Component />
      </MemoryRouter>
    );

    const abandon = screen.getByRole('button', {
      name: 'com.affine.localmind.workbench.blocker.abandon',
    });
    fireEvent.click(abandon);

    await waitFor(() => {
      expect(state.gql).toHaveBeenCalledWith({
        query: tokens.abandonBlockerMutation,
        variables: { blockerId: 'blocker-1' },
      });
      expect(state.notifyError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Blocker transition denied' })
      );
      expect(abandon.hasAttribute('disabled')).toBe(false);
    });
  });

  test('does not query tasks when no accessible host workspace exists', () => {
    state.hostMetadata = null;
    state.hostWorkspace = null;

    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <Component />
      </MemoryRouter>
    );

    expect(
      screen.getByText('com.affine.localmind.workbench.noHost')
    ).not.toBeNull();
    expect(screen.queryByTestId('global-tasks-page')).toBeNull();
    expect(state.query).not.toHaveBeenCalled();
    expect(state.layoutReady).toHaveBeenCalledTimes(1);
  });

  test('waits for the host workspace without querying tasks', () => {
    state.hostWorkspace = null;
    state.workspacesRevalidating = true;

    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <Component />
      </MemoryRouter>
    );

    expect(screen.getByTestId('loading')).not.toBeNull();
    expect(screen.queryByTestId('global-tasks-page')).toBeNull();
    expect(state.query).not.toHaveBeenCalled();
    expect(state.layoutReady).toHaveBeenCalledTimes(1);
  });
});
