import { describe, it, expect } from 'vitest'
import { ONSET_FRAME_SIZE, TRANSCRIPTION_SAMPLE_RATE } from '../config'
import { magnitudeSpectrum } from './fft'
import { extractFrame, hannWindow } from './spectrogram'
import { classifyDrumHit } from './drums'
import { createNoise, createSine, mixSignals } from './syntheticSignals'

const SPAN = { durationSeconds: 0.1, sampleRate: TRANSCRIPTION_SAMPLE_RATE }
const BIN_WIDTH_HZ = TRANSCRIPTION_SAMPLE_RATE / ONSET_FRAME_SIZE

const spectrumOf = (samples: Float32Array): Float64Array =>
  magnitudeSpectrum(extractFrame(samples, 0, hannWindow(ONSET_FRAME_SIZE)))

describe('classifyDrumHit', () => {
  it('hears a hi-hat over a bass note that was already ringing', () => {
    // Arrange
    const bass = createSine(55, SPAN, 0.8)
    const previousSpectrum = spectrumOf(bass)
    const spectrum = spectrumOf(mixSignals(bass, createNoise(SPAN, 0.3)))

    // Act
    const drums = classifyDrumHit(spectrum, BIN_WIDTH_HZ, previousSpectrum)

    // Assert
    expect(drums).toEqual(['hh'])
  })

  it.each([
    ['a low sine', createSine(60, SPAN), ['bd']],
    ['white noise', createNoise(SPAN), ['hh']],
    ['mid-band tones', mixSignals(createSine(400, SPAN), createSine(1800, SPAN)), ['sd']],
    ['silence', new Float32Array(ONSET_FRAME_SIZE), []]
  ])('classifies %s', (_label, samples, expectedDrums) => {
    // Arrange
    const spectrum = spectrumOf(samples)

    // Act
    const drums = classifyDrumHit(spectrum, BIN_WIDTH_HZ)

    // Assert
    expect(drums).toEqual(expectedDrums)
  })
})
