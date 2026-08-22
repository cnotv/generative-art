import type {
  ControlMapping,
  ControlHandlers,
  GravityDirection,
  MotionTilt,
  MotionReading
} from './types'

const DEGREES_TO_RADIANS = Math.PI / 180
const RADIANS_TO_DEGREES = 180 / Math.PI

/** Both event names, because some Android builds only ever fire the absolute variant. */
const ORIENTATION_EVENTS = ['deviceorientation', 'deviceorientationabsolute'] as const

const DIRECTION_TRIGGERS = {
  left: 'tilt-left',
  right: 'tilt-right',
  up: 'tilt-up',
  down: 'tilt-down'
} as const

type OrientationPermissionRequest = () => Promise<'granted' | 'denied'>

export interface MotionController {
  bind: () => void
  unbind: () => void
  isSupported: () => boolean
  needsPermission: () => boolean
  requestPermission: () => Promise<'granted' | 'denied' | 'unsupported'>
  getTilt: () => MotionTilt
  getReading: () => MotionReading | null
  isReceiving: () => boolean
  getPromptCount: () => number
}

export interface MotionOptions {
  /** Degrees of lean past which a direction counts as pressed. */
  threshold?: number
  /** Largest lean that contributes; readings past it are clamped. */
  maxDegrees?: number
}

const clampToRange = (value: number, limit: number): number =>
  Math.max(-limit, Math.min(limit, value))

interface DirectionEmitter {
  update: (tilt: MotionTilt, threshold: number) => void
  releaseAll: () => void
}

/**
 * Turn a continuous lean into pressed and released actions, firing only on a change so a held
 * direction reports once rather than on every sensor sample.
 * @param mappingReference Live reference to the active mapping
 * @param handlers Action, release and input callbacks shared by every device
 * @returns An emitter tracking which directions are currently held
 */
const createDirectionEmitter = (
  mappingReference: { current: ControlMapping },
  handlers: ControlHandlers
): DirectionEmitter => {
  const active = new Set<string>()

  const emit = (trigger: string, pressed: boolean): void => {
    const action = mappingReference.current.motion?.[trigger]
    if (!action) return
    if (pressed) {
      handlers.onAction(action, trigger, 'motion')
      if (handlers.onInput) handlers.onInput(action, trigger, 'motion')
      return
    }
    handlers.onRelease(action, trigger, 'motion')
  }

  const setTriggerState = (trigger: string, pressed: boolean): void => {
    if (pressed === active.has(trigger)) return
    if (pressed) active.add(trigger)
    else active.delete(trigger)
    emit(trigger, pressed)
  }

  return {
    update: (tilt, threshold) => {
      setTriggerState(DIRECTION_TRIGGERS.left, tilt.x <= -threshold)
      setTriggerState(DIRECTION_TRIGGERS.right, tilt.x >= threshold)
      setTriggerState(DIRECTION_TRIGGERS.up, tilt.y <= -threshold)
      setTriggerState(DIRECTION_TRIGGERS.down, tilt.y >= threshold)
    },
    releaseAll: () =>
      Object.values(DIRECTION_TRIGGERS).forEach((trigger) => setTriggerState(trigger, false))
  }
}

/**
 * iOS gates the sensor behind a static permission request that no other engine defines, so its
 * presence — never the user agent — is what decides whether a prompt is required.
 */
const getPermissionRequest = (): OrientationPermissionRequest | null => {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return null
  const { requestPermission } = window.DeviceOrientationEvent as unknown as {
    requestPermission?: unknown
  }
  if (typeof requestPermission !== 'function') return null
  return () =>
    (requestPermission as OrientationPermissionRequest).call(window.DeviceOrientationEvent)
}

const getScreenAngle = (): number => {
  if (typeof window === 'undefined') return 0
  return window.screen?.orientation?.angle ?? 0
}

/**
 * Where gravity points, in the device's own axes.
 *
 * The orientation angles are Euler angles, and Euler angles have a singularity: at ninety
 * degrees of front-to-back tilt the left-to-right angle becomes undefined and flips sign, so
 * anything computed from the raw angles jerks there and then stops responding on that axis.
 * A phone held up to read already sits well past halfway to that point, which puts normal play
 * right on top of it. The direction of gravity has no such discontinuity, so every calculation
 * downstream is done on this vector instead.
 * @param beta Front-to-back device tilt in degrees
 * @param gamma Left-to-right device tilt in degrees
 * @returns Unit vector pointing down, in device axes: x right, y toward the top of the screen
 */
export const getDeviceGravity = (beta: number, gamma: number): GravityDirection => {
  const b = beta * DEGREES_TO_RADIANS
  const g = gamma * DEGREES_TO_RADIANS

  return {
    x: Math.cos(b) * Math.sin(g),
    y: -Math.sin(b),
    z: -Math.cos(b) * Math.cos(g)
  }
}

/**
 * How far, and which way, the device is leaning away from level.
 *
 * Measured as the rotation from world-down to the device's own down, rather than by reading the
 * Euler angles off the event. Subtracting angles inherits the singularity at ninety degrees of
 * pitch, where the roll angle flips sign and then stops responding; the angle between two
 * directions has no such discontinuity, so ten degrees of lean reads as ten degrees from any
 * posture, including past vertical.
 * @param reading The latest reading
 * @returns Lean in degrees, `right` toward the device's right edge and `down` toward its bottom
 */
export const getLevelTilt = ({ beta, gamma }: MotionReading): { right: number; down: number } => {
  const gravity = getDeviceGravity(beta, gamma)

  // The length of the component of gravity lying in the screen plane is sin(angle from level);
  // pairing it with the out-of-plane component gives an angle accurate at every magnitude,
  // unlike acos alone.
  const sine = Math.hypot(gravity.x, gravity.y)
  if (sine < 1e-9) return { right: 0, down: 0 }

  const degreesPerUnit = (Math.atan2(sine, -gravity.z) * RADIANS_TO_DEGREES) / sine

  return { right: gravity.x * degreesPerUnit, down: -gravity.y * degreesPerUnit }
}

/**
 * Rotate a lean into the frame the player is looking at.
 *
 * The reading is against the device's own axes, which stop matching the screen the moment it
 * rotates: held sideways, a left-to-right lean arrives on the front-to-back axis instead.
 * @param right Lean toward the device's right edge, in degrees
 * @param down Lean toward the device's bottom edge, in degrees
 * @param screenAngle The screen's rotation from its natural orientation
 * @returns Lean in screen space, x toward screen-right and y toward screen-bottom
 */
export const rotateToScreenFrame = (
  right: number,
  down: number,
  screenAngle: number
): MotionTilt => {
  const radians = screenAngle * DEGREES_TO_RADIANS
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)

  return {
    x: right * cosine + down * sine,
    y: down * cosine - right * sine
  }
}

/**
 * Device orientation as a control device.
 *
 * Lean is measured from world horizontal, so a device lying flat reports level and there is
 * nothing to calibrate. That costs the ergonomics of a device held up to be read — such a pose
 * already sits past any usable lean limit — and buys a zero the player can find by laying the
 * device down, rather than one they can only locate by watching what the game does.
 *
 * Leans past a threshold are reported as ordinary pressed and released actions so motion mixes
 * with the other devices, while `getTilt` exposes the continuous value for games that steer by
 * angle rather than by direction.
 * @param mappingReference Live reference to the active mapping
 * @param handlers Action, release and input callbacks shared by every device
 * @param options Threshold and clamp settings
 * @returns The bindable controller
 */
export function createMotionController(
  mappingReference: { current: ControlMapping },
  handlers: ControlHandlers,
  options: MotionOptions = {}
): MotionController {
  const threshold = options.threshold ?? 8
  const maxDegrees = options.maxDegrees ?? 30

  const directions = createDirectionEmitter(mappingReference, handlers)
  const state = {
    reading: null as MotionReading | null,
    tilt: { x: 0, y: 0 } as MotionTilt,
    receiving: false,
    // Counted so a caller can prove the platform prompt was reached, rather than inferring it
    // from a permission value that looks the same whether the prompt showed or never ran.
    promptCount: 0
  }

  const handleOrientation = (event: Event): void => {
    const orientation = event as DeviceOrientationEvent
    if (orientation.beta === null && orientation.gamma === null) return

    const reading: MotionReading = {
      beta: orientation.beta ?? 0,
      gamma: orientation.gamma ?? 0
    }
    state.reading = reading
    state.receiving = true

    const lean = getLevelTilt(reading)
    const screenTilt = rotateToScreenFrame(lean.right, lean.down, getScreenAngle())
    state.tilt = {
      x: clampToRange(screenTilt.x, maxDegrees),
      y: clampToRange(screenTilt.y, maxDegrees)
    }
    directions.update(state.tilt, threshold)
  }

  function isSupported(): boolean {
    return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
  }

  function needsPermission(): boolean {
    return getPermissionRequest() !== null
  }

  function bind(): void {
    if (!isSupported()) return
    ORIENTATION_EVENTS.forEach((eventName) => window.addEventListener(eventName, handleOrientation))
  }

  function unbind(): void {
    if (typeof window === 'undefined') return
    ORIENTATION_EVENTS.forEach((eventName) =>
      window.removeEventListener(eventName, handleOrientation)
    )
    directions.releaseAll()
    state.tilt = { x: 0, y: 0 }
    state.receiving = false
  }

  /**
   * Ask for sensor access. Must be called from a real tap: the prompt requires transient
   * activation, and a browser only offers it once.
   */
  async function requestPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
    if (!isSupported()) return 'unsupported'

    const request = getPermissionRequest()
    if (!request) {
      bind()
      return 'granted'
    }

    state.promptCount += 1
    const outcome = await request().catch(() => 'denied' as const)
    if (outcome === 'granted') bind()
    return outcome === 'granted' ? 'granted' : 'denied'
  }

  return {
    bind,
    unbind,
    isSupported,
    needsPermission,
    requestPermission,
    getTilt: () => state.tilt,
    getReading: () => state.reading,
    isReceiving: () => state.receiving,
    getPromptCount: () => state.promptCount
  }
}
