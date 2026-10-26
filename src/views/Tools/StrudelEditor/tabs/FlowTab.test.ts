import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FlowTab from './FlowTab.vue'

const mountFlowTab = (beatsPerMinute = 120) =>
  mount(FlowTab, {
    props: {
      beatsPerMinute
    }
  })

describe('FlowTab', () => {
  it('lists every instrument and effect node under its category', () => {
    // Arrange
    const wrapper = mountFlowTab()

    // Act
    const groupTitles = wrapper
      .findAll('.strudel-flow-tab__group-title')
      .map((title) => title.text())
    const itemTitles = wrapper.findAll('.strudel-flow-tab__item-title').map((title) => title.text())

    // Assert
    expect(groupTitles).toEqual(['Instruments', 'Effects'])
    expect(itemTitles).toEqual([
      'Pad',
      'Beats',
      'Chords',
      'Code',
      'Filter',
      'Delay',
      'Space',
      'Level',
      'Envelope',
      'Scope'
    ])
  })

  it('asks for a node when its Add button is pressed', async () => {
    // Arrange
    const wrapper = mountFlowTab()

    // Act
    await wrapper.find('button[aria-label="Add Beats node"]').trigger('click')

    // Assert
    expect(wrapper.emitted('addNode')).toEqual([['beats']])
  })

  it('does not duplicate the generated code in the side panel', () => {
    // Arrange / Act
    const wrapper = mountFlowTab()

    // Assert
    expect(wrapper.text()).not.toContain('Generated code')
    expect(wrapper.find('pre').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('sends a tempo typed in its range as it changes', async () => {
    // Arrange
    const wrapper = mountFlowTab()

    // Act
    await wrapper.find('#strudel-flow-tempo').setValue('140')

    // Assert
    expect(wrapper.emitted('update:beatsPerMinute')).toEqual([[140]])
  })

  it('does not send a tempo it has already sent when the field is left', async () => {
    // Arrange
    const wrapper = mountFlowTab()

    // Act
    await wrapper.find('#strudel-flow-tempo').setValue('140')
    await wrapper.setProps({ beatsPerMinute: 140 })
    await wrapper.find('#strudel-flow-tempo').trigger('blur')

    // Assert
    expect(wrapper.emitted('update:beatsPerMinute')).toEqual([[140]])
  })

  it('brings a tempo outside the range back inside when the field is left', async () => {
    // Arrange
    const wrapper = mountFlowTab()

    // Act
    await wrapper.find('#strudel-flow-tempo').setValue('999')
    const tempoWhileTyping = wrapper.emitted('update:beatsPerMinute')
    await wrapper.find('#strudel-flow-tempo').trigger('blur')

    // Assert
    expect(tempoWhileTyping).toBeUndefined()
    expect(wrapper.emitted('update:beatsPerMinute')).toEqual([[300]])
  })

  it('asks for the starter patch when Reset is pressed', async () => {
    // Arrange
    const wrapper = mountFlowTab()

    // Act
    await wrapper.find('.strudel-flow-tab__reset').trigger('click')

    // Assert
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })
})
