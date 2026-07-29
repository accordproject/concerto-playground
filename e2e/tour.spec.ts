import { test, expect } from '@playwright/test';

// The rest of the suite runs with the tour pre-marked as seen (see
// playwright.config.ts). These tests need to look like a first visit, so
// they opt back into completely fresh storage.
test.use({ storageState: { cookies: [], origins: [] } });

const popover = (page: import('@playwright/test').Page) => page.locator('.driver-popover');

test.describe('Onboarding tour', () => {
  test('auto-starts on the first visit and stays skipped after Escape', async ({ page }) => {
    await page.goto('/');

    await expect(popover(page)).toBeVisible({ timeout: 15000 });
    await expect(popover(page)).toContainText('Welcome to Concerto Playground');

    await page.keyboard.press('Escape');
    await expect(popover(page)).toBeHidden();

    // Skipping counts as seen: a reload must not restart the tour.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Share URL' })).toBeVisible({ timeout: 15000 });
    await expect(popover(page)).toBeHidden();
  });

  test('anchors the steps to live UI containers', async ({ page }) => {
    await page.goto('/');
    await expect(popover(page)).toBeVisible({ timeout: 15000 });

    await popover(page).getByRole('button', { name: 'Next', exact: true }).click();
    await expect(popover(page)).toContainText('Concerto schema editor');
    // driver.js marks the highlighted live element instead of showing a screenshot.
    await expect(page.locator('[data-tour="cto-panel"].driver-active-element')).toBeVisible();

    await popover(page).getByRole('button', { name: 'Next', exact: true }).click();
    await expect(popover(page)).toContainText('Example models');
    await expect(page.locator('[data-tour="examples"].driver-active-element')).toBeVisible();
  });

  test('can be restarted from the toolbar Tour button', async ({ page }) => {
    await page.goto('/');
    await expect(popover(page)).toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Escape');
    await expect(popover(page)).toBeHidden();

    await page.locator('[data-tour="restart"]').click();

    await expect(popover(page)).toBeVisible();
    await expect(popover(page)).toContainText('Welcome to Concerto Playground');
  });
});
