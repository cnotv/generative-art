import { describe, it, expect, beforeEach } from 'vitest'
import { loadLanguage, saveLanguage } from './languagePreference'

const AVAILABLE = ['de', 'es', 'fr', 'it']

describe('loadLanguage and saveLanguage', () => {
  beforeEach(() => localStorage.clear())

  it('uses the fallback before anything is picked', () => {
    expect(loadLanguage(AVAILABLE, 'de')).toBe('de')
  })

  it('remembers the language last picked', () => {
    saveLanguage('fr')

    expect(loadLanguage(AVAILABLE, 'de')).toBe('fr')
  })

  it('ignores a stored language that is no longer offered', () => {
    saveLanguage('pt')

    expect(loadLanguage(AVAILABLE, 'de')).toBe('de')
  })
})
