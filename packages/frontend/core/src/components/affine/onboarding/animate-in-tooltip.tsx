import { Button } from '@affine/component';
import { useI18n } from '@affine/i18n';

import * as styles from './animate-in-tooltip.css';

interface AnimateInTooltipProps {
  onNext: () => void;
  visible?: boolean;
}

export const AnimateInTooltip = ({
  onNext,
  visible,
}: AnimateInTooltipProps) => {
  const i18n = useI18n();
  return (
    <>
      <div className={styles.tooltip}>
        {i18n['com.affine.ui.onboarding-workspace']()}
      </div>
      <div className={styles.next}>
        {visible ? (
          <Button variant="primary" size="extraLarge" onClick={onNext}>
            {i18n['com.affine.ai-onboarding.general.next']()}{' '}
          </Button>
        ) : null}
      </div>
    </>
  );
};
