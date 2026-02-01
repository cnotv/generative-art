import type { ControlMapping, ControlHandlers } from './types';

export interface KeyboardController {
  bind: () => void;
  unbind: () => void;
}

export function createKeyboardController(
  mappingReference: { current: ControlMapping },
  handlers: ControlHandlers
): KeyboardController {
  function handleKeyDown(event: KeyboardEvent) {
    const action = mappingReference.current.keyboard?.[event.key] ?? 'no action';
    handlers.onAction(action, event.key, 'keyboard');
    if (handlers.onInput) handlers.onInput(action, event.key, 'keyboard');
  }

  function handleKeyUp(event: KeyboardEvent) {
    const action = mappingReference.current.keyboard?.[event.key] ?? 'no action';
    handlers.onRelease(action, event.key, 'keyboard');
    if (handlers.onInput) handlers.onInput(action, event.key, 'keyboard');
  }

  function bind() {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  }

  function unbind() {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  }

  return { bind, unbind };
}
