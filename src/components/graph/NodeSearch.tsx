import { useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import type { Declaration } from '../../utils/graph/types';
import { useFocusNode } from './useFocusNode';
import { SEARCH_STRINGS } from './strings';
import './graph.css';

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
    <div className="node-search-backdrop" onClick={onClose} />
    <div className="node-search-panel" onKeyDown={onKeyDown}>
      <div className="node-search-input-row">
        <span className="node-search-icon">{SEARCH_STRINGS.icon}</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={SEARCH_STRINGS.placeholder}
          className="node-search-input"
        />
        <span className="node-search-kbd">{SEARCH_STRINGS.escHint}</span>
      </div>

      <div className="node-search-results">
        {results.length > 0 &&
          results.map(({ item, propMatches }, i) => (
            <div
              key={item.id}
              onClick={() => pick(item.id)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`node-search-result${i === activeIndex ? ' active' : ''}`}
            >
              <div className="node-search-result-head">
                <span
                  className="node-search-kind-badge"
                  style={{ background: KIND_COLORS[item.kind] ?? '#5a7af5' }}
                >
                  {item.kind}
                </span>
                <span className="node-search-result-name">
                  {item.name}
                </span>
              </div>
              {propMatches.map((p) => (
                <div key={p.name} className="node-search-prop-line">
                  {p.name}
                  {p.type ? `: ${p.type}` : ''}
                </div>
              ))}
            </div>
          ))}

        {q.length > 0 && results.length === 0 && (
          <div className="node-search-no-matches">
            {SEARCH_STRINGS.noMatches(q)}
          </div>
        )}

        {q.length === 0 && (
          <div className="node-search-hint">
            {SEARCH_STRINGS.emptyHint}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
