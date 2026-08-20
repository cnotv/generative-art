import type { ComplexModel } from '@webgamekit/threejs'
import type { MazeAlgorithm } from '@/views/Games/MazeGame/helpers/maze'
import type { CoordinateTuple } from '@webgamekit/animation'

/**
 * Tilt expressed in the player's screen frame, in degrees.
 * `tiltX` leans toward screen-right, `tiltZ` leans toward screen-bottom.
 */
export interface ScreenTilt {
  tiltX: number
  tiltZ: number
}

export interface GravityVector {
  x: number
  y: number
  z: number
}

/**
 * `unsupported` means the browser exposes no orientation sensor at all,
 * `prompt` means iOS will show its permission sheet on the next user gesture.
 */
export type TiltPermissionState = 'unsupported' | 'prompt' | 'granted' | 'denied'

export interface MazeHole {
  position: CoordinateTuple
  isGoal: boolean
}

export type TiltMazeOutcome = 'playing' | 'trapped' | 'won'

/** A raw sensor reading in the device's own frame, before any screen rotation is applied. */
export interface OrientationReading {
  beta: number
  gamma: number
}

export interface BoardLayout {
  columns: number
  rows: number
  cellSize: number
  boardWidth: number
  boardDepth: number
  ballStart: CoordinateTuple
}

/** Everything a level's difficulty decides, all of it derived from the level number. */
export interface LevelConfig {
  shortAxisCells: number
  cellSize: number
  ballRadius: number
  holeRadius: number
  trapCount: number
  algorithm: MazeAlgorithm
}

/** A built board, with the teardown needed before the next one replaces it. */
export interface TiltMazeBoard {
  ball: ComplexModel
  /** Wall meshes, exposed so the occlusion fader can raycast against them. */
  walls: ComplexModel[]
  holes: MazeHole[]
  goal: MazeHole | undefined
  dispose: () => void
}

export type SensorPlatform = 'ios' | 'android' | 'desktop'

export type SensorBlockReason =
  | 'unsupported'
  | 'insecure-context'
  | 'permission-denied'
  | 'awaiting-permission'
  | 'silent-sensor'
  | null

/** What the page can observe about the tilt sensor, all of it from browser state. */
export interface SensorState {
  isSupported: boolean
  isSecureContext: boolean
  permission: TiltPermissionState
  isReceiving: boolean
  platform: SensorPlatform
}

/** A named cause with its remedy; `fix` is set only when the page can act without the player. */
export interface SensorGuidance {
  reason: SensorBlockReason
  title: string
  summary: string
  steps: string[]
  fix: 'reload-secure' | 'request-permission' | null
  fixLabel: string | null
}
