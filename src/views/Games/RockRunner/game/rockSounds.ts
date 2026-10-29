import {
  BUMP_FULL_SPEED_LOSS,
  BUMP_MIN_SPEED_LOSS,
  FALL_FULL_SPEED,
  FALL_MIN_SPEED,
  ROLL_MIN_SPEED
} from '../config'
import type { MotionFrame, RockImpact } from '../types'

const strengthBetween = (value: number, minimum: number, full: number): number =>
  Math.min(1, Math.max(0, (value - minimum) / (full - minimum)))

/**
 * Reads a landing or a bump from two consecutive frames, so no physics contact queue is needed.
 * A landing wins over a bump: touching down also sheds speed, and one hit should sound once.
 * @param previous The frame before.
 * @param current The frame now.
 * @returns The impact, or null when nothing worth a sound happened.
 */
export const detectImpact = (previous: MotionFrame, current: MotionFrame): RockImpact | null => {
  const fallSpeed = -previous.verticalSpeed
  if (!previous.grounded && current.grounded && fallSpeed >= FALL_MIN_SPEED) {
    return { kind: 'fall', strength: strengthBetween(fallSpeed, FALL_MIN_SPEED, FALL_FULL_SPEED) }
  }
  const speedLoss = previous.horizontalSpeed - current.horizontalSpeed
  if (current.grounded && speedLoss >= BUMP_MIN_SPEED_LOSS) {
    return {
      kind: 'bump',
      strength: strengthBetween(speedLoss, BUMP_MIN_SPEED_LOSS, BUMP_FULL_SPEED_LOSS)
    }
  }
  return null
}

/**
 * How loud the rolling rumble is: silent in the air or at rest, louder the faster it goes.
 * @param frame The rock this frame.
 * @param speedCap The speed at which the rumble is at full level.
 * @returns A level from 0 to 1.
 */
export const rollingLevel = (frame: MotionFrame, speedCap: number): number =>
  frame.grounded && frame.horizontalSpeed >= ROLL_MIN_SPEED
    ? Math.min(1, frame.horizontalSpeed / speedCap)
    : 0
