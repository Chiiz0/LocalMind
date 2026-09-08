import { cn } from '@affine/admin/utils';
import { useI18n } from '@affine/i18n';
import { ROUTES } from '@affine/routes';
import { AccountIcon, SelfhostIcon } from '@blocksuite/icons/rc';
import {
  BarChart3Icon,
  BotIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
} from 'lucide-react';

import { AdminLanguageSelect } from '../../i18n';
import { NavItem } from './nav-item';
import { ServerVersion } from './server-version';
import { SettingsItem } from './settings-item';
import { UserDropdown } from './user-dropdown';

interface NavProps {
  isCollapsed?: boolean;
}

export function Nav({ isCollapsed = false }: NavProps) {
  const i18n = useI18n();
  return (
    <div
      className={cn(
        'flex h-full flex-grow flex-col justify-between gap-4 py-2',
        isCollapsed && 'overflow-visible'
      )}
    >
      <nav
        className={cn(
          'flex flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto px-2',
          isCollapsed && 'items-center px-0 gap-1 overflow-visible'
        )}
      >
        <NavItem
          to={ROUTES.admin.dashboard}
          icon={<BarChart3Icon size={18} />}
          label={i18n['com.affine.admin.dashboard']()}
          isCollapsed={isCollapsed}
        />
        <NavItem
          to={ROUTES.admin.accounts}
          icon={<AccountIcon fontSize={20} />}
          label={i18n['com.affine.admin.accounts']()}
          isCollapsed={isCollapsed}
        />
        {environment.isSelfHosted ? null : (
          <NavItem
            to={ROUTES.admin.workspaces}
            icon={<LayoutDashboardIcon size={18} />}
            label={i18n['com.affine.admin.workspaces']()}
            isCollapsed={isCollapsed}
          />
        )}
        <NavItem
          to={ROUTES.admin.queue}
          icon={<ListChecksIcon size={18} />}
          label={i18n['com.affine.admin.queue']()}
          isCollapsed={isCollapsed}
        />
        <NavItem
          to={ROUTES.admin.ai}
          icon={<BotIcon size={18} />}
          label="AI"
          isCollapsed={isCollapsed}
        />
        <SettingsItem isCollapsed={isCollapsed} />
        <NavItem
          to={ROUTES.admin.about}
          icon={<SelfhostIcon fontSize={20} />}
          label={i18n['com.affine.mobile.setting.about.title']()}
          isCollapsed={isCollapsed}
        />
      </nav>
      <div
        className={cn(
          'flex flex-col gap-2 overflow-hidden px-2',
          isCollapsed && 'items-center px-0 gap-1'
        )}
      >
        {!isCollapsed && <AdminLanguageSelect />}
        <UserDropdown isCollapsed={isCollapsed} />
        {isCollapsed ? null : <ServerVersion />}
      </div>
    </div>
  );
}
