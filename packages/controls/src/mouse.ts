import type { ControlMapping, ControlHandlers, ControlEvent } from './types';

export interface MouseController {
  bind: (target: HTMLElement) => void;
  unbind: (target: HTMLElement) => void;
}

export function createMouseController(
  mappingRef: { current: ControlMapping },
  handlers: ControlHandlers
): MouseController {
  function handleMouse(_event: MouseEvent, eventType: ControlEvent) {
    const action = mappingRef.current.touch?.['tap'] ?? 'no action';
    if (action && action !== 'no action') {
      // TODO: investigate how to handle mousedown/mouseup on touchpad triggered with different names
      if (eventType === 'down') handlers.onAction(action, 'click', 'mouse');
      if (eventType === 'up') handlers.onRelease(action, 'click', 'mouse');
    }
  }

  const onMouseDown = (e: MouseEvent) => handleMouse(e, 'down');
  const onMouseUp = (e: MouseEvent) => handleMouse(e, 'up');

  function bind(target: HTMLElement) {
    target.addEventListener('mousedown', onMouseDown);
    target.addEventListener('mouseup', onMouseUp);
  }

  function unbind(target: HTMLElement) {
    target.removeEventListener('mousedown', onMouseDown);
    target.removeEventListener('mouseup', onMouseUp);
  }

  return { bind, unbind };
}
