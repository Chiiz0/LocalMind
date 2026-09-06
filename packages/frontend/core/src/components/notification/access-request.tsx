import { Avatar, Button, Input, Modal, notify } from '@affine/component';
import { GraphQLService } from '@affine/core/modules/cloud';
import {
  type Notification,
  NotificationListService,
} from '@affine/core/modules/notification';
import { UserFriendlyError } from '@affine/error';
import {
  type AccessRequestNotificationBodyType,
  approveCopilotAccessRequestMutation,
  rejectCopilotAccessRequestMutation,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import { useRef, useState } from 'react';

import * as styles from './list.style.css';

export const AccessRequestNotificationItem = ({
  notification,
}: {
  notification: Notification;
}) => {
  const t = useI18n();
  const graphql = useService(GraphQLService);
  const list = useService(NotificationListService);
  const body = notification.body as AccessRequestNotificationBodyType;
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [status, setStatus] = useState<string | null>(null);
  const labels = {
    approve: t['com.affine.localmind.accessNotification.approve'](),
    reject: t['com.affine.localmind.accessNotification.reject'](),
  };
  const level =
    body.requestedLevel === 'write'
      ? t['com.affine.localmind.accessNotification.write']()
      : t['com.affine.localmind.accessNotification.read']();
  const currentStatus = status ?? body.status;
  const statusLabel =
    {
      pending: t['com.affine.localmind.accessNotification.pending'](),
      approved: t['com.affine.localmind.accessNotification.approved'](),
      rejected: t['com.affine.localmind.accessNotification.rejected'](),
      withdrawn: t['com.affine.localmind.accessNotification.withdrawn'](),
      expired: t['com.affine.localmind.accessNotification.expired'](),
    }[currentStatus] ??
    t['com.affine.localmind.accessNotification.unavailable']();

  const confirm = async () => {
    if (
      !decision ||
      pending.current ||
      !body.canDecide ||
      currentStatus !== 'pending'
    )
      return;
    pending.current = true;
    setBusy(true);
    try {
      const input = {
        requestId: body.requestId,
        reason: decision === 'reject' ? reason.trim() || undefined : undefined,
      };
      const result =
        decision === 'approve'
          ? (
              await graphql.gql({
                query: approveCopilotAccessRequestMutation,
                variables: { input },
              })
            ).approveCopilotAccessRequest
          : (
              await graphql.gql({
                query: rejectCopilotAccessRequestMutation,
                variables: { input },
              })
            ).rejectCopilotAccessRequest;
      setStatus(result.status);
      setDecision(null);
      list.reset();
      list.loadMore();
    } catch (error) {
      notify.error(UserFriendlyError.fromAny(error));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.itemContainer}>
        <Avatar
          size={22}
          name={body.createdByUser?.name}
          url={body.createdByUser?.avatarUrl}
        />
        <div className={styles.accessRequestMain}>
          <div>
            {body.createdByUser?.name ?? t['com.affine.inactive-member']()}
          </div>
          <div>
            {body.projectName ??
              t['com.affine.localmind.accessNotification.personal']()}
          </div>
          <div>
            {body.workspace?.name} /{' '}
            {body.docTitle ??
              body.docId ??
              t['com.affine.localmind.accessNotification.unavailable']()}
          </div>
          <div aria-live="polite">
            {level} · {statusLabel}
          </div>
          {body.resolutionReason ? <div>{body.resolutionReason}</div> : null}
          {body.canDecide && currentStatus === 'pending' ? (
            <div className={styles.headerActions}>
              <Button disabled={busy} onClick={() => setDecision('approve')}>
                {labels.approve}
              </Button>
              <Button disabled={busy} onClick={() => setDecision('reject')}>
                {labels.reject}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      <Modal
        open={!!decision}
        onOpenChange={open => {
          if (!open && !busy) setDecision(null);
        }}
        title={decision ? labels[decision] : ''}
      >
        <div className={styles.accessDecision}>
          {decision === 'approve' ? (
            <p>
              {body.projectId
                ? t[
                    'com.affine.localmind.accessNotification.projectConfirmation'
                  ]({ project: body.projectName ?? body.projectId, level })
                : t[
                    'com.affine.localmind.accessNotification.personalConfirmation'
                  ]({ level })}
            </p>
          ) : null}
          <p>{body.docTitle ?? body.docId}</p>
          {decision === 'reject' ? (
            <Input
              value={reason}
              onChange={setReason}
              maxLength={1000}
              aria-label={t['com.affine.localmind.accessNotification.reason']()}
              placeholder={t[
                'com.affine.localmind.accessNotification.reason'
              ]()}
              disabled={busy}
            />
          ) : null}
          <div className={styles.headerActions}>
            <Button disabled={busy} onClick={() => setDecision(null)}>
              {t['Cancel']()}
            </Button>
            <Button
              disabled={busy || !body.canDecide || currentStatus !== 'pending'}
              onClick={() => {
                confirm().catch(console.error);
              }}
            >
              {decision ? labels[decision] : ''}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
