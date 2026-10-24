import { afterEach, describe, it, expect, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { getWidgetID, transpiler } from '@strudel/transpiler'
import { setWidget } from '@strudel/codemirror'
import { createStrudelCodeMirror } from './createStrudelCodeMirror'
import type { StrudelCodeMirror } from '../types'

const COMPLETION_INTERACTION_DELAY_MS = 150
const SLIDER_CODE = 'note("c3 e3").lpf(slider(500, 100, 2000, 10))'

const mountedEditors: { parent: HTMLElement; editor: StrudelCodeMirror }[] = []

const mountEditor = (initialCode: string) => {
  const parent = document.createElement('div')
  document.body.append(parent)
  const onCodeChange = vi.fn()
  const onEvaluate = vi.fn()
  const onStop = vi.fn()
  const editor = createStrudelCodeMirror({
    parent,
    initialCode,
    ariaLabel: 'Live code pattern',
    onCodeChange,
    onEvaluate,
    onStop
  })
  mountedEditors.push({ parent, editor })
  return { parent, editor, onCodeChange, onEvaluate, onStop }
}

const editorText = (parent: HTMLElement): string =>
  [...parent.querySelectorAll('.cm-line')].map((line) => line.textContent).join('\n')

// Stands in for the canvases `_pianoroll()` and `_scope()` create while a pattern evaluates.
const registerWidgetCanvases = (widgets: unknown[]): void => {
  widgets
    .filter((widget) => typeof widget === 'object' && widget !== null && 'index' in widget)
    .forEach((widget) => {
      const canvas = document.createElement('canvas')
      canvas.dataset.widget = getWidgetID(widget)
      setWidget(getWidgetID(widget), canvas)
    })
}

const transpiledMeta = (code: string) => {
  const { miniLocations, widgets } = transpiler(code, {
    emitMiniLocations: true,
    emitWidgets: true
  })
  return { miniLocations, widgets }
}

afterEach(() => {
  mountedEditors.splice(0).forEach(({ parent, editor }) => {
    editor.destroy()
    parent.remove()
  })
})

describe('createStrudelCodeMirror', () => {
  it('shows the initial code with an accessible label', () => {
    // Arrange
    const { parent } = mountEditor('s("bd sd")')

    // Act
    const content = parent.querySelector('.cm-content')

    // Assert
    expect(editorText(parent)).toBe('s("bd sd")')
    expect(content?.getAttribute('aria-label')).toBe('Live code pattern')
  })

  it.each([
    ['different code', 's("hh*8")', true, 's("hh*8")'],
    ['the same code', 's("bd")', false, 's("bd")']
  ])(
    'replaces the code with %s and reports whether it changed',
    (_label, nextCode, expectedChanged, expectedText) => {
      // Arrange
      const { parent, editor } = mountEditor('s("bd")')

      // Act
      const changed = editor.setCode(nextCode)

      // Assert
      expect(changed).toBe(expectedChanged)
      expect(editorText(parent)).toBe(expectedText)
    }
  )

  it.each([
    ['Ctrl-Enter', { key: 'Enter', ctrlKey: true }, 'onEvaluate'],
    ['Alt-Enter', { key: 'Enter', altKey: true }, 'onEvaluate'],
    ['Ctrl-.', { key: '.', ctrlKey: true }, 'onStop']
  ] as const)('runs %s as in strudel.cc', (_label, keyInit, expectedHandler) => {
    // Arrange
    const mounted = mountEditor('s("bd")')
    const content = mounted.parent.querySelector('.cm-content')

    // Act
    content?.dispatchEvent(new KeyboardEvent('keydown', { ...keyInit, bubbles: true }))

    // Assert
    expect(mounted[expectedHandler]).toHaveBeenCalledTimes(1)
  })

  it('draws an inline slider where the code calls slider()', () => {
    // Arrange
    const { parent, editor } = mountEditor(SLIDER_CODE)

    // Act
    editor.applyEvaluation(transpiledMeta(SLIDER_CODE))

    // Assert
    const sliderInput = parent.querySelector<HTMLInputElement>('.cm-slider input[type="range"]')
    expect(sliderInput).not.toBeNull()
    expect(sliderInput?.min).toBe('100')
    expect(sliderInput?.max).toBe('2000')
    expect(sliderInput?.value).toBe('500')
  })

  it('writes a moved slider back into the code', () => {
    // Arrange
    const { parent, editor, onCodeChange } = mountEditor(SLIDER_CODE)
    editor.applyEvaluation(transpiledMeta(SLIDER_CODE))
    const sliderInput = parent.querySelector<HTMLInputElement>('.cm-slider input[type="range"]')

    // Act
    if (sliderInput !== null) {
      sliderInput.value = '1500'
      sliderInput.dispatchEvent(new Event('input'))
    }

    // Assert
    expect(editorText(parent)).toContain('slider(1500, 100, 2000, 10)')
    expect(onCodeChange).toHaveBeenLastCalledWith('note("c3 e3").lpf(slider(1500, 100, 2000, 10))')
  })

  it.each([
    {
      label: 'a function, with its documentation',
      initialCode: 's("bd")',
      typedText: '.cuto',
      offeredLabel: 'cutoff',
      infoText: 'low-pass',
      expectedCode: 's("bd").cutoff'
    },
    {
      label: 'a chord symbol',
      initialCode: 'note("c")',
      typedText: '.chord("C7susa',
      offeredLabel: '7susadd3',
      infoText: '',
      expectedCode: 'note("c").chord("C7susadd3'
    }
  ])(
    'offers $label while typing and writes the picked one',
    async ({ initialCode, typedText, offeredLabel, infoText, expectedCode }) => {
      // Arrange
      const { parent } = mountEditor(initialCode)
      const content = parent.querySelector<HTMLElement>('.cm-content')
      content?.focus()
      await userEvent.keyboard('{End}')

      // Act
      await userEvent.keyboard(typedText)
      await vi.waitFor(() => {
        const offeredLabels = [
          ...parent.querySelectorAll('.cm-tooltip-autocomplete .cm-completionLabel')
        ].map((label) => label.textContent)
        expect(offeredLabels).toContain(offeredLabel)
      })
      const info = parent.querySelector('.cm-completionInfo')?.textContent ?? ''
      // CodeMirror ignores Enter for a moment after the list opens, so a fast typist's newline
      // is never taken as picking whatever happened to be selected.
      await new Promise((resolve) => setTimeout(resolve, COMPLETION_INTERACTION_DELAY_MS))
      await userEvent.keyboard('{Enter}')

      // Assert
      expect(info.toLowerCase()).toContain(infoText)
      expect(editorText(parent)).toBe(expectedCode)
    }
  )

  it.each([
    ['a documented function', 's("bd").lpf(800)', 'lpf', 'low-pass'],
    ['a synonym of one', 's("bd").cutoff(800)', 'cutoff', 'low-pass']
  ])(
    'describes %s in a tooltip while the pointer rests on it',
    async (_case, initialCode, hoveredWord, expectedText) => {
      // Arrange
      const { parent } = mountEditor(initialCode)
      const hoveredLine = parent.querySelector<HTMLElement>('.cm-line')
      const wordRange = document.createRange()
      const textNode = [...(hoveredLine?.querySelectorAll('span') ?? [])]
        .map((span) => span.firstChild)
        .find((node) => node?.textContent === hoveredWord)
      wordRange.selectNodeContents(textNode ?? document.body)
      const wordBox = wordRange.getBoundingClientRect()

      // Act
      await userEvent.hover(page.elementLocator(textNode?.parentElement ?? document.body), {
        position: { x: wordBox.width / 2, y: wordBox.height / 2 }
      })

      // Assert
      await vi.waitFor(() => {
        const tooltip = parent.querySelector('.cm-tooltip-hover')
        expect(tooltip?.textContent?.toLowerCase()).toContain(expectedText)
        expect(tooltip?.textContent).toContain(`${hoveredWord}(`)
      })
    }
  )

  it('reports typing as a code change', () => {
    // Arrange
    const { editor, onCodeChange } = mountEditor('s("bd")')

    // Act
    editor.setCode('s("bd sd")')

    // Assert
    expect(onCodeChange).toHaveBeenLastCalledWith('s("bd sd")')
  })

  it('applies the strudel.cc colours to its own element, not the page', () => {
    // Arrange
    const { parent } = mountEditor('s("bd")')

    // Act
    const foreground = parent.style.getPropertyValue('--foreground')

    // Assert
    expect(foreground).not.toBe('')
    expect(document.documentElement.style.getPropertyValue('--foreground')).toBe('')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it.each([
    ['one widget per line', 'note("c3")._pianoroll()\ns("bd")._scope()', 2],
    ['two widgets on one line', 'note("c3")._pianoroll()._scope()\ns("bd")', 2],
    ['a widget above more code', 'note("c3")._pianoroll()\ns("bd")', 2]
  ])('shows %s below the code without hiding any line', (_label, code, expectedLines) => {
    // Arrange
    const { parent, editor } = mountEditor(code)
    const meta = transpiledMeta(code)
    registerWidgetCanvases(meta.widgets)

    // Act
    editor.applyEvaluation(meta)

    // Assert
    const widgetCount = meta.widgets.length
    expect(parent.querySelectorAll('.cm-content canvas')).toHaveLength(widgetCount)
    expect(parent.querySelectorAll('.cm-line')).toHaveLength(expectedLines)
    expect(editorText(parent)).toBe(code)
  })

  it.each([
    ['deleting its call', '{Backspace>13/}', 0, 'note("c3")\ns("bd")'],
    [
      'changing its options',
      '{ArrowLeft}{{ height: 90 }',
      1,
      'note("c3")._pianoroll({ height: 90 })\ns("bd")'
    ],
    ['typing after it', ' ', 1, 'note("c3")._pianoroll() \ns("bd")']
  ])(
    'follows %s at once, before the code runs again',
    async (_edit, keys, expectedCanvases, expectedCode) => {
      // Arrange
      const code = 'note("c3")._pianoroll()\ns("bd")'
      const { parent, editor } = mountEditor(code)
      const meta = transpiledMeta(code)
      registerWidgetCanvases(meta.widgets)
      editor.applyEvaluation(meta)
      parent.querySelector<HTMLElement>('.cm-content')?.focus()
      await userEvent.keyboard('{Control>}{Home}{/Control}{End}')

      // Act
      await userEvent.keyboard(keys)

      // Assert
      expect(editorText(parent)).toBe(expectedCode)
      expect(parent.querySelectorAll('.cm-content canvas')).toHaveLength(expectedCanvases)
      expect(parent.querySelectorAll('.cm-content .cm-line')).toHaveLength(2)
    }
  )

  it('keeps inline widgets in their rows despite the global canvas rule', () => {
    // Arrange: App.vue makes every canvas absolute and full-size for the 3D views.
    const globalCanvasRule = document.createElement('style')
    globalCanvasRule.textContent = 'canvas { position: absolute; top: 0; left: 0; }'
    document.head.append(globalCanvasRule)
    const code = 'note("c3")._pianoroll()\ns("bd")'
    const { parent, editor } = mountEditor(code)
    const meta = transpiledMeta(code)
    registerWidgetCanvases(meta.widgets)

    // Act
    editor.applyEvaluation(meta)

    // Assert
    const widgetCanvas = parent.querySelector<HTMLCanvasElement>('.cm-content canvas')
    const lines = parent.querySelectorAll('.cm-line')
    expect(widgetCanvas === null ? '' : getComputedStyle(widgetCanvas).position).toBe('static')
    expect(widgetCanvas?.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      lines[0]?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY
    )
    globalCanvasRule.remove()
  })
})
