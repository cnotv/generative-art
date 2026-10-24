import { STRUDEL_SAVED_PATTERN_FALLBACK_SLUG, STRUDEL_SAVED_PATTERN_ID_PREFIX } from './config'
import type { StrudelExample, StrudelSavedPattern } from './types'

const isSavedPattern = (value: unknown): value is StrudelSavedPattern =>
  typeof value === 'object' &&
  value !== null &&
  'name' in value &&
  'code' in value &&
  typeof value.name === 'string' &&
  value.name.trim().length > 0 &&
  typeof value.code === 'string'

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * The anchor a saved pattern is linked by, made from its name so the address reads well.
 * @param name - the name the player gave the pattern
 * @returns `saved-` and the name in lowercase, with every run of other characters as one dash
 */
export const toSavedPatternId = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replaceAll(/[^\da-z]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
  return `${STRUDEL_SAVED_PATTERN_ID_PREFIX}${slug.length > 0 ? slug : STRUDEL_SAVED_PATTERN_FALLBACK_SLUG}`
}

/**
 * The saved patterns in local storage, which anyone with the browser's devtools can have edited,
 * so whatever is not a list of named patterns is dropped rather than trusted.
 * @param storedText - the stored JSON, or null when nothing is stored
 * @returns the valid saved patterns, newest first
 */
export const readSavedPatterns = (storedText: string | null): StrudelSavedPattern[] => {
  const parsed = storedText === null ? null : parseJson(storedText)
  return Array.isArray(parsed) ? parsed.filter(isSavedPattern) : []
}

/**
 * Saves code under a name, replacing a save with the same anchor, and puts it first.
 * @param savedPatterns - the saves so far
 * @param name - the name to save under; a blank one saves nothing
 * @param code - the code to save
 * @returns the updated saves, newest first
 */
export const upsertSavedPattern = (
  savedPatterns: StrudelSavedPattern[],
  name: string,
  code: string
): StrudelSavedPattern[] => {
  const trimmedName = name.trim()
  if (trimmedName.length === 0) {
    return savedPatterns
  }
  const savedPatternId = toSavedPatternId(trimmedName)
  return [
    { name: trimmedName, code },
    ...savedPatterns.filter(
      (savedPattern) => toSavedPatternId(savedPattern.name) !== savedPatternId
    )
  ]
}

/**
 * Deletes the save with an anchor.
 * @param savedPatterns - the saves so far
 * @param savedPatternId - the anchor of the save to delete
 * @returns the remaining saves
 */
export const removeSavedPattern = (
  savedPatterns: StrudelSavedPattern[],
  savedPatternId: string
): StrudelSavedPattern[] =>
  savedPatterns.filter((savedPattern) => toSavedPatternId(savedPattern.name) !== savedPatternId)

/**
 * The saves as patterns the patterns tab and the anchors handle like examples and tunes.
 * @param savedPatterns - the saves
 * @returns one pattern per save, with its anchor as id and its name as label
 */
export const toSavedPatternExamples = (savedPatterns: StrudelSavedPattern[]): StrudelExample[] =>
  savedPatterns.map((savedPattern) => ({
    id: toSavedPatternId(savedPattern.name),
    label: savedPattern.name,
    code: savedPattern.code
  }))
