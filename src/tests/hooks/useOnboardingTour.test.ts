// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Config, Driver, PopoverDOM } from 'driver.js';
import { useOnboardingTour, hasSeenTour } from '../../hooks/useOnboardingTour';
import { TOUR_SEEN_KEY } from '../../tour/tourSteps';

const drive = vi.fn();
const destroy = vi.fn();
const driverFactory = vi.fn((_config: Config): Partial<Driver> => ({ drive, destroy }));

vi.mock('driver.js', () => ({
  driver: (config: Config) => driverFactory(config),
}));

const ctx = { setShowCto: vi.fn(), setViewMode: vi.fn() };

function lastDriverConfig(): Config {
  const calls = driverFactory.mock.calls;
  return calls[calls.length - 1][0];
}

// Runs the popover render hook against a stub footer, the way driver.js
// does when it shows a step, and returns the footer for assertions.
function renderPopoverFooter(hasNextStep: boolean): HTMLElement {
  const config = lastDriverConfig();
  const footerButtons = document.createElement('span');
  const previousButton = document.createElement('button');
  const nextButton = document.createElement('button');
  footerButtons.append(previousButton, nextButton);
  config.onPopoverRender?.(
    { footerButtons, previousButton, nextButton } as unknown as PopoverDOM,
    {
      driver: { destroy, hasNextStep: () => hasNextStep } as unknown as Driver,
      config,
      state: {},
      index: 0,
    },
  );
  return footerButtons;
}

describe('useOnboardingTour', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('auto-starts the tour on a first visit', () => {
    renderHook(() => useOnboardingTour({ ...ctx, blockAutoStart: false }));

    expect(drive).toHaveBeenCalledTimes(1);
  });

  it('does not auto-start once the tour was seen', () => {
    localStorage.setItem(TOUR_SEEN_KEY, 'sometime');

    renderHook(() => useOnboardingTour({ ...ctx, blockAutoStart: false }));

    expect(drive).not.toHaveBeenCalled();
  });

  it('does not auto-start while blocked, then starts when unblocked', () => {
    const { rerender } = renderHook(
      ({ blocked }: { blocked: boolean }) => useOnboardingTour({ ...ctx, blockAutoStart: blocked }),
      { initialProps: { blocked: true } },
    );
    expect(drive).not.toHaveBeenCalled();

    rerender({ blocked: false });
    expect(drive).toHaveBeenCalledTimes(1);
  });

  it('startTour drives immediately even after the tour was seen', () => {
    localStorage.setItem(TOUR_SEEN_KEY, 'sometime');
    const { result } = renderHook(() => useOnboardingTour({ ...ctx, blockAutoStart: false }));

    result.current.startTour();

    expect(drive).toHaveBeenCalledTimes(1);
  });

  it('destroys the previous instance when startTour is called again', () => {
    const { result } = renderHook(() => useOnboardingTour({ ...ctx, blockAutoStart: true }));

    result.current.startTour();
    expect(destroy).not.toHaveBeenCalled();

    result.current.startTour();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(drive).toHaveBeenCalledTimes(2);
  });

  it('marks the tour as seen on any close and destroys the instance', () => {
    const { result } = renderHook(() => useOnboardingTour({ ...ctx, blockAutoStart: true }));
    result.current.startTour();

    const config = lastDriverConfig();
    expect(hasSeenTour()).toBe(false);
    config.onDestroyStarted?.(undefined, {}, {
      driver: { destroy } as unknown as Driver,
      config,
      state: {},
      index: 0,
    });

    expect(hasSeenTour()).toBe(true);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('ignores clicks on the overlay outside the popover', () => {
    const { result } = renderHook(() => useOnboardingTour({ ...ctx, blockAutoStart: true }));
    result.current.startTour();

    const config = lastDriverConfig();
    expect(typeof config.overlayClickBehavior).toBe('function');
    (config.overlayClickBehavior as () => void)();

    expect(destroy).not.toHaveBeenCalled();
    expect(hasSeenTour()).toBe(false);
  });

  it('renders an End tour button that marks the tour seen and ends it', () => {
    const { result } = renderHook(() => useOnboardingTour({ ...ctx, blockAutoStart: true }));
    result.current.startTour();

    const footer = renderPopoverFooter(true);
    const endButton = footer.querySelector<HTMLButtonElement>('.concerto-tour-end-btn');
    expect(endButton).not.toBeNull();
    expect(footer.firstElementChild).toBe(endButton);

    endButton!.click();
    expect(hasSeenTour()).toBe(true);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('does not render the End tour button on the last step', () => {
    const { result } = renderHook(() => useOnboardingTour({ ...ctx, blockAutoStart: true }));
    result.current.startTour();

    const footer = renderPopoverFooter(false);
    expect(footer.querySelector('.concerto-tour-end-btn')).toBeNull();
  });
});
