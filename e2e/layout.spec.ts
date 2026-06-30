import { test, expect, type Page } from '@playwright/test';
async function getNodeTransforms(page: Page): Promise<string[]> {
  return page.locator('.react-flow__node').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('style') || ''),
  );
}

test.describe('Graph layout actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Vehicles' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Vehicles' }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(8, { timeout: 15000 });
  });

  test('auto layout changes positions and nodes remain draggable', async ({ page }) => {
    const before = await getNodeTransforms(page);

    const autoLayoutButton = page.getByRole('button', { name: 'Auto layout' });
    await autoLayoutButton.click();
    await expect
      .poll(async () => JSON.stringify(await getNodeTransforms(page)))
      .not.toBe(JSON.stringify(before));

    const firstNode = page.locator('.react-flow__node').first();
    const beforeDrag = await firstNode.getAttribute('style');
    const box = await firstNode.boundingBox();
    if (!box) {
      throw new Error('Expected a graph node bounding box');
    }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30);
    await page.mouse.up();

    await expect
      .poll(async () => await firstNode.getAttribute('style'))
      .not.toBe(beforeDrag);
  });

  test('save layout writes Position decorators and restores them after reload', async ({ page }) => {
    const autoLayoutButton = page.getByRole('button', { name: 'Auto layout' });
    await autoLayoutButton.click();
    await expect(autoLayoutButton).toBeEnabled();
    await page.getByRole('button', { name: 'Save layout' }).click();

    const savedTransforms = await getNodeTransforms(page);
    await expect.poll(() => page.url()).toContain('#');
    await expect(page.locator('.monaco-editor')).toContainText('@Position(');

    await page.reload();
    await expect(page.locator('.react-flow__node')).toHaveCount(8, { timeout: 15000 });
    expect(await getNodeTransforms(page)).toEqual(savedTransforms);
  });
});
