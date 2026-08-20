import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createMotionController,
  getDeviceGravity,
  getRelativeTilt,
  rotateToScreenFrame
} from './motion'
import type { ControlHandlers, ControlMapping } from './types'

const MOTION_MAPPING: ControlMapping = {
  motion: {
    'tilt-left': 'move-left',
    'tilt-right': 'move-right',
    'tilt-up': 'move-up',
    'tilt-down': 'move-down'
  }
}

const sendOrientation = (beta: number, gamma: number, eventName = 'deviceorientation'): void => {
  const event = new Event(eventName)
  Object.assign(event, { beta, gamma, alpha: 0 })
  window.dispatchEvent(event)
}

/** jsdom defines no orientation event, so support detection needs the constructor present. */
const stubOrientationSupport = (withPermissionPrompt = false): void => {
  const constructorStub = withPermissionPrompt
    ? Object.assign(() => undefined, {
        requestPermission: vi.fn().mockResolvedValue('granted')
      })
    : () => undefined
  Object.defineProperty(window, 'DeviceOrientationEvent', {
    configurable: true,
    writable: true,
    value: constructorStub
  })
}

const setScreenAngle = (angle: number): void => {
  Object.defineProperty(window.screen, 'orientation', {
    configurable: true,
    value: { angle, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  })
}

describe('rotateToScreenFrame', () => {
  it('passes the lean through untouched in the natural orientation', () => {
    expect(rotateToScreenFrame(-7, 12, 0)).toEqual({ x: -7, y: 12 })
  })

  it.each([
    [0, -7, 12],
    [90, 5, 7],
    [180, 7, -12],
    [270, -19, -7]
  ])('maps the device frame onto the screen frame at %i degrees', (angle) => {
    const { x, y } = rotateToScreenFrame(-7, 12, angle)

    expect(Math.hypot(x, y)).toBeCloseTo(Math.hypot(7, 12))
  })

  it('swaps the axes a quarter turn round', () => {
    const { x, y } = rotateToScreenFrame(-7, 12, 90)

    expect(x).toBeCloseTo(12)
    expect(y).toBeCloseTo(7)
  })
})

describe('getDeviceGravity', () => {
  it('points straight out of the back of a flat phone', () => {
    const { x, y, z } = getDeviceGravity(0, 0)

    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(0)
    expect(z).toBeCloseTo(-1)
  })

  it('always returns a unit direction, including across the Euler singularity', () => {
    ;[-180, -95, -90, -45, 0, 45, 89, 90, 91, 179].forEach((beta) =>
      [-90, -30, 0, 30, 90].forEach((gamma) => {
        const { x, y, z } = getDeviceGravity(beta, gamma)
        expect(Math.hypot(x, y, z)).toBeCloseTo(1)
      })
    )
  })

  it('stays continuous through ninety degrees, where the raw angles do not', () => {
    const justBelow = getDeviceGravity(89.9, 20)
    const justAbove = getDeviceGravity(90.1, 20)

    expect(Math.hypot(justAbove.x - justBelow.x, justAbove.y - justBelow.y)).toBeLessThan(0.01)
  })
})

describe('getRelativeTilt', () => {
  it('reads level in the pose it was calibrated in', () => {
    expect(getRelativeTilt({ beta: 62, gamma: -4 }, { beta: 62, gamma: -4 })).toEqual({
      right: 0,
      down: 0
    })
  })

  it('reads a front-to-back lean as screen-down', () => {
    const { right, down } = getRelativeTilt({ beta: 10, gamma: 0 }, { beta: 0, gamma: 0 })

    expect(down).toBeCloseTo(10, 1)
    expect(right).toBeCloseTo(0)
  })

  it('reads a left-to-right lean as screen-right', () => {
    const { right, down } = getRelativeTilt({ beta: 0, gamma: 10 }, { beta: 0, gamma: 0 })

    expect(right).toBeCloseTo(10, 1)
    expect(down).toBeCloseTo(0)
  })

  /**
   * The defect this replaced: subtracting angles, a lean is worth less and less the further
   * the neutral sits from flat, until near-vertical it does almost nothing.
   */
  it.each([0, 20, 45, 60, 75])(
    'is worth the same ten degrees from a %i degree resting pose',
    (neutralBeta) => {
      const { down } = getRelativeTilt(
        { beta: neutralBeta + 10, gamma: 0 },
        { beta: neutralBeta, gamma: 0 }
      )

      expect(down).toBeCloseTo(10, 1)
    }
  )

  it('still answers on the other axis at a steep hold, rather than seizing', () => {
    const { right } = getRelativeTilt({ beta: 85, gamma: 15 }, { beta: 85, gamma: 0 })

    expect(Math.abs(right)).toBeGreaterThan(0)
  })

  /**
   * Not a defect: rolling a nearly upright phone about its own long axis is mostly a yaw, and
   * a yaw does not tilt a board at all. The board should respond less there, and does — what it
   * must never do is stop responding or jump, which the surrounding tests pin down.
   */
  it('rolls the board less from an upright hold than from a flat one', () => {
    const flat = getRelativeTilt({ beta: 0, gamma: 15 }, { beta: 0, gamma: 0 }).right
    const upright = getRelativeTilt({ beta: 85, gamma: 15 }, { beta: 85, gamma: 0 }).right

    expect(Math.abs(upright)).toBeLessThan(Math.abs(flat))
  })

  it('never jumps as the lean crosses ninety degrees', () => {
    const neutral = { beta: 60, gamma: 0 }
    const steps = [88, 89, 90, 91, 92].map(
      (beta) => getRelativeTilt({ beta, gamma: 10 }, neutral).down
    )
    const jumps = steps.slice(1).map((value, index) => Math.abs(value - steps[index]))

    jumps.forEach((jump) => expect(jump).toBeLessThan(3))
  })
})

describe('createMotionController', () => {
  let handlers: ControlHandlers
  let onAction: ReturnType<typeof vi.fn>
  let onRelease: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onAction = vi.fn()
    onRelease = vi.fn()
    handlers = { onAction, onRelease, onInput: vi.fn() }
    stubOrientationSupport()
    setScreenAngle(0)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const build = (threshold = 8) =>
    createMotionController({ current: MOTION_MAPPING }, handlers, { threshold, maxDegrees: 30 })

  it('treats the first reading as level, whatever posture it arrives in', () => {
    const controller = build()
    controller.bind()

    sendOrientation(62, 0)

    expect(controller.getTilt()).toEqual({ x: 0, y: 0 })
    expect(onAction).not.toHaveBeenCalled()
    controller.unbind()
  })

  it('reports a lean measured from that neutral rather than from flat', () => {
    const controller = build()
    controller.bind()

    sendOrientation(62, 0)
    sendOrientation(72, 0)

    expect(controller.getTilt().y).toBeCloseTo(10)
    controller.unbind()
  })

  it('fires a direction once the lean passes the threshold', () => {
    const controller = build()
    controller.bind()

    sendOrientation(0, 0)
    sendOrientation(0, 20)

    expect(onAction).toHaveBeenCalledWith('move-right', 'tilt-right', 'motion')
    controller.unbind()
  })

  it('does not fire below the threshold', () => {
    const controller = build()
    controller.bind()

    sendOrientation(0, 0)
    sendOrientation(0, 3)

    expect(onAction).not.toHaveBeenCalled()
    controller.unbind()
  })

  it('releases the direction when the lean comes back inside the threshold', () => {
    const controller = build()
    controller.bind()

    sendOrientation(0, 0)
    sendOrientation(0, 20)
    sendOrientation(0, 0)

    expect(onRelease).toHaveBeenCalledWith('move-right', 'tilt-right', 'motion')
    controller.unbind()
  })

  it('fires a direction only once while it is held', () => {
    const controller = build()
    controller.bind()

    sendOrientation(0, 0)
    sendOrientation(0, 20)
    sendOrientation(0, 22)
    sendOrientation(0, 25)

    expect(onAction).toHaveBeenCalledTimes(1)
    controller.unbind()
  })

  it('listens to the absolute event too, which some devices fire instead', () => {
    const controller = build()
    controller.bind()

    sendOrientation(0, 0, 'deviceorientationabsolute')
    sendOrientation(0, 20, 'deviceorientationabsolute')

    expect(onAction).toHaveBeenCalledWith('move-right', 'tilt-right', 'motion')
    controller.unbind()
  })

  it('clamps a lean past the configured maximum', () => {
    const controller = build()
    controller.bind()

    sendOrientation(0, 0)
    sendOrientation(0, 89)

    expect(controller.getTilt().x).toBe(30)
    controller.unbind()
  })

  it('retakes the neutral on recalibrate, so a drifted posture becomes level again', () => {
    const controller = build()
    controller.bind()

    sendOrientation(60, 0)
    sendOrientation(75, 0)
    controller.recalibrate()
    sendOrientation(75, 0)

    expect(controller.getTilt()).toEqual({ x: 0, y: 0 })
    controller.unbind()
  })

  it('releases every held direction when recalibrated', () => {
    const controller = build()
    controller.bind()

    sendOrientation(0, 0)
    sendOrientation(0, 20)
    controller.recalibrate()

    expect(onRelease).toHaveBeenCalledWith('move-right', 'tilt-right', 'motion')
    controller.unbind()
  })

  it('swaps the axes when the screen is rotated into landscape', () => {
    setScreenAngle(90)
    const controller = build()
    controller.bind()

    sendOrientation(60, 0)
    sendOrientation(72, 0)

    expect(controller.getTilt().x).toBeCloseTo(12)
    expect(controller.getTilt().y).toBeCloseTo(0)
    controller.unbind()
  })

  it('ignores a reading with no angles at all', () => {
    const controller = build()
    controller.bind()

    const event = new Event('deviceorientation')
    Object.assign(event, { beta: null, gamma: null })
    window.dispatchEvent(event)

    expect(controller.isReceiving()).toBe(false)
    controller.unbind()
  })

  it('stops responding once unbound', () => {
    const controller = build()
    controller.bind()
    sendOrientation(0, 0)
    controller.unbind()

    sendOrientation(0, 40)

    expect(onAction).not.toHaveBeenCalled()
  })

  it('exposes the raw reading for diagnostics', () => {
    const controller = build()
    controller.bind()

    sendOrientation(61, -3)

    expect(controller.getReading()).toEqual({ beta: 61, gamma: -3 })
    controller.unbind()
  })

  it('reports no permission prompt when the platform defines none', () => {
    expect(build().needsPermission()).toBe(false)
  })

  it('reports a permission prompt on a platform that gates the sensor', () => {
    stubOrientationSupport(true)

    expect(build().needsPermission()).toBe(true)
  })

  it('binds only after the gated prompt resolves in its favour', async () => {
    stubOrientationSupport(true)
    const controller = build()

    await expect(controller.requestPermission()).resolves.toBe('granted')

    sendOrientation(0, 0)
    sendOrientation(0, 20)
    expect(onAction).toHaveBeenCalledWith('move-right', 'tilt-right', 'motion')
    controller.unbind()
  })

  it('reports unsupported where the platform has no orientation event at all', async () => {
    Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'DeviceOrientationEvent')

    await expect(build().requestPermission()).resolves.toBe('unsupported')
  })

  it('grants immediately and starts listening where no prompt exists', async () => {
    const controller = build()

    await expect(controller.requestPermission()).resolves.toBe('granted')

    sendOrientation(0, 0)
    sendOrientation(0, 20)
    expect(onAction).toHaveBeenCalledWith('move-right', 'tilt-right', 'motion')
    controller.unbind()
  })
})

describe('requestPermission and transient activation', () => {
  const noopHandlers: ControlHandlers = {
    onAction: () => undefined,
    onRelease: () => undefined,
    onInput: () => undefined
  }

  /**
   * Entering fullscreen consumes transient activation, and so does this prompt, so a caller
   * that does both in one gesture starves whichever runs second. The prompt must therefore be
   * reachable synchronously — no await may precede it inside the controller.
   */
  it('invokes the platform prompt synchronously, before yielding to the event loop', () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      writable: true,
      value: Object.assign(() => undefined, { requestPermission })
    })
    const controller = createMotionController({ current: MOTION_MAPPING }, noopHandlers, {})

    controller.requestPermission()

    expect(requestPermission).toHaveBeenCalledTimes(1)
    controller.unbind()
  })
})

describe('prompt invocation counting', () => {
  const noopHandlers: ControlHandlers = {
    onAction: () => undefined,
    onRelease: () => undefined,
    onInput: () => undefined
  }

  it('counts nothing before anything is asked', () => {
    stubOrientationSupport(true)

    expect(createMotionController({ current: MOTION_MAPPING }, noopHandlers).getPromptCount()).toBe(
      0
    )
  })

  it('counts each platform prompt, so a caller can prove it was reached', async () => {
    stubOrientationSupport(true)
    const controller = createMotionController({ current: MOTION_MAPPING }, noopHandlers)

    await controller.requestPermission()
    await controller.requestPermission()

    expect(controller.getPromptCount()).toBe(2)
    controller.unbind()
  })

  it('counts no prompt on a platform that never gates the sensor', async () => {
    stubOrientationSupport(false)
    const controller = createMotionController({ current: MOTION_MAPPING }, noopHandlers)

    await controller.requestPermission()

    expect(controller.getPromptCount()).toBe(0)
    controller.unbind()
  })
})
