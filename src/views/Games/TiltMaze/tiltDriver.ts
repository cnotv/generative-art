import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { getTiltGravity, smoothTilt } from './tilt'
import type { ScreenTilt } from './types'
import { CAMERA_AXIS_NUDGE } from './config'

export interface TiltSettings {
  smoothing: number
  gravityStrength: number
  cameraLeanPerDegree: number
}

export interface TiltDriver {
  /** Advance one frame: smooth the lean, steer gravity by it, and lean the camera to match. */
  apply: (cameraHeight: number, ball: { userData: { body: RAPIER.RigidBody } }) => void
  /** Hold the board still, for a round that has already been decided. */
  park: (cameraHeight: number) => void
}

/**
 * Turns a wanted lean into a moving ball and a leaning view.
 *
 * The board and its colliders never move — gravity does. That is indistinguishable to a player
 * watching a ball roll, and costs one vector assignment instead of re-orienting every wall body
 * each frame. The camera lean is then a separate, purely visual concern layered on top.
 * @param options Scene handles, the wanted lean, and the live tuning values
 * @returns The per-frame driver
 */
export const createTiltDriver = (options: {
  camera: THREE.Camera
  world: RAPIER.World
  getTargetTilt: () => ScreenTilt
  getSettings: () => TiltSettings
}): TiltDriver => {
  const { camera, world, getTargetTilt, getSettings } = options
  const applied: ScreenTilt = { tiltX: 0, tiltZ: 0 }
  const target = new THREE.Vector3(0, 0, 0)

  // Looking straight down leaves the roll undefined, so `lookAt` spins the board whenever the
  // camera leaves the Y axis. Pinning up to -Z fixes screen-up to the board's far edge, which
  // is also the frame the tilt maths assumes.
  camera.up.set(0, 0, -1)

  const setGravity = (x: number, y: number, z: number): void => {
    world.gravity.x = x
    world.gravity.y = y
    world.gravity.z = z
  }

  const aimCamera = (cameraHeight: number, lean: number): void => {
    camera.position.set(
      applied.tiltX * lean,
      cameraHeight,
      applied.tiltZ * lean + CAMERA_AXIS_NUDGE
    )
    camera.lookAt(target)
  }

  const apply: TiltDriver['apply'] = (cameraHeight, ball) => {
    const { smoothing, gravityStrength, cameraLeanPerDegree } = getSettings()
    const blended = smoothTilt(applied, getTargetTilt(), smoothing)
    applied.tiltX = blended.tiltX
    applied.tiltZ = blended.tiltZ

    const gravity = getTiltGravity(applied, gravityStrength)
    setGravity(gravity.x, gravity.y, gravity.z)

    // Rapier sleeps a body that has come to rest, and a changed world gravity is not one of the
    // events that wakes it — so a ball parked against a wall would ignore every lean until
    // something else touched it.
    ball.userData.body.wakeUp()
    aimCamera(cameraHeight, cameraLeanPerDegree)
  }

  const park: TiltDriver['park'] = (cameraHeight) => {
    setGravity(0, 0, 0)
    aimCamera(cameraHeight, getSettings().cameraLeanPerDegree)
  }

  return { apply, park }
}
