import { IconButton, notify, useConfirmModal } from '@affine/component';
import type { BlockerSuggestion } from '@affine/core/blocksuite/ai/components/ai-chat-messages';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { ProjectFileRequestModal } from '@affine/core/components/project-file-request/detail';
import { SWRConfigProvider } from '@affine/core/components/providers/swr-config-provider';
import { NotificationButton } from '@affine/core/components/root-app-sidebar/notification-button';
import UserInfo from '@affine/core/components/root-app-sidebar/user-info';
import { getProjectPath } from '@affine/core/desktop/route-paths';
import { MenuItem as SidebarMenuItem } from '@affine/core/modules/app-sidebar/views';
import {
  DefaultServerService,
  GraphQLService,
} from '@affine/core/modules/cloud';
import { useAppLayoutReady } from '@affine/core/modules/desktop-api';
import {
  projectErrorMessage,
  reportProjectError,
} from '@affine/core/modules/project-resources/error';
import { useProjectRefresh } from '@affine/core/modules/project-resources/realtime';
import {
  ProjectsQuickSearchSession,
  QuickSearchContainer,
  QuickSearchService,
} from '@affine/core/modules/quicksearch';
import {
  confirmCopilotBlockerSuggestionMutation,
  copilotContextProjectCreateMutation,
  copilotContextProjectUpdateMutation,
  copilotWorkbenchProjectsGetQuery,
  copilotWorkbenchTaskPanelGetQuery,
  createCopilotBlockerMutation,
  leaveCopilotContextProjectMutation,
  projectResourcePathQuery,
  projectResourceQuery,
  removeCopilotContextProjectMemberMutation,
  sendCopilotProjectInvitationMutation,
  setCopilotContextProjectAiPolicyMutation,
  transferCopilotContextProjectOwnershipMutation,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import {
  AiIcon,
  ArrowLeftSmallIcon,
  CloseIcon,
  FolderIcon,
  SearchIcon,
  SettingsIcon,
  SidebarIcon,
} from '@blocksuite/icons/rc';
import type { OfficeAiContext } from '@localmind/office';
import { FrameworkScope, useFramework, useService } from '@toeverything/infra';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import * as styles from './index.css';
import {
  ProjectCollaboration,
  type ProjectCollaborationPendingKey,
} from './project-collaboration';
import { ProjectFiles } from './project-files';
import { ProjectOverview } from './project-overview';
import { ProjectResourcePreview } from './project-resource-preview';
import { ProjectShellSettings } from './project-shell-settings';
import { ProjectSummary } from './project-summary';
import { ProjectTree } from './project-tree';
import { TaskPanel } from './task-panel';
import {
  EMPTY_TASK_PANEL,
  type WorkbenchBlockerDraft,
  type WorkbenchPanelTaskAction,
  type WorkbenchProject,
  type WorkbenchProjectMember,
  type WorkbenchTask,
} from './types';
import { useAccessRequestConfirmation } from './use-access-request-confirmation';
import { useProjectTaskDecision } from './use-project-task-decision';
import { WorkbenchConversation } from './workbench-conversation';
import { executeWorkbenchTaskAction } from './workbench-task-action';

export const Component = () => {
  useAppLayoutReady();

  const defaultServer = useService(DefaultServerService).server;
  const navigate = useNavigate();
  const location = useLocation();
  const seeded = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    projectId: selectedProjectId = null,
    resourceId: selectedResourceId = null,
  } = useParams();

  useEffect(() => {
    if (
      !selectedProjectId ||
      !selectedResourceId ||
      seeded.current ||
      window.history.state?.idx !== 0 ||
      location.state?.projectHistorySeeded
    )
      return;
    seeded.current = true;
    const target = location.pathname + location.search + location.hash;
    // A shared resource link needs a Project entry to return to on browser Back.
    // Seed the current entry before the router pushes, without racing two navigations.
    window.history.replaceState(
      window.history.state,
      '',
      getProjectPath(selectedProjectId)
    );
    void Promise.resolve(
      navigate(target, {
        state: { ...location.state, projectHistorySeeded: true },
      })
    ).catch(reportProjectError);
  }, [location, navigate, selectedProjectId, selectedResourceId]);

  const selectResource = useCallback(
    (projectId: string, resourceId: string | null) => {
      navigate(getProjectPath(projectId, resourceId));
    },
    [navigate]
  );

  const selectProject = useCallback(
    (projectId: string | null) => {
      navigate(getProjectPath(projectId));
    },
    [navigate]
  );

  return (
    <FrameworkScope scope={defaultServer?.scope}>
      <SWRConfigProvider>
        <QuickSearchContainer />
        <ProjectFileRequestModal
          requestId={searchParams.get('fileRequest')}
          onClose={() =>
            setSearchParams(
              current => {
                const next = new URLSearchParams(current);
                next.delete('fileRequest');
                return next;
              },
              { replace: true }
            )
          }
        />
        <IntelligenceWorkbench
          selectedProjectId={selectedProjectId}
          selectedResourceId={selectedResourceId}
          onSelectResource={selectResource}
          onSelectProject={selectProject}
        />
      </SWRConfigProvider>
    </FrameworkScope>
  );
};

type IntelligenceWorkbenchProps = {
  selectedProjectId: string | null;
  selectedResourceId: string | null;
  onSelectResource: (projectId: string, resourceId: string | null) => void;
  onSelectProject: (projectId: string | null) => void;
};

const IntelligenceWorkbench = ({
  selectedProjectId,
  selectedResourceId,
  onSelectResource,
  onSelectProject,
}: IntelligenceWorkbenchProps) => {
  const t = useI18n();
  const navigate = useNavigate();
  const framework = useFramework();
  const quickSearch = useService(QuickSearchService).quickSearch;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [officeContext, setOfficeContext] = useState<OfficeAiContext>();
  const [mobileView, setMobileView] = useState<'files' | 'chat'>('files');
  useEffect(() => {
    setFullscreen(false);
    setMobileView('files');
  }, [selectedProjectId, selectedResourceId]);
  const openSearch = useCallback(() => {
    quickSearch.show(
      [framework.createEntity(ProjectsQuickSearchSession)],
      result => {
        if (result)
          navigate(
            getProjectPath(result.payload.projectId, result.payload.resourceId)
          );
      },
      { placeholder: { i18nKey: 'com.affine.localmind.workbench.projects' } }
    );
  }, [framework, navigate, quickSearch]);
  useEffect(() => () => quickSearch.hide(), [quickSearch]);
  const graphqlService = useService(GraphQLService);
  const { openConfirmModal } = useConfirmModal();
  const [pendingMutationKey, setPendingMutationKey] = useState<string | null>(
    null
  );
  const [collaborationProjectId, setCollaborationProjectId] = useState<
    string | null
  >(null);
  const [collaborationPendingKey, setCollaborationPendingKey] =
    useState<ProjectCollaborationPendingKey | null>(null);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [pendingTaskAction, setPendingTaskAction] = useState<{
    taskId: string;
    action: WorkbenchPanelTaskAction;
  } | null>(null);
  const blockerCreatePending = useRef(false);

  useEffect(() => {
    if (!mobileNavigationOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !event
          .composedPath()
          .some(
            target =>
              target instanceof Element &&
              target.matches('[role="dialog"], [role="menu"]')
          )
      ) {
        setMobileNavigationOpen(false);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [mobileNavigationOpen]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('screen and (max-width: 760px)');
    const closeOnWideViewport = () => {
      if (!media.matches) {
        setMobileNavigationOpen(false);
      }
    };
    media.addEventListener('change', closeOnWideViewport);
    return () => media.removeEventListener('change', closeOnWideViewport);
  }, []);

  const {
    data: projectsData,
    error: projectsError,
    isLoading: projectsLoading,
    mutate: refreshProjects,
  } = useQuery(
    {
      query: copilotWorkbenchProjectsGetQuery,
      variables: { includeArchived: false },
    },
    {
      suspense: false,
      shouldRetryOnError: false,
    }
  );
  const projects = projectsData?.currentUser?.copilot.contextProjects ?? [];
  const selectedProject =
    projects.find(project => project.id === selectedProjectId) ?? null;
  const resourceQuery = useQuery(
    selectedProjectId && selectedResourceId
      ? {
          query: projectResourceQuery,
          variables: {
            projectId: selectedProjectId,
            resourceId: selectedResourceId,
          },
        }
      : undefined,
    { suspense: false, shouldRetryOnError: false }
  );
  const resourcePath = useQuery(
    selectedProjectId && selectedResourceId
      ? {
          query: projectResourcePathQuery,
          variables: {
            projectId: selectedProjectId,
            resourceId: selectedResourceId,
          },
        }
      : undefined,
    { suspense: false, shouldRetryOnError: false }
  );
  useProjectRefresh(selectedProjectId, 'resource', () =>
    Promise.all([resourceQuery.mutate(), resourcePath.mutate()])
  );
  const resource = resourceQuery.data?.projectResource;
  const resourceIsFolder = resource?.kind === 'folder';
  const directoryId = resourceIsFolder
    ? resource.id
    : (resource?.parentId ?? null);
  const collaborationProject =
    projects.find(project => project.id === collaborationProjectId) ?? null;

  const {
    data: taskPanelData,
    error: taskPanelError,
    isLoading: taskPanelLoading,
    mutate: refreshTaskPanel,
  } = useQuery(
    {
      query: copilotWorkbenchTaskPanelGetQuery,
      variables: { projectId: selectedProjectId ?? undefined },
    },
    {
      suspense: false,
      shouldRetryOnError: false,
    }
  );
  const taskPanel =
    taskPanelData?.currentUser?.copilot.workbenchTaskPanel ?? EMPTY_TASK_PANEL;

  useProjectRefresh(null, 'list', refreshProjects);
  useProjectRefresh(selectedProjectId, 'task', refreshTaskPanel);

  useEffect(() => {
    if (
      !projectsLoading &&
      !projectsError &&
      projectsData?.currentUser &&
      selectedProjectId &&
      !selectedProject
    ) {
      notify.error({
        title: t['com.affine.localmind.project-error.permission'](),
      });
      onSelectProject(null);
    }
  }, [
    onSelectProject,
    projectsData,
    projectsError,
    projectsLoading,
    selectedProject,
    selectedProjectId,
    t,
  ]);

  const reportMutationError = useCallback((caught: unknown, title: string) => {
    notify.error({
      title,
      message: projectErrorMessage(caught),
    });
  }, []);

  const createProject = useCallback(
    async (name: string) => {
      setPendingMutationKey('project:create');
      try {
        const result = await graphqlService.gql({
          query: copilotContextProjectCreateMutation,
          variables: { input: { name } },
        });
        await refreshProjects();
        onSelectProject(result.createCopilotContextProject.id);
        notify.success({
          title: t['com.affine.localmind.workbench.project.created'](),
        });
      } catch (caught) {
        reportMutationError(
          caught,
          t['com.affine.localmind.workbench.project.createFailed']()
        );
      } finally {
        setPendingMutationKey(null);
      }
    },
    [graphqlService, onSelectProject, refreshProjects, reportMutationError, t]
  );

  const renameProject = useCallback(
    async (project: WorkbenchProject, name: string) => {
      setPendingMutationKey(`project:${project.id}:rename`);
      try {
        await graphqlService.gql({
          query: copilotContextProjectUpdateMutation,
          variables: { input: { id: project.id, name } },
        });
        await refreshProjects();
        notify.success({
          title: t['com.affine.localmind.workbench.project.renamed'](),
        });
      } catch (caught) {
        reportMutationError(
          caught,
          t['com.affine.localmind.workbench.project.renameFailed']()
        );
      } finally {
        setPendingMutationKey(null);
      }
    },
    [graphqlService, refreshProjects, reportMutationError, t]
  );

  const archiveProject = useCallback(
    async (project: WorkbenchProject) => {
      openConfirmModal({
        title: t['com.affine.localmind.workbench.project.archiveConfirm'](),
        description:
          t['com.affine.localmind.workbench.project.archiveDescription'](),
        confirmText: t['com.affine.localmind.workbench.project.archive'](),
        cancelText: t['Cancel'](),
        confirmButtonOptions: { variant: 'error' },
        onConfirm: async () => {
          setPendingMutationKey(`project:${project.id}:archive`);
          try {
            await graphqlService.gql({
              query: copilotContextProjectUpdateMutation,
              variables: { input: { id: project.id, status: 'archived' } },
            });
            if (selectedProjectId === project.id) onSelectProject(null);
            await Promise.all([refreshProjects(), refreshTaskPanel()]);
            notify.success({
              title: t['com.affine.localmind.workbench.project.archived'](),
            });
          } catch (caught) {
            reportMutationError(
              caught,
              t['com.affine.localmind.workbench.project.archiveFailed']()
            );
          } finally {
            setPendingMutationKey(null);
          }
        },
      });
    },
    [
      graphqlService,
      onSelectProject,
      openConfirmModal,
      refreshProjects,
      refreshTaskPanel,
      reportMutationError,
      selectedProjectId,
      t,
    ]
  );

  useEffect(() => {
    if (collaborationProjectId && !collaborationProject) {
      setCollaborationProjectId(null);
    }
  }, [collaborationProject, collaborationProjectId]);

  const inviteProjectMember = useCallback(
    async (email: string) => {
      if (!collaborationProject || collaborationPendingKey) return false;
      setCollaborationPendingKey('invite');
      try {
        await graphqlService.gql({
          query: sendCopilotProjectInvitationMutation,
          variables: { input: { projectId: collaborationProject.id, email } },
        });
        await refreshTaskPanel();
        notify.success({
          title: t['com.affine.localmind.workbench.project.inviteSent'](),
        });
        return true;
      } catch (caught) {
        reportMutationError(
          caught,
          t['com.affine.localmind.workbench.project.inviteFailed']()
        );
        return false;
      } finally {
        setCollaborationPendingKey(null);
      }
    },
    [
      collaborationPendingKey,
      collaborationProject,
      graphqlService,
      refreshTaskPanel,
      reportMutationError,
      t,
    ]
  );

  const updateProjectAiPolicy = useCallback(
    async (policy: 'read_only' | 'read_write') => {
      if (!collaborationProject || collaborationPendingKey) return false;
      setCollaborationPendingKey('policy');
      try {
        await graphqlService.gql({
          query: setCopilotContextProjectAiPolicyMutation,
          variables: { input: { projectId: collaborationProject.id, policy } },
        });
        await refreshProjects();
        notify.success({
          title: t['com.affine.localmind.workbench.project.aiPolicyUpdated'](),
        });
        return true;
      } catch (caught) {
        reportMutationError(
          caught,
          t['com.affine.localmind.workbench.project.aiPolicyFailed']()
        );
        return false;
      } finally {
        setCollaborationPendingKey(null);
      }
    },
    [
      collaborationPendingKey,
      collaborationProject,
      graphqlService,
      refreshProjects,
      reportMutationError,
      t,
    ]
  );

  const removeProjectMember = useCallback(
    async (member: WorkbenchProjectMember) => {
      if (!collaborationProject || collaborationPendingKey) return false;
      setCollaborationPendingKey(`remove:${member.userId}`);
      try {
        await graphqlService.gql({
          query: removeCopilotContextProjectMemberMutation,
          variables: {
            input: {
              projectId: collaborationProject.id,
              memberUserId: member.userId,
            },
          },
        });
        await Promise.all([refreshProjects(), refreshTaskPanel()]);
        notify.success({
          title: t['com.affine.localmind.workbench.project.memberRemoved'](),
        });
        return true;
      } catch (caught) {
        reportMutationError(
          caught,
          t['com.affine.localmind.workbench.project.memberRemoveFailed']()
        );
        return false;
      } finally {
        setCollaborationPendingKey(null);
      }
    },
    [
      collaborationPendingKey,
      collaborationProject,
      graphqlService,
      refreshProjects,
      refreshTaskPanel,
      reportMutationError,
      t,
    ]
  );

  const transferProjectOwnership = useCallback(
    async (member: WorkbenchProjectMember) => {
      if (!collaborationProject || collaborationPendingKey) return false;
      setCollaborationPendingKey(`transfer:${member.userId}`);
      try {
        await graphqlService.gql({
          query: transferCopilotContextProjectOwnershipMutation,
          variables: {
            input: {
              projectId: collaborationProject.id,
              memberUserId: member.userId,
            },
          },
        });
        await Promise.all([refreshProjects(), refreshTaskPanel()]);
        notify.success({
          title:
            t['com.affine.localmind.workbench.project.ownershipTransferred'](),
        });
        return true;
      } catch (caught) {
        reportMutationError(
          caught,
          t['com.affine.localmind.workbench.project.transferFailed']()
        );
        return false;
      } finally {
        setCollaborationPendingKey(null);
      }
    },
    [
      collaborationPendingKey,
      collaborationProject,
      graphqlService,
      refreshProjects,
      refreshTaskPanel,
      reportMutationError,
      t,
    ]
  );

  const leaveProject = useCallback(async () => {
    if (!collaborationProject || collaborationPendingKey) return false;
    const projectId = collaborationProject.id;
    setCollaborationPendingKey('leave');
    try {
      await graphqlService.gql({
        query: leaveCopilotContextProjectMutation,
        variables: { projectId },
      });
      setCollaborationProjectId(null);
      if (selectedProjectId === projectId) onSelectProject(null);
      await Promise.all([refreshProjects(), refreshTaskPanel()]);
      notify.success({
        title: t['com.affine.localmind.workbench.project.left'](),
      });
      return true;
    } catch (caught) {
      reportMutationError(
        caught,
        t['com.affine.localmind.workbench.project.leaveFailed']()
      );
      return false;
    } finally {
      setCollaborationPendingKey(null);
    }
  }, [
    collaborationPendingKey,
    collaborationProject,
    graphqlService,
    onSelectProject,
    refreshProjects,
    refreshTaskPanel,
    reportMutationError,
    selectedProjectId,
    t,
  ]);

  const confirmAccessRequest = useAccessRequestConfirmation();
  const decideProjectTask = useProjectTaskDecision();
  const controlTask = useCallback(
    async (task: WorkbenchTask, action: WorkbenchPanelTaskAction) => {
      if (pendingTaskAction || !task.availableActions.includes(action)) return;
      if (
        task.projectTask &&
        (action === 'approve' || action === 'reject' || action === 'cancel')
      ) {
        if (await decideProjectTask(task.projectTask, action))
          await refreshTaskPanel();
        return;
      }
      if (action === 'approve' && task.kind === 'run') {
        navigate(
          `/tasks?${new URLSearchParams({ taskId: task.id, filter: 'approval' })}`
        );
        return;
      }
      setPendingTaskAction({ taskId: task.id, action });
      try {
        const confirmation =
          action === 'approve_access_request' ||
          action === 'reject_access_request'
            ? await confirmAccessRequest(task, action)
            : null;
        if (
          (action === 'approve_access_request' ||
            action === 'reject_access_request') &&
          !confirmation
        )
          return;
        await executeWorkbenchTaskAction(
          graphqlService,
          task,
          action,
          confirmation
        );
        await Promise.all([refreshProjects(), refreshTaskPanel()]);
        notify.success({
          title:
            task.kind === 'blocker'
              ? t['com.affine.localmind.workbench.blocker.updated']()
              : t['com.affine.localmind.tasks.action.success'](),
        });
      } catch (caught) {
        reportMutationError(
          caught,
          task.kind === 'blocker'
            ? t['com.affine.localmind.workbench.blocker.updateFailed']()
            : t['com.affine.localmind.tasks.action.failed']()
        );
      } finally {
        setPendingTaskAction(null);
      }
    },
    [
      confirmAccessRequest,
      decideProjectTask,
      graphqlService,
      navigate,
      pendingTaskAction,
      refreshProjects,
      refreshTaskPanel,
      reportMutationError,
      t,
    ]
  );

  const createBlocker = useCallback(
    async (projectId: string, blocker: WorkbenchBlockerDraft) => {
      if (blockerCreatePending.current) return false;
      blockerCreatePending.current = true;
      try {
        await graphqlService.gql({
          query: createCopilotBlockerMutation,
          variables: {
            input: {
              projectId,
              title: blocker.title,
              type: blocker.type,
              waitingOn: blocker.waitingOn,
              ...(blocker.dueAt ? { dueAt: blocker.dueAt } : {}),
            },
          },
        });
        await refreshTaskPanel();
        notify.success({
          title: t['com.affine.localmind.workbench.blocker.created'](),
        });
        return true;
      } catch (caught) {
        reportMutationError(
          caught,
          t['com.affine.localmind.workbench.blocker.createFailed']()
        );
        return false;
      } finally {
        blockerCreatePending.current = false;
      }
    },
    [graphqlService, refreshTaskPanel, reportMutationError, t]
  );

  const confirmBlockerSuggestion = useCallback(
    async (suggestion: BlockerSuggestion) => {
      if (suggestion.projectId !== selectedProjectId) {
        const error = new Error(
          t['com.affine.localmind.workbench.blocker.selectSuggestedProject']()
        );
        notify.error({
          title: t['com.affine.localmind.workbench.blocker.createFailed'](),
          message: error.message,
        });
        throw error;
      }
      try {
        await graphqlService.gql({
          query: confirmCopilotBlockerSuggestionMutation,
          variables: {
            input: {
              projectId: suggestion.projectId,
              suggestion: {
                aiSuggestionId: suggestion.aiSuggestionId,
                confirmationProof: suggestion.confirmationProof,
                title: suggestion.title,
                type: suggestion.type,
                waitingOn: suggestion.waitingOn,
                ...(suggestion.dueAt ? { dueAt: suggestion.dueAt } : {}),
                origin: suggestion.origin,
                confirmationRequired: suggestion.confirmationRequired,
              },
            },
          },
        });
        await refreshTaskPanel();
        notify.success({
          title:
            t['com.affine.localmind.workbench.blocker.suggestionCreated'](),
        });
      } catch (caught) {
        reportMutationError(
          caught,
          t['com.affine.localmind.workbench.blocker.createFailed']()
        );
        throw caught;
      }
    },
    [
      graphqlService,
      refreshTaskPanel,
      reportMutationError,
      selectedProjectId,
      t,
    ]
  );

  const openTask = useCallback(
    (task: WorkbenchTask) => {
      navigate(`/tasks?taskId=${encodeURIComponent(task.id)}`);
    },
    [navigate]
  );

  const viewAllTasks = useCallback(
    (segment: 'todo' | 'in-progress' | 'done') => {
      const filter =
        segment === 'todo'
          ? 'all'
          : segment === 'in-progress'
            ? 'active'
            : 'completed';
      navigate(`/tasks?filter=${filter}`);
    },
    [navigate]
  );

  return (
    <main className={styles.root} data-testid="intelligence-workbench">
      <aside
        id="intelligence-project-navigation"
        className={styles.rail}
        data-mobile-open={mobileNavigationOpen}
        aria-label={t['com.affine.localmind.workbench.navigation']()}
      >
        <div className={styles.railHeader}>
          <div className={styles.workspaceAndAccount}>
            <SidebarMenuItem
              icon={<ArrowLeftSmallIcon />}
              onClick={() => navigate('/')}
            >
              {t['com.affine.localmind.workbench.returnToWorkspace']()}
            </SidebarMenuItem>
            <UserInfo />
            <span className={styles.mobileRailClose}>
              <IconButton
                size="20"
                icon={<CloseIcon />}
                aria-label={t['com.affine.sidebarSwitch.collapse']()}
                onClick={() => setMobileNavigationOpen(false)}
              />
            </span>
          </div>
          <div className={styles.railUtilities}>
            <NotificationButton />
            <SidebarMenuItem
              icon={<SettingsIcon />}
              onClick={() => setSettingsOpen(true)}
            >
              {t['com.affine.settingSidebar.title']()}
            </SidebarMenuItem>
            <SidebarMenuItem icon={<SearchIcon />} onClick={openSearch}>
              {t['Quick search']()}
            </SidebarMenuItem>
          </div>
        </div>

        <ProjectTree
          projects={projects}
          selectedProjectId={selectedProjectId}
          loading={projectsLoading}
          error={projectsError ? projectErrorMessage(projectsError) : undefined}
          mutationsPending={pendingMutationKey !== null}
          onRefresh={() => void refreshProjects()}
          onSelectProject={projectId => {
            onSelectProject(projectId);
            setMobileNavigationOpen(false);
          }}
          onCreate={createProject}
          onRename={renameProject}
          onArchive={archiveProject}
          onManageCollaboration={project =>
            setCollaborationProjectId(project.id)
          }
        />
      </aside>

      <button
        type="button"
        className={styles.railScrim}
        data-mobile-open={mobileNavigationOpen}
        aria-label={t['com.affine.sidebarSwitch.collapse']()}
        onClick={() => setMobileNavigationOpen(false)}
      />

      <section
        className={styles.workArea}
        data-testid="intelligence-work-area"
        inert={mobileNavigationOpen || undefined}
      >
        <header className={styles.projectHeader}>
          <span className={styles.mobileRailClose}>
            <IconButton
              size="20"
              icon={<SidebarIcon />}
              aria-label={t['com.affine.sidebarSwitch.expand']()}
              onClick={() => setMobileNavigationOpen(true)}
            />
          </span>
          <nav
            className={styles.projectBreadcrumbs}
            aria-label={t['com.affine.localmind.project-files.root']()}
          >
            <button
              onClick={() =>
                selectedProject && onSelectResource(selectedProject.id, null)
              }
            >
              {selectedProject?.name ??
                t['com.affine.localmind.workbench.projects.all']()}
            </button>
            {resourcePath.data?.projectResourcePath.map(part => (
              <button
                key={part.id}
                aria-current={
                  part.id === selectedResourceId ? 'page' : undefined
                }
                onClick={() =>
                  selectedProject &&
                  onSelectResource(selectedProject.id, part.id)
                }
              >
                {part.title}
              </button>
            ))}
          </nav>
          {selectedProject?.canManage ? (
            <ProjectSummary
              key={selectedProject.id}
              projectId={selectedProject.id}
              projectName={selectedProject.name}
            />
          ) : null}
          {selectedProject ? (
            <IconButton
              size="20"
              icon={<SettingsIcon />}
              tooltip={t['com.affine.localmind.workbench.project.actions']()}
              aria-label={t['com.affine.localmind.workbench.project.actions']()}
              onClick={() => setCollaborationProjectId(selectedProject.id)}
            />
          ) : null}
          {selectedProject ? (
            <div role="tablist" className={styles.mobileViewTabs}>
              <IconButton
                role="tab"
                size="20"
                icon={<FolderIcon />}
                aria-selected={mobileView === 'files'}
                aria-label={t['com.affine.localmind.project-files.title']()}
                onClick={() => setMobileView('files')}
              />
              <IconButton
                role="tab"
                size="20"
                icon={<AiIcon />}
                aria-selected={mobileView === 'chat'}
                aria-label={t['com.affine.localmind.project-files.chat']()}
                onClick={() => setMobileView('chat')}
              />
            </div>
          ) : null}
        </header>
        <div
          className={styles.conversationAndPeek}
          data-project={!!selectedProject}
          data-fullscreen={fullscreen}
          data-view={mobileView}
        >
          {!selectedProjectId ? (
            <ProjectOverview
              projects={projects}
              loading={projectsLoading}
              error={
                projectsError ? projectErrorMessage(projectsError) : undefined
              }
              onRefresh={() => void refreshProjects()}
            />
          ) : null}
          {selectedProject ? (
            <div className={styles.resourcePane}>
              <div
                className={styles.filesPane}
                hidden={!!selectedResourceId && !resourceIsFolder}
              >
                <ProjectFiles
                  key={selectedProject.id}
                  projectId={selectedProject.id}
                  parentId={directoryId}
                  selectedResourceId={selectedResourceId}
                  onOpen={resourceId =>
                    onSelectResource(selectedProject.id, resourceId)
                  }
                />
              </div>
              {selectedResourceId && !resourceIsFolder ? (
                <ProjectResourcePreview
                  key={`${selectedProject.id}:${selectedResourceId}`}
                  projectId={selectedProject.id}
                  resourceId={selectedResourceId}
                  fullscreen={fullscreen}
                  onToggleFullscreen={() => setFullscreen(value => !value)}
                  onOfficeContextChange={setOfficeContext}
                  onClose={() =>
                    onSelectResource(selectedProject.id, directoryId)
                  }
                />
              ) : null}
            </div>
          ) : null}
          {selectedProject ? (
            <div className={styles.conversationPane} hidden={fullscreen}>
              <WorkbenchConversation
                onDocumentsChanged={refreshProjects}
                selectedProjectId={selectedProject.id}
                selectedProjectName={selectedProject.name}
                officeContext={
                  officeContext &&
                  'projectId' in officeContext &&
                  officeContext.projectId === selectedProject.id
                    ? officeContext
                    : undefined
                }
                onOpenResource={resourceId =>
                  onSelectResource(selectedProject.id, resourceId)
                }
                onConfirmBlockerSuggestion={confirmBlockerSuggestion}
              />
            </div>
          ) : null}
        </div>
        <div className={styles.taskArea}>
          <TaskPanel
            panel={taskPanel}
            loading={taskPanelLoading}
            error={
              taskPanelError ? projectErrorMessage(taskPanelError) : undefined
            }
            pendingAction={pendingTaskAction}
            onRefresh={() => void refreshTaskPanel()}
            onOpenTask={openTask}
            onViewAll={viewAllTasks}
            onAction={controlTask}
            selectedProjectId={selectedProjectId}
            onCreateBlocker={createBlocker}
          />
        </div>
      </section>
      {collaborationProject ? (
        <ProjectCollaboration
          open
          project={collaborationProject}
          pendingKey={collaborationPendingKey}
          onOpenChange={open => {
            if (!open && !collaborationPendingKey) {
              setCollaborationProjectId(null);
            }
          }}
          onInvite={inviteProjectMember}
          onPolicyChange={updateProjectAiPolicy}
          onRemoveMember={removeProjectMember}
          onTransferOwnership={transferProjectOwnership}
          onLeave={leaveProject}
        />
      ) : null}
      <ProjectShellSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </main>
  );
};
