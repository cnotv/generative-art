import type { HintLevel, Level, LevelWord } from '../types'

// The first sentence shows the way, the second only up close; after that the text is the test.
const SENTENCE_HINTS: HintLevel[] = ['full', 'late']

/**
 * Every word of the level in reading order, one gate each.
 * @param level The level.
 * @returns Its words.
 */
export const levelWords = (level: Level): LevelWord[] =>
  level.sentences.flatMap((sentence) => sentence.words)

/**
 * The sentence each word of the level belongs to, by position.
 * @param level The level.
 * @returns Each word's sentence index.
 */
export const sentenceIndices = (level: Level): number[] =>
  level.sentences.flatMap((sentence, sentenceIndex) => sentence.words.map(() => sentenceIndex))

/**
 * How much each gate helps: fully through the first sentence, late in the second, then not.
 * @param level The level.
 * @returns Each gate's hint level.
 */
export const levelHints = (level: Level): HintLevel[] =>
  sentenceIndices(level).map((sentenceIndex) => SENTENCE_HINTS[sentenceIndex] ?? 'none')

/**
 * Words as they read in the text, each with the punctuation that opens or follows it.
 * @param words The words.
 * @returns The text.
 */
export const sentenceText = (words: LevelWord[]): string =>
  words.map((word) => `${word.opening ?? ''}${word.text}${word.punctuation ?? ''}`).join(' ')

/**
 * The text with its first letter in capitals, as at the start of a sentence.
 * @param text The text.
 * @returns The text capitalised.
 */
export const capitalise = (text: string): string =>
  text.charAt(0).toLocaleUpperCase() + text.slice(1)
