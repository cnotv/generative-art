/**
 * Narrows an unvalidated value to a plain object, rejecting arrays and null.
 * @param value - the value read from storage or JSON
 * @returns true when the value can be read by key
 */
export const isStoredRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Reads a stored string, falling back when the value is missing or another type.
 * @param value - the stored value
 * @param fallback - the value to use when it is not a string
 * @returns the stored string or the fallback
 */
export const readStoredString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback

/**
 * Reads a stored number and keeps it inside the range its control allows.
 * @param value - the stored value
 * @param fallback - the value to use when it is not a finite number
 * @param minimum - the lowest value the control allows
 * @param maximum - the highest value the control allows
 * @returns the clamped number or the fallback
 */
export const readStoredNumber = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback

/**
 * Reads one of a fixed set of string values, falling back when it is not listed.
 * @param options - the values the control offers
 * @param value - the stored value
 * @param fallback - the value to use when it is not one of the options
 * @returns the stored option or the fallback
 */
export const readStoredChoice = (
  options: { value: string }[],
  value: unknown,
  fallback: string
): string =>
  typeof value === 'string' && options.some((option) => option.value === value) ? value : fallback
