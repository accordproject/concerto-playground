// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  areWorkspaceModelsEqual,
  clearWorkspaceSnapshot,
  parseSnapshot,
  useWorkspacePersistence,
} from "../../hooks/useWorkspacePersistence";

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

  it("returns null when savedAt is not finite", () => {
    expect(parseSnapshot('{"models":{"org.example@1.0.0":"cto"},"savedAt":1e999}')).toBeNull();
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

describe("areWorkspaceModelsEqual", () => {
  it("ignores key insertion order", () => {
    const first = { "org.a@1.0.0": "a", "org.b@1.0.0": "b" };
    const second = { "org.b@1.0.0": "b", "org.a@1.0.0": "a" };
    expect(areWorkspaceModelsEqual(first, second)).toBe(true);
  });

  it("detects missing namespaces and changed CTO", () => {
    expect(areWorkspaceModelsEqual({ "org.a@1.0.0": "a" }, {})).toBe(false);
    expect(areWorkspaceModelsEqual({ "org.a@1.0.0": "a" }, { "org.a@1.0.0": "changed" })).toBe(false);
  });
});

describe("clearWorkspaceSnapshot", () => {
  it("removes the persisted workspace", () => {
    localStorage.setItem("workspace.v1", JSON.stringify(VALID));
    clearWorkspaceSnapshot();
    expect(localStorage.getItem("workspace.v1")).toBeNull();
  });
});

describe("useWorkspacePersistence", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("warns and exposes a user-facing error when local storage rejects a save", () => {
    vi.useFakeTimers();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });

    const { result } = renderHook(() => useWorkspacePersistence(VALID.models));
    act(() => vi.advanceTimersByTime(500));

    expect(warning).toHaveBeenCalledWith(
      "Could not save workspace to local storage:",
      expect.any(Error),
    );
    expect(result.current.saveError).toContain("could not be saved");
    expect(result.current.lastSaved).toBeNull();
  });
});
