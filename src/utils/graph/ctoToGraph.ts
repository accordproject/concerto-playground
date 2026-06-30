import type { Node, Edge } from '@xyflow/react';
import type { Declaration, ConcertoModel, ImportStatement, Property, PropertyValidator, Decorator, IdentifiedKind } from './types';
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

function getNodeWidth(decl: Declaration): number {
  if (decl.type === 'map') return 210;
  if (decl.type === 'enum' || decl.type === 'scalar') return 200;
  return 250;
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
  layoutFn: (declarations: Declaration[]) => Map<string, { x: number; y: number }> = computeLayeredLayout,
): Promise<Map<string, { x: number; y: number }>> {
  const fallback = computeTreeLayout(declarations);
  if (declarations.length === 0) return fallback;

  try {
    const positions = layoutFn(declarations);
    return positions.size > 0 ? positions : fallback;
  } catch {
    return fallback;
  }
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

export function declarationsToGraph(declarations: Declaration[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const declNames = new Set(declarations.map((d) => d.name));
  const treePositions = computeTreeLayout(declarations);

  declarations.forEach((decl) => {
    let nodeType = 'conceptNode';
    if (decl.type === 'enum') nodeType = 'enumNode';
    else if (decl.type === 'map') nodeType = 'mapNode';
    else if (decl.type === 'scalar') nodeType = 'scalarNode';

    const pos = getDeclarationPosition(decl) || treePositions.get(decl.name) || { x: 0, y: 0 };
    const propsToEdge = decl.type === 'map'
      ? decl.properties.filter((p) => p.name === '_value')
      : decl.properties;
    const edgeProperties = propsToEdge
      .filter((p) => declNames.has(p.type) && !PRIMITIVE_TYPES.has(p.type))
      .map((p) => p.name);

    nodes.push({
      id: decl.name,
      type: nodeType,
      position: pos,
      data: { label: decl.name, declaration: decl, edgeProperties },
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

  return { nodes, edges };
}
