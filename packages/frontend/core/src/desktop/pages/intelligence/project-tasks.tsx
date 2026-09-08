import { Button, Loading } from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { projectErrorMessage } from '@affine/core/modules/project-resources/error';
import { useProjectRefresh } from '@affine/core/modules/project-resources/realtime';
import {
  type ProjectAgentTaskFieldsFragment,
  projectAgentTasksQuery,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { useEffect, useRef, useState } from 'react';

import * as styles from '../workspace/office/chat.css';
import { ProjectPublications } from './project-publications';
import { useProjectTaskDecision } from './use-project-task-decision';

type ProjectTasksProps = {
  projectId: string;
  sessionId?: string;
  onCompleted?: (task: ProjectAgentTaskFieldsFragment) => Promise<unknown>;
  onOpenResource: (resourceId: string) => void;
};

export function ProjectTasks(props: ProjectTasksProps) {
  return (
    <>
      <ProjectTaskList
        key={`${props.projectId}:${props.sessionId ?? ''}`}
        {...props}
      />
      <ProjectPublications key={props.projectId} projectId={props.projectId} />
    </>
  );
}

function ProjectTaskList({
  projectId,
  sessionId,
  onCompleted,
  onOpenResource,
}: ProjectTasksProps) {
  const t = useI18n();
  const decide = useProjectTaskDecision();
  const [cursor, setCursor] = useState<string>();
  const [pending, setPending] = useState<string | null>(null);
  const submitting = useRef(false);
  const [failure, setFailure] = useState<string | null>(null);
  const handled = useRef(new Set<string>());
  const query = useQuery(
    {
      query: projectAgentTasksQuery,
      variables: { projectId, sessionId, cursor, limit: 20 },
    },
    { suspense: false, shouldRetryOnError: false }
  );
  useProjectRefresh(projectId, 'task', query.mutate);
  const tasks = query.error
    ? []
    : (query.data?.projectAgentTasks.items ?? []).filter(
        task =>
          task.projectId === projectId &&
          task.workflow !== 'agent_runtime_project_publication' &&
          (!sessionId || task.sessionId === sessionId)
      );
  useEffect(() => {
    if (!onCompleted || query.error) return;
    for (const task of query.data?.projectAgentTasks.items ?? []) {
      if (
        task.projectId !== projectId ||
        (sessionId && task.sessionId !== sessionId) ||
        task.status !== 'completed' ||
        !task.receipt ||
        handled.current.has(task.id)
      )
        continue;
      handled.current.add(task.id);
      const oldest = handled.current.values().next().value;
      if (handled.current.size > 256 && oldest) handled.current.delete(oldest);
      onCompleted(task).catch(error => {
        handled.current.delete(task.id);
        setFailure(projectErrorMessage(error));
      });
    }
  }, [onCompleted, projectId, sessionId, query.data, query.error]);
  const control = async (
    task: ProjectAgentTaskFieldsFragment,
    action: 'approve' | 'reject' | 'cancel'
  ) => {
    if (submitting.current) return;
    submitting.current = true;
    setPending(task.id);
    setFailure(null);
    try {
      if (await decide(task, action)) await query.mutate();
    } catch (error) {
      setFailure(projectErrorMessage(error));
    } finally {
      submitting.current = false;
      setPending(null);
    }
  };
  const statusLabel = (status: string) => {
    switch (status) {
      case 'waiting_approval':
        return t['com.affine.localmind.project-tasks.waitingApproval']();
      case 'waiting_for_location':
        return t['com.affine.localmind.project-tasks.waitingLocation']();
      case 'waiting_lease':
        return t['com.affine.localmind.project-tasks.waitingLease']();
      case 'queued':
        return t['com.affine.localmind.project-tasks.queued']();
      case 'running':
        return t['com.affine.localmind.project-tasks.running']();
      case 'completed':
        return t['com.affine.localmind.project-tasks.completed']();
      case 'cancelled':
        return t['com.affine.localmind.project-tasks.cancelled']();
      case 'failed':
        return t['com.affine.localmind.project-tasks.failed']();
      default:
        return t['com.affine.localmind.tasks.untitled']();
    }
  };
  return (
    <details
      className={styles.taskRegion}
      open={tasks.some(task => task.status === 'waiting_approval')}
    >
      <summary className={styles.taskHeader}>
        {t['com.affine.localmind.project-tasks.title']()} ({tasks.length})
      </summary>
      <div className={styles.taskList}>
        <div className={styles.taskHeader}>
          <span>{t['com.affine.localmind.project-tasks.title']()}</span>
        </div>
        {query.isLoading ? (
          <div className={styles.taskState}>
            <Loading size={18} />
          </div>
        ) : query.error ? (
          <div className={styles.taskState} role="alert">
            <span>{projectErrorMessage(query.error)}</span>
            <Button onClick={() => void query.mutate()}>
              {t['com.affine.localmind.project-files.retry']()}
            </Button>
          </div>
        ) : tasks.length === 0 ? (
          <div className={styles.taskState}>
            {t['com.affine.localmind.project-tasks.empty']()}
          </div>
        ) : (
          tasks.map(task => {
            const preview = task.preview as Record<string, unknown> | null;
            const receipt = task.receipt as Record<string, unknown> | null;
            const resourceId = receipt?.resourceId ?? receipt?.artifactId;
            const active = [
              'waiting_approval',
              'waiting_for_location',
              'waiting_lease',
              'queued',
              'running',
            ].includes(task.status);
            return (
              <article
                key={task.id}
                className={styles.task}
                data-task-id={task.id}
              >
                <div className={styles.taskTopline}>
                  <span className={styles.taskTitle} title={task.title}>
                    {task.title}
                  </span>
                  <span className={styles.taskStatus} data-status={task.status}>
                    {statusLabel(task.status)}
                  </span>
                </div>
                <div className={styles.taskMeta}>
                  <span>{new Date(task.createdAt).toLocaleString()}</span>
                  {typeof preview?.artifactTitle === 'string' ? (
                    <span>{preview.artifactTitle}</span>
                  ) : null}
                  {typeof preview?.commandCount === 'number' ? (
                    <span>
                      {t['com.affine.localmind.project-tasks.commands']({
                        count: String(preview.commandCount),
                      })}
                    </span>
                  ) : null}
                </div>
                {task.status === 'waiting_lease' && task.leaseHolderName ? (
                  <p className={styles.taskReason}>
                    {t['com.affine.localmind.project-lease.heldBy']({
                      name: task.leaseHolderName,
                    })}
                  </p>
                ) : null}
                {typeof preview?.reason === 'string' ? (
                  <p className={styles.taskReason}>{preview.reason}</p>
                ) : null}
                {typeof preview?.revisionSequence === 'number' ? (
                  <p className={styles.taskMeta}>
                    {t['com.affine.localmind.project-files.version']({
                      version: String(preview.revisionSequence),
                    })}
                  </p>
                ) : null}
                {task.failureMessage ? (
                  <p className={styles.taskError}>
                    {projectErrorMessage(task.failureMessage)}
                  </p>
                ) : null}
                <div className={styles.taskActions}>
                  {task.status === 'completed' &&
                  typeof resourceId === 'string' ? (
                    <Button onClick={() => onOpenResource(resourceId)}>
                      {t['com.affine.localmind.project-files.open']()}
                    </Button>
                  ) : null}
                  {active ? (
                    <Button
                      disabled={!!pending}
                      loading={pending === task.id}
                      onClick={() => void control(task, 'cancel')}
                    >
                      {t['com.affine.localmind.project-files.cancel']()}
                    </Button>
                  ) : null}
                  {task.status === 'waiting_approval' ? (
                    <Button
                      variant="primary"
                      disabled={!!pending}
                      loading={pending === task.id}
                      onClick={() => void control(task, 'approve')}
                    >
                      {t['com.affine.localmind.project-tasks.approve']()}
                    </Button>
                  ) : null}
                  {task.status === 'waiting_approval' ? (
                    <Button
                      disabled={!!pending}
                      onClick={() => void control(task, 'reject')}
                    >
                      {t['com.affine.localmind.project-tasks.reject']()}
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
        {failure ? (
          <p className={styles.taskError} role="alert">
            {failure}
          </p>
        ) : null}
        <div className={styles.taskActions}>
          {cursor ? (
            <Button onClick={() => setCursor(undefined)}>
              {t['com.affine.localmind.project-tasks.latest']()}
            </Button>
          ) : null}
          {query.data?.projectAgentTasks.nextCursor ? (
            <Button
              onClick={() =>
                setCursor(query.data?.projectAgentTasks.nextCursor ?? undefined)
              }
            >
              {t['com.affine.localmind.project-files.more']()}
            </Button>
          ) : null}
        </div>
      </div>
    </details>
  );
}
