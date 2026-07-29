# ADR 0005: Pure reducer for workspace state

## Status

Accepted (implementation in review, see the US-12 pull request)

## Context

The orchestrator (`App.tsx`) accumulated a dozen `useState` hooks with intertwined update logic: editing a model can rename its namespace key, deleting the active namespace must activate another, loading an example swaps untouched examples but keeps edited ones. That logic lived inside `setState` callbacks in the component, was hard to follow, and was only exercisable through end-to-end tests.

## Decision

Move the workspace (open models keyed by namespace + the active namespace) behind a **pure reducer** in `src/state/workspaceReducer.ts` with one typed action per mutation the app performs. Components consume it through the `useWorkspace` hook; code generation state moved into `useCodeGeneration`. The convention, documented in `App.tsx`: multi-action state lives in a reducer, simple independent UI flags (view mode, panel visibility, transient labels) stay as plain `useState`.

## Alternatives considered

- **A state library (Zustand, Redux Toolkit, Jotai)**: adds a dependency and a second idiom for a state shape that one reducer covers; nothing here needs middleware, devtools or cross-tree stores yet. A library remains a natural upgrade path if state grows.
- **React Context + useState**: solves prop drilling (which we do not have much of) but not the real problem, which was untestable multi-step transition logic.
- **Leaving it as-is**: rejected; US-12 exists precisely because the mixture was hard to maintain.

## Consequences

- Workspace transitions are unit-tested directly (`src/tests/state/workspaceReducer.test.ts`) instead of only through Playwright.
- All workspace mutations are enumerable in one discriminated union, which makes new features (e.g. anything that adds or renames namespaces) additive and reviewable.
- Contributors must resist reaching for `useState` when a change introduces multi-action state; the convention comment in `App.tsx` and this ADR are the guardrails.
