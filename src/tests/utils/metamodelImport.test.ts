import { describe, it, expect } from "vitest";
import { astToCtoSources, looksLikeJson } from "../../utils/metamodelImport";

const CTO = `namespace org.test@1.0.0

concept Person {
  o String name
}
`;

// Build a real metamodel AST from CTO via Concerto itself, so the tests do not
// hard-code a metamodel version.
async function ctoToAst(cto: string): Promise<object> {
  const { Parser } = await import("@accordproject/concerto-cto");
  return Parser.parse(cto) as object;
}

describe("looksLikeJson", () => {
  it("accepts objects and arrays with leading whitespace", () => {
    expect(looksLikeJson('{"a":1}')).toBe(true);
    expect(looksLikeJson("  [1,2]")).toBe(true);
  });

  it("rejects CTO source", () => {
    expect(looksLikeJson(CTO)).toBe(false);
  });
});

describe("astToCtoSources", () => {
  it("round-trips a single Model AST to CTO", async () => {
    const ast = await ctoToAst(CTO);
    const sources = await astToCtoSources(JSON.stringify(ast));
    expect(sources).toHaveLength(1);
    expect(sources[0]).toContain("namespace org.test@1.0.0");
    expect(sources[0]).toContain("concept Person");
  });

  it("round-trips a { models: [...] } container", async () => {
    const ast = (await ctoToAst(CTO)) as { $class: string };
    const container = {
      $class: ast.$class.replace(/\.Model$/, ".Models"),
      models: [ast],
    };
    const sources = await astToCtoSources(JSON.stringify(container));
    expect(sources).toHaveLength(1);
    expect(sources[0]).toContain("concept Person");
  });

  it("rejects JSON without a concerto.metamodel $class with a clear message", async () => {
    const jsonSchema = JSON.stringify({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: { name: { type: "string" } },
    });
    await expect(astToCtoSources(jsonSchema)).rejects.toThrow(/Not a Concerto metamodel/);
  });

  it("rejects invalid JSON with a SyntaxError", async () => {
    await expect(astToCtoSources("{ not json")).rejects.toThrow(SyntaxError);
  });

  it("rejects a structurally invalid metamodel", async () => {
    const bogus = JSON.stringify({
      $class: "concerto.metamodel@1.0.0.Model",
      namespace: "org.bad@1.0.0",
      declarations: [{ $class: "concerto.metamodel@1.0.0.NoSuchDeclaration", name: "X" }],
    });
    await expect(astToCtoSources(bogus)).rejects.toThrow();
  });
});
