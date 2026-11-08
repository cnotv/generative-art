import { describe, expect, it } from 'vitest'
import { applyBiquad, highpassCoefficients, lowpassCoefficients } from './biquad'
import { applyFuzz } from './fuzz'
import { renderPluckedString } from './pluckedString'
import { STONER_GUITAR_DEFAULT_TONE } from './config'
import { readPeak } from './signal'

const SAMPLE_RATE = 32000

const buildGuitar = (): Float32Array =>
  renderPluckedString({
    frequency: 130.8,
    sampleRate: SAMPLE_RATE,
    durationSeconds: 1,
    decaySeconds: 3,
    seed: 3,
    palmMuted: false
  })

// A sine has no harmonics of its own, so every bit of energy above 1 kHz is the fuzz's doing.
const buildSine = (): Float32Array =>
  Float32Array.from(
    { length: SAMPLE_RATE },
    (_, index) => 0.5 * Math.sin((2 * Math.PI * 110 * index) / SAMPLE_RATE)
  )

const readRms = (signal: Float32Array): number =>
  Math.sqrt(signal.reduce((sum, sample) => sum + sample * sample, 0) / signal.length)

const readCrestFactor = (signal: Float32Array): number => readPeak(signal) / readRms(signal)

const readBrightness = (signal: Float32Array): number =>
  readRms(applyBiquad(signal, highpassCoefficients(SAMPLE_RATE, 1000))) /
  readRms(applyBiquad(signal, lowpassCoefficients(SAMPLE_RATE, 200)))

describe('applyFuzz', () => {
  it('never peaks above 1', () => {
    // Arrange
    const tone = { ...STONER_GUITAR_DEFAULT_TONE, drive: 1 }

    // Act
    const fuzzed = applyFuzz(buildGuitar(), tone, SAMPLE_RATE)

    // Assert
    expect(readPeak(fuzzed)).toBeLessThanOrEqual(1)
  })

  it.each([
    ['compresses the plucked string', buildGuitar, readCrestFactor, 'lower'],
    ['brightens a sine', buildSine, readBrightness, 'higher']
  ])('%s as the drive goes up', (_case, buildInput, measure, direction) => {
    // Arrange
    const input = buildInput()
    const gentle = { ...STONER_GUITAR_DEFAULT_TONE, drive: 0.1 }
    const heavy = { ...STONER_GUITAR_DEFAULT_TONE, drive: 0.9 }

    // Act
    const gentleMeasure = measure(applyFuzz(input, gentle, SAMPLE_RATE))
    const heavyMeasure = measure(applyFuzz(input, heavy, SAMPLE_RATE))

    // Assert
    if (direction === 'lower') {
      expect(heavyMeasure).toBeLessThan(gentleMeasure)
    } else {
      expect(heavyMeasure).toBeGreaterThan(gentleMeasure)
    }
  })

  it('turns silence into silence', () => {
    // Arrange
    const silence = new Float32Array(3200)

    // Act
    const fuzzed = applyFuzz(silence, STONER_GUITAR_DEFAULT_TONE, SAMPLE_RATE)

    // Assert
    expect(readPeak(fuzzed)).toBe(0)
  })
})
