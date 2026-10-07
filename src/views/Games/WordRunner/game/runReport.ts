import { missedWords } from '../sequence/progress'
import type { Gate, GateResult, LevelWord, RaceResult, Rival, RunReport } from '../types'

// Above this share of right words a win is a clean one; above the second a loss was a close one.
const CLEAN_RUN_SHARE = 0.9
const CLOSE_RUN_SHARE = 0.8

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

/** One line of advice: what the run shows, and what to do next. */
const adviceFor = (share: number, race: RaceResult, hasNextLevel: boolean): string => {
  if (race.won && share >= CLEAN_RUN_SHARE) {
    return hasNextLevel
      ? 'A clean run. The next level is open.'
      : 'A clean run, and every level is cleared.'
  }
  if (race.won) return 'You won the race. Go over the words below before the next level.'
  if (share >= CLOSE_RUN_SHARE) {
    return 'Close. The ramps make up time: take the right word wherever one stands.'
  }
  return 'Read the text below, then race it again. Every word keeps its lane.'
}

type RunEnd = {
  gates: Gate[]
  results: GateResult[]
  words: LevelWord[]
  seconds: number
  race: RaceResult
  hasNextLevel: boolean
}

/** What the end screen says about a level: the race, the score, the words to go over. */
export const buildRunReport = ({
  gates,
  results,
  words,
  seconds,
  race,
  hasNextLevel
}: RunEnd): RunReport => {
  const correctCount = results.filter((result) => result.correct).length
  const share = words.length > 0 ? correctCount / words.length : 0
  return {
    race,
    seconds,
    correctCount,
    wordCount: words.length,
    missed: missedWords(results, gates, words),
    tip: adviceFor(share, race, hasNextLevel)
  }
}
