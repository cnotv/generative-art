import { describe, it, expect } from 'vitest'
import { catchUpSteps, createTickClock } from './tickClock'
import { MAX_FRAME_SECONDS } from '../config'

const clockAt = (milliseconds: number[]) => {
  const readings = [...milliseconds]
  return createTickClock(() => readings.shift() ?? 0)
}

describe('createTickClock', () => {
  it('counts a sixtieth for the first tick, before there is a previous one', () => {
    // Arrange
    const tickSeconds = clockAt([5000])

    // Act
    const seconds = tickSeconds()

    // Assert
    expect(seconds).toBeCloseTo(1 / 60)
  })

  it.each([
    [1000 / 60, 1 / 60],
    [1000 / 30, 1 / 30],
    [5000, MAX_FRAME_SECONDS]
  ])('after %f ms between ticks counts %f s, capped at a long frame', (gap, expected) => {
    // Arrange
    const tickSeconds = clockAt([1000, 1000 + gap])
    tickSeconds()

    // Act
    const seconds = tickSeconds()

    // Assert
    expect(seconds).toBeCloseTo(expected)
  })
})

describe('catchUpSteps', () => {
  it.each([
    [1 / 120, 0],
    [1 / 60, 0],
    [1 / 30, 1],
    [0.1, 5]
  ])('a tick of %f s needs %i more physics steps', (tickSeconds, expected) => {
    // Act
    const steps = catchUpSteps(tickSeconds)

    // Assert
    expect(steps).toBe(expected)
  })
})
