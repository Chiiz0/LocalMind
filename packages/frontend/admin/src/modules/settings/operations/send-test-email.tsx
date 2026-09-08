import { Button } from '@affine/admin/components/ui/button';
import { useMutation } from '@affine/admin/use-mutation';
import { notify } from '@affine/component';
import type { UserFriendlyError } from '@affine/error';
import { sendTestEmailMutation } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { useCallback } from 'react';

import type { AppConfig } from '../config';

export function SendTestEmail({ appConfig }: { appConfig: AppConfig }) {
  const i18n = useI18n();
  const { trigger } = useMutation({
    mutation: sendTestEmailMutation,
  });

  const onClick = useCallback(() => {
    trigger(appConfig.mailer.SMTP)
      .then(() => {
        notify.success({
          title: i18n['com.affine.admin.test-email-sent'](),
          message:
            i18n[
              'com.affine.admin.the-test-email-has-been-successfully-sent'
            ](),
        });
      })
      .catch((err: UserFriendlyError) => {
        notify.error({
          title: i18n['com.affine.admin.failed-to-send-test-email'](),
          message: err.message,
        });
      });
  }, [appConfig, trigger, i18n]);

  return (
    <Button onClick={onClick}>
      {i18n['com.affine.admin.send-test-email']()}
    </Button>
  );
}
