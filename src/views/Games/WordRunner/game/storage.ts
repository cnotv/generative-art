// Private windows and blocked storage throw on access; what is stored here is a nicety, never a
// blocker, so a failed read is treated as nothing stored and a failed write is dropped.

export const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const writeStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage is unavailable; the value simply is not remembered.
  }
}
