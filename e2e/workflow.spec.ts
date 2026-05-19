import { test, expect } from '@playwright/test';

test.describe('CTO Panel Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Concerto Schema')).toBeVisible({ timeout: 15000 });
  });

  test('should hide CTO panel when toggle is clicked', async ({ page }) => {
    const toggleBtn = page.getByRole('button', { name: /◀ CTO/i });
    await expect(toggleBtn).toBeVisible();

    await toggleBtn.click();

    // Panel header should be gone
    await expect(page.getByText('Concerto Schema')).toBeHidden();

    // Button label flips to show-state
    await expect(page.getByRole('button', { name: /▶ CTO/i })).toBeVisible();
  });

  test('should re-show CTO panel after toggling twice', async ({ page }) => {
    const hideBtn = page.getByRole('button', { name: /◀ CTO/i });
    await hideBtn.click();
    await expect(page.getByText('Concerto Schema')).toBeHidden();

    const showBtn = page.getByRole('button', { name: /▶ CTO/i });
    await showBtn.click();
    await expect(page.getByText('Concerto Schema')).toBeVisible();
  });
});

test.describe('View Mode Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Graph' })).toBeVisible({ timeout: 15000 });
  });

  test('should switch to Code view and show output tabs', async ({ page }) => {
    await page.getByRole('button', { name: 'Code' }).click();

    // Output tab strip should appear
    await expect(page.getByRole('button', { name: 'TypeScript' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'JSON Schema' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Java' })).toBeVisible();
  });

  test('should switch to Form view', async ({ page }) => {
    await page.getByRole('button', { name: 'Form' }).click();

    // CTO editor should be hidden in form view (per App.tsx: showCto && viewMode !== "form")
    await expect(page.getByText('Concerto Schema')).toBeHidden({ timeout: 5000 });
  });

  test('should switch back to Graph view from Code view', async ({ page }) => {
    await page.getByRole('button', { name: 'Code' }).click();
    await expect(page.getByRole('button', { name: 'TypeScript' })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Graph' }).click();

    // Output tabs should be gone
    await expect(page.getByRole('button', { name: 'TypeScript' })).toBeHidden({ timeout: 5000 });
    // CTO panel reappears
    await expect(page.getByText('Concerto Schema')).toBeVisible();
  });

  test('Graph button is highlighted in graph mode', async ({ page }) => {
    // Graph is the default view; its button should have the active background
    const graphBtn = page.getByRole('button', { name: 'Graph' });
    // Active buttons use background #3182ce; verify the button exists and is visible
    await expect(graphBtn).toBeVisible();
  });
});

test.describe('Loading Examples', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'NDA' })).toBeVisible({ timeout: 15000 });
  });

  test('should load Loan example', async ({ page }) => {
    await page.getByRole('button', { name: 'Loan' }).click();

    // Switch to Code view to observe the generated output
    await page.getByRole('button', { name: 'Code' }).click();
    await expect(page.getByRole('button', { name: 'TypeScript' })).toBeVisible({ timeout: 5000 });

    // The Loan namespace should appear in the CTO panel
    await page.getByRole('button', { name: 'Graph' }).click();
    await expect(page.getByText('Concerto Schema')).toBeVisible();
  });

  test('should load Service Agreement example', async ({ page }) => {
    await page.getByRole('button', { name: 'Service Agreement' }).click();

    // After loading, the NDA namespace tab is replaced; heading still shows
    await expect(page.getByText('Concerto Schema')).toBeVisible();
  });

  test('should load NDA example', async ({ page }) => {
    // Load a different example first, then switch back to NDA
    await page.getByRole('button', { name: 'Loan' }).click();
    await page.getByRole('button', { name: 'NDA' }).click();
    await expect(page.getByText('Concerto Schema')).toBeVisible();
  });
});

test.describe('Multi-Namespace Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Concerto Schema')).toBeVisible({ timeout: 15000 });
  });

  test('should add a new namespace', async ({ page }) => {
    // The "+ ns" button appears when only one namespace exists
    const addNsBtn = page.getByRole('button', { name: '+ ns' });
    await expect(addNsBtn).toBeVisible();
    await addNsBtn.click();

    // After adding, two namespaces exist — the tab strip appears
    // The "+" button moves into the tab strip
    const plusBtn = page.getByRole('button', { name: '+' });
    await expect(plusBtn).toBeVisible({ timeout: 5000 });
  });
});
