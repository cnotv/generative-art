import { describe, it, expect } from 'vitest'
import { numberDuplicateNames } from './elementNames'

describe('numberDuplicateNames', () => {
  it.each([
    [[], []],
    [
      ['ground', 'sky'],
      ['ground', 'sky']
    ],
    [
      ['column', 'column', 'column'],
      ['column', 'column (2)', 'column (3)']
    ],
    [
      ['step', 'column', 'step'],
      ['step', 'column', 'step (2)']
    ]
  ])('numbers %j as %j', (names, expected) => {
    expect(numberDuplicateNames(names)).toEqual(expected)
  })

  it('leaves an already numbered name alone rather than renumbering it', () => {
    expect(numberDuplicateNames(['column (2)', 'column (2)'])).toEqual([
      'column (2)',
      'column (2) (2)'
    ])
  })
})
