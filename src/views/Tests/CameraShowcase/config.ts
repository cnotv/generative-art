import type { CoordinateTuple } from '@webgamekit/animation'
import type { CameraPathPoint, ModelOptions, SetupConfig } from '@webgamekit/threejs'

/**
 * The camera behaviours that have no UI of their own, plus `panel`, which drives nothing at all.
 *
 * Presets are the Elements panel's job — it owns them through `registerCameraHandlers` and does
 * the part this view could not: switching between perspective and orthographic cameras, scaling
 * the orthographic frustum to the current framing, and tweening between states. `panel` is how
 * the two coexist: this view writes the camera every frame, so it has to stand down for the
 * panel to hold, exactly as a follow camera stands down for a cinematic path.
 */
export const CAMERA_CASES = ['third', 'first', 'free', 'path', 'side', 'panel'] as const

export type CameraCase = (typeof CAMERA_CASES)[number]

export const CAMERA_CASE_LABELS: Record<CameraCase, string> = {
  third: 'Third person',
  first: 'First person',
  free: 'Free chase',
  path: 'Cinematic path',
  side: 'Side',
  panel: 'Elements panel'
}

export const TRACK_RADIUS = 26
export const TRACK_SECONDS = 20
export const TARGET_HEIGHT = 1

/** Landmarks, so camera motion is readable — an empty plane hides everything. */
export const PILLARS: CoordinateTuple[] = [
  [0, 0, -34],
  [34, 0, 0],
  [0, 0, 34],
  [-34, 0, 0],
  [24, 0, -24],
  [-24, 0, 24]
]

export const PILLAR: ModelOptions = {
  name: 'landmark',
  size: [3, 12, 3],
  color: 0x8d7b68,
  type: 'fixed',
  castShadow: true,
  receiveShadow: true
}

export const TARGET: ModelOptions = {
  name: 'camera-target',
  size: [2, 2, 4],
  color: 0xef6461,
  type: 'fixed',
  castShadow: true
}

/** A sweep that circles the arena while holding the centre in view. */
export const INTRO_PATH: CameraPathPoint[] = [
  { position: [0, 6, 60], lookAt: [0, 2, 0] },
  { position: [48, 22, 30], lookAt: [0, 2, 0] },
  { position: [58, 34, -20], lookAt: [0, 2, 0] },
  { position: [0, 40, -58], lookAt: [0, 2, 0] },
  { position: [-46, 20, -26], lookAt: [0, 2, 0] },
  { position: [-30, 8, 34], lookAt: [0, 2, 0] }
]

export const INTRO_SECONDS = 9

export const setupConfig: SetupConfig = {
  camera: { position: [0, 18, 60], lookAt: [0, 0, 0], fov: 65 },
  lights: {
    ambient: { intensity: 0.65 },
    directional: { intensity: 1.3, position: [30, 50, 20], castShadow: true }
  },
  ground: { size: [140, 1, 140], position: [0, 0, 0], color: 0x3f6d4e },
  sky: { color: 0x87ceeb },
  // Kept, not removed: the scene store expects an OrbitControls instance to exist. Disabled so
  // it takes no input, and every case below steers `orbit.target` — because orbit.update() runs
  // after the timeline each frame and re-aims the camera at that target regardless.
  orbit: { disabled: true }
}

/**
 * Switching cameras is the whole point of this view, so it is bound to input as well as the
 * panel: number keys pick a case directly, shoulder buttons cycle through them.
 */
export const CONTROLS = {
  mapping: {
    keyboard: {
      '1': 'case-third',
      '2': 'case-first',
      '3': 'case-free',
      '4': 'case-path',
      '5': 'case-side',
      '6': 'case-panel',
      q: 'case-previous',
      e: 'case-next'
    },
    gamepad: {
      l1: 'case-previous',
      r1: 'case-next',
      cross: 'case-next'
    }
  }
}

/** Which case each direct-select action selects. */
export const CASE_BY_ACTION: Record<string, CameraCase> = {
  'case-third': 'third',
  'case-first': 'first',
  'case-free': 'free',
  'case-path': 'path',
  'case-side': 'side',
  'case-panel': 'panel'
}

/** The keys shown in the on-screen hint, in the order the cases are listed. */
export const CASE_KEYS: Record<CameraCase, string> = {
  third: '1',
  first: '2',
  free: '3',
  path: '4',
  side: '5',
  panel: '6'
}

export const configControls = {
  camera: {
    case: {
      component: 'ButtonSelector',
      label: 'Camera case',
      options: CAMERA_CASES.map((value) => ({ value, label: CAMERA_CASE_LABELS[value] }))
    },
    side: {
      label: 'Side (side case)',
      options: ['camera-left', 'camera-right', 'camera-up', 'camera-down']
    },
    tilt: { min: -0.6, max: 0.6, step: 0.02, label: 'Tilt (roll)' }
  }
}
