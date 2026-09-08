import { Trans, useI18n } from '@affine/i18n';

import { TypeConfirmDialog } from '../../../components/shared/type-confirm-dialog';

export const DeleteAccountDialog = ({
  email,
  open,
  onClose,
  onDelete,
  onOpenChange,
}: {
  email: string;
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  onOpenChange: (open: boolean) => void;
}) => {
  const i18n = useI18n();
  return (
    <TypeConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={i18n['com.affine.admin.delete-account']()}
      description={
        <Trans
          i18nKey="com.affine.admin.delete-account-description"
          values={{ email }}
          components={{ strong: <span className="font-bold" /> }}
        />
      }
      targetText={email}
      inputPlaceholder={i18n['com.affine.admin.please-type-email-to-confirm']()}
      confirmText={i18n['com.affine.localmind.aiContext.delete']()}
      confirmButtonVariant="destructive"
      onConfirm={onDelete}
      onClose={onClose}
    />
  );
};
