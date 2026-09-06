import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const content = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  alignItems: 'center',
  gap: 6,
  padding: '6px 8px',
  borderRadius: 8,
  selectors: {
    // assume that the section can be dragged over
    '&[data-dragged-over="true"]': {
      backgroundColor: cssVarV2('layer/background/hoverOverlay'),
    },
  },
});
export const iconWrapper = style({
  width: 20,
  height: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});
export const icon = style({
  fontSize: 20,
  color: cssVarV2('icon/secondary'),
});
export const message = style({
  fontSize: cssVar('fontSm'),
  textAlign: 'left',
  flex: 1,
  minWidth: 0,
  color: cssVarV2('text/tertiary'),
  userSelect: 'none',
  fontWeight: 400,
  lineHeight: '22px',
});

export const newButton = style({
  flexShrink: 0,
  width: 28,
  height: 28,
});
