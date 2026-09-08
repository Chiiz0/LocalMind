import {
  Avatar,
  Button,
  IconButton,
  Loading,
  Modal,
  Tooltip,
} from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import type { GraphQLService } from '@affine/core/modules/cloud';
import type { NbstoreService } from '@affine/core/modules/storage';
import {
  createOfficeCommentMutation,
  createOfficeCommentReplyMutation,
  deleteOfficeCommentMutation,
  deleteOfficeCommentReplyMutation,
  officeCollaboratorsQuery,
  type OfficeCommentsQuery,
  officeCommentsQuery,
  resolveOfficeCommentMutation,
  updateOfficeCommentMutation,
  updateOfficeCommentReplyMutation,
} from '@affine/graphql';
import { I18n, useI18n } from '@affine/i18n';
import { DeleteIcon } from '@blocksuite/icons/rc';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  isOfficeCommentContent,
  isOfficeCommentReplyContent,
  type OfficeCommentAnchor,
} from '../../../../modules/office';
import * as styles from './surface.css';

type OfficeComment = OfficeCommentsQuery['officeComments'][number];

function anchorLabel(anchor: OfficeCommentAnchor | null) {
  if (!anchor)
    return I18n['com.affine.office.select-content-to-anchor-this-comment']();
  switch (anchor.kind) {
    case 'document':
      return anchor.start.blockId === anchor.end.blockId
        ? I18n['com.affine.office.paragraph-range']({
            name: anchor.start.blockId,
            start: String(anchor.start.offset),
            end: String(anchor.end.offset),
          })
        : I18n['com.affine.office.selection-span']({
            start: anchor.start.blockId,
            end: anchor.end.blockId,
          });
    case 'workbook':
      return `${anchor.sheetId} · ${anchor.address}`;
    case 'presentation':
      return anchor.shapeId
        ? `${anchor.slideId} · ${anchor.shapeId}`
        : anchor.slideId;
    case 'pdf':
      return I18n['com.affine.office.page-number']({
        number: String(anchor.pageIndex + 1),
      });
  }
}

function commentText(comment: OfficeComment) {
  return isOfficeCommentContent(comment.content)
    ? comment.content.text
    : I18n['com.affine.office.unsupported-comment-content']();
}

export function OfficeCommentsPanel({
  open,
  workspaceId,
  artifactId,
  anchor,
  graphql,
  realtime,
  onOpenChange,
}: {
  open: boolean;
  workspaceId: string;
  artifactId: string;
  anchor: OfficeCommentAnchor | null;
  graphql: GraphQLService;
  realtime: NbstoreService['realtime'];
  onOpenChange: (open: boolean) => void;
}) {
  const i18n = useI18n();
  const commentsQuery = useQuery(
    {
      query: officeCommentsQuery,
      variables: { workspaceId, artifactId },
    },
    { suspense: false, shouldRetryOnError: false }
  );
  const collaboratorsQuery = useQuery(
    {
      query: officeCollaboratorsQuery,
      variables: { workspaceId, artifactId },
    },
    { suspense: false, shouldRetryOnError: false }
  );
  const [draft, setDraft] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{
    kind: 'comment' | 'reply';
    id: string;
    text: string;
  } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    await Promise.all([commentsQuery.mutate(), collaboratorsQuery.mutate()]);
  }, [collaboratorsQuery, commentsQuery]);

  useEffect(() => {
    if (!open) return;
    refresh().catch(console.error);
    const subscription = realtime
      .subscribe('comment.changed', { workspaceId, docId: artifactId })
      .subscribe({
        next: event => {
          if ('changed' in event) refresh().catch(console.error);
        },
        error: error => console.error('Office comment realtime failed', error),
      });
    const timer = window.setInterval(() => {
      refresh().catch(console.error);
    }, 30_000);
    return () => {
      subscription.unsubscribe();
      window.clearInterval(timer);
    };
  }, [artifactId, open, realtime, refresh, workspaceId]);

  const comments = useMemo(
    () =>
      [...(commentsQuery.data?.officeComments ?? [])].sort(
        (left, right) =>
          Number(left.resolved) - Number(right.resolved) ||
          new Date(left.createdAt).getTime() -
            new Date(right.createdAt).getTime()
      ),
    [commentsQuery.data?.officeComments]
  );

  const run = useCallback(
    async (key: string, action: () => Promise<unknown>) => {
      setPendingKey(key);
      setError(null);
      try {
        await action();
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPendingKey(null);
      }
    },
    [refresh]
  );

  const createComment = useCallback(async () => {
    const text = draft.trim();
    if (!anchor || !text) return;
    await run('create', async () => {
      await graphql.gql({
        query: createOfficeCommentMutation,
        variables: {
          input: {
            workspaceId,
            artifactId,
            content: {
              version: 'localmind-office-comment/v1',
              text,
              anchor,
            },
          },
        },
      });
      setDraft('');
    });
  }, [anchor, artifactId, draft, graphql, run, workspaceId]);

  return (
    <Modal
      open={open}
      title={i18n['com.affine.comment.comments']()}
      width={440}
      onOpenChange={onOpenChange}
    >
      <div className={styles.commentsPanel}>
        <div className={styles.collaborators}>
          <span>{i18n['com.affine.office.collaborators']()}</span>
          <div className={styles.collaboratorAvatars}>
            {collaboratorsQuery.data?.officeCollaborators.map(user => (
              <Tooltip content={user.name} key={user.id}>
                <Avatar name={user.name} url={user.avatarUrl} size={24} />
              </Tooltip>
            ))}
          </div>
        </div>

        <div className={styles.commentComposer}>
          <div className={styles.commentAnchor}>{anchorLabel(anchor)}</div>
          <textarea
            className={styles.textarea}
            value={draft}
            maxLength={64 * 1024}
            aria-label={i18n['com.affine.office.new-office-comment']()}
            placeholder={i18n['com.affine.office.add-a-comment']()}
            onChange={event => setDraft(event.target.value)}
          />
          <Button
            variant="primary"
            disabled={!anchor || !draft.trim()}
            loading={pendingKey === 'create'}
            onClick={() => void createComment()}
          >
            {i18n['com.affine.office.comment']()}{' '}
          </Button>
        </div>

        {error ? <div className={styles.commentError}>{error}</div> : null}
        <div className={styles.commentList}>
          {commentsQuery.isLoading && !comments.length ? (
            <div className={styles.commentEmpty}>
              <Loading />
              <span>{i18n['com.affine.office.loading-comments']()}</span>
            </div>
          ) : commentsQuery.error && !comments.length ? (
            <div className={styles.commentEmpty}>
              <span>{commentsQuery.error.message}</span>
              <Button
                onClick={() => {
                  refresh().catch(console.error);
                }}
              >
                {i18n['com.affine.localmind.directoryPermissions.retry']()}{' '}
              </Button>
            </div>
          ) : comments.length ? (
            comments.map(comment => {
              const content = isOfficeCommentContent(comment.content)
                ? comment.content
                : null;
              const isEditing =
                editing?.kind === 'comment' && editing.id === comment.id;
              const replyDraft = replyDrafts[comment.id] ?? '';
              return (
                <article
                  className={styles.commentItem}
                  data-resolved={comment.resolved}
                  key={comment.id}
                >
                  <header className={styles.commentHeader}>
                    <Avatar
                      name={comment.user.name}
                      url={comment.user.avatarUrl}
                      size={24}
                    />
                    <strong>{comment.user.name}</strong>
                    <time>{new Date(comment.createdAt).toLocaleString()}</time>
                  </header>
                  {isEditing ? (
                    <textarea
                      className={styles.textarea}
                      value={editing.text}
                      aria-label={i18n[
                        'com.affine.office.edit-office-comment'
                      ]()}
                      onChange={event =>
                        setEditing({ ...editing, text: event.target.value })
                      }
                    />
                  ) : (
                    <div className={styles.commentText}>
                      {commentText(comment)}
                    </div>
                  )}
                  <div className={styles.commentActions}>
                    {isEditing ? (
                      <>
                        <Button
                          variant="plain"
                          onClick={() => setEditing(null)}
                        >
                          {i18n['com.affine.localmind.aiContext.cancel']()}{' '}
                        </Button>
                        <Button
                          variant="primary"
                          disabled={!editing.text.trim() || !content}
                          loading={pendingKey === `edit:${comment.id}`}
                          onClick={() => {
                            run(`edit:${comment.id}`, async () => {
                              if (!content) return;
                              await graphql.gql({
                                query: updateOfficeCommentMutation,
                                variables: {
                                  input: {
                                    id: comment.id,
                                    content: {
                                      ...content,
                                      text: editing.text.trim(),
                                    },
                                  },
                                },
                              });
                              setEditing(null);
                            }).catch(console.error);
                          }}
                        >
                          {i18n['com.affine.localmind.aiContext.save']()}{' '}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="plain"
                          disabled={!content}
                          onClick={() =>
                            setEditing({
                              kind: 'comment',
                              id: comment.id,
                              text: content?.text ?? '',
                            })
                          }
                        >
                          {i18n[
                            'com.affine.collection-bar.action.tooltip.edit'
                          ]()}{' '}
                        </Button>
                        <Button
                          variant="plain"
                          loading={pendingKey === `resolve:${comment.id}`}
                          onClick={() => {
                            run(`resolve:${comment.id}`, () =>
                              graphql.gql({
                                query: resolveOfficeCommentMutation,
                                variables: {
                                  input: {
                                    id: comment.id,
                                    resolved: !comment.resolved,
                                  },
                                },
                              })
                            ).catch(console.error);
                          }}
                        >
                          {comment.resolved
                            ? i18n['com.affine.office.reopen']()
                            : i18n[
                                'com.affine.localmind.workbench.blocker.resolve'
                              ]()}
                        </Button>
                        <Tooltip content="Delete comment">
                          <IconButton
                            size="24"
                            aria-label={i18n[
                              'com.affine.office.delete-comment'
                            ]()}
                            loading={pendingKey === `delete:${comment.id}`}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  i18n[
                                    'com.affine.office.delete-this-comment-and-its-replies'
                                  ]()
                                )
                              )
                                return;
                              run(`delete:${comment.id}`, () =>
                                graphql.gql({
                                  query: deleteOfficeCommentMutation,
                                  variables: { id: comment.id },
                                })
                              ).catch(console.error);
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </div>

                  {comment.replies.map(reply => {
                    const replyContent = isOfficeCommentReplyContent(
                      reply.content
                    )
                      ? reply.content
                      : null;
                    const isEditingReply =
                      editing?.kind === 'reply' && editing.id === reply.id;
                    return (
                      <div className={styles.commentReply} key={reply.id}>
                        <header className={styles.commentHeader}>
                          <Avatar
                            name={reply.user.name}
                            url={reply.user.avatarUrl}
                            size={20}
                          />
                          <strong>{reply.user.name}</strong>
                          <time>
                            {new Date(reply.createdAt).toLocaleString()}
                          </time>
                        </header>
                        {isEditingReply ? (
                          <textarea
                            className={styles.textarea}
                            value={editing.text}
                            aria-label={i18n[
                              'com.affine.office.edit-office-comment-reply'
                            ]()}
                            onChange={event =>
                              setEditing({
                                ...editing,
                                text: event.target.value,
                              })
                            }
                          />
                        ) : (
                          <div className={styles.commentText}>
                            {replyContent?.text ??
                              i18n[
                                'com.affine.office.unsupported-reply-content'
                              ]()}
                          </div>
                        )}
                        <div className={styles.commentActions}>
                          {isEditingReply ? (
                            <>
                              <Button
                                variant="plain"
                                onClick={() => setEditing(null)}
                              >
                                {i18n[
                                  'com.affine.localmind.aiContext.cancel'
                                ]()}{' '}
                              </Button>
                              <Button
                                variant="primary"
                                disabled={!editing.text.trim() || !replyContent}
                                loading={
                                  pendingKey === `edit-reply:${reply.id}`
                                }
                                onClick={() => {
                                  run(`edit-reply:${reply.id}`, async () => {
                                    if (!replyContent) return;
                                    await graphql.gql({
                                      query: updateOfficeCommentReplyMutation,
                                      variables: {
                                        input: {
                                          id: reply.id,
                                          content: {
                                            ...replyContent,
                                            text: editing.text.trim(),
                                          },
                                        },
                                      },
                                    });
                                    setEditing(null);
                                  }).catch(console.error);
                                }}
                              >
                                {i18n[
                                  'com.affine.localmind.aiContext.save'
                                ]()}{' '}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="plain"
                                disabled={!replyContent}
                                onClick={() =>
                                  setEditing({
                                    kind: 'reply',
                                    id: reply.id,
                                    text: replyContent?.text ?? '',
                                  })
                                }
                              >
                                {i18n[
                                  'com.affine.collection-bar.action.tooltip.edit'
                                ]()}{' '}
                              </Button>
                              <Tooltip content="Delete reply">
                                <IconButton
                                  size="24"
                                  aria-label={i18n[
                                    'com.affine.office.delete-reply'
                                  ]()}
                                  loading={
                                    pendingKey === `delete-reply:${reply.id}`
                                  }
                                  onClick={() => {
                                    if (
                                      !window.confirm(
                                        i18n[
                                          'com.affine.comment.reply.delete.confirm.title'
                                        ]()
                                      )
                                    )
                                      return;
                                    run(`delete-reply:${reply.id}`, () =>
                                      graphql.gql({
                                        query: deleteOfficeCommentReplyMutation,
                                        variables: { id: reply.id },
                                      })
                                    ).catch(console.error);
                                  }}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div className={styles.replyComposer}>
                    <input
                      className={styles.field}
                      value={replyDraft}
                      aria-label={I18n['com.affine.office.reply-to']({
                        name: comment.user.name,
                      })}
                      placeholder={i18n['com.affine.comment.reply']()}
                      onChange={event =>
                        setReplyDrafts(current => ({
                          ...current,
                          [comment.id]: event.target.value,
                        }))
                      }
                      onKeyDown={event => {
                        if (event.key !== 'Enter' || !replyDraft.trim()) return;
                        event.preventDefault();
                        run(`reply:${comment.id}`, async () => {
                          await graphql.gql({
                            query: createOfficeCommentReplyMutation,
                            variables: {
                              input: {
                                commentId: comment.id,
                                content: {
                                  version: 'localmind-office-comment-reply/v1',
                                  text: replyDraft.trim(),
                                },
                              },
                            },
                          });
                          setReplyDrafts(current => ({
                            ...current,
                            [comment.id]: '',
                          }));
                        }).catch(console.error);
                      }}
                    />
                    <Button
                      disabled={!replyDraft.trim()}
                      loading={pendingKey === `reply:${comment.id}`}
                      onClick={() => {
                        run(`reply:${comment.id}`, async () => {
                          await graphql.gql({
                            query: createOfficeCommentReplyMutation,
                            variables: {
                              input: {
                                commentId: comment.id,
                                content: {
                                  version: 'localmind-office-comment-reply/v1',
                                  text: replyDraft.trim(),
                                },
                              },
                            },
                          });
                          setReplyDrafts(current => ({
                            ...current,
                            [comment.id]: '',
                          }));
                        }).catch(console.error);
                      }}
                    >
                      {i18n['com.affine.comment.reply']()}{' '}
                    </Button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className={styles.commentEmpty}>
              {i18n['com.affine.office.no-comments-yet']()}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
