import { describe, it, expect, beforeEach } from 'vitest'
import { parseProgress, saveLevelCleared, unlockedLevelCount } from './levelProgress'

describe('parseProgress', () => {
  it.each([
    [null, {}],
    ['not json', {}],
    ['[1]', {}],
    ['{"de": 2, "es": 0}', { de: 2, es: 0 }],
    ['{"de": 2, "fr": -1, "it": 1.5, "es": "3"}', { de: 2 }]
  ])('reads %j as %j', (raw, expected) => {
    expect(parseProgress(raw)).toEqual(expected)
  })
})

describe('unlockedLevelCount and saveLevelCleared', () => {
  beforeEach(() => localStorage.clear())

  it('opens only the first level of a language never played', () => {
    expect(unlockedLevelCount('de', 6)).toBe(1)
  })

  it('opens the next level once one is cleared', () => {
    saveLevelCleared('de', 0)

    expect(unlockedLevelCount('de', 6)).toBe(2)
    expect(unlockedLevelCount('fr', 6)).toBe(1)
  })

  it('never closes a level again by clearing an earlier one', () => {
    saveLevelCleared('de', 2)
    saveLevelCleared('de', 0)

    expect(unlockedLevelCount('de', 6)).toBe(4)
  })

  it('never opens more levels than the language has', () => {
    saveLevelCleared('de', 5)

    expect(unlockedLevelCount('de', 6)).toBe(6)
  })
})
