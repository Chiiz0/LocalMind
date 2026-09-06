import {
  Button,
  IconButton,
  Loading,
  notify,
  useConfirmModal,
} from '@affine/component';
import {
  AIChatRuntime,
  createAIRequestService,
  useAIChatElement,
  useAIChatRuntime,
  WorkspaceAIChatSessionStrategy,
} from '@affine/core/blocksuite/ai';
import { AIChatContent } from '@affine/core/blocksuite/ai/components/ai-chat-content';
import {
  AIChatTabs,
  AIChatToolbar,
  configureAIChatToolbar,
} from '@affine/core/blocksuite/ai/components/ai-chat-toolbar';
import { registerAIAppEffects } from '@affine/core/blocksuite/ai/effects/app';
import { NotificationServiceImpl } from '@affine/core/blocksuite/view-extensions/editor-view/notification-service';
import { DocumentCreationPanel } from '@affine/core/components/ai-document-creation/document-creation-panel';
import { useAIChatConfig } from '@affine/core/components/hooks/affine/use-ai-chat-config';
import { useAISpecs } from '@affine/core/components/hooks/affine/use-ai-specs';
import { useAISubscribe } from '@affine/core/components/hooks/affine/use-ai-subscribe';
import { useQuery } from '@affine/core/components/hooks/use-query';
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
import { WorkbenchService } from '@affine/core/modules/workbench';
import { UserFriendlyError } from '@affine/error';
import {
  controlCopilotTaskMutation,
  copilotTasksGetQuery,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { AiIcon, CloseIcon, PageIcon, ResetIcon } from '@blocksuite/icons/rc';
import type { OfficeAiContext, OfficeSelection } from '@localmind/office';
import { parseOfficeAiContext } from '@localmind/office';
import { useFramework, useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildCopilotTaskControlInput,
  type CopilotTask,
  type CopilotTaskAction,
  isCopilotTaskActionDisabled,
} from '../../../../modules/copilot-tasks/utils';
import * as styles from './chat.css';
import type { OfficeArtifact, OfficeRevision } from './shared';

registerAIAppEffects();

export type OfficeTaskRevisionEvidence = {
  taskId: string;
  artifactId: string;
  revisionId: string;
  sequence: number | null;
};

type OfficeChatPanelProps = {
  workspaceId: string;
  artifact: Pick<OfficeArtifact, 'id' | 'kind' | 'sourceFileName' | 'title'>;
  revision: Pick<OfficeRevision, 'id' | 'sequence'>;
  selection: OfficeSelection | null;
  selectionNotice: string | null;
  autoRefreshEnabled: boolean;
  onClearSelection: () => void;
  onTaskRevision: (evidence: OfficeTaskRevisionEvidence) => Promise<void>;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function titleCase(value: string) {
  return value
    .replace(/^office\./, '')
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
}

export function officeSelectionLabel(selection: OfficeSelection) {
  switch (selection.kind) {
    case 'document': {
      const target = selection.target;
      if (target.type === 'text_range') {
        return target.start.blockId === target.end.blockId
          ? `Text ${target.start.blockId} (${target.start.offset}-${target.end.offset})`
          : `Text ${target.start.blockId} to ${target.end.blockId}`;
      }
      if (target.type === 'section')
        return `Section ${target.sectionIndex + 1}`;
      if (target.type === 'run') {
        return `Run ${target.runIndex + 1} in ${target.blockId}`;
      }
      return `Paragraph ${target.blockId}`;
    }
    case 'workbook': {
      const target = selection.target;
      if (target.type === 'cell') return `${target.sheetId} ${target.address}`;
      if (target.type === 'cell_range')
        return `${target.sheetId} ${target.range}`;
      if (target.type === 'table') return `Table ${target.tableId}`;
      if (target.type === 'chart') return `Chart ${target.chartId}`;
      return `Sheet ${target.sheetId}`;
    }
    case 'presentation': {
      const target = selection.target;
      if (target.type === 'shape' || target.type === 'placeholder') {
        return `${target.slideId} / ${target.shapeId}`;
      }
      if (target.type === 'notes') return `Notes for ${target.slideId}`;
      return `Slide ${target.slideId}`;
    }
    case 'pdf': {
      const target = selection.target;
      if (target.type === 'form_field') return `Form field ${target.fieldName}`;
      if (target.type === 'annotation') {
        return `Page ${target.pageIndex + 1} / ${target.annotationId}`;
      }
      if (target.type === 'page_region') {
        return `Region on page ${target.pageIndex + 1}`;
      }
      return `Page ${target.pageIndex + 1}`;
    }
  }
}

export function officeSelectionForArtifact(
  selection: OfficeSelection | null,
  artifactKind: OfficeArtifact['kind']
) {
  return selection?.kind === artifactKind ? selection : null;
}

function taskOfficeArtifact(task: CopilotTask, artifactId: string) {
  return task.artifacts.some(
    artifact => artifact.kind === 'office' && artifact.id === artifactId
  );
}

export function officeTaskVisualStatus(task: CopilotTask) {
  if (task.approval?.status === 'rejected') return 'rejected';
  if (task.status === 'waiting_approval') return 'waiting';
  if (
    task.status === 'failed' &&
    /conflict|stale|preview evidence changed|revision changed/i.test(
      `${task.failureCode ?? ''} ${task.failureMessage ?? ''}`
    )
  ) {
    return 'conflict';
  }
  return task.status;
}

export function officeTaskRevisionEvidence(
  task: CopilotTask
): OfficeTaskRevisionEvidence | null {
  if (task.status !== 'completed') return null;
  const evidence = record(task.resultEvidence);
  if (
    evidence?.sideEffectKind !== 'office_revision' ||
    typeof evidence.artifactId !== 'string' ||
    typeof evidence.revisionId !== 'string'
  ) {
    return null;
  }
  return {
    taskId: task.id,
    artifactId: evidence.artifactId,
    revisionId: evidence.revisionId,
    sequence:
      typeof evidence.sequence === 'number' &&
      Number.isSafeInteger(evidence.sequence)
        ? evidence.sequence
        : null,
  };
}

export function shouldRefreshOfficeTaskRevision(
  evidence: OfficeTaskRevisionEvidence,
  artifactId: string,
  currentRevision: Pick<OfficeRevision, 'id' | 'sequence'>
) {
  if (evidence.artifactId !== artifactId) return false;
  if (evidence.revisionId === currentRevision.id) return false;
  return (
    evidence.sequence === null || evidence.sequence > currentRevision.sequence
  );
}

function approvalDetails(task: CopilotTask) {
  const approval = record(task.approvalSummary);
  const preview = record(approval?.previewSummary);
  const stats = record(preview?.stats);
  const impact = Object.entries(stats ?? {})
    .filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' && Number.isFinite(entry[1])
    )
    .slice(0, 4)
    .map(([key, value]) => `${titleCase(key)}: ${value}`);
  return {
    operation:
      typeof approval?.operation === 'string'
        ? titleCase(approval.operation)
        : null,
    reason: typeof approval?.reason === 'string' ? approval.reason : null,
    revisionSequence:
      typeof approval?.revisionSequence === 'number'
        ? approval.revisionSequence
        : null,
    commandCount:
      typeof approval?.commandCount === 'number' ? approval.commandCount : null,
    impact,
  };
}

function actionLabel(action: CopilotTaskAction) {
  switch (action) {
    case 'approve':
      return 'Approve';
    case 'reject':
      return 'Reject';
    case 'cancel':
      return 'Cancel';
    case 'resume':
      return 'Resume';
    case 'abandon':
      return 'Abandon';
  }
}

function OfficeTaskPanel({
  workspaceId,
  artifactId,
  currentRevision,
  autoRefreshEnabled,
  onTaskRevision,
}: {
  workspaceId: string;
  artifactId: string;
  currentRevision: Pick<OfficeRevision, 'id' | 'sequence'>;
  autoRefreshEnabled: boolean;
  onTaskRevision: (evidence: OfficeTaskRevisionEvidence) => Promise<void>;
}) {
  const graphql = useService(GraphQLService);
  const [pending, setPending] = useState<{
    taskId: string;
    action: CopilotTaskAction;
  } | null>(null);
  const handledRef = useRef(new Set<string>());
  const inFlightRef = useRef(new Set<string>());
  const { data, error, isLoading, mutate } = useQuery(
    {
      query: copilotTasksGetQuery,
      variables: { workspaceId, limit: 100 },
    },
    {
      suspense: false,
      refreshInterval: 3000,
      shouldRetryOnError: false,
    }
  );
  const tasks = useMemo(
    () =>
      (data?.currentUser?.copilot.copilotTasks ?? [])
        .filter(task => taskOfficeArtifact(task, artifactId))
        .slice(0, 4),
    [artifactId, data?.currentUser?.copilot.copilotTasks]
  );

  useEffect(() => {
    handledRef.current.clear();
    inFlightRef.current.clear();
  }, [artifactId]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    for (const task of tasks) {
      const evidence = officeTaskRevisionEvidence(task);
      if (!evidence || evidence.artifactId !== artifactId) continue;
      if (
        !shouldRefreshOfficeTaskRevision(evidence, artifactId, currentRevision)
      ) {
        handledRef.current.add(`${task.id}:${evidence.revisionId}`);
        continue;
      }
      const key = `${task.id}:${evidence.revisionId}`;
      if (handledRef.current.has(key) || inFlightRef.current.has(key)) continue;
      inFlightRef.current.add(key);
      void onTaskRevision(evidence)
        .then(() => handledRef.current.add(key))
        .catch(caught => {
          const friendly = UserFriendlyError.fromAny(caught);
          notify.error({
            title: 'Unable to refresh Office revision',
            message: friendly.message,
          });
        })
        .finally(() => inFlightRef.current.delete(key));
    }
  }, [artifactId, autoRefreshEnabled, currentRevision, onTaskRevision, tasks]);

  const control = useCallback(
    async (task: CopilotTask, action: CopilotTaskAction) => {
      if (
        isCopilotTaskActionDisabled({
          action,
          availableActions: task.availableActions,
          pendingTaskId: pending?.taskId ?? null,
          taskId: task.id,
        })
      ) {
        return;
      }
      setPending({ taskId: task.id, action });
      try {
        await graphql.gql({
          query: controlCopilotTaskMutation,
          variables: {
            input: buildCopilotTaskControlInput(workspaceId, task.id, action),
          },
        });
        await mutate();
      } catch (caught) {
        const friendly = UserFriendlyError.fromAny(caught);
        notify.error({
          title: `Office task ${action} failed`,
          message: friendly.message,
        });
      } finally {
        setPending(null);
      }
    },
    [graphql, mutate, pending?.taskId, workspaceId]
  );

  return (
    <section className={styles.taskRegion} aria-label="Office AI changes">
      <header className={styles.taskHeader}>
        <span>Office changes</span>
        <IconButton
          size="20"
          tooltip="Refresh Office changes"
          aria-label="Refresh Office changes"
          onClick={() => void mutate()}
        >
          <ResetIcon />
        </IconButton>
      </header>
      {isLoading ? (
        <div className={styles.taskState}>
          <Loading size={18} />
          <span>Loading changes</span>
        </div>
      ) : error ? (
        <div className={styles.taskState}>
          <span>{error.message}</span>
          <Button onClick={() => void mutate()}>Retry</Button>
        </div>
      ) : tasks.length ? (
        <div className={styles.taskList}>
          {tasks.map(task => {
            const details = approvalDetails(task);
            const status = officeTaskVisualStatus(task);
            return (
              <article key={task.id} className={styles.task}>
                <div className={styles.taskTopline}>
                  <span className={styles.taskTitle}>
                    {task.title ?? details.operation ?? 'Office change'}
                  </span>
                  <span className={styles.taskStatus} data-status={status}>
                    {status.replace('_', ' ')}
                  </span>
                </div>
                <div className={styles.taskMeta}>
                  {details.revisionSequence !== null ? (
                    <span>From revision {details.revisionSequence}</span>
                  ) : null}
                  {details.commandCount !== null ? (
                    <span>{details.commandCount} command(s)</span>
                  ) : null}
                  {details.operation ? <span>{details.operation}</span> : null}
                  {details.impact.map(item => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
                {details.reason ? (
                  <p className={styles.taskReason}>{details.reason}</p>
                ) : null}
                {task.failureMessage ? (
                  <p className={styles.taskError}>{task.failureMessage}</p>
                ) : null}
                {task.resultSummary ? (
                  <p className={styles.taskReason}>{task.resultSummary}</p>
                ) : null}
                {task.availableActions.length ? (
                  <div className={styles.taskActions}>
                    {(task.availableActions as CopilotTaskAction[]).map(
                      action => (
                        <Button
                          key={action}
                          variant={
                            action === 'approve' || action === 'resume'
                              ? 'primary'
                              : action === 'reject'
                                ? 'error'
                                : 'secondary'
                          }
                          loading={
                            pending?.taskId === task.id &&
                            pending.action === action
                          }
                          disabled={isCopilotTaskActionDisabled({
                            action,
                            availableActions: task.availableActions,
                            pendingTaskId: pending?.taskId ?? null,
                            taskId: task.id,
                          })}
                          onClick={() => void control(task, action)}
                        >
                          {actionLabel(action)}
                        </Button>
                      )
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.taskState}>No Office AI changes yet</div>
      )}
    </section>
  );
}

export function OfficeChatPanel({
  workspaceId,
  artifact,
  revision,
  selection,
  selectionNotice,
  autoRefreshEnabled,
  onClearSelection,
  onTaskRevision,
}: OfficeChatPanelProps) {
  const framework = useFramework();
  const graphql = useService(GraphQLService);
  const eventSource = useService(EventSourceService);
  const nbstore = useService(NbstoreService);
  const workbench = useService(WorkbenchService).workbench;
  const t = useI18n();
  const [bodyReady, setBodyReady] = useState(false);
  const [headerReady, setHeaderReady] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const { closeConfirmModal, openConfirmModal } = useConfirmModal();
  const notificationService = useMemo(
    () => new NotificationServiceImpl(closeConfirmModal, openConfirmModal),
    [closeConfirmModal, openConfirmModal]
  );
  const requestService = useMemo(
    () =>
      createAIRequestService(
        graphql.gql,
        eventSource.eventSource,
        nbstore.realtime
      ),
    [eventSource.eventSource, graphql.gql, nbstore.realtime]
  );
  const runtime = useMemo(
    () =>
      new AIChatRuntime({
        request: requestService,
        scope: { kind: 'workspace', workspaceId },
        strategy: new WorkspaceAIChatSessionStrategy(),
      }),
    [requestService, workspaceId]
  );
  const snapshot = useAIChatRuntime(runtime);
  const session =
    snapshot?.sessions.find(
      item => item.sessionId === snapshot.activeSessionId
    ) ?? null;
  const { docDisplayConfig, searchMenuConfig, reasoningConfig } =
    useAIChatConfig();
  const specs = useAISpecs();
  const onAISubscribe = useAISubscribe();
  const compatibleSelection = officeSelectionForArtifact(
    selection,
    artifact.kind
  );
  const officeContext = useMemo<OfficeAiContext>(
    () =>
      parseOfficeAiContext({
        version: 'localmind-office-ai-context/v1',
        workspaceId,
        artifactId: artifact.id,
        artifactKind: artifact.kind,
        revisionId: revision.id,
        ...(compatibleSelection ? { selection: compatibleSelection } : {}),
      }),
    [artifact.id, artifact.kind, compatibleSelection, revision.id, workspaceId]
  );

  const openDoc = useCallback(
    (docId: string) => workbench.openDoc(docId, { at: 'active' }),
    [workbench]
  );
  const deleteSession = useCallback(
    async (sessionToDelete: BlockSuitePresets.AIRecentSession) => {
      const confirmed = await notificationService.confirm({
        title: t['com.affine.ai.chat-panel.session.delete.confirm.title'](),
        message: t['com.affine.ai.chat-panel.session.delete.confirm.message'](),
        confirmText: t['Delete'](),
        cancelText: t['Cancel'](),
      });
      if (!confirmed) return;
      await runtime.dispatch({
        type: 'deleteSession',
        sessionId: sessionToDelete.sessionId,
      });
    },
    [notificationService, runtime, t]
  );

  useAIChatElement({
    containerRef: contentRef,
    selector: 'ai-chat-content',
    enabled: bodyReady && Boolean(snapshot),
    createElement: () => new AIChatContent(),
    configureElement: content => {
      if (!snapshot) return;
      content.session = session;
      content.runtime = runtime;
      content.runtimeSnapshot = snapshot;
      content.workspaceId = workspaceId;
      content.officeContext = officeContext;
      content.extensions = specs;
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
      content.onAISubscribe = onAISubscribe;
      content.onOpenDoc = openDoc;
      content.independentMode = true;
    },
  });

  useAIChatElement({
    containerRef: toolbarRef,
    selector: 'ai-chat-toolbar',
    enabled: headerReady && Boolean(snapshot),
    createElement: () => new AIChatToolbar(),
    configureElement: toolbar => {
      configureAIChatToolbar(toolbar, {
        session,
        runtime,
        runtimeSnapshot: snapshot ?? runtime.getSnapshot(),
        docDisplayConfig,
        notificationService,
        onOpenDoc: (docId: string) => openDoc(docId),
        onSessionDelete: sessionToDelete => {
          void deleteSession(sessionToDelete).catch(console.error);
        },
      });
    },
  });

  useAIChatElement({
    containerRef: tabsRef,
    selector: 'ai-chat-tabs',
    enabled: Boolean(snapshot),
    createElement: () => new AIChatTabs(),
    configureElement: tabs => {
      tabs.runtime = runtime;
      tabs.runtimeSnapshot = snapshot ?? runtime.getSnapshot();
    },
  });

  const setContentRef = useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node;
    setBodyReady(Boolean(node));
  }, []);
  const setToolbarRef = useCallback((node: HTMLDivElement | null) => {
    toolbarRef.current = node;
    setHeaderReady(Boolean(node));
  }, []);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <span className={styles.title}>LocalMind AI</span>
        <div className={styles.tabs} ref={tabsRef} />
        <div ref={setToolbarRef} />
      </header>
      <section className={styles.context} aria-label="Office AI context">
        <div className={styles.contextChips}>
          <span className={styles.contextChip} title={artifact.sourceFileName}>
            <PageIcon />
            <span>{artifact.title || artifact.sourceFileName}</span>
          </span>
          <span className={styles.contextChip}>
            <span>{titleCase(artifact.kind)}</span>
          </span>
          <span className={styles.contextChip}>
            <span>Revision {revision.sequence}</span>
          </span>
          {compatibleSelection ? (
            <span className={styles.selectionChip}>
              <span>{officeSelectionLabel(compatibleSelection)}</span>
              <button
                type="button"
                className={styles.clearSelection}
                aria-label="Remove Office selection from AI context"
                title="Remove selection from AI context"
                onClick={onClearSelection}
              >
                <CloseIcon />
              </button>
            </span>
          ) : null}
        </div>
        {selectionNotice ? (
          <div className={styles.contextNotice} role="status">
            {selectionNotice}
          </div>
        ) : null}
        {artifact.kind === 'pdf' ? (
          <div className={styles.pdfBoundary}>
            PDF is fixed-layout. AI changes are limited to annotations, forms,
            page operations, signature appearances, and redaction.
          </div>
        ) : null}
      </section>
      <DocumentCreationPanel sessionId={snapshot?.activeSessionId} />
      <OfficeTaskPanel
        workspaceId={workspaceId}
        artifactId={artifact.id}
        currentRevision={revision}
        autoRefreshEnabled={autoRefreshEnabled}
        onTaskRevision={onTaskRevision}
      />
      {snapshot ? (
        <div className={styles.content} ref={setContentRef} />
      ) : (
        <div className={styles.loading}>
          <AiIcon />
          <span>Loading chat history</span>
        </div>
      )}
    </div>
  );
}
