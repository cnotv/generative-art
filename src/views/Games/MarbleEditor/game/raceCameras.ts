import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { ComplexModel } from '@webgamekit/animation'
import type { CameraMode } from '../types'
import {
  FIRST_PERSON_HEIGHT,
  FIRST_PERSON_LOOK_AHEAD,
  FIRST_PERSON_DIRECTION_LERP,
  FIRST_PERSON_MIN_SPEED
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

export const updateFirstPersonCamera = (
  camera: THREE.Camera,
  marble: THREE.Object3D,
  smoothedDirection: THREE.Vector3,
  orbit: OrbitControls | null
): void => {
  camera.position.set(marble.position.x, marble.position.y + FIRST_PERSON_HEIGHT, marble.position.z)
  scratchLookTarget
    .copy(camera.position)
    .addScaledVector(smoothedDirection, FIRST_PERSON_LOOK_AHEAD)
  // The render loop calls orbit.update() every frame, which re-points the
  // camera at orbit.target — so the look direction must go through the target.
  if (orbit) orbit.target.copy(scratchLookTarget)
  camera.lookAt(scratchLookTarget)
}

export const updateThirdPersonCamera = (
  camera: THREE.Camera,
  marble: THREE.Object3D,
  smoothedDirection: THREE.Vector3,
  orbit: OrbitControls | null
): void => {
  scratchCameraGoal.set(
    marble.position.x - smoothedDirection.x * CAMERA_BACK,
    marble.position.y + CAMERA_HEIGHT,
    marble.position.z - smoothedDirection.z * CAMERA_BACK
  )
  camera.position.lerp(scratchCameraGoal, CAMERA_LERP)
  if (orbit) orbit.target.copy(marble.position)
  camera.lookAt(marble.position)
}

export type RaceCameraOptions = {
  mode: CameraMode
  camera: THREE.Camera
  marble: ComplexModel | null
  orbit: OrbitControls | null
  smoothedDirection: THREE.Vector3
}

export const applyRaceCamera = (options: RaceCameraOptions): void => {
  const { mode, camera, marble, orbit, smoothedDirection } = options
  if (!marble) return
  if (mode === 'free') {
    if (orbit) {
      orbit.enabled = true
      orbit.target.copy(marble.position)
    }
    return
  }
  if (orbit) orbit.enabled = false
  if (mode === 'third') {
    updateThirdPersonCamera(camera, marble, smoothedDirection, orbit)
    return
  }
  updateFirstPersonCamera(camera, marble, smoothedDirection, orbit)
}
