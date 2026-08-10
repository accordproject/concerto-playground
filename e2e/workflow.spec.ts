import { test, expect } from '@playwright/test';

test.describe('CTO Panel Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Concerto Schema')).toBeVisible({ timeout: 15000 });
  });

  test('should hide CTO panel when toggle is clicked', async ({ page }) => {
    // Main toolbar toggle title starts with "Hide CTO panel" (graph toolbar uses
    // "Hide CTO text"); prefix match because the title also carries the shortcut hint.
    const toggleBtn = page.locator('button[title^="Hide CTO panel"]');
    await expect(toggleBtn).toBeVisible();

    await toggleBtn.click();

    await expect(page.getByText('Concerto Schema')).toBeHidden();
    await expect(page.locator('button[title^="Show CTO panel"]')).toBeVisible();
  });

  test('should re-show CTO panel after toggling twice', async ({ page }) => {
    await page.locator('button[title^="Hide CTO panel"]').click();
    await expect(page.getByText('Concerto Schema')).toBeHidden();

    await page.locator('button[title^="Show CTO panel"]').click();
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

  test('loading an example keeps a freshly added namespace', async ({ page }) => {
    await page.locator('button[title="Add namespace"]').click();
    await expect(page.getByText('org.example.new', { exact: false })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'NDA' }).click();

    await expect(page.getByText('org.example.new', { exact: false })).toBeVisible();
  });

  test('re-clicking the same example keeps local edits', async ({ page }) => {
    const editor = page.locator('.monaco-editor').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();
    await page.keyboard.type('MYEDIT');
    await expect(page.locator('.view-lines').first()).toContainText('MYEDIT');

    await page.getByRole('button', { name: 'NDA' }).click();

    await expect(page.locator('.view-lines').first()).toContainText('MYEDIT');
  });

  test('edits survive a round trip through another example', async ({ page }) => {
    const editor = page.locator('.monaco-editor').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();
    await page.keyboard.type('MYEDIT');
    await expect(page.locator('.view-lines').first()).toContainText('MYEDIT');

    await page.getByRole('button', { name: 'Vehicles' }).click();
    await expect(page.locator('.view-lines').first()).toContainText('sample.vehicles', { timeout: 5000 });

    await page.getByRole('button', { name: 'NDA' }).click();
    await expect(page.locator('.view-lines').first()).toContainText('MYEDIT');
  });

  test('edits made in both examples are kept across switches', async ({ page }) => {
    // Edit NDA, switch to Vehicles, edit it too, then bounce back and forth:
    // each example must show its own edited version.
    const editor = page.locator('.monaco-editor').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();
    await page.keyboard.type('NDAEDIT');
    await expect(page.locator('.view-lines').first()).toContainText('NDAEDIT');

    await page.getByRole('button', { name: 'Vehicles' }).click();
    await expect(page.locator('.view-lines').first()).toContainText('sample.vehicles', { timeout: 5000 });
    await editor.click();
    await page.keyboard.type('VEHEDIT');
    await expect(page.locator('.view-lines').first()).toContainText('VEHEDIT');

    await page.getByRole('button', { name: 'NDA' }).click();
    await expect(page.locator('.view-lines').first()).toContainText('NDAEDIT');

    await page.getByRole('button', { name: 'Vehicles' }).click();
    await expect(page.locator('.view-lines').first()).toContainText('VEHEDIT');
  });

  test('edited example stays open as a visible tab after switching away', async ({ page }) => {
    // No hidden state: work in progress must stay visible in the tab strip,
    // so share/export/codegen include it.
    const editor = page.locator('.monaco-editor').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();
    await page.keyboard.type('MYEDIT');
    await expect(page.locator('.view-lines').first()).toContainText('MYEDIT');

    await page.getByRole('button', { name: 'Vehicles' }).click();

    await expect(page.locator('div[title="org.accordproject.nda@1.0.0"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('div[title="sample.vehicles@1.0.0"]')).toBeVisible();
  });

  test('untouched example is swapped out instead of piling up as a tab', async ({ page }) => {
    await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Vehicles' }).click();
    await expect(page.locator('.view-lines').first()).toContainText('sample.vehicles', { timeout: 5000 });

    // The pristine NDA model was replaced, so no tab strip appears
    await expect(page.locator('div[title="org.accordproject.nda@1.0.0"]')).toBeHidden();
  });

  test('closing an edited example tab resets it to pristine on next load', async ({ page }) => {
    const editor = page.locator('.monaco-editor').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    await editor.click();
    await page.keyboard.type('MYEDIT');
    await expect(page.locator('.view-lines').first()).toContainText('MYEDIT');

    // Switching away keeps the edited NDA open; closing its tab discards it
    await page.getByRole('button', { name: 'Vehicles' }).click();
    const ndaTab = page.locator('div[title="org.accordproject.nda@1.0.0"]');
    await expect(ndaTab).toBeVisible({ timeout: 5000 });
    await ndaTab.locator('span[title="Remove"]').click();
    await expect(ndaTab).toBeHidden();

    await page.getByRole('button', { name: 'NDA' }).click();

    await expect(page.locator('.view-lines').first()).toContainText('org.accordproject.nda');
    await expect(page.locator('.view-lines').first()).not.toContainText('MYEDIT');
  });

  test('user namespace stays open while switching between examples', async ({ page }) => {
    await page.locator('button[title="Add namespace"]').click();
    await expect(page.getByText('org.example.new', { exact: false })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Vehicles' }).click();
    await expect(page.getByText('org.example.new', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'NDA' }).click();
    await expect(page.getByText('org.example.new', { exact: false })).toBeVisible();
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
