import type { Gate, GateResult, LevelWord, MissedWord, RunState } from '../types'

export const createRunState = (): RunState => ({ gateIndex: 0, results: [] })

/** Records the lane the player went through and moves on to the next gate. */
export const passGate = (state: RunState, gate: Gate, chosenLane: number): RunState => ({
  gateIndex: state.gateIndex + 1,
  results: [
    ...state.results,
    { position: gate.position, chosenLane, correct: chosenLane === gate.correctLane }
  ]
})

/** Every word the player missed, with what it means and the word they took instead. */
export const missedWords = (
  results: GateResult[],
  gates: Gate[],
  words: LevelWord[]
): MissedWord[] =>
  results
    .filter((result) => !result.correct)
    .map((result) => ({
      position: result.position,
      text: words[result.position].text,
      gloss: words[result.position].gloss,
      chosen: gates[result.position].options[result.chosenLane]
    }))
