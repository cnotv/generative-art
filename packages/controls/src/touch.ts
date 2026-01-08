import type { ControlMapping, ControlHandlers, ControlEvent } from './types';

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
    const action = mappingRef.current.touch?.[event.type];
    if (action) {
      if (eventType === event.type) handlers.onAction(action, event.type, 'touch');
      if (eventType === event.type) handlers.onRelease(action, event.type, 'touch');
    }
  }

  const onTouchStart = (e: TouchEvent) => handleTouch(e, 'touchstart');
  const onTouchEnd = (e: TouchEvent) => handleTouch(e, 'touchend');

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
