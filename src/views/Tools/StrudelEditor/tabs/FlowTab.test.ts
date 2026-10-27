import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FlowTab from './FlowTab.vue'

const mountFlowTab = () => mount(FlowTab)

describe('FlowTab', () => {
  it('lists every instrument, effect and sound node under its category', () => {
    // Arrange
    const wrapper = mountFlowTab()

    // Act
    const groupTitles = wrapper
      .findAll('.strudel-flow-tab__group-title')
      .map((title) => title.text())
    const itemTitles = wrapper.findAll('.strudel-flow-tab__item-title').map((title) => title.text())

    // Assert
    expect(groupTitles).toEqual(['Instruments', 'Effects', 'Sounds'])
    expect(itemTitles).toEqual([
      'Pad',
      'Beats',
      'Chords',
      'Notes',
      'Samples',
      'Code',
      'Filter',
      'Delay',
      'Space',
      'Level',
      'Envelope',
      'Visualizer',
      'Effect',
      'Voice'
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

  it('asks for the starter patch when Reset is pressed', async () => {
    // Arrange
    const wrapper = mountFlowTab()

    // Act
    await wrapper.find('.strudel-flow-tab__reset').trigger('click')

    // Assert
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })

  it('credits Strudel Flow by xyflow with links to the app, its makers and its source', () => {
    // Arrange / Act
    const wrapper = mountFlowTab()

    // Assert
    const links = wrapper
      .findAll('.strudel-flow-tab__credit a')
      .map((link) => link.attributes('href'))
    expect(links).toEqual([
      'https://xyflow.com/strudel-flow',
      'https://xyflow.com',
      'https://github.com/xyflow/strudel-flow'
    ])
  })
})
