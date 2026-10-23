import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { findDocumentedWordAt, indexFunctionDocumentations } from './strudelHoverDocumentation'
import type { StrudelFunctionDocumentation } from '../types'

const POINTER = '|'

const FUNCTION_DOCUMENTATIONS: StrudelFunctionDocumentation[] = [
  {
    name: 'lpf',
    synonyms: ['cutoff'],
    description: 'Applies a low-pass filter.',
    params: [],
    examples: []
  },
  {
    name: 'note',
    synonyms: [],
    description: 'Plays notes.',
    params: [],
    examples: []
  }
]

const findAtPointer = (codeWithPointer: string) => {
  const position = codeWithPointer.indexOf(POINTER)
  const state = EditorState.create({
    doc: codeWithPointer.replace(POINTER, ''),
    extensions: [javascript()]
  })
  return findDocumentedWordAt(
    state,
    position,
    1,
    indexFunctionDocumentations(FUNCTION_DOCUMENTATIONS)
  )
}

describe('findDocumentedWordAt', () => {
  it.each([
    {
      label: 'a method in a chain',
      codeWithPointer: 's("bd").l|pf(800)',
      expectedWord: 'lpf',
      expectedRange: [8, 11],
      expectedDocumented: 'lpf'
    },
    {
      label: 'a synonym, documented under its function',
      codeWithPointer: 's("bd").cut|off(800)',
      expectedWord: 'cutoff',
      expectedRange: [8, 14],
      expectedDocumented: 'lpf'
    },
    {
      label: 'a function called on its own',
      codeWithPointer: 'no|te("c e g")',
      expectedWord: 'note',
      expectedRange: [0, 4],
      expectedDocumented: 'note'
    }
  ])(
    'finds $label under the pointer',
    ({ codeWithPointer, expectedWord, expectedRange, expectedDocumented }) => {
      // Arrange
      const code = codeWithPointer

      // Act
      const documentedWord = findAtPointer(code)

      // Assert
      expect(documentedWord?.word).toBe(expectedWord)
      expect([documentedWord?.from, documentedWord?.to]).toEqual(expectedRange)
      expect(documentedWord?.documentation.name).toBe(expectedDocumented)
    }
  )

  it.each([
    ['a comment that names a function', '// use lp|f here'],
    ['a string that names a function', 's("lp|f")'],
    ['a name Strudel does not document', 'const my|Pattern = 1'],
    ['the space between words', 'note("c") |  .lpf(800)']
  ])('finds nothing in %s', (_case, codeWithPointer) => {
    // Arrange
    const code = codeWithPointer

    // Act
    const documentedWord = findAtPointer(code)

    // Assert
    expect(documentedWord).toBeNull()
  })
})
