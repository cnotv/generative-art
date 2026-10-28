import { afterEach, describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import StrudelEditor from './StrudelEditor.vue'
import { ELECTRO_TUNES, STRUDEL_EXAMPLES, STRUDEL_SAVED_CODE_STORAGE_KEY } from './config'
import type { StrudelCodeMirrorOptions } from './types'

// Vue Flow needs a real layout engine; the browser tests mount it. This stand-in proves the
// view switches between the editor and the canvas while the graph state stays in the view.
vi.mock('@webgamekit/strudel-flow', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    StrudelFlowEditor: {
      name: 'StrudelFlowEditorStub',
      template: '<div class="strudel-flow-editor-stub" />'
    }
  }
})

const { mockPreviewSound } = vi.hoisted(() => ({ mockPreviewSound: vi.fn() }))

// The sound library fetches manifests over the network; the browser tests load the real one.
vi.mock('./strudelSoundLibrary', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./strudelSoundLibrary')>()
  return {
    ...actual,
    loadStrudelSoundLibrary: async () => ({ drumMachines: {} }),
    readStrudelSoundEntries: async () => [
      {
        name: 'bd',
        label: 'Bass drum',
        group: 'Dirt samples',
        type: 'sample',
        tag: '',
        sampleCount: 24
      },
      {
        name: 'casio',
        label: 'Casio',
        group: 'Dirt samples',
        type: 'sample',
        tag: '',
        sampleCount: 3
      },
      {
        name: 'rolandtr909_bd',
        label: 'Bass drum',
        group: 'Roland TR909',
        type: 'sample',
        tag: 'drum-machines',
        sampleCount: 4
      }
    ]
  }
})
vi.mock('./strudelPlayback', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./strudelPlayback')>()),
  previewStrudelSound: mockPreviewSound.mockResolvedValue(undefined)
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

  it('renders the hints tab and the player menu tabs, sounds after patterns', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    const tabButtons = wrapper.findAll('.strudel-editor__tab')

    // Assert
    expect(tabButtons.length).toBe(11)
    const tabLabels = tabButtons.map((tab) => tab.text())
    expect(tabLabels).toEqual([
      'hints',
      'welcome',
      'patterns',
      'sounds',
      'import',
      'midi',
      'reference',
      'export',
      'console',
      'settings',
      'flow'
    ])
  })

  it('lists the sounds by group and readable name, filters them, and previews one', async () => {
    // Arrange
    const wrapper = await mountEditorView()
    await clickTab(wrapper, 'sounds')
    // The tab link moves the hash a task later; wait, or it lands after the cleanup.
    await vi.waitFor(() => expect(window.location.hash).toBe('#sounds'))
    await flushPromises()
    const readSoundGroups = (): string[][] =>
      wrapper
        .findAll('.strudel-sounds__group')
        .map((group) => [
          group.get('.strudel-sounds__group-title').text(),
          ...group.findAll('li').map((item) => item.text().replace(/\s+/g, ' '))
        ])

    // Act
    const allSounds = readSoundGroups()
    await wrapper
      .findAll('.button-selector__btn')
      .find((filterButton) => filterButton.text() === 'drum machines')
      ?.trigger('click')
    const drumMachineSounds = readSoundGroups()
    await wrapper.find('[aria-label="Preview Bass drum, rolandtr909_bd"]').trigger('click')

    // Assert
    expect(allSounds).toEqual([
      ['Dirt samples', 'Bass drum bd (24)', 'Casio (3)'],
      ['Roland TR909', 'Bass drum rolandtr909_bd (4)']
    ])
    expect(drumMachineSounds).toEqual([['Roland TR909', 'Bass drum rolandtr909_bd (4)']])
    expect(mockPreviewSound).toHaveBeenCalledWith('rolandtr909_bd', 'sample')
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

  it('links every tab to its own anchor', async () => {
    // Arrange / Act
    const wrapper = await mountEditorView()

    // Assert
    const links = wrapper.findAll('.strudel-editor__tab').map((tab) => tab.attributes('href'))
    expect(links).toContain('#midi')
    expect(links).toContain('#export')
  })

  it.each([
    ['#midi', 'midi'],
    ['#export', 'export']
  ])('opens the tab named by the anchor %s', async (hash, tabLabel) => {
    // Arrange
    window.history.replaceState(null, '', `${window.location.pathname}${hash}`)

    // Act
    const wrapper = await mountEditorView()

    // Assert
    expect(wrapper.find('.strudel-editor__tab--active').text()).toBe(tabLabel)
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

  it('opens flow mode on the code as it is and writes the code once the patch changes', async () => {
    // Arrange
    const wrapper = await mountEditorView()
    const originalCode = readEditorCode(wrapper)

    // Act
    await clickTab(wrapper, 'flow')
    await vi.waitFor(() => {
      expect(wrapper.find('.strudel-flow-editor-stub').exists()).toBe(true)
    })
    const codeOnOpen = readEditorCode(wrapper)
    await wrapper.find('button[aria-label="Add Notes node"]').trigger('click')
    await flushPromises()
    const codeAfterAdd = readEditorCode(wrapper)
    await clickMode(wrapper, 'Code')

    // Assert
    expect(codeOnOpen).toBe(originalCode)
    expect(codeAfterAdd).toContain('$: s("bd sd, hh*8")')
    expect(codeAfterAdd).toContain('$: note("c3 [e3 g3] a3 [g3 e3]")')
    expect(wrapper.find('.strudel-flow-editor-stub').exists()).toBe(false)
    expect(readEditorCode(wrapper)).toBe(codeAfterAdd)
  })

  it('rebuilds the graph from code and keeps the same code when flow mode opens', async () => {
    // Arrange
    const wrapper = await mountEditorView()
    const code = ['setcpm(100/4)', '$: n("[0 2] [4]").scale("D4:minor").sound("sine")'].join('\n')

    // Act
    await wrapper.find('.fake-strudel-code').setValue(code)
    await clickTab(wrapper, 'flow')
    await vi.waitFor(() => {
      expect(wrapper.find('.strudel-flow-editor-stub').exists()).toBe(true)
    })
    await clickMode(wrapper, 'Code')

    // Assert
    expect(readEditorCode(wrapper)).toBe(code)
  })

  it('shows a flow error in the main editor area instead of the side panel', async () => {
    // Arrange
    localStorage.setItem(STRUDEL_SAVED_CODE_STORAGE_KEY, '')
    const wrapper = await mountEditorView()

    // Act
    await clickTab(wrapper, 'flow')
    await vi.waitFor(() => {
      expect(wrapper.find('.strudel-editor__error').exists()).toBe(true)
    })

    // Assert
    expect(wrapper.find('.strudel-editor__error').text()).toContain('instrument')
    expect(wrapper.find('.strudel-flow-tab [role="alert"]').exists()).toBe(false)
  })

  it('collapses and reopens the side panel', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    await wrapper.find('button[aria-label="Hide side panel"]').trigger('click')
    const collapsed = wrapper.find('.strudel-editor').classes()
    await wrapper.find('button[aria-label="Show side panel"]').trigger('click')

    // Assert
    expect(collapsed).toContain('strudel-editor--side-collapsed')
    expect(wrapper.find('.strudel-editor').classes()).not.toContain(
      'strudel-editor--side-collapsed'
    )
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
