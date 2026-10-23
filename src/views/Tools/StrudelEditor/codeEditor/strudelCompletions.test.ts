import { describe, it, expect } from 'vitest'
import { CompletionContext } from '@codemirror/autocomplete'
import type { Completion, CompletionResult } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { createStrudelCompletionSource } from './strudelCompletions'
import type { StrudelCompletionVocabulary } from '../types'

const CURSOR = '|'

const TEST_VOCABULARY: StrudelCompletionVocabulary = {
  functionDocumentations: [
    {
      name: 'lpf',
      synonyms: ['cutoff', 'lp'],
      description: 'Applies a low-pass filter.',
      params: [{ name: 'frequency', type: 'number | Pattern', description: 'cutoff in hertz' }],
      examples: ['s("bd sd").lpf(800)']
    },
    {
      name: 'note',
      synonyms: [],
      description: 'Plays notes.',
      params: [{ name: 'notes', type: 'string | Pattern', description: '' }],
      examples: ['note("c e g")']
    }
  ],
  chordSymbols: ['', 'm7', 'maj7', '^7'],
  scaleNames: ['major', 'minor pentatonic'],
  listSoundNames: () => Promise.resolve(['bd', 'sd', 'RolandTR808_bd', 'RolandTR808_sd', 'piano'])
}

const completeAt = async (
  codeWithCursor: string,
  explicit = false
): Promise<CompletionResult | null> => {
  const position = codeWithCursor.indexOf(CURSOR)
  const state = EditorState.create({
    doc: codeWithCursor.replace(CURSOR, ''),
    extensions: [javascript()]
  })
  const completionSource = createStrudelCompletionSource(TEST_VOCABULARY)
  return completionSource(new CompletionContext(state, position, explicit))
}

const labelsOf = (result: CompletionResult | null): string[] =>
  result?.options.map((option) => option.label) ?? []

const appliedText = (option: Completion | undefined): string =>
  typeof option?.apply === 'string' ? option.apply : (option?.label ?? '')

describe('createStrudelCompletionSource', () => {
  it.each([
    ['a method after a dot', 's("bd").lp|', 8],
    ['a function at the start of a line', 'no|', 0],
    ['every function right after a dot', 's("bd").|', 8]
  ])('offers functions for %s', async (_context, codeWithCursor, expectedFrom) => {
    // Arrange
    const typedCode = codeWithCursor

    // Act
    const result = await completeAt(typedCode)

    // Assert
    expect(result?.from).toBe(expectedFrom)
    expect(labelsOf(result)).toEqual(['cutoff', 'lp', 'lpf', 'note'])
  })

  it.each([
    ['an empty line', '|'],
    ['a comment', '// filter with lp|'],
    ['the mini-notation of a note', 'note("c e|")']
  ])('stays closed in %s unless asked', async (_context, codeWithCursor) => {
    // Arrange
    const typedCode = codeWithCursor

    // Act
    const result = await completeAt(typedCode)

    // Assert
    expect(result).toBeNull()
  })

  it('opens on an empty line when asked with Ctrl+Space', async () => {
    // Arrange
    const typedCode = '|'

    // Act
    const result = await completeAt(typedCode, true)

    // Assert
    expect(labelsOf(result)).toContain('note')
  })

  it.each([
    ['a sound', 's("bd r|")', 6, ['bd', 'sd', 'RolandTR808_bd', 'RolandTR808_sd', 'piano']],
    [
      'a sound by its long name',
      'sound("pi|")',
      7,
      ['bd', 'sd', 'RolandTR808_bd', 'RolandTR808_sd', 'piano']
    ],
    ['a bank', 's("bd").bank("Ro|")', 14, ['RolandTR808']],
    [
      'a chord root',
      'chord("<C |")',
      10,
      [
        'C',
        'C#',
        'Db',
        'D',
        'D#',
        'Eb',
        'E',
        'F',
        'F#',
        'Gb',
        'G',
        'G#',
        'Ab',
        'A',
        'A#',
        'Bb',
        'B'
      ]
    ],
    ['a chord symbol after its root', 'chord("C|")', 8, ['major', 'm7', 'maj7', '^7']],
    [
      'a scale root',
      'n("0 2").scale("|")',
      16,
      [
        'C',
        'C#',
        'Db',
        'D',
        'D#',
        'Eb',
        'E',
        'F',
        'F#',
        'Gb',
        'G',
        'G#',
        'Ab',
        'A',
        'A#',
        'Bb',
        'B'
      ]
    ],
    ['a scale name after its root', 'n("0 2").scale("D:mi|")', 18, ['major', 'minor pentatonic']]
  ])(
    'offers %s inside its string',
    async (_context, codeWithCursor, expectedFrom, expectedLabels) => {
      // Arrange
      const typedCode = codeWithCursor

      // Act
      const result = await completeAt(typedCode)

      // Assert
      expect(result?.from).toBe(expectedFrom)
      expect(labelsOf(result)).toEqual(expectedLabels)
    }
  )

  it.each([
    ['a major chord, which has no symbol', 'chord("C|")', 'major', ''],
    ['a scale name with spaces', 'n("0").scale("D:|")', 'minor pentatonic', 'minor:pentatonic']
  ])('writes %s the way Strudel reads it', async (_case, codeWithCursor, label, expectedText) => {
    // Arrange
    const result = await completeAt(codeWithCursor)

    // Act
    const option = result?.options.find((candidate) => candidate.label === label)

    // Assert
    expect(appliedText(option)).toBe(expectedText)
  })

  it('describes a function and its synonyms beside the list', async () => {
    // Arrange
    const result = await completeAt('s("bd").cut|')
    const option = result?.options.find((candidate) => candidate.label === 'cutoff')

    // Act
    const info = typeof option?.info === 'function' ? await option.info(option) : null

    // Assert
    expect(option?.detail).toBe('(frequency)')
    expect(info instanceof HTMLElement ? info.textContent : '').toContain(
      'Applies a low-pass filter.'
    )
    expect(info instanceof HTMLElement ? info.textContent : '').toContain('Also: lpf, lp')
    expect(info instanceof HTMLElement ? info.textContent : '').toContain('s("bd sd").lpf(800)')
  })
})
