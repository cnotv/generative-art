import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StrudelFlowVoiceControls from './StrudelFlowVoiceControls.vue'
import type { StrudelFlowSampleGroup } from '../../types'

const VOICE_GROUPS: StrudelFlowSampleGroup[] = [
  {
    label: 'Synths',
    samples: [
      { value: 'sawtooth', label: 'Sawtooth' },
      { value: 'supersaw', label: 'Supersaw' }
    ]
  },
  {
    label: 'Bass',
    samples: [
      { value: 'gm_electric_bass_finger', label: 'Electric bass, finger' },
      { value: 'gm_acoustic_bass', label: 'Acoustic bass' }
    ]
  }
]

const optionValues = (wrapper: ReturnType<typeof mount>): string[] =>
  wrapper.findAll('select[aria-label="Voice"] option').map((option) => option.attributes('value')!)

describe('StrudelFlowVoiceControls sound picker', () => {
  it('offers the host sounds under their headings after the four waveforms', () => {
    // Arrange
    const wrapper = mount(StrudelFlowVoiceControls, {
      props: { data: { kind: 'voice', sound: 'sawtooth' }, voiceGroups: VOICE_GROUPS }
    })

    // Act
    const headings = wrapper
      .findAll('select[aria-label="Voice"] optgroup')
      .map((group) => group.attributes('label'))

    // Assert
    expect(headings).toEqual(['Synths', 'Bass'])
    expect(optionValues(wrapper).slice(0, 4)).toEqual(['triangle', 'sawtooth', 'square', 'sine'])
    expect(optionValues(wrapper)).toContain('gm_electric_bass_finger')
  })

  it('lists a waveform once even when the host lists it too', () => {
    // Arrange
    const wrapper = mount(StrudelFlowVoiceControls, {
      props: { data: { kind: 'voice', sound: 'sawtooth' }, voiceGroups: VOICE_GROUPS }
    })

    // Act
    const sawtoothOptions = optionValues(wrapper).filter((value) => value === 'sawtooth')

    // Assert
    expect(sawtoothOptions).toHaveLength(1)
  })

  it('emits the picked instrument sound', async () => {
    // Arrange
    const wrapper = mount(StrudelFlowVoiceControls, {
      props: { data: { kind: 'voice', sound: 'triangle' }, voiceGroups: VOICE_GROUPS }
    })

    // Act
    await wrapper.get('select[aria-label="Voice"]').setValue('gm_acoustic_bass')

    // Assert
    expect(wrapper.emitted('update')?.[0]).toEqual([{ kind: 'voice', sound: 'gm_acoustic_bass' }])
  })

  it('does not add a second entry for a sound that is already in a group', () => {
    // Arrange
    const wrapper = mount(StrudelFlowVoiceControls, {
      props: { data: { kind: 'voice', sound: 'gm_acoustic_bass' }, voiceGroups: VOICE_GROUPS }
    })

    // Act
    const matches = optionValues(wrapper).filter((value) => value === 'gm_acoustic_bass')

    // Assert
    expect(matches).toHaveLength(1)
  })

  it('keeps a sound read from code selectable before any sounds have loaded', () => {
    // Arrange
    const wrapper = mount(StrudelFlowVoiceControls, {
      props: { data: { kind: 'voice', sound: 'gm_electric_guitar_clean' } }
    })

    // Act
    const values = optionValues(wrapper)

    // Assert
    expect(values).toEqual(['triangle', 'sawtooth', 'square', 'sine', 'gm_electric_guitar_clean'])
  })
})
