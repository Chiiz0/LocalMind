import { Empty } from '@affine/component';
import { useI18n } from '@affine/i18n';

export const ThemeEmpty = () => {
  const i18n = useI18n();
  return (
    <div
      style={{ width: 0, flex: 1, display: 'flex', justifyContent: 'center' }}
    >
      <Empty description={i18n['com.affine.ui.select-a-variable-to-edit']()} />
    </div>
  );
};
