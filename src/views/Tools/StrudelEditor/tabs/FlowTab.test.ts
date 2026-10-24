import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FlowTab from './FlowTab.vue'
import type { StrudelFlowCompilation } from '../flow/types'

const validCompilation: StrudelFlowCompilation = {
  code: 'setcpm(120/4)\n$: note("<c3 eb3 g3 bb3>").sound("triangle")',
  errorMessage: null
}

const mountFlowTab = (
  compilation: StrudelFlowCompilation = validCompilation,
  beatsPerMinute = 120
) =>
  mount(FlowTab, {
    props: {
      compilation,
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
    expect(groupTitles).toEqual(['Instruments', 'Effects', 'Generated code'])
    expect(itemTitles).toEqual(['Pad', 'Beats', 'Chords', 'Code', 'Filter', 'Delay', 'Space'])
  })

  it('asks for a node when its Add button is pressed', async () => {
    // Arrange
    const wrapper = mountFlowTab()

    // Act
    await wrapper.find('button[aria-label="Add Beats node"]').trigger('click')

    // Assert
    expect(wrapper.emitted('addNode')).toEqual([['beats']])
  })

  it('shows the compiled patch', () => {
    // Arrange / Act
    const wrapper = mountFlowTab()

    // Assert
    expect(wrapper.find('.strudel-flow-tab__code').text()).toBe(validCompilation.code)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('shows why an empty patch cannot play instead of code', () => {
    // Arrange
    const compilation: StrudelFlowCompilation = {
      code: '',
      errorMessage: 'Add an instrument node such as Pad, Beats, Chords or Code to start a pattern.'
    }

    // Act
    const wrapper = mountFlowTab(compilation)

    // Assert
    expect(wrapper.find('[role="alert"]').text()).toBe(compilation.errorMessage)
    expect(wrapper.find('.strudel-flow-tab__code').exists()).toBe(false)
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
