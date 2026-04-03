/**
 *
 * @param n
 * @param fn
 */
export const times = <T>(n: number, fn: (i: number) => T): T[] => {
  return Array.from({ length: n }, (_, i) => fn(i))
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * Recursively merge two plain objects. Arrays are replaced, not merged element-by-element.
 * Keys present only in override are included in the result.
 * @param base - The base object providing default values
 * @param override - Partial object whose defined values take precedence
 */
export const deepMerge = <T extends Record<string, unknown>>(
  base: T,
  override: Partial<Record<string, unknown>>
): T => {
  const allKeys = [...new Set([...Object.keys(base), ...Object.keys(override)])]
  return Object.fromEntries(
    allKeys.map((key) => [
      key,
      override[key] !== undefined
        ? isPlainObject(override[key])
          ? deepMerge(
              (isPlainObject(base[key]) ? base[key] : {}) as Record<string, unknown>,
              override[key] as Record<string, unknown>
            )
          : override[key]
        : base[key]
    ])
  ) as T
}
