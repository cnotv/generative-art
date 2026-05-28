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
export const MARBLE_WEIGHT = 5.0
export const MARBLE_RESTITUTION = 0.1
export const MARBLE_FRICTION = 2.5
export const MARBLE_LINEAR_DAMPING = 0.8
export const MARBLE_ANGULAR_DAMPING = 0.3
export const MOVE_FORCE = 10
export const MAX_LINEAR_SPEED = 20

export const CAMERA_HEIGHT = 14
export const CAMERA_BACK = 12
export const CAMERA_LERP = 0.08

export const LIGHT_AMBIENT_INTENSITY = 1.2
export const LIGHT_DIRECTIONAL_INTENSITY = 2.5
export const LIGHT_DIRECTIONAL_POSITION: [number, number, number] = [10, 20, 10]
export const LIGHT_SHADOW_RADIUS = 1
export const LIGHT_SHADOW_BIAS = 0
export const LIGHT_SHADOW_CAMERA = {
  left: -35,
  right: 35,
  top: 35,
  bottom: -35,
  near: 0.5,
  far: 300
}

export const FALL_THRESHOLD_Y = -12
export const TIME_PENALTY_FALL = 10

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
    { size: [2.5, 2, 2.5], position: [-2, -2, -61] },
    { size: [2.5, 2, 2.5], position: [2, -2, -67] },
    { size: [2.5, 2, 2.5], position: [0, -2, -64] },
    { size: [2.5, 2, 2.5], position: [-2, -2, -94] },
    { size: [2.5, 2, 2.5], position: [2, -2, -100] }
  ]
}

// Slopes: physics stress-test with steep downhill, side-bank, uphill, and diagonal ramp
// Rotation convention (right-hand, X-axis):
//   negative → downhill in -Z direction; positive → uphill in -Z direction
//   Z-rotation → side tilt (ball drifts laterally)
// Height formula: surface_at_end = y_center + 0.5 ± (halfLen * sin(angle))
const SLOPES_TRACK: TrackConfig = {
  name: 'Slopes',
  spawnPosition: [0, 1.5, 4],
  finishPosition: [0, -4, -163],
  finishCheckZ: -155,
  finishCheckRadius: 8,
  platforms: [
    { size: [18, 1, 14], position: [0, 0, 0], color: PLATFORM_COLOR },
    { size: [7, 1, 8], position: [0, 0, -11], color: BRIDGE_COLOR },
    // Steep downhill ~14°: surface drops from 0.5 to -5.4
    { size: [7, 1, 24], position: [0, -3, -27], color: BRIDGE_COLOR, rotation: [-0.25, 0, 0] },
    // Lower flat recovery
    { size: [12, 1, 18], position: [0, -6.5, -51], color: PLATFORM_COLOR },
    // Side-banked: ball drifts toward the right (low side)
    { size: [7, 1, 20], position: [0, -6.5, -75], color: BRIDGE_COLOR, rotation: [0, 0, 0.3] },
    { size: [8, 1, 8], position: [0, -6.5, -91], color: PLATFORM_COLOR },
    // Uphill ~14°: surface climbs from -5.4 back to 0.5
    { size: [7, 1, 24], position: [0, -3, -107], color: BRIDGE_COLOR, rotation: [0.25, 0, 0] },
    { size: [7, 1, 8], position: [0, 0, -123], color: BRIDGE_COLOR },
    // Diagonal: combines forward slope and side tilt
    { size: [7, 1, 20], position: [0, -2, -137], color: BRIDGE_COLOR, rotation: [-0.2, 0, 0.2] },
    { size: [8, 1, 8], position: [0, -4.5, -153], color: BRIDGE_COLOR },
    { size: [16, 1, 16], position: [0, -4.5, -163], color: FINISH_COLOR, isFinish: true }
  ],
  obstacles: [
    { size: [2.5, 2, 2.5], position: [-2, -5.5, -48] },
    { size: [2.5, 2, 2.5], position: [2, -5.5, -54] }
  ]
}

// Switchback: descends left with banking, crosses to right valley, steep uphill, diagonal finish
// Combines X-offset zigzag, banked turns (Z rotation), forward slopes (X rotation), and obstacles
// Height profile: 0 → -4 → -8 (valley) → 0 (recovery) → -4 (finish)
const SWITCHBACK_TRACK: TrackConfig = {
  name: 'Switchback',
  spawnPosition: [0, 1.5, 4],
  finishPosition: [2, -4, -178],
  finishCheckZ: -168,
  finishCheckRadius: 8,
  platforms: [
    { size: [16, 1, 12], position: [0, 0, 0], color: PLATFORM_COLOR },
    // Shift left
    { size: [5, 1, 14], position: [-3, 0, -13], color: BRIDGE_COLOR },
    // Left-banked descent: forward slope + side tilt
    { size: [5, 1, 22], position: [-6, -2, -32], color: BRIDGE_COLOR, rotation: [-0.2, 0, -0.2] },
    // Left platform at -4 elevation
    { size: [10, 1, 14], position: [-9, -4.5, -52], color: PLATFORM_COLOR },
    // Narrow crossing back toward center
    { size: [4, 1, 14], position: [-4, -4.5, -67], color: BRIDGE_COLOR },
    // Right-banked descent: steeper, tilts opposite direction
    { size: [5, 1, 20], position: [2, -6.5, -84], color: BRIDGE_COLOR, rotation: [-0.2, 0, 0.25] },
    // Valley floor — lowest point, narrow, obstacle gauntlet
    { size: [8, 1, 16], position: [5, -8.5, -103], color: PLATFORM_COLOR },
    // Steep uphill climb back to top
    { size: [5, 1, 24], position: [3, -4.5, -123], color: BRIDGE_COLOR, rotation: [0.3, 0, 0] },
    // Recovery platform near start elevation
    { size: [12, 1, 14], position: [1, -0.5, -144], color: PLATFORM_COLOR },
    // Diagonal final descent: forward slope + gentle side tilt
    { size: [6, 1, 20], position: [0, -2.5, -161], color: BRIDGE_COLOR, rotation: [-0.2, 0, 0.1] },
    { size: [16, 1, 16], position: [2, -4.5, -178], color: FINISH_COLOR, isFinish: true }
  ],
  obstacles: [
    { size: [2.5, 2, 2.5], position: [-10, -3.5, -49] },
    { size: [2.5, 2, 2.5], position: [-8, -3.5, -55] },
    { size: [2.5, 2, 2.5], position: [4, -7.5, -100] },
    { size: [2.5, 2, 2.5], position: [6, -7.5, -106] },
    { size: [2.5, 2, 2.5], position: [5, -7.5, -103] }
  ]
}

// Gauntlet: longest track — narrow corridors, stepping-stone gaps, banked descents,
// uphill recovery, diagonal sprint. Gaps range 1.5–3 units; momentum required.
// Platform y = visual bottom (getCube origin.y=0). Obstacle y = platform_y + 1.
const GAUNTLET_TRACK: TrackConfig = {
  name: 'Gauntlet',
  spawnPosition: [0, 1.5, 4],
  finishPosition: [0, -5, -236],
  finishCheckZ: -228,
  finishCheckRadius: 7,
  platforms: [
    // Wide start z: 6 → -6
    { size: [16, 1, 12], position: [0, 0, 0], color: PLATFORM_COLOR },
    // Narrow guarded corridor z: -6 → -26
    { size: [4, 1, 20], position: [0, 0, -16], color: BRIDGE_COLOR },
    // Gap 2 → Stone 1 (1 unit lower) z: -28 → -36
    { size: [7, 1, 8], position: [0, -1, -32], color: PLATFORM_COLOR },
    // Gap 2 → Stone 2 z: -38 → -46
    { size: [7, 1, 8], position: [0, -1, -42], color: PLATFORM_COLOR },
    // Gap 2 → Left-banked descent z: -48 → -70
    { size: [5, 1, 22], position: [-2, -3, -59], color: BRIDGE_COLOR, rotation: [-0.2, 0, -0.25] },
    // Lower left platform z: -70 → -84
    { size: [10, 1, 14], position: [-4, -5.5, -77], color: PLATFORM_COLOR },
    // Narrow crossing z: -84 → -100
    { size: [4, 1, 16], position: [0, -5.5, -92], color: BRIDGE_COLOR },
    // Gap 2 → Right island (1 unit drop) z: -102 → -110
    { size: [6, 1, 8], position: [3, -6.5, -106], color: PLATFORM_COLOR },
    // Gap 2 → Right-banked uphill z: -112 → -136
    { size: [5, 1, 24], position: [2, -3.5, -124], color: BRIDGE_COLOR, rotation: [0.25, 0, 0.2] },
    // Upper recovery platform z: -136 → -150
    { size: [12, 1, 14], position: [2, 0, -143], color: PLATFORM_COLOR },
    // Gap 3 → Diagonal left descent z: -153 → -173
    { size: [5, 1, 20], position: [-2, -2, -163], color: BRIDGE_COLOR, rotation: [-0.2, 0, -0.1] },
    // Gap 2 → Stepping stone 3 z: -175 → -183
    { size: [6, 1, 8], position: [-3, -4.5, -179], color: PLATFORM_COLOR },
    // Gap 2 → Stepping stone 4 z: -185 → -193
    { size: [6, 1, 8], position: [-1, -4.5, -189], color: PLATFORM_COLOR },
    // Gap 2.5 → Finish z: -195.5 → -212 (gap required, final rush)
    { size: [16, 1, 16], position: [0, -5, -204], color: PLATFORM_COLOR },
    // Short connector then finish
    { size: [5, 1, 10], position: [0, -5, -219], color: BRIDGE_COLOR },
    { size: [16, 1, 16], position: [0, -5, -236], color: FINISH_COLOR, isFinish: true }
  ],
  obstacles: [
    // Narrow corridor (platform y=0 → obstacle y=1)
    { size: [2.5, 2, 2.5], position: [1, 1, -11] },
    { size: [2.5, 2, 2.5], position: [-1, 1, -17] },
    { size: [2.5, 2, 2.5], position: [0, 1, -22] },
    // Lower left platform (platform y=-5.5 → obstacle y=-4.5)
    { size: [2.5, 2, 2.5], position: [-5, -4.5, -74] },
    { size: [2.5, 2, 2.5], position: [-2, -4.5, -80] },
    // Narrow crossing (platform y=-5.5 → obstacle y=-4.5)
    { size: [2.5, 2, 2.5], position: [0, -4.5, -89] },
    { size: [2.5, 2, 2.5], position: [0, -4.5, -96] },
    // Upper platform (platform y=0 → obstacle y=1)
    { size: [2.5, 2, 2.5], position: [4, 1, -140] },
    { size: [2.5, 2, 2.5], position: [0, 1, -146] }
  ]
}

// Speed Run: one very steep ramp (~29°) builds speed; seven jump gaps require full momentum.
// Platform y = visual bottom (getCube origin.y=0). Physics surface = y + 0.5.
// Gap physics: d = v * sqrt(2h/g). Gaps 3–5 need v ≈ 9–16 m/s (MAX_LINEAR_SPEED = 20).
// All non-gap transitions are zero-gap (platforms touch). Only intentional jumps have gaps.
// Edge verification: each platform near_z = center_z + half_z; gap = near_z_next - far_z_prev.
const SPEED_RUN_TRACK: TrackConfig = {
  name: 'Speed Run',
  spawnPosition: [0, 2, 4],
  finishPosition: [0, -10, -128],
  finishCheckZ: -121,
  finishCheckRadius: 6,
  platforms: [
    // Wide start — z: 6→-6
    { size: [18, 1, 12], position: [0, 0, 0], color: PLATFORM_COLOR },
    // Steep ramp ~29° — builds full speed — z: -6→-22
    { size: [10, 1, 16], position: [0, -3.8, -14], color: BRIDGE_COLOR, rotation: [-0.5, 0, 0] },
    // Speed floor — keep holding forward — z: -22→-44
    { size: [20, 1, 22], position: [0, -7.5, -33], color: PLATFORM_COLOR },
    // GAP 3 → Landing 1 (0.5-unit drop) — z: -47→-55
    { size: [10, 1, 8], position: [0, -8, -51], color: BRIDGE_COLOR },
    // GAP 4 → Landing 2 (0.5-unit drop) — z: -59→-67
    { size: [10, 1, 8], position: [0, -8.5, -63], color: BRIDGE_COLOR },
    // GAP 5 → Landing 3 (0.5-unit drop) — z: -72→-80
    { size: [10, 1, 8], position: [0, -9, -76], color: BRIDGE_COLOR },
    // GAP 4 → Recovery (wide — regain speed) — z: -84→-100
    { size: [18, 1, 16], position: [0, -9, -92], color: PLATFORM_COLOR },
    // GAP 4 → Landing 4 (0.5-unit drop) — z: -104→-112
    { size: [10, 1, 8], position: [0, -9.5, -108], color: BRIDGE_COLOR },
    // GAP 4 → Landing 5 (0.5-unit drop) — z: -116→-124
    { size: [10, 1, 8], position: [0, -10, -120], color: BRIDGE_COLOR },
    // GAP 5 → Finish — z: -129→-147
    { size: [16, 1, 18], position: [0, -10, -138], color: FINISH_COLOR, isFinish: true }
  ],
  obstacles: []
}

export const TRACKS: TrackConfig[] = [
  LONG_ROAD_TRACK,
  SLOPES_TRACK,
  SWITCHBACK_TRACK,
  GAUNTLET_TRACK,
  SPEED_RUN_TRACK
]

export const TRACK_SELECT_FIELD = {
  type: 'select' as const,
  key: 'trackIndex',
  label: 'Track',
  value: 0,
  options: TRACKS.map((track, index) => ({ value: index, label: track.name }))
}

export const CLOUD_AREA_NAME = 'clouds'
export const CLOUD_AREA_SEED = 42

export const CLOUD_AREA_CONTROLS = {
  area: {
    center: {
      label: 'Center Position',
      component: 'CoordinateInput',
      min: { x: -2000, y: -200, z: -500 },
      max: { x: 2000, y: 0, z: 500 },
      step: { x: 10, y: 1, z: 10 }
    },
    size: {
      label: 'Area Size',
      component: 'CoordinateInput',
      min: { x: 0, y: 0, z: 0 },
      max: { x: 3000, y: 0, z: 5000 },
      step: { x: 10, y: 1, z: 10 }
    }
  },
  textures: {
    baseSize: {
      label: 'Cloud Size',
      component: 'CoordinateInput',
      min: { x: 10, y: 0.1, z: 10 },
      max: { x: 500, y: 5, z: 500 },
      step: { x: 5, y: 0.1, z: 5 }
    },
    sizeVariation: {
      label: 'Size Variation',
      component: 'CoordinateInput',
      min: { x: 0, y: 0, z: 0 },
      max: { x: 200, y: 5, z: 200 },
      step: { x: 5, y: 0.1, z: 5 }
    },
    rotationVariation: {
      label: 'Rotation Variation',
      component: 'CoordinateInput',
      min: { x: 0, y: 0, z: 0 },
      max: { x: 6.28, y: 6.28, z: 6.28 },
      step: { x: 0.1, y: 0.1, z: 0.1 }
    }
  },
  instances: {
    density: { min: 1, max: 100, step: 1, label: 'Count' },
    pattern: {
      label: 'Distribution Pattern',
      options: ['random', 'grid', 'grid-jitter']
    },
    seed: { min: 0, max: 9999, step: 1, label: 'Seed' }
  },
  rendering: {
    opacity: { min: 0, max: 1, step: 0.05, label: 'Opacity' },
    speed: { min: 0, max: 0, step: 0, label: 'Speed' }
  }
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
