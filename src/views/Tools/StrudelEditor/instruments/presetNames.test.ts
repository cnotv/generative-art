import { describe, expect, it } from 'vitest'
import { INSTRUMENT_NAME_ERRORS } from './config'
import { checkInstrumentPresetName } from './presetNames'

describe('checkInstrumentPresetName', () => {
  it.each([
    ['riff', true],
    ['riff2', true],
    ['a', true],
    ['', false],
    ['Riff', false],
    ['2riff', false],
    ['my riff', false],
    ['my_riff', false],
    ['riff!', false],
    ['abcdefghijklmnopq', false]
  ])('accepts or refuses "%s": %s', (name, expectedValid) => {
    // Arrange
    const otherPresets = ['stoner']

    // Act
    const check = checkInstrumentPresetName(name, otherPresets, [])

    // Assert
    expect(check.valid).toBe(expectedValid)
  })

  it.each([
    ['', INSTRUMENT_NAME_ERRORS.empty],
    ['Riff', INSTRUMENT_NAME_ERRORS.shape],
    ['abcdefghijklmnopq', INSTRUMENT_NAME_ERRORS.tooLong],
    ['stoner', INSTRUMENT_NAME_ERRORS.taken],
    ['sawtooth', INSTRUMENT_NAME_ERRORS.soundTaken],
    ['rolandtr909', INSTRUMENT_NAME_ERRORS.soundTaken]
  ])('says what is wrong with "%s"', (name, expectedMessage) => {
    // Arrange
    const otherPresets = ['stoner']
    const foreignSounds = ['sawtooth', 'rolandtr909_bd', 'bd']

    // Act
    const check = checkInstrumentPresetName(name, otherPresets, foreignSounds)

    // Assert
    expect(check).toEqual({ valid: false, message: expectedMessage })
  })

  it('does not treat a longer sound name as a collision', () => {
    // Arrange
    const foreignSounds = ['bdrum']

    // Act
    const check = checkInstrumentPresetName('bd2', [], foreignSounds)

    // Assert
    expect(check.valid).toBe(true)
  })
})
