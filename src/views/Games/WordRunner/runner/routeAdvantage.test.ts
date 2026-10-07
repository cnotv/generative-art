import { describe, it, expect } from 'vitest'
import {
  insideLaneFor,
  chooseRouteFeature,
  laneOutcome,
  revealedPiece,
  startEffect,
  tickEffect,
  effectSpeedRatio,
  yawRateBetween,
  insideLanesAlong
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
    ['ramp', 0, 1, 'miss'],
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

  it.each(['boost', 'stumble', 'wide', 'miss'] as const)(
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

describe('yawRateBetween', () => {
  it('is the change in heading per unit of track over the stretch', () => {
    const yawAt = (distance: number) => distance * 0.03

    expect(yawRateBetween(yawAt, 10, 20)).toBeCloseTo(0.03)
  })

  it('is zero on a straight', () => {
    expect(yawRateBetween(() => 1.2, 0, 40)).toBe(0)
  })

  it('is negative on a bend to the right', () => {
    expect(yawRateBetween((distance) => -distance * 0.02, 5, 15)).toBeLessThan(0)
  })
})

describe('insideLanesAlong', () => {
  it('finds the inside lane of the stretch after each gate, or none on a straight', () => {
    const yawAt = (distance: number) => {
      if (distance < 50) return 0
      if (distance < 100) return (distance - 50) * 0.03
      return 1.5 - (distance - 100) * 0.03
    }

    const insideLanes = insideLanesAlong(yawAt, [10, 60, 110], 20, 0.01, 3)

    expect(insideLanes).toEqual([null, 0, 2])
  })
})

describe('revealedPiece', () => {
  it.each([
    ['ramp', 1, 1, 'ramp'],
    ['ramp', 0, 1, 'gravel'],
    ['rocks', 2, 2, null],
    ['rocks', 0, 2, 'rock'],
    ['bend', 0, 0, null],
    ['bend', 2, 0, 'gravel']
  ] as const)(
    'on a %s gate, lane %i with the right word on lane %i reveals %s',
    (feature, lane, correctLane, expected) => {
      expect(revealedPiece(feature, lane, correctLane)).toBe(expected)
    }
  )

  it('reveals exactly what the lane does: something to slow it, or the ramp that speeds it', () => {
    const outcomes = (['ramp', 'rocks', 'bend'] as const).flatMap((feature) =>
      [0, 1].map((lane) => [laneOutcome(feature, lane, 1), revealedPiece(feature, lane, 1)])
    )

    outcomes.forEach(([outcome, piece]) => {
      expect(piece === null).toBe(outcome === 'none')
    })
  })
})
