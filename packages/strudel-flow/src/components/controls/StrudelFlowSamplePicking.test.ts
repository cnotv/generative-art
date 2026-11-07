import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import StrudelFlowBeatsControls from './StrudelFlowBeatsControls.vue'
import StrudelFlowSamplePicker from './StrudelFlowSamplePicker.vue'
import StrudelFlowSamplesControls from './StrudelFlowSamplesControls.vue'
import { createStrudelFlowNodeData } from '../../nodeDefaults'
import type { StrudelFlowSampleGroup, StrudelFlowSamplesData } from '../../types'

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

const mountSamples = (pattern: string) =>
  mount(StrudelFlowSamplesControls, {
    props: { data: { kind: 'samples', pattern }, sampleGroups: SAMPLE_GROUPS }
  })

const emittedPattern = (wrapper: ReturnType<typeof mountSamples>): string | undefined =>
  (wrapper.emitted('update')?.at(-1)?.[0] as StrudelFlowSamplesData | undefined)?.pattern

const useFinePointer = (): void => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: fine)' }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('StrudelFlowSamplesControls', () => {
  it('shows each step of the line as a control rather than mini notation', () => {
    // Arrange / Act
    const wrapper = mountSamples('bd*2 [~ casio] hh')

    // Assert
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(
      wrapper
        .findAll('select[aria-label^="Step"][aria-label$="sample"]')
        .map((select) => select.element.value)
    ).toEqual(['bd', 'casio', 'hh'])
    expect(wrapper.findAll('.strudel-flow-sample-steps__group')).toHaveLength(1)
  })

  it.each([
    ['adds a picked sample to the end', 'select[aria-label="Add sample"]', 'casio', 'bd sd casio'],
    ['repeats a step', 'select[aria-label="Step 2 plays"]', '*2', 'bd sd*2']
  ])('%s', async (_case, selector, value, expectedPattern) => {
    // Arrange
    const wrapper = mountSamples('bd sd')

    // Act
    await wrapper.get(selector).setValue(value)

    // Assert
    expect(emittedPattern(wrapper)).toBe(expectedPattern)
  })

  it.each([
    ['a rest', 'Rest', 'bd ~'],
    ['a group', 'Group', 'bd [~]'],
    ['a layer', 'Layer', 'bd, ~']
  ])('adds %s', async (_case, buttonText, expectedPattern) => {
    // Arrange
    const wrapper = mountSamples('bd')
    const button = wrapper.findAll('button').find((candidate) => candidate.text() === buttonText)

    // Act
    await button?.trigger('click')

    // Assert
    expect(emittedPattern(wrapper)).toBe(expectedPattern)
  })

  it('drops a group once its last step is removed', async () => {
    // Arrange
    const wrapper = mountSamples('bd [sd]')

    // Act
    await wrapper.get('button[aria-label="Remove sd step 1"]').trigger('click')

    // Assert
    expect(emittedPattern(wrapper)).toBe('bd')
  })

  it('shows the mini notation once switched on', async () => {
    // Arrange
    const wrapper = mountSamples('bd sd')

    // Act
    await wrapper.get('button[aria-label="Show mini notation"]').trigger('click')

    // Assert
    expect(wrapper.emitted('update')?.[0]).toEqual([
      { kind: 'samples', pattern: 'bd sd', showPattern: true }
    ])
  })
})

describe('StrudelFlowSamplePicker on a desktop pointer', () => {
  const mountPicker = async () => {
    useFinePointer()
    const wrapper = mount(StrudelFlowSamplePicker, {
      props: { label: 'Track 1 sound', modelValue: 'bd', groups: SAMPLE_GROUPS },
      attachTo: document.body
    })
    await nextTick()
    return wrapper
  }

  const optionLabels = (): string[] =>
    [...document.body.querySelectorAll('.strudel-flow-sample-picker__option-label')].map(
      (option) => option.textContent ?? ''
    )

  it('opens a searchable list sorted into instrument families', async () => {
    // Arrange
    const wrapper = await mountPicker()

    // Act
    await wrapper.get('button[aria-label="Track 1 sound"]').trigger('click')

    // Assert
    const families = [
      ...document.body.querySelectorAll('.strudel-flow-sample-picker__family span:first-of-type')
    ].map((family) => family.textContent)
    expect(families).toEqual(['All', 'Kicks', 'Keys'])
    expect(optionLabels()).toEqual(['Bass drum', 'Casio', 'Bass drum'])
  })

  it('narrows the list by search and picks the first match on Enter', async () => {
    // Arrange
    const wrapper = await mountPicker()
    await wrapper.get('button[aria-label="Track 1 sound"]').trigger('click')
    const search = document.body.querySelector<HTMLInputElement>('input[type="search"]')

    // Act
    if (search !== null) {
      search.value = '909'
      search.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    }

    // Assert
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['rolandtr909_bd'])
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
