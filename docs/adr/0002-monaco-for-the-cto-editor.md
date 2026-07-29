# ADR 0002: Monaco Editor for the CTO text editor

## Status

Accepted

## Context

The CTO text panel is a first-class editing surface, not a read-only viewer: it needs syntax highlighting for the Concerto language, inline error markers from validation, clickable type references that navigate to graph nodes, and a familiar editing experience (undo stack, keyboard shortcuts, find). The same editor component is reused read-only for every generated-code tab (TypeScript, JSON Schema, Java, ...), so it must highlight many languages out of the box.

## Decision

Use **Monaco Editor** via `@monaco-editor/react` (see `src/components/Editor.tsx`). A custom Monarch tokenizer registers the `concerto` language; validation errors are surfaced as Monaco markers, and type references become link targets that call back into the app for navigation.

## Alternatives considered

- **CodeMirror 6**: lighter bundle and solid extension system, but we would write and maintain more integration code for markers, link navigation and the many read-only output languages that Monaco ships with built-in.
- **Plain `<textarea>` + highlight overlay** (e.g. Prism-based): no marker/навigation support and a fragile scroll-sync overlay model; fine for snippets, not for a primary editor.

## Consequences

- Editing feels like VS Code, which is what most contributors expect, and every codegen output tab gets highlighting for free.
- Monaco is by far the heaviest dependency in the bundle (its workers dominate the build output). This is accepted for an editor-centric app; language workers are split into separate chunks by the build.
- The custom Concerto tokenizer lives with us; grammar changes in Concerto require updating it.
