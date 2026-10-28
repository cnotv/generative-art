import { describe, it, expect } from 'vitest'
import { findStems } from './rhythmRow'
import { findStaffSystems } from './staffLines'
import { loadSampleTabImage } from './sampleTabImage'

describe('findStems', () => {
  it('counts beams and flags in the first bar of the sample', async () => {
    // Arrange
    const image = await loadSampleTabImage()
    const [system] = findStaffSystems(image)

    // Act
    const firstBar = findStems(image, system).filter((stem) => stem.x < 520)

    // Assert
    expect(firstBar.map((stem) => stem.beams)).toEqual([0, 1, 1, 1, 1, 2, 2, 2, 1])
  })

  it('marks only the stems under the triplet bracket', async () => {
    // Arrange
    const image = await loadSampleTabImage()
    const [system] = findStaffSystems(image)

    // Act
    const firstBar = findStems(image, system).filter((stem) => stem.x < 520)

    // Assert
    expect(firstBar.map((stem) => stem.isTriplet)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      true,
      true,
      false
    ])
  })
})
