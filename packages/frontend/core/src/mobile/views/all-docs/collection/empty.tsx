import type { Collection } from '@affine/core/modules/collection';
import { useI18n } from '@affine/i18n';

import { DetailHeader } from './detail';

export const EmptyCollection = ({ collection }: { collection: Collection }) => {
  const i18n = useI18n();
  return (
    <>
      <DetailHeader collection={collection} />
      {i18n['com.affine.selectPage.empty']()}{' '}
    </>
  );
};
