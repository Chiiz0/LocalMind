import { Button, IconButton } from '@affine/component';
import {
  ArrowDownSmallIcon,
  ArrowUpSmallIcon,
  BoldIcon,
  ChartPanelIcon,
  DeleteIcon,
  FilterIcon,
  InsertAboveIcon,
  InsertBelowIcon,
  InsertLeftIcon,
  InsertRightIcon,
  ItalicIcon,
  PlusIcon,
  TableIcon,
} from '@blocksuite/icons/rc';
import { columnIndexToName, parseCellAddress } from '@localmind/office/xlsx';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  OfficeCommand,
  OfficeWorkbookSetCellCommand,
  XlsxCell,
  XlsxSemanticState,
} from '../../../../modules/office';
import {
  executeAndReloadOfficeCommand,
  type NativeOfficeEditorProps,
  officeErrorMessage,
} from './shared';
import * as styles from './surface.css';

function cellDisplay(cell: XlsxCell | undefined) {
  if (!cell) return '';
  const value = cell.formula ? cell.calculatedValue : cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}

function cellInput(cell: XlsxCell | undefined) {
  if (!cell) return '';
  if (cell.formula) return `=${cell.formula}`;
  if (cell.value === null || cell.value === undefined) return '';
  return String(cell.value);
}

function parseCellInput(value: string) {
  if (!value) return { type: 'blank' as const };
  if (value.startsWith('=')) {
    return { type: 'formula' as const, formula: value.slice(1) };
  }
  if (/^(true|false)$/i.test(value)) {
    return { type: 'boolean' as const, value: value.toLowerCase() === 'true' };
  }
  const number = Number(value);
  if (value.trim() && Number.isFinite(number)) {
    return { type: 'number' as const, value: number };
  }
  return { type: 'string' as const, value };
}

function sheetFormulaRange(sheetName: string, range: string) {
  if (range.includes('!')) return range;
  const escaped = sheetName.replaceAll("'", "''");
  return `'${escaped}'!${range}`;
}

function tryParseCellAddress(input: string) {
  try {
    return parseCellAddress(input);
  } catch {
    return undefined;
  }
}

function cellStyle(state: XlsxSemanticState, cell: XlsxCell | undefined) {
  if (cell?.styleIndex === undefined) return undefined;
  const style = state.styles.cells[cell.styleIndex];
  const font =
    style?.fontId === undefined ? undefined : state.styles.fonts[style.fontId];
  const fill =
    style?.fillId === undefined ? undefined : state.styles.fills[style.fillId];
  return {
    color: font?.color,
    fontFamily: font?.name,
    fontSize: font?.sizePt ? `${font.sizePt}pt` : undefined,
    fontWeight: font?.bold ? 700 : undefined,
    fontStyle: font?.italic ? 'italic' : undefined,
    textDecoration: font?.underline ? 'underline' : undefined,
    background: fill?.foregroundColor,
    justifyContent:
      style?.horizontalAlignment === 'center'
        ? 'center'
        : style?.horizontalAlignment === 'right'
          ? 'flex-end'
          : undefined,
  } as const;
}

export function cellFormatDraft(
  state: XlsxSemanticState,
  cell: XlsxCell | undefined
) {
  const style =
    cell?.styleIndex === undefined
      ? undefined
      : state.styles.cells[cell.styleIndex];
  const font =
    style?.fontId === undefined ? undefined : state.styles.fonts[style.fontId];
  const fill =
    style?.fillId === undefined ? undefined : state.styles.fills[style.fillId];
  const horizontalAlignment = style?.horizontalAlignment;
  const alignment: 'left' | 'center' | 'right' =
    horizontalAlignment === 'center' || horizontalAlignment === 'right'
      ? horizontalAlignment
      : 'left';

  return {
    fontFamily: font?.name ?? 'Aptos',
    fontSize: font?.sizePt ?? 11,
    bold: font?.bold ?? false,
    italic: font?.italic ?? false,
    underline: Boolean(font?.underline),
    textColor: font?.color ?? '#1F2329',
    fillColor: fill?.foregroundColor ?? '#FFFFFF',
    alignment,
    wrapText: style?.wrapText ?? false,
  };
}

export function SpreadsheetEditor({
  state,
  revision,
  artifactId,
  owner,
  graphql,
  readOnly,
  onRevision,
  onCommentAnchorChange,
  onAiSelectionChange,
}: NativeOfficeEditorProps<XlsxSemanticState>) {
  const [activeSheetId, setActiveSheetId] = useState(
    state.sheets[state.activeSheetIndex]?.id ?? state.sheets[0]?.id ?? ''
  );
  const [activeAddress, setActiveAddress] = useState('A1');
  const [draft, setDraft] = useState('');
  const [range, setRange] = useState('A1:A1');
  const [fontFamily, setFontFamily] = useState('Aptos');
  const [fontSize, setFontSize] = useState(11);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [textColor, setTextColor] = useState('#1F2329');
  const [fillColor, setFillColor] = useState('#FFFFFF');
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>(
    'left'
  );
  const [wrapText, setWrapText] = useState(false);
  const [rowHeight, setRowHeight] = useState(22);
  const [columnWidth, setColumnWidth] = useState(12);
  const [dimensionCount, setDimensionCount] = useState(1);
  const [filterValues, setFilterValues] = useState('');
  const [validationValues, setValidationValues] = useState('');
  const [tableName, setTableName] = useState('LocalMindTable');
  const [chartType, setChartType] = useState<'column' | 'bar' | 'line' | 'pie'>(
    'column'
  );
  const [categoryRange, setCategoryRange] = useState('A2:A10');
  const [valueRange, setValueRange] = useState('B2:B10');
  const [newSheetName, setNewSheetName] = useState('Sheet');
  const [sheetName, setSheetName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Ready');
  const sheet =
    state.sheets.find(candidate => candidate.id === activeSheetId) ??
    state.sheets[0];
  const cells = useMemo(
    () => new Map(sheet?.cells.map(cell => [cell.address, cell]) ?? []),
    [sheet]
  );
  const parsedActiveAddress = useMemo(
    () => tryParseCellAddress(activeAddress),
    [activeAddress]
  );
  const activeCell = parsedActiveAddress
    ? cells.get(parsedActiveAddress.address)
    : undefined;

  useEffect(() => {
    setDraft(cellInput(activeCell));
    if (parsedActiveAddress) {
      setRange(`${parsedActiveAddress.address}:${parsedActiveAddress.address}`);
    }
  }, [activeCell, parsedActiveAddress]);

  useEffect(() => {
    const format = cellFormatDraft(state, activeCell);
    setFontFamily(format.fontFamily);
    setFontSize(format.fontSize);
    setBold(format.bold);
    setItalic(format.italic);
    setUnderline(format.underline);
    setTextColor(format.textColor);
    setFillColor(format.fillColor);
    setAlignment(format.alignment);
    setWrapText(format.wrapText);
  }, [activeCell, state]);

  useEffect(() => {
    setSheetName(sheet?.name ?? '');
  }, [sheet?.name]);

  useEffect(() => {
    if (!sheet) {
      onCommentAnchorChange(null);
      onAiSelectionChange(null);
      return;
    }
    onCommentAnchorChange(
      parsedActiveAddress
        ? {
            kind: 'workbook',
            revisionId: revision.id,
            sheetId: sheet.id,
            address: parsedActiveAddress.address,
          }
        : null
    );
    if (!parsedActiveAddress) {
      onAiSelectionChange({
        kind: 'workbook',
        target: { type: 'sheet', sheetId: sheet.id },
      });
      return;
    }
    const normalizedRange = range.trim().toUpperCase();
    const singleCellRange = `${parsedActiveAddress.address}:${parsedActiveAddress.address}`;
    onAiSelectionChange({
      kind: 'workbook',
      target:
        normalizedRange !== singleCellRange &&
        /^\$?[A-Z]{1,3}\$?[1-9][0-9]{0,6}:\$?[A-Z]{1,3}\$?[1-9][0-9]{0,6}$/.test(
          normalizedRange
        )
          ? { type: 'cell_range', sheetId: sheet.id, range: normalizedRange }
          : {
              type: 'cell',
              sheetId: sheet.id,
              address: parsedActiveAddress.address,
            },
    });
  }, [
    onAiSelectionChange,
    onCommentAnchorChange,
    parsedActiveAddress,
    range,
    revision.id,
    sheet,
  ]);

  useEffect(() => {
    if (sheet && sheet.id !== activeSheetId) setActiveSheetId(sheet.id);
  }, [activeSheetId, sheet]);

  const bounds = useMemo(() => {
    let maxRow = 0;
    let maxColumn = 0;
    for (const cell of sheet?.cells ?? []) {
      const address = parseCellAddress(cell.address);
      maxRow = Math.max(maxRow, address.row);
      maxColumn = Math.max(maxColumn, address.column);
    }
    return {
      rows: Math.min(Math.max(maxRow + 12, 32), 200),
      columns: Math.min(Math.max(maxColumn + 4, 12), 52),
    };
  }, [sheet]);

  const commandBase = useCallback(() => {
    const id = nanoid();
    return {
      version: 'localmind-office-command/v1' as const,
      commandId: id,
      idempotencyKey: `office-user:${id}`,
      artifactId,
      expectedRevisionId: revision.id,
      source: 'user' as const,
    };
  }, [artifactId, revision.id]);

  const runCommand = useCallback(
    async (command: OfficeCommand, message: string) => {
      if (readOnly || saving) return;
      setSaving(true);
      setError(null);
      setStatus(`Previewing ${message}`);
      try {
        const result = await executeAndReloadOfficeCommand<XlsxSemanticState>({
          graphql,
          owner,
          kind: 'workbook',
          command,
        });
        onRevision(result.revision, result.state);
        setStatus(`${message} saved in revision ${result.revision.sequence}`);
      } catch (err) {
        setError(officeErrorMessage(err));
        setStatus('Save failed');
      } finally {
        setSaving(false);
      }
    },
    [graphql, onRevision, owner, readOnly, saving]
  );

  const save = useCallback(async () => {
    if (!sheet || readOnly || saving) return;
    if (!parsedActiveAddress) {
      setError('Enter a valid cell address, for example A1.');
      setStatus('Invalid cell address');
      return;
    }
    const command = {
      ...commandBase(),
      operation: 'office.workbook.cell.set',
      target: {
        type: 'cell',
        sheetId: sheet.id,
        address: parsedActiveAddress.address,
      },
      input: parseCellInput(draft),
      styleIndex: activeCell?.styleIndex,
    } satisfies OfficeWorkbookSetCellCommand;
    await runCommand(command, parsedActiveAddress.address);
  }, [
    activeCell?.styleIndex,
    commandBase,
    draft,
    parsedActiveAddress,
    readOnly,
    runCommand,
    saving,
    sheet,
  ]);

  const applyFormat = useCallback(async () => {
    if (!sheet) return;
    await runCommand(
      {
        ...commandBase(),
        operation: 'office.workbook.range.format',
        target: { type: 'cell_range', sheetId: sheet.id, range },
        format: {
          fontFamily,
          fontSizePt: fontSize,
          bold,
          italic,
          underline,
          textColor,
          fillColor,
          horizontalAlignment: alignment,
          wrapText,
        },
      },
      'Range formatting'
    );
  }, [
    alignment,
    bold,
    commandBase,
    fillColor,
    fontFamily,
    fontSize,
    italic,
    range,
    runCommand,
    sheet,
    textColor,
    underline,
    wrapText,
  ]);

  const changeDimension = useCallback(
    async (axis: 'row' | 'column', action: 'insert' | 'delete') => {
      if (!sheet) return;
      if (!parsedActiveAddress) {
        setError('Enter a valid cell address before changing rows or columns.');
        setStatus('Invalid cell address');
        return;
      }
      await runCommand(
        {
          ...commandBase(),
          operation: 'office.workbook.dimension.change',
          sheetId: sheet.id,
          axis,
          action,
          index:
            axis === 'row'
              ? parsedActiveAddress.row
              : parsedActiveAddress.column,
          count: dimensionCount,
        },
        `${action === 'insert' ? 'Insert' : 'Delete'} ${axis}`
      );
    },
    [commandBase, dimensionCount, parsedActiveAddress, runCommand, sheet]
  );

  const moveSheet = useCallback(
    async (direction: -1 | 1) => {
      if (!sheet) return;
      const order = state.sheets.map(candidate => candidate.id);
      const index = order.indexOf(sheet.id);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= order.length) return;
      [order[index], order[target]] = [order[target], order[index]];
      await runCommand(
        {
          ...commandBase(),
          operation: 'office.workbook.sheets.reorder',
          sheetIds: order,
        },
        'Worksheet order'
      );
    },
    [commandBase, runCommand, sheet, state.sheets]
  );

  if (!sheet) {
    return (
      <div className={styles.editor}>
        <div className={styles.emptyState} role="status">
          This workbook has no worksheets.
        </div>
      </div>
    );
  }

  const gridTemplateColumns = `42px repeat(${bounds.columns}, minmax(92px, 1fr))`;
  return (
    <div className={styles.editor}>
      <div
        className={styles.toolbar}
        role="toolbar"
        aria-label="Spreadsheet editing"
      >
        <input
          className={styles.compactInput}
          value={activeAddress}
          aria-label="Active cell address"
          onChange={event => setActiveAddress(event.target.value.toUpperCase())}
          onBlur={() => {
            if (parsedActiveAddress) {
              setActiveAddress(parsedActiveAddress.address);
            } else {
              setActiveAddress('A1');
              setError('Cell address was reset to A1.');
              setStatus('Invalid cell address');
            }
          }}
        />
        <input
          className={styles.formulaInput}
          value={draft}
          disabled={readOnly || saving}
          aria-label="Cell value or formula"
          placeholder="Enter a value or start a formula with ="
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') save().catch(console.error);
          }}
        />
        <Button
          variant="primary"
          disabled={readOnly}
          loading={saving}
          onClick={() => {
            save().catch(console.error);
          }}
        >
          Save cell
        </Button>
        <input
          className={styles.compactRangeInput}
          value={range}
          aria-label="Selected cell range"
          onChange={event => setRange(event.target.value.toUpperCase())}
        />
        <IconButton
          size="24"
          tooltip="Bold"
          aria-label="Bold"
          data-active={bold}
          disabled={readOnly || saving}
          onClick={() => setBold(value => !value)}
        >
          <BoldIcon />
        </IconButton>
        <IconButton
          size="24"
          tooltip="Italic"
          aria-label="Italic"
          data-active={italic}
          disabled={readOnly || saving}
          onClick={() => setItalic(value => !value)}
        >
          <ItalicIcon />
        </IconButton>
        <IconButton
          size="24"
          tooltip="Underline"
          aria-label="Underline"
          data-active={underline}
          disabled={readOnly || saving}
          onClick={() => setUnderline(value => !value)}
        >
          <span className={styles.underlineIcon}>U</span>
        </IconButton>
        <Button
          disabled={readOnly}
          loading={saving}
          onClick={() => void applyFormat()}
        >
          Apply format
        </Button>
      </div>
      <div className={styles.sheetsBody}>
        <div className={styles.sheetWorkspace}>
          <div
            className={styles.gridScroller}
            role="region"
            aria-label={`${sheet.name} worksheet`}
          >
            <div
              className={styles.sheetGrid}
              role="grid"
              aria-rowcount={bounds.rows}
              aria-colcount={bounds.columns}
              style={{ gridTemplateColumns }}
            >
              <div className={styles.cornerHeader} />
              {Array.from({ length: bounds.columns }, (_, index) => (
                <div
                  className={styles.columnHeader}
                  key={`column:${index + 1}`}
                >
                  {columnIndexToName(index + 1)}
                </div>
              ))}
              {Array.from({ length: bounds.rows }, (_, rowIndex) => {
                const row = rowIndex + 1;
                return [
                  <div className={styles.rowHeader} key={`row:${row}`}>
                    {row}
                  </div>,
                  ...Array.from(
                    { length: bounds.columns },
                    (_, columnIndex) => {
                      const address = `${columnIndexToName(columnIndex + 1)}${row}`;
                      const cell = cells.get(address);
                      return (
                        <button
                          type="button"
                          role="gridcell"
                          aria-selected={address === activeAddress}
                          aria-label={`${address}: ${cellDisplay(cell) || 'blank'}`}
                          className={styles.sheetCell}
                          data-active={address === activeAddress}
                          key={address}
                          style={cellStyle(state, cell)}
                          onClick={() => setActiveAddress(address)}
                          onDoubleClick={() => {
                            setActiveAddress(address);
                            document
                              .querySelector<HTMLInputElement>(
                                `[aria-label="Cell value or formula"]`
                              )
                              ?.focus();
                          }}
                        >
                          {cellDisplay(cell)}
                        </button>
                      );
                    }
                  ),
                ];
              })}
            </div>
          </div>
          <aside className={styles.sheetInspector} aria-label="Sheet tools">
            <fieldset
              className={styles.inspectorFieldset}
              disabled={readOnly || saving}
            >
              <div className={styles.panelTitle}>Range format</div>
              <div className={styles.inspectorGroup}>
                <div className={styles.inspectorGrid}>
                  <label className={styles.fieldLabel}>
                    Font
                    <input
                      className={styles.field}
                      value={fontFamily}
                      maxLength={256}
                      onChange={event => setFontFamily(event.target.value)}
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    Size
                    <input
                      className={styles.field}
                      type="number"
                      min={1}
                      max={400}
                      value={fontSize}
                      onChange={event =>
                        setFontSize(Number(event.target.value))
                      }
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    Text
                    <input
                      className={styles.colorInput}
                      type="color"
                      value={textColor}
                      onChange={event => setTextColor(event.target.value)}
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    Fill
                    <input
                      className={styles.colorInput}
                      type="color"
                      value={fillColor}
                      onChange={event => setFillColor(event.target.value)}
                    />
                  </label>
                </div>
                <select
                  className={styles.select}
                  value={alignment}
                  aria-label="Horizontal alignment"
                  onChange={event =>
                    setAlignment(event.target.value as typeof alignment)
                  }
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={wrapText}
                    onChange={event => setWrapText(event.target.checked)}
                  />
                  Wrap text
                </label>
                <div className={styles.buttonRow}>
                  <Button
                    disabled={readOnly}
                    loading={saving}
                    onClick={() =>
                      void runCommand(
                        {
                          ...commandBase(),
                          operation: 'office.workbook.cells.merge.set',
                          target: {
                            type: 'cell_range',
                            sheetId: sheet.id,
                            range,
                          },
                          merged: true,
                        },
                        'Merge cells'
                      )
                    }
                  >
                    Merge
                  </Button>
                  <Button
                    disabled={readOnly}
                    loading={saving}
                    onClick={() =>
                      void runCommand(
                        {
                          ...commandBase(),
                          operation: 'office.workbook.cells.merge.set',
                          target: {
                            type: 'cell_range',
                            sheetId: sheet.id,
                            range,
                          },
                          merged: false,
                        },
                        'Unmerge cells'
                      )
                    }
                  >
                    Unmerge
                  </Button>
                </div>
              </div>

              <div className={styles.panelTitle}>Rows and columns</div>
              <div className={styles.inspectorGroup}>
                <div className={styles.inspectorGrid}>
                  <label className={styles.fieldLabel}>
                    Row height
                    <input
                      className={styles.field}
                      type="number"
                      min={1}
                      max={409}
                      value={rowHeight}
                      onChange={event =>
                        setRowHeight(Number(event.target.value))
                      }
                      onBlur={() => {
                        if (!parsedActiveAddress) return;
                        runCommand(
                          {
                            ...commandBase(),
                            operation: 'office.workbook.row.properties.set',
                            sheetId: sheet.id,
                            row: parsedActiveAddress.row,
                            heightPt: rowHeight,
                          },
                          'Row height'
                        ).catch(console.error);
                      }}
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    Column width
                    <input
                      className={styles.field}
                      type="number"
                      min={1}
                      max={255}
                      value={columnWidth}
                      onChange={event =>
                        setColumnWidth(Number(event.target.value))
                      }
                      onBlur={() => {
                        if (!parsedActiveAddress) return;
                        runCommand(
                          {
                            ...commandBase(),
                            operation: 'office.workbook.column.properties.set',
                            sheetId: sheet.id,
                            startColumn: parsedActiveAddress.column,
                            endColumn: parsedActiveAddress.column,
                            width: columnWidth,
                          },
                          'Column width'
                        ).catch(console.error);
                      }}
                    />
                  </label>
                </div>
                <label className={styles.fieldLabel}>
                  Insert or delete count
                  <input
                    className={styles.field}
                    type="number"
                    min={1}
                    max={10_000}
                    value={dimensionCount}
                    onChange={event =>
                      setDimensionCount(Math.max(1, Number(event.target.value)))
                    }
                  />
                </label>
                <div className={styles.iconButtonRow}>
                  <IconButton
                    size="24"
                    tooltip="Insert rows"
                    aria-label="Insert rows"
                    disabled={readOnly || saving || !parsedActiveAddress}
                    onClick={() => void changeDimension('row', 'insert')}
                  >
                    <InsertAboveIcon />
                  </IconButton>
                  <IconButton
                    size="24"
                    tooltip="Delete rows"
                    aria-label="Delete rows"
                    disabled={readOnly || saving || !parsedActiveAddress}
                    onClick={() => void changeDimension('row', 'delete')}
                  >
                    <InsertBelowIcon />
                  </IconButton>
                  <IconButton
                    size="24"
                    tooltip="Insert columns"
                    aria-label="Insert columns"
                    disabled={readOnly || saving || !parsedActiveAddress}
                    onClick={() => void changeDimension('column', 'insert')}
                  >
                    <InsertLeftIcon />
                  </IconButton>
                  <IconButton
                    size="24"
                    tooltip="Delete columns"
                    aria-label="Delete columns"
                    disabled={readOnly || saving || !parsedActiveAddress}
                    onClick={() => void changeDimension('column', 'delete')}
                  >
                    <InsertRightIcon />
                  </IconButton>
                </div>
              </div>

              <div className={styles.panelTitle}>Data tools</div>
              <div className={styles.inspectorGroup}>
                <input
                  className={styles.field}
                  value={filterValues}
                  aria-label="Filter values"
                  placeholder="Filter values, comma separated"
                  onChange={event => setFilterValues(event.target.value)}
                />
                <div className={styles.buttonRow}>
                  <Button
                    disabled={readOnly || !filterValues.trim()}
                    loading={saving}
                    onClick={() =>
                      void runCommand(
                        {
                          ...commandBase(),
                          operation: 'office.workbook.filter.set',
                          target: {
                            type: 'cell_range',
                            sheetId: sheet.id,
                            range,
                          },
                          criteria: [
                            {
                              columnIndex: 0,
                              values: filterValues
                                .split(',')
                                .map(value => value.trim())
                                .filter(Boolean),
                            },
                          ],
                        },
                        'Filter'
                      )
                    }
                  >
                    <FilterIcon />
                    Apply
                  </Button>
                  <Button
                    disabled={readOnly}
                    loading={saving}
                    onClick={() =>
                      void runCommand(
                        {
                          ...commandBase(),
                          operation: 'office.workbook.filter.set',
                          target: {
                            type: 'cell_range',
                            sheetId: sheet.id,
                            range,
                          },
                          criteria: [],
                        },
                        'Clear filter'
                      )
                    }
                  >
                    Clear
                  </Button>
                </div>
                <input
                  className={styles.field}
                  value={validationValues}
                  aria-label="Validation list values"
                  placeholder="Allowed values, comma separated"
                  onChange={event => setValidationValues(event.target.value)}
                />
                <div className={styles.buttonRow}>
                  <Button
                    disabled={readOnly || !validationValues.trim()}
                    loading={saving}
                    onClick={() =>
                      void runCommand(
                        {
                          ...commandBase(),
                          operation: 'office.workbook.validation.set',
                          target: {
                            type: 'cell_range',
                            sheetId: sheet.id,
                            range,
                          },
                          validation: {
                            type: 'list',
                            formula1: `"${validationValues.replaceAll('"', '""')}"`,
                            allowBlank: true,
                          },
                        },
                        'Data validation'
                      )
                    }
                  >
                    Set validation
                  </Button>
                  <Button
                    disabled={readOnly}
                    loading={saving}
                    onClick={() =>
                      void runCommand(
                        {
                          ...commandBase(),
                          operation: 'office.workbook.validation.set',
                          target: {
                            type: 'cell_range',
                            sheetId: sheet.id,
                            range,
                          },
                          validation: false,
                        },
                        'Clear validation'
                      )
                    }
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className={styles.panelTitle}>Table</div>
              <div className={styles.inspectorGroup}>
                <input
                  className={styles.field}
                  value={tableName}
                  maxLength={255}
                  aria-label="Table name"
                  onChange={event => setTableName(event.target.value)}
                />
                <div className={styles.buttonRow}>
                  <Button
                    disabled={readOnly || !tableName.trim()}
                    loading={saving}
                    onClick={() =>
                      void runCommand(
                        {
                          ...commandBase(),
                          operation: 'office.workbook.table.set',
                          target: {
                            type: 'cell_range',
                            sheetId: sheet.id,
                            range,
                          },
                          table: {
                            name: tableName,
                            styleName: 'TableStyleMedium2',
                          },
                        },
                        'Table'
                      )
                    }
                  >
                    <TableIcon />
                    Create
                  </Button>
                  <Button
                    disabled={readOnly}
                    loading={saving}
                    onClick={() =>
                      void runCommand(
                        {
                          ...commandBase(),
                          operation: 'office.workbook.table.set',
                          target: {
                            type: 'cell_range',
                            sheetId: sheet.id,
                            range,
                          },
                          table: false,
                        },
                        'Remove table'
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>

              <div className={styles.panelTitle}>Chart</div>
              <div className={styles.inspectorGroup}>
                <select
                  className={styles.select}
                  value={chartType}
                  aria-label="Chart type"
                  onChange={event =>
                    setChartType(event.target.value as typeof chartType)
                  }
                >
                  <option value="column">Column</option>
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                  <option value="pie">Pie</option>
                </select>
                <input
                  className={styles.field}
                  value={categoryRange}
                  aria-label="Chart category range"
                  onChange={event => setCategoryRange(event.target.value)}
                />
                <input
                  className={styles.field}
                  value={valueRange}
                  aria-label="Chart value range"
                  onChange={event => setValueRange(event.target.value)}
                />
                <Button
                  disabled={readOnly}
                  loading={saving}
                  onClick={() =>
                    void runCommand(
                      {
                        ...commandBase(),
                        operation: 'office.workbook.chart.add',
                        sheetId: sheet.id,
                        chartType,
                        title: `${sheet.name} chart`,
                        categoryRange: sheetFormulaRange(
                          sheet.name,
                          categoryRange
                        ),
                        series: [
                          {
                            name: 'Series 1',
                            valueRange: sheetFormulaRange(
                              sheet.name,
                              valueRange
                            ),
                          },
                        ],
                        anchor: { fromCell: 'E2', toCell: 'L16' },
                      },
                      'Chart'
                    )
                  }
                >
                  <ChartPanelIcon />
                  Add chart
                </Button>
                {sheet.charts.map(chart => (
                  <div className={styles.objectRow} key={chart.id}>
                    <span>{chart.title || chart.type}</span>
                    <IconButton
                      size="24"
                      tooltip="Delete chart"
                      aria-label={`Delete ${chart.title || chart.type} chart`}
                      disabled={readOnly || saving}
                      onClick={() =>
                        void runCommand(
                          {
                            ...commandBase(),
                            operation: 'office.workbook.chart.delete',
                            sheetId: sheet.id,
                            chartId: chart.id,
                          },
                          'Chart deletion'
                        )
                      }
                    >
                      <DeleteIcon />
                    </IconButton>
                  </div>
                ))}
              </div>
            </fieldset>
          </aside>
        </div>
        <div
          className={styles.sheetTabs}
          role="tablist"
          aria-label="Worksheets"
        >
          {state.sheets.map(candidate => (
            <button
              type="button"
              role="tab"
              aria-selected={candidate.id === sheet.id}
              className={styles.sheetTab}
              data-active={candidate.id === sheet.id}
              key={candidate.id}
              onClick={() => {
                setActiveSheetId(candidate.id);
                setActiveAddress('A1');
              }}
            >
              {candidate.name}
            </button>
          ))}
          <input
            className={styles.sheetNameInput}
            value={sheetName}
            maxLength={31}
            aria-label="Current worksheet name"
            disabled={readOnly || saving}
            onChange={event => setSheetName(event.target.value)}
          />
          <Button
            disabled={readOnly || saving || !sheetName.trim()}
            onClick={() =>
              void runCommand(
                {
                  ...commandBase(),
                  operation: 'office.workbook.sheet.rename',
                  sheetId: sheet.id,
                  name: sheetName,
                },
                'Worksheet rename'
              )
            }
          >
            Rename
          </Button>
          <IconButton
            size="24"
            tooltip="Move worksheet left"
            aria-label="Move worksheet left"
            disabled={
              readOnly ||
              saving ||
              state.sheets.findIndex(item => item.id === sheet.id) === 0
            }
            onClick={() => void moveSheet(-1)}
          >
            <ArrowUpSmallIcon />
          </IconButton>
          <IconButton
            size="24"
            tooltip="Move worksheet right"
            aria-label="Move worksheet right"
            disabled={
              readOnly ||
              saving ||
              state.sheets.findIndex(item => item.id === sheet.id) ===
                state.sheets.length - 1
            }
            onClick={() => void moveSheet(1)}
          >
            <ArrowDownSmallIcon />
          </IconButton>
          <IconButton
            size="24"
            tooltip="Delete worksheet"
            aria-label="Delete worksheet"
            disabled={readOnly || saving || state.sheets.length === 1}
            onClick={() =>
              void runCommand(
                {
                  ...commandBase(),
                  operation: 'office.workbook.sheet.delete',
                  sheetId: sheet.id,
                },
                'Worksheet deletion'
              )
            }
          >
            <DeleteIcon />
          </IconButton>
          <input
            className={styles.sheetNameInput}
            value={newSheetName}
            maxLength={31}
            aria-label="New worksheet name"
            disabled={readOnly || saving}
            onChange={event => setNewSheetName(event.target.value)}
          />
          <IconButton
            size="24"
            tooltip="Add worksheet"
            aria-label="Add worksheet"
            disabled={readOnly || saving || !newSheetName.trim()}
            onClick={() =>
              void runCommand(
                {
                  ...commandBase(),
                  operation: 'office.workbook.sheet.add',
                  name: newSheetName,
                  afterSheetId: sheet.id,
                },
                'Worksheet insertion'
              )
            }
          >
            <PlusIcon />
          </IconButton>
        </div>
      </div>
      <div className={styles.statusBar} role="status" aria-live="polite">
        <span>{sheet.name}</span>
        <span>{state.stats.cells} cells</span>
        <span>{state.stats.formulas} formulas</span>
        <span>{state.stats.tables} tables</span>
        <span>{state.stats.charts} charts</span>
        {readOnly ? <span>Historical revision, read only</span> : null}
        {error ? (
          <span className={styles.statusError}>{error}</span>
        ) : (
          <span>{status}</span>
        )}
      </div>
    </div>
  );
}
