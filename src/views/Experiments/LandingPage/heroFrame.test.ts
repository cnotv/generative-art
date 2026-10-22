import { describe, it, expect } from 'vitest'
import { getHeroFrustum, getHeroScrollFade } from './heroFrame'

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

describe('getHeroScrollFade', () => {
  it('leaves the hero untouched before scrolling and fully covered once scrolled past', () => {
    // Act
    const [top, gone] = [getHeroScrollFade(0, 800, 0.85), getHeroScrollFade(800, 800, 0.85)]

    // Assert
    expect(top).toEqual({ light: 1, cover: 0 })
    expect(gone.light).toBeCloseTo(0.15)
    expect(gone.cover).toBe(1)
  })

  it('dims the lights before the cover starts closing', () => {
    // Act
    const early = getHeroScrollFade(120, 800, 0.85)

    // Assert
    expect(early.light).toBeLessThan(1)
    expect(early.cover).toBe(0)
  })
})
