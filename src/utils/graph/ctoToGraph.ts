import type { Node, Edge } from '@xyflow/react';
import type { Declaration, ConcertoModel, ImportStatement, Property, PropertyValidator, Decorator, IdentifiedKind, ExternalTypeMap } from './types';
import { PRIMITIVE_TYPES } from './types';

import { Parser as ParserModule } from '@accordproject/concerto-cto';
import { ModelManager } from '@accordproject/concerto-core';
const META = 'concerto.metamodel@1.0.0';

export function parseCto(cto: string): ConcertoModel {
  const ast = ParserModule.parse(cto) as any;

  const namespace: string = ast.namespace;
  const imports = parseImports(ast.imports || []);
  const declarations = parseDeclarations(ast.declarations || []);

  return { namespace, imports, declarations };
}

/**
 * Finds where a type name is referenced in the source using the real parser's
 * AST (with source locations), rather than a text search. Used to point error
 * banners and markers at the culprit of a semantic error. Because the name and
 * position come from the official parser, this handles Unicode and `$`
 * identifiers correctly (a hand-rolled regex truncated "CharlesⅢ" to "Charles"
 * and could not match "$foo"). Returns the 1-based line/column, or null if the
 * source does not parse or the name is not referenced.
 */
export function locateTypeReference(
  source: string,
  name: string,
): { line: number; column: number } | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ast: any;
  try {
    ast = ParserModule.parse(source, undefined, { skipLocationNodes: false });
  } catch {
    return null;
  }
  const sourceLines = source.split(/\r?\n/);
  // The parser locates a property at its "o"/"-->" marker; refine the column to
  // the name itself with a literal search (indexOf, so it is Unicode/$-safe).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const at = (loc: any) => {
    if (!loc) return null;
    const line: number = loc.start.line;
    const idx = (sourceLines[line - 1] ?? '').indexOf(name);
    return { line, column: idx >= 0 ? idx + 1 : loc.start.column };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decls: any[] = ast.declarations || [];

  // Duplicate declaration name: point at the second (offending) occurrence.
  const sameName = decls.filter((d) => d.name === name);
  if (sameName.length > 1) return at(sameName[1].location);

  for (const d of decls) {
    if (d.superType && d.superType.name === name) return at(d.location);
    for (const p of d.properties || []) {
      if (p.type && p.type.name === name) return at(p.location);
    }
    if (d.key && d.key.name === name) return at(d.location);
    if (d.value && d.value.name === name) return at(d.location);
  }
  return null;
}

// Formats an error thrown by the Concerto parser for display. Concerto's
// ParseException carries structured fields (shortMessage, fileLocation), so
// prefer those over the free-form message text; fall back to the message for
// non-Concerto errors.
export function describeParseError(e: unknown): string {
  const err = e as {
    shortMessage?: string;
    fileLocation?: { start?: { line?: number; column?: number } };
  };
  const start = err.fileLocation?.start;
  if (err.shortMessage && start?.line != null) {
    return `${err.shortMessage} Line ${start.line} column ${start.column}`;
  }
  return e instanceof Error ? e.message : String(e);
}

export function validateCto(cto: string, peers: string[] = []): string | null {
  try {
    const mm = new ModelManager();
    // Load peer models first (validation disabled) so cross-namespace imports resolve
    peers.forEach((peer, i) => mm.addCTOModel(peer, `peer${i}.cto`, true));
    mm.addCTOModel(cto, 'model.cto');
    return null;
  } catch (e: any) {
    const message: string = e.message || 'Validation failed';
    // 'model.cto' is the internal name this function gives the model above;
    // it means nothing to the user, so drop that fragment from the message.
    return message.replace(/\s*File '?model\.cto'?:?\s*/g, ' ').trim();
  }
}

function parseImports(astImports: any[]): ImportStatement[] {
  return astImports.map((imp: any) => {
    const $class: string = imp.$class;
    if ($class === `${META}.ImportAll` || $class === `${META}.ImportAllFrom`) {
      return { namespace: imp.namespace, types: ['*'], uri: imp.uri };
    }
    if ($class === `${META}.ImportTypes`) {
      return { namespace: imp.namespace, types: imp.types || [], uri: imp.uri };
    }
    return { namespace: imp.namespace, types: [imp.name], uri: imp.uri };
  });
}

/**
 * Classify every type name reachable through a model's import statements.
 * A type is resolved when its namespace is open in the workspace and actually
 * declares it; otherwise it is kept with resolved=false so the UI can show a
 * "Namespace unresolved" warning instead of a broken link.
 */
export function buildExternalTypeMap(
  imports: ImportStatement[],
  workspaceDeclarations: Record<string, string[]>,
): ExternalTypeMap {
  const map: ExternalTypeMap = {};
  for (const imp of imports) {
    const peerDecls = workspaceDeclarations[imp.namespace];
    if (imp.types.length === 1 && imp.types[0] === '*') {
      // Wildcard import: the individual names are only knowable when the
      // namespace is open in the workspace.
      for (const name of peerDecls ?? []) {
        map[name] = { namespace: imp.namespace, resolved: true };
      }
    } else {
      for (const name of imp.types) {
        map[name] = {
          namespace: imp.namespace,
          resolved: peerDecls != null && peerDecls.includes(name),
        };
      }
    }
  }
  return map;
}

function parseDeclarations(astDecls: any[]): Declaration[] {
  return astDecls.map((decl: any) => {
    const $class: string = decl.$class;
    const decorators = parseDecorators(decl.decorators || []);

    if ($class.includes('Scalar')) {
      const scalarType = $class.replace(`${META}.`, '').replace('Scalar', '');
      return {
        name: decl.name,
        type: 'scalar' as const,
        isAbstract: false,
        properties: [],
        enumValues: [],
        scalarExtends: scalarType,
        scalarValidators: parseScalarValidators(decl),
        identified: 'none' as IdentifiedKind,
        decorators,
      };
    }

    if ($class === `${META}.MapDeclaration`) {
      const keyType = extractMapType(decl.key);
      const valueType = extractMapType(decl.value);
      return {
        name: decl.name,
        type: 'map' as const,
        isAbstract: false,
        properties: [
          { name: '_key', type: keyType, isOptional: false, isArray: false, isRelationship: false, validators: {} },
          { name: '_value', type: valueType, isOptional: false, isArray: false, isRelationship: false, validators: {} },
        ],
        enumValues: [],
        mapDeclaration: { keyType, valueType },
        identified: 'none' as IdentifiedKind,
        decorators,
      };
    }

    if ($class === `${META}.EnumDeclaration`) {
      return {
        name: decl.name,
        type: 'enum' as const,
        isAbstract: false,
        properties: [],
        enumValues: (decl.properties || []).map((p: any) => p.name),
        identified: 'none' as IdentifiedKind,
        decorators,
      };
    }

    const typeMap: Record<string, Declaration['type']> = {
      [`${META}.ConceptDeclaration`]: 'concept',
      [`${META}.AssetDeclaration`]: 'asset',
      [`${META}.ParticipantDeclaration`]: 'participant',
      [`${META}.EventDeclaration`]: 'event',
      [`${META}.TransactionDeclaration`]: 'transaction',
    };
    const type = typeMap[$class] || 'concept';

    let identified: IdentifiedKind = 'none';
    let identifiedBy: string | undefined;
    if (decl.identified) {
      if (decl.identified.$class === `${META}.IdentifiedBy`) {
        identified = 'identified-by';
        identifiedBy = decl.identified.name;
      } else {
        identified = 'identified';
      }
    }

    return {
      name: decl.name,
      type,
      isAbstract: !!decl.isAbstract,
      superType: decl.superType?.name,
      superTypeNamespace: decl.superType?.namespace,
      properties: (decl.properties || []).map(parseProperty),
      enumValues: [],
      identified,
      identifiedBy,
      decorators,
    };
  });
}

function parseProperty(p: any): Property {
  const $class: string = p.$class;
  const isRelationship = $class === `${META}.RelationshipProperty`;

  let type: string;
  let typeNamespace: string | undefined;
  if ($class === `${META}.ObjectProperty` || isRelationship) {
    type = p.type?.name || 'String';
    typeNamespace = p.type?.namespace;
  } else {
    type = $class.replace(`${META}.`, '').replace('Property', '');
  }

  const validators: PropertyValidator = {};

  if (p.defaultValue != null) validators.default = JSON.stringify(p.defaultValue);

  if (p.validator) {
    if (p.validator.pattern) {
      validators.regex = `/${p.validator.pattern}/${p.validator.flags || ''}`;
    }
    if (p.validator.lower != null || p.validator.upper != null) {
      validators.range = `[${p.validator.lower ?? ''},${p.validator.upper ?? ''}]`;
    }
  }

  if (p.lengthValidator) {
    validators.length = `[${p.lengthValidator.minLength ?? ''},${p.lengthValidator.maxLength ?? ''}]`;
  }

  return {
    name: p.name,
    type,
    typeNamespace,
    isOptional: !!p.isOptional,
    isArray: !!p.isArray,
    isRelationship,
    validators,
  };
}

function parseDecorators(astDecorators: any[]): Decorator[] {
  return astDecorators.map((d: any) => ({
    name: d.name,
    args: (d.arguments || []).map((a: any) => {
      if (a.$class === `${META}.DecoratorString`) return `"${a.value}"`;
      if (a.$class === `${META}.DecoratorTypeReference`) return a.type?.name || '';
      return String(a.value);
    }),
  }));
}

function parseScalarValidators(decl: any): PropertyValidator {
  const v: PropertyValidator = {};
  if (decl.defaultValue != null) v.default = JSON.stringify(decl.defaultValue);
  if (decl.validator) {
    if (decl.validator.pattern) v.regex = `/${decl.validator.pattern}/${decl.validator.flags || ''}`;
    if (decl.validator.lower != null || decl.validator.upper != null) {
      v.range = `[${decl.validator.lower ?? ''},${decl.validator.upper ?? ''}]`;
    }
  }
  if (decl.lengthValidator) {
    v.length = `[${decl.lengthValidator.minLength ?? ''},${decl.lengthValidator.maxLength ?? ''}]`;
  }
  return v;
}

function extractMapType(mapEntry: any): string {
  if (mapEntry.type) return mapEntry.type.name;
  const $class: string = mapEntry.$class;
  return $class.replace(`${META}.`, '').replace(/Map(Key|Value)Type$/, '');
}

function estimateNodeHeight(decl: Declaration): number {
  let headerHeight = 70;
  const rowHeight = 30;
  const buttonHeight = 36;
  const padding = 16;

  if (decl.decorators?.length > 0) headerHeight += 20;
  if (decl.identified !== 'none') headerHeight += 16;
  if (decl.superType) headerHeight += 16;

  if (decl.type === 'scalar') {
    const constraintRows = [decl.scalarValidators?.default, decl.scalarValidators?.regex, decl.scalarValidators?.range, decl.scalarValidators?.length].filter(Boolean).length;
    return 80 + Math.max(constraintRows, 1) * rowHeight;
  }
  if (decl.type === 'enum') return headerHeight + Math.max(decl.enumValues.length, 1) * rowHeight + buttonHeight + padding;
  if (decl.type === 'map') return headerHeight + 2 * rowHeight + padding;
  return headerHeight + Math.max(decl.properties.length, 1) * rowHeight + buttonHeight + padding;
}

function computeTreeLayout(declarations: Declaration[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (declarations.length === 0) return positions;

  const declNames = new Set(declarations.map((d) => d.name));

  const refsFrom = new Map<string, Set<string>>();
  const refsTo = new Map<string, Set<string>>();

  for (const decl of declarations) {
    if (!refsFrom.has(decl.name)) refsFrom.set(decl.name, new Set());

    if (decl.superType && declNames.has(decl.superType)) {
      refsFrom.get(decl.name)!.add(decl.superType);
      if (!refsTo.has(decl.superType)) refsTo.set(decl.superType, new Set());
      refsTo.get(decl.superType)!.add(decl.name);
    }

    if (decl.scalarExtends && declNames.has(decl.scalarExtends)) {
      refsFrom.get(decl.name)!.add(decl.scalarExtends);
    }

    const props = decl.type === 'map'
      ? decl.properties.filter((p) => p.name === '_value')
      : decl.properties;
    for (const prop of props) {
      if (declNames.has(prop.type) && !PRIMITIVE_TYPES.has(prop.type) && prop.type !== decl.name) {
        refsFrom.get(decl.name)!.add(prop.type);
        if (!refsTo.has(prop.type)) refsTo.set(prop.type, new Set());
        refsTo.get(prop.type)!.add(decl.name);
      }
    }
  }

  let root = declarations[0].name;
  let maxScore = -Infinity;
  for (const decl of declarations) {
    const outCount = refsFrom.get(decl.name)?.size || 0;
    const inCount = refsTo.get(decl.name)?.size || 0;
    const score = outCount * 2 - inCount;
    if (score > maxScore) { maxScore = score; root = decl.name; }
  }

  const visited = new Set<string>();
  const layers: string[][] = [];
  let queue = [root];
  visited.add(root);

  while (queue.length > 0) {
    layers.push([...queue]);
    const nextQueue: string[] = [];
    for (const name of queue) {
      const outRefs = refsFrom.get(name) || new Set();
      const inRefs = refsTo.get(name) || new Set();
      for (const connected of new Set([...outRefs, ...inRefs])) {
        if (!visited.has(connected)) { visited.add(connected); nextQueue.push(connected); }
      }
    }
    queue = nextQueue;
  }

  const unvisited = declarations.filter((d) => !visited.has(d.name)).map((d) => d.name);
  if (unvisited.length > 0) layers.push(unvisited);

  const heights = new Map<string, number>();
  for (const decl of declarations) heights.set(decl.name, estimateNodeHeight(decl));

  const spacingX = 380;
  const gapY = 40;

  for (let depth = 0; depth < layers.length; depth++) {
    const layer = layers[depth];
    let totalHeight = 0;
    for (const name of layer) totalHeight += heights.get(name) || 150;
    totalHeight += (layer.length - 1) * gapY;
    let currentY = -totalHeight / 2;
    for (const name of layer) {
      const h = heights.get(name) || 150;
      positions.set(name, { x: depth * spacingX, y: currentY });
      currentY += h + gapY;
    }
  }

  return positions;
}

/** Workspace context used to render imported (foreign namespace) types. */
export interface GraphContext {
  /** Short name to owning-namespace info, built from the model's imports. */
  externalTypes?: ExternalTypeMap;
  /** Declared type names per open namespace, for qualified references. */
  workspaceDeclarations?: Record<string, string[]>;
}

interface ExternalRef {
  id: string;
  name: string;
  namespace: string;
  resolved: boolean;
}

const EXTERNAL_NODE_HEIGHT = 100;

export function declarationsToGraph(declarations: Declaration[], context: GraphContext = {}): { nodes: Node[]; edges: Edge[] } {
  const { externalTypes = {}, workspaceDeclarations = {} } = context;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const declNames = new Set(declarations.map((d) => d.name));
  const positions = computeTreeLayout(declarations);

  // Resolve a type reference that does not point at a local declaration:
  // either a namespace-qualified name or a name brought in by an import.
  // Imported nodes get namespace-qualified ids so they cannot collide with
  // local declaration names.
  const externalFor = (typeName: string, explicitNs?: string): ExternalRef | undefined => {
    if (PRIMITIVE_TYPES.has(typeName)) return undefined;
    if (explicitNs) {
      const peerDecls = workspaceDeclarations[explicitNs];
      return {
        id: `${explicitNs}.${typeName}`,
        name: typeName,
        namespace: explicitNs,
        resolved: peerDecls != null && peerDecls.includes(typeName),
      };
    }
    if (declNames.has(typeName)) return undefined;
    const info = externalTypes[typeName];
    return info
      ? { id: `${info.namespace}.${typeName}`, name: typeName, namespace: info.namespace, resolved: info.resolved }
      : undefined;
  };

  // Imported types referenced by at least one declaration, keyed by node id.
  const externalNodes = new Map<string, ExternalRef>();
  const registerExternal = (typeName: string, explicitNs?: string): ExternalRef | undefined => {
    const ext = externalFor(typeName, explicitNs);
    if (ext && !externalNodes.has(ext.id)) externalNodes.set(ext.id, ext);
    return ext;
  };

  const isLocal = (typeName: string, explicitNs?: string) =>
    !explicitNs && declNames.has(typeName) && !PRIMITIVE_TYPES.has(typeName);

  declarations.forEach((decl) => {
    let nodeType = 'conceptNode';
    if (decl.type === 'enum') nodeType = 'enumNode';
    else if (decl.type === 'map') nodeType = 'mapNode';
    else if (decl.type === 'scalar') nodeType = 'scalarNode';

    const pos = positions.get(decl.name) || { x: 0, y: 0 };
    const propsToEdge = decl.type === 'map'
      ? decl.properties.filter((p) => p.name === '_value')
      : decl.properties;
    const edgeProperties = propsToEdge
      .filter((p) => isLocal(p.type, p.typeNamespace) || externalFor(p.type, p.typeNamespace))
      .map((p) => p.name);

    nodes.push({
      id: decl.name,
      type: nodeType,
      position: pos,
      data: { label: decl.name, declaration: decl, edgeProperties },
    });

    if (decl.superType) {
      const superTarget = isLocal(decl.superType, decl.superTypeNamespace)
        ? decl.superType
        : registerExternal(decl.superType, decl.superTypeNamespace)?.id;
      if (superTarget) {
        edges.push({
          id: `${decl.name}-extends-${superTarget}`,
          source: decl.name, target: superTarget,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'floating', animated: true,
          label: 'extends',
          style: { stroke: '#b794f4', strokeWidth: 1.5, opacity: 0.7, animationDirection: 'reverse' },
          labelStyle: { fill: '#b794f4', fontSize: 10, fontWeight: 600 },
          labelBgStyle: { fill: '#1a202c', fillOpacity: 0.8 },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
        });
      }
    }

    for (const prop of propsToEdge) {
      const propTarget = isLocal(prop.type, prop.typeNamespace)
        ? prop.type
        : registerExternal(prop.type, prop.typeNamespace)?.id;
      if (propTarget) {
        const isRel = prop.isRelationship;
        edges.push({
          id: `${decl.name}-${prop.name}-${propTarget}`,
          source: decl.name, target: propTarget,
          sourceHandle: `prop:${prop.name}`,
          targetHandle: 'left',
          label: prop.name.startsWith('_') ? '' : prop.name + (prop.isArray ? '[]' : ''),
          type: 'floating',
          style: {
            stroke: isRel ? '#fc8181' : '#90cdf4',
            strokeWidth: isRel ? 1.5 : 1.2,
            opacity: 0.6,
            strokeDasharray: isRel ? '6 4' : undefined,
          },
          labelStyle: { fill: isRel ? '#fc8181' : '#90cdf4', fontSize: 10, fontWeight: 500 },
          labelBgStyle: { fill: '#1a202c', fillOpacity: 0.8 },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
        });
      }
    }
  });

  // Imported types get their own column to the right of the local layout so
  // they read as external to the current file.
  if (externalNodes.size > 0) {
    let maxX = 0;
    for (const pos of positions.values()) maxX = Math.max(maxX, pos.x);
    const externalX = declarations.length > 0 ? maxX + 380 : 0;
    const externals = [...externalNodes.values()];
    const gapY = 40;
    const totalHeight = externals.length * EXTERNAL_NODE_HEIGHT + (externals.length - 1) * gapY;
    let y = -totalHeight / 2;
    for (const ext of externals) {
      nodes.push({
        id: ext.id,
        type: 'importedNode',
        position: { x: externalX, y },
        data: { label: ext.name, namespace: ext.namespace, resolved: ext.resolved },
      });
      y += EXTERNAL_NODE_HEIGHT + gapY;
    }
  }

  return { nodes, edges };
}
