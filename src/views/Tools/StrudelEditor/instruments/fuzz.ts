import {
  applyBiquad,
  highpassCoefficients,
  lowShelfCoefficients,
  lowpassCoefficients,
  peakingCoefficients
} from './biquad'
import { normalisePeak, scaleSignal } from './signal'
import type { FuzzChain, FuzzControls } from './types'

const upsampleTwice = (signal: Float32Array): Float32Array =>
  Float32Array.from({ length: signal.length * 2 }, (_, index) => {
    const current = signal[index >> 1] ?? 0
    return index % 2 === 0 ? current : (current + (signal[(index >> 1) + 1] ?? current)) / 2
  })

const decimateByTwo = (signal: Float32Array): Float32Array =>
  Float32Array.from({ length: signal.length >> 1 }, (_, index) => signal[index * 2] ?? 0)

const softClipAsymmetric = (signal: Float32Array, bias: number): Float32Array =>
  signal.map((sample) => Math.tanh(sample + bias) - Math.tanh(bias))

const softClipSymmetric = (signal: Float32Array): Float32Array =>
  signal.map((sample) => Math.tanh(sample))

// Both clipping stages run at twice the rate so their harmonics fold back less as hiss.
const clipTwoStages = (
  signal: Float32Array,
  drive: number,
  chain: FuzzChain,
  sampleRate: number
): Float32Array => {
  const fastRate = sampleRate * 2
  const driveGain = 10 ** ((chain.driveMinDecibels + drive * chain.driveRangeDecibels) / 20)
  const antiImage = lowpassCoefficients(fastRate, sampleRate * 0.45)
  const stageOne = softClipAsymmetric(
    scaleSignal(applyBiquad(upsampleTwice(signal), antiImage), driveGain),
    chain.firstStageBias
  )
  const coupled = applyBiquad(
    applyBiquad(stageOne, lowpassCoefficients(fastRate, 6000)),
    highpassCoefficients(fastRate, 30)
  )
  const stageTwo = softClipSymmetric(scaleSignal(coupled, chain.secondStageGain))
  return decimateByTwo(applyBiquad(stageTwo, antiImage))
}

const applyToneStack = (
  signal: Float32Array,
  controls: FuzzControls,
  chain: FuzzChain,
  sampleRate: number
): Float32Array => {
  const midsDecibels = chain.midsMinDecibels + controls.mids * chain.midsRangeDecibels
  const trebleHz = chain.trebleMinHz * (chain.trebleMaxHz / chain.trebleMinHz) ** controls.tone
  return applyBiquad(
    applyBiquad(signal, peakingCoefficients(sampleRate, chain.midsCentreHz, midsDecibels)),
    lowpassCoefficients(sampleRate, trebleHz)
  )
}

// A closed back cabinet: a thump near its resonance and a steep roll off where the speakers give up.
const applyCabinet = (signal: Float32Array, chain: FuzzChain, sampleRate: number): Float32Array =>
  [
    highpassCoefficients(sampleRate, chain.cabinetHighpassHz),
    peakingCoefficients(sampleRate, chain.cabinetThumpHz, chain.cabinetThumpDecibels),
    ...chain.cabinetLowpassHz.map((cornerHz) => lowpassCoefficients(sampleRate, cornerHz))
  ].reduce(applyBiquad, signal)

/**
 * A Big Muff style fuzz and a closed back cabinet: low end boosted ahead of two clipping stages,
 * then a mid and treble tone stack and the speaker's roll off. Drive at 0 stays near linear, so
 * the same chain gives a clean guitar. The result peaks at exactly 1, or stays silent if the
 * input was.
 * @param signal - the dry instrument, mono
 * @param controls - drive, low end, mids and treble, each 0 to 1
 * @param chain - the constants of the amplifier and cabinet
 * @param sampleRate - samples per second
 * @returns the fuzzed and cabinet filtered signal as a new buffer
 */
export const applyFuzz = (
  signal: Float32Array,
  controls: FuzzControls,
  chain: FuzzChain,
  sampleRate: number
): Float32Array => {
  const woolly = applyBiquad(
    applyBiquad(signal, highpassCoefficients(sampleRate, chain.inputHighpassHz)),
    lowShelfCoefficients(sampleRate, chain.bassShelfHz, controls.bass * chain.bassShelfMaxDecibels)
  )
  const clipped = clipTwoStages(normalisePeak(woolly, 1), controls.drive, chain, sampleRate)
  return normalisePeak(
    applyCabinet(applyToneStack(clipped, controls, chain, sampleRate), chain, sampleRate),
    1
  )
}
