const CELL_CENTRE_OFFSET = 0.5

/**
 * Centre of the cell holding a world coordinate, so a model lands in the middle of its square
 * @param value A world coordinate on the X or Z axis
 * @param cellSize The width of one grid cell in world units
 * @returns The coordinate of the cell centre
 */
export const snapToCell = (value: number, cellSize: number): number =>
  (Math.floor(value / cellSize) + CELL_CENTRE_OFFSET) * cellSize

/**
 * Identify a cell by its integer coordinates, so one placement per square can be enforced
 * @param x A world coordinate on the X axis
 * @param z A world coordinate on the Z axis
 * @param cellSize The width of one grid cell in world units
 * @returns The key of the cell holding that point
 */
export const getCellKey = (x: number, z: number, cellSize: number): string =>
  [Math.floor(x / cellSize), Math.floor(z / cellSize)].join(',')

/**
 * Whether a point falls on the drawn grid, since the ground plane extends past it
 * @param x A world coordinate on the X axis
 * @param z A world coordinate on the Z axis
 * @param gridSize The width of the whole grid in world units
 * @returns True when the point is on the grid
 */
export const isInsideGrid = (x: number, z: number, gridSize: number): boolean =>
  Math.abs(x) <= gridSize / 2 && Math.abs(z) <= gridSize / 2

/**
 * How many cells fit across the board, always an even count.
 *
 * A GridHelper draws its lines from `-size / 2`, so an odd count puts every line half a cell
 * out of step with the cells `snapToCell` computes from the origin, and a model lands
 * straddling the line it was aimed at.
 * @param boardSize The width of the board in world units
 * @param cellSize The width of one grid cell in world units
 * @returns The division count for a GridHelper
 */
export const getGridDivisions = (boardSize: number, cellSize: number): number =>
  Math.max(2, Math.floor(boardSize / cellSize / 2) * 2)

/**
 * How wide the grid actually is, which is a whole number of cells and so at most one cell
 * narrower than the board it is drawn on
 * @param boardSize The width of the board in world units
 * @param cellSize The width of one grid cell in world units
 * @returns The width of the drawn grid in world units
 */
export const getGridExtent = (boardSize: number, cellSize: number): number =>
  getGridDivisions(boardSize, cellSize) * cellSize

/**
 * Tell an orbit drag from a click, as both end in a pointerup over the canvas
 * @param from Pointer position where the gesture started, in pixels
 * @param to Pointer position where it ended, in pixels
 * @param threshold How far the pointer may travel and still count as a click
 * @returns True when the gesture moved too far to be a click
 */
export const isDragGesture = (
  from: [number, number],
  to: [number, number],
  threshold: number
): boolean => Math.hypot(to[0] - from[0], to[1] - from[1]) > threshold
