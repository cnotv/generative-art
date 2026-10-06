import { describe, it, expect } from 'vitest'
import {
  phraseSeed,
  buildCorrectLanes,
  buildShuffledLanes,
  buildGate,
  buildLapGates
} from './gateLayout'
import { LANE_COUNT, MAX_SAME_LANE_STREAK } from '../config'
import spanishPack from '../phrases/es.json'
import type { GateDeal, LanguagePack, Lap, Phrase } from '../types'

const pack: LanguagePack = spanishPack
const [caminante] = pack.phrases

const deal = (
  phrase: Phrase,
  seed: number,
  laneCount: number,
  fallbackPool: string[]
): GateDeal => ({
  phrase,
  seed,
  laneCount,
  fallbackPool
})

const longestSameLaneStreak = (lanes: number[]): number =>
  lanes.reduce(
    (accumulator, lane, index) => {
      const streak = index > 0 && lanes[index - 1] === lane ? accumulator.streak + 1 : 1
      return { streak, longest: Math.max(accumulator.longest, streak) }
    },
    { streak: 0, longest: 0 }
  ).longest

describe('phraseSeed', () => {
  it('gives the same seed for the same phrase id', () => {
    expect(phraseSeed('caminante')).toBe(phraseSeed('caminante'))
  })

  it('gives different seeds for different phrase ids', () => {
    expect(phraseSeed('caminante')).not.toBe(phraseSeed('verde'))
  })

  it('stays an unsigned 32-bit integer', () => {
    const seed = phraseSeed('a phrase id long enough to overflow a naive hash many times over')

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

describe('buildShuffledLanes', () => {
  it.each(Array.from({ length: 20 }, (_, seed) => [seed]))(
    'moves every correct word off its usual lane (seed %i)',
    (seed) => {
      const usualLanes = buildCorrectLanes(seed, 12, LANE_COUNT)

      const shuffledLanes = buildShuffledLanes(seed, usualLanes, LANE_COUNT)

      shuffledLanes.forEach((lane, position) => {
        expect(lane).not.toBe(usualLanes[position])
        expect(lane).toBeGreaterThanOrEqual(0)
        expect(lane).toBeLessThan(LANE_COUNT)
      })
    }
  )
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

  it.each(caminante.words.map((word, position) => [position, word.text]))(
    'never offers the correct word as a decoy (position %i, %s)',
    (position, text) => {
      const gate = buildGate(deal(caminante, 11, LANE_COUNT, []), position, 0, 'none')

      const decoys = gate.options.filter((_, lane) => lane !== gate.correctLane)

      expect(decoys).not.toContain(text)
    }
  )

  it('offers a later word of the phrase so knowing words out of order still fails', () => {
    const laterWords = caminante.words.slice(1).map((word) => word.text)

    const gate = buildGate(deal(caminante, 3, LANE_COUNT, []), 0, 0, 'none')

    expect(gate.options.slice(1).some((option) => laterWords.includes(option))).toBe(true)
  })

  it('offers one of the word’s own look-alikes', () => {
    const gate = buildGate(deal(caminante, 3, LANE_COUNT, []), 3, 0, 'none')

    expect(gate.options.slice(1).some((option) => ['camina', 'cambio'].includes(option))).toBe(true)
  })

  it('falls back to an earlier word on the last gate, where no later word exists', () => {
    const lastPosition = caminante.words.length - 1
    const earlierWords = caminante.words.slice(0, lastPosition).map((word) => word.text)

    const gate = buildGate(deal(caminante, 3, LANE_COUNT, []), lastPosition, 0, 'none')

    expect(gate.options.slice(1).some((option) => earlierWords.includes(option))).toBe(true)
  })

  it('treats an accented word as different from its plain spelling', () => {
    const phrase: Phrase = {
      id: 'accent',
      title: 'accent',
      translation: '',
      words: [{ text: 'se', gloss: 'itself', decoys: ['sé'] }]
    }

    const gate = buildGate(deal(phrase, 1, 2, []), 0, 0, 'none')

    expect(gate.options).toEqual(['se', 'sé'])
  })

  it('borrows from the fallback pool when the phrase runs out of decoys', () => {
    const phrase: Phrase = {
      id: 'tiny',
      title: 'tiny',
      translation: '',
      words: [{ text: 'hola', gloss: 'hello', decoys: [] }]
    }

    const gate = buildGate(deal(phrase, 1, LANE_COUNT, ['hola', 'adiós', 'gracias']), 0, 1, 'none')

    expect(gate.options[1]).toBe('hola')
    expect([...gate.options].sort()).toEqual(['adiós', 'gracias', 'hola'])
  })

  it('deals the same gate for the same seed', () => {
    expect(buildGate(deal(caminante, 8, LANE_COUNT, []), 4, 1, 'late')).toEqual(
      buildGate(deal(caminante, 8, LANE_COUNT, []), 4, 1, 'late')
    )
  })
})

describe('buildLapGates', () => {
  const lap: Lap = {
    shuffled: false,
    attempt: 0,
    words: [
      { position: 0, chunk: 0, hint: 'full' },
      { position: 1, chunk: 0, hint: 'late' },
      { position: 2, chunk: 0, hint: 'none' }
    ]
  }
  const seed = phraseSeed(caminante.id)
  const correctLanes = buildCorrectLanes(seed, caminante.words.length, LANE_COUNT)
  const caminanteDeal = deal(caminante, seed, LANE_COUNT, [])

  it('builds one gate per lap word, in order, with that word’s hint', () => {
    const gates = buildLapGates(caminanteDeal, lap, 0, correctLanes)

    expect(gates.map((gate) => gate.position)).toEqual([0, 1, 2])
    expect(gates.map((gate) => gate.hint)).toEqual(['full', 'late', 'none'])
  })

  it('keeps every gate identical from one lap to the next', () => {
    const firstLap = buildLapGates(caminanteDeal, lap, 0, correctLanes)
    const fourthLap = buildLapGates(caminanteDeal, lap, 3, correctLanes)

    expect(fourthLap).toEqual(firstLap)
  })

  it('uses the usual lanes on a plain lap', () => {
    const gates = buildLapGates(caminanteDeal, lap, 0, correctLanes)

    expect(gates.map((gate) => gate.correctLane)).toEqual(correctLanes.slice(0, 3))
  })

  it('moves every correct word off its usual lane on a shuffled lap', () => {
    const gates = buildLapGates(caminanteDeal, { ...lap, shuffled: true }, 7, correctLanes)

    gates.forEach((gate) => {
      expect(gate.correctLane).not.toBe(correctLanes[gate.position])
      expect(gate.options[gate.correctLane]).toBe(caminante.words[gate.position].text)
    })
  })
})

describe('the Spanish language pack', () => {
  it.each(pack.phrases.map((phrase) => [phrase.id, phrase]))(
    '%s has words, and no word is its own decoy',
    (_, phrase) => {
      expect(phrase.words.length).toBeGreaterThan(0)
      phrase.words.forEach((word) => {
        expect(word.text.trim()).not.toBe('')
        expect(word.gloss.trim()).not.toBe('')
        expect(word.decoys).not.toContain(word.text)
      })
    }
  )

  it('has a unique id for every phrase', () => {
    const ids = pack.phrases.map((phrase) => phrase.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})
