import { describe, it, expect } from 'vitest'
import { chatGuessMatches } from './match'

describe('chatGuessMatches', () => {
  it.each([
    ['apple', 'apple', true],
    ['Apple', 'apple', true],
    ['  apple  ', 'apple', true],
    ['APPLE', 'Apple', true],
    ['banana', 'apple', false],
    ['app', 'apple', false],
    ['', 'apple', false],
    ['apple', '', false]
  ])('chatGuessMatches(%o, %o) === %s', (guess, target, expected) => {
    expect(chatGuessMatches(guess, target)).toBe(expected)
  })
})
