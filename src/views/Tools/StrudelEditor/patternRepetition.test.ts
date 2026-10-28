import { describe, expect, it } from 'vitest'
import { findRepetitionCycles } from './patternRepetition'
import type { StrudelScheduledHap } from './types'

const hap = (beginCycle: number, durationCycles: number, note: string): StrudelScheduledHap => ({
  value: { note, s: 'square' },
  beginCycle,
  durationCycles
})

describe('findRepetitionCycles', () => {
  it.each([
    [
      'a coin played twice per cycle',
      [
        hap(0, 1 / 16, 'b5'),
        hap(1 / 16, 3 / 16, 'e6'),
        hap(0.5, 1 / 16, 'b5'),
        hap(9 / 16, 3 / 16, 'e6')
      ],
      0.5
    ],
    ['four identical kicks', [0, 0.25, 0.5, 0.75].map((begin) => hap(begin, 0.25, 'c2')), 0.25],
    [
      'a melody that never repeats inside the cycle',
      [hap(0, 0.25, 'c3'), hap(0.25, 0.25, 'e3'), hap(0.5, 0.25, 'g3'), hap(0.75, 0.25, 'c4')],
      1
    ],
    ['a pattern with no events', [], 1]
  ])('measures %s', (_, haps, expectedCycles) => {
    // Act
    const repetitionCycles = findRepetitionCycles(haps)

    // Assert
    expect(repetitionCycles).toBe(expectedCycles)
  })

  it('tells apart repeats that differ only in a control value', () => {
    // Arrange
    const haps = [
      hap(0, 0.5, 'c3'),
      { value: { note: 'c3', s: 'square', gain: 0.5 }, beginCycle: 0.5, durationCycles: 0.5 }
    ]

    // Act
    const repetitionCycles = findRepetitionCycles(haps)

    // Assert
    expect(repetitionCycles).toBe(1)
  })
})
