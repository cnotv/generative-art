import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ImportTab from './ImportTab.vue'
import type { TranscriptionResult } from '../types'

const RESULT: TranscriptionResult = {
  beatsPerMinute: 126,
  bars: [
    { steps: [], chord: 'Am' },
    { steps: [], chord: 'Am' },
    { steps: [], chord: 'F' },
    { steps: [], chord: null }
  ]
}

const mountTab = (overrides: Partial<InstanceType<typeof ImportTab>['$props']> = {}) =>
  mount(ImportTab, {
    props: {
      status: 'idle',
      progress: null,
      result: null,
      code: '',
      errorMessage: '',
      ...overrides
    }
  })

describe('ImportTab', () => {
  it('offers a drop zone for audio files', () => {
    // Arrange
    const wrapper = mountTab()

    // Act
    const fileInput = wrapper.find<HTMLInputElement>('input[type="file"]')

    // Assert
    expect(fileInput.attributes('accept')).toContain('.mp3')
    expect(wrapper.text()).toContain('Drop an MP3')
  })

  it('emits the first chosen file', async () => {
    // Arrange
    const wrapper = mountTab()
    const audioFile = new File(['audio'], 'track.mp3', { type: 'audio/mpeg' })
    const fileInput = wrapper.find<HTMLInputElement>('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: { length: 1, item: () => audioFile, 0: audioFile }
    })

    // Act
    await fileInput.trigger('change')

    // Assert
    expect(wrapper.emitted('file')).toEqual([[audioFile]])
  })

  it.each([
    [null, 'Decoding audio'],
    [{ stage: 'tempo', fraction: 0.5 }, 'Estimating tempo']
  ] as const)('labels the progress for %o as "%s"', (progress, expectedLabel) => {
    // Arrange
    const wrapper = mountTab({ status: 'working', progress })

    // Act
    const stage = wrapper.find('.strudel-import__stage')

    // Assert
    expect(stage.text()).toBe(expectedLabel)
  })

  it('summarises a finished transcription and loads it on request', async () => {
    // Arrange
    const wrapper = mountTab({ status: 'done', result: RESULT, code: 'setcps(126/60/4)' })

    // Act
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Load into editor')
      ?.trigger('click')

    // Assert
    const summary = wrapper.find('.strudel-import__summary').text()
    expect(summary).toContain('126 BPM')
    expect(summary).toContain('Am F')
    expect(wrapper.find('.strudel-import__code').text()).toBe('setcps(126/60/4)')
    expect(wrapper.emitted('load')).toHaveLength(1)
  })

  it('shows why a file failed', () => {
    // Arrange
    const wrapper = mountTab({ status: 'error', errorMessage: 'Unable to decode audio data' })

    // Act
    const alert = wrapper.find('[role="alert"]')

    // Assert
    expect(alert.text()).toBe('Unable to decode audio data')
  })
})
