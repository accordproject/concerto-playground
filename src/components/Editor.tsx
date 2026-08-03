import MonacoEditor, { loader, useMonaco, type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor";
import { locateCulprit, parseErrorPosition } from "../utils/errorHints";
import { getConceptHint } from "../utils/conceptHints";
import {
  isDeclarationToken,
  isReferenceToken,
  tokenTypeAt,
  tokenizeWithCache,
} from "../utils/editorTokens";
import { EDITOR_STRINGS } from "../constants/ui";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";
import type { TypeLinkTarget } from "../utils/graph/types";

loader.config({ monaco });
if (typeof window !== "undefined") Object.assign(window, { monaco });

// Hover hints only make sense on real language tokens; the same words
// inside comments, strings or regex literals are plain text.
const HOVERABLE_TOKEN_PREFIXES = ["keyword", "type", "decorator", "relationship"];
function isHoverableToken(tokenType: string): boolean {
  return HOVERABLE_TOKEN_PREFIXES.some((p) => tokenType.startsWith(p));
}

interface EditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  language?: string;
  height?: string;
  /** Validation error string — shown as a red squiggle at the reported line/column */
  error?: string | null;
  /** Type names to render as clickable references. Imported types carry the
      namespace to navigate to; unresolved ones render a warning instead. */
  linkTargets?: TypeLinkTarget[];
  /** Called with the type name (and its namespace, when the type is imported
      from another open namespace) when a clickable reference is clicked. */
  onNavigate?: (name: string, namespace?: string) => void;
}

// Inject the underline styles for clickable type references once.
const LINK_CLASS = "concerto-type-link";
const UNRESOLVED_LINK_CLASS = "concerto-type-link-unresolved";
// Declaration names are navigable too, but styled apart from references so
// definitions and usages stay visually distinct.
const DECL_CLASS = "concerto-type-decl";
// Delay before re-scanning the model for clickable references, so the
// full-document scan does not run on every keystroke.
const LINK_DECORATION_DEBOUNCE_MS = 200;
// Delay before a burst of keystrokes is sent to the app state as one change.
// Until it fires, the app state is intentionally behind the editor content;
// the flush and cancel rules below close that window whenever it could be
// observed from outside.
const CTO_CHANGE_DEBOUNCE_MS = 300;
function ensureLinkStyle() {
  if (typeof document === "undefined" || document.getElementById("concerto-type-link-style")) return;
  const el = document.createElement("style");
  el.id = "concerto-type-link-style";
  el.textContent =
    `.${LINK_CLASS} { text-decoration: underline dotted #38b2ac; text-underline-offset: 3px; cursor: pointer; }\n` +
    `.${UNRESOLVED_LINK_CLASS} { text-decoration: underline wavy #ed8936; text-underline-offset: 3px; cursor: help; }\n` +
    `.${DECL_CLASS} { text-decoration: underline dotted #63b3ed; text-underline-offset: 3px; cursor: pointer; }`;
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
        // Import targets are reference positions, so imported names stay
        // clickable; the type name (or braced type list) gets its own token
        // while the namespace path stays a plain identifier.
        [
          /(import)(\s+)([\w.]+(?:@[\w.-]+)?\.)(\{)([^}\n]*)(\})/,
          ["keyword", "white", "identifier", "delimiter", "identifier.reference", "delimiter"],
        ],
        [
          /(import)(\s+)([\w.]+(?:@[\w.-]+)?\.)(\w+)/,
          ["keyword", "white", "identifier", "identifier.reference"],
        ],
        // Relationship arrow: the next identifier is a type reference
        [/-->/, { token: "relationship", next: "@typeRef" }],
        // Decorators
        [/@\w+/, "decorator"],
        // Identifiers and keywords. Positions that can hold a type reference
        // switch to typeRef, declaration keywords switch to declName for the
        // declared name; other identifiers (property names) stay plain.
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              o: { token: "keyword", next: "@typeRef" },
              extends: { token: "keyword", next: "@typeRef" },
              enum: { token: "keyword", next: "@enumDecl" },
              concept: { token: "keyword", next: "@declName" },
              asset: { token: "keyword", next: "@declName" },
              participant: { token: "keyword", next: "@declName" },
              transaction: { token: "keyword", next: "@declName" },
              event: { token: "keyword", next: "@declName" },
              scalar: { token: "keyword", next: "@declName" },
              map: { token: "keyword", next: "@declName" },
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
      // The single identifier right after o, --> or extends is a type
      // reference; primitives keep their type token and anything else is
      // re-lexed by the root state.
      typeRef: [
        [/[ \t]+/, "white"],
        [
          /[a-zA-Z_][\w.]*/,
          {
            cases: {
              "@typeKeywords": { token: "type", next: "@pop" },
              "@keywords": { token: "keyword", next: "@pop" },
              "@default": { token: "identifier.reference", next: "@pop" },
            },
          },
        ],
        [/./, { token: "@rematch", next: "@pop" }],
      ],
      // The identifier right after a declaration keyword is the declared
      // name. It gets its own token so it can be decorated as navigable
      // (clicking it selects its node in the graph).
      declName: [
        [/[ \t]+/, "white"],
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              "@typeKeywords": { token: "type", next: "@pop" },
              "@keywords": { token: "keyword", next: "@pop" },
              "@default": { token: "identifier.declaration", next: "@pop" },
            },
          },
        ],
        [/./, { token: "@rematch", next: "@pop" }],
      ],
      // Enum bodies hold values, not type references: an "o Person" inside an
      // enum declares a value named Person, so o must not switch to typeRef.
      enumDecl: [
        { include: "@whitespace" },
        [/[a-zA-Z_]\w*/, "identifier.declaration"],
        [/\{/, { token: "delimiter", switchTo: "@enumBody" }],
        [/./, { token: "@rematch", next: "@pop" }],
      ],
      enumBody: [
        { include: "@whitespace" },
        [/@\w+/, "decorator"],
        [/"/, "string", "@string"],
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              "@keywords": "keyword",
              "@default": "identifier",
            },
          },
        ],
        [/\d+(\.\d+)?/, "number"],
        [/\}/, { token: "delimiter", next: "@pop" }],
      ],
      string: [
        [/[^\\"]+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/"/, "string", "@pop"],
      ],
      whitespace: [
        [/\s+/, "white"],
        [/\/\*/, "comment", "@comment"],
        [/(\/\/.*)/, "comment"],
      ],
      // Block comments span lines, so they need their own state; Monarch
      // carries the state across lines during full-document tokenization.
      comment: [
        [/[^/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[/*]/, "comment"],
      ],
    },
  });

  // Contextual hints (US-06): hovering a keyword, declaration kind, primitive
  // type, decorator or the relationship arrow shows a summary sourced from
  // the metamodel specification.
  monacoInstance.languages.registerHoverProvider("concerto", {
    provideHover(model: monaco.editor.ITextModel, position: monaco.Position) {
      const tokenLines = tokenizeWithCache(model, (text, languageId) =>
        monacoInstance.editor.tokenize(text, languageId),
      );
      if (!isHoverableToken(tokenTypeAt(tokenLines, position.lineNumber, position.column))) {
        return null;
      }
      const line = model.getLineContent(position.lineNumber);
      const hover = (hint: ReturnType<typeof getConceptHint>, startColumn: number, endColumn: number) => {
        if (!hint) return null;
        const contents: monaco.IMarkdownString[] = [
          { value: `**${hint.title}**` },
          { value: hint.summary },
        ];
        if (hint.syntax) {
          contents.push({ value: "```concerto\n" + hint.syntax + "\n```" });
        }
        return {
          range: new monacoInstance.Range(position.lineNumber, startColumn, position.lineNumber, endColumn),
          contents,
        };
      };

      const word = model.getWordAtPosition(position);
      if (word) {
        // A word directly preceded by @ is a decorator name, which is
        // free-form; explain decorators in general instead of the name.
        if (line[word.startColumn - 2] === "@") {
          return hover(getConceptHint("@"), word.startColumn - 1, word.endColumn);
        }
        return hover(getConceptHint(word.word), word.startColumn, word.endColumn);
      }

      // The relationship arrow is punctuation, so there is no word under the
      // cursor; look for a --> occurrence covering the hovered column.
      const arrowIndex = line.lastIndexOf("-->", position.column - 1);
      if (arrowIndex !== -1 && position.column >= arrowIndex + 1 && position.column <= arrowIndex + 3) {
        return hover(getConceptHint("-->"), arrowIndex + 1, arrowIndex + 4);
      }
      return null;
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

// Register the language eagerly at module load, before any editor or model
// exists. Registering it only from beforeMount can lose the race against the
// first tokenization pass, which then renders the whole document as unstyled
// plaintext until the next full value replacement.
setupMonaco(monaco);

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
  const monacoRef = useRef<typeof monaco | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const targetsRef = useRef<Map<string, TypeLinkTarget>>(new Map());
  const onNavigateRef = useRef(onNavigate);
  const onChangeRef = useRef(onChange);
  const [editorReady, setEditorReady] = useState(false);

  targetsRef.current = new Map((linkTargets ?? []).map((t) => [t.name, t]));
  onNavigateRef.current = onNavigate;
  onChangeRef.current = onChange;

  // Keystrokes reach the app state as one change per pause instead of one per
  // key. lastEmittedRef remembers the text this editor sent last, so the
  // external-change effect below can tell its own update apart from someone
  // else changing the model (undo, loading an example, a graph edit).
  const lastEmittedRef = useRef(value);
  const debouncedChange = useDebouncedCallback<string>((text) => {
    lastEmittedRef.current = text;
    onChangeRef.current?.(text);
  }, CTO_CHANGE_DEBOUNCE_MS);

  // The model changed from somewhere else while keystrokes were waiting:
  // drop the waiting text instead of overwriting the newer content.
  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
      debouncedChange.cancel();
    }
  }, [value, debouncedChange]);

  // Anything clicked outside the editor must see the current text, so the
  // waiting text is sent first. Capture phase: this runs before the click
  // target's own handlers, and mousedown precedes both blur and click.
  useEffect(() => {
    const flushBeforeOutsideInteraction = (e: MouseEvent) => {
      if (!debouncedChange.isPending()) return;
      const container = containerRef.current;
      if (container && e.target instanceof Node && !container.contains(e.target)) {
        debouncedChange.flush();
      }
    };
    document.addEventListener("mousedown", flushBeforeOutsideInteraction, true);
    return () => document.removeEventListener("mousedown", flushBeforeOutsideInteraction, true);
  }, [debouncedChange]);

  const handleMount: OnMount = (editor, monacoInstance) => {
    monacoRef.current = monacoInstance;
    editorRef.current = editor;
    setEditorReady(true);
    editor.onMouseDown((e) => {
      if (!onNavigateRef.current || !e.event.leftButton) return;
      const pos = e.target.position;
      if (!pos) return;
      const model = editor.getModel();
      if (!model) return;
      // Only navigate from a reference or declaration-name token; the same
      // word inside a comment or string is plain text and must stay inert.
      // The token is checked directly instead of the link decoration, which
      // is applied by a debounced scan and may not exist yet at click time.
      const tokenLines = tokenizeWithCache(model, (text, languageId) =>
        monacoInstance.editor.tokenize(text, languageId),
      );
      const tokenType = tokenTypeAt(tokenLines, pos.lineNumber, pos.column);
      if (!isReferenceToken(tokenType) && !isDeclarationToken(tokenType)) return;
      const word = model.getWordAtPosition(pos);
      if (!word) return;
      const target = targetsRef.current.get(word.word);
      // Unresolved imports are not navigable; their decoration explains why.
      if (target?.resolved) {
        onNavigateRef.current(target.name, target.namespace);
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
      // Tokenize once per scan so word matches inside comments, strings and
      // regex literals can be skipped; only identifier tokens are references.
      // Must use the loader's monaco instance: the concerto language is
      // registered there, not on the bundled monaco-editor import.
      const monacoInstance = monacoRef.current;
      const tokenLines =
        targets.length > 0 && monacoInstance
          ? monacoInstance.editor.tokenize(model.getValue(), model.getLanguageId())
          : [];
      for (const target of targets) {
        const escaped = target.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const matches = model.findMatches(`\\b${escaped}\\b`, false, true, true, null, false);
        const options: monaco.editor.IModelDecorationOptions = target.resolved
          ? {
              inlineClassName: LINK_CLASS,
              hoverMessage: target.namespace
                ? { value: EDITOR_STRINGS.importedTypeHover(target.namespace) }
                : undefined,
            }
          : {
              inlineClassName: UNRESOLVED_LINK_CLASS,
              hoverMessage: {
                value: EDITOR_STRINGS.unresolvedTypeHover(target.namespace ?? "unknown"),
              },
            };
        // Declaration names navigate too (to their own node in the graph),
        // but with a distinct style so definitions and usages stay apart.
        const declOptions: monaco.editor.IModelDecorationOptions = {
          inlineClassName: DECL_CLASS,
          hoverMessage: { value: EDITOR_STRINGS.declarationHover(target.name) },
        };
        for (const m of matches) {
          const tokenType = tokenTypeAt(tokenLines, m.range.startLineNumber, m.range.startColumn);
          if (isReferenceToken(tokenType)) {
            decorations.push({ range: m.range, options });
          } else if (target.resolved && isDeclarationToken(tokenType)) {
            decorations.push({ range: m.range, options: declOptions });
          }
        }
      }
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
    }, LINK_DECORATION_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value, linkTargets, editorReady]);

  // Apply error markers whenever the error changes or the editor becomes ready.
  useEffect(() => {
    const monacoInstance = monacoRef.current;
    if (!monacoInstance) return;
    const model = editorRef.current?.getModel();
    if (!model) return;

    monacoInstance.editor.setModelMarkers(
      model,
      "concerto",
      error ? buildErrorMarkers(error, model) : [],
    );
  }, [error, editorReady]);

  return (
    <div ref={containerRef} style={{ height }}>
      <MonacoEditor
      height="100%"
      language={language}
      value={value}
      onChange={(v) => debouncedChange.schedule(v ?? "")}
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
    </div>
  );
}
