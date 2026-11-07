import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import StrudelFlowNode from './StrudelFlowNode.vue'

vi.mock('@vue-flow/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vue-flow/core')>()),
  Handle: { template: '<span />' }
}))

describe('StrudelFlowNode options menu', () => {
  it('asks to show the node in the code from Go to code', async () => {
    // Arrange
    const wrapper = mount(StrudelFlowNode, {
      props: { id: 'gain-1', data: { kind: 'gain', gain: 0.5 } }
    })
    await wrapper.get('button[aria-label="Gain options"]').trigger('click')

    // Act
    const goToCode = wrapper
      .findAll('[role="menuitem"]')
      .find((item) => item.text() === 'Go to code')
    await goToCode?.trigger('click')

    // Assert
    expect(wrapper.emitted('showCode')).toEqual([['gain-1']])
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })
})
