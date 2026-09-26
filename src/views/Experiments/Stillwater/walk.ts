/**
 * Advance along the walk loop, wrapping back to the start once the far end is passed.
 *
 * The overshoot is carried across the wrap rather than dropped, so the walker keeps its pace
 * through the seam instead of losing whatever fraction of a frame's travel sat past the end.
 * @param position Where the walker is on the loop axis
 * @param distance How far it travels this frame
 * @param start Where the loop begins
 * @param end Where the loop ends, beyond which it returns to the start
 * @returns The new position on the loop axis
 */
export const advanceWalk = (
  position: number,
  distance: number,
  start: number,
  end: number
): number => {
  const span = end - start
  const travelled = position + distance
  if (span <= 0 || travelled <= end) return travelled
  return start + ((travelled - start) % span)
}
