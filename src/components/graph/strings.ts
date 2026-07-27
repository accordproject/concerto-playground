// Central place for the user-facing strings of the graph view.

export const TOOLBAR_STRINGS = {
  hideCto: '◀ CTO',
  showCto: '▶ CTO',
  hideCtoTooltip: 'Hide CTO text',
  showCtoTooltip: 'Show CTO text',
  importLabel: 'Import',
  importTooltip: 'Import .cto or JSON AST files',
  exportLabel: 'Export',
  exportTooltip: 'Export as .cto or .zip',
  addDeclaration: '+ Add',
  addDeclarationTooltip: 'Add a declaration',
  clearCanvas: 'Clear',
  clearConfirm: 'Remove all declarations from this namespace? You can undo this.',
  undoIcon: '↩',
  redoIcon: '↪',
  searchIcon: '⌕',
  searchNodes: 'Search nodes',
  legendProperty: 'property',
  legendRelationship: 'relationship',
  legendExtends: 'extends',
} as const;

export const DIALOG_STRINGS = {
  addDeclarationTitle: 'Add Declaration',
  declarationNamePlaceholder: 'Name (e.g. MyContract)',
  extendsPrimitiveLabel: 'Extends primitive',
  mapKeyTypeLabel: 'Key Type',
  mapValueTypeLabel: 'Value Type',
  addPropertyTitle: (declName: string) => `Add Property to ${declName}`,
  propertyNamePlaceholder: 'Property name',
  optionalLabel: 'optional',
  arrayLabel: 'array []',
  relationshipLabel: 'relationship (-->)',
  addEnumValueTitle: (declName: string) => `Add Value to ${declName}`,
  enumValuePlaceholder: 'Value (e.g. Active)',
  setInheritanceTitle: (declName: string) => `Set Inheritance for ${declName}`,
  noInheritanceOption: 'None (no inheritance)',
  add: 'Add',
  set: 'Set',
  cancel: 'Cancel',
} as const;

// Descriptions for the keyboard shortcut registry. The shortcuts overlay
// and the toolbar hints render these, so keep them short and action-like.
export const SHORTCUT_STRINGS = {
  categoryEditing: 'Editing',
  categoryNavigation: 'Navigation',
  categoryGeneral: 'General',
  undo: 'Undo',
  redo: 'Redo',
  searchNodes: 'Search nodes',
  closeDialog: 'Close the open dialog',
  deleteSelection: 'Delete the selected node or edge',
  clearCanvas: 'Clear the canvas',
  toggleCto: 'Toggle the CTO text panel',
  viewGraph: 'Switch to Graph view',
  viewForm: 'Switch to Form view',
  viewCode: 'Switch to Code view',
  showOverlay: 'Show keyboard shortcuts',
  overlayTitle: 'Keyboard shortcuts',
  overlayCloseLabel: 'Close shortcuts overlay',
} as const;

export const SEARCH_STRINGS = {
  icon: '⌕',
  placeholder: 'Search declarations and properties…',
  escHint: 'ESC',
  noMatches: (query: string) => `No matches for “${query}”`,
  emptyHint: 'Search by declaration or property name.',
} as const;
