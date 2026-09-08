import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@affine/admin/components/ui/avatar';
import { Input } from '@affine/admin/components/ui/input';
import { Label } from '@affine/admin/components/ui/label';
import { Separator } from '@affine/admin/components/ui/separator';
import { Switch } from '@affine/admin/components/ui/switch';
import {
  adminUpdateWorkspaceMutation,
  adminWorkspaceQuery,
  adminWorkspacesQuery,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { AccountIcon } from '@blocksuite/icons/rc';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useMutateQueryResource, useMutation } from '../../../use-mutation';
import { useQuery } from '../../../use-query';
import { RightPanelHeader } from '../../header';
import { useRightPanel } from '../../panel/context';
import type { WorkspaceDetail } from '../schema';
import { formatBytes } from '../utils';

export function WorkspacePanel({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const i18n = useI18n();
  const { data } = useQuery({
    query: adminWorkspaceQuery,
    variables: {
      id: workspaceId,
      memberSkip: 0,
      memberTake: 20,
    },
  });
  const workspace = data.adminWorkspace;

  if (!workspace) {
    return (
      <div className="flex flex-col h-full">
        <RightPanelHeader
          title={i18n['com.affine.localmind.tasks.authorization.workspace']()}
          handleClose={onClose}
          handleConfirm={onClose}
          canSave={false}
        />
        <div className="p-6 text-sm text-muted-foreground">
          {i18n['com.affine.admin.workspace-not-found']()}{' '}
        </div>
      </div>
    );
  }

  return <WorkspacePanelContent workspace={workspace} onClose={onClose} />;
}

function WorkspacePanelContent({
  workspace,
  onClose,
}: {
  workspace: WorkspaceDetail;
  onClose: () => void;
}) {
  const i18n = useI18n();
  const { setHasDirtyChanges } = useRightPanel();
  const revalidate = useMutateQueryResource();
  const { trigger: updateWorkspace, isMutating } = useMutation({
    mutation: adminUpdateWorkspaceMutation,
  });

  const normalizedWorkspace = useMemo(
    () => ({
      flags: {
        public: workspace.public,
        enableAi: workspace.enableAi,
        enableSharing: workspace.enableSharing,
        enableUrlPreview: workspace.enableUrlPreview,
        enableDocEmbedding: workspace.enableDocEmbedding,
        name: workspace.name ?? '',
      },
    }),
    [workspace]
  );

  const [flags, setFlags] = useState(normalizedWorkspace.flags);
  const [baseline, setBaseline] = useState(normalizedWorkspace);

  useEffect(() => {
    setFlags(normalizedWorkspace.flags);
    setBaseline(normalizedWorkspace);
  }, [normalizedWorkspace]);

  const hasChanges = useMemo(() => {
    return (
      flags.public !== baseline.flags.public ||
      flags.enableAi !== baseline.flags.enableAi ||
      flags.enableSharing !== baseline.flags.enableSharing ||
      flags.enableUrlPreview !== baseline.flags.enableUrlPreview ||
      flags.enableDocEmbedding !== baseline.flags.enableDocEmbedding ||
      flags.name !== baseline.flags.name
    );
  }, [baseline, flags]);

  useEffect(() => {
    setHasDirtyChanges(hasChanges);
  }, [hasChanges, setHasDirtyChanges]);

  const handleSave = useCallback(() => {
    const update = async () => {
      try {
        await updateWorkspace({
          input: {
            id: workspace.id,
            public: flags.public,
            enableAi: flags.enableAi,
            enableSharing: flags.enableSharing,
            enableUrlPreview: flags.enableUrlPreview,
            enableDocEmbedding: flags.enableDocEmbedding,
            name: flags.name || null,
          },
        });
        await Promise.all([
          revalidate(adminWorkspacesQuery),
          revalidate(adminWorkspaceQuery, vars => vars?.id === workspace.id),
        ]);
        toast.success(
          i18n['com.affine.admin.workspace-updated-successfully']()
        );
        setBaseline({
          flags: { ...flags },
        });
        setHasDirtyChanges(false);
        onClose();
      } catch (e) {
        toast.error(`Failed to update workspace: ${(e as Error).message}`);
      }
    };
    update().catch(() => {});
  }, [
    flags,
    onClose,
    revalidate,
    setBaseline,
    setHasDirtyChanges,
    updateWorkspace,
    workspace.id,

    i18n,
  ]);

  const memberList = workspace.members ?? [];

  return (
    <div className="flex h-full flex-col bg-background">
      <RightPanelHeader
        title={i18n['com.affine.admin.update-workspace']()}
        handleClose={onClose}
        handleConfirm={handleSave}
        canSave={hasChanges && !isMutating}
      />
      <div className="flex flex-col gap-4 overflow-y-auto p-4">
        <div className="space-y-2 rounded-xl border border-border/60 bg-card p-3 shadow-sm">
          <div className="text-xs text-muted-foreground">
            {i18n['com.affine.admin.workspace-id']()}
          </div>
          <div className="text-sm font-mono break-all">{workspace.id}</div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">
              {i18n['com.affine.integration.external-mcp.field.name']()}
            </Label>
            <Input
              value={flags.name}
              onChange={e =>
                setFlags(prev => ({ ...prev, name: e.target.value }))
              }
              placeholder={i18n[
                'com.affine.nameWorkspace.subtitle.workspace-name'
              ]()}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card shadow-sm">
          <FlagItem
            label={i18n['com.affine.admin.public']()}
            description={i18n[
              'com.affine.admin.allow-public-access-to-workspace-pages'
            ]()}
            checked={flags.public}
            onCheckedChange={value =>
              setFlags(prev => ({ ...prev, public: value }))
            }
          />
          <Separator />
          <FlagItem
            label={i18n[
              'com.affine.settings.workspace.experimental-features.enable-ai.name'
            ]()}
            description={i18n[
              'com.affine.admin.allow-ai-features-in-this-workspace'
            ]()}
            checked={flags.enableAi}
            onCheckedChange={value =>
              setFlags(prev => ({ ...prev, enableAi: value }))
            }
          />
          <Separator />
          <FlagItem
            label={i18n['com.affine.admin.enable-url-preview-2']()}
            description={i18n[
              'com.affine.admin.allow-url-previews-in-shared-pages'
            ]()}
            checked={flags.enableUrlPreview}
            onCheckedChange={value =>
              setFlags(prev => ({ ...prev, enableUrlPreview: value }))
            }
          />
          <Separator />
          <FlagItem
            label={i18n['com.affine.admin.allow-workspace-sharing']()}
            description={i18n[
              'com.affine.admin.allow-pages-in-this-workspace-to-be-shared-publicly'
            ]()}
            checked={flags.enableSharing}
            onCheckedChange={value =>
              setFlags(prev => ({ ...prev, enableSharing: value }))
            }
          />
          <Separator />
          <FlagItem
            label={i18n['com.affine.admin.enable-doc-embedding-2']()}
            description={i18n[
              'com.affine.admin.allow-document-embedding-for-search'
            ]()}
            checked={flags.enableDocEmbedding}
            onCheckedChange={value =>
              setFlags(prev => ({ ...prev, enableDocEmbedding: value }))
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label={i18n['com.affine.admin.snapshot-size-2']()}
            value={formatBytes(workspace.snapshotSize)}
          />
          <MetricCard
            label={i18n['com.affine.admin.snapshot-count-2']()}
            value={`${workspace.snapshotCount}`}
          />
          <MetricCard
            label={i18n['com.affine.admin.blob-size-2']()}
            value={formatBytes(workspace.blobSize)}
          />
          <MetricCard
            label={i18n['com.affine.admin.blob-count-2']()}
            value={`${workspace.blobCount}`}
          />
          <MetricCard
            label={i18n['com.affine.admin.active-members']()}
            value={`${workspace.memberCount}`}
          />
          <MetricCard
            label={i18n['com.affine.admin.shared-pages-2']()}
            value={`${workspace.publicPageCount}`}
          />
        </div>

        <div className="rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="px-3 py-2 text-sm font-medium">
            {i18n['com.affine.admin.members-and-invitations']()}{' '}
          </div>
          <Separator />
          <div className="flex flex-col divide-y">
            {memberList.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground">
                {i18n['com.affine.admin.no-members-or-invitations']()}{' '}
              </div>
            ) : (
              memberList.map(member => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={member.avatarUrl ?? undefined} />
                    <AvatarFallback>
                      <AccountIcon fontSize={16} />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col overflow-hidden">
                    <div className="text-sm font-medium truncate">
                      {member.name || member.email}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {member.email}
                    </div>
                  </div>
                  <div className="ml-auto flex flex-col items-end gap-1 text-xs">
                    <div className="rounded border px-2 py-1">
                      {member.role}
                    </div>
                    {member.status !==
                    i18n['com.affine.localmind.workbench.status.accepted']() ? (
                      <div className="text-muted-foreground">
                        {member.status}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FlagItem({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2 p-3">
      <div className="flex flex-col">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-card p-3 shadow-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
