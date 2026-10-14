import { readStorage, writeStorage } from './storage'

const STORAGE_KEY = 'word-runner-best-times'

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

/**
 * The best time per phrase from what was stored. Storage is outside the game's control, so
 * anything that is not a phrase id mapped to a positive number of seconds is dropped.
 * @param raw The stored JSON, or null when nothing is stored.
 * @returns Seconds by phrase id.
 */
export const parseBestTimes = (raw: string | null): Record<string, number> => {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] => isTime(entry[1]))
    )
  } catch {
    return {}
  }
}

/**
 * The best time stored for a phrase.
 * @param phraseId The phrase.
 * @returns Its best time in seconds, or null when it has none.
 */
export const loadBestTime = (phraseId: string): number | null =>
  parseBestTimes(readStorage(STORAGE_KEY))[phraseId] ?? null

/**
 * Stores a phrase's best time, keeping every other phrase's.
 * @param phraseId The phrase.
 * @param seconds Its new best time.
 */
export const saveBestTime = (phraseId: string, seconds: number): void => {
  writeStorage(
    STORAGE_KEY,
    JSON.stringify({ ...parseBestTimes(readStorage(STORAGE_KEY)), [phraseId]: seconds })
  )
}

const SECONDS_PER_MINUTE = 60

/**
 * A run time as minutes, seconds and tenths, the way a race clock shows it: 1:04.3.
 * @param seconds The time in seconds.
 * @returns The time as minutes:seconds.tenths.
 */
export const formatRunTime = (seconds: number): string => {
  const tenths = Math.floor(seconds * 10)
  const minutes = Math.floor(tenths / (SECONDS_PER_MINUTE * 10))
  const remainingSeconds = (tenths - minutes * SECONDS_PER_MINUTE * 10) / 10
  return `${minutes}:${remainingSeconds.toFixed(1).padStart(4, '0')}`
}
