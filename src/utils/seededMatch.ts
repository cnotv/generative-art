import type { MatchResult } from '@/types/seededMatch'

const SEED_RANGE = 2_147_483_648

/**
 * Draw a seed for a new match. Every peer builds its level from this one number.
 * @param random - Source of values in [0, 1)
 * @returns A non-negative integer seed
 */
export const createMatchSeed = (random: () => number = Math.random): number =>
  Math.floor(random() * SEED_RANGE)

/**
 * Order match results best first: players still standing by score, then knocked-out players
 * from the last to fall to the first, ties broken by score.
 * @param results - One result per player
 * @returns A new, ranked array
 */
export const rankMatchResults = (results: MatchResult[]): MatchResult[] =>
  [...results].sort((first, second) => {
    const firstOut = first.eliminatedAt ?? Number.POSITIVE_INFINITY
    const secondOut = second.eliminatedAt ?? Number.POSITIVE_INFINITY
    if (firstOut !== secondOut) return secondOut - firstOut
    return second.score - first.score
  })

/**
 * Players who have not reported a result yet.
 * @param playerIds - Everyone in the match
 * @param results - Results reported so far
 * @returns Ids still playing
 */
export const remainingPlayerIds = (playerIds: string[], results: MatchResult[]): string[] =>
  playerIds.filter((playerId) => !results.some((result) => result.playerId === playerId))

/**
 * Whether the local player is the last one still playing in a match that started with others,
 * and should stop and report so the match can end. Rivals who left count as gone.
 * @param playerIds - Players from the starting roster who are still in the room
 * @param results - Results reported so far
 * @param localPlayerId - The local player
 * @param rosterSize - How many players the match started with
 * @returns True for the lone survivor of a match that started with more than one player
 */
export const isLastSurvivor = (
  playerIds: string[],
  results: MatchResult[],
  localPlayerId: string,
  rosterSize: number
): boolean => {
  const remaining = remainingPlayerIds(playerIds, results)
  return rosterSize > 1 && remaining.length === 1 && remaining[0] === localPlayerId
}

/**
 * Record a result, replacing any earlier one from the same player.
 * @param results - Results so far
 * @param result - The new result
 * @returns The updated results
 */
export const upsertMatchResult = (results: MatchResult[], result: MatchResult): MatchResult[] => [
  ...results.filter((existing) => existing.playerId !== result.playerId),
  result
]
