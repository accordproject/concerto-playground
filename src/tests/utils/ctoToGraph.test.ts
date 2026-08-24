import { describe, it, expect } from "vitest";
import { declarationsToCto } from "../../utils/graph/graphToCto";
import { buildExternalTypeMap, computeAutoLayoutPositions, declarationsToGraph, describeParseError, getDeclarationPosition, parseCto, validateCto, withDeclarationPositions, withSourcePositions } from "../../utils/graph/ctoToGraph";
import { estimateNodeHeight, getNodeWidth } from "../../utils/graph/nodeLayout";
import { routeGraphEdges } from "../../utils/graph/routeGraphEdges";
import type { Declaration } from "../../utils/graph/types";

const SIMPLE_CTO = `namespace org.test@1.0.0

enum Status {
  o ACTIVE
  o INACTIVE
}

concept Address {
  o String street
  o String city optional
}

concept Person {
  o String name
  o Integer age
  o Status status
  o Address homeAddress
}
`;

describe("parseCto", () => {
  it("parses namespace correctly", () => {
    const model = parseCto(SIMPLE_CTO);
    expect(model.namespace).toBe("org.test@1.0.0");
  });

  it("parses the correct number of declarations", () => {
    const { declarations } = parseCto(SIMPLE_CTO);
    expect(declarations).toHaveLength(3);
  });

  it("parses enum declaration", () => {
    const { declarations } = parseCto(SIMPLE_CTO);
    const status = declarations.find((d) => d.name === "Status");
    expect(status).toBeDefined();
    expect(status!.type).toBe("enum");
    expect(status!.enumValues).toEqual(["ACTIVE", "INACTIVE"]);
  });

  it("parses concept declaration with properties", () => {
    const { declarations } = parseCto(SIMPLE_CTO);
    const person = declarations.find((d) => d.name === "Person");
    expect(person).toBeDefined();
    expect(person!.type).toBe("concept");
    expect(person!.properties).toHaveLength(4);
  });

  it("parses optional property flag", () => {
    const { declarations } = parseCto(SIMPLE_CTO);
    const address = declarations.find((d) => d.name === "Address");
    const city = address!.properties.find((p) => p.name === "city");
    expect(city!.isOptional).toBe(true);
  });

  it("parses required property flag", () => {
    const { declarations } = parseCto(SIMPLE_CTO);
    const address = declarations.find((d) => d.name === "Address");
    const street = address!.properties.find((p) => p.name === "street");
    expect(street!.isOptional).toBe(false);
  });

  it("parses property types", () => {
    const { declarations } = parseCto(SIMPLE_CTO);
    const person = declarations.find((d) => d.name === "Person");
    const name = person!.properties.find((p) => p.name === "name");
    expect(name!.type).toBe("String");
    const age = person!.properties.find((p) => p.name === "age");
    expect(age!.type).toBe("Integer");
  });

  it("parses object property type references", () => {
    const { declarations } = parseCto(SIMPLE_CTO);
    const person = declarations.find((d) => d.name === "Person");
    const addr = person!.properties.find((p) => p.name === "homeAddress");
    expect(addr!.type).toBe("Address");
  });

  it("parses empty imports array when no imports", () => {
    const model = parseCto(SIMPLE_CTO);
    expect(model.imports).toHaveLength(0);
  });

  it("parses array property", () => {
    const arrayCto = `namespace org.test@1.0.0
concept Example {
  o String[] tags
}`;
    const { declarations } = parseCto(arrayCto);
    const tags = declarations[0].properties.find((p) => p.name === "tags");
    expect(tags!.isArray).toBe(true);
  });

  it("parses abstract concept", () => {
    const abstractCto = `namespace org.test@1.0.0
abstract concept Base {
  o String id
}`;
    const { declarations } = parseCto(abstractCto);
    expect(declarations[0].isAbstract).toBe(true);
  });

  it("parses superType inheritance", () => {
    const inheritCto = `namespace org.test@1.0.0
concept Base {
  o String id
}
concept Child extends Base {
  o String extra
}`;
    const { declarations } = parseCto(inheritCto);
    const child = declarations.find((d) => d.name === "Child");
    expect(child!.superType).toBe("Base");
  });
});

describe("validateCto", () => {
  it("returns null for valid CTO", () => {
    const result = validateCto(SIMPLE_CTO);
    expect(result).toBeNull();
  });

  it("returns an error string for invalid CTO", () => {
    const result = validateCto("this is not valid concerto syntax !!!");
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
  });

  it("returns an error string for empty input", () => {
    const result = validateCto("");
    expect(result).not.toBeNull();
  });

  it("returns null for a model with a superType in peers", () => {
    const base = `namespace org.base@1.0.0
concept BaseType {
  o String id
}`;
    const child = `namespace org.child@1.0.0
import org.base@1.0.0.BaseType
concept ChildType extends BaseType {
  o String extra
}`;
    const result = validateCto(child, [base]);
    expect(result).toBeNull();
  });
});

describe("declarationsToGraph", () => {
  it("creates one node per declaration", () => {
    const { declarations } = parseCto(SIMPLE_CTO);
    const { nodes } = declarationsToGraph(declarations);
    expect(nodes).toHaveLength(3);
  });

  it("assigns enumNode type for enum declarations", () => {
    const { declarations } = parseCto(SIMPLE_CTO);
    const { nodes } = declarationsToGraph(declarations);
    const statusNode = nodes.find((n) => n.id === "Status");
    expect(statusNode!.type).toBe("enumNode");
  });

  it("assigns conceptNode type for concept declarations", () => {
    const { declarations } = parseCto(SIMPLE_CTO);
    const { nodes } = declarationsToGraph(declarations);
    const personNode = nodes.find((n) => n.id === "Person");
    expect(personNode!.type).toBe("conceptNode");
  });

  it("creates edges for object property references", () => {
    const { declarations } = parseCto(SIMPLE_CTO);
    const { edges } = declarationsToGraph(declarations);
    const addrEdge = edges.find(
      (e) => e.source === "Person" && e.target === "Address"
    );
    expect(addrEdge).toBeDefined();
  });

  it("creates edges for enum property references", () => {
    const { declarations } = parseCto(SIMPLE_CTO);
    const { edges } = declarationsToGraph(declarations);
    const statusEdge = edges.find(
      (e) => e.source === "Person" && e.target === "Status"
    );
    expect(statusEdge).toBeDefined();
  });

  it("does not create edges for primitive type properties", () => {
    const { declarations } = parseCto(SIMPLE_CTO);
    const { edges } = declarationsToGraph(declarations);
    const stringEdge = edges.find(
      (e) => e.target === "String" || e.target === "Integer"
    );
    expect(stringEdge).toBeUndefined();
  });

  it("creates edges for extends (superType) relationships", () => {
    const inheritCto = `namespace org.test@1.0.0
concept Base {
  o String id
}
concept Child extends Base {
  o String extra
}`;
    const { declarations } = parseCto(inheritCto);
    const { edges } = declarationsToGraph(declarations);
    const extendsEdge = edges.find(
      (e) => e.source === "Child" && e.target === "Base" && e.label === "extends"
    );
    expect(extendsEdge).toBeDefined();
  });

  it("uses distinct handles for duplicate edges that share the same source and target", () => {
    const ndaCto = `namespace org.accordproject.nda@1.0.0
concept Party {
  o String name
}
concept NDAData {
  o Party disclosingParty
  o Party receivingParty
}`;
    const { declarations } = parseCto(ndaCto);
    const { edges } = declarationsToGraph(declarations);
    const partyEdges = edges.filter(
      (edge) => edge.source === "NDAData" && edge.target === "Party"
    );

    expect(partyEdges).toHaveLength(2);
    expect(new Set(partyEdges.map((edge) => edge.sourceHandle))).toEqual(
      new Set(["prop:disclosingParty", "prop:receivingParty"])
    );
    expect(new Set(partyEdges.map((edge) => edge.targetHandle))).toEqual(
      new Set(["in:NDAData:disclosingParty", "in:NDAData:receivingParty"])
    );
  });

  it("assigns unique incoming handles to dense shared targets", () => {
    const denseCto = `namespace org.accordproject.nda@1.0.0
concept Party {
  o String name
}
concept NDAData {
  o Party disclosingParty
  o Party receivingParty
  o Party addressParty
  o Party witnessParty
}`;
    const { declarations } = parseCto(denseCto);
    const { nodes, edges } = declarationsToGraph(declarations);
    const partyNode = nodes.find((node) => node.id === "Party");
    const partyEdges = edges.filter(
      (edge) => edge.source === "NDAData" && edge.target === "Party"
    );

    expect(new Set(partyEdges.map((edge) => edge.targetHandle))).toEqual(
      new Set([
        "in:NDAData:disclosingParty",
        "in:NDAData:receivingParty",
        "in:NDAData:addressParty",
        "in:NDAData:witnessParty",
      ])
    );
    expect(partyNode?.data.incomingHandles).toHaveLength(4);
  });

  it("does not store lane routes on base graph edges", () => {
    const denseCto = `namespace org.accordproject.nda@1.0.0
concept Party {
  o String name
}
concept NDAData {
  o Party disclosingParty
  o Party receivingParty
  o Party addressParty
}`;
    const { declarations } = parseCto(denseCto);
    const { edges } = declarationsToGraph(declarations);
    const partyEdges = edges.filter(
      (edge) => edge.source === "NDAData" && edge.target === "Party"
    );

    for (const edge of partyEdges) {
      expect((edge.data as { laneX?: number } | undefined)?.laneX).toBeUndefined();
    }
  });

  it("routes dense property fan-in through distinct lane columns", () => {
    const denseCto = `namespace org.accordproject.nda@1.0.0
concept Party {
  o String name
}
concept NDAData {
  o Party disclosingParty
  o Party receivingParty
  o Party addressParty
  o Party witnessParty
}`;
    const { declarations } = parseCto(denseCto);
    const { nodes, edges } = declarationsToGraph(declarations);
    const routedEdges = routeGraphEdges(nodes, edges).filter(
      (edge) => edge.source === "NDAData" && edge.target === "Party"
    );

    const laneColumns = routedEdges.map((edge) => (edge.data as { laneX?: number }).laneX!);

    expect(laneColumns.every((laneX) => typeof laneX === "number")).toBe(true);
    expect(new Set(laneColumns).size).toBe(4);
  });

  it("uses measured node width when routing lane edges", () => {
    const denseCto = `namespace org.accordproject.nda@1.0.0
concept Party {
  o String name
}
concept NDAData {
  o Party disclosingParty
  o Party receivingParty
}`;
    const { declarations } = parseCto(denseCto);
    const { nodes, edges } = declarationsToGraph(declarations);
    const ndaNode = nodes.find((node) => node.id === "NDAData")!;
    const declaration = ndaNode.data.declaration as Declaration;
    const measuredWidth = getNodeWidth(declaration) + 90;
    ndaNode.measured = { width: measuredWidth, height: estimateNodeHeight(declaration) };

    const routedEdge = routeGraphEdges(nodes, edges).find(
      (edge) => edge.source === "NDAData" && edge.target === "Party"
    )!;

    // The lane must clear the measured (wider) node, not the estimated width.
    const laneX = (routedEdge.data as { laneX?: number }).laneX!;
    expect(laneX).toBeGreaterThan(ndaNode.position.x + measuredWidth);
  });

  it("assigns positions to all nodes", () => {
    const { declarations } = parseCto(SIMPLE_CTO);
    const { nodes } = declarationsToGraph(declarations);
    for (const node of nodes) {
      expect(typeof node.position.x).toBe("number");
      expect(typeof node.position.y).toBe("number");
    }
  });

  it("handles empty declarations array", () => {
    const { nodes, edges } = declarationsToGraph([]);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it("stores declaration data on each node", () => {
    const { declarations } = parseCto(SIMPLE_CTO);
    const { nodes } = declarationsToGraph(declarations);
    for (const node of nodes) {
      expect(node.data).toBeDefined();
      expect(node.data.declaration).toBeDefined();
    }
  });

  it("uses saved Position decorators when present", () => {
    const cto = `namespace org.test@1.0.0

@Position(120, 340)
concept Person {
  o String name
}`;
    const { declarations } = parseCto(cto);
    const { nodes } = declarationsToGraph(declarations);

    expect(nodes[0].position).toEqual({ x: 120, y: 340 });
    expect(getDeclarationPosition(declarations[0])).toEqual({ x: 120, y: 340 });
  });
});

describe("auto layout helpers", () => {
  function createDenseDeclarations(count: number) {
    return [
      {
        name: "Hub",
        type: "concept" as const,
        isAbstract: false,
        superType: undefined,
        properties: [],
        enumValues: [],
        identified: "none" as const,
        decorators: [],
      },
      ...Array.from({ length: count }, (_, index) => ({
        name: `Concept${index}`,
        type: "concept" as const,
        isAbstract: false,
        superType: undefined,
        properties: [
          { name: "hub", type: "Hub", isOptional: false, isArray: false, isRelationship: false, validators: {} },
          ...(index < count - 1
            ? [{ name: `next${index}`, type: `Concept${index + 1}`, isOptional: false, isArray: false, isRelationship: false, validators: {} }]
            : []),
        ],
        enumValues: [],
        identified: "none" as const,
        decorators: [],
      })),
    ];
  }

  function createMixedSizeDeclarations() {
    return parseCto(`namespace org.example.layout@1.0.0

@Note("wide")
enum Status {
  o NEW
  o IN_PROGRESS
  o BLOCKED
  o DONE
}

scalar VIN extends String regex=/[A-HJ-NPR-Z0-9]{17}/

abstract concept Vehicle {
  o String make
  o String model
  o VIN vin
  o Status status
  o String serialNumber
  o String registrationNumber
  o String ownerName optional
}

concept Owner {
  o String firstName
  o String lastName
  o String email optional
}

concept Fleet {
  o String name
  o Vehicle[] vehicles
  o Owner manager
}

concept Car extends Vehicle {
  o Integer seatCount
  o Boolean hasAirConditioning
}

concept Truck extends Vehicle {
  o Double payloadTonnage
  o Boolean hasRefrigeration
  o String axleConfiguration
  o String regionCode
}

concept Warranty {
  o String provider
  o String policyNumber
  o Truck coveredTruck
}
`).declarations;
  }

  function boxesOverlap(
    left: { x: number; y: number; width: number; height: number },
    right: { x: number; y: number; width: number; height: number },
  ) {
    return left.x < right.x + right.width
      && left.x + left.width > right.x
      && left.y < right.y + right.height
      && left.y + left.height > right.y;
  }

  function getDefaultNodeDimensions(declarations: ReturnType<typeof createMixedSizeDeclarations>) {
    return new Map(
      declarations.map((declaration) => [
        declaration.name,
        {
          width: getNodeWidth(declaration),
          height: estimateNodeHeight(declaration),
        },
      ]),
    );
  }

  it("returns numeric positions for larger models", async () => {
    const declarations = createDenseDeclarations(24);

    const positions = await computeAutoLayoutPositions(declarations);

    expect(positions.size).toBe(25);
    for (const position of positions.values()) {
      expect(typeof position.x).toBe("number");
      expect(typeof position.y).toBe("number");
    }
  });

  it("uses the default ELK path for a dense 20+ node model", async () => {
    const declarations = createDenseDeclarations(20);
    const positions = await computeAutoLayoutPositions(declarations);

    expect(positions.size).toBe(21);
    expect(new Set(Array.from(positions.values(), (position) => position.x)).size).toBeGreaterThan(1);
    expect(Array.from(positions.values()).some((position) => position.x !== 0 || position.y !== 0)).toBe(true);
  });

  it("keeps mixed-size node bounds from overlapping", async () => {
    const declarations = createMixedSizeDeclarations();
    const nodeDimensions = getDefaultNodeDimensions(declarations);
    nodeDimensions.set("Vehicle", {
      width: nodeDimensions.get("Vehicle")!.width + 90,
      height: nodeDimensions.get("Vehicle")!.height + 120,
    });
    nodeDimensions.set("Truck", {
      width: nodeDimensions.get("Truck")!.width + 60,
      height: nodeDimensions.get("Truck")!.height + 80,
    });
    nodeDimensions.set("Status", {
      width: nodeDimensions.get("Status")!.width + 40,
      height: nodeDimensions.get("Status")!.height + 40,
    });

    const positions = await computeAutoLayoutPositions(declarations, nodeDimensions);
    const boxes = declarations.map((declaration) => ({
      name: declaration.name,
      x: positions.get(declaration.name)!.x,
      y: positions.get(declaration.name)!.y,
      width: nodeDimensions.get(declaration.name)?.width ?? getNodeWidth(declaration),
      height: nodeDimensions.get(declaration.name)?.height ?? estimateNodeHeight(declaration),
    }));

    for (let index = 0; index < boxes.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < boxes.length; otherIndex += 1) {
        expect(
          boxesOverlap(boxes[index], boxes[otherIndex]),
          `${boxes[index].name} overlaps ${boxes[otherIndex].name}`,
        ).toBe(false);
      }
    }
  });

  it("falls back to tree layout when auto layout throws", async () => {
    const { declarations } = parseCto(SIMPLE_CTO);
    const positions = await computeAutoLayoutPositions(declarations, () => {
      throw new Error("boom");
    });

    expect(positions.size).toBe(declarations.length);
    expect(positions.get("Person")).toBeDefined();
  });

  it("supports async injected layout callbacks", async () => {
    const { declarations } = parseCto(SIMPLE_CTO);
    const positions = await computeAutoLayoutPositions(
      declarations,
      async () => new Map([["Person", { x: 10, y: 20 }], ["Address", { x: 30, y: 40 }], ["Status", { x: 50, y: 60 }]]),
    );

    expect(positions.get("Person")).toEqual({ x: 10, y: 20 });
    expect(positions.get("Address")).toEqual({ x: 30, y: 40 });
    expect(positions.get("Status")).toEqual({ x: 50, y: 60 });
  });
});

describe("position decorator persistence", () => {
  it("updates positions without changing documentation or other decorators", () => {
    const source = `namespace org.test@1.0.0

/**
 * Person documentation.
 */
@Audited
concept Person {
  o String name
}`;

    const output = withSourcePositions(
      source,
      new Map([["Person", { x: 120, y: 340 }]]),
    );

    expect(output).toBe(`namespace org.test@1.0.0

/**
 * Person documentation.
 */
@Audited
@Position(120, 340)
concept Person {
  o String name
}`);

    const moved = withSourcePositions(output, new Map([["Person", { x: 12.5, y: 34.5 }]]));
    expect(moved).toContain("@Audited\n@Position(12.5, 34.5)\nconcept Person");
    expect(moved.match(/@Position/g)).toHaveLength(1);
  });

  it("writes Position decorators into CTO", () => {
    const { declarations, namespace, imports } = parseCto(SIMPLE_CTO);
    const updated = withDeclarationPositions(
      declarations,
      new Map([
        ["Status", { x: 10, y: 20 }],
        ["Address", { x: 30, y: 40 }],
        ["Person", { x: 50, y: 60 }],
      ]),
    );

    const output = declarationsToCto({ namespace, imports, declarations: updated });
    expect(output).toMatch(/@Position\(10,\s*20\)/);
    expect(output).toMatch(/@Position\(30,\s*40\)/);
    expect(output).toMatch(/@Position\(50,\s*60\)/);
  });

  it("replaces an existing Position decorator and preserves others", () => {
    const cto = `namespace org.test@1.0.0

@Audited
@Position(1, 2)
concept Person {
  o String name
}`;
    const model = parseCto(cto);
    const updated = withDeclarationPositions(
      model.declarations,
      new Map([["Person", { x: 120, y: 340 }]]),
    );
    const person = updated[0];

    expect(person.decorators.filter((decorator) => decorator.name === "Position")).toHaveLength(1);
    expect(person.decorators.find((decorator) => decorator.name === "Audited")).toBeDefined();

    const roundTrip = parseCto(declarationsToCto({ ...model, declarations: updated }));
    expect(getDeclarationPosition(roundTrip.declarations[0])).toEqual({ x: 120, y: 340 });
    expect(roundTrip.declarations[0].decorators.find((decorator) => decorator.name === "Audited")).toBeDefined();
  });
});

describe("describeParseError", () => {
  it("uses the ParseException's structured location fields", () => {
    let message = "";
    try {
      parseCto("namespace org.test@1.0.0\nconcept {\n}");
    } catch (e) {
      message = describeParseError(e);
    }
    expect(message).toMatch(/Line 2 column 9/);
    expect(message).toContain('"{" found');
  });

  it("falls back to the message for plain errors", () => {
    expect(describeParseError(new Error("boom"))).toBe("boom");
  });

  it("stringifies non-Error values", () => {
    expect(describeParseError("oops")).toBe("oops");
  });
});

const CHILD_CTO = `namespace org.child@1.0.0
import org.base@1.0.0.{BaseThing, Color}
import org.missing@1.0.0.Ghost

concept Kid extends BaseThing {
  o Color color
  o Ghost ghost
  o String name
}`;

const WORKSPACE = {
  "org.child@1.0.0": ["Kid"],
  "org.base@1.0.0": ["BaseThing", "Color"],
};

describe("parseCto imports", () => {
  it("parses named imports with their namespace", () => {
    const { imports } = parseCto(CHILD_CTO);
    expect(imports).toHaveLength(2);
    const base = imports.find((i) => i.namespace === "org.base@1.0.0");
    expect(base!.types).toEqual(["BaseThing", "Color"]);
    const missing = imports.find((i) => i.namespace === "org.missing@1.0.0");
    expect(missing!.types).toEqual(["Ghost"]);
  });
});

describe("buildExternalTypeMap", () => {
  it("resolves imported types whose namespace is open and declares them", () => {
    const { imports } = parseCto(CHILD_CTO);
    const map = buildExternalTypeMap(imports, WORKSPACE);
    expect(map.BaseThing).toEqual({ namespace: "org.base@1.0.0", resolved: true });
    expect(map.Color).toEqual({ namespace: "org.base@1.0.0", resolved: true });
  });

  it("marks types from unopened namespaces as unresolved", () => {
    const { imports } = parseCto(CHILD_CTO);
    const map = buildExternalTypeMap(imports, WORKSPACE);
    expect(map.Ghost).toEqual({ namespace: "org.missing@1.0.0", resolved: false });
  });

  it("marks a type as unresolved when the open namespace does not declare it", () => {
    const imports = [{ namespace: "org.base@1.0.0", types: ["NotThere"] }];
    const map = buildExternalTypeMap(imports, WORKSPACE);
    expect(map.NotThere).toEqual({ namespace: "org.base@1.0.0", resolved: false });
  });

  it("expands wildcard imports from the open namespace's declarations", () => {
    const imports = [{ namespace: "org.base@1.0.0", types: ["*"] }];
    const map = buildExternalTypeMap(imports, WORKSPACE);
    expect(map.BaseThing).toEqual({ namespace: "org.base@1.0.0", resolved: true });
    expect(map.Color).toEqual({ namespace: "org.base@1.0.0", resolved: true });
  });

  it("yields nothing for a wildcard import of an unopened namespace", () => {
    const imports = [{ namespace: "org.missing@1.0.0", types: ["*"] }];
    const map = buildExternalTypeMap(imports, WORKSPACE);
    expect(Object.keys(map)).toHaveLength(0);
  });
});

describe("declarationsToGraph with imported types", () => {
  const buildGraph = () => {
    const { declarations, imports } = parseCto(CHILD_CTO);
    const externalTypes = buildExternalTypeMap(imports, WORKSPACE);
    return declarationsToGraph(declarations, { externalTypes, workspaceDeclarations: WORKSPACE });
  };

  it("creates an importedNode with a namespace-qualified id for each referenced imported type", () => {
    const { nodes } = buildGraph();
    const imported = nodes.filter((n) => n.type === "importedNode");
    expect(imported.map((n) => n.id).sort()).toEqual([
      "org.base@1.0.0.BaseThing",
      "org.base@1.0.0.Color",
      "org.missing@1.0.0.Ghost",
    ]);
  });

  it("marks imported nodes from open namespaces as resolved", () => {
    const { nodes } = buildGraph();
    const base = nodes.find((n) => n.id === "org.base@1.0.0.BaseThing");
    expect(base!.data).toMatchObject({ label: "BaseThing", namespace: "org.base@1.0.0", resolved: true });
  });

  it("marks imported nodes from unopened namespaces as unresolved", () => {
    const { nodes } = buildGraph();
    const ghost = nodes.find((n) => n.id === "org.missing@1.0.0.Ghost");
    expect(ghost!.data).toMatchObject({ label: "Ghost", namespace: "org.missing@1.0.0", resolved: false });
  });

  it("creates an extends edge to the imported supertype", () => {
    const { edges } = buildGraph();
    const ext = edges.find((e) => e.source === "Kid" && e.target === "org.base@1.0.0.BaseThing");
    expect(ext).toBeDefined();
    expect(ext!.label).toBe("extends");
  });

  it("creates property edges to imported types", () => {
    const { edges } = buildGraph();
    const color = edges.find((e) => e.source === "Kid" && e.target === "org.base@1.0.0.Color");
    expect(color).toBeDefined();
    const ghost = edges.find((e) => e.source === "Kid" && e.target === "org.missing@1.0.0.Ghost");
    expect(ghost).toBeDefined();
  });

  it("includes imported-type properties in the node's edgeProperties", () => {
    const { nodes } = buildGraph();
    const kid = nodes.find((n) => n.id === "Kid");
    expect(kid!.data.edgeProperties).toEqual(["color", "ghost"]);
  });

  it("creates no imported nodes without workspace context", () => {
    const { declarations } = parseCto(CHILD_CTO);
    const { nodes, edges } = declarationsToGraph(declarations);
    expect(nodes.filter((n) => n.type === "importedNode")).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it("lets a local declaration shadow an imported type of the same name", () => {
    const shadowCto = `namespace org.child@1.0.0
import org.base@1.0.0.BaseThing

concept BaseThing {
  o String id
}
concept Kid {
  o BaseThing thing
}`;
    const { declarations, imports } = parseCto(shadowCto);
    const externalTypes = buildExternalTypeMap(imports, WORKSPACE);
    const { nodes, edges } = declarationsToGraph(declarations, { externalTypes, workspaceDeclarations: WORKSPACE });
    expect(nodes.filter((n) => n.type === "importedNode")).toHaveLength(0);
    const edge = edges.find((e) => e.source === "Kid");
    expect(edge!.target).toBe("BaseThing");
  });
});
