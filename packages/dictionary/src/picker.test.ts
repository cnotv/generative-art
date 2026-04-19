import { describe, it, expect } from 'vitest'
import { dictionaryGetWords, dictionaryPickRandom, dictionaryMaskWord } from './picker'

describe('dictionaryGetWords', () => {
  it.each(['easy', 'medium', 'hard'] as const)('returns a non-empty list for %s', (difficulty) => {
    const list = dictionaryGetWords(difficulty)
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((word) => typeof word === 'string' && word.length > 0)).toBe(true)
  })
})

describe('dictionaryPickRandom', () => {
  it('uses the random source to select a deterministic index', () => {
    const list = dictionaryGetWords('easy')
    const word = dictionaryPickRandom('easy', () => 0)
    expect(word).toBe(list[0])
  })

  it('returns the last word when random returns close to 1', () => {
    const list = dictionaryGetWords('medium')
    const word = dictionaryPickRandom('medium', () => 0.9999)
    expect(word).toBe(list[list.length - 1])
  })
})

describe('dictionaryMaskWord', () => {
  it('fully masks at reveal ratio 0', () => {
    expect(dictionaryMaskWord('apple', 0)).toBe('_____')
  })

  it('fully reveals at reveal ratio 1', () => {
    expect(dictionaryMaskWord('apple', 1)).toBe('apple')
  })

  it('partially reveals at 0.5', () => {
    const masked = dictionaryMaskWord('apple', 0.5)
    expect(masked).toHaveLength(5)
    expect(masked).not.toBe('apple')
    expect(masked).not.toBe('_____')
  })

  it('preserves spaces in multi-word targets', () => {
    const masked = dictionaryMaskWord('ice cream', 0)
    expect(masked).toBe('___ _____')
  })
})
