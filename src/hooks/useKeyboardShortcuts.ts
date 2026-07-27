import { useEffect, useRef } from 'react';

// Central keyboard shortcut layer. Components declare their shortcuts as
// plain data so the key handling, the toolbar hints and the shortcuts
// overlay all read from the same definitions.

export interface ShortcutDef {
  /** KeyboardEvent.key to match; single characters match case-insensitively. */
  key: string;
  /** Requires Ctrl on Windows/Linux or Cmd on macOS. */
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** What the shortcut does, shown in tooltips and the shortcuts overlay. */
  description: string;
  /** Grouping used by the shortcuts overlay. */
  category?: string;
  /**
   * Fire even when focus is in an input, textarea, select or the Monaco
   * editor. Off by default so shortcuts like Ctrl+Z never fight the text
   * editor's own bindings.
   */
  allowInInput?: boolean;
  /** When false the shortcut is inert but can still be listed in the overlay. */
  enabled?: boolean;
  handler: (e: KeyboardEvent) => void;
}

/** True when the event originates from a text-editing surface. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.closest('.monaco-editor') !== null;
}

function matchesEvent(e: KeyboardEvent, s: ShortcutDef): boolean {
  const pressed = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const wanted = s.key.length === 1 ? s.key.toLowerCase() : s.key;
  if (pressed !== wanted) return false;
  if (!!s.mod !== (e.ctrlKey || e.metaKey)) return false;
  if (!!s.shift !== e.shiftKey) return false;
  if (!!s.alt !== e.altKey) return false;
  return true;
}

/**
 * Installs a single window keydown listener for the given shortcuts.
 * The first matching shortcut wins and the browser default is prevented.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutDef[]): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const inEditable = isEditableTarget(e.target);
      for (const shortcut of shortcutsRef.current) {
        if (shortcut.enabled === false) continue;
        if (inEditable && !shortcut.allowInInput) continue;
        if (!matchesEvent(e, shortcut)) continue;
        e.preventDefault();
        shortcut.handler(e);
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/**
 * Renders a shortcut combo for display, e.g. "Ctrl+Shift+Z" on Windows/Linux
 * and "⌘⇧Z" on macOS. The `mac` parameter exists for tests.
 */
export function formatShortcut(
  s: Pick<ShortcutDef, 'key' | 'mod' | 'shift' | 'alt'>,
  mac: boolean = isMacPlatform(),
): string {
  const keyLabel =
    s.key.length === 1 ? s.key.toUpperCase() : s.key === 'Escape' ? 'Esc' : s.key;
  if (mac) {
    return [s.mod ? '⌘' : '', s.alt ? '⌥' : '', s.shift ? '⇧' : '', keyLabel].join('');
  }
  return [s.mod ? 'Ctrl' : '', s.alt ? 'Alt' : '', s.shift ? 'Shift' : '', keyLabel]
    .filter(Boolean)
    .join('+');
}
