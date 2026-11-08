import { INSTRUMENT_ORGAN, INSTRUMENT_ORGAN_DRAWBARS, INSTRUMENT_SAMPLE_RATE } from './config'
import { applyBiquad, highpassCoefficients } from './biquad'
import { applyFades, finishStereo } from './finish'
import { blend, readKnob } from './knobs'
import { readNoteFrequency } from './notes'
import { createSeededRandom } from './pluckedString'
import { normalisePeak } from './signal'
import type { InstrumentKnobs, OrganDrawbar } from './types'

const NYQUIST_MARGIN = 0.45
const CLICK_HIGHPASS_HZ = 2000
const CLICK_DECAY_SHARE = 3
const CLICK_LEVEL = 0.5
const PERCUSSION_LEVEL = 0.8

const readDrawbarLevel = (drawbar: OrganDrawbar, knobs: InstrumentKnobs): number =>
  drawbar.weight * (drawbar.group === 'fixed' ? 1 : readKnob(knobs, drawbar.group))

const renderSine = (frequency: number, sampleCount: number): Float32Array =>
  Float32Array.from({ length: sampleCount }, (_, index) =>
    Math.sin((2 * Math.PI * frequency * index) / INSTRUMENT_SAMPLE_RATE)
  )

// Tonewheels are sine generators: the sound is the sum of the drawn footages.
const renderDrawbars = (
  frequency: number,
  sampleCount: number,
  knobs: InstrumentKnobs
): Float32Array => {
  const sum = new Float32Array(sampleCount)
  INSTRUMENT_ORGAN_DRAWBARS.filter(
    ({ ratio }) => frequency * ratio < INSTRUMENT_SAMPLE_RATE * NYQUIST_MARGIN
  ).forEach((drawbar) => {
    const level = readDrawbarLevel(drawbar, knobs)
    renderSine(frequency * drawbar.ratio, sampleCount).forEach((sample, index) => {
      sum[index] = (sum[index] ?? 0) + sample * level
    })
  })
  return sum
}

// Hammond percussion: a quick decaying third harmonic and a tick as the key closes its contact.
const renderPercussion = (
  frequency: number,
  sampleCount: number,
  percussion: number,
  seed: number
): Float32Array => {
  const random = createSeededRandom(seed)
  const harmonic = renderSine(frequency * INSTRUMENT_ORGAN.percussionRatio, sampleCount)
  const click = applyBiquad(
    Float32Array.from({ length: sampleCount }, () => random() * 2 - 1),
    highpassCoefficients(INSTRUMENT_SAMPLE_RATE, CLICK_HIGHPASS_HZ)
  )
  return Float32Array.from({ length: sampleCount }, (_, index) => {
    const seconds = index / INSTRUMENT_SAMPLE_RATE
    const harmonicLevel =
      PERCUSSION_LEVEL * Math.exp(-seconds / INSTRUMENT_ORGAN.percussionDecaySeconds)
    const clickLevel =
      CLICK_LEVEL * Math.exp(-seconds / (INSTRUMENT_ORGAN.clickSeconds / CLICK_DECAY_SHARE))
    return percussion * ((harmonic[index] ?? 0) * harmonicLevel + (click[index] ?? 0) * clickLevel)
  })
}

const applyOverdrive = (signal: Float32Array, drive: number): Float32Array => {
  const gain = 1 + drive * INSTRUMENT_ORGAN.driveMaxGain
  return normalisePeak(
    signal.map((sample) => Math.tanh(sample * gain)),
    1
  )
}

// A scanner vibrato is a delay line swept by a slow oscillator, mixed back with the dry sound.
const applyVibrato = (signal: Float32Array, depth: number, phase: number): Float32Array => {
  const depthSamples = depth * INSTRUMENT_ORGAN.vibratoMaxDepthSeconds * INSTRUMENT_SAMPLE_RATE
  return signal.map((sample, index) => {
    const delay =
      depthSamples *
      (1 +
        Math.sin(
          (2 * Math.PI * INSTRUMENT_ORGAN.vibratoRateHz * index) / INSTRUMENT_SAMPLE_RATE + phase
        ))
    const position = index - delay
    const lower = Math.floor(position)
    const fraction = position - lower
    const swept = blend(signal[lower] ?? 0, signal[lower + 1] ?? 0, fraction)
    return blend(sample, swept, INSTRUMENT_ORGAN.vibratoMix)
  })
}

/**
 * One organ note as stereo: nine sine drawbars at the tonewheel footages, a percussion tick and
 * harmonic, a soft overdrive and a vibrato whose sweep starts at a different point in each
 * channel. Faded to exact zero at both ends.
 * @param options - the note and length, the wanted peak, the knobs and a seed
 * @returns the left and right channels
 */
export const renderOrganSample = (options: {
  noteName: string
  durationSeconds: number
  peak: number
  knobs: InstrumentKnobs
  seed: number
}): Float32Array[] => {
  const { noteName, durationSeconds, peak, knobs, seed } = options
  const sampleCount = Math.round(INSTRUMENT_SAMPLE_RATE * durationSeconds)
  const frequency = readNoteFrequency(noteName)
  const drawn = renderDrawbars(frequency, sampleCount, knobs)
  const percussion = renderPercussion(frequency, sampleCount, readKnob(knobs, 'percussion'), seed)
  const played = applyOverdrive(
    normalisePeak(drawn, 1).map((sample, index) => sample + (percussion[index] ?? 0)),
    readKnob(knobs, 'drive')
  )
  const vibrato = readKnob(knobs, 'vibrato')
  const [left, right] = [0, INSTRUMENT_ORGAN.vibratoRightPhase].map((phase) =>
    applyFades(applyVibrato(played, vibrato, phase), INSTRUMENT_ORGAN.fadeInSeconds)
  )
  return finishStereo(left ?? new Float32Array(), right ?? new Float32Array(), { width: 1, peak })
}
