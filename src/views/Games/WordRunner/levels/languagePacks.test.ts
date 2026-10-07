import { describe, it, expect } from 'vitest'
import { CEFR_DESCRIPTIONS, LANGUAGE_PACKS, findLevel, nextLevelId, packFor } from './languagePacks'
import { DEFAULT_LANGUAGE } from '../config'

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
// Punctuation belongs in a word's own field, never on its sign.
const SIGN_UNSAFE = /[\s!",.:;?¡¿]/

const everyLevel = LANGUAGE_PACKS.flatMap((pack) =>
  pack.levels.map((level) => [level.id, level] as const)
)
const spanishLevels = everyLevel.filter(([id]) => id.startsWith('es-'))
const everyWord = everyLevel.flatMap(([id, level]) =>
  level.sentences.flatMap((sentence) =>
    sentence.words.map((word) => [id, word.text, word] as const)
  )
)

describe('the language packs', () => {
  it('offers German, Spanish, French and Italian, German first', () => {
    expect(LANGUAGE_PACKS.map((pack) => pack.language)).toEqual(['de', 'es', 'fr', 'it'])
  })

  it('defaults to German', () => {
    expect(DEFAULT_LANGUAGE).toBe('de')
  })

  it.each(LANGUAGE_PACKS.map((pack) => [pack.language, pack]))(
    '%s has the six CEFR levels in order, each id named after its language and level',
    (language, pack) => {
      expect(pack.languageName.trim()).not.toBe('')
      expect(pack.levels.map((level) => level.cefr)).toEqual(CEFR_ORDER)
      expect(pack.levels.map((level) => level.id)).toEqual(
        CEFR_ORDER.map((cefr) => `${language}-${cefr.toLowerCase()}`)
      )
    }
  )

  // Every language tells the same story at each level, so a level means the same everywhere.
  it.each(CEFR_ORDER.map((cefr, levelIndex) => [cefr, levelIndex]))(
    '%s is the same situation, in as many sentences, in every language',
    (_, levelIndex) => {
      const levels = LANGUAGE_PACKS.map((pack) => pack.levels[levelIndex])

      expect(new Set(levels.map((level) => level.situation)).size).toBe(1)
      expect(new Set(levels.map((level) => level.sentences.length)).size).toBe(1)
    }
  )

  it.each(everyLevel)(
    '%s has a title, and every sentence has words and a translation',
    (_, level) => {
      expect(level.title.trim()).not.toBe('')
      expect(level.sentences.length).toBeGreaterThan(0)
      level.sentences.forEach((sentence) => {
        expect(sentence.translation.trim()).not.toBe('')
        expect(sentence.words.length).toBeGreaterThan(0)
        expect(sentence.words[sentence.words.length - 1].punctuation).toBeTruthy()
      })
    }
  )

  // Spanish opens every question and exclamation with its own inverted mark.
  it.each(spanishLevels)('%s opens each question and exclamation with ¿ or ¡', (_, level) => {
    level.sentences.forEach((sentence) => {
      const closings = sentence.words
        .flatMap((word) => [...(word.punctuation ?? '')])
        .filter((mark) => mark === '?' || mark === '!')
      const openings = sentence.words.flatMap((word) => [...(word.opening ?? '')])

      expect(openings.map((mark) => (mark === '¿' ? '?' : '!'))).toEqual(closings)
    })
  })

  it('makes every level longer than the one before it is short', () => {
    LANGUAGE_PACKS.forEach((pack) => {
      const wordCounts = pack.levels.map((level) =>
        level.sentences.reduce((total, sentence) => total + sentence.words.length, 0)
      )
      expect(Math.min(...wordCounts.slice(1))).toBeGreaterThan(wordCounts[0])
    })
  })

  it.each(everyWord)(
    '%s "%s" fits a sign and has two decoys that are not itself',
    (_, __, word) => {
      expect(word.text).not.toMatch(SIGN_UNSAFE)
      expect(word.gloss.trim()).not.toBe('')
      expect(word.decoys).toHaveLength(2)
      expect(new Set(word.decoys).size).toBe(2)
      word.decoys.forEach((decoy) => {
        expect(decoy).not.toMatch(SIGN_UNSAFE)
        expect(decoy.toLocaleLowerCase()).not.toBe(word.text.toLocaleLowerCase())
      })
    }
  )

  // A level id seeds its course and keys its best time, so two languages must never share one.
  it('has a unique level id across every language', () => {
    const ids = everyLevel.map(([id]) => id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('describes what clearing each CEFR level shows', () => {
    CEFR_ORDER.forEach((cefr) => {
      expect(CEFR_DESCRIPTIONS[cefr as keyof typeof CEFR_DESCRIPTIONS].canDo.trim()).not.toBe('')
    })
  })
})

describe('packFor', () => {
  it.each(['de', 'es', 'fr', 'it'])('finds the %s pack', (language) => {
    expect(packFor(language).language).toBe(language)
  })

  it('falls back to the default language for one it does not have', () => {
    expect(packFor('xx').language).toBe(DEFAULT_LANGUAGE)
  })
})

describe('findLevel and nextLevelId', () => {
  it('finds a level with its language and its place in it', () => {
    const found = findLevel('fr-b1')

    expect(found?.pack.language).toBe('fr')
    expect(found?.levelIndex).toBe(2)
    expect(found?.level.cefr).toBe('B1')
  })

  it.each([
    ['de-a1', 'de-a2'],
    ['it-c1', 'it-c2'],
    ['es-c2', null]
  ])('after %s comes %s', (levelId, expected) => {
    expect(nextLevelId(levelId)).toBe(expected)
  })
})
