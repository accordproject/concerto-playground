import { createContext, useContext } from 'react';

/**
 * Whether graph nodes render their full body or the collapsed summary.
 *
 * The value is owned by the graph editor and only flips when the viewport
 * settles (onMoveEnd), never mid-gesture or mid-animation: flipping all nodes
 * at once while the camera is moving re-renders the whole graph in a single
 * frame and makes zooms and focus animations stutter on large models.
 */
export const SemanticZoomContext = createContext(true);

export function useSemanticZoom(): boolean {
  return useContext(SemanticZoomContext);
}
