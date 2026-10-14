import { readStorage, writeStorage } from './storage'

const STORAGE_KEY = 'word-runner-progress'

const isClearedCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

/**
 * How many levels of each language have been cleared, from what was stored. Storage is
 * outside the game's control, so anything but a whole count of zero or more is dropped.
 * @param raw The stored JSON, or null when nothing is stored.
 * @returns Levels cleared, by language.
 */
export const parseProgress = (raw: string | null): Record<string, number> => {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] => isClearedCount(entry[1]))
    )
  } catch {
    return {}
  }
}

const clearedCount = (language: string): number =>
  parseProgress(readStorage(STORAGE_KEY))[language] ?? 0

/**
 * How many levels of a language can be played: every one cleared, and the next.
 * @param language The language.
 * @param levelCount How many levels it has.
 * @returns How many levels are unlocked.
 */
export const unlockedLevelCount = (language: string, levelCount: number): number =>
  Math.min(levelCount, clearedCount(language) + 1)

/**
 * Records a level as cleared, which opens the one after it. Clearing an earlier one again changes
 * nothing.
 * @param language The language.
 * @param levelIndex The level cleared.
 */
export const saveLevelCleared = (language: string, levelIndex: number): void => {
  writeStorage(
    STORAGE_KEY,
    JSON.stringify({
      ...parseProgress(readStorage(STORAGE_KEY)),
      [language]: Math.max(clearedCount(language), levelIndex + 1)
    })
  )
}
