import { describe, it, expect } from "vitest";
import {
  getExtendsCandidates,
  getMapKeyTypes,
  getMapValueTypes,
} from "../../utils/graph/types";
import type { Declaration } from "../../utils/graph/types";

function makeDecl(overrides: Partial<Declaration>): Declaration {
  return {
    name: "X",
    type: "concept",
    isAbstract: false,
    properties: [],
    enumValues: [],
    identified: "none",
    decorators: [],
    ...overrides,
  };
}

describe("getExtendsCandidates", () => {
  it("excludes the declaration itself", () => {
    const decls = [makeDecl({ name: "A" }), makeDecl({ name: "B" })];
    const candidates = getExtendsCandidates(decls, "A");
    expect(candidates).not.toContain("A");
    expect(candidates).toContain("B");
  });

  it("excludes direct descendants to prevent circular inheritance", () => {
    const decls = [
      makeDecl({ name: "Base" }),
      makeDecl({ name: "Child", superType: "Base" }),
    ];
    const candidates = getExtendsCandidates(decls, "Base");
    expect(candidates).not.toContain("Child");
  });

  it("excludes transitive descendants", () => {
    const decls = [
      makeDecl({ name: "Root" }),
      makeDecl({ name: "Mid", superType: "Root" }),
      makeDecl({ name: "Leaf", superType: "Mid" }),
    ];
    const candidates = getExtendsCandidates(decls, "Root");
    expect(candidates).not.toContain("Mid");
    expect(candidates).not.toContain("Leaf");
  });

  it("excludes enums and maps from candidates", () => {
    const decls = [
      makeDecl({ name: "A" }),
      makeDecl({ name: "MyEnum", type: "enum" }),
      makeDecl({ name: "MyMap", type: "map" }),
    ];
    const candidates = getExtendsCandidates(decls, "A");
    expect(candidates).not.toContain("MyEnum");
    expect(candidates).not.toContain("MyMap");
  });

  it("returns empty array when declaration not found", () => {
    const decls = [makeDecl({ name: "A" })];
    expect(getExtendsCandidates(decls, "Missing")).toEqual([]);
  });
});

describe("getMapKeyTypes", () => {
  it("always includes String and DateTime primitives", () => {
    const keys = getMapKeyTypes([]);
    expect(keys).toContain("String");
    expect(keys).toContain("DateTime");
  });

  it("includes scalar declarations extending String or DateTime", () => {
    const decls = [
      makeDecl({ name: "MyStr", type: "scalar", scalarExtends: "String" }),
      makeDecl({ name: "MyDate", type: "scalar", scalarExtends: "DateTime" }),
    ];
    const keys = getMapKeyTypes(decls);
    expect(keys).toContain("MyStr");
    expect(keys).toContain("MyDate");
  });

  it("excludes scalars extending Integer or other non-key types", () => {
    const decls = [
      makeDecl({ name: "MyInt", type: "scalar", scalarExtends: "Integer" }),
    ];
    const keys = getMapKeyTypes(decls);
    expect(keys).not.toContain("MyInt");
  });

  it("excludes non-scalar declarations", () => {
    const decls = [makeDecl({ name: "MyConcept", type: "concept" })];
    const keys = getMapKeyTypes(decls);
    expect(keys).not.toContain("MyConcept");
  });
});

describe("getMapValueTypes", () => {
  it("always includes all primitive value types", () => {
    const vals = getMapValueTypes([]);
    ["String", "DateTime", "Integer", "Long", "Double", "Boolean"].forEach((t) => {
      expect(vals).toContain(t);
    });
  });

  it("includes concept/asset/participant/event/transaction declarations", () => {
    const decls = [
      makeDecl({ name: "MyConcept", type: "concept" }),
      makeDecl({ name: "MyAsset", type: "asset" }),
    ];
    const vals = getMapValueTypes(decls);
    expect(vals).toContain("MyConcept");
    expect(vals).toContain("MyAsset");
  });

  it("excludes enum and map declarations", () => {
    const decls = [
      makeDecl({ name: "MyEnum", type: "enum" }),
      makeDecl({ name: "MyMap", type: "map" }),
    ];
    const vals = getMapValueTypes(decls);
    expect(vals).not.toContain("MyEnum");
    expect(vals).not.toContain("MyMap");
  });

  it("includes scalars extending valid value primitive bases", () => {
    const decls = [
      makeDecl({ name: "MyInt", type: "scalar", scalarExtends: "Integer" }),
    ];
    const vals = getMapValueTypes(decls);
    expect(vals).toContain("MyInt");
  });
});
