import { buildRetryLap } from './lapSchedule'
import type { Gate, GateResult, Lap, LapRecord, RunState, WordSummary } from '../types'

export const createRunState = (laps: Lap[]): RunState => ({
  laps,
  lapIndex: 0,
  gateIndex: 0,
  currentResults: [],
  history: [],
  finished: laps.length === 0
})

const withRetryAfter = (laps: Lap[], lapIndex: number, retry: Lap): Lap[] => [
  ...laps.slice(0, lapIndex + 1),
  retry,
  ...laps.slice(lapIndex + 1)
]

/**
 * Records the lane the runner went through and moves on. A lap that ends with a mistake is
 * followed straight away by a hinted retry, until it has been retried `maxRetryAttempts`
 * times in a row.
 */
export const passGate = (
  state: RunState,
  gate: Gate,
  chosenLane: number,
  maxRetryAttempts: number
): RunState => {
  if (state.finished) return state

  const result: GateResult = {
    position: gate.position,
    chosenLane,
    correct: chosenLane === gate.correctLane
  }
  const currentResults = [...state.currentResults, result]
  const lap = state.laps[state.lapIndex]
  if (state.gateIndex + 1 < lap.words.length) {
    return { ...state, gateIndex: state.gateIndex + 1, currentResults }
  }

  const mistakePositions = currentResults
    .filter((gateResult) => !gateResult.correct)
    .map((gateResult) => gateResult.position)
  const laps =
    mistakePositions.length > 0 && lap.attempt < maxRetryAttempts
      ? withRetryAfter(state.laps, state.lapIndex, buildRetryLap(lap, mistakePositions))
      : state.laps
  const lapIndex = state.lapIndex + 1

  return {
    laps,
    lapIndex,
    gateIndex: 0,
    currentResults: [],
    history: [...state.history, { lapIndex: state.lapIndex, results: currentResults }],
    finished: lapIndex >= laps.length
  }
}

/** How often each word of the phrase was met, and how often it was answered right. */
export const summarizeWords = (history: LapRecord[], wordCount: number): WordSummary[] => {
  const results = history.flatMap((record) => record.results)
  return Array.from({ length: wordCount }, (_, position) => {
    const wordResults = results.filter((result) => result.position === position)
    return {
      position,
      attempts: wordResults.length,
      correct: wordResults.filter((result) => result.correct).length
    }
  })
}
