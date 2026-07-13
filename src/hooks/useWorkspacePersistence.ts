import { useEffect, useState } from "react";

const STORAGE_KEY = "workspace.v1";

// Same window as the codegen debounce in App.tsx: a burst of keystrokes
// collapses into a single localStorage write.
const SAVE_DEBOUNCE_MS = 500;

export interface WorkspaceSnapshot {
  models: Record<string, string>;
  savedAt: number;
}

// Pure so it can be unit-tested without a browser localStorage. Returns null
// for anything that is not a well-formed snapshot (corrupt JSON, older or
// foreign shapes, empty workspaces), so callers never have to re-validate.
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
  if (typeof savedAt !== "number") return null;
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

// Persists the open models to localStorage, debounced. Returns the timestamp
// of the last successful write, for the "Last saved" label.
export function useWorkspacePersistence(models: Record<string, string>): number | null {
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const snapshot: WorkspaceSnapshot = { models, savedAt: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        setLastSaved(snapshot.savedAt);
      } catch {
        // Quota exceeded or storage denied: persistence is best-effort.
      }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [models]);

  return lastSaved;
}
