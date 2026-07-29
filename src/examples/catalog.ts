import { NDA_EXAMPLE, SERVICE_EXAMPLE, VEHICLES_EXAMPLE } from './nda.cto';
import { extractNamespace } from '../state/workspaceReducer';

/** Built-in example models offered by the toolbar buttons. */
export const EXAMPLES = [
  { label: 'NDA', source: NDA_EXAMPLE },
  { label: 'Vehicles', source: VEHICLES_EXAMPLE },
  { label: 'Service Agreement', source: SERVICE_EXAMPLE },
] as const;

// Pristine source by namespace. Used to tell untouched examples (swappable)
// apart from edited ones (kept open).
export const EXAMPLE_SOURCES: ReadonlyMap<string, string> = new Map(
  EXAMPLES.map((ex) => [extractNamespace(ex.source), ex.source]),
);
