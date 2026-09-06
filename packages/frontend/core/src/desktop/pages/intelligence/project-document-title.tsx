import type { Workspace } from '@affine/core/modules/workspace';
import { useCallback, useSyncExternalStore } from 'react';

import { isWorkbenchDocumentOpenable, type WorkbenchDocument } from './types';

export const ProjectDocumentTitle = ({
  document,
  workspace,
  fallback,
  untitled,
}: {
  document: WorkbenchDocument;
  workspace?: Workspace;
  fallback: string;
  untitled: string;
}) => {
  const meta =
    isWorkbenchDocumentOpenable(document) &&
    workspace?.id === document.workspaceId
      ? workspace.docCollection.meta
      : undefined;
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = meta?.docMetaUpdated.subscribe(onChange);
      return () => subscription?.unsubscribe();
    },
    [meta]
  );
  const getTitle = useCallback(
    () =>
      document.docId ? meta?.getDocMeta(document.docId)?.title : undefined,
    [document.docId, meta]
  );
  const title = useSyncExternalStore(subscribe, getTitle, getTitle);
  const displayTitle = title === undefined ? fallback : title || untitled;
  return <span title={displayTitle}>{displayTitle}</span>;
};
