import MonacoEditor, { type BeforeMount } from "@monaco-editor/react";

interface EditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  language?: string;
  height?: string;
}

const setupMonaco: BeforeMount = (monaco) => {
  // Register a Concerto language so the tokenizer can apply semantic colours
  if (!monaco.languages.getLanguages().some((l: { id: string }) => l.id === "concerto")) {
    monaco.languages.register({ id: "concerto" });
    monaco.languages.setMonarchTokensProvider("concerto", {
      keywords: [
        "concept", "enum", "asset", "participant", "event", "transaction", "map",
        "scalar", "abstract", "extends", "identified", "by", "optional", "namespace",
        "import", "from",
      ],
      primitives: ["String", "Integer", "Long", "Double", "Boolean", "DateTime"],
      tokenizer: {
        root: [
          // Comments
          [/\/\/.*$/, "comment"],
          // Decorators
          [/@\w+/, "decorator"],
          // Namespace / import lines
          [/^(namespace|import)\b/, "namespace"],
          // Relationship arrow
          [/-->/, "relationship"],
          // Property marker
          [/\bo\b/, "delimiter"],
          // Keywords
          [
            /\b(concept|enum|asset|participant|event|transaction|map|scalar|abstract|extends|identified|by|optional|from)\b/,
            "keyword",
          ],
          // Primitive types
          [/\b(String|Integer|Long|Double|Boolean|DateTime)\b/, "type.primitive"],
          // Identifiers
          [/[A-Z][a-zA-Z0-9_]*/, "type.identifier"],
          // String literals
          [/"([^"\\]|\\.)*"/, "string"],
          // Numbers
          [/\d+(\.\d+)?/, "number"],
          // Regex literals
          [/\/[^/]+\/[gimsuy]*/, "regexp"],
          // Braces / brackets
          [/[{}[\]()]/, "delimiter.bracket"],
        ],
      },
    });
  }

  // Register the concerto-dark theme matching ui-concerto-editor's COLORS palette
  monaco.editor.defineTheme("concerto-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "4a5568" },
      { token: "decorator", foreground: "fbb6ce" },
      { token: "namespace", foreground: "718096" },
      { token: "keyword", foreground: "63b3ed", fontStyle: "bold" },
      { token: "type.primitive", foreground: "68d391", fontStyle: "bold" },
      { token: "type.identifier", foreground: "63b3ed" },
      { token: "relationship", foreground: "fc8181", fontStyle: "bold" },
      { token: "string", foreground: "68d391" },
      { token: "number", foreground: "63b3ed" },
      { token: "regexp", foreground: "d6bcfa" },
      { token: "delimiter", foreground: "718096" },
      { token: "delimiter.bracket", foreground: "718096" },
    ],
    colors: {
      "editor.background": "#1a202c",
      "editor.foreground": "#e2e8f0",
      "editor.lineHighlightBackground": "#2d374820",
      "editorLineNumber.foreground": "#4a5568",
      "editorLineNumber.activeForeground": "#718096",
      "editor.selectionBackground": "#63b3ed30",
      "editorCursor.foreground": "#e2e8f0",
      "editorIndentGuide.background1": "#2d3748",
      "editorIndentGuide.activeBackground1": "#4a5568",
      "scrollbarSlider.background": "#4a556840",
      "scrollbarSlider.hoverBackground": "#4a5568",
    },
  });
};

export function Editor({
  value,
  onChange,
  readOnly = false,
  language = "concerto",
  height = "100%",
}: EditorProps) {
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
      }}
    />
  );
}
