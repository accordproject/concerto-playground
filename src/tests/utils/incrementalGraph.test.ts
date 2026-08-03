import { describe, it, expect } from "vitest";
import { declarationsToGraph } from "../../utils/graph/ctoToGraph";
import type { Declaration } from "../../utils/graph/types";

const decl = (name: string, over: Partial<Declaration> = {}): Declaration => ({
  name,
  type: "concept",
  isAbstract: false,
  properties: [],
  enumValues: [],
  identified: "none",
  decorators: [],
  ...over,
});

// A fresh parse produces new objects even for unchanged declarations; the
// tests model that by always building declarations from scratch.
const model = () => [
  decl("Person", {
    properties: [
      { name: "address", type: "Address", isOptional: false, isArray: false, isRelationship: false, validators: {} },
    ],
  }),
  decl("Address"),
];

describe("declarationsToGraph incremental updates", () => {
  it("keeps the exact node objects for unchanged declarations", () => {
    const first = declarationsToGraph(model());
    const second = declarationsToGraph(model(), {}, first);

    expect(second.nodes.find((n) => n.id === "Person")).toBe(first.nodes.find((n) => n.id === "Person"));
    expect(second.nodes.find((n) => n.id === "Address")).toBe(first.nodes.find((n) => n.id === "Address"));
    expect(second.edges[0]).toBe(first.edges[0]);
  });

  it("keeps the position but renews the object for a changed declaration", () => {
    const first = declarationsToGraph(model());
    const changed = model();
    changed[1] = decl("Address", {
      properties: [
        { name: "city", type: "String", isOptional: false, isArray: false, isRelationship: false, validators: {} },
      ],
    });
    const second = declarationsToGraph(changed, {}, first);

    const before = first.nodes.find((n) => n.id === "Address")!;
    const after = second.nodes.find((n) => n.id === "Address")!;
    expect(after).not.toBe(before);
    expect(after.position).toEqual(before.position);
    // The untouched declaration still reuses its object.
    expect(second.nodes.find((n) => n.id === "Person")).toBe(first.nodes.find((n) => n.id === "Person"));
  });

  it("adds a new declaration without moving any existing node", () => {
    const first = declarationsToGraph(model());
    const grown = [...model(), decl("Company")];
    const second = declarationsToGraph(grown, {}, first);

    for (const node of first.nodes) {
      expect(second.nodes.find((n) => n.id === node.id)).toBe(node);
    }
    const added = second.nodes.find((n) => n.id === "Company")!;
    expect(added).toBeDefined();
    const maxExistingX = Math.max(...first.nodes.map((n) => n.position.x));
    expect(added.position.x).toBeGreaterThan(maxExistingX);
  });

  it("drops nodes for removed declarations", () => {
    const first = declarationsToGraph(model());
    const second = declarationsToGraph([model()[0]], {}, first);
    expect(second.nodes.find((n) => n.id === "Address")).toBeUndefined();
  });

  it("runs a full layout when the previous graph does not overlap (new model)", () => {
    const first = declarationsToGraph(model());
    const other = [decl("Vehicle"), decl("Wheel")];
    const second = declarationsToGraph(other, {}, first);

    // Fresh layout starts at the tree origin, not in a new-node column.
    expect(Math.min(...second.nodes.map((n) => n.position.x))).toBe(0);
  });

  it("runs a full layout when there is no previous graph", () => {
    const graph = declarationsToGraph(model());
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
  });
});
