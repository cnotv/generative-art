import { describe, it, expect } from 'vitest'
import { PITCH_FRAME_SIZE, TRANSCRIPTION_SAMPLE_RATE } from '../config'
import { magnitudeSpectrum } from './fft'
import { extractFrame, hannWindow } from './spectrogram'
import { computeChroma, matchTriad } from './chords'
import { createSine, mixSignals } from './syntheticSignals'

const BIN_WIDTH_HZ = TRANSCRIPTION_SAMPLE_RATE / PITCH_FRAME_SIZE
const SPAN = { durationSeconds: 0.25, sampleRate: TRANSCRIPTION_SAMPLE_RATE }

const chordSpectrum = (frequencies: number[]): Float64Array =>
  magnitudeSpectrum(
    extractFrame(
      mixSignals(...frequencies.map((frequency) => createSine(frequency, SPAN, 0.3))),
      0,
      hannWindow(PITCH_FRAME_SIZE)
    )
  )

describe('matchTriad', () => {
  it.each([
    ['A minor', [220, 261.63, 329.63], 'Am'],
    ['C major', [261.63, 329.63, 392], 'C'],
    ['F# major', [369.99, 466.16, 554.37], 'F#'],
    ['E minor', [329.63, 392, 493.88], 'Em']
  ])('recognises %s', (_label, frequencies, expectedChord) => {
    // Arrange
    const chroma = computeChroma(chordSpectrum(frequencies), BIN_WIDTH_HZ)

    // Act
    const chord = matchTriad(chroma)

    // Assert
    expect(chord).toBe(expectedChord)
  })

  it('returns null for silence', () => {
    // Arrange
    const chroma = new Float64Array(12)

    // Act
    const chord = matchTriad(chroma)

    // Assert
    expect(chord).toBeNull()
  })
})

describe('computeChroma', () => {
  it('collects a single tone into its pitch class', () => {
    // Arrange
    const spectrum = chordSpectrum([440])

    // Act
    const chroma = computeChroma(spectrum, BIN_WIDTH_HZ)

    // Assert
    const strongestClass = chroma.reduce(
      (bestIndex, value, index) => (value > chroma[bestIndex] ? index : bestIndex),
      0
    )
    expect(strongestClass).toBe(9)
  })
})
