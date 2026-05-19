import { describe, it, expect } from "vitest";
import { parseCto } from "../../utils/graph/ctoToGraph";
import { declarationsToCto } from "../../utils/graph/graphToCto";
import { Parser } from "@accordproject/concerto-cto";

const ROUNDTRIP_CTO = `namespace org.test@1.0.0

enum Priority {
  o LOW
  o MEDIUM
  o HIGH
}

concept Task {
  o String title
  o String description optional
  o Priority priority
  o Boolean completed default=false
}
`;

describe("declarationsToCto", () => {
  it("produces a string from a parsed model", () => {
    const model = parseCto(ROUNDTRIP_CTO);
    const output = declarationsToCto(model);
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("preserves the namespace in roundtrip", () => {
    const model = parseCto(ROUNDTRIP_CTO);
    const output = declarationsToCto(model);
    expect(output).toContain("org.test@1.0.0");
  });

  it("preserves enum declarations in roundtrip", () => {
    const model = parseCto(ROUNDTRIP_CTO);
    const output = declarationsToCto(model);
    expect(output).toContain("Priority");
    expect(output).toContain("LOW");
    expect(output).toContain("MEDIUM");
    expect(output).toContain("HIGH");
  });

  it("preserves concept declarations in roundtrip", () => {
    const model = parseCto(ROUNDTRIP_CTO);
    const output = declarationsToCto(model);
    expect(output).toContain("Task");
    expect(output).toContain("title");
    expect(output).toContain("description");
    expect(output).toContain("priority");
  });

  it("produces semantically equivalent AST in roundtrip", () => {
    const model = parseCto(ROUNDTRIP_CTO);
    const output = declarationsToCto(model);

    const originalAst = Parser.parse(ROUNDTRIP_CTO, undefined, { skipLocationNodes: true });
    const roundtripAst = Parser.parse(output, undefined, { skipLocationNodes: true });

    expect(roundtripAst.namespace).toBe(originalAst.namespace);
    expect(roundtripAst.declarations).toHaveLength(originalAst.declarations.length);
  });

  it("roundtrip is parseable by validateCto", async () => {
    const { validateCto } = await import("../../utils/graph/ctoToGraph");
    const model = parseCto(ROUNDTRIP_CTO);
    const output = declarationsToCto(model);
    const error = validateCto(output);
    expect(error).toBeNull();
  });

  it("handles a concept with superType", () => {
    const cto = `namespace org.test@1.0.0
concept Base {
  o String id
}
concept Child extends Base {
  o String extra
}`;
    const model = parseCto(cto);
    const output = declarationsToCto(model);
    expect(output).toContain("extends");
    expect(output).toContain("Base");
    expect(output).toContain("Child");
  });

  it("handles an abstract concept", () => {
    const cto = `namespace org.test@1.0.0
abstract concept Shape {
  o String color
}`;
    const model = parseCto(cto);
    const output = declarationsToCto(model);
    expect(output).toContain("abstract");
    expect(output).toContain("Shape");
  });

  it("handles array properties", () => {
    const cto = `namespace org.test@1.0.0
concept Container {
  o String[] items
}`;
    const model = parseCto(cto);
    const output = declarationsToCto(model);
    expect(output).toContain("items");
    const reparsed = Parser.parse(output, undefined, { skipLocationNodes: true });
    const itemsProp = (reparsed.declarations[0] as any).properties[0];
    expect(itemsProp.isArray).toBe(true);
  });

  it("handles optional properties", () => {
    const cto = `namespace org.test@1.0.0
concept Example {
  o String required
  o String maybeNull optional
}`;
    const model = parseCto(cto);
    const output = declarationsToCto(model);
    const reparsed = Parser.parse(output, undefined, { skipLocationNodes: true });
    const props = (reparsed.declarations[0] as any).properties;
    const maybeNull = props.find((p: any) => p.name === "maybeNull");
    expect(maybeNull.isOptional).toBe(true);
  });
});
