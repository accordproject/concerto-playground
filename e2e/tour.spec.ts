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

  test('the final step opens the shortcuts popover and highlights the restart action', async ({ page }) => {
    await page.goto('/');
    await expect(popover(page)).toBeVisible({ timeout: 15000 });

    // Walk from the welcome step to the shortcuts step, then into the final one.
    for (let i = 0; i < 8; i++) {
      await popover(page).getByRole('button', { name: 'Next', exact: true }).click();
    }
    await expect(popover(page)).toContainText('Shortcuts and help');
    await popover(page).getByRole('button', { name: 'Next', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(dialog).toBeVisible();
    await expect(popover(page)).toContainText('Take the tour again');
    await expect(page.locator('[data-tour="restart"].driver-active-element')).toBeVisible();

    // Finishing the tour also puts the popover it opened away.
    await popover(page).getByRole('button', { name: 'Done', exact: true }).click();
    await expect(popover(page)).toBeHidden();
    await expect(dialog).toBeHidden();
  });

  test('can be restarted from the keyboard shortcuts popover', async ({ page }) => {
    await page.goto('/');
    await expect(popover(page)).toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Escape');
    await expect(popover(page)).toBeHidden();

    await page.getByRole('button', { name: 'Show keyboard shortcuts' }).click();
    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Take the tour again' }).click();

    // The overlay yields to the tour so the highlighted elements stay reachable.
    await expect(dialog).toBeHidden();
    await expect(popover(page)).toBeVisible();
    await expect(popover(page)).toContainText('Welcome to Concerto Playground');
  });
});
