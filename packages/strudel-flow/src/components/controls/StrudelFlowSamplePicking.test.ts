import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StrudelFlowBeatsControls from './StrudelFlowBeatsControls.vue'
import StrudelFlowPatternControls from './StrudelFlowPatternControls.vue'
import { createStrudelFlowNodeData } from '../../nodeDefaults'
import type { StrudelFlowSampleGroup } from '../../types'

const SAMPLE_GROUPS: StrudelFlowSampleGroup[] = [
  {
    label: 'Dirt samples',
    samples: [
      { value: 'bd', label: 'Bass drum' },
      { value: 'casio', label: 'Casio' }
    ]
  },
  { label: 'Roland TR909', samples: [{ value: 'rolandtr909_bd', label: 'Bass drum' }] }
]

describe('StrudelFlowPatternControls sample picker', () => {
  it('adds the picked sample to the end of the Samples pattern', async () => {
    // Arrange
    const wrapper = mount(StrudelFlowPatternControls, {
      props: { data: { kind: 'samples', pattern: 'bd*2 ' }, sampleGroups: SAMPLE_GROUPS }
    })
    const picker = wrapper.get('select[aria-label="Add sample"]')

    // Act
    await picker.setValue('rolandtr909_bd')

    // Assert
    expect(wrapper.emitted('update')?.[0]).toEqual([
      { kind: 'samples', pattern: 'bd*2 rolandtr909_bd' }
    ])
    const groups = picker.findAll('optgroup').map((group) => ({
      label: group.attributes('label'),
      options: group.findAll('option').map((option) => option.text())
    }))
    expect(groups).toEqual([
      { label: 'Dirt samples', options: ['Bass drum', 'Casio'] },
      { label: 'Roland TR909', options: ['Bass drum'] }
    ])
  })

  it.each([
    [
      'a Notes node',
      { kind: 'notes' as const, pattern: 'c3 e3', notation: 'auto' as const },
      SAMPLE_GROUPS
    ],
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
  it('offers the host library by readable name after the drum shortlist, without repeating it', () => {
    // Arrange
    const wrapper = mount(StrudelFlowBeatsControls, {
      props: { data: createStrudelFlowNodeData('beats'), sampleGroups: SAMPLE_GROUPS }
    })

    // Act
    const trackSelect = wrapper.get('select[aria-label="Track 1 sound"]')
    const libraryGroup = trackSelect
      .findAll('optgroup')
      .find((group) => group.attributes('label') === 'Dirt samples')

    // Assert
    expect(libraryGroup?.findAll('option').map((option) => option.text())).toEqual(['Casio'])
    expect(libraryGroup?.find('option').attributes('value')).toBe('casio')
  })
})
