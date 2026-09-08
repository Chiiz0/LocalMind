import { Button, notify } from '@affine/component';
import type { ProjectEditLeaseProofInput } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { GraphQLService } from '../cloud';
import { projectEditLeaseStore, projectEditorTabId } from './edit-lease-store';
import { useProjectRefresh } from './realtime';

export { projectEditorTabId } from './edit-lease-store';
const LeaseContext = createContext<{
  proof: ProjectEditLeaseProofInput | null;
  tabId: string;
} | null>(null);
export function useProjectEditLease() {
  return useContext(LeaseContext);
}

export function ProjectResourceEditLeaseProvider({
  projectId,
  resourceId,
  children,
}: PropsWithChildren<{ projectId: string; resourceId: string }>) {
  const t = useI18n();
  const graphql = useService(GraphQLService);
  const store = useMemo(
    () => projectEditLeaseStore(graphql, projectId, resourceId),
    [graphql, projectId, resourceId]
  );
  const { lease, proof, pending, error } = useSyncExternalStore(
    store.subscribe,
    store.snapshot
  );
  const context = useMemo(
    () => ({ proof, tabId: projectEditorTabId() }),
    [proof]
  );
  const [watching, setWatching] = useState(false);
  const previous = useRef(lease);
  const messages = useRef(t);
  messages.current = t;
  useProjectRefresh(projectId, 'lease', store.refresh);
  useEffect(() => {
    const release = store.retain();
    previous.current = null;
    setWatching(false);
    return () => {
      void release().catch(store.report);
    };
  }, [store]);
  useEffect(() => {
    if (error)
      notify.error({
        title: messages.current['com.affine.localmind.project-lease.failed'](),
      });
  }, [error]);
  useEffect(() => {
    const aiFinished = previous.current?.kind === 'ai_task' && !lease;
    if (previous.current && !previous.current.owned && !lease && watching) {
      setWatching(false);
      notify.success({
        title:
          messages.current['com.affine.localmind.project-lease.available'](),
      });
    }
    previous.current = lease;
    if (aiFinished) void store.acquire().catch(store.report);
  }, [lease, store, watching]);
  return (
    <LeaseContext.Provider value={context}>
      {!proof ? (
        <div
          role="status"
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: 8,
          }}
        >
          <span>
            {pending
              ? t['com.affine.localmind.project-lease.acquiring']()
              : error
                ? t['com.affine.localmind.project-lease.failed']()
                : lease
                  ? lease.kind === 'ai_task'
                    ? t['com.affine.localmind.project-lease.aiWriting']()
                    : t['com.affine.localmind.project-lease.heldBy']({
                        name: lease.holderName,
                      })
                  : t['com.affine.localmind.project-lease.available']()}
          </span>
          {lease && !lease.owned ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                style={{
                  appearance: 'auto',
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                }}
                checked={watching}
                onChange={event => setWatching(event.target.checked)}
              />
              {t['com.affine.localmind.project-lease.notify']()}
            </label>
          ) : null}
          {!pending && (!lease || error) ? (
            <Button onClick={() => void store.acquire().catch(store.report)}>
              {t['com.affine.localmind.project-lease.edit']()}
            </Button>
          ) : null}
        </div>
      ) : null}
      {children}
    </LeaseContext.Provider>
  );
}
