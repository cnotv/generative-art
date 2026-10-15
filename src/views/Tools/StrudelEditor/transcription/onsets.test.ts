import { describe, it, expect } from 'vitest'
import { ONSET_FRAME_SIZE, ONSET_HOP_SIZE, TRANSCRIPTION_SAMPLE_RATE } from '../config'
import { computeSpectrogram } from './spectrogram'
import { computeSpectralFlux, pickOnsetPeaks } from './onsets'
import { createClickTrack } from './syntheticSignals'

const BIN_WIDTH_HZ = TRANSCRIPTION_SAMPLE_RATE / ONSET_FRAME_SIZE
const framesToSeconds = (frameIndex: number): number =>
  (frameIndex * ONSET_HOP_SIZE) / TRANSCRIPTION_SAMPLE_RATE

describe('computeSpectralFlux', () => {
  it('never goes negative', () => {
    // Arrange
    const samples = createClickTrack({
      beatsPerMinute: 120,
      durationSeconds: 2,
      sampleRate: TRANSCRIPTION_SAMPLE_RATE
    })
    const spectrogram = computeSpectrogram(samples, ONSET_FRAME_SIZE, ONSET_HOP_SIZE)

    // Act
    const flux = computeSpectralFlux(spectrogram, BIN_WIDTH_HZ)

    // Assert
    expect([...flux].every((value) => value >= 0)).toBe(true)
  })

  it('keeps an onset in the very first frame', () => {
    // Arrange
    const samples = createClickTrack({
      beatsPerMinute: 120,
      durationSeconds: 1,
      sampleRate: TRANSCRIPTION_SAMPLE_RATE
    })
    const spectrogram = computeSpectrogram(samples, ONSET_FRAME_SIZE, ONSET_HOP_SIZE)

    // Act
    const flux = computeSpectralFlux(spectrogram, BIN_WIDTH_HZ)

    // Assert
    expect(pickOnsetPeaks(flux)[0]).toBe(0)
  })
})

describe('pickOnsetPeaks', () => {
  it('finds one onset per click, close to each click time', () => {
    // Arrange
    const samples = createClickTrack({
      beatsPerMinute: 120,
      durationSeconds: 4,
      offsetSeconds: 0.1,
      sampleRate: TRANSCRIPTION_SAMPLE_RATE
    })
    const flux = computeSpectralFlux(
      computeSpectrogram(samples, ONSET_FRAME_SIZE, ONSET_HOP_SIZE),
      BIN_WIDTH_HZ
    )
    const expectedTimes = Array.from({ length: 7 }, (_, index) => 0.1 + index * 0.5)

    // Act
    const onsetTimes = pickOnsetPeaks(flux).map(framesToSeconds)

    // Assert
    expect(onsetTimes).toHaveLength(expectedTimes.length)
    onsetTimes.forEach((onsetTime, index) => {
      expect(Math.abs(onsetTime - expectedTimes[index])).toBeLessThan(0.05)
    })
  })

  it('finds nothing in silence', () => {
    // Arrange
    const flux = new Float64Array(64)

    // Act
    const peaks = pickOnsetPeaks(flux)

    // Assert
    expect(peaks).toEqual([])
  })
})
