// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback";

describe("useDebouncedCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("collapses a burst of schedule calls into one trailing call with the last value", () => {
    const spy = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback<string>(spy, 300));

    result.current.schedule("a");
    vi.advanceTimersByTime(100);
    result.current.schedule("ab");
    vi.advanceTimersByTime(100);
    result.current.schedule("abc");
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("abc");
  });

  it("flush dispatches the pending value immediately and only once", () => {
    const spy = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback<string>(spy, 300));

    result.current.schedule("abc");
    result.current.flush();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("abc");

    // The timer must not fire a second time after a manual flush.
    vi.advanceTimersByTime(300);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("flush without a pending value does nothing", () => {
    const spy = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback<string>(spy, 300));

    result.current.flush();
    expect(spy).not.toHaveBeenCalled();
  });

  it("cancel drops the pending value without dispatching", () => {
    const spy = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback<string>(spy, 300));

    result.current.schedule("abc");
    result.current.cancel();
    vi.advanceTimersByTime(300);
    expect(spy).not.toHaveBeenCalled();
    expect(result.current.isPending()).toBe(false);
  });

  it("reports pending state while a value is queued", () => {
    const spy = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback<string>(spy, 300));

    expect(result.current.isPending()).toBe(false);
    result.current.schedule("abc");
    expect(result.current.isPending()).toBe(true);
    vi.advanceTimersByTime(300);
    expect(result.current.isPending()).toBe(false);
  });

  it("flushes the pending value on unmount so the last edit is not lost", () => {
    const spy = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback<string>(spy, 300));

    result.current.schedule("abc");
    unmount();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("abc");
  });
});
