import type { CoordinateTuple, SetupConfig } from '@webgamekit/threejs'
import type { ConfigControlsSchema } from '@/stores/viewConfig'
import { cameraSchema as sceneCameraSchema } from '@/views/Tools/SceneEditor/config'
import type { CityModel } from './types'

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

/**
 * The pieces a city is built from, each a handful of primitives inside one cell.
 *
 * A model never reaches past its cell, so neighbours meet without intersecting and a run of
 * roads or fences reads as one continuous thing. Sizes and offsets are in cells rather than
 * world units, so the whole catalogue follows the grid when its cell size changes.
 */
export const CITY_MODELS: CityModel[] = [
  {
    value: 'house',
    label: 'House',
    swatch: 0xc98f86,
    parts: [
      { shape: 'cube', size: [0.8, 0.6, 0.8], offset: [0, 0, 0], color: 0xe8ddcf },
      { shape: 'cube', size: [0.95, 0.18, 0.95], offset: [0, 0.6, 0], color: 0xc98f86 }
    ]
  },
  {
    value: 'shop',
    label: 'Shop',
    swatch: 0x8fa8c0,
    parts: [
      { shape: 'cube', size: [0.85, 0.55, 0.85], offset: [0, 0, 0], color: 0xdfe4ea },
      { shape: 'cube', size: [0.95, 0.14, 0.95], offset: [0, 0.55, 0], color: 0x8fa8c0 },
      { shape: 'cube', size: [0.85, 0.08, 0.22], offset: [0, 0.4, 0.38], color: 0xd9a6a0 }
    ]
  },
  {
    value: 'tower',
    label: 'Tower',
    swatch: 0xc4c6e0,
    parts: [
      { shape: 'cube', size: [0.6, 1.8, 0.6], offset: [0, 0, 0], color: 0xc4c6e0 },
      { shape: 'cube', size: [0.75, 0.15, 0.75], offset: [0, 1.8, 0], color: 0x8f92b8 }
    ]
  },
  {
    value: 'tree',
    label: 'Tree',
    swatch: 0x8fbfa0,
    parts: [
      { shape: 'cylinder', size: [0.16, 0.45, 0.16], offset: [0, 0, 0], color: 0xa8917c },
      { shape: 'ball', size: [0.62, 0.62, 0.62], offset: [0, 0.4, 0], color: 0x8fbfa0 }
    ]
  },
  {
    value: 'park',
    label: 'Park',
    swatch: 0xa7c9a0,
    parts: [
      { shape: 'cube', size: [1, 0.06, 1], offset: [0, 0, 0], color: 0xa7c9a0 },
      { shape: 'ball', size: [0.34, 0.34, 0.34], offset: [0.22, 0.06, -0.18], color: 0x8fbfa0 },
      { shape: 'ball', size: [0.24, 0.24, 0.24], offset: [-0.25, 0.06, 0.2], color: 0x9ccfae }
    ]
  },
  {
    value: 'road',
    label: 'Road',
    swatch: 0x5f5b69,
    parts: [{ shape: 'cube', size: [1, 0.05, 1], offset: [0, 0, 0], color: 0x5f5b69 }]
  },
  {
    value: 'fence',
    label: 'Fence',
    swatch: 0xbfb3a6,
    parts: [
      { shape: 'cube', size: [1, 0.1, 0.08], offset: [0, 0.45, 0], color: 0xbfb3a6 },
      { shape: 'cylinder', size: [0.1, 0.55, 0.1], offset: [-0.42, 0, 0], color: 0xa89c8f },
      { shape: 'cylinder', size: [0.1, 0.55, 0.1], offset: [0.42, 0, 0], color: 0xa89c8f }
    ]
  }
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
  model: CITY_MODELS[0].value,
  grid: { cellSize: 4 }
}

export const configControls: ConfigControlsSchema = {
  model: {
    label: 'Model',
    component: 'ButtonSelector',
    direction: 'column',
    options: [
      ...CITY_MODELS.map(({ value, label, swatch }) => ({
        value,
        label,
        color: toSwatch(swatch)
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
