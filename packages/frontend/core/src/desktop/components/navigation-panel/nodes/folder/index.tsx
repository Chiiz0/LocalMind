import {
  AnimatedCollectionsIcon,
  AnimatedFolderIcon,
  type DropTargetDropEvent,
  type DropTargetOptions,
  IconButton,
  MenuItem,
  MenuSeparator,
  MenuSub,
  notify,
  toast,
} from '@affine/component';
import { usePageHelper } from '@affine/core/blocksuite/block-suite-page-list/utils';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { CompatibleFavoriteItemsAdapter } from '@affine/core/modules/favorite';
import { FeatureFlagService } from '@affine/core/modules/feature-flag';
import { NavigationPanelService } from '@affine/core/modules/navigation-panel';
import {
  type FolderNode,
  OrganizeService,
} from '@affine/core/modules/organize';
import { WorkspaceService } from '@affine/core/modules/workspace';
import type { AffineDNDData } from '@affine/core/types/dnd';
import { Unreachable } from '@affine/env/constant';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import {
  DeleteIcon,
  FolderIcon,
  PageIcon,
  PlusIcon,
  PlusThickIcon,
  RemoveFolderIcon,
  TagsIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService, useServices } from '@toeverything/infra';
import { difference } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';

import {
  NavigationPanelTreeNode,
  type NavigationPanelTreeNodeDropEffect,
} from '../../tree';
import type { NavigationPanelTreeNodeIcon } from '../../tree/node';
import type { NodeOperation } from '../../tree/types';
import { NavigationPanelCollectionNode } from '../collection';
import { NavigationPanelDocNode } from '../doc';
import { NavigationPanelTagNode } from '../tag';
import type { GenericNavigationPanelNode } from '../types';
import { FolderEmpty } from './empty';
import { FavoriteFolderOperation } from './operations';

export const NavigationPanelFolderNode = ({
  nodeId,
  onDrop,
  defaultRenaming,
  operations,
  location,
  dropEffect,
  canDrop,
  reorderable,
  parentPath,
}: {
  defaultRenaming?: boolean;
  nodeId: string;
  onDrop?: (data: DropTargetDropEvent<AffineDNDData>, node: FolderNode) => void;
  operations?:
    | NodeOperation[]
    | ((type: string, node: FolderNode) => NodeOperation[]);
} & Omit<GenericNavigationPanelNode, 'operations'>) => {
  const { organizeService } = useServices({
    OrganizeService,
  });
  const node = useLiveData(organizeService.folderTree.folderNode$(nodeId));
  const type = useLiveData(node?.type$);
  const data = useLiveData(node?.data$);
  const handleDrop = useCallback(
    (data: DropTargetDropEvent<AffineDNDData>) => {
      if (!node) {
        return;
      }
      onDrop?.(data, node);
    },
    [node, onDrop]
  );
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
        onDrop={handleDrop}
        defaultRenaming={defaultRenaming}
        operations={additionalOperations}
        dropEffect={dropEffect}
        reorderable={reorderable}
        canDrop={canDrop}
        parentPath={parentPath}
      />
    );
  } else if (type === 'doc') {
    return (
      data && (
        <NavigationPanelDocNode
          docId={data}
          isInFolder
          location={location}
          onDrop={handleDrop}
          reorderable={reorderable}
          canDrop={canDrop}
          dropEffect={dropEffect}
          operations={additionalOperations}
          parentPath={parentPath}
        />
      )
    );
  } else if (type === 'collection') {
    return (
      data && (
        <NavigationPanelCollectionNode
          collectionId={data}
          location={location}
          onDrop={handleDrop}
          canDrop={canDrop}
          reorderable={reorderable}
          dropEffect={dropEffect}
          operations={additionalOperations}
          parentPath={parentPath}
        />
      )
    );
  } else if (type === 'tag') {
    return (
      data && (
        <NavigationPanelTagNode
          tagId={data}
          location={location}
          onDrop={handleDrop}
          canDrop={canDrop}
          reorderable
          dropEffect={dropEffect}
          operations={additionalOperations}
          parentPath={parentPath}
        />
      )
    );
  }

  return;
};

// Define outside the `NavigationPanelFolderNodeFolder` to avoid re-render(the close animation won't play)
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

const NavigationPanelFolderNodeFolder = ({
  node,
  onDrop,
  defaultRenaming,
  location,
  operations: additionalOperations,
  canDrop,
  dropEffect,
  reorderable,
  parentPath,
}: {
  defaultRenaming?: boolean;
  node: FolderNode;
} & GenericNavigationPanelNode) => {
  const t = useI18n();
  const { workspaceService, featureFlagService, workspaceDialogService } =
    useServices({
      WorkspaceService,
      CompatibleFavoriteItemsAdapter,
      FeatureFlagService,
      WorkspaceDialogService,
    });
  const navigationPanelService = useService(NavigationPanelService);
  const name = useLiveData(node.name$);
  const canDelete = useLiveData(node.canDelete$);
  const canMutate = useLiveData(node.canMutate$);
  const enableEmojiIcon = useLiveData(
    featureFlagService.flags.enable_emoji_folder_icon.$
  );
  const path = useMemo(
    () => [...(parentPath ?? []), `folder-${node.id}`],
    [parentPath, node.id]
  );
  const collapsed = useLiveData(navigationPanelService.collapsed$(path));
  const setCollapsed = useCallback(
    (value: boolean) => {
      navigationPanelService.setCollapsed(path, value);
    },
    [navigationPanelService, path]
  );
  const [newFolderId, setNewFolderId] = useState<string | null>(null);

  const { createPage } = usePageHelper(
    workspaceService.workspace.docCollection
  );
  const handleDelete = useCallback(async () => {
    try {
      if (!(await node.delete())) {
        toast(t['com.affine.rootAppSidebar.organize.delete.not-empty']());
        return;
      }
      track.$.navigationPanel.organize.deleteOrganizeItem({
        type: 'folder',
      });
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

  const children = useLiveData(node.sortedChildren$);

  const dndData = useMemo(() => {
    if (!node.id) {
      throw new Unreachable();
    }
    return {
      draggable: {
        entity: {
          type: 'folder',
          id: node.id,
        },
        from: location,
      },
      dropTarget: {
        at: 'navigation-panel:organize:folder',
      },
    } satisfies AffineDNDData;
  }, [location, node.id]);

  const handleRename = useCallback(
    async (newName: string) => {
      try {
        await node.rename(newName);
      } catch (error) {
        toast(
          error instanceof Error ? error.message : 'Directory operation failed'
        );
        return undefined;
      }
    },
    [node]
  );

  const handleDropOnFolder = useCallback(
    async (data: DropTargetDropEvent<AffineDNDData>) => {
      try {
        if (data.source.data.entity?.type) {
          track.$.navigationPanel.folders.drop({
            type: data.source.data.entity.type,
          });
        }
        if (data.treeInstruction?.type === 'make-child') {
          if (data.source.data.entity?.type === 'folder') {
            if (
              node.id === data.source.data.entity.id ||
              node.beChildOf(data.source.data.entity.id)
            ) {
              return;
            }
            await node.moveHere(
              data.source.data.entity.id,
              node.indexAt('before')
            );
            track.$.navigationPanel.organize.moveOrganizeItem({
              type: 'folder',
            });
          } else if (
            data.source.data.entity?.type === 'collection' ||
            data.source.data.entity?.type === 'doc' ||
            data.source.data.entity?.type === 'tag'
          ) {
            if (
              data.source.data.from?.at ===
              'navigation-panel:organize:folder-node'
            ) {
              await node.moveHere(
                data.source.data.from.nodeId,
                node.indexAt('before')
              );
              track.$.navigationPanel.organize.moveOrganizeItem({
                type: 'link',
                target: data.source.data.entity?.type,
              });
            } else {
              await node.createLink(
                data.source.data.entity?.type,
                data.source.data.entity.id,
                node.indexAt('before')
              );
              track.$.navigationPanel.organize.createOrganizeItem({
                type: 'link',
                target: data.source.data.entity?.type,
              });
            }
          }
        } else {
          onDrop?.(data);
        }
      } catch (error) {
        toast(
          error instanceof Error ? error.message : 'Directory operation failed'
        );
        return undefined;
      }
    },
    [node, onDrop]
  );

  const handleDropEffect = useCallback<NavigationPanelTreeNodeDropEffect>(
    data => {
      if (data.treeInstruction?.type === 'make-child') {
        if (data.source.data.entity?.type === 'folder') {
          if (
            node.id === data.source.data.entity.id ||
            node.beChildOf(data.source.data.entity.id)
          ) {
            return;
          }
          return 'move';
        } else if (
          data.source.data.from?.at === 'navigation-panel:organize:folder-node'
        ) {
          return 'move';
        } else if (
          data.source.data.entity?.type === 'collection' ||
          data.source.data.entity?.type === 'doc' ||
          data.source.data.entity?.type === 'tag'
        ) {
          return 'link';
        }
      } else {
        return dropEffect?.(data);
      }
      return;
    },
    [dropEffect, node]
  );

  const handleDropOnPlaceholder = useCallback(
    async (data: DropTargetDropEvent<AffineDNDData>) => {
      try {
        if (data.source.data.entity?.type) {
          track.$.navigationPanel.folders.drop({
            type: data.source.data.entity.type,
          });
        }
        if (data.source.data.entity?.type === 'folder') {
          if (
            node.id === data.source.data.entity.id ||
            node.beChildOf(data.source.data.entity.id)
          ) {
            return;
          }
          await node.moveHere(
            data.source.data.entity.id,
            node.indexAt('before')
          );
          track.$.navigationPanel.organize.moveOrganizeItem({ type: 'folder' });
        } else if (
          data.source.data.entity?.type === 'collection' ||
          data.source.data.entity?.type === 'doc' ||
          data.source.data.entity?.type === 'tag'
        ) {
          if (
            data.source.data.from?.at ===
            'navigation-panel:organize:folder-node'
          ) {
            await node.moveHere(
              data.source.data.from.nodeId,
              node.indexAt('before')
            );
            track.$.navigationPanel.organize.moveOrganizeItem({
              type: data.source.data.entity?.type,
            });
          } else {
            await node.createLink(
              data.source.data.entity?.type,
              data.source.data.entity.id,
              node.indexAt('before')
            );
            track.$.navigationPanel.organize.createOrganizeItem({
              type: 'link',
              target: data.source.data.entity?.type,
            });
          }
        }
      } catch (error) {
        toast(
          error instanceof Error ? error.message : 'Directory operation failed'
        );
        return undefined;
      }
    },
    [node]
  );

  const handleDropOnChildren = useCallback(
    async (
      data: DropTargetDropEvent<AffineDNDData>,
      dropAtNode?: FolderNode
    ) => {
      try {
        if (!dropAtNode || !dropAtNode.id) {
          return;
        }
        if (data.source.data.entity?.type) {
          track.$.navigationPanel.folders.drop({
            type: data.source.data.entity.type,
          });
        }
        if (
          data.treeInstruction?.type === 'reorder-above' ||
          data.treeInstruction?.type === 'reorder-below'
        ) {
          const at =
            data.treeInstruction?.type === 'reorder-below' ? 'after' : 'before';
          if (data.source.data.entity?.type === 'folder') {
            if (
              node.id === data.source.data.entity.id ||
              node.beChildOf(data.source.data.entity.id)
            ) {
              return;
            }
            await node.moveHere(
              data.source.data.entity.id,
              node.indexAt(at, dropAtNode.id)
            );
            track.$.navigationPanel.organize.moveOrganizeItem({
              type: 'folder',
            });
          } else if (
            data.source.data.entity?.type === 'collection' ||
            data.source.data.entity?.type === 'doc' ||
            data.source.data.entity?.type === 'tag'
          ) {
            if (
              data.source.data.from?.at ===
              'navigation-panel:organize:folder-node'
            ) {
              await node.moveHere(
                data.source.data.from.nodeId,
                node.indexAt(at, dropAtNode.id)
              );
              track.$.navigationPanel.organize.moveOrganizeItem({
                type: 'link',
                target: data.source.data.entity?.type,
              });
            } else {
              await node.createLink(
                data.source.data.entity?.type,
                data.source.data.entity.id,
                node.indexAt(at, dropAtNode.id)
              );

              track.$.navigationPanel.organize.createOrganizeItem({
                type: 'link',
                target: data.source.data.entity?.type,
              });
            }
          }
        } else if (data.treeInstruction?.type === 'reparent') {
          const currentLevel = data.treeInstruction.currentLevel;
          const desiredLevel = data.treeInstruction.desiredLevel;
          if (currentLevel === desiredLevel + 1) {
            onDrop?.({
              ...data,
              treeInstruction: {
                type: 'reorder-below',
                currentLevel,
                indentPerLevel: data.treeInstruction.indentPerLevel,
              },
            });
            return;
          } else {
            onDrop?.({
              ...data,
              treeInstruction: {
                ...data.treeInstruction,
                currentLevel: currentLevel - 1,
              },
            });
          }
        }
      } catch (error) {
        toast(
          error instanceof Error ? error.message : 'Directory operation failed'
        );
        return undefined;
      }
    },
    [node, onDrop]
  );

  const handleDropEffectOnChildren =
    useCallback<NavigationPanelTreeNodeDropEffect>(
      data => {
        if (
          data.treeInstruction?.type === 'reorder-above' ||
          data.treeInstruction?.type === 'reorder-below'
        ) {
          if (data.source.data.entity?.type === 'folder') {
            if (
              node.id === data.source.data.entity.id ||
              node.beChildOf(data.source.data.entity.id)
            ) {
              return;
            }
            return 'move';
          } else if (
            data.source.data.from?.at ===
            'navigation-panel:organize:folder-node'
          ) {
            return 'move';
          } else if (
            data.source.data.entity?.type === 'collection' ||
            data.source.data.entity?.type === 'doc' ||
            data.source.data.entity?.type === 'tag'
          ) {
            return 'link';
          }
        } else if (data.treeInstruction?.type === 'reparent') {
          const currentLevel = data.treeInstruction.currentLevel;
          const desiredLevel = data.treeInstruction.desiredLevel;
          if (currentLevel === desiredLevel + 1) {
            dropEffect?.({
              ...data,
              treeInstruction: {
                type: 'reorder-below',
                currentLevel,
                indentPerLevel: data.treeInstruction.indentPerLevel,
              },
            });
            return;
          } else {
            dropEffect?.({
              ...data,
              treeInstruction: {
                ...data.treeInstruction,
                currentLevel: currentLevel - 1,
              },
            });
          }
        }
        return;
      },
      [dropEffect, node]
    );

  const handleCanDrop = useMemo<DropTargetOptions<AffineDNDData>['canDrop']>(
    () => args => {
      const entityType = args.source.data.entity?.type;
      if (args.treeInstruction && args.treeInstruction?.type !== 'make-child') {
        return (
          (typeof canDrop === 'function' ? canDrop(args) : canDrop) ?? true
        );
      }

      if (args.source.data.entity?.type === 'folder') {
        if (
          node.id === args.source.data.entity.id ||
          node.beChildOf(args.source.data.entity.id)
        ) {
          return false;
        }
        return true;
      } else if (
        args.source.data.from?.at === 'navigation-panel:organize:folder-node'
      ) {
        return true;
      } else if (
        entityType === 'collection' ||
        entityType === 'doc' ||
        entityType === 'tag'
      ) {
        return true;
      }
      return false;
    },
    [canDrop, node]
  );

  const handleChildrenCanDrop = useMemo<
    DropTargetOptions<AffineDNDData>['canDrop']
  >(
    () => args => {
      const entityType = args.source.data.entity?.type;

      if (args.source.data.entity?.type === 'folder') {
        if (
          node.id === args.source.data.entity.id ||
          node.beChildOf(args.source.data.entity.id)
        ) {
          return false;
        }
        return true;
      } else if (
        args.source.data.from?.at === 'navigation-panel:organize:folder-node'
      ) {
        return true;
      } else if (
        entityType === 'collection' ||
        entityType === 'doc' ||
        entityType === 'tag'
      ) {
        return true;
      }
      return false;
    },
    [node]
  );

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

  const handleCreateSubfolder = useCallback(async () => {
    try {
      const newFolderId = await node.createFolder(
        t['com.affine.rootAppSidebar.organize.new-folders'](),
        node.indexAt('before')
      );
      track.$.navigationPanel.organize.createOrganizeItem({ type: 'folder' });
      setCollapsed(false);
      setNewFolderId(newFolderId);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'Directory operation failed'
      );
      return undefined;
    }
  }, [node, setCollapsed, t]);

  const handleAddToFolder = useCallback(
    (type: 'doc' | 'collection' | 'tag') => {
      const initialIds = children
        .filter(node => node.type$.value === type)
        .map(node => node.data$.value)
        .filter(Boolean) as string[];
      const selector =
        type === 'doc'
          ? 'doc-selector'
          : type === 'collection'
            ? 'collection-selector'
            : 'tag-selector';
      workspaceDialogService.open(
        selector,
        {
          init: initialIds,
        },
        selectedIds => {
          (async () => {
            try {
              if (selectedIds === undefined) {
                return;
              }
              const newItemIds = difference(selectedIds, initialIds);
              const removedItemIds = difference(initialIds, selectedIds);
              const removedItems = children.filter(
                node =>
                  !!node.data$.value &&
                  removedItemIds.includes(node.data$.value)
              );

              for (const id of newItemIds) {
                await node.createLink(type, id, node.indexAt('after'));
              }
              for (const item of removedItems) await item.delete();
              const updated = newItemIds.length + removedItems.length;
              updated && setCollapsed(false);
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
    [children, node, setCollapsed, workspaceDialogService]
  );

  const folderOperations = useMemo(() => {
    if (!canMutate)
      return [
        {
          index: 200,
          view: node.id ? <FavoriteFolderOperation id={node.id} /> : null,
        },
      ];
    return [
      {
        index: 0,
        inline: true,
        view: (
          <IconButton
            size="16"
            onClick={() => {
              handleNewDoc().catch(console.error);
            }}
            tooltip={t[
              'com.affine.rootAppSidebar.explorer.organize-add-tooltip'
            ]()}
          >
            <PlusIcon />
          </IconButton>
        ),
      },
      {
        index: 100,
        view: (
          <MenuItem
            prefixIcon={<FolderIcon />}
            onClick={() => {
              handleCreateSubfolder().catch(console.error);
            }}
          >
            {t['com.affine.rootAppSidebar.organize.folder.create-subfolder']()}
          </MenuItem>
        ),
      },
      {
        index: 101,
        view: (
          <MenuItem
            prefixIcon={<PageIcon />}
            onClick={() => handleAddToFolder('doc')}
          >
            {t['com.affine.rootAppSidebar.organize.folder.add-docs']()}
          </MenuItem>
        ),
      },
      {
        index: 102,
        view: (
          <MenuSub
            triggerOptions={{
              prefixIcon: <PlusThickIcon />,
            }}
            items={
              <>
                <MenuItem
                  onClick={() => handleAddToFolder('tag')}
                  prefixIcon={<TagsIcon />}
                >
                  {t['com.affine.rootAppSidebar.organize.folder.add-tags']()}
                </MenuItem>
                <MenuItem
                  onClick={() => handleAddToFolder('collection')}
                  prefixIcon={<AnimatedCollectionsIcon closed={false} />}
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
        view: node.id ? <FavoriteFolderOperation id={node.id} /> : null,
      },

      {
        index: 9999,
        view: <MenuSeparator key="menu-separator" />,
      },
      {
        index: 10000,
        view: (
          <MenuItem
            type={'danger'}
            prefixIcon={<DeleteIcon />}
            onClick={() => {
              handleDelete().catch(console.error);
            }}
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
    ];
  }, [
    canMutate,
    canDelete,
    handleAddToFolder,
    handleCreateSubfolder,
    handleDelete,
    handleNewDoc,
    node,
    t,
  ]);

  const finalOperations = useMemo(() => {
    if (!canMutate) return folderOperations;
    if (additionalOperations) {
      return [...additionalOperations, ...folderOperations];
    }
    return folderOperations;
  }, [additionalOperations, folderOperations, canMutate]);

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
        setNewFolderId(null); // reset new folder id to clear the renaming state
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
      dndData={dndData}
      onDrop={(...args) => {
        handleDropOnFolder(...args).catch(console.error);
      }}
      defaultRenaming={defaultRenaming}
      renameable={canMutate}
      extractEmojiAsIcon={enableEmojiIcon}
      reorderable={canMutate && reorderable}
      collapsed={collapsed}
      setCollapsed={handleCollapsedChange}
      onRename={(...args) => {
        handleRename(...args).catch(console.error);
      }}
      operations={finalOperations}
      canDrop={canMutate ? handleCanDrop : () => false}
      childrenPlaceholder={
        <FolderEmpty
          canDrop={canMutate ? handleCanDrop : () => false}
          onDrop={(...args) => {
            handleDropOnPlaceholder(...args).catch(console.error);
          }}
        />
      }
      dropEffect={handleDropEffect}
      data-testid={`navigation-panel-folder-${node.id}`}
      explorerIconConfig={
        canMutate && node.id ? { where: 'folder', id: node.id } : null
      }
    >
      {children.map(child => (
        <NavigationPanelFolderNode
          key={child.id}
          nodeId={child.id as string}
          defaultRenaming={child.id === newFolderId}
          onDrop={(data, child?: FolderNode) => {
            handleDropOnChildren(data, child).catch(console.error);
          }}
          operations={childrenOperations}
          dropEffect={handleDropEffectOnChildren}
          canDrop={handleChildrenCanDrop}
          location={{
            at: 'navigation-panel:organize:folder-node',
            nodeId: child.id as string,
          }}
          parentPath={path}
        />
      ))}
    </NavigationPanelTreeNode>
  );
};
