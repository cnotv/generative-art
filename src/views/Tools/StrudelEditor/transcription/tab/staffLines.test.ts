import { describe, it, expect } from 'vitest'
import { findStaffSystems, lineGapOf } from './staffLines'
import { findBarSpans } from './barLines'
import { loadSampleTabImage } from './sampleTabImage'
import { drawQuarterNoteTab } from './syntheticTab'

describe('findStaffSystems', () => {
  it('finds the four four-line staves of the sample tab', async () => {
    // Arrange
    const image = await loadSampleTabImage()

    // Act
    const systems = findStaffSystems(image)

    // Assert
    expect(systems.map((system) => system.lineYs.length)).toEqual([4, 4, 4, 4])
    expect(Math.round(lineGapOf(systems[0]))).toBe(13)
    expect(systems[0].startX).toBeGreaterThan(80)
    expect(systems[1].startX).toBeLessThan(70)
  })

  it('finds a six-line staff on a light page', () => {
    // Arrange
    const image = drawQuarterNoteTab(6, [[{ lineIndex: 0, fret: 3 }]])

    // Act
    const systems = findStaffSystems(image)

    // Assert
    expect(systems).toHaveLength(1)
    expect(systems[0].lineYs).toHaveLength(6)
    expect(lineGapOf(systems[0])).toBe(20)
  })

  it('ignores a page with no staff', () => {
    // Arrange
    const image = drawQuarterNoteTab(5, [])

    // Act
    const systems = findStaffSystems(image)

    // Assert
    expect(systems).toEqual([])
  })
})

describe('findBarSpans', () => {
  it('splits each staff of the sample into its five bars', async () => {
    // Arrange
    const image = await loadSampleTabImage()
    const systems = findStaffSystems(image)

    // Act
    const barCounts = systems.map((system) => findBarSpans(image, system).length)

    // Assert
    expect(barCounts).toEqual([5, 5, 5, 5])
  })

  it('ignores the clef digits and the playback cursor drawn across a staff', async () => {
    // Arrange
    const image = await loadSampleTabImage()
    const [first, second] = findStaffSystems(image)

    // Act
    const firstBars = findBarSpans(image, first)
    const secondBars = findBarSpans(image, second)

    // Assert
    expect(firstBars[0].endX).toBeGreaterThan(500)
    expect(secondBars[1].endX).toBeGreaterThan(800)
  })
})
