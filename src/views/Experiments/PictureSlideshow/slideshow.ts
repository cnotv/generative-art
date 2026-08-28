import type { CanvasRole, SlideshowFrame, SlideshowTiming } from './types'

/**
 * Smoothstep, so an arm starts and stops moving rather than snapping into and
 * out of full speed at the ends of a phase.
 * @param progress - How far through the phase, from 0 to 1
 * @returns The eased position, still from 0 to 1
 */
const ease = (progress: number): number => progress * progress * (3 - 2 * progress)

/**
 * Reads the whole cycle at one instant: which picture is where, and how far
 * through its own phase the change is.
 *
 * Cycle n holds picture n, releases it, and lifts picture n + 1 into its place,
 * so the lift's own picture is already the one the next hold carries. The
 * waiting picture is deliberately the one after whatever is currently held,
 * which means the moment the lift starts — the moment the lifted picture is
 * still sitting exactly on the waiting spot — its successor takes that spot
 * behind it and is uncovered by the lift itself, rather than appearing out of
 * nothing in open view.
 * @param elapsedSeconds - Seconds since the slideshow started
 * @param timing - How long each phase lasts
 * @param slideCount - How many pictures the slideshow cycles through
 * @returns Every index and progress the scene needs for this frame
 */
export const slideshowFrameAt = (
  elapsedSeconds: number,
  timing: SlideshowTiming,
  slideCount: number
): SlideshowFrame => {
  const cycleLength = timing.hold + timing.drop + timing.lift
  const cycle = Math.floor(elapsedSeconds / cycleLength)
  const cycleTime = elapsedSeconds - cycle * cycleLength
  const slideAt = (offset: number): number => (cycle + offset) % slideCount
  const fallSeconds = Math.max(cycleTime - timing.hold, 0)

  if (cycleTime < timing.hold) {
    return {
      phase: 'hold',
      phaseProgress: cycleTime / timing.hold,
      heldIndex: slideAt(0),
      waitingIndex: slideAt(1),
      fallingIndex: null,
      fallSeconds: 0
    }
  }

  if (cycleTime < timing.hold + timing.drop) {
    return {
      phase: 'drop',
      phaseProgress: (cycleTime - timing.hold) / timing.drop,
      heldIndex: null,
      waitingIndex: slideAt(1),
      fallingIndex: slideAt(0),
      fallSeconds
    }
  }

  return {
    phase: 'lift',
    phaseProgress: (cycleTime - timing.hold - timing.drop) / timing.lift,
    heldIndex: slideAt(1),
    waitingIndex: slideAt(2),
    fallingIndex: slideAt(0),
    fallSeconds
  }
}

/**
 * How raised the arms are, from 0 down at the floor to 1 up at the display height.
 *
 * The held picture reads the same scalar, which is what keeps it in the hands
 * through the whole lift instead of being animated alongside them and drifting.
 * @param frame - The current frame
 * @returns The eased raise amount, from 0 to 1
 */
export const liftAmountAt = ({ phase, phaseProgress }: SlideshowFrame): number => {
  if (phase === 'hold') return 1
  if (phase === 'drop') return 1 - ease(phaseProgress)
  return ease(phaseProgress)
}

/**
 * How far a released picture has fallen.
 * @param fallSeconds - Seconds since it was let go
 * @param gravity - Downward acceleration, in scene units per second squared
 * @returns The distance fallen, always positive
 */
export const fallDropAt = (fallSeconds: number, gravity: number): number =>
  0.5 * gravity * fallSeconds * fallSeconds

/**
 * How far a released picture has turned end over end.
 * @param fallSeconds - Seconds since it was let go
 * @param spinRate - Radians per second
 * @returns The angle turned, in radians
 */
export const fallTumbleAt = (fallSeconds: number, spinRate: number): number =>
  fallSeconds * spinRate

/**
 * What one picture is doing this frame, so the scene can place it or hide it.
 * @param frame - The current frame
 * @param slideIndex - The picture being asked about
 * @returns Its role, or 'hidden' when it has none
 */
export const canvasRoleAt = (frame: SlideshowFrame, slideIndex: number): CanvasRole => {
  if (slideIndex === frame.heldIndex) return 'held'
  if (slideIndex === frame.waitingIndex) return 'waiting'
  if (slideIndex === frame.fallingIndex) return 'falling'
  return 'hidden'
}
