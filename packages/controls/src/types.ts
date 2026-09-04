export type ControlAction = string
export type ControlDevice = 'keyboard' | 'gamepad' | 'touch' | 'pointer' | 'faux-pad' | 'motion'
export type ControlEvent = 'touchstart' | 'touchend' | 'mousedown' | 'mouseup'

/** A press and release read as one gesture, by where it happened and how far it moved. Taps
 * are read horizontally only; a swipe reads whichever axis it travelled furthest on. */
export type PointerGesture =
  | 'tap-left'
  | 'tap-right'
  | 'swipe-left'
  | 'swipe-right'
  | 'swipe-up'
  | 'swipe-down'

export interface ControlMapping {
  keyboard?: Record<string, ControlAction>
  gamepad?: Record<string, ControlAction> // Supports both buttons (cross, dpad-up) and axes (axis0-left, axis1-up)
  touch?: Record<string, ControlAction>
  /** Horizontal pointer gestures, over mouse, touch and pen alike: see `PointerGesture`. */
  pointer?: Partial<Record<PointerGesture, ControlAction>>
  'faux-pad'?: Record<string, ControlAction> // Virtual faux-pad: up, down, left, right
  motion?: Record<string, ControlAction> // Device tilt: tilt-left, tilt-right, tilt-up, tilt-down
}

/** A raw orientation reading in the device's own frame, before screen rotation is applied. */
export interface MotionReading {
  beta: number
  gamma: number
}

/** A unit vector pointing down, in the device's own axes. */
export interface GravityDirection {
  x: number
  y: number
  z: number
}

/** A lean in screen space: x toward screen-right, y toward screen-bottom, in degrees. */
export interface MotionTilt {
  x: number
  y: number
}

export interface ControlsOptions {
  mapping: ControlMapping
  onAction?: (action: ControlAction, trigger: string, device: string) => void
  onRelease?: (action: ControlAction, trigger: string, device: string) => void
  onInput?: (action: ControlAction, trigger: string, device: string) => void
  keyboard?: boolean
  gamepad?: boolean
  touch?: boolean
  mouse?: boolean
  keyboardTarget?: HTMLElement | null
  touchTarget?: HTMLElement | null
  mouseTarget?: HTMLElement | null
  pointer?: boolean
  pointerTarget?: HTMLElement | null
  /** Travel at or past which a press reads as a swipe rather than a tap (default: 40) */
  swipeThreshold?: number
  buttonMap?: string[] // Optional: custom button names by index
  axisThreshold?: number // Threshold for axis activation (default: 0.5)
  motion?: boolean // Device orientation; still requires requestMotionPermission() from a tap
  motionThreshold?: number // Degrees of lean that count as a press (default: 8)
  motionMaxDegrees?: number // Largest lean that contributes (default: 30)
}

export type ControlsCurrents = Record<
  string,
  {
    action: string
    trigger: string
    device: string
    triggers: Set<string> // Track all active triggers for this action
  }
>
export type ControlsLogs = Array<{
  action: string
  trigger: string
  device: string
  timestamp: number
  type: string
}>

export type ControlsExtras = {
  destroyControls: () => void
  remapControlsOptions: (newOptions: ControlsOptions) => void
  getMapping: () => ControlMapping
  setMapping: (mapping: ControlMapping) => void
  currentActions: ControlsCurrents
  logs: ControlsLogs
  buttonMap: string[]
  motion: MotionControls
  pointer: PointerControls
}

/** Continuous read of the pointer gesture in progress, alongside the discrete action it fires on release. */
export interface PointerControls {
  /** How far the live press has travelled, signed and relative to the target's width: 0 idle, towards 1 or -1 as it nears an edge. */
  getDragProgress: () => number
}

/**
 * Device-tilt controls. Lean is measured from world horizontal, so a device lying flat reads
 * level and there is nothing to calibrate. Sensor access needs a real tap, so
 * `requestMotionPermission` is called from a gesture handler rather than at setup.
 */
export interface MotionControls {
  isSupported: () => boolean
  needsPermission: () => boolean
  requestMotionPermission: () => Promise<'granted' | 'denied' | 'unsupported'>
  /** Continuous lean in degrees, for games that steer by angle rather than by direction. */
  getTilt: () => MotionTilt
  /** The latest raw reading, for diagnostics. */
  getReading: () => MotionReading | null
  isReceiving: () => boolean
  /** How many times the platform permission prompt has actually been invoked. */
  getPromptCount: () => number
}

export type ControlSkinId = string

export interface ControlSkin {
  id: ControlSkinId
  label: string
  isDefault?: boolean
}

export interface ControlPreset {
  name: string
  mapping: ControlMapping
  skin: ControlSkinId
}

export interface ControlHandlers {
  onAction: (action: ControlAction, trigger: string, device: string) => void
  onRelease: (action: ControlAction, trigger: string, device: string) => void
  onInput?: (action: ControlAction, trigger: string, device: string) => void
}
