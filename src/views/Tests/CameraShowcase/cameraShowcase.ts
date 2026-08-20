import type { CoordinateTuple } from '@webgamekit/animation'
import type { FollowCameraMode } from '@webgamekit/threejs'
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
 * Whether a case places the camera once on selection rather than every frame.
 * @param value The selected case
 * @returns True for the one-shot placements
 */
export const isPlacementCase = (value: CameraCase): boolean => value === 'side'

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
