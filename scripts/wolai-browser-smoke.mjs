import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

import { chromium, expect } from '@playwright/test';

const output = '/tmp/localmind-wolai-evidence';
const url = process.env.WOLAI_WORKSPACE_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error(
    'Set WOLAI_WORKSPACE_URL to an isolated local browser workspace document.'
  );
await mkdir(output, { recursive: true });
const context = await chromium.launchPersistentContext(
  '/tmp/localmind-wolai-browser',
  {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 1000 },
  }
);
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
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
    const editor = document.querySelector('page-editor');
    const workspace = editor.doc.workspace;
    const Text = editor.doc.root.props.title.constructor;
    function create(id, title, content) {
      if (workspace.getDoc(id)) return id;
      const doc = workspace.createDoc(id);
      doc.load();
      const store = doc.getStore();
      const root = store.addBlock('affine:page', { title: new Text(title) });
      store.addBlock('affine:surface', {}, root);
      const note = store.addBlock('affine:note', {}, root);
      for (const text of content)
        store.addBlock('affine:paragraph', { text: new Text(text) }, note);
      workspace.meta.setDocMeta(id, { title });
      store.captureSync();
      return id;
    }
    const source = create('wolai-writing', '写作验收', [
      '中文写作草稿：记录今天的研究结论。',
      '甲、乙、丙，保留标点与数字 2026。',
      ...Array.from({ length: 25 }, (_, i) =>
        `第 ${i + 1} 段：中文与 English 混排，验证正文在窄窗中自然换行，标题、属性和正文保持相同基线。`.repeat(
          3
        )
      ),
    ]);
    const reference = create('wolai-reference', '验收来源资料', [
      '春季检索命中段落：项目采用 local-first 文档工作流。',
      '原始内容用于验证右侧编辑、返回来源与本地保存。',
    ]);
    for (let i = 0; i < 61; i++)
      create(
        `wolai-search-${i}`,
        `春季资料检索 ${String(i).padStart(2, '0')}`,
        ['用于分页验证的合成资料。']
      );
    window.workbench.closeOthers(window.workbench.activeView$.value);
    window.workbench.openDoc(source);
    return { source, reference, basename: window.workbench.basename$.value };
  });
  await expect(page.locator('page-editor')).toHaveCount(1);
  await page.waitForTimeout(2500);
  const sourceUrl = page.url();
  await page.keyboard.press('Meta+k');
  await page.locator('[cmdk-input]').fill('春季检索命中段落');
  await expect(
    page.locator('[cmdk-item]').filter({ hasText: '验收来源资料' })
  ).toHaveCount(1, { timeout: 15000 });
  await page
    .locator('[cmdk-item]')
    .filter({ hasText: '验收来源资料' })
    .getByRole('button')
    .click();
  await expect(page.locator('page-editor')).toHaveCount(2);
  const locatedBlock = await page.evaluate(() =>
    new URLSearchParams(
      window.workbench.activeView$.value.history.location.search
    ).get('blockIds')
  );
  assert(
    locatedBlock,
    'Content search must carry the matched block ID to the opened document.'
  );
  await expect(
    page
      .locator('page-editor')
      .last()
      .locator(`[data-block-id="${locatedBlock}"]`)
      .first()
  ).toContainText('春季检索命中段落');
  await page.waitForTimeout(500);
  assert.equal(
    await page.evaluate(() => window.workbench.views$.value.length),
    2
  );
  await page.reload();
  await expect(page.locator('page-editor')).toHaveCount(2, { timeout: 30000 });
  assert.deepEqual(
    await page.evaluate(() =>
      window.workbench.views$.value.map(v => v.history.location.pathname)
    ),
    ['/wolai-writing', '/wolai-reference']
  );
  await page.screenshot({ path: `${output}/wide-two-pages.png` });
  await page.getByTestId('split-view-indicator').last().focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: '关闭', exact: true }).click();
  await expect(page.locator('page-editor')).toHaveCount(1);
  await expect(page).toHaveURL(/\/wolai-writing$/);
  await page.goBack();
  await expect(page.locator('page-editor')).toHaveCount(2);
  await page.goForward();
  await expect(page.locator('page-editor')).toHaveCount(1);
  await expect(page).toHaveURL(/\/wolai-writing$/);
  await page.evaluate(() =>
    window.workbench.openDoc('wolai-reference', { at: 'beside' })
  );
  await expect(page.locator('page-editor')).toHaveCount(2);
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(
    page.getByRole('tab', { name: '写作验收', exact: true })
  ).toBeVisible();
  await page.getByRole('tab', { name: '写作验收', exact: true }).click();
  const widths = await page
    .locator('.affine-page-viewport:visible')
    .evaluateAll(elements =>
      elements.map(el => ({ client: el.clientWidth, scroll: el.scrollWidth }))
    );
  assert(
    widths.every(item => item.scroll <= item.client + 1),
    JSON.stringify(widths)
  );
  await page.screenshot({ path: `${output}/narrow-tabs.png` });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('page-editor:visible')).toHaveCount(2);
  await page.keyboard.press('Meta+k');
  await page.locator('[cmdk-input]').fill('春季资料检索');
  await expect(
    page.locator('[cmdk-item]').filter({ hasText: '加载更多结果' })
  ).toBeVisible({ timeout: 15000 });
  await page.locator('[cmdk-item]').filter({ hasText: '加载更多结果' }).click();
  await expect(
    page.locator('[cmdk-item]').filter({ hasText: '春季资料检索' })
  ).toHaveCount(61, { timeout: 15000 });
  await page.screenshot({ path: `${output}/search-pagination.png` });
  await page.keyboard.press('Escape');
  const sourceEditor = page.locator('page-editor').nth(0);
  const referenceEditor = page.locator('page-editor').nth(1);
  const firstParagraph = sourceEditor
    .locator('affine-paragraph [contenteditable=true]')
    .first();
  await firstParagraph.click();
  await page.keyboard.press('Meta+ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/ljym');
  await page.getByTestId('Linked Doc').click();
  await page.keyboard.insertText('验收来源');
  await expect(
    page
      .locator('.linked-doc-popover icon-button')
      .filter({ hasText: '验收来源资料' })
  ).toBeVisible({ timeout: 15000 });
  await page
    .locator('.linked-doc-popover icon-button')
    .filter({ hasText: '验收来源资料' })
    .click();
  await page.keyboard.insertText('：依据来源继续写作，确认保存。');
  await expect(sourceEditor).toContainText('依据来源继续写作，确认保存。');
  const referenceParagraph = referenceEditor
    .locator('affine-paragraph [contenteditable=true]')
    .last();
  await referenceParagraph.click();
  await page.keyboard.press('Meta+ArrowRight');
  const marker = `独立编辑验收 ${Date.now()}`;
  await page.keyboard.insertText(marker);
  await expect(sourceEditor).not.toContainText(marker);
  await expect(page.getByTestId('doc-save-status').first()).toHaveAttribute(
    'data-state',
    'local',
    { timeout: 15000 }
  );
  await expect(page.getByTestId('doc-save-status').last()).toHaveAttribute(
    'data-state',
    'local',
    { timeout: 15000 }
  );
  await page.reload();
  await expect(sourceEditor).toContainText('依据来源继续写作，确认保存。', {
    timeout: 60000,
  });
  await expect(referenceEditor).toContainText(marker);
  const links = await sourceEditor.evaluate(
    editor =>
      editor.doc
        .getBlocksByFlavour('affine:paragraph')
        .flatMap(block => block.model.text?.toDelta() ?? [])
        .filter(
          delta => delta.attributes?.reference?.pageId === 'wolai-reference'
        ).length
  );
  assert(links > 0);
  await page
    .locator('.affine-page-viewport')
    .first()
    .evaluate(el => {
      el.scrollTop = 600;
    });
  await expect
    .poll(() => page.evaluate(() => history.state.usr.views[0].scrollTop))
    .toBe(600);
  await page.reload();
  await expect(page.locator('page-editor')).toHaveCount(2, { timeout: 60000 });
  await expect
    .poll(() =>
      page
        .locator('.affine-page-viewport')
        .first()
        .evaluate(el => el.scrollTop)
    )
    .toBe(600);
  const themes = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => localStorage.setItem('theme', theme), theme);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('page-editor')).toHaveCount(2, {
      timeout: 60000,
    });
    for (const width of [1440, 942, 480]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(800);
      await page
        .locator('.affine-page-viewport:visible')
        .evaluateAll(elements =>
          elements.forEach(el => {
            el.scrollTop = 0;
          })
        );
      const viewportWidths = await page
        .locator('.affine-page-viewport:visible')
        .evaluateAll(elements =>
          elements.map(el => ({
            client: el.clientWidth,
            scroll: el.scrollWidth,
          }))
        );
      assert(
        viewportWidths.every(item => item.scroll <= item.client + 1),
        JSON.stringify({ theme, width, viewportWidths })
      );
      const unobscured = await page
        .locator('[data-testid="local-demo-tips"]:visible')
        .evaluateAll(banners =>
          banners.every(banner => {
            const viewport = banner.parentElement.querySelector(
              '.affine-page-viewport'
            );
            return (
              !viewport ||
              banner.getBoundingClientRect().bottom <=
                viewport.getBoundingClientRect().top + 1
            );
          })
        );
      assert(unobscured, 'The local storage banner must not cover the editor.');
      themes.push({ theme, width, viewportWidths });
      await page.screenshot({ path: `${output}/${theme}-${width}.png` });
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/browser-results.json`,
    JSON.stringify(
      {
        sourceUrl,
        fixture,
        widths,
        themes,
        links,
        errors,
        checks: [
          'search-to-side-open',
          'refresh-two-pages',
          'close-back-forward',
          'narrow-tab-recovery',
          '61-document-pagination',
          'insert-source-link',
          'independent-editing',
          'local-save-refresh',
          'scroll-refresh',
        ],
      },
      null,
      2
    )
  );
  console.log(JSON.stringify({ output, widths, errors }));
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` });
  console.error(
    'URL',
    page.url(),
    'BODY',
    (await page.locator('body').innerText()).slice(0, 3500)
  );
  throw error;
} finally {
  await context.close();
}
