import { describe, it, expect } from 'vitest'
import { throttleRatio } from './playerMotion'
import { ACCELERATE, BRAKE } from '../config'

describe('throttleRatio', () => {
  it.each([
    [false, false, 1],
    [false, true, ACCELERATE.speedRatio],
    [true, false, BRAKE.laneSpeedRatio],
    [true, true, BRAKE.laneSpeedRatio]
  ])(
    'braking %s and speeding up %s runs the ball at %f of its speed',
    (braking, accelerating, expected) => {
      // Act
      const ratio = throttleRatio(braking, accelerating)

      // Assert
      expect(ratio).toBe(expected)
    }
  )
})
