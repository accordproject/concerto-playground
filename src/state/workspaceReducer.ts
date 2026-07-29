// The workspace is the map of open models keyed by namespace plus the
// namespace currently being edited. Every mutation the app can perform on it
// lives here as a pure reducer action, so the transitions are unit-testable
// and App.tsx stays a thin orchestrator.

import { extractNamespace } from '../utils/import/importInference';

export { extractNamespace };

export interface WorkspaceState {
  /** CTO source per open namespace. */
  models: Record<string, string>;
  /** The namespace the single-model views (graph, CTO editor) show. */
  activeNamespace: string;
}

export type WorkspaceAction =
  | { type: 'namespace-activated'; ns: string }
  /** Update one namespace's CTO. Empty cto deletes it; a CTO whose namespace
      declaration changed migrates the entry to the new key. */
  | { type: 'model-changed'; ns: string; cto: string }
  | { type: 'namespace-added'; ns: string; cto: string }
  | { type: 'namespace-removed'; ns: string }
  /** Load a built-in example. Untouched examples (still matching a source in
      `pristineSources`) are swapped out; edited ones and user namespaces stay. */
  | { type: 'example-loaded'; source: string; pristineSources: ReadonlyMap<string, string> }
  /** Merge imported CTO sources and activate the first one. Imports that
      replace the current model (JSON object / JSON Schema inference) close
      the active namespace first. */
  | { type: 'models-imported'; sources: string[]; replaceActiveNamespace?: boolean }
  /** Replace the whole workspace with a persisted snapshot. */
  | { type: 'snapshot-restored'; models: Record<string, string> };

/** Active namespace after `ns` disappeared: first remaining, else unchanged. */
function fallbackActive(models: Record<string, string>, removed: string, current: string): string {
  if (removed !== current) return current;
  const remaining = Object.keys(models);
  return remaining.length > 0 ? remaining[0] : current;
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'namespace-activated':
      return { ...state, activeNamespace: action.ns };

    case 'model-changed': {
      const { ns, cto } = action;
      const models = { ...state.models };
      if (!cto) {
        delete models[ns];
        return { models, activeNamespace: fallbackActive(models, ns, state.activeNamespace) };
      }
      const parsedNs = extractNamespace(cto);
      if (parsedNs !== ns && models[ns] !== undefined) {
        delete models[ns];
        models[parsedNs] = cto;
        return {
          models,
          activeNamespace: state.activeNamespace === ns ? parsedNs : state.activeNamespace,
        };
      }
      models[ns] = cto;
      return { ...state, models };
    }

    case 'namespace-added':
      return {
        models: { ...state.models, [action.ns]: action.cto },
        activeNamespace: action.ns,
      };

    case 'namespace-removed': {
      const models = { ...state.models };
      delete models[action.ns];
      return { models, activeNamespace: fallbackActive(models, action.ns, state.activeNamespace) };
    }

    case 'example-loaded': {
      const targetNs = extractNamespace(action.source);
      const models: Record<string, string> = {};
      for (const [ns, cto] of Object.entries(state.models)) {
        if (action.pristineSources.get(ns) !== cto) models[ns] = cto;
      }
      models[targetNs] = state.models[targetNs] ?? action.source;
      return { models, activeNamespace: targetNs };
    }

    case 'models-imported': {
      if (action.sources.length === 0) return state;
      const models = { ...state.models };
      if (action.replaceActiveNamespace) delete models[state.activeNamespace];
      for (const cto of action.sources) models[extractNamespace(cto)] = cto;
      return { models, activeNamespace: extractNamespace(action.sources[0]) };
    }

    case 'snapshot-restored':
      return {
        models: action.models,
        activeNamespace: Object.keys(action.models)[0] ?? state.activeNamespace,
      };
  }
}
