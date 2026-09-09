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

/** Midpoint between the wrist and the middle finger's knuckle, used as the flame anchor and
 * fireball spawn point: steadier than any single landmark as the hand turns. */
export const handPalmCenter = (landmarks: HandLandmarkPoint[]): HandLandmarkPoint => ({
  x: (landmarks[WRIST_INDEX].x + landmarks[MIDDLE_MCP_INDEX].x) / 2,
  y: (landmarks[WRIST_INDEX].y + landmarks[MIDDLE_MCP_INDEX].y) / 2
})

/** A point further along the wrist-to-knuckle axis than the palm centre, so the vector between
 * the two reads as the direction the hand is pointing. */
export const handPointingTarget = (landmarks: HandLandmarkPoint[]): HandLandmarkPoint =>
  landmarks[MIDDLE_MCP_INDEX]

export type GestureGrip = 'fist' | 'open' | 'neutral'

const classifyGrip = (openness: number, previousGrip: GestureGrip): GestureGrip => {
  if (openness < FIST_OPENNESS_THRESHOLD) return 'fist'
  if (openness > OPEN_OPENNESS_THRESHOLD) return 'open'
  return previousGrip
}

export interface GestureTracker {
  /** Feed one frame's openness reading; returns true exactly on the frame a fist finishes
   * opening, provided `cooldownMs` has elapsed since the last throw. Cooldown is read fresh
   * on every call so a live Config panel slider takes effect immediately. */
  update: (openness: number, nowMs: number, cooldownMs: number) => boolean
}

export const createGestureTracker = (): GestureTracker => {
  let grip: GestureGrip = 'neutral'
  let cooldownUntil = 0
  const update = (openness: number, nowMs: number, cooldownMs: number): boolean => {
    const previousGrip = grip
    grip = classifyGrip(openness, previousGrip)
    const threw = previousGrip === 'fist' && grip === 'open' && nowMs >= cooldownUntil
    if (threw) cooldownUntil = nowMs + cooldownMs
    return threw
  }
  return { update }
}

export const resolveHandSide = (categoryName: string): 'Left' | 'Right' | null => {
  if (categoryName === 'Left') return 'Left'
  if (categoryName === 'Right') return 'Right'
  return null
}
