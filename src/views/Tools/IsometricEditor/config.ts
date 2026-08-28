import type { CoordinateTuple, SetupConfig } from '@webgamekit/threejs'
import type { CityModel, LayoutPreset } from './types'

/** Palette entry that clears a cell instead of filling it. */
export const ERASE_MODEL = 'erase'

/**
 * Every green or wet cell is the same slab, so grass, water, trees and bushes lie flush with
 * each other. A tree on its own patch of grass beside a plain one must not show a step.
 */
const GROUND_COVER_HEIGHT = 0.03
/**
 * The board is already green, so nothing has to be laid down before building. The tile is a
 * shade fresher than the board it lies on, or placing grass on grass would do nothing visible.
 */
const GROUND_COLOR = 0xa2bd92
const GRASS_COLOR = 0xbcd4a4

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

/** One cell is one cell. Components are sized in cells, so this is what they are sized against. */
export const CELL_SIZE = 4

/** The board is the grid: one size for both, so no ground is ever left outside a cell. */
export const BOARD_SIZE_DEFAULT = 80
export const BOARD_SIZE_MIN = 24
export const BOARD_SIZE_MAX = 160
/**
 * Two cells, so the board is always an even number of them. A `GridHelper` draws its lines
 * outward from `-size / 2`, and an odd count would put every line half a cell out of step with
 * the cells the snapping computes from the origin.
 */
export const BOARD_SIZE_STEP = CELL_SIZE * 2

/**
 * The grid floats above the flattest components rather than on the ground, so a street or a
 * river is still divided into cells instead of swallowing the lines. In cells, since the
 * components it has to clear are measured that way too.
 */
export const GRID_ELEVATION_CELLS = 0.07
export const GRID_LINE_COLOR = 0xffffff
export const GRID_CENTER_COLOR = 0xffffff
export const GRID_OPACITY = 0.4

export const HIGHLIGHT_COLOR = 0xf0b49a
export const HIGHLIGHT_HEIGHT = 0.06
export const HIGHLIGHT_OPACITY = 0.55

export const CAMERA_POSITION: CoordinateTuple = [50, 50, 50]
export const CAMERA_FRUSTUM_HEIGHT = 90
export const CAMERA_NEAR = 0.1
export const CAMERA_FAR = 500

/** How far a pointer may travel between press and release and still place a model. */
export const DRAG_THRESHOLD_PIXELS = 4

/**
 * A worked example: three avenues and three streets, terraces filling the blocks between them,
 * towers where they cross, and parks and trees in the gaps. Loading it beats staring at an
 * empty grid wondering what the components are for.
 */
export const CITY_PRESET: LayoutPreset = {
  name: 'Small city',
  boardSize: BOARD_SIZE_DEFAULT,
  pieces: [
    {
      model: 'road',
      runs: [
        [-8, 6, -4, -4],
        // The avenue runs on past the town and over the river, which makes cell [8, 0] a bridge.
        [-8, 9, 0, 0],
        [-8, 6, 4, 4],
        [-5, -5, -7, 7],
        [0, 0, -7, 7],
        [4, 4, -3, 7]
      ]
    },
    {
      model: 'water',
      runs: [
        [8, 8, -9, -1],
        [8, 8, 1, 9]
      ]
    },
    {
      model: 'bushes',
      runs: [
        [-1, -1, 3, 3],
        [-2, -1, 7, 7],
        [1, 3, 7, 7],
        [-8, -7, 1, 2],
        [-8, -6, -7, -7],
        [-8, -6, -5, -5]
      ]
    },
    {
      model: 'house',
      runs: [
        [-4, -1, -3, -3],
        [-4, -2, 1, 1],
        [-4, -2, 3, 3],
        [1, 3, 3, 3],
        [-4, -4, 5, 5],
        [-2, -1, 5, 5],
        [-4, -3, 7, 7],
        [1, 1, 5, 5],
        [3, 3, 5, 5],
        [-8, -6, -1, -1],
        [-8, -7, -3, -3],
        [-6, -6, 1, 1],
        [-6, -6, 3, 3],
        [-8, -6, 5, 5],
        [-8, -6, 7, 7],
        [1, 3, -5, -5],
        [1, 3, -7, -7],
        [-4, -1, -5, -5],
        [-4, -1, -7, -7],
        [5, 6, -1, -1],
        [5, 6, 1, 1],
        [5, 6, 3, 3],
        [5, 6, 5, 5]
      ]
    },
    { model: 'school', runs: [[-3, -3, 5, 5]] },
    { model: 'hospital', runs: [[2, 2, 5, 5]] },
    { model: 'cityHall', runs: [[-2, -2, -1, -1]] },
    {
      model: 'shop',
      runs: [
        [-4, -3, -1, -1],
        [-1, -1, -1, -1],
        [1, 3, 1, 1]
      ]
    },
    {
      model: 'tower',
      runs: [
        [1, 1, -1, -1],
        [3, 3, -1, -1],
        [3, 3, -3, -3]
      ]
    },
    {
      model: 'skyscraper',
      runs: [
        [2, 2, -1, -1],
        [1, 1, -3, -3]
      ]
    },
    {
      model: 'tree',
      runs: [
        [-3, -3, -2, -2],
        [-1, -1, -2, -2],
        [2, 2, -2, -2],
        [-4, -4, 2, 2],
        [-2, -2, 2, 2],
        [2, 2, 2, 2],
        [-3, -3, 6, 6],
        [-1, -1, 6, 6],
        [2, 2, 6, 6],
        [-7, -7, -2, -2],
        [-8, -8, 3, 3],
        [-7, -7, 6, 6],
        [2, 2, -6, -6],
        [-3, -3, -6, -6],
        [-1, -1, -6, -6],
        [-7, -7, -6, -6],
        [5, 5, -3, -3],
        [6, 6, 7, 7]
      ]
    },
    {
      model: 'fence',
      runs: [
        [-6, 1, -8, -8],
        [-6, 1, 8, 8]
      ]
    }
  ]
}

export const defaultConfig = {
  model: CITY_MODELS[0].value,
  grid: { show: true, size: BOARD_SIZE_DEFAULT },
  // Off by default so a drag paints a run of cells rather than swinging the camera.
  orbit: false
}

export const sceneSetupConfig: SetupConfig = {
  scene: { backgroundColor: 0xe9e5df },
  ground: { color: GROUND_COLOR, size: BOARD_SIZE_DEFAULT, position: [0, 0, 0] },
  sky: false,
  lights: {
    ambient: { intensity: 1.3 },
    directional: {
      intensity: 2,
      position: [40, 60, 25],
      castShadow: true,
      // Wide enough for the largest board, or its edges lose their shadows.
      shadow: { camera: { left: -120, right: 120, top: 120, bottom: -120 }, bias: -0.0005 }
    }
  }
}
