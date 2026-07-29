import { useId } from 'react';
import { getConceptHint, type ConceptHint } from '../../utils/conceptHints';
import './graph.css';

/** The hint panel itself; render inside an element with concept-hint-anchor. */
export function HintPopover({ hint, id }: { hint: ConceptHint; id?: string }) {
  return (
    <span className="concept-hint-pop nodrag" role="tooltip" id={id}>
      <span className="concept-hint-title">{hint.title}</span>
      <span className="concept-hint-summary">{hint.summary}</span>
    </span>
  );
}

/**
 * Mouseenter/focus handler for concept-hint-anchor elements: measures the
 * popover at its default placement (below the anchor, extending right) and
 * flips it left and/or above when it would leave the viewport, e.g. after
 * panning a node against the screen edge. The CSS placement alone cannot
 * know where the viewport ends.
 */
export function keepHintInViewport(event: React.SyntheticEvent<HTMLElement>) {
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

/** Escape hides the popover until the pointer or focus leaves the anchor. */
function dismissHintOnEscape(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Escape') return;
  event.currentTarget.dataset.hintDismissed = 'true';
}

function resetHintDismissal(event: React.SyntheticEvent<HTMLElement>) {
  delete event.currentTarget.dataset.hintDismissed;
}

interface HintAnchorProps {
  hint: ConceptHint;
  /** Extra class names for the trigger element. */
  className?: string;
  /** Inline style for triggers that are styled without CSS classes. */
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * A trigger with a contextual hint popover, usable beyond the mouse: the
 * trigger is keyboard-focusable, the panel is a role="tooltip" referenced
 * through aria-describedby, it opens on hover and on focus, and Escape
 * dismisses it while it would obscure content.
 */
export function HintAnchor({ hint, className, style, children }: HintAnchorProps) {
  const tooltipId = useId();
  return (
    <span
      className={`concept-hint-anchor${className ? ` ${className}` : ''}`}
      style={style}
      tabIndex={0}
      aria-describedby={tooltipId}
      onMouseEnter={keepHintInViewport}
      onFocus={keepHintInViewport}
      onKeyDown={dismissHintOnEscape}
      onMouseLeave={resetHintDismissal}
      onBlur={resetHintDismissal}
    >
      {children}
      <HintPopover hint={hint} id={tooltipId} />
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
 * popover (US-06) explaining when to use that declaration kind.
 */
export function KindBadge({ kind, className, style }: KindBadgeProps) {
  const hint = getConceptHint(kind);
  const badgeClass = `graph-node-kind${className ? ` ${className}` : ''}`;
  if (!hint) {
    return (
      <span className={badgeClass} style={style}>
        {kind}
      </span>
    );
  }
  return (
    <HintAnchor hint={hint} className={badgeClass} style={style}>
      {kind}
    </HintAnchor>
  );
}
