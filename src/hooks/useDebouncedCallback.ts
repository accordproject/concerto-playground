import { useCallback, useEffect, useMemo, useRef } from "react";

export interface DebouncedDispatch<T> {
  /** Queues a value; the callback fires with the latest value after the delay. */
  schedule: (value: T) => void;
  /** Dispatches the pending value immediately, if there is one. */
  flush: () => void;
  /** Drops the pending value without dispatching it. */
  cancel: () => void;
  /** Whether a value is queued but not yet dispatched. */
  isPending: () => boolean;
}

/**
 * Trailing-edge debounce for a single-argument callback. A burst of
 * schedule() calls collapses into one invocation with the last value,
 * delayMs after the burst ends. The pending value is flushed on unmount so
 * the final update in a burst is never lost when the component goes away.
 *
 * The returned object and its methods are referentially stable, so they are
 * safe in effect dependency lists and in listeners registered once.
 */
export function useDebouncedCallback<T>(
  callback: (value: T) => void,
  delayMs: number,
): DebouncedDispatch<T> {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<{ value: T } | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    clearTimer();
    pendingRef.current = null;
  }, [clearTimer]);

  const flush = useCallback(() => {
    clearTimer();
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) callbackRef.current(pending.value);
  }, [clearTimer]);

  const schedule = useCallback(
    (value: T) => {
      pendingRef.current = { value };
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        flush();
      }, delayMs);
    },
    [clearTimer, flush, delayMs],
  );

  const isPending = useCallback(() => pendingRef.current !== null, []);

  // Flush on unmount: the last keystrokes of a burst must still reach the
  // callback when the editor closes or the view switches.
  useEffect(() => flush, [flush]);

  return useMemo(
    () => ({ schedule, flush, cancel, isPending }),
    [schedule, flush, cancel, isPending],
  );
}
