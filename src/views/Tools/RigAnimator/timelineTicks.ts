/** Roughly how many ticks the ruler should show, whatever the frame range happens to be. */
const TARGET_TICK_COUNT = 15

/** Interval sizes to pick from, in order, so ticks land on round frame numbers. */
const NICE_INTERVALS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]

/**
 * Pick a tick interval that keeps the ruler readable at any frame range: the smallest round
 * number from `NICE_INTERVALS` that still keeps the tick count near `TARGET_TICK_COUNT`.
 * @param frameMax The rig timeline's visible frame range
 * @returns The frame interval between ticks
 */
export const computeTickInterval = (frameMax: number): number =>
  NICE_INTERVALS.find((interval) => frameMax / interval <= TARGET_TICK_COUNT) ??
  NICE_INTERVALS[NICE_INTERVALS.length - 1]

/**
 * Build the ruler's tick frames: every multiple of the computed interval from 0 up to and
 * including `frameMax`.
 * @param frameMax The rig timeline's visible frame range
 * @returns The frames to mark on the ruler, ascending
 */
export const computeTimelineTicks = (frameMax: number): number[] => {
  if (frameMax <= 0) return [0]
  const interval = computeTickInterval(frameMax)
  const ticks = Array.from(
    { length: Math.floor(frameMax / interval) + 1 },
    (_, index) => index * interval
  )
  return ticks[ticks.length - 1] === frameMax ? ticks : [...ticks, frameMax]
}
