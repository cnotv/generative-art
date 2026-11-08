import { describe, expect, it } from 'vitest'
import { readHapSourceOffsets, readPreviewSoundValue } from './strudelPlayback'

describe('readHapSourceOffsets', () => {
  it('reads the start of every location of each hap, in order', () => {
    // Arrange
    const haps = [
      {
        context: {
          locations: [
            { start: 4, end: 8 },
            { start: 30, end: 34 }
          ]
        }
      }
    ]

    // Act
    const offsets = readHapSourceOffsets(haps)

    // Assert
    expect(offsets).toEqual([[4, 30]])
  })

  it('skips a hap without a context or locations', () => {
    // Arrange
    const haps = ['hap', {}, { context: {} }, { context: { locations: [] } }]

    // Act
    const offsets = readHapSourceOffsets(haps)

    // Assert
    expect(offsets).toEqual([])
  })
})

describe('readPreviewSoundValue', () => {
  it.each([
    ['a plain sample', 'bd', 'sample', { s: 'bd', n: undefined, note: undefined, clip: 1 }],
    [
      'an indexed preset technique',
      'chainsaw:1',
      'sample',
      { s: 'chainsaw', n: 1, note: undefined, clip: 1 }
    ],
    ['the second index', 'chainsaw:2', 'sample', { s: 'chainsaw', n: 2, note: undefined, clip: 1 }],
    ['a synth', 'sawtooth', 'synth', { s: 'sawtooth', n: undefined, note: 57, clip: 1 }]
  ])('splits the sample index from the name of %s', (_case, soundName, soundType, expected) => {
    // Arrange
    const pickedName = soundName

    // Act
    const value = readPreviewSoundValue(pickedName, soundType)

    // Assert
    expect(value).toEqual(expected)
  })
})
