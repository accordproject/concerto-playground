import type { Declaration } from '../../utils/graph/types';
import { declarationEqual, stringArrayEqual } from '../../utils/graph/modelDiff';

// The prop surface the custom node components actually render from. React
// Flow passes more (position, dragging, z-index), but none of it appears in
// the component output, so the comparator ignores it on purpose: React Flow
// moves the node by moving an outer wrapper it controls, the inner component
// never draws coordinates.
export interface ComparableNodeProps {
  id?: string;
  selected?: boolean;
  data: object;
}

/**
 * Shared comparison for React.memo on all custom node components. A node
 * re-renders only when something it draws changed:
 *
 * - Declaration content and edge anchors are compared structurally, field by
 *   field, because the parser creates fresh objects on every run even for
 *   identical content.
 * - Remaining data fields (label, namespace, resolved, ...) compare by
 *   strict equality.
 * - Callbacks compare by identity: a skipped render with a changed callback
 *   would leave the node acting through a stale closure, so a changed
 *   callback always forces a render.
 */
export function nodePropsEqual(
  prev: Readonly<ComparableNodeProps>,
  next: Readonly<ComparableNodeProps>,
): boolean {
  if (prev.id !== next.id || prev.selected !== next.selected) return false;
  const a = prev.data as Record<string, unknown>;
  const b = next.data as Record<string, unknown>;
  if (a === b) return true;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const av = a[key];
    const bv = b[key];
    if (av === bv) continue;
    if (key === 'declaration') {
      if (!av || !bv || !declarationEqual(av as Declaration, bv as Declaration)) return false;
      continue;
    }
    if (key === 'edgeProperties') {
      if (!stringArrayEqual(av as string[] | undefined, bv as string[] | undefined)) return false;
      continue;
    }
    // Functions land here too: identity inequality means a changed callback.
    return false;
  }
  return true;
}
