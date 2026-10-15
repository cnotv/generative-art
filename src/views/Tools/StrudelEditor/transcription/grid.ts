import { SECONDS_PER_MINUTE, STEPS_PER_BEAT } from '../config'
import type { TempoEstimate } from '../types'

export type StepHit = {
  stepIndex: number
  onsetSeconds: number
}

/**
 * Length of one sixteenth-note step.
 * @param beatsPerMinute - tempo
 * @returns step length in seconds
 */
export const stepDurationSeconds = (beatsPerMinute: number): number =>
  SECONDS_PER_MINUTE / beatsPerMinute / STEPS_PER_BEAT

/**
 * When a step starts, counted from the first beat.
 * @param stepIndex - sixteenth-note step number
 * @param tempo - tempo and beat phase
 * @returns start time in seconds
 */
export const stepStartSeconds = (stepIndex: number, tempo: TempoEstimate): number =>
  tempo.phaseSeconds + stepIndex * stepDurationSeconds(tempo.beatsPerMinute)

/**
 * Snaps onset times to the nearest sixteenth-note step, keeping the first onset of each
 * step and dropping any before the first beat.
 * @param onsetTimes - onset times in seconds, in order
 * @param tempo - tempo and beat phase
 * @returns one hit per occupied step, in order
 */
export const quantizeToSteps = (onsetTimes: number[], tempo: TempoEstimate): StepHit[] =>
  onsetTimes
    .map((onsetSeconds) => ({
      // Adding zero turns the -0 that Math.round gives just before the phase into 0.
      stepIndex:
        Math.round(
          (onsetSeconds - tempo.phaseSeconds) / stepDurationSeconds(tempo.beatsPerMinute)
        ) + 0,
      onsetSeconds
    }))
    .filter((stepHit) => stepHit.stepIndex >= 0)
    .filter(
      (stepHit, hitIndex, allHits) =>
        hitIndex === 0 || allHits[hitIndex - 1].stepIndex !== stepHit.stepIndex
    )
