import { useDraggable, useDropTarget } from '@affine/component';
import type { PropsWithChildren } from 'react';

import * as styles from './project-files.css';
import type { ProjectFile } from './project-files-data';

type ProjectDrag = {
  draggable: { type: 'project-resource'; projectId: string; file: ProjectFile };
  dropTarget: { resourceId: string };
};

export function ProjectFolderDropTarget({
  projectId,
  parentId,
  trash,
  onMove,
  children,
}: PropsWithChildren<{
  projectId: string;
  parentId: string | null;
  trash: boolean;
  onMove: (
    file: ProjectFile,
    change: { parentId: string | null; beforeId: string | null }
  ) => void;
}>) {
  const { dropTargetRef, draggedOver } = useDropTarget<ProjectDrag>(
    () => ({
      data: { resourceId: parentId ?? '' },
      canDrop: ({ source }) =>
        !trash &&
        source.data.type === 'project-resource' &&
        source.data.projectId === projectId &&
        source.data.file.id !== parentId,
      onDrop: ({ source }) =>
        onMove(source.data.file, { parentId, beforeId: null }),
    }),
    [projectId, parentId, trash, onMove]
  );
  return (
    <div
      ref={dropTargetRef}
      className={styles.fileScroll}
      data-drop={draggedOver ? 'make-child' : undefined}
    >
      {children}
    </div>
  );
}

export function ProjectFileDropTarget({
  file,
  nextId,
  pending,
  trash,
  onMove,
  onFiles,
  readOnly,
  children,
}: PropsWithChildren<{
  file: ProjectFile;
  nextId: string | null;
  pending: boolean;
  trash: boolean;
  onMove: (
    file: ProjectFile,
    change: { parentId: string | null; beforeId: string | null }
  ) => void;
  onFiles: (files: File[], parentId: string | null) => void;
  readOnly?: boolean;
}>) {
  const folder = file.kind === 'folder';
  const { dragRef, dragging } = useDraggable<ProjectDrag>(
    () => ({
      data: { type: 'project-resource', projectId: file.projectId, file },
      canDrag: !pending && !trash && !readOnly,
    }),
    [file, pending, trash, readOnly]
  );
  const { dropTargetRef, treeInstruction, draggedOver } =
    useDropTarget<ProjectDrag>(
      () => ({
        data: { resourceId: file.id },
        canDrop: ({ source }) =>
          !pending &&
          !trash &&
          !readOnly &&
          source.data.type === 'project-resource' &&
          source.data.projectId === file.projectId &&
          source.data.file.id !== file.id,
        treeInstruction: {
          currentLevel: 0,
          indentPerLevel: 20,
          mode: 'standard',
          block: folder ? ['reparent'] : ['reparent', 'make-child'],
        },
        onDrop: ({ source, treeInstruction }) => {
          if (!treeInstruction) return;
          const inside = treeInstruction.type === 'make-child';
          onMove(source.data.file, {
            parentId: inside ? file.id : file.parentId,
            beforeId: inside
              ? null
              : treeInstruction.type === 'reorder-above'
                ? file.id
                : nextId,
          });
        },
      }),
      [file, folder, nextId, onMove, pending, trash, readOnly]
    );
  return (
    <div
      ref={element => {
        dragRef.current = element;
        dropTargetRef.current = element;
      }}
      className={styles.row}
      data-dragging={dragging}
      data-drop={draggedOver ? treeInstruction?.type : undefined}
      aria-busy={pending}
      onDragOver={event => {
        if (!trash && !readOnly && event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={event => {
        if (!trash && !readOnly && event.dataTransfer.files.length) {
          event.preventDefault();
          event.stopPropagation();
          onFiles(
            Array.from(event.dataTransfer.files),
            folder ? file.id : file.parentId
          );
        }
      }}
    >
      {children}
    </div>
  );
}
