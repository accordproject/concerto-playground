import { useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import type { Declaration } from '../../utils/graph/types';
import { useFocusNode } from './useFocusNode';

interface NodeSearchProps {
  declarations: Declaration[];
  onClose: () => void;
}

interface SearchRecord {
  id: string;
  name: string;
  kind: Declaration['type'];
  props: { name: string; type: string }[];
}

const KIND_COLORS: Record<string, string> = {
  concept: '#5a7af5',
  asset: '#48bb78',
  participant: '#9f7aea',
  event: '#fc8181',
  transaction: '#ed8936',
  enum: '#ecc94b',
  map: '#38b2ac',
  scalar: '#ed64a6',
};

export function NodeSearch({ declarations, onClose }: NodeSearchProps) {
  const focusNode = useFocusNode();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const records = useMemo<SearchRecord[]>(
    () =>
      declarations.map((d) => ({
        id: d.name,
        name: d.name,
        kind: d.type,
        props:
          d.type === 'enum'
            ? d.enumValues.map((v) => ({ name: v, type: '' }))
            : d.properties.map((p) => ({ name: p.name, type: p.type })),
      })),
    [declarations],
  );

  const fuse = useMemo(
    () =>
      new Fuse(records, {
        keys: [
          { name: 'name', weight: 0.7 },
          { name: 'props.name', weight: 0.2 },
          { name: 'props.type', weight: 0.1 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
        includeMatches: true,
      }),
    [records],
  );

  const q = query.trim();
  const results = useMemo(() => {
    if (!q) return [];
    const lower = q.toLowerCase();
    return fuse
      .search(q)
      .slice(0, 20)
      .map(({ item, matches }) => {
        const nameHit = (matches ?? []).some((m) => m.key === 'name');
        const propMatches = nameHit
          ? []
          : item.props
              .filter(
                (p) =>
                  p.name.toLowerCase().includes(lower) ||
                  p.type.toLowerCase().includes(lower),
              )
              .slice(0, 3);
        return { item, propMatches };
      });
  }, [fuse, q]);

  useEffect(() => {
    setActiveIndex(0);
  }, [q]);

  const pick = (name: string) => {
    focusNode(name);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = results[activeIndex];
      if (chosen) pick(chosen.item.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <>
    <div style={backdropStyle} onClick={onClose} />
    <div style={panelStyle} onKeyDown={onKeyDown}>
      <div style={inputRowStyle}>
        <span style={{ color: '#38b2ac', fontSize: 16 }}>⌕</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search declarations and properties…"
          style={inputStyle}
        />
        <span style={kbdStyle}>ESC</span>
      </div>

      <div style={{ maxHeight: 320, overflow: 'auto' }}>
        {results.length > 0 &&
          results.map(({ item, propMatches }, i) => (
            <div
              key={item.id}
              onClick={() => pick(item.id)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                ...resultRowStyle,
                background: i === activeIndex ? '#13203c' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 0.7,
                    color: '#04141f',
                    padding: '2px 7px',
                    borderRadius: 5,
                    background: KIND_COLORS[item.kind] ?? '#5a7af5',
                    textTransform: 'uppercase',
                  }}
                >
                  {item.kind}
                </span>
                <span style={{ fontWeight: 600, fontSize: 13.5, color: '#e6ebf2' }}>
                  {item.name}
                </span>
              </div>
              {propMatches.map((p) => (
                <div key={p.name} style={propLineStyle}>
                  {p.name}
                  {p.type ? `: ${p.type}` : ''}
                </div>
              ))}
            </div>
          ))}

        {q.length > 0 && results.length === 0 && (
          <div style={{ padding: 22, textAlign: 'center', color: '#6b7790', fontSize: 13 }}>
            No matches for “{q}”
          </div>
        )}

        {q.length === 0 && (
          <div style={{ padding: '15px 17px', color: '#7e8ca6', fontSize: 12.5, lineHeight: 1.7 }}>
            Search by declaration or property name.
          </div>
        )}
      </div>
    </div>
    </>
  );
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 19,
};

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 440,
  maxWidth: 'calc(100% - 32px)',
  background: '#0e1730',
  border: '1px solid #2a3a5c',
  borderRadius: 12,
  boxShadow: '0 18px 50px rgba(0,0,0,.55)',
  overflow: 'hidden',
  zIndex: 20,
};

const inputRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 11,
  padding: '13px 16px',
  borderBottom: '1px solid #1c2742',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  fontSize: 14,
  background: 'transparent',
  color: '#e6ebf2',
};

const kbdStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: '#6b7790',
  border: '1px solid #2a3a5c',
  borderRadius: 5,
  padding: '1px 6px',
};

const resultRowStyle: React.CSSProperties = {
  padding: '10px 16px',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  borderBottom: '1px solid #141d31',
};

const propLineStyle: React.CSSProperties = {
  fontSize: 11.5,
  color: '#7e8ca6',
  fontFamily: "'JetBrains Mono', monospace",
  paddingLeft: 2,
};
