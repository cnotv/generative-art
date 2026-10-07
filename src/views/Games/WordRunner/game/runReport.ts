import { missedWords } from '../sequence/progress'
import type { Gate, GateResult, LevelWord, RaceResult, RunReport } from '../types'

// Above this share of right words a win is a clean one; above the second a loss was a close one.
const CLEAN_RUN_SHARE = 0.9
const CLOSE_RUN_SHARE = 0.8

type RaceEnd = {
  playerSeconds: number
  botFinishSeconds: number | null
  botDistance: number
  finishDistance: number
}

/** Who reached the finish first, measured when the player crossed it. */
export const raceResult = ({
  playerSeconds,
  botFinishSeconds,
  botDistance,
  finishDistance
}: RaceEnd): RaceResult =>
  botFinishSeconds === null
    ? { won: true, metresAhead: finishDistance - botDistance }
    : { won: false, secondsBehind: playerSeconds - botFinishSeconds }

/** One line of advice: what the run shows, and what to do next. */
const adviceFor = (share: number, race: RaceResult, hasNextLevel: boolean): string => {
  if (race.won && share >= CLEAN_RUN_SHARE) {
    return hasNextLevel
      ? 'A clean run. The next level is open.'
      : 'A clean run, and every level is cleared.'
  }
  if (race.won) return 'You beat the bot. Go over the words below before the next level.'
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
