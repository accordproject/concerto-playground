import type { TargetLanguage } from "../codegen/generator";

export type ViewMode = "graph" | "code" | "form";

export interface PlaygroundUrlOptions {
  headless: boolean;
  viewMode: ViewMode;
  activeTab: TargetLanguage;
}

export const DEFAULT_URL_OPTIONS: PlaygroundUrlOptions = {
  headless: false,
  viewMode: "graph",
  activeTab: "typescript",
};

const TARGETS: readonly TargetLanguage[] = [
  "typescript",
  "jsonschema",
  "ast",
  "concertino",
  "java",
  "csharp",
  "go",
  "rust",
  "graphql",
  "protobuf",
  "avro",
  "openapi",
  "odata",
  "xmlschema",
];

const VIEW_ALIASES: Record<string, Pick<PlaygroundUrlOptions, "viewMode"> | Pick<PlaygroundUrlOptions, "viewMode" | "activeTab">> = {
  diagram: { viewMode: "graph" },
  graph: { viewMode: "graph" },
  form: { viewMode: "form" },
  code: { viewMode: "code" },
  "json-ast": { viewMode: "code", activeTab: "ast" },
  ast: { viewMode: "code", activeTab: "ast" },
  "json-schema": { viewMode: "code", activeTab: "jsonschema" },
  jsonschema: { viewMode: "code", activeTab: "jsonschema" },
};

function isTargetLanguage(value: string): value is TargetLanguage {
  return TARGETS.includes(value as TargetLanguage);
}

export function parsePlaygroundUrlOptions(search: string): PlaygroundUrlOptions {
  const params = new URLSearchParams(search);
  const options = { ...DEFAULT_URL_OPTIONS };

  options.headless = params.get("headless") === "true";

  const view = params.get("view")?.trim().toLowerCase();
  if (!view) return options;

  const alias = VIEW_ALIASES[view];
  if (alias) {
    return { ...options, ...alias };
  }

  if (isTargetLanguage(view)) {
    return { ...options, viewMode: "code", activeTab: view };
  }

  return options;
}
