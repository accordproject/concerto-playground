// Name-format validation for the Form view. Saving an invalid name would
// generate CTO that no longer parses, making the namespace vanish from the
// tree, so every rename is checked here first and rejected with a message
// explaining the expected format.
//
// The accept/reject decision is Concerto's own: ID_REGEX comes from
// @accordproject/concerto-util, so a name is rejected here exactly when
// concerto-core would reject it. The messages are only a friendlier layer
// on top; they never change the validation semantics.

import { Identifiers } from '@accordproject/concerto-util';
import { VALIDATION_STRINGS } from '../../constants/ui';

const { ID_REGEX } = Identifiers;

// Version part of a namespace: full semver with optional prerelease tag.
const VERSION_RE = /^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$/;

/**
 * Returns an error message if `name` is not a valid Concerto identifier
 * (declaration name, property name, enum value), or null if it is valid.
 */
export function identifierError(name: string): string | null {
  if (!name) return VALIDATION_STRINGS.nameRequired;
  if (/\s/.test(name)) {
    return VALIDATION_STRINGS.nameNoSpaces(suggestIdentifier(name), name);
  }
  if (!ID_REGEX.test(name)) {
    return VALIDATION_STRINGS.nameFormat;
  }
  return null;
}

/**
 * Returns an error message if `ns` is not a valid Concerto namespace
 * (dot-separated identifiers plus optional @semver), or null if it is valid.
 */
export function namespaceError(ns: string): string | null {
  if (!ns) return VALIDATION_STRINGS.namespaceRequired;
  const at = ns.indexOf('@');
  const name = at === -1 ? ns : ns.slice(0, at);
  const version = at === -1 ? null : ns.slice(at + 1);
  const segmentsValid = name.split('.').every((segment) => ID_REGEX.test(segment));
  if (!segmentsValid || (version !== null && !VERSION_RE.test(version))) {
    return VALIDATION_STRINGS.namespaceFormat;
  }
  return null;
}

/** Turns "masina mea" into "masinaMea" for the error message's suggestion. */
export function suggestIdentifier(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('');
}
