import type { CoordinateTuple } from '@webgamekit/animation'

export type MazeAlgorithm =
  | 'recursive-backtracker'
  | 'hunt-and-kill'
  | 'prims'
  | 'kruskals'
  | 'wilsons'
  | 'aldous-broder'
  | 'ellers'
  | 'recursive-division'
  | 'binary-tree'
  | 'sidewinder'

export const MAZE_ALGORITHM_LABELS: Record<MazeAlgorithm, string> = {
  'recursive-backtracker': 'Recursive Backtracker',
  'hunt-and-kill': 'Hunt & Kill',
  prims: "Prim's",
  kruskals: "Kruskal's",
  wilsons: "Wilson's",
  'aldous-broder': 'Aldous-Broder',
  ellers: "Eller's",
  'recursive-division': 'Recursive Division',
  'binary-tree': 'Binary Tree',
  sidewinder: 'Sidewinder'
}

interface MazeCell {
  row: number
  col: number
  visited: boolean
  walls: { north: boolean; south: boolean; east: boolean; west: boolean }
}

export type MazeGrid = MazeCell[][]

const createGrid = (rows: number, cols: number): MazeGrid =>
  Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      row,
      col,
      visited: false,
      walls: { north: true, south: true, east: true, west: true }
    }))
  )

const getUnvisitedNeighbors = (grid: MazeGrid, cell: MazeCell): MazeCell[] => {
  const { row, col } = cell
  const rows = grid.length
  const cols = grid[0].length

  return [
    row > 0 ? grid[row - 1][col] : null,
    row < rows - 1 ? grid[row + 1][col] : null,
    col > 0 ? grid[row][col - 1] : null,
    col < cols - 1 ? grid[row][col + 1] : null
  ].filter((n): n is MazeCell => n !== null && !n.visited)
}

const removeWallBetween = (current: MazeCell, neighbor: MazeCell): void => {
  const rowDiff = neighbor.row - current.row
  const colDiff = neighbor.col - current.col

  if (rowDiff === -1) {
    current.walls.north = false
    neighbor.walls.south = false
  }
  if (rowDiff === 1) {
    current.walls.south = false
    neighbor.walls.north = false
  }
  if (colDiff === -1) {
    current.walls.west = false
    neighbor.walls.east = false
  }
  if (colDiff === 1) {
    current.walls.east = false
    neighbor.walls.west = false
  }
}

const pickRandom = <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)]

// --- 1. Winding Path Algorithms ---

/** DFS with backtracking — long winding corridors */
const stepRecursiveBacktracker = (grid: MazeGrid, stack: MazeCell[]): boolean => {
  if (stack.length === 0) return false
  const current = stack[stack.length - 1]
  const neighbors = getUnvisitedNeighbors(grid, current)
  if (neighbors.length === 0) {
    stack.pop()
  } else {
    const next = pickRandom(neighbors)
    removeWallBetween(current, next)
    next.visited = true
    stack.push(next)
  }
  return true
}

const generateRecursiveBacktracker = (rows: number, cols: number): MazeGrid => {
  const grid = createGrid(rows, cols)
  const stack: MazeCell[] = []
  const start = grid[0][0]
  start.visited = true
  stack.push(start)

  Array.from({ length: rows * cols * 2 }).forEach(() => stepRecursiveBacktracker(grid, stack))

  return grid
}

const huntNextCell = (grid: MazeGrid, rows: number, cols: number): MazeCell | null => {
  let found: MazeCell | null = null
  grid.some((row) =>
    row.some((cell) => {
      if (cell.visited) return false
      const visitedAdj = [
        cell.row > 0 ? grid[cell.row - 1][cell.col] : null,
        cell.row < rows - 1 ? grid[cell.row + 1][cell.col] : null,
        cell.col > 0 ? grid[cell.row][cell.col - 1] : null,
        cell.col < cols - 1 ? grid[cell.row][cell.col + 1] : null
      ].filter((n): n is MazeCell => n !== null && n.visited)

      if (visitedAdj.length > 0) {
        removeWallBetween(cell, pickRandom(visitedAdj))
        cell.visited = true
        found = cell
        return true
      }
      return false
    })
  )
  return found
}

const stepHuntAndKill = (
  grid: MazeGrid,
  current: MazeCell | null,
  rows: number,
  cols: number
): void => {
  if (!current) return
  const neighbors = getUnvisitedNeighbors(grid, current)
  if (neighbors.length > 0) {
    const next = pickRandom(neighbors)
    removeWallBetween(current, next)
    next.visited = true
    stepHuntAndKill(grid, next, rows, cols)
  } else {
    stepHuntAndKill(grid, huntNextCell(grid, rows, cols), rows, cols)
  }
}

/** Like recursive backtracker but scans grid when stuck — memory efficient */
const generateHuntAndKill = (rows: number, cols: number): MazeGrid => {
  const grid = createGrid(rows, cols)
  const start = grid[0][0]
  start.visited = true
  stepHuntAndKill(grid, start, rows, cols)
  return grid
}

// --- 2. Spiky/Organic Algorithms ---

/** Frontier-based — natural branching patterns */
const generatePrims = (rows: number, cols: number): MazeGrid => {
  const grid = createGrid(rows, cols)
  const frontier: MazeCell[] = []
  const inFrontier = new Set<string>()

  const addFrontier = (cell: MazeCell) => {
    ;[
      cell.row > 0 ? grid[cell.row - 1][cell.col] : null,
      cell.row < rows - 1 ? grid[cell.row + 1][cell.col] : null,
      cell.col > 0 ? grid[cell.row][cell.col - 1] : null,
      cell.col < cols - 1 ? grid[cell.row][cell.col + 1] : null
    ]
      .filter(
        (n): n is MazeCell => n !== null && !n.visited && !inFrontier.has(`${n.row},${n.col}`)
      )
      .forEach((n) => {
        frontier.push(n)
        inFrontier.add(`${n.row},${n.col}`)
      })
  }

  const start = grid[0][0]
  start.visited = true
  addFrontier(start)

  const stepPrims = (): void => {
    if (frontier.length === 0) return
    const index = Math.floor(Math.random() * frontier.length)
    const cell = frontier[index]
    frontier.splice(index, 1)

    const visitedAdj = [
      cell.row > 0 ? grid[cell.row - 1][cell.col] : null,
      cell.row < rows - 1 ? grid[cell.row + 1][cell.col] : null,
      cell.col > 0 ? grid[cell.row][cell.col - 1] : null,
      cell.col < cols - 1 ? grid[cell.row][cell.col + 1] : null
    ].filter((n): n is MazeCell => n !== null && n.visited)

    if (visitedAdj.length > 0) {
      removeWallBetween(cell, pickRandom(visitedAdj))
      cell.visited = true
      addFrontier(cell)
    }
    stepPrims()
  }

  stepPrims()
  return grid
}

/** Union-Find based — carves passages simultaneously across grid */
const generateKruskals = (rows: number, cols: number): MazeGrid => {
  const grid = createGrid(rows, cols)
  const parent: number[] = Array.from({ length: rows * cols }, (_, i) => i)

  const find = (x: number): number => {
    if (parent[x] === x) return x
    parent[x] = parent[parent[x]]
    return find(parent[x])
  }

  const union = (a: number, b: number): boolean => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA === rootB) return false
    parent[rootA] = rootB
    return true
  }

  const cellId = (row: number, col: number) => row * cols + col

  type Edge = { row1: number; col1: number; row2: number; col2: number }
  const edges: Edge[] = []

  Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => {
      if (col < cols - 1) edges.push({ row1: row, col1: col, row2: row, col2: col + 1 })
      if (row < rows - 1) edges.push({ row1: row, col1: col, row2: row + 1, col2: col })
    })
  )

  // Shuffle edges (Fisher-Yates)
  Array.from({ length: edges.length - 1 }, (_, i) => edges.length - 1 - i).forEach((i) => {
    const index = Math.floor(Math.random() * (i + 1))
    ;[edges[i], edges[index]] = [edges[index], edges[i]]
  })

  edges.forEach(({ row1, col1, row2, col2 }) => {
    if (union(cellId(row1, col1), cellId(row2, col2))) {
      removeWallBetween(grid[row1][col1], grid[row2][col2])
    }
  })

  return grid
}

// --- 3. Unbiased Algorithms ---

interface WilsonsContext {
  grid: MazeGrid
  rows: number
  cols: number
  inMaze: Set<string>
  cellKey: (r: number, c: number) => string
}

const wilsonsRandomWalk = (
  ctx: WilsonsContext,
  current: MazeCell,
  path: MazeCell[],
  pathSet: Map<string, number>
): void => {
  if (ctx.inMaze.has(ctx.cellKey(current.row, current.col))) return
  const neighbors = [
    current.row > 0 ? ctx.grid[current.row - 1][current.col] : null,
    current.row < ctx.rows - 1 ? ctx.grid[current.row + 1][current.col] : null,
    current.col > 0 ? ctx.grid[current.row][current.col - 1] : null,
    current.col < ctx.cols - 1 ? ctx.grid[current.row][current.col + 1] : null
  ].filter((n): n is MazeCell => n !== null)

  const next = pickRandom(neighbors)
  const key = ctx.cellKey(next.row, next.col)

  if (pathSet.has(key)) {
    const loopStart = pathSet.get(key)!
    path.splice(loopStart + 1).forEach((c) => pathSet.delete(ctx.cellKey(c.row, c.col)))
    wilsonsRandomWalk(ctx, path[path.length - 1], path, pathSet)
  } else {
    path.push(next)
    pathSet.set(key, path.length - 1)
    wilsonsRandomWalk(ctx, next, path, pathSet)
  }
}

const wilsonsAddPath = (ctx: WilsonsContext, path: MazeCell[]): void => {
  Array.from({ length: path.length - 1 }, (_, i) => i).forEach((i) => {
    removeWallBetween(path[i], path[i + 1])
    path[i].visited = true
    ctx.inMaze.add(ctx.cellKey(path[i].row, path[i].col))
  })
}

const wilsonsStep = (ctx: WilsonsContext, allCells: MazeCell[]): void => {
  const remaining = allCells.filter((c) => !ctx.inMaze.has(ctx.cellKey(c.row, c.col)))
  if (remaining.length === 0) return

  const start = remaining[Math.floor(Math.random() * remaining.length)]
  const path: MazeCell[] = [start]
  const pathSet = new Map<string, number>()
  pathSet.set(ctx.cellKey(start.row, start.col), 0)

  wilsonsRandomWalk(ctx, start, path, pathSet)
  wilsonsAddPath(ctx, path)
  wilsonsStep(ctx, allCells)
}

/** Loop-erased random walks — perfectly unbiased */
const generateWilsons = (rows: number, cols: number): MazeGrid => {
  const grid = createGrid(rows, cols)
  const inMaze = new Set<string>()
  const cellKey = (r: number, c: number) => `${r},${c}`

  grid[0][0].visited = true
  inMaze.add(cellKey(0, 0))

  const ctx: WilsonsContext = { grid, rows, cols, inMaze, cellKey }
  wilsonsStep(ctx, grid.flat())

  return grid
}

const stepAldousBroder = (
  grid: MazeGrid,
  rows: number,
  cols: number,
  current: MazeCell,
  unvisitedCount: number
): void => {
  if (unvisitedCount === 0) return
  const neighbors = [
    current.row > 0 ? grid[current.row - 1][current.col] : null,
    current.row < rows - 1 ? grid[current.row + 1][current.col] : null,
    current.col > 0 ? grid[current.row][current.col - 1] : null,
    current.col < cols - 1 ? grid[current.row][current.col + 1] : null
  ].filter((n): n is MazeCell => n !== null)

  const next = pickRandom(neighbors)
  const newCount = next.visited ? unvisitedCount : unvisitedCount - 1
  if (!next.visited) {
    removeWallBetween(current, next)
    next.visited = true
  }
  stepAldousBroder(grid, rows, cols, next, newCount)
}

/** Random walk — extremely simple, extremely slow */
const generateAldousBroder = (rows: number, cols: number): MazeGrid => {
  const grid = createGrid(rows, cols)
  const start = grid[0][0]
  start.visited = true
  stepAldousBroder(grid, rows, cols, start, rows * cols - 1)
  return grid
}

// --- 4. Specialized Algorithms ---

/** Row-by-row generation — can produce infinite mazes */
const generateEllers = (rows: number, cols: number): MazeGrid => {
  const grid = createGrid(rows, cols)
  const sets = Array.from({ length: rows * cols }, (_, i) => i)
  const cellSet = (row: number, col: number) => row * cols + col

  const find = (x: number): number => {
    if (sets[x] === x) return x
    sets[x] = sets[sets[x]]
    return find(sets[x])
  }

  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) sets[ra] = rb
  }

  Array.from({ length: rows }, (_, row) => {
    // Horizontal connections
    Array.from({ length: cols - 1 }, (_, col) => {
      const isLastRow = row === rows - 1
      const shouldConnect = isLastRow
        ? find(cellSet(row, col)) !== find(cellSet(row, col + 1))
        : Math.random() < 0.5 && find(cellSet(row, col)) !== find(cellSet(row, col + 1))

      if (shouldConnect) {
        removeWallBetween(grid[row][col], grid[row][col + 1])
        union(cellSet(row, col), cellSet(row, col + 1))
      }
    })

    // Vertical connections (not for last row)
    if (row < rows - 1) {
      const setMembers = new Map<number, number[]>()
      Array.from({ length: cols }, (_, col) => {
        const setId = find(cellSet(row, col))
        if (!setMembers.has(setId)) setMembers.set(setId, [])
        setMembers.get(setId)!.push(col)
      })

      setMembers.forEach((members) => {
        const connectCount = Math.max(1, Math.floor(Math.random() * members.length) + 1)
        const shuffled = [...members].sort(() => Math.random() - 0.5)
        shuffled.slice(0, connectCount).forEach((col) => {
          removeWallBetween(grid[row][col], grid[row + 1][col])
          union(cellSet(row, col), cellSet(row + 1, col))
        })
      })
    }
  })

  return grid
}

/** Divide space with walls — fractal appearance */
const generateRecursiveDivision = (rows: number, cols: number): MazeGrid => {
  const grid = createGrid(rows, cols)

  // Start with all internal walls removed
  grid.forEach((row) =>
    row.forEach((cell) => {
      if (cell.row < rows - 1) {
        removeWallBetween(cell, grid[cell.row + 1][cell.col])
      }
      if (cell.col < cols - 1) {
        removeWallBetween(cell, grid[cell.row][cell.col + 1])
      }
    })
  )

  const divide = (minRow: number, maxRow: number, minCol: number, maxCol: number) => {
    const height = maxRow - minRow + 1
    const width = maxCol - minCol + 1
    if (height <= 1 || width <= 1) return

    if (width >= height) {
      // Vertical wall
      const wallCol = minCol + Math.floor(Math.random() * (width - 1))
      const passage = minRow + Math.floor(Math.random() * height)

      Array.from({ length: height }, (_, i) => minRow + i)
        .filter((r) => r !== passage)
        .forEach((r) => {
          grid[r][wallCol].walls.east = true
          grid[r][wallCol + 1].walls.west = true
        })

      divide(minRow, maxRow, minCol, wallCol)
      divide(minRow, maxRow, wallCol + 1, maxCol)
    } else {
      // Horizontal wall
      const wallRow = minRow + Math.floor(Math.random() * (height - 1))
      const passage = minCol + Math.floor(Math.random() * width)

      Array.from({ length: width }, (_, i) => minCol + i)
        .filter((c) => c !== passage)
        .forEach((c) => {
          grid[wallRow][c].walls.south = true
          grid[wallRow + 1][c].walls.north = true
        })

      divide(minRow, wallRow, minCol, maxCol)
      divide(wallRow + 1, maxRow, minCol, maxCol)
    }
  }

  divide(0, rows - 1, 0, cols - 1)
  return grid
}

/** Fastest — biased toward northwest */
const generateBinaryTree = (rows: number, cols: number): MazeGrid => {
  const grid = createGrid(rows, cols)

  grid.forEach((row) =>
    row.forEach((cell) => {
      const candidates: MazeCell[] = []
      if (cell.row > 0) candidates.push(grid[cell.row - 1][cell.col])
      if (cell.col > 0) candidates.push(grid[cell.row][cell.col - 1])

      if (candidates.length > 0) {
        removeWallBetween(cell, pickRandom(candidates))
      }
    })
  )

  return grid
}

/** Fast — biased toward north */
const generateSidewinder = (rows: number, cols: number): MazeGrid => {
  const grid = createGrid(rows, cols)

  grid.forEach((row, rowIndex) => {
    let runStart = 0

    row.forEach((cell, colIndex) => {
      if (rowIndex === 0 && colIndex < cols - 1) {
        removeWallBetween(cell, grid[rowIndex][colIndex + 1])
        return
      }

      const shouldCloseRun = colIndex === cols - 1 || (rowIndex > 0 && Math.random() < 0.5)

      if (shouldCloseRun && rowIndex > 0) {
        const runCol = runStart + Math.floor(Math.random() * (colIndex - runStart + 1))
        removeWallBetween(grid[rowIndex][runCol], grid[rowIndex - 1][runCol])
        runStart = colIndex + 1
      } else if (colIndex < cols - 1) {
        removeWallBetween(cell, grid[rowIndex][colIndex + 1])
      }
    })
  })

  return grid
}

// --- Algorithm Map ---

const algorithmMap: Record<MazeAlgorithm, (rows: number, cols: number) => MazeGrid> = {
  'recursive-backtracker': generateRecursiveBacktracker,
  'hunt-and-kill': generateHuntAndKill,
  prims: generatePrims,
  kruskals: generateKruskals,
  wilsons: generateWilsons,
  'aldous-broder': generateAldousBroder,
  ellers: generateEllers,
  'recursive-division': generateRecursiveDivision,
  'binary-tree': generateBinaryTree,
  sidewinder: generateSidewinder
}

// --- Grid to 3D positions ---

/**
 * Returns world-space cell centre positions for coin/item placement.
 * @param step  pick every Nth cell in each axis (default 5 → 4×4 = 16 positions for a 20-cell grid)
 * @param height  Y position for the returned coordinates
 */
export const getMazeCellCenters = (
  islandSize: number,
  cellSize: number,
  step = 5,
  height = 3
): CoordinateTuple[] => {
  const totalCells = Math.floor(islandSize / cellSize)
  const half = islandSize / 2
  const indices = Array.from(
    { length: Math.floor(totalCells / step) },
    (_, i) => i * step + Math.floor(step / 2)
  )
  return indices.flatMap((row) =>
    indices.map(
      (col): CoordinateTuple => [
        -half + col * cellSize + cellSize / 2,
        height,
        -half + row * cellSize + cellSize / 2
      ]
    )
  )
}

export interface MazeWallSegment {
  position: CoordinateTuple
  /** true = wall runs along X axis (N/S wall); false = runs along Z axis (E/W wall) */
  horizontal: boolean
}

/**
 * Convert a maze grid into oriented wall segments for 3D scene construction.
 * Entrance at top-left, exit at bottom-right.
 */
const mazeGridToSegments = (
  grid: MazeGrid,
  islandSize: number,
  cellSize: number,
  wallY = 0
): MazeWallSegment[] => {
  const half = islandSize / 2
  const cellToWorld = (row: number, col: number): [number, number] => [
    -half + col * cellSize + cellSize / 2,
    -half + row * cellSize + cellSize / 2
  ]

  type SegmentWithKey = MazeWallSegment & { key: string }

  const raw = grid.flatMap((row) =>
    row.flatMap((cell) => {
      const [wx, wz] = cellToWorld(cell.row, cell.col)
      const wallOffset = cellSize / 2
      const rx = Math.round(wx * 100)
      const rz = Math.round(wz * 100)
      const ro = Math.round(wallOffset * 100)
      return [
        cell.walls.north
          ? {
              position: [wx, wallY, wz - wallOffset] as CoordinateTuple,
              horizontal: true,
              key: `${rx},${rz - ro},H`
            }
          : null,
        cell.walls.south
          ? {
              position: [wx, wallY, wz + wallOffset] as CoordinateTuple,
              horizontal: true,
              key: `${rx},${rz + ro},H`
            }
          : null,
        cell.walls.west
          ? {
              position: [wx - wallOffset, wallY, wz] as CoordinateTuple,
              horizontal: false,
              key: `${rx - ro},${rz},V`
            }
          : null,
        cell.walls.east
          ? {
              position: [wx + wallOffset, wallY, wz] as CoordinateTuple,
              horizontal: false,
              key: `${rx + ro},${rz},V`
            }
          : null
      ].filter((s): s is SegmentWithKey => s !== null)
    })
  )

  const unique = new Map<string, MazeWallSegment>()
  raw.forEach(({ key, position, horizontal }) => unique.set(key, { position, horizontal }))

  const entranceX = -half + cellSize / 2
  const entranceZ = -half
  const exitX = half - cellSize / 2
  const exitZ = half

  return [...unique.values()].filter(({ position: pos }) => {
    const isEntrance =
      Math.abs(pos[0] - entranceX) < cellSize / 2 && Math.abs(pos[2] - entranceZ) < cellSize / 2
    const isExit =
      Math.abs(pos[0] - exitX) < cellSize / 2 && Math.abs(pos[2] - exitZ) < cellSize / 2
    return !isEntrance && !isExit
  })
}

export const generateMazeAndSegments = (
  islandSize: number,
  cellSize: number,
  algorithm: MazeAlgorithm = 'recursive-backtracker',
  wallY = 0
): { grid: MazeGrid; segments: MazeWallSegment[] } => {
  const cols = Math.floor(islandSize / cellSize)
  const rows = cols
  if (rows <= 0 || cols <= 0) return { grid: [], segments: [] }
  const grid = algorithmMap[algorithm](rows, cols)
  return { grid, segments: mazeGridToSegments(grid, islandSize, cellSize, wallY) }
}

export const generateMazeWallSegments = (
  islandSize: number,
  cellSize: number,
  algorithm: MazeAlgorithm = 'recursive-backtracker',
  wallY = 0
): MazeWallSegment[] => generateMazeAndSegments(islandSize, cellSize, algorithm, wallY).segments

/**
 * Convert a maze grid into wall positions for the 3D scene.
 * Entrance at top-left, exit at bottom-right.
 */
export const generateMazeWallPositions = (
  islandSize: number,
  cellSize: number,
  algorithm: MazeAlgorithm = 'recursive-backtracker',
  wallY: number = 0.5
): CoordinateTuple[] => {
  const cols = Math.floor(islandSize / cellSize)
  const rows = cols
  if (rows <= 0 || cols <= 0) return []

  const grid = algorithmMap[algorithm](rows, cols)
  const half = islandSize / 2
  const positions: CoordinateTuple[] = []

  const cellToWorld = (row: number, col: number): [number, number] => [
    -half + col * cellSize + cellSize / 2,
    -half + row * cellSize + cellSize / 2
  ]

  grid.forEach((row) =>
    row.forEach((cell) => {
      const [wx, wz] = cellToWorld(cell.row, cell.col)
      const wallOffset = cellSize / 2

      if (cell.walls.north) positions.push([wx, wallY, wz - wallOffset])
      if (cell.walls.south) positions.push([wx, wallY, wz + wallOffset])
      if (cell.walls.west) positions.push([wx - wallOffset, wallY, wz])
      if (cell.walls.east) positions.push([wx + wallOffset, wallY, wz])
    })
  )

  // Deduplicate shared walls
  const unique = new Map<string, CoordinateTuple>()
  positions.forEach((pos) => {
    const key = `${Math.round(pos[0] * 100)},${Math.round(pos[2] * 100)}`
    unique.set(key, pos)
  })

  const wallPositions = [...unique.values()]

  // Create entrance (top-left) and exit (bottom-right)
  const entranceX = -half + cellSize / 2
  const entranceZ = -half
  const exitX = half - cellSize / 2
  const exitZ = half

  return wallPositions.filter((pos) => {
    const isEntrance =
      Math.abs(pos[0] - entranceX) < cellSize / 2 && Math.abs(pos[2] - entranceZ) < cellSize / 2
    const isExit =
      Math.abs(pos[0] - exitX) < cellSize / 2 && Math.abs(pos[2] - exitZ) < cellSize / 2
    return !isEntrance && !isExit
  })
}
