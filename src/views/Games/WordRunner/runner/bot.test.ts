import { describe, it, expect } from 'vitest'
import { planBotLanes } from './bot'
import type { Gate } from '../types'

const gates: Gate[] = Array.from({ length: 200 }, (_, position) => ({
  position,
  options: ['a', 'b', 'c'],
  correctLane: position % 3,
  hint: 'none'
}))

const randomValues = (count: number, seed: number): number[] =>
  Array.from({ length: count }, (_, index) => ((index * 7919 + seed * 104729) % 1000) / 1000)

describe('planBotLanes', () => {
  it('takes one lane per gate, each a valid lane', () => {
    const lanes = planBotLanes(gates, 0.7, randomValues(gates.length * 2, 1), 3)

    expect(lanes).toHaveLength(gates.length)
    lanes.forEach((lane) => {
      expect(lane).toBeGreaterThanOrEqual(0)
      expect(lane).toBeLessThan(3)
    })
  })

  it.each([
    [1, 1],
    [0, 0]
  ])('with accuracy %f is right on a share %f of the gates', (accuracy, share) => {
    const lanes = planBotLanes(gates, accuracy, randomValues(gates.length * 2, 3), 3)

    const rightCount = lanes.filter((lane, index) => lane === gates[index].correctLane).length

    expect(rightCount / gates.length).toBe(share)
  })

  it('is right about as often as its accuracy says', () => {
    const lanes = planBotLanes(gates, 0.7, randomValues(gates.length * 2, 5), 3)

    const rightCount = lanes.filter((lane, index) => lane === gates[index].correctLane).length

    expect(rightCount / gates.length).toBeGreaterThan(0.6)
    expect(rightCount / gates.length).toBeLessThan(0.8)
  })

  it('plans the same run from the same random values', () => {
    const values = randomValues(gates.length * 2, 9)

    expect(planBotLanes(gates, 0.7, values, 3)).toEqual(planBotLanes(gates, 0.7, values, 3))
  })
})
