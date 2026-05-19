import { test, expect } from '@playwright/test';

test.describe('Form View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Form' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Form' }).click();
  });

  test('should show Model Tree panel', async ({ page }) => {
    await expect(page.getByText('Model Tree')).toBeVisible({ timeout: 5000 });
  });

  test('should hide CTO editor in form view', async ({ page }) => {
    await expect(page.getByText('Concerto Schema')).toBeHidden({ timeout: 5000 });
  });

  test('should display namespace in the tree', async ({ page }) => {
    // The NDA example namespace should appear in the tree
    await expect(page.getByText(/org\.accordproject\.nda/)).toBeVisible({ timeout: 5000 });
  });

  test('should show declarations in the tree', async ({ page }) => {
    // NDA example has at least GoverningLaw and Party
    await expect(page.getByText('GoverningLaw')).toBeVisible({ timeout: 5000 });
  });

  test('should open property sheet when clicking a declaration', async ({ page }) => {
    // Click GoverningLaw declaration in the tree
    await page.getByText('GoverningLaw').first().click();
    // Property sheet should show form fields for the declaration
    await expect(page.getByText('Name', { exact: false }).first()).toBeVisible({ timeout: 3000 });
  });

  test('should open property sheet when clicking a namespace', async ({ page }) => {
    await page.getByText(/org\.accordproject\.nda/).first().click();
    // Namespace form shows a "Namespace" label
    await expect(page.getByText('Namespace', { exact: false })).toBeVisible({ timeout: 3000 });
  });

  test('should switch back to Graph view from Form view', async ({ page }) => {
    await page.getByRole('button', { name: 'Graph' }).first().click();
    await expect(page.getByText('Concerto Schema')).toBeVisible({ timeout: 5000 });
  });

  test('should have an Add namespace button in the tree header', async ({ page }) => {
    await expect(page.locator('button[title="Add namespace"]')).toBeVisible({ timeout: 5000 });
  });
});
