import {
  FIST_OPENNESS_THRESHOLD,
  OPEN_OPENNESS_THRESHOLD,
  FINGER_EXTENDED_THRESHOLD,
  OPEN_GRIP_DELAY_MS
} from '../config'

export interface HandLandmarkPoint {
  x: number
  y: number
}

const WRIST_INDEX = 0
const MIDDLE_MCP_INDEX = 9
const FINGER_TIP_INDICES = [8, 12, 16, 20] as const
const FINGER_MCP_INDICES = [5, 9, 13, 17] as const

const distance = (a: HandLandmarkPoint, b: HandLandmarkPoint): number =>
  Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Average, across the four non-thumb fingers, of how far the fingertip sits from the wrist
 * relative to that finger's own knuckle: a curled fist sits at or below 1, a spread-open hand
 * well above it, and the ratio stays scale-invariant across hand size and camera distance.
 */
export const handOpenness = (landmarks: HandLandmarkPoint[]): number => {
  const wrist = landmarks[WRIST_INDEX]
  const ratios = FINGER_TIP_INDICES.map(
    (tipIndex, fingerIndex) =>
      distance(landmarks[tipIndex], wrist) /
      distance(landmarks[FINGER_MCP_INDICES[fingerIndex]], wrist)
  )
  return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length
}

/** Midpoint between the wrist and the middle finger's knuckle, used as the grip point an item
 * anchors to: steadier than any single landmark as the hand turns. */
export const handPalmCenter = (landmarks: HandLandmarkPoint[]): HandLandmarkPoint => ({
  x: (landmarks[WRIST_INDEX].x + landmarks[MIDDLE_MCP_INDEX].x) / 2,
  y: (landmarks[WRIST_INDEX].y + landmarks[MIDDLE_MCP_INDEX].y) / 2
})

/** A point further along the wrist-to-knuckle axis than the palm centre, so the vector between
 * the two gives the direction a gripped item should point. */
export const handForwardTarget = (landmarks: HandLandmarkPoint[]): HandLandmarkPoint =>
  landmarks[MIDDLE_MCP_INDEX]

/** Wrist-to-middle-knuckle distance in the same normalized image space `handOpenness` reads
 * from: shrinks as the hand moves away from the camera, grows as it comes closer, so a held
 * item's world scale can track how big the hand currently looks rather than staying fixed. */
export const handSpan = (landmarks: HandLandmarkPoint[]): number =>
  distance(landmarks[WRIST_INDEX], landmarks[MIDDLE_MCP_INDEX])

/** How many of the four non-thumb fingers are held out straight, the same way a person counts
 * on their fingers: each one at or above `FINGER_EXTENDED_THRESHOLD` on its own tip-to-wrist
 * over knuckle-to-wrist ratio, independent of the others. */
export const countExtendedFingers = (landmarks: HandLandmarkPoint[]): number => {
  const wrist = landmarks[WRIST_INDEX]
  return FINGER_TIP_INDICES.filter((tipIndex, fingerIndex) => {
    const ratio =
      distance(landmarks[tipIndex], wrist) /
      distance(landmarks[FINGER_MCP_INDICES[fingerIndex]], wrist)
    return ratio > FINGER_EXTENDED_THRESHOLD
  }).length
}

export type GestureGrip = 'fist' | 'open'

const classifyGrip = (openness: number, previousGrip: GestureGrip): GestureGrip => {
  if (openness < FIST_OPENNESS_THRESHOLD) return 'fist'
  if (openness > OPEN_OPENNESS_THRESHOLD) return 'open'
  return previousGrip
}

export interface GripTracker {
  /** Feed one frame's openness reading and timestamp; returns the hand's current grip, with
   * hysteresis between the two thresholds so noise near either edge does not flicker the
   * state, and a further delay before a fist commits to opening (see `createGripTracker`). */
  update: (openness: number, nowMs: number) => GestureGrip
}

/**
 * A closed fist only actually opens once the raw reading has held "open" continuously for
 * `OPEN_GRIP_DELAY_MS`: a fast swing that blurs a fingertip past the open threshold for a
 * single frame recovers before the item drops, rather than reading as letting go. Grabbing
 * (open to fist) has no such delay, since a late grab feels unresponsive in a way a
 * momentarily-late drop does not.
 */
export const createGripTracker = (): GripTracker => {
  let grip: GestureGrip = 'open'
  let openSinceMs: number | null = null
  const update = (openness: number, nowMs: number): GestureGrip => {
    const rawGrip = classifyGrip(openness, grip)
    if (grip === 'fist' && rawGrip === 'open') {
      if (openSinceMs === null) openSinceMs = nowMs
      if (nowMs - openSinceMs < OPEN_GRIP_DELAY_MS) return grip
      grip = 'open'
      openSinceMs = null
      return grip
    }
    openSinceMs = null
    grip = rawGrip
    return grip
  }
  return { update }
}

export const resolveHandSide = (categoryName: string): 'Left' | 'Right' | null => {
  if (categoryName === 'Left') return 'Left'
  if (categoryName === 'Right') return 'Right'
  return null
}
