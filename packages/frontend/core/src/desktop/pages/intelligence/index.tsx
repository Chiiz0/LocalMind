import { IconButton, notify, useConfirmModal } from '@affine/component';
import type { BlockerSuggestion } from '@affine/core/blocksuite/ai/components/ai-chat-messages';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { ProjectFileRequestModal } from '@affine/core/components/project-file-request/detail';
import { SWRConfigProvider } from '@affine/core/components/providers/swr-config-provider';
import { NotificationButton } from '@affine/core/components/root-app-sidebar/notification-button';
import UserInfo from '@affine/core/components/root-app-sidebar/user-info';
import { WorkspaceSelector } from '@affine/core/components/workspace-selector';
import { WorkspaceDialogs } from '@affine/core/desktop/dialogs';
import { getWorkspaceDocPath } from '@affine/core/desktop/route-paths';
import {
  MenuItem as SidebarMenuItem,
  QuickSearchInput,
} from '@affine/core/modules/app-sidebar/views';
import {
  DefaultServerService,
  GraphQLService,
  WorkspaceServerService,
} from '@affine/core/modules/cloud';
import { useAppLayoutReady } from '@affine/core/modules/desktop-api';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { NotificationCountService } from '@affine/core/modules/notification';
import { QuickSearchContainer } from '@affine/core/modules/quicksearch';
import { CMDKQuickSearchService } from '@affine/core/modules/quicksearch/services/cmdk';
import {
  type Workspace,
  type WorkspaceMetadata,
} from '@affine/core/modules/workspace';
import { UserFriendlyError } from '@affine/error';
import {
  confirmCopilotBlockerSuggestionMutation,
  copilotContextProjectCreateMutation,
  copilotContextProjectDocumentAddMutation,
  copilotContextProjectDocumentRemoveMutation,
  copilotContextProjectUpdateMutation,
  copilotWorkbenchProjectsGetQuery,
  copilotWorkbenchTaskPanelGetQuery,
  createCopilotBlockerMutation,
  leaveCopilotContextProjectMutation,
  removeCopilotContextProjectMemberMutation,
  sendCopilotProjectInvitationMutation,
  setCopilotContextProjectAiPolicyMutation,
  transferCopilotContextProjectOwnershipMutation,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import {
  ArrowLeftSmallIcon,
  CloseIcon,
  SettingsIcon,
  SidebarIcon,
} from '@blocksuite/icons/rc';
import {
  FrameworkScope,
  useService,
  useServiceOptional,
} from '@toeverything/infra';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useWorkbenchHost } from './host';
import * as styles from './index.css';
import {
  ProjectCollaboration,
  type ProjectCollaborationPendingKey,
} from './project-collaboration';
import { ProjectResourcePreview } from './project-resource-preview';
import { ProjectTree } from './project-tree';
import { SourceDocumentPeek } from './source-document-peek';
import { TaskPanel } from './task-panel';
import {
  EMPTY_TASK_PANEL,
  isWorkbenchDocumentOpenable,
  type WorkbenchBlockerDraft,
  type WorkbenchDocument,
  type WorkbenchPanelTaskAction,
  type WorkbenchProject,
  type WorkbenchProjectMember,
  type WorkbenchTask,
} from './types';
import { useAccessRequestConfirmation } from './use-access-request-confirmation';
import { WorkbenchConversation } from './workbench-conversation';
import { executeWorkbenchTaskAction } from './workbench-task-action';

export const Component = () => {
  useAppLayoutReady();

  const defaultServer = useService(DefaultServerService).server;
  const { hostMetadata, hostWorkspace, selectHost } = useWorkbenchHost();
  const [searchParams, setSearchParams] = useSearchParams();
  const [peekDocument, setPeekDocument] = useState<WorkbenchDocument | null>(
    null
  );
  const selectedProjectId = searchParams.get('project');
  const selectedResourceId = searchParams.get('resource');

  const selectResource = useCallback(
    (projectId: string, resourceId: string | null) => {
      setPeekDocument(null);
      setSearchParams(
        current => {
          const next = new URLSearchParams(current);
          next.set('project', projectId);
          if (resourceId) next.set('resource', resourceId);
          else next.delete('resource');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const selectProject = useCallback(
    (projectId: string | null) => {
      setSearchParams(
        current => {
          const next = new URLSearchParams(current);
          if (next.get('project') !== projectId) next.delete('resource');
          if (projectId) {
            next.set('project', projectId);
          } else {
            next.delete('project');
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const hostServer =
    hostWorkspace?.scope.get(WorkspaceServerService).server ?? defaultServer;

  return (
    <FrameworkScope scope={hostServer?.scope}>
      <FrameworkScope scope={hostWorkspace?.scope}>
        <SWRConfigProvider>
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
          {hostWorkspace ? (
            <>
              <WorkspaceDialogs />
              <QuickSearchContainer />
            </>
          ) : null}
          <IntelligenceWorkbench
            hostWorkspace={hostWorkspace ?? undefined}
            hostMetadata={hostMetadata}
            selectedProjectId={selectedProjectId}
            selectedResourceId={selectedResourceId}
            onSelectResource={selectResource}
            peekDocument={peekDocument}
            onSelectHost={selectHost}
            onSelectProject={selectProject}
            onOpenDocument={setPeekDocument}
            onCloseDocument={() => setPeekDocument(null)}
          />
        </SWRConfigProvider>
      </FrameworkScope>
    </FrameworkScope>
  );
};

type IntelligenceWorkbenchProps = {
  hostWorkspace?: Workspace;
  hostMetadata: WorkspaceMetadata | null;
  selectedProjectId: string | null;
  selectedResourceId: string | null;
  onSelectResource: (projectId: string, resourceId: string | null) => void;
  peekDocument: WorkbenchDocument | null;
  onSelectHost: (metadata: WorkspaceMetadata) => void;
  onSelectProject: (projectId: string | null) => void;
  onOpenDocument: (document: WorkbenchDocument) => void;
  onCloseDocument: () => void;
};

const IntelligenceWorkbench = ({
  hostWorkspace,
  hostMetadata,
  selectedProjectId,
  selectedResourceId,
  onSelectResource,
  peekDocument,
  onSelectHost,
  onSelectProject,
  onOpenDocument,
  onCloseDocument,
}: IntelligenceWorkbenchProps) => {
  const t = useI18n();
  const navigate = useNavigate();
  const graphqlService = useService(GraphQLService);
  const notificationCount = useService(NotificationCountService);
  const workspaceDialogService = useServiceOptional(WorkspaceDialogService);
  const quickSearchService = useServiceOptional(CMDKQuickSearchService);
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
      refreshInterval: 5000,
      shouldRetryOnError: false,
    }
  );
  const projects = projectsData?.currentUser?.copilot.contextProjects ?? [];
  const selectedProject =
    projects.find(project => project.id === selectedProjectId) ?? null;
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
      refreshInterval: 5000,
      shouldRetryOnError: false,
    }
  );
  const taskPanel =
    taskPanelData?.currentUser?.copilot.workbenchTaskPanel ?? EMPTY_TASK_PANEL;

  useEffect(() => {
    const subscription = notificationCount.revision$.subscribe(revision => {
      if (!revision) return;
      Promise.all([refreshProjects(), refreshTaskPanel()]).catch(console.error);
    });
    return () => subscription.unsubscribe();
  }, [notificationCount, refreshProjects, refreshTaskPanel]);

  useEffect(() => {
    if (
      !projectsLoading &&
      !projectsError &&
      projectsData?.currentUser &&
      selectedProjectId &&
      !selectedProject
    ) {
      onSelectProject(null);
    }
  }, [
    onSelectProject,
    projectsData,
    projectsError,
    projectsLoading,
    selectedProject,
    selectedProjectId,
  ]);

  useEffect(() => {
    if (!peekDocument || projectsLoading || projectsError) {
      return;
    }
    const stillGranted = selectedProject?.documents.some(
      document =>
        document.status === 'granted' &&
        document.workspaceId === peekDocument.workspaceId &&
        document.docId === peekDocument.docId
    );
    if (!stillGranted) {
      onCloseDocument();
    }
  }, [
    onCloseDocument,
    peekDocument,
    projectsError,
    projectsLoading,
    selectedProject,
  ]);

  const reportMutationError = useCallback((caught: unknown, title: string) => {
    notify.error({
      title,
      message: UserFriendlyError.fromAny(caught).message,
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

  const addDocuments = useCallback(
    (project: WorkbenchProject, requestedLevel: 'read' | 'write') => {
      if (!hostWorkspace || !workspaceDialogService) return;
      const existingIds = new Set(
        project.documents
          .filter(document => document.workspaceId === hostWorkspace.id)
          .flatMap(document => (document.docId ? [document.docId] : []))
      );
      const nextSortOrder =
        Math.max(-1, ...project.documents.map(document => document.sortOrder)) +
        1;
      workspaceDialogService.open('doc-selector', { init: [] }, selectedIds => {
        if (!selectedIds?.length) return;
        void (async () => {
          setPendingMutationKey(`project:${project.id}:add-documents`);
          try {
            const candidates = [...new Set(selectedIds)].filter(
              docId => !existingIds.has(docId)
            );
            if (!candidates.length) return;
            const results = await Promise.allSettled(
              candidates.map((docId, index) =>
                graphqlService.gql({
                  query: copilotContextProjectDocumentAddMutation,
                  variables: {
                    input: {
                      projectId: project.id,
                      workspaceId: hostWorkspace.id,
                      docId,
                      requestedLevel,
                      requestedTitle:
                        hostWorkspace.docCollection.meta.getDocMeta(docId)
                          ?.title ?? undefined,
                      sortOrder: nextSortOrder + index,
                    },
                  },
                })
              )
            );
            const fulfilled = results.flatMap(result =>
              result.status === 'fulfilled' ? [result.value] : []
            );
            const grantedCount = fulfilled.filter(
              result =>
                result.addCopilotContextProjectDocument.outcome === 'granted'
            ).length;
            const requestedCount = fulfilled.length - grantedCount;
            if (fulfilled.length) {
              await Promise.all([refreshProjects(), refreshTaskPanel()]);
              notify.success({
                title: t['com.affine.localmind.workbench.document.addResult']({
                  granted: String(grantedCount),
                  requested: String(requestedCount),
                }),
              });
            }
            const rejected = results.find(
              (result): result is PromiseRejectedResult =>
                result.status === 'rejected'
            );
            if (rejected) {
              reportMutationError(
                rejected.reason,
                t['com.affine.localmind.workbench.document.addFailed']()
              );
            }
          } finally {
            setPendingMutationKey(null);
          }
        })().catch(console.error);
      });
    },
    [
      graphqlService,
      hostWorkspace,
      refreshProjects,
      refreshTaskPanel,
      reportMutationError,
      t,
      workspaceDialogService,
    ]
  );

  const removeDocument = useCallback(
    (project: WorkbenchProject, document: WorkbenchDocument) => {
      if (!document.docId) return;
      const docId = document.docId;
      openConfirmModal({
        title: t['com.affine.localmind.workbench.document.removeConfirm'](),
        description:
          t['com.affine.localmind.workbench.document.removeDescription'](),
        confirmText: t['com.affine.localmind.workbench.document.remove'](),
        cancelText: t['Cancel'](),
        confirmButtonOptions: { variant: 'error' },
        onConfirm: async () => {
          setPendingMutationKey(`project:${project.id}:remove:${docId}`);
          try {
            await graphqlService.gql({
              query: copilotContextProjectDocumentRemoveMutation,
              variables: {
                input: {
                  projectId: project.id,
                  workspaceId: document.workspaceId,
                  docId,
                },
              },
            });
            if (
              peekDocument?.workspaceId === document.workspaceId &&
              peekDocument.docId === docId
            ) {
              onCloseDocument();
            }
            await Promise.all([refreshProjects(), refreshTaskPanel()]);
            notify.success({
              title: t['com.affine.localmind.workbench.document.removed'](),
            });
          } catch (caught) {
            reportMutationError(
              caught,
              t['com.affine.localmind.workbench.document.removeFailed']()
            );
          } finally {
            setPendingMutationKey(null);
          }
        },
      });
    },
    [
      graphqlService,
      onCloseDocument,
      openConfirmModal,
      peekDocument,
      refreshProjects,
      refreshTaskPanel,
      reportMutationError,
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
  const controlTask = useCallback(
    async (task: WorkbenchTask, action: WorkbenchPanelTaskAction) => {
      if (pendingTaskAction || !task.availableActions.includes(action)) return;
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
        reportMutationError(
          error,
          t['com.affine.localmind.workbench.blocker.createFailed']()
        );
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

  const openProjectDocument = useCallback(
    (projectId: string, document: WorkbenchDocument) => {
      if (!isWorkbenchDocumentOpenable(document)) return;
      onSelectProject(projectId);
      onOpenDocument(document);
    },
    [onOpenDocument, onSelectProject]
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
            {hostMetadata ? (
              <div className={styles.workspaceSelector}>
                <WorkspaceSelector
                  workspaceMetadata={hostMetadata}
                  onSelectWorkspace={metadata => {
                    onSelectHost(metadata);
                    setMobileNavigationOpen(false);
                  }}
                  showEnableCloudButton
                  showArrowDownIcon
                  showSyncStatus
                  dense
                />
              </div>
            ) : (
              <strong>LocalMind</strong>
            )}
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
          <QuickSearchInput
            className={styles.quickSearch}
            onClick={() => quickSearchService?.toggle()}
          />
          <div className={styles.railUtilities}>
            {hostWorkspace ? (
              <SidebarMenuItem
                icon={<ArrowLeftSmallIcon />}
                onClick={() =>
                  navigate(getWorkspaceDocPath(hostWorkspace.id, 'all'))
                }
              >
                {t['com.affine.localmind.workbench.returnToWorkspace']()}
              </SidebarMenuItem>
            ) : null}
            <NotificationButton />
            {workspaceDialogService ? (
              <SidebarMenuItem
                icon={<SettingsIcon />}
                onClick={() =>
                  workspaceDialogService.open('setting', {
                    activeTab: 'appearance',
                  })
                }
              >
                {t['com.affine.settingSidebar.title']()}
              </SidebarMenuItem>
            ) : null}
          </div>
        </div>

        <ProjectTree
          workspace={hostWorkspace}
          projects={projects}
          selectedProjectId={selectedProjectId}
          selectedResourceId={selectedResourceId}
          onSelectResource={(projectId, resourceId) => {
            onSelectResource(projectId, resourceId);
            setMobileNavigationOpen(false);
          }}
          loading={projectsLoading}
          error={projectsError?.message}
          mutationsPending={pendingMutationKey !== null}
          canAddDocuments={!!hostWorkspace}
          onRefresh={() => void refreshProjects()}
          onSelectProject={projectId => {
            onSelectProject(projectId);
            setMobileNavigationOpen(false);
          }}
          onSelectDocument={(projectId, document) => {
            openProjectDocument(projectId, document);
            setMobileNavigationOpen(false);
          }}
          onCreate={createProject}
          onRename={renameProject}
          onArchive={archiveProject}
          onAddDocuments={addDocuments}
          onRemoveDocument={removeDocument}
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
        <TaskPanel
          panel={taskPanel}
          loading={taskPanelLoading}
          error={taskPanelError?.message}
          pendingAction={pendingTaskAction}
          navigationToggle={{
            expanded: mobileNavigationOpen,
            controls: 'intelligence-project-navigation',
            icon: <SidebarIcon />,
            label: t['com.affine.sidebarSwitch.expand'](),
            onClick: () => setMobileNavigationOpen(true),
          }}
          onRefresh={() => void refreshTaskPanel()}
          onOpenTask={openTask}
          onViewAll={viewAllTasks}
          onAction={controlTask}
          selectedProjectId={selectedProjectId}
          onCreateBlocker={createBlocker}
        />
        <div
          className={styles.conversationAndPeek}
          data-peek={!!peekDocument || !!selectedResourceId}
          data-resource-open={!!selectedResourceId}
        >
          {selectedProject ? (
            <div
              className={styles.conversationPane}
              hidden={!!selectedResourceId}
            >
              <WorkbenchConversation
                onDocumentsChanged={refreshProjects}
                selectedProjectId={selectedProject.id}
                selectedProjectName={selectedProject.name}
                onOpenResource={resourceId =>
                  onSelectResource(selectedProject.id, resourceId)
                }
                onConfirmBlockerSuggestion={confirmBlockerSuggestion}
              />
            </div>
          ) : null}
          {peekDocument && isWorkbenchDocumentOpenable(peekDocument) ? (
            <aside className={styles.peekPane}>
              <SourceDocumentPeek
                workspaceId={peekDocument.workspaceId}
                docId={peekDocument.docId}
                requestedLevel={peekDocument.requestedLevel}
                title={peekDocument.title ?? undefined}
                onClose={onCloseDocument}
              />
            </aside>
          ) : null}
          {selectedProject && selectedResourceId ? (
            <aside className={styles.peekPane}>
              <ProjectResourcePreview
                key={`${selectedProject.id}:${selectedResourceId}`}
                projectId={selectedProject.id}
                resourceId={selectedResourceId}
                onOpenResource={resourceId =>
                  onSelectResource(selectedProject.id, resourceId)
                }
                onClose={() => onSelectResource(selectedProject.id, null)}
              />
            </aside>
          ) : null}
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
    </main>
  );
};
