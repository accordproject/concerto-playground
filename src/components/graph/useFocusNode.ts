import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

/**
 * Returns a function that centers the viewport on a node by id and marks it
 * selected (so it gets the highlight ring). Used by the node search palette and
 * by clickable type references in the CTO editor.
 */
export function useFocusNode() {
  const { getNode, setCenter, setNodes } = useReactFlow();

  return useCallback((name: string) => {
    const node = getNode(name);
    if (!node) return;
    const width = node.measured?.width ?? 250;
    const height = node.measured?.height ?? 120;
    void setCenter(node.position.x + width / 2, node.position.y + height / 2, {
      zoom: 1,
      duration: 500,
    });
    setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === name })));
  }, [getNode, setCenter, setNodes]);
}
