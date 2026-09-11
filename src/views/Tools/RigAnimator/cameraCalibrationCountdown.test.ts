import { describe, it, expect } from 'vitest'
import {
  createCalibrationCountdown,
  advanceCalibrationCountdown
} from './cameraCalibrationCountdown'

const DURATION_MS = 3000

describe('advanceCalibrationCountdown', () => {
  it('does not count down while the pose does not match', () => {
    const result = advanceCalibrationCountdown(
      createCalibrationCountdown(),
      false,
      1000,
      DURATION_MS
    )

    expect(result).toEqual({ state: { matchedSince: null }, remainingMs: null, complete: false })
  })

  it('starts the full countdown on the first matched frame', () => {
    const result = advanceCalibrationCountdown(
      createCalibrationCountdown(),
      true,
      1000,
      DURATION_MS
    )

    expect(result).toEqual({
      state: { matchedSince: 1000 },
      remainingMs: DURATION_MS,
      complete: false
    })
  })

  it('reports the time left while the match is held', () => {
    const result = advanceCalibrationCountdown({ matchedSince: 1000 }, true, 2200, DURATION_MS)

    expect(result).toEqual({ state: { matchedSince: 1000 }, remainingMs: 1800, complete: false })
  })

  it('completes once the match has been held for the whole duration', () => {
    const result = advanceCalibrationCountdown({ matchedSince: 1000 }, true, 4000, DURATION_MS)

    expect(result).toEqual({ state: { matchedSince: null }, remainingMs: 0, complete: true })
  })

  it('resets when the pose breaks, so matching again starts from the full duration', () => {
    const broken = advanceCalibrationCountdown({ matchedSince: 1000 }, false, 2500, DURATION_MS)

    const rematched = advanceCalibrationCountdown(broken.state, true, 2600, DURATION_MS)

    expect(broken.remainingMs).toBeNull()
    expect(rematched.remainingMs).toBe(DURATION_MS)
  })
})
