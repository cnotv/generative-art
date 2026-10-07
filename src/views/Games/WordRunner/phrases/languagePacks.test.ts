import { describe, it, expect } from 'vitest'
import { LANGUAGE_PACKS, packFor } from './languagePacks'
import { DEFAULT_LANGUAGE } from '../config'

const everyPhrase = LANGUAGE_PACKS.flatMap((pack) =>
  pack.phrases.map((phrase) => [pack.language, phrase.id, phrase] as const)
)

describe('the language packs', () => {
  it('offers German, Spanish, French and Italian, German first', () => {
    expect(LANGUAGE_PACKS.map((pack) => pack.language)).toEqual(['de', 'es', 'fr', 'it'])
  })

  it('defaults to German', () => {
    expect(DEFAULT_LANGUAGE).toBe('de')
  })

  it.each(LANGUAGE_PACKS.map((pack) => [pack.language, pack]))(
    '%s has a name and at least one phrase',
    (_, pack) => {
      expect(pack.languageName.trim()).not.toBe('')
      expect(pack.phrases.length).toBeGreaterThan(0)
    }
  )

  it.each(everyPhrase)('%s %s has words, and no word is its own decoy', (_, __, phrase) => {
    expect(phrase.title.trim()).not.toBe('')
    expect(phrase.translation.trim()).not.toBe('')
    expect(phrase.words.length).toBeGreaterThan(0)
    phrase.words.forEach((word) => {
      expect(word.text.trim()).not.toBe('')
      expect(word.gloss.trim()).not.toBe('')
      expect(word.decoys.length).toBeGreaterThan(0)
      expect(word.decoys).not.toContain(word.text)
    })
  })

  // A phrase id seeds its course and keys its best time, so two languages must never share one.
  it('has a unique phrase id across every language', () => {
    const ids = everyPhrase.map(([, id]) => id)

    expect(new Set(ids).size).toBe(ids.length)
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
