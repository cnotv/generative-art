import { describe, it, expect, vi } from 'vitest'
import { createPointerController, resolvePointerGesture } from './pointer'
import type { ControlHandlers, ControlMapping } from './types'

const WIDTH = 800

describe('resolvePointerGesture', () => {
  it.each([
    ['a tap on the left half', 100, 100, 'tap-left'],
    ['a tap on the right half', 700, 700, 'tap-right'],
    ['a tap exactly on the midline', 400, 400, 'tap-right'],
    ['a short drift that stays a tap', 100, 130, 'tap-left'],
    ['a swipe to the right', 200, 400, 'swipe-right'],
    ['a swipe to the left', 600, 400, 'swipe-left'],
    ['a swipe rightwards that ends on the left half', 300, 350, 'swipe-right'],
    ['a swipe of exactly the threshold', 100, 140, 'swipe-right']
  ])('reads %s', (_label, startX, endX, expected) => {
    const gesture = resolvePointerGesture(startX as number, endX as number, WIDTH)

    expect(gesture).toBe(expected)
  })

  it('honours a custom swipe threshold', () => {
    expect(resolvePointerGesture(100, 160, WIDTH, 100)).toBe('tap-left')
    expect(resolvePointerGesture(100, 160, WIDTH, 50)).toBe('swipe-right')
  })

  it('reads no gesture from a target with no width', () => {
    expect(resolvePointerGesture(0, 0, 0)).toBeNull()
  })
})

const createTarget = () => {
  const listeners: Record<string, ((event: PointerEvent) => void)[]> = {}
  const target = {
    addEventListener: (type: string, handler: (event: PointerEvent) => void) => {
      listeners[type] = [...(listeners[type] ?? []), handler]
    },
    removeEventListener: (type: string, handler: (event: PointerEvent) => void) => {
      listeners[type] = (listeners[type] ?? []).filter((entry) => entry !== handler)
    },
    getBoundingClientRect: () => ({ left: 0, width: WIDTH })
  } as unknown as HTMLElement

  const fire = (type: string, pointerId: number, clientX: number) =>
    (listeners[type] ?? []).forEach((handler) =>
      handler({ pointerId, clientX } as unknown as PointerEvent)
    )

  return { target, fire }
}

const createHandlers = (): ControlHandlers & { onAction: ReturnType<typeof vi.fn> } => ({
  onAction: vi.fn(),
  onRelease: vi.fn()
})

const MAPPING: { current: ControlMapping } = {
  current: {
    pointer: {
      'tap-left': 'previous',
      'tap-right': 'next',
      'swipe-left': 'previous',
      'swipe-right': 'next'
    }
  }
}

describe('createPointerController', () => {
  it('reports the mapped action for a completed gesture', () => {
    const { target, fire } = createTarget()
    const handlers = createHandlers()
    createPointerController(MAPPING, handlers).bind(target)

    fire('pointerdown', 1, 700)
    fire('pointerup', 1, 700)

    expect(handlers.onAction).toHaveBeenCalledWith('next', 'tap-right', 'pointer')
    expect(handlers.onRelease).toHaveBeenCalledWith('next', 'tap-right', 'pointer')
  })

  it('measures from the target rather than the viewport', () => {
    const { fire, target } = createTarget()
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      left: 600,
      width: WIDTH
    } as DOMRect)
    const handlers = createHandlers()
    createPointerController(MAPPING, handlers).bind(target)

    // 900 is on the page's right, but only 300 into an 800-wide target: its left half.
    fire('pointerdown', 1, 900)
    fire('pointerup', 1, 900)

    expect(handlers.onAction).toHaveBeenCalledWith('previous', 'tap-left', 'pointer')
  })

  it('ignores a second pointer arriving mid-gesture', () => {
    const { target, fire } = createTarget()
    const handlers = createHandlers()
    createPointerController(MAPPING, handlers).bind(target)

    fire('pointerdown', 1, 100)
    fire('pointerdown', 2, 700)
    fire('pointerup', 2, 700)

    expect(handlers.onAction).not.toHaveBeenCalled()
  })

  it('reports nothing for a gesture the mapping has no action for', () => {
    const { target, fire } = createTarget()
    const handlers = createHandlers()
    createPointerController({ current: { pointer: { 'tap-left': 'previous' } } }, handlers).bind(
      target
    )

    fire('pointerdown', 1, 700)
    fire('pointerup', 1, 700)

    expect(handlers.onAction).not.toHaveBeenCalled()
  })

  it('abandons a gesture that is cancelled', () => {
    const { target, fire } = createTarget()
    const handlers = createHandlers()
    createPointerController(MAPPING, handlers).bind(target)

    fire('pointerdown', 1, 700)
    fire('pointercancel', 1, 700)
    fire('pointerup', 1, 700)

    expect(handlers.onAction).not.toHaveBeenCalled()
  })

  it('stops reporting once unbound', () => {
    const { target, fire } = createTarget()
    const handlers = createHandlers()
    const controller = createPointerController(MAPPING, handlers)
    controller.bind(target)
    controller.unbind(target)

    fire('pointerdown', 1, 700)
    fire('pointerup', 1, 700)

    expect(handlers.onAction).not.toHaveBeenCalled()
  })
})
