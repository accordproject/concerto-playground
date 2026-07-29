import { Handle, Position, useStore } from '@xyflow/react';
import type { Declaration } from '../../utils/graph/types';
import { SEMANTIC_ZOOM_THRESHOLD } from './constants';
import { KindBadge, HintAnchor } from './KindBadge';
import { getConceptHint } from '../../utils/conceptHints';
import './graph.css';

const TYPE_COLORS: Record<string, string> = {
  String: '#68d391',
  Integer: '#63b3ed',
  Long: '#63b3ed',
  Double: '#63b3ed',
  Boolean: '#fbd38d',
  DateTime: '#d6bcfa',
};

const DECL_COLORS: Record<string, { bg: string; accent: string }> = {
  concept: { bg: '#2b4acb', accent: '#5a7af5' },
  asset: { bg: '#276749', accent: '#48bb78' },
  participant: { bg: '#6b46c1', accent: '#9f7aea' },
  event: { bg: '#c53030', accent: '#fc8181' },
  transaction: { bg: '#c05621', accent: '#ed8936' },
};

interface ConceptNodeData {
  label: string;
  declaration: Declaration;
  edgeProperties?: string[];
  onAddProperty?: (declName: string) => void;
  onDeleteProperty?: (declName: string, propName: string) => void;
  onDeleteDeclaration?: (declName: string) => void;
  onToggleAbstract?: (declName: string) => void;
  onSetInheritance?: (declName: string) => void;
}

export function ConceptNode({ data, selected }: { data: ConceptNodeData; selected?: boolean }) {
  const { declaration } = data;
  const colors = DECL_COLORS[declaration.type] || DECL_COLORS.concept;
  const edgeProperties = new Set(data.edgeProperties ?? []);
  const showFull = useStore((s) => s.transform[2] >= SEMANTIC_ZOOM_THRESHOLD);
  const propCount = declaration.properties.length;
  const nodeVars = { '--accent': colors.accent, '--bg': colors.bg } as React.CSSProperties;

  return (
    <div className={`graph-node concept-node${selected ? ' selected' : ''}`} style={nodeVars}>
      <Handle type="target" position={Position.Top} id="top" className="graph-node-handle" style={{ background: colors.accent }} />
      <Handle type="target" position={Position.Left} id="left" className="graph-node-handle" style={{ background: colors.accent }} />
      <Handle type="source" position={Position.Right} id="right" className="graph-node-handle" style={{ background: colors.accent }} />

      <div className="concept-node-header">
        <div className="graph-node-header-row">
          <div className="concept-node-kind-group">
            <KindBadge kind={declaration.type} className="concept-node-kind" />
            {declaration.isAbstract && (
              <span className="concept-node-abstract-badge"
                onClick={() => data.onToggleAbstract?.(declaration.name)} title="Toggle abstract">
                abstract
              </span>
            )}
            {!declaration.isAbstract && (
              <span className="concept-node-concrete-badge"
                onClick={() => data.onToggleAbstract?.(declaration.name)} title="Make abstract">
                concrete
              </span>
            )}
          </div>
          <button onClick={() => data.onDeleteDeclaration?.(declaration.name)}
            className="graph-node-delete-btn"
            title="Delete"
          >
            &times;
          </button>
        </div>
        {declaration.decorators?.length > 0 && (
          <div className="concept-node-decorators">
            {declaration.decorators.map((d) => {
              const decoratorHint = getConceptHint('@');
              const label = `@${d.name}${d.args.length > 0 ? `(${d.args.join(', ')})` : ''}`;
              if (!decoratorHint) {
                return (
                  <span key={d.name} className="concept-node-decorator">{label}</span>
                );
              }
              return (
                <HintAnchor key={d.name} hint={decoratorHint} className="concept-node-decorator">
                  {label}
                </HintAnchor>
              );
            })}
          </div>
        )}
        <div className="concept-node-name">
          {declaration.name}
        </div>
        {declaration.identified === 'identified-by' && declaration.identifiedBy && (
          <div className="concept-node-identified">
            identified by {declaration.identifiedBy}
          </div>
        )}
        {declaration.identified === 'identified' && (
          <div className="concept-node-identified">
            identified
          </div>
        )}
        {declaration.superType && (
          <div className="concept-node-extends">
            extends {declaration.superType}
          </div>
        )}
      </div>

      {!showFull && (
        <div className="graph-node-summary">
          {propCount} {propCount === 1 ? 'property' : 'properties'}
          {/* Keep one source handle per edge property alive when zoomed out, spread
              along the node's right edge so every edge keeps its own anchor. */}
          {(data.edgeProperties ?? []).map((p, i, arr) => (
            <Handle
              key={`compact:${p}`}
              type="source"
              position={Position.Right}
              id={`prop:${p}`}
              className="graph-node-handle graph-node-row-handle"
              style={{
                background: colors.accent,
                top: `${Math.round(((i + 1) / (arr.length + 1)) * 100)}%`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}

      {showFull && (
      <div className="graph-node-body">
        {declaration.properties.map((prop) => (
          <div key={prop.name} className="concept-node-prop">
            {edgeProperties.has(prop.name) && (
              <Handle
                type="source"
                position={Position.Right}
                id={`prop:${prop.name}`}
                className="graph-node-handle graph-node-row-handle"
                style={{ background: colors.accent }}
              />
            )}
            {prop.isRelationship && (
              <span className="concept-node-rel-arrow">&#8594;</span>
            )}
            <span className="concept-node-prop-type" style={{ color: TYPE_COLORS[prop.type] || colors.accent }}>
              {prop.type}{prop.isArray ? '[]' : ''}
            </span>
            <span className="concept-node-prop-name">{prop.name}</span>
            {prop.validators?.default && (
              <span className="concept-node-prop-validator">={prop.validators.default}</span>
            )}
            {prop.validators?.regex && (
              <span className="concept-node-prop-validator">{prop.validators.regex}</span>
            )}
            {prop.isOptional && (
              <span className="concept-node-prop-opt">
                opt
              </span>
            )}
            <button onClick={() => data.onDeleteProperty?.(declaration.name, prop.name)}
              className="graph-node-row-delete"
              title="Delete property"
            >
              &times;
            </button>
          </div>
        ))}
        {declaration.properties.length === 0 && (
          <div className="concept-node-empty">
            No properties yet
          </div>
        )}
        <button onClick={() => data.onAddProperty?.(declaration.name)} className="concept-node-add-btn">
          + Add Property
        </button>
      </div>
      )}

      <Handle type="source" position={Position.Bottom} id="bottom" className="graph-node-handle" style={{ background: colors.accent }} />
    </div>
  );
}
