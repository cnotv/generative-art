import { ROUTE_EFFECTS } from '../config'
import type { ActiveEffect, LaneOutcome, RouteFeature } from '../types'

/**
 * The lane on the inside of the bend a gate opens onto, or null on a straight. A positive
 * turn rate turns left, so the inside is the leftmost lane.
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
 * sits on its inside line; otherwise ramps and rocks alternate along the phrase, so the same
 * word meets the same feature on every lap the lanes stay put.
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
  ramp: { right: 'boost', wrong: 'none' },
  rocks: { right: 'none', wrong: 'stumble' },
  bend: { right: 'none', wrong: 'wide' }
}

export const laneOutcome = (
  feature: RouteFeature,
  lane: number,
  correctLane: number
): LaneOutcome => OUTCOMES[feature][lane === correctLane ? 'right' : 'wrong']

export const startEffect = (outcome: LaneOutcome): ActiveEffect | null =>
  outcome === 'none' ? null : { outcome, remaining: ROUTE_EFFECTS[outcome].seconds }

export const tickEffect = (
  effect: ActiveEffect | null,
  deltaSeconds: number
): ActiveEffect | null => {
  if (!effect) return null
  const remaining = effect.remaining - deltaSeconds
  return remaining > 0 ? { ...effect, remaining } : null
}

/** The share of full speed an effect leaves the runner at, easing linearly back to one. */
export const effectSpeedRatio = (effect: ActiveEffect | null): number => {
  if (!effect) return 1
  const { ratio, seconds } = ROUTE_EFFECTS[effect.outcome]
  return 1 + (ratio - 1) * Math.min(1, effect.remaining / seconds)
}
