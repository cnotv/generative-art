import type { CoordinateTuple } from '@webgamekit/animation'
import type { AreaConfig, SetupConfig } from '@webgamekit/threejs'
import * as THREE from 'three'

export const ROAD_WIDTH = 3.4
export const ROAD_LENGTH = 130
export const ROAD_TOP_Y = 0.06
export const ROAD_THICKNESS = 0.12
export const ROAD_ROUGHNESS_DRY = 0.6
export const ROAD_ROUGHNESS_WET_DROP = 0.4
export const ROAD_CENTER_X = 0
export const ROAD_START_Z = 10
export const VERGE_TOP_Y = 0.02
export const VERGE_CLEARANCE = 0.3

export const CAMERA_POSITION: CoordinateTuple = [0, 1.7, 7]
export const CAMERA_LOOK_AT: CoordinateTuple = [0, 1.4, -20]
export const CAMERA_FOV = 55
export const ORBIT_TARGET = new THREE.Vector3(...CAMERA_LOOK_AT)

export const SKY_COLOR = 0xc9d4d1
export const GROUND_COLOR = 0x6b5a43
export const ROAD_COLOR = 0x2b2f33

export const TRUNK_COLORS = [0x4a3d30, 0x5a5148, 0x3d332a]
export const CANOPY_COLORS = [0x3f7a34, 0x4c8a3c, 0x5a9a44, 0x2f6b2a, 0x6fa84f]
export const LEAF_LITTER_COLORS = [0x8a6b3a, 0xa9833f, 0x6e4f2a, 0xb5964a, 0x7a5c33, 0x4c8a3c]
export const UNDERGROWTH_COLORS = [0x3f7a34, 0x2f6b2a, 0x5a9a44]

export const TRUNK_MIN_DIAMETER = 0.28
export const TRUNK_MAX_DIAMETER = 0.5
export const TRUNK_MIN_HEIGHT = 7
export const TRUNK_MAX_HEIGHT = 11
export const CANOPY_MIN_SIZE = 1.1
export const CANOPY_MAX_SIZE = 1.7
export const CANOPY_HEIGHT_FACTOR = 0.4
export const SWAY_AMPLITUDE = 0.06
export const SWAY_SPEED = 0.7
export const UNDERGROWTH_MIN_SIZE = 0.5
export const UNDERGROWTH_MAX_SIZE = 1.1

export const TREE_ROW_INNER_EDGE = 2.6
export const TREE_ROW_OUTER_EDGE = 14
export const TREE_ROW_START_Z = 6
export const TREE_ROW_END_Z = -110
export const TREES_PER_SIDE = 34
export const TREE_LAYOUT_SEED = 349
export const UNDERGROWTH_COUNT = 40
export const UNDERGROWTH_SEED = 350

export const LEAF_COUNT = 2600
export const LEAF_SEED = 351
export const LEAF_WIDTH = 0.26
export const LEAF_HEIGHT = 0.18
export const LEAF_ROAD_SHARE = 0.4
export const LEAF_LIFT_ROAD = 0.02
export const LEAF_LIFT_VERGE = 0.03
export const RANDOM_MIDPOINT = 0.5
export const LEAF_SPREAD_X = 12
export const LEAF_START_Z = 8
export const LEAF_END_Z = -110

export const leftTreeArea: AreaConfig = {
  center: [-8.3, 0, -52],
  size: [11.4, 0, 116],
  count: TREES_PER_SIDE,
  pattern: 'grid-jitter',
  seed: TREE_LAYOUT_SEED
}

export const rightTreeArea: AreaConfig = {
  center: [8.3, 0, -52],
  size: [11.4, 0, 116],
  count: TREES_PER_SIDE,
  pattern: 'grid-jitter',
  seed: TREE_LAYOUT_SEED + 1
}

export const undergrowthArea: AreaConfig = {
  center: [0, 0, -50],
  size: [12, 0, 110],
  count: UNDERGROWTH_COUNT,
  pattern: 'random',
  seed: UNDERGROWTH_SEED
}

export const setupConfig: SetupConfig = {
  orbit: {
    target: ORBIT_TARGET,
    disabled: false
  },
  camera: {
    position: CAMERA_POSITION,
    lookAt: CAMERA_LOOK_AT,
    fov: CAMERA_FOV,
    up: new THREE.Vector3(0, 1, 0),
    near: 0.1,
    far: 800
  },
  lights: {
    ambient: { color: 0xffffff, intensity: 0.85 },
    directional: { color: 0xf2f4f0, intensity: 0.7, position: [20, 60, 10] }
  },
  ground: {
    size: [60, 0.1, 150],
    position: [0, 0, -45],
    color: GROUND_COLOR
  },
  sky: { size: 700, color: SKY_COLOR }
}

export const DEFAULT_LEAF_DENSITY = 0.8
export const DEFAULT_ROAD_WETNESS = 0.7
export const DEFAULT_CANOPY_SWAY = true

export const configControls = {
  leafDensity: { min: 0, max: 1, step: 0.05, label: 'Leaf Density' },
  roadWetness: { min: 0, max: 1, step: 0.05, label: 'Road Wetness' },
  canopySway: { boolean: true, label: 'Canopy Sway' }
}
