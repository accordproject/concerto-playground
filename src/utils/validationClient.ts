import { validateCto } from "./graph/ctoToGraph";
import type { ValidationRequest, ValidationResponse } from "../workers/validation.worker";

/**
 * Runs semantic validation off the main thread. A single worker is created
 * lazily and reused for the lifetime of the page; environments without
 * module workers (unit tests, older browsers) fall back to validating
 * synchronously, so callers always get the same promise-shaped API.
 */

interface PendingRequest {
  source: string;
  peers: string[];
  resolve: (result: string | null) => void;
}

let worker: Worker | null = null;
let workerFailed = false;
let nextRequestId = 0;
const pending = new Map<number, PendingRequest>();

function validateSync(source: string, peers: string[]): string | null {
  // validateCto reports problems as a return value; if it throws anyway,
  // surface the message instead of silently pretending the model is valid.
  try {
    return validateCto(source, peers);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

function getWorker(): Worker | null {
  if (workerFailed || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("../workers/validation.worker.ts", import.meta.url), { type: "module" });
  } catch {
    workerFailed = true;
    return null;
  }
  worker.onmessage = (event: MessageEvent<ValidationResponse>) => {
    const request = pending.get(event.data.id);
    if (!request) return;
    pending.delete(event.data.id);
    request.resolve(event.data.result);
  };
  worker.onerror = () => {
    // The worker script itself failed to load or crashed. Answer everything
    // waiting on it on the main thread and stop using the worker for good.
    workerFailed = true;
    worker?.terminate();
    worker = null;
    const stalled = Array.from(pending.values());
    pending.clear();
    stalled.forEach((request) => request.resolve(validateSync(request.source, request.peers)));
  };
  return worker;
}

export function validateInBackground(source: string, peers: string[] = []): Promise<string | null> {
  const activeWorker = getWorker();
  if (!activeWorker) return Promise.resolve(validateSync(source, peers));
  const id = ++nextRequestId;
  return new Promise((resolve) => {
    pending.set(id, { source, peers, resolve });
    const request: ValidationRequest = { id, source, peers };
    activeWorker.postMessage(request);
  });
}
