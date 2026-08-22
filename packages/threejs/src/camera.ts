import * as THREE from 'three'
import { CoordinateTuple, Model } from '@webgamekit/animation'
import { getOffset } from './getters'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import type { CameraConfig } from './types'

const DEFAULT_PRESET_ASPECT = 16 / 9
const DEFAULT_PRESET_FRUSTUM_SIZE = 40
const DEFAULT_PRESET_VERTICAL_OFFSET = 15

/**
 * Camera preset configurations for different viewing styles
 */
interface CameraPresetConfig {
  type: 'perspective' | 'orthographic'
  fov?: number
  position: CoordinateTuple
  lookAt?: CoordinateTuple
  near?: number
  far?: number
  frustumSize?: number
  verticalOffset?: number
}

/**
 * Enum for camera preset keys
 */
export enum CameraPreset {
  Perspective = 'perspective',
  Fisheye = 'fisheye',
  Cinematic = 'cinematic',
  Orbit = 'orbit',
  FirstPerson = 'first-person',
  ThirdPerson = 'third-person',
  Orthographic = 'orthographic',
  OrthographicFollowing = 'orthographic-following',
  OrthographicFirstPerson = 'orthographic-first-person',
  OrthographicThirdPerson = 'orthographic-third-person',
  TopDown = 'top-down'
}

export enum CameraSide {
  CameraLeft = 'camera-left',
  CameraRight = 'camera-right',
  CameraUp = 'camera-up',
  CameraDown = 'camera-down'
}

/**
 * Dictionary of predefined camera presets for common use cases
 */
export const cameraPresets: Record<CameraPreset, CameraPresetConfig> = {
  [CameraPreset.Perspective]: {
    type: 'perspective',
    fov: 75,
    position: [0, 5, 20],
    near: 0.1,
    far: 1000
  },
  [CameraPreset.Fisheye]: {
    type: 'perspective',
    fov: 120,
    position: [0, 5, 20],
    near: 0.1,
    far: 1000
  },
  [CameraPreset.Cinematic]: {
    type: 'perspective',
    fov: 35,
    position: [0, 5, 20],
    near: 0.1,
    far: 1000
  },
  [CameraPreset.Orbit]: {
    type: 'perspective',
    fov: 75,
    position: [0, 10, 15],
    near: 0.1,
    far: 1000
  },
  // Eye height and chase distance match DEFAULT_FOLLOW_CAMERA, so switching between a preset
  // and the matching follow mode does not jump the view.
  [CameraPreset.FirstPerson]: {
    type: 'perspective',
    fov: 75,
    position: [0, 3.3, 2.8],
    lookAt: [0, 3.3, -20],
    near: 0.1,
    far: 1000
  },
  [CameraPreset.ThirdPerson]: {
    type: 'perspective',
    fov: 65,
    position: [0, 14, 12],
    lookAt: [0, 0, 0],
    near: 0.1,
    far: 1000
  },
  [CameraPreset.OrthographicFirstPerson]: {
    type: 'orthographic',
    position: [0, 3.3, 2.8],
    lookAt: [0, 3.3, -20],
    frustumSize: 20,
    verticalOffset: 0,
    near: 0.1,
    far: 1000
  },
  [CameraPreset.OrthographicThirdPerson]: {
    type: 'orthographic',
    position: [0, 14, 12],
    lookAt: [0, 0, 0],
    frustumSize: 30,
    verticalOffset: 0,
    near: 0.1,
    far: 1000
  },
  [CameraPreset.Orthographic]: {
    type: 'orthographic',
    position: [10, 12, 10],
    lookAt: [0, -15, 0],
    frustumSize: 40,
    verticalOffset: 15,
    near: 0.1,
    far: 1000
  },
  [CameraPreset.OrthographicFollowing]: {
    type: 'orthographic',
    position: [0, 5, 20],
    frustumSize: 30,
    verticalOffset: 10,
    near: 0.1,
    far: 1000
  },
  [CameraPreset.TopDown]: {
    type: 'orthographic',
    position: [0, 50, 0],
    lookAt: [0, 0, 0],
    frustumSize: 50,
    verticalOffset: 0,
    near: 0.1,
    far: 1000
  }
}

/**
 *
 * @param model
 * @param config
 */
export const getLookAt = (model: Model, config: CameraConfig) => {
  const raw = config.lookAt ?? [0, 0, 0]
  const lookAt =
    raw instanceof THREE.Vector3
      ? raw.clone()
      : Array.isArray(raw)
        ? new THREE.Vector3(...(raw as CoordinateTuple))
        : new THREE.Vector3(raw.x, raw.y, raw.z)
  lookAt.applyQuaternion(model.quaternion)
  lookAt.add(model.position)
  return lookAt
}

/**
 * Apply a predefined camera preset to an existing camera
 * @param camera - The Three.js camera to configure (PerspectiveCamera or OrthographicCamera)
 * @param presetName - Name of the preset from cameraPresets dictionary
 * @param aspect - Optional aspect ratio (defaults to current window aspect ratio)
 * @returns The configured camera, or null if preset not found
 */
/**
 * Apply a perspective preset's framing to a perspective camera.
 * @param camera The camera to configure
 * @param preset The preset to apply
 * @param aspect The viewport aspect ratio
 */
const applyPerspectivePresetFraming = (
  camera: THREE.PerspectiveCamera,
  preset: CameraPresetConfig,
  aspect: number
): void => {
  camera.position.set(...preset.position)
  camera.aspect = aspect
  if (preset.fov !== undefined) camera.fov = preset.fov
  if (preset.near !== undefined) camera.near = preset.near
  if (preset.far !== undefined) camera.far = preset.far
}

/**
 * Apply an orthographic preset's frustum to an orthographic camera.
 * @param camera The camera to configure
 * @param preset The preset to apply
 * @param aspect The viewport aspect ratio
 */
const applyOrthographicPresetFrustum = (
  camera: THREE.OrthographicCamera,
  preset: CameraPresetConfig,
  aspect: number
): void => {
  const frustumSize = preset.frustumSize ?? DEFAULT_PRESET_FRUSTUM_SIZE
  const verticalOffset = preset.verticalOffset ?? DEFAULT_PRESET_VERTICAL_OFFSET

  camera.position.set(...preset.position)
  camera.left = (frustumSize * aspect) / -2
  camera.right = (frustumSize * aspect) / 2
  camera.top = frustumSize / 2 + verticalOffset
  camera.bottom = frustumSize / -2 + verticalOffset
  if (preset.near !== undefined) camera.near = preset.near
  if (preset.far !== undefined) camera.far = preset.far
}

/**
 * Point a camera at a preset's look-at target, defaulting to the origin.
 * @param camera The camera to aim
 * @param preset The preset being applied
 */
const aimAtPresetTarget = (camera: THREE.Camera, preset: CameraPresetConfig): void => {
  camera.lookAt(new THREE.Vector3(...(preset.lookAt ?? [0, 0, 0])))
  ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
}

/**
 * Apply a named preset to a camera of the matching projection.
 *
 * A camera cannot change its class in place, so a preset of the other projection returns null
 * rather than pretending to work — the caller has to build the other camera first, which is
 * what the camera panel does.
 * @param camera The camera to configure
 * @param presetName Which preset to apply
 * @param aspect The viewport aspect ratio
 * @returns The configured camera, or null when the preset does not match its projection
 */
export const setCameraPreset = (
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  presetName: CameraPreset,
  aspect: number = DEFAULT_PRESET_ASPECT
): THREE.Camera | null => {
  const preset = cameraPresets[presetName]

  if (!preset) {
    console.warn(
      `Camera preset "${presetName}" not found. Available presets: ${Object.keys(cameraPresets).join(', ')}`
    )
    return null
  }

  const wantsPerspective = preset.type === 'perspective'
  const isPerspective = camera instanceof THREE.PerspectiveCamera

  if (wantsPerspective !== isPerspective) {
    console.warn(
      `Camera preset "${presetName}" is ${preset.type}, but the camera is not. Build the other camera type first, or apply the preset through the camera panel.`
    )
    return null
  }

  if (camera instanceof THREE.PerspectiveCamera) {
    applyPerspectivePresetFraming(camera, preset, aspect)
  } else {
    applyOrthographicPresetFrustum(camera, preset, aspect)
  }

  aimAtPresetTarget(camera, preset)
  return camera
}

/**
 *
 * @param camera
 * @param root0
 * @param root0.x
 * @param root0.y
 * @param root0.z
 * @param value
 */
export const setCameraSide = (
  camera: THREE.PerspectiveCamera,
  { x, y, z }: THREE.Vector3,
  value: CameraSide
) => {
  x = 0
  y = 0
  z = 0
  if (value === CameraSide.CameraDown) {
    y += 5
    z += 20
  } else if (value === CameraSide.CameraUp) {
    y += 5
  } else if (value === CameraSide.CameraLeft) {
    x -= 15
    y += 5
  } else if (value === CameraSide.CameraRight) {
    x += 15
    y += 5
  }
  camera.position.set(x, y, z)
  camera.lookAt(x, y, z)
}

/**
 * Set given camera to third person view
 * @param camera
 * @param config
 * @param model
 */
export const setThirdPersonCamera = (
  camera: THREE.PerspectiveCamera,
  config: CameraConfig,
  model: Model | null
) => {
  if (model) {
    if (config.offset) {
      const offset = getOffset(model, { offset: config.offset })
      camera.position.copy(offset)
    }
    const lookAt = getLookAt(model, config)
    camera.lookAt(lookAt)
  }
}

/**
 * Make camera follow a player/model by updating camera position with offset
 * @param camera - The Three.js camera to update
 * @param player - The player model to follow
 * @param offset - Camera offset from player [x, y, z]
 * @param orbit
 * @param coordinates
 * @returns Updated camera position as CoordinateTuple
 */
export const cameraFollowPlayer = (
  camera: THREE.Camera,
  player: Model,
  offset: CoordinateTuple,
  orbit: OrbitControls | null,
  coordinates: ('x' | 'y' | 'z')[] = ['x', 'y', 'z']
): CoordinateTuple => {
  if (coordinates.includes('x')) {
    camera.position.x = player.position.x + offset[0]
    if (orbit) orbit.target.x = player.position.x
  }
  if (coordinates.includes('y')) {
    camera.position.y = player.position.y + offset[1]
    if (orbit) orbit.target.y = player.position.y
  }
  if (coordinates.includes('z')) {
    camera.position.z = player.position.z + offset[2]
    if (orbit) orbit.target.z = player.position.z
  }

  if (!orbit) camera.lookAt(player.position)

  return [camera.position.x, camera.position.y, camera.position.z]
}

/**
 * Smoothly tilt the camera for dynamic effects like jump reactions
 * @param camera - The Three.js camera to tilt
 * @param targetTilt - Target tilt angle in radians (positive = tilt up, negative = tilt down)
 * @param lerpFactor - Smoothing factor (0-1, higher = faster transition)
 */
export const tiltCamera = (camera: THREE.Camera, targetTilt: number, lerpFactor: number = 0.1) => {
  if (!camera.userData.originalRotation) {
    camera.userData.originalRotation = {
      x: camera.rotation.x,
      y: camera.rotation.y,
      z: camera.rotation.z
    }
  }

  const currentTilt = camera.rotation.x - camera.userData.originalRotation.x
  const tiltDifference = targetTilt - currentTilt
  const newTilt = currentTilt + tiltDifference * lerpFactor

  camera.rotation.x = camera.userData.originalRotation.x + newTilt
}

/**
 * Update camera properties based on configuration
 * @param camera - The Three.js camera to update
 * @param config - Camera configuration object with position, rotation, lookAt, and other properties
 */
export const updateCamera = (
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  config: CameraConfig
): void => {
  if (config.position) {
    if (config.position instanceof Array) {
      camera.position.set(...(config.position as CoordinateTuple))
    } else {
      camera.position.copy(config.position)
    }
  }
  if (config.near !== undefined) camera.near = config.near
  if (config.far !== undefined) camera.far = config.far
  if (config.up) camera.up = config.up
  if (config.zoom !== undefined) camera.zoom = config.zoom

  // PerspectiveCamera specific properties
  if (camera instanceof THREE.PerspectiveCamera) {
    if (config.fov !== undefined) camera.fov = config.fov
    if (config.aspect !== undefined) camera.aspect = config.aspect
    if (config.focus !== undefined) (camera as THREE.PerspectiveCamera).focus = config.focus
  }

  if (config.rotation) {
    if (config.rotation instanceof Array) {
      camera.rotation.set(...(config.rotation as CoordinateTuple))
    } else {
      camera.rotation.setFromVector3(config.rotation as THREE.Vector3)
    }
  }
  if (config.lookAt) applyCameraLookAt(camera, config.lookAt)
  camera.updateProjectionMatrix()
}

const applyCameraLookAt = (
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  lookAt: NonNullable<CameraConfig['lookAt']>
): void => {
  if (lookAt instanceof Array) {
    camera.lookAt(...(lookAt as CoordinateTuple))
  } else if (lookAt instanceof THREE.Vector3) {
    camera.lookAt(lookAt)
  } else {
    camera.lookAt(lookAt.x, lookAt.y, lookAt.z)
  }
}
