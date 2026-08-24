import * as THREE from 'three'
import type { CoordinateTuple } from '@webgamekit/animation'
import {
  followCameraPlacement,
  type FollowCameraConfig,
  type FollowCameraMode
} from '@webgamekit/threejs'
import { CAMERA_CASES, TARGET_HEIGHT, TRACK_RADIUS, TRACK_SECONDS, type CameraCase } from './config'

const FULL_TURN = Math.PI * 2

/**
 * Where the demo target sits on its circular track, and which way it is travelling.
 *
 * Follow cameras need a heading, not just a position — first person in particular is unreadable
 * without one — so the direction is the tangent to the circle rather than a fixed vector.
 * @param elapsedSeconds Seconds since the demo started
 * @returns The target's position and unit heading
 */
export const trackPose = (
  elapsedSeconds: number
): { position: CoordinateTuple; direction: CoordinateTuple } => {
  const angle = (elapsedSeconds / TRACK_SECONDS) * FULL_TURN

  return {
    position: [Math.cos(angle) * TRACK_RADIUS, TARGET_HEIGHT, Math.sin(angle) * TRACK_RADIUS],
    direction: [-Math.sin(angle), 0, Math.cos(angle)]
  }
}

/**
 * Whether a case is one of the three follow modes, which are applied every frame from the
 * target's pose rather than set once.
 * @param value The selected case
 * @returns True for the follow modes
 */
export const isFollowCase = (value: CameraCase): value is CameraCase & FollowCameraMode =>
  value === 'third' || value === 'first' || value === 'free'

/**
 * Narrow an arbitrary string to a known case, so a stale panel value cannot drive the camera
 * into an unhandled branch.
 * @param value The value the panel reported
 * @returns The matching case, or the third-person default
 */
export const toCameraCase = (value: unknown): CameraCase =>
  CAMERA_CASES.includes(value as CameraCase) ? (value as CameraCase) : 'third'

/**
 * Step through the case list, wrapping at both ends, for the cycle keys and shoulder buttons.
 * @param current The case in effect
 * @param offset How many places to move, negative to go back
 * @returns The case that many places along
 */
export const stepCameraCase = (current: CameraCase, offset: number): CameraCase => {
  const index = CAMERA_CASES.indexOf(current)
  const next = (index + offset + CAMERA_CASES.length) % CAMERA_CASES.length
  return CAMERA_CASES[next]
}

/**
 * One frame's worth of camera work: what to steer, where the target is, and who else is
 * currently driving.
 *
 * `camera` is passed in rather than captured because the elements panel can swap the projection,
 * which replaces the camera object outright.
 */
interface CameraFrame {
  /**
   * Resolves the camera to steer, called fresh each frame.
   *
   * A getter rather than the camera itself: choosing an orthographic preset replaces the camera
   * object, and anything holding the old one goes on steering a camera nobody is rendering.
   */
  getCamera: () => THREE.Camera | null
  orbit: { target: THREE.Vector3 } | null
  selected: CameraCase
  targetPosition: THREE.Vector3
  targetDirection: THREE.Vector3
  follow: FollowCameraConfig
  /** Scratch vector holding the aim, reused across frames so the loop allocates nothing. */
  lookTarget: THREE.Vector3
  /** True while a cinematic path owns the camera, so every other case stands down. */
  pathOwnsCamera: boolean
  /**
   * Whether the follow rig drives at all.
   *
   * Off, this view writes nothing and the Camera element's own controls hold: a preset, a 45
   * degree rotation or a dragged coordinate survives instead of being overwritten next frame.
   */
  followEnabled: boolean
}

/**
 * Place and aim the camera for a single frame.
 *
 * The aim goes to `orbit.target` where orbit exists, because `orbit.update()` runs after the
 * timeline and re-aims the camera at that target regardless of any `lookAt` written here.
 * @param frame How to reach the camera, and everything needed to decide where it goes
 * @returns The camera that was written, or null if there was none to write
 */
export const applyCameraFrame = ({
  getCamera,
  orbit,
  selected,
  targetPosition,
  targetDirection,
  follow,
  lookTarget,
  pathOwnsCamera,
  followEnabled
}: CameraFrame): THREE.Camera | null => {
  const camera = getCamera()
  if (!camera) return null
  if (!followEnabled && !pathOwnsCamera) return null

  if (!pathOwnsCamera && isFollowCase(selected)) {
    const placement = followCameraPlacement(selected, targetPosition, targetDirection, follow)
    camera.position.copy(placement.position)
    lookTarget.copy(placement.lookAt)
  }

  if (orbit) orbit.target.copy(lookTarget)
  else camera.lookAt(lookTarget)

  return camera
}
