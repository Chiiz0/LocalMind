import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, style } from '@vanilla-extract/css';

export const body = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  minWidth: 0,
  fontSize: 14,
});
export const metadata = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(80px, 1fr) minmax(0, 2fr)',
  gap: '8px 16px',
  margin: 0,
});
globalStyle(`${metadata} dd`, { margin: 0, overflowWrap: 'anywhere' });
globalStyle(`${metadata} dt`, { color: cssVarV2('text/secondary') });
export const actions = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
});
export const field = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minWidth: 0,
});
export const input = style({ maxWidth: '100%', minWidth: 0, font: 'inherit' });
export const checkbox = style({
  appearance: 'auto',
  display: 'inline-block',
  flex: '0 0 16px',
  width: 16,
  height: 16,
  marginTop: 2,
});
globalStyle(`${actions} strong`, { minWidth: 0, overflowWrap: 'anywhere' });
export const confirmation = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  overflowWrap: 'anywhere',
});
export const error = style({ color: cssVarV2('status/error') });
