import { Tooltip } from '@affine/component';
import { Loading } from '@affine/component/ui/loading';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { DoneIcon, UnsyncIcon } from '@blocksuite/icons/rc';
import { LiveData, useLiveData, useService } from '@toeverything/infra';
import { useMemo } from 'react';

export function DocSaveStatus({ docId }: { docId: string }) {
  const { workspace } = useService(WorkspaceService);
  const t = useI18n();
  const state = useLiveData(
    useMemo(
      () => LiveData.from(workspace.engine.doc.docState$(docId), null),
      [workspace, docId]
    )
  );
  const busy = !state?.loaded || state.updating;
  const key = !state?.loaded
    ? 'loading'
    : state.updating
      ? 'saving'
      : workspace.flavour === 'local'
        ? 'local'
        : state.syncRetrying
          ? 'retrying'
          : state.syncing || !state.synced
            ? 'pending'
            : 'synced';
  const label = t[`com.affine.doc-save.${key}`]();
  return (
    <Tooltip content={label}>
      <span
        role="status"
        aria-label={label}
        data-testid="doc-save-status"
        data-state={key}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 28px',
          width: 28,
          height: 28,
          fontSize: 20,
          color: 'var(--affine-text-secondary-color)',
        }}
      >
        {busy ? (
          <Loading size={16} />
        ) : key === 'retrying' || key === 'pending' ? (
          <UnsyncIcon />
        ) : (
          <DoneIcon />
        )}
      </span>
    </Tooltip>
  );
}
