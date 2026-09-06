import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

import { chromium, expect } from '@playwright/test';

const url = process.env.WOLAI_WORKSPACE_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error(
    'Set WOLAI_WORKSPACE_URL to an isolated local browser workspace document.'
  );
const context = await chromium.launchPersistentContext(
  '/tmp/localmind-wolai-browser',
  { channel: 'chrome', headless: true, viewport: { width: 1440, height: 1000 } }
);
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem('global-cache:i18n_lng', JSON.stringify('zh-Hans'));
  localStorage.setItem(
    'global-state:open-link-mode',
    JSON.stringify('open-in-web')
  );
});
try {
  await page.goto(url);
  await page.locator('page-editor').waitFor({ timeout: 60000 });
  await expect(page.getByTestId('local-demo-tips').first()).toBeVisible();
  const fixture = await page.evaluate(() => {
    const current = document.querySelector('page-editor').doc;
    const workspace = current.workspace;
    const Text = current.root.props.title.constructor;
    const id = `wolai-blocks-${Date.now()}`;
    const doc = workspace.createDoc(id);
    doc.load();
    const store = doc.getStore();
    const root = store.addBlock('affine:page', {
      title: new Text('块操作验收'),
    });
    store.addBlock('affine:surface', {}, root);
    const note = store.addBlock('affine:note', {}, root);
    const rows = ['第一项', '第二项', '第三项'].map(text =>
      store.addBlock(
        'affine:list',
        { type: 'bulleted', text: new Text(text) },
        note
      )
    );
    store.addBlock(
      'affine:code',
      {
        text: new Text('const longLine = "' + '中文English'.repeat(120) + '";'),
        language: 'javascript',
      },
      note
    );
    workspace.meta.setDocMeta(id, { title: '块操作验收' });
    store.captureSync();
    window.workbench.closeOthers(window.workbench.activeView$.value);
    window.workbench.openDoc(id);
    return { id, rows, note };
  });
  const second = page
    .locator(
      `affine-list[data-block-id="${fixture.rows[1]}"] [contenteditable=true]`
    )
    .first();
  const parentOfSecond = () =>
    page.evaluate(
      id => document.querySelector('page-editor').doc.getParent(id)?.id,
      fixture.rows[1]
    );
  await second.click({ position: { x: 8, y: 8 } });
  await second.evaluate(el => el.closest('rich-text').inlineEditor.focusEnd());
  await expect
    .poll(() =>
      page.evaluate(() =>
        document
          .querySelector('editor-host')
          .std.selection.value.map(value => value.type)
      )
    )
    .toContain('text');
  await page.keyboard.press('Tab');
  await expect.poll(parentOfSecond).toBe(fixture.rows[0]);
  await page.keyboard.press('Shift+Tab');
  await expect.poll(parentOfSecond).toBe(fixture.note);
  await page.keyboard.press('Meta+z');
  await expect.poll(parentOfSecond).toBe(fixture.rows[0]);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(parentOfSecond).toBe(fixture.note);
  await second.click({ position: { x: 8, y: 8 } });
  await page.keyboard.press('Meta+ArrowLeft');
  await page.keyboard.press('Meta+Shift+ArrowRight');
  const bold = page
    .locator('affine-toolbar-widget editor-toolbar')
    .getByTestId('bold');
  await expect(bold).toBeVisible();
  await bold.click();
  const delta = () =>
    page.evaluate(
      id =>
        document
          .querySelector('page-editor')
          .doc.getModelById(id)
          .text.toDelta(),
      fixture.rows[1]
    );
  await expect
    .poll(delta)
    .toEqual([{ insert: '第二项', attributes: { bold: true } }]);
  await page.keyboard.press('Escape');
  await second.click({ position: { x: 8, y: 8 } });
  const source = page.locator(
    `affine-list[data-block-id="${fixture.rows[0]}"]`
  );
  const target = page.locator(
    `affine-list[data-block-id="${fixture.rows[2]}"]`
  );
  await source.hover();
  const handle = page.locator('.affine-drag-handle-container');
  await expect(handle).toBeVisible();
  await handle.hover();
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  assert(from && to);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y + to.height - 1, { steps: 50 });
  await page.mouse.up();
  const order = () =>
    page.evaluate(
      note =>
        document
          .querySelector('page-editor')
          .doc.getModelById(note)
          .children.filter(m => m.flavour === 'affine:list')
          .map(m => m.id),
      fixture.note
    );
  await expect
    .poll(order)
    .toEqual([fixture.rows[1], fixture.rows[2], fixture.rows[0]]);
  await page.keyboard.press('Meta+z');
  await expect.poll(order).toEqual(fixture.rows);
  const originalSettings = await page.evaluate(() =>
    localStorage.getItem('global-state:editor-setting')
  );
  const sizes = [];
  for (const fullWidth of [false, true]) {
    await page.evaluate(fullWidth => {
      const key = 'global-state:editor-setting';
      const settings = JSON.parse(localStorage.getItem(key) ?? '{}');
      localStorage.setItem(
        key,
        JSON.stringify({
          ...settings,
          fontSize: '18',
          fullWidthLayout: JSON.stringify(fullWidth),
        })
      );
    }, fullWidth);
    await page.reload();
    await page.locator('page-editor').waitFor({ timeout: 60000 });
    await expect(page.locator('.affine-page-root-block-container')).toHaveCSS(
      'font-size',
      '18px'
    );
    for (const width of [1440, 942, 480]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(500);
      const measured = await page
        .locator('.affine-page-viewport')
        .evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth }));
      assert(
        measured.scroll <= measured.client + 1,
        JSON.stringify({ width, fullWidth, measured })
      );
      sizes.push({ width, fullWidth, measured });
    }
  }
  await page.evaluate(
    value =>
      value === null
        ? localStorage.removeItem('global-state:editor-setting')
        : localStorage.setItem('global-state:editor-setting', value),
    originalSettings
  );
  assert.deepEqual(errors, []);
  await writeFile(
    '/tmp/localmind-wolai-evidence/block-results.json',
    JSON.stringify(
      {
        fixture,
        sizes,
        errors,
        checks: [
          'indent-outdent-undo-redo',
          'selection-toolbar-bold',
          'drag-reorder-undo',
          'font-18-refresh',
          'standard-full-width-long-code',
        ],
      },
      null,
      2
    )
  );
  console.log(JSON.stringify({ sizes, errors }));
} catch (error) {
  await page.screenshot({
    path: '/tmp/localmind-wolai-evidence/block-failure.png',
  });
  throw error;
} finally {
  await context.close();
}
