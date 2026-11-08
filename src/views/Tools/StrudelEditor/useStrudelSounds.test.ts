import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { INSTRUMENT_BUILT_IN_PRESETS } from './instruments/config'
import { buildInstrumentPickerGroups } from './instruments/instrumentPickerGroups'
import type { StrudelSoundEntry } from './types'

const PRESET_GROUPS = buildInstrumentPickerGroups(INSTRUMENT_BUILT_IN_PRESETS)

const ENTRIES: StrudelSoundEntry[] = [
  {
    name: 'bd',
    label: 'Bass drum',
    group: 'Dirt samples',
    type: 'sample',
    tag: '',
    sampleCount: 1
  },
  {
    name: 'rolandtr909_bd',
    label: 'Bass drum',
    group: 'Roland TR909',
    type: 'sample',
    tag: 'drum-machines',
    sampleCount: 1
  },
  { name: 'sawtooth', label: 'Sawtooth', group: 'Synths', type: 'synth', tag: '', sampleCount: 0 },
  {
    name: 'gm_electric_bass_finger',
    label: 'Electric bass, finger',
    group: 'Bass',
    type: 'soundfont',
    tag: '',
    sampleCount: 1
  },
  {
    name: 'stoner_chord',
    label: 'Stoner chord',
    group: 'Electric guitar: stoner',
    type: 'sample',
    tag: 'instrument:electric-guitar:stoner',
    sampleCount: 9
  }
]

vi.mock('./strudelSoundLibrary', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./strudelSoundLibrary')>()),
  readStrudelSoundEntries: vi.fn().mockResolvedValue(ENTRIES)
}))

describe('useStrudelSounds', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('groups synths and instruments for the Voice node, apart from the samples', async () => {
    // Arrange
    const { useStrudelSounds } = await import('./useStrudelSounds')
    const { voiceGroups, sampleGroups, loadSounds } = useStrudelSounds()

    // Act
    await loadSounds()

    // Assert
    expect(voiceGroups.value.map((group) => group.label)).toEqual([
      ...PRESET_GROUPS.voiceGroups.map((group) => group.label),
      'Synths',
      'Bass'
    ])
    expect(voiceGroups.value.at(-1)?.samples).toEqual([
      { value: 'gm_electric_bass_finger', label: 'Electric bass, finger' }
    ])
    expect(sampleGroups.value.map((group) => group.label)).toEqual([
      ...PRESET_GROUPS.sampleGroups.map((group) => group.label),
      'Dirt samples',
      'Roland TR909'
    ])
  })

  it('lists the instrument presets before the sounds load, since they render only when played', () => {
    // Arrange
    return import('./useStrudelSounds').then(({ useStrudelSounds }) => {
      // Act
      const { voiceGroups, sampleGroups } = useStrudelSounds()

      // Assert
      expect(voiceGroups.value).toEqual(PRESET_GROUPS.voiceGroups)
      expect(sampleGroups.value).toEqual(PRESET_GROUPS.sampleGroups)
    })
  })
})
