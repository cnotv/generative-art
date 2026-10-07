import type { GateResult, LevelWord, RaceResult, Rival, RunReport } from '../types'

type RaceEnd = {
  playerSeconds: number
  finishDistance: number
  rivals: Rival[]
}

/**
 * Who reached the finish first, measured when the player crossed it. A loss is against the
 * first rival over the line; a win against the rival closest behind.
 */
export const raceResult = ({ playerSeconds, finishDistance, rivals }: RaceEnd): RaceResult => {
  const finished = rivals.filter(
    (rival): rival is Rival & { finishSeconds: number } => rival.finishSeconds !== null
  )
  const winner = finished.reduce<(Rival & { finishSeconds: number }) | null>(
    (first, rival) => (first === null || rival.finishSeconds < first.finishSeconds ? rival : first),
    null
  )
  if (winner) {
    return {
      won: false,
      secondsBehind: playerSeconds - winner.finishSeconds,
      rivalName: winner.name
    }
  }
  const closest = rivals.reduce<Rival | null>(
    (nearest, rival) => (nearest === null || rival.distance > nearest.distance ? rival : nearest),
    null
  )
  return {
    won: true,
    metresAhead: closest ? finishDistance - closest.distance : 0,
    rivalName: closest?.name ?? ''
  }
}

type RunEnd = {
  results: GateResult[]
  words: LevelWord[]
  seconds: number
  race: RaceResult
}

/** What the end screen says about a level: the race and the score. */
export const buildRunReport = ({ results, words, seconds, race }: RunEnd): RunReport => ({
  race,
  seconds,
  correctCount: results.filter((result) => result.correct).length,
  wordCount: words.length
})
