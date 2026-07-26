import { describe, it, expect } from 'vitest'
import {
  advanceDistance,
  speedCapAt,
  steerDirection,
  speedAlong,
  isGrounded,
  forwardImpulseMagnitude,
  steerImpulseMagnitude
} from './rockMotion'
import { createTrackPath } from '../trackPath'
import {
  BASE_MAX_SPEED,
  MAX_SPEED_CEILING,
  SPEED_RAMP_DISTANCE,
  GROUND_PROBE_DISTANCE,
  ROCK_RADIUS
} from '../config'

const path = createTrackPath(77)

describe('advanceDistance', () => {
  it('stays put when the rock sits on the station', () => {
    const sample = path.sampleAt(120)

    expect(advanceDistance(path, 120, sample.position)).toBeCloseTo(120)
  })

  it('advances by the forward component of the offset', () => {
    const sample = path.sampleAt(100)
    const ahead = {
      x: sample.position.x + sample.forward.x * 7,
      z: sample.position.z + sample.forward.z * 7
    }

    expect(advanceDistance(path, 100, ahead)).toBeCloseTo(107)
  })

  it('ignores pure lateral drift', () => {
    const sample = path.sampleAt(100)
    const sideways = {
      x: sample.position.x + sample.right.x * 6,
      z: sample.position.z + sample.right.z * 6
    }

    expect(advanceDistance(path, 100, sideways)).toBeCloseTo(100)
  })

  it('never reports a negative distance', () => {
    const sample = path.sampleAt(0)
    const behind = {
      x: sample.position.x - sample.forward.x * 50,
      z: sample.position.z - sample.forward.z * 50
    }

    expect(advanceDistance(path, 0, behind)).toBe(0)
  })

  it('converges on the true distance when applied repeatedly', () => {
    const target = path.sampleAt(240).position

    const converged = Array.from({ length: 4 }).reduce<number>(
      (distance) => advanceDistance(path, distance, target),
      180
    )

    expect(converged).toBeCloseTo(240, 0)
  })
})

describe('speedCapAt', () => {
  it.each([
    [0, BASE_MAX_SPEED],
    [SPEED_RAMP_DISTANCE, MAX_SPEED_CEILING],
    [SPEED_RAMP_DISTANCE * 10, MAX_SPEED_CEILING],
    [SPEED_RAMP_DISTANCE / 2, (BASE_MAX_SPEED + MAX_SPEED_CEILING) / 2]
  ])('at %f the cap is %f', (distance, expected) => {
    expect(speedCapAt(distance)).toBeCloseTo(expected)
  })

  it('never dips below the starting cap', () => {
    expect(speedCapAt(-500)).toBe(BASE_MAX_SPEED)
  })
})

describe('steerDirection', () => {
  it.each([
    [{}, 0],
    [{ left: true }, -1],
    [{ right: true }, 1],
    [{ left: true, right: true }, 0]
  ])('%j steers %i', (actions, expected) => {
    expect(steerDirection(actions as never)).toBe(expected)
  })
})

describe('speedAlong', () => {
  it('projects velocity onto a direction', () => {
    expect(speedAlong({ x: 3, y: 9, z: 4 }, { x: 1, z: 0 })).toBe(3)
    expect(speedAlong({ x: 3, y: 9, z: 4 }, { x: 0, z: 1 })).toBe(4)
  })

  it('is negative when moving against the direction', () => {
    expect(speedAlong({ x: -5, y: 0, z: 0 }, { x: 1, z: 0 })).toBe(-5)
  })

  it('ignores the vertical component', () => {
    expect(speedAlong({ x: 0, y: 100, z: 0 }, { x: 1, z: 0 })).toBe(0)
  })
})

describe('isGrounded', () => {
  it('is grounded when resting on the deck', () => {
    expect(isGrounded(ROCK_RADIUS, 0, 0)).toBe(true)
  })

  it('is not grounded once clear of the probe distance', () => {
    expect(isGrounded(GROUND_PROBE_DISTANCE + 0.1, 0, 0)).toBe(false)
  })

  it('is not grounded while rising, so jumps cannot stack', () => {
    expect(isGrounded(ROCK_RADIUS, 0, 5)).toBe(false)
  })

  it('is grounded while falling onto the deck', () => {
    expect(isGrounded(ROCK_RADIUS, 0, -4)).toBe(true)
  })

  it('follows the deck uphill', () => {
    expect(isGrounded(40 + ROCK_RADIUS, 40, 0)).toBe(true)
  })
})

describe('forwardImpulseMagnitude', () => {
  it.each([
    [0, 20, 5, 5],
    [19.9, 20, 5, 5],
    [20, 20, 5, 0],
    [30, 20, 5, 0]
  ])('at speed %f under cap %f applies %f', (speed, cap, impulse, expected) => {
    expect(forwardImpulseMagnitude(speed, cap, impulse)).toBe(expected)
  })
})

describe('steerImpulseMagnitude', () => {
  it('applies nothing without input', () => {
    expect(steerImpulseMagnitude(0, 0, 12, 4)).toBe(0)
  })

  it.each([
    [1, 0, 4],
    [-1, 0, -4],
    [1, 11.9, 4],
    [-1, -11.9, -4]
  ])('steer %i at lateral speed %f applies %f', (steer, lateral, expected) => {
    expect(steerImpulseMagnitude(steer, lateral, 12, 4)).toBe(expected)
  })

  it('stops pushing once the lateral cap is reached', () => {
    expect(steerImpulseMagnitude(1, 12, 12, 4)).toBe(0)
    expect(steerImpulseMagnitude(-1, -12, 12, 4)).toBe(0)
  })

  it('still allows steering back from the cap', () => {
    expect(steerImpulseMagnitude(-1, 12, 12, 4)).toBe(-4)
    expect(steerImpulseMagnitude(1, -12, 12, 4)).toBe(4)
  })
})
