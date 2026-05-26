import type { CoordinateTuple } from '@webgamekit/animation'

export const MATCHMAKER_ROOM = 'marble-madness-matchmaker'

export const MARBLE_RADIUS = 0.8
export const MARBLE_WEIGHT = 3.0
export const MARBLE_RESTITUTION = 0.1
export const MARBLE_FRICTION = 8.0
export const MARBLE_LINEAR_DAMPING = 2.0
export const MARBLE_ANGULAR_DAMPING = 0.3
export const MOVE_FORCE = 3
export const MAX_LINEAR_SPEED = 10

export const CAMERA_HEIGHT = 14
export const CAMERA_BACK = 12
export const CAMERA_LERP = 0.08

export const LIGHT_AMBIENT_INTENSITY = 1.2
export const LIGHT_DIRECTIONAL_INTENSITY = 2.5
export const LIGHT_DIRECTIONAL_POSITION: [number, number, number] = [10, 20, 10]

export const FALL_THRESHOLD_Y = -8
export const TIME_PENALTY_FALL = 10
export const FINISH_DISC_RADIUS_RATIO = 0.5

export const POS_BROADCAST_MS = 50

export const PLATFORM_COLOR = 0x4caf50
export const BRIDGE_COLOR = 0x9e9e9e
export const OBSTACLE_COLOR = 0xd32f2f
export const FINISH_COLOR = 0xffd700

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

export type TrackConfig = {
  name: string
  platforms: PlatformDef[]
  obstacles: ObstacleDef[]
  spawnPosition: CoordinateTuple
  finishPosition: CoordinateTuple
  finishCheckRadius: number
  finishCheckZ: number
}

const CLASSIC_TRACK: TrackConfig = {
  name: 'Classic',
  spawnPosition: [0, 1.5, 4],
  finishPosition: [9, 1, -84],
  finishCheckZ: -78,
  finishCheckRadius: 6,
  platforms: [
    { size: [18, 1, 14], position: [0, 0, 0], color: PLATFORM_COLOR },
    { size: [5, 1, 26], position: [0, 0, -20], color: BRIDGE_COLOR },
    { size: [14, 1, 14], position: [0, 0, -40], color: PLATFORM_COLOR },
    { size: [5, 1, 22], position: [-4, 0, -57], color: BRIDGE_COLOR },
    { size: [14, 1, 14], position: [-8, 0, -74], color: PLATFORM_COLOR },
    { size: [18, 1, 5], position: [0, 0, -82], color: BRIDGE_COLOR },
    { size: [16, 1, 16], position: [9, 0, -84], color: FINISH_COLOR, isFinish: true }
  ],
  obstacles: [
    { size: [1.5, 5, 1.5], position: [-3, 3, -37] },
    { size: [1.5, 5, 1.5], position: [0, 3, -41] },
    { size: [1.5, 5, 1.5], position: [3, 3, -37] }
  ]
}

const ZIGZAG_TRACK: TrackConfig = {
  name: 'Zigzag',
  spawnPosition: [0, 1.5, 4],
  finishPosition: [31, 1, -80],
  finishCheckZ: 9999,
  finishCheckRadius: 6,
  platforms: [
    { size: [18, 1, 14], position: [0, 0, 0], color: PLATFORM_COLOR },
    { size: [5, 1, 26], position: [0, 0, -20], color: BRIDGE_COLOR },
    { size: [14, 1, 14], position: [0, 0, -40], color: PLATFORM_COLOR },
    { size: [30, 1, 5], position: [17, 0, -40], color: BRIDGE_COLOR },
    { size: [14, 1, 14], position: [31, 0, -40], color: PLATFORM_COLOR },
    { size: [5, 1, 26], position: [31, 0, -60], color: BRIDGE_COLOR },
    { size: [16, 1, 16], position: [31, 0, -80], color: FINISH_COLOR, isFinish: true }
  ],
  obstacles: [
    { size: [1.5, 5, 1.5], position: [-2, 3, -37] },
    { size: [1.5, 5, 1.5], position: [2, 3, -43] },
    { size: [1.5, 5, 1.5], position: [30, 3, -57] },
    { size: [1.5, 5, 1.5], position: [32, 3, -63] }
  ]
}

const LONG_ROAD_TRACK: TrackConfig = {
  name: 'Long Road',
  spawnPosition: [0, 1.5, 4],
  finishPosition: [0, 1, -130],
  finishCheckZ: -124,
  finishCheckRadius: 6,
  platforms: [
    { size: [18, 1, 14], position: [0, 0, 0], color: PLATFORM_COLOR },
    { size: [5, 1, 30], position: [0, 0, -22], color: BRIDGE_COLOR },
    { size: [14, 1, 14], position: [0, 0, -44], color: PLATFORM_COLOR },
    { size: [5, 1, 30], position: [0, 0, -66], color: BRIDGE_COLOR },
    { size: [14, 1, 14], position: [0, 0, -88], color: PLATFORM_COLOR },
    { size: [5, 1, 30], position: [0, 0, -110], color: BRIDGE_COLOR },
    { size: [16, 1, 16], position: [0, 0, -130], color: FINISH_COLOR, isFinish: true }
  ],
  obstacles: [
    { size: [1.5, 5, 1.5], position: [-1.5, 3, -41] },
    { size: [1.5, 5, 1.5], position: [1.5, 3, -47] },
    { size: [1.5, 5, 1.5], position: [-1.5, 3, -85] },
    { size: [1.5, 5, 1.5], position: [1.5, 3, -91] }
  ]
}

export const TRACKS: TrackConfig[] = [CLASSIC_TRACK, ZIGZAG_TRACK, LONG_ROAD_TRACK]

export const TRACK_SELECT_FIELD = {
  type: 'select' as const,
  key: 'trackIndex',
  label: 'Track',
  value: 0,
  options: TRACKS.map((track, index) => ({ value: index, label: track.name }))
}

export const KEYBOARD_MAPPING = {
  keyboard: {
    w: 'forward',
    ArrowUp: 'forward',
    s: 'backward',
    ArrowDown: 'backward',
    a: 'left',
    ArrowLeft: 'left',
    d: 'right',
    ArrowRight: 'right'
  }
}
