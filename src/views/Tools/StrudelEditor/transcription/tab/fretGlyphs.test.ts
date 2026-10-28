import { describe, it, expect } from 'vitest'
import { findFretGlyphs } from './fretGlyphs'
import { findStaffSystems } from './staffLines'
import { loadSampleTabImage } from './sampleTabImage'
import { drawQuarterNoteTab } from './syntheticTab'

describe('findFretGlyphs', () => {
  it('reads the first bar of the sample, one and two digit frets alike', async () => {
    // Arrange
    const image = await loadSampleTabImage()
    const [system] = findStaffSystems(image)

    // Act
    const firstBar = findFretGlyphs(image, system)
      .filter((glyph) => glyph.centerX < 520)
      .toSorted((first, second) => first.centerX - second.centerX)

    // Assert
    expect(firstBar.map((glyph) => glyph.fret)).toEqual([7, 7, 9, 9, 7, 9, 7, 10])
    expect(firstBar.map((glyph) => glyph.lineIndex)).toEqual([1, 1, 0, 0, 0, 0, 0, 1])
  })

  it('does not take a double bar line for a digit', async () => {
    // Arrange
    const image = await loadSampleTabImage()
    const [system] = findStaffSystems(image)

    // Act
    const nearDoubleBar = findFretGlyphs(image, system).filter(
      (glyph) => glyph.centerX > 1555 && glyph.centerX < 1572
    )

    // Assert
    expect(nearDoubleBar).toEqual([])
  })

  it('reads every digit on a staff of a different size and theme', () => {
    // Arrange
    const image = drawQuarterNoteTab(6, [
      [{ lineIndex: 0, fret: 2 }],
      [{ lineIndex: 1, fret: 4 }],
      [{ lineIndex: 2, fret: 6 }],
      [{ lineIndex: 3, fret: 12 }]
    ])
    const [system] = findStaffSystems(image)

    // Act
    const frets = findFretGlyphs(image, system)
      .toSorted((first, second) => first.centerX - second.centerX)
      .map((glyph) => glyph.fret)

    // Assert
    expect(frets).toEqual([2, 4, 6, 12])
  })
})
