import { Button } from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { getWorkspaceDocPath } from '@affine/core/desktop/route-paths';
import { GraphQLService } from '@affine/core/modules/cloud';
import { UserFriendlyError } from '@affine/error';
import {
  confirmCopilotDocumentDestinationMutation,
  copilotDocumentDestinationFoldersQuery,
  copilotDocumentDestinationWorkspacesQuery,
  type CopilotDocumentOperationFieldsFragment,
  copilotDocumentOperationsQuery,
  retryCopilotDocumentOperationMutation,
  withdrawCopilotDocumentOperationMutation,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import * as styles from './document-creation-panel.css';

type Operation = CopilotDocumentOperationFieldsFragment;
const ROOT = '$root';

function CreationRow({
  operation,
  refresh,
  onChanged,
}: {
  operation: Operation;
  refresh: () => Promise<unknown>;
  onChanged?: () => Promise<unknown>;
}) {
  const t = useI18n();
  const graphql = useService(GraphQLService);
  const [workspaceId, setWorkspaceId] = useState(
    operation.destinationWorkspaceId ?? ''
  );
  const [location, setLocation] = useState(
    operation.destinationWorkspaceId
      ? (operation.destinationFolderId ?? ROOT)
      : ''
  );
  const [cursor, setCursor] = useState<string | undefined>();
  const [previousFolders, setPreviousFolders] = useState<
    { id: string; name: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const cancelled = operation.status === 'cancelled';
  const expired =
    operation.status === 'expired' ||
    Date.parse(operation.locationExpiresAt) <= Date.now();
  const done = operation.status === 'complete' || cancelled;
  const workspaceQuery = useQuery(
    !done ? { query: copilotDocumentDestinationWorkspacesQuery } : undefined,
    { suspense: false }
  );
  const folderQuery = useQuery(
    !done && workspaceId
      ? {
          query: copilotDocumentDestinationFoldersQuery,
          variables: { workspaceId, after: cursor },
        }
      : undefined,
    { suspense: false }
  );
  const workspaces =
    workspaceQuery.data?.currentUser?.copilot.documentDestinationWorkspaces ??
    [];
  const page =
    folderQuery.data?.currentUser?.copilot.documentDestinationFolders;
  const folders = [...previousFolders, ...(page?.items ?? [])];
  const created = !!operation.createdDocumentAt;
  const destinationFixed =
    created || operation.status === 'running' || operation.status === 'failed';
  const status = cancelled
    ? t['com.affine.localmind.documentCreation.withdrawn']()
    : expired && !done
      ? t['com.affine.localmind.documentCreation.expired']()
      : created
        ? t['com.affine.localmind.documentCreation.created']()
        : operation.status === 'running'
          ? t['com.affine.localmind.documentCreation.running']()
          : operation.status === 'failed'
            ? t['com.affine.localmind.documentCreation.failed']()
            : t['com.affine.localmind.documentCreation.waiting']();
  const projectStatus = {
    pending: t['com.affine.localmind.documentCreation.addRequested'](),
    granted: t['com.affine.localmind.documentCreation.added'](),
    requested: t['com.affine.localmind.documentCreation.accessPending'](),
    failed: t['com.affine.localmind.documentCreation.addFailed'](),
    revoked: t['com.affine.localmind.documentCreation.revoked'](),
    rejected: t['com.affine.localmind.documentCreation.rejected'](),
    withdrawn: t['com.affine.localmind.documentCreation.withdrawn'](),
    expired: t['com.affine.localmind.documentCreation.expired'](),
  }[operation.projectStatus];

  const submit = async (action: 'confirm' | 'retry' | 'withdraw') => {
    if (
      pending.current ||
      (action === 'confirm' && (!workspaceId || !location))
    )
      return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (action !== 'confirm') {
        await graphql.gql({
          query:
            action === 'retry'
              ? retryCopilotDocumentOperationMutation
              : withdrawCopilotDocumentOperationMutation,
          variables: {
            operationId: operation.id,
            expectedRevision: operation.destinationRevision,
          },
        });
      } else {
        await graphql.gql({
          query: confirmCopilotDocumentDestinationMutation,
          variables: {
            input: {
              operationId: operation.id,
              workspaceId,
              root: location === ROOT,
              folderId: location === ROOT ? null : location,
              expectedRevision: operation.destinationRevision,
            },
          },
        });
      }
      await refresh().catch(console.error);
      await Promise.resolve(onChanged?.()).catch(console.error);
    } catch (caught) {
      setError(UserFriendlyError.fromAny(caught).message);
      await refresh().catch(console.error);
      // A failed later step can still have committed a real document.
      await Promise.resolve(onChanged?.()).catch(console.error);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <article className={styles.row} data-testid="document-creation-request">
      <div className={styles.summary}>
        {operation.kind === 'copy' ? (
          <span>{t['com.affine.localmind.documentCreation.copy']()}</span>
        ) : null}
        {created && operation.destinationWorkspaceId ? (
          <Link
            to={getWorkspaceDocPath(
              operation.destinationWorkspaceId,
              operation.documentId
            )}
          >
            {operation.title}
          </Link>
        ) : (
          <strong>{operation.title}</strong>
        )}
        <span aria-live="polite">{status}</span>
        {operation.kind === 'copy' &&
        operation.sourceWorkspaceId &&
        operation.sourceDocumentId ? (
          <Link
            to={getWorkspaceDocPath(
              operation.sourceWorkspaceId,
              operation.sourceDocumentId
            )}
          >
            {t['com.affine.localmind.documentCreation.source']()}
          </Link>
        ) : null}
        {created && !operation.placedDocumentAt ? (
          <span>
            {t['com.affine.localmind.documentCreation.placementPending']()}
          </span>
        ) : null}
        {projectStatus ? <span>{projectStatus}</span> : null}
      </div>
      {!done ? (
        <>
          <div className={styles.fields}>
            <label className={styles.field}>
              {t['com.affine.localmind.documentCreation.workspace']()}
              <select
                className={styles.select}
                aria-label={t[
                  'com.affine.localmind.documentCreation.workspace'
                ]()}
                value={workspaceId}
                disabled={busy || destinationFixed || workspaceQuery.isLoading}
                onChange={event => {
                  setWorkspaceId(event.target.value);
                  setLocation('');
                  setCursor(undefined);
                  setPreviousFolders([]);
                }}
              >
                <option value="">
                  {t['com.affine.localmind.documentCreation.chooseWorkspace']()}
                </option>
                {workspaces.map(workspace => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              {t['com.affine.localmind.documentCreation.location']()}
              <select
                className={styles.select}
                aria-label={t[
                  'com.affine.localmind.documentCreation.location'
                ]()}
                value={location}
                disabled={
                  busy ||
                  !workspaceId ||
                  folderQuery.isLoading ||
                  destinationFixed
                }
                onChange={event => setLocation(event.target.value)}
              >
                <option value="">
                  {t['com.affine.localmind.documentCreation.chooseLocation']()}
                </option>
                <option value={ROOT}>
                  {t['com.affine.localmind.documentCreation.root']()}
                </option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {workspaceQuery.isLoading || folderQuery.isLoading ? (
            <span>{t['com.affine.localmind.documentCreation.loading']()}</span>
          ) : null}
          {!workspaceQuery.isLoading &&
          !workspaceQuery.error &&
          !workspaces.length ? (
            <span>
              {t['com.affine.localmind.documentCreation.noWorkspaces']()}
            </span>
          ) : null}
          {workspaceQuery.error || folderQuery.error ? (
            <span role="alert">
              {t['com.affine.localmind.documentCreation.loadFailed']()}
            </span>
          ) : null}
          <div className={styles.actions}>
            {page?.nextCursor ? (
              <Button
                disabled={busy || folderQuery.isLoading}
                onClick={() => {
                  setPreviousFolders(folders);
                  setCursor(page.nextCursor ?? undefined);
                }}
              >
                {t['com.affine.localmind.documentCreation.more']()}
              </Button>
            ) : null}
            <Button
              disabled={
                busy ||
                !workspaceId ||
                !location ||
                !!workspaceQuery.error ||
                !!folderQuery.error ||
                folderQuery.isLoading
              }
              onClick={() => {
                submit('confirm').catch(console.error);
              }}
            >
              {created
                ? t['com.affine.localmind.documentCreation.reconfirm']()
                : t['com.affine.localmind.documentCreation.confirm']()}
            </Button>
            {operation.destinationWorkspaceId && !expired ? (
              <Button
                disabled={busy}
                onClick={() => {
                  submit('retry').catch(console.error);
                }}
              >
                {t['com.affine.localmind.documentCreation.retry']()}
              </Button>
            ) : null}
            <Button
              disabled={busy}
              onClick={() => {
                submit('withdraw').catch(console.error);
              }}
            >
              {t['com.affine.localmind.workbench.action.withdrawRequest']()}
            </Button>
          </div>
        </>
      ) : null}
      {error ? <div role="alert">{error}</div> : null}
    </article>
  );
}

function SessionDocumentCreationPanel({
  sessionId,
  onChanged,
}: {
  sessionId?: string | null;
  onChanged?: () => Promise<unknown>;
}) {
  const t = useI18n();
  const [cursors, setCursors] = useState<string[]>([]);
  const after = cursors.at(-1);
  const query = useQuery(
    sessionId
      ? {
          query: copilotDocumentOperationsQuery,
          variables: { sessionId, after },
        }
      : undefined,
    { suspense: false, refreshInterval: 3000, shouldRetryOnError: false }
  );
  if (!sessionId) return null;
  const operations = query.data?.currentUser?.copilot.documentOperations ?? [];
  if (query.error)
    return (
      <div role="alert" className={styles.panel}>
        {t['com.affine.localmind.documentCreation.loadFailed']()}{' '}
        <Button
          onClick={() => {
            query.mutate().catch(console.error);
          }}
        >
          {t['com.affine.localmind.documentCreation.retry']()}
        </Button>
      </div>
    );
  if (!operations.length && !cursors.length) return null;
  return (
    <div className={styles.panel}>
      {operations.map(operation => (
        <CreationRow
          key={`${operation.id}:${operation.destinationRevision}`}
          operation={operation}
          refresh={query.mutate}
          onChanged={onChanged}
        />
      ))}
      <div className={styles.actions}>
        {cursors.length ? (
          <Button
            disabled={query.isLoading}
            onClick={() => setCursors(value => value.slice(0, -1))}
          >
            {t['com.affine.localmind.documentCreation.previous']()}
          </Button>
        ) : null}
        {operations.length === 20 ? (
          <Button
            disabled={query.isLoading}
            onClick={() =>
              setCursors(value => [
                ...value,
                operations[operations.length - 1].id,
              ])
            }
          >
            {t['com.affine.localmind.documentCreation.more']()}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function DocumentCreationPanel(props: {
  sessionId?: string | null;
  onChanged?: () => Promise<unknown>;
}) {
  return <SessionDocumentCreationPanel key={props.sessionId} {...props} />;
}
