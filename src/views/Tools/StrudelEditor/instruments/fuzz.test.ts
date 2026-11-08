import { describe, expect, it } from 'vitest'
import { applyBiquad, highpassCoefficients, lowpassCoefficients } from './biquad'
import { applyFuzz } from './fuzz'
import { renderPluckedString } from './pluckedString'
import { INSTRUMENT_BASS_CHAIN, INSTRUMENT_ELECTRIC_CHAIN } from './config'
import { readPeak } from './signal'

const SAMPLE_RATE = 32000

const buildGuitar = (): Float32Array =>
  renderPluckedString({
    frequency: 130.8,
    sampleRate: SAMPLE_RATE,
    durationSeconds: 1,
    decaySeconds: 3,
    seed: 3,
    palmMuted: false,
    softening: 0.5,
    pickPosition: 0.13,
    mutedDecaySeconds: 0.25,
    mutedLowpassHz: 600
  })

const DEFAULT_CONTROLS = { drive: 0.75, bass: 0.7, mids: 0.35, tone: 0.45 }

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
    const tone = { ...DEFAULT_CONTROLS, drive: 1 }

    // Act
    const fuzzed = applyFuzz(buildGuitar(), tone, INSTRUMENT_ELECTRIC_CHAIN, SAMPLE_RATE)

    // Assert
    expect(readPeak(fuzzed)).toBeLessThanOrEqual(1)
  })

  it.each([
    ['compresses the plucked string', buildGuitar, readCrestFactor, 'lower'],
    ['brightens a sine', buildSine, readBrightness, 'higher']
  ])('%s as the drive goes up', (_case, buildInput, measure, direction) => {
    // Arrange
    const input = buildInput()
    const gentle = { ...DEFAULT_CONTROLS, drive: 0.1 }
    const heavy = { ...DEFAULT_CONTROLS, drive: 0.9 }

    // Act
    const gentleMeasure = measure(applyFuzz(input, gentle, INSTRUMENT_ELECTRIC_CHAIN, SAMPLE_RATE))
    const heavyMeasure = measure(applyFuzz(input, heavy, INSTRUMENT_ELECTRIC_CHAIN, SAMPLE_RATE))

    // Assert
    if (direction === 'lower') {
      expect(heavyMeasure).toBeLessThan(gentleMeasure)
    } else {
      expect(heavyMeasure).toBeGreaterThan(gentleMeasure)
    }
  })

  it('stays nearly clean at no drive and distorts far less than the bass chain at full drive', () => {
    // Arrange
    const clean = { ...DEFAULT_CONTROLS, drive: 0 }

    // Act
    const cleanOutput = applyFuzz(buildSine(), clean, INSTRUMENT_ELECTRIC_CHAIN, SAMPLE_RATE)
    const fuzzOutput = applyFuzz(
      buildSine(),
      { ...clean, drive: 1 },
      INSTRUMENT_ELECTRIC_CHAIN,
      SAMPLE_RATE
    )

    // Assert
    expect(readBrightness(cleanOutput)).toBeLessThan(readBrightness(fuzzOutput) * 0.2)
    expect(readCrestFactor(cleanOutput)).toBeGreaterThan(1.35)
  })

  it('gives the bass chain a gentler drive than the electric one at the same setting', () => {
    // Arrange
    const controls = { ...DEFAULT_CONTROLS, drive: 1 }

    // Act
    const electric = applyFuzz(buildSine(), controls, INSTRUMENT_ELECTRIC_CHAIN, SAMPLE_RATE)
    const bass = applyFuzz(buildSine(), controls, INSTRUMENT_BASS_CHAIN, SAMPLE_RATE)

    // Assert
    expect(readBrightness(bass)).toBeLessThan(readBrightness(electric))
  })

  it('turns silence into silence', () => {
    // Arrange
    const silence = new Float32Array(3200)

    // Act
    const fuzzed = applyFuzz(silence, DEFAULT_CONTROLS, INSTRUMENT_ELECTRIC_CHAIN, SAMPLE_RATE)

    // Assert
    expect(readPeak(fuzzed)).toBe(0)
  })
})
