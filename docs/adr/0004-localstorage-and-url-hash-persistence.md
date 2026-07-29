# ADR 0004: localStorage persistence and URL-hash sharing instead of a backend

## Status

Accepted

## Context

Users lose work if a refresh or crash wipes the editor, and they want to share a model with a colleague by sending a link. The playground is a static site with no server component, no accounts and no database, and we want to keep it that way: zero hosting cost beyond static files, no PII, nothing to operate.

## Decision

Two complementary mechanisms, both client-side:

- **Session persistence**: the open models are saved to localStorage (key `workspace.v1`), debounced, by `src/hooks/useWorkspacePersistence.ts`. On startup, if a snapshot differs from what loaded, a banner offers to restore it; the snapshot is not overwritten until the user chooses Restore or Dismiss.
- **Sharing**: the Share button compresses all open models with `lz-string` into the URL hash. Single-model workspaces encode the plain CTO string (backward compatible with older links); multi-model workspaces encode a JSON array. Opening a shared link takes precedence over the localStorage snapshot.

## Alternatives considered

- **Backend with saved documents / short links**: real cross-device persistence and short URLs, but requires a service, storage, auth and operational ownership; out of scope for a playground.
- **IndexedDB**: more storage than localStorage, async API, but the workspace payload is small text; localStorage's simplicity wins and its quota is not a realistic limit here.
- **Uncompressed URL parameters**: URLs blow past practical length limits quickly; lz-string keeps realistic models within them.

## Consequences

- Persistence is per browser: another device or a cleared profile starts fresh. Accepted for an account-less tool.
- Shared URLs carry the entire model; very large multi-namespace workspaces can exceed URL length limits in some contexts (chat apps, older proxies).
- localStorage can be unavailable (private mode, blocked storage); the persistence hook reports save failures in a banner instead of failing silently.
