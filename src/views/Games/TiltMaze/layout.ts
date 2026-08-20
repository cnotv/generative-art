import type { CoordinateTuple } from '@webgamekit/animation'
import type { BoardLayout, LevelConfig } from './types'
import {
  CAMERA_FOV,
  CAMERA_MARGIN,
  DEGREES_TO_RADIANS,
  WALL_HEIGHT,
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
 * The fit is measured at the top of the walls rather than at the floor: everything above the
 * ground plane projects outward from a camera looking down, so framing the floor exactly leaves
 * the wall tops cropped off the edges.
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

  const heightToFitDepth = layout.boardDepth / 2 / halfFovTangent + WALL_HEIGHT
  const heightToFitWidth = layout.boardWidth / 2 / (halfFovTangent * aspect) + WALL_HEIGHT

  return Math.max(heightToFitDepth, heightToFitWidth) * CAMERA_MARGIN
}
