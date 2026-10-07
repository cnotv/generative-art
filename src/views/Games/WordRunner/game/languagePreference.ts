import { readStorage, writeStorage } from './storage'

const STORAGE_KEY = 'word-runner-language'

/** The language picked last time, if it is still offered, otherwise the fallback. */
export const loadLanguage = (available: string[], fallback: string): string => {
  const stored = readStorage(STORAGE_KEY)
  return stored !== null && available.includes(stored) ? stored : fallback
}

export const saveLanguage = (language: string): void => writeStorage(STORAGE_KEY, language)
