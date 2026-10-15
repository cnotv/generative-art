import {
  SECONDS_PER_MINUTE,
  STEPS_PER_BEAT,
  TEMPO_MAX_BPM,
  TEMPO_MIN_BPM,
  TEMPO_PRIOR_CENTER_BPM,
  TEMPO_PRIOR_WIDTH_OCTAVES
} from '../config'
import type { TempoEstimate } from '../types'

const GAUSSIAN_EXPONENT_SCALE = -0.5

type CombScore = {
  score: number
  phaseFrames: number
}

/**
 * Onset strength summed over the frames either side of a beat. A click can split its
 * flux across two frames, differently on each beat, and reading a single frame let a
 * comb at half the tempo win by landing only on the cleanly aligned clicks.
 * @param envelope - onset strength per frame
 * @param position - fractional frame of the beat
 * @returns the summed strength around the beat
 */
const envelopeNear = (envelope: Float64Array, position: number): number => {
  const centerFrame = Math.round(position)
  return (envelope[centerFrame - 1] ?? 0) + envelope[centerFrame] + (envelope[centerFrame + 1] ?? 0)
}

const combScoreAtPhase = (envelope: Float64Array, periodFrames: number, phase: number): number => {
  const beatCount = Math.floor((envelope.length - 1 - phase) / periodFrames) + 1
  const beatSum = Array.from({ length: beatCount }, (_, beatIndex) =>
    envelopeNear(envelope, phase + beatIndex * periodFrames)
  ).reduce((sum, value) => sum + value, 0)
  return beatSum / beatCount
}

const bestPhaseFor = (envelope: Float64Array, periodFrames: number): CombScore =>
  Array.from({ length: Math.floor(periodFrames) }, (_, phase) => phase).reduce<CombScore>(
    (best, phase) => {
      const score = combScoreAtPhase(envelope, periodFrames, phase)
      return score > best.score ? { score, phaseFrames: phase } : best
    },
    { score: 0, phaseFrames: 0 }
  )

/**
 * Log-normal preference for tempos near the prior centre, scaled by the square root of
 * the tempo. A comb at half the true tempo hits every onset it touches just as well, so
 * the square root tips the tie towards the faster reading, while a comb at double the
 * tempo misses half its teeth and still loses.
 * @param beatsPerMinute - candidate tempo
 * @returns the weight multiplied into the candidate's comb score
 */
const tempoWeight = (beatsPerMinute: number): number => {
  const octavesFromCenter = Math.log2(beatsPerMinute / TEMPO_PRIOR_CENTER_BPM)
  const prior = Math.exp(
    GAUSSIAN_EXPONENT_SCALE * (octavesFromCenter / TEMPO_PRIOR_WIDTH_OCTAVES) ** 2
  )
  return prior * Math.sqrt(beatsPerMinute / TEMPO_PRIOR_CENTER_BPM)
}

/**
 * A beat found just short of a full period is really the one at time zero, missed by
 * frame rounding. Leaving it there makes the first beat the second one, and the whole
 * first bar is lost before the grid starts.
 * @param phaseSeconds - first beat found by the comb
 * @param beatSeconds - beat length
 * @returns the phase, moved back one beat when it sits just short of a full one
 */
const wrapPhaseToNearestBeat = (phaseSeconds: number, beatSeconds: number): number =>
  beatSeconds - phaseSeconds < beatSeconds / STEPS_PER_BEAT / 2
    ? phaseSeconds - beatSeconds
    : phaseSeconds

/**
 * Whole-number tempo and beat phase that best line a comb of beats up with the onset
 * envelope.
 * @param envelope - onset strength per frame
 * @param framesPerSecond - frame rate of the envelope
 * @returns the tempo, and when the first beat falls; the prior tempo for silence
 */
export const estimateTempo = (envelope: Float64Array, framesPerSecond: number): TempoEstimate => {
  const candidates = Array.from(
    { length: TEMPO_MAX_BPM - TEMPO_MIN_BPM + 1 },
    (_, index) => TEMPO_MIN_BPM + index
  )
  const ranked = candidates.map((beatsPerMinute) => {
    const comb = bestPhaseFor(envelope, (framesPerSecond * SECONDS_PER_MINUTE) / beatsPerMinute)
    return { beatsPerMinute, comb, weighted: comb.score * tempoWeight(beatsPerMinute) }
  })
  const best = ranked.reduce((winner, candidate) =>
    candidate.weighted > winner.weighted ? candidate : winner
  )
  if (best.comb.score === 0) {
    return { beatsPerMinute: TEMPO_PRIOR_CENTER_BPM, phaseSeconds: 0 }
  }
  return {
    beatsPerMinute: best.beatsPerMinute,
    phaseSeconds: wrapPhaseToNearestBeat(
      best.comb.phaseFrames / framesPerSecond,
      SECONDS_PER_MINUTE / best.beatsPerMinute
    )
  }
}
