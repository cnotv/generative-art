import { describe, it, expect } from 'vitest'
import {
  readSavedPatterns,
  removeSavedPattern,
  toSavedPatternId,
  toSavedPatternExamples,
  upsertSavedPattern
} from './savedPatterns'

describe('toSavedPatternId', () => {
  it.each([
    ['My beat', 'saved-my-beat'],
    ['  Night Drive #2 ', 'saved-night-drive-2'],
    ['Ünïcode & co', 'saved-n-code-co'],
    ['!!!', 'saved-pattern']
  ])('turns "%s" into the anchor %s', (name, expectedId) => {
    // Arrange
    const patternName = name

    // Act
    const patternId = toSavedPatternId(patternName)

    // Assert
    expect(patternId).toBe(expectedId)
  })
})

describe('readSavedPatterns', () => {
  it.each([
    ['nothing stored', null, []],
    ['text that is not JSON', 'not json', []],
    ['JSON that is not a list', '{"name":"a","code":"b"}', []],
    [
      'a list with a malformed entry among good ones',
      '[{"name":"Beat","code":"s(\\"bd\\")"},{"name":3},{"name":"","code":"x"}]',
      [{ name: 'Beat', code: 's("bd")' }]
    ]
  ])('reads %s safely', (_case, storedText, expectedPatterns) => {
    // Arrange
    const text = storedText

    // Act
    const savedPatterns = readSavedPatterns(text)

    // Assert
    expect(savedPatterns).toEqual(expectedPatterns)
  })
})

describe('upsertSavedPattern', () => {
  it.each([
    [
      'adds a new name at the top',
      [{ name: 'Old', code: 's("bd")' }],
      'New',
      's("hh")',
      [
        { name: 'New', code: 's("hh")' },
        { name: 'Old', code: 's("bd")' }
      ]
    ],
    [
      'replaces a save with the same anchor and moves it to the top',
      [
        { name: 'Other', code: 's("cp")' },
        { name: 'My beat', code: 's("bd")' }
      ],
      'my beat',
      's("hh")',
      [
        { name: 'my beat', code: 's("hh")' },
        { name: 'Other', code: 's("cp")' }
      ]
    ],
    ['ignores a blank name', [], '   ', 's("hh")', []]
  ])('%s', (_case, savedPatterns, name, code, expectedPatterns) => {
    // Arrange
    const previous = savedPatterns

    // Act
    const updated = upsertSavedPattern(previous, name, code)

    // Assert
    expect(updated).toEqual(expectedPatterns)
  })
})

describe('removeSavedPattern', () => {
  it('drops the save with that anchor and keeps the rest', () => {
    // Arrange
    const savedPatterns = [
      { name: 'Keep', code: 's("bd")' },
      { name: 'Drop me', code: 's("hh")' }
    ]

    // Act
    const remaining = removeSavedPattern(savedPatterns, 'saved-drop-me')

    // Assert
    expect(remaining).toEqual([{ name: 'Keep', code: 's("bd")' }])
  })
})

describe('toSavedPatternExamples', () => {
  it('lists each save as a pattern with its anchor, label and code', () => {
    // Arrange
    const savedPatterns = [{ name: 'My beat', code: 's("bd")' }]

    // Act
    const patterns = toSavedPatternExamples(savedPatterns)

    // Assert
    expect(patterns).toEqual([{ id: 'saved-my-beat', label: 'My beat', code: 's("bd")' }])
  })
})
