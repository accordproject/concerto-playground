// Name-format validation for the Form view. Saving an invalid name would
// generate CTO that no longer parses, making the namespace vanish from the
// tree, so every rename is checked here first and rejected with a message
// explaining the expected format.

const IDENTIFIER_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const NAMESPACE_RE =
  /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*(@\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?)?$/;

/**
 * Returns an error message if `name` is not a valid Concerto identifier
 * (declaration name, property name, enum value), or null if it is valid.
 */
export function identifierError(name: string): string | null {
  if (!name) return 'Name is required.';
  if (/\s/.test(name)) {
    return `Names cannot contain spaces. Write "${suggestIdentifier(name)}" instead of "${name}".`;
  }
  if (!IDENTIFIER_RE.test(name)) {
    return 'Names must be a single word of letters, digits, "_" or "$", starting with a letter (e.g. "myCarName").';
  }
  return null;
}

/**
 * Returns an error message if `ns` is not a valid Concerto namespace
 * (dot-separated identifiers plus optional @semver), or null if it is valid.
 */
export function namespaceError(ns: string): string | null {
  if (!ns) return 'Namespace is required.';
  if (!NAMESPACE_RE.test(ns)) {
    return 'Namespaces must be dot-separated words with no spaces, plus an optional version, e.g. "org.example@1.0.0".';
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
