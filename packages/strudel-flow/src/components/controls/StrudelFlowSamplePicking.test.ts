import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StrudelFlowBeatsControls from './StrudelFlowBeatsControls.vue'
import StrudelFlowPatternControls from './StrudelFlowPatternControls.vue'
import { createStrudelFlowNodeData } from '../../nodeDefaults'
import type { StrudelFlowSoundGroup } from '../../types'

const SAMPLE_GROUPS: StrudelFlowSoundGroup[] = [
  { label: 'Samples', sounds: ['bd', 'casio'] },
  { label: 'Drum machines', sounds: ['RolandTR909_bd'] }
]

describe('StrudelFlowPatternControls sample picker', () => {
  it('adds the picked sample to the end of the Samples pattern', async () => {
    // Arrange
    const wrapper = mount(StrudelFlowPatternControls, {
      props: { data: { kind: 'samples', pattern: 'bd*2 ' }, sampleGroups: SAMPLE_GROUPS }
    })
    const picker = wrapper.get('select[aria-label="Add sample"]')

    // Act
    await picker.setValue('RolandTR909_bd')

    // Assert
    expect(wrapper.emitted('update')?.[0]).toEqual([
      { kind: 'samples', pattern: 'bd*2 RolandTR909_bd' }
    ])
    const groupLabels = picker.findAll('optgroup').map((group) => group.attributes('label'))
    expect(groupLabels).toEqual(['Samples', 'Drum machines'])
  })

  it.each([
    ['a Notes node', { kind: 'notes' as const, pattern: 'c3 e3' }, SAMPLE_GROUPS],
    ['a Samples node with no sounds loaded yet', { kind: 'samples' as const, pattern: '' }, []]
  ])('has no picker on %s', (_case, data, sampleGroups) => {
    // Arrange
    const wrapper = mount(StrudelFlowPatternControls, { props: { data, sampleGroups } })

    // Act
    const picker = wrapper.find('select[aria-label="Add sample"]')

    // Assert
    expect(picker.exists()).toBe(false)
  })
})

describe('StrudelFlowBeatsControls track sounds', () => {
  it('offers the host library after the drum shortlist, without repeating it', () => {
    // Arrange
    const wrapper = mount(StrudelFlowBeatsControls, {
      props: { data: createStrudelFlowNodeData('beats'), sampleGroups: SAMPLE_GROUPS }
    })

    // Act
    const trackSelect = wrapper.get('select[aria-label="Track 1 sound"]')
    const libraryGroup = trackSelect
      .findAll('optgroup')
      .find((group) => group.attributes('label') === 'Samples')

    // Assert
    expect(libraryGroup?.findAll('option').map((option) => option.text())).toEqual(['casio'])
  })
})
