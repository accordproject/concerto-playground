import { useEffect, useState } from "react";

const STORAGE_KEY = "workspace.v1";

// Same window as the codegen debounce in App.tsx: a burst of keystrokes
// collapses into a single localStorage write.
const SAVE_DEBOUNCE_MS = 500;

export interface WorkspaceSnapshot {
  models: Record<string, string>;
  savedAt: number;
}

/** Returns whether two workspace model maps have the same keys and CTO text. */
export function areWorkspaceModelsEqual(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  return leftKeys.every(
    (namespace) => Object.prototype.hasOwnProperty.call(right, namespace) && left[namespace] === right[namespace],
  );
}

/**
 * Parses a persisted workspace snapshot.
 *
 * Pure so it can be unit-tested without browser localStorage. Returns `null`
 * for corrupt JSON, unsupported shapes, or empty workspaces.
 */
export function parseSnapshot(raw: string | null): WorkspaceSnapshot | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { models, savedAt } = parsed as { models?: unknown; savedAt?: unknown };
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) return null;
  if (typeof models !== "object" || models === null || Array.isArray(models)) return null;
  const sources = Object.values(models);
  if (sources.length === 0) return null;
  if (!sources.every((cto) => typeof cto === "string")) return null;
  return { models: models as Record<string, string>, savedAt };
}

// Call this at module load, before the App mounts: the hook's first debounced
// write overwrites the stored snapshot, so it must be captured up front.
export function loadWorkspaceSnapshot(): WorkspaceSnapshot | null {
  try {
    return parseSnapshot(localStorage.getItem(STORAGE_KEY));
  } catch {
    // localStorage access can throw (e.g. blocked storage in the browser).
    return null;
  }
}

interface WorkspacePersistenceState {
  lastSaved: number | null;
  saveError: string | null;
  dismissSaveError: () => void;
}

// Persists the open models to localStorage, debounced. Reports the last
// successful save and any storage failure so the UI can warn the user.
export function useWorkspacePersistence(models: Record<string, string>): WorkspacePersistenceState {
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const snapshot: WorkspaceSnapshot = { models, savedAt: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        setLastSaved(snapshot.savedAt);
        setSaveError(null);
      } catch (error) {
        console.warn("Could not save workspace to local storage:", error);
        setSaveError("Changes could not be saved in this browser. Keep this tab open or copy your schema before closing it.");
      }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [models]);

  return { lastSaved, saveError, dismissSaveError: () => setSaveError(null) };
}
