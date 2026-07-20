// Conversion of Concerto metamodel JSON (a single Model or a { models: [...] }
// container) into CTO source strings. Used by both the file-upload import and
// the paste-import dialog.
//
// Format detection is intentionally centralised here so that JSON Schema and
// plain JSON inference (#12) can be added as further branches without touching
// the callers: detect metamodel first, then fall through to other formats.

/** True when the text plausibly holds a JSON document rather than CTO source. */
export function looksLikeJson(text: string): boolean {
  return /^\s*[{[]/.test(text);
}

// Convert a Concerto metamodel AST into one or more CTO source strings via the
// metamodel printer.
export async function astToCtoSources(json: string): Promise<string[]> {
  const { Printer } = await import("@accordproject/concerto-cto");
  const { MetaModel } = await import("@accordproject/concerto-core");

  const ast = JSON.parse(json); // SyntaxError for non-JSON

  // Quick pre-check: the top-level object (or the first item in models[])
  // must carry a concerto.metamodel $class. This catches common cases like
  // JSON Schema or OpenAPI files being pasted or uploaded accidentally and
  // gives a clearer message than the metamodel validator's property-level
  // errors.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topClass: unknown = (ast as any)?.["$class"] ?? (ast as any)?.models?.[0]?.["$class"];
  if (typeof topClass !== "string" || !topClass.startsWith("concerto.metamodel@")) {
    throw new Error(
      "Not a Concerto metamodel. Expected a JSON AST with a concerto.metamodel@… $class, like the one shown in the JSON AST tab.",
    );
  }

  // Normalise to a Models container so validateMetaModel can check the
  // full structure. A single Model object is wrapped; a container is used
  // as-is.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelsAst: any = Array.isArray(ast?.models)
    ? ast
    : { $class: "concerto.metamodel@1.0.0.Models", models: [ast] };

  // Full metamodel validation via Concerto's own validator.
  // Requires proper $class identifiers and rejects unexpected properties.
  MetaModel.validateMetaModel(modelsAst);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return modelsAst.models.map((m: any) => Printer.toCTO(m));
}
