import type { DriveStep, DriverHook } from 'driver.js';
import type { ViewMode } from '../utils/urlOptions';
import { TOUR_STRINGS } from './strings';

// Kept free of runtime driver.js imports (types only) so test setups and the
// Playwright config can import the storage key without pulling in the
// library's CSS.
export const TOUR_SEEN_KEY = 'tour.v1.seen';

// The state setters the tour needs so every step's anchor actually exists:
// the CTO panel step needs the panel shown and the canvas steps need the
// graph view active.
export interface TourContext {
  setShowCto: (show: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
}

// How long a step waits for its anchor to appear after a prepare callback
// changed React state on the previous step.
const ANCHOR_WAIT_MS = 1000;

export function buildTourSteps(ctx: TourContext): DriveStep[] {
  // Overriding onNextClick suppresses the default advance, so the hook
  // applies the state change first and then moves on itself; the next step's
  // waitForElement covers the React re-render in between.
  const prepareThenNext =
    (prepare: () => void): DriverHook =>
    (_element, _step, { driver }) => {
      prepare();
      driver.moveNext();
    };

  return [
    {
      // No element: driver.js centers the popover as a welcome dialog.
      popover: {
        title: TOUR_STRINGS.welcomeTitle,
        description: TOUR_STRINGS.welcomeBody,
        onNextClick: prepareThenNext(() => {
          ctx.setShowCto(true);
          ctx.setViewMode('graph');
        }),
      },
    },
    {
      element: '[data-tour="cto-panel"]',
      waitForElement: ANCHOR_WAIT_MS,
      popover: {
        title: TOUR_STRINGS.ctoTitle,
        description: TOUR_STRINGS.ctoBody,
      },
    },
    {
      element: '[data-tour="examples"]',
      popover: {
        title: TOUR_STRINGS.examplesTitle,
        description: TOUR_STRINGS.examplesBody,
      },
    },
    {
      element: '[data-tour="view-toggle"]',
      popover: {
        title: TOUR_STRINGS.viewToggleTitle,
        description: TOUR_STRINGS.viewToggleBody,
        onNextClick: prepareThenNext(() => ctx.setViewMode('graph')),
      },
    },
    {
      element: '[data-tour="canvas"]',
      waitForElement: ANCHOR_WAIT_MS,
      popover: {
        title: TOUR_STRINGS.canvasTitle,
        description: TOUR_STRINGS.canvasBody,
      },
    },
    {
      element: '[data-tour="graph-toolbar"]',
      waitForElement: ANCHOR_WAIT_MS,
      popover: {
        title: TOUR_STRINGS.graphToolbarTitle,
        description: TOUR_STRINGS.graphToolbarBody,
      },
    },
    {
      element: '[data-tour="share"]',
      popover: {
        title: TOUR_STRINGS.shareTitle,
        description: TOUR_STRINGS.shareBody,
      },
    },
    {
      element: '[data-tour="docs"]',
      popover: {
        title: TOUR_STRINGS.docsTitle,
        description: TOUR_STRINGS.docsBody,
      },
    },
    {
      element: '[data-tour="restart"]',
      popover: {
        title: TOUR_STRINGS.restartTitle,
        description: TOUR_STRINGS.restartBody,
      },
    },
  ];
}
