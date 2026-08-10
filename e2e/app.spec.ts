import { test, expect } from '@playwright/test';

test.describe('App Loading', () => {
  test('should load the app and show the header', async ({ page }) => {
    await page.goto('/');

    const logo = page.getByRole('img', { name: 'Accord Project' }).first();
    await expect(logo).toBeVisible({ timeout: 15000 });
  });

  test('should show the toolbar with CTO toggle and example buttons', async ({ page }) => {
    await page.goto('/');

    // The main toolbar CTO toggle title starts with "Hide CTO panel" (distinct from
    // graph toolbar's "Hide CTO text"); prefix match because it also carries the shortcut hint.
    await expect(page.locator('button[title^="Hide CTO panel"]')).toBeVisible({ timeout: 15000 });

    // Example buttons
    await expect(page.getByRole('button', { name: 'NDA' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vehicles' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Service Agreement' })).toBeVisible();
  });

  test('should show the view mode toggle buttons', async ({ page }) => {
    await page.goto('/');
    // Use .first() because ReactFlow renders additional elements that may include "Graph"
    await expect(page.getByRole('button', { name: 'Graph' }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Form' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Code' })).toBeVisible();
  });

  test('should show Share URL button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Share URL' })).toBeVisible({ timeout: 15000 });
  });

  test('should show CTO editor panel by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Concerto Schema')).toBeVisible({ timeout: 15000 });
  });

  test('should show status bar with Accord Project branding', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Accord Project — Concerto Playground')).toBeVisible({ timeout: 15000 });
  });

  test('should show Docs and GitHub links in status bar', async ({ page }) => {
    await page.goto('/');

    const docsLink = page.getByRole('link', { name: 'Docs' });
    await expect(docsLink).toBeVisible({ timeout: 15000 });
    await expect(docsLink).toHaveAttribute('href', 'https://concerto.accordproject.org/docs/intro');

    // Status bar has a GitHub link (last one since header also has GitHub)
    const githubLinks = page.getByRole('link', { name: 'GitHub' });
    await expect(githubLinks.last()).toBeVisible();
  });
});

test.describe('Header Links', () => {
  test('should have GitHub link in header', async ({ page }) => {
    await page.goto('/');

    const githubLink = page.getByRole('link', { name: /GitHub/i }).first();
    await expect(githubLink).toBeVisible({ timeout: 15000 });
    await expect(githubLink).toHaveAttribute('href', 'https://github.com/accordproject/concerto-playground');
  });

  test('should have Discord link in header', async ({ page }) => {
    await page.goto('/');

    const discordLink = page.getByRole('link', { name: /Discord/i });
    await expect(discordLink).toBeVisible({ timeout: 15000 });
    await expect(discordLink).toHaveAttribute('href', 'https://discord.com/invite/Zm99SKhhtA');
  });

  test('home link navigates to root', async ({ page }) => {
    await page.goto('/');

    const homeLink = page.locator('header a').first();
    await expect(homeLink).toHaveAttribute('href', '/');
  });
});
