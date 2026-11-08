import type { InstrumentKnobs } from './types'

const NEUTRAL_KNOB = 0.5

/**
 * One knob's value, or the neutral middle when the preset lacks it.
 * @param knobs - a preset's knobs
 * @param knobId - such as `drive`
 * @returns the value from 0 to 1
 */
export const readKnob = (knobs: InstrumentKnobs, knobId: string): number =>
  knobs[knobId] ?? NEUTRAL_KNOB

/**
 * A point between two values.
 * @param start - the value at 0
 * @param end - the value at 1
 * @param amount - 0 to 1
 * @returns the blended value
 */
export const blend = (start: number, end: number, amount: number): number =>
  start + (end - start) * amount
