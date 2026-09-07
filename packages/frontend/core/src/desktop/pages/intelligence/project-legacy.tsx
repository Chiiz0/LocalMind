import { Button, IconButton, Loading, Modal } from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { GraphQLService } from '@affine/core/modules/cloud';
import {
  changeProjectLegacyOperationMutation,
  projectLegacyConversationsQuery,
  projectLegacyMessagesQuery,
  projectLegacyOperationsQuery,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { ResetIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useRef, useState } from 'react';

import { projectFilesChanged } from './project-files-data';
import * as styles from './project-publications.css';

type Props = {
  projectId: string;
  onOpen: (resourceId: string) => void;
};

export function ProjectLegacy(props: Props) {
  return <LegacyList key={props.projectId} {...props} />;
}

function LegacyList({ projectId, onOpen }: Props) {
  const t = useI18n();
  const graphql = useService(GraphQLService);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<string>();
  const [chatCursor, setChatCursor] = useState<string>();
  const [sessionId, setSessionId] = useState<string>();
  const [messageCursor, setMessageCursor] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const submitting = useRef(false);
  const operations = useQuery(
    open
      ? {
          query: projectLegacyOperationsQuery,
          variables: { projectId, cursor },
        }
      : undefined,
    { suspense: false, shouldRetryOnError: false }
  );
  const chats = useQuery(
    open
      ? {
          query: projectLegacyConversationsQuery,
          variables: { projectId, cursor: chatCursor },
        }
      : undefined,
    { suspense: false, shouldRetryOnError: false }
  );
  const messages = useQuery(
    sessionId
      ? {
          query: projectLegacyMessagesQuery,
          variables: { projectId, sessionId, cursor: messageCursor },
        }
      : undefined,
    { suspense: false, shouldRetryOnError: false }
  );
  const change = async (
    operationId: string,
    expectedRevision: number,
    action: 'recover' | 'cancel'
  ) => {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(undefined);
    try {
      const result = await graphql.gql({
        query: changeProjectLegacyOperationMutation,
        variables: { projectId, operationId, expectedRevision, action },
      });
      if (result.changeProjectLegacyOperation.resourceId)
        projectFilesChanged(projectId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      await operations.mutate().catch(caught => setError(String(caught)));
      submitting.current = false;
      setPending(false);
    }
  };
  const status = (value: string) => {
    switch (value) {
      case 'complete':
        return t['com.affine.localmind.migrations.complete']();
      case 'cancelled':
        return t['com.affine.localmind.migrations.cancelled']();
      case 'external_result':
        return t['com.affine.localmind.legacy.external']();
      case 'blocked':
        return t['com.affine.localmind.legacy.blocked']();
      default:
        return t['com.affine.localmind.legacy.pending']();
    }
  };
  return (
    <details
      className={styles.panel}
      onToggle={event => setOpen(event.currentTarget.open)}
    >
      <summary className={styles.header}>
        {t['com.affine.localmind.legacy.title']()}
      </summary>
      {open ? (
        <>
          <div className={styles.header}>
            <IconButton
              size="20"
              icon={<ResetIcon />}
              disabled={pending}
              aria-label={t['com.affine.localmind.project-files.reload']()}
              tooltip={t['com.affine.localmind.project-files.reload']()}
              onClick={() => {
                void operations
                  .mutate()
                  .catch(caught => setError(String(caught)));
                void chats.mutate().catch(caught => setError(String(caught)));
              }}
            />
            {pending || operations.isLoading || chats.isLoading ? (
              <Loading size={16} />
            ) : null}
          </div>
          {error || operations.error || chats.error ? (
            <p role="alert" className={styles.error}>
              {error ?? operations.error?.message ?? chats.error?.message}
            </p>
          ) : null}
          {!operations.isLoading &&
          !operations.error &&
          !operations.data?.projectLegacyOperations.items.length ? (
            <p className={styles.meta}>
              {t['com.affine.localmind.legacy.empty']()}
            </p>
          ) : null}
          <ul className={styles.rows}>
            {!operations.error &&
              operations.data?.projectLegacyOperations.items.map(row => (
                <li key={row.id} className={styles.row}>
                  <div className={styles.title}>
                    {row.title}
                    <div className={styles.meta}>
                      {new Date(row.createdAt).toLocaleString()} /{' '}
                      {row.id.slice(0, 8)}
                    </div>
                    <div className={styles.meta}>{status(row.status)}</div>
                    <div className={styles.footer}>
                      {row.resourceId ? (
                        <Button
                          onClick={() =>
                            row.resourceId && onOpen(row.resourceId)
                          }
                        >
                          {t['com.affine.localmind.project-files.open']()}
                        </Button>
                      ) : null}
                      {!['complete', 'external_result'].includes(row.status) ? (
                        <Button
                          disabled={pending}
                          onClick={() =>
                            void change(row.id, row.revision, 'recover')
                          }
                        >
                          {t['com.affine.localmind.legacy.recover']()}
                        </Button>
                      ) : null}
                      {['complete', 'external_result', 'cancelled'].includes(
                        row.status
                      ) ? null : (
                        <Button
                          disabled={pending}
                          onClick={() =>
                            void change(row.id, row.revision, 'cancel')
                          }
                        >
                          {t['com.affine.localmind.project-files.cancel']()}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
          </ul>
          <div className={styles.footer}>
            {cursor ? (
              <Button onClick={() => setCursor(undefined)}>
                {t['com.affine.localmind.project-tasks.latest']()}
              </Button>
            ) : null}
            {operations.data?.projectLegacyOperations.nextCursor ? (
              <Button
                onClick={() =>
                  setCursor(
                    operations.data?.projectLegacyOperations.nextCursor ??
                      undefined
                  )
                }
              >
                {t['com.affine.localmind.project-files.more']()}
              </Button>
            ) : null}
          </div>
          <div className={styles.header}>
            {t['com.affine.localmind.legacy.conversations']()}
          </div>
          {!chats.isLoading &&
          !chats.error &&
          !chats.data?.projectLegacyConversations.items.length ? (
            <p className={styles.meta}>
              {t['com.affine.localmind.legacy.emptyConversations']()}
            </p>
          ) : null}
          <ul className={styles.rows}>
            {!chats.error &&
              chats.data?.projectLegacyConversations.items.map(row => (
                <li className={styles.row} key={row.id}>
                  <button
                    type="button"
                    className={styles.choice}
                    onClick={() => {
                      setSessionId(row.id);
                      setMessageCursor(undefined);
                    }}
                  >
                    <span className={styles.title}>
                      {row.title ??
                        t['com.affine.localmind.legacy.conversations']()}
                      <span className={styles.meta}>
                        {' '}
                        / {new Date(row.createdAt).toLocaleString()}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
          <div className={styles.footer}>
            {chatCursor ? (
              <Button onClick={() => setChatCursor(undefined)}>
                {t['com.affine.localmind.project-tasks.latest']()}
              </Button>
            ) : null}
            {chats.data?.projectLegacyConversations.nextCursor ? (
              <Button
                onClick={() =>
                  setChatCursor(
                    chats.data?.projectLegacyConversations.nextCursor ??
                      undefined
                  )
                }
              >
                {t['com.affine.localmind.project-files.more']()}
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
      <Modal
        open={!!sessionId}
        onOpenChange={value => {
          if (!value) setSessionId(undefined);
        }}
        title={t['com.affine.localmind.legacy.conversations']()}
        contentOptions={{ className: styles.dialog }}
      >
        <div className={styles.form}>
          {messages.isLoading ? <Loading size={20} /> : null}
          {messages.error ? (
            <p role="alert" className={styles.error}>
              {messages.error.message}
            </p>
          ) : (
            messages.data?.projectLegacyMessages.items.map(message => (
              <div key={message.id}>
                <div className={styles.meta}>
                  {message.role} /{' '}
                  {new Date(message.createdAt).toLocaleString()}
                </div>
                <pre className={styles.excerpt}>{message.content}</pre>
                {message.truncated ? (
                  <p className={styles.meta}>
                    {t['com.affine.localmind.legacy.truncated']()}
                  </p>
                ) : null}
              </div>
            ))
          )}
          <div className={styles.footer}>
            {messageCursor ? (
              <Button onClick={() => setMessageCursor(undefined)}>
                {t['com.affine.localmind.project-tasks.latest']()}
              </Button>
            ) : null}
            {messages.data?.projectLegacyMessages.nextCursor ? (
              <Button
                onClick={() =>
                  setMessageCursor(
                    messages.data?.projectLegacyMessages.nextCursor ?? undefined
                  )
                }
              >
                {t['com.affine.localmind.project-files.more']()}
              </Button>
            ) : null}
            <Button onClick={() => setSessionId(undefined)}>
              {t['com.affine.localmind.project-files.close']()}
            </Button>
          </div>
        </div>
      </Modal>
    </details>
  );
}
