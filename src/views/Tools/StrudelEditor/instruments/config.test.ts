import { describe, expect, it } from 'vitest'
import {
  INSTRUMENT_BUILT_IN_PRESETS,
  INSTRUMENT_DRUM_VOICES,
  INSTRUMENT_KINDS,
  INSTRUMENT_KIND_IDS,
  INSTRUMENT_NAME_PATTERN,
  INSTRUMENT_NEW_PRESET_KNOBS
} from './config'

describe('the built-in presets', () => {
  it.each(INSTRUMENT_BUILT_IN_PRESETS.map((preset) => [preset.name, preset] as const))(
    '%s has a valid name and exactly the knobs of its kind, each from 0 to 1',
    (_name, preset) => {
      // Arrange
      const knobIds = INSTRUMENT_KINDS[preset.kind].knobs.map(({ id }) => id).sort()

      // Act
      const presetKnobIds = Object.keys(preset.knobs).sort()

      // Assert
      expect(INSTRUMENT_NAME_PATTERN.test(preset.name)).toBe(true)
      expect(presetKnobIds).toEqual(knobIds)
      expect(Object.values(preset.knobs).every((value) => value >= 0 && value <= 1)).toBe(true)
    }
  )

  it('has unique names', () => {
    // Arrange
    const names = INSTRUMENT_BUILT_IN_PRESETS.map(({ name }) => name)

    // Act
    const unique = new Set(names)

    // Assert
    expect(unique.size).toBe(names.length)
  })

  it.each([
    ['stoner', 'electric-guitar'],
    ['seattle', 'electric-guitar'],
    ['jangle', 'electric-guitar'],
    ['chainsaw', 'electric-guitar'],
    ['fuzzbass', 'bass-guitar'],
    ['grungebass', 'bass-guitar'],
    ['deathbass', 'bass-guitar'],
    ['campfire', 'acoustic-guitar'],
    ['doomorgan', 'organ'],
    ['garagekit', 'drum-kit'],
    ['blastkit', 'drum-kit']
  ])('ships %s as a %s', (name, kind) => {
    // Arrange
    const preset = INSTRUMENT_BUILT_IN_PRESETS.find((candidate) => candidate.name === name)

    // Act
    const presetKind = preset?.kind

    // Assert
    expect(presetKind).toBe(kind)
  })

  it('sets the chainsaw to full drive with scooped mids and the jangle to a nearly clean drive', () => {
    // Arrange
    const knobsOf = (name: string): Record<string, number> =>
      INSTRUMENT_BUILT_IN_PRESETS.find((preset) => preset.name === name)?.knobs ?? {}

    // Act
    const chainsaw = knobsOf('chainsaw')
    const jangle = knobsOf('jangle')

    // Assert
    expect(chainsaw.drive).toBe(1)
    expect(chainsaw.mids).toBe(0)
    expect(jangle.drive).toBeLessThan(0.1)
  })
})

describe('the kinds', () => {
  it.each(INSTRUMENT_KIND_IDS)('%s has labelled knobs and new preset values', (kind) => {
    // Arrange
    const definition = INSTRUMENT_KINDS[kind]

    // Act
    const newKnobIds = Object.keys(INSTRUMENT_NEW_PRESET_KNOBS[kind]).sort()

    // Assert
    expect(definition.knobs.every(({ label, hint }) => label !== '' && hint !== '')).toBe(true)
    expect(newKnobIds).toEqual(definition.knobs.map(({ id }) => id).sort())
    expect(definition.assistantPrompt).toContain(definition.knobs[0]?.id ?? '-')
  })

  it('gives every drum articulation a voice', () => {
    // Arrange
    const drumIds = INSTRUMENT_KINDS['drum-kit'].articulations.map(({ id }) => id)

    // Act
    const voiced = drumIds.every((id) => INSTRUMENT_DRUM_VOICES[id] !== undefined)

    // Assert
    expect(voiced).toBe(true)
  })
})
