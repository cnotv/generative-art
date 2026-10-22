import { describe, it, expect } from 'vitest'
import { getHeroFrustum } from './heroFrame'

describe('getHeroFrustum', () => {
  it('keeps the fixed height on a wide screen', () => {
    // Act
    const frustum = getHeroFrustum(2, 20, 14)

    // Assert
    expect(frustum).toEqual({ halfWidth: 20, halfHeight: 10 })
  })

  it('widens to the minimum width on an upright phone and grows taller to match', () => {
    // Act
    const frustum = getHeroFrustum(0.5, 20, 14)

    // Assert
    expect(frustum.halfWidth).toBeCloseTo(7)
    expect(frustum.halfHeight).toBeCloseTo(14)
  })
})
