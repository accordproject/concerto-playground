import { useState } from "react";
import { Editor } from "./Editor";
import { OUTPUT_STRINGS } from "../constants/ui";
import {
  TARGET_LANGUAGES,
  type TargetLanguage,
  type GenerationResult,
} from "../codegen/generator";

const TAB_METADATA = {
  typescript: { label: "TypeScript", lang: "typescript" },
  jsonschema: { label: "JSON Schema", lang: "json" },
  ast: { label: "JSON AST", lang: "json" },
  concertino: { label: "Concertino", lang: "json" },
  java: { label: "Java", lang: "java" },
  csharp: { label: "C#", lang: "csharp" },
  go: { label: "Go", lang: "go" },
  rust: { label: "Rust", lang: "rust" },
  graphql: { label: "GraphQL", lang: "graphql" },
  protobuf: { label: "Protobuf", lang: "proto" },
  avro: { label: "Avro", lang: "json" },
  openapi: { label: "OpenAPI", lang: "yaml" },
  odata: { label: "OData", lang: "xml" },
  xmlschema: { label: "XML Schema", lang: "xml" },
} satisfies Record<TargetLanguage, { label: string; lang: string }>;

export const OUTPUT_TABS = TARGET_LANGUAGES.map((id) => ({
  id,
  ...TAB_METADATA[id],
}));

// The Concerto-native formats stay as visible tabs; the long tail of language
// targets lives behind a "More" dropdown so the strip never scrolls sideways.
const FORMAT_INFO: Partial<Record<TargetLanguage, { description: string; docsUrl: string }>> = {
  ast: {
    description:
      "The resolved Concerto metamodel — a JSON representation of every declaration and property, with type references fully qualified. Consumed by tooling that processes models programmatically.",
    docsUrl:
      "https://concerto.accordproject.org/docs/reference/api/api-js-models-as-json",
  },
  concertino: {
    description:
      "An object-centric serialization of a Concerto model: declarations are keyed by their fully-qualified name and properties are inlined, making the structure easy to traverse without walking the metamodel tree.",
    docsUrl:
      "https://concerto.accordproject.org/docs/reference/migration/ref-migrate-concerto-3.0-4.0/#accordprojectconcertino",
  },
};

const PRIMARY_IDS: TargetLanguage[] = [
  "typescript",
  "jsonschema",
  "ast",
  "concertino",
];
const PRIMARY_TABS = OUTPUT_TABS.filter((t) => PRIMARY_IDS.includes(t.id));
const OVERFLOW_TABS = OUTPUT_TABS.filter((t) => !PRIMARY_IDS.includes(t.id));

interface OutputTabsProps {
  results: Partial<Record<TargetLanguage, GenerationResult>>;
  activeTab: TargetLanguage;
  onTabChange: (tab: TargetLanguage) => void;
}

export function OutputTabs({ results, activeTab, onTabChange }: OutputTabsProps) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const current = results[activeTab];
  const currentTabDef = OUTPUT_TABS.find((t) => t.id === activeTab)!;
  const activeOverflow = OVERFLOW_TABS.find((t) => t.id === activeTab);

  async function handleCopy() {
    if (!current?.output) return;
    await navigator.clipboard.writeText(current.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center border-b border-gray-700 bg-[#1e1e1e] shrink-0">
        {PRIMARY_TABS.map((tab) => {
          const res = results[tab.id];
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={[
                "px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative",
                isActive
                  ? "text-[#19C6C8] border-b-2 border-[#19C6C8] bg-[#252526]"
                  : "text-gray-400 hover:text-gray-200 border-b-2 border-transparent",
              ].join(" ")}
            >
              {tab.label}
              {res && !res.isLive && (
                <span className="ml-1 text-[10px] text-yellow-500">*</span>
              )}
            </button>
          );
        })}

        {/* Overflow ("More") dropdown for the remaining language targets */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={[
              "px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative",
              activeOverflow
                ? "text-[#19C6C8] border-b-2 border-[#19C6C8] bg-[#252526]"
                : "text-gray-400 hover:text-gray-200 border-b-2 border-transparent",
            ].join(" ")}
          >
            {activeOverflow ? activeOverflow.label : OUTPUT_STRINGS.more}
            {activeOverflow &&
              results[activeOverflow.id] &&
              !results[activeOverflow.id]!.isLive && (
                <span className="ml-1 text-[10px] text-yellow-500">*</span>
              )}
            <span className="ml-1 text-[10px] align-middle" aria-hidden="true">
              ▾
            </span>
          </button>
          {menuOpen && (
            <>
              <button
                className="fixed inset-0 z-10 cursor-default"
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => setMenuOpen(false)}
              />
              <div
                role="menu"
                className="absolute left-0 top-full z-20 mt-px min-w-[10rem] py-1 bg-[#252526] border border-gray-700 rounded-b shadow-lg"
              >
                {OVERFLOW_TABS.map((tab) => {
                  const res = results[tab.id];
                  const isActive = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      role="menuitem"
                      onClick={() => {
                        onTabChange(tab.id);
                        setMenuOpen(false);
                      }}
                      className={[
                        "w-full text-left px-4 py-1.5 text-sm whitespace-nowrap transition-colors",
                        isActive
                          ? "text-[#19C6C8] bg-white bg-opacity-5"
                          : "text-gray-300 hover:text-gray-100 hover:bg-white hover:bg-opacity-5",
                      ].join(" ")}
                    >
                      {tab.label}
                      {res && !res.isLive && (
                        <span className="ml-1 text-[10px] text-yellow-500">*</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="ml-auto px-3 flex items-center gap-2">
          {current && !current.isLive && (
            <span className="text-xs text-yellow-500" title={current.error}>
              {OUTPUT_STRINGS.staticPreview}
            </span>
          )}
          <button
            onClick={handleCopy}
            disabled={!current?.output}
            className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-40 transition-colors"
          >
            {copied ? OUTPUT_STRINGS.copied : OUTPUT_STRINGS.copy}
          </button>
        </div>
      </div>

      {/* Format info banner — shown only for formats that have explanatory text */}
      {FORMAT_INFO[activeTab] && (
        <div className="flex items-baseline gap-2 px-4 py-2 bg-[#1a1a2e] border-b border-gray-700 text-xs text-gray-400 shrink-0">
          <span>{FORMAT_INFO[activeTab]!.description}</span>
          <a
            href={FORMAT_INFO[activeTab]!.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap text-[#19C6C8] hover:underline shrink-0"
          >
            {OUTPUT_STRINGS.docsLink}
          </a>
        </div>
      )}

      {/* Output editor */}
      <div className="flex-1 min-h-0">
        {current?.output ? (
          <Editor
            value={current.output}
            readOnly
            language={currentTabDef.lang}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            {current?.error ? (
              <div className="max-w-md text-center">
                <p className="text-red-400 font-medium mb-2">{OUTPUT_STRINGS.parseError}</p>
                <pre className="text-xs text-gray-400 whitespace-pre-wrap">{current.error}</pre>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-[#19C6C8] border-t-transparent rounded-full" />
                {OUTPUT_STRINGS.generating}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
