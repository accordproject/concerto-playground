import { test, expect } from '@playwright/test';
import LZString from 'lz-string';

// Two-namespace workspace: org.child imports a resolvable type from org.base
// and an unresolvable one from org.missing (not open in the workspace).
// BaseThing has enough properties that its full-size node is much taller than
// both the compact (semantic zoom) rendering and the unmeasured fallback size,
// so a focus computed from the wrong dimensions is visibly off center.
const BASE_CTO = `namespace org.base@1.0.0

concept BaseThing {
  o String id
  o String name
  o String description
  o Integer count
  o Double score
  o Boolean active
  o DateTime created
  o DateTime updated
  o String owner
  o String tag
}
`;

const CHILD_CTO = `namespace org.child@1.0.0

import org.base@1.0.0.{BaseThing}
import org.missing@1.0.0.Ghost

concept Kid extends BaseThing {
  o BaseThing thing
  o Ghost ghost
}
`;

// First model in the array becomes the active namespace (org.child).
const WORKSPACE_HASH = LZString.compressToEncodedURIComponent(
  JSON.stringify([CHILD_CTO, BASE_CTO]),
);

test.describe('Cross-Namespace Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#' + WORKSPACE_HASH);
    await expect(page.getByText('Concerto Schema')).toBeVisible({ timeout: 15000 });
    // Active namespace is org.child: its declaration renders as a graph node
    await expect(page.locator('.concept-node', { hasText: 'Kid' })).toBeVisible({ timeout: 10000 });
  });

  test('imported types render as foreign-namespace nodes', async ({ page }) => {
    const baseThing = page.locator('.imported-node', { hasText: 'BaseThing' });
    await expect(baseThing).toBeVisible();
    await expect(baseThing).toContainText('imported');
    await expect(baseThing).toContainText('org.base@1.0.0');
  });

  test('unresolved imported namespace shows a warning instead of crashing', async ({ page }) => {
    const ghost = page.locator('.imported-node', { hasText: 'Ghost' });
    await expect(ghost).toBeVisible();
    await expect(ghost).toContainText('unresolved');
    await expect(ghost).toHaveAttribute('title', 'Namespace unresolved: org.missing@1.0.0');

    // Clicking the unresolved node must be a no-op, not a crash
    await ghost.click();
    await expect(page.locator('.concept-node', { hasText: 'Kid' })).toBeVisible();
  });

  test('clicking a resolved imported node switches to its namespace and focuses the node', async ({ page }) => {
    await page.locator('.imported-node', { hasText: 'BaseThing' }).click();

    // Workspace switched to org.base: BaseThing is now a local graph node
    // and the viewport focuses it. This is the navigation behaviour under test;
    // checking Monaco here is flaky while its worker is loading.
    await expect(page.locator('.concept-node.selected', { hasText: 'BaseThing' })).toBeVisible({ timeout: 5000 });
  });

  test('clicking an imported type reference in the CTO editor navigates across namespaces', async ({ page }) => {
    // Click the "BaseThing" identifier inside the Monaco editor
    await page.locator('.view-lines').first().getByText('BaseThing').first().click();

    await expect(page.locator('.view-lines').first()).toContainText('org.base', { timeout: 5000 });
    await expect(page.locator('.concept-node.selected', { hasText: 'BaseThing' })).toBeVisible({ timeout: 5000 });
  });

  test('clicking an unresolved type reference in the CTO editor does nothing', async ({ page }) => {
    await page.locator('.view-lines').first().getByText('Ghost').first().click();

    // Still on org.child, app alive
    await expect(page.locator('.view-lines').first()).toContainText('org.child');
    await expect(page.locator('.concept-node', { hasText: 'Kid' })).toBeVisible();
  });

  test('focusing across namespaces centers the node even when zoomed out', async ({ page }) => {
    // Zoom out until nodes collapse to their compact summary, i.e. below the
    // semantic zoom threshold where measured node sizes are the compact ones.
    const zoomOut = page.locator('.react-flow__controls-zoomout');
    for (let i = 0; i < 20; i++) {
      await zoomOut.click();
      if (await page.locator('.graph-node-summary').first().isVisible()) break;
    }
    await expect(page.locator('.graph-node-summary').first()).toBeVisible();

    await page.locator('.imported-node', { hasText: 'BaseThing' }).click();

    const node = page.locator('.concept-node.selected', { hasText: 'BaseThing' });
    await expect(node).toBeVisible({ timeout: 5000 });

    // The viewport must settle with the node centered, not offset by the
    // difference between its compact/unmeasured size and its full size.
    const pane = page.locator('.react-flow').first();
    await expect(async () => {
      const nodeBox = await node.boundingBox();
      const paneBox = await pane.boundingBox();
      expect(nodeBox).not.toBeNull();
      expect(paneBox).not.toBeNull();
      const dx = Math.abs(nodeBox!.x + nodeBox!.width / 2 - (paneBox!.x + paneBox!.width / 2));
      const dy = Math.abs(nodeBox!.y + nodeBox!.height / 2 - (paneBox!.y + paneBox!.height / 2));
      expect(dx).toBeLessThan(60);
      expect(dy).toBeLessThan(60);
    }).toPass({ timeout: 5000 });
  });

  test('navigating back and forth keeps both graphs working', async ({ page }) => {
    await page.locator('.imported-node', { hasText: 'BaseThing' }).click();
    await expect(page.locator('.concept-node.selected', { hasText: 'BaseThing' })).toBeVisible({ timeout: 5000 });

    // Switch back to org.child via its tab
    await page.locator('div[title="org.child@1.0.0"]').click();
    await expect(page.locator('.concept-node', { hasText: 'Kid' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.imported-node', { hasText: 'BaseThing' })).toBeVisible();
  });
});
