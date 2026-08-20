const RECORD_STORAGE_KEY = 'tilt-maze-best-level'

/**
 * The best level ever reached, from local storage.
 *
 * Storage is read inside the function rather than at module scope: a module-level read runs on
 * import, which throws wherever `localStorage` is absent and would take the whole view with it.
 * A private-mode browser can also throw on access, so a failure reads as "no record yet".
 * @returns The stored best level, or zero when there is none
 */
export const loadBestLevel = (): number => {
  try {
    const stored = Number(window.localStorage.getItem(RECORD_STORAGE_KEY))
    return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0
  } catch {
    return 0
  }
}

/**
 * Store a level as the new best, if it beats what is there.
 * @param level The level the run reached
 * @param best The best level before this run
 * @returns True when the record was beaten, so the caller can say so
 */
export const isNewBest = (level: number, best: number): boolean => level > best

/**
 * Record a finished run, keeping only the best result.
 * @param level The level the run reached
 * @returns True when this run set a new record
 */
export const commitRecord = (level: number): boolean => {
  const best = loadBestLevel()
  if (!isNewBest(level, best)) return false
  try {
    window.localStorage.setItem(RECORD_STORAGE_KEY, String(level))
  } catch {
    return true
  }
  return true
}
