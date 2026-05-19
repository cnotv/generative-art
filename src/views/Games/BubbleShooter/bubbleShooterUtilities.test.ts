import { describe, it, expect } from 'vitest'
import {
  createGrid,
  cellToWorld,
  worldToNearestCell,
  getNeighbors,
  findMatch,
  findDangling,
  snapToCell,
  trajectoryPoints,
  hasReachedFireLine,
  addGarbageRows,
  addTopRows
} from './bubbleShooterUtilities'
import {
  GRID_ROWS,
  GRID_COLS,
  GRID_TOP_Y,
  BUBBLE_DIAMETER,
  HEX_ROW_HEIGHT,
  BUBBLE_RADIUS,
  FIRE_LINE_Y,
  WALL_LEFT,
  WALL_RIGHT
} from './config'
import type { Grid } from './bubbleShooterUtilities'

const emptyGrid = (): Grid =>
  Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => ({ color: null }))
  )

describe('createGrid', () => {
  it('creates a grid with correct dimensions', () => {
    const grid = createGrid(0)
    expect(grid).toHaveLength(GRID_ROWS)
    expect(grid[0]).toHaveLength(GRID_COLS)
  })

  it('fills top rows with colors (respecting odd-row column limit)', () => {
    const grid = createGrid(3)
    const filledRange = Array.from({ length: 3 }, (_, i) => i)
    const emptyRange = Array.from({ length: GRID_ROWS - 3 }, (_, i) => i + 3)
    const colCount = (r: number): number => (r % 2 === 0 ? GRID_COLS : GRID_COLS - 1)

    filledRange.forEach((r) =>
      Array.from({ length: colCount(r) }, (_, c) => c).forEach((c) => {
        expect(grid[r][c].color).not.toBeNull()
      })
    )
    emptyRange.forEach((r) =>
      Array.from({ length: GRID_COLS }, (_, c) => c).forEach((c) => {
        expect(grid[r][c].color).toBeNull()
      })
    )
  })
})

describe('cellToWorld', () => {
  it('places row 0 col 0 at the correct world position', () => {
    const { x, y } = cellToWorld(0, 0)
    expect(y).toBeCloseTo(GRID_TOP_Y)
    expect(x).toBeCloseTo(-((GRID_COLS - 1) / 2) * BUBBLE_DIAMETER)
  })

  it('shifts odd rows right by half a bubble', () => {
    const even = cellToWorld(0, 0)
    const odd = cellToWorld(1, 0)
    expect(odd.x - even.x).toBeCloseTo(BUBBLE_RADIUS)
  })

  it('increases row index decreases y by HEX_ROW_HEIGHT', () => {
    const r0 = cellToWorld(0, 0)
    const r1 = cellToWorld(1, 0)
    expect(r0.y - r1.y).toBeCloseTo(HEX_ROW_HEIGHT)
  })
})

describe('worldToNearestCell', () => {
  it('round-trips through cellToWorld', () => {
    const { x, y } = cellToWorld(2, 4)
    const { row, col } = worldToNearestCell(x, y)
    expect(row).toBe(2)
    expect(col).toBe(4)
  })

  it('clamps out-of-bounds positions', () => {
    const { row, col } = worldToNearestCell(1000, 1000)
    expect(row).toBeGreaterThanOrEqual(0)
    expect(row).toBeLessThan(GRID_ROWS)
    expect(col).toBeGreaterThanOrEqual(0)
    expect(col).toBeLessThan(GRID_COLS)
  })
})

describe('getNeighbors', () => {
  it('returns left and right neighbors for same row', () => {
    const grid = createGrid(5)
    const neighbors = getNeighbors(0, 4, grid)
    const cols = neighbors.map(([, c]) => c)
    expect(cols).toContain(3)
    expect(cols).toContain(5)
  })

  it('returns no neighbors for an empty grid', () => {
    const grid = emptyGrid()
    const neighbors = getNeighbors(2, 2, grid)
    expect(neighbors).toHaveLength(0)
  })

  it.each([
    [0, 0],
    [0, GRID_COLS - 1],
    [GRID_ROWS - 1, 0]
  ])('does not return out-of-bounds neighbors for cell (%i, %i)', (row, col) => {
    const grid = createGrid(GRID_ROWS)
    const neighbors = getNeighbors(row, col, grid)
    neighbors.forEach(([r, c]) => {
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(GRID_ROWS)
      expect(c).toBeGreaterThanOrEqual(0)
      expect(c).toBeLessThan(GRID_COLS)
    })
  })
})

describe('findMatch', () => {
  it('returns empty array when group is smaller than MIN_MATCH_SIZE', () => {
    const grid = emptyGrid()
    grid[0][0] = { color: 'red' }
    grid[0][1] = { color: 'red' }
    const match = findMatch(0, 0, grid)
    expect(match).toHaveLength(0)
  })

  it('returns the full connected group when ≥ 3', () => {
    const grid = emptyGrid()
    grid[0][0] = { color: 'blue' }
    grid[0][1] = { color: 'blue' }
    grid[0][2] = { color: 'blue' }
    const match = findMatch(0, 0, grid)
    expect(match).toHaveLength(3)
  })

  it('does not cross into different colors', () => {
    const grid = emptyGrid()
    grid[0][0] = { color: 'red' }
    grid[0][1] = { color: 'red' }
    grid[0][2] = { color: 'red' }
    grid[0][3] = { color: 'blue' }
    const match = findMatch(0, 3, grid)
    expect(match).toHaveLength(0)
  })

  it('returns empty array for a null cell', () => {
    const grid = emptyGrid()
    const match = findMatch(5, 5, grid)
    expect(match).toHaveLength(0)
  })
})

describe('findDangling', () => {
  it('returns empty array when all bubbles are connected to ceiling', () => {
    const grid = emptyGrid()
    grid[0][0] = { color: 'red' }
    grid[1][0] = { color: 'red' }
    const dangling = findDangling(grid)
    expect(dangling).toHaveLength(0)
  })

  it('detects bubbles with no path to row 0', () => {
    const grid = emptyGrid()
    grid[3][3] = { color: 'green' }
    const dangling = findDangling(grid)
    expect(dangling).toHaveLength(1)
    expect(dangling[0]).toEqual([3, 3])
  })

  it('returns empty array for a completely empty grid', () => {
    const grid = emptyGrid()
    expect(findDangling(grid)).toHaveLength(0)
  })
})

describe('snapToCell', () => {
  it('snaps to the nearest empty cell', () => {
    const grid = emptyGrid()
    const { x, y } = cellToWorld(3, 4)
    const result = snapToCell(x, y, grid)
    expect(result).not.toBeNull()
    expect(result!.row).toBe(3)
    expect(result!.col).toBe(4)
  })

  it('avoids occupied cells', () => {
    const grid = emptyGrid()
    grid[3][4] = { color: 'red' }
    const { x, y } = cellToWorld(3, 4)
    const result = snapToCell(x, y, grid)
    if (result) {
      expect(grid[result.row][result.col].color).toBeNull()
    }
  })
})

const defaultConfig = {
  wallLeft: WALL_LEFT,
  wallRight: WALL_RIGHT,
  ceilingY: GRID_TOP_Y
}

describe('trajectoryPoints', () => {
  it('returns at least 2 points', () => {
    const grid = emptyGrid()
    const pts = trajectoryPoints(0, 0, -7.5, grid, defaultConfig)
    expect(pts.length).toBeGreaterThanOrEqual(2)
  })

  it('starts at the shooter position', () => {
    const grid = emptyGrid()
    const pts = trajectoryPoints(0, 0, -7.5, grid, defaultConfig)
    expect(pts[0]).toEqual({ x: 0, y: -7.5 })
  })

  it('stops at or before the ceiling', () => {
    const grid = emptyGrid()
    const pts = trajectoryPoints(0, 0, -7.5, grid, defaultConfig)
    const last = pts[pts.length - 1]
    expect(last.y).toBeLessThanOrEqual(GRID_TOP_Y + 0.01)
  })

  it('reflects off walls (x stays within bounds)', () => {
    const grid = emptyGrid()
    const pts = trajectoryPoints(Math.PI * 0.4, 0, -7.5, grid, defaultConfig)
    pts.forEach(({ x }) => {
      expect(x).toBeGreaterThanOrEqual(WALL_LEFT - 0.5)
      expect(x).toBeLessThanOrEqual(WALL_RIGHT + 0.5)
    })
  })
})

describe('hasReachedFireLine', () => {
  it('returns false for an empty grid', () => {
    expect(hasReachedFireLine(emptyGrid(), FIRE_LINE_Y)).toBe(false)
  })

  it('returns true when a bubble is at or below the fire line', () => {
    const grid = emptyGrid()
    const lastRow = GRID_ROWS - 1
    grid[lastRow][0] = { color: 'red' }
    expect(hasReachedFireLine(grid, GRID_TOP_Y)).toBe(true)
  })
})

describe('addGarbageRows', () => {
  it('inserts garbage rows at the top', () => {
    const grid = emptyGrid()
    grid[0][0] = { color: 'red' }
    const newGrid = addGarbageRows(grid, 1)
    expect(newGrid[0][0].color).toBe('garbage')
    expect(newGrid[1][0].color).toBe('red')
  })

  it('keeps total row count the same', () => {
    const newGrid = addGarbageRows(emptyGrid(), 2)
    expect(newGrid).toHaveLength(GRID_ROWS)
  })
})

describe('addTopRows', () => {
  it('shifts existing content down', () => {
    const grid = emptyGrid()
    grid[0][0] = { color: 'blue' }
    const newGrid = addTopRows(grid, 1)
    expect(newGrid[1][0].color).toBe('blue')
  })

  it('fills new top rows with non-null colors (respecting odd-row column limit)', () => {
    const newGrid = addTopRows(emptyGrid(), 2)
    const colCount = (r: number): number => (r % 2 === 0 ? GRID_COLS : GRID_COLS - 1)
    Array.from({ length: colCount(0) }, (_, c) => c).forEach((c) => {
      expect(newGrid[0][c].color).not.toBeNull()
    })
    Array.from({ length: colCount(1) }, (_, c) => c).forEach((c) => {
      expect(newGrid[1][c].color).not.toBeNull()
    })
  })
})
