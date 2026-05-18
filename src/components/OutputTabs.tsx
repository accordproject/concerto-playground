import { useState } from "react";
import { Editor } from "./Editor";
import type { TargetLanguage, GenerationResult } from "../codegen/generator";

const TABS: { id: TargetLanguage; label: string; lang: string }[] = [
  { id: "typescript", label: "TypeScript", lang: "typescript" },
  { id: "jsonschema", label: "JSON Schema", lang: "json" },
  { id: "python", label: "Python", lang: "python" },
  { id: "java", label: "Java", lang: "java" },
  { id: "go", label: "Go", lang: "go" },
  { id: "openapi", label: "OpenAPI", lang: "yaml" },
];

interface OutputTabsProps {
  results: Partial<Record<TargetLanguage, GenerationResult>>;
  activeTab: TargetLanguage;
  onTabChange: (tab: TargetLanguage) => void;
}

export function OutputTabs({ results, activeTab, onTabChange }: OutputTabsProps) {
  const [copied, setCopied] = useState(false);

  const current = results[activeTab];
  const currentTabDef = TABS.find((t) => t.id === activeTab)!;

  async function handleCopy() {
    if (!current?.output) return;
    await navigator.clipboard.writeText(current.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center border-b border-gray-700 bg-[#1e1e1e] shrink-0 overflow-x-auto">
        {TABS.map((tab) => {
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
        <div className="ml-auto px-3 flex items-center gap-2">
          {current && !current.isLive && (
            <span className="text-xs text-yellow-500" title={current.error}>
              static preview
            </span>
          )}
          <button
            onClick={handleCopy}
            disabled={!current?.output}
            className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-40 transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

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
                <p className="text-red-400 font-medium mb-2">Parse error</p>
                <pre className="text-xs text-gray-400 whitespace-pre-wrap">{current.error}</pre>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-[#19C6C8] border-t-transparent rounded-full" />
                Generating…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
