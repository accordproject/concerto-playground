import type { ShortcutDef } from '../hooks/useKeyboardShortcuts';

export type ShortcutCombo = Pick<ShortcutDef, 'key' | 'mod' | 'shift' | 'alt'>;

// Key combos shared between the components that wire them and the shortcuts
// overlay that documents them, so the two cannot drift apart.
export const SHORTCUT_COMBOS = {
  undo: { key: 'z', mod: true },
  redoPrimary: { key: 'z', mod: true, shift: true },
  redoAlt: { key: 'y', mod: true },
  searchNodes: { key: 'k', mod: true },
  clearCanvas: { key: 'Backspace', mod: true, shift: true },
  toggleCtoPanel: { key: 'b', mod: true },
  viewGraph: { key: '1' },
  viewForm: { key: '2' },
  viewCode: { key: '3' },
  showOverlay: { key: '?', shift: true },
  showOverlayAlt: { key: '/', mod: true },
  closeDialog: { key: 'Escape' },
} as const satisfies Record<string, ShortcutCombo>;
