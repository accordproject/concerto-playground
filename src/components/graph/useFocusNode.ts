import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  FOCUS_NODE_MAX_RETRY_FRAMES,
  NODE_FALLBACK_HEIGHT,
  NODE_FALLBACK_WIDTH,
} from './constants';

/**
 * Returns a function that centers the viewport on a node by id and marks it
 * selected (so it gets the highlight ring). Used by the node search palette and
 * by clickable type references in the CTO editor.
 */
export function useFocusNode() {
  const { getNode, setCenter, setNodes } = useReactFlow();

  return useCallback((name: string) => {
    // A focus request from the CTO editor can arrive before the graph has
    // populated its nodes (first render after switching views), so retry
    // across a few animation frames instead of dropping the request.
    let framesLeft = FOCUS_NODE_MAX_RETRY_FRAMES;
    const tryFocus = () => {
      const node = getNode(name);
      if (!node) {
        framesLeft -= 1;
        if (framesLeft > 0) requestAnimationFrame(tryFocus);
        return;
      }
      const width = node.measured?.width ?? NODE_FALLBACK_WIDTH;
      const height = node.measured?.height ?? NODE_FALLBACK_HEIGHT;
      void setCenter(node.position.x + width / 2, node.position.y + height / 2, {
        zoom: 1,
        duration: 500,
      });
      // Only recreate the nodes whose selected flag actually changes.
      setNodes((ns) =>
        ns.map((n) => {
          const shouldSelect = n.id === name;
          return n.selected === shouldSelect ? n : { ...n, selected: shouldSelect };
        }),
      );
    };
    tryFocus();
  }, [getNode, setCenter, setNodes]);
}
