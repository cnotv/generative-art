import { describe, it, expect } from 'vitest'
import { applyOutcome, createRacer, followRacer, stepRacer } from './racer'
import { ROUTE_EFFECTS } from '../config'
import type { LaneOutcome, Racer } from '../types'

const FRAME = 1 / 60
const SPEED = 10

const step = (racer: Racer, elapsedSeconds: number, finishDistance = 1000): Racer =>
  stepRacer(racer, { baseSpeed: SPEED, deltaSeconds: FRAME, elapsedSeconds, finishDistance })

/** Runs a racer to the finish, applying each outcome as it reaches that outcome's distance. */
const raceTo = (finishDistance: number, outcomes: Array<[number, LaneOutcome]>): number => {
  const frames = Array.from({ length: 60 * 600 }, (_, frame) => frame)
  const finished = frames.reduce(
    (state, frame) => {
      if (state.racer.finishSeconds !== null) return state
      const pending = outcomes.filter(
        ([distance], index) => index >= state.nextOutcome && distance <= state.racer.distance
      )
      const racer = pending.reduce(
        (current, [, outcome]) => applyOutcome(current, outcome),
        state.racer
      )
      return {
        racer: stepRacer(racer, {
          baseSpeed: SPEED,
          deltaSeconds: FRAME,
          elapsedSeconds: (frame + 1) * FRAME,
          finishDistance
        }),
        nextOutcome: state.nextOutcome + pending.length
      }
    },
    { racer: createRacer(), nextOutcome: 0 }
  )
  return finished.racer.finishSeconds ?? Number.POSITIVE_INFINITY
}

describe('stepRacer', () => {
  it('rolls forward at the base speed with nothing slowing it', () => {
    const racer = step(createRacer(), FRAME)

    expect(racer.distance).toBeCloseTo(SPEED * FRAME)
  })

  it('stops on the finish line and remembers when it got there', () => {
    const nearlyThere = { ...createRacer(), distance: 999.99 }

    const finished = step(nearlyThere, 42, 1000)

    expect(finished.distance).toBe(1000)
    expect(finished.finishSeconds).toBe(42)
    expect(step(finished, 43, 1000)).toEqual(finished)
  })

  it('runs slower while a stumble lasts, and wears it off', () => {
    const stumbling = applyOutcome(createRacer(), 'stumble')

    const moved = step(stumbling, FRAME)

    expect(moved.distance).toBeLessThan(SPEED * FRAME)
    expect(moved.effect?.remaining).toBeCloseTo(ROUTE_EFFECTS.stumble.seconds - FRAME)
  })

  it('hops off a ramp when boosted', () => {
    expect(applyOutcome(createRacer(), 'boost').hopRemaining).toBeGreaterThan(0)
  })

  it('keeps whatever effect it had for a lane that changes nothing', () => {
    const stumbling = applyOutcome(createRacer(), 'stumble')

    expect(applyOutcome(stumbling, 'none')).toEqual(stumbling)
  })
})

describe('a race', () => {
  const gateDistances = Array.from({ length: 30 }, (_, gate) => 30 + gate * 20)

  it('is won by the ball that takes the right words', () => {
    const rightEverywhere = gateDistances.map((distance, gate): [number, LaneOutcome] => [
      distance,
      gate % 2 === 0 ? 'boost' : 'none'
    ])
    const wrongOnAThird = gateDistances.map((distance, gate): [number, LaneOutcome] => [
      distance,
      gate % 3 === 0 ? 'stumble' : 'none'
    ])

    expect(raceTo(650, rightEverywhere)).toBeLessThan(raceTo(650, wrongOnAThird))
  })
})

describe('followRacer', () => {
  const follow = { deltaSeconds: FRAME, elapsedSeconds: 3, finishDistance: 1000 }

  it('takes its distance from the ball it follows, not from a speed', () => {
    expect(followRacer(createRacer(), 42, follow).distance).toBe(42)
  })

  it('wears its effect off as time passes', () => {
    const stumbling = applyOutcome(createRacer(), 'stumble')

    expect(followRacer(stumbling, 10, follow).effect?.remaining).toBeCloseTo(
      ROUTE_EFFECTS.stumble.seconds - FRAME
    )
  })

  it('finishes on the line and stays finished there', () => {
    const finished = followRacer(createRacer(), 1003, follow)

    expect(finished.distance).toBe(1000)
    expect(finished.finishSeconds).toBe(3)
    expect(followRacer(finished, 1010, { ...follow, elapsedSeconds: 4 })).toEqual(finished)
  })
})
