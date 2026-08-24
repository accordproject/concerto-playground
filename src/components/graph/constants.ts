// Shared constants for the graph view.

// Fallback node dimensions used to center the viewport on a node that
// React Flow has not measured yet.
export const NODE_FALLBACK_WIDTH = 250;
export const NODE_FALLBACK_HEIGHT = 120;

// How many animation frames a focus request keeps retrying while the graph
// nodes are still being populated (e.g. right after switching to graph view)
// or while a re-measure is still on its way. Node dimension updates land at
// frame boundaries and frames can be starved on a loaded machine, so the
// budget is generous; the loop exits early as soon as it has what it needs.
export const FOCUS_NODE_MAX_RETRY_FRAMES = 120;

// Below this zoom level the graph nodes collapse to a compact summary
// (header + a one-line count) instead of rendering every property row.
export const SEMANTIC_ZOOM_THRESHOLD = 0.5;

// Zoom level the viewport animates to when focusing a node. Keep it at or
// above SEMANTIC_ZOOM_THRESHOLD so a focused node always renders full size.
export const FOCUS_ZOOM = 1;
