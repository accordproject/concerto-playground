// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ShortcutsOverlay, SHORTCUTS_CATALOG } from '../../components/ShortcutsOverlay';

describe('ShortcutsOverlay', () => {
  afterEach(() => {
    cleanup();
  });

  it('lists every catalog entry with its keybinding', () => {
    render(<ShortcutsOverlay onClose={vi.fn()} />);

    expect(screen.getByText('Keyboard shortcuts')).toBeTruthy();
    for (const section of SHORTCUTS_CATALOG) {
      expect(screen.getByText(section.category)).toBeTruthy();
      for (const item of section.items) {
        expect(screen.getByText(item.description)).toBeTruthy();
      }
    }
    // jsdom has no mac platform, so combos render in Ctrl style.
    expect(screen.getByText('Ctrl+Z')).toBeTruthy();
    expect(screen.getByText('Ctrl+Shift+Z')).toBeTruthy();
    expect(screen.getByText('Ctrl+K')).toBeTruthy();
  });

  it('closes on Escape, backdrop click and the close button', () => {
    const onClose = vi.fn();
    render(<ShortcutsOverlay onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog'));
    fireEvent.click(screen.getByLabelText('Close shortcuts overlay'));

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('does not close when clicking inside the panel', () => {
    const onClose = vi.fn();
    render(<ShortcutsOverlay onClose={onClose} />);

    fireEvent.click(screen.getByText('Keyboard shortcuts'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('has a description and at least one combo for every catalog entry', () => {
    for (const section of SHORTCUTS_CATALOG) {
      for (const item of section.items) {
        expect(item.description.length).toBeGreaterThan(0);
        expect(item.combos.length).toBeGreaterThan(0);
      }
    }
  });

  it('documents the alternate open combo alongside ?', () => {
    render(<ShortcutsOverlay onClose={vi.fn()} />);
    expect(screen.getByText('?')).toBeTruthy();
    expect(screen.getByText('Ctrl+/')).toBeTruthy();
  });
});

describe('ShortcutsOverlay modal focus behavior', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  function renderWithTrigger() {
    const trigger = document.createElement('button');
    trigger.textContent = 'open shortcuts';
    document.body.appendChild(trigger);
    trigger.focus();
    const onClose = vi.fn();
    const view = render(<ShortcutsOverlay onClose={onClose} />);
    const close = screen.getByLabelText('Close shortcuts overlay');
    return { trigger, onClose, view, close };
  }

  it('moves focus into the dialog on open', () => {
    const { close } = renderWithTrigger();
    expect(document.activeElement).toBe(close);
  });

  it('keeps Tab and Shift+Tab cycling inside the dialog', () => {
    const { close } = renderWithTrigger();

    // The close button is the dialog's only tab stop, so both directions
    // must wrap back onto it instead of escaping to the background.
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(close);
  });

  it('restores focus to the opener on close', () => {
    const { trigger, view } = renderWithTrigger();
    view.unmount();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when the open combos are pressed again', () => {
    const { onClose } = renderWithTrigger();

    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    fireEvent.keyDown(window, { key: '/', ctrlKey: true });

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
