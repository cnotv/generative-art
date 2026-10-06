import { describe, it, expect, beforeEach } from 'vitest'
import { parseBestTimes, loadBestTime, saveBestTime, formatRunTime } from './bestTimes'

describe('parseBestTimes', () => {
  it.each([
    [null, {}],
    ['', {}],
    ['not json', {}],
    ['[1, 2]', {}],
    ['"text"', {}],
    ['{"caminante": 61.5, "verde": 40}', { caminante: 61.5, verde: 40 }],
    ['{"caminante": 61.5, "bad": "fast", "worse": -3, "nan": null}', { caminante: 61.5 }]
  ])('reads %j as %j', (raw, expected) => {
    expect(parseBestTimes(raw)).toEqual(expected)
  })
})

describe('loadBestTime and saveBestTime', () => {
  beforeEach(() => localStorage.clear())

  it('has no best time for a phrase never finished', () => {
    expect(loadBestTime('caminante')).toBeNull()
  })

  it('keeps each phrase its own best time', () => {
    saveBestTime('caminante', 72.25)
    saveBestTime('verde', 31)

    expect(loadBestTime('caminante')).toBe(72.25)
    expect(loadBestTime('verde')).toBe(31)
  })
})

describe('formatRunTime', () => {
  it.each([
    [0, '0:00.0'],
    [4.36, '0:04.3'],
    [59.99, '0:59.9'],
    [64.3, '1:04.3'],
    [600, '10:00.0']
  ])('shows %f seconds as %s', (seconds, expected) => {
    expect(formatRunTime(seconds)).toBe(expected)
  })
})
