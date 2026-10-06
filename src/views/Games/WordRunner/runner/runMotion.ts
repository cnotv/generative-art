import type { HintLevel } from '../types'

/** Sideways position of a lane's centre, with the middle of the track at zero. */
export const laneOffset = (lane: number, laneCount: number, laneWidth: number): number =>
  (lane - (laneCount - 1) / 2) * laneWidth

/** One lane over in the given direction, staying on the track at either edge. */
export const stepLane = (lane: number, direction: number, laneCount: number): number =>
  Math.min(laneCount - 1, Math.max(0, lane + direction))

/**
 * The share of the remaining gap to close this frame. Exponential rather than a fixed
 * fraction, so the runner slides between lanes at the same pace at any frame rate.
 */
export const smoothingFactor = (rate: number, deltaSeconds: number): number =>
  1 - Math.exp(-rate * deltaSeconds)

/** How far along the run each gate of a lap stands. */
export const gateDistances = (
  lapStartDistance: number,
  gateCount: number,
  leadInDistance: number,
  gateSpacing: number
): number[] =>
  Array.from(
    { length: gateCount },
    (_, gateIndex) => lapStartDistance + leadInDistance + gateIndex * gateSpacing
  )

/**
 * The gates the runner went through between two frames. A gate counts the frame the runner
 * reaches it, so it is never counted twice and never skipped by a long frame.
 */
export const crossedGateIndices = (
  previousDistance: number,
  currentDistance: number,
  distances: number[]
): number[] =>
  distances.flatMap((distance, gateIndex) =>
    previousDistance < distance && distance <= currentDistance ? [gateIndex] : []
  )

export const isHintShown = (
  hint: HintLevel,
  distanceAhead: number,
  lateHintDistance: number
): boolean => hint === 'full' || (hint === 'late' && distanceAhead <= lateHintDistance)

/**
 * Forward speed while a stumble wears off: it starts at `stumbleSpeedRatio` of full speed and
 * climbs back linearly as `stumbleRemaining` runs out over `stumbleSeconds`.
 */
export const runSpeed = (
  baseSpeed: number,
  stumbleRemaining: number,
  stumbleSeconds: number,
  stumbleSpeedRatio: number
): number => {
  const stumbleShare = Math.min(1, Math.max(0, stumbleRemaining / stumbleSeconds))
  return baseSpeed * (1 - stumbleShare * (1 - stumbleSpeedRatio))
}
