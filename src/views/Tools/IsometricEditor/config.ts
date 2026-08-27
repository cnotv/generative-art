import type { CoordinateTuple, SetupConfig } from '@webgamekit/threejs'
import type { ConfigControlsSchema } from '@/stores/viewConfig'
import { cameraSchema as sceneCameraSchema } from '@/views/Tools/SceneEditor/config'
import type { PlaceableModel } from './types'

/** The shared camera controls without field of view, which an orthographic camera has none of. */
export const cameraSchema = {
  position: sceneCameraSchema.position,
  rotation: sceneCameraSchema.rotation,
  near: sceneCameraSchema.near,
  far: sceneCameraSchema.far,
  orbitTarget: sceneCameraSchema.orbitTarget
}

/** Palette entry that clears a cell instead of filling it. */
export const ERASE_MODEL = 'erase'

export const MODEL_PALETTE: PlaceableModel[] = [
  { value: 'block', label: 'Block', shape: 'cube', size: [1, 1, 1], color: 0xd9a6a0 },
  { value: 'slab', label: 'Slab', shape: 'cube', size: [1, 0.15, 1], color: 0xbfc9d4 },
  { value: 'wall', label: 'Wall', shape: 'cube', size: [1, 1.5, 0.2], color: 0xc9bfd9 },
  { value: 'sphere', label: 'Sphere', shape: 'ball', size: [0.8, 0.8, 0.8], color: 0xa8c9bf },
  { value: 'column', label: 'Column', shape: 'cylinder', size: [0.7, 1.6, 0.7], color: 0xd9cfa6 }
]

const toSwatch = (color: number): string => `#${color.toString(16).padStart(6, '0')}`

/** The board is the grid: one size for both, so no ground is ever left outside a cell. */
export const GROUND_SIZE = 80
export const GRID_ELEVATION = 0.02
export const GRID_LINE_COLOR = 0x5f5a6b
export const GRID_CENTER_COLOR = 0xe8e2d8

export const HIGHLIGHT_COLOR = 0xf0b49a
export const HIGHLIGHT_HEIGHT = 0.06
export const HIGHLIGHT_OPACITY = 0.55

export const CAMERA_POSITION: CoordinateTuple = [50, 50, 50]
export const CAMERA_FRUSTUM_HEIGHT = 90
export const CAMERA_NEAR = 0.1
export const CAMERA_FAR = 500

/** How far a pointer may travel between press and release and still place a model. */
export const DRAG_THRESHOLD_PIXELS = 4

export const defaultConfig = {
  model: MODEL_PALETTE[0].value,
  grid: { cellSize: 4 }
}

export const configControls: ConfigControlsSchema = {
  model: {
    label: 'Model',
    component: 'ButtonSelector',
    direction: 'column',
    options: [
      ...MODEL_PALETTE.map(({ value, label, color }) => ({
        value,
        label,
        color: toSwatch(color)
      })),
      { value: ERASE_MODEL, label: 'Erase' }
    ]
  },
  clearAll: { label: 'Clear all', callback: 'clearAll' },
  grid: {
    cellSize: { label: 'Cell size', min: 1, max: 10, step: 1 }
  }
}

export const sceneSetupConfig: SetupConfig = {
  scene: { backgroundColor: 0xe9e5df },
  ground: { color: 0x7c7688, size: GROUND_SIZE, position: [0, 0, 0] },
  sky: false,
  lights: {
    ambient: { intensity: 1.3 },
    directional: {
      intensity: 2,
      position: [40, 60, 25],
      castShadow: true,
      shadow: { camera: { left: -60, right: 60, top: 60, bottom: -60 }, bias: -0.0005 }
    }
  }
}
