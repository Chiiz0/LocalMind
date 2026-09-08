import { Button, IconButton, Loading, notify, Tabs } from '@affine/component';
import { DocumentCreationPanel } from '@affine/core/components/ai-document-creation/document-creation-panel';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  ProjectFileRequestDetail,
  useFileRequestStatus,
} from '@affine/core/components/project-file-request/detail';
import { getWorkspaceDocPath } from '@affine/core/desktop/route-paths';
import { GraphQLService, ServerService } from '@affine/core/modules/cloud';
import {
  projectErrorMessage,
  reportProjectError,
} from '@affine/core/modules/project-resources/error';
import { useProjectRefresh } from '@affine/core/modules/project-resources/realtime';
import {
  type CopilotWorkbenchTaskGetQuery,
  copilotWorkbenchTaskGetQuery,
  copilotWorkbenchTasksGetQuery,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import {
  ArrowLeftSmallIcon,
  ArrowRightSmallIcon,
  PageIcon,
  ResetIcon,
} from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type {
  WorkbenchPanelTaskAction,
  WorkbenchTask,
} from '../../intelligence/types';
import { useAccessRequestConfirmation } from '../../intelligence/use-access-request-confirmation';
import { useProjectTaskDecision } from '../../intelligence/use-project-task-decision';
import { executeWorkbenchTaskAction } from '../../intelligence/workbench-task-action';
import * as styles from './index.css';

type WorkbenchTaskFilter = 'all' | 'active' | 'approval' | 'completed';

const filters: WorkbenchTaskFilter[] = [
  'all',
  'active',
  'approval',
  'completed',
];
const filterSet = new Set(filters);
const supportedActions = new Set<WorkbenchPanelTaskAction>([
  'approve',
  'reject',
  'cancel',
  'resume',
  'abandon',
  'approve_access_request',
  'reject_access_request',
  'withdraw_access_request',
  'accept_project_invitation',
  'decline_project_invitation',
  'withdraw_project_invitation',
  'resolve_blocker',
  'abandon_blocker',
]);

const formatDate = (value: string) => new Date(value).toLocaleString();
type WorkbenchTaskDetail = NonNullable<
  NonNullable<
    CopilotWorkbenchTaskGetQuery['currentUser']
  >['copilot']['workbenchTask']
>;

export const filterWorkbenchTasks = (
  tasks: WorkbenchTask[],
  filter: WorkbenchTaskFilter
) => {
  if (filter === 'all') return tasks;
  if (filter === 'active') {
    return tasks.filter(task => task.segment === 'in_progress');
  }
  if (filter === 'approval') {
    return tasks.filter(
      task =>
        task.attention === 'needs_my_action' || task.status === 'waiting_lease'
    );
  }
  return tasks.filter(task => task.segment === 'done');
};

const filterForTask = (task: WorkbenchTask): WorkbenchTaskFilter => {
  if (task.kind === 'run' && task.status === 'failed') return 'all';
  if (task.attention === 'needs_my_action' || task.status === 'waiting_lease')
    return 'approval';
  if (task.segment === 'in_progress') return 'active';
  if (task.segment === 'done') return 'completed';
  return 'all';
};

export const GlobalWorkbenchTasks = () => {
  const t = useI18n();
  const fileRequestStatus = useFileRequestStatus();
  const navigate = useNavigate();
  const graphqlService = useService(GraphQLService);
  const server = useService(ServerService).server;
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFilter = searchParams.get('filter');
  const filter = filterSet.has(requestedFilter as WorkbenchTaskFilter)
    ? (requestedFilter as WorkbenchTaskFilter)
    : 'active';
  const routedTaskId = searchParams.get('taskId');
  const [pages, setPages] = useState<{
    filter: WorkbenchTaskFilter;
    cursors: Array<string | null>;
  }>({ filter, cursors: [null] });
  const cursors = pages.filter === filter ? pages.cursors : [null];
  const [pending, setPending] = useState<{
    action: WorkbenchPanelTaskAction;
    taskId: string;
  } | null>(null);
  const { data, error, isLoading, mutate } = useQuery(
    {
      query: copilotWorkbenchTasksGetQuery,
      variables: { limit: 100, filter, cursor: cursors.at(-1) ?? undefined },
    },
    {
      suspense: false,
      shouldRetryOnError: false,
    }
  );
  const list = data?.currentUser?.copilot.workbenchTasks;
  const tasks = useMemo(() => list?.items ?? [], [list?.items]);
  const visibleTasks = tasks;
  const selectedTaskId = routedTaskId ?? tasks[0]?.id ?? null;
  const {
    data: detailData,
    error: detailError,
    isLoading: detailLoading,
    mutate: refreshDetail,
  } = useQuery(
    selectedTaskId
      ? {
          query: copilotWorkbenchTaskGetQuery,
          variables: { taskId: selectedTaskId },
        }
      : undefined,
    { suspense: false, shouldRetryOnError: false }
  );
  useProjectRefresh(null, 'task', async () => {
    await Promise.all([mutate(), selectedTaskId ? refreshDetail() : undefined]);
  });
  const detail = detailData?.currentUser?.copilot.workbenchTask;
  const selectedTask = detail?.id === selectedTaskId ? detail : null;

  const updateRoute = useCallback(
    (nextFilter: WorkbenchTaskFilter, taskId: string | null) => {
      setSearchParams(
        current => {
          const next = new URLSearchParams(current);
          next.set('filter', nextFilter);
          if (taskId) next.set('taskId', taskId);
          else next.delete('taskId');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    if (
      routedTaskId &&
      selectedTask &&
      !filterWorkbenchTasks([selectedTask], filter).length
    ) {
      updateRoute(filterForTask(selectedTask), routedTaskId);
    } else if (!routedTaskId && !isLoading && !error && selectedTaskId) {
      updateRoute(filter, selectedTaskId);
    }
  }, [
    error,
    filter,
    isLoading,
    requestedFilter,
    routedTaskId,
    selectedTask,
    selectedTaskId,
    updateRoute,
  ]);

  const titleFor = useCallback(
    (task: WorkbenchTask) => {
      if (task.status === 'waiting_for_location')
        return t['com.affine.localmind.documentCreation.waiting']();
      if (task.redacted) {
        return t['com.affine.localmind.tasks.authorization.redacted']();
      }
      if (task.title) return task.title;
      switch (task.kind) {
        case 'access_request':
          return t['com.affine.localmind.tasks.authorization.accessRequest']();
        case 'project_invitation':
          return t['com.affine.localmind.tasks.authorization.invitation']();
        case 'project_grant':
          return t['com.affine.localmind.tasks.authorization.projectGrant']();
        case 'blocker':
          return t['com.affine.localmind.workbench.blocker.group']();
        case 'run':
        default:
          return t['com.affine.localmind.tasks.untitled']();
      }
    },
    [t]
  );

  const statusFor = useCallback(
    (task: WorkbenchTask) => {
      if (task.kind === 'file_request') return fileRequestStatus(task.status);
      if (task.status === 'waiting_for_location')
        return t['com.affine.localmind.documentCreation.waiting']();
      if (task.run?.abandoned) {
        return t['com.affine.localmind.tasks.status.abandoned']();
      }
      if (task.kind === 'blocker') {
        switch (task.status) {
          case 'waiting':
            return t['com.affine.localmind.workbench.blocker.status.waiting']();
          case 'resolved':
            return t[
              'com.affine.localmind.workbench.blocker.status.resolved'
            ]();
          case 'abandoned':
            return t[
              'com.affine.localmind.workbench.blocker.status.abandoned'
            ]();
        }
      }
      const key = `com.affine.localmind.tasks.status.${task.status}` as const;
      const translated = t[key];
      return typeof translated === 'function' ? translated() : task.status;
    },
    [t, fileRequestStatus]
  );

  const kindFor = useCallback(
    (task: WorkbenchTask) => {
      switch (task.kind) {
        case 'file_request':
          return t['com.affine.localmind.fileRequest.title']();
        case 'run':
        case 'project_run':
          return t['com.affine.localmind.tasks.authorization.kind.run']();
        case 'access_request':
          return t[
            'com.affine.localmind.tasks.authorization.kind.access_request'
          ]();
        case 'project_invitation':
          return t[
            'com.affine.localmind.tasks.authorization.kind.project_invitation'
          ]();
        case 'project_grant':
          return t[
            'com.affine.localmind.tasks.authorization.kind.project_grant'
          ]();
        case 'blocker':
          return t['com.affine.localmind.tasks.authorization.kind.blocker']();
        default:
          return task.kind;
      }
    },
    [t]
  );

  const actionLabel = useCallback(
    (action: WorkbenchPanelTaskAction) => {
      const labels: Record<WorkbenchPanelTaskAction, string> = {
        approve: t['com.affine.localmind.tasks.action.approve'](),
        reject: t['com.affine.localmind.tasks.action.reject'](),
        cancel: t['com.affine.localmind.tasks.action.cancel'](),
        resume: t['com.affine.localmind.tasks.action.resume'](),
        abandon: t['com.affine.localmind.tasks.action.abandon'](),
        approve_access_request:
          t['com.affine.localmind.workbench.action.approveAccess'](),
        reject_access_request:
          t['com.affine.localmind.workbench.action.rejectAccess'](),
        withdraw_access_request:
          t['com.affine.localmind.workbench.action.withdrawRequest'](),
        accept_project_invitation:
          t['com.affine.localmind.workbench.action.acceptInvite'](),
        decline_project_invitation:
          t['com.affine.localmind.workbench.action.declineInvite'](),
        withdraw_project_invitation:
          t['com.affine.localmind.workbench.action.withdrawInvite'](),
        resolve_blocker: t['com.affine.localmind.workbench.blocker.resolve'](),
        abandon_blocker: t['com.affine.localmind.workbench.blocker.abandon'](),
      };
      return labels[action];
    },
    [t]
  );

  const confirmAccessRequest = useAccessRequestConfirmation();
  const decideProjectTask = useProjectTaskDecision();
  const runAction = useCallback(
    async (task: WorkbenchTask, action: WorkbenchPanelTaskAction) => {
      if (pending || !task.availableActions.includes(action)) return;
      setPending({ action, taskId: task.id });
      try {
        if (
          task.projectTask &&
          (action === 'approve' || action === 'reject' || action === 'cancel')
        ) {
          if (await decideProjectTask(task.projectTask, action))
            await Promise.all([mutate(), refreshDetail()]);
          return;
        }
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
        await Promise.all([mutate(), refreshDetail()]);
        notify.success({
          title: t['com.affine.localmind.tasks.action.success'](),
        });
      } catch (caught) {
        reportProjectError(caught);
      } finally {
        setPending(null);
      }
    },
    [
      confirmAccessRequest,
      decideProjectTask,
      graphqlService,
      mutate,
      refreshDetail,
      pending,
      t,
    ]
  );

  const filterLabel = (value: WorkbenchTaskFilter) =>
    t[`com.affine.localmind.tasks.filter.${value}`]();

  return (
    <main className={styles.globalPage} data-testid="global-tasks-page">
      <header className={styles.globalHeader}>
        <div className={styles.globalTitleRow}>
          <IconButton
            size="20"
            icon={<ArrowLeftSmallIcon />}
            tooltip={t['com.affine.localmind.workbench.projects']()}
            aria-label={t['com.affine.localmind.workbench.projects']()}
            onClick={() => navigate('/project')}
          />
          <h1 className={styles.globalTitle}>
            {t['com.affine.workspaceSubPath.tasks']()}
          </h1>
        </div>
        <div className={styles.header}>
          <Tabs.Root
            value={filter}
            onValueChange={value => {
              const nextFilter = value as WorkbenchTaskFilter;
              setPages({ filter: nextFilter, cursors: [null] });
              updateRoute(nextFilter, null);
            }}
          >
            <Tabs.List className={styles.filters}>
              {filters.map(value => (
                <Tabs.Trigger key={value} value={value}>
                  {filterLabel(value)}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>
          <IconButton
            size="20"
            icon={<ResetIcon />}
            tooltip={t['com.affine.localmind.tasks.refresh']()}
            aria-label={t['com.affine.localmind.tasks.refresh']()}
            disabled={isLoading}
            onClick={() => void Promise.all([mutate(), refreshDetail()])}
          />
        </div>
      </header>
      <div className={styles.globalBody}>
        <div className={styles.root}>
          <section className={styles.listPane}>
            {isLoading ? (
              <div className={styles.centerState}>
                <Loading size={24} />
              </div>
            ) : error ? (
              <div className={styles.centerState} role="alert">
                <span className={styles.errorText}>
                  {projectErrorMessage(error)}
                </span>
                <Button onClick={() => void mutate().catch(reportProjectError)}>
                  {t['com.affine.localmind.tasks.refresh']()}
                </Button>
              </div>
            ) : visibleTasks.length ? (
              <>
                {visibleTasks.map(task => (
                  <button
                    key={task.id}
                    type="button"
                    className={styles.taskRow}
                    data-selected={task.id === selectedTask?.id}
                    onClick={() => updateRoute(filter, task.id)}
                  >
                    <span className={styles.taskRowTopline}>
                      <span className={styles.taskTitle} title={titleFor(task)}>
                        {titleFor(task)}
                      </span>
                      <span className={styles.status} data-status={task.status}>
                        {statusFor(task)}
                      </span>
                    </span>
                    <span className={styles.taskMeta}>
                      {kindFor(task)} · {formatDate(task.updatedAt)}
                    </span>
                  </button>
                ))}
              </>
            ) : (
              <div className={styles.centerState}>
                {t[`com.affine.localmind.tasks.empty.${filter}`]()}
              </div>
            )}
            {cursors.length > 1 || list?.nextCursor ? (
              <nav
                className={styles.pagination}
                aria-label={t[
                  'com.affine.localmind.tasks.history.navigation'
                ]()}
              >
                <IconButton
                  icon={<ArrowLeftSmallIcon />}
                  tooltip={t['com.affine.localmind.tasks.history.previous']()}
                  aria-label={t[
                    'com.affine.localmind.tasks.history.previous'
                  ]()}
                  disabled={isLoading || cursors.length <= 1}
                  onClick={() => {
                    setPages({ filter, cursors: cursors.slice(0, -1) });
                    updateRoute(filter, null);
                  }}
                />
                <span>{cursors.length}</span>
                <IconButton
                  icon={<ArrowRightSmallIcon />}
                  tooltip={t['com.affine.localmind.tasks.history.next']()}
                  aria-label={t['com.affine.localmind.tasks.history.next']()}
                  disabled={isLoading || !list?.nextCursor}
                  onClick={() => {
                    if (!list?.nextCursor) return;
                    setPages({
                      filter,
                      cursors: [...cursors, list.nextCursor],
                    });
                    updateRoute(filter, null);
                  }}
                />
              </nav>
            ) : null}
          </section>
          <section className={styles.detailPane}>
            {detailLoading ? (
              <div className={styles.centerState}>
                <Loading size={24} />
              </div>
            ) : detailError ? (
              <div className={styles.centerState} role="alert">
                <span>{projectErrorMessage(detailError)}</span>
                <Button
                  onClick={() => void refreshDetail().catch(reportProjectError)}
                >
                  {t['com.affine.localmind.tasks.refresh']()}
                </Button>
              </div>
            ) : selectedTask ? (
              <GlobalTaskDetail
                task={selectedTask}
                onChanged={async () => {
                  await Promise.all([mutate(), refreshDetail()]);
                }}
                pending={pending}
                title={titleFor(selectedTask)}
                status={statusFor(selectedTask)}
                kindLabel={kindFor(selectedTask)}
                actionLabel={actionLabel}
                onAction={runAction}
                onOpenArtifact={(kind, id, workspaceId) => {
                  const docParams = new URLSearchParams({
                    server: server.baseUrl,
                    docScope: id,
                    access: 'write',
                  });
                  navigate(
                    kind === 'office'
                      ? `/workspace/${encodeURIComponent(workspaceId)}/office/${encodeURIComponent(id)}`
                      : `${getWorkspaceDocPath(workspaceId, id)}?${docParams}`
                  );
                }}
              />
            ) : (
              <div className={styles.centerState}>
                {selectedTaskId
                  ? t['com.affine.localmind.tasks.history.unavailable']()
                  : t['com.affine.localmind.tasks.empty.detail']()}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};

const GlobalTaskDetail = ({
  task,
  onChanged,
  pending,
  title,
  status,
  kindLabel,
  actionLabel,
  onAction,
  onOpenArtifact,
}: {
  task: WorkbenchTaskDetail;
  onChanged: () => Promise<void>;
  pending: { action: WorkbenchPanelTaskAction; taskId: string } | null;
  title: string;
  status: string;
  kindLabel: string;
  actionLabel: (action: WorkbenchPanelTaskAction) => string;
  onAction: (
    task: WorkbenchTask,
    action: WorkbenchPanelTaskAction
  ) => Promise<void>;
  onOpenArtifact: (kind: string, id: string, workspaceId: string) => void;
}) => {
  const t = useI18n();
  const record = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const approval = record(task.run?.approvalSummary);
  const preview = record(approval?.previewSummary);
  const stats = Object.entries(record(preview?.stats) ?? {})
    .filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' && Number.isFinite(entry[1])
    )
    .slice(0, 20);
  const actions = task.availableActions.filter(action =>
    supportedActions.has(action as WorkbenchPanelTaskAction)
  ) as WorkbenchPanelTaskAction[];
  return (
    <div className={styles.detailContent}>
      <header className={styles.detailHeader}>
        <div className={styles.detailHeading}>
          <h1 className={styles.detailTitle}>{title}</h1>
          <span className={styles.status} data-status={task.status}>
            {status}
          </span>
        </div>
        <div className={styles.actions}>
          {actions.map(action => (
            <Button
              key={action}
              variant={
                action === 'approve' ||
                action === 'resume' ||
                action === 'approve_access_request' ||
                action === 'accept_project_invitation' ||
                action === 'resolve_blocker'
                  ? 'primary'
                  : action === 'reject' ||
                      action === 'abandon' ||
                      action === 'reject_access_request' ||
                      action === 'decline_project_invitation' ||
                      action === 'abandon_blocker'
                    ? 'error'
                    : 'secondary'
              }
              loading={pending?.taskId === task.id && pending.action === action}
              disabled={pending !== null}
              onClick={() => void onAction(task, action)}
            >
              {action === 'approve' &&
              task.run?.documentUpdate?.needsReconfirmation
                ? t['com.affine.localmind.tasks.approval.confirmAgain']()
                : actionLabel(action)}
            </Button>
          ))}
        </div>
      </header>

      {task.kind === 'file_request' ? (
        <ProjectFileRequestDetail
          requestId={task.entityId}
          onChanged={onChanged}
        />
      ) : null}
      {task.run?.sessionId &&
      task.run.workflow === 'agent_runtime_localmind_tool_agent' ? (
        <DocumentCreationPanel
          sessionId={task.run.sessionId}
          onChanged={onChanged}
        />
      ) : null}

      {approval ? (
        <section className={styles.detailSection}>
          <h2 className={styles.detailSectionTitle}>
            {t['com.affine.localmind.tasks.approval.summary']()}
          </h2>
          {typeof approval.reason === 'string' ? (
            <p className={styles.detailSectionText}>{approval.reason}</p>
          ) : null}
          <dl className={styles.metadata}>
            {typeof approval.operation === 'string' ? (
              <div>
                <dt className={styles.metadataLabel}>
                  {t['com.affine.localmind.tasks.approval.operation']()}
                </dt>
                <dd className={styles.metadataValue}>{approval.operation}</dd>
              </div>
            ) : null}
            {typeof approval.commandCount === 'number' ? (
              <div>
                <dt className={styles.metadataLabel}>
                  {t['com.affine.localmind.tasks.approval.commandCount']()}
                </dt>
                <dd className={styles.metadataValue}>
                  {approval.commandCount}
                </dd>
              </div>
            ) : null}
            {typeof approval.revisionSequence === 'number' ? (
              <div>
                <dt className={styles.metadataLabel}>
                  {t['com.affine.localmind.tasks.approval.revision']()}
                </dt>
                <dd className={styles.metadataValue}>
                  {approval.revisionSequence}
                </dd>
              </div>
            ) : null}
            {stats.map(([key, value]) => (
              <div key={key}>
                <dt className={styles.metadataLabel}>{key}</dt>
                <dd className={styles.metadataValue}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {task.run?.documentUpdate ? (
        <section className={styles.detailSection}>
          <h2 className={styles.detailSectionTitle}>
            {t['com.affine.localmind.tasks.approval.preview']()}
          </h2>
          {task.run.documentUpdate.needsReconfirmation ? (
            <p className={styles.reconfirmation} role="alert">
              {t['com.affine.localmind.tasks.approval.changed']()}
            </p>
          ) : null}
          <dl className={styles.metadata}>
            <div>
              <dt className={styles.metadataLabel}>
                {t['com.affine.localmind.tasks.authorization.document']()}
              </dt>
              <dd className={styles.metadataValue}>
                {task.documentTitle || task.title}
              </dd>
            </div>
            {task.run.documentUpdate.previousVersion ? (
              <div>
                <dt className={styles.metadataLabel}>
                  {t['com.affine.localmind.tasks.approval.previousVersion']()}
                </dt>
                <dd className={styles.metadataValue}>
                  {formatDate(task.run.documentUpdate.previousVersion)}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className={styles.metadataLabel}>
                {t['com.affine.localmind.tasks.approval.currentVersion']()}
              </dt>
              <dd className={styles.metadataValue}>
                {formatDate(task.run.documentUpdate.expectedVersion)}
              </dd>
            </div>
          </dl>
          <pre className={styles.documentPreview}>
            {task.run.documentUpdate.content}
          </pre>
        </section>
      ) : null}

      <dl className={styles.metadata}>
        <div>
          <dt className={styles.metadataLabel}>
            {t['com.affine.localmind.tasks.created']()}
          </dt>
          <dd className={styles.metadataValue}>{formatDate(task.createdAt)}</dd>
        </div>
        <div>
          <dt className={styles.metadataLabel}>
            {t['com.affine.localmind.tasks.updated']()}
          </dt>
          <dd className={styles.metadataValue}>{formatDate(task.updatedAt)}</dd>
        </div>
        <div>
          <dt className={styles.metadataLabel}>
            {t['com.affine.localmind.tasks.authorization.kindLabel']()}
          </dt>
          <dd className={styles.metadataValue}>{kindLabel}</dd>
        </div>
        {task.requestedLevel ? (
          <div>
            <dt className={styles.metadataLabel}>
              {t['com.affine.localmind.tasks.authorization.level']()}
            </dt>
            <dd className={styles.metadataValue}>
              {t[
                task.requestedLevel === 'write'
                  ? 'com.affine.localmind.accessNotification.write'
                  : 'com.affine.localmind.accessNotification.read'
              ]()}
            </dd>
          </div>
        ) : null}
        {task.projectName ? (
          <div>
            <dt className={styles.metadataLabel}>
              {t['com.affine.localmind.tasks.authorization.project']()}
            </dt>
            <dd className={styles.metadataValue}>{task.projectName}</dd>
          </div>
        ) : null}
        {!task.redacted && task.documentTitle ? (
          <div>
            <dt className={styles.metadataLabel}>
              {t['com.affine.localmind.tasks.authorization.document']()}
            </dt>
            <dd className={styles.metadataValue}>{task.documentTitle}</dd>
          </div>
        ) : null}
        {task.relatedUserName || task.relatedUserEmail ? (
          <div>
            <dt className={styles.metadataLabel}>
              {t['com.affine.localmind.tasks.authorization.relatedUser']()}
            </dt>
            <dd className={styles.metadataValue}>
              {task.relatedUserName} {task.relatedUserEmail}
            </dd>
          </div>
        ) : null}
        {task.blocker ? (
          <>
            <div>
              <dt className={styles.metadataLabel}>
                {t['com.affine.localmind.workbench.blocker.type']()}
              </dt>
              <dd className={styles.metadataValue}>
                {t[
                  `com.affine.localmind.workbench.blocker.type.${
                    task.blocker.type === 'wait_reply'
                      ? 'reply'
                      : task.blocker.type === 'wait_file'
                        ? 'file'
                        : task.blocker.type === 'wait_decision'
                          ? 'decision'
                          : 'custom'
                  }`
                ]()}
              </dd>
            </div>
            <div>
              <dt className={styles.metadataLabel}>
                {t['com.affine.localmind.workbench.blocker.waitingOnLabel']()}
              </dt>
              <dd className={styles.metadataValue}>{task.blocker.waitingOn}</dd>
            </div>
            <div>
              <dt className={styles.metadataLabel}>
                {t['com.affine.localmind.workbench.blocker.dueAt']()}
              </dt>
              <dd
                className={styles.metadataValue}
                data-overdue={task.blocker.overdue || undefined}
              >
                {task.blocker.dueAt
                  ? task.blocker.overdue
                    ? t['com.affine.localmind.workbench.blocker.overdue']({
                        date: formatDate(task.blocker.dueAt),
                      })
                    : formatDate(task.blocker.dueAt)
                  : t['com.affine.localmind.workbench.blocker.noDueDate']()}
              </dd>
            </div>
            <div>
              <dt className={styles.metadataLabel}>
                {t['com.affine.localmind.workbench.blocker.originLabel']()}
              </dt>
              <dd className={styles.metadataValue}>
                {task.blocker.origin === 'ai_suggested'
                  ? t['com.affine.localmind.workbench.blocker.origin.ai']()
                  : t['com.affine.localmind.workbench.blocker.origin.user']()}
              </dd>
            </div>
          </>
        ) : null}
      </dl>

      {task.run?.failureMessage ? (
        <section className={styles.detailSection}>
          <h2 className={styles.detailSectionTitle}>
            {t['com.affine.localmind.tasks.failure']()}
          </h2>
          <p className={styles.detailSectionText} data-failure="true">
            {t['com.affine.localmind.project-error.failed']()}
          </p>
        </section>
      ) : null}
      {task.run?.resultSummary ? (
        <section className={styles.detailSection}>
          <h2 className={styles.detailSectionTitle}>
            {t['com.affine.localmind.tasks.result']()}
          </h2>
          <p className={styles.detailSectionText}>{task.run.resultSummary}</p>
        </section>
      ) : null}
      {task.run?.artifacts.length ? (
        <section className={styles.detailSection}>
          {task.run.artifacts.map(artifact => (
            <Button
              key={`${artifact.kind}:${artifact.id}`}
              prefix={<PageIcon />}
              onClick={() =>
                onOpenArtifact(artifact.kind, artifact.id, artifact.workspaceId)
              }
            >
              {artifact.title || t['com.affine.localmind.tasks.openDocument']()}
            </Button>
          ))}
        </section>
      ) : null}
      {task.run ? (
        <section className={styles.detailSection}>
          <h2 className={styles.detailSectionTitle}>
            {t['com.affine.localmind.tasks.steps']()}
          </h2>
          <ol className={styles.steps}>
            {task.run.steps.map(step => (
              <li key={step.id} className={styles.step}>
                <span className={styles.stepMarker} data-status={step.status} />
                <span className={styles.stepContent}>
                  <strong className={styles.stepTitle}>
                    {step.title ?? step.key}
                  </strong>
                  <span className={styles.stepStatus}>{step.status}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
};
