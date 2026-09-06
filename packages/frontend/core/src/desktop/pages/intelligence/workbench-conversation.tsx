import { IconButton, useConfirmModal } from '@affine/component';
import {
  AIChatRuntime,
  createAIRequestService,
  useAIChatElement,
  useAIChatRuntime,
  WorkspaceAIChatSessionStrategy,
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
import { DocumentCreationPanel } from '@affine/core/components/ai-document-creation/document-creation-panel';
import { useAIChatConfig } from '@affine/core/components/hooks/affine/use-ai-chat-config';
import { useAISpecs } from '@affine/core/components/hooks/affine/use-ai-specs';
import { useAISubscribe } from '@affine/core/components/hooks/affine/use-ai-subscribe';
import {
  AIDraftService,
  AIToolsConfigService,
} from '@affine/core/modules/ai-button';
import { AIModelService } from '@affine/core/modules/ai-button/services/models';
import {
  EventSourceService,
  GraphQLService,
  ServerService,
  SubscriptionService,
} from '@affine/core/modules/cloud';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { FeatureFlagService } from '@affine/core/modules/feature-flag';
import { PeekViewService } from '@affine/core/modules/peek-view';
import { NbstoreService } from '@affine/core/modules/storage';
import { AppThemeService } from '@affine/core/modules/theme';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { RefNodeSlotsProvider } from '@blocksuite/affine/inlines/reference';
import { BlockStdScope } from '@blocksuite/affine/std';
import type { Workspace as BlockSuiteWorkspace } from '@blocksuite/affine/store';
import { SettingsIcon } from '@blocksuite/icons/rc';
import { useFramework, useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { WorkbenchDocument } from './types';
import * as styles from './workbench-conversation.css';

type WorkbenchConversationProps = {
  onDocumentsChanged?: () => Promise<unknown>;
  selectedProjectId: string | null;
  selectedProjectName?: string;
  projectDocuments: WorkbenchDocument[];
  onOpenDocument: (document: WorkbenchDocument) => void;
  onConfirmBlockerSuggestion?: (suggestion: BlockerSuggestion) => Promise<void>;
};

const createMockStd = (workspace: BlockSuiteWorkspace) => {
  workspace.meta.initialize();
  const store = workspace.docs.values().next().value?.getStore();
  if (!store) return null;
  const std = new BlockStdScope({
    store,
    extensions: [...getViewManager().config.init().value.get('page')],
  });
  std.render();
  return std;
};

const useAIRequestService = () => {
  const graphqlService = useService(GraphQLService);
  const eventSourceService = useService(EventSourceService);
  const nbstoreService = useService(NbstoreService);

  return useMemo(
    () =>
      createAIRequestService(
        graphqlService.gql,
        eventSourceService.eventSource,
        nbstoreService.realtime
      ),
    [eventSourceService, graphqlService, nbstoreService]
  );
};

export const WorkbenchConversation = ({
  onDocumentsChanged,
  selectedProjectId,
  selectedProjectName,
  projectDocuments,
  onOpenDocument,
  onConfirmBlockerSuggestion,
}: WorkbenchConversationProps) => {
  const t = useI18n();
  const framework = useFramework();
  const workspace = useService(WorkspaceService).workspace;
  const workspaceId = workspace.id;
  const requestService = useAIRequestService();
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
        scope: { kind: 'workspace', workspaceId },
        strategy: new WorkspaceAIChatSessionStrategy(),
        chatSurface: 'intelligence_workbench',
        projectId: selectedProjectId,
      }),
    [requestService, workspaceId, selectedProjectId]
  );
  const snapshot = useAIChatRuntime(runtime);
  const previousStatus = useRef(snapshot?.status);
  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = snapshot?.status;
    if (
      previous === 'transmitting' &&
      (snapshot?.status === 'success' || snapshot?.status === 'error')
    ) {
      onDocumentsChanged?.().catch(console.error);
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
      .catch(console.error);
  }, [
    runtime,
    selectedProjectId,
    selectedProjectName,
    snapshot?.activeSessionId,
  ]);

  const mockStd = useMemo(
    () => createMockStd(workspace.docCollection),
    [workspace]
  );
  const { docDisplayConfig, searchMenuConfig, reasoningConfig } =
    useAIChatConfig();
  const specs = useAISpecs();
  const handleAISubscribe = useAISubscribe();
  const workspaceDialogService = useService(WorkspaceDialogService);
  const confirmModal = useConfirmModal();
  const notificationService = useMemo(
    () =>
      new NotificationServiceImpl(
        confirmModal.closeConfirmModal,
        confirmModal.openConfirmModal
      ),
    [confirmModal.closeConfirmModal, confirmModal.openConfirmModal]
  );

  const resolveDocument = useCallback(
    (docId: string, preferredWorkspaceId = workspaceId): WorkbenchDocument =>
      projectDocuments.find(
        document =>
          document.docId === docId &&
          document.workspaceId === preferredWorkspaceId
      ) ??
      projectDocuments.find(document => document.docId === docId) ?? {
        workspaceId: preferredWorkspaceId,
        docId,
        title: null,
        groupId: null,
        sortOrder: 0,
        status: 'granted',
        requestedLevel: 'read',
        accessRequestId: null,
        addedByMe: false,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
    [projectDocuments, workspaceId]
  );

  const openSessionDocument = useCallback(
    (docId: string, sessionId: string) => {
      const session = snapshot?.sessions.find(
        candidate => candidate.sessionId === sessionId
      );
      onOpenDocument(
        resolveDocument(docId, session?.workspaceId ?? workspaceId)
      );
    },
    [onOpenDocument, resolveDocument, snapshot?.sessions, workspaceId]
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
      content.workspaceId = workspaceId;
      content.extensions = specs;
      content.host = mockStd?.host;
      content.docDisplayConfig = docDisplayConfig;
      content.searchMenuConfig = searchMenuConfig;
      content.reasoningConfig = reasoningConfig;
      content.affineFeatureFlagService = framework.get(FeatureFlagService);
      content.affineWorkspaceDialogService = framework.get(
        WorkspaceDialogService
      );
      content.peekViewService = framework.get(PeekViewService);
      content.affineThemeService = framework.get(AppThemeService);
      content.notificationService = notificationService;
      content.aiDraftService = framework.get(AIDraftService);
      content.aiToolsConfigService = framework.get(AIToolsConfigService);
      content.serverService = framework.get(ServerService);
      content.subscriptionService = framework.get(SubscriptionService);
      content.aiModelService = framework.get(AIModelService);
      content.onAISubscribe = handleAISubscribe;
      content.onOpenDoc = docId => onOpenDocument(resolveDocument(docId));
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
        onOpenDoc: openSessionDocument,
        onSessionDelete: session => {
          deleteSession(session).catch(console.error);
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

  useEffect(() => {
    const slots = mockStd?.getOptional(RefNodeSlotsProvider);
    if (!slots) return;
    const subscription = slots.docLinkClicked.subscribe(event => {
      onOpenDocument(resolveDocument(event.pageId));
    });
    return () => subscription.unsubscribe();
  }, [mockStd, onOpenDocument, resolveDocument]);

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
          <IconButton
            size="20"
            tooltip={t['com.affine.localmind.workbench.aiSettings']()}
            aria-label={t['com.affine.localmind.workbench.aiSettings']()}
            icon={<SettingsIcon />}
            onClick={() =>
              workspaceDialogService.open('setting', {
                activeTab: 'workspace:ai-context',
              })
            }
          />
        </div>
      </header>
      <DocumentCreationPanel
        key={snapshot?.activeSessionId ?? 'draft'}
        sessionId={snapshot?.activeSessionId}
        onChanged={onDocumentsChanged}
      />
      <div className={styles.content} ref={setContentContainer} />
    </section>
  );
};
