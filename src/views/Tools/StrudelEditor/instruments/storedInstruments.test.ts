import { describe, expect, it } from 'vitest'
import { readInstrumentKnobs, readStoredInstruments } from './storedInstruments'

const GOOD_KNOBS = { drive: 0.5, tone: 0.5, bass: 0.5, mids: 0.5, sustain: 0.5 }

describe('readStoredInstruments', () => {
  it.each([
    ['nothing saved', null],
    ['text that is not JSON', 'not json'],
    ['JSON that is not an object', '[1, 2]']
  ])('starts empty for %s', (_case, serialised) => {
    // Arrange
    const saved = serialised

    // Act
    const stored = readStoredInstruments(saved)

    // Assert
    expect(stored).toEqual({ userPresets: [], tweaks: {}, selectedName: '' })
  })

  it('keeps valid presets, tweaks and the selection', () => {
    // Arrange
    const saved = JSON.stringify({
      userPresets: [{ name: 'mine', kind: 'electric-guitar', knobs: GOOD_KNOBS }],
      tweaks: { stoner: { ...GOOD_KNOBS, drive: 2 } },
      selectedName: 'mine'
    })

    // Act
    const stored = readStoredInstruments(saved)

    // Assert
    expect(stored.userPresets).toEqual([
      { name: 'mine', kind: 'electric-guitar', knobs: GOOD_KNOBS }
    ])
    expect(stored.tweaks.stoner?.drive).toBe(1)
    expect(stored.selectedName).toBe('mine')
  })

  it('drops presets with a bad name, an unknown kind, missing knobs, a built-in name or a repeat', () => {
    // Arrange
    const good = { name: 'mine', kind: 'electric-guitar', knobs: GOOD_KNOBS }
    const saved = JSON.stringify({
      userPresets: [
        good,
        good,
        { ...good, name: 'Bad Name' },
        { ...good, name: 'other', kind: 'kazoo' },
        { ...good, name: 'thin', knobs: { drive: 1 } },
        { ...good, name: 'stoner' }
      ]
    })

    // Act
    const stored = readStoredInstruments(saved)

    // Assert
    expect(stored.userPresets.map(({ name }) => name)).toEqual(['mine'])
  })
})

describe('readInstrumentKnobs', () => {
  it('clamps to 0 to 1 and refuses a set that lacks a knob', () => {
    // Arrange
    const tooLoud = { ...GOOD_KNOBS, drive: 9, tone: -3 }

    // Act
    const clamped = readInstrumentKnobs('electric-guitar', tooLoud)
    const missing = readInstrumentKnobs('organ', GOOD_KNOBS)

    // Assert
    expect(clamped?.drive).toBe(1)
    expect(clamped?.tone).toBe(0)
    expect(missing).toBeNull()
  })
})
