/**
 * Reads a stored value, treating unavailable storage as empty.
 * @param key The storage key.
 * @returns The value, or null.
 */
export const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * Stores a value; nothing happens when storage is unavailable.
 * @param key The storage key.
 * @param value The value.
 */
export const writeStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage is unavailable; the value simply is not remembered.
  }
}
