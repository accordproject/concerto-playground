// Friendly hints layered on top of the official Concerto error messages.
//
// ALL custom (non-official) error text in the playground lives in this file,
// in the HINT_RULES list below. The error banners always show the official
// parser/validator message untouched; when a rule here recognises the
// situation, its hint is shown as an extra line prefixed with "Hint:".
// Removing a rule (or this whole file) falls back to official messages only.
//
// Rules are matched against the official message text and, where needed, the
// offending source line and the kind of declaration it sits in (both located
// via the "line N column M" position that Concerto errors carry). First
// matching rule wins, so keep the more specific rules first.

import { DECLARATION_TYPES } from './graph/types';
import { locateTypeReference } from './graph/ctoToGraph';

export interface EnclosingDeclaration {
  kind: string;
  name: string | null;
}

/**
 * Extracts the "line N column M" position that Concerto error messages carry,
 * or null for positionless (semantic) messages. Single owner of that format.
 */
export function parseErrorPosition(message: string): { line: number; column: number } | null {
  const m = message.match(/line\s+(\d+)\s+col(?:umn)?\s+(\d+)/i);
  return m ? { line: parseInt(m[1], 10), column: parseInt(m[2], 10) } : null;
}

interface HintInfo {
  message: string;
  line: string;
  context: EnclosingDeclaration | null;
}

interface HintRule {
  id: string;
  when: (message: string, offendingLine: string, context: EnclosingDeclaration | null) => boolean;
  hint: string | ((info: HintInfo) => string);
}

// Turns "Contracting party legal" into "ContractingPartyLegal".
function joinWords(words: string[]): string {
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

// Derived from the canonical list in graph/types.ts so the two cannot drift.
const DECLARATION_KEYWORDS = DECLARATION_TYPES.join('|');

export const DECLARATION_START = new RegExp(
  `^\\s*(?:abstract\\s+)?(${DECLARATION_KEYWORDS})\\b(?:\\s+([A-Za-z_$][\\w$]*))?`
);

/**
 * For a declaration line whose name contains spaces, suggests the joined
 * single-word name, e.g. "Contracting party" becomes "ContractingParty".
 * The column points at the start of the original name in the line.
 */
export function suggestJoinedName(line: string): { original: string; joined: string; column: number } | null {
  const m = line.match(
    new RegExp(`^\\s*(?:abstract\\s+)?(?:${DECLARATION_KEYWORDS})\\s+([A-Za-z_$][\\w$]*(?:\\s+[A-Za-z_$][\\w$]*)+)`)
  );
  if (!m) return null;
  let words = m[1].split(/\s+/);
  const stop = words.findIndex((w) => w === 'extends' || w === 'identified');
  if (stop >= 0) words = words.slice(0, stop);
  if (words.length < 2) return null;
  const original = words.join(' ');
  return { original, joined: joinWords(words), column: line.indexOf(words[0]) + 1 };
}

// Walks upward from the error line to the nearest declaration keyword and
// returns its kind and name ("enum GoverningLaw"), or null when the error is
// not inside a declaration body (a closing brace is found first).
export function enclosingDeclaration(sourceLines: string[], errorLine: number): EnclosingDeclaration | null {
  for (let i = errorLine - 2; i >= 0; i--) {
    const line = sourceLines[i];
    const decl = line.match(DECLARATION_START);
    if (decl) return { kind: decl[1], name: decl[2] ?? null };
    if (/^\s*}/.test(line)) return null;
  }
  return null;
}

// Matches "concept Some Name" style lines: a declaration keyword, a name,
// then another identifier that is not one of the valid follow-up keywords.
const NAME_WITH_SPACE = new RegExp(
  `^\\s*(?:abstract\\s+)?(?:${DECLARATION_KEYWORDS})\\s+[A-Za-z_$][\\w$]*\\s+(?!extends\\b|identified\\b)[A-Za-z_$]`
);

const HINT_RULES: HintRule[] = [
  {
    id: 'unclosed-declaration-above',
    // A new declaration keyword while still inside a body: the declaration
    // above the error was never closed.
    when: (_m, line, ctx) => ctx !== null && DECLARATION_START.test(line),
    hint: ({ context }) =>
      context?.name
        ? `The ${context.kind} "${context.name}" above is missing its closing "}". Close it before starting a new declaration.`
        : 'The declaration above is missing its closing "}". Close it before starting a new declaration.',
  },
  {
    id: 'enum-value-with-type',
    when: (m, line, ctx) => ctx?.kind === 'enum' && /^\s*o\s+\w+\s+\w+/.test(line) && m.includes('"o"'),
    hint: ({ line }) => {
      const m = line.match(/^\s*o\s+([\w$]+)\s+([\w$]+)/);
      return m
        ? `Enum values are just names, without a type: write "o ${m[2]}", not "o ${m[1]} ${m[2]}".`
        : 'Enum values are just names, without a type: write "o ACTIVE", not "o String ACTIVE".';
    },
  },
  {
    id: 'relationship-in-enum',
    when: (_m, line, ctx) => ctx?.kind === 'enum' && /^\s*-->/.test(line),
    hint: 'Relationships ("-->") are not allowed inside an enum. An enum body only lists values, like "o ACTIVE".',
  },
  {
    id: 'scalar-missing-extends',
    when: (m) => m.includes('"extends"') && !m.includes('"identified by"'),
    hint: ({ line }) => {
      const name = line.match(/scalar\s+([\w$]+)/)?.[1] ?? 'SSN';
      return `A scalar has no body of its own; it must extend a primitive type: "scalar ${name} extends String".`;
    },
  },
  {
    id: 'missing-declaration-name',
    when: (m) => m.includes('identifier') && m.includes('but "{" found'),
    hint: ({ line }) => {
      const kw = line.match(DECLARATION_START)?.[1] ?? 'concept';
      return `The declaration has no name. Write one between "${kw}" and the brace, e.g. "${kw} Person {".`;
    },
  },
  {
    id: 'declaration-name-with-space',
    when: (m, line) => m.startsWith('Expected "{",') && NAME_WITH_SPACE.test(line),
    hint: ({ line }) => {
      const s = suggestJoinedName(line);
      return s
        ? `A declaration name must be a single word. Rename "${s.original}" to "${s.joined}".`
        : 'A declaration name must be a single word. Join the words together: "ContractingParty" instead of "Contracting party".';
    },
  },
  {
    id: 'missing-open-brace',
    when: (m) => m.includes('"extends"') && m.includes('"identified by"'),
    hint: 'The body of this declaration never opens. Add "{" after its name, or continue the name with "extends" or "identified by".',
  },
  {
    id: 'missing-property-name',
    when: (m) => m.includes('"[]"') && m.includes('but "}" found'),
    hint: 'The property has a type but no name. Add one after the type: "o String firstName".',
  },
  {
    id: 'property-outside-declaration',
    // A property or enum-value line at the top level: the declaration above
    // it was closed too early.
    when: (m, line, ctx) => ctx === null && /^\s*(o\s|-->)/.test(line) && m.includes('"concept"'),
    hint: 'This line sits outside any declaration; the "}" above it closes the declaration too early. Move that "}" below these lines.',
  },
  {
    id: 'extra-closing-brace',
    when: (m) => m.includes('but "}" found') && m.includes('"concept"'),
    hint: 'This "}" closes nothing. Delete it, or check whether a declaration above it is missing its opening "{".',
  },
  {
    id: 'missing-closing-brace',
    when: (m) => m.includes('but end of input found') && m.includes('"}"'),
    hint: 'The file ends while a declaration is still open. Add the missing "}" to close it.',
  },
  {
    id: 'space-in-property-tokens',
    // A property line that already carries its marker but has an extra word.
    // This almost always means a type or name contains a space ("Stri ng"
    // for "String"); the parser reports the extra token as unexpected after
    // it has already read a complete "o Type name".
    when: (m, line) =>
      m.includes('"optional"') && /^\s*(?:o|-->)\s+\S+\s+\S+\s+\S/.test(line),
    hint: 'A property is written "o Type name", one word for the type and one for the name. This line has an extra word, so a type or name has a stray space in it (for example "Stri ng" should be "String"). Remove the space.',
  },
  {
    id: 'missing-property-prefix',
    // Only when the line does NOT already start with a marker, otherwise this
    // fires on unrelated property errors and suggests a nonsensical "o o ..."
    when: (m, line) =>
      m.includes('"-->"') &&
      m.includes('"o"') &&
      !m.includes('end of input') &&
      !/^\s*(?:o\s|-->)/.test(line),
    hint: ({ line }) => {
      const body = line.trim();
      return body
        ? `Every property line starts with a marker: write "o ${body}" for a value, or "--> ${body}" for a relationship.`
        : 'Every property line starts with a marker: "o" for a value ("o String name") or "-->" for a relationship.';
    },
  },
  {
    id: 'missing-namespace',
    when: (m) => m.includes('"namespace"'),
    hint: 'The file needs a namespace before anything else. Add one as the first line: "namespace org.example@1.0.0".',
  },
  {
    id: 'undeclared-type',
    when: (m) => m.includes('Undeclared type'),
    hint: ({ message }) => {
      const type = extractCulpritName(message);
      return type
        ? `The type "${type}" does not exist. Declare it in this file, import it from another namespace, or remove the property that uses it.`
        : 'This type does not exist. Declare it in this file, import it from another namespace, or remove the property that uses it.';
    },
  },
  {
    id: 'missing-super-type',
    when: (m) => m.includes('Could not find super type'),
    hint: ({ message }) => {
      const type = extractCulpritName(message);
      return type
        ? `The parent type "${type}" after "extends" does not exist yet. Declare it above this one, or import it from another namespace.`
        : 'The parent type after "extends" does not exist yet. Declare it above this one, or import it from another namespace.';
    },
  },
  {
    id: 'duplicate-declaration',
    when: (m) => m.includes('Duplicate class name'),
    hint: ({ message }) => {
      const name = extractCulpritName(message);
      return name
        ? `The name "${name}" is already used by another declaration in this namespace. Rename one of the two.`
        : 'This name is already used by another declaration in this namespace. Rename one of the two.';
    },
  },
];

/**
 * Extracts the type or declaration name a positionless validator message
 * complains about, e.g. 'Undeclared type "GoverningLaw" ...',
 * 'Could not find super type Base' or 'Duplicate class name org.x@1.0.0.Person'.
 * The name is taken verbatim (between quotes, or the trailing token) so it
 * stays correct for Unicode and `$` identifiers, which an ASCII character
 * class would truncate or miss.
 */
export function extractCulpritName(message: string): string | null {
  const undeclared = message.match(/Undeclared type "([^"]+)"/);
  if (undeclared) return undeclared[1];
  const superType = message.match(/Could not find super type (.+)$/);
  if (superType) return superType[1].trim();
  const duplicate = message.match(/Duplicate class name (.+)$/);
  if (duplicate) return duplicate[1].trim().split('.').pop() ?? null;
  return null;
}

/**
 * Locates the culprit of a semantic error, whose official message carries no
 * line/column. The name comes from the message and the position from the real
 * parser's AST (via locateTypeReference), so no hand-rolled identifier regex is
 * involved and Unicode/`$` names resolve correctly.
 */
export function locateCulprit(
  message: string,
  source: string,
): { name: string; line: number; column: number } | null {
  const name = extractCulpritName(message);
  if (!name) return null;
  const loc = locateTypeReference(source, name);
  return loc ? { name, line: loc.line, column: loc.column } : null;
}

/**
 * Returns a friendly hint for a Concerto error message, or null when the
 * situation is not one of the recognised common mistakes.
 */
export function findErrorHint(message: string, source: string): string | null {
  const errorLine = parseErrorPosition(message)?.line ?? 0;
  const sourceLines = source.split(/\r?\n/);
  const line = errorLine ? sourceLines[errorLine - 1] ?? '' : '';
  const context = errorLine ? enclosingDeclaration(sourceLines, errorLine) : null;
  const rule = HINT_RULES.find((r) => r.when(message, line, context));
  if (!rule) return null;
  return typeof rule.hint === 'function' ? rule.hint({ message, line, context }) : rule.hint;
}

/**
 * Removes a trailing "line N column M" position from a parser message. The
 * banner shows the position with a caret snippet instead, so repeating it in
 * the message text is redundant. The position stays in the raw message (for
 * the snippet and hint matching); this is only for display.
 */
export function stripPosition(message: string): string {
  return message.replace(/\.?\s*[Ll]ine\s+\d+\s+col(?:umn)?\s+\d+\.?\s*$/, '').trim();
}

/**
 * Builds a compiler-style excerpt of the given line with a caret under the
 * given column, e.g.
 *   13 | enum Contracting party {
 *      |                  ^
 * Shared by every error banner so parse and semantic errors point at their
 * location the same way. Returns null when the line is out of range.
 */
export function buildSnippet(source: string, line: number, column: number): string | null {
  const text = source.split(/\r?\n/)[line - 1];
  if (text === undefined) return null;
  const label = `${line} | `;
  return `${label}${text}\n${' '.repeat(label.length + Math.max(0, column - 1))}^`;
}
