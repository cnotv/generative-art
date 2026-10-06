import { describe, it, expect } from 'vitest'
import { createRunState, passGate, summarizeWords } from './progress'
import type { Gate, Lap, RunState } from '../types'

const plainLap = (positions: number[]): Lap => ({
  shuffled: false,
  attempt: 0,
  words: positions.map((position) => ({ position, chunk: 0, hint: 'none' }))
})

const gateAt = (position: number, correctLane: number): Gate => ({
  position,
  options: ['uno', 'dos', 'tres'],
  correctLane,
  hint: 'none'
})

const passAll = (state: RunState, answers: [Gate, number][]): RunState =>
  answers.reduce((current, [gate, chosenLane]) => passGate(current, gate, chosenLane, 2), state)

describe('createRunState', () => {
  it('starts at the first gate of the first lap', () => {
    const state = createRunState([plainLap([0, 1])])

    expect(state.lapIndex).toBe(0)
    expect(state.gateIndex).toBe(0)
    expect(state.currentResults).toEqual([])
    expect(state.history).toEqual([])
    expect(state.finished).toBe(false)
  })

  it('is already finished with no laps to run', () => {
    expect(createRunState([]).finished).toBe(true)
  })
})

describe('passGate', () => {
  it.each([
    [1, 1, true],
    [0, 1, false],
    [2, 1, false]
  ])(
    'choosing lane %i at a gate whose word is in lane %i is correct: %s',
    (chosenLane, correctLane, correct) => {
      const state = createRunState([plainLap([0, 1])])

      const next = passGate(state, gateAt(0, correctLane), chosenLane, 2)

      expect(next.currentResults).toEqual([{ position: 0, chosenLane, correct }])
      expect(next.gateIndex).toBe(1)
    }
  )

  it('moves to the next lap and records the finished one after its last gate', () => {
    const state = createRunState([plainLap([0, 1]), plainLap([0, 1])])

    const next = passAll(state, [
      [gateAt(0, 0), 0],
      [gateAt(1, 2), 2]
    ])

    expect(next.lapIndex).toBe(1)
    expect(next.gateIndex).toBe(0)
    expect(next.currentResults).toEqual([])
    expect(next.history).toEqual([
      {
        lapIndex: 0,
        results: [
          { position: 0, chosenLane: 0, correct: true },
          { position: 1, chosenLane: 2, correct: true }
        ]
      }
    ])
    expect(next.laps).toHaveLength(2)
  })

  it('finishes after the last gate of the last lap', () => {
    const state = createRunState([plainLap([0])])

    const next = passGate(state, gateAt(0, 1), 1, 2)

    expect(next.finished).toBe(true)
  })

  it('inserts a hinted retry straight after a lap with a mistake', () => {
    const state = createRunState([plainLap([0, 1]), plainLap([0, 1, 2])])

    const next = passAll(state, [
      [gateAt(0, 0), 0],
      [gateAt(1, 2), 0]
    ])

    expect(next.laps).toHaveLength(3)
    expect(next.lapIndex).toBe(1)
    expect(next.laps[1].attempt).toBe(1)
    expect(next.laps[1].words.map((word) => word.hint)).toEqual(['late', 'late'])
    expect(next.laps[2]).toEqual(plainLap([0, 1, 2]))
  })

  it('stops retrying once the lap has been re-run the maximum number of times', () => {
    const state = createRunState([{ ...plainLap([0]), attempt: 2 }])

    const next = passGate(state, gateAt(0, 0), 1, 2)

    expect(next.laps).toHaveLength(1)
    expect(next.finished).toBe(true)
  })

  it('ignores gates passed after the run has finished', () => {
    const finished = passGate(createRunState([plainLap([0])]), gateAt(0, 0), 0, 2)

    const next = passGate(finished, gateAt(0, 0), 1, 2)

    expect(next).toBe(finished)
  })

  it('does not change the state it was given', () => {
    const state = createRunState([plainLap([0, 1])])

    passGate(state, gateAt(0, 0), 1, 2)

    expect(state.currentResults).toEqual([])
    expect(state.gateIndex).toBe(0)
  })
})

describe('summarizeWords', () => {
  it('counts every attempt and every correct answer per word', () => {
    const state = passAll(createRunState([plainLap([0, 1]), plainLap([0, 1, 2])]), [
      [gateAt(0, 0), 0],
      [gateAt(1, 1), 2],
      [gateAt(0, 0), 0],
      [gateAt(1, 1), 1],
      [gateAt(0, 0), 0],
      [gateAt(1, 1), 1],
      [gateAt(2, 2), 0]
    ])

    const summary = summarizeWords(state.history, 4)

    expect(summary).toEqual([
      { position: 0, attempts: 3, correct: 3 },
      { position: 1, attempts: 3, correct: 2 },
      { position: 2, attempts: 1, correct: 0 },
      { position: 3, attempts: 0, correct: 0 }
    ])
  })
})
