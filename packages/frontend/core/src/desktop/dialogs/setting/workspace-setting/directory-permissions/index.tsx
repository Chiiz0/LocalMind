import { Button, Checkbox, Loading, notify } from '@affine/component';
import {
  SettingHeader,
  SettingWrapper,
} from '@affine/component/setting-components';
import { GraphQLService } from '@affine/core/modules/cloud';
import { WorkspacePermissionService } from '@affine/core/modules/permissions';
import { NbstoreService } from '@affine/core/modules/storage';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { UserFriendlyError } from '@affine/error';
import {
  changeWorkspaceDirectoryPolicyMutation,
  type WorkspaceDirectoryAdministrationQuery,
  workspaceDirectoryAdministrationQuery,
  type WorkspaceDirectoryRightsInput,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import * as styles from './styles.css';

type Snapshot =
  WorkspaceDirectoryAdministrationQuery['workspaceDirectoryAdministration'];
type Policy = Snapshot['policies'][number];
type AuditEvent = Snapshot['auditEvents'][number];
type RightKey = keyof WorkspaceDirectoryRightsInput;

const ROOT_DIRECTORY_ID = '$root';
const ALL_MEMBERS_ID = '*';
const DEFAULT_RIGHTS: WorkspaceDirectoryRightsInput = {
  canRead: true,
  canWrite: true,
  canOrganize: true,
  canCreateFolder: true,
};

export const directoryPolicyKey = (directoryId: string, principalId: string) =>
  `${directoryId}\u0000${principalId}`;

export const mergeDirectoryAuditEvents = (
  current: AuditEvent[],
  incoming: AuditEvent[]
) => {
  const events = new Map(current.map(event => [event.id, event]));
  for (const event of incoming) events.set(event.id, event);
  return [...events.values()].sort((left, right) =>
    left.createdAt === right.createdAt
      ? right.id.localeCompare(left.id)
      : right.createdAt.localeCompare(left.createdAt)
  );
};

export const formatDirectoryRights = (
  rights: WorkspaceDirectoryRightsInput,
  labels: Record<RightKey, string>
) =>
  (Object.keys(labels) as RightKey[])
    .filter(key => rights[key])
    .map(key => labels[key])
    .join(' · ');

export const WorkspaceDirectoryPermissions = () => {
  const t = useI18n();
  const graphql = useService(GraphQLService);
  const nbstore = useService(NbstoreService);
  const workspace = useService(WorkspaceService).workspace;
  const permission = useService(WorkspacePermissionService).permission;
  const canManage = useLiveData(permission.isOwnerOrAdmin$);
  const [loadedSnapshot, setLoadedSnapshot] = useState<{
    workspaceId: string;
    value: Snapshot;
  }>();
  const snapshot =
    loadedSnapshot?.workspaceId === workspace.id
      ? loadedSnapshot.value
      : undefined;
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditNextCursor, setAuditNextCursor] = useState<string | null>(null);
  const [selectedDirectoryId, setSelectedDirectoryId] =
    useState(ROOT_DIRECTORY_ID);
  const [selectedPrincipalId, setSelectedPrincipalId] =
    useState(ALL_MEMBERS_ID);
  const [draft, setDraft] = useState<WorkspaceDirectoryRightsInput>({
    ...DEFAULT_RIGHTS,
  });
  const [draftPolicyKey, setDraftPolicyKey] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const load = useCallback(
    async (auditAfter?: string) => {
      const current = ++request.current;
      if (auditAfter) setLoadingMore(true);
      else setLoading(true);
      try {
        const result = await graphql.gql({
          query: workspaceDirectoryAdministrationQuery,
          variables: { workspaceId: workspace.id, auditAfter },
        });
        if (request.current !== current) return;
        const next = result.workspaceDirectoryAdministration;
        setLoadedSnapshot({ workspaceId: workspace.id, value: next });
        setAuditEvents(existing =>
          auditAfter
            ? mergeDirectoryAuditEvents(existing, next.auditEvents)
            : next.auditEvents
        );
        setAuditNextCursor(next.auditNextCursor);
        setError(null);
      } catch (caught) {
        if (request.current !== current) return;
        setError(UserFriendlyError.fromAny(caught).message);
      } finally {
        if (request.current === current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [graphql, workspace.id]
  );

  useEffect(() => {
    const requestRef = request;
    requestRef.current++;
    setLoadedSnapshot(undefined);
    setAuditEvents([]);
    setAuditNextCursor(null);
    setSelectedDirectoryId(ROOT_DIRECTORY_ID);
    setSelectedPrincipalId(ALL_MEMBERS_ID);
    setDraft({ ...DEFAULT_RIGHTS });
    setDraftPolicyKey(undefined);
    setError(null);
    setLoadingMore(false);
    if (workspace.flavour === 'local' || !canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load().catch(console.error);
    const subscription = nbstore.realtime
      .subscribe('workspace.directory-policy.changed', {
        workspaceId: workspace.id,
      })
      .subscribe({
        next: () => {
          load().catch(console.error);
        },
        error: () => {
          load().catch(console.error);
        },
      });
    return () => {
      requestRef.current++;
      subscription.unsubscribe();
    };
  }, [canManage, load, nbstore.realtime, workspace.flavour, workspace.id]);

  const policies = useMemo(
    () =>
      new Map(
        snapshot?.policies.map(policy => [
          directoryPolicyKey(policy.directoryId, policy.principalId),
          policy,
        ]) ?? []
      ),
    [snapshot]
  );
  const selectedPolicy = policies.get(
    directoryPolicyKey(selectedDirectoryId, selectedPrincipalId)
  );
  const selectedPolicyKey = directoryPolicyKey(
    selectedDirectoryId,
    selectedPrincipalId
  );

  useEffect(() => {
    setDraft({ ...(selectedPolicy?.rights ?? DEFAULT_RIGHTS) });
    setDraftPolicyKey(selectedPolicyKey);
  }, [selectedPolicy, selectedPolicyKey]);

  const directoryNames = useMemo(
    () =>
      new Map(
        snapshot?.directories.map(directory => [directory.id, directory.name])
      ),
    [snapshot]
  );
  const principalNames = useMemo(
    () =>
      new Map(
        snapshot?.principals.map(principal => [
          principal.id,
          principal.allMembers
            ? t['com.affine.localmind.directoryPermissions.allMembers']()
            : principal.name || principal.email || principal.id,
        ])
      ),
    [snapshot, t]
  );
  const rightLabels = useMemo<Record<RightKey, string>>(
    () => ({
      canRead: t['com.affine.localmind.directoryPermissions.read'](),
      canWrite: t['com.affine.localmind.directoryPermissions.write'](),
      canOrganize: t['com.affine.localmind.directoryPermissions.organize'](),
      canCreateFolder:
        t['com.affine.localmind.directoryPermissions.createFolder'](),
    }),
    [t]
  );

  const changePolicy = useCallback(
    async (rights: WorkspaceDirectoryRightsInput | null) => {
      if (!snapshot || saving || draftPolicyKey !== selectedPolicyKey) return;
      setSaving(true);
      try {
        await graphql.gql({
          query: changeWorkspaceDirectoryPolicyMutation,
          variables: {
            workspaceId: workspace.id,
            expectedRevision: snapshot.revision,
            directoryId: selectedDirectoryId,
            principalId: selectedPrincipalId,
            rights,
          },
        });
        await load();
        notify.success({
          title: rights
            ? t['com.affine.localmind.directoryPermissions.saved']()
            : t['com.affine.localmind.directoryPermissions.cleared'](),
        });
      } catch (caught) {
        const friendly = UserFriendlyError.fromAny(caught);
        notify.error({
          title: t['com.affine.localmind.directoryPermissions.saveFailed'](),
          message: friendly.message,
        });
        await load();
      } finally {
        setSaving(false);
      }
    },
    [
      graphql,
      load,
      saving,
      selectedDirectoryId,
      selectedPolicyKey,
      selectedPrincipalId,
      snapshot,
      draftPolicyKey,
      t,
      workspace.id,
    ]
  );

  if (workspace.flavour === 'local' || canManage === false) {
    return (
      <>
        <SettingHeader
          title={t['com.affine.localmind.directoryPermissions.title']()}
          subtitle={t['com.affine.localmind.directoryPermissions.subtitle']()}
        />
        <SettingWrapper>
          <div className={styles.state}>
            {t['com.affine.localmind.directoryPermissions.unavailable']()}
          </div>
        </SettingWrapper>
      </>
    );
  }

  return (
    <>
      <SettingHeader
        title={t['com.affine.localmind.directoryPermissions.title']()}
        subtitle={t['com.affine.localmind.directoryPermissions.subtitle']()}
      />
      <SettingWrapper
        title={t['com.affine.localmind.directoryPermissions.overrideTitle']()}
      >
        {loading && !snapshot ? (
          <div className={styles.state}>
            <Loading />
            {t['com.affine.localmind.directoryPermissions.loading']()}
          </div>
        ) : error && !snapshot ? (
          <div className={styles.error} role="alert">
            <span>{error}</span>
            <Button onClick={() => void load()} variant="secondary">
              {t['com.affine.localmind.directoryPermissions.retry']()}
            </Button>
          </div>
        ) : snapshot ? (
          <div className={styles.panel}>
            {error ? (
              <div className={styles.error} role="alert">
                <span>{error}</span>
                <Button onClick={() => void load()} variant="secondary">
                  {t['com.affine.localmind.directoryPermissions.retry']()}
                </Button>
              </div>
            ) : null}
            <div className={styles.controls}>
              <label className={styles.field}>
                <span className={styles.label}>
                  {t['com.affine.localmind.directoryPermissions.directory']()}
                </span>
                <select
                  className={styles.select}
                  data-testid="directory-policy-directory"
                  disabled={saving}
                  value={selectedDirectoryId}
                  onChange={event => setSelectedDirectoryId(event.target.value)}
                >
                  {snapshot.directories.map(directory => (
                    <option key={directory.id} value={directory.id}>
                      {directory.id === ROOT_DIRECTORY_ID
                        ? t['com.affine.localmind.directoryPermissions.root']()
                        : directory.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>
                  {t['com.affine.localmind.directoryPermissions.principal']()}
                </span>
                <select
                  className={styles.select}
                  data-testid="directory-policy-principal"
                  disabled={saving}
                  value={selectedPrincipalId}
                  onChange={event => setSelectedPrincipalId(event.target.value)}
                >
                  {snapshot.principals.map(principal => (
                    <option key={principal.id} value={principal.id}>
                      {principalNames.get(principal.id)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.rightsGrid}>
              {(Object.keys(rightLabels) as RightKey[]).map(key => (
                <label className={styles.right} key={key}>
                  <Checkbox
                    checked={draft[key]}
                    disabled={saving || draftPolicyKey !== selectedPolicyKey}
                    label={rightLabels[key]}
                    onChange={(_, checked) =>
                      setDraft(current => ({ ...current, [key]: checked }))
                    }
                  />
                </label>
              ))}
            </div>
            <p className={styles.hint}>
              {selectedPolicy
                ? t['com.affine.localmind.directoryPermissions.overrideHint']()
                : t[
                    'com.affine.localmind.directoryPermissions.inheritedHint'
                  ]()}
            </p>
            <div className={styles.actions}>
              <Button
                disabled={!selectedPolicy || saving}
                onClick={() => void changePolicy(null)}
                variant="secondary"
              >
                {t['com.affine.localmind.directoryPermissions.clear']()}
              </Button>
              <Button
                data-testid="directory-policy-save"
                disabled={saving || draftPolicyKey !== selectedPolicyKey}
                loading={saving}
                onClick={() => void changePolicy(draft)}
                variant="primary"
              >
                {t['com.affine.localmind.directoryPermissions.save']()}
              </Button>
            </div>
          </div>
        ) : null}
      </SettingWrapper>

      <SettingWrapper
        title={t['com.affine.localmind.directoryPermissions.currentTitle']()}
      >
        {!snapshot || snapshot.policies.length === 0 ? (
          <div className={styles.state}>
            {t['com.affine.localmind.directoryPermissions.emptyPolicies']()}
          </div>
        ) : (
          <div className={styles.list} data-testid="directory-policy-list">
            {snapshot.policies.map((policy: Policy) => (
              <div
                className={styles.row}
                key={directoryPolicyKey(policy.directoryId, policy.principalId)}
              >
                <div>
                  <div className={styles.primary}>
                    {directoryNames.get(policy.directoryId) ??
                      policy.directoryId}
                  </div>
                  <div className={styles.secondary}>{policy.directoryId}</div>
                </div>
                <div>
                  <div className={styles.primary}>
                    {principalNames.get(policy.principalId) ??
                      policy.principalId}
                  </div>
                  <div className={styles.secondary}>{policy.principalId}</div>
                </div>
                <span className={styles.badge}>
                  {formatDirectoryRights(policy.rights, rightLabels) ||
                    t['com.affine.localmind.directoryPermissions.noRights']()}
                </span>
              </div>
            ))}
          </div>
        )}
      </SettingWrapper>

      <SettingWrapper
        title={t['com.affine.localmind.directoryPermissions.auditTitle']()}
      >
        {!snapshot || auditEvents.length === 0 ? (
          <div className={styles.state}>
            {t['com.affine.localmind.directoryPermissions.emptyAudit']()}
          </div>
        ) : (
          <div className={styles.list} data-testid="directory-policy-audit">
            {auditEvents.map(event => (
              <div className={styles.auditRow} key={event.id}>
                <div className={styles.primary}>
                  {event.action === 'clear'
                    ? t[
                        'com.affine.localmind.directoryPermissions.auditClear'
                      ]()
                    : t[
                        'com.affine.localmind.directoryPermissions.auditSet'
                      ]()}{' '}
                  {directoryNames.get(event.directoryId) ?? event.directoryId}
                </div>
                <div className={styles.auditMeta}>
                  <span>
                    {principalNames.get(event.principalId) ?? event.principalId}
                  </span>
                  <span>·</span>
                  <span>{event.actorId}</span>
                  <span>·</span>
                  <time dateTime={event.createdAt}>
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </div>
                {event.after ? (
                  <div className={styles.secondary}>
                    {formatDirectoryRights(event.after, rightLabels) ||
                      t['com.affine.localmind.directoryPermissions.noRights']()}
                  </div>
                ) : null}
              </div>
            ))}
            {auditNextCursor ? (
              <div className={styles.loadMore}>
                <Button
                  disabled={loadingMore}
                  loading={loadingMore}
                  onClick={() => void load(auditNextCursor)}
                  variant="secondary"
                >
                  {t['com.affine.localmind.directoryPermissions.loadMore']()}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </SettingWrapper>
    </>
  );
};
