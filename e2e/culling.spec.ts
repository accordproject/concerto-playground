import { test, expect } from '@playwright/test';
import LZString from 'lz-string';
import { generateStressModel } from '../src/utils/testing/stressModel';

// Viewport culling: off-screen nodes must be removed from the DOM entirely,
// not just drawn outside the visible area.
const DECLARATIONS = 60;
const MODEL_HASH = LZString.compressToEncodedURIComponent(generateStressModel(DECLARATIONS));

test.describe('Viewport culling', () => {
  test('unmounts nodes that leave the viewport when zooming in', async ({ page }) => {
    await page.goto('/#' + MODEL_HASH);
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 30000 });

    // Let the initial fitView settle. The graph is larger than the viewport
    // can show even at minimum zoom, so culling may already hold back part of
    // the model here; the DOM must never hold more nodes than declared.
    await page.waitForTimeout(2000);
    const initialCount = await page.locator('.react-flow__node').count();
    expect(initialCount).toBeGreaterThan(0);
    expect(initialCount).toBeLessThanOrEqual(DECLARATIONS);

    // Zoom in hard: most of the graph leaves the viewport and its nodes must
    // disappear from the DOM, not merely from view.
    const zoomIn = page.locator('.react-flow__controls-zoomin');
    for (let i = 0; i < 10; i++) {
      await zoomIn.click();
    }
    await expect(async () => {
      const mounted = await page.locator('.react-flow__node').count();
      expect(mounted).toBeLessThan(initialCount / 2);
    }).toPass({ timeout: 15000 });
  });
});
