import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

import { chromium, expect } from '@playwright/test';

const url = process.env.WOLAI_WORKSPACE_URL;
if (!url || !new URL(url).hostname.match(/^(localhost|127\.0\.0\.1)$/)) {
  throw new Error(
    'Set WOLAI_WORKSPACE_URL to an isolated local browser workspace document.'
  );
}
const output = '/tmp/localmind-wolai-evidence';
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
  await page.evaluate(() =>
    window.workbench.closeOthers(window.workbench.activeView$.value)
  );
  const fixture = await page.evaluate(() => {
    const editor = document.querySelector('page-editor');
    const workspace = editor.doc.workspace;
    const Text = editor.doc.root.props.title.constructor;
    const id = `wolai-edit-${Date.now()}`;
    const doc = workspace.createDoc(id);
    doc.load();
    const store = doc.getStore();
    const root = store.addBlock('affine:page', {
      title: new Text('中文编辑验收'),
    });
    store.addBlock('affine:surface', {}, root);
    const note = store.addBlock('affine:note', {}, root);
    const paragraph = store.addBlock(
      'affine:paragraph',
      { text: new Text() },
      note
    );
    workspace.meta.setDocMeta(id, { title: '中文编辑验收' });
    window.workbench.openDoc(id);
    return { id, paragraph };
  });
  const editable = page
    .locator(
      `affine-paragraph[data-block-id="${fixture.paragraph}"] [contenteditable=true]`
    )
    .first();
  await editable.click();
  await page.keyboard.type('/biaoti');
  await expect(page.getByTestId('Heading 1')).toHaveText(/一级标题/);
  await editable.dispatchEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 229,
    isComposing: true,
  });
  await expect(page.getByTestId('Heading 1')).toBeVisible();
  await page.getByTestId('Heading 1').click();
  await page.keyboard.insertText('中文标题，English 2026');
  await expect(editable).toContainText('中文标题，English 2026');
  await page.evaluate(({ paragraph }) => {
    const doc = document.querySelector('page-editor').doc;
    const Text = doc.root.props.title.constructor;
    const text = new Text('粗体子块与内链');
    doc.addBlock('affine:paragraph', { text }, paragraph);
    text.format(0, text.length, {
      bold: true,
      link: 'https://example.com/reference',
    });
    doc.captureSync();
  }, fixture);
  await editable.click();
  await page.keyboard.press('Meta+ArrowRight');
  await page.keyboard.type('/cjfb');
  await expect(page.getByTestId('Duplicate')).toHaveText(/创建副本/);
  await page.getByTestId('Duplicate').click();
  await expect(
    page
      .locator('affine-paragraph')
      .filter({ hasText: '中文标题，English 2026' })
  ).toHaveCount(2);
  const copied = await page.evaluate(({ paragraph }) => {
    const doc = document.querySelector('page-editor').doc;
    const original = doc.getModelById(paragraph);
    const parent = doc.getParent(original);
    const copy = parent.children[parent.children.indexOf(original) + 1];
    return {
      original: {
        text: original.text.toDelta(),
        children: original.children.map(m => m.text.toDelta()),
      },
      copy: {
        text: copy.text.toDelta(),
        children: copy.children.map(m => m.text.toDelta()),
      },
      idsDiffer:
        copy.id !== original.id &&
        copy.children[0]?.id !== original.children[0]?.id,
    };
  }, fixture);
  assert.deepEqual(copied.copy, copied.original);
  assert(copied.idsDiffer);
  await page.keyboard.press('Meta+z');
  await expect(
    page
      .locator('affine-paragraph')
      .filter({ hasText: '中文标题，English 2026' })
  ).toHaveCount(1);
  const newParagraph = async () => {
    const id = await page.evaluate(() => {
      const doc = document.querySelector('page-editor').doc;
      const note = doc.root.children.find(m => m.flavour === 'affine:note');
      const id = doc.addBlock('affine:paragraph', {}, note.id);
      doc.captureSync();
      return id;
    });
    const input = page
      .locator(`affine-paragraph[data-block-id="${id}"] [contenteditable=true]`)
      .first();
    await input.click();
    return input;
  };
  await newParagraph();
  await page.keyboard.type('/bt');
  await expect(page.getByTestId('Heading 2')).toHaveText(/二级标题/);
  await page.getByTestId('Heading 2').click();
  await page.keyboard.insertText('第二段标题');
  await newParagraph();
  await page.keyboard.type('/');
  await page.keyboard.insertText('待办');
  await expect(page.getByTestId('To-do List')).toHaveText(/待办列表/);
  await page.getByTestId('To-do List').click();
  await page.keyboard.insertText('确认中文编辑与本地保存');
  await expect(page.locator('affine-list')).toContainText(
    '确认中文编辑与本地保存'
  );
  await newParagraph();
  await page.keyboard.type('/zzzznomatch');
  await expect(page.getByText('没有匹配的命令', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  const snapshot = await page.evaluate(() => {
    const doc = document.querySelector('page-editor').doc;
    return doc.root.children
      .filter(m => m.flavour === 'affine:note')
      .flatMap(m =>
        m.children.map(b => ({
          id: b.id,
          flavour: b.flavour,
          type: b.props.type,
          text: b.text?.toString(),
        }))
      );
  });
  await page.waitForTimeout(2000);
  await page.reload();
  await page.locator('page-editor').waitFor({ timeout: 60000 });
  const restored = await page.evaluate(() => {
    const doc = document.querySelector('page-editor').doc;
    return doc.root.children
      .filter(m => m.flavour === 'affine:note')
      .flatMap(m =>
        m.children.map(b => ({
          id: b.id,
          flavour: b.flavour,
          type: b.props.type,
          text: b.text?.toString(),
        }))
      );
  });
  assert.deepEqual(restored, snapshot);
  assert(
    snapshot.some(
      block => block.type === 'h1' && block.text === '中文标题，English 2026'
    )
  );
  assert(
    snapshot.some(block => block.type === 'h2' && block.text === '第二段标题')
  );
  assert(
    snapshot.some(
      block => block.type === 'todo' && block.text === '确认中文编辑与本地保存'
    )
  );
  await page.evaluate(() => {
    document.querySelector('page-editor').doc.readonly = true;
  });
  await expect(page.locator('affine-page-root')).toHaveAttribute(
    'contenteditable',
    'false'
  );
  await page.keyboard.insertText('不应写入只读页面');
  await expect(page.locator('page-editor')).not.toContainText(
    '不应写入只读页面'
  );
  await writeFile(
    `${output}/editing-results.json`,
    JSON.stringify(
      {
        fixture,
        copied,
        snapshot,
        errors,
        checks: [
          'composition-enter-guard',
          'duplicate-subtree-format-links',
          'duplicate-undo',
          'readonly-input-denied',
        ],
      },
      null,
      2
    )
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      fixture,
      checks: [
        'pinyin-heading',
        'initials-heading',
        'chinese-todo',
        'no-results',
        'reload-content-integrity',
      ],
      errors,
    })
  );
} catch (error) {
  await page.screenshot({ path: `${output}/editing-failure.png` });
  console.error((await page.locator('body').innerText()).slice(-4000));
  throw error;
} finally {
  await context.close();
}
