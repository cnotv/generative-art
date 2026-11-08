import {
  applyBiquad,
  highpassCoefficients,
  lowShelfCoefficients,
  lowpassCoefficients,
  peakingCoefficients
} from './biquad'
import { normalisePeak, scaleSignal } from './signal'
import type { StonerGuitarTone } from './types'

const INPUT_HIGHPASS_HZ = 40
const BASS_SHELF_HZ = 200
const BASS_SHELF_MAX_DECIBELS = 12
const DRIVE_MIN_DECIBELS = -6
const DRIVE_RANGE_DECIBELS = 42
const FIRST_STAGE_BIAS = 0.2
const INTERSTAGE_LOWPASS_HZ = 6000
const INTERSTAGE_COUPLING_HZ = 30
const SECOND_STAGE_GAIN = 4
const MIDS_CENTRE_HZ = 700
const MIDS_MIN_DECIBELS = -10
const MIDS_RANGE_DECIBELS = 16
const TREBLE_MIN_HZ = 1800
const TREBLE_MAX_HZ = 7000
const CABINET_HIGHPASS_HZ = 80
const CABINET_THUMP_HZ = 110
const CABINET_THUMP_DECIBELS = 4
const CABINET_LOWPASS_HZ = [5000, 6500]

const upsampleTwice = (signal: Float32Array): Float32Array =>
  Float32Array.from({ length: signal.length * 2 }, (_, index) => {
    const current = signal[index >> 1] ?? 0
    return index % 2 === 0 ? current : (current + (signal[(index >> 1) + 1] ?? current)) / 2
  })

const decimateByTwo = (signal: Float32Array): Float32Array =>
  Float32Array.from({ length: signal.length >> 1 }, (_, index) => signal[index * 2] ?? 0)

const softClipAsymmetric = (signal: Float32Array): Float32Array =>
  signal.map((sample) => Math.tanh(sample + FIRST_STAGE_BIAS) - Math.tanh(FIRST_STAGE_BIAS))

const softClipSymmetric = (signal: Float32Array): Float32Array =>
  signal.map((sample) => Math.tanh(sample))

// Both clipping stages run at twice the rate so their harmonics fold back less as hiss.
const clipTwoStages = (signal: Float32Array, drive: number, sampleRate: number): Float32Array => {
  const fastRate = sampleRate * 2
  const driveGain = 10 ** ((DRIVE_MIN_DECIBELS + drive * DRIVE_RANGE_DECIBELS) / 20)
  const antiImage = lowpassCoefficients(fastRate, sampleRate * 0.45)
  const stageOne = softClipAsymmetric(
    scaleSignal(applyBiquad(upsampleTwice(signal), antiImage), driveGain)
  )
  const coupled = applyBiquad(
    applyBiquad(stageOne, lowpassCoefficients(fastRate, INTERSTAGE_LOWPASS_HZ)),
    highpassCoefficients(fastRate, INTERSTAGE_COUPLING_HZ)
  )
  const stageTwo = softClipSymmetric(scaleSignal(coupled, SECOND_STAGE_GAIN))
  return decimateByTwo(applyBiquad(stageTwo, antiImage))
}

const applyToneStack = (
  signal: Float32Array,
  tone: StonerGuitarTone,
  sampleRate: number
): Float32Array => {
  const midsDecibels = MIDS_MIN_DECIBELS + tone.mids * MIDS_RANGE_DECIBELS
  const trebleHz = TREBLE_MIN_HZ * (TREBLE_MAX_HZ / TREBLE_MIN_HZ) ** tone.tone
  return applyBiquad(
    applyBiquad(signal, peakingCoefficients(sampleRate, MIDS_CENTRE_HZ, midsDecibels)),
    lowpassCoefficients(sampleRate, trebleHz)
  )
}

// A closed back 4x12: a thump near 110 Hz and a steep roll off where the speakers give up.
const applyCabinet = (signal: Float32Array, sampleRate: number): Float32Array =>
  [
    highpassCoefficients(sampleRate, CABINET_HIGHPASS_HZ),
    peakingCoefficients(sampleRate, CABINET_THUMP_HZ, CABINET_THUMP_DECIBELS),
    ...CABINET_LOWPASS_HZ.map((cornerHz) => lowpassCoefficients(sampleRate, cornerHz))
  ].reduce(applyBiquad, signal)

/**
 * A Big Muff style fuzz and a closed back cabinet: low end boosted ahead of two clipping stages,
 * then a mid and treble tone stack and the speaker's roll off. The result peaks at exactly 1,
 * or stays silent if the input was.
 * @param signal - the dry guitar, mono
 * @param tone - the five knobs
 * @param sampleRate - samples per second
 * @returns the fuzzed and cabinet filtered signal as a new buffer
 */
export const applyFuzz = (
  signal: Float32Array,
  tone: StonerGuitarTone,
  sampleRate: number
): Float32Array => {
  const woolly = applyBiquad(
    applyBiquad(signal, highpassCoefficients(sampleRate, INPUT_HIGHPASS_HZ)),
    lowShelfCoefficients(sampleRate, BASS_SHELF_HZ, tone.bass * BASS_SHELF_MAX_DECIBELS)
  )
  const clipped = clipTwoStages(normalisePeak(woolly, 1), tone.drive, sampleRate)
  return normalisePeak(applyCabinet(applyToneStack(clipped, tone, sampleRate), sampleRate), 1)
}
