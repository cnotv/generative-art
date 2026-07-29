import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TouchControl from './TouchControl.vue'

describe('TouchControl — button mode', () => {
  it('marks the action held on press and clears it on release', async () => {
    const currentActions: Record<string, unknown> = {}
    const wrapper = mount(TouchControl, {
      props: {
        mode: 'button',
        mapping: { Jump: 'jump' },
        currentActions,
        onAction: vi.fn()
      }
    })

    await wrapper.find('.touch-control').trigger('touchstart')
    expect(currentActions).toHaveProperty('jump')

    await wrapper.find('.touch-control').trigger('touchend')
    expect(currentActions).not.toHaveProperty('jump')
  })

  it('calls onAction on release, not on press', async () => {
    const onAction = vi.fn()
    const wrapper = mount(TouchControl, {
      props: { mode: 'button', mapping: { Jump: 'jump' }, onAction }
    })

    await wrapper.find('.touch-control').trigger('touchstart')
    expect(onAction).not.toHaveBeenCalled()

    await wrapper.find('.touch-control').trigger('touchend')
    expect(onAction).toHaveBeenCalledWith('jump')
  })

  it('clears the held action on touchcancel and mouseleave without firing onAction', async () => {
    const onAction = vi.fn()
    const currentActions: Record<string, unknown> = {}
    const wrapper = mount(TouchControl, {
      props: { mode: 'button', mapping: { Jump: 'jump' }, currentActions, onAction }
    })

    await wrapper.find('.touch-control').trigger('touchstart')
    expect(currentActions).toHaveProperty('jump')

    await wrapper.find('.touch-control').trigger('touchcancel')
    expect(currentActions).not.toHaveProperty('jump')
    expect(onAction).not.toHaveBeenCalled()

    await wrapper.find('.touch-control').trigger('touchstart')
    await wrapper.find('.touch-control').trigger('mouseleave')
    expect(currentActions).not.toHaveProperty('jump')
    expect(onAction).not.toHaveBeenCalled()
  })

  it('does not mutate currentActions when the prop is not provided', async () => {
    const onAction = vi.fn()
    const wrapper = mount(TouchControl, {
      props: { mode: 'button', mapping: { Jump: 'jump' }, onAction }
    })

    await expect(wrapper.find('.touch-control').trigger('touchstart')).resolves.not.toThrow()
    await expect(wrapper.find('.touch-control').trigger('touchend')).resolves.not.toThrow()
    expect(onAction).toHaveBeenCalledWith('jump')
  })

  it('wires press and release per button in multi-button rows', async () => {
    const currentActions: Record<string, unknown> = {}
    const onAction = vi.fn()
    const wrapper = mount(TouchControl, {
      props: {
        mode: 'button',
        mapping: { Left: 'left', Right: 'right' },
        currentActions,
        onAction
      }
    })

    const buttons = wrapper.findAll('.touch-control__button')
    expect(buttons).toHaveLength(2)

    await buttons[0]!.trigger('touchstart')
    expect(currentActions).toHaveProperty('left')
    expect(currentActions).not.toHaveProperty('right')

    await buttons[0]!.trigger('touchend')
    expect(currentActions).not.toHaveProperty('left')
    expect(onAction).toHaveBeenCalledWith('left')
  })
})
