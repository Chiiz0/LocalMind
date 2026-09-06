import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const panel = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});

export const controls = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
  gap: 12,
  '@media': {
    'screen and (max-width: 720px)': { gridTemplateColumns: '1fr' },
  },
});

export const field = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0,
});

export const label = style({
  color: cssVarV2('text/secondary'),
  fontSize: cssVar('fontXs'),
  fontWeight: 500,
});

export const select = style({
  width: '100%',
  minHeight: 36,
  padding: '6px 10px',
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 8,
  color: cssVarV2('text/primary'),
  background: cssVarV2('layer/background/primary'),
  font: 'inherit',
  outline: 'none',
  selectors: {
    '&:focus-visible': {
      borderColor: cssVarV2('button/primary'),
    },
    '&:disabled': { opacity: 0.55 },
  },
});

export const rightsGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
  padding: 12,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 10,
  background: cssVarV2('layer/background/secondary'),
  '@media': {
    'screen and (max-width: 560px)': { gridTemplateColumns: '1fr' },
  },
});

export const right = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 28,
  color: cssVarV2('text/primary'),
  fontSize: cssVar('fontSm'),
});

export const actions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: 8,
});

export const hint = style({
  margin: 0,
  color: cssVarV2('text/secondary'),
  fontSize: cssVar('fontXs'),
  lineHeight: 1.5,
});

export const state = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  minHeight: 96,
  color: cssVarV2('text/secondary'),
  fontSize: cssVar('fontSm'),
});

export const error = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: 12,
  borderRadius: 8,
  color: cssVarV2('status/error'),
  background: cssVarV2('layer/background/secondary'),
  fontSize: cssVar('fontSm'),
});

export const list = style({
  display: 'flex',
  flexDirection: 'column',
});

export const row = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 12,
  minHeight: 56,
  padding: '10px 0',
  borderBottom: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  '@media': {
    'screen and (max-width: 720px)': {
      gridTemplateColumns: '1fr',
      gap: 4,
    },
  },
});

export const primary = style({
  minWidth: 0,
  overflow: 'hidden',
  color: cssVarV2('text/primary'),
  fontSize: cssVar('fontSm'),
  fontWeight: 500,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const secondary = style({
  minWidth: 0,
  overflow: 'hidden',
  color: cssVarV2('text/secondary'),
  fontSize: cssVar('fontXs'),
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const badge = style({
  padding: '2px 7px',
  borderRadius: 999,
  color: cssVarV2('text/secondary'),
  background: cssVarV2('layer/background/secondary'),
  fontSize: 11,
  whiteSpace: 'nowrap',
});

export const auditRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  padding: '11px 0',
  borderBottom: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
});

export const auditMeta = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
  color: cssVarV2('text/secondary'),
  fontSize: cssVar('fontXs'),
});

export const loadMore = style({
  display: 'flex',
  justifyContent: 'center',
  paddingTop: 12,
});
