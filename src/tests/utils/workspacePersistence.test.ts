import { describe, expect, it } from "vitest";
import { parseSnapshot } from "../../hooks/useWorkspacePersistence";

const VALID = {
  models: { "org.example@1.0.0": "namespace org.example@1.0.0" },
  savedAt: 1700000000000,
};

describe("parseSnapshot", () => {
  it("returns a well-formed snapshot as-is", () => {
    expect(parseSnapshot(JSON.stringify(VALID))).toEqual(VALID);
  });

  it("returns null for null or empty input", () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot("")).toBeNull();
  });

  it("returns null for corrupt JSON", () => {
    expect(parseSnapshot("{not json")).toBeNull();
  });

  it("returns null for non-object payloads", () => {
    expect(parseSnapshot('"a string"')).toBeNull();
    expect(parseSnapshot("42")).toBeNull();
    expect(parseSnapshot("null")).toBeNull();
  });

  it("returns null when savedAt is missing or not a number", () => {
    expect(parseSnapshot(JSON.stringify({ models: VALID.models }))).toBeNull();
    expect(parseSnapshot(JSON.stringify({ ...VALID, savedAt: "yesterday" }))).toBeNull();
  });

  it("returns null when models is missing, not a record, or empty", () => {
    expect(parseSnapshot(JSON.stringify({ savedAt: 1 }))).toBeNull();
    expect(parseSnapshot(JSON.stringify({ savedAt: 1, models: [] }))).toBeNull();
    expect(parseSnapshot(JSON.stringify({ savedAt: 1, models: {} }))).toBeNull();
    expect(parseSnapshot(JSON.stringify({ savedAt: 1, models: "cto" }))).toBeNull();
  });

  it("returns null when a model source is not a string", () => {
    expect(
      parseSnapshot(JSON.stringify({ savedAt: 1, models: { "org.a@1.0.0": 5 } })),
    ).toBeNull();
  });
});
