import { Avatar, Button } from '@affine/component';
import {
  type Notification,
  NotificationListService,
} from '@affine/core/modules/notification';
import type { ProjectFileRequestNotificationBodyType } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import { useNavigate } from 'react-router-dom';

import { useFileRequestStatus } from '../project-file-request/detail';
import * as styles from './list.style.css';

export function ProjectFileRequestNotificationItem({
  notification,
}: {
  notification: Notification;
}) {
  const t = useI18n();
  const list = useService(NotificationListService);
  const statusLabel = useFileRequestStatus();
  const navigate = useNavigate();
  const body = notification.body as ProjectFileRequestNotificationBodyType;
  return (
    <div className={styles.itemContainer}>
      <Avatar
        size={22}
        name={body.createdByUser?.name}
        url={body.createdByUser?.avatarUrl}
      />
      <div className={styles.itemMain}>
        <strong>
          {body.title || t['com.affine.localmind.fileRequest.title']()}
        </strong>
        <div>
          {body.createdByUser?.name} · {body.projectName}
        </div>
        <div className={styles.itemDate}>{statusLabel(body.status)}</div>
        <Button
          disabled={body.status === 'unavailable'}
          onClick={() => {
            navigate(
              `/intelligence?fileRequest=${encodeURIComponent(body.requestId)}`
            );
            list.readNotification(notification.id).catch(console.error);
          }}
        >
          {t['com.affine.localmind.fileRequest.title']()}
        </Button>
      </div>
    </div>
  );
}
