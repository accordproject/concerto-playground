import { CodeGen } from "@accordproject/concerto-codegen";
import { MetaModel } from "@accordproject/concerto-core";
import { Parser, Printer } from "@accordproject/concerto-cto";

const META_MODEL_NAMESPACE = "concerto.metamodel@1.0.0";

export const DEFAULT_IMPORT_NAMESPACE = "org.example.imported@1.0.0";
export const DEFAULT_ROOT_TYPE_NAME = "Root";

export type ImportInputKind = "cto" | "concerto-json" | "json-schema" | "json";

export interface InferCtoFromImportOptions {
  fallbackNamespace?: string;
  defaultNamespace?: string;
  rootTypeName?: string;
}

export interface InferCtoFromImportResult {
  kind: ImportInputKind;
  ctoSources: string[];
}

type JsonRecord = Record<string, unknown>;
type ConcertoModel = JsonRecord & { $class: string; namespace: string };

function isJsonRecord(input: unknown): input is JsonRecord {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function namespaceMatch(cto: string): RegExpMatchArray | null {
  const stripped = cto
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
  return stripped.match(/^\s*namespace\s+(\S+)/m);
}

export function extractNamespace(cto: string): string {
  const match = namespaceMatch(cto);
  return match ? match[1] : "org.example.unknown@1.0.0";
}

export function isLikelyConcertoJson(input: unknown): input is JsonRecord {
  if (!isJsonRecord(input)) return false;
  const firstModel = Array.isArray(input.models) ? input.models[0] : undefined;
  const topClass = input.$class ?? (isJsonRecord(firstModel) ? firstModel.$class : undefined);
  return typeof topClass === "string" && topClass.startsWith("concerto.metamodel@");
}

export function isLikelyJsonSchema(input: unknown): input is JsonRecord {
  if (!isJsonRecord(input)) return false;
  return (
    typeof input.$schema === "string" ||
    typeof input.$id === "string" ||
    isJsonRecord(input.properties) ||
    isJsonRecord(input.definitions) ||
    isJsonRecord(input.$defs)
  );
}

function inferNamespaceFromSchemaId(schemaId: unknown): string | null {
  if (typeof schemaId !== "string" || !schemaId.trim()) {
    return null;
  }

  try {
    const url = new URL(schemaId);
    let namespace = url.hostname.split(".").reverse().join(".");
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (pathParts[pathParts.length - 1]?.includes(".")) pathParts.pop();
    if (pathParts.length > 0) namespace += `.${pathParts.join(".")}`;
    return namespace ? `${namespace}@1.0.0` : null;
  } catch {
    return null;
  }
}

function getSchemaNamespace(
  schema: JsonRecord,
  options: InferCtoFromImportOptions,
): string {
  return (
    inferNamespaceFromSchemaId(schema.$id) ??
    options.fallbackNamespace ??
    options.defaultNamespace ??
    DEFAULT_IMPORT_NAMESPACE
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function inferCtoFromImportText(
  source: string,
  options: InferCtoFromImportOptions = {},
): Promise<InferCtoFromImportResult> {
  if (!source.trim()) {
    throw new Error("Paste CTO, Concerto JSON, JSON Schema, or a JSON sample first.");
  }

  try {
    Parser.parse(source);
    return { kind: "cto", ctoSources: [source] };
  } catch {
    // Try the supported JSON formats next.
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON or CTO: ${getErrorMessage(error)}`);
  }

  if (isLikelyConcertoJson(parsed)) {
    try {
      const modelsAst = Array.isArray(parsed.models)
        ? parsed
        : { $class: `${META_MODEL_NAMESPACE}.Models`, models: [parsed] };
      MetaModel.validateMetaModel(modelsAst);
      return {
        kind: "concerto-json",
        ctoSources: (modelsAst.models as ConcertoModel[]).map((model) => Printer.toCTO(model)),
      };
    } catch (error) {
      throw new Error(`Unable to import Concerto JSON: ${getErrorMessage(error)}`);
    }
  }

  if (isLikelyJsonSchema(parsed)) {
    try {
      const namespace = getSchemaNamespace(parsed, options);
      const Visitor = CodeGen.JSONSchemaToConcertoVisitor;
      const concertoJson = new Visitor().visit(Visitor.parse(parsed), {
        metaModelNamespace: META_MODEL_NAMESPACE,
        namespace,
      });
      return {
        kind: "json-schema",
        ctoSources: [Printer.toCTO(concertoJson.models[0])],
      };
    } catch (error) {
      throw new Error(`Unable to infer Concerto model from JSON Schema: ${getErrorMessage(error)}`);
    }
  }

  if (!Array.isArray(parsed) && (typeof parsed !== "object" || parsed === null)) {
    throw new Error("Input must be a JSON object, array, or JSON Schema document.");
  }

  try {
    const namespace =
      options.fallbackNamespace ??
      options.defaultNamespace ??
      DEFAULT_IMPORT_NAMESPACE;
    const rootTypeName = options.rootTypeName ?? DEFAULT_ROOT_TYPE_NAME;
    const inferModelModule = await import(
      "@accordproject/concerto-codegen/lib/codegen/fromjson/cto/inferModel"
    );
    const inferModel = inferModelModule.default;
    return {
      kind: "json",
      ctoSources: [inferModel(namespace, rootTypeName, parsed)],
    };
  } catch (error) {
    throw new Error(`Unable to infer Concerto model from JSON sample: ${getErrorMessage(error)}`);
  }
}
