import type { PoseKeyframe } from '@webgamekit/rig'

const STORAGE_KEY = 'rig-animator-autosave'

/** The slice of an edit worth surviving a refresh: not the loaded model, which a blob URL can't. */
export interface RigAutosave {
  fps: number
  frameMax: number
  keyframes: PoseKeyframe[]
}

const isRigAutosave = (value: unknown): value is RigAutosave => {
  const candidate = value as Partial<RigAutosave> | null
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.fps === 'number' &&
    typeof candidate.frameMax === 'number' &&
    Array.isArray(candidate.keyframes)
  )
}

/**
 * Persist the current edit so a refresh does not lose it. Never throws: storage can be full,
 * disabled by the browser, or unavailable in this context, and the edit still works either way.
 * @param autosave The edit to save
 */
export const saveRigAutosave = (autosave: RigAutosave): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(autosave))
  } catch {
    // Nothing to do: the edit stays in memory, it just won't survive a refresh.
  }
}

/**
 * Load a previously autosaved edit.
 * @returns The saved edit, or null when there is none, it doesn't match the expected shape, or
 *   storage is unavailable
 */
export const loadRigAutosave = (): RigAutosave | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isRigAutosave(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Clear the autosaved edit, for a full reset. Never throws. */
export const clearRigAutosave = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
