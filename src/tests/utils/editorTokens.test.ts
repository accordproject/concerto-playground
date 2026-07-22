import { describe, it, expect } from "vitest";
import { tokenTypeAt, isReferenceToken, type TokenLike } from "../../utils/editorTokens";

// Mirrors the shape monaco.editor.tokenize returns for:
//   o Person owner // Person lives here
const LINE: TokenLike[] = [
  { offset: 0, type: "keyword.concerto" },      // "o"
  { offset: 1, type: "white.concerto" },        // " "
  { offset: 2, type: "identifier.concerto" },   // "Person"
  { offset: 8, type: "white.concerto" },        // " "
  { offset: 9, type: "identifier.concerto" },   // "owner"
  { offset: 14, type: "white.concerto" },       // " "
  { offset: 15, type: "comment.concerto" },     // "// Person lives here"
];

describe("tokenTypeAt", () => {
  it("returns the token covering a column in the middle of a token", () => {
    // Column 4 is 1-based, so it points at the "e" in "Person" (offset 3)
    expect(tokenTypeAt([LINE], 1, 4)).toBe("identifier.concerto");
  });

  it("returns the token starting exactly at the column", () => {
    expect(tokenTypeAt([LINE], 1, 3)).toBe("identifier.concerto");
    expect(tokenTypeAt([LINE], 1, 16)).toBe("comment.concerto");
  });

  it("resolves a name inside a trailing comment to the comment token", () => {
    // "Person" inside "// Person lives here" starts at offset 18 (column 19)
    expect(tokenTypeAt([LINE], 1, 19)).toBe("comment.concerto");
  });

  it("returns an empty string for a line outside the tokenized text", () => {
    expect(tokenTypeAt([LINE], 2, 1)).toBe("");
    expect(tokenTypeAt([], 1, 1)).toBe("");
  });

  it("returns the last token for a column past the end of the line", () => {
    expect(tokenTypeAt([LINE], 1, 200)).toBe("comment.concerto");
  });
});

describe("isReferenceToken", () => {
  it("accepts identifier tokens", () => {
    expect(isReferenceToken("identifier.concerto")).toBe(true);
  });

  it("rejects comments, strings, regex literals, keywords and numbers", () => {
    expect(isReferenceToken("comment.concerto")).toBe(false);
    expect(isReferenceToken("string.concerto")).toBe(false);
    expect(isReferenceToken("regexp.concerto")).toBe(false);
    expect(isReferenceToken("keyword.concerto")).toBe(false);
    expect(isReferenceToken("number.concerto")).toBe(false);
    expect(isReferenceToken("")).toBe(false);
  });
});
