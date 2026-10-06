import { describe, it, expect } from 'vitest'
import {
  insideLaneFor,
  chooseRouteFeature,
  laneOutcome,
  startEffect,
  tickEffect,
  effectSpeedRatio
} from './routeAdvantage'
import { ROUTE_EFFECTS } from '../config'

describe('insideLaneFor', () => {
  it.each([
    [0.05, 0.02, 0],
    [-0.05, 0.02, 2],
    [0.01, 0.02, null],
    [-0.019, 0.02, null]
  ])(
    'a heading turning at %f rad per unit (threshold %f) has its inside on lane %s',
    (yawRate, threshold, expected) => {
      expect(insideLaneFor(yawRate, threshold, 3)).toBe(expected)
    }
  )
})

describe('chooseRouteFeature', () => {
  it('makes the gate a bend when the right word is on the inside of a curve', () => {
    expect(chooseRouteFeature(4, 0, 0)).toBe('bend')
  })

  it.each([
    [0, 1, null, 'ramp'],
    [1, 1, null, 'rocks'],
    [2, 0, 2, 'ramp'],
    [3, 2, 0, 'rocks']
  ] as const)(
    'gate %i with the right word on lane %i and the inside on %s is %s',
    (position, correctLane, insideLane, expected) => {
      expect(chooseRouteFeature(position, correctLane, insideLane)).toBe(expected)
    }
  )

  it('gives a word the same feature every time it is laid out the same way', () => {
    expect(chooseRouteFeature(6, 1, null)).toBe(chooseRouteFeature(6, 1, null))
  })
})

describe('laneOutcome', () => {
  it.each([
    ['ramp', 1, 1, 'boost'],
    ['ramp', 0, 1, 'none'],
    ['rocks', 2, 2, 'none'],
    ['rocks', 0, 2, 'stumble'],
    ['bend', 0, 0, 'none'],
    ['bend', 2, 0, 'wide']
  ] as const)(
    'on a %s gate, lane %i with the right word on lane %i gives %s',
    (feature, lane, correctLane, expected) => {
      expect(laneOutcome(feature, lane, correctLane)).toBe(expected)
    }
  )
})

describe('speed effects', () => {
  it('runs at full speed with no effect', () => {
    expect(effectSpeedRatio(null)).toBe(1)
  })

  it.each(['boost', 'stumble', 'wide'] as const)(
    'a fresh %s effect runs at its own ratio',
    (outcome) => {
      const effect = startEffect(outcome)

      expect(effectSpeedRatio(effect)).toBeCloseTo(ROUTE_EFFECTS[outcome].ratio)
    }
  )

  it('wears off linearly back to full speed', () => {
    const effect = startEffect('stumble')
    const halfway = tickEffect(effect, ROUTE_EFFECTS.stumble.seconds / 2)

    expect(effectSpeedRatio(halfway)).toBeCloseTo((1 + ROUTE_EFFECTS.stumble.ratio) / 2)
  })

  it('is gone once its time has run out', () => {
    const effect = startEffect('boost')

    expect(tickEffect(effect, ROUTE_EFFECTS.boost.seconds + 0.1)).toBeNull()
  })

  it('has no effect for a lane that changes nothing', () => {
    expect(startEffect('none')).toBeNull()
  })
})
