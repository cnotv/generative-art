import type { Gate, GateResult, LevelWord, PickedWord, RunState } from '../types'

export const createRunState = (): RunState => ({ gateIndex: 0, results: [] })

/** Records the lane the player went through and moves on to the next gate. */
export const passGate = (state: RunState, gate: Gate, chosenLane: number): RunState => ({
  gateIndex: state.gateIndex + 1,
  results: [
    ...state.results,
    { position: gate.position, chosenLane, correct: chosenLane === gate.correctLane }
  ]
})

/** Every word the player took, in order, with the right word beside it and whether it was right. */
export const pickedWords = (
  results: GateResult[],
  gates: Gate[],
  words: LevelWord[]
): PickedWord[] =>
  results.map((result) => ({
    position: result.position,
    text: words[result.position].text,
    chosen: gates[result.position].options[result.chosenLane],
    correct: result.correct
  }))
