import type { CoordinateTuple } from '@webgamekit/animation'
import type { BoardLayout, LevelConfig } from './types'
import {
  CAMERA_EDGE_SAFETY,
  CAMERA_FOV,
  WALL_THICKNESS,
  DEGREES_TO_RADIANS,
  MAX_CELLS_LONG_AXIS,
  MIN_CELLS_LONG_AXIS
} from './config'

const clampToRange = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value))

/**
 * Shape the board to the screen it will be played on.
 *
 * Cell size is held constant so a corridor is the same width — and the game the same
 * difficulty — on every device; the screen decides how many cells fit instead. A portrait
 * phone therefore gets a tall maze rather than a square one letterboxed into a sliver, which
 * is what makes the board fill the display.
 * @param viewportWidth Viewport width in pixels
 * @param viewportHeight Viewport height in pixels
 * @param level The level whose cell count and cell size the board is cut to
 * @returns Cell counts, world extents and the ball's spawn corner
 */
export const getBoardLayout = (
  viewportWidth: number,
  viewportHeight: number,
  level: LevelConfig
): BoardLayout => {
  const aspect = viewportWidth / Math.max(viewportHeight, 1)
  const longAxisCells = clampToRange(
    Math.round(level.shortAxisCells * (aspect >= 1 ? aspect : 1 / aspect)),
    MIN_CELLS_LONG_AXIS,
    MAX_CELLS_LONG_AXIS
  )

  const columns = aspect >= 1 ? longAxisCells : level.shortAxisCells
  const rows = aspect >= 1 ? level.shortAxisCells : longAxisCells

  const boardWidth = columns * level.cellSize
  const boardDepth = rows * level.cellSize

  return {
    columns,
    rows,
    cellSize: level.cellSize,
    boardWidth,
    boardDepth,
    ballStart: [
      -boardWidth / 2 + level.cellSize / 2,
      level.cellSize / 4,
      -boardDepth / 2 + level.cellSize / 2
    ] as CoordinateTuple
  }
}

/**
 * Camera height that keeps the whole board on screen.
 *
 * A perspective camera constrains the vertical extent directly and the horizontal extent only
 * through the aspect ratio, so each axis implies its own distance and the board fits only at
 * the larger of the two. Taking the maximum is what stops a rotated phone from cropping the
 * board rather than shrinking it.
 *
 * The fit is measured against the **interior** of the perimeter, not the board's outer extent:
 * the playfield then runs edge to edge and the border walls fall outside the viewport, so the
 * screen bezel reads as the frame of the maze. Their tops overhang the edges, which is the
 * effect rather than a defect.
 *
 * No headroom is added here. A leaning view needs some, but only the caller knows whether it is
 * leaning, so it scales this by `CAMERA_LEAN_MARGIN` when it is.
 * @param layout The board being framed
 * @param viewportWidth Viewport width in pixels
 * @param viewportHeight Viewport height in pixels
 * @returns Camera Y position
 */
export const getCameraHeight = (
  layout: BoardLayout,
  viewportWidth: number,
  viewportHeight: number
): number => {
  const aspect = viewportWidth / Math.max(viewportHeight, 1)
  const halfFovTangent = Math.tan((CAMERA_FOV / 2) * DEGREES_TO_RADIANS)

  // The perimeter walls are centred on the board edge, so half a thickness of each lies inside.
  const interiorWidth = layout.boardWidth - WALL_THICKNESS
  const interiorDepth = layout.boardDepth - WALL_THICKNESS

  const heightToFitDepth = interiorDepth / 2 / halfFovTangent
  const heightToFitWidth = interiorWidth / 2 / (halfFovTangent * aspect)

  return Math.max(heightToFitDepth, heightToFitWidth) * CAMERA_EDGE_SAFETY
}
