import { Handle, Position } from '@xyflow/react';
import type { Declaration } from '../../utils/graph/types';
import { HANDLE_ID } from '../../utils/graph/types';
import type { GraphTargetHandle } from '../../utils/graph/nodeLayout';
import { DETAIL_ROW_HEIGHT, HANDLE_SIZE, PROPERTY_ROW_GAP, getCompactHandleTop } from '../../utils/graph/nodeLayout';
import { useSemanticZoom } from './semanticZoom';
import { KindBadge } from './KindBadge';
import { NODE_STRINGS } from './strings';

interface ScalarNodeData {
  label: string;
  declaration: Declaration;
  incomingHandles?: GraphTargetHandle[];
  onDeleteDeclaration?: (declName: string) => void;
}

export function ScalarNode({ data, selected }: { data: ScalarNodeData; selected?: boolean }) {
  const { declaration } = data;
  const v = declaration.scalarValidators || {};
  const incomingHandles = data.incomingHandles ?? [];
  const showFull = useSemanticZoom();
  const constraintCount = [v.default, v.regex, v.range, v.length].filter(Boolean).length;

  return (
    <div style={{
      background: '#1e2533',
      borderRadius: 12,
      border: `2px solid ${selected ? '#fff' : '#ed64a666'}`,
      minWidth: 200,
      boxShadow: selected
        ? '0 0 20px #ed64a644, 0 8px 24px rgba(0,0,0,0.4)'
        : '0 4px 16px rgba(0,0,0,0.3)',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}>
      <Handle type="target" position={Position.Top} id={HANDLE_ID.top} className="graph-node-target-dot" style={handleStyle} />
      <Handle type="target" position={Position.Left} id={HANDLE_ID.left} className="graph-node-target-dot" style={handleStyle} />
      {incomingHandles.map((handle, index) => (
        <Handle
          key={handle.id}
          type="target"
          position={Position.Left}
          id={handle.id}
          style={{
            ...incomingHandleStyle,
            top: getCompactHandleTop(index, incomingHandles.length),
          }}
        />
      ))}

      <div style={{
        padding: '10px 14px',
        background: 'linear-gradient(135deg, #702459, #702459cc)',
        borderBottom: '1px solid #ed64a633',
        borderRadius: '10px 10px 0 0',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <KindBadge kind="scalar" style={{ color: '#ed64a6' }} />
          <button onClick={() => data.onDeleteDeclaration?.(declaration.name)}
            style={{ background: 'none', border: 'none', color: '#ffffff55', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>
            &times;
          </button>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: '#fbb6ce' }}>
          {declaration.name}
        </div>
        <div style={{ fontSize: 11, color: '#ed64a6', marginTop: 2 }}>
          extends {declaration.scalarExtends || 'String'}
        </div>
      </div>

      {!showFull && (
        <div style={{ padding: '11px 14px', fontSize: 12, color: '#8a97ad' }}>
          {constraintCount === 0
            ? 'no constraints'
            : `${constraintCount} ${constraintCount === 1 ? 'constraint' : 'constraints'}`}
        </div>
      )}

      {showFull && (
      <div style={{ padding: '6px 12px 8px' }}>
        {v.default && (
          <div style={detailRow}>
            <span style={detailLabel}>{NODE_STRINGS.scalarDefaultLabel}</span>
            <span style={detailValue}>{v.default}</span>
          </div>
        )}
        {v.regex && (
          <div style={detailRow}>
            <span style={detailLabel}>{NODE_STRINGS.scalarRegexLabel}</span>
            <span style={detailValue}>{v.regex}</span>
          </div>
        )}
        {v.range && (
          <div style={detailRow}>
            <span style={detailLabel}>{NODE_STRINGS.scalarRangeLabel}</span>
            <span style={detailValue}>{v.range}</span>
          </div>
        )}
        {v.length && (
          <div style={detailRow}>
            <span style={detailLabel}>{NODE_STRINGS.scalarLengthLabel}</span>
            <span style={detailValue}>{v.length}</span>
          </div>
        )}
        {!v.default && !v.regex && !v.range && !v.length && (
          <div style={{ fontSize: 11, color: '#ffffff33', padding: '4px 0', textAlign: 'center', fontStyle: 'italic' }}>
            no constraints
          </div>
        )}
      </div>
      )}

      <Handle type="source" position={Position.Bottom} id={HANDLE_ID.bottom} isConnectable={false} style={{ ...handleStyle, opacity: 0 }} />
    </div>
  );
}

const handleStyle: React.CSSProperties = {
  width: HANDLE_SIZE, height: HANDLE_SIZE, background: '#ed64a6', borderRadius: '50%', border: '2px solid #1e2533',
};

const detailRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '4px 8px', marginBottom: PROPERTY_ROW_GAP, minHeight: DETAIL_ROW_HEIGHT,
  boxSizing: 'border-box', background: '#161b27', borderRadius: 6,
};

const detailLabel: React.CSSProperties = {
  fontSize: 10, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600,
};

const detailValue: React.CSSProperties = {
  fontSize: 11, color: '#fbb6ce', fontFamily: 'monospace',
};

const incomingHandleStyle: React.CSSProperties = {
  ...handleStyle,
  left: -6,
  transform: 'translateY(-50%)',
};
