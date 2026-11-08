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
    ['Electric guitar: chainsaw', ['chainsaw', 'chainsaw:mute', 'chainsaw:chord'], 'strings'],
    ['Bass guitar: deathbass', ['deathbass', 'deathbass:mute'], 'bass'],
    ['Organ: doomorgan', ['doomorgan'], 'keys']
  ])(
    'lists %s with the combined sound first, then its techniques',
    (groupLabel, values, familyId) => {
      // Arrange
      const presets = INSTRUMENT_BUILT_IN_PRESETS

      // Act
      const group = buildInstrumentPickerGroups(presets).voiceGroups.find(
        ({ label }) => label === groupLabel
      )

      // Assert
      expect(group?.samples.map(({ value }) => value)).toEqual(values)
      expect(group?.samples.every((sample) => sample.familyId === familyId)).toBe(true)
    }
  )

  it('labels the combined sound by the preset and each technique by its articulation', () => {
    // Arrange
    const presets = INSTRUMENT_BUILT_IN_PRESETS

    // Act
    const group = buildInstrumentPickerGroups(presets).voiceGroups.find(
      ({ label }) => label === 'Electric guitar: chainsaw'
    )

    // Assert
    expect(group?.samples.map(({ label }) => label)).toEqual([
      'chainsaw',
      'chainsaw palm mute',
      'chainsaw power chord'
    ])
  })

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
      'mytone',
      'mytone:mute',
      'mytone:chord'
    ])
  })
})
