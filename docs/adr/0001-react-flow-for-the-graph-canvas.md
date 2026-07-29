# ADR 0001: React Flow (@xyflow/react) for the visual graph canvas

## Status

Accepted

## Context

The playground's central feature is a visual, editable diagram of a Concerto model: every declaration is a node, and properties, relationships and inheritance are edges. The canvas must support custom-rendered nodes (property rows, badges, inline add/delete buttons), drag-to-connect gestures, pan/zoom with semantic zoom (nodes collapse to summaries when zoomed out), and programmatic focus/centering. The rest of the app is React, and node content is interactive UI, not just shapes.

## Decision

Use **React Flow** (`@xyflow/react`, MIT) as the graph canvas. Nodes and edges are plain React components registered in `nodeTypes` / `edgeTypes` (see `src/components/graph/`), so node UI shares the same rendering model, state and styling as the rest of the app.

## Alternatives considered

- **Custom D3 / SVG canvas**: maximum control, but we would re-implement panning, zooming, hit-testing, edge routing and connection gestures ourselves; node content rendered outside React would split the UI into two paradigms.
- **Cytoscape.js**: strong for large read-only graph analysis, but nodes are canvas-drawn, so interactive React content inside nodes (buttons, editable rows) does not fit its model.
- **JointJS**: closest feature match, but the full-featured version is commercial and the open-source core would still keep node rendering outside React.

## Consequences

- Node UI is ordinary React: the property rows, badges and add buttons in `ConceptNode`/`EnumNode`/etc. are components with props, testable like any other component.
- We accept React Flow's model of registering node/edge kinds by string key; those keys are typed constants (`GRAPH_NODE_KIND`, `GRAPH_EDGE_KIND` in `src/utils/graph/types.ts`) so the registry and the graph builder cannot drift apart.
- Rendering hundreds of DOM-based nodes is heavier than a canvas renderer; semantic zoom (collapsing nodes below a zoom threshold) keeps large models usable.
