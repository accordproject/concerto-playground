import { describe, it, expect } from "vitest";
import { getConceptHint, DECLARATION_KINDS } from "../../utils/conceptHints";

const KEYWORDS = [
  "namespace", "import", "from", "abstract", "extends", "identified", "by",
  "o", "optional", "default", "range", "regex", "length",
];

const PRIMITIVES = ["String", "Integer", "Long", "Double", "Boolean", "DateTime"];

describe("getConceptHint", () => {
  it("covers every declaration kind rendered on graph node headers", () => {
    for (const kind of ["concept", "asset", "participant", "transaction", "event", "enum", "scalar", "map"]) {
      expect(DECLARATION_KINDS, kind).toContain(kind);
      const hint = getConceptHint(kind);
      expect(hint, kind).toBeDefined();
      expect(hint!.title).toBe(kind);
      expect(hint!.summary.length, kind).toBeGreaterThan(40);
    }
  });

  it("covers the structural keywords and validators", () => {
    for (const keyword of KEYWORDS) {
      const hint = getConceptHint(keyword);
      expect(hint, keyword).toBeDefined();
      expect(hint!.summary.length, keyword).toBeGreaterThan(20);
    }
  });

  it("covers the primitive types", () => {
    for (const primitive of PRIMITIVES) {
      expect(getConceptHint(primitive), primitive).toBeDefined();
    }
  });

  it("covers decorators and the relationship arrow", () => {
    expect(getConceptHint("@")?.title).toBe("@decorator");
    expect(getConceptHint("-->")?.title).toContain("relationship");
  });

  it("describes relationships as targeting any identifiable declaration", () => {
    // The specification allows a relationship to target any identifiable
    // type (declared with 'identified by' or 'identified'), not only assets
    // and participants: an identified concept is a valid target.
    const hint = getConceptHint("-->")!;
    expect(hint.summary).toContain("identifiable declaration");
    expect(hint.summary).not.toMatch(/asset or participant/);
    expect(hint.syntax).toContain("concept Person identified by id");
  });

  it("describes DateTime as accepting date-only and date-time values", () => {
    // Spec: DateTime is an ISO 8601 / RFC 3339 compatible date or dateTime
    // instance with a UTC offset; date-only values like YYYY-MM-DD are valid.
    const hint = getConceptHint("DateTime")!;
    expect(hint.summary).toContain("date or date-time");
    expect(hint.summary).toContain("Date-only");
  });

  it("matches case-sensitively so user-defined names do not collide", () => {
    // A concept named "Event" must not trigger the "event" keyword hint
    expect(getConceptHint("Event")).toBeUndefined();
    expect(getConceptHint("Concept")).toBeUndefined();
    expect(getConceptHint("string")).toBeUndefined();
  });

  it("returns undefined for unknown words and object prototype names", () => {
    expect(getConceptHint("Person")).toBeUndefined();
    expect(getConceptHint("")).toBeUndefined();
    expect(getConceptHint("toString")).toBeUndefined();
    expect(getConceptHint("constructor")).toBeUndefined();
  });
});
