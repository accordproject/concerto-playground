# Accord Project Concerto Playground Contribution Guide

We'd love for you to contribute to our source code and to make Concerto technology even better than it is today! Please also refer to the org-wide [Accord Project Contribution guidelines][apcontribute] we'd like you to follow.

This guide covers everything specific to this repository: getting the playground running locally, validating your changes, and opening a pull request that is easy to review.

For an overview of how the codebase fits together, read [docs/architecture.md](docs/architecture.md). The reasoning behind the core technology choices lives in [docs/adr/](docs/adr/).

## Discord

The main channel for support with Concerto Playground is the [Accord Project Discord Community][apdiscord].

## Local environment setup

Prerequisites:

- **Node.js 20 or newer** (Vite 8 requires it)
- **npm** (ships with Node)

Setup:

```bash
git clone https://github.com/accordproject/concerto-playground.git
cd concerto-playground
npm install
npm run dev
```

The dev server starts on <http://localhost:5173> with hot reload.

Before running the end-to-end tests for the first time, download the Playwright browser:

```bash
npx playwright install chromium
```

## Validation scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | TypeScript typecheck (`tsc`) followed by a production Vite build |
| `npm run test:unit` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright; starts the dev server itself) |
| `npm run test:e2e:ui` | Playwright in interactive UI mode, useful for debugging a spec |
| `npm run preview` | Serves the production build locally |

A change is ready for review when `npm run build`, `npm run test:unit` and `npm run test:e2e` all pass.

## Project structure

```
src/
  App.tsx              Orchestrator: wires the workspace, views and toolbar together
  components/
    Editor.tsx         Monaco editor with the custom Concerto language
    OutputTabs.tsx     Generated-code panel (one tab per target language)
    graph/             React Flow canvas: nodes, edges, toolbar, search
    form/              Tree + property-sheet editing view
  state/               Pure reducers (workspace state)
  hooks/               React hooks (workspace, codegen, persistence)
  utils/graph/         ctoToGraph parser and graphToCto serializer
  codegen/             Code generation via @accordproject/concerto-codegen
  constants/ui.ts      Centralized UI strings for the app shell and form view
  tests/               Unit tests, mirroring the src/ layout
e2e/                   Playwright specs
docs/                  Architecture overview and ADRs
```

Conventions to follow:

- **User-facing strings never live inline in components.** App-shell and form strings go in `src/constants/ui.ts`; the graph view keeps its catalog in `src/components/graph/strings.ts`.
- **String literals that act as identifiers** (React Flow node kinds, handle ids, dialog kinds) are typed constants in `src/utils/graph/types.ts`; add to those unions instead of scattering new literals.
- **Multi-action state belongs in a reducer** (see `src/state/workspaceReducer.ts`); plain `useState` is for simple independent UI flags.
- Branches are named `feat/us-XX-short-description` after the user story they implement; commits follow the conventional style already in the history (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).

## Pull request checklist

Before requesting review:

- [ ] `npm run build` passes (typecheck + production build)
- [ ] `npm run test:unit` and `npm run test:e2e` pass locally
- [ ] New behavior is covered by unit tests, and by an e2e spec when it spans a user flow
- [ ] User-facing texts live in the string catalogs, not inline in components
- [ ] No dead code, commented-out blocks or leftover debug output
- [ ] New dependencies are justified in the PR description, license-compatible with Apache-2.0, and pinned in the lockfile
- [ ] The PR does one thing; unrelated cleanups go in their own PR
- [ ] The PR description explains what changed and why, and links the issue it closes

For reviewers:

- Check correctness first (edge cases, error handling), then tests, then readability.
- Distinguish blocking comments from nits; prefix non-blocking ones with `nit:`.
- Suggest alternatives instead of only critiquing, and approve when you would be comfortable owning the code.

## License

By contributing you agree that your contributions are licensed under the Apache-2.0 license that covers the project.

[apcontribute]: https://github.com/accordproject/techdocs/blob/master/CONTRIBUTING.md
[apdiscord]: https://discord.com/invite/Zm99SKhhtA
