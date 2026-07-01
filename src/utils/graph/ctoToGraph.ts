import type { Node, Edge } from '@xyflow/react';
import type { Declaration, ConcertoModel, ImportStatement, Property, PropertyValidator, Decorator, IdentifiedKind } from './types';
import { PRIMITIVE_TYPES } from './types';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode, ElkPort } from 'elkjs/lib/elk-api';
import {
  HANDLE_SIZE,
  estimateNodeHeight,
  getIncomingHandleTop,
  getMapValueHandleTop,
  getNodeWidth,
  getPropertyHandleTop,
  type GraphTargetHandle,
} from './nodeLayout';

import { Parser as ParserModule } from '@accordproject/concerto-cto';
import { ModelManager } from '@accordproject/concerto-core';
const META = 'concerto.metamodel@1.0.0';
const HANDLE_RADIUS = HANDLE_SIZE / 2;
const elk = new ELK();

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

export function validateCto(cto: string, peers: string[] = []): string | null {
  try {
    const mm = new ModelManager();
    // Load peer models first (validation disabled) so cross-namespace imports resolve
    peers.forEach((peer, i) => mm.addCTOModel(peer, `peer${i}.cto`, true));
    mm.addCTOModel(cto, 'model.cto');
    return null;
  } catch (e: any) {
    return e.message || 'Validation failed';
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
  if ($class === `${META}.ObjectProperty` || isRelationship) {
    type = p.type?.name || 'String';
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

function getNodeType(decl: Declaration): string {
  if (decl.type === 'enum') return 'enumNode';
  if (decl.type === 'map') return 'mapNode';
  if (decl.type === 'scalar') return 'scalarNode';
  return 'conceptNode';
}

function getEdgeableProperties(decl: Declaration): Property[] {
  return decl.type === 'map'
    ? decl.properties.filter((prop) => prop.name === '_value')
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

  return {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.spacing.nodeNodeBetweenLayers': String(Math.max(220, maxNodeWidth + 80)),
    'elk.spacing.nodeNode': String(Math.max(110, Math.floor(maxNodeHeight * 0.45))),
    'elk.spacing.edgeNode': '40',
    'elk.padding': `[top=${paddingY},left=${paddingX},bottom=${paddingY},right=${paddingX}]`,
    'org.eclipse.elk.layered.considerModelOrder.portModelOrder': 'true',
    'org.eclipse.elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'org.eclipse.elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
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

export function declarationsToGraph(declarations: Declaration[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const declNames = new Set(declarations.map((d) => d.name));
  const declByName = new Map(declarations.map((decl) => [decl.name, decl]));
  const treePositions = computeTreeLayout(declarations);
  const incomingHandlesByDecl = new Map<string, GraphTargetHandle[]>();

  declarations.forEach((decl) => {
    const propsToEdge = getEdgeableProperties(decl);

    propsToEdge.forEach((prop) => {
      if (!declNames.has(prop.type) || PRIMITIVE_TYPES.has(prop.type)) return;
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
    const pos = getDeclarationPosition(decl) || treePositions.get(decl.name) || { x: 0, y: 0 };
    const propsToEdge = getEdgeableProperties(decl);
    const edgeProperties = propsToEdge
      .filter((p) => declNames.has(p.type) && !PRIMITIVE_TYPES.has(p.type))
      .map((p) => p.name);

    nodes.push({
      id: decl.name,
      type: getNodeType(decl),
      position: pos,
      data: {
        label: decl.name,
        declaration: decl,
        edgeProperties,
        incomingHandles: incomingHandlesByDecl.get(decl.name) ?? [],
      },
    });

    if (decl.superType && declNames.has(decl.superType)) {
      edges.push({
        id: `${decl.name}-extends-${decl.superType}`,
        source: decl.name, target: decl.superType,
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

    for (const prop of propsToEdge) {
      if (declNames.has(prop.type) && !PRIMITIVE_TYPES.has(prop.type)) {
        const isRel = prop.isRelationship;
        edges.push({
          id: `${decl.name}-${prop.name}-${prop.type}`,
          source: decl.name, target: prop.type,
          sourceHandle: `prop:${prop.name}`,
          targetHandle: getIncomingTargetHandleId(decl.name, prop.name),
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

  return { nodes, edges };
}

function getIncomingTargetHandleId(sourceDeclaration: string, propertyName: string): string {
  return `in:${sourceDeclaration}:${propertyName}`;
}
