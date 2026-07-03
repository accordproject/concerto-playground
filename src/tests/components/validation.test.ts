import { describe, it, expect } from 'vitest';
import { identifierError, namespaceError, suggestIdentifier } from '../../components/form/validation';

describe('identifierError', () => {
  it('accepts valid identifiers', () => {
    expect(identifierError('masinaMea')).toBeNull();
    expect(identifierError('Vehicle')).toBeNull();
    expect(identifierError('_private')).toBeNull();
    expect(identifierError('$dollar')).toBeNull();
    expect(identifierError('VALUE_2')).toBeNull();
  });

  it('rejects empty names', () => {
    expect(identifierError('')).toMatch(/required/);
  });

  it('rejects names with spaces and suggests the camelCase form', () => {
    const err = identifierError('masina mea');
    expect(err).toMatch(/spaces/);
    expect(err).toContain('"masinaMea"');
  });

  it('rejects names with invalid characters', () => {
    expect(identifierError('masina-mea')).toMatch(/single word/);
    expect(identifierError('1masina')).toMatch(/single word/);
    expect(identifierError('ma.sina')).toMatch(/single word/);
  });
});

describe('namespaceError', () => {
  it('accepts valid namespaces', () => {
    expect(namespaceError('org.example')).toBeNull();
    expect(namespaceError('org.example@1.0.0')).toBeNull();
    expect(namespaceError('org.example@1.0.0-beta.1')).toBeNull();
    expect(namespaceError('single')).toBeNull();
  });

  it('rejects empty namespaces', () => {
    expect(namespaceError('')).toMatch(/required/);
  });

  it('rejects namespaces with spaces or bad versions', () => {
    expect(namespaceError('org.my space')).toMatch(/no spaces/);
    expect(namespaceError('org.example@banana')).toMatch(/version/);
    expect(namespaceError('org..example')).toMatch(/dot-separated/);
  });
});

describe('suggestIdentifier', () => {
  it('camelCases multi-word names', () => {
    expect(suggestIdentifier('masina mea')).toBe('masinaMea');
    expect(suggestIdentifier('my  new   car')).toBe('myNewCar');
    expect(suggestIdentifier(' single ')).toBe('single');
  });
});
