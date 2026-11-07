import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StrudelFlowStructControls from './StrudelFlowStructControls.vue'

const mountStruct = (argument: string) =>
  mount(StrudelFlowStructControls, { props: { data: { kind: 'struct', argument } } })

describe('StrudelFlowStructControls', () => {
  it('turns a step into a hit from its switch', async () => {
    // Arrange
    const wrapper = mountStruct('"x ~ x x"')

    // Act
    await wrapper.get('button[aria-label="Step 2"]').trigger('click')

    // Assert
    expect(wrapper.emitted('update')?.[0]).toEqual([{ kind: 'struct', argument: '"x x x x"' }])
  })

  it('adds a step as a rest', async () => {
    // Arrange
    const wrapper = mountStruct('"x ~ x x"')

    // Act
    await wrapper.get('button[aria-label="Increase steps"]').trigger('click')

    // Assert
    expect(wrapper.emitted('update')?.[0]).toEqual([{ kind: 'struct', argument: '"x ~ x x ~"' }])
  })

  it('edits a euclidean rhythm as text, with no switches', async () => {
    // Arrange
    const wrapper = mountStruct('"x(3,8)"')

    // Act
    await wrapper.get('input[aria-label="Struct pattern"]').setValue('"x(5,8)"')

    // Assert
    expect(wrapper.find('button[aria-label="Step 1"]').exists()).toBe(false)
    expect(wrapper.emitted('update')?.[0]).toEqual([{ kind: 'struct', argument: '"x(5,8)"' }])
  })
})
