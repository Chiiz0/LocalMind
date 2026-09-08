import { Button } from '@affine/admin/components/ui/button';
import { Input } from '@affine/admin/components/ui/input';
import { Label } from '@affine/admin/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@affine/admin/components/ui/select';
import { Separator } from '@affine/admin/components/ui/separator';
import { useQuery } from '@affine/admin/use-query';
import {
  adminAiProfilesQuery,
  adminUserAiProfileAssignmentQuery,
  type FeatureType,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { ChevronRightIcon } from 'lucide-react';
import type { ChangeEvent, HTMLInputTypeAttribute } from 'react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { FeatureToggleList } from '../../../components/shared/feature-toggle-list';
import { cn } from '../../../utils';
import { useServerConfig } from '../../common';
import { RightPanelHeader } from '../../header';
import type { UserInput, UserType } from '../schema';
import { validateEmails, validatePassword } from '../utils/csv-utils';
import { useCreateUser, useUpdateUser } from './use-user-management';

type UserFormProps = {
  title: string;
  defaultValue?: Partial<UserInput>;
  onClose: () => void;
  onConfirm: (user: UserInput) => void;
  onValidate: (user: Partial<UserInput>) => boolean;
  actions?: React.ReactNode;
  showOption?: boolean;
  submitting?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
};

const WORKSPACE_DEFAULT_AI_PROFILE = '__workspace_default__';

function UserForm({
  title,
  defaultValue,
  onClose,
  onConfirm,
  onValidate,
  actions,
  showOption,
  submitting = false,
  onDirtyChange,
}: UserFormProps) {
  const i18n = useI18n();
  const serverConfig = useServerConfig();
  const passwordLimits = serverConfig.credentialsRequirement.password;

  const defaultUser: Partial<UserInput> = useMemo(
    () => ({
      name: defaultValue?.name ?? '',
      email: defaultValue?.email ?? '',
      password: defaultValue?.password ?? '',
      features: defaultValue?.features ?? [],
      aiProfileId: defaultValue?.aiProfileId ?? null,
    }),
    [defaultValue]
  );

  const [changes, setChanges] = useState<Partial<UserInput>>(defaultUser);

  const setField = useCallback(
    <K extends keyof UserInput>(
      field: K,
      value: UserInput[K] | ((prev: UserInput[K] | undefined) => UserInput[K])
    ) => {
      setChanges(changes => ({
        ...changes,
        [field]:
          typeof value === 'function' ? value(changes[field] as any) : value,
      }));
    },
    []
  );

  const passwordValidation = useMemo(
    () => validatePassword(changes.password, passwordLimits),
    [changes.password, passwordLimits]
  );

  const canSave = useMemo(() => {
    return !submitting && onValidate(changes) && passwordValidation.valid;
  }, [onValidate, changes, passwordValidation.valid, submitting]);

  useEffect(() => {
    const normalize = (value: Partial<UserInput>) => ({
      name: value.name ?? '',
      email: value.email ?? '',
      password: value.password ?? '',
      features: [...(value.features ?? [])].sort(),
      aiProfileId: value.aiProfileId ?? null,
    });
    const current = normalize(changes);
    const baseline = normalize(defaultUser);
    const dirty =
      (current.name !== baseline.name ||
        current.email !== baseline.email ||
        current.password !== baseline.password ||
        current.features.join(',') !== baseline.features.join(',') ||
        current.aiProfileId !== baseline.aiProfileId) &&
      !!onDirtyChange;
    onDirtyChange?.(dirty);
  }, [changes, defaultUser, onDirtyChange]);

  const handleConfirm = useCallback(() => {
    if (!canSave) {
      return;
    }

    // @ts-expect-error checked
    onConfirm(changes);
    setChanges(defaultUser);
  }, [canSave, changes, defaultUser, onConfirm]);

  const handleFeaturesChange = useCallback(
    (features: FeatureType[]) => {
      setField('features', features);
    },
    [setField]
  );

  const handleClose = useCallback(() => {
    setChanges(defaultUser);
    onClose();
  }, [defaultUser, onClose]);

  useEffect(() => {
    setChanges(defaultUser);
  }, [defaultUser]);

  return (
    <div className="flex h-full flex-col bg-background">
      <RightPanelHeader
        title={title}
        handleClose={handleClose}
        handleConfirm={handleConfirm}
        canSave={canSave}
      />
      <div className="flex-grow space-y-3 overflow-y-auto p-4">
        <div className="flex flex-col rounded-xl border border-border bg-card shadow-sm">
          <InputItem
            label={i18n['com.affine.admin.user-name']()}
            field="name"
            value={changes.name}
            onChange={setField}
            placeholder={i18n['com.affine.admin.enter-user-name']()}
          />
          <Separator />
          <InputItem
            label={i18n['com.affine.settings.email']()}
            field="email"
            value={changes.email}
            onChange={setField}
            placeholder={i18n['com.affine.admin.enter-email-address']()}
          />
          {showOption && (
            <>
              <Separator />
              <InputItem
                label={i18n[
                  'com.affine.integration.calendar.caldav.field.password'
                ]()}
                field="password"
                value={changes.password}
                onChange={setField}
                optional
                placeholder={i18n['com.affine.admin.enter-password']()}
                type="password"
                autoComplete="new-password"
                minLength={passwordLimits.minLength}
                maxLength={passwordLimits.maxLength}
                description={
                  passwordValidation.valid
                    ? `Use ${passwordLimits.minLength}–${passwordLimits.maxLength} characters, or leave blank.`
                    : passwordValidation.error
                }
                invalid={!passwordValidation.valid}
              />
            </>
          )}
        </div>

        <FeatureToggleList
          className="rounded-xl border border-border bg-card shadow-sm"
          features={serverConfig.availableUserFeatures}
          selected={changes.features ?? []}
          onChange={handleFeaturesChange}
          control="switch"
          controlPosition="right"
          showSeparators={true}
        />
        <AiProfileSelect
          value={changes.aiProfileId ?? null}
          onChange={aiProfileId => setField('aiProfileId', aiProfileId)}
        />
        {actions}
      </div>
    </div>
  );
}

function AiProfileSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const i18n = useI18n();
  const { data, error, isValidating } = useQuery({
    query: adminAiProfilesQuery,
    variables: {},
  });
  const profiles = data.adminAiProfiles;

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-sm">
      <Label
        htmlFor="admin-user-ai-profile"
        className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
      >
        {i18n['com.affine.admin.default-ai-profile']()}{' '}
      </Label>
      <Select
        value={value ?? WORKSPACE_DEFAULT_AI_PROFILE}
        onValueChange={profileId =>
          onChange(
            profileId === WORKSPACE_DEFAULT_AI_PROFILE ? null : profileId
          )
        }
        disabled={isValidating && !profiles.length}
      >
        <SelectTrigger
          id="admin-user-ai-profile"
          aria-label={i18n['com.affine.admin.default-ai-profile']()}
        >
          <SelectValue
            placeholder={i18n['com.affine.admin.use-workspace-default']()}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={WORKSPACE_DEFAULT_AI_PROFILE}>
            {i18n['com.affine.admin.use-workspace-default']()}{' '}
          </SelectItem>
          {profiles.map(profile => (
            <SelectItem
              key={profile.id}
              value={profile.id}
              disabled={!profile.enabled}
            >
              {profile.name} /{' '}
              {profile.workspaceName ||
                i18n['com.affine.admin.untitled-workspace']()}
              {!profile.enabled ? i18n['com.affine.admin.disabled']() : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs leading-5 text-muted-foreground">
        {i18n[
          'com.affine.admin.the-explicit-profile-applies-in-its-workspace-other-workspaces-use-their-enabled-default-profile'
        ]()}{' '}
      </p>
      {error ? (
        <p className="text-xs leading-5 text-destructive" role="alert">
          {i18n[
            'com.affine.admin.ai-profiles-could-not-be-loaded-account-details-can-still-be-edited'
          ]()}{' '}
        </p>
      ) : null}
    </div>
  );
}

function InputItem({
  label,
  field,
  optional,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
  minLength,
  maxLength,
  description,
  invalid = false,
}: {
  label: string;
  field: keyof UserInput;
  optional?: boolean;
  value?: string;
  onChange: (field: keyof UserInput, value: string) => void;
  placeholder?: string;
  type?: HTMLInputTypeAttribute;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  description?: string;
  invalid?: boolean;
}) {
  const i18n = useI18n();
  const inputId = useId();
  const descriptionId = description ? `${inputId}-description` : undefined;
  const onValueChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(field, e.target.value);
    },
    [field, onChange]
  );

  return (
    <div className="flex flex-col gap-2 p-3">
      <Label
        htmlFor={inputId}
        className="flex flex-wrap text-xs font-medium leading-5 text-muted-foreground uppercase tracking-wide"
      >
        {label}
        {optional && (
          <span className="ml-1 font-normal text-muted-foreground">
            {i18n['com.affine.admin.optional']()}{' '}
          </span>
        )}
      </Label>
      <Input
        id={inputId}
        type={type}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
        aria-describedby={descriptionId}
        aria-invalid={invalid || undefined}
        className={cn(
          'py-2 px-3 text-sm font-normal h-9',
          invalid &&
            'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20'
        )}
        value={value}
        onChange={onValueChange}
        placeholder={placeholder}
      />
      {description ? (
        <p
          id={descriptionId}
          className={cn(
            'text-xs leading-5 text-muted-foreground',
            invalid && 'text-destructive'
          )}
          role={invalid ? 'alert' : undefined}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

const validateCreateUser = (user: Partial<UserInput>) => {
  return !!user.name && !!user.email && !!user.features;
};

const validateUpdateUser = (user: Partial<UserInput>) => {
  return !!user.name || !!user.email;
};

export function CreateUserForm({
  onComplete,
  onDirtyChange,
}: {
  onComplete: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const i18n = useI18n();
  const { create, creating } = useCreateUser();
  const serverConfig = useServerConfig();
  const passwordLimits = serverConfig.credentialsRequirement.password;

  const handleCreateUser = useCallback(
    (user: UserInput) => {
      const emailValidation = validateEmails([user]);
      const passwordValidation = validatePassword(
        user.password,
        passwordLimits
      );
      if (!passwordValidation.valid || !emailValidation[0].valid) {
        toast.error(passwordValidation.error || emailValidation[0].error);
        return;
      }
      void create(user)
        .then(created => {
          if (created) onComplete();
        })
        .catch(error => {
          console.error(error);
        });
    },
    [create, onComplete, passwordLimits]
  );

  return (
    <UserForm
      title={i18n['com.affine.admin.create-user']()}
      onClose={onComplete}
      onConfirm={handleCreateUser}
      onValidate={validateCreateUser}
      showOption={true}
      submitting={creating}
      onDirtyChange={onDirtyChange}
    />
  );
}

export function UpdateUserForm({
  user,
  onResetPassword,
  onDeleteAccount,
  onComplete,
  onDirtyChange,
}: {
  user: UserType;
  onResetPassword: () => void;
  onDeleteAccount: () => void;
  onComplete: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const i18n = useI18n();
  const { update, updating } = useUpdateUser();
  const { data } = useQuery({
    query: adminUserAiProfileAssignmentQuery,
    variables: { userId: user.id },
  });

  const onUpdateUser = useCallback(
    (updates: UserInput) => {
      void update({
        ...updates,
        userId: user.id,
      })
        .then(updated => {
          if (updated) onComplete();
        })
        .catch(error => {
          console.error(error);
        });
    },
    [onComplete, update, user.id]
  );

  return (
    <UserForm
      title={i18n['com.affine.admin.update-user']()}
      defaultValue={{
        ...user,
        aiProfileId: data.adminUserAiProfileAssignment?.profile.id ?? null,
      }}
      onClose={onComplete}
      onConfirm={onUpdateUser}
      onValidate={validateUpdateUser}
      submitting={updating}
      onDirtyChange={onDirtyChange}
      actions={
        <div className="space-y-2">
          <Button
            className="h-10 w-full justify-between rounded-xl border-border/60 px-4 text-sm font-medium hover:bg-muted/50"
            variant="outline"
            onClick={onResetPassword}
          >
            <span>{i18n['com.affine.admin.reset-password']()}</span>
            <ChevronRightIcon size={16} className="text-muted-foreground" />
          </Button>
          <Button
            className="h-10 w-full justify-between rounded-xl border-destructive/30 px-4 text-sm font-medium text-destructive hover:bg-destructive/5 hover:text-destructive"
            variant="outline"
            onClick={onDeleteAccount}
          >
            <span>{i18n['com.affine.admin.delete-account-2']()}</span>
            <ChevronRightIcon size={16} />
          </Button>
        </div>
      }
    />
  );
}
