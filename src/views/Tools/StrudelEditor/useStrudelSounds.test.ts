import { describe, expect, it, vi } from 'vitest'
import type { StrudelSoundEntry } from './types'

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
  }
]

vi.mock('./strudelSoundLibrary', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./strudelSoundLibrary')>()),
  readStrudelSoundEntries: vi.fn().mockResolvedValue(ENTRIES)
}))

describe('useStrudelSounds', () => {
  it('groups synths and instruments for the Voice node, apart from the samples', async () => {
    // Arrange
    const { useStrudelSounds } = await import('./useStrudelSounds')
    const { voiceGroups, sampleGroups, loadSounds } = useStrudelSounds()

    // Act
    await loadSounds()

    // Assert
    expect(voiceGroups.value.map((group) => group.label)).toEqual(['Synths', 'Bass'])
    expect(voiceGroups.value[1].samples).toEqual([
      { value: 'gm_electric_bass_finger', label: 'Electric bass, finger' }
    ])
    expect(sampleGroups.value.map((group) => group.label)).toEqual(['Dirt samples', 'Roland TR909'])
  })

  it('has no voice groups before the sounds load', () => {
    // Arrange
    return import('./useStrudelSounds').then(({ useStrudelSounds }) => {
      // Act
      const { voiceGroups } = useStrudelSounds()

      // Assert
      expect(voiceGroups.value).toEqual([])
    })
  })
})
