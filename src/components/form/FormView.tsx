// Form view adapted from accordproject/lab-concerto-editor-web (Dan Selman <danscode@selman.org>, Ayman)

import { useState } from 'react';
import type { ConcertoModel, Declaration, Property } from '../../utils/graph/types';
import { parseCto } from '../../utils/graph/ctoToGraph';
import { declarationsToCto } from '../../utils/graph/graphToCto';
import { PropertyTree } from './PropertyTree';
import { PropertySheet } from './PropertySheet';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FormSel =
  | { kind: 'none' }
  | { kind: 'namespace'; ns: string }
  | { kind: 'decl'; ns: string; declName: string }
  | { kind: 'prop'; ns: string; declName: string; propName: string }
  | { kind: 'enumVal'; ns: string; declName: string; value: string };

// ─── FormView ─────────────────────────────────────────────────────────────────

interface FormViewProps {
  models: Record<string, string>;
  onModelChange: (ns: string, newCto: string) => void;
  onAddNamespace: () => void;
  onRemoveNamespace: (ns: string) => void;
}

function parseModelSafe(cto: string): ConcertoModel | null {
  try {
    return parseCto(cto);
  } catch {
    return null;
  }
}

export function FormView({ models, onModelChange, onAddNamespace, onRemoveNamespace }: FormViewProps) {
  const [selection, setSelection] = useState<FormSel>({ kind: 'none' });

  // Parse all models, gracefully skipping broken ones
  const parsedModels: Record<string, ConcertoModel> = {};
  for (const [ns, cto] of Object.entries(models)) {
    if (!cto) continue;
    const parsed = parseModelSafe(cto);
    if (parsed) parsedModels[ns] = parsed;
  }

  function handleAddDeclaration(ns: string) {
    const model = parsedModels[ns];
    if (!model) return;
    const newDecl: Declaration = {
      name: `NewConcept${Date.now() % 10000}`,
      type: 'concept',
      isAbstract: false,
      properties: [],
      enumValues: [],
      identified: 'none',
      decorators: [],
    };
    const updated: ConcertoModel = { ...model, declarations: [...model.declarations, newDecl] };
    onModelChange(ns, declarationsToCto(updated));
    setSelection({ kind: 'decl', ns, declName: newDecl.name });
  }

  function handleAddProperty(ns: string, declName: string) {
    const model = parsedModels[ns];
    if (!model) return;
    const newProp: Property = {
      name: `newProperty${Date.now() % 10000}`,
      type: 'String',
      isOptional: true,
      isArray: false,
      isRelationship: false,
      validators: {},
    };
    const updated: ConcertoModel = {
      ...model,
      declarations: model.declarations.map((d) =>
        d.name === declName ? { ...d, properties: [...d.properties, newProp] } : d
      ),
    };
    onModelChange(ns, declarationsToCto(updated));
    setSelection({ kind: 'prop', ns, declName, propName: newProp.name });
  }

  function handleAddEnumValue(ns: string, declName: string) {
    const model = parsedModels[ns];
    if (!model) return;
    const newVal = `VALUE_${Date.now() % 10000}`;
    const updated: ConcertoModel = {
      ...model,
      declarations: model.declarations.map((d) =>
        d.name === declName ? { ...d, enumValues: [...d.enumValues, newVal] } : d
      ),
    };
    onModelChange(ns, declarationsToCto(updated));
    setSelection({ kind: 'enumVal', ns, declName, value: newVal });
  }

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <PropertyTree
        models={parsedModels}
        selection={selection}
        onSelect={setSelection}
        onAddNamespace={onAddNamespace}
        onRemoveNamespace={onRemoveNamespace}
        onAddDeclaration={handleAddDeclaration}
        onAddProperty={handleAddProperty}
        onAddEnumValue={handleAddEnumValue}
      />
      <PropertySheet
        selection={selection}
        models={parsedModels}
        onModelChange={onModelChange}
        onRemoveNamespace={onRemoveNamespace}
      />
    </div>
  );
}
