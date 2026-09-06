import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, style } from '@vanilla-extract/css';

export const root = style({
  minWidth: 0,
  flexShrink: 0,
  borderBottom: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/primary'),
});

export const summary = style({
  minWidth: 0,
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
});

export const mobileNavigationToggle = style({
  display: 'none',
  '@media': {
    'screen and (max-width: 760px)': {
      display: 'inline-flex',
      flexShrink: 0,
    },
  },
});

export const summaryToggle = style({
  minWidth: 0,
  minHeight: 30,
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '4px 6px',
  border: 0,
  borderRadius: 4,
  background: 'transparent',
  color: cssVarV2('text/primary'),
  cursor: 'pointer',
  textAlign: 'left',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -2,
    },
  },
});

export const summarySegment = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  color: cssVarV2('text/secondary'),
  fontSize: 12,
  whiteSpace: 'nowrap',
  '@media': {
    'screen and (max-width: 760px)': {
      selectors: {
        '&:not(:first-of-type)': {
          display: 'none',
        },
      },
    },
  },
});

export const count = style({
  minWidth: 18,
  height: 18,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 5px',
  borderRadius: 9,
  background: cssVarV2('layer/background/secondary'),
  color: cssVarV2('text/secondary'),
  fontSize: 11,
  lineHeight: '18px',
  fontVariantNumeric: 'tabular-nums',
});

export const attentionCount = style([
  count,
  {
    background: cssVarV2('status/error'),
    color: cssVarV2('text/pureWhite'),
  },
]);

export const expandedContent = style({
  minWidth: 0,
  height: 280,
  borderTop: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  overflow: 'hidden',
  selectors: {
    '&[data-compact="true"]': {
      height: 'auto',
      minHeight: 64,
    },
  },
  '@media': {
    'screen and (max-height: 720px)': {
      height: 220,
    },
  },
});

export const board = style({
  width: '100%',
  height: '100%',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))',
  overflowX: 'auto',
  overscrollBehaviorX: 'contain',
  scrollbarColor: `${cssVarV2('layer/insideBorder/border')} transparent`,
  scrollbarWidth: 'thin',
  '@media': {
    'screen and (max-width: 760px)': {
      gridTemplateColumns: 'repeat(3, minmax(240px, 82vw))',
    },
  },
});

export const column = style({
  minWidth: 0,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  selectors: {
    '&:not(:last-child)': {
      borderRight: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
    },
  },
});

export const columnHeader = style({
  minHeight: 38,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '8px 12px',
});

export const todoHeaderActions = style({
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 6,
});

export const columnBody = style({
  minWidth: 0,
  minHeight: 0,
  flex: 1,
  overflowY: 'auto',
  padding: '0 8px 8px',
  scrollbarColor: `${cssVarV2('layer/insideBorder/border')} transparent`,
  scrollbarWidth: 'thin',
});

export const groupTitle = style({
  minHeight: 26,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 4px',
  color: cssVarV2('text/tertiary'),
  fontSize: 11,
  lineHeight: '16px',
  selectors: {
    '&:not(:first-child)': {
      marginTop: 8,
    },
  },
});

export const blockerGroupTitle = style([
  groupTitle,
  {
    marginTop: 2,
    color: cssVarV2('text/secondary'),
    fontWeight: 600,
  },
]);

export const taskCard = style({
  marginBottom: 6,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 6,
  background: cssVarV2('layer/background/primary'),
  overflow: 'hidden',
  selectors: {
    '&[data-status="failed"]': {
      borderColor: cssVarV2('status/error'),
    },
    '&[data-blocker][data-overdue]': {
      borderColor: cssVarV2('status/error'),
      background: cssVarV2('layer/background/secondary'),
    },
  },
});

export const taskLink = style({
  width: '100%',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 5,
  padding: '9px 10px',
  border: 0,
  background: 'transparent',
  color: cssVarV2('text/primary'),
  cursor: 'pointer',
  textAlign: 'left',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -2,
    },
  },
});

export const taskTopline = style({
  minWidth: 0,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
});

export const taskTitle = style({
  minWidth: 0,
  overflow: 'hidden',
  color: cssVarV2('text/primary'),
  fontSize: 12,
  lineHeight: '17px',
  fontWeight: 600,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const status = style({
  flexShrink: 0,
  maxWidth: 110,
  padding: '1px 5px',
  borderRadius: 3,
  overflow: 'hidden',
  background: cssVarV2('layer/background/secondary'),
  color: cssVarV2('text/secondary'),
  fontSize: 10,
  lineHeight: '16px',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  selectors: {
    '&[data-status="running"], &[data-status="queued"]': {
      color: cssVarV2('text/link'),
    },
    '&[data-status="failed"]': {
      color: cssVarV2('status/error'),
    },
    '&[data-status="completed"]': {
      color: cssVarV2('status/success'),
    },
  },
});

export const taskMeta = style({
  color: cssVarV2('text/tertiary'),
  fontSize: 10,
  lineHeight: '15px',
  fontVariantNumeric: 'tabular-nums',
});

export const blockerDetails = style({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 3,
  color: cssVarV2('text/secondary'),
  fontSize: 11,
  lineHeight: '16px',
});

export const blockerWaitingOn = style({
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
});

export const blockerDueDate = style({
  minWidth: 0,
  maxWidth: '100%',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  overflowWrap: 'anywhere',
  fontVariantNumeric: 'tabular-nums',
  selectors: {
    '&[data-overdue]': {
      color: cssVarV2('status/error'),
      fontWeight: 600,
    },
  },
});

export const failure = style({
  display: '-webkit-box',
  overflow: 'hidden',
  color: cssVarV2('status/error'),
  fontSize: 11,
  lineHeight: '16px',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
});

export const taskActions = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 5,
  padding: '0 8px 8px',
});

export const blockerForm = style({
  minWidth: 0,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
  gap: 8,
  marginBottom: 8,
  padding: 10,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 6,
  background: cssVarV2('layer/background/secondary'),
  selectors: {
    '&:focus-within': {
      borderColor: cssVarV2('button/primary'),
    },
  },
  '@media': {
    'screen and (max-width: 760px)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
});

export const blockerFieldWide = style({
  gridColumn: '1 / -1',
  '@media': {
    'screen and (max-width: 760px)': {
      gridColumn: 'auto',
    },
  },
});

export const blockerFormError = style({
  minWidth: 0,
  gridColumn: '1 / -1',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 5,
  color: cssVarV2('status/error'),
  fontSize: 11,
  lineHeight: '16px',
  overflowWrap: 'anywhere',
});

export const blockerFormActions = style({
  minWidth: 0,
  gridColumn: '1 / -1',
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: 6,
});

export const viewAll = style({
  minHeight: 30,
  flexShrink: 0,
  padding: '5px 10px',
  border: 0,
  borderTop: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: 'transparent',
  color: cssVarV2('text/link'),
  cursor: 'pointer',
  fontSize: 11,
  textAlign: 'left',
  selectors: {
    '&:hover': {
      background: cssVarV2('layer/background/hoverOverlay'),
      textDecoration: 'underline',
      textUnderlineOffset: 2,
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -2,
    },
  },
});

export const emptyColumn = style({
  minHeight: 72,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 12,
  color: cssVarV2('text/tertiary'),
  fontSize: 11,
  textAlign: 'center',
});

export const emptyGroup = style({
  padding: '6px 4px 10px',
  color: cssVarV2('text/tertiary'),
  fontSize: 11,
});

export const centerState = style({
  width: '100%',
  minHeight: 64,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  padding: 16,
  color: cssVarV2('text/secondary'),
  fontSize: 12,
  textAlign: 'center',
  overflowWrap: 'anywhere',
});

export const emptyState = style({
  minHeight: 64,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 20px',
  color: cssVarV2('text/secondary'),
  fontSize: 13,
  lineHeight: '20px',
});

globalStyle(`${emptyState} > svg`, {
  width: 20,
  height: 20,
  flexShrink: 0,
  color: cssVarV2('icon/secondary'),
});

globalStyle(`${summaryToggle} > svg`, {
  width: 16,
  height: 16,
  flexShrink: 0,
  transition: 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)',
});

globalStyle(`${summaryToggle} > svg[data-expanded="false"]`, {
  transform: 'rotate(-90deg)',
});

globalStyle(`${summaryToggle} > strong`, {
  fontSize: 13,
  fontWeight: 600,
});

globalStyle(`${columnHeader} > h3`, {
  margin: 0,
  color: cssVarV2('text/secondary'),
  fontSize: 12,
  lineHeight: '18px',
  fontWeight: 600,
  letterSpacing: 0,
});

globalStyle(`${todoHeaderActions} button`, {
  minHeight: 24,
  padding: '2px 6px',
  fontSize: 11,
});

globalStyle(`${blockerForm} label`, {
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  color: cssVarV2('text/secondary'),
  fontSize: 11,
  lineHeight: '15px',
});

globalStyle(`${blockerForm} input, ${blockerForm} select`, {
  width: '100%',
  minWidth: 0,
  minHeight: 30,
  padding: '5px 7px',
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 4,
  outline: 0,
  background: cssVarV2('layer/background/primary'),
  color: cssVarV2('text/primary'),
  fontFamily: 'inherit',
  fontSize: 12,
  lineHeight: '18px',
  letterSpacing: 0,
  '@media': {
    'screen and (max-width: 760px)': {
      fontSize: 16,
    },
  },
});

globalStyle(
  `${blockerForm} input:focus-visible, ${blockerForm} select:focus-visible`,
  {
    borderColor: cssVarV2('button/primary'),
    outline: `1px solid ${cssVarV2('button/primary')}`,
    outlineOffset: 0,
  }
);

globalStyle(`${blockerForm} input:disabled, ${blockerForm} select:disabled`, {
  cursor: 'not-allowed',
  opacity: 0.55,
});

globalStyle(`${blockerDueDate} > svg, ${blockerFormError} > svg`, {
  width: 14,
  height: 14,
  flexShrink: 0,
});

globalStyle(`${blockerFormActions} button`, {
  minHeight: 26,
  padding: '3px 8px',
  fontSize: 11,
});

globalStyle(`${groupTitle} > svg`, {
  width: 14,
  height: 14,
});

globalStyle(`${taskActions} button`, {
  minHeight: 24,
  padding: '3px 8px',
  fontSize: 11,
});

globalStyle(`${centerState} > svg`, {
  width: 20,
  height: 20,
  color: cssVarV2('status/error'),
});
