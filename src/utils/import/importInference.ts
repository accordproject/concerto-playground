import { CodeGen } from "@accordproject/concerto-codegen";
import { Printer } from "@accordproject/concerto-cto";

const META_MODEL_NAMESPACE = "concerto.metamodel@1.0.0";

export const DEFAULT_IMPORT_NAMESPACE = "org.example.imported@1.0.0";
export const DEFAULT_ROOT_TYPE_NAME = "Root";

export type ImportInputKind = "json" | "json-schema";

export interface InferCtoFromJsonOptions {
  fallbackNamespace?: string;
  defaultNamespace?: string;
  rootTypeName?: string;
}

export interface InferCtoFromJsonResult {
  kind: ImportInputKind;
  cto: string;
  namespace: string;
}

type JsonRecord = Record<string, unknown>;

export function extractNamespace(cto: string): string {
  const stripped = cto
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
  const match = stripped.match(/^\s*namespace\s+(\S+)/m);
  return match ? match[1] : "org.example.unknown@1.0.0";
}

export function isLikelyJsonSchema(input: unknown): input is JsonRecord {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return false;
  }

  const record = input as JsonRecord;
  return (
    typeof record.$schema === "string" ||
    typeof record.$id === "string" ||
    typeof record.properties === "object" ||
    typeof record.definitions === "object" ||
    typeof record.$defs === "object"
  );
}

function inferNamespaceFromSchemaId(schemaId: unknown): string | null {
  if (typeof schemaId !== "string" || !schemaId.trim()) {
    return null;
  }

  try {
    const url = new URL(schemaId);
    let namespace = url.hostname.split(".").reverse().join(".");
    const pathParts = url.pathname.split("/");
    pathParts.pop();
    namespace += pathParts.length > 0 ? pathParts.join(".") : "";
    return namespace || null;
  } catch {
    return null;
  }
}

function getSchemaNamespace(
  schema: JsonRecord,
  options: InferCtoFromJsonOptions,
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

export async function inferCtoFromJsonText(
  source: string,
  options: InferCtoFromJsonOptions = {},
): Promise<InferCtoFromJsonResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON: ${getErrorMessage(error)}`);
  }

  if (isLikelyJsonSchema(parsed)) {
    try {
      const namespace = getSchemaNamespace(parsed, options);
      const Visitor = CodeGen.JSONSchemaToConcertoVisitor;
      const concertoJson = new Visitor().visit(Visitor.parse(parsed), {
        metaModelNamespace: META_MODEL_NAMESPACE,
        namespace,
      });
      const cto = Printer.toCTO(concertoJson.models[0]);
      return {
        kind: "json-schema",
        cto,
        namespace,
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
      cto: inferModel(namespace, rootTypeName, parsed),
      namespace,
    };
  } catch (error) {
    throw new Error(`Unable to infer Concerto model from JSON sample: ${getErrorMessage(error)}`);
  }
}
