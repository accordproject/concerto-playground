import { getConceptHint, type ConceptHint } from '../../utils/conceptHints';
import './graph.css';

/** The hint panel itself; render inside an element with concept-hint-anchor. */
export function HintPopover({ hint }: { hint: ConceptHint }) {
  return (
    <span className="concept-hint-pop nodrag">
      <span className="concept-hint-title">{hint.title}</span>
      <span className="concept-hint-summary">{hint.summary}</span>
    </span>
  );
}

interface KindBadgeProps {
  /** Declaration kind shown in the node header (concept, asset, enum, ...). */
  kind: string;
  /** Extra class names for the badge label, e.g. concept-node-kind. */
  className?: string;
  /** Inline style for nodes that are styled without CSS classes. */
  style?: React.CSSProperties;
}

/**
 * The declaration-kind label of a node header, with a contextual hint
 * popover (US-06) explaining when to use that declaration kind. The popover
 * is pure CSS: it appears while the badge is hovered.
 */
export function KindBadge({ kind, className, style }: KindBadgeProps) {
  const hint = getConceptHint(kind);
  return (
    <span
      className={`graph-node-kind concept-hint-anchor${className ? ` ${className}` : ''}`}
      style={style}
    >
      {kind}
      {hint && <HintPopover hint={hint} />}
    </span>
  );
}
