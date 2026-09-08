import { useI18n } from '@affine/i18n';

import { ConfirmDialog } from './confirm-dialog';

export const DiscardChanges = ({
  open,
  onClose,
  onConfirm,
  onOpenChange,
  description,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  description?: string;
}) => {
  const i18n = useI18n();
  if (description === undefined)
    description = i18n['com.affine.admin.changes-will-not-be-saved']();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={i18n['com.affine.admin.discard-changes']()}
      description={description}
      confirmText="Discard"
      confirmButtonVariant="destructive"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
};
