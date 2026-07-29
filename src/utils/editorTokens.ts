// Helpers for deciding whether a text match inside the Monaco model is a
// real type reference, based on the Monarch tokenizer output. A name that
// appears inside a comment, string or regex literal matches the same word
// regex but must not be decorated or navigable.

/** Minimal shape of a Monaco tokenizer token (monaco.Token). */
export interface TokenLike {
  /** 0-based character offset of the token within its line. */
  offset: number;
  /** Token type, e.g. "identifier.concerto" or "comment.concerto". */
  type: string;
}

/**
 * Returns the token type covering the given 1-based line/column, or an
 * empty string when the position lies outside the tokenized text.
 */
export function tokenTypeAt(
  lines: TokenLike[][],
  lineNumber: number,
  column: number,
): string {
  const tokens = lines[lineNumber - 1];
  if (!tokens) return "";
  let type = "";
  for (const token of tokens) {
    if (token.offset > column - 1) break;
    type = token.type;
  }
  return type;
}

/**
 * True when the token type marks a spot where a declared type can actually
 * be referenced. Only the context-specific identifier.reference tokens the
 * tokenizer emits for type positions (after o, --> and extends, and inside
 * import targets) qualify; plain identifiers such as declaration names,
 * property names and enum values are excluded, as are comments, strings,
 * regex literals, numbers and keywords.
 */
export function isReferenceToken(tokenType: string): boolean {
  return tokenType.startsWith("identifier.reference");
}

/** The slice of monaco.editor.ITextModel the tokenization cache needs. */
export interface TokenizableModel {
  getVersionId(): number;
  getValue(): string;
  getLanguageId(): string;
}

const tokenLinesCache = new WeakMap<
  TokenizableModel,
  { versionId: number; lines: TokenLike[][] }
>();

/**
 * Tokenizes the whole document through the given tokenizer, caching the
 * result per model until its version changes. Full-document tokenization
 * keeps multiline lexical state correct (block comments), but is O(model
 * size), which is too costly to repeat on every hover; getVersionId()
 * increments on any edit, so cached lines are reused between edits.
 */
export function tokenizeWithCache(
  model: TokenizableModel,
  tokenize: (text: string, languageId: string) => TokenLike[][],
): TokenLike[][] {
  const cached = tokenLinesCache.get(model);
  if (cached && cached.versionId === model.getVersionId()) {
    return cached.lines;
  }
  const lines = tokenize(model.getValue(), model.getLanguageId());
  tokenLinesCache.set(model, { versionId: model.getVersionId(), lines });
  return lines;
}
