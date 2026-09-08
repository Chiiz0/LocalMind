import { Trans, useI18n } from '@affine/i18n';

import { ConfirmDialog } from '../../../components/shared/confirm-dialog';

export const EnableAccountDialog = ({
  open,
  email,
  onClose,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  email: string;
  onClose: () => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) => {
  const i18n = useI18n();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={i18n['com.affine.admin.enable-account']()}
      description={
        <Trans
          i18nKey="com.affine.admin.enable-account-description"
          values={{ email }}
          components={{ strong: <span className="font-bold" /> }}
        />
      }
      confirmText={i18n['com.affine.admin.enable']()}
      confirmButtonVariant="default"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
};
