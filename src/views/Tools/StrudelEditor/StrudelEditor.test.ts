import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import StrudelEditor from './StrudelEditor.vue'
import { ELECTRO_TUNES, STRUDEL_EXAMPLES } from './config'
import type { StrudelCodeMirrorOptions } from './types'

// CodeMirror and the Strudel engine only load in a real browser; the browser tests cover
// them. This stand-in keeps the code in a textarea so the view wiring can be checked.
vi.mock('./codeEditor/createStrudelCodeMirror', () => ({
  createStrudelCodeMirror: (options: StrudelCodeMirrorOptions) => {
    const codeField = document.createElement('textarea')
    codeField.className = 'fake-strudel-code'
    codeField.value = options.initialCode
    codeField.addEventListener('input', () => options.onCodeChange(codeField.value))
    options.parent.append(codeField)
    return {
      setCode: (patternCode: string) => {
        const changed = codeField.value !== patternCode
        codeField.value = patternCode
        return changed
      },
      applyEvaluation: () => undefined,
      highlight: () => undefined,
      clearHighlights: () => undefined,
      destroy: () => codeField.remove()
    }
  }
}))

const mountEditorView = async () => {
  const wrapper = mount(StrudelEditor)
  // The editor module loads through a dynamic import, which outlasts a promise flush.
  await vi.waitFor(() => {
    expect(wrapper.find('.fake-strudel-code').exists()).toBe(true)
  })
  return wrapper
}

describe('StrudelEditor view', () => {
  it('renders the editor shell with code, actions and license note', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    const editorRoot = wrapper.find('.strudel-editor')
    const codeField = wrapper.find('.fake-strudel-code')
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

  it('starts with the default example code in the editor', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    const codeField = wrapper.find<HTMLTextAreaElement>('.fake-strudel-code')

    // Assert
    expect(codeField.element.value).toBe('s("bd sd, hh*8")')
  })

  it('shows the idle hint before anything plays', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    const statusText = wrapper.find('.strudel-editor__status').text()

    // Assert
    expect(statusText).toContain('Idle')
  })

  it('keeps Stop disabled until a pattern is playing', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    const stopButton = wrapper.findAll('button').find((button) => button.text() === 'Stop')

    // Assert
    expect(stopButton?.attributes('disabled')).toBeDefined()
  })

  it('updates the code as the player types', async () => {
    // Arrange
    const wrapper = await mountEditorView()
    const codeField = wrapper.find('.fake-strudel-code')

    // Act
    await codeField.setValue('s("hh*8")')

    // Assert
    expect((codeField.element as HTMLTextAreaElement).value).toBe('s("hh*8")')
  })

  it('renders all eight player menu tabs', async () => {
    // Arrange
    const wrapper = await mountEditorView()

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

  it('shows the welcome tab by default', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    const activeTab = wrapper.find('.strudel-editor__tab--active')
    const welcomeContent = wrapper.find('.strudel-welcome')

    // Assert
    expect(activeTab.text()).toBe('welcome')
    expect(welcomeContent.exists()).toBe(true)
  })

  it('switches to the patterns tab and lists the examples, then the tunes', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    const patternsTab = wrapper
      .findAll('.strudel-editor__tab')
      .find((tab) => tab.text() === 'patterns')
    await patternsTab?.trigger('click')

    // Assert
    expect(wrapper.findAll('.strudel-patterns__group-title').map((title) => title.text())).toEqual([
      'Examples',
      'Tunes'
    ])
    expect(wrapper.findAll('.strudel-patterns__button').map((button) => button.text())).toEqual([
      ...STRUDEL_EXAMPLES.map((example) => example.label),
      ...ELECTRO_TUNES.map((tune) => tune.label)
    ])
  })

  it.each([
    ['an example', STRUDEL_EXAMPLES.at(-1)],
    ['an electro tune', ELECTRO_TUNES[0]]
  ])('loads %s into the editor when clicked', async (_kind, pattern) => {
    // Arrange
    const wrapper = await mountEditorView()
    const patternsTab = wrapper
      .findAll('.strudel-editor__tab')
      .find((tab) => tab.text() === 'patterns')
    await patternsTab?.trigger('click')
    const patternButton = wrapper
      .findAll('.strudel-patterns__button')
      .find((button) => button.text() === pattern?.label)

    // Act
    await patternButton?.trigger('click')

    // Assert
    const codeField = wrapper.find<HTMLTextAreaElement>('.fake-strudel-code')
    expect(codeField.element.value).toBe(pattern?.code)
  })

  it('switches to the console tab', async () => {
    // Arrange
    const wrapper = await mountEditorView()

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
    const wrapper = await mountEditorView()

    // Act
    const settingsTab = wrapper
      .findAll('.strudel-editor__tab')
      .find((tab) => tab.text() === 'settings')
    await settingsTab?.trigger('click')

    // Assert
    expect(wrapper.find('.strudel-settings').exists()).toBe(true)
  })
})
