/**
 * Stateless controls logic for keyboard, gamepad, and touch
 * This module does not manage state, but emits events or calls callbacks
 * All mapping is configurable via a config object
 * 
 * Example usage:
 *
 * import { createControls } from '@webgametoolkit/controls';
 *
 * const controls = createControls({
 *   mapping: {
 *     keyboard: { ArrowLeft: 'left', ArrowRight: 'right', ' ': 'jump' },
 *     gamepad: { left: 'left', right: 'right', a: 'jump' },
 *     touch: { tap: 'jump' }
 *   },
 *   onAction: (action, event, rawEvent) => {
 *     // handle action (e.g., update state, call store, etc.)
 *   }
 * });
 *
 * controls.bindKeyboard();
 * controls.bindGamepad();
 * controls.bindTouch(document.body);
 * controls.bindMouse(document.body);
 */


export type ControlAction = string;
export type ControlEvent = 'down' | 'up';

export interface ControlMapping {
  keyboard?: Record<string, ControlAction>;
  gamepad?: Record<string, ControlAction>;
  touch?: Record<string, ControlAction>;
}

export interface ControlsOptions {
  mapping: ControlMapping;
  onAction: (action: ControlAction, event: ControlEvent, rawEvent: Event) => void;
}

export function createControls(options: ControlsOptions) {
  const { mapping, onAction } = options;

  // Keyboard
  function handleKey(event: KeyboardEvent, eventType: ControlEvent) {
    const action = mapping.keyboard?.[event.key];
    if (action) onAction(action, eventType, event);
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
      const action = mapping.gamepad?.[btnName];
      if (!action) return;
      if (btn.pressed && !lastButtons[i]) onAction(action, 'down', new Event('gamepad'));
      if (!btn.pressed && lastButtons[i]) onAction(action, 'up', new Event('gamepad'));
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
    const action = mapping.touch?.['tap'];
    if (action) onAction(action, eventType, event);
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
    const action = mapping.touch?.['tap'];
    if (action) onAction(action, eventType, event);
  }
  function bindMouse(target: HTMLElement) {
    target.addEventListener('mousedown', (e) => handleMouse(e, 'down'));
    target.addEventListener('mouseup', (e) => handleMouse(e, 'up'));
  }
  function unbindMouse(target: HTMLElement) {
    target.removeEventListener('mousedown', (e) => handleMouse(e, 'down'));
    target.removeEventListener('mouseup', (e) => handleMouse(e, 'up'));
  }

  return {
    bindKeyboard,
    unbindKeyboard,
    bindGamepad,
    unbindGamepad,
    bindTouch,
    unbindTouch,
    bindMouse,
    unbindMouse,
  };
}
