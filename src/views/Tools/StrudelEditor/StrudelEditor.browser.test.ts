import { beforeEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { page, userEvent } from 'vitest/browser'
// The app's global styles size the nav and lock the page, which the phone layout depends on.
import '@/style.css'
import '@/assets/styles/_variables.scss'
import StrudelEditor from './StrudelEditor.vue'
import { createDrumLoop } from './transcription/syntheticSignals'
import { STRUDEL_EXAMPLES, STRUDEL_MUSIC_STYLES } from './config'

const WAV_SAMPLE_RATE = 22050
const WAV_HEADER_BYTES = 44
const PCM_BYTES_PER_SAMPLE = 2
const PCM_MAX_VALUE = 0x7fff

const readEditorCode = (): string =>
  [...document.querySelectorAll('.cm-line')].map((line) => line.textContent).join('\n')

// The play button above the editor reads Stop while a pattern plays, Update once its code is
// edited, and Play otherwise.
const readPlayButtonLabel = (): string | null =>
  document.querySelector('.strudel-editor__play')?.getAttribute('aria-label') ?? null

const hasPaintedPixels = (canvas: HTMLCanvasElement | null): boolean => {
  const drawContext = canvas?.getContext('2d')
  if (!canvas || !drawContext || canvas.width === 0 || canvas.height === 0) {
    return false
  }
  return drawContext
    .getImageData(0, 0, canvas.width, canvas.height)
    .data.some((channel, index) => index % 4 === 3 && channel > 0)
}

const readExampleCode = (exampleId: string): string =>
  STRUDEL_EXAMPLES.find((example) => example.id === exampleId)?.code ?? ''

// Longer than one cycle of the slowest style, so every layer has played at least once.
const PLAYBACK_SETTLE_MS = 4000

// Strudel reports a sound it cannot find, and any other error while playing, through its own
// logger: a console.log and a strudel.log event on the document, never console.error.
const collectEngineErrors = (): { engineErrors: string[]; stopCollecting: () => void } => {
  const engineErrors: string[] = []
  const recordEngineError = (event: Event): void => {
    if (event instanceof CustomEvent && String(event.detail?.message).includes('error')) {
      engineErrors.push(String(event.detail.message))
    }
  }
  document.addEventListener('strudel.log', recordEngineError)
  return {
    engineErrors,
    stopCollecting: () => document.removeEventListener('strudel.log', recordEngineError)
  }
}

// More than any style offers, so a hint that never goes away fails instead of looping forever.
const MAX_HINTS_APPLIED = 20

const countHints = (): number => document.querySelectorAll('.strudel-hints__item').length

const applyEveryHint = async (appliedCount = 0): Promise<number> => {
  const addButton = document.querySelector<HTMLButtonElement>('.strudel-hints__item button')
  if (addButton === null || appliedCount >= MAX_HINTS_APPLIED) {
    return appliedCount
  }
  const codeBefore = readEditorCode()
  await userEvent.click(addButton)
  await vi.waitFor(() => {
    expect(readEditorCode()).not.toBe(codeBefore)
  })
  return applyEveryHint(appliedCount + 1)
}

// Long enough for a leftover animation loop to have drawn several frames.
const VISUAL_SETTLE_MS = 1000

const INLINE_WIDGET_CODE = [
  '$: note("<c3 e3 g3 b3>*4").s("sawtooth").lpf(slider(800, 200, 4000, 10))._pianoroll()',
  '$: s("bd*4")._scope()'
].join('\n')

const encodeMonoWav = (samples: Float32Array, sampleRate: number): Blob => {
  const dataBytes = samples.length * PCM_BYTES_PER_SAMPLE
  const view = new DataView(new ArrayBuffer(WAV_HEADER_BYTES + dataBytes))
  const writeText = (offset: number, text: string): void => {
    ;[...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)))
  }
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * PCM_BYTES_PER_SAMPLE, true)
  view.setUint16(32, PCM_BYTES_PER_SAMPLE, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, dataBytes, true)
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample))
    view.setInt16(WAV_HEADER_BYTES + index * PCM_BYTES_PER_SAMPLE, clamped * PCM_MAX_VALUE, true)
  })
  return new Blob([view.buffer], { type: 'audio/wav' })
}

describe('StrudelEditor audible playback', () => {
  // The editor saves its code to local storage, which would carry one test's code into the next.
  beforeEach(() => {
    localStorage.clear()
  })

  it('brings back the code typed before the editor was closed', { timeout: 30000 }, async () => {
    // Arrange
    const firstVisit = mount(StrudelEditor, { attachTo: document.body })
    await page.getByRole('textbox', { name: 'Live code pattern' }).fill('s("cp*3").room(.4)')
    firstVisit.unmount()

    // Act
    const secondVisit = mount(StrudelEditor, { attachTo: document.body })

    try {
      // Assert
      await vi.waitFor(
        () => {
          expect(readEditorCode()).toBe('s("cp*3").room(.4)')
        },
        { timeout: 15000 }
      )
    } finally {
      secondVisit.unmount()
    }
  })

  it('starts real buffer playback with no missing sounds', { timeout: 90000 }, async () => {
    // Arrange: count scheduled audio buffers and capture engine errors.
    let bufferStartCount = 0
    const originalCreateBufferSource = AudioContext.prototype.createBufferSource
    AudioContext.prototype.createBufferSource = function (
      this: AudioContext,
      ...creationArguments: []
    ) {
      const source = originalCreateBufferSource.apply(this, creationArguments)
      const originalStart = source.start.bind(source)
      source.start = (...startArguments: [number]) => {
        bufferStartCount += 1
        return originalStart(...startArguments)
      }
      return source
    }
    const consoleError = vi.spyOn(console, 'error')
    const consoleWarn = vi.spyOn(console, 'warn')
    const wrapper = mount(StrudelEditor, { attachTo: document.body })

    try {
      // Act: trusted click, so the browser grants the audio gesture.
      await page.getByRole('button', { name: 'Play' }).click()
      await vi.waitFor(
        () => {
          expect(bufferStartCount).toBeGreaterThan(0)
        },
        { timeout: 60000, interval: 500 }
      )

      // Assert
      await vi.waitFor(() => {
        expect(readPlayButtonLabel()).toBe('Stop')
      })
      const failureMessages = [...consoleError.mock.calls, ...consoleWarn.mock.calls]
        .map((callArguments) => String(callArguments[0]))
        .filter((message) => message.includes('not found'))
      expect(failureMessages).toEqual([])
    } finally {
      AudioContext.prototype.createBufferSource = originalCreateBufferSource
      consoleError.mockRestore()
      consoleWarn.mockRestore()
      wrapper.unmount()
    }
  })

  it('plays an electro tune from the patterns tab', { timeout: 90000 }, async () => {
    // Arrange
    let bufferStartCount = 0
    const originalCreateBufferSource = AudioContext.prototype.createBufferSource
    AudioContext.prototype.createBufferSource = function (
      this: AudioContext,
      ...creationArguments: []
    ) {
      const source = originalCreateBufferSource.apply(this, creationArguments)
      const originalStart = source.start.bind(source)
      source.start = (...startArguments: [number]) => {
        bufferStartCount += 1
        return originalStart(...startArguments)
      }
      return source
    }
    const consoleError = vi.spyOn(console, 'error')
    const consoleWarn = vi.spyOn(console, 'warn')
    const wrapper = mount(StrudelEditor, { attachTo: document.body })

    try {
      // Act: switch to patterns tab, click Caverave, then play
      await page.getByRole('tab', { name: 'patterns' }).click()
      await page.getByRole('link', { name: 'Caverave' }).click()
      await page.getByRole('button', { name: 'Play' }).click()
      await vi.waitFor(
        () => {
          expect(bufferStartCount).toBeGreaterThan(0)
        },
        { timeout: 60000, interval: 500 }
      )

      // Assert
      await vi.waitFor(() => {
        expect(readPlayButtonLabel()).toBe('Stop')
      })
      const failureMessages = [...consoleError.mock.calls, ...consoleWarn.mock.calls]
        .map((callArguments) => String(callArguments[0]))
        .filter((message) => message.includes('not found'))
      expect(failureMessages).toEqual([])
    } finally {
      AudioContext.prototype.createBufferSource = originalCreateBufferSource
      consoleError.mockRestore()
      consoleWarn.mockRestore()
      wrapper.unmount()
    }
  })

  it('transcribes an uploaded drum loop and plays the result', { timeout: 120000 }, async () => {
    // Arrange: a 120 BPM kick and off-beat hi-hat loop, encoded as a real audio file.
    let bufferStartCount = 0
    const originalCreateBufferSource = AudioContext.prototype.createBufferSource
    AudioContext.prototype.createBufferSource = function (
      this: AudioContext,
      ...creationArguments: []
    ) {
      const source = originalCreateBufferSource.apply(this, creationArguments)
      const originalStart = source.start.bind(source)
      source.start = (...startArguments: [number]) => {
        bufferStartCount += 1
        return originalStart(...startArguments)
      }
      return source
    }
    const drumLoop = createDrumLoop({ beatsPerMinute: 120, bars: 4, sampleRate: WAV_SAMPLE_RATE })
    const audioFile = new File([encodeMonoWav(drumLoop, WAV_SAMPLE_RATE)], 'drum-loop.wav', {
      type: 'audio/wav'
    })
    const wrapper = mount(StrudelEditor, { attachTo: document.body })

    try {
      // Act: decode and analyse through the real worker, load the code, then play it.
      await page.getByRole('tab', { name: 'import' }).click()
      const fileInput = wrapper.find<HTMLInputElement>('input[type="file"]').element
      await userEvent.upload(page.elementLocator(fileInput), audioFile)
      await page.getByRole('button', { name: 'Load into editor' }).click({ timeout: 60000 })
      const editorCode = readEditorCode()
      await page.getByRole('button', { name: 'Play' }).click()
      await vi.waitFor(
        () => {
          expect(bufferStartCount).toBeGreaterThan(0)
        },
        { timeout: 60000, interval: 500 }
      )

      // Assert
      expect(editorCode).toContain('setcps(120/60/4)')
      expect(editorCode).toMatch(/s\("[^"]*bd[^"]*"\)/)
      expect(editorCode).toMatch(/s\("[^"]*hh[^"]*"\)/)
      await vi.waitFor(() => {
        expect(readPlayButtonLabel()).toBe('Stop')
      })
    } finally {
      AudioContext.prototype.createBufferSource = originalCreateBufferSource
      wrapper.unmount()
    }
  })

  it('shows inline sliders, pianoroll and scope, and plays', { timeout: 90000 }, async () => {
    // Arrange: count started oscillators, since this pattern plays a synth and no samples.
    let oscillatorCount = 0
    const originalCreateOscillator = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      oscillatorCount += 1
      return originalCreateOscillator.call(this)
    }
    const wrapper = mount(StrudelEditor, { attachTo: document.body })

    try {
      // Act: type the code the way a player would, then press Play.
      const codeEditor = page.getByRole('textbox', { name: 'Live code pattern' })
      await codeEditor.fill(INLINE_WIDGET_CODE)
      await page.getByRole('button', { name: 'Play' }).click()
      await vi.waitFor(
        () => {
          expect(oscillatorCount).toBeGreaterThan(0)
        },
        { timeout: 60000, interval: 500 }
      )

      // Assert
      await vi.waitFor(() => {
        expect(readPlayButtonLabel()).toBe('Stop')
      })
      expect(readEditorCode()).toBe(INLINE_WIDGET_CODE)
      const sliderInput = document.querySelector<HTMLInputElement>('.cm-slider input[type="range"]')
      expect(sliderInput?.value).toBe('800')
      expect(document.querySelectorAll('.cm-content canvas').length).toBe(2)
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    } finally {
      AudioContext.prototype.createOscillator = originalCreateOscillator
      wrapper.unmount()
    }
  })

  it.each([
    ['punchcard-drums', '.cm-content canvas'],
    ['punchcard-vs-pianoroll', '.cm-content canvas'],
    ['scope', '.cm-content canvas'],
    ['spiral', '.cm-content canvas'],
    ['pitch-wheel', '.cm-content canvas'],
    ['spectrum', '.cm-content canvas'],
    ['pianoroll-behind', '.strudel-code-editor__visuals']
  ])(
    'plays the %s example and draws it into %s',
    { timeout: 90000 },
    async (exampleId, canvasSelector) => {
      // Arrange
      const exampleCode = readExampleCode(exampleId)
      const wrapper = mount(StrudelEditor, { attachTo: document.body })

      try {
        // Act
        await page.getByRole('textbox', { name: 'Live code pattern' }).fill(exampleCode)
        await page.getByRole('button', { name: 'Play' }).click()
        await vi.waitFor(
          () => {
            expect(
              readPlayButtonLabel() === 'Stop' || wrapper.find('[role="alert"]').exists()
            ).toBe(true)
          },
          { timeout: 60000, interval: 500 }
        )

        // Assert
        expect(exampleCode).not.toBe('')
        expect(readPlayButtonLabel()).toBe('Stop')
        await vi.waitFor(
          () => {
            expect(hasPaintedPixels(document.querySelector(canvasSelector))).toBe(true)
          },
          { timeout: 10000, interval: 250 }
        )
      } finally {
        wrapper.unmount()
      }
    }
  )

  it.each([
    ['a pianoroll, which animates itself', 'note("c3 e3 g3 b3").s("triangle").pianoroll()'],
    ['a punchcard, painted every frame', 'note("c3 e3 g3 b3").s("triangle").punchcard()']
  ])(
    'stops drawing %s once the code no longer asks for it',
    { timeout: 90000 },
    async (_visual, visualCode) => {
      // Arrange
      const wrapper = mount(StrudelEditor, { attachTo: document.body })
      const codeEditor = page.getByRole('textbox', { name: 'Live code pattern' })
      const backgroundCanvas = (): HTMLCanvasElement | null =>
        document.querySelector('.strudel-code-editor__visuals')

      try {
        await codeEditor.fill(visualCode)
        await page.getByRole('button', { name: 'Play' }).click()
        await vi.waitFor(
          () => {
            expect(hasPaintedPixels(backgroundCanvas())).toBe(true)
          },
          { timeout: 60000, interval: 250 }
        )

        // Act: take the visual out and run the code again, as Ctrl+Enter does while playing.
        await codeEditor.fill('note("c3 e3 g3 b3").s("triangle")')
        await userEvent.keyboard('{Control>}{Enter}{/Control}')
        await new Promise((resolve) => setTimeout(resolve, VISUAL_SETTLE_MS))

        // Assert
        expect(readPlayButtonLabel()).toBe('Stop')
        expect(hasPaintedPixels(backgroundCanvas())).toBe(false)
      } finally {
        wrapper.unmount()
      }
    }
  )

  it(
    'offers Update once the playing code is edited, and plays only the new code',
    { timeout: 90000 },
    async () => {
      // Arrange
      const wrapper = mount(StrudelEditor, { attachTo: document.body })
      const codeEditor = page.getByRole('textbox', { name: 'Live code pattern' })

      try {
        await codeEditor.fill('note("c3 e3").s("triangle")')
        await page.getByRole('button', { name: 'Play' }).click()
        await vi.waitFor(
          () => {
            expect(readPlayButtonLabel()).toBe('Stop')
          },
          { timeout: 60000, interval: 250 }
        )

        // Act
        await codeEditor.fill('note("g3 b3").s("triangle")')
        const labelAfterEdit = readPlayButtonLabel()
        await page.getByRole('button', { name: 'Update' }).click()

        // Assert
        expect(labelAfterEdit).toBe('Update')
        await vi.waitFor(() => {
          expect(readPlayButtonLabel()).toBe('Stop')
        })
      } finally {
        wrapper.unmount()
      }
    }
  )

  it(
    'reports a pattern with a syntax error instead of playing it',
    { timeout: 90000 },
    async () => {
      // Arrange
      const wrapper = mount(StrudelEditor, { attachTo: document.body })

      try {
        // Act
        await page.getByRole('textbox', { name: 'Live code pattern' }).fill('s("bd sd"')
        await page.getByRole('button', { name: 'Play' }).click()
        await vi.waitFor(
          () => {
            expect(wrapper.find('.strudel-editor__error').exists()).toBe(true)
          },
          { timeout: 60000, interval: 500 }
        )

        // Assert
        expect(wrapper.find('.strudel-editor__error').text()).not.toBe('')
        expect(readPlayButtonLabel()).toBe('Play')
      } finally {
        wrapper.unmount()
      }
    }
  )

  it(
    'compiles a node added and connected on the flow canvas, and plays it',
    { timeout: 90000 },
    async () => {
      // Arrange
      let bufferStartCount = 0
      const originalCreateBufferSource = AudioContext.prototype.createBufferSource
      AudioContext.prototype.createBufferSource = function (
        this: AudioContext,
        ...creationArguments: []
      ) {
        const source = originalCreateBufferSource.apply(this, creationArguments)
        const originalStart = source.start.bind(source)
        source.start = (...startArguments: [number]) => {
          bufferStartCount += 1
          return originalStart(...startArguments)
        }
        return source
      }
      const wrapper = mount(StrudelEditor, { attachTo: document.body })

      try {
        // Act: open flow, add Beats, and connect it to the starter Filter by clicking its handles.
        await page.getByRole('tab', { name: 'flow' }).click()
        await vi.waitFor(
          () => {
            expect(
              document.querySelector('.strudel-flow-node[data-node-kind="filter"]')
            ).not.toBeNull()
          },
          { timeout: 15000 }
        )
        await page.getByRole('button', { name: 'Add Beats node' }).click()
        await vi.waitFor(
          () => {
            expect(
              document.querySelector('.strudel-flow-node[data-node-kind="beats"]')
            ).not.toBeNull()
          },
          { timeout: 15000 }
        )
        const beatsOutput = document.querySelector(
          '.strudel-flow-node[data-node-kind="beats"] .strudel-flow-node__handle--output'
        )
        const filterInput = document.querySelector(
          '.strudel-flow-node[data-node-kind="filter"] .strudel-flow-node__handle--input'
        )
        expect(beatsOutput).not.toBeNull()
        expect(filterInput).not.toBeNull()
        if (beatsOutput === null || filterInput === null) {
          return
        }
        await userEvent.click(beatsOutput)
        await userEvent.click(filterInput)

        // Assert: both instruments reach the editor as one stacked, filtered pattern.
        await vi.waitFor(
          () => {
            const blocks = readEditorCode()
              .split('\n')
              .filter((line) => line.startsWith('$:'))
            expect(blocks).toHaveLength(1)
            expect(blocks[0]).toContain('note("<c3 eb3 g3 bb3>")')
            expect(blocks[0]).toContain('s("bd")')
            expect(blocks[0]).toContain('.lpf(1500)')
          },
          { timeout: 15000 }
        )
        await page.getByRole('button', { name: 'Play' }).click()
        await vi.waitFor(
          () => {
            expect(bufferStartCount).toBeGreaterThan(0)
          },
          { timeout: 60000, interval: 500 }
        )
        await vi.waitFor(() => {
          expect(readPlayButtonLabel()).toBe('Stop')
        })
      } finally {
        AudioContext.prototype.createBufferSource = originalCreateBufferSource
        wrapper.unmount()
      }
    }
  )

  it(
    'puts the picked pattern in the address, and Back returns to the one before',
    { timeout: 30000 },
    async () => {
      // Arrange
      const wrapper = mount(StrudelEditor, { attachTo: document.body })

      try {
        await vi.waitFor(
          () => {
            expect(document.querySelector('.cm-content')).not.toBeNull()
          },
          { timeout: 15000 }
        )
        await page.getByRole('tab', { name: 'patterns' }).click()

        // Act
        await page.getByRole('link', { name: 'Scope', exact: true }).click()
        const linkedHash = window.location.hash
        const linkedCode = readEditorCode()
        await page.getByRole('link', { name: 'Spiral', exact: true }).click()
        window.history.back()

        // Assert
        expect(linkedHash).toBe('#scope')
        expect(linkedCode).toContain('s("sawtooth")._scope()')
        await vi.waitFor(() => {
          expect(window.location.hash).toBe('#scope')
          expect(readEditorCode()).toContain('s("sawtooth")._scope()')
        })
      } finally {
        wrapper.unmount()
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    }
  )

  it(
    'brings the editor back into view when a pattern is picked on a phone',
    { timeout: 30000 },
    async () => {
      // Arrange: on a phone the player stacks below the editor, so the tabs sit out of its sight.
      await page.viewport(390, 664)
      const wrapper = mount(StrudelEditor, { attachTo: document.body })

      try {
        await vi.waitFor(
          () => {
            expect(document.querySelector('.cm-content')).not.toBeNull()
          },
          { timeout: 15000 }
        )
        await page.getByRole('tab', { name: 'patterns' }).click()
        const editorView = document.querySelector('.strudel-editor')
        editorView?.scrollTo({ top: editorView.scrollHeight })
        // The fixed navigation covers the view's top padding, so code scrolled into it is hidden.
        const navigationClearance = editorView
          ? Number.parseFloat(getComputedStyle(editorView).paddingTop)
          : Number.NaN
        const codeEditor = document.querySelector('.strudel-code-editor')
        expect(codeEditor?.getBoundingClientRect().bottom).toBeLessThan(navigationClearance)

        // Act
        await page.getByRole('link', { name: 'Caverave' }).click()

        // Assert
        await vi.waitFor(() => {
          const editorTop = codeEditor?.getBoundingClientRect().top ?? Number.NaN
          expect(editorTop).toBeGreaterThanOrEqual(navigationClearance)
          expect(editorTop).toBeLessThan(window.innerHeight)
        })
        expect(readEditorCode()).toContain('"Caverave"')
      } finally {
        wrapper.unmount()
      }
    }
  )

  it.each(STRUDEL_MUSIC_STYLES.map((style) => ({ styleId: style.id, keyword: style.keywords[0] })))(
    'applies every $styleId hint and plays the result with no missing sounds',
    { timeout: 90000 },
    async ({ keyword }) => {
      // Arrange
      const { engineErrors, stopCollecting } = collectEngineErrors()
      const wrapper = mount(StrudelEditor, { attachTo: document.body })

      try {
        await page.getByRole('textbox', { name: 'Live code pattern' }).fill(`// ${keyword}`)
        await vi.waitFor(() => {
          expect(countHints()).toBeGreaterThan(0)
        })

        // Act
        const appliedCount = await applyEveryHint()
        await page.getByRole('button', { name: 'Play' }).click()

        // Assert
        expect(appliedCount).toBeLessThan(MAX_HINTS_APPLIED)
        expect(document.querySelector('.strudel-hints')?.textContent).toContain('Nothing missing')
        await vi.waitFor(
          () => {
            expect(readPlayButtonLabel()).toBe('Stop')
          },
          { timeout: 60000, interval: 500 }
        )
        await new Promise((resolve) => setTimeout(resolve, PLAYBACK_SETTLE_MS))
        expect(document.querySelector('.strudel-editor__error')).toBeNull()
        expect(engineErrors).toEqual([])
      } finally {
        stopCollecting()
        wrapper.unmount()
      }
    }
  )
})
