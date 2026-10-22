import { describe, it, expect } from 'vitest'
import { HERO_LOOKS, DEFAULT_HERO_LOOK } from './config'
import { getNextLook, mixLooks } from './heroLook'

describe('HERO_LOOKS', () => {
  it('keeps every attempt as its own preset, including the default', () => {
    // Arrange
    const labels = Object.values(HERO_LOOKS).map(({ label }) => label)

    // Assert
    expect(HERO_LOOKS[DEFAULT_HERO_LOOK]).toBeDefined()
    expect(new Set(labels).size).toBe(labels.length)
    expect(Object.keys(HERO_LOOKS)).toEqual([
      'original',
      'rim',
      'cardstock',
      'spotlitCardstock',
      'letterpress',
      'chrome',
      'polishedChrome'
    ])
  })
})

describe('getNextLook', () => {
  it('moves to the next preset and wraps round after the last', () => {
    // Arrange
    const names = ['original', 'rim', 'chrome']

    // Act
    const sequence = ['original', 'rim', 'chrome'].map((name) => getNextLook(name, names))

    // Assert
    expect(sequence).toEqual(['rim', 'chrome', 'original'])
  })
})

describe('mixLooks', () => {
  it('blends numbers and colours, and switches paper and ink halfway', () => {
    // Arrange
    const { cardstock, letterpress } = HERO_LOOKS

    // Act
    const [start, early, late, end] = [0, 0.25, 0.75, 1].map((share) =>
      mixLooks(cardstock, letterpress, share)
    )

    // Assert
    expect(start).toEqual(cardstock)
    expect(end).toEqual(letterpress)
    expect(early.ambientIntensity).toBeCloseTo(
      cardstock.ambientIntensity + (letterpress.ambientIntensity - cardstock.ambientIntensity) / 4
    )
    expect([early.ink, late.ink]).toEqual([cardstock.ink, letterpress.ink])
  })
})
