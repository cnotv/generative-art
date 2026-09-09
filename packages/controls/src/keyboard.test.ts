import { describe, it, expect, vi, afterEach } from 'vitest'
import { createKeyboardController } from './keyboard'
import type { ControlMapping } from './types'

const dispatchKey = (type: 'keydown' | 'keyup', key: string, shiftKey = false): void => {
  window.dispatchEvent(new KeyboardEvent(type, { key, shiftKey }))
}

describe('createKeyboardController', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves a bare key to its mapped action', () => {
    const mapping = { current: { keyboard: { ArrowLeft: 'nextFrame' } } as ControlMapping }
    const onAction = vi.fn()
    const controller = createKeyboardController(mapping, {
      onAction,
      onRelease: vi.fn()
    })

    controller.bind()
    dispatchKey('keydown', 'ArrowLeft')
    controller.unbind()

    expect(onAction).toHaveBeenCalledWith('nextFrame', 'ArrowLeft', 'keyboard')
  })

  it('prefers the Shift-qualified action when Shift is held and one is mapped', () => {
    const mapping = {
      current: {
        keyboard: { ArrowLeft: 'nextFrame', 'Shift+ArrowLeft': 'extendSelectionNext' }
      } as ControlMapping
    }
    const onAction = vi.fn()
    const controller = createKeyboardController(mapping, {
      onAction,
      onRelease: vi.fn()
    })

    controller.bind()
    dispatchKey('keydown', 'ArrowLeft', true)
    controller.unbind()

    expect(onAction).toHaveBeenCalledWith('extendSelectionNext', 'ArrowLeft', 'keyboard')
  })

  it('falls back to the bare key action when Shift is held but no Shift-qualified one is mapped', () => {
    const mapping = { current: { keyboard: { ArrowLeft: 'nextFrame' } } as ControlMapping }
    const onAction = vi.fn()
    const controller = createKeyboardController(mapping, {
      onAction,
      onRelease: vi.fn()
    })

    controller.bind()
    dispatchKey('keydown', 'ArrowLeft', true)
    controller.unbind()

    expect(onAction).toHaveBeenCalledWith('nextFrame', 'ArrowLeft', 'keyboard')
  })

  it('reports "no action" for an unmapped key', () => {
    const mapping = { current: { keyboard: { ArrowLeft: 'nextFrame' } } as ControlMapping }
    const onAction = vi.fn()
    const controller = createKeyboardController(mapping, {
      onAction,
      onRelease: vi.fn()
    })

    controller.bind()
    dispatchKey('keydown', 'q')
    controller.unbind()

    expect(onAction).toHaveBeenCalledWith('no action', 'q', 'keyboard')
  })

  it('resolves the same way on release', () => {
    const mapping = {
      current: {
        keyboard: { ArrowRight: 'previousFrame', 'Shift+ArrowRight': 'extendSelectionPrevious' }
      } as ControlMapping
    }
    const onRelease = vi.fn()
    const controller = createKeyboardController(mapping, {
      onAction: vi.fn(),
      onRelease
    })

    controller.bind()
    dispatchKey('keyup', 'ArrowRight', true)
    controller.unbind()

    expect(onRelease).toHaveBeenCalledWith('extendSelectionPrevious', 'ArrowRight', 'keyboard')
  })

  it('stops dispatching once unbound', () => {
    const mapping = { current: { keyboard: { ArrowLeft: 'nextFrame' } } as ControlMapping }
    const onAction = vi.fn()
    const controller = createKeyboardController(mapping, {
      onAction,
      onRelease: vi.fn()
    })

    controller.bind()
    controller.unbind()
    dispatchKey('keydown', 'ArrowLeft')

    expect(onAction).not.toHaveBeenCalled()
  })
})
