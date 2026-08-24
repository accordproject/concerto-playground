import type { Declaration, Decorator, Property, PropertyValidator } from './types';

/**
 * Structural equality helpers for the parsed model.
 *
 * Every accepted edit re-parses the CTO source, which produces brand new
 * declaration objects even when their content did not change. These
 * comparisons let the graph reuse existing node objects (and let memoized
 * node components skip re-rendering) whenever a declaration is unchanged,
 * so editing one declaration does not repaint the whole canvas.
 */

export function stringArrayEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function validatorsEqual(a: PropertyValidator | undefined, b: PropertyValidator | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return !a === !b;
  return (
    a.default === b.default &&
    a.regex === b.regex &&
    a.range === b.range &&
    a.length === b.length
  );
}

function propertyEqual(a: Property, b: Property): boolean {
  return (
    a.name === b.name &&
    a.type === b.type &&
    a.typeNamespace === b.typeNamespace &&
    a.isOptional === b.isOptional &&
    a.isArray === b.isArray &&
    a.isRelationship === b.isRelationship &&
    validatorsEqual(a.validators, b.validators)
  );
}

function decoratorEqual(a: Decorator, b: Decorator): boolean {
  return a.name === b.name && stringArrayEqual(a.args, b.args);
}

/** Whether two declarations have identical content (order-sensitive on lists). */
export function declarationEqual(a: Declaration, b: Declaration): boolean {
  if (a === b) return true;
  if (
    a.name !== b.name ||
    a.type !== b.type ||
    a.isAbstract !== b.isAbstract ||
    a.superType !== b.superType ||
    a.superTypeNamespace !== b.superTypeNamespace ||
    a.scalarExtends !== b.scalarExtends ||
    a.identified !== b.identified ||
    a.identifiedBy !== b.identifiedBy
  ) {
    return false;
  }
  if (!validatorsEqual(a.scalarValidators, b.scalarValidators)) return false;
  if ((a.mapDeclaration === undefined) !== (b.mapDeclaration === undefined)) return false;
  if (
    a.mapDeclaration &&
    b.mapDeclaration &&
    (a.mapDeclaration.keyType !== b.mapDeclaration.keyType ||
      a.mapDeclaration.valueType !== b.mapDeclaration.valueType)
  ) {
    return false;
  }
  if (!stringArrayEqual(a.enumValues, b.enumValues)) return false;
  if (a.properties.length !== b.properties.length) return false;
  for (let i = 0; i < a.properties.length; i++) {
    if (!propertyEqual(a.properties[i], b.properties[i])) return false;
  }
  if (a.decorators.length !== b.decorators.length) return false;
  for (let i = 0; i < a.decorators.length; i++) {
    if (!decoratorEqual(a.decorators[i], b.decorators[i])) return false;
  }
  return true;
}
