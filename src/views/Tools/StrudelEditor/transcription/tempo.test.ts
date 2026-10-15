import { describe, it, expect } from 'vitest'
import { ONSET_FRAME_SIZE, ONSET_HOP_SIZE, TRANSCRIPTION_SAMPLE_RATE } from '../config'
import { computeSpectrogram } from './spectrogram'
import { computeSpectralFlux } from './onsets'
import { estimateTempo } from './tempo'
import { createClickTrack } from './syntheticSignals'

const BIN_WIDTH_HZ = TRANSCRIPTION_SAMPLE_RATE / ONSET_FRAME_SIZE
const FRAMES_PER_SECOND = TRANSCRIPTION_SAMPLE_RATE / ONSET_HOP_SIZE

const clickEnvelope = (beatsPerMinute: number, offsetSeconds = 0): Float64Array =>
  computeSpectralFlux(
    computeSpectrogram(
      createClickTrack({
        beatsPerMinute,
        offsetSeconds,
        durationSeconds: 12,
        sampleRate: TRANSCRIPTION_SAMPLE_RATE
      }),
      ONSET_FRAME_SIZE,
      ONSET_HOP_SIZE
    ),
    BIN_WIDTH_HZ
  )

describe('estimateTempo', () => {
  it.each([[78], [95], [120], [128], [140], [174]])(
    'detects a %i BPM click track',
    (beatsPerMinute) => {
      // Arrange
      const envelope = clickEnvelope(beatsPerMinute)

      // Act
      const tempo = estimateTempo(envelope, FRAMES_PER_SECOND)

      // Assert
      expect(Math.abs(tempo.beatsPerMinute - beatsPerMinute)).toBeLessThanOrEqual(1)
    }
  )

  it('places the beat phase on the clicks', () => {
    // Arrange
    const envelope = clickEnvelope(120, 0.2)

    // Act
    const tempo = estimateTempo(envelope, FRAMES_PER_SECOND)

    // Assert
    expect(tempo.beatsPerMinute).toBe(120)
    expect(Math.abs(tempo.phaseSeconds - 0.2)).toBeLessThan(0.03)
  })

  it('keeps the first beat at the start of a track that opens on it', () => {
    // Arrange
    const envelope = clickEnvelope(120, 0)

    // Act
    const tempo = estimateTempo(envelope, FRAMES_PER_SECOND)

    // Assert
    expect(Math.abs(tempo.phaseSeconds)).toBeLessThan(0.07)
  })

  it('falls back to the prior tempo for silence', () => {
    // Arrange
    const envelope = new Float64Array(400)

    // Act
    const tempo = estimateTempo(envelope, FRAMES_PER_SECOND)

    // Assert
    expect(tempo).toEqual({ beatsPerMinute: 120, phaseSeconds: 0 })
  })
})
