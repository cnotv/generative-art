import type { CoordinateTuple, SetupConfig } from '@webgamekit/threejs'
import type { ConfigControlsSchema } from '@/stores/viewConfig'
import { cameraSchema as sceneCameraSchema } from '@/views/Tools/SceneEditor/config'
import type { CellIndex, CityModel, LayoutPreset } from './types'

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
 * Every green or wet cell is the same slab, so grass, water, trees and bushes lie flush with
 * each other. A tree on its own patch of grass beside a plain one must not show a step.
 */
const GROUND_COVER_HEIGHT = 0.04
const GRASS_COLOR = 0xbcd0a0

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
    value: 'school',
    label: 'School',
    swatch: 0xb9a679,
    parts: [
      { shape: 'cube', size: [0.9, 0.5, 0.7], offset: [0, 0, 0], color: 0xe8dcc0 },
      { shape: 'cube', size: [1, 0.12, 0.8], offset: [0, 0.5, 0], color: 0xb9a679 },
      { shape: 'cube', size: [0.18, 0.35, 0.18], offset: [-0.3, 0.62, 0], color: 0xd9cfa6 }
    ]
  },
  {
    value: 'hospital',
    label: 'Hospital',
    swatch: 0xd98f8f,
    parts: [
      { shape: 'cube', size: [0.85, 0.6, 0.8], offset: [0, 0, 0], color: 0xeae6e2 },
      { shape: 'cube', size: [0.95, 0.1, 0.9], offset: [0, 0.6, 0], color: 0xc9c4bf },
      { shape: 'cube', size: [0.4, 0.06, 0.12], offset: [0, 0.7, 0], color: 0xd98f8f },
      { shape: 'cube', size: [0.12, 0.06, 0.4], offset: [0, 0.7, 0], color: 0xd98f8f }
    ]
  },
  {
    value: 'cityHall',
    label: 'City hall',
    swatch: 0xa6c7bd,
    parts: [
      { shape: 'cube', size: [0.9, 0.45, 0.75], offset: [0, 0, 0], color: 0xe6e0d4 },
      { shape: 'cube', size: [0.9, 0.06, 0.14], offset: [0, 0, 0.42], color: 0xcfc7b6 },
      { shape: 'cube', size: [0.55, 0.3, 0.5], offset: [0, 0.45, 0], color: 0xcfc7b6 },
      { shape: 'ball', size: [0.4, 0.4, 0.4], offset: [0, 0.75, 0], color: 0xa6c7bd }
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
    value: 'skyscraper',
    label: 'Skyscraper',
    swatch: 0x9aa0c4,
    parts: [
      { shape: 'cube', size: [0.62, 1.8, 0.62], offset: [0, 0, 0], color: 0xb9bed8 },
      { shape: 'cube', size: [0.42, 1.1, 0.42], offset: [0, 1.8, 0], color: 0x9aa0c4 },
      { shape: 'cylinder', size: [0.1, 0.5, 0.1], offset: [0, 2.9, 0], color: 0xd9d5cc }
    ]
  },
  {
    value: 'tree',
    label: 'Tree',
    swatch: 0x8fbfa0,
    parts: [
      { shape: 'cube', size: [1, GROUND_COVER_HEIGHT, 1], offset: [0, 0, 0], color: GRASS_COLOR },
      {
        shape: 'cylinder',
        size: [0.16, 0.45, 0.16],
        offset: [0, GROUND_COVER_HEIGHT, 0],
        color: 0xa8917c
      },
      { shape: 'ball', size: [0.62, 0.62, 0.62], offset: [0, 0.44, 0], color: 0x8fbfa0 }
    ]
  },
  {
    value: 'bushes',
    label: 'Bushes',
    swatch: 0x9ccfae,
    parts: [
      { shape: 'cube', size: [1, GROUND_COVER_HEIGHT, 1], offset: [0, 0, 0], color: GRASS_COLOR },
      {
        shape: 'ball',
        size: [0.34, 0.34, 0.34],
        offset: [0.22, GROUND_COVER_HEIGHT, -0.18],
        color: 0x8fbfa0
      },
      {
        shape: 'ball',
        size: [0.24, 0.24, 0.24],
        offset: [-0.25, GROUND_COVER_HEIGHT, 0.2],
        color: 0x9ccfae
      }
    ]
  },
  {
    value: 'grass',
    label: 'Grass',
    swatch: GRASS_COLOR,
    parts: [
      { shape: 'cube', size: [1, GROUND_COVER_HEIGHT, 1], offset: [0, 0, 0], color: GRASS_COLOR }
    ]
  },
  {
    value: 'water',
    label: 'Water',
    swatch: 0x9fc4d8,
    parts: [
      { shape: 'cube', size: [1, GROUND_COVER_HEIGHT, 1], offset: [0, 0, 0], color: 0x9fc4d8 }
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

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index)

/** A run of cells along X, which is how a street or a terrace is written. */
const alongX = (fromX: number, toX: number, cellZ: number): CellIndex[] =>
  range(fromX, toX).map((cellX) => [cellX, cellZ])

/** A run of cells along Z, for a street crossing the other way. */
const alongZ = (cellX: number, fromZ: number, toZ: number): CellIndex[] =>
  range(fromZ, toZ).map((cellZ) => [cellX, cellZ])

const block = (fromX: number, toX: number, fromZ: number, toZ: number): CellIndex[] =>
  range(fromX, toX).flatMap((cellX) => range(fromZ, toZ).map((cellZ): CellIndex => [cellX, cellZ]))

/**
 * A worked example: three avenues and three streets, terraces filling the blocks between them,
 * towers where they cross, and parks and trees in the gaps. Loading it beats staring at an
 * empty grid wondering what the components are for.
 */
export const CITY_PRESET: LayoutPreset = {
  name: 'Small city',
  cellSize: 4,
  pieces: [
    {
      model: 'road',
      cells: [
        ...alongX(-8, 6, -4),
        // The avenue runs on past the town and over the river, which makes cell [8, 0] a bridge.
        ...alongX(-8, 9, 0),
        ...alongX(-8, 6, 4),
        ...alongZ(-5, -7, 7),
        ...alongZ(0, -7, 7),
        ...alongZ(4, -3, 7)
      ]
    },
    { model: 'water', cells: [...alongZ(8, -9, -1), ...alongZ(8, 1, 9)] },
    { model: 'grass', cells: [...alongZ(7, -9, -1), ...alongZ(7, 1, 9)] },
    {
      model: 'bushes',
      cells: [
        [-1, 3],
        ...alongX(-2, -1, 7),
        ...alongX(1, 3, 7),
        ...block(-8, -7, 1, 2),
        ...alongX(-8, -6, -7),
        ...alongX(-8, -6, -5)
      ]
    },
    {
      model: 'house',
      cells: [
        ...alongX(-4, -1, -3),
        ...alongX(-4, -2, 1),
        ...alongX(-4, -2, 3),
        ...alongX(1, 3, 3),
        [-4, 5],
        ...alongX(-2, -1, 5),
        ...alongX(-4, -3, 7),
        [1, 5],
        [3, 5],
        ...alongX(-8, -6, -1),
        ...alongX(-8, -7, -3),
        [-6, 1],
        [-6, 3],
        ...alongX(-8, -6, 5),
        ...alongX(-8, -6, 7),
        ...alongX(1, 3, -5),
        ...alongX(1, 3, -7),
        ...alongX(-4, -1, -5),
        ...alongX(-4, -1, -7),
        ...alongX(5, 6, -1),
        ...alongX(5, 6, 1),
        ...alongX(5, 6, 3),
        ...alongX(5, 6, 5)
      ]
    },
    { model: 'school', cells: [[-3, 5]] },
    { model: 'hospital', cells: [[2, 5]] },
    { model: 'cityHall', cells: [[-2, -1]] },
    { model: 'shop', cells: [...alongX(-4, -3, -1), [-1, -1], ...alongX(1, 3, 1)] },
    {
      model: 'tower',
      cells: [
        [1, -1],
        [3, -1],
        [3, -3]
      ]
    },
    {
      model: 'skyscraper',
      cells: [
        [2, -1],
        [1, -3]
      ]
    },
    {
      model: 'tree',
      cells: [
        [-3, -2],
        [-1, -2],
        [2, -2],
        [-4, 2],
        [-2, 2],
        [2, 2],
        [-3, 6],
        [-1, 6],
        [2, 6],
        [-7, -2],
        [-8, 3],
        [-7, 6],
        [2, -6],
        [-3, -6],
        [-1, -6],
        [-7, -6],
        [5, -3],
        [6, 7]
      ]
    },
    { model: 'fence', cells: [...alongX(-6, 1, -8), ...alongX(-6, 1, 8)] }
  ]
}

export const defaultConfig = {
  model: CITY_MODELS[0].value,
  grid: { cellSize: 4 },
  // Off by default so a drag paints a run of cells rather than swinging the camera.
  orbit: false
}

export const configControls: ConfigControlsSchema = {
  model: {
    label: 'Model',
    component: 'ButtonSelector',
    // Wrapped rather than stacked: a column of fourteen pushes the rest of the panel off screen.
    direction: 'row',
    options: [
      ...CITY_MODELS.map(({ value, label, swatch }) => ({
        value,
        label,
        color: toSwatch(swatch)
      })),
      { value: ERASE_MODEL, label: 'Erase' }
    ]
  },
  loadPreset: { label: `Load ${CITY_PRESET.name.toLowerCase()}`, callback: 'loadPreset' },
  clearAll: { label: 'Clear all', callback: 'clearAll' },
  orbit: { boolean: false, label: 'Orbit camera' },
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
