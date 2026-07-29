// Form view adapted from accordproject/lab-concerto-editor-web (Dan Selman <danscode@selman.org>, Ayman)

import { useState } from 'react';
import type { ConcertoModel } from '../../utils/graph/types';
import type { FormSel } from './FormView';
import { COLOR } from './theme';
import { FORM_STRINGS } from '../../constants/ui';

interface PropertyTreeProps {
  models: Record<string, ConcertoModel>;
  selection: FormSel;
  onSelect: (sel: FormSel) => void;
  onAddNamespace: () => void;
  onRemoveNamespace: (ns: string) => void;
  onAddDeclaration: (ns: string) => void;
  onAddProperty: (ns: string, declName: string) => void;
  onAddEnumValue: (ns: string, declName: string) => void;
}

const itemBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 8px',
  cursor: 'pointer',
  fontSize: 12,
  color: COLOR.text,
  userSelect: 'none',
  borderLeft: '2px solid transparent',
  transition: 'background 0.1s',
};

function isSelected(sel: FormSel, kind: FormSel['kind'], ns: string, declName?: string, propName?: string): boolean {
  if (sel.kind !== kind) return false;
  if (sel.kind === 'namespace') return sel.ns === ns;
  if (sel.kind === 'decl') return sel.ns === ns && sel.declName === declName;
  if (sel.kind === 'prop') return sel.ns === ns && sel.declName === declName && sel.propName === propName;
  if (sel.kind === 'enumVal') return sel.ns === ns && sel.declName === declName && sel.value === propName;
  return false;
}

export function PropertyTree({
  models,
  selection,
  onSelect,
  onAddNamespace,
  onRemoveNamespace,
  onAddDeclaration,
  onAddProperty,
  onAddEnumValue,
}: PropertyTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    Object.keys(models).forEach((ns) => { init[ns] = true; });
    return init;
  });
  const [hoveredNs, setHoveredNs] = useState<string | null>(null);

  const toggleExpand = (ns: string) => {
    setExpanded((prev) => ({ ...prev, [ns]: !prev[ns] }));
  };

  const nsList = Object.keys(models);

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        background: COLOR.bg,
        borderRight: `1px solid ${COLOR.border}`,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          borderBottom: `1px solid ${COLOR.border}`,
          background: '#171d2b',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: COLOR.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {FORM_STRINGS.treeTitle}
        </span>
        <button
          onClick={onAddNamespace}
          title={FORM_STRINGS.addNamespaceTitle}
          style={{
            background: COLOR.blue,
            color: COLOR.text,
            border: 'none',
            borderRadius: 4,
            padding: '2px 7px',
            fontSize: 14,
            cursor: 'pointer',
            lineHeight: '1.4',
          }}
        >
          +
        </button>
      </div>

      {/* Namespaces */}
      {nsList.map((ns) => {
        const model = models[ns];
        const isOpen = expanded[ns] !== false;
        const nsSelected = isSelected(selection, 'namespace', ns);
        const isHovered = hoveredNs === ns;

        return (
          <div key={ns}>
            {/* Namespace header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 8px',
                cursor: 'pointer',
                background: nsSelected ? `${COLOR.blue}20` : 'transparent',
                borderLeft: `2px solid ${nsSelected ? COLOR.blue : 'transparent'}`,
                fontSize: 12,
                color: COLOR.text,
                userSelect: 'none',
                position: 'relative',
              }}
              onMouseEnter={() => setHoveredNs(ns)}
              onMouseLeave={() => setHoveredNs(null)}
              onClick={() => onSelect({ kind: 'namespace', ns })}
            >
              <span
                style={{ fontSize: 10, color: COLOR.muted, width: 10, flexShrink: 0 }}
                onClick={(e) => { e.stopPropagation(); toggleExpand(ns); }}
              >
                {isOpen ? '▼' : '►'}
              </span>
              <span style={{ fontSize: 13 }}>📦</span>
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                  color: COLOR.accent,
                  fontSize: 11,
                }}
                title={ns}
              >
                {ns.length > 28 ? ns.slice(0, 28) + '…' : ns}
              </span>
              {isHovered && nsList.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveNamespace(ns); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: COLOR.red,
                    cursor: 'pointer',
                    fontSize: 13,
                    padding: '0 2px',
                    lineHeight: 1,
                  }}
                  title={FORM_STRINGS.removeNamespaceTitle}
                >
                  ×
                </button>
              )}
            </div>

            {/* Declarations */}
            {isOpen && (
              <div>
                {/* Add declaration button */}
                <div style={{ paddingLeft: 24, paddingBottom: 2 }}>
                  <button
                    onClick={() => onAddDeclaration(ns)}
                    style={{
                      background: 'transparent',
                      border: `1px dashed ${COLOR.border}`,
                      color: COLOR.muted,
                      cursor: 'pointer',
                      fontSize: 11,
                      borderRadius: 4,
                      padding: '2px 8px',
                      width: '100%',
                      textAlign: 'left',
                    }}
                  >
                    {FORM_STRINGS.addDeclaration}
                  </button>
                </div>

                {model.declarations.map((decl) => {
                  const declSelected = isSelected(selection, 'decl', ns, decl.name);
                  const isEnum = decl.type === 'enum';

                  return (
                    <div key={decl.name}>
                      {/* Declaration row */}
                      <div
                        style={{
                          ...itemBase,
                          paddingLeft: 22,
                          background: declSelected ? `${COLOR.blue}20` : 'transparent',
                          borderLeft: `2px solid ${declSelected ? COLOR.blue : 'transparent'}`,
                        }}
                        onClick={() => onSelect({ kind: 'decl', ns, declName: decl.name })}
                      >
                        <span style={{ fontSize: 12 }}>{isEnum ? '🔸' : '🔷'}</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {decl.name}
                        </span>
                        <span style={{ fontSize: 10, color: COLOR.muted }}>{decl.type}</span>
                      </div>

                      {/* Add property/value button */}
                      <div style={{ paddingLeft: 38, paddingBottom: 2 }}>
                        <button
                          onClick={() => isEnum ? onAddEnumValue(ns, decl.name) : onAddProperty(ns, decl.name)}
                          style={{
                            background: 'transparent',
                            border: `1px dashed ${COLOR.border}`,
                            color: COLOR.muted,
                            cursor: 'pointer',
                            fontSize: 10,
                            borderRadius: 4,
                            padding: '1px 6px',
                            width: '100%',
                            textAlign: 'left',
                          }}
                        >
                          + {isEnum ? FORM_STRINGS.addValue : FORM_STRINGS.addProperty}
                        </button>
                      </div>

                      {/* Properties */}
                      {!isEnum && decl.properties.map((prop) => {
                        const propSelected = isSelected(selection, 'prop', ns, decl.name, prop.name);
                        return (
                          <div
                            key={prop.name}
                            style={{
                              ...itemBase,
                              paddingLeft: 38,
                              background: propSelected ? `${COLOR.blue}20` : 'transparent',
                              borderLeft: `2px solid ${propSelected ? COLOR.blue : 'transparent'}`,
                              color: COLOR.muted,
                            }}
                            onClick={() => onSelect({ kind: 'prop', ns, declName: decl.name, propName: prop.name })}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLOR.muted, flexShrink: 0 }} />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {prop.name}
                            </span>
                            <span style={{ fontSize: 10, color: '#4a5568' }}>{prop.type}{prop.isArray ? '[]' : ''}</span>
                          </div>
                        );
                      })}

                      {/* Enum values */}
                      {isEnum && decl.enumValues.map((val) => {
                        const valSelected = isSelected(selection, 'enumVal', ns, decl.name, val);
                        return (
                          <div
                            key={val}
                            style={{
                              ...itemBase,
                              paddingLeft: 38,
                              background: valSelected ? `${COLOR.blue}20` : 'transparent',
                              borderLeft: `2px solid ${valSelected ? COLOR.blue : 'transparent'}`,
                              color: COLOR.muted,
                            }}
                            onClick={() => onSelect({ kind: 'enumVal', ns, declName: decl.name, value: val })}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLOR.accent, flexShrink: 0 }} />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {val}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
