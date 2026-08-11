import { useCallback, useReducer } from 'react';
import { workspaceReducer, type WorkspaceState } from '../state/workspaceReducer';
import { EXAMPLE_SOURCES } from '../examples/catalog';

function newNamespaceStub(ns: string): string {
  return `namespace ${ns}\n\nconcept Example {\n  o String name\n}\n`;
}

/**
 * The workspace state (open models + active namespace) behind the pure
 * reducer in state/workspaceReducer.ts, exposed as stable callbacks.
 */
export function useWorkspace(initialModels: Record<string, string>) {
  const [state, dispatch] = useReducer(
    workspaceReducer,
    undefined,
    (): WorkspaceState => ({
      models: initialModels,
      activeNamespace: Object.keys(initialModels)[0],
    }),
  );

  const setActiveNamespace = useCallback(
    (ns: string) => dispatch({ type: 'namespace-activated', ns }),
    [],
  );
  const changeModel = useCallback(
    (ns: string, cto: string) => dispatch({ type: 'model-changed', ns, cto }),
    [],
  );
  const addNamespace = useCallback(() => {
    const ns = `org.example.new${Date.now()}@1.0.0`;
    dispatch({ type: 'namespace-added', ns, cto: newNamespaceStub(ns) });
  }, []);
  const removeNamespace = useCallback(
    (ns: string) => dispatch({ type: 'namespace-removed', ns }),
    [],
  );
  const loadExample = useCallback(
    (source: string) =>
      dispatch({ type: 'example-loaded', source, pristineSources: EXAMPLE_SOURCES }),
    [],
  );
  const importModels = useCallback(
    (sources: string[], options?: { replaceNamespace?: string }) =>
      dispatch({
        type: 'models-imported',
        sources,
        replaceNamespace: options?.replaceNamespace,
      }),
    [],
  );
  const restoreSnapshot = useCallback(
    (models: Record<string, string>) => dispatch({ type: 'snapshot-restored', models }),
    [],
  );

  return {
    models: state.models,
    activeNamespace: state.activeNamespace,
    setActiveNamespace,
    changeModel,
    addNamespace,
    removeNamespace,
    loadExample,
    importModels,
    restoreSnapshot,
  };
}
