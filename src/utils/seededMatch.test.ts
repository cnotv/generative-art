import { describe, it, expect } from 'vitest'
import {
  createMatchSeed,
  rankMatchResults,
  remainingPlayerIds,
  isLastSurvivor,
  upsertMatchResult
} from './seededMatch'
import type { MatchResult } from '@/types/seededMatch'

const result = (playerId: string, score: number, eliminatedAt: number | null): MatchResult => ({
  playerId,
  score,
  eliminatedAt
})

describe('createMatchSeed', () => {
  it.each([
    [0, 0],
    [0.5, 1_073_741_824],
    [0.999_999_999, 2_147_483_645]
  ])('turns a random value of %f into a positive integer seed', (randomValue, expected) => {
    // Act
    const seed = createMatchSeed(() => randomValue)

    // Assert
    expect(seed).toBe(expected)
    expect(Number.isInteger(seed)).toBe(true)
  })
})

describe('rankMatchResults', () => {
  it('ranks survivors above eliminated players, by score', () => {
    // Arrange
    const results = [result('a', 900, 1000), result('b', 100, null), result('c', 300, null)]

    // Act
    const ranking = rankMatchResults(results)

    // Assert
    expect(ranking.map((entry) => entry.playerId)).toEqual(['c', 'b', 'a'])
  })

  it('ranks players knocked out later above those knocked out earlier', () => {
    // Arrange
    const results = [result('a', 500, 1000), result('b', 100, 3000), result('c', 900, 2000)]

    // Act
    const ranking = rankMatchResults(results)

    // Assert
    expect(ranking.map((entry) => entry.playerId)).toEqual(['b', 'c', 'a'])
  })

  it('breaks a tie in knockout time by score', () => {
    // Arrange
    const results = [result('a', 100, 1000), result('b', 400, 1000)]

    // Act
    const ranking = rankMatchResults(results)

    // Assert
    expect(ranking.map((entry) => entry.playerId)).toEqual(['b', 'a'])
  })

  it('does not reorder the input array', () => {
    // Arrange
    const results = [result('a', 1, 10), result('b', 2, null)]

    // Act
    rankMatchResults(results)

    // Assert
    expect(results.map((entry) => entry.playerId)).toEqual(['a', 'b'])
  })
})

describe('remainingPlayerIds', () => {
  it('lists the players who have not reported a result yet', () => {
    // Arrange
    const results = [result('b', 10, 500)]

    // Act
    const remaining = remainingPlayerIds(['a', 'b', 'c'], results)

    // Assert
    expect(remaining).toEqual(['a', 'c'])
  })
})

describe('isLastSurvivor', () => {
  it.each([
    ['the only player left of two', ['me', 'rival'], [result('rival', 5, 100)], 2, true],
    ['left alone after the rival quit', ['me'], [], 2, true],
    ['a solo player', ['me'], [], 1, false],
    ['a player who already reported', ['me', 'rival'], [result('me', 1, null)], 2, false],
    ['one of two players still going', ['me', 'a', 'b'], [result('a', 5, 100)], 3, false]
  ])('is %s: %j', (_label, playerIds, results, rosterSize, expected) => {
    // Act
    const survivor = isLastSurvivor(playerIds, results, 'me', rosterSize)

    // Assert
    expect(survivor).toBe(expected)
  })
})

describe('upsertMatchResult', () => {
  it('adds a new result', () => {
    // Act
    const results = upsertMatchResult([], result('a', 10, null))

    // Assert
    expect(results).toEqual([result('a', 10, null)])
  })

  it('replaces the earlier result from the same player', () => {
    // Arrange
    const results = [result('a', 10, 100), result('b', 5, null)]

    // Act
    const updated = upsertMatchResult(results, result('a', 40, null))

    // Assert
    expect(updated).toEqual([result('b', 5, null), result('a', 40, null)])
  })
})
