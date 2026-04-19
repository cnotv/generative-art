const CLOSE_MAX_DISTANCE = 1

const normalize = (value: string): string => value.trim().toLowerCase()

/**
 * Compare a guess against a target word case-insensitively after trimming.
 * @param guess - Raw user-typed guess.
 * @param target - Target word to match.
 * @returns True when the normalized guess equals the normalized target.
 */
export const chatGuessMatches = (guess: string, target: string): boolean => {
  const normalizedGuess = normalize(guess)
  const normalizedTarget = normalize(target)
  if (!normalizedGuess || !normalizedTarget) return false
  return normalizedGuess === normalizedTarget
}

/**
 * Compute the Levenshtein edit distance between two strings.
 * @param a - First string.
 * @param b - Second string.
 * @returns Minimum number of insertions, deletions, or substitutions.
 */
export const chatEditDistance = (a: string, b: string): number => {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const aChars = [...a]
  const bChars = [...b]
  const firstRow = Array.from({ length: bChars.length + 1 }, (_, index) => index)
  const finalRow = aChars.reduce<number[]>(
    (previousRow, charA, i) =>
      bChars.reduce<number[]>(
        (currentRow, charB, index) => {
          const cost = charA === charB ? 0 : 1
          const next = Math.min(
            previousRow[index + 1] + 1,
            currentRow[index] + 1,
            previousRow[index] + cost
          )
          return [...currentRow, next]
        },
        [i + 1]
      ),
    firstRow
  )
  return finalRow[bChars.length]
}

/**
 * Detect guesses that are one edit away from the target (close but not exact).
 * @param guess - Raw user-typed guess.
 * @param target - Target word to match.
 * @returns True when the normalized guess is 1 edit away from the target.
 */
export const chatGuessIsClose = (guess: string, target: string): boolean => {
  const normalizedGuess = normalize(guess)
  const normalizedTarget = normalize(target)
  if (!normalizedGuess || !normalizedTarget) return false
  if (normalizedGuess === normalizedTarget) return false
  return chatEditDistance(normalizedGuess, normalizedTarget) <= CLOSE_MAX_DISTANCE
}
