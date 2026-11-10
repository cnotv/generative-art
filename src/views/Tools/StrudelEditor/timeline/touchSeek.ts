import type { ScreenPoint, TrackPointerReading } from '../types'

/**
 * The cycle under a point on the timeline, snapped to the seek step and kept on the track.
 * @param reading Where the pointer is and where the track sits on screen.
 * @returns The cycle to seek to.
 */
export const cycleAtClientX = ({
  clientX,
  trackLeft,
  trackWidth,
  timelineBars,
  seekStep
}: TrackPointerReading): number => {
  if (trackWidth <= 0) {
    return 0
  }
  const fraction = Math.min(Math.max((clientX - trackLeft) / trackWidth, 0), 1)
  return Math.round((fraction * timelineBars) / seekStep) * seekStep
}

/**
 * Whether a touch travelled far enough to be a swipe rather than a tap.
 * @param start Where the touch went down.
 * @param end Where it lifted.
 * @param slop The furthest a tap may wander, in pixels.
 * @returns True when it was a swipe.
 */
export const movedBeyondSlop = (start: ScreenPoint, end: ScreenPoint, slop: number): boolean =>
  Math.hypot(end.clientX - start.clientX, end.clientY - start.clientY) > slop
