// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { NodeChange, Node } from "@xyflow/react";
import { useRafBatchedNodeChanges } from "../../hooks/useRafBatchedNodeChanges";

// requestAnimationFrame controlled by hand: frames fire only when the test
// calls fireFrame(), so batching behavior is observable deterministically.
let frameCallbacks: Map<number, FrameRequestCallback>;
let nextFrameId: number;

function fireFrame() {
  const callbacks = [...frameCallbacks.values()];
  frameCallbacks.clear();
  for (const cb of callbacks) cb(performance.now());
}

const change = (id: string, x: number): NodeChange<Node> => ({
  id,
  type: "position",
  position: { x, y: 0 },
});

describe("useRafBatchedNodeChanges", () => {
  beforeEach(() => {
    frameCallbacks = new Map();
    nextFrameId = 1;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      const id = nextFrameId++;
      frameCallbacks.set(id, cb);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      frameCallbacks.delete(id);
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies nothing before the frame fires", () => {
    const apply = vi.fn();
    const { result } = renderHook(() => useRafBatchedNodeChanges(apply));

    result.current([change("a", 1)]);
    expect(apply).not.toHaveBeenCalled();
  });

  it("batches all changes from one frame into a single apply call, in order", () => {
    const apply = vi.fn();
    const { result } = renderHook(() => useRafBatchedNodeChanges(apply));

    result.current([change("a", 1)]);
    result.current([change("b", 2), change("a", 3)]);
    result.current([change("a", 4)]);
    fireFrame();

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith([
      change("a", 1),
      change("b", 2),
      change("a", 3),
      change("a", 4),
    ]);
  });

  it("changes after a frame fired go into the next frame", () => {
    const apply = vi.fn();
    const { result } = renderHook(() => useRafBatchedNodeChanges(apply));

    result.current([change("a", 1)]);
    fireFrame();
    result.current([change("a", 2)]);
    fireFrame();

    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenNthCalledWith(2, [change("a", 2)]);
  });

  it("cancels the pending frame and drops the queue on unmount", () => {
    const apply = vi.fn();
    const { result, unmount } = renderHook(() => useRafBatchedNodeChanges(apply));

    result.current([change("a", 1)]);
    unmount();
    fireFrame();

    expect(apply).not.toHaveBeenCalled();
  });
});
