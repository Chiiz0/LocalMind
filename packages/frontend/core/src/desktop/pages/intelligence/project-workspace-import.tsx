import { Button, Input, Loading, Modal, notify } from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { GraphQLService } from '@affine/core/modules/cloud';
import {
  projectImportSourcesQuery,
  projectImportWorkspacesQuery,
  projectWorkspaceImportsQuery,
  retryProjectWorkspaceImportMutation,
  submitProjectWorkspaceImportMutation,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { ArrowRightSmallIcon, FolderIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useEffect, useRef, useState } from 'react';

import * as styles from './project-files.css';
import * as importStyles from './project-workspace-import.css';

const config = { suspense: false, shouldRetryOnError: false };
export function ProjectWorkspaceImportPicker({
  projectId,
  parentId,
  onClose,
  onSubmitted,
}: {
  projectId: string;
  parentId: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const t = useI18n();
  const graphql = useService(GraphQLService);
  const [workspace, setWorkspace] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [selected, setSelected] = useState<{
    id: string;
    title: string;
    permission: string;
    requestKey: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState(false);
  const workspaces = useQuery(
    !workspace
      ? {
          query: projectImportWorkspacesQuery,
          variables: { projectId, cursor: cursors.at(-1) },
        }
      : undefined,
    config
  );
  const sources = useQuery(
    workspace
      ? {
          query: projectImportSourcesQuery,
          variables: {
            projectId,
            workspaceId: workspace.id,
            query: search.trim(),
            cursor: cursors.at(-1),
          },
        }
      : undefined,
    config
  );
  const current = workspace ? sources : workspaces;
  const nextCursor = workspace
    ? sources.data?.projectImportSources.nextCursor
    : workspaces.data?.projectImportWorkspaces.nextCursor;
  const selectWorkspace = (value: typeof workspace) => {
    if (pendingRef.current) return;
    setWorkspace(value);
    setSelected(null);
    setSearch('');
    setCursors([undefined]);
    setError(false);
  };
  const submit = async () => {
    if (
      !workspace ||
      !selected ||
      selected.permission === 'blocked' ||
      pendingRef.current
    )
      return;
    pendingRef.current = true;
    setPending(true);
    setError(false);
    try {
      const result = await graphql.gql({
        query: submitProjectWorkspaceImportMutation,
        variables: {
          input: {
            projectId,
            parentId,
            workspaceId: workspace.id,
            sourceResourceId: selected.id,
            requestKey: selected.requestKey,
            requestApproval: selected.permission === 'approval',
          },
        },
      });
      notify.success({
        title:
          t[
            result.submitProjectWorkspaceImport.status === 'waiting_approval'
              ? 'com.affine.localmind.workspace-import.requested'
              : result.submitProjectWorkspaceImport.status === 'completed'
                ? 'com.affine.localmind.workspace-import.completed'
                : 'com.affine.localmind.workspace-import.queued'
          ](),
      });
      onSubmitted();
      onClose();
    } catch {
      setError(true);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  return (
    <Modal
      open
      width={560}
      title={t['com.affine.localmind.workspace-import.title']()}
      onOpenChange={open => {
        if (!open && !pendingRef.current) onClose();
      }}
    >
      <div className={styles.form}>
        <nav
          className={styles.breadcrumbs}
          aria-label={t['com.affine.localmind.workspace-import.steps']()}
        >
          <Button
            disabled={pending || !workspace}
            onClick={() => selectWorkspace(null)}
          >
            {t['com.affine.localmind.workspace-import.workspace']()}
          </Button>
          <ArrowRightSmallIcon />
          <span>
            {workspace
              ? workspace.name || t['Untitled']()
              : t['com.affine.localmind.workspace-import.file']()}
          </span>
        </nav>
        <p className={importStyles.help}>
          {t['com.affine.localmind.workspace-import.scope']()}
        </p>
        {workspace ? (
          <Input
            autoFocus
            value={search}
            disabled={pending}
            maxLength={128}
            aria-label={t['com.affine.localmind.workspace-import.search']()}
            placeholder={t['com.affine.localmind.workspace-import.search']()}
            onChange={value => {
              setSearch(value);
              setSelected(null);
              setCursors([undefined]);
            }}
          />
        ) : null}
        <div className={styles.picker} aria-busy={current.isLoading}>
          {current.isLoading ? (
            <div className={styles.state}>
              <Loading size={24} />
            </div>
          ) : current.error ? (
            <div className={styles.state} role="alert">
              <span>
                {t['com.affine.localmind.workspace-import.loadFailed']()}
              </span>
              <Button onClick={() => void current.mutate().catch(() => {})}>
                {t['com.affine.localmind.project-files.retry']()}
              </Button>
            </div>
          ) : workspace ? (
            <ul className={styles.list}>
              {sources.data?.projectImportSources.items.map(source => (
                <li key={source.id}>
                  <label
                    className={importStyles.source}
                    data-disabled={source.permission === 'blocked'}
                  >
                    <input
                      type="radio"
                      name="workspace-import-source"
                      className={styles.selectionCheckbox}
                      checked={selected?.id === source.id}
                      disabled={pending || source.permission === 'blocked'}
                      onChange={() => {
                        setSelected({
                          ...source,
                          requestKey: crypto.randomUUID(),
                        });
                        setError(false);
                      }}
                    />
                    <span className={importStyles.sourceText}>
                      <span className={importStyles.sourceTitle}>
                        {source.title}
                      </span>
                      <span className={importStyles.help}>
                        {t[
                          `com.affine.localmind.workspace-import.kind.${source.kind}`
                        ]()}{' '}
                        ·{' '}
                        {t[
                          source.permission === 'direct'
                            ? 'com.affine.localmind.workspace-import.direct'
                            : source.permission === 'approval'
                              ? 'com.affine.localmind.workspace-import.approval'
                              : 'com.affine.localmind.workspace-import.blocked'
                        ]()}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
              {!sources.data?.projectImportSources.items.length ? (
                <li className={styles.state}>
                  {t['com.affine.localmind.workspace-import.noFiles']()}
                </li>
              ) : null}
            </ul>
          ) : (
            <ul className={styles.list}>
              {workspaces.data?.projectImportWorkspaces.items.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={importStyles.workspace}
                    onClick={() => selectWorkspace(item)}
                  >
                    <FolderIcon />
                    <span className={styles.title}>
                      {item.name || t['Untitled']()}
                    </span>
                    <ArrowRightSmallIcon />
                  </button>
                </li>
              ))}
              {!workspaces.data?.projectImportWorkspaces.items.length ? (
                <li className={styles.state}>
                  {t['com.affine.localmind.workspace-import.noWorkspaces']()}
                </li>
              ) : null}
            </ul>
          )}
        </div>
        {cursors.length > 1 || nextCursor ? (
          <div className={styles.actions}>
            <Button
              disabled={pending || current.isLoading || cursors.length === 1}
              onClick={() => {
                setCursors(values => values.slice(0, -1));
                setSelected(null);
              }}
            >
              {t['com.affine.localmind.documentCreation.previous']()}
            </Button>
            <Button
              disabled={pending || current.isLoading || !nextCursor}
              onClick={() => {
                setCursors(values => [...values, nextCursor ?? undefined]);
                setSelected(null);
              }}
            >
              {t['com.affine.localmind.workspace-import.next']()}
            </Button>
          </div>
        ) : null}
        {selected ? (
          <p className={importStyles.help} role="status">
            {t[
              selected.permission === 'approval'
                ? 'com.affine.localmind.workspace-import.approvalHint'
                : 'com.affine.localmind.workspace-import.copyHint'
            ]()}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className={importStyles.help}>
            {t['com.affine.localmind.workspace-import.submitFailed']()}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button disabled={pending} onClick={onClose}>
            {t['Cancel']()}
          </Button>
          <Button
            variant="primary"
            disabled={
              !selected || pending || !!current.error || current.isLoading
            }
            loading={pending}
            onClick={() => void submit()}
          >
            {t[
              selected?.permission === 'approval'
                ? 'com.affine.localmind.workspace-import.request'
                : 'com.affine.localmind.workspace-import.import'
            ]()}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function ProjectWorkspaceImportStatus({
  projectId,
  parentId,
  revision,
  onOpen,
}: {
  projectId: string;
  parentId: string | null;
  revision: number;
  onOpen: (id: string) => void;
}) {
  const t = useI18n();
  const graphql = useService(GraphQLService);
  const [history, setHistory] = useState(false);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pending, setPending] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const results = useQuery(
    {
      query: projectWorkspaceImportsQuery,
      variables: { projectId, parentId, cursor: cursors.at(-1) },
    },
    {
      ...config,
      refreshInterval: data =>
        data?.projectWorkspaceImports.items.some(item =>
          ['waiting_approval', 'queued', 'running'].includes(item.status)
        )
          ? 5000
          : 30000,
    }
  );
  const { mutate } = results;
  useEffect(() => {
    void mutate().catch(() => {});
  }, [revision, mutate]);
  const retry = async (runId: string) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(runId);
    try {
      await graphql.gql({
        query: retryProjectWorkspaceImportMutation,
        variables: { projectId, runId },
      });
      await mutate();
    } catch {
      notify.error({
        title: t['com.affine.localmind.workspace-import.retryFailed'](),
      });
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  };
  const items = results.data?.projectWorkspaceImports.items ?? [];
  const rows = (all: boolean) => (
    <ul className={styles.uploads} aria-live="polite">
      {items
        .filter(
          (item, index) =>
            all ||
            !['completed', 'cancelled'].includes(item.status) ||
            (item.status === 'completed' && index < 3)
        )
        .map(item => (
          <li key={item.id} className={styles.uploadRow}>
            <span className={styles.title} title={item.title}>
              {item.title}
            </span>
            <span>
              {t[
                item.status === 'waiting_approval'
                  ? 'com.affine.localmind.workspace-import.waiting'
                  : item.status === 'queued'
                    ? 'com.affine.localmind.workspace-import.queued'
                    : item.status === 'running'
                      ? 'com.affine.localmind.workspace-import.processing'
                      : item.status === 'completed'
                        ? 'com.affine.localmind.workspace-import.completed'
                        : item.status === 'failed'
                          ? item.failureCode === 'project_operation_timeout'
                            ? 'com.affine.localmind.workspace-import.timeout'
                            : item.failureCode ===
                                'project_operation_permission_denied'
                              ? 'com.affine.localmind.workspace-import.permissionDenied'
                              : item.failureCode ===
                                  'project_operation_source_unavailable'
                                ? 'com.affine.localmind.workspace-import.sourceUnavailable'
                                : item.failureCode ===
                                    'project_operation_conflict'
                                  ? 'com.affine.localmind.workspace-import.conflict'
                                  : 'com.affine.localmind.workspace-import.failed'
                          : 'com.affine.localmind.workspace-import.cancelled'
              ]()}
            </span>
            {item.status === 'failed' ? (
              <Button
                disabled={!!pending}
                loading={pending === item.id}
                onClick={() => void retry(item.id)}
              >
                {t['com.affine.localmind.project-files.retry']()}
              </Button>
            ) : null}
            {item.status === 'completed' && item.resourceId ? (
              <Button
                onClick={() => {
                  if (item.resourceId) onOpen(item.resourceId);
                  setHistory(false);
                  setCursors([undefined]);
                }}
              >
                {t['com.affine.localmind.workspace-import.open']()}
              </Button>
            ) : null}
          </li>
        ))}
    </ul>
  );
  if (results.isLoading && !history) return null;
  if (results.error && !history)
    return (
      <div className={styles.state} role="alert">
        <span>{t['com.affine.localmind.workspace-import.statusFailed']()}</span>
        <Button onClick={() => void mutate().catch(() => {})}>
          {t['com.affine.localmind.project-files.retry']()}
        </Button>
      </div>
    );
  if (!items.length && !history) return null;
  return (
    <>
      {!history ? rows(false) : null}
      <Button onClick={() => setHistory(true)}>
        {t['com.affine.localmind.workspace-import.history']()}
      </Button>
      {history ? (
        <Modal
          open
          title={t['com.affine.localmind.workspace-import.history']()}
          onOpenChange={open => {
            setHistory(open);
            if (!open) setCursors([undefined]);
          }}
        >
          <div className={styles.form}>
            {results.isLoading ? (
              <Loading size={24} />
            ) : results.error ? (
              <div className={styles.state} role="alert">
                <span>
                  {t['com.affine.localmind.workspace-import.statusFailed']()}
                </span>
                <Button onClick={() => void mutate().catch(() => {})}>
                  {t['com.affine.localmind.project-files.retry']()}
                </Button>
              </div>
            ) : (
              rows(true)
            )}
            <p className={importStyles.help}>
              {t['com.affine.localmind.workspace-import.failureHint']()}
            </p>
            <div className={styles.actions}>
              <Button
                disabled={results.isLoading || cursors.length === 1}
                onClick={() => setCursors(values => values.slice(0, -1))}
              >
                {t['com.affine.localmind.documentCreation.previous']()}
              </Button>
              <Button
                disabled={
                  results.isLoading ||
                  !!results.error ||
                  !results.data?.projectWorkspaceImports.nextCursor
                }
                onClick={() =>
                  setCursors(values => [
                    ...values,
                    results.data?.projectWorkspaceImports.nextCursor ??
                      undefined,
                  ])
                }
              >
                {t['com.affine.localmind.workspace-import.next']()}
              </Button>
              <Button
                onClick={() => {
                  setHistory(false);
                  setCursors([undefined]);
                }}
              >
                {t['Close']()}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
