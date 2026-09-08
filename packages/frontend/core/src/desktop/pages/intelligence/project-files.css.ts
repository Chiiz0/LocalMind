import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, style } from '@vanilla-extract/css';

export const selectionCheckbox = style({
  appearance: 'auto',
  width: 16,
  height: 16,
  flex: '0 0 16px',
});

export const root = style({
  minWidth: 0,
  minHeight: 0,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  padding: 12,
});
export const fileScroll = style({ flex: 1, minHeight: 0, overflow: 'auto' });
export const uploads = style({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  maxHeight: 160,
  overflow: 'auto',
});
export const uploadRow = style({
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
  minHeight: 36,
  fontSize: 12,
  padding: '4px 8px',
});
globalStyle(`${uploadRow} progress`, { width: 80, height: 5 });
export const toolbar = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 4,
  padding: '4px 6px',
});
export const heading = style({
  flex: 1,
  minWidth: 0,
  margin: 0,
  fontSize: 14,
  fontWeight: 600,
  overflowWrap: 'anywhere',
});
export const list = style({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  minWidth: 0,
});
export const nested = style({ marginLeft: 12, minWidth: 0 });
export const row = style({
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
  minHeight: 34,
  borderRadius: 4,
  selectors: {
    '&:hover': { background: cssVarV2('layer/background/hoverOverlay') },
    '&[data-dragging="true"]': { opacity: 0.45 },
    '&[data-drop="make-child"]': {
      background: cssVarV2('layer/background/hoverOverlay'),
      outline: `1px solid ${cssVarV2('button/primary')}`,
    },
    '&[data-drop="reorder-above"]': {
      boxShadow: `inset 0 2px ${cssVarV2('button/primary')}`,
    },
    '&[data-drop="reorder-below"]': {
      boxShadow: `inset 0 -2px ${cssVarV2('button/primary')}`,
    },
  },
});
export const open = style({
  flex: 1,
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  minWidth: 0,
  minHeight: 34,
  padding: '4px 6px',
  border: 0,
  borderRadius: 4,
  textAlign: 'left',
  background: 'transparent',
  color: cssVarV2('text/primary'),
  cursor: 'pointer',
  fontSize: 14,
  selectors: {
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -2,
    },
    '&[aria-current="true"]': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
  },
});
globalStyle(`${open} > svg`, { flexShrink: 0, width: 16, height: 16 });
export const title = style({
  minWidth: 0,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
export const state = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: '16px 8px',
  color: cssVarV2('text/secondary'),
  fontSize: 12,
  overflowWrap: 'anywhere',
});
export const form = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minWidth: 0,
});
export const actions = style({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: 8,
});
export const breadcrumbs = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 4,
  minWidth: 0,
});
export const picker = style({
  height: 280,
  overflow: 'auto',
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 4,
});
export const preview = style({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: 0,
  height: '100%',
  overflow: 'hidden',
  background: cssVarV2('layer/background/primary'),
});
export const content = style({
  minWidth: 0,
  minHeight: 0,
  flex: 1,
  overflow: 'auto',
  position: 'relative',
});
export const editor = style({
  width: '100%',
  minHeight: '100%',
  position: 'relative',
});
globalStyle(`${editor} editor-host`, {
  display: 'block',
  width: '100%',
  minHeight: '100%',
});
globalStyle(`${editor}[data-mode="edgeless"]`, {
  height: '100%',
  overflow: 'hidden',
});
globalStyle(`${editor}[data-mode="edgeless"] editor-host`, { height: '100%' });
export const hidden = style({ display: 'none' });
export const officeBody = style({
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  selectors: {
    '&[data-chat-open="true"]': {
      gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 360px)',
    },
  },
  '@media': {
    '(max-width: 1000px)': {
      selectors: {
        '&[data-chat-open="true"]': { gridTemplateColumns: 'minmax(0, 1fr)' },
      },
    },
  },
});
export const officeEditor = style([
  content,
  {
    '@media': {
      '(max-width: 1000px)': {
        selectors: {
          [`${officeBody}[data-chat-open="true"] &`]: { display: 'none' },
        },
      },
    },
  },
]);
export const officeChat = style({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: 0,
  borderLeft: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
});
export const officeConversation = style({ flex: 1, minWidth: 0, minHeight: 0 });
