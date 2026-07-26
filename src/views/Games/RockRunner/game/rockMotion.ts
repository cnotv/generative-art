import type { ControlsCurrents } from '@webgamekit/controls'
import type { TrackPath } from '../types'
import {
  BASE_MAX_SPEED,
  GROUND_PROBE_DISTANCE,
  MAX_SPEED_CEILING,
  SPEED_RAMP_DISTANCE
} from '../config'

// Above this rate of climb the rock is already leaving the ground, so a second
// jump would stack onto the first.
const RISING_VELOCITY = 0.5

type Vec2Like = { x: number; z: number }
type Vec3Like = { x: number; y: number; z: number }

/**
 * Re-projects the rock onto the path to find how far it has travelled.
 *
 * The rock is pushed along the path but drifts laterally as it steers, so its
 * world position alone does not give a distance. Projecting the offset from the
 * last known station onto the local tangent advances the cursor by exactly the
 * forward component, which converges in a step or two because the path is
 * smooth and the rock only moves a little each frame.
 *
 * @param path - The track being run
 * @param currentDistance - Last known distance
 * @param position - The rock's world position
 * @returns The updated distance, never negative
 */
export const advanceDistance = (
  path: TrackPath,
  currentDistance: number,
  position: Vec2Like
): number => {
  const sample = path.sampleAt(currentDistance)
  const along =
    (position.x - sample.position.x) * sample.forward.x +
    (position.z - sample.position.z) * sample.forward.z
  return Math.max(0, currentDistance + along)
}

/**
 * The forward speed cap at a given distance. It ramps from the starting cap up
 * to the ceiling so a long run keeps getting faster, then holds.
 *
 * @param distance - Distance travelled so far
 * @returns The maximum forward speed allowed
 */
export const speedCapAt = (distance: number): number =>
  BASE_MAX_SPEED +
  (MAX_SPEED_CEILING - BASE_MAX_SPEED) * Math.min(1, Math.max(0, distance) / SPEED_RAMP_DISTANCE)

/**
 * Which way the player is steering.
 *
 * @param currentActions - Actions currently held
 * @returns 1 for right, -1 for left, 0 for neither or both
 */
export const steerDirection = (currentActions: ControlsCurrents): number =>
  ('right' in currentActions ? 1 : 0) - ('left' in currentActions ? 1 : 0)

/**
 * The component of a velocity along a direction, used to cap forward and
 * lateral speed independently.
 *
 * @param velocity - The body's velocity
 * @param direction - A unit direction in the horizontal plane
 * @returns The signed speed along that direction
 */
export const speedAlong = (velocity: Vec3Like, direction: Vec2Like): number =>
  velocity.x * direction.x + velocity.z * direction.z

/**
 * Whether the rock is resting on the ground and may jump.
 *
 * Uses the path's own ground height rather than a physics ray: the deck is
 * generated from the same path, so its surface height is known exactly and
 * costs nothing to look up.
 *
 * @param rockY - The rock's centre height
 * @param groundY - The deck surface height beneath it
 * @param velocityY - The rock's vertical speed
 * @returns True when the rock is close enough to the deck and not already rising
 */
export const isGrounded = (rockY: number, groundY: number, velocityY: number): boolean =>
  rockY - groundY <= GROUND_PROBE_DISTANCE && velocityY <= RISING_VELOCITY

/**
 * Impulse that pushes the rock forward without exceeding the current cap.
 *
 * @param forwardSpeed - The rock's speed along the path tangent
 * @param cap - The current speed cap
 * @param impulse - The impulse magnitude when under the cap
 * @returns The magnitude to apply, zero once at the cap
 */
export const forwardImpulseMagnitude = (
  forwardSpeed: number,
  cap: number,
  impulse: number
): number => (forwardSpeed >= cap ? 0 : impulse)

/**
 * Impulse that steers the rock sideways without exceeding the lateral cap.
 *
 * @param steer - Steering direction from steerDirection
 * @param lateralSpeed - The rock's speed along the path's right vector
 * @param cap - The lateral speed cap
 * @param impulse - The impulse magnitude when under the cap
 * @returns The signed magnitude to apply along the right vector
 */
export const steerImpulseMagnitude = (
  steer: number,
  lateralSpeed: number,
  cap: number,
  impulse: number
): number => {
  if (steer === 0) return 0
  if (steer > 0 && lateralSpeed >= cap) return 0
  if (steer < 0 && lateralSpeed <= -cap) return 0
  return steer * impulse
}
