# Architecture Decision Records

Short documents capturing the significant technology and design decisions of the Concerto Playground: the context at the time, the decision, the alternatives that were considered, and the consequences we accepted.

| ADR | Decision |
| --- | --- |
| [0001](0001-react-flow-for-the-graph-canvas.md) | React Flow (@xyflow/react) for the visual graph canvas |
| [0002](0002-monaco-for-the-cto-editor.md) | Monaco Editor for the CTO text editor |
| [0003](0003-driver-js-for-the-onboarding-tour.md) | driver.js for the onboarding tour |
| [0004](0004-localstorage-and-url-hash-persistence.md) | localStorage persistence and URL-hash sharing instead of a backend |
| [0005](0005-pure-reducer-for-workspace-state.md) | Pure reducer for workspace state |

## Adding a new ADR

Create `NNNN-short-title.md` with the next free number and the sections used by the existing records: **Status**, **Context**, **Decision**, **Alternatives considered**, **Consequences**. Add it to the table above. An ADR is written when the decision is made; if a decision is later reversed, write a new ADR that supersedes the old one instead of editing history.
