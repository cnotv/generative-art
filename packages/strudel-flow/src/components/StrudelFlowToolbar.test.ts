import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StrudelFlowToolbar from './StrudelFlowToolbar.vue'

const mountToolbar = (beatsPerMinute = 120, beatsPerCycle = 4) =>
  mount(StrudelFlowToolbar, { props: { beatsPerMinute, beatsPerCycle } })

describe('StrudelFlowToolbar', () => {
  it.each([
    ['140', 'keydown', [[140]]],
    ['999', 'blur', [[300]]],
    ['120', 'blur', undefined]
  ])('commits a typed tempo of %s on %s as %o', async (typedTempo, commitEvent, emitted) => {
    // Arrange
    const wrapper = mountToolbar()
    const tempoInput = wrapper.get('input[aria-label="Beats per minute"]')

    // Act
    await tempoInput.setValue(typedTempo)
    const emittedWhileTyping = wrapper.emitted('update:beatsPerMinute')
    await (commitEvent === 'blur'
      ? tempoInput.trigger('blur')
      : tempoInput.trigger('keydown.enter'))

    // Assert
    expect(emittedWhileTyping).toBeUndefined()
    expect(wrapper.emitted('update:beatsPerMinute')).toEqual(emitted)
  })

  it('sends the beats per cycle as a number', async () => {
    // Arrange
    const wrapper = mountToolbar()

    // Act
    await wrapper.get('select[aria-label="Beats per cycle"]').setValue('3')

    // Assert
    expect(wrapper.emitted('update:beatsPerCycle')).toEqual([[3]])
  })
})
