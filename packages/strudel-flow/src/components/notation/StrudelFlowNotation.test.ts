import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import StrudelFlowNotation from './StrudelFlowNotation.vue'
import StrudelFlowTabStaff from './StrudelFlowTabStaff.vue'
import { STRUDEL_FLOW_NOTATION_CONTEXT } from './notationContextKey'
import type {
  StrudelFlowNotation as StrudelFlowNotationName,
  StrudelFlowNoteBar,
  StrudelFlowNotesData
} from '../../types'

// Vue Flow hands each node component its id; outside a canvas there is none to hand.
vi.mock('@vue-flow/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vue-flow/core')>()),
  useNodeId: () => 'notes-1'
}))

const BASS_LINE: StrudelFlowNoteBar[] = [
  [
    { notes: ['a2'], start: 0, beats: 1 },
    { notes: ['c3'], start: 1, beats: 0.5 },
    { notes: ['d3'], start: 1.5, beats: 0.5 },
    { notes: ['e3'], start: 2, beats: 2 }
  ]
]

const mountNotation = (
  notation: StrudelFlowNotationName,
  sound: string,
  bars: StrudelFlowNoteBar[] = BASS_LINE
) => {
  const data: StrudelFlowNotesData = { kind: 'notes', pattern: 'a2 c3', notation }
  return mount(StrudelFlowNotation, {
    props: { data },
    global: {
      provide: {
        [STRUDEL_FLOW_NOTATION_CONTEXT as symbol]: computed(() => ({
          readNoteBars: () => Promise.resolve(bars),
          beatsPerCycle: 4,
          soundOf: (nodeId: string) => (nodeId === 'notes-1' ? sound : '')
        }))
      }
    }
  })
}

describe('StrudelFlowNotation', () => {
  it('draws a bass played notes line as a four string tab', async () => {
    // Arrange
    const wrapper = mountNotation('auto', 'gm_electric_bass_finger')

    // Act
    await flushPromises()

    // Assert
    const staff = wrapper.get('svg[data-notation="bass"]')
    expect(staff.findAll('.strudel-flow-tab-staff__string')).toHaveLength(4)
    expect(staff.findAll('.strudel-flow-tab-staff__fret').map((fret) => fret.text())).toEqual([
      '2',
      '5',
      '7',
      '9'
    ])
  })

  it('draws a guitar sound on six strings', async () => {
    // Arrange
    const wrapper = mountNotation('auto', 'gm_acoustic_guitar_nylon')

    // Act
    await flushPromises()

    // Assert
    expect(
      wrapper.findAll('svg[data-notation="guitar"] .strudel-flow-tab-staff__string')
    ).toHaveLength(6)
  })

  it('draws a piano as a roll with one block per note', async () => {
    // Arrange
    const wrapper = mountNotation('auto', 'piano')

    // Act
    await flushPromises()

    // Assert
    expect(wrapper.findAll('.strudel-flow-piano-roll__note')).toHaveLength(4)
  })

  it('lists note names and lengths for any other sound', async () => {
    // Arrange
    const wrapper = mountNotation('auto', 'sawtooth')

    // Act
    await flushPromises()

    // Assert
    expect(wrapper.findAll('.strudel-flow-note-names__note').map((note) => note.text())).toEqual([
      'a2 1',
      'c3 1/2',
      'd3 1/2',
      'e3 2'
    ])
  })

  it('says which notation Auto picked', async () => {
    // Arrange
    const wrapper = mountNotation('auto', 'gm_electric_bass_finger')

    // Act
    await flushPromises()

    // Assert
    expect(wrapper.get('select[aria-label="Notation"] option[value="auto"]').text()).toBe(
      'Auto: Bass tab'
    )
  })

  it('stores the notation picked by hand', async () => {
    // Arrange
    const wrapper = mountNotation('auto', 'gm_electric_bass_finger')
    await flushPromises()

    // Act
    await wrapper.get('select[aria-label="Notation"]').setValue('piano')

    // Assert
    expect(wrapper.emitted('update')?.[0]).toEqual([
      { kind: 'notes', pattern: 'a2 c3', notation: 'piano' }
    ])
  })

  it('shows a picked notation over the sound', async () => {
    // Arrange
    const wrapper = mountNotation('names', 'gm_electric_bass_finger')

    // Act
    await flushPromises()

    // Assert
    expect(wrapper.find('svg[data-notation="bass"]').exists()).toBe(false)
    expect(wrapper.find('.strudel-flow-note-names').exists()).toBe(true)
  })
})

describe('StrudelFlowTabStaff', () => {
  it('beams eighths, brackets a triplet and ties a note across the beat', () => {
    // Arrange
    const bars: StrudelFlowNoteBar[] = [
      [
        { notes: ['a2'], start: 0, beats: 0.5 },
        { notes: ['c3'], start: 0.5, beats: 0.5 },
        { notes: ['d3'], start: 1, beats: 1 / 3 },
        { notes: ['e3'], start: 4 / 3, beats: 1 / 3 },
        { notes: ['d3'], start: 5 / 3, beats: 1 / 3 },
        { notes: ['e3'], start: 2, beats: 2 }
      ]
    ]

    // Act
    const wrapper = mount(StrudelFlowTabStaff, { props: { bars, instrument: 'bass' } })

    // Assert
    expect(wrapper.findAll('.strudel-flow-tab-staff__stem')).toHaveLength(7)
    expect(wrapper.findAll('.strudel-flow-tab-staff__fret')).toHaveLength(6)
    expect(wrapper.findAll('.strudel-flow-tab-staff__beam')).toHaveLength(2)
    expect(wrapper.findAll('.strudel-flow-tab-staff__bracket')).toHaveLength(1)
    expect(wrapper.findAll('.strudel-flow-tab-staff__tie')).toHaveLength(1)
  })

  it('stacks the frets of a chord on one stem', () => {
    // Arrange
    const bars: StrudelFlowNoteBar[] = [[{ notes: ['e2', 'b2', 'e3'], start: 0, beats: 4 }]]

    // Act
    const wrapper = mount(StrudelFlowTabStaff, { props: { bars, instrument: 'guitar' } })

    // Assert
    const fretXs = wrapper
      .findAll('.strudel-flow-tab-staff__fret')
      .map((fret) => fret.attributes('x'))
    expect(fretXs).toHaveLength(3)
    expect(new Set(fretXs).size).toBe(1)
  })
})
