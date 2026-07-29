import type { ControlsCurrents } from '@webgamekit/controls'
import type { JumpGate, TrackPath } from '../types'
import { WALL_INSET } from '../config'

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
  probeDistance: number,
  risingTolerance: number
): boolean => rockY - groundY <= probeDistance && velocityY <= risingTolerance

/**
 * Whether the rock is actually resting on the deck.
 *
 * Deliberately a much tighter test than `isGrounded`. That one is generous so a
 * jump lands when a player expects it to; this one decides where the falling
 * gravity stops applying, so it has to mean resting rather than merely close.
 *
 * @param rockY - The rock's centre height
 * @param groundY - The deck surface height beneath it
 * @param radius - The rock's radius, which is its resting height above the deck
 * @param slack - How far above resting still counts as touching
 * @returns True only while the rock is sitting on the ground
 */
export const isResting = (rockY: number, groundY: number, radius: number, slack: number): boolean =>
  rockY - groundY <= radius + slack

/**
 * Advances the jump timers by one frame.
 *
 * Two graces make a press land when a player expects it to rather than only on
 * the exact frames the rock is touching down. A press is remembered for a short
 * while, so pressing slightly early fires on landing instead of being swallowed;
 * and the rock still counts as grounded for a moment after leaving the deck,
 * which matters here because cresting a hill lifts it off for a few frames at a
 * time and a strict check reads that as being airborne.
 *
 * @param gate - The timers as they stand
 * @param delta - Seconds elapsed
 * @param input - This frame's press, ground contact, and the two grace windows
 * @returns The advanced timers
 */
export const advanceJumpGate = (
  gate: JumpGate,
  delta: number,
  input: { pressed: boolean; grounded: boolean; bufferSeconds: number; coyoteSeconds: number }
): JumpGate => ({
  buffer: input.pressed ? input.bufferSeconds : Math.max(0, gate.buffer - delta),
  coyote: input.grounded ? input.coyoteSeconds : Math.max(0, gate.coyote - delta),
  cooldown: Math.max(0, gate.cooldown - delta)
})

/**
 * Whether a jump should fire this frame.
 *
 * @param gate - The advanced timers
 * @returns True when a remembered press meets ground the rock still has
 */
export const jumpReady = (gate: JumpGate): boolean =>
  gate.buffer > 0 && gate.coyote > 0 && gate.cooldown <= 0

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

/** What stops the rock steering further: its own speed, and the wall beside it. */
export type SteerLimits = {
  lateralSpeed: number
  speedCap: number
  offset: number
  standoff: number
}

/**
 * Impulse that steers the rock sideways without exceeding the lateral cap or
 * driving it into a wall.
 *
 * @param steer - Steering direction from steerDirection
 * @param impulse - The impulse magnitude when under both limits
 * @param limits - The speed and position the steering has to stop at
 * @returns The signed magnitude to apply along the right vector
 */
export const steerImpulseMagnitude = (
  steer: number,
  impulse: number,
  limits: SteerLimits
): number => {
  if (steer === 0) return 0
  const { lateralSpeed, speedCap, offset, standoff } = limits
  if (steer > 0 && (lateralSpeed >= speedCap || offset >= standoff)) return 0
  if (steer < 0 && (lateralSpeed <= -speedCap || offset <= -standoff)) return 0
  return steer * impulse
}

/**
 * How far off the centreline the rock can sit before it is touching a wall.
 *
 * @param deckWidth - Width of the deck the walls flank
 * @param radius - The rock's radius
 * @returns The offset at which the rock is already against the wall
 */
export const wallStandoff = (deckWidth: number, radius: number): number =>
  Math.max(0, deckWidth / 2 + WALL_INSET - radius)

/**
 * The rock's offset from the centreline, positive towards the path's right.
 *
 * @param position - The rock's world position
 * @param origin - The centreline point it is measured against
 * @param right - The path's right vector there
 * @returns Signed distance from the centreline
 */
export const lateralOffset = (
  position: { x: number; z: number },
  origin: { x: number; z: number },
  right: { x: number; z: number }
): number => (position.x - origin.x) * right.x + (position.z - origin.z) * right.z
