import type { CellType, Grid, GridCell, GridConfig, NumberTriple, Position2D } from './types'

/**
 * Says whether a cell can be walked through.
 * @param cell The cell to check.
 * @returns False only for a boulder.
 */
export const logicIsCellWalkable = (cell: GridCell): boolean => cell.type !== 'boulder'

/**
 * Creates an empty grid of the configured size.
 * @param config Width, height and cell size.
 * @returns The grid, every cell empty.
 */
export const logicCreateGrid = (config: GridConfig): Grid => ({
  cells: Array.from({ length: config.height }, (_, z) =>
    Array.from({ length: config.width }, (_, x) => ({ x, z, type: 'empty' as CellType }))
  ),
  width: config.width,
  height: config.height,
  cellSize: config.cellSize
})

/**
 * Converts a grid cell to the world position of its corner, with the grid centred on its offset.
 * @param gridX Column of the cell.
 * @param gridZ Row of the cell.
 * @param config Grid size, cell size and centre offset.
 * @returns The world position.
 */
export const logicGridToWorld = (
  gridX: number,
  gridZ: number,
  config: GridConfig
): NumberTriple => {
  const worldX = (gridX - config.width / 2) * config.cellSize + config.centerOffset[0]
  const worldZ = (gridZ - config.height / 2) * config.cellSize + config.centerOffset[2]
  return [worldX, config.centerOffset[1], worldZ]
}

/**
 * Converts a world position to the grid cell it falls in.
 * @param worldPos The world position.
 * @param config Grid size, cell size and centre offset.
 * @returns The cell's column and row.
 */
export const logicWorldToGrid = (worldPos: NumberTriple, config: GridConfig): Position2D => {
  const gridX = Math.floor(
    (worldPos[0] - config.centerOffset[0]) / config.cellSize + config.width / 2
  )
  const gridZ = Math.floor(
    (worldPos[2] - config.centerOffset[2]) / config.cellSize + config.height / 2
  )
  return { x: gridX, z: gridZ }
}

/**
 * Changes one cell's type.
 * @param grid The grid.
 * @param x Column of the cell.
 * @param z Row of the cell.
 * @param type The new type.
 * @returns A new grid with that cell changed.
 */
export const logicSetCellType = (grid: Grid, x: number, z: number, type: CellType): Grid => ({
  ...grid,
  cells: grid.cells.map((row, rowZ) =>
    row.map((cell, colX) => (colX === x && rowZ === z ? { ...cell, type } : cell))
  )
})

/**
 * Puts a boulder on one cell.
 * @param grid The grid.
 * @param x Column of the cell.
 * @param z Row of the cell.
 * @returns A new grid with the boulder.
 */
export const logicMarkObstacle = (grid: Grid, x: number, z: number): Grid =>
  logicSetCellType(grid, x, z, 'boulder')

/**
 * Puts a boulder on each of several cells.
 * @param grid The grid.
 * @param positions The cells to block.
 * @returns A new grid with the boulders.
 */
export const logicMarkObstacles = (grid: Grid, positions: Position2D[]): Grid =>
  positions.reduce((accumulator, { x, z }) => logicMarkObstacle(accumulator, x, z), grid)
