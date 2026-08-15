import { describe, it, expect } from "vitest";
import { parseCto } from "../../utils/graph/ctoToGraph";
import { declarationsToCto } from "../../utils/graph/graphToCto";
import { Parser } from "@accordproject/concerto-cto";
import { VEHICLES_EXAMPLE } from "../../examples/nda.cto";
import type { ConcertoModel, Declaration, Property } from "../../utils/graph/types";

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

  it("preserves defaults on enum-typed properties without double-quoting", () => {
    const cto = `namespace org.test@1.0.0

enum Condition {
  o NEW
  o USED
}

concept Vehicle {
  o Condition condition default="USED"
}
`;
    const model = parseCto(cto);
    const output = declarationsToCto(model);
    expect(output).toContain('default="USED"');
    expect(output).not.toContain('""');
    expect(() => parseCto(output)).not.toThrow();
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

  it("roundtrips the vehicles example without breaking enum defaults", async () => {
    const { validateCto } = await import("../../utils/graph/ctoToGraph");
    const model = parseCto(VEHICLES_EXAMPLE);
    const output = declarationsToCto(model);

    expect(validateCto(output)).toBeNull();
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

/**
 * Asserts that `cto -> graph model -> cto` loses nothing, by comparing the
 * metamodel AST of the source against the AST of the serialized output.
 * Location nodes are skipped so only semantic content is compared.
 */
function expectLosslessRoundTrip(cto: string) {
  const output = declarationsToCto(parseCto(cto));
  const source = Parser.parse(cto, undefined, { skipLocationNodes: true });
  const roundTripped = Parser.parse(output, undefined, { skipLocationNodes: true });
  expect(roundTripped).toEqual(source);
}

describe("declarationsToCto round-trip fidelity", () => {
  const cases: Array<[string, string]> = [
    [
      "named imports",
      `namespace org.test@1.0.0
import org.base@1.0.0.Thing
concept Holder {
  o Thing thing
}`,
    ],
    [
      "multi-type imports",
      `namespace org.test@1.0.0
import org.multi@1.0.0.{Alpha,Beta}
concept Holder {
  o Alpha alpha
  o Beta beta
}`,
    ],
    [
      "imports with a source URI",
      `namespace org.test@1.0.0
import org.base@1.0.0.Thing from https://example.com/base.cto
concept Holder {
  o Thing thing
}`,
    ],
    [
      "scalars with each validator kind",
      `namespace org.test@1.0.0
scalar Email extends String regex=/^.+@.+$/
scalar Age extends Integer range=[0,150]
scalar Code extends String length=[2,10]
scalar Level extends Integer default=1 range=[0,10]
concept Person {
  o Email email
  o Age age
  o Code code
  o Level level
}`,
    ],
    [
      "map declarations over primitive and object types",
      `namespace org.test@1.0.0
concept Money {
  o Double amount
}
map Prices {
  o String
  o Double
}
map Wallets {
  o String
  o Money
}
map Timestamps {
  o DateTime
  o Boolean
}`,
    ],
    [
      "every class declaration type",
      `namespace org.test@1.0.0
asset Car {
  o String vin
}
participant Driver {
  o String name
}
event Started {
  o DateTime at
}
transaction Trip {
  o String id
}
concept Address {
  o String city
}`,
    ],
    [
      "identity declarations",
      `namespace org.test@1.0.0
asset Car identified by vin {
  o String vin
}
participant Driver identified {
  o String name
}`,
    ],
    [
      "relationships, arrays and optionality",
      `namespace org.test@1.0.0
asset Car {
  o String vin
}
participant Driver {
  --> Car car
  --> Car[] fleet
  --> Car spare optional
  o String[] nicknames optional
}`,
    ],
    [
      "abstract declarations and inheritance",
      `namespace org.test@1.0.0
abstract concept Base {
  o String id
}
concept Child extends Base {
  o String extra
}`,
    ],
    [
      "typed default values",
      `namespace org.test@1.0.0
enum Condition {
  o NEW
  o USED
}
concept Defaults {
  o String label default="none"
  o Boolean active default=true
  o Boolean archived default=false
  o Integer count default=7
  o Long total default=99
  o Double ratio default=0.5
  o Condition condition default="USED"
}`,
    ],
    [
      "regex validators carrying flags",
      `namespace org.test@1.0.0
concept Patterns {
  o String plain regex=/^[a-z]+$/
  o String flagged regex=/^[a-z]+$/i
}`,
    ],
    [
      "open-ended range and length bounds",
      `namespace org.test@1.0.0
concept Bounds {
  o Integer atLeast range=[5,]
  o Integer atMost range=[,10]
  o String minLength length=[3,]
  o String maxLength length=[,20]
}`,
    ],
    [
      "decorators with every argument kind",
      `namespace org.test@1.0.0
@Term("a person")
@Count(42)
@Enabled(true)
@Points(String)
@Bare
concept Person {
  o String name
}`,
    ],
    [
      "qualified type and superType references",
      `namespace org.test@1.0.0
import org.base@1.0.0.{Base,Ref}
concept Child extends Base {
  o Ref ref
  --> Ref link
}`,
    ],
    [
      "declarations with no properties",
      `namespace org.test@1.0.0
concept Empty {
}`,
    ],
  ];

  for (const [name, cto] of cases) {
    it(`preserves ${name}`, () => {
      expectLosslessRoundTrip(cto);
    });
  }
});

/**
 * The graph editor can build models that the CTO parser cannot produce, so
 * these branches are driven by constructing a `ConcertoModel` directly.
 */
describe("declarationsToCto from directly constructed models", () => {
  const declaration = (overrides: Partial<Declaration> & Pick<Declaration, "name" | "type">): Declaration => ({
    isAbstract: false,
    properties: [],
    enumValues: [],
    identified: "none",
    decorators: [],
    ...overrides,
  });

  const property = (overrides: Partial<Property> & Pick<Property, "name" | "type">): Property => ({
    isOptional: false,
    isArray: false,
    isRelationship: false,
    validators: {},
    ...overrides,
  });

  const model = (overrides: Partial<ConcertoModel>): ConcertoModel => ({
    namespace: "org.test@1.0.0",
    imports: [],
    declarations: [],
    ...overrides,
  });

  it("emits a wildcard import for an import-all statement", () => {
    const output = declarationsToCto(
      model({
        imports: [{ namespace: "org.other@1.0.0", types: ["*"] }],
        declarations: [declaration({ name: "Holder", type: "concept" })],
      }),
    );
    expect(output).toContain("import org.other@1.0.0.*");
    expect(output).not.toContain("from");
  });

  it("emits a wildcard import with its source URI", () => {
    const output = declarationsToCto(
      model({
        imports: [{ namespace: "org.other@1.0.0", types: ["*"], uri: "https://example.com/other.cto" }],
        declarations: [declaration({ name: "Holder", type: "concept" })],
      }),
    );
    expect(output).toContain("import org.other@1.0.0.* from https://example.com/other.cto");
  });

  it("emits a multi-type import with its source URI", () => {
    const output = declarationsToCto(
      model({
        imports: [{ namespace: "org.multi@1.0.0", types: ["Alpha", "Beta"], uri: "https://example.com/multi.cto" }],
        declarations: [declaration({ name: "Holder", type: "concept" })],
      }),
    );
    expect(output).toContain("import org.multi@1.0.0.{Alpha,Beta} from https://example.com/multi.cto");
  });

  it("defaults a scalar with no declared base to String", () => {
    const output = declarationsToCto(
      model({ declarations: [declaration({ name: "Ident", type: "scalar" })] }),
    );
    expect(output).toContain("scalar Ident extends String");
    expect(parseCto(output).declarations[0].scalarExtends).toBe("String");
  });

  it("defaults both map types to String when the map declaration is absent", () => {
    const output = declarationsToCto(
      model({ declarations: [declaration({ name: "Lookup", type: "map" })] }),
    );
    const reparsed = parseCto(output);
    expect(reparsed.declarations[0].mapDeclaration).toEqual({ keyType: "String", valueType: "String" });
  });

  it("emits object map key and value types for non-primitive types", () => {
    const output = declarationsToCto(
      model({
        declarations: [
          declaration({ name: "Ident", type: "scalar", scalarExtends: "String" }),
          declaration({ name: "Lookup", type: "map", mapDeclaration: { keyType: "Ident", valueType: "Ident" } }),
        ],
      }),
    );
    const reparsed = parseCto(output);
    expect(reparsed.declarations[1].mapDeclaration).toEqual({ keyType: "Ident", valueType: "Ident" });
  });

  it("qualifies property and superType references that carry a namespace", () => {
    const output = declarationsToCto(
      model({
        imports: [{ namespace: "org.base@1.0.0", types: ["Base", "Ref"] }],
        declarations: [
          declaration({
            name: "Child",
            type: "concept",
            superType: "Base",
            superTypeNamespace: "org.base@1.0.0",
            properties: [
              property({ name: "ref", type: "Ref", typeNamespace: "org.base@1.0.0" }),
              property({ name: "link", type: "Ref", typeNamespace: "org.base@1.0.0", isRelationship: true }),
            ],
          }),
        ],
      }),
    );
    expect(output).toContain("concept Child extends Base");
    expect(output).toContain("o Ref ref");
    expect(output).toContain("--> Ref link");
    expect(parseCto(output).declarations[0].superType).toBe("Base");
  });
  it("ignores malformed validators while keeping the property shape stable", () => {
    const output = declarationsToCto(
      model({
        declarations: [
          declaration({
            name: "Example",
            type: "concept",
            properties: [
              property({
                name: "title",
                type: "String",
                validators: { regex: "not-a-regex", range: "oops", length: "bad-length" },
              }),
            ],
          }),
        ],
      }),
    );

    const reparsed = parseCto(output);
    const properties = (reparsed.declarations[0] as any).properties;
    expect(properties).toHaveLength(1);
    expect(properties[0].name).toBe("title");
    expect(properties[0].validator).toBeUndefined();
    expect(properties[0].lengthValidator).toBeUndefined();
  });
});
