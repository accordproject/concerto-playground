// Central place for the user-facing strings of the app shell and the form
// view. The graph view keeps its own catalog in components/graph/strings.ts;
// both follow the same pattern so no UI text lives inline in components.

export const APP_STRINGS = {
  restorePrompt: (savedAt: string) =>
    `Restore previous session? Work saved in this browser on ${savedAt} was found.`,
  restore: 'Restore',
  dismiss: 'Dismiss',
  dismissStorageWarning: 'Dismiss storage warning',
  hideCtoPanel: 'Hide CTO panel',
  showCtoPanel: 'Show CTO panel',
  collapseCto: '◀ CTO',
  expandCto: '▶ CTO',
  examplesLabel: 'Examples:',
  loadExampleTitle: (label: string) => `Load the ${label} example model`,
  viewGraph: 'Graph',
  viewForm: 'Form',
  viewCode: 'Code',
  viewGraphTitle: (shortcut: string) => `Graph view (${shortcut})`,
  viewFormTitle: (shortcut: string) => `Form view (${shortcut})`,
  viewCodeTitle: (shortcut: string) => `Code view (${shortcut})`,
  shareTitle: 'Copy a shareable link to this workspace',
  schemaPanelTitle: 'Concerto Schema',
  schemaFileExt: '.cto',
  validationBadge: '⚠ Error',
  addNamespace: 'Add namespace',
  addNamespaceShort: '+ ns',
  removeNamespace: 'Remove',
  exportSingleFilename: 'model.cto',
  exportZipFilename: 'concerto-models.zip',
} as const;

export const SHARE_LABELS = {
  idle: 'Share URL',
  copied: 'Copied!',
  fallback: 'Copy URL bar',
} as const;

/** The Share button cycles through exactly these labels. */
export type ShareLabel = (typeof SHARE_LABELS)[keyof typeof SHARE_LABELS];

export const STATUS_BAR_STRINGS = {
  brand: 'Accord Project — Concerto Playground',
  lastSaved: (time: string) => `Last saved: ${time}`,
  docs: 'Docs',
  github: 'GitHub',
  license: 'Apache-2.0 · Linux Foundation',
} as const;

/** ErrorBoundary labels for the app's guarded panels. */
export const PANEL_LABELS = {
  textEditor: 'Text Editor',
  formView: 'Form View',
  graphCanvas: 'Graph Canvas',
  codeOutput: 'Code Output',
} as const;

export const HEADER_STRINGS = {
  appName: 'Concerto Playground',
  logoAlt: 'Accord Project',
  discord: 'Discord',
  discordTitle: 'Join our Discord',
  github: 'GitHub',
  githubTitle: 'View on GitHub',
} as const;

export const ERROR_BOUNDARY_STRINGS = {
  crashTitle: (label: string) => `The ${label} panel crashed`,
  crashBody:
    'The rest of the playground still works and your schema text is unchanged. The error below may point at what went wrong.',
  retry: 'Try again',
} as const;

export const OUTPUT_STRINGS = {
  more: 'More',
  copy: 'Copy',
  copied: 'Copied!',
  staticPreview: 'static preview',
  parseError: 'Parse error',
  generating: 'Generating…',
  docsLink: 'Docs ↗',
} as const;

export const FORM_STRINGS = {
  treeTitle: 'Model Tree',
  addNamespaceTitle: 'Add namespace',
  removeNamespaceTitle: 'Remove namespace',
  addDeclaration: '+ add declaration',
  addValue: 'add value',
  addProperty: 'add property',
  placeholder: 'Select an item from the tree',
  sectionNamespace: 'Namespace',
  sectionDeclaration: 'Declaration',
  sectionEnum: 'Enum',
  sectionProperty: 'Property',
  sectionEnumValue: 'Enum Value',
  enumValuesLabel: 'Enum Values',
  noValuesYet: 'No values yet',
  fieldName: 'Name',
  fieldValueName: 'Value name',
  fieldType: 'Type',
  fieldExtends: 'Extends',
  fieldIdentified: 'Identified',
  fieldIdentifiedBy: 'Identified by field',
  extendsNone: '(none)',
  identifiedNone: 'None',
  identifiedSystem: 'System identifier',
  identifiedByField: 'Identified by field',
  abstract: 'Abstract',
  optional: 'Optional',
  array: 'Array',
  relationship: 'Relationship',
  save: 'Save',
  delete: 'Delete',
  notSaved: (message: string) => `Not saved, Concerto rejected the change: ${message}`,
  namespacePlaceholder: 'org.example@1.0.0',
  enumNamePlaceholder: 'EnumName',
  conceptNamePlaceholder: 'ConceptName',
  propertyNamePlaceholder: 'propertyName',
  identifiedByPlaceholder: 'fieldName',
  enumValuePlaceholder: 'ENUM_VALUE',
} as const;

export const VALIDATION_STRINGS = {
  nameRequired: 'Name is required.',
  nameNoSpaces: (suggestion: string, name: string) =>
    `Names cannot contain spaces. Write "${suggestion}" instead of "${name}".`,
  nameFormat:
    'Names must be a single word starting with a letter, "_" or "$" (e.g. "myCarName").',
  namespaceRequired: 'Namespace is required.',
  namespaceFormat:
    'Namespaces must be dot-separated words with no spaces, plus an optional version, e.g. "org.example@1.0.0".',
} as const;
