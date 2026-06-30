import type { ConcertoModel, Declaration, Property, PropertyValidator, Decorator } from './types';

import { Printer as PrinterModule } from '@accordproject/concerto-cto';
const META = 'concerto.metamodel@1.0.0';

export function declarationsToCto(model: ConcertoModel): string {
  const ast = modelToMetamodel(model);
  return PrinterModule.toCTO(ast);
}

function modelToMetamodel(model: ConcertoModel): any {
  return {
    namespace: model.namespace,
    imports: model.imports.map(importToAst),
    declarations: model.declarations.map(declarationToAst),
  };
}

function importToAst(imp: { namespace: string; types: string[]; uri?: string }): any {
  if (imp.types.length === 1 && imp.types[0] === '*') {
    return imp.uri
      ? { $class: `${META}.ImportAllFrom`, namespace: imp.namespace, uri: imp.uri }
      : { $class: `${META}.ImportAll`, namespace: imp.namespace };
  }
  if (imp.types.length === 1) {
    return imp.uri
      ? { $class: `${META}.ImportTypeFrom`, namespace: imp.namespace, name: imp.types[0], uri: imp.uri }
      : { $class: `${META}.ImportType`, namespace: imp.namespace, name: imp.types[0] };
  }
  return { $class: `${META}.ImportTypes`, namespace: imp.namespace, types: imp.types, uri: imp.uri };
}

function declarationToAst(decl: Declaration): any {
  const decorators = decl.decorators.map(decoratorToAst);

  if (decl.type === 'scalar') {
    const scalarClass = `${META}.${decl.scalarExtends || 'String'}Scalar`;
    const result: any = { $class: scalarClass, name: decl.name };
    if (decorators.length) result.decorators = decorators;
    if (decl.scalarValidators) addValidatorsToAst(result, decl.scalarValidators, decl.scalarExtends || 'String');
    return result;
  }

  if (decl.type === 'map') {
    const keyType = decl.mapDeclaration?.keyType || 'String';
    const valueType = decl.mapDeclaration?.valueType || 'String';
    const result: any = {
      $class: `${META}.MapDeclaration`,
      name: decl.name,
      key: mapTypeToAst(keyType, 'Key'),
      value: mapTypeToAst(valueType, 'Value'),
    };
    if (decorators.length) result.decorators = decorators;
    return result;
  }

  if (decl.type === 'enum') {
    const result: any = {
      $class: `${META}.EnumDeclaration`,
      name: decl.name,
      properties: decl.enumValues.map((v) => ({ $class: `${META}.EnumProperty`, name: v })),
    };
    if (decorators.length) result.decorators = decorators;
    return result;
  }

  const classMap: Record<string, string> = {
    concept: `${META}.ConceptDeclaration`,
    asset: `${META}.AssetDeclaration`,
    participant: `${META}.ParticipantDeclaration`,
    event: `${META}.EventDeclaration`,
    transaction: `${META}.TransactionDeclaration`,
  };

  const result: any = {
    $class: classMap[decl.type] || `${META}.ConceptDeclaration`,
    name: decl.name,
    isAbstract: decl.isAbstract,
    properties: decl.properties.map(propertyToAst),
  };

  if (decl.superType) {
    result.superType = { name: decl.superType };
  }

  if (decl.identified === 'identified-by' && decl.identifiedBy) {
    result.identified = { $class: `${META}.IdentifiedBy`, name: decl.identifiedBy };
  } else if (decl.identified === 'identified') {
    result.identified = { $class: `${META}.Identified` };
  }

  if (decorators.length) result.decorators = decorators;

  return result;
}

const PRIMITIVE_TO_CLASS: Record<string, string> = {
  String: 'StringProperty',
  Integer: 'IntegerProperty',
  Long: 'LongProperty',
  Double: 'DoubleProperty',
  Boolean: 'BooleanProperty',
  DateTime: 'DateTimeProperty',
};

function propertyToAst(prop: Property): any {
  if (prop.isRelationship) {
    return {
      $class: `${META}.RelationshipProperty`,
      name: prop.name,
      type: { name: prop.type },
      isArray: prop.isArray,
      isOptional: prop.isOptional,
    };
  }

  const primitiveClass = PRIMITIVE_TO_CLASS[prop.type];
  if (primitiveClass) {
    const result: any = {
      $class: `${META}.${primitiveClass}`,
      name: prop.name,
      isArray: prop.isArray,
      isOptional: prop.isOptional,
    };
    addValidatorsToAst(result, prop.validators, prop.type);
    return result;
  }

  const result: any = {
    $class: `${META}.ObjectProperty`,
    name: prop.name,
    type: { name: prop.type },
    isArray: prop.isArray,
    isOptional: prop.isOptional,
  };
  if (prop.validators?.default != null) result.defaultValue = parseDefaultValue(prop.validators.default);
  return result;
}

function addValidatorsToAst(result: any, validators: PropertyValidator, typeName: string) {
  if (!validators) return;

  if (validators.default != null) {
    result.defaultValue = parseDefaultValue(validators.default);
  }

  if (validators.regex) {
    const match = validators.regex.match(/^\/(.*)\/([gimsuy]*)$/);
    if (match) {
      result.validator = { pattern: match[1], flags: match[2] };
    }
  }

  if (validators.range) {
    const match = validators.range.match(/^\[([^,]*),([^\]]*)\]$/);
    if (match) {
      result.validator = result.validator || {};
      if (match[1].trim()) result.validator.lower = Number(match[1].trim());
      if (match[2].trim()) result.validator.upper = Number(match[2].trim());
    }
  }

  if (validators.length) {
    const match = validators.length.match(/^\[([^,]*),([^\]]*)\]$/);
    if (match) {
      result.lengthValidator = {};
      if (match[1].trim()) result.lengthValidator.minLength = Number(match[1].trim());
      if (match[2].trim()) result.lengthValidator.maxLength = Number(match[2].trim());
    }
  }
}

function parseDefaultValue(value: string): boolean | number | string {
  try {
    return JSON.parse(value);
  } catch {
    return value.replace(/^["']|["']$/g, '');
  }
}

const PRIMITIVE_MAP_KEY_TYPES = new Set(['String', 'DateTime']);
const PRIMITIVE_MAP_VALUE_TYPES = new Set(['String', 'DateTime', 'Integer', 'Long', 'Double', 'Boolean']);

function mapTypeToAst(typeName: string, kind: 'Key' | 'Value'): any {
  const primitives = kind === 'Key' ? PRIMITIVE_MAP_KEY_TYPES : PRIMITIVE_MAP_VALUE_TYPES;
  if (primitives.has(typeName)) {
    return { $class: `${META}.${typeName}Map${kind}Type` };
  }
  const $class = kind === 'Key' ? `${META}.ObjectMapKeyType` : `${META}.ObjectMapValueType`;
  return { $class, type: { name: typeName } };
}

function decoratorToAst(dec: Decorator): any {
  const result: any = { name: dec.name };
  if (dec.args.length > 0) {
    result.arguments = dec.args.map((arg) => {
      if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
        return { $class: `${META}.DecoratorString`, value: arg.slice(1, -1) };
      }
      if (!isNaN(Number(arg))) {
        return { $class: `${META}.DecoratorNumber`, value: Number(arg) };
      }
      if (arg === 'true' || arg === 'false') {
        return { $class: `${META}.DecoratorBoolean`, value: arg === 'true' };
      }
      return { $class: `${META}.DecoratorTypeReference`, type: { name: arg } };
    });
  }
  return result;
}
