import { Handle, Position, useStore } from '@xyflow/react';
import type { Declaration } from '../../utils/graph/types';
import { HANDLE_ID } from '../../utils/graph/types';
import type { GraphTargetHandle } from '../../utils/graph/nodeLayout';
import { SEMANTIC_ZOOM_THRESHOLD } from './constants';
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
  const showFull = useStore((s) => s.transform[2] >= SEMANTIC_ZOOM_THRESHOLD);
  const valueCount = declaration.enumValues.length;

  return (
    <div className={`graph-node enum-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Top} id={HANDLE_ID.top} className="graph-node-handle enum-node-handle" />
      <Handle type="target" position={Position.Left} id={HANDLE_ID.left} className="graph-node-handle enum-node-handle" />
      <Handle type="source" position={Position.Right} id={HANDLE_ID.right} className="graph-node-handle enum-node-handle" />
      {incomingHandles.map((handle) => (
        <Handle key={handle.id} type="target" position={Position.Left} id={handle.id}
          className="graph-node-handle enum-node-handle" style={{ top: handle.top }} />
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

      <Handle type="source" position={Position.Bottom} id={HANDLE_ID.bottom} className="graph-node-handle enum-node-handle" />
    </div>
  );
}
