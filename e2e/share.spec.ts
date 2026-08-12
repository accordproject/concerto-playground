import { test, expect } from '@playwright/test';

test.describe('Share URL', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Share URL' })).toBeVisible({ timeout: 15000 });
  });

  test('should have visible Share URL button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Share URL' })).toBeVisible();
  });

  test('should keep a shareable URL hash when Share URL is clicked', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.getByRole('button', { name: 'Share URL' }).click();
    await page.waitForFunction(() => window.location.hash.length > 0, { timeout: 5000 });
    const initialHash = await page.evaluate(() => window.location.hash);
    expect(initialHash.length).toBeGreaterThan(1);

    await page.getByRole('button', { name: 'Share URL' }).click();
    const newHash = await page.evaluate(() => window.location.hash);
    expect(newHash).toBe(initialHash);
  });

  test('should copy URL to clipboard when Share URL is clicked', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.getByRole('button', { name: 'Share URL' }).click();

    await page.waitForFunction(() => window.location.hash.length > 0, { timeout: 5000 });

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('localhost:5173');
    expect(clipboardText).toContain('#');
  });

  test('should load model from a shared URL hash', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Generate a share link
    await page.getByRole('button', { name: 'Share URL' }).click();
    await page.waitForFunction(() => window.location.hash.length > 0, { timeout: 5000 });
    const hash = await page.evaluate(() => window.location.hash);

    // Navigate to root without hash, then apply hash
    await page.goto('/' + hash);

    // App should load with the shared model
    await expect(page.getByText('Concerto Schema')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Share URL' })).toBeVisible();
  });
});
