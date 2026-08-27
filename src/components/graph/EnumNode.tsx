import { Handle, Position } from '@xyflow/react';
import type { Declaration } from '../../utils/graph/types';
import { HANDLE_ID } from '../../utils/graph/types';
import { getCompactHandleTop, type GraphTargetHandle } from '../../utils/graph/nodeLayout';
import { useSemanticZoom } from './semanticZoom';
import { KindBadge } from './KindBadge';
import './graph.css';

interface EnumNodeData {
  label: string;
  declaration: Declaration;
  incomingHandles?: GraphTargetHandle[];
  onAddEnumValue?: (declName: string) => void;
  onDeleteEnumValue?: (declName: string, value: string) => void;
  onDeleteDeclaration?: (declName: string) => void;
}

export function EnumNode({ data, selected }: { data: EnumNodeData; selected?: boolean }) {
  const { declaration } = data;
  const incomingHandles = data.incomingHandles ?? [];
  const showFull = useSemanticZoom();
  const valueCount = declaration.enumValues.length;

  return (
    <div className={`graph-node enum-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Top} id={HANDLE_ID.top} className="graph-node-handle enum-node-handle graph-node-target-dot" />
      <Handle type="target" position={Position.Left} id={HANDLE_ID.left} className="graph-node-handle enum-node-handle graph-node-target-dot" />
      {/* Enums cannot own properties or extend another type, so nothing can
          be dragged out of them. The handles stay for edge geometry. */}
      <Handle type="source" position={Position.Right} id={HANDLE_ID.right} className="graph-node-handle graph-node-plus-handle"
        isConnectable={false} style={{ '--plus-accent': '#ecc94b' } as React.CSSProperties} />
      {incomingHandles.map((handle, index) => (
        <Handle key={handle.id} type="target" position={Position.Left} id={handle.id}
          className="graph-node-handle enum-node-handle"
          style={{
            top: getCompactHandleTop(index, incomingHandles.length),
          }} />
      ))}

      <div className="enum-node-header">
        <div className="graph-node-header-row">
          <KindBadge kind="enum" className="enum-node-kind" />
          <button onClick={() => data.onDeleteDeclaration?.(declaration.name)}
            className="graph-node-delete-btn">
            &times;
          </button>
        </div>
        <div className="enum-node-name">
          {declaration.name}
        </div>
      </div>

      {!showFull && (
        <div className="graph-node-summary">
          {valueCount} {valueCount === 1 ? 'value' : 'values'}
        </div>
      )}

      {showFull && (
      <div className="graph-node-body">
        {declaration.enumValues.map((val) => (
          <div key={val} className="enum-node-value">
            <span className="enum-node-value-label">{val}</span>
            <button onClick={() => data.onDeleteEnumValue?.(declaration.name, val)}
              className="graph-node-row-delete">
              &times;
            </button>
          </div>
        ))}
        <button onClick={() => data.onAddEnumValue?.(declaration.name)} className="enum-node-add-btn">
          + Add Value
        </button>
      </div>
      )}

      <Handle type="source" position={Position.Bottom} id={HANDLE_ID.bottom} className="graph-node-handle enum-node-handle"
        isConnectable={false} style={{ opacity: 0 }} />
    </div>
  );
}
