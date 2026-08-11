import { test, expect, type Page } from '@playwright/test';
import LZString from 'lz-string';

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
    await expect(autoLayoutButton).toBeEnabled();
    await expect
      .poll(async () => JSON.stringify(await getNodeTransforms(page)))
      .not.toBe(JSON.stringify(before));
    await page.waitForTimeout(250);

    const vehicleNode = page.locator('.react-flow__node[data-id="Vehicle"]');
    const beforeDrag = await vehicleNode.getAttribute('style');
    const box = await vehicleNode.boundingBox();
    if (!box) {
      throw new Error('Expected a graph node bounding box');
    }

    const startX = box.x + box.width / 2;
    const startY = box.y + Math.min(48, box.height / 3);
    const endX = startX + 120;
    const endY = startY + 80;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 12 });
    await page.mouse.up();

    await expect
      .poll(async () => await vehicleNode.getAttribute('style'))
      .not.toBe(beforeDrag);
  });

  test('save layout writes Position decorators and restores them after reload', async ({ page }) => {
    const autoLayoutButton = page.getByRole('button', { name: 'Auto layout' });
    await autoLayoutButton.click();
    await expect(autoLayoutButton).toBeEnabled();
    await page.getByRole('button', { name: 'Save layout' }).click();

    const savedTransforms = await getNodeTransforms(page);
    await expect(page.locator('.monaco-editor')).toContainText('@Position(');
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem('workspace.v1')?.includes('@Position(')))
      .toBe(true);

    await page.reload();
    await page.getByRole('button', { name: 'Restore' }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(8, { timeout: 15000 });
    expect(await getNodeTransforms(page)).toEqual(savedTransforms);
  });

  test('keeps a 25-node layout at a readable zoom', async ({ page }) => {
    const declarations = Array.from({ length: 25 }, (_, index) => {
      const properties = [
        index < 24 ? `  o Node${index + 1} next` : '',
        index < 22 ? `  o Node${index + 2} alternate` : '',
      ].filter(Boolean).join('\n');
      return `concept Node${index} {\n${properties}\n}`;
    }).join('\n\n');
    const cto = `namespace org.layout@1.0.0\n\n${declarations}`;

    await page.goto('/#' + LZString.compressToEncodedURIComponent(JSON.stringify([cto])));
    await page.reload();
    await expect(page.locator('.react-flow__node')).toHaveCount(25, { timeout: 15000 });

    const autoLayoutButton = page.getByRole('button', { name: 'Auto layout' });
    await autoLayoutButton.click();
    await expect(autoLayoutButton).toBeEnabled();
    await expect
      .poll(() => page.locator('.react-flow__viewport').evaluate((element) =>
        new DOMMatrix(getComputedStyle(element).transform).a
      ))
      .toBeGreaterThanOrEqual(0.5);

    const metrics = await page.evaluate(() => {
      const viewport = document.querySelector('.react-flow__viewport');
      const nodeElements = Array.from(document.querySelectorAll('.react-flow__node'));
      if (!viewport || nodeElements.length === 0) throw new Error('Expected a rendered graph');

      const zoom = new DOMMatrix(getComputedStyle(viewport).transform).a;
      const nodes = nodeElements.map((element) => element.getBoundingClientRect());
      let overlapCount = 0;

      for (let index = 0; index < nodes.length; index += 1) {
        for (let other = index + 1; other < nodes.length; other += 1) {
          const first = nodes[index];
          const second = nodes[other];
          if (
            first.left < second.right && first.right > second.left &&
            first.top < second.bottom && first.bottom > second.top
          ) {
            overlapCount += 1;
          }
        }
      }

      return {
        edgeCount: document.querySelectorAll('.react-flow__edge').length,
        overlapCount,
        minRenderedNodeWidth: Math.min(...nodes.map((node) => node.width)),
        layoutWidth: (
          Math.max(...nodes.map((node) => node.right)) -
          Math.min(...nodes.map((node) => node.left))
        ) / zoom,
        layoutHeight: (
          Math.max(...nodes.map((node) => node.bottom)) -
          Math.min(...nodes.map((node) => node.top))
        ) / zoom,
      };
    });

    expect(metrics.edgeCount).toBe(46);
    expect(metrics.overlapCount).toBe(0);
    expect(metrics.minRenderedNodeWidth).toBeGreaterThanOrEqual(120);
    expect(metrics.layoutWidth).toBeLessThanOrEqual(2500);
    expect(metrics.layoutHeight).toBeLessThanOrEqual(2500);
  });
});
