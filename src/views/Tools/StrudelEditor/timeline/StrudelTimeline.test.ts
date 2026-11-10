import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { STRUDEL_TIMELINE_MIN_CYCLE_WIDTH } from '../config'
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

  it('lays the whole song out on one slider that ends on its last cycle', () => {
    // Act
    const sliders = mountTimeline({ timelineBars: 64 }).findAll('[role="slider"]')

    // Assert
    expect(sliders).toHaveLength(1)
    expect(sliders[0]?.attributes('aria-valuemax')).toBe('64')
  })

  it('leaves the scroll where it is while the playhead runs past the visible part', async () => {
    // Arrange
    const wrapper = mountTimeline({ playheadCycle: 0, timelineBars: 64 })
    const scroller = wrapper.get('.strudel-timeline__scroller').element as HTMLElement
    Object.defineProperty(scroller, 'clientWidth', { value: 300 })
    Object.defineProperty(scroller, 'scrollWidth', { value: 64 * STRUDEL_TIMELINE_MIN_CYCLE_WIDTH })
    scroller.scrollLeft = 0

    // Act
    await wrapper.setProps({ playheadCycle: 60 })

    // Assert
    expect(scroller.scrollLeft).toBe(0)
  })

  it('declares the playhead slider horizontal', () => {
    // Act
    const slider = mountTimeline().get('[role="slider"]')

    // Assert
    expect(slider.attributes('aria-orientation')).toBe('horizontal')
  })

  it('gives a long song room for every cycle, so it scrolls rather than squeezes', () => {
    // Act
    const trackWidth = mountTimeline({ timelineBars: 64 })
      .get('.strudel-timeline__track')
      .attributes('style')

    // Assert
    expect(trackWidth).toContain(`${64 * STRUDEL_TIMELINE_MIN_CYCLE_WIDTH}px`)
  })
})
