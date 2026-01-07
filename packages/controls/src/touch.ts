import type { ControlMapping, ControlHandlers, ControlEvent } from './core';

export interface TouchController {
  bind: (target: HTMLElement) => void;
  unbind: (target: HTMLElement) => void;
  isSupported: () => boolean;
}

export function createTouchController(
  mappingRef: { current: ControlMapping },
  handlers: ControlHandlers
): TouchController {
  function handleTouch(event: TouchEvent, eventType: ControlEvent) {
    const action = mappingRef.current.touch?.['tap'] ?? 'no action';
    if (action) {
      if (eventType === 'up') handlers.onAction(action, event.type, 'touch');
      if (eventType === 'down') handlers.onRelease(action, event.type, 'touch');
    }
  }

  const onTouchStart = (e: TouchEvent) => handleTouch(e, 'down');
  const onTouchEnd = (e: TouchEvent) => handleTouch(e, 'up');

  function bind(target: HTMLElement) {
    target.addEventListener('touchstart', onTouchStart);
    target.addEventListener('touchend', onTouchEnd);
  }

  function unbind(target: HTMLElement) {
    target.removeEventListener('touchstart', onTouchStart);
    target.removeEventListener('touchend', onTouchEnd);
  }

  function isSupported() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  return { bind, unbind, isSupported };
}
