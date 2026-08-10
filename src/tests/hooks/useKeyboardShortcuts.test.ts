// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup, fireEvent } from '@testing-library/react';
import { useKeyboardShortcuts, formatShortcut, type ShortcutDef } from '../../hooks/useKeyboardShortcuts';

function mount(shortcuts: ShortcutDef[]) {
  return renderHook((defs: ShortcutDef[]) => useKeyboardShortcuts(defs), {
    initialProps: shortcuts,
  });
}

describe('useKeyboardShortcuts', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('fires the handler on a matching combo and prevents the default', () => {
    const handler = vi.fn();
    mount([{ key: 'z', mod: true, description: 'Undo', handler }]);

    const notPrevented = fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false);
  });

  it('accepts Cmd as the mod key', () => {
    const handler = vi.fn();
    mount([{ key: 'z', mod: true, description: 'Undo', handler }]);

    fireEvent.keyDown(window, { key: 'z', metaKey: true });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire without the required mod key', () => {
    const handler = vi.fn();
    mount([{ key: 'z', mod: true, description: 'Undo', handler }]);

    fireEvent.keyDown(window, { key: 'z' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('distinguishes shift variants even when the key arrives uppercased', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    mount([
      { key: 'z', mod: true, description: 'Undo', handler: undo },
      { key: 'z', mod: true, shift: true, description: 'Redo', handler: redo },
    ]);

    fireEvent.keyDown(window, { key: 'Z', ctrlKey: true, shiftKey: true });

    expect(redo).toHaveBeenCalledTimes(1);
    expect(undo).not.toHaveBeenCalled();
  });

  it('ignores events coming from inputs by default', () => {
    const handler = vi.fn();
    mount([{ key: 'z', mod: true, description: 'Undo', handler }]);

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true });

    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores events coming from inside the Monaco editor', () => {
    const handler = vi.fn();
    mount([{ key: 'z', mod: true, description: 'Undo', handler }]);

    const editor = document.createElement('div');
    editor.className = 'monaco-editor';
    const inner = document.createElement('div');
    editor.appendChild(inner);
    document.body.appendChild(editor);
    fireEvent.keyDown(inner, { key: 'z', ctrlKey: true });

    expect(handler).not.toHaveBeenCalled();
  });

  it('fires in inputs when allowInInput is set', () => {
    const handler = vi.fn();
    mount([{ key: 'Escape', allowInInput: true, description: 'Close', handler }]);

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('skips shortcuts with enabled set to false', () => {
    const handler = vi.fn();
    mount([{ key: 'Escape', enabled: false, description: 'Close', handler }]);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('only runs the first matching shortcut', () => {
    const first = vi.fn();
    const second = vi.fn();
    mount([
      { key: 'k', mod: true, description: 'First', handler: first },
      { key: 'k', mod: true, description: 'Second', handler: second },
    ]);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('uses the latest handlers after a rerender', () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    const { rerender } = mount([{ key: 'z', mod: true, description: 'Undo', handler: stale }]);

    rerender([{ key: 'z', mod: true, description: 'Undo', handler: fresh }]);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it('removes the listener on unmount', () => {
    const handler = vi.fn();
    const { unmount } = mount([{ key: 'z', mod: true, description: 'Undo', handler }]);

    unmount();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('shortcut layers', () => {
  afterEach(() => {
    cleanup();
  });

  it('the most recently mounted layer wins for the same combo', () => {
    const below = vi.fn();
    const above = vi.fn();
    mount([{ key: 'Escape', description: 'Close search', handler: below }]);
    mount([{ key: 'Escape', description: 'Close overlay', handler: above }]);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(above).toHaveBeenCalledTimes(1);
    expect(below).not.toHaveBeenCalled();
  });

  it('a modal layer suppresses non-matching shortcuts in layers below it', () => {
    const search = vi.fn();
    const close = vi.fn();
    mount([{ key: 'k', mod: true, description: 'Search', handler: search }]);
    renderHook(() =>
      useKeyboardShortcuts([{ key: 'Escape', description: 'Close', handler: close }], {
        modal: true,
      }),
    );

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(search).not.toHaveBeenCalled();
  });

  it('a non-modal layer lets unmatched keys fall through to layers below', () => {
    const search = vi.fn();
    const close = vi.fn();
    mount([{ key: 'k', mod: true, description: 'Search', handler: search }]);
    mount([{ key: 'Escape', description: 'Close', handler: close }]);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(search).toHaveBeenCalledTimes(1);
  });

  it('unmounting the top layer re-enables the layers below', () => {
    const search = vi.fn();
    const close = vi.fn();
    mount([{ key: 'k', mod: true, description: 'Search', handler: search }]);
    const top = renderHook(() =>
      useKeyboardShortcuts([{ key: 'Escape', description: 'Close', handler: close }], {
        modal: true,
      }),
    );

    top.unmount();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(search).toHaveBeenCalledTimes(1);
  });
});

describe('formatShortcut', () => {
  it('renders Ctrl-style combos on Windows/Linux', () => {
    expect(formatShortcut({ key: 'z', mod: true, shift: true }, false)).toBe('Ctrl+Shift+Z');
    expect(formatShortcut({ key: 'k', mod: true }, false)).toBe('Ctrl+K');
    expect(formatShortcut({ key: 'a', alt: true }, false)).toBe('Alt+A');
  });

  it('renders symbol combos on macOS', () => {
    expect(formatShortcut({ key: 'z', mod: true, shift: true }, true)).toBe('⌘⇧Z');
    expect(formatShortcut({ key: 'k', mod: true }, true)).toBe('⌘K');
  });

  it('shortens Escape to Esc', () => {
    expect(formatShortcut({ key: 'Escape' }, false)).toBe('Esc');
  });
});
