import { Menu, MenuItem, MenuTrigger, notify } from '@affine/component';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import { EditorService } from '@affine/core/modules/editor';
import { ShareInfoService } from '@affine/core/modules/share-doc';
import { UserFriendlyError } from '@affine/error';
import { PublicDocMode } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import track from '@affine/track';
import {
  LockIcon,
  SingleSelectCheckSolidIcon,
  ViewIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { cssVar } from '@toeverything/theme';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

import * as styles from './styles.css';

export const PublicDoc = ({ disabled }: { disabled?: boolean }) => {
  const t = useI18n();
  const editorService = useService(EditorService);
  const shareInfoService = useService(ShareInfoService);
  const isSharedPage = useLiveData(shareInfoService.shareInfo.isShared$);
  const isRevalidating = useLiveData(
    shareInfoService.shareInfo.isRevalidating$
  );
  const currentMode = useLiveData(editorService.editor.mode$);
  const pending = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    shareInfoService.shareInfo.revalidate();
  }, [shareInfoService]);

  const onDisablePublic = useAsyncCallback(async () => {
    if (disabled || !isSharedPage || pending.current) return;
    pending.current = true;
    setIsSubmitting(true);
    try {
      await shareInfoService.shareInfo.disableShare();
      notify.success({
        title:
          t[
            'com.affine.share-menu.disable-publish-link.notification.success.title'
          ](),
        message:
          t[
            'com.affine.share-menu.disable-publish-link.notification.success.message'
          ](),
      });
    } catch {
      notify.error({
        title:
          t[
            'com.affine.share-menu.disable-publish-link.notification.fail.title'
          ](),
        message:
          t[
            'com.affine.share-menu.disable-publish-link.notification.fail.message'
          ](),
      });
    } finally {
      pending.current = false;
      setIsSubmitting(false);
    }
  }, [disabled, isSharedPage, shareInfoService, t]);

  const onClickAnyoneReadOnlyShare = useAsyncCallback(async () => {
    if (disabled || isSharedPage || pending.current) {
      return;
    }
    pending.current = true;
    setIsSubmitting(true);
    try {
      // TODO(@JimmFly): remove mode when we have a better way to handle it
      await shareInfoService.shareInfo.enableShare(
        currentMode === 'edgeless' ? PublicDocMode.Edgeless : PublicDocMode.Page
      );
      track.$.sharePanel.$.createShareLink();
      notify.success({
        title:
          t[
            'com.affine.share-menu.create-public-link.notification.success.title'
          ](),
        message:
          t[
            'com.affine.share-menu.create-public-link.notification.success.message'
          ](),
        style: 'normal',
        icon: <SingleSelectCheckSolidIcon color={cssVar('primaryColor')} />,
      });
    } catch (error) {
      const err = UserFriendlyError.fromAny(error);
      notify.error({
        title: err.name,
        message: err.message,
      });
    } finally {
      pending.current = false;
      setIsSubmitting(false);
    }
  }, [disabled, currentMode, isSharedPage, shareInfoService.shareInfo, t]);

  return (
    <div className={styles.rowContainerStyle}>
      <div className={styles.labelStyle}>
        {t['com.affine.share-menu.option.link.label']()}
      </div>
      {disabled ? (
        <div className={clsx(styles.menuTriggerStyle, 'disable')}>
          <div className={styles.menuTriggerText}>
            {isSharedPage
              ? t['com.affine.share-menu.option.link.readonly']()
              : t['com.affine.share-menu.option.link.no-access']()}
          </div>
        </div>
      ) : (
        <Menu
          contentOptions={{
            align: 'end',
          }}
          items={
            <>
              <MenuItem
                prefixIcon={<LockIcon />}
                onSelect={onDisablePublic}
                selected={!isSharedPage}
                disabled={isSubmitting || isRevalidating || !isSharedPage}
              >
                <div className={styles.publicItemRowStyle}>
                  <div>
                    {t['com.affine.share-menu.option.link.no-access']()}
                  </div>
                </div>
              </MenuItem>
              <MenuItem
                prefixIcon={<ViewIcon />}
                onSelect={onClickAnyoneReadOnlyShare}
                data-testid="share-link-menu-enable-share"
                selected={!!isSharedPage}
                disabled={isSubmitting || isRevalidating || !!isSharedPage}
              >
                <div className={styles.publicItemRowStyle}>
                  <div>{t['com.affine.share-menu.option.link.readonly']()}</div>
                </div>
              </MenuItem>
            </>
          }
        >
          <MenuTrigger
            className={styles.menuTriggerStyle}
            data-testid="share-link-menu-trigger"
            variant="plain"
            suffixClassName={styles.suffixClassName}
            contentStyle={{
              width: '100%',
            }}
            loading={isRevalidating || isSubmitting}
            disabled={isRevalidating || isSubmitting}
          >
            {isSharedPage
              ? t['com.affine.share-menu.option.link.readonly']()
              : t['com.affine.share-menu.option.link.no-access']()}
          </MenuTrigger>
        </Menu>
      )}
    </div>
  );
};
