import { test, expect } from '@playwright/test';

test.describe('CTO Panel Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Concerto Schema')).toBeVisible({ timeout: 15000 });
  });

  test('should hide CTO panel when toggle is clicked', async ({ page }) => {
    // Main toolbar toggle has title="Hide CTO panel" (graph toolbar uses "Hide CTO text")
    const toggleBtn = page.locator('button[title="Hide CTO panel"]');
    await expect(toggleBtn).toBeVisible();

    await toggleBtn.click();

    await expect(page.getByText('Concerto Schema')).toBeHidden();
    await expect(page.locator('button[title="Show CTO panel"]')).toBeVisible();
  });

  test('should re-show CTO panel after toggling twice', async ({ page }) => {
    await page.locator('button[title="Hide CTO panel"]').click();
    await expect(page.getByText('Concerto Schema')).toBeHidden();

    await page.locator('button[title="Show CTO panel"]').click();
    await expect(page.getByText('Concerto Schema')).toBeVisible();
  });
});

test.describe('View Mode Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Use .first() — ReactFlow may render extra elements that also match "Graph"
    await expect(page.getByRole('button', { name: 'Graph' }).first()).toBeVisible({ timeout: 15000 });
  });

  test('should switch to Code view and show output tabs', async ({ page }) => {
    await page.getByRole('button', { name: 'Code' }).click();

    await expect(page.getByRole('button', { name: 'TypeScript' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'JSON Schema' })).toBeVisible();
    await expect(page.locator('button[aria-haspopup="menu"]')).toBeVisible();
  });

  test('should switch to Form view', async ({ page }) => {
    await page.getByRole('button', { name: 'Form' }).click();

    // CTO editor is hidden in form view (App.tsx: showCto && viewMode !== "form")
    await expect(page.getByText('Concerto Schema')).toBeHidden({ timeout: 5000 });
  });

  test('should switch back to Graph view from Code view', async ({ page }) => {
    await page.getByRole('button', { name: 'Code' }).click();
    await expect(page.getByRole('button', { name: 'TypeScript' })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Graph' }).first().click();

    await expect(page.getByRole('button', { name: 'TypeScript' })).toBeHidden({ timeout: 5000 });
    await expect(page.getByText('Concerto Schema')).toBeVisible();
  });

  test('Graph button is visible in the toolbar', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Graph' }).first()).toBeVisible();
  });
});

test.describe('Loading Examples', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'NDA' })).toBeVisible({ timeout: 15000 });
  });

  test('should load Vehicles example', async ({ page }) => {
    await page.getByRole('button', { name: 'Vehicles' }).click();
    await expect(page.getByText('Concerto Schema')).toBeVisible();
  });

  test('should load Service Agreement example', async ({ page }) => {
    await page.getByRole('button', { name: 'Service Agreement' }).click();
    await expect(page.getByText('Concerto Schema')).toBeVisible();
  });

  test('should load NDA example after switching away', async ({ page }) => {
    await page.getByRole('button', { name: 'Vehicles' }).click();
    await page.getByRole('button', { name: 'NDA' }).click();
    await expect(page.getByText('Concerto Schema')).toBeVisible();
  });

  test('loading an example keeps other open examples', async ({ page }) => {
    // Initial workspace holds NDA; loading Vehicles must merge, not replace
    await page.getByRole('button', { name: 'Vehicles' }).click();
    // Both namespaces stay open in the tab strip (NDA tab label is truncated)
    await expect(page.getByText('sample.vehicles@1.0.0')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('org.accordproject.nda@1', { exact: false })).toBeVisible();
  });

  test('loading an example keeps a freshly added namespace', async ({ page }) => {
    await page.locator('button[title="Add namespace"]').click();
    await expect(page.getByText('org.example.new', { exact: false })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'NDA' }).click();

    // The new namespace must survive loading an example
    await expect(page.getByText('org.example.new', { exact: false })).toBeVisible();
  });

  test('re-clicking an example does not wipe local edits', async ({ page }) => {
    // Type a marker into the CTO editor for the NDA namespace
    const editor = page.locator('.monaco-editor').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();
    await page.keyboard.type('MYEDIT');
    await expect(page.locator('.view-lines').first()).toContainText('MYEDIT');

    // Clicking the NDA example again must keep the edited version
    await page.getByRole('button', { name: 'NDA' }).click();
    await expect(page.locator('.view-lines').first()).toContainText('MYEDIT');
  });

  test('example buttons persist across view mode switches', async ({ page }) => {
    await page.getByRole('button', { name: 'Code' }).click();
    await expect(page.getByRole('button', { name: 'Vehicles' })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Vehicles' }).click();
    await expect(page.getByRole('button', { name: 'TypeScript' })).toBeVisible();
  });
});

test.describe('Multi-Namespace Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Concerto Schema')).toBeVisible({ timeout: 15000 });
  });

  test('should add a new namespace', async ({ page }) => {
    // The single-namespace "Add namespace" button is titled "Add namespace"
    const addNsBtn = page.locator('button[title="Add namespace"]');
    await expect(addNsBtn).toBeVisible();
    await addNsBtn.click();

    // After adding, the tab strip appears with its own "Add namespace" button
    await expect(page.locator('button[title="Add namespace"]')).toBeVisible({ timeout: 5000 });
    // The Concerto Schema panel remains visible
    await expect(page.getByText('Concerto Schema')).toBeVisible();
  });
});
