import type { Tag } from '@affine/core/modules/tag';
import { useI18n } from '@affine/i18n';

import { TagDetailHeader } from './detail-header';

export const TagEmpty = ({ tag }: { tag: Tag }) => {
  const i18n = useI18n();
  return (
    <>
      <TagDetailHeader tag={tag} />
      {i18n['com.affine.selectPage.empty']()}{' '}
    </>
  );
};
