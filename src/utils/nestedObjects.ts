/**
 * Shared utilities for reading and immutably updating nested object properties
 * using dot-separated paths (e.g., "area.center.x").
 */

/**
 * Reads a value from a nested object using a dot-separated path.
 * Returns undefined if any segment along the path is missing.
 */
export const getNestedValue = (
  object: Record<string, unknown> | null | undefined,
  path: string
): unknown => {
  if (!object) return undefined
  return path
    .split('.')
    .reduce<unknown>(
      (current, key) =>
        current !== null && current !== undefined
          ? (current as Record<string, unknown>)[key]
          : undefined,
      object
    )
}

/**
 * Returns a new object with the value at the given dot-separated path replaced.
 * All intermediate objects are shallow-copied (immutable update).
 */
export const setNestedValueImmutable = (
  object: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> => {
  const [first, ...rest] = path.split('.')
  if (rest.length === 0) {
    return { ...object, [first]: value }
  }
  return {
    ...object,
    [first]: setNestedValueImmutable(
      (object[first] ?? {}) as Record<string, unknown>,
      rest.join('.'),
      value
    )
  }
}
