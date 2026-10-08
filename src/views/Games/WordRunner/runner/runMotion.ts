import type { HintLevel } from '../types'

/** Sideways position of a lane's centre, with the middle of the track at zero. */
export const laneOffset = (lane: number, laneCount: number, laneWidth: number): number =>
  (lane - (laneCount - 1) / 2) * laneWidth

/** The lane a ball sits in, from how far it is off the centreline: the nearest lane centre. */
export const laneAtOffset = (offset: number, laneCount: number, laneWidth: number): number =>
  Math.min(laneCount - 1, Math.max(0, Math.round(offset / laneWidth + (laneCount - 1) / 2)))

/** One lane over in the given direction, staying on the track at either edge. */
export const stepLane = (lane: number, direction: number, laneCount: number): number =>
  Math.min(laneCount - 1, Math.max(0, lane + direction))

/**
 * The share of the remaining gap to close this frame. Exponential rather than a fixed
 * fraction, so the runner slides between lanes at the same pace at any frame rate.
 */
export const smoothingFactor = (rate: number, deltaSeconds: number): number =>
  1 - Math.exp(-rate * deltaSeconds)

/**
 * The size of something springing into view, from nothing to full size over the given seconds,
 * overshooting on the way by an ease-out-back curve and settling exactly on one.
 */
export const popScale = (ageSeconds: number, seconds: number, spring: number): number => {
  const progress = Math.min(1, Math.max(0, ageSeconds / seconds))
  const remaining = progress - 1
  return 1 + (spring + 1) * remaining ** 3 + spring * remaining ** 2
}

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
