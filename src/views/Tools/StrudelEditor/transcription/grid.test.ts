import { describe, it, expect } from 'vitest'
import { quantizeToSteps, stepStartSeconds } from './grid'

describe('quantizeToSteps', () => {
  it.each([
    ['on the grid', [0, 0.125, 0.5], 0, [0, 1, 4]],
    ['slightly off the grid', [0.01, 0.13, 0.49], 0, [0, 1, 4]],
    ['after the phase', [0.1, 0.225], 0.1, [0, 1]],
    ['with duplicates merged', [0, 0.01, 0.02], 0, [0]],
    ['dropping hits before the phase', [0, 0.3], 0.25, [0]]
  ])('maps onsets %s', (_label, onsetTimes, phaseSeconds, expectedSteps) => {
    // Arrange
    const tempo = { beatsPerMinute: 120, phaseSeconds }

    // Act
    const steps = quantizeToSteps(onsetTimes, tempo)

    // Assert
    expect(steps.map((stepHit) => stepHit.stepIndex)).toEqual(expectedSteps)
  })

  it('keeps the onset time that landed on each step', () => {
    // Arrange
    const tempo = { beatsPerMinute: 120, phaseSeconds: 0 }

    // Act
    const steps = quantizeToSteps([0.51], tempo)

    // Assert
    expect(steps).toEqual([{ stepIndex: 4, onsetSeconds: 0.51 }])
  })
})

describe('stepStartSeconds', () => {
  it('offsets each sixteenth by the phase', () => {
    // Arrange
    const tempo = { beatsPerMinute: 120, phaseSeconds: 0.1 }

    // Act
    const startSeconds = stepStartSeconds(4, tempo)

    // Assert
    expect(startSeconds).toBeCloseTo(0.6)
  })
})
