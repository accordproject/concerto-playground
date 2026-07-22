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
 * be referenced. Only identifier tokens qualify; comments, strings, regex
 * literals, numbers and keywords are excluded.
 */
export function isReferenceToken(tokenType: string): boolean {
  return tokenType.startsWith("identifier");
}
