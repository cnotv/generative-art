import { describe, it, expect, vi } from 'vitest'
import { TRANSCRIPTION_SAMPLE_RATE } from '../config'
import { transcribeSamples } from './transcribe'
import { createDrumLoop } from './syntheticSignals'

describe('transcribeSamples', () => {
  it('recovers tempo, kicks and off-beat hats from a drum loop', () => {
    // Arrange
    const samples = createDrumLoop({
      beatsPerMinute: 120,
      bars: 4,
      sampleRate: TRANSCRIPTION_SAMPLE_RATE
    })

    // Act
    const result = transcribeSamples({ samples, sampleRate: TRANSCRIPTION_SAMPLE_RATE })

    // Assert
    expect(result.beatsPerMinute).toBe(120)
    expect(result.bars.length).toBeGreaterThanOrEqual(3)
    const firstBar = result.bars[0]
    expect(firstBar.steps[0].drums).toContain('bd')
    expect(firstBar.steps[2].drums).toContain('hh')
    expect(firstBar.steps[4].drums).toContain('bd')
    expect(firstBar.steps[1].drums).toEqual([])
  })

  it('reports each analysis stage in order', () => {
    // Arrange
    const samples = createDrumLoop({
      beatsPerMinute: 120,
      bars: 1,
      sampleRate: TRANSCRIPTION_SAMPLE_RATE
    })
    const onProgress = vi.fn()

    // Act
    transcribeSamples({ samples, sampleRate: TRANSCRIPTION_SAMPLE_RATE }, onProgress)

    // Assert
    const stages = onProgress.mock.calls.map(([progress]) => progress.stage)
    expect(stages).toEqual(['onsets', 'tempo', 'notes', 'done'])
  })

  it('returns no bars for silence', () => {
    // Arrange
    const samples = new Float32Array(TRANSCRIPTION_SAMPLE_RATE * 2)

    // Act
    const result = transcribeSamples({ samples, sampleRate: TRANSCRIPTION_SAMPLE_RATE })

    // Assert
    expect(result.bars.every((bar) => bar.steps.every((step) => step.drums.length === 0))).toBe(
      true
    )
  })
})
