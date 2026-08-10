import { validateCto } from "../utils/graph/ctoToGraph";

export interface ValidationRequest {
  id: number;
  source: string;
  peers: string[];
}

export interface ValidationResponse {
  id: number;
  result: string | null;
}

// The ModelManager pass is CPU bound and touches no DOM state, which is what
// lets it run here instead of on the thread that paints the page.
self.onmessage = (event: MessageEvent<ValidationRequest>) => {
  const { id, source, peers } = event.data;
  let result: string | null;
  try {
    result = validateCto(source, peers);
  } catch (e) {
    result = e instanceof Error ? e.message : String(e);
  }
  (self as unknown as { postMessage(message: ValidationResponse): void }).postMessage({ id, result });
};
