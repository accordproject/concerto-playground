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
 * catches up as soon as it flips true.
 */
export function useCodeGeneration(
  models: Record<string, string>,
  initialTab: TargetLanguage,
  enabled: boolean,
) {
  const [activeTab, setActiveTab] = useState<TargetLanguage>(initialTab);
  const [results, setResults] = useState<Partial<Record<TargetLanguage, GenerationResult>>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runGeneration = useCallback(async (sources: string[]) => {
    const ordered = [activeTab, ...TARGET_LANGUAGES.filter((t) => t !== activeTab)];
    for (const target of ordered) {
      const result = await generate(sources, target);
      setResults((prev) => ({ ...prev, [target]: result }));
    }
  }, [activeTab]);

  useEffect(() => {
    if (!enabled) return;
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
