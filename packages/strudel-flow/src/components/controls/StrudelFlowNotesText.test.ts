import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import StrudelFlowPatternControls from './StrudelFlowPatternControls.vue'
import { STRUDEL_FLOW_NOTATION_CONTEXT } from '../notation/notationContextKey'
import type { StrudelFlowNoteBar, StrudelFlowNotesData } from '../../types'

vi.mock('@vue-flow/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vue-flow/core')>()),
  useNodeId: () => 'notes-1'
}))

const BARS: StrudelFlowNoteBar[] = [[{ notes: ['a2'], start: 0, beats: 4 }]]

const mountNotes = (data: StrudelFlowNotesData, withReader = true) =>
  mount(StrudelFlowPatternControls, {
    props: { data },
    global: {
      provide: withReader
        ? {
            [STRUDEL_FLOW_NOTATION_CONTEXT as symbol]: computed(() => ({
              readNoteBars: () => Promise.resolve(BARS),
              beatsPerCycle: 4,
              soundOf: () => 'gm_electric_bass_finger'
            }))
          }
        : {}
    }
  })

const NOTES: StrudelFlowNotesData = { kind: 'notes', pattern: 'a2', notation: 'auto' }

describe('the Notes node mini notation text', () => {
  it('is hidden by default while a notation draws the notes', async () => {
    // Arrange
    const wrapper = mountNotes(NOTES)

    // Act
    await flushPromises()

    // Assert
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(
      wrapper.get('[role="switch"][aria-label="Show mini notation"]').attributes('aria-checked')
    ).toBe('false')
  })

  it('is shown by the switch, which the node stores', async () => {
    // Arrange
    const wrapper = mountNotes(NOTES)
    await flushPromises()

    // Act
    await wrapper.get('[role="switch"][aria-label="Show mini notation"]').trigger('click')

    // Assert
    expect(wrapper.emitted('update')?.[0]).toEqual([{ ...NOTES, showPattern: true }])
  })

  it('shows beside the drawing once switched on', async () => {
    // Arrange
    const wrapper = mountNotes({ ...NOTES, showPattern: true })

    // Act
    await flushPromises()

    // Assert
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.find('svg[data-notation="bass"]').exists()).toBe(true)
  })

  it('is the whole view when Mini notation is the notation', async () => {
    // Arrange
    const wrapper = mountNotes({ ...NOTES, notation: 'text' })

    // Act
    await flushPromises()

    // Assert
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.find('svg[data-notation]').exists()).toBe(false)
    expect(wrapper.find('[role="switch"][aria-label="Show mini notation"]').exists()).toBe(false)
  })

  it('stays when the host gives no note reader, since nothing else can show the notes', async () => {
    // Arrange
    const wrapper = mountNotes(NOTES, false)

    // Act
    await flushPromises()

    // Assert
    expect(wrapper.find('textarea').exists()).toBe(true)
  })
})
