import { Button, IconButton, Modal } from '@affine/component';
import { GraphQLService, ServerService } from '@affine/core/modules/cloud';
import {
  changeProjectFileRequestMutation,
  type ProjectFileRequestFieldsFragment,
  projectFileRequestQuery,
  submitProjectFileRequestMutation,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { DownloadIcon, ResetIcon, UploadIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useCallback, useEffect, useRef, useState } from 'react';

import * as styles from './styles.css';

export function useFileRequestStatus() {
  const t = useI18n();
  return (status: string) => {
    switch (status) {
      case 'pending':
        return t['com.affine.localmind.fileRequest.pending']();
      case 'in_progress':
        return t['com.affine.localmind.fileRequest.in_progress']();
      case 'completed':
        return t['com.affine.localmind.fileRequest.completed']();
      case 'declined':
        return t['com.affine.localmind.fileRequest.declined']();
      case 'cancelled':
        return t['com.affine.localmind.fileRequest.cancelled']();
      default:
        return t['com.affine.localmind.fileRequest.unavailable']();
    }
  };
}

export function ProjectFileRequestDetail({
  requestId,
  onChanged,
}: {
  requestId: string;
  onChanged?: () => unknown;
}) {
  const t = useI18n();
  const statusLabel = useFileRequestStatus();
  const graphql = useService(GraphQLService);
  const server = useService(ServerService);
  const [request, setRequest] =
    useState<ProjectFileRequestFieldsFragment | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [share, setShare] = useState(false);
  const [decision, setDecision] = useState<'decline' | 'cancel' | null>(null);
  const pending = useRef(false);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const result = await graphql.gql({
          query: projectFileRequestQuery,
          variables: { requestId },
          signal,
        });
        if (!signal?.aborted) {
          setRequest(result.projectFileRequest);
          setError('');
        }
      } catch {
        if (!signal?.aborted) {
          setRequest(null);
          setError(t['com.affine.localmind.fileRequest.unavailable']());
        }
      }
    },
    [graphql, requestId, t]
  );
  useEffect(() => {
    const controller = new AbortController();
    setRequest(null);
    setFile(null);
    setShare(false);
    setDecision(null);
    load(controller.signal).catch(console.error);
    const timer = setInterval(() => {
      if (!pending.current) load(controller.signal).catch(console.error);
    }, 15000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);
  const change = async (action: 'start' | 'decline' | 'cancel' | 'submit') => {
    if (!request || pending.current) return;
    if (action === 'submit' && (!file || !share)) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const variables = { requestId, expectedVersion: request.version };
      const updated =
        action === 'submit'
          ? (
              await graphql.gql({
                query: submitProjectFileRequestMutation,
                variables: {
                  ...variables,
                  shareWithProject: share,
                  file: file as File,
                },
              })
            ).submitProjectFileRequest
          : (
              await graphql.gql({
                query: changeProjectFileRequestMutation,
                variables: { ...variables, action },
              })
            ).changeProjectFileRequest;
      setRequest(updated);
      setDecision(null);
      setFile(null);
      setShare(false);
      await onChanged?.();
    } catch {
      setError(t['com.affine.localmind.fileRequest.failed']());
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const active = request && ['pending', 'in_progress'].includes(request.status);
  return (
    <div className={styles.body}>
      <div className={styles.actions}>
        <strong>
          {request?.title ?? t['com.affine.localmind.fileRequest.loading']()}
        </strong>
        <IconButton
          tooltip={t['com.affine.localmind.fileRequest.refresh']()}
          aria-label={t['com.affine.localmind.fileRequest.refresh']()}
          disabled={busy}
          onClick={() => void load()}
          icon={<ResetIcon />}
        />
      </div>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      {request ? (
        <>
          <div role="status">{statusLabel(request.status)}</div>
          <dl className={styles.metadata}>
            <dt>{t['com.affine.localmind.fileRequest.project']()}</dt>
            <dd>{request.projectName}</dd>
            <dt>{t['com.affine.localmind.fileRequest.requester']()}</dt>
            <dd>{request.requesterName}</dd>
            <dt>{t['com.affine.localmind.fileRequest.recipient']()}</dt>
            <dd>{request.recipientName}</dd>
          </dl>
          {active && request.isRecipient ? (
            <>
              <label className={styles.field}>
                {t['com.affine.localmind.fileRequest.choose']()}
                <input
                  className={styles.input}
                  type="file"
                  disabled={busy}
                  onChange={event => {
                    const selected = event.target.files?.[0] ?? null;
                    if (selected && selected.size > 32 * 1024 * 1024) {
                      setError(
                        t['com.affine.localmind.fileRequest.tooLarge']()
                      );
                      setFile(null);
                      event.target.value = '';
                    } else {
                      setFile(selected);
                      setError('');
                    }
                    setShare(false);
                  }}
                />
              </label>
              <label className={styles.confirmation}>
                <input
                  className={styles.checkbox}
                  type="checkbox"
                  checked={share}
                  disabled={busy || !file}
                  onChange={event => setShare(event.target.checked)}
                />
                {t['com.affine.localmind.fileRequest.share']({
                  project: request.projectName,
                })}
              </label>
              <div className={styles.actions}>
                <Button
                  variant="primary"
                  disabled={busy || !file || !share}
                  loading={busy}
                  onClick={() => void change('submit')}
                >
                  <UploadIcon />
                  {t['com.affine.localmind.fileRequest.submit']()}
                </Button>
                {request.status === 'pending' ? (
                  <Button disabled={busy} onClick={() => void change('start')}>
                    {t['com.affine.localmind.fileRequest.start']()}
                  </Button>
                ) : null}
                <Button disabled={busy} onClick={() => setDecision('decline')}>
                  {t['com.affine.localmind.fileRequest.decline']()}
                </Button>
              </div>
            </>
          ) : active ? (
            <Button disabled={busy} onClick={() => setDecision('cancel')}>
              {t['com.affine.localmind.fileRequest.cancel']()}
            </Button>
          ) : null}
          {request.status === 'completed' ? (
            <a
              href={`${server.server.serverMetadata.baseUrl}/api/project-file-requests/${encodeURIComponent(requestId)}/file`}
              download
            >
              <DownloadIcon />
              {t['com.affine.localmind.fileRequest.download']()}:{' '}
              {request.fileName}
            </a>
          ) : null}
          {decision ? (
            <div className={styles.actions} role="alert">
              <span>
                {decision === 'cancel'
                  ? t['com.affine.localmind.fileRequest.cancel']()
                  : t['com.affine.localmind.fileRequest.decline']()}
              </span>
              <Button
                variant="error"
                disabled={busy}
                onClick={() => void change(decision)}
              >
                {t['com.affine.localmind.fileRequest.confirm']()}
              </Button>
              <Button disabled={busy} onClick={() => setDecision(null)}>
                {t['com.affine.localmind.fileRequest.back']()}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function ProjectFileRequestModal({
  requestId,
  onClose,
  onChanged,
}: {
  requestId: string | null;
  onClose: () => void;
  onChanged?: () => unknown;
}) {
  const t = useI18n();
  return (
    <Modal
      width="min(560px, calc(100vw - 32px))"
      open={!!requestId}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      title={t['com.affine.localmind.fileRequest.title']()}
    >
      {requestId ? (
        <ProjectFileRequestDetail
          key={requestId}
          requestId={requestId}
          onChanged={onChanged}
        />
      ) : null}
    </Modal>
  );
}
