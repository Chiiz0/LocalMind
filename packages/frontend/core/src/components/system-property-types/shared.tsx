import { MenuItem } from '@affine/component';
import type { FilterParams } from '@affine/core/modules/collection-rules';
import { useI18n } from '@affine/i18n';

import { FilterValueMenu } from '../filter/filter-value-menu';

export const SharedFilterValue = ({
  filter,
  isDraft,
  onDraftCompleted,
  onChange,
}: {
  filter: FilterParams;
  isDraft?: boolean;
  onDraftCompleted?: () => void;
  onChange?: (filter: FilterParams) => void;
}) => {
  const i18n = useI18n();
  return (
    <FilterValueMenu
      isDraft={isDraft}
      onDraftCompleted={onDraftCompleted}
      items={
        <>
          <MenuItem
            onClick={() => {
              onChange?.({
                ...filter,
                value: 'true',
              });
            }}
            selected={filter.value === 'true'}
          >
            {i18n['com.affine.ui.true']()}
          </MenuItem>
          <MenuItem
            onClick={() => {
              onChange?.({
                ...filter,
                value: 'false',
              });
            }}
            selected={filter.value !== 'true'}
          >
            {i18n['com.affine.ui.false']()}
          </MenuItem>
        </>
      }
    >
      <span>
        {filter.value === 'true'
          ? i18n['com.affine.ui.true']()
          : i18n['com.affine.ui.false']()}
      </span>
    </FilterValueMenu>
  );
};
