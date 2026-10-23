import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { page, userEvent } from 'vitest/browser'
import StrudelEditor from './StrudelEditor.vue'
import { createDrumLoop } from './transcription/syntheticSignals'

const WAV_SAMPLE_RATE = 22050
const WAV_HEADER_BYTES = 44
const PCM_BYTES_PER_SAMPLE = 2
const PCM_MAX_VALUE = 0x7fff

const readEditorCode = (): string =>
  [...document.querySelectorAll('.cm-line')].map((line) => line.textContent).join('\n')

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
        expect(wrapper.find('.strudel-editor__status').text()).toContain('Playing')
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
      await page.getByRole('button', { name: 'Caverave' }).click()
      await page.getByRole('button', { name: 'Play' }).click()
      await vi.waitFor(
        () => {
          expect(bufferStartCount).toBeGreaterThan(0)
        },
        { timeout: 60000, interval: 500 }
      )

      // Assert
      await vi.waitFor(() => {
        expect(wrapper.find('.strudel-editor__status').text()).toContain('Playing')
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
        expect(wrapper.find('.strudel-editor__status').text()).toContain('Playing')
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
        expect(wrapper.find('.strudel-editor__status').text()).toContain('Playing')
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
            expect(wrapper.find('.strudel-editor__status').text()).not.toContain('Idle')
          },
          { timeout: 60000, interval: 500 }
        )

        // Assert
        expect(wrapper.find('.strudel-editor__status').text()).not.toContain('Playing')
      } finally {
        wrapper.unmount()
      }
    }
  )
})
