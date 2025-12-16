export type ControlAction = string;
export type ControlEvent = 'down' | 'up';

export interface ControlMapping {
  keyboard?: Record<string, ControlAction>;
  gamepad?: Record<string, ControlAction>;
  touch?: Record<string, ControlAction>;
}

export interface ControlsOptions {
  mapping: ControlMapping;
  onAction?: (action: ControlAction, trigger: string, device: string) => void;
  onRelease?: (action: ControlAction, trigger: string, device: string) => void;
  onInput?: (action: ControlAction, trigger: string, device: string) => void;
  keyboard?: boolean;
  gamepad?: boolean;
  touch?: boolean;
  mouse?: boolean;
  touchTarget?: HTMLElement | null;
  mouseTarget?: HTMLElement | null;
}

/**
 * Stateless controls logic for keyboard, gamepad, and touch
 * This module does not manage state, but emits events or calls callbacks
 * All mapping is configurable via a config object and updated with remapControlsOptions()
 * 
 * @param { ControlsOptions } options Controls configuration options
 * @returns { destroyControls: () => void, remapControlsOptions: (newOptions: ControlsOptions) => void }
 * @example
 * ```typescript
 * import { createControls } from '@webgametoolkit/controls';
 * const { destroyControls, remapControlsOptions } = createControls({
 *   mapping: {
 *     keyboard: { ArrowLeft: 'left', ArrowRight: 'right', ' ': 'jump' },
 *     gamepad: { left: 'left', right: 'right', a: 'jump' },
 *     touch: { tap: 'jump' }
 *   },
 *   onAction: (action, trigger, device) => {
 *     // e.g. jump, tap, touch
 *   }
 * });
 * ```
 */
export function createControls(options: ControlsOptions) {
  const { mapping, onAction, onRelease, onInput } = options;

  // Keyboard
  function handleKey(event: KeyboardEvent, eventType: ControlEvent) {
    const action = mapping.keyboard?.[event.key] ?? 'no action';
    if (onAction) onAction(action, event.key, 'keyboard');
    if (onRelease && eventType === 'up') onRelease(action, event.key, 'keyboard');
    if (onInput) onInput(action, event.key, 'keyboard');
  }

  function bindKeyboard() {
    window.addEventListener('keydown', (e) => handleKey(e, 'down'));
    window.addEventListener('keyup', (e) => handleKey(e, 'up'));
  }
  function unbindKeyboard() {
    window.removeEventListener('keydown', (e) => handleKey(e, 'down'));
    window.removeEventListener('keyup', (e) => handleKey(e, 'up'));
  }

  // Gamepad (polling based)
  let gamepadIndex: number | null = null;
  let gamepadInterval: number | null = null;
  let lastButtons: boolean[] = [];

  function pollGamepad() {
    const gamepads = navigator.getGamepads();
    const gp = gamepadIndex !== null ? gamepads[gamepadIndex] : null;
    if (!gp) return;
    gp.buttons.forEach((btn, i) => {
      const btnName = Object.keys(mapping.gamepad || {})[i];
      const action = mapping.gamepad?.[btnName] ?? 'no action';
      if (!action) {
        lastButtons[i] = btn.pressed;
        return;
      }
      if (btn.pressed && !lastButtons[i] && onAction) onAction(action, btnName, 'gamepad');
      if (!btn.pressed && lastButtons[i] && onRelease) onRelease(action, btnName, 'gamepad');
      lastButtons[i] = btn.pressed;
    });
  }
  function bindGamepad(index = 0) {
    gamepadIndex = index;
    lastButtons = [];
    gamepadInterval = window.setInterval(pollGamepad, 1000 / 30);
  }
  function unbindGamepad() {
    if (gamepadInterval) window.clearInterval(gamepadInterval);
    gamepadInterval = null;
    gamepadIndex = null;
    lastButtons = [];
  }

  // Touch
  function handleTouch(event: TouchEvent, eventType: ControlEvent) {
    const action = mapping.touch?.['tap'] ?? 'no action';
    if (action) {
      if (onAction && eventType === 'up') onAction(action, event.type, 'touch');
      if (onRelease && eventType === 'down') onRelease(action, event.type, 'touch');
    }
  }
  function bindTouch(target: HTMLElement) {
    target.addEventListener('touchstart', (e) => handleTouch(e, 'down'));
    target.addEventListener('touchend', (e) => handleTouch(e, 'up'));
  }
  function unbindTouch(target: HTMLElement) {
    target.removeEventListener('touchstart', (e) => handleTouch(e, 'down'));
    target.removeEventListener('touchend', (e) => handleTouch(e, 'up'));
  }

  // Mouse
  function handleMouse(event: MouseEvent, eventType: ControlEvent) {
    const action = mapping.touch?.['tap'] ?? 'no action';
    if (action) {
      if (onAction && eventType === 'down') onAction(action, event.type, 'mouse');
      if (onRelease && eventType === 'up') onRelease(action, event.type, 'mouse');
    }
  }
  function bindMouse(target: HTMLElement) {
    target.addEventListener('mousedown', (e) => handleMouse(e, 'down'));
    target.addEventListener('mouseup', (e) => handleMouse(e, 'up'));
  }
  function unbindMouse(target: HTMLElement) {
    target.removeEventListener('mousedown', (e) => handleMouse(e, 'down'));
    target.removeEventListener('mouseup', (e) => handleMouse(e, 'up'));
  }

  // Automatic binding logic
  function isGamepadSupported() {
    return typeof window !== 'undefined' && typeof navigator.getGamepads === 'function';
  }
  function isTouchSupported() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  function autoBind() {
    const unbinds: (() => void)[] = [];
    // Keyboard
    if (options.keyboard !== false) {
      bindKeyboard();
      unbinds.push(unbindKeyboard);
    }
    // Gamepad
    if (options.gamepad !== false && isGamepadSupported()) {
      bindGamepad();
      unbinds.push(unbindGamepad);
    }
    // Touch
    const touchTarget = options.touchTarget || window;
    if (options.touch !== false && isTouchSupported() && touchTarget) {
      // @ts-ignore
      bindTouch(touchTarget);
      if (touchTarget instanceof HTMLElement) {
        unbinds.push(() => unbindTouch(touchTarget));
      }
    }
    // Mouse
    const mouseTarget = options.mouseTarget || window;
    if (options.mouse !== false && mouseTarget) {
      // @ts-ignore
      bindMouse(mouseTarget);
      if (mouseTarget instanceof HTMLElement) {
        unbinds.push(() => unbindMouse(mouseTarget));
      }
    }
    return () => {
      unbinds.forEach((fn) => fn());
    };
  }

  // Auto-bind on create
  let destroyControls = autoBind();

  function remapControlsOptions(newOptions: ControlsOptions) {
    destroyControls();
    createControls( newOptions );
    destroyControls = autoBind();
  }

  return {
    destroyControls,
    remapControlsOptions,
  };
}
