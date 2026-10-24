import { afterEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import StrudelEditor from './StrudelEditor.vue'
import { ELECTRO_TUNES, STRUDEL_EXAMPLES, STRUDEL_SAVED_CODE_STORAGE_KEY } from './config'
import type { StrudelCodeMirrorOptions } from './types'

// Vue Flow needs a real layout engine; the browser tests mount it. This stand-in proves the
// view switches between the editor and the canvas while the graph state stays in the view.
vi.mock('./flow/StrudelFlowEditor.vue', () => ({
  __esModule: true,
  default: {
    name: 'StrudelFlowEditorStub',
    template: '<div class="strudel-flow-editor-stub" />'
  }
}))

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

const clearLocationHash = (): void => {
  window.history.replaceState(null, '', window.location.pathname)
}

const clearSavedState = (): void => {
  clearLocationHash()
  localStorage.clear()
}

const readEditorCode = (wrapper: Awaited<ReturnType<typeof mountEditorView>>): string =>
  wrapper.find<HTMLTextAreaElement>('.fake-strudel-code').element.value

const mountEditorView = async () => {
  const wrapper = mount(StrudelEditor)
  // The editor module loads through a dynamic import, which outlasts a promise flush.
  await vi.waitFor(() => {
    expect(wrapper.find('.fake-strudel-code').exists()).toBe(true)
  })
  return wrapper
}

const clickTab = async (
  wrapper: Awaited<ReturnType<typeof mountEditorView>>,
  label: string
): Promise<void> => {
  await wrapper
    .findAll('.strudel-editor__tab')
    .find((tab) => tab.text() === label)
    ?.trigger('click')
}

const clickMode = async (
  wrapper: Awaited<ReturnType<typeof mountEditorView>>,
  label: string
): Promise<void> => {
  await wrapper
    .findAll('.strudel-editor__mode button')
    .find((button) => button.text() === label)
    ?.trigger('click')
}

describe('StrudelEditor view', () => {
  afterEach(clearSavedState)

  it('renders the code, one play button above it and the license note', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    const playButtons = wrapper.findAll('.strudel-editor__play')

    // Assert
    expect(wrapper.find('.fake-strudel-code').exists()).toBe(true)
    expect(playButtons).toHaveLength(1)
    expect(wrapper.find('.strudel-editor__code-header .strudel-editor__play').exists()).toBe(true)
    expect(playButtons[0]?.attributes('aria-label')).toBe('Play')
    expect(wrapper.find('.strudel-editor__license').text()).toContain('AGPL-3.0')
  })

  it.each([
    ['an example menu over the code', '.strudel-editor__code [role="combobox"]'],
    ['a status line', '.strudel-editor__status'],
    ['an error while nothing has failed', '.strudel-editor__error']
  ])('shows no %s', async (_part, selector) => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    const part = wrapper.find(selector)

    // Assert
    expect(part.exists()).toBe(false)
  })

  it('starts with the default example code in the editor', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    const codeField = wrapper.find<HTMLTextAreaElement>('.fake-strudel-code')

    // Assert
    expect(codeField.element.value).toBe('s("bd sd, hh*8")')
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

  it('renders the hints tab and the eight player menu tabs, without the empty sounds tab', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    const tabButtons = wrapper.findAll('.strudel-editor__tab')

    // Assert
    expect(tabButtons.length).toBe(9)
    const tabLabels = tabButtons.map((tab) => tab.text())
    expect(tabLabels).toEqual([
      'hints',
      'welcome',
      'patterns',
      'import',
      'reference',
      'export',
      'console',
      'settings',
      'flow'
    ])
  })

  it('shows the hints tab by default', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    const activeTab = wrapper.find('.strudel-editor__tab--active')
    const hintsContent = wrapper.find('.strudel-hints')

    // Assert
    expect(activeTab.text()).toBe('hints')
    expect(hintsContent.exists()).toBe(true)
  })

  it('switches to the patterns tab and links the examples, then the tunes', async () => {
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
    expect(
      wrapper
        .findAll('.strudel-patterns__link')
        .map((link) => [link.text(), link.attributes('href')])
    ).toEqual(
      [...STRUDEL_EXAMPLES, ...ELECTRO_TUNES].map((pattern) => [pattern.label, `#${pattern.id}`])
    )
  })

  it('saves the code under a name, lists it first, and deletes it', async () => {
    // Arrange
    const wrapper = await mountEditorView()
    await wrapper
      .findAll('.strudel-editor__tab')
      .find((tab) => tab.text() === 'patterns')
      ?.trigger('click')
    await wrapper.find('.fake-strudel-code').setValue('s("cp*3")')

    // Act
    await wrapper.find('input[aria-label="Pattern name"]').setValue('My beat')
    await wrapper.find('.strudel-patterns__save').trigger('submit')
    const groupsAfterSave = wrapper
      .findAll('.strudel-patterns__group-title')
      .map((title) => title.text())
    const savedLink = wrapper.find('.strudel-patterns__link')
    await wrapper.find('button[aria-label="Delete My beat"]').trigger('click')

    // Assert
    expect(groupsAfterSave).toEqual(['Saved', 'Examples', 'Tunes'])
    expect([savedLink.text(), savedLink.attributes('href')]).toEqual(['My beat', '#saved-my-beat'])
    expect(wrapper.findAll('.strudel-patterns__group-title').map((title) => title.text())).toEqual([
      'Examples',
      'Tunes'
    ])
  })

  it('keeps Save disabled until the pattern has a name', async () => {
    // Arrange
    const wrapper = await mountEditorView()
    await wrapper
      .findAll('.strudel-editor__tab')
      .find((tab) => tab.text() === 'patterns')
      ?.trigger('click')

    // Act
    await wrapper.find('input[aria-label="Pattern name"]').setValue('   ')

    // Assert
    expect(wrapper.find('.strudel-patterns__save button').attributes('disabled')).toBeDefined()
  })

  it.each([
    ['an example', STRUDEL_EXAMPLES.at(-1)],
    ['an electro tune', ELECTRO_TUNES[0]]
  ])('loads %s when the address moves to its anchor', async (_kind, pattern) => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    window.location.hash = `#${pattern?.id}`

    // Assert
    await vi.waitFor(() => {
      expect(readEditorCode(wrapper)).toBe(pattern?.code)
    })
  })

  it('opens on the pattern its address names', async () => {
    // Arrange
    window.history.replaceState(null, '', `${window.location.pathname}#${ELECTRO_TUNES[0].id}`)

    // Act
    const wrapper = await mountEditorView()

    // Assert
    expect(readEditorCode(wrapper)).toBe(ELECTRO_TUNES[0].code)
  })

  it.each([
    ['the code saved on the last visit', '', 's("cp*3")'],
    [
      'the pattern its address names, over saved code',
      `#${ELECTRO_TUNES[0].id}`,
      ELECTRO_TUNES[0].code
    ]
  ])('opens on %s', async (_case, hash, expectedCode) => {
    // Arrange
    localStorage.setItem(STRUDEL_SAVED_CODE_STORAGE_KEY, 's("cp*3")')
    window.history.replaceState(null, '', `${window.location.pathname}${hash}`)

    // Act
    const wrapper = await mountEditorView()

    // Assert
    expect(readEditorCode(wrapper)).toBe(expectedCode)
  })

  it('keeps the default example for an anchor that names no pattern', async () => {
    // Arrange
    window.history.replaceState(null, '', `${window.location.pathname}#no-such-pattern`)

    // Act
    const wrapper = await mountEditorView()

    // Assert
    expect(readEditorCode(wrapper)).toBe(STRUDEL_EXAMPLES[0].code)
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

  it('opens flow mode from the flow tab, writes the compiled patch and toggles back', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    await clickTab(wrapper, 'flow')
    await vi.waitFor(() => {
      expect(wrapper.find('.strudel-flow-editor-stub').exists()).toBe(true)
    })
    const generatedCode = readEditorCode(wrapper)
    await clickMode(wrapper, 'Code')

    // Assert
    expect(wrapper.find('.strudel-flow-tab__code').text()).toContain('setcpm(120/4)')
    expect(generatedCode).toBe(
      ['setcpm(120/4)', '$: note("<c3 eb3 g3 bb3>").sound("triangle").lpf(1500).lpq(1)'].join('\n')
    )
    expect(wrapper.find('.strudel-flow-editor-stub').exists()).toBe(false)
    expect(readEditorCode(wrapper)).toBe(generatedCode)
  })

  it('returns to code mode when a listed pattern is picked from flow mode', async () => {
    // Arrange
    const wrapper = await mountEditorView()
    await clickTab(wrapper, 'flow')
    await vi.waitFor(() => {
      expect(wrapper.find('.strudel-flow-editor-stub').exists()).toBe(true)
    })

    // Act
    await clickTab(wrapper, 'patterns')
    const flowStayedOpen = wrapper.find('.strudel-flow-editor-stub').exists()
    await wrapper.find('.strudel-patterns__link').trigger('click')

    // Assert
    expect(flowStayedOpen).toBe(true)
    expect(wrapper.find('.strudel-flow-editor-stub').exists()).toBe(false)
    expect(readEditorCode(wrapper)).toBe(STRUDEL_EXAMPLES[0].code)
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
