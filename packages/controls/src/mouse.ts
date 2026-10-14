import type { ControlMapping, ControlHandlers, ControlEvent } from './types'

export interface MouseController {
  bind: (target: HTMLElement) => void
  unbind: (target: HTMLElement) => void
}

/**
 * Turns mouse presses into the action mapped to a tap.
 * @param mappingReference Holds the current mapping, so a remap applies without rebinding.
 * @param handlers Receive each action as it starts and ends.
 * @returns The controller, to bind and unbind its listeners.
 */
export function createMouseController(
  mappingReference: { current: ControlMapping },
  handlers: ControlHandlers
): MouseController {
  function handleMouse(event: MouseEvent, eventType: ControlEvent) {
    const action = mappingReference.current.touch?.['tap']
    if (action) {
      if (eventType === event.type) handlers.onAction(action, event.type, 'mouse')
      if (eventType === event.type) handlers.onRelease(action, event.type, 'mouse')
    }
  }

  const onMouseDown = (e: MouseEvent) => handleMouse(e, 'mousedown')
  const onMouseUp = (e: MouseEvent) => handleMouse(e, 'mouseup')

  function bind(target: HTMLElement) {
    target.addEventListener('mousedown', onMouseDown)
    target.addEventListener('mouseup', onMouseUp)
  }

  function unbind(target: HTMLElement) {
    target.removeEventListener('mousedown', onMouseDown)
    target.removeEventListener('mouseup', onMouseUp)
  }

  return { bind, unbind }
}
