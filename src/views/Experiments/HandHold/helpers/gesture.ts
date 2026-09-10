import { FIST_OPENNESS_THRESHOLD, OPEN_OPENNESS_THRESHOLD } from '../config'

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

export type GestureGrip = 'fist' | 'open'

const classifyGrip = (openness: number, previousGrip: GestureGrip): GestureGrip => {
  if (openness < FIST_OPENNESS_THRESHOLD) return 'fist'
  if (openness > OPEN_OPENNESS_THRESHOLD) return 'open'
  return previousGrip
}

export interface GripTracker {
  /** Feed one frame's openness reading; returns the hand's current grip, with hysteresis
   * between the two thresholds so noise near either edge does not flicker the state. */
  update: (openness: number) => GestureGrip
}

export const createGripTracker = (): GripTracker => {
  let grip: GestureGrip = 'open'
  const update = (openness: number): GestureGrip => {
    grip = classifyGrip(openness, grip)
    return grip
  }
  return { update }
}

export const resolveHandSide = (categoryName: string): 'Left' | 'Right' | null => {
  if (categoryName === 'Left') return 'Left'
  if (categoryName === 'Right') return 'Right'
  return null
}
