import easyWords from './words/easy.json'
import mediumWords from './words/medium.json'
import hardWords from './words/hard.json'

export type DictionaryDifficulty = 'easy' | 'medium' | 'hard'

const WORD_LISTS: Record<DictionaryDifficulty, readonly string[]> = {
  easy: easyWords,
  medium: mediumWords,
  hard: hardWords
}

/**
 * Get the full word list for a given difficulty level.
 * @param difficulty - Difficulty tier to fetch words for.
 * @returns Frozen list of words (do not mutate).
 */
export const dictionaryGetWords = (difficulty: DictionaryDifficulty): readonly string[] =>
  WORD_LISTS[difficulty]

/**
 * Pick a random word from the chosen difficulty list.
 * @param difficulty - Difficulty tier to draw from.
 * @param random - Pluggable [0,1) random source, defaults to `Math.random`.
 * @returns A randomly selected word.
 */
export const dictionaryPickRandom = (
  difficulty: DictionaryDifficulty,
  random: () => number = Math.random
): string => {
  const list = WORD_LISTS[difficulty]
  const index = Math.floor(random() * list.length)
  return list[index]
}

/**
 * Produce a progressively revealed hint for a target word.
 * Reveals letters at positions determined by `revealRatio` (0..1).
 * Unrevealed letters become `_`; spaces remain as spaces.
 * @param word - Target word to mask.
 * @param revealRatio - Fraction of letters to reveal, clamped to [0,1].
 * @returns Hint string with placeholders for hidden letters.
 */
export const dictionaryMaskWord = (word: string, revealRatio: number): string => {
  const clamped = Math.min(1, Math.max(0, revealRatio))
  const letters = [...word]
  const revealCount = Math.floor(letters.length * clamped)
  const letterIndices = letters.map((_, i) => i).filter((i) => letters[i] !== ' ')
  const step =
    letterIndices.length === 0
      ? 1
      : Math.max(1, Math.floor(letterIndices.length / Math.max(1, revealCount)))
  const revealed = new Set<number>(
    letterIndices.filter((_, position) => position % step === 0).slice(0, revealCount)
  )
  return letters.map((char, i) => (char === ' ' ? ' ' : revealed.has(i) ? char : '_')).join('')
}
