/**
 * @vitest-environment happy-dom
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type {
  ButtonHTMLAttributes,
  PropsWithChildren,
  ReactElement,
} from 'react';
import { useEffect } from 'react';
import {
  BrowserRouter,
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  conversationMounts: 0,
  conversationUnmounts: 0,
  frameworkScopes: [] as unknown[],
  gql: vi.fn(),
  layoutReady: vi.fn(),
  notifyError: vi.fn(),
  openWorkspaceDialog: vi.fn(),
  projectAvailable: true,
  projectsLoading: false,
  projectsResolved: true,
  projectsError: undefined as Error | undefined,
  quickSearchToggle: vi.fn(),
  project: {
    id: 'project-1',
    createdByUserId: 'user-1',
    name: 'Project one',
    description: '',
    status: 'active',
    aiPolicy: 'read_only',
    role: 'owner',
    members: [
      {
        userId: 'user-1',
        name: 'Owner',
        email: 'owner@example.com',
        avatarUrl: null,
        role: 'owner',
        createdAt: '2026-09-04T00:00:00.000Z',
      },
    ],
    canManage: true,
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
  },
  query: vi.fn(),
  refreshProjects: vi.fn(),
  refreshTaskPanel: vi.fn(),
  revalidateWorkspaces: vi.fn(),
  workspacesRevalidating: false,
  workspaceSelector: vi.fn(),
  sourcePeek: vi.fn(),
  workspaces: [
    { id: 'workspace-a', flavour: 'cloud' },
    { id: 'workspace-b', flavour: 'cloud' },
  ],
}));

const tokens = vi.hoisted(() => ({
  GraphQLService: class GraphQLService {},
  DefaultServerService: class DefaultServerService {},
  NotificationCountService: class NotificationCountService {},
  WorkspaceServerService: class WorkspaceServerService {},
  QuickSearchService: class QuickSearchService {},
  WorkspaceDialogService: class WorkspaceDialogService {},
  WorkspacesService: class WorkspacesService {},
  projectsQuery: Symbol('projectsQuery'),
  resourceQuery: Symbol('resourceQuery'),
  resourcePathQuery: Symbol('resourcePathQuery'),
  tasksQuery: Symbol('tasksQuery'),
  confirmBlockerSuggestionMutation: Symbol('confirmBlockerSuggestion'),
  createBlockerMutation: Symbol('createBlocker'),
  updateProjectMutation: Symbol('updateProject'),
  /* eslint-disable rxjs/finnish -- Symbols identify mocked observable sources. */
  workspaces$: Symbol('workspaces$'),
  revalidating$: Symbol('revalidating$'),
  /* eslint-enable rxjs/finnish */
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
    icon?: ReactElement;
    size?: string;
    tooltip?: string;
  }) => <button {...props}>{icon}</button>,
  Loading: () => <div data-testid="loading" />,
  notify: {
    error: state.notifyError,
    success: vi.fn(),
    warning: vi.fn(),
  },
  useConfirmModal: () => ({ openConfirmModal: vi.fn() }),
}));

vi.mock('@affine/core/components/hooks/use-query', () => ({
  useQuery: (
    request: { query: unknown; variables: unknown },
    config: unknown
  ) => {
    if (!request) return { mutate: state.refreshProjects };
    state.query(request, config);
    if (request.query === tokens.resourceQuery)
      return {
        data: {
          projectResource: {
            id: 'native-doc',
            title: 'Native document',
            kind: 'page',
            parentId: null,
          },
        },
        mutate: state.refreshProjects,
      };
    if (request.query === tokens.resourcePathQuery)
      return {
        data: {
          projectResourcePath: [{ id: 'native-doc', title: 'Native document' }],
        },
        mutate: state.refreshProjects,
      };
    if (request.query === tokens.projectsQuery) {
      if (!state.projectsResolved) {
        return {
          data: undefined,
          error: undefined,
          isLoading: false,
          mutate: state.refreshProjects,
        };
      }
      return {
        data: {
          currentUser: {
            copilot: {
              contextProjects: state.projectAvailable ? [state.project] : [],
            },
          },
        },
        error: state.projectsError,
        isLoading: state.projectsLoading,
        mutate: state.refreshProjects,
      };
    }
    return {
      data: {
        currentUser: {
          copilot: {
            workbenchTaskPanel: {
              todo: { capped: false, items: [] },
              inProgress: { capped: false, items: [] },
              done: { capped: false, items: [] },
            },
          },
        },
      },
      error: undefined,
      isLoading: false,
      mutate: state.refreshTaskPanel,
    };
  },
}));

vi.mock('@affine/core/components/hooks/use-workspace', () => ({
  useWorkspace: (metadata: { id: string } | null) =>
    metadata
      ? {
          id: metadata.id,
          scope: {
            get: (token: unknown) => {
              if (token === tokens.WorkspaceServerService) {
                return { server: { scope: `server-scope:${metadata.id}` } };
              }
              throw new Error('Unexpected scoped service token');
            },
          },
          docCollection: {
            meta: {
              getDocMeta: (docId: string) => ({
                title: docId === 'doc-new' ? 'New document' : docId,
              }),
            },
          },
        }
      : null,
}));

vi.mock('@affine/core/components/providers/swr-config-provider', () => ({
  SWRConfigProvider: ({ children }: PropsWithChildren) => children,
}));

vi.mock('@affine/core/components/workspace-selector', () => ({
  WorkspaceSelector: (props: {
    workspaceMetadata: { id: string };
    showSyncStatus?: boolean;
  }) => {
    state.workspaceSelector(props);
    return <div data-testid="host-workspace">{props.workspaceMetadata.id}</div>;
  },
}));

vi.mock('@affine/core/components/root-app-sidebar/notification-button', () => ({
  NotificationButton: () => <button type="button">Notifications</button>,
}));

vi.mock('@affine/core/modules/project-resources/realtime', () => ({
  useProjectRefresh: vi.fn(),
}));
vi.mock('@affine/core/modules/quicksearch', () => ({
  QuickSearchService: tokens.QuickSearchService,
  ProjectsQuickSearchSession: class {},
  QuickSearchContainer: () => null,
}));
vi.mock('./project-shell-settings', () => ({
  ProjectShellSettings: ({ open }: { open: boolean }) =>
    open ? <div data-testid="project-settings" /> : null,
}));
vi.mock('./project-summary', () => ({ ProjectSummary: () => null }));
vi.mock('@affine/core/modules/notification', () => ({
  NotificationCountService: tokens.NotificationCountService,
}));

vi.mock('@affine/core/components/root-app-sidebar/user-info', () => ({
  default: () => <div>User</div>,
}));

vi.mock('@affine/core/desktop/dialogs', () => ({
  WorkspaceDialogs: () => null,
}));

vi.mock('@affine/core/modules/app-sidebar/views', () => ({
  MenuItem: ({
    children,
    ...props
  }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@affine/core/modules/cloud', () => ({
  GraphQLService: tokens.GraphQLService,
  DefaultServerService: tokens.DefaultServerService,
  WorkspaceServerService: tokens.WorkspaceServerService,
}));

vi.mock('@affine/core/modules/dialogs', () => ({
  WorkspaceDialogService: tokens.WorkspaceDialogService,
}));

vi.mock('@affine/core/modules/desktop-api', () => ({
  useAppLayoutReady: state.layoutReady,
}));

vi.mock('@affine/core/modules/quicksearch/services/cmdk', () => ({
  CMDKQuickSearchService: tokens.QuickSearchService,
}));

vi.mock('@affine/core/modules/workspace', () => ({
  WorkspacesService: tokens.WorkspacesService,
}));

vi.mock('@affine/error', () => ({
  UserFriendlyError: { fromAny: (error: Error) => error },
}));

vi.mock('@affine/graphql', () => ({
  projectResourceQuery: tokens.resourceQuery,
  projectResourcePathQuery: tokens.resourcePathQuery,
  acceptCopilotProjectInvitationMutation: Symbol('acceptInvitation'),
  approveCopilotAccessRequestMutation: Symbol('approveAccess'),
  controlCopilotTaskMutation: Symbol('controlTask'),
  confirmCopilotBlockerSuggestionMutation:
    tokens.confirmBlockerSuggestionMutation,
  copilotContextProjectCreateMutation: Symbol('createProject'),
  copilotContextProjectUpdateMutation: tokens.updateProjectMutation,
  copilotWorkbenchProjectsGetQuery: tokens.projectsQuery,
  copilotWorkbenchTaskPanelGetQuery: tokens.tasksQuery,
  createCopilotBlockerMutation: tokens.createBlockerMutation,
  declineCopilotProjectInvitationMutation: Symbol('declineInvitation'),
  leaveCopilotContextProjectMutation: Symbol('leaveProject'),
  rejectCopilotAccessRequestMutation: Symbol('rejectAccess'),
  removeCopilotContextProjectMemberMutation: Symbol('removeMember'),
  sendCopilotProjectInvitationMutation: Symbol('sendInvitation'),
  setCopilotContextProjectAiPolicyMutation: Symbol('setPolicy'),
  transferCopilotContextProjectOwnershipMutation: Symbol('transferOwnership'),
  withdrawCopilotAccessRequestMutation: Symbol('withdrawAccess'),
  withdrawCopilotProjectInvitationMutation: Symbol('withdrawInvitation'),
}));

vi.mock('@affine/i18n', () => ({
  getOrCreateI18n: () => ({ t: (key: string) => key }),
  useI18n: () =>
    new Proxy(
      {},
      {
        get: (_target, key) => () => String(key),
      }
    ),
}));

vi.mock('@blocksuite/icons/rc', () => ({
  AiIcon: () => <svg />,
  FolderIcon: () => <svg />,
  ArrowLeftSmallIcon: () => <svg />,
  ArrowRightSmallIcon: () => <svg />,
  CloseIcon: () => <svg />,
  SearchIcon: () => <svg />,
  SettingsIcon: () => <svg />,
  SidebarIcon: () => <svg />,
  WarningIcon: () => <svg />,
}));

vi.mock('@toeverything/infra', () => ({
  useFramework: () => ({ createEntity: vi.fn() }),
  FrameworkScope: ({
    children,
    scope,
  }: PropsWithChildren<{ scope?: unknown }>) => {
    state.frameworkScopes.push(scope);
    return children;
  },
  useLiveData: (source: unknown) => {
    if (source === tokens.workspaces$) return state.workspaces;
    if (source === tokens.revalidating$) return state.workspacesRevalidating;
    return undefined;
  },
  useService: (token: unknown) => {
    if (token === tokens.WorkspacesService) {
      return {
        list: {
          /* eslint-disable rxjs/finnish -- Mock keys mirror the WorkspacesService API. */
          workspaces$: tokens.workspaces$,
          isRevalidating$: tokens.revalidating$,
          /* eslint-enable rxjs/finnish */
          revalidate: state.revalidateWorkspaces,
        },
      };
    }
    if (token === tokens.GraphQLService) return { gql: state.gql };
    if (token === tokens.QuickSearchService)
      return { quickSearch: { show: state.quickSearchToggle, hide: vi.fn() } };
    if (token === tokens.DefaultServerService) {
      return { server: { scope: 'default-server-scope' } };
    }
    if (token === tokens.NotificationCountService) {
      return {
        // eslint-disable-next-line rxjs/finnish -- Mock key mirrors the NotificationCountService API.
        revision$: { subscribe: () => ({ unsubscribe: vi.fn() }) },
      };
    }
    if (token === tokens.WorkspaceDialogService) {
      return { open: state.openWorkspaceDialog };
    }
    throw new Error('Unexpected service token');
  },
  useServiceOptional: (token: unknown) => {
    if (token === tokens.QuickSearchService) {
      return state.workspaces.length
        ? { toggle: state.quickSearchToggle }
        : null;
    }
    if (token === tokens.WorkspaceDialogService) {
      return state.workspaces.length
        ? { open: state.openWorkspaceDialog }
        : null;
    }
    return null;
  },
}));

vi.mock('./project-resource-preview', () => ({
  ProjectResourcePreview: ({
    onClose,
    onToggleFullscreen,
  }: {
    onClose: () => void;
    onToggleFullscreen: () => void;
  }) => (
    <div data-testid="project-resource-preview">
      <button onClick={onClose}>Close resource</button>
      <button onClick={onToggleFullscreen}>Fullscreen</button>
    </div>
  ),
}));
vi.mock('./project-files', () => ({
  ProjectFiles: ({ onOpen }: { onOpen: (id: string) => void }) => (
    <div data-testid="project-main-files">
      <button onClick={() => onOpen('native-doc')}>Open native resource</button>
    </div>
  ),
}));

vi.mock('@affine/core/components/project-file-request/detail', () => ({
  ProjectFileRequestModal: () => null,
}));

vi.mock('./project-tree', () => ({
  ProjectTree: ({
    onSelectProject,
  }: {
    onSelectProject: (projectId: string | null) => void;
  }) => (
    <>
      <button type="button" onClick={() => onSelectProject(null)}>
        All projects
      </button>
      <button type="button" onClick={() => onSelectProject('project-1')}>
        Select project
      </button>
    </>
  ),
}));

vi.mock('./task-panel', () => ({
  TaskPanel: ({
    onOpenTask,
    onViewAll,
    onCreateBlocker,
    selectedProjectId,
  }: {
    onOpenTask: (task: object) => void;
    onViewAll: (segment: 'todo' | 'in-progress' | 'done') => void;
    onCreateBlocker: (
      projectId: string,
      blocker: {
        title: string;
        type: 'wait_reply';
        waitingOn: string;
        dueAt: string | null;
      }
    ) => Promise<boolean>;
    selectedProjectId: string | null;
  }) => (
    <>
      <button
        type="button"
        onClick={() =>
          onOpenTask({
            id: 'workspace-b-failed',
            workspaceId: 'workspace-b',
            status: 'failed',
          })
        }
      >
        Open cross-workspace task
      </button>
      <button type="button" onClick={() => onViewAll('todo')}>
        View all Todo
      </button>
      <button type="button" onClick={() => onViewAll('in-progress')}>
        View all In progress
      </button>
      <button type="button" onClick={() => onViewAll('done')}>
        View all Done
      </button>
      {selectedProjectId ? (
        <button
          type="button"
          onClick={() =>
            void onCreateBlocker(selectedProjectId, {
              title: 'Waiting for reply',
              type: 'wait_reply',
              waitingOn: 'Vendor',
              dueAt: null,
            })
          }
        >
          Create blocker from panel
        </button>
      ) : null}
    </>
  ),
}));

vi.mock('./workbench-conversation', () => ({
  WorkbenchConversation: ({
    onConfirmBlockerSuggestion,
  }: {
    onConfirmBlockerSuggestion?: (suggestion: {
      aiSuggestionId: string;
      confirmationProof: string;
      projectId: string;
      title: string;
      type: 'wait_reply';
      waitingOn: string;
      dueAt: string | null;
      origin: 'ai_suggested';
      confirmationRequired: true;
    }) => Promise<void>;
  }) => {
    useEffect(() => {
      state.conversationMounts += 1;
      return () => {
        state.conversationUnmounts += 1;
      };
    }, []);
    return (
      <div data-testid="conversation">
        {onConfirmBlockerSuggestion ? (
          <>
            <button
              type="button"
              onClick={() => {
                void onConfirmBlockerSuggestion({
                  aiSuggestionId: 'b3b94f5e-936d-4d0e-875a-a0475f612f80',
                  confirmationProof: 'signed-proof-project-1',
                  projectId: 'project-1',
                  title: 'Waiting for AI suggested reply',
                  type: 'wait_reply',
                  waitingOn: 'Customer',
                  dueAt: '2026-09-05T17:00:00.000Z',
                  origin: 'ai_suggested',
                  confirmationRequired: true,
                }).catch(() => {});
              }}
            >
              Confirm AI blocker suggestion
            </button>
            <button
              type="button"
              onClick={() => {
                void onConfirmBlockerSuggestion({
                  aiSuggestionId: '2822f003-634d-4692-9d0c-16128d2fbb87',
                  confirmationProof: 'signed-proof-project-2',
                  projectId: 'project-2',
                  title: 'Old project suggestion',
                  type: 'wait_reply',
                  waitingOn: 'Customer',
                  dueAt: null,
                  origin: 'ai_suggested',
                  confirmationRequired: true,
                }).catch(() => {});
              }}
            >
              Confirm other project suggestion
            </button>
          </>
        ) : null}
      </div>
    );
  },
}));

import { Component as ProjectComponent } from './index';

const Component = () => (
  <Routes>
    <Route path="/project/:projectId?" element={<ProjectComponent />} />
    <Route
      path="/project/:projectId/resources/:resourceId"
      element={<ProjectComponent />}
    />
    <Route path="*" element={<ProjectComponent />} />
  </Routes>
);

const LocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname + location.search}
    </output>
  );
};

const renderWorkbench = (route = '/project/project-1') =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Component />
      <LocationProbe />
    </MemoryRouter>
  );

describe('Intelligence workbench shell', () => {
  beforeEach(() => {
    state.conversationMounts = 0;
    state.conversationUnmounts = 0;
    state.frameworkScopes.length = 0;
    state.gql.mockReset();
    state.gql.mockResolvedValue({});
    state.layoutReady.mockReset();
    state.notifyError.mockReset();
    state.openWorkspaceDialog.mockReset();
    state.projectAvailable = true;
    state.projectsLoading = false;
    state.projectsResolved = true;
    state.projectsError = undefined;
    state.project.status = 'active';
    state.openWorkspaceDialog.mockImplementation(
      (_name, _options, onSelect: (ids: string[]) => void) => {
        onSelect?.(['doc-new']);
      }
    );
    state.query.mockReset();
    state.quickSearchToggle.mockReset();
    state.refreshProjects.mockReset();
    state.refreshTaskPanel.mockReset();
    state.revalidateWorkspaces.mockReset();
    state.workspaceSelector.mockReset();
    state.sourcePeek.mockReset();
    state.workspaces = [
      { id: 'workspace-a', flavour: 'cloud' },
      { id: 'workspace-b', flavour: 'cloud' },
    ];
    state.workspacesRevalidating = false;
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(cleanup);

  test('a direct resource entry creates a Project parent for browser Back without writing', async () => {
    const original = window.history.state;
    const originalUrl = window.location.href;
    window.history.replaceState(
      { idx: 0 },
      '',
      '/project/project-1/resources/native-doc?source=share'
    );
    const Back = () => {
      const navigate = useNavigate();
      const location = useLocation();
      return (
        <button
          onClick={() => navigate(-1)}
          disabled={!location.state?.projectHistorySeeded}
        >
          Browser back
        </button>
      );
    };
    try {
      render(
        <BrowserRouter>
          <Component />
          <LocationProbe />
          <Back />
        </BrowserRouter>
      );
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Browser back' })
        ).toHaveProperty('disabled', false)
      );
      expect(screen.getByTestId('location').textContent).toBe(
        '/project/project-1/resources/native-doc?source=share'
      );
      fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toBe(
          '/project/project-1'
        )
      );
      expect(state.gql).not.toHaveBeenCalled();
    } finally {
      window.history.replaceState(original, '', originalUrl);
    }
  });

  test('lists projects above aggregate tasks and opens a project from the overview', () => {
    renderWorkbench('/project');

    expect(screen.queryByTestId('conversation')).toBeNull();
    expect(state.conversationMounts).toBe(0);
    expect(state.query).toHaveBeenCalledWith(
      {
        query: tokens.tasksQuery,
        variables: { projectId: undefined },
      },
      expect.anything()
    );
    expect(
      screen.getByRole('button', { name: 'View all Todo' })
    ).not.toBeNull();

    const overview = within(screen.getByTestId('project-overview'));
    const projectLink = overview.getByRole('link', { name: 'Project one' });
    expect(projectLink.getAttribute('href')).toBe('/project/project-1');
    expect(
      projectLink.compareDocumentPosition(
        screen.getByRole('button', { name: 'View all Todo' })
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    fireEvent.click(projectLink);
    expect(screen.getByTestId('location').textContent).toBe(
      '/project/project-1'
    );
    expect(screen.queryByTestId('project-overview')).toBeNull();
    expect(screen.getByTestId('project-main-files')).not.toBeNull();
    expect(screen.queryByTestId('conversation')).not.toBeNull();
    expect(state.conversationMounts).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'All projects' }));
    expect(screen.queryByTestId('conversation')).toBeNull();
    expect(state.conversationUnmounts).toBe(1);
    expect(screen.getByTestId('location').textContent).toBe('/project');
    expect(
      within(screen.getByTestId('project-overview')).getByRole('link', {
        name: 'Project one',
      })
    ).not.toBeNull();
  });

  test('shows project overview loading before an empty result is available', () => {
    state.projectAvailable = false;
    state.projectsLoading = true;
    renderWorkbench('/project');
    const overview = within(screen.getByTestId('project-overview'));
    expect(overview.getByRole('status').textContent).toContain(
      'com.affine.loading'
    );
    expect(
      overview.queryByText('com.affine.localmind.workbench.projects.emptyTitle')
    ).toBeNull();
  });

  test.each(['empty', 'archived'])(
    'shows the empty project overview for %s results',
    stateName => {
      state.projectAvailable = stateName !== 'empty';
      if (stateName === 'archived') state.project.status = 'archived';
      renderWorkbench('/project');
      const overview = within(screen.getByTestId('project-overview'));
      expect(
        overview.getByText('com.affine.localmind.workbench.projects.emptyTitle')
      ).not.toBeNull();
      expect(overview.queryByRole('link')).toBeNull();
    }
  );

  test('retries a failed project query from the main overview', () => {
    state.projectsError = new Error('Network unavailable');
    renderWorkbench('/project');
    const overview = within(screen.getByTestId('project-overview'));
    expect(overview.getByRole('alert')).not.toBeNull();
    expect(overview.queryByRole('link')).toBeNull();
    fireEvent.click(
      overview.getByRole('button', {
        name: 'com.affine.localmind.workbench.retry',
      })
    );
    expect(state.refreshProjects).toHaveBeenCalledOnce();
  });

  test('does not mount chat before the selected project is available', () => {
    state.projectAvailable = false;
    state.projectsLoading = true;
    const view = renderWorkbench();

    expect(screen.queryByTestId('conversation')).toBeNull();
    expect(state.conversationMounts).toBe(0);

    state.projectAvailable = true;
    state.projectsLoading = false;
    view.rerender(
      <MemoryRouter initialEntries={['/project/project-1']}>
        <Component />
        <LocationProbe />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('conversation')).not.toBeNull();
  });

  test('opens native resources in the main area with chat mounted and fullscreen as a UI action', () => {
    renderWorkbench();
    fireEvent.click(
      screen.getByRole('button', { name: 'Open native resource' })
    );
    expect(screen.getByTestId('location').textContent).toBe(
      '/project/project-1/resources/native-doc'
    );
    expect(screen.getByTestId('conversation').closest('[hidden]')).toBeNull();
    expect(state.conversationMounts).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
    expect(
      screen.getByTestId('conversation').closest('[hidden]')
    ).not.toBeNull();
    expect(screen.getByTestId('location').textContent).toBe(
      '/project/project-1/resources/native-doc'
    );
    expect(state.gql).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close resource' }));
    expect(screen.getByTestId('location').textContent).toBe(
      '/project/project-1'
    );
    expect(state.conversationMounts).toBe(1);
  });

  test('preserves the Project and resource URL while a suspended query has no resolved data', () => {
    state.projectsResolved = false;
    const view = renderWorkbench('/project/project-1/resources/native-doc');
    expect(screen.getByTestId('location').textContent).toBe(
      '/project/project-1/resources/native-doc'
    );
    state.projectsResolved = true;
    view.rerender(
      <MemoryRouter
        initialEntries={['/project/project-1/resources/native-doc']}
      >
        <Component />
        <LocationProbe />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('conversation')).not.toBeNull();
    expect(screen.getByTestId('location').textContent).toBe(
      '/project/project-1/resources/native-doc'
    );
  });

  test('does not mount chat for an unavailable project in the URL', async () => {
    renderWorkbench('/project/unavailable-project');

    expect(state.conversationMounts).toBe(0);
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/project');
    });
    expect(screen.queryByTestId('conversation')).toBeNull();
    expect(state.notifyError).toHaveBeenCalledWith({
      title: 'com.affine.localmind.project-error.permission',
    });
  });

  test('unmounts chat when the selected project is no longer accessible', async () => {
    const view = renderWorkbench();
    expect(state.conversationMounts).toBe(1);

    state.projectAvailable = false;
    view.rerender(
      <MemoryRouter initialEntries={['/project/project-1']}>
        <Component />
        <LocationProbe />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('conversation')).toBeNull();
    expect(state.conversationUnmounts).toBe(1);
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/project');
    });
  });

  test('uses the default server and sends project filtering without constructing a Workspace host', async () => {
    localStorage.setItem('last_workspace_id', 'missing-workspace');
    renderWorkbench();

    expect(screen.queryByTestId('host-workspace')).toBeNull();
    expect(state.revalidateWorkspaces).not.toHaveBeenCalled();
    expect(state.layoutReady).toHaveBeenCalled();
    expect(state.frameworkScopes).toContain('default-server-scope');
    expect(state.query).toHaveBeenCalledWith(
      {
        query: tokens.projectsQuery,
        variables: { includeArchived: false },
      },
      expect.not.objectContaining({ refreshInterval: expect.anything() })
    );
    expect(state.query).toHaveBeenCalledWith(
      {
        query: tokens.tasksQuery,
        variables: { projectId: 'project-1' },
      },
      expect.not.objectContaining({ refreshInterval: expect.anything() })
    );
  });

  test('loads project navigation through the server without a workspace', () => {
    state.workspaces = [];
    renderWorkbench();

    expect(
      screen.getByRole('button', { name: 'Select project' })
    ).not.toBeNull();
    expect(screen.queryByTestId('host-workspace')).toBeNull();
    expect(state.frameworkScopes).toContain('default-server-scope');
    expect(state.layoutReady).toHaveBeenCalled();
  });

  test('keeps project navigation available during workspace discovery', () => {
    state.workspaces = [];
    state.workspacesRevalidating = true;
    renderWorkbench();

    expect(
      screen.getByRole('button', { name: 'Select project' })
    ).not.toBeNull();
    expect(state.layoutReady).toHaveBeenCalled();
  });

  test('provides independent search, appearance, account and Workspace return controls', () => {
    renderWorkbench();

    expect(state.workspaceSelector).not.toHaveBeenCalled();
    expect(screen.getByText('User')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Notifications' })
    ).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Quick search' }));
    expect(state.quickSearchToggle).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('button', { name: 'com.affine.settingSidebar.title' })
    );
    expect(screen.getByTestId('project-settings')).not.toBeNull();
    expect(state.gql).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'com.affine.localmind.workbench.returnToWorkspace',
      })
    );
    expect(screen.getByTestId('location').textContent).toBe('/');
  });

  test('routes task cards and capped segments into the global full history', () => {
    renderWorkbench();

    fireEvent.click(
      screen.getByRole('button', { name: 'Open cross-workspace task' })
    );
    expect(screen.getByTestId('location').textContent).toBe(
      '/tasks?taskId=workspace-b-failed'
    );

    fireEvent.click(screen.getByRole('button', { name: 'View all Todo' }));
    expect(screen.getByTestId('location').textContent).toBe(
      '/tasks?filter=all'
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'View all In progress' })
    );
    expect(screen.getByTestId('location').textContent).toBe(
      '/tasks?filter=active'
    );

    fireEvent.click(screen.getByRole('button', { name: 'View all Done' }));
    expect(screen.getByTestId('location').textContent).toBe(
      '/tasks?filter=completed'
    );
  });

  test('creates a manual blocker only after the panel submits and refreshes the projection', async () => {
    renderWorkbench();

    expect(state.gql).not.toHaveBeenCalledWith(
      expect.objectContaining({ query: tokens.createBlockerMutation })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Create blocker from panel' })
    );

    await waitFor(() => {
      expect(state.gql).toHaveBeenCalledWith({
        query: tokens.createBlockerMutation,
        variables: {
          input: {
            projectId: 'project-1',
            title: 'Waiting for reply',
            type: 'wait_reply',
            waitingOn: 'Vendor',
          },
        },
      });
      expect(state.refreshTaskPanel).toHaveBeenCalledTimes(1);
    });
  });

  test('persists an AI blocker suggestion only after explicit confirmation with its idempotency id', async () => {
    renderWorkbench();

    expect(state.gql).not.toHaveBeenCalledWith(
      expect.objectContaining({
        query: tokens.confirmBlockerSuggestionMutation,
      })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm AI blocker suggestion' })
    );

    await waitFor(() => {
      expect(state.gql).toHaveBeenCalledWith({
        query: tokens.confirmBlockerSuggestionMutation,
        variables: {
          input: {
            projectId: 'project-1',
            suggestion: {
              aiSuggestionId: 'b3b94f5e-936d-4d0e-875a-a0475f612f80',
              confirmationProof: 'signed-proof-project-1',
              title: 'Waiting for AI suggested reply',
              type: 'wait_reply',
              waitingOn: 'Customer',
              dueAt: '2026-09-05T17:00:00.000Z',
              origin: 'ai_suggested',
              confirmationRequired: true,
            },
          },
        },
      });
      expect(state.refreshTaskPanel).toHaveBeenCalledTimes(1);
    });
  });

  test('fails closed when a retained suggestion belongs to a different selected project', async () => {
    renderWorkbench();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm other project suggestion',
      })
    );

    await waitFor(() => {
      expect(state.notifyError).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            'com.affine.localmind.workbench.blocker.selectSuggestedProject',
        })
      );
    });
    expect(state.gql).not.toHaveBeenCalledWith(
      expect.objectContaining({
        query: tokens.confirmBlockerSuggestionMutation,
      })
    );
    expect(state.refreshTaskPanel).not.toHaveBeenCalled();
  });
});
