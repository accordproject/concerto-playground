import { describe, it, expect, vi } from 'vitest';
import type { Driver, DriveStep } from 'driver.js';
import type { ViewMode } from '../../utils/urlOptions';
import { buildTourSteps } from '../../tour/tourSteps';

function makeContext() {
  return {
    setShowCto: vi.fn<(show: boolean) => void>(),
    setViewMode: vi.fn<(mode: ViewMode) => void>(),
  };
}

// Runs a step's onNextClick override the way driver.js would.
function clickNext(step: DriveStep, driver: Pick<Driver, 'moveNext'>) {
  step.popover?.onNextClick?.(undefined, step, {
    driver: driver as Driver,
    config: {},
    state: {},
    index: 0,
  });
}

describe('buildTourSteps', () => {
  it('gives every step a title and a description', () => {
    for (const step of buildTourSteps(makeContext())) {
      expect(step.popover?.title).toBeTruthy();
      expect(step.popover?.description).toBeTruthy();
    }
  });

  it('opens with a centered welcome step and anchors all others to data-tour selectors', () => {
    const [welcome, ...anchored] = buildTourSteps(makeContext());
    expect(welcome.element).toBeUndefined();
    for (const step of anchored) {
      expect(step.element).toMatch(/^\[data-tour="[a-z-]+"\]$/);
    }
  });

  it('shows the CTO panel and the graph view before leaving the welcome step', () => {
    const ctx = makeContext();
    const [welcome] = buildTourSteps(ctx);
    const moveNext = vi.fn();

    clickNext(welcome, { moveNext });

    expect(ctx.setShowCto).toHaveBeenCalledWith(true);
    expect(ctx.setViewMode).toHaveBeenCalledWith('graph');
    expect(moveNext).toHaveBeenCalledTimes(1);
  });

  it('returns to the graph view before highlighting the canvas', () => {
    const ctx = makeContext();
    const steps = buildTourSteps(ctx);
    const viewToggle = steps.find((s) => s.element === '[data-tour="view-toggle"]');
    const moveNext = vi.fn();

    expect(viewToggle).toBeDefined();
    clickNext(viewToggle!, { moveNext });

    expect(ctx.setViewMode).toHaveBeenCalledWith('graph');
    expect(moveNext).toHaveBeenCalledTimes(1);
  });

  it('waits for anchors that appear only after a state change', () => {
    const steps = buildTourSteps(makeContext());
    for (const selector of ['[data-tour="cto-panel"]', '[data-tour="canvas"]', '[data-tour="graph-toolbar"]']) {
      const step = steps.find((s) => s.element === selector);
      expect(step?.waitForElement).toBeGreaterThan(0);
    }
  });
});
