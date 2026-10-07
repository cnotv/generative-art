import { describe, it, expect, beforeEach } from 'vitest'
import { loadChoice, oneOf, saveChoice } from './preferences'

const KEY = 'word-runner-test-choice'
const AVAILABLE = ['de', 'es', 'fr', 'it']

describe('oneOf', () => {
  it.each([
    ['fr', 'fr'],
    ['pt', 'de'],
    [3, 'de'],
    [undefined, 'de']
  ])('reads %s as %s', (value, expected) => {
    expect(oneOf(value, AVAILABLE, 'de')).toBe(expected)
  })
})

describe('loadChoice and saveChoice', () => {
  beforeEach(() => localStorage.clear())

  it('uses the fallback before anything is picked', () => {
    expect(loadChoice(KEY, AVAILABLE, 'de')).toBe('de')
  })

  it('remembers the choice made last', () => {
    saveChoice(KEY, 'fr')

    expect(loadChoice(KEY, AVAILABLE, 'de')).toBe('fr')
  })

  it('ignores a stored choice that is no longer offered', () => {
    saveChoice(KEY, 'pt')

    expect(loadChoice(KEY, AVAILABLE, 'de')).toBe('de')
  })

  it('keeps each choice under its own key', () => {
    saveChoice(KEY, 'fr')
    saveChoice('word-runner-other-choice', 'it')

    expect(loadChoice(KEY, AVAILABLE, 'de')).toBe('fr')
  })
})
