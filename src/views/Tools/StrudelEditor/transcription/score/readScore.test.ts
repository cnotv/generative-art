import { describe, it, expect } from 'vitest'
import type { TabEvent } from '../../types'
import { lineGapOf } from '../tab/staffLines'
import { findGrandStaves, findGrandStaffBars } from './grandStaves'
import { readPrelude } from './prelude'
import { readScore } from './readScore'
import { loadSampleScoreImage } from './sampleScoreImage'
import { buildScoreMasks } from './scoreMasks'
import { drawGrandStaffScore } from './syntheticScore'

const beatsOf = (events: TabEvent[]): number =>
  events.reduce((total, event) => total + event.beats, 0)

const notesOf = (events: TabEvent[]): string[][] => events.map((event) => event.notes)

const beatList = (events: TabEvent[]): number[] => events.map((event) => event.beats)

describe('the page structure of the sample score', () => {
  it('pairs ten staves into five grand staves with fifteen bars between them', async () => {
    // Arrange
    const image = await loadSampleScoreImage()

    // Act
    const grandStaves = findGrandStaves(image)
    const barCount = grandStaves.reduce(
      (total, grandStaff) => total + findGrandStaffBars(image, grandStaff).length,
      0
    )

    // Assert
    expect(grandStaves).toHaveLength(5)
    expect(barCount).toBe(15)
  })

  it('reads the clefs, the three sharps of A major and common time', async () => {
    // Arrange
    const image = await loadSampleScoreImage()
    const [first] = findGrandStaves(image)
    const masks = buildScoreMasks(image, lineGapOf(first.treble))

    // Act
    const treble = readPrelude(image, masks, first.treble, true)
    const bass = readPrelude(image, masks, first.bass, true)

    // Assert
    expect([treble.clef, treble.keyAccidentals, treble.beatsPerBar]).toEqual(['treble', 3, 4])
    expect([bass.clef, bass.keyAccidentals]).toEqual(['bass', 3])
  })
})

describe('readScore on the sample score', () => {
  it('reads the tempo marker and the metre', async () => {
    // Arrange
    const image = await loadSampleScoreImage()

    // Act
    const score = readScore(image)

    // Assert
    expect(score.beatsPerMinute).toBe(65)
    expect(score.beatsPerBar).toBe(4)
    expect(score.bars).toHaveLength(15)
  })

  it('puts the opening pickup at the end of its bar, after a rest', async () => {
    // Arrange
    const image = await loadSampleScoreImage()

    // Act
    const [pickup] = readScore(image).bars

    // Assert
    expect(pickup.rightHand).toEqual([
      { notes: [], beats: 3.5 },
      { notes: ['a4'], beats: 0.25 },
      { notes: ['c#5'], beats: 0.25 }
    ])
    expect(beatsOf(pickup.rightHand)).toBe(4)
    expect(notesOf(pickup.leftHand).flat()).toEqual([])
  })

  it('reads the first full bar note for note in both hands', async () => {
    // Arrange
    const image = await loadSampleScoreImage()

    // Act
    const { rightHand, leftHand } = readScore(image).bars[1]

    // Assert
    expect(notesOf(rightHand).flat()).toEqual(['a5', 'g#5', 'a5', 'g#5', 'a5', 'e5', 'a5', 'd5'])
    expect(beatList(rightHand)).toEqual([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])
    expect(notesOf(leftHand).flat()).toEqual(['f#3', 'c#4', 'g#4', 'd3', 'a3', 'f#4'])
    expect(beatList(leftHand)).toEqual([0.5, 0.5, 1, 0.5, 0.5, 1])
  })

  it('holds a dotted half note for three beats in both hands', async () => {
    // Arrange
    const image = await loadSampleScoreImage()

    // Act
    const { rightHand, leftHand } = readScore(image).bars[2]

    // Assert
    expect(rightHand[0]).toEqual({ notes: ['d5'], beats: 3 })
    expect(leftHand).toEqual([
      { notes: ['f#4'], beats: 3 },
      { notes: [], beats: 1 }
    ])
  })

  it('fills every left hand bar and the first six right hand bars with exactly four beats', async () => {
    // Arrange
    const image = await loadSampleScoreImage()

    // Act
    const { bars } = readScore(image)

    // Assert
    expect(bars.every((bar) => Math.abs(beatsOf(bar.leftHand) - 4) < 0.01)).toBe(true)
    expect(bars.slice(0, 6).every((bar) => Math.abs(beatsOf(bar.rightHand) - 4) < 0.01)).toBe(true)
  })

  it('names each bar it could not make add up, and the marks it skipped, rather than hiding them', async () => {
    // Arrange
    const image = await loadSampleScoreImage()

    // Act
    const { bars, warnings } = readScore(image)
    const offBars = bars.flatMap((bar, index) =>
      Math.abs(beatsOf(bar.rightHand) - 4) > 0.01 ? [index + 1] : []
    )

    // Assert
    expect(offBars.length).toBeGreaterThan(0)
    expect(
      offBars.every((barNumber) =>
        warnings.some((warning) => warning.startsWith(`Bar ${barNumber}, right hand`))
      )
    ).toBe(true)
    expect(warnings.some((warning) => warning.startsWith('Skipped marks'))).toBe(true)
  })
})

describe('readScore on a drawn grand staff at another zoom', () => {
  it('reads quarter notes and applies the one sharp of the key', () => {
    // Arrange
    const image = drawGrandStaffScore()

    // Act
    const [first] = readScore(image).bars

    // Assert
    expect(first.rightHand).toEqual([
      { notes: ['c5'], beats: 1 },
      { notes: ['e5'], beats: 1 },
      { notes: ['g5'], beats: 1 },
      { notes: ['f#5'], beats: 1 }
    ])
    expect(first.leftHand).toEqual([{ notes: ['g2'], beats: 4 }])
  })

  it('reads a half note, beamed eighths, a rest and a printed sharp', () => {
    // Arrange
    const image = drawGrandStaffScore()

    // Act
    const [, second] = readScore(image).bars

    // Assert
    expect(second.rightHand).toEqual([
      { notes: ['a4'], beats: 2 },
      { notes: ['b4'], beats: 0.5 },
      { notes: ['c5'], beats: 0.5 },
      { notes: [], beats: 1 }
    ])
    expect(notesOf(second.leftHand).flat()).toEqual(['a2', 'c#3', 'd3', 'f#3'])
  })

  it('assumes four beats and says so when no metre is printed', () => {
    // Arrange
    const image = drawGrandStaffScore()

    // Act
    const score = readScore(image)

    // Assert
    expect(score.beatsPerBar).toBe(4)
    expect(score.warnings).toContain('No metre was read, so 4/4 is assumed')
  })

  it('refuses an image with no grand staff', () => {
    // Arrange
    const blank = { width: 10, height: 10, deviation: new Uint8Array(100) }

    // Act
    const read = (): unknown => readScore(blank)

    // Assert
    expect(read).toThrow('No grand staff')
  })
})
