import { Badge } from '@affine/admin/components/ui/badge';
import { Button } from '@affine/admin/components/ui/button';
import { Checkbox } from '@affine/admin/components/ui/checkbox';
import { Input } from '@affine/admin/components/ui/input';
import { Label } from '@affine/admin/components/ui/label';
import { Switch } from '@affine/admin/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@affine/admin/components/ui/table';
import { Textarea } from '@affine/admin/components/ui/textarea';
import {
  useMutateQueryResource,
  useMutation,
} from '@affine/admin/use-mutation';
import { useQuery } from '@affine/admin/use-query';
import {
  adminAiProfilesQuery,
  adminUserAiProfileAssignmentQuery,
  adminWorkspaceByokSettingsQuery,
  deleteAdminAiProfileMutation,
  type QueryResponse,
  upsertAdminAiProfileMutation,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type WorkspaceScope = {
  id: string;
  name: string | null;
};
type AdminAiProfile = QueryResponse<
  typeof adminAiProfilesQuery
>['adminAiProfiles'][number];

type ProfileDraft = {
  credentialIds: string[];
  description: string;
  enabled: boolean;
  id?: string;
  isDefault: boolean;
  name: string;
};

function emptyDraft(): ProfileDraft {
  return {
    credentialIds: [],
    description: '',
    enabled: true,
    isDefault: false,
    name: '',
  };
}

function profileDraft(profile: AdminAiProfile): ProfileDraft {
  return {
    credentialIds: profile.credentialIds,
    description: profile.description ?? '',
    enabled: profile.enabled,
    id: profile.id,
    isDefault: profile.isDefault,
    name: profile.name,
  };
}

export function WorkspaceAiProfilesEditor({
  scope,
}: {
  scope: WorkspaceScope;
}) {
  const i18n = useI18n();
  const {
    data: profileData,
    error: profileError,
    isValidating: profilesValidating,
    mutate: mutateProfiles,
  } = useQuery({
    query: adminAiProfilesQuery,
    variables: { workspaceId: scope.id },
  });
  const { data: settingsData } = useQuery({
    query: adminWorkspaceByokSettingsQuery,
    variables: { workspaceId: scope.id },
  });
  const profiles = profileData.adminAiProfiles;
  const credentials = settingsData.adminWorkspaceByokSettings.keys;
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const { trigger: upsertProfile, isMutating: isSaving } = useMutation({
    mutation: upsertAdminAiProfileMutation,
  });
  const { trigger: deleteProfile, isMutating: isDeleting } = useMutation({
    mutation: deleteAdminAiProfileMutation,
  });
  const revalidateAssignments = useMutateQueryResource();

  useEffect(() => {
    setDraft(emptyDraft());
  }, [scope.id]);

  const selectedCredentialIds = useMemo(
    () => new Set(draft.credentialIds),
    [draft.credentialIds]
  );
  const canSave =
    Boolean(draft.name.trim()) &&
    !(draft.isDefault && !draft.enabled) &&
    !isSaving;

  const resetDraft = () => setDraft(emptyDraft());

  const toggleCredential = (credentialId: string, checked: boolean) => {
    setDraft(current => ({
      ...current,
      credentialIds: checked
        ? [...current.credentialIds, credentialId]
        : current.credentialIds.filter(id => id !== credentialId),
    }));
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;
    try {
      await upsertProfile({
        input: {
          id: draft.id,
          workspaceId: scope.id,
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          enabled: draft.enabled,
          isDefault: draft.isDefault,
          credentialIds: draft.credentialIds,
        },
      });
      await Promise.all([
        mutateProfiles(),
        revalidateAssignments(adminUserAiProfileAssignmentQuery),
      ]);
      resetDraft();
      toast.success(i18n['com.affine.admin.workspace-ai-profile-saved']());
    } catch (saveError) {
      console.error(saveError);
      toast.error(
        i18n['com.affine.admin.failed-to-save-workspace-ai-profile']()
      );
    }
  };

  const handleDelete = async (profile: AdminAiProfile) => {
    if (
      !window.confirm(
        `Delete ${profile.name}? User assignments to this profile will be cleared.`
      )
    ) {
      return;
    }
    try {
      await deleteProfile({ workspaceId: scope.id, id: profile.id });
      await Promise.all([
        mutateProfiles(),
        revalidateAssignments(adminUserAiProfileAssignmentQuery),
      ]);
      if (draft.id === profile.id) resetDraft();
      toast.success(i18n['com.affine.admin.workspace-ai-profile-deleted']());
    } catch (deleteError) {
      console.error(deleteError);
      toast.error(
        i18n['com.affine.admin.failed-to-delete-workspace-ai-profile']()
      );
    }
  };

  return (
    <div className="border-t border-border/70 px-6 py-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">
            {i18n['com.affine.admin.workspace-ai-profiles']()}
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            {i18n[
              'com.affine.admin.group-approved-credentials-into-reusable-routing-profiles-a-user-assignment-takes-priority-in-this-w'
            ]()}{' '}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={resetDraft}>
          <PlusIcon size={16} />
          {i18n['com.affine.admin.new-profile']()}{' '}
        </Button>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="min-w-0 overflow-hidden rounded-md border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{i18n['com.affine.admin.profile']()}</TableHead>
                <TableHead>
                  {i18n[
                    'com.affine.integration.mcp-server.credentials.title'
                  ]()}
                </TableHead>
                <TableHead>{i18n['com.affine.admin.status']()}</TableHead>
                <TableHead className="w-[104px] text-right">
                  {i18n['com.affine.admin.actions']()}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map(profile => (
                <TableRow key={profile.id}>
                  <TableCell className="min-w-0">
                    <div className="max-w-[300px] truncate font-medium">
                      {profile.name}
                    </div>
                    {profile.description ? (
                      <div className="mt-1 max-w-[360px] truncate text-xs text-muted-foreground">
                        {profile.description}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <span className="tabular-nums">
                      {profile.credentials.length}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={profile.enabled ? 'default' : 'outline'}>
                        {profile.enabled
                          ? i18n['com.affine.admin.enabled']()
                          : i18n[
                              'com.affine.integration.external-mcp.status.disabled'
                            ]()}
                      </Badge>
                      {profile.isDefault ? (
                        <Badge variant="outline">
                          {i18n['com.affine.admin.workspace-default']()}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit ${profile.name}`}
                        title={`Edit ${profile.name}`}
                        onClick={() => setDraft(profileDraft(profile))}
                      >
                        <PencilIcon size={16} />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Delete ${profile.name}`}
                        title={`Delete ${profile.name}`}
                        disabled={isDeleting}
                        onClick={() => void handleDelete(profile)}
                      >
                        <Trash2Icon size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!profiles.length ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    {profilesValidating
                      ? i18n['com.affine.admin.loading-workspace-ai-profiles']()
                      : i18n[
                          'com.affine.admin.no-ai-profiles-configured-existing-enabled-credentials-remain-the-compatibility-fallback'
                        ]()}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          {profileError ? (
            <div className="border-t border-border/70 p-3 text-sm text-destructive">
              {i18n[
                'com.affine.admin.failed-to-load-workspace-ai-profiles'
              ]()}{' '}
            </div>
          ) : null}
        </div>

        <form
          className="min-w-0 space-y-4 rounded-md border border-border/70 bg-muted/10 p-4"
          onSubmit={event => void handleSave(event)}
        >
          <div>
            <div className="text-sm font-semibold">
              {draft.id
                ? i18n['com.affine.admin.edit-ai-profile']()
                : i18n['com.affine.admin.create-ai-profile']()}
            </div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              {i18n[
                'com.affine.admin.a-profile-with-no-credentials-intentionally-disables-ai-routing-for-users-assigned-to-it'
              ]()}{' '}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`ai-profile-name-${scope.id}`}>
              {i18n['com.affine.admin.profile-name']()}
            </Label>
            <Input
              id={`ai-profile-name-${scope.id}`}
              maxLength={120}
              value={draft.name}
              placeholder={i18n['com.affine.admin.engineering-default']()}
              onChange={event =>
                setDraft(current => ({ ...current, name: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`ai-profile-description-${scope.id}`}>
              {i18n['com.affine.localmind.aiContext.description']()}{' '}
            </Label>
            <Textarea
              id={`ai-profile-description-${scope.id}`}
              maxLength={1000}
              rows={3}
              value={draft.description}
              placeholder={i18n[
                'com.affine.admin.department-routing-policy-or-ownership-notes'
              ]()}
              onChange={event =>
                setDraft(current => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              {i18n['com.affine.integration.mcp-server.credentials.title']()}
            </legend>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border/70 bg-background p-2">
              {credentials.map(credential => (
                <label
                  key={credential.id}
                  className="flex min-w-0 cursor-pointer items-start gap-3 rounded-sm px-2 py-2 hover:bg-muted/50"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={selectedCredentialIds.has(credential.id)}
                    onCheckedChange={checked =>
                      toggleCredential(credential.id, checked === true)
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {credential.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {credential.provider}
                      {credential.modelId ? ` / ${credential.modelId}` : ''}
                      {!credential.enabled
                        ? i18n['com.affine.admin.disabled']()
                        : ''}
                    </span>
                  </span>
                </label>
              ))}
              {!credentials.length ? (
                <div className="px-2 py-5 text-center text-xs leading-5 text-muted-foreground">
                  {i18n[
                    'com.affine.admin.no-workspace-ai-credentials-are-available-create-and-verify-credentials-above-before-adding-them-to-'
                  ]()}{' '}
                </div>
              ) : null}
            </div>
          </fieldset>

          <div className="space-y-3 border-t border-border/70 pt-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor={`ai-profile-enabled-${scope.id}`}>
                {i18n['com.affine.admin.enable-profile']()}{' '}
              </Label>
              <Switch
                id={`ai-profile-enabled-${scope.id}`}
                checked={draft.enabled}
                onCheckedChange={enabled =>
                  setDraft(current => ({
                    ...current,
                    enabled,
                    isDefault: enabled ? current.isDefault : false,
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor={`ai-profile-default-${scope.id}`}>
                {i18n['com.affine.admin.workspace-default']()}{' '}
              </Label>
              <Switch
                id={`ai-profile-default-${scope.id}`}
                checked={draft.isDefault}
                onCheckedChange={isDefault =>
                  setDraft(current => ({
                    ...current,
                    enabled: isDefault ? true : current.enabled,
                    isDefault,
                  }))
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-4">
            {draft.id ? (
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={resetDraft}
              >
                {i18n['com.affine.localmind.aiContext.cancel']()}{' '}
              </Button>
            ) : null}
            <Button type="submit" disabled={!canSave}>
              {isSaving
                ? i18n['com.affine.admin.saving']()
                : i18n['com.affine.admin.save-profile']()}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
