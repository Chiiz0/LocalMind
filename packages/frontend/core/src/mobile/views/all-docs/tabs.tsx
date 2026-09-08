import {
  WorkbenchLink,
  WorkbenchService,
} from '@affine/core/modules/workbench';
import { I18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';

import * as styles from './style.css';

interface Tab {
  to: string;
  label: string;
}

const tabs: Tab[] = [
  {
    to: '/all',
    get label() {
      return I18n['com.affine.editCollection.pages']();
    },
  },
  {
    to: '/collection',
    get label() {
      return I18n['com.affine.editor.at-menu.collections']();
    },
  },
  {
    to: '/tag',
    get label() {
      return I18n['com.affine.editor.at-menu.tags']();
    },
  },
];

export const AllDocsTabs = () => {
  const workbench = useService(WorkbenchService).workbench;
  const location = useLiveData(workbench.location$);

  return (
    <ul className={styles.tabs}>
      {tabs.map(tab => {
        return (
          <WorkbenchLink
            data-active={location.pathname === tab.to}
            replaceHistory
            className={styles.tab}
            key={tab.to}
            to={tab.to}
          >
            {tab.label}
          </WorkbenchLink>
        );
      })}
    </ul>
  );
};
