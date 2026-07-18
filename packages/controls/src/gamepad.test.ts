import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { findActiveGamepad, createGamepadController } from './gamepad'
import type { ControlHandlers, ControlMapping } from './types'

type MockButton = { pressed: boolean }
type MockGamepad = {
  index: number
  id: string
  connected: boolean
  buttons: MockButton[]
  axes: number[]
  timestamp: number
}

const makeGamepad = (overrides: Partial<MockGamepad> = {}): MockGamepad => ({
  index: 0,
  id: 'mock-pad',
  connected: true,
  buttons: Array.from({ length: 18 }, () => ({ pressed: false })),
  axes: [0, 0, 0, 0],
  timestamp: 0,
  ...overrides
})

const setGamepads = (gamepads: Array<MockGamepad | null>): void => {
  navigator.getGamepads = vi.fn(() => gamepads as unknown as Gamepad[])
}

describe('findActiveGamepad', () => {
  beforeEach(() => {
    setGamepads([])
  })

  it.each([
    {
      name: 'returns null when no gamepads connected',
      gamepads: [null, null, null, null] as Array<MockGamepad | null>,
      preferred: null,
      expectedIndex: undefined
    },
    {
      name: 'finds gamepad at slot 0',
      gamepads: [makeGamepad({ index: 0 })],
      preferred: null,
      expectedIndex: 0
    },
    {
      name: 'finds gamepad at slot 2 when slots 0/1 are empty (the original bug)',
      gamepads: [null, null, makeGamepad({ index: 2 }), null] as Array<MockGamepad | null>,
      preferred: null,
      expectedIndex: 2
    },
    {
      name: 'honors preferred index when that slot is filled',
      gamepads: [makeGamepad({ index: 0, id: 'first' }), makeGamepad({ index: 1, id: 'second' })],
      preferred: 1,
      expectedIndex: 1
    },
    {
      name: 'falls back to scan when preferred slot is empty',
      gamepads: [null, null, makeGamepad({ index: 2 })] as Array<MockGamepad | null>,
      preferred: 0,
      expectedIndex: 2
    },
    {
      name: 'returns a gamepad even when connected is false (browser quirk)',
      gamepads: [makeGamepad({ index: 0, connected: false })],
      preferred: null,
      expectedIndex: 0
    }
  ])('$name', ({ gamepads, preferred, expectedIndex }) => {
    setGamepads(gamepads)
    const result = findActiveGamepad(preferred)
    expect(result?.index).toBe(expectedIndex)
  })
})

describe('createGamepadController polling', () => {
  let handlers: ControlHandlers
  let mapping: { current: ControlMapping }
  let onAction: ReturnType<typeof vi.fn>
  let onRelease: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    onAction = vi.fn()
    onRelease = vi.fn()
    handlers = { onAction, onRelease, onInput: undefined }
    mapping = {
      current: {
        gamepad: {
          cross: 'jump',
          'axis0-right': 'right',
          'dpad-up': 'up'
        }
      }
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires onAction when a mapped button is pressed at a non-zero slot', () => {
    const gamepad = makeGamepad({ index: 2 })
    setGamepads([null, null, gamepad])
    const controller = createGamepadController(
      mapping,
      handlers,
      ['cross', 'circle', 'square'],
      0.5
    )

    controller.bind()
    vi.advanceTimersByTime(40)

    gamepad.buttons[0].pressed = true
    vi.advanceTimersByTime(40)

    expect(onAction).toHaveBeenCalledWith('jump', 'cross', 'gamepad')
    controller.unbind()
  })

  it('fires onAction when an axis exceeds threshold', () => {
    const gamepad = makeGamepad()
    setGamepads([gamepad])
    const controller = createGamepadController(mapping, handlers, ['cross'], 0.5)

    controller.bind()
    vi.advanceTimersByTime(40)

    gamepad.axes[0] = 0.9
    vi.advanceTimersByTime(40)

    expect(onAction).toHaveBeenCalledWith('right', 'axis0-right', 'gamepad-axis')
    controller.unbind()
  })

  it('stops polling and releases listeners on unbind', () => {
    const gamepad = makeGamepad()
    setGamepads([gamepad])
    const controller = createGamepadController(mapping, handlers, ['cross'], 0.5)
    const removeListener = vi.spyOn(window, 'removeEventListener')

    controller.bind()
    controller.unbind()

    gamepad.buttons[0].pressed = true
    vi.advanceTimersByTime(100)

    expect(onAction).not.toHaveBeenCalled()
    expect(removeListener).toHaveBeenCalledWith('gamepadconnected', expect.any(Function))
    expect(removeListener).toHaveBeenCalledWith('gamepaddisconnected', expect.any(Function))
  })

  it('latches onto a controller that arrives via gamepadconnected after bind', () => {
    setGamepads([null, null, null, null])
    const controller = createGamepadController(mapping, handlers, ['cross'], 0.5)

    controller.bind()
    vi.advanceTimersByTime(40)
    expect(onAction).not.toHaveBeenCalled()

    const gamepad = makeGamepad({ index: 3 })
    setGamepads([null, null, null, gamepad])
    vi.advanceTimersByTime(40)
    gamepad.buttons[0].pressed = true
    vi.advanceTimersByTime(40)

    expect(onAction).toHaveBeenCalledWith('jump', 'cross', 'gamepad')
    controller.unbind()
  })

  it('does not fire onAction for a button already held when polling starts', () => {
    const gamepad = makeGamepad()
    gamepad.buttons[0].pressed = true
    setGamepads([gamepad])
    const controller = createGamepadController(mapping, handlers, ['cross'], 0.5)

    controller.bind()
    vi.advanceTimersByTime(100)
    expect(onAction).not.toHaveBeenCalled()

    gamepad.buttons[0].pressed = false
    vi.advanceTimersByTime(40)
    expect(onRelease).toHaveBeenCalledWith('jump', 'cross', 'gamepad')

    gamepad.buttons[0].pressed = true
    vi.advanceTimersByTime(40)
    expect(onAction).toHaveBeenCalledWith('jump', 'cross', 'gamepad')
    controller.unbind()
  })

  it('does not fire onAction for a stick already deflected when polling starts', () => {
    const gamepad = makeGamepad({ axes: [1, 0, 0, 0] })
    setGamepads([gamepad])
    const controller = createGamepadController(mapping, handlers, ['cross'], 0.5)

    controller.bind()
    vi.advanceTimersByTime(100)
    expect(onAction).not.toHaveBeenCalled()
    controller.unbind()
  })
})
