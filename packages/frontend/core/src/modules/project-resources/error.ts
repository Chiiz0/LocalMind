import { notify } from '@affine/component';
import { UserFriendlyError } from '@affine/error';
import { getOrCreateI18n } from '@affine/i18n';

export function projectErrorMessage(caught: unknown) {
  const error = UserFriendlyError.fromAny(caught);
  const key =
    error.name === 'NETWORK_ERROR' || caught instanceof TypeError
      ? 'network'
      : error.status === 401 || error.status === 403
        ? 'permission'
        : error.status === 404
          ? 'unavailable'
          : error.status === 409
            ? 'conflict'
            : 'failed';
  return getOrCreateI18n().t(`com.affine.localmind.project-error.${key}`);
}

export function reportProjectError(caught: unknown) {
  notify.error({ title: projectErrorMessage(caught) });
}
