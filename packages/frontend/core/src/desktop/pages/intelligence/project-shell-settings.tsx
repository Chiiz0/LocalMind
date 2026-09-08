import { Modal, RadioGroup } from '@affine/component';
import { LanguageMenu } from '@affine/core/components/affine/language-menu';
import { useI18n } from '@affine/i18n';
import { useTheme } from 'next-themes';

export const ProjectShellSettings = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const t = useI18n();
  const { theme, setTheme } = useTheme();
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t['com.affine.appearanceSettings.title']()}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          paddingBlock: 16,
        }}
      >
        <RadioGroup
          value={theme}
          onChange={setTheme}
          items={[
            { value: 'system', label: t['com.affine.themeSettings.system']() },
            { value: 'light', label: t['com.affine.themeSettings.light']() },
            { value: 'dark', label: t['com.affine.themeSettings.dark']() },
          ]}
        />
        <LanguageMenu />
      </div>
    </Modal>
  );
};
