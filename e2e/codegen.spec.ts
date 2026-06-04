import { test, expect } from '@playwright/test';

test.describe('Code Generation Output', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Code' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Code' }).click();
    await expect(page.getByRole('button', { name: 'TypeScript' })).toBeVisible({ timeout: 5000 });
  });

  test('should display all output language tabs', async ({ page }) => {
    // Primary tabs are always visible in the strip
    const primaryTabs = ['TypeScript', 'JSON Schema', 'JSON AST', 'Concertino'];
    for (const tab of primaryTabs) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible();
    }

    // Overflow tabs live behind the More dropdown
    const overflowTabs = [
      'Java', 'C#', 'Go', 'Rust', 'GraphQL',
      'Protobuf', 'Avro', 'OpenAPI', 'OData', 'XML Schema',
    ];
    await page.locator('button[aria-haspopup="menu"]').click();
    for (const tab of overflowTabs) {
      await expect(page.getByRole('menuitem', { name: tab })).toBeVisible();
    }
  });

  test('TypeScript tab is active by default', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'TypeScript' })).toBeVisible();
    // Either generating or content is already shown
    await expect(
      page.getByText('Generating…').or(page.getByText('GoverningLaw'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should switch between output tabs', async ({ page }) => {
    // Primary tab — click directly
    await page.getByRole('button', { name: 'JSON Schema' }).click();
    await expect(page.getByRole('button', { name: 'JSON Schema' })).toBeVisible();

    // Overflow tab — open More dropdown first, then select Go
    await page.locator('button[aria-haspopup="menu"]').click();
    await page.getByRole('menuitem', { name: 'Go' }).click();
    // After selection the dropdown button reflects the active overflow tab
    await expect(page.locator('button[aria-haspopup="menu"]')).toContainText('Go');
  });

  test('should display Copy button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
  });

  test('Copy button should copy content to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Wait for the generation spinner to clear
    await expect(page.getByText('Generating…')).toBeHidden({ timeout: 15000 });

    await page.getByRole('button', { name: 'Copy' }).click();

    await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible({ timeout: 3000 });
  });

  test('should show monaco editor for output content', async ({ page }) => {
    // Wait for generation to complete
    await expect(page.getByText('Generating…')).toBeHidden({ timeout: 15000 });

    // In Code view with CTO panel visible, there are two .monaco-editor instances.
    // The output editor is the last one.
    const outputEditor = page.locator('.monaco-editor').last();
    await expect(outputEditor).toBeVisible({ timeout: 5000 });
  });

  test('should reflect example change in output', async ({ page }) => {
    await page.getByRole('button', { name: 'Vehicles' }).click();

    // Code view is still active; tabs remain visible
    await expect(page.getByRole('button', { name: 'TypeScript' })).toBeVisible();

    await page.getByRole('button', { name: 'JSON Schema' }).click();
    await expect(page.getByRole('button', { name: 'JSON Schema' })).toBeVisible();
  });
});
