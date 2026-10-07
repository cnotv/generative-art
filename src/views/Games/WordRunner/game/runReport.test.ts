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
  it('is a win by the distance the bot still had to go when the player finished first', () => {
    expect(
      raceResult({
        playerSeconds: 60,
        botFinishSeconds: null,
        botDistance: 480,
        finishDistance: 500
      })
    ).toEqual({ won: true, metresAhead: 20 })
  })

  it('is a loss by how long after the bot the player finished', () => {
    expect(
      raceResult({
        playerSeconds: 63,
        botFinishSeconds: 60.5,
        botDistance: 500,
        finishDistance: 500
      })
    ).toEqual({ won: false, secondsBehind: 2.5 })
  })
})

describe('buildRunReport', () => {
  it('counts the right words and lists the missed ones', () => {
    const report = buildRunReport({
      gates,
      results: resultsWithMistakes(2),
      words,
      seconds: 63,
      race: { won: true, metresAhead: 12 },
      hasNextLevel: true
    })

    expect(report.correctCount).toBe(8)
    expect(report.wordCount).toBe(10)
    expect(report.missed.map((word) => word.text)).toEqual(['word0', 'word1'])
    expect(report.seconds).toBe(63)
  })

  it.each([
    [0, { won: true, metresAhead: 30 }, true, 'next level is open'],
    [0, { won: true, metresAhead: 30 }, false, 'every level'],
    [3, { won: true, metresAhead: 2 }, true, 'words below'],
    [1, { won: false, secondsBehind: 1 }, true, 'ramps'],
    [6, { won: false, secondsBehind: 9 }, true, 'Read the text']
  ] as const)(
    'with %i mistakes and %j (next level: %s) advises "%s"',
    (mistakeCount, race, hasNextLevel, advice) => {
      const report = buildRunReport({
        gates,
        results: resultsWithMistakes(mistakeCount),
        words,
        seconds: 60,
        race,
        hasNextLevel
      })

      expect(report.tip).toContain(advice)
    }
  )
})
