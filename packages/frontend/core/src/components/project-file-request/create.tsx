import { Button, Input, Modal } from '@affine/component';
import { GraphQLService } from '@affine/core/modules/cloud';
import { UserFriendlyError } from '@affine/error';
import {
  createProjectFileRequestMutation,
  projectFileRequestRecipientsQuery,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import { useEffect, useRef, useState } from 'react';

import * as styles from './styles.css';

export function CreateProjectFileRequest({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const t = useI18n();
  const graphql = useService(GraphQLService);
  const [query, setQuery] = useState('');
  const [recipients, setRecipients] = useState<{ id: string; name: string }[]>(
    []
  );
  const [recipientId, setRecipientId] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const requestKey = useRef({ fingerprint: '', key: '' });
  useEffect(() => {
    const controller = new AbortController();
    setRecipients([]);
    setRecipientId('');
    setSearching(!!query.trim());
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      graphql
        .gql({
          query: projectFileRequestRecipientsQuery,
          variables: { projectId, query: query.trim() },
          signal: controller.signal,
        })
        .then(result => {
          if (!controller.signal.aborted) {
            setRecipients(result.projectFileRequestRecipients);
            setError('');
          }
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setError(t['com.affine.localmind.fileRequest.failed']());
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [graphql, projectId, query, t]);
  const submit = async () => {
    if (pending.current || !recipientId || !title.trim()) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const fingerprint = JSON.stringify([projectId, recipientId, title.trim()]);
    if (requestKey.current.fingerprint !== fingerprint)
      requestKey.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const result = await graphql.gql({
        query: createProjectFileRequestMutation,
        variables: {
          input: {
            projectId,
            recipientId,
            title: title.trim(),
            requestKey: requestKey.current.key,
          },
        },
      });
      onCreated(result.createProjectFileRequest.id);
    } catch (error) {
      setError(UserFriendlyError.fromAny(error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal
      width="min(560px, calc(100vw - 32px))"
      open
      onOpenChange={open => {
        if (!open && !busy) onClose();
      }}
      title={t['com.affine.localmind.fileRequest.request']()}
    >
      <form
        className={styles.body}
        onSubmit={event => {
          event.preventDefault();
          submit().catch(console.error);
        }}
      >
        <label className={styles.field}>
          {t['com.affine.localmind.fileRequest.search']()}
          <Input
            autoFocus
            value={query}
            onChange={setQuery}
            maxLength={128}
            disabled={busy}
          />
        </label>
        <label className={styles.field}>
          {t['com.affine.localmind.fileRequest.recipient']()}
          <select
            className={styles.input}
            value={recipientId}
            disabled={busy || searching}
            onChange={event => setRecipientId(event.target.value)}
            required
          >
            <option value="">
              {searching
                ? t['com.affine.localmind.fileRequest.loading']()
                : recipients.length
                  ? t['com.affine.localmind.fileRequest.recipient']()
                  : t['com.affine.localmind.fileRequest.noRecipients']()}
            </option>
            {recipients.map(recipient => (
              <option key={recipient.id} value={recipient.id}>
                {recipient.name} ({recipient.id.slice(0, 8)})
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          {t['com.affine.localmind.fileRequest.fileName']()}
          <Input
            value={title}
            onChange={setTitle}
            maxLength={256}
            disabled={busy}
            required
          />
        </label>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button
            onClick={() => void submit()}
            variant="primary"
            disabled={busy || !recipientId || !title.trim()}
            loading={busy}
          >
            {t['com.affine.localmind.fileRequest.request']()}
          </Button>
          <Button disabled={busy} onClick={onClose}>
            {t['Cancel']()}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
