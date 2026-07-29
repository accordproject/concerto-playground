# Concerto Playground Development Guide

## ❗ Accord Project Development Guide ❗
We'd love for you to help develop improvements to Concerto Playground! Please refer to the [Accord Project Development guidelines][apdev] we'd like you to follow.

## Concerto Playground Specific Information

### Development Setup

#### Building Concerto Playground

Concerto Playground is a static Vite + React application. You need Node.js 20 or newer.

```shell
# Clone your GitHub repository:
git clone https://github.com/<GITHUB_USERNAME>/concerto-playground.git

# Go to the Concerto Playground directory:
cd concerto-playground

# Add the main Concerto Playground repository as an upstream remote to your repository:
git remote add upstream "https://github.com/accordproject/concerto-playground.git"

# Install node.js dependencies:
npm install

# Start the development server (http://localhost:5173, hot reload):
npm run dev
```

#### Running Tests

```shell
# Typecheck and build for production:
npm run build

# Run the unit tests (Vitest):
npm run test:unit

# Run the end-to-end tests (Playwright, starts the dev server itself):
npm run test:e2e

# Debug a spec interactively:
npm run test:e2e:ui
```

> **Note:** before the first end-to-end run, download the Playwright browser with `npx playwright install chromium`.

A change is ready for review when `npm run build`, `npm run test:unit` and `npm run test:e2e` all pass.

### Project Structure

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

How the modules fit together, and the data flow between the `ctoToGraph` parser and the `graphToCto` serializer, is described in [docs/architecture.md](docs/architecture.md). The reasoning behind the core technology choices lives in [docs/adr/](docs/adr/).

### Coding Conventions

- **User-facing strings never live inline in components.** App-shell and form strings go in `src/constants/ui.ts`; the graph view keeps its catalog in `src/components/graph/strings.ts`.
- **String literals that act as identifiers** (React Flow node kinds, handle ids, dialog kinds) are typed constants in `src/utils/graph/types.ts`; add to those unions instead of scattering new literals.
- **Multi-action state belongs in a reducer** (see `src/state/workspaceReducer.ts`); plain `useState` is for simple independent UI flags.
- Branches are named `feat/us-XX-short-description` after the user story they implement; commits follow the conventional style already in the history (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).

### Pull Request Checklist

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

[apdev]: https://github.com/accordproject/techdocs/blob/master/DEVELOPERS.md
