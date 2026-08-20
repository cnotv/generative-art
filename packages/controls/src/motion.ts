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
  recalibrate: () => void
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
 * How far, and which way, the device has leaned away from the pose it was calibrated in.
 *
 * Measured as the rotation between two gravity directions rather than as a difference of
 * angles. Subtracting angles quietly loses sensitivity the further the neutral sits from flat —
 * at a steep hold a left-to-right roll turns the phone about an axis nearly aligned with
 * gravity, so it barely tilts the board — and it inherits the Euler singularity as well. The
 * angle between two directions has neither problem: ten degrees of lean reads as ten degrees
 * from any starting posture.
 * @param current The latest reading
 * @param neutral The reading captured at calibration
 * @returns Lean in degrees, `right` toward the device's right edge and `down` toward its bottom
 */
export const getRelativeTilt = (
  current: MotionReading,
  neutral: MotionReading
): { right: number; down: number } => {
  const from = getDeviceGravity(neutral.beta, neutral.gamma)
  const to = getDeviceGravity(current.beta, current.gamma)

  // The axis the device turned about, with a length of sin(angle); pairing it with the dot
  // product gives an angle that stays accurate at every magnitude, unlike acos alone.
  const axis = {
    x: from.y * to.z - from.z * to.y,
    y: from.z * to.x - from.x * to.z,
    z: from.x * to.y - from.y * to.x
  }
  const sine = Math.hypot(axis.x, axis.y, axis.z)
  if (sine < 1e-9) return { right: 0, down: 0 }

  const cosine = from.x * to.x + from.y * to.y + from.z * to.z
  const degreesPerUnit = (Math.atan2(sine, cosine) * RADIANS_TO_DEGREES) / sine

  // Turning about the device's X axis pitches the board toward the screen's bottom; turning
  // about its Y axis rolls the board toward the screen's right.
  return { right: -axis.y * degreesPerUnit, down: -axis.x * degreesPerUnit }
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
 * The sensor reports posture, not intent: a phone held up to be read already sits far from
 * flat, so every reading is taken relative to a neutral captured when the device is bound or
 * recalibrated. Without that subtraction any usable lean limit is saturated before the player
 * has moved, and the controls appear dead or reversed.
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
    neutral: null as MotionReading | null,
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
    if (!state.neutral) state.neutral = reading

    const lean = getRelativeTilt(reading, state.neutral)
    const screenTilt = rotateToScreenFrame(lean.right, lean.down, getScreenAngle())
    state.tilt = {
      x: clampToRange(screenTilt.x, maxDegrees),
      y: clampToRange(screenTilt.y, maxDegrees)
    }
    directions.update(state.tilt, threshold)
  }

  const recalibrate = (): void => {
    state.neutral = null
    state.tilt = { x: 0, y: 0 }
    directions.releaseAll()
  }

  // A rotated screen means the neutral was captured against axes the player no longer reads
  // the same way, so it has to be retaken rather than carried over.
  const handleScreenRotation = (): void => recalibrate()

  function isSupported(): boolean {
    return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
  }

  function needsPermission(): boolean {
    return getPermissionRequest() !== null
  }

  function bind(): void {
    if (!isSupported()) return
    ORIENTATION_EVENTS.forEach((eventName) => window.addEventListener(eventName, handleOrientation))
    window.screen?.orientation?.addEventListener('change', handleScreenRotation)
  }

  function unbind(): void {
    if (typeof window === 'undefined') return
    ORIENTATION_EVENTS.forEach((eventName) =>
      window.removeEventListener(eventName, handleOrientation)
    )
    window.screen?.orientation?.removeEventListener('change', handleScreenRotation)
    recalibrate()
    state.receiving = false
  }

  /**
   * Ask for sensor access. Must be called from a real tap: the prompt requires transient
   * activation, and a browser only offers it once.
   */
  async function requestPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
    if (!isSupported()) return 'unsupported'
    recalibrate()

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
    recalibrate,
    getTilt: () => state.tilt,
    getReading: () => state.reading,
    isReceiving: () => state.receiving,
    getPromptCount: () => state.promptCount
  }
}
