import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StrudelTimeline from './StrudelTimeline.vue'

const mountTimeline = (props: Partial<InstanceType<typeof StrudelTimeline>['$props']> = {}) =>
  mount(StrudelTimeline, {
    props: {
      playheadCycle: 2.5,
      timelineBars: 8,
      cyclesPerSecond: 0.5,
      stepsPerCycle: 4,
      loopEnabled: true,
      isPlaying: false,
      ...props
    }
  })

describe('StrudelTimeline', () => {
  it('asks to stop when the Stop button is pressed', async () => {
    // Arrange
    const wrapper = mountTimeline()

    // Act
    await wrapper.get('button[aria-label="Stop and rewind"]').trigger('click')

    // Assert
    expect(wrapper.emitted('stop')).toHaveLength(1)
  })

  it('turns looping off when the loop toggle is pressed', async () => {
    // Arrange
    const wrapper = mountTimeline()

    // Act
    await wrapper.get('button[aria-label="Loop on"]').trigger('click')

    // Assert
    expect(wrapper.emitted('update:loopEnabled')).toEqual([[false]])
  })

  it('reads the cycle, step and time of the playhead', () => {
    // Act
    const readout = mountTimeline().get('.strudel-timeline__readout').text()

    // Assert
    expect(readout).toContain('3/8')
    expect(readout).toContain('3/4')
    expect(readout).toContain('5.0s')
  })

  it('names each readout icon for assistive technology', () => {
    // Act
    const iconNames = mountTimeline()
      .findAll('.strudel-timeline__reading [role="img"]')
      .map((icon) => icon.attributes('aria-label'))

    // Assert
    expect(iconNames).toEqual(['Cycle', 'Step', 'Time'])
  })

  it('shows one row for a song that fits and several for a long one', () => {
    // Act
    const shortRows = mountTimeline({ timelineBars: 4 }).findAll('[role="slider"]')
    const longRows = mountTimeline({ timelineBars: 64 }).findAll('[role="slider"]')

    // Assert
    expect(shortRows).toHaveLength(1)
    expect(longRows.length).toBeGreaterThan(1)
  })

  it('labels each row with the cycles it covers', () => {
    // Act
    const label = mountTimeline({ timelineBars: 4 }).get('[role="slider"]').attributes('aria-label')

    // Assert
    expect(label).toBe('Cycles 1 to 4')
  })
})
