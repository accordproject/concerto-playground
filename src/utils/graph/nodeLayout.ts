import type { Declaration, Decorator } from './types';

export interface GraphTargetHandle {
  id: string;
  top: number;
}

export const HANDLE_SIZE = 10;

export const CONTENT_PADDING_TOP = 6;
export const CONTENT_PADDING_BOTTOM = 8;
export const PROPERTY_ROW_HEIGHT = 34;
export const PROPERTY_ROW_GAP = 4;
export const ENUM_ROW_HEIGHT = 34;
export const MAP_ROW_HEIGHT = 34;
export const DETAIL_ROW_HEIGHT = 28;
export const ACTION_BUTTON_HEIGHT = 34;

const HEADER_BASE_HEIGHT = 70;
const HEADER_DECORATOR_HEIGHT = 20;
const HEADER_SUBTITLE_HEIGHT = 14;
const HEADER_IDENTITY_HEIGHT = 16;
const HEADER_SUPERTYPE_HEIGHT = 16;

const TERM_LABEL_DECLARATION_TYPES = new Set<Declaration['type']>([
  'concept',
  'enum',
  'asset',
  'participant',
  'transaction',
]);

export function unquoteDecoratorArgument(value: string): string {
  const trimmed = value.trim();
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];

  if ((first === '"' || first === "'") && last === first) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function getDisplayTermDecoratorIndex(decl: Declaration): number {
  if (!TERM_LABEL_DECLARATION_TYPES.has(decl.type)) return -1;

  return decl.decorators.findIndex((decorator) =>
    decorator.name === 'Term' &&
    !!decorator.args[0] &&
    !!unquoteDecoratorArgument(decorator.args[0]).trim()
  );
}

function getDisplayTermDecorator(decl: Declaration): Decorator | undefined {
  const index = getDisplayTermDecoratorIndex(decl);
  return index >= 0 ? decl.decorators[index] : undefined;
}

export function getDeclarationDisplayLabel(decl: Declaration): string {
  const term = getDisplayTermDecorator(decl);
  const label = term?.args[0] ? unquoteDecoratorArgument(term.args[0]).trim() : '';

  return label || decl.name;
}

export function getVisibleGraphDecorators(decl: Declaration): Decorator[] {
  const displayTermIndex = getDisplayTermDecoratorIndex(decl);

  if (displayTermIndex < 0) {
    return decl.decorators;
  }

  return decl.decorators.filter((_, index) => index !== displayTermIndex);
}

export function hasDisplaySubtitle(decl: Declaration): boolean {
  return getDeclarationDisplayLabel(decl) !== decl.name;
}

export function getNodeWidth(decl: Declaration): number {
  if (decl.type === 'map') return 210;
  if (decl.type === 'enum' || decl.type === 'scalar') return 200;
  return 250;
}

export function getHeaderHeight(decl: Declaration): number {
  let height = HEADER_BASE_HEIGHT;

  if (getVisibleGraphDecorators(decl).length) height += HEADER_DECORATOR_HEIGHT;
  if (hasDisplaySubtitle(decl)) height += HEADER_SUBTITLE_HEIGHT;
  if (decl.identified !== 'none') height += HEADER_IDENTITY_HEIGHT;
  if (decl.superType) height += HEADER_SUPERTYPE_HEIGHT;

  return height;
}

export function estimateNodeHeight(decl: Declaration): number {
  const headerHeight = getHeaderHeight(decl);

  if (decl.type === 'scalar') {
    const detailCount = [
      decl.scalarValidators?.default,
      decl.scalarValidators?.regex,
      decl.scalarValidators?.range,
      decl.scalarValidators?.length,
    ].filter(Boolean).length;

    return headerHeight
      + CONTENT_PADDING_TOP
      + Math.max(detailCount, 1) * DETAIL_ROW_HEIGHT
      + Math.max(Math.max(detailCount, 1) - 1, 0) * PROPERTY_ROW_GAP
      + CONTENT_PADDING_BOTTOM;
  }

  if (decl.type === 'enum') {
    const rowCount = Math.max(decl.enumValues.length, 1);

    return headerHeight
      + CONTENT_PADDING_TOP
      + rowCount * ENUM_ROW_HEIGHT
      + Math.max(rowCount - 1, 0) * PROPERTY_ROW_GAP
      + PROPERTY_ROW_GAP
      + ACTION_BUTTON_HEIGHT
      + CONTENT_PADDING_BOTTOM;
  }

  if (decl.type === 'map') {
    return headerHeight
      + CONTENT_PADDING_TOP
      + 2 * MAP_ROW_HEIGHT
      + PROPERTY_ROW_GAP
      + CONTENT_PADDING_BOTTOM;
  }

  const rowCount = Math.max(decl.properties.length, 1);

  return headerHeight
    + CONTENT_PADDING_TOP
    + rowCount * PROPERTY_ROW_HEIGHT
    + Math.max(rowCount - 1, 0) * PROPERTY_ROW_GAP
    + PROPERTY_ROW_GAP
    + ACTION_BUTTON_HEIGHT
    + CONTENT_PADDING_BOTTOM;
}

export function getPropertyHandleTop(decl: Declaration, propertyIndex: number): number {
  return getHeaderHeight(decl)
    + CONTENT_PADDING_TOP
    + propertyIndex * (PROPERTY_ROW_HEIGHT + PROPERTY_ROW_GAP)
    + PROPERTY_ROW_HEIGHT / 2;
}

export function getMapValueHandleTop(decl: Declaration): number {
  return getHeaderHeight(decl)
    + CONTENT_PADDING_TOP
    + MAP_ROW_HEIGHT
    + PROPERTY_ROW_GAP
    + MAP_ROW_HEIGHT / 2;
}

/** CSS top for a handle on a collapsed (semantic zoom) node: handles spread
    proportionally along the edge because pixel offsets computed for the
    full-size node would land outside the shorter summary card. */
export function getCompactHandleTop(handleIndex: number, handleCount: number): string {
  return `${Math.round(((handleIndex + 1) / (handleCount + 1)) * 100)}%`;
}

export function getIncomingHandleTop(decl: Declaration, handleIndex: number, handleCount: number): number {
  const contentTop = getHeaderHeight(decl) + CONTENT_PADDING_TOP + 8;
  const contentBottom = estimateNodeHeight(decl) - CONTENT_PADDING_BOTTOM - 8;
  const usableHeight = Math.max(contentBottom - contentTop, PROPERTY_ROW_HEIGHT);

  return contentTop + usableHeight * ((handleIndex + 1) / (handleCount + 1));
}

export function getSourceHandleTop(decl: Declaration, handleId: string): number | null {
  if (handleId === 'bottom') {
    return estimateNodeHeight(decl);
  }

  if (decl.type === 'map' && handleId === 'prop:_value') {
    return getMapValueHandleTop(decl);
  }

  if (handleId.startsWith('prop:')) {
    const propName = handleId.slice('prop:'.length);
    const propIndex = decl.properties.findIndex((prop) => prop.name === propName);

    if (propIndex >= 0) {
      return getPropertyHandleTop(decl, propIndex);
    }
  }

  return null;
}

export function getTargetHandleTop(
  decl: Declaration,
  handleId: string,
  incomingHandles: GraphTargetHandle[] = [],
): number | null {
  if (handleId === 'top') {
    return 0;
  }

  if (handleId === 'left') {
    return estimateNodeHeight(decl) / 2;
  }

  const incomingHandle = incomingHandles.find((handle) => handle.id === handleId);
  return incomingHandle?.top ?? null;
}
