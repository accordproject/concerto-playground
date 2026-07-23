import { describe, it, expect } from "vitest";
import { generate } from "../../codegen/generator";

const INVALID_CTO = "this is not valid concerto";

const SIMPLE_CTO = `namespace org.example@1.0.0

concept Person {
  o String name
}
`;

describe("generate", () => {
  it("returns an object with output, isLive, and optional error", async () => {
    const result = await generate([INVALID_CTO], "typescript");
    expect(result).toHaveProperty("output");
    expect(result).toHaveProperty("isLive");
    expect(typeof result.output).toBe("string");
    expect(typeof result.isLive).toBe("boolean");
  }, 15_000);

  it("falls back to static content for typescript when CTO is invalid", async () => {
    const result = await generate([INVALID_CTO], "typescript");
    expect(result.isLive).toBe(false);
    expect(result.output.length).toBeGreaterThan(0);
    expect(result.error).toBeDefined();
  });

  it("falls back to static content for jsonschema when CTO is invalid", async () => {
    const result = await generate([INVALID_CTO], "jsonschema");
    expect(result.isLive).toBe(false);
    expect(result.output.length).toBeGreaterThan(0);
  });

  it("falls back to static content for java when CTO is invalid", async () => {
    const result = await generate([INVALID_CTO], "java");
    expect(result.isLive).toBe(false);
    expect(result.output.length).toBeGreaterThan(0);
  });

  it("falls back to static content for go when CTO is invalid", async () => {
    const result = await generate([INVALID_CTO], "go");
    expect(result.isLive).toBe(false);
    expect(result.output.length).toBeGreaterThan(0);
  });

  it("falls back to static content for openapi when CTO is invalid", async () => {
    const result = await generate([INVALID_CTO], "openapi");
    expect(result.isLive).toBe(false);
    expect(result.output.length).toBeGreaterThan(0);
  });

  it("returns empty output with error for rust when CTO is invalid (no static fallback)", async () => {
    const result = await generate([INVALID_CTO], "rust");
    expect(result.isLive).toBe(false);
    expect(result.output).toBe("");
    expect(result.error).toBeDefined();
    expect(result.error!.length).toBeGreaterThan(0);
  });

  it("returns empty output with error for graphql when CTO is invalid (no static fallback)", async () => {
    const result = await generate([INVALID_CTO], "graphql");
    expect(result.isLive).toBe(false);
    expect(result.output).toBe("");
    expect(result.error).toBeDefined();
  });

  it("static typescript fallback contains expected type identifiers", async () => {
    const result = await generate([INVALID_CTO], "typescript");
    expect(result.output).toContain("GoverningLaw");
    expect(result.output).toContain("NDAData");
  });

  it("static jsonschema fallback is valid JSON", async () => {
    const result = await generate([INVALID_CTO], "jsonschema");
    expect(() => JSON.parse(result.output)).not.toThrow();
  });

  it("generates live TypeScript output for a valid model with no external imports", async () => {
    const result = await generate([SIMPLE_CTO], "typescript");
    expect(result.isLive).toBe(true);
    expect(result.output).toContain("Person");
    expect(result.error).toBeUndefined();
  });

  it("generates live metamodel AST for a valid model", async () => {
    const result = await generate([SIMPLE_CTO], "ast");
    expect(result.isLive).toBe(true);
    const ast = JSON.parse(result.output);
    expect(ast.$class).toBe("concerto.metamodel@1.0.0.Models");
    expect(ast.models[0].namespace).toBe("org.example@1.0.0");
    expect(ast.models[0].declarations[0].name).toBe("Person");
  });

  it("falls back to static AST when CTO is invalid", async () => {
    const result = await generate([INVALID_CTO], "ast");
    expect(result.isLive).toBe(false);
    expect(() => JSON.parse(result.output)).not.toThrow();
    expect(result.output).toContain("NDAData");
  });

  it("generates live Concertino output for a valid model", async () => {
    const result = await generate([SIMPLE_CTO], "concertino");
    expect(result.isLive).toBe(true);
    const concertino = JSON.parse(result.output);
    expect(concertino.declarations["org.example@1.0.0.Person"].type).toBe(
      "ConceptDeclaration",
    );
    expect(
      concertino.declarations["org.example@1.0.0.Person"].properties.name.type,
    ).toBe("String");
  });

  it("falls back to static Concertino when CTO is invalid", async () => {
    const result = await generate([INVALID_CTO], "concertino");
    expect(result.isLive).toBe(false);
    expect(() => JSON.parse(result.output)).not.toThrow();
    expect(result.output).toContain("NDAData");
  });
});
