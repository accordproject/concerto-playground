import { Handle, Position } from '@xyflow/react';
import { HANDLE_ID } from '../../utils/graph/types';
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

  return (
    <div
      className={`graph-node imported-node${selected ? ' selected' : ''}${resolved ? '' : ' unresolved'}`}
      onClick={clickable ? () => data.onNavigateToType?.(label, namespace) : undefined}
      style={clickable ? { cursor: 'pointer' } : undefined}
      title={resolved ? `Open ${namespace}` : `Namespace unresolved: ${namespace}`}
    >
      <Handle type="target" position={Position.Top} id={HANDLE_ID.top} className="graph-node-handle imported-node-handle" />
      <Handle type="target" position={Position.Left} id={HANDLE_ID.left} className="graph-node-handle imported-node-handle" />

      <div className="imported-node-header">
        <span className="graph-node-kind imported-node-kind">imported</span>
        {!resolved && (
          <span className="imported-node-warning">⚠ unresolved</span>
        )}
      </div>
      <div className="imported-node-name">{label}</div>
      <div className="imported-node-namespace">{namespace}</div>
    </div>
  );
}
