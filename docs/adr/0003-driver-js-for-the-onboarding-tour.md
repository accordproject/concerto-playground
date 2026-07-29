# ADR 0003: driver.js for the onboarding tour

## Status

Accepted (implementation in review, see the US-11 pull request)

## Context

US-11 asks for an interactive first-visit walkthrough that anchors to and highlights live UI containers instead of static screenshots. The issue suggested Intro.js or TourGuide JS. The playground is an Apache-2.0 Linux Foundation project, so any bundled dependency must be license-compatible; the tour also needs to wait for anchors that appear only after a state change (e.g. switching to the graph view mid-tour).

## Decision

Use **driver.js** (MIT, ~5 kB gzipped, zero dependencies). It provides live element anchoring by selector, `waitForElement` for anchors that render after a state change, `skipMissingElement` for resilience, per-step hooks (used to switch views before highlighting), keyboard control and progress display.

## Alternatives considered

- **Intro.js** (suggested in the issue): ruled out on licensing. It is AGPL-3.0 with a paid commercial license; bundling it would impose AGPL obligations on downstream users of an Apache-2.0 project.
- **Shepherd.js**: same problem since v11, when it moved from MIT to AGPL-3.0 with commercial licensing.
- **TourGuide JS** (also suggested): MIT, so viable, but a much smaller project with a limited community and track record; for an onboarding layer that must survive UI refactors, maturity won.
- **react-joyride**: React-specific and heavier (brings its own positioning dependencies); the tour only needs DOM-level anchoring, so coupling it to React buys nothing.

## Consequences

- Tour steps anchor on dedicated `data-tour="..."` attributes, decoupled from styling and text changes.
- The "seen" flag lives in localStorage, so first-visit detection is per browser; incognito or another device shows the tour again. Accepted trade-off for a playground without accounts.
- Playwright seeds the seen flag for all specs so the tour overlay never interferes with unrelated e2e tests.
