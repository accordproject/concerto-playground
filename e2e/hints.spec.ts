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
});
