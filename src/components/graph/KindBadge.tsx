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

/**
 * Mouseenter handler for concept-hint-anchor elements: measures the popover
 * at its default placement (below the anchor, extending right) and flips it
 * left and/or above when it would leave the viewport, e.g. after panning a
 * node against the screen edge. The CSS placement alone cannot know where
 * the viewport ends.
 */
export function keepHintInViewport(event: React.MouseEvent<HTMLElement>) {
  const anchor = event.currentTarget;
  const pop = anchor.querySelector<HTMLElement>('.concept-hint-pop');
  if (!pop) return;
  delete anchor.dataset.hintFlipX;
  delete anchor.dataset.hintFlipY;
  const rect = pop.getBoundingClientRect();
  if (rect.width === 0) return;
  if (rect.right > window.innerWidth) {
    anchor.dataset.hintFlipX = 'true';
  }
  if (rect.bottom > window.innerHeight) {
    anchor.dataset.hintFlipY = 'true';
  }
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
      onMouseEnter={keepHintInViewport}
    >
      {kind}
      {hint && <HintPopover hint={hint} />}
    </span>
  );
}
