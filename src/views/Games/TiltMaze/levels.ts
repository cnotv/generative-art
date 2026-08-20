import type * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { MazeAlgorithm } from '@/views/Games/MazeGame/helpers/maze'
import { createTiltMazeBoard } from './board'
import { getBoardLayout, getCameraHeight } from './layout'
import type { BoardLayout, LevelConfig, TiltMazeBoard } from './types'
import {
  BALL_TO_CELL_RATIO,
  BASE_SHORT_AXIS_CELLS,
  BASE_TRAP_COUNT,
  BOARD_SHORT_EXTENT,
  HOLE_TO_BALL_RATIO,
  HOLE_TO_CELL_RATIO,
  LEVEL_ALGORITHMS,
  MAX_BALL_RADIUS,
  MAX_SHORT_AXIS_CELLS,
  MAX_TRAP_COUNT,
  TRAPS_PER_LEVEL
} from './config'

const clampToRange = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value))

/**
 * Everything that makes one level harder than the last.
 *
 * Difficulty comes from cutting the same board into more cells rather than from making the
 * board bigger: a screen-sized board is already as large as it can be, so the only room left
 * is finer corridors and more of them. Cell size therefore falls out of the cell count, and
 * the ball and holes are derived from the cell so a tighter maze stays passable — a fixed ball
 * radius would eventually be wider than the corridor, and a fixed hole radius would either
 * swallow the walls or become too small for the ball to drop through.
 * @param level The level being played, counting from one
 * @returns Cell counts and the sizes derived from them
 */
export const getLevelConfig = (level: number): LevelConfig => {
  const shortAxisCells = clampToRange(
    BASE_SHORT_AXIS_CELLS + (level - 1),
    BASE_SHORT_AXIS_CELLS,
    MAX_SHORT_AXIS_CELLS
  )
  const cellSize = BOARD_SHORT_EXTENT / shortAxisCells
  const ballRadius = Math.min(MAX_BALL_RADIUS, cellSize * BALL_TO_CELL_RATIO)
  const holeRadius = Math.max(ballRadius * HOLE_TO_BALL_RATIO, cellSize * HOLE_TO_CELL_RATIO)

  return {
    shortAxisCells,
    cellSize,
    ballRadius,
    holeRadius,
    trapCount: Math.min(BASE_TRAP_COUNT + (level - 1) * TRAPS_PER_LEVEL, MAX_TRAP_COUNT),
    // Cycling the generator changes the character of the maze, not only its size, so two
    // levels with the same cell count still feel different to play.
    algorithm: LEVEL_ALGORITHMS[(level - 1) % LEVEL_ALGORITHMS.length] as MazeAlgorithm
  }
}

export interface BuiltLevel {
  board: TiltMazeBoard
  layout: BoardLayout
  cameraHeight: number
}

/**
 * Assemble one level: its difficulty, a board cut to the current screen, and the camera height
 * that frames it. Kept together because the three are derived from each other and drift apart
 * the moment a caller computes one of them separately.
 * @param scene The Three.js scene
 * @param world The Rapier physics world
 * @param level The level number being built
 * @returns The board with the layout and framing it was built for
 */
export const buildLevel = (scene: THREE.Scene, world: RAPIER.World, level: number): BuiltLevel => {
  const config = getLevelConfig(level)
  const layout = getBoardLayout(window.innerWidth, window.innerHeight, config)

  return {
    board: createTiltMazeBoard(scene, world, layout, config),
    layout,
    cameraHeight: getCameraHeight(layout, window.innerWidth, window.innerHeight)
  }
}
