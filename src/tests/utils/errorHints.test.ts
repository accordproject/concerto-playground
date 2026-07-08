import { describe, it, expect } from "vitest";
import { parseCto, validateCto, describeParseError } from "../../utils/graph/ctoToGraph";
import { findErrorHint, extractCulpritName, locateCulprit, parseErrorPosition, buildSnippet, stripPosition } from "../../utils/errorHints";

// Runs the real Concerto parser on a broken snippet and returns the official
// message, so the hint rules are tested against what the parser actually says.
function officialParseMessage(cto: string): string {
  try {
    parseCto(cto);
  } catch (e) {
    return describeParseError(e);
  }
  throw new Error("expected the snippet to fail parsing");
}

describe("findErrorHint", () => {
  it("hints when a declaration is missing its name", () => {
    const cto = 'namespace org.x@1.0.0\nconcept {\n}';
    expect(findErrorHint(officialParseMessage(cto), cto)).toContain("has no name");
  });

  it("suggests the joined name when a declaration name contains a space", () => {
    const cto = 'namespace org.x@1.0.0\nenum Contracting party {\n  o A\n}';
    const hint = findErrorHint(officialParseMessage(cto), cto);
    expect(hint).toContain('Rename "Contracting party" to "ContractingParty"');
  });

  it("does not fire the space hint for a valid extends clause", () => {
    const valid = 'namespace org.x@1.0.0\nconcept Base {\n  o String a\n}\nconcept Person extends Base {\n  o String b\n}';
    expect(() => parseCto(valid)).not.toThrow();
  });

  it("hints when a closing brace is missing", () => {
    const cto = 'namespace org.x@1.0.0\nconcept Person {\n  o String name\n';
    expect(findErrorHint(officialParseMessage(cto), cto)).toContain('missing "}"');
  });

  it("hints when the namespace is missing", () => {
    const cto = 'concept Person {\n  o String name\n}';
    expect(findErrorHint(officialParseMessage(cto), cto)).toContain("needs a namespace");
  });

  it("suggests the fixed line when a property lacks the o prefix", () => {
    const cto = 'namespace org.x@1.0.0\nconcept Person {\n  String name\n}';
    expect(findErrorHint(officialParseMessage(cto), cto)).toContain('write "o String name"');
  });

  it("hints about a stray space when a property type contains one", () => {
    const cto = 'namespace org.x@1.0.0\nconcept Person {\n  o Stri ng email\n}';
    const hint = findErrorHint(officialParseMessage(cto), cto);
    expect(hint).toContain('stray space');
    // The old rule fired here and suggested a nonsensical extra "o" marker.
    expect(hint).not.toContain('o o ');
  });

  it("hints when a property is missing its name", () => {
    const cto = 'namespace org.x@1.0.0\nconcept Person {\n  o String\n}';
    expect(findErrorHint(officialParseMessage(cto), cto)).toContain("a type but no name");
  });

  it("hints when a property is stranded outside its declaration by an early brace", () => {
    const cto = 'namespace org.x@1.0.0\nenum GoverningLaw {\n}\n  o DELAWARE\n  o ENGLAND_AND_WALES\n}';
    const hint = findErrorHint(officialParseMessage(cto), cto);
    expect(hint).toContain('closes the declaration too early');
  });

  it("hints on an extra closing brace", () => {
    const cto = 'namespace org.x@1.0.0\nconcept Person {\n  o String name\n}\n}';
    expect(findErrorHint(officialParseMessage(cto), cto)).toContain("closes nothing");
  });

  it("hints when the opening brace is missing", () => {
    const cto = 'namespace org.x@1.0.0\nconcept Person\n  o String name\n}';
    expect(findErrorHint(officialParseMessage(cto), cto)).toContain("never opens");
  });

  it("names the undeclared property type (validator message)", () => {
    const cto = 'namespace org.x@1.0.0\nconcept Person {\n  o Address home\n}';
    const message = validateCto(cto);
    expect(message).not.toBeNull();
    const hint = findErrorHint(message as string, cto);
    expect(hint).toContain('"Address"');
    expect(hint).toContain('does not exist');
  });

  it("names the missing super type (validator message)", () => {
    const cto = 'namespace org.x@1.0.0\nconcept Person extends Base {\n  o String name\n}';
    const message = validateCto(cto);
    expect(message).not.toBeNull();
    const hint = findErrorHint(message as string, cto);
    expect(hint).toContain('"Base"');
    expect(hint).toContain('parent type');
  });

  it("names the duplicated declaration (validator message)", () => {
    const cto = 'namespace org.x@1.0.0\nconcept Person {\n  o String a\n}\nconcept Person {\n  o String b\n}';
    const message = validateCto(cto);
    expect(message).not.toBeNull();
    const hint = findErrorHint(message as string, cto);
    expect(hint).toContain('"Person"');
    expect(hint).toContain('already used');
  });

  it("returns null for unrecognised errors", () => {
    expect(findErrorHint("Something completely different went wrong", "")).toBeNull();
  });

  it("uses the actual value name when an enum value has a type", () => {
    const cto = 'namespace org.x@1.0.0\nenum Status {\n  o String ACTIVE\n}';
    const hint = findErrorHint(officialParseMessage(cto), cto);
    expect(hint).toContain('write "o ACTIVE", not "o String ACTIVE"');
  });

  it("does not flag typed properties inside a concept", () => {
    // The same line that is wrong in an enum is valid in a concept, so the
    // enum hint must depend on the enclosing declaration, not just the line.
    const valid = 'namespace org.x@1.0.0\nconcept Flag {\n  o String ACTIVE\n}';
    expect(() => parseCto(valid)).not.toThrow();
  });

  it("hints when a relationship is used inside an enum", () => {
    const cto = 'namespace org.x@1.0.0\nenum Status {\n  --> Party owner\n}';
    expect(findErrorHint(officialParseMessage(cto), cto)).toContain("not allowed inside an enum");
  });

  it("uses the actual scalar name when extends is missing", () => {
    const cto = 'namespace org.x@1.0.0\nscalar SSN';
    expect(findErrorHint(officialParseMessage(cto), cto)).toContain('"scalar SSN extends String"');
  });

  it("hints when a scalar is given a body", () => {
    const cto = 'namespace org.x@1.0.0\nscalar SSN {\n  o String\n}';
    expect(findErrorHint(officialParseMessage(cto), cto)).toContain("extend a primitive type");
  });

  it("names the unclosed declaration when a new one starts before it is closed", () => {
    const cto = 'namespace org.x@1.0.0\nenum GoverningLaw {\n  o NEW_YORK\n  o CALIFORNIA\n\nconcept Party {\n  o String name\n}';
    const hint = findErrorHint(officialParseMessage(cto), cto);
    expect(hint).toContain('enum "GoverningLaw"');
    expect(hint).toContain('missing its closing "}"');
  });

  it("also detects an unclosed concept followed by another declaration", () => {
    const cto = 'namespace org.x@1.0.0\nconcept Person {\n  o String name\nenum Status {\n  o ACTIVE\n}';
    const hint = findErrorHint(officialParseMessage(cto), cto);
    expect(hint).toContain('concept "Person"');
  });

  it("keeps the enum hints scoped to the broken declaration", () => {
    // The error is inside the second declaration (a concept), even though an
    // enum was closed above it: the enum rules must not fire.
    const cto = 'namespace org.x@1.0.0\nenum Status {\n  o ACTIVE\n}\nconcept Person {\n  String name\n}';
    expect(findErrorHint(officialParseMessage(cto), cto)).toContain("starts with a marker");
  });
});

describe("locateCulprit", () => {
  it("points at the line where an undeclared type is used", () => {
    const cto = 'namespace org.x@1.0.0\nconcept NDAData {\n  o String name\n  o GoverningLaw governingLaw\n}';
    const message = validateCto(cto);
    expect(message).not.toBeNull();
    expect(locateCulprit(message as string, cto)).toMatchObject({ name: "GoverningLaw", line: 4, column: 5 });
  });

  it("points at the line of a missing super type", () => {
    const cto = 'namespace org.x@1.0.0\nconcept Person extends Base {\n  o String name\n}';
    const message = validateCto(cto);
    expect(message).not.toBeNull();
    expect(locateCulprit(message as string, cto)).toMatchObject({ name: "Base", line: 2 });
  });

  it("points at the second (offending) occurrence of a duplicate name", () => {
    const cto = 'namespace org.x@1.0.0\nconcept Person {\n  o String a\n}\nconcept Person {\n  o String b\n}';
    const message = validateCto(cto);
    expect(message).not.toBeNull();
    expect(extractCulpritName(message as string)).toBe("Person");
    expect(locateCulprit(message as string, cto)).toMatchObject({ name: "Person", line: 5 });
  });

  it("returns null for messages without a recognisable name", () => {
    expect(extractCulpritName("Something else went wrong")).toBeNull();
    expect(locateCulprit("Something else went wrong", "namespace org.x@1.0.0")).toBeNull();
  });

  // Regression: hand-rolled ASCII regexes broke on identifiers the Concerto
  // parser accepts. The name and position now come from the parser AST.
  it("keeps a Unicode type name whole (not truncated at the first non-ASCII char)", () => {
    const cto = 'namespace org.x@1.0.0\nconcept Person extends CharlesⅢ {\n  o String n\n}';
    const message = validateCto(cto);
    expect(message).not.toBeNull();
    expect(extractCulpritName(message as string)).toBe("CharlesⅢ");
    expect(locateCulprit(message as string, cto)).toMatchObject({ name: "CharlesⅢ", line: 2 });
  });

  it("locates a Unicode undeclared type", () => {
    const cto = 'namespace org.x@1.0.0\nconcept Person {\n  o αβγ other\n}';
    const message = validateCto(cto);
    expect(message).not.toBeNull();
    expect(locateCulprit(message as string, cto)).toMatchObject({ name: "αβγ", line: 3 });
  });

  it("locates a $-prefixed undeclared type", () => {
    const cto = 'namespace org.x@1.0.0\nconcept Person {\n  o $foo x\n}';
    const message = validateCto(cto);
    expect(message).not.toBeNull();
    expect(locateCulprit(message as string, cto)).toMatchObject({ name: "$foo", line: 3 });
  });
});

describe("stripPosition", () => {
  it("removes a trailing line/column suffix", () => {
    expect(stripPosition('Expected "o" but "C" found. Line 8 column 2')).toBe(
      'Expected "o" but "C" found',
    );
  });

  it("leaves a positionless message untouched", () => {
    expect(stripPosition('Undeclared type "Address"')).toBe('Undeclared type "Address"');
  });
});

describe("buildSnippet", () => {
  it("shows the offending line with a caret at the column", () => {
    const cto = 'namespace org.x@1.0.0\nenum Contracting party {\n}';
    const message = officialParseMessage(cto);
    const position = parseErrorPosition(message)!;
    const snippet = buildSnippet(cto, position.line, position.column);
    expect(snippet).not.toBeNull();
    const [codeLine, caretLine] = (snippet as string).split('\n');
    expect(codeLine).toBe('2 | enum Contracting party {');
    // The caret must sit under the column the parser reported
    expect(caretLine.indexOf('^')).toBe('2 | '.length + position.column - 1);
  });

  it("returns null when the line is out of range", () => {
    expect(buildSnippet('namespace org.x@1.0.0', 99, 1)).toBeNull();
  });
});
