import { describe, it, expect } from 'vitest'
import { readTab } from './readTab'
import { loadSampleTabImage } from './sampleTabImage'
import { drawQuarterNoteTab } from './syntheticTab'

const beatsOf = (bar: { beats: number }[]): number =>
  bar.reduce((total, event) => total + event.beats, 0)

describe('readTab on the sample bass tab', () => {
  it('reads all twenty bars as a bass line', async () => {
    // Arrange
    const image = await loadSampleTabImage()

    // Act
    const tab = readTab(image)

    // Assert
    expect(tab.instrument).toBe('bass')
    expect(tab.bars).toHaveLength(20)
  })

  it('fills every bar with exactly four beats', async () => {
    // Arrange
    const image = await loadSampleTabImage()

    // Act
    const tab = readTab(image)

    // Assert
    expect(tab.bars.map(beatsOf).every((beats) => Math.abs(beats - 4) < 0.01)).toBe(true)
  })

  it('reads bar one note for note, with a tie and a triplet', async () => {
    // Arrange
    const image = await loadSampleTabImage()

    // Act
    const [firstBar] = readTab(image).bars

    // Assert
    expect(firstBar.map((event) => event.notes)).toEqual([
      ['a2'],
      ['a2'],
      ['e3'],
      ['e3'],
      ['d3'],
      ['e3'],
      ['d3'],
      ['c3']
    ])
    expect(firstBar.map((event) => event.beats)[2]).toBeCloseTo(1, 5)
    expect(firstBar.map((event) => event.beats)[4]).toBeCloseTo(1 / 6, 5)
  })

  it('reports a mark it cannot read rather than hiding it', async () => {
    // Arrange
    const image = await loadSampleTabImage()

    // Act
    const { warnings } = readTab(image)

    // Assert
    expect(warnings).toEqual(['1 fret numbers could not be read and were skipped'])
  })
})

describe('readTab on a synthetic guitar tab', () => {
  it('names notes from the six open strings and stacks a chord', () => {
    // Arrange
    const image = drawQuarterNoteTab(6, [
      [
        { lineIndex: 5, fret: 3 },
        { lineIndex: 4, fret: 5 }
      ],
      [{ lineIndex: 2, fret: 4 }],
      [{ lineIndex: 1, fret: 6 }],
      [{ lineIndex: 0, fret: 2 }]
    ])

    // Act
    const tab = readTab(image)

    // Assert
    expect(tab.instrument).toBe('guitar')
    expect(tab.bars[0].map((event) => event.notes.toSorted())).toEqual([
      ['d3', 'g2'],
      ['b3'],
      ['f4'],
      ['f#4']
    ])
  })

  it('throws when the image holds no staff', () => {
    // Arrange
    const image = drawQuarterNoteTab(5, [])

    // Act
    const read = (): unknown => readTab(image)

    // Assert
    expect(read).toThrow('No four or six line tab staff')
  })
})
