import { computed, ref } from 'vue'
import type { ComputedRef } from 'vue'
import { readStorage, writeStorage } from '@/utils/storage'
import { STRUDEL_SAVED_PATTERNS_STORAGE_KEY } from './config'
import {
  readSavedPatterns,
  removeSavedPattern,
  toSavedPatternExamples,
  upsertSavedPattern
} from './savedPatterns'
import type { StrudelExample, StrudelSavedPattern } from './types'

type SavedPatternsState = {
  /** The patterns saved under a name, newest first, as the patterns tab lists them. */
  savedPatterns: ComputedRef<StrudelExample[]>
  /** Saves the current code under a name, replacing a save with the same anchor. */
  savePattern: (name: string) => void
  deleteSavedPattern: (savedPatternId: string) => void
}

/**
 * The patterns the player saved under a name, kept in local storage across visits.
 * @param readCurrentCode - the code a new save stores, read when it is saved
 * @returns the saves and the actions that change them
 */
export const useSavedPatterns = (readCurrentCode: () => string): SavedPatternsState => {
  const savedPatternList = ref<StrudelSavedPattern[]>(
    readSavedPatterns(readStorage(STRUDEL_SAVED_PATTERNS_STORAGE_KEY))
  )

  const storeSavedPatterns = (nextSavedPatterns: StrudelSavedPattern[]): void => {
    savedPatternList.value = nextSavedPatterns
    writeStorage(STRUDEL_SAVED_PATTERNS_STORAGE_KEY, JSON.stringify(nextSavedPatterns))
  }

  return {
    savedPatterns: computed(() => toSavedPatternExamples(savedPatternList.value)),
    savePattern: (name) =>
      storeSavedPatterns(upsertSavedPattern(savedPatternList.value, name, readCurrentCode())),
    deleteSavedPattern: (savedPatternId) =>
      storeSavedPatterns(removeSavedPattern(savedPatternList.value, savedPatternId))
  }
}
