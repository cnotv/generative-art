import { describe, expect, it } from 'vitest'
import { arrange, note } from '@strudel/core'
import { readScheduledHaps } from './strudelOfflineRender'
import { findLoopBars, findPatternRepetition, findRepetitionCycles } from './patternRepetition'
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

const everyBar = (barCount: number, notes: string[]): StrudelScheduledHap[] =>
  Array.from({ length: barCount }, (_, bar) => hap(bar, 1, notes[bar % notes.length] ?? 'c3'))

describe('findLoopBars', () => {
  it.each([
    ['a one bar groove', everyBar(32, ['c3']), 1],
    ['a three bar melody', everyBar(32, ['c3', 'e3', 'g3']), 3],
    [
      'a three bar bass under a four bar lead, which meet again after twelve',
      [...everyBar(32, ['c2', 'f2', 'g2']), ...everyBar(32, ['c4', 'd4', 'e4', 'f4'])],
      12
    ],
    ['a pattern with no events', [], 1]
  ])('measures %s', (_, haps, expectedBars) => {
    // Act
    const loopBars = findLoopBars(haps, 16)

    // Assert
    expect(loopBars).toBe(expectedBars)
  })

  it('reports no loop when nothing repeats inside the limit', () => {
    // Arrange
    const haps = Array.from({ length: 32 }, (_, bar) => hap(bar, 1, `n${bar}`))

    // Act
    const loopBars = findLoopBars(haps, 16)

    // Assert
    expect(loopBars).toBeNull()
  })
})

const readSongHaps = (pattern: unknown, maxCycles: number): StrudelScheduledHap[] =>
  readScheduledHaps(
    pattern,
    { format: 'wav', fileName: '', sampleRate: 48000, startCycle: 0, endCycle: maxCycles * 2 },
    0.5
  )

describe('findPatternRepetition', () => {
  it('measures every section of an arrange, not just its first bar', () => {
    // Arrange
    const verse = note('c3 e3 g3 e3')
    const chorus = note('<f3 a3> c4')
    const song = arrange([8, verse], [8, chorus], [4, verse])

    // Act
    const repetitionCycles = findPatternRepetition(readSongHaps(song, 64), 64)

    // Assert
    expect(repetitionCycles).toBe(20)
  })

  it('measures a coin sped up with fast(2) as half a cycle', () => {
    // Arrange
    const coin = note('b5 e6@3 ~@4').fast(2)

    // Act
    const repetitionCycles = findPatternRepetition(readSongHaps(coin, 64), 64)

    // Assert
    expect(repetitionCycles).toBe(0.5)
  })

  it('reports no repetition when nothing repeats inside the limit', () => {
    // Arrange
    const haps = Array.from({ length: 32 }, (_, bar) => hap(bar, 1, `n${bar}`))

    // Act
    const repetitionCycles = findPatternRepetition(haps, 16)

    // Assert
    expect(repetitionCycles).toBeNull()
  })
})
