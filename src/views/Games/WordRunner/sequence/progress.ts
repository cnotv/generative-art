import type { Gate, RunState } from '../types'

export const createRunState = (): RunState => ({ gateIndex: 0, results: [] })

/** Records the lane the player went through and moves on to the next gate. */
export const passGate = (state: RunState, gate: Gate, chosenLane: number): RunState => ({
  gateIndex: state.gateIndex + 1,
  results: [
    ...state.results,
    { position: gate.position, chosenLane, correct: chosenLane === gate.correctLane }
  ]
})
