import { describe, expect, it } from 'vitest'
import { readNoteFrequency, readNoteMidi } from './notes'

describe('readNoteFrequency', () => {
  it.each([
    ['a4', 440],
    ['c4', 261.63],
    ['a1', 55],
    ['a0', 27.5],
    ['ds2', 77.78],
    ['bb2', 116.54]
  ])('reads %s as %f Hz', (noteName, expectedFrequency) => {
    // Arrange
    const name = noteName

    // Act
    const frequency = readNoteFrequency(name)

    // Assert
    expect(frequency).toBeCloseTo(expectedFrequency, 1)
  })
})

describe('readNoteMidi', () => {
  it('counts c4 as 60 and rejects text that is not a note', () => {
    // Arrange
    const notNote = 'kick'

    // Act
    const middleC = readNoteMidi('c4')

    // Assert
    expect(middleC).toBe(60)
    expect(() => readNoteMidi(notNote)).toThrow('not a note name')
  })
})
