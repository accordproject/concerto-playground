import { Handle, Position } from '@xyflow/react';
import type { Declaration, ClassDeclarationType, PrimitiveTypeName } from '../../utils/graph/types';
import { HANDLE_ID, PRIMITIVE_TYPES, propHandleId } from '../../utils/graph/types';
import { getCompactHandleTop, type GraphTargetHandle } from '../../utils/graph/nodeLayout';
import { getVisibleGraphDecorators } from '../../utils/graph/ctoToGraph';
import { useSemanticZoom } from './semanticZoom';
import { KindBadge, HintAnchor } from './KindBadge';
import { getConceptHint } from '../../utils/conceptHints';
import { NODE_STRINGS } from './strings';
import './graph.css';

const TYPE_COLORS: Record<PrimitiveTypeName, string> = {
  String: '#68d391',
  Integer: '#63b3ed',
  Long: '#63b3ed',
  Double: '#63b3ed',
  Boolean: '#fbd38d',
  DateTime: '#d6bcfa',
};

const DECL_COLORS: Record<ClassDeclarationType, { bg: string; accent: string }> = {
  concept: { bg: '#2b4acb', accent: '#5a7af5' },
  asset: { bg: '#276749', accent: '#48bb78' },
  participant: { bg: '#6b46c1', accent: '#9f7aea' },
  event: { bg: '#c53030', accent: '#fc8181' },
  transaction: { bg: '#c05621', accent: '#ed8936' },
};

/** Property type color: primitives get their palette color, user types the node accent. */
function propTypeColor(type: string, accent: string): string {
  return PRIMITIVE_TYPES.has(type) ? TYPE_COLORS[type as PrimitiveTypeName] : accent;
}

interface ConceptNodeData {
  label: string;
  declaration: Declaration;
  edgeProperties?: string[];
  incomingHandles?: GraphTargetHandle[];
  onAddProperty?: (declName: string) => void;
  onDeleteProperty?: (declName: string, propName: string) => void;
  onDeleteDeclaration?: (declName: string) => void;
  onToggleAbstract?: (declName: string) => void;
  onSetInheritance?: (declName: string) => void;
}

export function ConceptNode({ data, selected }: { data: ConceptNodeData; selected?: boolean }) {
  const { declaration } = data;
  const colors = DECL_COLORS[declaration.type as ClassDeclarationType] || DECL_COLORS.concept;
  const edgeProperties = new Set(data.edgeProperties ?? []);
  const incomingHandles = data.incomingHandles ?? [];
  const showFull = useSemanticZoom();
  const propCount = declaration.properties.length;
  const nodeVars = { '--accent': colors.accent, '--bg': colors.bg } as React.CSSProperties;
  const visibleDecorators = getVisibleGraphDecorators(declaration);
  const displayLabel = data.label || declaration.name;
  const showTechnicalName = displayLabel !== declaration.name;

  return (
    <div className={`graph-node concept-node${selected ? ' selected' : ''}`} style={nodeVars}>
      <Handle type="target" position={Position.Top} id={HANDLE_ID.top} className="graph-node-handle graph-node-target-dot" style={{ background: colors.accent }} />
      <Handle type="target" position={Position.Left} id={HANDLE_ID.left} className="graph-node-handle graph-node-target-dot" style={{ background: colors.accent }} />
      <Handle type="source" position={Position.Right} id={HANDLE_ID.right} className="graph-node-handle graph-node-plus-handle"
        style={{ '--plus-accent': colors.accent } as React.CSSProperties} />
      {/* One receiving dot per incoming edge. Spread proportionally over the
          rendered height, so any number of dots stays inside the node frame
          and the lines land exactly on them. */}
      {incomingHandles.map((handle, index) => (
        <Handle key={handle.id} type="target" position={Position.Left} id={handle.id}
          className="graph-node-handle"
          style={{
            top: getCompactHandleTop(index, incomingHandles.length),
            background: colors.accent,
          }} />
      ))}

      <div className="concept-node-header">
        <div className="graph-node-header-row">
          <div className="concept-node-kind-group">
            <KindBadge kind={declaration.type} className="concept-node-kind" />
            {declaration.isAbstract && (
              <span className="concept-node-abstract-badge"
                onClick={() => data.onToggleAbstract?.(declaration.name)} title={NODE_STRINGS.toggleAbstractTooltip}>
                {NODE_STRINGS.abstractBadge}
              </span>
            )}
            {!declaration.isAbstract && (
              <span className="concept-node-concrete-badge"
                onClick={() => data.onToggleAbstract?.(declaration.name)} title={NODE_STRINGS.makeAbstractTooltip}>
                {NODE_STRINGS.concreteBadge}
              </span>
            )}
          </div>
          <button onClick={() => data.onDeleteDeclaration?.(declaration.name)}
            className="graph-node-delete-btn"
            title={NODE_STRINGS.deleteDeclarationTooltip}
          >
            &times;
          </button>
        </div>
        {visibleDecorators.length > 0 && (
          <div className="concept-node-decorators">
            {visibleDecorators.map((d) => {
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
          {displayLabel}
        </div>
        {showTechnicalName && (
          <div
            style={{
              fontSize: 10,
              color: '#ffffff99',
              marginTop: 2,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {declaration.name}
          </div>
        )}
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
              id={propHandleId(p)}
              className="graph-node-handle graph-node-row-handle"
              style={{
                background: colors.accent,
                top: getCompactHandleTop(i, arr.length),
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
                id={propHandleId(prop.name)}
                className="graph-node-handle graph-node-row-handle"
                style={{ background: colors.accent }}
              />
            )}
            {prop.isRelationship && (
              <span className="concept-node-rel-arrow">&#8594;</span>
            )}
            <span className="concept-node-prop-type" style={{ color: propTypeColor(prop.type, colors.accent) }}>
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
                {NODE_STRINGS.optionalBadge}
              </span>
            )}
            <button onClick={() => data.onDeleteProperty?.(declaration.name, prop.name)}
              className="graph-node-row-delete"
              title={NODE_STRINGS.deletePropertyTooltip}
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

      {/* Anchor for outgoing extends edges only; new links start from the
          right-side plus, so this stays invisible. */}
      <Handle type="source" position={Position.Bottom} id={HANDLE_ID.bottom} className="graph-node-handle"
        style={{ background: colors.accent, opacity: 0 }} />
    </div>
  );
}
