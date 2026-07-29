import { describe, it, expect } from 'vitest';
import {
  workspaceReducer,
  extractNamespace,
  type WorkspaceState,
} from '../../state/workspaceReducer';

const NS_A = 'org.a@1.0.0';
const NS_B = 'org.b@1.0.0';
const ctoFor = (ns: string, body = '') => `namespace ${ns}\n${body}`;

function state(models: Record<string, string>, activeNamespace?: string): WorkspaceState {
  return { models, activeNamespace: activeNamespace ?? Object.keys(models)[0] };
}

describe('extractNamespace', () => {
  it('reads the namespace declaration', () => {
    expect(extractNamespace(ctoFor(NS_A))).toBe(NS_A);
  });

  it('ignores namespace mentions inside comments', () => {
    const cto = `/* namespace org.fake@9.9.9 */\n// namespace org.other@1.0.0\nnamespace ${NS_A}\n`;
    expect(extractNamespace(cto)).toBe(NS_A);
  });

  it('falls back to a placeholder when no namespace is declared', () => {
    expect(extractNamespace('concept X {}')).toBe('org.example.unknown@1.0.0');
  });
});

describe('workspaceReducer', () => {
  it('activates a namespace', () => {
    const next = workspaceReducer(state({ [NS_A]: 'a', [NS_B]: 'b' }, NS_A), {
      type: 'namespace-activated',
      ns: NS_B,
    });
    expect(next.activeNamespace).toBe(NS_B);
  });

  it('updates a model in place when its namespace is unchanged', () => {
    const cto = ctoFor(NS_A, 'concept X {}');
    const next = workspaceReducer(state({ [NS_A]: ctoFor(NS_A) }), {
      type: 'model-changed',
      ns: NS_A,
      cto,
    });
    expect(next.models).toEqual({ [NS_A]: cto });
    expect(next.activeNamespace).toBe(NS_A);
  });

  it('migrates the entry and the active namespace when the declaration is renamed', () => {
    const renamed = ctoFor(NS_B);
    const next = workspaceReducer(state({ [NS_A]: ctoFor(NS_A) }, NS_A), {
      type: 'model-changed',
      ns: NS_A,
      cto: renamed,
    });
    expect(next.models).toEqual({ [NS_B]: renamed });
    expect(next.activeNamespace).toBe(NS_B);
  });

  it('keeps the active namespace when a background model is renamed', () => {
    const renamed = ctoFor('org.c@1.0.0');
    const next = workspaceReducer(state({ [NS_A]: ctoFor(NS_A), [NS_B]: ctoFor(NS_B) }, NS_A), {
      type: 'model-changed',
      ns: NS_B,
      cto: renamed,
    });
    expect(next.activeNamespace).toBe(NS_A);
    expect(Object.keys(next.models)).toEqual([NS_A, 'org.c@1.0.0']);
  });

  it('deletes a model on empty CTO and falls back to the first remaining namespace', () => {
    const next = workspaceReducer(state({ [NS_A]: 'a', [NS_B]: 'b' }, NS_A), {
      type: 'model-changed',
      ns: NS_A,
      cto: '',
    });
    expect(next.models).toEqual({ [NS_B]: 'b' });
    expect(next.activeNamespace).toBe(NS_B);
  });

  it('adds and activates a new namespace', () => {
    const next = workspaceReducer(state({ [NS_A]: 'a' }), {
      type: 'namespace-added',
      ns: NS_B,
      cto: ctoFor(NS_B),
    });
    expect(next.models[NS_B]).toBe(ctoFor(NS_B));
    expect(next.activeNamespace).toBe(NS_B);
  });

  it('removes a namespace and keeps the active one when it was not removed', () => {
    const next = workspaceReducer(state({ [NS_A]: 'a', [NS_B]: 'b' }, NS_A), {
      type: 'namespace-removed',
      ns: NS_B,
    });
    expect(next.models).toEqual({ [NS_A]: 'a' });
    expect(next.activeNamespace).toBe(NS_A);
  });

  describe('example-loaded', () => {
    const exampleNs = 'org.example.nda@1.0.0';
    const pristine = ctoFor(exampleNs, 'concept Nda {}');
    const pristineSources = new Map([[exampleNs, pristine]]);

    it('swaps out an untouched example and keeps user namespaces', () => {
      const userCto = ctoFor(NS_A);
      const target = ctoFor(NS_B);
      const next = workspaceReducer(state({ [exampleNs]: pristine, [NS_A]: userCto }, NS_A), {
        type: 'example-loaded',
        source: target,
        pristineSources,
      });
      expect(next.models).toEqual({ [NS_A]: userCto, [NS_B]: target });
      expect(next.activeNamespace).toBe(NS_B);
    });

    it('keeps an edited example open as a tab', () => {
      const edited = pristine + '\nconcept Extra {}';
      const target = ctoFor(NS_B);
      const next = workspaceReducer(state({ [exampleNs]: edited }, exampleNs), {
        type: 'example-loaded',
        source: target,
        pristineSources,
      });
      expect(next.models[exampleNs]).toBe(edited);
      expect(next.models[NS_B]).toBe(target);
    });

    it('reuses the already-open edited copy when reloading the same example', () => {
      const edited = pristine + '\nconcept Extra {}';
      const next = workspaceReducer(state({ [exampleNs]: edited }, exampleNs), {
        type: 'example-loaded',
        source: pristine,
        pristineSources,
      });
      expect(next.models[exampleNs]).toBe(edited);
      expect(next.activeNamespace).toBe(exampleNs);
    });
  });

  it('merges imported sources and activates the first one', () => {
    const first = ctoFor(NS_B);
    const second = ctoFor('org.c@1.0.0');
    const next = workspaceReducer(state({ [NS_A]: 'a' }, NS_A), {
      type: 'models-imported',
      sources: [first, second],
    });
    expect(Object.keys(next.models)).toEqual([NS_A, NS_B, 'org.c@1.0.0']);
    expect(next.activeNamespace).toBe(NS_B);
  });

  it('ignores an empty import', () => {
    const before = state({ [NS_A]: 'a' }, NS_A);
    expect(workspaceReducer(before, { type: 'models-imported', sources: [] })).toBe(before);
  });

  it('replaces the workspace with a restored snapshot', () => {
    const next = workspaceReducer(state({ [NS_A]: 'a' }, NS_A), {
      type: 'snapshot-restored',
      models: { [NS_B]: 'b' },
    });
    expect(next.models).toEqual({ [NS_B]: 'b' });
    expect(next.activeNamespace).toBe(NS_B);
  });
});
