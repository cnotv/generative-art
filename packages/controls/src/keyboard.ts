import type { ControlMapping, ControlHandlers } from './types'

export interface KeyboardController {
  bind: (target?: HTMLElement | null) => void
  unbind: (target?: HTMLElement | null) => void
}

/**
 *
 * @param mappingReference
 * @param mappingReference.current
 * @param handlers
 */
export function createKeyboardController(
  mappingReference: { current: ControlMapping },
  handlers: ControlHandlers
): KeyboardController {
  function handleKeyDown(event: KeyboardEvent) {
    const action = mappingReference.current.keyboard?.[event.key] ?? 'no action'
    handlers.onAction(action, event.key, 'keyboard')
    if (handlers.onInput) handlers.onInput(action, event.key, 'keyboard')
  }

  function handleKeyUp(event: KeyboardEvent) {
    const action = mappingReference.current.keyboard?.[event.key] ?? 'no action'
    handlers.onRelease(action, event.key, 'keyboard')
    if (handlers.onInput) handlers.onInput(action, event.key, 'keyboard')
  }

  function bind(target?: HTMLElement | null) {
    const eventTarget: EventTarget = target ?? window
    eventTarget.addEventListener('keydown', handleKeyDown as EventListener)
    eventTarget.addEventListener('keyup', handleKeyUp as EventListener)
  }

  function unbind(target?: HTMLElement | null) {
    const eventTarget: EventTarget = target ?? window
    eventTarget.removeEventListener('keydown', handleKeyDown as EventListener)
    eventTarget.removeEventListener('keyup', handleKeyUp as EventListener)
  }

  return { bind, unbind }
}
