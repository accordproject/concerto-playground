// Form view adapted from accordproject/lab-concerto-editor-web (Dan Selman <danscode@selman.org>, Ayman)

import { useState, useEffect, useId } from 'react';
import type { ConcertoModel, Declaration, Property } from '../../utils/graph/types';
import { ALL_TYPES, PRIMITIVE_TYPES, getAvailableTypes, getExtendsCandidates } from '../../utils/graph/types';
import { declarationsToCto } from '../../utils/graph/graphToCto';
import type { FormSel } from './FormView';
import { identifierError, namespaceError } from './validation';
import { COLOR } from './theme';
import { FORM_STRINGS } from '../../constants/ui';

const cardStyle: React.CSSProperties = {
  background: COLOR.panel,
  border: `1px solid ${COLOR.border}`,
  borderRadius: 8,
  padding: 16,
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: COLOR.bg,
  color: COLOR.text,
  border: `1px solid ${COLOR.border}`,
  borderRadius: 6,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: COLOR.muted,
  marginBottom: 4,
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  fontWeight: 600,
};

const btnPrimary: React.CSSProperties = {
  background: COLOR.blue,
  color: COLOR.text,
  border: 'none',
  borderRadius: 6,
  padding: '7px 16px',
  fontSize: 12,
  cursor: 'pointer',
  fontWeight: 600,
};

const btnDanger: React.CSSProperties = {
  background: 'transparent',
  color: COLOR.red,
  border: `1px solid ${COLOR.red}`,
  borderRadius: 6,
  padding: '7px 16px',
  fontSize: 12,
  cursor: 'pointer',
  fontWeight: 600,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

const checkboxRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: COLOR.text,
};

// ─── helpers ───────────────────────────────────────────────────────────────────

function updateDecl(
  model: ConcertoModel,
  declName: string,
  updater: (d: Declaration) => Declaration,
): string {
  const updated = { ...model, declarations: model.declarations.map((d) => d.name === declName ? updater(d) : d) };
  return declarationsToCto(updated);
}

function updateProp(
  model: ConcertoModel,
  declName: string,
  propName: string,
  updater: (p: Property) => Property,
): string {
  return updateDecl(model, declName, (d) => ({
    ...d,
    properties: d.properties.map((p) => p.name === propName ? updater(p) : p),
  }));
}

// ─── Field wrapper ──────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  );
}

// Validated name field

interface ValidatedName {
  value: string;
  error: string | null;
  onChange: (v: string) => void;
  /** Validates the trimmed value: returns it if valid, else shows the error and returns null. */
  check: () => string | null;
}

// One shared state + validation flow for every name-like input in the sheet:
// typing clears the error, check() runs on Save and blocks it with a format hint.
function useValidatedName(initial: string, validate: (v: string) => string | null): ValidatedName {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setValue(initial); setError(null); }, [initial]);

  return {
    value,
    error,
    onChange: (v) => { setValue(v); setError(null); },
    check: () => {
      const trimmed = value.trim();
      const err = validate(trimmed);
      if (err) { setError(err); return null; }
      return trimmed;
    },
  };
}

function NameField({ label, field, placeholder }: { label: string; field: ValidatedName; placeholder?: string }) {
  return (
    <>
      <Field label={label}>
        <input
          style={inputStyle}
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          placeholder={placeholder}
        />
      </Field>
      {field.error && (
        <div role="alert" style={{ color: COLOR.red, fontSize: 12, lineHeight: 1.5, marginTop: -6, marginBottom: 12 }}>
          {field.error}
        </div>
      )}
    </>
  );
}

// ─── Placeholder ────────────────────────────────────────────────────────────────

function Placeholder() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: COLOR.muted, fontSize: 14 }}>
      {FORM_STRINGS.placeholder}
    </div>
  );
}

// ─── NamespaceForm ──────────────────────────────────────────────────────────────

function NamespaceForm({
  ns,
  model,
  onModelChange,
  onRemoveNamespace,
}: {
  ns: string;
  model: ConcertoModel;
  onModelChange: (ns: string, newCto: string) => void;
  onRemoveNamespace: (ns: string) => void;
}) {
  const name = useValidatedName(ns, namespaceError);

  function handleSave() {
    const trimmed = name.check();
    if (trimmed === null || trimmed === ns) return;
    // Build new model with new namespace and regenerate CTO
    const newModel: ConcertoModel = { ...model, namespace: trimmed };
    const newCto = declarationsToCto(newModel);
    // Delete old ns, add new
    onModelChange(ns, '');
    onModelChange(trimmed, newCto);
  }

  return (
    <div style={cardStyle}>
      <NameField label={FORM_STRINGS.sectionNamespace} field={name} placeholder={FORM_STRINGS.namespacePlaceholder} />
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button style={btnPrimary} onClick={handleSave}>{FORM_STRINGS.save}</button>
        <button style={btnDanger} onClick={() => onRemoveNamespace(ns)}>{FORM_STRINGS.delete}</button>
      </div>
    </div>
  );
}

// ─── EnumForm ───────────────────────────────────────────────────────────────────

function EnumForm({
  ns,
  decl,
  model,
  onModelChange,
}: {
  ns: string;
  decl: Declaration;
  model: ConcertoModel;
  onModelChange: (ns: string, newCto: string) => void;
}) {
  const name = useValidatedName(decl.name, identifierError);

  function handleSave() {
    const trimmed = name.check();
    if (trimmed === null) return;
    const cto = updateDecl(model, decl.name, (d) => ({ ...d, name: trimmed }));
    onModelChange(ns, cto);
  }

  function handleDelete() {
    const updated = { ...model, declarations: model.declarations.filter((d) => d.name !== decl.name) };
    onModelChange(ns, declarationsToCto(updated));
  }

  function handleDeleteValue(val: string) {
    const cto = updateDecl(model, decl.name, (d) => ({ ...d, enumValues: d.enumValues.filter((v) => v !== val) }));
    onModelChange(ns, cto);
  }

  return (
    <div>
      <div style={cardStyle}>
        <NameField label={FORM_STRINGS.fieldName} field={name} placeholder={FORM_STRINGS.enumNamePlaceholder} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnPrimary} onClick={handleSave}>{FORM_STRINGS.save}</button>
          <button style={btnDanger} onClick={handleDelete}>{FORM_STRINGS.delete}</button>
        </div>
      </div>

      <div style={cardStyle}>
        <span style={labelStyle}>{FORM_STRINGS.enumValuesLabel}</span>
        {decl.enumValues.length === 0 && (
          <div style={{ color: COLOR.muted, fontSize: 12, padding: '4px 0' }}>{FORM_STRINGS.noValuesYet}</div>
        )}
        {decl.enumValues.map((val) => (
          <div key={val} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${COLOR.border}` }}>
            <span style={{ fontSize: 13, color: COLOR.text }}>{val}</span>
            <button
              onClick={() => handleDeleteValue(val)}
              style={{ background: 'transparent', border: 'none', color: COLOR.red, cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ConceptForm ─────────────────────────────────────────────────────────────────

function ConceptForm({
  ns,
  decl,
  model,
  onModelChange,
}: {
  ns: string;
  decl: Declaration;
  model: ConcertoModel;
  onModelChange: (ns: string, newCto: string) => void;
}) {
  const abstractId = useId();
  const name = useValidatedName(decl.name, identifierError);
  const identifiedBy = useValidatedName(decl.identifiedBy ?? '', identifierError);
  const [isAbstract, setIsAbstract] = useState(decl.isAbstract);
  const [superType, setSuperType] = useState(decl.superType ?? '');
  const [identified, setIdentified] = useState(decl.identified);

  useEffect(() => {
    setIsAbstract(decl.isAbstract);
    setSuperType(decl.superType ?? '');
    setIdentified(decl.identified);
  }, [decl.isAbstract, decl.superType, decl.identified]);

  const extendsCandidates = getExtendsCandidates(model.declarations, decl.name);

  function handleSave() {
    const trimmed = name.check();
    if (trimmed === null) return;
    const trimmedIdBy = identified === 'identified-by' ? identifiedBy.check() : undefined;
    if (identified === 'identified-by' && trimmedIdBy === null) return;
    const cto = updateDecl(model, decl.name, (d) => ({
      ...d,
      name: trimmed,
      isAbstract,
      superType: superType || undefined,
      identified,
      identifiedBy: trimmedIdBy ?? undefined,
    }));
    onModelChange(ns, cto);
  }

  function handleDelete() {
    const updated = { ...model, declarations: model.declarations.filter((d) => d.name !== decl.name) };
    onModelChange(ns, declarationsToCto(updated));
  }

  return (
    <div style={cardStyle}>
      <NameField label={FORM_STRINGS.fieldName} field={name} placeholder={FORM_STRINGS.conceptNamePlaceholder} />

      <Field label={FORM_STRINGS.fieldType}>
        <span style={{ fontSize: 13, color: COLOR.muted, textTransform: 'capitalize' }}>{decl.type}</span>
      </Field>

      <Field label={FORM_STRINGS.fieldExtends}>
        <select style={selectStyle} value={superType} onChange={(e) => setSuperType(e.target.value)}>
          <option value="">{FORM_STRINGS.extendsNone}</option>
          {extendsCandidates.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <Field label={FORM_STRINGS.fieldIdentified}>
        <select style={selectStyle} value={identified} onChange={(e) => setIdentified(e.target.value as typeof identified)}>
          <option value="none">{FORM_STRINGS.identifiedNone}</option>
          <option value="identified">{FORM_STRINGS.identifiedSystem}</option>
          <option value="identified-by">{FORM_STRINGS.identifiedByField}</option>
        </select>
      </Field>

      {identified === 'identified-by' && (
        <NameField label={FORM_STRINGS.fieldIdentifiedBy} field={identifiedBy} placeholder={FORM_STRINGS.identifiedByPlaceholder} />
      )}

      <div style={{ ...checkboxRowStyle, marginBottom: 12 }}>
        <input
          type="checkbox"
          id={abstractId}
          checked={isAbstract}
          onChange={(e) => setIsAbstract(e.target.checked)}
          style={{ width: 14, height: 14, accentColor: COLOR.blue }}
        />
        <label htmlFor={abstractId} style={{ cursor: 'pointer' }}>{FORM_STRINGS.abstract}</label>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btnPrimary} onClick={handleSave}>{FORM_STRINGS.save}</button>
        <button style={btnDanger} onClick={handleDelete}>{FORM_STRINGS.delete}</button>
      </div>
    </div>
  );
}

// ─── PropertyForm ────────────────────────────────────────────────────────────────

function PropertyForm({
  ns,
  decl,
  prop,
  model,
  onModelChange,
}: {
  ns: string;
  decl: Declaration;
  prop: Property;
  model: ConcertoModel;
  onModelChange: (ns: string, newCto: string) => void;
}) {
  const name = useValidatedName(prop.name, identifierError);
  const [type, setType] = useState(prop.type);
  const [isOptional, setIsOptional] = useState(prop.isOptional);
  const [isArray, setIsArray] = useState(prop.isArray);
  const [isRelationship, setIsRelationship] = useState(prop.isRelationship);

  useEffect(() => {
    setType(prop.type);
    setIsOptional(prop.isOptional);
    setIsArray(prop.isArray);
    setIsRelationship(prop.isRelationship);
  }, [prop.type, prop.isOptional, prop.isArray, prop.isRelationship]);

  const availableTypes = getAvailableTypes(model.declarations, decl.name);
  const isPrimitive = PRIMITIVE_TYPES.has(type);

  function handleSave() {
    const trimmed = name.check();
    if (trimmed === null) return;
    const cto = updateProp(model, decl.name, prop.name, (p) => ({
      ...p,
      name: trimmed,
      type,
      isOptional,
      isArray,
      isRelationship: !isPrimitive && isRelationship,
      validators: p.validators,
    }));
    onModelChange(ns, cto);
  }

  function handleDelete() {
    const cto = updateDecl(model, decl.name, (d) => ({
      ...d,
      properties: d.properties.filter((p) => p.name !== prop.name),
    }));
    onModelChange(ns, cto);
  }

  return (
    <div style={cardStyle}>
      <NameField label={FORM_STRINGS.fieldName} field={name} placeholder={FORM_STRINGS.propertyNamePlaceholder} />

      <Field label={FORM_STRINGS.fieldType}>
        <select style={selectStyle} value={type} onChange={(e) => { setType(e.target.value); if (PRIMITIVE_TYPES.has(e.target.value)) setIsRelationship(false); }}>
          {availableTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        <label style={checkboxRowStyle}>
          <input
            type="checkbox"
            checked={isOptional}
            onChange={(e) => setIsOptional(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: COLOR.blue }}
          />
          {FORM_STRINGS.optional}
        </label>

        <label style={checkboxRowStyle}>
          <input
            type="checkbox"
            checked={isArray}
            onChange={(e) => setIsArray(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: COLOR.blue }}
          />
          {FORM_STRINGS.array}
        </label>

        {!isPrimitive && (
          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={isRelationship}
              onChange={(e) => setIsRelationship(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: COLOR.blue }}
            />
            {FORM_STRINGS.relationship}
          </label>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btnPrimary} onClick={handleSave}>{FORM_STRINGS.save}</button>
        <button style={btnDanger} onClick={handleDelete}>{FORM_STRINGS.delete}</button>
      </div>
    </div>
  );
}

// ─── EnumValueForm ───────────────────────────────────────────────────────────────

function EnumValueForm({
  ns,
  decl,
  value,
  model,
  onModelChange,
}: {
  ns: string;
  decl: Declaration;
  value: string;
  model: ConcertoModel;
  onModelChange: (ns: string, newCto: string) => void;
}) {
  const name = useValidatedName(value, identifierError);

  function handleSave() {
    const trimmed = name.check();
    if (trimmed === null || trimmed === value) return;
    const cto = updateDecl(model, decl.name, (d) => ({
      ...d,
      enumValues: d.enumValues.map((v) => v === value ? trimmed : v),
    }));
    onModelChange(ns, cto);
  }

  function handleDelete() {
    const cto = updateDecl(model, decl.name, (d) => ({
      ...d,
      enumValues: d.enumValues.filter((v) => v !== value),
    }));
    onModelChange(ns, cto);
  }

  return (
    <div style={cardStyle}>
      <NameField label={FORM_STRINGS.fieldValueName} field={name} placeholder={FORM_STRINGS.enumValuePlaceholder} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btnPrimary} onClick={handleSave}>{FORM_STRINGS.save}</button>
        <button style={btnDanger} onClick={handleDelete}>{FORM_STRINGS.delete}</button>
      </div>
    </div>
  );
}

// ─── PropertySheet (main export) ─────────────────────────────────────────────────

interface PropertySheetProps {
  selection: FormSel;
  models: Record<string, ConcertoModel>;
  onModelChange: (ns: string, newCto: string) => void;
  onRemoveNamespace: (ns: string) => void;
}

export function PropertySheet({ selection, models, onModelChange, onRemoveNamespace }: PropertySheetProps) {
  const containerStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: 16,
    background: COLOR.bg,
  };

  if (selection.kind === 'none') {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Placeholder />
      </div>
    );
  }

  if (selection.kind === 'namespace') {
    const ns = selection.ns;
    const model = models[ns];
    if (!model) return <div style={containerStyle}><Placeholder /></div>;
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: 13, color: COLOR.muted, marginBottom: 12 }}>{FORM_STRINGS.sectionNamespace}</div>
        <NamespaceForm key={ns} ns={ns} model={model} onModelChange={onModelChange} onRemoveNamespace={onRemoveNamespace} />
      </div>
    );
  }

  if (selection.kind === 'decl') {
    const { ns, declName } = selection;
    const model = models[ns];
    if (!model) return <div style={containerStyle}><Placeholder /></div>;
    const decl = model.declarations.find((d) => d.name === declName);
    if (!decl) return <div style={containerStyle}><Placeholder /></div>;

    return (
      <div style={containerStyle}>
        <div style={{ fontSize: 13, color: COLOR.muted, marginBottom: 12 }}>
          {decl.type === 'enum' ? FORM_STRINGS.sectionEnum : FORM_STRINGS.sectionDeclaration}
        </div>
        {decl.type === 'enum'
          ? <EnumForm key={`${ns}:${decl.name}`} ns={ns} decl={decl} model={model} onModelChange={onModelChange} />
          : <ConceptForm key={`${ns}:${decl.name}`} ns={ns} decl={decl} model={model} onModelChange={onModelChange} />
        }
      </div>
    );
  }

  if (selection.kind === 'prop') {
    const { ns, declName, propName } = selection;
    const model = models[ns];
    if (!model) return <div style={containerStyle}><Placeholder /></div>;
    const decl = model.declarations.find((d) => d.name === declName);
    if (!decl) return <div style={containerStyle}><Placeholder /></div>;
    const prop = decl.properties.find((p) => p.name === propName);
    if (!prop) return <div style={containerStyle}><Placeholder /></div>;

    return (
      <div style={containerStyle}>
        <div style={{ fontSize: 13, color: COLOR.muted, marginBottom: 12 }}>{FORM_STRINGS.sectionProperty}</div>
        <PropertyForm key={`${ns}:${decl.name}:${prop.name}`} ns={ns} decl={decl} prop={prop} model={model} onModelChange={onModelChange} />
      </div>
    );
  }

  if (selection.kind === 'enumVal') {
    const { ns, declName, value } = selection;
    const model = models[ns];
    if (!model) return <div style={containerStyle}><Placeholder /></div>;
    const decl = model.declarations.find((d) => d.name === declName);
    if (!decl) return <div style={containerStyle}><Placeholder /></div>;

    return (
      <div style={containerStyle}>
        <div style={{ fontSize: 13, color: COLOR.muted, marginBottom: 12 }}>{FORM_STRINGS.sectionEnumValue}</div>
        <EnumValueForm key={`${ns}:${decl.name}:${value}`} ns={ns} decl={decl} value={value} model={model} onModelChange={onModelChange} />
      </div>
    );
  }

  return <div style={containerStyle}><Placeholder /></div>;
}
