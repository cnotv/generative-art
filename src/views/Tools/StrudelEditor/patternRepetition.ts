import { STRUDEL_MAX_REPETITIONS_PER_CYCLE } from './config'
import type { StrudelScheduledHap } from './types'

// Fractions of a cycle are exact in Strudel but arrive here as floats.
const CYCLE_PRECISION = 1e6

const roundCycle = (cycle: number): number => Math.round(cycle * CYCLE_PRECISION) / CYCLE_PRECISION

const describeHap = (hap: StrudelScheduledHap, offsetCycles: number): string =>
  JSON.stringify([
    roundCycle(hap.beginCycle - offsetCycles),
    roundCycle(hap.durationCycles),
    hap.value
  ])

const describeSlice = (
  haps: StrudelScheduledHap[],
  sliceStart: number,
  sliceLength: number
): string =>
  haps
    .filter(
      (hap) =>
        roundCycle(hap.beginCycle) >= roundCycle(sliceStart) &&
        roundCycle(hap.beginCycle) < roundCycle(sliceStart + sliceLength)
    )
    .map((hap) => describeHap(hap, sliceStart))
    .sort()
    .join('|')

const sliceRepeats = (
  haps: StrudelScheduledHap[],
  sliceLength: number,
  sliceCount: number
): boolean => {
  const firstSlice = describeSlice(haps, 0, sliceLength)
  return Array.from({ length: sliceCount - 1 }, (_, index) => index + 1).every(
    (sliceIndex) => describeSlice(haps, sliceIndex * sliceLength, sliceLength) === firstSlice
  )
}

/**
 * How long one repetition of a pattern is, so a sound such as `.fast(2)` on a coin exports once
 * rather than twice. Looks for the shortest equal slice of the first cycle that the rest of it
 * repeats exactly; a pattern that does not repeat inside a cycle is one cycle long.
 * @param haps - the events of the pattern's first cycle
 * @returns the length of one repetition, in cycles
 */
export const findRepetitionCycles = (haps: StrudelScheduledHap[]): number => {
  if (haps.length === 0) {
    return 1
  }
  const repetitionsPerCycle = Array.from(
    { length: STRUDEL_MAX_REPETITIONS_PER_CYCLE - 1 },
    (_, index) => STRUDEL_MAX_REPETITIONS_PER_CYCLE - index
  ).find((candidate) => sliceRepeats(haps, 1 / candidate, candidate))
  return repetitionsPerCycle === undefined ? 1 : 1 / repetitionsPerCycle
}

/**
 * How many bars the whole mix takes to come round again, for the timeline. Instruments that
 * repeat at different lengths, such as three bars under four, only line up again at their
 * least common multiple, so that is the loop: the shortest whole number of bars every
 * instrument repeats in at once.
 * @param haps - the events of the first `maxBars * 2` bars, so every candidate is seen twice
 * @param maxBars - the longest loop to look for
 * @returns the loop length in bars, or null when nothing repeats within `maxBars`
 */
export const findLoopBars = (haps: StrudelScheduledHap[], maxBars: number): number | null => {
  const queriedBars = maxBars * 2
  return (
    Array.from({ length: maxBars }, (_, index) => index + 1).find((candidateBars) =>
      sliceRepeats(haps, candidateBars, Math.floor(queriedBars / candidateBars))
    ) ?? null
  )
}
