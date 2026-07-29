import { useCallback, useEffect, useRef } from 'react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { buildTourSteps, TOUR_SEEN_KEY, type TourContext } from '../tour/tourSteps';
import { TOUR_STRINGS } from '../tour/strings';

// localStorage access can throw (e.g. blocked storage in the browser). A
// broken storage reads as "seen" so the tour never nags on every load.
export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) !== null;
  } catch {
    return true;
  }
}

function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, new Date().toISOString());
  } catch {
    // Best effort: without storage the tour simply offers itself again.
  }
}

// Give Monaco and ReactFlow a moment to lay out before anchoring popovers.
const AUTO_START_DELAY_MS = 600;

export interface OnboardingTourOptions extends TourContext {
  /**
   * Suppresses the first-visit auto-start. True while the restore prompt is
   * up, in headless embeds, without the toolbar, or on shared links.
   */
  blockAutoStart: boolean;
}

/**
 * Interactive onboarding walkthrough over the live UI, powered by driver.js.
 * Auto-starts once per browser on the first visit (unless blocked) and can be
 * re-triggered any time via the returned `startTour`.
 */
export function useOnboardingTour({ blockAutoStart, ...ctx }: OnboardingTourOptions): {
  startTour: () => void;
} {
  // The context holds fresh closures each render; keep the latest without
  // retriggering the auto-start effect.
  const ctxRef = useRef<TourContext>(ctx);
  ctxRef.current = ctx;
  const tourRef = useRef<Driver | null>(null);

  const startTour = useCallback(() => {
    // The last step highlights the Tour button and driver.js keeps the
    // highlighted element clickable, so a second start while a tour is
    // active would stack two overlays. Drop the old instance first.
    tourRef.current?.destroy();
    const tour = driver({
      showProgress: true,
      overlayOpacity: 0.65,
      stagePadding: 6,
      skipMissingElement: true,
      popoverClass: 'concerto-tour',
      nextBtnText: TOUR_STRINGS.nextLabel,
      prevBtnText: TOUR_STRINGS.prevLabel,
      doneBtnText: TOUR_STRINGS.doneLabel,
      progressText: TOUR_STRINGS.progressText,
      steps: buildTourSteps(ctxRef.current),
      // Every way out (Done, the X, overlay click, Escape) counts as seen,
      // so a skipped tour never auto-starts again.
      onDestroyStarted: (_element, _step, { driver: instance }) => {
        markTourSeen();
        instance.destroy();
      },
    });
    tourRef.current = tour;
    tour.drive();
  }, []);

  useEffect(() => {
    if (blockAutoStart || hasSeenTour()) return;
    const timer = setTimeout(startTour, AUTO_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [blockAutoStart, startTour]);

  return { startTour };
}
