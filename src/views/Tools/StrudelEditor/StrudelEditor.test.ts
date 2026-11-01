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

const { mockPreviewSound, mockEvaluateCode } = vi.hoisted(() => ({
  mockPreviewSound: vi.fn(),
  mockEvaluateCode: vi.fn(async () => ({ success: true }))
}))

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
  previewStrudelSound: mockPreviewSound.mockResolvedValue(undefined),
  loadDefaultStrudelPlayback: async () => ({
    evaluateCode: mockEvaluateCode,
    stopPlayback: async () => undefined,
    readPosition: () => ({ cycle: 0, cyclesPerSecond: 0.5 }),
    seekToCycle: () => undefined,
    measureLoop: () => 1
  })
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

const openDrawer = async (
  wrapper: Awaited<ReturnType<typeof mountEditorView>>,
  label: string
): Promise<void> => {
  await wrapper.find(`button[aria-label="${label}"]`).trigger('click')
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

  it('renders the code with no top play button, and keeps the license note in the drawer', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    const playButtonsBefore = wrapper.findAll('.strudel-editor__play')
    const drawerBefore = wrapper.find('.strudel-editor__drawer').exists()
    await openDrawer(wrapper, 'Settings')

    // Assert
    expect(wrapper.find('.fake-strudel-code').exists()).toBe(true)
    expect(playButtonsBefore).toHaveLength(0)
    expect(drawerBefore).toBe(false)
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

  it('puts the tools in the toolbar as icons, with the help button for hints', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    const toolLabels = wrapper
      .findAll('.strudel-editor__toolbar button')
      .map((button) => button.attributes('aria-label'))

    // Assert
    expect(toolLabels).toEqual([
      'Import',
      'Export',
      'MIDI',
      'Sounds',
      'Console',
      'Settings',
      'Hints'
    ])
  })

  it('lists the sounds by group and readable name, filters them, and previews one', async () => {
    // Arrange
    const wrapper = await mountEditorView()
    await openDrawer(wrapper, 'Sounds')
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

  it('opens the hints in a drawer from the help button and closes it again', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    const hintsBefore = wrapper.find('.strudel-hints').exists()
    await openDrawer(wrapper, 'Hints')
    const hintsOpen = wrapper.find('.strudel-hints').exists()
    await openDrawer(wrapper, 'Hints')

    // Assert
    expect(hintsBefore).toBe(false)
    expect(hintsOpen).toBe(true)
    expect(wrapper.find('.strudel-editor__drawer').exists()).toBe(false)
  })

  it('lists examples and songs as collapsible groups in the import drawer', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    await openDrawer(wrapper, 'Import')
    const triggers = wrapper.findAll('.strudel-patterns button[aria-expanded]')
    await Promise.all(triggers.map((trigger) => trigger.trigger('click')))

    // Assert
    expect(triggers.map((trigger) => trigger.text())).toEqual([
      `Examples (${STRUDEL_EXAMPLES.length})`,
      `Songs (${ELECTRO_TUNES.length})`
    ])
    expect(
      wrapper
        .findAll('.strudel-patterns__link')
        .map((link) => [link.text(), link.attributes('href')])
    ).toEqual(
      [...STRUDEL_EXAMPLES, ...ELECTRO_TUNES].map((pattern) => [pattern.label, `#${pattern.id}`])
    )
  })

  it('keeps the five songs and adds one for each style', () => {
    // Arrange / Act
    const labels = ELECTRO_TUNES.map((song) => song.label)

    // Assert
    expect(labels).toEqual([
      'Caverave',
      'Dinofunk',
      'Megalovania riff (Toby Fox)',
      'Breakfast in America (Supertramp)',
      'Come as You Are riff (Nirvana)',
      'Concrete Hours (techno)',
      'Second Floor (house)',
      'Long Way Down (drum and bass)',
      'Corner Store (hip hop)',
      'Tideline (ambient)',
      'Lift Off (trance)',
      'Harbour Steps (dub)',
      'Wire Fence (breakbeat)',
      'Neon Drive (synthwave)',
      'Dust and Diesel (stoner rock)',
      'Rust and Rain (grunge)',
      'Winter Court (classical)',
      'Uptown Strut (funk)',
      'Blue Hour (jazz)'
    ])
  })

  it('saves the code under the export name, lists it first in import, and deletes it', async () => {
    // Arrange
    const wrapper = await mountEditorView()
    await wrapper.find('.fake-strudel-code').setValue('s("cp*3")')
    await openDrawer(wrapper, 'Export')
    const saveButton = wrapper
      .findAll('.strudel-export__button')
      .find((button) => button.text() === 'Save pattern')
    const disabledWithoutName = saveButton?.attributes('disabled') !== undefined

    // Act
    await wrapper.find('.strudel-export input').setValue('My beat')
    await saveButton?.trigger('click')
    await openDrawer(wrapper, 'Import')
    const savedTrigger = wrapper.find('.strudel-patterns button[aria-expanded]')
    await savedTrigger.trigger('click')
    const savedLink = wrapper.find('.strudel-patterns__link')
    await wrapper.find('button[aria-label="Delete My beat"]').trigger('click')

    // Assert
    expect(disabledWithoutName).toBe(true)
    expect(savedTrigger.text()).toBe('Saved (1)')
    expect([savedLink.text(), savedLink.attributes('href')]).toEqual(['My beat', '#saved-my-beat'])
    expect(wrapper.find('button[aria-label="Delete My beat"]').exists()).toBe(false)
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

  it('plays a song as soon as it is clicked', async () => {
    // Arrange
    mockEvaluateCode.mockClear()
    const wrapper = await mountEditorView()
    await openDrawer(wrapper, 'Import')
    const triggers = wrapper.findAll('.strudel-patterns button[aria-expanded]')
    await Promise.all(triggers.map((trigger) => trigger.trigger('click')))
    const songLink = wrapper
      .findAll('.strudel-patterns__link')
      .find((link) => link.attributes('href') === `#${ELECTRO_TUNES[1].id}`)

    // Act
    await songLink?.trigger('click')

    // Assert
    await vi.waitFor(() => {
      expect(mockEvaluateCode).toHaveBeenCalledWith(ELECTRO_TUNES[1].code)
    })
    expect(readEditorCode(wrapper)).toBe(ELECTRO_TUNES[1].code)
  })

  it('stays silent when the address opens a pattern', async () => {
    // Arrange
    mockEvaluateCode.mockClear()
    const wrapper = await mountEditorView()

    // Act
    window.location.hash = `#${ELECTRO_TUNES[1].id}`
    await vi.waitFor(() => {
      expect(readEditorCode(wrapper)).toBe(ELECTRO_TUNES[1].code)
    })
    await flushPromises()

    // Assert
    expect(mockEvaluateCode).not.toHaveBeenCalled()
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

  it.each([
    ['#midi', 'MIDI'],
    ['#export', 'Export']
  ])('opens the drawer named by the anchor %s', async (hash, drawerTitle) => {
    // Arrange
    window.history.replaceState(null, '', `${window.location.pathname}${hash}`)

    // Act
    const wrapper = await mountEditorView()

    // Assert
    expect(wrapper.find('.strudel-editor__drawer-title').text()).toBe(drawerTitle)
    expect(readEditorCode(wrapper)).toBe(STRUDEL_EXAMPLES[0].code)
  })

  it('opens the console drawer', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    await openDrawer(wrapper, 'Console')

    // Assert
    expect(wrapper.find('.strudel-console').exists()).toBe(true)
  })

  it('opens flow mode on the code as it is and writes the code once the patch changes', async () => {
    // Arrange
    const wrapper = await mountEditorView()
    const originalCode = readEditorCode(wrapper)

    // Act
    await clickMode(wrapper, 'Flow')
    await vi.waitFor(() => {
      expect(wrapper.find('.strudel-flow-editor-stub').exists()).toBe(true)
    })
    await openDrawer(wrapper, 'Nodes')
    const codeOnOpen = readEditorCode(wrapper)
    // The palette renders with the flow tab, which can land a tick after the canvas on a slow run.
    await vi.waitFor(() => {
      expect(wrapper.find('button[aria-label="Add Notes node"]').exists()).toBe(true)
    })
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
    await clickMode(wrapper, 'Flow')
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
    await clickMode(wrapper, 'Flow')
    await vi.waitFor(() => {
      expect(wrapper.find('.strudel-editor__error').exists()).toBe(true)
    })

    // Assert
    expect(wrapper.find('.strudel-editor__error').text()).toContain('instrument')
    expect(wrapper.find('.strudel-flow-tab [role="alert"]').exists()).toBe(false)
  })

  it('returns to code mode when a listed pattern is picked from flow mode', async () => {
    // Arrange
    const wrapper = await mountEditorView()
    await clickMode(wrapper, 'Flow')
    await vi.waitFor(() => {
      expect(wrapper.find('.strudel-flow-editor-stub').exists()).toBe(true)
    })

    // Act
    await openDrawer(wrapper, 'Import')
    const flowStayedOpen = wrapper.find('.strudel-flow-editor-stub').exists()
    await wrapper.find('.strudel-patterns button[aria-expanded]').trigger('click')
    await wrapper.find('.strudel-patterns__link').trigger('click')

    // Assert
    expect(flowStayedOpen).toBe(true)
    expect(wrapper.find('.strudel-flow-editor-stub').exists()).toBe(false)
    expect(readEditorCode(wrapper)).toBe(STRUDEL_EXAMPLES[0].code)
  })

  it('opens the settings drawer', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    await openDrawer(wrapper, 'Settings')

    // Assert
    expect(wrapper.find('.strudel-settings').exists()).toBe(true)
  })

  it('shows the Nodes tool only in flow mode', async () => {
    // Arrange
    const wrapper = await mountEditorView()

    // Act
    const inCodeMode = wrapper.find('button[aria-label="Nodes"]').exists()
    await clickMode(wrapper, 'Flow')
    const inFlowMode = wrapper.find('button[aria-label="Nodes"]').exists()

    // Assert
    expect(inCodeMode).toBe(false)
    expect(inFlowMode).toBe(true)
  })
})
