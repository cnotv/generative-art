import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { ComplexModel } from '@webgamekit/animation'
import type { CameraMode } from '../types'
import {
  FIRST_PERSON_HEIGHT,
  FIRST_PERSON_LOOK_AHEAD,
  FIRST_PERSON_DIRECTION_LERP,
  FIRST_PERSON_MIN_SPEED,
  FREE_CAM_HEIGHT,
  FREE_CAM_BACK
} from '../config'
import { CAMERA_HEIGHT, CAMERA_BACK, CAMERA_LERP } from '../../MarbleMadness/config'

const scratchDirection = new THREE.Vector3()
const scratchLookTarget = new THREE.Vector3()
const scratchCameraGoal = new THREE.Vector3()

const REVERSE_DOT_THRESHOLD = -0.3

export const createSmoothedDirection = (): THREE.Vector3 => new THREE.Vector3(0, 0, -1)

/**
 * Tracks the marble's travel heading, ignoring brief reversals so that
 * backward pushes do not flip the whole control frame.
 */
export const updateSmoothedDirection = (
  smoothedDirection: THREE.Vector3,
  velocity: { x: number; y: number; z: number }
): void => {
  const speed = Math.hypot(velocity.x, velocity.z)
  if (speed <= FIRST_PERSON_MIN_SPEED) return
  scratchDirection.set(velocity.x, 0, velocity.z).normalize()
  if (scratchDirection.dot(smoothedDirection) < REVERSE_DOT_THRESHOLD) return
  smoothedDirection.lerp(scratchDirection, FIRST_PERSON_DIRECTION_LERP).normalize()
}

// easeOutCubic: a mode switch glides in fast then settles, landing exactly on
// the goal at alpha 1 (no residual snap). Clamped so callers can pass a raw
// elapsed/duration ratio.
export const easeTransition = (alpha: number): number => {
  const clamped = Math.min(1, Math.max(0, alpha))
  return 1 - (1 - clamped) ** 3
}

export type RaceCameraOptions = {
  mode: CameraMode
  camera: THREE.Camera
  marble: ComplexModel | null
  orbit: OrbitControls | null
  smoothedDirection: THREE.Vector3
  transitionStart: THREE.Vector3
  transitionAlpha: number
}

export const updateFirstPersonCamera = (options: RaceCameraOptions): void => {
  const { camera, marble, smoothedDirection, orbit, transitionStart, transitionAlpha } = options
  if (!marble) return
  scratchCameraGoal.set(
    marble.position.x,
    marble.position.y + FIRST_PERSON_HEIGHT,
    marble.position.z
  )
  // At alpha 1 this lands exactly on the marble head (no follow lag); below 1 it
  // eases in from where the previous mode left the camera.
  camera.position.lerpVectors(transitionStart, scratchCameraGoal, easeTransition(transitionAlpha))
  scratchLookTarget
    .copy(camera.position)
    .addScaledVector(smoothedDirection, FIRST_PERSON_LOOK_AHEAD)
  // The render loop calls orbit.update() every frame, which re-points the
  // camera at orbit.target — so the look direction must go through the target.
  if (orbit) orbit.target.copy(scratchLookTarget)
  camera.lookAt(scratchLookTarget)
}

export const updateThirdPersonCamera = (options: RaceCameraOptions): void => {
  const { camera, marble, smoothedDirection, orbit } = options
  if (!marble) return
  scratchCameraGoal.set(
    marble.position.x - smoothedDirection.x * CAMERA_BACK,
    marble.position.y + CAMERA_HEIGHT,
    marble.position.z - smoothedDirection.z * CAMERA_BACK
  )
  camera.position.lerp(scratchCameraGoal, CAMERA_LERP)
  if (orbit) orbit.target.copy(marble.position)
  camera.lookAt(marble.position)
}

// Free-cam entry frames the whole track (high and far back), then eases in and
// hands control to orbit at alpha 1. Orbit is held disabled during the glide so
// orbit.update() does not fight the lerp; once settled, the player owns it.
export const updateFreeCamera = (options: RaceCameraOptions): void => {
  const { camera, marble, smoothedDirection, orbit, transitionStart, transitionAlpha } = options
  if (!marble) return
  if (transitionAlpha >= 1) {
    if (orbit) {
      orbit.enabled = true
      orbit.target.copy(marble.position)
    }
    return
  }
  if (orbit) {
    orbit.enabled = false
    orbit.target.copy(marble.position)
  }
  scratchCameraGoal.set(
    marble.position.x - smoothedDirection.x * FREE_CAM_BACK,
    marble.position.y + FREE_CAM_HEIGHT,
    marble.position.z - smoothedDirection.z * FREE_CAM_BACK
  )
  camera.position.lerpVectors(transitionStart, scratchCameraGoal, easeTransition(transitionAlpha))
  camera.lookAt(marble.position)
}

export const applyRaceCamera = (options: RaceCameraOptions): void => {
  const { mode, marble, orbit } = options
  if (!marble) return
  if (mode === 'free') {
    updateFreeCamera(options)
    return
  }
  if (orbit) orbit.enabled = false
  if (mode === 'third') {
    updateThirdPersonCamera(options)
    return
  }
  updateFirstPersonCamera(options)
}
