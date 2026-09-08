import { Badge } from '@affine/admin/components/ui/badge';
import { Button } from '@affine/admin/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@affine/admin/components/ui/card';
import { useMutation } from '@affine/admin/use-mutation';
import { useQuery } from '@affine/admin/use-query';
import { notify } from '@affine/component';
import type { UserFriendlyError } from '@affine/error';
import {
  authSigningKeysQuery,
  deleteAuthSigningKeyMutation,
  rotateAuthSigningKeyMutation,
} from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { useMemo, useState } from 'react';

import { ConfirmDialog } from '../../../components/shared/confirm-dialog';

type PendingAction =
  | { type: 'rotate'; keyId: string }
  | { type: 'delete'; keyId: string };

export function AuthSigningKeys() {
  const i18n = useI18n();
  const { data, mutate } = useQuery({ query: authSigningKeysQuery });
  const { trigger: rotate, isMutating: rotating } = useMutation({
    mutation: rotateAuthSigningKeyMutation,
  });
  const { trigger: remove, isMutating: deleting } = useMutation({
    mutation: deleteAuthSigningKeyMutation,
  });
  const [pending, setPending] = useState<PendingAction>();
  const keys = useMemo(
    () =>
      [...data.authSigningKeys].sort((left, right) =>
        left.status === right.status ? 0 : left.status === 'active' ? -1 : 1
      ),
    [data.authSigningKeys]
  );
  const active = keys.find(key => key.status === 'active');
  const mutating = rotating || deleting;

  const confirm = async () => {
    if (!pending) return;
    try {
      if (pending.type === 'rotate') {
        await rotate({ expectedActiveKeyId: pending.keyId });
        notify.success({
          title: i18n['com.affine.admin.signing-key-rotated'](),
          message:
            i18n[
              'com.affine.admin.new-access-tokens-now-use-the-replacement-key'
            ](),
        });
      } else {
        await remove({ id: pending.keyId });
        notify.success({
          title: i18n['com.affine.admin.signing-key-deleted'](),
          message:
            i18n['com.affine.admin.the-expired-signing-key-was-removed'](),
        });
      }
      setPending(undefined);
      await mutate();
    } catch (error) {
      const friendly = error as UserFriendlyError;
      notify.error({
        title: i18n['com.affine.admin.signing-key-update-failed'](),
        message: friendly.message,
      });
    }
  };

  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-sm">
            {i18n['com.affine.admin.access-token-signing-keys']()}
          </CardTitle>
          <p className="text-xs leading-5 text-muted-foreground">
            {i18n[
              'com.affine.admin.this-server-generated-and-stored-its-signing-key-automatically-rotate-it-here-when-needed-key-materi'
            ]()}{' '}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!active || mutating}
          onClick={() => {
            if (active) setPending({ type: 'rotate', keyId: active.id });
          }}
        >
          {i18n['com.affine.admin.rotate-key']()}{' '}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {keys.length === 0 ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {i18n[
              'com.affine.admin.no-active-signing-key-is-available-restart-the-server-to-retry-automatic-initialization'
            ]()}{' '}
          </div>
        ) : (
          keys.map(key => {
            return (
              <div
                key={key.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="truncate text-xs">{key.id}</code>
                    <Badge
                      variant={
                        key.status === 'active' ? 'default' : 'secondary'
                      }
                    >
                      {key.status === 'active'
                        ? i18n['com.affine.localmind.aiContext.active']()
                        : i18n['com.affine.admin.retiring']()}
                    </Badge>
                    {key.source === 'auto' ? (
                      <Badge variant="outline">
                        {i18n['com.affine.admin.auto-generated']()}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {i18n['com.affine.integration.readwise-prop.created']()}{' '}
                    {formatDate(key.createdAt)}
                    {key.verifyUntil
                      ? ` · Verifiable until ${formatDate(key.verifyUntil)}`
                      : ''}
                    {key.retiredAt
                      ? ` · Retired ${formatDate(key.retiredAt)}`
                      : ''}
                  </div>
                </div>
                {key.status === 'retiring' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!key.canDelete || mutating}
                    title={
                      key.canDelete
                        ? i18n['com.affine.admin.delete-expired-key']()
                        : i18n[
                            'com.affine.admin.this-key-can-be-deleted-after-its-verification-window-ends'
                          ]()
                    }
                    onClick={() =>
                      setPending({ type: 'delete', keyId: key.id })
                    }
                  >
                    {i18n['com.affine.localmind.aiContext.delete']()}{' '}
                  </Button>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={open => {
          if (!open && !mutating) setPending(undefined);
        }}
        title={
          pending?.type === 'delete'
            ? i18n['com.affine.admin.delete-signing-key']()
            : i18n['com.affine.admin.rotate-signing-key']()
        }
        description={
          pending?.type === 'delete'
            ? i18n[
                'com.affine.admin.the-expired-key-will-be-permanently-removed'
              ]()
            : i18n[
                'com.affine.admin.a-new-key-will-become-active-immediately-the-current-key-remains-available-only-long-enough-to-verif'
              ]()
        }
        confirmText={
          pending?.type === 'delete'
            ? i18n['com.affine.admin.delete-key']()
            : i18n['com.affine.admin.rotate-key']()
        }
        confirmButtonVariant={
          pending?.type === 'delete' ? 'destructive' : 'default'
        }
        onConfirm={() => {
          confirm().catch(console.error);
        }}
      />
    </Card>
  );
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : 'Unknown';
}
