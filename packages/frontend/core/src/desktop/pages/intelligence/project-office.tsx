import { Button, IconButton, Loading, notify } from '@affine/component';
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
  useProjectEditGuard,
  useProjectUnsavedConfirmation,
} from '@affine/core/modules/project-resources/edit-guard';
import { useProjectEditLease } from '@affine/core/modules/project-resources/edit-lease';
import { projectErrorMessage } from '@affine/core/modules/project-resources/error';
import { useProjectRefresh } from '@affine/core/modules/project-resources/realtime';
import {
  projectOfficeArtifactQuery,
  projectOfficeRevisionCompareQuery,
  projectOfficeRevisionsQuery,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import {
  DownloadIcon,
  HistoryIcon,
  ResetIcon,
  SaveIcon,
} from '@blocksuite/icons/rc';
import type { OfficeAiContext, OfficeSelection } from '@localmind/office';
import { useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { officeSelectionLabel } from '../workspace/office/chat';
import {
  DocumentEditor,
  revisionCompareChanges,
} from '../workspace/office/document';
import type { OfficeEditorDraft } from '../workspace/office/edit-draft';
import { PdfEditor } from '../workspace/office/pdf';
import { PresentationEditor } from '../workspace/office/presentation';
import {
  isOfficeSelectionAvailable,
  type OfficeRevision,
} from '../workspace/office/shared';
import { SpreadsheetEditor } from '../workspace/office/spreadsheet';
import * as styles from './project-files.css';

const ignoreSelection = () => {};

export function ProjectOffice({
  projectId,
  artifactId,
  onContextChange,
}: {
  projectId: string;
  artifactId: string;
  onContextChange: (context: OfficeAiContext | undefined) => void;
}) {
  const t = useI18n();
  const graphql = useService(GraphQLService);
  const confirmUnsaved = useProjectUnsavedConfirmation();
  const editLease = useProjectEditLease();
  const drafts = useRef(new Set<OfficeEditorDraft>());
  const [unsaved, setUnsaved] = useState(false);
  const registerDraft = useCallback((draft: OfficeEditorDraft) => {
    drafts.current.add(draft);
    setUnsaved([...drafts.current].some(item => item.hasUnsavedChanges));
    return () => {
      drafts.current.delete(draft);
      setUnsaved([...drafts.current].some(item => item.hasUnsavedChanges));
    };
  }, []);
  const saveDrafts = async () => {
    for (const draft of drafts.current)
      if (draft.hasUnsavedChanges) await draft.save();
  };
  useProjectEditGuard({
    get hasUnsavedChanges() {
      return [...drafts.current].some(draft => draft.hasUnsavedChanges);
    },
    save: saveDrafts,
    discard: async () => {
      for (const draft of drafts.current) await draft.discard();
    },
  });
  const owner = useMemo<OfficeResourceOwner>(
    () => ({
      kind: 'project',
      projectId,
      editLease: editLease?.proof ?? undefined,
    }),
    [projectId, editLease?.proof]
  );
  const query = useQuery(
    { query: projectOfficeArtifactQuery, variables: { projectId, artifactId } },
    { suspense: false, shouldRetryOnError: false }
  );
  useProjectRefresh(projectId, 'resource', query.mutate);
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
    onContextChange(officeContext);
    return () => onContextChange(undefined);
  }, [officeContext, onContextChange]);

  const report = useCallback((caught: unknown) => {
    const message = projectErrorMessage(caught);
    setError(message);
    notify.error({ title: message });
  }, []);

  useEffect(() => {
    if (
      artifact?.currentRevision &&
      ![...drafts.current].some(draft => draft.hasUnsavedChanges)
    )
      setEditingRevision(current =>
        !current || current.sequence < artifact.currentRevision.sequence
          ? artifact.currentRevision
          : current
      );
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
        if (!controller.signal.aborted) report(caught);
      });
    return () => controller.abort();
  }, [kind, revision?.stateUrl, query.error, retry, report]);

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
      ).catch(report);
      if (historyOpen) mutateHistory().catch(report);
    },
    [artifactId, mutateHistory, historyOpen, projectId, mutateArtifact, report]
  );

  const run = async (operation: () => Promise<void>) => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await operation();
    } catch (caught) {
      report(caught);
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
          {query.error
            ? projectErrorMessage(query.error)
            : t['com.affine.localmind.project-files.empty']()}
        </span>
        <Button onClick={() => void query.mutate().catch(report)}>
          {t['com.affine.localmind.project-files.retry']()}
        </Button>
      </div>
    );

  const editorProps = {
    owner,
    artifactId,
    revision,
    graphql,
    readOnly: !!historical || !editLease?.proof,
    onRevision,
    onCommentAnchorChange: ignoreSelection,
    onAiSelectionChange: setSelection,
    registerDraft,
    beforeSelectionChange: confirmUnsaved,
  };
  return (
    <div className={styles.preview}>
      <div className={styles.toolbar}>
        <IconButton
          size="20"
          icon={<SaveIcon />}
          disabled={pending || !!historical || !editLease?.proof}
          tooltip={t['com.affine.localmind.project-files.save']()}
          aria-label={t['com.affine.localmind.project-files.save']()}
          onClick={() => void run(saveDrafts)}
        />
        <span className={styles.heading}>
          {historical
            ? t['com.affine.localmind.project-files.readOnly']()
            : t[
                unsaved
                  ? 'com.affine.localmind.project-files.unsaved'
                  : 'com.affine.localmind.project-files.saved'
              ]()}{' '}
          ·{' '}
          {t['com.affine.localmind.project-files.version']({
            version: String(revision.sequence),
          })}
        </span>
        {historical || artifact.currentRevision.sequence > revision.sequence ? (
          <IconButton
            size="20"
            icon={<ResetIcon />}
            disabled={pending}
            tooltip={t['com.affine.localmind.project-files.current']()}
            aria-label={t['com.affine.localmind.project-files.current']()}
            onClick={() =>
              void run(async () => {
                if (!(await confirmUnsaved())) return;
                setHistorical(null);
                setEditingRevision(artifact.currentRevision);
                setRetry(value => value + 1);
                await query.mutate();
              })
            }
          />
        ) : null}
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
            <span role="alert">{projectErrorMessage(history.error)}</span>
          ) : (
            <>
              <select
                aria-label={t['com.affine.localmind.project-files.history']()}
                value={historical?.id ?? ''}
                onChange={event => {
                  const next =
                    history.data?.projectOfficeRevisions.find(
                      item => item.id === event.target.value
                    ) ?? null;
                  void run(async () => {
                    if (!(await confirmUnsaved())) return;
                    setDiff(null);
                    setHistorical(next);
                  }).catch(report);
                }}
              >
                <option value="">
                  {t['com.affine.localmind.project-files.current']()}
                </option>
                {history.data?.projectOfficeRevisions
                  .filter(item => item.id !== artifact.currentRevision.id)
                  .map(item => (
                    <option value={item.id} key={item.id}>
                      {t['com.affine.localmind.project-files.version']({
                        version: String(item.sequence),
                      })}{' '}
                      · {new Date(item.createdAt).toLocaleString()}
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
      {selection && !historical ? (
        <div className={styles.toolbar}>
          <span className={styles.heading}>
            {officeSelectionLabel(selection)}
          </span>
          <IconButton
            size="20"
            icon={<ResetIcon />}
            tooltip={t['com.affine.localmind.project-files.clearSelection']()}
            aria-label={t[
              'com.affine.localmind.project-files.clearSelection'
            ]()}
            onClick={() => setSelection(null)}
          />
        </div>
      ) : null}
      <div className={styles.officeBody}>
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
      </div>
    </div>
  );
}
