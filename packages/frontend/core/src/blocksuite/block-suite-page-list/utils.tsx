import { toast } from '@affine/component';
import { AppSidebarService } from '@affine/core/modules/app-sidebar';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { DocsService } from '@affine/core/modules/doc';
import {
  EditorSettingService,
  resolveNewDocTitle,
} from '@affine/core/modules/editor-setting';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { useI18n } from '@affine/i18n';
import { type DocMode } from '@blocksuite/affine/model';
import type { Workspace } from '@blocksuite/affine/store';
import { LiveData, useLiveData, useServices } from '@toeverything/infra';
import { useCallback, useMemo } from 'react';

export const usePageHelper = (_docCollection: Workspace) => {
  const i18n = useI18n();
  const {
    docsService,
    workbenchService,
    appSidebarService,
    editorSettingService,
    workspaceDialogService,
  } = useServices({
    DocsService,
    WorkbenchService,
    AppSidebarService,
    EditorSettingService,
    WorkspaceDialogService,
  });
  const workbench = workbenchService.workbench;
  const docRecordList = docsService.list;
  const appSidebar = appSidebarService.sidebar;
  const settings = useLiveData(editorSettingService.editorSetting.settings$);
  const allDocTitles = useLiveData(
    useMemo(() => LiveData.from(docsService.allDocTitle$(), []), [docsService])
  );

  const createBlankDoc = useCallback(() => {
    const title = resolveNewDocTitle({
      autoTitleEnabled: settings.autoTitleNewDocWithCurrentDate,
      existingTitles: allDocTitles.map(doc => doc.title).filter(Boolean),
      format: settings.newDocDateTitleFormat,
    });

    return docsService.createDoc(title ? { title } : undefined);
  }, [
    allDocTitles,
    docsService,
    settings.autoTitleNewDocWithCurrentDate,
    settings.newDocDateTitleFormat,
  ]);

  const createPageAndOpen = useCallback(
    (
      mode?: DocMode,
      options: {
        at?: 'new-tab' | 'tail' | 'active';
        show?: boolean;
      } = {
        at: 'active',
        show: true,
      }
    ) => {
      appSidebar.setHovering(false);
      const page = createBlankDoc();

      if (mode) {
        docRecordList.doc$(page.id).value?.setPrimaryMode(mode);
      }

      if (options.show !== false) {
        workbench.openDoc(page.id, {
          at: options.at,
          show: options.show,
        });
      }
      return page;
    },
    [appSidebar, createBlankDoc, docRecordList, workbench]
  );

  const createEdgelessAndOpen = useCallback(
    (
      options: { at?: 'new-tab' | 'tail' | 'active'; show?: boolean } = {
        at: 'active',
        show: true,
      }
    ) => {
      return createPageAndOpen('edgeless', options);
    },
    [createPageAndOpen]
  );

  const importFileAndOpen = useMemo(
    () => async () => {
      const { promise, resolve } = Promise.withResolvers<void>();
      workspaceDialogService.open('import', undefined, result => {
        resolve();
        if (!result) return;
        if (result.officeArtifactId) {
          toast(
            i18n[
              'com.affine.ui.successfully-imported-a-native-office-document'
            ]()
          );
          workbench.openOffice(result.officeArtifactId);
          return;
        }
        if (result.isWorkspaceFile) {
          workbench.openAll();
          return;
        }
        if (!result.docIds.length) return;
        toast(
          `Successfully imported ${result.docIds.length} Page${
            result.docIds.length > 1 ? 's' : ''
          }.`
        );
        if (result.docIds.length > 1) workbench.openAll();
        else workbench.openDoc(result.docIds[0]);
      });
      return await promise;
    },
    [workbench, workspaceDialogService, i18n]
  );

  return useMemo(() => {
    return {
      createPage: (
        mode?: DocMode,
        options?: {
          at?: 'new-tab' | 'tail' | 'active';
          show?: boolean;
        }
      ) => createPageAndOpen(mode, options),
      createEdgeless: createEdgelessAndOpen,
      importFile: importFileAndOpen,
    };
  }, [createEdgelessAndOpen, createPageAndOpen, importFileAndOpen]);
};
