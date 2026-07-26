import { describe, it, expect } from 'vitest'
import { createTrackPath, evaluateTerms, forwardFromYaw, rightFromYaw } from './trackPath'
import { STATION_SPACING, CURVE_TERMS, HILL_TERMS } from './config'

describe('evaluateTerms', () => {
  it('returns zero for no terms', () => {
    expect(evaluateTerms([], [], 123)).toBe(0)
  })

  it('sums each term at its own wavelength', () => {
    const terms = [
      { amplitude: 2, wavelength: 4 },
      { amplitude: 3, wavelength: 8 }
    ]

    const value = evaluateTerms(terms, [0, 0], 1)

    expect(value).toBeCloseTo(2 * Math.sin(Math.PI / 2) + 3 * Math.sin(Math.PI / 4))
  })

  it('stays within the summed amplitudes', () => {
    const samples = Array.from({ length: 400 }, (_, index) =>
      evaluateTerms(CURVE_TERMS, [0.3, 1.1, 2.4], index * 7)
    )
    const bound = CURVE_TERMS.reduce((total, term) => total + term.amplitude, 0)

    expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(bound)
  })
})

describe('forwardFromYaw / rightFromYaw', () => {
  it.each([
    [0, [0, 0, -1], [1, 0, 0]],
    [Math.PI / 2, [-1, 0, 0], [0, 0, -1]],
    [Math.PI, [0, 0, 1], [-1, 0, 0]]
  ])('yaw %f points forward %j and right %j', (yaw, expectedForward, expectedRight) => {
    const forward = forwardFromYaw(yaw).toArray()
    const right = rightFromYaw(yaw).toArray()

    forward.forEach((value, axis) => expect(value).toBeCloseTo(expectedForward[axis]))
    right.forEach((value, axis) => expect(value).toBeCloseTo(expectedRight[axis]))
  })

  it('keeps forward and right perpendicular and unit length', () => {
    const yaw = 0.83
    const forward = forwardFromYaw(yaw)
    const right = rightFromYaw(yaw)

    expect(forward.length()).toBeCloseTo(1)
    expect(right.length()).toBeCloseTo(1)
    expect(forward.dot(right)).toBeCloseTo(0)
  })
})

describe('createTrackPath', () => {
  it('produces an identical path for the same seed', () => {
    const first = createTrackPath(1234)
    const second = createTrackPath(1234)

    const firstStations = first.stationsBetween(0, 40).map((station) => station.origin.toArray())
    const secondStations = second.stationsBetween(0, 40).map((station) => station.origin.toArray())

    expect(firstStations).toEqual(secondStations)
  })

  it('produces a different path for a different seed', () => {
    const first = createTrackPath(1)
    const second = createTrackPath(2)

    expect(first.stationAt(30).origin.toArray()).not.toEqual(second.stationAt(30).origin.toArray())
  })

  it('starts at the origin in the horizontal plane', () => {
    const path = createTrackPath(7)
    const start = path.stationAt(0).origin

    expect(start.x).toBe(0)
    expect(start.z).toBe(0)
  })

  it('advances one station spacing horizontally per station', () => {
    const path = createTrackPath(99)
    const stations = path.stationsBetween(0, 60)

    const gaps = stations.slice(1).map((station, index) => {
      const previous = stations[index].origin
      return Math.hypot(station.origin.x - previous.x, station.origin.z - previous.z)
    })

    gaps.forEach((gap) => expect(gap).toBeCloseTo(STATION_SPACING))
  })

  it('keeps height within the summed hill amplitudes', () => {
    const path = createTrackPath(4242)
    const bound = HILL_TERMS.reduce((total, term) => total + term.amplitude, 0)

    const heights = path.stationsBetween(0, 300).map((station) => station.origin.y)

    expect(Math.max(...heights.map(Math.abs))).toBeLessThanOrEqual(bound)
  })

  it('turns gently enough to steer through', () => {
    const path = createTrackPath(31337)
    const stations = path.stationsBetween(0, 400)

    const turns = stations.slice(1).map((station, index) => {
      const previous = stations[index].origin
      return Math.atan2(station.origin.x - previous.x, -(station.origin.z - previous.z))
    })
    const deltas = turns
      .slice(1)
      .map((turn, index) =>
        Math.abs(Math.atan2(Math.sin(turn - turns[index]), Math.cos(turn - turns[index])))
      )

    expect(Math.max(...deltas)).toBeLessThan(0.25)
  })

  it('grows the station cache monotonically when sampled out of order', () => {
    const path = createTrackPath(5)
    const far = path.stationAt(200).origin.clone()

    path.stationAt(3)

    expect(path.stationAt(200).origin.toArray()).toEqual(far.toArray())
  })

  it('samples between stations', () => {
    const path = createTrackPath(11)
    const sample = path.sampleAt(STATION_SPACING * 2.5)
    const before = path.stationAt(2).origin
    const after = path.stationAt(3).origin

    expect(sample.position.x).toBeCloseTo((before.x + after.x) / 2)
    expect(sample.position.z).toBeCloseTo((before.z + after.z) / 2)
  })

  it('maps distance to the containing station index', () => {
    const path = createTrackPath(11)

    expect(path.indexAt(0)).toBe(0)
    expect(path.indexAt(STATION_SPACING - 0.001)).toBe(0)
    expect(path.indexAt(STATION_SPACING)).toBe(1)
    expect(path.indexAt(STATION_SPACING * 10.5)).toBe(10)
  })
})
