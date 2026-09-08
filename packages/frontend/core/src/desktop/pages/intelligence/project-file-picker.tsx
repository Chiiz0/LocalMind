import { Button, Input, Loading, Modal, notify } from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { UserFriendlyError } from '@affine/error';
import { searchProjectResourcesQuery } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { useDeferredValue, useRef, useState } from 'react';

import { ProjectFileSelectionTree } from './project-files';
import * as styles from './project-files.css';

export function ProjectFilePicker({
  projectId,
  initialSelection,
  limit,
  onSave,
  onClose,
}: {
  projectId: string;
  initialSelection: string[];
  limit: number;
  onSave: (ids: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const t = useI18n();
  const [selected, setSelected] = useState(new Set(initialSelection));
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim());
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const results = useQuery(
    query
      ? {
          query: searchProjectResourcesQuery,
          variables: { projectId, query, limit: 50, cursor: cursors.at(-1) },
        }
      : undefined,
    { suspense: false, shouldRetryOnError: false }
  );
  const toggle = (id: string) => {
    if (pendingRef.current) return;
    setSelected(current => {
      const next = new Set(current);
      if (!next.delete(id) && next.size < limit) next.add(id);
      return next;
    });
  };
  const report = (caught: unknown) => {
    const friendly = UserFriendlyError.fromAny(caught);
    const message =
      t[
        friendly.isStatus(409)
          ? 'com.affine.localmind.project-files.conflict'
          : 'com.affine.localmind.project-files.operationFailed'
      ]();
    setError(message);
    notify.error({ title: message });
  };
  const save = async () => {
    if (pendingRef.current) return;
    if (
      JSON.stringify([...selected].sort()) ===
      JSON.stringify([...initialSelection].sort())
    ) {
      onClose();
      return;
    }
    pendingRef.current = true;
    setPending(true);
    try {
      await onSave([...selected]);
      onClose();
    } catch (caught) {
      report(caught);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  return (
    <Modal
      open
      title={t['com.affine.localmind.aiContext.selectDocuments']()}
      onOpenChange={open => {
        if (!open && !pendingRef.current) onClose();
      }}
    >
      <div className={styles.form}>
        <Input
          value={search}
          onChange={value => {
            setSearch(value);
            setCursors([undefined]);
          }}
          maxLength={128}
          aria-label={t['com.affine.editCollection.search.placeholder']()}
          placeholder={t['com.affine.editCollection.search.placeholder']()}
        />
        <span role="status">
          {t['com.affine.localmind.project-files.selectionCount']({
            count: String(selected.size),
            limit: String(limit),
          })}
        </span>
        <div style={{ minHeight: 180, maxHeight: 360, overflow: 'auto' }}>
          {!query ? (
            <ProjectFileSelectionTree
              projectId={projectId}
              selected={selected}
              disabled={pending}
              limit={limit}
              onToggle={toggle}
            />
          ) : results.isLoading ? (
            <Loading size={24} />
          ) : results.error ? (
            <div role="alert">
              {t['com.affine.localmind.project-files.operationFailed']()}
              <Button onClick={() => void results.mutate().catch(report)}>
                {t['com.affine.localmind.project-files.retry']()}
              </Button>
            </div>
          ) : (
            <>
              <ul className={styles.list}>
                {results.data?.searchProjectResources.items.map(item => (
                  <li key={item.id}>
                    <label className={styles.row}>
                      <input
                        type="checkbox"
                        className={styles.selectionCheckbox}
                        checked={selected.has(item.id)}
                        disabled={
                          pending ||
                          (!selected.has(item.id) && selected.size >= limit)
                        }
                        onChange={() => toggle(item.id)}
                      />
                      <span className={styles.title}>
                        {item.path.map(part => part.title).join(' / ')}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {!results.data?.searchProjectResources.items.length ? (
                <div className={styles.state}>
                  {t['com.affine.localmind.project-files.empty']()}
                </div>
              ) : null}
              <div className={styles.actions}>
                {cursors.length > 1 ? (
                  <Button
                    onClick={() => setCursors(current => current.slice(0, -1))}
                  >
                    {t['com.affine.localmind.documentCreation.previous']()}
                  </Button>
                ) : null}
                {results.data?.searchProjectResources.nextCursor ? (
                  <Button
                    onClick={() =>
                      setCursors(current => [
                        ...current,
                        results.data?.searchProjectResources.nextCursor ??
                          undefined,
                      ])
                    }
                  >
                    {t['com.affine.localmind.project-files.more']()}
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <div className={styles.actions}>
          <Button disabled={pending} onClick={onClose}>
            {t['Cancel']()}
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={pending}
            onClick={() => void save()}
          >
            {t['com.affine.localmind.project-files.save']()}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
