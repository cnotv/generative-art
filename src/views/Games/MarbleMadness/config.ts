import * as THREE from 'three'
import type { CoordinateTuple } from '@webgamekit/animation'

export const MATCHMAKER_ROOM = 'marble-madness-matchmaker'

export const MARBLE_RADIUS = 0.4
export const MARBLE_RESTITUTION = 0.25
export const MARBLE_FRICTION = 0.8
export const MARBLE_LINEAR_DAMPING = 0.5
export const MARBLE_ANGULAR_DAMPING = 1.0
export const MOVE_FORCE = 5
export const MAX_LINEAR_SPEED = 18

export const CAMERA_HEIGHT = 14
export const CAMERA_BACK = 12
export const CAMERA_LERP = 0.08

export const FALL_THRESHOLD_Y = -8
export const FINISH_CHECK_Z = -73
export const FINISH_CHECK_RADIUS = 5.5

export const POS_BROADCAST_MS = 50

export const PLATFORM_COLOR = 0x4caf50
export const BRIDGE_COLOR = 0x9e9e9e
export const OBSTACLE_COLOR = 0xd32f2f
export const FINISH_COLOR = 0xffd700

export const SPAWN_POSITION: CoordinateTuple = [0, 2.5, 4]
export const FINISH_POSITION = new THREE.Vector3(9, 1, -79)

export type PlatformDef = {
  size: CoordinateTuple
  position: CoordinateTuple
  color: number
  isFinish?: boolean
}

export type ObstacleDef = {
  size: CoordinateTuple
  position: CoordinateTuple
}

export const PLATFORMS: PlatformDef[] = [
  // Start platform
  { size: [16, 1, 14], position: [0, 0, 0], color: PLATFORM_COLOR },
  // Bridge 1 (narrow forward)
  { size: [3, 1, 24], position: [0, 0, -19], color: BRIDGE_COLOR },
  // Platform 2 (obstacle room)
  { size: [10, 1, 10], position: [0, 0, -36], color: PLATFORM_COLOR },
  // Bridge 2 (narrow, slight angle — offset in X)
  { size: [3, 1, 20], position: [-3.5, 0, -51], color: BRIDGE_COLOR },
  // Platform 3
  { size: [10, 1, 10], position: [-7, 0, -66], color: PLATFORM_COLOR },
  // Bridge 3 (turning right)
  { size: [16, 1, 3], position: [0, 0, -72.5], color: BRIDGE_COLOR },
  // Finish platform
  { size: [14, 1, 14], position: [9, 0, -79], color: FINISH_COLOR, isFinish: true }
]

export const OBSTACLES: ObstacleDef[] = [
  { size: [1.5, 5, 1.5], position: [-3, 2.5, -33] },
  { size: [1.5, 5, 1.5], position: [0, 2.5, -37] },
  { size: [1.5, 5, 1.5], position: [3, 2.5, -33] }
]
