import { describe, expect, it } from 'vitest'
import { readNoteFrequency } from './stonerGuitar'
import { renderPluckedString } from './pluckedString'
import type { PluckedStringOptions } from './types'

const SAMPLE_RATE = 32000

const buildOptions = (overrides: Partial<PluckedStringOptions>): PluckedStringOptions => ({
  frequency: 110,
  sampleRate: SAMPLE_RATE,
  durationSeconds: 2,
  decaySeconds: 3,
  seed: 1,
  palmMuted: false,
  ...overrides
})

const readRms = (signal: Float32Array, from: number, to: number): number => {
  const slice = signal.slice(from, to)
  return Math.sqrt(slice.reduce((sum, sample) => sum + sample * sample, 0) / slice.length)
}

// Autocorrelation peak with a parabola through its top, so the answer is finer than one sample.
const detectFrequency = (signal: Float32Array, expectedFrequency: number): number => {
  const window = signal.slice(0, Math.round(SAMPLE_RATE * 0.5))
  const correlate = (lag: number): number =>
    window.reduce((sum, sample, index) => sum + sample * (window[index + lag] ?? 0), 0)
  const expectedLag = Math.round(SAMPLE_RATE / expectedFrequency)
  const lags = Array.from(
    { length: Math.round(expectedLag * 0.2) * 2 + 1 },
    (_, index) => Math.round(expectedLag * 0.8) + index
  )
  const bestLag = lags.reduce((best, lag) => (correlate(lag) > correlate(best) ? lag : best))
  const before = correlate(bestLag - 1)
  const centre = correlate(bestLag)
  const after = correlate(bestLag + 1)
  const offset = (0.5 * (before - after)) / (before - 2 * centre + after)
  return SAMPLE_RATE / (bestLag + offset)
}

describe('renderPluckedString', () => {
  it.each(['c2', 'a2', 'c4', 'a4'])('rings %s within 10 cents of its pitch', (noteName) => {
    // Arrange
    const frequency = readNoteFrequency(noteName)

    // Act
    const signal = renderPluckedString(buildOptions({ frequency }))
    const detected = detectFrequency(signal, frequency)

    // Assert
    const centsOff = 1200 * Math.log2(detected / frequency)
    expect(Math.abs(centsOff)).toBeLessThan(10)
  })

  it('decays: the late ring is far quieter than the attack', () => {
    // Arrange
    const options = buildOptions({ decaySeconds: 1 })

    // Act
    const signal = renderPluckedString(options)

    // Assert
    const early = readRms(signal, 0, 3200)
    const late = readRms(signal, SAMPLE_RATE * 1.8, SAMPLE_RATE * 2)
    expect(late).toBeLessThan(early * 0.05)
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
})
