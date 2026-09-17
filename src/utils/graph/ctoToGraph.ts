import type { Node, Edge } from '@xyflow/react';
import type { Declaration, ConcertoModel, ImportStatement, Property, PropertyValidator, Decorator, IdentifiedKind, ExternalTypeMap } from './types';
import {
  PRIMITIVE_TYPES,
  NODE_KIND_BY_DECLARATION,
  GRAPH_NODE_KIND,
  GRAPH_EDGE_KIND,
  HANDLE_ID,
  MAP_VALUE_PROP,
  propHandleId,
} from './types';
import type { ElkNode, ElkPort } from 'elkjs/lib/elk-api';
import {
  HANDLE_SIZE,
  estimateNodeHeight,
  getDeclarationDisplayLabel,
  getIncomingHandleTop,
  getMapValueHandleTop,
  getNodeWidth,
  getPropertyHandleTop,
  getVisibleGraphDecorators,
  hasDisplaySubtitle,
  unquoteDecoratorArgument,
  type GraphTargetHandle,
} from './nodeLayout';

export {
  getDeclarationDisplayLabel,
  getVisibleGraphDecorators,
  hasDisplaySubtitle,
  unquoteDecoratorArgument,
};
import { declarationEqual, stringArrayEqual } from './modelDiff';

import { Parser as ParserModule } from '@accordproject/concerto-cto';
import { ModelManager } from '@accordproject/concerto-core';
const META = 'concerto.metamodel@1.0.0';
const HANDLE_RADIUS = HANDLE_SIZE / 2;
type LayoutPositions = Map<string, { x: number; y: number }>;
type GraphShape = { nodes: Node[]; edges: Edge[] };
type NodeDimensions = Map<string, { width: number; height: number }>;
type AutoLayoutFn = (
  declarations: Declaration[],
  graph: GraphShape,
  nodeDimensions: NodeDimensions,
) => LayoutPositions | Promise<LayoutPositions>;
type GraphNodeData = {
  declaration: Declaration;
};

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
          { name: MAP_VALUE_PROP, type: valueType, isOptional: false, isArray: false, isRelationship: false, validators: {} },
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

export function getDeclarationPosition(decl: Declaration): { x: number; y: number } | null {
  const decorator = decl.decorators.find((item) => item.name === 'Position');
  if (!decorator || decorator.args.length < 2) return null;

  const x = Number(decorator.args[0]);
  const y = Number(decorator.args[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return { x, y };
}

export function withDeclarationPositions(
  declarations: Declaration[],
  positions: Map<string, { x: number; y: number }>,
): Declaration[] {
  return declarations.map((decl) => {
    const position = positions.get(decl.name);
    if (!position) return decl;

    const decorators = decl.decorators.filter((item) => item.name !== 'Position');
    decorators.push({
      name: 'Position',
      args: [String(Math.round(position.x)), String(Math.round(position.y))],
    });

    return { ...decl, decorators };
  });
}

export function withSourcePositions(
  source: string,
  positions: Map<string, { x: number; y: number }>,
): string {
  const ast = ParserModule.parse(source, undefined, { skipLocationNodes: false }) as any;
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const edits: Array<{ start: number; end: number; text: string }> = [];

  for (const declaration of ast.declarations ?? []) {
    const position = positions.get(declaration.name);
    if (!position) continue;

    const x = Number(position.x.toFixed(2));
    const y = Number(position.y.toFixed(2));
    const text = `@Position(${x}, ${y})`;
    const existing = declaration.decorators?.find((decorator: any) => decorator.name === 'Position');
    if (existing?.location) {
      edits.push({
        start: existing.location.start.offset,
        end: existing.location.end.offset,
        text,
      });
      continue;
    }

    const decorators = declaration.decorators ?? [];
    const lastDecorator = decorators[decorators.length - 1];
    const offset = lastDecorator?.location?.end?.offset ?? declaration.location.start.offset;
    edits.push({
      start: offset,
      end: offset,
      text: lastDecorator ? `${newline}${text}` : `${text}${newline}`,
    });
  }

  return edits
    .sort((left, right) => right.start - left.start)
    .reduce(
      (updated, edit) => updated.slice(0, edit.start) + edit.text + updated.slice(edit.end),
      source,
    );
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
      ? decl.properties.filter((p) => p.name === MAP_VALUE_PROP)
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

type GraphRefs = {
  refsFrom: Map<string, Set<string>>;
  refsTo: Map<string, Set<string>>;
};

function buildGraphRefs(declarations: Declaration[]): GraphRefs {
  const declNames = new Set(declarations.map((decl) => decl.name));
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
      if (!refsTo.has(decl.scalarExtends)) refsTo.set(decl.scalarExtends, new Set());
      refsTo.get(decl.scalarExtends)!.add(decl.name);
    }

    const props = decl.type === 'map'
      ? decl.properties.filter((prop) => prop.name === '_value')
      : decl.properties;
    for (const prop of props) {
      if (!declNames.has(prop.type) || PRIMITIVE_TYPES.has(prop.type) || prop.type === decl.name) continue;
      refsFrom.get(decl.name)!.add(prop.type);
      if (!refsTo.has(prop.type)) refsTo.set(prop.type, new Set());
      refsTo.get(prop.type)!.add(decl.name);
    }
  }

  return { refsFrom, refsTo };
}

export async function computeAutoLayoutPositions(
  declarations: Declaration[],
  nodeDimensionsOrLayoutFn: NodeDimensions | AutoLayoutFn = computeElkLayout,
  layoutFn: AutoLayoutFn = computeElkLayout,
): Promise<LayoutPositions> {
  const treeFallback = computeTreeLayout(declarations);
  if (declarations.length === 0) return treeFallback;

  const graph = declarationsToGraph(declarations);
  const nodeDimensions = typeof nodeDimensionsOrLayoutFn === 'function'
    ? new Map<string, { width: number; height: number }>()
    : nodeDimensionsOrLayoutFn;
  const resolvedLayoutFn = typeof nodeDimensionsOrLayoutFn === 'function'
    ? nodeDimensionsOrLayoutFn
    : layoutFn;

  try {
    const positions = await resolvedLayoutFn(declarations, graph, nodeDimensions);
    if (hasUsablePositions(positions, declarations.length)) return positions;
  } catch {
    // Fall back to the current layered layout when ELK is unavailable or unstable.
  }

  const layeredFallback = computeLayeredLayout(declarations);
  return hasUsablePositions(layeredFallback, declarations.length) ? layeredFallback : treeFallback;
}

function computeLayeredLayout(declarations: Declaration[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const { refsFrom, refsTo } = buildGraphRefs(declarations);
  const declMap = new Map(declarations.map((decl) => [decl.name, decl]));
  const roots = declarations
    .filter((decl) => (refsFrom.get(decl.name)?.size || 0) === 0)
    .map((decl) => decl.name);
  const queue = roots.length > 0 ? [...roots] : [declarations[0].name];
  const depthByName = new Map<string, number>(queue.map((name) => [name, 0]));
  const visited = new Set(queue);

  while (queue.length > 0) {
    const name = queue.shift()!;
    const depth = depthByName.get(name) || 0;

    for (const child of refsTo.get(name) || []) {
      const nextDepth = depth + 1;
      const currentDepth = depthByName.get(child);
      if (currentDepth == null || nextDepth > currentDepth) {
        depthByName.set(child, nextDepth);
      }
      if (!visited.has(child)) {
        visited.add(child);
        queue.push(child);
      }
    }
  }

  declarations.forEach((decl) => {
    if (!depthByName.has(decl.name)) depthByName.set(decl.name, 0);
  });

  const layers = new Map<number, string[]>();
  declarations.forEach((decl) => {
    const depth = depthByName.get(decl.name) || 0;
    const layer = layers.get(depth) || [];
    layer.push(decl.name);
    layers.set(depth, layer);
  });

  const orderedDepths = [...layers.keys()].sort((left, right) => left - right);
  const orderByName = new Map<string, number>();
  const spacingX = 320;
  const gapY = 72;

  orderedDepths.forEach((depth) => {
    const layer = layers.get(depth)!;
    layer.sort((left, right) => {
      const leftRefs = [...(refsFrom.get(left) || [])].filter((name) => orderByName.has(name));
      const rightRefs = [...(refsFrom.get(right) || [])].filter((name) => orderByName.has(name));
      const leftScore = leftRefs.length > 0
        ? leftRefs.reduce((sum, name) => sum + (orderByName.get(name) || 0), 0) / leftRefs.length
        : Number.MAX_SAFE_INTEGER;
      const rightScore = rightRefs.length > 0
        ? rightRefs.reduce((sum, name) => sum + (orderByName.get(name) || 0), 0) / rightRefs.length
        : Number.MAX_SAFE_INTEGER;

      if (leftScore !== rightScore) return leftScore - rightScore;
      return left.localeCompare(right);
    });

    let currentY = 0;
    layer.forEach((name, index) => {
      orderByName.set(name, index);
      const decl = declMap.get(name);
      if (!decl) return;
      positions.set(name, { x: depth * spacingX, y: currentY });
      currentY += estimateNodeHeight(decl) + gapY;
    });
  });

  return positions;
}

function getEdgeableProperties(decl: Declaration): Property[] {
  return decl.type === 'map'
    ? decl.properties.filter((prop) => prop.name === MAP_VALUE_PROP)
    : decl.properties;
}

function getPortRef(nodeId: string, handleId: string): string {
  return `${nodeId}:${handleId}`;
}

function getNodeDimension(
  declaration: Declaration,
  nodeDimensions: NodeDimensions,
): { width: number; height: number } {
  const measured = nodeDimensions.get(declaration.name);
  return measured ?? {
    width: getNodeWidth(declaration),
    height: estimateNodeHeight(declaration),
  };
}

function buildElkLayoutOptions(graph: GraphShape, nodeDimensions: NodeDimensions): Record<string, string> {
  const declarations = graph.nodes.map((node) => ((node.data as GraphNodeData).declaration));
  const maxNodeWidth = declarations.reduce(
    (maxWidth, declaration) => Math.max(maxWidth, getNodeDimension(declaration, nodeDimensions).width),
    0,
  );
  const maxNodeHeight = declarations.reduce(
    (maxHeight, declaration) => Math.max(maxHeight, getNodeDimension(declaration, nodeDimensions).height),
    0,
  );
  const paddingX = Math.max(40, Math.floor(maxNodeWidth * 0.2));
  const paddingY = Math.max(40, Math.floor(maxNodeHeight * 0.2));
  // The lane router in routeGraphEdges prefers a corridor of ~180px between
  // layers, but it compresses lanes into tighter gaps, so the layout can stay
  // denser than the ideal corridor; density matters more for the zoomed-out
  // overview than perfectly spread lanes.
  const betweenLayerSpacing = Math.min(200, Math.max(140, Math.floor(maxNodeWidth * 0.25)));
  const nodeSpacing = Math.min(40, Math.max(24, Math.floor(maxNodeHeight * 0.25)));

  return {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.spacing.nodeNodeBetweenLayers': String(betweenLayerSpacing),
    'elk.spacing.nodeNode': String(nodeSpacing),
    'elk.spacing.edgeNode': '16',
    'elk.padding': `[top=${paddingY},left=${paddingX},bottom=${paddingY},right=${paddingX}]`,
    'org.eclipse.elk.layered.wrapping.strategy': 'MULTI_EDGE',
    'org.eclipse.elk.aspectRatio': '1.6',
    'org.eclipse.elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    'org.eclipse.elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
  };
}

function createPort(
  nodeId: string,
  handleId: string,
  x: number,
  y: number,
  side: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST',
): ElkPort {
  return {
    id: getPortRef(nodeId, handleId),
    width: HANDLE_RADIUS * 2,
    height: HANDLE_RADIUS * 2,
    x,
    y,
    layoutOptions: {
      'org.eclipse.elk.port.side': side,
    },
  };
}

function buildElkPorts(
  decl: Declaration,
  edgeProperties: string[],
  incomingHandles: GraphTargetHandle[],
  nodeDimensions: NodeDimensions,
): ElkPort[] {
  const { width: nodeWidth, height: nodeHeight } = getNodeDimension(decl, nodeDimensions);
  const ports: ElkPort[] = [
    createPort(decl.name, 'top', nodeWidth / 2 - HANDLE_RADIUS, -HANDLE_RADIUS, 'NORTH'),
    createPort(decl.name, 'bottom', nodeWidth / 2 - HANDLE_RADIUS, nodeHeight - HANDLE_RADIUS, 'SOUTH'),
  ];

  incomingHandles.forEach((handle) => {
    ports.push(createPort(decl.name, handle.id, -HANDLE_RADIUS, handle.top - HANDLE_RADIUS, 'WEST'));
  });

  if (decl.type === 'map') {
    if (edgeProperties.includes('_value')) {
      ports.push(
        createPort(
          decl.name,
          'prop:_value',
          nodeWidth - HANDLE_RADIUS,
          getMapValueHandleTop(decl) - HANDLE_RADIUS,
          'EAST',
        ),
      );
    }
    return ports;
  }

  decl.properties.forEach((prop, index) => {
    if (!edgeProperties.includes(prop.name)) return;

    ports.push(
      createPort(
        decl.name,
        `prop:${prop.name}`,
        nodeWidth - HANDLE_RADIUS,
        getPropertyHandleTop(decl, index) - HANDLE_RADIUS,
        'EAST',
      ),
    );
  });

  return ports;
}

type ElkInstance = { layout: (graph: ElkNode) => Promise<ElkNode> };
let elkInstancePromise: Promise<ElkInstance> | null = null;

// ELK layout is CPU-heavy on large models, so run it in a web worker and keep
// the UI responsive. The single-thread bundled build covers environments
// without Worker support (unit tests run in node).
function getElk(): Promise<ElkInstance> {
  elkInstancePromise ??= (async () => {
    if (typeof Worker !== 'undefined') {
      try {
        const [{ default: ELK }, { default: ElkWorker }] = await Promise.all([
          import('elkjs/lib/elk-api.js'),
          import('elkjs/lib/elk-worker.min.js?worker'),
        ]);
        return new ELK({ workerFactory: () => new ElkWorker() });
      } catch {
        // Fall through to the bundled single-thread build.
      }
    }
    const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
    return new ELK();
  })();
  return elkInstancePromise;
}

async function computeElkLayout(
  declarations: Declaration[],
  graph: GraphShape,
  nodeDimensions: NodeDimensions,
): Promise<LayoutPositions> {
  const graphNodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const elkNodeNames = new Set(graph.nodes.map((node) => node.id));
  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: buildElkLayoutOptions(graph, nodeDimensions),
    children: declarations.map((decl) => {
      const node = graphNodeById.get(decl.name);
      const incomingHandles = (node?.data as { incomingHandles?: GraphTargetHandle[] } | undefined)?.incomingHandles ?? [];
      const edgeProperties = getEdgeableProperties(decl)
        .filter((prop) => elkNodeNames.has(prop.type) && !PRIMITIVE_TYPES.has(prop.type))
        .map((prop) => prop.name);
      const { width, height } = getNodeDimension(decl, nodeDimensions);

      return {
        id: decl.name,
        width,
        height,
        layoutOptions: {
          'org.eclipse.elk.portConstraints': 'FIXED_POS',
        },
        ports: buildElkPorts(decl, edgeProperties, incomingHandles, nodeDimensions),
      };
    }),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      sources: [getPortRef(edge.source, edge.sourceHandle || 'bottom')],
      targets: [getPortRef(edge.target, edge.targetHandle || 'top')],
    })),
  };

  const elk = await getElk();
  const layoutedGraph = await elk.layout(elkGraph);
  const positions: LayoutPositions = new Map();

  for (const child of layoutedGraph.children ?? []) {
    const { x, y } = child;
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    positions.set(child.id, { x, y });
  }

  return positions;
}

function hasUsablePositions(positions: LayoutPositions, expectedCount: number): boolean {
  if (positions.size !== expectedCount) return false;

  for (const position of positions.values()) {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      return false;
    }
  }

  return true;
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
const EXTERNAL_NODE_WIDTH = 220;
const NODE_ESTIMATED_WIDTH = 260;

/**
 * The previous graph state, used for incremental updates. When provided (and
 * it overlaps the new declarations), unchanged declarations keep their exact
 * node objects, changed ones keep their position, and only new declarations
 * get a locally computed position. The full tree layout runs only for a new
 * graph, so an edit never rearranges what the user already sees.
 */
export interface PreviousGraph {
  nodes: Node[];
  edges: Edge[];
}

export function declarationsToGraph(
  declarations: Declaration[],
  context: GraphContext = {},
  previous?: PreviousGraph,
): { nodes: Node[]; edges: Edge[] } {
  const { externalTypes = {}, workspaceDeclarations = {} } = context;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const declNames = new Set(declarations.map((d) => d.name));
  const declByName = new Map(declarations.map((decl) => [decl.name, decl]));
  const incomingHandlesByDecl = new Map<string, GraphTargetHandle[]>();

  const prevById = new Map((previous?.nodes ?? []).map((n) => [n.id, n]));
  const prevEdgesById = new Map((previous?.edges ?? []).map((e) => [e.id, e]));
  // A previous graph that shares no ids with the new declarations is a
  // different model (e.g. a namespace switch), not an edit: lay out fresh.
  const incremental =
    prevById.size > 0 && declarations.some((d) => prevById.has(d.name));
  const positions = incremental ? null : computeTreeLayout(declarations);

  // New nodes in an incremental update stack in a column to the right of
  // everything that exists, so nothing the user placed or sees moves.
  let newNodeCursor: { x: number; y: number } | null = null;
  const nextNewPosition = (height: number): { x: number; y: number } => {
    if (!newNodeCursor) {
      let maxX = 0;
      for (const n of previous?.nodes ?? []) maxX = Math.max(maxX, n.position.x);
      newNodeCursor = { x: maxX + 380, y: 0 };
    }
    const pos = { ...newNodeCursor };
    newNodeCursor.y += height + 40;
    return pos;
  };

  // Reuses the previous edge object when nothing it renders changed, so
  // memoized edge internals in React Flow can skip work too.
  const pushEdge = (edge: Edge) => {
    const prev = prevEdgesById.get(edge.id);
    const prevStyle = prev?.style as { stroke?: string; strokeDasharray?: string } | undefined;
    const nextStyle = edge.style as { stroke?: string; strokeDasharray?: string } | undefined;
    if (
      prev &&
      prev.label === edge.label &&
      prevStyle?.stroke === nextStyle?.stroke &&
      prevStyle?.strokeDasharray === nextStyle?.strokeDasharray
    ) {
      edges.push(prev);
      return;
    }
    edges.push(edge);
  };

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
    const propsToEdge = getEdgeableProperties(decl);

    propsToEdge.forEach((prop) => {
      if (!isLocal(prop.type, prop.typeNamespace)) return;
      if (!declByName.has(prop.type)) return;

      const targetHandles = incomingHandlesByDecl.get(prop.type) ?? [];
      targetHandles.push({
        id: getIncomingTargetHandleId(decl.name, prop.name),
        top: 0,
      });
      incomingHandlesByDecl.set(prop.type, targetHandles);
    });
  });

  declarations.forEach((decl) => {
    const incomingHandles = incomingHandlesByDecl.get(decl.name);
    if (!incomingHandles?.length) return;

    incomingHandlesByDecl.set(
      decl.name,
      incomingHandles.map((handle, index) => ({
        ...handle,
        top: getIncomingHandleTop(decl, index, incomingHandles.length),
      })),
    );
  });

  declarations.forEach((decl) => {
    const propsToEdge = getEdgeableProperties(decl);
    // Resolve each property's edge target once and reuse it for both the
    // node's edgeProperties list and the edge-building loop below.
    const propTargets = propsToEdge.map((p) =>
      isLocal(p.type, p.typeNamespace) ? p.type : registerExternal(p.type, p.typeNamespace)?.id
    );
    const edgeProperties = propsToEdge
      .filter((_, i) => propTargets[i])
      .map((p) => p.name);

    const nodeType = NODE_KIND_BY_DECLARATION[decl.type];
    const incomingHandles = incomingHandlesByDecl.get(decl.name) ?? [];
    const prev = incremental ? prevById.get(decl.name) : undefined;
    const prevData = prev?.data as {
      declaration?: Declaration;
      edgeProperties?: string[];
      incomingHandles?: GraphTargetHandle[];
    } | undefined;
    const sameHandles =
      (prevData?.incomingHandles?.length ?? 0) === incomingHandles.length &&
      incomingHandles.every((handle, i) => {
        const prevHandle = prevData?.incomingHandles?.[i];
        return prevHandle != null && prevHandle.id === handle.id && prevHandle.top === handle.top;
      });
    if (
      prev &&
      prev.type === nodeType &&
      prevData?.declaration &&
      declarationEqual(prevData.declaration, decl) &&
      stringArrayEqual(prevData.edgeProperties, edgeProperties) &&
      sameHandles
    ) {
      // Unchanged declaration: the exact same node object survives, so the
      // memoized component sees identical props and skips its render.
      nodes.push(prev);
    } else {
      nodes.push({
        id: decl.name,
        type: nodeType,
        // A source-declared position always wins; otherwise changed
        // declarations keep their place and only new ones get a spot.
        position:
          getDeclarationPosition(decl) ??
          (prev ? prev.position : positions?.get(decl.name) ?? nextNewPosition(estimateNodeHeight(decl))),
        data: { label: getDeclarationDisplayLabel(decl), declaration: decl, edgeProperties, incomingHandles },
        // Estimated dimensions stand in until React Flow measures the node,
        // so viewport culling can decide visibility for never-rendered nodes.
        initialWidth: NODE_ESTIMATED_WIDTH,
        initialHeight: estimateNodeHeight(decl),
      });
    }

    if (decl.superType) {
      const superTarget = isLocal(decl.superType, decl.superTypeNamespace)
        ? decl.superType
        : registerExternal(decl.superType, decl.superTypeNamespace)?.id;
      if (superTarget) {
        pushEdge({
          id: `${decl.name}-extends-${superTarget}`,
          source: decl.name, target: superTarget,
          sourceHandle: HANDLE_ID.bottom,
          targetHandle: HANDLE_ID.top,
          type: GRAPH_EDGE_KIND.floating, animated: true,
          label: 'extends',
          style: { stroke: '#b794f4', strokeWidth: 1.5, opacity: 0.7, animationDirection: 'reverse' },
          labelStyle: { fill: '#b794f4', fontSize: 10, fontWeight: 600 },
          labelBgStyle: { fill: '#1a202c', fillOpacity: 0.8 },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
        });
      }
    }

    propsToEdge.forEach((prop, i) => {
      const propTarget = propTargets[i];
      if (propTarget) {
        const isRel = prop.isRelationship;
        pushEdge({
          id: `${decl.name}-${prop.name}-${propTarget}`,
          source: decl.name, target: propTarget,
          sourceHandle: propHandleId(prop.name),
          targetHandle: isLocal(prop.type, prop.typeNamespace)
            ? getIncomingTargetHandleId(decl.name, prop.name)
            : HANDLE_ID.left,
          label: prop.name.startsWith('_') ? '' : prop.name + (prop.isArray ? '[]' : ''),
          type: GRAPH_EDGE_KIND.floating,
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
    });
  });

  // Imported types get their own column to the right of the local layout so
  // they read as external to the current file. In an incremental sync there
  // is no fresh layout to place a column against, so existing imported nodes
  // keep their objects (or at least their position) and only new ones are
  // placed, through the same new-node cursor as local declarations.
  if (externalNodes.size > 0) {
    const externals = [...externalNodes.values()];
    if (incremental) {
      for (const ext of externals) {
        const prev = prevById.get(ext.id);
        const prevData = prev?.data as { label?: string; namespace?: string; resolved?: boolean } | undefined;
        if (
          prev &&
          prev.type === GRAPH_NODE_KIND.imported &&
          prevData?.label === ext.name &&
          prevData?.namespace === ext.namespace &&
          prevData?.resolved === ext.resolved
        ) {
          nodes.push(prev);
        } else {
          nodes.push({
            id: ext.id,
            type: GRAPH_NODE_KIND.imported,
            position: prev ? prev.position : nextNewPosition(EXTERNAL_NODE_HEIGHT),
            data: { label: ext.name, namespace: ext.namespace, resolved: ext.resolved },
            initialWidth: EXTERNAL_NODE_WIDTH,
            initialHeight: EXTERNAL_NODE_HEIGHT,
          });
        }
      }
    } else {
      let maxX = 0;
      for (const pos of positions!.values()) maxX = Math.max(maxX, pos.x);
      const externalX = declarations.length > 0 ? maxX + 380 : 0;
      const gapY = 40;
      const totalHeight = externals.length * EXTERNAL_NODE_HEIGHT + (externals.length - 1) * gapY;
      let y = -totalHeight / 2;
      for (const ext of externals) {
        nodes.push({
          id: ext.id,
          type: GRAPH_NODE_KIND.imported,
          position: { x: externalX, y },
          data: { label: ext.name, namespace: ext.namespace, resolved: ext.resolved },
          initialWidth: EXTERNAL_NODE_WIDTH,
          initialHeight: EXTERNAL_NODE_HEIGHT,
        });
        y += EXTERNAL_NODE_HEIGHT + gapY;
      }
    }
  }

  return { nodes, edges };
}

function getIncomingTargetHandleId(sourceDeclaration: string, propertyName: string): string {
  return `in:${sourceDeclaration}:${propertyName}`;
}
