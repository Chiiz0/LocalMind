import { Button, IconButton, Loading } from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { GraphQLService } from '@affine/core/modules/cloud';
import {
  changeProjectResourceMigrationMutation,
  discoverProjectResourceMigrationsMutation,
  type ProjectResourceMigrationFieldsFragment,
  projectResourceMigrationsQuery,
  requestProjectMigrationPermissionMutation,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { ResetIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useEffect, useRef, useState } from 'react';

import { projectFilesChanged } from './project-files-data';
import * as styles from './project-publications.css';

type Props = { projectId: string; onOpen: (resourceId: string) => void };

export function ProjectMigrations(props: Props) {
  return <MigrationList key={props.projectId} {...props} />;
}

function MigrationList({ projectId, onOpen }: Props) {
  const t = useI18n();
  const graphql = useService(GraphQLService);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const submitting = useRef(false);
  const seen = useRef(new Set<string>());
  const keys = useRef(new Map<string, string>());
  const query = useQuery(
    open
      ? {
          query: projectResourceMigrationsQuery,
          variables: { projectId, cursor },
        }
      : undefined,
    { suspense: false, shouldRetryOnError: false, refreshInterval: 3000 }
  );
  const items = (
    query.error ? [] : (query.data?.projectResourceMigrations.items ?? [])
  ).filter(row => row.projectId === projectId);
  useEffect(() => {
    if (query.error) return;
    for (const row of query.data?.projectResourceMigrations.items ?? []) {
      if (
        row.projectId === projectId &&
        row.status === 'complete' &&
        !seen.current.has(row.id)
      ) {
        seen.current.add(row.id);
        projectFilesChanged(projectId);
      }
    }
  }, [projectId, query.data, query.error]);
  const run = async (operation: () => Promise<unknown>) => {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      await operation();
      await query.mutate();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };
  const discover = () =>
    run(() =>
      graphql.gql({
        query: discoverProjectResourceMigrationsMutation,
        variables: { projectId },
      })
    );
  const change = (
    row: ProjectResourceMigrationFieldsFragment,
    action: 'retry' | 'cancel'
  ) =>
    run(async () => {
      const result = await graphql.gql({
        query: changeProjectResourceMigrationMutation,
        variables: {
          projectId,
          migrationId: row.id,
          expectedRevision: row.revision,
          action,
        },
      });
      keys.current.delete(row.id);
      setOutcomes(current => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      return result;
    });
  const request = (row: ProjectResourceMigrationFieldsFragment) =>
    run(async () => {
      const requestKey = keys.current.get(row.id) ?? crypto.randomUUID();
      keys.current.set(row.id, requestKey);
      const response = await graphql.gql({
        query: requestProjectMigrationPermissionMutation,
        variables: {
          projectId,
          migrationId: row.id,
          requestKey,
        },
      });
      setOutcomes(current => ({
        ...current,
        [row.id]: response.requestProjectMigrationPermission.status,
      }));
      if (response.requestProjectMigrationPermission.status !== 'pending')
        keys.current.delete(row.id);
    });
  const status = (value: string) => {
    switch (value) {
      case 'pending':
        return t['com.affine.localmind.migrations.pending']();
      case 'running':
        return t['com.affine.localmind.migrations.running']();
      case 'waiting_for_authorization':
        return t['com.affine.localmind.migrations.authorization']();
      case 'complete':
        return t['com.affine.localmind.migrations.complete']();
      case 'cancelled':
        return t['com.affine.localmind.migrations.cancelled']();
      default:
        return t['com.affine.localmind.migrations.failed']();
    }
  };
  return (
    <details
      className={styles.panel}
      onToggle={event => {
        setOpen(event.currentTarget.open);
        if (event.currentTarget.open)
          void discover().catch(error => setError(String(error)));
      }}
    >
      <summary className={styles.header}>
        {t['com.affine.localmind.migrations.title']()}
      </summary>
      {open ? (
        <>
          <div className={styles.header}>
            <IconButton
              size="20"
              icon={<ResetIcon />}
              disabled={pending}
              tooltip={t['com.affine.localmind.project-files.reload']()}
              aria-label={t['com.affine.localmind.project-files.reload']()}
              onClick={() => void discover()}
            />
            {query.isLoading || pending ? <Loading size={16} /> : null}
          </div>
          {query.error || error ? (
            <div role="alert" className={styles.error}>
              {error ?? query.error?.message}
            </div>
          ) : null}
          {!query.isLoading && !query.error && !items.length ? (
            <p className={styles.meta}>
              {t['com.affine.localmind.migrations.empty']()}
            </p>
          ) : null}
          <ul className={styles.rows}>
            {items.map((row, index) => (
              <li
                key={row.id}
                className={styles.row}
                data-migration-id={row.id}
              >
                <div className={styles.title}>
                  {row.title ??
                    `${t['com.affine.localmind.migrations.source']()} ${index + 1}`}
                  <div className={styles.meta}>{status(row.status)}</div>
                  {outcomes[row.id] ? (
                    <div className={styles.meta} role="status">
                      {outcomes[row.id] === 'approved'
                        ? t[
                            'com.affine.localmind.migrations.permissionApproved'
                          ]()
                        : outcomes[row.id] === 'rejected'
                          ? t[
                              'com.affine.localmind.migrations.permissionRejected'
                            ]()
                          : t[
                              'com.affine.localmind.migrations.permissionPending'
                            ]()}
                    </div>
                  ) : null}
                  <div className={styles.footer}>
                    {row.resourceId ? (
                      <Button
                        onClick={() => row.resourceId && onOpen(row.resourceId)}
                      >
                        {t['com.affine.localmind.project-files.open']()}
                      </Button>
                    ) : null}
                    {[
                      'waiting_for_authorization',
                      'failed',
                      'cancelled',
                    ].includes(row.status) ? (
                      <Button
                        disabled={pending}
                        onClick={() => void change(row, 'retry')}
                      >
                        {t['com.affine.localmind.project-files.retry']()}
                      </Button>
                    ) : null}
                    {row.status === 'waiting_for_authorization' ? (
                      <Button
                        disabled={pending}
                        onClick={() => void request(row)}
                      >
                        {t['com.affine.localmind.migrations.request']()}
                      </Button>
                    ) : null}
                    {[
                      'pending',
                      'waiting_for_authorization',
                      'failed',
                    ].includes(row.status) ? (
                      <Button
                        disabled={pending}
                        onClick={() => void change(row, 'cancel')}
                      >
                        {t['com.affine.localmind.project-files.cancel']()}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className={styles.footer}>
            {cursor ? (
              <Button onClick={() => setCursor(undefined)}>
                {t['com.affine.localmind.project-tasks.latest']()}
              </Button>
            ) : null}
            {query.data?.projectResourceMigrations.nextCursor ? (
              <Button
                onClick={() =>
                  setCursor(
                    query.data?.projectResourceMigrations.nextCursor ??
                      undefined
                  )
                }
              >
                {t['com.affine.localmind.project-files.more']()}
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </details>
  );
}
