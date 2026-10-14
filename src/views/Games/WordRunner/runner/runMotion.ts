import type { HintLevel } from '../types'

/**
 * Sideways position of a lane's centre, with the middle of the track at zero.
 * @param lane The lane.
 * @param laneCount How many lanes the track has.
 * @param laneWidth The width of one lane.
 * @returns The lane centre's offset.
 */
export const laneOffset = (lane: number, laneCount: number, laneWidth: number): number =>
  (lane - (laneCount - 1) / 2) * laneWidth

/**
 * The lane a ball sits in, from how far it is off the centreline: the nearest lane centre.
 * @param offset The ball's offset from the centreline.
 * @param laneCount How many lanes the track has.
 * @param laneWidth The width of one lane.
 * @returns The lane.
 */
export const laneAtOffset = (offset: number, laneCount: number, laneWidth: number): number =>
  Math.min(laneCount - 1, Math.max(0, Math.round(offset / laneWidth + (laneCount - 1) / 2)))

/**
 * One lane over in the given direction, staying on the track at either edge.
 * @param lane The current lane.
 * @param direction -1 for left, 1 for right.
 * @param laneCount How many lanes the track has.
 * @returns The new lane.
 */
export const stepLane = (lane: number, direction: number, laneCount: number): number =>
  Math.min(laneCount - 1, Math.max(0, lane + direction))

/**
 * The share of the remaining gap to close this frame. Exponential rather than a fixed
 * fraction, so the runner slides between lanes at the same pace at any frame rate.
 * @param rate How quickly the gap closes, per second.
 * @param deltaSeconds Seconds since the last frame.
 * @returns The share, from 0 to 1.
 */
export const smoothingFactor = (rate: number, deltaSeconds: number): number =>
  1 - Math.exp(-rate * deltaSeconds)

/**
 * The size of something springing into view, from nothing to full size over the given seconds,
 * overshooting on the way by an ease-out-back curve and settling exactly on one.
 * @param ageSeconds Seconds since it appeared.
 * @param seconds How long the spring takes.
 * @param spring How far it overshoots.
 * @returns The scale, 1 once settled.
 */
export const popScale = (ageSeconds: number, seconds: number, spring: number): number => {
  const progress = Math.min(1, Math.max(0, ageSeconds / seconds))
  const remaining = progress - 1
  return 1 + (spring + 1) * remaining ** 3 + spring * remaining ** 2
}

/**
 * How far along the run each gate of a lap stands.
 * @param lapStartDistance Where the lap starts.
 * @param gateCount How many gates it has.
 * @param leadInDistance Run-up before the first gate.
 * @param gateSpacing Distance between gates.
 * @returns Each gate's distance along the run.
 */
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
 * @param previousDistance The runner's distance last frame.
 * @param currentDistance Its distance now.
 * @param distances Where each gate stands.
 * @returns The indices of the gates crossed.
 */
export const crossedGateIndices = (
  previousDistance: number,
  currentDistance: number,
  distances: number[]
): number[] =>
  distances.flatMap((distance, gateIndex) =>
    previousDistance < distance && distance <= currentDistance ? [gateIndex] : []
  )

/**
 * Says whether a gate shows its hint at this distance: always at full help, only close up at late
 * help.
 * @param hint The gate's hint level.
 * @param distanceAhead How far ahead of the player the gate is.
 * @param lateHintDistance How close a late hint appears.
 * @returns True when the hint shows.
 */
export const isHintShown = (
  hint: HintLevel,
  distanceAhead: number,
  lateHintDistance: number
): boolean => hint === 'full' || (hint === 'late' && distanceAhead <= lateHintDistance)
