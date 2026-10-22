import { describe, it, expect } from 'vitest'
import { HERO_LOOKS, DEFAULT_HERO_LOOK } from './config'
import { getNextLook } from './heroLook'

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
