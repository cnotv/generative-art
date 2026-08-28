import { describe, it, expect } from 'vitest'
import { resolveStrokeMode } from './strokes'
import { ERASE_MODEL } from './config'

describe('resolveStrokeMode', () => {
  it.each([
    ['an empty cell fills', 'house', undefined, 'placing'],
    ['the same component again empties', 'house', 'house', 'erasing'],
    ['a different component replaces', 'road', 'house', 'placing'],
    ['a different component replaces, the other way round', 'house', 'road', 'placing'],
    ['the eraser empties an occupied cell', ERASE_MODEL, 'house', 'erasing'],
    ['the eraser empties an empty one too', ERASE_MODEL, undefined, 'erasing']
  ])('%s', (_case, selected, occupant, expected) => {
    expect(resolveStrokeMode(selected, occupant, ERASE_MODEL)).toBe(expected)
  })
})
