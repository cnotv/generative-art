import { applyBiquad, lowpassCoefficients, peakingCoefficients } from './biquad'
import {
  INSTRUMENT_ACOUSTIC_BODY,
  INSTRUMENT_ACOUSTIC_LOWPASS_HZ,
  INSTRUMENT_ACOUSTIC_SOFTENING,
  INSTRUMENT_ACOUSTIC_STRUM_SPACING,
  INSTRUMENT_BASS_CHAIN,
  INSTRUMENT_BASS_FIXED_LOW_END,
  INSTRUMENT_BASS_SOFTENING,
  INSTRUMENT_ELECTRIC_CHAIN,
  INSTRUMENT_ELECTRIC_SOFTENING,
  INSTRUMENT_SAMPLE_RATE,
  INSTRUMENT_SECOND_TAKE_SEED_OFFSET,
  INSTRUMENT_STRING_MODELS
} from './config'
import { applyFuzz } from './fuzz'
import { blend, readKnob } from './knobs'
import { applyFades, finishStereo } from './finish'
import { readNoteFrequency, readNoteMidi } from './notes'
import { renderPluckedString } from './pluckedString'
import { normalisePeak } from './signal'
import type { InstrumentKnobs, StringModel } from './types'

type StringKind = keyof typeof INSTRUMENT_STRING_MODELS

type TakeSettings = {
  softening: number
  strumSpacingSeconds: number
  decaySeconds: number
}

const CENTS_PER_OCTAVE = 1200
const SEMITONES_PER_OCTAVE = 12

const readTakeSettings = (
  kind: StringKind,
  model: StringModel,
  knobs: InstrumentKnobs
): TakeSettings => {
  const decaySeconds = blend(
    model.minDecaySeconds,
    model.maxDecaySeconds,
    readKnob(knobs, 'sustain')
  )
  if (kind === 'bass-guitar') {
    const softening = blend(
      INSTRUMENT_BASS_SOFTENING.finger,
      INSTRUMENT_BASS_SOFTENING.pick,
      readKnob(knobs, 'attack')
    )
    return { softening, strumSpacingSeconds: 0, decaySeconds }
  }
  if (kind === 'acoustic-guitar') {
    return {
      softening: blend(
        INSTRUMENT_ACOUSTIC_SOFTENING.dull,
        INSTRUMENT_ACOUSTIC_SOFTENING.bright,
        readKnob(knobs, 'brightness')
      ),
      strumSpacingSeconds: blend(
        INSTRUMENT_ACOUSTIC_STRUM_SPACING.fast,
        INSTRUMENT_ACOUSTIC_STRUM_SPACING.slow,
        readKnob(knobs, 'strum')
      ),
      decaySeconds
    }
  }
  return {
    softening: INSTRUMENT_ELECTRIC_SOFTENING,
    strumSpacingSeconds: model.strumSpacingSeconds,
    decaySeconds
  }
}

// The strings are summed here, before any fuzz: how they intermodulate in the clipper is the sound.
const renderDryVoice = (options: {
  model: StringModel
  settings: TakeSettings
  noteName: string
  articulationId: string
  durationSeconds: number
  seed: number
  detuneCents: number
}): Float32Array => {
  const { model, settings, noteName, articulationId, durationSeconds, seed, detuneCents } = options
  const sampleRate = INSTRUMENT_SAMPLE_RATE
  const detune = 2 ** (detuneCents / CENTS_PER_OCTAVE)
  const semitones = articulationId === 'note' ? [0] : model.chordSemitones
  const dry = new Float32Array(Math.round(sampleRate * durationSeconds))
  semitones.forEach((semitone, stringIndex) => {
    const startSample = Math.round(stringIndex * settings.strumSpacingSeconds * sampleRate)
    renderPluckedString({
      frequency: readNoteFrequency(noteName) * detune * 2 ** (semitone / SEMITONES_PER_OCTAVE),
      sampleRate,
      durationSeconds,
      decaySeconds: settings.decaySeconds,
      seed: seed + stringIndex,
      palmMuted: articulationId === 'mute',
      softening: settings.softening,
      pickPosition: model.pickPosition,
      mutedDecaySeconds: model.mutedDecaySeconds,
      mutedLowpassHz: model.mutedLowpassHz
    }).forEach((sample, index) => {
      if (index + startSample < dry.length) {
        dry[index + startSample] = (dry[index + startSample] ?? 0) + sample
      }
    })
  })
  return dry
}

// A flat-topped box: three wooden resonances, then the strings' age as a lowpass.
const applyAcousticBody = (signal: Float32Array, knobs: InstrumentKnobs): Float32Array => {
  const body = readKnob(knobs, 'body')
  const brightHz = blend(
    INSTRUMENT_ACOUSTIC_LOWPASS_HZ.dull,
    INSTRUMENT_ACOUSTIC_LOWPASS_HZ.bright,
    readKnob(knobs, 'brightness')
  )
  return [
    ...INSTRUMENT_ACOUSTIC_BODY.map(({ centreHz, maxDecibels, quality }) =>
      peakingCoefficients(INSTRUMENT_SAMPLE_RATE, centreHz, maxDecibels * body, quality)
    ),
    lowpassCoefficients(INSTRUMENT_SAMPLE_RATE, brightHz)
  ].reduce(applyBiquad, signal)
}

const shapeTake = (kind: StringKind, dry: Float32Array, knobs: InstrumentKnobs): Float32Array => {
  if (kind === 'acoustic-guitar') {
    return normalisePeak(applyAcousticBody(dry, knobs), 1)
  }
  const chain = kind === 'bass-guitar' ? INSTRUMENT_BASS_CHAIN : INSTRUMENT_ELECTRIC_CHAIN
  const lowEnd = kind === 'bass-guitar' ? INSTRUMENT_BASS_FIXED_LOW_END : readKnob(knobs, 'bass')
  return applyFuzz(
    dry,
    {
      drive: readKnob(knobs, 'drive'),
      bass: lowEnd,
      mids: readKnob(knobs, 'mids'),
      tone: readKnob(knobs, 'tone')
    },
    chain,
    INSTRUMENT_SAMPLE_RATE
  )
}

// A rhythm guitar is double tracked hard left and right; a bass stays in the centre.
const readStereoWidth = (kind: StringKind, knobs: InstrumentKnobs): number => {
  if (kind === 'bass-guitar') {
    return 0
  }
  return kind === 'acoustic-guitar' ? readKnob(knobs, 'width') : 1
}

/**
 * One string instrument sound as stereo. Two takes with different noise and a few cents of
 * tuning apart are shaped (fuzz and cabinet, or the acoustic's body), faded to exact zero at
 * both ends and scaled so the louder channel reaches the articulation's peak.
 * @param options - the kind, the articulation, its note and length, the knobs and a seed
 * @returns the left and right channels
 */
export const renderStringSample = (options: {
  kind: StringKind
  articulationId: string
  noteName: string
  durationSeconds: number
  peak: number
  knobs: InstrumentKnobs
  seed: number
}): Float32Array[] => {
  const { kind, articulationId, noteName, durationSeconds, peak, knobs, seed } = options
  const model = INSTRUMENT_STRING_MODELS[kind]
  const settings = readTakeSettings(kind, model, knobs)
  const [first, second] = [
    { seed, detuneCents: model.takeDetuneCents },
    { seed: seed + INSTRUMENT_SECOND_TAKE_SEED_OFFSET, detuneCents: -model.takeDetuneCents }
  ].map((take) =>
    applyFades(
      shapeTake(
        kind,
        renderDryVoice({
          model,
          settings,
          noteName,
          articulationId,
          durationSeconds,
          seed: take.seed,
          detuneCents: take.detuneCents
        }),
        knobs
      )
    )
  )
  return finishStereo(first ?? new Float32Array(), second ?? new Float32Array(), {
    width: readStereoWidth(kind, knobs),
    peak
  })
}

/**
 * The seed a sampled note is rendered with, so every note is its own pluck.
 * @param noteName - such as `c2`
 * @returns a seed for the noise burst
 */
export const readNoteSeed = (noteName: string): number => readNoteMidi(noteName) * 7
