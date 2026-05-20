import { describe, it, expect } from 'vitest'
import {
  evaluateHit,
  getHitScore,
  getComboMultiplier,
  getAccuracy,
  getGrade,
  findHittableNote,
  findExpiredNotes
} from './rhythmGameUtilities'
import type { RhythmNote } from './config'

describe('evaluateHit', () => {
  it.each([
    [0, 'perfect'],
    [50, 'perfect'],
    [51, 'good'],
    [120, 'good'],
    [121, 'miss'],
    [500, 'miss']
  ])('delta %ims → %s', (delta, expected) => {
    expect(evaluateHit(delta)).toBe(expected)
  })
})

describe('getComboMultiplier', () => {
  it.each([
    [0, 1],
    [9, 1],
    [10, 2],
    [24, 2],
    [25, 4],
    [49, 4],
    [50, 8],
    [100, 8]
  ])('combo %i → ×%i', (combo, mult) => {
    expect(getComboMultiplier(combo)).toBe(mult)
  })
})

describe('getHitScore', () => {
  it('perfect with no combo = 300', () => {
    expect(getHitScore('perfect', 0)).toBe(300)
  })

  it('good with no combo = 100', () => {
    expect(getHitScore('good', 0)).toBe(100)
  })

  it('miss = 0 regardless of combo', () => {
    expect(getHitScore('miss', 100)).toBe(0)
  })

  it('applies combo multiplier', () => {
    expect(getHitScore('perfect', 50)).toBe(300 * 8)
    expect(getHitScore('good', 10)).toBe(100 * 2)
  })
})

describe('getAccuracy', () => {
  it('all perfect = 1.0', () => {
    expect(getAccuracy(10, 0, 0)).toBe(1)
  })

  it('no notes = 1.0', () => {
    expect(getAccuracy(0, 0, 0)).toBe(1)
  })

  it('half perfect half miss ≈ 0.5', () => {
    expect(getAccuracy(5, 0, 5)).toBeCloseTo(0.5)
  })

  it('good counts as 0.5 accuracy', () => {
    expect(getAccuracy(0, 10, 0)).toBeCloseTo(0.5)
  })
})

describe('getGrade', () => {
  it.each([
    [1.0, 'S'],
    [0.97, 'S'],
    [0.96, 'A'],
    [0.9, 'A'],
    [0.89, 'B'],
    [0.75, 'B'],
    [0.74, 'C'],
    [0.5, 'C'],
    [0.49, 'D']
  ])('accuracy %.2f → %s', (accumulator, grade) => {
    expect(getGrade(accumulator)).toBe(grade)
  })
})

describe('findHittableNote', () => {
  const notes: RhythmNote[] = [
    { lane: 0, midiNote: 60, time: 1000 },
    { lane: 1, midiNote: 64, time: 1000 },
    { lane: 0, midiNote: 60, time: 2000 }
  ]

  it('finds the nearest note in the correct lane', () => {
    expect(findHittableNote(notes, 0, 1000)).toBe(0)
  })

  it('ignores different lanes', () => {
    expect(findHittableNote(notes, 2, 1000)).toBe(-1)
  })

  it('ignores already-hit notes', () => {
    const withHit = notes.map((n, i) => (i === 0 ? { ...n, hit: 'perfect' as const } : n))
    expect(findHittableNote(withHit, 0, 1000)).toBe(-1)
  })

  it('returns -1 when outside hit window', () => {
    expect(findHittableNote(notes, 0, 500)).toBe(-1)
  })

  it('picks the closer of two valid notes', () => {
    const two: RhythmNote[] = [
      { lane: 0, midiNote: 60, time: 900 },
      { lane: 0, midiNote: 60, time: 1050 }
    ]
    expect(findHittableNote(two, 0, 1000)).toBe(1)
  })
})

describe('findExpiredNotes', () => {
  const notes: RhythmNote[] = [
    { lane: 0, midiNote: 60, time: 500 },
    { lane: 1, midiNote: 64, time: 1000, hit: 'perfect' },
    { lane: 2, midiNote: 67, time: 1500 }
  ]

  it('returns indices of notes past the miss deadline', () => {
    expect(findExpiredNotes(notes, 800)).toEqual([0])
  })

  it('skips already-resolved notes', () => {
    expect(findExpiredNotes(notes, 1200)).toEqual([0])
  })

  it('returns empty when no notes expired', () => {
    expect(findExpiredNotes(notes, 600)).toEqual([])
  })
})
