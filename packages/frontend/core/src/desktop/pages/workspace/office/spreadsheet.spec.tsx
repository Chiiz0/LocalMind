/**
 * @vitest-environment happy-dom
 */
import { getOrCreateI18n } from '@affine/i18n';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import type { XlsxSemanticState } from '../../../../modules/office';
import type { OfficeEditorDraft } from './edit-draft';
import { SpreadsheetEditor } from './spreadsheet';

vi.mock('@affine/component', () => ({
  Button: ({
    children,
    loading: _loading,
    variant: _variant,
    ...props
  }: PropsWithChildren<
    ButtonHTMLAttributes<HTMLButtonElement> & {
      loading?: boolean;
      variant?: string;
    }
  >) => <button {...props}>{children}</button>,
  IconButton: ({
    children,
    size: _size,
    tooltip: _tooltip,
    ...props
  }: PropsWithChildren<
    ButtonHTMLAttributes<HTMLButtonElement> & {
      size?: string;
      tooltip?: string;
    }
  >) => <button {...props}>{children}</button>,
}));

vi.mock('@blocksuite/icons/rc', () => ({
  ArrowDownSmallIcon: () => null,
  ArrowUpSmallIcon: () => null,
  BoldIcon: () => null,
  ChartPanelIcon: () => null,
  DeleteIcon: () => null,
  FilterIcon: () => null,
  InsertAboveIcon: () => null,
  InsertBelowIcon: () => null,
  InsertLeftIcon: () => null,
  InsertRightIcon: () => null,
  ItalicIcon: () => null,
  PlusIcon: () => null,
  TableIcon: () => null,
}));

const state = {
  schemaVersion: 'localmind-office-xlsx-state/v1',
  modelVersion: 'localmind-office-xlsx-model/v1',
  workbookPart: 'xl/workbook.xml',
  activeSheetIndex: 0,
  sheets: [
    {
      id: 'sheet-1',
      name: 'Budget',
      relationshipId: 'rId1',
      part: 'xl/worksheets/sheet1.xml',
      cells: [
        {
          address: 'D2',
          row: 2,
          column: 4,
          type: 'number',
          value: 10,
          styleIndex: 1,
        },
      ],
      rows: [],
      columns: [],
      mergedCells: [],
      dataValidations: [],
      tables: [],
      charts: [],
    },
  ],
  definedNames: [],
  styles: {
    fonts: [
      { name: 'Aptos', sizePt: 11 },
      {
        name: 'Inter',
        sizePt: 18,
        bold: true,
        italic: true,
        underline: 'single',
        color: '#0057B8',
      },
    ],
    fills: [
      { pattern: 'none' },
      { pattern: 'solid', foregroundColor: '#FFEEAA' },
    ],
    cells: [
      { index: 0, fontId: 0, fillId: 0 },
      {
        index: 1,
        fontId: 1,
        fillId: 1,
        horizontalAlignment: 'right',
        wrapText: true,
      },
    ],
  },
  package: { parts: [], opaqueParts: [], externalRelationships: [] },
  compatibility: { unsupportedFormulaFunctions: [], calculationErrors: 0 },
  stats: {
    sheets: 1,
    cells: 1,
    formulas: 0,
    calculatedFormulas: 0,
    styles: 2,
    tables: 0,
    charts: 0,
    validations: 0,
    packageParts: 0,
    opaqueParts: 0,
  },
} as XlsxSemanticState;

describe('SpreadsheetEditor', () => {
  test('Project cell drafts can be discarded without a write', async () => {
    const guards = new Set<OfficeEditorDraft>();
    const gql = vi.fn();
    const confirm = vi.fn(async () => false);
    render(
      <SpreadsheetEditor
        state={state}
        revision={{ id: 'revision-1', sequence: 1 } as never}
        artifactId="artifact-1"
        owner={{ kind: 'project', projectId: 'project-1' }}
        graphql={{ gql } as never}
        readOnly={false}
        onRevision={vi.fn()}
        onCommentAnchorChange={vi.fn()}
        onAiSelectionChange={vi.fn()}
        beforeSelectionChange={confirm}
        registerDraft={guard => {
          guards.add(guard);
          return () => {
            guards.delete(guard);
          };
        }}
      />
    );
    const formula = screen.getByLabelText<HTMLInputElement>(
      'Cell value or formula'
    );
    fireEvent.change(formula, { target: { value: '=SUM(A2:A4)' } });
    const guard = [...guards][0];
    expect(guard.hasUnsavedChanges).toBe(true);
    fireEvent.click(screen.getByRole('gridcell', { name: /^B1:/ }));
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
    expect(formula.value).toBe('=SUM(A2:A4)');
    expect(
      screen.getByLabelText<HTMLInputElement>('Active cell address').value
    ).toBe('A1');
    await act(() => guard.discard());
    expect(guard.hasUnsavedChanges).toBe(false);
    expect(formula.value).toBe('');
    expect(gql).not.toHaveBeenCalled();
  });
  afterEach(cleanup);

  test('loads the selected cell format into the editing controls', async () => {
    render(
      <SpreadsheetEditor
        state={state}
        revision={{ id: 'revision-1', sequence: 1 } as never}
        artifactId="artifact-1"
        owner={{ kind: 'workspace', workspaceId: 'workspace-1' }}
        graphql={{} as never}
        readOnly={false}
        onRevision={vi.fn()}
        onCommentAnchorChange={vi.fn()}
        onAiSelectionChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('gridcell', { name: 'D2: 10' }));

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('Font').value).toBe(
        'Inter'
      );
    });
    expect(screen.getByLabelText<HTMLInputElement>('Size').value).toBe('18');
    expect(screen.getByLabelText<HTMLInputElement>('Text').value).toBe(
      '#0057b8'
    );
    expect(screen.getByLabelText<HTMLInputElement>('Fill').value).toBe(
      '#ffeeaa'
    );
    expect(
      screen.getByLabelText<HTMLSelectElement>('Horizontal alignment').value
    ).toBe('right');
    expect(screen.getByLabelText<HTMLInputElement>('Wrap text').checked).toBe(
      true
    );
    expect(screen.getByRole('button', { name: 'Bold' }).dataset.active).toBe(
      'true'
    );
    expect(screen.getByRole('button', { name: 'Italic' }).dataset.active).toBe(
      'true'
    );
    expect(
      screen.getByRole('button', { name: 'Underline' }).dataset.active
    ).toBe('true');
  });

  test('switching to Chinese keeps the draft and double-click focuses the formula input', async () => {
    const i18n = getOrCreateI18n();
    render(
      <SpreadsheetEditor
        state={state}
        revision={{ id: 'revision-1', sequence: 1 } as never}
        artifactId="artifact-1"
        owner={{ kind: 'project', projectId: 'project-1' }}
        graphql={{} as never}
        readOnly={false}
        onRevision={vi.fn()}
        onCommentAnchorChange={vi.fn()}
        onAiSelectionChange={vi.fn()}
      />
    );
    const formula = screen.getByLabelText<HTMLInputElement>(
      'Cell value or formula'
    );
    fireEvent.change(formula, { target: { value: '=SUM(A2:A4)' } });
    try {
      await act(() => i18n.changeLanguage('zh-Hans'));
      expect(screen.getByLabelText('单元格值或公式')).toBe(formula);
      expect(formula.value).toBe('=SUM(A2:A4)');
      fireEvent.doubleClick(screen.getByRole('gridcell', { name: /^A1:/ }));
      await waitFor(() => expect(document.activeElement).toBe(formula));
      expect(screen.getByRole('button', { name: '保存单元格' })).toBeDefined();
    } finally {
      await act(() => i18n.changeLanguage('en'));
    }
  });
});

beforeAll(async () => {
  await getOrCreateI18n().changeLanguage('en');
});
