import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ImportTab from './ImportTab.vue'
import type {
  ImportedTranscription,
  ScoreTranscription,
  TabTranscription,
  TranscriptionResult
} from '../types'

const RESULT: TranscriptionResult = {
  kind: 'grid',
  beatsPerMinute: 126,
  bars: [
    { steps: [], chord: 'Am' },
    { steps: [], chord: 'Am' },
    { steps: [], chord: 'F' },
    { steps: [], chord: null }
  ]
}

const TAB_RESULT: TabTranscription = {
  kind: 'tab',
  beatsPerMinute: 120,
  instrument: 'bass',
  bars: [[{ notes: ['a2'], beats: 4 }]],
  warnings: []
}

const SCORE_RESULT: ScoreTranscription = {
  kind: 'score',
  beatsPerMinute: 65,
  beatsPerBar: 4,
  bars: [{ rightHand: [{ notes: ['a5'], beats: 4 }], leftHand: [{ notes: ['f#3'], beats: 4 }] }],
  warnings: []
}

const GUITAR_RESULT: TabTranscription = { ...TAB_RESULT, instrument: 'guitar' }

const imported = (...results: TabTranscription[]): ImportedTranscription[] =>
  results.map((result, index) => ({ id: index + 1, sourceName: `tab-${index + 1}.png`, result }))

const findButton = (wrapper: ReturnType<typeof mountTab>, label: string) =>
  wrapper.findAll('button').find((button) => button.text() === label)

const mountTab = (overrides: Partial<InstanceType<typeof ImportTab>['$props']> = {}) =>
  mount(ImportTab, {
    props: {
      status: 'idle',
      progress: null,
      transcriptions: [],
      code: '',
      warnings: [],
      errorMessage: '',
      addVisualizer: true,
      ...overrides
    }
  })

describe('ImportTab', () => {
  it('offers a drop zone for audio and MIDI files', () => {
    // Arrange
    const wrapper = mountTab()

    // Act
    const fileInput = wrapper.find<HTMLInputElement>('input[type="file"]')

    // Assert
    expect(fileInput.attributes('accept')).toContain('.mp3')
    expect(fileInput.attributes('accept')).toContain('.mid')
    expect(wrapper.text()).toContain('Drop an MP3')
  })

  it('emits every chosen file in order', async () => {
    // Arrange
    const wrapper = mountTab()
    const bassFile = new File(['image'], 'bass.png', { type: 'image/png' })
    const guitarFile = new File(['image'], 'guitar.png', { type: 'image/png' })
    const fileInput = wrapper.find<HTMLInputElement>('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: {
        length: 2,
        item: (index: number) => [bassFile, guitarFile][index],
        0: bassFile,
        1: guitarFile,
        [Symbol.iterator]: function* () {
          yield bassFile
          yield guitarFile
        }
      }
    })

    // Act
    await fileInput.trigger('change')

    // Assert
    expect(fileInput.attributes('multiple')).toBeDefined()
    expect(wrapper.emitted('files')).toEqual([[[bassFile, guitarFile]]])
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
    const wrapper = mountTab({
      status: 'done',
      transcriptions: [{ id: 1, sourceName: 'song.mp3', result: RESULT }],
      code: 'setcps(126/60/4)'
    })

    // Act
    await findButton(wrapper, 'Load into editor')?.trigger('click')

    // Assert
    const summary = wrapper.find('.strudel-import__summary').text()
    expect(summary).toContain('126 BPM')
    expect(summary).toContain('Am F')
    expect(wrapper.find('.strudel-import__code').text()).toBe('setcps(126/60/4)')
    expect(wrapper.emitted('load')).toHaveLength(1)
    expect(findButton(wrapper, 'Add to editor')).toBeUndefined()
  })

  it('shows why a file failed', () => {
    // Arrange
    const wrapper = mountTab({ status: 'error', errorMessage: 'Unable to decode audio data' })

    // Act
    const alert = wrapper.find('[role="alert"]')

    // Assert
    expect(alert.text()).toBe('Unable to decode audio data')
  })

  it('summarises a tab by tempo and bars, without a chord row', () => {
    // Arrange
    const wrapper = mountTab({
      status: 'done',
      transcriptions: imported(TAB_RESULT),
      code: 'setcps(120/60/4)'
    })

    // Act
    const summary = wrapper.find('.strudel-import__summary').text()

    // Assert
    expect(summary).toContain('120 BPM')
    expect(summary).not.toContain('Chords')
  })

  it('offers a visualizer switch that reflects its state and reports a change', async () => {
    // Arrange
    const wrapper = mountTab({ addVisualizer: true })
    const visualizerSwitch = wrapper.find('button[role="switch"]')

    // Act
    await visualizerSwitch.trigger('click')

    // Assert
    expect(visualizerSwitch.attributes('aria-checked')).toBe('true')
    expect(wrapper.text()).toContain('Add a visualizer to each instrument')
    expect(wrapper.emitted('update:addVisualizer')).toEqual([[false]])
  })

  it('lists a piano score next to a tab as one row naming both hands', () => {
    // Arrange
    const transcriptions = [
      ...imported(TAB_RESULT),
      { id: 2, sourceName: 'river.png', result: SCORE_RESULT }
    ]

    // Act
    const wrapper = mountTab({ status: 'done', transcriptions })

    // Assert
    const rows = wrapper.findAll('.strudel-import__instrument').map((row) => row.text())
    expect(rows).toHaveLength(2)
    expect(rows[1]).toContain('right hand and left hand')
    expect(rows[1]).toContain('river.png, 1 bars')
    expect(
      wrapper.find('button[aria-label="Remove right hand and left hand river.png"]').exists()
    ).toBe(true)
  })

  it('lists every imported tab as an instrument with its own remove button', async () => {
    // Arrange
    const wrapper = mountTab({
      status: 'done',
      transcriptions: imported(TAB_RESULT, GUITAR_RESULT),
      code: ''
    })

    // Act
    await wrapper.find('button[aria-label="Remove guitar tab-2.png"]').trigger('click')

    // Assert
    const rows = wrapper.findAll('.strudel-import__instrument').map((row) => row.text())
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('bass')
    expect(rows[0]).toContain('tab-1.png')
    expect(rows[1]).toContain('guitar')
    expect(wrapper.emitted('remove')).toEqual([[2]])
  })

  it.each([
    ['Load into editor', 'load'],
    ['Add to editor', 'add']
  ])('emits %s as %s for tabs', async (label, eventName) => {
    // Arrange
    const wrapper = mountTab({ status: 'done', transcriptions: imported(TAB_RESULT), code: '' })

    // Act
    await findButton(wrapper, label)?.trigger('click')

    // Assert
    expect(wrapper.emitted(eventName)).toHaveLength(1)
  })

  it('shows the song warnings', () => {
    // Arrange
    const warning = 'The bass (3 bars) and guitar (2 bars) loop at different lengths'

    // Act
    const wrapper = mountTab({
      status: 'done',
      transcriptions: imported(TAB_RESULT, GUITAR_RESULT),
      warnings: [warning]
    })

    // Assert
    expect(wrapper.find('.strudel-import__warnings').text()).toContain(warning)
  })

  it('accepts screenshots as well as audio', () => {
    // Arrange
    const wrapper = mountTab()

    // Act
    const accept = wrapper.find<HTMLInputElement>('input[type="file"]').attributes('accept')

    // Assert
    expect(accept).toContain('image/png')
  })
})
