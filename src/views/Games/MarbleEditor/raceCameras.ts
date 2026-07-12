import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { cameraFollowPlayer } from '@webgamekit/threejs'
import type { ComplexModel, CoordinateTuple } from '@webgamekit/animation'
import type { CameraMode } from './types'
import {
  FIRST_PERSON_HEIGHT,
  FIRST_PERSON_LOOK_AHEAD,
  FIRST_PERSON_DIRECTION_LERP,
  FIRST_PERSON_MIN_SPEED
} from './config'

const scratchDirection = new THREE.Vector3()
const scratchLookTarget = new THREE.Vector3()

export const createSmoothedDirection = (): THREE.Vector3 => new THREE.Vector3(0, 0, -1)

export const updateFirstPersonCamera = (
  camera: THREE.Camera,
  marble: THREE.Object3D,
  velocity: { x: number; y: number; z: number },
  smoothedDirection: THREE.Vector3,
  orbit: OrbitControls | null
): void => {
  const speed = Math.hypot(velocity.x, velocity.z)
  if (speed > FIRST_PERSON_MIN_SPEED) {
    scratchDirection.set(velocity.x, 0, velocity.z).normalize()
    smoothedDirection.lerp(scratchDirection, FIRST_PERSON_DIRECTION_LERP).normalize()
  }
  camera.position.set(marble.position.x, marble.position.y + FIRST_PERSON_HEIGHT, marble.position.z)
  scratchLookTarget
    .copy(camera.position)
    .addScaledVector(smoothedDirection, FIRST_PERSON_LOOK_AHEAD)
  // The render loop calls orbit.update() every frame, which re-points the
  // camera at orbit.target — so the look direction must go through the target.
  if (orbit) orbit.target.copy(scratchLookTarget)
  camera.lookAt(scratchLookTarget)
}

export type RaceCameraOptions = {
  mode: CameraMode
  camera: THREE.Camera
  marble: ComplexModel | null
  orbit: OrbitControls | null
  offset: CoordinateTuple
  smoothedDirection: THREE.Vector3
}

export const applyRaceCamera = (options: RaceCameraOptions): void => {
  const { mode, camera, marble, orbit } = options
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
    cameraFollowPlayer(camera, marble, options.offset, orbit)
    return
  }
  updateFirstPersonCamera(
    camera,
    marble,
    marble.userData.body.linvel(),
    options.smoothedDirection,
    orbit
  )
}
