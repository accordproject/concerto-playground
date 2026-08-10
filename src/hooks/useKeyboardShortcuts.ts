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

export interface ShortcutLayerOptions {
  /**
   * A modal layer consumes every key press: while it is mounted, no
   * shortcut in a layer below it can fire. Use for dialogs that must make
   * the background inert, like the shortcuts overlay.
   */
  modal?: boolean;
}

interface ShortcutLayer {
  getShortcuts: () => ShortcutDef[];
  getModal: () => boolean;
}

// All mounted hook instances share one window listener and one layer stack.
// Later-mounted layers sit on top, which matches visual stacking: dialogs
// and overlays mount after the surfaces they cover.
const layerStack: ShortcutLayer[] = [];

function dispatchKeyDown(e: KeyboardEvent) {
  const inEditable = isEditableTarget(e.target);
  for (let i = layerStack.length - 1; i >= 0; i--) {
    const layer = layerStack[i];
    for (const shortcut of layer.getShortcuts()) {
      if (shortcut.enabled === false) continue;
      if (inEditable && !shortcut.allowInInput) continue;
      if (!matchesEvent(e, shortcut)) continue;
      e.preventDefault();
      shortcut.handler(e);
      return;
    }
    // A modal layer swallows the event even without a match, so background
    // shortcuts stay disabled while it is open.
    if (layer.getModal()) return;
  }
}

/**
 * Registers a shortcut layer on the shared dispatcher. Within a layer the
 * first matching shortcut wins; across layers the topmost (most recently
 * mounted) layer wins, and a modal layer disables every layer below it.
 * The browser default is prevented for handled keys.
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutDef[],
  options?: ShortcutLayerOptions,
): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;
  const modalRef = useRef(options?.modal ?? false);
  modalRef.current = options?.modal ?? false;

  useEffect(() => {
    const layer: ShortcutLayer = {
      getShortcuts: () => shortcutsRef.current,
      getModal: () => modalRef.current,
    };
    layerStack.push(layer);
    if (layerStack.length === 1) {
      window.addEventListener('keydown', dispatchKeyDown);
    }
    return () => {
      const index = layerStack.indexOf(layer);
      if (index !== -1) layerStack.splice(index, 1);
      if (layerStack.length === 0) {
        window.removeEventListener('keydown', dispatchKeyDown);
      }
    };
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
