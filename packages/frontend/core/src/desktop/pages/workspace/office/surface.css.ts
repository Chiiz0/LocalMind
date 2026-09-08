import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, style } from '@vanilla-extract/css';

export const editor = style({
  width: '100%',
  height: '100%',
  minHeight: 0,
  display: 'grid',
  gridTemplateRows: '42px minmax(0, 1fr) 28px',
  overflow: 'hidden',
  color: cssVarV2('text/primary'),
  background: cssVarV2('layer/background/secondary'),
});

export const toolbar = style({
  minWidth: 0,
  display: 'flex',
  flexWrap: 'nowrap',
  alignItems: 'center',
  gap: 6,
  padding: '5px 8px',
  overflowX: 'auto',
  overflowY: 'hidden',
  borderTop: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderBottom: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/primary'),
  whiteSpace: 'nowrap',
});

globalStyle(`${toolbar} > span`, {
  flex: '0 0 auto',
  whiteSpace: 'nowrap',
});

export const toolbarSpacer = style({ flex: 1, minWidth: 8 });

export const field = style({
  height: 28,
  minWidth: 0,
  padding: '0 8px',
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 4,
  outline: 0,
  color: cssVarV2('text/primary'),
  background: cssVarV2('layer/background/primary'),
  fontSize: 12,
  letterSpacing: 0,
  selectors: {
    '&:focus-visible': {
      borderColor: cssVarV2('button/primary'),
      boxShadow: `0 0 0 1px ${cssVarV2('button/primary')}`,
    },
    '&:disabled': {
      cursor: 'not-allowed',
      color: cssVarV2('text/disable'),
      background: cssVarV2('layer/background/secondary'),
    },
  },
});

export const select = style([field, { minWidth: 92 }]);
export const formulaInput = style([field, { flex: 1, minWidth: 220 }]);
export const compactInput = style([field, { width: 76 }]);
export const compactRangeInput = style([field, { width: 104 }]);
export const pdfSearchInput = style([field, { width: 160 }]);

export const underlineIcon = style({
  fontSize: 12,
  lineHeight: '12px',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
});

export const colorInput = style({
  width: '100%',
  height: 30,
  padding: 2,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 4,
  background: cssVarV2('layer/background/primary'),
  cursor: 'pointer',
  selectors: {
    '&:disabled': { cursor: 'not-allowed', opacity: 0.55 },
    '&:focus-visible': { outline: `2px solid ${cssVarV2('button/primary')}` },
  },
});

export const fileButton = style({
  minHeight: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '4px 10px',
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 4,
  color: cssVarV2('text/primary'),
  background: cssVarV2('layer/background/primary'),
  fontSize: 12,
  cursor: 'pointer',
  selectors: {
    '&:hover': { background: cssVarV2('layer/background/hoverOverlay') },
    '&:focus-within': { outline: `2px solid ${cssVarV2('button/primary')}` },
    '&:has(input:disabled)': {
      cursor: 'not-allowed',
      color: cssVarV2('text/disable'),
    },
  },
});

globalStyle(`${fileButton} input`, {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  opacity: 0,
});

export const statusBar = style({
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '0 10px',
  overflowX: 'auto',
  overflowY: 'hidden',
  borderTop: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  color: cssVarV2('text/tertiary'),
  background: cssVarV2('layer/background/primary'),
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
});

globalStyle(`${statusBar} > span`, { flex: '0 0 auto' });

export const statusError = style({ color: cssVarV2('status/error') });

export const emptyState = style({
  gridRow: '1 / -1',
  minWidth: 0,
  minHeight: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  color: cssVarV2('text/secondary'),
  fontSize: 12,
  textAlign: 'center',
});

export const sheetsBody = style({
  minWidth: 0,
  minHeight: 0,
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr) 34px',
  overflow: 'hidden',
});

export const sheetWorkspace = style({
  minWidth: 0,
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 272px',
  overflow: 'hidden',
  '@media': {
    'screen and (max-width: 900px)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
      gridTemplateRows: 'minmax(260px, 1fr) 220px',
    },
  },
});

export const gridScroller = style({
  minWidth: 0,
  minHeight: 0,
  overflow: 'auto',
  background: cssVarV2('layer/background/primary'),
});

export const sheetGrid = style({
  display: 'grid',
  width: 'max-content',
  minWidth: '100%',
  gridAutoRows: 28,
  color: cssVarV2('text/primary'),
  background: cssVarV2('layer/insideBorder/border'),
  gap: 0.5,
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
});

export const gridHeader = style({
  position: 'sticky',
  zIndex: 3,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 42,
  overflow: 'hidden',
  color: cssVarV2('text/secondary'),
  background: cssVarV2('layer/background/secondary'),
  fontSize: 11,
  fontWeight: 600,
  userSelect: 'none',
});

export const rowHeader = style([
  gridHeader,
  { left: 0, zIndex: 4, justifyContent: 'flex-end', paddingRight: 8 },
]);
export const columnHeader = style([gridHeader, { top: 0 }]);
export const cornerHeader = style([rowHeader, { top: 0, zIndex: 5 }]);

export const sheetCell = style({
  minWidth: 92,
  display: 'flex',
  alignItems: 'center',
  padding: '0 6px',
  overflow: 'hidden',
  border: 0,
  outline: 0,
  color: cssVarV2('text/primary'),
  background: cssVarV2('layer/background/primary'),
  font: 'inherit',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  selectors: {
    '&:hover': { background: cssVarV2('layer/background/hoverOverlay') },
    '&:focus-visible': {
      boxShadow: `inset 0 0 0 2px ${cssVarV2('button/primary')}`,
    },
    '&[data-active="true"]': {
      zIndex: 1,
      boxShadow: `inset 0 0 0 2px ${cssVarV2('button/primary')}`,
    },
  },
});

export const sheetTabs = style({
  minWidth: 0,
  display: 'flex',
  alignItems: 'stretch',
  gap: 1,
  overflowX: 'auto',
  borderTop: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/secondary'),
});

export const sheetInspector = style({
  minWidth: 0,
  minHeight: 0,
  overflowY: 'auto',
  padding: 12,
  borderLeft: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/primary'),
  '@media': {
    'screen and (max-width: 900px)': {
      borderTop: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
      borderLeft: 0,
    },
  },
});

export const inspectorFieldset = style({
  minWidth: 0,
  margin: 0,
  padding: 0,
  border: 0,
});

export const checkRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  color: cssVarV2('text/secondary'),
  fontSize: 12,
});

export const buttonRow = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
  gap: 6,
});

export const iconButtonRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

export const objectRow = style({
  minWidth: 0,
  minHeight: 30,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 8,
  color: cssVarV2('text/secondary'),
  fontSize: 11,
});

globalStyle(`${objectRow} > span`, {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const sheetNameInput = style([
  field,
  { width: 112, flex: '0 0 112px', margin: '2px 3px' },
]);

export const sheetTab = style({
  minWidth: 96,
  maxWidth: 220,
  padding: '0 12px',
  overflow: 'hidden',
  border: 0,
  borderBottom: '2px solid transparent',
  color: cssVarV2('text/secondary'),
  background: 'transparent',
  fontSize: 12,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  selectors: {
    '&:hover': { background: cssVarV2('layer/background/hoverOverlay') },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: -2,
    },
    '&[data-active="true"]': {
      borderBottomColor: cssVarV2('button/primary'),
      color: cssVarV2('text/primary'),
      background: cssVarV2('layer/background/primary'),
      fontWeight: 600,
    },
  },
});

export const presentationEditor = style([
  editor,
  { containerType: 'inline-size', containerName: 'presentation-editor' },
]);

export const slidesBody = style({
  minWidth: 0,
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: '180px minmax(0, 1fr) 260px',
  overflow: 'hidden',
  '@container': {
    'presentation-editor (max-width: 900px)': {
      gridTemplateColumns: '132px minmax(0, 1fr)',
      gridTemplateRows: 'minmax(260px, 1fr) minmax(180px, 36%)',
    },
    'presentation-editor (max-width: 620px)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
      gridTemplateRows: '76px minmax(180px, 1fr) minmax(180px, 40%)',
    },
  },
});

export const slideRail = style({
  minWidth: 0,
  minHeight: 0,
  overflowY: 'auto',
  padding: 12,
  borderRight: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/primary'),
  '@media': { 'screen and (max-width: 620px)': { display: 'none' } },
  '@container': {
    'presentation-editor (max-width: 620px)': {
      display: 'flex',
      overflowX: 'auto',
      overflowY: 'hidden',
      padding: 6,
      borderRight: 0,
      borderBottom: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
    },
  },
});

export const slideThumbButton = style({
  width: '100%',
  display: 'grid',
  gridTemplateColumns: '22px minmax(0, 1fr)',
  alignItems: 'start',
  gap: 6,
  marginBottom: 10,
  padding: 3,
  border: '1px solid transparent',
  borderRadius: 4,
  color: cssVarV2('text/secondary'),
  background: 'transparent',
  fontSize: 11,
  textAlign: 'right',
  '@container': {
    'presentation-editor (max-width: 620px)': {
      flex: '0 0 120px',
      marginBottom: 0,
    },
  },
  selectors: {
    '&:hover': { background: cssVarV2('layer/background/hoverOverlay') },
    '&:focus-visible': { outline: `2px solid ${cssVarV2('button/primary')}` },
    '&[data-active="true"]': { borderColor: cssVarV2('button/primary') },
  },
});

export const thumbnail = style({
  position: 'relative',
  containerType: 'inline-size',
  width: '100%',
  overflow: 'hidden',
  aspectRatio: '16 / 9',
  background: '#ffffff',
  boxShadow: '0 1px 4px rgba(20, 24, 31, 0.18)',
  color: '#1f2329',
});

export const slideStageScroller = style({
  minWidth: 0,
  minHeight: 0,
  display: 'grid',
  placeItems: 'center',
  overflow: 'auto',
  padding: 24,
  background: cssVarV2('layer/background/secondary'),
});

export const slideStage = style({
  position: 'relative',
  containerType: 'inline-size',
  width: 'min(100%, 960px)',
  overflow: 'hidden',
  background: '#ffffff',
  color: '#1f2329',
  boxShadow:
    '0 3px 12px rgba(20, 24, 31, 0.16), 0 16px 36px rgba(20, 24, 31, 0.09)',
});

export const slideShape = style({
  position: 'absolute',
  minWidth: 2,
  minHeight: 2,
  overflow: 'hidden',
  border: '1px solid transparent',
  color: '#1f2329',
  background: 'transparent',
  fontFamily: 'Aptos, Calibri, Arial, sans-serif',
  textAlign: 'left',
  whiteSpace: 'pre-wrap',
  selectors: {
    '&[data-selected="true"]': {
      borderColor: '#2f6feb',
      boxShadow: '0 0 0 1px #ffffff',
    },
    '&[data-type="picture"]': { background: '#e8ebef', color: '#59636e' },
  },
});

globalStyle(`${slideShape} img`, {
  width: '100%',
  height: '100%',
  display: 'block',
  objectFit: 'contain',
});

export const shapeInspector = style({
  minWidth: 0,
  minHeight: 0,
  overflowY: 'auto',
  padding: 14,
  borderLeft: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/primary'),
  '@media': {
    'screen and (max-width: 900px)': {
      gridColumn: '1 / -1',
      borderTop: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
      borderLeft: 0,
    },
    'screen and (max-width: 620px)': {
      gridColumn: 'auto',
      padding: 12,
    },
  },
  '@container': {
    'presentation-editor (max-width: 900px)': {
      gridColumn: '1 / -1',
      borderTop: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
      borderLeft: 0,
    },
    'presentation-editor (max-width: 620px)': {
      gridColumn: 'auto',
      padding: 12,
    },
  },
});

export const panelTitle = style({
  marginBottom: 12,
  color: cssVarV2('text/primary'),
  fontSize: 12,
  fontWeight: 600,
});

export const inspectorGroup = style({
  display: 'grid',
  gap: 8,
  marginBottom: 18,
});

export const inspectorGrid = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
});

export const fieldLabel = style({
  display: 'grid',
  gap: 4,
  color: cssVarV2('text/secondary'),
  fontSize: 11,
});

export const textarea = style({
  width: '100%',
  minHeight: 92,
  resize: 'vertical',
  padding: 8,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 4,
  outline: 0,
  color: cssVarV2('text/primary'),
  background: cssVarV2('layer/background/primary'),
  font: '12px/1.45 inherit',
  letterSpacing: 0,
  selectors: {
    '&:focus-visible': {
      borderColor: cssVarV2('button/primary'),
      boxShadow: `0 0 0 1px ${cssVarV2('button/primary')}`,
    },
  },
});

export const pdfBody = style({
  minWidth: 0,
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: '190px minmax(0, 1fr) 280px',
  overflow: 'hidden',
  '@media': {
    'screen and (max-width: 980px)': {
      gridTemplateColumns: '140px minmax(0, 1fr)',
      gridTemplateRows: 'minmax(260px, 1fr) minmax(220px, 40%)',
    },
    'screen and (max-width: 620px)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
      gridTemplateRows: 'minmax(260px, 52%) minmax(240px, 1fr)',
    },
  },
});

export const pdfPageRail = style([slideRail, { padding: 10 }]);

export const pdfPageButton = style({
  width: '100%',
  display: 'grid',
  gridTemplateColumns: '24px minmax(0, 1fr)',
  alignItems: 'start',
  gap: 8,
  marginBottom: 6,
  padding: 6,
  border: '1px solid transparent',
  borderRadius: 4,
  color: cssVarV2('text/secondary'),
  background: 'transparent',
  fontSize: 11,
  textAlign: 'left',
  selectors: {
    '&:hover': { background: cssVarV2('layer/background/hoverOverlay') },
    '&:focus-visible': { outline: `2px solid ${cssVarV2('button/primary')}` },
    '&[data-active="true"]': {
      borderColor: cssVarV2('button/primary'),
      background: cssVarV2('layer/background/hoverOverlay'),
    },
  },
});

export const pdfPageNumber = style({
  paddingTop: 3,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
});

export const pdfThumbnailFrame = style({
  position: 'relative',
  minWidth: 0,
  aspectRatio: '3 / 4',
  overflow: 'hidden',
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: '#ffffff',
});

export const pageMiniature = style({
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  background: '#ffffff',
  color: '#59636e',
  fontSize: 10,
});

export const pdfThumbnailCanvas = style({
  width: '100%',
  height: 'auto',
  maxHeight: '100%',
  display: 'block',
  background: '#ffffff',
});

export const pdfThumbnailStatus = style({
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 4,
  background: 'rgba(255, 255, 255, 0.9)',
  color: '#59636e',
  fontSize: 9,
  lineHeight: '12px',
  textAlign: 'center',
  pointerEvents: 'none',
  selectors: {
    '&[data-error="true"]': { color: '#8f2633' },
  },
});

export const pdfAnnotationBadge = style({
  position: 'absolute',
  top: 4,
  right: 4,
  minWidth: 18,
  height: 18,
  padding: '0 5px',
  borderRadius: 9,
  background: 'rgba(31, 35, 41, 0.84)',
  color: '#ffffff',
  fontSize: 9,
  fontWeight: 600,
  lineHeight: '18px',
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
  pointerEvents: 'none',
});

export const pdfViewer = style({
  minWidth: 0,
  minHeight: 0,
  overflow: 'auto',
  padding: 16,
  background: '#3d4148',
});

export const pdfCanvasHost = style({
  position: 'relative',
  minWidth: '100%',
  minHeight: '100%',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
});

export const pdfCanvas = style({
  flex: '0 0 auto',
  display: 'block',
  background: '#ffffff',
  boxShadow:
    '0 3px 12px rgba(20, 24, 31, 0.24), 0 16px 36px rgba(20, 24, 31, 0.18)',
});

export const pdfCanvasStatus = style({
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  color: '#ffffff',
  fontSize: 12,
  textAlign: 'center',
  pointerEvents: 'none',
});

export const pdfPrintFrame = style({
  position: 'fixed',
  left: -10000,
  top: 0,
  width: 1,
  height: 1,
  border: 0,
  opacity: 0,
  pointerEvents: 'none',
});

export const pdfInspector = style([
  shapeInspector,
  {
    display: 'block',
    '@media': {
      'screen and (max-width: 980px)': {
        gridColumn: '1 / -1',
        borderTop: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
        borderLeft: 0,
      },
      'screen and (max-width: 620px)': { gridColumn: 'auto' },
    },
  },
]);

export const formRow = style({
  display: 'grid',
  gap: 5,
  marginBottom: 10,
});

export const annotationList = style({
  display: 'grid',
  gap: 6,
  marginTop: 8,
});

export const annotationItem = style({
  padding: 7,
  borderRadius: 4,
  background: cssVarV2('layer/background/secondary'),
  color: cssVarV2('text/secondary'),
  fontSize: 11,
  lineHeight: '16px',
  overflowWrap: 'anywhere',
});

export const searchResult = style({
  minWidth: 0,
  display: 'grid',
  gap: 3,
  padding: 7,
  border: 0,
  borderRadius: 4,
  color: cssVarV2('text/secondary'),
  background: cssVarV2('layer/background/secondary'),
  fontSize: 11,
  lineHeight: '16px',
  textAlign: 'left',
  selectors: {
    '&:hover': { background: cssVarV2('layer/background/hoverOverlay') },
    '&:focus-visible': { outline: `2px solid ${cssVarV2('button/primary')}` },
  },
});

globalStyle(`${searchResult} span`, {
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 3,
  overflowWrap: 'anywhere',
});

export const historyPanel = style({
  width: 640,
  maxWidth: 'calc(100vw - 24px)',
  maxHeight: 'min(720px, calc(100vh - 80px))',
  display: 'grid',
  gridTemplateRows: 'auto minmax(180px, 1fr) auto auto',
  overflow: 'hidden',
});

export const historyHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 14px',
  borderBottom: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  fontSize: 13,
  fontWeight: 600,
});

globalStyle(`${historyHeader} > span:last-child`, {
  color: cssVarV2('text/tertiary'),
  fontSize: 11,
  fontWeight: 400,
});

export const historyList = style({
  minHeight: 0,
  overflowY: 'auto',
  padding: 8,
});

export const historyRow = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 4,
});

export const historyItem = style({
  width: '100%',
  display: 'grid',
  gridTemplateColumns: '38px minmax(0, 1fr)',
  gap: 8,
  padding: 8,
  border: 0,
  borderRadius: 4,
  color: cssVarV2('text/primary'),
  background: 'transparent',
  textAlign: 'left',
  selectors: {
    '&:hover': { background: cssVarV2('layer/background/hoverOverlay') },
    '&:focus-visible': { outline: `2px solid ${cssVarV2('button/primary')}` },
    '&[data-active="true"]': {
      background: cssVarV2('layer/background/hoverOverlay'),
    },
  },
});

export const historySequence = style({
  color: cssVarV2('button/primary'),
  fontSize: 12,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
});

export const historyMeta = style({
  display: 'grid',
  gap: 2,
  minWidth: 0,
  color: cssVarV2('text/tertiary'),
  fontSize: 11,
});

globalStyle(`${historyMeta} strong`, {
  overflow: 'hidden',
  color: cssVarV2('text/secondary'),
  fontWeight: 500,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const historyCompareError = style({
  padding: '8px 12px',
  borderTop: `0.5px solid ${cssVarV2('status/error')}`,
  color: cssVarV2('status/error'),
  background: cssVarV2('layer/background/error'),
  fontSize: 12,
});

export const historyCompare = style({
  maxHeight: 300,
  display: 'grid',
  gridTemplateRows: 'auto auto minmax(0, 1fr)',
  gap: 8,
  overflow: 'hidden',
  padding: 12,
  borderTop: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/secondary'),
});

export const historyCompareTitle = style({
  color: cssVarV2('text/primary'),
  fontSize: 12,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
});

export const historyCompareSummary = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  color: cssVarV2('text/secondary'),
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
});

export const historyCompareChanges = style({
  minHeight: 0,
  display: 'grid',
  alignContent: 'start',
  gap: 6,
  overflowY: 'auto',
});

export const historyCompareChange = style({
  display: 'grid',
  gap: 3,
  padding: 8,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 4,
  color: cssVarV2('text/secondary'),
  background: cssVarV2('layer/background/primary'),
  fontSize: 11,
  overflowWrap: 'anywhere',
  selectors: {
    '&[data-change="added"]': { borderColor: '#16803c' },
    '&[data-change="removed"]': { borderColor: '#b42318' },
    '&[data-change="modified"]': { borderColor: '#245bdb' },
  },
});

globalStyle(`${historyCompareChange} strong`, {
  color: cssVarV2('text/primary'),
  fontWeight: 600,
});

globalStyle(`${historyCompareChange} del`, {
  color: '#b42318',
});

globalStyle(`${historyCompareChange} ins`, {
  color: '#16803c',
  textDecoration: 'none',
});

export const historyCompareTruncated = style({
  color: cssVarV2('text/tertiary'),
  fontSize: 11,
});

export const historyCompareEmpty = style({
  color: cssVarV2('text/tertiary'),
  fontSize: 12,
});

export const commentsPanel = style({
  width: 400,
  maxWidth: 'calc(100vw - 24px)',
  maxHeight: 'min(680px, calc(100vh - 80px))',
  display: 'grid',
  gridTemplateRows: 'auto auto auto minmax(0, 1fr)',
  overflow: 'hidden',
  color: cssVarV2('text/primary'),
});

export const collaborators = style({
  minHeight: 42,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '8px 12px',
  borderBottom: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  color: cssVarV2('text/secondary'),
  fontSize: 12,
});

export const collaboratorAvatars = style({
  minWidth: 0,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 4,
  overflowX: 'auto',
});

export const commentComposer = style({
  display: 'grid',
  gap: 8,
  padding: 12,
  borderBottom: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
});

export const commentAnchor = style({
  overflow: 'hidden',
  color: cssVarV2('text/tertiary'),
  fontSize: 11,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const commentError = style({
  padding: '8px 12px',
  borderBottom: `0.5px solid ${cssVarV2('status/error')}`,
  color: cssVarV2('status/error'),
  background: cssVarV2('layer/background/error'),
  fontSize: 12,
});

export const commentList = style({
  minHeight: 0,
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  overflowY: 'auto',
  padding: 10,
});

export const commentEmpty = style({
  minHeight: 120,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  color: cssVarV2('text/tertiary'),
  fontSize: 12,
  textAlign: 'center',
});

export const commentItem = style({
  display: 'grid',
  gap: 8,
  padding: 10,
  border: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 6,
  background: cssVarV2('layer/background/primary'),
  selectors: {
    '&[data-resolved="true"]': {
      opacity: 0.68,
      background: cssVarV2('layer/background/secondary'),
    },
  },
});

export const commentHeader = style({
  minWidth: 0,
  display: 'grid',
  gridTemplateColumns: '24px minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 7,
  fontSize: 11,
});

globalStyle(`${commentHeader} strong`, {
  overflow: 'hidden',
  fontWeight: 600,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

globalStyle(`${commentHeader} time`, {
  color: cssVarV2('text/tertiary'),
  fontVariantNumeric: 'tabular-nums',
});

export const commentText = style({
  color: cssVarV2('text/secondary'),
  fontSize: 12,
  lineHeight: '18px',
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-wrap',
});

export const commentActions = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 3,
});

export const commentReply = style({
  display: 'grid',
  gap: 6,
  marginLeft: 24,
  padding: '8px 0 0 10px',
  borderLeft: `2px solid ${cssVarV2('layer/insideBorder/border')}`,
});

export const replyComposer = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 6,
});
