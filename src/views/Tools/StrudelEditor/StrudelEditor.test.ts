import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StrudelEditor from './StrudelEditor.vue'
import { ELECTRO_TUNES } from './config'

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
    const wrapper = mount(StrudelEditor)

    // Act
    const codeField = wrapper.find<HTMLTextAreaElement>('.strudel-editor__code')

    // Assert
    expect(codeField.element.value).toBe('s("bd sd, hh*8")')
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

  it('renders all eight player menu tabs', () => {
    // Arrange
    const wrapper = mount(StrudelEditor)

    // Act
    const tabButtons = wrapper.findAll('.strudel-editor__tab')

    // Assert
    expect(tabButtons.length).toBe(8)
    const tabLabels = tabButtons.map((tab) => tab.text())
    expect(tabLabels).toEqual([
      'welcome',
      'patterns',
      'import',
      'sounds',
      'reference',
      'export',
      'console',
      'settings'
    ])
  })

  it('shows the welcome tab by default', () => {
    // Arrange
    const wrapper = mount(StrudelEditor)

    // Act
    const activeTab = wrapper.find('.strudel-editor__tab--active')
    const welcomeContent = wrapper.find('.strudel-welcome')

    // Assert
    expect(activeTab.text()).toBe('welcome')
    expect(welcomeContent.exists()).toBe(true)
  })

  it('switches to the patterns tab and lists electro tunes', async () => {
    // Arrange
    const wrapper = mount(StrudelEditor)

    // Act
    const patternsTab = wrapper
      .findAll('.strudel-editor__tab')
      .find((tab) => tab.text() === 'patterns')
    await patternsTab?.trigger('click')

    // Assert
    expect(wrapper.find('.strudel-patterns').exists()).toBe(true)
    const patternButtons = wrapper.findAll('.strudel-patterns__button')
    expect(patternButtons.length).toBe(ELECTRO_TUNES.length)
  })

  it('loads an electro tune into the editor when clicked', async () => {
    // Arrange
    const wrapper = mount(StrudelEditor)
    const patternsTab = wrapper
      .findAll('.strudel-editor__tab')
      .find((tab) => tab.text() === 'patterns')
    await patternsTab?.trigger('click')
    const firstTuneButton = wrapper.find('.strudel-patterns__button')

    // Act
    await firstTuneButton.trigger('click')

    // Assert
    const codeField = wrapper.find<HTMLTextAreaElement>('.strudel-editor__code')
    expect(codeField.element.value).toBe(ELECTRO_TUNES[0].code)
  })

  it('switches to the console tab', async () => {
    // Arrange
    const wrapper = mount(StrudelEditor)

    // Act
    const consoleTab = wrapper
      .findAll('.strudel-editor__tab')
      .find((tab) => tab.text() === 'console')
    await consoleTab?.trigger('click')

    // Assert
    expect(wrapper.find('.strudel-console').exists()).toBe(true)
  })

  it('switches to the settings tab', async () => {
    // Arrange
    const wrapper = mount(StrudelEditor)

    // Act
    const settingsTab = wrapper
      .findAll('.strudel-editor__tab')
      .find((tab) => tab.text() === 'settings')
    await settingsTab?.trigger('click')

    // Assert
    expect(wrapper.find('.strudel-settings').exists()).toBe(true)
  })
})
