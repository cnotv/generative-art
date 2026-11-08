import { describe, expect, it } from 'vitest'
import { INSTRUMENT_BUILT_IN_PRESETS } from './config'
import { buildInstrumentPickerGroups } from './instrumentPickerGroups'

describe('buildInstrumentPickerGroups', () => {
  it('lists every pitched preset for the Voice node and every drum kit for the sample nodes', () => {
    // Arrange
    const presets = INSTRUMENT_BUILT_IN_PRESETS

    // Act
    const { voiceGroups, sampleGroups } = buildInstrumentPickerGroups(presets)

    // Assert
    const drumKitCount = presets.filter(({ kind }) => kind === 'drum-kit').length
    expect(voiceGroups).toHaveLength(presets.length - drumKitCount)
    expect(sampleGroups).toHaveLength(drumKitCount)
  })

  it.each([
    ['Electric guitar: chainsaw', 'chainsaw_chord', 'chainsaw power chord', 'strings'],
    ['Bass guitar: deathbass', 'deathbass_note', 'deathbass note', 'bass'],
    ['Organ: doomorgan', 'doomorgan_note', 'doomorgan note', 'keys']
  ])(
    'lists %s with its sounds filed under a family',
    (groupLabel, soundName, soundLabel, familyId) => {
      // Arrange
      const presets = INSTRUMENT_BUILT_IN_PRESETS

      // Act
      const group = buildInstrumentPickerGroups(presets).voiceGroups.find(
        ({ label }) => label === groupLabel
      )

      // Assert
      expect(group?.samples).toContainEqual({ value: soundName, label: soundLabel, familyId })
    }
  )

  it('files a drum kit piece under its drum family', () => {
    // Arrange
    const presets = INSTRUMENT_BUILT_IN_PRESETS

    // Act
    const blastKit = buildInstrumentPickerGroups(presets).sampleGroups.find(
      ({ label }) => label === 'Drum kit: blastkit'
    )

    // Assert
    expect(blastKit?.samples).toContainEqual({
      value: 'blastkit_kick',
      label: 'blastkit kick',
      familyId: 'kick'
    })
    expect(blastKit?.samples).toContainEqual({
      value: 'blastkit_hatopen',
      label: 'blastkit open hi-hat',
      familyId: 'hihat'
    })
  })

  it('includes a preset the player made, before it has ever rendered', () => {
    // Arrange
    const presets = [{ name: 'mytone', kind: 'electric-guitar' as const, knobs: {} }]

    // Act
    const { voiceGroups } = buildInstrumentPickerGroups(presets)

    // Assert
    expect(voiceGroups[0]?.samples.map(({ value }) => value)).toEqual([
      'mytone_chord',
      'mytone_mute',
      'mytone_note'
    ])
  })
})
