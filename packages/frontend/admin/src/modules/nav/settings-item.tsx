import { useI18n } from '@affine/i18n';
import { ROUTES } from '@affine/routes';
import { SettingsIcon } from '@blocksuite/icons/rc';

import { NavItem } from './nav-item';

export const SettingsItem = ({ isCollapsed }: { isCollapsed: boolean }) => {
  const i18n = useI18n();
  return (
    <NavItem
      to={ROUTES.admin.settings.index}
      icon={<SettingsIcon fontSize={20} />}
      label={i18n['com.affine.settingSidebar.title']()}
      isCollapsed={isCollapsed}
    />
  );
};
