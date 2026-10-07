import { describe, it, expect } from 'vitest'
import { levelSeed, buildCorrectLanes, buildGate, buildRunGates } from './gateLayout'
import { LANE_COUNT, MAX_SAME_LANE_STREAK } from '../config'
import type { GateDeal, HintLevel, LevelWord } from '../types'

const caminante: LevelWord[] = [
  { text: 'caminante', gloss: 'traveller', decoys: ['caminando', 'camarero'] },
  { text: 'no', gloss: 'no', decoys: ['ni', 'nos'] },
  { text: 'hay', gloss: 'there is', decoys: ['ahí', 'ay'] },
  { text: 'camino', gloss: 'road', decoys: ['camina', 'cambio'] },
  { text: 'se', gloss: 'itself', decoys: ['sé', 'si'] },
  { text: 'hace', gloss: 'is made', decoys: ['hacia', 'nace'] },
  { text: 'camino', gloss: 'road', decoys: ['camisa', 'cambio'] },
  { text: 'al', gloss: 'by', decoys: ['el', 'a'] },
  { text: 'andar', gloss: 'walking', decoys: ['anda', 'mandar'] }
]

const deal = (
  words: LevelWord[],
  seed: number,
  laneCount: number,
  fallbackPool: string[]
): GateDeal => ({ words, seed, laneCount, fallbackPool })

const longestSameLaneStreak = (lanes: number[]): number =>
  lanes.reduce(
    (accumulator, lane, index) => {
      const streak = index > 0 && lanes[index - 1] === lane ? accumulator.streak + 1 : 1
      return { streak, longest: Math.max(accumulator.longest, streak) }
    },
    { streak: 0, longest: 0 }
  ).longest

describe('levelSeed', () => {
  it('gives the same seed for the same level id', () => {
    expect(levelSeed('caminante')).toBe(levelSeed('caminante'))
  })

  it('gives different seeds for different level ids', () => {
    expect(levelSeed('caminante')).not.toBe(levelSeed('verde'))
  })

  it('stays an unsigned 32-bit integer', () => {
    const seed = levelSeed('a phrase id long enough to overflow a naive hash many times over')

    expect(Number.isInteger(seed)).toBe(true)
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThan(2 ** 32)
  })
})

describe('buildCorrectLanes', () => {
  it('lays out the same path for the same seed', () => {
    expect(buildCorrectLanes(42, 20, LANE_COUNT)).toEqual(buildCorrectLanes(42, 20, LANE_COUNT))
  })

  it('returns one lane per word, each a valid lane', () => {
    const lanes = buildCorrectLanes(7, 30, LANE_COUNT)

    expect(lanes).toHaveLength(30)
    expect(lanes.every((lane) => Number.isInteger(lane) && lane >= 0 && lane < LANE_COUNT)).toBe(
      true
    )
  })

  it.each(Array.from({ length: 50 }, (_, seed) => [seed]))(
    'never repeats a lane more than the allowed streak (seed %i)',
    (seed) => {
      const lanes = buildCorrectLanes(seed, 40, LANE_COUNT)

      expect(longestSameLaneStreak(lanes)).toBeLessThanOrEqual(MAX_SAME_LANE_STREAK)
    }
  )

  it('puts a word on its preferred lane, the inside of the bend its gate opens onto', () => {
    const preferred = [0, null, 2, null, 0]

    const lanes = buildCorrectLanes(11, 5, LANE_COUNT, preferred)

    expect([lanes[0], lanes[2], lanes[4]]).toEqual([0, 2, 0])
  })

  it('lays out the same lanes as before wherever nothing is preferred', () => {
    expect(buildCorrectLanes(5, 12, LANE_COUNT, Array(12).fill(null))).toEqual(
      buildCorrectLanes(5, 12, LANE_COUNT)
    )
  })

  it('still never repeats a lane past the allowed streak, even when it is preferred', () => {
    const lanes = buildCorrectLanes(2, 6, LANE_COUNT, [0, 0, 0, 0, 0, 0])

    expect(longestSameLaneStreak(lanes)).toBeLessThanOrEqual(MAX_SAME_LANE_STREAK)
  })

  it('uses every lane over a long phrase', () => {
    const lanes = buildCorrectLanes(3, 40, LANE_COUNT)

    expect(new Set(lanes).size).toBe(LANE_COUNT)
  })
})

describe('buildGate', () => {
  it('puts the correct word in the correct lane', () => {
    const gate = buildGate(deal(caminante, 99, LANE_COUNT, []), 3, 2, 'full')

    expect(gate.options[2]).toBe('camino')
    expect(gate.correctLane).toBe(2)
    expect(gate.hint).toBe('full')
    expect(gate.position).toBe(3)
  })

  it('offers one word per lane, all different', () => {
    const gate = buildGate(deal(caminante, 5, LANE_COUNT, []), 0, 1, 'none')

    expect(gate.options).toHaveLength(LANE_COUNT)
    expect(new Set(gate.options).size).toBe(LANE_COUNT)
  })

  it.each(caminante.map((word, position) => [position, word.text]))(
    'never offers the correct word as a decoy (position %i, %s)',
    (position, text) => {
      const gate = buildGate(deal(caminante, 11, LANE_COUNT, []), position, 0, 'none')

      const decoys = gate.options.filter((_, lane) => lane !== gate.correctLane)

      expect(decoys).not.toContain(text)
    }
  )

  it('offers a later word of the text so knowing words out of order still fails', () => {
    const laterWords = caminante.slice(1).map((word) => word.text)

    const gate = buildGate(deal(caminante, 3, LANE_COUNT, []), 0, 0, 'none')

    expect(gate.options.slice(1).some((option) => laterWords.includes(option))).toBe(true)
  })

  it('offers one of the word’s own look-alikes', () => {
    const gate = buildGate(deal(caminante, 3, LANE_COUNT, []), 3, 0, 'none')

    expect(gate.options.slice(1).some((option) => ['camina', 'cambio'].includes(option))).toBe(true)
  })

  it('falls back to an earlier word on the last gate, where no later word exists', () => {
    const lastPosition = caminante.length - 1
    const earlierWords = caminante.slice(0, lastPosition).map((word) => word.text)

    const gate = buildGate(deal(caminante, 3, LANE_COUNT, []), lastPosition, 0, 'none')

    expect(gate.options.slice(1).some((option) => earlierWords.includes(option))).toBe(true)
  })

  it('treats an accented word as different from its plain spelling', () => {
    const words: LevelWord[] = [{ text: 'se', gloss: 'itself', decoys: ['sé'] }]

    const gate = buildGate(deal(words, 1, 2, []), 0, 0, 'none')

    expect(gate.options).toEqual(['se', 'sé'])
  })

  it('borrows from the fallback pool when the text runs out of decoys', () => {
    const words: LevelWord[] = [{ text: 'hola', gloss: 'hello', decoys: [] }]

    const gate = buildGate(deal(words, 1, LANE_COUNT, ['hola', 'adiós', 'gracias']), 0, 1, 'none')

    expect(gate.options[1]).toBe('hola')
    expect([...gate.options].sort()).toEqual(['adiós', 'gracias', 'hola'])
  })

  it('deals the same gate for the same seed', () => {
    expect(buildGate(deal(caminante, 8, LANE_COUNT, []), 4, 1, 'late')).toEqual(
      buildGate(deal(caminante, 8, LANE_COUNT, []), 4, 1, 'late')
    )
  })
})

describe('buildRunGates', () => {
  const seed = levelSeed('es-a1')
  const correctLanes = buildCorrectLanes(seed, caminante.length, LANE_COUNT)
  const hints: HintLevel[] = caminante.map((_, position) => (position < 3 ? 'full' : 'none'))

  it('builds one gate per word, in order, each in its lane and with its hint', () => {
    const gates = buildRunGates(deal(caminante, seed, LANE_COUNT, []), hints, correctLanes)

    expect(gates.map((gate) => gate.position)).toEqual(caminante.map((_, position) => position))
    expect(gates.map((gate) => gate.correctLane)).toEqual(correctLanes)
    expect(gates.map((gate) => gate.hint)).toEqual(hints)
    gates.forEach((gate) => {
      expect(gate.options[gate.correctLane]).toBe(caminante[gate.position].text)
    })
  })

  it('deals the same gates on every attempt, so the route can be learned', () => {
    const firstAttempt = buildRunGates(deal(caminante, seed, LANE_COUNT, []), hints, correctLanes)
    const secondAttempt = buildRunGates(deal(caminante, seed, LANE_COUNT, []), hints, correctLanes)

    expect(secondAttempt).toEqual(firstAttempt)
  })
})
