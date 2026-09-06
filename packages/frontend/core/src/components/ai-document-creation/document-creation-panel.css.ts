import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const panel = style({
  maxHeight: 260,
  overflowY: 'auto',
  flexShrink: 0,
  minWidth: 0,
  borderBottom: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  fontSize: 13,
});
export const row = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  minWidth: 0,
  overflowWrap: 'anywhere',
  borderBottom: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
});
export const summary = style({
  display: 'flex',
  alignItems: 'baseline',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
});
export const fields = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
  '@media': { '(max-width: 600px)': { gridTemplateColumns: 'minmax(0, 1fr)' } },
});
export const field = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 0,
});
export const actions = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
});

export const select = style({
  width: '100%',
  minWidth: 0,
  height: 34,
  borderRadius: 4,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  padding: '0 8px',
  color: cssVarV2('text/primary'),
  background: cssVarV2('layer/background/primary'),
  font: 'inherit',
});
