import { Handle, Position, useStore } from '@xyflow/react';
import type { Declaration } from '../../utils/graph/types';
import { SEMANTIC_ZOOM_THRESHOLD } from './constants';
import './graph.css';

interface EnumNodeData {
  label: string;
  declaration: Declaration;
  onAddEnumValue?: (declName: string) => void;
  onDeleteEnumValue?: (declName: string, value: string) => void;
  onDeleteDeclaration?: (declName: string) => void;
}

export function EnumNode({ data, selected }: { data: EnumNodeData; selected?: boolean }) {
  const { declaration } = data;
  const showFull = useStore((s) => s.transform[2] >= SEMANTIC_ZOOM_THRESHOLD);
  const valueCount = declaration.enumValues.length;

  return (
    <div className={`graph-node enum-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Top} id="top" className="graph-node-handle enum-node-handle" />
      <Handle type="target" position={Position.Left} id="left" className="graph-node-handle enum-node-handle" />
      <Handle type="source" position={Position.Right} id="right" className="graph-node-handle enum-node-handle" />

      <div className="enum-node-header">
        <div className="graph-node-header-row">
          <span className="graph-node-kind enum-node-kind">
            enum
          </span>
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

      <Handle type="source" position={Position.Bottom} id="bottom" className="graph-node-handle enum-node-handle" />
    </div>
  );
}
