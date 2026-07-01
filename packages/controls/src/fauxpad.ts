import type { ControlMapping, ControlHandlers } from './types'

export interface FauxPadPosition {
  x: number
  y: number
  distance: number
  angle: number
}

export interface FauxPadController {
  bind: (edgeElement: HTMLElement, insideElement: HTMLElement) => void
  unbind: (edgeElement: HTMLElement, insideElement: HTMLElement) => void
  getPosition: () => FauxPadPosition
  reset: () => void
  isActive: () => boolean
}

export interface FauxPadOptions {
  deadzone?: number // Minimum distance to trigger (0-1, default: 0.1)
  directionThreshold?: number // Angle threshold for 4-way directions (default: 45 degrees)
  enableEightWay?: boolean // Enable 8-way direction detection (default: false)
  debug?: boolean // Enable debug logging (default: false)
}

interface AngleRange {
  min: number
  max: number
  directions: string[]
}

const EIGHT_WAY_RANGES: AngleRange[] = [
  { min: 337.5, max: 360, directions: ['right'] },
  { min: 0, max: 22.5, directions: ['right'] },
  { min: 22.5, max: 67.5, directions: ['down', 'right'] },
  { min: 67.5, max: 112.5, directions: ['down'] },
  { min: 112.5, max: 157.5, directions: ['down', 'left'] },
  { min: 157.5, max: 202.5, directions: ['left'] },
  { min: 202.5, max: 247.5, directions: ['up', 'left'] },
  { min: 247.5, max: 292.5, directions: ['up'] },
  { min: 292.5, max: 337.5, directions: ['up', 'right'] }
]

const getEightWayDirections = (angle: number): string[] => {
  const match = EIGHT_WAY_RANGES.find((range) => angle >= range.min && angle < range.max)
  return match?.directions ?? []
}

const getFourWayDirections = (angle: number, directionThreshold: number): string[] => {
  if (angle >= 360 - directionThreshold || angle < directionThreshold) return ['right']
  if (angle >= 90 - directionThreshold && angle < 90 + directionThreshold) return ['down']
  if (angle >= 180 - directionThreshold && angle < 180 + directionThreshold) return ['left']
  if (angle >= 270 - directionThreshold && angle < 270 + directionThreshold) return ['up']
  return []
}

const getAngle = (x: number, y: number): number => {
  const rad = Math.atan2(y, x)
  const deg = rad * (180 / Math.PI)
  return (deg + 360) % 360
}

interface DirectionState {
  mapping: { current: ControlMapping }
  handlers: ControlHandlers
  activeDirections: Set<string>
}

function releaseDirections(state: DirectionState, directions: string[]) {
  directions.forEach((dir) => {
    const action = state.mapping.current['faux-pad']?.[dir]
    if (action) state.handlers.onRelease(action, dir, 'faux-pad')
    state.activeDirections.delete(dir)
  })
}

function activateDirections(state: DirectionState, directions: Set<string>) {
  directions.forEach((dir) => {
    if (!state.activeDirections.has(dir)) {
      const action = state.mapping.current['faux-pad']?.[dir]
      if (action) state.handlers.onAction(action, dir, 'faux-pad')
      state.activeDirections.add(dir)
    }
  })
}

interface DragCallbacks {
  start: (x: number, y: number) => void
  move: (x: number, y: number) => void
  end: () => void
}

/**
 * Wire touch and mouse dragging on the inside element to the drag callbacks.
 * Mouse move/up are bound on window so a drag keeps tracking outside the pad.
 *
 * @param {HTMLElement} inside The draggable knob element
 * @param {DragCallbacks} callbacks Start/move/end handlers
 * @returns {() => void} A function that removes every listener
 */
function attachDragListeners(inside: HTMLElement, callbacks: DragCallbacks): () => void {
  const onTouchStart = (event: TouchEvent) => {
    event.preventDefault()
    callbacks.start(event.touches[0].clientX, event.touches[0].clientY)
  }
  const onTouchMove = (event: TouchEvent) => {
    event.preventDefault()
    callbacks.move(event.touches[0].clientX, event.touches[0].clientY)
  }
  const onMouseDown = (event: MouseEvent) => {
    event.preventDefault()
    callbacks.start(event.clientX, event.clientY)
  }
  const onMouseMove = (event: MouseEvent) => callbacks.move(event.clientX, event.clientY)

  inside.addEventListener('touchstart', onTouchStart as EventListener)
  inside.addEventListener('touchmove', onTouchMove as EventListener)
  inside.addEventListener('touchend', callbacks.end)
  inside.addEventListener('mousedown', onMouseDown as EventListener)
  window.addEventListener('mousemove', onMouseMove as EventListener)
  window.addEventListener('mouseup', callbacks.end)

  return () => {
    inside.removeEventListener('touchstart', onTouchStart as EventListener)
    inside.removeEventListener('touchmove', onTouchMove as EventListener)
    inside.removeEventListener('touchend', callbacks.end)
    inside.removeEventListener('mousedown', onMouseDown as EventListener)
    window.removeEventListener('mousemove', onMouseMove as EventListener)
    window.removeEventListener('mouseup', callbacks.end)
  }
}

/**
 * Create a virtual faux-pad controller that interprets touch/mouse input into directional actions
 *
 * @example
 * ```typescript
 * const fauxpad = createFauxPadController(
 *   mappingRef,
 *   handlers,
 *   { deadzone: 0.15, directionThreshold: 45 }
 * );
 * fauxpad.bind(edgeElement, insideElement);
 * ```
 */
export function createFauxPadController(
  mappingReference: { current: ControlMapping },
  handlers: ControlHandlers,
  options: FauxPadOptions = {}
): FauxPadController {
  const deadzone = options.deadzone ?? 0.1
  const directionThreshold = options.directionThreshold ?? 45
  const enableEightWay = options.enableEightWay ?? false
  const debug = options.debug ?? false

  let initialPosition = { x: 0, y: 0 }
  let currentPosition = { x: 0, y: 0 }
  let threshold = { x: 0, y: 0 }
  let isActive = false
  const activeDirections = new Set<string>()
  let insideElement_: HTMLElement | null = null

  const dirState: DirectionState = { mapping: mappingReference, handlers, activeDirections }

  const getDirectionFromAngle = (angle: number): string[] =>
    enableEightWay ? getEightWayDirections(angle) : getFourWayDirections(angle, directionThreshold)

  const getPosition = (): FauxPadPosition => {
    if (threshold.x === 0 || threshold.y === 0) return { x: 0, y: 0, distance: 0, angle: 0 }
    const x = currentPosition.x / threshold.x
    const y = currentPosition.y / threshold.y
    const distance = Math.min(Math.hypot(x, y), 1)
    const angle = getAngle(x, y)
    return { x, y, distance, angle }
  }

  const updateDirections = () => {
    const pos = getPosition()
    const directions = getDirectionFromAngle(pos.angle)

    if (debug && pos.distance > deadzone) {
      console.warn(
        '[FauxPad Debug] position:',
        pos,
        'directions:',
        directions,
        'threshold:',
        directionThreshold
      )
    }

    if (pos.distance < deadzone) {
      releaseDirections(dirState, [...activeDirections])
      activeDirections.clear()
      return
    }

    const currentDirections = new Set(directions)
    releaseDirections(
      dirState,
      [...activeDirections].filter((dir) => !currentDirections.has(dir))
    )
    activateDirections(dirState, currentDirections)
  }

  const reset = () => {
    currentPosition = { x: 0, y: 0 }
    if (insideElement_) insideElement_.style.transform = 'translate(0, 0)'
    releaseDirections(dirState, [...activeDirections])
    activeDirections.clear()
    isActive = false
  }

  const startDrag = (x: number, y: number) => {
    initialPosition = { x, y }
    isActive = true
  }

  const moveDrag = (x: number, y: number) => {
    if (!isActive) return
    const rawX = x - initialPosition.x
    const rawY = y - initialPosition.y
    const distance = Math.hypot(rawX, rawY)
    const scale = distance > threshold.x ? threshold.x / distance : 1
    currentPosition = { x: rawX * scale, y: rawY * scale }
    if (insideElement_) {
      insideElement_.style.transform = `translate(${currentPosition.x}px, ${currentPosition.y}px)`
    }
    updateDirections()
  }

  const endDrag = () => {
    if (isActive) reset()
  }

  let detachDrag: (() => void) | null = null

  function bind(edgeElement: HTMLElement, insideElement: HTMLElement) {
    insideElement_ = insideElement
    threshold = {
      x: edgeElement.offsetWidth / 2 - insideElement.offsetWidth / 2,
      y: edgeElement.offsetHeight / 2 - insideElement.offsetHeight / 2
    }
    detachDrag = attachDragListeners(insideElement, {
      start: startDrag,
      move: moveDrag,
      end: endDrag
    })
  }

  function unbind(_edgeElement: HTMLElement, _insideElement: HTMLElement) {
    detachDrag?.()
    detachDrag = null
    insideElement_ = null
  }

  return { bind, unbind, getPosition, reset, isActive: () => isActive }
}
