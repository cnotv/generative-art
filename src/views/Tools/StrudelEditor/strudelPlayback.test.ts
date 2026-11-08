import { describe, expect, it } from 'vitest'
import { readHapSourceOffsets } from './strudelPlayback'

describe('readHapSourceOffsets', () => {
  it('reads the start of every location of each hap, in order', () => {
    // Arrange
    const haps = [
      {
        context: {
          locations: [
            { start: 4, end: 8 },
            { start: 30, end: 34 }
          ]
        }
      }
    ]

    // Act
    const offsets = readHapSourceOffsets(haps)

    // Assert
    expect(offsets).toEqual([[4, 30]])
  })

  it('skips a hap without a context or locations', () => {
    // Arrange
    const haps = ['hap', {}, { context: {} }, { context: { locations: [] } }]

    // Act
    const offsets = readHapSourceOffsets(haps)

    // Assert
    expect(offsets).toEqual([])
  })
})
