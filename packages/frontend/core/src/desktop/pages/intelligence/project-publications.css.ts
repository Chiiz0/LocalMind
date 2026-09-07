import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, style } from '@vanilla-extract/css';

export const dialog = style({ width: 680, maxWidth: 'calc(100vw - 32px)' });

export const panel = style({
  minWidth: 0,
  borderTop: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  fontSize: 12,
});
export const header = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
  padding: 8,
  minHeight: 36,
});
export const title = style({
  flex: 1,
  minWidth: 0,
  overflowWrap: 'anywhere',
  fontWeight: 600,
});
export const rows = style({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  maxHeight: 260,
  overflow: 'auto',
});
export const row = style({
  padding: 8,
  borderTop: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
});
export const meta = style({
  color: cssVarV2('text/secondary'),
  fontSize: 12,
  overflowWrap: 'anywhere',
  margin: '4px 0',
});
export const form = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minWidth: 0,
  maxHeight: 'min(700px, calc(100dvh - 120px))',
  overflow: 'auto',
});
export const footer = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  justifyContent: 'flex-end',
  paddingTop: 8,
  marginTop: 'auto',
  borderTop: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
});
export const browser = style({
  minHeight: 140,
  height: 240,
  overflow: 'auto',
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 4,
});
export const choice = style({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  minHeight: 36,
  gap: 8,
  padding: 8,
  border: 0,
  background: 'transparent',
  color: cssVarV2('text/primary'),
  textAlign: 'left',
  fontSize: 12,
  cursor: 'pointer',
  selectors: {
    '&:hover': { background: cssVarV2('layer/background/hoverOverlay') },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -2,
    },
    '&:disabled': { opacity: 0.5, cursor: 'default' },
    '&[aria-pressed="true"]': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
  },
});
globalStyle(`${choice} svg`, { width: 18, height: 18, flexShrink: 0 });
export const error = style({
  color: cssVarV2('status/error'),
  fontSize: 12,
  margin: 0,
  overflowWrap: 'anywhere',
});
export const comparison = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
  '@media': { '(max-width: 600px)': { gridTemplateColumns: 'minmax(0, 1fr)' } },
});
export const excerpt = style({
  margin: '4px 0 0',
  padding: 8,
  maxHeight: 220,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  fontSize: 12,
  fontFamily: 'inherit',
  background: cssVarV2('layer/background/secondary'),
  borderRadius: 4,
});
