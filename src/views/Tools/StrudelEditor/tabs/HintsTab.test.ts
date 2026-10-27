import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { Select } from '@/components/ui/select'
import { STRUDEL_MUSIC_STYLES, STRUDEL_STYLE_PICKER_DETECT } from '../config'
import type { StrudelHint, StrudelStyleDetection, StrudelStyleSource } from '../types'
import HintsTab from './HintsTab.vue'

const houseStyle = STRUDEL_MUSIC_STYLES.find((style) => style.id === 'house')!

const clapHint: StrudelHint = {
  id: 'instrument-clap',
  kind: 'instrument',
  title: 'Add a clap on two and four',
  reason: 'A clap on the backbeat is the other half of the house groove.',
  snippet: 's("~ cp ~ cp")',
  actionLabel: 'Add',
  edits: [{ from: 0, to: 0, insert: '$: s("~ cp ~ cp")' }]
}

const muteHint: StrudelHint = {
  id: 'review-off-style-3',
  kind: 'review',
  title: 'Mute the melody on line 3',
  reason: "House isn't usually built with melody.",
  snippet: '_$:',
  actionLabel: 'Mute',
  edits: [{ from: 0, to: 0, insert: '_' }]
}

const breakdownHint: StrudelHint = {
  id: 'idea-breakdown',
  kind: 'idea',
  title: 'Drop the drums every fourth bar on line 2',
  reason: 'A bar without drums lets the loop breathe.',
  snippet: '.mask("<1 1 1 0>")',
  actionLabel: 'Add',
  edits: [{ from: 0, to: 0, insert: '.mask("<1 1 1 0>")' }]
}

const mountHintsTab = (detection: StrudelStyleDetection | null, hints: StrudelHint[]) =>
  mount(HintsTab, {
    props: { musicStyles: STRUDEL_MUSIC_STYLES, pickedStyleId: null, detection, hints }
  })

describe('HintsTab', () => {
  it.each([
    { source: 'picker' as StrudelStyleSource, expectedText: 'House, picked here' },
    { source: 'comment' as StrudelStyleSource, expectedText: 'House, from the first-line comment' },
    {
      source: 'code' as StrudelStyleSource,
      expectedText: 'House, guessed from the tempo and sounds'
    }
  ])('says the style came from the $source', ({ source, expectedText }) => {
    // Arrange
    const detection = { style: houseStyle, source }

    // Act
    const wrapper = mountHintsTab(detection, [clapHint])

    // Assert
    expect(wrapper.find('.strudel-hints__style').text()).toContain(expectedText)
  })

  it('shows each hint with its reason, its code and an Add button that applies it', async () => {
    // Arrange
    const wrapper = mountHintsTab({ style: houseStyle, source: 'comment' }, [clapHint])

    // Act
    await wrapper.find('.strudel-hints__item button').trigger('click')

    // Assert
    const hintItem = wrapper.find('.strudel-hints__item')
    expect(hintItem.text()).toContain('Add a clap on two and four')
    expect(hintItem.text()).toContain('the other half of the house groove')
    expect(hintItem.find('code').text()).toBe('s("~ cp ~ cp")')
    expect(wrapper.emitted('apply')).toEqual([['instrument-clap']])
  })

  it.each([
    { name: 'no style', detection: null, expectedText: 'Name a style in the first line' },
    {
      name: 'nothing missing',
      detection: { style: houseStyle, source: 'comment' as StrudelStyleSource },
      expectedText: 'Nothing missing'
    }
  ])('explains an empty list when there is $name', ({ detection, expectedText }) => {
    // Arrange
    const hints: StrudelHint[] = []

    // Act
    const wrapper = mountHintsTab(detection, hints)

    // Assert
    expect(wrapper.find('.strudel-hints__item').exists()).toBe(false)
    expect(wrapper.text()).toContain(expectedText)
  })

  it.each([
    { pickedValue: 'techno', expectedStyleId: 'techno' },
    { pickedValue: STRUDEL_STYLE_PICKER_DETECT, expectedStyleId: null }
  ])('picks $pickedValue from the style picker', ({ pickedValue, expectedStyleId }) => {
    // Arrange
    const wrapper = mountHintsTab(null, [])

    // Act
    wrapper.findComponent(Select).vm.$emit('update:modelValue', pickedValue)

    // Assert
    expect(wrapper.emitted('pick')).toEqual([[expectedStyleId]])
  })

  it('groups the hints into review, missing and keep going, each button labelled by its action', () => {
    // Arrange
    const hints = [muteHint, clapHint, breakdownHint]

    // Act
    const wrapper = mountHintsTab({ style: houseStyle, source: 'comment' }, hints)

    // Assert
    const sections = wrapper.findAll('.strudel-hints__section').map((section) => ({
      title: section.find('.strudel-hints__section-title').text(),
      buttons: section.findAll('button').map((button) => button.attributes('aria-label'))
    }))
    expect(sections).toEqual([
      { title: 'Review what is there', buttons: ['Mute: Mute the melody on line 3'] },
      { title: 'Missing for House', buttons: ['Add: Add a clap on two and four'] },
      { title: 'Keep going', buttons: ['Add: Drop the drums every fourth bar on line 2'] }
    ])
  })

  it('says nothing is missing even while there is still something to review or try', () => {
    // Arrange
    const hints = [muteHint, breakdownHint]

    // Act
    const wrapper = mountHintsTab({ style: houseStyle, source: 'comment' }, hints)

    // Assert
    expect(wrapper.text()).toContain('Nothing missing')
    expect(wrapper.findAll('.strudel-hints__item')).toHaveLength(2)
  })
})
