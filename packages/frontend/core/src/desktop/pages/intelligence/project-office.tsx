import { Button, IconButton, Loading } from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { GraphQLService } from '@affine/core/modules/cloud';
import {
  downloadOfficePackage,
  fetchOfficeState,
  isDocxSemanticState,
  isPdfSemanticState,
  isPptxSemanticState,
  isXlsxSemanticState,
  type NativeOfficeState,
  type OfficeResourceOwner,
} from '@affine/core/modules/office';
import {
  type ProjectAgentTaskFieldsFragment,
  projectOfficeArtifactQuery,
  projectOfficeRevisionCompareQuery,
  projectOfficeRevisionsQuery,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import {
  AiIcon,
  CloseIcon,
  DownloadIcon,
  HistoryIcon,
  ResetIcon,
} from '@blocksuite/icons/rc';
import type { OfficeAiContext, OfficeSelection } from '@localmind/office';
import { useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { officeSelectionLabel } from '../workspace/office/chat';
import {
  DocumentEditor,
  revisionCompareChanges,
} from '../workspace/office/document';
import { PdfEditor } from '../workspace/office/pdf';
import { PresentationEditor } from '../workspace/office/presentation';
import {
  isOfficeSelectionAvailable,
  type OfficeRevision,
} from '../workspace/office/shared';
import { SpreadsheetEditor } from '../workspace/office/spreadsheet';
import * as styles from './project-files.css';
import { projectFilesChanged } from './project-files-data';
import { WorkbenchConversation } from './workbench-conversation';

const ignoreSelection = () => {};

export function ProjectOffice({
  projectId,
  artifactId,
  onOpenResource,
}: {
  projectId: string;
  artifactId: string;
  onOpenResource: (resourceId: string) => void;
}) {
  const t = useI18n();
  const graphql = useService(GraphQLService);
  const owner = useMemo<OfficeResourceOwner>(
    () => ({ kind: 'project', projectId }),
    [projectId]
  );
  const query = useQuery(
    { query: projectOfficeArtifactQuery, variables: { projectId, artifactId } },
    { suspense: false, shouldRetryOnError: false, refreshInterval: 15000 }
  );
  const artifact = query.data?.projectOfficeArtifact;
  const mutateArtifact = query.mutate;
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = useQuery(
    historyOpen
      ? {
          query: projectOfficeRevisionsQuery,
          variables: { projectId, artifactId, limit: 100 },
        }
      : undefined,
    { suspense: false, shouldRetryOnError: false }
  );
  const [historical, setHistorical] = useState<OfficeRevision | null>(null);
  const mutateHistory = history.mutate;
  const [editingRevision, setEditingRevision] = useState<OfficeRevision | null>(
    null
  );
  const revision = historical ?? editingRevision ?? artifact?.currentRevision;
  const kind = artifact?.kind;
  const [state, setState] = useState<NativeOfficeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<ReturnType<
    typeof revisionCompareChanges
  > | null>(null);
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [selection, setSelection] = useState<OfficeSelection | null>(null);
  const officeContext = useMemo<OfficeAiContext | undefined>(
    () =>
      artifact && revision && !historical
        ? {
            version: 'localmind-project-office-ai-context/v1',
            projectId,
            artifactId,
            artifactKind: artifact.kind,
            revisionId: revision.id,
            ...(selection?.kind === artifact.kind ? { selection } : {}),
          }
        : undefined,
    [artifact, artifactId, historical, projectId, revision, selection]
  );

  useEffect(() => {
    if (artifact?.currentRevision)
      setEditingRevision(current => current ?? artifact.currentRevision);
  }, [artifact?.currentRevision]);

  useEffect(() => {
    const controller = new AbortController();
    setState(null);
    setError(null);
    if (!revision?.stateUrl || !kind || query.error) return;
    fetchOfficeState(revision.stateUrl, kind, controller.signal)
      .then(value => {
        if (!controller.signal.aborted) setState(value);
      })
      .catch(caught => {
        if (!controller.signal.aborted)
          setError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => controller.abort();
  }, [kind, revision?.stateUrl, query.error, retry]);

  const onRevision = useCallback(
    (next: OfficeRevision, nextState: NativeOfficeState) => {
      if (
        !('projectId' in next) ||
        next.projectId !== projectId ||
        next.artifactId !== artifactId
      )
        throw new Error('Project Office revision ownership does not match');
      setState(nextState);
      setHistorical(null);
      setEditingRevision(next);
      setSelection(current =>
        current && isOfficeSelectionAvailable(nextState, current)
          ? current
          : null
      );
      mutateArtifact(
        current =>
          current
            ? {
                projectOfficeArtifact: {
                  ...current.projectOfficeArtifact,
                  revisionCounter: next.sequence,
                  currentRevision: next,
                },
              }
            : current,
        { revalidate: true }
      ).catch(console.error);
      if (historyOpen) mutateHistory().catch(console.error);
      projectFilesChanged(projectId);
    },
    [artifactId, mutateHistory, historyOpen, projectId, mutateArtifact]
  );

  const onTaskCompleted = useCallback(
    async (task: ProjectAgentTaskFieldsFragment) => {
      const receipt = task.receipt as Record<string, unknown> | null;
      if (
        historical ||
        receipt?.artifactId !== artifactId ||
        typeof receipt.sequence !== 'number' ||
        receipt.sequence <= (revision?.sequence ?? 0)
      )
        return;
      const result = await graphql.gql({
        query: projectOfficeArtifactQuery,
        variables: { projectId, artifactId },
      });
      const next = result.projectOfficeArtifact.currentRevision;
      if (!next.stateUrl)
        throw new Error('Project Office revision state is unavailable');
      const nextState = await fetchOfficeState(
        next.stateUrl,
        result.projectOfficeArtifact.kind
      );
      onRevision(next, nextState);
    },
    [artifactId, graphql, historical, onRevision, projectId, revision?.sequence]
  );

  const run = async (operation: () => Promise<void>) => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await operation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(false);
    }
  };

  if (query.isLoading)
    return (
      <div className={styles.state}>
        <Loading size={24} />
      </div>
    );
  if (query.error || !artifact || !revision)
    return (
      <div className={styles.state} role="alert">
        <span>
          {query.error?.message ??
            t['com.affine.localmind.project-files.empty']()}
        </span>
        <Button onClick={() => void query.mutate()}>
          {t['com.affine.localmind.project-files.retry']()}
        </Button>
      </div>
    );

  const editorProps = {
    owner,
    artifactId,
    revision,
    graphql,
    readOnly: !!historical,
    onRevision,
    onCommentAnchorChange: ignoreSelection,
    onAiSelectionChange: setSelection,
  };
  return (
    <div className={styles.preview}>
      <div className={styles.toolbar}>
        <span className={styles.heading}>
          {historical
            ? t['com.affine.localmind.project-files.readOnly']()
            : t['com.affine.localmind.project-files.saved']()}{' '}
          · {revision.sequence}
        </span>
        <IconButton
          size="20"
          icon={<AiIcon />}
          disabled={!!historical}
          tooltip={t['com.affine.localmind.project-files.chat']()}
          aria-label={t['com.affine.localmind.project-files.chat']()}
          aria-pressed={chatOpen}
          onClick={() => setChatOpen(value => !value)}
        />
        <IconButton
          size="20"
          icon={<ResetIcon />}
          disabled={pending}
          tooltip={t['com.affine.localmind.project-files.reload']()}
          aria-label={t['com.affine.localmind.project-files.reload']()}
          onClick={() => {
            setHistorical(null);
            setEditingRevision(artifact.currentRevision);
            setRetry(value => value + 1);
            query.mutate().catch(console.error);
          }}
        />
        <IconButton
          size="20"
          icon={<HistoryIcon />}
          tooltip={t['com.affine.localmind.project-files.history']()}
          aria-label={t['com.affine.localmind.project-files.history']()}
          aria-pressed={historyOpen}
          onClick={() => setHistoryOpen(value => !value)}
        />
        <IconButton
          size="20"
          icon={<DownloadIcon />}
          disabled={pending}
          tooltip={t['com.affine.localmind.project-files.download']()}
          aria-label={t['com.affine.localmind.project-files.download']()}
          onClick={() =>
            void run(() =>
              downloadOfficePackage(
                revision.packageUrl,
                artifact.sourceFileName
              )
            )
          }
        />
      </div>
      {!historical && artifact.currentRevision.sequence > revision.sequence ? (
        <div className={styles.state} role="status">
          {t['com.affine.localmind.project-files.conflict']()}
        </div>
      ) : null}
      {historyOpen ? (
        <div className={styles.toolbar}>
          {history.isLoading ? (
            <Loading size={16} />
          ) : history.error ? (
            <span role="alert">{history.error.message}</span>
          ) : (
            <>
              <select
                aria-label={t['com.affine.localmind.project-files.history']()}
                value={historical?.id ?? ''}
                onChange={event => {
                  setDiff(null);
                  setHistorical(
                    history.data?.projectOfficeRevisions.find(
                      item => item.id === event.target.value
                    ) ?? null
                  );
                }}
              >
                <option value="">
                  {t['com.affine.localmind.project-files.current']()}
                </option>
                {history.data?.projectOfficeRevisions
                  .filter(item => item.id !== artifact.currentRevision.id)
                  .map(item => (
                    <option value={item.id} key={item.id}>
                      {item.sequence} ·{' '}
                      {new Date(item.createdAt).toLocaleString()}
                    </option>
                  ))}
              </select>
              <Button
                disabled={!historical || pending}
                loading={pending}
                onClick={() =>
                  void run(async () => {
                    if (!historical) return;
                    const result = await graphql.gql({
                      query: projectOfficeRevisionCompareQuery,
                      variables: {
                        projectId,
                        artifactId,
                        beforeRevisionId: historical.id,
                        afterRevisionId: artifact.currentRevision.id,
                      },
                    });
                    setDiff(
                      revisionCompareChanges(
                        result.projectOfficeRevisionCompare.changes
                      )
                    );
                  })
                }
              >
                {t['com.affine.localmind.project-files.compare']()}
              </Button>
            </>
          )}
        </div>
      ) : null}
      {error ? (
        <div className={styles.state} role="alert">
          <span>{error}</span>
          <Button onClick={() => setRetry(value => value + 1)}>
            {t['com.affine.localmind.project-files.retry']()}
          </Button>
        </div>
      ) : null}
      {diff ? (
        <ul>
          {diff.map((change, index) => (
            <li key={`${change.id}:${index}`}>
              {change.label}
              {change.before ? <del>{change.before}</del> : null}
              {change.after ? <ins>{change.after}</ins> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div
        className={styles.officeBody}
        data-chat-open={chatOpen && !historical}
      >
        <div className={styles.officeEditor}>
          {!state && !error ? (
            <div className={styles.state}>
              <Loading size={24} />
            </div>
          ) : state && isDocxSemanticState(state) ? (
            <DocumentEditor {...editorProps} state={state} />
          ) : state && isXlsxSemanticState(state) ? (
            <SpreadsheetEditor {...editorProps} state={state} />
          ) : state && isPptxSemanticState(state) ? (
            <PresentationEditor {...editorProps} state={state} />
          ) : state && isPdfSemanticState(state) ? (
            <PdfEditor {...editorProps} state={state} />
          ) : null}
        </div>
        {chatOpen && officeContext ? (
          <aside className={styles.officeChat}>
            <div className={styles.toolbar}>
              <span className={styles.heading}>
                {selection ? officeSelectionLabel(selection) : artifact.title} ·{' '}
                {revision.sequence}
              </span>
              {selection ? (
                <IconButton
                  size="20"
                  icon={<ResetIcon />}
                  tooltip={t[
                    'com.affine.localmind.project-files.clearSelection'
                  ]()}
                  aria-label={t[
                    'com.affine.localmind.project-files.clearSelection'
                  ]()}
                  onClick={() => setSelection(null)}
                />
              ) : null}
              <IconButton
                size="20"
                icon={<CloseIcon />}
                tooltip={t['com.affine.localmind.project-files.close']()}
                aria-label={t['com.affine.localmind.project-files.close']()}
                onClick={() => setChatOpen(false)}
              />
            </div>
            <div className={styles.officeConversation}>
              <WorkbenchConversation
                selectedProjectId={projectId}
                officeContext={officeContext}
                onTaskCompleted={onTaskCompleted}
                onOpenResource={onOpenResource}
              />
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
