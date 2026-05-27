import type { CoordinateTuple } from '@webgamekit/animation'

export const MATCHMAKER_ROOM = 'marble-madness-matchmaker'

export type MarbleOption = { id: string; name: string; url: string }

const marbleGlobs = import.meta.glob('@/assets/images/marbles/*.webp', {
  eager: true,
  import: 'default'
}) as Record<string, string>

export const MARBLE_OPTIONS: MarbleOption[] = Object.entries(marbleGlobs)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => {
    const filename = path.split('/').pop()!.replace('.webp', '')
    const name = filename.replace(/^\d+ · /, '')
    return { id: filename, name, url }
  })

export const DEFAULT_MARBLE = MARBLE_OPTIONS[0]

export const MARBLE_RADIUS = 0.8
export const MARBLE_WEIGHT = 3.0
export const MARBLE_RESTITUTION = 0.1
export const MARBLE_FRICTION = 8.0
export const MARBLE_LINEAR_DAMPING = 2.0
export const MARBLE_ANGULAR_DAMPING = 0.3
export const MOVE_FORCE = 10
export const MAX_LINEAR_SPEED = 20

export const CAMERA_HEIGHT = 14
export const CAMERA_BACK = 12
export const CAMERA_LERP = 0.08

export const LIGHT_AMBIENT_INTENSITY = 1.2
export const LIGHT_DIRECTIONAL_INTENSITY = 2.5
export const LIGHT_DIRECTIONAL_POSITION: [number, number, number] = [10, 20, 10]

export const FALL_THRESHOLD_Y = -12
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
  rotation?: CoordinateTuple
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

// Classic: S-curve with 3 platforms connected by bridges, no overlaps
const CLASSIC_TRACK: TrackConfig = {
  name: 'Classic',
  spawnPosition: [0, 1.5, 4],
  finishPosition: [-8, 1, -92],
  finishCheckZ: -84,
  finishCheckRadius: 7,
  platforms: [
    { size: [18, 1, 14], position: [0, 0, 0], color: PLATFORM_COLOR },
    { size: [5, 1, 14], position: [0, 0, -14], color: BRIDGE_COLOR },
    { size: [14, 1, 14], position: [0, 0, -28], color: PLATFORM_COLOR },
    { size: [5, 1, 22], position: [-4, 0, -46], color: BRIDGE_COLOR },
    { size: [14, 1, 14], position: [-8, 0, -64], color: PLATFORM_COLOR },
    { size: [5, 1, 14], position: [-8, 0, -78], color: BRIDGE_COLOR },
    { size: [14, 1, 16], position: [-8, 0, -92], color: FINISH_COLOR, isFinish: true }
  ],
  obstacles: [
    { size: [1.5, 4, 1.5], position: [-2, 2.5, -25] },
    { size: [1.5, 4, 1.5], position: [2, 2.5, -31] },
    { size: [1.5, 4, 1.5], position: [0, 2.5, -28] }
  ]
}

// Zigzag: alternates left and right across the path
const ZIGZAG_TRACK: TrackConfig = {
  name: 'Zigzag',
  spawnPosition: [0, 1.5, 4],
  finishPosition: [0, 1, -102],
  finishCheckZ: -96,
  finishCheckRadius: 7,
  platforms: [
    { size: [18, 1, 14], position: [0, 0, 0], color: PLATFORM_COLOR },
    { size: [5, 1, 14], position: [0, 0, -14], color: BRIDGE_COLOR },
    { size: [14, 1, 14], position: [0, 0, -28], color: PLATFORM_COLOR },
    { size: [14, 1, 16], position: [10, 0, -43], color: BRIDGE_COLOR },
    { size: [14, 1, 14], position: [20, 0, -58], color: PLATFORM_COLOR },
    { size: [14, 1, 16], position: [10, 0, -73], color: BRIDGE_COLOR },
    { size: [14, 1, 14], position: [0, 0, -88], color: PLATFORM_COLOR },
    { size: [16, 1, 16], position: [0, 0, -104], color: FINISH_COLOR, isFinish: true }
  ],
  obstacles: [
    { size: [1.5, 4, 1.5], position: [-2, 2.5, -25] },
    { size: [1.5, 4, 1.5], position: [2, 2.5, -31] },
    { size: [1.5, 4, 1.5], position: [19, 2.5, -55] },
    { size: [1.5, 4, 1.5], position: [21, 2.5, -61] }
  ]
}

// Long Road: descends via a slope, crosses a lower section, ascends back up
// Slope angle ~0.1 rad (~5.7°), length 30 units → 3-unit height change
// rotation.x = -0.1 → downhill in -Z; rotation.x = +0.1 → uphill in -Z
const LONG_ROAD_TRACK: TrackConfig = {
  name: 'Long Road',
  spawnPosition: [0, 1.5, 4],
  finishPosition: [0, 1, -159],
  finishCheckZ: -151,
  finishCheckRadius: 7,
  platforms: [
    { size: [18, 1, 14], position: [0, 0, 0], color: PLATFORM_COLOR },
    { size: [5, 1, 16], position: [0, 0, -15], color: BRIDGE_COLOR },
    { size: [5, 1, 30], position: [0, -1.5, -38], color: BRIDGE_COLOR, rotation: [-0.1, 0, 0] },
    { size: [14, 1, 22], position: [0, -3, -64], color: PLATFORM_COLOR },
    { size: [5, 1, 14], position: [0, -3, -82], color: BRIDGE_COLOR },
    { size: [14, 1, 16], position: [0, -3, -97], color: PLATFORM_COLOR },
    { size: [5, 1, 30], position: [0, -1.5, -120], color: BRIDGE_COLOR, rotation: [0.1, 0, 0] },
    { size: [5, 1, 16], position: [0, 0, -143], color: BRIDGE_COLOR },
    { size: [16, 1, 16], position: [0, 0, -159], color: FINISH_COLOR, isFinish: true }
  ],
  obstacles: [
    { size: [1.5, 4, 1.5], position: [-2, -0.5, -61] },
    { size: [1.5, 4, 1.5], position: [2, -0.5, -67] },
    { size: [1.5, 4, 1.5], position: [0, -0.5, -64] },
    { size: [1.5, 4, 1.5], position: [-2, -0.5, -94] },
    { size: [1.5, 4, 1.5], position: [2, -0.5, -100] }
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
