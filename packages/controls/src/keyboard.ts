import type { ControlMapping, ControlHandlers } from './types'

export interface KeyboardController {
  bind: (target?: HTMLElement | null) => void
  unbind: (target?: HTMLElement | null) => void
}

/** Prefers a `Shift+<key>`-mapped action over the bare key's own when Shift is held and the
 * mapping actually defines one, so a mapping can give a modified key its own action without
 * every existing bare-key mapping needing to change. */
const lookupKeyboardAction = (
  keyboardMap: Record<string, string> | undefined,
  event: KeyboardEvent
): string => {
  if (!keyboardMap) return 'no action'
  const shiftedKey = `Shift+${event.key}`
  if (event.shiftKey && shiftedKey in keyboardMap) return keyboardMap[shiftedKey]
  return keyboardMap[event.key] ?? 'no action'
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
    const action = lookupKeyboardAction(mappingReference.current.keyboard, event)
    handlers.onAction(action, event.key, 'keyboard')
    if (handlers.onInput) handlers.onInput(action, event.key, 'keyboard')
  }

  function handleKeyUp(event: KeyboardEvent) {
    const action = lookupKeyboardAction(mappingReference.current.keyboard, event)
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
