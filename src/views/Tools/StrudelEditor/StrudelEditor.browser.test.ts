import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { page } from 'vitest/browser'
import StrudelEditor from './StrudelEditor.vue'

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
      expect(wrapper.find('.strudel-editor__status').text()).toContain('Playing')
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
      expect(wrapper.find('.strudel-editor__status').text()).toContain('Playing')
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
})
