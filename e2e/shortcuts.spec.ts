import { test, expect } from '@playwright/test';

// The shortcuts overlay is a modal layer: while it is open, background
// shortcuts must not fire, Escape must close only the topmost layer, and
// focus must stay inside the dialog and return to the opener on close.

test.describe('Shortcut layers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Concerto Schema')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 15000 });
  });

  test('background shortcuts are suppressed while the overlay is open', async ({ page }) => {
    await page.keyboard.press('Shift+Slash');
    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(dialog).toBeVisible();

    // The view switch and node search shortcuts must not reach the layers
    // behind the modal dialog.
    await page.keyboard.press('2');
    await page.keyboard.press('Control+k');
    await expect(dialog).toBeVisible();
    await expect(page.locator('.node-search-panel')).toHaveCount(0);
    await expect(page.locator('.react-flow__node').first()).toBeVisible();

    // One Escape closes only the overlay; the same shortcuts work again.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.keyboard.press('Control+k');
    await expect(page.locator('.node-search-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.node-search-panel')).toHaveCount(0);
    await expect(page.locator('.react-flow__node').first()).toBeVisible();
  });

  test('the overlay takes focus, traps Tab and restores focus on close', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Show keyboard shortcuts' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(dialog).toBeVisible();

    const closeButton = page.getByRole('button', { name: 'Close shortcuts overlay' });
    await expect(closeButton).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(closeButton).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(closeButton).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('pressing ? or Ctrl+/ again closes the overlay', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });

    await page.keyboard.press('Shift+Slash');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Shift+Slash');
    await expect(dialog).toBeHidden();

    await page.keyboard.press('Control+/');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Control+/');
    await expect(dialog).toBeHidden();
  });
});
