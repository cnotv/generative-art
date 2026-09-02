import * as THREE from 'three'
import type { SetupConfig } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/animation'

export const RIG_ANIMATOR_SETUP_CONFIG: SetupConfig = {
  scene: { backgroundColor: 0xf5f0e8 },
  camera: { position: [0, 1.6, 4] as CoordinateTuple, fov: 50 },
  ground: { size: 40, color: 0xcfe8d8 },
  sky: false,
  lights: {
    ambient: { color: 0xffffff, intensity: 2.2 },
    directional: {
      color: 0xfff2e0,
      intensity: 1.4,
      position: [4, 6, 4] as CoordinateTuple,
      castShadow: true
    }
  },
  orbit: { target: new THREE.Vector3(0, 1, 0) }
}

export const MODEL_FILE_ACCEPT = '.fbx,.glb,.gltf'
export const POSES_FILE_ACCEPT = 'application/json'

export const BONE_MARKER_RADIUS_FRACTION = 0.015
export const BONE_MARKER_COLOR_DEFAULT = 0xb8c4f0
export const BONE_MARKER_COLOR_SELECTED = 0xf0a8a0

export const DEFAULT_FPS = 30
export const DEFAULT_FRAME_MAX = 150

export const ROTATION_CONTROL = {
  label: 'Bone Rotation',
  component: 'CoordinateInput',
  min: { x: -Math.PI, y: -Math.PI, z: -Math.PI },
  max: { x: Math.PI, y: Math.PI, z: Math.PI },
  step: { x: 0.01, y: 0.01, z: 0.01 }
}

export const EXPORT_GLB_FILENAME = 'rig-animation.glb'
export const EXPORT_JSON_FILENAME = 'rig-animation.json'

export const CAMERA_FRAME_DISTANCE_MULTIPLIER = 2.5
