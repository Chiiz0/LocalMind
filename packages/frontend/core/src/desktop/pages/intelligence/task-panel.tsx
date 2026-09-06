import { Button, IconButton, Loading } from '@affine/component';
import { useI18n } from '@affine/i18n';
import {
  ArrowDownSmallIcon,
  CheckBoxCheckLinearIcon,
  CloseIcon,
  PlusIcon,
  ResetIcon,
  WarningIcon,
} from '@blocksuite/icons/rc';
import {
  type FormEvent,
  type ReactElement,
  type SVGAttributes,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as styles from './task-panel.css';
import type {
  WorkbenchBlockerDraft,
  WorkbenchBlockerType,
  WorkbenchPanelTaskAction,
  WorkbenchTask,
  WorkbenchTaskPanelData,
  WorkbenchTaskSegment,
} from './types';

type TaskPanelProps = {
  panel: WorkbenchTaskPanelData;
  loading: boolean;
  error?: string;
  pendingAction: { taskId: string; action: WorkbenchPanelTaskAction } | null;
  navigationToggle?: {
    expanded: boolean;
    controls: string;
    icon: ReactElement<SVGAttributes<SVGElement>>;
    label: string;
    onClick: () => void;
  };
  onRefresh: () => void;
  onOpenTask: (task: WorkbenchTask) => void;
  onViewAll: (segment: 'todo' | 'in-progress' | 'done') => void;
  onAction: (
    task: WorkbenchTask,
    action: WorkbenchPanelTaskAction
  ) => Promise<void>;
  selectedProjectId: string | null;
  onCreateBlocker: (
    projectId: string,
    blocker: WorkbenchBlockerDraft
  ) => Promise<boolean>;
};

const supportedActions = new Set<WorkbenchPanelTaskAction>([
  'approve',
  'reject',
  'cancel',
  'resume',
  'abandon',
  'approve_access_request',
  'reject_access_request',
  'withdraw_access_request',
  'request_project_access',
  'accept_project_invitation',
  'decline_project_invitation',
  'withdraw_project_invitation',
  'resolve_blocker',
  'abandon_blocker',
]);

export const needsMyAction = (task: WorkbenchTask) =>
  task.attention === 'needs_my_action';

export const isWaitingOnOthers = (task: WorkbenchTask) =>
  task.attention === 'waiting_on_others';

const formatDate = (value: string) => new Date(value).toLocaleString();

const blockerTypes: WorkbenchBlockerType[] = [
  'wait_reply',
  'wait_file',
  'wait_decision',
  'custom',
];

const isBlocker = (
  task: WorkbenchTask
): task is WorkbenchTask & { blocker: NonNullable<WorkbenchTask['blocker']> } =>
  task.kind === 'blocker' && task.blocker !== null;

export const TaskPanel = ({
  panel,
  loading,
  error,
  pendingAction,
  navigationToggle,
  onRefresh,
  onOpenTask,
  onViewAll,
  onAction,
  selectedProjectId,
  onCreateBlocker,
}: TaskPanelProps) => {
  const t = useI18n();
  const [expanded, setExpanded] = useState(true);
  const [showBlockerForm, setShowBlockerForm] = useState(false);
  const [blockerTitle, setBlockerTitle] = useState('');
  const [blockerType, setBlockerType] =
    useState<WorkbenchBlockerType>('wait_reply');
  const [blockerWaitingOn, setBlockerWaitingOn] = useState('');
  const [blockerDueAt, setBlockerDueAt] = useState('');
  const [blockerCreating, setBlockerCreating] = useState(false);
  const [blockerCreateError, setBlockerCreateError] = useState<string | null>(
    null
  );
  const blockerSubmitPending = useRef(false);
  const blockerTitleRef = useRef<HTMLInputElement>(null);
  const blockerToggleRef = useRef<HTMLButtonElement>(null);
  const needsAction = useMemo(
    () => panel.todo.items.filter(needsMyAction),
    [panel.todo.items]
  );
  const blockers = useMemo(
    () =>
      panel.todo.items
        .filter(isBlocker)
        .sort(
          (left, right) =>
            Number(right.blocker.overdue) - Number(left.blocker.overdue)
        ),
    [panel.todo.items]
  );
  const waitingOnOthers = useMemo(
    () =>
      panel.todo.items.filter(
        task => !isBlocker(task) && isWaitingOnOthers(task)
      ),
    [panel.todo.items]
  );
  const empty =
    !panel.todo.items.length &&
    !panel.inProgress.items.length &&
    !panel.done.items.length &&
    !panel.todo.capped &&
    !panel.inProgress.capped &&
    !panel.done.capped;
  const compact = loading || !!error || (empty && !showBlockerForm);

  useEffect(() => {
    setShowBlockerForm(false);
    setBlockerTitle('');
    setBlockerType('wait_reply');
    setBlockerWaitingOn('');
    setBlockerDueAt('');
    setBlockerCreateError(null);
  }, [selectedProjectId]);

  useEffect(() => {
    if (showBlockerForm) {
      blockerTitleRef.current?.focus();
    }
  }, [showBlockerForm]);

  const closeBlockerForm = () => {
    if (blockerCreating) return;
    setShowBlockerForm(false);
    setBlockerCreateError(null);
    queueMicrotask(() => blockerToggleRef.current?.focus());
  };

  const submitBlocker = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProjectId || blockerSubmitPending.current) return;
    const title = blockerTitle.trim();
    const waitingOn = blockerWaitingOn.trim();
    if (!title || !waitingOn) {
      setBlockerCreateError(
        t['com.affine.localmind.workbench.blocker.required']()
      );
      return;
    }

    let dueAt: string | null = null;
    if (blockerDueAt) {
      const parsedDueAt = new Date(blockerDueAt);
      if (Number.isNaN(parsedDueAt.getTime())) {
        setBlockerCreateError(
          t['com.affine.localmind.workbench.blocker.invalidDueDate']()
        );
        return;
      }
      dueAt = parsedDueAt.toISOString();
    }

    blockerSubmitPending.current = true;
    setBlockerCreating(true);
    setBlockerCreateError(null);
    try {
      const created = await onCreateBlocker(selectedProjectId, {
        title,
        type: blockerType,
        waitingOn,
        dueAt,
      });
      if (!created) {
        setBlockerCreateError(
          t['com.affine.localmind.workbench.blocker.createFailedInline']()
        );
        return;
      }
      setBlockerTitle('');
      setBlockerType('wait_reply');
      setBlockerWaitingOn('');
      setBlockerDueAt('');
      setShowBlockerForm(false);
      queueMicrotask(() => blockerToggleRef.current?.focus());
    } catch {
      setBlockerCreateError(
        t['com.affine.localmind.workbench.blocker.createFailedInline']()
      );
    } finally {
      blockerSubmitPending.current = false;
      setBlockerCreating(false);
    }
  };

  const blockerTypeLabel = (type: string) => {
    switch (type) {
      case 'wait_reply':
        return t['com.affine.localmind.workbench.blocker.type.reply']();
      case 'wait_file':
        return t['com.affine.localmind.workbench.blocker.type.file']();
      case 'wait_decision':
        return t['com.affine.localmind.workbench.blocker.type.decision']();
      case 'custom':
        return t['com.affine.localmind.workbench.blocker.type.custom']();
      default:
        return type;
    }
  };

  const statusLabel = (task: WorkbenchTask) => {
    if (isBlocker(task)) {
      switch (task.status) {
        case 'waiting':
          return t['com.affine.localmind.workbench.blocker.status.waiting']();
        case 'resolved':
          return t['com.affine.localmind.workbench.blocker.status.resolved']();
        case 'abandoned':
          return t['com.affine.localmind.workbench.blocker.status.abandoned']();
      }
    }
    if (task.run?.abandoned) {
      return t['com.affine.localmind.tasks.status.abandoned']();
    }
    switch (task.status) {
      case 'queued':
        return t['com.affine.localmind.tasks.status.queued']();
      case 'running':
        return t['com.affine.localmind.tasks.status.running']();
      case 'waiting_approval':
        return t['com.affine.localmind.tasks.status.waiting_approval']();
      case 'waiting_for_location':
        return t['com.affine.localmind.documentCreation.waiting']();
      case 'completed':
        return t['com.affine.localmind.tasks.status.completed']();
      case 'failed':
        return t['com.affine.localmind.tasks.status.failed']();
      case 'cancelled':
        return t['com.affine.localmind.tasks.status.cancelled']();
      case 'pending':
        return t['com.affine.localmind.workbench.status.pending']();
      case 'approved':
      case 'active':
        return t['com.affine.localmind.workbench.status.approved']();
      case 'rejected':
        return t['com.affine.localmind.workbench.status.rejected']();
      case 'withdrawn':
        return t['com.affine.localmind.workbench.status.withdrawn']();
      case 'expired':
        return t['com.affine.localmind.workbench.status.expired']();
      case 'accepted':
        return t['com.affine.localmind.workbench.status.accepted']();
      case 'declined':
        return t['com.affine.localmind.workbench.status.declined']();
      case 'revoked':
        return t['com.affine.localmind.workbench.status.revoked']();
      default:
        return task.status;
    }
  };

  const actionLabel = (action: WorkbenchPanelTaskAction) => {
    switch (action) {
      case 'approve':
        return t['com.affine.localmind.tasks.action.approve']();
      case 'reject':
        return t['com.affine.localmind.tasks.action.reject']();
      case 'cancel':
        return t['com.affine.localmind.tasks.action.cancel']();
      case 'resume':
        return t['com.affine.localmind.tasks.action.resume']();
      case 'abandon':
        return t['com.affine.localmind.workbench.task.abandon']();
      case 'approve_access_request':
        return t['com.affine.localmind.workbench.action.approveAccess']();
      case 'reject_access_request':
        return t['com.affine.localmind.workbench.action.rejectAccess']();
      case 'withdraw_access_request':
        return t['com.affine.localmind.workbench.action.withdrawRequest']();
      case 'request_project_access':
        return t['com.affine.localmind.workbench.action.requestAgain']();
      case 'accept_project_invitation':
        return t['com.affine.localmind.workbench.action.acceptInvite']();
      case 'decline_project_invitation':
        return t['com.affine.localmind.workbench.action.declineInvite']();
      case 'withdraw_project_invitation':
        return t['com.affine.localmind.workbench.action.withdrawInvite']();
      case 'resolve_blocker':
        return t['com.affine.localmind.workbench.blocker.resolve']();
      case 'abandon_blocker':
        return t['com.affine.localmind.workbench.blocker.abandon']();
    }
  };

  const renderTask = (task: WorkbenchTask) => {
    const actions = task.availableActions.filter(action =>
      supportedActions.has(action as WorkbenchPanelTaskAction)
    ) as WorkbenchPanelTaskAction[];

    return (
      <article
        key={task.id}
        className={styles.taskCard}
        data-status={task.status}
        data-blocker={isBlocker(task) || undefined}
        data-overdue={
          isBlocker(task) && task.blocker.overdue ? true : undefined
        }
      >
        <button
          type="button"
          className={styles.taskLink}
          onClick={() => onOpenTask(task)}
        >
          <span className={styles.taskTopline}>
            <strong className={styles.taskTitle}>
              {task.title || t['com.affine.localmind.tasks.untitled']()}
            </strong>
            <span
              className={styles.status}
              data-status={task.run?.abandoned ? 'abandoned' : task.status}
            >
              {statusLabel(task)}
            </span>
          </span>
          <span className={styles.taskMeta}>{formatDate(task.updatedAt)}</span>
          {isBlocker(task) ? (
            <span className={styles.blockerDetails}>
              <span>{blockerTypeLabel(task.blocker.type)}</span>
              <span className={styles.blockerWaitingOn}>
                {t['com.affine.localmind.workbench.blocker.waitingOn']({
                  name: task.blocker.waitingOn,
                })}
              </span>
              {task.blocker.dueAt ? (
                <span
                  className={styles.blockerDueDate}
                  data-overdue={task.blocker.overdue || undefined}
                >
                  {task.blocker.overdue ? <WarningIcon aria-hidden /> : null}
                  {task.blocker.overdue
                    ? t['com.affine.localmind.workbench.blocker.overdue']({
                        date: formatDate(task.blocker.dueAt),
                      })
                    : t['com.affine.localmind.workbench.blocker.due']({
                        date: formatDate(task.blocker.dueAt),
                      })}
                </span>
              ) : null}
            </span>
          ) : null}
          {task.run?.failureMessage ? (
            <span className={styles.failure}>{task.run.failureMessage}</span>
          ) : null}
        </button>
        {actions.length ? (
          <div className={styles.taskActions}>
            {actions.map(action => (
              <Button
                key={action}
                size="custom"
                variant={
                  action === 'approve' ||
                  action === 'resume' ||
                  action === 'resolve_blocker'
                    ? 'primary'
                    : action === 'reject' ||
                        action === 'abandon' ||
                        action === 'abandon_blocker'
                      ? 'error'
                      : 'secondary'
                }
                loading={
                  pendingAction?.taskId === task.id &&
                  pendingAction.action === action
                }
                disabled={pendingAction !== null}
                onClick={() => void onAction(task, action)}
              >
                {actionLabel(action)}
              </Button>
            ))}
          </div>
        ) : null}
      </article>
    );
  };

  const renderSegment = (
    title: string,
    segment: WorkbenchTaskSegment,
    segmentName: 'in-progress' | 'done'
  ) => (
    <section className={styles.column} data-segment={segmentName}>
      <header className={styles.columnHeader}>
        <h3>{title}</h3>
        <span className={styles.count}>{segment.items.length}</span>
      </header>
      <div className={styles.columnBody}>
        {segment.items.length ? (
          segment.items.map(renderTask)
        ) : (
          <div className={styles.emptyColumn}>
            {t['com.affine.localmind.workbench.tasks.empty']()}
          </div>
        )}
      </div>
      {segment.capped ? (
        <button
          type="button"
          className={styles.viewAll}
          onClick={() => onViewAll(segmentName)}
        >
          {t['com.affine.localmind.workbench.tasks.viewAll']()}
        </button>
      ) : null}
    </section>
  );

  return (
    <section
      className={styles.root}
      aria-label={t['com.affine.localmind.workbench.tasks']()}
    >
      <header className={styles.summary}>
        {navigationToggle ? (
          <span className={styles.mobileNavigationToggle}>
            <IconButton
              size="20"
              icon={navigationToggle.icon}
              aria-label={navigationToggle.label}
              aria-expanded={navigationToggle.expanded}
              aria-controls={navigationToggle.controls}
              onClick={navigationToggle.onClick}
            />
          </span>
        ) : null}
        <button
          type="button"
          className={styles.summaryToggle}
          aria-expanded={expanded}
          onClick={() => setExpanded(value => !value)}
        >
          <ArrowDownSmallIcon data-expanded={expanded} />
          <strong>{t['com.affine.localmind.workbench.tasks']()}</strong>
          {!loading && !error ? (
            <>
              <span className={styles.summarySegment}>
                {t['com.affine.localmind.workbench.tasks.todo']()}
                <span
                  className={
                    needsAction.length ? styles.attentionCount : styles.count
                  }
                >
                  {needsAction.length}
                </span>
              </span>
              <span className={styles.summarySegment}>
                {t['com.affine.localmind.workbench.tasks.inProgress']()}
                <span className={styles.count}>
                  {panel.inProgress.items.length}
                </span>
              </span>
              <span className={styles.summarySegment}>
                {t['com.affine.localmind.workbench.tasks.done']()}
                <span className={styles.count}>{panel.done.items.length}</span>
              </span>
            </>
          ) : null}
        </button>
        {selectedProjectId ? (
          <IconButton
            ref={blockerToggleRef}
            size="20"
            icon={showBlockerForm ? <CloseIcon /> : <PlusIcon />}
            tooltip={t['com.affine.localmind.workbench.blocker.add']()}
            aria-label={t['com.affine.localmind.workbench.blocker.add']()}
            aria-expanded={expanded && showBlockerForm}
            aria-controls="workbench-blocker-create-form"
            disabled={blockerCreating || loading || !!error}
            onClick={() => {
              setExpanded(true);
              setShowBlockerForm(value => !value || !expanded);
              setBlockerCreateError(null);
            }}
          />
        ) : null}
        <IconButton
          size="16"
          tooltip={t['com.affine.localmind.tasks.refresh']()}
          aria-label={t['com.affine.localmind.tasks.refresh']()}
          icon={<ResetIcon />}
          disabled={loading}
          onClick={onRefresh}
        />
      </header>

      {expanded || error ? (
        <div className={styles.expandedContent} data-compact={compact}>
          {loading ? (
            <div className={styles.centerState}>
              <Loading size={22} />
            </div>
          ) : error ? (
            <div className={styles.centerState} role="alert">
              <WarningIcon />
              <span>{error}</span>
              <Button onClick={onRefresh}>
                {t['com.affine.localmind.workbench.retry']()}
              </Button>
            </div>
          ) : empty && !showBlockerForm ? (
            <div className={styles.emptyState} role="status">
              <CheckBoxCheckLinearIcon aria-hidden />
              {t['com.affine.localmind.tasks.empty.all']()}
            </div>
          ) : (
            <div className={styles.board}>
              <section className={styles.column} data-segment="todo">
                <header className={styles.columnHeader}>
                  <h3>{t['com.affine.localmind.workbench.tasks.todo']()}</h3>
                  <span className={styles.todoHeaderActions}>
                    <span
                      className={
                        needsAction.length
                          ? styles.attentionCount
                          : styles.count
                      }
                    >
                      {needsAction.length}
                    </span>
                  </span>
                </header>
                <div className={styles.columnBody}>
                  {selectedProjectId && showBlockerForm ? (
                    <form
                      id="workbench-blocker-create-form"
                      className={styles.blockerForm}
                      aria-label={t[
                        'com.affine.localmind.workbench.blocker.create'
                      ]()}
                      onSubmit={event => void submitBlocker(event)}
                      onKeyDown={event => {
                        if (event.key === 'Escape') closeBlockerForm();
                      }}
                    >
                      <label className={styles.blockerFieldWide}>
                        <span>
                          {t['com.affine.localmind.workbench.blocker.title']()}
                        </span>
                        <input
                          ref={blockerTitleRef}
                          value={blockerTitle}
                          maxLength={512}
                          required
                          disabled={blockerCreating}
                          onChange={event =>
                            setBlockerTitle(event.target.value)
                          }
                        />
                      </label>
                      <label>
                        <span>
                          {t['com.affine.localmind.workbench.blocker.type']()}
                        </span>
                        <select
                          value={blockerType}
                          disabled={blockerCreating}
                          onChange={event =>
                            setBlockerType(
                              event.target.value as WorkbenchBlockerType
                            )
                          }
                        >
                          {blockerTypes.map(type => (
                            <option key={type} value={type}>
                              {blockerTypeLabel(type)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>
                          {t[
                            'com.affine.localmind.workbench.blocker.waitingOnLabel'
                          ]()}
                        </span>
                        <input
                          value={blockerWaitingOn}
                          maxLength={512}
                          required
                          disabled={blockerCreating}
                          onChange={event =>
                            setBlockerWaitingOn(event.target.value)
                          }
                        />
                      </label>
                      <label className={styles.blockerFieldWide}>
                        <span>
                          {t['com.affine.localmind.workbench.blocker.dueAt']()}
                        </span>
                        <input
                          type="datetime-local"
                          value={blockerDueAt}
                          disabled={blockerCreating}
                          onChange={event =>
                            setBlockerDueAt(event.target.value)
                          }
                        />
                      </label>
                      {blockerCreateError ? (
                        <div className={styles.blockerFormError} role="alert">
                          <WarningIcon aria-hidden />
                          <span>{blockerCreateError}</span>
                        </div>
                      ) : null}
                      <div className={styles.blockerFormActions}>
                        <Button
                          size="custom"
                          variant="plain"
                          disabled={blockerCreating}
                          onClick={event => {
                            event.preventDefault();
                            closeBlockerForm();
                          }}
                        >
                          {t['Cancel']()}
                        </Button>
                        <Button
                          size="custom"
                          variant="primary"
                          loading={blockerCreating}
                          disabled={
                            blockerCreating ||
                            !blockerTitle.trim() ||
                            !blockerWaitingOn.trim()
                          }
                        >
                          {t['com.affine.localmind.workbench.blocker.create']()}
                        </Button>
                      </div>
                    </form>
                  ) : null}
                  <div className={styles.groupTitle}>
                    <CheckBoxCheckLinearIcon />
                    {t['com.affine.localmind.workbench.tasks.needsMyAction']()}
                  </div>
                  {needsAction.length ? (
                    needsAction.map(renderTask)
                  ) : (
                    <div className={styles.emptyGroup}>
                      {t['com.affine.localmind.workbench.tasks.noneForMe']()}
                    </div>
                  )}
                  <div className={styles.groupTitle}>
                    {t[
                      'com.affine.localmind.workbench.tasks.waitingOnOthers'
                    ]()}
                  </div>
                  {blockers.length ? (
                    <>
                      <div className={styles.blockerGroupTitle}>
                        <WarningIcon />
                        {t['com.affine.localmind.workbench.blocker.group']()}
                        <span className={styles.count}>{blockers.length}</span>
                      </div>
                      {blockers.map(renderTask)}
                    </>
                  ) : selectedProjectId ? (
                    <div className={styles.emptyGroup}>
                      {t['com.affine.localmind.workbench.blocker.empty']()}
                    </div>
                  ) : null}
                  {waitingOnOthers.length ? (
                    waitingOnOthers.map(renderTask)
                  ) : blockers.length ? null : (
                    <div className={styles.emptyGroup}>
                      {t['com.affine.localmind.workbench.tasks.noneWaiting']()}
                    </div>
                  )}
                </div>
                {panel.todo.capped ? (
                  <button
                    type="button"
                    className={styles.viewAll}
                    onClick={() => onViewAll('todo')}
                  >
                    {t['com.affine.localmind.workbench.tasks.viewAll']()}
                  </button>
                ) : null}
              </section>
              {renderSegment(
                t['com.affine.localmind.workbench.tasks.inProgress'](),
                panel.inProgress,
                'in-progress'
              )}
              {renderSegment(
                t['com.affine.localmind.workbench.tasks.done'](),
                panel.done,
                'done'
              )}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
};
