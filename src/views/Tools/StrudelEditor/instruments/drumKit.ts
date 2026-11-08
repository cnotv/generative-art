import { applyBiquad, highpassCoefficients, lowpassCoefficients } from './biquad'
import { INSTRUMENT_DRUM, INSTRUMENT_DRUM_VOICES, INSTRUMENT_SAMPLE_RATE } from './config'
import { applyFades, finishStereo } from './finish'
import { readKnob } from './knobs'
import { createSeededRandom } from './pluckedString'
import { normalisePeak } from './signal'
import type { DrumMode, DrumNoise, InstrumentKnobs } from './types'

const DROP_BASE = 0.6
const DROP_PUNCH_SHARE = 0.8
const CLICK_HIGHPASS_HZ = 2000
const CLICK_DECAY_SHARE = 3
const CLICK_PUNCH_GAIN = 1.5
const DRUM_FADE_IN_SECONDS = 0.0005
const DRUM_FADE_OUT_SECONDS = 0.05

type DrumScales = { tuneScale: number; decayScale: number; punch: number }

const renderMode = (
  mode: DrumMode,
  sampleCount: number,
  scales: DrumScales,
  tunable: boolean
): Float32Array => {
  const baseHz = mode.frequencyHz * (tunable ? scales.tuneScale : 1)
  const dropRatio = 1 + (mode.dropRatio - 1) * (DROP_BASE + DROP_PUNCH_SHARE * scales.punch)
  const phase = { value: 0 }
  return Float32Array.from({ length: sampleCount }, (_, index) => {
    const seconds = index / INSTRUMENT_SAMPLE_RATE
    const frequency = baseHz * (1 + (dropRatio - 1) * Math.exp(-seconds / mode.dropSeconds))
    phase.value += (2 * Math.PI * frequency) / INSTRUMENT_SAMPLE_RATE
    return (
      mode.gain *
      Math.exp(-seconds / (mode.decaySeconds * scales.decayScale)) *
      Math.sin(phase.value)
    )
  })
}

const renderFilteredNoise = (
  noise: DrumNoise,
  sampleCount: number,
  decayScale: number,
  seed: number
): Float32Array => {
  const random = createSeededRandom(seed)
  const filtered = [
    highpassCoefficients(INSTRUMENT_SAMPLE_RATE, noise.highpassHz),
    lowpassCoefficients(INSTRUMENT_SAMPLE_RATE, noise.lowpassHz)
  ].reduce(
    applyBiquad,
    Float32Array.from({ length: sampleCount }, () => random() * 2 - 1)
  )
  return filtered.map(
    (sample, index) =>
      sample *
      noise.gain *
      Math.exp(-index / INSTRUMENT_SAMPLE_RATE / (noise.decaySeconds * decayScale))
  )
}

const renderClick = (
  clickGain: number,
  sampleCount: number,
  punch: number,
  seed: number
): Float32Array => {
  const random = createSeededRandom(seed)
  const burst = applyBiquad(
    Float32Array.from({ length: sampleCount }, () => random() * 2 - 1),
    highpassCoefficients(INSTRUMENT_SAMPLE_RATE, CLICK_HIGHPASS_HZ)
  )
  return burst.map(
    (sample, index) =>
      sample *
      clickGain *
      punch *
      CLICK_PUNCH_GAIN *
      Math.exp(-index / INSTRUMENT_SAMPLE_RATE / (INSTRUMENT_DRUM.clickSeconds / CLICK_DECAY_SHARE))
  )
}

const addInto = (target: Float32Array, source: Float32Array): void =>
  source.forEach((sample, index) => {
    target[index] = (target[index] ?? 0) + sample
  })

// A tiny room: four early reflections per side, darkened, at different delays for left and right.
const addRoom = (dry: Float32Array, room: number): Float32Array[] => {
  const darkened = applyBiquad(
    dry,
    lowpassCoefficients(INSTRUMENT_SAMPLE_RATE, INSTRUMENT_DRUM.roomLowpassHz)
  )
  const mix = room * INSTRUMENT_DRUM.roomMaxMix
  return [INSTRUMENT_DRUM.roomTapsSeconds.left, INSTRUMENT_DRUM.roomTapsSeconds.right].map(
    (taps) => {
      const side = new Float32Array(dry)
      taps.forEach((tapSeconds, tapIndex) => {
        const offset = Math.round(tapSeconds * INSTRUMENT_SAMPLE_RATE)
        const tapGain = (INSTRUMENT_DRUM.roomTapGains[tapIndex] ?? 0) * mix
        addInto(
          side,
          Float32Array.from(
            { length: dry.length },
            (_, index) => (darkened[index - offset] ?? 0) * tapGain
          )
        )
      })
      return side
    }
  )
}

const applyDrumDrive = (signal: Float32Array, drive: number): Float32Array => {
  const gain = 1 + drive * INSTRUMENT_DRUM.driveMaxGain
  return normalisePeak(
    normalisePeak(signal, 1).map((sample) => Math.tanh(sample * gain)),
    1
  )
}

/**
 * One drum as stereo. Modal synthesis: damped sines that start high and fall (the membrane), a
 * band of filtered noise (snare wires, cymbal shimmer), a click on the attack, then drive and a
 * few early reflections for the room. Cymbals use inharmonic partials so they do not ring as a note.
 * @param options - which drum, its length and peak, the knobs and a seed
 * @returns the left and right channels
 */
export const renderDrumSample = (options: {
  articulationId: string
  durationSeconds: number
  peak: number
  knobs: InstrumentKnobs
  seed: number
}): Float32Array[] => {
  const { articulationId, durationSeconds, peak, knobs, seed } = options
  const voice = INSTRUMENT_DRUM_VOICES[articulationId]
  if (voice === undefined) {
    throw new Error(`not a drum: "${articulationId}"`)
  }
  const sampleCount = Math.round(INSTRUMENT_SAMPLE_RATE * durationSeconds)
  const scales: DrumScales = {
    tuneScale: 2 ** ((readKnob(knobs, 'tune') - 0.5) * INSTRUMENT_DRUM.tuneOctaves),
    decayScale: 2 ** ((readKnob(knobs, 'decay') - 0.5) * INSTRUMENT_DRUM.decayOctaves),
    punch: readKnob(knobs, 'punch')
  }
  const dry = new Float32Array(sampleCount)
  voice.modes.forEach((mode) => addInto(dry, renderMode(mode, sampleCount, scales, voice.tunable)))
  if (voice.noise !== null) {
    addInto(
      dry,
      renderFilteredNoise(
        voice.noise,
        sampleCount,
        scales.decayScale,
        seed + INSTRUMENT_DRUM.noiseSeedOffset
      )
    )
  }
  addInto(dry, renderClick(voice.clickGain, sampleCount, scales.punch, seed))
  const driven = applyDrumDrive(dry, readKnob(knobs, 'drive'))
  const [left, right] = addRoom(driven, readKnob(knobs, 'room')).map((side) =>
    applyFades(side, DRUM_FADE_IN_SECONDS, DRUM_FADE_OUT_SECONDS)
  )
  return finishStereo(left ?? new Float32Array(), right ?? new Float32Array(), { width: 1, peak })
}
