import { describe, it, expect } from 'vitest'
import {
  snapToCell,
  getCellKey,
  isInsideGrid,
  getGridDivisions,
  getGridExtent,
  isDragGesture
} from './grid'

describe('snapToCell', () => {
  it.each([
    ['origin lands in the first positive cell', 0, 4, 2],
    ['anywhere inside a cell gives the same centre', 3.9, 4, 2],
    ['the next cell along', 4, 4, 6],
    ['a negative coordinate snaps to the negative cell centre', -1, 4, -2],
    ['exactly on a negative boundary belongs to the cell above it', -4, 4, -2],
    ['a one unit grid centres on halves', 7.2, 1, 7.5]
  ])('%s', (_case, value, cellSize, expected) => {
    expect(snapToCell(value, cellSize)).toBe(expected)
  })
})

describe('getCellKey', () => {
  it('gives one key to every point inside the same cell', () => {
    expect(getCellKey(0.1, 3.9, 4)).toBe(getCellKey(3.9, 0.1, 4))
  })

  it('separates neighbouring cells', () => {
    expect(getCellKey(3.9, 0, 4)).not.toBe(getCellKey(4.1, 0, 4))
  })

  it('separates a negative cell from its positive mirror', () => {
    expect(getCellKey(-1, -1, 4)).toBe('-1,-1')
    expect(getCellKey(1, 1, 4)).toBe('0,0')
  })
})

describe('isInsideGrid', () => {
  it.each([
    ['the centre', 0, 0, 80, true],
    ['a point on the edge', 40, -40, 80, true],
    ['a point past the edge', 41, 0, 80, false],
    ['a point past the far edge', 0, -41, 80, false]
  ])('%s', (_case, x, z, gridSize, expected) => {
    expect(isInsideGrid(x, z, gridSize)).toBe(expected)
  })
})

describe('getGridDivisions', () => {
  it.each([
    ['an exact division', 80, 4, 20],
    ['a cell that does not divide evenly rounds down', 80, 3, 26],
    ['an odd count drops to the even one below it', 80, 7, 10],
    ['a cell wider than the board still draws a pair', 10, 40, 2]
  ])('%s', (_case, boardSize, cellSize, expected) => {
    expect(getGridDivisions(boardSize, cellSize)).toBe(expected)
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
    'stays even at cell size %i, so lines fall on cell boundaries',
    (cellSize) => {
      expect(getGridDivisions(80, cellSize) % 2).toBe(0)
    }
  )
})

describe('getGridExtent', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
    'draws a whole number of cells at cell size %i',
    (cellSize) => {
      expect(getGridExtent(80, cellSize) % cellSize).toBe(0)
    }
  )

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
    'lines up its half-width with a cell boundary at cell size %i',
    (cellSize) => {
      expect((getGridExtent(80, cellSize) / 2 / cellSize) % 1).toBe(0)
    }
  )

  it('never spills past the board it is drawn on', () => {
    expect(getGridExtent(80, 3)).toBeLessThanOrEqual(80)
  })
})

describe('isDragGesture', () => {
  it.each([
    ['a still pointer is a click', [10, 10], [10, 10], 4, false],
    ['a wobble inside the threshold is a click', [10, 10], [12, 12], 4, false],
    ['a drag past the threshold is not', [10, 10], [40, 10], 4, true],
    ['a diagonal drag counts both axes', [0, 0], [3, 3], 4, true]
  ] as [string, [number, number], [number, number], number, boolean][])(
    '%s',
    (_case, from, to, threshold, expected) => {
      expect(isDragGesture(from, to, threshold)).toBe(expected)
    }
  )
})
