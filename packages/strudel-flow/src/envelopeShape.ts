import type { StrudelFlowEnvelopeData } from './types'

export type EnvelopePoint = { x: number; y: number }

const SUSTAIN_HOLD_SHARE = 0.25
const MINIMUM_HOLD = 0.1

/**
 * Corner points of an ADSR (attack, decay, sustain, release) curve in a 0..1 box, y up.
 * The sustain plateau has no length in the data, so it takes a share of the other stages
 * and the four stages always fill the full width.
 * @param envelope - the four ADSR values
 * @returns five corner points from silence, through peak and sustain, back to silence
 */
export const getEnvelopePoints = (
  envelope: Pick<StrudelFlowEnvelopeData, 'attack' | 'decay' | 'sustain' | 'release'>
): EnvelopePoint[] => {
  const { attack, decay, sustain, release } = envelope
  const stagesTotal = attack + decay + release
  const hold = Math.max(stagesTotal * SUSTAIN_HOLD_SHARE, MINIMUM_HOLD)
  const total = stagesTotal + hold
  const attackEnd = attack / total
  const decayEnd = (attack + decay) / total
  const holdEnd = (attack + decay + hold) / total
  return [
    { x: 0, y: 0 },
    { x: attackEnd, y: 1 },
    { x: decayEnd, y: sustain },
    { x: holdEnd, y: sustain },
    { x: 1, y: 0 }
  ]
}
