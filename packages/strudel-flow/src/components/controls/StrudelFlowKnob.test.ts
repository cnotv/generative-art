import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StrudelFlowKnob from './StrudelFlowKnob.vue'

const mountKnob = () =>
  mount(StrudelFlowKnob, {
    props: {
      label: 'Cutoff',
      modelValue: 1500,
      min: 20,
      max: 20000,
      step: 10,
      suffix: 'Hz'
    }
  })

describe('StrudelFlowKnob', () => {
  it('exposes the value as a named range input', () => {
    const wrapper = mountKnob()
    const input = wrapper.get('input[type="range"]')

    expect(input.attributes('aria-label')).toBe('Cutoff')
    expect(input.attributes('min')).toBe('20')
    expect(input.attributes('max')).toBe('20000')
    expect(input.attributes('step')).toBe('10')
    expect(input.element.value).toBe('1500')
    expect(wrapper.text()).toContain('1500')
    expect(wrapper.text()).toContain('Hz')
  })

  it('emits the numeric value when the range input changes', async () => {
    const wrapper = mountKnob()
    const input = wrapper.get('input[type="range"]')

    await input.setValue('4000')

    expect(wrapper.emitted('update:modelValue')).toEqual([[4000]])
  })

  it('turns the indicator to the value angle', () => {
    const wrapper = mountKnob()
    const indicator = wrapper.get('.strudel-flow-knob__indicator')

    // (1500 - 20) / (20000 - 20) through a 270-degree sweep that starts at -135.
    expect(indicator.attributes('style')).toContain('rotate(-115deg)')
  })
})
