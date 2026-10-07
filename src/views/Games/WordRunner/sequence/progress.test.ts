import { describe, it, expect } from 'vitest'
import { createRunState, missedWords, passGate } from './progress'
import type { Gate, LevelWord, RunState } from '../types'

const words: LevelWord[] = [
  { text: 'uno', gloss: 'one', decoys: [] },
  { text: 'dos', gloss: 'two', decoys: [] },
  { text: 'tres', gloss: 'three', decoys: [] }
]

const gateAt = (position: number, correctLane: number): Gate => ({
  position,
  options: ['A', 'B', 'C'].map((letter, lane) =>
    lane === correctLane ? words[position].text : letter
  ),
  correctLane,
  hint: 'none'
})

const gates = [gateAt(0, 0), gateAt(1, 2), gateAt(2, 1)]

const passAll = (state: RunState, chosenLanes: number[]): RunState =>
  chosenLanes.reduce((current, lane, index) => passGate(current, gates[index], lane), state)

describe('createRunState', () => {
  it('starts at the first gate with nothing answered', () => {
    expect(createRunState()).toEqual({ gateIndex: 0, results: [] })
  })
})

describe('passGate', () => {
  it('moves on one gate and records whether the lane was right', () => {
    const state = passAll(createRunState(), [0, 1])

    expect(state.gateIndex).toBe(2)
    expect(state.results).toEqual([
      { position: 0, chosenLane: 0, correct: true },
      { position: 1, chosenLane: 1, correct: false }
    ])
  })

  it('keeps the earlier state unchanged', () => {
    const start = createRunState()

    passGate(start, gates[0], 0)

    expect(start).toEqual({ gateIndex: 0, results: [] })
  })
})

describe('missedWords', () => {
  it('lists each wrong word with its meaning and the word taken instead', () => {
    const state = passAll(createRunState(), [0, 1, 0])

    expect(missedWords(state.results, gates, words)).toEqual([
      { position: 1, text: 'dos', gloss: 'two', chosen: 'B' },
      { position: 2, text: 'tres', gloss: 'three', chosen: 'A' }
    ])
  })

  it('is empty after a clean run', () => {
    const state = passAll(createRunState(), [0, 2, 1])

    expect(missedWords(state.results, gates, words)).toEqual([])
  })
})
