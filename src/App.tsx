import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LZString from "lz-string";
import { Header } from "./components/Header";
import { Editor } from "./components/Editor";
import { OutputTabs } from "./components/OutputTabs";
import { ConcertoGraphEditor } from "./components/graph/ConcertoGraphEditor";
import { validateCto } from "./utils/graph/ctoToGraph";
import { NDA_EXAMPLE, LOAN_EXAMPLE, SERVICE_EXAMPLE } from "./examples/nda.cto";
import {
  generate,
  type GenerationResult,
  type TargetLanguage,
} from "./codegen/generator";

const ALL_TARGETS: TargetLanguage[] = [
  "typescript",
  "jsonschema",
  "python",
  "java",
  "go",
  "openapi",
];

const EXAMPLES = [
  { label: "NDA", source: NDA_EXAMPLE },
  { label: "Loan", source: LOAN_EXAMPLE },
  { label: "Service Agreement", source: SERVICE_EXAMPLE },
];

function loadInitialSource(): string {
  const hash = window.location.hash.slice(1);
  if (hash) {
    const decoded = LZString.decompressFromEncodedURIComponent(hash);
    if (decoded) return decoded;
  }
  return NDA_EXAMPLE;
}

export default function App() {
  const [source, setSource] = useState(loadInitialSource);
  const [viewMode, setViewMode] = useState<"graph" | "code">("graph");
  const [showCto, setShowCto] = useState(true);
  const [activeTab, setActiveTab] = useState<TargetLanguage>("typescript");
  const [results, setResults] = useState<Partial<Record<TargetLanguage, GenerationResult>>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validationError = useMemo(() => validateCto(source), [source]);

  const runGeneration = useCallback(async (src: string) => {
    const ordered = [activeTab, ...ALL_TARGETS.filter((t) => t !== activeTab)];
    for (const target of ordered) {
      const result = await generate(src, target);
      setResults((prev) => ({ ...prev, [target]: result }));
    }
  }, [activeTab]);

  useEffect(() => {
    setResults({});
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runGeneration(source);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [source, runGeneration]);

  function handleShare() {
    const compressed = LZString.compressToEncodedURIComponent(source);
    window.location.hash = compressed;
    navigator.clipboard.writeText(window.location.href);
  }

  function handleLoadExample(src: string) {
    setSource(src);
    window.location.hash = "";
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".cto";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setSource(reader.result as string);
      reader.readAsText(file);
    };
    input.click();
  }

  function handleExport() {
    const blob = new Blob([source], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "model.cto";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-screen bg-[#1a202c] text-white overflow-hidden">
      <Header />

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#171d2b] border-b border-[#2d3748] shrink-0 flex-wrap">
        {/* CTO panel toggle */}
        <button
          onClick={() => setShowCto((v) => !v)}
          className="text-xs px-2.5 py-1 rounded font-semibold transition-colors"
          style={{
            background: showCto ? "#3182ce" : "#4a5568",
            color: "#e2e8f0",
            border: "none",
            cursor: "pointer",
          }}
          title={showCto ? "Hide CTO panel" : "Show CTO panel"}
        >
          {showCto ? "◀ CTO" : "▶ CTO"}
        </button>

        <div style={{ width: 1, height: 20, background: "#4a5568", flexShrink: 0 }} />

        <span className="text-xs text-gray-500 font-medium">Examples:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            onClick={() => handleLoadExample(ex.source)}
            className="text-xs px-2.5 py-1 rounded font-semibold transition-colors"
            style={{ background: "#4a5568", color: "#e2e8f0", border: "none", cursor: "pointer" }}
          >
            {ex.label}
          </button>
        ))}

        {/* Right-side controls */}
        <div className="ml-auto flex items-center gap-2">
          {/* Graph / Code mode toggle */}
          <div className="flex rounded overflow-hidden" style={{ border: "1px solid #4a5568" }}>
            <button
              onClick={() => setViewMode("graph")}
              className="text-xs px-3 py-1 font-semibold transition-colors"
              style={{
                background: viewMode === "graph" ? "#3182ce" : "#2d3748",
                color: "#e2e8f0",
                border: "none",
                cursor: "pointer",
              }}
            >
              Graph
            </button>
            <button
              onClick={() => setViewMode("code")}
              className="text-xs px-3 py-1 font-semibold transition-colors"
              style={{
                background: viewMode === "code" ? "#3182ce" : "#2d3748",
                color: "#e2e8f0",
                border: "none",
                cursor: "pointer",
              }}
            >
              Code
            </button>
          </div>

          <button
            onClick={handleShare}
            className="text-xs px-3 py-1 rounded border transition-colors"
            style={{
              background: "transparent",
              borderColor: "#4a5568",
              color: "#a0aec0",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#19C6C8";
              (e.currentTarget as HTMLButtonElement).style.color = "#19C6C8";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#4a5568";
              (e.currentTarget as HTMLButtonElement).style.color = "#a0aec0";
            }}
          >
            Share URL
          </button>
        </div>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 min-h-0">
        {/* Left: CTO editor (collapsible) */}
        {showCto && (
          <div
            className="flex flex-col"
            style={{ width: "35%", borderRight: "1px solid #2d3748", flexShrink: 0 }}
          >
            <div
              className="flex items-center justify-between px-4 py-2 shrink-0"
              style={{ background: "#171d2b", borderBottom: "1px solid #2d3748" }}
            >
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#718096" }}>
                Concerto Schema
              </span>
              <div className="flex items-center gap-2">
                {validationError && (
                  <span className="text-xs" style={{ color: "#fc8181" }} title={validationError}>
                    ⚠ Error
                  </span>
                )}
                <span className="text-xs" style={{ color: "#4a5568" }}>.cto</span>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <Editor value={source} onChange={setSource} language="concerto" error={validationError} />
            </div>
          </div>
        )}

        {/* Right: Graph or Code output */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {viewMode === "graph" ? (
            <ConcertoGraphEditor
              cto={source}
              onModelChange={setSource}
              showText={showCto}
              onToggleText={() => setShowCto((v) => !v)}
              onImport={handleImport}
              onExport={handleExport}
            />
          ) : (
            <OutputTabs
              results={results}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1 text-white text-xs shrink-0" style={{ background: "#007acc" }}>
        <span>Accord Project — Concerto Playground</span>
        <div className="flex items-center gap-4">
          <a
            href="https://concerto.accordproject.org/docs/intro"
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-80 hover:opacity-100"
          >
            Docs
          </a>
          <a
            href="https://github.com/accordproject/concerto"
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-80 hover:opacity-100"
          >
            GitHub
          </a>
          <span className="opacity-60">Apache-2.0 · Linux Foundation</span>
        </div>
      </div>
    </div>
  );
}
