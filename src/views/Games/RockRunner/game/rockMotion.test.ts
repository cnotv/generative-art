import { describe, it, expect } from 'vitest'
import {
  advanceDistance,
  debrisBurstSize,
  debrisLifetime,
  speedCapAt,
  steerDirection,
  speedAlong,
  isGrounded,
  gravityScaleFor,
  forwardImpulseMagnitude,
  frameScaledImpulse,
  steerImpulseMagnitude,
  wallStandoff,
  lateralOffset
} from './rockMotion'
import { createTrackPath } from '../trackPath'
import {
  BASE_MAX_SPEED,
  MAX_SPEED_CEILING,
  SPEED_RAMP_DISTANCE,
  GROUND_PROBE_SLACK,
  WALL_INSET,
  ROCK_RADIUS
} from '../config'

const path = createTrackPath(77)
const PROBE = ROCK_RADIUS + GROUND_PROBE_SLACK

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
    expect(
      speedCapAt(distance, BASE_MAX_SPEED, MAX_SPEED_CEILING, SPEED_RAMP_DISTANCE)
    ).toBeCloseTo(expected)
  })

  it('never dips below the starting cap', () => {
    expect(speedCapAt(-500, BASE_MAX_SPEED, MAX_SPEED_CEILING, SPEED_RAMP_DISTANCE)).toBe(
      BASE_MAX_SPEED
    )
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
    expect(isGrounded(ROCK_RADIUS, 0, 0, PROBE)).toBe(true)
  })

  it('is not grounded once clear of the probe distance', () => {
    expect(isGrounded(PROBE + 0.1, 0, 0, PROBE)).toBe(false)
  })

  it('is not grounded while rising, so jumps cannot stack', () => {
    expect(isGrounded(ROCK_RADIUS, 0, 5, PROBE)).toBe(false)
  })

  it('is grounded while falling onto the deck', () => {
    expect(isGrounded(ROCK_RADIUS, 0, -4, PROBE)).toBe(true)
  })

  it('follows the deck uphill', () => {
    expect(isGrounded(40 + ROCK_RADIUS, 40, 0, PROBE)).toBe(true)
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
    expect(
      steerImpulseMagnitude(0, 4, { lateralSpeed: 0, speedCap: 12, offset: 0, standoff: Infinity })
    ).toBe(0)
  })

  it.each([
    [1, 0, 4],
    [-1, 0, -4],
    [1, 11.9, 4],
    [-1, -11.9, -4]
  ])('steer %i at lateral speed %f applies %f', (steer, lateral, expected) => {
    expect(
      steerImpulseMagnitude(steer, 4, {
        lateralSpeed: lateral,
        speedCap: 12,
        offset: 0,
        standoff: Infinity
      })
    ).toBe(expected)
  })

  it('stops pushing once the lateral cap is reached', () => {
    expect(
      steerImpulseMagnitude(1, 4, { lateralSpeed: 12, speedCap: 12, offset: 0, standoff: Infinity })
    ).toBe(0)
    expect(
      steerImpulseMagnitude(-1, 4, {
        lateralSpeed: -12,
        speedCap: 12,
        offset: 0,
        standoff: Infinity
      })
    ).toBe(0)
  })

  it('still allows steering back from the cap', () => {
    expect(
      steerImpulseMagnitude(-1, 4, {
        lateralSpeed: 12,
        speedCap: 12,
        offset: 0,
        standoff: Infinity
      })
    ).toBe(-4)
    expect(
      steerImpulseMagnitude(1, 4, {
        lateralSpeed: -12,
        speedCap: 12,
        offset: 0,
        standoff: Infinity
      })
    ).toBe(4)
  })
})

describe('frameScaledImpulse', () => {
  // An impulse applied once per frame is momentum per frame, not per second:
  // without this the rock accelerates twice as hard at 120fps as at 60.
  it('leaves a reference-rate frame untouched', () => {
    expect(frameScaledImpulse(60, 1 / 60)).toBeCloseTo(60)
  })

  it('halves the impulse when frames come twice as often', () => {
    expect(frameScaledImpulse(60, 1 / 120)).toBeCloseTo(30)
  })

  it('doubles it when frames come half as often, so the second matches', () => {
    expect(frameScaledImpulse(60, 1 / 30)).toBeCloseTo(120)
  })

  it('delivers the same momentum per second at any frame rate', () => {
    const perSecond = (fps: number) => frameScaledImpulse(60, 1 / fps) * fps

    expect(perSecond(120)).toBeCloseTo(perSecond(60))
    expect(perSecond(30)).toBeCloseTo(perSecond(60))
  })

  it('clamps a long frame so a stall cannot catapult the rock', () => {
    expect(frameScaledImpulse(60, 5)).toBe(frameScaledImpulse(60, 1 / 20))
  })

  it('never returns a negative impulse for a zero frame', () => {
    expect(frameScaledImpulse(60, 0)).toBe(0)
  })
})

describe('debrisBurstSize', () => {
  it('throws the full spray at the speed cap', () => {
    expect(debrisBurstSize(20, 20, 8, 1)).toBe(8)
  })

  it('throws the floor while barely moving', () => {
    expect(debrisBurstSize(0, 20, 8, 1)).toBe(1)
  })

  // Squared, not linear: scaled linearly a rock barely moving still rounded up
  // to a chip every tick, and the tick is fast enough that "the smallest spray"
  // was fifty chips a second.
  it('holds at nothing until the rock is genuinely moving', () => {
    expect(debrisBurstSize(4, 20, 8, 0)).toBe(0)
  })

  it('ramps hard once past that', () => {
    expect(debrisBurstSize(10, 20, 8, 0)).toBe(2)
    expect(debrisBurstSize(15, 20, 8, 0)).toBe(5)
  })

  it('rises faster near the cap than far from it', () => {
    const low = debrisBurstSize(10, 20, 8, 0) - debrisBurstSize(5, 20, 8, 0)
    const high = debrisBurstSize(20, 20, 8, 0) - debrisBurstSize(15, 20, 8, 0)

    expect(high).toBeGreaterThan(low)
  })

  // The cap ramps over a run, so a fixed speed throws less as the cap rises.
  it('is judged against the cap rather than an absolute speed', () => {
    expect(debrisBurstSize(20, 40, 8, 1)).toBeLessThan(debrisBurstSize(20, 20, 8, 1))
  })

  it('never exceeds the full spray above the cap', () => {
    expect(debrisBurstSize(500, 20, 8, 1)).toBe(8)
  })

  it('never drops below the floor', () => {
    expect(debrisBurstSize(-5, 20, 8, 2)).toBe(2)
  })

  it('survives a zero cap', () => {
    expect(debrisBurstSize(10, 0, 8, 1)).toBe(1)
  })
})

describe('debrisLifetime', () => {
  it('lives the full lifetime at the speed cap', () => {
    expect(debrisLifetime(20, 20, 0.4, 0.14)).toBeCloseTo(0.4)
  })

  it('falls to the floor at a standstill', () => {
    expect(debrisLifetime(0, 20, 0.4, 0.14)).toBeCloseTo(0.14)
  })

  // Linear rather than squared like the burst count: a trail that collapsed to
  // nothing by half speed read as the effect breaking rather than as slowing.
  it('sits halfway at half the cap', () => {
    expect(debrisLifetime(10, 20, 0.4, 0.14)).toBeCloseTo(0.27)
  })

  it.each([
    [-5, 0.14],
    [40, 0.4]
  ])('clamps speed %s to lifetime %s', (speed, expected) => {
    expect(debrisLifetime(speed, 20, 0.4, 0.14)).toBeCloseTo(expected)
  })

  it('returns the floor when there is no cap to ramp against', () => {
    expect(debrisLifetime(12, 0, 0.4, 0.14)).toBeCloseTo(0.14)
  })

  it('shortens the trail monotonically as the rock slows', () => {
    const lifetimes = [20, 15, 10, 5, 0].map((speed) => debrisLifetime(speed, 20, 0.4, 0.14))

    expect(lifetimes).toEqual([...lifetimes].sort((a, b) => b - a))
  })
})

describe('panel-driven motion limits', () => {
  // The panel edits these live, so the ramp has to be read from whatever it
  // currently holds rather than from the figures the run started with.
  it('ramps between whatever start and ceiling it is handed', () => {
    expect(speedCapAt(0, 10, 30, 1000)).toBeCloseTo(10)
    expect(speedCapAt(500, 10, 30, 1000)).toBeCloseTo(20)
    expect(speedCapAt(1000, 10, 30, 1000)).toBeCloseTo(30)
  })

  it('survives a ramp distance dragged to zero rather than dividing by it', () => {
    expect(Number.isFinite(speedCapAt(100, 10, 30, 0))).toBe(true)
  })

  it('grounds against the probe it is given, so a resized rock still lands', () => {
    expect(isGrounded(6, 0, 0, 6.5)).toBe(true)
    expect(isGrounded(6, 0, 0, 2.5)).toBe(false)
  })
})

describe('wallStandoff', () => {
  it('stops the rock a full radius short of the wall face', () => {
    expect(wallStandoff(16, 2.2)).toBeCloseTo(16 / 2 + WALL_INSET - 2.2)
  })

  it('never goes negative on a deck narrower than the rock', () => {
    expect(wallStandoff(2, 8)).toBe(0)
  })

  it('follows the deck width, which the panel can widen mid-run', () => {
    expect(wallStandoff(40, 2.2)).toBeGreaterThan(wallStandoff(16, 2.2))
  })
})

describe('lateralOffset', () => {
  const right = { x: 1, z: 0 }

  it.each([
    [5, 3, 2],
    [1, 3, -2],
    [3, 3, 0]
  ])('reads %s against a centre of %s as %s', (x, originX, expected) => {
    expect(lateralOffset({ x, z: 0 }, { x: originX, z: 0 }, right)).toBeCloseTo(expected)
  })
})

describe('steering into a wall', () => {
  const standoff = wallStandoff(16, ROCK_RADIUS)

  // A rock pinned to a wall never gains lateral speed, so the speed cap alone
  // let the game press into it at full force for as long as the key was held.
  // That force against the rock's grip is what stalled it at the track edge.
  it('stops pushing once the rock is already against the wall', () => {
    expect(
      steerImpulseMagnitude(1, 26, {
        lateralSpeed: 0,
        speedCap: 12,
        offset: standoff,
        standoff: standoff
      })
    ).toBe(0)
  })

  it('still steers while there is track left to cross', () => {
    expect(
      steerImpulseMagnitude(1, 26, {
        lateralSpeed: 0,
        speedCap: 12,
        offset: standoff - 1,
        standoff: standoff
      })
    ).toBe(26)
  })

  it('lets the rock steer back off the wall it is against', () => {
    expect(
      steerImpulseMagnitude(-1, 26, {
        lateralSpeed: 0,
        speedCap: 12,
        offset: standoff,
        standoff: standoff
      })
    ).toBe(-26)
  })

  it.each([
    [1, 'right'],
    [-1, 'left']
  ])('blocks the %s wall as well as the other', (steer) => {
    expect(
      steerImpulseMagnitude(steer, 26, {
        lateralSpeed: 0,
        speedCap: 12,
        offset: steer * standoff,
        standoff: standoff
      })
    ).toBe(0)
  })
})

describe('gravityScaleFor', () => {
  it('uses the rising gravity on the way up', () => {
    expect(gravityScaleFor(12, false, 1, 60)).toBe(1)
  })

  it('switches to the falling gravity past the apex', () => {
    expect(gravityScaleFor(-1, false, 1, 60)).toBe(60)
  })

  // A resting rock reads as very slightly descending. Pressing it into the deck
  // at tens of times gravity would drive its own grip hard enough to stall it,
  // which is the same failure the wall standoff exists to prevent.
  it.each([-0.01, -5, 0, 3])('never applies the falling gravity while grounded (vy %s)', (vy) => {
    expect(gravityScaleFor(vy, true, 1, 60)).toBe(1)
  })

  it('holds the rising gravity exactly at the apex, where velocity is zero', () => {
    expect(gravityScaleFor(0, false, 1, 60)).toBe(1)
  })

  it('is a no-op when both gravities match, so the split can be turned off', () => {
    expect(gravityScaleFor(-9, false, 4, 4)).toBe(4)
  })
})
