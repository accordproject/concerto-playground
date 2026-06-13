import { describe, expect, it } from "vitest";
import {
  DEFAULT_URL_OPTIONS,
  parsePlaygroundUrlOptions,
} from "../../utils/urlOptions";
import { TARGET_LANGUAGES } from "../../codegen/generator";

describe("parsePlaygroundUrlOptions", () => {
  it("returns defaults when no query parameters are present", () => {
    expect(parsePlaygroundUrlOptions("")).toEqual(DEFAULT_URL_OPTIONS);
  });

  it("enables headless mode only for headless=true", () => {
    expect(parsePlaygroundUrlOptions("?headless=true")).toMatchObject({
      headless: true,
      showToolbar: false,
    });
    expect(parsePlaygroundUrlOptions("?headless=TRUE").headless).toBe(true);
    expect(parsePlaygroundUrlOptions("?headless=%20true%20").headless).toBe(true);
    expect(parsePlaygroundUrlOptions("?headless=false").headless).toBe(false);
    expect(parsePlaygroundUrlOptions("?headless=1").headless).toBe(false);
  });

  it("hides the CTO pane only when cto=false", () => {
    expect(parsePlaygroundUrlOptions("?cto=false").showCto).toBe(false);
    expect(parsePlaygroundUrlOptions("?cto=true").showCto).toBe(true);
    expect(parsePlaygroundUrlOptions("?cto=0").showCto).toBe(true);
  });

  it("hides the toolbar for headless mode or toolbar=false", () => {
    expect(parsePlaygroundUrlOptions("?headless=true").showToolbar).toBe(false);
    expect(parsePlaygroundUrlOptions("?toolbar=false").showToolbar).toBe(false);
    expect(parsePlaygroundUrlOptions("?headless=true&toolbar=true").showToolbar).toBe(false);
    expect(parsePlaygroundUrlOptions("?toolbar=true").showToolbar).toBe(true);
  });

  it("maps diagram and graph views to graph mode", () => {
    expect(parsePlaygroundUrlOptions("?view=diagram")).toMatchObject({
      viewMode: "graph",
      activeTab: "typescript",
    });
    expect(parsePlaygroundUrlOptions("?view=graph")).toMatchObject({
      viewMode: "graph",
      activeTab: "typescript",
    });
  });

  it("maps form and code views to their app modes", () => {
    expect(parsePlaygroundUrlOptions("?view=form")).toMatchObject({
      viewMode: "form",
      activeTab: "typescript",
    });
    expect(parsePlaygroundUrlOptions("?view=code")).toMatchObject({
      viewMode: "code",
      activeTab: "typescript",
    });
  });

  it("maps JSON AST and JSON Schema aliases to code tabs", () => {
    expect(parsePlaygroundUrlOptions("?view=json-ast")).toMatchObject({
      viewMode: "code",
      activeTab: "ast",
    });
    expect(parsePlaygroundUrlOptions("?view=json-schema")).toMatchObject({
      viewMode: "code",
      activeTab: "jsonschema",
    });
  });

  it("maps exact output target ids to code tabs", () => {
    expect(parsePlaygroundUrlOptions("?view=concertino")).toMatchObject({
      viewMode: "code",
      activeTab: "concertino",
    });
    expect(parsePlaygroundUrlOptions("?view=openapi")).toMatchObject({
      viewMode: "code",
      activeTab: "openapi",
    });
  });

  it("maps every canonical output target id to a code tab", () => {
    for (const target of TARGET_LANGUAGES) {
      expect(parsePlaygroundUrlOptions(`?view=${target}`)).toMatchObject({
        viewMode: "code",
        activeTab: target,
      });
    }
  });

  it("ignores unknown and empty view values", () => {
    expect(parsePlaygroundUrlOptions("?view=unknown")).toEqual(DEFAULT_URL_OPTIONS);
    expect(parsePlaygroundUrlOptions("?view=")).toEqual(DEFAULT_URL_OPTIONS);
  });

  it("normalizes view casing and surrounding whitespace", () => {
    expect(parsePlaygroundUrlOptions("?view=%20JSON-AST%20")).toMatchObject({
      viewMode: "code",
      activeTab: "ast",
    });
  });
});
