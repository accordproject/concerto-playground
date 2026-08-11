import { useCallback, useEffect, useRef, useState } from 'react';
import {
  generate,
  TARGET_LANGUAGES,
  type GenerationResult,
  type TargetLanguage,
} from '../codegen/generator';

// Wait after an edit before regenerating, so fast typing does not queue a
// generation run per keystroke.
const GENERATION_DEBOUNCE_MS = 500;

/**
 * Debounced code generation for all open models: results reset whenever the
 * models change and regenerate for every target, visible tab first. While
 * `enabled` is false (the code view is not open) nothing runs; generation
 * catches up as soon as it flips true. Switching the visible tab only
 * changes the generation order, it never discards computed results.
 */
export function useCodeGeneration(
  models: Record<string, string>,
  initialTab: TargetLanguage,
  enabled: boolean,
) {
  const [activeTab, setActiveTab] = useState<TargetLanguage>(initialTab);
  const [results, setResults] = useState<Partial<Record<TargetLanguage, GenerationResult>>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read at run start so tab switches order the visible target first without
  // retriggering the generation effect.
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  // Bumped whenever the sources change, so a superseded in-flight run stops
  // publishing results compiled from stale sources.
  const runIdRef = useRef(0);

  const runGeneration = useCallback(async (sources: string[]) => {
    const runId = runIdRef.current;
    const first = activeTabRef.current;
    const ordered = [first, ...TARGET_LANGUAGES.filter((t) => t !== first)];
    for (const target of ordered) {
      const result = await generate(sources, target);
      if (runIdRef.current !== runId) return;
      setResults((prev) => ({ ...prev, [target]: result }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    runIdRef.current += 1;
    setResults({});
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const allSources = Object.values(models).filter(Boolean);
    debounceRef.current = setTimeout(() => {
      runGeneration(allSources);
    }, GENERATION_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [models, runGeneration, enabled]);

  return { results, activeTab, setActiveTab };
}
