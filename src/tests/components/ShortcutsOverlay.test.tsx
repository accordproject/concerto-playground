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
});
