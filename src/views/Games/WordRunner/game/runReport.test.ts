import { describe, it, expect } from 'vitest'
import { buildRunReport, raceResult } from './runReport'
import type { Gate, GateResult, LevelWord } from '../types'

const words: LevelWord[] = Array.from({ length: 10 }, (_, position) => ({
  text: `word${position}`,
  gloss: `gloss${position}`,
  decoys: []
}))

const gates: Gate[] = words.map((word, position) => ({
  position,
  options: [word.text, 'x', 'y'],
  correctLane: 0,
  hint: 'none'
}))

const resultsWithMistakes = (mistakeCount: number): GateResult[] =>
  gates.map((gate) => ({
    position: gate.position,
    chosenLane: gate.position < mistakeCount ? 1 : 0,
    correct: gate.position >= mistakeCount
  }))

describe('raceResult', () => {
  const FINISH = 500

  it('is a win by the distance the closest rival still had to go', () => {
    const rivals = [
      { name: 'the bot', distance: 480, finishSeconds: null },
      { name: 'Quick Otter', distance: 492, finishSeconds: null }
    ]

    expect(raceResult({ playerSeconds: 60, finishDistance: FINISH, rivals })).toEqual({
      won: true,
      metresAhead: 8,
      rivalName: 'Quick Otter'
    })
  })

  it('is a loss by how long after the first rival over the line the player finished', () => {
    const rivals = [
      { name: 'Quick Otter', distance: FINISH, finishSeconds: 61 },
      { name: 'Calm Heron', distance: FINISH, finishSeconds: 60.5 }
    ]

    expect(raceResult({ playerSeconds: 63, finishDistance: FINISH, rivals })).toEqual({
      won: false,
      secondsBehind: 2.5,
      rivalName: 'Calm Heron'
    })
  })

  it('is a win with no one to beat', () => {
    expect(raceResult({ playerSeconds: 60, finishDistance: FINISH, rivals: [] })).toEqual({
      won: true,
      metresAhead: 0,
      rivalName: ''
    })
  })
})

describe('buildRunReport', () => {
  it('counts the right words and gives every pick', () => {
    const report = buildRunReport({
      gates,
      results: resultsWithMistakes(2),
      words,
      seconds: 63,
      race: { won: true, metresAhead: 12, rivalName: 'the bot' }
    })

    expect(report.correctCount).toBe(8)
    expect(report.wordCount).toBe(10)
    expect(report.picks).toHaveLength(10)
    expect(report.picks.filter((pick) => !pick.correct).map((pick) => pick.text)).toEqual([
      'word0',
      'word1'
    ])
    expect(report.seconds).toBe(63)
  })
})
