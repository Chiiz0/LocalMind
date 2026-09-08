import { Button, useConfirmModal } from '@affine/component';
import {
  AIChatRuntime,
  createAIRequestService,
  ProjectAIChatSessionStrategy,
  useAIChatElement,
  useAIChatRuntime,
} from '@affine/core/blocksuite/ai';
import { AIChatContent } from '@affine/core/blocksuite/ai/components/ai-chat-content';
import type {
  BlockerSuggestion,
  BlockerSuggestionConfirmation,
} from '@affine/core/blocksuite/ai/components/ai-chat-messages';
import {
  AIChatTabs,
  AIChatToolbar,
  configureAIChatToolbar,
} from '@affine/core/blocksuite/ai/components/ai-chat-toolbar';
import { getViewManager } from '@affine/core/blocksuite/manager/view';
import { NotificationServiceImpl } from '@affine/core/blocksuite/view-extensions/editor-view/notification-service';
import { AIToolsConfigService } from '@affine/core/modules/ai-button';
import { ProjectAIModel } from '@affine/core/modules/ai-button/entities/project-model';
import {
  EventSourceService,
  GraphQLService,
  ServerService,
  SubscriptionService,
  UserFeatureService,
} from '@affine/core/modules/cloud';
import { useSignalValue } from '@affine/core/modules/doc-info/utils';
import { FeatureFlagService } from '@affine/core/modules/feature-flag';
import { reportProjectError as report } from '@affine/core/modules/project-resources/error';
import { useProjectRefresh } from '@affine/core/modules/project-resources/realtime';
import { AppThemeService } from '@affine/core/modules/theme';
import type { ProjectAgentTaskFieldsFragment } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import type { OfficeAiContext } from '@localmind/office';
import { useFramework, useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useProjectChatConfig } from './project-chat-config';
import { ProjectFilePicker } from './project-file-picker';
import { ProjectTasks } from './project-tasks';
import * as styles from './workbench-conversation.css';

type WorkbenchConversationProps = {
  onDocumentsChanged?: () => Promise<unknown>;
  selectedProjectId: string;
  selectedProjectName?: string;
  onOpenResource: (resourceId: string) => void;
  onConfirmBlockerSuggestion?: (suggestion: BlockerSuggestion) => Promise<void>;
  officeContext?: OfficeAiContext;
  onTaskCompleted?: (task: ProjectAgentTaskFieldsFragment) => Promise<unknown>;
};

const useAIRequestService = () => {
  const graphqlService = useService(GraphQLService);
  const eventSourceService = useService(EventSourceService);

  return useMemo(
    () =>
      createAIRequestService(
        graphqlService.gql,
        eventSourceService.eventSource
      ),
    [eventSourceService, graphqlService]
  );
};

export const WorkbenchConversation = ({
  onDocumentsChanged,
  selectedProjectId,
  selectedProjectName,
  onOpenResource,
  onConfirmBlockerSuggestion,
  officeContext,
  onTaskCompleted,
}: WorkbenchConversationProps) => {
  const t = useI18n();
  const framework = useFramework();
  const requestService = useAIRequestService();
  const projectModel = useMemo(
    () =>
      framework.createEntity(ProjectAIModel, { projectId: selectedProjectId }),
    [framework, selectedProjectId]
  );
  useEffect(() => () => projectModel.dispose(), [projectModel]);
  useProjectRefresh(selectedProjectId, 'list', projectModel.refresh);
  const configuration = useSignalValue(projectModel.configuration);
  const isAdmin = useLiveData(
    useService(UserFeatureService).userFeature.isAdmin$
  );
  const [bodyReady, setBodyReady] = useState(false);
  const [toolbarReady, setToolbarReady] = useState(false);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const toolbarContainerRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const blockerSuggestionConfirmation = useMemo<
    BlockerSuggestionConfirmation | undefined
  >(
    () =>
      onConfirmBlockerSuggestion
        ? {
            onConfirm: onConfirmBlockerSuggestion,
            labels: {
              title: t['com.affine.localmind.workbench.blocker.suggestion'](),
              type: t['com.affine.localmind.workbench.blocker.type'](),
              waitingOn:
                t['com.affine.localmind.workbench.blocker.waitingOnLabel'](),
              dueAt: t['com.affine.localmind.workbench.blocker.dueAt'](),
              create:
                t['com.affine.localmind.workbench.blocker.suggestionCreate'](),
              creating:
                t[
                  'com.affine.localmind.workbench.blocker.suggestionCreating'
                ](),
              created:
                t['com.affine.localmind.workbench.blocker.suggestionCreated'](),
              failed:
                t['com.affine.localmind.workbench.blocker.suggestionFailed'](),
              typeNames: {
                wait_reply:
                  t['com.affine.localmind.workbench.blocker.type.reply'](),
                wait_file:
                  t['com.affine.localmind.workbench.blocker.type.file'](),
                wait_decision:
                  t['com.affine.localmind.workbench.blocker.type.decision'](),
                custom:
                  t['com.affine.localmind.workbench.blocker.type.custom'](),
              },
            },
          }
        : undefined,
    [onConfirmBlockerSuggestion, t]
  );

  const runtime = useMemo(
    () =>
      new AIChatRuntime({
        request: requestService,
        scope: { kind: 'project', projectId: selectedProjectId },
        strategy: new ProjectAIChatSessionStrategy(),
        chatSurface: 'intelligence_workbench',
        projectId: selectedProjectId,
      }),
    [requestService, selectedProjectId]
  );
  const snapshot = useAIChatRuntime(runtime);
  const previousStatus = useRef(snapshot?.status);
  const handleTaskCompleted = useCallback(
    async (task: ProjectAgentTaskFieldsFragment) => {
      if (onTaskCompleted) await onTaskCompleted(task);
      else await onDocumentsChanged?.();
    },
    [onDocumentsChanged, onTaskCompleted]
  );
  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = snapshot?.status;
    if (
      previous === 'transmitting' &&
      (snapshot?.status === 'success' || snapshot?.status === 'error')
    ) {
      onDocumentsChanged?.().catch(report);
    }
  }, [onDocumentsChanged, snapshot?.status]);
  const activeSession =
    snapshot?.sessions.find(
      session => session.sessionId === snapshot.activeSessionId
    ) ?? null;

  useEffect(() => () => runtime.dispose(), [runtime]);

  useEffect(() => {
    runtime
      .dispatch({
        type: 'setSelectedContextProject',
        projectId: selectedProjectId,
        projectName: selectedProjectName,
      })
      .catch(report);
  }, [
    runtime,
    selectedProjectId,
    selectedProjectName,
    snapshot?.activeSessionId,
  ]);

  const [documentPicker, setDocumentPicker] = useState<{
    tabId: string | null;
    resourceIds: string[];
    limit: number;
  } | null>(null);
  const openDocuments = useCallback(() => {
    const current = runtime.getSnapshot();
    if (current.composer.context.loading) return;
    const items = current.composer.context.items;
    setDocumentPicker({
      tabId: current.activeTabId,
      resourceIds: items.flatMap(item =>
        item.kind === 'doc' ? [item.docId] : []
      ),
      limit: Math.max(0, 16 - items.filter(item => item.kind !== 'doc').length),
    });
  }, [runtime]);
  useEffect(() => {
    setDocumentPicker(null);
  }, [snapshot?.activeTabId, selectedProjectId]);
  const { docDisplayConfig, searchMenuConfig, reasoningConfig } =
    useProjectChatConfig(selectedProjectId, openDocuments);
  const specs = useMemo(
    () => getViewManager().config.init().value.get('page'),
    []
  );
  const confirmModal = useConfirmModal();
  const notificationService = useMemo(
    () =>
      new NotificationServiceImpl(
        confirmModal.closeConfirmModal,
        confirmModal.openConfirmModal
      ),
    [confirmModal.closeConfirmModal, confirmModal.openConfirmModal]
  );

  const deleteSession = useCallback(
    async (session: BlockSuitePresets.AIRecentSession) => {
      const confirmed = await notificationService.confirm({
        title: t['com.affine.ai.chat-panel.session.delete.confirm.title'](),
        message: t['com.affine.ai.chat-panel.session.delete.confirm.message'](),
        confirmText: t['Delete'](),
        cancelText: t['Cancel'](),
      });
      if (!confirmed) return;
      await runtime.dispatch({
        type: 'deleteSession',
        sessionId: session.sessionId,
      });
      notificationService.toast(
        t['com.affine.ai.chat-panel.session.delete.toast.success'](),
        {}
      );
    },
    [notificationService, runtime, t]
  );

  useAIChatElement({
    containerRef: contentContainerRef,
    selector: 'ai-chat-content',
    enabled: bodyReady,
    createElement: () => new AIChatContent(),
    configureElement: content => {
      content.session = activeSession;
      content.runtime = runtime;
      content.runtimeSnapshot = snapshot;
      content.workspaceId = undefined;
      content.officeContext = officeContext;
      content.extensions = specs;
      content.docDisplayConfig = docDisplayConfig;
      content.searchMenuConfig = searchMenuConfig;
      content.reasoningConfig = reasoningConfig;
      content.affineFeatureFlagService = framework.get(FeatureFlagService);
      content.affineThemeService = framework.get(AppThemeService);
      content.notificationService = notificationService;
      content.aiToolsConfigService = framework.get(AIToolsConfigService);
      content.serverService = framework.get(ServerService);
      content.subscriptionService = framework.get(SubscriptionService);
      content.aiModelService = projectModel;
      content.onOpenDoc = onOpenResource;
      content.blockerSuggestionConfirmation = blockerSuggestionConfirmation;
    },
    onElementReady: content => {
      content.independentMode = true;
      content.onboardingOffsetY = -80;
    },
  });

  useAIChatElement({
    containerRef: toolbarContainerRef,
    selector: 'ai-chat-toolbar',
    enabled: toolbarReady,
    createElement: () => new AIChatToolbar(),
    configureElement: toolbar => {
      configureAIChatToolbar(toolbar, {
        session: activeSession,
        runtime,
        runtimeSnapshot: snapshot ?? runtime.getSnapshot(),
        docDisplayConfig,
        notificationService,
        onOpenDoc: onOpenResource,
        onSessionDelete: session => {
          deleteSession(session).catch(report);
        },
      });
    },
  });

  useAIChatElement({
    containerRef: tabsContainerRef,
    selector: 'ai-chat-tabs',
    enabled: true,
    createElement: () => new AIChatTabs(),
    configureElement: tabs => {
      tabs.runtime = runtime;
      tabs.runtimeSnapshot = snapshot;
    },
  });

  const setContentContainer = useCallback((node: HTMLDivElement | null) => {
    contentContainerRef.current = node;
    setBodyReady(!!node);
  }, []);
  const setToolbarContainer = useCallback((node: HTMLDivElement | null) => {
    toolbarContainerRef.current = node;
    setToolbarReady(!!node);
  }, []);

  return (
    <section
      className={styles.root}
      aria-label={t['com.affine.localmind.workbench.conversation']()}
      data-testid="workbench-conversation"
    >
      <header className={styles.header}>
        <div className={styles.tabs} ref={tabsContainerRef} />
        <div className={styles.tools}>
          <div ref={setToolbarContainer} />
        </div>
      </header>
      {configuration === 'missing' || configuration === 'error' ? (
        <div role="status" className={styles.configuration}>
          <span>
            {t[
              configuration === 'missing'
                ? 'com.affine.localmind.project-byok.missing'
                : 'com.affine.localmind.project-byok.error'
            ]()}
          </span>
          {configuration === 'error' ? (
            <Button onClick={projectModel.refresh}>{t['Retry']()}</Button>
          ) : isAdmin ? (
            <a href="/admin/ai/config">
              {t['com.affine.localmind.project-byok.configure']()}
            </a>
          ) : (
            <span>{t['com.affine.localmind.project-byok.contactAdmin']()}</span>
          )}
        </div>
      ) : null}
      <ProjectTasks
        key={`${selectedProjectId}:${snapshot?.activeSessionId ?? ''}`}
        projectId={selectedProjectId}
        sessionId={snapshot?.activeSessionId ?? undefined}
        onCompleted={handleTaskCompleted}
        onOpenResource={onOpenResource}
      />
      <div className={styles.content} ref={setContentContainer} />
      {documentPicker ? (
        <ProjectFilePicker
          projectId={selectedProjectId}
          initialSelection={documentPicker.resourceIds}
          limit={documentPicker.limit}
          onClose={() => setDocumentPicker(null)}
          onSave={resourceIds =>
            runtime.dispatch({
              type: 'setProjectContextResources',
              tabId: documentPicker.tabId,
              baseResourceIds: documentPicker.resourceIds,
              resourceIds,
            })
          }
        />
      ) : null}
    </section>
  );
};
