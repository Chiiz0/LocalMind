import { Button, Skeleton, toast } from '@affine/component';
import { NavigationPanelTreeRoot } from '@affine/core/desktop/components/navigation-panel';
import { NavigationPanelService } from '@affine/core/modules/navigation-panel';
import { OrganizeService } from '@affine/core/modules/organize';
import { useI18n } from '@affine/i18n';
import track from '@affine/track';
import { AddOrganizeIcon } from '@blocksuite/icons/rc';
import { useLiveData, useServices } from '@toeverything/infra';
import { useCallback, useMemo, useState } from 'react';

import { AddItemPlaceholder } from '../../layouts/add-item-placeholder';
import { CollapsibleSection } from '../../layouts/collapsible-section';
import { NavigationPanelFolderNode } from '../../nodes/folder';
import { FolderCreateTip, FolderRenameDialog } from '../../nodes/folder/dialog';

export const NavigationPanelOrganize = () => {
  const { organizeService, navigationPanelService } = useServices({
    OrganizeService,
    NavigationPanelService,
  });
  const path = useMemo(() => ['organize'], []);
  const [openNewFolderDialog, setOpenNewFolderDialog] = useState(false);

  const t = useI18n();

  const folderTree = organizeService.folderTree;
  const rootFolder = folderTree.rootFolder;

  const folders = useLiveData(rootFolder.sortedChildren$);
  const isLoading = useLiveData(folderTree.isLoading$);
  const canMutate = useLiveData(folderTree.canMutate$);
  const error = useLiveData(folderTree.error$);

  const handleCreateFolder = useCallback(
    async (name: string) => {
      try {
        const newFolderId = await rootFolder.createFolder(
          name,
          rootFolder.indexAt('before')
        );
        track.$.navigationPanel.organize.createOrganizeItem({ type: 'folder' });
        navigationPanelService.setCollapsed(path, false);
        return newFolderId;
      } catch (error) {
        toast(
          error instanceof Error ? error.message : 'Directory operation failed'
        );
        return undefined;
      }
    },
    [navigationPanelService, path, rootFolder]
  );

  return (
    <CollapsibleSection
      path={path}
      title={t['com.affine.rootAppSidebar.organize']()}
    >
      {/* TODO(@CatsJuice): Organize loading UI */}
      {error ? (
        <div role="alert">
          <span>{error}</span>
          <Button
            onClick={() => {
              folderTree.refresh().catch(console.error);
            }}
          >
            {t['com.affine.error.refetch']()}
          </Button>
        </div>
      ) : null}
      <NavigationPanelTreeRoot placeholder={isLoading ? <Skeleton /> : null}>
        {folders.map(child => (
          <NavigationPanelFolderNode
            key={child.id}
            nodeId={child.id as string}
            parentPath={path}
          />
        ))}
        {canMutate ? (
          <AddItemPlaceholder
            icon={<AddOrganizeIcon />}
            data-testid="navigation-panel-bar-add-organize-button"
            label={t['com.affine.rootAppSidebar.organize.add-folder']()}
            onClick={() => setOpenNewFolderDialog(true)}
          />
        ) : null}
      </NavigationPanelTreeRoot>
      <FolderRenameDialog
        open={openNewFolderDialog && canMutate}
        onConfirm={(...args) => {
          handleCreateFolder(...args).catch(console.error);
        }}
        onOpenChange={setOpenNewFolderDialog}
        descRenderer={FolderCreateTip}
      />
    </CollapsibleSection>
  );
};
