import { describe, it, expect } from 'vitest'
import { midiNoteToFreq } from '@webgamekit/audio'
import { PITCH_FRAME_SIZE, TRANSCRIPTION_SAMPLE_RATE } from '../config'
import { magnitudeSpectrum } from './fft'
import { extractFrame, hannWindow } from './spectrogram'
import { dominantBassNote, frequencyToMidiNote, midiNoteToName } from './pitch'
import { createSine } from './syntheticSignals'

const BIN_WIDTH_HZ = TRANSCRIPTION_SAMPLE_RATE / PITCH_FRAME_SIZE
const SPAN = { durationSeconds: 0.25, sampleRate: TRANSCRIPTION_SAMPLE_RATE }

const spectrumOf = (samples: Float32Array): Float64Array =>
  magnitudeSpectrum(extractFrame(samples, 0, hannWindow(PITCH_FRAME_SIZE)))

describe('frequencyToMidiNote', () => {
  it.each([
    [440, 69],
    [110, 45],
    [261.63, 60],
    [445, 69]
  ])('maps %f Hz to MIDI %i', (frequency, expectedNote) => {
    // Arrange
    const frequencyHz = frequency

    // Act
    const midiNote = frequencyToMidiNote(frequencyHz)

    // Assert
    expect(midiNote).toBe(expectedNote)
  })

  it.each(Array.from({ length: 40 }, (_, index) => [28 + index]))(
    'round-trips MIDI %i through midiNoteToFreq',
    (midiNote) => {
      // Arrange
      const frequencyHz = midiNoteToFreq(midiNote)

      // Act
      const roundTripped = frequencyToMidiNote(frequencyHz)

      // Assert
      expect(roundTripped).toBe(midiNote)
    }
  )
})

describe('midiNoteToName', () => {
  it.each([
    [45, 'a2'],
    [60, 'c4'],
    [61, 'c#4'],
    [28, 'e1']
  ])('names MIDI %i as %s', (midiNote, expectedName) => {
    // Arrange
    const noteNumber = midiNote

    // Act
    const noteName = midiNoteToName(noteNumber)

    // Assert
    expect(noteName).toBe(expectedName)
  })
})

describe('dominantBassNote', () => {
  it.each([
    [55, 'a1'],
    [110, 'a2'],
    [82.41, 'e2'],
    [146.83, 'd3']
  ])('hears %f Hz as %s', (frequency, expectedName) => {
    // Arrange
    const spectrum = spectrumOf(createSine(frequency, SPAN))

    // Act
    const noteName = dominantBassNote(spectrum, BIN_WIDTH_HZ)

    // Assert
    expect(noteName).toBe(expectedName)
  })

  it('hears nothing when the low band is quiet', () => {
    // Arrange
    const spectrum = spectrumOf(createSine(1000, SPAN))

    // Act
    const noteName = dominantBassNote(spectrum, BIN_WIDTH_HZ)

    // Assert
    expect(noteName).toBeNull()
  })
})
