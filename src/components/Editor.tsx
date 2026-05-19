import MonacoEditor, { useMonaco, type BeforeMount } from "@monaco-editor/react";
import { useEffect } from "react";
import * as monaco from "monaco-editor";

interface EditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  language?: string;
  height?: string;
  /** Validation error string — shown as a red squiggle at the reported line/column */
  error?: string | null;
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

// ── Editor component ─────────────────────────────────────────────────────────

export function Editor({
  value,
  onChange,
  readOnly = false,
  language = "concerto",
  height = "100%",
  error = null,
}: EditorProps) {
  const monacoInstance = useMonaco();

  // Apply error markers whenever the error prop or monaco instance changes
  useEffect(() => {
    if (!monacoInstance) return;
    const models = monacoInstance.editor.getModels();
    // Target the first editable model (the CTO input)
    const model = models.find((m) => !m.isDisposed());
    if (!model) return;

    if (error) {
      // Parse "Line N column M" from the error message (Concerto parser format)
      const match = error.match(/[Ll]ine\s+(\d+)\s+col(?:umn)?\s+(\d+)/);
      const lineNumber = match ? parseInt(match[1], 10) : 1;
      const col = match ? parseInt(match[2], 10) : 1;
      monacoInstance.editor.setModelMarkers(model, "concerto", [
        {
          startLineNumber: lineNumber,
          startColumn: Math.max(1, col - 1),
          endLineNumber: lineNumber,
          endColumn: col + 2,
          message: error,
          severity: monaco.MarkerSeverity.Error,
        },
      ]);
    } else {
      monacoInstance.editor.setModelMarkers(model, "concerto", []);
    }
  }, [error, monacoInstance]);

  return (
    <MonacoEditor
      height={height}
      language={language}
      value={value}
      onChange={(v) => onChange?.(v ?? "")}
      beforeMount={setupMonaco}
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
