import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import StrudelFlowBeatsControls from './StrudelFlowBeatsControls.vue'
import StrudelFlowSamplePicker from './StrudelFlowSamplePicker.vue'
import { STRUDEL_FLOW_PREVIEW_SOUND } from '../previewSoundKey'
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
  it('shows each step of the line as a numbered tile rather than mini notation', () => {
    // Arrange / Act
    const wrapper = mountSamples('bd*2 [~ casio] hh')

    // Assert
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(
      wrapper
        .findAll('select[aria-label^="Step"][aria-label$="sample"]')
        .map((select) => select.element.value)
    ).toEqual(['bd', '', 'casio', 'hh'])
    expect(wrapper.findAll('.strudel-flow-sample-steps__tile--group')).toHaveLength(1)
    expect(wrapper.get('select[aria-label="Step 1 plays"]').element.value).toBe('*2')
  })

  it('fills a rest with the sample picked on it', async () => {
    // Arrange
    const wrapper = mountSamples('bd ~ hh')

    // Act
    await wrapper.get('select[aria-label="Step 2 sample"]').setValue('casio')

    // Assert
    expect(emittedPattern(wrapper)).toBe('bd casio hh')
  })

  it.each([
    ['One per cycle', 'bd <sd cp>'],
    ['Fit in one step', 'bd [sd cp]']
  ])('switches a group to %s', async (buttonLabel, expectedPattern) => {
    // Arrange
    const wrapper = mountSamples('bd <sd cp>')

    // Act
    await wrapper.get(`button[aria-label="${buttonLabel}"]`).trigger('click')

    // Assert
    expect(emittedPattern(wrapper)).toBe(expectedPattern)
  })

  it('keeps a modifier the menu does not list', () => {
    // Arrange / Act
    const wrapper = mountSamples('bd@1.5')

    // Assert
    expect(wrapper.get('select[aria-label="Step 1 plays"]').element.value).toBe('@1.5')
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
    ['adds a rest', 'button[aria-label="Add rest"]', 'bd', 'bd ~'],
    ['adds a group', 'button[aria-label="Add group"]', 'bd', 'bd [~]'],
    ['adds a layer', 'button[title="Add a layer that plays alongside"]', 'bd', 'bd, ~'],
    ['removes a layer', 'button[aria-label="Remove layer 2"]', 'bd, hh', 'bd']
  ])('%s', async (_case, selector, pattern, expectedPattern) => {
    // Arrange
    const wrapper = mountSamples(pattern)

    // Act
    await wrapper.get(selector).trigger('click')

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

  it('plays the sound it picks, once, through the host preview', async () => {
    // Arrange
    useFinePointer()
    const previewSound = vi.fn()
    const wrapper = mount(StrudelFlowSamplePicker, {
      props: { label: 'Track 1 sound', modelValue: 'bd', groups: SAMPLE_GROUPS },
      global: { provide: { [STRUDEL_FLOW_PREVIEW_SOUND as symbol]: previewSound } },
      attachTo: document.body
    })
    await nextTick()
    await wrapper.get('button[aria-label="Track 1 sound"]').trigger('click')

    // Act
    await document.body.querySelector<HTMLElement>('button[title^="rolandtr909_bd"]')?.click()

    // Assert
    expect(previewSound).toHaveBeenCalledExactlyOnceWith('rolandtr909_bd')
  })

  it('plays a sample from its play button without picking it', async () => {
    // Arrange
    useFinePointer()
    const previewSound = vi.fn()
    const wrapper = mount(StrudelFlowSamplePicker, {
      props: { label: 'Track 1 sound', modelValue: 'bd', groups: SAMPLE_GROUPS },
      global: { provide: { [STRUDEL_FLOW_PREVIEW_SOUND as symbol]: previewSound } },
      attachTo: document.body
    })
    await nextTick()
    await wrapper.get('button[aria-label="Track 1 sound"]').trigger('click')

    // Act
    document.body
      .querySelector<HTMLElement>('button[aria-label^="Play Bass drum, Roland TR909"]')
      ?.click()
    await nextTick()

    // Assert
    expect(previewSound).toHaveBeenCalledExactlyOnceWith('rolandtr909_bd')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(document.body.querySelector('.strudel-flow-sample-picker')).not.toBeNull()
  })

  it('has no play button when the host gives no preview', async () => {
    // Arrange
    useFinePointer()
    const wrapper = mount(StrudelFlowSamplePicker, {
      props: { label: 'Track 1 sound', modelValue: 'bd', groups: SAMPLE_GROUPS },
      attachTo: document.body
    })
    await nextTick()

    // Act
    await wrapper.get('button[aria-label="Track 1 sound"]').trigger('click')

    // Assert
    expect(document.body.querySelector('.strudel-flow-sample-picker__play')).toBeNull()
  })

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
  })

  it('files a sample under the family its host names, when its own name cannot tell', async () => {
    // Arrange
    useFinePointer()
    const wrapper = mount(StrudelFlowSamplePicker, {
      props: {
        label: 'Voice sound',
        modelValue: 'chainsaw_chord',
        groups: [
          {
            label: 'Electric guitar: chainsaw',
            samples: [{ value: 'chainsaw_chord', label: 'Power chord', familyId: 'strings' }]
          }
        ]
      },
      attachTo: document.body
    })
    await nextTick()

    // Act
    await wrapper.get('button[aria-label="Voice sound"]').trigger('click')

    // Assert
    const activeFamily = document.body.querySelector(
      '.strudel-flow-sample-picker__family[aria-pressed="true"]'
    )
    expect(activeFamily?.textContent).toContain('Guitar and strings')
    expect(optionLabels()).toEqual(['Power chord'])
  })

  it('searches every family once typing starts, not just the one it opened on', async () => {
    // Arrange
    const wrapper = await mountPicker()
    await wrapper.get('button[aria-label="Track 1 sound"]').trigger('click')
    const search = document.body.querySelector<HTMLInputElement>('input[type="search"]')

    // Act
    if (search !== null) {
      search.value = 'casio'
      search.dispatchEvent(new Event('input'))
      await nextTick()
    }

    // Assert
    const activeFamily = document.body.querySelector(
      '.strudel-flow-sample-picker__family[aria-pressed="true"]'
    )
    expect(activeFamily?.textContent).toContain('All')
    expect(optionLabels()).toEqual(['Casio'])
  })

  it('opens on the family of the current sample rather than on all of them', async () => {
    // Arrange
    const wrapper = await mountPicker()

    // Act
    await wrapper.get('button[aria-label="Track 1 sound"]').trigger('click')

    // Assert
    const activeFamily = document.body.querySelector(
      '.strudel-flow-sample-picker__family[aria-pressed="true"]'
    )
    expect(activeFamily?.textContent).toContain('Kicks')
    expect(optionLabels()).toEqual(['Bass drum', 'Bass drum'])
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
