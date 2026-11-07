import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StrudelFlowMaskControls from './StrudelFlowMaskControls.vue'

const mountMask = (argument: string) =>
  mount(StrudelFlowMaskControls, { props: { data: { kind: 'mask', argument } } })

describe('StrudelFlowMaskControls', () => {
  it('turns a cycle off from its switch', async () => {
    // Arrange
    const wrapper = mountMask('"<1 1 1 0>"')

    // Act
    await wrapper.get('button[aria-label="Cycle 2"]').trigger('click')

    // Assert
    expect(wrapper.emitted('update')?.[0]).toEqual([{ kind: 'mask', argument: '"<1 0 1 0>"' }])
  })

  it.each(['"<1!40 0!8>"', 'body'])('edits %s as text, with no switches', async (argument) => {
    // Arrange
    const wrapper = mountMask(argument)

    // Act
    await wrapper.get('input[aria-label="Mask pattern"]').setValue('"1 0"')

    // Assert
    expect(wrapper.find('button[aria-label="Cycle 1"]').exists()).toBe(false)
    expect(wrapper.emitted('update')?.[0]).toEqual([{ kind: 'mask', argument: '"1 0"' }])
  })
})
