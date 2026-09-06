import {
  addProperty,
  DatabaseBlockDataSource,
  databaseBlockProperties,
  updateCell,
} from '@blocksuite/affine-block-database';
import {
  type DatabaseBlockModel,
  DatabaseBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@blocksuite/affine-model';
import { ViewManagerBase } from '@blocksuite/data-view';
import { Text } from '@blocksuite/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@blocksuite/store/test';
import { describe, expect, test } from 'vitest';

function fixture(values: string[]) {
  const workspace = new TestWorkspace({
    id: 'conversion',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.meta.initialize();
  const doc = workspace.createDoc('doc');
  doc.load();
  const store = doc.getStore({
    extensions: [
      RootBlockSchemaExtension,
      NoteBlockSchemaExtension,
      ParagraphBlockSchemaExtension,
      DatabaseBlockSchemaExtension,
    ],
  });
  const root = store.addBlock('affine:page', {});
  const note = store.addBlock('affine:note', {}, root);
  const id = store.addBlock('affine:database', { columns: [] }, note);
  const model = store.getModelById(id) as DatabaseBlockModel;
  const property = addProperty(
    model,
    'end',
    databaseBlockProperties.richTextColumnConfig.create('金额')
  );
  const rows = values.map(value => {
    const row = store.addBlock('affine:paragraph', {}, id);
    updateCell(model, row, {
      columnId: property,
      value: new Text(value).yText,
    });
    return row;
  });
  const source = new DatabaseBlockDataSource(model);
  store.captureSync();
  return { store, model, source, property, rows };
}

describe('database conversion integrity', () => {
  test('does not erase nonempty text that produces an empty option list', () => {
    const { source, property, rows } = fixture([', ,']);
    source.propertyTypeSet(property, 'multi-select');
    expect(source.propertyTypeGet(property)).toBe('rich-text');
    expect(source.cellValueGet(rows[0]!, property)?.toString()).toBe(', ,');
  });
  test('rejects an entire conversion when a number has trailing text', () => {
    const { source, property, rows } = fixture(['12.5', '42元']);
    expect(source.propertyTypeConversionPreview(property, 'number')).toEqual({
      total: 2,
      incompatible: 1,
      supported: true,
    });
    source.propertyTypeSet(property, 'number');
    expect(source.propertyTypeGet(property)).toBe('rich-text');
    expect(
      rows.map(row => source.cellValueGet(row, property)?.toString())
    ).toEqual(['12.5', '42元']);
  });

  test('converts all cells and restores type and values in one undo', () => {
    const { store, source, property, rows } = fixture(['12.5', '-42']);
    source.propertyTypeSet(property, 'number');
    expect(rows.map(row => source.cellValueGet(row, property))).toEqual([
      12.5, -42,
    ]);
    store.undo();
    expect(source.propertyTypeGet(property)).toBe('rich-text');
    expect(
      rows.map(row => source.cellValueGet(row, property)?.toString())
    ).toEqual(['12.5', '-42']);
    store.redo();
    expect(source.propertyTypeGet(property)).toBe('number');
  });

  test('preserves commas when converting text to a single option', () => {
    const { source, property, rows } = fixture(['上海,研发']);
    source.propertyTypeSet(property, 'select');
    const options = source.propertyDataGet(property).options as {
      id: string;
      value: string;
    }[];
    expect(options[0]?.value).toBe('上海,研发');
    expect(source.cellValueGet(rows[0]!, property)).toBe(options[0]?.id);
  });

  test('rejects clipped progress and unknown fields', () => {
    const { source, property } = fixture(['101']);
    expect(
      source.propertyTypeConversionPreview(property, 'progress').incompatible
    ).toBe(1);
    source.propertyTypeSet(property, 'progress');
    expect(source.propertyTypeGet(property)).toBe('rich-text');
    expect(
      source.propertyTypeConversionPreview('missing', 'number').supported
    ).toBe(false);
  });

  test('rechecks readonly at mutation time', () => {
    const { store, source, property } = fixture(['12']);
    expect(
      source.propertyTypeConversionPreview(property, 'number').supported
    ).toBe(true);
    store.readonly = true;
    source.propertyTypeSet(property, 'number');
    expect(source.propertyTypeGet(property)).toBe('rich-text');
  });

  test('preserves table configuration across a kanban round trip', () => {
    const { source, store } = fixture(['12']);
    const manager = new ViewManagerBase(source);
    const id = manager.viewAdd('table');
    source.viewDataUpdate(id, () => ({
      columns: [{ id: 'custom', width: 237, hide: true }],
      sort: { sortBy: [], manuallySort: ['row-b', 'row-a'] },
    }));
    const before = JSON.parse(JSON.stringify(source.viewDataGet(id)));
    manager.viewChangeType(id, 'kanban');
    expect(source.viewDataGet(id)?.sort).toEqual(before.sort);
    store.undo();
    expect(source.viewDataGet(id)?.mode).toBe('table');
    expect(source.viewDataGet(id)?.columns).toEqual(before.columns);
    store.redo();
    manager.viewChangeType(id, 'table');
    expect(source.viewDataGet(id)?.columns).toEqual(before.columns);
    expect(source.viewDataGet(id)?.sort).toEqual(before.sort);
    const reloaded = new ViewManagerBase(source);
    reloaded.viewChangeType(id, 'kanban');
    reloaded.viewChangeType(id, 'table');
    expect(source.viewDataGet(id)?.columns).toEqual(before.columns);
  });
});
