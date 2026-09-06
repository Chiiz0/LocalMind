import { Input, useConfirmModal } from '@affine/component';
import { useI18n } from '@affine/i18n';
import { useCallback } from 'react';

import type { WorkbenchPanelTaskAction, WorkbenchTask } from './types';
import type { AccessRequestConfirmation } from './workbench-task-action';

export function useAccessRequestConfirmation() {
  const { openConfirmModal } = useConfirmModal();
  const t = useI18n();
  return useCallback(
    (task: WorkbenchTask, action: WorkbenchPanelTaskAction) =>
      new Promise<AccessRequestConfirmation | null>(resolve => {
        if (
          task.kind !== 'access_request' ||
          (action !== 'approve_access_request' &&
            action !== 'reject_access_request')
        ) {
          resolve(null);
          return;
        }
        const approving = action === 'approve_access_request';
        const label = approving
          ? t['com.affine.localmind.accessNotification.approve']()
          : t['com.affine.localmind.accessNotification.reject']();
        const level =
          task.requestedLevel === 'write'
            ? t['com.affine.localmind.accessNotification.write']()
            : t['com.affine.localmind.accessNotification.read']();
        let reason = '';
        openConfirmModal({
          title: label,
          description: approving
            ? task.projectId
              ? t[
                  'com.affine.localmind.accessNotification.projectConfirmation'
                ]({ project: task.projectId, level })
              : t[
                  'com.affine.localmind.accessNotification.personalConfirmation'
                ]({ level })
            : (task.title ?? label),
          children: (
            <>
              <p>{task.documentId}</p>
              {!approving ? (
                <Input
                  maxLength={1000}
                  aria-label={t[
                    'com.affine.localmind.accessNotification.reason'
                  ]()}
                  placeholder={t[
                    'com.affine.localmind.accessNotification.reason'
                  ]()}
                  onChange={value => {
                    reason = value;
                  }}
                />
              ) : null}
            </>
          ),
          confirmText: label,
          cancelText: t['Cancel'](),
          autoFocusConfirm: false,
          confirmButtonOptions: { variant: approving ? 'primary' : 'error' },
          onConfirm: () =>
            resolve({
              requestId: task.entityId,
              action,
              reason: reason.trim() || undefined,
            }),
          onCancel: () => resolve(null),
          onOpenChange: open => {
            if (!open) resolve(null);
          },
        });
      }),
    [openConfirmModal, t]
  );
}
