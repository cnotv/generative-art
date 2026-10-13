import { describe, expect, it } from 'vitest'
import {
  canopyCenterFor,
  canopySizeFor,
  isOnRoadSurface,
  isRoadLeaf,
  leafColorFor,
  leafRestHeight,
  leafXFor,
  leafZFor,
  pickPaletteColor,
  trunkDimensions,
  vergeXFor
} from './forestRoad'
import { ROAD_TOP_Y, VERGE_TOP_Y } from './config'

describe('isOnRoadSurface', () => {
  it.each([
    { x: 0, halfWidth: 1.7, expected: true },
    { x: 1.7, halfWidth: 1.7, expected: true },
    { x: 1.71, halfWidth: 1.7, expected: false },
    { x: -5, halfWidth: 1.7, expected: false }
  ])('x=$x halfWidth=$halfWidth is $expected', ({ x, halfWidth, expected }) => {
    // Arrange
    // Act
    const result = isOnRoadSurface(x, halfWidth)
    // Assert
    expect(result).toBe(expected)
  })
})

describe('leafRestHeight', () => {
  it.each([
    { x: 0, expected: ROAD_TOP_Y + 0.02 },
    { x: 8, expected: VERGE_TOP_Y + 0.03 }
  ])('x=$x rests at $expected', ({ x, expected }) => {
    // Arrange
    const halfWidth = 1.7
    // Act
    const result = leafRestHeight(x, halfWidth)
    // Assert
    expect(result).toBe(expected)
  })
})

describe('pickPaletteColor', () => {
  it.each([
    { index: 0, expected: 10 },
    { index: 2, expected: 30 },
    { index: 3, expected: 10 }
  ])('index=$index wraps to $expected', ({ index, expected }) => {
    // Arrange
    const palette = [10, 20, 30]
    // Act
    const result = pickPaletteColor(palette, index)
    // Assert
    expect(result).toBe(expected)
  })
})

describe('trunkDimensions', () => {
  it.each([
    { randomValue: 0, expectedDiameter: 0.28, expectedHeight: 7 },
    { randomValue: 1, expectedDiameter: 0.5, expectedHeight: 11 }
  ])(
    'randomValue=$randomValue maps to the range ends',
    ({ randomValue, expectedDiameter, expectedHeight }) => {
      // Arrange
      // Act
      const result = trunkDimensions(randomValue)
      // Assert
      expect(result.diameter).toBeCloseTo(expectedDiameter, 5)
      expect(result.height).toBeCloseTo(expectedHeight, 5)
    }
  )
})

describe('canopy helpers', () => {
  it('sizes within the declared range', () => {
    // Arrange
    // Act
    const result = canopySizeFor(0.5)
    // Assert
    expect(result).toBeGreaterThanOrEqual(1.1)
    expect(result).toBeLessThanOrEqual(1.7)
  })

  it('centers above the trunk top', () => {
    // Arrange
    const trunkPosition: [number, number, number] = [2, 0, -10]
    // Act
    const result = canopyCenterFor(trunkPosition, 8, 3)
    // Assert
    expect(result).toEqual([2, 9.2, -10])
  })
})

describe('leaf placement', () => {
  it.each([
    { selector: 0.2, share: 0.4, expected: true },
    { selector: 0.4, share: 0.4, expected: false },
    { selector: 0.9, share: 0.4, expected: false }
  ])('selector=$selector share=$share is road leaf: $expected', ({ selector, share, expected }) => {
    // Arrange
    // Act
    const result = isRoadLeaf(selector, share)
    // Assert
    expect(result).toBe(expected)
  })

  it('spreads road leaves across the full width', () => {
    // Arrange
    // Act
    const result = leafXFor(0, 1.7, 12)
    // Assert
    expect(result).toBeCloseTo(-12, 5)
  })

  it.each([
    { distance: 0, expected: 8 },
    { distance: 1, expected: -110 },
    { distance: 0.5, expected: -51 }
  ])('distance=$distance runs down the road to $expected', ({ distance, expected }) => {
    // Arrange
    // Act
    const result = leafZFor(distance, 8, -110)
    // Assert
    expect(result).toBeCloseTo(expected, 5)
  })

  it.each([
    { side: 0.2, distance: 0, expected: -1.7 },
    { side: 0.8, distance: 1, expected: 12 }
  ])('verge leaf lands outside the road', ({ side, distance, expected }) => {
    // Arrange
    // Act
    const result = vergeXFor(side, distance, 1.7, 12)
    // Assert
    expect(result).toBeCloseTo(expected, 5)
  })

  it('draws leaf colors from the litter palette', () => {
    // Arrange
    // Act
    const result = leafColorFor(0)
    // Assert
    expect(result).toBe(0x8a6b3a)
  })
})
