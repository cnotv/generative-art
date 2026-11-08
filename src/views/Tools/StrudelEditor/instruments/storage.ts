// Storage can throw in private windows or with site data blocked; the page works without it.
/**
 * Reads a local storage entry, or null when there is none or storage is blocked.
 * @param key - the storage key
 * @returns the stored text
 */
export const readStored = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * Writes or, for null, removes a local storage entry; a blocked storage is ignored, since the
 * setting still holds for this visit.
 * @param key - the storage key
 * @param value - the text to keep, or null to forget it
 */
export const writeStored = (key: string, value: string | null): void => {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // Nothing to do: the setting is only lost for the next visit.
  }
}
