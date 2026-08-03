import { Handle, Position, useStore } from '@xyflow/react';
import { HANDLE_ID } from '../../utils/graph/types';
import { SEMANTIC_ZOOM_THRESHOLD } from './constants';
import { NODE_STRINGS } from './strings';
import './graph.css';

interface ImportedNodeData {
  label: string;
  namespace: string;
  resolved: boolean;
  onNavigateToType?: (name: string, namespace: string) => void;
}

/**
 * Placeholder node for a type that lives in another namespace (brought in via
 * an import or a qualified reference). Resolved nodes navigate to the owning
 * namespace on click; unresolved ones show a "Namespace unresolved" warning.
 */
export function ImportedNode({ data, selected }: { data: ImportedNodeData; selected?: boolean }) {
  const { label, namespace, resolved } = data;
  const clickable = resolved && !!data.onNavigateToType;
  // Same semantic zoom as the other node types: below the threshold only the
  // kind badge and the name render; the namespace line and warning collapse
  // (the tooltip still carries the full information).
  const showFull = useStore((s) => s.transform[2] >= SEMANTIC_ZOOM_THRESHOLD);

  return (
    <div
      className={`graph-node imported-node${selected ? ' selected' : ''}${resolved ? '' : ' unresolved'}`}
      onClick={clickable ? () => data.onNavigateToType?.(label, namespace) : undefined}
      style={clickable ? { cursor: 'pointer' } : undefined}
      title={resolved ? NODE_STRINGS.openNamespaceTooltip(namespace) : NODE_STRINGS.unresolvedNamespaceTooltip(namespace)}
    >
      <Handle type="target" position={Position.Top} id={HANDLE_ID.top} className="graph-node-handle imported-node-handle" />
      <Handle type="target" position={Position.Left} id={HANDLE_ID.left} className="graph-node-handle imported-node-handle" />

      <div className="imported-node-header">
        <span className="graph-node-kind imported-node-kind">{NODE_STRINGS.importedBadge}</span>
        {showFull && !resolved && (
          <span className="imported-node-warning">{NODE_STRINGS.unresolvedBadge}</span>
        )}
      </div>
      <div className="imported-node-name">{label}</div>
      {showFull && <div className="imported-node-namespace">{namespace}</div>}
    </div>
  );
}
