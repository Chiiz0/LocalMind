import {
  Button,
  IconButton,
  Loading,
  Modal,
  useConfirmModal,
} from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { GraphQLService } from '@affine/core/modules/cloud';
import { useProjectUnsavedConfirmation } from '@affine/core/modules/project-resources/edit-guard';
import { projectEditLeaseStore } from '@affine/core/modules/project-resources/edit-lease-store';
import { projectErrorMessage } from '@affine/core/modules/project-resources/error';
import {
  type ProjectResourceSourcesQuery,
  projectResourceSourcesQuery,
  refreshProjectResourceSourceMutation,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { ResetIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useRef, useState } from 'react';

import * as styles from './project-publications.css';

type Source = ProjectResourceSourcesQuery['projectResourceSources'][number];

export function ProjectSourceRefresh({
  projectId,
  resourceId,
  onRefreshed,
}: {
  projectId: string;
  resourceId: string;
  onRefreshed: () => void;
}) {
  const t = useI18n();
  const graphql = useService(GraphQLService);
  const { openConfirmModal } = useConfirmModal();
  const confirmUnsaved = useProjectUnsavedConfirmation();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<{
    source: Source;
    requestKey: string;
  }>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const submitting = useRef(false);
  const query = useQuery(
    open
      ? {
          query: projectResourceSourcesQuery,
          variables: { projectId, resourceId },
        }
      : undefined,
    { suspense: false, shouldRetryOnError: false }
  );
  const refresh = async () => {
    if (!selection || submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(undefined);
    try {
      const source = selection.source;
      await projectEditLeaseStore(graphql, projectId, resourceId).withProof(
        editLease =>
          graphql.gql({
            query: refreshProjectResourceSourceMutation,
            variables: {
              projectId,
              resourceId,
              workspaceId: source.workspaceId,
              sourceResourceId: source.sourceResourceId,
              expectedContentVersion: source.projectVersion,
              expectedSourceVersion: source.sourceVersion,
              requestKey: selection.requestKey,
              editLease,
            },
          })
      );
      onRefreshed();
      setOpen(false);
      setSelection(undefined);
    } catch (caught) {
      setError(projectErrorMessage(caught));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };
  return (
    <>
      <IconButton
        size="20"
        icon={<ResetIcon />}
        tooltip={t['com.affine.localmind.source-refresh.title']()}
        aria-label={t['com.affine.localmind.source-refresh.title']()}
        onClick={() => {
          setOpen(true);
          setSelection(undefined);
          setError(undefined);
        }}
      />
      <Modal
        open={open}
        onOpenChange={value => {
          if (!pending) setOpen(value);
        }}
        title={t['com.affine.localmind.source-refresh.title']()}
        contentOptions={{ className: styles.dialog }}
      >
        <div className={styles.form}>
          {query.isLoading ? <Loading size={20} /> : null}
          {query.error || error ? (
            <p role="alert" className={styles.error}>
              {error ?? projectErrorMessage(query.error)}
            </p>
          ) : null}
          {!query.isLoading &&
          !query.error &&
          !query.data?.projectResourceSources.length ? (
            <p className={styles.meta}>
              {t['com.affine.localmind.source-refresh.empty']()}
            </p>
          ) : null}
          <div className={styles.browser}>
            {!query.error &&
              query.data?.projectResourceSources.map(source => (
                <label
                  key={`${source.workspaceId}:${source.sourceResourceId}`}
                  className={styles.choice}
                >
                  <input
                    type="radio"
                    name="project-resource-source"
                    disabled={pending}
                    checked={
                      selection?.source.workspaceId === source.workspaceId &&
                      selection.source.sourceResourceId ===
                        source.sourceResourceId
                    }
                    onChange={() =>
                      setSelection({ source, requestKey: crypto.randomUUID() })
                    }
                  />
                  <span className={styles.title}>
                    {source.title}
                    <span className={styles.meta}>
                      {' '}
                      / {source.workspaceName}
                    </span>
                  </span>
                </label>
              ))}
          </div>
          {selection ? (
            <p className={styles.meta}>
              {t['com.affine.localmind.source-refresh.confirm']({
                title: selection.source.title,
                version: String(selection.source.projectVersion),
              })}
            </p>
          ) : null}
          <div className={styles.footer}>
            <IconButton
              size="20"
              icon={<ResetIcon />}
              disabled={pending}
              tooltip={t['com.affine.localmind.project-files.reload']()}
              aria-label={t['com.affine.localmind.project-files.reload']()}
              onClick={() => {
                setSelection(undefined);
                setError(undefined);
                void query
                  .mutate()
                  .catch(caught => setError(projectErrorMessage(caught)));
              }}
            />
            <Button disabled={pending} onClick={() => setOpen(false)}>
              {t['com.affine.localmind.project-files.cancel']()}
            </Button>
            <Button
              disabled={pending || !selection || !!query.error}
              loading={pending}
              onClick={() => {
                if (!selection || pending) return;
                openConfirmModal({
                  title: t['com.affine.localmind.source-refresh.title'](),
                  description: t['com.affine.localmind.source-refresh.confirm'](
                    {
                      title: selection.source.title,
                      version: String(selection.source.projectVersion),
                    }
                  ),
                  confirmText: t['com.affine.localmind.source-refresh.apply'](),
                  cancelText: t['Cancel'](),
                  confirmButtonOptions: { variant: 'error' },
                  onConfirm: async () => {
                    if (await confirmUnsaved()) await refresh();
                  },
                });
              }}
            >
              {t['com.affine.localmind.source-refresh.apply']()}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
