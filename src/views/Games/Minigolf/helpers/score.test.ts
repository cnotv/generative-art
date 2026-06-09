import { describe, it, expect } from 'vitest'
import { classifyScore } from './score'

describe('classifyScore', () => {
  it.each([
    [1, 4, 'hole-in-one', 'Hole in one!'],
    [1, 1, 'hole-in-one', 'Hole in one!'],
    [2, 4, 'eagle', 'Eagle!'],
    [3, 5, 'eagle', 'Eagle!'],
    [3, 4, 'birdie', 'Birdie!'],
    [4, 4, 'par', 'Par'],
    [5, 4, 'bogey', 'Bogey'],
    [6, 4, 'double-bogey-plus', 'Double bogey'],
    [10, 4, 'double-bogey-plus', 'Double bogey']
  ])('classifies %i strokes on a par %i hole as %s', (strokes, par, type, label) => {
    const result = classifyScore(strokes, par)
    expect(result.type).toBe(type)
    expect(result.label).toBe(label)
  })
})
