import { useCallback } from 'react';
import { useReactFlow, type Node } from '@xyflow/react';
import {
  FOCUS_NODE_MAX_RETRY_FRAMES,
  FOCUS_ZOOM,
  NODE_FALLBACK_HEIGHT,
  NODE_FALLBACK_WIDTH,
  SEMANTIC_ZOOM_THRESHOLD,
} from './constants';

/**
 * Returns a function that centers the viewport on a node by id and marks it
 * selected (so it gets the highlight ring). Used by the node search palette and
 * by clickable type references in the CTO editor.
 */
export function useFocusNode() {
  const { getNode, getViewport, setCenter, setNodes } = useReactFlow();

  return useCallback((name: string) => {
    const measuredDims = (node: Node) => ({
      width: node.measured?.width ?? NODE_FALLBACK_WIDTH,
      height: node.measured?.height ?? NODE_FALLBACK_HEIGHT,
    });
    const centerOn = (node: Node, duration: number) => {
      const { width, height } = measuredDims(node);
      return setCenter(node.position.x + width / 2, node.position.y + height / 2, {
        zoom: FOCUS_ZOOM,
        duration,
      });
    };

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
      // The measured dimensions are only final when the node was measured at
      // a zoom where it renders full size. Below the semantic zoom threshold
      // it is measured collapsed, and right after a namespace switch it has
      // no measurements at all; in both cases the computed center is off once
      // the node expands at FOCUS_ZOOM, so re-center after the animation with
      // the settled measurements.
      const dimsAreFinal =
        node.measured != null && getViewport().zoom >= SEMANTIC_ZOOM_THRESHOLD;
      const usedDims = measuredDims(node);
      const animation = centerOn(node, 500);
      if (!dimsAreFinal) {
        void animation.then((finished) => {
          // The user interrupted the animation (pan/zoom): leave them alone.
          if (finished === false) return;
          let correctionFrames = FOCUS_NODE_MAX_RETRY_FRAMES;
          const correct = () => {
            if (Math.abs(getViewport().zoom - FOCUS_ZOOM) > 0.01) return;
            const settled = getNode(name);
            if (!settled?.measured) return;
            const dims = measuredDims(settled);
            if (dims.width === usedDims.width && dims.height === usedDims.height) {
              // Not re-measured yet, or the full size matches what we used
              // (then the first centering was already right); wait a bit more.
              correctionFrames -= 1;
              if (correctionFrames > 0) requestAnimationFrame(correct);
              return;
            }
            void centerOn(settled, 150);
          };
          requestAnimationFrame(correct);
        });
      }
      // Only recreate the nodes whose selected flag actually changes.
      setNodes((ns) =>
        ns.map((n) => {
          const shouldSelect = n.id === name;
          return n.selected === shouldSelect ? n : { ...n, selected: shouldSelect };
        }),
      );
    };
    tryFocus();
  }, [getNode, getViewport, setCenter, setNodes]);
}
