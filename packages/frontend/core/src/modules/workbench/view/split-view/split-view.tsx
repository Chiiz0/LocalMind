import { Checkbox, IconButton, notify, useDndMonitor } from '@affine/component';
import { useAppSettingHelper } from '@affine/core/components/hooks/affine/use-app-setting-helper';
import type { AffineDNDData } from '@affine/core/types/dnd';
import { useI18n } from '@affine/i18n';
import track from '@affine/track';
import { CloseIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import clsx from 'clsx';
import { useSetAtom } from 'jotai';
import { nanoid } from 'nanoid';
import type { HTMLAttributes } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import type { View } from '../../entities/view';
import { WorkbenchService } from '../../services/workbench';
import { SplitViewPanel } from './panel';
import * as styles from './split-view.css';
import { draggingOverResizeHandleAtom } from './state';
import { allowedSplitViewEntityTypes, inferToFromEntity } from './types';

export interface SplitViewProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * ⚠️ `vertical` orientation is not supported yet
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
  views: View[];
  renderer: (item: View) => React.ReactNode;
  onMove?: (from: number, to: number) => void;
}

export const SplitView = ({
  orientation = 'horizontal',
  className,
  views,
  renderer,
  onMove,
  ...attrs
}: SplitViewProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const { appSettings } = useAppSettingHelper();
  const workbench = useService(WorkbenchService).workbench;
  const activeView = useLiveData(workbench.activeView$);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setCompact(entry.contentRect.width < 900)
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // workaround: blocksuite's lit host element has an issue on remounting.
  // we do not want the view to change its render ordering here after reordering
  // instead we use a local state to store the views + its order to avoid remounting
  const [localViewsState, setLocalViewsState] = useState<View[]>(views);

  useLayoutEffect(() => {
    setLocalViewsState(oldViews => {
      let newViews = oldViews.filter(v => views.includes(v));

      for (const view of views) {
        if (!newViews.includes(view)) {
          newViews.push(view);
        }
      }

      return newViews;
    });
  }, [views]);

  const onResizing = useCallback(
    (index: number, { x, y }: { x: number; y: number }) => {
      const rootEl = rootRef.current;
      if (!rootEl) return;

      const rootRect = rootEl.getBoundingClientRect();
      const offset = orientation === 'horizontal' ? x : y;
      const total =
        orientation === 'horizontal' ? rootRect.width : rootRect.height;

      const percent = offset / total;
      workbench.resize(index, percent);
    },
    [orientation, workbench]
  );

  const handleOnMove = useCallback(
    (from: number, to: number) => {
      onMove?.(from, to);
    },
    [onMove]
  );

  const [draggingEntity, setDraggingEntity] = useState(false);

  const setDraggingOverResizeHandle = useSetAtom(draggingOverResizeHandleAtom);

  const t = useI18n();
  const hideFolderWarningRef = useRef(false);

  useDndMonitor<AffineDNDData>(() => {
    return {
      canMonitor(data) {
        if (compact) {
          return false;
        }
        // allow dropping doc && tab view to split view panel
        const from = data.source.data.from;
        const entity = data.source.data.entity;
        if (from?.at === 'app-header:tabs') {
          return false;
        } else if (
          entity?.type &&
          (allowedSplitViewEntityTypes.has(entity?.type) ||
            // will show a toast warning for folder for now
            entity?.type === 'folder')
        ) {
          return true;
        } else if (from?.at === 'workbench:link') {
          return true;
        }
        return false;
      },
      onDragStart() {
        setDraggingEntity(true);
      },
      onDrop(data) {
        setDraggingEntity(false);

        if (data.source.data.entity?.type === 'folder') {
          if (hideFolderWarningRef.current) {
            return;
          }
          const toastid = nanoid();
          const showOrUpdateWarning = () => {
            notify.warning(
              {
                title: t['tips'](),
                message: (
                  <div className={styles.folderWarningMessage}>
                    <p>
                      {t['com.affine.split-view-folder-warning.description']()}
                    </p>
                    <p>
                      <Checkbox
                        checked={hideFolderWarningRef.current}
                        onClick={() => {
                          hideFolderWarningRef.current =
                            !hideFolderWarningRef.current;
                          showOrUpdateWarning();
                        }}
                        label={t['do-not-show-this-again']()}
                      />
                    </p>
                  </div>
                ),
                theme: 'info',
              },
              {
                id: toastid,
              }
            );
          };

          showOrUpdateWarning();
          return;
        }

        const candidate = data.location.current.dropTargets.find(
          target => target.data.at === 'workbench:resize-handle'
        );

        if (!candidate) {
          return;
        }

        const dropTarget = candidate.data as AffineDNDData['draggable']['from'];
        const entity = data.source.data.entity;
        const from = data.source.data.from;

        if (
          dropTarget?.at === 'workbench:resize-handle' &&
          entity?.type !== 'custom-property'
        ) {
          const { edge, viewId } = dropTarget;
          const index = views.findIndex(v => v.id === viewId);
          const at = (() => {
            if (edge === 'left') {
              if (index === 0) {
                return 'head';
              }
              return index - 1;
            } else if (edge === 'right') {
              if (index === views.length - 1) {
                return 'tail';
              }
              return index + 1;
            } else {
              return 'tail';
            }
          })();

          const to = entity
            ? inferToFromEntity(entity)
            : from?.at === 'workbench:link'
              ? from.to
              : null;

          if (to) {
            workbench.createView(at, to);
            track.$.splitViewIndicator.$.openInSplitView({
              type: entity?.type,
              route: to,
            });
          }
        }
      },
      onDropTargetChange(data) {
        const candidate = data.location.current.dropTargets.find(
          target => target.data.at === 'workbench:resize-handle'
        );

        if (!candidate) {
          setDraggingOverResizeHandle(null);
          return;
        }

        setDraggingOverResizeHandle({
          viewId: candidate.data.viewId as string,
          edge: candidate.data.edge as 'left' | 'right',
        });
      },
    };
  }, [compact]);

  return (
    <div
      ref={rootRef}
      className={clsx(styles.splitViewRoot, className)}
      data-orientation={orientation}
      data-client-border={appSettings.clientBorder}
      data-compact={compact && views.length > 1}
      {...attrs}
    >
      {compact && views.length > 1 && (
        <div className={styles.compactTabs} role="tablist">
          {views.map(view => (
            <CompactViewTab
              key={view.id}
              view={view}
              active={view === activeView}
              onSelect={() => workbench.active(view)}
              onClose={() => workbench.close(view)}
            />
          ))}
        </div>
      )}
      {localViewsState.map(view => {
        const order = views.indexOf(view);
        return (
          <SplitViewPanel
            view={view}
            index={order}
            key={view.id}
            onMove={handleOnMove}
            onResizing={dxy => onResizing(order, dxy)}
            draggingEntity={draggingEntity}
            compact={compact && views.length > 1}
          >
            {renderer(view)}
          </SplitViewPanel>
        );
      })}
    </div>
  );
};

function CompactViewTab({
  view,
  active,
  onSelect,
  onClose,
}: {
  view: View;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const title = useLiveData(view.title$);
  const t = useI18n();
  return (
    <div className={styles.compactTab} data-active={active}>
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={onSelect}
      >
        {title || t['Untitled']()}
      </button>
      <IconButton
        size="20"
        tooltip={t['com.affine.workbench.split-view-menu.close']()}
        onClick={onClose}
      >
        <CloseIcon />
      </IconButton>
    </div>
  );
}
