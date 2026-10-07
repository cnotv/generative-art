import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { inRankingOrder, useSteadyRanking } from './useSteadyRanking'

const HOLD_SECONDS = 0.2
const players = (...ids: string[]) => ids.map((id) => ({ id }))

const rankingOf = (initial: string[]) => {
  const live = ref(players(...initial))
  const scope = effectScope()
  const order = scope.run(() => useSteadyRanking(() => live.value, HOLD_SECONDS))
  if (!order) throw new Error('The ranking did not start')
  return { live, order, stop: () => scope.stop() }
}

describe('inRankingOrder', () => {
  it('lists players in the order given, newcomers after them', () => {
    // Act
    const listed = inRankingOrder(players('a', 'b', 'c'), ['c', 'a'])

    // Assert
    expect(listed.map((player) => player.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('useSteadyRanking', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows a new order only once it has held for the hold time', async () => {
    // Arrange
    const { live, order, stop } = rankingOf(['a', 'b'])

    // Act
    live.value = players('b', 'a')
    await nextTick()
    const before = [...order.value]
    vi.advanceTimersByTime(HOLD_SECONDS * 1000)

    // Assert
    expect(before).toEqual(['a', 'b'])
    expect(order.value).toEqual(['b', 'a'])
    stop()
  })

  it('keeps the shown order while two players keep swapping', async () => {
    // Arrange
    const { live, order, stop } = rankingOf(['a', 'b'])

    // Act
    await Array.from({ length: 6 }).reduce<Promise<void>>(async (previous, _, index) => {
      await previous
      live.value = index % 2 === 0 ? players('b', 'a') : players('a', 'b')
      await nextTick()
      vi.advanceTimersByTime(100)
    }, Promise.resolve())

    // Assert
    expect(order.value).toEqual(['a', 'b'])
    stop()
  })

  it('takes a player joining or leaving at once', async () => {
    // Arrange
    const { live, order, stop } = rankingOf(['a', 'b'])

    // Act
    live.value = players('c', 'a', 'b')
    await nextTick()

    // Assert
    expect(order.value).toEqual(['c', 'a', 'b'])
    stop()
  })
})
