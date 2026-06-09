import {
  GRID_ROWS,
  GRID_COLS,
  BUBBLE_DIAMETER,
  HEX_ROW_HEIGHT,
  BUBBLE_RADIUS,
  GRID_TOP_Y,
  MIN_MATCH_SIZE,
  BUBBLE_COLORS,
  INITIAL_FILLED_ROWS,
  type BubbleColor
} from './config'
import type { GridCell, Grid, Coord, TrajectoryConfig } from './types'

export type { GridCell, Grid, Coord, TrajectoryConfig }

const rowRange = Array.from({ length: GRID_ROWS }, (_, i) => i)
const colRange = Array.from({ length: GRID_COLS }, (_, i) => i)

/** Odd rows have one fewer column to stay within the wall boundaries. */
const rowColCount = (row: number): number => (row % 2 === 0 ? GRID_COLS : GRID_COLS - 1)

/**
 * Create an empty grid with a given number of pre-filled rows at the top.
 * @param filledRows - Number of rows to fill with random colors.
 * @returns A fresh GRID_ROWS × GRID_COLS grid.
 */
export const createGrid = (
  filledRows = INITIAL_FILLED_ROWS,
  colorCount: number = BUBBLE_COLORS.length
): Grid => {
  const palette = BUBBLE_COLORS.slice(0, colorCount)
  return rowRange.map((row) =>
    colRange.map((col) => ({
      color:
        row < filledRows && col < rowColCount(row)
          ? (palette[Math.floor(Math.random() * palette.length)] as BubbleColor)
          : null
    }))
  )
}

/**
 * Convert grid coordinates to world-space center position.
 * @param row - Grid row (0 = top).
 * @param col - Grid column.
 * @returns World x/y center of that cell.
 */
export const cellToWorld = (row: number, col: number): { x: number; y: number } => ({
  x: (col - (GRID_COLS - 1) / 2) * BUBBLE_DIAMETER + (row % 2 === 1 ? BUBBLE_RADIUS : 0),
  y: GRID_TOP_Y - row * HEX_ROW_HEIGHT
})

/**
 * Find the grid cell nearest to a world-space position (may be occupied).
 * @param x - World x.
 * @param y - World y.
 * @returns Nearest { row, col } clamped to grid bounds.
 */
export const worldToNearestCell = (x: number, y: number): { row: number; col: number } => {
  const rawRow = Math.round((GRID_TOP_Y - y) / HEX_ROW_HEIGHT)
  const row = Math.max(0, Math.min(GRID_ROWS - 1, rawRow))
  const offsetX = x - (row % 2 === 1 ? BUBBLE_RADIUS : 0)
  const col = Math.round(offsetX / BUBBLE_DIAMETER + (GRID_COLS - 1) / 2)
  return { row, col: Math.max(0, Math.min(GRID_COLS - 1, col)) }
}

const isInBounds = (r: number, c: number): boolean =>
  r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS

/**
 * Return all occupied neighbors of a grid cell, accounting for hex offset.
 * @param row - Cell row.
 * @param col - Cell column.
 * @param grid - Current grid state.
 * @returns Array of [row, col] pairs for occupied neighbors.
 */
export const getNeighbors = (row: number, col: number, grid: Grid): Coord[] => {
  const isOdd = row % 2 === 1
  const candidates: Coord[] = [
    [row, col - 1],
    [row, col + 1],
    [row - 1, isOdd ? col : col - 1],
    [row - 1, isOdd ? col + 1 : col],
    [row + 1, isOdd ? col : col - 1],
    [row + 1, isOdd ? col + 1 : col]
  ]
  return candidates.filter(([r, c]) => isInBounds(r, c) && grid[r][c].color !== null)
}

/**
 * BFS from a cell to find all connected cells of the same color.
 * @param startRow - Starting row.
 * @param startCol - Starting column.
 * @param grid - Current grid state.
 * @returns All cells in the matching group (empty array if group < MIN_MATCH_SIZE).
 */
export const findMatch = (startRow: number, startCol: number, grid: Grid): Coord[] => {
  const targetColor = grid[startRow]?.[startCol]?.color
  if (!targetColor) return []

  const bfsStep = (state: {
    visited: Set<string>
    result: Coord[]
    queue: Coord[]
  }): typeof state => {
    if (state.queue.length === 0) return state
    const [[r, c], ...rest] = state.queue
    const key = `${r},${c}`
    if (state.visited.has(key)) return bfsStep({ ...state, queue: rest })
    const nextVisited = new Set(state.visited)
    nextVisited.add(key)
    if (grid[r][c].color !== targetColor)
      return bfsStep({ ...state, visited: nextVisited, queue: rest })
    const nextQueue = [
      ...rest,
      ...getNeighbors(r, c, grid).filter(
        ([nr, nc]) => !nextVisited.has(`${nr},${nc}`) && grid[nr][nc].color === targetColor
      )
    ]
    return bfsStep({ visited: nextVisited, result: [...state.result, [r, c]], queue: nextQueue })
  }

  const { result } = bfsStep({ visited: new Set(), result: [], queue: [[startRow, startCol]] })
  return result.length >= MIN_MATCH_SIZE ? result : []
}

/**
 * BFS from the top row to find all reachable cells; return all that are NOT reachable (dangling).
 * @param grid - Current grid state.
 * @returns Array of [row, col] pairs for dangling (unsupported) cells.
 */
export const findDangling = (grid: Grid): Coord[] => {
  const initialQueue: Coord[] = colRange
    .filter((c) => grid[0][c].color !== null)
    .map((c): Coord => [0, c])

  const bfsStep = (state: { visited: Set<string>; queue: Coord[] }): typeof state => {
    if (state.queue.length === 0) return state
    const [[r, c], ...rest] = state.queue
    const key = `${r},${c}`
    if (state.visited.has(key)) return bfsStep({ ...state, queue: rest })
    const nextVisited = new Set(state.visited)
    nextVisited.add(key)
    const nextQueue = [
      ...rest,
      ...getNeighbors(r, c, grid).filter(([nr, nc]) => !nextVisited.has(`${nr},${nc}`))
    ]
    return bfsStep({ visited: nextVisited, queue: nextQueue })
  }

  const { visited: reachable } = bfsStep({ visited: new Set(), queue: initialQueue })

  return rowRange.flatMap((r) =>
    colRange
      .filter((c) => grid[r][c].color !== null && !reachable.has(`${r},${c}`))
      .map((c): Coord => [r, c])
  )
}

/**
 * Find the nearest empty grid cell to a world-space position.
 * @param x - World x of landing point.
 * @param y - World y of landing point.
 * @param grid - Current grid state.
 * @returns Nearest empty { row, col }, or null if none found nearby.
 */
export const snapToCell = (
  x: number,
  y: number,
  grid: Grid
): { row: number; col: number } | null => {
  const { row: nearRow, col: nearCol } = worldToNearestCell(x, y)
  const offsets = [-2, -1, 0, 1, 2]
  const candidates = offsets.flatMap((dr) =>
    offsets
      .map((dc): Coord => [nearRow + dr, nearCol + dc])
      .filter(([r, c]) => isInBounds(r, c) && c < rowColCount(r) && grid[r][c].color === null)
  )
  if (candidates.length === 0) return null
  return candidates.reduce<{ row: number; col: number; dist: number }>(
    (best, [r, c]) => {
      const { x: wx, y: wy } = cellToWorld(r, c)
      const distribution = Math.hypot(wx - x, wy - y)
      return distribution < best.dist ? { row: r, col: c, dist: distribution } : best
    },
    { row: -1, col: -1, dist: Infinity }
  )
}

/**
 * Compute the preview trajectory as a series of world-space points.
 * Reflects off left/right walls and stops at the ceiling or a grid bubble.
 * @param angle - Aim angle in radians (0 = straight up).
 * @param shooterX - Shooter world x.
 * @param shooterY - Shooter world y.
 * @param grid - Current grid state (to stop preview at existing bubbles).
 * @param config - Wall/ceiling bounds and tuning parameters.
 * @returns Array of {x, y} world points forming the trajectory.
 */
export const trajectoryPoints = (
  angle: number,
  shooterX: number,
  shooterY: number,
  grid: Grid,
  config: TrajectoryConfig
): { x: number; y: number }[] => {
  const {
    wallLeft,
    wallRight,
    ceilingY,
    maxReflections = 2,
    stepSize = 0.08,
    maxSteps = 300
  } = config

  type TrajectoryState = {
    x: number
    y: number
    dx: number
    dy: number
    reflections: number
    points: { x: number; y: number }[]
    done: boolean
  }

  const step = (state: TrajectoryState): TrajectoryState => {
    if (state.done) return state
    let { x, y, dx, reflections } = state
    const { dy } = state
    x += dx * stepSize
    y += dy * stepSize

    if (x <= wallLeft) {
      x = wallLeft
      dx = Math.abs(dx)
      reflections++
    } else if (x >= wallRight) {
      x = wallRight
      dx = -Math.abs(dx)
      reflections++
    }

    if (reflections > maxReflections || y >= ceilingY) {
      return {
        ...state,
        x,
        y: Math.min(y, ceilingY),
        dx,
        dy,
        reflections,
        points: [...state.points, { x, y: Math.min(y, ceilingY) }],
        done: true
      }
    }

    const { row, col } = worldToNearestCell(x, y)
    if (isInBounds(row, col) && grid[row][col].color !== null) {
      const { x: bx, y: by } = cellToWorld(row, col)
      if (Math.hypot(x - bx, y - by) < BUBBLE_DIAMETER) {
        return {
          ...state,
          x,
          y,
          dx,
          dy,
          reflections,
          points: [...state.points, { x, y }],
          done: true
        }
      }
    }

    return { x, y, dx, dy, reflections, points: [...state.points, { x, y }], done: false }
  }

  const initial: TrajectoryState = {
    x: shooterX,
    y: shooterY,
    dx: Math.sin(angle),
    dy: Math.cos(angle),
    reflections: 0,
    points: [{ x: shooterX, y: shooterY }],
    done: false
  }

  const iterate = (state: TrajectoryState, remaining: number): TrajectoryState => {
    if (state.done || remaining <= 0) return state
    return iterate(step(state), remaining - 1)
  }

  return iterate(initial, maxSteps).points
}

/**
 * Pick a random color that exists in the current grid (avoids introducing new colors).
 * @param grid - Current grid state.
 * @returns A BubbleColor present in the grid, or a random base color if grid is empty.
 */
export const pickNextColor = (grid: Grid): BubbleColor => {
  const present = grid.flatMap((row) =>
    row.flatMap((cell) => (cell.color && cell.color !== 'garbage' ? [cell.color] : []))
  )
  const pool = present.length > 0 ? present : [...BUBBLE_COLORS]
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Check whether any bubble has descended at or below the fire line.
 * @param grid - Current grid state.
 * @param fireLineY - The y threshold.
 * @returns True if game should end.
 */
export const hasReachedFireLine = (grid: Grid, fireLineY: number): boolean =>
  rowRange.some((r) =>
    colRange.some((c) => grid[r][c].color !== null && cellToWorld(r, c).y <= fireLineY)
  )

/**
 * Add rows of garbage bubbles to the top of the grid (shifting existing content down).
 * @param grid - Current grid state.
 * @param count - Number of garbage rows to add.
 * @returns New grid with garbage rows inserted at the top.
 */
export const addGarbageRows = (grid: Grid, count: number): Grid =>
  rowRange.map((r) =>
    colRange.map((c) => ({
      color:
        c >= rowColCount(r)
          ? null
          : r < count
            ? ('garbage' as BubbleColor)
            : (grid[r - count]?.[c]?.color ?? null)
    }))
  )

/**
 * Push all existing rows down and insert new random rows at the top (single-player pressure).
 * @param grid - Current grid state.
 * @param count - Number of new rows to add at the top.
 * @returns New grid with additional rows prepended.
 */
export const addTopRows = (grid: Grid, count: number): Grid =>
  rowRange.map((r) =>
    colRange.map((c) => ({
      color:
        c >= rowColCount(r)
          ? null
          : r < count
            ? (BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)] as BubbleColor)
            : (grid[r - count]?.[c]?.color ?? null)
    }))
  )

/**
 * Count the number of fully-cleared rows (all null) starting from the bottom.
 * @param grid - Current grid state.
 * @returns Number of empty rows cleared from the bottom.
 */
export const countClearedRows = (grid: Grid): number => {
  const firstNonEmpty = [...rowRange]
    .reverse()
    .findIndex((r) => grid[r].some((cell) => cell.color !== null))
  return firstNonEmpty === -1 ? GRID_ROWS : firstNonEmpty
}
