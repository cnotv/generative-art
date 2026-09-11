import type { CalibrationCountdownAdvance, CalibrationCountdownState } from './types'

/**
 * A countdown that has not started.
 * @returns The idle state
 */
export const createCalibrationCountdown = (): CalibrationCountdownState => ({ matchedSince: null })

/**
 * Step the countdown for one frame. It only counts while the pose keeps matching: any unmatched
 * frame resets it, so a capture always comes from a pose held for the whole duration.
 * @param state The state after the previous frame
 * @param matched Whether this frame matches the pose
 * @param now This frame's timestamp, in milliseconds
 * @param durationMs How long the pose has to be held
 * @returns The next state, the time left (null while not counting) and whether it just completed
 */
export const advanceCalibrationCountdown = (
  state: CalibrationCountdownState,
  matched: boolean,
  now: number,
  durationMs: number
): CalibrationCountdownAdvance => {
  if (!matched) return { state: { matchedSince: null }, remainingMs: null, complete: false }
  const matchedSince = state.matchedSince ?? now
  const remainingMs = Math.max(0, durationMs - (now - matchedSince))
  if (remainingMs === 0) return { state: { matchedSince: null }, remainingMs: 0, complete: true }
  return { state: { matchedSince }, remainingMs, complete: false }
}
