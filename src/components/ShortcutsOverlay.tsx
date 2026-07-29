import { useEffect, useRef } from 'react';
import { useKeyboardShortcuts, formatShortcut } from '../hooks/useKeyboardShortcuts';
import { SHORTCUT_COMBOS, type ShortcutCombo } from '../utils/shortcutCombos';
import { SHORTCUT_STRINGS } from './graph/strings';

interface CatalogItem {
  description: string;
  combos: ShortcutCombo[];
}

interface CatalogSection {
  category: string;
  items: CatalogItem[];
}

// The cheat sheet content. Combos come from SHORTCUT_COMBOS, the same values
// the live key handlers use. Exported for tests. The "?" entry and the
// Delete/Backspace pair are display-only spellings of their bindings.
export const SHORTCUTS_CATALOG: CatalogSection[] = [
  {
    category: SHORTCUT_STRINGS.categoryEditing,
    items: [
      { description: SHORTCUT_STRINGS.undo, combos: [SHORTCUT_COMBOS.undo] },
      { description: SHORTCUT_STRINGS.redo, combos: [SHORTCUT_COMBOS.redoPrimary, SHORTCUT_COMBOS.redoAlt] },
      { description: SHORTCUT_STRINGS.deleteSelection, combos: [{ key: 'Delete' }, { key: 'Backspace' }] },
      { description: SHORTCUT_STRINGS.clearCanvas, combos: [SHORTCUT_COMBOS.clearCanvas] },
    ],
  },
  {
    category: SHORTCUT_STRINGS.categoryNavigation,
    items: [
      { description: SHORTCUT_STRINGS.searchNodes, combos: [SHORTCUT_COMBOS.searchNodes] },
      { description: SHORTCUT_STRINGS.viewGraph, combos: [SHORTCUT_COMBOS.viewGraph] },
      { description: SHORTCUT_STRINGS.viewForm, combos: [SHORTCUT_COMBOS.viewForm] },
      { description: SHORTCUT_STRINGS.viewCode, combos: [SHORTCUT_COMBOS.viewCode] },
      { description: SHORTCUT_STRINGS.toggleCto, combos: [SHORTCUT_COMBOS.toggleCtoPanel] },
    ],
  },
  {
    category: SHORTCUT_STRINGS.categoryGeneral,
    items: [
      { description: SHORTCUT_STRINGS.showOverlay, combos: [{ key: '?' }, SHORTCUT_COMBOS.showOverlayAlt] },
      { description: SHORTCUT_STRINGS.closeDialog, combos: [SHORTCUT_COMBOS.closeDialog] },
    ],
  },
];

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  // A modal layer: Escape (or the open combos again) closes the overlay and
  // every other shortcut is swallowed so the background stays inert.
  useKeyboardShortcuts(
    [
      {
        ...SHORTCUT_COMBOS.closeDialog,
        allowInInput: true,
        description: SHORTCUT_STRINGS.closeDialog,
        category: SHORTCUT_STRINGS.categoryGeneral,
        handler: onClose,
      },
      { ...SHORTCUT_COMBOS.showOverlay, description: SHORTCUT_STRINGS.showOverlay, handler: onClose },
      { ...SHORTCUT_COMBOS.showOverlayAlt, description: SHORTCUT_STRINGS.showOverlay, handler: onClose },
    ],
    { modal: true },
  );

  // Modal focus behavior: focus moves into the dialog on open and returns
  // to the element that opened it on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? panelRef.current)?.focus();
    return () => opener?.focus();
  }, []);

  // Keep Tab and Shift+Tab cycling inside the dialog.
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    const inside = active instanceof HTMLElement && panel.contains(active);
    if (e.shiftKey) {
      if (!inside || active === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (!inside || active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      style={overlayStyle}
      onClick={onClose}
      onKeyDown={trapTab}
      role="dialog"
      aria-modal="true"
      aria-label={SHORTCUT_STRINGS.overlayTitle}
    >
      <div ref={panelRef} tabIndex={-1} style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>{SHORTCUT_STRINGS.overlayTitle}</h3>
          <button onClick={onClose} style={closeBtnStyle} aria-label={SHORTCUT_STRINGS.overlayCloseLabel}>
            ×
          </button>
        </div>

        {SHORTCUTS_CATALOG.map((section) => (
          <div key={section.category}>
            <div style={categoryStyle}>{section.category}</div>
            {section.items.map((item) => (
              <div key={item.description} style={rowStyle}>
                <span style={descStyle}>{item.description}</span>
                <span style={comboGroupStyle}>
                  {item.combos.map((combo, i) => (
                    <kbd key={i} style={kbdStyle}>{formatShortcut(combo)}</kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.55)', zIndex: 1100,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const panelStyle: React.CSSProperties = {
  background: '#2d3748', borderRadius: 12, padding: '20px 24px',
  minWidth: 380, maxWidth: 480, maxHeight: '80vh', overflowY: 'auto',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid #4a5568',
};

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginBottom: 8,
};

const titleStyle: React.CSSProperties = {
  margin: 0, color: '#e2e8f0', fontSize: 15,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#718096',
  cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 6px',
};

const categoryStyle: React.CSSProperties = {
  margin: '14px 0 6px', color: '#718096', fontSize: 11,
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
};

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 16, padding: '5px 0',
};

const descStyle: React.CSSProperties = {
  color: '#cbd5e0', fontSize: 13,
};

const comboGroupStyle: React.CSSProperties = {
  display: 'flex', gap: 6, flexShrink: 0,
};

const kbdStyle: React.CSSProperties = {
  fontSize: 11, fontFamily: 'inherit', color: '#a0aec0',
  background: '#1a202c', border: '1px solid #4a5568', borderRadius: 4,
  padding: '1px 7px',
};
