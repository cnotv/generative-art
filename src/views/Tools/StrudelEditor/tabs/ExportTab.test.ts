import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ExportTab from './ExportTab.vue'

const mountExportTab = (repetitionCycles: number | null) =>
  mount(ExportTab, { props: { status: 'idle', errorMessage: '', repetitionCycles } })

const readCycleCount = (wrapper: ReturnType<typeof mountExportTab>): string =>
  (wrapper.findAll('input[type="number"]')[1]!.element as HTMLInputElement).value

describe('ExportTab cycle count', () => {
  it('fills in the length of the whole song once it is measured', async () => {
    // Arrange
    const wrapper = mountExportTab(null)

    // Act
    await wrapper.setProps({ repetitionCycles: 20 })

    // Assert
    expect(readCycleCount(wrapper)).toBe('20')
  })

  it('keeps a pattern that repeats inside a bar, such as the coin, at one cycle', async () => {
    // Arrange
    const wrapper = mountExportTab(null)

    // Act
    await wrapper.setProps({ repetitionCycles: 0.5 })

    // Assert
    expect(readCycleCount(wrapper)).toBe('1')
  })

  it('uses a length measured before the tab opened', () => {
    // Act
    const wrapper = mountExportTab(12)

    // Assert
    expect(readCycleCount(wrapper)).toBe('12')
  })

  it('keeps a cycle count typed by hand when the song is measured again', async () => {
    // Arrange
    const wrapper = mountExportTab(8)
    await wrapper.findAll('input[type="number"]')[1]!.setValue('3')

    // Act
    await wrapper.setProps({ repetitionCycles: 20 })

    // Assert
    expect(readCycleCount(wrapper)).toBe('3')
  })

  it('sets a single repetition, even a fraction of a cycle, when asked', async () => {
    // Arrange
    const wrapper = mountExportTab(0.5)
    const repetitionButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'One repetition')!

    // Act
    await repetitionButton.trigger('click')

    // Assert
    expect(readCycleCount(wrapper)).toBe('0.5')
    expect(wrapper.emitted('measureRepetition')).toHaveLength(1)
  })
})

describe('ExportTab save feedback', () => {
  const findSave = (wrapper: ReturnType<typeof mountExportTab>) =>
    wrapper.findAll('button').find((button) => button.text() === 'Save pattern')!

  it('says the pattern was saved, and clears it when the name changes', async () => {
    // Arrange
    const wrapper = mountExportTab(null)
    await wrapper.find('input').setValue('My song')

    // Act
    await findSave(wrapper).trigger('click')

    // Assert
    expect(wrapper.emitted('save')).toEqual([['My song']])
    expect(wrapper.text()).toContain('Saved "My song" in this browser.')
    await wrapper.find('input').setValue('Other')
    expect(wrapper.text()).not.toContain('Saved')
  })
})
