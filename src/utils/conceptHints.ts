// Contextual hints for Concerto language elements (US-06).
// Summaries follow the Concerto metamodel specification:
// https://concerto.accordproject.org/docs/design/specification/model-classes
// One entry per keyword / declaration kind / primitive type; both the Monaco
// hover provider and the graph node header popovers read from this table.

export interface ConceptHint {
  /** Display title, usually the keyword itself. */
  title: string;
  /** One-paragraph plain-language summary of when to use the element. */
  summary: string;
  /** Optional short CTO snippet illustrating the syntax. */
  syntax?: string;
}

const DECLARATION_HINTS: Record<string, ConceptHint> = {
  concept: {
    title: "concept",
    summary:
      "The general-purpose class of the metamodel: a named set of typed properties. Use it for structured data that is not an asset, participant, transaction or event. Concepts can be abstract and can extend another concept.",
    syntax: "concept Address {\n  o String street\n  o String city\n}",
  },
  asset: {
    title: "asset",
    summary:
      "A domain object whose instances have identity and are worth tracking over time, such as a vehicle, an order or a contract. Assets must be identified, typically with 'identified by' naming the identifying property.",
    syntax: "asset Vehicle identified by vin {\n  o String vin\n}",
  },
  participant: {
    title: "participant",
    summary:
      "An actor in the domain: a person, organization or system that can own assets and submit transactions. Like assets, participants are identified declarations.",
    syntax: "participant Customer identified by email {\n  o String email\n}",
  },
  transaction: {
    title: "transaction",
    summary:
      "An action that changes the state of the domain, usually the input of business logic. Model the data submitted to perform an operation as a transaction.",
    syntax: "transaction Transfer {\n  --> Vehicle vehicle\n  --> Customer newOwner\n}",
  },
  event: {
    title: "event",
    summary:
      "A notification that something happened at a point in time, typically emitted while processing a transaction. Events describe facts, not requests.",
    syntax: "event TransferCompleted {\n  o DateTime when\n}",
  },
  enum: {
    title: "enum",
    summary:
      "A fixed list of named values. A property typed with an enum holds exactly one of the listed values, so use it for closed sets like statuses or categories.",
    syntax: "enum OrderStatus {\n  o PLACED\n  o SHIPPED\n  o DELIVERED\n}",
  },
  scalar: {
    title: "scalar",
    summary:
      "A named alias for a primitive type that carries reusable constraints (regex, range, length, default). Define a scalar once and use it as a property type everywhere the same rules apply.",
    syntax: "scalar Email extends String regex=/.+@.+/",
  },
  map: {
    title: "map",
    summary:
      "A dictionary from a key type to a value type. Keys must be Strings, DateTimes or scalars of those; values can be primitives, scalars or declarations.",
    syntax: "map Balances {\n  o String\n  o Double\n}",
  },
};

const KEYWORD_HINTS: Record<string, ConceptHint> = {
  namespace: {
    title: "namespace",
    summary:
      "Every Concerto file starts with a namespace: the versioned, dot-separated name that owns all declarations in the file, e.g. org.acme@1.0.0. Fully qualified type names are namespace + declaration name.",
    syntax: "namespace org.acme@1.0.0",
  },
  import: {
    title: "import",
    summary:
      "Brings declarations from another namespace into scope so they can be used as property types without full qualification.",
    syntax: "import org.acme.common@1.0.0.{Address}",
  },
  from: {
    title: "from",
    summary:
      "Used in an import statement to load the imported namespace from an external URL instead of the local workspace.",
    syntax: 'import org.acme@1.0.0.{Thing} from https://models.example.org/acme.cto',
  },
  abstract: {
    title: "abstract",
    summary:
      "Marks a declaration that cannot be instantiated directly; it only serves as a supertype. Concrete declarations extend it and inherit its properties.",
    syntax: "abstract concept Vehicle {\n  o String vin\n}",
  },
  extends: {
    title: "extends",
    summary:
      "Declares inheritance: the declaration gains all properties of its supertype. A declaration can extend one supertype of the same kind (concept extends concept, and so on).",
    syntax: "concept Car extends Vehicle {\n  o Integer doors\n}",
  },
  identified: {
    title: "identified",
    summary:
      "Gives instances a unique identity. 'identified by <property>' names an existing String property as the identifier; plain 'identified' adds an implicit $identifier property.",
    syntax: "asset Order identified by orderId {\n  o String orderId\n}",
  },
  by: {
    title: "identified by",
    summary:
      "Part of 'identified by <property>': names the property whose value uniquely identifies each instance of the declaration.",
  },
  o: {
    title: "o (property)",
    summary:
      "Introduces a property (field) on a declaration: 'o <Type> <name>'. Add [] after the type for arrays and 'optional' at the end for properties that may be absent.",
    syntax: "o String firstName\no String[] nicknames optional",
  },
  optional: {
    title: "optional",
    summary:
      "Marks a property that may be absent from valid instances. Without it, every property is required.",
    syntax: "o String middleName optional",
  },
  default: {
    title: "default",
    summary:
      "Supplies the value used when an instance does not provide one, e.g. default=\"pending\" or default=0.",
    syntax: 'o String status default="pending"',
  },
  range: {
    title: "range",
    summary:
      "Numeric validator limiting Integer, Long or Double values to an inclusive interval. Leave a bound empty to keep that side open, e.g. range=[0,].",
    syntax: "o Integer age range=[0,120]",
  },
  regex: {
    title: "regex",
    summary:
      "String validator: every value must match the regular expression. Applies to String properties and scalars.",
    syntax: "o String postcode regex=/^\\d{6}$/",
  },
  length: {
    title: "length",
    summary:
      "String validator limiting the number of characters to an inclusive interval; either bound can be left open, e.g. length=[1,] for non-empty.",
    syntax: "o String title length=[1,100]",
  },
};

const PRIMITIVE_HINTS: Record<string, ConceptHint> = {
  String: {
    title: "String",
    summary:
      "A UTF-8 text value. Supports the default, regex and length validators.",
  },
  Integer: {
    title: "Integer",
    summary: "A 32-bit signed whole number. Supports the default and range validators.",
  },
  Long: {
    title: "Long",
    summary: "A 64-bit signed whole number for values beyond the Integer range. Supports default and range.",
  },
  Double: {
    title: "Double",
    summary: "A double-precision floating point number. Supports the default and range validators.",
  },
  Boolean: {
    title: "Boolean",
    summary: "A true/false value. Supports the default validator.",
  },
  DateTime: {
    title: "DateTime",
    summary: "An ISO-8601 timestamp with date, time and timezone offset.",
  },
};

// Elements without a hoverable word: the decorator marker and the
// relationship arrow. The editor looks these up by their symbol.
const SYMBOL_HINTS: Record<string, ConceptHint> = {
  "@": {
    title: "@decorator",
    summary:
      "Decorators attach metadata to a declaration or property without changing what it means. The name and arguments are free-form; tools read them for documentation, vocabulary terms, UI hints or code generation.",
    syntax: '@description("A registered customer")\nparticipant Customer identified by email {\n  o String email\n}',
  },
  "-->": {
    title: "--> (relationship)",
    summary:
      "A relationship property: points to an asset or participant by its identifier instead of embedding a copy. The referenced instance lives on its own; only identified declarations can be relationship targets.",
    syntax: "asset Order identified by orderId {\n  o String orderId\n  --> Customer buyer\n}",
  },
};

const ALL_HINTS: Record<string, ConceptHint> = {
  ...DECLARATION_HINTS,
  ...KEYWORD_HINTS,
  ...PRIMITIVE_HINTS,
  ...SYMBOL_HINTS,
};

/** Kinds shown on graph node headers, in the order the nodes render them. */
export const DECLARATION_KINDS = Object.keys(DECLARATION_HINTS);

/**
 * Returns the hint for a language element, matched case-sensitively so
 * user-defined names like "Event" never collide with the "event" keyword.
 */
export function getConceptHint(word: string): ConceptHint | undefined {
  return Object.prototype.hasOwnProperty.call(ALL_HINTS, word)
    ? ALL_HINTS[word]
    : undefined;
}
