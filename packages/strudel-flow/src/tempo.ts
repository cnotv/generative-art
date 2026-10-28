import {
  STRUDEL_FLOW_BEATS_PER_CYCLE_OPTIONS,
  STRUDEL_FLOW_DEFAULT_BEATS_PER_CYCLE,
  STRUDEL_FLOW_DEFAULT_BEATS_PER_MINUTE,
  STRUDEL_FLOW_MAX_BEATS_PER_MINUTE,
  STRUDEL_FLOW_MIN_BEATS_PER_MINUTE
} from './config'

/**
 * Keeps a tempo inside the range the flow control and the compiler accept.
 * @param beatsPerMinute - the tempo to use, possibly out of range or not a number
 * @returns the nearest whole beat per minute, or the default when the value is not finite
 */
export const normalizeStrudelFlowBeatsPerMinute = (beatsPerMinute: number): number => {
  if (!Number.isFinite(beatsPerMinute)) {
    return STRUDEL_FLOW_DEFAULT_BEATS_PER_MINUTE
  }
  return Math.min(
    STRUDEL_FLOW_MAX_BEATS_PER_MINUTE,
    Math.max(STRUDEL_FLOW_MIN_BEATS_PER_MINUTE, Math.round(beatsPerMinute))
  )
}

/**
 * Keeps the beats in one cycle to a value the B/C picker offers.
 * @param beatsPerCycle - the requested beats per cycle
 * @returns that value, or the default when the picker has no such option
 */
export const normalizeStrudelFlowBeatsPerCycle = (beatsPerCycle: number): number =>
  STRUDEL_FLOW_BEATS_PER_CYCLE_OPTIONS.some((option) => Number(option.value) === beatsPerCycle)
    ? beatsPerCycle
    : STRUDEL_FLOW_DEFAULT_BEATS_PER_CYCLE
