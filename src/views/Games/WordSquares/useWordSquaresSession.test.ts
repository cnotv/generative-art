import { describe, it, expect } from 'vitest'
import { computeGuessResult } from './useWordSquaresSession'

describe('computeGuessResult', () => {
  it.each([
    {
      label: 'all correct',
      guess: 'APPLE',
      word: 'APPLE',
      expected: ['correct', 'correct', 'correct', 'correct', 'correct']
    },
    {
      label: 'all absent',
      guess: 'XZQJK',
      word: 'APPLE',
      expected: ['absent', 'absent', 'absent', 'absent', 'absent']
    },
    {
      label: 'some correct some absent',
      guess: 'ABCDE',
      word: 'AFCGE',
      expected: ['correct', 'absent', 'correct', 'absent', 'correct']
    },
    {
      label: 'present but wrong position',
      guess: 'EAPPL',
      word: 'APPLE',
      expected: ['present', 'present', 'correct', 'present', 'present']
    },
    {
      label: 'duplicate in guess — only first present when word has one copy',
      guess: 'AAYYY',
      word: 'XXXAX',
      expected: ['present', 'absent', 'absent', 'absent', 'absent']
    },
    {
      label: 'duplicate in guess — correct takes priority over present in first pass',
      guess: 'AAXXX',
      word: 'BAXXX',
      expected: ['absent', 'correct', 'correct', 'correct', 'correct']
    },
    {
      label: 'duplicate in word — both guessed letters can be present',
      guess: 'AAYYZ',
      word: 'XXAAX',
      expected: ['present', 'present', 'absent', 'absent', 'absent']
    },
    {
      label: 'case insensitive',
      guess: 'apple',
      word: 'APPLE',
      expected: ['correct', 'correct', 'correct', 'correct', 'correct']
    }
  ])('$label', ({ guess, word, expected }) => {
    expect(computeGuessResult(guess, word)).toEqual(expected)
  })
})
