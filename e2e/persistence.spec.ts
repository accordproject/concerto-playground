import { test, expect } from '@playwright/test';

const STORAGE_KEY = 'workspace.v1';

const RESTORED_CTO = [
  'namespace org.example.restored@1.0.0',
  '',
  'concept RestoredWidget {',
  '  o String name',
  '}',
  '',
].join('\n');

test.describe('Workspace persistence', () => {
  test('writes the workspace to localStorage and shows a Last saved label', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Share URL' })).toBeVisible({ timeout: 15000 });

    // The debounced write fires 500ms after mount, then the label appears.
    await expect(page.getByText(/Last saved: /)).toBeVisible({ timeout: 10000 });

    const stored = await page.evaluate(
      (key) => JSON.parse(window.localStorage.getItem(key) ?? 'null'),
      STORAGE_KEY,
    );
    expect(stored).not.toBeNull();
    expect(typeof stored.savedAt).toBe('number');
    expect(Object.keys(stored.models).length).toBeGreaterThan(0);
    expect(Object.values(stored.models).join('')).toContain('namespace');
  });

  test('updates the stored workspace after a model change', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Vehicles' })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Vehicles' }).click();
    await page.waitForFunction(
      (key) => {
        const raw = window.localStorage.getItem(key);
        return !!raw && raw.includes('vehicle');
      },
      STORAGE_KEY,
      { timeout: 10000 },
    );
  });

  test('offers to restore a previous session and applies it on Restore', async ({ page }) => {
    await page.addInitScript(
      ([key, cto]) => {
        window.localStorage.setItem(
          key,
          JSON.stringify({ models: { 'org.example.restored@1.0.0': cto }, savedAt: 1700000000000 }),
        );
      },
      [STORAGE_KEY, RESTORED_CTO],
    );
    await page.goto('/');

    await expect(page.getByText('Restore previous session?')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Restore' }).click();

    await expect(page.getByText('Restore previous session?')).not.toBeVisible();
    // The restored model is now the active one: its declaration shows up in the UI.
    await expect(page.getByText('RestoredWidget').first()).toBeVisible({ timeout: 15000 });
  });

  test('dismisses the restore prompt without touching the current workspace', async ({ page }) => {
    await page.addInitScript(
      ([key, cto]) => {
        window.localStorage.setItem(
          key,
          JSON.stringify({ models: { 'org.example.restored@1.0.0': cto }, savedAt: 1700000000000 }),
        );
      },
      [STORAGE_KEY, RESTORED_CTO],
    );
    await page.goto('/');

    await expect(page.getByText('Restore previous session?')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Dismiss' }).click();

    await expect(page.getByText('Restore previous session?')).not.toBeVisible();
    await expect(page.getByText('RestoredWidget')).toHaveCount(0);
  });

  test('does not offer restore when a shared link hash is present', async ({ page }) => {
    // Capture a share hash first.
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Share URL' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Share URL' }).click();
    await page.waitForFunction(() => window.location.hash.length > 0, { timeout: 5000 });
    const hash = await page.evaluate(() => window.location.hash);

    await page.addInitScript(
      ([key, cto]) => {
        window.localStorage.setItem(
          key,
          JSON.stringify({ models: { 'org.example.restored@1.0.0': cto }, savedAt: 1700000000000 }),
        );
      },
      [STORAGE_KEY, RESTORED_CTO],
    );
    await page.goto('/' + hash);

    await expect(page.getByRole('button', { name: 'Share URL' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Restore previous session?')).toHaveCount(0);
  });
});
