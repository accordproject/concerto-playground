import { describe, expect, it } from "vitest";
import { validateCto } from "../../utils/graph/ctoToGraph";
import {
  extractNamespace,
  inferCtoFromJsonText,
  isLikelyJsonSchema,
} from "../../utils/import/importInference";

describe("inferCtoFromJsonText", () => {
  it("infers valid CTO from a plain JSON object", async () => {
    const result = await inferCtoFromJsonText(
      JSON.stringify({
        firstName: "Alice",
        age: 31,
        active: true,
      }),
      { fallbackNamespace: "org.example.active@1.0.0" },
    );

    expect(result.kind).toBe("json");
    expect(extractNamespace(result.cto)).toBe("org.example.active@1.0.0");
    expect(result.cto).toContain("concept Root");
    expect(validateCto(result.cto)).toBeNull();
  });

  it("infers valid CTO from a plain JSON array", async () => {
    const result = await inferCtoFromJsonText(
      JSON.stringify([
        { firstName: "Alice", age: 31 },
        { firstName: "Bob", age: 29 },
      ]),
      { fallbackNamespace: "org.example.array@1.0.0" },
    );

    expect(result.kind).toBe("json");
    expect(result.cto).toContain("concept Root");
    expect(validateCto(result.cto)).toBeNull();
  });

  it("infers valid CTO from a JSON Schema document", async () => {
    const result = await inferCtoFromJsonText(
      JSON.stringify({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title: "Customer",
        type: "object",
        properties: {
          firstName: { type: "string" },
          age: { type: "integer" },
        },
        required: ["firstName"],
      }),
      { fallbackNamespace: "org.example.schema@1.0.0" },
    );

    expect(result.kind).toBe("json-schema");
    expect(extractNamespace(result.cto)).toBe("org.example.schema@1.0.0");
    expect(result.cto).toContain("concept Customer");
    expect(validateCto(result.cto)).toBeNull();
  });

  it("throws a clear error for invalid JSON", async () => {
    await expect(
      inferCtoFromJsonText("{ this is not json }"),
    ).rejects.toThrow(/Invalid JSON:/);
  });

  it("detects JSON Schema using top-level schema markers", () => {
    expect(isLikelyJsonSchema({ properties: { firstName: { type: "string" } } })).toBe(true);
    expect(isLikelyJsonSchema({ $defs: { Name: { type: "string" } } })).toBe(true);
    expect(isLikelyJsonSchema({ firstName: "Alice", age: 31 })).toBe(false);
  });

  it("uses schema namespace inferred from $id when provided", async () => {
    const result = await inferCtoFromJsonText(
      JSON.stringify({
        $id: "https://example.com/contracts/customer.schema.json",
        type: "object",
        properties: {
          customerId: { type: "string" },
        },
      }),
      { fallbackNamespace: "org.example.fallback@1.0.0" },
    );

    expect(result.kind).toBe("json-schema");
    expect(extractNamespace(result.cto)).toBe("com.example.contracts");
  });

  it("uses the active namespace as fallback when the input has no namespace", async () => {
    const result = await inferCtoFromJsonText(
      JSON.stringify({
        productName: "Widget",
      }),
      { fallbackNamespace: "org.example.active@1.0.0" },
    );

    expect(result.namespace).toBe("org.example.active@1.0.0");
    expect(extractNamespace(result.cto)).toBe("org.example.active@1.0.0");
  });
});
