import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

import { open, row } from './project-files.css';

export const help = style({
  margin: 0,
  color: cssVarV2('text/secondary'),
  fontSize: 12,
  lineHeight: 1.6,
  overflowWrap: 'anywhere',
});
export const source = style([
  row,
  {
    gap: 10,
    padding: '10px 12px',
    cursor: 'pointer',
    selectors: {
      '&[data-disabled="true"]': { cursor: 'not-allowed' },
      '&:has(input:checked)': {
        background: cssVarV2('layer/background/hoverOverlay'),
      },
    },
  },
]);
export const sourceText = style({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
});
export const sourceTitle = style({ fontSize: 14, overflowWrap: 'anywhere' });
export const workspace = style([
  open,
  { width: '100%', padding: '12px', minHeight: 44 },
]);
