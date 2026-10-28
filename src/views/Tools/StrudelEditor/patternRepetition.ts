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

const repeatsEvery = (haps: StrudelScheduledHap[], repetitionsPerCycle: number): boolean => {
  const sliceLength = 1 / repetitionsPerCycle
  const firstSlice = describeSlice(haps, 0, sliceLength)
  return Array.from({ length: repetitionsPerCycle - 1 }, (_, index) => index + 1).every(
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
  ).find((candidate) => repeatsEvery(haps, candidate))
  return repetitionsPerCycle === undefined ? 1 : 1 / repetitionsPerCycle
}
