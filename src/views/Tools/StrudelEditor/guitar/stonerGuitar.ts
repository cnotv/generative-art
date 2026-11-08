import {
  STONER_GUITAR_DURATION_SECONDS,
  STONER_GUITAR_FADE_IN_SECONDS,
  STONER_GUITAR_FADE_OUT_SECONDS,
  STONER_GUITAR_MAX_DECAY_SECONDS,
  STONER_GUITAR_MIN_DECAY_SECONDS,
  STONER_GUITAR_NOTES,
  STONER_GUITAR_PEAK,
  STONER_GUITAR_SAMPLE_RATE,
  STONER_GUITAR_SOUND_NAMES,
  STONER_GUITAR_STRUM_SPACING_SECONDS,
  STONER_GUITAR_TAKE_DETUNE_CENTS
} from './config'
import { applyFuzz } from './fuzz'
import { renderPluckedString } from './pluckedString'
import { readPeak, scaleSignal } from './signal'
import type {
  StonerGuitarArticulation,
  StonerGuitarBankEntry,
  StonerGuitarSound,
  StonerGuitarTone
} from './types'

const ARTICULATIONS: StonerGuitarArticulation[] = ['chord', 'mute', 'note']
const NOTE_PATTERN = /^([a-g])([#bs]?)(\d+)$/
const SEMITONES_BY_LETTER: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
const FIFTH_SEMITONES = 7
const SEMITONES_PER_OCTAVE = 12
const CENTS_PER_SEMITONE = 100
const A4_MIDI = 69
const A4_HZ = 440
const SECOND_TAKE_SEED_OFFSET = 1000

/**
 * The note's number as superdough counts it, where c4 is 60; `s` and `#` sharpen, `b` flattens.
 * @param noteName - such as `c2` or `ds3`
 * @returns the midi note number
 */
export const readNoteMidi = (noteName: string): number => {
  const match = NOTE_PATTERN.exec(noteName)
  if (match === null) {
    throw new Error(`not a note name: "${noteName}"`)
  }
  const [, letter = 'c', accidental = '', octave = '0'] = match
  const shift = accidental === 'b' ? -1 : accidental === '' ? 0 : 1
  return (Number(octave) + 1) * SEMITONES_PER_OCTAVE + (SEMITONES_BY_LETTER[letter] ?? 0) + shift
}

/**
 * The note's pitch in Hz, tuned to A4 = 440.
 * @param noteName - such as `c2`
 * @returns the frequency in Hz
 */
export const readNoteFrequency = (noteName: string): number =>
  A4_HZ * 2 ** ((readNoteMidi(noteName) - A4_MIDI) / SEMITONES_PER_OCTAVE)

const readDecaySeconds = (sustain: number): number =>
  STONER_GUITAR_MIN_DECAY_SECONDS +
  sustain * (STONER_GUITAR_MAX_DECAY_SECONDS - STONER_GUITAR_MIN_DECAY_SECONDS)

const readStringPitches = (
  rootFrequency: number,
  articulation: StonerGuitarArticulation
): number[] =>
  articulation === 'note'
    ? [rootFrequency]
    : [
        rootFrequency,
        rootFrequency * 2 ** (FIFTH_SEMITONES / SEMITONES_PER_OCTAVE),
        rootFrequency * 2
      ]

// The strings are summed here, before the fuzz: how they intermodulate in the clipper is the sound.
const renderDryVoice = (
  noteName: string,
  articulation: StonerGuitarArticulation,
  tone: StonerGuitarTone,
  seed: number,
  detuneCents: number
): Float32Array => {
  const sampleRate = STONER_GUITAR_SAMPLE_RATE
  const durationSeconds = STONER_GUITAR_DURATION_SECONDS[articulation]
  const detune = 2 ** (detuneCents / (CENTS_PER_SEMITONE * SEMITONES_PER_OCTAVE))
  const strings = readStringPitches(readNoteFrequency(noteName) * detune, articulation).map(
    (frequency, stringIndex) => ({
      samples: renderPluckedString({
        frequency,
        sampleRate,
        durationSeconds,
        decaySeconds: readDecaySeconds(tone.sustain),
        seed: seed + stringIndex,
        palmMuted: articulation === 'mute'
      }),
      startSample: Math.round(stringIndex * STONER_GUITAR_STRUM_SPACING_SECONDS * sampleRate)
    })
  )
  const dry = new Float32Array(Math.round(sampleRate * durationSeconds))
  strings.forEach(({ samples, startSample }) =>
    samples.forEach((sample, index) => {
      if (index + startSample < dry.length) {
        dry[index + startSample] = (dry[index + startSample] ?? 0) + sample
      }
    })
  )
  return dry
}

const applyFades = (signal: Float32Array): Float32Array => {
  const fadeInSamples = Math.round(STONER_GUITAR_FADE_IN_SECONDS * STONER_GUITAR_SAMPLE_RATE)
  const fadeOutSamples = Math.round(STONER_GUITAR_FADE_OUT_SECONDS * STONER_GUITAR_SAMPLE_RATE)
  return signal.map((sample, index) => {
    const fadeIn = Math.min(1, index / fadeInSamples)
    const fadeOut = Math.min(1, (signal.length - 1 - index) / fadeOutSamples)
    return sample * fadeIn * fadeOut
  })
}

/**
 * One sound as stereo: two takes with different noise and a few cents of tuning apart, hard left
 * and hard right, the way a rhythm guitar is double tracked. Faded in and out to exact zero and
 * scaled so the louder channel peaks at -1 dBFS.
 * @param noteName - the root note, such as `c2`
 * @param articulation - a power chord, a palm muted power chord or a single note
 * @param tone - the five knobs
 * @param seed - varies the noise, so every sound is its own pluck
 * @returns the left and right channels
 */
export const renderStonerGuitarSample = (
  noteName: string,
  articulation: StonerGuitarArticulation,
  tone: StonerGuitarTone,
  seed: number
): Float32Array[] => {
  const takes = [
    { seed, detuneCents: STONER_GUITAR_TAKE_DETUNE_CENTS },
    { seed: seed + SECOND_TAKE_SEED_OFFSET, detuneCents: -STONER_GUITAR_TAKE_DETUNE_CENTS }
  ].map((take) =>
    applyFades(
      applyFuzz(
        renderDryVoice(noteName, articulation, tone, take.seed, take.detuneCents),
        tone,
        STONER_GUITAR_SAMPLE_RATE
      )
    )
  )
  const peak = readPeak(...takes)
  return takes.map((take) => (peak === 0 ? take : scaleSignal(take, STONER_GUITAR_PEAK / peak)))
}

/**
 * Every sound the bank holds, by name, with no audio rendered yet.
 * @returns one entry per articulation and note
 */
export const listStonerGuitarBankEntries = (): StonerGuitarBankEntry[] =>
  ARTICULATIONS.flatMap((articulation) =>
    STONER_GUITAR_NOTES[articulation].map((noteName) => ({
      articulation,
      soundName: STONER_GUITAR_SOUND_NAMES[articulation],
      noteName
    }))
  )

/**
 * Renders the whole bank: every chord, palm mute and single note at its sampled pitches.
 * @param tone - the five knobs
 * @returns each sound's name, note and stereo channels
 */
export const buildStonerGuitarBank = (tone: StonerGuitarTone): StonerGuitarSound[] =>
  listStonerGuitarBankEntries().map(({ articulation, soundName, noteName }) => ({
    soundName,
    noteName,
    channels: renderStonerGuitarSample(noteName, articulation, tone, readNoteMidi(noteName) * 7)
  }))
