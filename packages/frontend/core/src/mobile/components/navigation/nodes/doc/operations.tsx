import {
  MenuItem,
  MenuSeparator,
  MenuSub,
  toast,
  useConfirmModal,
} from '@affine/component';
import { usePageHelper } from '@affine/core/blocksuite/block-suite-page-list/utils';
import { Guard } from '@affine/core/components/guard';
import { useBlockSuiteMetaHelper } from '@affine/core/components/hooks/affine/use-block-suite-meta-helper';
import { useRemoveLinkedDoc } from '@affine/core/components/hooks/affine/use-remove-linked-doc';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import { IsFavoriteIcon } from '@affine/core/components/pure/icons';
import type { NodeOperation } from '@affine/core/desktop/components/navigation-panel';
import { DocsService } from '@affine/core/modules/doc';
import { CompatibleFavoriteItemsAdapter } from '@affine/core/modules/favorite';
import { GuardService } from '@affine/core/modules/permissions';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { preventDefault } from '@affine/core/utils';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import {
  DeleteIcon,
  DuplicateIcon,
  InformationIcon,
  LinkedPageIcon,
  OpenInNewIcon,
  UnlinkIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService, useServices } from '@toeverything/infra';
import { useCallback, useMemo } from 'react';

import { DocFrameScope, DocInfoSheet } from '../../../doc-info';
import { MobileNavigationMenuItems } from '../../menu-host';
import { DocRenameSubMenu } from './dialog';

export const useNavigationPanelDocNodeAddLinkedPage = (
  docId: string,
  openNodeCollapsed: () => void
) => {
  const t = useI18n();
  const { docsService, guardService, workspaceService } = useServices({
    DocsService,
    GuardService,
    WorkspaceService,
  });
  const { createPage } = usePageHelper(
    workspaceService.workspace.docCollection
  );
  return useAsyncCallback(async () => {
    try {
      const canEdit = await guardService.can('Doc_Update', docId);
      if (!canEdit) {
        toast(t['com.affine.no-permission']());
        return;
      }
      const newDoc = createPage();
      const result = await docsService.addLinkedDoc(docId, newDoc.id);
      if (result !== 'added') {
        toast(
          t[
            result === 'self-link'
              ? 'com.affine.toastMessage.linkedPageSelfLink'
              : 'com.affine.toastMessage.linkedPageAlreadyExists'
          ]()
        );
        return;
      }
      toast(t['com.affine.toastMessage.addLinkedPage']());
      track.$.navigationPanel.docs.createDoc({ control: 'linkDoc' });
      track.$.navigationPanel.docs.linkDoc({ control: 'createDoc' });
      openNodeCollapsed();
    } catch (error) {
      console.error('[navigation-panel] Failed to add linked doc', error);
      toast(t['com.affine.toastMessage.addLinkedPageFailed']());
    }
  }, [createPage, docId, docsService, guardService, openNodeCollapsed, t]);
};

export const useNavigationPanelDocNodeOperations = (docId: string) => {
  const t = useI18n();
  const {
    workbenchService,
    docsService,
    compatibleFavoriteItemsAdapter,
    guardService,
  } = useServices({
    DocsService,
    WorkbenchService,
    CompatibleFavoriteItemsAdapter,
    GuardService,
  });

  const { openConfirmModal } = useConfirmModal();

  const docRecord = useLiveData(docsService.list.doc$(docId));

  const favorite = useLiveData(
    useMemo(() => {
      return compatibleFavoriteItemsAdapter.isFavorite$(docId, 'doc');
    }, [docId, compatibleFavoriteItemsAdapter])
  );

  const { duplicate } = useBlockSuiteMetaHelper();
  const handleDuplicate = useCallback(() => {
    duplicate(docId, true);
    track.$.navigationPanel.docs.createDoc();
  }, [docId, duplicate]);

  const handleMoveToTrash = useCallback(() => {
    if (!docRecord) {
      return;
    }
    openConfirmModal({
      title: t['com.affine.moveToTrash.title'](),
      description: t['com.affine.moveToTrash.confirmModal.description']({
        title: docRecord.title$.value,
      }),
      confirmText: t['com.affine.moveToTrash.confirmModal.confirm'](),
      cancelText: t['com.affine.moveToTrash.confirmModal.cancel'](),
      confirmButtonOptions: {
        variant: 'error',
      },
      async onConfirm() {
        if (!(await guardService.can('Doc_Trash', docId))) {
          toast(t['com.affine.no-permission']());
          return;
        }
        docRecord.moveToTrash();
        track.$.navigationPanel.docs.deleteDoc({
          control: 'button',
        });
        toast(t['com.affine.toastMessage.movedTrash']());
      },
    });
  }, [docId, docRecord, guardService, openConfirmModal, t]);

  const handleOpenInNewTab = useCallback(() => {
    workbenchService.workbench.openDoc(docId, {
      at: 'new-tab',
    });
    track.$.navigationPanel.organize.openInNewTab({
      type: 'doc',
    });
  }, [docId, workbenchService]);

  const handleOpenInSplitView = useCallback(() => {
    workbenchService.workbench.openDoc(docId, {
      at: 'beside',
    });
    track.$.navigationPanel.organize.openInSplitView({
      type: 'doc',
    });
  }, [docId, workbenchService.workbench]);

  const handleToggleFavoriteDoc = useCallback(() => {
    compatibleFavoriteItemsAdapter.toggle(docId, 'doc');
    track.$.navigationPanel.organize.toggleFavorite({
      type: 'doc',
    });
  }, [docId, compatibleFavoriteItemsAdapter]);

  const handleRename = useAsyncCallback(
    async (newName: string) => {
      await docsService.changeDocTitle(docId, newName);
      track.$.navigationPanel.organize.renameOrganizeItem({ type: 'doc' });
    },
    [docId, docsService]
  );

  return useMemo(
    () => ({
      favorite,
      handleDuplicate,
      handleToggleFavoriteDoc,
      handleOpenInSplitView,
      handleOpenInNewTab,
      handleMoveToTrash,
      handleRename,
    }),
    [
      favorite,
      handleDuplicate,
      handleMoveToTrash,
      handleOpenInNewTab,
      handleOpenInSplitView,
      handleRename,
      handleToggleFavoriteDoc,
    ]
  );
};

export const useNavigationPanelDocNodeOperationsMenu = (
  docId: string,
  options: {
    handleAddLinkedPage: () => void;
    linkedFromDocId?: string;
    isInFolder?: boolean;
  }
): {
  operations: NodeOperation[];
  handleAddLinkedPage: () => void;
} => {
  const t = useI18n();
  const { handleAddLinkedPage } = options;
  const {
    favorite,
    handleDuplicate,
    handleToggleFavoriteDoc,
    handleOpenInNewTab,
    handleMoveToTrash,
    handleRename,
  } = useNavigationPanelDocNodeOperations(docId);

  const docService = useService(DocsService);
  const docRecord = useLiveData(docService.list.doc$(docId));
  const title = useLiveData(docRecord?.title$);
  const handleRemoveLinkedDoc = useRemoveLinkedDoc(
    options.linkedFromDocId,
    docId
  );

  const operations = useMemo(
    () => [
      {
        index: 10,
        view: (
          <Guard docId={docId} permission="Doc_Update">
            {canEdit => (
              <DocRenameSubMenu
                onConfirm={handleRename}
                initialName={title}
                disabled={!canEdit}
              />
            )}
          </Guard>
        ),
      },
      {
        index: 11,
        view: <MenuSeparator />,
      },
      {
        index: 50,
        view: (
          <MenuSub
            triggerOptions={{
              prefixIcon: <InformationIcon />,
              onClick: preventDefault,
            }}
            title={title ?? t['unnamed']()}
            items={
              <DocFrameScope docId={docId}>
                <DocInfoSheet docId={docId} />
              </DocFrameScope>
            }
          >
            <span>{t['com.affine.page-properties.page-info.view']()}</span>
          </MenuSub>
        ),
      },
      {
        index: 97,
        view: (
          <Guard docId={docId} permission="Doc_Update">
            {canEdit => (
              <MenuItem
                prefixIcon={<LinkedPageIcon />}
                onClick={handleAddLinkedPage}
                disabled={!canEdit}
              >
                {t['com.affine.page-operation.add-linked-page']()}
              </MenuItem>
            )}
          </Guard>
        ),
      },
      {
        index: 98,
        view: (
          <MenuItem prefixIcon={<DuplicateIcon />} onClick={handleDuplicate}>
            {t['com.affine.header.option.duplicate']()}
          </MenuItem>
        ),
      },
      {
        index: 99,
        view: (
          <MenuItem prefixIcon={<OpenInNewIcon />} onClick={handleOpenInNewTab}>
            {t['com.affine.workbench.tab.page-menu-open']()}
          </MenuItem>
        ),
      },
      {
        index: 199,
        view: (
          <MenuItem
            prefixIcon={<IsFavoriteIcon favorite={favorite} />}
            onClick={handleToggleFavoriteDoc}
          >
            {favorite
              ? t['com.affine.favoritePageOperation.remove']()
              : t['com.affine.favoritePageOperation.add']()}
          </MenuItem>
        ),
      },
      {
        index: 9999,
        view: <MenuSeparator key="menu-separator" />,
      },
      {
        index: 10000,
        view:
          options.linkedFromDocId && !options.isInFolder ? (
            <Guard docId={options.linkedFromDocId} permission="Doc_Update">
              {canEdit => (
                <MenuItem
                  prefixIcon={<UnlinkIcon />}
                  onClick={handleRemoveLinkedDoc}
                  disabled={!canEdit}
                >
                  {t['com.affine.rootAppSidebar.doc.remove-link']()}
                </MenuItem>
              )}
            </Guard>
          ) : (
            <Guard docId={docId} permission="Doc_Trash">
              {canMoveToTrash => (
                <MenuItem
                  type={'danger'}
                  prefixIcon={<DeleteIcon />}
                  onClick={handleMoveToTrash}
                  disabled={!canMoveToTrash}
                >
                  {t['com.affine.moveToTrash.title']()}
                </MenuItem>
              )}
            </Guard>
          ),
      },
    ],
    [
      docId,
      favorite,
      handleAddLinkedPage,
      handleDuplicate,
      handleMoveToTrash,
      handleOpenInNewTab,
      handleRemoveLinkedDoc,
      handleRename,
      handleToggleFavoriteDoc,
      options.linkedFromDocId,
      options.isInFolder,
      t,
      title,
    ]
  );

  return useMemo(
    () => ({ operations, handleAddLinkedPage }),
    [handleAddLinkedPage, operations]
  );
};

export const NavigationPanelDocNodeMenu = ({
  docId,
  handleAddLinkedPage,
  linkedFromDocId,
  isInFolder,
  additionalOperations,
}: {
  docId: string;
  handleAddLinkedPage: () => void;
  linkedFromDocId?: string;
  isInFolder?: boolean;
  additionalOperations?: NodeOperation[];
}) => {
  const { operations } = useNavigationPanelDocNodeOperationsMenu(docId, {
    handleAddLinkedPage,
    linkedFromDocId,
    isInFolder,
  });
  const allOperations = useMemo(
    () => [...operations, ...(additionalOperations ?? [])],
    [additionalOperations, operations]
  );
  return <MobileNavigationMenuItems operations={allOperations} />;
};
