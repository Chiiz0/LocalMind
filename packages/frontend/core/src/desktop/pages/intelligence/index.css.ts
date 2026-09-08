import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, style } from '@vanilla-extract/css';

export const root = style({
  position: 'relative',
  width: '100vw',
  height: '100dvh',
  minWidth: 0,
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: '264px minmax(0, 1fr)',
  overflow: 'hidden',
  background: cssVarV2('layer/background/primary'),
  color: cssVarV2('text/primary'),
  letterSpacing: 0,
  '@media': {
    'screen and (max-width: 760px)': {
      display: 'block',
    },
  },
});

export const rail = style({
  minWidth: 0,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  borderRight: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/secondary'),
  '@media': {
    'screen and (max-width: 760px)': {
      position: 'absolute',
      zIndex: 4,
      insetBlock: 0,
      insetInlineStart: 0,
      width: 'min(86vw, 288px)',
      visibility: 'hidden',
      transform: 'translateX(-100%)',
      pointerEvents: 'none',
      transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
      selectors: {
        '&:dir(rtl)': {
          transform: 'translateX(100%)',
        },
        '&[data-mobile-open="true"]': {
          visibility: 'visible',
          transform: 'translateX(0)',
          pointerEvents: 'auto',
        },
      },
    },
  },
});

export const railScrim = style({
  display: 'none',
  '@media': {
    'screen and (max-width: 760px)': {
      position: 'absolute',
      zIndex: 3,
      inset: 0,
      display: 'block',
      border: 0,
      opacity: 0,
      background: cssVarV2('layer/background/overlayPanel'),
      pointerEvents: 'none',
      transition: 'opacity 180ms cubic-bezier(0.16, 1, 0.3, 1)',
      selectors: {
        '&[data-mobile-open="true"]': {
          opacity: 0.52,
          pointerEvents: 'auto',
        },
      },
    },
  },
});

export const railHeader = style({
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '8px 8px 10px',
  borderBottom: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
});

export const workspaceAndAccount = style({
  width: '100%',
  minHeight: 38,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  paddingRight: 4,
});

export const mobileRailClose = style({
  display: 'none',
  '@media': {
    'screen and (max-width: 760px)': {
      display: 'inline-flex',
      flexShrink: 0,
    },
  },
});

export const workspaceSelector = style({
  minWidth: 0,
  flex: 1,
});

export const railUtilities = style({
  display: 'flex',
  flexDirection: 'column',
});

export const workArea = style({
  minWidth: 0,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  '@media': {
    'screen and (max-width: 760px)': {
      width: '100%',
      height: '100%',
    },
  },
});

export const conversationAndPeek = style({
  position: 'relative',
  minWidth: 0,
  minHeight: 0,
  flex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  overflow: 'hidden',
  selectors: {
    '&[data-project="true"][data-fullscreen="false"]': {
      gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)',
    },
  },
  '@media': {
    'screen and (max-width: 760px)': {
      selectors: {
        '&[data-project="true"][data-fullscreen="false"]': {
          gridTemplateColumns: 'minmax(0, 1fr)',
        },
      },
    },
  },
});

export const conversationPane = style({
  minWidth: 0,
  minHeight: 0,
  height: '100%',
  borderLeft: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  selectors: { '&[hidden]': { display: 'none' } },
  '@media': {
    'screen and (max-width: 760px)': {
      selectors: {
        [`${conversationAndPeek}[data-view="files"] &`]: { display: 'none' },
      },
    },
  },
});

export const resourcePane = style({
  minWidth: 0,
  minHeight: 0,
  height: '100%',
  overflow: 'hidden',
  '@media': {
    'screen and (max-width: 760px)': {
      selectors: {
        [`${conversationAndPeek}[data-view="chat"][data-fullscreen="false"] &`]:
          { display: 'none' },
      },
    },
  },
});
export const filesPane = style({
  height: '100%',
  minWidth: 0,
  minHeight: 0,
  selectors: { '&[hidden]': { display: 'none' } },
});
export const projectHeader = style({
  display: 'flex',
  minHeight: 48,
  flexShrink: 0,
  padding: '8px 12px',
  gap: 8,
  alignItems: 'center',
  borderBottom: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
});
export const projectBreadcrumbs = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  alignItems: 'center',
});
globalStyle(`${projectBreadcrumbs} button`, {
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  textAlign: 'start',
  background: 'transparent',
  border: 0,
  padding: '4px 6px',
  color: 'inherit',
  fontSize: 14,
  cursor: 'pointer',
});
globalStyle(`${projectBreadcrumbs} button + button::before`, {
  content: '"/"',
  marginRight: 8,
  color: cssVarV2('text/secondary'),
});
export const mobileViewTabs = style({
  display: 'none',
  '@media': { 'screen and (max-width: 760px)': { display: 'flex', gap: 4 } },
});
export const taskArea = style({ order: 3, flexShrink: 0, minWidth: 0 });

export const peekPane = style({
  minWidth: 0,
  minHeight: 0,
  borderLeft: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  overflow: 'hidden',
  '@media': {
    'screen and (max-width: 1040px)': {
      position: 'absolute',
      zIndex: 2,
      inset: 0,
      borderLeft: 0,
      background: cssVarV2('layer/background/primary'),
    },
  },
});

export const unavailableRoot = style({
  width: '100vw',
  height: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  padding: 24,
  background: cssVarV2('layer/background/primary'),
  color: cssVarV2('text/secondary'),
  textAlign: 'center',
});

globalStyle(`${root} ::selection`, {
  background: cssVarV2('button/primary'),
  color: cssVarV2('button/pureWhiteText'),
});

globalStyle(`${unavailableRoot} > svg`, {
  width: 28,
  height: 28,
  color: cssVarV2('icon/secondary'),
});

globalStyle(`${unavailableRoot} > h1`, {
  margin: '8px 0 0',
  color: cssVarV2('text/primary'),
  fontSize: 20,
  lineHeight: '28px',
  fontWeight: 600,
  letterSpacing: 0,
});

globalStyle(`${unavailableRoot} > p`, {
  maxWidth: 420,
  margin: 0,
  fontSize: 13,
  lineHeight: '20px',
});
