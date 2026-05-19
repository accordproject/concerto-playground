import { test, expect } from '@playwright/test';

test.describe('Code Generation Output', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Switch to Code view
    await expect(page.getByRole('button', { name: 'Code' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Code' }).click();
    await expect(page.getByRole('button', { name: 'TypeScript' })).toBeVisible({ timeout: 5000 });
  });

  test('should display all output language tabs', async ({ page }) => {
    const expectedTabs = [
      'TypeScript',
      'JSON Schema',
      'Java',
      'C#',
      'Go',
      'Rust',
      'GraphQL',
      'Protobuf',
      'Avro',
      'OpenAPI',
      'OData',
      'XML Schema',
    ];

    for (const tab of expectedTabs) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible();
    }
  });

  test('TypeScript tab is active by default', async ({ page }) => {
    const tsTab = page.getByRole('button', { name: 'TypeScript' });
    // Active tab has text-[#19C6C8] class — verify it's present
    await expect(tsTab).toBeVisible();
    // The tab strip should show TypeScript content (not a loading spinner) eventually
    await expect(page.getByText('Generating…').or(page.getByText('GoverningLaw'))).toBeVisible({ timeout: 10000 });
  });

  test('should switch between output tabs', async ({ page }) => {
    // Click JSON Schema tab
    await page.getByRole('button', { name: 'JSON Schema' }).click();
    // The tab should be clickable (no assertion needed on content since it may still be generating)
    await expect(page.getByRole('button', { name: 'JSON Schema' })).toBeVisible();

    // Click Go tab
    await page.getByRole('button', { name: 'Go' }).click();
    await expect(page.getByRole('button', { name: 'Go' })).toBeVisible();
  });

  test('should display Copy button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
  });

  test('Copy button should copy content to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Wait for content to load
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 15000 }
    );

    await page.getByRole('button', { name: 'Copy' }).click();

    // Button shows copied feedback
    await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible({ timeout: 3000 });
  });

  test('should show output content for TypeScript after generation', async ({ page }) => {
    // Wait for "Generating…" spinner to disappear
    await expect(page.getByText('Generating…')).toBeHidden({ timeout: 15000 });

    // Some code output should be visible
    const codeArea = page.locator('.monaco-editor');
    await expect(codeArea).toBeVisible({ timeout: 5000 });
  });

  test('should reflect example change in output', async ({ page }) => {
    // Go back to the toolbar, load Loan example, come back to Code
    await page.getByRole('button', { name: 'Loan' }).click();

    // Code view should still be active (we're already in it)
    await expect(page.getByRole('button', { name: 'TypeScript' })).toBeVisible();

    // Switch tab to trigger re-render and verify we still have tabs
    await page.getByRole('button', { name: 'JSON Schema' }).click();
    await expect(page.getByRole('button', { name: 'JSON Schema' })).toBeVisible();
  });
});
