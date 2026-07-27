// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GraphToolbar } from '../../components/graph/GraphToolbar';

function renderToolbar(overrides: Partial<React.ComponentProps<typeof GraphToolbar>> = {}) {
  const props: React.ComponentProps<typeof GraphToolbar> = {
    declarations: [],
    onAddDeclaration: vi.fn(),
    onAddProperty: vi.fn(),
    onAddEnumValue: vi.fn(),
    onSetSuperType: vi.fn(),
    activeDialog: null,
    onCloseDialog: vi.fn(),
    onClearCanvas: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: false,
    canRedo: false,
    onOpenSearch: vi.fn(),
    showText: true,
    onToggleText: vi.fn(),
    onImport: vi.fn(),
    onExport: vi.fn(),
    ...overrides,
  };
  return render(<GraphToolbar {...props} />);
}

describe('GraphToolbar dialog escape handling', () => {
  afterEach(() => {
    cleanup();
  });

  it('closes the add-declaration dialog on Escape', () => {
    renderToolbar();

    fireEvent.click(screen.getByText('+ Add'));
    expect(screen.getByText('Add Declaration')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Add Declaration')).toBeNull();
  });

  it('closes the dialog on Escape even while typing in its input', () => {
    renderToolbar();

    fireEvent.click(screen.getByText('+ Add'));
    const nameInput = screen.getByPlaceholderText('Name (e.g. MyContract)');

    fireEvent.keyDown(nameInput, { key: 'Escape' });
    expect(screen.queryByText('Add Declaration')).toBeNull();
  });

  it('does not react to Escape while no dialog is open', () => {
    renderToolbar();

    const notPrevented = fireEvent.keyDown(window, { key: 'Escape' });
    expect(notPrevented).toBe(true);
  });

  it('invokes onClearCanvas from the Clear button', () => {
    const onClearCanvas = vi.fn();
    renderToolbar({ onClearCanvas });

    fireEvent.click(screen.getByText('Clear'));
    expect(onClearCanvas).toHaveBeenCalledTimes(1);
  });
});
