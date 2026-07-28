import type { ControlsCurrents } from '@webgamekit/controls'
import type { TrackPath } from '../types'

// Above this rate of climb the rock is already leaving the ground, so a second
// jump would stack onto the first.
const RISING_VELOCITY = 0.5

// Impulses are tuned as though every frame lasted this long; a long frame after
// a stall is clamped so the rock cannot be catapulted by it.
const REFERENCE_FPS = 60
const MAX_FRAME_SECONDS = 1 / 20

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
export const speedCapAt = (
  distance: number,
  baseSpeed: number,
  ceiling: number,
  rampDistance: number
): number =>
  baseSpeed + (ceiling - baseSpeed) * Math.min(1, Math.max(0, distance) / Math.max(1, rampDistance))

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
export const isGrounded = (
  rockY: number,
  groundY: number,
  velocityY: number,
  probeDistance: number
): boolean => rockY - groundY <= probeDistance && velocityY <= RISING_VELOCITY

/**
 * How many chips to throw at a given speed.
 *
 * Scaled against the speed cap rather than a fixed figure, so the spray still
 * grows over a run as the cap itself ramps up.
 *
 * The response is squared. Scaled linearly, even a rock barely moving still
 * rounded up to a chip on every tick — and the tick is fast, so "the smallest
 * possible spray" was still fifty chips a second. Squaring holds it at nothing
 * until the rock is genuinely moving, then ramps hard.
 *
 * @param speed - The rock's horizontal speed
 * @param cap - The current speed cap
 * @param maxBurst - Chips thrown at the cap
 * @param minBurst - Chips thrown while barely moving
 * @returns A whole number of chips
 */
export const debrisBurstSize = (
  speed: number,
  cap: number,
  maxBurst: number,
  minBurst: number
): number => {
  if (cap <= 0) return minBurst
  const fraction = Math.min(1, Math.max(0, speed) / cap)
  return Math.max(minBurst, Math.round(maxBurst * fraction * fraction))
}

/**
 * How long a chip lives, and so how far back the trail reaches.
 *
 * A trail is only as long as its chips survive, so tying life to speed makes
 * the rock leave a short scuff when it is crawling and a long plume when it is
 * flying. The ramp is linear rather than squared like the burst count: the
 * count wants to sit at zero until the rock is really moving, whereas a trail
 * that collapses to nothing at half speed reads as the effect breaking.
 *
 * @param speed - Current ground speed
 * @param cap - Speed at which the trail reaches its full length
 * @param maxLifetime - Seconds a chip lives at the cap
 * @param minLifetime - Seconds a chip lives at a standstill
 * @returns Seconds the chip should live
 */
export const debrisLifetime = (
  speed: number,
  cap: number,
  maxLifetime: number,
  minLifetime: number
): number => {
  if (cap <= 0) return minLifetime
  const fraction = Math.min(1, Math.max(0, speed) / cap)
  return minLifetime + (maxLifetime - minLifetime) * fraction
}

/**
 * Scales a per-frame impulse so acceleration does not depend on frame rate.
 *
 * An impulse applied once per frame is momentum per frame, not per second: the
 * same tuning accelerates twice as hard at 120fps as at 60, and crawls on a
 * machine that drops frames. Scaling by the frame's own duration against a
 * reference rate keeps the tuned numbers meaningful and the handling identical
 * everywhere.
 *
 * @param magnitude - Impulse tuned for the reference frame rate
 * @param delta - Seconds the frame covered
 * @returns The impulse to actually apply this frame
 */
export const frameScaledImpulse = (magnitude: number, delta: number): number =>
  magnitude * Math.min(delta, MAX_FRAME_SECONDS) * REFERENCE_FPS

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
