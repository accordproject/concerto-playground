import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LZString from "lz-string";
import JSZip from "jszip";
import { Header } from "./components/Header";
import { Editor } from "./components/Editor";
import { OutputTabs } from "./components/OutputTabs";
import { ConcertoGraphEditor } from "./components/graph/ConcertoGraphEditor";
import { FormView } from "./components/form/FormView";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { validateCto, parseCto } from "./utils/graph/ctoToGraph";
import { parsePlaygroundUrlOptions } from "./utils/urlOptions";
import { NDA_EXAMPLE, SERVICE_EXAMPLE, VEHICLES_EXAMPLE } from "./examples/nda.cto";
import {
  generate,
  TARGET_LANGUAGES,
  type GenerationResult,
  type TargetLanguage,
} from "./codegen/generator";

const EXAMPLES = [
  { label: "NDA", source: NDA_EXAMPLE },
  { label: "Vehicles", source: VEHICLES_EXAMPLE },
  { label: "Service Agreement", source: SERVICE_EXAMPLE },
];

// Strip comments before matching the namespace declaration to avoid false matches
// inside block or line comments (e.g. `/* namespace org.foo */`).
function extractNamespace(cto: string): string {
  const stripped = cto
    .replace(/\/\*[\s\S]*?\*\//g, '') // remove block comments
    .replace(/\/\/.*/g, '');           // remove line comments
  const m = stripped.match(/^\s*namespace\s+(\S+)/m);
  return m ? m[1] : `org.example.unknown@1.0.0`;
}

// Pristine source by namespace for the built-in example buttons. Used to tell
// untouched examples (swappable) apart from edited ones (kept open).
const EXAMPLE_SOURCES = new Map(EXAMPLES.map((ex) => [extractNamespace(ex.source), ex.source]));

// Evaluated once at module load — avoids parsing the URL hash twice for the
// two separate useState initialisers that need models and activeNamespace.
const _initialModels = (() => {
  const hash = window.location.hash.slice(1);
  if (hash) {
    const decoded = LZString.decompressFromEncodedURIComponent(hash);
    if (decoded) {
      // New format: JSON array of CTO strings (multi-namespace share)
      try {
        const sources: unknown = JSON.parse(decoded);
        if (Array.isArray(sources) && sources.length > 0 && sources.every((s) => typeof s === 'string')) {
          const result: Record<string, string> = {};
          for (const src of sources as string[]) result[extractNamespace(src)] = src;
          return result;
        }
      } catch { /* not JSON — fall through to legacy single-model format */ }
      // Legacy format: plain CTO string
      const ns = extractNamespace(decoded);
      return { [ns]: decoded };
    }
  }
  return { [extractNamespace(NDA_EXAMPLE)]: NDA_EXAMPLE };
})();

const _initialUrlOptions = parsePlaygroundUrlOptions(window.location.search);

export default function App() {
  const [models, setModels] = useState<Record<string, string>>(_initialModels);
  const [activeNamespace, setActiveNamespace] = useState<string>(() => Object.keys(_initialModels)[0]);
  const [viewMode, setViewMode] = useState<"graph" | "code" | "form">(_initialUrlOptions.viewMode);
  const [showCto, setShowCto] = useState(_initialUrlOptions.showCto);
  const [activeTab, setActiveTab] = useState<TargetLanguage>(_initialUrlOptions.activeTab);
  const [results, setResults] = useState<Partial<Record<TargetLanguage, GenerationResult>>>({});
  const [shareLabel, setShareLabel] = useState<"Share URL" | "Copied!" | "Copy URL bar">("Share URL");
  const [importError, setImportError] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ name: string; ts: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The "active" source for single-model views (graph editor, CTO editor)
  const source = models[activeNamespace] ?? "";

  // Single parse of the active model per keystroke; everything below that
  // needs the AST derives from this memo instead of re-parsing.
  const parsedModel = useMemo(() => {
    try {
      return parseCto(source);
    } catch {
      return null;
    }
  }, [source]);

  // Declared type names in the active model — used to render clickable
  // references in the CTO editor.
  const declaredTypes = useMemo(
    () => parsedModel?.declarations.map((d) => d.name) ?? [],
    [parsedModel],
  );

  // Jump to a declaration's node in the graph (from a CTO reference click).
  const handleFocusNode = useCallback((name: string) => {
    setViewMode("graph");
    setFocusRequest({ name, ts: Date.now() });
  }, []);

  const validationError = useMemo(() => {
    const peers = Object.values(models).filter((s) => s && s !== source);
    // validateCto reports problems as a return value; if it throws anyway,
    // surface the message instead of silently pretending the model is valid.
    try {
      return validateCto(source, peers);
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }, [source, models]);

  const runGeneration = useCallback(async (sources: string[]) => {
    const ordered = [activeTab, ...TARGET_LANGUAGES.filter((t) => t !== activeTab)];
    for (const target of ordered) {
      const result = await generate(sources, target);
      setResults((prev) => ({ ...prev, [target]: result }));
    }
  }, [activeTab]);

  useEffect(() => {
    setResults({});
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const allSources = Object.values(models).filter(Boolean);
    debounceRef.current = setTimeout(() => {
      runGeneration(allSources);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [models, runGeneration]);

  // Update a specific namespace's CTO. Empty string = delete.
  function handleModelChange(ns: string, newCto: string) {
    setModels((prev) => {
      const next = { ...prev };
      if (!newCto) {
        delete next[ns];
        // If active ns was deleted, switch to first remaining
        if (ns === activeNamespace) {
          const remaining = Object.keys(next);
          if (remaining.length > 0) setActiveNamespace(remaining[0]);
        }
      } else {
        // Detect if namespace changed (key migration)
        const parsedNs = extractNamespace(newCto);
        if (parsedNs !== ns && next[ns] !== undefined) {
          delete next[ns];
          next[parsedNs] = newCto;
          if (ns === activeNamespace) setActiveNamespace(parsedNs);
        } else {
          next[ns] = newCto;
        }
      }
      return next;
    });
  }

  // Called by the graph editor / CTO text editor for the active model
  function setSource(newCto: string) {
    handleModelChange(activeNamespace, newCto);
  }

  function handleAddNamespace() {
    const ns = `org.example.new${Date.now()}@1.0.0`;
    const stub = `namespace ${ns}\n\nconcept Example {\n  o String name\n}\n`;
    setModels((prev) => ({ ...prev, [ns]: stub }));
    setActiveNamespace(ns);
  }

  function handleRemoveNamespace(ns: string) {
    setModels((prev) => {
      const next = { ...prev };
      delete next[ns];
      const remaining = Object.keys(next);
      if (ns === activeNamespace && remaining.length > 0) {
        setActiveNamespace(remaining[0]);
      }
      return next;
    });
  }

  async function handleShare() {
    // Encode all open models so multi-namespace sessions survive the round-trip.
    // Single-model sessions use the plain CTO string for backward compatibility
    // with links shared before this change.
    const sources = Object.values(models).filter(Boolean);
    const payload = sources.length === 1 ? sources[0] : JSON.stringify(sources);
    window.location.hash = LZString.compressToEncodedURIComponent(payload);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareLabel("Copied!");
    } catch {
      // Clipboard write denied (e.g. Firefox without focus) — hash is updated
      // so the user can copy the URL bar manually.
      setShareLabel("Copy URL bar");
    } finally {
      setTimeout(() => setShareLabel("Share URL"), 2000);
    }
  }

  // Loading an example never destroys work: user namespaces and edited
  // examples stay open as tabs, so they remain visible and included in
  // share/export/codegen. Only untouched examples are swapped out. Closing
  // an example's tab and clicking its button again reloads the pristine one.
  function handleLoadExample(src: string) {
    const targetNs = extractNamespace(src);
    setModels((prev) => {
      const next: Record<string, string> = {};
      for (const [ns, cto] of Object.entries(prev)) {
        if (EXAMPLE_SOURCES.get(ns) !== cto) next[ns] = cto;
      }
      next[targetNs] = prev[targetNs] ?? src;
      return next;
    });
    setActiveNamespace(targetNs);
    window.location.hash = "";
  }

  // Convert a Concerto metamodel AST (single Model or a { models: [...] }
  // container) into one or more CTO source strings via the metamodel printer.
  async function astToCtoSources(json: string): Promise<string[]> {
    const { Printer } = await import("@accordproject/concerto-cto");
    const { MetaModel } = await import("@accordproject/concerto-core");

    const ast = JSON.parse(json); // SyntaxError for non-JSON

    // Quick pre-check: the top-level object (or the first item in models[])
    // must carry a concerto.metamodel $class. This catches common cases like
    // JSON Schema or OpenAPI files being uploaded accidentally and gives a
    // clearer message than the metamodel validator's property-level errors.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topClass: unknown = (ast as any)?.["$class"] ?? (ast as any)?.models?.[0]?.["$class"];
    if (typeof topClass !== "string" || !topClass.startsWith("concerto.metamodel@")) {
      throw new Error(
        "Not a Concerto metamodel file. Only JSON AST files (exported from the JSON AST tab) can be imported as .json.",
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

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".cto,.json";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      const readAsText = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        });

      // Read and convert every file in the order the user selected them, so the
      // resulting namespace order — and the active tab — is deterministic.
      setImportError(null);
      const ctoSources: string[] = [];
      const errors: string[] = [];
      for (const file of Array.from(files)) {
        try {
          const text = await readAsText(file);
          const isJson =
            file.name.toLowerCase().endsWith(".json") ||
            /^\s*[{[]/.test(text);
          if (isJson) {
            ctoSources.push(...(await astToCtoSources(text)));
          } else {
            ctoSources.push(text);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${file.name}: ${msg}`);
        }
      }
      if (errors.length > 0) setImportError(errors.join("\n"));

      if (ctoSources.length === 0) return;
      const additions: Record<string, string> = {};
      for (const cto of ctoSources) additions[extractNamespace(cto)] = cto;
      setModels((prev) => ({ ...prev, ...additions }));
      setActiveNamespace(extractNamespace(ctoSources[0]));
    };
    input.click();
  }

  async function handleExport() {
    const entries = Object.entries(models).filter(([, cto]) => !!cto);
    if (entries.length === 1) {
      // Single file — download as .cto
      const [, cto] = entries[0];
      const blob = new Blob([cto], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "model.cto";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Multiple files — zip them
      const zip = new JSZip();
      for (const [ns, cto] of entries) {
        zip.file(`${ns}.cto`, cto);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "concerto-models.zip";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  const nsList = Object.keys(models);

  return (
    <div className={`flex flex-col h-screen bg-[#1a202c] text-white overflow-hidden ${_initialUrlOptions.headless ? "" : "pt-16"}`}>
      {!_initialUrlOptions.headless && <Header />}

      {/* Import error banner */}
      {importError && (
        <div className="flex items-start gap-2 px-4 py-2 bg-red-900 bg-opacity-60 border-b border-red-700 text-xs text-red-200 shrink-0">
          <span className="flex-1 whitespace-pre-wrap">{importError}</span>
          <button
            onClick={() => setImportError(null)}
            className="shrink-0 text-red-300 hover:text-white leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Toolbar */}
      {_initialUrlOptions.showToolbar && (
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
            {/* Graph / Form / Code mode toggle */}
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
                onClick={() => setViewMode("form")}
                className="text-xs px-3 py-1 font-semibold transition-colors"
                style={{
                  background: viewMode === "form" ? "#3182ce" : "#2d3748",
                  color: "#e2e8f0",
                  border: "none",
                  borderLeft: "1px solid #4a5568",
                  cursor: "pointer",
                }}
              >
                Form
              </button>
              <button
                onClick={() => setViewMode("code")}
                className="text-xs px-3 py-1 font-semibold transition-colors"
                style={{
                  background: viewMode === "code" ? "#3182ce" : "#2d3748",
                  color: "#e2e8f0",
                  border: "none",
                  borderLeft: "1px solid #4a5568",
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
              {shareLabel}
            </button>
          </div>
        </div>
      )}

      {/* Split pane */}
      <div className="flex flex-1 min-h-0">
        {/* Left: CTO editor (collapsible) — hidden in form view */}
        {showCto && viewMode !== "form" && (
          <div
            className="flex flex-col"
            style={{ width: "35%", borderRight: "1px solid #2d3748", flexShrink: 0 }}
          >
            {/* Namespace tab strip */}
            {nsList.length > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#171d2b",
                  borderBottom: "1px solid #2d3748",
                  overflowX: "auto",
                  flexShrink: 0,
                }}
              >
                {nsList.map((ns) => (
                  <div
                    key={ns}
                    onClick={() => setActiveNamespace(ns)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      cursor: "pointer",
                      fontSize: 11,
                      color: ns === activeNamespace ? "#e2e8f0" : "#718096",
                      background: ns === activeNamespace ? "#3182ce20" : "transparent",
                      borderBottom: ns === activeNamespace ? "2px solid #3182ce" : "2px solid transparent",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                    title={ns}
                  >
                    <span>{ns.length > 24 ? ns.slice(0, 24) + "…" : ns}</span>
                    {nsList.length > 1 && (
                      <span
                        onClick={(e) => { e.stopPropagation(); handleRemoveNamespace(ns); }}
                        style={{
                          color: "#718096",
                          fontSize: 13,
                          lineHeight: 1,
                          padding: "0 2px",
                          borderRadius: 2,
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLSpanElement).style.color = "#fc8181"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLSpanElement).style.color = "#718096"; }}
                        title="Remove"
                      >
                        ×
                      </span>
                    )}
                  </div>
                ))}
                <button
                  onClick={handleAddNamespace}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#718096",
                    cursor: "pointer",
                    fontSize: 16,
                    padding: "0 8px",
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                  title="Add namespace"
                >
                  +
                </button>
              </div>
            )}

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
                {nsList.length === 1 && (
                  <button
                    onClick={handleAddNamespace}
                    style={{
                      background: "transparent",
                      border: "1px solid #4a5568",
                      color: "#718096",
                      cursor: "pointer",
                      fontSize: 11,
                      borderRadius: 4,
                      padding: "1px 6px",
                    }}
                    title="Add namespace"
                  >
                    + ns
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ErrorBoundary label="Text Editor" resetKeys={[source]}>
                <Editor value={source} onChange={setSource} language="concerto" error={validationError} linkTargets={declaredTypes} onNavigate={handleFocusNode} />
              </ErrorBoundary>
            </div>
          </div>
        )}

        {/* Right: Graph, Form, or Code output */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {viewMode === "form" ? (
            <ErrorBoundary label="Form View" resetKeys={[models]}>
              <FormView
                models={models}
                onModelChange={handleModelChange}
                onAddNamespace={handleAddNamespace}
                onRemoveNamespace={handleRemoveNamespace}
              />
            </ErrorBoundary>
          ) : viewMode === "graph" ? (
            <ErrorBoundary label="Graph Canvas" resetKeys={[source]}>
              <ConcertoGraphEditor
                cto={source}
                onModelChange={setSource}
                showText={showCto}
                onToggleText={() => setShowCto((v) => !v)}
                onImport={handleImport}
                onExport={handleExport}
                focusRequest={focusRequest}
                validationError={validationError}
              />
            </ErrorBoundary>
          ) : (
            <ErrorBoundary label="Code Output" resetKeys={[results, activeTab]}>
              <OutputTabs
                results={results}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </ErrorBoundary>
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
