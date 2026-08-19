import { MetaModel } from "@accordproject/concerto-core";
import { Parser, Printer } from "@accordproject/concerto-cto";
import { Identifiers } from "@accordproject/concerto-util";
import { IMPORT_ERROR_STRINGS } from "../../constants/ui";

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
  try {
    const parsed = Parser.parse(cto) as { namespace?: unknown };
    if (typeof parsed.namespace === "string") return parsed.namespace;
  } catch {
    // Live editor content may be temporarily incomplete.
  }
  const match = namespaceMatch(cto);
  return match ? match[1] : "org.example.unknown@1.0.0";
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
    const namespaceParts = url.hostname.split(".").reverse();
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (pathParts[pathParts.length - 1]?.includes(".")) pathParts.pop();
    namespaceParts.push(...pathParts);
    const namespace = namespaceParts
      .map((part) => Identifiers.normalizeIdentifier(part))
      .join(".");
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
    throw new Error(IMPORT_ERROR_STRINGS.emptyInput);
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
    throw new Error(IMPORT_ERROR_STRINGS.invalidInput(getErrorMessage(error)));
  }

  if (isJsonRecord(parsed)) {
    try {
      const modelsAst = Array.isArray(parsed.models)
        ? parsed
        : { $class: `${META_MODEL_NAMESPACE}.Models`, models: [parsed] };
      MetaModel.validateMetaModel(modelsAst);
      return {
        kind: "concerto-json",
        ctoSources: (modelsAst.models as ConcertoModel[]).map((model) => Printer.toCTO(model)),
      };
    } catch {
      // Try JSON Schema and plain JSON inference next.
    }
  }

  if (isLikelyJsonSchema(parsed)) {
    try {
      const namespace = getSchemaNamespace(parsed, options);
      const { CodeGen } = await import("@accordproject/concerto-codegen");
      const Visitor = CodeGen.JSONSchemaToConcertoVisitor;
      const concertoJson = new Visitor().visit(Visitor.parse(parsed), {
        metaModelNamespace: META_MODEL_NAMESPACE,
        namespace,
      });
      const cto = Printer.toCTO(concertoJson.models[0]);
      Parser.parse(cto);
      return {
        kind: "json-schema",
        ctoSources: [cto],
      };
    } catch (error) {
      throw new Error(IMPORT_ERROR_STRINGS.jsonSchemaInferenceFailed(getErrorMessage(error)));
    }
  }

  if (!Array.isArray(parsed) && (typeof parsed !== "object" || parsed === null)) {
    throw new Error(IMPORT_ERROR_STRINGS.unsupportedJson);
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
    const cto = inferModel(namespace, rootTypeName, parsed);
    Parser.parse(cto);
    return {
      kind: "json",
      ctoSources: [cto],
    };
  } catch (error) {
    throw new Error(IMPORT_ERROR_STRINGS.jsonInferenceFailed(getErrorMessage(error)));
  }
}
