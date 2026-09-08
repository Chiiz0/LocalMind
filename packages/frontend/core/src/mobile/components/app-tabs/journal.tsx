import { DocDisplayMetaService } from '@affine/core/modules/doc-display-meta';
import { JournalService } from '@affine/core/modules/journal';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { useI18n } from '@affine/i18n';
import { TodayIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback } from 'react';

import { TabItem } from './tab-item';
import type { AppTabCustomFCProps } from './type';

export const AppTabJournal = ({ tab }: AppTabCustomFCProps) => {
  const i18n = useI18n();
  const workbench = useService(WorkbenchService).workbench;
  const location = useLiveData(workbench.location$);
  const journalService = useService(JournalService);
  const docDisplayMetaService = useService(DocDisplayMetaService);

  const maybeDocId = location.pathname.split('/')[1];
  const journalDate = useLiveData(journalService.journalDate$(maybeDocId));
  const JournalIcon = useLiveData(docDisplayMetaService.icon$(maybeDocId));

  const handleOpenToday = useCallback(() => {
    workbench.open('/journals', { at: 'active', replaceHistory: true });
  }, [workbench]);

  const Icon = journalDate ? JournalIcon : TodayIcon;

  return (
    <TabItem
      onClick={handleOpenToday}
      id={tab.key}
      label={i18n['com.affine.cmdk.affine.category.affine.journal']()}
    >
      <Icon />
    </TabItem>
  );
};
