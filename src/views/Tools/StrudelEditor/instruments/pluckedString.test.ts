import { describe, expect, it } from 'vitest'
import { readNoteFrequency } from './notes'
import { renderPluckedString } from './pluckedString'
import { TEST_SAMPLE_RATE, detectFrequency, readRms } from './testSupport'
import type { PluckedStringOptions } from './types'

const buildOptions = (overrides: Partial<PluckedStringOptions>): PluckedStringOptions => ({
  frequency: 110,
  sampleRate: TEST_SAMPLE_RATE,
  durationSeconds: 2,
  decaySeconds: 3,
  seed: 1,
  palmMuted: false,
  softening: 0.5,
  pickPosition: 0.13,
  mutedDecaySeconds: 0.25,
  mutedLowpassHz: 600,
  ...overrides
})

describe('renderPluckedString', () => {
  it.each(['a0', 'a1', 'c2', 'a2', 'c4', 'a4'])(
    'rings %s within 10 cents of its pitch',
    (noteName) => {
      // Arrange
      const frequency = readNoteFrequency(noteName)

      // Act
      const signal = renderPluckedString(buildOptions({ frequency }))
      const detected = detectFrequency(signal, frequency)

      // Assert
      const centsOff = 1200 * Math.log2(detected / frequency)
      expect(Math.abs(centsOff)).toBeLessThan(10)
    }
  )

  it('decays: the late ring is far quieter than the attack', () => {
    // Arrange
    const options = buildOptions({ decaySeconds: 1 })

    // Act
    const signal = renderPluckedString(options)

    // Assert
    expect(readRms(signal, TEST_SAMPLE_RATE * 1.8, TEST_SAMPLE_RATE * 2)).toBeLessThan(
      readRms(signal, 0, 3200) * 0.05
    )
  })

  it('gives the same samples for the same seed and different ones for another', () => {
    // Arrange
    const options = buildOptions({})

    // Act
    const first = renderPluckedString(options)
    const second = renderPluckedString(options)
    const other = renderPluckedString({ ...options, seed: 2 })

    // Assert
    expect([...second]).toEqual([...first])
    expect([...other]).not.toEqual([...first])
  })

  it('rings far shorter when palm muted', () => {
    // Arrange
    const open = buildOptions({ decaySeconds: 6 })

    // Act
    const openSignal = renderPluckedString(open)
    const mutedSignal = renderPluckedString({ ...open, palmMuted: true })

    // Assert
    expect(readRms(mutedSignal, 16000, 32000)).toBeLessThan(readRms(openSignal, 16000, 32000) * 0.1)
  })

  it('is brighter with a hard pick than with a soft finger', () => {
    // Arrange
    const hard = buildOptions({ softening: 0.1 })
    const soft = buildOptions({ softening: 0.9 })
    const readHighShare = (signal: Float32Array): number => {
      const difference = signal.map((sample, index) => sample - (signal[index - 1] ?? 0))
      return readRms(difference) / readRms(signal)
    }

    // Act
    const hardBrightness = readHighShare(renderPluckedString(hard))
    const softBrightness = readHighShare(renderPluckedString(soft))

    // Assert
    expect(hardBrightness).toBeGreaterThan(softBrightness)
  })
})
