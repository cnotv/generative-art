import { describe, it, expect } from 'vitest'
import {
  generateGrid,
  findWordInGrid,
  scoreWord,
  shuffleArray
} from './squaresMultiplayerUtilities'

describe('scoreWord', () => {
  it.each([
    { word: 'CAT', expected: 1 },
    { word: 'BEAR', expected: 1 },
    { word: 'APPLE', expected: 2 },
    { word: 'CASTLE', expected: 3 },
    { word: 'CHICKEN', expected: 5 },
    { word: 'ELEPHANT', expected: 11 }
  ])('$word → $expected pts', ({ word, expected }) => {
    expect(scoreWord(word)).toBe(expected)
  })
})

describe('findWordInGrid', () => {
  it('finds a word placed horizontally', () => {
    const grid = [
      ['C', 'A', 'T', 'X'],
      ['X', 'X', 'X', 'X'],
      ['X', 'X', 'X', 'X'],
      ['X', 'X', 'X', 'X']
    ]
    expect(findWordInGrid(grid, 'CAT')).toBe(true)
  })

  it('finds a word placed diagonally', () => {
    const grid = [
      ['C', 'X', 'X', 'X'],
      ['X', 'A', 'X', 'X'],
      ['X', 'X', 'T', 'X'],
      ['X', 'X', 'X', 'X']
    ]
    expect(findWordInGrid(grid, 'CAT')).toBe(true)
  })

  it('returns false when letters are present but not adjacent', () => {
    const grid = [
      ['C', 'X', 'X', 'X'],
      ['X', 'X', 'X', 'X'],
      ['X', 'X', 'A', 'X'],
      ['X', 'X', 'X', 'T']
    ]
    expect(findWordInGrid(grid, 'CAT')).toBe(false)
  })

  it('does not reuse the same cell twice for one word', () => {
    const grid = [
      ['A', 'B', 'X', 'X'],
      ['X', 'X', 'X', 'X'],
      ['X', 'X', 'X', 'X'],
      ['X', 'X', 'X', 'X']
    ]
    expect(findWordInGrid(grid, 'ABA')).toBe(false)
  })

  it('is case insensitive', () => {
    const grid = [
      ['C', 'A', 'T', 'X'],
      ['X', 'X', 'X', 'X'],
      ['X', 'X', 'X', 'X'],
      ['X', 'X', 'X', 'X']
    ]
    expect(findWordInGrid(grid, 'cat')).toBe(true)
  })
})

describe('generateGrid', () => {
  it('produces a grid of the requested size', () => {
    const { grid } = generateGrid(['CAT', 'DOG'], 4)
    expect(grid).toHaveLength(4)
    grid.forEach((row) => expect(row).toHaveLength(4))
  })

  it('all cells are single uppercase letters', () => {
    const { grid } = generateGrid(['ANT', 'BEE'], 4)
    grid.forEach((row) => row.forEach((cell) => expect(cell).toMatch(/^[A-Z]$/)))
  })

  it('placed words are findable in the grid', () => {
    const words = ['ANT', 'BEE', 'CAT']
    const { grid, placedWords } = generateGrid(words, 5)
    placedWords.forEach((word) => {
      expect(findWordInGrid(grid, word)).toBe(true)
    })
  })

  it('returns placed words as uppercase', () => {
    const { placedWords } = generateGrid(['ant', 'bee'], 4)
    placedWords.forEach((w) => expect(w).toBe(w.toUpperCase()))
  })
})

describe('shuffleArray', () => {
  it('returns an array of the same length', () => {
    expect(shuffleArray([1, 2, 3, 4, 5])).toHaveLength(5)
  })

  it('contains the same elements', () => {
    const array = [1, 2, 3, 4, 5]
    expect(shuffleArray(array).sort()).toEqual([...array].sort())
  })

  it('does not mutate the original array', () => {
    const array = [1, 2, 3]
    shuffleArray(array)
    expect(array).toEqual([1, 2, 3])
  })
})
