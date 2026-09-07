import {
  Button,
  IconButton,
  Menu,
  MenuItem,
  Modal,
  notify,
} from '@affine/component';
import {
  type Notification,
  NotificationListService,
} from '@affine/core/modules/notification';
import { UserFriendlyError } from '@affine/error';
import { useI18n } from '@affine/i18n';
import track from '@affine/track';
import {
  CheckBoxCheckLinearIcon,
  DeleteIcon,
  MoreHorizontalIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useState } from 'react';

import * as styles from './list.style.css';

const reportError = (error: unknown) =>
  notify.error(UserFriendlyError.fromAny(error));

export const NotificationCleanupActions = () => {
  const t = useI18n();
  const list = useService(NotificationListService);
  const busy = useLiveData(list.isMutating$);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <>
      <IconButton
        icon={<CheckBoxCheckLinearIcon />}
        disabled={busy}
        aria-label={t['com.affine.notification.mark-all-read']()}
        tooltip={t['com.affine.notification.mark-all-read']()}
        onClick={() => {
          list.readAllNotifications().catch(reportError);
        }}
      />
      <Menu
        items={
          <>
            <MenuItem
              prefixIcon={<DeleteIcon />}
              disabled={busy}
              onClick={() => {
                list.dismissReadNotifications().catch(reportError);
              }}
            >
              {t['com.affine.notification.delete-read']()}
            </MenuItem>
            <MenuItem
              prefixIcon={<DeleteIcon />}
              disabled={busy}
              onClick={() => setConfirmClear(true)}
            >
              {t['com.affine.notification.clear-all']()}
            </MenuItem>
          </>
        }
      >
        <IconButton
          icon={<MoreHorizontalIcon />}
          disabled={busy}
          aria-label={t['com.affine.notification.more-actions']()}
          tooltip={t['com.affine.notification.more-actions']()}
        />
      </Menu>
      <Modal
        width="min(480px, calc(100vw - 32px))"
        open={confirmClear}
        onOpenChange={open => {
          if (!busy) setConfirmClear(open);
        }}
        title={t['com.affine.notification.clear-all']()}
      >
        <div className={styles.accessDecision}>
          <p>{t['com.affine.notification.clear-all.confirmation']()}</p>
          <div className={styles.confirmActions}>
            <Button disabled={busy} onClick={() => setConfirmClear(false)}>
              {t['Cancel']()}
            </Button>
            <Button
              variant="error"
              loading={busy}
              disabled={busy}
              onClick={() => {
                list
                  .dismissAllNotifications()
                  .then(() => {
                    setConfirmClear(false);
                  })
                  .catch(reportError);
              }}
            >
              {t['com.affine.notification.clear-all']()}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export const NotificationItemActions = ({
  notification,
}: {
  notification: Notification;
}) => {
  const t = useI18n();
  const list = useService(NotificationListService);
  const busy = useLiveData(list.isMutating$);
  return (
    <div className={styles.itemActions}>
      {!notification.read && (
        <IconButton
          size={16}
          className={styles.itemCleanupButton}
          icon={<CheckBoxCheckLinearIcon />}
          disabled={busy}
          aria-label={t['com.affine.notification.mark-read']()}
          tooltip={t['com.affine.notification.mark-read']()}
          onClick={event => {
            event.stopPropagation();
            list.readNotification(notification.id).catch(reportError);
          }}
        />
      )}
      <IconButton
        size={16}
        className={styles.itemCleanupButton}
        icon={<DeleteIcon />}
        disabled={busy}
        aria-label={t['com.affine.notification.delete']()}
        tooltip={t['com.affine.notification.delete']()}
        onClick={event => {
          event.stopPropagation();
          track.$.sidebar.notifications.clickNotification({
            type: notification.type,
            item: 'dismiss',
          });
          list.dismissNotification(notification.id).catch(reportError);
        }}
      />
    </div>
  );
};
