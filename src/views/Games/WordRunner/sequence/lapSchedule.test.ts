import { describe, it, expect } from 'vitest'
import { splitIntoChunks, buildLapSchedule, buildRetryLap } from './lapSchedule'
import type { Lap } from '../types'

const hintsOf = (lap: Lap) => lap.words.map((word) => word.hint)
const positionsOf = (lap: Lap) => lap.words.map((word) => word.position)

describe('splitIntoChunks', () => {
  it.each([
    [0, 3, []],
    [2, 3, [[0, 1]]],
    [3, 3, [[0, 1, 2]]],
    [
      6,
      3,
      [
        [0, 1, 2],
        [3, 4, 5]
      ]
    ],
    [
      8,
      3,
      [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7]
      ]
    ],
    [
      7,
      3,
      [
        [0, 1, 2],
        [3, 4, 5, 6]
      ]
    ]
  ])('splits %i words into chunks of %i as %j', (wordCount, chunkSize, expected) => {
    const chunks = splitIntoChunks(wordCount, chunkSize)

    expect(chunks).toEqual(expected)
  })
})

describe('buildLapSchedule', () => {
  it('returns no laps for an empty phrase', () => {
    expect(buildLapSchedule(0, 3)).toEqual([])
  })

  it('builds the nine-word schedule chunk by chunk, then tests the whole phrase', () => {
    const laps = buildLapSchedule(9, 3)

    expect(laps.map(positionsOf)).toEqual([
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2, 3, 4, 5],
      [0, 1, 2, 3, 4, 5],
      [0, 1, 2, 3, 4, 5, 6, 7, 8],
      [0, 1, 2, 3, 4, 5, 6, 7, 8],
      [0, 1, 2, 3, 4, 5, 6, 7, 8],
      [0, 1, 2, 3, 4, 5, 6, 7, 8]
    ])
    expect(laps.map(hintsOf)).toEqual([
      ['full', 'full', 'full'],
      ['late', 'late', 'late'],
      ['none', 'none', 'none', 'full', 'full', 'full'],
      ['none', 'none', 'none', 'late', 'late', 'late'],
      ['none', 'none', 'none', 'none', 'none', 'none', 'full', 'full', 'full'],
      ['none', 'none', 'none', 'none', 'none', 'none', 'late', 'late', 'late'],
      Array(9).fill('none'),
      Array(9).fill('none')
    ])
  })

  it('shuffles only the final lap', () => {
    const laps = buildLapSchedule(9, 3)

    expect(laps.map((lap) => lap.shuffled)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true
    ])
  })

  it('tags each word with the chunk it belongs to', () => {
    const [, , thirdLap] = buildLapSchedule(6, 3)

    expect(thirdLap.words.map((word) => word.chunk)).toEqual([0, 0, 0, 1, 1, 1])
  })

  it('schedules every lap as a first attempt', () => {
    const laps = buildLapSchedule(9, 3)

    expect(laps.every((lap) => lap.attempt === 0)).toBe(true)
  })

  it('still ends with a plain and a shuffled lap when the phrase fits in one chunk', () => {
    const laps = buildLapSchedule(2, 3)

    expect(laps.map(hintsOf)).toEqual([
      ['full', 'full'],
      ['late', 'late'],
      ['none', 'none'],
      ['none', 'none']
    ])
    expect(laps.map((lap) => lap.shuffled)).toEqual([false, false, false, true])
  })
})

describe('buildRetryLap', () => {
  const failedLap: Lap = {
    shuffled: false,
    attempt: 0,
    words: [
      { position: 0, chunk: 0, hint: 'none' },
      { position: 1, chunk: 0, hint: 'none' },
      { position: 2, chunk: 1, hint: 'late' },
      { position: 3, chunk: 1, hint: 'late' },
      { position: 4, chunk: 2, hint: 'full' }
    ]
  }

  it('raises the hints of every chunk that held a mistake by one step', () => {
    const retry = buildRetryLap(failedLap, [1, 2, 4])

    expect(hintsOf(retry)).toEqual(['late', 'late', 'full', 'full', 'full'])
  })

  it('leaves the hints of clean chunks alone', () => {
    const retry = buildRetryLap(failedLap, [3])

    expect(hintsOf(retry)).toEqual(['none', 'none', 'full', 'full', 'full'])
  })

  it('counts the attempt and keeps the lap shuffled if it was', () => {
    const retry = buildRetryLap({ ...failedLap, shuffled: true, attempt: 1 }, [0])

    expect(retry.attempt).toBe(2)
    expect(retry.shuffled).toBe(true)
  })

  it('does not change the lap it was built from', () => {
    buildRetryLap(failedLap, [0])

    expect(hintsOf(failedLap)).toEqual(['none', 'none', 'late', 'late', 'full'])
  })
})
