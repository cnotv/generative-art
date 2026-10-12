import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StrudelEditor from './StrudelEditor.vue'
import { STRUDEL_EXAMPLES } from './config'

describe('StrudelEditor view', () => {
  it('renders the editor shell with code, actions and license note', () => {
    // Arrange
    const wrapper = mount(StrudelEditor)

    // Act
    const editorRoot = wrapper.find('.strudel-editor')
    const codeField = wrapper.find('.strudel-editor__code')
    const playButton = wrapper.findAll('button').find((button) => button.text() === 'Play')
    const stopButton = wrapper.findAll('button').find((button) => button.text() === 'Stop')
    const licenseNote = wrapper.find('.strudel-editor__license')

    // Assert
    expect(editorRoot.exists()).toBe(true)
    expect(codeField.exists()).toBe(true)
    expect(playButton?.exists()).toBe(true)
    expect(stopButton?.exists()).toBe(true)
    expect(licenseNote.text()).toContain('AGPL-3.0')
  })

  it('starts with the default example code in the editor', () => {
    // Arrange
    const defaultCode = STRUDEL_EXAMPLES[0].code

    // Act
    const wrapper = mount(StrudelEditor)
    const codeField = wrapper.find<HTMLTextAreaElement>('.strudel-editor__code')

    // Assert
    expect(codeField.element.value).toBe(defaultCode)
  })

  it('shows the idle hint before anything plays', () => {
    // Arrange
    const wrapper = mount(StrudelEditor)

    // Act
    const statusText = wrapper.find('.strudel-editor__status').text()

    // Assert
    expect(statusText).toContain('Idle')
  })

  it('keeps Stop disabled until a pattern is playing', () => {
    // Arrange
    const wrapper = mount(StrudelEditor)

    // Act
    const stopButton = wrapper.findAll('button').find((button) => button.text() === 'Stop')

    // Assert
    expect(stopButton?.attributes('disabled')).toBeDefined()
  })

  it('updates the code as the player types', async () => {
    // Arrange
    const wrapper = mount(StrudelEditor)
    const codeField = wrapper.find('.strudel-editor__code')

    // Act
    await codeField.setValue('s("hh*8")')

    // Assert
    expect((codeField.element as HTMLTextAreaElement).value).toBe('s("hh*8")')
  })
})
