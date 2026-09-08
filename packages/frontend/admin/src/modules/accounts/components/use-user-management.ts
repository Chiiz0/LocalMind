import {
  useMutateQueryResource,
  useMutation,
} from '@affine/admin/use-mutation';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import {
  adminUserAiProfileAssignmentQuery,
  createChangePasswordUrlMutation,
  createUserMutation,
  deleteUserMutation,
  disableUserMutation,
  enableUserMutation,
  type ImportUsersInput,
  type ImportUsersMutation,
  importUsersMutation,
  listUsersQuery,
  setAdminUserAiProfileAssignmentMutation,
  updateAccountFeaturesMutation,
  updateAccountMutation,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { UserInput, UserType } from '../schema';

export interface ExportField {
  id: string;
  label: string;
  checked: boolean;
}

export type UserImportReturnType = ImportUsersMutation['importUsers'];

export const useCreateUser = () => {
  const i18n = useI18n();
  const { trigger: createAccount } = useMutation({
    mutation: createUserMutation,
  });

  const { trigger: updateAccountFeatures } = useMutation({
    mutation: updateAccountFeaturesMutation,
  });
  const { trigger: setAiProfileAssignment } = useMutation({
    mutation: setAdminUserAiProfileAssignmentMutation,
  });
  const [creating, setCreating] = useState(false);

  const revalidate = useMutateQueryResource();

  const create = useCallback(
    async ({ name, email, password, features, aiProfileId }: UserInput) => {
      setCreating(true);
      try {
        const account = await createAccount({
          input: {
            name,
            email,
            password: password === '' ? undefined : password,
          },
        });

        await updateAccountFeatures({
          userId: account.createUser.id,
          features,
        });
        if (aiProfileId) {
          try {
            await setAiProfileAssignment({
              userId: account.createUser.id,
              profileId: aiProfileId,
            });
          } catch (assignmentError) {
            await revalidate(listUsersQuery);
            toast.error(
              i18n[
                'com.affine.admin.account-created-but-ai-profile-assignment-failed'
              ]() + (assignmentError as Error).message
            );
            return false;
          }
        }
        await revalidate(listUsersQuery);
        toast(i18n['com.affine.admin.account-created-successfully']());
        return true;
      } catch (e) {
        toast.error(
          i18n['com.affine.admin.failed-to-create-account']() +
            (e as Error).message
        );
        return false;
      } finally {
        setCreating(false);
      }
    },
    [
      createAccount,
      revalidate,
      setAiProfileAssignment,
      updateAccountFeatures,
      i18n,
    ]
  );

  return { creating, create };
};

export const useUpdateUser = () => {
  const i18n = useI18n();
  const { trigger: updateAccount } = useMutation({
    mutation: updateAccountMutation,
  });

  const { trigger: updateAccountFeatures } = useMutation({
    mutation: updateAccountFeaturesMutation,
  });
  const { trigger: setAiProfileAssignment } = useMutation({
    mutation: setAdminUserAiProfileAssignmentMutation,
  });
  const [updating, setUpdating] = useState(false);

  const revalidate = useMutateQueryResource();

  const update = useCallback(
    async ({
      userId,
      name,
      email,
      features,
      aiProfileId,
    }: UserInput & { userId: string }) => {
      setUpdating(true);
      try {
        await updateAccount({
          id: userId,
          input: {
            name,
            email,
          },
        });
        await updateAccountFeatures({
          userId,
          features,
        });
        try {
          await setAiProfileAssignment({
            userId,
            profileId: aiProfileId || null,
          });
        } catch (assignmentError) {
          await revalidate(listUsersQuery);
          toast.error(
            i18n[
              'com.affine.admin.account-updated-but-ai-profile-assignment-failed'
            ]() + (assignmentError as Error).message
          );
          return false;
        }
        await Promise.all([
          revalidate(listUsersQuery),
          revalidate(
            adminUserAiProfileAssignmentQuery,
            variables => variables.userId === userId
          ),
        ]);
        toast(i18n['com.affine.admin.account-updated-successfully']());
        return true;
      } catch (e) {
        toast.error(
          i18n['com.affine.admin.failed-to-update-account']() +
            (e as Error).message
        );
        return false;
      } finally {
        setUpdating(false);
      }
    },
    [
      revalidate,
      setAiProfileAssignment,
      updateAccount,
      updateAccountFeatures,
      i18n,
    ]
  );

  return { updating, update };
};

export const useResetUserPassword = () => {
  const i18n = useI18n();
  const [resetPasswordLink, setResetPasswordLink] = useState('');
  const { trigger: resetPassword } = useMutation({
    mutation: createChangePasswordUrlMutation,
  });

  const onResetPassword = useCallback(
    async (id: string, callback?: () => void) => {
      setResetPasswordLink('');
      resetPassword({
        userId: id,
        callbackUrl: '/auth/changePassword',
      })
        .then(res => {
          setResetPasswordLink(res.createChangePasswordUrl);
          callback?.();
        })
        .catch(e => {
          toast.error(
            i18n['com.affine.admin.failed-to-reset-password']() + e.message
          );
        });
    },
    [resetPassword, i18n]
  );

  return useMemo(() => {
    return {
      resetPasswordLink,
      onResetPassword,
    };
  }, [onResetPassword, resetPasswordLink]);
};

export const useDeleteUser = () => {
  const i18n = useI18n();
  const { trigger: deleteUserById } = useMutation({
    mutation: deleteUserMutation,
  });

  const revalidate = useMutateQueryResource();

  const deleteById = useAsyncCallback(
    async (id: string, callback?: () => void) => {
      await deleteUserById({ id })
        .then(async () => {
          await revalidate(listUsersQuery);
          toast(i18n['com.affine.admin.user-deleted-successfully']());
          callback?.();
        })
        .catch(e => {
          toast.error(
            i18n['com.affine.admin.failed-to-delete-user']() + e.message
          );
        });
    },
    [deleteUserById, revalidate, i18n]
  );

  return deleteById;
};

export const useEnableUser = () => {
  const i18n = useI18n();
  const { trigger: enableUserById } = useMutation({
    mutation: enableUserMutation,
  });

  const revalidate = useMutateQueryResource();

  const enableById = useAsyncCallback(
    async (id: string, callback?: () => void) => {
      await enableUserById({ id })
        .then(async ({ enableUser }) => {
          await revalidate(listUsersQuery);
          toast(`User ${enableUser.email} enabled successfully`);
          callback?.();
        })
        .catch(e => {
          toast.error(
            i18n['com.affine.admin.failed-to-enable-user']() + e.message
          );
        });
    },
    [enableUserById, revalidate, i18n]
  );

  return enableById;
};
export const useDisableUser = () => {
  const i18n = useI18n();
  const { trigger: disableUserById } = useMutation({
    mutation: disableUserMutation,
  });

  const revalidate = useMutateQueryResource();

  const disableById = useAsyncCallback(
    async (id: string, callback?: () => void) => {
      await disableUserById({ id })
        .then(async ({ banUser }) => {
          await revalidate(listUsersQuery);
          toast(`User ${banUser.email} disabled successfully`);
          callback?.();
        })
        .catch(e => {
          toast.error(
            i18n['com.affine.admin.failed-to-disable-user']() + e.message
          );
        });
    },
    [disableUserById, revalidate, i18n]
  );

  return disableById;
};

export const useImportUsers = () => {
  const i18n = useI18n();
  const { trigger: importUsers } = useMutation({
    mutation: importUsersMutation,
  });
  const revalidate = useMutateQueryResource();

  const handleImportUsers = useCallback(
    async (
      input: ImportUsersInput,
      callback?: (importUsers: UserImportReturnType) => void
    ) => {
      await importUsers({ input })
        .then(async ({ importUsers }) => {
          await revalidate(listUsersQuery);
          callback?.(importUsers);
        })
        .catch(e => {
          toast.error(
            i18n['com.affine.admin.failed-to-import-users-2']() + e.message
          );
        });
    },
    [importUsers, revalidate, i18n]
  );

  return handleImportUsers;
};

export const useExportUsers = () => {
  const i18n = useI18n();
  const exportCSV = useCallback(
    async (users: UserType[], fields: ExportField[], callback?: () => void) => {
      const selectedFields = fields
        .filter(field => field.checked)
        .map(field => field.id);

      if (selectedFields.length === 0) {
        alert(
          i18n['com.affine.admin.please-select-at-least-one-field-to-export']()
        );
        return;
      }

      const headers = selectedFields.map(
        fieldId => fields.find(field => field.id === fieldId)?.label || fieldId
      );

      const csvRows = [headers.join(',')];

      users.forEach(user => {
        const row = selectedFields.map(fieldId => {
          const value = user[fieldId as keyof UserType];

          return typeof value === 'string'
            ? `"${value.replace(/"/g, '""')}"`
            : String(value);
        });
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');

      // Add BOM (Byte Order Mark) to force Excel to interpret the file as UTF-8
      const BOM = '\uFEFF';
      const csvContentWithBOM = BOM + csvContent;

      const blob = new Blob([csvContentWithBOM], {
        type: 'text/csv;charset=utf-8;',
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'exported_users.csv');
      link.style.visibility = 'hidden';
      document.body.append(link);
      link.click();

      setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(url);
      }, 100);

      callback?.();
    },
    [i18n]
  );

  const copyToClipboard = useCallback(
    async (users: UserType[], fields: ExportField[], callback?: () => void) => {
      const selectedFields = fields
        .filter(field => field.checked)
        .map(field => field.id);

      const dataToCopy: {
        [key: string]: string;
      }[] = [];
      users.forEach(user => {
        const row: { [key: string]: string } = {};
        selectedFields.forEach(fieldId => {
          const value = user[fieldId as keyof UserType];
          row[fieldId] = typeof value === 'string' ? value : String(value);
        });
        dataToCopy.push(row);
      });
      // oxlint-disable-next-line @typescript-eslint/no-floating-promises
      navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
      callback?.();
    },
    []
  );

  return {
    exportCSV,
    copyToClipboard,
  };
};
