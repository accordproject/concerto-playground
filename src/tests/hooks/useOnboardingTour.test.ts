// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Config, Driver } from 'driver.js';
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

describe('useOnboardingTour', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-starts the tour on a first visit', () => {
    renderHook(() => useOnboardingTour({ ...ctx, blockAutoStart: false }));

    expect(drive).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(drive).toHaveBeenCalledTimes(1);
  });

  it('does not auto-start once the tour was seen', () => {
    localStorage.setItem(TOUR_SEEN_KEY, 'sometime');

    renderHook(() => useOnboardingTour({ ...ctx, blockAutoStart: false }));
    vi.runAllTimers();

    expect(drive).not.toHaveBeenCalled();
  });

  it('does not auto-start while blocked, then starts when unblocked', () => {
    const { rerender } = renderHook(
      ({ blocked }: { blocked: boolean }) => useOnboardingTour({ ...ctx, blockAutoStart: blocked }),
      { initialProps: { blocked: true } },
    );
    vi.runAllTimers();
    expect(drive).not.toHaveBeenCalled();

    rerender({ blocked: false });
    vi.runAllTimers();
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

  it('cancels the pending auto-start on unmount', () => {
    const { unmount } = renderHook(() => useOnboardingTour({ ...ctx, blockAutoStart: false }));
    unmount();
    vi.runAllTimers();

    expect(drive).not.toHaveBeenCalled();
  });
});
