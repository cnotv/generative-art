import { describe, it, expect } from 'vitest'
import { capitalise, levelHints, levelWords, sentenceIndices, sentenceText } from './levelText'
import type { Level } from '../types'

const cafe: Level = {
  id: 'de-a1',
  cefr: 'A1',
  title: 'Im Café',
  situation: 'Ordering at a café',
  sentences: [
    {
      translation: 'Good morning!',
      words: [
        { text: 'Guten', gloss: 'good', decoys: ['Gute', 'Gut'] },
        { text: 'Morgen', gloss: 'morning', decoys: ['Morgens', 'Sorgen'], punctuation: '!' }
      ]
    },
    {
      translation: 'A coffee, please.',
      words: [
        { text: 'Einen', gloss: 'a', decoys: ['Einem', 'Ein'] },
        { text: 'Kaffee', gloss: 'coffee', decoys: ['Kaffees', 'Kaffe'], punctuation: ',' },
        { text: 'bitte', gloss: 'please', decoys: ['bitten', 'bittet'], punctuation: '.' }
      ]
    },
    {
      translation: 'Thanks!',
      words: [{ text: 'Danke', gloss: 'thanks', decoys: ['Dank', 'Denke'], punctuation: '!' }]
    }
  ]
}

describe('levelWords', () => {
  it('runs every word of every sentence in reading order', () => {
    expect(levelWords(cafe).map((word) => word.text)).toEqual([
      'Guten',
      'Morgen',
      'Einen',
      'Kaffee',
      'bitte',
      'Danke'
    ])
  })
})

describe('sentenceIndices', () => {
  it('says which sentence each word belongs to', () => {
    expect(sentenceIndices(cafe)).toEqual([0, 0, 1, 1, 1, 2])
  })
})

describe('levelHints', () => {
  it('helps fully on the first sentence, late on the second and not at all after', () => {
    expect(levelHints(cafe)).toEqual(['full', 'full', 'late', 'late', 'late', 'none'])
  })
})

describe('sentenceText', () => {
  it.each([
    [0, 'Guten Morgen!'],
    [1, 'Einen Kaffee, bitte.'],
    [2, 'Danke!']
  ])('writes sentence %i as %s, punctuation included', (sentenceIndex, expected) => {
    expect(sentenceText(cafe.sentences[sentenceIndex].words)).toBe(expected)
  })

  it('opens a clause with its own punctuation, as Spanish questions are', () => {
    const words = [
      { text: 'Perdone', gloss: 'excuse me', decoys: [], punctuation: ',' },
      { opening: '¿', text: 'cuándo', gloss: 'when', decoys: [] },
      { text: 'sale', gloss: 'leaves', decoys: [], punctuation: '?' }
    ]

    expect(sentenceText(words)).toBe('Perdone, ¿cuándo sale?')
  })

  it('writes only the words given, for a sentence still being built', () => {
    expect(sentenceText(cafe.sentences[1].words.slice(0, 2))).toBe('Einen Kaffee,')
  })
})

describe('capitalise', () => {
  it.each([
    ['the bot', 'The bot'],
    ['Quick Otter', 'Quick Otter'],
    ['über', 'Über'],
    ['', '']
  ])('writes %j as %j', (text, expected) => {
    expect(capitalise(text)).toBe(expected)
  })
})
