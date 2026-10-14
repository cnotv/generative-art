import type { Gate, RunState } from '../types'

/**
 * A run before its first gate.
 * @returns The state.
 */
export const createRunState = (): RunState => ({ gateIndex: 0, results: [] })

/**
 * Records the lane the player went through and moves on to the next gate.
 * @param state The run so far.
 * @param gate The gate passed.
 * @param chosenLane The lane taken.
 * @returns The new state.
 */
export const passGate = (state: RunState, gate: Gate, chosenLane: number): RunState => ({
  gateIndex: state.gateIndex + 1,
  results: [
    ...state.results,
    { position: gate.position, chosenLane, correct: chosenLane === gate.correctLane }
  ]
})
