import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const root = style({
  minWidth: 0,
  minHeight: 0,
  overflowY: 'auto',
  padding: '12px 24px',
  scrollbarColor: `${cssVarV2('layer/insideBorder/border')} transparent`,
  scrollbarWidth: 'thin',
  '@media': {
    'screen and (max-width: 760px)': { padding: '8px 12px' },
  },
});

export const list = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
});

export const project = style({
  minWidth: 0,
  minHeight: 64,
  display: 'grid',
  gridTemplateColumns: '24px minmax(0, 1fr) auto 20px',
  alignItems: 'center',
  gap: 12,
  padding: '12px 8px',
  borderBottom: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  color: cssVarV2('text/primary'),
  textDecoration: 'none',
  selectors: {
    '&:hover': { background: cssVarV2('layer/background/hoverOverlay') },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -2,
    },
  },
  '@media': {
    'screen and (max-width: 760px)': {
      gridTemplateColumns: '24px minmax(0, 1fr) 20px',
      gap: '4px 12px',
    },
  },
});

export const icon = style({
  width: 24,
  height: 24,
  color: cssVarV2('icon/primary'),
});

export const details = style({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  overflowWrap: 'anywhere',
});

export const name = style({
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 500,
});

export const description = style({
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
});

export const role = style({
  fontSize: 12,
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
  '@media': {
    'screen and (max-width: 760px)': {
      gridColumn: 2,
      gridRow: 2,
    },
  },
});

export const arrow = style({
  width: 20,
  height: 20,
  color: cssVarV2('icon/secondary'),
  '@media': {
    'screen and (max-width: 760px)': {
      gridColumn: 3,
      gridRow: '1 / 3',
    },
  },
});

export const state = style({
  minHeight: 160,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  padding: 24,
  color: cssVarV2('text/secondary'),
  fontSize: 14,
  lineHeight: '20px',
  textAlign: 'center',
  overflowWrap: 'anywhere',
});
