import { describe, it, expect } from 'vitest'
import {
  buildStrudelDocumentationIndex,
  parseStrudelDocumentation
} from './parseStrudelDocumentation'

const documented = (commentLines: string[], codeLine: string): string =>
  ['/**', ...commentLines.map((line) => ` * ${line}`.trimEnd()), ' */', codeLine, ''].join('\n')

describe('parseStrudelDocumentation', () => {
  it('reads the name, synonyms, description, parameters and examples of a comment', () => {
    // Arrange
    const sourceText = documented(
      [
        'Select a sound / sample by name. When using mininotation, you can also',
        'supply n and gain separated by colons.',
        '',
        '@name s',
        '@param {string | Pattern} sound The sound / pattern of sounds to pick',
        '@synonyms sound',
        '@example',
        's("bd hh")',
        '@example',
        's("bd:0 bd:1")'
      ],
      ''
    )

    // Act
    const functionDocumentations = parseStrudelDocumentation(sourceText)

    // Assert
    expect(functionDocumentations).toEqual([
      {
        name: 's',
        synonyms: ['sound'],
        description:
          'Select a sound / sample by name. When using mininotation, you can also supply n and gain separated by colons.',
        params: [
          {
            name: 'sound',
            type: 'string | Pattern',
            description: 'The sound / pattern of sounds to pick'
          }
        ],
        examples: ['s("bd hh")', 's("bd:0 bd:1")']
      }
    ])
  })

  it.each([
    [
      'a destructured register call',
      "export const { slow, sparsity } = register(['slow', 'sparsity'], function (factor, pat) {",
      'slow',
      ['sparsity']
    ],
    [
      'a register call with a name list',
      "export const euclidLegato = register(['euclidLegato'], function (pulses, steps, pat) {",
      'euclidLegato',
      []
    ],
    ['an exported function', 'export function stack(...pats) {', 'stack', []],
    ['an exported constant', 'export const saw = signal((t) => t % 1);', 'saw', []],
    [
      'a prototype assignment',
      'Pattern.prototype.pianoroll = function (options = {}) {',
      'pianoroll',
      []
    ],
    ['a class method', '  superimpose(...funcs) {', 'superimpose', []]
  ])(
    'names a comment without @name after %s',
    (_shape, codeLine, expectedName, expectedSynonyms) => {
      // Arrange
      const sourceText = documented(['Does something musical.'], codeLine)

      // Act
      const [functionDocumentation] = parseStrudelDocumentation(sourceText)

      // Assert
      expect(functionDocumentation?.name).toBe(expectedName)
      expect(functionDocumentation?.synonyms).toEqual(expectedSynonyms)
    }
  )

  it.each([
    ['tagged @noAutocomplete', ['Hidden.', '@name hidden', '@noAutocomplete'], ''],
    ['tagged @superdirtOnly', ['SuperDirt only.', '@name orbit2', '@superdirtOnly'], ''],
    ['tagged @deprecated', ['Old.', '@name oldName', '@deprecated'], ''],
    ['named with a leading underscore', ['Internal.', '@name _internal'], ''],
    ['followed by code it cannot name', ['Inside a function.'], '    return new Pattern(query);']
  ])('leaves out a comment %s', (_reason, commentLines, codeLine) => {
    // Arrange
    const sourceText = documented(commentLines, codeLine)

    // Act
    const functionDocumentations = parseStrudelDocumentation(sourceText)

    // Assert
    expect(functionDocumentations).toEqual([])
  })

  it('strips markup, keeps paragraphs and joins wrapped parameter text', () => {
    // Arrange
    const sourceText = documented(
      [
        'Plays the <code>pattern</code> **f**aster.',
        '',
        'See <a href="#slow">slow</a> for the opposite.',
        '@param {number | Pattern} factor how many times faster,',
        '  where 2 is twice as fast',
        '@example',
        'note("c d")',
        '  .fast(2)'
      ],
      "export const { fast } = register('fast', function (factor, pat) {"
    )

    // Act
    const [functionDocumentation] = parseStrudelDocumentation(sourceText)

    // Assert
    expect(functionDocumentation?.description).toBe(
      'Plays the pattern faster.\n\nSee slow for the opposite.'
    )
    expect(functionDocumentation?.params[0]?.description).toBe(
      'how many times faster, where 2 is twice as fast'
    )
    expect(functionDocumentation?.examples).toEqual(['note("c d")\n  .fast(2)'])
  })
})

describe('buildStrudelDocumentationIndex', () => {
  it('keeps the first of two docs with one name, adds inline widgets and sorts by name', () => {
    // Arrange
    const coreSource = [
      documented(['Stacks patterns.'], 'export function stack(...pats) {'),
      documented(['A later duplicate.', '@name stack'], ''),
      documented(['Draws a pianoroll.', '@name pianoroll'], '')
    ].join('\n')
    const widgetSource = "registerWidget('_pianoroll', (id, options = {}, pat) => {"

    // Act
    const functionDocumentations = buildStrudelDocumentationIndex([coreSource], widgetSource)

    // Assert
    expect(
      functionDocumentations.map((functionDocumentation) => functionDocumentation.name)
    ).toEqual(['_pianoroll', 'pianoroll', 'stack'])
    expect(
      functionDocumentations.find((functionDocumentation) => functionDocumentation.name === 'stack')
        ?.description
    ).toBe('Stacks patterns.')
    expect(functionDocumentations[0]?.description).toBe(
      'Draws pianoroll under the line it is on. Draws a pianoroll.'
    )
  })
})
