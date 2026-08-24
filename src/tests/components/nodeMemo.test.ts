import { describe, it, expect } from "vitest";
import { nodePropsEqual } from "../../components/graph/nodeMemo";
import type { Declaration } from "../../utils/graph/types";

const decl = (over: Partial<Declaration> = {}): Declaration => ({
  name: "Person",
  type: "concept",
  isAbstract: false,
  properties: [
    { name: "email", type: "String", isOptional: false, isArray: false, isRelationship: false, validators: {} },
  ],
  enumValues: [],
  identified: "none",
  decorators: [],
  ...over,
});

const onDelete = () => {};

const props = (declaration: Declaration, over: Record<string, unknown> = {}) => ({
  id: "Person",
  selected: false,
  data: { label: "Person", declaration, edgeProperties: ["email"], onDeleteProperty: onDelete, ...over },
});

describe("nodePropsEqual", () => {
  it("treats structurally equal but freshly created data as equal", () => {
    // The parser creates new objects on every run; identical content must
    // not cause a render.
    expect(nodePropsEqual(props(decl()), props(decl()))).toBe(true);
  });

  it("re-renders when the declaration content changed", () => {
    const changed = decl({
      properties: [
        { name: "email", type: "String", isOptional: true, isArray: false, isRelationship: false, validators: {} },
      ],
    });
    expect(nodePropsEqual(props(decl()), props(changed))).toBe(false);
  });

  it("re-renders when selection changed", () => {
    expect(nodePropsEqual(props(decl()), { ...props(decl()), selected: true })).toBe(false);
  });

  it("re-renders when edge anchors changed", () => {
    expect(nodePropsEqual(props(decl()), props(decl(), { edgeProperties: [] }))).toBe(false);
  });

  it("re-renders when a callback identity changed", () => {
    // A skipped render would leave the node holding the old function.
    expect(nodePropsEqual(props(decl()), props(decl(), { onDeleteProperty: () => {} }))).toBe(false);
  });

  it("compares imported-node data without a declaration", () => {
    const imported = (resolved: boolean) => ({
      id: "org.base@1.0.0.Thing",
      selected: false,
      data: { label: "Thing", namespace: "org.base@1.0.0", resolved },
    });
    expect(nodePropsEqual(imported(true), imported(true))).toBe(true);
    expect(nodePropsEqual(imported(true), imported(false))).toBe(false);
  });
});
