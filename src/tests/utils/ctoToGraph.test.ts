import { describe, it, expect } from "vitest";
import { parseCto, validateCto, declarationsToGraph, describeParseError } from "../../utils/graph/ctoToGraph";

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
    expect(partyEdges.map((edge) => edge.targetHandle)).toEqual(["left", "left"]);
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
