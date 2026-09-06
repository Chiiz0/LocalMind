import {
  AnimatedFolderIcon,
  MenuItem,
  MenuSeparator,
  MenuSub,
  notify,
  toast,
} from '@affine/component';
import { usePageHelper } from '@affine/core/blocksuite/block-suite-page-list/utils';
import type {
  NavigationPanelTreeNodeIcon,
  NodeOperation,
} from '@affine/core/desktop/components/navigation-panel';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { FeatureFlagService } from '@affine/core/modules/feature-flag';
import { NavigationPanelService } from '@affine/core/modules/navigation-panel';
import {
  type FolderNode,
  OrganizeService,
} from '@affine/core/modules/organize';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import track from '@affine/track';
import {
  DeleteIcon,
  FolderIcon,
  LayerIcon,
  PageIcon,
  PlusThickIcon,
  RemoveFolderIcon,
  TagsIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService, useServices } from '@toeverything/infra';
import { difference } from 'lodash-es';
import { type ReactNode, useCallback, useMemo } from 'react';

import { AddItemPlaceholder } from '../../layouts/add-item-placeholder';
import { MobileNavigationMenuItems } from '../../menu-host';
import { NavigationPanelTreeNode } from '../../tree/node';
import { NavigationPanelCollectionNode } from '../collection';
import { NavigationPanelDocNode } from '../doc';
import { NavigationPanelTagNode } from '../tag';
import { FolderCreateTip, FolderRenameSubMenu } from './dialog';
import { FavoriteFolderOperation } from './operations';

export const NavigationPanelFolderNode = ({
  nodeId,
  operations,
  parentPath,
}: {
  nodeId: string;
  operations?:
    | NodeOperation[]
    | ((type: string, node: FolderNode) => NodeOperation[]);
  parentPath: string[];
}) => {
  const { organizeService } = useServices({
    OrganizeService,
  });
  const node = useLiveData(organizeService.folderTree.folderNode$(nodeId));
  const type = useLiveData(node?.type$);
  const data = useLiveData(node?.data$);

  const additionalOperations = useMemo(() => {
    if (!type || !node) {
      return;
    }
    if (typeof operations === 'function') {
      return operations(type, node);
    }
    return operations;
  }, [node, operations, type]);

  if (!node) {
    return;
  }

  if (type === 'folder') {
    return (
      <NavigationPanelFolderNodeFolder
        node={node}
        operations={additionalOperations}
        parentPath={parentPath}
      />
    );
  }
  if (!data) return null;
  if (type === 'doc') {
    return (
      <NavigationPanelDocNode
        docId={data}
        isInFolder
        operations={additionalOperations}
        parentPath={parentPath}
      />
    );
  } else if (type === 'collection') {
    return (
      <NavigationPanelCollectionNode
        collectionId={data}
        operations={additionalOperations}
        parentPath={parentPath}
      />
    );
  } else if (type === 'tag') {
    return (
      <NavigationPanelTagNode
        tagId={data}
        operations={additionalOperations}
        parentPath={parentPath}
      />
    );
  }

  return;
};

const NavigationPanelFolderIcon: NavigationPanelTreeNodeIcon = ({
  collapsed,
  className,
  draggedOver,
  treeInstruction,
}) => (
  <AnimatedFolderIcon
    className={className}
    open={
      !collapsed || (!!draggedOver && treeInstruction?.type === 'make-child')
    }
  />
);

const NavigationPanelFolderMenu = ({
  nodeId,
  canDelete,
  name,
  handleDelete,
  handleRename,
  handleCreateSubfolder,
  handleAddToFolder,
  createSubTipRenderer,
  additionalOperations,
}: {
  nodeId: string;
  canDelete: boolean;
  name: string;
  handleDelete: () => void;
  handleRename: (name: string) => void;
  handleCreateSubfolder: (name: string) => void;
  handleAddToFolder: (type: 'doc' | 'collection' | 'tag') => void;
  createSubTipRenderer: (props: { input: string }) => ReactNode;
  additionalOperations?: NodeOperation[];
}) => {
  const t = useI18n();
  const operations = useMemo(
    () => [
      {
        index: 98,
        view: (
          <FolderRenameSubMenu
            initialName={name}
            onConfirm={handleRename}
            menuProps={{ triggerOptions: { 'data-testid': 'rename-folder' } }}
          />
        ),
      },
      { index: 99, view: <MenuSeparator /> },
      {
        index: 100,
        view: (
          <FolderRenameSubMenu
            text={t[
              'com.affine.rootAppSidebar.organize.folder.create-subfolder'
            ]()}
            title={t[
              'com.affine.rootAppSidebar.organize.folder.create-subfolder'
            ]()}
            onConfirm={handleCreateSubfolder}
            descRenderer={createSubTipRenderer}
            icon={<FolderIcon />}
            menuProps={{
              triggerOptions: { 'data-testid': 'create-subfolder' },
            }}
          />
        ),
      },
      {
        index: 102,
        view: (
          <MenuSub
            triggerOptions={{ prefixIcon: <PlusThickIcon /> }}
            items={
              <>
                <MenuItem
                  prefixIcon={<PageIcon />}
                  onClick={() => handleAddToFolder('doc')}
                >
                  {t['com.affine.rootAppSidebar.organize.folder.add-docs']()}
                </MenuItem>
                <MenuItem
                  prefixIcon={<TagsIcon />}
                  onClick={() => handleAddToFolder('tag')}
                >
                  {t['com.affine.rootAppSidebar.organize.folder.add-tags']()}
                </MenuItem>
                <MenuItem
                  prefixIcon={<LayerIcon />}
                  onClick={() => handleAddToFolder('collection')}
                >
                  {t[
                    'com.affine.rootAppSidebar.organize.folder.add-collections'
                  ]()}
                </MenuItem>
              </>
            }
          >
            {t['com.affine.rootAppSidebar.organize.folder.add-others']()}
          </MenuSub>
        ),
      },
      {
        index: 200,
        view: nodeId ? <FavoriteFolderOperation id={nodeId} /> : null,
      },
      { index: 9999, view: <MenuSeparator /> },
      {
        index: 10000,
        view: (
          <MenuItem
            type="danger"
            prefixIcon={<DeleteIcon />}
            onClick={handleDelete}
            disabled={!canDelete}
            aria-disabled={!canDelete}
            title={
              !canDelete
                ? t['com.affine.rootAppSidebar.organize.delete.not-empty']()
                : undefined
            }
          >
            {canDelete
              ? t['com.affine.rootAppSidebar.organize.delete']()
              : t['com.affine.rootAppSidebar.organize.delete.empty-only']()}
          </MenuItem>
        ),
      },
    ],
    [
      canDelete,
      createSubTipRenderer,
      handleAddToFolder,
      handleCreateSubfolder,
      handleDelete,
      handleRename,
      name,
      nodeId,
      t,
    ]
  );
  return (
    <MobileNavigationMenuItems
      operations={[...(additionalOperations ?? []), ...operations]}
    />
  );
};

export const NavigationPanelFolderNodeMenu = ({
  nodeId,
  additionalOperations,
}: {
  nodeId: string;
  additionalOperations?: NodeOperation[];
}) => {
  const t = useI18n();
  const { organizeService, workspaceDialogService } = useServices({
    OrganizeService,
    WorkspaceDialogService,
  });
  const node = useLiveData(organizeService.folderTree.folderNode$(nodeId));
  const name = useLiveData(node?.name$) ?? '';
  const canDelete = useLiveData(node?.canDelete$) ?? false;
  const canMutate = useLiveData(node?.canMutate$) ?? false;
  const children = useLiveData(node?.sortedChildren$);

  const handleDelete = useCallback(async () => {
    try {
      if (!node) return;
      if (!(await node.delete())) {
        toast(t['com.affine.rootAppSidebar.organize.delete.not-empty']());
        return;
      }
      track.$.navigationPanel.organize.deleteOrganizeItem({ type: 'folder' });
      notify.success({
        title: t['com.affine.rootAppSidebar.organize.delete.notify-title']({
          name,
        }),
        message:
          t['com.affine.rootAppSidebar.organize.delete.notify-message'](),
      });
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'Directory operation failed'
      );
      return undefined;
    }
  }, [name, node, t]);
  const handleRename = useCallback(
    async (newName: string) => {
      try {
        return await node?.rename(newName);
      } catch (error) {
        toast(
          error instanceof Error ? error.message : 'Directory operation failed'
        );
        return undefined;
      }
    },
    [node]
  );
  const handleCreateSubfolder = useCallback(
    async (newName: string) => {
      try {
        if (!node) return;
        await node.createFolder(newName, node.indexAt('before'));
        track.$.navigationPanel.organize.createOrganizeItem({ type: 'folder' });
      } catch (error) {
        toast(
          error instanceof Error ? error.message : 'Directory operation failed'
        );
        return undefined;
      }
    },
    [node]
  );
  const handleAddToFolder = useCallback(
    (type: 'doc' | 'collection' | 'tag') => {
      if (!node) return;
      const currentChildren = children ?? [];
      const initialIds = currentChildren
        .filter(child => child.type$.value === type)
        .map(child => child.data$.value)
        .filter(Boolean) as string[];
      const selector =
        type === 'doc'
          ? 'doc-selector'
          : type === 'collection'
            ? 'collection-selector'
            : 'tag-selector';
      workspaceDialogService.open(
        selector,
        { init: initialIds },
        selectedIds => {
          (async () => {
            try {
              if (selectedIds === undefined) return;
              const newItemIds = difference(selectedIds, initialIds);
              const removedItemIds = difference(initialIds, selectedIds);
              for (const id of newItemIds) {
                await node.createLink(type, id, node.indexAt('after'));
              }
              const removedItems = currentChildren.filter(
                child =>
                  !!child.data$.value &&
                  removedItemIds.includes(child.data$.value)
              );
              for (const child of removedItems) await child.delete();
            } catch (error) {
              toast(
                error instanceof Error
                  ? error.message
                  : 'Directory operation failed'
              );
            }
          })().catch(console.error);
        }
      );
      track.$.navigationPanel.organize.createOrganizeItem({
        type: 'link',
        target: type,
      });
    },
    [children, node, workspaceDialogService]
  );
  const createSubTipRenderer = useCallback(
    ({ input }: { input: string }) => (
      <FolderCreateTip input={input} parentName={name} />
    ),
    [name]
  );

  if (!node || !canMutate) return null;
  return (
    <NavigationPanelFolderMenu
      nodeId={nodeId}
      name={name}
      handleDelete={(...args) => {
        handleDelete(...args).catch(console.error);
      }}
      canDelete={canDelete}
      handleRename={(...args) => {
        handleRename(...args).catch(console.error);
      }}
      handleCreateSubfolder={(...args) => {
        handleCreateSubfolder(...args).catch(console.error);
      }}
      handleAddToFolder={handleAddToFolder}
      createSubTipRenderer={createSubTipRenderer}
      additionalOperations={additionalOperations}
    />
  );
};

const NavigationPanelFolderNodeFolder = ({
  node,
  operations: additionalOperations,
  parentPath,
}: {
  node: FolderNode;
  operations?: NodeOperation[];
  parentPath: string[];
}) => {
  const t = useI18n();
  const { workspaceService, featureFlagService } = useServices({
    WorkspaceService,
    FeatureFlagService,
  });
  const name = useLiveData(node.name$);
  const canMutate = useLiveData(node.canMutate$);
  const enableEmojiIcon = useLiveData(
    featureFlagService.flags.enable_emoji_folder_icon.$
  );
  const navigationPanelService = useService(NavigationPanelService);
  const path = useMemo(
    () => [...parentPath, `folder-${node.id}`],
    [parentPath, node.id]
  );
  const collapsed = useLiveData(navigationPanelService.collapsed$(path));
  const setCollapsed = useCallback(
    (value: boolean) => {
      navigationPanelService.setCollapsed(path, value);
    },
    [navigationPanelService, path]
  );

  const { createPage } = usePageHelper(
    workspaceService.workspace.docCollection
  );
  const children = useLiveData(node.sortedChildren$);

  const handleNewDoc = useCallback(async () => {
    try {
      const newDoc = createPage();
      await node.createLink('doc', newDoc.id, node.indexAt('before'));
      track.$.navigationPanel.folders.createDoc();
      track.$.navigationPanel.organize.createOrganizeItem({
        type: 'link',
        target: 'doc',
      });
      setCollapsed(false);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'Directory operation failed'
      );
      return undefined;
    }
  }, [createPage, node, setCollapsed]);

  const menuTarget = useMemo(
    () => (
      <NavigationPanelFolderNodeMenu
        nodeId={node.id ?? ''}
        additionalOperations={additionalOperations}
      />
    ),
    [additionalOperations, node.id]
  );

  const childrenOperations = useCallback(
    (type: string, node: FolderNode) => {
      if (!canMutate) return [];
      if (type === 'doc' || type === 'collection' || type === 'tag') {
        return [
          {
            index: 999,
            view: (
              <MenuItem
                type={'danger'}
                prefixIcon={<RemoveFolderIcon />}
                data-event-props="$.navigationPanel.organize.deleteOrganizeItem"
                data-event-args-type={node.type$.value}
                onClick={() => {
                  (async () => {
                    try {
                      return await node.delete();
                    } catch (error) {
                      toast(
                        error instanceof Error
                          ? error.message
                          : 'Directory operation failed'
                      );
                      return undefined;
                    }
                  })().catch(console.error);
                }}
              >
                {t['com.affine.rootAppSidebar.organize.delete-from-folder']()}
              </MenuItem>
            ),
          },
        ] satisfies NodeOperation[];
      }
      return [];
    },
    [t, canMutate]
  );

  const handleCollapsedChange = useCallback(
    (collapsed: boolean) => {
      if (collapsed) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
      }
    },
    [setCollapsed]
  );

  return (
    <NavigationPanelTreeNode
      icon={NavigationPanelFolderIcon}
      name={name}
      extractEmojiAsIcon={enableEmojiIcon}
      collapsed={collapsed}
      setCollapsed={handleCollapsedChange}
      menuTarget={menuTarget}
      data-testid={`navigation-panel-folder-${node.id}`}
      aria-label={name}
      data-role="navigation-panel-folder"
    >
      {children.map(child => (
        <NavigationPanelFolderNode
          key={child.id}
          nodeId={child.id as string}
          operations={childrenOperations}
          parentPath={path}
        />
      ))}
      {canMutate ? (
        <AddItemPlaceholder
          label={t['com.affine.rootAppSidebar.organize.folder.new-doc']()}
          onClick={() => {
            handleNewDoc().catch(console.error);
          }}
          data-testid="new-folder-in-folder-button"
        />
      ) : null}
    </NavigationPanelTreeNode>
  );
};
