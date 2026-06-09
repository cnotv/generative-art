export type ScoreType = 'hole-in-one' | 'eagle' | 'birdie' | 'par' | 'bogey' | 'double-bogey-plus'

export interface ScoreResult {
  type: ScoreType
  label: string
}

const SCORE_LABELS: Record<ScoreType, string> = {
  'hole-in-one': 'Hole in one!',
  eagle: 'Eagle!',
  birdie: 'Birdie!',
  par: 'Par',
  bogey: 'Bogey',
  'double-bogey-plus': 'Double bogey'
}

/**
 * Classify a finished hole's score relative to par using standard golf terms.
 * @param strokes Number of strokes taken to hole the ball
 * @param par Par value of the hole
 * @returns The score type and its display label
 */
export const classifyScore = (strokes: number, par: number): ScoreResult => {
  const diff = strokes - par
  const type: ScoreType =
    strokes === 1
      ? 'hole-in-one'
      : diff <= -2
        ? 'eagle'
        : diff === -1
          ? 'birdie'
          : diff === 0
            ? 'par'
            : diff === 1
              ? 'bogey'
              : 'double-bogey-plus'
  return { type, label: SCORE_LABELS[type] }
}
