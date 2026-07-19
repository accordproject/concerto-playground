import MonacoEditor, { useMonaco, type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor";
import { locateCulprit, parseErrorPosition } from "../utils/errorHints";

interface EditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  language?: string;
  height?: string;
  /** Validation error string — shown as a red squiggle at the reported line/column */
  error?: string | null;
  /** Declared type names to render as clickable references. */
  linkTargets?: string[];
  /** Called with the type name when a clickable reference is clicked. */
  onNavigate?: (name: string) => void;
}

// Inject the underline style for clickable type references once.
const LINK_CLASS = "concerto-type-link";
// Delay before re-scanning the model for clickable references, so the
// full-document scan does not run on every keystroke.
const LINK_DECORATION_DEBOUNCE_MS = 200;
function ensureLinkStyle() {
  if (typeof document === "undefined" || document.getElementById("concerto-type-link-style")) return;
  const el = document.createElement("style");
  el.id = "concerto-type-link-style";
  el.textContent = `.${LINK_CLASS} { text-decoration: underline dotted #38b2ac; text-underline-offset: 3px; cursor: pointer; }`;
  document.head.appendChild(el);
}

// ── Language registration ────────────────────────────────────────────────────

const setupMonaco: BeforeMount = (monacoInstance) => {
  // Guard: only register once
  if (monacoInstance.languages.getLanguages().some((l: { id: string }) => l.id === "concerto")) {
    return;
  }

  monacoInstance.languages.register({
    id: "concerto",
    extensions: [".cto"],
    aliases: ["Concerto", "concerto"],
    mimetypes: ["application/vnd.accordproject.concerto"],
  });

  monacoInstance.languages.setLanguageConfiguration("concerto", {
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
    ],
  });

  monacoInstance.languages.setMonarchTokensProvider("concerto", {
    keywords: [
      "map", "concept", "from", "optional", "default", "range", "regex", "length",
      "abstract", "namespace", "import", "enum", "scalar", "extends",
      "participant", "asset", "identified", "by", "transaction", "event", "o",
    ],
    typeKeywords: ["String", "Integer", "Double", "DateTime", "Long", "Boolean"],
    operators: ["=", "{", "}", "@", '"'],
    symbols: /[=}{@"]+/,
    escapes: /\\(?:[btnfru"'\\]|\\u[0-9A-Fa-f]{4})/,
    tokenizer: {
      root: [
        { include: "@whitespace" },
        // Relationship arrow
        [/-->/, "relationship"],
        // Decorators
        [/@\w+/, "decorator"],
        // Identifiers and keywords
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              "@keywords": "keyword",
              "@typeKeywords": "type",
              "@default": "identifier",
            },
          },
        ],
        // Strings
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/"/, "string", "@string"],
        // Numbers
        [/\d+(\.\d+)?/, "number"],
        // Regex literals (e.g. regex=/\d+/)
        [/\/[^/\n]+\/[gimsuy]*/, "regexp"],
      ],
      string: [
        [/[^\\"]+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/"/, "string", "@pop"],
      ],
      whitespace: [
        [/\s+/, "white"],
        [/(\/\/.*)/, "comment"],
      ],
    },
  });

  // ── concerto-dark theme ─────────────────────────────────────────────────────
  // Colours match the graph node palette from ui-concerto-editor (CtoEditor.tsx)
  monacoInstance.editor.defineTheme("concerto-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment",           foreground: "4a5568" },
      { token: "decorator",         foreground: "fbb6ce" },
      { token: "keyword",           foreground: "63b3ed", fontStyle: "bold" },
      { token: "type",              foreground: "68d391", fontStyle: "bold" },
      { token: "identifier",        foreground: "e2e8f0" },
      { token: "relationship",      foreground: "fc8181", fontStyle: "bold" },
      { token: "string",            foreground: "68d391" },
      { token: "string.escape",     foreground: "d6bcfa" },
      { token: "number",            foreground: "63b3ed" },
      { token: "regexp",            foreground: "d6bcfa" },
      { token: "white",             foreground: "e2e8f0" },
    ],
    colors: {
      "editor.background":                "#1a202c",
      "editor.foreground":                "#e2e8f0",
      "editor.lineHighlightBackground":   "#2d374820",
      "editorLineNumber.foreground":      "#4a5568",
      "editorLineNumber.activeForeground":"#718096",
      "editor.selectionBackground":       "#63b3ed30",
      "editorCursor.foreground":          "#e2e8f0",
      "editorBracketMatch.background":    "#4a556840",
      "editorBracketMatch.border":        "#63b3ed",
      "editorIndentGuide.background1":    "#2d3748",
      "editorIndentGuide.activeBackground1": "#4a5568",
      "scrollbarSlider.background":       "#4a556840",
      "scrollbarSlider.hoverBackground":  "#4a5568",
      "editorError.foreground":           "#fc8181",
      "editorError.border":               "#fc818100",
    },
  });
};

// Builds the error markers for the current error, in priority order: the
// position embedded in the message, then the culprit's location from the
// parser AST (for semantic errors), then line 1 as a last resort.
function buildErrorMarkers(
  error: string,
  model: monaco.editor.ITextModel,
): monaco.editor.IMarkerData[] {
  const position = parseErrorPosition(error);
  if (position) {
    return [
      {
        startLineNumber: position.line,
        startColumn: Math.max(1, position.column - 1),
        endLineNumber: position.line,
        endColumn: position.column + 2,
        message: error,
        severity: monaco.MarkerSeverity.Error,
      },
    ];
  }

  // Semantic validator messages carry no position. Locate the culprit through
  // the parser AST (Unicode/$-safe) instead of a text search for the name.
  const culprit = locateCulprit(error, model.getValue());
  if (culprit) {
    return [
      {
        startLineNumber: culprit.line,
        startColumn: culprit.column,
        endLineNumber: culprit.line,
        endColumn: culprit.column + culprit.name.length,
        message: error,
        severity: monaco.MarkerSeverity.Error,
      },
    ];
  }

  return [
    {
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 3,
      message: error,
      severity: monaco.MarkerSeverity.Error,
    },
  ];
}

// ── Editor component ─────────────────────────────────────────────────────────

export function Editor({
  value,
  onChange,
  readOnly = false,
  language = "concerto",
  height = "100%",
  error = null,
  linkTargets,
  onNavigate,
}: EditorProps) {
  const monacoInstance = useMonaco();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const targetsRef = useRef<Set<string>>(new Set());
  const onNavigateRef = useRef(onNavigate);
  const [editorReady, setEditorReady] = useState(false);

  targetsRef.current = new Set(linkTargets ?? []);
  onNavigateRef.current = onNavigate;

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    setEditorReady(true);
    editor.onMouseDown((e) => {
      if (!onNavigateRef.current || !e.event.leftButton) return;
      const pos = e.target.position;
      if (!pos) return;
      const word = editor.getModel()?.getWordAtPosition(pos);
      if (word && targetsRef.current.has(word.word)) {
        onNavigateRef.current(word.word);
      }
    });
  };

  // Underline declared type names so they read as clickable references.
  // Debounced: the scan walks the whole model per target, which is too much
  // work to repeat on every keystroke in larger models.
  useEffect(() => {
    ensureLinkStyle();
    const editor = editorRef.current;
    if (!editor) return;
    const timer = window.setTimeout(() => {
      const model = editor.getModel();
      if (!model) return;
      const targets = linkTargets ?? [];
      const decorations: monaco.editor.IModelDeltaDecoration[] = [];
      for (const name of targets) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const matches = model.findMatches(`\\b${escaped}\\b`, false, true, true, null, false);
        for (const m of matches) {
          decorations.push({ range: m.range, options: { inlineClassName: LINK_CLASS } });
        }
      }
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
    }, LINK_DECORATION_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value, linkTargets, editorReady]);

  // Apply error markers whenever the error prop or monaco instance changes
  useEffect(() => {
    if (!monacoInstance) return;
    const model = editorRef.current?.getModel();
    if (!model) return;

    monacoInstance.editor.setModelMarkers(
      model,
      "concerto",
      error ? buildErrorMarkers(error, model) : [],
    );
  }, [error, monacoInstance, editorReady]);

  return (
    <MonacoEditor
      height={height}
      language={language}
      value={value}
      onChange={(v) => onChange?.(v ?? "")}
      beforeMount={setupMonaco}
      onMount={handleMount}
      theme="concerto-dark"
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: "on",
        folding: true,
        wordWrap: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        fontFamily:
          "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace",
        fontLigatures: true,
        autoClosingBrackets: "languageDefined",
        autoSurround: "languageDefined",
        bracketPairColorization: { enabled: true },
      }}
    />
  );
}
