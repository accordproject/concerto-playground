// Form view adapted from accordproject/lab-concerto-editor-web (Dan Selman <danscode@selman.org>, Ayman)

import { useMemo, useState } from 'react';
import type { ConcertoModel, Declaration, Property } from '../../utils/graph/types';
import { parseCto } from '../../utils/graph/ctoToGraph';
import { declarationsToCto } from '../../utils/graph/graphToCto';
import { PropertyTree } from './PropertyTree';
import { PropertySheet } from './PropertySheet';
import { COLOR } from './theme';
import { FORM_STRINGS } from '../../constants/ui';

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
  const [saveError, setSaveError] = useState<string | null>(null);

  // Every CTO produced by the form passes through the real Concerto parser
  // before it reaches the app state. Whatever the cause (bad name, duplicate
  // declaration, anything else), invalid CTO is never saved: the save is
  // dropped and Concerto's own error message is shown instead.
  function guardedModelChange(ns: string, newCto: string): boolean {
    if (newCto) {
      try {
        parseCto(newCto);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
        return false;
      }
    }
    setSaveError(null);
    onModelChange(ns, newCto);
    return true;
  }

  function handleSelect(sel: FormSel) {
    setSaveError(null);
    setSelection(sel);
  }

  // Parse all models, gracefully skipping broken ones. Memoized so selection
  // changes do not re-run the parser for every namespace on each render.
  const parsedModels = useMemo(() => {
    const parsed: Record<string, ConcertoModel> = {};
    for (const [ns, cto] of Object.entries(models)) {
      if (!cto) continue;
      const model = parseModelSafe(cto);
      if (model) parsed[ns] = model;
    }
    return parsed;
  }, [models]);

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
    if (guardedModelChange(ns, declarationsToCto(updated))) {
      setSelection({ kind: 'decl', ns, declName: newDecl.name });
    }
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
    if (guardedModelChange(ns, declarationsToCto(updated))) {
      setSelection({ kind: 'prop', ns, declName, propName: newProp.name });
    }
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
    if (guardedModelChange(ns, declarationsToCto(updated))) {
      setSelection({ kind: 'enumVal', ns, declName, value: newVal });
    }
  }

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <PropertyTree
        models={parsedModels}
        selection={selection}
        onSelect={handleSelect}
        onAddNamespace={onAddNamespace}
        onRemoveNamespace={onRemoveNamespace}
        onAddDeclaration={handleAddDeclaration}
        onAddProperty={handleAddProperty}
        onAddEnumValue={handleAddEnumValue}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {saveError && (
          <div
            role="alert"
            style={{
              padding: '8px 16px',
              background: '#3b1f24',
              borderBottom: `1px solid ${COLOR.border}`,
              color: COLOR.red,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {FORM_STRINGS.notSaved(saveError)}
          </div>
        )}
        <PropertySheet
          selection={selection}
          models={parsedModels}
          onModelChange={guardedModelChange}
          onRemoveNamespace={onRemoveNamespace}
        />
      </div>
    </div>
  );
}
