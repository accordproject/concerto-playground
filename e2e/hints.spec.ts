import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Replaces the CTO editor content through the Monaco API. Typing the text
// key by key is flaky: Monaco's suggestion widget swallows Enter presses.
async function setEditorText(page: Page, text: string) {
  const editor = page.locator('.monaco-editor').first();
  await expect(editor).toBeVisible({ timeout: 15000 });
  await page.evaluate((t) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const monaco = (window as any).monaco;
    monaco.editor.getEditors()[0].getModel().setValue(t);
  }, text);
}

// Moves the pointer over the given 1-based line/column of the CTO editor.
// Two small moves make sure Monaco sees a mousemove inside the target token.
async function hoverEditorPosition(page: Page, lineNumber: number, column: number) {
  const point = await page.evaluate(
    ([l, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editor = (window as any).monaco.editor.getEditors()[0];
      const pos = editor.getScrolledVisiblePosition({ lineNumber: l, column: c });
      const rect = editor.getDomNode().getBoundingClientRect();
      return { x: rect.left + pos.left, y: rect.top + pos.top + pos.height / 2 };
    },
    [lineNumber, column],
  );
  await page.mouse.move(point.x, point.y);
  await page.mouse.move(point.x + 2, point.y);
}

const CTO_WITH_BLOCK_COMMENT = [
  'namespace org.hints@1.0.0',
  '',
  '/**',
  ' * The concept keyword is explained here.',
  ' */',
  'concept Person {',
  '  o String name',
  '}',
  '',
].join('\n');

// Line/column targets inside CTO_WITH_BLOCK_COMMENT, pointing at the middle
// of each "concept" occurrence (columns are 1-based).
const COMMENT_LINE = 4;
const COMMENT_COLUMN = ' * The concept'.indexOf('concept') + 3;
const DECLARATION_LINE = 6;
const DECLARATION_COLUMN = 'con'.length;

const CTO_WITH_IDENTIFIED_CONCEPT = [
  'namespace org.rel@1.0.0',
  '',
  'concept Person identified by id {',
  '  o String id',
  '}',
  '',
  'asset Order identified by orderId {',
  '  o String orderId',
  '  --> Person buyer',
  '}',
  '',
].join('\n');

// The middle of the --> arrow on '  --> Person buyer' (columns are 1-based).
const ARROW_LINE = 9;
const ARROW_COLUMN = '  --'.length;

test.describe('Contextual hints and block comments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Concerto Schema')).toBeVisible({ timeout: 15000 });
    await setEditorText(page, CTO_WITH_BLOCK_COMMENT);
  });

  test('does not show a hint for a keyword inside a /** */ block comment', async ({ page }) => {
    const hint = page.locator('.monaco-hover').filter({ hasText: 'concept' });

    // Regression for the Monarch tokenizer: "concept" on the middle line of
    // a multiline block comment must be comment text, not a keyword.
    await hoverEditorPosition(page, COMMENT_LINE, COMMENT_COLUMN);
    // Monaco's hover delay is 300ms; leave enough room for it to fire.
    await page.waitForTimeout(1200);
    await expect(hint).toBeHidden();

    // Control within the same run: the same word as a real declaration
    // keyword still shows the hint, so the machinery itself works.
    await hoverEditorPosition(page, DECLARATION_LINE, DECLARATION_COLUMN);
    await expect(hint).toBeVisible({ timeout: 5000 });
    await expect(hint).toContainText('general-purpose class of the metamodel');
  });

  test('the --> hint matches the spec: any identifiable type is a valid target', async ({ page }) => {
    // A relationship to an identified concept is valid per the model
    // relationships specification, so the model must render a graph and the
    // hint must not restrict targets to assets and participants.
    await setEditorText(page, CTO_WITH_IDENTIFIED_CONCEPT);

    await expect(page.getByRole('alert').filter({ hasText: 'Schema' })).toBeHidden();
    await expect(page.locator('.react-flow__node', { hasText: 'Order' })).toBeVisible({ timeout: 10000 });

    await hoverEditorPosition(page, ARROW_LINE, ARROW_COLUMN);
    const hint = page.locator('.monaco-hover').filter({ hasText: 'relationship' });
    await expect(hint).toBeVisible({ timeout: 5000 });
    await expect(hint).toContainText('identifiable declaration');
  });
});

test.describe('Graph hint popovers', () => {
  test('the badge popover stays inside the viewport near the right edge', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Concerto Schema')).toBeVisible({ timeout: 15000 });
    const node = page.locator('.react-flow__node').first();
    await expect(node).toBeVisible({ timeout: 15000 });

    // Drag the node against the right viewport edge, the situation the
    // review reproduced by panning; the default popover placement extends
    // rightwards from the badge and would leave the screen.
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('viewport size is not set');
    const box = await node.boundingBox();
    if (!box) throw new Error('node has no bounding box');
    await page.mouse.move(box.x + box.width / 2, box.y + 12);
    await page.mouse.down();
    await page.mouse.move(viewport.width - 20, box.y + 12, { steps: 15 });
    await page.mouse.up();

    const badge = node.locator('.graph-node-kind').first();
    await badge.hover();
    const pop = node.locator('.concept-hint-pop').first();
    await expect(pop).toBeVisible();
    const popBox = await pop.boundingBox();
    if (!popBox) throw new Error('popover has no bounding box');
    expect(popBox.x).toBeGreaterThanOrEqual(0);
    expect(popBox.x + popBox.width).toBeLessThanOrEqual(viewport.width);
    expect(popBox.y).toBeGreaterThanOrEqual(0);
    expect(popBox.y + popBox.height).toBeLessThanOrEqual(viewport.height);
  });
});
