import { describe, expect, it } from "vitest";
import { Parser } from "@accordproject/concerto-cto";
import { validateCto } from "../../utils/graph/ctoToGraph";
import {
  DEFAULT_IMPORT_NAMESPACE,
  extractNamespace,
  inferCtoFromImportText,
  isLikelyConcertoJson,
  isLikelyJsonSchema,
} from "../../utils/import/importInference";

function metamodelFromCto(cto: string): object {
  return Parser.parse(cto, undefined, { skipLocationNodes: true });
}

describe("inferCtoFromImportText", () => {
  it("accepts pasted CTO", async () => {
    const cto = "namespace org.example.pasted@1.0.0\n\nconcept Person {}\n";
    const result = await inferCtoFromImportText(cto);

    expect(result).toEqual({ kind: "cto", ctoSources: [cto] });
  });

  it("converts a single Concerto JSON model into CTO", async () => {
    const result = await inferCtoFromImportText(JSON.stringify(metamodelFromCto(
      "namespace org.example.meta@1.0.0\n\nconcept Person {}\n",
    )));

    expect(result.kind).toBe("concerto-json");
    expect(result.ctoSources).toHaveLength(1);
    expect(result.ctoSources[0]).toContain("namespace org.example.meta@1.0.0");
  });

  it("converts a Concerto JSON models container into multiple CTO sources", async () => {
    const result = await inferCtoFromImportText(JSON.stringify({
      $class: "concerto.metamodel@1.0.0.Models",
      models: [
        metamodelFromCto("namespace org.example.one@1.0.0\n\nconcept One {}\n"),
        metamodelFromCto("namespace org.example.two@1.0.0\n\nconcept Two {}\n"),
      ],
    }));

    expect(result.kind).toBe("concerto-json");
    expect(result.ctoSources).toHaveLength(2);
    expect(result.ctoSources[1]).toContain("namespace org.example.two@1.0.0");
  });

  it("infers valid CTO from a plain JSON object", async () => {
    const result = await inferCtoFromImportText(
      JSON.stringify({ firstName: "Alice", age: 31, active: true }),
      { fallbackNamespace: "org.example.active@1.0.0" },
    );

    expect(result.kind).toBe("json");
    expect(extractNamespace(result.ctoSources[0])).toBe("org.example.active@1.0.0");
    expect(result.ctoSources[0]).toContain("concept Root");
    expect(validateCto(result.ctoSources[0])).toBeNull();
  });

  it("infers valid CTO from a plain JSON array", async () => {
    const result = await inferCtoFromImportText(
      JSON.stringify([{ firstName: "Alice" }, { firstName: "Bob" }]),
      { fallbackNamespace: "org.example.array@1.0.0" },
    );

    expect(result.kind).toBe("json");
    expect(result.ctoSources[0]).toContain("concept Root");
    expect(validateCto(result.ctoSources[0])).toBeNull();
  });

  it("infers valid CTO from a JSON Schema document", async () => {
    const result = await inferCtoFromImportText(JSON.stringify({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "Customer",
      type: "object",
      properties: { firstName: { type: "string" }, age: { type: "integer" } },
      required: ["firstName"],
    }), { fallbackNamespace: "org.example.schema@1.0.0" });

    expect(result.kind).toBe("json-schema");
    expect(extractNamespace(result.ctoSources[0])).toBe("org.example.schema@1.0.0");
    expect(result.ctoSources[0]).toContain("concept Customer");
    expect(validateCto(result.ctoSources[0])).toBeNull();
  });

  it("rejects empty, malformed, and primitive input clearly", async () => {
    await expect(inferCtoFromImportText(" ")).rejects.toThrow("Paste CTO");
    await expect(inferCtoFromImportText("{ this is not json }")).rejects.toThrow("Invalid JSON or CTO:");
    await expect(inferCtoFromImportText('"hello"')).rejects.toThrow("Input must be a JSON object");
  });

  it("detects every supported top-level JSON Schema marker", () => {
    for (const marker of ["$schema", "$id", "properties", "definitions", "$defs"]) {
      expect(isLikelyJsonSchema({ [marker]: marker === "$schema" || marker === "$id" ? "value" : {} })).toBe(true);
    }
    expect(isLikelyJsonSchema({ firstName: "Alice", age: 31 })).toBe(false);
  });

  it("detects Concerto JSON before JSON Schema", async () => {
    const metamodel = {
      ...metamodelFromCto("namespace org.example.priority@1.0.0\n\nconcept Priority {}\n"),
      properties: {},
    };

    expect(isLikelyConcertoJson(metamodel)).toBe(true);
    expect(isLikelyJsonSchema(metamodel)).toBe(true);
    await expect(inferCtoFromImportText(JSON.stringify(metamodel))).rejects.toThrow(
      "Unable to import Concerto JSON:",
    );
  });

  it("uses schema namespace inferred from $id when provided", async () => {
    const result = await inferCtoFromImportText(JSON.stringify({
      $id: "https://example.com/contracts/customer.schema.json",
      type: "object",
      properties: { customerId: { type: "string" } },
    }), { fallbackNamespace: "org.example.fallback@1.0.0" });

    expect(extractNamespace(result.ctoSources[0])).toBe("com.example.contracts@1.0.0");
    expect(validateCto(result.ctoSources[0])).toBeNull();
  });

  it("uses active and default namespace fallbacks", async () => {
    const active = await inferCtoFromImportText('{"productName":"Widget"}', {
      fallbackNamespace: "org.example.active@1.0.0",
    });
    const fallback = await inferCtoFromImportText('{"productName":"Widget"}');

    expect(extractNamespace(active.ctoSources[0])).toBe("org.example.active@1.0.0");
    expect(extractNamespace(fallback.ctoSources[0])).toBe(DEFAULT_IMPORT_NAMESPACE);
  });
});
