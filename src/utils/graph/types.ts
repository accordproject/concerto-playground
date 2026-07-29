export interface PropertyValidator {
  default?: string;
  regex?: string;
  range?: string;      // e.g. "[1,100]"
  length?: string;     // e.g. "[1,100]"
}

export interface Property {
  name: string;
  type: string;
  /** Namespace of the referenced type when the reference is qualified (e.g. `org.base@1.0.0.Foo`). */
  typeNamespace?: string;
  isOptional: boolean;
  isArray: boolean;
  isRelationship: boolean;
  validators: PropertyValidator;
}

export interface MapDeclaration {
  keyType: string;
  valueType: string;
}

export interface Decorator {
  name: string;
  args: string[];
}

export type IdentifiedKind = 'none' | 'identified' | 'identified-by';

export interface Declaration {
  name: string;
  type: DeclarationType;
  isAbstract: boolean;
  superType?: string;
  /** Namespace of the superType when the extends clause is qualified. */
  superTypeNamespace?: string;
  properties: Property[];
  enumValues: string[];
  mapDeclaration?: MapDeclaration;
  // Scalar
  scalarExtends?: string;  // e.g. "String"
  scalarValidators?: PropertyValidator;
  // Identity
  identified: IdentifiedKind;
  identifiedBy?: string;   // field name for "identified by"
  // Decorators
  decorators: Decorator[];
}

export interface ImportStatement {
  namespace: string;
  types: string[];
  uri?: string;
}

export interface ConcertoModel {
  namespace: string;
  imports: ImportStatement[];
  declarations: Declaration[];
}

/** Where a type referenced from another namespace lives, and whether that
    namespace is open in the workspace so the reference can be navigated. */
export interface ExternalTypeInfo {
  namespace: string;
  resolved: boolean;
}

/** Short type name to owning-namespace info, built from a model's imports. */
export type ExternalTypeMap = Record<string, ExternalTypeInfo>;

/** A clickable type reference in the CTO editor. Local declarations carry no
    namespace; imported types carry their namespace and resolution status. */
export interface TypeLinkTarget {
  name: string;
  namespace?: string;
  resolved: boolean;
}

export const ALL_TYPES = [
  'String', 'Integer', 'Long', 'Double', 'Boolean', 'DateTime',
] as const;

export type PrimitiveTypeName = (typeof ALL_TYPES)[number];

export const PRIMITIVE_TYPES = new Set<string>(ALL_TYPES);

export const DECLARATION_TYPES = [
  'concept', 'enum', 'asset', 'participant', 'event', 'transaction', 'map', 'scalar',
] as const;

export type DeclarationType = (typeof DECLARATION_TYPES)[number];

/** Declaration kinds that compile to classes (can extend, hold properties). */
export const CLASS_DECLARATION_TYPES = [
  'concept', 'asset', 'participant', 'event', 'transaction',
] as const;

export type ClassDeclarationType = (typeof CLASS_DECLARATION_TYPES)[number];

// React Flow rendering keys. Kept next to the domain types so the graph
// builder (utils) and the node components agree on one definition.

/** Node component keys registered in the React Flow `nodeTypes` map. */
export const GRAPH_NODE_KIND = {
  concept: 'conceptNode',
  enum: 'enumNode',
  map: 'mapNode',
  scalar: 'scalarNode',
  imported: 'importedNode',
} as const;

export type GraphNodeKind = (typeof GRAPH_NODE_KIND)[keyof typeof GRAPH_NODE_KIND];

/** Which node component renders each declaration kind. */
export const NODE_KIND_BY_DECLARATION: Record<DeclarationType, GraphNodeKind> = {
  concept: GRAPH_NODE_KIND.concept,
  asset: GRAPH_NODE_KIND.concept,
  participant: GRAPH_NODE_KIND.concept,
  event: GRAPH_NODE_KIND.concept,
  transaction: GRAPH_NODE_KIND.concept,
  enum: GRAPH_NODE_KIND.enum,
  map: GRAPH_NODE_KIND.map,
  scalar: GRAPH_NODE_KIND.scalar,
};

/** Edge component keys registered in the React Flow `edgeTypes` map. */
export const GRAPH_EDGE_KIND = {
  floating: 'floating',
} as const;

/** Fixed connection handle ids present on every graph node. */
export const HANDLE_ID = {
  top: 'top',
  bottom: 'bottom',
  left: 'left',
  right: 'right',
} as const;

/** Handle id of a property row's source handle. */
export function propHandleId(propName: string): string {
  return `prop:${propName}`;
}

/** Synthetic property name a map declaration's value edge hangs off. */
export const MAP_VALUE_PROP = '_value';

/** Dialogs the graph editor can open for a declaration. */
export type DeclarationDialogKind = 'property' | 'enum-value' | 'inheritance';

export function getAvailableTypes(declarations: Declaration[], exclude?: string): string[] {
  const declNames = declarations.map((d) => d.name).filter((n) => n !== exclude);
  return [...ALL_TYPES, ...declNames];
}

export const MAP_KEY_PRIMITIVES = ['String', 'DateTime'];
export const MAP_VALUE_PRIMITIVES = ['String', 'DateTime', 'Integer', 'Long', 'Double', 'Boolean'];
const MAP_KEY_SCALAR_BASES = new Set(['String', 'DateTime']);
const MAP_VALUE_SCALAR_BASES = new Set(['String', 'Integer', 'Long', 'Double', 'Boolean']);
const CLASS_DECL_TYPES = new Set<string>(CLASS_DECLARATION_TYPES);

export function getMapKeyTypes(declarations: Declaration[]): string[] {
  const scalars = declarations
    .filter((d) => d.type === 'scalar' && d.scalarExtends && MAP_KEY_SCALAR_BASES.has(d.scalarExtends))
    .map((d) => d.name);
  return [...MAP_KEY_PRIMITIVES, ...scalars];
}

export function getMapValueTypes(declarations: Declaration[]): string[] {
  const scalars = declarations
    .filter((d) => d.type === 'scalar' && d.scalarExtends && MAP_VALUE_SCALAR_BASES.has(d.scalarExtends))
    .map((d) => d.name);
  const concepts = declarations
    .filter((d) => CLASS_DECL_TYPES.has(d.type))
    .map((d) => d.name);
  return [...MAP_VALUE_PRIMITIVES, ...scalars, ...concepts];
}

export function getExtendsCandidates(declarations: Declaration[], declName: string): string[] {
  const decl = declarations.find((d) => d.name === declName);
  if (!decl) return [];

  // Collect all declarations that descend from declName so we can exclude them
  // as superType candidates (preventing circular inheritance).
  const descendants = new Set<string>();
  const collectDescendants = (name: string) => {
    for (const d of declarations) {
      if (d.superType === name && !descendants.has(d.name)) {
        descendants.add(d.name);
        collectDescendants(d.name);
      }
    }
  };
  collectDescendants(declName);

  return declarations
    .filter((d) =>
      d.name !== declName &&
      d.type !== 'enum' &&
      d.type !== 'map' &&
      d.type !== 'scalar' &&
      !descendants.has(d.name)
    )
    .map((d) => d.name);
}
