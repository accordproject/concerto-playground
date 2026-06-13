import { TARGET_LANGUAGES, type TargetLanguage } from "../codegen/generator";

export type ViewMode = "graph" | "code" | "form";

export interface PlaygroundUrlOptions {
  headless: boolean;
  showCto: boolean;
  showToolbar: boolean;
  viewMode: ViewMode;
  activeTab: TargetLanguage;
}

export const DEFAULT_URL_OPTIONS: PlaygroundUrlOptions = {
  headless: false,
  showCto: true,
  showToolbar: true,
  viewMode: "graph",
  activeTab: "typescript",
};

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
  return TARGET_LANGUAGES.includes(value as TargetLanguage);
}

function isTrue(value: string | null): boolean {
  return value?.trim().toLowerCase() === "true";
}

function isFalse(value: string | null): boolean {
  return value?.trim().toLowerCase() === "false";
}

export function parsePlaygroundUrlOptions(search: string): PlaygroundUrlOptions {
  const params = new URLSearchParams(search);
  const options = { ...DEFAULT_URL_OPTIONS };

  options.headless = isTrue(params.get("headless"));
  options.showCto = !isFalse(params.get("cto"));
  options.showToolbar = !options.headless && !isFalse(params.get("toolbar"));

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
