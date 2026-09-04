import { describe, it, expect, vi } from 'vitest'
import { createPointerController, resolvePointerGesture } from './pointer'
import type { ControlHandlers, ControlMapping } from './types'

const WIDTH = 800
const point = (x: number, y = 0) => ({ x, y })

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
    const gesture = resolvePointerGesture(point(startX as number), point(endX as number), WIDTH)

    expect(gesture).toBe(expected)
  })

  it('honours a custom swipe threshold', () => {
    expect(resolvePointerGesture(point(100), point(160), WIDTH, 100)).toBe('tap-left')
    expect(resolvePointerGesture(point(100), point(160), WIDTH, 50)).toBe('swipe-right')
  })

  it('reads no gesture from a target with no width', () => {
    expect(resolvePointerGesture(point(0), point(0), 0)).toBeNull()
  })

  it.each([
    ['a swipe downwards', point(100, 100), point(100, 300), 'swipe-down'],
    ['a swipe upwards', point(100, 300), point(100, 100), 'swipe-up'],
    [
      'a swipe down that also drifts sideways, but less',
      point(100, 100),
      point(130, 300),
      'swipe-down'
    ]
  ])('reads %s', (_label, start, end, expected) => {
    const gesture = resolvePointerGesture(start, end, WIDTH)

    expect(gesture).toBe(expected)
  })

  it('picks whichever axis travelled furthest when both clear the threshold', () => {
    // 200 sideways, 60 down: sideways wins.
    expect(resolvePointerGesture(point(100, 100), point(300, 160), WIDTH)).toBe('swipe-right')
    // 60 sideways, 200 down: down wins.
    expect(resolvePointerGesture(point(100, 100), point(160, 300), WIDTH)).toBe('swipe-down')
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
    getBoundingClientRect: () => ({ left: 0, top: 0, width: WIDTH })
  } as unknown as HTMLElement

  const fire = (type: string, pointerId: number, clientX: number, clientY = 0) =>
    (listeners[type] ?? []).forEach((handler) =>
      handler({ pointerId, clientX, clientY } as unknown as PointerEvent)
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
      'swipe-right': 'next',
      'swipe-down': 'next'
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

  it('reports the mapped action for a vertical swipe', () => {
    const { target, fire } = createTarget()
    const handlers = createHandlers()
    createPointerController(MAPPING, handlers).bind(target)

    fire('pointerdown', 1, 400, 100)
    fire('pointerup', 1, 400, 300)

    expect(handlers.onAction).toHaveBeenCalledWith('next', 'swipe-down', 'pointer')
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

  describe('getDragProgress', () => {
    it('reads 0 while nothing is pressed', () => {
      const { target } = createTarget()
      const controller = createPointerController(MAPPING, createHandlers())
      controller.bind(target)

      expect(controller.getDragProgress()).toBe(0)
    })

    it('tracks a press moving right as positive, relative to the target width', () => {
      const { target, fire } = createTarget()
      const controller = createPointerController(MAPPING, createHandlers())
      controller.bind(target)

      fire('pointerdown', 1, 100)
      fire('pointermove', 1, 300)

      expect(controller.getDragProgress()).toBeCloseTo(200 / WIDTH)
    })

    it('tracks a press moving left as negative', () => {
      const { target, fire } = createTarget()
      const controller = createPointerController(MAPPING, createHandlers())
      controller.bind(target)

      fire('pointerdown', 1, 300)
      fire('pointermove', 1, 100)

      expect(controller.getDragProgress()).toBeCloseTo(-200 / WIDTH)
    })

    it('clamps to the target width rather than growing past it', () => {
      const { target, fire } = createTarget()
      const controller = createPointerController(MAPPING, createHandlers())
      controller.bind(target)

      fire('pointerdown', 1, 0)
      fire('pointermove', 1, WIDTH * 2)

      expect(controller.getDragProgress()).toBe(1)
    })

    it('drops back to 0 once the press ends', () => {
      const { target, fire } = createTarget()
      const controller = createPointerController(MAPPING, createHandlers())
      controller.bind(target)

      fire('pointerdown', 1, 100)
      fire('pointermove', 1, 300)
      fire('pointerup', 1, 300)

      expect(controller.getDragProgress()).toBe(0)
    })

    it('ignores movement from a second pointer arriving mid-press', () => {
      const { target, fire } = createTarget()
      const controller = createPointerController(MAPPING, createHandlers())
      controller.bind(target)

      fire('pointerdown', 1, 100)
      fire('pointermove', 2, 700)

      expect(controller.getDragProgress()).toBe(0)
    })
  })
})
