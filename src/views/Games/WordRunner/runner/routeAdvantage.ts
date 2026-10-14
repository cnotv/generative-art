import { ROUTE_EFFECTS } from '../config'
import type { ActiveEffect, LaneOutcome, RouteFeature, RoutePiece } from '../types'

/**
 * How fast the heading turns, in radians per unit of track, across a stretch of it.
 * @param yawAt The track's heading at a distance.
 * @param fromDistance Start of the stretch.
 * @param toDistance End of the stretch.
 * @returns The turn rate.
 */
export const yawRateBetween = (
  yawAt: (distance: number) => number,
  fromDistance: number,
  toDistance: number
): number => (yawAt(toDistance) - yawAt(fromDistance)) / (toDistance - fromDistance)

/**
 * The lane on the inside of the bend a gate opens onto, or null on a straight. A positive
 * turn rate turns left, so the inside is the leftmost lane.
 * @param yawRate The turn rate after the gate.
 * @param threshold The rate below which the track counts as straight.
 * @param laneCount How many lanes the track has.
 * @returns The inside lane, or null.
 */
export const insideLaneFor = (
  yawRate: number,
  threshold: number,
  laneCount: number
): number | null => {
  if (Math.abs(yawRate) < threshold) return null
  return yawRate > 0 ? 0 : laneCount - 1
}

/**
 * The advantage a gate's right lane gives. A bend is used only when the right word already
 * sits on its inside line; otherwise ramps and rocks alternate along the text, so a word
 * meets the same feature on every attempt.
 * @param position The gate's place in the text.
 * @param correctLane The lane of the right word.
 * @param insideLane The inside lane of the bend, or null.
 * @returns The route feature.
 */
export const chooseRouteFeature = (
  position: number,
  correctLane: number,
  insideLane: number | null
): RouteFeature => {
  if (insideLane === correctLane) return 'bend'
  return position % 2 === 0 ? 'ramp' : 'rocks'
}

const OUTCOMES: Record<RouteFeature, { right: LaneOutcome; wrong: LaneOutcome }> = {
  ramp: { right: 'boost', wrong: 'miss' },
  rocks: { right: 'none', wrong: 'stumble' },
  bend: { right: 'none', wrong: 'wide' }
}

const PIECES: Record<RouteFeature, { right: RoutePiece | null; wrong: RoutePiece | null }> = {
  ramp: { right: 'ramp', wrong: 'gravel' },
  rocks: { right: null, wrong: 'rock' },
  bend: { right: null, wrong: 'gravel' }
}

/**
 * The piece of route that appears in the lane a ball took, once its word is picked and not
 * before: the ramp that launches it, or the rock or gravel that slows it. Nothing for a lane
 * that changes nothing.
 * @param feature The gate's route feature.
 * @param lane The lane the ball took.
 * @param correctLane The lane of the right word.
 * @returns The piece to reveal, or null.
 */
export const revealedPiece = (
  feature: RouteFeature,
  lane: number,
  correctLane: number
): RoutePiece | null => PIECES[feature][lane === correctLane ? 'right' : 'wrong']

/**
 * What a lane does to a ball, given the gate's feature and whether it is the right word's lane.
 * @param feature The gate's route feature.
 * @param lane The lane the ball took.
 * @param correctLane The lane of the right word.
 * @returns The outcome.
 */
export const laneOutcome = (
  feature: RouteFeature,
  lane: number,
  correctLane: number
): LaneOutcome => OUTCOMES[feature][lane === correctLane ? 'right' : 'wrong']

/**
 * Starts the speed change an outcome causes.
 * @param outcome The lane's outcome.
 * @returns The effect, or null for none.
 */
export const startEffect = (outcome: LaneOutcome): ActiveEffect | null =>
  outcome === 'none' ? null : { outcome, remaining: ROUTE_EFFECTS[outcome].seconds }

/**
 * Wears an effect down by one frame.
 * @param effect The active effect, if any.
 * @param deltaSeconds Seconds since the last frame.
 * @returns The effect with less time left, or null once it ends.
 */
export const tickEffect = (
  effect: ActiveEffect | null,
  deltaSeconds: number
): ActiveEffect | null => {
  if (!effect) return null
  const remaining = effect.remaining - deltaSeconds
  return remaining > 0 ? { ...effect, remaining } : null
}

/**
 * The share of full speed an effect leaves the runner at, easing linearly back to one.
 * @param effect The active effect, if any.
 * @returns The speed ratio.
 */
export const effectSpeedRatio = (effect: ActiveEffect | null): number => {
  if (!effect) return 1
  const { ratio, seconds } = ROUTE_EFFECTS[effect.outcome]
  return 1 + (ratio - 1) * Math.min(1, effect.remaining / seconds)
}

/**
 * The inside lane of the stretch after each gate: from the gate to the end of its route
 * feature, where a bend would be run. Null where that stretch is close enough to straight.
 * @param yawAt The track's heading at a distance.
 * @param gateDistances Where each gate stands.
 * @param stretchLength How far past the gate the stretch runs.
 * @param threshold The turn rate below which a stretch counts as straight.
 * @param laneCount How many lanes the track has.
 * @returns The inside lane after each gate, or null.
 */
export const insideLanesAlong = (
  yawAt: (distance: number) => number,
  gateDistances: number[],
  stretchLength: number,
  threshold: number,
  laneCount: number
): Array<number | null> =>
  gateDistances.map((from) =>
    insideLaneFor(yawRateBetween(yawAt, from, from + stretchLength), threshold, laneCount)
  )
