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
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  conversationMounts: 0,
  conversationUnmounts: 0,
  frameworkScopes: [] as unknown[],
  gql: vi.fn(),
  layoutReady: vi.fn(),
  notifyError: vi.fn(),
  openWorkspaceDialog: vi.fn(),
  projectDocumentGranted: true,
  projectAvailable: true,
  projectsLoading: false,
  projectsResolved: true,
  quickSearchToggle: vi.fn(),
  project: {
    id: 'project-1',
    createdByUserId: 'user-1',
    name: 'Project one',
    description: '',
    status: 'active',
    aiPolicy: 'read_only',
    role: 'owner',
    documents: [
      {
        workspaceId: 'workspace-a',
        docId: 'doc-existing',
        title: 'Existing document',
        groupId: 'group-a',
        sortOrder: 2,
        status: 'granted',
        requestedLevel: 'read',
        accessRequestId: null,
        addedByMe: true,
        createdAt: '2026-09-04T00:00:00.000Z',
        updatedAt: '2026-09-04T00:00:00.000Z',
      },
      {
        workspaceId: 'workspace-b',
        docId: 'doc-1',
        title: 'Source document',
        groupId: null,
        sortOrder: 0,
        status: 'granted',
        requestedLevel: 'read',
        accessRequestId: null,
        addedByMe: true,
        createdAt: '2026-09-04T00:00:00.000Z',
        updatedAt: '2026-09-04T00:00:00.000Z',
      },
    ],
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
    documentCount: 2,
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
  tasksQuery: Symbol('tasksQuery'),
  addDocumentMutation: Symbol('addDocumentMutation'),
  confirmBlockerSuggestionMutation: Symbol('confirmBlockerSuggestion'),
  createBlockerMutation: Symbol('createBlocker'),
  updateProjectMutation: Symbol('updateProject'),
  /* eslint-disable rxjs/finnish -- Symbols identify mocked observable sources. */
  workspaces$: Symbol('workspaces$'),
  revalidating$: Symbol('revalidating$'),
  /* eslint-enable rxjs/finnish */
}));

vi.mock('@affine/component', () => ({
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
    state.query(request, config);
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
              contextProjects: state.projectAvailable
                ? [
                    state.projectDocumentGranted
                      ? state.project
                      : {
                          ...state.project,
                          documents: state.project.documents.map(document =>
                            document.docId === 'doc-1'
                              ? {
                                  ...document,
                                  docId: null,
                                  title: null,
                                  status: 'revoked',
                                }
                              : document
                          ),
                        },
                  ]
                : [],
            },
          },
        },
        error: undefined,
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

vi.mock('@affine/core/modules/notification', () => ({
  NotificationCountService: tokens.NotificationCountService,
}));

vi.mock('@affine/core/components/root-app-sidebar/user-info', () => ({
  default: () => <div>User</div>,
}));

vi.mock('@affine/core/desktop/route-paths', () => ({
  getWorkspaceDocPath: (workspaceId: string) => `/workspace/${workspaceId}/all`,
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
  QuickSearchInput: (props: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      Search
    </button>
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

vi.mock('@affine/core/modules/quicksearch', () => ({
  QuickSearchContainer: () => null,
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
  acceptCopilotProjectInvitationMutation: Symbol('acceptInvitation'),
  approveCopilotAccessRequestMutation: Symbol('approveAccess'),
  controlCopilotTaskMutation: Symbol('controlTask'),
  confirmCopilotBlockerSuggestionMutation:
    tokens.confirmBlockerSuggestionMutation,
  copilotContextProjectCreateMutation: Symbol('createProject'),
  copilotContextProjectDocumentAddMutation: tokens.addDocumentMutation,
  copilotContextProjectDocumentRemoveMutation: Symbol('removeDocument'),
  copilotContextProjectUpdateMutation: tokens.updateProjectMutation,
  copilotWorkbenchProjectsGetQuery: tokens.projectsQuery,
  copilotWorkbenchTaskPanelGetQuery: tokens.tasksQuery,
  createCopilotBlockerMutation: tokens.createBlockerMutation,
  declineCopilotProjectInvitationMutation: Symbol('declineInvitation'),
  leaveCopilotContextProjectMutation: Symbol('leaveProject'),
  reRequestCopilotProjectDocumentAccessMutation: Symbol('rerequestAccess'),
  rejectCopilotAccessRequestMutation: Symbol('rejectAccess'),
  removeCopilotContextProjectMemberMutation: Symbol('removeMember'),
  sendCopilotProjectInvitationMutation: Symbol('sendInvitation'),
  setCopilotContextProjectAiPolicyMutation: Symbol('setPolicy'),
  transferCopilotContextProjectOwnershipMutation: Symbol('transferOwnership'),
  withdrawCopilotAccessRequestMutation: Symbol('withdrawAccess'),
  withdrawCopilotProjectInvitationMutation: Symbol('withdrawInvitation'),
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
  CloseIcon: () => <svg />,
  SettingsIcon: () => <svg />,
  SidebarIcon: () => <svg />,
  WarningIcon: () => <svg />,
}));

vi.mock('@toeverything/infra', () => ({
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
  ProjectResourcePreview: () => <div data-testid="project-resource-preview" />,
}));

vi.mock('./project-tree', () => ({
  ProjectTree: ({
    onAddDocuments,
    onSelectDocument,
    onSelectProject,
  }: {
    onAddDocuments: (project: object, level: 'read' | 'write') => void;
    onSelectDocument: (projectId: string, document: object) => void;
    onSelectProject: (projectId: string | null) => void;
  }) => (
    <>
      <button type="button" onClick={() => onSelectProject(null)}>
        All projects
      </button>
      <button type="button" onClick={() => onSelectProject('project-1')}>
        Select project
      </button>
      <button
        type="button"
        onClick={() =>
          onSelectDocument('project-1', {
            workspaceId: 'workspace-b',
            docId: 'doc-1',
            title: 'Source document',
            groupId: null,
            sortOrder: 0,
            status: 'granted',
            requestedLevel: 'read',
            accessRequestId: null,
            addedByMe: true,
            createdAt: '2026-09-04T00:00:00.000Z',
            updatedAt: '2026-09-04T00:00:00.000Z',
          })
        }
      >
        Open source document
      </button>
      <button
        type="button"
        onClick={() => onAddDocuments(state.project, 'read')}
      >
        Add project documents
      </button>
    </>
  ),
}));

vi.mock('./task-panel', () => ({
  TaskPanel: ({
    navigationToggle,
    onOpenTask,
    onViewAll,
    onCreateBlocker,
    selectedProjectId,
  }: {
    navigationToggle: {
      expanded: boolean;
      controls: string;
      label: string;
      onClick: () => void;
    };
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
        aria-label={navigationToggle.label}
        aria-controls={navigationToggle.controls}
        aria-expanded={navigationToggle.expanded}
        onClick={navigationToggle.onClick}
      />
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

vi.mock('./source-document-peek', () => ({
  SourceDocumentPeek: (props: {
    docId: string;
    requestedLevel: 'read' | 'write';
  }) => {
    state.sourcePeek(props);
    return <div data-testid="source-peek">{props.docId}</div>;
  },
}));

import { Component } from './index';

const LocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname + location.search}
    </output>
  );
};

const renderWorkbench = (route = '/intelligence?project=project-1') =>
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
    state.gql.mockResolvedValue({
      addCopilotContextProjectDocument: { outcome: 'granted' },
    });
    state.layoutReady.mockReset();
    state.notifyError.mockReset();
    state.openWorkspaceDialog.mockReset();
    state.projectDocumentGranted = true;
    state.projectAvailable = true;
    state.projectsLoading = false;
    state.projectsResolved = true;
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

  test('shows aggregate tasks without mounting chat in All projects', () => {
    renderWorkbench('/intelligence');

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

    fireEvent.click(screen.getByRole('button', { name: 'Select project' }));
    expect(screen.queryByTestId('conversation')).not.toBeNull();
    expect(state.conversationMounts).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'All projects' }));
    expect(screen.queryByTestId('conversation')).toBeNull();
    expect(state.conversationUnmounts).toBe(1);
    expect(screen.getByTestId('location').textContent).toBe('/intelligence');
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
      <MemoryRouter initialEntries={['/intelligence?project=project-1']}>
        <Component />
        <LocationProbe />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('conversation')).not.toBeNull();
  });

  test('preserves the Project and resource URL while a suspended query has no resolved data', () => {
    state.projectsResolved = false;
    const view = renderWorkbench(
      '/intelligence?project=project-1&resource=native-doc'
    );
    expect(screen.getByTestId('location').textContent).toBe(
      '/intelligence?project=project-1&resource=native-doc'
    );
    state.projectsResolved = true;
    view.rerender(
      <MemoryRouter
        initialEntries={['/intelligence?project=project-1&resource=native-doc']}
      >
        <Component />
        <LocationProbe />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('conversation')).not.toBeNull();
    expect(screen.getByTestId('location').textContent).toBe(
      '/intelligence?project=project-1&resource=native-doc'
    );
  });

  test('does not mount chat for an unavailable project in the URL', async () => {
    renderWorkbench('/intelligence?project=unavailable-project');

    expect(state.conversationMounts).toBe(0);
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/intelligence');
    });
    expect(screen.queryByTestId('conversation')).toBeNull();
  });

  test('unmounts chat when the selected project is no longer accessible', async () => {
    const view = renderWorkbench();
    expect(state.conversationMounts).toBe(1);

    state.projectAvailable = false;
    view.rerender(
      <MemoryRouter initialEntries={['/intelligence?project=project-1']}>
        <Component />
        <LocationProbe />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('conversation')).toBeNull();
    expect(state.conversationUnmounts).toBe(1);
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe('/intelligence');
    });
  });

  test('falls back to an accessible execution host and sends project filtering to the server', async () => {
    localStorage.setItem('last_workspace_id', 'missing-workspace');
    renderWorkbench();

    expect(screen.getByTestId('host-workspace').textContent).toBe(
      'workspace-a'
    );
    expect(state.revalidateWorkspaces).toHaveBeenCalled();
    expect(state.layoutReady).toHaveBeenCalled();
    expect(state.frameworkScopes).toContain('server-scope:workspace-a');
    expect(state.query).toHaveBeenCalledWith(
      {
        query: tokens.projectsQuery,
        variables: { includeArchived: false },
      },
      expect.objectContaining({ refreshInterval: 5000 })
    );
    expect(state.query).toHaveBeenCalledWith(
      {
        query: tokens.tasksQuery,
        variables: { projectId: 'project-1' },
      },
      expect.objectContaining({ refreshInterval: 5000 })
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

  test('re-hosts the existing workspace shell affordances in the project rail', () => {
    renderWorkbench();

    expect(state.workspaceSelector).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceMetadata: expect.objectContaining({ id: 'workspace-a' }),
        showSyncStatus: true,
      })
    );
    expect(screen.getByText('User')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Notifications' })
    ).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(state.quickSearchToggle).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'com.affine.localmind.workbench.returnToWorkspace',
      })
    );
    expect(screen.getByTestId('location').textContent).toBe(
      '/workspace/workspace-a/all'
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'com.affine.settingSidebar.title' })
    );
    expect(state.openWorkspaceDialog).toHaveBeenCalledWith('setting', {
      activeTab: 'appearance',
    });
  });

  test('uses a single-column mobile drawer without remounting conversation for document peek', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 375,
    });
    renderWorkbench();

    const navigation = screen.getByRole('complementary', {
      name: 'com.affine.localmind.workbench.navigation',
    });
    const workArea = screen.getByTestId('intelligence-work-area');
    const toggle = screen.getByRole('button', {
      name: 'com.affine.sidebarSwitch.expand',
    });

    expect(navigation.dataset.mobileOpen).toBe('false');
    fireEvent.click(toggle);
    expect(navigation.dataset.mobileOpen).toBe('true');
    expect(workArea.hasAttribute('inert')).toBe(true);

    fireEvent.click(
      within(navigation).getByRole('button', { name: 'Open source document' })
    );
    await waitFor(() => {
      expect(screen.getByTestId('source-peek').textContent).toBe('doc-1');
    });
    expect(state.sourcePeek).toHaveBeenCalledWith(
      expect.objectContaining({ docId: 'doc-1', requestedLevel: 'read' })
    );
    expect(navigation.dataset.mobileOpen).toBe('false');
    expect(state.conversationMounts).toBe(1);
    expect(state.conversationUnmounts).toBe(0);

    fireEvent.click(toggle);
    for (const role of ['dialog', 'menu']) {
      const overlay = document.createElement('div');
      overlay.setAttribute('role', role);
      const control = document.createElement('button');
      overlay.append(control);
      document.body.append(overlay);
      fireEvent.keyDown(control, { key: 'Escape' });
      expect(navigation.dataset.mobileOpen).toBe('true');
      overlay.remove();
    }
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(navigation.dataset.mobileOpen).toBe('false');
  });

  test('closes an open preview when project polling reports its grant revoked', async () => {
    const view = renderWorkbench();
    fireEvent.click(
      screen.getByRole('button', { name: 'Open source document' })
    );
    expect(await screen.findByTestId('source-peek')).not.toBeNull();

    state.projectDocumentGranted = false;
    view.rerender(
      <MemoryRouter initialEntries={['/intelligence?project=project-1']}>
        <Component />
        <LocationProbe />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.queryByTestId('source-peek')).toBeNull());
    expect(state.conversationUnmounts).toBe(0);
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

  test('adds a workspace document through the server two-branch mutation', async () => {
    renderWorkbench();

    fireEvent.click(
      screen.getByRole('button', { name: 'Add project documents' })
    );

    await waitFor(() => {
      expect(state.gql).toHaveBeenCalledTimes(1);
      expect(state.gql).toHaveBeenCalledWith({
        query: tokens.addDocumentMutation,
        variables: {
          input: {
            projectId: 'project-1',
            workspaceId: 'workspace-a',
            docId: 'doc-new',
            requestedLevel: 'read',
            requestedTitle: 'New document',
            sortOrder: 3,
          },
        },
      });
      expect(state.refreshProjects).toHaveBeenCalledTimes(1);
    });
  });

  test('does not refresh after a denied two-branch add', async () => {
    state.gql.mockRejectedValueOnce(new Error('Permission changed'));
    renderWorkbench();

    fireEvent.click(
      screen.getByRole('button', { name: 'Add project documents' })
    );

    await waitFor(() => {
      expect(state.gql).toHaveBeenCalledTimes(1);
      expect(state.notifyError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Permission changed' })
      );
    });
    expect(state.refreshProjects).not.toHaveBeenCalled();
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
