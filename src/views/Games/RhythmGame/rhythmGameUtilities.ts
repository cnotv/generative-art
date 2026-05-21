import {
  HIT_WINDOW_PERFECT_MS,
  HIT_WINDOW_GOOD_MS,
  SCORE_PERFECT,
  SCORE_GOOD,
  COMBO_THRESHOLDS,
  COMBO_MULTIPLIERS,
  type HitResult,
  type RhythmNote
} from './config'

/**
 * Evaluates a hit attempt based on the timing delta from the target.
 * @param deltaMs - Absolute difference in ms between press time and note target time
 * @returns Hit quality rating
 */
export const evaluateHit = (deltaMs: number): HitResult => {
  if (deltaMs <= HIT_WINDOW_PERFECT_MS) return 'perfect'
  if (deltaMs <= HIT_WINDOW_GOOD_MS) return 'good'
  return 'miss'
}

/**
 * Calculates the score for a single hit, applying the combo multiplier.
 * @param result - Quality of the hit
 * @param combo - Current combo count before this hit
 * @returns Points earned
 */
export const getHitScore = (result: HitResult, combo: number): number => {
  const base = result === 'perfect' ? SCORE_PERFECT : result === 'good' ? SCORE_GOOD : 0
  return base * getComboMultiplier(combo)
}

/**
 * Returns the active score multiplier for the current combo streak.
 * @param combo - Current consecutive hit count
 * @returns Multiplier value (1, 2, 4, or 8)
 */
export const getComboMultiplier = (combo: number): number => {
  const index = COMBO_THRESHOLDS.reduce<number>(
    (found, threshold, i) => (combo >= threshold ? i : found),
    -1
  )
  return index === -1 ? 1 : COMBO_MULTIPLIERS[index]
}

/**
 * Calculates overall accuracy as a fraction of perfect + good hits.
 * @param perfect - Count of perfect hits
 * @param good - Count of good hits
 * @param miss - Count of misses
 * @returns Accuracy from 0 to 1
 */
export const getAccuracy = (perfect: number, good: number, miss: number): number => {
  const total = perfect + good + miss
  if (total === 0) return 1
  return (perfect + good * 0.5) / total
}

/**
 * Maps accuracy to a letter grade.
 * @param accuracy - Value from 0 to 1
 * @returns Grade letter
 */
export const getGrade = (accuracy: number): 'S' | 'A' | 'B' | 'C' | 'D' => {
  if (accuracy >= 0.97) return 'S'
  if (accuracy >= 0.9) return 'A'
  if (accuracy >= 0.75) return 'B'
  if (accuracy >= 0.5) return 'C'
  return 'D'
}

/**
 * Returns the nearest unresolved note in a lane within the good hit window.
 * Searches backwards from currentMs to handle slightly late inputs.
 * @param notes - All notes in the song
 * @param lane - The lane that was pressed
 * @param currentMs - Current song elapsed time in ms
 * @returns Matching note index or -1
 */
export const findHittableNote = (notes: RhythmNote[], lane: number, currentMs: number): number => {
  let best = -1
  let bestDelta = Infinity
  notes.forEach((note, i) => {
    if (note.lane !== lane || note.hit !== undefined) return
    const delta = Math.abs(note.time - currentMs)
    if (delta <= HIT_WINDOW_GOOD_MS && delta < bestDelta) {
      best = i
      bestDelta = delta
    }
  })
  return best
}

/**
 * Returns indices of notes that have scrolled past the miss deadline.
 * @param notes - All notes
 * @param currentMs - Current elapsed ms
 * @returns Indices of notes to auto-miss
 */
export const findExpiredNotes = (notes: RhythmNote[], currentMs: number): number[] =>
  notes.reduce<number[]>((accumulator, note, i) => {
    if (note.hit === undefined && currentMs - note.time > HIT_WINDOW_GOOD_MS) accumulator.push(i)
    return accumulator
  }, [])
