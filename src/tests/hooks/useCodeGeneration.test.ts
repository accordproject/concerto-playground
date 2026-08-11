// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCodeGeneration } from '../../hooks/useCodeGeneration';
import type { TargetLanguage } from '../../codegen/generator';

// Each generate call parks a resolver so tests control exactly when a
// target's output arrives, mirroring the async worker in production.
const { pending, generateMock } = vi.hoisted(() => {
  interface PendingCall {
    sources: string[];
    target: string;
    resolve: (result: { code: string }) => void;
  }
  const pending: PendingCall[] = [];
  const generateMock = vi.fn(
    (sources: string[], target: string) =>
      new Promise((resolve) => {
        pending.push({ sources, target, resolve: resolve as PendingCall['resolve'] });
      }),
  );
  return { pending, generateMock };
});

vi.mock('../../codegen/generator', () => ({
  TARGET_LANGUAGES: ['typescript', 'java'],
  generate: generateMock,
}));

const TS = 'typescript' as TargetLanguage;
const DEBOUNCE_MS = 500;

async function resolveNext(code: string) {
  const call = pending.shift();
  if (!call) throw new Error('no pending generate call');
  await act(async () => {
    call.resolve({ code });
    await Promise.resolve();
  });
}

describe('useCodeGeneration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pending.length = 0;
    generateMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function render(models: Record<string, string>, enabled = true) {
    return renderHook(
      ({ models, enabled }: { models: Record<string, string>; enabled: boolean }) =>
        useCodeGeneration(models, TS, enabled),
      { initialProps: { models, enabled } },
    );
  }

  it('does not generate while disabled and catches up once enabled', async () => {
    const models = { 'org.a@1.0.0': 'cto' };
    const { rerender } = render(models, false);
    act(() => vi.advanceTimersByTime(DEBOUNCE_MS));
    expect(generateMock).not.toHaveBeenCalled();

    rerender({ models, enabled: true });
    act(() => vi.advanceTimersByTime(DEBOUNCE_MS));
    expect(generateMock).toHaveBeenCalledTimes(1);
  });

  it('generates the visible tab first and keeps results on tab switch', async () => {
    const { result } = render({ 'org.a@1.0.0': 'cto' });
    act(() => vi.advanceTimersByTime(DEBOUNCE_MS));

    expect(generateMock.mock.calls[0][1]).toBe('typescript');
    await resolveNext('ts-code');
    await resolveNext('java-code');
    expect(Object.keys(result.current.results)).toEqual(['typescript', 'java']);

    act(() => result.current.setActiveTab('java' as TargetLanguage));
    act(() => vi.advanceTimersByTime(DEBOUNCE_MS));

    // The models did not change, so nothing regenerates and nothing is lost.
    expect(generateMock).toHaveBeenCalledTimes(2);
    expect(Object.keys(result.current.results)).toEqual(['typescript', 'java']);
  });

  it('stops publishing results from a run superseded by a model change', async () => {
    const { result, rerender } = render({ 'org.a@1.0.0': 'v1' });
    act(() => vi.advanceTimersByTime(DEBOUNCE_MS));
    expect(generateMock).toHaveBeenCalledTimes(1);

    // The model changes while the first target is still generating.
    rerender({ models: { 'org.a@1.0.0': 'v2' }, enabled: true });
    await resolveNext('stale');

    // The stale result is dropped and the superseded run stops.
    expect(result.current.results).toEqual({});
    expect(generateMock).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(DEBOUNCE_MS));
    expect(generateMock).toHaveBeenCalledTimes(2);
    expect(generateMock.mock.calls[1][0]).toEqual(['v2']);
    await resolveNext('fresh');
    expect(result.current.results.typescript).toEqual({ code: 'fresh' });
  });
});
